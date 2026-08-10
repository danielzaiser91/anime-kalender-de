/**
 * Prüft, ob die Workflow-Dateien gültiges YAML sind und ihre Auslöser tragen.
 *
 * Warum es das gibt: Am 10.08.2026 machte eine einzige Zeile alle drei
 * Datenläufe unbrauchbar —
 *
 *     run: bash tools/commit-data.sh "chore(data): Datensatz aktualisiert"
 *
 * Das `: ` mitten im Wert beendet für YAML den Skalar; die Datei ist damit
 * kaputt. GitHub meldet das nicht als Fehler, sondern verhält sich, als gäbe
 * es den Workflow nur als Datei: Der Name in der Übersicht wird zum Pfad, und
 * `gh workflow run` antwortet mit „Workflow does not have 'workflow_dispatch'
 * trigger" — eine Meldung, die auf eine ganz andere Ursache zeigt. Die
 * geplanten Läufe wären still ausgefallen.
 *
 * Ein Anführungszeichen mitten im Wert hilft übrigens nicht: YAML erkennt
 * einen zitierten Skalar nur, wenn das Zitat das erste Zeichen ist. Richtig
 * ist ein Block-Skalar (`run: |`).
 *
 * Läuft in `npm run check:workflows` und im Deploy.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'

const DIR = resolve(process.cwd(), '.github/workflows')
let fehler = 0

for (const datei of readdirSync(DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
  const pfad = resolve(DIR, datei)
  let doc
  try {
    doc = parse(readFileSync(pfad, 'utf8'))
  } catch (err) {
    console.error(`✗ ${datei}: kein gültiges YAML — ${err.message.split('\n')[0]}`)
    fehler++
    continue
  }

  // `on` wird von YAML 1.1 als Boolean true gelesen, von YAML 1.2 als String.
  const ausloeser = doc?.on ?? doc?.[true]
  if (!doc?.name) {
    console.error(`✗ ${datei}: kein \`name\` — GitHub zeigt dann den Dateipfad an`)
    fehler++
  }
  if (!ausloeser) {
    console.error(`✗ ${datei}: kein \`on\`-Block — der Workflow läuft nie`)
    fehler++
    continue
  }
  const namen = typeof ausloeser === 'object' ? Object.keys(ausloeser) : [String(ausloeser)]
  console.log(`✓ ${datei.padEnd(22)} ${doc.name} — ${namen.join(', ')}`)
}

if (fehler) {
  console.error(`\n${fehler} Problem(e) in den Workflow-Dateien.`)
  process.exit(1)
}
