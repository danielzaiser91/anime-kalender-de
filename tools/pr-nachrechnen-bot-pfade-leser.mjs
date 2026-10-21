/**
 * Sucht Leser der Bot-Dateien ohne Leser (`pr-nachrechnen-bot-pfade.mjs`) im Code des Datenbaus der PR-Kette: Einstiege sind `pipeline/build.ts`
 * (data:build), `pipeline/validate.ts` (data:validate) und `pipeline/check-ja-hat-weg-bestand.ts`, dazu deren Import-Hülle (relative Importe mit
 * Literal, `pipeline/lib/` eingeschlossen) sowie `shared/` und `web/src/` ganz. Kommentarzeilen zählen nicht.
 * Grenzen: Prüfungen und Tests der Kette (`check-logic-liste.txt`, `tools/*.test.mjs`) lesen meist Wegwerf-Wurzeln und sind nicht Teil der Hülle
 * (Handmessung vom 21.10.2026, Tabelle in der PR-Beschreibung); eine Datei, deren Name erst zur Laufzeit zusammengesetzt wird, fällt nicht auf.
 */
import fs from 'node:fs'
import path from 'node:path'

const ENDUNGEN = ['.ts', '.tsx', '.mjs', '.cjs', '.mts', '/index.ts']
const EINSTIEGE = ['pipeline/build.ts', 'pipeline/validate.ts', 'pipeline/check-ja-hat-weg-bestand.ts']

function alleDateien(wurzel, ordner) {
  const voll = path.join(wurzel, ordner)
  if (!fs.existsSync(voll)) return []
  return fs.readdirSync(voll, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx|mjs)$/.test(e.name))
    .map((e) => path.relative(wurzel, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
}

const istCode = (wurzel, datei) => /\.(ts|tsx|mjs|cjs|mts)$/.test(datei) && fs.existsSync(path.join(wurzel, datei)) && fs.statSync(path.join(wurzel, datei)).isFile()

/** Relative Importe mit Literal einer Datei, als Pfade relativ zur Wurzel. */
function importe(wurzel, datei) {
  const text = fs.readFileSync(path.join(wurzel, datei), 'utf8')
  const ziele = []
  for (const m of text.matchAll(/['"`](\.{1,2}\/[^'"`\n]+)['"`]/g)) {
    const basis = path.posix.normalize(path.posix.join(path.posix.dirname(datei), m[1]))
    ziele.push(...[basis, ...ENDUNGEN.map((ende) => basis + ende)].filter((k) => istCode(wurzel, k)))
  }
  return ziele
}

/** Code-Dateien der Bau-Hülle (relativ zur Wurzel, mit `/`). */
export function bauDateien(wurzel) {
  const offen = [...alleDateien(wurzel, 'shared'), ...alleDateien(wurzel, 'web/src'), ...EINSTIEGE]
  const gesehen = new Set(offen)
  while (offen.length > 0) {
    const datei = offen.pop()
    if (!istCode(wurzel, datei)) continue
    for (const ziel of importe(wurzel, datei).filter((z) => !gesehen.has(z))) {
      gesehen.add(ziel)
      offen.push(ziel)
    }
  }
  return [...gesehen].filter((d) => istCode(wurzel, d)).sort()
}

/** Treffer `Datei|Eintrag` für jeden Eintrag, dessen Dateiname in einer Bau-Datei außerhalb von Kommentarzeilen steht und nicht in `bekannt`. */
export function leserImBau(wurzel, eintraege, bekannt) {
  const treffer = []
  for (const datei of bauDateien(wurzel)) {
    const code = fs.readFileSync(path.join(wurzel, datei), 'utf8').split('\n').filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n')
    for (const eintrag of eintraege) {
      if (code.includes(eintrag.split('/').pop()) && !bekannt.has(`${datei}|${eintrag}`)) treffer.push(`${datei}|${eintrag}`)
    }
  }
  return treffer
}
