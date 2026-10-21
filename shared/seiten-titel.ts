/**
 * Der Seitentitel eines Titels („X auf Deutsch: Synchro, Streaming und Termine“): eine Quelle für die vorgerenderte Teilseite
 * (`pipeline/lib/titel-seite.ts`) und den Tab-Titel der App (`web/src/components/detail/titelwechsel.ts`).
 */
import type { Title } from './types.ts'
import { synchroBelegt } from './titles.ts'

function aufzaehlung(teile: string[]): string {
  return teile.length < 2 ? (teile[0] ?? '') : `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`
}

/** Der `<title>` einer Titelseite: „auf Deutsch“ nur bei belegter Synchro, Streaming und Termine nur, wo es sie gibt. */
export function seitenTitel(name: string, t: Title | undefined, mitTermin: boolean): string {
  const streaming = (t?.streams ?? []).some((s) => s.dub === true)
  const termine = mitTermin ? ['Termine'] : []
  if (!t || (!t.westlich && !synchroBelegt(t))) return `${name}: Stand der deutschen Synchro${mitTermin ? ' und Termine' : ''}`
  if (t.westlich) return synchroBelegt(t) ? `${name} auf Deutsch: ${aufzaehlung(['Streaming', ...termine])}` : `${name}: Animationsserie und wo sie läuft`
  return `${name} auf Deutsch: ${aufzaehlung(['Synchro', ...(streaming ? ['Streaming'] : []), ...termine])}`
}
