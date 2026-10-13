/**
 * Zusicherungen zu „freenet meinVOD: Deutsch laut Schwester-Shop“ (13.10.2026, `lib/schwester-shop.ts`): Die Kennzeichnung gilt nur
 * mit Deutsch-Beleg eines Schwester-Shops und ohne Widerspruch, steht nur an freenet und ist nie ein Beleg (kein Haken, kein
 * `dubRanges`, kein Einfluss auf die belegte Synchro). Aufruf: `npm run check:logic`; der Bestandsteil steht in `check-schwester-shop-bestand.ts`.
 */
import type { Title, WatchLink } from '../shared/types.ts'
import { kennzeichneFreenet, schwesterBelegtDeutsch, schwesterFehler } from './lib/schwester-shop.ts'
import { ohneBelegteSynchro } from './bau/synchro-belegt.ts'
import { streamWegStatus } from '../web/src/components/detail/legende-zeilen.ts'
import { gruppiereKaufwege } from '../web/src/components/detail/pillen.tsx'
import { legendeFuer } from '../web/src/components/detail/pille.tsx'
import { TEXTE_ZEILEN } from '../web/src/lib/i18n-zeilen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const deutsch = [{ from: 1, to: 12, dub: true }]
const nein = [{ from: 1, to: 12, dub: false }]
const weg = (name: string, extra: Partial<WatchLink> = {}): WatchLink => ({ name, url: `https://x/${name}`, kind: 'stream', zugang: 'kauf', ...extra })
const freenet = (extra: Partial<WatchLink> = {}) => weg('freenet meinVOD', extra)
const titel = (wege: WatchLink[]): Title =>
  ({ id: 1, slug: 'x', dubConfidence: 'low', jpYear: 2024, streams: [], watchLinks: wege }) as unknown as Title

console.log('\nRegel:')
for (const shop of ['maxdome', 'MagentaTV', 'Videoload']) {
  const wege = [freenet(), weg(shop, { dubRanges: deutsch })]
  pruefe(`${shop} belegt Deutsch: freenet wird gekennzeichnet`, kennzeichneFreenet(wege) === 1 && wege[0].dubAbgeleitet === 'schwester-shop')
}
const widerspruch = [freenet(), weg('maxdome', { dubRanges: deutsch }), weg('MagentaTV', { dubRanges: nein })]
pruefe('ein Schwester-Shop verneint: keine Kennzeichnung', kennzeichneFreenet(widerspruch) === 0 && !widerspruch[0].dubAbgeleitet)
const ohneBeleg = [freenet(), weg('maxdome'), weg('Videoload')]
pruefe('Schwester-Shops ohne Angabe: keine Kennzeichnung', kennzeichneFreenet(ohneBeleg) === 0 && !ohneBeleg[0].dubAbgeleitet)
const nurFremder = [freenet(), weg('Apple TV', { dubRanges: deutsch })]
pruefe('Deutsch bei einem anderen Anbieter zählt nicht', kennzeichneFreenet(nurFremder) === 0)
const eigene = [freenet({ dubRanges: nein }), weg('maxdome', { dubRanges: deutsch })]
pruefe('freenet mit eigener Angabe bleibt, wie es ist', kennzeichneFreenet(eigene) === 0 && !eigene[0].dubAbgeleitet && eigene[0].dubRanges === nein)
const gemischt = [freenet(), weg('maxdome', { dubRanges: [...deutsch, { from: 13, to: 24, dub: false }] })]
pruefe('Schwester mit Deutsch in einem Teil verneint nichts', schwesterBelegtDeutsch(gemischt))
const dazu = [freenet(), weg('Apple TV'), weg('maxdome', { dubRanges: deutsch })]
kennzeichneFreenet(dazu)
pruefe('nur freenet wird gekennzeichnet', dazu.filter((w) => w.dubAbgeleitet).map((w) => w.name).join() === 'freenet meinVOD')
pruefe('zweiter Lauf ändert nichts', kennzeichneFreenet(dazu) === 0)

console.log('\nNie ein Beleg:')
const vorher = titel([freenet(), weg('maxdome', { dubRanges: deutsch })])
const nachher = titel([freenet(), weg('maxdome', { dubRanges: deutsch })])
kennzeichneFreenet(nachher.watchLinks!)
const ohneKennzeichen = JSON.parse(JSON.stringify(nachher)) as Title
delete ohneKennzeichen.watchLinks![0].dubAbgeleitet
pruefe('außer dem Feld am freenet-Weg bleibt der Titel gleich', JSON.stringify(ohneKennzeichen) === JSON.stringify(vorher))
pruefe('kein dubRanges, kein dub am freenet-Weg', !nachher.watchLinks![0].dubRanges && !('dub' in nachher.watchLinks![0]))
pruefe('belegte Synchro des Titels unverändert', ohneBelegteSynchro(nachher, []) === ohneBelegteSynchro(vorher, []))
const nurFreenetAbgeleitet = titel([freenet({ dubAbgeleitet: 'schwester-shop' })])
pruefe('allein trägt die Kennzeichnung keine belegte Synchro', ohneBelegteSynchro(nurFreenetAbgeleitet, []) === true)
const gruppe = gruppiereKaufwege([freenet({ dubAbgeleitet: 'schwester-shop' })])
pruefe('Blase: „laut Schwester-Shop“, nicht „Deutsch“', streamWegStatus(gruppe[0], nachher) === 'schwester')
pruefe('Blase: ein Beleg am Weg geht vor', streamWegStatus(gruppiereKaufwege([freenet({ dubAbgeleitet: 'schwester-shop', dubRanges: deutsch })])[0], nachher) === 'belegt')
pruefe('Blase: ohne Kennzeichnung bleibt die Sprache offen', streamWegStatus(gruppiereKaufwege([freenet()])[0], nachher) === 'offen')
pruefe('Legende nennt „laut Schwester-Shop“', legendeFuer(['schwester'], false, (k) => TEXTE_ZEILEN[k as keyof typeof TEXTE_ZEILEN] ?? k)?.includes('laut Schwester-Shop') === true)

console.log('\nZusicherung des Baus:')
pruefe('saubere Kennzeichnung: kein Fehler', schwesterFehler([nachher]).length === 0)
pruefe('Kennzeichnung neben dubRanges: Fehler', schwesterFehler([titel([freenet({ dubAbgeleitet: 'schwester-shop', dubRanges: deutsch }), weg('maxdome', { dubRanges: deutsch })])]).length === 1)
pruefe('Kennzeichnung ohne Schwester-Beleg: Fehler', schwesterFehler([nurFreenetAbgeleitet]).length === 1)
pruefe('Kennzeichnung bei einem anderen Anbieter: Fehler', schwesterFehler([titel([weg('Apple TV', { dubAbgeleitet: 'schwester-shop' }), weg('maxdome', { dubRanges: deutsch })])]).length === 1)

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
