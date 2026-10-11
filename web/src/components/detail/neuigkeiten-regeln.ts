import type { NewsEintrag, NewsMeldung, Release } from '@shared/types.ts'
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
export function meldungenImPanel(
  liste: NewsEintrag[],
  titelId: number,
  heute: string,
  laeuft: (releaseSlug?: string) => boolean = () => false,
): Zeile[] {
  const zeilen: Zeile[] = []
  for (const e of liste)
    for (const m of e.meldungen) {
      const teilId = m.teilId ?? e.titelId
      if (teilId !== titelId) continue
      /*
        Eine **angekündigte** Staffel bleibt sichtbar — sie ist noch kein Termin,
        den das Panel schon zeigt, sondern die Nachricht selbst.
      */
      if (TERMIN_ARTEN.has(m.art) && m.datum && omuLetzterTag(m.datum) < heute && !laeuft(m.release)) continue
      zeilen.push({ am: e.am, m, teilId })
    }
  return zeilen.sort((a, b) => b.am.localeCompare(a.am))
}

/** Läuft die Serie des Termins noch (letzte Folge heute oder später)? Dann bleibt der Start samt Quellen stehen (Avatar: Die sieben Häfen, 11.10.2026). */
export function laeuftNoch(r: Release | undefined, heute: string): boolean {
  const letzte = r?.schedule?.lastEpisodeDate
  return Boolean(letzte && letzte >= heute)
}

/** Die Antwort auf „läuft das Release dieser Meldung noch?" — ein unbekannter Slug läuft nicht. */
export function laeuftFuerSlug(releaseBySlug: Map<string, Release>, heute: string): (releaseSlug?: string) => boolean {
  return (slug) => laeuftNoch(releaseBySlug.get(slug ?? ''), heute)
}
