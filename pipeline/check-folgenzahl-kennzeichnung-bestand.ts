/**
 * Bestandsteil von `check-folgenzahl-kennzeichnung.ts`: Jeder Weg in `titles.json`, `ohne-synchro.json`, `cartoons.json`: Folgenzahl ohne Beleg trägt „≈“.
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-folgenzahl-kennzeichnung.ts`.
 */
import { readFileSync } from 'node:fs'
import type { Release, StreamLink, Title } from '../shared/types.ts'
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
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log(`check-folgenzahl-kennzeichnung-bestand: ok (mit „≈“: Hauptbestand ${gekennzeichnet[0]}, Katalog ${gekennzeichnet[1]}, Cartoons ${gekennzeichnet[2]})`)
console.log('VERSTÖSSE: 0')
