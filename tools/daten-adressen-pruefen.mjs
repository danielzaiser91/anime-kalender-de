#!/usr/bin/env node
/**
 * Prüft am gebauten `dist/`, dass die Datenadressen die Inhalts-Kennung der Datei tragen (`tools/daten-kennungen.ts`):
 * `meta.json` nennt `dateien`, die Vorlade-Links im HTML tragen genau diese Kennungen (meta und patchnotes: die Code-Version),
 * und das Bündel kennt sie, aus denen `loadJson()` seine Adressen baut. `dateien` wird am ausgelieferten `dist/data` neu gerechnet.
 * Aufruf: node tools/daten-adressen-pruefen.mjs [--dist <ordner>]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { NACH_DEM_BAU_UMGESCHRIEBEN, dateiKennungen } from './daten-kennungen.ts'

const arg = (name, vorgabe) => resolve(process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : vorgabe)
const dist = arg('--dist', join(import.meta.dirname, '..', 'dist'))
const lies = (pfad) => readFileSync(join(dist, pfad), 'utf8')
const fehler = []

const dateien = JSON.parse(lies('data/meta.json')).dateien ?? {}
const version = JSON.parse(lies('version.json')).v
const eintraege = Object.entries(dateien)
const datenOrdner = join(dist, 'data')
const soll = dateiKennungen(datenOrdner, NACH_DEM_BAU_UMGESCHRIEBEN)
for (const name of new Set([...Object.keys(soll), ...Object.keys(dateien)])) if (soll[name] !== dateien[name]) fehler.push(`dateien["${name}"] = ${dateien[name]}, aus dem Inhalt von ${datenOrdner} folgt ${soll[name]}`)
if (eintraege.length === 0) fehler.push('data/meta.json trägt kein `dateien`')
for (const [name, kennung] of eintraege) if (!/^[0-9a-f]{8}$/.test(kennung)) fehler.push(`dateien["${name}"] = ${kennung} ist kein 8-stelliger Hash`)
for (const name of ['meta.json', 'patchnotes.json']) if (name in dateien) fehler.push(`${name} wird nach dem Kopieren umgeschrieben und darf keinen Inhalts-Hash tragen`)

const html = lies('index.html')
const vorgeladen = [...html.matchAll(/"([\w-]+)":"[^"]*?\/data\/([\w-]+\.json)\?v=([^"]+)"/g)]
if (vorgeladen.length === 0) fehler.push('index.html lädt keine Startdaten vor')
for (const [, , datei, v] of vorgeladen) {
  const soll = datei in dateien ? dateien[datei] : version
  if (v !== soll) fehler.push(`Vorladen ${datei}: ?v=${v}, erwartet ${soll}`)
}
const vorgeladeneDateien = vorgeladen.map((m) => m[2])
for (const datei of ['meta.json', 'titles-core.json', 'releases.json', 'events.json']) if (!vorgeladeneDateien.includes(datei)) fehler.push(`Vorladen: ${datei} fehlt`)

const buendel = readdirSync(join(dist, 'assets')).filter((n) => n.endsWith('.js')).map((n) => lies(join('assets', n))).join('\n')
for (const [name, kennung] of eintraege) if (!buendel.includes(`"${name}":"${kennung}"`)) fehler.push(`Bündel kennt ${name}:${kennung} nicht`)
for (const name of NACH_DEM_BAU_UMGESCHRIEBEN) if (!buendel.includes(`"${name}":"${version}"`)) fehler.push(`Bündel kennt ${name} nicht mit der Code-Version ${version}`)

if (fehler.length) {
  console.error('✖ Daten-Adressen:', fehler.join('; '))
  process.exit(1)
}
console.log(`  ✓ Daten-Adressen: ${eintraege.length} Kennungen in meta.json, Vorladen und Bündel gleich (${vorgeladen.length} vorgeladene Links)`)
