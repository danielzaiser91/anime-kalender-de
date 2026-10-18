/**
 * Aufruf: node tools/schwer.mjs <Befehl> [Argumente …] — führt den Befehl aus, sobald kein anderer schwerer Lauf auf dem
 * Rechner läuft (Näheres in `schwerer-lauf.mjs`). Exit-Code ist der des Befehls.
 */
import { spawn, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { vermerkeKind } from './einzel-sperre.mjs'
import { MARKE, SPERRE, wartAufSchwerenLauf } from './schwerer-lauf.mjs'

const WINDOWS = process.platform === 'win32'

/** Beendet das Kind samt Enkeln: Windows `taskkill /T`, sonst die ganze Prozessgruppe (das Kind ist dank `detached` Gruppenführer). */
function beendeBaum(kind) {
  if (WINDOWS) spawnSync('taskkill', ['/T', '/F', '/PID', String(kind.pid)], { stdio: 'ignore', windowsHide: true })
  else process.kill(-kind.pid, 'SIGKILL')
}

/** Startet `befehl` mit der Umgebung `env`, liefert dessen Exit-Code. Hält der Aufruf die Sperre, steht das Kind in der Sperrdatei. */
export function fuehreAus(befehl, env) {
  return new Promise((fertig) => {
    const zeile = befehl.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ') // die Shell bräuchte Anführungszeichen um Pfade mit Leerzeichen
    const kind = spawn(zeile, { stdio: 'inherit', shell: true, env, detached: !WINDOWS, windowsHide: true })
    if (env[MARKE] === String(process.pid)) vermerkeKind(SPERRE, kind.pid)
    // `detached` nur unter POSIX (Windows öffnete ein Konsolenfenster).
    // Endet der Wrapper vorzeitig, stirbt das Kind vor dem Freigeben der Sperre; nach dem normalen Ende wird nichts mehr getötet.
    const beiEnde = () => beendeBaum(kind)
    process.prependListener('exit', beiEnde)
    kind.once('exit', (code) => {
      process.off('exit', beiEnde)
      fertig(code ?? 1)
    })
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
