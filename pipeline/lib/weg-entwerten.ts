/**
 * **Wann ein „weg" den ganzen Weg entwertet — und wann nur eine Staffel.**
 *
 * Liegt in einer eigenen Datei, damit `check:logic` die Regel prüfen kann; `fetch-pruefungen.ts`
 * arbeitet beim Laden und darf nicht importiert werden.
 *
 * **Der Fall** (Daniel, 23.09.2026, auf die Frage „streicht ein ‚nicht verfügbar' für eine
 * Staffel den ganzen Weg?" — „ja", gemeint: so umsetzen): Prime führt Fairy Tail unter einer
 * Adresse; Staffel 1 ist regionsgesperrt, die Staffeln 2 bis 9 kann man kaufen. Meldet jemand
 * Staffel 1 als „weg", schrieb der Einleser `available: false` für die **Adresse** — und acht
 * Staffeln, die es sehr wohl gibt, verschwanden mit.
 *
 * **Die Regel:** Ein „weg" gilt der ganzen Adresse nur, wenn es keine Staffel nennt, wenn an der
 * Adresse ohnehin nur ein Titel hängt, oder wenn für jeden Titel der Adresse eine eigene
 * „weg"-Meldung vorliegt. Sonst bleibt der Weg stehen.
 *
 * Die Richtung der Unsicherheit ist Absicht: Ein Weg zu viel kostet einen Klick, ein gelöschter
 * richtiger Weg kostet die Auskunft.
 */
export function wegGiltGanzerAdresse(
  /** Alle Meldungen dieser Adresse, älteste zuerst. */
  meldungen: { befund: string; staffel?: number | null }[],
  /** Wie viele unserer Titel an der Adresse hängen. */
  titelAnDerAdresse: number,
): boolean {
  const letzte = meldungen[meldungen.length - 1]
  if (letzte?.befund !== 'weg') return false
  const wegMeldungen = meldungen.filter((m) => m.befund === 'weg')
  /* Ohne Staffelangabe meint die Meldung die Seite als Ganzes. */
  if (wegMeldungen.some((m) => m.staffel == null)) return true
  if (titelAnDerAdresse <= 1) return true
  const staffeln = new Set(wegMeldungen.map((m) => m.staffel))
  return staffeln.size >= titelAnDerAdresse
}
