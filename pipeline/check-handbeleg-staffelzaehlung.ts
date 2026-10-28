/**
 * Zusicherung zu `lib/handbeleg-staffelzaehlung.ts`: Die alten Handbelege in Serienzählung (Kengan Ashura S2 13–28, Mushoku Tensei Cour 2 12–23,
 * Spy × Family 1–25 bei je 12 Folgen) fallen auf, auch wenn der jüngere Beleg ohne Bereiche sie nicht ersetzt (`verschmelze` behält die
 * alten Bereiche); in Staffelzählung bleibt nichts übrig. Die Belege stehen wie in `data/dub-confirmed.yaml` vom 24.09./25.09./16.10.2026.
 * Läuft in `check:logic`; die Prüfung am echten Bestand steht in `check-handbeleg-staffelzaehlung-bestand.ts`.
 */
import { verschmelze, type DubCheck } from './lib/dub-confirmed.ts'
import { staffelzaehlungVerletzt } from './lib/handbeleg-staffelzaehlung.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} ${JSON.stringify(info)}`)
}

const beleg = (id: number, platform: string, url: string, am: string, von?: number, bis?: number): DubCheck =>
  ({ anilistId: id, platform, url, dub: true, checkedAt: am, ...(von ? { dubRanges: [{ from: von, to: bis!, dub: true }] } : {}) }) as DubCheck
const NETFLIX_KENGAN = 'https://www.netflix.com/title/80992228'
const NETFLIX_MUSHOKU = 'https://www.netflix.com/title/80987039'
const DISNEY_SPY = 'https://www.disneyplus.com/de-de/series/spyfamily/fet1h9jqmrAM'
const folgen = new Map([[146638, 12], [127720, 12], [140960, 12], [142838, 13], [900001, 12]])

// Alt: der Serien-Bereich vom 24.09. bleibt neben dem jüngeren Urteil ohne Bereich stehen — das war der Anlassfall.
const alt = [
  verschmelze(beleg(146638, 'netflix', NETFLIX_KENGAN, '2026-09-24', 13, 28), beleg(146638, 'netflix', NETFLIX_KENGAN, '2026-09-25')),
  verschmelze(beleg(127720, 'netflix', NETFLIX_MUSHOKU, '2026-09-24', 12, 23), beleg(127720, 'netflix', NETFLIX_MUSHOKU, '2026-09-25')),
  beleg(140960, 'disneyplus', DISNEY_SPY, '2026-10-16', 1, 25),
]
const zeilenAlt = staffelzaehlungVerletzt(alt, folgen)
pruefe('alter Stand: alle drei Belege über der Folgenzahl', zeilenAlt.length === 3, zeilenAlt)
pruefe('alter Stand: Zeile nennt Kennung, Plattform, Adresse und Zahlen', zeilenAlt[0] === `146638 netflix ${NETFLIX_KENGAN}: bis Folge 28 bei 12`, zeilenAlt[0])

const neu = [
  verschmelze(beleg(146638, 'netflix', NETFLIX_KENGAN, '2026-09-24', 1, 12), beleg(146638, 'netflix', NETFLIX_KENGAN, '2026-09-25')),
  verschmelze(beleg(127720, 'netflix', NETFLIX_MUSHOKU, '2026-09-24', 1, 12), beleg(127720, 'netflix', NETFLIX_MUSHOKU, '2026-09-25')),
  beleg(140960, 'disneyplus', DISNEY_SPY, '2026-10-16', 1, 12),
]
pruefe('Staffelzählung: nichts über der Folgenzahl', staffelzaehlungVerletzt(neu, folgen).length === 0, staffelzaehlungVerletzt(neu, folgen))
pruefe('genau die Folgenzahl ist erlaubt, eine mehr nicht', staffelzaehlungVerletzt([beleg(140960, 'netflix', 'u', '2026-10-16', 1, 13)], folgen).length === 1)

// Part 2 (142838): 13 Folgen, Disney+-Beleg 1–13 gilt, der ungerechnete Serienbereich 13–25 nicht.
pruefe('Spy Part 2: 1–13 bei 13 Folgen ist erlaubt', staffelzaehlungVerletzt([beleg(142838, 'disneyplus', DISNEY_SPY, '2026-10-16', 1, 13)], folgen).length === 0)
pruefe('Spy Part 2: Serienbereich 13–25 wird gemeldet', staffelzaehlungVerletzt([beleg(142838, 'disneyplus', DISNEY_SPY, '2026-10-16', 13, 25)], folgen).length === 1)

// Grenzen der Wache: andere Titel bleiben der Schwelle in check-logic-bestand überlassen; ohne bekannte Folgenzahl keine Aussage.
pruefe('fremder Titel über der Folgenzahl wird hier nicht gemeldet', staffelzaehlungVerletzt([beleg(900001, 'netflix', 'u', '2026-10-16', 1, 30)], folgen).length === 0)
pruefe('ohne Folgenzahl keine Meldung', staffelzaehlungVerletzt(alt, new Map()).length === 0)

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nHandbelege in Staffelzählung: 8 Fälle OK')
