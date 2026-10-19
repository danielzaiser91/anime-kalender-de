// Prüft `schwer.mjs` / `schwerer-lauf.mjs` mit echten Prozessen in einem Wegwerf-TEMP: Der zweite Lauf wartet mit Meldung auf den
// ersten und startet erst nach dessen Ende, ein hart beendeter Halter blockiert nicht, Exit-Code und Umgebungsmarke kommen durch,
// und in CI oder unter einem haltenden Elternlauf wird nicht gewartet.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hatJungeKinder, kindLaeuft, liesSperre, nimmSperre, vermerkeKind } from './einzel-sperre.mjs'
import { fuehreAus, main } from './schwer.mjs'
import { brauchtSperre, MARKE, SPERRE, wartAufSchwerenLauf } from './schwerer-lauf.mjs'

const SCHWER = join(import.meta.dirname, 'schwer.mjs')
const [modus, text, haltMs] = process.argv.slice(2)

if (modus === 'arbeit') {
  console.log(`an ${text} marke=${process.env[MARKE] ? 'ja' : 'nein'} pid=${process.pid}`)
  setTimeout(() => process.exit(Number(text === 'rot' ? 7 : 0)), Number(haltMs ?? 0))
} else if (modus === 'abbruch' || modus === 'aussen') {
  // Wrapper als Sperrhalter, der mitten im Lauf endet (wie SIGTERM über die Schlange): das Kind muss mit ihm sterben,
  // bei „aussen“ über einen verschachtelten Wrapper („innen“) hinweg
  const ziel = modus === 'abbruch' ? ['arbeit', 'ABBR', '60000'] : ['innen']
  const lauf = fuehreAus([process.execPath, import.meta.filename, ...ziel], { ...process.env, [MARKE]: String(process.pid) })
  setTimeout(() => process.exit(0), 3_000)
  await lauf
} else if (modus === 'innen') {
  await fuehreAus([process.execPath, import.meta.filename, 'arbeit', 'ABBR', '60000'], process.env)
} else {
  await pruefe()
}

function starte(temp, env, marke, haltMs) {
  const kind = spawn(process.execPath, [SCHWER, process.execPath, import.meta.filename, 'arbeit', marke, haltMs], {
    env: { ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp, CI: 'false', [MARKE]: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
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

function arbeitPid(lauf) {
  return Number(/pid=(\d+)/.exec(lauf.aus)?.[1])
}

/** Beendet Wrapper und Arbeitsprozess hart, wie ein abgestürzter Lauf samt Kind. */
function toete(lauf) {
  spawnSync('taskkill', ['/T', '/F', '/PID', String(lauf.kind.pid)], { stdio: 'ignore', windowsHide: true })
  for (const pid of [arbeitPid(lauf), lauf.kind.pid]) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {} // ist schon tot
  }
}


/** Entscheidungen und Aufruf der Schlange ohne Prozesse. */
async function pruefeOhneProzesse() {
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
}

/**
 * Wiederverwendete PID: Lebt unter der PID des Kindes ein anderes Programm als vermerkt, ist die Sperre verwaist. Ein eigener
 * Schläfer statt `process.pid`: unter Windows wäre die WMI-Abfrage selbst ein junges Kind des Testprozesses.
 */
function pruefeKindExe(lege, datei) {
  const schlaefer = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore', windowsHide: true })
  try {
    const name = process.platform === 'win32' ? 'node.exe' : 'node'
    lege(schlaefer.pid, name)
    assert.match(nimmSperre('kind-test') ?? '', /läuft schon/, 'Kind lebt mit vermerktem Programm: Sperre gilt')
    lege(schlaefer.pid, 'cmd.exe')
    assert.equal(nimmSperre('kind-test'), null, 'unter der PID läuft ein anderes Programm: Sperre wird übernommen')
    rmSync(datei, { force: true })
  } finally {
    schlaefer.kill('SIGKILL')
  }
}

/** Kinder einer toten Shell (WMI-Ausgabe eingespeist): nur nach Sperrbeginn gestartete zählen, Fehler zählt als nein. */
function pruefeJungeKinder() {
  const seit = '2026-10-18T17:00:00.000Z' // 19:00 Ortszeit bei +120
  const aus = (...zeilen) => () => zeilen.join('\r\n')
  assert.equal(hatJungeKinder(1, seit, aus('368 20261018185959.999999+120')), false, 'vor Sperrbeginn: früherer Träger der PID')
  assert.equal(hatJungeKinder(1, seit, aus('368 20261018185959.999999+120', '900 20261018190000.000000+120', '')), true)
  assert.equal(hatJungeKinder(1, seit, aus('900 20261018170000.000000+000')), true, 'Versatz wird abgezogen')
  assert.equal(hatJungeKinder(1, seit, aus('900 20261018190000.000000-120')), true, 'negativer Versatz')
  assert.equal(hatJungeKinder(1, seit, aus('900 20261018200000+120', '')), false, 'fremdes Format zählt nicht')
  assert.equal(hatJungeKinder(1, seit, aus('900 20261018200000+120', '901 20261018200000.000000+120')), true, 'fremde Zeile bricht nicht ab')
  assert.equal(hatJungeKinder(1, seit, aus('')), false, 'keine Kinder')
  assert.equal(hatJungeKinder(1, seit, () => { throw new Error('cscript fehlt') }), false, 'Abfragefehler zählt als nein')
  const gefragt = []
  const frage = (pid) => {
    gefragt.push(pid)
    return '900 20261018190000.000000+120'
  }
  const TOT = 2_000_000_000
  assert.equal(kindLaeuft({ pid: TOT, seit, kind: TOT }, frage), process.platform === 'win32', 'tote Shell, lebendes Kind: nur Windows fragt nach')
  assert.deepEqual(gefragt, process.platform === 'win32' ? [TOT] : [])
  assert.equal(kindLaeuft({ pid: TOT, seit }, frage), false, 'ohne vermerktes Kind')
}

/** Das Kind in der Sperrdatei: lebt es, gilt die Sperre trotz totem Halter; fremde Sperren werden nicht beschrieben. */
function pruefeKindInSperre() {
  const temp = mkdtempSync(join(tmpdir(), 'schwer-kind-'))
  const alt = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR }
  Object.assign(process.env, { TEMP: temp, TMP: temp, TMPDIR: temp })
  try {
    const datei = join(temp, 'kind-test.sperre')
    const TOT = 2_000_000_000 // keine gültige PID
    const lege = (kind, kindExe) => writeFileSync(datei, JSON.stringify({ pid: TOT, exe: 'node.exe', seit: new Date().toISOString(), kind, kindExe }))
    lege(process.pid)
    assert.match(nimmSperre('kind-test') ?? '', /läuft schon/, 'Halter tot, Kind lebt: Sperre gilt')
    lege(TOT)
    assert.equal(nimmSperre('kind-test'), null, 'Halter und Kind tot: Sperre wird übernommen')
    vermerkeKind('kind-test', 4242, 'cmd.exe')
    assert.equal(liesSperre('kind-test').kind, 4242, 'eigene Sperre bekommt das Kind')
    assert.equal(liesSperre('kind-test').kindExe, 'cmd.exe', 'samt Programmname')
    pruefeKindExe(lege, datei)
    lege(undefined)
    vermerkeKind('kind-test', 4242)
    assert.equal(liesSperre('kind-test').kind, undefined, 'fremde Sperre bleibt unverändert')
  } finally {
    for (const [k, v] of Object.entries(alt)) v === undefined ? delete process.env[k] : (process.env[k] = v)
  }
  rmSync(temp, { recursive: true, force: true })
}

/** Zweiter wartet mit Meldung (PID, Befehl) und startet erst nach dem Ende des ersten; Exit-Code kommt durch. */
async function pruefeWarten(temp) {
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
}

/** Halter samt Kind hart beendet: der Wartende übernimmt die verwaiste Sperre. */
async function pruefeVerwaist(temp) {
  const c = starte(temp, {}, 'C', 60_000)
  await c.bis('an C')
  const d = starte(temp, {}, 'D', 0)
  await d.bis('Sperre hält PID')
  toete(c)
  await d.bis('an D')
  assert.equal(await d.ende, 0)
}

/** Halter hart ohne Baum beendet, Kind lebt: die Sperre gilt weiter, der Wartende startet erst nach dem Ende des Kindes. */
async function pruefeKindLebt(temp) {
  // Unter Windows stirbt dabei die Shell mit dem Wrapper (libuv-Job); die Sperre muss über deren noch lebendes Kind halten.
  const h = starte(temp, {}, 'H', 60_000)
  await h.bis('an H')
  const sperre = JSON.parse(readFileSync(join(temp, `${SPERRE}.sperre`), 'utf8'))
  assert.equal(sperre.kindExe, process.platform === 'win32' ? 'cmd.exe' : undefined, 'Programm der Shell steht in der Sperre')
  h.kind.kill('SIGKILL')
  await h.ende
  const i = starte(temp, {}, 'I', 0)
  await i.bis('Sperre hält PID')
  await new Promise((fertig) => setTimeout(fertig, 2_500))
  assert.ok(!i.aus.includes('an I'), 'I darf nicht starten, solange das Kind des toten Halters lebt')
  process.kill(arbeitPid(h), 'SIGKILL')
  await i.bis('an I')
  assert.equal(await i.ende, 0)
}

/** Abbruch des Wrappers: das Enkelkind (arbeit) darf nicht weiterlaufen, sonst läuft es ohne Sperre. */
async function pruefeAbbruch(modus) {
  const ab = spawn(process.execPath, [import.meta.filename, modus], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true })
  let abAus = ''
  ab.stdout.on('data', (d) => (abAus += d))
  await new Promise((fertig) => ab.once('exit', fertig))
  const enkel = Number(/pid=(\d+)/.exec(abAus)?.[1])
  assert.ok(enkel > 0, `Enkel-PID fehlt: ${abAus}`)
  await new Promise((fertig) => setTimeout(fertig, 500))
  assert.throws(() => process.kill(enkel, 0), 'Kind lebt nach Ende des Wrappers weiter')
}

/** CI und Elternmarke: läuft sofort, auch während ein anderer hält. */
async function pruefeUmgehung(temp) {
  const e = starte(temp, {}, 'E', 60_000)
  await e.bis('an E')
  const ciLauf = starte(temp, { CI: 'true' }, 'F', 0)
  await ciLauf.bis('an F marke=nein')
  assert.equal(await ciLauf.ende, 0)
  const kind = starte(temp, { [MARKE]: '99' }, 'G', 0)
  await kind.bis('an G marke=ja')
  assert.equal(await kind.ende, 0)
  toete(e)
  await e.ende
}

async function pruefe() {
  await pruefeOhneProzesse()
  pruefeKindInSperre()
  pruefeJungeKinder()
  const temp = mkdtempSync(join(tmpdir(), 'schwer-test-'))
  try {
    await pruefeWarten(temp)
    await pruefeVerwaist(temp)
    await pruefeKindLebt(temp)
    await pruefeAbbruch('abbruch')
    await pruefeAbbruch('aussen')
    await pruefeUmgehung(temp)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
  console.log('schwer.test: ok')
  process.exit(0)
}
