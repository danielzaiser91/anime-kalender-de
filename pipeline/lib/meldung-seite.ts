import { liegenGeblieben, type OhneZuordnung } from './meldungen-liste.ts'

/**
 * Meldungen, deren Seite nicht zum Titel gehört (19.11.2026, Migration 066). Anlass: Meldung 27504 meldete „weg“ für Landei II,
 * weil das Panel noch den Titel der vorigen Seite trug. Die Erweiterung schickt die Adresse der Seite mit (`seitenAdresse`,
 * Spalte `pruefung.seiten_adresse`); hier wird sie gegen die Adressen des Titels gehalten, wie `wegWiderspruchtSich` die
 * Meldung gegen sich selbst. Die Meldung bleibt liegen: nicht angehängt, nicht gelöscht.
 */

/** Der Grund in Warnungen und Liste; der Lauf zählt daran (`zaehleSeiteFremd`). */
const GRUND = 'Seite der Meldung gehört nicht zum Titel'

/**
 * Die Kennung einer Titelseite mit Anbieter davor (`netflix:81000001`); `undefined` bei jeder anderen Adresse (Startseite, Suche,
 * Player) und bei Anbietern ohne feste Kennung. **Prime fehlt mit Absicht:** dort ist eine andere Seite als die der Prüfliste der
 * Regelfall (Suchseite → Titelseite, eine ASIN je Staffel); über die Seite entscheidet `seiten_kennung` (`verschiebeFremdenBeleg`).
 */
export function titelseitenKennung(adresse: string): string | undefined {
  const netflix = /^https?:\/\/(?:www\.)?netflix\.com\/title\/(\d+)/i.exec(adresse)?.[1]
  if (netflix) return `netflix:${netflix}`
  const adn = /^https?:\/\/(?:www\.)?animationdigitalnetwork\.com\/(?:[a-z]{2}\/)?video\/(\d+)/i.exec(adresse)?.[1]
  if (adn) return `adn:${adn}`
  const disney = /^https?:\/\/(?:www\.)?disneyplus\.com\/.*entity-([0-9a-f-]{36})/i.exec(adresse)?.[1]
  return disney ? `disney:${disney.toLowerCase()}` : undefined
}

type Seitenmeldung = { id: number; url: string; plattform: string; befund: string; serientitel: string | null; titel: string | null; seiten_adresse?: string | null }

/**
 * Die Seite, auf der die Meldung entstand, gehört nicht zu den Adressen des Titels: eine Titelseite des Anbieters mit einer
 * Kennung, die weder die der Meldungsadresse noch eine der Adressen des Titels (`streams` aller `ids`) ist. Ohne Angabe, ohne
 * Titelseite oder ohne Adresse derselben Art beim Titel gibt es kein Urteil (Nichtauskunft ist kein Befund). `true`: die Gruppe
 * bleibt liegen (Warnung und Liste, `zuTun`), der Aufrufer überspringt sie.
 */
export function seiteFremd(
  gruppe: readonly Seitenmeldung[],
  ids: readonly number[],
  titel: readonly { id: number; streams?: readonly { url: string }[] }[],
  warnungen: string[],
  liste: OhneZuordnung[],
): boolean {
  const p = gruppe[gruppe.length - 1]!
  const adressen = [p.url, ...titel.filter((t) => ids.includes(t.id)).flatMap((t) => (t.streams ?? []).map((s) => s.url))]
  const bekannt = new Set(adressen.map(titelseitenKennung).filter((k): k is string => k !== undefined))
  const art = (k: string) => k.slice(0, k.indexOf(':'))
  const fremd = gruppe
    .map((m) => (m.seiten_adresse ? titelseitenKennung(m.seiten_adresse) : undefined))
    .find((k): k is string => k !== undefined && !bekannt.has(k) && [...bekannt].some((b) => art(b) === art(k)))
  if (!fremd) return false
  liegenGeblieben(warnungen, liste, p, `${GRUND} (Seite ${fremd.split(':')[1]}, Panel einer anderen Seite?)`, [...ids], 'Meldung prüfen und verwerfen')
  return true
}

/** Wie viele Warnungen des Laufs diese Regel gesetzt hat. */
export const zaehleSeiteFremd = (warnungen: readonly string[]): number => warnungen.filter((w) => w.includes(GRUND)).length
