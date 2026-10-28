/**
 * Zusicherung: **Der Haltepunkt im Bau (`AK_PHASE_ZUSTAND`) zeigt den Zustand einer Phase und beendet den Bau.**
 * Prozesstests: ein Mini-Bau im Wegwerf-Ordner ruft `pruefeSchalter` und `haltePunkt` wie `build.ts`; dazu das echte
 * `build.ts` mit falschem Schalter (endet vor dem Bau); dazu die Namen der `haltePunkt(…)`-Aufrufe in `build.ts` und
 * `09-synchro.ts` gegen die Liste `PHASEN` (Namen hier fest eingetragen, nicht aus dem Modul geholt).
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PHASEN } from './bau/phasen-zustand.ts'

const BAU = join(import.meta.dirname, 'bau')
const modul = pathToFileURL(join(BAU, 'phasen-zustand.ts')).href
const wurzel = mkdtempSync(join(tmpdir(), 'phasen-zustand-'))
const skript = join(wurzel, 'mini-bau.mts')
writeFileSync(
  skript,
  `import { haltePunkt, pruefeSchalter } from '${modul}'
pruefeSchalter()
console.log('Bau beginnt')
const titles = new Map([[1, { id: 1 }], [2, { id: 2 }]]) as any
haltePunkt('02-titel', titles)
console.log('zwischen den Punkten')
titles.get(1).episodes = 13
haltePunkt('08-news-tv', titles)
console.log('nach dem letzten Punkt')
`,
)

const SOLL = ['02-titel', '08-news-tv', '09-3-prime', '09-4-crunchyroll-dub', '09-5-weitere-quellen', '09-6-anisearch-wege', '09-synchro', '10-komplettabwurf', '11-wege-abschluss']

function fahre(datei: string, env: Record<string, string>) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', datei], {
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

/** Namen der `haltePunkt('…', …)`-Aufrufe einer Bau-Datei in Quelltextreihenfolge. */
function aufrufe(datei: string): string[] {
  return [...readFileSync(datei, 'utf8').matchAll(/haltePunkt\('([^']+)'/g)].map((m) => m[1]!)
}

try {
  const aus = fahre(skript, {})
  pruefe('ohne Schalter läuft der Bau durch', aus.status === 0 && aus.stdout.includes('nach dem letzten Punkt') && !aus.zustand, aus)
  const erste = fahre(skript, { AK_PHASE_ZUSTAND: '02-titel', AK_PHASE_TITEL: '1' })
  pruefe('Halt am ersten Punkt: Exit 0, Titel 1 ohne episodes, Titel 2 nicht dabei', erste.status === 0 && erste.zustand?.['1']?.episodes === undefined && erste.zustand?.['2'] === undefined && !erste.stdout.includes('zwischen'), erste)
  pruefe('Halt weist auf das Aufräumen hin', erste.stderr.includes('git restore data public/data && git clean -fdq public/data'), erste)
  const zweite = fahre(skript, { AK_PHASE_ZUSTAND: '08-news-tv', AK_PHASE_TITEL: '1' })
  pruefe('Halt am zweiten Punkt zeigt den gesetzten Wert, Bau endet davor', zweite.status === 0 && zweite.zustand?.['1']?.episodes === 13 && !zweite.stdout.includes('nach dem letzten'), zweite)
  const alle = fahre(skript, { AK_PHASE_ZUSTAND: '02-titel' })
  pruefe('ohne AK_PHASE_TITEL kommen alle Titel', alle.status === 0 && Object.keys(alle.zustand ?? {}).join() === '1,2', alle)
  const unbekannt = fahre(skript, { AK_PHASE_ZUSTAND: '02-titel', AK_PHASE_TITEL: '99' })
  pruefe('unbekannte Titelkennung: null statt Absturz', unbekannt.status === 0 && unbekannt.zustand?.['99'] === null, unbekannt)
  const name = fahre(skript, { AK_PHASE_ZUSTAND: 'gibt-es-nicht' })
  pruefe('unbekannter Name: Exit 1 vor dem Bau, Meldung mit Liste', name.status === 1 && name.stderr.includes('unbekannte Phase') && name.stderr.includes('09-4-crunchyroll-dub') && !name.stdout.includes('Bau beginnt'), name)
  const text = fahre(skript, { AK_PHASE_ZUSTAND: '02-titel', AK_PHASE_TITEL: 'abc' })
  pruefe('nicht numerische Titelkennung: Exit 1 vor dem Bau', text.status === 1 && text.stderr.includes('nur Zahlen') && !text.stdout.includes('Bau beginnt'), text)
  const gemischt = fahre(skript, { AK_PHASE_ZUSTAND: '02-titel', AK_PHASE_TITEL: '1,x' })
  pruefe('eine nicht numerische Kennung in der Liste genügt', gemischt.status === 1, gemischt)
  const echt = fahre(join(import.meta.dirname, 'build.ts'), { AK_PHASE_ZUSTAND: 'x' })
  pruefe('echtes build.ts: falscher Name endet mit Exit 1 vor dem Bau', echt.status === 1 && echt.stderr.includes('unbekannte Phase') && !echt.stdout.includes('[pipeline]'), echt)
  const gefunden = [...aufrufe(join(import.meta.dirname, 'build.ts')), ...aufrufe(join(BAU, '09-synchro.ts'))]
  pruefe('jeder Name der Liste hat genau einen Aufruf, kein Aufruf ohne Namen in der Liste', [...gefunden].sort().join() === [...SOLL].sort().join() && [...PHASEN].sort().join() === [...SOLL].sort().join(), { gefunden, SOLL, PHASEN })
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) process.exit(1)
console.log('✔ Haltepunkt im Bau: 11 Fälle (aus, erster, zweiter, alle Titel, Titel unbekannt, Name falsch, Titel nicht numerisch, Liste mit Fehler, echtes build.ts, Aufräumhinweis, Aufrufe gegen Liste)')
