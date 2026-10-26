/**
 * Zusicherung (Daniel, 26.10.2026, Dragon Ball Super: Beerus): Ein Titel, dessen Termine alle nur Originalton nennen und der keinen
 * Deutsch-Beleg hat, steht nicht im Hauptbestand: er wandert hinter den Toggle, seine Termine und Ereignisse gehen mit.
 * Läuft in `check:logic` durch den echten Bauschritt `rolleTermineAus` gegen eine Kulisse (`AK_ROOT`), nie gegen das Repo.
 * Das Beerus-Release ist wörtlich das aus `data/curated/streaming-herbst-2026.yaml` (ohne die Notiz).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'nur-omu-'))
mkdirSync(join(kulisse, 'data', 'curated'), { recursive: true })
mkdirSync(join(kulisse, 'public', 'data', 'voices'), { recursive: true })
for (const datei of ['ohne-synchro-von-hand.yaml', 'kino-ankuendigungen.yaml']) writeFileSync(join(kulisse, 'data', datei), '[]\n')
writeFileSync(join(kulisse, 'public', 'data', 'voices', '900006.json'), JSON.stringify({ titleId: 900006, updatedAt: '2099-01-01', roles: [{ character: 'A', actor: 'B' }] }))
process.env.AK_ROOT = kulisse
const { rolleTermineAus } = await import('./bau/10-termine.ts')
const { nurOmuTitel } = await import('./bau/omu-ohne-termin.ts')
const { setzeMarkenFuerPruefung } = await import('./lib/anisearch-marke.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

setzeMarkenFuerPruefung({})
const titel = (id: number, extra: Partial<Title> = {}): Title => ({ id, streams: [], ...extra }) as unknown as Title
const beerus: Partial<Release> = {
  platform: 'netflix',
  platformUrl: 'https://www.netflix.com/title/83189604',
  releaseType: 'weekly',
  sprache: 'omu',
  year: 2026,
  sources: ['https://www.anime2you.de/news/1060009/dragon-ball-super-beerus-simulcast-gestartet/'],
  schedule: { firstEpisodeDate: '2099-01-02', observed: { 1: '2099-01-02', 2: '2099-01-09' }, episodeCount: 12, episodeCountAssumed: true },
}
const release = (titleId: number, slug: string, extra: Partial<Release> = {}): Release => ({ ...beerus, slug, titleId, name: slug, ...extra }) as Release
const welt = (): { titles: Map<number, Title>; releases: Release[] } => ({
  titles: new Map<number, Title>([
    [900001, titel(900001, { ankuendigung: { platform: 'crunchyroll', synchro: 'offen' } as Title['ankuendigung'] })],
    [900002, titel(900002, { streams: [{ platform: 'netflix', dub: true }] as Title['streams'] })],
    [900003, titel(900003)],
    [900004, titel(900004)],
    [900005, titel(900005)],
    [900006, titel(900006)],
    [900007, titel(900007, { ankuendigung: { platform: 'netflix', synchro: 'angekuendigt' } as Title['ankuendigung'] })],
    [900008, titel(900008)],
    [900009, titel(900009)],
    [900010, titel(900010, { deErstausgabe: { synchro: true } } as Partial<Title>)],
    [900011, titel(900011)],
  ]),
  releases: [
    release(900001, 'beerus-netflix'),
    release(900002, 'mit-beleg'),
    release(900003, 'omu-und-de-a'),
    release(900003, 'omu-und-de-b', { sprache: undefined }),
    release(900004, 'omu-und-offen-a'),
    release(900004, 'omu-und-offen-b', { sprache: 'offen' }),
    release(900005, 'omu-widerlegt-a'),
    release(900005, 'omu-widerlegt-b', { sprache: undefined, widerlegt: { am: '2099-01-01', grund: 'g', gemeldet: true } }),
    release(900006, 'mit-sprechern'),
    release(900007, 'angekuendigt'),
    release(900008, 'kino-omu', { platform: 'kino', releaseType: 'movie' }),
    release(900010, 'erstausgabe'),
    release(900011, 'zwei-wege-a'),
    release(900011, 'zwei-wege-b', { platform: 'disneyplus' }),
  ],
})

const w = welt()
const vorher = w.releases.slice()
const lauf = rolleTermineAus({ releases: w.releases, titles: w.titles, jpStart: new Map() })
const weg = [900001, 900005, 900008, 900011]
const bleibt = [900002, 900003, 900004, 900006, 900007, 900009, 900010]
const slugs = w.releases.map((r) => r.slug)
console.log('Nur-OmU-Titel im Hauptbestand:')
pruefe('Beerus (omu, Ankündigung „offen“): nicht mehr im Hauptbestand', !w.titles.has(900001), [...w.titles.keys()])
pruefe('Beerus: hinter dem Toggle aufbewahrt', lauf.verschoben.some((t) => t.id === 900001))
pruefe('Beerus: Release und Ereignisse weg', !slugs.includes('beerus-netflix') && !lauf.events.some((e) => e.titleId === 900001), slugs)
pruefe('Widerlegter deutscher Termin zählt nicht: Titel wandert', !w.titles.has(900005) && !slugs.includes('omu-widerlegt-a') && !slugs.includes('omu-widerlegt-b'))
pruefe('Kino nur OmU: wandert', !w.titles.has(900008) && !slugs.includes('kino-omu'))
pruefe('Zwei Wege, beide OmU: beide Releases weg', !w.titles.has(900011) && !slugs.includes('zwei-wege-a') && !slugs.includes('zwei-wege-b'))
pruefe('genau diese vier wandern, sonst keiner', weg.every((id) => !w.titles.has(id)) && bleibt.every((id) => w.titles.has(id)) && lauf.verschoben.map((t) => t.id).sort().join() === weg.join(), lauf.verschoben.map((t) => t.id))
pruefe('Belegte Synchro bleibt mit Release', w.titles.has(900002) && slugs.includes('mit-beleg'))
pruefe('Ein Termin ohne Sprachkennzeichnung hält den Titel', w.titles.has(900003) && slugs.includes('omu-und-de-a') && slugs.includes('omu-und-de-b'))
pruefe('Sprache „offen“ (unklar) hält den Titel', w.titles.has(900004) && slugs.includes('omu-und-offen-a') && slugs.includes('omu-und-offen-b'))
pruefe('Deutsche Sprechrollen halten den Titel', w.titles.has(900006) && slugs.includes('mit-sprechern'))
pruefe('Synchro angekündigt hält den Titel', w.titles.has(900007) && slugs.includes('angekuendigt'))
pruefe('Erstausgabe-Marke hält den Titel', w.titles.has(900010) && slugs.includes('erstausgabe'))
pruefe('Titel ohne Release bleibt (unverändertes Verhalten)', w.titles.has(900009))
pruefe('Alle übrigen Releases bleiben in Reihenfolge und als dieselben Objekte', JSON.stringify(slugs) === JSON.stringify(vorher.filter((r) => !weg.includes(r.titleId)).map((r) => r.slug)) && w.releases.every((r) => vorher.includes(r)), slugs)
pruefe('Ereignisse der bleibenden Titel mit Beleg bleiben', lauf.events.some((e) => e.titleId === 900002) && lauf.events.some((e) => e.titleId === 900007))

console.log('nurOmuTitel direkt:')
const direkt = nurOmuTitel(welt().titles, welt().releases)
pruefe('Menge der Nur-OmU-Titel (Sprechrollen prüft erst der Aufrufer: 900006 ist dabei)', [...direkt].sort().join() === [...weg, 900006].sort().join(), [...direkt])
pruefe('Titel nicht in der Karte: nicht dabei', !nurOmuTitel(new Map(), welt().releases).has(900001))
pruefe('Ohne Releases: leer', nurOmuTitel(welt().titles, []).size === 0)
pruefe('Nur ein einziger OmU-Termin (genau 1): zählt', nurOmuTitel(welt().titles, [release(900001, 'x')]).has(900001))

/* Der Bestandswächter als eigener Prozess gegen eine Kulisse (Exit-Code, Verstoßzeile, Titelmarke). */
function waechter(titles: object[], releases: object[], voices: Record<string, object> = {}): { code: number | null; aus: string } {
  const ordner = mkdtempSync(join(tmpdir(), 'nur-omu-bestand-'))
  mkdirSync(join(ordner, 'public', 'data', 'voices'), { recursive: true })
  mkdirSync(join(ordner, 'data'), { recursive: true })
  writeFileSync(join(ordner, 'data', 'anisearch-ids-hand.yaml'), '{}')
  writeFileSync(join(ordner, 'public', 'data', 'titles.json'), JSON.stringify(titles))
  writeFileSync(join(ordner, 'public', 'data', 'releases.json'), JSON.stringify(releases))
  for (const [id, inhalt] of Object.entries(voices)) writeFileSync(join(ordner, 'public', 'data', 'voices', `${id}.json`), JSON.stringify(inhalt))
  const skript = join(process.cwd(), 'pipeline', 'check-nur-omu-bestand.ts')
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript], { cwd: process.cwd(), env: { ...process.env, AK_ROOT: ordner }, encoding: 'utf8', windowsHide: true })
  return { code: r.status, aus: `${r.stdout}${r.stderr}` }
}
const bestandTitel = (id: number, extra: object = {}): object => ({ id, slug: `t-${id}`, streams: [], ...extra })
const rot = waechter([bestandTitel(900001)], [release(900001, 'beerus-netflix')])
pruefe('Bestandswächter: Nur-OmU-Titel im Hauptbestand ist rot (Exit 1, Zeile, Marke)', rot.code === 1 && rot.aus.includes('VERSTÖSSE: 1') && rot.aus.includes('"titleId":900001'), rot)
const gruen = waechter([bestandTitel(900001, { streams: [{ platform: 'netflix', dub: true }] })], [release(900001, 'mit-beleg')])
pruefe('Bestandswächter: Titel mit Synchro-Beleg ist grün', gruen.code === 0 && gruen.aus.includes('VERSTÖSSE: 0'), gruen)
const mitDe = waechter([bestandTitel(900001)], [release(900001, 'a'), release(900001, 'b', { sprache: undefined })])
pruefe('Bestandswächter: ein Termin ohne Sprachkennzeichnung hält den Titel', mitDe.code === 0 && mitDe.aus.includes('VERSTÖSSE: 0'), mitDe)
const sprecher = waechter([bestandTitel(900001)], [release(900001, 'a')], { 900001: { titleId: 900001, roles: [{ actor: 'X' }] } })
pruefe('Bestandswächter: deutsche Sprechrollen halten den Titel', sprecher.code === 0 && sprecher.aus.includes('VERSTÖSSE: 0'), sprecher)
const leereRollen = waechter([bestandTitel(900001)], [release(900001, 'a')], { 900001: { titleId: 900001, roles: [] } })
pruefe('Bestandswächter: leere Rollenliste hält den Titel nicht', leereRollen.code === 1 && leereRollen.aus.includes('VERSTÖSSE: 1'), leereRollen)
const ohneRollenFeld = waechter([bestandTitel(900001)], [release(900001, 'a')], { 900001: { titleId: 900001 } })
pruefe('Bestandswächter: Datei ohne Rollenfeld hält den Titel nicht', ohneRollenFeld.code === 1 && ohneRollenFeld.aus.includes('VERSTÖSSE: 1'), ohneRollenFeld)
const leer = waechter([], [])
pruefe('Bestandswächter: leerer Bestand ist grün', leer.code === 0 && leer.aus.includes('VERSTÖSSE: 0'), leer)

setzeMarkenFuerPruefung(undefined)
if (verletzt) {
  console.error(`${verletzt} Verletzung(en).`)
  process.exit(1)
}
console.log('Nur-OmU-Titel: alle Fälle in Ordnung.')
