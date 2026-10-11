/**
 * Eine Staffel ist erst offen, wenn mehr Folgen **erschienen** sind, als belegt.
 *
 * Gemessen am 11.10.2026: „Tokyo Revengers: War of the Three Titans" lief seit dem 02.10. wöchentlich
 * (2 von 13 Folgen erschienen, beide als Handbeleg auf Deutsch) und hielt den Zähler der Erweiterung
 * trotzdem auf „1 offen" — bis Ende Dezember, weil die Liste nach `dub === undefined` fragte und nicht
 * danach, ob es überhaupt etwas zu prüfen gibt.
 *
 * Erschienen = Folgen der Termine des Anbieters (`public/data/releases.json`), deren Zeitpunkt in
 * Europe/Berlin verstrichen ist (`istErschienen`, `shared/logic.ts` — dieselbe Zählung wie die Pille).
 * Belegt = Folgen in den Bereichen am Weg und in den Handbelegen (`data/dub-confirmed.yaml`), gleich
 * ob mit Ja oder Nein. Ohne Termindaten zum Anbieter gilt, was bisher galt: offen.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { expandEvents, istErschienen } from '../shared/logic.ts'

/** Zahl der Folgen, die in `bereiche` (`{ from, to }`) stehen; sich überschneidende zählen einmal. */
function folgenInBereichen(bereiche) {
  const nummern = new Set()
  for (const b of bereiche) for (let n = b.from; n <= b.to; n++) nummern.add(n)
  return nummern.size
}

/** Erschienene Folgen je `Titel|Anbieter`; ein Schlüssel fehlt, wo es keinen Termin gibt. */
function erschieneneJeWeg(releases, jetzt) {
  const nummern = new Map()
  const ohneNummer = new Map()
  for (const r of releases) {
    const schluessel = `${r.titleId}|${r.platform}`
    if (!nummern.has(schluessel)) nummern.set(schluessel, new Set())
    for (const e of expandEvents(r)) {
      if (!istErschienen(e, jetzt)) continue
      if (e.episode != null) nummern.get(schluessel).add(e.episode)
      else ohneNummer.set(schluessel, (ohneNummer.get(schluessel) ?? 0) + (e.episodeCount ?? 1))
    }
  }
  return new Map([...nummern].map(([k, set]) => [k, set.size + (ohneNummer.get(k) ?? 0)]))
}

/**
 * Folgenbereiche der Handbelege je `Titel|Anbieter`. Nur Belege mit Bereichen zählen: „nicht in deinem
 * Gebiet verfügbar“ (Spy × Family, 26.08.2026) sagt nichts über Folgen, die erst danach erschienen.
 */
function handbelegeJeWeg(wurzel) {
  const raus = new Map()
  const belege = yaml.load(readFileSync(resolve(wurzel, 'data/dub-confirmed.yaml'), 'utf8')) ?? []
  for (const b of belege) {
    if (!b?.anilistId || !b.platform || !b.dubRanges?.length) continue
    const schluessel = `${b.anilistId}|${b.platform}`
    raus.set(schluessel, [...(raus.get(schluessel) ?? []), ...b.dubRanges])
  }
  return raus
}

/** Die Zählungen je Repo-Wurzel, einmal je Lauf geladen. */
const geladen = new Map()
function zaehlungen(wurzel, jetzt) {
  if (!geladen.has(wurzel)) {
    const releases = JSON.parse(readFileSync(resolve(wurzel, 'public/data/releases.json'), 'utf8'))
    geladen.set(wurzel, { erschienen: erschieneneJeWeg(releases, jetzt), hand: handbelegeJeWeg(wurzel) })
  }
  return geladen.get(wurzel)
}

/**
 * Gibt es bei diesem Weg noch nichts zu prüfen? Wahr nur, wenn Termine da sind und nicht mehr
 * Folgen erschienen sind, als belegt ist. `weg` ist der Verweis des Titels (`{ dubRanges }`).
 */
export function wartet(wurzel, t, plattform, weg = {}, jetzt = new Date()) {
  const { erschienen, hand } = zaehlungen(wurzel, jetzt)
  const schluessel = `${t.id}|${plattform}`
  if (!erschienen.has(schluessel)) return false
  const belegt = folgenInBereichen([...(weg.dubRanges ?? []), ...(hand.get(schluessel) ?? [])])
  return erschienen.get(schluessel) <= belegt
}

/** Fehlt dem Weg ein Urteil, und gibt es etwas zu prüfen? `e` ist ein Listeneintrag mit `dub` und `wartet`. */
export const brauchtUrteil = (e) => e.dub === undefined && !e.wartet
