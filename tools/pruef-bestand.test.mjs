/**
 * Prüft die Regeln der Prüfliste (`tools/pruef-bestand.mjs`): Vorgabe lässt alles beim Alten,
 * `erweitert` markiert Quelle, Vertrauensstufe und Staffel-Unschärfe, `ausblenden` nimmt Wege heraus.
 * Aufruf: node tools/pruef-bestand.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ausgeblendet, eintragsInfo, inStichprobe, rangVon, regeln } from './pruef-bestand.mjs'

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
assert.equal(eintragsInfo(film, 'netflix', { dub: true }, an).quelle, 'datensatz')

assert.equal(ausgeblendet(avatar, 'netflix', undefined, an), false, 'Vorgabe: nichts ausblenden')
assert.equal(ausgeblendet(avatar, 'netflix', undefined, anUndWeg), true, 'vertrauenswürdige Quelle blendet aus')
assert.equal(ausgeblendet(avatar, 'disneyplus', undefined, anUndWeg), false, 'andere Quelle bleibt')
assert.equal(ausgeblendet(film, 'netflix', undefined, anUndWeg), false, 'ohne Urteil wird nie ausgeblendet')

const jwWeg = { dubQuelle: 'justwatch', dubStand: '2026-10-11' }
const anMitRegel = { ...an, vertrauen: { ...an.vertrauen, 'justwatch-regel': 'hoch' } }
const regelWeg = eintragsInfo(film, 'primevideo', jwWeg, anMitRegel)
assert.equal(regelWeg.quelle, 'justwatch-regel', 'Prime mit „Deutsch laut JustWatch“ trägt die eigene Quelle')
assert.equal(regelWeg.vertrauen, 'hoch')
assert.equal(eintragsInfo(film, 'primevideo', jwWeg, an).vertrauen, 'ungeprueft', 'ohne Eintrag in den Regeln: ungeprueft')
assert.equal(eintragsInfo(film, 'primevideo', { dub: true, ...jwWeg }, anMitRegel).quelle, 'datensatz', 'ein Urteil geht vor')
assert.equal(ausgeblendet(film, 'primevideo', jwWeg, anMitRegel), false, 'Vorgabe: auch diese Wege bleiben auf der Liste')
assert.equal(ausgeblendet(film, 'primevideo', jwWeg, { ...anMitRegel, ausblenden: ['hoch'] }), true, 'später ausblendbar')
assert.equal(ausgeblendet(film, 'primevideo', {}, { ...anMitRegel, ausblenden: ['hoch'] }), false, 'ohne Kennzeichnung bleibt der Weg')
assert.equal(ausgeblendet(film, 'primevideo', jwWeg, { ...anMitRegel, erweitert: false, ausblenden: ['hoch'] }), false, 'aus: nichts ausgeblendet')

assert.ok(rangVon(film)[0] < rangVon(avatar)[0], 'Hauptbestand vor Cartoons')
const alt = { id: 1, jpEnd: '2001-01-01', jpYear: 2000 }
assert.ok(rangVon(film, '2026-10-11')[1] < rangVon(alt, '2026-10-11')[1], 'laufende vor beendeten')

/* Stichprobe der Cartoon-JustWatch-Prüfung: eigene Quelle, ungeprüft, vor allem anderen. */
const stichprobe = new Set(['-246|disneyplus'])
const anMitStichprobe = { ...an, vertrauen: { ...an.vertrauen, 'cartoon-jw-stichprobe': 'ungeprueft' }, stichprobe }
assert.equal(eintragsInfo(avatar, 'disneyplus', undefined, anMitStichprobe).quelle, 'cartoon-jw-stichprobe')
assert.equal(eintragsInfo(avatar, 'disneyplus', undefined, anMitStichprobe).vertrauen, 'ungeprueft')
assert.equal(eintragsInfo(avatar, 'netflix', undefined, anMitStichprobe).quelle, 'justwatch', 'anderer Anbieter: nicht in der Stichprobe')
assert.equal(eintragsInfo({ ...film, id: -246 }, 'disneyplus', { dub: true }, anMitStichprobe).quelle, 'datensatz', 'nur Cartoons')
assert.deepEqual(eintragsInfo(avatar, 'disneyplus', undefined, { ...aus, stichprobe }), {}, 'aus: Eintrag unverändert')
assert.ok(inStichprobe(avatar, 'disneyplus', anMitStichprobe))
assert.ok(!inStichprobe(avatar, 'primevideo', anMitStichprobe))
assert.ok(rangVon(avatar, '2026-10-11', true)[0] < rangVon(film, '2026-10-11')[0], 'Stichprobe vor dem Hauptbestand')

/* Ende zu Ende mit dem Schalter an: die echten Regeln laden die Stichprobe, nachRang stellt sie vor. */
const erste = JSON.parse(readFileSync(resolve(import.meta.dirname, '../data/cartoon-jw-stichprobe.json'), 'utf8')).eintraege[0]
const probe = `
import { nachRang, regeln } from './tools/pruef-bestand.mjs'
const karte = new Map([
  ['haupt', [{ t: { id: 1, jpYear: 2026 } }]],
  ['cartoon', [{ t: { id: -2, cartoon: true, jpYear: 2026 } }]],
  ['stich', [{ t: { id: ${erste.id}, cartoon: true, jpYear: 1990 } }]],
])
const vorn = nachRang(karte, '${erste.plattform}').map(([k]) => k)
console.log(regeln().stichprobe.size + ' ' + vorn.join(','))
`
const lauf = (env) => spawnSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: resolve(import.meta.dirname, '..'), env: { ...process.env, ...env }, encoding: 'utf8' })
assert.equal(lauf({ PRUEFLISTE_ERWEITERT: '1' }).stdout.trim(), '100 stich,haupt,cartoon', 'an: 100 Wege, Stichprobe zuerst')
assert.equal(lauf({ PRUEFLISTE_ERWEITERT: '0' }).stdout.trim(), '0 haupt,cartoon,stich', 'aus (PRUEFLISTE_ERWEITERT=0 schlägt die Datei): Stichprobe unsichtbar, Reihenfolge unverändert')

assert.equal(typeof regeln().erweitert, 'boolean')
console.log('pruef-bestand: ok')
