// Test für prozess-waechter.js (nur die Drosselung): node ~/.claude/hooks/prozess-waechter-test.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const { verwaistFaellig, befehleFaellig } = createRequire(import.meta.url)('./prozess-waechter.js')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waechter-'))
const stempel = path.join(dir, 'sub', 's.stempel')
const stempelBefehle = path.join(dir, 'sub', 'b.stempel')
const jetzt = Date.now()
const FAELLE = [
  ['ohne Stempel fällig', () => verwaistFaellig(stempel, jetzt), true],
  ['direkt danach nicht fällig', () => verwaistFaellig(stempel, jetzt + 1000), false],
  ['nach 4 min nicht fällig', () => verwaistFaellig(stempel, jetzt + 4 * 60000), false],
  ['nach 6 min fällig', () => verwaistFaellig(stempel, jetzt + 6 * 60000), true],
  // Befehls-Register-Kandidaten (13.10.2026): eigener Stempel, Änderung spätestens nach 5 min sichtbar
  ['Kandidaten: ohne Stempel fällig', () => befehleFaellig(stempelBefehle, jetzt), true],
  ['Kandidaten: unabhängig vom verwaist-Stempel (4 min später)', () => befehleFaellig(stempelBefehle, jetzt + 4 * 60000), false],
  ['Kandidaten: spätestens nach 5 min wieder fällig', () => befehleFaellig(stempelBefehle, jetzt + 5 * 60000 + 1000), true],
]

let fehler = 0
for (const [name, f, soll] of FAELLE) {
  const ist = f()
  if (ist !== soll) fehler++
  console.log(`${ist === soll ? 'ok  ' : 'FEHLER'} ${name} (fällig: ${ist}, erwartet: ${soll})`)
}
fs.rmSync(dir, { recursive: true, force: true })
process.exit(fehler ? 1 : 0)
