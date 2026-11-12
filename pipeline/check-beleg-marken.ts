/**
 * Prüft die Marken je Titel in Sammelartikeln (`pipeline/lib/beleg-marken.ts`, `beleg-lesung.ts`, `beleg-bild.ts`): Jeder Titel hat eine Marke oder einen Grund;
 * eine Lesung, der für einen Titel beides fehlt, wird neu gelesen, und ein Lauf, der sie so zurücklässt, wird rot (Magic Knight Rayearth, 29.10.2026).
 * Aufruf: npx tsx pipeline/check-beleg-marken.ts   (Exit 1 bei Verstoß)
 */
import { braucheBild, entzieheBild, ohneMarkenJeTitel, type BelegGedaechtnis, type Lesung } from './lib/beleg-lesung.ts'
import { markenLuecken, meldeMarkenLuecken, meldeOhneNamen, nameImTextOhneMarke, seitentitelPasst, stilleLuecken } from './lib/beleg-marken.ts'
import { markierungenJeTitel } from './lib/beleg-bild.ts'
import { ohneFundstelle } from './lib/beleg-ohne-fundstelle.ts'
import { markiereAbgeloeste } from './lib/beleg-abgeloest.ts'
import { zuordnungFuerLesen, type Gruppe } from './lib/beleg-suche.ts'
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

/* Klasse B (11.11.2026): Adressen ohne Titelgruppe stehen nicht mehr auf der Liste; die aniSearch-Kurzadresse zählt nicht neben ihrer Slug-Form. */
const AS_KURZ = 'https://www.anisearch.de/article/216599'
const AS_SLUG = `${AS_KURZ},miss-kobayashis-dragon-maid-s-steelbook-blu-ray`
const asGruppe: Gruppe[] = [{ id: 107717, suchen: ['Kobayashi-san Chi no Maidragon S'], tage: [] }]
const asLesung = lesung23({ markierung: undefined, markierungen: undefined })
const asGed = (...urls: string[]): BelegGedaechtnis => Object.fromEntries(urls.map((u) => [u, { zuletzt: asLesung.am, lesungen: [asLesung] }]))
pruefe('Handliste: eine Adresse ohne Titelgruppe und ohne Marke steht nicht darauf', ohneFundstelle(asGed(AS_KURZ), new Map()).length === 0)
pruefe('Handliste: eine Adresse mit Titel ohne Marke steht darauf (Kontrolle)', ohneFundstelle(asGed(AS_KURZ), new Map([[AS_KURZ, asGruppe]])).length === 1)
const beide = ohneFundstelle(asGed(AS_KURZ, AS_SLUG), new Map([[AS_KURZ, asGruppe], [AS_SLUG, asGruppe]]))
pruefe('Handliste: Kurz- und Slug-Adresse derselben aniSearch-Seite zählen einmal, in der Slug-Form', beide.length === 1 && beide[0]!.url === AS_SLUG, beide.map((x) => x.url).join(' '))
pruefe('Handliste: eine Kurzadresse ohne Slug-Zwilling bleibt', ohneFundstelle(asGed(AS_KURZ, 'https://www.anisearch.de/article/216598,x'), new Map([[AS_KURZ, asGruppe]])).map((x) => x.url).join() === AS_KURZ)

/* Überholte Quellen (12.11.2026): Form aus dem Bestand — Bocchi Vol. 3, aniSearch-Seite „überholt“ (sagt 2027-01-15), heutiger Tag 2027-02-05 aus Anime2You „aktuell“. */
const BOCCHI = 'https://www.anisearch.de/article/191584,bocchi-the-rock-staffel-1-vol-3-3-limited-edition-blu-ray'
const HEUTE_A2Y = 'https://www.anime2you.de/news/1068595/28-blu-ray-verschiebungen/'
const bocchiG = new Map<string, Gruppe[]>([[BOCCHI, [{ id: 130003, suchen: ['Bocchi the Rock! – Vol. 3'], tage: ['2027-02-05', '2027-01-15'] }]]])
const bocchiGed: BelegGedaechtnis = { [BOCCHI]: { zuletzt: '2026-11-06', lesungen: [lesung23({ am: '2026-11-06', markierung: undefined, markierungen: undefined })] } }
const quelle = (url: string, stand: string, sagt?: string): any => ({ url, name: 'x', gesehenAm: '2026-10-29', stand, ...(sagt ? { sagt } : {}) })
const termin = (id: number, ...quellen: any[]): any => ({ titleId: id, quellen, schedule: { firstEpisodeDate: '2027-02-05' } })
const aufListe = (releases: any[]): number => ohneFundstelle(bocchiGed, markiereAbgeloeste(bocchiG, releases)).length
const alt = quelle(BOCCHI, 'ueberholt', '2027-01-15')
pruefe('Abgelöst: überholte aniSearch-Seite mit sagt und heutiger Quelle steht nicht auf der Liste', aufListe([termin(130003, quelle(HEUTE_A2Y, 'aktuell', '2027-02-05'), alt)]) === 0)
pruefe('Abgelöst (Kontrolle): ohne die Markierung stünde derselbe Fall auf der Liste', ohneFundstelle(bocchiGed, bocchiG).length === 1)
pruefe('Abgelöst: überholt, aber keine heutige Quelle am Termin → bleibt', aufListe([termin(130003, alt)]) === 1)
pruefe('Abgelöst: überholt ohne sagt → bleibt', aufListe([termin(130003, quelle(HEUTE_A2Y, 'aktuell', '2027-02-05'), quelle(BOCCHI, 'ueberholt'))]) === 1)
pruefe('Abgelöst: heutige Quelle mit abweichendem sagt → bleibt', aufListe([termin(130003, quelle(HEUTE_A2Y, 'aktuell', '2027-03-05'), alt)]) === 1)
pruefe('Abgelöst: eine überholte Quelle mit dem Termin-Tag zählt nicht als heutig → bleibt', aufListe([termin(130003, quelle(HEUTE_A2Y, 'ueberholt', '2027-02-05'), alt)]) === 1)
pruefe('Abgelöst: heutige Quelle ohne sagt → bleibt', aufListe([termin(130003, quelle(HEUTE_A2Y, 'aktuell'), alt)]) === 1)
pruefe('Abgelöst: vermutlich-ueberholt → bleibt', aufListe([termin(130003, quelle(HEUTE_A2Y, 'aktuell', '2027-02-05'), quelle(BOCCHI, 'vermutlich-ueberholt', '2027-01-15'))]) === 1)
pruefe('Abgelöst: aktuelle Quelle derselben Adresse ohne Marke → bleibt', aufListe([termin(130003, quelle(HEUTE_A2Y, 'aktuell', '2027-02-05'), quelle(BOCCHI, 'aktuell', '2027-02-05'))]) === 1)
pruefe('Abgelöst: zweiter Termin des Titels mit aktueller Quelle dieser Adresse → bleibt', aufListe([termin(130003, quelle(HEUTE_A2Y, 'aktuell', '2027-02-05'), alt), termin(130003, quelle(BOCCHI, 'aktuell', '2027-02-05'))]) === 1)
pruefe('Abgelöst: zweiter Termin des Titels ohne heutige Quelle → bleibt', aufListe([termin(130003, quelle(HEUTE_A2Y, 'aktuell', '2027-02-05'), alt), termin(130003, alt)]) === 1)
pruefe('Abgelöst: ein anderer Titel derselben Adresse bleibt', ohneFundstelle(bocchiGed, markiereAbgeloeste(new Map([[BOCCHI, [{ id: 130003, suchen: ['A'], tage: [] }, { id: 7, suchen: ['B'], tage: [] }]]]), [termin(130003, quelle(HEUTE_A2Y, 'aktuell', '2027-02-05'), alt)])).flatMap((x) => x.titel).join().includes('(7)'))
/* Verdrahtung: der Bestandsleser des Laufs liefert die Markierung mit. */
const bestand = { 'public/data/releases.json': [{ ...termin(130003, quelle(HEUTE_A2Y, 'aktuell', '2027-02-05'), alt), sources: [BOCCHI] }], 'public/data/titles.json': [], 'public/data/news.json': [] }
const lauf = zuordnungFuerLesen(<T>(pfad: string, vorgabe: T): T => ((bestand as Record<string, unknown>)[pfad] as T) ?? vorgabe)
pruefe('Abgelöst: zuordnungFuerLesen markiert die Gruppe, die Liste bleibt leer', lauf.gruppen.get(BOCCHI)?.[0]?.abgeloest === true && ohneFundstelle(bocchiGed, lauf.gruppen).length === 0)

/* Kennzahl „Name im Text, Marke fehlt" (anime2you, Klasse A): nur Titel mit Grund nicht-gefunden, dessen Name (und Termin) im Text steht. */
const TEXT = 'Ab 08.10.: »86 EIGHTY-SIX« (Dub + Sub). Außerdem Kobayashi-san Chi no Maidragon S am 3. Dezember 2026.'
const kn = (id: number, suchen: string, tage: string[] = []): Gruppe => ({ id, suchen: [suchen], tage })
const nicht = (...ids: number[]): Record<string, 'nicht-gefunden'> => Object.fromEntries(ids.map((i) => [i, 'nicht-gefunden' as const]))
pruefe('Name im Text: Name steht, Grund nicht-gefunden → Treffer; Name fehlt → keiner', nameImTextOhneMarke(TEXT, nicht(1, 2), [kn(1, '86 EIGHTY-SIX'), kn(2, 'Frieren')]).join() === '1')
pruefe('Name im Text: ein Titel mit Marke oder Grund ausserhalb zählt nicht', nameImTextOhneMarke(TEXT, { 1: 'ausserhalb' }, [kn(1, '86 EIGHTY-SIX'), kn(2, 'Kobayashi-san Chi no Maidragon S')]).length === 0)
pruefe('Name im Text: der Termin der Quelle muss im Text stehen (3. Dezember: ja, ein Tag im November: nein)', nameImTextOhneMarke(TEXT, nicht(1, 2), [kn(1, 'Kobayashi-san Chi no Maidragon S', ['2026-12-03']), kn(2, 'Kobayashi-san Chi no Maidragon S', ['2026-11-04'])]).join() === '1')
pruefe('Name im Text: Namen bis drei Zeichen („Dub“ steht im Text) zählen nicht', nameImTextOhneMarke(TEXT, nicht(1), [kn(1, 'Dub')]).length === 0)
pruefe('Name im Text: nur ganze Wörter, kein Teilstück („Maidrag“ steckt in „Maidragon“)', nameImTextOhneMarke(TEXT, nicht(1), [kn(1, 'Maidrag')]).length === 0)

/* Seitentitel: eine aniSearch-Produktseite muss einen Namen des Titels nennen; Namen bis drei Zeichen, Teilwörter und fremde Adressen zählen nicht. */
const AS = 'https://www.anisearch.de/article/1,x'
const stumm = (): string[] => []
const meldungen = stumm()
const passt = (url: string, text: string, g: Gruppe[]): boolean => seitentitelPasst(url, text, g, (z) => meldungen.push(z))
pruefe('Seitentitel: ein Name des Titels steht im Text → gilt, ohne Meldung', passt(AS, 'Kobayashi-san Chi no Maidragon S - Steelbook', [kn(1, 'Anderer Name'), kn(2, 'Kobayashi-san Chi no Maidragon S')]) && meldungen.length === 0)
pruefe('Seitentitel: kein Name steht im Text → verworfen, mit genau einer Meldung samt Adresse', !passt(AS, 'Märchen Boss - Bd. 02 [eBook]', [kn(1, 'Gods Games We Play')]) && meldungen.length === 1 && meldungen[0]!.includes(AS))
pruefe('Seitentitel: nur ganze Wörter („Maidrag“ steckt in „Maidragon“)', !passt(AS, TEXT, [kn(1, 'Maidrag')]))
pruefe('Seitentitel: ein Name bis drei Zeichen („Dub“ steht im Text) beweist nichts, es bleibt kein Name zum Vergleichen → gilt', passt(AS, 'Märchen Boss - Bd. 02', [kn(1, 'Dub')]))
pruefe('Seitentitel: ohne Gruppen gilt die Seite', passt(AS, TEXT, []))
pruefe('Seitentitel: eine andere Adresse als aniSearch-Produktseite wird nicht verglichen', passt('https://www.joyn.de/x', 'Märchen Boss', [kn(1, 'Gods Games We Play')]))

/* Schreibweisen (Prüfer-Runde 1): Apostroph ’ im Namen, ' im Text; ein japanischer Name allein; „Maid's“ gegen „Maids“ ist eine bekannte Lücke und fällt mit Warnzeile weg, nicht still. */
pruefe('Seitentitel: Apostroph ’ im Namen, ' + "'" + ' im Text → gilt', passt(AS, "Gods' Games We Play - Gesamtausgabe", [kn(1, 'Gods’ Games We Play')]))
pruefe('Seitentitel: japanischer Name steht im Text → gilt', passt(AS, '神々の遊びを… - Gesamtausgabe [Blu-ray]', [kn(1, '神々の遊びを…')]))
const nJp = meldungen.length
pruefe('Seitentitel: japanischer Name fehlt im Text → verworfen mit Meldung', !passt(AS, 'Märchen Boss - Bd. 02 [eBook]', [kn(1, '神々の遊びを…')]) && meldungen.length === nJp + 1)
const nMaid = meldungen.length
pruefe("Seitentitel: „Maid's“ gegen „Maids“ im Text wird verworfen (bekannte Lücke), aber mit Meldung", !passt(AS, 'Maids Staffel 2 [Blu-ray]', [kn(1, "Maid's Tale")]) && meldungen.length === nMaid + 1)

/* Adressen ohne Namen: Zählung statt Stille (nur aniSearch-Produktseiten; Namen bis drei Zeichen zählen nicht als Namen). */
const zeilen: string[] = []
const ASX = 'https://www.anisearch.de/article/2,y'
const gMap = new Map([[AS, [kn(1, 'Gods Games We Play')]], [ASX, [kn(2, 'Dub')]]])
const nOhne = meldeOhneNamen([AS, ASX, 'https://www.anisearch.de/article/3,z', 'https://www.joyn.de/x'], gMap, (z) => zeilen.push(z))
pruefe('Ohne Namen: zwei von drei aniSearch-Adressen (kurzer Name und unbekannte Adresse), die fremde Adresse zählt nicht', nOhne === 2 && zeilen.length === 1 && zeilen[0]!.includes('WARNUNG 2 von 3 gelesenen aniSearch-Adressen ohne Namen'), zeilen.join())
pruefe('Ohne Namen: eine einzige Adresse ohne Namen wird gezählt (genau 1)', meldeOhneNamen([ASX], gMap, () => undefined) === 1)
pruefe('Ohne Namen: alle bekannt → keine Zeile, Zahl 0', meldeOhneNamen([AS], gMap, (z) => zeilen.push(z)) === 0 && zeilen.length === 1)

console.log(fehler ? `✖ ${fehler} Verstöße` : '✔ Marken je Titel: Lücken, Kreislauf, Aufnahme-Gründe, Lauf-Ende, Handliste (ohne Titel, Kurz-/Slug-Adresse, abgelöste Quellen), Name im Text, Seitentitel (Schreibweisen) und Adressen ohne Namen in Ordnung')
process.exit(fehler ? 1 : 0)
