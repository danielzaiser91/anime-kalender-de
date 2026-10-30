/**
 * Mehrere gh-Aufrufe parallel (`tools/wache-weicher-schritt.mjs`): 19 Aufrufe nacheinander kosteten 23 s je Wachphase.
 * Eingabe auf stdin: JSON `[[arg, …], …]`; Ausgabe: JSON `[{ ok: true, aus } | { ok: false, fehler }]` in derselben Reihenfolge.
 * `GH_BEFEHL` ersetzt `gh` (Test).
 */
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const BEFEHL = () => process.env.GH_BEFEHL || 'gh'

/** Ein Aufruf; ein Fehler wird zur Ergebniszeile, nie zur Ausnahme. */
export function einAufruf(befehl, args) {
  return new Promise((fertig) => {
    execFile(befehl, args, { encoding: 'utf8', maxBuffer: 64 << 20, windowsHide: true, timeout: 60_000 }, (fehler, stdout, stderr) => {
      if (!fehler) return fertig({ ok: true, aus: stdout })
      fertig({ ok: false, fehler: String(stderr || fehler.message).trim().split('\n')[0] })
    })
  })
}

export const alleAufrufe = (befehl, liste) => Promise.all(liste.map((args) => einAufruf(befehl, args)))

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const liste = JSON.parse(readFileSync(0, 'utf8'))
  process.stdout.write(JSON.stringify(await alleAufrufe(BEFEHL(), liste)))
}
