import { tageSeit } from './tmdb-ablauf.ts'

/**
 * Titel je Lauf, die Weg 2 und 3 befragen. Je Titel höchstens zwei Abrufe mit 370 ms Wartezeit; bei rund 0,5 s Antwortzeit
 * sind das 500 × 1,4 s ≈ 12 min, dazu Kanalindex und Adressprüfung ≈ 2 min — sicher unter der Schrittfrist von 20 min.
 */
export const RIEGEL_JE_LAUF = 500

/** So lange gilt „kein deutscher Trailer gefunden“, bevor der Titel wieder gefragt wird. */
export const WIEDERVORLAGE_TAGE = 30

/** Nach so vielen Titeln speichert der Lauf (Schrittfrist 20 min: ein Abbruch verliert höchstens so viele). */
export const SPEICHERN_ALLE = 100

/** Titelkennung → Tag der letzten Suche ohne deutschen Fund. */
export type Versuche = Record<string, string>

/**
 * Wer dran ist: nie Gesuchte zuerst, dann die am längsten nicht Gesuchten; ein Stempel unter 30 Tagen schließt aus.
 * `grenze` (> 0) deckelt zusätzlich, wie `--limit`.
 */
export function waehleDran<T extends { id: number }>(
  offen: T[],
  versuche: Versuche,
  heute: string,
  riegel: number,
  grenze: number,
): T[] {
  const jetzt = new Date(heute)
  const faellig = offen.filter((t) => {
    const alter = tageSeit(versuche[String(t.id)], jetzt)
    return alter === undefined || alter >= WIEDERVORLAGE_TAGE
  })
  const geordnet = faellig.sort((a, b) =>
    (versuche[String(a.id)] ?? '').localeCompare(versuche[String(b.id)] ?? ''),
  )
  return geordnet.slice(0, grenze > 0 ? Math.min(grenze, riegel) : riegel)
}

/** Arbeitet `liste` ab und ruft `speichere` nach jedem `alle`-ten Titel und am Ende — ein Abbruch verliert höchstens `alle` Titel. */
export async function arbeiteInStuecken<T>(
  liste: T[],
  je: (t: T) => Promise<void>,
  speichere: () => void,
  alle: number,
): Promise<void> {
  let n = 0
  for (const t of liste) {
    await je(t)
    if (++n % alle === 0) speichere()
  }
  speichere()
}
