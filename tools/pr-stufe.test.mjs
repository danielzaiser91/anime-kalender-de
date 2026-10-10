/** Tests für tools/pr-stufe.mjs: die Fälle der Stufentabelle. */
import { bestimmeStufe, liesDiff } from './pr-stufe.mjs'

const fehler = []
const fall2 = (name, stufe, erwartet) => {
  if (stufe === erwartet) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Stufe ${stufe}`)
}
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

// Umgehungsversuche (Prüfer-Befund PR 661)
const diff = (...kopf) => kopf.join('\n')
const aus = (text) => bestimmeStufe(liesDiff(text)).stufe
const plus = '@@ -1 +1 @@\n+x'
const inhalt = (pfad, ...zeilen) => diff(`diff --git a/${pfad} b/${pfad}`, '--- a/' + pfad, '+++ b/' + pfad, '@@ -1 +1 @@', ...zeilen)
fall2('„+++evil()“ neben Kommentar in .ts → 1', aus(inhalt('web/src/x.ts', '+// ok', '+++evil()')), 1)
fall2('„--x“ als entfernte Zeile in .ts → 1', aus(inhalt('web/src/x.ts', '---x')), 1)
fall2('„---“ als Zeile einer Markdown-Tabelle → 0', aus(inhalt('docs/t.md', '+---', '+++---')), 0)
fall2('Markdown unter pipeline → nicht 0', aus(inhalt('pipeline/README.md', '+x')) >= 1 ? 1 : 0, 1)
fall2('quotierter Pfad neben Doku → 2', aus(diff('diff --git a/docs/a.md b/docs/a.md', plus, 'diff --git "a/pipeline/\\303\\274.ts" "b/pipeline/\\303\\274.ts"', plus)), 2)
fall2('Umbenennung pipeline → docs → 2', aus(diff('diff --git a/pipeline/build.ts b/docs/build.md', 'similarity index 100%', 'rename from pipeline/build.ts', 'rename to docs/build.md')), 2)
fall2('Löschung unter pipeline → 2', aus(diff('diff --git a/pipeline/x.ts b/pipeline/x.ts', 'deleted file mode 100644', '@@ -1 +0,0 @@', '-x')), 2)
fall('Code nach Kommentarende → nicht 0', [d('web/src/App.tsx', ["/* a */ fetch('//evil')"])], (s) => s >= 1)
fall('Code nach Blockende → nicht 0', [d('web/src/App.tsx', ['* Kommentar', '*/ code()'])], (s) => s >= 1)
fall('Blockkommentar → 0', [d('web/src/App.tsx', ['/*', ' * Warum', ' */'])], 0)
fall('.claude-Markdown → nicht 0', [d('.claude/rules/x.md')], (s) => s >= 1)
fall('tools/claude-global-Markdown → nicht 0', [d('tools/claude-global/skills/a/SKILL.md')], (s) => s >= 1)
fall('docs/deploy-Datei (.html) → nicht 0', [d('docs/seite.html')], (s) => s >= 1)
fall2('Binärbild in docs → 0', aus(diff('diff --git a/docs/a.png b/docs/a.png', 'Binary files a/docs/a.png and b/docs/a.png differ')), 0)
fall2('Binärdatei unter pipeline → 2', aus(diff('diff --git a/pipeline/a.bin b/pipeline/a.bin', 'Binary files a/pipeline/a.bin and b/pipeline/a.bin differ')), 2)
fall2('Symlink in docs → 2', aus(diff('diff --git a/docs/l.md b/docs/l.md', 'new file mode 120000', plus)), 2)
fall2('Moduswechsel einer Doku → 1', aus(diff('diff --git a/docs/a.md b/docs/a.md', 'old mode 100644', 'new mode 100755')), 1)

if (fehler.length) {
  console.error(`\n${fehler.length} Fälle fehlgeschlagen`)
  process.exit(1)
}
console.log('pr-stufe: alle Fälle grün')
