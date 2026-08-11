/**
 * Holt die deutschen Synchronsprecher zu jedem Titel.
 *
 * „Wer spricht diese Figur auf Deutsch" ist die Frage, die nach dem Termin
 * kommt — und die außer uns niemand neben einem Kalender beantwortet.
 *
 * **Warum AniList:** Die Deutsche Synchronkartei hätte ungleich mehr, untersagt
 * automatisiertes Auslesen aber wörtlich („Insbesondere ist ein automatisiertes
 * Auslesen des Internetangebots nicht gestattet", Stand 11.08.2026).
 * synchrondatenbank.de veröffentlicht frei nur Synchronisationen, die über
 * dreißig Jahre zurückliegen. Bleibt AniList: offene Schnittstelle, ohnehin
 * angebunden, und in der Stichprobe hatten 14 von 18 Titeln deutsche Stimmen.
 *
 * **Warum eine Datei je Titel** (`public/data/voices/<id>.json`): Bei rund
 * zwanzig Rollen je Titel und 2.753 Titeln wären das über 50.000 Einträge — ein
 * Vielfaches des heutigen Datensatzes, für eine Angabe, die man erst sieht,
 * wenn man eine Kachel öffnet **und** den Bereich aufklappt. Im Hauptdatensatz
 * würde sie jeden Besucher etwas kosten, auch die Mehrheit, die nie danach
 * fragt. Siehe ARCHITEKTUR.md, Abschnitt „Ein Datenfeld interessiert nur eine
 * Minderheit".
 *
 * Aufruf: npm run data:voices [-- --limit 400] [-- --force]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { germanVoicesFor, type VoiceRole } from './lib/anilist.ts'
import { log, readJson, warn } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Release, Title } from '../shared/types.ts'

const args = process.argv.slice(2)
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 600
const FORCE = args.includes('--force')

const OUT = 'public/data/voices'

/**
 * Nach wie vielen Tagen ein Titel erneut abgefragt wird.
 *
 * Sprecherlisten wachsen: Bei einer laufenden Serie stehen zum Start oft nur
 * die Hauptrollen fest. Ein halbes Jahr ist der Kompromiss zwischen „immer
 * aktuell" und „nicht dieselbe Antwort zweitausendmal abholen".
 */
const MAX_AGE_TAGE = 180

interface VoiceFile {
  titleId: number
  updatedAt: string
  roles: VoiceRole[]
}

function alter(pfad: string): number {
  try {
    const inhalt = JSON.parse(readFileSync(pfad, 'utf8')) as VoiceFile
    return (Date.now() - new Date(inhalt.updatedAt).getTime()) / 86_400_000
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

async function main(): Promise<void> {
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const releases = readJson<Release[]>('public/data/releases.json', [])
  if (!titles.length) {
    warn('Keine Titel — erst "npm run data:build" laufen lassen.')
    return
  }
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

  // Titel mit Termin zuerst: Das sind die, die gerade jemand aufschlägt.
  const mitTermin = new Set(releases.map((r) => r.titleId))
  const queue = titles
    .filter((t) => {
      if (FORCE) return true
      const pfad = `${OUT}/${t.id}.json`
      return !existsSync(pfad) || alter(pfad) > MAX_AGE_TAGE
    })
    .sort((a, b) => Number(mitTermin.has(b.id)) - Number(mitTermin.has(a.id)))
    .slice(0, LIMIT)

  if (!queue.length) {
    log('Sprecher: nichts nachzuladen.')
    recordSource('anilist-voices', readdirSync(OUT).length)
    return
  }

  log(`Sprecher: ${queue.length} Titel werden abgefragt`)

  let geschrieben = 0
  let leer = 0

  /**
   * In Blöcken abfragen und nach jedem Block schreiben.
   *
   * Ein Lauf über alle Titel dauert Minuten. Würde erst am Ende geschrieben,
   * wäre ein Abbruch kurz davor gleichbedeutend mit hunderten vergeblichen
   * Anfragen — vergeblich für uns und umsonst belastend für die Gegenseite.
   */
  const BLOCK = 100
  for (let i = 0; i < queue.length; i += BLOCK) {
    const block = queue.slice(i, i + BLOCK)
    const gefunden = await germanVoicesFor(block.map((t) => t.id))

    for (const title of block) {
      const rollen = gefunden.get(title.id) ?? []
      // Auch das Nichts festhalten — sonst fragt jeder Lauf dieselben Titel
      // erneut ab, bei denen AniList schlicht keine deutschen Stimmen führt.
      const datei: VoiceFile = {
        titleId: title.id,
        updatedAt: new Date().toISOString(),
        roles: rollen,
      }
      writeFileSync(`${OUT}/${title.id}.json`, JSON.stringify(datei))
      if (rollen.length) geschrieben++
      else leer++
    }
    log(`  ${Math.min(i + BLOCK, queue.length)}/${queue.length} — ${geschrieben} mit Stimmen`)
  }

  const gesamt = readdirSync(OUT).filter((d) => d.endsWith('.json')).length
  recordSource('anilist-voices', geschrieben, geschrieben ? undefined : 'keine Sprecher gefunden')
  log(
    `Sprecher: ${geschrieben} Titel mit deutschen Stimmen, ${leer} ohne — ` +
      `${gesamt} Dateien im Bestand`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
