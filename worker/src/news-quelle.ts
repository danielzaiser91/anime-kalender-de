/**
 * **Die Nachrichtenseite für den Worker** (28.09.2026) — eigenes Modul, weil `index.ts` die
 * Dateigrenze reißt.
 *
 * Eine Datei, zwei Abnehmer: die Rubrik „Neuigkeiten" der Newsletter-Mail und die Zeile
 * „jetzt auch bei". Beide brauchen dieselben Einträge; fehlt die Datei, bleibt der Versand wie
 * bisher.
 */
import type { NewsEintrag } from '../../shared/types.ts'
import { anbieterName, type PlatformId } from '../../shared/types.ts'
import type { Env } from './env.ts'

export async function loadNews(env: Env): Promise<NewsEintrag[]> {
  const url = new URL('data/news.json', env.SITE_URL).toString()
  try {
    const res = await fetch(url, { cf: { cacheTtl: 900 } } as RequestInit)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as NewsEintrag[]
  } catch (err) {
    console.error('News nicht abrufbar', err)
    return []
  }
}

/** „Jetzt auch bei X" aus derselben Liste: je Titel und weiterem Anbieter ein Eintrag. */
export function weitereAusNews(eintraege: NewsEintrag[]): { id: number; name: string; anbieter: string; am: string }[] {
  return eintraege.flatMap((e) =>
    e.meldungen
      .filter((m) => m.art === 'neu' && m.weiterer && m.platform)
      .map((m) => ({
        id: m.teilId ?? e.titelId,
        name: m.teil ? `${e.titel} – ${m.teil}` : e.titel,
        anbieter: anbieterName(m.platform as PlatformId),
        am: e.am.slice(0, 10),
      })),
  )
}

/**
 * **Die Neuigkeiten für einen Versand** (28.09.2026): Was seit der letzten Mail an diesen
 * Abonnenten dazukam. Ohne letzten Versand (erste Mail) die letzten Tage — sonst stünden dort alle
 * Einträge. Höchstens fünf, sonst wird die Rubrik zur Liste.
 */
export function newsFuerAbonnent(
  news: NewsEintrag[],
  seit: string | undefined,
  iso: string,
  bis: string,
  frequency: 'daily' | 'weekly',
): NewsEintrag[] {
  const grenze = seit || addTage(iso, frequency === 'daily' ? -2 : -8)
  return news.filter((n) => n.am > grenze && n.am <= bis).slice(0, 5)
}

/** `addDays` aus `shared/time.ts` nachgebildet — hier nur für die ISO-Grenze. */
function addTage(iso: string, tage: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}
