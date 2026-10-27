import type { Release } from '@shared/types.ts'
import { kurzeAusgabe } from '../../src/components/detail/disc-ausgabe.ts'
import { FORMATE, type Ausgabe, type Format } from './disc-bereich-daten.ts'

/*
  Datenmodell des Mockups `disc-bereich-2` (Runde 2, 27.10.2026): **eine Variante, eine Zeile**. Eine Variante ist, was man kauft:
  Gesamtausgabe, Box, Volume, Film — mit Edition und den Formaten, in denen es sie gibt. Doppelte Zeilen derselben Ausgabe
  (einmal als Termin des Bestands, einmal als aniSearch-Artikel) werden zu einer; aniSearch ist Quelle, nie Händler.
*/

export type Art = 'gesamt' | 'box' | 'vol' | 'film' | 'sonst'

export const ART_NAME: Record<Art, string> = { gesamt: 'Gesamtausgaben', box: 'Boxen', vol: 'Volumes', film: 'Filme', sonst: 'Sonstiges' }

export interface Haendler {
  name: string
  url: string
  /** Wahr, wenn die Daten keine ASIN nennen — das Mockup zeigt den Link, wie er mit ASIN aussähe (Pipeline-Fehler, nicht Mockup). */
  platzhalter: boolean
}

export interface Variante {
  schluessel: string
  art: Art
  nummer?: number
  /** Erste Spalte, kurz: „Box 1“, „Vol. 3“, „Gesamt“ — ohne Reihentitel. */
  name: string
  /** Edition in zwei, drei Wörtern: „Steelcase“, „Limited + Schuber“, „30th Anniversary“. */
  edition: string
  formate: Format[]
  /** ISO-Datum je Format (`2025-08-00` heißt: nur der Monat ist bekannt). */
  datumJe: Partial<Record<Format, string>>
  haendler: Haendler[]
  release?: Release
}

const PLATZHALTER = 'https://www.amazon.de/dp/ASIN-FEHLT'

/** Art und Nummer aus dem Namen: „Vol. 3/3: …“, „Box 01: …“, „DAN DA DAN (Staffel 2) – Vol. 3“, „Gesamtausgabe: …“. */
export function artUndNummer(name: string): { art: Art; nummer?: number } {
  if (/^Gesamtausgabe/i.test(name)) return { art: 'gesamt' }
  const treffer = /\b(Box|Vol\.?|Film)\s*0*(\d+)/i.exec(name)
  if (!treffer) return { art: 'sonst' }
  const wort = treffer[1].toLowerCase()
  return { art: wort === 'box' ? 'box' : wort === 'film' ? 'film' : 'vol', nummer: Number(treffer[2]) }
}

const MEDIUM = /\b(?:blu-?ray|dvd|4k(?: uhd)?)\b/gi

/** „Limited Steelcase Edition + Sammelschuber“ → „Steelcase + Schuber“; Medium und Reihentitel stehen schon anderswo. */
export function editionKurz(roh: string): string {
  let text = roh
    .replace(MEDIUM, ' ')
    .replace(/\bExklusive?\b/gi, ' ')
    .replace(/Sammelschuber/gi, 'Schuber')
    .replace(/\bmit\b/gi, '+')
    .replace(/\bEdition\b/gi, ' ')
  if (/steelcase/i.test(text)) text = text.replace(/\bLimited\b/gi, ' ')
  text = text.replace(/[,&]/g, ' ').replace(/\s+/g, ' ').replace(/\s\+\s*$/, '').trim()
  return text || (/limited/i.test(roh) ? 'Limited' : /exklusiv/i.test(roh) ? 'Exklusiv' : '')
}

const NUMMER_TEIL = /\b(?:Box|Vol\.?|Film)\s*0*\d+(?:\/\d+)?:?/gi

/** Die Editionsangabe ohne Nummer und Reihentitel: aus der Klammer („Box 1 (30th Anniversary Edition)“), dem Termin oder dem Artikelnamen. */
function editionRoh(a: Ausgabe): string {
  const name = a.release ? a.release.name : a.name
  const klammer = /\(([^)]*(?:Edition|Digipack|Exklusiv)[^)]*)\)/i.exec(name)?.[1]
  const quelle = a.release ? (kurzeAusgabe(a.release.edition) ?? '') : name
  return klammer ?? quelle.replace(NUMMER_TEIL, ' ').replace(/^\s*Gesamtausgabe:?/i, ' ')
}

/** „Vol. 3“, „Box 1“, „Gesamt“; ohne Nummer der Name des Eintrags ohne Reihentitel, Klammern und Kopfzeichen („Sammelschuber“). */
function kurzName(art: Art, nummer: number | undefined, a: Ausgabe, titel: string): string {
  const roh = a.release ? a.release.name : a.name
  if (/^Gesamtausgabe/i.test(roh)) return 'Gesamt'
  if (nummer !== undefined) return `${art === 'box' ? 'Box' : art === 'film' ? 'Film' : 'Vol.'} ${nummer}`
  const ohneTitel = roh.replace(new RegExp(titel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
  return ohneTitel.replace(/\([^)]*\)/g, '').replace(/^[\s–:-]+|[\s–:-]+$/g, '').trim() || 'Ausgabe'
}

/** Filmtitel („Film 01: Der tickende Wolkenkratzer“) stehen als Edition hinter der Nummer, sonst verlöre die Zeile ihren Namen. */
function filmTitel(a: Ausgabe): string {
  return a.name.replace(/^Film\s*\d+:\s*/i, '')
}

/** Eine Amazon-Suche ist kein Kaufziel (Daniel, 27.10.2026): nur `/dp/<ASIN>`; sonst Platzhalter, der die Pipeline-Lücke zeigt. */
export function haendlerVon(a: Ausgabe): Haendler[] {
  const url = a.release?.buyUrl ?? ''
  if (/anisearch\./i.test(url)) return [{ name: 'Amazon', url: PLATZHALTER, platzhalter: true }]
  if (/amazon\.[a-z.]+\/(?:[^?]*\/)?dp\/[A-Z0-9]{10}/i.test(url)) return [{ name: 'Amazon', url, platzhalter: false }]
  if (url && !/amazon\./i.test(url)) {
    const host = new URL(url).hostname.replace(/^www\./, '').split('.')[0]
    return [{ name: host.charAt(0).toUpperCase() + host.slice(1), url, platzhalter: false }]
  }
  return [{ name: 'Amazon', url: PLATZHALTER, platzhalter: true }]
}

/** „Sammelschuber (ohne Inhalt)“ → die Klammer ist die Edition; sonst die gekürzte Editionsangabe, bei Filmen der Filmtitel. */
function editionDer(art: Art, a: Ausgabe): string {
  if (art === 'film') return filmTitel(a)
  if (art === 'sonst') return /\(([^)]*)\)/.exec(a.name)?.[1] ?? ''
  return editionKurz(editionRoh(a))
}

function ausAusgabe(a: Ausgabe, titel: string): Variante {
  const roh = artUndNummer(a.release ? a.release.name : a.name)
  const art: Art = roh.art === 'sonst' && a.gesamt ? 'gesamt' : roh.art
  const nummer = roh.nummer
  const datumJe: Partial<Record<Format, string>> = {}
  for (const f of a.formate) datumJe[f] = a.datum
  const name = kurzName(art, nummer, a, titel)
  const edition = editionDer(art, a)
  return { schluessel: a.schluessel, art, nummer, name, edition, formate: a.formate, datumJe, haendler: haendlerVon(a), release: a.release }
}

/** Gleiche Art, Nummer und Edition sind dieselbe Ausgabe: Formate und Daten werden zusammengelegt, der Bestandstermin bleibt dran. */
export function fuegeZusammen(liste: Variante[]): Variante[] {
  const nachKey = new Map<string, Variante>()
  for (const v of liste) {
    const key = `${v.art}|${v.nummer ?? v.name}|${v.edition.toLowerCase()}`
    const da = nachKey.get(key)
    if (!da) {
      nachKey.set(key, { ...v, datumJe: { ...v.datumJe } })
      continue
    }
    da.release ??= v.release
    if (v.release) da.haendler = v.haendler
    for (const f of v.formate) {
      /* Ein Bestandstermin gilt für den Kalender; der Artikel nennt das Datum je Format — es bleibt das erste. */
      da.datumJe[f] ??= v.datumJe[f]
    }
    da.formate = FORMATE.filter((f) => da.formate.includes(f) || v.formate.includes(f))
  }
  return [...nachKey.values()]
}

/** Das späteste Datum der Variante — nach ihm wird sortiert (jüngste oben), ohne Datum zuletzt. */
export function spaetestes(v: Variante): string {
  return Object.values(v.datumJe).filter(Boolean).sort().pop() ?? ''
}

export function variantenVon(ausgaben: Ausgabe[], titel: string): Variante[] {
  return fuegeZusammen(ausgaben.map((a) => ausAusgabe(a, titel))).sort(
    (a, b) => spaetestes(b).localeCompare(spaetestes(a)) || (b.nummer ?? 0) - (a.nummer ?? 0) || a.name.localeCompare(b.name),
  )
}

/** Ein Datum ohne Tag („2026-09-00“) gilt für den Vergleich als Monatsende. */
export const istKommend = (datum: string | undefined, today: string): boolean => Boolean(datum) && datum!.replace(/-00$/, '-28') > today

/** „12.12.25“ statt „12.12.2025“; ohne Tag „Sep 26“. */
export function kompaktDatum(iso: string): string {
  const [j, m, t] = iso.split('-')
  if (t === '00') return `${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][Number(m) - 1]} ${j.slice(2)}`
  return `${t}.${m}.${j.slice(2)}`
}

/** Die Gruppen, in denen die Varianten stehen: wichtigste zuerst; leere entfallen. */
export function gruppenVon(liste: Variante[]): { art: Art; liste: Variante[] }[] {
  return (Object.keys(ART_NAME) as Art[]).map((art) => ({ art, liste: liste.filter((v) => v.art === art) })).filter((g) => g.liste.length)
}

/**
 * Was ohne Klick sichtbar ist: Gibt es Gesamtausgaben oder Boxen, stehen nur diese oben (Daniel: „Vol. nur ohne Gesamtausgabe“);
 * der Rest wandert in einen Ausklappbereich. Sonst ist alles sichtbar.
 */
export function hauptUndRest(liste: Variante[]): { haupt: Variante[]; rest: Variante[] } {
  const gross = liste.filter((v) => v.art === 'gesamt' || v.art === 'box')
  if (!gross.length) return { haupt: liste, rest: [] }
  return { haupt: gross, rest: liste.filter((v) => v.art !== 'gesamt' && v.art !== 'box') }
}

/** Welche Formate in diesen Varianten vorkommen — die Spalten der Matrix, in fester Reihenfolge. */
export function spaltenVon(liste: Variante[]): Format[] {
  return FORMATE.filter((f) => liste.some((v) => v.formate.includes(f)))
}
