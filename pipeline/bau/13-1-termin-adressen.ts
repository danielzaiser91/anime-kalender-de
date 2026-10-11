import { type Release } from '../../shared/types.ts'
import { amazonAdresseRichten } from '../lib/amazon-adresse.ts'

/** Prime-Termine auf die Video-Adresse richten (`amazonAdresseRichten`); gibt zurück, wie viele sich geändert haben. */
export function richteTerminAdressen(releases: Release[]): number {
  let gerichtet = 0
  for (const r of releases) {
    if (r.platform !== 'primevideo' || !r.platformUrl) continue
    const neu = amazonAdresseRichten(r.platformUrl)
    if (neu !== r.platformUrl) gerichtet++
    r.platformUrl = neu
  }
  return gerichtet
}
