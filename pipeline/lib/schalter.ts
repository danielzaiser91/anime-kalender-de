/**
 * Schalter der quittierenden Skripte (17.10.2026): Ein unbekanntes Argument bricht ab, ebenso ein Schalter, den npm
 * geschluckt hat. `npm run x --nur-abhaken` (ohne `--`) reicht dem Skript nichts durch, npm legt ihn als
 * `npm_config_nur_abhaken` ab — das Skript liefe still im anderen Zweig (an npm 11.6.2 gemessen).
 */

/** Fehler zu den Argumenten; `erlaubt` sind die Schalter samt `--`. */
export function pruefeSchalter(erlaubt: string[], argv: string[], env: Record<string, string | undefined>): string[] {
  const fehler = argv.filter((a) => !erlaubt.includes(a)).map((a) => `unbekanntes Argument ${a}`)
  for (const s of erlaubt) {
    if (env[`npm_config_${s.slice(2).replaceAll('-', '_')}`] !== undefined) fehler.push(`${s} ging an npm statt ans Skript (npm run … -- ${s})`)
  }
  return fehler
}

/** Bricht mit Exit 1 ab, wenn die Argumente des laufenden Skripts nicht passen. */
export function schalterOderAbbruch(erlaubt: string[]): void {
  const fehler = pruefeSchalter(erlaubt, process.argv.slice(2), process.env)
  if (!fehler.length) return
  for (const f of fehler) console.error(`✖ ${f}`)
  process.exit(1)
}
