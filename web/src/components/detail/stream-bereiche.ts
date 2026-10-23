import { bereicheMitFolgen, ergaenzteFolgen } from '@shared/logic.ts'
import type { Release, StreamLink, Title } from '@shared/types.ts'
import type { WegMitHerkunft } from './folgen-spanne.ts'
import { streamsMitKanalBestand } from './prime-kanal.ts'

/** Ergänzt die belegten Bereiche eines Wegs um den Wochenplan und merkt sich, welche Folgen ergänzt (nicht belegt) sind. */
function wegMitTermin(s: StreamLink, releases: Release[]): WegMitHerkunft {
  const neu = ergaenzteFolgen(s.dubRanges, releases, s.platform)
  if (!neu.length || !s.dubRanges) return s
  return { ...s, dubRanges: bereicheMitFolgen(s.dubRanges, neu), ergaenzteFolgen: neu }
}

/**
 * **Belegte Bereiche plus erschienene Folgen des deutschen Wochenplans** (25.09.2026,
 * `bereicheMitTermin`): Sonst zählte das Panel bei einer laufenden Serie nur den Beleg vom
 * Prüftag — „10 von 12" neben „Ep 12/12" in der Woche (Vom Landei zum Schwertheiligen II).
 * Die ergänzten Folgen bleiben am Weg vermerkt (`ergaenzteFolgen`), damit die Pille sie als
 * abgeleitet kennzeichnen kann. Danach übernehmen Prime-Kanal-Wege den weiteren
 * Crunchyroll-Stand (`prime-kanal.ts`).
 */
export function titelMitTerminBereichen(titel: Title | undefined, releases: Release[]): Title | undefined {
  if (!titel?.streams?.length) return titel
  const mitTermin = releases.some((r) => r.releaseType === 'weekly')
    ? titel.streams.map((s) => wegMitTermin(s, releases))
    : titel.streams
  return { ...titel, streams: streamsMitKanalBestand(mitTermin, releases) }
}

/**
 * Alle deutschen Bereiche der Wege, wie die Pillen sie zeigen (Wochenplan und Kanal-Bestand eingerechnet).
 * Die Folgenliste flaggt daraus mit, damit Pille und Flagge denselben Bestand lesen
 * (Tempal, 18.10.2026: „Fg. 1–3“ über zwei Folgen ohne Flagge).
 */
export function deutscheBereicheDerWege(titel: Pick<Title, 'streams'> | undefined): { from: number; to: number }[] {
  return (titel?.streams ?? []).flatMap((s) => (s.dubRanges ?? []).filter((r) => r.dub))
}

/** Trägt die Folge die deutsche Flagge: laut Folgenliste (`de`, Fernsehen und Belege des Baus) oder laut den Bereichen der Wege. */
export function folgeIstDeutsch(nr: number, de: [number, number][], wege: { from: number; to: number }[]): boolean {
  return [...de.map(([von, bis]) => ({ from: von, to: bis })), ...wege].some((r) => nr >= r.from && nr <= r.to)
}
