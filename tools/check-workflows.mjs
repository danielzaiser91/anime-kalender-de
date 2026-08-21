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

/**
 * Jede Datei, die ein Lauf unter `data/` schreibt, muss `commit-data.sh` kennen.
 *
 * Sonst geht sie still verloren: Das Skript legt nur die aufgezählten Quellen
 * beiseite, bevor es bei bewegtem Fernstand `git reset --hard` macht — alles
 * andere ist danach weg, und committet wird es ohnehin nicht.
 *
 * Bei einer Momentaufnahme kostet das einen Lauf. Bei einem **Gedächtnis**
 * kostet es mehr: `data/synchro-historie.json` hält fest, seit wann ein Titel
 * eine Synchro hat. Fehlte sie in der Liste, stünde ein im CI dazugekommener
 * Titel bei jedem Lauf erneut als Neuzugang da — und jeder Abonnent bekäme bis
 * zu sechzig Tage lang täglich dieselbe Mail. Genau das war am 14.08.2026 der
 * Fall, einen Tag nach dem Einbau.
 *
 * Geprüft wird gegen die `writeJson`-Aufrufe der Pipeline, nicht gegen eine
 * zweite Liste — zwei Listen liefen wieder auseinander.
 */
const pipelineDir = resolve(process.cwd(), 'pipeline')
const geschrieben = new Set()
for (const datei of readdirSync(pipelineDir, { recursive: true })) {
  if (typeof datei !== 'string' || !datei.endsWith('.ts')) continue
  const quelltext = readFileSync(resolve(pipelineDir, datei), 'utf8')
  for (const m of quelltext.matchAll(/writeJson\(\s*'(data\/[^']+)'/g)) geschrieben.add(m[1])
}

const skript = readFileSync(resolve(process.cwd(), 'tools/commit-data.sh'), 'utf8')
for (const pfad of [...geschrieben].sort()) {
  // `data/cache/` liegt bewusst nicht im Repo (siehe .gitignore).
  if (pfad.startsWith('data/cache/')) continue
  // Vorschläge sind als Ordner aufgeführt.
  if (pfad.startsWith('data/proposals/')) continue
  if (!skript.includes(pfad)) {
    console.error(
      `✗ ${pfad} wird von der Pipeline geschrieben, steht aber nicht in tools/commit-data.sh — ` +
        'ein CI-Lauf würde die Datei verwerfen',
    )
    fehler++
  }
}

const ZEILENENDE = new RegExp(String.raw`?
`)
const JOBKOPF = new RegExp(String.raw`^ {2}[A-Za-z0-9_-]+:s*$`)
const AUSCHECKEN = new RegExp('uses: actions/checkout@')
/**
 * Statusmeldungen brauchen das Skript, das sie aufruft — und das liegt erst
 * nach dem Auscheckvorgang da.
 *
 * Real am 21.08.2026: Die Abmeldung landete in `deploy.yml` im Job "deploy",
 * der ohne Auscheckvorgang auskommt. Der Schritt läuft mit `if: always()`,
 * wäre also an `bash: tools/lauf-melden.sh: No such file` gescheitert — und
 * hätte damit jeden erfolgreichen Deploy rot gemacht.
 */
for (const datei of readdirSync(DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
  const zeilen = readFileSync(resolve(DIR, datei), 'utf8').split(ZEILENENDE)

  const jobs = []
  let inJobs = false
  zeilen.forEach((z, i) => {
    if (z.trim() === 'jobs:') { inJobs = true; return }
    if (inJobs && JOBKOPF.test(z)) jobs.push({ name: z.trim().replace(':', ''), i })
  })

  for (let n = 0; n < jobs.length; n++) {
    const bis = n + 1 < jobs.length ? jobs[n + 1].i : zeilen.length
    const block = zeilen.slice(jobs[n].i, bis).join('\n')
    if (!block.includes('lauf-melden.sh')) continue
    if (!AUSCHECKEN.test(block)) {
      console.error(
        `✗ ${datei} › Job "${jobs[n].name}" meldet den Laufstatus, hat aber keinen ` +
          'Auscheckvorgang — das Skript liegt dort nicht und der Schritt scheitert',
      )
      fehler++
    }
  }
}

const istMeldeaufruf = (zeile) =>
  zeile.includes('run: bash ') && (zeile.includes('MELDER') || zeile.includes('lauf-melden.sh'))
const SCHRITTKOPF = new RegExp(String.raw`^ {6}- name: `)

/**
 * Ein Meldeschritt darf einen Lauf niemals rot machen.
 *
 * Real am 21.08.2026: Ein Auftrags-Lauf legte seinen eigenen Zweig an und
 * wechselte dorthin — auf dem gab es `tools/lauf-melden.sh` noch nicht. Die
 * Abmeldung scheiterte mit `bash: No such file or directory` (Exit 127) und
 * machte einen Lauf rot, dessen Arbeit fertig und richtig war. Die
 * Statusanzeige zeigte ihn danach als „vermutlich abgestürzt".
 *
 * Zwei Sicherungen greifen seitdem: Das Skript liegt in `$RUNNER_TEMP`, wo kein
 * Zweigwechsel es wegnimmt, und der Schritt trägt `continue-on-error: true`.
 * Geprüft wird hier die zweite — sie ist die, die auch bei einer noch
 * unbekannten Ursache trägt.
 */
for (const datei of readdirSync(DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
  const zeilen = readFileSync(resolve(DIR, datei), 'utf8').split(ZEILENENDE)
  for (let i = 0; i < zeilen.length; i++) {
    if (!istMeldeaufruf(zeilen[i])) continue
    let k = i
    while (k > 0 && !SCHRITTKOPF.test(zeilen[k])) k--
    const kopf = zeilen.slice(k, i + 1).join('\n')
    if (!kopf.includes('continue-on-error: true')) {
      console.error(
        `✗ ${datei}, Zeile ${i + 1}: Der Meldeschritt hat kein \`continue-on-error: true\` — ` +
          'eine gescheiterte Statusmeldung würde den ganzen Lauf rot machen',
      )
      fehler++
    }
  }
}

const startetPipeline = (zeile) => {
  const t = zeile.trim()
  return t.startsWith('run: npm run data:') || t.startsWith('run: npm run check:')
}

/**
 * Ein Schritt, der ein Pipeline-Skript startet, braucht `LAUF_TOKEN`.
 *
 * Ohne das Token meldet `fortschrittsMelder()` still gar nichts — kein Fehler,
 * keine Warnung, nur eine Anzeige, die keine Zahl zeigt. Real am 21.08.2026:
 * Ein Lauf stand dreieinhalb Minuten ohne Fortschritt da, weil das Token nur
 * bei den An- und Abmeldeschritten stand, nicht beim Scraper selbst. Daniel
 * hat es gemeldet, nicht der Code.
 *
 * Dasselbe Muster wie beim `STREAMING_API_KEY` am selben Tag: Ein Secret zu
 * setzen genügt nicht, es muss in dem Schritt stehen, der es braucht.
 */
for (const datei of readdirSync(DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
  const inhalt = readFileSync(resolve(DIR, datei), 'utf8')
  // Nur Workflows, die überhaupt Statusmeldungen kennen.
  if (!inhalt.includes('lauf-melden.sh')) continue
  const zeilen = inhalt.split(ZEILENENDE)

  for (let i = 0; i < zeilen.length; i++) {
    if (!startetPipeline(zeilen[i])) continue
    let k = i
    while (k > 0 && !SCHRITTKOPF.test(zeilen[k])) k--
    if (!zeilen.slice(k, i).some((z) => z.includes('LAUF_TOKEN'))) {
      console.error(
        `✗ ${datei}, Zeile ${i + 1}: Pipeline-Schritt ohne LAUF_TOKEN — ` +
          'der Fortschritt käme in der Statusanzeige nie an',
      )
      fehler++
    }
  }
}

if (fehler) {
  console.error(`\n${fehler} Problem(e) in den Workflow-Dateien.`)
  process.exit(1)
}
