import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { auslieferbarePatchnotes, pruefePatchnotes, type Patchnote } from '../../shared/patchnotes.ts'

export const PATCHNOTES_YAML = 'data/patchnotes.yaml'

/** Liest die Handpflege und bricht bei einem Widerspruch ab; ohne Datei gibt es keine Patch-Notes. */
export function leseAuslieferbarePatchnotes(pfad = PATCHNOTES_YAML): Patchnote[] {
  if (!existsSync(pfad)) return []
  const roh = yaml.load(readFileSync(pfad, 'utf8'), { schema: yaml.JSON_SCHEMA })
  const fehler = pruefePatchnotes(roh)
  if (fehler.length) {
    for (const f of fehler) console.error('  ✖', f)
    console.error(`\n${fehler.length} Widerspruch/Widersprüche in ${pfad} — abgebrochen.`)
    process.exit(1)
  }
  return auslieferbarePatchnotes(roh as Record<string, unknown>[])
}
