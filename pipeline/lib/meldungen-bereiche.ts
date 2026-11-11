/** Aus `fetch-pruefungen.ts` herausgelöst: Bereiche der Meldungen auf die Staffeln einer Adresse verteilen. */
import { bildeBereiche, verteileAufStaffeln, type Folgenbereich, type Staffeleintrag } from './folgenbereiche.ts'
import { warn } from './util.ts'

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

/** Wahr, wo eine spätere ADN-Staffel wieder bei Folge 1 beginnt (SAO, JoJo); Dorohedoro zählt durch (Staffel 2 ab Folge 13). */
function zaehltJeStaffel(mit: { folge_nr: number | null; staffel: number | null }[]): boolean {
  const ersteJeStaffel = new Map<number, number>()
  for (const m of mit) ersteJeStaffel.set(m.staffel as number, Math.min(ersteJeStaffel.get(m.staffel as number) ?? Infinity, m.folge_nr as number))
  return [...ersteJeStaffel].some(([nr, erste]) => nr > 1 && erste === 1)
}

export interface AdnTitelBereiche {
  bereiche: Folgenbereich[]
  /** Folgen, zu denen die Meldungen derselben ADN-Staffel sich widersprechen. */
  widersprueche: number[]
}

/**
 * ADN zählt je Staffel neu (jede der vier JoJo-Staffeln beginnt bei Folge 1) und schickt die Staffel mit; unsere Titel hängen
 * über `data/adn-staffelzuordnung.yaml` an einer ADN-Staffel, auch ein einzelner (Tougen Anki: Staffel 2 gehört nicht zu ihm).
 * Teilen sich zwei Titel eine (20474 und 20799 die 48 Folgen von Staffel 2), verteilt die Reihenfolge auf deren Folgenzahlen.
 * `undefined` (alter, durchgezählter Weg), wo eine Meldung keine Staffel trägt oder keiner der Titel in der Datei steht; zählt die
 * Serie dann je Staffel, warnt der Lauf. Sonst bekommt ein Titel ohne Eintrag nichts.
 */
export function bereicheJeAdnTitel(
  gruppe: { befund: string; folge_nr: number | null; staffel: number | null }[],
  staffeln: Staffeleintrag[],
  adnStaffeln: Record<number, string>,
): Map<number, AdnTitelBereiche> | undefined {
  const mit = gruppe.filter((m) => m.befund !== 'weg' && m.folge_nr != null)
  if (!mit.length || mit.some((m) => !m.staffel)) return undefined
  if (!staffeln.some((t) => adnStaffeln[t.id])) {
    if (zaehltJeStaffel(mit)) warn(`ADN-Meldungen zählen je Staffel, aber keiner von ${staffeln.map((t) => t.id).join(', ')} steht in der Staffelzuordnung — durchgezählt verteilt`)
    return undefined
  }
  const jeTitel = new Map<number, AdnTitelBereiche>()
  for (const nr of new Set(mit.map((m) => m.staffel))) {
    const titel = staffeln.filter((t) => adnStaffeln[t.id] === String(nr))
    const { bereiche, widersprueche } = bildeBereiche(mit.filter((m) => m.staffel === nr).map((m) => ({ folge: m.folge_nr as number, dub: m.befund === 'dub' })))
    for (const t of titel) jeTitel.set(t.id, { bereiche: bereicheDerStaffel(bereiche, titel, t.id), widersprueche })
  }
  return jeTitel
}
