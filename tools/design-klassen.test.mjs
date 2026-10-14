/**
 * Gegenprobe zu tools/design-klassen.mjs: Eine zusätzliche alte Farbklasse macht den Wächter rot, ohne sie bleibt er grün,
 * `--festschreiben` senkt und erhöht nie, und die Ausnahmen für Hex-Werte greifen. Außerdem hängt der Bestandsbau
 * (tools/commit-data.sh) wirklich daran und die Grenzdatei deckt den echten Bestand.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
const werkzeug = join(tools, 'design-klassen.mjs')
const ordner = mkdtempSync(join(tmpdir(), 'design-klassen-'))

function lauf(quelle, grenzen, ...optionen) {
  return spawnSync(process.execPath, [werkzeug, '--quelle', quelle, '--grenzen', grenzen, ...optionen], { encoding: 'utf8' })
}

/** Baut einen Quellbaum aus `{ 'a/b.tsx': 'text' }`. */
function baum(name, dateien) {
  const wurzel = join(ordner, name)
  for (const [pfad, text] of Object.entries(dateien)) {
    mkdirSync(dirname(join(wurzel, pfad)), { recursive: true })
    writeFileSync(join(wurzel, pfad), text)
  }
  return wurzel
}

try {
  const grundlage = { 'Knopf.tsx': '<button className="px-2 text-ak-text">x</button>\n' }
  const quelle = baum('quelle', grundlage)
  const grenzen = join(ordner, 'grenzen.json')

  // Neue Datei: --festschreiben legt die Startwerte an (alles 0).
  assert.equal(lauf(quelle, grenzen, '--festschreiben').status, 0)
  assert.equal(lauf(quelle, grenzen).status, 0, 'ohne alte Klasse grün')

  // Gegenprobe: ein zusätzliches text-slate-500 (auch in einer .ts und .css) macht rot.
  for (const [datei, zusatz] of [
    ['Knopf.tsx', '<b className="text-slate-500">y</b>\n'],
    ['lib/x.ts', "export const k = 'dark:bg-black'\n"],
    ['styles.css', '.a { color: var(--c); } /* ring-sky-400 */\n'],
  ]) {
    const mit = baum('mit', { ...grundlage, [datei]: (grundlage[datei] ?? '') + zusatz })
    const r = lauf(mit, grenzen)
    assert.equal(r.status, 1, `${datei} mit alter Klasse rot`)
    rmSync(mit, { recursive: true })
  }

  // Hex nur in .tsx und nicht in den Ausnahmen; „#12369“ ist keine Farbe.
  const hexAus = baum('hex-aus', {
    ...grundlage,
    'styles.css': ':root { --a: #ff5a36; }\n',
    'components/detail/pillen.tsx': 'const c = "#34d399"\n',
    'components/filter/Flagge.tsx': 'const c = "#fff"\n',
    'components/de-flagge.tsx': 'const c = "#000000"\n',
    'components/Datenschutz.tsx': 'IP-Management #12369, Hamburg\n',
  })
  assert.equal(lauf(hexAus, grenzen).status, 0, 'Ausnahmen und Nicht-Farben zählen nicht')
  const hexMit = baum('hex-mit', { ...grundlage, 'components/Neu.tsx': 'const c = "#0d0f14"\n' })
  assert.equal(lauf(hexMit, grenzen).status, 1, 'neuer Hex in .tsx rot')

  // --festschreiben übernimmt gesunkene Werte, erhöht nie.
  const alt = baum('alt', { 'A.tsx': '<i className="text-slate-500 dark:text-white">a</i>\n' })
  const altGrenzen = join(ordner, 'alt.json')
  assert.equal(lauf(alt, altGrenzen, '--festschreiben').status, 0)
  assert.equal(JSON.parse(readFileSync(altGrenzen, 'utf8')).vorkommen['slate-'], 1)
  assert.equal(lauf(quelle, altGrenzen).status, 0)
  assert.match(lauf(quelle, altGrenzen).stdout, /Gesunken/, 'Senkung wird gemeldet')
  assert.equal(lauf(quelle, altGrenzen, '--festschreiben').status, 0)
  assert.equal(JSON.parse(readFileSync(altGrenzen, 'utf8')).vorkommen['slate-'], 0, 'gesunkener Wert übernommen')
  const vorher = readFileSync(grenzen, 'utf8')
  assert.equal(lauf(baum('plus', { 'A.tsx': 'text-sky-400\n' }), grenzen, '--festschreiben').status, 1, 'Festschreiben erhöht nie')
  assert.equal(readFileSync(grenzen, 'utf8'), vorher, 'Grenzdatei unverändert')

  // Aufrufer: die echte Grenzdatei deckt den echten Bestand, der Bestandsbau schreibt sie fest.
  const echt = spawnSync(process.execPath, [werkzeug], { encoding: 'utf8' })
  assert.equal(echt.status, 0, `web/src liegt über tools/design-klassen-grenzen.json:\n${echt.stderr}`)
  const bestandsbau = readFileSync(join(tools, 'commit-data.sh'), 'utf8')
  assert.match(bestandsbau, /node tools\/design-klassen\.mjs --festschreiben/, 'commit-data.sh ruft --festschreiben auf')
  assert.match(bestandsbau, /hinzu tools\/design-klassen-grenzen\.json/, 'commit-data.sh stagt die Grenzdatei')
  const liste = readFileSync(join(tools, 'check-logic-liste.txt'), 'utf8')
  assert.match(liste, /^tools\/design-klassen\.mjs$/m, 'der Wächter steht in check:logic')

  console.log('design-klassen.test: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
