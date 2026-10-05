/**
 * Beziehungen, die eine Reihe nur zusammenhalten, wenn die Namen beider Seiten zusammenpassen (`otherZaehlt` in `mappings.ts`).
 * `CHARACTER` kam am 04.10.2026 dazu (Daniel: „Black Jack: Capital Transfer To Heian" hing nur über „Charakter"
 * an der Reihe und stand allein): Mit gemeinsamem Namensanfang ist es dieselbe Reihe, ohne ihn ein Gastauftritt.
 */
export const NAMENSGEBUNDENE_RELATIONEN = new Set(['OTHER', 'CHARACTER'])

/** Mindestlänge des gemeinsamen Namensanfangs je Beziehungsart. Bei `CHARACTER` 9: „Tales of" (8) verband sonst Parodie-Kurzserien mit eigenständigen Spielen (Messung 05.10.2026). */
export const namensanfangMindestens = (relationType: string): number => (relationType === 'CHARACTER' ? 9 : 8)
