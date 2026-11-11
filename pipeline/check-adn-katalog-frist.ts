/**
 * Zusicherungen zu `lib/adn-katalog-frist.ts` (Vorschlag Bauer 3296, 09.11.2026): Ablauffrist für leere ADN-Antworten (zwei Läufe in Folge) und
 * Schwund-Wache (mehr als 5 % weniger Serien als im Stand auf main). Der Ablauf durch `fetch-adn.ts` steht in `check-adn-katalog-frist-lauf.ts`.
 */
import { katalogMitFrist, LEERE_LAEUFE_BIS_STREICHUNG, schrumpftZuStark, zaehleLeereLaeufe } from './lib/adn-katalog-frist.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const auskunft = (gefragt: number[], leer: number[], entschieden = gefragt) => ({ gefragt: new Set(gefragt), entschieden: new Set(entschieden), leer: new Set(leer) })
const ids = (...n: number[]) => new Set(n)

// Zähler
const eins = zaehleLeereLaeufe({}, ids(1, 2), auskunft([1, 2], [1]))
pruefe('eine leere Antwort: Zähler 1, nichts gestrichen', JSON.stringify(eins) === '{"zaehler":{"1":1},"gestrichen":[]}', eins)
const zwei = zaehleLeereLaeufe({ '1': 1 }, ids(1, 2), auskunft([1, 2], [1]))
pruefe('zweite leere Antwort in Folge: gestrichen, Zähler weg', JSON.stringify(zwei) === '{"zaehler":{},"gestrichen":[1]}', zwei)
const zurueck = zaehleLeereLaeufe({ '1': 1 }, ids(1), auskunft([1], []))
pruefe('leer, dann voll: Zähler zurück', JSON.stringify(zurueck) === '{"zaehler":{},"gestrichen":[]}', zurueck)
const abbruch = zaehleLeereLaeufe({ '1': 1 }, ids(1), auskunft([1], [], []))
pruefe('gefragt und abgebrochen: Zähler bleibt', JSON.stringify(abbruch.zaehler) === '{"1":1}' && !abbruch.gestrichen.length, abbruch)
const ungefragt = zaehleLeereLaeufe({ '1': 1 }, ids(1), auskunft([], []))
pruefe('nicht gefragt: Zähler bleibt', JSON.stringify(ungefragt.zaehler) === '{"1":1}', ungefragt)
const fremd = zaehleLeereLaeufe({ '9': 1 }, ids(1), auskunft([], []))
pruefe('Kennung ohne Katalogeintrag fällt aus dem Zähler', JSON.stringify(fremd.zaehler) === '{}', fremd)
pruefe('Frist ist zwei Läufe', LEERE_LAEUFE_BIS_STREICHUNG === 2)
const drei = zaehleLeereLaeufe({ '1': 2 }, ids(1), auskunft([1], [1]))
pruefe('Stand über der Frist (3. leere Antwort) streicht ebenfalls', drei.gestrichen.join() === '1', drei)

// Schwund
pruefe('6 % Schwund: rot', schrumpftZuStark(100, 94))
pruefe('4 % Schwund: grün', !schrumpftZuStark(100, 96))
pruefe('genau 5 %: grün', !schrumpftZuStark(100, 95))
pruefe('5,1 %: rot', schrumpftZuStark(1000, 949))
pruefe('Wachstum: grün', !schrumpftZuStark(100, 120))
pruefe('leerer alter Katalog: grün', !schrumpftZuStark(0, 0))

// Zusammenspiel: Katalog von 20, `rot` nur über die Wache
const eintrag = (showId: number) => ({ showId, titel: `S${showId}` })
const alt = Array.from({ length: 20 }, (_, i) => eintrag(i + 1))
const beide = katalogMitFrist(alt, [], auskunft([1, 2], [1, 2], [1, 2]), { '1': 1, '2': 1 })
pruefe('zwei Streichungen aus 20: Katalog 18, rot', beide.shows.length === 18 && beide.rot && beide.gestrichen === 2, beide)
pruefe('zwei Streichungen: Zeile nennt Schwund', beide.zeilen.some((z) => z.includes('schrumpft von 20 auf 18')), beide.zeilen)
const eineS = katalogMitFrist(alt, [], auskunft([1], [1]), { '1': 1 })
pruefe('eine Streichung aus 20 (5 %): grün, Zähler leer', !eineS.rot && eineS.shows.length === 19 && Object.keys(eineS.zaehler).length === 0, eineS)
const erste = katalogMitFrist(alt, [], auskunft([1], [1]), {})
pruefe('erste leere Antwort: Serie bleibt, Zähler 1', erste.shows.length === 20 && erste.zaehler['1'] === 1 && !erste.rot, erste)
pruefe('Logzeile nennt Anzahl und Kennungen', eineS.zeilen[0] === 'ADN-Katalog: 1 Serien nach 2 leeren Antworten in Folge gestrichen (1), 0 mit leerer Antwort vorgemerkt', eineS.zeilen[0])
pruefe('Logzeile: erste leere Antwort wird als vorgemerkt gezählt', erste.zeilen[0] === 'ADN-Katalog: 0 Serien nach 2 leeren Antworten in Folge gestrichen, 1 mit leerer Antwort vorgemerkt', erste.zeilen[0])
const echt = katalogMitFrist(alt, [eintrag(1)], auskunft([1], []), { '1': 1 })
pruefe('frische Antwort mit Deutsch ersetzt den alten Eintrag, Zähler leer', echt.shows.length === 20 && Object.keys(echt.zaehler).length === 0, echt)
pruefe('frisch ohne Deutsch (vollständig, nicht leer): fällt wie bisher heraus, zählt als entfernt', katalogMitFrist(alt, [], auskunft([3], []), {}).entfernt === 1)

console.log()
if (verletzt) {
  console.error(`${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
console.log('VERSTÖSSE: 0')
