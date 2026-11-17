/**
 * Zusicherungen zu `bau/nein-sprache-offen.ts` (17.11.2026): Ein automatischer Termin, den ein Handbeleg-Nein verneint, trägt `sprache: 'offen'`;
 * Handtermine, gekennzeichnete, Kino/TV/Disc und Titel mit deutschem Weg an der Plattform bleiben unberührt.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pruefeSynchroJePlattform } from './bau/09-synchro.ts'
import { kennzeichneNeinTermineAlsOffen } from './bau/nein-sprache-offen.ts'
import type { Release, Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, streams: Title['streams'] = []): Title => ({ id, streams }) as unknown as Title
const termin = (extra: Partial<Release> = {}): Release =>
  ({ slug: 's', name: 'Probe', titleId: 7, platform: 'primevideo', automatisch: true, schedule: { firstEpisodeDate: '2026-10-15' }, sources: ['https://a/'], ...extra }) as unknown as Release
const verneint = (id: number, plattform: string, ab: string) => id === 7 && plattform === 'primevideo' && ab === '2026-10-15'
const lauf = (r: Release, titles: Title[] = [titel(7)], nein = verneint) => kennzeichneNeinTermineAlsOffen([r], new Map(titles.map((t) => [t.id, t])), nein)

console.log('\nNein gilt:')
{
  const r = termin()
  pruefe('automatischer Termin wird „offen“', lauf(r).join() === 's' && r.sprache === 'offen', r.sprache)
  const anderesDatum = termin({ schedule: { firstEpisodeDate: '2026-10-16' } as Release['schedule'] })
  pruefe('anderer Starttag: das Nein gilt dort nicht (Datum wird übergeben)', lauf(anderesDatum).length === 0 && anderesDatum.sprache === undefined)
  const anderePlattform = termin({ platform: 'netflix' })
  pruefe('andere Plattform bleibt', lauf(anderePlattform).length === 0 && anderePlattform.sprache === undefined)
  const anderer = termin({ titleId: 8 })
  pruefe('anderer Titel bleibt', lauf(anderer, [titel(8)]).length === 0)
}

console.log('\nAusnahmen:')
{
  const hand = termin({ automatisch: false })
  pruefe('Handtermin bleibt', lauf(hand).length === 0 && hand.sprache === undefined)
  const omu = termin({ sprache: 'omu' })
  pruefe('eigene Kennzeichnung (omu) bleibt', lauf(omu).length === 0 && omu.sprache === 'omu')
  for (const art of ['disc', 'kino', 'tv']) {
    const r = termin({ platform: art as Release['platform'] })
    pruefe(`${art} ist kein Streaming-Termin`, kennzeichneNeinTermineAlsOffen([r], new Map(), () => true).length === 0 && r.sprache === undefined)
  }
  const disc = termin({ releaseType: 'disc' })
  pruefe('Disc-Art bleibt', lauf(disc).length === 0)
  const ja = termin()
  lauf(ja, [titel(7, [{ platform: 'primevideo', url: 'https://x/', dub: true }])])
  pruefe('Weg mit dub: true an der Plattform bleibt', ja.sprache === undefined)
  const abgeleitet = termin()
  lauf(abgeleitet, [titel(7, [{ platform: 'primevideo', url: 'https://x/', dub: true, dubAbgeleitet: 'kanal-erbt' }])])
  pruefe('nur abgeleitetes Ja (dubAbgeleitet) hebt das Nein nicht auf: Termin wird „offen“', abgeleitet.sprache === 'offen', abgeleitet.sprache)
  const ohneJa = termin()
  lauf(ohneJa, [titel(7, [{ platform: 'netflix', url: 'https://x/', dub: true }])])
  pruefe('deutscher Weg bei einer anderen Plattform ändert nichts', ohneJa.sprache === 'offen')
}

console.log('\nVerdrahtung in Bauphase 9 (echter Auslöser: Trinity Seven, Aniverse, Handbeleg-Nein vom 14.09.2026):')
{
  const echt = termin({ slug: 'auto-103631-primevideo', titleId: 103631 })
  const schreibWurzel = mkdtempSync(join(tmpdir(), 'nein-sprache-offen-'))
  try {
    pruefeSynchroJePlattform({
      releases: [echt],
      titles: new Map(),
      crBySeriesId: new Map(),
      tmdbMehrdeutig: new Set(),
      tmdbTitles: {},
      tvJeTmdb: new Set(),
      toteAdressen: new Set(),
      netflixOhneKennung: 0,
      anisearch: {},
      verweiseEntfernt: [],
      katalogEintraege: [],
      adnKatalog: { scrapedAt: '', shows: [] } as never,
      adnVerweiseErgaenzt: 0,
      vorherTitles: [],
      schreibWurzel,
    })
  } finally {
    rmSync(schreibWurzel, { recursive: true, force: true })
  }
  pruefe('Phase 9 kennzeichnet den echten Termin', echt.sprache === 'offen', echt.sprache)
}

if (verletzt) {
  console.error(`\n${verletzt} Fehler`)
  process.exit(1)
}
console.log('\nNein-Termine als „Synchro offen“: 14 Fälle, 0 Fehler')
