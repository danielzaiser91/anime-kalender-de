/**
 * Sperrdatei für Werkzeuge, die nur einmal gleichzeitig laufen dürfen (`bau-vergleich`,
 * `panel-vergleich`): Zwei Läufe teilen sich Worktree-Namen und Ablage und kosten je ein volles
 * `pipeline/build.ts` bzw. `vite build`. Der zweite Aufruf bricht sofort ab (Exit 3) statt zu
 * warten — Bauer-Agenten haben Werkzeug-Fristen, ein Wartender würde dort ohnehin abgeschossen
 * und hielte währenddessen selbst einen Prozess.
 *
 * Eine Sperre, deren PID nicht mehr lebt, wird übernommen (mit Meldung).
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const lebt = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM' // lebt, gehört aber einem anderen Benutzer
  }
}

function lies(datei) {
  try {
    return JSON.parse(readFileSync(datei, 'utf8'))
  } catch {
    return null // fehlt oder halb geschrieben
  }
}

/** Legt die Sperre `<name>` an; liefert null bei Erfolg, sonst den Grund (Text) für die Absage. */
export function nimmSperre(name) {
  const datei = join(tmpdir(), `${name}.sperre`)
  const eigene = JSON.stringify({ pid: process.pid, seit: new Date().toISOString() })
  for (let versuch = 0; versuch < 2; versuch++) {
    try {
      writeFileSync(datei, eigene, { flag: 'wx' })
      const freigeben = () => rmSync(datei, { force: true })
      process.on('exit', freigeben)
      process.on('SIGINT', () => process.exit(130))
      process.on('SIGTERM', () => process.exit(143))
      return null
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
    }
    const alt = lies(datei)
    if (alt && lebt(alt.pid)) {
      return `${name} läuft schon (PID ${alt.pid}, seit ${alt.seit}) — warten oder die Sperre ${datei} nur löschen, wenn der Prozess nicht echt läuft.`
    }
    console.warn(`${name}: verwaiste Sperre${alt ? ` (PID ${alt.pid}, seit ${alt.seit}, tot)` : ' (unlesbar)'} übernommen.`)
    if (JSON.stringify(lies(datei)) === JSON.stringify(alt)) rmSync(datei, { force: true })
  }
  return `${name}: Sperre ${datei} wurde gleichzeitig neu vergeben — später erneut versuchen.`
}

/** Für den Aufruf am Skriptanfang: bei Absage Meldung und Exit 3. */
export function nurEinmalGleichzeitig(name) {
  const grund = nimmSperre(name)
  if (grund) {
    console.error(grund)
    process.exit(3)
  }
}
