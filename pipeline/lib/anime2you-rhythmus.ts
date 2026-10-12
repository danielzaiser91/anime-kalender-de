/**
 * Art „rhythmus“ der Anime2You-Extraktion: „bis 30.10. wöchentlich drei bis vier weitere Folgen“ (Avatar: Die sieben Häfen, Artikel 1059483).
 * Der Vorschlag trägt Folgen je Woche (`proWoche`) und Enddatum (`bis`); beides muss im Zitat stehen. Handbeleg dazu: `Release.rhythmus`.
 */
import { findDates } from './feed.ts'

const ZAHLWOERTER: Record<string, number> = { ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12 }
const ZAHL = `\\d{1,2}|${Object.keys(ZAHLWOERTER).join('|')}`
/** Zahl oder Spanne im Zitat: „drei bis vier“, „3–4“, „zwei“. */
const SPANNE = new RegExp(`(?<!\\w)(${ZAHL})(?:\\s*(?:bis|-|–|/|oder)\\s*(${ZAHL}))?(?!\\w)`, 'gi')
const WOECHENTLICH = /wöchentlich|pro woche|je woche|jede woche|jeden (?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)/i

export interface Rhythmus {
  proWoche: [number, number]
  bis: string
}

const zahl = (s: string): number => ZAHLWOERTER[s.toLowerCase()] ?? Number(s)

/** Die Felder `proWoche` (zwei ganze Zahlen) und `bis` (Tag) der Rohantwort – oder der Grund, warum sie nicht taugen. */
export function leseRhythmus(r: Record<string, unknown>): Rhythmus | string {
  const p = r.proWoche
  const ganz = Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 1 && n <= 20)
  if (!ganz || p[0] > p[1]) return 'rhythmus: proWoche muss [von, bis] mit ganzen Zahlen von 1 bis 20 sein'
  if (typeof r.bis !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.bis)) return 'rhythmus: bis muss ein Tag (JJJJ-MM-TT) sein'
  return { proWoche: [p[0], p[1]], bis: r.bis }
}

/** Gegenprobe am Zitat: wöchentlicher Takt, Spanne und Enddatum stehen darin, das Ende liegt nicht vor dem Artikel. */
export function pruefeRhythmus(x: Rhythmus, zitat: string, veroeffentlicht: string): string | undefined {
  const takt = WOECHENTLICH.exec(zitat)
  if (!takt) return 'rhythmus, aber das Zitat nennt keinen wöchentlichen Takt'
  /* Nur die Zahl beim Takt zählt: „die ersten drei Episoden“ im Satz davor ist keine Folgenzahl je Woche. */
  const nah = zitat.slice(Math.max(0, takt.index - 60), takt.index + takt[0].length + 60)
  const [von, bis] = x.proWoche
  const steht = [...nah.matchAll(SPANNE)].some((m) => zahl(m[1]!) === von && zahl(m[2] ?? m[1]!) === bis)
  if (!steht) return `rhythmus: ${von}–${bis} Folgen je Woche stehen nicht im Zitat`
  if (!findDates(zitat, veroeffentlicht, true).some((d) => d.iso === x.bis)) return `Enddatum ${x.bis} steht nicht im Zitat`
  return x.bis < veroeffentlicht ? 'Enddatum liegt vor dem Artikeldatum' : undefined
}
