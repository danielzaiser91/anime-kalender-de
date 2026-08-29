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
 * Geprüft wird gegen den Quelltext der Pipeline, nicht gegen eine zweite Liste
 * — zwei Listen liefen wieder auseinander.
 *
 * **Grob statt genau, und zwar mit Absicht** (verschärft am 24.08.2026). Bis
 * dahin sah die Prüfung nur `.ts`-Dateien und nur `writeJson('data/…')`. Zwei
 * blinde Flecken, vier verlorene Dateien:
 *
 * 1. `.mjs`-Läufe wurden gar nicht gelesen — `check-youtube.mjs` und
 *    `check-rtlplus.mjs` sind vollwertige Läufe, nur ohne Typen.
 * 2. Steht das Ziel in einer Konstanten (`const ZIEL = resolve(wurzel,
 *    'data/…')`, später `writeFileSync(ZIEL, …)`), steht das Literal nirgends
 *    neben einem Schreibaufruf.
 *
 * Deshalb zählt jetzt **jedes** `data/…`-Literal in einer Datei, die überhaupt
 * schreibt. Das meldet auch reine Lesepfade mit — und das ist die richtige
 * Seite zum Irren: Eine Datei zu viel in `commit-data.sh` wird beiseitegelegt
 * und unverändert zurückgelegt, das kostet nichts. Eine zu wenig kostet die
 * Arbeit jedes CI-Laufs, und zwar still.
 */
const pipelineDir = resolve(process.cwd(), 'pipeline')
const geschrieben = new Set()
for (const datei of readdirSync(pipelineDir, { recursive: true })) {
  if (typeof datei !== 'string' || !/\.(ts|mjs|js)$/.test(datei)) continue
  const quelltext = readFileSync(resolve(pipelineDir, datei), 'utf8')
  // Nur Dateien, die überhaupt schreiben — sonst meldete jeder Lesezugriff.
  if (!/writeFileSync|writeJson|writeFile\b/.test(quelltext)) continue
  for (const m of quelltext.matchAll(/['"](data\/[^'"]+)['"]/g)) geschrieben.add(m[1])
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

// Muster als Literal, nicht über `new RegExp(String.raw…)`: Der Weg über einen
// String hat hier schon zweimal Backslashes verloren (21.08.2026), und beide
// Male war das Ergebnis eine Prüfung, die stumm nichts mehr fand. Ein Literal
// steht so in der Datei, wie es gilt.
const ZEILENENDE = /\r?\n/
const JOBKOPF = /^ {2}[A-Za-z0-9_-]+:\s*$/
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

/**
 * Skripte, die keinen Fortschritt melden — und deshalb kein Token brauchen.
 *
 * Die Regel darunter gilt fuer alles, was laenger laeuft und dabei eine Zahl
 * schicken soll. `data:historie` schreibt eine einzige Zeile aus dem fertigen
 * Datensatz; es ruft nichts ab und meldet nichts. Ein Token dort waere ein
 * Versprechen auf eine Anzeige, die es nicht gibt.
 *
 * Die Liste bleibt kurz. Wer ein Skript hier eintraegt, prueft vorher, ob es
 * wirklich keinen Fortschritt melden soll — die Regel hat am 21.08.2026 einen
 * Lauf gefunden, der dreieinhalb Minuten stumm dastand.
 */
const OHNE_FORTSCHRITT = ['data:historie']

const startetPipeline = (zeile) => {
  const t = zeile.trim()
  if (OHNE_FORTSCHRITT.some((n) => t.includes(n))) return false
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


/**
 * Ein Job, der sich bei der Statusanzeige meldet, sagt auch, wofür er läuft.
 *
 * Ohne `LAUF_ZWECK` steht in der Anzeige nur der Workflow-Name. Bei den drei
 * Auftrags-Läufen ist das dreimal derselbe Text, und bei den Datenläufen sagt
 * er nichts über Umfang oder Ziel. Daniel am 21.08.2026: „ich sehe nicht
 * wieviele noch offen sind, es ist wirklich schlecht das einzuschätzen."
 *
 * Geprüft wird auf Job-Ebene, weil die Meldeschritte über den ganzen Job
 * verteilt sind — Anmeldung oben, Abmeldung unten, Fortschritt dazwischen.
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
    for (const feld of ['LAUF_ZWECK', 'LAUF_ZIEL']) {
      if (block.includes(feld + ':')) continue
      console.error(
        `✗ ${datei} › Job "${jobs[n].name}" meldet den Laufstatus, setzt aber kein ${feld} — ` +
          'die Statusanzeige zeigte dann nur den Workflow-Namen',
      )
      fehler++
    }
  }
}


/*
  **Ein `data:`-Skript, das in keinem Workflow steht, veraltet still.**

  CLAUDE.md sagt es seit dem 16.08.2026 unter „Ein neuer Abruf braucht drei
  Dinge" — geprüft wurde bisher nur das zweite (steht die Datei in
  `commit-data.sh`?). Das erste, der Platz in einem Workflow, blieb ein Vorsatz.

  Am 29.08.2026 gemessen: **elf** der 47 `data:`-Skripte standen in keiner
  Automatik. Der teuerste Fall war `data:vorschlaege`: Es schreibt
  `data/anbieter-vorschlaege.json`, aus der die Prüfliste entsteht — die Liste
  wurde also stündlich neu gebaut und ihre Grundlage nie. Dazu die Netflix- und
  RTL+-Arbeitslisten und die Wiedervorlage, also ausgerechnet der Lauf, der
  gealterte Handprüfungen aufspüren soll.

  **Was hier absichtlich fehlen darf, steht in der Ausnahmeliste** — mit Grund,
  damit niemand sie später für Vergessenes hält.
*/
const NUR_VON_HAND = {
  'data:all': 'Sammelbefehl für einen kompletten Durchlauf von Hand',
  'data:icons': 'erzeugt Bilddateien, die im Repo liegen — läuft bei einer Designänderung',
  'data:adn:refresh': 'holt das ADN-Archiv komplett neu; Stunden Laufzeit, nur bei Parserbruch',
  'data:anisearch:reparse': 'liest das Archiv neu ein, ohne einen einzigen Abruf',
  'data:anisearch:check': 'Prüfung gegen das Archiv — hängt in `check:*`, nicht in einem Datenlauf',
  'data:disc-proposals': 'erzeugt Vorschläge, die ein Mensch einzeln annimmt',
}

{
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts
  const alleWorkflows = readdirSync(new URL('../.github/workflows/', import.meta.url))
    .map((f) => readFileSync(new URL('../.github/workflows/' + f, import.meta.url), 'utf8'))
    .join('\n')
  const vergessen = Object.keys(pkg)
    .filter((k) => k.startsWith('data:'))
    .filter((k) => !NUR_VON_HAND[k])
    .filter((k) => !alleWorkflows.includes(k))
  for (const k of vergessen) {
    console.error(
      `✗ npm-Skript "${k}" steht in keinem Workflow — es läuft dann genau einmal von Hand ` +
        'und veraltet danach still (CLAUDE.md, „Ein neuer Abruf braucht drei Dinge"). ' +
        'Absichtlich manuell? Dann mit Grund in NUR_VON_HAND eintragen.',
    )
    fehler++
  }
}


/*
  **Was ein Lauf schreibt, muss auch committet werden.**

  CLAUDE.md nennt es als zweites von „Ein neuer Abruf braucht drei Dinge", und
  `check-workflows` prüft es für `data/…` seit dem 24.08.2026. Für Dateien
  außerhalb von `data/` galt es nicht — und genau dort lag der nächste Fall.

  Am 29.08.2026 gemessen: `data:dub-checks` schreibt **neun** Arbeitslisten
  unter `daniel-zum-abarbeiten/`, aber nur zwei standen in `commit-data.sh`. Die
  anderen sieben entstanden bei jedem Lauf neu und wurden beim `git reset`
  weggeworfen. Im Repo stand der Stand vom 24.08.: `07-primevideo.md` nannte
  **588 offene Verweise**, tatsächlich offen waren 65.

  Das ist teurer als eine veraltete Zahl — es ist Daniels Zeit: Er hätte 400
  Zeilen abgearbeitet, von denen die meisten längst geprüft waren.
*/
{
  const skript = readFileSync(new URL('../tools/commit-data.sh', import.meta.url), 'utf8')
  const geschrieben = new Set()
  for (const datei of readdirSync(new URL('../pipeline/', import.meta.url))) {
    if (!/\.(ts|mjs)$/.test(datei)) continue
    const inhalt = readFileSync(new URL('../pipeline/' + datei, import.meta.url), 'utf8')
    for (const m of inhalt.matchAll(/['"`](daniel-zum-abarbeiten\/[\w.-]+\.md)['"`]/g)) {
      geschrieben.add(m[1])
    }
  }
  const fehlend = [...geschrieben].filter((p) => !skript.includes(p))
  for (const p of fehlend) {
    console.error(
      `✗ ${p} wird von einem Lauf geschrieben, steht aber nicht in tools/commit-data.sh — ` +
        'der `git reset` im CI wirft die Datei weg, und im Repo bleibt der alte Stand.',
    )
    fehler++
  }
}

if (fehler) {
  console.error(`\n${fehler} Problem(e) in den Workflow-Dateien.`)
  process.exit(1)
}
