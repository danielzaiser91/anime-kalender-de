import type { PlatformId } from './types.ts'

/** Nur diese Verlagsnamen aus aniSearch sind eindeutig ein Streaming-Anbieter; „Crunchyroll", „KSM Anime" & Co. sind Disc-Verlage oder mehrdeutig. */
export const ANBIETER_VON_VERLAG: Record<string, PlatformId> = {
  'Amazon.com, Inc.': 'primevideo',
  'Netflix, Inc.': 'netflix',
  'The Walt Disney Company': 'disneyplus',
}
