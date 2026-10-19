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
