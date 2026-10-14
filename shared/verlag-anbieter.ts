import { PLATFORMS, type PlatformId } from './types.ts'

/** Nur diese Verlagsnamen aus aniSearch sind eindeutig ein Streaming-Anbieter; „Crunchyroll", „KSM Anime" & Co. sind Disc-Verlage oder mehrdeutig. */
export const ANBIETER_VON_VERLAG: Record<string, PlatformId> = {
  'Amazon.com, Inc.': 'primevideo',
  'Netflix, Inc.': 'netflix',
  'The Walt Disney Company': 'disneyplus',
}

/**
 * Ist der Verlag der aniSearch-Erstausgabe dieser Anbieter? Entweder steht er in der Tabelle („Amazon.com, Inc." ist Prime Video,
 * „The Walt Disney Company" ist Disney+) oder sein Name trägt den des Anbieters („Netflix, Inc.", „Crunchyroll", „Disney+").
 * „Kazé" ist nicht Crunchyroll und „Walt Disney Studios Motion Pictures" nicht Disney+.
 */
export function verlagIstAnbieter(publisher: string | undefined, platform: PlatformId): boolean {
  if (!publisher) return false
  return ANBIETER_VON_VERLAG[publisher] === platform || publisher.toLowerCase().includes((PLATFORMS[platform]?.name ?? '§').toLowerCase())
}
