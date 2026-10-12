/**
 * Zusicherung: **eine Folgenzahl an der Pille ohne Beleg am Weg trägt „≈“** (11.10.2026; vorher standen
 * 1.165 abgeleitete Zahlen im Hauptbestand ohne Kennzeichnung, Grundlinie `tools/datenqualitaet-messen.mjs`).
 *
 * Belegt ist eine Zahl durch deutsche Bereiche am Weg (Anbieter, Handbeleg, Erweiterung) oder den Wochenplan
 * des Anbieters. Alles andere — die Folgenzahl des Werks bei abgeschlossener Serie — ist abgeleitet.
 * Prüft Beispielfälle und danach jeden Weg in `public/data` (Hauptbestand, Katalog, Cartoons). Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { fertigZahlText } from '../web/src/components/detail/antwort-regeln.ts'
import { folgenAuskunft } from '../web/src/components/detail/folgen-angabe.ts'
import { zaehlPlattform } from '../web/src/components/detail/prime-kanal.ts'
import { titelMitTerminBereichen } from '../web/src/components/detail/stream-bereiche.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const t = (key: string, params?: Record<string, string | number>): string => (params ? `${key}${JSON.stringify(params)}` : key)
const HEUTE = '2026-10-11'
const ZAHL = 'detail.folgenKurz'

function pille(title: Title, s: StreamLink, releases: Release[] = []): string {
  const fn = folgenAuskunft({ releases, title, t: t as never, releaseJePlattform: new Map(releases.map((r) => [r.platform, r])), today: HEUTE })
  return fn(s)
}

const beendet = { id: 1, format: 'TV', episodes: 12, jpYear: 2019, jpEnd: '2019-12-20' } as unknown as Title
const ohneBereiche = { platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true } as StreamLink
const mitBereichen = { ...ohneBereiche, dubRanges: [{ from: 1, to: 12, dub: true }] } as StreamLink

pruefe('Haken ohne Bereiche, Serie beendet: Titelzahl mit „≈“', pille(beendet, ohneBereiche) === `≈ ${ZAHL}{"n":12}`, pille(beendet, ohneBereiche))
pruefe('Mit Bereichen am Weg: Zahl ohne „≈“', pille(beendet, mitBereichen) === `${ZAHL}{"n":12}`, pille(beendet, mitBereichen))
pruefe('Ohne Haken: keine Zahl', pille(beendet, { ...ohneBereiche, dub: undefined }) === '')

/* Der Antwortkasten sagt dasselbe wie die Pille: abgeleitet → „≈ N“ statt „Alle N“, belegt → unverändert (Cowboy Bebop, 11.10.2026). */
function kastenFertig(title: Title, releases: Release[] = []) {
  const a = berechneAntwort({ title, releases, today: HEUTE })
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

function pruefeBestand(datei: string, releasesJeTitel: Map<number, Release[]>): number {
  let unmarkiert = 0
  let markiert = 0
  const titel = JSON.parse(readFileSync(`public/data/${datei}`, 'utf8')) as Title[]
  for (const roh of titel) {
    const releases = releasesJeTitel.get(roh.id) ?? []
    const t0 = titelMitTerminBereichen(roh, releases)
    if (!t0) continue
    for (const s of t0.streams ?? []) {
      const text = pille(t0, s, releases)
      if (text.startsWith('≈')) {
        markiert++
        continue
      }
      if (!text.startsWith(ZAHL)) continue
      const plattform = zaehlPlattform(s, t0.streams ?? [])
      const belegt = s.dubRanges?.some((r) => r.dub) || releases.some((r) => r.platform === plattform && r.releaseType === 'weekly')
      if (belegt) continue
      unmarkiert++
      if (unmarkiert <= 5) console.error(`  ${datei} ${roh.id} ${s.platform}: ${text}`)
    }
  }
  pruefe(`${datei}: Folgenzahl ohne Beleg und ohne „≈“ (${unmarkiert} Wege)`, unmarkiert === 0)
  return markiert
}

const releases = JSON.parse(readFileSync('public/data/releases.json', 'utf8')) as Release[]
const jeTitel = new Map<number, Release[]>()
for (const r of releases) jeTitel.set(r.titleId, [...(jeTitel.get(r.titleId) ?? []), r])
const gekennzeichnet = ['titles.json', 'ohne-synchro.json', 'cartoons.json'].map((d) => pruefeBestand(d, jeTitel))
pruefe('Bestand: mindestens ein Weg trägt „≈“ (sonst prüft diese Prüfung nichts)', gekennzeichnet[0]! > 0)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log(`check-folgenzahl-kennzeichnung: ok (mit „≈“: Hauptbestand ${gekennzeichnet[0]}, Katalog ${gekennzeichnet[1]}, Cartoons ${gekennzeichnet[2]} Wege, ungemergt)`)
