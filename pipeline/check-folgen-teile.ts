/**
 * Zusicherung: **Ein Amazon-Teil ohne Anker kommt in die Staffel seines Folgenjahrs, nicht an den Auftragstitel** (31.10.2026).
 * Anlass: Miraculous, Staffel 1–4 mit 26/25/26/26 Folgen, bei Amazon in 24 Teile zu 6–8 Folgen zerlegt (+ Specials, Nummer 101/102);
 * `ordneFolgenZu` hängte jede Folge ohne Anker an den Auftragstitel („einziger-kandidat“), Jahr und Staffel egal. Geprüft werden die
 * Regeln als reine Funktionen (`urteilFuerTeil`, `urteileJeTeil`), der Namensanfang einer Reihe (`namensAnfang`) und der ganze Weg
 * `ordneFolgenZu` mit den echten 145 Miraculous-Zeilen der Meldungen 25009–25034 (`fixtures/miraculous-teile.ts`). Läuft in `check:logic`.
 */
import { MIRACULOUS_ZEILEN } from './fixtures/miraculous-teile.ts'
import { namensAnfang } from './lib/folgen-namen.ts'
import { adressIndex, ankerAdresse, ordneFolgenZu, type Beobachtung, type FolgenZuordnung } from './lib/folgen-je-folge.ts'
import { folgenJahr, imFenster, urteileJeTeil, urteilFuerTeil, type Teil } from './lib/folgen-teile.ts'
import type { Title } from '../shared/types.ts'

const fehler: string[] = []
let zahl = 0
const pruefe = (name: string, ok: boolean, wert?: unknown) => {
  zahl++
  if (!ok) fehler.push(`${name}: ${JSON.stringify(wert)}`)
}

/* Die echten Titel der Reihe (public/data/titles.json, 31.10.2026): Kennung, Startjahr, Folgenzahl; alle franchiseId 10011124. */
const T = (id: number, jpYear: number, episodes: number): Title => ({ id, franchiseId: 10011124, jpYear, episodes, streams: [], watchLinks: [] }) as unknown as Title
const S1 = T(10011124, 2015, 26)
const WEIHNACHT = T(10012133, 2017, 1)
const S2 = T(10013153, 2018, 25)
const S3 = T(10014481, 2019, 26)
const S4 = T(10016892, 2022, 26)
const NY = T(10017058, 2021, 1)
const SHANGHAI = T(10017074, 2021, 1)
const REIHE = [S1, WEIHNACHT, S2, S3, S4, NY, SHANGHAI]
const teil = (jahre: (number | null)[], staffelNr: number | null = 6): Teil => ({ schluessel: 'primevideo:T', staffelNr, jahre })
const urteil = (t: Teil, auftrag?: Title, pool: Title[] = REIHE, belegt = new Map<number, number>()) => urteilFuerTeil(t, pool, auftrag, belegt)
const titelVon = (u: ReturnType<typeof urteil>) => (u.art === 'titel' ? u.titel : u.art)

/* Folgenjahr: Amazon schreibt „17. Mai 2016“, die Pipeline kennt auch ISO. */
pruefe('Jahr aus Amazon-Text', folgenJahr('17. Mai 2016') === 2016, folgenJahr('17. Mai 2016'))
pruefe('Jahr aus ISO-Datum', folgenJahr('2015-10-29T08:00') === 2015, folgenJahr('2015-10-29T08:00'))
pruefe('kein Jahr: null', folgenJahr(null) === null && folgenJahr('') === null && folgenJahr('3. Okt. 21') === null, folgenJahr('3. Okt. 21'))

/* Fenster: Start ± 1 Jahr, ab 27 Folgen ein Jahr je weitere 26 später (S1: 26 Folgen → 2014–2016). */
pruefe('Fenster S1: 2014 und 2016 drin', imFenster(S1, 2014) && imFenster(S1, 2016), [imFenster(S1, 2014), imFenster(S1, 2016)])
pruefe('Fenster S1: 2013 und 2017 draußen', !imFenster(S1, 2013) && !imFenster(S1, 2017), [imFenster(S1, 2013), imFenster(S1, 2017)])
pruefe('Fenster 27 Folgen: bis 2017, nicht 2018', imFenster(T(2, 2015, 27), 2017) && !imFenster(T(2, 2015, 27), 2018), 0)
pruefe('Fenster 52 Folgen: wie 27, bis 2017', imFenster(T(2, 2015, 52), 2017) && !imFenster(T(2, 2015, 52), 2018), 0)
pruefe('Fenster 53 Folgen: bis 2018, nicht 2019', imFenster(T(2, 2015, 53), 2018) && !imFenster(T(2, 2015, 53), 2019), 0)
pruefe('Fenster Film (1 Folge): Start ± 1', imFenster(WEIHNACHT, 2016) && imFenster(WEIHNACHT, 2018) && !imFenster(WEIHNACHT, 2019), 0)
pruefe('Fenster ohne Folgenzahl: nach oben offen', imFenster({ ...S1, episodes: undefined } as unknown as Title, 2040), 0)

/* Urteil je Teil. */
pruefe('kein Folgenjahr: unberührt', urteil(teil([null, null]), S1).art === 'unberuehrt', urteil(teil([null, null]), S1))
pruefe('Auftrag passt (2015/2016 zu S1): unberührt', urteil(teil([2015, 2015, 2016]), S1).art === 'unberuehrt', urteil(teil([2015, 2016]), S1))
pruefe('ein Folgenjahr im Fenster genügt dem Auftrag', urteil(teil([2018, 2016]), S1).art === 'unberuehrt', urteil(teil([2018, 2016]), S1))
pruefe('Auftrag S1, Teil von 2018 → S2', titelVon(urteil(teil([2018, 2018, 2018, 2018, 2018, 2018]), S1)) === S2.id, urteil(teil([2018, 2018, 2018, 2018, 2018, 2018]), S1))
pruefe('ohne Auftrag, Teil von 2018 → S2', titelVon(urteil(teil([2018, 2018, 2018, 2018, 2018, 2018]))) === S2.id, 0)
pruefe('genau gleich vor ±1: 2019 → S3, nicht S2', titelVon(urteil(teil([2019, 2019, 2019, 2019, 2019, 2019]))) === S3.id, 0)
pruefe('Jahr daneben: 2021 → S4 (2022)', titelVon(urteil(teil([2021, 2021, 2021, 2021, 2021, 2021, 2021]))) === S4.id, 0)
pruefe('Mehrheit der Folgen entscheidet: 6 × 2019, 1 × 2018 → S3', titelVon(urteil(teil([2019, 2019, 2019, 2019, 2019, 2019, 2018]))) === S3.id, 0)
pruefe('zwei Staffeln gleich nah (2020 zu 2019 und 2021): offen', urteil(teil([2020, 2020, 2020, 2020, 2020, 2020]), undefined, [S3, T(1, 2021, 26)]).art === 'offen', 0)
pruefe('Folgenjahr deckt keine Staffel ganz ab (2018 und 2023): offen', urteil(teil([2018, 2018, 2023, 2023, 2023, 2023])).art === 'offen', urteil(teil([2018, 2018, 2023, 2023, 2023, 2023])))
pruefe('Jahr 2023 ohne Staffel 5: S4 nimmt ihn nur, solange Platz ist', titelVon(urteil(teil([2023, 2023, 2023, 2023, 2023, 2023, 2023]))) === S4.id, 0)
pruefe('Jahr 2023 ohne Staffel 5 und mit voller S4: offen', urteil(teil([2023, 2023, 2023, 2023, 2023, 2023, 2023]), undefined, REIHE, new Map([[S4.id, 26]])).art === 'offen', 0)
pruefe('Teil mit 7 Folgen passt nicht in einen Film (NY 2021, 1 Folge)', titelVon(urteil(teil([2021, 2021, 2021, 2021, 2021, 2021, 2021]))) !== NY.id, 0)

/* Specials und Einzelfolgen. */
pruefe('Special s101 (1 Folge, 2021) mit Auftrag S4 (2022, im Fenster): offen', urteil(teil([2021], 101), S4).art === 'offen', urteil(teil([2021], 101), S4))
pruefe('Special s101 ohne Auftrag: offen, nicht NY/Shanghai (zwei 2021-Filme)', urteil(teil([2021], 101)).art === 'offen', urteil(teil([2021], 101)))
pruefe('Kontrolle: dieselbe Einzelfolge mit Nummer 5 und Auftrag S4 bleibt unberührt', urteil(teil([2021], 5), S4).art === 'unberuehrt', urteil(teil([2021], 5), S4))
pruefe('Einzelfolge Nr. 12, Jahr 2019, Auftrag S1: offen, nicht S3', urteil(teil([2019], 12), S1).art === 'offen', urteil(teil([2019], 12), S1))
pruefe('Special mit Auftrag aus einer Folge (eigener Film): unberührt', urteil(teil([2017], 101), WEIHNACHT).art === 'unberuehrt', urteil(teil([2017], 101), WEIHNACHT))
pruefe('Mehrfolgen-Teil mit Nummer 101 („Staffel 1 Teil 1“) ist kein Special', urteil(teil([2015, 2015, 2015, 2015, 2015, 2015], 101), S1).art === 'unberuehrt', 0)
pruefe('Film-Auftrag (1 Folge) mit fernem Jahr: unberührt', urteil(teil([2004]), T(5, 2001, 1)).art === 'unberuehrt', 0)
pruefe('Auftrag ohne Startjahr: unberührt', urteil(teil([2030, 2030]), { id: 7, franchiseId: 10011124 } as unknown as Title).art === 'unberuehrt', 0)
pruefe('Auftrag allein in der Reihe: unberührt', urteil(teil([2030, 2030]), S1, [S1]).art === 'unberuehrt', 0)
pruefe('Auftrag ohne Folgenzahl, spätes Jahr: unberührt', urteil(teil([2030, 2030]), { ...S1, episodes: undefined } as unknown as Title).art === 'unberuehrt', 0)

/* Platz: frühere Teile belegen die Staffel (S2 hat 25 Folgen, vier Teile je 6/6/6/7). */
const voll = new Map([[S2.id, 20]])
pruefe('S2 mit 20 belegten Folgen nimmt 6 nicht mehr: offen', urteil(teil([2018, 2018, 2018, 2018, 2018, 2018]), undefined, [S2], voll).art === 'offen', 0)
pruefe('S2 mit 19 belegten Folgen nimmt 6', titelVon(urteil(teil([2018, 2018, 2018, 2018, 2018, 2018]), undefined, [S2], new Map([[S2.id, 19]]))) === S2.id, 0)
const zwei = urteileJeTeil(
  [
    { schluessel: 'p:spaet', staffelNr: 9, jahre: [2018, 2018, 2018, 2018, 2018, 2018, 2018] },
    { schluessel: 'p:frueh', staffelNr: 6, jahre: [2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018] },
  ],
  () => [S2],
  () => undefined,
)
pruefe('Reihenfolge nach Amazon-Nummer: der frühe Teil (19) belegt, der späte (7) passt nicht mehr', zwei.get('p:frueh')?.art === 'titel' && zwei.get('p:spaet')?.art === 'offen', [...zwei])

/* Namensanfang: „Miraculous“ ist der Anfang von sieben Titeln einer Reihe. */
const kerne: [string, number][] = [
  ['miraculous geschichten von ladybug und cat noir', S1.id],
  ['miraculous geschichten von ladybug und cat noir staffel 2', S2.id],
  ['miraculous world new york united heroez', NY.id],
]
const reihenTitel = new Map(REIHE.map((t) => [t.id, t]))
pruefe('Namensanfang einer Reihe: ein Titel der Reihe', [S1.id, S2.id, NY.id].includes(namensAnfang('miraculous', kerne, reihenTitel) ?? 0), namensAnfang('miraculous', kerne, reihenTitel))
pruefe('Namensanfang, genau ein Treffer: dieser', namensAnfang('miraculous world', kerne, reihenTitel) === NY.id, 0)
pruefe('Namensanfang aus zwei Reihen: nein', namensAnfang('miraculous', [...kerne, ['miraculous andere serie', 99]], new Map([...reihenTitel, [99, { id: 99, franchiseId: 5 } as unknown as Title]])) === undefined, 0)
pruefe('Namensanfang unter sechs Zeichen: nein', namensAnfang('mira', kerne, reihenTitel) === undefined, 0)
pruefe('Namensanfang ohne Treffer: nein', namensAnfang('unbekannt', kerne, reihenTitel) === undefined, 0)

/* Der ganze Weg mit den echten Zeilen: Meldungen ohne titel_id, Teil 1 über die Suchadresse, die übrigen über /dp/<Teil>. */
const SUCHE = 'https://www.amazon.de/s?k=Miraculous%3A%20Geschichten%20von%20Ladybug%20und%20Cat%20Noir&i=instant-video'
const beob = (auftrag: number | null, nurTeile?: string[]): Beobachtung[] =>
  MIRACULOUS_ZEILEN.filter(([teil]) => !nurTeile || nurTeile.includes(teil)).map(([teil, nr, asin, nummer, titel, erschienen, am], i) => ({
    id: i + 1,
    plattform: 'primevideo',
    url: teil === 'B0B6HHFR44' ? SUCHE : `https://www.amazon.de/dp/${teil}`,
    asin,
    gti: null,
    nummer,
    titel,
    erschienen,
    titel_id: auftrag,
    gemeldet_am: am,
    seiten_kennung: teil,
    staffel_nr: nr,
  }))
const titelKarte = new Map(REIHE.map((t) => [t.id, t]))
const kontext = (extra: Partial<Parameters<typeof ordneFolgenZu>[1]> = {}) => ({
  titel: titelKarte,
  tmdb: {},
  asFolgen: {},
  asKennung: {},
  jeAdresse: adressIndex(titelKarte, []),
  namenJeAdresse: new Map(MIRACULOUS_ZEILEN.map(([teil]) => [ankerAdresse(`https://www.amazon.de/dp/${teil}`), 'Miraculous'])),
  nameZuTitel: (n: string) => (/^miraculous/i.test(n) ? namensAnfang('miraculous', kerne, reihenTitel) : undefined),
  ...extra,
})
const teile = [...new Set(MIRACULOUS_ZEILEN.map(([t]) => t))]
const nrVon = (teilKennung: string) => MIRACULOUS_ZEILEN.find(([t]) => t === teilKennung)![1]
const ergebnisTeil = (erg: Record<string, FolgenZuordnung>, teilKennung: string) =>
  MIRACULOUS_ZEILEN.filter(([t]) => t === teilKennung).map(([, , asin]) => erg[`primevideo:${asin}`]!)
/** Der eine Titel aller Folgen eines Teils, 'offen' wenn alle offen sind, sonst 'uneinheitlich'. */
const teilTitel = (erg: Record<string, FolgenZuordnung>, teilKennung: string) => {
  const z = ergebnisTeil(erg, teilKennung)
  const ids = new Set(z.map((x) => x.titel ?? 'offen'))
  return ids.size === 1 ? [...ids][0] : 'uneinheitlich'
}
const SOLL: Record<number, number | 'offen'> = {}
for (const [nr, s] of [[1, S1], [2, S1], [3, S1], [4, S1], [6, S2], [7, S2], [8, S2], [9, S2], [10, S3], [11, S3], [13, S3], [14, S3], [15, S4], [16, S4], [17, S4], [18, S4]] as [number, Title][]) SOLL[nr] = s.id
for (const nr of [5, 12, 19, 20, 21, 22, 23, 24, 101, 102]) SOLL[nr] = 'offen'

const ohneAuftrag = ordneFolgenZu(beob(null), kontext(), {})
const verteilung = teile.map((t) => `${nrVon(t)}:${teilTitel(ohneAuftrag, t)}`)
pruefe('26 Teile gelesen', teile.length === 26 && new Set(MIRACULOUS_ZEILEN.map(([, , a]) => a)).size === MIRACULOUS_ZEILEN.length, teile.length)
for (const t of teile) {
  const nr = nrVon(t)
  pruefe(`ohne Auftrag: Teil ${nr} → ${SOLL[nr]}`, teilTitel(ohneAuftrag, t) === SOLL[nr], teilTitel(ohneAuftrag, t))
}
pruefe(
  'Staffeln voll gezählt: S1 26, S2 25, S3 25, S4 26 Folgen',
  [S1, S2, S3, S4].map((s) => Object.values(ohneAuftrag).filter((z) => z.titel === s.id).length).join() === '26,25,25,26',
  [S1, S2, S3, S4].map((s) => Object.values(ohneAuftrag).filter((z) => z.titel === s.id).length),
)
pruefe('Grund der Verteilung: jahr', ergebnisTeil(ohneAuftrag, 'B07YSXN8BT').every((z) => z.grund === 'jahr' && z.folge === undefined), ergebnisTeil(ohneAuftrag, 'B07YSXN8BT'))
pruefe('offene Teile nennen die Reihe als Kandidaten', ergebnisTeil(ohneAuftrag, 'B09HL8QKXR')[0]?.kandidaten?.length === REIHE.length, ergebnisTeil(ohneAuftrag, 'B09HL8QKXR'))
pruefe('Special „Tagebuch Besonders“ (B09HL8QKXR) bleibt ohne Titel', ergebnisTeil(ohneAuftrag, 'B09HL8QKXR')[0]?.titel === undefined, verteilung)

/* Falscher Auftrag: die Erweiterung meldete S1 für alle Teile (so fiel jede Folge an S1). */
const aufS1 = ordneFolgenZu(beob(S1.id), kontext(), {})
for (const t of teile) {
  const nr = nrVon(t)
  const soll = SOLL[nr] === S1.id ? S1.id : SOLL[nr]
  /* Teil 5 (eine Folge, Dezember 2016) passt noch in S1s Fenster und bleibt dort; die übrigen wie ohne Auftrag. */
  const erwartet = nr === 5 ? S1.id : soll
  pruefe(`Auftrag S1: Teil ${nr} → ${erwartet}`, teilTitel(aufS1, t) === erwartet, teilTitel(aufS1, t))
}
pruefe('Auftrag S1: Teile 1–4 bleiben einziger Kandidat', ergebnisTeil(aufS1, 'B07CP3QFQF').every((z) => z.grund === 'einziger-kandidat'), ergebnisTeil(aufS1, 'B07CP3QFQF'))
const aufS4 = ordneFolgenZu(beob(S4.id, ['B09HL8QKXR']), kontext(), {})
pruefe('Tagebuch Besonders mit Auftrag S4 (2021 liegt im Fenster): trotzdem offen', teilTitel(aufS4, 'B09HL8QKXR') === 'offen', ergebnisTeil(aufS4, 'B09HL8QKXR'))
const kontrolle = ordneFolgenZu(beob(S4.id, ['B09TYDQLM7']), kontext(), {})
pruefe('Kontrolle: Teil 16 (7 Folgen, 2021) mit Auftrag S4 bleibt S4', teilTitel(kontrolle, 'B09TYDQLM7') === S4.id, ergebnisTeil(kontrolle, 'B09TYDQLM7'))

/* Kreislauf: zweiter Lauf mit dem Ergebnis des ersten, und der alte falsche Eintrag hält nicht. */
const zweiterLauf = ordneFolgenZu(beob(null), kontext(), ohneAuftrag)
pruefe('zweiter Lauf auf dem Ergebnis des ersten: gleich', JSON.stringify(zweiterLauf) === JSON.stringify(ohneAuftrag), 0)
const falschAlt: Record<string, FolgenZuordnung> = {}
for (const [, , asin] of MIRACULOUS_ZEILEN.filter(([t]) => t === 'B07YSXN8BT')) falschAlt[`primevideo:${asin}`] = { titel: S1.id, grund: 'einziger-kandidat', gesehen: '2026-10-30T10:00:00Z' }
const nachAlt = ordneFolgenZu(beob(S1.id), kontext(), falschAlt)
pruefe('früherer einziger Kandidat S1 hält die Folgen von 2017/2018 nicht', teilTitel(nachAlt, 'B07YSXN8BT') === S2.id, ergebnisTeil(nachAlt, 'B07YSXN8BT'))
const altJahr: Record<string, FolgenZuordnung> = {}
for (const [, , asin] of MIRACULOUS_ZEILEN.filter(([t]) => t === 'B0CB1VTN1K')) altJahr[`primevideo:${asin}`] = { titel: S4.id, grund: 'jahr', gesehen: '2026-10-30T10:00:00Z' }
const nachJahr = ordneFolgenZu(beob(null), kontext(), altJahr)
pruefe('früherer Jahres-Treffer hält nicht, wenn S4 inzwischen voll ist (Teil 19 offen)', teilTitel(nachJahr, 'B0CB1VTN1K') === 'offen', ergebnisTeil(nachJahr, 'B0CB1VTN1K'))

/* Ein Anker im Teil gibt den Teil vor: die Folge ohne Treffer wird nicht nach dem Jahr umgehängt. Teil 6 (2017/2018, Auftrag S1) käme nach dem Jahr in S2; ein aniSearch-Anker auf „Der Collector“ in S3 ist stärker als das Jahr. */
const anker = kontext({
  asKennung: { [String(S3.id)]: { anisearchId: 77 } },
  asFolgen: { '77': { folgen: [{ nr: 1, de: 'Der Collector', datum: '2017-10-26' }] } },
})
const verankert = ordneFolgenZu(beob(S1.id, ['B07YSXN8BT']), anker, {})
pruefe('Kontrolle: die Anker-Folge trifft S3', verankert['primevideo:B07YSYSJH4']?.titel === S3.id && verankert['primevideo:B07YSYSJH4']?.grund !== 'einziger-kandidat', verankert['primevideo:B07YSYSJH4'])
pruefe(
  'verankerter Teil: die Folgen ohne Treffer bleiben einziger Kandidat S1, kein Umhängen nach dem Jahr (S2)',
  ['B07YSY7XCB', 'B07YSY7WL9', 'B07YSYQW9G', 'B07YSYMWKX', 'B07YSY97ZJ'].every((a) => verankert[`primevideo:${a}`]?.titel === S1.id && verankert[`primevideo:${a}`]?.grund === 'einziger-kandidat'),
  verankert,
)
const ohneAnker = ordneFolgenZu(beob(S1.id, ['B07YSXN8BT']), kontext(), {})
pruefe('Kontrolle: ohne den Anker geht derselbe Teil nach S2', teilTitel(ohneAnker, 'B07YSXN8BT') === S2.id, ergebnisTeil(ohneAnker, 'B07YSXN8BT'))

/* Anker über das Datum statt über den Titel (ISO-Datum an der Folge, kein Titeltreffer) gibt den Teil ebenso vor. */
const datumsAnker = kontext({
  asKennung: { [String(S3.id)]: { anisearchId: 77 } },
  asFolgen: { '77': { folgen: [{ nr: 1, de: 'Ganz anderer Titel', datum: '2017-10-26' }] } },
})
const mitDatum = ordneFolgenZu(beob(S1.id, ['B07YSXN8BT']).map((b) => (b.asin === 'B07YSYSJH4' ? { ...b, erschienen: '2017-10-26' } : b)), datumsAnker, {})
pruefe('Kontrolle: die Datums-Folge trifft S3 über das Datum', mitDatum['primevideo:B07YSYSJH4']?.titel === S3.id && mitDatum['primevideo:B07YSYSJH4']?.grund === 'datum', mitDatum['primevideo:B07YSYSJH4'])
pruefe('Datums-Anker gibt den Teil vor: die übrigen bleiben S1', mitDatum['primevideo:B07YSY7XCB']?.titel === S1.id && mitDatum['primevideo:B07YSY7XCB']?.grund === 'einziger-kandidat', mitDatum['primevideo:B07YSY7XCB'])

/* Eine frühere Zuordnung über einen Anker bleibt, auch wenn das Jahr den Teil „offen“ nennt (Teil 19, S4 voll). */
const altAnker: Record<string, FolgenZuordnung> = { 'primevideo:B0CB1VTNAA': { titel: S4.id, folge: 3, grund: 'titel', gesehen: '2026-10-30T10:00:00Z' } }
const mitAltAnker = ordneFolgenZu(
  [...beob(null, ['B0CB1VTN1K']), ...beob(null, ['B0CB1VTN1K']).slice(0, 1).map((b) => ({ ...b, asin: 'B0CB1VTNAA', id: 999 }))],
  kontext(),
  altAnker,
)
pruefe('früherer Anker-Treffer bleibt stehen', mitAltAnker['primevideo:B0CB1VTNAA']?.titel === S4.id && mitAltAnker['primevideo:B0CB1VTNAA']?.grund === 'titel', mitAltAnker['primevideo:B0CB1VTNAA'])

/* Auftraggeber im Teil uneinig (drei Folgen S2, drei S4): kein Auftrag, das Jahr entscheidet für alle. */
const uneinig = ordneFolgenZu(beob(null, ['B07YSXN8BT']).map((b, i) => ({ ...b, titel_id: i < 3 ? S2.id : S4.id })), kontext(), {})
pruefe('uneinige Aufträge im Teil: alle Folgen nach dem Jahr in S2', teilTitel(uneinig, 'B07YSXN8BT') === S2.id && ergebnisTeil(uneinig, 'B07YSXN8BT').every((z) => z.grund === 'jahr'), ergebnisTeil(uneinig, 'B07YSXN8BT'))

/* Ohne Seite (`seiten_kennung`) gibt es keinen Teil: die Folgen bleiben, wie der Zuordner sie ohne Jahresregel ließ. */
const ohneSeite = ordneFolgenZu(beob(S1.id, ['B07YSXN8BT']).map((b) => ({ ...b, seiten_kennung: null })), kontext(), {})
pruefe('ohne Seitenkennung: einziger Kandidat S1 wie zuvor', ergebnisTeil(ohneSeite, 'B07YSXN8BT').every((z) => z.titel === S1.id && z.grund === 'einziger-kandidat'), ergebnisTeil(ohneSeite, 'B07YSXN8BT'))

/* Das Jahr kommt von der jüngsten Beobachtung, fehlt es dort, von einer älteren derselben Folge. */
const jung = beob(S1.id, ['B07YSXN8BT']).flatMap((b) => [{ ...b, id: b.id + 5000, gemeldet_am: '2026-10-30T10:00:00Z' }, { ...b, erschienen: null }])
const ausAelterer = ordneFolgenZu(jung, kontext(), {})
pruefe('Jahr aus der älteren Beobachtung, wenn die jüngste keins trägt: Teil 6 → S2', teilTitel(ausAelterer, 'B07YSXN8BT') === S2.id, ergebnisTeil(ausAelterer, 'B07YSXN8BT'))
const ohneJahr = ordneFolgenZu(beob(S1.id, ['B07YSXN8BT']).map((b) => ({ ...b, erschienen: null })), kontext(), {})
pruefe('Teil ganz ohne Jahr: einziger Kandidat S1 bleibt', ergebnisTeil(ohneJahr, 'B07YSXN8BT').every((z) => z.titel === S1.id && z.grund === 'einziger-kandidat'), ergebnisTeil(ohneJahr, 'B07YSXN8BT'))

/* Weitere Grenzen der reinen Regeln. */
pruefe('Jahr vor 2000: 1987', folgenJahr('12. Mai 1987') === 1987, folgenJahr('12. Mai 1987'))
pruefe('Teil mit zwei Folgen ist kein Special und kein Einzelteil', titelVon(urteil(teil([2018, 2018]), undefined, [S2])) === S2.id, urteil(teil([2018, 2018]), undefined, [S2]))
pruefe('Auftrag allein in der Reihe, daneben ein Titel ohne Startjahr: unberührt', urteil(teil([2030, 2030]), S1, [S1, { id: 8, franchiseId: 10011124 } as unknown as Title]).art === 'unberuehrt', 0)
const gleichNr = urteileJeTeil(
  [
    { schluessel: 'p:b', staffelNr: 4, jahre: [2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018] },
    { schluessel: 'p:a', staffelNr: 4, jahre: [2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018, 2018] },
  ],
  () => [S2],
  () => undefined,
)
pruefe('gleiche Amazon-Nummer: der Schlüssel in alphabetischer Reihenfolge belegt zuerst', gleichNr.get('p:a')?.art === 'titel' && gleichNr.get('p:b')?.art === 'offen', [...gleichNr])
pruefe('Namensanfang genau sechs Zeichen gilt', namensAnfang('miracu', kerne, reihenTitel) !== undefined && namensAnfang('mirac', kerne, reihenTitel) === undefined, namensAnfang('miracu', kerne, reihenTitel))

/* Nachtrag aus der ersten Mutationsrunde (14 Überlebende → Fälle). */
pruefe('Jahr nur als ganzes Wort: „120199“ ist kein Jahr', folgenJahr('Staffel 120199') === null, folgenJahr('Staffel 120199'))
const lang = T(3, 2015, 52)
pruefe('Staffel im Fenster, aber weder im Startjahr noch ein Jahr daneben (2017 zu 2015): offen', urteil(teil([2017, 2017, 2017, 2017, 2017, 2017]), undefined, [lang]).art === 'offen', urteil(teil([2017, 2017, 2017, 2017, 2017, 2017]), undefined, [lang]))
pruefe('Kontrolle: dieselbe Staffel mit Jahr 2016 (±1) wird gewählt', titelVon(urteil(teil([2016, 2016, 2016, 2016, 2016, 2016]), undefined, [lang])) === lang.id, 0)
const ohneZahl = { id: 4, franchiseId: 10011124, jpYear: 2018, streams: [], watchLinks: [] } as unknown as Title
pruefe('Staffel ohne Folgenzahl hat unbegrenzt Platz', titelVon(urteil(teil([2018, 2018, 2018, 2018, 2018, 2018]), undefined, [ohneZahl], new Map([[ohneZahl.id, 500]]))) === ohneZahl.id, 0)
pruefe('Teil mit zwei Folgen und Nummer 101 ist kein Special: Auftrag passt, unberührt', urteil(teil([2015, 2015], 101), S1).art === 'unberuehrt', urteil(teil([2015, 2015], 101), S1))
pruefe('Einzelfolge mit Nummer 100 ist ein Special', urteil(teil([2021], 100), S4).art === 'offen', urteil(teil([2021], 100), S4))
pruefe('Einzelfolge mit Nummer 99 ist keins: Auftrag passt, unberührt', urteil(teil([2021], 99), S4).art === 'unberuehrt', urteil(teil([2021], 99), S4))
pruefe('Special bei Auftrag ohne Folgenzahl: offen', urteil(teil([2021], 101), { ...S4, episodes: undefined } as unknown as Title).art === 'offen', 0)
/* Gleichstand im Startjahr (3 × 2018, 3 × 2019) entscheidet kein Nachbarjahr. */
pruefe('Gleichstand 3 × 2018 / 3 × 2019 zu S2 und S3: offen', urteil(teil([2018, 2018, 2018, 2019, 2019, 2019]), undefined, [S2, S3]).art === 'offen', urteil(teil([2018, 2018, 2018, 2019, 2019, 2019]), undefined, [S2, S3]))

/* Die jüngste Beobachtung bestimmt Seite und Jahr einer Folge; nur ohne Jahr gilt das einer älteren. */
const aeltere = (jahr: string, seite: string) => (b: Beobachtung): Beobachtung => ({ ...b, id: b.id + 7000, erschienen: jahr, seiten_kennung: seite, gemeldet_am: '2026-10-01T10:00:00Z' })
const teil6 = beob(S1.id, ['B07YSXN8BT'])
const andereSeite = ordneFolgenZu([...teil6, ...teil6.map(aeltere('3. Mai 2022', 'B0ALTERTEIL'))], kontext(), {})
pruefe('jüngste Beobachtung entscheidet über Seite und Jahr (die ältere von 2022 zählt nicht): Teil 6 → S2', teilTitel(andereSeite, 'B07YSXN8BT') === S2.id, ergebnisTeil(andereSeite, 'B07YSXN8BT'))
const nurJahrAelter = ordneFolgenZu([...teil6.map(aeltere('3. Mai 2022', 'B07YSXN8BT')), ...teil6], kontext(), {})
pruefe('jüngste Beobachtung mit Jahr geht der älteren vor (Liste: ältere zuerst): Teil 6 → S2', teilTitel(nurJahrAelter, 'B07YSXN8BT') === S2.id, ergebnisTeil(nurJahrAelter, 'B07YSXN8BT'))
const gesehenVon = (teilKennung: string) => MIRACULOUS_ZEILEN.filter(([t]) => t === teilKennung).map(([, , , , , , am]) => am)
for (const t of ['B07YSXN8BT', 'B0CB1VTN1K']) {
  const soll = gesehenVon(t)
  pruefe(`Teil ${t}: „gesehen“ bleibt die Meldezeit der Folge (umgehängt bzw. offen)`, ergebnisTeil(ohneAuftrag, t).every((z, i) => z.gesehen === soll[i] && soll[i]!.length > 0), ergebnisTeil(ohneAuftrag, t))
}
pruefe(
  'Namensanfang zählt nur am Anfang des Namens („das buch miraculous“ einer anderen Reihe stört nicht)',
  namensAnfang('miraculous', [...kerne, ['das buch miraculous', 77]], new Map([...reihenTitel, [77, { id: 77, franchiseId: 5 } as unknown as Title]])) !== undefined,
  0,
)

const offen = Object.values(SOLL).filter((s) => s === 'offen').length
if (fehler.length) {
  console.error(`check-folgen-teile: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log(`check-folgen-teile: ${zahl} Zusicherungen grün, Teile ohne Anker kommen nach Folgenjahr in die Staffel, Specials und Überzähliges bleiben offen (Miraculous: S1 26, S2 25, S3 25, S4 26 Folgen, ${offen} von ${teile.length} Teilen offen).`)
