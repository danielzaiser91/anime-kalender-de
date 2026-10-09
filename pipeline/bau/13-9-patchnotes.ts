import { log, writeJson } from '../lib/util.ts'
import { leseAuslieferbarePatchnotes } from '../lib/patchnotes.ts'
import { OUT } from './grundlagen.ts'

/** `patchnotes.json`: die Einträge des Dialogs „Neu auf der Webseite“, aus der Handpflege `data/patchnotes.yaml`; die Seite lädt sie erst beim Klick. */
export function schreibePatchnotes(): void {
  const liste = leseAuslieferbarePatchnotes()
  writeJson(`${OUT}/patchnotes.json`, liste)
  log(`patchnotes.json: ${liste.length} Einträge, jüngster Tag ${liste[0]?.datum ?? '–'}`)
}
