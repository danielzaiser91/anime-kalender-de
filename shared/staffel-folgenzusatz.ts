import { ausstrahlungsZeit, type StaffelNummer } from './titles.ts'

export type FolgenTeil = {
  id: number
  episodes?: number
  jpYear?: number
  jpStart?: string
  staffelQuelle?: number
  staffelBis?: number
}

/** `text` ist „Folge 15–34“ (Position in der Staffel) oder „14 Folgen“ (`anzahl`), wenn die Position nicht belegt ist. */
export type FolgenZusatz = { text: string; anzahl: boolean }

function bereich(von: number, bis: number): string {
  return von === bis ? `Folge ${von}` : `Folge ${von}–${bis}`
}

/**
 * Tragen zwei Einträge einer Reihe dieselbe Staffelbezeichnung („Staffel 16“ bei Pokémon 17115 und 17873, beide laut TMDB in Staffel 16),
 * bekommen sie einen Zusatz aus ihren belegten Folgenzahlen. Nur wenn alle Einträge der Bezeichnung dieselbe belegte deutsche Staffel
 * (`staffelQuelle`) tragen: sonst sind es zwei Serien mit gleicher Zählung (Berserk 1997/2016), und ein Folgenbereich wäre erfunden.
 * Fehlt einem Eintrag die Folgenzahl, gibt es keinen Zusatz. Beginnt vorher ein Eintrag, der in diese Staffel hineinreicht (`staffelBis`),
 * ist die Startfolge unbekannt (Pokémon 14093 füllt Staffel 16 mit 11 Folgen): dann nur die Anzahl.
 */
export function folgenZusatz(teile: FolgenTeil[], nummern: Map<number, Pick<StaffelNummer, 'staffel' | 'bis' | 'teil'>>): Map<number, FolgenZusatz> {
  const gruppen = new Map<string, FolgenTeil[]>()
  for (const m of teile) {
    const n = nummern.get(m.id)
    if (!n) continue
    const schluessel = `${n.staffel}|${n.bis ?? ''}|${n.teil ?? ''}`
    gruppen.set(schluessel, [...(gruppen.get(schluessel) ?? []), m])
  }
  const aus = new Map<number, FolgenZusatz>()
  for (const gruppe of gruppen.values()) {
    const staffel = gruppe[0]?.staffelQuelle
    if (gruppe.length < 2 || staffel === undefined) continue
    if (!gruppe.every((m) => m.staffelQuelle === staffel && (m.episodes ?? 0) > 0)) continue
    const ids = new Set(gruppe.map((m) => m.id))
    const fremd = teile.some((m) => !ids.has(m.id) && m.staffelQuelle !== undefined && m.staffelQuelle <= staffel && (m.staffelBis ?? m.staffelQuelle) >= staffel)
    let naechste = 1
    for (const m of gruppe.slice().sort((a, b) => ausstrahlungsZeit(a).localeCompare(ausstrahlungsZeit(b)) || a.id - b.id)) {
      const folgen = m.episodes!
      aus.set(m.id, fremd ? { text: `${folgen} Folgen`, anzahl: true } : { text: bereich(naechste, naechste + folgen - 1), anzahl: false })
      naechste += folgen
    }
  }
  return aus
}
