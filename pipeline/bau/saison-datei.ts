import { log, readJson, writeJson } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import { istSerie, saisonVon, saisonZeitraum, versetzt } from '../../shared/saison.ts'
import { todayIso } from '../../shared/time.ts'
import { OUT } from './grundlagen.ts'

/**
 * **`saison.json` für den Saison-Überblick** (Daniel, 07.10.2026): der japanische Starttag der Serien im Fenster „letzte bis nächste Saison" (`jp`, nur Hauptbestand —
 * ausgeliefert wird er sonst nicht) und die angekündigten Serien der nächsten Saison, die hinter dem Schalter liegen (`katalog`, ohne Deutsch). Die Ansicht
 * lädt die Datei erst beim Öffnen; sie ist wenige Kilobyte groß, die große Katalogdatei bleibt zu.
 */
export function schreibeSaisonDatei(titles: Map<number, Title>): void {
  const heute = saisonVon(todayIso())
  const [von] = saisonZeitraum(versetzt(heute, -1))
  const [, bis] = saisonZeitraum(versetzt(heute, 1))
  const [naechsteVon] = saisonZeitraum(versetzt(heute, 1))
  const jp: Record<string, string> = {}
  for (const t of titles.values()) if (istSerie(t.format) && t.jpStartTag && t.jpStartTag >= von && t.jpStartTag <= bis) jp[String(t.id)] = t.jpStartTag
  const katalog = readJson<Title[]>(`${OUT}/ohne-synchro.json`, [])
    .filter((t) => istSerie(t.format) && t.jpStart && /^\d{4}-\d{2}-\d{2}$/.test(t.jpStart) && t.jpStart >= naechsteVon && t.jpStart <= bis)
    .map((t) => ({ id: t.id, titleRomaji: t.titleRomaji, titleEn: t.titleEn, titleDe: t.titleDe, coverImage: t.coverImage, episodes: t.episodes, jpStart: t.jpStart! }))
  /* Serien des Fensters, die nicht im Kern-Datensatz stehen (Ankündigung ohne Termin): ohne sie fehlt etwa eine laufende Staffel 2 in der Liste ihrer Saison. */
  const kern = new Set(readJson<{ id: number }[]>(`${OUT}/titles-core.json`, []).map((t) => t.id))
  const ausBestand = [...titles.values()]
    .filter((t) => istSerie(t.format) && t.jpStartTag && t.jpStartTag >= von && t.jpStartTag <= bis && !kern.has(t.id))
    .map((t) => ({ id: t.id, titleRomaji: t.titleRomaji, titleEn: t.titleEn, titleDe: t.titleDe, coverImage: t.coverImage, episodes: t.episodes, jpStart: t.jpStartTag!, jpSeason: t.jpSeason, jpYear: t.jpYear, ...(t.ankuendigung?.synchro === 'angekuendigt' ? { angekuendigt: true } : {}) }))
  writeJson(`${OUT}/saison.json`, { jp, katalog: [...ausBestand, ...katalog] })
  log(`saison.json: ${Object.keys(jp).length} Serien mit Japan-Start, ${katalog.length} angekündigte Katalogtitel der nächsten Saison`)
}
