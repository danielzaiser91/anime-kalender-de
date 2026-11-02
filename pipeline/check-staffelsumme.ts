/**
 * Zusicherungen zur Staffelsumme (F100): Versatz aus JustWatch plus Bestätigung durch Folgentitel, Wächter für den Vermerk im Handbeleg.
 * Kopf der Regel: `lib/staffelsumme.ts`. Schnellweg am echten Fall: `tools/staffelsumme-vorschau.ts`.
 */
import { findeUnbestaetigteSumme, OFFEN_OHNE_ZUORDNUNG, urteileStaffelsumme, versatzAusJustWatch, zaehleTitel, type TitelMeldung } from './lib/staffelsumme.ts'
import type { UnsereFolge } from './lib/episodentitel-block.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} ${JSON.stringify(info)}`)
}

/** Unsere Liste: Folge n heißt "Titel n" (erfunden, jeder Titel kommt einmal vor). */
const liste = (n: number): UnsereFolge[] => Array.from({ length: n }, (_, i) => ({ nr: i + 1, de: `Titel ${i + 1}`, en: null }))
/** Meldungen der Anbieter-Staffel, deren Folge `pos` den Titel unserer Folge `pos + versatz` trägt. */
const meldungen = (positionen: number[], versatz: number): TitelMeldung[] => positionen.map((pos) => ({ pos, titel: `Titel ${pos + versatz}` }))
const jw = (...folgen: (number | undefined)[]) => folgen.map((f, i) => ({ nr: i + 1, folgen: f }))

/* Echter Fall (Beyblade X, aniSearch 52–55 und RTL+ Staffel 2, Folge 1–3, wörtlich aus den Daten vom 02.11.2026). */
const beyblade: UnsereFolge[] = [
  { nr: 51, de: 'Der größte Spaß aller Zeiten', en: null },
  { nr: 52, de: 'Neustart', en: null },
  { nr: 53, de: 'Anzeichen einer neuen Ära', en: null },
  { nr: 54, de: 'Weg der Entschlossenheit', en: null },
  { nr: 55, de: 'Der nächste Bey Timeshift', en: null },
]
const rtlplus: TitelMeldung[] = [
  { pos: 1, titel: 'Neustart' },
  { pos: 2, titel: 'Anzeichen einer neuen Ära' },
  { pos: 3, titel: 'Weg der Entschlossenheit' },
]
const echt = urteileStaffelsumme({ erste: 2, jw: jw(51, 49), blockFolgen: 49, meldungen: rtlplus, liste: beyblade, quelle: 'RTL+', laenge: 150 })
pruefe('Beyblade X: Netflix-Staffel 2 beginnt bei unserer Folge 52', echt.ok && echt.versatz === 51, echt)
pruefe('Beyblade X: Vermerk nennt Summe, Merkmal und Zahl', echt.ok && /Staffelsumme/.test(echt.vermerk) && /bestätigt durch: Folgentitel \(3 von 3, RTL\+\)/.test(echt.vermerk), echt)

/* Summe */
pruefe('Summe: Versatz ist die Summe der Staffeln davor (zwei Staffeln davor)', JSON.stringify(versatzAusJustWatch(3, jw(10, 12), 8, 100)) === '{"ok":true,"versatz":22}')
pruefe('Summe: Staffel nach der gemeldeten zählt nicht mit', JSON.stringify(versatzAusJustWatch(2, jw(10, 12, 99), 8, 100)) === '{"ok":true,"versatz":10}')
pruefe('Summe: fehlende Folgenzahl einer früheren Staffel gibt keinen Versatz', !versatzAusJustWatch(3, jw(10, undefined), 8, 100).ok)
pruefe('Summe: Staffel davor fehlt ganz', !versatzAusJustWatch(3, [{ nr: 2, folgen: 12 }], 8, 100).ok)
pruefe('Summe: Block endet genau drei Folgen hinter unserer Liste, noch zulässig', versatzAusJustWatch(2, jw(50), 53, 100).ok)
pruefe('Summe: Block eine Folge weiter, unzulässig', !versatzAusJustWatch(2, jw(50), 54, 100).ok)

/* Bestätigung */
const urteil = (positionen: number[], versatz: number, summe = 20) =>
  urteileStaffelsumme({ erste: 2, jw: jw(summe), blockFolgen: 30, meldungen: meldungen(positionen, versatz), liste: liste(100), quelle: 'Test' })
pruefe('Bestätigung: ein Treffer genügt nicht', !urteil([1], 20).ok, urteil([1], 20))
pruefe('Bestätigung: zwei Treffer am Versatz genügen', urteil([1, 2], 20).ok)
pruefe('Bestätigung: Titel an anderer Stelle bestätigen nicht', !urteil([1, 2, 3], 35).ok, urteil([1, 2, 3], 35))
const gemischt = (gut: number, schlecht: number): TitelMeldung[] => [...meldungen(Array.from({ length: gut }, (_, i) => i + 1), 20), ...meldungen(Array.from({ length: schlecht }, (_, i) => i + 11), 40)]
const mitGemisch = (gut: number, schlecht: number) => urteileStaffelsumme({ erste: 2, jw: jw(20), blockFolgen: 30, meldungen: gemischt(gut, schlecht), liste: liste(100), quelle: 'Test' })
pruefe('Bestätigung: vier von fünf (80 %) gelten', mitGemisch(4, 1).ok)
pruefe('Bestätigung: drei von vier (75 %) gelten nicht', !mitGemisch(3, 1).ok)
pruefe('Bestätigung: Zählung nennt Treffer und Abweichung getrennt', JSON.stringify(zaehleTitel(20, gemischt(3, 2), liste(100))) === '{"treffer":3,"abweichend":2}')
pruefe('Bestätigung: Platzhaltertitel ("Folge 3") zählen nicht', zaehleTitel(0, [{ pos: 3, titel: 'Folge 3' }, { pos: 4, titel: null }], liste(10)).treffer === 0)
pruefe('Bestätigung: Summe schlägt Titel nicht – falsche Summe wird abgewiesen', !urteil([1, 2, 3], 20, 25).ok)

/* Wächter am Handbeleg */
pruefe('Wächter: Summe ohne Merkmal ist rot', findeUnbestaetigteSumme([{ title: 'X', anilistId: 1, note: 'Umrechnung: Staffelsumme – Staffel 2 beginnt bei 52' }]).length === 1)
pruefe('Wächter: Summe mit Merkmal ist grün', findeUnbestaetigteSumme([{ title: 'X', anilistId: 1, note: 'Umrechnung: Staffelsumme – 52; bestätigt durch: Folgentitel (3 von 3, RTL+)' }]).length === 0)
pruefe('Wächter: andere Umrechnung (Folgentitel von Hand) bleibt unberührt', findeUnbestaetigteSumme([{ anilistId: 2, note: 'Umrechnung: Folgentitel' }, { anilistId: 3 }]).length === 0)

/* Ratsche: offene Fälle nur weniger (Stand 02.11.2026: 2). */
pruefe('Ratsche: höchstens 2 offene Adressen', OFFEN_OHNE_ZUORDNUNG.length <= 2, OFFEN_OHNE_ZUORDNUNG)

console.log(`Staffelsumme: ${faelle - fehler} von ${faelle} Fällen grün (Beyblade X echt, Summe, Bestätigung, Wächter)`)
process.exit(fehler ? 1 : 0)
