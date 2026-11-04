/**
 * Joyn-Verweise für Cartoons aus JustWatch (04.11.2026). Bei Anime ergänzt `09-1-belege.ts` sie; die Cartoon-Dateien kannten Joyn nur,
 * wo TMDB den Dienst nennt (35 Cartoons mit JustWatch-Joyn-Angebot hatten keinen Weg). Die Adresse steht bei JustWatch, Joyn selbst
 * wird nie abgerufen (TDM-Vorbehalt). Tonspur und Zugang urteilt das nicht: ein Weg, kein `dub`.
 */
import { plattformVon } from '../lib/cartoons.ts'
import type { Title } from '../../shared/types.ts'

type JwJoyn = Record<string, { angebote?: { anbieter?: string; art?: string; url?: string }[] }>

/** Gibt die Zahl der ergänzten Wege zurück. `tot`: Adressen, die ein Handbeleg als nicht abrufbar führt. */
export function ergaenzeCartoonJoyn(titel: Title[], jw: JwJoyn, tot: Set<string>): number {
  let neu = 0
  for (const t of titel) {
    if (t.streams.some((s) => s.platform === 'joyn')) continue
    const a = (jw[String(t.id)]?.angebote ?? []).find((x) => x.url && plattformVon(x.anbieter ?? '') === 'joyn' && !tot.has(x.url))
    if (!a?.url) continue
    t.streams.push({ platform: 'joyn', url: a.url, ...(a.art === 'ADS' || a.art === 'FREE' ? { zugang: 'kostenlos' as const } : {}) })
    neu++
  }
  return neu
}
