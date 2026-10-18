/**
 * Aufruf: node tools/schwer.mjs <Befehl> [Argumente …] — führt den Befehl aus, sobald kein anderer schwerer Lauf auf dem
 * Rechner läuft (Näheres in `schwerer-lauf.mjs`). Exit-Code ist der des Befehls.
 */
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { wartAufSchwerenLauf } from './schwerer-lauf.mjs'

/** Startet `befehl` mit der Umgebung `env`, liefert dessen Exit-Code. */
export function fuehreAus(befehl, env) {
  return new Promise((fertig) => {
    const zeile = befehl.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ') // die Shell bräuchte Anführungszeichen um Pfade mit Leerzeichen
    const kind = spawn(zeile, { stdio: 'inherit', shell: true, env })
    kind.once('exit', (code) => fertig(code ?? 1))
  })
}

export async function main(argv) {
  if (!argv.length) {
    console.error('Aufruf: node tools/schwer.mjs <Befehl> [Argumente …]')
    return 2
  }
  const env = await wartAufSchwerenLauf(`${argv.join(' ')} in ${process.cwd()}`)
  return fuehreAus(argv, env)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)))
