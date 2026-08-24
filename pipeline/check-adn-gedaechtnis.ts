/**
 * Zusicherungen für das ADN-Gedächtnis.
 *
 * ## Der Fall — und die Ursache, die es *nicht* war
 *
 * Daniel prüfte am 24.08.2026 gegen 11:50 „Kill Blue" bei ADN und fand **vier**
 * deutsche Folgen. Unser Archiv kannte nur zwei. Die erste Erklärung lautete,
 * ADN zeige Gästen ein gleitendes Fenster der zuletzt freigegebenen Folgen.
 *
 * **Die Messung hat das widerlegt.** Ein Live-Abruf um 12:38 mit exakt unseren
 * Headern lieferte `vde` bei Folge 1, 2, 3 und 4 — anonym, ohne Token. Es fehlte
 * nichts; das Archiv war vier Stunden alt, weil es im Wochenlauf entsteht.
 *
 * Eine daraufhin gebaute Regel „Folge 4 belegt, also auch 1 bis 3" ist deshalb
 * wieder verschwunden: Sie lieferte beim Testfall zufällig das richtige Ergebnis
 * aus dem falschen Grund. Geblieben ist das Gedächtnis, aber mit anderer
 * Begründung — es fängt einen **unvollständigen Abruf** ab, keinen Verlust bei
 * ADN.
 *
 * ## Warum das eine eigene Prüfung verdient
 *
 * Das Gedächtnis ist die einzige Stelle, die eine Angabe in den Datensatz
 * bringt, ohne dass sie im aktuellen Abruf steht. Solcher Code liegt still
 * falsch: Niemand vermisst eine Tonspur, die es nie gab, und niemand merkt, wenn
 * eine erfunden wird. Die schärfste Zusicherung hier ist deshalb, dass aus einem
 * **fehlenden** `vde` niemals ein Nein wird.
 */
import { ergaenzeAusHistorie, type VdeHistorie } from './lib/adn-vde-historie.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) {
    console.log(`  ✓ ${name}`)
    return
  }
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Der Archivstand vom 24.08.2026, 08:36 — gekürzt auf die Felder, die zählen. */
function killBlue() {
  return [
    { id: 31434, shortNumber: '1', languages: ['vostde'] },
    { id: 31435, shortNumber: '2', languages: ['vostde'] },
    { id: 31436, shortNumber: '3', languages: ['vostde', 'vde'] },
    { id: 31437, shortNumber: '4', languages: ['vostde', 'vde'] },
    { id: 31438, shortNumber: '5', languages: ['vostde'] },
    { id: 31439, shortNumber: '6', languages: ['vostde'] },
  ]
}

const deutsch = (v: { shortNumber?: string; languages?: string[] }[]) =>
  v.filter((x) => (x.languages ?? []).includes('vde')).map((x) => Number(x.shortNumber))

console.log('ADN-Gedächtnis: ein einmal belegtes vde geht nicht verloren\n')

{
  const historie: VdeHistorie = {}
  const { neu } = ergaenzeAusHistorie(historie, '1383', killBlue(), '2026-08-24', true)
  pruefe(
    'neue Funde werden mit dem Datum des ersten Fundes gemerkt',
    neu === 2 && historie['1383']?.['31436'] === '2026-08-24',
    historie,
  )
}
{
  // Ein früherer Lauf sah Folge 1 und 2, der aktuelle Abruf kam ohne sie zurück.
  const historie: VdeHistorie = { '1383': { '31434': '2026-07-20', '31435': '2026-07-27' } }
  const videos = killBlue()
  const { wiederhergestellt } = ergaenzeAusHistorie(historie, '1383', videos, '2026-08-24', true)
  pruefe(
    'ein Fund aus einem früheren Lauf überlebt einen unvollständigen Abruf',
    wiederhergestellt === 2 && JSON.stringify(deutsch(videos)) === '[1,2,3,4]',
    deutsch(videos),
  )
}
{
  // Die wichtigste Zusicherung: Schweigen ist kein Nein.
  const historie: VdeHistorie = { '1383': { '31436': '2026-08-24' } }
  const videos = killBlue()
  ergaenzeAusHistorie(historie, '1383', videos, '2026-08-24', true)
  pruefe(
    'ein fehlendes vde wird nie zu einem Nein',
    JSON.stringify(videos[4].languages) === '["vostde"]',
    videos[4].languages,
  )
}
{
  // Nichts wird geschlossen: Folge 5 bleibt draußen, obwohl 4 belegt ist.
  const historie: VdeHistorie = {}
  const videos = killBlue()
  ergaenzeAusHistorie(historie, '1383', videos, '2026-08-24', true)
  pruefe(
    'aus einer belegten Folge wird nicht auf ihre Nachbarn geschlossen',
    JSON.stringify(deutsch(videos)) === '[3,4]',
    deutsch(videos),
  )
}
{
  const historie: VdeHistorie = {}
  ergaenzeAusHistorie(historie, '1383', killBlue(), '2026-08-24', false)
  pruefe('ohne Pflege-Auftrag wird nichts geschrieben', Object.keys(historie).length === 0, historie)
}

console.log()
if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
