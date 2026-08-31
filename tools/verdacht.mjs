/**
 * **Verdachtsfälle gehören in die Prüfliste, nicht in eine Markdown-Datei.**
 *
 * `pipeline/tonspur-verdacht.ts` findet Verweise, bei denen die Streaming
 * Availability API ihre eigene Aussage **zurückgenommen** hat: früher deutscher
 * Ton, jetzt keiner mehr. Bis zum 31.08.2026 landeten sie nur in
 * `daniel-zum-abarbeiten/13-tonspur-verdacht.md` — einer Datei, die Daniel
 * neben der Erweiterung hätte abarbeiten müssen.
 *
 * **Ein Schweigen ist kein Verdacht.** Die erste Fassung fragte, ob die Quelle
 * unserem Bestand gerade widerspricht — das ergab 57 Dauerfälle, darunter
 * Dorohedoro, vollständig gemeldet und trotzdem als offen dargestellt. Daniels
 * Vorgabe: „motn sagt es gibt keine deutsche synchro -> nächster motn lauf sagt
 * auch keine de -> keine wiedervorlage."
 *
 * Sein Einwand: „das kann doch alles auf die prüfliste und mit extension
 * gecheckt werden oder nicht?" Kann es, und genau dort gehört es hin: Ein
 * Eintrag, der die Frage mitbringt und die Antwort in einem Klick entgegennimmt,
 * ist billig — einer, den man in einer zweiten Liste suchen muss, ist teuer.
 *
 * Die Listengeneratoren zeigen sonst nur, was **kein** Urteil hat
 * (`dub === undefined`). Ein Verdachtsfall hat eines, es ist nur womöglich
 * überholt. Deshalb dieser Umweg statt einer Änderung am Grundfilter.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Offene Verdachtsfälle je Anbieter, als Menge von AniList-Kennungen.
 *
 * @param {string} wurzel Repo-Wurzel
 * @param {string} plattform `netflix`, `primevideo`, `disneyplus`
 * @returns {Map<number, {von: number, bis: number, seit: string}>}
 */
export function verdachtsfaelle(wurzel, plattform) {
  const raus = new Map()
  try {
    const roh = JSON.parse(readFileSync(resolve(wurzel, 'data/tonspur-verdacht.json'), 'utf8'))
    for (const v of Array.isArray(roh) ? roh : []) {
      if (v.erledigt || v.platform !== plattform) continue
      raus.set(v.titleId, { von: v.von, bis: v.bis, seit: v.seit })
    }
  } catch {
    /* Ohne Datei gibt es keine Verdachtsfälle — die Liste bleibt, wie sie war. */
  }
  return raus
}

/** Der Satz, der im Kasten der Erweiterung steht. */
export function verdachtHinweis(v) {
  return (
    `Wiedervorlage: Eine zweite Quelle nannte hier seit ${v.vorherSeit} deutschen Ton ` +
    `und tut es seit ${v.seit} nicht mehr — bitte gegenprüfen`
  )
}
