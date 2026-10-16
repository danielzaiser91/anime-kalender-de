import { type StreamLink, type Title, type WatchLink } from '../../shared/types.ts'
import { log } from '../lib/util.ts'
import { istKeineTitelseite } from './11-7-wege-aus-terminen.ts'

/** Die Prime-Bezugswege des Titels mit Titelseite; der Kanal steht im Namen („Amazon Prime (Aniverse)“, `13-1-anreichern.ts`). */
function primeBezugswege(titel: Title): WatchLink[] {
  const istPrime = (w: WatchLink) => /^Amazon Prime/i.test(w.name) && /(^|\.)amazon\.de\//i.test(w.url.replace(/^https?:\/\//, ''))
  return (titel.watchLinks ?? []).filter((w) => w.kind === 'stream' && istPrime(w) && !istKeineTitelseite(w.url))
}

/**
 * **Ein Prime-Weg ohne Adresse nimmt die Adresse des Bezugswegs desselben Titels** (16.10.2026). Der Weg aus dem Kalendertermin (`11-7`)
 * hat nur die Adresse des Termins; nennt der keine Titelseite, blieb `url: ''`, obwohl JustWatch oder aniSearch die Seite kannten. Ohne Adresse
 * kann die Prüfliste der Erweiterung den Weg nicht aufnehmen. Mit Kanal am Weg gilt der Bezugsweg desselben Kanals, sonst nur ein einziger.
 * Mehrdeutig (zwei Kanäle) → keine Übernahme, wie bei `adresseDesWegs`. Ein Kanal-Bezugsweg gibt seinen `kanal` mit.
 */
function passenderBezugsweg(weg: StreamLink, titel: Title): WatchLink | undefined {
  if (weg.platform !== 'primevideo' || weg.url) return undefined
  const kandidaten = primeBezugswege(titel).filter((w) => !weg.kanal || w.name.toLowerCase() === `amazon prime (${weg.kanal.toLowerCase()})`)
  return kandidaten.length === 1 ? kandidaten[0] : undefined
}

export function adresseAusBezugsweg(weg: StreamLink, titel: Title): string | undefined {
  return passenderBezugsweg(weg, titel)?.url
}

/** Der Kanal steht im Namen („Amazon Prime (Aniverse)“); ein Weg auf einer Kanal-Seite ohne `kanal` fiele in die falsche Rangfolge der Tonquellen. */
export function kanalImNamen(name: string): string | undefined {
  return /^Amazon Prime \((.+)\)$/i.exec(name)?.[1]
}

/** Gibt zurück, wie vielen Wegen die Adresse ergänzt wurde. */
export function uebernehmeBezugswegAdressen(titles: Title[]): number {
  let anzahl = 0
  for (const titel of titles) {
    for (const weg of titel.streams ?? []) {
      const bezugsweg = passenderBezugsweg(weg, titel)
      if (!bezugsweg) continue
      weg.url = bezugsweg.url
      const kanal = kanalImNamen(bezugsweg.name)
      if (kanal && !weg.kanal) weg.kanal = kanal
      anzahl++
    }
  }
  if (anzahl) log(`${anzahl} Prime-Wege ohne Adresse haben die des Bezugswegs desselben Titels übernommen`)
  return anzahl
}
