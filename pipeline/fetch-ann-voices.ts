/**
 * Holt die deutschen Sprechrollen von Anime News Network und führt sie mit den
 * bereits vorhandenen AniList-Rollen zusammen.
 *
 * Das Warum steht in `lib/ann.ts`. Hier steht nur, wie der Lauf sich verhält —
 * und das ist bei einer fremden Schnittstelle mit hartem Limit die eigentliche
 * Arbeit:
 *
 * - **Eine Anfrage pro Sekunde**, wie ANN es vorschreibt. Nicht „ungefähr":
 *   Zwischen zwei Anfragen wird die tatsächlich verstrichene Zeit gemessen und
 *   der Rest abgewartet. Ein Lauf über 2.112 Titel dauert damit rund 35 Minuten,
 *   und das ist der Preis dafür, dass wir dort weiter abrufen dürfen.
 * - **Rohantworten werden archiviert** (`data/ann-raw/<annId>.xml.gz`, rund 8 KB
 *   je Titel). Ein später gebrauchtes Feld ist dann eine Änderung am Parser,
 *   kein zweiter Lauf über 2.112 Seiten — dieselbe Lehre wie bei aniSearch und
 *   ADN, siehe CLAUDE.md „Beim Scrapen nichts wegwerfen".
 * - **Nach jedem Titel wird geschrieben.** Ein Lauf ohne Zwischenstand ist ein
 *   Lauf ohne Netz; beim Crunchyroll-Lauf am 12.08.2026 wären nach einem Abbruch
 *   anderthalb Stunden Fremdlast umsonst gewesen.
 *
 * Aufruf: npm run data:ann:voices [-- --limit 50] [-- --force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync, gunzipSync } from 'node:zlib'
import { annUrl, deutscheRollen, rollenZusammenfuehren, type AnnRolle } from './lib/ann.ts'
import { log, readJson, warn } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Title } from '../shared/types.ts'

const args = process.argv.slice(2)
const zahl = (name: string, fallback: number) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const LIMIT = zahl('--limit', 0)
const FORCE = args.includes('--force')

const VOICES = 'public/data/voices'
const RAW = 'data/ann-raw'
const API = 'https://cdn.animenewsnetwork.com/encyclopedia/api.xml?anime='

/** Eine Sekunde, wie ANN sie verlangt — plus ein Schluck Sicherheitsabstand. */
const ABSTAND_MS = 1100

interface VoiceRole {
  character: string
  actor: string
  role?: string
  /** Woher die Rolle stammt. Fehlt = AniList, so wie vor dem 15.08.2026. */
  von?: 'ann'
}

interface VoiceFile {
  titleId: number
  updatedAt: string
  roles: VoiceRole[]
  /** Adresse des Encyclopedia-Eintrags — ANN verlangt den Link, wo die Daten stehen. */
  annUrl?: string
}

async function main(): Promise<void> {
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const zuordnung = readJson<{ ann?: Record<string, number> }>('data/ann-ids.json', {})
  const ann = zuordnung.ann ?? {}
  if (!Object.keys(ann).length) {
    warn('Keine ANN-Zuordnung — erst "npm run data:ann:ids" laufen lassen.')
    return
  }
  if (!existsSync(RAW)) mkdirSync(RAW, { recursive: true })
  if (!existsSync(VOICES)) mkdirSync(VOICES, { recursive: true })

  /**
   * Die Reihenfolge ist nicht beliebig: Titel **ohne** deutsche Stimmen zuerst.
   * Dort liegt der ganze Gewinn — bei den übrigen bestätigt ANN meist nur, was
   * AniList schon weiß. Bricht der Lauf vorzeitig ab, ist damit das Wertvollste
   * bereits geholt.
   */
  const queue = titles
    .filter((t) => ann[String(t.id)])
    .filter((t) => FORCE || !existsSync(`${RAW}/${ann[String(t.id)]}.xml.gz`))
    .sort((a, b) => Number(Boolean(a.hasVoices)) - Number(Boolean(b.hasVoices)))
  const zuTun = LIMIT > 0 ? queue.slice(0, LIMIT) : queue

  if (!zuTun.length) {
    log('ANN: nichts nachzuladen.')
    return
  }
  log(`ANN: ${zuTun.length} Titel werden abgefragt (~${Math.round((zuTun.length * ABSTAND_MS) / 60000)} min)`)

  let neu = 0
  let ergaenzt = 0
  let ohne = 0
  let letzte = 0

  for (const [i, title] of zuTun.entries()) {
    const annId = ann[String(title.id)]
    const wartezeit = ABSTAND_MS - (Date.now() - letzte)
    if (wartezeit > 0) await new Promise((r) => setTimeout(r, wartezeit))
    letzte = Date.now()

    let xml: string
    const archiv = `${RAW}/${annId}.xml.gz`
    if (!FORCE && existsSync(archiv)) {
      xml = gunzipSync(readFileSync(archiv)).toString('utf8')
    } else {
      try {
        const antwort = await fetch(API + annId, {
          headers: { 'User-Agent': 'anime-kalender.de (nicht-kommerziell, 1 Anfrage/s)' },
        })
        if (!antwort.ok) {
          warn(`ANN ${annId}: HTTP ${antwort.status}`)
          continue
        }
        xml = await antwort.text()
        writeFileSync(archiv, gzipSync(xml))
      } catch (e) {
        warn(`ANN ${annId}: ${String(e).slice(0, 80)}`)
        continue
      }
    }

    const rollen = deutscheRollen(xml)
    if (!rollen.length) {
      ohne++
      continue
    }

    const pfad = `${VOICES}/${title.id}.json`
    const vorher: VoiceFile = existsSync(pfad)
      ? (JSON.parse(readFileSync(pfad, 'utf8')) as VoiceFile)
      : { titleId: title.id, updatedAt: new Date().toISOString(), roles: [] }

    const vorherZahl = vorher.roles.length
    const zusammen = rollenZusammenfuehren<VoiceRole>(
      vorher.roles,
      rollen.map((r: AnnRolle) => ({ ...r, von: 'ann' as const })),
    )
    if (zusammen.length === vorherZahl) continue

    writeFileSync(
      pfad,
      JSON.stringify(
        { ...vorher, updatedAt: new Date().toISOString(), roles: zusammen, annUrl: annUrl(annId) },
        null,
        1,
      ),
    )
    if (vorherZahl === 0) neu++
    else ergaenzt++

    if ((i + 1) % 50 === 0) log(`  ${i + 1}/${zuTun.length} — ${neu} neu, ${ergaenzt} ergänzt, ${ohne} ohne`)
  }

  log(`ANN fertig: ${neu} Titel erstmals mit deutschen Stimmen, ${ergaenzt} ergänzt, ${ohne} ohne deutsche Rollen`)
  recordSource('ann-voices', neu + ergaenzt, neu + ergaenzt ? undefined : 'keine deutschen Rollen gefunden')
}

await main()
