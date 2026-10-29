/**
 * Prüft die Marken je Titel in Sammelartikeln (`pipeline/lib/beleg-marken.ts`, `beleg-lesung.ts`, `beleg-bild.ts`): Jeder Titel hat eine Marke oder einen Grund;
 * eine Lesung, der für einen Titel beides fehlt, wird neu gelesen, und ein Lauf, der sie so zurücklässt, wird rot (Magic Knight Rayearth, 29.10.2026).
 * Aufruf: npx tsx pipeline/check-beleg-marken.ts   (Exit 1 bei Verstoß)
 */
import { braucheBild, entzieheBild, ohneMarkenJeTitel, type BelegGedaechtnis, type Lesung } from './lib/beleg-lesung.ts'
import { markenLuecken, meldeMarkenLuecken, stilleLuecken } from './lib/beleg-marken.ts'
import { markierungenJeTitel } from './lib/beleg-bild.ts'
import { ohneFundstelle } from './lib/beleg-ohne-fundstelle.ts'
import type { Gruppe } from './lib/beleg-suche.ts'
import type { Stelle } from './lib/beleg-stelle.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, info = ''): void => {
  console.log(ok ? '✓' : '✗', name, info)
  if (!ok) fehler++
}

const HERBST = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-deutsche-synchros-herbst-2026'
/* Die elf Titel der Herbstübersicht mit Meldung oder Termin am 23.10.2026 (Kennungen aus news.json, Rayearth = 178868). */
const IDS = [195604, 195516, 204389, 191788, 185756, 205909, 178868, 204011, 152677, 212503, 195571]
const gruppen: Gruppe[] = IDS.map((id) => ({ id, suchen: [`Titel ${id}`], tage: [] }))
const MARKE: [number, number, number, number] = [0.05, 0.64, 0.9, 0.03]
/* Die Lesung vom 23.10.2026 (Hash 5f0c54e1191716f2): eine Marke, für Rayearth weder Marke noch Grund. */
const lesung23 = (extra: Partial<Lesung> = {}): Lesung => ({ am: '2026-10-23', hash: '5f0c54e1191716f2', bild: 'b.webp', qs: 'ok', bildfassung: 3, markierung: MARKE, markierungen: { 195516: MARKE }, ...extra })
const ged = (l: Lesung, url = HERBST): BelegGedaechtnis => ({ [url]: { zuletzt: l.am, lesungen: [l] } })
const alleGruende = (ausser: number[] = []): Record<string, 'nicht-gefunden' | 'ausserhalb'> => Object.fromEntries(IDS.filter((i) => i !== 195516 && !ausser.includes(i)).map((i) => [i, 'ausserhalb' as const]))
const mapG = new Map([[HERBST, gruppen]])

/* Die Lücken selbst. */
pruefe('Lücke: die Lesung vom 23.10. hat für zehn der elf Titel weder Marke noch Grund', markenLuecken(lesung23(), gruppen).length === 10 && markenLuecken(lesung23(), gruppen).includes(178868))
pruefe('Lücke: ein Grund schließt sie, auch ohne Marke', markenLuecken(lesung23({ ohneMarke: alleGruende() }), gruppen).length === 0)
pruefe('Lücke: fehlt genau ein Grund (Rayearth), bleibt genau diese Lücke', markenLuecken(lesung23({ ohneMarke: alleGruende([178868]) }), gruppen).join() === '178868')
pruefe('Lücke: ein einzelner Titel hat keine Lücke (gemeinsame Marke gilt)', markenLuecken({}, gruppen.slice(0, 1)).length === 0 && markenLuecken({}, []).length === 0)
pruefe('Lücke: zwei Titel ohne alles sind zwei Lücken', markenLuecken({}, gruppen.slice(0, 2)).length === 2)

/* Der Kreislauf: Altlesung → Warteschlange → neue Lesung mit Gründen → nicht wieder in der Schlange → neuer Titel im Artikel → wieder. */
pruefe('Kreislauf 1: die Lesung mit Lücke kommt sofort wieder dran', ohneMarkenJeTitel(ged(lesung23()), mapG).has(HERBST))
pruefe('Kreislauf 1: auch in aktueller Bildfassung (3) mit Marken für andere Titel', braucheBild(lesung23(), ['x'], gruppen))
const eineLuecke = lesung23({ ohneMarke: alleGruende([178868]) })
pruefe('Kreislauf: genau eine Lücke (Rayearth) reicht für die Schlange und für die neue Aufnahme', ohneMarkenJeTitel(ged(eineLuecke), mapG).has(HERBST) && braucheBild(eineLuecke, ['x'], gruppen))
pruefe('Lauf-Ende: genau eine Lücke in einer nicht gelesenen Altlesung wird gezählt', meldeMarkenLuecken(ged(eineLuecke), mapG, []) === 1)
const neu = lesung23({ ohneMarke: alleGruende() })
pruefe('Kreislauf 2: nach der Lesung mit Gründen steht der Artikel nicht mehr in der Schlange', !ohneMarkenJeTitel(ged(neu), mapG).has(HERBST) && !braucheBild(neu, ['x'], gruppen))
const zwei = (alt: Lesung, jung: Lesung): BelegGedaechtnis => ({ [HERBST]: { zuletzt: jung.am, lesungen: [alt, jung] } })
const jungMitGrund = { ...neu, am: '2026-10-30', hash: 'neu' }
pruefe('Kreislauf: es zählt die jüngste Lesung — alt mit Lücke, jung mit Gründen: nicht in der Schlange', !ohneMarkenJeTitel(zwei(lesung23(), jungMitGrund), mapG).has(HERBST) && meldeMarkenLuecken(zwei(lesung23(), jungMitGrund), mapG, [HERBST]) === 0)
pruefe('Kreislauf: alt mit Gründen, jung mit Lücke: in der Schlange, und der Lauf-Ende-Wächter wirft', ohneMarkenJeTitel(zwei(neu, { ...lesung23(), am: '2026-10-30' }), mapG).has(HERBST) && stilleLuecken(zwei(neu, { ...lesung23(), am: '2026-10-30' }), mapG, [HERBST]).length === 1)
const wand = ged(lesung23({ ohneMarke: alleGruende() }))
entzieheBild(wand, HERBST)
pruefe('Wand: ein entzogenes Bild verliert auch die Gründe', wand[HERBST]!.lesungen[0]!.ohneMarke === undefined && wand[HERBST]!.lesungen[0]!.markierungen === undefined)
const mitNeuem = [...gruppen, { id: 212888, suchen: ['Overgeared'], tage: [] }]
pruefe('Kreislauf 3: kommt ein zwölfter Titel dazu, wird der Artikel wieder gelesen', ohneMarkenJeTitel(ged(neu), new Map([[HERBST, mitNeuem]])).has(HERBST) && braucheBild(neu, ['x'], mitNeuem))
pruefe('Kreislauf: eine Lesung ohne Bild kommt nicht über diese Regel (sie hat eigene Wege)', !ohneMarkenJeTitel(ged(lesung23({ bild: undefined })), mapG).has(HERBST))
pruefe('Kreislauf: ein Artikel mit einem Titel kommt nicht über diese Regel', !ohneMarkenJeTitel(ged(lesung23({ markierungen: undefined })), new Map([[HERBST, gruppen.slice(0, 1)]])).has(HERBST))

/* Das Ergebnis der Aufnahme: Grund je Titel ohne Marke. */
const stelle = (oben: number): Stelle => ({ oben, unten: oben + 40, links: 20, breite: 400, markeUnten: oben + 30 })
const clip = { x: 0, y: 1000, width: 520, height: 3000, scale: 1 }
const je = markierungenJeTitel([[1, stelle(1500)], [2, undefined], [3, stelle(900)], [4, stelle(3990)], [5, stelle(4100)]], clip)
pruefe('Aufnahme: Marke für den Titel im Ausschnitt', Boolean(je?.markierungen[1]) && Math.abs(je!.markierungen[1]![1] - 500 / 3000) < 1e-9)
pruefe('Aufnahme: kein Treffer im Artikel → nicht-gefunden', je?.ohneMarke[2] === 'nicht-gefunden' && !je.markierungen[2])
pruefe('Aufnahme: über dem Ausschnitt → ausserhalb', je?.ohneMarke[3] === 'ausserhalb' && !je.markierungen[3])
pruefe('Aufnahme: eine Marke, die über den unteren Rand ragt, oder darunter liegt → ausserhalb', je?.ohneMarke[5] === 'ausserhalb' && Boolean(je.markierungen[4]) === false && je.ohneMarke[4] === 'ausserhalb')
pruefe('Aufnahme: ohne Titel keine Antwort', markierungenJeTitel([], clip) === undefined)
const rand = markierungenJeTitel([[7, stelle(3970)], [8, stelle(1000)], [9, stelle(3971)], [10, stelle(999)]], clip)
pruefe('Aufnahme: Marke endet genau am unteren Rand (4000) oder beginnt genau am oberen (1000) → Marke', Boolean(rand?.markierungen[7] && rand.markierungen[8]))
pruefe('Aufnahme: einen Pixel weiter unten oder oben → ausserhalb', rand?.ohneMarke[9] === 'ausserhalb' && rand.ohneMarke[10] === 'ausserhalb')

/* Der Wächter am Lauf-Ende. */
let wurf = ''
try { meldeMarkenLuecken(ged(lesung23()), mapG, [HERBST]) } catch (e) { wurf = (e as Error).message }
pruefe('Lauf-Ende: eine gelesene Adresse mit stiller Lücke wirft', wurf.includes(HERBST) && wurf.includes('178868') && wurf.includes('10 von 11'), wurf.slice(0, 120))
pruefe('Lauf-Ende: mit Gründen wirft nichts und meldet keine offene Adresse', meldeMarkenLuecken(ged(neu), mapG, [HERBST]) === 0)
pruefe('Lauf-Ende: eine nicht gelesene Altlesung wirft nicht, wird aber gezählt', meldeMarkenLuecken(ged(lesung23()), mapG, []) === 1)
pruefe('Lauf-Ende: gelesene Adresse ohne Bild (Fehlschlag) wirft nicht', stilleLuecken(ged(lesung23({ bild: undefined })), mapG, [HERBST]).length === 0)
pruefe('Lauf-Ende: eine Wand-Lesung zählt nicht', stilleLuecken(ged(lesung23({ qs: 'wand' })), mapG, [HERBST]).length === 0)
pruefe('Lauf-Ende: gelesene Adresse mit einem Titel wirft nicht', stilleLuecken(ged(lesung23({ markierungen: undefined })), new Map([[HERBST, gruppen.slice(0, 1)]]), [HERBST]).length === 0)

/* Die Liste „Aussage nicht zu finden“ führt nur Titel, die der Artikel nicht nennt. */
const liste = ohneFundstelle(ged(lesung23({ ohneMarke: { ...alleGruende([178868, 204011]), 178868: 'nicht-gefunden' } })), mapG)
pruefe('Handliste: ein Titel außerhalb des Bildes steht nicht darauf, einer ohne Treffer schon', liste.length === 1 && liste[0]!.titel.length === 2 && liste[0]!.titel.some((t) => t.includes('178868')) && liste[0]!.titel.some((t) => t.includes('204011')) && !liste[0]!.titel.some((t) => t.includes('212503')))

console.log(fehler ? `✖ ${fehler} Verstöße` : '✔ Marken je Titel: Lücken, Kreislauf, Aufnahme-Gründe, Lauf-Ende und Handliste in Ordnung')
process.exit(fehler ? 1 : 0)
