/**
 * **Das Standard-Vorschaubild bleibt aktuell, ohne bei jedem Titel zu wechseln** (13.10.2026).
 *
 * Vorher zeichnete `build-og.ts` `default.jpg` nur, wenn die Datei fehlte; die Zahl blieb stehen
 * („2.779 mit Synchro" bei 2.924 Titeln). „Spätestens nach X sichtbar": Sobald der Bestand die
 * nächste Hunderterschwelle erreicht, ändert sich die Kennung — und damit Bild und Bildadresse.
 *
 * Aufruf: `npx tsx tools/og-standard.test.ts`
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, readJson } from '../pipeline/lib/util.ts'
import { mussNeuZeichnen, standardBildAdresse, standardKarte, standardKennung, standardKennungFuer, titelzahlText } from '../pipeline/lib/og-standard.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
const kennung = (n: number) => standardKennung(standardKarte(n))

pruefe(titelzahlText(2924) === 'über 2.900 mit Synchro', `2924 -> „${titelzahlText(2924)}"`)
pruefe(titelzahlText(2900) === titelzahlText(2999), 'Spanne 2900..2999 gleicher Text')
pruefe(titelzahlText(3000) === 'über 3.000 mit Synchro', '3000 -> über 3.000')

pruefe(kennung(2924) === kennung(2999), 'Neue Titel innerhalb der Hunderter ändern die Kennung nicht (kein Commit je Titel)')
pruefe(kennung(2999) !== kennung(3000), 'Die nächste Hunderterschwelle ändert die Kennung (Bild spätestens dann neu)')
pruefe(standardKarte(2924).badges.length === 0, 'Keine Plattform-Chips (Termine-Zeile nennt das Wo schon)')

pruefe(mussNeuZeichnen(true, kennung(2779), kennung(2924), false), 'Alte Kennung -> neu zeichnen (ohne den Fix blieb es beim vorhandenen Bild)')
pruefe(!mussNeuZeichnen(true, `${kennung(2924)}\n`, kennung(2924), false), 'Gleiche Kennung -> nicht neu zeichnen')
pruefe(mussNeuZeichnen(false, kennung(2924), kennung(2924), false), 'Bild fehlt -> zeichnen')
pruefe(mussNeuZeichnen(true, undefined, kennung(2924), false), 'Keine abgelegte Kennung -> zeichnen')
pruefe(mussNeuZeichnen(true, kennung(2924), kennung(2924), true), '--force -> zeichnen')

const { titleCount } = readJson<{ titleCount: number }>('public/data/meta.json', { titleCount: 0 })
pruefe(standardKennungFuer(titleCount) === kennung(titleCount), `Kennung für den Bestand (${titleCount} Titel)`)
pruefe(standardBildAdresse('https://x/', kennung(titleCount)).endsWith(`og/default.jpg?v=${kennung(titleCount)}`), 'Bildadresse trägt die Kennung')

/* Nach dem Seitenbau (`dist/`): Startseite und Verzeichnis zeigen genau die Adresse, zu der das Bild gehört. */
const start = resolve(ROOT, 'dist/index.html')
const verzeichnis = resolve(ROOT, 'dist/titel/index.html')
for (const datei of [start, verzeichnis]) {
  if (!existsSync(datei)) continue
  const html = readFileSync(datei, 'utf8')
  pruefe(html.includes(`og/default.jpg?v=${kennung(titleCount)}`), `${datei.slice(ROOT.length + 1)}: og:image trägt die Kennung des Bilds`)
}

const datei = resolve(ROOT, 'public/og/default.txt')
const abgelegt = existsSync(datei) ? readFileSync(datei, 'utf8').trim() : ''
pruefe(abgelegt === kennung(titleCount), `Das abgelegte Bild gehört zum Bestand (abgelegt „${abgelegt}", erwartet „${kennung(titleCount)}")`)

if (fehler) {
  console.error(`${fehler} Prüfung(en) rot`)
  process.exit(1)
}
console.log('og-standard: alles ok')
