import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'
import type { Title } from '../../shared/types.ts'

/**
 * **Deutsche Erstausgabe von Hand** (`data/erstausgabe-von-hand.yaml`): Datum, wo aniSearchs Start nicht die Synchro meint.
 * Optional trägt ein Eintrag `deFolgen`, wenn nur ein Teil der Folgen auf Deutsch vorliegt (12.10.2026) — mit Quelle und kurzem Zitat.
 */
export const ERSTAUSGABE_VON_HAND = 'data/erstausgabe-von-hand.yaml'

/** Höchstzahl Wörter im Zitat der Quelle: ein Beleg, kein Abschnitt. */
export const ZITAT_MAX_WOERTER = 15

export interface DeFolgenHand {
  /** Zahl der Folgen in deutscher Fassung. */
  n: number
  name: string
  url: string
  zitat: string
}

export interface ErstausgabeVonHand {
  anilistId?: number
  title?: string
  von?: string
  publisher?: string
  sources?: string[]
  deFolgen?: DeFolgenHand
}

export function ladeErstausgabeVonHand(pfad = resolve(ROOT, ERSTAUSGABE_VON_HAND)): ErstausgabeVonHand[] {
  if (!existsSync(pfad)) return []
  return (yaml.load(readFileSync(pfad, 'utf8')) as ErstausgabeVonHand[] | null) ?? []
}

/** Strukturfehler der deutschen Folgenzahl, je Eintrag lesbar; leer = in Ordnung. Ein Eintrag ohne Quelle oder ohne Zitat zählt nicht. */
export function deFolgenFehler(eintraege: ErstausgabeVonHand[]): string[] {
  const fehler: string[] = []
  for (const e of eintraege) {
    const f = e.deFolgen
    if (!f) continue
    const at = `Erstausgabe von Hand ${e.anilistId} (${e.title ?? '?'}): deFolgen`
    if (!Number.isInteger(f.n) || f.n < 1) fehler.push(`${at}: n ist keine Folgenzahl`)
    if (!f.name?.trim()) fehler.push(`${at}: Quellenname fehlt`)
    if (!/^https:\/\//.test(f.url ?? '')) fehler.push(`${at}: Quelle braucht eine https-Adresse`)
    const woerter = (f.zitat ?? '').trim().split(/\s+/).filter(Boolean).length
    if (!woerter) fehler.push(`${at}: Zitat fehlt`)
    else if (woerter >= ZITAT_MAX_WOERTER) fehler.push(`${at}: Zitat hat ${woerter} Wörter, erlaubt sind unter ${ZITAT_MAX_WOERTER}`)
    if (!e.von || !e.sources?.length) fehler.push(`${at}: der Eintrag braucht auch Datum und Quelle der Erstausgabe`)
  }
  return fehler
}

/** Gilt die deutsche Folgenzahl für diesen Titel? Nur wenn sie unter der Folgenzahl des Werks liegt. */
export const deFolgenGilt = (f: DeFolgenHand | undefined, episodes: number | undefined): boolean =>
  Boolean(f && episodes && f.n < episodes)

/** `deErstausgabe` aus einem Handeintrag; `teil`, wenn die deutsche Fassung kürzer ist als das Werk (der Panel-Kasten sagt dann nicht „alle“). */
export function handErstausgabe(e: ErstausgabeVonHand, title: Title): NonNullable<Title['deErstausgabe']> {
  return {
    von: e.von,
    ...(e.publisher ? { publisher: e.publisher } : {}),
    synchro: true,
    ...(deFolgenGilt(e.deFolgen, title.episodes) ? { teil: true } : {}),
  }
}
