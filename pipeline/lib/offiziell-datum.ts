/**
 * Datum aus dem Text einer Meldung der offiziellen Seiten (Messlauf 13.10.2026): japanisch `2026.06.27`, `2026年6月27日`, ISO, englisch `June 27, 2026`,
 * deutsch `27.06.2026`. Ohne Jahr gibt es kein Datum — „6/27“ ließe sich nur raten.
 */
const MONATE: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

function iso(jahr: number, monat: number, tag: number): string | undefined {
  const d = new Date(Date.UTC(jahr, monat - 1, tag))
  if (d.getUTCFullYear() !== jahr || d.getUTCMonth() !== monat - 1 || d.getUTCDate() !== tag) return undefined
  return d.toISOString().slice(0, 10)
}

const JAPANISCH_ISO = /(20\d\d)\s*[./\-年]\s*(\d{1,2})\s*[./\-月]\s*(\d{1,2})(?!\d)/
const ENGLISCH_MONAT_ZUERST = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d\d)\b/i
const ENGLISCH_TAG_ZUERST = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(20\d\d)\b/i
const DEUTSCH = /(?<!\d)(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d\d)(?!\d)/

/** Das erste Datum im Text als `JJJJ-MM-TT`; `undefined`, wenn keines (mit Jahr) darin steht. */
export function datumIn(text: string): string | undefined {
  const j = JAPANISCH_ISO.exec(text)
  if (j) return iso(Number(j[1]), Number(j[2]), Number(j[3]))
  const e = ENGLISCH_MONAT_ZUERST.exec(text)
  if (e) return iso(Number(e[3]), MONATE[e[1]!.toLowerCase()]!, Number(e[2]))
  const t = ENGLISCH_TAG_ZUERST.exec(text)
  if (t) return iso(Number(t[3]), MONATE[t[2]!.toLowerCase()]!, Number(t[1]))
  const d = DEUTSCH.exec(text)
  if (d) return iso(Number(d[3]), Number(d[2]), Number(d[1]))
  return undefined
}

const DATUMSWOERTER = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?|\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?|[月火水木金土日]曜日?/gi

/** Ist der Text nichts als ein Datum (mit Wochentag/Uhrzeit-Resten)? Dann ist er keine Überschrift. */
export function nurDatum(text: string): boolean {
  if (!datumIn(text)) return false
  return text.replace(DATUMSWOERTER, '').replace(/[0-9０-９\s./\-年月日火水木金土:()（）〜~,　]|st|nd|rd|th|T/g, '').length === 0
}

/** Tage von `von` bis `bis` (beide `JJJJ-MM-TT`), positiv, wenn `bis` später liegt. */
export function tageZwischen(von: string, bis: string): number {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000)
}
