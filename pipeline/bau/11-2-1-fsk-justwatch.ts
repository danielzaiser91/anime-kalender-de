import { log, readJson } from '../lib/util.ts'
import type { Fsk, Title } from '../../shared/types.ts'

const FSK_STUFEN: readonly number[] = [0, 6, 12, 16, 18]

/**
 * JustWatchs Altersangabe → FSK-Stufe. Erkannt werden nur „12", „12+" und „FSK 12"; alles andere
 * (leer, „PG-13", „ab 12 Jahren", 14 …) ist `undefined` — lieber keine Angabe als eine umgedeutete.
 */
export function stufeAusJustwatch(roh: string | null | undefined): Fsk | undefined {
  const m = /^(?:fsk\s*)?(\d{1,2})\s*\+?$/i.exec((roh ?? '').trim())
  const n = m ? Number(m[1]) : NaN
  return FSK_STUFEN.includes(n) ? (n as Fsk) : undefined
}

/**
 * Zusicherung: `fskQuelle: 'justwatch'` steht nur bei einem Wert in {0,6,12,16,18}, und nie bei einem Titel,
 * für den TMDB eine Freigabe liefert (`tmdbFsk`) — die Anbieter-Angabe ist nur Rückfall.
 */
export function fskQuelleFehler(titles: Iterable<Title>, tmdbFsk: (id: number) => Fsk | undefined): string[] {
  const fehler: string[] = []
  for (const t of titles) {
    if (t.fskQuelle === undefined) continue
    if (t.fsk === undefined || !FSK_STUFEN.includes(t.fsk)) fehler.push(`Anime ${t.id}: fskQuelle ${t.fskQuelle} ohne gültige FSK-Stufe (${t.fsk})`)
    if (tmdbFsk(t.id) !== undefined) fehler.push(`Anime ${t.id}: fskQuelle ${t.fskQuelle}, obwohl TMDB eine Freigabe liefert`)
  }
  return fehler
}

/**
 * **Titel ohne FSK-Freigabe bekommen JustWatchs Altersangabe — als Anbieter-Einstufung gekennzeichnet.**
 *
 * JustWatch ist keine Freigabestelle: Bei 3 von 10 Doppelten wich der Wert von der FSK ab (Recherche
 * 08.10.2026). Deshalb nur als Rückfall, mit `fskQuelle: 'justwatch'`; ein vorhandener Wert (TMDB, ADN,
 * Hand) bleibt und eine Abweichung wird gezählt. Zugeordnet wird über die TMDB-Kennung im Befund,
 * mehrdeutige Zuordnungen fallen weg wie bei den Wegen. Läuft nach dem Bau der Termine und Releases,
 * damit diese weiter nur Freigaben tragen.
 */
export function uebernehmeFskAusJustwatch({ titles, tmdbMehrdeutig }: {
  titles: Map<number, Title>
  tmdbMehrdeutig: Set<string>
}): void {
  const jw = readJson<Record<string, { ohneTreffer?: boolean; altersangabe?: string | null }>>('data/justwatch-audio.json', {})
  let gesetzt = 0
  let abweichend = 0
  let verworfen = 0
  for (const title of titles.values()) {
    const roh = jw[String(title.id)]
    if (!roh || roh.ohneTreffer || !roh.altersangabe?.trim()) continue
    if (tmdbMehrdeutig.has(String(title.id))) continue
    const stufe = stufeAusJustwatch(roh.altersangabe)
    if (stufe === undefined) {
      verworfen++
      continue
    }
    if (title.fsk === undefined) {
      title.fsk = stufe
      title.fskQuelle = 'justwatch'
      gesetzt++
    } else if (title.fsk !== stufe) abweichend++
  }
  const tmdb = readJson<Record<string, { fsk?: Fsk }>>('data/tmdb-titles.json', {})
  const fehler = fskQuelleFehler(titles.values(), (id) => tmdb[String(id)]?.fsk)
  if (fehler.length) throw new Error(`FSK aus JustWatch widerspricht der Zusicherung:\n${fehler.slice(0, 10).join('\n')}`)
  log(
    `FSK aus JustWatch: ${gesetzt} Titel ohne Freigabe ergänzt (Anbieter-Angabe), ` +
      `${abweichend} weichen von der Freigabe ab (Freigabe bleibt), ${verworfen} Angaben nicht in 0/6/12/16/18 abbildbar (verworfen)`,
  )
}
