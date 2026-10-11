/** Kleinbuchstaben, ohne Akzente und Satzzeichen; Kanji und Kana bleiben, damit auch der japanische Titel vergleichbar ist. */
export function normalisiere(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}
