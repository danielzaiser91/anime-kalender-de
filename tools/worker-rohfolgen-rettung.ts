/**
 * **Rettung der Rohfolgen-Zuordnungen vom 16.10.2026** aus der Meldungskopie, ohne die echte D1 anzufassen.
 *
 * Ein Lauf von `bestand-bauen`, der Rohfolgen abhakt und danach scheitert, bevor seine Quellen gepusht sind, verliert
 * die Zuordnungen: Der Worker liefert übernommene Zeilen nie wieder. Je Fenster (`FENSTER`) werden sie in einer
 * Wegwerf-Kopie der Meldungskopie wieder geöffnet, der echte Zuordner (`fetch-rohfolgen.ts`) läuft gegen eine Kulisse mit
 * dem Repo-Stand des Laufs, und sein Ergebnis wird dreiseitig in den heutigen Stand gemischt: Ein Schlüssel, den ein
 * späterer Lauf schon geändert hat, bleibt, wie er ist; ein geretteter Eintrag mit weniger Folgen wird gemeldet, nicht
 * übernommen. Die Bilanz je Fenster steht neben den Zahlen aus dem Log des Laufs.
 *
 * Aufruf: `LAUF_TOKEN=… npm run meldungskopie -- holen`, dann `npx tsx tools/worker-rohfolgen-rettung.ts [--kopie <sqlite>]`
 */
import { DatabaseSync } from 'node:sqlite'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { pathToFileURL } from 'node:url'
import { offeneRohfolgen } from '../worker/src/rohfolgen-seiten.ts'
import { serientitelJeAdresse } from '../worker/src/pruefung-serientitel.ts'
import { AM, lies, ROHFOLGE_UEBERNOMMEN, zaehleOffene } from '../worker/src/titelzeile-format.ts'
import { d1 } from './worker-titelzeile-hilfe.ts'

const WURZEL = resolve(import.meta.dirname, '..')

/** Die Zahlen aus dem Log eines Laufs: „… Rohfolgen geholt“, „… Rohfolgen abgehakt“, „… Adressen zugeordnet (… Folgen)“. */
export type LogZahlen = { geholt: number; abgehakt: number; adressen: number; folgen: number }
/** Ein Lauf, der abhakte, ohne zu pushen; `stand` ist sein `headSha`. */
export type Fenster = { lauf: number; von: string; bis: string; stand: string; log: LogZahlen }

/**
 * Alle 14 roten Läufe von `bestand-bauen` vom 16.10. 19:00Z bis zum Merge von #1407 gegen ihre Logs gelesen: Nur dieser
 * hakte ab und pushte nicht. 38973378421 hakte 18 ab und pushte sie (edab778: 7 neue, 1 geänderte Adresse, 18 Folgen),
 * die übrigen zwölf ordneten 0 Adressen zu und hakten nichts ab.
 */
export const FENSTER: Fenster[] = [
  {
    lauf: 38959396065,
    // Lesebeginn des letzten gelungenen Abhakens davor (Lauf 38827442453, 1.383 abgehakt); danach scheiterte jedes mit HTTP 500.
    von: '2026-10-16T00:06:06Z',
    // „23345 Rohfolgen geholt“ um 20:05:19.6Z (Log Zeile 588).
    bis: '2026-10-16T20:05:20Z',
    stand: '3919eda6455edd6413576f71f59180dfe6e8314f',
    log: { geholt: 23345, abgehakt: 13350, adressen: 1029, folgen: 2771 },
  },
]
/** Die Dateien, die der Zuordner über alle Läufe ansammelt. */
export const SAMMLUNGEN = ['data/prime-zugeordnet.json', 'data/prime-kanal-aussortiert.json']
/** Wie der Zuordner sie schreibt (`writeJson`): die Zuordnungen kompakt, die aussortierten Kanäle eingerückt. */
const EINGERUECKT = new Set(['data/prime-kanal-aussortiert.json'])

const IM_FENSTER = 'julianday(gemeldet_am) BETWEEN julianday(?1) AND julianday(?2)'
const BIS_ENDE = 'julianday(gemeldet_am) <= julianday(?2)'
const DANACH = 'julianday(gemeldet_am) > julianday(?2)'
/** Die Adresse einer Rohfolge in `pruefung` ist die der Rohfolge selbst, wie sie die Seite liefert (`ROH_FELDER`). */
const MELDUNG_URL = "json_extract(rohfolge, '$.url')"
const BERUEHRT = 'IN (SELECT url FROM rettung_adresse)'

type TitelZeile = { url: string; plattform: string; daten: string }
const titelZeilen = (db: DatabaseSync) => db.prepare('SELECT url, plattform, daten FROM titel_zeile').all() as TitelZeile[]
const imFenster = (am: number, fenster: Fenster) => am >= Date.parse(fenster.von) && am <= Date.parse(fenster.bis)

/** Adressen mit einer heute abgehakten Rohfolge im Fenster, aus allen drei Quellen. */
export function beruehrteAdressen(db: DatabaseSync, fenster: Fenster) {
  const urls = new Set<string>()
  const abfragen = [
    `SELECT DISTINCT url FROM prime_folge WHERE uebernommen = 1 AND ${IM_FENSTER}`,
    `SELECT DISTINCT ${MELDUNG_URL} AS url FROM pruefung WHERE roh_uebernommen = 1 AND ${IM_FENSTER}`,
  ]
  for (const sql of abfragen) {
    for (const z of db.prepare(sql).all(fenster.von, fenster.bis)) urls.add(String(z.url))
  }
  for (const z of titelZeilen(db)) {
    if (lies(z.daten).f.some((e) => e[ROHFOLGE_UEBERNOMMEN] === 1 && imFenster(Date.parse(e[AM]), fenster))) urls.add(z.url)
  }
  return urls
}

/**
 * Stellt in der Kopie den Briefkasten am Fensterende nach: je berührter Adresse alle Rohfolgen bis Fensterende wieder
 * offen (auch ältere: der Lauf sah die ganze Adresse und ersetzt ihren Eintrag), später gemeldete und noch offene zu.
 */
export function oeffneFenster(db: DatabaseSync, fenster: Fenster) {
  const adressen = beruehrteAdressen(db, fenster)
  db.exec('CREATE TEMP TABLE rettung_adresse (url TEXT PRIMARY KEY)')
  const merke = db.prepare('INSERT INTO rettung_adresse (url) VALUES (?)')
  for (const url of adressen) merke.run(url)
  const n = (sql: string) => Number(db.prepare(sql).run(fenster.von, fenster.bis).changes)
  const zahl = (sql: string) => Number(db.prepare(sql).get(fenster.von, fenster.bis)!.n)
  const PRIME = `uebernommen = 1 AND url ${BERUEHRT} AND ${BIS_ENDE}`
  const MELDUNG = `roh_uebernommen = 1 AND ${MELDUNG_URL} ${BERUEHRT} AND ${BIS_ENDE}`
  const vorFenster = zahl(`SELECT count(*) AS n FROM prime_folge WHERE ${PRIME} AND NOT ${IM_FENSTER}`) +
    zahl(`SELECT count(*) AS n FROM pruefung WHERE ${MELDUNG} AND NOT ${IM_FENSTER}`)
  const prime = n(`UPDATE prime_folge SET uebernommen = 0 WHERE ${PRIME}`)
  const meldung = n(`UPDATE pruefung SET roh_uebernommen = 0 WHERE ${MELDUNG}`)
  const zu = n(`UPDATE prime_folge SET uebernommen = 1 WHERE uebernommen = 0 AND ${DANACH}`) +
    n(`UPDATE pruefung SET roh_uebernommen = 1 WHERE roh_uebernommen = 0 AND ${DANACH}`)
  const titel = oeffneTitelzeilen(db, fenster, adressen)
  return { adressen: adressen.size, prime, meldung, titel: titel.offen, vorFenster: vorFenster + titel.vorFenster, zu: zu + titel.zu }
}

/** Dasselbe für die Einträge der Titelzeilen: berührte Adresse bis Fensterende auf, alles danach zu. */
function oeffneTitelzeilen(db: DatabaseSync, fenster: Fenster, adressen: Set<string>) {
  const zaehler = { offen: 0, vorFenster: 0, zu: 0 }
  const bis = Date.parse(fenster.bis)
  for (const z of titelZeilen(db)) {
    const daten = lies(z.daten)
    const beruehrt = adressen.has(z.url)
    let geaendert = 0
    daten.f = daten.f.map((e) => {
      const am = Date.parse(e[AM])
      const soll = am > bis ? 1 : beruehrt ? 0 : e[ROHFOLGE_UEBERNOMMEN]
      if (soll === e[ROHFOLGE_UEBERNOMMEN]) return e
      if (soll === 1) zaehler.zu++
      else zaehler.offen++
      if (soll === 0 && !imFenster(am, fenster)) zaehler.vorFenster++
      geaendert++
      const neu = [...e] as typeof e
      neu[ROHFOLGE_UEBERNOMMEN] = soll
      return neu
    })
    if (!geaendert) continue
    db.prepare('UPDATE titel_zeile SET daten = ?3, offen_rohfolge = ?4 WHERE url = ?1 AND plattform = ?2').run(
      z.url, z.plattform, JSON.stringify(daten), zaehleOffene(daten).rohfolge,
    )
  }
  return zaehler
}

/** `fetch` des Zuordners: Seiten aus der Kopie wie `GET /pruefung?rohfolgen=1`, das Abhaken wird nur gezählt. */
export function workerAusKopie(db: DatabaseSync, token: string) {
  const env = { LAUF_TOKEN: token, DB: d1(db, { geschrieben: 0 }) } as never
  const stand = { seiten: 0, geholt: 0, abgehakt: 0 }
  const fetch = async (adresse: string | URL, optionen?: RequestInit) => {
    const url = new URL(String(adresse))
    if (url.pathname !== '/pruefung') throw new Error(`Rettung: unerwarteter Aufruf ${url.pathname}`)
    if (optionen?.method === 'POST') {
      stand.abgehakt += (JSON.parse(String(optionen.body)).rohfolgenUebernommen ?? []).length
      return new Response('{}')
    }
    if (url.searchParams.get('rohfolgen') !== '1' || url.searchParams.get('token') !== token) throw new Error(`Rettung: falsche Anfrage ${url.search}`)
    stand.seiten++
    const { zeilen, weiter } = await offeneRohfolgen(env, Number(url.searchParams.get('nach') ?? 0))
    stand.geholt += zeilen.length
    const titel = await serientitelJeAdresse(env, zeilen.map((z) => z.url as string))
    return Response.json({ folgen: zeilen.map((z) => ({ ...z, serientitel: titel.get(z.url as string) ?? null })), weiter })
  }
  return { fetch, stand }
}

type Sammlung = Record<string, unknown>
const folgenZahl = (v: unknown) => ((v as { folgen?: unknown[] } | undefined)?.folgen ?? []).length

/**
 * Dreiseitig: nimmt aus `gerettet`, was gegenüber `basis` neu ist, außer `heute` hat den Schlüssel seit `basis` schon
 * geändert (oder entfernt). Ein geretteter Eintrag mit weniger Folgen als heute bleibt draußen und wird gemeldet.
 */
export function mische(basis: Sammlung, gerettet: Sammlung, heute: Sammlung) {
  const ergebnis = { ...heute }
  const neu: string[] = []
  const spaeterGeaendert: string[] = []
  const geschrumpft: string[] = []
  for (const [k, v] of Object.entries(gerettet)) {
    if (isDeepStrictEqual(basis[k], v)) continue
    if (!isDeepStrictEqual(heute[k], basis[k])) {
      spaeterGeaendert.push(k)
      continue
    }
    if (folgenZahl(v) < folgenZahl(heute[k])) {
      geschrumpft.push(k)
      continue
    }
    ergebnis[k] = v
    neu.push(k)
  }
  return { ergebnis, neu, spaeterGeaendert, geschrumpft }
}

/** Was der Zuordner liest und schreibt. */
export const KULISSE = ['data', 'public/data']

/** Legt die Pfade (`KULISSE`) des Stands in einen leeren Ordner. */
export function kulisseAusStand(stand: string, ziel: string, pfade = KULISSE) {
  const git = spawnSync('git', ['archive', '--format=tar', stand, ...pfade], { cwd: WURZEL, maxBuffer: 2 ** 31 - 1 })
  if (git.status !== 0) throw new Error(`git archive ${stand}: ${git.stderr}`)
  // Im Zielordner statt `-C <pfad>`: GNU-tar aus Git Bash liest `C:` als entfernten Rechner.
  const tar = spawnSync('tar', ['-x', '-f', '-'], { cwd: ziel, input: git.stdout, maxBuffer: 2 ** 31 - 1 })
  if (tar.status !== 0) throw new Error(`tar: ${tar.stderr}`)
}

const lesen = (datei: string): Sammlung => (existsSync(datei) ? JSON.parse(readFileSync(datei, 'utf8')) : {})

/** Liest „… Adressen zugeordnet (… Folgen)“ aus den Zeilen des Zuordners. */
export function zugeordnetAusLog(zeilen: string[]) {
  const m = zeilen.map((z) => /(\d+) Adressen zugeordnet \((\d+) Folgen\)/.exec(z)).find((t) => t)
  if (!m) throw new Error('Rettung: der Zuordner meldete keine Zuordnung')
  return { adressen: Number(m[1]), folgen: Number(m[2]) }
}

/**
 * Der echte Zuordner im selben Prozess gegen die Kulisse; liefert die Sammlungen vorher und nachher und seine Zahlen.
 * Einmal je Prozess: Seine Bibliotheken merken sich Dateien der ersten Kulisse.
 */
export async function zuordnerLauf(kulisse: string, db: DatabaseSync) {
  const vorher = SAMMLUNGEN.map((d) => lesen(join(kulisse, d)))
  const worker = workerAusKopie(db, 'rettung')
  process.env.AK_ROOT = kulisse
  process.env.LAUF_TOKEN = 'rettung'
  const { ROOT } = await import('../pipeline/lib/util.ts')
  if (resolve(ROOT) !== resolve(kulisse)) throw new Error(`Rettung: der Zuordner schriebe nach ${ROOT}, nicht in die Kulisse`)
  globalThis.fetch = worker.fetch as typeof fetch
  const zeilen: string[] = []
  const echt = console.log
  console.log = (...teile: unknown[]) => {
    zeilen.push(teile.join(' '))
    echt(...teile)
  }
  try {
    await import(pathToFileURL(join(WURZEL, 'pipeline/fetch-rohfolgen.ts')).href)
  } finally {
    console.log = echt
  }
  const stand = { ...worker.stand, ...zugeordnetAusLog(zeilen) }
  return { vorher, nachher: SAMMLUNGEN.map((d) => lesen(join(kulisse, d))), stand }
}

/** Mischt die Ergebnisse in `ziel/` (das Repo) und zählt Adressen und Folgen der Zuordnungen. */
export function uebernimm(ziel: string, lauf: Pick<Awaited<ReturnType<typeof zuordnerLauf>>, 'vorher' | 'nachher'>) {
  return SAMMLUNGEN.map((datei, i) => {
    const heute = lesen(join(ziel, datei))
    const m = mische(lauf.vorher[i]!, lauf.nachher[i]!, heute)
    if (m.neu.length) writeFileSync(join(ziel, datei), JSON.stringify(m.ergebnis, null, EINGERUECKT.has(datei) ? 2 : undefined))
    const { neu, spaeterGeaendert, geschrumpft } = m
    return { datei, vorher: zaehle(heute), nachher: zaehle(m.ergebnis), neu, spaeterGeaendert, geschrumpft }
  })
}

const zaehle = (s: Sammlung) => ({
  adressen: Object.keys(s).length,
  folgen: Object.values(s).reduce<number>((n, v) => n + folgenZahl(v), 0),
})

/** Die Zahlen der Rettung neben denen aus dem Log des Laufs. */
export function bilanz(fenster: Fenster, stand: LogZahlen) {
  return (Object.keys(fenster.log) as (keyof LogZahlen)[]).map((feld) => ({
    feld,
    log: fenster.log[feld],
    rettung: stand[feld],
    abweichung: stand[feld] - fenster.log[feld],
  }))
}

/** Fünf gerettete Schlüssel, gleichmäßig über die Liste verteilt, mit Titel und Folgenzahl. */
function stichproben(neu: string[]) {
  const sammlung = lesen(join(WURZEL, SAMMLUNGEN[0]!)) as Record<string, { titleId: number; folgen?: unknown[] }>
  const titel = new Map((lesen(join(WURZEL, 'public/data/titles.json')) as unknown as { id: number; titleDe: string }[]).map((t) => [t.id, t.titleDe]))
  for (let k = 0; k < Math.min(5, neu.length); k++) {
    const schluessel = neu[Math.floor((k * neu.length) / Math.min(5, neu.length))]!
    const z = sammlung[schluessel]
    if (z) console.log(`  Stichprobe: ${titel.get(z.titleId) ?? z.titleId} · ${schluessel} · ${z.folgen?.length ?? 0} Folgen`)
  }
}

/** Ein Fenster: Kopie öffnen, Zuordner im Stand des Laufs, Ergebnis ins Repo mischen, Bilanz drucken. */
async function rette(fenster: Fenster, quelle: string) {
  const arbeit = mkdtempSync(join(tmpdir(), 'rohfolgen-rettung-'))
  copyFileSync(quelle, join(arbeit, 'kopie.sqlite'))
  const db = new DatabaseSync(join(arbeit, 'kopie.sqlite'))
  try {
    const stand = db.prepare('SELECT stand FROM kopie_stand').get() as { stand: string }
    if (Date.parse(stand.stand) < Date.parse(fenster.bis)) throw new Error(`Kopie von ${stand.stand} ist älter als das Fenster`)
    console.log(`Lauf ${fenster.lauf}, Kopie ${stand.stand}; wieder geöffnet: ${JSON.stringify(oeffneFenster(db, fenster))}`)
    mkdirSync(join(arbeit, 'kulisse'))
    kulisseAusStand(fenster.stand, join(arbeit, 'kulisse'))
    const lauf = await zuordnerLauf(join(arbeit, 'kulisse'), db)
    for (const b of bilanz(fenster, lauf.stand)) console.log(`Bilanz ${b.feld}: Log ${b.log}, Rettung ${b.rettung} (${b.abweichung >= 0 ? '+' : ''}${b.abweichung})`)
    for (const b of uebernimm(WURZEL, lauf)) {
      const zahlen = `neu ${b.neu.length}, später geändert ${b.spaeterGeaendert.length}, geschrumpft (nicht übernommen) ${b.geschrumpft.length}`
      console.log(`${b.datei}: ${JSON.stringify(b.vorher)} → ${JSON.stringify(b.nachher)}, ${zahlen}`)
      stichproben(b.neu)
    }
  } finally {
    db.close()
    rmSync(arbeit, { recursive: true, force: true })
  }
}

/** Ohne `--fenster` jedes Fenster in einem eigenen Prozess, nacheinander: der Zuordner läuft je Prozess nur einmal. */
async function main() {
  const i = process.argv.indexOf('--kopie')
  const quelle = resolve(i > 0 ? process.argv[i + 1]! : join(WURZEL, 'data/cache/meldungskopie/meldungen.sqlite'))
  if (!existsSync(quelle)) throw new Error(`Keine Meldungskopie unter ${quelle}: LAUF_TOKEN=… npm run meldungskopie -- holen`)
  const f = process.argv.indexOf('--fenster')
  if (f > 0) return await rette(FENSTER.find((x) => x.lauf === Number(process.argv[f + 1]))!, quelle)
  for (const fenster of FENSTER) {
    const kind = spawnSync(process.execPath, [...process.execArgv, process.argv[1]!, '--kopie', quelle, '--fenster', String(fenster.lauf)], { stdio: 'inherit' })
    if (kind.status !== 0) throw new Error(`Rettung: Fenster ${fenster.lauf} endete mit ${kind.status}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
