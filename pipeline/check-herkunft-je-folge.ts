/**
 * Zusicherung: **die Herkunft je Folge bleibt beim Zusammenführen der Bereiche erhalten** (12.10.2026,
 * Tank Chair bei Prime: belegt Folge 1, Folge 2 nur fortgeschrieben, die Pille zeigte „Fg. 1–2“ ohne „≈“).
 * `titelMitTerminBereichen` führt belegte Bereiche und Wochenplan zusammen und vermerkt die ergänzten Folgen am Weg
 * (`ergaenzteFolgen`); die Pille kennzeichnet sie mit „≈“, wenn ihr Termin fortgeschrieben ist. Läuft in `check:logic`.
 * Erfundene Titel, Termine in der Vergangenheit.
 */
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { folgenAuskunft } from '../web/src/components/detail/folgen-angabe.ts'
import { planGeschaetzt, type WegMitHerkunft } from '../web/src/components/detail/folgen-spanne.ts'
import { titelMitTerminBereichen } from '../web/src/components/detail/stream-bereiche.ts'
import { expandEvents } from '../shared/logic.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const t = ((k: string, p?: Record<string, unknown>) => (p ? `${k}${JSON.stringify(p)}` : k)) as never
const HEUTE = '2026-10-11'
const wochenfolge = (n: number): string => new Date(Date.UTC(2020, 0, 3 + 7 * (n - 1))).toISOString().slice(0, 10)

/** Wöchentlich ab 2020; nur die Folgen `belegt` sind gesehen, alle späteren aus dem Wochentakt fortgeschrieben. */
function plan(belegt: number[], gesamt: number): Release {
  const observed = Object.fromEntries(belegt.map((n) => [String(n), wochenfolge(n)]))
  return {
    slug: 'herkunft-test',
    titleId: 1,
    name: 'Herkunft',
    platform: 'primevideo',
    platformUrl: 'https://www.amazon.de/s?k=TEST',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: wochenfolge(1), time: '17:00', episodeCount: gesamt, observed },
    sources: [],
  } as unknown as Release
}

const weg = (bis: number): StreamLink =>
  ({ platform: 'primevideo', url: '', dub: true, dubRanges: [{ from: 1, to: bis, dub: true }] }) as StreamLink
const titel = (s: StreamLink, episodes: number): Title => ({ id: 1, format: 'TV', episodes, streams: [s] }) as unknown as Title

function pille(s: StreamLink, release: Release, episodes: number): string {
  const mit = titelMitTerminBereichen(titel(s, episodes), [release])!
  const auskunft = folgenAuskunft({ releases: [release], title: mit, t, releaseJePlattform: new Map([['primevideo', release]]), today: HEUTE })
  return auskunft(mit.streams![0]!)
}

const SPANNE = 'detail.folgenBereich'

/* Laufende Serie (Ende erst 2039): belegt Folge 1, alles danach fortgeschrieben. */
const laeuft = plan([1], 2000)
pruefe('laufend, Beleg nur Folge 1: Spanne mit „≈“', pille(weg(1), laeuft, 2000).startsWith(`≈ ${SPANNE}`), pille(weg(1), laeuft, 2000))
pruefe('laufend, Beleg deckt alle erschienenen: kein „≈“', pille(weg(5000), laeuft, 2000).startsWith(SPANNE), pille(weg(5000), laeuft, 2000))

/* Beendet (3 Folgen, 2020): die Bereichspille nennt die Bereiche selbst und muss die ergänzten Folgen trotzdem kennzeichnen. */
const beendet = plan([1], 3)
pruefe('beendet, Beleg nur Folge 1: „≈ Fg. 1–3“', pille(weg(1), beendet, 3) === `≈ ${SPANNE}{"bereich":"1–3"}`, pille(weg(1), beendet, 3))
pruefe('beendet, Beleg deckt alles: „Fg. 1–3“ ohne „≈“', pille(weg(3), beendet, 3) === `${SPANNE}{"bereich":"1–3"}`, pille(weg(3), beendet, 3))
const gesehen = plan([1, 2, 3], 3)
pruefe('beendet, Folgen 2–3 beobachtet (nicht fortgeschrieben): kein „≈“', pille(weg(1), gesehen, 3) === `${SPANNE}{"bereich":"1–3"}`, pille(weg(1), gesehen, 3))

/* Die Herkunft bleibt am Weg, der Beleg selbst unangetastet. */
const roh = titel(weg(1), 3)
const mit = titelMitTerminBereichen(roh, [beendet])!.streams![0]! as WegMitHerkunft
pruefe('Weg vermerkt die ergänzten Folgen', JSON.stringify(mit.ergaenzteFolgen) === '[2,3]', mit.ergaenzteFolgen)
pruefe('Bereiche sind zusammengeführt (1–3)', JSON.stringify(mit.dubRanges) === '[{"from":1,"to":3,"dub":true}]', mit.dubRanges)
pruefe('der rohe Titel bleibt unverändert', JSON.stringify(roh.streams![0]!.dubRanges) === '[{"from":1,"to":1,"dub":true}]' && (roh.streams![0]! as WegMitHerkunft).ergaenzteFolgen === undefined)
pruefe('ohne Ergänzung kein Vermerk', (titelMitTerminBereichen(titel(weg(3), 3), [beendet])!.streams![0]! as WegMitHerkunft).ergaenzteFolgen === undefined)

/* Einheit: eine ergänzte Folge ist trotz deckendem Bereich unbelegt. */
const events = expandEvents(beendet)
const bereiche = [{ from: 1, to: 3, dub: true }]
pruefe('planGeschaetzt: Bereich deckt, Folge 2–3 ergänzt → geschätzt', planGeschaetzt(events, bereiche, [2, 3]))
pruefe('planGeschaetzt: Bereich deckt, nichts ergänzt → belegt', !planGeschaetzt(events, bereiche))

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('check-herkunft-je-folge: ok')
