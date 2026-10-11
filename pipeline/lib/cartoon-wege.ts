/**
 * **Wege der Cartoons je Staffel** (11.10.2026, Teil 2 von 3): Ein Cartoon ist ein `Title`, sein Weg bei einem Anbieter deckt
 * heute alle Staffeln auf einmal. Sind die Staffeln belegt (`lib/cartoon-staffeln.ts`), wird der Weg auf sie verteilt:
 * ein Weg je Staffel, `teilBereich` und `dubRanges` in durchlaufender Zählung (Jack: Buch 1 = 1, Buch 2 = 2–11, Buch 3 = 12–21).
 *
 * Ein Häkchen je Staffel kommt nur aus einem Handbeleg mit Folgenbereichen. JustWatchs Ton je Staffel ist Fremdangabe (Regel
 * „Deutsch laut JustWatch“, `dubQuelle`) und schreibt nie `dub`.
 */
import type { CartoonStaffel } from '../../shared/cartoon-staffeln-typ.ts'
import type { StreamLink } from '../../shared/types.ts'

export interface StaffelBereich {
  nr: number
  von: number
  bis: number
}

type Bereiche = NonNullable<StreamLink['dubRanges']>

/** Wo jede Staffel in der durchlaufenden Zählung liegt. */
export function staffelBereiche(staffeln: CartoonStaffel[]): StaffelBereich[] {
  let bisher = 0
  return staffeln.map((s) => {
    const von = bisher + 1
    bisher += s.folgen
    return { nr: s.nr, von, bis: bisher }
  })
}

/** Teilbar ist ein Weg, der noch keinen Ausschnitt meint und dessen Urteil sich auf Folgen zurückführen lässt (oder offen ist). */
function teilbar(weg: StreamLink): boolean {
  if (weg.teilBereich || weg.entferntAm) return false
  return weg.dub === undefined || (weg.dub === true && Boolean(weg.dubRanges?.length))
}

function beschneiden(bereiche: Bereiche, b: StaffelBereich): Bereiche {
  return bereiche
    .filter((r) => r.to >= b.von && r.from <= b.bis)
    .map((r) => ({ from: Math.max(r.from, b.von), to: Math.min(r.to, b.bis), dub: r.dub }))
}

/** Der Weg für eine Staffel; `jwStand` ist das Datum, wenn JustWatch für genau diese Staffel deutschen Ton nennt. */
function wegJeStaffel(weg: StreamLink, b: StaffelBereich, jwStand: string | undefined): StreamLink {
  const teil: StreamLink = { ...weg, teilBereich: { von: b.von, bis: b.bis } }
  delete teil.dub
  delete teil.dubRanges
  if (weg.dub === undefined) return jwStand ? { ...teil, dubQuelle: 'justwatch', dubStand: jwStand } : teil
  const ausschnitt = beschneiden(weg.dubRanges!, b)
  if (!ausschnitt.length) return teil
  return { ...teil, dub: ausschnitt.some((r) => r.dub), dubRanges: ausschnitt }
}

/**
 * Der Weg, auf die Staffeln verteilt. Ein Weg, dessen Urteil keine Folgenbereiche kennt (Handbeleg „deutsch“ ohne Bereiche,
 * etwa Barbie: 12 von 110 Folgen), bleibt ganz: sonst bekäme jede Staffel ein Häkchen, das niemand belegt hat.
 * Eine Staffel, zu der der Beleg nichts sagt, bekommt keines.
 */
export function verteileWeg(
  weg: StreamLink,
  bereiche: StaffelBereich[],
  jwStand: (staffelNr: number) => string | undefined = () => undefined,
): StreamLink[] {
  if (!teilbar(weg) || bereiche.length < 2) return [weg]
  return bereiche.map((b) => wegJeStaffel(weg, b, jwStand(b.nr)))
}
