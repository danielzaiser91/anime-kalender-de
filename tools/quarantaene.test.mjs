/**
 * Test für `tools/quarantaene.mjs` (Titel-Quarantäne im Bestandsbau, 18.10.2026): Marken lesen, das Gate je Sperrgrund und an der
 * Obergrenze, und die Exit-Codes der Befehle als eigener Prozess (so ruft `tools/commit-data.sh` sie auf).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OBERGRENZE, entscheide, liesMarken, markenZeile, warnText } from './quarantaene.mjs'

const SKRIPT = join(dirname(fileURLToPath(import.meta.url)), 'quarantaene.mjs')
const m = (titleId, pruefung = 'p') => ({ titleId, pruefung, grund: `g${titleId}` })

// Marken: auch eingerückt (Prüfungen rücken ihre Ausgabe ein), unlesbare und Kennungen ohne ganze Zahl zählen nicht.
const protokoll = [
  'vorher',
  markenZeile(11, 'a', 'x'),
  `    ${markenZeile(22, 'b', 'y')}`,
  'QUARANTAENE {kaputt',
  'QUARANTAENE {"titleId":"33","pruefung":"c","grund":"z"}',
  'QUARANTAENE {"titleId":4.5,"pruefung":"c","grund":"z"}',
  `text davor ${markenZeile(55, 'd', 'w')}`,
  markenZeile(66, 'e', 'v'),
  // Die Marke im Text, nicht am Anfang: zählt nicht, auch wenn der Rest als JSON lesbar wäre.
  'abcdefghijkl{"titleId":77,"pruefung":"QUARANTAENE ","grund":"z"}',
].join('\n')
assert.deepEqual(liesMarken(protokoll), [
  { titleId: 11, pruefung: 'a', grund: 'x' },
  { titleId: 22, pruefung: 'b', grund: 'y' },
  { titleId: 66, pruefung: 'e', grund: 'v' },
])
assert.deepEqual(liesMarken(''), [])
// Das Format liest auch, wer das Protokoll von Hand durchsucht.
assert.equal(markenZeile(1, 'p', 'g'), 'QUARANTAENE {"titleId":1,"pruefung":"p","grund":"g"}')

// Gate: neue Kennungen kommen dazu, in Reihenfolge, doppelte nur einmal.
assert.equal(OBERGRENZE, 3)
assert.deepEqual(entscheide([], [m(22), m(22), m(33)]), { liste: [m(22), m(33)] })
assert.deepEqual(entscheide([m(11)], [m(11), m(22)]), { liste: [m(11), m(22)] })
assert.deepEqual(entscheide([m(11)], [m(22), m(33)]), { liste: [m(11), m(22), m(33)] })
// Keine neue Kennung: keine Marke, oder nur schon zurückgestellte (der Fehler blieb nach dem Zurückstellen).
assert.deepEqual(entscheide([], []), { sperre: 'die Fehler tragen keine neue Titel-Kennung' })
assert.deepEqual(entscheide([m(11), m(22)], [m(22)]), { sperre: 'die Fehler tragen keine neue Titel-Kennung' })
// Cartoons (negative Kennung) und Kennung 0 werden nicht zurückgestellt, auch neben einem Anime und an mittlerer Stelle.
assert.deepEqual(entscheide([], [m(11), m(-5), m(22)]), { sperre: 'zurückgestellt werden nur Anime-Titel, nicht -5' })
assert.deepEqual(entscheide([], [m(0)]), { sperre: 'zurückgestellt werden nur Anime-Titel, nicht 0' })
assert.deepEqual(entscheide([], [m(1)]), { liste: [m(1)] })
// Obergrenze: drei gehen, vier sperren — auf einmal oder über zwei Runden.
assert.deepEqual(entscheide([], [m(11), m(22), m(33), m(44)]), { sperre: '4 Titel betroffen, zurückgestellt werden höchstens 3' })
assert.deepEqual(entscheide([m(11), m(22)], [m(33), m(44)]), { sperre: '4 Titel betroffen, zurückgestellt werden höchstens 3' })
assert.deepEqual(entscheide([m(11), m(22)], [m(33)]), { liste: [m(11), m(22), m(33)] })

assert.equal(warnText([m(11, 'a'), m(22, 'b')]), '2 Titel zurückgestellt: 11 (a), 22 (b)')

/** Ein Befehl als eigener Prozess: Exit-Code und Ausgabe; ein Absturz (Ausgabe auf stderr) ist nie das erwartete Ergebnis. */
function lauf(...args) {
  const r = spawnSync(process.execPath, [SKRIPT, ...args], { encoding: 'utf8' })
  assert.equal(r.stderr, '', args.join(' '))
  return { code: r.status, aus: r.stdout.trim() }
}

const ordner = mkdtempSync(join(tmpdir(), 'quarantaene-test-'))
try {
  const meta = join(ordner, 'meta.json')
  writeFileSync(meta, JSON.stringify({ titles: 3, quarantaene: [m(11, 'a'), m(22, 'b')] }))
  assert.deepEqual(lauf('text', meta), { code: 0, aus: '2 Titel zurückgestellt: 11 (a), 22 (b)' })
  writeFileSync(meta, JSON.stringify({ titles: 3 }))
  assert.deepEqual(lauf('text', meta), { code: 1, aus: '' })
  writeFileSync(meta, JSON.stringify({ quarantaene: [] }))
  assert.deepEqual(lauf('text', meta), { code: 1, aus: '' })
  assert.deepEqual(lauf('text', join(ordner, 'fehlt.json')), { code: 1, aus: '' })

  // sammeln: ohne Liste (erster Prüflauf) entsteht sie, die zweite Runde ergänzt sie; ohne neue Marke Exit 1 und keine Änderung.
  const pruefung = join(ordner, 'pruefung.txt')
  const liste = join(ordner, 'liste.json')
  writeFileSync(pruefung, `FEHLER: x\n  ${markenZeile(22, 'b', 'y')}\n`)
  assert.deepEqual(lauf('sammeln', pruefung, liste), { code: 0, aus: 'Quarantäne: 1 Titel zurückgestellt: 22 (b)' })
  assert.deepEqual(JSON.parse(readFileSync(liste, 'utf8')), [{ titleId: 22, pruefung: 'b', grund: 'y' }])
  writeFileSync(pruefung, `${markenZeile(22, 'b', 'y')}\n${markenZeile(33, 'c', 'z')}\n`)
  assert.equal(lauf('sammeln', pruefung, liste).code, 0)
  assert.deepEqual(JSON.parse(readFileSync(liste, 'utf8')).map((e) => e.titleId), [22, 33])
  const vorher = readFileSync(liste, 'utf8')
  assert.deepEqual(lauf('sammeln', pruefung, liste), { code: 1, aus: 'keine Quarantäne: die Fehler tragen keine neue Titel-Kennung' })
  writeFileSync(pruefung, [44, 55].map((id) => markenZeile(id, 'd', 'w')).join('\n'))
  assert.deepEqual(lauf('sammeln', pruefung, liste), { code: 1, aus: 'keine Quarantäne: 4 Titel betroffen, zurückgestellt werden höchstens 3' })
  assert.equal(readFileSync(liste, 'utf8'), vorher)

  // Falscher Aufruf: Exit 2, damit ihn das Skript nicht mit „sperren“ (1) verwechselt.
  for (const args of [[], ['sammeln', pruefung], ['text'], ['anders', 'a', 'b']]) assert.equal(lauf(...args).code, 2, args.join(' '))
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('quarantaene.test: grün.')
