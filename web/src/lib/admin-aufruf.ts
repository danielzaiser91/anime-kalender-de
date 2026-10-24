/** Aufruf einer Betreiber-Aktion am Worker: der Debug-Token geht im Kopf mit, nie in der Adresse. */
export function adminAnfrage(workerUrl: string, pfad: string, token: string): [string, RequestInit] {
  const init: RequestInit = pfad.startsWith('/debug') ? { headers: { Authorization: `Bearer ${token}` } } : {}
  return [`${workerUrl}${pfad}`, init]
}
