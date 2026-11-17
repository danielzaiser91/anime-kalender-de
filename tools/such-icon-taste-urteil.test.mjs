import assert from 'node:assert/strict'
import { tasteUrteil } from './such-icon-taste-urteil.mjs'

// Startet der Import den Wächter (Hauptmodul-Erkennung zu weit), endet der Prozess mit exit(0) vor dem Ende dieser Datei: das zählt als rot.
let fertig = false
process.on('exit', () => {
  if (!fertig) process.exitCode = 1
})

const gut = { erreicht: true, taste: 'Enter', ziel: 'feld', escape: false }
assert.equal(tasteUrteil(gut), '')
assert.match(tasteUrteil({ ...gut, erreicht: false }), /Tab erreicht/)
assert.match(tasteUrteil({ ...gut, taste: 'Space', ziel: 'button' }), /^Space fokussiert das Feld nicht \(button\)/)
// Ohne Escape-Fall zählen Escape-Felder nicht
assert.equal(tasteUrteil({ ...gut, nachEscape: 'body', feldNoch: true }), '')
const esc = { ...gut, escape: true, nachEscape: 'Suche öffnen', feldNoch: false }
assert.equal(tasteUrteil(esc), '')
assert.match(tasteUrteil({ ...esc, nachEscape: 'body' }), /Fokus auf body/)
assert.match(tasteUrteil({ ...esc, feldNoch: true }), /Feld bleibt offen/)
// Beide Fehler zugleich: Fokus-Grund zuerst
assert.match(tasteUrteil({ ...esc, nachEscape: 'body', feldNoch: true }), /Fokus auf body/)

// Aufruf-Argumente des Wächters
const { leseArgumente, istHauptmodul } = await import('./ansicht-such-icon-fokus.mjs')
assert.deepEqual(leseArgumente([]), { basis: '', n: 20 })
assert.deepEqual(leseArgumente(['7']), { basis: '', n: 7 })
assert.deepEqual(leseArgumente(['--url', 'https://anime-kalender.de/']), { basis: 'https://anime-kalender.de', n: 20 })
assert.deepEqual(leseArgumente(['5', '--url', 'https://x.test']), { basis: 'https://x.test', n: 5 })
assert.deepEqual(leseArgumente(['--url', 'https://x.test', '5']), { basis: 'https://x.test', n: 5 })
assert.deepEqual(leseArgumente(['--url']), { basis: '', n: 20 })

// „Bin ich das Hauptmodul?“ — der Fehlerfall war der file://-Textvergleich unter Windows (Laufwerksbuchstabe, Leerzeichen)
const datei = process.platform === 'win32' ? 'file:///C:/code/_worktrees/a%20b/tools/x.mjs' : 'file:///opt/a%20b/tools/x.mjs'
const pfad = process.platform === 'win32' ? 'C:\\code\\_worktrees\\a b\\tools\\x.mjs' : '/opt/a b/tools/x.mjs'
assert.equal(istHauptmodul(datei, pfad), true)
assert.equal(istHauptmodul(datei, pfad.replace('x.mjs', 'y.mjs')), false)
assert.equal(istHauptmodul(datei, undefined), false)
fertig = true
console.log('such-icon-taste-urteil: 8 Urteils-, 6 Argument- und 3 Hauptmodul-Fälle ok')
