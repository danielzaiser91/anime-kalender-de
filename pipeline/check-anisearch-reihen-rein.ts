/**
 * Zusicherungen zur reinen aniSearch-Reihenbildung (`REIHEN_QUELLE=anisearch`, Schritt 6 der AniList-Ablösung, 12.10.2026): Schalter, Regel für „?" und Sammelarten,
 * Handdatei (`ids:`, `getrennt:`), feste Reihen des Katalogs. Läuft in `check:logic`.
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Kante, Namen } from './bau/anisearch-reihen.ts'
import type { KatalogEintrag } from './lib/anilist.ts'
import { anilistKantenOhneKennung, ladeHand } from './bau/anisearch-reihen-rein-bau.ts'
import { type ReinHand, type ReinTitel, rangDerArt, bestandReihenAusAnisearch, katalogReihenAusAnisearch, reineReihen } from './bau/anisearch-reihen-rein.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

type Ergebnis = ReturnType<typeof reineReihen>
const k = (a: number, b: number, art: string): Kante => ({ a, b, art })
const titel = (...ids: number[]): ReinTitel[] => ids.map((id) => ({ id, name: `T${id}`, anisearchId: id }))
const ohneHand: ReinHand = { verbinden: [], trennen: [] }
const gleichNamen: Namen = new Map([1, 2, 3, 4, 5, 6, 12, 20].map((id) => [id, [`Final Fantasy ${id}`]]))
const reihe = (e: Ergebnis, id: number): number => e.reihe.get(id)!
const faelle = (e: Ergebnis, art: string): number => e.pruefliste.filter((p) => p.art === art).length
const reineOhne = (ids: ReinTitel[], kanten: Kante[], namen: Namen = new Map(), hand: ReinHand = ohneHand, fest?: Map<number, number>): Ergebnis => reineReihen(ids, kanten, namen, hand, fest)

const vorher = process.env.REIHEN_QUELLE
delete process.env.REIHEN_QUELLE
pruefe('Schalter: ohne REIHEN_QUELLE laufen Hauptbestand und Katalog rein', bestandReihenAusAnisearch() && katalogReihenAusAnisearch())
process.env.REIHEN_QUELLE = 'anilist'
pruefe('Schalter: REIHEN_QUELLE=anilist ist der Rückweg für beide', !bestandReihenAusAnisearch() && !katalogReihenAusAnisearch())
process.env.REIHEN_QUELLE = 'anisearch'
pruefe('Schalter: REIHEN_QUELLE=anisearch bleibt gültig (beide rein)', bestandReihenAusAnisearch() && katalogReihenAusAnisearch())
if (vorher === undefined) delete process.env.REIHEN_QUELLE
else process.env.REIHEN_QUELLE = vorher

pruefe('Rang: Kernarten 0, „?" 1, Sammelarten 2 (auch „Gemeinsames Universum")', rangDerArt('Sequel') === 0 && rangDerArt('?') === 1 && ['Anderes', 'Charakter', 'Crossover', 'Gemeinsames Universum'].every((a) => rangDerArt(a) === 2))

const kern = reineOhne(titel(3, 1, 2, 9), [k(1, 2, 'Sequel'), k(2, 3, 'Prequel')])
pruefe('Kernart: verbindet, die kleinste Titel-Kennung ist die Reihe, Unverbundene stehen allein', reihe(kern, 3) === 1 && reihe(kern, 2) === 1 && reihe(kern, 9) === 9 && kern.reihen === 1 && kern.inReihen === 3)
const umgekehrt = reineOhne(titel(9, 2, 1, 3), [k(2, 3, 'Prequel'), k(1, 2, 'Sequel')])
pruefe('Ergebnis hängt nicht von der Reihenfolge der Eingabe ab', JSON.stringify([...kern.reihe].sort()) === JSON.stringify([...umgekehrt.reihe].sort()))
pruefe('Art ohne Regel (Originalwerk) bindet nichts', reihe(reineOhne(titel(1, 2), [k(1, 2, 'Originalwerk')]), 2) === 2)

const gleichKennung = reineOhne([{ id: 1, name: 'A', anisearchId: 7 }, { id: 2, name: 'B', anisearchId: 7 }, { id: 3, name: 'C', mal: 5 }, { id: 4, name: 'D', anisearchId: 8, mal: 5 }], [])
pruefe('Gleiche aniSearch-Kennung ist dieselbe Reihe; MAL-Kennung ohne aniSearch-Kennung verbindet nicht', reihe(gleichKennung, 2) === 1 && reihe(gleichKennung, 4) === 4)
const gleichMal = reineOhne([{ id: 3, name: 'C', anisearchId: 3, mal: 5 }, { id: 4, name: 'D', anisearchId: 4, mal: 5 }], [])
pruefe('Gleiche MAL-Kennung zweier aniSearch-Titel verbindet', reihe(gleichMal, 4) === 3)
/* aniSearch trägt bei neuen Einträgen die MAL-Kennung des Nachbarn (Xian Di Guilai ↔ Dr. Slump): als Ersatz verbindet sie nur mit Namensanfang oder Beziehung. */
const fremd = reineOhne([{ id: 3, name: 'Xian Di Guilai', anisearchId: 3, malAnisearch: 5 }, { id: 4, name: 'Dr. Slump Verkehr', anisearchId: 4, malAnisearch: 5 }], [])
pruefe('MAL nur aus aniSearch, weder Namensanfang noch Beziehung: verbindet nicht', reihe(fremd, 4) === 4)
const ersatzName = reineOhne([{ id: 3, name: 'Ponkotsu Quest', anisearchId: 3, malAnisearch: 5 }, { id: 4, name: 'Ponkotsu Quest (2019)', anisearchId: 4, malAnisearch: 5 }], [])
pruefe('MAL nur aus aniSearch, gleicher Namensanfang: verbindet', reihe(ersatzName, 4) === 3)
const ersatzKante = reineOhne([{ id: 3, name: 'Eins', anisearchId: 3, malAnisearch: 5 }, { id: 4, name: 'Zwei', anisearchId: 4, malAnisearch: 5 }], [k(3, 4, 'Anderes')])
pruefe('MAL nur aus aniSearch, aber eine Beziehung zwischen den Einträgen (hier Anderes ohne Namensanfang): verbindet', reihe(ersatzKante, 4) === reihe(ersatzKante, 3))
const eigenPlusErsatz = reineOhne([{ id: 3, name: 'Eins', anisearchId: 3, mal: 5 }, { id: 4, name: 'Zwei', anisearchId: 4, malAnisearch: 5 }], [])
pruefe('Ein Titel mit eigener MAL-Kennung verbindet auch ohne Beleg (der Ersatz-Titel braucht Beleg und bleibt allein)', reihe(eigenPlusErsatz, 4) === 4)
const beideEigen = reineOhne([{ id: 3, name: 'Eins', anisearchId: 3, mal: 5 }, { id: 4, name: 'Zwei', anisearchId: 4, mal: 5 }], [])
pruefe('Beide mit eigener MAL-Kennung: verbindet ohne weiteren Beleg wie bisher', reihe(beideEigen, 4) === 3)

const ueberSeite = reineOhne(titel(1, 3), [k(1, 50, 'Sequel'), k(50, 3, 'Sequel')])
pruefe('Eine aniSearch-Seite ohne eigenen Titel verbindet trotzdem (1 → 50 → 3)', reihe(ueberSeite, 3) === 1)
const seiteZaehlt = reineOhne(titel(1, 3), [k(1, 50, 'Sequel'), k(3, 51, 'Sequel'), k(1, 3, 'Anderes')], new Map([[1, ['Final Fantasy']], [3, ['Final Fantasy 3']]]))
pruefe('Eine Seite ohne Titel zählt für die Größe der Reihe: 1 + Seite und 3 + Seite sind zwei Reihen, „Anderes" verbindet sie nicht', reihe(seiteZaehlt, 3) === 3 && faelle(seiteZaehlt, 'verschmilzt') === 1)

/* „?": Reihen {1,2} und {3,4} stehen durch Sequel fest; 5 hängt nur über „?" an 1; 2 –?→ 3 wäre eine Brücke (Gintama). */
const fragezeichen = reineOhne(titel(1, 2, 3, 4, 5), [k(1, 2, 'Sequel'), k(3, 4, 'Sequel'), k(5, 1, '?'), k(2, 3, '?')])
pruefe('„?" hängt einen Alleinstehenden an eine Reihe', reihe(fragezeichen, 5) === 1)
pruefe('„?" verbindet nie zwei Reihen mit mehreren Titeln; der Fall steht als „verschmilzt" auf der Prüfliste', reihe(fragezeichen, 3) === 3 && faelle(fragezeichen, 'verschmilzt') === 1)
const kernVorFrage = reineOhne(titel(1, 2, 3), [k(1, 3, '?'), k(2, 3, 'Sequel'), k(1, 2, 'Sequel')])
pruefe('Kernarten gehen vor „?" (gleiches Ergebnis, auch wenn „?" zuerst genannt ist)', reihe(kernVorFrage, 3) === 1 && faelle(kernVorFrage, 'verschmilzt') === 0)

/* Sammelarten: ein Alleinstehender wandert bei erfüllter Namensbedingung (ohne AniList gibt es keine andere Quelle), zwei Reihen verbinden sie nie. */
const anderes = reineOhne(titel(1, 2, 5), [k(1, 2, 'Sequel'), k(5, 1, 'Anderes')], gleichNamen)
pruefe('Sammelart: ein Alleinstehender, der nur über „Anderes" hängt, kommt in die Reihe (Namensanfang gleich)', reihe(anderes, 5) === 1 && anderes.pruefliste.length === 0)
const zweiAlleinstehende = reineOhne(titel(5, 6), [k(5, 6, 'Charakter')], new Map([[5, ['Final Fantasy VII: Advent Children']], [6, ['Final Fantasy VII: Last Order']]]))
pruefe('Sammelart: zwei Alleinstehende, nur über „Charakter" verbunden, bilden eine Reihe, wenn der Namensanfang lang genug ist (12 Zeichen)', reihe(zweiAlleinstehende, 6) === 5)
const zuKurz = reineOhne(titel(5, 6), [k(5, 6, 'Charakter')], new Map([[5, ['Gundam']], [6, ['Gundam Wing']]]))
pruefe('Sammelart: „Charakter" mit kurzem gemeinsamem Namensanfang zählt nicht (Gundam / Gundam Wing)', reihe(zuKurz, 6) === 6)
const bruecke = reineOhne(titel(1, 2, 3, 4), [k(1, 2, 'Sequel'), k(3, 4, 'Sequel'), k(2, 3, 'Crossover')], gleichNamen)
pruefe('Sammelart: verbindet nie zwei Reihen mit mehreren Titeln', reihe(bruecke, 3) === 3 && faelle(bruecke, 'verschmilzt') === 1)
const ohneName = reineOhne(titel(1, 2, 3, 4), [k(1, 2, 'Sequel'), k(3, 4, 'Sequel'), k(2, 3, 'Anderes')], new Map([[2, ['Gundam']], [3, ['Tamako Market']]]))
pruefe('Sammelart ohne gemeinsamen Namensanfang zählt gar nicht (keine Prüfzeile)', reihe(ohneName, 3) === 3 && ohneName.pruefliste.length === 0)
const universum = reineOhne(titel(1, 2, 3, 4), [k(1, 2, 'Sequel'), k(3, 4, 'Sequel'), k(2, 3, 'Gemeinsames Universum')], gleichNamen)
pruefe('„Gemeinsames Universum" verbindet nie und steht als Fall „universum" auf der Prüfliste', reihe(universum, 3) === 3 && faelle(universum, 'universum') === 1)

const sammelMal = reineOhne(Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `T${i + 1}`, anisearchId: i + 1, mal: 77 })), [])
pruefe('Eine MAL-Kennung, die neun aniSearch-Titel tragen, ist eine Sammelseite und verbindet nicht', sammelMal.reihen === 0)
const achtMal = reineOhne(Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `T${i + 1}`, anisearchId: i + 1, mal: 77 })), [])
pruefe('Eine MAL-Kennung mit acht aniSearch-Titeln (echte Reihe, Kimagure Orange Road) verbindet', achtMal.reihen === 1 && reihe(achtMal, 8) === 1)

/* Kern-Brücke über einen Alleinstehenden: 9 ist Nebengeschichte von 1 und 3 (Reihen {1,2} und {3,4}), 10 hängt nur an 9; 5 ist Nebengeschichte von 1 allein. */
const crossover = [k(1, 2, 'Sequel'), k(3, 4, 'Sequel'), k(9, 1, 'Hauptgeschichte'), k(1, 9, 'Nebengeschichte'), k(9, 3, 'Hauptgeschichte'), k(3, 9, 'Nebengeschichte'), k(10, 9, 'Hauptgeschichte'), k(5, 1, 'Hauptgeschichte')]
const kernBruecke = reineOhne(titel(1, 2, 3, 4, 5, 9, 10), crossover)
pruefe('Kern-Brücke: ein Titel mit Haupthandlungen in zwei Reihen verbindet sie nicht', reihe(kernBruecke, 3) === 3 && reihe(kernBruecke, 4) === 3 && reihe(kernBruecke, 2) === 1)
pruefe('Kern-Brücke: er hängt an der Reihe mit der kleinsten Kennung, sein Anhängsel kommt mit', reihe(kernBruecke, 9) === 1 && reihe(kernBruecke, 10) === 1 && reihe(kernBruecke, 5) === 1)
pruefe('Kern-Brücke: der Fall steht als „mehrdeutig“ mit beiden Reihen und dem Titel auf der Prüfliste', faelle(kernBruecke, 'mehrdeutig') === 1 && kernBruecke.pruefliste[0]!.reihen.length === 2 && kernBruecke.pruefliste[0]!.alleinstehende[0] === 'T9' && faelle(kernBruecke, 'verschmilzt') === 0)
const umgekehrtBruecke = reineOhne(titel(10, 9, 5, 4, 3, 2, 1), [...crossover].reverse())
pruefe('Kern-Brücke: unabhängig von der Reihenfolge der Eingabe', JSON.stringify([...kernBruecke.reihe].sort()) === JSON.stringify([...umgekehrtBruecke.reihe].sort()))
const nurEinHaupt = reineOhne(titel(1, 2, 3, 9), [k(1, 2, 'Sequel'), k(9, 1, 'Hauptgeschichte'), k(9, 3, 'Hauptgeschichte')])
pruefe('Kern-Brücke: Haupthandlungen in einer Reihe und einem Einzeltitel verbinden weiter (kein Fall)', reihe(nurEinHaupt, 3) === 1 && reihe(nurEinHaupt, 9) === 1 && nurEinHaupt.pruefliste.length === 0)
const kette = reineOhne(titel(1, 2, 3, 4, 5), [k(1, 2, 'Sequel'), k(2, 3, 'Sequel'), k(3, 4, 'Sequel'), k(4, 5, 'Sequel')])
pruefe('Kern-Brücke: eine Fortsetzungskette bleibt eine Reihe (nur Haupthandlungen sperren)', kette.reihen === 1 && kette.inReihen === 5)

/* Handdatei. */
const hand = reineOhne(titel(1, 2, 3, 4), [k(1, 2, 'Sequel')], new Map(), { verbinden: [[3, 4, 99]], trennen: [] })
pruefe('Handdatei `ids:` verbindet (unbekannte Kennungen darin werden übergangen)', reihe(hand, 4) === 3 && hand.reihen === 2)
const getrennt = reineOhne(titel(1, 2, 3), [k(1, 2, 'Sequel'), k(2, 3, 'Sequel')], new Map(), { verbinden: [], trennen: [[1, 3]] })
pruefe('Handdatei `getrennt:` hält zwei Titel auseinander, auch gegen eine Kernart', reihe(getrennt, 3) !== reihe(getrennt, 1))
const getrenntFrage = reineOhne(titel(1, 2, 3, 4), [k(1, 2, 'Sequel'), k(3, 4, 'Sequel'), k(2, 3, '?')], new Map(), { verbinden: [], trennen: [[1, 3]] })
pruefe('Handdatei `getrennt:` macht aus der Brücke keinen Prüflisten-Fall', reihe(getrenntFrage, 3) === 3 && getrenntFrage.pruefliste.length === 0)
const handOhneKante = reineOhne(titel(1, 2, 3), [k(1, 2, 'Sequel')], new Map(), { verbinden: [[1, 2, 3]], trennen: [] })
pruefe('Handdatei `ids:` gilt auch ohne aniSearch-Kante', reihe(handOhneKante, 3) === 1)

/* Feste Reihen (Katalog): 10, 11 stehen als Reihe 11 fest, 20 als Reihe 20; 12 ist Katalog. */
const fest = new Map([[10, 11], [11, 11], [20, 20]])
const katalog = reineOhne(titel(10, 11, 12, 20, 30, 31), [k(12, 10, 'Sequel'), k(11, 20, 'Sequel'), k(30, 31, 'Sequel')], new Map(), ohneHand, fest)
pruefe('Fest: ein Katalogtitel kommt in die feste Reihe, deren Kennung bleibt (auch wenn sie größer ist)', reihe(katalog, 12) === 11 && reihe(katalog, 10) === 11)
pruefe('Fest: zwei feste Reihen verschmelzen nie, der Fall steht auf der Prüfliste', reihe(katalog, 20) === 20 && faelle(katalog, 'verschmilzt') === 1)
pruefe('Fest: Katalogtitel ohne feste Reihe bilden eine neue (kleinste Kennung)', reihe(katalog, 31) === 30)
const festEinzel = reineOhne(titel(20, 12), [k(12, 20, 'Anderes')], gleichNamen, ohneHand, new Map([[20, 20]]))
pruefe('Fest: ein Katalogtitel hängt über eine Sammelart an einen festen Einzeltitel', reihe(festEinzel, 12) === 20)
const festKern = reineOhne(titel(20, 12), [k(12, 20, 'Sequel')], gleichNamen, ohneHand, new Map([[20, 20]]))
pruefe('Fest: ein Katalogtitel mit Kernart kommt zum festen Einzeltitel', reihe(festKern, 12) === 20)

/* Zusatzkanten (Katalog): AniList-Kanten der Titel ohne aniSearch-Kennung; 40 hat keine Kennung, 41 auch, 20 ist fest. */
const mitZusatz = reineOhne([...titel(1, 2, 20, 30), { id: 40, name: 'T40' }, { id: 41, name: 'T41' }], [k(1, 2, 'Sequel')], new Map(), ohneHand, new Map([[20, 20]]))
pruefe('Zusatz: ohne Paare bleiben Titel ohne Kennung allein', reihe(mitZusatz, 40) === 40 && reihe(mitZusatz, 41) === 41)
const alleTitel = [...titel(1, 2, 20, 21), { id: 40, name: 'T40' }, { id: 41, name: 'T41' }]
const mitPaaren = reineReihen(alleTitel, [k(1, 2, 'Sequel')], new Map(), ohneHand, new Map(), [[40, 1], [40, 99]])
pruefe('Zusatz: ein Titel ohne Kennung hängt über ein Paar an die aniSearch-Reihe (unbekannte Kennungen übergangen)', reihe(mitPaaren, 40) === 1 && reihe(mitPaaren, 2) === 1)
const zweiFeste = reineReihen(alleTitel, [], new Map(), ohneHand, new Map([[20, 20], [21, 21]]), [[41, 20], [41, 21]])
pruefe('Zusatz: ein Titel ohne Kennung kommt in eine feste Reihe, zwei feste Reihen verschmelzen über Paare nie', reihe(zweiFeste, 41) === 20 && reihe(zweiFeste, 21) === 21)
const getrenntZusatz = reineReihen([...titel(1, 2), { id: 40, name: 'T40' }], [k(1, 2, 'Sequel')], new Map(), { verbinden: [], trennen: [[1, 40]] }, new Map(), [[40, 1]])
pruefe('Zusatz: `getrennt:` der Handdatei gilt auch gegen ein Paar', reihe(getrenntZusatz, 40) === 40)
const kantenOhne = anilistKantenOhneKennung(
  [
    { id: 1, rel: [2, 3, 4] },
    { id: 2, rel: [1] },
    { id: 3, rel: [1] },
    { id: 4, rel: [], eltern: [1, 3] },
    { id: 5, rel: [1, 4], eltern: [7, 8] },
  ] as unknown as KatalogEintrag[],
  new Set([1, 2]),
)
pruefe('Zusatzkanten: nur Kanten mit einem Titel ohne Kennung; ein Crossover (zwei Eltern) verbindet nichts, weder von sich aus noch als Ziel', JSON.stringify(kantenOhne) === '[[1,3],[3,1]]', JSON.stringify(kantenOhne))

/* Handdatei: `reinIds:` verbindet im reinen Weg wie `ids:`, `03-reihen.ts` liest es nicht (dort zählt nur `ids:`). */
const handDatei = join(mkdtempSync(join(tmpdir(), 'hand-')), 'reihen-von-hand.yaml')
writeFileSync(handDatei, '- ids: [1, 2]\n  grund: a\n- reinIds: [3, 4]\n  grund: b\n- getrennt: [5, 6]\n  grund: c\n')
const handGelesen = ladeHand(handDatei)
pruefe('Handdatei: ids: und reinIds: verbinden, getrennt: trennt', JSON.stringify(handGelesen.verbinden) === '[[1,2],[3,4]]' && JSON.stringify(handGelesen.trennen) === '[[5,6]]')

console.log(fehler ? `\naniSearch-Reihen (rein): ${fehler} Zusicherung(en) verletzt.` : 'aniSearch-Reihen (rein): alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
