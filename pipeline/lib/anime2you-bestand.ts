/**
 * Der Bestand der Claude-Extraktion (`data/proposals/anime2you-extraktion.json`): welche Artikel gelesen sind und welche Vorschläge daraus kamen.
 * Er speist keinen Bau – ein Vorschlag wird erst durch einen Handeintrag zum Termin.
 */
import { addDays } from '../../shared/time.ts'
import type { GepruefterVorschlag } from './anime2you-vorschlag.ts'

export interface GelesenerArtikel {
  am: string
  vorschlaege: number
  /** Gesetzt, wenn der Artikel nicht an Claude ging (kein Deutschland-Bezug). */
  uebersprungen?: string
}

export interface GespeicherterVorschlag extends GepruefterVorschlag {
  artikelId: string
  artikel: string
  /** Die Adresse des Artikels – der Beleg, vom Skript gesetzt, nie vom Modell. */
  quelle: string
  veroeffentlicht: string
  gelesenAm: string
}

export interface Bestand {
  gelesen: Record<string, GelesenerArtikel>
  vorschlaege: GespeicherterVorschlag[]
}

/** So lange bleibt ein gelesener Artikel im Bestand – länger reicht kein Feed zurück. */
export const AUFBEWAHREN_TAGE = 90

const schluessel = (v: GespeicherterVorschlag): string => [v.artikelId, v.titel, v.art, v.datum ?? '', v.plattform ?? v.anbieter ?? ''].join('|')
const titelSchluessel = (v: GespeicherterVorschlag): string => `${v.titel.toLowerCase().replace(/[^a-z0-9äöü]+/g, '')}|${v.plattform ?? v.sender ?? v.anbieter}`

/** Neue Vorschläge an den Bestand hängen (gleicher Artikel, Titel, Art, Tag und Weg nur einmal) und Altes nach `AUFBEWAHREN_TAGE` entfernen. */
export function ergaenzeBestand(alt: Bestand, neu: GespeicherterVorschlag[], gelesen: Record<string, GelesenerArtikel>, heute: string): Bestand {
  const grenze = addDays(heute, -AUFBEWAHREN_TAGE)
  const vorhanden = new Set(alt.vorschlaege.map(schluessel))
  const dazu = neu.filter((v) => !vorhanden.has(schluessel(v)))
  return {
    gelesen: Object.fromEntries(Object.entries({ ...alt.gelesen, ...gelesen }).filter(([, g]) => g.am >= grenze)),
    vorschlaege: [...alt.vorschlaege, ...dazu].filter((v) => v.gelesenAm >= grenze),
  }
}

/**
 * Widerspricht sich die Uhrzeit zwischen zwei Artikeln zum selben Titel und Weg (bei gleichem oder fehlendem Tag)? Dann trägt jeder der beiden eine
 * Warnung (YAIBA am 10.10.2026: 18:25 im eigenen Artikel, 18:30 im Schwesterartikel zu One Piece).
 */
export function mitWiderspruechen(liste: GespeicherterVorschlag[]): GespeicherterVorschlag[] {
  return liste.map((v) => {
    if (!v.uhrzeit) return v
    const andere = liste.filter(
      (w) => w.artikelId !== v.artikelId && w.uhrzeit && w.uhrzeit !== v.uhrzeit && titelSchluessel(w) === titelSchluessel(v) && (!w.datum || !v.datum || w.datum === v.datum),
    )
    const text = `Uhrzeit widerspricht ${andere.map((w) => `${w.uhrzeit} (Artikel ${w.artikelId})`).join(', ')} – gegenlesen`
    return andere.length && !v.warnungen.includes(text) ? { ...v, warnungen: [...v.warnungen, text] } : v
  })
}
