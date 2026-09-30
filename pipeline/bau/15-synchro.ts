/**
 * **Die Farbtabelle für die Crunchyroll-Watchlist** (30.09.2026) → `public/data/synchro.json`.
 *
 * Gelesen wird unser Bestand: `data/crunchyroll-dub.json` (bestätigte deutsche Folgen samt
 * Zeitpunkt) und `data/crunchyroll-woche.json` (angekündigte deutsche Slots aus dem
 * Crunchyroll-Wochenprogramm). Warum beides, steht in `shared/synchro.ts`.
 *
 * Die Datei ist als Bau-Ausgabe absichtlich klein (nur Kennungen und Zeitpunkte) — die Auskunft
 * selbst rechnet `farbeFuer()` je Anfrage im Worker.
 */
import { readJson, writeJson, log } from '../lib/util.ts'
import { berlinToUtc } from '../../shared/time.ts'
import { type SynchroDaten } from '../../shared/synchro.ts'
import { type CrDubData } from '../lib/crunchyroll-dub.ts'
import { OUT } from './grundlagen.ts'

/** Ein Eintrag des Crunchyroll-Wochenprogramms, so weit hier gebraucht. */
interface WochenEintrag {
  seriesId?: string
  sprache?: string
  von?: number
  bis?: number
  zeit?: string
  datum?: string
}

export function schreibeSynchro(): void {
  const dub = readJson<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] })
  const woche = readJson<{ eintraege?: WochenEintrag[] }>('data/crunchyroll-woche.json', {})

  const g: SynchroDaten['g'] = {}
  for (const serie of dub.serien ?? []) {
    for (const staffel of serie.staffeln ?? []) {
      for (const folge of staffel.deutscheFolgen ?? []) {
        if (folge.guid) g[folge.guid] = folge.verfuegbarAb ?? ''
      }
    }
  }

  const w: SynchroDaten['w'] = {}
  let angekuendigt = 0
  for (const e of woche.eintraege ?? []) {
    /* Nur deutsche Slots mit Uhrzeit und Datum; alles andere sagt nichts über deutschen Ton. */
    if (e.sprache !== 'de' || !e.seriesId || !e.datum || !e.zeit) continue
    if (e.von === undefined || e.bis === undefined) continue
    const ab = berlinToUtc(e.datum, e.zeit).toISOString()
    ;(w[e.seriesId] ??= []).push({ von: e.von, bis: e.bis, ab })
    angekuendigt++
  }

  writeJson(`${OUT}/synchro.json`, {
    v: 1,
    erzeugtAm: new Date().toISOString(),
    g,
    w,
  } satisfies SynchroDaten)
  log(`synchro.json: ${Object.keys(g).length} bestätigte deutsche Folgen, ${angekuendigt} angekündigte Slots in ${Object.keys(w).length} Serien.`)
}
