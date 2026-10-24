/**
 * `pipeline/lib/netflix-staffeln.ts`: Netflix-Staffel N + Folgenzahl → unser N-ter Titel an der Adresse (16.10.2026).
 * Beide Richtungen: nichts zuordnen, was nicht aufgeht (stiller Durchlass wäre eine falsche Sprachaussage), und nichts
 * liegen lassen, was aufgeht (lauter Fehlalarm: die Folgen blieben unzuordenbar).
 */
import { ankerAdresse } from './lib/folgen-je-folge.ts'
import { belegtDurchStaffel, folgenzahlAusMenue, teileNachNetflixStaffel, type StaffelListen } from './lib/netflix-staffeln.ts'
import type { Title } from '../shared/types.ts'

const fehler: string[] = []
const pruefe = (name: string, ok: boolean | undefined, gefunden?: unknown) => {
  if (!ok) fehler.push(`${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const URL_A = 'https://www.netflix.com/title/81788312'
const URL_B = 'https://www.netflix.com/title/81249833'
const titel = (id: number, jpYear: number | undefined, episodes: number, url: string, format = 'TV'): Title =>
  ({ id, slug: `t${id}`, jpYear, episodes, format, streams: [{ platform: 'netflix', url }] }) as unknown as Title

type Z = {
  id: number
  url: string
  plattform: string
  nummer: number | null
  staffel_nr: number | null
  staffel_text: string | null
  titel_id: number | null
}
let zaehler = 0
// Die Erweiterung hängt die Länge des Menüs an den Text („· von 2"); `menue` null lässt sie weg.
let menueLaenge = 2
const folgen = (url: string, nr: number | null, text: string | null, anzahl: number, plattform = 'netflix', menue: number | null = menueLaenge, nummern?: number[]): Z[] =>
  Array.from({ length: anzahl }, (_, i) => ({
    id: ++zaehler,
    url,
    plattform,
    nummer: nummern ? nummern[i]! : i + 1,
    staffel_nr: nr,
    staffel_text: text !== null && menue !== null ? `${text} · von ${menue}` : text,
    titel_id: null,
  }))
const gruppe = (...teile: Z[][]) => new Map([[teile[0]![0]!.url, teile.flat()]])
const ids = (m: Map<string, Z[]>) => [...m].map(([k, l]) => `${k.replace('https://www.netflix.com/title/', '')}:${[...new Set(l.map((z) => z.titel_id))].join('/')}:${l.length}`)

const KEIN_SERIENTITEL = ['MOVIE', 'SPECIAL', 'MUSIC']
const kennung = (url: string) => url.split('/').pop()!
/** Netflix' Staffelliste (`data/anbieter-staffeln.json`) aus Folgenzahlen; Reihenfolge der Positionen = Staffelnummern. */
const staffelListe = (folgen: number[]): StaffelListen[string] => ({ staffeln: folgen.map((f, i) => ({ seq: i + 1, folgen: f })) })
/** Ohne Angabe führt Netflix an jeder Adresse genau die Serien-Titel, die wir dort führen, nach Erstausstrahlung. */
const gleicheListen = (g: Map<string, Z[]>, titles: Title[]): StaffelListen => {
  const listen: StaffelListen = {}
  for (const url of new Set([...g.values()].flat().map((z) => z.url))) {
    const serien = titles.filter((t) => t.streams?.some((s) => s.url === url) && !KEIN_SERIENTITEL.includes(String(t.format)))
    listen[kennung(url)] = staffelListe(serien.sort((a, b) => (a.jpYear ?? 0) - (b.jpYear ?? 0)).map((t) => t.episodes as number))
  }
  return listen
}
const teile = (g: Map<string, Z[]>, titles: Title[], listen: StaffelListen = gleicheListen(g, titles)) => teileNachNetflixStaffel(g, titles, listen)

// Mehrere Titel an der Adresse, ein Special mitten in der Reihe: es zählt nicht als Staffel.
const dangers = [titel(1, 2023, 12, URL_A), titel(3, 2024, 1, URL_A, 'SPECIAL'), titel(2, 2025, 13, URL_A)]
const beide = teile(gruppe(folgen(URL_A, 1, 'Staffel 1 (12 Folgen)', 12), folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers)
pruefe('beide Staffeln: zwei Gruppen', beide.size === 2, ids(beide))
pruefe('Staffel 1 → Titel 1 (12 Folgen)', beide.get(`${URL_A}#s1`)?.length === 12 && beide.get(`${URL_A}#s1`)?.every((z) => z.titel_id === 1), ids(beide))
pruefe('Staffel 2 → Titel 2 (13 Folgen), das Special übersprungen', beide.get(`${URL_A}#s2`)?.length === 13 && beide.get(`${URL_A}#s2`)?.every((z) => z.titel_id === 2), ids(beide))

const nur2 = teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers)
pruefe('nur Staffel 2 gemeldet: trotzdem zugeordnet', ids(nur2).join() === 'title/81788312#s2:2:13'.replace('title/', ''), ids(nur2))
const nur1 = teile(gruppe(folgen(URL_A, 1, 'Staffel 1 (12 Folgen)', 12)), dangers)
pruefe('nur Staffel 1 gemeldet: zugeordnet', ids(nur1).join() === '81788312#s1:1:12', ids(nur1))

// Vorn, Mitte, hinten bei drei Titeln.
menueLaenge = 3
const drei = [titel(1, 2021, 12, URL_A), titel(2, 2023, 13, URL_A), titel(4, 2025, 9, URL_A)]
const mitte = teile(gruppe(folgen(URL_A, 2, 'Kapitel 2 (13 Folgen)', 13)), drei)
pruefe('Staffel 2 von 3 (Mitte): Titel 2', ids(mitte).join() === '81788312#s2:2:13', ids(mitte))
const hinten = teile(gruppe(folgen(URL_A, 3, 'Staffel 3 (9 Folgen)', 9)), drei)
pruefe('Staffel 3 von 3 (hinten): Titel 4', ids(hinten).join() === '81788312#s3:4:9', ids(hinten))
const alle3 = teile(gruppe(folgen(URL_A, 1, 'Staffel 1 (12 Folgen)', 12), folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13), folgen(URL_A, 3, 'Staffel 3 (9 Folgen)', 9)), drei)
pruefe('alle drei: je eigener Titel', ids(alle3).join() === '81788312#s1:1:12,81788312#s2:2:13,81788312#s3:4:9', ids(alle3))
const zweiter = teile(gruppe(folgen(URL_A, 1, 'Staffel 1 (12 Folgen)', 12), folgen(URL_A, 3, 'Staffel 3 (10 Folgen)', 10)), drei)
pruefe('ein Treffer, ein Fehlschlag: die Adresse bleibt, wie sie war', zweiter.size === 1 && zweiter.has(URL_A), ids(zweiter))

// Nachgiebiger als erlaubt: nichts darf durch.
menueLaenge = 2
const falsch = (name: string, m: Map<string, Z[]>) => pruefe(`${name}: unverändert`, m.size === 1 && m.has(URL_A) && m.get(URL_A)!.every((z) => z.titel_id === null), ids(m))
falsch('Folgenzahl weicht ab (14 statt 13)', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (14 Folgen)', 14)), dangers))
falsch('Menü ohne Folgenzahl (nur das Kästchen 16)', teile(gruppe(folgen(URL_A, 2, 'Staffel 2: 16', 13)), dangers))
falsch('Text fehlt', teile(gruppe(folgen(URL_A, 2, null, 13)), dangers))
falsch('Staffelnummer fehlt', teile(gruppe(folgen(URL_A, null, 'Staffel 2 (13 Folgen)', 13)), dangers))
falsch('Staffel 3 gibt es bei uns nicht', teile(gruppe(folgen(URL_A, 3, 'Staffel 3 (13 Folgen)', 13)), dangers))
falsch('nur ein Titel an der Adresse', teile(gruppe(folgen(URL_A, 1, 'Staffel 1 (12 Folgen)', 12)), [titel(1, 2023, 12, URL_A)]))
falsch('zwei Titel im selben Jahr (Reihenfolge unklar)', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), [titel(1, 2023, 12, URL_A), titel(2, 2023, 13, URL_A)]))
falsch('Titel ohne Jahr', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), [titel(1, undefined, 12, URL_A), titel(2, 2025, 13, URL_A)]))
falsch('eine Staffel mit zwei Folgenzahlen', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (12 Folgen)', 6), folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 7)), dangers))
falsch('anderer Anbieter', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13, 'disneyplus')), dangers))

// Vinland: die Nummern zählen je Staffel neu, `gruppiereNachAusgabe` hat die Adresse schon in `#0` und `#1` geteilt.
const vinland = [titel(10, 2019, 24, URL_B), titel(11, 2023, 24, URL_B)]
const geteilt = new Map<string, Z[]>([
  [`${URL_B}#0`, folgen(URL_B, 1, 'Staffel 1 (24 Folgen)', 24)],
  [`${URL_B}#1`, folgen(URL_B, 2, 'Staffel 2 (24 Folgen)', 24)],
])
const vin = teile(geteilt, vinland)
pruefe('Vinland (24 + 24, schon geteilt): Staffel 1 → 10, Staffel 2 → 11', ids(vin).join() === '81249833#s1:10:24,81249833#s2:11:24', ids(vin))

falsch('wir führen drei Serien, das Menü zwei', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), drei))

// My Hero Academia (16.10.2026, Prüfer): bei uns nur Staffel 1 und 6 an der Adresse, das Menü führt sieben.
const mha = [titel(21459, 2016, 13, URL_A), titel(139630, 2022, 25, URL_A)]
const mhaS2 = teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (25 Folgen)', 25, 'netflix', 7)), mha)
falsch('MHA: Netflix-Staffel 2 (25 Folgen) ist nicht unsere Staffel 6', mhaS2)
falsch('MHA: beide Staffeln gemeldet, Menü führt sieben', teile(gruppe(folgen(URL_A, 1, 'Staffel 1 (13 Folgen)', 13, 'netflix', 7), folgen(URL_A, 2, 'Staffel 2 (25 Folgen)', 25, 'netflix', 7)), mha))
pruefe('dieselben Titel, Menü führt zwei: zugeordnet', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (25 Folgen)', 25, 'netflix', 2)), mha).has(`${URL_A}#s2`))
falsch('Menülänge fehlt im Text', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13, 'netflix', null)), dangers))
falsch('zwei Menülängen in den Zeilen', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 6, 'netflix', 2), folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 7, 'netflix', 3)), dangers))
// Zeilen gegen die Folgenzahl im Text: Widerspruch heißt, Text und Nummer stammen aus verschiedenen Staffeln.
falsch('mehr Zeilen als die Folgenzahl im Text', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 14, 'netflix', 2, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 13])), dangers))
falsch('Folgennummer über der Folgenzahl im Text', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 3, 'netflix', 2, [1, 2, 14])), dangers))
pruefe('Randprobe: erste und letzte Folge reichen', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 2, 'netflix', 2, [1, 13])), dangers).has(`${URL_A}#s2`))

// Zwei Adressen nebeneinander: die eine geht auf, die andere bleibt; Reihenfolge und Fremdes bleiben.
const gemischt = new Map<string, Z[]>([
  [URL_A, folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)],
  ['https://www.netflix.com/title/1', folgen('https://www.netflix.com/title/1', null, null, 2)],
  [URL_B, folgen(URL_B, 1, 'Staffel 1 (24 Folgen)', 24)],
])
const g = teile(gemischt, [...dangers, ...vinland])
pruefe('zwei Adressen, dazwischen eine fremde', [...g.keys()].join() === `${URL_A}#s2,https://www.netflix.com/title/1,${URL_B}#s1`, [...g.keys()])

// Devil May Cry (81506915, Prüfer Runde 2): bei uns [12, 8], Netflix führt [8, 8]; Netflix-Staffel 2 (8 Folgen) ist
// bei uns nicht an der Adresse. Serienzahl und Menülänge stimmen, nur die Liste verrät es.
const dmc = [titel(1726, 2007, 12, URL_A), titel(10020483, 2025, 8, URL_A)]
const dmcS2 = gruppe(folgen(URL_A, 2, 'Staffel 2 (8 Folgen)', 8))
falsch('Devil May Cry: nur Netflix-Staffel 2 gemeldet, Liste [8, 8] gegen unsere [12, 8]', teile(dmcS2, dmc, { [kennung(URL_A)]: staffelListe([8, 8]) }))
falsch('Devil May Cry: Staffel 1 gemeldet (8 Folgen), unsere hat 12', teile(gruppe(folgen(URL_A, 1, 'Staffel 1 (8 Folgen)', 8)), dmc, { [kennung(URL_A)]: staffelListe([8, 8]) }))
pruefe('dieselben Titel, Netflix führt [12, 8]: zugeordnet', teile(dmcS2, dmc, { [kennung(URL_A)]: staffelListe([12, 8]) }).has(`${URL_A}#s2`))
// Gleiche Länge der Liste, aber eine Position weicht ab: je Position, nicht als Summe.
falsch('Liste [13, 12] gegen unsere [12, 13] (gleiche Summe)', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers, { [kennung(URL_A)]: staffelListe([13, 12]) }))
falsch('Liste mit drei Staffeln, wir führen zwei', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers, { [kennung(URL_A)]: staffelListe([12, 13, 9]) }))
falsch('Liste mit einer Staffel, Menü und wir führen zwei', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers, { [kennung(URL_A)]: staffelListe([12]) }))
falsch('Netflix-Liste fehlt für die Adresse', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers, {}))
falsch('Netflix-Liste ohne Staffeln', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers, { [kennung(URL_A)]: { staffeln: [] } }))
falsch('Netflix-Liste zählt nicht von 1 an', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers, { [kennung(URL_A)]: { staffeln: [{ seq: 2, folgen: 12 }, { seq: 3, folgen: 13 }] } }))
falsch('Netflix-Liste mit Lücke in der Zählung', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers, { [kennung(URL_A)]: { staffeln: [{ seq: 1, folgen: 12 }, { seq: 3, folgen: 13 }] } }))
falsch('Liste einer anderen Adresse gilt nicht', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers, { [kennung(URL_B)]: staffelListe([12, 13]) }))
pruefe('Liste in anderer Reihenfolge abgelegt: nach Staffelnummer geordnet, zugeordnet', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers, { [kennung(URL_A)]: { staffeln: [{ seq: 2, folgen: 13 }, { seq: 1, folgen: 12 }] } }).has(`${URL_A}#s2`))
pruefe('Adresse mit Länderkürzel („/de/title/“) findet ihre Liste', teileNachNetflixStaffel(new Map([['https://www.netflix.com/de/title/81788312', folgen('https://www.netflix.com/de/title/81788312', 2, 'Staffel 2 (13 Folgen)', 13)]]), dangers.map((t) => ({ ...t, streams: [{ platform: 'netflix', url: 'https://www.netflix.com/de/title/81788312' }] }) as unknown as Title), { '81788312': staffelListe([12, 13]) }).has('https://www.netflix.com/de/title/81788312#s2'))

// Der Menütext sagt 12, wir führen 13 (Liste und Titel gleich): Text und Titel gehören nicht zusammen.
falsch('Text nennt weniger Folgen (12) als unser Titel (13)', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (12 Folgen)', 12)), dangers))
// Eine Serie, ein Menü mit einer Staffel: nichts zu teilen, kein „#s1“ ohne Anker.
const einzel = [titel(5, 2024, 12, URL_A)]
falsch('eine Serie, Menü mit einer Staffel', teile(gruppe(folgen(URL_A, 1, 'Staffel 1 (12 Folgen)', 12, 'netflix', 1)), einzel))

// Filme, Specials und Musik an der Adresse zählen nicht als Staffel (Kuroko: ein Film an der Adresse).
const mitAllem = [titel(1, 2021, 12, URL_A), titel(7, 2022, 1, URL_A, 'MOVIE'), titel(8, 2022, 1, URL_A, 'MUSIC'), titel(3, 2023, 1, URL_A, 'SPECIAL'), titel(2, 2024, 13, URL_A)]
pruefe('Film, Musik und Special an der Adresse: Staffel 2 → Titel 2', ids(teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), mitAllem)).join() === '81788312#s2:2:13')
// Der Verweis steht an der Netflix-Seite (`seite`), nicht an der Stream-Adresse.
const ueberSeite = [titel(1, 2023, 12, 'https://www.netflix.com/title/1'), titel(2, 2025, 13, 'https://www.netflix.com/title/2')].map((t) => ({ ...t, streams: [{ platform: 'netflix', url: `https://www.netflix.com/title/9${t.id}`, seite: URL_A }] }) as unknown as Title)
pruefe('Titel über `seite` an der Adresse: zugeordnet', ids(teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), ueberSeite, { [kennung(URL_A)]: staffelListe([12, 13]) })).join() === '81788312#s2:2:13')

// Auswahlstellen mit dem Treffer vorn, in der Mitte und hinten: Verweis auf die Adresse unter mehreren Streams, Jahr, Liste.
const fremd = (n: number) => ({ platform: 'prime', url: `https://www.amazon.de/dp/B00${n}` })
const mitStreams = (t: Title, vorher: number, nachher: number) =>
  ({ ...t, streams: [...Array.from({ length: vorher }, (_, i) => fremd(i)), ...t.streams!, ...Array.from({ length: nachher }, (_, i) => fremd(9 + i))] }) as unknown as Title
for (const [vorher, nachher] of [[0, 2], [1, 1], [2, 0]] as const) {
  const r = teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dangers.map((t) => mitStreams(t, vorher, nachher)))
  pruefe(`Verweis unter anderen Streams (${vorher} davor, ${nachher} dahinter): zugeordnet`, ids(r).join() === '81788312#s2:2:13', ids(r))
}
const dreiJahre = (fehlt: number) => drei.map((t, i) => (i === fehlt ? { ...t, jpYear: undefined } : t)) as Title[]
menueLaenge = 3
for (const fehlt of [0, 1, 2]) {
  falsch(`Jahr fehlt bei Titel ${fehlt + 1} von 3`, teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), dreiJahre(fehlt), { [kennung(URL_A)]: staffelListe([12, 13, 9]) }))
}
for (const [stelle, netz] of [['vorn', [13, 13, 9]], ['Mitte', [12, 14, 9]], ['hinten', [12, 13, 10]]] as const) {
  falsch(`Netflix-Liste weicht nur ${stelle} ab`, teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), drei, { [kennung(URL_A)]: staffelListe([...netz]) }))
}
pruefe('Kontrolle: die Liste gleicht [12, 13, 9] → zugeordnet', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13)), drei, { [kennung(URL_A)]: staffelListe([12, 13, 9]) }).has(`${URL_A}#s2`))
menueLaenge = 2

// Folgennummer über der Folgenzahl, vorn und in der Mitte (nicht nur in der letzten Zeile).
falsch('zu hohe Folgennummer in der ersten Zeile', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 3, 'netflix', 2, [14, 2, 3])), dangers))
falsch('zu hohe Folgennummer in der mittleren Zeile', teile(gruppe(folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 3, 'netflix', 2, [1, 14, 3])), dangers))

// Zwei Schlüssel an einer Adresse (Prime `url#asin`, Netflix `#0`/`#1`), die unberührt bleibt: alle Schlüssel bleiben.
const zweiSchluessel = (plattform: string) =>
  new Map<string, Z[]>([
    [`${URL_A}#a`, folgen(URL_A, 1, 'Staffel 1 (12 Folgen)', 12, plattform)],
    [`${URL_A}#b`, folgen(URL_A, 2, 'Staffel 2 (13 Folgen)', 13, plattform)],
    [`${URL_A}#c`, folgen(URL_A, 3, 'Staffel 3 (99 Folgen)', 5, plattform)],
  ])
const prime = teile(zweiSchluessel('prime'), dangers)
pruefe('Prime, Adresse unberührt: alle drei Schlüssel bleiben', [...prime.keys()].join() === `${URL_A}#a,${URL_A}#b,${URL_A}#c`, [...prime.keys()])
const netflixRest = teile(zweiSchluessel('netflix'), dangers)
pruefe('Netflix, Adresse geht nicht auf: alle drei Schlüssel bleiben', [...netflixRest.keys()].join() === `${URL_A}#a,${URL_A}#b,${URL_A}#c`, [...netflixRest.keys()])

pruefe('Folgenzahl: „13 Folgen“', folgenzahlAusMenue('Staffel 2 (13 Folgen)') === 13)
pruefe('Folgenzahl: „13 Episodes“', folgenzahlAusMenue('Season 2 (13 Episodes)') === 13)
pruefe('Folgenzahl: Altersfreigabe 16 ist keine', folgenzahlAusMenue('Kapitel 1: 16') === null)

const offenGrund = { art: 'offen' as const, grund: 'keine Folgentitel vorhanden' }
pruefe('Staffelgruppe, belastbar, offen → belegt den Titel', belegtDurchStaffel(`${URL_A}#s2`, true, offenGrund).art === 'titel')
pruefe('Staffelgruppe ohne belastbaren Treffer bleibt offen', belegtDurchStaffel(`${URL_A}#s2`, false, offenGrund).art === 'offen')
pruefe('Adresse ohne Staffelschlüssel bleibt offen', belegtDurchStaffel(`${URL_A}#0`, true, offenGrund).art === 'offen' && belegtDurchStaffel(URL_A, true, offenGrund).art === 'offen')
const mitFolgen = { art: 'folgen' as const, paare: [] }
pruefe('eine Entscheidung über Folgen bleibt, wie sie ist', belegtDurchStaffel(`${URL_A}#s2`, true, mitFolgen) === mitFolgen)

/* Der Anker des früheren Einlesers (`adressIndex`) kennt die Seite auch mit Staffelmarke. */
pruefe('ankerAdresse: #s1 und #0 führen auf dieselbe Seite wie ohne Marke', ankerAdresse(`${URL_A}#s1`) === ankerAdresse(URL_A) && ankerAdresse(`${URL_A}#0`) === ankerAdresse(URL_A) && ankerAdresse(URL_A) !== '')
pruefe('ankerAdresse: andere Seite bleibt andere Seite', ankerAdresse(`${URL_A}#s1`) !== ankerAdresse('https://www.netflix.com/title/1#s1'))

if (fehler.length) {
  console.error(`FEHL check-netflix-staffeln: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-netflix-staffeln: Staffel + Folgenzahl ordnen zu, was aufgeht; alles andere bleibt liegen.')
