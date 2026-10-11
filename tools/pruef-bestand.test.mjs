/**
 * Prüft die Regeln der Prüfliste (`tools/pruef-bestand.mjs`): Vorgabe lässt alles beim Alten,
 * `erweitert` markiert Quelle, Vertrauensstufe und Staffel-Unschärfe, `ausblenden` nimmt Wege heraus.
 * Aufruf: node tools/pruef-bestand.test.mjs
 */
import assert from 'node:assert/strict'
import { ausgeblendet, eintragsInfo, rangVon, regeln } from './pruef-bestand.mjs'

const aus = { erweitert: false, vertrauen: {}, ausblenden: [] }
const an = { erweitert: true, vertrauen: { justwatch: 'hoch' }, ausblenden: [] }
const anUndWeg = { ...an, ausblenden: ['hoch'] }
const avatar = { id: -246, cartoon: true, episodes: 61, jpYear: 2005, dubHinweis: { anbieter: ['Netflix', 'Amazon Prime Video'] } }
const film = { id: 7, jpYear: 2026 }

assert.deepEqual(eintragsInfo(avatar, 'netflix', undefined, aus), {}, 'aus: Eintrag unverändert')
assert.equal(ausgeblendet(avatar, 'netflix', undefined, { ...aus, ausblenden: ['hoch'] }), false, 'aus: nichts ausgeblendet')

const info = eintragsInfo(avatar, 'netflix', undefined, an)
assert.equal(info.quelle, 'justwatch')
assert.equal(info.vertrauen, 'hoch')
assert.equal(info.staffelUnscharf, true)
assert.match(info.hinweis, /61 Folgen/)
assert.equal(eintragsInfo(avatar, 'disneyplus', undefined, an).quelle, 'tmdb', 'Disney+ nennt JustWatch hier nicht')
assert.equal(eintragsInfo(film, 'netflix', undefined, an).quelle, 'keine', 'ohne Urteil nichts, dem man trauen könnte')
assert.equal(eintragsInfo(film, 'netflix', true, an).quelle, 'datensatz')

assert.equal(ausgeblendet(avatar, 'netflix', undefined, an), false, 'Vorgabe: nichts ausblenden')
assert.equal(ausgeblendet(avatar, 'netflix', undefined, anUndWeg), true, 'vertrauenswürdige Quelle blendet aus')
assert.equal(ausgeblendet(avatar, 'disneyplus', undefined, anUndWeg), false, 'andere Quelle bleibt')
assert.equal(ausgeblendet(film, 'netflix', undefined, anUndWeg), false, 'ohne Urteil wird nie ausgeblendet')

assert.ok(rangVon(film)[0] < rangVon(avatar)[0], 'Hauptbestand vor Cartoons')
const alt = { id: 1, jpEnd: '2001-01-01', jpYear: 2000 }
assert.ok(rangVon(film, '2026-10-11')[1] < rangVon(alt, '2026-10-11')[1], 'laufende vor beendeten')

assert.equal(typeof regeln().erweitert, 'boolean')
console.log('pruef-bestand: ok')
