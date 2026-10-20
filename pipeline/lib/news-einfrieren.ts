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
 * Abgelöste und zurückgezogene Terminmeldungen kommen aus dem Verlauf (`verlaufsKette`), nicht aus `terminMeldungen`, und tragen `weiterer` nicht mit.
 * Der festgehaltene Wert gilt für sie genauso, sonst verlöre der nächste Bau, was die Saat gesetzt hat (Lauf 39409099512).
 */
export function traegeWeitererNach<T extends { art: string; release?: string; datum?: string; weiterer?: boolean }>(historie: NewsHistorie, meldungen: T[]): T[] {
  return meldungen.map((m) => (m.art === 'angekuendigt' && m.release && m.datum && !m.weiterer && historie.weiterer?.[`angekuendigt:${m.release}:${m.datum}`] ? { ...m, weiterer: true } : m))
}

/** Das Gedächtnis altert mit `zuerst`: Schlüssel älter als `ab` fallen heraus, ihre festgehaltenen Flags mit. */
export function vergissAlte(historie: NewsHistorie, ab: string): void {
  for (const [k, v] of Object.entries(historie.zuerst)) {
    if (v < ab) delete historie.zuerst[k]
  }
  for (const k of Object.keys(historie.weiterer ?? {})) {
    if (!(k in historie.zuerst)) delete historie.weiterer![k]
  }
}

/** Schlüssel der Terminmeldung, wie `terminMeldungen` ihn bildet (`art:release:datum`). */
const schluesselVon = (m: NewsMeldung): string | undefined => (m.art === 'angekuendigt' && m.release && m.datum ? `angekuendigt:${m.release}:${m.datum}` : undefined)

/**
 * **Einmaliges Säen:** Der Wert einer schon bestehenden Meldung ist ihr erster Stand in der Historie von `news.json`
 * (`staende` von alt nach neu), nicht der heutige. Nur Schlüssel, die noch fehlen und im Gedächtnis (`zuerst`) stehen.
 */
export function saeeWeiterer(historie: NewsHistorie, staende: NewsEintrag[][], jetzt: NewsEintrag[]): number {
  const erster: Record<string, boolean> = {}
  for (const stand of staende) {
    for (const e of stand) {
      for (const m of e.meldungen) {
        const k = schluesselVon(m)
        if (k) erster[k] ??= m.weiterer === true
      }
    }
  }
  const fest = (historie.weiterer ??= {})
  let neu = 0
  for (const e of jetzt) {
    for (const m of e.meldungen) {
      const k = schluesselVon(m)
      if (!k || k in fest || !(k in historie.zuerst)) continue
      fest[k] = erster[k] ?? m.weiterer === true
      neu++
    }
  }
  return neu
}

/** Bringt `weiterer` in `news.json` auf den festgehaltenen Wert, an der Stelle, an der der Bau das Feld schreibt (nach `geschaetzt`/`belege`). */
export function setzeWeitererEin(eintraege: NewsEintrag[], fest: Record<string, boolean>): number {
  let geaendert = 0
  for (const e of eintraege) {
    e.meldungen = e.meldungen.map((m) => {
      const k = schluesselVon(m)
      if (!k || !(k in fest) || fest[k] === (m.weiterer === true)) return m
      geaendert++
      if (!fest[k]) {
        const { weiterer: _weg, ...ohne } = m
        return ohne
      }
      const reihe = Object.entries(m)
      const nach = reihe.findLastIndex(([f]) => ['release', 'ausgabe', 'quelle', 'belege', 'geschaetzt'].includes(f))
      reihe.splice(nach + 1, 0, ['weiterer', true])
      return Object.fromEntries(reihe) as NewsMeldung
    })
  }
  return geaendert
}

/** Bestandswächter: jede Terminmeldung in `news.json` trägt das festgehaltene `weiterer` (`fehler`); ohne Eintrag (`luecken`) hat der Bau keinen angelegt, etwa bei Meldungen aus dem Terminverlauf. */
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
