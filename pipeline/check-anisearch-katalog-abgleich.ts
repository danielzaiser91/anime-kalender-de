/**
 * Zusicherungen zum Katalog-Abgleich AniList → aniSearch (11.10.2026): Urteilsregeln und die geschriebene Zuordnung `data/anisearch-ids-katalog.json`.
 * Dazu die Zahl der eingehängten Katalogtitel und, dass daneben keine eigene aniSearch-Zeile derselben Kennung bleibt. Läuft in `check:logic`.
 */
import { existsSync, readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'
import { FORMAT, ergaenzeAnisearchTitel } from './bau/anisearch-titel.ts'
import { zeileZuTitel } from './fetch-anisearch-katalog-abgleich.ts'
import {
  type AsEintrag,
  type AsTitel,
  type KatalogTitel,
  doppelteEntschaerfen,
  kandidaten,
  normalisiere,
  urteile,
  wortIndex,
  type Urteil,
} from './lib/anisearch-katalog-abgleich.ts'
import { gemeinsamerNamensteil, vergleicheLaenge, vergleicheTag } from './lib/anisearch-katalog-merkmale.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const titel = (id: number, jahr: number, ...namen: string[]): AsTitel => ({ id, jahr, namen })
const katalog = (id: number, name: string, jahr: number | null, format: string | null, extra: Partial<KatalogTitel> = {}): KatalogTitel => ({
  id,
  namen: [name],
  jahr,
  format,
  folgen: null,
  ...extra,
})

function urteil(k: KatalogTitel, liste: AsTitel[], eintraege: Record<string, AsEintrag>, gesperrt = new Set<number>(), heuteJahr = 2026): Urteil {
  const karte = new Map(liste.map((t) => [t.id, t]))
  return urteile(k, kandidaten(k, karte, wortIndex(liste), gesperrt), karte, eintraege, (ty) => (ty ? FORMAT[ty] : undefined), heuteJahr)
}

pruefe('normalisiere: Akzente, Satzzeichen, Groß-/Kleinschreibung fallen weg', normalisiere('Pokémon: The Movie!') === 'pokemonthemovie')
pruefe('normalisiere: Kanji bleiben erhalten', normalisiere('鋼の錬金術師') === '鋼の錬金術師')

const zeile = zeileZuTitel('7', { year: 2003, main: 'Hagane no Renkinjutsushi', en: 'Fullmetal Alchemist', synonyms: { xx: ['FMA'] }, 'ja-kanji': '鋼の錬金術師' })
pruefe('zeileZuTitel: Jahr getrennt, alle Schreibweisen samt Synonymen', zeile.jahr === 2003 && zeile.namen.length === 4 && zeile.namen.includes('FMA'), JSON.stringify(zeile))

const bigO = titel(1022, 1999, 'The Big O')
const nachfolger = titel(9000, 2003, 'The Big O')
const fma = [titel(10, 2003, 'Fullmetal Alchemist'), titel(11, 2009, 'Fullmetal Alchemist: Brotherhood')]

const sicher = urteil(katalog(567, 'THE Big O', 1999, 'TV'), [bigO, nachfolger], { 1022: { ty: 'TV-Serie', y: 1999, f: 13 }, 9000: { ty: 'TV-Serie', y: 2003, f: 13 } })
pruefe('sicher: gleicher Name, Jahr, Format; das Remake mit gleichem Namen und anderem Jahr stört nicht', sicher.art === 'sicher' && sicher.asId === 1022, JSON.stringify(sicher))

const malTreffer = urteil(katalog(1, 'Ganz anderer Name', 2001, 'TV', { mal: 99 }), [titel(5, 2001, 'Ganz anderer Name hier')], { 5: { ty: 'TV-Serie', y: 2001, mal: 99 } })
pruefe('sicher: dieselbe MAL-Kennung genügt', malTreffer.art === 'sicher' && malTreffer.asId === 5)

const malZweimal = urteil(katalog(1, 'Ganz anderer Name', 2001, 'TV', { mal: 99 }), [titel(5, 2001, 'Ganz anderer Name hier'), titel(6, 2001, 'Ganz anderer Name dort')], { 5: { ty: 'TV-Serie', y: 2001, mal: 99 }, 6: { ty: 'TV-Serie', y: 2001, mal: 99 } })
pruefe('unsicher: dieselbe MAL-Kennung bei zwei aniSearch-Einträgen', malZweimal.art === 'unsicher' && /2 aniSearch/.test(malZweimal.weil), JSON.stringify(malZweimal))

const malZweimalJahr = urteil(katalog(1, 'Ganz anderer Name', 2001, 'TV', { mal: 99, malAsIds: [5, 6] }), [titel(5, 2001, 'Ganz anderer Name hier'), titel(6, 2015, 'Ganz anderer Name dort')], { 5: { ty: 'TV-Serie', y: 2001, mal: 99 }, 6: { ty: 'TV-Serie', y: 2015, mal: 99 } })
pruefe('sicher: dieselbe MAL-Kennung bei zwei Einträgen, nur einer passt im Jahr', malZweimalJahr.art === 'sicher' && malZweimalJahr.asId === 5, JSON.stringify(malZweimalJahr))

const jahrDanebenBeiZwei = urteil(katalog(2, 'Fullmetal Alchemist', 2005, 'TV'), fma, { 10: { ty: 'TV-Serie', y: 2003 }, 11: { ty: 'TV-Serie', y: 2009 } })
pruefe('unsicher: Jahr zwei daneben (2003 gegen 2005)', jahrDanebenBeiZwei.art === 'unsicher', JSON.stringify(jahrDanebenBeiZwei))
pruefe('sicher: Jahr genau eins daneben', urteil(katalog(2, 'Fullmetal Alchemist', 2004, 'TV'), fma, { 10: { ty: 'TV-Serie', y: 2003 } }).art === 'sicher')

const filmGegenSerie = urteil(katalog(3, 'Fullmetal Alchemist', 2003, 'MOVIE'), fma, { 10: { ty: 'TV-Serie', y: 2003 } })
pruefe('unsicher: Film gegen Serie, mit Grund', filmGegenSerie.art === 'unsicher' && /Format/.test(filmGegenSerie.weil), JSON.stringify(filmGegenSerie))

const malAbweichend = urteil(katalog(4, 'Fullmetal Alchemist', 2003, 'TV', { mal: 121 }), [fma[0]!], { 10: { ty: 'TV-Serie', y: 2003, mal: 5114 } })
pruefe('widerlegt: abweichende MAL-Kennung ist ein anderes Werk', malAbweichend.art === 'widerlegt' && /MAL/.test(malAbweichend.weil), JSON.stringify(malAbweichend))

const folgen = urteil(katalog(5, 'Fullmetal Alchemist', 2003, 'TV', { folgen: 51 }), fma, { 10: { ty: 'TV-Serie', y: 2003, f: 13 } })
pruefe('unsicher: widersprüchliche Folgenzahl', folgen.art === 'unsicher' && /Folgen/.test(folgen.weil))

const zwei = urteil(katalog(6, 'Hana', 2010, 'TV'), [titel(20, 2010, 'Hana'), titel(21, 2010, 'Hana')], { 20: { ty: 'TV-Serie', y: 2010 }, 21: { ty: 'TV-Serie', y: 2010 } })
pruefe('unsicher: zwei gleichwertige Kandidaten entscheidet das Skript nicht', zwei.art === 'unsicher' && /gleichwertig/.test(zwei.weil))

/* Tag, Länge, Namensteil (11.10.2026) */
pruefe('vergleicheTag: nur ganze Tage zählen', vergleicheTag('2026-08-02', '2026-08-02') === 'gleich' && vergleicheTag('2026-08-02', '2026-08-03') === 'anders' && vergleicheTag('2018-06', '2018-06-01') === 'offen' && vergleicheTag('2029-00-00', '2029-00-00') === 'offen')
pruefe('vergleicheLaenge: gleich, ab zehn Minuten eine daneben, sonst anders', vergleicheLaenge(7, 7) === 'gleich' && vergleicheLaenge(16, 15) === 'gleich' && vergleicheLaenge(1, 2) === 'anders' && vergleicheLaenge(7, undefined) === 'offen')
pruefe('gemeinsamerNamensteil: „Cosmos in the Lostbelt" in beiden, kurze Zufallsteile nicht', gemeinsamerNamensteil(['Fate/Grand Order: 11th Anniversary Movie -Cosmos in the Lostbelt-'], ['Fate/Grand Order: Cosmos in the Lostbelt']) && !gemeinsamerNamensteil(['Naruto Movie'], ['Bleach Movie']))

const fgo = katalog(1, 'Fate/Grand Order: 11th Anniversary Movie -Cosmos in the Lostbelt-', 2026, 'SPECIAL', { folgen: 1, start: '2026-08-02', dauer: 7 })
const fgoListe = [titel(5, 2026, 'Fate/Grand Order: Cosmos in the Lostbelt')]
const fgoUrteil = urteil(fgo, fgoListe, { 5: { ty: 'Web', y: 2026, f: 1, min: 7, von: '2026-08-02' } })
pruefe('sicher: gleicher Starttag, gleiche Länge, gemeinsamer Namensteil trotz Format Web gegen Special', fgoUrteil.art === 'sicher' && /Starttag/.test(fgoUrteil.weil), JSON.stringify(fgoUrteil))
pruefe('unsicher: anderer Starttag bei gleicher Länge ist noch keine Widerlegung', urteil(fgo, fgoListe, { 5: { ty: 'Web', y: 2026, f: 1, min: 7, von: '2026-08-03' } }).art === 'unsicher')

const maeumui = katalog(2, 'Maeumuisori', 2016, 'TV', { folgen: 26, start: '2016-07-19', dauer: 21 })
const maeumuiUrteil = urteil(maeumui, [titel(6, 2016, 'Maeumui Sori')], { 6: { ty: 'TV-Serie', y: 2016, f: 78, min: 7, von: '2016-07-19' } })
pruefe('sicher: 26 × 21 Minuten gegen 78 × 7 am selben Starttag', maeumuiUrteil.art === 'sicher' && /Gesamtlaufzeit/.test(maeumuiUrteil.weil), JSON.stringify(maeumuiUrteil))

const benibara = urteil(katalog(3, 'Benibara Shirobara', 1976, 'MOVIE', { folgen: 1, dauer: 35 }), [titel(7, 0, 'Beni Bara Shiro Bara')], { 7: { ty: 'OVA', y: 0, f: 1, min: 35 } })
pruefe('sicher: gleicher Name, Länge, Folgenzahl, aniSearch ohne Jahr (Format OVA gegen Film stört nicht)', benibara.art === 'sicher' && /Jahr fehlt/.test(benibara.weil), JSON.stringify(benibara))

const boo = katalog(4, 'BOO', 2033, 'MOVIE', { folgen: 1 })
pruefe('sicher: gleicher Name, beide Jahre Platzhalter (2033, 2029 bei Stand 2026)', urteil(boo, [titel(8, 2029, 'Boo')], { 8: { ty: 'Film', y: 2029, f: 1 } }).art === 'sicher')
pruefe('unsicher: dieselben Jahre sind 2031 keine Platzhalter mehr', urteil(boo, [titel(8, 2029, 'Boo')], { 8: { ty: 'Film', y: 2029, f: 1 } }, new Set(), 2031).art === 'unsicher')

const hoozuki = katalog(5, 'Hoozuki OVA Alpha', 2015, 'OVA', { mal: 5, malAsIds: [10, 11], folgen: 4 })
const hoozukiListe = [titel(10, 2014, 'Hoozuki OVA Alpha Eins'), titel(11, 2017, 'Hoozuki OVA Alpha Zwei')]
const teile = { 10: { ty: 'OVA', y: 2014, f: 3, mal: 5, von: '2014-12-06' }, 11: { ty: 'OVA', y: 2017, f: 1, mal: 5, von: '2017-03-23' } }
const teilung = urteil(hoozuki, hoozukiListe, teile)
pruefe('sicher: Teilung — 3 + 1 Folgen mit derselben MAL-Kennung ergeben 4, der erste Teil bekommt die Kennung', teilung.art === 'sicher' && teilung.asId === 10 && /Teilung/.test(teilung.weil), JSON.stringify(teilung))
pruefe('unsicher: ergeben die Teile nicht die AniList-Zahl, bleibt es bei der MAL-Mehrdeutigkeit', urteil({ ...hoozuki, folgen: 5 }, hoozukiListe, teile).art === 'unsicher')

const anderesDatum = katalog(6, 'Shinsengumi', 2000, 'MOVIE', { folgen: 1, start: '2000-01-15', dauer: 86 })
const widerlegt = urteil(anderesDatum, [titel(12, 1999, 'Shinsengumi')], { 12: { ty: 'Anderes', y: 1999, f: 1, min: 4, von: '1999-07-20' } })
pruefe('widerlegt: anderer Starttag und andere Länge', widerlegt.art === 'widerlegt' && /Starttag/.test(widerlegt.weil), JSON.stringify(widerlegt))

pruefe('keiner: kein Kandidat', urteil(katalog(7, 'Völlig unbekanntes Werk', 2010, 'TV'), fma, {}).art === 'keiner')
pruefe('keiner: einziger Kandidat ist schon vergeben', urteil(katalog(8, 'Fullmetal Alchemist', 2003, 'TV'), [fma[0]!], { 10: { ty: 'TV-Serie', y: 2003 } }, new Set([10])).art === 'keiner')

const doppelt = new Map<number, Urteil>([
  [1, { art: 'sicher', asId: 5, weil: 'x' }],
  [2, { art: 'sicher', asId: 5, weil: 'x' }],
  [3, { art: 'sicher', asId: 6, weil: 'x' }],
])
pruefe('doppelteEntschaerfen: zwei Titel, eine Kennung → beide unsicher, der dritte bleibt', doppelteEntschaerfen(doppelt) === 2 && doppelt.get(1)!.art === 'unsicher' && doppelt.get(2)!.art === 'unsicher' && doppelt.get(3)!.art === 'sicher')

if (existsSync('data/anisearch-ids-katalog.json')) {
  const datei = JSON.parse(readFileSync('data/anisearch-ids-katalog.json', 'utf8')) as Record<string, number>
  const eintraege = Object.entries(datei)
  const hand = new Set([...readFileSync('data/anisearch-ids-hand.yaml', 'utf8').matchAll(/^(\d+):/gm)].map((m) => m[1]))
  pruefe('Datei: jede aniSearch-Kennung höchstens einmal', new Set(Object.values(datei)).size === eintraege.length)
  pruefe('Datei: nur AniList-Kennungen, keine eigene aniSearch-Zeile', eintraege.every(([al]) => Number(al) < 10_000_000))
  pruefe('Datei: nichts, was die Handdatei schon bindet', eintraege.every(([al]) => !hand.has(al)))
}

/* Eingehängt (11.10.2026): 66 sichere Treffer des Abgleichs und 30 von Hand gesichtete, dazu 13 geklärte Paare der Prüfliste (Merkmale Tag, Länge, Namensteil); der Bau liest sie wie die Handdatei. */
const KATALOG_EINGEHAENGT = 109
const geprueft = JSON.parse(readFileSync('data/anisearch-katalog-kein-treffer.json', 'utf8')) as Record<string, number[]>
const gebunden = JSON.parse(readFileSync('data/anisearch-ids-katalog.json', 'utf8')) as Record<string, number>
const bruecke = Object.values(JSON.parse(readFileSync('data/anisearch.json', 'utf8')) as Record<string, { anisearchId?: number }>).map((e) => e.anisearchId)
const handKennungen = [...readFileSync('data/anisearch-ids-hand.yaml', 'utf8').matchAll(/^\d+:\s*(\d+)/gm)].map((m) => Number(m[1]))
pruefe(`Katalog: mindestens ${KATALOG_EINGEHAENGT} Titel mit aniSearch-Kennung eingehängt`, Object.keys(gebunden).length >= KATALOG_EINGEHAENGT, String(Object.keys(gebunden).length))
const schonVergeben = new Set([...handKennungen, ...bruecke])
pruefe('Katalog: keine aniSearch-Kennung doppelt vergeben, auch nicht an Handdatei oder Brücke', new Set(Object.values(gebunden)).size === Object.keys(gebunden).length && Object.values(gebunden).every((as) => !schonVergeben.has(as)))
pruefe('Katalog: ein gesichtetes „kein Treffer" ist nie zugleich gebunden', Object.entries(geprueft).every(([al, as]) => !as.includes(gebunden[al] ?? -1)))
pruefe('Katalog: „kein Treffer" nennt nur AniList-Titel ohne Kennung und ganze aniSearch-Kennungen', Object.entries(geprueft).every(([al, as]) => !(al in gebunden) && Number(al) < 10_000_000 && as.length > 0 && as.every(Number.isInteger)))

/* Keine Dublette: steht der AniList-Titel im Bestand, entfällt die aniSearch-Zeile mit derselben Kennung (Bau: `ergaenzeAnisearchTitel`). */
const mitAnilist = new Map<number, Title>(Object.keys(gebunden).map((al) => [Number(al), { id: Number(al), streams: [] } as unknown as Title]))
ergaenzeAnisearchTitel(mitAnilist, new Map(), new Map())
const bleibt = Object.values(gebunden).filter((as) => mitAnilist.has(10_000_000 + as))
pruefe('Katalog: keine Dublette — zu jeder eingehängten Kennung bleibt keine eigene aniSearch-Zeile neben dem AniList-Titel', bleibt.length === 0, bleibt.join(','))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-anisearch-katalog-abgleich: ok')
