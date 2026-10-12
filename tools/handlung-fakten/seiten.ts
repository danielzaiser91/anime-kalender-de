/**
 * Wikipedia-Seiten zu einem Titel finden, in dieser Reihenfolge: Wikidata-Brücke des Titels (Ebene „titel“), Brücke eines Reihenmitglieds (Ebene „reihe“), dann geratene Namen.
 * Im PoC (12.10.2026, 10 Titel) fand Raten 9 von 10, die Brücke 1 von 10 — beides, damit keine Seite entgeht.
 */
import { seitenKandidaten } from './kandidaten.ts'
import { asSchluessel, malSchluessel } from './wikidata.ts'
import type { Bruecke, Seiten } from './wikidata.ts'
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
  geraten: boolean
  hinweis?: string
}

export interface Sammlung {
  funde: Fund[]
  /** Seiten, die nach allen Wiederholungen nicht lieferbar waren (der nächste Lauf holt sie nach). */
  fehler: string[]
}

type Ausgang = 'gefunden' | 'abgelehnt' | 'fehlt'

const SPRACHEN: Sprache[] = ['en', 'de']
const MAX_REIHE_BRUECKE = 2
const ZUSATZ: Record<Sprache, string[]> = { en: ['anime', 'TV series', 'film'], de: ['Anime', 'Fernsehserie', 'Film'] }

const mal = (id?: number) => (id ? malSchluessel(id) : undefined)
const as = (id?: number) => (id ? asSchluessel(id) : undefined)

const seitenAus = (bruecke: Bruecke, schluessel: (string | undefined)[]): Seiten[] =>
  schluessel.map((s) => (s ? bruecke[s] : undefined)).filter((s): s is Seiten => !!s)

/** Nennt die Seite das Jahr des Titels? Sonst meint eine gleichnamige Seite vermutlich etwas anderes oder die ganze Reihe. */
const nenntJahr = (text: string, jahr?: number) => !jahr || text.includes(String(jahr))

export async function sammleWikipedia(l: Luecke, bruecke: Bruecke, hole: Holer): Promise<Sammlung> {
  const funde: Fund[] = []
  const fehler: string[] = []
  const hat = (sprache: Sprache, ebene?: Ebene) => funde.some((f) => f.sprache === sprache && (!ebene || f.ebene === ebene))

  /** „abgelehnt“ heißt: die Seite gibt es, meint aber nicht diesen Titel — nur dann lohnt ein Zusatz wie „(anime)“. */
  async function versuche(sprache: Sprache, name: string, ebene: Ebene, geraten: boolean, via?: string): Promise<Ausgang> {
    const a = await hole(sprache, name)
    if (a.status === 'fehler') fehler.push(`${sprache}:${name}`)
    if (a.status !== 'ok' || !a.text || !a.datei) return 'fehlt'
    if (funde.some((f) => f.sprache === sprache && f.seite === a.seite)) return 'fehlt'
    if (geraten && !istAnimationsSeite(a.text)) return 'abgelehnt'
    const jahrOk = nenntJahr(a.text, l.jpYear)
    const umgeleitet = !!a.weitergeleitetVon
    const hinweise = [via, umgeleitet ? `Weiterleitung von „${a.weitergeleitetVon}“` : undefined, jahrOk ? undefined : `Jahr ${l.jpYear} steht nicht im Text`]
    const hinweis = hinweise.filter(Boolean).join('; ') || undefined
    const art: Ebene = geraten && (umgeleitet || !jahrOk) ? 'reihe' : ebene
    funde.push({ sprache, seite: a.seite, datei: a.datei, text: a.text, ebene: art, geraten, hinweis })
    return 'gefunden'
  }

  async function ausBruecke(): Promise<void> {
    const eigen = seitenAus(bruecke, [mal(l.malId), l.geteilt ? undefined : as(l.anisearchSeite)])
    for (const s of eigen) for (const sp of SPRACHEN) if (s[sp] && !hat(sp, 'titel')) await versuche(sp, s[sp]!, 'titel', false)
    const geteilt = l.geteilt ? seitenAus(bruecke, [as(l.anisearchSeite)]).map((s) => ({ s, via: 'geteilte aniSearch-Seite' })) : []
    const mitglieder = l.geschwister.flatMap((g) => seitenAus(bruecke, [mal(g.malId), as(g.anisearchSeite)]).map((s) => ({ s, via: `über Reihenmitglied „${g.name}“` })))
    let treffer = 0
    for (const { s, via } of [...geteilt, ...mitglieder]) {
      for (const sp of SPRACHEN) {
        if (!s[sp] || hat(sp) || treffer >= MAX_REIHE_BRUECKE) continue
        if ((await versuche(sp, s[sp]!, 'reihe', false, via)) === 'gefunden') treffer++
      }
    }
  }

  async function ausRaten(): Promise<void> {
    for (const k of seitenKandidaten(l, l.reiheNamen)) {
      for (const sp of SPRACHEN) {
        if (hat(sp, 'titel') || (k.ebene === 'reihe' && hat(sp))) continue
        if ((await versuche(sp, k.name, k.ebene, true)) !== 'abgelehnt') continue
        for (const z of ZUSATZ[sp]) if ((await versuche(sp, `${k.name} (${z})`, k.ebene, true)) === 'gefunden') break
      }
    }
  }

  await ausBruecke()
  await ausRaten()
  return { funde, fehler }
}
