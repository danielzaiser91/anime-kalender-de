import type { Page } from 'playwright'
import { warn } from './util.ts'

/**
 * Störungen der Beleg-Lesung je Anbieter (12.10.2026): Drei Fehlschläge in Folge bei einem Anbieter lassen nur diesen für den Rest des Laufs ruhen.
 * Vorher beendeten sie den ganzen Lauf — und weil ein Fehlschlag `zuletzt` nicht vorrückt, standen dieselben acht Adressen (Crunchyroll, Disney+)
 * jeden Tag vorn in der Schlange und der Lauf kam nie zu den übrigen (kein Beleg seit 08.10.2026).
 */
export interface Stoerungen {
  /** Der Anbieter dieser Adresse hat sich in diesem Lauf gesperrt gezeigt. */
  ruht(url: string): boolean
  /** Ein Fehlschlag; beim dritten in Folge ruht der Anbieter. */
  fehl(url: string): void
  /** Eine gelesene Adresse beendet die Serie ihres Anbieters. */
  erfolg(url: string): void
}

export function neueStoerungen(bisRuhe: number): Stoerungen {
  const serie = new Map<string, number>()
  /* Eine ungültige Adresse ist ihr eigener Anbieter: Sie scheitert für sich und beendet den Lauf nicht. */
  const anbieter = (url: string) => (URL.canParse(url) ? new URL(url).hostname : url)
  return {
    ruht: (url) => (serie.get(anbieter(url)) ?? 0) >= bisRuhe,
    fehl(url) {
      const n = (serie.get(anbieter(url)) ?? 0) + 1
      serie.set(anbieter(url), n)
      if (n === bisRuhe) warn(`${bisRuhe} Störungen in Folge bei ${anbieter(url)} — der Anbieter ruht bis zum nächsten Lauf, die übrigen werden weiter gelesen.`)
    },
    erfolg: (url) => void serie.set(anbieter(url), 0),
  }
}

/**
 * Die Adressen dieses Laufs in Schlangenreihenfolge: Ruhende Anbieter werden übersprungen und verbrauchen keinen der `limit` Plätze, gesunde Adressen
 * dahinter rücken nach. Geprüft wird erst beim Abruf der nächsten Adresse, also nach dem Ergebnis der vorigen.
 */
export function* ohneRuhende(schlange: string[], limit: number, stoerungen: Stoerungen): Generator<string> {
  let versuche = 0
  for (const url of schlange) {
    if (versuche >= limit) return
    if (stoerungen.ruht(url)) continue
    versuche++
    yield url
  }
}

/** Wohin die Seite wirklich führte und was sie sich nennt — sagt im Lauf-Protokoll, ob eine Sperrseite statt des Artikels kam. */
export async function seiteninfo(seite: Page): Promise<string> {
  return `${seite.url()} „${(await seite.title()).slice(0, 80)}“`
}
