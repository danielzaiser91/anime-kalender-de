/**
 * Wächter: Das Repo ist öffentlich, keine getrackte Datei darf eine @gmail/@googlemail-Adresse tragen
 * (private Adresse des Betreibers; Projektadresse ist kontakt@anime-kalender.de). Textvergleich in `findeAdressen`,
 * Fälle je Form, danach läuft er über alle getrackten Dateien außer node_modules.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MUSTER = /[A-Za-z0-9._%+-]+@(?:gmail|googlemail)\.com/gi

/** Liefert alle Treffer des Musters in `text`. */
export function findeAdressen(text) {
  return text.match(MUSTER) ?? []
}

// Fälle ohne ausgeschriebene Adresse: Teile werden hier zusammengesetzt.
const dom = (d) => `@${d}.com`
assert.equal(findeAdressen(`UA (x.y${dom('gmail')})`).length, 1, 'gmail')
assert.equal(findeAdressen(`to = "abc${dom('googlemail')}"`).length, 1, 'googlemail')
assert.equal(findeAdressen(`ABC${dom('GMail')}`).length, 1, 'Großschreibung')
assert.equal(findeAdressen('kontakt@anime-kalender.de und info@example.org').length, 0, 'Projektadresse ist erlaubt')
assert.equal(findeAdressen('Googlemail-Konto, gmail.com ohne Adresse').length, 0, 'Wort ohne Adresse')

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const dateien = execFileSync('git', ['-C', wurzel, 'ls-files', '-z'], { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 64 << 20 })
  .split('\0')
  .filter((p) => p && !p.startsWith('node_modules/'))
const verletzt = []
for (const p of dateien) {
  let text
  try {
    text = readFileSync(join(wurzel, p), 'utf8')
  } catch {
    continue // gelöscht im Arbeitsbaum oder Verzeichnis (Submodul)
  }
  if (findeAdressen(text).length) verletzt.push(p)
}
assert.deepEqual(verletzt, [], `private Adresse in getrackten Dateien: ${verletzt.join(', ')}`)
console.log(`private-adresse-wache.test: ok (5 Fälle, ${dateien.length} Dateien ohne gmail/googlemail-Adresse)`)
