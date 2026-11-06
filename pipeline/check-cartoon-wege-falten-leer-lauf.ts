/**
 * Prozesstest zur Bestandsprüfung `check-cartoon-wege-falten-bestand.ts` (Prüfer 1579 H7, PR 2926): Fehlt die Cartoon-Datei oder ist sie
 * leer, gibt es nichts zu prüfen und das ist rot, nicht „erfüllt“. Das Skript läuft ganz durch gegen eine `AK_ROOT`-Kulisse.
 * Gegenprobe: ein Bestand mit einem Cartoon ohne Wege bleibt grün.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const pruefung = join(wurzel, 'pipeline', 'check-cartoon-wege-falten-bestand.ts')

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name} ${info}`)
}

/** Läuft die Prüfung in einer Kulisse; `inhalt` undefiniert = Datei fehlt. */
function lauf(inhalt?: string): { status: number | null; ausgabe: string } {
  const kulisse = mkdtempSync(join(tmpdir(), 'ak-falten-leer-'))
  try {
    mkdirSync(join(kulisse, 'public', 'data'), { recursive: true })
    if (inhalt !== undefined) writeFileSync(join(kulisse, 'public', 'data', 'cartoons.json'), inhalt)
    const l = spawnSync(process.execPath, [tsx, pruefung], { cwd: wurzel, encoding: 'utf8', timeout: 120000, env: { ...process.env, AK_ROOT: kulisse } })
    return { status: l.status, ausgabe: `${l.stdout}${l.stderr}` }
  } finally {
    rmSync(kulisse, { recursive: true, force: true })
  }
}

const fehlt = lauf()
pruefe('Datei fehlt: Exit 1 und Grund im Text', fehlt.status === 1 && fehlt.ausgabe.includes('fehlt oder ist leer'), fehlt.ausgabe)
const leer = lauf('[]')
pruefe('leere Liste: Exit 1 und Grund im Text', leer.status === 1 && leer.ausgabe.includes('fehlt oder ist leer'), leer.ausgabe)
const eins = lauf(JSON.stringify([{ id: 1, streams: [] }]))
pruefe('ein Cartoon ohne Wege: Exit 0 (Gegenprobe)', eins.status === 0 && eins.ausgabe.includes('VERSTÖSSE: 0'), eins.ausgabe)

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zur leeren Bestandsprüfung der Cartoon-Wege verletzt`)
  process.exit(1)
}
console.log('Cartoon-Wege falten (leerer Bestand): 3 Fälle erfüllt')
