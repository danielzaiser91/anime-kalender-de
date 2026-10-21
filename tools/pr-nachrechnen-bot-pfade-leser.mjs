/**
 * Sucht Leser der Bot-Dateien ohne Leser (`pr-nachrechnen-bot-pfade.mjs`) im Code des Datenbaus der PR-Kette: Einstiege sind `pipeline/build.ts`
 * (data:build), `pipeline/validate.ts` (data:validate) und `pipeline/check-ja-hat-weg-bestand.ts`, dazu deren Import-Hülle (relative Importe mit
 * Literal, `pipeline/lib/` eingeschlossen) sowie `shared/` und `web/src/` ganz, dazu die Prüfungen der Kette (`kettenDateien`: Skripte aus
 * `check-logic-liste.txt`, `tools/*.test.*` außer dem eigenen Test, `pr-pruefung.yml`). Kommentarzeilen zählen nicht.
 * Grenze: eine Datei, deren Name erst zur Laufzeit zusammengesetzt wird, fällt nicht auf. Prüfungen und Tests nennen Bot-Dateien oft nur als
 * Wegwerf-Wurzel-Fall; solche Treffer stehen mit Grund in der Liste `BEKANNT` des Tests (Handdurchsicht vom 21.10.2026).
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

/** Prüfungen der Kette: Skripte der Logik-Liste, `tools/*.test.*` (nicht der eigene Test) und die Kette selbst (nur vorhandene Dateien). */
export function kettenDateien(wurzel) {
  const liste = path.join(wurzel, 'tools/check-logic-liste.txt')
  const ausListe = fs.existsSync(liste) ? fs.readFileSync(liste, 'utf8').split('\n').map((z) => z.trim()).filter((z) => z && !z.startsWith('#')) : []
  const tests = alleDateien(wurzel, 'tools').filter((d) => /^tools\/(?!pr-nachrechnen-bot-pfade)[^/]*\.test\.(ts|mjs)$/.test(d))
  const alle = [...new Set([...ausListe, ...tests, '.github/workflows/pr-pruefung.yml'])]
  return alle.filter((d) => fs.existsSync(path.join(wurzel, d)) && fs.statSync(path.join(wurzel, d)).isFile()).sort()
}

/** Treffer `Datei|Eintrag` für jeden Eintrag, dessen Dateiname in einer Bau- oder Ketten-Datei außerhalb von Kommentarzeilen steht und nicht in `bekannt`. */
export function leserImBau(wurzel, eintraege, bekannt) {
  const treffer = []
  for (const datei of new Set([...bauDateien(wurzel), ...kettenDateien(wurzel)])) {
    const code = fs.readFileSync(path.join(wurzel, datei), 'utf8').split('\n').filter((z) => !/^\s*(\/\/|\*|\/\*|#)/.test(z)).join('\n')
    for (const eintrag of eintraege) {
      if (code.includes(eintrag.split('/').pop()) && !bekannt.has(`${datei}|${eintrag}`)) treffer.push(`${datei}|${eintrag}`)
    }
  }
  return treffer
}
