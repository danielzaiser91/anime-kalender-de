import type { Release, Title } from '../../shared/types.ts'

/** Folgenzahl und Format eines Titels aus demselben Franchise (Kontext der Regel `folgenzahl-widerspruch`). */
export interface FranchiseTeil { format?: string; episodes?: number }

/** Alle Teile je Franchise-Kennung aus `titles.json`, damit die Regel ohne Titelliste auskommt. */
export function franchiseTeile(titel: Title[]): Map<number, (FranchiseTeil & { id: number })[]> {
  const je = new Map<number, (FranchiseTeil & { id: number })[]>()
  for (const t of titel) {
    const k = t.franchiseId ?? t.id
    const liste = je.get(k) ?? []
    liste.push({ id: t.id, format: t.format, episodes: t.episodes })
    je.set(k, liste)
  }
  return je
}

/** Summen aus höchstens `max` Zahlen der Liste. */
function teilsummen(zahlen: number[], max: number): Set<number> {
  const aus = new Set<number>()
  const geh = (von: number, anzahl: number, summe: number): void => {
    if (anzahl > 0) aus.add(summe)
    if (anzahl === max) return
    for (let i = von; i < zahlen.length; i++) geh(i + 1, anzahl + 1, summe + zahlen[i])
  }
  geh(0, 0, 0)
  return aus
}

/**
 * Zu Recht größer als `episodes` (17.11.2026): Die Anbieterzahl führt die Serie des Anbieters, und die umfasst mehr als diesen AniList-Eintrag —
 * entweder alle Serien-Staffeln des Franchise (Gantz 13 + 13) oder Titel plus ein, zwei Zugaben (OVA/Special; Wolf’s Rain 26 + OVA 4).
 * Filme zählen nicht mit: ein Film ist keine Folge, die Summe träfe zu oft zufällig.
 */
function ausFranchise(t: Title, wert: number, teile: FranchiseTeil[]): boolean {
  const n = t.episodes ?? 0
  const serie = teile.filter((x) => x.format === 'TV' || x.format === 'ONA').reduce((s, x) => s + (x.episodes ?? 0), 0)
  const zugaben = teile.filter((x) => x.format === 'OVA' || x.format === 'SPECIAL').map((x) => x.episodes ?? 0)
  return wert - n === serie || teilsummen(zugaben, 2).has(wert - n)
}

/**
 * Grund, warum jede Zahl über `episodes` zu Recht besteht, sonst `undefined`. `nur-gesichtet`: nur mitgezählte Sendetermine, keine Gesamtzahl
 * (`episodeCountNurGesichtet`, Super Wings, Yashahime). `anbieter-franchise`: siehe `ausFranchise`; gilt auch für die Länge der Folgenliste.
 */
export function folgenzahlAusnahme(t: Title, releases: Release[], listenLaenge: number, teile: FranchiseTeil[]): string | undefined {
  const n = t.episodes ?? 0
  const rel = releases.filter((r) => r.releaseType !== 'disc' && (r.schedule?.episodeCount ?? 0) > n)
  const sichtung = rel.filter((r) => r.schedule?.episodeCountNurGesichtet)
  const werte = [...rel.filter((r) => !r.schedule?.episodeCountNurGesichtet).map((r) => r.schedule!.episodeCount!), ...(listenLaenge > n ? [listenLaenge] : [])]
  if (werte.length === 0) return sichtung.length ? 'nur-gesichtet' : undefined
  return werte.every((w) => ausFranchise(t, w, teile)) ? 'anbieter-franchise' : undefined
}
