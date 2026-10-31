/**
 * Wer als Cartoon erscheint (16.10.2026, „The Orange SMP“: ein Minecraft-Fanprojekt stand als Animationsserie in der Datenbank).
 *
 * `fetch-cartoons.ts` holt auch noch nicht erschienene Titel ohne Anbieter, und TMDB lässt dort jeden Eintrag mit Genre Animation zu,
 * auch Webserien und Fanprojekte. Ohne deutschen Anbieter braucht ein Titel deshalb einen Beleg, dass es eine Serie eines Senders oder
 * Produzenten ist: ein Netzwerk, das kein Webkanal ist, oder ein Produktionsstudio. Der Eintrag bleibt in `data/cartoons.json` und
 * erscheint von selbst, sobald TMDB Anbieter, Sender oder Studio nachträgt (verschoben, nicht gelöscht).
 */
import type { CartoonEintrag } from './cartoons.ts'

/** Netzwerke, die ein Webkanal sind: jeder darf dort senden, das Netzwerk belegt keine Serie. */
const WEBKANAELE = ['youtube', 'twitch', 'tiktok', 'vimeo', 'dailymotion']

/** Studio-Einträge, die nur „keine Firma“ heißen (TMDB-Eintrag „Independent“ bei HaneKage). */
const KEIN_STUDIO = ['independent']

export function istWebkanal(netzwerk: string | undefined): boolean {
  const n = (netzwerk ?? '').toLowerCase()
  return WEBKANAELE.some((k) => n.startsWith(k))
}

/** Ein Eintrag der ADN-Handliste (`adnId`) ist durch ADN belegt, auch ohne deutschen TMDB-Anbieter. */
export function hatAufnahmeBeleg(e: Pick<CartoonEintrag, 'anbieterDe' | 'netzwerk' | 'studios' | 'adnId'>): boolean {
  if (e.anbieterDe.length || e.adnId) return true
  if (istWebkanal(e.netzwerk)) return false
  return Boolean(e.netzwerk) || (e.studios ?? []).some((s) => !KEIN_STUDIO.includes(s.toLowerCase()))
}
