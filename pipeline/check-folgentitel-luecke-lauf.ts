/**
 * Der echte Lauf von `check-folgentitel-sprache-bestand.ts` (Tor `check:bestand`) ruft die Lückenprüfung auf: gegen eine Kulisse mit 1.000 Folgenlisten,
 * auf der Arbeitsverzeichnis-Wurzel wie im Bau. Fängt, wenn der Aufruf `pruefeLuecken` fehlt (dann bliebe die fehlende Liste ohne Folge)
 * oder die Warnzeilen nicht ausgegeben werden. Aufruf: `npm run check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kulisse = mkdtempSync(join(tmpdir(), 'folgentitel-luecke-lauf-'))
const schreibe = (pfad: string[], inhalt: unknown): void => {
  mkdirSync(join(kulisse, ...pfad.slice(0, -1)), { recursive: true })
  writeFileSync(join(kulisse, ...pfad), JSON.stringify(inhalt))
}
const titel21 = Array.from({ length: 21 }, (_, i) => [i + 1, `Titel ${i + 1}`])
for (let id = 1; id <= 1000; id++) schreibe(['public', 'data', 'folgen', `${id}.json`], { f: titel21, de: [[1, 21]] })
for (const name of ['anisearch-folgen', 'kitsu-folgen', 'tmdb-folgen', 'anisearch']) schreibe(['data', `${name}.json`], {})
schreibe(['data', 'rtlplus-folgen.json'], { titel: {} })
schreibe(['public', 'data', 'titles.json'], [])

function lauf(): { status: number | null; aus: string; fehler: string } {
  const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline', 'check-folgentitel-sprache-bestand.ts')], { cwd: kulisse, encoding: 'utf8', timeout: 120_000, windowsHide: true })
  return { status: r.status, aus: r.stdout, fehler: r.stderr }
}

try {
  console.log('\nTor check:bestand ruft die Lückenprüfung')
  const ohneListe = lauf()
  pruefe('ohne Lückenliste: Exit 1 und „Lückenliste … fehlt" (Prozess lief bis zum Ende, Schlusszeile da)', ohneListe.status === 1 && ohneListe.fehler.includes('Lückenliste folgentitel-offen.json fehlt') && ohneListe.aus.includes('check-folgentitel-sprache-bestand:'), [ohneListe.status, ohneListe.fehler.slice(0, 300)])
  schreibe(['data', 'folgentitel-offen.json'], {})
  const sauber = lauf()
  pruefe('mit leerer Liste und ohne Lücken: Exit 0 und ✓-Zeile', sauber.status === 0 && sauber.aus.includes('✓ Folgentitel: 0 Folgen ohne deutschen Titel in 0 Titeln'), [sauber.status, sauber.aus.slice(-300), sauber.fehler.slice(0, 200)])
  schreibe(['public', 'data', 'folgen', '7.json'], { f: [[1, 'Eins'], ...Array.from({ length: 20 }, (_, i) => [i + 2, i === 4 ? '' : `Titel ${i + 2}`])], de: [[1, 21]] })
  const mitLuecke = lauf()
  pruefe('eine Lücke, nicht gelistet: Exit 0 und eine Warnzeile mit der Kennung 7', mitLuecke.status === 0 && mitLuecke.aus.includes('⚠ WARNUNG Folgentitel: 1 Titel mit mehr Lücken') && mitLuecke.aus.includes(': 7'), [mitLuecke.status, mitLuecke.aus.slice(-400)])
  schreibe(['data', 'folgentitel-offen.json'], { '7': { offen: 1, grund: 'Kulisse' } })
  const gelistet = lauf()
  pruefe('dieselbe Lücke gelistet: keine Warnzeile, ✓ mit einer Folge', gelistet.status === 0 && !gelistet.aus.includes('WARNUNG Folgentitel:') && gelistet.aus.includes('✓ Folgentitel: 1 Folgen ohne deutschen Titel in 1 Titeln'), [gelistet.status, gelistet.aus.slice(-300)])
  /* Lehnwort (Beyblade X 83 „Partner“): aniSearch führt es nur englisch, RTL+ deutsch — ohne RTL+-Beleg Fehler, mit Beleg keiner. */
  schreibe(['public', 'data', 'folgen', '8.json'], { f: [[1, 'Eins'], ...Array.from({ length: 20 }, (_, i) => [i + 2, i === 2 ? 'Partner' : `Titel ${i + 2}`])], de: [[1, 21]] })
  schreibe(['data', 'anisearch.json'], { '8': { anisearchId: 80 } })
  schreibe(['data', 'anisearch-folgen.json'], { '80': { folgen: [{ nr: 4, en: 'Partner' }] } })
  const lehnOhne = lauf()
  pruefe('Lehnwort ohne RTL+-Beleg: Exit 1 und „englischer oder japanischer Quelle“ für 8', lehnOhne.status === 1 && lehnOhne.fehler.includes('8: 1 Folgentitel aus englischer oder japanischer Quelle'), [lehnOhne.status, lehnOhne.fehler.slice(0, 300)])
  schreibe(['data', 'rtlplus-folgen.json'], { titel: { '8': { folgen: [{ nr: 4, dt: 'Partner' }] } } })
  const lehnMit = lauf()
  pruefe('Lehnwort mit RTL+-Titel auf derselben Nummer: Exit 0, kein Fremdtitel-Fehler', lehnMit.status === 0 && !lehnMit.fehler.includes('englischer oder japanischer Quelle') && lehnMit.aus.includes('check-folgentitel-sprache-bestand: ok'), [lehnMit.status, lehnMit.fehler.slice(0, 300), lehnMit.aus.slice(-200)])

  /* Quote der Folgentitel aus der TMDB-Containerstaffel: Tor ruft `pruefeStaffelQuote`, Warnung statt Fehler. */
  console.log('\nTor check:bestand ruft die Staffel-Quote')
  const staffel = (n: number, weg: number[]) => Array.from({ length: 25 }, (_, i) => ({ s: n, e: i + 1, titel: weg.includes(i + 1) ? `En ${i + 1}` : `S${n}E${i + 1}`, en: `En ${i + 1}`, datum: null }))
  const quote = (weg: number[]) => schreibe(['data', 'tmdb-folgen.json'], { 900001: { nameDe: 'Kulisse - Serie', folgen: [...staffel(1, []), ...staffel(2, weg)] } })
  const quoteTitel = { id: 900012, franchiseId: 900001, format: 'TV', episodes: 25, titleDe: 'Kulisse: Serie Staffel 2', streams: [] }
  schreibe(['public', 'data', 'folgen', '900012.json'], { f: Array.from({ length: 25 }, (_, i) => [i + 1, i < 15 ? '' : `S2E${i + 1}`]), de: [[1, 25]] })
  schreibe(['data', 'folgentitel-offen.json'], { '900012': { offen: 15, grund: 'Kulisse' } })
  quote(Array.from({ length: 15 }, (_, i) => i + 1))
  rmSync(join(kulisse, 'public', 'data', 'titles.json'))
  const ohneTitles = lauf()
  pruefe('ohne titles.json: Exit 1 und „titles.json fehlt“ (Schlusszeile da)', ohneTitles.status === 1 && ohneTitles.fehler.includes('titles.json fehlt') && ohneTitles.aus.includes('check-folgentitel-sprache-bestand:'), [ohneTitles.status, ohneTitles.fehler.slice(0, 300)])
  schreibe(['public', 'data', 'titles.json'], [quoteTitel])
  const knapp = lauf()
  pruefe('10 von 25 Titeln aus der Containerstaffel: Exit 0 und Warnzeile für 900012', knapp.status === 0 && knapp.aus.includes('⚠ WARNUNG Folgentitel TMDB-Staffel: 900012') && knapp.aus.includes('10 von 25 Folgen mit Titel, unter der Hälfte') && knapp.aus.split('von 25 Folgen').length === 2, [knapp.status, knapp.aus.slice(-500)])
  schreibe(['public', 'data', 'folgen', '900012.json'], { f: Array.from({ length: 25 }, (_, i) => [i + 1, `S2E${i + 1}`]), de: [[1, 25]] })
  quote([])
  const voll = lauf()
  pruefe('alle 25 Titel: Exit 0, ✓-Zeile und keine Staffel-Warnung', voll.status === 0 && voll.aus.includes('✓ Folgentitel TMDB-Staffel: 900012') && !voll.aus.includes('WARNUNG Folgentitel TMDB-Staffel'), [voll.status, voll.aus.slice(-500)])
  /* Pflichtprobe „Lader leer“: ohne Zuordnung misst die Prüfung nichts und sagt es sichtbar (Exit bleibt 0). */
  schreibe(['data', 'tmdb-folgen.json'], {})
  const leer = lauf()
  pruefe('leere tmdb-folgen.json: Exit 0 und sichtbare Zeile „0 Titel, die Prüfung misst nichts“', leer.status === 0 && leer.aus.includes('⚠ WARNUNG Folgentitel TMDB-Staffel: 0 Titel, die Prüfung misst nichts'), [leer.status, leer.aus.slice(-400)])
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

console.log(`\ncheck-folgentitel-luecke-lauf: ${verletzt ? `${verletzt} Fehler` : 'ok'} (${faelle} Fälle)`)
process.exit(verletzt ? 1 : 0)
