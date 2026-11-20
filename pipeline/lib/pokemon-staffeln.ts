/**
 * Deutsche Staffelgrenzen innerhalb von AniList-Sammeltiteln: `data/curated/pokemon-staffeln.yaml` (Hauptserie, Staffel 1–25, Quelle TMDB 60572)
 * und `data/curated/horizonte-staffeln.yaml` (eigene Zählung von Pokémon Horizonte, Staffel 1 ff.).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
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
    if (s.bis === undefined || s.folgen !== s.bis - s.von + 1) fehler.push(`Staffel ${s.nr}: folgen ${s.folgen} ≠ ${(s.bis ?? NaN) - s.von + 1}`)
    erwartet = (s.bis ?? 0) + 1
  })
  const offen = t.staffeln[t.staffeln.length - 1]?.offen
  if (!offen && folgenzahl !== undefined && erwartet - 1 !== folgenzahl) fehler.push(`endet bei ${erwartet - 1}, der Titel hat ${folgenzahl} Folgen`)
  return fehler
}
