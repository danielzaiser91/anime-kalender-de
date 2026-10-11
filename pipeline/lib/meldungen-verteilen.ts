/**
 * Die Meldungen einer Adresse auf unsere Staffeln verteilen — Folgentitel zuerst, dann die Zahl.
 * Aus `fetch-pruefungen.ts` herausgelöst; Regeln und Anlässe stehen dort und in `folgentitel-anker.ts`.
 */
import { ordneMeldungZuPlattform } from './disney-gesamtnummer.ts'
import { folgentitelAusNotiz, folgeUeberTitel } from './folgentitel-anker.ts'
import type { AnbieterStaffel, Staffeleintrag } from './folgenbereiche.ts'

export interface VerteilMeldung {
  befund: string
  folge_nr: number | null
  notiz: string | null
  plattform: string
  staffel: number | null
}

export interface Verteilung {
  /** Je unsere Staffel die gemeldeten Folgen in ihrer Zählung. */
  jeStaffel: Map<number, Array<{ folge: number; dub: boolean }>>
  /**
   * **Die Notiz gehört der Meldung ihres Titels** (22.09.2026). Zwei Randproben unter einer
   * Adresse (Haikyu!! TO THE TOP E1–13 und E14–25) bekamen beide die Notiz der letzten Meldung —
   * „gemessen: Folge 14 und 25" stand auch am Titel, dessen Ränder 1 und 13 waren.
   */
  notizJeStaffel: Map<number, string>
  /** Wie viele Meldungen der Folgentitel zugeordnet hat. */
  ueberFolgentitel: number
}

export function verteileMeldungen(
  gruppe: VerteilMeldung[],
  anbieterStaffeln: AnbieterStaffel[] | undefined,
  staffeln: Staffeleintrag[],
): Verteilung {
  const verteilung: Verteilung = { jeStaffel: new Map(), notizJeStaffel: new Map(), ueberFolgentitel: 0 }
  if (!anbieterStaffeln || !staffeln.length) return verteilung
  for (const m of gruppe) {
    if (m.befund === 'weg' || m.folge_nr == null || m.folge_nr < 1) continue
    /*
      **Zuerst der Folgentitel, dann die Zahl** (18.09.2026, `lib/folgentitel-anker.ts`).
      Er nennt Titel und Folgennummer direkt; die Rechnung über Staffel und Zählung
      bleibt der Weg für Meldungen ohne Treffer.
    */
    const anker =
      m.plattform === 'netflix' ? folgeUeberTitel(folgentitelAusNotiz(m.notiz), staffeln.map((x) => x.id)) : null
    const ankerStaffel = anker ? staffeln.find((x) => x.id === anker.id) : undefined
    const treffer = ankerStaffel
      ? { staffel: ankerStaffel, folgeInStaffel: anker!.nr }
      : ordneMeldungZuPlattform(m.plattform, { folge: m.folge_nr, staffel: m.staffel }, staffeln, anbieterStaffeln)
    if (!treffer) continue
    if (ankerStaffel) verteilung.ueberFolgentitel++
    const bisher = verteilung.jeStaffel.get(treffer.staffel.id) ?? []
    bisher.push({ folge: treffer.folgeInStaffel, dub: m.befund === 'dub' })
    verteilung.jeStaffel.set(treffer.staffel.id, bisher)
    if (m.notiz) verteilung.notizJeStaffel.set(treffer.staffel.id, m.notiz)
  }
  return verteilung
}
