/**
 * Titel, deren archivierte aniSearch-Seite eine deutsche Disc-Ausgabe nennt, die aber in `data/disc-ausgaben.json` fehlen.
 * Anlass 06.11.2026: 163 reine aniSearch-Titel fanden dort nie statt (die Zuordnung las nur `anisearch.json`); 0 von 163 hatten eine Disc.
 *
 * `ausgabenVon` liefert die Zahl deutscher Ausgaben der Seite eines Titels (0 = Seite fehlt oder ohne Ausgabe);
 * `discAusgaben` ist die Datei `data/disc-ausgaben.json` (Titelkennung → Ausgaben).
 */
export function titelOhneDisc(
  titelIds: Iterable<number>,
  ausgabenVon: (titelId: number) => number,
  discAusgaben: Record<string, unknown[]>,
): number[] {
  const fehlt: number[] = []
  for (const id of titelIds) {
    if (discAusgaben[String(id)]?.length) continue
    if (ausgabenVon(id) > 0) fehlt.push(id)
  }
  return fehlt.sort((a, b) => a - b)
}
