/**
 * Zusicherung (Daniel, 14.10.2026, Beerus): Ein OmU-Termin ohne Deutsch-Beleg und ohne Deutsch-Ankündigung erzeugt kein Ereignis.
 * Aufruf: `npm run check:logic`.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'

/* Der Bauschritt schreibt Dateien nach `data/`: Er läuft gegen eine leere Kulisse (`AK_ROOT`), nie gegen das Repo. */
const kulisse = mkdtempSync(join(tmpdir(), 'omu-ohne-termin-'))
mkdirSync(join(kulisse, 'data', 'curated'), { recursive: true })
for (const datei of ['ohne-synchro-von-hand.yaml', 'kino-ankuendigungen.yaml']) writeFileSync(join(kulisse, 'data', datei), '[]\n')
process.env.AK_ROOT = kulisse
const { rolleTermineAus } = await import('./bau/10-termine.ts')
const { ohneOmuTermine } = await import('./bau/omu-ohne-termin.ts')
const { setzeMarkenFuerPruefung } = await import('./lib/anisearch-marke.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

setzeMarkenFuerPruefung({ 900005: 'd', 900006: 'p', 900007: '-' })
const titel = (id: number, extra: Partial<Title> = {}): Title => ({ id, streams: [{ platform: 'netflix' }], ...extra }) as unknown as Title
const titles = new Map<number, Title>([
  [900001, titel(900001)],
  [900002, titel(900002, { streams: [{ platform: 'netflix', dub: true }] as Title['streams'] })],
  [900003, titel(900003, { ankuendigung: { platform: 'netflix', synchro: 'angekuendigt' } as Title['ankuendigung'] })],
  [900004, titel(900004, { ankuendigung: { platform: 'netflix', synchro: 'offen' } as Title['ankuendigung'] })],
  [900005, titel(900005)],
  [900006, titel(900006)],
  [900007, titel(900007)],
  [900008, titel(900008, { deErstausgabe: { synchro: true } } as Partial<Title>)],
])
const ev = (titleId: number, sprache?: 'omu' | 'offen'): ReleaseEvent => ({ titleId, id: `${titleId}@${sprache ?? 'x'}`, ...(sprache ? { sprache } : {}) }) as unknown as ReleaseEvent
const bleibt = (e: ReleaseEvent): boolean => ohneOmuTermine([e], titles).length === 1

console.log('OmU-Termine ohne Deutsch-Beleg:')
pruefe('OmU ohne Beleg und Ankündigung: kein Termin', !bleibt(ev(900001, 'omu')))
pruefe('OmU, Ankündigung nur „offen“ (Beerus): kein Termin', !bleibt(ev(900004, 'omu')))
pruefe('OmU, aniSearch ohne Deutsch (-): kein Termin', !bleibt(ev(900007, 'omu')))
pruefe('Weg mit belegter Synchro: Termin bleibt', bleibt(ev(900002, 'omu')))
pruefe('Synchro angekündigt: Termin bleibt', bleibt(ev(900003, 'omu')))
pruefe('aniSearch vertont: Termin bleibt', bleibt(ev(900005, 'omu')))
pruefe('aniSearch geplant: Termin bleibt', bleibt(ev(900006, 'omu')))
pruefe('Erstausgabe-Marke: Termin bleibt', bleibt(ev(900008, 'omu')))
pruefe('Termin ohne Sprachkennzeichnung bleibt', bleibt(ev(900001)))
pruefe('Sprache „offen“ bleibt', bleibt(ev(900001, 'offen')))
pruefe('Titel unbekannt: Termin bleibt', bleibt(ev(999999, 'omu')))
const gemischt = ohneOmuTermine([ev(900001, 'omu'), ev(900002, 'omu'), ev(900001)], titles).map((e) => e.id)
pruefe('Reihenfolge und Rest bleiben', gemischt.join() === '900002@omu,900001@x', gemischt)

/* Verdrahtung: der echte Bauschritt lässt die OmU-Termine weg, der Titel bleibt im Bestand. */
const release = (titleId: number, slug: string): Release => ({
  slug,
  titleId,
  name: slug,
  platform: 'netflix',
  platformUrl: 'https://www.netflix.com/title/1',
  releaseType: 'weekly',
  sprache: 'omu',
  year: 2026,
  sources: ['https://www.anime2you.de/news/1'],
  schedule: { firstEpisodeDate: '2099-01-02', episodeCount: 2, episodeCountAssumed: true },
}) as unknown as Release
const lauf = rolleTermineAus({
  releases: [release(900001, 'ohne-beleg'), release(900002, 'mit-beleg')],
  titles: new Map([[900001, titles.get(900001)!], [900002, titles.get(900002)!]]),
  jpStart: new Map(),
})
const verbleibend = [...new Set(lauf.events.map((e) => e.titleId))]
pruefe('Bauschritt: nur der Titel mit Beleg behält Termine', verbleibend.join() === '900002', verbleibend)

setzeMarkenFuerPruefung(undefined)
if (verletzt) {
  console.error(`${verletzt} Verletzung(en).`)
  process.exit(1)
}
console.log('OmU-Termine: alle 13 Fälle in Ordnung.')
