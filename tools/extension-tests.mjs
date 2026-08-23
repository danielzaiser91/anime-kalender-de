/**
 * Lässt alle Zusicherungen der Erweiterung laufen.
 *
 * ## Warum es diesen Läufer braucht
 *
 * Am 23.08.2026 lagen sechs Testdateien unter `extension/` — und keine davon
 * stand in einem npm-Script oder Workflow. Sie waren also genau einmal
 * gelaufen: an dem Tag, an dem sie geschrieben wurden. Danach hätte jede
 * Änderung an der Erweiterung sie brechen können, ohne dass es jemand merkt.
 *
 * Das ist derselbe Fehler, den `CLAUDE.md` für Abrufskripte beschreibt („Ein
 * neuer Abruf braucht drei Dinge, nicht eines"): Ein Prüflauf ohne Platz in
 * einer Kette ist kein Prüflauf, sondern eine einmalige Beobachtung.
 *
 * **Gesucht wird nach Muster, nicht nach Liste.** Eine fest eingetragene
 * Dateiliste hätte denselben Fehler ein zweites Mal erlaubt — wer eine neue
 * Testdatei anlegt und den Eintrag vergisst, steht wieder da, wo wir waren.
 */
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const ordner = join(wurzel, 'extension')

const dateien = readdirSync(ordner)
  .filter((n) => n.endsWith('.test.cjs'))
  .sort()

if (!dateien.length) {
  console.error('Keine Testdatei unter extension/ gefunden — das ist selbst der Fehler.')
  process.exit(1)
}

console.log(`Zusicherungen der Erweiterung — ${dateien.length} Dateien\n`)

const rot = []
for (const datei of dateien) {
  const lauf = spawnSync(process.execPath, [join(ordner, datei)], { encoding: 'utf8' })
  const ausgabe = (lauf.stdout ?? '') + (lauf.stderr ?? '')
  if (lauf.status === 0) {
    const treffer = (ausgabe.match(/✓/g) ?? []).length
    console.log(`  ✓ ${datei} — ${treffer} Zusicherungen`)
  } else {
    rot.push(datei)
    console.error(`  ✗ ${datei}`)
    for (const zeile of ausgabe.split('\n').filter((z) => /✗|Error/.test(z)).slice(0, 6)) {
      console.error(`      ${zeile.trim()}`)
    }
  }
}

console.log()
if (rot.length) {
  console.error(`${rot.length} Datei(en) rot: ${rot.join(', ')}`)
  process.exit(1)
}
console.log('Alle Zusicherungen der Erweiterung erfüllt.')
