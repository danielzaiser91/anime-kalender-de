import { readFileSync, writeFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { entferneFastDoppel, type FastDoppelBilanz } from './handbeleg-fast-doppel.ts'

/**
 * Fast-Doppel in einer Handbeleg-Datei entfernen. Gegenprobe vor dem Schreiben: Die Zahl der Belege sinkt genau um
 * `entfernt`, und jeder verbleibende Beleg stand vorher da. Scheitert sie, bleibt die Datei, wie sie ist (`ok: false`).
 * `entferne` ist einspeisbar, damit Tests eine verfälschende Fassung durch beide Gegenproben schicken können.
 */
export function vereineDatei(pfad: string, trocken: boolean, entferne: (text: string) => FastDoppelBilanz = entferneFastDoppel): { ok: boolean; zeilen: string[] } {
  const text = readFileSync(pfad, 'utf8')
  const bilanz = entferne(text)
  const vorher = (yaml.load(text) as unknown[]) ?? []
  const nachher = (yaml.load(bilanz.text) as unknown[]) ?? []
  const stand = new Set(vorher.map((b) => JSON.stringify(b)))
  const zahlStimmt = vorher.length - nachher.length === bilanz.entfernt
  const teilmenge = nachher.every((b) => stand.has(JSON.stringify(b)))
  const zeilen = [
    `Belege vorher ${vorher.length}, nachher ${nachher.length}, entfernt ${bilanz.entfernt}`,
    `Gruppen ${bilanz.gruppen}, davon nicht zusammengeführt: ${bilanz.gemischt} mit gemischter Herkunft, ${bilanz.blockiert} aus anderem Grund blockiert (Kommentar, Datumsform, Reihenfolge)`,
  ]
  if (!zahlStimmt || !teilmenge) return { ok: false, zeilen: [...zeilen, 'Gegenprobe gescheitert — nichts geschrieben.'] }
  if (!trocken) writeFileSync(pfad, bilanz.text)
  return { ok: true, zeilen: [...zeilen, trocken ? '(trocken — nichts geschrieben)' : `${pfad} geschrieben`] }
}
