/**
 * Livestream-Adressen frei empfangbarer TV-Sender; eine Zeile je Sender (Name wie `sender` im Termin, ohne Beachtung der Schreibweise).
 * Beleg `channel_id=5`: Daniel hat am 06.11.2026 18:28 den ProSieben-MAXX-Livestream unter dieser Adresse geöffnet (Screenshot).
 */
const LIVE_ADRESSEN = new Map<string, { name: string; url: string }>([
  ['prosieben maxx', { name: 'Joyn', url: 'https://www.joyn.de/play/live-tv?channel_id=5' }],
])

/** Wohin der Livestream des Senders führt, sonst nichts. */
export function liveAdresse(sender?: string): { name: string; url: string } | undefined {
  return LIVE_ADRESSEN.get((sender ?? '').trim().toLowerCase())
}
