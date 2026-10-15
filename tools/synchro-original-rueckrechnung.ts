/**
 * Rückrechnung der Synchro-Fortschreibung nach den Originalterminen (`shared/synchro-original.ts`, 15.10.2026).
 *
 * Für jedes wöchentliche Release mit mindestens fünf beobachteten Folgen wird jede Beobachtung ab der fünften
 * vorhergesagt — nur aus den Folgen davor — und gegen den wirklichen Tag gehalten. Ausgabe je Abweichung der
 * Vorhersage (Originaltag plus Abstand) vom Wochentakt: wie oft die Tabelle stimmte, wie oft der Wochentakt.
 * Die Zeile „greift“ zählt nur, was `termineNachOriginal` heute tatsächlich vorhersagt.
 *
 * Aufruf: npx tsx tools/synchro-original-rueckrechnung.ts
 */
import { readFileSync } from 'node:fs'
import type { Release } from '../shared/types.ts'
import { addDays } from '../shared/time.ts'
import { synchroVersatz, termineNachOriginal } from '../shared/synchro-original.ts'
import { originalTage } from '../pipeline/bau/synchro-nach-original.ts'
import type { TmdbEintrag } from '../pipeline/bau/folgentitel-tmdb.ts'

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(new URL(`../${pfad}`, import.meta.url), 'utf8')) as T
const releases = lies<Release[]>('public/data/releases.json')
const tmdb = lies<Record<string, TmdbEintrag>>('data/tmdb-folgen.json')

const tage = (d: string): number => Math.round(Date.parse(`${d}T12:00:00Z`) / 86_400_000)

interface Zeile {
  tabelleRichtig: number
  tabelleFalsch: number
  wochentaktRichtig: number
  greiftRichtig: number
  greiftFalsch: number
  beispiele: string[]
}
const jeAbweichung = new Map<number, Zeile>()
const zeile = (d: number): Zeile => {
  const z = jeAbweichung.get(d) ?? { tabelleRichtig: 0, tabelleFalsch: 0, wochentaktRichtig: 0, greiftRichtig: 0, greiftFalsch: 0, beispiele: [] }
  jeAbweichung.set(d, z)
  return z
}

for (const r of releases) {
  const s = r.schedule
  if (r.releaseType !== 'weekly' || !s?.observed || s.wochentage?.length) continue
  const original = originalTage(tmdb[String(r.titleId)])
  const folgen = Object.keys(s.observed).map(Number).sort((a, b) => a - b)
  for (let k = 4; k < folgen.length; k++) {
    const davor = Object.fromEntries(folgen.slice(0, k).map((n) => [n, s.observed![n]!]))
    const folge = folgen[k]!
    const versatz = synchroVersatz(davor, original)
    if (versatz === undefined || !original[folge] || !s.observed[folge]) continue
    const letzte = folgen[k - 1]!
    const takt = addDays(davor[letzte]!, 7 * (folge - letzte))
    const vorhersage = addDays(original[folge], versatz)
    const abweichung = Math.abs(tage(vorhersage) - tage(takt))
    if (abweichung === 0) continue
    const z = zeile(abweichung)
    const stimmt = vorhersage === s.observed[folge]
    if (stimmt) z.tabelleRichtig++
    else {
      z.tabelleFalsch++
      if (z.beispiele.length < 4) z.beispiele.push(`${r.name} F${folge}`)
    }
    if (takt === s.observed[folge]) z.wochentaktRichtig++
    if (termineNachOriginal(davor, original, folge)[folge] === vorhersage) {
      if (stimmt) z.greiftRichtig++
      else z.greiftFalsch++
    }
  }
}

console.log('Abweichung vom Wochentakt | Tabelle richtig | Tabelle falsch | Wochentakt richtig | davon greift heute: richtig / falsch')
for (const [d, z] of [...jeAbweichung].sort((a, b) => a[0] - b[0])) {
  console.log(`${d} Tag(e) | ${z.tabelleRichtig} | ${z.tabelleFalsch} | ${z.wochentaktRichtig} | ${z.greiftRichtig} / ${z.greiftFalsch}${z.tabelleFalsch ? `  (falsch z. B. ${z.beispiele.join(', ')})` : ''}`)
}
const alle = [...jeAbweichung.values()]
const summe = (f: (z: Zeile) => number): number => alle.reduce((n, z) => n + f(z), 0)
console.log(`alle abweichenden Vorhersagen (ohne Mindestabweichung): ${summe((z) => z.tabelleRichtig + z.tabelleFalsch)}, richtig ${summe((z) => z.tabelleRichtig)}, falsch ${summe((z) => z.tabelleFalsch)}`)
console.log(`was heute greift: richtig ${summe((z) => z.greiftRichtig)}, falsch ${summe((z) => z.greiftFalsch)}`)
