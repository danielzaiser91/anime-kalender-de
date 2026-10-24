/**
 * Cartoons im Zuordner der Rohfolgen (F20, 16.10.2026): Zusicherungen an einer Kulisse, nicht am Bestand.
 *
 * Ursache des Anlasses: `fetch-rohfolgen.ts` las nur `titles.json`; 950 Cartoon-Adressen mit 12.456 Folgen blieben „kein Titel zu
 * dieser Adresse", wurden nie abgehakt und kamen bei jedem Bau erneut aus der D1.
 */
import { readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'
import { hatDeutschenTon } from '../shared/sprachen-ton.ts'
import {
  animeZugehoerigkeit,
  handbelegAdressen,
  type HandbelegAdressen,
  ordneCartoonsZu,
  type CartoonFolgenDatei,
  type CartoonRohfolge,
} from './lib/rohfolgen-cartoons.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const NETFLIX = 'https://www.netflix.com/title/70234440'
const cartoon = (id: number, url: string, name: string, platform = 'netflix'): Title =>
  ({ id, titleDe: name, streams: [{ platform, url }] }) as unknown as Title
const pony = cartoon(-100, NETFLIX, 'Testpony')
const ohneListe = cartoon(-200, 'https://www.netflix.com/title/200', 'Ohne Liste')
const zweiter = cartoon(-300, NETFLIX, 'Zweiter Testpony')
const anime = { id: 5, titleDe: 'Ein Anime', streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/500' }] } as unknown as Title

/** Zwei Staffeln zu je drei Folgen, durchgezählt 1–6. */
const listen: CartoonFolgenDatei = {
  '-100': {
    folgen: [
      { s: 1, e: 1, en: 'Sisters Take Flight' },
      { s: 1, e: 2, en: 'A Home to Share' },
      { s: 1, e: 3, en: 'Zipp Gets Her Wings' },
      { s: 2, e: 1, de: 'Der Ausflug zum Leuchtturm' },
      { s: 2, e: 2, de: 'Hitch und das Geheimnis' },
      { s: 2, e: 3, de: 'Das große Finale' },
    ],
  },
}

let nummer = 0
const zeile = (url: string, titel: string | null, sprachen = '["Deutsch"]', titelId: number | null = null): CartoonRohfolge => ({
  id: ++nummer,
  url,
  asin: null,
  titel,
  sprachen,
  plattform: 'netflix',
  titel_id: titelId,
})
const gruppen = (liste: CartoonRohfolge[]) => new Map([[liste[0]!.url + '#0', liste]])
const lauf = (liste: CartoonRohfolge[], cartoons: Title[] = [pony, ohneListe], belege: HandbelegAdressen = new Map()) =>
  ordneCartoonsZu(gruppen(liste), cartoons, belege, listen, animeZugehoerigkeit([anime]))

console.log('Cartoon-Zuordner')
{
  const staffel2 = ['DER AUSFLUG ZUM LEUCHTTURM', 'Hitch und das Geheimnis', 'das große finale'].map((t) => zeile(NETFLIX, t))
  const r = lauf(staffel2)
  const folgen = Object.values(r.zugeordnet)[0]?.folgen.map((f) => f.unsere)
  pruefe('Staffel 2 eines Cartoons landet auf Folge 4–6 der durchgezählten Liste', JSON.stringify(folgen) === '[4,5,6]', folgen)
  pruefe('die zugeordnete Adresse wird abgehakt', r.erledigt.length === 3, r.erledigt)
  pruefe('der Cartoon trägt seine negative Kennung', Object.values(r.zugeordnet)[0]?.titleId === -100)
}
{
  const lang = Array.from({ length: 26 }, (_, i) => zeile('https://www.netflix.com/title/200', `Folge ${i + 1}`))
  const r = lauf(lang)
  const z = Object.values(r.zugeordnet)[0]
  pruefe('ohne Folgenliste gilt der Beleg dem Titel, nicht einer Folge', z?.folgen.length === 1 && z.folgen[0]!.unsere === null)
  pruefe('und alle 26 Zeilen sind erledigt (kein erneutes Lesen)', r.erledigt.length === 26 && r.uebrig.size === 0, r.erledigt.length)
}
{
  const gemischt = [zeile('https://www.netflix.com/title/200', 'a', '["Deutsch"]'), zeile('https://www.netflix.com/title/200', 'b', '["Englisch"]')]
  const r = lauf(gemischt)
  pruefe('uneinheitliche Tonspuren ohne Folgentreffer bleiben mit Grund offen', r.offen.length === 1 && /uneinheitlich/.test(r.offen[0]!.grund), r.offen)
  pruefe('und werden nicht abgehakt', r.erledigt.length === 0)
}
{
  const r = lauf([zeile(NETFLIX, 'x'), zeile(NETFLIX, 'y')], [pony, zweiter])
  pruefe('zwei Cartoons an einer Adresse: offen mit benanntem Grund', r.offen[0]?.grund === '2 Titel teilen diese Adresse', r.offen)
  pruefe('und nichts zugeordnet', Object.keys(r.zugeordnet).length === 0)
}
{
  const r = lauf([zeile('https://www.netflix.com/title/500', 'x'), zeile('https://www.netflix.com/title/500', 'y')], [pony, anime])
  pruefe('eine Adresse, die ein Anime führt, geht an den Anime-Weg', r.uebrig.size === 1 && !r.offen.length && !r.erledigt.length)
}
{
  const r = lauf([zeile('https://www.netflix.com/title/999', 'x'), zeile('https://www.netflix.com/title/999', 'y')])
  pruefe('eine unbekannte Adresse geht unberührt weiter', r.uebrig.size === 1 && !r.offen.length)
}
{
  const r = lauf([zeile('https://www.netflix.com/title/999', 'x'), zeile('https://www.netflix.com/title/999', 'y')], [pony])
  const mitKennung = lauf([zeile('https://www.netflix.com/title/999', 'x', '["Deutsch"]', -100), zeile('https://www.netflix.com/title/999', 'y', '["Deutsch"]', -100)])
  pruefe('die gemeldete Cartoon-Kennung findet den Titel auch ohne Verweis', Object.values(mitKennung.zugeordnet)[0]?.titleId === -100 && r.uebrig.size === 1)
}
{
  const ein = lauf([zeile(NETFLIX, 'Der Ausflug zum Leuchtturm')])
  const f = Object.values(ein.zugeordnet)[0]?.folgen
  pruefe('eine einzelne Zeile belegt den Titel', f?.length === 1 && f[0]!.unsere === null, f)
}
{
  const doppelt = cartoon(-400, 'https://www.netflix.com/title/400', 'Doppelt')
  const dl: CartoonFolgenDatei = {
    '-400': {
      folgen: [
        { s: 1, e: 1, en: 'Gleicher Name' },
        { s: 1, e: 2, en: 'Gleicher Name' },
      ],
    },
  }
  const url = 'https://www.netflix.com/title/400'
  const r = ordneCartoonsZu(gruppen([zeile(url, 'Gleicher Name'), zeile(url, 'Anders')]), [doppelt], new Map(), dl, () => false)
  const f = Object.values(r.zugeordnet)[0]?.folgen
  pruefe('ein Folgentitel, der zwei Folgen trifft, wird nicht geraten', f?.length === 1 && f[0]!.unsere === null, f)
}
const anbieter: [string, string, string][] = [
  ['Prime', 'https://www.amazon.de/dp/B0CH6KQBJR', 'primevideo'],
  ['Disney+', 'https://www.disneyplus.com/de-de/series/x/abc', 'disney'],
  ['Netflix', NETFLIX, 'netflix'],
]
for (const [name, url, plattform] of anbieter) {
  const c = cartoon(-500, url, 'Für alle Anbieter', plattform)
  const r = ordneCartoonsZu(gruppen([zeile(url, 'a'), zeile(url, 'b')]), [c], new Map(), {}, animeZugehoerigkeit([anime]))
  pruefe(`Cartoon-Adressen von ${name} werden zugeordnet`, Object.values(r.zugeordnet)[0]?.titleId === -500 && r.erledigt.length === 2)
}

const DISNEY = 'https://www.disneyplus.com/browse/entity-c752c178-c507-4c43-a73f-b6b64abf06d9'
const AMAZON = 'https://www.amazon.de/dp/B0CP7P8QCY'
const belege = handbelegAdressen([
  { anilistId: -46848, title: 'Angry Birds Toons', url: DISNEY, dub: false },
  { anilistId: -46848, title: 'Angry Birds Toons', url: DISNEY, dub: false },
  { anilistId: 106479, title: 'Abwehrspezialisierung', url: 'https://www.amazon.de/gp/video/detail/B0CP7P8QCY' },
  { anilistId: 20540, title: 'Eins', url: 'https://www.amazon.de/dp/B0B7D1XZJY', dub: true },
  { anilistId: 20944, title: 'Zwei', url: 'https://www.amazon.de/gp/video/detail/B0B7D1XZJY', dub: true },
])
{
  const rest = [zeile(DISNEY, 'Chuck Time', '["en"]'), zeile(DISNEY, 'Treasure Hunt', '["en"]'), zeile(DISNEY, 'Royal Heist', '["en", "fr"]')]
  const r = lauf(rest, [], belege)
  pruefe('Handbeleg-Adresse ohne Verweis im Bestand gehört dem Titel des Handbelegs', Object.values(r.zugeordnet)[0]?.titleId === -46848, r.offen)
  pruefe('Folgen ohne deutschen Ton gelten als erledigt', r.erledigt.length === 3 && !r.offen.length)
}
{
  const r = lauf([zeile(DISNEY, 'x', '["en"]'), zeile(DISNEY, 'y', '["de", "Deutsch"]')], [], belege)
  pruefe('ein Handbeleg „kein Deutsch“ deckt keine Zeile mit deutschem Ton zu', r.offen.length === 1 && r.erledigt.length === 0, r.offen)
  pruefe('der Rest-Eintrag nennt den Serientitel', r.offen[0]?.titel === 'Angry Birds Toons', r.offen[0]?.titel)
}
{
  const r = lauf([zeile(AMAZON, 'Abwehr 1'), zeile(AMAZON, 'Abwehr 2')], [], belege)
  pruefe('Amazon-Adressen finden den Handbeleg über /dp/ und /gp/video/detail/', Object.values(r.zugeordnet)[0]?.titleId === 106479 && r.erledigt.length === 2)
}
{
  const u = 'https://www.amazon.de/gp/video/detail/B0B7D1XZJY'
  const r = lauf([zeile(u, 'x'), zeile(u, 'y')], [], belege)
  pruefe('zwei Titel im Handbeleg: offen mit benanntem Grund', r.offen[0]?.grund === '2 Titel teilen diese Adresse' && !r.erledigt.length, r.offen)
  pruefe('ohne Serienname zeigt der Rest-Eintrag den Folgentitel als „Folge: …“', r.offen[0]?.titel === 'Folge: x', r.offen[0]?.titel)
  const mit = lauf([{ ...zeile(u, 'x'), serientitel: 'Die Serie' }, zeile(u, 'y')], [], belege)
  pruefe('mit Serienname zeigt er die Serie', mit.offen[0]?.titel === 'Die Serie', mit.offen[0]?.titel)
}
{
  const r = lauf([zeile(AMAZON, 'a', '["en"]'), zeile(AMAZON, 'b', '["fr"]')], [], belege)
  pruefe('ohne „kein Deutsch“ im Handbeleg bleiben uneinheitliche Tonspuren offen', r.offen.length === 1 && !r.erledigt.length, r.offen)
  const u = 'https://www.disneyplus.com/browse/entity-gemischt'
  const gemischt = handbelegAdressen([
    { anilistId: -777, title: 'Gemischt', url: u, dub: false },
    { anilistId: -777, title: 'Gemischt', url: u, dub: true },
  ])
  const g = lauf([zeile(u, 'a', '["en"]'), zeile(u, 'b', '["fr"]')], [], gemischt)
  pruefe('ein Handbeleg mit Ja und Nein zur Adresse gilt nicht als „kein Deutsch“', g.offen.length === 1 && !g.erledigt.length, g.offen)
}
/* Je Anbieter das Format, das der Erzeuger schreibt: Prime `amazon-leser.js` (Namen), Netflix `melder.js` (`code|name`), Disney+ `disney-leser.js` (Codes). */
const formate: [string, string, string, string][] = [
  ['Prime', 'primevideo', '["Deutsch","日本語"]', '["English"]'],
  ['Netflix', 'netflix', '["de|Deutsch","en|English"]', '["en|English"]'],
  ['Disney+', 'disneyplus', '["de","en"]', '["en","fr"]'],
]
for (const [name, plattform, mitDeutsch, ohneDeutsch] of formate) {
  const url = `https://example.org/${plattform}/hb`
  const nein = handbelegAdressen([{ anilistId: -900, title: 'Nein-Beleg', url, dub: false }])
  const mit = lauf([zeile(url, 'a', mitDeutsch), zeile(url, 'b', mitDeutsch)], [], nein)
  pruefe(`${name}: Handbeleg „kein Deutsch“ und einheitlich deutscher Ton: offen, nicht abgehakt`, mit.offen.length === 1 && !mit.erledigt.length && /Widerspruch/.test(mit.offen[0]!.grund), mit.offen)
  const gemischt = lauf([zeile(url, 'a', mitDeutsch), zeile(url, 'b', ohneDeutsch)], [], nein)
  pruefe(`${name}: Handbeleg „kein Deutsch“, eine Zeile mit deutschem Ton: offen`, gemischt.offen.length === 1 && !gemischt.erledigt.length, gemischt.offen)
  const ohne = lauf([zeile(url, 'a', ohneDeutsch), zeile(url, 'b', ohneDeutsch)], [], nein)
  pruefe(`${name}: Handbeleg „kein Deutsch“ und kein deutscher Ton: erledigt`, ohne.erledigt.length === 2 && !ohne.offen.length, ohne.offen)
  pruefe(`${name}: hatDeutschenTon erkennt die Schreibweise`, hatDeutschenTon(JSON.parse(mitDeutsch)) && !hatDeutschenTon(JSON.parse(ohneDeutsch)))
}

pruefe('hatDeutschenTon: Codes mit Region und Pipe, aber nicht „den“/„des“', hatDeutschenTon(['de-DE']) && hatDeutschenTon(['de|x']) && !hatDeutschenTon(['den', 'des', 'fr']))

const quelle = readFileSync('pipeline/fetch-rohfolgen.ts', 'utf8')
pruefe('fetch-rohfolgen.ts liest die Cartoons (public/data/cartoons.json)', quelle.includes("readJson<Title[]>('public/data/cartoons.json', [])"))
pruefe('und die Handbeleg-Adressen (data/dub-confirmed.yaml)', quelle.includes("handbelegAdressen(yaml.load(readFileSync(resolve(ROOT, 'data/dub-confirmed.yaml')"))
pruefe('und der Rest-Eintrag „kein Titel“ nennt Serie statt Folge', quelle.includes('titel: restTitel(liste),'))
pruefe('und lässt die Cartoon-Zuordnung vor dem Anime-Weg laufen', /ordneCartoonsZu\(\s*jeUrl,/.test(quelle) && quelle.includes("of teileNachNetflixStaffel(cartoonLauf.uebrig, titles, readJson('data/anbieter-staffeln.json', {})))"))
pruefe('und führt ihre Ergebnisse zusammen (zugeordnet, offen, erledigt)', quelle.includes('Object.assign(zugeordnet, cartoonLauf.zugeordnet)') && quelle.includes('offen.push(...cartoonLauf.offen)') && quelle.includes('erledigt.push(...cartoonLauf.erledigt)'))

if (fehler) {
  console.error(`FEHL: ${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
