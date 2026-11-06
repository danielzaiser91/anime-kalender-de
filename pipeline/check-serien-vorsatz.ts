/**
 * Serienvorsatz in Prime-Folgentiteln („Eden of the East - Der sorglose Montag“): `shared/folgen-praefix.ts` und seine
 * Verdrahtung in `ordneUeberAnker`. Die Zeilen sind wörtlich aus der Meldungskopie (03.11.2026) und aus
 * `data/anisearch-folgen.json` bzw. `data/tmdb-folgen.json`: Eden of the East (5630), Tayo (163828), Titipo (188066).
 * Läuft in `check:logic`.
 */
import { ordneUeberAnker, type AnkerListe } from '../shared/folgen-anker.ts'
import { ohneSerienVorsatz } from '../shared/folgen-praefix.ts'
import type { AnbieterFolge, TmdbFolge } from '../shared/folgen-zuordnung.ts'

let fehler = 0
let faelle = 0
const pruefe = (name: string, ok: boolean, detail = ''): void => {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${detail}`)
}

const prime = (zeilen: [number, string, string][]): AnbieterFolge[] => zeilen.map(([nummer, titel, datum]) => ({ nummer, titel, datum, minuten: null }))
const anker = (quelle: AnkerListe['quelle'], zeilen: [number, number, string | null, string | null][]): AnkerListe => ({
  quelle,
  folgen: zeilen.map(([s, e, titel, datum]): TmdbFolge => ({ s, e, titel, datum, minuten: null })),
})
/** Unsere Folge je Prime-Zeile, in der Reihenfolge der Adresse. */
const ziele = (a: AnbieterFolge[], l: AnkerListe[]): (number | null)[] => ordneUeberAnker(a, l).paare.map((p) => p.unsere)

const EDEN = prime([
  [1, 'Eden of the East - Ein Prinz ist gefunden', '2009-01-01'],
  [2, 'Eden of the East - Der sorglose Montag', '2009-01-01'],
  [3, 'Eden of the East - Der Abend der Spätvorstellung', '2009-01-01'],
  [4, 'Eden of the East - Realität oder Fitkion', '2009-01-01'],
  [5, 'Eden of the East - Falscher Zeitpunkt um Nachzudenken', '2009-01-01'],
  [6, 'Eden of the East - Eden of the East', '2009-01-01'],
  [7, 'Eden of the East - Der schwarze Schwan', '2009-01-01'],
])
const EDEN_AS = anker('aniSearch', [
  [1, 1, 'Der Prinz', '2009-04-10'],
  [1, 2, 'Der sorglose Montag', '2009-04-17'],
  [1, 3, 'Der Abend der Spätvorstellung', '2009-04-24'],
  [1, 4, 'Realität oder Fiktion', '2009-05-01'],
  [1, 5, 'Falscher Zeitpunkt um nachzudenken', '2009-05-08'],
  [1, 6, 'Eden of the East', '2009-05-15'],
  [1, 7, 'Der schwarze Schwan', '2009-05-22'],
])
const EDEN_TMDB = anker('TMDB', [
  [1, 1, 'Ich habe einen Prinzen gefunden', '2009-04-09'],
  [1, 2, 'Sorgloser Montag', '2009-04-16'],
  [1, 3, 'Die Spätvorstellung', '2009-04-23'],
  [1, 4, 'Real Reality, Imaginary Reality', '2009-04-30'],
  [1, 5, 'Falscher Zeitpunkt, um nachzudenken', '2009-05-07'],
  [1, 6, 'Eden of the East', '2009-05-14'],
  [1, 7, 'Der schwarze Schwan', '2009-05-21'],
])
const TAYO = prime([
  [1, 'Tayo Spielzeit 1 - Eröffnungslied', '2017-09-27'],
  [2, 'Tayo Spielzeit 1 - Ein Tag im Leben von Tayo', '2017-09-27'],
  [3, 'Tayo Spielzeit 1 - Tayo verirrt sich', '2017-10-06'],
  [4, 'Tayo Spielzeit 1 - Tayo\'s erste fahrt', '2017-10-12'],
  [5, 'Tayo Spielzeit 1 - Gute Freunde', '2017-10-19'],
  [6, 'Tayo Spielzeit 1 - Angst im dunkeln', '2017-10-26'],
  [7, 'Tayo Spielzeit 1 - Danke, Cito', '2017-11-02'],
])
const TAYO_AS = anker('aniSearch', [
  [1, 1, 'Ein Tag im Leben von Tayo', null],
  [1, 2, 'Tayo verirrt sich', null],
  [1, 3, 'Tayo\'s erste fahrt', null],
  [1, 4, 'Gute Freunde', null],
  [1, 5, 'Angst im dunkeln', null],
  [1, 6, 'Danke, Cito', null],
  [1, 7, 'Vertragen wir uns alle', null],
])
const TITIPO = prime([
  [1, 'Spielzeit 1 - Eröffnungssong', '2019-04-01'],
  [2, 'Spielzeit 1 - Völlig verirrt', '2019-04-01'],
  [3, 'Spielzeit 1 - Nächster Halt Groß Töffingen!', '2019-04-01'],
  [4, 'Spielzeit 1 - Titipos erste Fahrstrecke', '2019-04-01'],
  [5, 'Spielzeit 1 - Ich möchte doch nur alles richtig machen', '2019-04-01'],
  [6, 'Spielzeit 1 - Ein Besuch im Steinbruch', '2019-04-01'],
  [7, 'Spielzeit 1 - Freunde fürs Leben', '2019-04-01'],
])
const TITIPO_AS = anker('aniSearch', [
  [1, 1, 'Völlig verirrt', null],
  [1, 2, 'Nächster Halt Groß Töffingen!', null],
  [1, 3, 'Titipos erste Fahrstrecke', null],
  [1, 4, 'Ich möchte doch nur alles richtig machen', null],
  [1, 5, 'Ein Besuch im Steinbruch', null],
  [1, 6, 'Freunde fürs Leben', null],
  [1, 7, 'Was ist nur mit Manni los?', null],
])
const TITIPO_TMDB = anker('TMDB', [1, 2, 3, 4, 5, 6, 7].map((e): [number, number, null, string] => [1, e, null, `2018-01-0${e}`]))

/* Die drei echten Auslöser, mit allen Ankern wie im Lauf (aniSearch vor TMDB) */
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
pruefe('Eden: Zeilen 2,3,5,6,7 treffen, 1 und 4 (andere Wörter) bleiben offen', gleich(ziele(EDEN, [EDEN_AS, EDEN_TMDB]), [null, 2, 3, null, 5, 6, 7]))
pruefe('Tayo: Eröffnungslied fehlt bei aniSearch, die übrigen zählen von 1', gleich(ziele(TAYO, [TAYO_AS]), [null, 1, 2, 3, 4, 5, 6]))
pruefe('Titipo: Eröffnungssong fehlt bei aniSearch, die übrigen zählen von 1', gleich(ziele(TITIPO, [TITIPO_AS, TITIPO_TMDB]), [null, 1, 2, 3, 4, 5, 6]))
pruefe('Quelle bleibt aniSearch', ordneUeberAnker(EDEN, [EDEN_AS, EDEN_TMDB]).quelle === 'aniSearch')

/* Was schon zuordnet, ändert sich nie: ein einziger Treffer mit dem Vorsatz sperrt den zweiten Versuch */
{
  const mitVorsatz = anker('aniSearch', [[1, 99, 'Spielzeit 1 - Eröffnungssong', null], ...TITIPO_AS.folgen.map((f): [number, number, string | null, string | null] => [f.s, f.e, f.titel, f.datum])])
  pruefe('ein Treffer ohne Abschneiden bleibt der einzige', gleich(ziele(TITIPO, [mitVorsatz]), [99, null, null, null, null, null, null]))
}

/* ohneSerienVorsatz: Grenzen und Gegenfälle */
const titel = (...t: (string | null)[]): AnbieterFolge[] => t.map((x, i) => ({ nummer: i + 1, titel: x, datum: null, minuten: null }))
const kurz = (a: AnbieterFolge[]): (string | null)[] | null => ohneSerienVorsatz(a)?.map((x) => x.titel) ?? null
pruefe('drei von drei tragen den Vorsatz', gleich(kurz(titel('S - a', 'S - b', 'S - c')), ['a', 'b', 'c']))
pruefe('zwei Titel genügen nicht', kurz(titel('S - a', 'S - b')) === null)
pruefe('vier von fünf (80 %) tragen ihn', gleich(kurz(titel('S - a', 'S - b', 'S - c', 'S - d', 'ohne')), ['a', 'b', 'c', 'd', 'ohne']))
pruefe('drei von vier (75 %) tragen ihn nicht', kurz(titel('S - a', 'S - b', 'S - c', 'ohne')) === null)
pruefe('verschiedene Vorsätze: kein gemeinsamer', kurz(titel('Das Abenteuer beginnt - Teil I', 'Keine Haustiere - Teil I', 'Die Reise - Teil 2')) === null)
pruefe('Bindestrich ohne Leerzeichen trennt nicht', kurz(titel('Pac-Man a', 'Pac-Man b', 'Pac-Man c')) === null)
pruefe('Bindestrich nur mit Leerzeichen danach trennt nicht', kurz(titel('Teil 1- a', 'Teil 1- b', 'Teil 1- c')) === null)
pruefe('Groß- und Kleinschreibung des Vorsatzes ist gleich', gleich(kurz(titel('Tayo - a', 'tayo - b', 'TAYO - c')), ['a', 'b', 'c']))
pruefe('nur der erste Trenner schneidet', gleich(kurz(titel('S - a - x', 'S - b', 'S - c')), ['a - x', 'b', 'c']))
pruefe('Gedankenstrich (–) trennt wie der Bindestrich', gleich(kurz(titel('S – a', 'S – b', 'S – c')), ['a', 'b', 'c']))
pruefe('Geviertstrich (—) trennt wie der Bindestrich', gleich(kurz(titel('S — a', 'S — b', 'S — c')), ['a', 'b', 'c']))
pruefe('der häufigste Vorsatz gilt, nicht der seltenste', gleich(kurz(titel('S - a', 'S - b', 'S - c', 'S - d', 'T - e')), ['a', 'b', 'c', 'd', 'T - e']))
pruefe('Titel ohne Text bleiben null, Länge gleich', gleich(kurz(titel('S - a', 'S - b', 'S - c', 'S - d', null)), ['a', 'b', 'c', 'd', null]))
pruefe('Positionen und Nummern bleiben', ohneSerienVorsatz(titel('S - a', 'S - b', 'S - c'))!.map((x) => x.nummer).join() === '1,2,3')

if (fehler) process.exit(1)
console.log(`check-serien-vorsatz: ${faelle} Fälle grün (Eden of the East 5 von 7, Tayo und Titipo je 6 von 7 über den Vorsatz zugeordnet).`)
