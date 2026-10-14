/**
 * Ein Fokusring für alles (docs/wissen/design-regeln.md, Abschnitt 4): `web/src/styles.css` setzt ihn einmal
 * (`:focus-visible { outline: 2px solid var(--ak-fokus) }`); Bauteile bauen keinen eigenen Fokus-Ring und
 * schalten den Umriss nicht ab. Rot, sobald ein verbotenes Muster in `web/src` auftaucht; die Muster selbst
 * prüft eine Gegenprobe an Beispielzeilen, damit ein stummer Regex nicht für Grün sorgt.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const quelle = join(wurzel, 'web', 'src')

export const VERBOTEN = [
  { name: 'Fokus als Ring (box-shadow kollidiert mit Rändern)', muster: /focus(-visible|-within)?\]?:ring/ },
  { name: 'Ring-Abstand für Fokus', muster: /ring-offset/ },
  { name: 'Umriss abgeschaltet (Fokus unsichtbar)', muster: /(^|[\s'"`:!])(outline-none|outline-hidden|outline-0|outline-transparent)\b/ },
  { name: 'Fokus-Umriss je Bauteil statt der einen Regel', muster: /:focus-visible\s*\{[^}]*outline/ },
]

/** Alle Fundstellen `Datei:Zeile Name` in einem Text. */
export function findeVerstoesse(datei, text) {
  const funde = []
  for (const { name, muster } of VERBOTEN) {
    const gesamt = new RegExp(muster.source, 'g')
    for (const m of text.matchAll(gesamt)) {
      const zeile = text.slice(0, m.index).split('\n').length
      funde.push(`${datei}:${zeile} ${name}`)
    }
  }
  return funde
}

function dateien(ordner) {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const pfad = join(ordner, e.name)
    if (e.isDirectory()) return dateien(pfad)
    return /\.(tsx?|css)$/.test(e.name) ? [pfad] : []
  })
}

// Gegenprobe: jedes Muster erkennt sein Beispiel (ohne sie wäre ein kaputter Regex ein stilles Grün).
const beispiele = [
  'className="focus-visible:ring-2 focus-visible:ring-sky-400"',
  'has-[.ak-oeffnen:focus-visible]:ring-2',
  'focus:ring-1',
  'ring-offset-4',
  "'focus:outline-none'",
  'className="rounded outline-none"',
  "'focus-visible:outline-hidden'",
  "'focus:outline-0'",
  "'outline-transparent'",
  "'!outline-0'",
  '.pn-x:focus-visible { outline: 2px solid red; }',
]
for (const b of beispiele) assert.ok(findeVerstoesse('beispiel', b).length > 0, `Muster erkennt nicht: ${b}`)
const erlaubt = [
  "'focus-visible:-outline-offset-2'",
  'has-[.ak-oeffnen:focus-visible]:outline-2',
  'ring-1 ring-ak-akzent',
  'group-focus-within:opacity-100',
  'outline-offset-0',
  'focus-visible:outline-2',
]
for (const e of erlaubt) assert.deepEqual(findeVerstoesse('beispiel', e), [], `Muster schlägt zu Unrecht an: ${e}`)

// Die eine Regel steht in styles.css; dort ist der Fokus-Umriss gewollt.
const imBauteil = (d) => !d.endsWith('styles.css')
const verstoesse = dateien(quelle).flatMap((d) =>
  findeVerstoesse(relative(wurzel, d), readFileSync(d, 'utf8')).filter((f) => imBauteil(d) || !f.includes('je Bauteil')),
)
assert.deepEqual(verstoesse, [], `Fokus-Verstöße in web/src:\n${verstoesse.join('\n')}`)

const css = readFileSync(join(quelle, 'styles.css'), 'utf8')
assert.match(css, /:focus-visible\s*\{\s*outline:\s*2px solid var\(--ak-fokus\);\s*outline-offset:\s*2px;/, 'styles.css: Fokusregel fehlt')
console.log('design-fokus: ok')
