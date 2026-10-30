/**
 * Rechnet die Urteile je Titel × Anbieter × Folge (`pipeline/fetch-urteile.ts`) aus der lokalen Meldungskopie
 * (`betrieb.md`, Abschnitt Meldungskopie) statt vom Worker: Die Worker-Seiten `?alle=1` und `?rohfolgen=1&alle=1`
 * beantwortet der echte Worker-Code des Baums (`titelzeile-lesen.ts`, `rohfolgen-seiten.ts`) gegen die SQLite-Datei.
 * Kein Netz, keine D1, kein Token; der Lauf schreibt nur in eine Wegwerf-Wurzel.
 *
 *   node tools/urteile-aus-kopie.mjs [--baum <wurzel>] [--kopie <sqlite>] [--titel 1,2] [--anbieter primevideo]
 *                                    [--vergleich <urteile.json>] [--aus <datei>]
 *
 * `--baum`: Arbeitsbaum mit dem zu belegenden Code (Standard: dieser). `--vergleich`: Urteile der Vergleichsbasis
 * (z. B. der Ausgabe eines Laufs mit dem Baum von main); ausgegeben wird, welche Schlüssel neu, weg oder anders sind.
 * Ohne `--aus` gehen die gefilterten Urteile als JSON auf stdout, die Zusammenfassung auf stderr.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HIER = fileURLToPath(import.meta.url)
const WURZEL = resolve(dirname(HIER), '..')

/** Eingabedateien des Urteilslaufs (Pfadteile einzeln: das sind Lesezugriffe auf die Wurzel des Baums, keine Schreibziele). */
export const EINGABEN = [
  ['data', 'folgen-zuordnung.json'],
  ['data', 'prime-zugeordnet.json'],
  ['data', 'dub-confirmed.yaml'],
  ['data', 'belege-entfernt.yaml'],
  ['public', 'data', 'titles.json'],
  ['public', 'data', 'cartoons.json'],
  ['public', 'data', 'ohne-synchro.json'],
]

const wert = (a, name) => (a.includes(name) ? a[a.indexOf(name) + 1] : undefined)

/** Die Antwort des Workers auf eine Abfrage-Adresse als `{ status, body }` (Form wie `pruefung-lesen.ts` / `pruefung-rohfolgen.ts`). */
export async function antworte(url, env, { allePruefungen, alleRohfolgen }) {
  const nach = Number(url.searchParams.get('nach') ?? 0)
  if (url.searchParams.get('alle') !== '1') return { status: 404, body: '' }
  if (url.searchParams.get('rohfolgen') === '1') {
    const s = await alleRohfolgen(env, nach)
    return { status: 200, body: JSON.stringify({ folgen: s.zeilen, weiter: s.weiter }) }
  }
  const s = await allePruefungen(env, nach)
  return { status: 200, body: JSON.stringify({ pruefungen: s.zeilen, weiter: s.weiter }) }
}

/** Eine D1-Attrappe über `node:sqlite` (nur lesend), die genug von `prepare/bind/all/first/raw` kann. */
export function d1Attrappe(db) {
  const anweisung = (sql, werte = []) => ({
    bind: (...w) => anweisung(sql, w),
    all: async () => ({ results: db.prepare(sql).all(...werte), meta: {} }),
    first: async () => db.prepare(sql).get(...werte) ?? null,
    raw: async () => db.prepare(sql).all(...werte).map((z) => Object.values(z)),
  })
  return { prepare: (sql) => anweisung(sql) }
}

/** Setzt `fetch` so, dass der Urteilslauf seine Seiten aus der Kopie bekommt. Gibt die Zahl der beantworteten Abrufe zurück (Funktion). */
export async function vorladen(baum, kopie) {
  const { DatabaseSync } = await import('node:sqlite')
  const env = { DB: d1Attrappe(new DatabaseSync(kopie, { readOnly: true })) }
  const lade = (datei) => import(pathToFileURL(join(baum, 'worker', 'src', datei)).href)
  const funktionen = { ...(await lade('titelzeile-lesen.ts')), ...(await lade('rohfolgen-seiten.ts')) }
  let abrufe = 0
  globalThis.fetch = async (u) => {
    abrufe++
    const a = await antworte(new URL(String(u)), env, funktionen)
    if (a.status !== 200) console.error(`urteile-aus-kopie: unbekannter Abruf ${u}`)
    return new Response(a.body, { status: a.status })
  }
  process.on('exit', () => console.error(`urteile-aus-kopie: ${abrufe} Seiten aus ${kopie}`))
}

/** Nur die Urteile der genannten Titel und/oder Anbieter; Schlüssel sind `titel|anbieter|folge`. */
export function filtere(urteile, titel, anbieter) {
  const ids = titel ? new Set(titel.split(',')) : null
  return Object.fromEntries(
    Object.entries(urteile).filter(([k]) => {
      const [t, a] = k.split('|')
      return (!ids || ids.has(t)) && (!anbieter || a === anbieter)
    }),
  )
}

/** Unterschied zweier Urteilsstände je Schlüssel: neu, weg, anders (Urteil oder Grund). */
export function vergleiche(alt, neu) {
  const d = { neu: [], weg: [], anders: [] }
  for (const k of Object.keys(neu)) {
    if (!(k in alt)) d.neu.push(k)
    else if (alt[k].urteil !== neu[k].urteil || alt[k].grund !== neu[k].grund) d.anders.push(k)
  }
  for (const k of Object.keys(alt)) if (!(k in neu)) d.weg.push(k)
  return d
}

/** Zählt die Urteile je Wert (`urteil` bzw. `urteil (grund)`). */
export function zaehle(urteile) {
  const z = {}
  for (const u of Object.values(urteile)) {
    const name = u.grund ? `${u.urteil} (${u.grund})` : u.urteil
    z[name] = (z[name] ?? 0) + 1
  }
  return z
}

/** Legt die Wegwerf-Wurzel an und kopiert die Eingaben aus dem Baum hinein; fehlt eine, bricht es mit dem Namen ab. */
export function legeWurzelAn(baum, ziel) {
  for (const teile of EINGABEN) {
    const von = join(baum, ...teile)
    if (!existsSync(von)) throw new Error(`Eingabe fehlt im Baum: ${teile.join('/')}`)
    mkdirSync(dirname(join(ziel, ...teile)), { recursive: true })
    copyFileSync(von, join(ziel, ...teile))
  }
}

/** Fährt `fetch-urteile.ts` des Baums mit dem Vorlader; gibt die Urteile oder wirft mit dem Fehlertext des Laufs. */
export function laufe(baum, kopie, wurzel) {
  const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--import', pathToFileURL(HIER).href, join(baum, 'pipeline', 'fetch-urteile.ts'), '--voll'], {
    cwd: baum,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 28,
    env: { ...process.env, AK_ROOT: wurzel, LAUF_TOKEN: 'kopie', URTEILE_BAUM: baum, URTEILE_KOPIE: kopie },
  })
  if (r.status !== 0) throw new Error(`fetch-urteile endete mit ${r.status}\n${r.stderr}`)
  process.stderr.write(r.stderr)
  return JSON.parse(readFileSync(join(wurzel, 'data', 'urteile.json'), 'utf8'))
}

export function ausgabe(urteile, a, alt) {
  const z = zaehle(urteile)
  console.error(`${Object.keys(urteile).length} Urteile: ${Object.entries(z).map(([k, n]) => `${n} ${k}`).join(', ')}`)
  if (alt) {
    const d = vergleiche(alt, urteile)
    console.error(`gegen Vergleich: ${d.neu.length} neu, ${d.weg.length} weg, ${d.anders.length} anders`)
    for (const [art, ks] of Object.entries(d)) for (const k of ks.slice(0, 20)) console.error(`  ${art}: ${k}`)
  }
  const aus = wert(a, '--aus')
  if (aus) writeFileSync(aus, JSON.stringify(urteile, null, 2))
  else console.log(JSON.stringify(urteile, null, 2))
}

export function main(a) {
  const baum = resolve(wert(a, '--baum') ?? WURZEL)
  const kopie = resolve(wert(a, '--kopie') ?? process.env.MELDUNGSKOPIE ?? join(WURZEL, 'data', 'cache', 'meldungskopie', 'meldungen.sqlite'))
  if (!existsSync(kopie)) throw new Error(`Meldungskopie fehlt: ${kopie} (npm run meldungskopie -- holen)`)
  const wurzel = mkdtempSync(join(tmpdir(), 'urteile-kopie-'))
  try {
    legeWurzelAn(baum, wurzel)
    const alle = laufe(baum, kopie, wurzel)
    const vgl = wert(a, '--vergleich')
    const alt = vgl ? filtere(JSON.parse(readFileSync(vgl, 'utf8')), wert(a, '--titel'), wert(a, '--anbieter')) : null
    ausgabe(filtere(alle, wert(a, '--titel'), wert(a, '--anbieter')), a, alt)
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main(process.argv.slice(2))
else if (process.env.URTEILE_KOPIE) await vorladen(process.env.URTEILE_BAUM, process.env.URTEILE_KOPIE)
