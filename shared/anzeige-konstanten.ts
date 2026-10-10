import type { Fsk, ReleaseStatus } from './types.ts'

export const STATUS_LABEL: Record<ReleaseStatus, string> = {
  airing: 'Läuft',
  abgeschlossen: 'Abgeschlossen',
  tba: 'TBA',
  erschienen: 'Erschienen',
  unbekannt: 'Termin unbekannt',
}

export const FSK_COLORS: Record<Fsk, string> = {
  0: '#ffffff',
  6: '#ffd400',
  12: '#009d3e',
  16: '#0075bf',
  18: '#e30613',
}
