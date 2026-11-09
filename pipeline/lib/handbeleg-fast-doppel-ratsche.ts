import type { FastDoppelBilanz } from './handbeleg-fast-doppel.ts'

/**
 * Ratsche für blockierte Fast-Doppel-Gruppen in `data/dub-confirmed.yaml`: die Zahl darf nur sinken.
 * Stand 07.11.2026 (nach PR 3025), gemessen am Bestand: 4 blockiert (Kommentar, Datumsform oder Beleg dazwischen).
 * Fällt sie darunter, die Grenze hier auf den neuen Stand senken. „Zusammenführbar“ steht bei 0 und warnt schon im Wächter selbst.
 */
export const GRENZE_BLOCKIERT = 4

/** Warnzeilen der Ratsche: über der Grenze mit den Gruppen, darunter mit dem Hinweis, die Grenze zu senken. */
export function ratschenZeilen(b: Pick<FastDoppelBilanz, 'blockiert' | 'blockiertFalt'>): string[] {
  if (b.blockiert > GRENZE_BLOCKIERT) {
    return [`⚠ WARNUNG Handbelege-Ratsche: ${b.blockiert} blockierte Fast-Doppel-Gruppen, Grenze ${GRENZE_BLOCKIERT} — Gruppen (Titel|Plattform|Adresse): ${b.blockiertFalt.join('; ')}`]
  }
  if (b.blockiert < GRENZE_BLOCKIERT) {
    return [`⚠ WARNUNG Handbelege-Ratsche: nur noch ${b.blockiert} blockierte Gruppen — GRENZE_BLOCKIERT in pipeline/lib/handbeleg-fast-doppel-ratsche.ts auf ${b.blockiert} senken`]
  }
  return []
}
