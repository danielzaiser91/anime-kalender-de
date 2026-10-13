/**
 * Die Antwort einer offiziellen Seite in Meldungen verwandeln: Feed (RSS/Atom), WordPress-REST und JSON-Liste teilen sich einen Leser, HTML hat einen eigenen
 * (`offiziell-html.ts`). Gespeichert wird nur Überschrift, Tag und Adresse; Volltexte werden verworfen.
 */
import { decodeEntities } from './feed.ts'
import { datumIn, tageZwischen } from './offiziell-datum.ts'
import { leseHtml } from './offiziell-html.ts'

export type Muster = 'feed' | 'wp' | 'json' | 'html'

export interface Eintrag {
  titel: string
  datum: string
  url: string
}

/** Höchstens so viele Meldungen je Seite; die Listen führen neueste zuerst, ältere sind für uns ohnehin zu alt. */
export const HOECHSTENS_JE_SEITE = 60

const ohneTags = (s: string): string => decodeEntities(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * RSS (`item`) und Atom (`entry`). Das Datum wird so gelesen, wie die Seite es schreibt — in ihrer Ortszeit; eine Umrechnung nach Berlin
 * verschöbe eine Meldung kurz nach Mitternacht in Japan auf den Vortag.
 */
function leseFeed(xml: string): Eintrag[] {
  return xml.split(/<(?:item|entry)[\s>]/).slice(1).flatMap((block) => {
    const titel = /<title[^>]*>([\s\S]*?)<\/title>/.exec(block)?.[1]
    const link = /<link[^>]*?href=["']([^"']+)["']/.exec(block)?.[1] ?? /<link>([\s\S]*?)<\/link>/.exec(block)?.[1]
    const datum = datumIn(decodeEntities(/<(?:pubDate|published|updated|dc:date)>([\s\S]*?)</.exec(block)?.[1] ?? ''))
    return titel && link && datum ? [{ titel: ohneTags(titel), datum, url: ohneTags(link) }] : []
  })
}

type Objekt = Record<string, unknown>
const istObjekt = (x: unknown): x is Objekt => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Die erste Liste von Objekten im JSON: oben, sonst unter einem Schlüssel (`news`, `data.list`, …), höchstens drei Ebenen tief. */
function ersteListe(x: unknown, tiefe = 0): Objekt[] | undefined {
  if (Array.isArray(x)) return x.every(istObjekt) && x.length ? (x as Objekt[]) : undefined
  if (!istObjekt(x) || tiefe >= 3) return undefined
  for (const v of Object.values(x)) {
    const liste = ersteListe(v, tiefe + 1)
    if (liste) return liste
  }
  return undefined
}

const TITEL_FELDER = ['title', 'name', 'subject', 'headline', 'ttl', 'text']
const DATUM_FELDER = ['date', 'publishedAt', 'published', 'day', 'createdAt', 'created', 'dt', 'datetime', 'updatedAt', 'modified']
const URL_FELDER = ['directLinkUrl', 'url', 'link', 'href', 'permalink']

function text(wert: unknown): string | undefined {
  if (typeof wert === 'string') return ohneTags(wert) || undefined
  if (istObjekt(wert) && typeof wert.rendered === 'string') return ohneTags(wert.rendered) || undefined
  return undefined
}

function ersteVon(o: Objekt, felder: string[]): string | undefined {
  for (const f of felder) {
    const t = text(o[f])
    if (t) return t
  }
  return undefined
}

/** Die Adresse einer Meldung: aus der Vorlage (`…detail.html?d={uniqueId}`), wo die Seite sie nicht selbst nennt, sonst aus ihrem Link, sonst die Liste. */
function adresseVon(o: Objekt, basis: string, vorlage?: string): string {
  const roh = vorlage ? vorlage.replace(/\{(\w+)\}/g, (_, feld: string) => String(o[feld] ?? '')) : ersteVon(o, URL_FELDER)
  return roh ? new URL(roh, basis).toString() : basis
}

function leseJson(roh: string, basis: string, vorlage?: string): Eintrag[] {
  const liste = ersteListe(JSON.parse(roh))
  return (liste ?? []).flatMap((o) => {
    const titel = ersteVon(o, TITEL_FELDER)
    const datum = datumIn(ersteVon(o, DATUM_FELDER) ?? '')
    return titel && datum ? [{ titel, datum, url: adresseVon(o, basis, vorlage) }] : []
  })
}

/**
 * Meldungen aus einer Antwort. Was in der Zukunft datiert ist (Termine im Text, nicht Veröffentlichungen), entfällt; doppelte Zeilen auch.
 * Eine Antwort, die nicht lesbar ist, ergibt eine leere Liste — der Aufrufer zählt das als „leer“, nicht als Abbruch.
 */
export function lese(muster: Muster, roh: string, basis: string, heute: string, vorlage?: string): Eintrag[] {
  let alle: Eintrag[] = []
  try {
    alle = muster === 'feed' ? leseFeed(roh) : muster === 'html' ? leseHtml(roh, basis) : leseJson(roh, basis, vorlage)
  } catch {
    return []
  }
  const gesehen = new Set<string>()
  const ergebnis: Eintrag[] = []
  for (const e of alle) {
    const schluessel = `${e.datum}|${e.titel}`
    // Eine Adresse als „Überschrift“ ist ein Verweis auf eine fremde Seite (Shop, YouTube), keine Meldung der Seite.
    if (gesehen.has(schluessel) || tageZwischen(heute, e.datum) > 1 || /^https?:\/\//i.test(e.titel)) continue
    gesehen.add(schluessel)
    ergebnis.push(e)
  }
  return ergebnis.sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, HOECHSTENS_JE_SEITE)
}
