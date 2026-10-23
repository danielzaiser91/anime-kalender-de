/**
 * Kalenderkopf: Kalender-Apps fragen den Feed seltener ab, wenn er 12 Stunden Abrufabstand nennt (B5, 23.10.2026).
 * Aufruf: `npx tsx pipeline/check-ics-kopf.ts`
 */
import { buildIcs } from '../shared/ics.ts'

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
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : 'ICS-Kopf: alle Zusicherungen halten (REFRESH-INTERVAL, X-PUBLISHED-TTL).')
process.exit(verletzt ? 1 : 0)
