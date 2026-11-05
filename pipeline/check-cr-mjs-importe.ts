// Verdrahtung der drei CR-Abrufskripte: jeder Name, den sie aus einer lokalen Lib importieren, muss dort exportiert sein.
// Die Skripte selbst laufen nicht (Abruf gesperrt); der Syntaxbaum liefert die Importe, das echte Modul die Exporte.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

export function lokaleImporte(quelle: string): { modul: string; namen: string[] }[] {
  const baum = ts.createSourceFile('x.mjs', quelle, ts.ScriptTarget.ES2022, true)
  const ergebnis: { modul: string; namen: string[] }[] = []
  for (const s of baum.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || !s.moduleSpecifier.text.startsWith('./')) continue
    const b = s.importClause?.namedBindings
    const namen = b && ts.isNamedImports(b) ? b.elements.map((e) => (e.propertyName ?? e.name).text) : []
    ergebnis.push({ modul: s.moduleSpecifier.text, namen })
  }
  return ergebnis
}

export async function fehlendeExporte(quelle: string, laden: (modul: string) => Promise<Record<string, unknown>>): Promise<string[]> {
  const fehlt: string[] = []
  for (const { modul, namen } of lokaleImporte(quelle)) {
    const exporte = await laden(modul)
    for (const n of namen) if (typeof exporte[n] !== 'function') fehlt.push(`${modul}: ${n}`)
  }
  return fehlt
}

const laden = (modul: string) => import(new URL(modul, import.meta.url).href)

// Selbsttest mit Attrappe: ein nicht exportierter Name wird gefunden, ein vorhandener nicht.
const probe = "import { a, b as c } from './m.ts'\nimport x from './n.ts'\nimport { fs } from 'node:fs'\n"
assert.deepStrictEqual(lokaleImporte(probe), [{ modul: './m.ts', namen: ['a', 'b'] }, { modul: './n.ts', namen: [] }])
assert.deepStrictEqual(await fehlendeExporte(probe, async () => ({ a: () => 1 })), ['./m.ts: b'])

const SKRIPTE = ['fetch-cr-einzelwerke.mjs', 'fetch-cr-filmbloecke.mjs', 'fetch-cr-katalog.mjs']
let geprueft = 0
for (const skript of SKRIPTE) {
  const quelle = readFileSync(new URL(`./${skript}`, import.meta.url), 'utf8')
  const importe = lokaleImporte(quelle)
  assert.ok(importe.some((i) => i.modul.includes('-lauf.ts')), `${skript}: importiert keine -lauf-Lib`)
  assert.deepStrictEqual(await fehlendeExporte(quelle, laden), [], `${skript}: Import ohne Export`)
  geprueft += importe.reduce((n, i) => n + i.namen.length, 0)
}
console.log(`✔ check-cr-mjs-importe: ${SKRIPTE.length} Skripte, ${geprueft} importierte Namen in den Libs vorhanden`)
