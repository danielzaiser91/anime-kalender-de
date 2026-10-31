/**
 * Bestandswache: `titelliste-fehlt` in `data/adn-anisearch-offen.json` (ADN-Zuordnung, Wochenlauf). Bewertung in `lib/adn-offen-wache.ts`;
 * Warnung ab 1 Serie (Exit 0, auch bei vielen), rot nur bei fehlender/kaputter Datei oder falscher Anzahl. Test: `check-adn-offen-wache.ts`.
 * Zweite Warnzeile: laufende Serie (Folge in den letzten 14 Tagen) länger als 3 Tage ohne Zuordnung (`lib/adn-offen-seit.ts`, Datum je Serie in `data/adn-offen-seit.json`).
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bewerteOffenDatei } from './lib/adn-offen-wache.ts'
import { laufendOhneZuordnung, type OffeneSerie, type OffenLage, type OffenSeit } from './lib/adn-offen-seit.ts'
import { todayIso } from '../shared/time.ts'

const lies = <T>(datei: string, leer: T): T => (existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as T) : leer)

/** Die Lage aus den Dateien unter `wurzel/data`: erste Sichtung, jüngste Folge je Serie, schon zugeordnete Serien (Cartoons mit `adnId`). */
export function leseOffenLage(wurzel: string, heute: string): OffenLage {
  const letzteFolge = new Map<number, string>()
  for (const name of ['adn-catalog.json', 'adn.json']) {
    const shows = lies<{ shows: { showId: number; episodes: { date?: string }[] }[] }>(`${wurzel}/data/${name}`, { shows: [] }).shows
    for (const s of shows) for (const e of s.episodes) if (e.date && e.date > (letzteFolge.get(s.showId) ?? '')) letzteFolge.set(s.showId, e.date)
  }
  const cartoons = Object.values(lies<Record<string, { adnId?: number }>>(`${wurzel}/data/cartoons.json`, {}))
  return {
    heute,
    seit: lies<OffenSeit>(`${wurzel}/data/adn-offen-seit.json`, {}),
    letzteFolge,
    zugeordnet: new Set(cartoons.map((c) => c.adnId).filter((id): id is number => Boolean(id))),
  }
}

/** Die Zeile zu laufenden Serien ohne Zuordnung, oder `undefined`, wenn es keine gibt. */
export function laufendZeile(offen: OffeneSerie[], lage: OffenLage): string | undefined {
  const liste = laufendOhneZuordnung(offen, lage)
  if (!liste.length) return undefined
  return `  ⚠ WARNUNG ADN laufend ohne Zuordnung: ${liste.map((s) => `${s.title} (${s.showId}, seit ${s.tage} Tagen offen)`).join('; ')} — der Termin fehlt im Kalender`
}

export function main(datei: string, lage?: OffenLage): number {
  const inhalt = existsSync(datei) ? readFileSync(datei, 'utf8') : null
  const w = bewerteOffenDatei(inhalt)
  const marke = { ok: '✓', warnung: '⚠ WARNUNG', rot: '✖' }[w.stufe]
  const zeile = `  ${marke} ADN-Titelliste: ${w.text}`
  if (w.stufe === 'rot') console.error(zeile)
  else console.log(zeile)
  const laufend = w.stufe === 'rot' || !lage ? undefined : laufendZeile((JSON.parse(inhalt!) as { serien: OffeneSerie[] }).serien, lage)
  if (laufend) console.log(laufend)
  if (w.stufe === 'rot') console.error('VERSTÖSSE: 1')
  else console.log('VERSTÖSSE: 0')
  return w.stufe === 'rot' ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  /* Aufruf: [Offen-Datei] [Wurzel mit data/] [heute]; ohne Angaben die Dateien dieses Repos und der heutige Tag. */
  const wurzel = process.argv[3] ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')
  process.exit(main(process.argv[2] ?? `${wurzel}/data/adn-anisearch-offen.json`, leseOffenLage(wurzel, process.argv[4] ?? todayIso())))
}
