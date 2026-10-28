/**
 * Importgraph der Werkzeug-Skripte in `tools/`: welche Nachbardateien ein Einstiegsskript transitiv braucht.
 * Gefolgt wird relativen `import … from './x'`, `import('./x')`, `require('./x')` in JS-Dateien sowie
 * `tools/<name>.(mjs|cjs|js|sh)`-Nennungen und `source "$(dirname "${BASH_SOURCE[0]}")/<name>.sh"` in Shell-Skripten (ohne Kommentare). Nur Dateien, die es gibt.
 * Zweck: Kopierlisten der Wegwerf-Repo-Tests (`commit-data-test.sh`, `wache-verdrahtung.test.mjs`) prüfen.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'

const JS_IMPORT = /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g
const SH_NENNUNG = /\btools\/([A-Za-z0-9_.-]+\.(?:mjs|cjs|js|sh))\b|BASH_SOURCE\[0\]\}"\)\/([A-Za-z0-9_.-]+\.sh)/g

const ohneJsKommentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w'"`\\])\/\/.*$/gm, '$1')
const ohneShKommentar = (t) => t.replace(/^\s*#.*$/gm, '')

/** Direkte Nachbarn (Dateinamen in `tools/`) einer Datei aus `tools/`, aus deren Text. */
export function direkteNachbarn(name, text) {
  const treffer = []
  if (name.endsWith('.sh')) {
    for (const m of ohneShKommentar(text).matchAll(SH_NENNUNG)) treffer.push(m[1] ?? m[2])
  } else {
    for (const m of ohneJsKommentar(text).matchAll(JS_IMPORT)) treffer.push(posix.normalize(m[1]).replace(/^\.\//, ''))
  }
  return treffer.filter((t) => !t.includes('/'))
}

/** Alle von den Einstiegen (Dateinamen in `tools/`) transitiv erreichten Dateien, Einstiege eingeschlossen, sortiert. */
export function abschluss(einstiege, wurzel) {
  const gesehen = new Set()
  const offen = [...einstiege]
  while (offen.length) {
    const name = offen.pop()
    if (gesehen.has(name)) continue
    const pfad = join(wurzel, 'tools', name)
    if (!existsSync(pfad)) continue
    gesehen.add(name)
    offen.push(...direkteNachbarn(name, readFileSync(pfad, 'utf8')))
  }
  return [...gesehen].sort()
}
