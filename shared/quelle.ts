/**
 * **Der Quellenlink, wie er dasteht** (29.09.2026).
 *
 * Daniel am 28.09.2026 zu den Neuigkeiten: „… sollten diese eventuell auch angezeigt werden (inkl
 * Link zur Quelle)". Der Link steht im Newsletter und auf der Nachrichtenseite; angezeigt wird der
 * **Wirt** (`anime2you.de`, `crunchyroll.com`), damit die Zeile lesbar bleibt und der Leser weiß,
 * wohin er geht. Der Name kommt aus der Adresse, nicht aus dem Datensatz — so ist er immer
 * dieselbe Angabe, die der Link selbst macht.
 */
export function hostVon(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Nur eine echte Adresse ist ein Klickziel — alles andere bleibt Text. */
export function istLink(url?: string): url is string {
  return Boolean(url && /^https?:\/\//i.test(url))
}
