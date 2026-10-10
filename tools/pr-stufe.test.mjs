/** Tests für tools/pr-stufe.mjs: die Fälle der Stufentabelle. */
import { bestimmeStufe } from './pr-stufe.mjs'

const fehler = []
const zeilen = (n, text = 'x') => Array.from({ length: n }, () => text)
const d = (pfad, hinzu = ['a'], weg = []) => ({ pfad, hinzu, weg })
const fall = (name, dateien, erwartet) => {
  const { stufe } = bestimmeStufe(dateien)
  const ok = typeof erwartet === 'function' ? erwartet(stufe) : stufe === erwartet
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Stufe ${stufe}`)
}

fall('Textänderung i18n → 0', [d('web/src/i18n.ts', ['  knopf: "Speichern"'], ['  knopf: "Sichern"'])], 0)
fall('Patchnotes-Text → 0', [d('data/patchnotes.yaml', ['  text: Neue Ansicht'])], 0)
fall('Doku → 0', [d('docs/wissen/betrieb.md', zeilen(80))], 0)
fall('CSS ≤ 30 Zeilen → 0', [d('web/src/styles.css', zeilen(20), zeilen(10))], 0)
fall('CSS > 30 Zeilen → 1', [d('web/src/styles.css', zeilen(31))], 1)
fall('zwei CSS-Dateien → 1', [d('web/src/styles.css'), d('web/src/tippziele.css')], 1)
fall('nur Kommentare in web/src → 0', [d('web/src/App.tsx', ['// Warum: Entprellen'])], 0)
fall('Text mit Uhrzeit → 1', [d('data/patchnotes.yaml', ['  text: Start um 08:00'])], 1)
fall('Text mit Folgenzahl → 1', [d('web/src/i18n.ts', ['  info: "12 Folgen"'])], 1)
fall('neuer Handbeleg → 1', [d('data/dub-confirmed.yaml', zeilen(8))], 1)
fall('UI-Logik → 1', [d('web/src/components/Liste.tsx', zeilen(40))], 1)
fall('Rechtstext → mindestens 1', [d('web/src/components/Datenschutz.tsx', ['Text'])], (s) => s >= 1)
fall('pipeline/lib → 2', [d('pipeline/lib/pruefung.ts', ['x'])], 2)
fall('Workflow → 2', [d('.github/workflows/pr-pruefung.yml', ['x'])], 2)
fall('gemischt → höchste Stufe', [d('docs/a.md'), d('web/src/styles.css'), d('shared/logic.ts')], 2)
fall('unbekannter Pfad → 2', [d('irgendwas/neu.bin', ['x'])], 2)
fall('über 300 Zeilen → 2', [d('web/src/components/Liste.tsx', zeilen(301))], 2)
fall('leerer Diff → 2', [], 2)

if (fehler.length) {
  console.error(`\n${fehler.length} Fälle fehlgeschlagen`)
  process.exit(1)
}
console.log('pr-stufe: alle Fälle grün')
