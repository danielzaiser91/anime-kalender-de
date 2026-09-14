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
import yaml from 'js-yaml'

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
      /*
        Eine zweite Ausgabe mit Deutsch ist kein Widerspruch zur Kanal-Seite —
        die erneut vorzulegen zeigt wieder kein Deutsch. Sie wird gesucht
        (`extension-offene-amazon.mjs`, 14.09.2026).
      */
      if (v.platform !== plattform || raus.has(v.titleId) || v.art === 'andere-ausgabe') continue
      raus.set(v.titleId, { kanalWiderspruch: v.quelle ?? 'JustWatch', seit: v.seit })
    }
  } catch {
    /* Noch kein Lauf, keine Widersprüche. */
  }
  /**
   * **Dritte Quelle: Belege, deren Folgen über den Titel hinausreichen.**
   *
   * Ein Handbeleg „Folge 1–22" an einem Titel mit 21 Folgen trägt die Zählung
   * des Anbieters, nicht unsere (FGO Babylonia: Netflix zählt Episode 0 mit).
   * Aufgelöst wird das über die Folgentitel — und die schickt die Erweiterung
   * nur für Seiten, die über die Prüfliste geöffnet werden. Am 13.09.2026 standen
   * acht solcher Belege seit Tagen als „wartet auf Folgentitel" im Footer, und
   * keiner war auf einer Liste; es wartete also auf etwas, das nie kommt.
   *
   * Gerechnet wird dasselbe wie in `check:logic` („höchstens N nennen Folgen
   * über der Folgenzahl ihres Titels"). Ist ein Fall zugeordnet, fällt er
   * dort heraus — und damit hier von selbst von der Liste.
   */
  try {
    const titel = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
    const folgen = new Map((Array.isArray(titel) ? titel : Object.values(titel)).map((t) => [t.id, t.episodes ?? 0]))
    const belege = yaml.load(readFileSync(resolve(wurzel, 'data/dub-confirmed.yaml'), 'utf8')) ?? []
    for (const b of belege) {
      if (b.platform !== plattform || raus.has(b.anilistId)) continue
      const n = folgen.get(b.anilistId) ?? 0
      const bis = Math.max(0, ...(b.dubRanges ?? []).map((r) => r.to ?? 0))
      if (n > 0 && bis > n) raus.set(b.anilistId, { anbieterZaehlung: { bis, folgen: n } })
    }
  } catch {
    /* Ohne Titel oder Belege gibt es nichts zu vergleichen. */
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
  if (v.anbieterZaehlung) {
    return (
      `Zuordnung: Der Beleg nennt Folgen bis ${v.anbieterZaehlung.bis}, unser Titel hat ${v.anbieterZaehlung.folgen} — ` +
      `bitte die Folgen hier melden, damit ihre Titel zeigen, welche Folge wohin gehört`
    )
  }
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
