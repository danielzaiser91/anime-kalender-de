/** Tests für tools/mutationsanker.mjs: Anker-Wächter für Mutationslisten. */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ankerFehler, ankerRot, listenImDiff, pruefeListen } from './mutationsanker.mjs'
import { vorpruefe } from './pr-vorpruefung.mjs'

const fehler = []
const pruefe = (name, ok) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}`)
}

const LISTE = 'tools/mutationen/a.json'
const mutant = (datei, suche, name = 'm') => ({ name, datei, suche, ersetze: 'X' })
const dateien = { 'a.ts': 'eins zwei\ndrei\n', 'b.ts': 'nur hier vier\n' }
const lies = (extra = {}) => (p) => ({ ...dateien, ...extra })[p] ?? null
const text = (liste) => JSON.stringify(liste)

pruefe('Anker da: keine Fehler', ankerFehler(LISTE, text([mutant('a.ts', 'zwei')]), lies()).length === 0)
const weg = ankerFehler(LISTE, text([mutant('a.ts', 'zwei'), mutant('a.ts', 'verschwunden', 'alt')]), lies())
pruefe('Anker weg: genau ein Fehler mit Mutantenname', weg.length === 1 && weg[0].includes('„alt“') && weg[0].includes('nicht gefunden'))
pruefe('Anker steht nur in der anderen Datei: Fehler', ankerFehler(LISTE, text([mutant('a.ts', 'vier')]), lies()).length === 1)
pruefe('Anker in der richtigen zweiten Datei: grün', ankerFehler(LISTE, text([mutant('b.ts', 'vier')]), lies()).length === 0)
pruefe('mehrdeutiger Anker: Fehler', ankerFehler(LISTE, text([mutant('a.ts', 'e')]), lies()).some((f) => f.includes('mehrdeutig')))
pruefe('nr löst Mehrdeutigkeit', ankerFehler(LISTE, text([{ ...mutant('a.ts', 'e'), nr: 2 }]), lies()).length === 0)
pruefe('Datei fehlt: Fehler', ankerFehler(LISTE, text([mutant('weg.ts', 'x')]), lies())[0]?.includes('weg.ts fehlt') === true)
pruefe('mehrere Änderungen: jede wird geprüft', ankerFehler(LISTE, text([{ name: 'z', aenderungen: [{ datei: 'a.ts', suche: 'zwei', ersetze: 'X' }, { datei: 'a.ts', suche: 'gibtsnicht', ersetze: 'X' }] }]), lies()).length === 1)
pruefe('Kontrollmutant ohne Änderungen: grün', ankerFehler(LISTE, text([{ name: 'Kontrolle', aenderungen: [] }]), lies()).length === 0)
const kaputt = ankerFehler(LISTE, '{ kaputt', lies())
pruefe('kaputtes JSON: ein Fehler mit Listenname', kaputt.length === 1 && kaputt[0].startsWith(LISTE))
pruefe('Liste ist kein Array: Fehler', ankerFehler(LISTE, '{}', lies()).length === 1)
pruefe('Paarformat der mutationsprobe: nichts zu prüfen', ankerFehler(LISTE, text([['a', 'b']]), lies()).length === 0)

pruefe('listenImDiff: nur Listen direkt in tools/mutationen', JSON.stringify(listenImDiff([LISTE, 'tools/mutationen/x/y.json', 'tools/mutationen/n.txt', 'tools/andere.json'])) === JSON.stringify([LISTE]))
const kaputteListe = { [LISTE]: text([mutant('a.ts', 'verschwunden')]) }
pruefe('Liste im Diff: Rot mit Präfix', ankerRot([LISTE], lies(kaputteListe)).length === 1 && ankerRot([LISTE], lies(kaputteListe))[0].startsWith('Mutationsanker:'))
pruefe('Liste nicht im Diff: kein Befund trotz kaputter Liste', ankerRot(['tools/anderes.mjs'], lies(kaputteListe)).length === 0)
pruefe('Liste im Diff gelöscht (Datei fehlt): kein Befund', ankerRot([LISTE], lies()).length === 0)
const zaehl = pruefeListen([LISTE], lies({ [LISTE]: text([mutant('a.ts', 'zwei'), mutant('a.ts', 'drei')]) }))
pruefe('pruefeListen zählt Mutanten', zaehl.anzahl === 2 && zaehl.fehler.length === 0)

// Verdrahtung: die Vorprüfung ruft den Wächter wirklich auf (Aufruf entfernt -> rot).
const vor = (d, l) => vorpruefe({ dateien: d, neu: [], zweig: 'speed/x', existiert: () => true, text: '', lies: l })
pruefe('vorpruefe: kaputte Liste im Diff ist rot', vor([LISTE], lies(kaputteListe)).rot.some((r) => r.startsWith('Mutationsanker:')))
pruefe('vorpruefe: kaputte Liste außerhalb des Diffs bleibt ohne Befund', !vor(['tools/anderes.mjs'], lies(kaputteListe)).rot.some((r) => r.startsWith('Mutationsanker:')))

// Prozess: CLI liest die Listen von der Platte (cwd = Wegwerf-Ordner), Exit 0/1 samt Zeile.
const wurzel = mkdtempSync(join(tmpdir(), 'mutanker-'))
try {
  mkdirSync(join(wurzel, 'tools', 'mutationen'), { recursive: true })
  writeFileSync(join(wurzel, 'a.ts'), 'eins zwei\n')
  writeFileSync(join(wurzel, 'gut.json'), text([mutant('a.ts', 'zwei')]))
  writeFileSync(join(wurzel, 'schlecht.json'), text([mutant('a.ts', 'nirgends', 'fehlt')]))
  writeFileSync(join(wurzel, 'kaputt.json'), '[ nope')
  const skript = fileURLToPath(new URL('./mutationsanker.mjs', import.meta.url))
  const fahre = (...a) => spawnSync(process.execPath, [skript, ...a], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
  const g = fahre('gut.json')
  pruefe('Prozess gut: Exit 0 und Zeile', g.status === 0 && /Mutationsanker: 1 Listen, 1 Mutanten, 0 Anker/.test(g.stdout))
  const s = fahre('schlecht.json')
  pruefe('Prozess Anker weg: Exit 1, Name in stderr', s.status === 1 && s.stderr.includes('„fehlt“') && /1 Anker nicht auffindbar/.test(s.stdout))
  const k = fahre('kaputt.json')
  pruefe('Prozess kaputtes JSON: Exit 1', k.status === 1 && k.stderr.includes('kaputt.json'))
  const n = fahre('gut.json', 'schlecht.json')
  pruefe('Prozess zwei Listen: eine rot genügt', n.status === 1)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`✗ mutationsanker: ${fehler.length} Fälle rot`)
  process.exit(1)
}
console.log('✓ mutationsanker: alle Fälle grün')
