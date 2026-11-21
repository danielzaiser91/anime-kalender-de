/**
 * Text-Helfer aus der früheren Leser-Regel von `pr-nachrechnen.mjs` (Regel seit 21.11.2026 entfernt, PR 4417 und Folge-PR):
 * `ohneKommentare` (Kommentarzeilen und JS-Blockkommentare weg) und `importZiele` (relative Importe als Kandidatenpfade).
 */
import path from 'node:path'

const ENDUNGEN = ['.ts', '.tsx', '.mjs', '.cjs', '.mts', '/index.ts']
/** Nur hier gibt es Blockkommentare; in Shell/YAML öffnet ein Glob (`data/` + Stern) sonst einen Scheinblock und verschluckt echte Lesungen. */
const JS_FAMILIE = /\.(ts|tsx|mjs|cjs|mts|js)$/
const KOMMENTAR = /^\s*(\/\/|\*|\/\*|#)/

/** Ein `/` an dieser Stelle (letztes Zeichen davor) beginnt ein Regex-Literal, keine Division. */
const REGEX_VOR = /[(,=:[!&|?{};+*<>~^%-]$/

/** Ende des Regex-Literals ab `i` (Index hinter dem schließenden `/`); Klassen `[…]` und `\`-Zeichen werden übersprungen. */
function regexEnde(text, i) {
  let klasse = false
  for (let k = i + 1; k < text.length && text[k] !== '\n'; k++) {
    if (text[k] === '\\') k++
    else if (text[k] === '[') klasse = true
    else if (text[k] === ']') klasse = false
    else if (text[k] === '/' && !klasse) return k + 1
  }
  return i + 1
}

/**
 * Entfernt Blockkommentare über mehrere Zeilen (Zeilenumbrüche bleiben), auch wenn die Innenzeilen keinen Stern tragen. Zeichenketten,
 * Vorlagen, Regex-Literale und Zeilenkommentare werden übersprungen: `'data/*.json'` beginnt keinen Kommentar. Code hinter dem Kommentarende bleibt.
 * Grenzen: Vorlagen mit `${…}` und innerem Backtick kippen die Zeichenkettenzählung; ein Regex-Literal nach `)` oder `}` gilt als Division
 * (beides selten, festgehalten in den Tests „Grenze: …“).
 */
function ohneBlockkommentare(text) {
  let aus = ''
  for (let i = 0; i < text.length;) {
    const z = text[i]
    const naechste = text[i + 1]
    let ende = i + 1
    const schluss = z === '/' && naechste === '*' ? text.indexOf('*/', i + 2) : -1
    if (schluss !== -1) {
      aus += text.slice(i, schluss + 2).replace(/[^\n]/g, '')
      i = schluss + 2
      continue
    }
    if (z === '/' && naechste === '/') ende = text.indexOf('\n', i) === -1 ? text.length : text.indexOf('\n', i)
    else if (z === '/' && REGEX_VOR.test(aus.trimEnd().slice(-1) || '(')) ende = regexEnde(text, i)
    else if (z === '"' || z === "'" || z === '`') {
      for (ende = i + 1; ende < text.length && text[ende] !== z && (z === '`' || text[ende] !== '\n'); ende++) if (text[ende] === '\\') ende++
      ende = Math.min(ende + 1, text.length)
    }
    aus += text.slice(i, ende)
    i = ende
  }
  return aus
}

export const ohneKommentare = (text, datei = '') => (JS_FAMILIE.test(datei) ? ohneBlockkommentare(text) : text).split('\n').filter((z) => !KOMMENTAR.test(z)).join('\n')

/** Relative Importe mit Literal als Kandidatenpfade (mit und ohne Endung), relativ zur Wurzel. */
export function importZiele(datei, text) {
  const ziele = []
  for (const m of text.matchAll(/['"`](\.{1,2}\/[^'"`\n]+)['"`]/g)) {
    const basis = path.posix.normalize(path.posix.join(path.posix.dirname(datei), m[1]))
    ziele.push(basis, ...ENDUNGEN.map((ende) => basis + ende))
  }
  return ziele
}
