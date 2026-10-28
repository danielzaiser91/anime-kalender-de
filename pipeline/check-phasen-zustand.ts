/**
 * Zusicherung: **Der Haltepunkt im Bau (`AK_PHASE_ZUSTAND`) zeigt den Zustand einer Phase und beendet den Bau.**
 * Prozesstest: ein Mini-Bau im Wegwerf-Ordner ruft `haltePunkt` wie `build.ts` (zwei Punkte hintereinander).
 * Fälle: ohne Schalter läuft alles durch; Treffer am ersten Punkt endet vor dem zweiten (Exit 0, nur der
 * gewünschte Titel); Treffer am zweiten Punkt zeigt den inzwischen gesetzten Wert; unbekannter Name endet mit Exit 1.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const modul = pathToFileURL(join(import.meta.dirname, 'bau', 'phasen-zustand.ts')).href
const wurzel = mkdtempSync(join(tmpdir(), 'phasen-zustand-'))
const skript = join(wurzel, 'mini-bau.mts')
writeFileSync(
  skript,
  `import { haltePunkt } from '${modul}'
const titles = new Map([[1, { id: 1 }], [2, { id: 2 }]]) as any
haltePunkt('erste', titles)
console.log('zwischen den Punkten')
titles.get(1).episodes = 13
haltePunkt('zweite', titles)
console.log('nach dem letzten Punkt')
`,
)

function fahre(env: Record<string, string>) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript], {
    env: { ...process.env, AK_PHASE_ZUSTAND: '', AK_PHASE_TITEL: '', ...env },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  const zeile = r.stdout.split('\n').find((z) => z.startsWith('AK_PHASE_ZUSTAND '))
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, zustand: zeile ? JSON.parse(zeile.slice(17)) : undefined }
}

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown): void {
  if (!ok) {
    fehler++
    console.error(`✖ ${name}: ${JSON.stringify(info)}`)
  }
}

try {
  const aus = fahre({})
  pruefe('ohne Schalter läuft der Bau durch', aus.status === 0 && aus.stdout.includes('nach dem letzten Punkt') && !aus.zustand, aus)
  const erste = fahre({ AK_PHASE_ZUSTAND: 'erste', AK_PHASE_TITEL: '1' })
  pruefe('Halt am ersten Punkt: Exit 0, Titel 1 ohne episodes, Titel 2 nicht dabei', erste.status === 0 && erste.zustand?.['1']?.episodes === undefined && erste.zustand?.['2'] === undefined && !erste.stdout.includes('zwischen'), erste)
  const zweite = fahre({ AK_PHASE_ZUSTAND: 'zweite', AK_PHASE_TITEL: '1' })
  pruefe('Halt am zweiten Punkt zeigt den gesetzten Wert, Bau endet davor', zweite.status === 0 && zweite.zustand?.['1']?.episodes === 13 && !zweite.stdout.includes('nach dem letzten'), zweite)
  const alle = fahre({ AK_PHASE_ZUSTAND: 'erste' })
  pruefe('ohne AK_PHASE_TITEL kommen alle Titel', alle.status === 0 && Object.keys(alle.zustand ?? {}).join() === '1,2', alle)
  const fehlt = fahre({ AK_PHASE_ZUSTAND: 'gibt-es-nicht', AK_PHASE_TITEL: '1' })
  pruefe('unbekannter Name: Exit 1, Meldung, keine Zustandszeile', fehlt.status === 1 && fehlt.stderr.includes('kein Haltepunkt') && !fehlt.zustand, fehlt)
  const unbekannt = fahre({ AK_PHASE_ZUSTAND: 'erste', AK_PHASE_TITEL: '99' })
  pruefe('unbekannte Titelkennung: null statt Absturz', unbekannt.status === 0 && unbekannt.zustand?.['99'] === null, unbekannt)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) process.exit(1)
console.log('✔ Haltepunkt im Bau: 6 Fälle (aus, erster, zweiter, alle Titel, unbekannter Name, unbekannter Titel)')
