import { brichAbBeiWiderspruch } from './bau-widerspruch.ts'
import { log, warn } from './util.ts'
import type { DubCheck } from './dub-confirmed.ts'

/** Handbelege, deren Kennung keinen bekannten Titel trifft; `nichtImBestand` ist die bewusste Ausnahme (geprüfter Titel ohne deutsche Fassung). */
export function findeVerwaiste(checks: DubCheck[], bekannt: ReadonlySet<number>): DubCheck[] {
  const jeKennung = new Map(checks.filter((c) => !bekannt.has(c.anilistId) && !c.nichtImBestand).map((c) => [c.anilistId, c]))
  return [...jeKennung.values()]
}

/**
 * Meldet verwaiste Handbelege und bricht ab. Im Vergleichsmodus (`BAU_VERGLEICH=1`, Ersatz-Cache) nur Warnung:
 * Der Ersatz-Bestand kennt nicht jeden Titel (179950 fehlte im Vergleichsbau, 13.10.2026).
 */
export function pruefeVerwaiste(checks: DubCheck[], bekannt: ReadonlySet<number>): void {
  const verwaist = findeVerwaiste(checks, bekannt)
  if (!verwaist.length) return log('✓ Jede Handpruefung zeigt auf einen Titel im Bestand.')
  warn(`${verwaist.length} Handpruefung(en) zeigen auf keinen Titel im Bestand:`)
  for (const c of verwaist.slice(0, 8)) warn(`   ${c.anilistId} — ${c.title ?? '(ohne Titel)'} (${c.platform})`)
  brichAbBeiWiderspruch([`${verwaist.length} Handpruefung(en) zeigen ins Leere. Entweder ist die Kennung falsch, oder der Titel fehlt im Bestand.`])
}
