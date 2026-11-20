/**
 * Deutsche Staffelgrenzen innerhalb von AniList-Sammeltiteln: `data/curated/pokemon-staffeln.yaml` (Hauptserie, Staffel 1–25, Quelle TMDB 60572)
 * und `data/curated/horizonte-staffeln.yaml` (eigene Zählung von Pokémon Horizonte, Staffel 1 ff.).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { Release } from '../../shared/types.ts'
import { ROOT } from './util.ts'

/** `offen`: die laufende letzte Staffel, deren Ende keine Quelle nennt — ohne `bis` und `folgen`. */
export type StaffelAbschnitt = { nr: number; von: number; bis?: number; folgen?: number; offen?: true }
export type StaffelGrenzen = { anilistId: number; titel?: string; staffeln: StaffelAbschnitt[] }

export const POKEMON_STAFFELN = resolve(ROOT, 'data/curated/pokemon-staffeln.yaml')
export const HORIZONTE_STAFFELN = resolve(ROOT, 'data/curated/horizonte-staffeln.yaml')

/** Ohne Argument beide Dateien. Fehlt eine Datei (Kulissen anderer Prüfungen), trägt sie nichts bei; eine kaputte Datei wirft. */
export function ladeStaffelGrenzen(...dateien: string[]): StaffelGrenzen[] {
  return (dateien.length ? dateien : [POKEMON_STAFFELN, HORIZONTE_STAFFELN]).flatMap((datei) =>
    existsSync(datei) ? ((yaml.load(readFileSync(datei, 'utf8')) as { titel?: StaffelGrenzen[] } | null)?.titel ?? []).filter((t) => t.staffeln?.length) : [],
  )
}

/** Kennung → Staffel, in der der Titel beginnt (zählt die Reihe wie eine belegte Staffelnummer). */
export function startStaffeln(grenzen: StaffelGrenzen[]): Map<number, number> {
  return new Map(grenzen.map((t) => [t.anilistId, t.staffeln[0]!.nr]))
}

/** Kennung → letzte Staffel, nur für Titel, die mehr als eine abdecken (Pokémon 527: 5). */
export function staffelEnden(grenzen: StaffelGrenzen[]): Map<number, number> {
  const mehrere = grenzen.filter((t) => t.staffeln[t.staffeln.length - 1]!.nr > t.staffeln[0]!.nr)
  return new Map(mehrere.map((t): [number, number] => [t.anilistId, t.staffeln[t.staffeln.length - 1]!.nr]))
}

/** Eine Zeile der Detaildatei: `[Staffel, von, bis]`, die offene letzte Staffel nur `[Staffel, von]`. */
export type StaffelZeile = [number, number] | [number, number, number]

/** Kennung → `[[Staffel, von, bis], …]` für die Detaildatei des Titels. */
export function staffelListen(grenzen: StaffelGrenzen[]): Map<number, StaffelZeile[]> {
  return new Map(grenzen.map((t) => [t.anilistId, t.staffeln.map((s): StaffelZeile => (s.bis === undefined ? [s.nr, s.von] : [s.nr, s.von, s.bis]))]))
}

/** Das Feld `s` der Detaildatei eines Titels (leer, wenn die Datei ihn nicht führt). */
export function staffelFeld(listen: Map<number, StaffelZeile[]>, id: number): { s?: StaffelZeile[] } {
  return listen.has(id) ? { s: listen.get(id) } : {}
}

/**
 * Was an der Datei nicht stimmt (leer = in Ordnung): lückenlos von Folge 1 bis zur Folgenzahl, Staffeln nur aufwärts, `folgen` = bis − von + 1;
 * nur die letzte Staffel darf `offen` sein (dann ohne `bis`/`folgen`, und die Folgenzahl des Titels wird nicht gehalten).
 */
export function fehlerInGrenzen(t: StaffelGrenzen, folgenzahl: number | undefined): string[] {
  const fehler: string[] = []
  let erwartet = 1
  let vorige = 0
  t.staffeln.forEach((s, i) => {
    if (s.von !== erwartet) fehler.push(`Staffel ${s.nr}: beginnt bei ${s.von}, erwartet ${erwartet}`)
    if (s.nr <= vorige) fehler.push(`Staffel ${s.nr}: nicht größer als die davor`)
    vorige = s.nr
    if (s.offen) {
      if (i !== t.staffeln.length - 1) fehler.push(`Staffel ${s.nr}: offen, aber nicht die letzte`)
      if (s.bis !== undefined || s.folgen !== undefined) fehler.push(`Staffel ${s.nr}: offen mit bis/folgen`)
      return
    }
    const soll = (s.bis ?? NaN) - s.von + 1 // ohne bis NaN: jede Folgenzahl weicht ab
    if (s.folgen !== soll) fehler.push(`Staffel ${s.nr}: folgen ${s.folgen} ≠ ${soll}`)
    erwartet = (s.bis ?? 0) + 1
  })
  const offen = t.staffeln[t.staffeln.length - 1]?.offen
  if (!offen && folgenzahl !== undefined && erwartet - 1 !== folgenzahl) fehler.push(`endet bei ${erwartet - 1}, der Titel hat ${folgenzahl} Folgen`)
  return fehler
}

/** Folgen je Staffel (Index = Staffel − 1) aus einer Liste mit „Folge in der Staffel“ (de.wikipedia `st`): bei `st` 1 beginnt die nächste. */
export function folgenJeStaffelAusSt(folgen: { st?: number }[]): number[] {
  const je: number[] = []
  for (const f of folgen) {
    if (f.st === 1 || !je.length) je.push(0)
    je[je.length - 1]!++
  }
  return je
}

/** Höchste Folge je Staffel (Index = Staffel − 1) einer Anbieterliste (TOGGO `staffel`/`folge`); Staffeln ohne Folge bleiben leer. */
export function hoechsteJeStaffel(folgen: { staffel: number; folge: number }[]): (number | undefined)[] {
  const je: (number | undefined)[] = []
  for (const f of folgen) je[f.staffel - 1] = Math.max(je[f.staffel - 1] ?? 0, f.folge)
  return je
}

/**
 * Grenzen gegen eine Quelle mit eigener Staffelzählung: `fehler` = eine abgeschlossene Staffel hat dort eine andere Folgenzahl;
 * `hinweise` = die Quelle führt eine Staffel hinter der letzten (die offene ist dann abgeschlossen). Fehlt eine Staffel in der Quelle
 * (Anbieter nimmt alte Folgen heraus), ist das kein Befund.
 */
export function abweichungenZurQuelle(t: StaffelGrenzen, jeStaffel: (number | undefined)[], quelle: string): { fehler: string[]; hinweise: string[] } {
  const fehler: string[] = []
  for (const s of t.staffeln) {
    const dort = jeStaffel[s.nr - 1]
    if (!s.offen && dort !== undefined && dort !== s.folgen) fehler.push(`Staffel ${s.nr}: ${s.folgen} Folgen, ${quelle} ${dort}`)
  }
  const letzte = t.staffeln[t.staffeln.length - 1]!.nr
  const hinweise = jeStaffel.length > letzte ? [`${quelle} führt Staffel ${jeStaffel.length}, die Datei endet bei Staffel ${letzte}: Grenze nachtragen`] : []
  return { fehler, hinweise }
}

/** Kennung → letzte belegte Folge der Staffeln (Ende der letzten, bei offener letzter Staffel ihre erste Folge). */
export function letzteFolgen(grenzen: StaffelGrenzen[]): Map<number, number> {
  return new Map(grenzen.map((t) => [t.anilistId, t.staffeln[t.staffeln.length - 1]!.bis ?? t.staffeln[t.staffeln.length - 1]!.von]))
}

/**
 * `[alle, deutsche]` für `folgen/zaehlung.json`. Reichen die Staffelgrenzen weiter als die Folgenliste (Horizonte: aniSearch führt 122,
 * die deutschen Staffeln 1–3 haben 136), zählt der Kopf bis zur letzten belegten Folge statt „122 von 122“ — nie unter der höchsten
 * deutschen Folge, denn eine offene Staffel wächst über ihre erste Folge hinaus.
 */
export function zaehleFolgen(nummern: number[], de: [number, number][], letzte?: number): [number, number] {
  const imDeutschen = (n: number) => de.some(([von, bis]) => n >= von && n <= bis)
  const ende = letzte ? Math.max(letzte, ...de.map(([, bis]) => bis)) : 0
  if (ende <= nummern.length) return [nummern.length, nummern.filter(imDeutschen).length]
  return [ende, Array.from({ length: ende }, (_, i) => i + 1).filter(imDeutschen).length]
}

/**
 * Deutsche Bereiche plus die Folgen erschienener Stapel-Termine mit Folgennummer (Horizonte: Staffel 4 Folge 137 seit 20.11.2026 bei RTL+,
 * der Weg trägt nur 1–136). Termine mit `sprache` (nur OmU/offen) und geschätzter Folgenzahl zählen nicht.
 */
export function mitStapelFolgen(de: [number, number][], termine: Release[], heute: string): [number, number][] {
  const nummern = new Set<number>()
  for (const [von, bis] of de) for (let n = von; n <= bis; n++) nummern.add(n)
  for (const r of termine) {
    const { firstEpisodeNumber: von, episodeCount: anzahl, episodeCountAssumed, firstEpisodeDate } = r.schedule
    if (r.releaseType !== 'batch' || r.sprache || !von || !anzahl || episodeCountAssumed || !firstEpisodeDate || firstEpisodeDate > heute) continue
    for (let n = von; n < von + anzahl; n++) nummern.add(n)
  }
  const bereiche: [number, number][] = []
  for (const n of [...nummern].sort((a, b) => a - b)) {
    const letzter = bereiche[bereiche.length - 1]
    if (letzter && letzter[1] === n - 1) letzter[1] = n
    else bereiche.push([n, n])
  }
  return bereiche
}
