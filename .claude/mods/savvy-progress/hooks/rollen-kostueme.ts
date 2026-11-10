import { CLAY, stamp } from './kostueme'
import type { Fill } from './kostueme'

// `body(armFront, armCls)` zeichnet die nackte Krabbe (siehe `crabBody` in register.tsx).
type Body = (armFront?: number, armCls?: string) => void
type Kostuem = (f: Fill, t: string, body: Body) => void

// Bewegungen nur als CSS-Klassen; `register.tsx` hängt sie vor die Regel für `prefers-reduced-motion`.
export const ROLLEN_CSS = `.c-bauer.run .ha{animation:tap .5s steps(1) infinite}
.c-bauer.run .hb{animation:tap .5s steps(1) infinite -.25s}
@keyframes tap{50%{transform:translateY(-1px)}}
.c-pruefer.run .it{transform-origin:50% 100%;animation:nod 1s ease-in-out infinite}
.c-pruefer.run .chk{animation:blink 1s steps(1) infinite}
@keyframes nod{50%{transform:rotate(-8deg)}}
.c-entdecker.run .it{transform-origin:50% 100%;animation:dig .5s ease-in-out infinite}
@keyframes dig{50%{transform:rotate(-18deg)}}`

const KOPFHOERER = '#2B2B2D'

// Bauer: Entwickler mit Kopfhörern vor dem Laptop; die Scheren tippen abwechselnd.
const bauer: Kostuem = (f, t, body) => {
  body()
  f(6, 8, 18, 1, KOPFHOERER)
  f(4, 9, 3, 5, KOPFHOERER)
  f(23, 9, 3, 5, KOPFHOERER)
  f(4, 10, 2, 3, t)
  f(24, 10, 2, 3, t)
  f(9, 14, 12, 7, '#8E929A')
  f(10, 15, 10, 5, '#A9ADB5')
  f(14, 16, 2, 2, t)
  f(6, 21, 18, 1, '#6B6F77')
  f(10, 19, 2, 2, CLAY, 'ha')
  f(18, 19, 2, 2, CLAY, 'hb')
}

const HELM = ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd']

// Prüfer: weißer Bauhelm mit Streifen, hält ein Klemmbrett, dessen Haken blinkt.
const pruefer: Kostuem = (f, t, body) => {
  body(-4, 'it')
  stamp(f, 6, 4, HELM, { y: '#F2F0EA', h: '#D2D1C8', d: '#B8B6AC' })
  f(13, 5, 4, 2, t)
  f(24, 1, 6, 9, '#8B5A2B', 'it')
  f(25, 3, 4, 6, '#F8F6F1', 'it')
  f(26, 1, 2, 2, '#C9CCD2', 'it')
  f(25, 4, 3, 1, '#CFCDC4', 'it')
  f(25, 6, 1, 1, t, 'chk')
  f(26, 7, 1, 1, t, 'chk')
  f(27, 6, 1, 1, t, 'chk')
  f(28, 5, 1, 1, t, 'chk')
}

const HUT = [
  '........hhhhhh........',
  '.......kkkkkkkk.......',
  '.......kkkkkkkk.......',
  '......kkkkkkkkkk......',
  '......tttttttttt......',
  '....dddddddddddddd....',
  'dddddddddddddddddddddd',
]

// Entdecker (Rechercheur): Safarihut, gräbt mit der Schaufel.
const entdecker: Kostuem = (f, t, body) => {
  body(-4, 'it')
  stamp(f, 4, 3, HUT, { k: '#D9C28F', h: '#EBDDB5', t, d: '#A88B4A' })
  f(27, 2, 1, 11, '#7A4A26', 'it')
  f(26, 2, 3, 1, '#7A4A26', 'it')
  f(26, 13, 3, 4, '#8E929A', 'it')
}

const ROLLEN_KOSTUEME: Record<string, Kostuem> = { bauer, pruefer, entdecker }

// Die Kostüme im Format von `COSTUMES` in register.tsx; `crabBody` kommt von dort.
export const rollenKostueme = (crabBody: (f: Fill, armFront?: number, armCls?: string) => void): Record<string, (f: Fill, t: string) => void> =>
  Object.fromEntries(Object.entries(ROLLEN_KOSTUEME).map(([k, kost]) => [k, (f: Fill, t: string) => kost(f, t, (a, c) => crabBody(f, a, c))]))
