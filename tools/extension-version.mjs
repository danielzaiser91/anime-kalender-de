/**
 * Versionszähler der Erweiterung (25.10.2026): PRs heben `extension/manifest.json` nicht mehr an (parallele PRs kollidierten
 * an dieser einen Zeile); nach dem Merge zählt `.github/workflows/extension-version.yml` die letzte Stelle hoch.
 *
 *   node tools/extension-version.mjs --von <sha> --bis <sha> [--manifest extension/manifest.json]
 *
 * Zählt genau einmal je Push, wenn dessen Spanne ausgelieferten Erweiterungs-Code ändert und die Version nicht schon
 * selbst (von Hand) angehoben wurde. Schreibt nur die Zeile `"version"`, sonst nichts.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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

function main() {
  const von = argWert('--von')
  const bis = argWert('--bis')
  const pfad = argWert('--manifest') ?? 'extension/manifest.json'
  if (!von || !bis) throw new Error('--von und --bis fehlen')
  const dateien = git('diff', '--name-only', '--no-renames', `${von}..${bis}`).split('\n').filter(Boolean)
  const urteil = naechsteVersion({ dateien, vorherText: manifestAn(von, pfad), bisText: manifestAn(bis, pfad), aktuellText: readFileSync(pfad, 'utf8') })
  if (urteil.text !== null) writeFileSync(pfad, urteil.text)
  console.log(`extension-version: ${urteil.text === null ? 'unverändert' : 'angehoben'} (${urteil.grund})`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
