import { log, readJson } from '../lib/util.ts'
import { type StreamLink, type Title } from '../../shared/types.ts'
import { stripAffiliate } from '../../shared/mappings.ts'
import { wegVerneint } from '../lib/dub-confirmed.ts'
import { gtiAus } from '../lib/amazon-gti.ts'

export type JwKauf = { ohneTreffer?: boolean; angebote?: { anbieter: string; art: string; url?: string; audio?: string[] }[] }

/** Der digitale Amazon-Shop bei JustWatch; „Amazon DVD / Blu-ray" und die Kanäle („… Amazon Channel") sind etwas anderes. */
const AMAZON_VIDEO = /^amazon (prime )?video$/i

/** Titel mit einem belegten Nein bei Prime im Gedächtnis der entfernten Verweise (`data/verweise-entfernt.json`, wie in `11-4-ausgaben.ts`). */
export function primeNeinTitel(datei = 'data/verweise-entfernt.json'): Set<number> {
  const verweise = readJson<{ verweise?: { titleId?: number; plattform?: string; grund?: string }[] }>(datei, {}).verweise ?? []
  return new Set(
    verweise
      .filter((v) => v.plattform === 'primevideo' && /^belegtes Nein/.test(v.grund ?? ''))
      .flatMap((v) => (v.titleId === undefined ? [] : [v.titleId])),
  )
}

/** Amazon-Kennungen (gti), die JustWatch bei mehr als einem Titel führt: sie gehören keinem sicher (`11-4-ausgaben.ts`, gemessen 17.09.2026: 15). */
function geteilteGti(jw: Record<string, JwKauf>): Set<string> {
  const titelJeGti = new Map<string, Set<string>>()
  for (const [id, e] of Object.entries(jw))
    for (const a of e.angebote ?? []) {
      const gti = gtiAus(a.url)
      if (gti) titelJeGti.set(gti, (titelJeGti.get(gti) ?? new Set()).add(id))
    }
  return new Set([...titelJeGti].filter(([, ids]) => ids.size > 1).map(([gti]) => gti))
}

/**
 * **Kauf- und Leihangebot bei Prime Video, auch wenn der Titel schon andere Wege hat.**
 *
 * Die Runde „ohne jeden Weg" legt Kauf-Wege nur an, wo gar nichts steht, und die Abo-Runde nimmt nur Flatrate: ein Film mit einer
 * Blu-ray-Zeile von aniSearch bekam nie seinen Prime-Kauf (All You Need Is Kill, 23.10.2026). Hier kommt der Weg als Stream mit
 * `zugang: 'kauf'` dazu.
 *
 * Riegel: deutscher Ton am Angebot selbst (`audio` mit `de`), kein zweiter Prime-Weg (Abo oder Kauf genügt), kein Titel mit entferntem
 * Prime-Verweis (der Abgang bleibt, wie ihn `11-4-ausgaben.ts` führt), kein Nein-Handbeleg, kein belegtes Nein im Gedächtnis, keine gti, die
 * bei mehreren Titeln steht. Der Weg trägt kein `dub`: JustWatch ist kein Beleg, `11-6-jw-vertrauen.ts` setzt den Umriss „Deutsch laut JustWatch".
 */
export function ergaenzeKaufWege({ titles, jw, handNein, primeNein, tmdbMehrdeutig, toteAdressen }: {
  titles: Map<number, Title>
  jw: Record<string, JwKauf>
  handNein: ReadonlySet<string>
  primeNein: ReadonlySet<number>
  tmdbMehrdeutig: Set<string>
  toteAdressen: Set<string>
}) {
  const geteilt = geteilteGti(jw)
  let ergaenzt = 0
  for (const title of titles.values()) {
    const b = jw[String(title.id)]
    if (!b || b.ohneTreffer || !b.angebote?.length) continue
    if (tmdbMehrdeutig.has(String(title.id)) || primeNein.has(title.id)) continue
    if ((title.streams ?? []).some((s) => s.platform === 'primevideo')) continue
    if ((title.entfernteStreams ?? []).some((s) => s.platform === 'primevideo')) continue
    const a = b.angebote.find(
      (x) =>
        AMAZON_VIDEO.test(x.anbieter) &&
        (x.art === 'BUY' || x.art === 'RENT') &&
        (x.audio ?? []).includes('de') &&
        x.url &&
        !geteilt.has(gtiAus(x.url) ?? '') &&
        !toteAdressen.has(x.url) &&
        !wegVerneint(handNein, title.id, 'primevideo', x.url),
    )
    if (!a?.url) continue
    title.streams = [...(title.streams ?? []), { platform: 'primevideo', url: stripAffiliate(a.url), zugang: 'kauf' } as StreamLink]
    ergaenzt++
  }
  if (ergaenzt) log(`${ergaenzt} Prime-Kauf-/Leihweg(e) aus JustWatch ergänzt (deutsche Tonspur laut JustWatch, ohne eigenes Urteil)`)
}
