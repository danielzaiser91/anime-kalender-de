import { ANISEARCH_ID_BASIS, FORMAT } from './anisearch-titel.ts'
import { MAL_AUSNAHMEN } from '../lib/mal-dubletten.ts'

/**
 * **Dasselbe Werk als AniList-Katalogtitel und als aniSearch-Zeile ist eine Dublette** (Daniel, 09.10.2026: „Laid-Off Cheat-Granting Mage"
 * zweimal; gemessen 2.400 Katalogzeilen). Die aniSearch-Zeilen kommen aus `data/anisearch-eintraege.json`, der AniList-Katalog hinter dem
 * Schalter kommt später dazu — keiner kannte den anderen, und `anisearch.json` ordnet nur Titel zu, die einmal abgerufen wurden.
 *
 * Dasselbe Werk heißt: gleiche MAL-Kennung, gleiche Formatklasse, Jahr höchstens eins daneben und gleiche Folgenzahl, wo beide sie nennen.
 * Ein Special oder Teil unter der MAL der Serie unterscheidet sich in Format oder Folgen und bleibt (`MAL_AUSNAHMEN` zusätzlich).
 * Nur Zeilen **ohne** Deutsch (`dub: '-'`) werden zusammengeführt; mit Deutsch trägt die Zeile eine Erstausgabe, die die Handdatei
 * (`data/anisearch-ids-hand.yaml`) übernimmt. Bei mehr als einem Treffer auf einer der beiden Seiten entscheidet das Skript nicht.
 */
export type KatalogKandidat = { id: number; mal?: number; format?: string | null; jahr?: number | null; folgen?: number | null }
type Eintrag = { t?: string; mal?: number; ty: string; y?: number; f?: number; dub: string }

/**
 * AniList kennt `TV_SHORT`, aniSearch nur „TV-Serie"; asiatische Web-Serien führt aniSearch als „TV-Serie", AniList als `ONA`
 * (Magical Explorer, 09.10.2026: gleiche MAL, 13 Folgen, gleicher Start). Beide Seiten gelten als eine Klasse.
 */
const klasse = (format: string | null | undefined) => (format === 'TV_SHORT' || format === 'ONA' ? 'TV' : format ?? '?')

/** Passt die aniSearch-Zeile zum AniList-Katalogtitel als dasselbe Werk? */
export function gleichesWerk(e: Eintrag, k: KatalogKandidat): boolean {
  if (!e.mal || e.mal !== k.mal) return false
  if (klasse(FORMAT[e.ty] ?? 'SPECIAL') !== klasse(k.format)) return false
  if (e.y && k.jahr && Math.abs(e.y - k.jahr) > 1) return false
  return !(e.f && k.folgen && e.f !== k.folgen)
}

/**
 * **Ein Katalogtitel, den aniSearch in Cours zerlegt** (Tougen Anki: Nikko-Kegon-Falls-Arc, 09.10.2026): AniList führt 24 Folgen, aniSearch zwei Zeilen zu je 12 —
 * die erste mit der MAL-Kennung, die zweite („… - Dai 2 Cour") ohne, ihr Name beginnt mit dem der ersten und trägt eine Teilzählung. Führt AniList 24 Folgen, gehen beide
 * Zeilen in der Zahl auf; führt es nur 12, ist die erste schon `gleichesWerk`, und die weitere gehört trotzdem zum Bogen unter derselben MAL. Gibt die Kennungen der Zeilen
 * zurück, sonst leer.
 */
const TEILZAEHLUNG = /(?:\d\s*cour|cour\s*\d|part\s*\d|teil\s*\d)/i
function coursZeilen(e: Eintrag, asId: number, k: KatalogKandidat, eintraege: Record<string, Eintrag>): number[] {
  if (!e.mal || e.mal !== k.mal || !e.t || !e.f || !k.folgen || e.f > k.folgen) return []
  if (klasse(FORMAT[e.ty] ?? 'SPECIAL') !== klasse(k.format) || (e.y && k.jahr && Math.abs(e.y - k.jahr) > 1)) return []
  const teile = Object.entries(eintraege).filter(([id, b]) => Number(id) !== asId && !b.mal && b.dub === '-' && b.ty === e.ty && b.f && b.t?.startsWith(`${e.t} - `) && TEILZAEHLUNG.test(b.t.slice(e.t!.length)) && (!b.y || !e.y || b.y - e.y <= 1))
  const passt = e.f === k.folgen ? teile.length > 0 : e.f + teile.reduce((s, [, b]) => s + b.f!, 0) === k.folgen
  return passt ? [asId, ...teile.map(([id]) => Number(id))] : []
}

type Ausgeliefert = { id: number; malId?: number; anisearchId?: number; format?: string | null; jpYear?: number | null; episodes?: number | null }

/**
 * Invariante an der **ausgelieferten** Ausgabe (`titles.json` + `ohne-synchro.json`): keine aniSearch-Zeile ohne Deutsch neben einem AniList-Titel
 * desselben Werks. Dasselbe Werk heißt hier: der AniList-Titel trägt die aniSearch-Kennung der Zeile, oder `gleichesWerk` trifft eindeutig.
 * Die Regel oben hat sie vorher entfernt; was bleibt, ist ein Fehler der Regel — oder ein Bestand, der nicht neu gebaut wurde.
 * Zeilen mit Deutsch (`d`/`p`/`c`) und `MAL_AUSNAHMEN` sind ausgenommen (Handdatei bzw. begründet). Leer heißt in Ordnung.
 */
export function anisearchZeilenDoppelt(ausgeliefert: Ausgeliefert[], eintraege: Record<string, Eintrag>): string[] {
  const anilist = ausgeliefert.filter((t) => t.id < ANISEARCH_ID_BASIS)
  const gebunden = new Map<number, number>()
  for (const t of anilist) if (t.anisearchId) gebunden.set(t.anisearchId, t.id)
  const zeilen = [...new Set(ausgeliefert.filter((t) => t.id >= ANISEARCH_ID_BASIS).map((t) => t.id))]
    .filter((id) => eintraege[String(id - ANISEARCH_ID_BASIS)]?.dub === '-' && !MAL_AUSNAHMEN[id - ANISEARCH_ID_BASIS])
  const katalog = anilist.map((t) => ({ id: t.id, mal: t.malId, format: t.format, jahr: t.jpYear, folgen: t.episodes }))
  const paare = new Map<number, number>(findeAnisearchDubletten(zeilen, [], katalog, eintraege).zeilenWeg)
  for (const id of zeilen) {
    const partner = gebunden.get(id - ANISEARCH_ID_BASIS)
    if (partner) paare.set(id, partner)
  }
  return [...paare].map(([zeile, titel]) => `aniSearch-Zeile ${zeile} und AniList-Titel ${titel} sind dasselbe Werk (Kennung oder MAL/Format/Jahr/Folgen) und stehen beide in der Ausgabe`)
}

export type DublettenUrteil = {
  /** aniSearch-Zeilen hinter dem Schalter, die entfallen: Zeilenkennung → Katalogtitel, der sie vertritt. */
  zeilenWeg: Map<number, number>
  /** Katalogtitel, die entfallen, weil die aniSearch-Zeile im Hauptbestand steht (oder einen Termin trägt): Katalogkennung → Zeilenkennung. */
  katalogWeg: Map<number, number>
}

/**
 * @param hinter  Kennungen der aniSearch-Zeilen hinter dem Schalter (verschoben)
 * @param haupt   Kennungen der aniSearch-Zeilen im Hauptbestand oder mit Termin/Meldung (`geschuetzt`): ihre Zeile bleibt
 * @param katalog AniList-Katalog hinter dem Schalter
 */
export function findeAnisearchDubletten(hinter: number[], haupt: number[], katalog: KatalogKandidat[], eintraege: Record<string, Eintrag>): DublettenUrteil {
  const nachMal = new Map<number, KatalogKandidat[]>()
  for (const k of katalog) if (k.mal) nachMal.set(k.mal, [...(nachMal.get(k.mal) ?? []), k])
  const treffer = (zeilenId: number): KatalogKandidat | undefined => {
    const asId = zeilenId - ANISEARCH_ID_BASIS
    const e = eintraege[String(asId)]
    if (!e || e.dub !== '-' || MAL_AUSNAHMEN[asId]) return undefined
    const passend = (nachMal.get(e.mal ?? 0) ?? []).filter((k) => gleichesWerk(e, k))
    return passend.length === 1 ? passend[0] : undefined
  }
  const katalogUrteil = new Map<number, number[]>()
  const aufnehmen = (zeilenId: number): void => {
    const k = treffer(zeilenId)
    if (k) katalogUrteil.set(k.id, [...(katalogUrteil.get(k.id) ?? []), zeilenId])
  }
  const alle = [...hinter, ...haupt]
  for (const id of alle) aufnehmen(id)
  const urteil: DublettenUrteil = { zeilenWeg: new Map(), katalogWeg: new Map() }
  const istHaupt = new Set(haupt)
  for (const [katalogId, zeilen] of katalogUrteil) {
    if (zeilen.length !== 1) continue
    const zeile = zeilen[0]!
    if (istHaupt.has(zeile)) urteil.katalogWeg.set(katalogId, zeile)
    else urteil.zeilenWeg.set(zeile, katalogId)
  }
  const frei = new Set(hinter)
  for (const id of hinter) {
    const asId = id - ANISEARCH_ID_BASIS
    const e = eintraege[String(asId)]
    if (!e || e.dub !== '-' || MAL_AUSNAHMEN[asId]) continue
    for (const k of nachMal.get(e.mal ?? 0) ?? []) {
      const zeilen = coursZeilen(e, asId, k, eintraege).map((a) => ANISEARCH_ID_BASIS + a)
      if (!zeilen.length || (katalogUrteil.get(k.id) ?? [id]).some((z) => z !== id) || !zeilen.every((z) => frei.has(z) && !MAL_AUSNAHMEN[z - ANISEARCH_ID_BASIS])) continue
      for (const z of zeilen) urteil.zeilenWeg.set(z, k.id)
    }
  }
  return urteil
}

/**
 * **Trägt ein AniList-Katalogtitel die Kennung einer Zeile (aniSearchs MAL-Brücke, Handdatei), ist die Zeile sein aniSearch-Eintrag** — auch wenn Folgenzahl oder Format
 * abweichen (Alice in Cyberland: 2 gegen 1 Folge, gleiche MAL, gleicher Start). Die Ausgabe-Invariante (`anisearchZeilenDoppelt`) verlangt das; der Bau lässt solche Zeilen
 * hinter dem Schalter entfallen, sofern `urteil` über sie oder den Titel nicht schon entschieden hat. Ergänzt `urteil.zeilenWeg`.
 */
export function zeilenMitKennungWeg(hinter: number[], katalogKennungen: Map<number, number>, eintraege: Record<string, Eintrag>, urteil: DublettenUrteil): void {
  const frei = new Set(hinter)
  for (const [titelId, asId] of katalogKennungen) {
    const zeile = ANISEARCH_ID_BASIS + asId
    if (titelId >= ANISEARCH_ID_BASIS || !frei.has(zeile) || urteil.zeilenWeg.has(zeile) || urteil.katalogWeg.has(titelId)) continue
    if (eintraege[String(asId)]?.dub !== '-' || MAL_AUSNAHMEN[asId]) continue
    urteil.zeilenWeg.set(zeile, titelId)
  }
}
