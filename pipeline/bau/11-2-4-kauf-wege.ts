import { log } from '../lib/util.ts'
import { type StreamLink, type Title } from '../../shared/types.ts'
import { stripAffiliate } from '../../shared/mappings.ts'
import { wegVerneint } from '../lib/dub-confirmed.ts'

export type JwKauf = { ohneTreffer?: boolean; angebote?: { anbieter: string; art: string; url?: string; audio?: string[] }[] }

/** Der digitale Amazon-Shop bei JustWatch; „Amazon DVD / Blu-ray" und die Kanäle („… Amazon Channel") sind etwas anderes. */
const AMAZON_VIDEO = /^amazon (prime )?video$/i

/**
 * **Kauf- und Leihangebot bei Prime Video, auch wenn der Titel schon andere Wege hat.**
 *
 * Die Runde „ohne jeden Weg" legt Kauf-Wege nur an, wo gar nichts steht, und die Abo-Runde nimmt nur Flatrate: ein Film mit einer
 * Blu-ray-Zeile von aniSearch bekam nie seinen Prime-Kauf (All You Need Is Kill, 23.10.2026; im Bestand 43 Titel mit deutschem
 * Ton laut JustWatch, 41 davon mit anderen Wegen). Hier kommt der Weg als Stream mit `zugang: 'kauf'` dazu.
 *
 * Drei Riegel: deutscher Ton am Angebot selbst (`audio` mit `de`), kein zweiter Prime-Weg (Abo oder Kauf genügt), kein Nein-Handbeleg.
 * Der Weg trägt kein `dub`: JustWatch ist kein Beleg, `11-6-jw-vertrauen.ts` setzt den Umriss „Deutsch laut JustWatch".
 */
export function ergaenzeKaufWege({ titles, jw, handNein, tmdbMehrdeutig, toteAdressen }: {
  titles: Map<number, Title>
  jw: Record<string, JwKauf>
  handNein: ReadonlySet<string>
  tmdbMehrdeutig: Set<string>
  toteAdressen: Set<string>
}) {
  let ergaenzt = 0
  for (const title of titles.values()) {
    const b = jw[String(title.id)]
    if (!b || b.ohneTreffer || !b.angebote?.length) continue
    if (tmdbMehrdeutig.has(String(title.id))) continue
    if ((title.streams ?? []).some((s) => s.platform === 'primevideo')) continue
    const a = b.angebote.find(
      (x) =>
        AMAZON_VIDEO.test(x.anbieter) &&
        (x.art === 'BUY' || x.art === 'RENT') &&
        (x.audio ?? []).includes('de') &&
        x.url &&
        !toteAdressen.has(x.url) &&
        !wegVerneint(handNein, title.id, 'primevideo', x.url),
    )
    if (!a?.url) continue
    title.streams = [...(title.streams ?? []), { platform: 'primevideo', url: stripAffiliate(a.url), zugang: 'kauf' } as StreamLink]
    ergaenzt++
  }
  if (ergaenzt) log(`${ergaenzt} Prime-Kauf-/Leihweg(e) aus JustWatch ergänzt (deutsche Tonspur laut JustWatch, ohne eigenes Urteil)`)
}
