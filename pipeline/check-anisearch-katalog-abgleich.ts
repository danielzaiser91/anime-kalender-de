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

function urteil(k: KatalogTitel, liste: AsTitel[], eintraege: Record<string, AsEintrag>, gesperrt = new Set<number>()): Urteil {
  const karte = new Map(liste.map((t) => [t.id, t]))
  return urteile(k, kandidaten(k, karte, wortIndex(liste), gesperrt), karte, eintraege, (ty) => (ty ? FORMAT[ty] : undefined))
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

const malAbweichend = urteil(katalog(4, 'Fullmetal Alchemist', 2003, 'TV', { mal: 121 }), fma, { 10: { ty: 'TV-Serie', y: 2003, mal: 5114 } })
pruefe('unsicher: abweichende MAL-Kennung', malAbweichend.art === 'unsicher' && /MAL/.test(malAbweichend.weil))

const folgen = urteil(katalog(5, 'Fullmetal Alchemist', 2003, 'TV', { folgen: 51 }), fma, { 10: { ty: 'TV-Serie', y: 2003, f: 13 } })
pruefe('unsicher: widersprüchliche Folgenzahl', folgen.art === 'unsicher' && /Folgen/.test(folgen.weil))

const zwei = urteil(katalog(6, 'Hana', 2010, 'TV'), [titel(20, 2010, 'Hana'), titel(21, 2010, 'Hana')], { 20: { ty: 'TV-Serie', y: 2010 }, 21: { ty: 'TV-Serie', y: 2010 } })
pruefe('unsicher: zwei gleichwertige Kandidaten entscheidet das Skript nicht', zwei.art === 'unsicher' && /gleichwertig/.test(zwei.weil))

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

/* Eingehängt (11.10.2026): 66 sichere Treffer des Abgleichs und 30 von Hand gesichtete; der Bau liest sie wie die Handdatei. */
const KATALOG_EINGEHAENGT = 96
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
