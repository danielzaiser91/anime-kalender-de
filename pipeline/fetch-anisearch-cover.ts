/**
 * Lädt die aniSearch-Cover der Titel, die sonst keines haben, und legt sie als WebP (300 px) unter `cover-ausgabe/anisearch/<Kennung>.webp` ab;
 * `data/cover-eigen.json` hält je aniSearch-Kennung Datei, Größe, Quelle und Stand. Der Ordner `cover-ausgabe/` ist kein Repo-Inhalt: Der Workflow sichert
 * ihn als Actions-Artefakt, das Hochladen nach R2 macht Daniel lokal (Entscheidung 11.10.2026).
 *
 * Nur in Actions, nie von Daniels Rechner. Setzt `data/anisearch-robots.txt` voraus (`fetch-anisearch-robots.ts`) und bricht ab, wenn sie fehlt oder den Pfad sperrt.
 * Ein Bild alle 2 Sekunden, bei 403/423/429 Pause 10/20/40 Minuten statt Abbruch. Aufruf: `npx tsx pipeline/fetch-anisearch-cover.ts [--limit N]` (Standard 400)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { log, readJson, ROOT, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { anisearchToken } from './lib/anisearch-api.ts'
import { coverFrei, robotsAlterMs } from './lib/anisearch-robots.ts'
import { holeCover, offeneKennungen, type Abhaengigkeiten, type Manifest } from './lib/anisearch-cover-eigen.ts'

const MANIFEST = 'data/cover-eigen.json'
const AUSGABE = join(ROOT, 'cover-ausgabe')
const ROBOTS = join(ROOT, 'data/anisearch-robots.txt')
/** Lauf-Obergrenze im Workflow ist 330 Minuten; 300 lässt Raum zum Einreichen. */
const LAUFZEIT_MS = 300 * 60_000

const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 400

type TitelZeile = { id: number; coverImage?: string }

function echteAbhaengigkeiten(): Abhaengigkeiten {
  return {
    abruf: fetch,
    schlafe: sleep,
    jetzt: Date.now,
    wandle: (bild) => sharp(bild).resize({ width: 300, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer(),
    schreibe: (relativ, daten) => {
      const ziel = join(AUSGABE, relativ)
      mkdirSync(dirname(ziel), { recursive: true })
      writeFileSync(ziel, daten)
    },
    sichere: (manifest) => writeJson(MANIFEST, manifest),
  }
}

/** Die robots.txt muss vom selben Lauf stammen (höchstens sechs Stunden alt) und den Pfad freigeben. */
function robotsUrteil(): { frei: boolean; grund: string } {
  if (!existsSync(ROBOTS)) return { frei: false, grund: 'Die Datei anisearch-robots.txt fehlt (erst fetch-anisearch-robots.ts)' }
  const datei = readFileSync(ROBOTS, 'utf8')
  if (robotsAlterMs(datei, Date.now()) > 6 * 3_600_000) return { frei: false, grund: 'Die Datei anisearch-robots.txt ist älter als sechs Stunden (erst fetch-anisearch-robots.ts)' }
  return coverFrei(datei)
}

async function main(): Promise<void> {
  if (!process.env.GITHUB_ACTIONS) {
    warn('aniSearch-Cover: nur in GitHub Actions, nie von diesem Rechner (Daniel, 11.10.2026)')
    process.exit(1)
  }
  const urteil = robotsUrteil()
  if (!urteil.frei) {
    warn(`Cover-Lauf abgebrochen, nichts wird geladen: ${urteil.grund}`)
    process.exit(1)
  }
  const token = anisearchToken()
  if (!token) {
    warn('aniSearch-Cover: kein Token, kein Abruf (Secret ANISEARCH_TOKEN setzen)')
    recordSource('anisearch-cover-eigen', 0, 'kein Token')
    return
  }
  const manifest = readJson<Manifest>(MANIFEST, {})
  const titel = [...readJson<TitelZeile[]>('public/data/titles.json', []), ...readJson<TitelZeile[]>('public/data/ohne-synchro.json', [])]
  const offen = offeneKennungen(titel, manifest)
  log(`aniSearch-Cover: ${offen.length} Titel ohne Cover und ohne Eintrag, ${Math.min(offen.length, LIMIT)} in diesem Lauf`)
  const z = await holeCover(offen, manifest, { limit: LIMIT, token, ende: Date.now() + LAUFZEIT_MS }, echteAbhaengigkeiten())
  log(`${z.neu} Bilder neu, ${z.ohneBild} ohne Bild vermerkt, ${z.fehler} Fehlschläge, ${Object.keys(manifest).length} Einträge im Manifest`)
  if (z.abgebrochen) warn(`Lauf abgebrochen: ${z.abgebrochen}`)
  recordSource('anisearch-cover-eigen', z.neu, z.abgebrochen, undefined, offen.length === 0)
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('fetch-anisearch-cover.ts')) await main()
