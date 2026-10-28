/**
 * Zusicherung: **die Staffelnummer darf aus einem deutschen aniSearch-Synonym kommen** („Clannad Staffel 2"),
 * wenn der Sprachblock „Deutsch" keine nennt (28.10.2026, 152 Einträge mit „… Staffel N"-Synonym, vorher ungelesen).
 * Die Fälle sind wörtlich aus `data/anisearch.json` (Synonyme und Sprachblock-Titel der genannten aniSearch-Einträge).
 */
import { staffelNummerAusEintrag, staffelNummerAusSynonymen, staffelQuellenAusAnisearch } from './bau/staffel-quelle.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const eintrag = (de: string, synonyms: string[]) => ({ info: { languages: [{ language: 'Deutsch', title: de }], synonyms } })

/* Clannad: After Story (AniList 4181) */
const clannad = eintrag('Clannad: After Story', ['Clannad 2nd Season', 'Clannad Staffel 2'])
pruefe('Clannad: Synonym „Staffel 2" gilt', staffelNummerAusEintrag(clannad) === 2)
/* Spice and Wolf II (5341): Doppelpunkt vor „Staffel" */
pruefe('Spice & Wolf: „Spice & Wolf: Staffel 2"', staffelNummerAusEintrag(eintrag('Spice and Wolf II', ['Okami to Koshinryo II', 'SaW 2', 'Spice & Wolf: Staffel 2'])) === 2)
/* My Hero Academia Final Season (182896): „Season 8" und „Staffel 8" */
pruefe('MHA: Staffel 8', staffelNummerAusEintrag(eintrag('My Hero Academia: Final Season', ['BNHA 8', 'MHA 8', 'My Hero Academia: Season 8', 'My Hero Academia: Staffel 8'])) === 8)

/* Gegenbeispiele */
const doremi = eintrag('DoReMi', ['Bothersome Witch Doremi', 'Magical DoReMi Staffel 1', 'Useless Witchgirl Doremi'])
pruefe('DoReMi: „Staffel 1" ist keine Angabe', staffelNummerAusEintrag(doremi) === undefined)
const sailor = eintrag('Pretty Guardian Sailor Moon Cosmos: Der Film', ['Pretty Guardian Sailor Moon Cosmos The Movie', 'Pretty Guardian Sailor Moon Crystal Season 5'])
pruefe('Sailor Moon Cosmos: „Season 5" zählt nicht', staffelNummerAusEintrag(sailor) === undefined)
pruefe('Zwei verschiedene Staffel-Synonyme: keine Angabe', staffelNummerAusSynonymen(['X Staffel 2', 'X Staffel 3']) === undefined)
pruefe('Zwei gleiche Staffel-Synonyme: gilt', staffelNummerAusSynonymen(['X Staffel 3', 'X: Staffel 3']) === 3)
pruefe('Genau Staffel 2 ist die Untergrenze', staffelNummerAusSynonymen(['X Staffel 2']) === 2)
pruefe('Keine Synonyme: keine Angabe', staffelNummerAusEintrag({ info: { languages: [] } }) === undefined && staffelNummerAusEintrag({}) === undefined)
pruefe('Sprachblock schlägt Synonym', staffelNummerAusEintrag(eintrag('Y (Staffel 3)', ['Y Staffel 2'])) === 3)
pruefe('Sprachblock „Staffel 1" schlägt Synonym', staffelNummerAusEintrag(eintrag('Y (Staffel 1)', ['Y Staffel 2'])) === 1)

/* Gesamtweg gegen den Bestand: der Lauf liest die Synonyme wirklich. */
const quellen = staffelQuellenAusAnisearch()
pruefe('Bestand: Clannad After Story (4181) = Staffel 2', quellen.get(4181) === 2)
pruefe('Bestand: Magi (18115) = Staffel 2', quellen.get(18115) === 2)
pruefe('Bestand: Sailor Moon Cosmos Film (148149) ohne Angabe', !quellen.has(148149))
pruefe('Bestand: DoReMi (350) ohne Angabe', !quellen.has(350))

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('Staffel aus Synonymen: 15 Fälle bestätigt')
