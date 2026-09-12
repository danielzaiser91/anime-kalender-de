#!/usr/bin/env node
/**
 * **Haben westliche Animationsserien überhaupt einen Termin, den man vorher
 * wissen will?**
 *
 * Das ist die eine Frage, die die Analyse in `docs/analyse-cartoons.md` offen
 * gelassen hat — und die entscheidet, ob die 906 Titel in einem **Kalender**
 * etwas verloren haben oder nur in einer Datenbank.
 *
 * Der Einwand dort lautete: Für eine US-Serie auf Netflix oder Disney+ ist die
 * deutsche Fassung zum Start da, die Frage „ab wann auf Deutsch" beantwortet
 * sich also von selbst. Das stimmt — beantwortet aber nur die halbe Frage.
 * Ein Kalender sagt auch, *wann die nächste Folge kommt*, und das weiß niemand
 * von selbst.
 *
 * Gemessen wird deshalb an einer Zufallsstichprobe, was TMDB je Serie an
 * Terminen führt:
 *
 * - `next_episode_to_air` — der Termin, für den es einen Kalender gibt
 * - `status` — läuft sie noch, ist sie beendet, kommt sie erst
 * - `first_air_date` in der Zukunft — eine Ankündigung wie „Avatar: Die sieben
 *   Häfen"
 *
 * **Warum eine Zufallsstichprobe und nicht die ersten hundert:** Der Bestand
 * ist nach Jahr sortiert. Die ersten hundert wären die neuesten — und
 * natürlich laufen die noch. Das Ergebnis stünde vor der Messung fest.
 *
 * Aufruf: `TMDB_API_KEY=… node tools/cartoon-termine-messen.mjs [--n 100]`
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SCHLUESSEL = process.env.TMDB_API_KEY
if (!SCHLUESSEL) {
  console.error('Kein TMDB_API_KEY.')
  process.exit(1)
}

const N = Number(/--n[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 100)
const heute = new Date().toISOString().slice(0, 10)
const bestand = Object.values(JSON.parse(readFileSync('data/cartoons.json', 'utf8')))

/* Immer dieselbe Stichprobe: Ein fester Startwert macht die Messung wiederholbar. */
let same = 20260912
const zufall = () => ((same = (same * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const gemischt = [...bestand].sort(() => zufall() - 0.5)
const probe = gemischt.slice(0, Math.min(N, gemischt.length))

const zaehler = {
  gesamt: probe.length,
  naechsteFolge: 0,
  laeuftNoch: 0,
  beendet: 0,
  inProduktion: 0,
  startKuenftig: 0,
  mitAnbieterDe: 0,
  ohneAntwort: 0,
}
const beispiele = []

for (const e of probe) {
  const antwort = await fetch(
    `https://api.themoviedb.org/3/tv/${e.tmdbId}?api_key=${SCHLUESSEL}&language=de-DE`,
    { headers: { 'User-Agent': 'anime-kalender.de' } },
  )
  if (!antwort.ok) {
    zaehler.ohneAntwort++
    continue
  }
  const j = await antwort.json()

  if (e.anbieterDe?.length) zaehler.mitAnbieterDe++
  if (j.status === 'Returning Series') zaehler.laeuftNoch++
  else if (j.status === 'Ended' || j.status === 'Canceled') zaehler.beendet++
  else if (j.status === 'In Production' || j.status === 'Planned') zaehler.inProduktion++
  if (j.first_air_date && j.first_air_date > heute) zaehler.startKuenftig++

  const naechste = j.next_episode_to_air?.air_date
  if (naechste) {
    zaehler.naechsteFolge++
    if (beispiele.length < 12) {
      beispiele.push(`${naechste}  ${j.name ?? e.titleEn} — Folge ${j.next_episode_to_air.episode_number ?? '?'}`)
    }
  }
  await new Promise((f) => setTimeout(f, 60))
}

const anteil = (n) => `${n} (${Math.round((n / zaehler.gesamt) * 100)} %)`

const bericht = [
  `# Haben Cartoons einen Termin? — Messung vom ${heute}`,
  '',
  `Stichprobe: ${zaehler.gesamt} zufällige Titel aus ${bestand.length} im Bestand.`,
  'Feste Mischung, damit die Messung wiederholbar ist.',
  '',
  '| | Titel |',
  '|---|---|',
  `| **mit Termin für die nächste Folge** | **${anteil(zaehler.naechsteFolge)}** |`,
  `| Serie läuft noch (\`Returning Series\`) | ${anteil(zaehler.laeuftNoch)} |`,
  `| beendet oder abgesetzt | ${anteil(zaehler.beendet)} |`,
  `| in Produktion oder geplant | ${anteil(zaehler.inProduktion)} |`,
  `| Start liegt in der Zukunft | ${anteil(zaehler.startKuenftig)} |`,
  `| mit Anbieter in Deutschland | ${anteil(zaehler.mitAnbieterDe)} |`,
  `| ohne Antwort von TMDB | ${zaehler.ohneAntwort} |`,
  '',
  '## Die nächsten Folgen aus der Stichprobe',
  '',
  ...(beispiele.length ? beispiele.map((b) => `- ${b}`) : ['- (keine)']),
  '',
].join('\n')

writeFileSync('docs/messung-cartoon-termine.md', bericht + '\n')
console.log(bericht)
