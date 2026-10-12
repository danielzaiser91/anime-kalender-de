/**
 * Welcher Eintrag von uns zu einem Anbieter-Block gehört, und was die Liste dazu sagt.
 * Eigene Datei, damit `tools/extension-block.test.mjs` die Zuordnung mit fester Eingabe prüfen kann
 * (`extension-offene-liste.mjs` läuft beim Laden durch).
 */

import { brauchtUrteil } from './offen-erschienen.mjs'

/** Unser Eintrag zum i-ten Block des Anbieters: der Reihe nach, bei nur einem Titel von uns immer dieser. */
export function eintragZuBlock(sortiert, i) {
  return sortiert.length === 1 ? sortiert[0] : sortiert[i]
}

/**
 * Kennung, Offen-Stand und Zustand eines Blocks. Ein Titel von uns mit mehreren Blöcken (Avatar: drei Bücher)
 * trägt in jedem seine Kennung und sein Urteil. Ein Verdachtsfall ist offen, obwohl er ein Urteil hat.
 */
export function blockStand(sortiert, i, verdaechtig, zustandVon) {
  const eintrag = eintragZuBlock(sortiert, i)
  return {
    ...(sortiert.length === 1 ? { id: eintrag.t.id } : {}),
    offen: eintrag ? brauchtUrteil(eintrag) || verdaechtig.has(eintrag.t.id) : true,
    ...(eintrag ? zustandVon(eintrag) : { zustand: 'melden' }),
  }
}
