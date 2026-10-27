import type { Release } from '@shared/types.ts'
import { kurzeAusgabe } from './disc-ausgabe.ts'
import { artikelUrl, FORMATE, type Ausgabe, type Format } from './disc-ausgaben.ts'
import { haendlerAus } from './termin-zeile.tsx'

/*
  **Eine Variante, eine Zeile.** Eine Variante ist, was man kauft: Gesamtausgabe, Box, Volume, Film — mit Edition und den Formaten,
  in denen es sie gibt. Doppelte Zeilen derselben Ausgabe (einmal als Termin des Bestands, einmal als aniSearch-Artikel) werden zu
  einer; aniSearch ist Quelle, nie Händler (Daniel, 27.10.2026, Mockup B3).
*/

export type Art = 'gesamt' | 'box' | 'vol' | 'film' | 'sonst'

/** Reihenfolge der Gruppen: wichtigste zuerst. */
export const ARTEN: Art[] = ['gesamt', 'box', 'vol', 'film', 'sonst']

export interface Haendler {
  name: string
  url: string
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
  /** Der aniSearch-Artikel der Ausgabe, falls es einen gibt (Quellenangabe, kein Kaufziel). */
  quelle?: string
  release?: Release
}

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
const filmTitel = (a: Ausgabe): string => a.name.replace(/^Film\s*\d+:\s*/i, '')

/** „Sammelschuber (ohne Inhalt)“ → die Klammer ist die Edition; sonst die gekürzte Editionsangabe, bei Filmen der Filmtitel. */
function editionDer(art: Art, a: Ausgabe): string {
  if (art === 'film') return filmTitel(a)
  if (art === 'sonst') return /\(([^)]*)\)/.exec(a.name)?.[1] ?? ''
  return editionKurz(editionRoh(a))
}

function ausAusgabe(a: Ausgabe, titel: string): Variante {
  const roh = artUndNummer(a.release ? a.release.name : a.name)
  const art: Art = roh.art === 'sonst' && a.gesamt ? 'gesamt' : roh.art
  const datumJe: Partial<Record<Format, string>> = {}
  for (const f of a.formate) datumJe[f] = a.datum
  const artikel = Object.values(a.artikel)[0]
  return {
    schluessel: a.schluessel,
    art,
    nummer: roh.nummer,
    name: kurzName(art, roh.nummer, a, titel),
    edition: editionDer(art, a),
    formate: a.formate,
    datumJe,
    haendler: a.shopUrl ? [{ name: haendlerAus(a.shopUrl), url: a.shopUrl }] : [],
    quelle: artikel ? artikelUrl(artikel) : undefined,
    release: a.release,
  }
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
    da.quelle ??= v.quelle
    da.haendler = [...da.haendler, ...v.haendler.filter((h) => !da.haendler.some((d) => d.url === h.url))]
    /* Ein Bestandstermin gilt für den Kalender; der Artikel nennt das Datum je Format — es bleibt das erste. */
    for (const f of v.formate) da.datumJe[f] ??= v.datumJe[f]
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
  return ARTEN.map((art) => ({ art, liste: liste.filter((v) => v.art === art) })).filter((g) => g.liste.length)
}

/** Gesamtausgaben und Boxen stehen offen, alles andere ist zugeklappt (Daniel: „Vol. nur ohne Gesamtausgabe“); ohne beide ist alles offen. */
export function startOffen(liste: Variante[], art: Art): boolean {
  const gross = liste.some((v) => v.art === 'gesamt' || v.art === 'box')
  return !gross || art === 'gesamt' || art === 'box'
}

/** Welche Formate in diesen Varianten vorkommen — die Spalten der Matrix, in fester Reihenfolge. */
export function spaltenVon(liste: Variante[]): Format[] {
  return FORMATE.filter((f) => liste.some((v) => v.formate.includes(f)))
}

/** „2019–2026“ bzw. „2025“: die Spanne der Daten einer Gruppe, damit man ohne Aufklappen weiß, wo man landet; ohne Daten leer. */
export function jahre(liste: Variante[]): string {
  const alle = liste.map(spaetestes).filter(Boolean).map((d) => d.slice(0, 4)).sort()
  if (!alle.length) return ''
  return alle[0] === alle[alle.length - 1] ? alle[0] : `${alle[0]}–${alle[alle.length - 1]}`
}
