/**
 * Test für `tools/bestand-marken.mjs` (Ratsche gegen Wächter, die den ganzen Bestandsbau sperren, 26.10.2026): die Erkennung von
 * Titelmarken im Syntaxbaum mit festen Quelltexten, und die Liste `tools/bestand-ohne-marke.json` gegen die echten Wächter —
 * ein neuer Wächter ohne Marke und ohne Eintrag ist rot, ein Eintrag, der keinen Grund mehr hat, auch.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hatMarke, ohneMarke } from './bestand-marken.mjs'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')

// Erkennung: Aufruf irgendwo in der Datei zählt, auch verschachtelt; nur der Import, eine Zeichenkette, ein Kommentar oder ein
// Methodenaufruf zählen nicht.
assert.equal(hatMarke("import { melde } from './lib/quarantaene.ts'\nmelde(1, 'a', 'b')"), true)
assert.equal(hatMarke("for (const t of liste) { if (t.x) { meldeVerletzte(liste, 'a', 'b', (v) => v.x) } }"), true)
assert.equal(hatMarke("const f = () => { melde(2, 'a', 'b') }"), true)
assert.equal(hatMarke("import { melde } from './lib/quarantaene.ts'\nprocess.exit(1)"), false)
assert.equal(hatMarke("console.log('melde(1)')"), false)
assert.equal(hatMarke('// melde(1)\nprocess.exit(1)'), false)
assert.equal(hatMarke('x.melde(1)'), false)
assert.equal(hatMarke('melde'), false)
assert.equal(hatMarke(''), false)

// Kulisse: nur der Wächter mit möglichem Fehlerausgang und ohne Aufruf von melde steht in der Antwort (Marke, stumme Prüfung und Kommentarzeile nicht).
{
  const wo = mkdtempSync(join(tmpdir(), 'bestand-marken-'))
  try {
    mkdirSync(join(wo, 'tools'), { recursive: true })
    mkdirSync(join(wo, 'pipeline'), { recursive: true })
    const liste = ['# Kopf', 'pipeline/a-marke.ts', 'pipeline/b-ohne.ts', '', 'pipeline/c-stumm.ts', 'pipeline/d-ohne.ts']
    writeFileSync(join(wo, 'tools/check-bestand-liste.txt'), liste.join('\n'))
    writeFileSync(join(wo, 'pipeline/a-marke.ts'), ["melde(1, 'a', 'b')", 'process.exit(1)'].join('\n'))
    writeFileSync(join(wo, 'pipeline/b-ohne.ts'), ["console.error('x')", 'process.exit(1)'].join('\n'))
    writeFileSync(join(wo, 'pipeline/c-stumm.ts'), "console.log('nur Warnung')")
    writeFileSync(join(wo, 'pipeline/d-ohne.ts'), ['// melde(2)', 'process.exitCode = 2'].join('\n'))
    assert.deepEqual(ohneMarke(wo), ['pipeline/b-ohne.ts', 'pipeline/d-ohne.ts'])
  } finally {
    rmSync(wo, { recursive: true, force: true })
  }
}

// Die Liste gegen die echten Wächter, mit festen Zählern als Gegenprobe zur Datei selbst.
const eintraege = JSON.parse(readFileSync(join(WURZEL, 'tools/bestand-ohne-marke.json'), 'utf8'))
const stehen = eintraege.map((e) => e.datei)
const echt = ohneMarke(WURZEL)
assert.deepEqual(
  echt.filter((d) => !stehen.includes(d)),
  [],
  'Wächter in check-bestand-liste.txt ohne Titelmarke und ohne Eintrag in tools/bestand-ohne-marke.json: erst `melde`/`meldeVerletzte` (pipeline/lib/quarantaene.ts), sonst mit Grund eintragen',
)
assert.deepEqual(
  stehen.filter((d) => !echt.includes(d)),
  [],
  'Eintrag in tools/bestand-ohne-marke.json ohne Grund: der Wächter meldet Titel oder kann nicht mehr rot enden, Eintrag streichen',
)
// Obergrenze fest eingetragen: sie darf nur sinken (Stand 26.10.2026: 49). Wer einen Wächter ohne Marke einträgt, hebt sie an und muss das im PR begründen.
assert.ok(stehen.length <= 49, `Liste hat ${stehen.length} Einträge, erlaubt sind höchstens 49`)
assert.equal(new Set(stehen).size, stehen.length, 'Eintrag doppelt')
assert.ok(eintraege.every((e) => typeof e.grund === 'string' && e.grund.length > 10), 'jeder Eintrag hat einen Grund')
assert.deepEqual([...stehen].sort(), stehen, 'Liste alphabetisch')

// Die Wächter, die diese Arbeit gerade zu Titelmarken oder Warnungen gemacht hat, stehen nicht in der Liste.
for (const d of ['pipeline/check-cr-ja-deckung-bestand.ts', 'pipeline/check-tmdb-hauptserie-bestand.ts', 'pipeline/check-handlung-eigen-bestand.ts']) {
  assert.ok(!stehen.includes(d), `${d} gehört nicht in die Liste`)
}

console.log(`bestand-marken: ok (${stehen.length} Wächter ohne Titelmarke, Stand 26.10.2026)`)
