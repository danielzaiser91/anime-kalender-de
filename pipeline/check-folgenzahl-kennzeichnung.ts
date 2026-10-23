/**
 * Zusicherung: **eine Folgenzahl an der Pille ohne Beleg am Weg trägt „≈“** (11.10.2026; vorher standen
 * 1.165 abgeleitete Zahlen im Hauptbestand ohne Kennzeichnung, Grundlinie `tools/datenqualitaet-messen.mjs`).
 *
 * Belegt ist eine Zahl durch deutsche Bereiche am Weg (Anbieter, Handbeleg, Erweiterung) oder den Wochenplan
 * des Anbieters. Alles andere — die Folgenzahl des Werks bei abgeschlossener Serie — ist abgeleitet.
 * Prüft Beispielfälle; jeden Weg in `public/data` prüft `check-folgenzahl-kennzeichnung-bestand.ts`. Läuft in `check:logic`.
 */
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { fertigZahlText } from '../web/src/components/detail/antwort-regeln.ts'
import { folgenAuskunft } from '../web/src/components/detail/folgen-angabe.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const t = (key: string, params?: Record<string, string | number>): string => (params ? `${key}${JSON.stringify(params)}` : key)
const HEUTE = '2026-10-11'
const ZAHL = 'detail.folgenKurz'
const SPANNE = 'detail.folgenBereich'

function pille(title: Title, s: StreamLink, releases: Release[] = []): string {
  const fn = folgenAuskunft({ releases, title, t: t as never, releaseJePlattform: new Map(releases.map((r) => [r.platform, r])), today: HEUTE })
  return fn(s)
}

const beendet = { id: 1, format: 'TV', episodes: 12, jpYear: 2019, jpEnd: '2019-12-20' } as unknown as Title
const ohneBereiche = { platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true } as StreamLink
const mitBereichen = { ...ohneBereiche, dubRanges: [{ from: 1, to: 12, dub: true }] } as StreamLink

pruefe('Haken ohne Bereiche, Serie beendet: Titelzahl mit „≈“', pille(beendet, ohneBereiche) === `≈ ${ZAHL}{"n":12}`, pille(beendet, ohneBereiche))
pruefe('Mit Bereichen am Weg: Zahl ohne „≈“', pille(beendet, mitBereichen) === `${SPANNE}{"bereich":"1–12"}`, pille(beendet, mitBereichen))
pruefe('Ohne Haken: keine Zahl', pille(beendet, { ...ohneBereiche, dub: undefined }) === '')

/* Wochenplan, dessen Termine fortgeschrieben sind (`estimated`): die erschienene Spanne ist abgeleitet und trägt „≈“; belegte Bereiche decken sie (12.10.2026). */
const plan = (geschaetzt: boolean): Release =>
  ({
    slug: 'plan-test',
    titleId: 1,
    name: 'Plan',
    platform: 'netflix',
    platformUrl: 'https://www.netflix.com/title/1',
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: '2026-09-20',
      time: '17:00',
      episodeCount: 12,
      estimated: geschaetzt,
    },
    sources: [],
  }) as unknown as Release
const laufend = { ...beendet, jpEnd: undefined, episodes: 12 } as unknown as Title
const bereicheBis = (to: number): StreamLink => ({ ...ohneBereiche, dubRanges: [{ from: 1, to, dub: true }] }) as StreamLink
pruefe('Wochenplan fortgeschrieben, keine Bereiche: Spanne mit „≈“', pille(laufend, ohneBereiche, [plan(true)]).startsWith(`≈ ${SPANNE}`), pille(laufend, ohneBereiche, [plan(true)]))
pruefe('Wochenplan belegt: Spanne ohne „≈“', pille(laufend, ohneBereiche, [plan(false)]).startsWith(SPANNE), pille(laufend, ohneBereiche, [plan(false)]))
pruefe('Fortgeschriebener Plan hinter belegten Bereichen: „≈“', pille(laufend, bereicheBis(2), [plan(true)]).startsWith(`≈ ${SPANNE}`), pille(laufend, bereicheBis(2), [plan(true)]))
pruefe('Belegte Bereiche decken den fortgeschriebenen Plan: kein „≈“', pille(laufend, bereicheBis(12), [plan(true)]).startsWith(SPANNE), pille(laufend, bereicheBis(12), [plan(true)]))

/* Der Antwortkasten sagt dasselbe wie die Pille: abgeleitet → „≈ N“ statt „Alle N“, belegt → unverändert (Cowboy Bebop, 11.10.2026). */
function kastenFertig(title: Title, releases: Release[] = []) {
  const a = berechneAntwort({ title, releases, today: HEUTE, jetzt: new Date(`${HEUTE}T12:00:00Z`) })
  return a?.art === 'fertig' ? a : undefined
}
const bebop = (s: StreamLink): Title => ({ ...beendet, streams: [s] }) as Title
const kastenAbgeleitet = kastenFertig(bebop(ohneBereiche))
const kastenBelegt = kastenFertig(bebop(mitBereichen))
pruefe('Kasten: Haken ohne Bereiche, Serie beendet: Zahl abgeleitet', kastenAbgeleitet?.gesamtAbgeleitet === true, JSON.stringify(kastenAbgeleitet))
pruefe('Kasten: Bereiche decken das Werk: Zahl belegt', kastenBelegt?.gesamtAbgeleitet === false, JSON.stringify(kastenBelegt))
pruefe('Kasten abgeleitet: Überschrift ohne „Alle“', fertigZahlText(12, true, t as never) === 'antwort.fertigUngefaehr{"count":"≈ 12"}')
pruefe('Kasten belegt: „Alle N“ unverändert', fertigZahlText(12, false, t as never) === 'antwort.fertigZahl{"count":12}')
pruefe('Kasten und Pille stimmen überein (abgeleitet)', pille(beendet, ohneBereiche).startsWith('≈') === (kastenAbgeleitet?.gesamtAbgeleitet === true))
pruefe('Kasten und Pille stimmen überein (belegt)', pille(beendet, mitBereichen).startsWith('≈') === (kastenBelegt?.gesamtAbgeleitet === true))

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('check-folgenzahl-kennzeichnung: ok')
