import { readJson } from './util.ts'
import { adressGleich, type DubCheck } from './dub-confirmed.ts'

/** Führt ein Handbeleg eines **anderen** Titels diese Adresse auf dieser Plattform? Dann gilt die Meldung nicht ihr. */
export function adresseFremdBelegt(alleChecks: DubCheck[], titleId: number, plattform: string, adresse: string | null): boolean {
  if (!adresse) return false
  return alleChecks.some((c) => c.platform === plattform && c.url && c.anilistId !== titleId && adressGleich(c.url, adresse))
}

/**
 * Verneint ein Handbeleg dieses Titels genau diese Adresse (`available: false` oder `dub: false`)?
 * Wie `check:handbelege`: Es zählt die Adresse jedes Nein-Belegs, nicht nur der zusammengeführte Beleg je Titel und Plattform (`checks`).
 * Bewusst nicht `wegVerneint`: Das sperrt die ganze Plattform und würde 11 Wege entfernen, die der Datensatz heute führt (Messung 19.10.2026).
 */
export function adresseVerneint(alleChecks: DubCheck[], titleId: number, plattform: string, adresse: string | null): boolean {
  if (!adresse) return false
  return alleChecks.some(
    (c) =>
      c.anilistId === titleId && c.platform === plattform && c.url && adressGleich(c.url, adresse) && (c.available === false || c.dub === false),
  )
}

/** Eine von Hand gesperrte Prime-Seite für einen Titel (`data/prime-seiten-von-hand.json`). */
export type SeitenSperre = { titleId: number; seite: string }

/**
 * Sperrt die Meldungsseite dieses Titels? Für Seiten, die sicher nicht zu ihm gehören, ohne dass ein Handbeleg
 * sie einem anderen Titel zuweist (B0GVJFZD1W: Teil von Tokyo Ghoul:re, nicht Staffel 1; welche der beiden, ist offen).
 */
export function seiteGesperrt(sperren: SeitenSperre[], titleId: number, seite: string | null | undefined): boolean {
  return !!seite && sperren.some((s) => s.titleId === titleId && s.seite === seite)
}

/** Der eine Zugang zu `data/prime-zugeordnet.json`: Meldungen ohne die von Hand gesperrten Seiten, für jeden Leser und den Zuordner-Schreibweg. */
export function leseZugeordnet<T extends { titleId: number; seite?: string | null }>(roh?: Record<string, T>): Record<string, T> {
  return Object.fromEntries(ohneGesperrteSeiten(roh ?? readJson<Record<string, T>>('data/prime-zugeordnet.json', {})))
}

/** Die Meldungen aus `prime-zugeordnet.json` ohne die von Hand gesperrten Seiten (`data/prime-seiten-von-hand.json`). */
export function ohneGesperrteSeiten<T extends { titleId: number; seite?: string | null }>(roh: Record<string, T>): [string, T][] {
  const sperren = readJson<SeitenSperre[]>('data/prime-seiten-von-hand.json', [])
  return Object.entries(roh).filter(
    ([schluessel, e]) => !seiteGesperrt(sperren, e.titleId, e.seite) && !seiteGesperrt(sperren, e.titleId, asinAusSchluessel(schluessel)),
  )
}

/** Die Seitenkennung im Schlüssel einer Meldung (`…/B0D188KVH4#4`): auch ein Container, dessen Teilseite anders heißt, ist sperrbar. */
function asinAusSchluessel(schluessel: string): string | undefined {
  return /\/(?:dp|gp\/video\/detail)\/([A-Za-z0-9]{10})/.exec(schluessel)?.[1]
}
