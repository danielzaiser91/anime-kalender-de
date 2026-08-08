/**
 * Die überwachten Seiten.
 *
 * Ermittelt am 08.08.2026, indem für jedes Repository von danielzaiser91 die
 * Pages-Schnittstelle abgefragt wurde — verlässlicher als READMEs, die häufig
 * veralten. Dazu die beiden Seiten außerhalb von GitHub und der Dienst hier
 * selbst.
 *
 * Neue Seite aufnehmen: eine Zeile ergänzen, deployen. Mehr ist es nicht.
 */

export interface Site {
  /** Kurzname für die Mail. */
  name: string
  url: string
  /**
   * Kleinste plausible Antwortgröße in Bytes. Fängt den Fall ab, dass ein
   * Server brav 200 meldet, aber eine leere oder abgeschnittene Seite liefert.
   */
  minBytes?: number
  /** Muss im Text vorkommen, sonst gilt die Seite als kaputt. */
  expect?: string
}

const GH = 'https://danielzaiser91.github.io'

export const SITES: Site[] = [
  // Eigene Domains
  { name: 'Anime-Kalender', url: 'https://anime-kalender.de/', minBytes: 500 },
  { name: 'Anime-Kalender · Daten', url: 'https://anime-kalender.de/data/events.json', expect: '"date"' },
  { name: 'Portfolio', url: 'https://daniel-zaiser.de/', minBytes: 1000 },
  { name: 'Westerwald-Pianoservice', url: 'https://westerwald-pianoservice.de/', minBytes: 2000 },

  // Bewusst NICHT in dieser Liste: dieser Dienst selbst.
  //
  // Ein Wächter, der sich selbst überwacht, schweigt genau dann, wenn er
  // ausfällt — die Meldung käme aus derselben Laufzeit, die gerade tot ist.
  // (Der Versuch scheiterte am 08.08.2026 zusätzlich technisch: Der Worker
  // bekam beim Abruf seiner eigenen workers.dev-Adresse ein 404.)
  // Diese Aufgabe erfüllt stattdessen die Wochenübersicht: Bleibt sie aus,
  // ist der Wächter tot.

  // GitHub Pages
  { name: 'Incremental Adventure', url: `${GH}/incremental-adventure/`, minBytes: 400 },
  { name: 'Incremental Adventure (Rewrite)', url: `${GH}/incremental-adventure-rewritten-live/`, minBytes: 400 },
  { name: 'Celestial Blade', url: `${GH}/anime-adventure/`, minBytes: 300 },
  { name: 'Stardust to Singularity', url: `${GH}/stardust-to-singularity/`, minBytes: 400 },
  { name: 'Ratespiel', url: `${GH}/ratespiel-wer-bin-ich/`, minBytes: 1000 },
  { name: 'Cosmic Forge', url: `${GH}/cosmic-forge/`, minBytes: 1000 },
  { name: 'Arturs Webseite (Spiegel)', url: `${GH}/arturs-webseite/`, minBytes: 2000 },
  { name: 'Malazan-CYOA', url: `${GH}/malazan-cyoa/`, minBytes: 400 },
  { name: 'Archmage Idle', url: `${GH}/archmage-idle-live/`, minBytes: 1000 },
  { name: 'Geoguessr-Hinweise', url: `${GH}/geoguessr-hints/`, minBytes: 1000 },
  { name: 'Bubble Notifications', url: `${GH}/bubble-notifications/`, minBytes: 1000 },
  { name: 'Isekai-Idle-Mockups', url: `${GH}/isekai-idle-mockups/`, minBytes: 150 },
  { name: 'Revolution Idle Clone', url: `${GH}/revolution-idle-clone/`, minBytes: 500 },
  { name: 'Endless Arena', url: `${GH}/endless-arena/`, minBytes: 300 },
  { name: 'Homestream', url: `${GH}/homestream/`, minBytes: 2000 },
]
