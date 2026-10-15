/**
 * Deaktiviert hat eine Stufe (docs/wissen/design-regeln.md, Abschnitt 4; 14.10.2026): `disabled:opacity-45 disabled:cursor-default`.
 * `opacity-30/40/50/60` und `cursor-not-allowed` gibt es in `web/src` nicht mehr; jedes `disabled:opacity-*` ist 45 und trägt
 * den Zeiger dazu. Bilder vergangener Termine dimmt `.ak-vorbei` in `styles.css` (0,5, kein Bedienelement).
 */
import assert from 'node:assert/strict'
import { dateien, funde, lies } from './design-quelle.mjs'

/** Zeilen mit einem `disabled:opacity-*`, dem der Zeiger `disabled:cursor-default` fehlt. */
function ohneZeiger(quellen) {
  return funde(/disabled:opacity-/, quellen).filter((f) => {
    const [pfad, zeile] = f.split(':')
    return !/disabled:cursor-default/.test(quellen.find(([p]) => p === pfad)[1].split('\n')[Number(zeile) - 1])
  })
}

const ALT = /(?<![\w-])opacity-(30|40|50|60)(?![\w/])|cursor-not-allowed/
const alle = dateien()
assert.equal(funde(ALT, [['a.tsx', 'a opacity-30\nb disabled:opacity-40 c\nd opacity-50 cursor-not-allowed\ne opacity-60']]).length, 4, 'das Muster sieht die alten Stufen')
assert.equal(funde(ALT, [['b.tsx', 'opacity-45 opacity-70 opacity-0 opacity-100 bg-black/60 disabled:opacity-45']]).length, 0)
assert.deepEqual(funde(ALT, alle), [], 'opacity-30/40/50/60 und cursor-not-allowed in web/src: stattdessen disabled:opacity-45 disabled:cursor-default')

assert.deepEqual(funde(/disabled:opacity-(?!45\b)/, alle), [], 'jedes disabled:opacity-* ist 45')
assert.equal(ohneZeiger([['a.tsx', 'x disabled:opacity-45']]).length, 1, 'ohne Zeiger wird erkannt')
assert.equal(ohneZeiger([['a.tsx', 'x disabled:cursor-default disabled:opacity-45']]).length, 0)
assert.deepEqual(ohneZeiger(alle), [], 'disabled:opacity-45 trägt disabled:cursor-default')

// Die Aufrufer: der Knopf der Vorlage, die Pfeile im Kalenderkopf und der Datumssprung tragen die Stufe.
assert.match(lies('components/ui.tsx'), /className=\{`\$\{cls\} disabled:cursor-default disabled:opacity-45`\}/, 'Button')
assert.match(lies('components/kalender/KalenderKopf.tsx'), /disabled:cursor-default disabled:opacity-45/, 'Kalenderkopf')
assert.match(lies('components/DatumSprung.tsx'), /disabled:cursor-default disabled:opacity-45/, 'Datumssprung')

console.log('design-deaktiviert: ok')
