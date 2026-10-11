import type { NewsEintrag, NewsMeldung } from '@shared/types.ts'
import { omuLetzterTag } from '@shared/ankuendigung.ts'

export interface Zeile {
  am: string
  m: NewsMeldung
  /** Der Teil der Reihe, den die Meldung betrifft. */
  teilId: number
}

/** Meldungen, die einen Termin nennen — sie veralten mit ihm. */
const TERMIN_ARTEN = new Set<NewsMeldung['art']>(['angekuendigt', 'disc', 'kino'])

/**
 * Was das Panel an News zeigt: **nur der eigene Titel** — bei Pokémon standen
 * Meldungen zu „Reisen" und „Horizonte" im Panel von „Generationen" —, **kein vorbeigegangener
 * Termin**. Ein **kommender** Termin bleibt: Die Pille nennt den Tag, die Meldung dazu nennt die Quelle
 * (Daniel, 04.10.2026: „News-Einträge fehlen im Panel"). Neueste zuerst.
 */
export function meldungenImPanel(liste: NewsEintrag[], titelId: number, heute: string): Zeile[] {
  const zeilen: Zeile[] = []
  for (const e of liste)
    for (const m of e.meldungen) {
      const teilId = m.teilId ?? e.titelId
      if (teilId !== titelId) continue
      /*
        Eine **angekündigte** Staffel bleibt sichtbar — sie ist noch kein Termin,
        den das Panel schon zeigt, sondern die Nachricht selbst.
      */
      if (TERMIN_ARTEN.has(m.art) && m.datum && omuLetzterTag(m.datum) < heute) continue
      zeilen.push({ am: e.am, m, teilId })
    }
  return zeilen.sort((a, b) => b.am.localeCompare(a.am))
}
