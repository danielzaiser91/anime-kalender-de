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
const HANDGEPFLEGT = new Set(['data/synchro-von-hand.yaml', 'data/erstausgabe-von-hand.yaml', 'data/folgen-hinweise.yaml', 'data/anisearch-ids-hand.yaml', 'data/adn-adressen.yaml', 'data/rtlplus-adressen.yaml', 'data/verweise-von-hand.yaml', 'data/reihen-von-hand.yaml', 'data/blocker-von-hand.yaml', 'data/tmdb-von-hand.yaml', 'data/adn-staffelzuordnung.yaml'])
for (const datei of readdirSync(pipelineDir, { recursive: true })) {
  if (typeof datei !== 'string' || !/\.(ts|mjs|js)$/.test(datei)) continue
  const quelltext = readFileSync(resolve(pipelineDir, datei), 'utf8')
  // Nur Dateien, die überhaupt schreiben — sonst meldete jeder Lesezugriff.
  if (!/writeFileSync|writeJson|writeFile\b/.test(quelltext)) continue
  for (const m of quelltext.matchAll(/['"](data\/[^'"]+)['"]/g)) geschrieben.add(m[1])
}

// Die Liste der Quellpfade liegt seit dem 30.08.2026 in einer eigenen Datei:
// `commit-data.sh` und `quellen-pr.sh` brauchen dieselbe.
const skript = readFileSync(resolve(process.cwd(), 'tools/quellen-liste.sh'), 'utf8')
for (const pfad of [...geschrieben].sort()) {
  // `data/cache/` liegt bewusst nicht im Repo (siehe .gitignore).
  if (pfad.startsWith('data/cache/')) continue
  // Vorschläge sind als Ordner aufgeführt.
  if (pfad.startsWith('data/proposals/')) continue
  // Handgepflegte Dateien liest die Pipeline nur; sie stehen bewusst nicht in der Liste (siehe Kopf von quellen-liste.sh, 04.10.2026).
  if (HANDGEPFLEGT.has(pfad)) continue
  if (!skript.includes(pfad)) {
    console.error(
      `✗ ${pfad} wird von der Pipeline geschrieben, steht aber nicht in tools/quellen-liste.sh — ` +
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
  'data:cr-einzelwerke': 'braucht ein anonymes Token mit deutscher Region — auf GitHubs US-Rechnern bricht es ab; läuft von Daniels Rechner (check-sources führt eine Frist von 21 Tagen)',
  'data:cr-filmbloecke': 'wie data:cr-einzelwerke',
  'data:cr-katalog': 'wie data:cr-einzelwerke',
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

  **Gezählt wird nur, was geschrieben wird, nicht was genannt wird** (01.10.2026).
  Die erste Fassung sammelte jeden zitierten Pfad — und schlug Alarm, als
  `report-start.ts` eine **handgeschriebene** Anleitung verlinkte
  (`datei: 'daniel-zum-abarbeiten/21-disneyplus-gruen.md'`). Der Deploy war damit ab
  dem 30.09. 22:30 dreimal rot, und die Seite stand still. Jetzt zählt ein Pfad nur,
  wenn im Umfeld ein `writeFileSync`/`writeJson`/`writeText` steht.
*/
{
  const skript = readFileSync(new URL('../tools/quellen-liste.sh', import.meta.url), 'utf8')
  const geschrieben = new Set()
  const SCHREIBT = /write(?:FileSync|File|Json|Text)\s*\(/
  for (const datei of readdirSync(new URL('../pipeline/', import.meta.url))) {
    if (!/\.(ts|mjs)$/.test(datei)) continue
    const zeilen = readFileSync(new URL('../pipeline/' + datei, import.meta.url), 'utf8').split('\n')
    zeilen.forEach((zeile, i) => {
      for (const m of zeile.matchAll(/['"`](daniel-zum-abarbeiten\/[\w.-]+\.md)['"`]/g)) {
        /* Drei Zeilen Umfeld: Ein `writeFileSync(` darf vor seinem Pfad umbrechen. */
        const umfeld = zeilen.slice(Math.max(0, i - 2), i + 1).join('\n')
        if (SCHREIBT.test(umfeld)) geschrieben.add(m[1])
      }
    })
  }
  const fehlend = [...geschrieben].filter((p) => !skript.includes(p))
  for (const p of fehlend) {
    console.error(
      `✗ ${p} wird von einem Lauf geschrieben, steht aber nicht in tools/quellen-liste.sh — ` +
        'der `git reset` im CI wirft die Datei weg, und im Repo bleibt der alte Stand.',
    )
    fehler++
  }
}


/*
  **Wer auf `main` schreibt, steht allein; wer eine fremde Quelle drosselt, teilt eine Sperre.**

  Bis zum 05.10.2026 galt: alle Datenläufe in einer Gruppe `daten`. Anlass war der 29.08.2026 — ein Abruf auf Abruf lief parallel zum Tageslauf, beide holten
  gleichzeitig aniSearch-Seiten (der Takt von sechs Sekunden wurde zu dreien), und wer zuletzt committete, gewann. Die Gruppe löste beides, kostete aber:
  Der Wochenlauf hielt Bau und Stundenlauf bis zu anderthalb Stunden an (15 von 148 Bauläufen in sieben Tagen abgebrochen).

  Heute trennt die Bauart die Fälle:
  - **Schreiben auf `main`** (`commit-data.sh`) tut nur der Bestandsbau, in der Gruppe `bau`. Alle Sammler reichen per Pull Request ein
    (`quellen-pr.sh`), jeder in seiner eigenen Gruppe; Konflikte zwischen Dateien entstehen nicht, weil nur die eigenen Änderungen zurückgelegt werden
    (`tools/quellen-aufsetzen.sh`).
  - **aniSearch** (Takt als Zusage) hat eine eigene Sperre: Jeder Job, der `data:anisearch*` aufruft und nicht im Tageslauf steht, trägt
    `concurrency: group: anisearch` auf Job-Ebene.
*/
{
  const dir = new URL('../.github/workflows/', import.meta.url)
  const nurCode = (inhalt) => inhalt.split('\n').filter((z) => !z.trim().startsWith('#'))
  for (const datei of readdirSync(dir)) {
    if (!datei.endsWith('.yml')) continue
    const inhalt = readFileSync(new URL(datei, dir), 'utf8')
    const zeilen = nurCode(inhalt)
    const commit = zeilen.some((z) => z.includes('commit-data.sh'))
    const pr = zeilen.some((z) => z.includes('quellen-pr.sh'))
    const cIndex = zeilen.findIndex((l) => l.trim() === 'concurrency:')
    const gZeile = cIndex < 0 ? undefined : zeilen.slice(cIndex + 1, cIndex + 4).find((l) => l.trim().startsWith('group:'))
    const gruppe = gZeile ? gZeile.split(':')[1].trim() : undefined
    if (commit && datei !== 'bestand-bauen.yml') {
      console.error(`✗ ${datei} ruft commit-data.sh auf — nur der Bestandsbau schreibt auf main, alle anderen reichen per quellen-pr.sh ein.`)
      fehler++
    }
    if (commit && gruppe !== 'bau') {
      console.error(`✗ ${datei} schreibt auf main, steht aber in der Gruppe "${gruppe ?? 'keine'}" statt "bau".`)
      fehler++
    }
    if (pr && (!gruppe || gruppe === 'bau')) {
      console.error(`✗ ${datei} reicht Pull Requests ein, hat aber keine eigene Concurrency-Gruppe (gefunden: "${gruppe ?? 'keine'}").`)
      fehler++
    }
  }
  for (const datei of ['anisearch-katalog.yml', 'refresh-weekly.yml']) {
    const inhalt = readFileSync(new URL(datei, dir), 'utf8')
    if (!/concurrency:\s*\n\s+group:\s*anisearch\s*\n/.test(inhalt)) {
      console.error(`✗ ${datei} ruft aniSearch ab, trägt aber keine Job-Sperre "group: anisearch" — der Takt von sechs Sekunden ist eine Zusage.`)
      fehler++
    }
  }
}

/*
  **Wer „nichts zu tun" meldet, muss es als Erfolg melden.**

  Am 29.08.2026 hat das den Tageslauf zweimal abgebrochen: `youtube-check`
  meldete `count: 0` mit dem Grund „nichts zu prüfen", weil alle Verweise
  geprüft waren. `lastOk` blieb stehen, nach neun Tagen galt die Quelle als
  stumm, der Lauf brach ab, und der Reparatur-Automat sprang an.

  Die Unterscheidung heißt `leerIstOk` in `recordSource`: **nichts zu tun**
  (Warteschlange leer) gegen **nichts bekommen** (Abruf fehlgeschlagen). Wer
  einen Grund wie „nichts fällig", „nichts zu prüfen" oder „nichts nachzuladen"
  übergibt, meint fast immer den ersten Fall — und schreibt damit einen Ausfall
  in den Bestand.

  Geprüft wird der Wortlaut, nicht die Absicht; das ist grob, aber es fängt
  genau die Formulierung, die dreimal zu einem falschen Alarm geführt hat.
*/
{
  const verdaechtig = /['"`](nichts (zu prüfen|fällig|nachzuladen|zu tun)|keine Arbeit)['"`]/
  for (const datei of readdirSync(new URL('../pipeline/', import.meta.url))) {
    if (!datei.endsWith('.ts')) continue
    const inhalt = readFileSync(new URL('../pipeline/' + datei, import.meta.url), 'utf8')
    for (const zeile of inhalt.split(String.fromCharCode(10))) {
      if (!zeile.includes('recordSource(')) continue
      if (!verdaechtig.test(zeile)) continue
      console.error(
        `✗ pipeline/${datei}: recordSource meldet „nichts zu tun" als Fehlergrund — ` +
          'das schreibt einen Ausfall in `source-health.json` und macht den Tageslauf ' +
          'nach Ablauf der Frist rot. Stattdessen `leerIstOk` (fünftes Argument) setzen.',
      )
      fehler++
    }
  }
}

/*
  **Ein geduldeter Schritt darf nicht still scheitern** (30.09.2026).

  Der Wochenprogramm-Leser warf drei Tage lang bei jedem Stundelauf — der Schritt trägt
  `continue-on-error: true`, der Lauf blieb also grün, und `data/crunchyroll-woche.json` stand
  unverändert auf der Vorwoche. Aufgefallen ist es nur, weil jemand die Datei zufällig ansah.

  Deshalb: Läuft ein geduldeter Schritt ein `pipeline/*.ts`, muss das Skript seinen Ausfall selbst
  sichtbar machen — über den Wachhund (`recordSource`, das `check-sources` auswertet) **oder** als
  Vorfall (`meldeAbbruch`). Fehlt beides, bleibt ein Ausfall unsichtbar.
*/
for (const datei of readdirSync(DIR).filter((f) => f.endsWith('.yml'))) {
  let doc
  try {
    doc = parse(readFileSync(resolve(DIR, datei), 'utf8'))
  } catch {
    continue // ungültiges YAML meldet der Durchlauf oben schon
  }
  for (const job of Object.values(doc?.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      if (step['continue-on-error'] !== true) continue
      const run = String(step.run ?? '')
      for (const treffer of run.matchAll(/pipeline\/[a-z0-9-]+\.ts/g)) {
        const skript = treffer[0]
        let inhalt
        try {
          inhalt = readFileSync(resolve(process.cwd(), skript), 'utf8')
        } catch {
          continue
        }
        if (inhalt.includes('recordSource(') || inhalt.includes('meldeAbbruch(')) continue
        console.error(
          `✗ ${datei}: „${step.name ?? skript}" darf scheitern (continue-on-error), ` +
            `aber ${skript} meldet sich nirgends — ein stiller Ausfall fällt niemandem auf. ` +
            'Entweder `recordSource()` (Wachhund) oder `meldeAbbruch()` (Vorfall) ergänzen.',
        )
        fehler++
      }
    }
  }
}

if (fehler) {
  console.error(`\n${fehler} Problem(e) in den Workflow-Dateien.`)
  process.exit(1)
}
