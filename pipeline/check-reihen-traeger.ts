/**
 * Zusicherungen zu den Reihen nach der Einzelauflistung (14.10.2026): Ein Sammeltitel, der in seine aniSearch-Seiten zerfällt (`katalogWeg`), gibt seine AniList-Beziehungen
 * an seine Zeile ab; was nur über ihn in einer Reihe hing (Aware! Meisaku-kun Ryuuguuchuu-hen, Fanren Xiu Xian Zhuan Movie), erbt die Reihe der Zeile. Alle Titel sind
 * erfunden und die Prüfung liest nur ein Archiv, das für diese Kennungen nichts enthält — sie hängt nicht vom Katalog-Cache ab. Läuft in `check:logic`.
 */
import type { Title } from '../shared/types.ts'
import type { KatalogEintrag } from './lib/anilist.ts'
import { ANISEARCH_ID_BASIS } from './bau/anisearch-titel.ts'
import { reihenFuerKatalog } from './bau/titel-hilfen.ts'
import { type Anker, erbeReihe } from './bau/anisearch-reihen-katalog.ts'
import { anilistKantenOhneKennung, anisearchKatalogReihenQuelle, reineKatalogReihen } from './bau/anisearch-reihen-rein-bau.ts'
import { anisearchKatalogReihen } from './bau/anisearch-reihen-pruefliste.ts'
import type { ReinErgebnis } from './bau/anisearch-reihen-rein.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const SAMMEL = 21727
const KIND = 182545
const WAISE = 303
const MIT_KENNUNG = 304
const EINZEL = 900
const [PAAR_A, PAAR_B] = [901, 902]
const ZEILE = ANISEARCH_ID_BASIS + 99_990_001
const ERSTE = ANISEARCH_ID_BASIS + 99_990_003

const eintrag = (id: number, rel: number[], eltern: number[] = []): KatalogEintrag => ({ id, t: [`Titel ${id}`, null, null], format: 'OVA', jahr: 2000, folgen: 1, rel, eltern }) as KatalogEintrag
const eintraege: KatalogEintrag[] = [
  eintrag(SAMMEL, [KIND, WAISE]), // der Sammeltitel kennt WAISE, WAISE kennt ihn nicht
  eintrag(KIND, [SAMMEL], [SAMMEL]),
  eintrag(WAISE, []),
  eintrag(MIT_KENNUNG, [SAMMEL]),
  eintrag(EINZEL, []),
  eintrag(PAAR_A, [PAAR_B]),
  eintrag(PAAR_B, [PAAR_A]),
]
const kennung = new Map([[SAMMEL, 99_990_001], [MIT_KENNUNG, 99_990_002]])
const anker: Anker[] = [
  { id: ERSTE, name: 'Seite 1', anisearchId: 99_990_003, reihe: ERSTE },
  { id: ZEILE, name: 'Seite 2', anisearchId: 99_990_001, reihe: ERSTE },
]
const katalogWeg = new Map([[SAMMEL, ZEILE]])
const ohneHand = { verbinden: [], trennen: [] }
/** Die beiden Seitenzeilen als ausgelieferte Titel hinter dem Schalter (das sind die Anker des Katalogs). */
const verschoben = [
  { id: ERSTE, anisearchId: 99_990_003, franchiseId: ERSTE, titleRomaji: 'Seite 1' },
  { id: ZEILE, anisearchId: 99_990_001, franchiseId: ERSTE, titleRomaji: 'Seite 2' },
] as Title[]
const weg = { katalogWeg, zeilenWeg: new Set<number>() }

console.log('Rein: AniList-Kanten des Sammeltitels gehen auf seine Zeile über')
{
  const e = reineKatalogReihen(eintraege, kennung, anker, katalogWeg, [], new Map(), ohneHand)
  const r = (id: number): number | undefined => e.reihe.get(id)
  pruefe('Ein Titel, dessen Kante auf den Sammeltitel zeigt, erbt die Reihe der Zeile', r(KIND) === ERSTE, String(r(KIND)))
  pruefe('Ein Titel, den nur der Sammeltitel nennt (Kante in seine Richtung), erbt sie ebenso', r(WAISE) === ERSTE, String(r(WAISE)))
  pruefe('Der Sammeltitel selbst ist kein Titel mehr', !e.reihe.has(SAMMEL))
  pruefe('Hat der Titel eine aniSearch-Kennung, entscheidet aniSearch, nicht die AniList-Kante zum Sammeltitel', r(MIT_KENNUNG) === MIT_KENNUNG, String(r(MIT_KENNUNG)))
  pruefe('Gegenprobe: ein Titel ohne Träger-Fall bleibt allein', r(EINZEL) === EINZEL)
  pruefe('Gegenprobe: zwei Titel ohne Träger-Fall bilden ihre Reihe wie bisher', r(PAAR_A) === PAAR_A && r(PAAR_B) === PAAR_A)
}

console.log('Rein: Kanten im Einzelnen')
{
  const kanten = anilistKantenOhneKennung(eintraege, new Set([ZEILE, ERSTE, MIT_KENNUNG]), katalogWeg)
  const hat = (a: number, b: number): boolean => kanten.some(([x, y]) => x === a && y === b)
  pruefe('Kante eines Titels zum Sammeltitel zeigt auf die Zeile', hat(KIND, ZEILE))
  pruefe('Kante des Sammeltitels geht von der Zeile aus', hat(ZEILE, KIND) && hat(ZEILE, WAISE))
  pruefe('Mit Kennung auf beiden Seiten gibt es keine Zusatzkante', !kanten.some(([x, y]) => x === MIT_KENNUNG || y === MIT_KENNUNG))
}

console.log('Aufrufer: anisearchKatalogReihenQuelle reicht katalogWeg weiter (rein)')
{
  let geschrieben: ReinErgebnis | undefined
  const vorher = process.env.REIHEN_QUELLE
  delete process.env.REIHEN_QUELLE
  const reihe = anisearchKatalogReihenQuelle(reihenFuerKatalog(eintraege, new Map()), eintraege, new Map(), verschoben, kennung, weg, (e) => { geschrieben = e })
  if (vorher !== undefined) process.env.REIHEN_QUELLE = vorher
  pruefe('Der Aufrufer liefert KIND in der Reihe der Zeile', reihe.get(KIND) === ERSTE, String(reihe.get(KIND)))
  pruefe('Der Sammeltitel steht nicht mehr in der Reihe-Zuordnung', !reihe.has(SAMMEL))
  pruefe('Die Prüfliste des reinen Wegs bekommt das Ergebnis', geschrieben?.reihe.get(KIND) === ERSTE)
}

console.log('Rückweg (REIHEN_QUELLE=anilist): erbeReihe und anisearchKatalogReihen')
{
  const reihe = new Map([[SAMMEL, SAMMEL], [KIND, SAMMEL], [WAISE, SAMMEL], [EINZEL, EINZEL]])
  const geerbt = erbeReihe(reihe, katalogWeg, anker)
  pruefe('Wer unter dem Sammeltitel hing, hängt an der Reihe der Zeile', geerbt.get(KIND) === ERSTE && geerbt.get(WAISE) === ERSTE)
  pruefe('Gegenprobe: ein Titel in einer anderen Reihe bleibt', geerbt.get(EINZEL) === EINZEL)
  pruefe('Ist die Zeile kein Anker, bleibt die Reihe, wie sie ist', erbeReihe(reihe, katalogWeg, []).get(KIND) === SAMMEL)
  pruefe('Ohne ausgeschiedenen Sammeltitel bleibt alles', erbeReihe(reihe, new Map(), anker).get(KIND) === SAMMEL)
  const gruppeMitWurzel = new Map([[SAMMEL, WAISE], [KIND, WAISE], [WAISE, WAISE]])
  pruefe('Auch wenn die Wurzel der Gruppe ein anderer Titel ist, erbt die ganze Gruppe', erbeReihe(gruppeMitWurzel, katalogWeg, anker).get(KIND) === ERSTE && erbeReihe(gruppeMitWurzel, katalogWeg, anker).get(WAISE) === ERSTE)
  const festeGruppe = new Map([[SAMMEL, 5000], [KIND, 5000]])
  const mitFremdemAnker: Anker[] = [...anker, { id: 5000, name: 'Fremd', reihe: 5000 }]
  pruefe('Gehört die Gruppe schon zu einer ausgelieferten Reihe, verschmilzt sie nicht mit der Zeile', erbeReihe(festeGruppe, katalogWeg, mitFremdemAnker).get(KIND) === 5000)

  const alt = anisearchKatalogReihen(reihenFuerKatalog(eintraege, new Map()), eintraege, new Map(), verschoben, kennung, weg, () => undefined)
  pruefe('Der Rückweg liefert KIND in der Reihe der Zeile', alt.get(KIND) === ERSTE, String(alt.get(KIND)))
  pruefe('Gegenprobe: ein Titel ohne Träger-Fall bleibt allein', alt.get(EINZEL) === EINZEL)
}

console.log(fehler ? `\nReihen nach der Einzelauflistung: ${fehler} Zusicherung(en) verletzt.` : 'Reihen nach der Einzelauflistung: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
