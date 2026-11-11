/**
 * Titel-Quarantäne im Probebau (11.11.2026, `tools/pr-bestand-vergleich.mjs`): Der Bestandsbau nach dem Merge stellt bis zu
 * `OBERGRENZE` Anime-Titel zurück, an denen eine Zeilen-Prüfung rot ist (`tools/quarantaene.mjs`). Der Probebau im PR hat bisher jedes neue Rot als
 * Sperre des ganzen PR gewertet: Wegen eines einzigen Titels (99717) ging die gesamte TMDB-Wochenernte (PR 3373) verloren. Jetzt wiederholt er
 * das Verfahren des Bestandsbaus: Marken der neuen roten Prüfungen sammeln, ohne diese Titel neu bauen und prüfen, bis nichts Neues mehr rot ist
 * (grün: die Titel werden zurückgestellt, der PR geht durch) oder das Gate sperrt (keine neue Kennung, Cartoon, mehr als `OBERGRENZE`).
 */
import { entscheide, liesMarken } from './quarantaene.mjs'

/** Die Ausgaben der Prüfungen `namen` aus `ausgaben` (Name → Text), hintereinander. */
export function ausgabeDerPruefungen(ausgaben, namen) {
  return namen.map((n) => ausgaben.get(n) ?? '').join('\n')
}

/**
 * `ausgabe`: Text der neuen roten Prüfungen des ersten Baus. `bauePruefe(liste)` baut ohne die Titel der Liste und liefert die dann
 * neuen roten Prüfungen als `{ ausgabe, neu }` (`neu` leer = grün). Rückgabe: `{ ok: true, liste }` oder `{ ok: false, grund }`.
 */
export async function probeQuarantaene(ausgabe, bauePruefe) {
  let liste = []
  let text = ausgabe
  for (;;) {
    const urteil = entscheide(liste, liesMarken(text))
    if (urteil.sperre) return { ok: false, grund: urteil.sperre }
    liste = urteil.liste
    const r = await bauePruefe(liste)
    if (r.neu.length === 0) return { ok: true, liste }
    text = r.ausgabe
  }
}
