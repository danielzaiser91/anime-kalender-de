/**
 * Test des Bauschritts `bau/13-11-cover-luecken.ts` und von `baueCoverLuecken`: Die Lückenliste folgt dem Datensatz, ein Titel mit Cover verlässt sie im selben Bau.
 * Der Prozesslauf (Wegwerf-Wurzel über `AK_ROOT`) belegt die Verdrahtung samt Schreiben; zwei Läufe hintereinander ergeben dieselbe Datei.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { baueCoverLuecken } from './lib/cover-luecken.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const bild = 'https://cover.anime-kalender.de/anisearch/1.webp'
const eigen = { '5': { grund: 'ohne-adresse' }, '6': { grund: 'nsfw' }, '7': { grund: 'nicht-gefunden' }, '8': { datei: 'anisearch/8.webp' } }
const reihen = { '1': [{ id: 10_000_005 }, { id: 10_000_006, cover: bild }], '2': [{ id: 10_000_009 }, { id: 42 }] }
const datenbank = [{ id: 10_000_005 }, { id: 10_000_006 }, { id: 10_000_007, coverImage: '' }, { id: 10_000_008, coverImage: bild }]
const liste = baueCoverLuecken(reihen, datenbank, eigen)
pruefe('Grund aus cover-eigen, ohne Eintrag dort: aniSearch-only nicht-abgerufen, AniList-Titel ohne-quelle', JSON.stringify(liste) === '{"42":"ohne-quelle","10000005":"ohne-adresse","10000006":"nsfw","10000007":"nicht-gefunden","10000009":"nicht-abgerufen"}', liste)
pruefe('Kennung 10000008 mit Cover in Datenbank, nicht in Reihe: nicht in der Reihe → steht nicht drin', !('10000008' in liste), liste)
pruefe('Kennung mit Cover nur in der Reihe, Datenbank ohne: bleibt Lücke (10000006)', '10000006' in liste, liste)
const grenze = baueCoverLuecken({}, [{ id: 10_000_000 }, { id: 9_999_999 }], { '0': { grund: 'nsfw' } })
pruefe('Grenze: Kennung 10000000 ist aniSearch-only (Grund aus cover-eigen „0“), 9999999 nicht', JSON.stringify(grenze) === '{"9999999":"ohne-quelle","10000000":"nsfw"}', grenze)
pruefe('leere Eingaben: leere Liste', Object.keys(baueCoverLuecken({}, [], {})).length === 0)

const wurzel = mkdtempSync(join(tmpdir(), 'cover-luecken-bau-'))
mkdirSync(join(wurzel, 'public/data'), { recursive: true })
mkdirSync(join(wurzel, 'data'), { recursive: true })
const schreibe = (pfad: string, inhalt: unknown): void => writeFileSync(join(wurzel, pfad), JSON.stringify(inhalt))
schreibe('public/data/franchises.json', { '1': [{ id: 10_000_005 }, { id: 10_000_008, cover: bild }, { id: 10_000_009 }] })
schreibe('public/data/titles.json', [{ id: 10_000_005, streams: [] }, { id: 10_000_008, coverImage: bild, streams: [] }])
schreibe('public/data/ohne-synchro.json', [{ id: 10_000_007 }])
schreibe('data/cover-eigen.json', eigen)
// Alte Liste mit veralteten Einträgen (Kennung 10000008 hat ein Cover, 77 existiert nicht): der Lauf ersetzt sie ganz.
schreibe('data/cover-luecken.json', { '10000005': 'ohne-adresse', '10000008': 'nicht-gefunden', '77': 'x' })
const skript = join(wurzel, 'lauf.ts')
const modul = new URL('./bau/15-abgeleitete.ts', import.meta.url).href
writeFileSync(skript, `import { schreibeAbgeleitete } from '${modul}'\nschreibeAbgeleitete()\n`)
const lauf = () => spawnSync(process.execPath, ['--import', 'tsx', skript], { encoding: 'utf8', windowsHide: true, timeout: 60_000, env: { ...process.env, AK_ROOT: wurzel } })
const eins = lauf()
const dateiNach = (): string => readFileSync(join(wurzel, 'data/cover-luecken.json'), 'utf8')
const erste = dateiNach()
pruefe('Prozess: Exit 0 und Logzeile mit Zahl', eins.status === 0 && eins.stdout.includes('cover-luecken.json: 3 Einträge'), eins)
pruefe('Prozess: nur noch die drei Kennungen ohne Cover (10000009 nur in der Reihe), veraltete weg', JSON.stringify(JSON.parse(erste)) === '{"10000005":"ohne-adresse","10000007":"nicht-gefunden","10000009":"nicht-abgerufen"}', erste)
const zwei = lauf()
pruefe('Prozess: zweiter Lauf ergibt dieselbe Datei', zwei.status === 0 && dateiNach() === erste, zwei)

if (verletzt) {
  console.error(`check-cover-luecken-bau: ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('check-cover-luecken-bau: alle Zusicherungen halten (5 Logik-, 3 Prozessfälle)')
