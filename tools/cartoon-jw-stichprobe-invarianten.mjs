/**
 * Gemeinsame Invarianten der Cartoon-Stichprobe (genau 50 je Gruppe, keine Doppelten, Aussage je Eintrag); genutzt von
 * `cartoon-jw-stichprobe.test.mjs` (erfundene Welt, eingefrorene Datei) und `cartoon-jw-stichprobe-bestand-pruefen.mjs` (echter Bestand).
 */
import assert from 'node:assert/strict'
import { QUOTEN } from './cartoon-jw-stichprobe.mjs'

const gruppe = (liste, richtung) => liste.filter((e) => e.richtung === richtung)
const ohneDoppelte = (liste, schluessel) => new Set(liste.map(schluessel)).size === liste.length

const SOLL_VOLL = { 'jw-deutsch': 50, 'jw-ohne-deutsch': 50 }

/** Sollzahl je Gruppe im Bestand: min(50, eindeutige Adressen im Pool), gezählt aus den Kandidaten selbst (nicht über `waehleStichprobe`). */
export function sollAusPool(kandidatenListe) {
  const adressen = { 'jw-deutsch': new Set(), 'jw-ohne-deutsch': new Set() }
  for (const k of kandidatenListe) adressen[k.richtung].add(`${k.plattform}|${k.url}`)
  return Object.fromEntries(Object.entries(adressen).map(([richtung, menge]) => [richtung, Math.min(50, menge.size)]))
}

/** `soll`: erwartete Zahl je Gruppe; im Bestand ist es min(50, Pool), weil jedes Urteil den Pool verkleinert. */
export function pruefeInvarianten(liste, was, soll = SOLL_VOLL) {
  for (const richtung of Object.keys(QUOTEN)) assert.equal(gruppe(liste, richtung).length, soll[richtung], `${was}: genau ${soll[richtung]} in ${richtung}`)
  assert.equal(liste.length, soll['jw-deutsch'] + soll['jw-ohne-deutsch'], `${was}: Summe der Gruppen`)
  assert.ok(ohneDoppelte(liste, (e) => `${e.id}|${e.plattform}`), `${was}: kein Weg doppelt`)
  assert.ok(ohneDoppelte(liste, (e) => `${e.plattform}|${e.url}`), `${was}: keine Adresse doppelt`)
  assert.ok(liste.every((e) => e.id < 0 && e.titel && e.url && e.jw.text), `${was}: Kennung, Titel, Adresse und JustWatch-Aussage je Eintrag`)
  assert.ok(gruppe(liste, 'jw-deutsch').every((e) => e.jw.urteil === 'deutsch'), `${was}: jw-deutsch nennt Deutsch`)
  assert.ok(gruppe(liste, 'jw-ohne-deutsch').every((e) => e.jw.urteil !== 'deutsch'), `${was}: jw-ohne-deutsch nennt kein Deutsch`)
}
