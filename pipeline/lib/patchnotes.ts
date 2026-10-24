import { existsSync, readdirSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { todayIso } from '../../shared/time.ts'
import { auslieferbarePatchnotes, istTag, pruefeHighlightsJeTag, pruefePatchnotes, type Patchnote } from '../../shared/patchnotes.ts'
import { tageAusGit } from './patchnotes-datum.ts'

/** Ein Eintrag je Datei (`<name>.yaml`), damit parallele PRs keine gemeinsame Datei ändern. */
export const PATCHNOTES_ORDNER = 'data/patchnotes'
export const STEMPEL_DATEI = '_ueberarbeitet-bis.txt'

type Roh = Record<string, unknown>

export interface PatchnotesDatei {
  /** Dateiname ohne Endung; Schlüssel fürs Datum. */
  name: string
  eintrag: Roh
}

/** Liest alle Einträge des Ordners, nach Dateiname sortiert (das ist die Reihenfolge innerhalb von Tag und Art). Ohne Ordner gibt es keine. */
export function lesePatchnotesDateien(ordner = PATCHNOTES_ORDNER): PatchnotesDatei[] {
  if (!existsSync(ordner)) return []
  return readdirSync(ordner)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => ({ name: f.slice(0, -'.yaml'.length), eintrag: yaml.load(readFileSync(`${ordner}/${f}`, 'utf8'), { schema: yaml.JSON_SCHEMA }) as Roh }))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
}

/** Setzt bei Einträgen ohne `datum` den Tag des Commits, der ihre Datei angelegt hat. */
export function mitDatum(dateien: PatchnotesDatei[], tage: (namen: string[]) => Map<string, string>): Roh[] {
  const tagVon = tage(dateien.filter((d) => d.eintrag.datum === undefined).map((d) => d.name))
  return dateien.map((d) => (d.eintrag.datum === undefined ? { ...d.eintrag, datum: tagVon.get(d.name) } : d.eintrag))
}

/** Stempel „überarbeitet bis“: letzter Tag, dessen Texte der Überarbeitungs-PR umgeschrieben hat. Fehlt die Datei, gibt es keine Entwürfe; ein ungültiger Inhalt bricht ab.
 * Umgehungen, selten: ein Nachtrags-`datum` ≤ Stempel gilt als überarbeitet; scheitert git (`allesHeute`), tragen alle Einträge den heutigen Tag und damit den Stift. */
export function leseUeberarbeitetBis(ordner = PATCHNOTES_ORDNER): string | undefined {
  const datei = `${ordner}/${STEMPEL_DATEI}`
  if (!existsSync(datei)) return undefined
  const tag = readFileSync(datei, 'utf8').trim()
  if (istTag(tag)) return tag
  console.error(`  ✖ ${datei}: „${tag}“ ist kein Tag (JJJJ-MM-TT)`)
  process.exit(1)
}

const gelesen = new Map<string, Patchnote[]>()

/** Liest den Ordner und bricht bei einem Widerspruch ab. Je Prozess und Ordner einmal. */
export function leseAuslieferbarePatchnotes(ordner = PATCHNOTES_ORDNER): Patchnote[] {
  const bekannt = gelesen.get(ordner)
  if (bekannt) return bekannt
  const dateien = lesePatchnotesDateien(ordner)
  const fehler = pruefePatchnotes(dateien.map((d) => d.eintrag), dateien.map((d) => d.name))
  if (fehler.length) {
    for (const f of fehler) console.error('  ✖', f)
    console.error(`\n${fehler.length} Widerspruch/Widersprüche in ${ordner} — abgebrochen.`)
    process.exit(1)
  }
  const mitTag = mitDatum(dateien, (namen) => tageAusGit(ordner, namen, todayIso()))
  const zuViele = pruefeHighlightsJeTag(mitTag)
  if (zuViele.length) {
    for (const f of zuViele) console.error('  ✖', f)
    console.error(`\n${zuViele.length} Widerspruch/Widersprüche in ${ordner} — abgebrochen.`)
    process.exit(1)
  }
  const liste = auslieferbarePatchnotes(mitTag, leseUeberarbeitetBis(ordner))
  gelesen.set(ordner, liste)
  return liste
}
