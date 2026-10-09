import { log, readJson, writeJson } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import { istSerie, saisonVon, saisonZeitraum, versetzt, type SaisonTag } from '../../shared/saison.ts'
import { todayIso } from '../../shared/time.ts'
import { OUT, mitAnkuendigung } from './grundlagen.ts'

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
    .map((t) => ({ id: t.id, titleRomaji: t.titleRomaji, titleEn: t.titleEn, titleDe: t.titleDe, coverImage: t.coverImage, episodes: t.episodes, jpStart: t.jpStartTag!, jpSeason: t.jpSeason, jpYear: t.jpYear, ...(mitAnkuendigung(t).ankuendigung?.synchro === 'angekuendigt' ? { angekuendigt: true } : {}) }))
  writeJson(`${OUT}/saison.json`, { jp, katalog: [...ausBestand, ...katalog] })
  log(`saison.json: ${Object.keys(jp).length} Serien mit Japan-Start, ${katalog.length} angekündigte Katalogtitel der nächsten Saison`)
  schreibeAusblickDatei(heute, new Set([...katalog, ...ausBestand].map((k) => k.id)), [...titles.values()].filter((t) => !kern.has(t.id)))
}

/** Der späteste Tag, den ein Japan-Start (`JJJJ`, `JJJJ-MM`, `JJJJ-MM-TT`) noch haben kann. */
const spaetesterTag = (jpStart: string): string => (jpStart.length === 4 ? `${jpStart}-12-31` : jpStart.length === 7 ? `${jpStart}-31` : jpStart)

/**
 * **`saison-ausblick.json`** (Daniel, 09.10.2026): alle Serien ohne Synchro, die nach der laufenden Saison starten — mit Japan-Start so genau, wie AniList ihn kennt
 * (`JJJJ-MM-TT`, `JJJJ-MM`, `JJJJ`), und die ohne jedes Datum. Liegt neben `saison.json`, damit nur der Reiter „Ausblick" die rund 70 KB lädt. Titel, die schon in
 * `saison.json` stehen (Tag in der nächsten Saison), fehlen hier. Dazu die Serien des Hauptbestands, die nicht im Kern stehen (kein Release), mit Jahr und Saison:
 * die Seite rechnet nur auf dem Kern, ohne sie fiele etwa „Devil May Cry: Staffel 2“ (Jahr 2026, keine Saison) aus dem Ausblick.
 */
export function schreibeAusblickDatei(heute: SaisonTag, schonDrin: Set<number>, ausserKern: Title[]): void {
  const [, ende] = saisonZeitraum(heute)
  const katalog = readJson<Title[]>(`${OUT}/ohne-synchro.json`, [])
    .filter((t) => istSerie(t.format) && !schonDrin.has(t.id))
    .filter((t) => (t.jpStart ? /^\d{4}(-\d{2}(-\d{2})?)?$/.test(t.jpStart) && spaetesterTag(t.jpStart) > ende : t.jpStatus === 'NOT_YET_RELEASED'))
    .map((t) => ({ id: t.id, titleRomaji: t.titleRomaji, titleEn: t.titleEn, titleDe: t.titleDe, coverImage: t.jpStart ? t.coverImage : undefined, episodes: t.episodes, jpStart: t.jpStart }))
  const ausBestand = ausserKern
    .filter((t) => istSerie(t.format) && !schonDrin.has(t.id) && t.jpYear && (t.jpSeason ? saisonZeitraum({ jahr: t.jpYear, saison: t.jpSeason as SaisonTag['saison'] })[0] > ende : t.jpYear >= heute.jahr))
    .map((t) => ({ id: t.id, titleRomaji: t.titleRomaji, titleEn: t.titleEn, titleDe: t.titleDe, coverImage: t.coverImage, episodes: t.episodes, jpStart: t.jpStartTag, jpSeason: t.jpSeason, jpYear: t.jpYear, ...(mitAnkuendigung(t).ankuendigung?.synchro === 'angekuendigt' ? { angekuendigt: true } : {}) }))
  writeJson(`${OUT}/saison-ausblick.json`, { katalog: [...ausBestand, ...katalog] })
  log(`saison-ausblick.json: ${katalog.length + ausBestand.length} Serien nach der laufenden Saison (${katalog.filter((k) => !k.jpStart).length} ohne Datum)`)
}
