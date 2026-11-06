/** Livestream-Adressen frei empfangbarer TV-Sender; eine Zeile je Sender (Name wie `sender` im Termin, ohne Beachtung der Schreibweise). */
const LIVE_ADRESSEN: Record<string, { name: string; url: string }> = {
  'prosieben maxx': { name: 'Joyn', url: 'https://www.joyn.de/play/live-tv?channel_id=5' },
}

/** Wohin der Livestream des Senders führt, sonst nichts. */
export function liveAdresse(sender?: string): { name: string; url: string } | undefined {
  return LIVE_ADRESSEN[(sender ?? '').trim().toLowerCase()]
}
