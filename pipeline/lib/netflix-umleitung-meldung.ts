/**
 * Netflix-Totmeldungen „Umleitung auf Startseite“ aus dem fehlerhaften Takt zählen nicht (17.11.2026).
 *
 * Der Sekundentakt `akNetflixUmgeleitet` (seit 15.11.2026, PR 3933) meldete Titel als „nicht bei Netflix“, wenn der Tab
 * während der Vorprüfung auf /browse stand. 149 Netflix-Kennungen wurden so gemeldet, der Bau strich daraus 170 Wege.
 * Eine fehlerhafte Messung widerlegt nichts: solche Meldungen werden nicht zugeordnet und nicht abgehakt (zurückgestellt: sie bleiben im Briefkasten, nichts geht verloren).
 * Stichtag belegt (18.11.2026): Merge von PR 4144 (17.11. 18:14:41Z), danach „Version gezählt“ 4.32.151 (71e1278e, 18:15:04Z);
 * ab da gelten Umleitungs-Meldungen wieder. Die Regel entfällt, sobald
 * eine einzelne Browser-Totmeldung ohnehin keinen Weg mehr streicht.
 */
const NOTIZ = /^Vom Durchgang als nicht bei Netflix gemeldet — Umleitung auf Startseite/

/** Zeitpunkt (UTC), ab dem eine Umleitungs-Meldung wieder gilt: erste Erweiterung mit dem Fix von PR 4144 (siehe Kopf). */
export const UMLEITUNG_GILT_AB = '2026-11-17T18:15:04Z'

type Meldung = { id: number; plattform: string; befund?: string; notiz?: string | null; gemeldet_am?: string }

/** `gemeldet_am` als Millisekunden; „2026-11-17 20:08:00“ (SQLite) und „…T20:08:00Z“ (Worker) gelten gleich, ohne Zone = UTC. NaN, wenn unlesbar. */
export function gemeldetMs(text: string | undefined): number {
  const t = (text ?? '').trim().replace(' ', 'T')
  return Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(t) ? t : `${t}Z`)
}

/** Leeres oder unlesbares `gemeldet_am` bleibt zurückgestellt; der Stapel zählt es (stille Ausfälle). */
export function zeitUnlesbar(p: Meldung): boolean {
  return Number.isNaN(gemeldetMs(p.gemeldet_am))
}

export function istFehlUmleitung(p: Meldung): boolean {
  if (p.plattform !== 'netflix' || p.befund !== 'weg' || !NOTIZ.test(p.notiz ?? '')) return false
  const ms = gemeldetMs(p.gemeldet_am)
  return Number.isNaN(ms) || ms < Date.parse(UMLEITUNG_GILT_AB)
}
