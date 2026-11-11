import type { Fsk, ReleaseStatus, ReleaseType } from './types.ts'

export const RELEASE_TYPES: Record<
  ReleaseType,
  { name: string; short: string; color: string; hint: string }
> = {
  weekly: {
    name: 'Wöchentlich (Simuldub)',
    short: 'Wöchentlich',
    color: '#3b82f6',
    hint: 'Folge für Folge, fester Wochentag',
  },
  batch: {
    name: 'Katalogtitel',
    short: 'Katalog',
    color: '#a855f7',
    hint: 'Ganze Staffel auf einen Schlag',
  },
  movie: { name: 'Film', short: 'Film', color: '#eab308', hint: 'Filmstart (Stream oder Kino)' },
  disc: { name: 'DVD / Blu-ray', short: 'Disc', color: '#22c55e', hint: 'Kaufbarer Datenträger' },
}

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
