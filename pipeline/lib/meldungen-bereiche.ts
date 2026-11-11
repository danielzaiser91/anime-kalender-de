/** Aus `fetch-pruefungen.ts` herausgelöst: Bereiche der Meldungen auf die Staffeln einer Adresse verteilen. */
import { bildeBereiche, verteileAufStaffeln, type Folgenbereich, type Staffeleintrag } from './folgenbereiche.ts'

/** Die Bereiche einer durchgezählten Meldungsliste, die in die Staffel `id` fallen, in deren eigener Zählung. */
export function bereicheDerStaffel(
  bereiche: { von: number; bis: number; dub: boolean }[],
  staffeln: Staffeleintrag[],
  id: number,
): Folgenbereich[] {
  return bereiche
    .flatMap((b) => verteileAufStaffeln(b, staffeln))
    .filter((v) => v.staffel.id === id)
    .map((v) => ({ von: v.von, bis: v.bis, dub: v.dub, belegt: [] as number[] }))
}

/**
 * ADN zählt je Staffel neu (jede der vier JoJo-Staffeln beginnt bei Folge 1) und schickt die Staffel mit; unsere Titel hängen
 * über `data/adn-staffelzuordnung.yaml` an einer ADN-Staffel. Teilen sich zwei Titel eine (20474 und 20799 die 48 Folgen von
 * Staffel 2), verteilt die Reihenfolge der Titel auf deren Folgenzahlen. `undefined` (alter Weg), wo eine Meldung keine Staffel
 * trägt, nur ein Titel an der Adresse hängt oder keiner in der Datei steht; sonst bekommt ein Titel ohne Eintrag nichts.
 */
export function bereicheJeAdnTitel(
  gruppe: { befund: string; folge_nr: number | null; staffel: number | null }[],
  staffeln: Staffeleintrag[],
  adnStaffeln: Record<number, string>,
): Map<number, Folgenbereich[]> | undefined {
  const mit = gruppe.filter((m) => m.befund !== 'weg' && m.folge_nr != null)
  if (!mit.length || mit.some((m) => !m.staffel)) return undefined
  if (staffeln.length < 2 || !staffeln.some((t) => adnStaffeln[t.id])) return undefined
  const jeTitel = new Map<number, Folgenbereich[]>()
  for (const nr of new Set(mit.map((m) => m.staffel))) {
    const titel = staffeln.filter((t) => adnStaffeln[t.id] === String(nr))
    const { bereiche } = bildeBereiche(mit.filter((m) => m.staffel === nr).map((m) => ({ folge: m.folge_nr as number, dub: m.befund === 'dub' })))
    for (const t of titel) jeTitel.set(t.id, bereicheDerStaffel(bereiche, titel, t.id))
  }
  return jeTitel
}
