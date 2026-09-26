import { type Title, type DubConfidence } from '../../shared/types.ts'
import { titleFromMedia, isoDate, isoDatumGenau } from './titel-hilfen.ts'
import { type AniListMedia } from '../lib/anilist.ts'

export function baueTitel({ byMal, confidenceRaw, byAniId }: {
  byMal: Record<string, AniListMedia>
  confidenceRaw: Record<string, DubConfidence>
  byAniId: Record<string, AniListMedia>
}) {
  const titles = new Map<number, Title>()
  /**
   * Beginn der japanischen Ausstrahlung, nur für den Bau.
   *
   * Bewusst **nicht** in `Title`: Das Feld beantwortet genau eine Frage im
   * Build („lief das in Japan schon?") und wäre in `titles.json` bei 2.750
   * Einträgen Ladelast ohne Gegenwert — die Oberfläche zeigt das japanische
   * Startdatum nirgends.
   */
  const jpStart = new Map<number, string>()
  /** Dasselbe, aber nur so genau wie die Quelle — für die Reihenliste im Panel (siehe `isoDatumGenau`). */
  const jpStartAnzeige = new Map<number, string>()

  for (const [malId, media] of Object.entries(byMal)) {
    if (!media?.id) continue
    if (media.isAdult) continue
    const confidence = confidenceRaw[malId] ?? 'low'
    titles.set(media.id, titleFromMedia(media, confidence))
    const start = isoDate(media.startDate)
    if (start) jpStart.set(media.id, start)
    const genau = isoDatumGenau(media.startDate)
    if (genau) jpStartAnzeige.set(media.id, genau)
  }

  // Kuratierte Titel können auf AniList-Einträge zeigen, die nicht über MyDubList kamen.
  for (const media of Object.values(byAniId)) {
    if (!media?.id || titles.has(media.id)) continue
    const confidence = media.idMal ? (confidenceRaw[media.idMal] ?? 'normal') : 'normal'
    titles.set(media.id, titleFromMedia(media, confidence))
    const start = isoDate(media.startDate)
    if (start) jpStart.set(media.id, start)
    const genau = isoDatumGenau(media.startDate)
    if (genau) jpStartAnzeige.set(media.id, genau)
  }
  return { titles, jpStart, jpStartAnzeige }
}
