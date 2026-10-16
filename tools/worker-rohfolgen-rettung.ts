/**
 * **Rettung der Rohfolgen-Zuordnungen vom 16.10.2026** aus der Meldungskopie, ohne die echte D1 anzufassen.
 *
 * Lauf `bestand-bauen` 38959396065 hakte um 20:05Z 13.350 Rohfolgen ab (1.029 Adressen, 2.771 Folgen), dann scheiterte
 * „Datensatz bauen“; `data/prime-zugeordnet.json` kam nie ins Repo. Der Worker liefert übernommene Zeilen nie wieder.
 * Hier werden sie in einer Wegwerf-Kopie der Meldungskopie wieder geöffnet, der echte Zuordner (`fetch-rohfolgen.ts`)
 * läuft gegen eine Kulisse mit dem Repo-Stand des Laufs, und sein Ergebnis wird dreiseitig in den heutigen Stand gemischt:
 * Ein Schlüssel, den ein späterer Lauf schon geändert hat, bleibt, wie er ist.
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
/** Zwischen dem Zuordner-Schritt davor (Lauf 38955171839, 19:30:24Z) und dem Lesen im gescheiterten Lauf (20:05:02Z). */
export const FENSTER = { von: '2026-10-16T19:28:00Z', bis: '2026-10-16T20:05:02Z' }
/** Der Stand, den der gescheiterte Lauf ausgecheckt hatte (headSha von 38959396065). */
export const STAND = '3919eda6455edd6413576f71f59180dfe6e8314f'
/** Die Dateien, die der Zuordner über alle Läufe ansammelt. */
export const SAMMLUNGEN = ['data/prime-zugeordnet.json', 'data/prime-kanal-aussortiert.json']

const IM_FENSTER = 'julianday(gemeldet_am) BETWEEN julianday(?1) AND julianday(?2)'
const DANACH = 'julianday(gemeldet_am) > julianday(?2)'

/**
 * Stellt in der Kopie den Briefkasten von 20:05Z nach: im Fenster abgehakte Rohfolgen wieder offen, später gemeldete
 * und noch offene zu (die hat ein späterer Lauf bekommen oder bekommt sie noch).
 */
export function oeffneFenster(db: DatabaseSync, fenster = FENSTER) {
  const n = (sql: string) => Number(db.prepare(sql).run(fenster.von, fenster.bis).changes)
  const zaehler = {
    prime: n(`UPDATE prime_folge SET uebernommen = 0 WHERE uebernommen = 1 AND ${IM_FENSTER}`),
    meldung: n(`UPDATE pruefung SET roh_uebernommen = 0 WHERE roh_uebernommen = 1 AND ${IM_FENSTER}`),
    titel: 0,
    zu: n(`UPDATE prime_folge SET uebernommen = 1 WHERE uebernommen = 0 AND ${DANACH}`) +
      n(`UPDATE pruefung SET roh_uebernommen = 1 WHERE roh_uebernommen = 0 AND ${DANACH}`),
  }
  const von = Date.parse(fenster.von)
  const bis = Date.parse(fenster.bis)
  const zeilen = db.prepare('SELECT url, plattform, daten FROM titel_zeile').all() as { url: string; plattform: string; daten: string }[]
  for (const z of zeilen) {
    const daten = lies(z.daten)
    let geaendert = 0
    daten.f = daten.f.map((e) => {
      const am = Date.parse(e[AM])
      const soll = am > bis ? 1 : am >= von ? 0 : e[ROHFOLGE_UEBERNOMMEN]
      if (soll === e[ROHFOLGE_UEBERNOMMEN]) return e
      if (soll === 0) zaehler.titel++
      else zaehler.zu++
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
  const stand = { seiten: 0, abgehakt: 0 }
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
    const titel = await serientitelJeAdresse(env, zeilen.map((z) => z.url as string))
    return Response.json({ folgen: zeilen.map((z) => ({ ...z, serientitel: titel.get(z.url as string) ?? null })), weiter })
  }
  return { fetch, stand }
}

type Sammlung = Record<string, unknown>

/** Dreiseitig: nimmt aus `gerettet`, was gegenüber `basis` neu ist, außer `heute` hat den Schlüssel seit `basis` schon geändert. */
export function mische(basis: Sammlung, gerettet: Sammlung, heute: Sammlung) {
  const ergebnis = { ...heute }
  const neu: string[] = []
  const spaeterGeaendert: string[] = []
  for (const [k, v] of Object.entries(gerettet)) {
    if (isDeepStrictEqual(basis[k], v)) continue
    if (!isDeepStrictEqual(heute[k], basis[k])) {
      spaeterGeaendert.push(k)
      continue
    }
    ergebnis[k] = v
    neu.push(k)
  }
  return { ergebnis, neu, spaeterGeaendert }
}

/** Legt `data/` und `public/data/` des Stands in einen leeren Ordner. */
export function kulisseAusStand(stand: string, ziel: string) {
  const git = spawnSync('git', ['archive', '--format=tar', stand, 'data', 'public/data'], { cwd: WURZEL, maxBuffer: 2 ** 31 - 1 })
  if (git.status !== 0) throw new Error(`git archive ${stand}: ${git.stderr}`)
  const tar = spawnSync('tar', ['-x', '-C', ziel], { input: git.stdout })
  if (tar.status !== 0) throw new Error(`tar: ${tar.stderr}`)
}

const lesen = (datei: string): Sammlung => (existsSync(datei) ? JSON.parse(readFileSync(datei, 'utf8')) : {})

/** Der echte Zuordner im selben Prozess gegen die Kulisse; liefert die Sammlungen vorher und nachher. */
export async function zuordnerLauf(kulisse: string, db: DatabaseSync) {
  const vorher = SAMMLUNGEN.map((d) => lesen(join(kulisse, d)))
  const worker = workerAusKopie(db, 'rettung')
  process.env.AK_ROOT = kulisse
  process.env.LAUF_TOKEN = 'rettung'
  globalThis.fetch = worker.fetch as typeof fetch
  await import(pathToFileURL(join(WURZEL, 'pipeline/fetch-rohfolgen.ts')).href)
  return { vorher, nachher: SAMMLUNGEN.map((d) => lesen(join(kulisse, d))), stand: worker.stand }
}

/** Mischt die Ergebnisse in `ziel/` (das Repo) und zählt Adressen und Folgen der Zuordnungen. */
export function uebernimm(ziel: string, lauf: Awaited<ReturnType<typeof zuordnerLauf>>) {
  const berichte = SAMMLUNGEN.map((datei, i) => {
    const heute = lesen(join(ziel, datei))
    const m = mische(lauf.vorher[i]!, lauf.nachher[i]!, heute)
    if (m.neu.length) writeFileSync(join(ziel, datei), JSON.stringify(m.ergebnis, null, 2) + '\n')
    return { datei, vorher: zaehle(heute), nachher: zaehle(m.ergebnis), neu: m.neu, spaeterGeaendert: m.spaeterGeaendert }
  })
  return berichte
}

const zaehle = (s: Sammlung) => ({
  adressen: Object.keys(s).length,
  folgen: Object.values(s).reduce<number>((n, v) => n + (((v as { folgen?: unknown[] }).folgen ?? []).length), 0),
})

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

async function main() {
  const i = process.argv.indexOf('--kopie')
  const quelle = resolve(i > 0 ? process.argv[i + 1]! : join(WURZEL, 'data/cache/meldungskopie/meldungen.sqlite'))
  if (!existsSync(quelle)) throw new Error(`Keine Meldungskopie unter ${quelle}: LAUF_TOKEN=… npm run meldungskopie -- holen`)
  const arbeit = mkdtempSync(join(tmpdir(), 'rohfolgen-rettung-'))
  try {
    copyFileSync(quelle, join(arbeit, 'kopie.sqlite'))
    const db = new DatabaseSync(join(arbeit, 'kopie.sqlite'))
    const stand = db.prepare('SELECT stand FROM kopie_stand').get() as { stand: string }
    if (Date.parse(stand.stand) < Date.parse(FENSTER.bis)) throw new Error(`Kopie von ${stand.stand} ist älter als das Fenster`)
    console.log(`Kopie: ${stand.stand}; wieder geöffnet: ${JSON.stringify(oeffneFenster(db))}`)
    mkdirSync(join(arbeit, 'kulisse'))
    kulisseAusStand(STAND, join(arbeit, 'kulisse'))
    const lauf = await zuordnerLauf(join(arbeit, 'kulisse'), db)
    db.close()
    console.log(`Zuordner: ${lauf.stand.seiten} Seiten, ${lauf.stand.abgehakt} Rohfolgen wären abgehakt worden`)
    for (const b of uebernimm(WURZEL, lauf)) {
      console.log(`${b.datei}: ${JSON.stringify(b.vorher)} → ${JSON.stringify(b.nachher)}, neu ${b.neu.length}, später geändert ${b.spaeterGeaendert.length}`)
      stichproben(b.neu)
    }
  } finally {
    rmSync(arbeit, { recursive: true, force: true })
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
