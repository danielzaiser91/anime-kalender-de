/**
 * Ablauftests zur Netflix-Umleitung (Ranma ½, 24.10.2026):
 * 1. `fetch-pruefungen.ts` schreibt die Staffelliste einer Meldung von `/title/81301833` unter 81171925 (Wegwerf-Wurzel `AK_ROOT`,
 *    Attrappe `tools/meldung-netflix-umleitung-mock.mjs`), nie unter die Umleitung.
 * 2. `check-netflix-umleitung-bestand.ts` ist rot bei einem Listen-Anfang-Paar derselben Franchise und grün ohne.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/meldung-netflix-umleitung-mock.mjs')).href
const fehler: string[] = []
const tmp = mkdtempSync(join(tmpdir(), 'netflix-umleitung-'))

try {
  const ak = join(tmp, 'ak')
  for (const ordner of ['data/curated', 'public/data', 'extension', 'daniel-zum-abarbeiten']) mkdirSync(join(ak, ordner), { recursive: true })
  writeFileSync(join(ak, 'data/dub-confirmed.yaml'), '# leer\n')
  const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], {
    cwd: wurzel,
    encoding: 'utf8',
    env: { ...process.env, LAUF_TOKEN: 'test', AK_ROOT: ak },
  })
  let listen: Record<string, unknown> = {}
  try {
    listen = JSON.parse(readFileSync(join(ak, 'data/anbieter-staffeln.json'), 'utf8')) as Record<string, unknown>
  } catch {
    fehler.push(`keine anbieter-staffeln.json geschrieben (Exit ${lauf.status}): ${lauf.stderr.slice(-300)}`)
  }
  if (!listen['81171925']) fehler.push(`Meldung der Umleitung fehlt unter 81171925: ${Object.keys(listen).join(',')}`)
  if (listen['81301833']) fehler.push('Meldung der Umleitung steht unter 81301833')

  const fixture = (liste2: number[]) => {
    const titel = join(tmp, 'titles.json')
    const listen2 = join(tmp, 'listen.json')
    const netz = (id: string) => ({ platform: 'netflix', url: `https://www.netflix.com/title/${id}` })
    writeFileSync(titel, JSON.stringify([{ id: 900001, franchiseId: 5, streams: [netz('900011')] }, { id: 900002, franchiseId: 5, streams: [netz('900012')] }]))
    const staffeln = (f: number[]) => ({ staffeln: f.map((folgen, i) => ({ seq: i + 1, folgen })) })
    writeFileSync(listen2, JSON.stringify({ '900011': staffeln([12, 12]), '900012': staffeln(liste2) }))
    return spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-netflix-umleitung-bestand.ts'), titel, listen2], { encoding: 'utf8' })
  }
  const rot = fixture([12, 12, 4])
  if (rot.status !== 1 || !rot.stderr.includes('900011 und 900012')) fehler.push(`Listen-Anfang nicht rot: Exit ${rot.status} ${rot.stderr.slice(0, 200)}`)
  const gruen = fixture([13, 12, 4])
  if (gruen.status !== 0 || !gruen.stdout.includes('keine doppelte Netflix-Kennung')) fehler.push(`Getrennte Listen nicht grün: Exit ${gruen.status} ${gruen.stderr.slice(0, 200)}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`check-netflix-umleitung-ablauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-netflix-umleitung-ablauf: Meldung der Umleitung landet unter der neuen Kennung; Bestandswächter rot beim Listen-Anfang, grün ohne.')
