/**
 * **Die Überschrift des „läuft“-Kastens** — ausgelagert, weil `AntwortKasten` und `berechneAntwort` die
 * Längengrenze reißen (`tools/umfang-pruefen.mjs`).
 */
import type { ReleaseEvent } from '@shared/types.ts'
import type { Antwort } from './antwort-typ.ts'

type Laeuft = Extract<Antwort, { art: 'laeuft' }>
type Uebersetze = (k: string, v?: Record<string, string | number>) => string

/** Was nach der nächsten Folge noch aussteht und wann die letzte kommt. */
export function restUndBlock(kuenftig: ReleaseEvent[], n: ReleaseEvent): Pick<Laeuft, 'rest' | 'letzter'> {
  const derselben = kuenftig.filter((e) => e.releaseSlug === n.releaseSlug)
  return { rest: derselben.length, letzter: derselben[derselben.length - 1]?.date }
}

/**
 * **Die letzte Folge heißt so, wie sie ist**: Steht nur noch sie aus, ist sie das Finale. Eine
 * TV-Sichtung kennt weder Ende noch echte Nummer (Pokémon Horizonte, 17.09.2026), und „Erste Folge“ gilt nur
 * für Folge 1 (Beyblade X setzte bei TOGGO plus mit Folge 115 ein).
 */
function wasKommt(a: Laeuft): 'erste' | 'naechste' | 'finale' {
  if (a.offenesEnde) return !a.sichtung && a.haupt.episode === 1 ? 'erste' : 'naechste'
  if (a.raus === 0) return 'erste'
  return a.rest === 1 ? 'finale' : 'naechste'
}

/** Die Überschrift des Kastens: „Nächste Folge (Folge 4)“ oder bei einem Abwurf „Alle N Folgen“. */
export function folgenKopf(a: Laeuft, T: Uebersetze): string {
  const e = a.haupt
  if (a.komplett) {
    const count = a.gesamt ?? e.episodeCount
    return count ? T('antwort.alleFolgen', { count }) : T('antwort.alleFolgenOhneZahl') /* ohne Folgenzahl keine erfundene „0“ (Beerus, 10.10.2026) */
  }
  const was = wasKommt(a)
  return e.episode && !a.sichtung ? T(`antwort.${was}FolgeNr`, { n: e.episode }) : T(`antwort.${was}Folge`)
}
