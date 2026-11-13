/**
 * Zusicherungen zu `lib/offene-folgenzahl.ts`: Länge einer laufenden Staffel ohne Folgenzahl — aniSearchs Zahl, sonst zwölf, nie unter den
 * bisher deutschen Folgen; geraten, solange aniSearch sie nicht fest nennt oder die Zahl nicht die von aniSearch ist. `zahlFelder()` lässt
 * Termine mit bekannter Länge unverändert und setzt `episodeCountAssumed` nur, wenn geraten. Läuft in `check:logic`.
 */
import type { CrTermin } from './lib/crunchyroll-termine.ts'
import { offeneFolgenzahl, zahlFelder } from './lib/offene-folgenzahl.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const fall = (bisher: number, info: Parameters<typeof offeneFolgenzahl>[1]) => offeneFolgenzahl(bisher, info)

pruefe('aniSearch fest (Psyren 12)', fall(4, { episodes: 12 }), { episodeCount: 12, episodeCountAssumed: false })
pruefe('aniSearch geschätzt', fall(4, { episodes: 24, episodesEstimated: true }), { episodeCount: 24, episodeCountAssumed: true })
pruefe('ohne aniSearch: zwölf, geraten', fall(4, undefined), { episodeCount: 12, episodeCountAssumed: true })
pruefe('aniSearch ohne Zahl: zwölf', fall(4, {}), { episodeCount: 12, episodeCountAssumed: true })
pruefe('aniSearch 0 zählt wie keine', fall(4, { episodes: 0 }), { episodeCount: 12, episodeCountAssumed: true })
pruefe('bisher über aniSearch: bisher, geraten', fall(14, { episodes: 12 }), { episodeCount: 14, episodeCountAssumed: true })
pruefe('bisher über zwölf ohne aniSearch', fall(13, undefined), { episodeCount: 13, episodeCountAssumed: true })
pruefe('bisher gleich aniSearch: fest', fall(12, { episodes: 12 }), { episodeCount: 12, episodeCountAssumed: false })
pruefe('bisher gleich zwölf ohne aniSearch: geraten', fall(12, undefined), { episodeCount: 12, episodeCountAssumed: true })
pruefe('aniSearch kürzer als zwölf zählt', fall(2, { episodes: 6 }), { episodeCount: 6, episodeCountAssumed: false })
pruefe('bisher 0', fall(0, undefined), { episodeCount: 12, episodeCountAssumed: true })
pruefe('estimated false bleibt fest', fall(3, { episodes: 13, episodesEstimated: false }), { episodeCount: 13, episodeCountAssumed: false })

const termin = (episodeCount: number, zahlOffen?: true) => ({ episodeCount, ...(zahlOffen ? { zahlOffen } : {}) }) as CrTermin
pruefe('zahlFelder: bekannte Länge unverändert', zahlFelder(termin(4), { episodes: 24 }), { episodeCount: 4 })
pruefe('zahlFelder: offen, aniSearch fest', zahlFelder(termin(4, true), { episodes: 12 }), { episodeCount: 12 })
pruefe('zahlFelder: offen, ohne aniSearch', zahlFelder(termin(4, true), undefined), { episodeCount: 12, episodeCountAssumed: true })
pruefe('zahlFelder: offen, bisher über aniSearch', zahlFelder(termin(15, true), { episodes: 12 }), { episodeCount: 15, episodeCountAssumed: true })

if (fehler) {
  console.error(`check-offene-folgenzahl: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-offene-folgenzahl: ok')
