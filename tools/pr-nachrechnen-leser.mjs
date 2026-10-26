/**
 * Leser-Regel für `pr-nachrechnen.mjs` (26.10.2026, Befund PR 2043: ein Workflow-PR wurde fünfmal durch reine Bot-Daten entwertet, weil
 * jede Datei außer Doku als „liest Daten“ galt). Ein Bot-Sprung entwertet einen PR nur, wenn er eine bewegte Datei berührt oder Code,
 * der sie liest, mit dem Code des PR zusammenhängt: der PR ruft den Leser auf bzw. importiert ihn, oder der Leser nutzt eine Datei des PR.
 * Verknüpfung (`huelle`): relative Importe, Pfade mit Ordnerkopf im Text (Aufrufe wie `node tools/x.mjs`, Daten-Literale). `npm run`
 * wird nicht aufgelöst; `package.json` zählt nur mit den Skripten, deren Wert der PR ändert. Im Zweifel (zu große Hülle, zu viele Leser,
 * nicht lesbar) gilt der PR als betroffen. Grenze: ein zur Laufzeit zusammengesetzter Pfad fällt nicht auf.
 */
import path from 'node:path'

export const HUELLE_GRENZE = 200
export const LESER_GRENZE = 40
/** PR-Pfade ohne Leser in der Kette (Doku, Daniel-Dateien, Patch Notes, Markdown im Wurzelordner). */
export const OHNE_DATENLESER = ['docs/', 'daniel-zum-abarbeiten/', 'data/patchnotes/']
export const ohneLeser = (datei) => OHNE_DATENLESER.some((p) => datei.startsWith(p)) || /^[^/]+\.md$/.test(datei)

const ENDUNGEN = ['.ts', '.tsx', '.mjs', '.cjs', '.mts', '/index.ts']
const CODE = /\.(ts|tsx|mjs|cjs|mts)$/
/** Nur diese Dateien werden gelesen; Daten, Markdown und Bilder bleiben Blätter. */
export const LESBAR = /\.(ts|tsx|mjs|cjs|mts|js|sh|ya?ml)$/
const PFAD = /(?:^|[^\w./-])((?:\.github|data|public|tools|pipeline|shared|web|worker|extension)\/[\w./@-]*\w)/g
const KOMMENTAR = /^\s*(\/\/|\*|\/\*|#)/

export const ohneKommentare = (text) => text.split('\n').filter((z) => !KOMMENTAR.test(z)).join('\n')

/** Relative Importe mit Literal als Kandidatenpfade (mit und ohne Endung), relativ zur Wurzel. */
export function importZiele(datei, text) {
  const ziele = []
  for (const m of text.matchAll(/['"`](\.{1,2}\/[^'"`\n]+)['"`]/g)) {
    const basis = path.posix.normalize(path.posix.join(path.posix.dirname(datei), m[1]))
    ziele.push(basis, ...ENDUNGEN.map((ende) => basis + ende))
  }
  return ziele
}

/** Pfade mit Ordnerkopf im Text außerhalb von Kommentarzeilen. */
export const pfadTokens = (text) => [...new Set([...ohneKommentare(text).matchAll(PFAD)].map((m) => m[1]))]

const folgen = (datei, text) => [...(CODE.test(datei) ? importZiele(datei, text) : []), ...pfadTokens(text)]

/** Ein Name trifft eine Datei, wenn er sie selbst oder ihren Ordner meint (Token ohne Endung wie `data/cache`). */
export const trifft = (name, datei) => datei === name || datei.startsWith(`${name}/`)

/** Alle von `start` aus erreichbaren Namen (Dateien und Pfad-Tokens); `zweifel` gesetzt, wenn die Hülle die Grenze sprengt. */
export function huelle(start, lies) {
  const namen = new Set(start)
  const offen = [...start]
  let gelesen = 0
  while (offen.length > 0) {
    const datei = offen.pop()
    const text = LESBAR.test(datei) ? lies(datei) : null
    if (text === null) continue
    if (++gelesen > HUELLE_GRENZE) return { namen, zweifel: `Hülle größer als ${HUELLE_GRENZE} Dateien` }
    for (const ziel of folgen(datei, text)) {
      if (namen.has(ziel)) continue
      namen.add(ziel)
      offen.push(ziel)
    }
  }
  return { namen, zweifel: null }
}

/** Nennt der Text (ohne Kommentare) die Datei mit Pfad oder wenigstens ihrem Namen? */
export const nennt = (text, bewegt) => {
  const code = ohneKommentare(text)
  return code.includes(bewegt) || code.includes(bewegt.split('/').pop())
}

/** Skript-Werte aus package.json, die sich zwischen alt und neu unterscheiden, als ein Text; null, wenn nicht lesbar. */
export function geaenderteSkripte(altJson, neuJson) {
  try {
    const alt = JSON.parse(altJson).scripts ?? {}
    const neu = JSON.parse(neuJson).scripts ?? {}
    return Object.keys(neu).filter((k) => neu[k] !== alt[k]).map((k) => neu[k]).join('\n')
  } catch {
    return null
  }
}

/**
 * null = kein Zusammenhang (Ausnahme gilt), sonst der Grund.
 * `bewegt`: die bewegten Dateien, die ein Leser sehen kann (ohne Bot-Dateien ohne Leser, public/data, data/cache).
 * `pr`: Dateien des PR. `leser`: Dateien auf main, die eine bewegte Datei im Code nennen. `lies(pfad)`: Text oder null (Kopf, sonst main).
 * `paketSkripte`: geänderte Skripte aus package.json (null = nicht lesbar), nur gebraucht, wenn der PR package.json berührt.
 */
export function bewegtesGelesen({ bewegt, pr, leser, lies, paketSkripte }) {
  if (bewegt.length === 0) return null
  const treffer = pr.find((p) => bewegt.includes(p))
  if (treffer !== undefined) return `der PR berührt ${treffer}`
  const eigene = pr.filter((p) => !ohneLeser(p) && p !== 'package.json')
  let start = [...eigene]
  if (pr.includes('package.json')) {
    if (paketSkripte === null) return 'package.json nicht vergleichbar'
    start = [...start, ...pfadTokens(paketSkripte)]
  }
  for (const p of eigene.filter((d) => LESBAR.test(d))) {
    const text = lies(p)
    const b = text === null ? undefined : bewegt.find((x) => nennt(text, x))
    if (b !== undefined) return `der PR liest ${b} (${p})`
  }
  if (leser.length > LESER_GRENZE) return `${leser.length} Leser der bewegten Dateien, mehr als ${LESER_GRENZE}`
  const vorwaerts = huelle(start, lies)
  if (vorwaerts.zweifel !== null) return vorwaerts.zweifel
  const l1 = leser.find((r) => [...vorwaerts.namen].some((n) => trifft(n, r)))
  if (l1 !== undefined) return `der PR ruft ${l1} auf oder importiert es, das bewegte Daten liest`
  const rueckwaerts = huelle(leser, lies)
  if (rueckwaerts.zweifel !== null) return rueckwaerts.zweifel
  for (const p of start) {
    const n = [...rueckwaerts.namen].find((x) => trifft(x, p))
    if (n !== undefined) return `${p} wird von Code genutzt, der bewegte Daten liest (${n})`
  }
  return null
}
