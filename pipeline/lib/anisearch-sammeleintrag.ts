import type { Title } from '../../shared/types.ts'
import type { AnisearchTermin } from './anisearch-termine.ts'
import { titelJeJustwatchKennung, type JwBefund } from './jw-vertrauen.ts'
import { readJson } from './util.ts'

/**
 * **Ein aniSearch-Eintrag, den sich mehrere Titel teilen (n:1), belegt keine Synchro für das einzelne Teil** (Daniel, 31.10.2026, Crown Handler 4–6).
 * Die Marke „vertont“ gilt dem Eintrag als Ganzem — bei Crown Handler 13597 (sechs Kapitel) belegt nur ein Teil der Kapitel eine deutsche Fassung,
 * die Marke erbte aber jedes Kapitel. Ein Teil mit eigenem Beleg (Stream mit Ton, Handbeleg, Kartei, Sprecher) behält seine Synchro über diesen Beleg.
 */

/**
 * Die Titel, die sich ihren aniSearch-Eintrag mit mindestens einem anderen Titel der Liste teilen — ohne die `eigenBelegt`: Ein Teil, für den JustWatch
 * selbst Deutsch nennt (`ladeJustwatchDeutsch`), behält die Marke; sie ist dort nicht mehr die einzige Stütze.
 */
export function sammeleintragTitel(bruecke: ReadonlyMap<string, string>, ids: Iterable<number>, eigenBelegt: ReadonlySet<number> = new Set()): Set<number> {
  const je = new Map<string, number[]>()
  for (const id of ids) {
    const eintrag = bruecke.get(String(id))
    if (eintrag) je.set(eintrag, [...(je.get(eintrag) ?? []), id])
  }
  return new Set([...je.values()].filter((titel) => titel.length > 1).flat().filter((id) => !eigenBelegt.has(id)))
}

/**
 * Die Titel, deren eigener JustWatch-Befund Deutsch als Tonspur nennt. Ein Befund, der einer JustWatch-Kennung mehrerer Titel gehört, zählt nicht
 * (bei Mehrteilern fasst das Angebot alle Teile zusammen, `jw-vertrauen.ts`); ein Befund ohne Treffer auch nicht.
 */
export function justwatchDeutsch(bestand: Record<string, JwBefund>): Set<number> {
  const jeKennung = titelJeJustwatchKennung(bestand)
  const treffer = Object.entries(bestand).filter(([, b]) => !b.ohneTreffer && b.jwId && jeKennung.get(b.jwId) === 1 && b.angebote.some((a) => a.audio?.includes('de')))
  return new Set(treffer.map(([id]) => Number(id)))
}

export const ladeJustwatchDeutsch = (): Set<number> => justwatchDeutsch(readJson<Record<string, JwBefund>>('data/justwatch-audio.json', {}))

/** Der Termin ohne Synchro-Marke (und ohne Teilmarke), wo der Titel im Sammeleintrag steht; ohne Datum, Zeitraum und Verlag bleibt nichts übrig. */
export function ohneSammelSynchro(termin: AnisearchTermin | undefined, imSammeleintrag: boolean): AnisearchTermin | undefined {
  if (!imSammeleintrag || !termin?.synchro) return termin
  const rest: AnisearchTermin = { ...termin }
  delete rest.synchro
  delete rest.teil
  return rest.start || rest.zeitraum || rest.publisher ? rest : undefined
}

/** Eigene Belege je Titel außerhalb von aniSearch: Handbeleg, Synchronkartei, Handeintrag der Erstausgabe, TV-Termin. */
export interface EigeneBelege {
  handbelegt: ReadonlySet<number>
  kartei: ReadonlySet<number>
  handErstausgabe: ReadonlySet<number>
  tv: ReadonlySet<number>
}

/** Hängt am Titel selbst ein Beleg für Deutsch: Stream mit Ton, Urteil von JustWatch, Sprecher, Handlink mit Tonbereich, Disc-Erstausgabe? */
export function hatEigenenBeleg(t: Pick<Title, 'streams'> & Partial<Pick<Title, 'hasVoices' | 'watchLinks' | 'deErstausgabe'>>): boolean {
  return (
    Boolean(t.streams?.some((s) => s.dub === true || (s.dubQuelle === 'justwatch' && s.dubStand))) ||
    Boolean(t.hasVoices) ||
    Boolean(t.watchLinks?.some((w) => w.dubRanges?.some((r) => r.dub))) ||
    t.deErstausgabe?.quelle === 'disc'
  )
}

/** Die Titel im Sammeleintrag, die „Deutsch synchronisiert“ tragen (`deErstausgabe.synchro`), ohne dass etwas anderes als aniSearch es belegt. */
export function synchroNurAusSammeleintrag(titel: readonly Title[], sammel: ReadonlySet<number>, b: EigeneBelege): Title[] {
  const eigen = (t: Title) => hatEigenenBeleg(t) || [b.handbelegt, b.kartei, b.handErstausgabe, b.tv].some((menge) => menge.has(t.id))
  return titel.filter((t) => sammel.has(t.id) && t.deErstausgabe?.synchro === true && !eigen(t))
}
