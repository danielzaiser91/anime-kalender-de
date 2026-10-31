/* Browser-Weiche für Tests, die Playwright starten: Wo kein Browser installiert ist (Deploy-Job), melden sie „übersprungen“.
 * Nur die PR-Prüfkette installiert Chromium und verlangt ihn (GITHUB_WORKFLOW), dort ist Fehlen ein Fehler. */
import { existsSync } from 'node:fs'

export const PFLICHT_WORKFLOW = 'PR-Prüfkette'

/** 'laufen' | 'ueberspringen' | 'fehler' */
export function entscheide(vorhanden, env) {
  if (vorhanden) return 'laufen'
  return env.GITHUB_WORKFLOW === PFLICHT_WORKFLOW ? 'fehler' : 'ueberspringen'
}

/** true, wenn der Test laufen darf; sonst ist die Meldung gedruckt (bei Pflicht zusätzlich exitCode 1). */
export function browserDa(name, chromium, env = process.env) {
  const urteil = entscheide(existsSync(chromium.executablePath()), env)
  if (urteil === 'laufen') return true
  if (urteil === 'fehler') {
    console.error(`${name}: FEHLER (kein Playwright-Browser in der PR-Prüfkette)`)
    process.exitCode = 1
  } else {
    console.log(`${name}: übersprungen (kein Playwright-Browser)`)
  }
  return false
}

/** Quelltext importiert Playwright, aber nicht die Weiche. */
export function weicheFehlt(quelltext) {
  const importiertPlaywright = /\bfrom\s+['"]playwright(-core)?['"]|import\(\s*['"]playwright/.test(quelltext)
  return importiertPlaywright && !/browser-weiche\.mjs['"]/.test(quelltext)
}
