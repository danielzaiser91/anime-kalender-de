import { type DubCheck, dubKey } from '../lib/dub-confirmed.ts'
import { ersetztBeleg } from '../lib/staerkste-seite.ts'
import { readJson } from '../lib/util.ts'

export function checksUndYoutube({ alleChecks }: {
  alleChecks: DubCheck[]
}) {
  const checks = new Map<string, DubCheck>()
  for (const c of alleChecks) {
    const k = dubKey(c.anilistId, c.platform)
    if (ersetztBeleg(checks.get(k), c)) checks.set(k, c)
  }
  /** Befund je YouTube-Adresse aus `pipeline/check-youtube.ts`. */
  const youtubeBefunde = readJson<Record<string, { art: string; inDE: number; unklar?: boolean }>>(
    'data/youtube-check.json',
    {},
  )
  /**
   * Der YouTube-Kanal je Adresse, aus `pipeline/check-youtube.mjs`.
   *
   * Er entscheidet über kostenlos oder Kauf: Was auf „YouTube Movies" liegt,
   * muss bezahlt werden, trägt aber eine ganz gewöhnliche `watch?v=`-Adresse.
   * Die Datei liegt seit dem 22.08.2026 im Repo und wurde nie ausgewertet —
   * 40 Titel standen deshalb als kostenlos, die es nicht sind.
   */
  const ytKanal: Record<string, string> = {}
  /**
   * Adressen mit belegtem Kaufangebot — die Videoseite nennt eine `offerId`.
   *
   * Der Kanalname allein reicht nicht: Bei einem HTTP 401 gibt oEmbed keinen
   * heraus, und genau diese neun Verweise standen bis zum 24.08.2026 als
   * "kostenlos" im Kalender, obwohl sechs davon Geld kosten.
   */
  const ytKauf = new Set<string>()
  return { ytKanal, ytKauf, youtubeBefunde, checks }
}
