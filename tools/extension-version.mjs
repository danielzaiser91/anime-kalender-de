/**
 * Versionszähler der Erweiterung (25.10.2026): PRs heben `extension/manifest.json` nicht mehr an (parallele PRs kollidierten
 * an dieser einen Zeile); nach dem Merge zählt `.github/workflows/extension-version.yml` die letzte Stelle hoch.
 *
 *   node tools/extension-version.mjs [--von <sha>] [--bis <sha>] [--rueckfall <sha>] [--manifest extension/manifest.json]
 *
 * Die Spanne läuft vom jüngsten Zähler-Commit (ZAEHLER_BETREFF) bis `--bis` (Standard HEAD); gibt es noch keinen, gilt
 * `--rueckfall`. Zählt einmal je Spanne, wenn sie ausgelieferten Erweiterungs-Code ändert und die Version nicht schon
 * von Hand angehoben wurde. Weil nicht der einzelne Push zählt, sondern alles seit dem letzten Zähler, geht nichts
 * verloren, wenn GitHub einen wartenden Lauf durch einen neueren ersetzt. Schreibt nur die Zeile `"version"`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Betreff des Zähler-Commits; der Workflow committet genau so, die Suche nach der Spanne liest ihn. */
export const ZAEHLER_BETREFF = 'chore(extension): Version gezählt'
const VERSION_ZEILE = /^(\s*"version"\s*:\s*")(\d+)\.(\d+)\.(\d+)(")/m

/** Zählt nur, was Daniels geladene Erweiterung verändert: keine Tests, Fixtures, Markdown. */
export function zaehltAlsAuslieferung(pfad) {
  if (!pfad.startsWith('extension/')) return false
  return !/\.(test\.cjs|test\.js|test\.mjs|fixture\.json|md)$/.test(pfad)
}

/** Version aus dem Manifest-Text oder null. */
export function versionVon(text) {
  const m = VERSION_ZEILE.exec(text ?? '')
  return m ? `${m[2]}.${m[3]}.${m[4]}` : null
}

/** Rot-Text, wenn ein PR die Version selbst anhebt (Zähler gehört dem Workflow); sonst null. */
export function anhebungRot(vorherText, nachherText) {
  const vorher = versionVon(vorherText)
  const nachher = versionVon(nachherText)
  if (vorher === null || nachher === null || vorher === nachher) return null
  return `extension/manifest.json: Version ${vorher} -> ${nachher} im PR angehoben; das zählt nach dem Merge der Workflow (tools/extension-version.mjs). Zeile zurücksetzen.`
}

/**
 * Entscheidet über die Anhebung: `{ text, grund }` mit neuem Manifest-Text oder `text: null` und Grund.
 * `vorherText`/`bisText` sind die Stände am Anfang und Ende der Push-Spanne (Entscheidung); `aktuellText` ist die Arbeitskopie,
 * die schon weitere Zähler-Commits enthalten kann und die Zahl trägt, auf der gezählt wird.
 */
export function naechsteVersion({ dateien, vorherText, bisText, aktuellText }) {
  const vorher = versionVon(vorherText)
  const bis = versionVon(bisText)
  const aktuell = versionVon(aktuellText)
  if (bis === null || aktuell === null) throw new Error('Manifest ohne lesbare Version (a.b.c)')
  if (vorher !== null && vorher !== bis) return { text: null, grund: `Version schon angehoben (${vorher} -> ${bis})` }
  if (!dateien.some(zaehltAlsAuslieferung)) return { text: null, grund: 'kein ausgelieferter Erweiterungs-Code geändert' }
  const [a, b, c] = aktuell.split('.').map(Number)
  const neu = `${a}.${b}.${c + 1}`
  return { text: aktuellText.replace(VERSION_ZEILE, (_, vor, __, ___, ____, nach) => `${vor}${neu}${nach}`), grund: `${aktuell} -> ${neu}` }
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 })

/** Manifest-Text an einem Stand; null, wenn es dort fehlt. */
function manifestAn(sha, pfad) {
  try {
    return git('show', `${sha}:${pfad}`)
  } catch {
    return null
  }
}

function argWert(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/**
 * Jüngster Zähler-Commit auf `bis`: Betreff wie ZAEHLER_BETREFF und ausschließlich das Manifest geändert
 * (ein PR gleichen Titels mit Code zählt nicht). Null, wenn es keinen gibt.
 */
function letzterZaehler(bis, pfad) {
  const kandidaten = git('log', '-20', '--format=%H%x09%s', '--fixed-strings', `--grep=${ZAEHLER_BETREFF}`, bis)
  for (const zeile of kandidaten.split('\n').filter(Boolean)) {
    const [sha, betreff] = zeile.split('\t')
    const dateien = git('diff-tree', '--no-commit-id', '--name-only', '--no-renames', '-r', sha).split('\n').filter(Boolean)
    if (betreff === ZAEHLER_BETREFF && dateien.length === 1 && dateien[0] === pfad) return sha
  }
  return null
}

function main() {
  const bis = argWert('--bis') ?? 'HEAD'
  const pfad = argWert('--manifest') ?? 'extension/manifest.json'
  const von = argWert('--von') ?? letzterZaehler(bis, pfad) ?? argWert('--rueckfall')
  if (!von) throw new Error('--von fehlt, kein Zähler-Commit gefunden und kein --rueckfall')
  const dateien = git('diff', '--name-only', '--no-renames', `${von}..${bis}`).split('\n').filter(Boolean)
  const urteil = naechsteVersion({ dateien, vorherText: manifestAn(von, pfad), bisText: manifestAn(bis, pfad), aktuellText: readFileSync(pfad, 'utf8') })
  if (urteil.text !== null) writeFileSync(pfad, urteil.text)
  console.log(`extension-version: ${urteil.text === null ? 'unverändert' : 'angehoben'} (${urteil.grund})`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
