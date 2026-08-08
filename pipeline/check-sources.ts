/**
 * Prüft, ob jede Quelle noch etwas liefert — und bricht ab, wenn nicht.
 *
 * Das ist der Wachhund für den lautlosesten Fehler dieses Projekts: Ein
 * Scraper läuft weiter durch, findet aber nichts mehr, weil die Gegenseite
 * ihre Seite umgebaut hat. Ohne diese Prüfung bleibt der alte Datenbestand
 * einfach stehen und sieht dabei völlig gesund aus.
 *
 * Ein Abbruch hier lässt den Workflow rot werden, und GitHub schickt dem
 * Betreiber eine Mail. Genau das ist die gewünschte Meldung — dafür braucht es
 * keine eigene Infrastruktur.
 *
 * Aufruf: npx tsx pipeline/check-sources.ts [--max-age 4]
 */
import { readSourceHealth } from './lib/health.ts'
import { log, warn } from './lib/util.ts'

const args = process.argv.slice(2)
const index = args.indexOf('--max-age')
/** Wie viele Tage eine Quelle schweigen darf, bevor es ein Problem ist. */
const MAX_AGE_DAYS = index >= 0 ? Number(args[index + 1]) : 4

function daysSince(iso: string | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}

function main(): void {
  const health = readSourceHealth()
  const names = Object.keys(health).sort()

  if (!names.length) {
    warn('Noch keine Quellen erfasst — nichts zu prüfen.')
    return
  }

  const stale: string[] = []
  for (const name of names) {
    const state = health[name]
    const age = daysSince(state.lastOk)
    const label = Number.isFinite(age) ? `${age.toFixed(1)} Tage` : 'noch nie'
    if (age > MAX_AGE_DAYS) {
      stale.push(name)
      warn(`${name}: seit ${label} nichts geliefert (zuletzt ${state.lastCount} Treffer)${
        state.lastError ? ` — ${state.lastError}` : ''
      }`)
    } else {
      log(`${name}: ok, vor ${label}, ${state.lastCount} Treffer`)
    }
  }

  if (stale.length) {
    console.error(
      `\nStumme Quellen: ${stale.join(', ')}. ` +
        'Vermutlich hat sich dort der Seitenaufbau geändert — Selektoren prüfen.',
    )
    process.exit(1)
  }
}

main()
