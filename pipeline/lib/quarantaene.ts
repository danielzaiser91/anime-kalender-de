/**
 * Titel-Quarantäne (18.10.2026, Gate in `tools/quarantaene.mjs`): Prüfungen melden betroffene Titel, der Bau stellt sie zurück,
 * und Prüfungen, die „Titel nicht im Bestand“ melden, kennen die zurückgestellten aus `meta.json`.
 */
import { readFileSync } from 'node:fs'
import { markenZeile, type QuarantaeneEintrag } from '../../tools/quarantaene.mjs'
import type { DataMeta } from '../../shared/types.ts'
import { readJson } from './util.ts'
import type { TerminGedaechtnis } from './news-verlauf.ts'

/** Eine Zeilen-Prüfung meldet einen Titel, an dem sie rot ist; `tools/commit-data.sh` stellt ihn dann zurück (höchstens drei). */
export function melde(titleId: number, pruefung: string, grund: string): void {
  console.log(markenZeile(titleId, pruefung, grund))
}

/** Die Titel, an denen `verletzt` zutrifft, je mit Marke gemeldet; die Prüfung nennt sie in ihrem Fehler. */
export function meldeVerletzte<T extends { id: number }>(liste: T[], pruefung: string, grund: string, verletzt: (t: T) => boolean): T[] {
  const treffer = liste.filter(verletzt)
  for (const t of treffer) melde(t.id, pruefung, grund)
  return treffer
}

/** Was der Bau zurückstellen soll: JSON-Liste in der Datei aus `BAU_QUARANTAENE` (setzt nur `tools/commit-data.sh`); ohne Variable nichts. */
export function ladeQuarantaene(pfad = process.env.BAU_QUARANTAENE): QuarantaeneEintrag[] {
  return pfad ? (JSON.parse(readFileSync(pfad, 'utf8')) as QuarantaeneEintrag[]) : []
}

/** Ohne die Einträge zurückgestellter Titel — für Bau-Schritte, die Titel außerhalb des Hauptbestands führen (`ohne-synchro.json`). */
export function ohneZurueckgestellte<T extends { id: number }>(liste: T[], zurueck = ladeQuarantaene()): T[] {
  const ids = new Set(zurueck.map((e) => e.titleId))
  return liste.filter((e) => !ids.has(e.id))
}

/** Die zurückgestellten Titel des ausgelieferten Bestands (`meta.quarantaene`): Kennungen und Release-Kennungen. */
export function zurueckgestellt(meta = readJson<Partial<DataMeta>>('public/data/meta.json', {})): { ids: Set<number>; releases: Set<string> } {
  const liste = meta.quarantaene ?? []
  return { ids: new Set(liste.map((e) => e.titleId)), releases: new Set(liste.flatMap((e) => e.releases)) }
}

/** Die bekannten Kennungen samt den zurückgestellten, für Prüfungen „Kennung ohne Titel“: zurückgestellt ist nicht verloren. */
export function mitZurueckgestellten(ids: Set<number>, meta?: Partial<DataMeta>): Set<number> {
  for (const id of zurueckgestellt(meta).ids) ids.add(id)
  return ids
}

/**
 * Nimmt den Termin-Verlauf zurückgestellter Titel aus dem News-Gedächtnis, bevor der Bau es fortschreibt: Ihre Releases fehlen, und
 * ohne das gälten ihre Termine als zurückgezogen (Meldung „Der Termin wurde zurückgezogen.“) und kämen beim nächsten sauberen Bau
 * als abgelöst wieder. Das Gedächtnis ist nach Release geordnet; `releases` sind die zurückgestellten (`zurueckgestellt(meta).releases`).
 * `setzeVerlaufEin` legt den Verlauf danach unverändert zurück.
 */
export function nimmVerlaufHeraus(historie: TerminGedaechtnis, releases: ReadonlySet<string>): TerminGedaechtnis {
  const heraus: TerminGedaechtnis = { termine: {}, vergangen: {} }
  for (const art of ['termine', 'vergangen'] as const) {
    const gedaechtnis = historie[art] ?? {}
    for (const release of Object.keys(gedaechtnis)) {
      if (!releases.has(release)) continue
      heraus[art]![release] = gedaechtnis[release]!
      delete gedaechtnis[release]
    }
  }
  return heraus
}

/** Legt den mit `nimmVerlaufHeraus` gehaltenen Verlauf zurück; unter diesen Releases schreibt der Bau nichts, sie fehlen ihm. */
export function setzeVerlaufEin(historie: TerminGedaechtnis, heraus: TerminGedaechtnis): void {
  for (const art of ['termine', 'vergangen'] as const) {
    for (const [release, kette] of Object.entries(heraus[art] ?? {})) (historie[art] ??= {})[release] = kette
  }
}
