/**
 * Wikipedia-Seiten zu einem Titel durch Raten finden: eigene Namen (Ebene „titel“), dann Reihennamen (Ebene „reihe“). Eine Wikidata-Brücke gibt es nicht: die robots.txt von
 * query.wikidata.org sperrt `/sparql`, die von www.wikidata.org `/w/`, `/api/` und `/wiki/Special:` (geprüft 12.10.2026).
 */
import { seitenKandidaten } from './kandidaten.ts'
import type { Ebene, Luecke } from './typen.ts'
import type { Holer, Sprache } from './wikipedia.ts'
import { istAnimationsSeite } from './wikitext.ts'

export interface Fund {
  sprache: Sprache
  /** Seitenname nach Weiterleitung. */
  seite: string
  datei: string
  text: string
  ebene: Ebene
  hinweis?: string
}

export interface Sammlung {
  funde: Fund[]
  /** Seiten, die nach allen Wiederholungen nicht lieferbar waren (der nächste Lauf holt sie nach). */
  fehler: string[]
}

type Ausgang = 'gefunden' | 'abgelehnt' | 'fehlt'

const SPRACHEN: Sprache[] = ['en', 'de']
const ZUSATZ: Record<Sprache, string[]> = { en: ['anime', 'TV series', 'film'], de: ['Anime', 'Fernsehserie', 'Film'] }

/** Nennt die Seite das Jahr des Titels? Sonst meint eine gleichnamige Seite vermutlich etwas anderes oder die ganze Reihe. */
const nenntJahr = (text: string, jahr?: number) => !jahr || text.includes(String(jahr))

export async function sammleWikipedia(l: Luecke, hole: Holer): Promise<Sammlung> {
  const funde: Fund[] = []
  const fehler: string[] = []
  const hat = (sprache: Sprache, ebene?: Ebene) => funde.some((f) => f.sprache === sprache && (!ebene || f.ebene === ebene))

  /** „abgelehnt“ heißt: die Seite gibt es, meint aber nicht diesen Titel — nur dann lohnt ein Zusatz wie „(anime)“. */
  async function versuche(sprache: Sprache, name: string, ebene: Ebene): Promise<Ausgang> {
    const a = await hole(sprache, name)
    if (a.status === 'fehler') fehler.push(`${sprache}:${name}`)
    if (a.status !== 'ok' || !a.text || !a.datei) return 'fehlt'
    if (funde.some((f) => f.sprache === sprache && f.seite === a.seite)) return 'fehlt'
    if (!istAnimationsSeite(a.text)) return 'abgelehnt'
    const jahrOk = nenntJahr(a.text, l.jpYear)
    const umgeleitet = !!a.weitergeleitetVon
    const hinweise = [umgeleitet ? `Weiterleitung von „${a.weitergeleitetVon}“` : undefined, jahrOk ? undefined : `Jahr ${l.jpYear} steht nicht im Text`]
    const hinweis = hinweise.filter(Boolean).join('; ') || undefined
    const art: Ebene = umgeleitet || !jahrOk ? 'reihe' : ebene
    funde.push({ sprache, seite: a.seite, datei: a.datei, text: a.text, ebene: art, hinweis })
    return 'gefunden'
  }

  async function ausRaten(): Promise<void> {
    for (const k of seitenKandidaten(l, l.reiheNamen)) {
      for (const sp of SPRACHEN) {
        if (hat(sp, 'titel') || (k.ebene === 'reihe' && hat(sp))) continue
        if ((await versuche(sp, k.name, k.ebene)) !== 'abgelehnt') continue
        for (const z of ZUSATZ[sp]) if ((await versuche(sp, `${k.name} (${z})`, k.ebene)) === 'gefunden') break
      }
    }
  }

  await ausRaten()
  return { funde, fehler }
}
