import type { Title } from '../../shared/types.ts'
import type { Vorschlag } from './meldungen.ts'
import { ladeAnisearchAbruf } from './anisearch-verworfen.ts'
import { readJson } from './util.ts'

/**
 * **Titel einer Sammelartikel-Zeile im Bestand finden** (04.11.2026): 20 von 23 Zeilen in `nicht-zugeordnet.json` hatten
 * einen Titel im Bestand und scheiterten nur am Namen — „Cyberpunk: Edgerunners II“ (Bestand: „… 2“, II nur als aniSearch-Synonym),
 * „Love & Lies“ (Bestand: „Love and Lies“), „K: Seven Stories – Movie 1“ (Bestand: „… Movie 1 - R:B - Blaze“).
 * Gilt nur für Sammelartikel: Ihre Zeile trägt genau einen Titel in »Guillemets« plus Zusatz, die Überschriften anderer Meldungen nicht.
 */

/** Weitere Namen je Titel aus `data/anisearch.json` (`info.synonyms`, wie `synonyme.json`); `lies` ersetzt der Test. */
export function synonymeJeTitel(ids: number[], lies: typeof readJson = readJson): Map<number, string[]> {
  const anisearch = ladeAnisearchAbruf<{ info?: { synonyms?: string[] } }>(lies)
  const aus = new Map<number, string[]>()
  for (const id of ids) {
    const liste = anisearch[id]?.info?.synonyms
    if (liste?.length) aus.set(id, liste)
  }
  return aus
}

/** Wörter, an denen ein Namensrest keinen Beititel, sondern eine andere Staffel/einen anderen Teil meint. */
const TEIL_WORT = /^(season|staffel|part|teil|cour|final|chapter|\d+|ii|iii|iv|v|vi|vii|viii|ix|x|[2-9](nd|rd|th)|second|third|fourth)$/

export const istSammelMeldung = (v: Pick<Vorschlag, 'dates'>): boolean => Boolean(v.dates?.length) && v.dates!.every((d) => d.context === 'Sammelartikel')

/** Der Titel in den Guillemets der Sammelzeile; Staffel- und Filmwörter darin gehören zum Namen, nicht zur Teil-Angabe. */
export const sammelName = (articleTitle: string): string | undefined => /»([^«]+)«/.exec(articleTitle)?.[1]

/** Die Überschrift ohne den Namen: übrig bleibt der Zusatz („ – Staffel 4“), den allein die Teil-Erkennung lesen darf. */
export const ohneSammelName = (articleTitle: string): string => articleTitle.replace(/»[^«]+«/g, '')

/** Wörter eines Namens: klein, ohne Akzente und Apostroph, „&“ als „and“. */
export function namensWoerter(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['‘’`´]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

const meintFilm = (name: string) => /\b(movie|film)\b/i.test(name)
/** Ein Film-Wort im Namen verlangt einen Film, keines verlangt keinen. */
const formatPasst = (name: string, t: Title) => meintFilm(name) === (t.format === 'MOVIE')

function namenVon(t: Title, synonyme: Map<number, string[]>): string[] {
  return [t.titleDe, t.titleEn, t.titleRomaji, ...(synonyme.get(t.id) ?? [])].filter((n): n is string => Boolean(n))
}

/** Alle Titel, deren Name (auch Synonym) dem Namen gleicht; unter vier Zeichen gleicht keiner. */
function gleichnamige(name: string, titel: Title[], synonyme: Map<number, string[]>): Title[] {
  const frage = namensWoerter(name).join('')
  if (frage.length < 4) return []
  return titel.filter((t) => namenVon(t, synonyme).some((n) => namensWoerter(n).join('') === frage))
}

/**
 * Genau ein Titel, dessen Name mit allen Wörtern des Namens beginnt und dahinter nur einen Beititel führt
 * („K: Seven Stories Movie 1 - R:B - Blaze“). Mindestens zwei Wörter: „Mask“ soll nicht an „Mask Danshi“ hängen;
 * eine Zahl, ein Staffel- oder Teilwort dahinter ist ein anderer Teil, kein Beititel. „Eindeutig“ zählt auch die Titel
 * mit Teilwort dahinter: „Steel Ball Run … Phase 1“ neben „… Phase 2-3“ ist nicht eindeutig. Ein Zusatz hinter dem Namen
 * („2nd-3rd STAGE“) nennt einen bestimmten Teil und schließt den Namensanfang aus, außer er meint den ersten.
 */
function eindeutigerAnfang(name: string, zusatz: string, titel: Title[], synonyme: Map<number, string[]>): Title | undefined {
  const frage = namensWoerter(name)
  if (frage.length < 2 || !/^[\s–-]*$|^[\s–-]*(staffel|season|part)\s*0*1\s*$/i.test(zusatz)) return undefined
  const rest = (n: string) => {
    const w = namensWoerter(n)
    return w.length > frage.length && frage.every((x, i) => w[i] === x) ? w.slice(frage.length) : undefined
  }
  const treffer = titel.filter((t) => formatPasst(name, t) && namenVon(t, synonyme).some((n) => rest(n)))
  const nurBeititel = (t: Title) => namenVon(t, synonyme).some((n) => rest(n) && !rest(n)!.some((x) => TEIL_WORT.test(x)))
  return treffer.length === 1 && nurBeititel(treffer[0]!) ? treffer[0] : undefined
}

/**
 * Der Titel der Sammelzeile: der einzige mit gleichem Namen (auch Synonym); gibt es mehrere gleichnamige, keiner — der
 * Namensanfang springt dann nicht ein. Ohne gleichnamigen: der eindeutige Namensanfang; sonst `undefined`.
 */
export function sammelTitel(articleTitle: string, titel: Title[], synonyme: Map<number, string[]>): Title | undefined {
  const name = sammelName(articleTitle)
  if (!name) return undefined
  const gleich = gleichnamige(name, titel, synonyme)
  if (gleich.length) return gleich.length === 1 ? gleich[0] : undefined
  return eindeutigerAnfang(name, ohneSammelName(articleTitle), titel, synonyme)
}
