/**
 * Start-Budget (19.11.2026): Die Texte der nachgeladenen Ansichten liegen in `web/src/lib/i18n-spaet.ts`. Jede Datei, die die App per
 * `import('…')` nachlädt, muss sie importieren (sonst zeigt die Ansicht rohe Schlüssel), und kein Schlüssel steht in beiden Tafeln.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const SRC = resolve(import.meta.dirname, '../web/src')
const LIB = join(SRC, 'lib')
let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n)
    return statSync(p).isDirectory() ? dateien(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}

/** Ziele aller `import('./X.tsx')` in `web/src`, ohne Typ-Verweise (`typeof import`) und ohne das Vorwärmen. */
export function nachgeladeneWurzeln(quellen: Map<string, string>): string[] {
  const ziele = new Set<string>()
  for (const [pfad, text] of quellen) {
    if (pfad.endsWith('nachlade-vorwaermen.ts')) continue
    for (const m of text.matchAll(/(?<!typeof )import\('(\.[^']+\.tsx?)'\)/g)) ziele.add(resolve(dirname(pfad), m[1]))
  }
  return [...ziele].sort()
}

export function schluessel(text: string): string[] {
  return [...text.matchAll(/^ {2}'([^']+)':/gm)].map((m) => m[1])
}

const quellen = new Map(dateien(SRC).map((p) => [p, readFileSync(p, 'utf8')] as const))
const wurzeln = nachgeladeneWurzeln(quellen)
pruefe('es gibt nachgeladene Wurzeln', wurzeln.length >= 8, wurzeln.length)
const ohne = wurzeln.filter((p) => !/import '(\.\.\/)+lib\/i18n-spaet\.ts'|import '\.\/i18n-spaet\.ts'/.test(quellen.get(p) ?? ''))
pruefe('jede nachgeladene Wurzel importiert i18n-spaet.ts', ohne.length === 0, ohne.map((p) => p.replace(SRC, '')))

const spaet = new Set(schluessel(quellen.get(join(LIB, 'i18n-spaet.ts')) ?? ''))
const frueh = readdirSync(LIB).filter((n) => /^i18n(-[a-z]+)?\.tsx?$/.test(n) && !/spaet|knoten/.test(n)).flatMap((n) => schluessel(quellen.get(join(LIB, n)) ?? ''))
pruefe('die späten Texte sind nicht leer', spaet.size > 400, spaet.size)
pruefe('kein Schlüssel steht in der frühen und der späten Tafel', frueh.every((k) => !spaet.has(k)), frueh.filter((k) => spaet.has(k)))
pruefe('Fall: Wurzel ohne Import wird erkannt', nachgeladeneWurzeln(new Map([['/x/a.tsx', "x(() => import('./B.tsx'))"]])).join() === '/x/B.tsx')
pruefe('Fall: typeof import zählt nicht', nachgeladeneWurzeln(new Map([['/x/a.tsx', "T<typeof import('./B.tsx').B>"]])).length === 0)

if (fehler) {
  console.error(`check-start-texte: ${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('check-start-texte: ok (Wurzeln importieren i18n-spaet.ts, Tafeln überschneiden sich nicht)')
