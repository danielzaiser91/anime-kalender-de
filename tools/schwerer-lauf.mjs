/**
 * Auf dem Rechner läuft höchstens ein schwerer Lauf (Bau, Playwright-Prüfung) gleichzeitig; weitere warten der Reihe nach
 * (Sperre und Schlange aus `einzel-sperre-schlange.mjs`, Meldung mit PID und Befehl des Halters). Daniels PC blieb sonst bei
 * drei parallelen Agenten unbenutzbar (18.10.2026). In CI und unter einem schon haltenden Elternlauf (`AK_SCHWERER_LAUF`) keine Wirkung.
 */
import { wartAufSperre } from './einzel-sperre-schlange.mjs'

export const SPERRE = 'schwerer-lauf'
export const MARKE = 'AK_SCHWERER_LAUF'

/** Muss die Sperre genommen werden? Nein in CI und wenn ein Elternprozess sie schon hält. */
export const brauchtSperre = (env = process.env) => env.CI !== 'true' && !env[MARKE]

/** Wartet bis zur Reihe und hält dann die Sperre bis Prozessende; liefert die Umgebung für Kindprozesse (mit Marke). */
export async function wartAufSchwerenLauf(wer, env = process.env, warte = wartAufSperre) {
  if (!brauchtSperre(env)) return env
  await warte(SPERRE, undefined, undefined, wer)
  return { ...env, [MARKE]: String(process.pid) }
}
