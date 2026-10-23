/**
 * Zusicherungen zur Telekom-Annahme (13.10.2026, `lib/telekom-annahme.ts`): Videoload und MagentaTV (Kauf) gelten als deutsch,
 * der Weg trägt dafür `dubAbgeleitet: 'telekom-annahme'` neben `dubRanges`, die Oberfläche zeigt „Deutsch angenommen“ statt
 * „✓ Deutsch“, und kein freenet-Weg leitet aus der Annahme etwas ab. Aufruf: `npm run check:logic`.
 */
import type { Title, WatchLink } from '../shared/types.ts'
import { magentaOhneDeutsch, setzeTelekomAnnahme, telekomFehler, uebernehmeZwilling, zwillingFehler } from './lib/telekom-annahme.ts'
import { ergaenzeWegeAusJustwatch } from './bau/11-2-justwatch.ts'
import { kennzeichneFreenet } from './lib/schwester-shop.ts'
import { istAnnahme, streamWegStatus } from '../web/src/components/detail/legende-zeilen.ts'
import { gruppiereKaufwege } from '../web/src/components/detail/pillen.tsx'
import { legendeFuer } from '../web/src/components/detail/pille.tsx'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
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

console.log('\nAntwort-Kasten (Devil May Cry: Netflix belegt Folge 1, Videoload nimmt 1–12 an):')
const netflix = { platform: 'Netflix', url: 'https://netflix/x', dub: true, dubRanges: [{ from: 1, to: 1, dub: true }] }
const kasten = (wege: WatchLink[], streams: unknown[] = [netflix]) =>
  berechneAntwort({ title: { ...titel(wege), streams } as unknown as Title, releases: [], today: '2026-10-13', jetzt: new Date('2026-10-13T12:00:00Z') })
const mitAnnahme = kasten([weg('Videoload', { dubRanges: deutsch, dubAbgeleitet: 'telekom-annahme' })])
const kastenBeleg = kasten([weg('Videoload', { dubRanges: deutsch })])
pruefe('Kasten: die Annahme füllt die Folgen nicht auf', mitAnnahme?.art === 'teilweise', mitAnnahme)
pruefe('Kasten: derselbe Weg als Beleg macht den Titel vollständig (Gegenprobe)', kastenBeleg?.art === 'fertig', kastenBeleg)
const kastenAnnahme = kasten([weg('Videoload', { dubRanges: deutsch, dubAbgeleitet: 'telekom-annahme' })], [])
pruefe('Kasten: Annahme allein ist kein Synchro-Beleg', kastenAnnahme?.art !== 'fertig' && kastenAnnahme?.art !== 'teilweise', kastenAnnahme)

console.log('\nZusicherung des Baus:')
pruefe('saubere Annahme: kein Fehler', telekomFehler([v, m]).length === 0)
pruefe('Annahme bei einem anderen Anbieter: Fehler', telekomFehler([titel([weg('Apple TV', { dubRanges: deutsch, dubAbgeleitet: 'telekom-annahme' })])]).length === 1)
pruefe('Annahme ohne dubRanges: Fehler', telekomFehler([titel([weg('Videoload', { dubAbgeleitet: 'telekom-annahme' })])]).length === 1)
pruefe('Annahme neben einem Nein: Fehler', telekomFehler([titel([weg('Videoload', { dubRanges: nein, dubAbgeleitet: 'telekom-annahme' })])]).length === 1)

console.log('\nMagentaTV-Zwilling (gleiche Gracenote-Kennung, 19.10.2026):')
const GN = 'https://www.magenta.tv/film/your-name/GN_MV011028530000'
const magenta = (extra: Partial<WatchLink> = {}) => weg('MagentaTV', { url: GN, dubRanges: deutsch, ...extra })
const videoload = (url = GN.replace('magenta.tv', 'videoload.de'), extra: Partial<WatchLink> = {}) => weg('Videoload', { url, ...extra })
const zwilling = (wege: WatchLink[], format = 'MOVIE') => {
  const t = titel(wege, format)
  return { t, n: uebernehmeZwilling(t) }
}
{
  const z = zwilling([magenta(), videoload()])
  pruefe('Film: Videoload übernimmt die Messung ohne Kennzeichnung', z.n === 1 && JSON.stringify(z.t.watchLinks![1].dubRanges) === JSON.stringify(deutsch) && !z.t.watchLinks![1].dubAbgeleitet)
  pruefe('… und die Annahme danach lässt ihn in Ruhe', setzeTelekomAnnahme(z.t, []) === 0 && z.t.watchLinks!.every((w) => !w.dubAbgeleitet))
  pruefe('Serie: keine Übernahme', zwilling([magenta(), videoload()], 'TV').n === 0)
  pruefe('andere Kennung: keine Übernahme', zwilling([magenta(), videoload('https://www.videoload.de/film/x/GN_MV999')]).n === 0)
  pruefe('Videoload ohne Kennung (themoviedb): keine Übernahme', zwilling([magenta(), videoload('https://www.themoviedb.org/movie/1/watch')]).n === 0)
  pruefe('Zwilling nur angenommen: keine Übernahme', zwilling([magenta({ dubAbgeleitet: 'telekom-annahme' }), videoload()]).n === 0)
  pruefe('Zwilling mit Nein: keine Übernahme', zwilling([magenta({ dubRanges: nein }), videoload()]).n === 0)
  pruefe('Zwilling ohne Angabe: keine Übernahme', zwilling([magenta({ dubRanges: undefined }), videoload()]).n === 0)
  pruefe('eigene Angabe von Videoload bleibt', zwilling([magenta(), videoload(undefined, { dubRanges: nein })]).n === 0)
  pruefe('Zwilling mit gemischten Bereichen (Deutsch und Nein): keine Übernahme', zwilling([magenta({ dubRanges: [...deutsch, ...nein] }), videoload()]).n === 0)
  pruefe('Messung eines fremden Anbieters mit der Kennung zählt nicht als Zwilling', zwilling([weg('maxdome', { url: GN, dubRanges: deutsch }), videoload()]).n === 0)
  pruefe('nur Videoload-Wege übernehmen (anderer Anbieter ohne Angabe bleibt leer)', zwilling([magenta(), weg('Apple TV', { url: GN.replace('magenta.tv', 'videoload.de') })]).n === 0)
  pruefe('Wert wird kopiert, nicht geteilt', z.t.watchLinks![1].dubRanges !== z.t.watchLinks![0].dubRanges)
}
console.log('\nWächter „Annahme, obwohl gemessen“:')
{
  const angenommen = { dubRanges: deutsch, dubAbgeleitet: 'telekom-annahme' } as const
  const rot = titel([magenta(), videoload(undefined, angenommen)])
  pruefe('Annahme neben gemessenem Zwilling: Fehler', zwillingFehler([rot]).length === 1, zwillingFehler([rot]))
  pruefe('Annahme ohne Zwilling (andere Kennung): kein Fehler', zwillingFehler([titel([magenta(), videoload('https://www.videoload.de/film/x/GN_MV999', angenommen)])]).length === 0)
  pruefe('Zwilling selbst nur angenommen: kein Fehler', zwillingFehler([titel([magenta({ dubAbgeleitet: 'telekom-annahme' }), videoload(undefined, angenommen)])]).length === 0)
}
console.log('\nAufrufer (`ergaenzeWegeAusJustwatch`, Videoload auf themoviedb, MagentaTV-Zwilling):')
{
  const t = titel([magenta(), videoload('https://www.themoviedb.org/movie/9000020/watch')], 'MOVIE')
  t.id = 9000020
  ergaenzeWegeAusJustwatch({ titles: new Map([[t.id, t]]), tmdbMehrdeutig: new Set(), toteAdressen: new Set() })
  const v = t.watchLinks!.find((w) => w.name === 'Videoload')
  pruefe('Bau: Videoload bekommt Kennung und Messung, keine Annahme', v?.url.includes('GN_MV011028530000') === true && v.dubRanges?.[0]?.dub === true && !v.dubAbgeleitet, v)
}

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
