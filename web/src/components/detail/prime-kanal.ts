import type { PlatformId, StreamLink } from '@shared/types.ts'

/**
 * **Kanal → Anbieter: Prime-Video-Kanäle, deren Bestand der Anbieter selbst führt** (11.10.2026,
 * Daniel: „die echte Webseite führt den Prime-Kanal“). Schlüssel ist `kanal` klein geschrieben.
 * Beleg je Eintrag: der Kanalname in Amazons Meldung und die Anbieter-Domain des eigenen Weges
 * (crunchyroll.com, animationdigitalnetwork.com); `PLATFORM_LABEL['primevideo-channel-…']` in
 * `shared/mappings.ts` führt dieselben Kanäle. Aniverse und RTL+ fehlen mit Absicht: Dort gibt es
 * im Bestand (11.10.2026) keinen eigenen Weg, aus dem eine Zahl käme. Neuer Kanal erst mit
 * eigenem Weg des Anbieters und Domain-Beleg.
 */
const KANAL_ANBIETER: Record<string, PlatformId> = {
  crunchyroll: 'crunchyroll',
  adn: 'adn',
}

/**
 * Der Anbieter-Weg, dessen Bestand ein Prime-Kanal-Weg teilt. Nur mit belegtem Deutsch an beiden:
 * Bei Golden Wind liegt auf Crunchyroll nur Französisch und Japanisch (dub false), die
 * Kanal-Pille ohne Urteil (dub undefined) darf davon keine Zahl erben.
 */
export function kanalQuelle(s: { platform?: string; kanal?: string; dub?: boolean }, streams: StreamLink[]): StreamLink | undefined {
  if (s.platform !== 'primevideo' || s.dub !== true) return undefined
  const anbieter = KANAL_ANBIETER[(s.kanal ?? '').toLowerCase()]
  return anbieter ? streams.find((q) => q.platform === anbieter && q.dub === true) : undefined
}

/**
 * **Der Kanal-Weg übernimmt die deutschen Bereiche des Anbieter-Wegs** (10.10.2026, Slime
 * Staffel 4: Crunchyroll „23 Fg.“, Prime-Kanal „Fg. 1–19“, obwohl der Kanal denselben Bestand
 * führt). Auch gegen einen älteren Prime-Handbeleg (Hensuki, Daniels Entscheidung 11.10.2026).
 *
 * Hier und nicht im Bau, weil die Zahl vom Tag abhängt (erschienene Folgen). Erwartet Streams,
 * deren Bereiche schon um den Wochenplan ergänzt sind (`titelMitTerminBereichen`).
 */
export function streamsMitKanalBestand(streams: StreamLink[]): StreamLink[] {
  return streams.map((s) => {
    const quelle = kanalQuelle(s, streams)
    return quelle ? { ...s, dubRanges: quelle.dubRanges } : s
  })
}
