/**
 * Welche Terminquelle den Ton nennt (17.11.2026): Ein Termin belegt die Synchro nur, wenn seine Quelle die Sprachfassung führt.
 * - ADN-Kalender-Endpunkt (`gw.api…`): je Folge `vde`/`vostde` (`bau/07-adn.ts`).
 * - Crunchyroll-Kalender und Wochenprogramm-Artikel: der Termin steht dort nur, wenn ein deutscher Eintrag gelesen wurde (`bau/05-releases.ts`,
 *   sonst verworfen). Eine CR-Serienseite als Quelle (kuratiert) nennt keinen Ton.
 * Alles andere (Neuzugangsartikel, aniSearch, Anbieterseiten, Movie of the Night) belegt den Termin, nicht den Ton.
 */
export function quelleNenntTon(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'gw.api.animationdigitalnetwork.com') return true
  return host === 'crunchyroll.com' && /\/(simulcastcalendar|news\/)/.test(u.pathname)
}
