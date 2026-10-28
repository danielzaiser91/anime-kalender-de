import { adressKern } from './dub-confirmed.ts'
import { artDerRohfolge, type UrteilBeobachtung } from './urteil-je-folge.ts'
import type { FolgenZuordnung } from './folgen-je-folge.ts'

export interface RohFolge {
  plattform: string
  url: string
  asin: string | null
  gti: string | null
  sprachen: string | null
  gemeldet_am: string
  vorhanden: string | null
  ton_de: string | null
  /** 1, wenn die Randprobe diese Folge nur angenommen hat (`roh.angenommen`); ältere Worker liefern das Feld nicht. */
  angenommen?: number | null
}

/**
 * Die Rohfolgen als Beobachtungen, über die Zuordnung aus Stufe 2 (`data/folgen-zuordnung.json`).
 * `kanalAdresse`: Adresskerne, die laut Meldung eine Kanal-Seite sind (die Rohfolge trägt den Kanal nicht).
 */
export function beobachtungenAusRohfolgen(
  rohfolgen: RohFolge[],
  zuordnung: Record<string, FolgenZuordnung>,
  kanalAdresse: ReadonlySet<string>,
): UrteilBeobachtung[] {
  const beobachtungen: UrteilBeobachtung[] = []
  for (const f of rohfolgen) {
    const z = zuordnung[`${f.plattform}:${f.asin ?? f.gti}`]
    if (!z?.titel || !z.folge) continue
    /* Eine Rohfolge ohne Tonspuren ist eine Störung, keine Beobachtung (Szenario 10). */
    let sprachen: string[] = []
    try {
      sprachen = JSON.parse(f.sprachen ?? '[]') as string[]
    } catch {
      sprachen = []
    }
    const vorhanden = f.vorhanden ?? (sprachen.length ? 'ja' : null)
    if (!vorhanden) continue
    const tonDe = f.ton_de ?? (sprachen.some((s) => /deutsch|german|^de(\||$)/i.test(s)) ? 'ja' : 'nein')
    beobachtungen.push({
      titel: z.titel,
      anbieter: f.plattform,
      folge: z.folge,
      vorhanden,
      tonDe,
      art: artDerRohfolge(f),
      tag: f.gemeldet_am.slice(0, 10),
      kanal: tonDe === 'nein' && kanalAdresse.has(adressKern(f.url)),
    })
  }
  return beobachtungen
}
