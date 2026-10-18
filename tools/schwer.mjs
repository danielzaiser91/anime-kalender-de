/**
 * Aufruf: node tools/schwer.mjs <Befehl> [Argumente …] — führt den Befehl aus, sobald kein anderer schwerer Lauf auf dem
 * Rechner läuft (Näheres in `schwerer-lauf.mjs`). Exit-Code ist der des Befehls.
 */
import { spawn, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { wartAufSchwerenLauf } from './schwerer-lauf.mjs'

/** Beendet das Kind samt Enkeln (Windows: `taskkill /T`, die Shell ist nur die Wurzel); ein schon beendetes Kind ist harmlos. */
function beendeBaum(kind) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(kind.pid)], { stdio: 'ignore' })
  else kind.kill('SIGKILL')
}

/** Startet `befehl` mit der Umgebung `env`, liefert dessen Exit-Code. */
export function fuehreAus(befehl, env) {
  return new Promise((fertig) => {
    const zeile = befehl.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ') // die Shell bräuchte Anführungszeichen um Pfade mit Leerzeichen
    const kind = spawn(zeile, { stdio: 'inherit', shell: true, env })
    // Endet der Wrapper (SIGINT/SIGTERM über die Schlange, process.exit), darf das Kind nicht ohne Sperre weiterlaufen.
    process.once('exit', () => beendeBaum(kind))
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
