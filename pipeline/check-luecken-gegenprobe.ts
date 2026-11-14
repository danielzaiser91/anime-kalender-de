/**
 * Zusicherungen zu `gegenprobe()` aus `lib/luecken-schreiben.ts`: Liste A + B je Feld gegen die Kürzel in `luecken-titel.json`
 * (`t` Titel, `j` Jahr, `c` Cover). Läuft in `check:logic`; schreibt nichts.
 */
import type { Ergebnis, Zeile } from './lib/luecken-rahmen.ts'
import { gegenprobe } from './lib/luecken-schreiben.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const zeilen = (n: number) => Array.from({ length: n }, () => ({}) as Zeile)
const ergebnis = (datei: string, a: number, b: number) =>
  ({ feld: { datei }, gilt: 0, a: zeilen(a), b: zeilen(b), aGesamt: a, bGesamt: b }) as unknown as Ergebnis

// Bau: Titel fehlt bei 1, 2, 3; Jahr bei 2; Cover bei 3 und 4.
const bau = { '1': 't', '2': 'tj', '3': 'tc', '4': 'c' }

pruefe('alles stimmt', gegenprobe([ergebnis('titel-de.md', 2, 1), ergebnis('jahr.md', 0, 1), ergebnis('cover-sd.md', 1, 1), ergebnis('anderes.md', 9, 9)], bau), [])
pruefe('Abweichung je Feld, A und B zusammengezählt', gegenprobe([ergebnis('titel-de.md', 2, 2), ergebnis('jahr.md', 1, 1), ergebnis('cover-sd.md', 1, 1)], bau), [
  'titel-de.md: 4 statt 3 in luecken-titel.json',
  'jahr.md: 2 statt 1 in luecken-titel.json',
])
pruefe('fehlendes Feld zählt 0', gegenprobe([ergebnis('titel-de.md', 3, 0)], bau), [
  'jahr.md: 0 statt 1 in luecken-titel.json',
  'cover-sd.md: 0 statt 2 in luecken-titel.json',
])
pruefe('ohne Bau-Datei keine Gegenprobe', gegenprobe([ergebnis('titel-de.md', 5, 5)], undefined), [])
pruefe('leere Bau-Datei: jede gezählte Lücke weicht ab', gegenprobe([ergebnis('cover-sd.md', 0, 1)], {}), ['cover-sd.md: 1 statt 0 in luecken-titel.json'])
pruefe('keine Ergebnisse, leere Bau-Datei', gegenprobe([], {}), [])

if (fehler) process.exit(1)
console.log('check-luecken-gegenprobe: ok')
