/**
 * Haltepunkt im Bau: zeigt, welche Felder ein Titel nach einer Phase hat (Fixtures für Wächter
 * stammen aus dem echten Phasenzustand, nicht aus dem fertigen `titles.json`).
 *
 *   AK_PHASE_ZUSTAND=09-4-crunchyroll-dub AK_PHASE_TITEL=152677 npx tsx pipeline/build.ts
 *
 * Gibt eine Zeile `AK_PHASE_ZUSTAND {"152677": {…}}` auf stdout aus und beendet den Bau mit 0, bevor
 * `public/data/` geschrieben wird. Ohne `AK_PHASE_ZUSTAND` tut `haltePunkt` nichts. Ein Name, den kein
 * Haltepunkt trägt, endet mit Exit 1 (sonst liefe der ganze Bau still durch). Namen: `grep -rn "haltePunkt(" pipeline`.
 */
import type { Title } from '../../shared/types.ts'

let getroffen = false
let wache = false

/** Die Titelkennungen aus `AK_PHASE_TITEL` (kommagetrennt); leer = alle. */
export function titelKennungen(roh: string | undefined): number[] {
  return (roh ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number)
}

export function zustandVon(titles: Map<number, Title>, kennungen: number[]): Record<string, Title | null> {
  const ids = kennungen.length ? kennungen : [...titles.keys()]
  return Object.fromEntries(ids.map((id) => [id, titles.get(id) ?? null]))
}

function meldeVerfehlt(name: string): void {
  if (getroffen) return
  console.error(`AK_PHASE_ZUSTAND=${name}: kein Haltepunkt dieses Namens (grep -rn "haltePunkt(" pipeline)`)
  process.exitCode = 1
}

export function haltePunkt(phase: string, titles: Map<number, Title>, env: NodeJS.ProcessEnv = process.env): void {
  const gewollt = env.AK_PHASE_ZUSTAND
  if (!gewollt) return
  if (!wache) {
    wache = true
    process.on('exit', () => meldeVerfehlt(gewollt))
  }
  if (gewollt !== phase) return
  getroffen = true
  console.log(`AK_PHASE_ZUSTAND ${JSON.stringify(zustandVon(titles, titelKennungen(env.AK_PHASE_TITEL)))}`)
  process.exit(0)
}
