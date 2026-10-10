import { expandEvents } from '@shared/logic.ts'
import type { Release, StreamLink } from '@shared/types.ts'
import { zaehleErschienen } from './antwort-regeln.ts'

type Bereiche = StreamLink['dubRanges']
/** Nur Oberfläche, nie im Datensatz: Die Folgenzahl dieses Weges stammt von Crunchyroll. */
type MitBestand = StreamLink & { bestandVon?: 'crunchyroll' }

export const bestandVon = (s: object | undefined): 'crunchyroll' | undefined => (s as MitBestand | undefined)?.bestandVon

/** Prime Video, Zusatzkanal Crunchyroll — das Abo führt denselben Bestand wie Crunchyroll selbst. */
export function istCrunchyrollKanal(s: { platform?: string; kanal?: string }): boolean {
  return s.platform === 'primevideo' && /crunchyroll/i.test(s.kanal ?? '')
}

/**
 * Der Crunchyroll-Weg, dessen Bestand ein Kanal-Weg teilt. Nur mit belegtem Deutsch dort:
 * Bei Golden Wind liegt auf Crunchyroll nur Französisch und Japanisch, die Kanal-Pille
 * darf davon keine Zahl erben.
 */
export function crunchyrollZumKanal(s: { platform?: string; kanal?: string }, streams: StreamLink[]): StreamLink | undefined {
  if (!istCrunchyrollKanal(s)) return undefined
  return streams.find((q) => q.platform === 'crunchyroll' && q.dub === true)
}

const deutscheFolgen = (bereiche: Bereiche): number =>
  (bereiche ?? []).filter((b) => b.dub).reduce((n, b) => n + Math.max(0, b.to - b.from + 1), 0)

/** n, wenn die deutschen Bereiche lückenlos die Folgen 1 bis n decken; sonst null. */
function lueckenlosBis(bereiche: Bereiche): number | null {
  let ende = 0
  for (const b of [...(bereiche ?? [])].filter((x) => x.dub).sort((a, c) => a.from - c.from)) {
    if (b.from > ende + 1) return null
    ende = Math.max(ende, b.to)
  }
  return ende
}

/**
 * **Der Prime-Kanal-Weg übernimmt die Folgen des Crunchyroll-Wegs, wenn der weiter ist**
 * (10.10.2026). Unsere Prime-Prüfung hinkt hinterher: Slime Staffel 4 zeigte bei Crunchyroll
 * „23 Fg." und bei Prime (Crunchyroll) „Fg. 1–19", obwohl der Kanal denselben Bestand führt.
 *
 * Nur, wo Prime wirklich hinterherhinkt: Seine deutschen Bereiche sind ein lückenloses
 * Präfix von Crunchyrolls, und kein Bereich ist als „ohne deutschen Ton" belegt. Hensuki hat
 * am Kanal Folge 5 ohne Deutsch belegt, Crunchyroll führt 1–12 — der Handbeleg gilt.
 * `bestandVon` lässt die Pille erkennen, dass die Zahl nicht von Prime selbst stammt.
 *
 * Hier und nicht im Bau, weil die Zahl vom Tag abhängt (erschienene Folgen): Ein im Bau
 * festgeschriebener Wert wäre am nächsten Freitag veraltet, die Crunchyroll-Pille rechnet live.
 * Erwartet Streams, deren Bereiche schon um den Wochenplan ergänzt sind (`titelMitTerminBereichen`).
 */
export function streamsMitKanalBestand(streams: StreamLink[], releases: Release[]): StreamLink[] {
  const crunchyrollTermine = releases.filter((r) => r.platform === 'crunchyroll' && r.releaseType === 'weekly')
  return streams.map((s) => {
    const cr = crunchyrollZumKanal(s, streams)
    if (!cr || s.dub !== true || s.dubRanges?.some((b) => !b.dub)) return s
    const vonCrunchyroll: MitBestand = { ...s, bestandVon: 'crunchyroll' }
    /* Ohne eigene Bereiche macht der Weg keine Teilangabe, die hinterherhinken könnte. */
    if (!s.dubRanges?.some((b) => b.dub)) return vonCrunchyroll
    const primeBis = lueckenlosBis(s.dubRanges)
    if (primeBis === null) return s
    const crHatBereiche = cr.dubRanges?.some((b) => b.dub)
    const crFolgen = crHatBereiche
      ? deutscheFolgen(cr.dubRanges)
      : zaehleErschienen(crunchyrollTermine.flatMap((r) => expandEvents(r)))
    if (crHatBereiche && (lueckenlosBis(cr.dubRanges) ?? 0) < primeBis) return s
    return crFolgen > primeBis ? { ...vonCrunchyroll, dubRanges: cr.dubRanges } : s
  })
}
