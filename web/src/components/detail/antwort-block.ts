/**
 * **Mehrere Folgen am selben Tag stehen in einer Überschrift** (Daniel, 13.10.2026): Avatar: Die sieben Häfen
 * bringt freitags drei Folgen, der Kasten nannte nur die erste („Nächste Folge (Folge 4)“).
 */
import { istAusgeblieben } from '@shared/logic.ts'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Antwort } from './antwort-typ.ts'

type Laeuft = Extract<Antwort, { art: 'laeuft' }>
type Uebersetze = (k: string, v?: Record<string, string | number>) => string

/**
 * Die letzte Folge des Blocks, der mit `n` am selben Tag erscheint — nur mit belegten Terminen (`estimated`
 * fehlt) und lückenlos ab `n`. Fortgeschriebene Folgen legt `expandEvents` nie auf denselben Tag, ein Block ist
 * also immer belegt; die Prüfung hält es trotzdem fest. Tag = Berlin-Tag des Termins.
 */
export function folgenblockBis(derselben: ReleaseEvent[], n: ReleaseEvent): number | undefined {
  if (n.episode == null || n.estimated || n.sichtung || n.releaseType !== 'weekly' || istAusgeblieben(n)) return undefined
  const amTag = derselben.filter((e) => e.date === n.date && !e.estimated && !e.sichtung && !istAusgeblieben(e))
  let bis = n.episode
  while (amTag.some((e) => e.episode === bis + 1)) bis++
  return bis > n.episode ? bis : undefined
}

/** Was nach der nächsten Folge noch aussteht, wann die letzte kommt, und wie weit ihr Block reicht. */
export function restUndBlock(kuenftig: ReleaseEvent[], n: ReleaseEvent): Pick<Laeuft, 'rest' | 'letzter' | 'blockBis'> {
  const derselben = kuenftig.filter((e) => e.releaseSlug === n.releaseSlug)
  return { rest: derselben.length, letzter: derselben[derselben.length - 1]?.date, blockBis: folgenblockBis(derselben, n) }
}

/**
 * **Die letzte Folge heißt so, wie sie ist**: Steht nur noch der Block aus, ist er das Finale. Eine
 * TV-Sichtung kennt weder Ende noch echte Nummer (Pokémon Horizonte, 17.09.2026), und „Erste Folge“ gilt nur
 * für Folge 1 (Beyblade X setzte bei TOGGO plus mit Folge 115 ein).
 */
function wasKommt(a: Laeuft): 'erste' | 'naechste' | 'finale' {
  if (a.offenesEnde) return !a.sichtung && a.haupt.episode === 1 ? 'erste' : 'naechste'
  if (a.raus === 0) return 'erste'
  const imBlock = a.blockBis ? a.blockBis - (a.haupt.episode ?? 0) + 1 : 1
  return a.rest === imBlock ? 'finale' : 'naechste'
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
