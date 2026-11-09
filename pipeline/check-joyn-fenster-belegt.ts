/**
 * Wächter: Die Joyn-Fenster belegen die Tage des Joyn-Termins; kein „≈“ vor belegten Folgen.
 *
 * Anlass (09.11.2026, Daniel): Yaiba: Samurai Legend zeigte an der Joyn-Kachel „≈ 18:50“, obwohl `streams[].fenster` in `public/data/titles.json`
 * die Folgen 1–6 mit Tag und 18:50 belegt (05.–12.11.). Der Handtermin hat `wochentage` ohne `observed`, `terminGeschaetzt` führt ihn ab
 * Folge 2 als fortgeschrieben. Fenster (Folge, ab) und Termin-Form wörtlich aus `public/data/titles.json` und `releases.json` (Stand 09.11.2026).
 * Läuft gegen einen Wegwerf-Ordner (`AK_ROOT`). Aufruf: npx tsx pipeline/check-joyn-fenster-belegt.ts
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'joyn-fenster-belegt-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
const { setzeJoynFenster } = await import('./bau/13-1-joyn-fenster.ts')
const { schreibeSynopsenUndReichereAn } = await import('./bau/13-1-anreichern.ts')
const { expandEvents } = await import('../shared/logic.ts')
type Release = import('../shared/types.ts').Release
type Title = import('../shared/types.ts').Title

const titel = (id = 177476) => ({ id, streams: [{ platform: 'joyn', url: 'https://www.joyn.de/serien/yaiba-samurai-legend' }] }) as unknown as Title
const MAXX_TAGE = { 1: '2026-11-05', 2: '2026-11-06', 3: '2026-11-09', 4: '2026-11-10', 5: '2026-11-11', 6: '2026-11-12' }
const maxx = (aus: Partial<Release> = {}, titleId = 177476) =>
  ({
    slug: 'yaiba-samurai-legend-prosieben-maxx',
    titleId,
    platform: 'tv',
    sender: 'ProSieben MAXX',
    folgenBelegt: true,
    schedule: { firstEpisodeDate: '2026-11-05', time: '18:25', episodeCount: 24, wochentage: [1, 2, 3, 4, 5], observed: { ...MAXX_TAGE } },
    ...aus,
  }) as unknown as Release
const joyn = (aus: Partial<Release> = {}, titleId = 177476) =>
  ({
    slug: 'yaiba-samurai-legend-joyn',
    titleId,
    platform: 'joyn',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-11-05', time: '18:50', episodeCount: 24, wochentage: [1, 2, 3, 4, 5] },
    ...aus,
  }) as unknown as Release
const still = (f: () => void) => {
  const alt = console.log
  console.log = () => undefined
  try {
    f()
  } finally {
    console.log = alt
  }
}
const lauf = (releases: Release[], titles = [titel()]) => still(() => setzeJoynFenster(titles, releases))
const tage = (r: Release) => JSON.stringify(r.schedule?.observed)
const geschaetzt = (r: Release, nr: number) => expandEvents(r).find((e) => e.episode === nr)?.estimated === true

/* Der Anlassfall: Yaiba mit der Termin-Form vom 09.11.2026. */
const vorher = joyn()
pruefe('Vorher: Folge 3 des Joyn-Termins ist geschätzt (Anlass, ≈ 18:50)', geschaetzt(vorher, 3) && geschaetzt(vorher, 6))
const anlass = joyn()
lauf([maxx(), anlass])
pruefe('Folge 1–6 des Joyn-Termins tragen die Fenstertage in observed', tage(anlass) === JSON.stringify(MAXX_TAGE), anlass.schedule.observed)
pruefe('Folge 2, 3 und 6 sind nicht mehr geschätzt', [2, 3, 6].every((n) => !geschaetzt(anlass, n)))
pruefe('Folge 7 und 24 (kein Fenster) bleiben geschätzt', geschaetzt(anlass, 7) && geschaetzt(anlass, 24))
pruefe('Folge 3 liegt am 09.11. um 18:50', expandEvents(anlass).find((e) => e.episode === 3)?.date === '2026-11-09' && anlass.schedule.time === '18:50')

/* Verdrahtung: derselbe Weg über den echten Bauschritt. */
const verdrahtet = joyn()
still(() => schreibeSynopsenUndReichereAn({ allTitles: [titel()] as never, releases: [maxx(), verdrahtet], kanalJeAdresse: new Map() }))
pruefe('Der Bauschritt belegt die Tage (Aufruf verdrahtet)', tage(verdrahtet) === JSON.stringify(MAXX_TAGE), verdrahtet.schedule.observed)

/* Gegenproben: nichts wird überschrieben oder fremd belegt. */
const eigene = joyn({ schedule: { ...joyn().schedule, observed: { 3: '2026-11-10' } } })
lauf([maxx(), eigene])
pruefe('Eigene Beobachtung bleibt, die übrigen Folgen kommen dazu', eigene.schedule.observed?.[3] === '2026-11-10' && eigene.schedule.observed?.[4] === '2026-11-10' && eigene.schedule.observed?.[1] === '2026-11-05', eigene.schedule.observed)
const fremder = joyn({}, 21)
lauf([maxx(), fremder])
pruefe('Joyn-Termin eines anderen Titels: nichts belegt', fremder.schedule.observed === undefined, fremder.schedule)
const disc = joyn({ platform: 'disc' as never })
lauf([maxx(), disc])
pruefe('Termin einer anderen Plattform desselben Titels: nichts belegt', disc.schedule.observed === undefined, disc.schedule)
const tot = joyn({ widerlegt: true } as never)
lauf([maxx(), tot])
pruefe('Widerlegter Joyn-Termin bleibt unberührt', tot.schedule.observed === undefined, tot.schedule)
const ohnePlan = joyn()
delete (ohnePlan as { schedule?: unknown }).schedule
lauf([maxx(), ohnePlan])
pruefe('Joyn-Eintrag ohne Plan: kein Absturz, kein Plan erfunden', ohnePlan.schedule === undefined)
const ohneFenster = joyn()
lauf([maxx({ schedule: { firstEpisodeDate: '2026-11-05', time: '18:25', wochentage: [1] } as never }), ohneFenster])
pruefe('Sendetermin ohne Beobachtung: kein Fenster, nichts belegt', ohneFenster.schedule.observed === undefined, ohneFenster.schedule)
const anderer = joyn()
lauf([maxx({ sender: 'TOGGO plus' }), anderer])
pruefe('Anderer Sender liefert keine Fenster und keine Tage', anderer.schedule.observed === undefined, anderer.schedule)

/* Die „davor“-Folgen (Conan-Form): Erste sichere Sichtung Folge 134, Fenster für 115–133 beginnen nur „vor“ dem ersten Tag und belegen keinen Tag. */
const conan = joyn({ schedule: { firstEpisodeDate: '2026-09-20', time: '18:25', episodeCount: 41, wochentage: [1, 2, 3, 4, 5] } })
lauf([maxx({ schedule: { firstEpisodeDate: '2026-09-20', time: '18:00', observed: { 134: '2026-09-20', 135: '2026-09-21' } } as never }), conan])
pruefe('Folgen vor der ersten sicheren Sichtung belegen keinen Tag', tage(conan) === JSON.stringify({ 134: '2026-09-20', 135: '2026-09-21' }), conan.schedule.observed)

if (verletzt) {
  console.error(`check-joyn-fenster-belegt: ${verletzt} von ${faelle} Fällen verletzt`)
  process.exit(1)
}
console.log(`check-joyn-fenster-belegt: ok (${faelle} Fälle: Fenstertage belegen Joyn-Folgen, Anlass Yaiba, Verdrahtung, Gegenproben)`)
