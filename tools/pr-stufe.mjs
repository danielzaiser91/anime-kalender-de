/**
 * Prüfstufe eines Pull Requests, mechanisch aus Pfaden und Zeilenzahl des Diffs (Daniel, 10.10.2026).
 *
 *   node tools/pr-stufe.mjs <PR-Nummer>        (Diff über `gh pr diff`)
 *   node tools/pr-stufe.mjs <ref-a> <ref-b>    (Diff über `git diff a...b`)
 *
 * Ausgabe: JSON { stufe, begruendung[], dateien }.
 *
 * Stufe 0 Kleinigkeit: kein Prüfer-Agent; nur PR-Prüfkette (grün = Merge) plus Livemessung.
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
 * | Doku: *.md, docs, daniel-zum-abarbeiten, mockups                            | 0       |
 * | Text: data/patchnotes.yaml, web/src/**\/i18n*.ts(x)                         | 0       |
 * | eine einzelne *.css unter web/src oder extension, höchstens 30 Zeilen       | 0       |
 * | web/src-Code, dessen geänderte Zeilen alle Kommentare sind, höchstens 30    | 0       |
 *
 * Herabstufung gibt es nur durch diese Tabelle. Tatsachenzahlen (IDs, Termine, Uhrzeiten, Folgenzahlen,
 * Synchro-Status) sind nie Stufe 0.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const GRENZE_CSS = 30
const GRENZE_KOMMENTAR = 30
const GRENZE_GROSS = 300

const DOKU = /^(.+\.md|docs\/.*|daniel-zum-abarbeiten\/.*|mockups\/.*)$/
const TEXT = /^(data\/patchnotes\.yaml|web\/src\/(.*\/)?i18n[^/]*\.tsx?)$/
const CSS = /^(web\/src|extension)\/.*\.css$/
const WEB_CODE = /^web\/src\/.*\.tsx?$/
const RECHTSTEXT = /(impressum|datenschutz|nutzungsbedingungen)/i
const STUFE_1 = /^(web\/src\/|extension\/|data\/dub-confirmed\.yaml$|data\/curated\/|data\/[^/]+\.yaml$)/
const FAKTENZAHL = /\b\d{1,2}:\d{2}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\d{1,2}\.(\d{2,4})?(?!\d)|\b\d+\s*(Folgen?|Episoden?|Staffeln?|Uhr)\b|\b\d{5,}\b/i

/** Zerlegt einen Unified-Diff in Dateien mit hinzugefügten und entfernten Zeilen. */
export function liesDiff(text) {
  const dateien = []
  let aktuell = null
  for (const zeile of text.split('\n')) {
    const kopf = /^diff --git a\/(.*) b\/(.*)$/.exec(zeile)
    if (kopf) {
      aktuell = { pfad: kopf[2], hinzu: [], weg: [] }
      dateien.push(aktuell)
    } else if (aktuell && zeile.startsWith('+') && !zeile.startsWith('+++')) aktuell.hinzu.push(zeile.slice(1))
    else if (aktuell && zeile.startsWith('-') && !zeile.startsWith('---')) aktuell.weg.push(zeile.slice(1))
  }
  return dateien
}

const istKommentar = (z) => /^\s*(\/\/|\/\*|\*)/.test(z) || z.trim() === ''

/** Stufe einer einzelnen Datei samt Grund. */
function stufeDatei(d) {
  const n = d.hinzu.length + d.weg.length
  if (RECHTSTEXT.test(d.pfad)) return [1, 'Rechtstext']
  if (DOKU.test(d.pfad)) return [0, 'Doku']
  if (TEXT.test(d.pfad)) {
    const zahl = d.hinzu.some((z) => !/^\s*(date|datum)\s*:/i.test(z) && FAKTENZAHL.test(z))
    return zahl ? [1, 'Text mit Tatsachenzahl (Uhrzeit, Datum, Folgenzahl oder ID)'] : [0, 'Text']
  }
  if (CSS.test(d.pfad)) return n <= GRENZE_CSS ? [0, `gescopte CSS (${n} Zeilen)`] : [1, `CSS über ${GRENZE_CSS} Zeilen (${n})`]
  if (WEB_CODE.test(d.pfad) && n <= GRENZE_KOMMENTAR && [...d.hinzu, ...d.weg].every(istKommentar)) return [0, 'nur Kommentare']
  if (STUFE_1.test(d.pfad)) return [1, 'UI-Logik, Handbeleg oder Datenwert']
  return [2, 'Pfad ohne Herabstufungsregel (Pipeline, Logik, Workflow, Worker, Schema oder unbekannt)']
}

/** Stufe des ganzen Diffs. Eingabe: Ergebnis von liesDiff. */
export function bestimmeStufe(dateien) {
  const begruendung = []
  let stufe = 0
  for (const d of dateien) {
    const [s, grund] = stufeDatei(d)
    if (s > 0) begruendung.push(`${d.pfad}: Stufe ${s} (${grund})`)
    stufe = Math.max(stufe, s)
  }
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
    console.log(JSON.stringify(bestimmeStufe(liesDiff(diffAusQuelle(args))), null, 2))
  } catch (e) {
    // Fail closed: ohne Diff gilt die höchste Stufe.
    console.log(JSON.stringify({ stufe: 2, begruendung: [String(e.message)], dateien: [] }, null, 2))
  }
}
