/**
 * Bestandswache (nur Warnung, Exit 0): Läuft eine Serie gerade auf ProSieben MAXX und führt sie einen Joyn-Weg, trägt der Weg ein Abruffenster,
 * sonst bleibt die Joyn-Pille leer (Yaiba, 08.11.2026). Vier Serien sind bekannt offen, weil ihre Sichtungen keine belegten Folgennummern haben
 * (tv.de nennt nur Folgentitel, die Liste findet nicht jeden): Eyeshield 21 (15), One Piece (21), Dragon Ball (223), Yashahime (118399) — Stand public/data 08.11.2026.
 * Die Liste darf nur sinken: Ein neuer Fall steht als `⚠ WARNUNG` im Bestandslog, ein behobener als Hinweis zum Streichen. Rot wäre falsch: Der Fall ist eine
 * leere Pille, kein falscher Datensatz, und eine Marke stellte den Titel zurück.
 */
import { readJson } from './lib/util.ts'
import { joynLaeuftOhneFenster } from './lib/joyn-ohne-fenster.ts'
import type { Release, Title } from '../shared/types.ts'

const BEKANNT_OFFEN = new Set([15, 21, 223, 118399])
const offen = joynLaeuftOhneFenster(readJson<Title[]>('public/data/titles.json', []), readJson<Release[]>('public/data/releases.json', []))
const neu = offen.filter((id) => !BEKANNT_OFFEN.has(id))
for (const id of neu) console.log(`  ⚠ WARNUNG Joyn-Pille: Titel ${id} läuft auf ProSieben MAXX, sein Joyn-Weg hat kein Abruffenster (leere Pille) — Folgennummern der Sichtungen belegen oder mit Grund in BEKANNT_OFFEN`)
for (const id of [...BEKANNT_OFFEN].filter((x) => !offen.includes(x))) console.log(`  ⚠ WARNUNG Joyn-Pille: Titel ${id} hat jetzt ein Fenster oder läuft nicht mehr, Eintrag aus BEKANNT_OFFEN in pipeline/check-joyn-pille-bestand.ts streichen`)
console.log(`Joyn-Pille: ${offen.length} laufende MAXX-Serien mit Joyn-Weg ohne Fenster (bekannt offen: ${BEKANNT_OFFEN.size}, neu: ${neu.length})`)
console.log('VERSTÖSSE: 0')
