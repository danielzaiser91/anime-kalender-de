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
  /**
   * **Zweite Quelle: Kanal-Meldungen, denen JustWatch widerspricht.**
   *
   * `pipeline/kanal-gegenprobe.ts` macht aus einer Kanal-Meldung ohne Deutsch
   * plus einer schweigenden zweiten Quelle ein belegtes Nein. Findet JustWatch
   * dort aber **deutschen Ton**, ist die Meldung ein Falschnegativ — der Fall,
   * vor dem CLAUDE.md warnt: Ohne Kanal-Abo zeigt Amazon die deutsche Tonspur
   * gar nicht, und 14 von 45 solcher Meldungen waren am 07.09.2026 falsch.
   *
   * Solche Titel gehören zurück in die Prüfliste, und zwar sichtbar: Sie tragen
   * ein Urteil, dem eine Quelle widerspricht — dieselbe Lage wie beim
   * MOTN-Wechsel darüber, nur aus anderer Richtung.
   *
   * **Eigene Datei, nicht `tonspur-verdacht.json`:** Die schreibt ein anderer
   * Lauf komplett neu, und ein Eintrag darin wäre beim nächsten Durchgang weg —
   * dieselbe Falle, die am 09.09.2026 schon `data/adn-adressen.yaml` erwischt
   * hat.
   */
  try {
    const roh = JSON.parse(readFileSync(resolve(wurzel, 'data/kanal-widerspruch.json'), 'utf8'))
    for (const v of Array.isArray(roh?.faelle) ? roh.faelle : []) {
      if (v.platform !== plattform || raus.has(v.titleId)) continue
      raus.set(v.titleId, { kanalWiderspruch: v.quelle ?? 'JustWatch', seit: v.seit })
    }
  } catch {
    /* Noch kein Lauf, keine Widersprüche. */
  }
  return raus
}

/** Der Satz, der im Kasten der Erweiterung steht. */
export function verdachtHinweis(v) {
  /*
    Ein Kanal-Widerspruch ist die andere Richtung: Die Meldung sagte „kein
    Deutsch", eine zweite Quelle findet welches. Der Satz muss sagen, was zu tun
    ist — mit Kanal-Abo nachsehen.
  */
  if (v.kanalWiderspruch) {
    return (
      `Wiedervorlage: Die Meldung sagt „kein Deutsch", ${v.kanalWiderspruch} findet deutschen Ton — ` +
      `bei einem Kanal-Titel zeigt Prime ohne Abo keine deutsche Tonspur, bitte mit Abo gegenprüfen`
    )
  }
  return (
    `Wiedervorlage: Eine zweite Quelle nannte hier seit ${v.vorherSeit} deutschen Ton ` +
    `und tut es seit ${v.seit} nicht mehr — bitte gegenprüfen`
  )
}
