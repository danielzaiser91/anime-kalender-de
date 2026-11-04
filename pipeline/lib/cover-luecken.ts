/** Ein Eintrag der Reihen (`franchises.json`: `cover`) oder der Datenbank (`titles.json`, `ohne-synchro.json`: `coverImage`). */
type Eintrag = { id: number; cover?: string; coverImage?: string }

export type CoverLuecken = {
  /** Kennungen mit mindestens einem Eintrag ohne Cover, die nicht auf der Lückenliste stehen. */
  fehlt: number[]
  /** Kennungen auf der Lückenliste, bei denen kein Eintrag mehr ohne Cover ist. */
  veraltet: number[]
}

/** Kennungen mit mindestens einem Reihen- oder Datenbank-Eintrag ohne Cover. Streng je Eintrag: Hat nur die Datenbank das Bild, bleibt die Reihen-Kachel leer. */
export function ohneCover(reihen: Record<string, Eintrag[]>, datenbank: Eintrag[]): Set<number> {
  const ohne = new Set<number>()
  for (const e of [...Object.values(reihen).flat(), ...datenbank]) if (!e.cover && !e.coverImage) ohne.add(e.id)
  return ohne
}

/**
 * Hat jeder Reihen- und Datenbank-Eintrag ein Cover oder steht er auf der Lückenliste (`data/cover-luecken.json`, Kennung → Grund)?
 */
export function pruefeCoverLuecken(reihen: Record<string, Eintrag[]>, datenbank: Eintrag[], luecken: Record<string, string>): CoverLuecken {
  const ohne = ohneCover(reihen, datenbank)
  const fehlt = [...ohne].filter((id) => !(String(id) in luecken))
  const veraltet = Object.keys(luecken).map(Number).filter((id) => !ohne.has(id))
  return { fehlt: fehlt.sort((a, b) => a - b), veraltet: veraltet.sort((a, b) => a - b) }
}
