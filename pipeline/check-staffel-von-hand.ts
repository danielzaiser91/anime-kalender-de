/**
 * Zusicherung: **eine von Hand belegte Staffelnummer macht aus „Teil 2" eine eigene Staffel** (18.10.2026,
 * „Though I Am an Inept Villainess": aniSearch führt die zweite Hälfte als „Dai 2 Cour" mit dem Synonym „Staffel 2";
 * AniList nennt sie „Part 2", das Panel zeigte „Teil 1"). Prüft die Handdatei `data/staffel-von-hand.yaml`
 * (Pflichtfelder) und ihre Wirkung auf `staffelBeschriftungen()`. Läuft in `check:logic`.
 */
import { staffelBeschriftungen } from '../shared/titles.ts'
import { alleStaffelQuellen, fehlerImHandeintrag, staffelEintraegeVonHand, staffelQuellenAusAnisearch } from './bau/staffel-quelle.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const eintraege = staffelEintraegeVonHand()
pruefe('Handdatei hat Einträge', eintraege.length > 0)
/* Ob jede Kennung in einer Reihe steht, prüft `check-staffel-von-hand-bestand.ts` (liest den gebauten Bestand). */
const eigeneIds = new Set(eintraege.map((e) => e.anilistId))
for (const e of eintraege) pruefe(`AniList ${e.anilistId}: Handeintrag in Ordnung`, fehlerImHandeintrag(e, eigeneIds).length === 0, fehlerImHandeintrag(e, eigeneIds).join(', '))

const gut = { anilistId: 188139, staffel: 2, quelle: 'https://x', belegtAm: '2026-10-18' }
const reihenIds = new Set([188139])
const fehlerFall = (aenderung: object) => fehlerImHandeintrag({ ...gut, ...aenderung }, reihenIds).length
pruefe('Gültiger Eintrag ohne Befund', fehlerFall({}) === 0)
pruefe('Staffel 1 ist keine Staffelangabe', fehlerFall({ staffel: 1 }) === 1)
pruefe('Staffel muss eine ganze Zahl sein', fehlerFall({ staffel: 2.5 }) === 1)
pruefe('Quelle ohne https', fehlerFall({ quelle: 'http://x' }) === 1)
pruefe('Quelle fehlt', fehlerFall({ quelle: undefined }) === 1)
pruefe('Tag der Lesung fehlt', fehlerFall({ belegtAm: undefined }) === 1)
pruefe('Tag der Lesung falsch geschrieben', fehlerFall({ belegtAm: '18.10.2026' }) === 1)
pruefe('Tag der Lesung nur als Monat', fehlerFall({ belegtAm: '2026-10' }) === 1)
pruefe('Tag der Lesung mit Vorsatz', fehlerFall({ belegtAm: 'am 2026-10-18' }) === 1)
pruefe('Kennung ohne Reihe', fehlerFall({ anilistId: 5 }) === 1)

/* Wirkung: Villainess Teil 1 und 2 (Namen wie bei AniList). */
const VILLAINESS = 'Though I Am an Inept Villainess'
const glieder = [
  { id: 188139, name: VILLAINESS, jpStart: '2026-07-12', jpYear: 2026 },
  { id: 217070, name: `${VILLAINESS} Part 2`, jpStart: '2027-01', jpYear: 2027 },
]
const ohne = staffelBeschriftungen(glieder, VILLAINESS)
pruefe('Ohne Handeintrag: „Teil 1" und „Teil 2" (Grundlage der Meldung)', ohne.get(188139) === 'Teil 1' && ohne.get(217070) === 'Teil 2', JSON.stringify([...ohne]))

const quellen = alleStaffelQuellen()
pruefe('Handdatei liefert Staffel 2 für 217070', quellen.get(217070) === 2)
const mit = staffelBeschriftungen(glieder.map((g) => ({ ...g, staffelQuelle: quellen.get(g.id) })), VILLAINESS)
pruefe('Mit Handeintrag: „Staffel 1" und „Staffel 2"', mit.get(188139) === 'Staffel 1' && mit.get(217070) === 'Staffel 2', JSON.stringify([...mit]))

/* Hand schlägt Ableitung. */
const [abgeleitetId, abgeleitetNr] = [...staffelQuellenAusAnisearch()][0]!
const hand = [
  { ...gut, anilistId: 900001, staffel: 3 },
  { ...gut, anilistId: abgeleitetId, staffel: abgeleitetNr + 5 },
  { ...gut, anilistId: 900003, staffel: 4 },
]
const handQuellen = alleStaffelQuellen(hand)
pruefe('Hand überschreibt aniSearch-Staffel', handQuellen.get(abgeleitetId) === abgeleitetNr + 5)
pruefe('Jeder Handeintrag zählt, vorn wie hinten', handQuellen.get(900001) === 3 && handQuellen.get(900003) === 4)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log(`Staffel von Hand: ${eintraege.length} Eintrag/Einträge, Wirkung bestätigt`)
