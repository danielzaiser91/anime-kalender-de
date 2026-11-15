/**
 * Kalenderkopf: Kalender-Apps fragen den Feed seltener ab, wenn er 12 Stunden Abrufabstand nennt (B5, 23.10.2026); dazu die Lizenzzeile.
 * Aufruf: `npx tsx pipeline/check-ics-kopf.ts`
 */
import { ICS_BESCHREIBUNG, buildIcs } from '../shared/ics.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean): void {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`)
  if (!ok) verletzt++
}

const zeilen = buildIcs([]).split('\r\n')
const schluss = zeilen.indexOf('END:VCALENDAR')
const kopf = zeilen.slice(0, schluss)
pruefe('REFRESH-INTERVAL:PT12H im Kopf', kopf.includes('REFRESH-INTERVAL;VALUE=DURATION:PT12H'))
pruefe('X-PUBLISHED-TTL:PT12H im Kopf', kopf.includes('X-PUBLISHED-TTL:PT12H'))
pruefe('je Angabe genau eine Zeile', zeilen.filter((z) => z.startsWith('REFRESH-INTERVAL')).length === 1 && zeilen.filter((z) => z.startsWith('X-PUBLISHED-TTL')).length === 1)
pruefe('Kopf zwischen BEGIN und END:VCALENDAR', kopf[0] === 'BEGIN:VCALENDAR' && schluss === zeilen.length - 2)

/* Lizenzzeile für Einbinder, die die Seite nie sehen (15.11.2026): nach RFC 5545 gefaltet, für Google ≤ 255 Zeichen. */
const entfaltet = buildIcs([]).replace(/\r\n /g, '').split('\r\n')
const beschreibung = entfaltet.find((z) => z.startsWith('X-WR-CALDESC:'))
pruefe('X-WR-CALDESC nennt Lizenz und Hinweis-Adresse', beschreibung === 'X-WR-CALDESC:Daten von anime-kalender.de unter CC BY 4.0. Hinweise für Webseiten und Apps: https://anime-kalender.de/#/abo')
pruefe('X-WR-CALDESC direkt nach X-WR-CALNAME', entfaltet.indexOf(beschreibung!) === entfaltet.findIndex((z) => z.startsWith('X-WR-CALNAME:')) + 1)
pruefe('X-WR-CALDESC gefaltet, jede Zeile ≤ 75 Oktette', kopf.some((z) => z.startsWith(' ')) && kopf.every((z) => new TextEncoder().encode(z).length <= 75))
pruefe('Beschreibung ≤ 255 Zeichen', [...ICS_BESCHREIBUNG].length <= 255)
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : 'ICS-Kopf: alle Zusicherungen halten (REFRESH-INTERVAL, X-PUBLISHED-TTL, X-WR-CALDESC).')
process.exit(verletzt ? 1 : 0)
