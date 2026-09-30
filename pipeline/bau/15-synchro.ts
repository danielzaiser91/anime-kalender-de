/**
 * **Die Farbtabelle für die Crunchyroll-Watchlist** (30.09.2026) → `public/data/synchro.json`.
 *
 * Gelesen wird allein unser **bestätigter** Bestand: `data/crunchyroll-dub.json` (deutsche Folgen
 * samt Zeitpunkt). Das Crunchyroll-Wochenprogramm wurde am selben Tag wieder entfernt: Es kündigte
 * für „Meine Wiedergeburt als Schleim in einer anderen Welt" Staffel 4 die deutsche Folge 22 eine
 * Woche zu früh an (25.09. statt 02.10.), und die Erweiterung färbte sie grün. Warum nur Bestätigtes
 * zählt, steht in `shared/synchro.ts`.
 *
 * Die Datei ist als Bau-Ausgabe absichtlich klein (nur Kennungen und Zeitpunkte) — die Auskunft
 * selbst rechnet `farbeFuer()` je Anfrage im Worker.
 */
import { readJson, writeJson, log } from '../lib/util.ts'
import { type SynchroDaten } from '../../shared/synchro.ts'
import { type CrDubData } from '../lib/crunchyroll-dub.ts'
import { OUT } from './grundlagen.ts'

export function schreibeSynchro(): void {
  const dub = readJson<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] })

  const g: SynchroDaten['g'] = {}
  for (const serie of dub.serien ?? []) {
    for (const staffel of serie.staffeln ?? []) {
      for (const folge of staffel.deutscheFolgen ?? []) {
        if (folge.guid) g[folge.guid] = folge.verfuegbarAb ?? ''
      }
    }
  }

  writeJson(`${OUT}/synchro.json`, {
    v: 1,
    erzeugtAm: new Date().toISOString(),
    g,
  } satisfies SynchroDaten)
  log(`synchro.json: ${Object.keys(g).length} bestätigte deutsche Folgen.`)
}
