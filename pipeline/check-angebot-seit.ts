/**
 * Zusicherung: `ergaenzeAngebotSeit` (`pipeline/bau/13-3-angebot-seit.ts`) an einem Mini-Archiv — der Filter für Erfassungsstichtage wirkt schon ohne
 * Neubau (Prüfer-Auflage 13.10.2026). Mutationsprobe: ohne den Filter an `kandidaten` wird `Welle` rot.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-angebot-seit.ts`
 */
import type { MotnDaten } from './lib/motn.ts'
import type { Release, Title } from '../shared/types.ts'
import { ergaenzeAngebotSeit } from './bau/13-3-angebot-seit.ts'
import { STICHTAG_AB } from './bau/angebot-stichtag.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Dienste = Record<string, { seit: string }>
const archiv: Record<string, { imdbId: string; dienste: Dienste }> = {}
const tmdbZuImdb: Record<string, { imdbId: string }> = {}
const tmdbZuTitel: Record<string, { tmdbId: string; kind: string }> = {}
const titel = new Map<number, Title>()

/** Ein Titel (Kennung = Nummer) mit seinen MOTN-Diensten; `streams` führt jeden genannten Anbieter mit belegter Synchro. */
function titelMit(id: number, dienste: Dienste): void {
  archiv[`tt${id}`] = { imdbId: `tt${id}`, dienste }
  tmdbZuImdb[`tv/${id}`] = { imdbId: `tt${id}` }
  tmdbZuTitel[String(id)] = { tmdbId: String(id), kind: 'tv' }
  titel.set(id, { id, titleEn: `T${id}`, format: 'TV', episodes: 12, streams: Object.keys(dienste).map((platform) => ({ platform, url: `https://x.example/${id}`, dub: true })) } as unknown as Title)
}
/** Füllt einen Anbietertag mit `n` weiteren Shows, die nicht zu unseren Titeln gehören (nur das MOTN-Archiv kennt sie). */
function fuelle(anbieter: string, seit: string, n: number, ab: number): void {
  for (let i = 0; i < n; i++) archiv[`fremd-${anbieter}-${seit}-${i + ab}`] = { imdbId: `ttf${anbieter}${seit}${i + ab}`, dienste: { [anbieter]: { seit } } }
}

/* Welle: genau STICHTAG_AB Titel bei Crunchyroll am 31.03.2026 (der Titel selbst ist einer davon). */
titelMit(1, { crunchyroll: { seit: '2026-03-31' } })
fuelle('crunchyroll', '2026-03-31', STICHTAG_AB - 1, 0)
/* Knapp darunter: STICHTAG_AB - 1 Titel bei Netflix am 01.06.2026 — ein echter Tag. */
titelMit(2, { netflix: { seit: '2026-06-01' } })
fuelle('netflix', '2026-06-01', STICHTAG_AB - 2, 0)
/* Welle als frühester Anbieter, ein echter Tag als zweiter: der zweite gewinnt. */
titelMit(3, { crunchyroll: { seit: '2026-03-31' }, netflix: { seit: '2026-07-10' } })
/* Eine Welle vor 2026 (Netflix 05.03.2024, 14 Titel in `data/motn.json`): auch am Titel nicht. */
titelMit(4, { netflix: { seit: '2024-03-05' } })
fuelle('netflix', '2024-03-05', 13, 0)
/* Vor 2026, kein Stichtag: bleibt am Titel, aber kein Termin. */
titelMit(5, { primevideo: { seit: '2025-05-05' } })

const slim = [...titel.values()].map((t) => ({ ...t }))
const releases: Release[] = []
ergaenzeAngebotSeit({
  slim: slim as never,
  releases,
  titles: titel,
  quellen: { motn: { shows: archiv, tmdb: tmdbZuImdb } as unknown as MotnDaten, tmdb: tmdbZuTitel },
})
const slimVon = (id: number) => slim.find((t) => t.id === id) as Title

console.log('\nIm Angebot seit (Mini-Archiv):')
pruefe('Welle: der Titel bekommt weder Termin noch angebotSeit', !releases.some((r) => r.titleId === 1) && !titel.get(1)!.angebotSeit && !slimVon(1).angebotSeit, releases.map((r) => r.slug))
pruefe('ein Tag knapp unter der Schwelle bleibt ein Termin am Titel', releases.some((r) => r.titleId === 2 && r.schedule.firstEpisodeDate === '2026-06-01') && titel.get(2)!.angebotSeit?.date === '2026-06-01')
pruefe('Welle als frühester Anbieter: der nächste Anbieter (Netflix, 10.07.2026) gewinnt', titel.get(3)!.angebotSeit?.platform === 'netflix' && releases.some((r) => r.slug === 'motn-3-netflix'), titel.get(3)!.angebotSeit)
pruefe('Netflix 05.03.2024 (14 Titel): kein angebotSeit', !titel.get(4)!.angebotSeit && !slimVon(4).angebotSeit, titel.get(4)!.angebotSeit)
pruefe('vor 2026 ohne Welle: am Titel, aber kein Termin', titel.get(5)!.angebotSeit?.date === '2025-05-05' && !releases.some((r) => r.titleId === 5))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nIm Angebot seit (Mini-Archiv): alle Zusicherungen erfüllt.')
