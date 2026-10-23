/**
 * **Der Quellenlink, wie er dasteht** (29.09.2026).
 *
 * Daniel am 28.09.2026 zu den Neuigkeiten: „… sollten diese eventuell auch angezeigt werden (inkl
 * Link zur Quelle)". Der Link steht im Newsletter und auf der Nachrichtenseite; angezeigt wird der
 * **Wirt** (`anime2you.de`, `crunchyroll.com`), damit die Zeile lesbar bleibt und der Leser weiß,
 * wohin er geht. Der Name kommt aus der Adresse, nicht aus dem Datensatz — so ist er immer
 * dieselbe Angabe, die der Link selbst macht.
 */
/**
 * **Nicht jeder Host erklärt sich selbst.**
 *
 * `gw.api.animationdigitalnetwork.com` ist ADNs Kalender-Endpunkt. Als Link
 * sichtbar sagte der Host niemandem, warum der Klick in eine Fehlermeldung
 * führt (ohne `date`-Parameter antwortet er mit `400 Bad Request`, Daniel mit
 * Bild, 01.10.2026). Seit dem 19.10.2026 ist so eine Adresse kein Klickziel mehr
 * (`istLink`); der Name bleibt für Übersichten, die den Host nennen.
 */
const ANZEIGENAME: Record<string, string> = {
  'gw.api.animationdigitalnetwork.com': 'ADN API',
}

/** Hostname → Anzeigename. Dieselbe Zuordnung für Seite, Feed und Bestand. */
export function quelleAnzeigeName(host: string, pfad = ''): string {
  /*
    **Crunchyrolls Nachrichtenseite ist nicht die Streaming-Seite** (01.10.2026).
    Ein Link auf `/de/news/…` führt zu Crunchyroll **News**; „crunchyroll.com"
    allein ließe eine Serienseite erwarten.
  */
  if (host === 'crunchyroll.com' && /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?news\//i.test(pfad)) return 'Crunchyroll News'
  return ANZEIGENAME[host] ?? host
}

export function hostVon(url: string): string {
  try {
    const u = new URL(url)
    return quelleAnzeigeName(u.host.replace(/^www\./, ''), u.pathname)
  } catch {
    return url
  }
}

const API_HOST = /(?:^|\.)(?:api|graphql)\./i
const API_PFAD = /\/api\/|graphql|\.json$/i

/** Maschinenadresse (ADN-Gateway, `/api/`, GraphQL, `.json`): liefert keine Seite, die ein Besucher lesen kann. */
export function istApiAdresse(url: string): boolean {
  try {
    const u = new URL(url)
    return API_HOST.test(u.hostname) || API_PFAD.test(u.pathname)
  } catch {
    return false
  }
}

/** Nur eine echte Adresse ist ein Klickziel — alles andere bleibt Text. Eine API-Adresse ist keine (ADN-Kalender: 400 Bad Request). */
export function istLink(url?: string): url is string {
  return Boolean(url && /^https?:\/\//i.test(url) && !istApiAdresse(url))
}

/** Wohin „Originalseite“ eines Belegs führt: die öffentliche Seite (`seite`), sonst die Adresse selbst; eine API-Adresse nie. */
export function belegLink(b: { url: string; seite?: string }): string | undefined {
  const ziel = b.seite ?? b.url
  return istLink(ziel) ? ziel : undefined
}
