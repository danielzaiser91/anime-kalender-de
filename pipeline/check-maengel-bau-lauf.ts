/**
 * Prozesstest der Bauphase `13-12-maengel.ts` gegen eine Kulisse (`AK_ROOT`, ein Git-Repo): Folgen-, Synopsen-, Termin-, Release- und Handlisten-Dateien werden
 * im echten Format gelesen, `data/maengel.json` entsteht, und die Fortschreibung geht von der **committeten** Vorfassung aus (`git show HEAD:`), nicht von der Datei im Arbeitsverzeichnis.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { todayIso } from '../shared/time.ts'
import { COVER_BEKANNT_DATEI } from './lib/maengel-regeln.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

type Reg = { zaehler: Record<string, { offen: number; neu: number; behoben: number; rueckfall: number; ausnahme: number }>; zeilen: { t: number; art: string; seit: string; status: string; ereignis?: string }[]; hinweis?: string }

const phase = fileURLToPath(new URL('./bau/13-12-maengel.ts', import.meta.url))
const wurzel = mkdtempSync(join(tmpdir(), 'maengel-bau-'))
const schreibe = (pfad: string, inhalt: unknown): void => {
  mkdirSync(join(wurzel, pfad, '..'), { recursive: true })
  writeFileSync(join(wurzel, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
}
const git = (...args: string[]) => spawnSync('git', ['-C', wurzel, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' })
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
const lauf = () => spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `import(${JSON.stringify(pathToFileURL(phase).href)}).then((m) => m.schreibeMaengel())`], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8' })
const register = (): Reg => JSON.parse(readFileSync(join(wurzel, 'data/maengel.json'), 'utf8')) as Reg
const schluessel = (r: Reg) => r.zeilen.map((z) => `${z.art}:${z.t}:${z.status}`).sort().join(' ')
const einfach = (id: number, ueber: Record<string, unknown> = {}) => titel(id, { episodes: 1, ...ueber })
const stream = (url: string) => [{ platform: 'netflix', url, dub: true }]

/*
  Titel 1: ohne Cover, läuft noch mit Termin, vollständige Folgenliste, Release bei ADN ohne ADN-Stream.
  Titel 2: 3 Folgen mit einer leeren, ohne Synopse. Titel 33: Synopse in derselben Gruppe wie Titel 1 (33 % 32).
  Titel 4: deutsche Erstausgabe ohne Stream und Verweis, aber mit Disc-Termin (ein Weg). Titel 5: ohne Cover, auf der Handliste.
  Titel 6 und 7: dieselbe Stream-Adresse. Titel 8: läuft noch, Termin heute (Grenze der Zukunft).
  Eine fehlende Datei und ein leerer Titel sehen gleich aus, darum steht die vollständige Liste bei Titel 1 und die lückenhafte bei Titel 2.
*/
const titel1 = (ueber: Record<string, unknown> = {}) => titel(1, { jpEnd: undefined, ...ueber })
const kurz = () => einfach(33)
const erstausgabe = { von: '2022-01-01', synchro: true }
const weitere = () => [
  einfach(4, { streams: [], deErstausgabe: erstausgabe }),
  einfach(5, { coverImage: undefined }),
  einfach(6, { streams: stream('dup') }),
  einfach(7, { streams: stream('dup') }),
  einfach(8, { jpEnd: undefined }),
  einfach(9),
  einfach(10, { franchiseId: 50, streams: stream('https://www.netflix.com/title/999') }),
  einfach(11, { franchiseId: 50, streams: stream('https://www.netflix.com/title/999') }),
  titel(12, { franchiseId: 60, streams: stream('f12') }),
  titel(13, { franchiseId: 60, streams: stream('f13') }),
  titel(14, { streams: stream('f14') }),
]
schreibe('public/data/titles.json', [titel1({ coverImage: undefined }), titel(2), kurz(), ...weitere()])
schreibe('public/data/events.json', [{ titleId: 1, date: '2099-01-01' }, { titleId: 8, date: todayIso() }])
schreibe('public/data/releases.json', [
  { titleId: 1, platform: 'adn', releaseType: 'batch', sources: [{ url: 'https://q' }], schedule: { firstEpisodeDate: '2020-01-01', episodeCount: 3 } },
  { titleId: 9, platform: 'adn', releaseType: 'batch', sprache: 'omu', sources: [{ url: 'https://q' }], schedule: { firstEpisodeDate: '2020-01-01', episodeCount: 1 } },
  ...[12, 13, 14].map((id) => ({ titleId: id, platform: 'netflix', releaseType: 'batch', sources: [{ url: 'https://q' }], schedule: { firstEpisodeDate: '2020-01-01', episodeCount: 6 } })),
  { titleId: 4, platform: 'disc', releaseType: 'disc', schedule: { firstEpisodeDate: '2022-01-01' } },
])
schreibe('public/data/folgen/1.json', { f: [[1, 'A'], [2, 'B'], [3, 'C']] })
schreibe('public/data/folgen/2.json', { f: [[1, 'A'], [2, ''], [3, 'C']] })
schreibe('public/data/synopses/1.json', { 1: { de: 'Text' }, 33: { de: 'Text' } })
for (const id of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) schreibe(`public/data/synopses/${id}.json`, { [id]: { de: 'Text' } })
for (const id of [12, 13, 14]) schreibe(`public/data/folgen/${id}.json`, { f: [[1, 'A'], [2, 'B'], [3, 'C']] })
/* Titel 12 und 13: ein Franchise, je 6 Folgen beim Anbieter bei 3 Folgen und einer Schwester von 3 → Ausnahme anbieter-franchise (Verdrahtung franchiseTeile); Titel 14 ohne Franchise bleibt offen. */
/* Titel 10 und 11: ein Franchise, eine Netflix-Adresse mit einer Staffel zu einer Folge, zusammen zwei: staffel-zuordnung (Verdrahtung Bau → Regel). */
schreibe('data/anbieter-staffeln.json', { 999: { staffeln: [{ folgen: 1 }], gemeldetAm: '2026-01-01' } })
schreibe(COVER_BEKANNT_DATEI, { 5: 'TMDB führt ihn nicht' })
/* Der Import von `luecken-titel.ts` (über `fehlendes`) liest diese Datei schon beim Laden. */
schreibe('data/kino-ankuendigungen.yaml', '[]')
/* Titel 9: Handbeleg „ohne deutschen Ton“ bei ADN → Ausnahme belegtes-nein; Titel 1 hat keinen und bleibt offen. */
schreibe('data/dub-confirmed.yaml', '- anilistId: 9\n  title: T\n  platform: adn\n  dub: false\n  checkedAt: "2026-01-01"\n  note: Kulisse\n')
git('init', '-q')
git('add', '-A')
git('commit', '-q', '-m', 'kulisse')

const l1 = lauf()
pruefe('Lauf 1 endet mit Exit 0', l1.status === 0, l1.stderr.slice(-300))
const r1 = register()
pruefe('Lauf 1: genau die erwarteten Mängel aus den echten Dateiformaten', schluessel(r1) === 'adresse-mehrfach:6:offen adresse-mehrfach:7:offen cover:1:offen erschienen-ohne-weg:1:offen folgentitel:2:offen folgenzahl-widerspruch:14:offen handlung-de:2:offen staffel-zuordnung:10:offen staffel-zuordnung:11:offen', schluessel(r1))
pruefe('Lauf 1: Handliste: Cover von Titel 5 ist Ausnahme (nur im Zähler)', r1.zaehler.cover!.ausnahme === 1 && !r1.zeilen.some((z) => z.art === 'cover' && z.t === 5), r1.zaehler.cover)
pruefe('Lauf 1: Disc-Termin ist ein Weg (kein kein-weg, kein erstausgabe-ohne-weg bei Titel 4)', !r1.zeilen.some((z) => z.t === 4), r1.zeilen.filter((z) => z.t === 4))
pruefe('Lauf 1: Termin am heutigen Tag zählt als künftig (kein termin-fehlt-laufend bei Titel 8)', !r1.zeilen.some((z) => z.t === 8), r1.zeilen.filter((z) => z.t === 8))
pruefe('Lauf 1: Erstlauf kennt kein „neu“', Object.values(r1.zaehler).every((z) => z.neu === 0) && r1.zeilen.every((z) => !z.ereignis), r1)
pruefe('Lauf 1: erschienen-ohne-weg: Titel 1 offen, Titel 9 (Handbeleg dub:false) Ausnahme', r1.zaehler['erschienen-ohne-weg']?.offen === 1 && r1.zaehler['erschienen-ohne-weg']?.ausnahme === 1, r1.zaehler['erschienen-ohne-weg'])
pruefe('Lauf 1: alle 26 Arten im Zähler', Object.keys(r1.zaehler).length === 26, Object.keys(r1.zaehler))

/* Vorfassung altern lassen und committen; Titel 1 bekommt sein Cover, Titel 3 ist neu ohne Banner. */
schreibe('data/maengel.json', readFileSync(join(wurzel, 'data/maengel.json'), 'utf8').replaceAll(/"seit":"[\d-]+"/g, '"seit":"2026-01-01"'))
git('add', '-A')
git('commit', '-q', '-m', 'vorfassung')
schreibe('public/data/synopses/3.json', { 3: { de: 'Text' } })
schreibe('public/data/titles.json', [titel1(), titel(2), kurz(), einfach(3, { bannerImage: undefined }), ...weitere()])
pruefe('Lauf 2 endet mit Exit 0', lauf().status === 0)
const r2 = register()
pruefe('Lauf 2: Cover behoben, Banner von Titel 3 neu, Rest bleibt', schluessel(r2) === 'adresse-mehrfach:6:offen adresse-mehrfach:7:offen banner:3:offen cover:1:behoben erschienen-ohne-weg:1:offen folgentitel:2:offen folgenzahl-widerspruch:14:offen handlung-de:2:offen staffel-zuordnung:10:offen staffel-zuordnung:11:offen', schluessel(r2))
pruefe('Lauf 2: `seit` der offenen Zeile bleibt aus der Vorfassung', r2.zeilen.find((z) => z.art === 'handlung-de')!.seit === '2026-01-01', r2.zeilen)
pruefe('Lauf 2: Zähler neu 1 (banner), behoben 1 (cover)', r2.zaehler.banner!.neu === 1 && r2.zaehler.cover!.behoben === 1, r2.zaehler)
pruefe('Lauf 2: Ereignis nur an der neuen Zeile', r2.zeilen.filter((z) => z.ereignis).map((z) => `${z.art}:${z.t}:${z.ereignis}`).join() === 'banner:3:neu', r2.zeilen)

/* Neuversuch ohne Commit (commit-data.sh): die Vorfassung bleibt der committete Stand, nicht das Ergebnis von Lauf 2. */
pruefe('Lauf 3 (Neuversuch): gleiches Ergebnis, `ereignis` und neu/behoben bleiben', lauf().status === 0 && JSON.stringify(register()) === JSON.stringify(r2), register().zaehler.banner)

/* Kaputte Vorfassung: kein Abbruch, alles gilt als Bestand, der Hinweis steht im Register und im Log. */
schreibe('data/maengel.json', '{kaputt')
git('add', '-A')
git('commit', '-q', '-m', 'kaputt')
const l4 = lauf()
const r4 = register()
pruefe('Lauf 4 (kaputte Vorfassung): Exit 0, kein Abbruch', l4.status === 0, l4.stderr.slice(-300))
pruefe('Lauf 4: alles Bestand (kein neu, kein Rückfall), Hinweis gesetzt', r4.zeilen.every((z) => !z.ereignis) && Object.values(r4.zaehler).every((z) => z.neu === 0 && z.rueckfall === 0) && /nicht lesbar/.test(r4.hinweis ?? ''), r4.hinweis)
pruefe('Lauf 4: Warnung im Log', /nicht lesbar/.test(l4.stdout + l4.stderr), l4.stdout.slice(-200))
pruefe('Lauf 5: nächster Bau mit lesbarer Vorfassung hat keinen Hinweis mehr', (() => {
  schreibe('data/maengel.json', JSON.stringify(r2))
  git('add', '-A')
  git('commit', '-q', '-m', 'wieder lesbar')
  return lauf().status === 0 && register().hinweis === undefined
})())

if (verletzt) {
  console.error(`${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('Mängel-Bauphase: alle Prüfungen bestanden')
