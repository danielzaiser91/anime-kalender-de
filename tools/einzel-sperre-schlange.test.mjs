// Prüft die Warteschlange mit echten Prozessen: Wartende kommen in der Reihenfolge des Eintreffens dran (auch gegen einen
// Nachzügler), ein hart beendeter Wartender blockiert niemanden und hinterlässt kein Ticket, und die Frist beendet das Warten
// mit Exit 3. Ohne die Schlange (jeder fragt die Sperre ab) wäre die Reihenfolge Zufall und der Abbruch-Test rot.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { nurEinmalGleichzeitig } from './einzel-sperre.mjs'
import { lebendeTickets, wartAufSperre } from './einzel-sperre-schlange.mjs'

const [modus, name, marke, haltMs, maxMs, taktMs] = process.argv.slice(2)

if (modus === 'halte') {
  nurEinmalGleichzeitig(name, 'Halter des Tests')
  console.log('gesperrt')
  setTimeout(() => {}, 60_000) // wird vom Test beendet
} else if (modus === 'warte') {
  await wartAufSperre(name, Number(maxMs ?? 30_000), Number(taktMs ?? 100), `Wartender ${marke}`)
  console.log(`dran ${marke}`)
  setTimeout(() => process.exit(0), Number(haltMs ?? 300))
} else {
  await laufe()
}

/** Startet ein Kind; `bis(text)` wartet, bis der Text in dessen stdout steht. */
function starte(...args) {
  const kind = spawn(process.execPath, [import.meta.filename, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
  const lauf = { kind, aus: '', fehler: '', ende: new Promise((fertig) => kind.once('exit', fertig)) }
  kind.stdout.on('data', (d) => {
    lauf.aus += d
    if (lauf.aus.includes('dran') && !lauf.dranZeit) lauf.dranZeit = performance.now()
  })
  kind.stderr.on('data', (d) => (lauf.fehler += d))
  lauf.bis = async (text, ms = 15_000) => {
    const frist = Date.now() + ms
    while (!lauf.aus.includes(text)) {
      assert.ok(Date.now() < frist, `"${text}" nicht erschienen, Ausgabe: ${lauf.aus} ${lauf.fehler}`)
      await new Promise((fertig) => setTimeout(fertig, 50))
    }
  }
  return lauf
}

function tickets(name) {
  return readdirSync(tmpdir()).filter((f) => f.startsWith(`${name}.warte-`))
}

async function laufe() {
  const name = `schlange-test-${process.pid}`
  const halter = starte('halte', name)
  await halter.bis('gesperrt')

  // Reihenfolge des Eintreffens: A, B, C. Jeder meldet seinen Platz, bevor der nächste startet.
  const a = starte('warte', name, 'A', '300', '30000', '1500')
  await a.bis('Platz 1 von 1')
  const b = starte('warte', name, 'B')
  await b.bis('Platz 2 von 2')
  const c = starte('warte', name, 'C', '300', '30000', '1500')
  await c.bis('Platz 3 von 3')
  assert.match(c.aus, /Sperre hält PID \d+, seit .*Halter des Tests/, 'die Meldung nennt den Halter')

  // B bricht hart ab (kein Aufräumen): C rückt nach, B blockiert nichts und hinterlässt kein Ticket.
  assert.equal(tickets(name).length, 3)
  b.kind.kill('SIGKILL')
  await b.ende
  await c.bis('Platz 2 von 2', 5_000) // Takt 1,5 s: Platzänderung spätestens nach einem Takt plus Prüfzeit sichtbar
  assert.equal(tickets(name).length, 2, 'das Ticket des abgebrochenen Wartenden wird beim nächsten Takt weggeräumt')

  // Ein Nachzügler D überholt niemanden, auch wenn die Sperre gleich frei wird.
  const d = starte('warte', name, 'D', '300', '30000', '10') // pollt 10x so oft wie A und C: ohne Schlange hätte D die Sperre zuerst
  await d.bis('Platz 3 von 3')
  halter.kind.kill('SIGKILL') // hart: die Sperre bleibt als verwaiste Datei liegen und wird übernommen
  await Promise.all([a.ende, c.ende, d.ende])
  const reihenfolge = [['D', d], ['A', a], ['C', c]].sort((x, y) => x[1].dranZeit - y[1].dranZeit).map(([marke]) => marke)
  assert.deepEqual(reihenfolge, ['A', 'C', 'D'], 'dran kommt, wer zuerst eintraf (B fehlt: abgebrochen), nicht wer am häufigsten fragt')
  assert.equal(tickets(name).length, 0, 'nach dem Lauf liegt kein Ticket mehr')

  // Wird ein lebendes Ticket versehentlich weggeräumt, legt der Besitzer es am selben Platz wieder an und wartet nicht bis zur Frist.
  const halter3 = starte('halte', name)
  await halter3.bis('gesperrt')
  const f = starte('warte', name, 'F')
  await f.bis('Platz 1 von 1')
  const [ticketF] = tickets(name)
  rmSync(join(tmpdir(), ticketF))
  const frist = Date.now() + 5_000
  while (tickets(name)[0] !== ticketF && Date.now() < frist) await new Promise((fertig) => setTimeout(fertig, 50))
  assert.deepEqual(tickets(name), [ticketF], 'das gelöschte Ticket ist spätestens nach einem Takt wieder da, mit gleicher Zeit')
  halter3.kind.kill('SIGKILL')
  await f.ende
  assert.match(f.aus, /dran F/, 'F kommt dran, statt bis zur Frist zu warten')

  // Frist: Wer nicht dran kommt, gibt mit Exit 3 und klarer Meldung auf und lässt kein Ticket liegen.
  const halter2 = starte('halte', name)
  await halter2.bis('gesperrt')
  const eilig = starte('warte', name, 'E', '0', '1000')
  assert.equal(await eilig.ende, 3, 'nach Ablauf der Frist Exit 3')
  assert.match(eilig.fehler, /Warten aufgegeben \(Platz 1 von 1; Sperre hält PID \d+/)
  assert.equal(tickets(name).length, 0, 'auch der Abbruch räumt das eigene Ticket weg')
  halter2.kind.kill('SIGKILL')
  await halter2.ende
  rmSync(join(tmpdir(), `${name}.sperre`), { force: true })

  // Aufräumen ohne Wartende: ein Ticket mit toter PID und ein unlesbares verschwinden, ein lebendes bleibt.
  const datei = (nr) => join(tmpdir(), `${name}.warte-00000000000000${nr}-000000000${nr}`)
  const seit = new Date().toISOString()
  writeFileSync(datei(1), JSON.stringify({ pid: halter2.kind.pid, exe: 'node.exe', seit }))
  writeFileSync(datei(2), '{halb')
  writeFileSync(datei(3), JSON.stringify({ pid: process.pid, exe: basename(process.execPath).toLowerCase(), seit }))
  assert.deepEqual(lebendeTickets(name).map((t) => t.pid), [process.pid])
  assert.equal(tickets(name).length, 1)
  rmSync(datei(3), { force: true })
  console.log('einzel-sperre-schlange: ok')
}
