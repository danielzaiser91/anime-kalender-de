/**
 * Erscheinungsdatum einer gemeldeten Folge als ISO-Tag. Die Erweiterung reicht den Text der Seite
 * durch: ADN einen ISO-Zeitpunkt, Prime deutschen Klartext („10. Mai 2023“, „16. Sept. 2001“).
 * Alles Unlesbare wird `null`, nie ein abgeschnittener Rest.
 */
import type { AnbieterFolge } from '../../shared/folgen-zuordnung.ts'

/** Die ersten drei Buchstaben je Monat (Index + 1); „Sept.“, „Oktober“, „März“ und „Mrz“ landen alle hier. */
const MONATE = [
  'jan',
  'feb',
  'mär|mrz|mar',
  'apr',
  'mai',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dez',
]

function monatVon(wort: string): number {
  const kurz = wort.toLowerCase().slice(0, 3)
  return MONATE.findIndex((m) => m.split('|').includes(kurz)) + 1
}

function alsIso(jahr: number, monat: number, tag: number): string | null {
  const d = new Date(Date.UTC(jahr, monat - 1, tag))
  /* Ein Überlauf (31. Feb., Tag 0, Monat 0) verschiebt immer den Monat. */
  if (d.getUTCMonth() !== monat - 1) return null
  return `${String(jahr).padStart(4, '0')}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

export function folgenDatum(text: string | null | undefined): string | null {
  const t = (text ?? '').trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(t)
  if (iso) return alsIso(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const punkte = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t)
  if (punkte) return alsIso(Number(punkte[3]), Number(punkte[2]), Number(punkte[1]))
  const klartext = /^(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]{3,9})\.?\s+(\d{4})$/.exec(t)
  const monat = klartext ? monatVon(klartext[2]!) : 0
  return klartext && monat ? alsIso(Number(klartext[3]), monat, Number(klartext[1])) : null
}

interface RohfolgeKern {
  nummer: number | null
  titel: string | null
  erschienen: string | null
  dauer_sek: number | null
}

/** Die gemeldete Folge in der Form, die der Zuordner liest. */
export function anbieterFolgeAus(f: RohfolgeKern): AnbieterFolge {
  return {
    nummer: f.nummer,
    titel: f.titel,
    datum: folgenDatum(f.erschienen),
    minuten: f.dauer_sek ? Math.round(f.dauer_sek / 60) : null,
  }
}
