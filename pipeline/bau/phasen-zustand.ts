/**
 * Haltepunkt im Bau: zeigt, welche Felder ein Titel nach einer Phase hat (Fixtures für Wächter
 * stammen aus dem echten Phasenzustand, nicht aus dem fertigen `titles.json`).
 *
 *   AK_PHASE_ZUSTAND=09-4-crunchyroll-dub AK_PHASE_TITEL=152677 npx tsx pipeline/build.ts
 *
 * Gibt eine Zeile `AK_PHASE_ZUSTAND {"152677": {…}}` auf stdout aus und beendet den Bau mit 0, bevor
 * `public/data/` geschrieben wird. Ohne `AK_PHASE_ZUSTAND` tut `haltePunkt` nichts. Frühe Phasen
 * schreiben trotzdem Prüflisten unter `data/` (schon 02-titel): der Halt weist auf das Zurücksetzen hin.
 */
import type { Title } from '../../shared/types.ts'

/** Alle Haltepunkte in Bau-Reihenfolge; `check-phasen-zustand.ts` hält sie gegen die Aufrufe in `build.ts` und `09-synchro.ts`. */
export const PHASEN = [
  '02-titel',
  '08-news-tv',
  '09-3-prime',
  '09-4-crunchyroll-dub',
  '09-5-weitere-quellen',
  '09-6-anisearch-wege',
  '09-synchro',
  '10-komplettabwurf',
  '11-wege-abschluss',
] as const

const AUFRAEUMEN = 'git restore data public/data && git clean -fdq public/data'

/** Die Titelkennungen aus `AK_PHASE_TITEL` (kommagetrennt); leer = alle. */
export function titelKennungen(roh: string | undefined): number[] {
  return (roh ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number)
}

/** Fehlertext, wenn der Schalter nicht stimmt (unbekannte Phase, nicht numerische Titelkennung), sonst null. */
export function schalterFehler(env: NodeJS.ProcessEnv): string | null {
  const phase = env.AK_PHASE_ZUSTAND
  if (!phase) return null
  if (!(PHASEN as readonly string[]).includes(phase)) return `AK_PHASE_ZUSTAND=${phase}: unbekannte Phase. Gültig: ${PHASEN.join(', ')}`
  if (titelKennungen(env.AK_PHASE_TITEL).some((n) => !Number.isInteger(n))) return `AK_PHASE_TITEL=${env.AK_PHASE_TITEL}: nur Zahlen, kommagetrennt`
  return null
}

/** Beendet den Prozess mit Exit 1, bevor der Bau beginnt, wenn der Schalter falsch ist. */
export function pruefeSchalter(env: NodeJS.ProcessEnv = process.env): void {
  const fehler = schalterFehler(env)
  if (!fehler) return
  console.error(fehler)
  process.exit(1)
}

export function zustandVon(titles: Map<number, Title>, kennungen: number[]): Record<string, Title | null> {
  const ids = kennungen.length ? kennungen : [...titles.keys()]
  return Object.fromEntries(ids.map((id) => [id, titles.get(id) ?? null]))
}

export function haltePunkt(phase: string, titles: Map<number, Title>, env: NodeJS.ProcessEnv = process.env): void {
  if (env.AK_PHASE_ZUSTAND !== phase) return
  console.log(`AK_PHASE_ZUSTAND ${JSON.stringify(zustandVon(titles, titelKennungen(env.AK_PHASE_TITEL)))}`)
  console.error(`Hinweis: der Bau hat bis hierher Prüflisten unter data/ geschrieben. Aufräumen: ${AUFRAEUMEN}`)
  process.exit(0)
}
