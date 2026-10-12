/** Tests für tools/umfang-ketten.mjs: die vier echten Umgehungen (10.10.2026) als Fixture, dazu Fälle, die erlaubt bleiben. */
import { findeKetten } from './umfang-ketten.mjs'

const fehler = []
const fall = (name, pfad, quelltext, erwartet) => {
  const zeilen = findeKetten(pfad, quelltext)
  if (zeilen.join() === erwartet.join()) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Zeilen ${JSON.stringify(zeilen)}, erwartet ${JSON.stringify(erwartet)}`)
}

// Kopien der Fundstellen; Zeile 1 ist jeweils die erste Zeile des Fixtures.
fall(
  'pipeline/build.ts: Aufruf mit ; an die baueTitel-Zeile gehängt',
  'x.ts',
  ['function main(): void {', '  const quellen = ladeQuellen()', '  const { titles } = baueTitel(quellen); messeAnisearch(titles)', '}'].join('\n'),
  [3],
)
fall(
  'shared/types.ts: mehrere Typ-Felder mit ; in einer Zeile (PR 681)',
  'x.ts',
  [
    'export interface Release {',
    '  id: string',
    "  ersteDeutsch?: Record<number, string>; premiere?: { weg: 'tv' | 'stream'; quelle: string } // Handbeleg",
    '  tvPremiere?: boolean; premiere?: boolean; premiereVorher?: string',
    '}',
  ].join('\n'),
  [3, 4, 4],
)
fall(
  'pipeline/bau/05-releases.ts: Spreads im Objektliteral zusammengezogen (PR 681)',
  'x.ts',
  [
    'const r = {',
    '  note: entry.note,',
    '  ...(entry.nachtrag ? { nachtrag: entry.nachtrag } : {}), ...(entry.netflixOriginal ? { netflixOriginal: true } : {}), ...(entry.sprache ? { sprache: entry.sprache } : {}),',
    '  ...(entry.schnitt ? { schnitt: entry.schnitt } : {}),',
    '}',
  ].join('\n'),
  [3, 3],
)
fall(
  'web/src/components/detail/pillen.tsx: zwei const mit ; in einer Zeile (PR 681)',
  'x.tsx',
  [
    'export function Pille({ release }) {',
    "  const tv = release.platform === 'tv'; const premiere = tv ? !!tvText?.premiere : release.premiere?.weg === 'stream'",
    '  return <span>{premiere}</span>',
    '}',
  ].join('\n'),
  [2],
)

fall('Erlaubt: ein Eintrag je Zeile', 'x.ts', ['interface A {', '  a: string', '  b?: number', '}', 'const o = {', '  a,', '  b,', '}'].join('\n'), [])
fall('Erlaubt: Liste in einer Zeile', 'x.ts', ['type P = { a: string; b?: number }', 'const o = { a, b }', 'const f = () => { g(); h() }'].join('\n'), [])
fall('Erlaubt: Tabelle mit einem kleinen Objekt je Zeile', 'x.ts', ['const t = [', '  { id: 1, name: "a" },', '  { id: 2, name: "b" },', ']'].join('\n'), [])
fall('Erlaubt: Kommentar nach der Anweisung', 'x.ts', ['function f() {', '  a() // b(); c()', '  d()', '}'].join('\n'), [])
fall('Erlaubt: Aufrufargumente und Zeichenketten mit ;', 'x.ts', ['function f() {', '  g(a, b, "x; y")', '  const s = `p; q`', '}'].join('\n'), [])
fall('Erlaubt: kurzer case-Zweig in einer Zeile', 'x.ts', ['switch (x) {', '  case 1: a(); break', '}'].join('\n'), [])
fall('Gezählt: Kette hinter einem mehrzeiligen case-Zweig', 'x.ts', ['switch (x) {', '  case 1:', '    a(); b()', '    break', '}'].join('\n'), [3])

if (fehler.length) {
  console.error(`✖ ${fehler.length} Fall/Fälle fehlgeschlagen`)
  process.exit(1)
}
console.log('Ketten-Erkennung in Ordnung.')
