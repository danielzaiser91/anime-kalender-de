/** Deutsche Staffelgrenzen innerhalb von AniList-Sammeltiteln (`data/curated/pokemon-staffeln.yaml`, Quelle TMDB 60572). */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'

export type StaffelAbschnitt = { nr: number; von: number; bis: number; folgen: number }
/** `teil`: Nummer des Titels innerhalb seiner Staffel, wo mehrere AniList-Einträge dieselbe Staffel tragen (Staffel 16). */
export type StaffelGrenzen = { anilistId: number; titel?: string; teil?: number; staffeln: StaffelAbschnitt[] }

/** Fehlt die Datei (Kulissen anderer Prüfungen), ist die Liste leer; eine kaputte Datei wirft. */
export function ladeStaffelGrenzen(datei = resolve(ROOT, 'data/curated/pokemon-staffeln.yaml')): StaffelGrenzen[] {
  if (!existsSync(datei)) return []
  return ((yaml.load(readFileSync(datei, 'utf8')) as { titel?: StaffelGrenzen[] } | null)?.titel ?? []).filter((t) => t.staffeln?.length)
}

/** Kennung → Staffel, in der der Titel beginnt (zählt die Reihe wie eine belegte Staffelnummer). */
export function startStaffeln(grenzen: StaffelGrenzen[]): Map<number, number> {
  return new Map(grenzen.map((t) => [t.anilistId, t.staffeln[0]!.nr]))
}

/** Kennung → Teil innerhalb der Staffel (nur Titel mit `teil` in der Datei). */
export function startTeile(grenzen: StaffelGrenzen[]): Map<number, number> {
  return new Map(grenzen.filter((t) => t.teil).map((t) => [t.anilistId, t.teil!]))
}

/** Setzt `staffelTeil` an den Reiheneinträgen, deren Titel die Datei als Teil einer Staffel führt; alles andere bleibt unverändert. */
export function markiereStaffelTeile<T extends { id: number; staffelTeil?: number }>(reihen: Record<number, T[]>, grenzen = ladeStaffelGrenzen()): Record<number, T[]> {
  const teile = startTeile(grenzen)
  for (const reihe of Object.values(reihen)) for (const m of reihe) if (teile.has(m.id)) m.staffelTeil = teile.get(m.id)
  return reihen
}

/** Kennung → `[[Staffel, von, bis], …]` für die Detaildatei des Titels. */
export function staffelListen(grenzen: StaffelGrenzen[]): Map<number, [number, number, number][]> {
  return new Map(grenzen.map((t) => [t.anilistId, t.staffeln.map((s): [number, number, number] => [s.nr, s.von, s.bis])]))
}

/** Was an der Datei nicht stimmt (leer = in Ordnung): lückenlos von Folge 1 bis zur Folgenzahl, Staffeln nur aufwärts, `folgen` = bis − von + 1. */
export function fehlerInGrenzen(t: StaffelGrenzen, folgenzahl: number | undefined): string[] {
  const fehler: string[] = []
  let erwartet = 1
  let vorige = 0
  for (const s of t.staffeln) {
    if (s.von !== erwartet) fehler.push(`Staffel ${s.nr}: beginnt bei ${s.von}, erwartet ${erwartet}`)
    if (s.nr <= vorige) fehler.push(`Staffel ${s.nr}: nicht größer als die davor`)
    if (s.folgen !== s.bis - s.von + 1) fehler.push(`Staffel ${s.nr}: folgen ${s.folgen} ≠ ${s.bis - s.von + 1}`)
    erwartet = s.bis + 1
    vorige = s.nr
  }
  if (folgenzahl !== undefined && erwartet - 1 !== folgenzahl) fehler.push(`endet bei ${erwartet - 1}, der Titel hat ${folgenzahl} Folgen`)
  return fehler
}
