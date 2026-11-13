import tsParser from '@typescript-eslint/parser'

/**
 * Stumme Fehlerpfade (Projektziel 1, 13.11.2026: 73 von 585 Prüfer-Auflagen): leerer catch-Block, oder ein catch,
 * dessen einzige Anweisung ein Leerwert-return ist. Neue Fälle sind rot; die Altfälle zählt tools/stumme-pfade.mjs
 * als Ratsche (tools/stumme-pfade-grenzen.json). Ein Kommentar im catch macht den Block für `no-empty` zulässig —
 * wer bewusst schweigt, schreibt das Warum hinein. Inline-`eslint-disable` gilt hier nicht (noInlineConfig).
 */
const NUR_RETURN = 'CatchClause > BlockStatement[body.length=1] > ReturnStatement'
const MELDUNG = 'catch liefert nur einen Leerwert: loggen, werfen oder ein Ergebnis mit Fehlerfeld zurückgeben (docs/wissen/betrieb.md, „Stumme Fehlerpfade“)'

const regeln = {
  'no-empty': 'error',
  'no-restricted-syntax': [
    'error',
    { selector: `${NUR_RETURN}[argument=null]`, message: MELDUNG },
    { selector: `${NUR_RETURN} > Identifier[name='undefined']`, message: MELDUNG },
    { selector: `${NUR_RETURN} > Literal[raw='null']`, message: MELDUNG },
    { selector: `${NUR_RETURN} > ArrayExpression[elements.length=0]`, message: MELDUNG },
    { selector: `${NUR_RETURN} > ObjectExpression[properties.length=0]`, message: MELDUNG },
  ],
}
const optionen = { noInlineConfig: true, reportUnusedDisableDirectives: 'off' }

export default [
  {
    files: ['{pipeline,tools,worker,shared}/**/*.ts'],
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
