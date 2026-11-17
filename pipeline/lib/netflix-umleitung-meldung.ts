/**
 * Netflix-Totmeldungen „Umleitung auf Startseite“ aus dem fehlerhaften Takt zählen nicht (17.11.2026).
 *
 * Der Sekundentakt `akNetflixUmgeleitet` (seit 15.11.2026, PR 3933) meldete Titel als „nicht bei Netflix“, wenn der Tab
 * während der Vorprüfung auf /browse stand. 149 Netflix-Kennungen wurden so gemeldet, der Bau strich daraus 170 Wege.
 * Eine fehlerhafte Messung widerlegt nichts: solche Meldungen werden verworfen und abgehakt, nicht zugeordnet.
 * Das Datum ist der Tag, ab dem die behobene Erweiterung (PR 4144) ausgeliefert sein kann; die Regel entfällt, sobald
 * eine einzelne Browser-Totmeldung ohnehin keinen Weg mehr streicht.
 */
const NOTIZ = /^Vom Durchgang als nicht bei Netflix gemeldet — Umleitung auf Startseite/

/** Erster Tag (UTC), an dem eine Umleitungs-Meldung wieder gilt; Vergleich als Text, passt für „2026-11-15T…“ und „2026-11-15 …“. */
export const UMLEITUNG_GILT_AB = '2026-11-20'

type Meldung = { id: number; plattform: string; befund?: string; notiz?: string | null; gemeldet_am?: string }

export function istFehlUmleitung(p: Meldung): boolean {
  return p.plattform === 'netflix' && p.befund === 'weg' && NOTIZ.test(p.notiz ?? '') && (p.gemeldet_am ?? '') < UMLEITUNG_GILT_AB
}
