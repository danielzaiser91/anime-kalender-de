// Prüft, dass eine Zwischenstand-Zeile Uhrzeit trägt und beim Leser ankommt, während der Prozess noch läuft (nicht erst am
// Ende): Ein Kind schreibt eine Zeile und lebt dann weiter; die Zeile muss spätestens nach 5 s beim Elternprozess stehen.
// Ohne sofortiges Schreiben (Puffer bis zum Ende) wäre der zweite Teil rot.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { logge, zeitzeile } from './bau-vergleich-log.mjs'

if (process.argv[2] === 'kind') {
  logge('Bau A beginnt')
  setTimeout(() => {}, 30_000) // wird vom Test beendet
} else {
  assert.equal(zeitzeile('x', new Date(2026, 9, 13, 7, 5, 9)), '[07:05:09] x')

  const kind = spawn(process.execPath, [import.meta.filename, 'kind'], { stdio: ['ignore', 'pipe', 'inherit'] })
  const aus = await new Promise((fertig, fehl) => {
    const frist = setTimeout(() => fehl(new Error('Zeile nach 5 s nicht angekommen, obwohl der Prozess noch läuft')), 5_000)
    let gelesen = ''
    kind.stdout.on('data', (d) => {
      gelesen += d
      if (gelesen.includes('\n')) {
        clearTimeout(frist)
        fertig(gelesen)
      }
    })
  })
  kind.kill()
  assert.match(aus, /^\[\d\d:\d\d:\d\d\] Bau A beginnt\r?\n$/)
  console.log('bau-vergleich-log: ok')
}
