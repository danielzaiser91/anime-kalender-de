/**
 * Sperrdatei für Werkzeuge, die nur einmal gleichzeitig laufen dürfen (`bau-vergleich`,
 * `panel-vergleich`): Zwei Läufe teilen sich Worktree-Namen und Ablage und kosten je ein volles
 * `pipeline/build.ts` bzw. `vite build`. Der zweite Aufruf bricht sofort ab (Exit 3) statt zu
 * warten — Bauer-Agenten haben Werkzeug-Fristen, ein Wartender würde dort ohnehin abgeschossen
 * und hielte währenddessen selbst einen Prozess. `bau-vergleich` wartet dagegen bis zu 10 min
 * (`wartAufSperre`), weil dort parallele Bauer sich sonst gegenseitig abweisen.
 *
 * Eine Sperre, deren PID nicht mehr lebt, wird übernommen (mit Meldung). Die Absage nennt, wer die Sperre hält
 * (PID, was läuft, von wo) und seit wann (Uhrzeit und „vor N min“): Prüfer warteten am 12.10.2026 10–15 min, ohne zu wissen, worauf.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

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

/** Vorgabe für „wer läuft“: Skript, Argumente und Arbeitsverzeichnis. */
const standardWer = () => `${basename(process.argv[1] ?? 'node')} ${process.argv.slice(2).join(' ')} in ${process.cwd()}`.replace(/\s+/g, ' ')

const vorMin = (seit) => Math.max(0, Math.round((Date.now() - Date.parse(seit)) / 60_000))

/** Legt die Sperre `<name>` an; `wer` beschreibt den Lauf für Wartende. Liefert null bei Erfolg, sonst den Grund (Text) für die Absage. */
export function nimmSperre(name, wer = standardWer()) {
  const datei = join(tmpdir(), `${name}.sperre`)
  const eigene = JSON.stringify({ pid: process.pid, seit: new Date().toISOString(), wer })
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
      const was = alt.wer ? `, ${alt.wer}` : ''
      return `${name} läuft schon (PID ${alt.pid}, seit ${alt.seit}, vor ${vorMin(alt.seit)} min${was}) — warten oder die Sperre ${datei} nur löschen, wenn der Prozess nicht echt läuft.`
    }
    console.warn(`${name}: verwaiste Sperre${alt ? ` (PID ${alt.pid}, seit ${alt.seit}, tot)` : ' (unlesbar)'} übernommen.`)
    if (JSON.stringify(lies(datei)) === JSON.stringify(alt)) rmSync(datei, { force: true })
  }
  return `${name}: Sperre ${datei} wurde gleichzeitig neu vergeben — später erneut versuchen.`
}

/** Für den Aufruf am Skriptanfang: bei Absage Meldung und Exit 3. */
export function nurEinmalGleichzeitig(name, wer) {
  const grund = nimmSperre(name, wer)
  if (grund) {
    console.error(grund)
    process.exit(3)
  }
}

/**
 * Wie `nurEinmalGleichzeitig`, wartet aber höchstens `maxMs` auf die Freigabe (meldet es einmal und
 * dann jede Minute), bevor es mit Exit 3 abbricht. Für Werkzeuge, bei denen ein Wartender nützlicher
 * ist als ein Abbruch (`bau-vergleich`: Bauer-Läufe sollen sich nicht gegenseitig abweisen).
 */
export async function wartAufSperre(name, maxMs, takt = 5_000, wer) {
  const ende = Date.now() + maxMs
  let naechsteMeldung = 0
  for (;;) {
    const grund = nimmSperre(name, wer)
    if (!grund) return
    if (Date.now() + takt > ende) {
      console.error(`${grund} (nach ${Math.round(maxMs / 60_000)} min Warten aufgegeben)`)
      process.exit(3)
    }
    if (Date.now() >= naechsteMeldung) {
      console.log(`${grund.split(' — ')[0]} — warte bis zu ${Math.round(maxMs / 60_000)} min auf die Freigabe.`)
      naechsteMeldung = Date.now() + 60_000
    }
    await new Promise((fertig) => setTimeout(fertig, takt))
  }
}
