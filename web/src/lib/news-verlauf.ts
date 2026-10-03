/**
 * **Überholte Meldungen gehören unter die, die sie überholt hat** (Entwurf B, Daniel 03.10.2026).
 *
 * Die abgelöste Meldung trägt `ersetzt` mit dem Datum der neuen. Hier werden beide wieder zusammengeführt:
 * Die neue steht vorn, die alten stehen als Verlauf darunter, neueste zuerst; aus ihrer eigenen
 * Tagesliste verschwinden sie. Fehlt der Nachfolger in den Daten, bleibt die alte Meldung, wo sie ist.
 * Reine Rechnung — die Darstellung liegt in `components/news-verlauf.tsx`.
 */
import type { NewsEintrag, NewsMeldung } from '@shared/types.ts'

export interface Stand {
  m: NewsMeldung
  /** Tag, an dem diese Meldung gemeldet wurde. */
  am: string
  /** Tag, an dem die neuere Meldung kam, die diese überholt hat. */
  ueberholtAm?: string
}

export interface Verlaeufe {
  /** Die überholten Stände je geltender Meldung, neueste zuerst. */
  vorgaenger: Map<NewsMeldung, Stand[]>
  /** Überholte Meldungen mit gefundenem Nachfolger — sie stehen nicht mehr in der Tagesliste. */
  eingeordnet: Set<NewsMeldung>
}

/** Dieselbe Aussage: gleicher Teil, gleiches Release, gleiche Art. */
const aussage = (e: NewsEintrag, m: NewsMeldung): string => `${m.teilId ?? e.titelId}|${m.release ?? ''}|${m.art}`

export function verlaeufeAus(liste: NewsEintrag[]): Verlaeufe {
  const nachAussage = new Map<string, { m: NewsMeldung; am: string }[]>()
  for (const e of liste)
    for (const m of e.meldungen) {
      if (!m.release) continue
      const k = aussage(e, m)
      nachAussage.set(k, [...(nachAussage.get(k) ?? []), { m, am: e.am }])
    }
  const direkt = new Map<NewsMeldung, Stand[]>()
  const eingeordnet = new Set<NewsMeldung>()
  for (const e of liste)
    for (const m of e.meldungen) {
      if (!m.ersetzt?.datum || !m.release) continue
      const nachfolger = (nachAussage.get(aussage(e, m)) ?? []).find((x) => x.m !== m && x.m.datum === m.ersetzt!.datum)
      if (!nachfolger) continue
      eingeordnet.add(m)
      direkt.set(nachfolger.m, [...(direkt.get(nachfolger.m) ?? []), { m, am: e.am, ueberholtAm: nachfolger.am }])
    }
  /* Ketten (20.11. → 18.12. → 15.01.): jede geltende Meldung sammelt alle Vorgänger, neueste zuerst. */
  const vorgaenger = new Map<NewsMeldung, Stand[]>()
  for (const [wurzel, erste] of direkt) {
    if (eingeordnet.has(wurzel)) continue
    const alle: Stand[] = []
    const offen = [...erste]
    while (offen.length) {
      const s = offen.pop()!
      alle.push(s)
      offen.push(...(direkt.get(s.m) ?? []))
    }
    vorgaenger.set(wurzel, alle.sort((a, b) => b.am.localeCompare(a.am)))
  }
  return { vorgaenger, eingeordnet }
}

/** Die Liste ohne die eingeordneten Meldungen; Einträge, die dadurch leer werden, entfallen. */
export function ohneEingeordnete(liste: NewsEintrag[], eingeordnet: Set<NewsMeldung>): NewsEintrag[] {
  if (!eingeordnet.size) return liste
  return liste
    .map((e) => (e.meldungen.some((m) => eingeordnet.has(m)) ? { ...e, meldungen: e.meldungen.filter((m) => !eingeordnet.has(m)) } : e))
    .filter((e) => e.meldungen.length > 0)
}
