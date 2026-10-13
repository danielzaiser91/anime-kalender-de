/**
 * Unter welchem Buchstaben steht ein Titel im A–Z-Verzeichnis (`/titel/<schluessel>/`)?
 * Umlaute und Akzente zählen als ihr Grundbuchstabe, Ziffern und Sonderzeichen sammelt `0-9`.
 */
export const ZIFFERN = '0-9'

export function verzeichnisSchluessel(name: string): string {
  const erstes = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[a-z0-9]/i)?.[0]
    ?.toLowerCase()
  return erstes && /[a-z]/.test(erstes) ? erstes : ZIFFERN
}

/** Beschriftung in Navigation und Brotkrumen: „A“, „0–9“. */
export function buchstabenLabel(schluessel: string): string {
  return schluessel === ZIFFERN ? '0–9' : schluessel.toUpperCase()
}
