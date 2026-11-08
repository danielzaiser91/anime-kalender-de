/**
 * Zusicherung: `blockWahl` (tools/cr-blockwahl.mjs) findet den deutschen Katalogblock eines Titels auch ohne Zahl im Blocknamen —
 * und ordnet nie falsch zu, wo mehrere Blöcke passen könnten. Die Blöcke sind wörtlich aus `data/crunchyroll-dub.json`
 * (Stand 08.11.2026, Name, Folgenzahl, erste datierte deutsche Folge); die Verdrahtung in Begleiter und Wache prüfen
 * `check-omu-synchro-begleiter.ts` und `tools/synchro-wartezeit.test.mjs`.
 * Aufruf: `npm run check:logic`.
 */
import { blockWahl } from '../tools/cr-blockwahl.mjs'
import { blockWahlFuer } from './bau/block-wahl-titel.ts'
import type { Title } from '../shared/types.ts'

const DOPPELT = 'Blockname gleicht nach dem Glätten einem zweiten Block der Serie'
const MEHRERE = 'mehrere Blöcke, keiner eindeutig'

let verletzt = 0
let geprueft = 0
function pruefe(ok: boolean, text: string, ist?: unknown): void {
  geprueft++
  if (!ok) {
    verletzt++
    console.log(`  ✖ ${text}`, ist === undefined ? '' : JSON.stringify(ist))
  }
}

const folge = (verfuegbarAb: string) => ({ nummer: 1, guid: 'g', laufend: 1, verfuegbarAb })
const block = (name: string, folgen: number, ab?: string) => ({ name, folgen, deutscheFolgen: ab ? [folge(ab)] : [] })
const serien = (...staffeln: ReturnType<typeof block>[]) => [{ url: 'u', seriesId: 'K1', katalog: 'de', staffeln }] as never
const wahl = (staffeln: ReturnType<typeof block>[], titel: Parameters<typeof blockWahl>[2]) => {
  const w = blockWahl(serien(...staffeln), 'K1', titel)
  return `${w.treffer?.block.name ?? '-'}|${w.weg ?? w.grund}`
}

// Einziger Block (Death Note, dreimal unter derselben Serie geführt): ohne Zahl, wenn kein anderer Titel die Serie teilt.
const TODESNOTIZ = block('Death Note', 37, '2025-05-15T16:00:00Z')
pruefe(wahl([TODESNOTIZ, TODESNOTIZ, TODESNOTIZ], { nummern: [1], geteilt: false }) === 'Death Note|einzig', 'Death Note: einziger Block trotz Dubletten')
pruefe(wahl([TODESNOTIZ], { nummern: [1], geteilt: true }) === '-|Serie geteilt, ein Block', 'geteilte Serie: ein Block gehört nicht dem erstbesten Titel')
const AKITO = block('Code Geass - Akito the Exiled', 5, '2022-12-13T07:59:00Z')
pruefe(wahl([AKITO], { nummern: [1], namen: ['Code Geass: Akito the Exiled - To Beloved Ones'], folgen: 1, geteilt: true }) === '-|Block hat mehr Folgen als der Titel', 'Akito: fünf Titel an einem Block bekommen ihn nicht')
pruefe(wahl([AKITO], { nummern: [1], namen: ['Code Geass: Akito the Exiled - To Beloved Ones'], geteilt: true }) === '-|Serie geteilt, ein Block', 'Akito ohne Folgenzahl: geteilte Serie')
// Der einzige Block ohne Zahl kann die Vorstaffel sein: nur für Titel, die als Staffel 1 zählen.
pruefe(wahl([TODESNOTIZ], { nummern: [2], geteilt: false }) === '-|einziger Block, Titel ist nicht Staffel 1', 'Staffel 2 bekommt den einzigen Block ohne Nummer nicht')
pruefe(wahl([TODESNOTIZ], { nummern: [], geteilt: false }) === '-|einziger Block, Titel ist nicht Staffel 1', 'unbekannte Staffelnummer bekommt ihn auch nicht')
pruefe(wahl([TODESNOTIZ], { nummern: [2, 1], geteilt: false }) === 'Death Note|einzig', 'Staffel 1 unter mehreren möglichen Nummern genügt')
// Ein Block mit deutschen Folgen vor dem OmU-Start ist eine Vorstaffel, die noch läuft (Tsukimichi 2 gegen den Block der 1. Staffel).
pruefe(wahl([TODESNOTIZ], { nummern: [1], geteilt: false, ab: '2025-05-15' }) === 'Death Note|einzig', 'Folge genau am Starttag zählt')
pruefe(wahl([TODESNOTIZ], { nummern: [1], geteilt: false, ab: '2025-05-16' }) === '-|Blöcke haben deutsche Folgen vor dem OmU-Start', 'Folge einen Tag vor dem Start zählt nicht')
const LAUFEND = { name: 'Tsukimichi', folgen: 2, deutscheFolgen: [folge('2024-05-14T10:00:00Z'), folge('2024-05-16T10:00:00Z')] }
pruefe(wahl([LAUFEND], { nummern: [1], namen: ['Tsukimichi'], geteilt: false, ab: '2024-05-15' }) === '-|Blöcke haben deutsche Folgen vor dem OmU-Start', 'Block, der vor dem Start begann und nach dem Start weiterläuft, zählt nicht')
pruefe(wahl([LAUFEND], { nummern: [1], namen: ['Tsukimichi'], geteilt: false }) === 'Tsukimichi|einzig', 'ohne Starttag (Titel allein) bleibt der Block wählbar')
// Ein Block mit mehr als einer Folge über der Titelzahl gehört auch anderen Titeln (K-ON!! mit 27 Folgen gegen K-ON! mit 13).
const KON = [block('K-ON!! (German Dub)', 27, '2021-03-17T17:00:00Z'), block('K-ON! The Movie', 2, '2021-12-15T17:00:00Z')]
pruefe(wahl(KON, { nummern: [1], namen: ['K-ON!'], folgen: 13, geteilt: false }) === '-|mehrere Blöcke, keiner eindeutig', 'K-ON! bekommt nicht den Block von K-ON!!')
pruefe(wahl([block('Riddle', 13, '2021-01-27T00:00:00Z')], { nummern: [1], folgen: 12, geteilt: false }) === 'Riddle|einzig', 'ein Block mit einer Folge mehr (Zusammenfassung) passt')
pruefe(wahl([block('Riddle', 14, '2021-01-27T00:00:00Z')], { nummern: [1], folgen: 12, geteilt: false }) === '-|Block hat mehr Folgen als der Titel', 'zwei Folgen mehr passen nicht')
pruefe(wahl([block('Riddle', 4, '2021-01-27T00:00:00Z')], { nummern: [1], folgen: 12, geteilt: false }) === 'Riddle|einzig', 'ein kürzerer Block (nur ein Teil ist deutsch) passt')
pruefe(wahl([TODESNOTIZ, block('Death Note Relight', 2)], { nummern: [1], geteilt: false }) === 'Death Note|einzig', 'ein undatierter Nachbarblock zählt nicht mit')

// Name: Blockname gleicht dem Titelnamen (ohne Satzzeichen, Groß-/Kleinschreibung, „(German Dub)“).
const NAGATORO = [block('Don\'t Toy with Me, Miss Nagatoro', 12, '2021-04-10T00:00:00Z'), block('Don’t Toy With Me, Miss Nagatoro 2nd Attack (German Dub)', 12, '2023-01-28T00:00:00Z')]
pruefe(wahl(NAGATORO, { nummern: [2], namen: ['DON\'T TOY WITH ME, MISS NAGATORO 2nd Attack'], folgen: 12, geteilt: false }).endsWith('|name'), 'Nagatoro 2nd Attack: Name trotz Apostroph, Großschreibung und (German Dub)')
pruefe(wahl(NAGATORO, { nummern: [1], namen: ['Don\'t Toy with Me, Miss Nagatoro'], folgen: 12, geteilt: false }) === 'Don\'t Toy with Me, Miss Nagatoro|name', 'Nagatoro Staffel 1 bekommt den ersten Block')
pruefe(wahl(NAGATORO, { nummern: [], namen: ['Ganz anderer Titel'], folgen: 12, geteilt: false }) === '-|mehrere Blöcke, keiner eindeutig', 'ohne Namenstreffer bei gleicher Folgenzahl keine Wahl')

// Folgenzahl nur zusammen mit dem Namensende und ab zwei Folgen (Classroom of the Elite 4, Tonikawa, Golden Kamuy).
const CLASSROOM = [block('Season 1', 12, '2022-08-03T19:00:00Z'), block('Classroom of the Elite Staffel 2', 13, '2022-08-01T19:00:00Z'), block('Classroom of the Elite Staffel 3', 13, '2024-01-24T20:00:00Z'), block('4th Season: Second Year, First Semester', 16, '2026-05-06T12:30:00Z')]
const CLASSROOM_4 = ['Classroom of the Elite 4th Season: Second Year, First Semester']
pruefe(wahl(CLASSROOM, { nummern: [4], namen: CLASSROOM_4, folgen: 16, geteilt: false }) === '4th Season: Second Year, First Semester|folgen', 'Classroom of the Elite 4: Block über Folgenzahl und Namensende')
pruefe(wahl(CLASSROOM, { nummern: [4], namen: CLASSROOM_4, folgen: 15, geteilt: false }) === '-|mehrere Blöcke, keiner eindeutig', 'Classroom 4 mit 15 statt 16 Folgen: kein Block')
pruefe(wahl(CLASSROOM, { nummern: [4], namen: ['Ganz anderer Titel'], folgen: 16, geteilt: false }) === '-|mehrere Blöcke, keiner eindeutig', 'Classroom 4 ohne Namensende: kein Block')
pruefe(wahl(CLASSROOM, { nummern: [4], namen: CLASSROOM_4, geteilt: false }) === '-|mehrere Blöcke, keiner eindeutig', 'Classroom 4 ohne Folgenzahl: kein Block')
const TONIKAWA = [block('Season 1', 14, '2020-10-03T06:59:00Z'), block('TONIKAWA: Over The Moon For You Staffel 2', 12, '2022-11-23T07:59:00Z'), block('~High School Days~', 4, '2023-07-13T06:59:00Z')]
pruefe(wahl(TONIKAWA, { nummern: [], namen: ['TONIKAWA: Over The Moon For You ~High School Days~'], folgen: 4, geteilt: false }) === '~High School Days~|folgen', 'Tonikawa High School Days: Block über Folgenzahl 4')
// Zwei Folgen reichen, eine nicht: Filme und Einzelfolgen haben alle 1 (Attack on Titan Part I ≠ „Last Attack“).
const TITAN = [block('Attack on Titan: Season 2', 12, '2022-02-08T17:00:00Z'), block('Attack on Titan: Last Attack', 1, '2025-04-18T00:00:00Z'), block('Attack on Titan OADs', 8, '2022-10-19T19:00:00Z')]
pruefe(wahl(TITAN, { nummern: [], namen: ['Attack on Titan Part I: Crimson Bow and Arrow'], folgen: 1, geteilt: true }) === '-|mehrere Blöcke, keiner eindeutig', 'Film mit einer Folge bekommt keinen Einzelfolgen-Block')
const MINI = [block('Alpha Teil', 2, '2024-01-01T00:00:00Z'), block('Beta Teil', 3, '2024-02-01T00:00:00Z')]
pruefe(wahl(MINI, { nummern: [], namen: ['Serie Alpha Teil'], folgen: 2, geteilt: true }) === 'Alpha Teil|folgen', 'Folgenzahl und Namensende wählen den Block')
// Einzelfolgen mit Namensende gehen auch (MHA „I am a hero too“, 1 Folge); eine Einzelfolge ohne Namensende nie.
const MHA = [block('Season 6', 26, '2022-10-29T00:00:00Z'), block('FINAL SEASON', 12, '2025-10-25T00:00:00Z'), block('I am a hero too', 1, '2026-08-02T00:00:00Z')]
pruefe(wahl(MHA, { nummern: [], namen: ['My Hero Academia: I am a hero too'], folgen: 1, geteilt: true }) === 'I am a hero too|folgen', 'MHA I am a hero too: Einzelfolge über Namensende')
pruefe(wahl(MHA, { nummern: [], namen: ['My Hero Academia More'], folgen: 1, geteilt: true }) === '-|mehrere Blöcke, keiner eindeutig', 'MHA More: Einzelfolge ohne Namensende bleibt offen')
pruefe(wahl(MHA, { nummern: [], namen: ['My Hero Academia FINAL SEASON'], folgen: 11, geteilt: true }) === '-|mehrere Blöcke, keiner eindeutig', 'MHA FINAL SEASON mit 11 statt 12 Folgen bleibt offen')
// Namensende ab 8 Zeichen (ohne Satzzeichen): „OVAs“ ist zu kurz, „Teil Eins“ reicht.
const KURZ = [block('OVAs', 2, '2024-01-01T00:00:00Z'), block('Zwei', 3, '2024-02-01T00:00:00Z')]
pruefe(wahl(KURZ, { nummern: [], namen: ['Serie OVAs'], folgen: 2, geteilt: true }) === '-|mehrere Blöcke, keiner eindeutig', 'Namensende unter 8 Zeichen zählt nicht')
const ACHT = [block('Teil Eins', 2, '2024-01-01T00:00:00Z'), block('Zwei', 3, '2024-02-01T00:00:00Z')]
pruefe(wahl(ACHT, { nummern: [], namen: ['Serie Teil Eins'], folgen: 2, geteilt: true }) === 'Teil Eins|folgen', 'Namensende mit genau 8 Zeichen zählt')
// Stammen die Staffelnummern nur aus dem Namen (Wache), scheidet der Grundname neben einer Folgestaffel aus (Vinland Saga).
const VINLAND = [block('VINLAND SAGA', 24, '2022-07-07T00:00:00Z'), block('VINLAND SAGA SEASON 2', 24, '2023-01-10T00:00:00Z')]
pruefe(wahl(VINLAND, { nummern: [1], namen: ['Vinland Saga'], folgen: 24, geteilt: false }) === 'VINLAND SAGA|name', 'Vinland Saga mit Reihe: der Grundname ist Staffel 1')
pruefe(wahl(VINLAND, { nummern: [1], namen: ['Vinland Saga'], folgen: 24, geteilt: false, nummernAusName: true }) === '-|mehrere Blöcke, keiner eindeutig', 'Vinland Saga nur nach dem Namen: keine Wahl')
pruefe(wahl(NAGATORO, { nummern: [], namen: ['Don\'t Toy with Me, Miss Nagatoro 2nd Attack'], folgen: 12, geteilt: false, nummernAusName: true }).endsWith('|name'), 'der Block mit dem längeren Namen bleibt wählbar')
const GRUNDFOLGEN = [block('Folge Alpha', 2, '2024-01-01T00:00:00Z'), block('Folge Alpha Teil Zwei', 3, '2024-02-01T00:00:00Z')]
pruefe(wahl(GRUNDFOLGEN, { nummern: [1], namen: ['Titel Folge Alpha'], folgen: 2, geteilt: true, nummernAusName: true }) === '-|mehrere Blöcke, keiner eindeutig', 'Grundname scheidet auch für den Weg über die Folgenzahl aus')
pruefe(wahl(GRUNDFOLGEN, { nummern: [1], namen: ['Titel Folge Alpha'], folgen: 2, geteilt: true }) === 'Folge Alpha|folgen', '…mit Reihe bleibt er wählbar')
// Nur ein Namensanfang ist ein Grundname; steckt der Name mitten in einem anderen, bleibt er wählbar.
const MITTE = [block('Kleine Reise', 12, '2024-01-01T00:00:00Z'), block('Die Kleine Reise Zwei', 12, '2024-02-01T00:00:00Z')]
pruefe(wahl(MITTE, { nummern: [1], namen: ['Kleine Reise'], folgen: 12, geteilt: true, nummernAusName: true }) === 'Kleine Reise|name', 'Name mitten in einem anderen Blocknamen ist kein Grundname')
// Zwei gleich lange Blöcke mit Namensende: keine Wahl.
const ZWILLING = [block('Folge Alpha', 2, '2024-01-01T00:00:00Z'), block('Folge Beta', 2, '2024-02-01T00:00:00Z')]
pruefe(wahl(ZWILLING, { nummern: [], namen: ['Titel Folge Alpha', 'Titel Folge Beta'], folgen: 2, geteilt: true }) === '-|mehrere Blöcke, keiner eindeutig', 'zwei passende Blöcke: keine Wahl')

// Der Name der Vorstaffel am Anfang des Titelnamens ist kein Treffer (Ron Kamonohashi 2 darf nicht Staffel 1 bekommen).
const RON = [block('Meisterdetektiv Ron Kamonohashi', 13, '2024-02-14T04:00:00Z'), block('Meisterdetektiv Ron Kamonohashi 2nd Season', 13, '2024-10-28T09:00:00Z')]
const RON_2 = ['Ron Kamonohashi’s Forbidden Deductions Season 2', 'Meisterdetektiv Ron Kamonohashi Season 2']
pruefe(wahl(RON, { nummern: [2], namen: RON_2, folgen: 13, geteilt: false }) === '-|mehrere Blöcke, keiner eindeutig', 'Ron Kamonohashi 2: nie der Block der Vorstaffel')
pruefe(wahl(RON, { nummern: [1], namen: ['Meisterdetektiv Ron Kamonohashi'], folgen: 13, geteilt: false }) === 'Meisterdetektiv Ron Kamonohashi|name', 'Ron Kamonohashi 1 bekommt seinen Block')

// Ein Block, der eine andere Staffel nennt, kommt nie in Frage (Black Clover Staffel 2 gegen „Season 1 Part 4“; MHA Vigilantes).
pruefe(wahl([block('Season 1 Part 4', 16, '2024-08-14T15:00:00Z')], { nummern: [2], namen: ['Black Clover – Staffel 2'], geteilt: false }) === '-|alle Blöcke tragen eine andere Staffelnummer', 'Season 1 Part 4 gehört nicht zu Staffel 2')
pruefe(wahl([block('Foo 2nd Season', 12, '2024-01-01T00:00:00Z')], { nummern: [1], geteilt: false }) === '-|alle Blöcke tragen eine andere Staffelnummer', '„2nd Season“ nennt Staffel 2')
pruefe(wahl([block('Foo Season2', 12, '2024-01-01T00:00:00Z')], { nummern: [1], geteilt: false }) === '-|alle Blöcke tragen eine andere Staffelnummer', '„Season2“ ohne Leerzeichen nennt Staffel 2')
pruefe(wahl([block('Foo Season 2 Part 2', 12, '2024-01-01T00:00:00Z')], { nummern: [2], geteilt: false }) === '-|einziger Block nennt eine Staffel', 'einziger Block mit Staffelzusatz („Season 2 Part 2“) bleibt offen, auch wenn er passt')

// Zahl im Namen bleibt der erste Weg; mehrere Blöcke derselben Nummer sind mehrdeutig, kein Rückgriff auf die Folgenregeln.
const ICEBLADE = [block('Season 1', 12, '2023-01-06T00:00:00Z'), block('Staffel 2', 5, '2026-10-29T00:00:00Z')]
pruefe(wahl(ICEBLADE, { nummern: [2], namen: ['The Iceblade Sorcerer Shall Rule the World II'], folgen: 5, geteilt: false }) === 'Staffel 2|zahl', 'Iceblade Sorcerer II: Zahl im Namen')
pruefe(wahl([block('Staffel 2', 12, '2025-04-26T00:00:00Z'), block('Season 2', 12, '2025-04-26T00:00:00Z')], { nummern: [2], namen: ['Staffel 2'], folgen: 12, geteilt: false }) === '-|mehrere Blöcke zur selben Staffelnummer', 'zwei Blöcke derselben Nummer: keine Wahl')

// Namen, die nach dem Glätten gleich sind, aber zu zwei Blöcken gehören, geben keine Wahl.
const GLEICH = [block('Folge Alpha', 2, '2024-01-01T00:00:00Z'), block('FOLGE ALPHA!', 3, '2024-02-01T00:00:00Z')]
pruefe(wahl(GLEICH, { nummern: [], namen: ['Folge Alpha'], folgen: 9, geteilt: true }) === `-|${DOPPELT}`, 'zwei gleich geglättete Blocknamen: keine Wahl, eigener Grund')
// Echte Blöcke aus dem Katalog (Stand 08.11.2026): „Cells at Work!“ 14 Folgen ab 2018-07-07, „Cells at Work!!“ 8 ab 2021-02-06. Ein Starttag einen Tag
// nach der ersten deutschen Folge räumt den richtigen Block weg; der geglättete Name darf dann nicht den zweiten treffen.
const CELLS = [block('Cells at Work!', 14, '2018-07-07T16:30:00Z'), block('Cells at Work!!', 8, '2021-02-06T16:00:00Z')]
const cells = (ab: string, folgen: number, nummern: number[]) => wahl(CELLS, { nummern, namen: ['Cells at Work!'], folgen, geteilt: false, ab })
pruefe(cells('2018-07-08', 13, [1]) === `-|${DOPPELT}`, 'Cells at Work! Staffel 1, Starttag einen Tag nach der ersten Folge: nie „Cells at Work!!“')
pruefe(cells('2018-07-07', 13, [1]) === `-|${DOPPELT}`, 'Cells at Work! mit Starttag am ersten Tag: offen mit Grund')
pruefe(cells('2018-07-08', 14, [1]) === `-|${DOPPELT}`, 'Cells at Work! mit passender Folgenzahl: offen')
pruefe(wahl(CELLS, { nummern: [2], namen: ['Cells at Work!!'], folgen: 8, geteilt: false, ab: '2021-02-06' }) === `-|${DOPPELT}`, 'Cells at Work!! Staffel 2: derselbe Glattname, offen')
// Der eigene Grund nur, wenn der doppelte Name auch zum Titel passt; sonst bleibt der allgemeine.
pruefe(wahl(CELLS, { nummern: [], namen: ['Ganz anderer Titel'], folgen: 3, geteilt: true }) === `-|${MEHRERE}`, 'doppelter Glattname ohne Bezug zum Titel: allgemeiner Grund')
pruefe(wahl(CELLS, { nummern: [], namen: ['Serie Cells at Work'], folgen: 14, geteilt: true }) === `-|${DOPPELT}`, 'doppelter Glattname über den Folgenweg (Namensende, 14 Folgen): eigener Grund')
// Auch ein Block, den eine genannte andere Staffel aus der Wahl nimmt, macht den Namen doppelt (Prüfung über alle Blöcke, nicht nur die freien).
const ZWEITE = [block('Foo Bar Baz', 12, '2024-01-01T00:00:00Z'), block('Foo Bar Baz (German Dub, 2nd Season)', 12, '2024-06-01T00:00:00Z')]
pruefe(wahl(ZWEITE, { nummern: [1], namen: ['Foo Bar Baz'], folgen: 12, geteilt: false }) === `-|${DOPPELT}`, 'Doppelname auch mit einem Block, der eine andere Staffel nennt')
// Weitere echte Paare: „OVA“ / „OVA (German Dub)“ und die zwei Sprachfassungen von „INVADERS of the ROKUJYOMA!?“ (Namensweg und Folgenweg).
const OVAS = [block('OVA', 2, '2024-01-01T00:00:00Z'), block('OVA (German Dub)', 2, '2024-02-01T00:00:00Z')]
pruefe(wahl(OVAS, { nummern: [], namen: ['OVA'], folgen: 2, geteilt: true }) === `-|${DOPPELT}`, 'OVA / OVA (German Dub): offen')
const ROKU = [block('INVADERS of the ROKUJYOMA!? (German Dub)', 12, '2023-11-28T00:00:00Z'), block('INVADERS of the ROKUJYOMA!? (German Europe)', 12, '2023-11-28T00:00:00Z')]
pruefe(wahl(ROKU, { nummern: [], namen: ['INVADERS of the ROKUJYOMA!?'], folgen: 12, geteilt: true }) === `-|${DOPPELT}`, 'Rokujyoma: zwei Sprachfassungen, Namensweg offen')
pruefe(wahl(ROKU, { nummern: [], namen: ['Die Rokujyoma Serie INVADERS of the ROKUJYOMA!? (German Dub)'], folgen: 12, geteilt: true }) === `-|${DOPPELT}`, 'Rokujyoma: Folgenweg offen')
// Ein doppelter Glattname verdeckt nur die eigenen Blöcke: der Nachbar mit eigenem Namen bleibt wählbar.
const MIT_NACHBAR = [...CELLS, block('Cells at Work: Black', 8, '2021-02-06T16:00:00Z')]
pruefe(wahl(MIT_NACHBAR, { nummern: [], namen: ['Cells at Work: Black'], folgen: 8, geteilt: false }) === 'Cells at Work: Black|name', 'Nachbarblock mit eigenem Namen bleibt wählbar')

// Platzhalter-Datum (2001-01-02): kein Starttag. Faraway Paladin 1: 12 von 13 Folgen mit Platzhalter, eine echt (2021-11-27).
const platz = (name: string, folgen: number, echt?: string) => ({ name, folgen, deutscheFolgen: [folge('2001-01-02T07:59:00Z'), ...(echt ? [folge(echt)] : [])] })
const PALADIN = [platz('The Faraway Paladin', 13, '2021-11-27T16:00:00Z'), block('The Faraway Paladin The Lord Of The Rust Mountains', 12, '2023-11-05T00:00:00Z')]
pruefe(wahl(PALADIN, { nummern: [1], namen: ['The Faraway Paladin'], folgen: 13, geteilt: false, ab: '2021-10-10' }) === 'The Faraway Paladin|name', 'gemischter Block mit Platzhalter und echter Folge wird gewählt')
pruefe(wahl(PALADIN, { nummern: [1], namen: ['The Faraway Paladin'], folgen: 13, geteilt: false, ab: '2021-11-28' }) === `-|${MEHRERE}`, 'die echte Folge vor dem Starttag schließt den Block weiter aus')
pruefe(wahl([platz('Ranking of Kings', 23)], { nummern: [1], namen: ['Ranking of Kings'], folgen: 23, geteilt: false }) === '-|deutsche Folgen nur mit Platzhalter-Datum', 'Block nur mit Platzhalter ist nie zugeordnet (ohne Starttag)')
pruefe(wahl([platz('Ranking of Kings', 23)], { nummern: [1], namen: ['Ranking of Kings'], folgen: 23, geteilt: false, ab: '2021-10-10' }) === '-|deutsche Folgen nur mit Platzhalter-Datum', 'Block nur mit Platzhalter ist nie zugeordnet (mit Starttag)')
// Ein Block mit Platzhalter zählt als Block (kein „einziger Block“ daneben: Ranking of Kings 1 bekäme sonst den Nachbarblock), wird aber nie gewählt.
const KOENIGE = [platz('Ranking of Kings', 23), block('Anderer Teil', 12, '2022-01-01T00:00:00Z')]
pruefe(wahl(KOENIGE, { nummern: [1], geteilt: false }) === `-|${MEHRERE}`, 'Platzhalterblock neben einem echten: der echte ist nicht „einziger Block“')
pruefe(wahl(KOENIGE, { nummern: [1], namen: ['Ranking of Kings'], folgen: 23, geteilt: false }) === `-|${MEHRERE}`, 'der Name des Platzhalterblocks wählt ihn nicht')
pruefe(wahl(KOENIGE, { nummern: [1], namen: ['Ranking of Kings'], folgen: 23, geteilt: false, ab: '2021-10-10' }) === `-|${MEHRERE}`, 'der Name des Platzhalterblocks wählt ihn auch mit Starttag nicht')
pruefe(wahl(KOENIGE, { nummern: [1], namen: ['Anderer Teil'], folgen: 12, geteilt: false }) === 'Anderer Teil|name', 'der echte Nachbarblock bleibt über seinen Namen wählbar')
pruefe(wahl([{ name: 'Grenze', folgen: 2, deutscheFolgen: [folge('2001-01-03T00:00:00Z')] }], { nummern: [1], geteilt: false }) === 'Grenze|einzig', 'ab dem 3. Januar 2001 ist das Datum echt')
pruefe(wahl([{ name: 'Grenze', folgen: 2, deutscheFolgen: [folge('2001-01-02T23:59:00Z')] }], { nummern: [1], geteilt: false }) === '-|deutsche Folgen nur mit Platzhalter-Datum', 'der 2. Januar 2001 bis 23:59 ist Platzhalter')

// Namensquellen des Titels (`blockWahlFuer`): jede Quelle trägt allein einen Treffer; es genügt ein Titelname, der auf den Blocknamen endet.
const titelMit = (felder: object) => ({ id: 900101, titleEn: undefined, titleRomaji: undefined, titleDe: undefined, format: 'TV', jpYear: 2024, episodes: 12, streams: [], ...felder }) as unknown as Title
const fuer = (felder: object, staffeln: ReturnType<typeof block>[]) => {
  const t = titelMit(felder)
  const w = blockWahlFuer(t, new Map([[t.id, t]]), 'K1', serien(...staffeln))
  return `${w.treffer?.block.name ?? '-'}|${w.weg ?? w.grund}`
}
const ZWEI = (a: string) => [block(a, 12, '2024-01-01T00:00:00Z'), block('Zebra Beta Gamma', 12, '2024-02-01T00:00:00Z')]
pruefe(fuer({ titleDe: 'The Final Season', titleEn: 'Anderer Name', titleRomaji: 'Dritter Name' }, ZWEI('The Final Season')) === 'The Final Season|name', 'Name nur über titleDe (Ron Kamonohashi 158926): Treffer')
pruefe(fuer({ titleDe: 'Die Reise', titleEn: 'Alpha Quest Final', titleRomaji: 'Dritter Name' }, ZWEI('Alpha Quest Final')) === 'Alpha Quest Final|name', 'Name nur über titleEn: Treffer')
pruefe(fuer({ titleDe: 'The Final Season', titleEn: 'Anderer Name' }, ZWEI('Die finale Staffel')) === 'Die finale Staffel|name', 'Name nur über den Anzeigenamen (eindeutschenStaffel): Treffer')
pruefe(fuer({ titleDe: 'Die Reise', titleEn: 'Anderer Name', titleRomaji: 'Quest Drei Romaji' }, ZWEI('Quest Drei Romaji')) === 'Quest Drei Romaji|name', 'Name nur über titleRomaji: Treffer')
pruefe(fuer({ titleDe: 'Die Reise', titleEn: 'Anderer Name' }, ZWEI('Quest Drei Romaji')) === `-|${MEHRERE}`, 'Kontrolle: keine der Namensquellen passt, kein Treffer')
// Mehrere Titelnamen, nur einer endet auf den Blocknamen („some“, nicht „every“): Folgenweg.
const MINI2 = [block('Alpha Teil', 2, '2024-01-01T00:00:00Z'), block('Beta Teil', 3, '2024-02-01T00:00:00Z')]
pruefe(wahl(MINI2, { nummern: [], namen: ['Serie Alpha Teil', 'Ganz Anders'], folgen: 2, geteilt: true }) === 'Alpha Teil|folgen', 'zwei Titelnamen, nur einer endet auf den Blocknamen: Block gewählt')

// Nur der deutsche Katalog und nur die eigene Serie zählen.
const fremd = (katalog: string, seriesId: string) => [{ url: 'u', seriesId, katalog, staffeln: [block('Death Note', 37, '2025-05-15T16:00:00Z')] }] as never
pruefe(blockWahl(fremd('us', 'K1'), 'K1', { nummern: [1] }).grund === 'kein datierter deutscher Block', 'US-Katalog belegt nichts')
pruefe(blockWahl(fremd('de', 'ANDERE'), 'K1', { nummern: [1] }).grund === 'kein datierter deutscher Block', 'Block einer anderen Serie zählt nicht')

// Auch der Weg über die Zahl liest nur den deutschen Katalog und nur die eigene Serie, wenn es daneben einen deutschen Block gibt.
const mitNachbar = (katalog: string, seriesId: string) => [
  { url: 'u', seriesId: 'K1', katalog: 'de', staffeln: [block('Foo', 12, '2025-01-01T00:00:00Z')] },
  { url: 'u', seriesId, katalog, staffeln: [block('Staffel 2', 12, '2025-02-01T00:00:00Z')] },
] as never
pruefe(blockWahl(mitNachbar('us', 'K1'), 'K1', { nummern: [2] }).grund === 'einziger Block, Titel ist nicht Staffel 1', 'Block „Staffel 2“ im US-Katalog zählt nicht')
pruefe(blockWahl(mitNachbar('de', 'ANDERE'), 'K1', { nummern: [2] }).grund === 'einziger Block, Titel ist nicht Staffel 1', 'Block „Staffel 2“ einer anderen Serie zählt nicht')
pruefe(blockWahl(mitNachbar('de', 'K1'), 'K1', { nummern: [2] }).weg === 'zahl', 'Kontrolle: derselbe Block in der eigenen deutschen Serie zählt')

pruefe(wahl([block('Staffel 2', 12, '2025-01-01T00:00:00Z'), block('Season 2', 12)], { nummern: [2] }) === 'Staffel 2|zahl', 'ein undatierter Block gleicher Nummer zählt nicht mit')

// Offene Fälle tragen einen Grund, auch ohne Blöcke.
pruefe(wahl([], { nummern: [1] }) === '-|kein datierter deutscher Block', 'keine Blöcke: Grund genannt')
pruefe(wahl([block('Solo', 12)], { nummern: [1] }) === '-|kein datierter deutscher Block', 'nur undatierter Block: Grund genannt')

if (verletzt) {
  console.log(`${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`check-cr-blockwahl: ${geprueft} Zusicherungen halten (einzig, name, folgen, Vorstaffel, andere Staffelnummer, Zahl zuerst).`)
