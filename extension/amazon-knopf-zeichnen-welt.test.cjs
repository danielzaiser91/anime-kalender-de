/**
 * Die Welt von `amazon-knopf-zeichnen.js` ist vollständig — und enthält nichts Überflüssiges.
 *
 * `zeichnenRoh` läuft in `with (AK_ZEICHNEN_WELT)`. Ein Name, der in der Welt fehlt, löst sich dort still
 * gegen `globalThis` auf (und liefert `undefined` statt eines Fehlers); eine Zuweisung an einen Namen ohne
 * Setter geht im Sloppy-Modus ohne Meldung verloren. Diese Prüfung vergleicht deshalb über den Syntaxbaum
 * (ESLint `no-undef` ohne eigene Globals plus zwei kleine Regeln) die freien und die zugewiesenen Namen der
 * ausgelagerten Datei mit den Einträgen, die `amazon.js` in `Object.defineProperties(AK_ZEICHNEN_WELT, …)` setzt.
 *
 * Erlaubt ohne Welt sind nur echte Browser-Namen — die Liste steht hier fest, nicht aus dem Prüfling.
 */
const fs = require('node:fs')
const path = require('node:path')
const { Linter } = require('eslint')

const BROWSER = ['document', 'location']

/** Meldet jeden Eintrag des Objektliterals, das in die Welt geschrieben wird, als `welt:<art>:<name>`. */
const weltEintraege = {
  meta: { type: 'problem', schema: [] },
  create(kontext) {
    return {
      CallExpression(knoten) {
        const f = knoten.callee
        if (f.type !== 'MemberExpression' || f.property.name !== 'defineProperties') return
        if (!kontext.sourceCode.getText(knoten.arguments[0]).endsWith('AK_ZEICHNEN_WELT')) return
        for (const p of knoten.arguments[1].arguments[0].properties.filter((e) => e.key.name !== '__proto__')) {
          kontext.report({ node: p, message: `welt:${p.kind}:${p.key.name}` })
        }
      },
    }
  },
}

/** Meldet jeden Namen, dem zugewiesen wird (`=`, `+=`, `++`), als `zu:<name>`. */
const zuweisungen = {
  meta: { type: 'problem', schema: [] },
  create(kontext) {
    const melde = (knoten, ziel) => {
      if (ziel.type === 'Identifier') kontext.report({ node: knoten, message: 'zu:' + ziel.name })
    }
    return {
      AssignmentExpression: (k) => melde(k, k.left),
      UpdateExpression: (k) => melde(k, k.argument),
    }
  },
}

function lint(text, regeln) {
  const linter = new Linter()
  return linter.verify(text, [
    {
      files: ['**/*.js'],
      plugins: { lokal: { rules: { welt: weltEintraege, zu: zuweisungen } } },
      languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: {} },
      rules: regeln,
    },
  ], 'datei.js')
}

/** Liefert die Probleme zwischen den Namen der Zeichnen-Datei und der Welt aus amazon.js. */
function weltProbleme(zeichnenText, amazonText) {
  const welt = lint(amazonText, { 'lokal/welt': 'error' }).map((m) => m.message.split(':')).filter((t) => t[0] === 'welt')
  const hat = new Set(welt.map((t) => t[2]))
  const setter = new Set(welt.filter((t) => t[1] === 'set').map((t) => t[2]))
  const meldungen = lint(zeichnenText, { 'no-undef': 'error', 'lokal/zu': 'error' })
  const frei = new Set(meldungen.filter((m) => m.ruleId === 'no-undef').map((m) => /^'(.+)' is not defined/.exec(m.message)[1]))
  const zugewiesen = new Set(meldungen.filter((m) => m.ruleId === 'lokal/zu').map((m) => m.message.slice(3)))
  frei.delete('AK_ZEICHNEN_WELT')
  frei.delete('AK_KNOPF_ZEICHNEN')
  const probleme = []
  if (!hat.size) probleme.push('keine Welt in amazon.js gefunden')
  for (const n of frei) if (!hat.has(n) && !BROWSER.includes(n)) probleme.push(`fehlt in der Welt: ${n}`)
  for (const n of hat) if (!frei.has(n)) probleme.push(`Welt-Eintrag ohne Nutzer: ${n}`)
  for (const n of BROWSER) if (!frei.has(n)) probleme.push(`Browser-Name ohne Nutzer: ${n}`)
  for (const n of zugewiesen) if (hat.has(n) && !setter.has(n)) probleme.push(`Zuweisung ohne Setter: ${n}`)
  return probleme
}

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const zeichnen = fs.readFileSync(path.resolve(__dirname, 'amazon-knopf-zeichnen.js'), 'utf8')
const amazon = fs.readFileSync(path.resolve(__dirname, 'amazon.js'), 'utf8')

const echt = weltProbleme(zeichnen, amazon)
pruefe('freie und zugewiesene Namen von zeichnenRoh passen zur Welt, kein Überschuss', echt.length === 0, echt)

const GET_KNOPF = '    get knopf() { return knopf },\n'
const SET_WEITER = '    set weiterText(wert) { weiterText = wert },\n'
const ohneKnopf = amazon.replace(GET_KNOPF, '')
pruefe('Fall: Name aus der Welt entfernt -> rot', ohneKnopf !== amazon && weltProbleme(zeichnen, ohneKnopf).includes('fehlt in der Welt: knopf'))

const mitNeuem = zeichnen.replace('if (sendetGerade) return', 'if (sendetGerade || nirgendwoDefiniert) return')
pruefe('Fall: neuer freier Name in der Zeichnen-Datei -> rot', mitNeuem !== zeichnen && weltProbleme(mitNeuem, amazon).includes('fehlt in der Welt: nirgendwoDefiniert'))

const mitUeberschuss = amazon.replace(GET_KNOPF, GET_KNOPF + '    get ueberfluessig() { return 1 },\n')
pruefe('Fall: Welt-Eintrag ohne Nutzer -> rot', mitUeberschuss !== amazon && weltProbleme(zeichnen, mitUeberschuss).includes('Welt-Eintrag ohne Nutzer: ueberfluessig'))

const ohneSetter = amazon.replace(SET_WEITER, '')
pruefe('Fall: Setter fehlt (Zuweisung ginge still verloren) -> rot', ohneSetter !== amazon && weltProbleme(zeichnen, ohneSetter).includes('Zuweisung ohne Setter: weiterText'))

console.log(`\nAmazon-Welt: ${fehler.length ? fehler.length + ' Fehler' : 'ok'} (${echt.length} Probleme am echten Stand)`)
if (fehler.length) process.exit(1)
