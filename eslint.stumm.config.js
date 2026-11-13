import tsParser from '@typescript-eslint/parser'

/**
 * Stumme Fehlerpfade (Projektziel 1, 13.11.2026: 73 von 585 Prüfer-Auflagen): leerer catch-Block, oder ein catch,
 * dessen einzige Anweisung ein Leerwert-return ist. Neue Fälle sind rot; die Altfälle zählt tools/stumme-pfade.mjs
 * als Ratsche (tools/stumme-pfade-grenzen.json). Ein Kommentar im catch macht den Block für `no-empty` zulässig —
 * wer bewusst schweigt, schreibt das Warum hinein. Inline-`eslint-disable` gilt hier nicht (noInlineConfig).
 */
const NUR_RETURN = 'CatchClause > BlockStatement[body.length=1] > ReturnStatement'
const MELDUNG = 'catch liefert nur einen Leerwert: loggen, werfen oder ein Ergebnis mit Fehlerfeld zurückgeben (docs/wissen/betrieb.md, „Stumme Fehlerpfade“)'
// Promise-Form: `.catch(() => null | [] | {} | undefined | void 0)` und `.catch(() => {})`; hier hilft kein Kommentar, geloggt wird
const PROMISE_CATCH = "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression"
const MELDUNG_PROMISE = '.catch schluckt den Fehler (Leerwert/leerer Block): loggen, werfen oder ein Ergebnis mit Fehlerfeld liefern (docs/wissen/betrieb.md, „Stumme Fehlerpfade“)'

const regeln = {
  'no-empty': 'error',
  'no-restricted-syntax': [
    'error',
    { selector: `${NUR_RETURN}[argument=null]`, message: MELDUNG },
    { selector: `${NUR_RETURN} > Identifier[name='undefined']`, message: MELDUNG },
    { selector: `${NUR_RETURN} > Literal[raw='null']`, message: MELDUNG },
    { selector: `${NUR_RETURN} > ArrayExpression[elements.length=0]`, message: MELDUNG },
    { selector: `${NUR_RETURN} > ObjectExpression[properties.length=0]`, message: MELDUNG },
    { selector: `${PROMISE_CATCH}[body.type='Literal'][body.raw='null']`, message: MELDUNG_PROMISE },
    { selector: `${PROMISE_CATCH}[body.type='Identifier'][body.name='undefined']`, message: MELDUNG_PROMISE },
    { selector: `${PROMISE_CATCH}[body.type='ArrayExpression'][body.elements.length=0]`, message: MELDUNG_PROMISE },
    { selector: `${PROMISE_CATCH}[body.type='ObjectExpression'][body.properties.length=0]`, message: MELDUNG_PROMISE },
    { selector: `${PROMISE_CATCH}[body.type='UnaryExpression'][body.operator='void']`, message: MELDUNG_PROMISE },
    { selector: `${PROMISE_CATCH} > BlockStatement[body.length=0]`, message: MELDUNG_PROMISE },
  ],
}
const optionen = { noInlineConfig: true, reportUnusedDisableDirectives: 'off' }

export default [
  {
    files: ['{pipeline,tools,worker,shared}/**/*.{ts,tsx,mts,cts}'],
    linterOptions: optionen,
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
    rules: regeln,
  },
  {
    files: ['{pipeline,tools,worker,shared}/**/*.{mjs,cjs,js}'],
    linterOptions: optionen,
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: regeln,
  },
]
