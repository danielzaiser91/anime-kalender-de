/**
 * Hover-Stufen einheitlich (docs/wissen/design-regeln.md, Abschnitt 4 und 6; 14.10.2026): Fläche eins höher, Rand auf `ak-leise`,
 * Text auf `ak-text`, Primärknopf auf `ak-akzent-hover`. Die alten Paare (`hover:bg-slate-*`, `dark:hover:*`, `hover:text-sky-*`,
 * `hover:brightness-*` …) gibt es in `web/src` nicht mehr; `hover:border-ak-akzent` nur beim großen Verweis-Chip im Panel.
 */
import assert from 'node:assert/strict'
import { dateien, funde, lies } from './design-quelle.mjs'

const alle = dateien()
const ALT = /dark:hover:|hover:bg-(slate|white|sky|ak-rand)|hover:text-(sky|white|slate)|hover:border-(slate|white)|hover:brightness/
const probe = [['a.tsx', 'x hover:bg-slate-100 y\nz dark:hover:text-white\nhover:brightness-95 hover:bg-white/10 hover:bg-ak-rand hover:border-slate-400 hover:text-sky-400']]
assert.equal(funde(ALT, probe).length, 3, 'das Muster sieht die alten Paare (Zeilen)')
assert.equal(funde(ALT, [['b.tsx', 'hover:bg-ak-flaeche-2 hover:border-ak-leise hover:text-ak-text hover:bg-ak-akzent-hover']]).length, 0)
assert.deepEqual(funde(ALT, alle), [], 'alte Hover-Paare in web/src: stattdessen ak-flaeche-2/-3, ak-leise, ak-text, ak-akzent-hover')

// Der Akzent-Rand beim Zeigen gehört dem großen Verweis-Chip im Panel (`Chip gross`).
assert.deepEqual(funde(/hover:border-ak-akzent/, alle).map((f) => f.split(':')[0]), ['components/ui.tsx'], 'hover:border-ak-akzent nur beim großen Chip')

// Primärknöpfe: dieselbe Hover-Stufe.
const PRIMAER = 'hover:bg-ak-akzent-hover'
assert.match(lies('components/filter/filter-abschnitte.tsx'), new RegExp(`text-ak-auf-akzent ${PRIMAER}"`), 'Fertig im Filterfenster')
assert.match(lies('components/kalender/FilterFeld.tsx'), new RegExp(`text-ak-auf-akzent ${PRIMAER}"`), 'Fertig im Kalenderfilter')
assert.match(lies('components/kalender/KalenderKopf.tsx'), new RegExp(`'border-ak-akzent bg-ak-akzent text-ak-auf-akzent ${PRIMAER}'`), 'Filterknopf offen (Handy und Kopf)')
assert.match(lies('components/ui.tsx'), new RegExp(`'bg-ak-akzent text-ak-auf-akzent ${PRIMAER}'`), 'Button primary (Abo, Newsletter, Installieren)')

// Dunkle Fenster in beiden Themen tragen die Dunkelfassung der Tokens, die ihr Hover braucht.
assert.match(lies('styles.css'), /\.ak-immer-dunkel \{[^}]*--ak-flaeche-2: #1b202a;[^}]*--ak-text: #f2f1ee;[^}]*--ak-leise: #9aa0ab;/)
assert.match(lies('components/detail/kino.tsx'), /bg-slate-950 shadow-2xl ak-immer-dunkel"/, 'Trailer-Fenster trägt .ak-immer-dunkel')
assert.match(lies('components/beleg-dialog.tsx'), /className="ak-immer-dunkel /, 'Beleg-Dialog trägt .ak-immer-dunkel')

console.log('design-hover: ok')
