/**
 * TDZ-Wächter für `extension/amazon.js`: nichts, was Hörer, Takt oder Rückruf vor dem
 * Warten auf eine Kennung (`id = await new Promise`) erreichen können, darf ein
 * `const`/`let`/`class` lesen oder schreiben, das erst NACH diesem `await` deklariert wird.
 * Auf der Startseite (keine Kennung) steht das Skript bis zu 5 min am `await`; in der Zeit
 * laufen die früh angemeldeten Hörer (Daniel, 18.11.2026: `primeLaufName` vor Initialisierung).
 *
 * Aufruf aus dem Repo-Wurzelverzeichnis: node tools/amazon-tdz-pruefen.cjs
 * Exit 0 = keine Fundstelle, Exit 1 = Fundstellen (je Zeile: Name, Deklaration, Nutzung, Weg).
 *
 * Früh = jede Funktion, die vor dem Ende des `await`-Ausdrucks beginnt (Hörer, Rückrufe,
 * Executor), plus jede Funktion, die von einer frühen aufgerufen wird (Aufrufgraph über
 * aufgelöste Bezeichner, auch hochgezogene `function`-Deklarationen nach dem `await`).
 */
const { readFileSync } = require('node:fs')
const espree = require('espree')
const eslintScope = require('eslint-scope')

const FUNKTION = /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/

function elternSetzen(wurzel) {
  const stapel = [wurzel]
  while (stapel.length) {
    const n = stapel.pop()
    for (const k of Object.keys(n)) {
      if (k === 'parent' || k === 'loc' || k === 'range') continue
      const v = n[k]
      for (const kind of Array.isArray(v) ? v : [v]) {
        if (kind && typeof kind.type === 'string') {
          kind.parent = n
          stapel.push(kind)
        }
      }
    }
  }
}

function umgebendeFunktion(knoten) {
  for (let n = knoten.parent; n; n = n.parent) if (FUNKTION.test(n.type)) return n
  return null
}

/** Das erste `await` des Haupt-Skriptrumpfs, das nicht in einer verschachtelten Funktion steht. */
function ersterAwait(rumpf, wurzelFunktion) {
  let gefunden = null
  const stapel = [rumpf]
  while (stapel.length) {
    const n = stapel.pop()
    if (n.type === 'AwaitExpression' && umgebendeFunktion(n) === wurzelFunktion) {
      if (!gefunden || n.range[0] < gefunden.range[0]) gefunden = n
    }
    for (const k of Object.keys(n)) {
      if (k === 'parent' || k === 'loc' || k === 'range') continue
      const v = n[k]
      for (const kind of Array.isArray(v) ? v : [v]) if (kind && typeof kind.type === 'string') stapel.push(kind)
    }
  }
  return gefunden
}

/** Funktion, die die Bindung `variable` als Funktion definiert (Deklaration oder `const x = () =>`). */
function definierteFunktion(variable) {
  for (const d of variable.defs) {
    if (d.node.type === 'FunctionDeclaration') return d.node
    if (d.node.type === 'VariableDeclarator' && d.node.init && FUNKTION.test(d.node.init.type)) return d.node.init
  }
  return null
}

/** Liefert die Fundstellen als Zeilen; `quelltext` ist das ganze Skript. */
function befunde(quelltext) {
  const ast = espree.parse(quelltext, { ecmaVersion: 'latest', loc: true, range: true })
  elternSetzen(ast)
  const manager = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script', ignoreEval: true })
  const haupt = manager.scopes.find((s) => s.block.type === 'ArrowFunctionExpression' && s.block.async && s.block.loc.start.line === firstAsyncLine(ast))
  if (!haupt) throw new Error('Haupt-Funktion des Skripts nicht gefunden')
  const warte = ersterAwait(haupt.block.body, haupt.block)
  if (!warte) throw new Error('kein await im Rumpf des Skripts')
  const grenze = warte.range[1]
  const spaet = new Set(
    haupt.variables.filter((v) => v.defs.length && v.defs.every((d) => d.type === 'Variable' ? d.parent.kind !== 'var' : d.type === 'ClassName') && v.defs[0].node.range[0] > grenze).map((v) => v),
  )
  const alleFunktionen = []
  const kanten = new Map()
  for (const s of manager.scopes) {
    for (const ref of s.references) {
      const v = ref.resolved
      const von = umgebendeFunktion(ref.identifier)
      const ziel = v && definierteFunktion(v)
      if (von && ziel && von !== haupt.block) {
        if (!kanten.has(von)) kanten.set(von, new Set())
        kanten.get(von).add(ziel)
      }
    }
    if (FUNKTION.test(s.block.type)) alleFunktionen.push(s.block)
  }
  const weg = new Map()
  const stapel = []
  for (const f of alleFunktionen) if (f !== haupt.block && f.range[0] < grenze) { weg.set(f, 'früh angemeldet' + (f.id ? ' > ' + f.id.name : '')); stapel.push(f) }
  while (stapel.length) {
    const f = stapel.pop()
    for (const g of kanten.get(f) ?? []) if (!weg.has(g)) { weg.set(g, `${weg.get(f)} > ${g.id?.name ?? 'Funktion@' + g.loc.start.line}`); stapel.push(g) }
  }
  const zeilen = []
  for (const s of manager.scopes) {
    for (const ref of s.references) {
      if (!ref.resolved || !spaet.has(ref.resolved) || ref.init) continue
      const f = umgebendeFunktion(ref.identifier)
      if (!f || f === haupt.block || !weg.has(f)) continue
      const name = ref.identifier.name
      zeilen.push(`${name} (Zeile ${ref.resolved.defs[0].node.loc.start.line}) benutzt in Zeile ${ref.identifier.loc.start.line} [${weg.get(f)}]`)
    }
  }
  return [...new Set(zeilen)]
}

function firstAsyncLine(ast) {
  for (const s of ast.body) {
    const e = s.expression
    if (e && e.type === 'CallExpression' && e.callee.type === 'ArrowFunctionExpression' && e.callee.async) return e.callee.loc.start.line
  }
  return -1
}

if (require.main === module) {
  const zeilen = befunde(readFileSync('extension/amazon.js', 'utf8'))
  if (zeilen.length) {
    console.log(zeilen.join('\n'))
    console.log(`✖ amazon-tdz: ${zeilen.length} Nutzung(en) einer nach dem Warte-await deklarierten Bindung aus früh erreichbarem Code`)
    process.exit(1)
  }
  console.log('✔ amazon-tdz: 0 Nutzungen später Bindungen aus früh erreichbarem Code')
}

module.exports = { befunde }
