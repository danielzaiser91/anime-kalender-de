import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { todayIso } from '../../shared/time.ts'
import { auslieferbarePatchnotes, pruefePatchnotes, type Patchnote } from '../../shared/patchnotes.ts'
import { tageAusGit } from './patchnotes-datum.ts'

export const PATCHNOTES_YAML = 'data/patchnotes.yaml'

type Roh = Record<string, unknown>

/** Setzt bei Einträgen ohne `datum` den Tag des Commits, der sie eingeführt hat. */
export function mitDatum(roh: Roh[], tage: (texte: string[]) => Map<string, string>): Roh[] {
  const tagVon = tage(roh.filter((e) => e.datum === undefined).map((e) => e.text as string))
  return roh.map((e) => (e.datum === undefined ? { ...e, datum: tagVon.get(e.text as string) } : e))
}

const gelesen = new Map<string, Patchnote[]>()

/** Liest die Datei und bricht bei einem Widerspruch ab; ohne Datei gibt es keine Patch-Notes. Je Prozess und Datei einmal. */
export function leseAuslieferbarePatchnotes(pfad = PATCHNOTES_YAML): Patchnote[] {
  if (!existsSync(pfad)) return []
  const bekannt = gelesen.get(pfad)
  if (bekannt) return bekannt
  const roh = yaml.load(readFileSync(pfad, 'utf8'), { schema: yaml.JSON_SCHEMA })
  const fehler = pruefePatchnotes(roh)
  if (fehler.length) {
    for (const f of fehler) console.error('  ✖', f)
    console.error(`\n${fehler.length} Widerspruch/Widersprüche in ${pfad} — abgebrochen.`)
    process.exit(1)
  }
  const liste = auslieferbarePatchnotes(mitDatum(roh as Roh[], (texte) => tageAusGit(pfad, texte, todayIso())))
  gelesen.set(pfad, liste)
  return liste
}
