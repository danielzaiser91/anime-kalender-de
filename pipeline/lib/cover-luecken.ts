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

type Hauptzeile = { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string; coverImage?: string }

/**
 * Titel des Hauptbestands (`titles.json`) ohne Cover, die nicht auf der Handliste `data/cover-ohne-bekannt.json` (Kennung → Grund) stehen.
 * Anders als die Lückenliste schreibt diese Liste kein Bau: ein Titel, der sein Cover verliert, fällt hier auf. `veraltet`: Kennung der Handliste mit Cover oder ohne Titel.
 */
export function coverOhneImHauptbestand(haupt: Hauptzeile[], bekannt: Record<string, string>): { fehlt: Hauptzeile[]; veraltet: number[] } {
  const fehlt = haupt.filter((t) => !t.coverImage && !(String(t.id) in bekannt))
  const ohne = new Set(haupt.filter((t) => !t.coverImage).map((t) => t.id))
  return { fehlt, veraltet: Object.keys(bekannt).map(Number).filter((id) => !ohne.has(id)) }
}

const ANISEARCH_AB = 10_000_000

/**
 * Die Lückenliste, wie sie aus dem fertigen Datensatz folgt: jede Kennung ohne Cover, mit dem Grund aus `data/cover-eigen.json` (aniSearch-Kennung = Titelkennung − 10 000 000).
 * Ohne Eintrag dort: aniSearch-only → `nicht-abgerufen`, sonst `ohne-quelle`. Die Ganzzahl-Schlüssel ordnet JavaScript selbst aufsteigend, zwei Läufe ergeben dieselbe Datei.
 */
export function baueCoverLuecken(reihen: Record<string, Eintrag[]>, datenbank: Eintrag[], eigen: Record<string, { grund?: string; datei?: string }>): Record<string, string> {
  const ids = [...ohneCover(reihen, datenbank)]
  const grund = (id: number): string => (id >= ANISEARCH_AB ? (eigen[String(id - ANISEARCH_AB)]?.grund ?? 'nicht-abgerufen') : 'ohne-quelle')
  return Object.fromEntries(ids.map((id) => [String(id), grund(id)]))
}
