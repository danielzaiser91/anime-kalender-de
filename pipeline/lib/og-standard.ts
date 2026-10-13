/** Inhalt des Standard-Vorschaubilds (`public/og/default.jpg`) für Links ohne Release. */
import { PLATFORMS } from '../../shared/types.ts'
import type { KartenDaten } from './og-karte.ts'

export function standardKarte(titleCount: number): KartenDaten {
  return {
    title: 'Anime-Kalender DE',
    subtitle: 'Alles mit deutscher Synchro, Woche für Woche',
    lines: [
      { label: 'Anime', value: `${titleCount.toLocaleString('de-DE')} mit Synchro` },
      { label: 'Termine', value: 'Streaming, Disc, Kino' },
      { label: 'Abo', value: 'Kalender und Newsletter' },
    ],
    badges: [
      { text: 'Crunchyroll', color: PLATFORMS.crunchyroll.color },
      { text: 'Netflix', color: PLATFORMS.netflix.color },
      { text: 'Prime Video', color: PLATFORMS.primevideo.color },
    ],
    accent: '#ff5a36',
  }
}
