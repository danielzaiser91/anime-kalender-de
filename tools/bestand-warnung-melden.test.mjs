/**
 * Test für `tools/bestand-warnung-melden.mjs` (herabgestufte Bestandsprüfungen im Posteingang, 26.10.2026): welche Zeilen zählen,
 * Doppelte, Obergrenze, kaputte und fehlende Dateien, zwei Läufe hintereinander und der Aufruf als eigener Prozess.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HOECHSTENS, RUECKBLICK, bekannteTexte, main, neueZeilen, warnTexte } from './bestand-warnung-melden.mjs'

const SKRIPT = join(dirname(fileURLToPath(import.meta.url)), 'bestand-warnung-melden.mjs')
const JETZT = new Date('2026-10-26T12:00:00Z')
const zeile = (id) => `⚠ WARNUNG [vorher rot] Eigene Handlung: 1 ohne Titel im Bestand (nichts davon live): ${id}`
const bestehend = (...texte) => texte.map((text) => JSON.stringify({ am: 'x', quelle: 'q', schwere: 'warnung', text }) + '\n').join('')

// Nur Zeilen mit der Marke zählen; eine gewöhnliche Warnung, ein Fehler und die Marke ohne Warnzeichen nicht; eingerückt zählt; doppelt einmal.
const protokoll = [
  zeile(1),
  '⚠ WARNUNG Eigene Handlung: 2 überholt (Quelle gewinnt): 5, 6',
  `  ${zeile(2)}`,
  zeile(1),
  'FEHLER: [vorher rot] 9',
  '[vorher rot] ohne Warnzeichen',
  '✓ fertig',
].join('\n')
assert.deepEqual(warnTexte(protokoll), [zeile(1).slice('⚠ WARNUNG '.length), zeile(2).slice('⚠ WARNUNG '.length)])
assert.deepEqual(warnTexte(''), [])
assert.deepEqual(warnTexte('⚠ WARNUNG nur ein Hinweis'), [])

// Schon gemeldet (gleicher Wortlaut) wird übersprungen; ein anderer Wortlaut (andere Kennung) ist neu; kaputte Zeilen stören nicht.
const t1 = warnTexte(zeile(1))[0]
const t2 = warnTexte(zeile(2))[0]
assert.deepEqual([...bekannteTexte(`kaputt{\n${bestehend(t1)}{"text":5}\n`)], [t1])
assert.equal(neueZeilen(zeile(1), bestehend(t1), JETZT).length, 0)
const neu = neueZeilen(`${zeile(1)}\n${zeile(2)}`, `kaputt{\n${bestehend(t1)}`, JETZT)
assert.equal(neu.length, 1)
assert.deepEqual(JSON.parse(neu[0]), { am: '2026-10-26T12:00:00.000Z', quelle: 'bestand-bauen', schwere: 'warnung', text: t2 })
assert.ok(neu[0].endsWith('\n') && !neu[0].slice(0, -1).includes('\n'))
assert.equal(neueZeilen(zeile(1), '', JETZT).length, 1)

// Obergrenze: genau HOECHSTENS bleiben bei HOECHSTENS + 1 Wortlauten, genau HOECHSTENS bei HOECHSTENS.
const viele = (n) => Array.from({ length: n }, (_, i) => zeile(100 + i)).join('\n')
assert.equal(neueZeilen(viele(HOECHSTENS + 1), '', JETZT).length, HOECHSTENS)
assert.equal(neueZeilen(viele(HOECHSTENS), '', JETZT).length, HOECHSTENS)
assert.equal(neueZeilen(viele(1), '', JETZT).length, 1)

// Rückblick: ein Wortlaut weiter zurück als RUECKBLICK Zeilen gilt als neu, einer innerhalb als bekannt.
const fueller = (n) => bestehend(...Array.from({ length: n }, (_, i) => `füller ${i}`))
assert.equal(neueZeilen(zeile(1), bestehend(t1) + fueller(RUECKBLICK - 1), JETZT).length, 0, 'genau RUECKBLICK Zeilen: noch bekannt')
assert.equal(neueZeilen(zeile(1), bestehend(t1) + fueller(RUECKBLICK), JETZT).length, 1, 'eine mehr: nicht mehr im Rückblick')

// Als Prozess: zwei Läufe hintereinander hängen nur einmal an; Datei ohne Zeilenende, fehlende Datei, fehlendes Protokoll, falscher Aufruf.
const wo = mkdtempSync(join(tmpdir(), 'bestand-warnung-melden-'))
try {
  const prot = join(wo, 'pruefung.txt')
  const ziel = join(wo, 'meldungen.jsonl')
  const lauf = (...args) => spawnSync(process.execPath, [SKRIPT, ...args], { encoding: 'utf8', windowsHide: true })
  writeFileSync(prot, `${zeile(7)}\n✓ a\n`)
  const eins = lauf(prot, ziel)
  assert.equal(eins.status, 0)
  assert.ok(existsSync(ziel), 'fehlende Datei wird angelegt')
  const zwei = lauf(prot, ziel)
  assert.equal(zwei.status, 0)
  assert.equal(readFileSync(ziel, 'utf8').split('\n').filter(Boolean).length, 1, 'zweiter Lauf: keine Dublette')
  assert.ok(!zwei.stdout.includes('Posteingang'), 'zweiter Lauf meldet nichts')
  writeFileSync(prot, `${zeile(7)}\n${zeile(8)}\n`)
  writeFileSync(ziel, readFileSync(ziel, 'utf8').trimEnd())
  assert.equal(lauf(prot, ziel).status, 0)
  const zeilen = readFileSync(ziel, 'utf8').split('\n').filter(Boolean)
  assert.equal(zeilen.length, 2, 'ohne Zeilenende: neue Zeile beginnt auf eigener Zeile')
  assert.ok(zeilen.every((z) => JSON.parse(z).schwere === 'warnung'))
  appendFileSync(ziel, 'kaputt{\n')
  writeFileSync(prot, `${zeile(9)}\n`)
  assert.equal(lauf(prot, ziel).status, 0)
  assert.equal(readFileSync(ziel, 'utf8').split('\n').filter(Boolean).length, 4, 'kaputte Zeile bleibt stehen, nichts gelöscht')
  assert.equal(lauf(join(wo, 'gibt-es-nicht.txt'), join(wo, 'neu.jsonl')).status, 0)
  assert.ok(!existsSync(join(wo, 'neu.jsonl')), 'fehlendes Protokoll legt nichts an')
  writeFileSync(prot, '✓ a\n')
  assert.equal(lauf(prot, join(wo, 'leer.jsonl')).status, 0)
  assert.ok(!existsSync(join(wo, 'leer.jsonl')), 'ohne herabgestufte Zeile keine Datei')
  assert.equal(lauf().status, 2)
  assert.equal(main([]), 2)
} finally {
  rmSync(wo, { recursive: true, force: true })
}

console.log('bestand-warnung-melden: ok')
