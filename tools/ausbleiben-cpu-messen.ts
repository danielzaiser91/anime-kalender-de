/**
 * **CPU-Messer für die Ausbleiben-Entscheidung** (Schwelle 5 ms je Lauf): Das Ausbleiben soll binnen Minuten erkannt werden,
 * also läuft die Entscheidung („erschienen, fällig, ausgeblieben, wann wieder nachsehen?“) alle fünf Minuten über alle Termine.
 * Der Messer fährt genau diese Rechnung (`terminZustand`, `faelligeArten`) über `public/data/events.json` und wird rot,
 * wenn der Median der CPU-Zeit je Lauf die Grenze überschreitet. Ohne D1, ohne Netz, ohne Deploy; Free-Plan des Workers: 10 ms je Aufruf.
 *
 * Aufruf: `npx tsx tools/ausbleiben-cpu-messen.ts [events.json] [--grenze=<ms>] [--laeufe=<n>]`
 * Exit 0 = Median ≤ Grenze, 1 = darüber, 2 = Eingabe unbrauchbar.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { RECHERCHE_BIS_MS, faelligeArten } from '../shared/ausbleiben-plan.ts'
import { terminZustand } from '../shared/termin-zustand.ts'
import { berlinToUtc } from '../shared/time.ts'
import type { ReleaseEvent } from '../shared/types.ts'
import { imTagesfenster } from '../worker/src/push-fenster.ts'

export const GRENZE_MS = 5
const AUFWAERM_LAEUFE = 3
const LAEUFE = 21

export interface Urteil {
  medianMs: number
  hoechstMs: number
  rot: boolean
}

/** Median und Höchstwert der Messreihe; rot, wenn der Median über der Grenze liegt (genau auf der Grenze ist grün). */
export function bewerteCpu(messwerteMs: number[], grenzeMs: number): Urteil {
  if (messwerteMs.length === 0) throw new Error('keine Messwerte')
  const s = [...messwerteMs].sort((a, b) => a - b)
  const mitte = s.length >> 1
  const medianMs = s.length % 2 ? s[mitte] : (s[mitte - 1] + s[mitte]) / 2
  return { medianMs, hoechstMs: s[s.length - 1], rot: medianMs > grenzeMs }
}

/**
 * Ein Lauf der Entscheidung: Datums-Vorfilter auf das Fenster, in dem noch nachgesehen wird (`RECHERCHE_BIS_MS`), dann je Termin
 * der Zustand und bei Ausbleiben oder Fälligkeit die Nachsehen-Tabelle. Die Zählung belegt, dass die Rechnung etwas tat.
 */
export function ausbleibenLauf(termine: ReleaseEvent[], jetzt: Date): { imFenster: number; ausgeblieben: number; faellig: number; nachzusehen: number } {
  const imFenster = imTagesfenster(termine, new Date(jetzt.getTime() - RECHERCHE_BIS_MS), jetzt)
  let ausgeblieben = 0
  let faellig = 0
  let nachzusehen = 0
  for (const e of imFenster) {
    const zustand = terminZustand(e, jetzt)
    if (zustand === 'ausgeblieben') ausgeblieben++
    if (zustand === 'faellig') faellig++
    if (zustand !== 'ausgeblieben' && zustand !== 'faellig') continue
    if (faelligeArten(berlinToUtc(e.date, e.time ?? '23:59').getTime(), {}, jetzt.getTime()).length > 0) nachzusehen++
  }
  return { imFenster: imFenster.length, ausgeblieben, faellig, nachzusehen }
}

const cpuMs = (): number => {
  const u = process.cpuUsage()
  return (u.user + u.system) / 1000
}

/** CPU-Zeit (ms) je Lauf nach einigen Aufwärmläufen (JIT, erster Aufruf nach dem Start kostet bis 5 ms). */
export function messeCpu(lauf: () => unknown, laeufe: number, cpu: () => number = cpuMs): number[] {
  for (let i = 0; i < AUFWAERM_LAEUFE; i++) lauf()
  const werte: number[] = []
  for (let i = 0; i < laeufe; i++) {
    const vor = cpu()
    lauf()
    werte.push(cpu() - vor)
  }
  return werte
}

const zahlOption = (args: string[], name: string, vorgabe: number): number => {
  const treffer = args.find((a) => a.startsWith(`--${name}=`))
  return treffer ? Number(treffer.slice(name.length + 3)) : vorgabe
}

export function main(args: string[], jetzt: Date = new Date()): number {
  const grenze = zahlOption(args, 'grenze', GRENZE_MS)
  const laeufe = zahlOption(args, 'laeufe', LAEUFE)
  const pfad = args.find((a) => !a.startsWith('--')) ?? 'public/data/events.json'
  let termine: ReleaseEvent[]
  try {
    termine = JSON.parse(readFileSync(pfad, 'utf8'))
  } catch (err) {
    console.log(`✖ ${pfad} nicht lesbar: ${err instanceof Error ? err.message : err}`)
    return 2
  }
  if (!Array.isArray(termine) || termine.length === 0 || !(grenze >= 0) || !(laeufe >= 1)) {
    console.log(`✖ Eingabe unbrauchbar: ${Array.isArray(termine) ? termine.length : '?'} Termine, Grenze ${grenze}, Läufe ${laeufe}`)
    return 2
  }
  const zaehlung = ausbleibenLauf(termine, jetzt)
  const u = bewerteCpu(messeCpu(() => ausbleibenLauf(termine, jetzt), laeufe), grenze)
  console.log(
    `${u.rot ? '✖' : '✓'} Ausbleiben-Entscheidung: ${termine.length} Termine, ${zaehlung.imFenster} im Fenster (${zaehlung.ausgeblieben} ausgeblieben, ${zaehlung.faellig} fällig, ${zaehlung.nachzusehen} nachzusehen), ` +
      `CPU je Lauf Median ${u.medianMs.toFixed(2)} ms, Höchst ${u.hoechstMs.toFixed(2)} ms, Grenze ${grenze} ms, ${laeufe} Läufe`,
  )
  return u.rot ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main(process.argv.slice(2)))
