import type { Release } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'

/** Die Prime-Suche, wie die Erweiterung sie öffnet (`tools/extension-offene-amazon.mjs`). */
export function primeSuchAdresse(name: string): string {
  return `https://www.amazon.de/s?k=${encodeURIComponent(name)}&i=instant-video`
}

/**
 * Wohin eine Termin-Pille führt. **Eine Prime-Pille ohne Adresse führt zur Suche statt ins Leere**
 * (Daniel, 11.10.2026: Reborn as a Space Mercenary, „nicht klickbar"); der Hinweis sagt, dass es nur die Suche ist.
 * Andere Anbieter ohne Adresse bleiben ohne Ziel, dort gäbe es nichts Passendes zu suchen.
 */
export function pillenZiel(release: Release, titel: string | undefined, t: Translate): { ziel?: string; hinweis?: string } {
  const adresse = release.buyUrl ?? release.platformUrl
  if (adresse) return { ziel: adresse }
  if (release.platform !== 'primevideo') return {}
  return { ziel: primeSuchAdresse(titel ?? release.name), hinweis: t('detail.primeSuchen') }
}
