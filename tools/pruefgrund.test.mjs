/**
 * Prüft `tools/pruefgrund.sh` an den Protokollformen, die der Bestandsbau am 18.10.2026 sah:
 * `check:logic` ohne `✖` (echte Zeile aus check-logic-alle.mjs), `✖`-Zeilen, leeres Protokoll.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const skript = join(dirname(fileURLToPath(import.meta.url)), 'pruefgrund.sh')
const ordner = mkdtempSync(join(tmpdir(), 'pruefgrund-'))

function grund(protokoll) {
  const datei = join(ordner, 'p.txt')
  writeFileSync(datei, protokoll)
  const r = spawnSync('bash', [skript, datei], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout.trim()
}

try {
  // Grüne Zeilen mit „ist rot" aus einem echten grünen check:logic (Lauf 39119366901), dazu eine mit „ist rot (" mitten in der Zeile.
  const gruenIstRot = [
    '[check:logic 93/194] pipeline/check-kalender-plausibilitaet.ts',
    '  ✓ ein Treffer mehr ist rot und nennt nur den neuen Schlüssel',
    '[check:logic 194/195] tools/web-hosting.test.ts',
    'ok   Budget + 1 (15.001) ist rot',
    'ok   Grenze 20.000 ist rot',
    '  ✓ Wächter: Treffer ist rot (Kulisse)',
    'Kulisse: Treffer ist rot und bleibt rot',
  ]
  // Ausgabe eines echten Rots (throw in check-logic.ts, 18.10.2026): Fehler, dann Ausgaben der parallel gelaufenen Prüfungen, dann die Formatzeile.
  const logikRot = [
    ...gruenIstRot,
    '[check:logic 12/194] pipeline/check-x.ts',
    'Error: Mutationsprobe Bauer R2',
    ...Array.from({ length: 150 }, (_, i) => `[check:logic ${13 + i}/194] pipeline/check-y${i}.ts`),
    'check:logic: pipeline/check-x.ts ist rot (11 von 194 Prüfungen grün gelaufen).',
    'Weitere Fehler dahinter bleiben verdeckt. Alle roten Prüfungen auf einmal: `npm run check:logic -- --alle`.',
    'npm error Lifecycle script failed',
    'npm error exit 1',
    'npm error done',
    '',
  ].join('\n')
  assert.match(grund(logikRot), /^check:logic: pipeline\/check-x\.ts ist rot \(/, 'check:logic ohne ✖ nennt die rote Prüfung, nicht grüne „ist rot"-Zeilen davor')

  const alleRot = [...gruenIstRot, 'check:logic: 3 von 194 Prüfungen rot:', '  - pipeline/check-a.ts', '  - pipeline/check-b.ts', '  - pipeline/check-c.ts', 'npm error Lifecycle script failed', 'npm error exit 1', ''].join('\n')
  assert.equal(grund(alleRot), 'check:logic: 3 von 194 Prüfungen rot: - pipeline/check-a.ts - pipeline/check-b.ts', '--alle: Kopfzeile und rote Dateien')

  const mitKreuz = ['bla', '  ✖ Titel 5 fehlt', '  ✖ Titel 6 fehlt', '  ✖ Titel 7 fehlt', '  ✖ Titel 8 fehlt', 'check:logic: a ist rot'].join('\n')
  assert.equal(grund(mitKreuz), '✖ Titel 5 fehlt ✖ Titel 6 fehlt ✖ Titel 7 fehlt', 'höchstens drei ✖-Zeilen, ✖ zuerst')

  const ohneMarke = ['a', 'b', 'c', '', 'd', 'e'].join('\n')
  assert.equal(grund(ohneMarke), 'c d e', 'ohne bekannte Marke die letzten drei nichtleeren Zeilen')

  assert.equal(grund('✖ "A" fehlt\n'), '✖ A fehlt', 'Anführungszeichen in ✖-Zeilen fallen weg')
  assert.equal(grund(''), 'Prüfung rot, Protokoll leer', 'leeres Protokoll ergibt trotzdem einen Grund')
  assert.equal(grund('"x"\n'), 'x', 'Anführungszeichen fallen weg (JSON der Statusmeldung)')
  console.log('pruefgrund: ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
