import { fetchJson, log, readJson, sleep, warn, writeJson } from './util.ts'
import { recordSource } from './health.ts'
import { abrufTag, bilderAbzufragen, FRIST_TAGE, streicheBilderUeberFrist } from './tmdb-ablauf.ts'
import type { TmdbBild } from './tmdb-plakat.ts'
import { BANNER_DATEI, waehleBanner, type TmdbBanner } from './tmdb-banner.ts'

type Zuordnung = Record<string, { tmdbId?: number; kind?: string }>

/**
 * **Das Hintergrundbild je Titel — von TMDB** (Daniel, 11.10.2026: Banner von TMDB statt AniList). Läuft im Plakat-Lauf (`fetch-tmdb-poster.ts`).
 *
 * Die Zuordnung Titel → TMDB-Kennung kommt aus `data/tmdb-titles.json`. Aus `/images` zählt nur ein Querformat ab 1.280 px (`tmdb-banner.ts`).
 * Wo es keins gibt, steht `null`; der Titel kommt auf die Lückenliste (`npm run data:lueckenlisten`). Abgefragt werden Titel ohne Eintrag (mit `alle` alle) und Einträge über 150 Tage (`inhaltAm`, `tmdb-ablauf.ts`).
 */
export async function holeBanner(apiKey: string, limit: number, alle: boolean): Promise<void> {
  const zuordnung = readJson<Zuordnung>('data/tmdb-titles.json', {})
  const bestand = readJson<TmdbBanner>(BANNER_DATEI, {})
  const { offen, entfernt } = bilderAbzufragen(zuordnung, bestand, alle, limit, new Date())
  for (const id of entfernt) delete bestand[id]
  log(`TMDB-Banner: ${offen.length} Titel abzufragen (${Object.keys(bestand).length} schon bekannt, ${entfernt.length} abgelaufene ohne Zuordnung entfernt)`)
  let gefunden = 0
  let fehler = 0
  let abgerufen = 0
  for (const [id, z] of offen) {
    try {
      const bilder = await fetchJson<{ backdrops?: TmdbBild[] }>(
        `https://api.themoviedb.org/3/${z.kind}/${z.tmdbId}/images?include_image_language=ja,null,de,en&api_key=${apiKey}`,
      )
      const wahl = waehleBanner(bilder.backdrops ?? [])
      bestand[id] = wahl ? { p: wahl.file_path, w: wahl.width, h: wahl.height, inhaltAm: abrufTag() } : null
      if (wahl) gefunden++
    } catch (e) {
      /* Eine Kennung, die TMDB nicht mehr kennt, ist kein Ausfall: der Titel hat dort kein Bild. */
      if ((e as Error).message.startsWith('404')) { bestand[id] = null; continue }
      fehler++
      warn(`TMDB-Banner ${id}: ${(e as Error).message.slice(0, 80)}`)
      if (fehler > 20) break
    }
    await sleep(120)
    if (++abgerufen % 200 === 0) writeJson(BANNER_DATEI, bestand)
  }
  const zuAlt = streicheBilderUeberFrist(bestand, new Date())
  if (zuAlt.length) warn(`${zuAlt.length} Hintergrundbilder über ${FRIST_TAGE} Tage, Erneuerung gescheitert: aus dem Bestand genommen`)
  writeJson(BANNER_DATEI, bestand)
  log(`${gefunden} von ${offen.length} Titeln mit Hintergrundbild, ${fehler} Fehler`)
  /* Nichts abzufragen (alle Titel haben einen Eintrag) ist kein Ausfall. */
  recordSource('tmdb-banner', gefunden, fehler ? `${fehler} Fehler` : undefined, undefined, fehler === 0)
}
