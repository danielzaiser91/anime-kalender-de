/**
 * Die Naht zwischen `berechneAntwort` und `filmAntwort` (`antwort-zweige.ts`): Ein Film ohne kommenden
 * Termin bekommt das echte Heute (für „im Kino“) und die errechnete Gesamtzahl durchgereicht.
 * Ein Kinostart, dessen Spielzeit gestern endete, ist nicht mehr „im Kino“; einer bis morgen schon.
 * Aufruf: npx tsx pipeline/check-antwort-film-naht.ts
 */
import type { Release, Title } from '../shared/types.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-11-13'
const titel = {
  id: 900501,
  slug: 'x900501',
  format: 'MOVIE',
  jpYear: 2025,
  episodes: 1,
  hasVoices: true,
  watchLinks: [],
  titleDe: 'Nahtfilm',
  streams: [{ platform: 'netflix', url: 'https://x/n', dub: true }],
} as unknown as Title
const kino = (cinemaUntil: string): Release =>
  ({
    slug: 'k900501-kino',
    titleId: 900501,
    name: 'Nahtfilm',
    platform: 'kino',
    releaseType: 'movie',
    year: 2026,
    sources: ['https://example.org/kino'],
    cinemaUntil,
    schedule: { firstEpisodeDate: '2026-10-01', episodeCount: 1 },
  }) as unknown as Release

function antwort(rs: Release[]) {
  return berechneAntwort({ title: titel, releases: rs, today: HEUTE, jetzt: new Date(`${HEUTE}T12:00:00+01:00`) }) as
    | { art: string; imKino?: boolean; gesamt?: number; ohneWeg?: boolean }
    | undefined
}

const vorbei = antwort([kino('2026-11-12')])
pruefe('Film ohne kommenden Termin: Antwort „film“', vorbei?.art === 'film', vorbei?.art)
pruefe('Spielzeit endete gestern: nicht mehr im Kino', vorbei?.imKino === false, vorbei?.imKino)
pruefe('die Gesamtzahl des Films wird durchgereicht (1)', vorbei?.gesamt === 1, vorbei?.gesamt)

const laeuft = antwort([kino('2026-11-14')])
pruefe('Spielzeit bis morgen: im Kino', laeuft?.art === 'film' && laeuft.imKino === true, laeuft)
pruefe('im Kino: kein „ohne Weg“', laeuft?.ohneWeg === false, laeuft?.ohneWeg)

if (verletzt) {
  console.error(`\ncheck-antwort-film-naht: ${verletzt} Zusicherung(en) rot.`)
  process.exit(1)
}
console.log('check-antwort-film-naht: alle Zusicherungen erfüllt.')
