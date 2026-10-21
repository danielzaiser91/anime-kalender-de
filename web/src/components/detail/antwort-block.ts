/**
 * **Mehrere Folgen am selben Tag stehen in einer Überschrift** (Daniel, 13.10.2026): Avatar: Die sieben Häfen
 * bringt freitags drei Folgen, der Kasten nannte nur die erste („Nächste Folge (Folge 4)“).
 */
import { folgenblockBis } from '@shared/folgenblock.ts'
import { taktUnklar } from '@shared/takt.ts'
import type { Release, ReleaseEvent } from '@shared/types.ts'
import { formatDate } from '@shared/time.ts'
import type { Antwort } from './antwort-typ.ts'
import { sendetageText } from './hilfen.tsx'
import { ungefaehr } from './antwort-regeln.ts'

type Laeuft = Extract<Antwort, { art: 'laeuft' }>
type Uebersetze = (k: string, v?: Record<string, string | number>) => string

/** Trägt der Wochentakt nicht mehr, und ist die nächste Folge nur fortgeschrieben? Dann sagt der Kasten „Takt unklar“ statt „Wöchentlich“. */
function taktUnklarBei(release: Release | undefined, n: ReleaseEvent): boolean {
  return Boolean(n.estimated && release?.releaseType === 'weekly' && release.platform !== 'tv' && !release.rhythmus && taktUnklar(release.schedule))
}

/** Was nach der nächsten Folge noch aussteht, wann die letzte kommt, und wie weit ihr Block reicht. */
export function restUndBlock(kuenftig: ReleaseEvent[], n: ReleaseEvent, release?: Release): Pick<Laeuft, 'rest' | 'letzter' | 'blockBis' | 'taktUnklar'> {
  const derselben = kuenftig.filter((e) => e.releaseSlug === n.releaseSlug)
  return { rest: derselben.length, letzter: derselben[derselben.length - 1]?.date, blockBis: folgenblockBis(derselben, n), taktUnklar: taktUnklarBei(release, n) }
}

/** Wie viele Folgen mit der nächsten am selben Tag erscheinen (1 ohne Block). */
function folgenImBlock(a: Laeuft): number {
  return a.blockBis ? a.blockBis - (a.haupt.episode ?? 0) + 1 : 1
}

/** Deckt der Block alles, was noch aussteht, nennen Überschrift und Satz schon Tag und Ende — „noch X bis zum Finale am …“ wäre dasselbe Datum zweimal. */
const blockIstEnde = (a: Laeuft): boolean => a.blockBis !== undefined && a.rest === folgenImBlock(a)

/**
 * **Die letzte Folge heißt so, wie sie ist**: Steht nur noch der Block aus, ist er das Finale. Eine
 * TV-Sichtung kennt weder Ende noch echte Nummer (Pokémon Horizonte, 17.09.2026), und „Erste Folge“ gilt nur
 * für Folge 1 (Beyblade X setzte bei TOGGO plus mit Folge 115 ein).
 */
function wasKommt(a: Laeuft): 'erste' | 'naechste' | 'finale' {
  if (a.offenesEnde) return !a.sichtung && a.haupt.episode === 1 ? 'erste' : 'naechste'
  if (a.raus === 0) return 'erste'
  if (a.gesamtGeschaetzt) return 'naechste'
  return a.rest === folgenImBlock(a) ? 'finale' : 'naechste'
}

/** Die Überschrift des Kastens: „Nächste Folge (Folge 4)“, „Nächste Folgen (4–6)“ oder bei einem Abwurf „Alle N Folgen“. */
export function folgenKopf(a: Laeuft, T: Uebersetze): string {
  const e = a.haupt
  if (a.komplett) {
    const count = a.gesamt ?? e.episodeCount
    return count ? T('antwort.alleFolgen', { count }) : T('antwort.alleFolgenOhneZahl') /* ohne Folgenzahl keine erfundene „0“ (Beerus, 10.10.2026) */
  }
  const was = wasKommt(a)
  if (!e.episode || a.sichtung) return T(`antwort.${was}Folge`)
  return a.blockBis
    ? T(`antwort.${was}FolgenNr`, { von: e.episode, bis: a.blockBis })
    : T(`antwort.${was}FolgeNr`, { n: e.episode })
}

/**
 * Die Nebenzeile des „läuft“-Kastens: Takt, wie viele Folgen bis zum Finale, Verschiebung. Der Wochentag steht
 * schon im Satz oben, hier bleibt der Takt. „Noch X“ heißt: X stehen aus, die nächste eingerechnet (bei einer
 * Staffel ohne erschienene Folge stand sonst „0 von 12“ über „noch 11“); bei einer steht „letzte Folge“.
 */
export function laeuftNeben(a: Laeuft, T: Uebersetze): string {
  return [
    a.taktUnklar ? T('antwort.taktUnklar') : a.sendetage?.length ? sendetageText(a.sendetage) : a.offenesEnde || a.komplett ? null : T('antwort.rhythmusWoechentlichKurz'),
    blockIstEnde(a)
      ? null
      : a.letzter && a.rest > 1 && !a.offenesEnde
        ? T('antwort.nochFolgen', { count: ungefaehr(a.rest, a.gesamtGeschaetzt), datum: ungefaehr(formatDate(a.letzter), a.gesamtGeschaetzt || a.taktUnklar) })
        : a.raus === 0 && !a.offenesEnde && !a.komplett
          ? T('antwort.letzteFolge')
          : null,
    a.verschobenVon && T(a.haupt.estimated && !a.vermerk?.neuErwartet ? 'antwort.verschobenGeschaetzt' : 'antwort.verschobenVon', { datum: formatDate(a.verschobenVon) }),
  ]
    .filter(Boolean)
    .join(' · ')
}
