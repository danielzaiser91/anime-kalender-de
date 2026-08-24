/**
 * Zusicherungen für das ADN-Gedächtnis — was einmal deutsch war, bleibt deutsch.
 *
 * ## Der Fall, der das nötig gemacht hat
 *
 * Daniel prüfte am 24.08.2026 „Kill Blue" bei ADN und bei Netflix, unabhängig
 * voneinander, und fand **vier** Folgen mit deutscher Tonspur. Es standen sich
 * gegenüber:
 *
 *     unser Datensatz      Folge 1–2 deutsch, 3–12 nicht
 *     ADN-Abruf desselben Tages   vde nur bei Folge 3 und 4
 *     Daniel, angemeldet          vier deutsche Folgen
 *
 * Die Versionsgeschichte des Archivs löst den Widerspruch auf: Am 21.08. trug
 * **keine** Folge ein `vde`, am 24.08. die Folgen 3 und 4. Das ist kein
 * Synchro-Stand, sondern ein **gleitendes Gratis-Fenster** — ADN gibt Gästen
 * die zuletzt veröffentlichten Synchro-Folgen frei, ältere fallen heraus.
 *
 * Daraus folgen die zwei Mechanismen, die hier geprüft werden:
 *
 *   1. **Gedächtnis über die Zeit** — jeder je gesehene Fund bleibt gespeichert.
 *   2. **Rückschluss innerhalb eines Abrufs** — eine Synchro läuft von vorne,
 *      also ist mit Folge 4 auch 1 bis 3 vertont.
 *
 * ## Warum das eine eigene Prüfung verdient
 *
 * Beide Mechanismen **erzeugen** Angaben, die so in keiner Quelle stehen. Das
 * ist genau die Sorte Code, die still falsch liegt: Niemand vermisst eine
 * Tonspur, die es nie gab, und niemand merkt, wenn eine erfunden wird. Die
 * gefährlichste Zusicherung hier ist deshalb nicht, dass etwas ergänzt wird,
 * sondern dass **nichts über den höchsten Fund hinaus** ergänzt wird.
 */
import {
  ergaenzeAusHistorie,
  schliesseAufVorherigeFolgen,
  type VdeHistorie,
} from './lib/adn-vde-historie.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) {
    console.log(`  ✓ ${name}`)
    return
  }
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Der echte Abruf vom 24.08.2026, gekürzt auf die Felder, die zählen. */
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

console.log('ADN-Gedächtnis: was einmal deutsch war, bleibt deutsch\n')

// --- Rückschluss innerhalb eines Abrufs -----------------------------------

console.log('Rückschluss auf die Folgen davor')
{
  const videos = killBlue()
  const ergaenzt = schliesseAufVorherigeFolgen(videos)
  pruefe('Folge 4 belegt, also gelten 1 bis 4 als deutsch', JSON.stringify(deutsch(videos)) === '[1,2,3,4]', deutsch(videos))
  pruefe('genau die zwei fehlenden wurden ergänzt', ergaenzt === 2, ergaenzt)
  pruefe('Folge 5 und 6 bleiben unangetastet', !deutsch(videos).includes(5) && !deutsch(videos).includes(6), deutsch(videos))
}
{
  // Ohne einen einzigen Fund darf nichts entstehen — sonst würde die Regel aus
  // „nichts bekannt" ein „alles deutsch" machen.
  const videos = killBlue().map((v) => ({ ...v, languages: ['vostde'] }))
  pruefe('ohne Fund wird nichts erfunden', schliesseAufVorherigeFolgen(videos) === 0 && deutsch(videos).length === 0, deutsch(videos))
}

// --- Gedächtnis über die Zeit ---------------------------------------------

console.log('\nGedächtnis über mehrere Abrufe')
{
  const historie: VdeHistorie = {}
  const { neu } = ergaenzeAusHistorie(historie, '1383', killBlue(), '2026-08-24', true)
  pruefe('neue Funde werden mit Datum gemerkt', neu === 2 && historie['1383']?.['31436'] === '2026-08-24', historie)
}
{
  // Folge 1 und 2 waren im Juli im Fenster, heute nicht mehr.
  const historie: VdeHistorie = { '1383': { '31434': '2026-07-20', '31435': '2026-07-27' } }
  const videos = killBlue()
  const { wiederhergestellt } = ergaenzeAusHistorie(historie, '1383', videos, '2026-08-24', true)
  pruefe('aus dem Fenster gefallene Funde kehren zurück', wiederhergestellt === 2 && JSON.stringify(deutsch(videos)) === '[1,2,3,4]', deutsch(videos))
}
{
  const historie: VdeHistorie = { '1383': { '31436': '2026-08-24' } }
  const videos = killBlue()
  ergaenzeAusHistorie(historie, '1383', videos, '2026-08-24', true)
  pruefe('ein fehlendes vde wird nie zu einem Nein', JSON.stringify(videos[4].languages) === '["vostde"]', videos[4].languages)
}
{
  const historie: VdeHistorie = {}
  ergaenzeAusHistorie(historie, '1383', killBlue(), '2026-08-24', false)
  pruefe('ohne Pflege-Auftrag wird nichts geschrieben', Object.keys(historie).length === 0, historie)
}

// --- Beide zusammen, am echten Fall ---------------------------------------

console.log('\nBeide Mechanismen zusammen')
{
  const historie: VdeHistorie = {}
  const videos = killBlue()
  ergaenzeAusHistorie(historie, '1383', videos, '2026-08-24', true)
  schliesseAufVorherigeFolgen(videos)
  pruefe(
    'Kill Blue am 24.08.2026 ergibt vier deutsche Folgen — wie von Hand geprüft',
    JSON.stringify(deutsch(videos)) === '[1,2,3,4]',
    deutsch(videos),
  )
}

console.log()
if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
