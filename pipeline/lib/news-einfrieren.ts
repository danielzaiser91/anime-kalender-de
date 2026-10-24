/**
 * **Was eine Meldung am Tag sagte, sagt sie weiter** (20.10.2026).
 *
 * `weiterer` („jetzt auch bei …“ statt „angekündigt“) wurde bei jedem Bau aus den heutigen Wegen eines
 * Titels neu abgeleitet; bestehende Meldungen kippten dadurch (04.–20.10.: 77 Wechsel an 20 Meldungen, 12 hin
 * und her). Jetzt gilt der Wert vom ersten Bau, der die Meldung erzeugte; trägt der Beleg ihn später nicht
 * mehr, wird die Meldung nicht mehr erzeugt, aber nie umgeschrieben (`news-plan.md`).
 */
import type { NewsHistorie } from './news.ts'
import type { NewsEintrag, NewsMeldung } from '../../shared/news-typen.ts'

/** Gibt die Meldung mit dem festgehaltenen `weiterer` zurück; beim ersten Mal wird der heutige Wert festgehalten. */
export function haltWeitererFest<T extends { art: string; weiterer?: boolean }>(historie: NewsHistorie, schluessel: string, m: T): T {
  if (m.art !== 'angekuendigt') return m
  const fest = (historie.weiterer ??= {})
  fest[schluessel] ??= m.weiterer === true
  if (fest[schluessel] === (m.weiterer === true)) return m
  if (fest[schluessel]) return { ...m, weiterer: true }
  const { weiterer: _weg, ...ohne } = m
  return ohne as T
}

/**
 * Die Marke „Deutsche TV-Premiere“ (`premiere`) gilt nur für Meldungen, die dieser Bau neu erzeugt (22.10.2026, Entscheidung Dirigent):
 * Eine Meldung, die schon in `zuerst` stand, behält ihren Text; eine neue merkt sich die Marke, damit spätere Bauten sie nicht kippen.
 */
export function haltPremiereFest<T extends { schluessel: string; premiere?: boolean }>(historie: NewsHistorie, meldungen: T[]): T[] {
  return meldungen.map((m) => {
    if (!m.premiere) return m
    if (!(m.schluessel in historie.zuerst)) (historie.premiere ??= {})[m.schluessel] = true
    if (historie.premiere?.[m.schluessel]) return m
    const { premiere: _weg, ...ohne } = m
    return ohne as T
  })
}

/**
 * Meldungen aus dem Terminverlauf (abgelöst/zurückgezogen) entstehen nicht in `terminMeldungen`, tragen aber denselben Schlüssel
 * `angekuendigt:release:datum`: Hier gilt der festgehaltene Wert, ohne einen neuen anzulegen.
 */
export function traegtFestgehaltenesWeiterer<T extends { art: string; release?: string; datum?: string; weiterer?: boolean }>(fest: Record<string, boolean> | undefined, m: T): T {
  if (m.art !== 'angekuendigt' || !m.release || !m.datum) return m
  if (fest?.[`angekuendigt:${m.release}:${m.datum}`] !== true || m.weiterer === true) return m
  return { ...m, weiterer: true }
}

/** Das Gedächtnis altert mit `zuerst`: Schlüssel älter als `ab` fallen heraus, ihre festgehaltenen Flags und Felder mit. */
export function vergissAlte(historie: NewsHistorie, ab: string): void {
  for (const [k, v] of Object.entries(historie.zuerst)) {
    if (v < ab) delete historie.zuerst[k]
  }
  for (const k of Object.keys(historie.weiterer ?? {})) {
    if (!(k in historie.zuerst)) delete historie.weiterer![k]
  }
  for (const k of Object.keys(historie.felder ?? {})) {
    if (!(k in historie.zuerst)) delete historie.felder![k]
  }
  for (const k of Object.keys(historie.premiere ?? {})) {
    if (!(k in historie.zuerst)) delete historie.premiere![k]
  }
}

/** Schlüssel der Terminmeldung, wie `terminMeldungen` ihn bildet (`art:release:datum`). */
const schluesselVon = (m: NewsMeldung): string | undefined => (m.art === 'angekuendigt' && m.release && m.datum ? `angekuendigt:${m.release}:${m.datum}` : undefined)

/** Bestandswächter: jede Terminmeldung in `news.json` trägt das festgehaltene `weiterer` (`fehler`); ohne Eintrag (`luecken`) hat der Bau keinen angelegt. Meldungen aus dem Terminverlauf tragen den Wert seit #1670 und sind keine Lücken mehr (Bestand 20.10.2026: 0). */
export function einfrierFehler(eintraege: NewsEintrag[], historie: NewsHistorie): { fehler: string[]; luecken: string[] } {
  const fehler: string[] = []
  const luecken: string[] = []
  for (const e of eintraege) {
    for (const m of e.meldungen) {
      const k = schluesselVon(m)
      if (!k) continue
      const fest = historie.weiterer?.[k]
      if (fest === undefined) luecken.push(`${e.am} ${e.titel} (${k})`)
      else if (fest !== (m.weiterer === true)) fehler.push(`${e.am} ${e.titel} (${k}): news.json ${m.weiterer === true}, festgehalten ${fest}`)
    }
  }
  return { fehler, luecken }
}
