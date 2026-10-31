import { belegLink } from '../../shared/quelle.ts'

/** Eine Cartoon-Meldung braucht Belege, und jeder führt zu einer echten Seite (ein API-Beleg über seine `seite`). */
export function belegeMitAdresse(belege: { url: string; seite?: string }[] | undefined): boolean {
  return (belege ?? []).length > 0 && (belege ?? []).every((b) => Boolean(belegLink(b)))
}
