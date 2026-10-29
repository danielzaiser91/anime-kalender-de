/**
 * Serienkennung einer Crunchyroll-Adresse: aus der Adresse selbst, sonst aus dem Kennungsgedächtnis
 * (`data/crunchyroll-series-ids.json`). Die alte Slug-Form `/de/<name>` trägt keine Kennung, das Gedächtnis löst sie auf.
 */
export type KennungVon = (url: string) => string | undefined

export type KennungsAdressen = Record<string, { seriesId?: string }>

/** Kennung aus einem `/series/<KENNUNG>`-Pfadteil, gleich welcher Host. */
export function kennungAusPfad(url: string): string | undefined {
  return /\/series\/([A-Z0-9]+)/.exec(url)?.[1]
}

/** Adresse ohne Schema, `www.`, Anhang und Schlussstrich, klein. */
export function adressKern(u: string): string {
  return u.replace(/^https?:\/\//, '').replace(/^www\./, '').split('?')[0]!.replace(/\/$/, '').toLowerCase()
}

/** `ausAdresse` hat Vorrang; nur ohne Treffer zählt der Gedächtniseintrag der Adresse (Einträge ohne Kennung lösen nichts auf). */
export function kennungMitAdressgedaechtnis(adressen: KennungsAdressen, ausAdresse: KennungVon): KennungVon {
  const je = new Map(
    Object.entries(adressen)
      .filter(([, v]) => v.seriesId)
      .map(([u, v]) => [adressKern(u), v.seriesId as string]),
  )
  return (url) => ausAdresse(url) ?? je.get(adressKern(url))
}
