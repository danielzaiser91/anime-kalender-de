/**
 * Gemeinsame Invarianten der Cartoon-Stichprobe (genau 50 je Gruppe, keine Doppelten, Aussage je Eintrag); genutzt von
 * `cartoon-jw-stichprobe.test.mjs` (erfundene Welt, eingefrorene Datei) und `cartoon-jw-stichprobe-bestand-pruefen.mjs` (echter Bestand).
 */
import assert from 'node:assert/strict'
import { QUOTEN } from './cartoon-jw-stichprobe.mjs'

const gruppe = (liste, richtung) => liste.filter((e) => e.richtung === richtung)
const ohneDoppelte = (liste, schluessel) => new Set(liste.map(schluessel)).size === liste.length

export function pruefeInvarianten(liste, was) {
  for (const richtung of Object.keys(QUOTEN)) assert.equal(gruppe(liste, richtung).length, 50, `${was}: genau 50 in ${richtung}`)
  assert.equal(liste.length, 100, `${was}: 100 insgesamt`)
  assert.ok(ohneDoppelte(liste, (e) => `${e.id}|${e.plattform}`), `${was}: kein Weg doppelt`)
  assert.ok(ohneDoppelte(liste, (e) => `${e.plattform}|${e.url}`), `${was}: keine Adresse doppelt`)
  assert.ok(liste.every((e) => e.id < 0 && e.titel && e.url && e.jw.text), `${was}: Kennung, Titel, Adresse und JustWatch-Aussage je Eintrag`)
  assert.ok(gruppe(liste, 'jw-deutsch').every((e) => e.jw.urteil === 'deutsch'), `${was}: jw-deutsch nennt Deutsch`)
  assert.ok(gruppe(liste, 'jw-ohne-deutsch').every((e) => e.jw.urteil !== 'deutsch'), `${was}: jw-ohne-deutsch nennt kein Deutsch`)
}
