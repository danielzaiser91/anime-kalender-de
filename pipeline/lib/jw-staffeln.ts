/**
 * **JustWatch führt Ton und Adresse je Staffel** (gemessen 11.10.2026 an `node(id)` und an `popularTitles`, ohne
 * Zusatzabruf): Niko S1+S2 Prime Deutsch, S3 kein Angebot; Date a Live nur S2/S4 bei Prime und S5 bei Aniverse mit `de`;
 * Vinland Saga S1 Prime nur `ja`, S2 Crunchyroll mit `de`. Der Titelknoten (`audio` am Angebot) sagt nur „irgendwo
 * in der Serie" — daran scheiterte die Vertrauensregel bei Mehrteilern (95,5 %, `lib/jw-vertrauen.ts`).
 *
 * Hier werden die Staffeln nur gesammelt. Eine Regel für Mehrteiler gibt es erst, wenn eine Messung wie im Bericht
 * `daniel-zum-abarbeiten/berichte/justwatch-vertrauen-2026-10-11.md` mindestens 98 % bei n ≥ 50 zeigt.
 */

/** Teil der Suchanfrage (innerhalb des Titelknotens); Filme haben keine Staffeln und bleiben leer. */
export const STAFFELN_ABFRAGE = `
        ... on Show {
          seasons {
            content(country: $country, language: $language) { seasonNumber }
            offers(country: $country, platform: WEB) {
              monetizationType
              audioLanguages
              standardWebURL
              package { clearName }
            }
          }
        }`

export interface StaffelRoh {
  content?: { seasonNumber?: number | null } | null
  offers?:
    | {
        monetizationType: string
        audioLanguages?: string[] | null
        standardWebURL?: string | null
        package?: { clearName?: string } | null
      }[]
    | null
}

export interface Staffel {
  /** Nummer bei JustWatch (nicht unbedingt unsere Staffelzählung). */
  nr: number
  /** Nur Abo, Werbung und gratis; Kauf und Leihe sind für die Tonfrage ohne Belang und würden die Datei aufblähen. */
  angebote: { anbieter: string; art: string; audio: string[]; url?: string }[]
}

const STREAMING = new Set(['FLATRATE', 'ADS', 'FREE'])

/** Die Staffeln einer Serie; `undefined` bei einem Film (kein `seasons` in der Antwort). */
export function staffelnVon(seasons: StaffelRoh[] | null | undefined): Staffel[] | undefined {
  if (!seasons) return undefined
  return seasons.flatMap((s) => {
    const nr = s.content?.seasonNumber
    if (typeof nr !== 'number') return []
    const angebote: Staffel['angebote'] = []
    for (const o of s.offers ?? []) {
      if (!STREAMING.has(o.monetizationType)) continue
      const anbieter = o.package?.clearName ?? '?'
      /* Je Auflösung kommt dasselbe Angebot noch einmal. */
      if (angebote.some((a) => a.anbieter === anbieter && a.art === o.monetizationType)) continue
      angebote.push({ anbieter, art: o.monetizationType, audio: o.audioLanguages ?? [], url: o.standardWebURL ?? undefined })
    }
    return [{ nr, angebote }]
  })
}
