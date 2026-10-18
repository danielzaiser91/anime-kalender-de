// Prüft `schwer.mjs` / `schwerer-lauf.mjs` mit echten Prozessen in einem Wegwerf-TEMP: Der zweite Lauf wartet mit Meldung auf den
// ersten und startet erst nach dessen Ende, ein hart beendeter Halter blockiert nicht, Exit-Code und Umgebungsmarke kommen durch,
// und in CI oder unter einem haltenden Elternlauf wird nicht gewartet.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { main } from './schwer.mjs'
import { brauchtSperre, MARKE, SPERRE, wartAufSchwerenLauf } from './schwerer-lauf.mjs'

const SCHWER = join(import.meta.dirname, 'schwer.mjs')
const [modus, text, haltMs] = process.argv.slice(2)

if (modus === 'arbeit') {
  console.log(`an ${text} marke=${process.env[MARKE] ? 'ja' : 'nein'}`)
  setTimeout(() => process.exit(Number(text === 'rot' ? 7 : 0)), Number(haltMs ?? 0))
} else {
  await pruefe()
}

function starte(temp, env, marke, haltMs) {
  const kind = spawn(process.execPath, [SCHWER, process.execPath, import.meta.filename, 'arbeit', marke, haltMs], {
    env: { ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp, CI: 'false', [MARKE]: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const lauf = { kind, aus: '', ende: new Promise((fertig) => kind.once('exit', (code) => fertig(code))) }
  kind.stdout.on('data', (d) => (lauf.aus += d))
  kind.stderr.on('data', (d) => (lauf.aus += d))
  lauf.bis = async (t, ms = 20_000) => {
    const frist = Date.now() + ms
    while (!lauf.aus.includes(t)) {
      assert.ok(Date.now() < frist, `"${t}" nicht erschienen, Ausgabe: ${lauf.aus}`)
      await new Promise((fertig) => setTimeout(fertig, 50))
    }
  }
  return lauf
}

async function pruefe() {
  // Entscheidung: nur ohne CI und ohne Elternmarke
  assert.equal(brauchtSperre({}), true)
  assert.equal(brauchtSperre({ CI: 'true' }), false)
  assert.equal(brauchtSperre({ [MARKE]: '123' }), false)
  assert.equal(brauchtSperre({ CI: 'false' }), true)

  // Aufruf der Warteschlange: Name, Frist-Vorgabe, Beschreibung; Kinder bekommen die Marke
  const aufrufe = []
  let fertigGewartet = false
  const warte = async (...a) => {
    aufrufe.push(a)
    await new Promise((fertig) => setTimeout(fertig, 20))
    fertigGewartet = true
  }
  const env = await wartAufSchwerenLauf('Bau X', { A: '1' }, warte)
  assert.ok(fertigGewartet, 'die Umgebung kommt erst nach dem Warten zurück')
  assert.deepEqual(aufrufe, [[SPERRE, undefined, undefined, 'Bau X']])
  assert.deepEqual(env, { A: '1', [MARKE]: String(process.pid) })
  const ci = await wartAufSchwerenLauf('Bau X', { CI: 'true' }, warte)
  assert.equal(aufrufe.length, 1, 'in CI wird nicht gewartet')
  assert.deepEqual(ci, { CI: 'true' })

  assert.equal(await main([]), 2, 'ohne Befehl: Aufruffehler')

  const temp = mkdtempSync(join(tmpdir(), 'schwer-test-'))
  try {
    // Zweiter wartet mit Meldung (PID, Befehl) und startet erst nach dem Ende des ersten; Exit-Code kommt durch
    const a = starte(temp, {}, 'A', 1500)
    await a.bis('an A marke=ja')
    const b = starte(temp, {}, 'rot', 0)
    await b.bis(`Sperre hält PID`)
    assert.match(b.aus, /schwerer-lauf: Platz 1 von 1/)
    assert.match(b.aus, /arbeit A/, 'Meldung nennt den Befehl des Halters')
    assert.ok(!b.aus.includes('an rot'), 'B darf nicht starten, solange A läuft')
    const aEnde = Date.now()
    assert.equal(await a.ende, 0)
    assert.equal(await b.ende, 7)
    assert.ok(b.aus.includes('an rot') && Date.now() >= aEnde)

    // Hart beendeter Halter: der Wartende übernimmt die verwaiste Sperre
    const c = starte(temp, {}, 'C', 60_000)
    await c.bis('an C')
    const d = starte(temp, {}, 'D', 0)
    await d.bis('Sperre hält PID')
    spawnSync('taskkill', ['/T', '/F', '/PID', String(c.kind.pid)], { stdio: 'ignore' })
    if (process.platform !== 'win32') c.kind.kill('SIGKILL')
    await d.bis('an D')
    assert.equal(await d.ende, 0)

    // CI und Elternmarke: läuft sofort, auch während ein anderer hält
    const e = starte(temp, {}, 'E', 60_000)
    await e.bis('an E')
    const ciLauf = starte(temp, { CI: 'true' }, 'F', 0)
    await ciLauf.bis('an F marke=nein')
    assert.equal(await ciLauf.ende, 0)
    const kind = starte(temp, { [MARKE]: '99' }, 'G', 0)
    await kind.bis('an G marke=ja')
    assert.equal(await kind.ende, 0)
    e.kind.kill()
    spawnSync('taskkill', ['/T', '/F', '/PID', String(e.kind.pid)], { stdio: 'ignore' })
    await e.ende
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
  console.log('schwer.test: ok')
  process.exit(0)
}
