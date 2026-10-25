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
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { log, warn, writeJson } from './lib/util.ts'
import { meldeAnClaude } from './lib/meldung.ts'
import { FRISTEN } from '../tools/quellen-fristen.mjs'

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

  /* Wochenwache (`delta-wache.yml`): stumme Quellen als Meldung an Claude, ohne `blocker.json` zu überschreiben (die Datei gehört dem Bau). */
  if (args.includes('--nur-melden')) {
    if (stale.length) {
      meldeAnClaude('wache-woechentlich', 'warnung', `Stumme Quellen (Frist überschritten): ${stale.map((n) => `${n} ${Number.isFinite(daysSince(health[n]?.lastOk)) ? `seit ${daysSince(health[n]?.lastOk).toFixed(0)} Tagen` : 'noch nie'}`).join(', ')}`, 'data/source-health.json')
    }
    return
  }

  /*
    **Eine stumme Quelle warnt, sie blockiert nicht**.

    Vorher endete dieser Schritt mit Fehler, und damit war der ganze Bestandslauf rot — der
    Datensatz war da, committet und geprüft, nur ausgeliefert wurde er nicht. Vier Tage lang
    hat eine Sperre bei aniSearch so die Arbeit von zwanzig anderen Quellen aufgehalten.

    Gemeldet wird trotzdem, und zwar sichtbar: `public/data/blocker.json` wird mit der Seite
    ausgeliefert, und die Statusanzeige zeigt daraus einen eigenen Bereich. Daniel: „solche
    kritischen blocker sind unbedingt dort anzuzeigen."
  */
  schreibeBlocker(
    stale.map((name) => ({
      art: 'quelle-stumm' as const,
      titel: `${name} liefert nichts mehr`,
      text:
        `Seit ${daysSince(health[name]?.lastOk).toFixed(1)} Tagen ohne Ergebnis` +
        (health[name]?.lastError ? ` — ${health[name]!.lastError}` : '') +
        '. Der Bestand wird weiter gebaut; diese Quelle fehlt darin.',
      seit: health[name]?.lastOk,
      quelle: name,
    })),
  )

  if (stale.length) {
    console.error(
      `\nStumme Quellen: ${stale.join(', ')}. ` +
        'Sie stehen als Blocker in der Statusanzeige; der Lauf geht weiter.',
    )
  }
}

/** Ein Eintrag im Blocker-Bereich der Statusanzeige. */
interface Blocker {
  art: 'quelle-stumm' | 'hand'
  titel: string
  text: string
  seit?: string
  quelle?: string
}

/**
 * **Was das Projekt gerade aufhält — an einer Stelle, die immer sichtbar ist.**
 *
 * Die Datei wird mit der Seite ausgeliefert und von der Statusanzeige gelesen. Handeinträge
 * aus `data/blocker-von-hand.yaml` kommen dazu: Dinge, die kein Lauf bemerken kann (eine
 * Sperre, eine offene Anfrage, ein wartender Zugang).
 *
 * Sie wird bei **jedem** Lauf neu geschrieben, auch wenn nichts anliegt — sonst bliebe ein
 * behobener Blocker für immer stehen (dieselbe Falle wie bei `suchadressen-offen.json`,
 * 14.09.2026).
 */
function schreibeBlocker(ausQuellen: Blocker[]): void {
  let vonHand: Blocker[] = []
  try {
    const roh = yaml.load(readFileSync('data/blocker-von-hand.yaml', 'utf8')) as
      | { titel: string; text: string; seit?: string }[]
      | null
    vonHand = (roh ?? []).map((e) => ({ art: 'hand' as const, titel: e.titel, text: e.text, seit: e.seit }))
  } catch {
    /* Ohne Datei gibt es keine Handeinträge — das ist der Normalfall. */
  }
  const alle = [...vonHand, ...ausQuellen]
  writeJson('public/data/blocker.json', { erzeugtAm: new Date().toISOString(), eintraege: alle })
  log(alle.length ? `${alle.length} Blocker in public/data/blocker.json` : 'keine Blocker')
}

main()
