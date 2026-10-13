/**
 * Zusicherungen zur Telekom-Annahme (13.10.2026, `lib/telekom-annahme.ts`): Videoload und MagentaTV (Kauf) gelten als deutsch,
 * der Weg trägt dafür `dubAbgeleitet: 'telekom-annahme'` neben `dubRanges`, die Oberfläche zeigt „Deutsch angenommen“ statt
 * „✓ Deutsch“, und kein freenet-Weg leitet aus der Annahme etwas ab. Aufruf: `npm run check:logic`.
 */
import type { Title, WatchLink } from '../shared/types.ts'
import { magentaOhneDeutsch, setzeTelekomAnnahme, telekomFehler } from './lib/telekom-annahme.ts'
import { kennzeichneFreenet } from './lib/schwester-shop.ts'
import { istAnnahme, streamWegStatus } from '../web/src/components/detail/legende-zeilen.ts'
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
const titel = (wege: WatchLink[], format = 'TV'): Title =>
  ({ id: 1, slug: 'x', dubConfidence: 'low', jpYear: 2024, format, episodes: 12, streams: [], watchLinks: wege }) as unknown as Title

console.log('\nWer die Annahme bekommt:')
const v = titel([weg('Videoload')])
pruefe('Videoload ohne Angabe: dubRanges über alle Folgen und Kennzeichnung', setzeTelekomAnnahme(v, []) === 1 && JSON.stringify(v.watchLinks![0].dubRanges) === JSON.stringify(deutsch) && v.watchLinks![0].dubAbgeleitet === 'telekom-annahme')
const film = titel([weg('Videoload')], 'MOVIE')
setzeTelekomAnnahme(film, [])
pruefe('Film: eine Einheit', film.watchLinks![0].dubRanges![0].to === 1)
const m = titel([weg('MagentaTV')])
pruefe('MagentaTV (Kauf) bekommt die Annahme wie Videoload', setzeTelekomAnnahme(m, []) === 1 && m.watchLinks![0].dubAbgeleitet === 'telekom-annahme')
const abo = titel([weg('MagentaTV', { zugang: 'abo' })])
pruefe('MagentaTV-Abo (Magenta TV+) bleibt offen', setzeTelekomAnnahme(abo, []) === 0 && !abo.watchLinks![0].dubRanges)
const eigen = titel([weg('Videoload', { dubRanges: nein }), weg('MagentaTV', { dubRanges: deutsch })])
pruefe('eigene Angabe bleibt, ohne Kennzeichnung', setzeTelekomAnnahme(eigen, []) === 0 && eigen.watchLinks!.every((w) => !w.dubAbgeleitet) && eigen.watchLinks![0].dubRanges === nein)
const fremd = titel([weg('Apple TV'), weg('maxdome')])
pruefe('andere Anbieter bekommen keine Annahme', setzeTelekomAnnahme(fremd, []) === 0)
const nurEnglisch = [{ anbieter: 'MagentaTV', audio: ['en'] }]
const widerlegt = titel([weg('Videoload'), weg('MagentaTV')])
pruefe('JustWatch nennt bei MagentaTV nur Englisch: keine Annahme', magentaOhneDeutsch(nurEnglisch) && setzeTelekomAnnahme(widerlegt, nurEnglisch) === 0 && widerlegt.watchLinks!.every((w) => !w.dubRanges))
pruefe('Angebot ohne Tonangabe widerlegt nichts', !magentaOhneDeutsch([{ anbieter: 'MagentaTV', audio: [] }, { anbieter: 'Magenta TV+' }]))
pruefe('zweiter Lauf ändert nichts', setzeTelekomAnnahme(v, []) === 0)

console.log('\nfreenet leitet nichts aus der Annahme ab:')
const nurAnnahme = [weg('freenet meinVOD'), weg('Videoload'), weg('MagentaTV')]
setzeTelekomAnnahme(titel(nurAnnahme), [])
pruefe('nur Annahme bei Videoload und MagentaTV: freenet bleibt offen', kennzeichneFreenet(nurAnnahme) === 0)
const mitBeleg = [weg('freenet meinVOD'), weg('Videoload'), weg('maxdome', { dubRanges: deutsch })]
setzeTelekomAnnahme(titel(mitBeleg), [])
pruefe('Annahme neben einem Beleg: freenet wird gekennzeichnet', kennzeichneFreenet(mitBeleg) === 1)
const widerspruch = [weg('freenet meinVOD'), weg('Videoload'), weg('maxdome', { dubRanges: deutsch }), weg('MagentaTV', { dubRanges: nein })]
setzeTelekomAnnahme(titel(widerspruch), [])
pruefe('Verneinung bleibt eine Verneinung', kennzeichneFreenet(widerspruch) === 0)
const annahmeUndBeleg = [weg('freenet meinVOD'), weg('Videoload'), weg('MagentaTV', { dubRanges: deutsch })]
setzeTelekomAnnahme(titel(annahmeUndBeleg), [])
pruefe('Annahme verneint nichts: der Beleg eines anderen Shops reicht', kennzeichneFreenet(annahmeUndBeleg) === 1)

console.log('\nOberfläche:')
const gruppe = gruppiereKaufwege([weg('Videoload', { dubRanges: deutsch, dubAbgeleitet: 'telekom-annahme' })])
pruefe('Blase: Annahme, nicht „✓ Deutsch“', streamWegStatus(gruppe[0], v) === 'annahme' && istAnnahme(gruppe[0].eintraege[0]))
pruefe('Blase: Beleg ohne Kennzeichnung bleibt „✓ Deutsch“', streamWegStatus(gruppiereKaufwege([weg('Videoload', { dubRanges: deutsch })])[0], v) === 'belegt')
pruefe('Legende nennt „Deutsch angenommen“', legendeFuer(['annahme'], false, (k) => TEXTE_ZEILEN[k as keyof typeof TEXTE_ZEILEN] ?? k)?.includes('Deutsch angenommen') === true)

console.log('\nZusicherung des Baus:')
pruefe('saubere Annahme: kein Fehler', telekomFehler([v, m]).length === 0)
pruefe('Annahme bei einem anderen Anbieter: Fehler', telekomFehler([titel([weg('Apple TV', { dubRanges: deutsch, dubAbgeleitet: 'telekom-annahme' })])]).length === 1)
pruefe('Annahme ohne dubRanges: Fehler', telekomFehler([titel([weg('Videoload', { dubAbgeleitet: 'telekom-annahme' })])]).length === 1)
pruefe('Annahme neben einem Nein: Fehler', telekomFehler([titel([weg('Videoload', { dubRanges: nein, dubAbgeleitet: 'telekom-annahme' })])]).length === 1)

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
