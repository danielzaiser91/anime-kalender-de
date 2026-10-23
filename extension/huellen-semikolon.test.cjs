/**
 * Modulhüllen ohne führendes Semikolon (ASI-Falle): Die Content-Skripte einer Manifest-Gruppe
 * teilen sich einen Scope, und der Browser fügt sie ohne Trenner aneinander. Beginnt ein
 * Skript hinter einem anderen mit `(`, `[` oder einem Backtick, hängt es sich an dessen letzte
 * Anweisung, falls die kein `;` trägt. Das erste Skript einer Gruppe ist ausgenommen.
 */
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const GEFAEHRLICH = new Set(['(', '[', '`', '+', '-', '/', '*'])

/** Erstes Zeichen des Codes nach führenden Leerzeichen und Kommentaren. */
function ersterCodeBuchstabe(text) {
  let i = 0
  while (i < text.length) {
    if (/\s/.test(text[i])) i++
    else if (text.startsWith('//', i)) i = (text.indexOf('\n', i) + 1) || text.length
    else if (text.startsWith('/*', i)) i = (text.indexOf('*/', i) + 2) || text.length
    else return text[i]
  }
  return ''
}

/** Alle Dateien, die in ihrer Gruppe nicht an erster Stelle stehen und gefährlich beginnen. */
function huellenOhneSemikolon(manifest, lies) {
  const treffer = []
  for (const gruppe of manifest.content_scripts ?? []) {
    const js = gruppe.js ?? []
    for (const datei of js.slice(1)) {
      const zeichen = ersterCodeBuchstabe(lies(datei))
      if (GEFAEHRLICH.has(zeichen)) treffer.push(`${datei} (beginnt mit "${zeichen}")`)
    }
  }
  return treffer
}

const fehler = []
function pruefe(name, bedingung, gefunden) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Zusicherungen zu Modulhüllen ohne Semikolon (20.10.2026)\n')

const dateien = {
  'a.js': 'const a = 1',
  'rot.js': '// Kopf\n(() => {\n})()',
  'rot2.js': '/* Kopf */ (function () {})()',
  'rot3.js': '[1].map(String)',
  'rot4.js': '`x`.length',
  'gruen.js': '/* Kopf */\n;(() => {\n})()',
  'gruen2.js': '// nur Kommentar\nconst b = 2',
  'leer.js': '',
}
const lesen = (n) => dateien[n]
const manifestMit = (...js) => ({ content_scripts: [{ js }] })

pruefe('rot: Hülle ohne Semikolon hinter anderem Skript', huellenOhneSemikolon(manifestMit('a.js', 'rot.js'), lesen).length === 1)
pruefe('rot: Block-Kommentar davor ändert nichts', huellenOhneSemikolon(manifestMit('a.js', 'rot2.js'), lesen).length === 1)
pruefe('rot: eckige Klammer am Anfang', huellenOhneSemikolon(manifestMit('a.js', 'rot3.js'), lesen).length === 1)
pruefe('rot: Backtick am Anfang', huellenOhneSemikolon(manifestMit('a.js', 'rot4.js'), lesen).length === 1)
pruefe('grün: führendes Semikolon', huellenOhneSemikolon(manifestMit('a.js', 'gruen.js'), lesen).length === 0)
pruefe('grün: gewöhnliche Anweisung und leere Datei', huellenOhneSemikolon(manifestMit('a.js', 'gruen2.js', 'leer.js'), lesen).length === 0)
pruefe('grün: erstes Skript der Gruppe ist ausgenommen', huellenOhneSemikolon(manifestMit('rot.js'), lesen).length === 0)
pruefe(
  'zwei Gruppen: nur die zweite Stelle zählt je Gruppe',
  huellenOhneSemikolon({ content_scripts: [{ js: ['rot.js'] }, { js: ['a.js', 'rot.js'] }] }, lesen).length === 1,
)

const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'))
const echt = huellenOhneSemikolon(manifest, (n) => readFileSync(resolve(__dirname, n), 'utf8'))
pruefe('Manifest: keine Hülle ohne führendes Semikolon', echt.length === 0, echt)

if (fehler.length) process.exit(1)
