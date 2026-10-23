/**
 * Welche Endpunkte als Push-Dienst gelten. Einzige Stelle: `/push/abo` (Anlegen), `/push/test` und der Versand rufen sie auf,
 * sonst wäre der Endpunkt ein offener Weiterleiter für Abrufe des Workers.
 *
 * Belege: Chrome/Edge/Samsung über Firebase Cloud Messaging (`fcm.googleapis.com`), Firefox über Mozilla Autopush
 * (`updates.push.services.mozilla.com`), Safari über `web.push.apple.com`, Edge/Windows über WNS (`*.notify.windows.com`,
 * z. B. `wns2-par02p.notify.windows.com`).
 */
const GENAU = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']
const ENDUNGEN = ['.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com']

/** Nur https, Standardport, keine Zugangsdaten; der Rechnername ganz gleich oder mit Punkt davor am Ende (nie `enthält`). */
export function istPushDienst(endpoint: string): boolean {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') return false
  const host = url.hostname
  return GENAU.includes(host) || ENDUNGEN.some((e) => host.endsWith(e))
}
