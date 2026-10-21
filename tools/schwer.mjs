/**
 * Aufruf: node tools/schwer.mjs <Befehl> [Argumente …] — führt den Befehl aus, sobald kein anderer schwerer Lauf auf dem
 * Rechner läuft (Näheres in `schwerer-lauf.mjs`). Exit-Code ist der des Befehls.
 */
import { spawn, spawnSync } from 'node:child_process'
import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { vermerkeKind } from './einzel-sperre.mjs'
import { MARKE, SPERRE, wartAufSchwerenLauf } from './schwerer-lauf.mjs'

const WINDOWS = process.platform === 'win32'
// Programm der Shell, die `spawn(…, { shell: true })` startet; unter POSIX nicht vermerkt, weil `sh -c` sich durch den Befehl ersetzen kann.
const SHELL_EXE = WINDOWS ? basename(process.env.comspec || 'cmd.exe').toLowerCase() : undefined

/** Beendet das Kind samt Enkeln: Windows `taskkill /T`, sonst Prozessgruppe (`gruppe`: das Kind ist Gruppenführer) bzw. nur das Kind. */
function beendeBaum(kind, gruppe) {
  if (WINDOWS) return void spawnSync('taskkill', ['/T', '/F', '/PID', String(kind.pid)], { stdio: 'ignore', windowsHide: true })
  try {
    process.kill(gruppe ? -kind.pid : kind.pid, 'SIGKILL')
  } catch {} // schon beendet
}

/** Startet `befehl` mit der Umgebung `env`, liefert dessen Exit-Code. Hält der Aufruf die Sperre, steht das Kind in der Sperrdatei. */
export function fuehreAus(befehl, env) {
  return new Promise((fertig) => {
    const zeile = befehl.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ') // die Shell bräuchte Anführungszeichen um Pfade mit Leerzeichen
    const haeltSperre = env[MARKE] === String(process.pid)
    // Eigene Gruppe nur beim Sperrhalter und nur unter POSIX (Windows öffnete ein Konsolenfenster); ein verschachtelter Wrapper bleibt in der Gruppe des äußeren.
    const gruppe = haeltSperre && !WINDOWS
    const kind = spawn(zeile, { stdio: 'inherit', shell: true, env, detached: gruppe, windowsHide: true })
    if (haeltSperre) vermerkeKind(SPERRE, kind.pid, SHELL_EXE)
    // Endet der Wrapper vorzeitig, stirbt das Kind vor dem Freigeben der Sperre; nach dem normalen Ende wird nichts mehr getötet.
    const beiEnde = () => beendeBaum(kind, gruppe)
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
