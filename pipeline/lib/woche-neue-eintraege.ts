/**
 * Neue Serien aus dem Wochenprogramm (27.10.2026). Der Simulcast-Kalender, der bis 21.10.2026 neue Kalendereinträge
 * (`data/crunchyroll.json`, `german`) anlegte, ist auf `/de/simulcasts` umgeleitet; das Wochenprogramm hängt Folgen
 * nur an vorhandene Einträge. Hier entsteht der Eintrag für eine Serie, die der Bestand noch nicht kennt.
 */
import { normalizeTitle, type CrunchyrollEntry } from './crunchyroll.ts'

/** Die Felder einer Wochenprogramm-Zeile, die der Eintrag braucht (`WochenEintrag` in `scrape-crunchyroll-woche.ts`). */
export interface WochenZeile {
  seriesId: string | null
  titel: string
  sprache: string
  von: number
  bis: number
  datum: string
  zeit: string | null
}

export interface NeueEintraege {
  /** Schlüssel (`normalizeTitle`) → neuer Kalendereintrag. */
  neu: Record<string, CrunchyrollEntry>
  /** Synchro-Zeilen ab heute, die keinen Eintrag bekamen (ohne Kennung, ohne Uhrzeit, Kennung schon vergeben): gezählt, nie still verworfen. */
  verworfen: { titel: string; grund: string }[]
}

function wochentag(isoTag: string): number {
  const [j, m, t] = isoTag.split('-').map(Number)
  return (new Date(Date.UTC(j, m - 1, t)).getUTCDay() + 6) % 7
}

/**
 * Eine Kennung ist ein Franchise: Führt der Kalender sie schon unter anderem Namen (deutscher gegen englischer Titel,
 * andere Staffel), wird nichts angelegt — ein zweiter Eintrag derselben Serie ordnete Folgen willkürlich zu.
 */
export function neueEintraege(zeilen: WochenZeile[], kalender: Record<string, CrunchyrollEntry>, heute: string): NeueEintraege {
  const neu: Record<string, CrunchyrollEntry> = {}
  const verworfen: NeueEintraege['verworfen'] = []
  const vergeben = new Set(Object.values(kalender).map((e) => e.seriesId))
  for (const z of zeilen) {
    if (z.sprache !== 'de' || z.datum < heute) continue
    const key = normalizeTitle(z.titel)
    if (kalender[key]) continue
    if (!z.seriesId) {
      verworfen.push({ titel: z.titel, grund: 'ohne Serienkennung' })
      continue
    }
    if (!z.zeit) {
      verworfen.push({ titel: z.titel, grund: 'ohne Uhrzeit' })
      continue
    }
    if (vergeben.has(z.seriesId) && !neu[key]) {
      verworfen.push({ titel: z.titel, grund: 'Kennung schon unter anderem Namen geführt' })
      continue
    }
    vergeben.add(z.seriesId)
    const eintrag = (neu[key] ??= {
      time: z.zeit,
      weekday: wochentag(z.datum),
      dates: [],
      rawTitle: z.titel,
      seriesId: z.seriesId,
      seriesUrl: `https://www.crunchyroll.com/de/series/${z.seriesId}`,
      observations: [],
      weeklyConfirmed: false,
    })
    if (!eintrag.dates.includes(z.datum)) eintrag.dates.push(z.datum)
    for (let f = z.von; f <= z.bis; f++) eintrag.observations!.push({ date: z.datum, episode: f, quelle: 'woche' })
    eintrag.dates.sort()
    eintrag.earliest = { date: eintrag.dates[0], episode: eintrag.observations!.find((o) => o.date === eintrag.dates[0])?.episode }
  }
  return { neu, verworfen }
}
