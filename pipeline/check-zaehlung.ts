/**
 * Zusicherungen zur Folgenzählung im Detail-Panel (10.10.2026, „Das Band der Unterwelt“: „27 von 24 Folgen
 * erschienen“, Netflix „3 Fg.“). Läuft in `check:logic`. Erfundene Termine, kein echter Titel.
 */
import type { ReleaseEvent } from '../shared/types.ts'
import { ohneSchonErschienene, zaehleErschienen, zaehleErschienenJeAnbieter } from '../web/src/components/detail/antwort-regeln.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name}`)
  }
}

function termin(platform: string, date: string, episode: number | undefined, extra: Partial<ReleaseEvent> = {}): ReleaseEvent {
  return {
    id: `${platform}-${episode ?? 'abwurf'}@${date}`,
    releaseSlug: `${platform}-${episode == null ? 'abwurf' : 'woche'}`,
    titleId: 1,
    date,
    time: '12:00',
    episode,
    releaseType: episode == null ? 'batch' : 'weekly',
    platform,
    name: 'Testserie',
    ...extra,
  } as ReleaseEvent
}

/** Folgen von bis, je eine pro Woche ab `start` (2020, also lange vorbei). */
function woche(platform: string, von: number, bis: number, start = '2020-01-04'): ReleaseEvent[] {
  const tag = new Date(`${start}T00:00:00Z`)
  return Array.from({ length: bis - von + 1 }, (_, i) => {
    const d = new Date(tag.getTime() + i * 7 * 86_400_000).toISOString().slice(0, 10)
    return termin(platform, d, von + i)
  })
}

const crunchyroll = woche('crunchyroll', 1, 24)
const netflix = [termin('netflix', '2020-01-01', undefined, { episodeCount: 11 }), ...woche('netflix', 12, 15, '2020-03-21')]
const alle = [...crunchyroll, ...netflix]

pruefe('dieselbe Folge bei zwei Anbietern zählt einmal je Anbieter, der Kasten nimmt den weitesten', zaehleErschienenJeAnbieter(alle) === 24)
pruefe('Abwurf Folge 1–11 plus Wochentakt ab 12 ergibt bei einem Anbieter 15', zaehleErschienen(netflix) === 15)
pruefe('ohne Abwurf zählt der Wochentakt allein (4)', zaehleErschienen(woche('netflix', 12, 15)) === 4)
pruefe('eine doppelt geführte Folge (Ersatztermin) zählt einmal', zaehleErschienen([...woche('crunchyroll', 1, 3), termin('crunchyroll', '2020-02-01', 3)]) === 3)
pruefe('ohne Termine null', zaehleErschienenJeAnbieter([]) === 0)

const morgen = '2999-01-01'
const offen = [termin('netflix', morgen, 15), termin('netflix', morgen, 25)]
const rest = ohneSchonErschienene(offen, [...crunchyroll.slice(0, 20), ...offen])
pruefe('„Nächste Folge“: was woanders schon erschienen ist, fällt weg, die übrigen bleiben', rest.length === 1 && rest[0]!.episode === 25)
const sichtung = [termin('tv', morgen, 3, { sichtung: true })]
pruefe('eine TV-Sichtung (unsere Zählung) wird nicht herausgefiltert', ohneSchonErschienene(sichtung, [...crunchyroll, ...sichtung]).length === 1)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : 'Zählung: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
