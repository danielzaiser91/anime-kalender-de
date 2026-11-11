/**
 * Staffel des Titels bei JustWatch (11.11.2026): Bei Serien mit mehreren Staffeln gilt ein Angebot, wenn eine Staffel es führt, die der Titel sein kann.
 * Die Staffel ist bestimmt, wenn die Staffelnummer des Titels in seiner Reihe (`staffelDesTitels`) bei JustWatch dieselbe Folgenzahl trägt (Goblin Slayer,
 * Last Exile); sonst genügt jede, denn leere Sonderstaffeln und Lücken der Staffelliste widerlegen nichts (Naruto, FLCL, Cardcaptor Sakura,
 * Captain Tsubasa, M.A.S.K.; Prüfer 3463). Die Staffelformen der Anlassfälle sind aus data/justwatch-audio.json (Stand 11.11.2026) abgeschrieben:
 * Folgenzahlen wörtlich, Angebote auf den strittigen Anbieter verkürzt. Die Verdrahtung im Bau prüft `check-kanal-nach-begrenzung.ts`.
 *
 * Aufruf: `npx tsx pipeline/check-staffel-des-titels.ts`
 */
import { mitStaffelTreffer } from './bau/11-2-5-wege-nach-begrenzung.ts'
import { moeglicheStaffeln, staffelFuehrt } from './lib/jw-staffel-des-titels.ts'
import type { Title } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const cr = { anbieter: 'Crunchyroll', art: 'FLATRATE', url: 'https://www.crunchyroll.com/watch/GAAA/folge-eins' }
const crAndereAdresse = { anbieter: 'Crunchyroll', art: 'FLATRATE', url: 'https://www.crunchyroll.com/watch/GBBB/folge-zwei' }
const kanal = { anbieter: 'Crunchyroll Amazon Channel', art: 'FLATRATE', url: 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.kanal' }
const staffeln = (...folgen: [number, object[]][]) => folgen.map(([f, a], i) => ({ nr: i + 1, folgen: f, angebote: a as never }))
const titel = (id: number, episodes?: number, franchiseId?: number, jpYear?: number): Title =>
  ({ id, episodes, franchiseId, jpYear, format: 'TV', titleEn: `Serie ${franchiseId}` }) as unknown as Title
const tabelle = (...t: Title[]) => new Map(t.map((x) => [x.id, x] as const))

console.log('\nmoeglicheStaffeln (reine Funktion, feste Werte):')
const drei = { staffeln: staffeln([12, [cr]], [24, []], [12, [kanal]]) }
pruefe('Nummer und Folgenzahl passen zu einer Staffel: genau diese', moeglicheStaffeln(drei, 24, 2).length === 1 && moeglicheStaffeln(drei, 24, 2)[0].nr === 2)
pruefe('Nummer 3 mit 12 Folgen: Staffel 3, nicht die erste mit 12', moeglicheStaffeln(drei, 12, 3)[0].nr === 3)
pruefe('Nummer passt, Folgenzahl nicht (Cardcaptor Sakura 70): alle', moeglicheStaffeln(drei, 70, 1).length === 3)
pruefe('Folgenzahl passt zu einer anderen Staffel als die Nummer: alle', moeglicheStaffeln(drei, 24, 1).length === 3)
pruefe('keine Nummer (Cour, einzige Staffel): alle', moeglicheStaffeln(drei, 12, undefined).length === 3)
pruefe('Folgenzahl fehlt (M.A.S.K.): alle', moeglicheStaffeln(drei, undefined, 1).length === 3 && moeglicheStaffeln(drei, 0, 1).length === 3)
pruefe('keine Staffelliste: leer', moeglicheStaffeln({}, 12, 1).length === 0)

console.log('\nstaffelFuehrt:')
pruefe('dieselbe Adresse', staffelFuehrt({ angebote: [cr] }, cr))
pruefe('andere Adresse beim selben Anbieter zählt (Crunchyroll hat je Staffel eine eigene)', staffelFuehrt({ angebote: [crAndereAdresse] }, cr))
pruefe('anderer Anbieter, andere Adresse: nein (Kanal gegen Crunchyroll)', !staffelFuehrt({ angebote: [cr] }, kanal))
pruefe('Staffel ohne Angebote: nein', !staffelFuehrt({}, cr))
pruefe('dieselbe Adresse unter anderem Anbieternamen zählt', staffelFuehrt({ angebote: [{ anbieter: 'Alpha Name', url: 'https://a.example/x' }] }, { anbieter: 'Beta Name', url: 'https://a.example/x' }))
pruefe('Anbieter ohne Namen und andere Adresse: nein', !staffelFuehrt({ angebote: [{ anbieter: '', url: 'https://a.example/1' }] }, { anbieter: '', url: 'https://a.example/2' }))
pruefe('unbekannter Anbieter mit anderer Adresse: nein', !staffelFuehrt({ angebote: [{ anbieter: 'Zzz Unbekannt Eins', url: 'https://a.example/1' }] }, { anbieter: 'Zzz Unbekannt Zwei', url: 'https://a.example/2' }))

console.log('\nmitStaffelTreffer (echte Staffelformen der Anlassfälle):')
const rtl = { anbieter: 'RTL+', art: 'FLATRATE', url: 'https://plus.rtl.de/video-tv/serien/naruto-740021' }
const aniverse = { anbieter: 'Aniverse Amazon Channel', art: 'FLATRATE', url: 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.aniverse' }
const adn = { anbieter: 'Animation Digital Network', art: 'FLATRATE', url: 'https://animationdigitalnetwork.com/video/cardcaptor' }
const jw = {
  /* Naruto: Staffel 1 und 5 mit 220 Folgen, Rtl+ unter 1 bis 4, Staffel 6 (4 Folgen) leer. */
  20: { angebote: [rtl], staffeln: staffeln([220, [rtl]], [104, [rtl]], [108, [rtl]], [124, [rtl]], [220, []], [4, []]) },
  /* FLCL: drei Staffeln mit 6 Folgen führen Crunchyroll, zwei mit 3 Folgen sind leer. */
  227: { angebote: [cr], staffeln: staffeln([6, [cr]], [6, [crAndereAdresse]], [6, [cr]], [3, []], [3, []]) },
  /* Cardcaptor Sakura: 70 Folgen treffen keine Staffel (45/33/48/23), Staffel 4 ist leer. */
  232: { angebote: [adn], staffeln: staffeln([45, [adn]], [33, [adn]], [48, [adn]], [23, []]) },
  /* M.A.S.K.: Aniverse nur unter Staffel 1 (65 Folgen), Staffel 2 (10 Folgen) leer, der Titel kennt keine Folgenzahl. */
  5000003: { angebote: [aniverse], staffeln: staffeln([65, [aniverse]], [10, []]) },
  /* Goblin Slayer und Folge: beide 12 Folgen, Aniverse nur unter Staffel 2. */
  101165: { angebote: [aniverse], staffeln: staffeln([12, []], [12, [aniverse]]) },
  101166: { angebote: [aniverse], staffeln: staffeln([12, []], [12, [aniverse]]) },
  /* Chaika: 12 Folgen, Staffel 1 mit Crunchyroll, Staffel 2 (11 Folgen) ohne. */
  20462: { angebote: [cr], staffeln: staffeln([12, [cr]], [11, []]) },
  /* Last Exile und Folge: 26 Folgen = Staffel 1 ohne Crunchyroll, Staffel 2 (23) mit. */
  97: { angebote: [cr], staffeln: staffeln([26, []], [23, [cr]]) },
  98: { angebote: [cr], staffeln: staffeln([26, []], [23, [cr]]) },
}
const titles = tabelle(titel(20, 220, 1, 2002), titel(227, 6, 2, 2000), titel(232, 70, 3, 1998), titel(5000003, undefined, 4), titel(101165, 12, 5, 2018), titel(101166, 12, 5, 2023), titel(20462, 12, 6, 2014), titel(97, 26, 7, 2003), titel(98, 23, 7, 2008))
const aus = mitStaffelTreffer(jw as never, titles)
const namen = (id: number) => (aus[String(id)].angebote ?? []).map((a) => a.anbieter).join(',')
pruefe('Naruto: Rtl+ bleibt (Staffel 6 mit 4 Folgen leer, zwei Staffeln mit 220)', namen(20) === 'RTL+', namen(20))
pruefe('FLCL: Crunchyroll bleibt (zwei Staffeln mit 3 Folgen leer)', namen(227) === 'Crunchyroll', namen(227))
pruefe('Cardcaptor Sakura: ADN bleibt (70 Folgen treffen keine Staffel, Staffel 4 leer)', namen(232) === 'Animation Digital Network', namen(232))
pruefe('M.A.S.K.: Aniverse bleibt (Staffel 2 leer, keine Folgenzahl)', namen(5000003) === 'Aniverse Amazon Channel', namen(5000003))
pruefe('Goblin Slayer: Aniverse fällt (Staffel 1 der Reihe hat 12 Folgen und keinen Kanal)', namen(101165) === '', namen(101165))
pruefe('Goblin Slayer II: Aniverse bleibt (Staffel 2 führt ihn)', namen(101166) === 'Aniverse Amazon Channel', namen(101166))
pruefe('Chaika: Crunchyroll bleibt (Staffel 1 führt es)', namen(20462) === 'Crunchyroll', namen(20462))
pruefe('Last Exile: Crunchyroll fällt (Staffel 1 der Reihe mit 26 Folgen ohne)', namen(97) === '', namen(97))
pruefe('Last Exile Folge: Crunchyroll bleibt (Staffel 2 mit 23 Folgen)', namen(98) === 'Crunchyroll', namen(98))

console.log('\nmitStaffelTreffer (Randfälle):')
const kauf = { anbieter: 'Amazon Video', art: 'BUY', url: 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.kauf' }
const leihe = { anbieter: 'Apple TV', art: 'RENT', url: 'https://tv.apple.com/de/show/x' }
const gesamtOnlyAbo = { anbieter: 'Joyn', art: 'FLATRATE', url: 'https://www.joyn.de/serien/x' }
const ausKauf = mitStaffelTreffer({ 1: { angebote: [kauf, leihe, gesamtOnlyAbo], staffeln: staffeln([12, []], [24, []]) } } as never, tabelle(titel(1, 12, 9)))
pruefe('Kauf und Leihe stehen nie unter einer Staffel: sie bleiben, das Abo nur im Gesamtfeld fällt', (ausKauf['1'].angebote ?? []).map((a) => a.anbieter).join(',') === 'Amazon Video,Apple TV', ausKauf['1'].angebote)
const eine = mitStaffelTreffer({ 1: { angebote: [kanal], staffeln: staffeln([12, []]) } } as never, tabelle(titel(1, 12, 9)))
pruefe('eine Staffel: das Gesamtfeld bleibt unverändert', (eine['1'].angebote ?? []).length === 1)
const ausGundam = mitStaffelTreffer({ 1: { angebote: [cr, kanal], staffeln: staffeln([25, [cr]], [25, [crAndereAdresse]]) } } as never, tabelle(titel(1, 25, 9, 2007)))
pruefe('Crunchyroll unter je eigener Adresse in beiden Staffeln (Gundam 00): bleibt, der Kanal ohne Staffel fällt', (ausGundam['1'].angebote ?? []).map((a) => a.anbieter).join(',') === 'Crunchyroll', ausGundam['1'].angebote)
const ohneTitel = mitStaffelTreffer({ 7: { angebote: [cr], staffeln: staffeln([12, []], [24, [cr]]) } } as never, new Map())
pruefe('Titel nicht im Bestand: jede Staffel genügt', (ohneTitel['7'].angebote ?? []).length === 1)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
