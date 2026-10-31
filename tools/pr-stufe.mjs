/**
 * Prüfstufe eines Pull Requests, mechanisch aus Pfaden und Zeilenzahl des Diffs (Daniel, 10.10.2026).
 *
 *   node tools/pr-stufe.mjs <PR-Nummer>        (Diff über `gh pr diff`)
 *   node tools/pr-stufe.mjs <ref-a> <ref-b>    (Diff über `git diff a...b`)
 *
 * Ausgabe: JSON { stufe, begruendung[], dateien }.
 *
 * Stufe 0 Kleinigkeit: kein eigener Prüfer-Agent; PR-Prüfkette plus schlanker CI-Prüfer (nur Diff, seit 12.10.2026), dann Merge und Livemessung.
 * Stufe 1 normal:      ein schlanker Prüfer liest den Diff und das CI-Ergebnis, baut nicht nach.
 * Stufe 2 hoch:        voller Prüfer mit Gegenproben und eigener Messung.
 *
 * Regeln (je Datei; der PR bekommt die höchste Stufe; keine Regel passt → 2; Zweifel → 2):
 *
 * | Pfad / Merkmal                                                              | Stufe   |
 * |-----------------------------------------------------------------------------|---------|
 * | pipeline, worker, Workflows, shared, package.json, tools, .claude, unbekannt | 2       |
 * | PR insgesamt über 300 geänderte Zeilen, oder leerer Diff                    | 2       |
 * | web/src, extension (UI-Logik), data/dub-confirmed.yaml, data/curated, data/*.yaml | 1 |
 * | Rechtstext (Impressum, Datenschutz, Nutzungsbedingungen)                    | mind. 1 |
 * | Textdatei mit Tatsachenzahl in hinzugefügten Zeilen (Uhrzeit, Datum, Folgenzahl, ID ab 5 Ziffern) | 1 |
 * | mehrere CSS-Dateien, oder eine CSS über 30 Zeilen                           | 1       |
 * | Skill-Text: .claude/skills/**\/*.md (andere Dateien dort bleiben 2)           | 1       |
 * | tools/claude-global/** (Regeln, Skills, Hooks, Mods; steuern Daniels Agenten) | 1       |
 * | Handwerkzeug tools/<name>.(mjs|cjs|js|ts) mit eigenem Test, dessen Name in .github, package.json, tools, pipeline, shared nirgends (außer in Tests) vorkommt (tools/pr-stufe-kette.mjs) | 1 |
 * | Doku: *.md, docs, daniel-zum-abarbeiten, mockups                            | 0       |
 * | Text: data/patchnotes/*.yaml, web/src/**\/i18n*.ts(x)                       | 0       |
 * | eine einzelne *.css unter web/src oder extension, höchstens 30 Zeilen       | 0       |
 * | nur Testdateien (*.test.*, *.spec.*; auch Umbenennungsquellen), sonst 2     | höchstens 1 |
 * | web/src-Code, dessen geänderte Zeilen alle Kommentare sind, höchstens 30    | 0       |
 *
 * Herabstufung gibt es nur durch diese Tabelle. Tatsachenzahlen (IDs, Termine, Uhrzeiten, Folgenzahlen,
 * Synchro-Status) sind nie Stufe 0.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { istHandwerkzeug, leseKette } from './pr-stufe-kette.mjs'

const GRENZE_CSS = 30
const GRENZE_KOMMENTAR = 30
const GRENZE_GROSS = 300

// Doku: .md nur im Wurzelordner oder unter docs/mockups/daniel-zum-abarbeiten; Markdown unter pipeline, web, shared, data, tools,
// .claude usw. ist mindestens Stufe 1 (fällt durch). Dort nur Bild-/Textendungen (docs/ löst einen Deploy aus,
// andere Endungen sind mindestens Stufe 1).
// Der Stufen-Kommentar des Prüfer-Workflows trägt eine Marke am Anfang. Ein untergeschobener Kommentar mit derselben Marke
// ändert die Stufe nie: der Workflow berechnet sie neu und liest den Kommentar nicht (fail-safe).
const DOKU = /^([^/]+\.md|(docs|mockups|daniel-zum-abarbeiten)\/.+\.(md|png|svg|jpg|jpeg|webp|txt))$/
const DOKU_ANDERE_ENDUNG = /^(docs|mockups|daniel-zum-abarbeiten)\//
// Skill-Texte steuern Agenten, ändern aber keinen Code: Stufe 1 (Prüfer liest den Diff), nie 0. Andere Dateien unter .claude/skills (Skripte) bleiben Stufe 2.
const SKILL_TEXT = /^\.claude\/skills\/.+\.md$/
// Daniels globale Claude-Konfiguration wirkt nicht auf die Website, steuert aber seine Agenten (wie Skill-Texte): immer Stufe 1.
const CLAUDE_GLOBAL = /^tools\/claude-global\//
const TEXT = /^(data\/patchnotes\/[^/]+\.yaml|web\/src\/(.*\/)?i18n[^/]*\.tsx?)$/
const CSS = /^(web\/src|extension)\/.*\.css$/
const WEB_CODE = /^web\/src\/.*\.tsx?$/
const RECHTSTEXT = /(impressum|datenschutz|nutzungsbedingungen)/i
const STUFE_1 = /^(web\/src\/|extension\/|data\/dub-confirmed\.yaml$|data\/curated\/|data\/[^/]+\.yaml$)/
// Testdatei: Name endet auf .test./.spec. mit Skript-Endung (in jedem Ordner).
const TESTDATEI = /(^|\/)[^/]+\.(test|spec)\.[cm]?[jt]sx?$/
const FAKTENZAHL = /\b\d{1,2}:\d{2}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\d{1,2}\.(\d{2,4})?(?!\d)|\b\d+\s*(Folgen?|Episoden?|Staffeln?|Uhr)\b|\b\d{5,}\b/i

/**
 * Zerlegt einen Unified-Diff in Dateien (Zielpfad, Quellpfad bei Umbenennen/Kopieren, hinzugefügte und entfernte Zeilen,
 * Modus-/Symlink-/Binär-Merkmale). Ein Kopf, den die Regex nicht versteht (z. B. von git quotierter Pfad), wird eine
 * Datei mit `unlesbar` und damit Stufe 2, nie den Zeilen der vorigen Datei zugeschlagen.
 */
export function liesDiff(text) {
  const dateien = []
  let aktuell = null
  for (const zeile of text.split('\n')) {
    if (zeile.startsWith('diff --git ')) {
      const kopf = /^diff --git a\/(\S.*) b\/(\S.*)$/.exec(zeile)
      aktuell = { pfad: kopf ? kopf[2] : zeile, quelle: null, hinzu: [], weg: [], modus: false, symlink: false, binaer: false, unlesbar: !kopf || zeile.includes('"') }
      if (kopf && kopf[1] !== kopf[2]) aktuell.quelle = kopf[1]
      dateien.push(aktuell)
    } else if (!aktuell) continue
    else if (zeile.startsWith('@@')) aktuell.imHunk = true
    // Nach dem ersten @@ ist jede +/- Zeile Inhalt, auch „+++evil()“ oder „---“; Kopfzeilen davor sind keiner.
    else if (aktuell.imHunk && zeile.startsWith('+')) aktuell.hinzu.push(zeile.slice(1))
    else if (aktuell.imHunk && zeile.startsWith('-')) aktuell.weg.push(zeile.slice(1))
    else if (aktuell.imHunk) continue
    else if (/^(rename|copy) from (.*)$/.test(zeile)) aktuell.quelle = zeile.replace(/^(rename|copy) from /, '')
    else if (/^(old|new|deleted file|new file) mode /.test(zeile)) {
      if (/^(old|new) mode /.test(zeile)) aktuell.modus = true
      if (/mode 120000/.test(zeile)) aktuell.symlink = true
    } else if (/^(Binary files |GIT binary patch)/.test(zeile)) aktuell.binaer = true
  }
  return dateien
}

/** Nur Kommentarzeilen? Der Blockzustand wird verfolgt; Code vor/nach einem Kommentar zählt als Code, im Zweifel Code. */
function nurKommentare(zeilen) {
  let imBlock = false
  for (const z of zeilen) {
    let t = z.trim()
    if (t === '') continue
    if (!imBlock) {
      if (t.startsWith('//')) continue
      if (t.startsWith('/*')) t = t.slice(2)
      else if (t.startsWith('*') && !t.startsWith('*/')) t = t.slice(1) // Hunk beginnt mitten im Blockkommentar
      else return false
      imBlock = true
    }
    const i = t.indexOf('*/')
    if (i < 0) continue
    if (t.slice(i + 2).trim() !== '') return false
    imBlock = false
  }
  return true
}

/** Stufe einer Datei: höchste Stufe aus Ziel- und Quellpfad (Umbenennen darf nicht herabstufen). */
function stufeDatei(d, kette) {
  if (d.unlesbar) return [2, 'Diff-Kopf nicht lesbar (z. B. quotierter Pfad)']
  if (d.symlink) return [2, 'Symlink']
  const ziel = stufeNachPfad(d, kette)
  if (!d.quelle) return ziel
  const quelle = stufeNachPfad({ ...d, pfad: d.quelle }, kette)
  return quelle[0] > ziel[0] ? [quelle[0], `${quelle[1]} (Quelle ${d.quelle})`] : ziel
}

function stufeNachPfad(d, kette) {
  const n = d.hinzu.length + d.weg.length
  if (d.modus) return [Math.max(1, stufeOhneModus(d, n, kette)[0]), 'Moduswechsel']
  return stufeOhneModus(d, n, kette)
}

function stufeOhneModus(d, n, kette) {
  if (RECHTSTEXT.test(d.pfad)) return [1, 'Rechtstext']
  if (DOKU.test(d.pfad)) return [0, 'Doku']
  if (TEXT.test(d.pfad)) {
    const zahl = d.hinzu.some((z) => !/^\s*(date|datum)\s*:/i.test(z) && FAKTENZAHL.test(z))
    return zahl ? [1, 'Text mit Tatsachenzahl (Uhrzeit, Datum, Folgenzahl oder ID)'] : [0, 'Text']
  }
  if (CSS.test(d.pfad)) return n <= GRENZE_CSS ? [0, `gescopte CSS (${n} Zeilen)`] : [1, `CSS über ${GRENZE_CSS} Zeilen (${n})`]
  if (WEB_CODE.test(d.pfad) && !d.binaer && n <= GRENZE_KOMMENTAR && nurKommentare(d.hinzu) && nurKommentare(d.weg)) return [0, 'nur Kommentare']
  if (SKILL_TEXT.test(d.pfad)) return [1, 'Skill-Text']
  if (DOKU_ANDERE_ENDUNG.test(d.pfad)) return [1, 'Datei in docs/mockups mit anderer Endung']
  if (CLAUDE_GLOBAL.test(d.pfad)) return [1, 'globale Claude-Konfiguration (Regel, Skill, Hook, Mod)']
  if (STUFE_1.test(d.pfad)) return [1, 'UI-Logik, Handbeleg oder Datenwert']
  if (istHandwerkzeug(d.pfad, kette, kette?.diff)) return [1, 'Handwerkzeug unter tools/ (kein Workflow, npm-Skript, keine Liste oder Quelle ruft es auf, eigener Test)']
  return [2, 'Pfad ohne Herabstufungsregel (Pipeline, Logik, Workflow, Worker, Schema oder unbekannt)']
}

// Unter public/ und extension/ liegt ausgelieferter Code: ein Testname dort ist kein Test.
const AUSGELIEFERT = /^(public|extension)\//

function istTest(pfad) {
  return TESTDATEI.test(pfad) && !AUSGELIEFERT.test(pfad)
}

function nurTest(d) {
  if (d.unlesbar || d.symlink) return false
  return istTest(d.pfad) && (!d.quelle || istTest(d.quelle))
}

/** Stufe des ganzen Diffs. Eingabe: Ergebnis von liesDiff. */
export function bestimmeStufe(dateien, keineKette = null) {
  const kette = keineKette && { ...keineKette, diff: dateien.map((d) => d.pfad) }
  const begruendung = []
  let stufe = 0
  for (const d of dateien) {
    const [s, grund] = stufeDatei(d, kette)
    if (s > 0) begruendung.push(`${d.pfad}: Stufe ${s} (${grund})`)
    stufe = Math.max(stufe, s)
  }
  // Nur Tests: höchstens Stufe 1, nicht 0 — gelöschte Tests oder geschwächte Zusicherungen sind aus dem Pfad nicht erkennbar.
  // Schon eine Nicht-Testdatei (auch als Umbenennungsquelle) lässt die Tabelle unverändert gelten.
  if (dateien.length > 0 && dateien.every(nurTest)) stufe = Math.min(stufe, 1)
  // „Eine Komponente/Datei": mehrere CSS-Dateien sind keine gescopte Anpassung.
  const csss = dateien.filter((d) => CSS.test(d.pfad))
  if (csss.length > 1 && stufe === 0) {
    stufe = 1
    begruendung.push(`${csss.length} CSS-Dateien: nicht gescopt (Stufe 1)`)
  }
  const summe = dateien.reduce((a, d) => a + d.hinzu.length + d.weg.length, 0)
  if (summe > GRENZE_GROSS) {
    stufe = 2
    begruendung.push(`${summe} geänderte Zeilen (über ${GRENZE_GROSS}): Stufe 2`)
  }
  if (dateien.length === 0) {
    stufe = 2
    begruendung.push('leerer Diff: Stufe 2')
  }
  if (stufe === 0) begruendung.push('nur Doku, Text, gescopte CSS oder Kommentare')
  return { stufe, begruendung, dateien: dateien.map((d) => d.pfad) }
}

function diffAusQuelle(args) {
  const r = args.length === 1
    ? spawnSync('gh', ['pr', 'diff', args[0]], { encoding: 'utf8', maxBuffer: 1 << 28 })
    : spawnSync('git', ['diff', `${args[0]}...${args[1]}`], { encoding: 'utf8', maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(`Diff nicht abrufbar: ${r.stderr}`)
  return r.stdout
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.length < 1 || args.length > 2) {
    console.error('Aufruf: node tools/pr-stufe.mjs <PR> | <ref-a> <ref-b>')
    process.exit(2)
  }
  try {
    console.log(JSON.stringify(bestimmeStufe(liesDiff(diffAusQuelle(args)), leseKette(process.cwd())), null, 2))
  } catch (e) {
    // Fail closed: ohne Diff gilt die höchste Stufe.
    console.log(JSON.stringify({ stufe: 2, begruendung: [String(e.message)], dateien: [] }, null, 2))
  }
}
