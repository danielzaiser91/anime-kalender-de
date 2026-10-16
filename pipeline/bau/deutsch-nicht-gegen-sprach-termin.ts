import type { Release, StreamLink, Title } from '../../shared/types.ts'
import { geerbteWege } from '../../shared/kanal-anbieter.ts'
import { adressKern, loadDubChecks, type DubCheck } from '../lib/dub-confirmed.ts'
import { alleTermineGekennzeichnet } from '../lib/pruefung.ts'
import { log } from '../lib/util.ts'
import { kanalErbtVomAnbieter } from './kanal-erbt-anbieter.ts'
import { kanalImNamen } from './13-1-weg-adresse-bezugsweg.ts'

/** Ein Kanal-Weg: `kanal` am Weg, oder ein Bezugsweg „Amazon Prime (Kanal)“ desselben Titels auf derselben Seite (der Rohfolgen-Weg aus `09-3` kennt seinen Kanal nicht). */
function istKanalWeg(s: StreamLink, titel: Title): boolean {
  if (s.kanal) return true
  return (titel.watchLinks ?? []).some((w) => w.kind === 'stream' && kanalImNamen(w.name) !== undefined && adressKern(w.url) === adressKern(s.url))
}

/**
 * **Ein Kanal-Weg trägt kein „deutsch", wenn alle Termine seines Anbieters eine Sprachkennzeichnung tragen** (`sprache`: omu/offen; 16.10.2026,
 * Demon Slayer Hashira Training und Swordsmith Village, Prime). Sein Ja ist abgeleitet — vom Anbieter geerbt (`kanalErbtVomAnbieter`) oder aus
 * Amazons Sprachliste eines Kanal-Titels, die keine Synchro belegt (quellen.md, 11.10.2026) — und der Termin sagt ausdrücklich: Synchro nicht belegt.
 * Ein Handbeleg „deutsch" bleibt (Vorrang; widerspricht ihm der Termin, zeigt es die Prüfung), ebenso ein Weg ohne Kanal. Gibt die Zahl der Wege zurück.
 */
export function nimmKanalJaGegenSprachTermin(titles: Iterable<Title>, releases: Release[], checks: DubCheck[]): number {
  const gekennzeichnet = alleTermineGekennzeichnet(releases)
  const handJa = new Set(checks.filter((c) => c.dub === true).map((c) => `${c.anilistId}|${c.platform}`))
  let genommen = 0
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      const k = `${t.id}|${s.platform}`
      if (s.dub !== true || !gekennzeichnet.has(k) || handJa.has(k) || !istKanalWeg(s, t)) continue
      delete s.dub
      delete s.dubRanges
      geerbteWege.delete(s)
      genommen++
    }
  }
  return genommen
}

/** Die Tonurteile der Prime-Kanal-Wege: erst das Erbe vom Anbieter (JustWatchs „ohne de“ an der Seite, `jwNein`, schlägt es), danach fällt jedes Kanal-Ja gegen gekennzeichnete Termine — auch ein geerbtes. */
export function tonDerKanalWege(allTitles: Title[], releases: Release[], jwNein: (t: Title, s: StreamLink) => boolean): void {
  const geerbt = kanalErbtVomAnbieter(allTitles, jwNein)
  if (geerbt) log(`${geerbt} Prime-Kanal-Wege erben das Deutsch ihres Anbieters`)
  const genommen = nimmKanalJaGegenSprachTermin(allTitles, releases, loadDubChecks())
  if (genommen) log(`${genommen} Kanal-Wege ohne „deutsch": alle Termine des Anbieters tragen eine Sprachkennzeichnung`)
}
