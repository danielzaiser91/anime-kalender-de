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
  /*
    **Diese beiden laufen nur von Daniels Rechner — und deshalb unregelmäßig.**

    Das anonyme Crunchyroll-Token trägt die Region der abrufenden Leitung; aus
    der Cloud käme der US-Katalog, dessen Schweigen nichts belegt. Die Skripte
    brechen dort ab, und bis zum 02.09.2026 taten sie das jede Woche unbemerkt in
    einer `&&`-Kette, die zwei weitere Läufe mitriss.

    Drei Wochen sind großzügig, und das ist Absicht: Eine Warnung, die zu oft zu
    Unrecht kommt, wird überlesen (CLAUDE.md, 16.08.2026). Kommt sie, ist der
    Griff `npm run data:cr-einzelwerke && npm run data:cr-filmbloecke` — von hier,
    nicht aus der Cloud.
  */
  'cr-einzelwerke': 21,
  'cr-filmbloecke': 21,

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
  // Wöchentlich, 400 Titel je Lauf gegen 60 Tage Wiedervorlage.
  'tmdb-titles': 9,
  // Wöchentlich. Ein Fenster von zwölf Monaten enthält in ruhigen Wochen
  // **null** Anime-Kinostarts — das ist kein Ausfall, sondern die Branche.
  'tmdb-kino': 9,
  /* Wochenlauf plus zwei Tage Luft — ein ausgefallener Lauf ist noch kein Alarm. */
  'tmdb-folgen': 9,
  /* Stündlich, aber nur wenn gemeldet wurde — eine Woche ohne Meldung ist normal. */
  rohfolgen: 30,
  /*
    **Das Kontingent ist der Takt, nicht der Kalender.**

    Die Streaming-Availability-API hat ein Monatskontingent. Ist es
    aufgebraucht, setzt der Lauf keine Anfrage mehr ab — und galt damit als
    stumm. Am 28.08.2026 hat das den täglichen Lauf rot gemacht, obwohl nichts
    kaputt war: HTTP 429, fünf Tage vor Monatsende.

    Dreiunddreißig Tage decken einen vollen Kontingentzyklus plus zwei Tage
    Luft ab. Bleibt sie darüber hinaus stumm, ist es ein echter Ausfall.

    Dieselbe Lehre wie beim ADN-Katalog: Eine Warnung, die zuverlässig zu
    Unrecht kommt, ist schlimmer als keine — man hört auf hinzusehen.
  */
  'motn-changes': 33,
  /* Wöchentlich, 150 Titel je Lauf gegen 90 Tage Wiedervorlage. */
  'anisearch-folgen': 9,
  // Wöchentlich. Eine Freigabe wird erst kurz vor dem Kinostart erteilt —
  // in ruhigen Wochen belegt der Lauf nichts Neues, und das ist kein Ausfall.
  fsk: 9,
  // Wöchentlich. Anime laufen im Kino als Sondervorstellung — in vielen
  // Wochen gibt es keinen einzigen, und das ist kein Ausfall.
  cinestar: 9,
  // Wöchentlich, wie der Lauf, der sie füllt.
  'link-check': 9,
  /**
   * Monatlich — die Taktung kommt hier nicht vom Nutzen, sondern vom
   * Kontingent.
   *
   * Die Streaming Availability API gibt 1.000 Anfragen im **Monat** her, Reset
   * am Monatsersten. `.github/workflows/tonspuren-monatlich.yml` holt am
   * Zweiten jedes Monats bis zu 800 davon in einem Lauf — ein täglicher oder
   * wöchentlicher Takt würde das Kontingent vorzeitig verbrauchen.
   *
   * Gegen die Taktung spricht der gemessene Verzug der Quelle nicht: Sie hinkt
   * ein paar Tage hinterher, und was seit Jahren auf Netflix liegt, liegt auch
   * nächsten Monat noch dort. Genau dieser Bestand ist ihr Zweck.
   *
   * Derselbe Kontingentzyklus wie bei `motn-changes`, deshalb derselbe Wert:
   * ein voller Monat plus zwei Tage Luft. Bis 01.09.2026 stand hier 9 — eine
   * Frist für Wochentakt, die seit Einführung des monatlichen Workflows nicht
   * mehr passte und den Bau-Lauf einen Tag vor dem nächsten planmäßigen Abruf
   * fälschlich rot machte (Lauf 33555019125, Issue #34).
   */
  motn: 33,
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
