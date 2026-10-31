/**
 * Urteil für eine Liste, die durch erledigte Arbeit schrumpft (offene Ankündigungen, Handbelege, Wege mit „≈“):
 * Leer ist grün („nichts zu tun“), solange die Quelle selbst Einträge trägt. Eine leere Quelle heißt kaputter Lauf und bleibt rot.
 * `offen` = Einträge, die die Prüfung beschäftigen; `quelle` = Größe der Datei, aus der sie gefiltert werden.
 */
export interface ListenUrteil {
  ok: boolean
  zeile: string
}

export function leereListe(name: string, offen: number, quelle: number): ListenUrteil {
  if (quelle <= 0) return { ok: false, zeile: `${name}: Quelle leer oder fehlt (Lauf kaputt?)` }
  if (offen <= 0) return { ok: true, zeile: `${name}: 0 offen — nichts zu tun (Quelle: ${quelle})` }
  return { ok: true, zeile: `${name}: ${offen} von ${quelle}` }
}
