#!/usr/bin/env node
/**
 * Pre-commit-Prüfung für gestagte Patch-Notes-Dateien (`data/patchnotes/*.yaml`): gültiges YAML und das Schema aus
 * `shared/patchnotes.ts` (dieselbe Prüfung wie `pipeline/check-patchnotes.ts`). Anlass (12.10.2026): ein Doppelpunkt im
 * Untertitel brach das YAML und fiel erst in `check:vor-commit` auf.
 *
 * Läuft nur, wenn solche Dateien gestagt sind (sonst Exit 0 nach einem `git diff`, ohne Prüfcode zu laden). Gestagte Dateien
 * werden aus dem Index gelesen, die übrigen Einträge aus dem Arbeitsverzeichnis (für Dubletten und Highlight-Grenze).
 * Eingebunden über `bash tools/quellen-commit-wache.sh --einrichten`.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

const ORDNER = 'data/patchnotes'
const EINTRAG = /^data\/patchnotes\/[^/]+\.yaml$/
const name = (pfad) => pfad.slice(ORDNER.length + 1, -'.yaml'.length)

/** Pfade der gestagten, nicht gelöschten Einträge. */
export function gestagteEintraege(git = (...args) => execFileSync('git', args, { encoding: 'utf8' })) {
  return git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ORDNER)
    .split('\0')
    .filter((p) => EINTRAG.test(p))
}

/**
 * Meldungen zu den gestagten Inhalten (`{ name, text }`) zusammen mit den übrigen Einträgen; leer heißt in Ordnung.
 * Kaputtes YAML einer übrigen Datei ist nicht Sache dieses Commits und wird übersprungen.
 */
export async function pruefeGestagte(gestagt, uebrige) {
  const { pruefePatchnotes } = await import('../shared/patchnotes.ts')
  const { default: yaml } = await import('js-yaml')
  const lade = (text) => yaml.load(text, { schema: yaml.JSON_SCHEMA })
  const meldungen = []
  const eintraege = []
  for (const datei of uebrige) {
    try {
      eintraege.push({ name: datei.name, eintrag: lade(datei.text) })
    } catch {
      // gehört nicht zu diesem Commit
    }
  }
  for (const datei of gestagt) {
    try {
      eintraege.push({ name: datei.name, eintrag: lade(datei.text) })
    } catch (fehler) {
      const hinweis = /mapping/.test(fehler.message) ? ' (Text mit Doppelpunkt in Anführungszeichen setzen)' : ''
      meldungen.push(`${datei.name}: kein gültiges YAML — ${fehler.message.split('\n')[0]}${hinweis}`)
    }
  }
  eintraege.sort((a, b) => (a.name < b.name ? -1 : 1))
  meldungen.push(...pruefePatchnotes(eintraege.map((e) => e.eintrag), eintraege.map((e) => e.name)))
  return meldungen
}

async function main() {
  const pfade = gestagteEintraege()
  if (!pfade.length) return 0
  const gestagt = pfade.map((p) => ({ name: name(p), text: execFileSync('git', ['show', `:${p}`], { encoding: 'utf8' }) }))
  const namen = new Set(gestagt.map((d) => d.name))
  const uebrige = readdirSync(ORDNER)
    .filter((f) => f.endsWith('.yaml') && !namen.has(f.slice(0, -'.yaml'.length)))
    .map((f) => ({ name: f.slice(0, -'.yaml'.length), text: readFileSync(`${ORDNER}/${f}`, 'utf8') }))
  const meldungen = await pruefeGestagte(gestagt, uebrige)
  if (!meldungen.length) return 0
  console.error(`patchnotes-gestagt-pruefen: Commit angehalten (${meldungen.length} Meldung/en):`)
  for (const m of meldungen) console.error(`  ✖ ${m}`)
  return 1
}

if (import.meta.filename === process.argv[1]) process.exit(await main())
