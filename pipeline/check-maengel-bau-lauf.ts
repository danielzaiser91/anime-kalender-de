/**
 * Prozesstest der Bauphase `13-12-maengel.ts` gegen eine Kulisse (`AK_ROOT`): Folgen-, Synopsen-, Termin- und Release-Dateien werden im echten Format gelesen,
 * `data/maengel.json` entsteht, und ein zweiter Lauf schreibt sie aus der Vorfassung fort (`seit` bleibt, behoben, neu).
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const phase = fileURLToPath(new URL('./bau/13-12-maengel.ts', import.meta.url))
const wurzel = mkdtempSync(join(tmpdir(), 'maengel-bau-'))
const schreibe = (pfad: string, inhalt: unknown): void => {
  mkdirSync(join(wurzel, pfad, '..'), { recursive: true })
  writeFileSync(join(wurzel, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
}
const titel = (id: number, ueber: Record<string, unknown> = {}) => ({
  id,
  titleDe: 'T',
  jpYear: 2020,
  coverImage: 'c',
  bannerImage: 'b',
  format: 'TV',
  episodes: 3,
  fsk: 12,
  score: 70,
  studios: ['S'],
  genres: ['G'],
  runtimeMin: 24,
  hasVoices: true,
  dubConfidence: 'high',
  jpEnd: '2020-12-01',
  streams: [{ platform: 'netflix', url: `u${id}`, dub: true }],
  watchLinks: [],
  ...ueber,
})
const lauf = (): number => spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `import(${JSON.stringify(phase)}).then((m) => m.schreibeMaengel())`], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8' }).status ?? -1
const register = () => JSON.parse(readFileSync(join(wurzel, 'data/maengel.json'), 'utf8')) as { zaehler: Record<string, { offen: number; neu: number; behoben: number; rueckfall: number; ausnahme: number }>; zeilen: { t: number; art: string; seit: string; status: string; ereignis?: string }[] }
const schluessel = (r: ReturnType<typeof register>) => r.zeilen.map((z) => `${z.art}:${z.t}:${z.status}`).sort().join(' ')

/*
  Titel 1: ohne Cover, läuft noch mit Termin, vollständige Folgenliste, Release bei ADN ohne ADN-Stream.
  Titel 2: 3 Folgen mit einer leeren, ohne Synopse. Titel 33: Synopse in derselben Gruppe wie Titel 1 (33 % 32).
  Eine fehlende Datei und ein leerer Titel sehen gleich aus, darum steht die vollständige Liste bei Titel 1 und die lückenhafte bei Titel 2.
*/
const titel1 = (ueber: Record<string, unknown> = {}) => titel(1, { jpEnd: undefined, ...ueber })
const kurz = () => titel(33, { episodes: 1 })
schreibe('public/data/titles.json', [titel1({ coverImage: undefined }), titel(2), kurz()])
schreibe('public/data/events.json', [{ titleId: 1, date: '2099-01-01' }])
schreibe('public/data/releases.json', [{ titleId: 1, platform: 'adn', releaseType: 'batch', schedule: { firstEpisodeDate: '2020-01-01', episodeCount: 3 } }])
schreibe('public/data/folgen/1.json', { f: [[1, 'A'], [2, 'B'], [3, 'C']] })
schreibe('public/data/folgen/2.json', { f: [[1, 'A'], [2, ''], [3, 'C']] })
schreibe('public/data/synopses/1.json', { 1: { de: 'Text' }, 33: { de: 'Text' } })
schreibe('data/cover-ohne-bekannt.json', {})
/* Der Import von `luecken-titel.ts` (über `fehlendes`) liest diese Datei schon beim Laden. */
schreibe('data/kino-ankuendigungen.yaml', '[]')

pruefe('Lauf 1 endet mit Exit 0', lauf() === 0)
const r1 = register()
pruefe('Lauf 1: genau die erwarteten Mängel aus den echten Dateiformaten', schluessel(r1) === 'cover:1:offen erschienen-ohne-weg:1:offen folgentitel:2:offen handlung-de:2:offen', schluessel(r1))
pruefe('Lauf 1: Erstlauf kennt kein „neu“', Object.values(r1.zaehler).every((z) => z.neu === 0) && r1.zeilen.every((z) => !z.ereignis), r1)
pruefe('Lauf 1: alle 21 Arten im Zähler', Object.keys(r1.zaehler).length === 21, Object.keys(r1.zaehler))

/* Vorfassung altern lassen, Titel 1 bekommt sein Cover, Titel 3 ist neu ohne Banner. */
const alt = readFileSync(join(wurzel, 'data/maengel.json'), 'utf8').replaceAll(/"seit":"[\d-]+"/g, '"seit":"2026-01-01"')
schreibe('data/maengel.json', alt)
schreibe('public/data/synopses/3.json', { 3: { de: 'Text' } })
schreibe('public/data/titles.json', [titel1(), titel(2), kurz(), titel(3,{ bannerImage: undefined, episodes: 1 })])
pruefe('Lauf 2 endet mit Exit 0', lauf() === 0)
const r2 = register()
pruefe('Lauf 2: Cover behoben, Banner von Titel 3 neu, Rest bleibt', schluessel(r2) === 'banner:3:offen cover:1:behoben erschienen-ohne-weg:1:offen folgentitel:2:offen handlung-de:2:offen', schluessel(r2))
pruefe('Lauf 2: `seit` der offenen Zeile bleibt aus der Vorfassung', r2.zeilen.find((z) => z.art === 'handlung-de')!.seit === '2026-01-01', r2.zeilen)
pruefe('Lauf 2: Zähler neu 1 (banner), behoben 1 (cover)', r2.zaehler.banner!.neu === 1 && r2.zaehler.cover!.behoben === 1, r2.zaehler)
pruefe('Lauf 2: Ereignis nur an der neuen Zeile', r2.zeilen.filter((z) => z.ereignis).map((z) => `${z.art}:${z.t}:${z.ereignis}`).join() === 'banner:3:neu', r2.zeilen)

if (verletzt) {
  console.error(`${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('Mängel-Bauphase: alle Prüfungen bestanden')
