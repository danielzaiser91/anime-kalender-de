/**
 * Zusicherung: **Eine Staffelzählung für Kachel-Marke, Widerlegung/Katalog (`staffelDesTitels`) und Disc-Verschiebung (`staffelNummer`)**: Spin-offs
 * (`eigenesWerk`) zählen in keinem mit (Daniel, 04.11.2026; PR 2748 hat das Panel umgestellt). Fall: Konosuba, Namen und Starttage wörtlich aus
 * `franchises.json` (03.11.2026) — „An Explosion“ stand als Staffel 3 neben der echten Staffel 3. Dazu die Markierung (`markiereReihenteile`) und der
 * Spin-off-Verdacht. Der Bestandsteil (alle Titel, Pipeline gegen Marke) steht in `check-staffelzaehlung-bestand.ts`. Läuft in `check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { anzeigeName } from '../shared/titles.ts'
import { staffelStandVon, zaehleHauptstaffeln } from '../shared/staffel-zaehlung.ts'
import { staffelMarken } from '../web/src/lib/db-staffel-marke.ts'
import type { KatalogEintrag } from './lib/anilist.ts'
import { markiereCartoonReihenteile, markiereReihenteile, markiereReihenteileAusQuellen } from './bau/reihenteil-markierung.ts'
import { staffelDesTitels } from './bau/widerlegung-staffel.ts'
import { reihenIndex, staffelNummer } from './lib/disc-verschiebungen-staffel.ts'
import { bewerteAbweichung, handlisteOhneMarkierung } from './lib/staffelzaehlung-abweichung.ts'
import { spinoffVerdacht, spinoffVerdachtZeile } from './lib/spinoff-verdacht.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const OHNE_REMAKE = { kanten: [], hand: [] }
const titel = (id: number, name: string, jpStart: string, mehr: Partial<Title> = {}): Title =>
  ({ id, titleEn: name, format: 'TV', jpYear: Number(jpStart.slice(0, 4)), jpStart, episodes: 12, franchiseId: 21202, streams: [], ...mehr }) as unknown as Title
const kopie = (liste: Title[]): Title[] => JSON.parse(JSON.stringify(liste)) as Title[]

const KONOSUBA_NAME = 'Konosuba: God’s Blessing on This Wonderful World!'
const KONOSUBA = (): Title[] => [
  titel(21202, KONOSUBA_NAME, '2016-01-14', { episodes: 10 }),
  titel(21699, 'KonoSuba: God’s Blessing on This Wonderful World! 2', '2017-01-12', { episodes: 10 }),
  titel(150075, 'Konosuba: An Explosion on This Wonderful World!', '2023-04-06'),
  titel(136804, 'KonoSuba: God’s Blessing on This Wonderful World! 3', '2024-04-10', { episodes: 11 }),
  titel(187924, 'KonoSuba: God’s Blessing on This Wonderful World! Season 4', '2027', { episodes: undefined }),
]
const EXPLOSION = 150075
const STAFFEL_3 = 136804
const ELTERN = new Map<number, number[]>([[EXPLOSION, [21202]]])
const markiert = (): Title[] => {
  const reihe = KONOSUBA()
  markiereReihenteile(new Map(reihe.map((t) => [t.id, t])), ELTERN, new Set([EXPLOSION]))
  return reihe
}
const nummern = (reihe: Title[]) => Object.fromEntries(reihe.map((t) => [t.id, staffelDesTitels(t, reihe, OHNE_REMAKE) ?? null]))
const discNummern = (reihe: Title[]) => Object.fromEntries(reihe.map((t) => [t.id, staffelNummer(t, reihenIndex(reihe), OHNE_REMAKE) ?? null]))
const markenNummern = (reihe: Title[]) =>
  Object.fromEntries(reihe.map((t) => [t.id, /^Staffel (\d+)$/.exec(staffelMarken(reihe).get(t.id) ?? '')?.[1] ?? null]).map(([id, n]) => [id, n === null ? null : Number(n)]))

console.log('\nMarkierung (markiereReihenteile):')
{
  const reihe = [titel(1, 'Hauptserie', '2010-01-01'), titel(2, 'Hauptserie Extra', '2011-01-01'), titel(3, 'Fremde Serie', '2012-01-01', { franchiseId: 99 }), titel(4, 'Ohne Reihe', '2013-01-01', { franchiseId: undefined })]
  const eltern = new Map<number, number[]>([[2, [1]], [3, [1]], [4, [1]]])
  const z = markiereReihenteile(new Map(reihe.map((t) => [t.id, t])), eltern, new Set([1, 4]))
  pruefe('Elternkante auf einen Teil derselben Reihe: Beiwerk', reihe[1]!.beiwerk === true)
  pruefe('Elternkante auf eine fremde Reihe: kein Beiwerk', reihe[2]!.beiwerk === undefined)
  pruefe('Titel ohne Reihe bleibt unmarkiert, auch in der Handliste', reihe[3]!.beiwerk === undefined && reihe[3]!.eigenesWerk === undefined)
  pruefe('Handliste: eigenes Werk', reihe[0]!.eigenesWerk === true && reihe[1]!.eigenesWerk === undefined)
  pruefe('Zähler: 1 Beiwerk, 1 eigenes Werk', z.beiwerk === 1 && z.eigenesWerk === 1, z)
  const zweiter = markiereReihenteile(new Map(reihe.map((t) => [t.id, t])), eltern, new Set([1, 4]))
  pruefe('Zweiter Lauf ändert nichts', zweiter.beiwerk === 1 && zweiter.eigenesWerk === 1, zweiter)
  pruefe('Ohne Elternkanten und Handliste bleibt alles unmarkiert', markiereReihenteile(new Map([[9, titel(9, 'Allein', '2020-01-01')]]), new Map(), new Set()).beiwerk === 0)
}

console.log('\nKonosuba: alle drei Zähler lassen das Spin-off aus:')
{
  const reihe = markiert()
  const erwartet = { 21202: 1, 21699: 2, [EXPLOSION]: null, [STAFFEL_3]: 3, 187924: 4 }
  pruefe('staffelDesTitels (Widerlegung, Katalog)', JSON.stringify(nummern(reihe)) === JSON.stringify(erwartet), nummern(reihe))
  pruefe('staffelNummer (Disc-Verschiebung; Staffel 4 ohne Folgenzahl zählt dort nie)', JSON.stringify(discNummern(reihe)) === JSON.stringify({ ...erwartet, 187924: null }), discNummern(reihe))
  pruefe('Kachel-Marke (staffelMarken) nennt dieselben Nummern', JSON.stringify(markenNummern(reihe)) === JSON.stringify(erwartet), markenNummern(reihe))
  const ohne = kopie(KONOSUBA())
  pruefe('Kontrolle: ohne Markierung zählt das Spin-off als Staffel 3 und die echte Staffel 3 als 4', nummern(ohne)[EXPLOSION] === 3 && nummern(ohne)[STAFFEL_3] === 4, nummern(ohne))
}

console.log('\nBeiwerk-ONA zählt nicht mit (hauptstaffeln):')
{
  const reihe = [titel(1, 'Serie', '2020-01-01'), titel(2, 'Serie 2', '2021-01-01'), titel(3, 'Serie Gaiden', '2021-06-01', { format: 'ONA', episodes: 12 }), titel(4, 'Serie 3', '2022-01-01')]
  markiereReihenteile(new Map(reihe.map((t) => [t.id, t])), new Map([[3, [1]]]), new Set())
  pruefe('Das Beiwerk-ONA hat keine Nummer, Staffel 3 bleibt 3', nummern(reihe)[3] === null && nummern(reihe)[4] === 3, nummern(reihe))
  const letztes = [titel(1, 'Serie', '2020-01-01'), titel(2, 'Serie 2', '2021-01-01'), titel(3, 'Serie Gaiden', '2022-01-01', { format: 'ONA', episodes: 12 })]
  markiereReihenteile(new Map(letztes.map((t) => [t.id, t])), new Map([[3, [1]]]), new Set())
  pruefe('Disc: das letzte Beiwerk-ONA bekommt keine Nummer, Staffel 2 bleibt 2', discNummern(letztes)[3] === null && discNummern(letztes)[2] === 2, discNummern(letztes))
}

console.log('\nSpin-off-Verdacht:')
{
  const reihe = [
    titel(1, 'Welt', '2010-01-01'),
    titel(2, 'Welt Season 2', '2011-01-01'),
    titel(3, 'Welt: Nebenschauplatz', '2012-01-01'),
    titel(4, 'Welt Season 3', '2013-01-01'),
    titel(5, 'Welt: Eigenes Werk', '2014-01-01'),
    titel(6, 'Welt: Ohne Eltern', '2015-01-01'),
  ]
  markiereReihenteile(new Map(reihe.map((t) => [t.id, t])), new Map([[3, [1]], [4, [1]], [5, [1]]]), new Set([5]))
  const verdacht = spinoffVerdacht(reihe).map((t) => t.id)
  pruefe('Beiwerk-Serie mit eigenem Namen steht im Verdacht, nicht die mit Staffelnummer, nicht das eigene Werk, nicht die ohne Elternkante', JSON.stringify(verdacht) === '[3]', verdacht)
  const zeile = spinoffVerdachtZeile(spinoffVerdacht(reihe))
  pruefe('Eine Warnzeile mit Marke und Anzahl', zeile.length === 1 && zeile[0]!.includes('⚠ WARNUNG') && zeile[0]!.includes('1 Titel') && zeile[0]!.includes('Welt: Nebenschauplatz (3)'), zeile)
  pruefe('Ohne Verdacht keine Zeile', spinoffVerdachtZeile([]).length === 0)
  pruefe('Reihe ohne Beiwerk: kein Verdacht', spinoffVerdacht(kopie(KONOSUBA())).length === 0)
  pruefe('Konosuba markiert: das Handlisten-Spin-off ist aus dem Verdacht', spinoffVerdacht(markiert()).length === 0)
  const nurBeiwerk = KONOSUBA()
  markiereReihenteile(new Map(nurBeiwerk.map((t) => [t.id, t])), ELTERN, new Set())
  pruefe('Konosuba ohne Handliste: „An Explosion“ steht im Verdacht', spinoffVerdacht(nurBeiwerk).map((t) => t.id).join() === String(EXPLOSION))
}

console.log('\nMarkierung aus den Quellen des Baus (markiereReihenteileAusQuellen):')
{
  const reihe = [titel(900101, 'Quelle', '2020-01-01', { franchiseId: 900101 }), titel(900102, 'Quelle Extra', '2021-01-01', { franchiseId: 900101 })]
  const katalog = (): KatalogEintrag[] => [{ id: 900102, eltern: [900101] }, { id: 900101 }] as unknown as KatalogEintrag[]
  markiereReihenteileAusQuellen(new Map(reihe.map((t) => [t.id, t])), katalog)
  pruefe('Die Elternkante aus dem übergebenen Katalog markiert das Beiwerk, der Elternteil bleibt unmarkiert', reihe[1]!.beiwerk === true && reihe[0]!.beiwerk === undefined, reihe.map((t) => t.beiwerk))
}

{
  const reihe = [titel(900201, 'Kaputt', '2020-01-01', { franchiseId: 900201 }), titel(900202, 'Kaputt Extra', '2021-01-01', { franchiseId: 900201 })]
  const kaputt = (): KatalogEintrag[] => {
    throw new Error('Katalog kaputt')
  }
  let geworfen = false
  try {
    markiereReihenteileAusQuellen(new Map(reihe.map((t) => [t.id, t])), kaputt)
  } catch {
    geworfen = true
  }
  pruefe('Ein unlesbarer Katalog stoppt die Markierung nicht (nur ohne Beiwerk)', !geworfen && reihe[1]!.beiwerk === undefined)
}

console.log('\nAbweichung bewerten (Pipeline gegen Marke):')
{
  const FIRE_FORCE = (): Title[] => [
    titel(105310, 'Fire Force', '2019-07-06', { titleDe: 'Fire Force', franchiseId: 105310, episodes: 24 }),
    titel(114236, 'Fire Force Staffel 2', '2020-07-03', { titleDe: 'Fire Force Staffel 2', franchiseId: 105310, episodes: 24 }),
    titel(128390, 'Fire Force Staffel 2 Miniepisoden', '2021', { titleDe: 'Fire Force Staffel 2 Miniepisoden', format: 'ONA', franchiseId: 105310, episodes: 30 }),
    titel(149118, 'Fire Force: Staffel 3', '2025-07-04', { titleDe: 'Fire Force: Staffel 3', franchiseId: 105310, episodes: 12 }),
    titel(179062, 'Fire Force: Staffel 3 (Cour 2)', '2026-01-01', { titleDe: 'Fire Force: Staffel 3 (Cour 2)', franchiseId: 105310, episodes: 13 }),
  ]
  const ff = FIRE_FORCE()
  const mini = ff[2]!
  pruefe('Gleiche Nummern: gleich', bewerteAbweichung(ff[0]!, ff, 1, 1, OHNE_REMAKE) === 'gleich')
  pruefe('Beide ohne Nummer: gleich', bewerteAbweichung(ff[0]!, ff, undefined, undefined, OHNE_REMAKE) === 'gleich')
  pruefe('Fire Force ohne Beiwerk-Markierung: die Miniepisoden sind Teil 1 von Staffel 3, die Pipeline nennt keine Nummer, die Marke „Staffel 3“', bewerteAbweichung(mini, ff, undefined, 3, OHNE_REMAKE) === 'teil')
  pruefe('Gegenfall: Staffel 2 mit abweichender Nummer ist unerklärt', bewerteAbweichung(ff[1]!, ff, 2, 3, OHNE_REMAKE) === 'unerklaert')
  const mitRemake = { kanten: [], hand: [{ remake: 149118, original: 105310, grund: 'Test', quelle: 'https://example.org/' }] }
  pruefe('Reihe mit Neuverfilmung: abweichende Nummer ist erklärt', bewerteAbweichung(ff[1]!, ff, 2, 3, mitRemake) === 'neuverfilmung')
  pruefe('Gleiche Nummer in einer Reihe mit Neuverfilmung: gleich', bewerteAbweichung(ff[1]!, ff, 2, 2, mitRemake) === 'gleich')
  const konosuba = markiert()
  pruefe('Konosuba (kein Teil, keine Neuverfilmung): abweichende Nummer ist unerklärt', bewerteAbweichung(konosuba[3]!, konosuba, 3, 4, OHNE_REMAKE) === 'unerklaert')
  const vorher = nummern(ff)[114236]
  markiereReihenteile(new Map(ff.map((t) => [t.id, t])), new Map([[128390, [114236]]]), new Set())
  pruefe('Fire Force mit Beiwerk-Markierung: die Miniepisoden haben keine Nummer, Staffel 2 bleibt 2 in Pipeline und Marke', vorher === 2 && nummern(ff)[128390] === null && nummern(ff)[114236] === 2 && markenNummern(ff)[114236] === 2, [nummern(ff), markenNummern(ff)])
  pruefe('Fire Force mit Beiwerk-Markierung: Staffel 3 ist Teil 1 von 2, keine Nummer in Pipeline und Marke', nummern(ff)[149118] === null && markenNummern(ff)[149118] === null, [nummern(ff), markenNummern(ff)])
  pruefe('Disc: Fire Force Staffel 3 ist Teil 1 von 2, keine Nummer; Staffel 2 bleibt 2', discNummern(ff)[149118] === null && discNummern(ff)[114236] === 2, discNummern(ff))
}

console.log('\nCartoons (Avatar-Reihe wörtlich aus cartoons.json, markiereCartoonReihenteile mit den echten Handlisten):')
{
  const avatar = (): Title[] => [
    titel(-284833, 'Avatar: Seven Havens', '2026-10-09', { titleDe: 'Avatar - Die sieben Häfen', episodes: 13, franchiseId: -284833 }),
    titel(-33880, 'The Legend of Korra', '2012-04-14', { titleDe: 'Die Legende von Korra', episodes: 52, franchiseId: -284833 }),
    titel(-246, 'Avatar: The Last Airbender', '2005-02-21', { titleDe: 'Avatar - Der Herr der Elemente', episodes: 61, franchiseId: -284833 }),
  ]
  const vorher = staffelMarken(avatar())
  pruefe('Kontrolle: ohne Markierung nennt die Marke Korra „Staffel 2“ und die sieben Häfen „Staffel 3“', vorher.get(-33880) === 'Staffel 2' && vorher.get(-284833) === 'Staffel 3', [...vorher])
  const reihe = avatar()
  markiereCartoonReihenteile(reihe)
  const marken = staffelMarken(reihe)
  pruefe('Nach dem Bau: Korra und die sieben Häfen sind eigene Werke, keine Marke', reihe[0]!.eigenesWerk === true && reihe[1]!.eigenesWerk === true && reihe[2]!.eigenesWerk === undefined && !marken.has(-33880) && !marken.has(-284833), [...marken])
  const fremd = [titel(-9, 'Andere Serie', '2000-01-01', { franchiseId: undefined }), titel(-10, 'Andere Serie 2', '2001-01-01', { franchiseId: -9 })]
  markiereCartoonReihenteile(fremd, new Set([-9, -10]))
  pruefe('Cartoon ohne Reihe bleibt unmarkiert, einer mit Reihe aus der Liste wird markiert', fremd[0]!.eigenesWerk === undefined && fremd[1]!.eigenesWerk === true)
}

console.log('\nHandliste ⇒ eigenesWerk (handlisteOhneMarkierung, Bestandswächter):')
{
  const reihe = [titel(1, 'Markiert', '2010-01-01', { eigenesWerk: true }), titel(2, 'Unmarkiert', '2011-01-01'), titel(3, 'Ohne Reihe', '2012-01-01', { franchiseId: undefined }), titel(4, 'Nicht in der Liste', '2013-01-01')]
  pruefe('Nur der Titel in der Liste, mit Reihe und ohne Markierung steht im Befund', JSON.stringify(handlisteOhneMarkierung(reihe, new Set([1, 2, 3]))) === '[2]', handlisteOhneMarkierung(reihe, new Set([1, 2, 3])))
  pruefe('Leere Liste: kein Befund', handlisteOhneMarkierung(reihe, new Set()).length === 0)
}

console.log('\nGrenzfälle der einen Zählung (Disc-Nummer, Reihe ohne Hauptstaffel, Kürzung der Warnzeile):')
{
  const luecke = [titel(1, 'Serie', '2010-01-01', { franchiseId: 1 }), titel(2, 'Serie Season 3', '2012-01-01', { franchiseId: 1 })]
  pruefe('Disc: Position 2, das Panel zählt „Staffel 3“ — die Nummern widersprechen sich, keine Nummer', discNummern(luecke)[2] === null && discNummern(luecke)[1] === 1, discNummern(luecke))
  pruefe('Kontrolle: die Marke nennt für dieselbe Lücke „Staffel 3“', markenNummern(luecke)[2] === 3, markenNummern(luecke))
  const filme = [titel(940071, 'Allein: Der Film', '2020-01-01', { format: 'MOVIE', franchiseId: 940071 }), titel(940072, 'Allein: Der zweite Film', '2021-01-01', { format: 'MOVIE', franchiseId: 940071 })]
  const alsTeile = filme.map((t) => ({ ...t, name: anzeigeName(t) }))
  const leer = zaehleHauptstaffeln(alsTeile)
  pruefe('Reihe nur aus Filmen: keine Hauptstaffel, kein Reihenname, keine Nummer (und kein Absturz)', leer.teile.length === 0 && leer.reihenName === '' && leer.staende.size === 0, leer)
  pruefe('Reihe nur aus Filmen: staffelStandVon ist leer', staffelStandVon(alsTeile, 940071) === undefined)
  pruefe('Reihe nur aus Filmen: Widerlegung, Disc und Marke nennen keine Nummer', nummern(filme)[940071] === null && discNummern(filme)[940071] === null && staffelMarken(filme).size === 0)
  const viele = Array.from({ length: 6 }, (_, i) => titel(940080 + i, `Neben ${i}`, `201${i}-01-01`, { franchiseId: 940080 }))
  const sechs = spinoffVerdachtZeile(viele)[0]!
  pruefe('Sechs Verdachtsfälle: die ersten fünf stehen in der Zeile, danach „ …“', sechs.includes('Neben 4 (940084)') && !sechs.includes('Neben 5') && sechs.endsWith('(940084) …'), sechs)
  const fuenf = spinoffVerdachtZeile(viele.slice(0, 5))[0]!
  pruefe('Genau fünf Verdachtsfälle: alle stehen da, keine Kürzung', fuenf.includes('Neben 4') && !fuenf.endsWith('…'), fuenf)
  pruefe('zeigeBis 2 bei drei Fällen: zwei Namen und „ …“', spinoffVerdachtZeile(viele.slice(0, 3), 2)[0]!.endsWith('(940081) …'))
}

if (verletzt) {
  console.error(`\ncheck-staffelzaehlung: ${verletzt} von ${faelle} Zusicherungen verletzt.`)
  process.exit(1)
}
console.log(`\ncheck-staffelzaehlung: ${faelle} Zusicherungen, 0 verletzt`)
