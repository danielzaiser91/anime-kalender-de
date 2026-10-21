/**
 * Zusicherungen zu `bau/deutsch-nicht-gegen-sprach-termin.ts` (16.10.2026): Ein Prime-Kanal-Weg trägt kein „deutsch", wenn alle Termine des
 * Anbieters eine Sprachkennzeichnung tragen — weder geerbt noch aus Amazons Sprachliste. Der Bestandsbau brach an `deutschNurAusSpracheTermin`
 * ab (Demon Slayer 166240 und 145139). Läuft in `check:logic`. Erfundene Titel nach dem Muster der echten, kein Netz.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import type { Release, StreamLink, Title, WatchLink } from '../shared/types.ts'
import { geerbteWege } from '../shared/kanal-anbieter.ts'
import { nimmKanalJaGegenSprachTermin, tonDerKanalWege } from './bau/deutsch-nicht-gegen-sprach-termin.ts'
import { ladeHandbelege, type DubCheck } from './lib/dub-confirmed.ts'
import { rohDeutsch } from './lib/kanal-titel.ts'
import { deutschNurAusSpracheTermin } from './lib/pruefung.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const bereiche = [{ from: 1, to: 8, dub: true }]
const seite = (asin: string) => `https://www.amazon.de/gp/video/detail/${asin}`
const cr = (): StreamLink => ({ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/G', dub: true, dubRanges: bereiche }) as StreamLink
const bezug = (name: string, asin: string, kind: WatchLink['kind'] = 'stream'): WatchLink => ({ name, url: `https://www.amazon.de/dp/${asin}`, kind }) as WatchLink
const termin = (titleId: number, sprache?: 'offen' | 'omu', platform = 'primevideo'): Release => ({ titleId, platform, sprache }) as unknown as Release
/** Der Weg, wie `09-3-prime.ts` ihn aus einer Rohmeldung anlegt: das Häkchen aus `rohDeutsch`, ohne `herkunft`. */
function rohWeg(titelId: number, asin: string, sprachen: string[], extra: Partial<StreamLink> = {}): StreamLink {
  const dub = rohDeutsch([{ sprachen }], titelId, { seite: seite(asin), url: seite(asin) }, [])
  return { platform: 'primevideo', url: seite(asin), dub: dub || undefined, ...extra } as StreamLink
}
const titel = (id: number, streams: StreamLink[], watchLinks: WatchLink[] = []): Title => ({ id, streams, watchLinks }) as unknown as Title
const DE = ['Deutsch', 'Japanisch']

/* Bau-Reihenfolge: Rohfolgen-Weg (09-3) → Kanal aus „Abos:“ (13-1) → tonDerKanalWege (13-schreiben) → Prüfung (13-5). */
function baue(titles: Title[], releases: Release[], jwNein: (t: Title, s: StreamLink) => boolean = () => false): string[] {
  tonDerKanalWege(titles, releases, jwNein)
  return deutschNurAusSpracheTermin(releases, new Map(titles.map((t) => [t.id, t])))
}

/* 166240 Hashira Training: zwei Prime-Termine „Sprache offen“, Crunchyroll Ja. */
const hashiraTermine = [termin(166240, 'offen'), termin(166240, 'offen')]
{
  const prime = rohWeg(166240, 'B0CYGQ9WSF', DE, { kanal: 'Crunchyroll' })
  pruefe('Kulisse: rohDeutsch setzt das Ja an die Kanal-Seite', prime.dub === true)
  const t = titel(166240, [cr(), prime])
  const widerspruch = baue([t], hashiraTermine)
  pruefe('166240 Rohmeldung an Kanal Crunchyroll: kein „deutsch", kein Widerspruch', prime.dub === undefined && widerspruch.length === 0, { prime, widerspruch })
  pruefe('166240: der Crunchyroll-Weg behält sein Ja', t.streams[0]!.dub === true)
}
{
  const prime = rohWeg(166240, 'B0CYGQ9WSF', ['Japanisch'], { kanal: 'Crunchyroll' })
  const widerspruch = baue([titel(166240, [cr(), prime])], hashiraTermine)
  pruefe('166240 ohne Rohmeldungs-Ja: das Erbe von Crunchyroll fällt gegen den Termin', prime.dub === undefined && prime.dubRanges === undefined && widerspruch.length === 0, prime)
  pruefe('166240: ein genommenes Erbe steht nicht mehr unter den geerbten Wegen', !geerbteWege.has(prime))
}
{
  const prime = rohWeg(166240, 'B0CYGQ9WSF', DE)
  const links = [bezug('Netflix', 'B0NETFLIX1'), bezug('Amazon Prime (Crunchyroll)', 'B0CYGQ9WSF'), bezug('Amazon Prime (Aniverse)', 'B0ANDERE01')]
  const widerspruch = baue([titel(166240, [cr(), prime], links)], hashiraTermine)
  pruefe('166240 ohne `kanal` am Weg: der Bezugsweg „Amazon Prime (Crunchyroll)“ auf derselben Seite macht ihn zum Kanal-Weg', prime.dub === undefined && widerspruch.length === 0, prime)
}

/* 145139 Swordsmith Village: Kanal Aniverse (erbt nie), das Ja kommt nur aus der Rohmeldung. */
{
  const prime = rohWeg(145139, 'B0FD7YTKWK', DE)
  const t = titel(145139, [prime], [bezug('Amazon Prime (Aniverse)', 'B0FD7YTKWK')])
  const widerspruch = baue([t], [termin(145139, 'offen')])
  pruefe('145139 Rohmeldung an Kanal Aniverse: kein „deutsch", kein Widerspruch', prime.dub === undefined && widerspruch.length === 0, { prime, widerspruch })
}

/* Gegenproben. */
{
  const prime = rohWeg(7, 'B0EIGENE01', DE)
  const links = [bezug('Amazon Prime (Crunchyroll)', 'B0ANDERE01'), bezug('Amazon Prime', 'B0EIGENE01'), bezug('Amazon Prime (Crunchyroll)', 'B0EIGENE01', 'buy')]
  const widerspruch = baue([titel(7, [prime], links)], [termin(7, 'offen')])
  pruefe('Weg mit Meldung ohne Kanal bleibt Ja — die Prüfung zeigt den Widerspruch', prime.dub === true && widerspruch.length === 1, { prime, widerspruch })
}
{
  const prime = rohWeg(8, 'B0EIGENE02', DE)
  const widerspruch = baue([titel(8, [prime])], [termin(8, 'omu')])
  pruefe('OmU-Termin an einem Nicht-Kanal-Weg gilt weiter (Prüfung meldet)', prime.dub === true && widerspruch.length === 1, widerspruch)
}
{
  const prime = rohWeg(166240, 'B0CYGQ9WSF', DE, { kanal: 'Crunchyroll' })
  const checks = [
    { anilistId: 166240, platform: 'primevideo', dub: false },
    { anilistId: 166240, platform: 'primevideo', dub: true },
    { anilistId: 9, platform: 'primevideo', dub: true },
  ] as DubCheck[]
  const n = nimmKanalJaGegenSprachTermin([titel(166240, [cr(), prime])], hashiraTermine, checks)
  pruefe('Hand-Ja gilt weiter (mittlerer von drei Belegen)', prime.dub === true && n === 0, prime)
  const nein = rohWeg(166240, 'B0CYGQ9WSF', DE, { kanal: 'Crunchyroll' })
  nimmKanalJaGegenSprachTermin([titel(166240, [nein])], hashiraTermine, [checks[0]!, checks[2]!])
  pruefe('Ein Hand-Nein oder ein Hand-Ja eines anderen Titels schützt nichts', nein.dub === undefined, nein)
  const ander = rohWeg(166240, 'B0CYGQ9WSF', DE, { kanal: 'Crunchyroll' })
  const adresse = [{ anilistId: 166240, platform: 'primevideo', url: seite('B0HG7S7624'), dub: true }] as DubCheck[]
  nimmKanalJaGegenSprachTermin([titel(166240, [ander])], hashiraTermine, adresse)
  pruefe('Ein Hand-Ja an einer anderen Adresse desselben Titels schützt nichts (166240, B0HG7S7624)', ander.dub === undefined, ander)
  const kanalBeleg = [{ anilistId: 166240, platform: 'primevideo', url: seite('B0CYGQ9WSF'), dub: true, kanalOhneBeleg: true }] as DubCheck[]
  const ohneBeleg = rohWeg(166240, 'B0CYGQ9WSF', DE, { kanal: 'Crunchyroll' })
  nimmKanalJaGegenSprachTermin([titel(166240, [ohneBeleg])], hashiraTermine, kanalBeleg)
  pruefe('Ein Kanal-Titel-Beleg (kanalOhneBeleg) ist kein Hand-Ja', ohneBeleg.dub === undefined, ohneBeleg)
  const ganz = [{ anilistId: 166240, platform: 'primevideo', dub: true }] as DubCheck[]
  const ohneUrl = rohWeg(166240, 'B0CYGQ9WSF', DE, { kanal: 'Crunchyroll' })
  nimmKanalJaGegenSprachTermin([titel(166240, [ohneUrl])], hashiraTermine, ganz)
  pruefe('Ein Hand-Ja ohne Adresse schützt den Anbieter des Titels', ohneUrl.dub === true, ohneUrl)
}
{
  const prime = rohWeg(10, 'B0ZEHN0001', DE, { kanal: 'Crunchyroll' })
  nimmKanalJaGegenSprachTermin([titel(10, [prime])], [termin(10), termin(10, 'offen')], [])
  pruefe('Ein Termin ohne Kennzeichnung lässt das Kanal-Ja stehen', prime.dub === true)
  const anderer = rohWeg(11, 'B0ELF00001', DE, { kanal: 'Crunchyroll' })
  nimmKanalJaGegenSprachTermin([titel(11, [anderer])], [termin(11, 'offen', 'netflix')], [])
  pruefe('Gekennzeichnete Termine eines anderen Anbieters lassen das Kanal-Ja stehen', anderer.dub === true)
  const nein = { platform: 'primevideo', url: seite('B0ZWOELF01'), kanal: 'Crunchyroll', dub: false } as StreamLink
  nimmKanalJaGegenSprachTermin([titel(12, [nein])], [termin(12, 'offen')], [])
  pruefe('Ein Nein bleibt Nein', nein.dub === false)
}
{
  /* Mehrere Titel: die betroffenen in der Mitte und hinten, keiner vorn; im mittleren zwei Kanal-Wege, keiner davon am Ende der Liste. */
  const vorn = rohWeg(20, 'B0ZWANZIG1', DE, { kanal: 'Crunchyroll' })
  const mitte = rohWeg(166240, 'B0CYGQ9WSF', DE, { kanal: 'Crunchyroll' })
  const hinten = rohWeg(145139, 'B0FD7YTKWK', DE, { kanal: 'Aniverse' })
  const zweiter = rohWeg(166240, 'B0ANIVERS1', DE, { kanal: 'Aniverse' })
  const netflix = { platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true } as StreamLink
  const titles = [titel(20, [vorn]), titel(166240, [cr(), mitte, zweiter, netflix]), titel(145139, [hinten])]
  const n = nimmKanalJaGegenSprachTermin(titles, [termin(20), ...hashiraTermine, termin(145139, 'offen')], [])
  pruefe('Mehrere Titel: alle drei betroffenen Wege, die übrigen bleiben', n === 3 && mitte.dub === undefined && zweiter.dub === undefined && netflix.dub === true && hinten.dub === undefined && vorn.dub === true, { n, vorn, mitte, hinten })
}
{
  /* Der Bau reicht die echten Handbelege durch: der letzte Prime-Hand-Ja mit Adresse aus `data/dub-confirmed.yaml` schützt den Weg an dieser Adresse, nicht den Nachbarn. */
  const hand = ladeHandbelege().filter((c) => c.platform === 'primevideo' && c.dub === true && !c.kanalOhneBeleg && c.url).at(-1)!
  const prime = rohWeg(hand.anilistId, 'B0HANDJA01', DE, { kanal: 'Crunchyroll', url: hand.url })
  const nachbar = rohWeg(hand.anilistId, 'B0HANDJA02', DE, { kanal: 'Crunchyroll' })
  tonDerKanalWege([titel(hand.anilistId, [prime, nachbar])], [termin(hand.anilistId, 'offen')], () => false)
  pruefe('tonDerKanalWege nimmt die Handbelege des Baus (Hand-Ja bleibt an seiner Adresse, der Nachbarweg fällt)', prime.dub === true && nachbar.dub === undefined, { hand, prime, nachbar })
}
{
  const prime = rohWeg(13, 'B0DREIZEHN', ['Japanisch'], { kanal: 'Crunchyroll' })
  tonDerKanalWege([titel(13, [cr(), prime])], [], () => false)
  pruefe('tonDerKanalWege vererbt weiter, wo kein Termin spricht', prime.dub === true && geerbteWege.has(prime), prime)
}
{
  /* JustWatchs „ohne de“ an der Kanal-Seite schlägt das Erbe (main, 16.10.2026); `tonDerKanalWege` reicht `jwNein` durch. Der gemessene Titel in der Mitte. */
  const wege = [900030, 900031, 900032].map((id) => rohWeg(id, `B0JW${id}`, ['Japanisch'], { kanal: 'Crunchyroll' }))
  const jwNein = (t: Title, s: StreamLink) => t.id === 900031 && s.url === seite('B0JW900031')
  const widerspruch = baue(
    wege.map((w, i) => titel(900030 + i, [cr(), w])),
    [termin(900030), termin(900031), termin(900032)],
    jwNein,
  )
  pruefe('JW „ohne de“ an der Seite, Termine ungekennzeichnet: der Weg erbt nicht, die Nachbarn schon', wege[1]!.dub === undefined && wege[0]!.dub === true && wege[2]!.dub === true && widerspruch.length === 0, wege)
  const gekennzeichnet = rohWeg(900031, 'B0JW900031', ['Japanisch'], { kanal: 'Crunchyroll' })
  const zweiter = baue([titel(900031, [cr(), gekennzeichnet])], [termin(900031, 'offen')], jwNein)
  pruefe('JW „ohne de“ und gekennzeichnete Termine: kein Ja, kein Widerspruch', gekennzeichnet.dub === undefined && zweiter.length === 0, { gekennzeichnet, zweiter })
}
{
  /* Ein entfernter Kanal-Weg zählt für die Prüfung mit (sie sieht `entferntAm` nicht): sein Ja fällt ebenso. */
  const entfernt = rohWeg(900033, 'B0ENTFERNT', DE, { kanal: 'Crunchyroll', entferntAm: '2026-10-01' } as Partial<StreamLink>)
  const widerspruch = baue([titel(900033, [cr(), entfernt])], [termin(900033, 'offen')])
  pruefe('Entfernter Kanal-Weg mit Ja gegen gekennzeichnete Termine: genommen, kein Widerspruch', entfernt.dub === undefined && widerspruch.length === 0, { entfernt, widerspruch })
}

/* Die Verdrahtung im Bau: eine eigene Anweisung in `schreibeDatensatz`, nach dem Anreichern, vor der Auslieferung, mit genau diesen Argumenten. */
const quelle = ts.createSourceFile('13-schreiben.ts', readFileSync(new URL('./bau/13-schreiben.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
const funktion = quelle.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'schreibeDatensatz')
const anweisungen = [...(funktion?.body?.statements ?? [])].map((s) => s.getText(quelle))
const stelle = (muster: RegExp) => anweisungen.findIndex((t) => muster.test(t))
const aufruf = anweisungen.indexOf('tonDerKanalWege(allTitles, releases, jwNeinAnSeite())')
pruefe('13-schreiben ruft tonDerKanalWege(allTitles, releases, jwNeinAnSeite()) als eigene Anweisung', aufruf >= 0, anweisungen)
pruefe('… nach dem Anreichern', aufruf > stelle(/schreibeSynopsenUndReichereAn\(/) && stelle(/schreibeSynopsenUndReichereAn\(/) >= 0)
pruefe('… vor der Auslieferung', aufruf < stelle(/baueAuslieferung\(/))
pruefe('… genau einmal, und das Erbe läuft nur dort', anweisungen.filter((t) => /tonDerKanalWege|kanalErbtVomAnbieter|nimmKanalJa/.test(t)).length === 1)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('check-kanal-ja-sprach-termin: ok')
