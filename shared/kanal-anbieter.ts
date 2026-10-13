import type { PlatformId } from './types.ts'

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

/** Die Plattform, deren Bestand der Prime-Kanal führt; ohne Eintrag (Aniverse, RTL+ …) `undefined`. */
export const anbieterDesKanals = (kanal: string | undefined): PlatformId | undefined => KANAL_ANBIETER[(kanal ?? '').toLowerCase()]
