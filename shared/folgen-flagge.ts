import type { Title } from './types.ts'

/** Der Satz im Folgenbereich, wo die Synchro für die Serie belegt ist, aber keine Folge eine Flagge trägt. */
export const SERIENBELEG_HINWEIS = 'Die Synchro ist für die Serie belegt, nicht je Folge.'

/** Serienbeleg (`synchroBelegt`) ohne Folgenbeleg: keine einzige Folge ist deutsch geflaggt. Panel und Bestandswächter fragen hier. */
export function serienbelegOhneFolgenbeleg(belegt: boolean, folgen: number[], deutsch: (nr: number) => boolean): boolean {
  return belegt && folgen.length > 0 && !folgen.some(deutsch)
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
