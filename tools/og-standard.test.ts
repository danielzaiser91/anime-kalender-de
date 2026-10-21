/**
 * **Das Standard-Vorschaubild bleibt aktuell, ohne bei jedem Titel zu wechseln** (13.10.2026).
 *
 * Vorher zeichnete `build-og.ts` `default.jpg` nur, wenn die Datei fehlte; die Zahl blieb stehen
 * („2.779 mit Synchro" bei 2.924 Titeln, belegt waren 2.546; die Zahl zählt jetzt nur Belegtes). „Spätestens nach X sichtbar": Sobald der Bestand die
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

pruefe(titelzahlText(2546) === 'über 2.500 Anime, Woche für Woche', `2546 -> „${titelzahlText(2546)}"`)
pruefe(titelzahlText(2500) === titelzahlText(2599), 'Spanne 2500..2599 gleicher Text')
pruefe(titelzahlText(2600) === 'über 2.600 Anime, Woche für Woche', '2600 -> über 2.600')

pruefe(kennung(2546) === kennung(2599), 'Neue Titel innerhalb der Hunderter ändern die Kennung nicht (kein Commit je Titel)')
pruefe(kennung(2599) !== kennung(2600), 'Die nächste Hunderterschwelle ändert die Kennung (Bild spätestens dann neu)')
pruefe(standardKarte(2546).liste.length === 3, 'Drei Aussagen, keine Plattform-Rangliste (Termine-Zeile nennt das Wo schon)')

pruefe(mussNeuZeichnen(true, kennung(2450), kennung(2546), false), 'Alte Kennung -> neu zeichnen (ohne den Fix blieb es beim vorhandenen Bild)')
pruefe(!mussNeuZeichnen(true, `${kennung(2546)}\n`, kennung(2546), false), 'Gleiche Kennung -> nicht neu zeichnen')
pruefe(mussNeuZeichnen(false, kennung(2546), kennung(2546), false), 'Bild fehlt -> zeichnen')
pruefe(mussNeuZeichnen(true, undefined, kennung(2546), false), 'Keine abgelegte Kennung -> zeichnen')
pruefe(mussNeuZeichnen(true, kennung(2546), kennung(2546), true), '--force -> zeichnen')

const { belegtCount } = readJson<{ belegtCount: number }>('public/data/meta.json', { belegtCount: 0 })
pruefe(standardKennungFuer(belegtCount) === kennung(belegtCount), `Kennung für den Bestand (${belegtCount} belegte Titel)`)
pruefe(standardBildAdresse('https://x/', kennung(belegtCount)).endsWith(`og/default.jpg?v=${kennung(belegtCount)}`), 'Bildadresse trägt die Kennung')

/* Nach dem Seitenbau (`dist/`): Startseite und Verzeichnis zeigen genau die Adresse, zu der das Bild gehört. */
const start = resolve(ROOT, 'dist/index.html')
const verzeichnis = resolve(ROOT, 'dist/titel/index.html')
for (const datei of [start, verzeichnis]) {
  if (!existsSync(datei)) continue
  const html = readFileSync(datei, 'utf8')
  pruefe(html.includes(`og/default.jpg?v=${kennung(belegtCount)}`), `${datei.slice(ROOT.length + 1)}: og:image trägt die Kennung des Bilds`)
}

const datei = resolve(ROOT, 'public/og/default.txt')
const abgelegt = existsSync(datei) ? readFileSync(datei, 'utf8').trim() : ''
pruefe(abgelegt === kennung(belegtCount), `Das abgelegte Bild gehört zum Bestand (abgelegt „${abgelegt}", erwartet „${kennung(belegtCount)}")`)

if (fehler) {
  console.error(`${fehler} Prüfung(en) rot`)
  process.exit(1)
}
console.log('og-standard: alles ok')
