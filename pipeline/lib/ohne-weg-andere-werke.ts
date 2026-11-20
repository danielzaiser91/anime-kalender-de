/**
 * **Verworfene Namenstreffer** (19.11.2026, `data/jw-namenstreffer-andere-werke.json`): Findet JustWatch unter unserem Namen nur ein anderes Werk (`namenTreffer.gleicherName`,
 * Film statt Serie, anderes Jahr), von Hand als „anderes Werk“ belegt, gilt der Befund wie `ohneTreffer` ohne Namensvetter (Grund `kein-angebot` bzw. `nur-disc`).
 * Der Eintrag gilt nur für genau diesen Kandidaten (`jwId`); nennt der nächste Abruf einen anderen, ist der Titel wieder `offen` und wird neu geprüft.
 */
import type { JwBefund } from './jw-vertrauen.ts'
import { readJson } from './util.ts'

export interface AndereWerke {
  anilistId: number
  /** JustWatch-Kennung des verworfenen Kandidaten (`namenTreffer.jwId`). */
  jwId: string
  jwPfad: string
  /** Woran das andere Werk erkannt ist (unser Format/Jahr gegen Art/Jahr des Kandidaten). */
  grund: string
  geprueftAm: string
}

/** Die Handliste; liegt hier und nicht im Bauschritt, weil `check-workflows` jedes `data/…`-Literal in einer schreibenden Datei als Schreibziel zählt. */
export const ladeAndereWerke = (): AndereWerke[] => readJson('data/jw-namenstreffer-andere-werke.json', [])

/** Eine Kopie des Bestands, in der die verworfenen Namenstreffer fehlen; der Bestand selbst bleibt unverändert. */
export function ohneAndereWerke(justwatch: Record<string, JwBefund>, liste: readonly AndereWerke[]): Record<string, JwBefund> {
  const aus = { ...justwatch }
  for (const e of liste) {
    const b = aus[String(e.anilistId)]
    if (b?.ohneTreffer && b.namenTreffer?.jwId === e.jwId) {
      const { namenTreffer: _verworfen, ...rest } = b
      aus[String(e.anilistId)] = rest
    } else if (b && !b.ohneTreffer && b.jwId === e.jwId) {
      /* Der alte Befund trägt das andere Werk selbst (Negi: JustWatch 16950 statt TMDB 8859, bis der nächste Abruf ihn ersetzt); sein Prüftag bleibt. */
      aus[String(e.anilistId)] = { geprueftAm: b.geprueftAm, angebote: [], ohneTreffer: true }
    }
  }
  return aus
}
