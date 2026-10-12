/**
 * Zusicherungen zur Folgenzählung im Detail-Panel (10.10.2026, „Das Band der Unterwelt“: „27 von 24 Folgen
 * erschienen“, Netflix „3 Fg.“). Läuft in `check:logic`. Erfundene Termine, kein echter Titel.
 */
import { weekdayName } from '../shared/time.ts'
import type { ReleaseEvent } from '../shared/types.ts'
import { nachlegerJeAnbieter, nachlegerText } from '../web/src/components/detail/nachleger.ts'
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

/* Nachleger: Das Band der Unterwelt (Crunchyroll alle 24, Netflix macht mit Folge 16 weiter). */
const tag = weekdayName('2999-10-17', true)
const nfOffen = [termin('netflix', '2999-10-17', 16, { estimated: true, time: undefined }), termin('netflix', '2999-10-24', 17, { time: undefined })]
const nachleger = nachlegerJeAnbieter([...crunchyroll, ...woche('netflix', 12, 15), ...nfOffen], '2026-10-10')
pruefe('ein Anbieter, der hinterherhinkt, bekommt eine Zeile mit seinem nächsten Termin', nachleger.length === 1 && nachleger[0]!.von === 16 && nachleger[0]!.date === '2999-10-17')
pruefe('geschätzter Termin: „≈“ statt „am“, ohne Uhrzeit', nachlegerText(nachleger[0]!) === `Netflix: Folge 16 ≈ ${tag} 17.10.`)
pruefe('belegter Termin mit Uhrzeit', nachlegerText({ platform: 'netflix', von: 16, bis: 16, date: '2999-10-17', time: '08:00', geschaetzt: false }) === `Netflix: Folge 16 am ${tag} 17.10. um 08:00 Uhr`)
pruefe('mehrere Folgen an einem Tag als Spanne', nachlegerText({ platform: 'netflix', von: 1, bis: 4, date: '2999-10-17', geschaetzt: false }) === `Netflix: Folge 1–4 am ${tag} 17.10.`)
pruefe('was nirgends erschienen ist, ist „Nächste Folge“ und keine Nachleger-Zeile', nachlegerJeAnbieter([...crunchyroll.slice(0, 20), termin('netflix', '2999-01-01', 25)], '2026-10-10').length === 0)
pruefe('TV-Termine sind ausgenommen (die TV-Pille nennt sie selbst)', nachlegerJeAnbieter([...crunchyroll, termin('tv', '2999-01-01', 3)], '2026-10-10').length === 0)
const vier = ['netflix', 'prime', 'disney', 'hidive'].map((p, i) => termin(p, `2999-01-0${i + 1}`, 5))
pruefe('höchstens drei Zeilen, die frühesten zuerst', nachlegerJeAnbieter([...crunchyroll, ...vier], '2026-10-10').map((n) => n.platform).join() === 'netflix,prime,disney')
const heuteOhneZeit = termin('netflix', '2999-10-10', 15, { time: undefined })
const morgenOhneZeit = termin('netflix', '2999-10-11', 16, { time: undefined })
pruefe('ein Termin von heute ohne Uhrzeit ist schon da, kein Nachleger', nachlegerJeAnbieter([...crunchyroll, heuteOhneZeit], '2999-10-10').length === 0)
const ab = nachlegerJeAnbieter([...crunchyroll, heuteOhneZeit, morgenOhneZeit], '2999-10-10')
pruefe('ein Termin von morgen ist Nachleger, der von heute davor nicht', ab.length === 1 && ab[0]!.von === 16 && ab[0]!.date === '2999-10-11')

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : 'Zählung: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
