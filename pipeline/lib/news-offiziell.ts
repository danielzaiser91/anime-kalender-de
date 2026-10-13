/**
 * **Meldungen offizieller Websites** (Art `offiziell`; Daniel, 12.10.2026: Die Website eines Titels gilt als offiziell, wenn die Trailer-Beschreibung sie verlinkt, und ihre
 * Meldungen zählen als Quelle).
 *
 * Quelle ist die Handdatei `data/offizielle-meldungen.yaml` — die **Freigabe**: Der Sammler (`pipeline/fetch-offizielle-news.ts`) legt nur Vorschläge ab
 * (`data/proposals/offizielle-news.json`); erst ein Eintrag hier macht daraus eine Meldung. Die Meldung steht an dem Tag, den die Seite ihr gibt (`datum`), und wird nie
 * umgeschrieben (`docs/wissen/news-plan.md`, Grundsatz 1). Sie trägt die Überschrift der Seite wörtlich als Beleg; der Satz der Kachel sagt in einer deutschen Vorlage nur,
 * was die Kategorie bedeutet.
 *
 * Offizielle Meldungen sind selten (etwa eine je Woche) und veralten langsam: eine Staffelankündigung gilt, bis die Staffel läuft. Deshalb ein längeres Fenster als die
 * 120 Tage der übrigen Arten und eine Ausnahme von der Obergrenze der Datei.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { NewsEintrag, NewsArt, NewsMeldung, OffiziellKategorie, Title } from '../../shared/types.ts'
import { addDays } from '../../shared/time.ts'
import { hostVon } from '../../shared/quelle.ts'

/** So lange steht eine freigegebene Meldung auf der Seite (die übrigen Arten 120 Tage). */
export const FENSTER_OFFIZIELL_TAGE = 365

/** Die Handdatei der Freigaben (der Bau liest sie, `pipeline/offizielle-freigabe.ts` hängt an). */
export const OFFIZIELL_DATEI = 'data/offizielle-meldungen.yaml'

export const KATEGORIEN_OFFIZIELL: readonly OffiziellKategorie[] = ['staffel', 'film', 'synchro', 'termin']

/** Ein freigegebener Vorschlag. `id` ist die des Vorschlags (Hash in `data/proposals/offizielle-news.json`); sie macht den Gedächtnisschlüssel stabil, auch wenn der Tag korrigiert wird. */
export interface OffizielleMeldung {
  id: string
  titleId: number
  kategorie: OffiziellKategorie
  /** Der Tag, den die Seite der Meldung gibt. */
  datum: string
  url: string
  /** Die Überschrift wörtlich, in der Sprache der Seite. */
  titel: string
  sprache: string
  /** Wer die Meldung freigegeben hat und wann — ohne Freigabe keine Meldung. */
  freigabe: string
}

type Roh = Partial<Record<keyof OffizielleMeldung, unknown>>

/** Alles, was an einem Eintrag nicht stimmt; leer = in Ordnung. */
export function offiziellFehler(e: Roh, ids: Set<string> = new Set()): string[] {
  const fehler: string[] = []
  const text = (feld: keyof OffizielleMeldung): boolean => typeof e[feld] === 'string' && (e[feld] as string).trim() !== ''
  if (!text('id') || ids.has(e.id as string)) fehler.push('id fehlt oder kommt doppelt vor')
  if (!Number.isInteger(e.titleId)) fehler.push('titleId fehlt')
  if (!KATEGORIEN_OFFIZIELL.includes(e.kategorie as OffiziellKategorie)) fehler.push(`kategorie muss eine von ${KATEGORIEN_OFFIZIELL.join(', ')} sein`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.datum ?? ''))) fehler.push('datum ist kein JJJJ-MM-TT')
  if (!/^https:\/\/[^\s/]+\//.test(String(e.url ?? ''))) fehler.push('url ist keine https-Adresse')
  if (!text('titel')) fehler.push('titel (Überschrift wörtlich) fehlt')
  if (!/^[a-z]{2}$/.test(String(e.sprache ?? ''))) fehler.push('sprache ist kein zweistelliger Code')
  if (!text('freigabe')) fehler.push('freigabe fehlt')
  return fehler
}

/** Die Handdatei laden. Ein Fehler bricht den Bau ab, statt still eine halbe Meldung zu zeigen. */
export function offizielleLaden(wurzel: string): OffizielleMeldung[] {
  const roh = yaml.load(readFileSync(resolve(wurzel, OFFIZIELL_DATEI), 'utf8')) as { eintraege?: Roh[] } | null
  const ids = new Set<string>()
  return (roh?.eintraege ?? []).map((e, i) => {
    const fehler = offiziellFehler(e, ids)
    if (fehler.length) throw new Error(`${OFFIZIELL_DATEI}, Eintrag ${i + 1} (${String(e?.id)}): ${fehler.join('; ')}`)
    ids.add(e.id as string)
    return e as unknown as OffizielleMeldung
  })
}

let geladen: OffizielleMeldung[] | undefined

/** Die Meldungen im Format von `baueNews`; ein Titel, der in `titles` fehlt, ergibt keine Meldung (`baueNews` läuft auch für Teilmengen wie die Cartoons) — ob jede Kennung im Bestand steht, prüft `check-news-offiziell-bestand.ts`. */
export function offizielleMeldungen(
  titles: Iterable<Title>,
  liste: OffizielleMeldung[] = (geladen ??= offizielleLaden(process.cwd())),
): (NewsMeldung & { schluessel: string; fallback: string; titel: Title })[] {
  const nachId = new Map([...titles].map((t) => [t.id, t]))
  return liste.flatMap((e) => {
    const t = nachId.get(e.titleId)
    if (!t) return []
    return [
      {
        schluessel: `offiziell:${e.id}`,
        fallback: e.datum,
        art: 'offiziell' as const,
        titel: t,
        kategorie: e.kategorie,
        quelle: e.url,
        belege: [{ url: e.url, name: hostVon(e.url), veroeffentlichtAm: e.datum, ueberschrift: { text: e.titel, sprache: e.sprache } }],
      },
    ]
  })
}

/** Wo das Fenster einer Art beginnt: offizielle Meldungen 365 Tage zurück, alle anderen am `standard` (120 Tage). */
export const fensterBeginn = (art: NewsArt, heute: string, standard: string): string => (art === 'offiziell' ? addDays(heute, -FENSTER_OFFIZIELL_TAGE) : standard)

/** Trägt der Eintrag eine offizielle Meldung? Dann gilt für ihn die Obergrenze der Datei nicht. */
export const traegtOffizielle = (e: NewsEintrag): boolean => e.meldungen.some((m) => m.art === 'offiziell')
