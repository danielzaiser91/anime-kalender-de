import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import type { NewsEintrag } from '../../shared/types.ts'

interface CrFolge {
  episode_number?: number
  season_title?: string
  episode_air_date?: string
  versions?: { audio_locale?: string; guid?: string }[]
}

/** Die archivierte Crunchyroll-Antwort einer Serie (`data/crunchyroll-raw/<Serie>.de.json.gz`): Folgen je Staffel samt Tonspuren. */
function liesSerie(serie: string, verzeichnis: string): { holtAm: string; folgen: CrFolge[] } | undefined {
  const pfad = `${verzeichnis}/${serie}.de.json.gz`
  if (!existsSync(pfad)) return undefined
  const roh = JSON.parse(gunzipSync(readFileSync(pfad)).toString('utf8')) as { holtAm?: string; episodes?: Record<string, { items?: CrFolge[] }> }
  if (!roh.holtAm) return undefined
  return { holtAm: roh.holtAm.slice(0, 10), folgen: Object.values(roh.episodes ?? {}).flatMap((s) => s.items ?? []) }
}

/** Eine Serienkennung bündelt alle Staffeln mit Folge 11: Gemeint ist die jüngste, die zum Tag der Meldung schon lief — sonst die jüngste überhaupt. */
function neuesteStaffel(treffer: CrFolge[], tag: string): CrFolge | undefined {
  const nachDatum = (a: CrFolge, b: CrFolge) => (b.episode_air_date ?? '').localeCompare(a.episode_air_date ?? '')
  const sortiert = [...treffer].sort(nachDatum)
  return sortiert.find((f) => (f.episode_air_date ?? '').slice(0, 10) <= tag) ?? sortiert[0]
}

/**
 * **Eigene Messung als Beleg für „Folge N auf Deutsch bei Crunchyroll"** (Daniel, 05.10.2026): Die Serienseite lässt sich nicht fotografieren (Sony-Banner, Nutzungsbedingungen).
 * Stattdessen steht am Beleg, was der Crunchyroll-Katalog an dem Tag, an dem wir ihn geholt haben, zu jeder Folge der Meldung sagte: die deutsche Fassung samt ihrer Kennung.
 * Nur Folgen mit nachgewiesener deutscher Fassung werden aufgeführt — nichts wird behauptet, was die Antwort nicht zeigt.
 */
export function messungenFuerFolgen(eintraege: NewsEintrag[], verzeichnis = 'data/crunchyroll-raw'): NewsEintrag[] {
  const cache = new Map<string, ReturnType<typeof liesSerie>>()
  return eintraege.map((e) => ({
    ...e,
    meldungen: e.meldungen.map((m) => {
      if (m.art !== 'folgen' || m.platform !== 'crunchyroll' || m.von === undefined) return m
      const url = m.belege?.find((b) => /crunchyroll\.com\/.*series\//.test(b.url))?.url
      const serie = url && /series\/([A-Z0-9]+)/.exec(url)?.[1]
      if (!serie || !m.belege) return m
      if (!cache.has(serie)) cache.set(serie, liesSerie(serie, verzeichnis))
      const daten = cache.get(serie)
      if (!daten) return m
      const bis = Math.min(m.bis ?? m.von, m.von + 29)
      const zeilen: string[] = []
      for (let n = m.von; n <= bis; n++) {
        const f = neuesteStaffel(daten.folgen.filter((x) => x.episode_number === n), e.am)
        const de = f?.versions?.find((v) => v.audio_locale === 'de-DE')
        if (f && de?.guid) zeilen.push(`Folge ${n} · ${f.season_title ?? 'Staffel'} · deutsche Fassung vorhanden (${de.guid})`)
      }
      if (!zeilen.length) return m
      return { ...m, belege: m.belege.map((b) => (b.url === url ? { ...b, messung: { am: daten.holtAm, quelle: 'Crunchyroll-Katalog', zeilen } } : b)) }
    }),
  }))
}
