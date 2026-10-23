import { ICS_FUSS, icsKopf } from '../../shared/ics.ts'

/**
 * **Persönlicher Kalender-Feed aus der fertigen `feeds/all.ics`** (23.10.2026).
 *
 * Vorher parste jeder Abruf `events.json` (1,1 MB, rund 3.950 Termine seit 2015) und baute daraus die Datei neu:
 * mit allen Titeln als Favoriten 1,55 MB und 360–530 ms CPU in Node, Workers Free erlaubt 10 ms. `all.ics` führt dieselben
 * Termine ab sieben Tage zurück (Daniel, 21.08.2026: wer abonniert, will nichts von vor Jahren) und ist schon im Bau
 * entstanden; hier werden nur die Termine der Favoriten herausgeschnitten und neu eingerahmt. Jeder Termin trägt seine
 * Titelkennung in der Zeile „Details: …/t/<ak>/“.
 */
const BEGINN = 'BEGIN:VEVENT\r\n'
const ENDE = 'END:VEVENT\r\n'

const titelKennung = (block: string): number | undefined => {
  const treffer = /Details: [^\r\n]*\/t\/(-?\d+)\/\r\n/.exec(block.replace(/\r\n /g, ''))
  return treffer ? Number(treffer[1]) : undefined
}

/** Die Termine aus `alleIcs`, deren Titel in `favoriten` steht, in der Reihenfolge der Quelle. */
export function schneideFeed(alleIcs: string, favoriten: Set<number>, kalenderName: string): string {
  const teile = [icsKopf(kalenderName)]
  let start = favoriten.size ? alleIcs.indexOf(BEGINN) : -1
  while (start !== -1) {
    const ende = alleIcs.indexOf(ENDE, start)
    if (ende === -1) break
    const block = alleIcs.slice(start, ende + ENDE.length)
    const id = titelKennung(block)
    if (id !== undefined && favoriten.has(id)) teile.push(block)
    start = alleIcs.indexOf(BEGINN, ende + ENDE.length)
  }
  teile.push(ICS_FUSS)
  return teile.join('')
}
