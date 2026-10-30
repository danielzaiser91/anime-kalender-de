/** Prozesstest zu `check-folgen-nummern-bestand.ts`: der Wächter läuft als eigener Prozess in einem Wegwerf-Ordner mit Folgenlisten. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const WAECHTER = new URL('./check-folgen-nummern-bestand.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

function lauf(listen: Record<string, [number, string][]>) {
  const wurzel = mkdtempSync(join(tmpdir(), 'folgen-nummern-'))
  try {
    const ordner = join(wurzel, 'public', 'data', 'folgen')
    mkdirSync(ordner, { recursive: true })
    /* Füllung über der Untergrenze, damit nur die Fälle entscheiden. */
    for (let i = 1; i <= 1000; i++) writeFileSync(join(ordner, `${900000 + i}.json`), JSON.stringify({ f: [[1, 'a'], [2, 'b']], de: [] }))
    for (const [id, f] of Object.entries(listen)) writeFileSync(join(ordner, `${id}.json`), JSON.stringify({ f, de: [] }))
    try {
      const out = execFileSync(process.execPath, [WAECHTER], { cwd: wurzel, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 60000 })
      return { code: 0, out, err: '' }
    } catch (e) {
      const x = e as { status: number; stdout: string; stderr: string }
      return { code: x.status, out: x.stdout, err: x.stderr }
    }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const sauber = lauf({ 800001: [[1, 'a'], [2, 'b']] })
assert.equal(sauber.code, 0, sauber.err)
assert.match(sauber.out, /check-folgen-nummern-bestand: ok \(1001 Folgenlisten/)

const doppelt = lauf({ 800002: [[1, 'a'], [2, 'b'], [2, 'c']] })
assert.equal(doppelt.code, 1)
assert.match(doppelt.err, /FEHLER: 800002: Nummer 2 steht mehrfach/)
assert.match(doppelt.out, /VERSTÖSSE: 1/)

const echt = lauf({ 131586: [[10, 'a'], [10, 'b']], 151126: [[13, 'a'], [13, 'b']] })
assert.equal(echt.code, 0, echt.err)

const falscheNummer = lauf({ 131586: [[11, 'a'], [11, 'b']] })
assert.equal(falscheNummer.code, 1)
assert.match(falscheNummer.err, /FEHLER: 131586: Nummer 11/)

const leer = (() => {
  const wurzel = mkdtempSync(join(tmpdir(), 'folgen-nummern-'))
  try {
    mkdirSync(join(wurzel, 'public', 'data', 'folgen'), { recursive: true })
    try {
      execFileSync(process.execPath, [WAECHTER], { cwd: wurzel, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 60000 })
      return { code: 0, err: '' }
    } catch (e) {
      const x = e as { status: number; stderr: string }
      return { code: x.status, err: x.stderr }
    }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
})()
assert.equal(leer.code, 1)
assert.match(leer.err, /der Wächter misst nichts/)

console.log('check-folgen-nummern-lauf: ok (sauber, doppelt, vermerkte echte Doppelung, falsche Nummer, leerer Ordner)')
