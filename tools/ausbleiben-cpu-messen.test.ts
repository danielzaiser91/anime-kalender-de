/**
 * Prüft den CPU-Messer der Ausbleiben-Entscheidung (`tools/ausbleiben-cpu-messen.ts`) mit festen Werten, ohne echte Uhr:
 * Urteil (Median statt Höchstwert, Grenze genau auf 5 ms grün), Messreihe mit Attrappe-Zähler, die Rechnung selbst
 * (Fenster-Vorfilter, Zustände) und Exit-Codes von `main` samt echtem Kindprozess.
 *
 * Aufruf: `npx tsx tools/ausbleiben-cpu-messen.test.ts`
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ReleaseEvent } from '../shared/types.ts'
import { GRENZE_MS, ausbleibenLauf, bewerteCpu, main, messeCpu } from './ausbleiben-cpu-messen.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

pruefe(GRENZE_MS === 5, 'Grenze ist 5 ms')
pruefe(bewerteCpu([1, 2, 10], 5).medianMs === 2 && !bewerteCpu([1, 2, 10], 5).rot, 'Median 2 bei Ausreißer 10: grün')
pruefe(bewerteCpu([1, 1, 100], 5).hoechstMs === 100 && !bewerteCpu([1, 1, 100], 5).rot, 'ein Ausreißer macht nicht rot, der Höchstwert steht im Urteil')
pruefe(!bewerteCpu([5, 5, 5], 5).rot, 'genau 5 ms ist grün')
pruefe(bewerteCpu([5.01, 5.01, 5.01], 5).rot, '5,01 ms ist rot')
pruefe(bewerteCpu([4, 6], 5).medianMs === 5 && !bewerteCpu([4, 6], 5).rot, 'gerade Anzahl: Mittel der beiden mittleren (5, grün)')
pruefe(bewerteCpu([4, 7], 5).medianMs === 5.5 && bewerteCpu([4, 7], 5).rot, 'gerade Anzahl: 5,5 ms rot')
pruefe(bewerteCpu([9, 1, 6, 7, 2], 5).medianMs === 6, 'unsortierte Reihe wird sortiert')
pruefe(bewerteCpu([9, 9, 9], 10).rot === false && bewerteCpu([9, 9, 9], 8).rot, 'die Grenze ist Parameter')
try {
  bewerteCpu([], 5)
  pruefe(false, 'leere Reihe wirft')
} catch {
  pruefe(true, 'leere Reihe wirft')
}

// Messreihe: Attrappe-Zähler gibt je Aufruf den nächsten Wert; Aufwärmläufe (3) zählen nicht.
let aufrufe = 0
const werte = [0, 2, 2, 13, 13, 13]
let i = 0
const reihe = messeCpu(() => aufrufe++, 3, () => werte[i++])
pruefe(aufrufe === 6, 'Lauf: 3 Aufwärmläufe + 3 gemessene')
pruefe(reihe.length === 3 && reihe[0] === 2 && reihe[1] === 11 && reihe[2] === 0, `Messwerte je Lauf aus dem Zähler (${reihe.join(', ')})`)

// Die Rechnung: Vorfilter auf 60 Tage, Zustände. Feste Zeit 21.11.2026 12:00 UTC (13:00 Berlin).
const jetzt = new Date('2026-11-21T12:00:00Z')
const termin = (id: string, date: string, time: string | undefined, zusatz: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id, releaseSlug: id, titleId: 900001, releaseType: 'weekly', platform: 'crunchyroll', name: id, date, time, ...zusatz }) as ReleaseEvent
const verpasst = { erwartetAm: '2026-11-20T17:00:00Z' }
const termine = [
  termin('ausgeblieben', '2026-11-20', '18:00', { verpasst }),
  termin('faellig', '2026-11-21', '08:00', { ohneSichtung: true }),
  termin('erschienen', '2026-11-20', '10:00'),
  termin('morgen', '2026-11-22', '10:00'),
  termin('zu-alt-verpasst', '2020-01-01', '10:00', { verpasst }),
  termin('knapp-drin', '2026-09-21', '10:00', { verpasst }),
]
const z = ausbleibenLauf(termine, jetzt)
pruefe(z.imFenster === 5, `Fenster: alter Termin 2020 raus, 60-Tage-Rand und morgen drin (${z.imFenster})`)
pruefe(z.ausgeblieben === 2 && z.faellig === 1, `Zustände: 2 ausgeblieben, 1 fällig (${z.ausgeblieben}/${z.faellig})`)
pruefe(z.nachzusehen === 3, `Nachsehen nur für die 2 ausgebliebenen und den fälligen Termin im Fenster, nicht für erschienen/morgen (${z.nachzusehen})`)

// main: Exit-Codes. Viele Termine, damit die CPU-Zeit sicher über 0 µs liegt.
const ordner = mkdtempSync(join(tmpdir(), 'ausbleiben-cpu-'))
try {
  const viele = Array.from({ length: 300 }, (_, n) => termin(`t${n}`, '2026-11-20', '10:00'))
  const datei = join(ordner, 'events.json')
  writeFileSync(datei, JSON.stringify(viele))
  const log = console.log
  const zeilen: string[] = []
  console.log = (s: string) => void zeilen.push(String(s))
  const gruen = main([datei, '--grenze=100000', '--laeufe=5'], jetzt)
  const rot = main([datei, '--grenze=0', '--laeufe=5'], jetzt)
  const leer = join(ordner, 'leer.json')
  writeFileSync(leer, '[]')
  const unbrauchbar = main([leer], jetzt)
  const fehltDatei = main([join(ordner, 'gibt-es-nicht.json')], jetzt)
  console.log = log
  pruefe(gruen === 0, 'main: weit unter der Grenze → Exit 0')
  pruefe(rot === 1, 'main: Grenze 0 → Exit 1')
  pruefe(unbrauchbar === 2 && fehltDatei === 2, 'main: leere oder fehlende Datei → Exit 2 (nie still grün)')
  pruefe(zeilen[0]?.startsWith('✓') === true && zeilen[1]?.startsWith('✖') === true && zeilen[0].includes('300 Termine'), 'main: Ergebniszeile nennt Urteil und Zähler')

  const kind = (args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'tools/ausbleiben-cpu-messen.ts', ...args], { encoding: 'utf8', timeout: 60_000 })
  const k1 = kind([datei, '--grenze=100000', '--laeufe=5'])
  pruefe(k1.status === 0 && k1.stdout.startsWith('✓'), `Kindprozess: Einstieg läuft, Exit 0 (${k1.status})`)
  const k2 = kind([join(ordner, 'gibt-es-nicht.json')])
  pruefe(k2.status === 2, `Kindprozess: fehlende Datei → Exit 2 (${k2.status})`)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}

console.log(fehler === 0 ? '✓ Ausbleiben-CPU-Messer: alle Fälle ok' : `✖ ${fehler} Fall/Fälle FEHL`)
process.exit(fehler === 0 ? 0 : 1)
