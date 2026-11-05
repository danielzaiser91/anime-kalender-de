/**
 * Zusicherung: ein Abrufausfall (z. B. HTTP 403 vom Runner) heißt in der Quellen-Gesundheit nicht „kein Feed-Eintrag mit Termin“ (05.11.2026).
 * Reine Funktion `leerGrund` und der ganze Lauf von `scrape-anime2you.ts --leicht` gegen eine Kulisse (`AK_ROOT`, Attrappe `tools/anime2you-abruf-mock.mjs`).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { leerGrund } from './lib/anime2you-abruf.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const g1 = leerGrund([], 4)
pruefe('ohne Abruffehler: ruhiger Tag', g1 === 'kein Feed-Eintrag mit Termin', g1)
const g2 = leerGrund(['https://x/feed/: HTTP 403', 'https://x/b/: HTTP 403', 'https://x/c/: HTTP 403', 'https://x/d/: HTTP 403'], 4)
pruefe('alle vier Feeds 403: Ausfall mit Status', g2 === 'Abruf gescheitert (alle Feeds): https://x/feed/: HTTP 403', g2)
const g3 = leerGrund(['https://x/feed/: HTTP 403'], 4)
pruefe('ein Feed von vier: Flaute und Ausfall', g3 === 'kein Eintrag mit Termin; 1 von 4 Feeds gescheitert: https://x/feed/: HTTP 403', g3)

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/anime2you-abruf-mock.mjs')).href

/** Fährt den Sammler (leicht, 4 Feeds) mit der Attrappe im gegebenen Modus; liefert Exit-Code und `lastError`. */
function lauf(modus: string): { status: number | null; fehlertext?: string } {
  const ak = mkdtempSync(join(tmpdir(), 'a2y-abruf-'))
  try {
    mkdirSync(join(ak, 'data/curated'), { recursive: true })
    const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/scrape-anime2you.ts'), '--leicht'], {
      cwd: ak,
      env: { ...process.env, AK_ROOT: ak, AK_A2Y_MODUS: modus, NODE_OPTIONS: `--import ${mock}` },
      encoding: 'utf8',
      timeout: 120_000,
      windowsHide: true,
    })
    const health = JSON.parse(readFileSync(join(ak, 'data/source-health.json'), 'utf8')) as Record<string, { lastError?: string }>
    return { status: r.status, fehlertext: health.anime2you?.lastError }
  } finally {
    rmSync(ak, { recursive: true, force: true })
  }
}

const feed = (pfad: string): string => `https://www.anime2you.de/${pfad}/feed/`
const alle = lauf('alle403')
pruefe('Lauf: alle Feeds 403 → Abrufgrund', alle.status === 0 && alle.fehlertext === `Abruf gescheitert (alle Feeds): ${feed('streaming-news')}: HTTP 403`, alle)
const netz = lauf('netz')
pruefe('Lauf: Netzfehler (catch) → Abrufgrund', netz.status === 0 && netz.fehlertext === `Abruf gescheitert (alle Feeds): ${feed('streaming-news')}: Netz weg`, netz)
const teil = lauf('teil403')
pruefe('Lauf: ein Feed 403 → Flaute und Ausfall', teil.status === 0 && teil.fehlertext === `kein Eintrag mit Termin; 1 von 4 Feeds gescheitert: ${feed('disc-news')}: HTTP 403`, teil)
const artikel = lauf('artikel403')
pruefe('Lauf: Feeds 200, Artikel 403 → Flaute', artikel.status === 0 && artikel.fehlertext === 'kein Feed-Eintrag mit Termin', artikel)

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nAnime2You-Abrufgrund: alle Zusicherungen erfüllt (3 Funktionsfälle, 3 Läufe)')
