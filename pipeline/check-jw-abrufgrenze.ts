/**
 * Zusicherung: JustWatch-Befunde werden erneuert, bevor sie verfallen. Die Abrufgrenze (`--alter`, Vorgabe `ABRUF_ALTER_TAGE`) liegt mindestens
 * einen Wochenlauf unter `BEFUND_MAX_TAGE`; sonst hängt ein Befund bis zu 7 Tage ungültig und nicht fällig (Lücke vom 19.11.2026: Vorgabe 28 = Gültigkeit 28).
 * Geprüft werden die Vorgabe selbst und jeder Aufruf `data:justwatch…` (außer `-frisch`, das altersunabhängig nur vorzieht) in `package.json` und den Workflows.
 * Läuft in `check:logic`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './lib/util.ts'
import { BEFUND_MAX_TAGE, abrufAlterTage } from './lib/jw-vertrauen.ts'

const WOCHENTAKT_TAGE = 7

/** Fehlertext, wenn die Abrufgrenze nicht mindestens einen Wochentakt unter der Gültigkeit liegt, sonst null. */
export function abrufGrenzeFehler(alter: number, max: number): string | null {
  if (Number.isFinite(alter) && alter < max - WOCHENTAKT_TAGE) return null
  return `Abrufgrenze ${alter} Tage ist nicht unter ${max - WOCHENTAKT_TAGE} (Gültigkeit ${max} minus ein Wochenlauf)`
}

/** Alle `npm run data:justwatch…`-Aufrufe (ohne `-frisch`) in den Befehlstexten, je Aufruf das wirksame `--alter`. */
export function aufrufAlter(befehle: string[]): { befehl: string; alter: number }[] {
  const erg: { befehl: string; alter: number }[] = []
  for (const text of befehle)
    for (const zeile of text.split('\n')) {
      const teile = zeile.trim().split(/\s+/)
      const i = teile.findIndex((t) => /^data:justwatch(-cartoons)?$/.test(t))
      if (i >= 0) erg.push({ befehl: zeile.trim(), alter: abrufAlterTage(teile.slice(i + 1)) })
    }
  return erg
}

/** Befehlstexte: Skripte aus `package.json` und `run:` aller Workflow-Schritte (geparst, nicht per Textsuche). */
function ladeBefehle(): string[] {
  const skripte = Object.entries(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>)
  const befehle = skripte
    .filter(([name, s]) => /^data:justwatch(-cartoons)?$/.test(name) && /fetch-justwatch-audio/.test(s))
    .map(([, s]) => s.replace(/^.*?pipeline\/fetch-justwatch-audio\.ts/, 'data:justwatch'))
  const ordner = join(ROOT, '.github', 'workflows')
  for (const datei of readdirSync(ordner).filter((d) => d.endsWith('.yml'))) {
    const doc = yaml.load(readFileSync(join(ordner, datei), 'utf8')) as { jobs?: Record<string, { steps?: { run?: string }[] }> }
    for (const job of Object.values(doc?.jobs ?? {}))
      for (const s of job.steps ?? []) if (typeof s.run === 'string') befehle.push(s.run)
  }
  return befehle
}

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

/* Rechenregel: Grenzfälle um 20/21 (Gültigkeit 28), Luft für einen Wochenlauf plus einen Tag. */
pruefe('20 Tage bei 28 ist in Ordnung', abrufGrenzeFehler(20, 28) === null)
pruefe('21 Tage bei 28 ist zu spät (Wochenlauf + 0 Tage Luft)', abrufGrenzeFehler(21, 28) !== null)
pruefe('28 Tage bei 28 ist zu spät', abrufGrenzeFehler(28, 28) !== null)
pruefe('NaN ist ein Fehler', abrufGrenzeFehler(Number.NaN, 28) !== null)
pruefe('Gültigkeit ändert die Grenze mit (35 → 27 ok, 28 nicht)', abrufGrenzeFehler(27, 35) === null && abrufGrenzeFehler(28, 35) !== null)

/* Aufrufe: Wochenlauf ohne Angabe, mit Angabe, Cartoons, Frisch zählt nicht, Mehrzeiler, fremder Befehl. */
const probe = aufrufAlter([
  'bash tools/schritt.sh --zeit 35m "JW" -- npm run data:justwatch -- --limit 800',
  'a\nnpm run data:justwatch -- --limit 5 --alter 28\nb',
  'npm run data:justwatch-cartoons -- --limit 5 --alter 14',
  'npm run data:justwatch-frisch',
  'npm run data:tmdb',
])
pruefe('drei Aufrufe gezählt, Frisch und fremde nicht', probe.length === 3, probe)
pruefe('ohne --alter gilt die Vorgabe (20)', probe[0]?.alter === 20, probe[0])
pruefe('--alter 28 wird gelesen', probe[1]?.alter === 28, probe[1])
pruefe('--alter 14 bei Cartoons wird gelesen', probe[2]?.alter === 14, probe[2])

/* Echter Stand. */
pruefe('Vorgabe liegt unter der Gültigkeit', abrufGrenzeFehler(abrufAlterTage([]), BEFUND_MAX_TAGE) === null, abrufAlterTage([]))
const echt = aufrufAlter(ladeBefehle())
pruefe('mindestens der Wochenlauf ruft data:justwatch auf', echt.length >= 1, echt)
for (const a of echt) {
  const f = abrufGrenzeFehler(a.alter, BEFUND_MAX_TAGE)
  pruefe(`Aufruf ${a.befehl}`, f === null, f)
}

console.log(`JustWatch-Abrufgrenze: ${echt.length} Aufrufe, Vorgabe ${abrufAlterTage([])} Tage bei Gültigkeit ${BEFUND_MAX_TAGE}; FEHLER: ${fehler}`)
process.exit(fehler ? 1 : 0)
