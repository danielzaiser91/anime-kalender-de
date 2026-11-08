/**
 * Zusicherung zum Handlungs-Hinweis (08.11.2026): „erschienen" heißt gestartet, nicht beendet. Ein laufender Titel
 * (Start vorbei, `jpEnd` künftig oder leer) bekam sonst „Noch nicht erschienen". Aufruf: `npm run check:logic`.
 */
import { plotVon, titelGestartet } from '../web/src/components/detail/plot.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-11-08'
const laufend = { jpStart: '2026-10-05', jpStatus: 'RELEASING', jpYear: 2026 }
const kuenftig = { jpStart: '2027-01-10', jpStatus: 'NOT_YET_RELEASED', jpYear: 2027 }
const beendet = { jpStart: '2025-01-05', jpStatus: 'FINISHED', jpYear: 2025 }

pruefe('laufender Titel (Start vorbei, Ende offen) ist gestartet', titelGestartet(laufend, HEUTE))
pruefe('künftiger Titel ist nicht gestartet', !titelGestartet(kuenftig, HEUTE))
pruefe('beendeter Titel ist gestartet', titelGestartet(beendet, HEUTE))
pruefe('Start am Stichtag zählt als gestartet', titelGestartet({ jpStart: HEUTE }, HEUTE))
pruefe('Start morgen zählt nicht', !titelGestartet({ jpStart: '2026-11-09' }, HEUTE))

const lang = 'Eine ausreichend lange deutsche Handlung des Vorgängers, die als Ersatz für den Platzhalter dient und deshalb übernommen wird.'
const von = { id: 2, name: 'Staffel 1' } as never
const hinweis = (t: Parameters<typeof titelGestartet>[0]) =>
  plotVon({ synopsis: { en: 'Sequel to X.' } as never, anilistId: 7, ersatz: { plot: { de: lang } as never, von }, erschienen: titelGestartet(t, HEUTE) }).plot?.erschienen
pruefe('Ersatz-Handlung eines laufenden Titels trägt erschienen = true', hinweis(laufend) === true, hinweis(laufend))
pruefe('Ersatz-Handlung eines künftigen Titels trägt erschienen = false', hinweis(kuenftig) === false, hinweis(kuenftig))

console.log(`check-plot-erschienen: ${verletzt === 0 ? '7 Fälle grün' : `${verletzt} verletzt`}`)
process.exit(verletzt === 0 ? 0 : 1)
