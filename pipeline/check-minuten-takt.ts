/**
 * Zusicherungen zum Minutentakt der „jetzt"-Linie (15.10.2026, Daniel: Linie hinkte bis zu 59 s hinterher):
 * Rechnung bis zur nächsten vollen Minute, erster Takt auf der Minutengrenze, Aufräumen. Läuft in `check:logic`.
 */
import { minutenTakt, msBisNaechsteMinute } from '../web/src/lib/minuten-takt.ts'

let fehler = 0
function gleich(ist: unknown, soll: unknown, was: string) {
  if (ist === soll) return
  fehler++
  console.error(`FEHLER: ${was}: ${String(ist)}, erwartet ${String(soll)}`)
}

const tag = Date.UTC(2026, 9, 15, 12, 0, 0, 0)
gleich(msBisNaechsteMinute(tag), 60_000, '12:00:00.000')
gleich(msBisNaechsteMinute(tag + 59_500), 500, '12:00:59.500')
gleich(msBisNaechsteMinute(tag + 1), 59_999, '12:00:00.001')
gleich(msBisNaechsteMinute(tag + 59_999), 1, '12:00:59.999')

// Mit gefälschten Timern: Der erste Takt kommt zur nächsten vollen Minute (spätestens dann wird die Änderung sichtbar).
const echt = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout }
const wartezeiten: number[] = []
const abrufe: (() => void)[] = []
let geloescht = 0
globalThis.setTimeout = ((f: () => void, ms: number) => {
  abrufe.push(f)
  wartezeiten.push(ms)
  return abrufe.length as unknown as ReturnType<typeof setTimeout>
}) as typeof setTimeout
globalThis.clearTimeout = (() => { geloescht++ }) as typeof clearTimeout

let zeit = tag + 12_345
let takte = 0
const aufraeumen = minutenTakt(() => { takte++ }, () => zeit)
gleich(wartezeiten[0], 60_000 - 12_345, 'erster Takt nach')
gleich(takte, 0, 'Takte vor Ablauf')
zeit = tag + 60_000
abrufe[0]!()
gleich(takte, 1, 'Takte nach der Minutengrenze')
gleich(wartezeiten[1], 60_000, 'zweiter Takt nach')
aufraeumen()
gleich(geloescht, 1, 'Aufräumen löscht den Timer')

globalThis.setTimeout = echt.setTimeout
globalThis.clearTimeout = echt.clearTimeout

if (fehler) process.exit(1)
console.log('check-minuten-takt: ok')
