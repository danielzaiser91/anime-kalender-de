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

/**
 * Quellen, die seltener laufen als der Nachtlauf — mit ihrer eigenen Frist.
 *
 * Der Anlass: Am 16.08.2026 schlug die Prüfung Alarm, weil `adn-catalog` seit
 * 5,1 Tagen nichts geliefert hatte. Kaputt war nichts. Der ADN-Katalog wird
 * **wöchentlich** geholt, montags um 5:41 — gegen eine Frist von vier Tagen
 * gemessen, meldet er sich also ab jedem Freitag als stumm. Eine Warnung, die
 * jede Woche zuverlässig zu Unrecht kommt, ist schlimmer als keine: Man hört
 * auf hinzusehen.
 *
 * Die Frist ist jeweils die Taktung plus zwei Tage Luft — ein einzelner
 * ausgefallener Lauf soll noch keinen Alarm auslösen, zwei hintereinander schon.
 */
const FRISTEN: Record<string, number> = {
  // Wöchentlich, montags.
  'adn-catalog': 9,
  'anilist-voices': 9,
  'anime-offline-database': 9,
  'ann-voices': 9,
  // Läuft wöchentlich, holt aber nur, was älter als 28 Tage ist — ein Lauf
  // ohne neue Seiten meldet trotzdem seinen Bestand.
  'crunchyroll-dub': 9,
  // Wöchentlich, wie der Lauf, der sie füllt.
  'youtube-check': 9,
  // Wöchentlich, wie der Lauf, der sie füllt.
  'link-check': 9,
}

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
    const frist = FRISTEN[name] ?? MAX_AGE_DAYS
    const label = Number.isFinite(age) ? `${age.toFixed(1)} Tage` : 'noch nie'
    if (age > frist) {
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
