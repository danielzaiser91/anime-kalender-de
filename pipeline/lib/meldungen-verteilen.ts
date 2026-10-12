/**
 * Die Meldungen einer Adresse auf unsere Staffeln verteilen — Folgentitel zuerst, dann die Zahl.
 * Aus `fetch-pruefungen.ts` herausgelöst; Regeln und Anlässe stehen dort und in `folgentitel-anker.ts`.
 */
import { ordneMeldungZuPlattform } from './disney-gesamtnummer.ts'
import { folgentitelAusNotiz, folgeUeberTitel } from './folgentitel-anker.ts'
import type { AnbieterStaffel, Staffeleintrag } from './folgenbereiche.ts'
import type { Blockurteil } from './episodentitel-block.ts'
import { warn } from './util.ts'
import { blockUrteile, folgenlisteVon, nummerUeberBlock } from './titel-bloecke.ts'

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
  /** Blöcke, deren Titel sich widersprechen: keine Zuordnung, Grund für die Prüfliste (`episodentitel-block.ts`). */
  zuPruefen: string[]
}

/** Widersprüche gehen auf die Prüfliste; Titel, die vom sicheren Block abweichen, ins Protokoll (der Titel gewinnt, die Abweichung wird gezählt). */
function protokolliere(urteile: Map<number, Blockurteil>, zuPruefen: string[]): void {
  for (const [seq, u] of urteile) {
    if (!u.sicher && u.widerspruch) zuPruefen.push(`Staffel ${seq} des Anbieters: ${u.grund}`)
    if (u.sicher && u.abweichend) warn(`Folgentitel: ${u.abweichend} von ${u.geprueft} Titeln der Anbieter-Staffel ${seq} liegen anderswo, der Block gilt`)
  }
}

export function verteileMeldungen(
  gruppe: VerteilMeldung[],
  anbieterStaffeln: AnbieterStaffel[] | undefined,
  staffeln: Staffeleintrag[],
  /** Bekommt den Grund jedes widersprüchlichen Blocks (Prüfliste); die Prüfung braucht ihn nicht. */
  meldeZuPruefen: (grund: string) => void = () => {},
): Verteilung {
  const verteilung: Verteilung = { jeStaffel: new Map(), notizJeStaffel: new Map(), ueberFolgentitel: 0, zuPruefen: [] }
  if (!anbieterStaffeln || !staffeln.length) return verteilung
  /*
    **Bei einem Titel von uns entscheidet je Block der Folgentitel** (`episodentitel-block.ts`), gleich wie der Anbieter
    teilt: Buch 2 von Avatar beginnt bei unserer Folge 21. Ohne Titel oder Liste bleibt es bei Anker und Zahl.
  */
  const liste = staffeln.length === 1 ? folgenlisteVon(staffeln[0]!.id) : null
  const urteile = liste ? blockUrteile(gruppe, anbieterStaffeln, liste) : new Map()
  protokolliere(urteile, verteilung.zuPruefen)
  for (const grund of verteilung.zuPruefen) meldeZuPruefen(grund)
  for (const m of gruppe) {
    if (m.befund === 'weg' || m.folge_nr == null || m.folge_nr < 1) continue
    const ueberBlock = liste ? nummerUeberBlock(m, anbieterStaffeln, urteile) : null
    if (ueberBlock === 'pruefen') continue
    /*
      **Zuerst der Folgentitel, dann die Zahl** (18.09.2026, `lib/folgentitel-anker.ts`).
      Er nennt Titel und Folgennummer direkt; die Rechnung über Staffel und Zählung
      bleibt der Weg für Meldungen ohne Treffer.
    */
    const anker =
      m.plattform === 'netflix' ? folgeUeberTitel(folgentitelAusNotiz(m.notiz), staffeln.map((x) => x.id)) : null
    const ankerStaffel = anker ? staffeln.find((x) => x.id === anker.id) : undefined
    const treffer = ueberBlock
      ? { staffel: staffeln[0]!, folgeInStaffel: ueberBlock }
      : ankerStaffel
        ? { staffel: ankerStaffel, folgeInStaffel: anker!.nr }
        : ordneMeldungZuPlattform(m.plattform, { folge: m.folge_nr, staffel: m.staffel }, staffeln, anbieterStaffeln)
    if (!treffer) continue
    if (ueberBlock || ankerStaffel) verteilung.ueberFolgentitel++
    const bisher = verteilung.jeStaffel.get(treffer.staffel.id) ?? []
    bisher.push({ folge: treffer.folgeInStaffel, dub: m.befund === 'dub' })
    verteilung.jeStaffel.set(treffer.staffel.id, bisher)
    if (m.notiz) verteilung.notizJeStaffel.set(treffer.staffel.id, m.notiz)
  }
  return verteilung
}
