#!/usr/bin/env node
/**
 * **Wochenwache: der Teil von „Wache durchsehen", den kein Modell braucht.**
 *
 * Die tägliche Wache (`delta-wache.yml`) sieht Verluste im Bestand. Dieses Skript fragt, was sie nicht
 * fragt: Hat jeder Datenlauf in seiner Frist **erfolgreich** geendet (ein abgebrochener Lauf zählt nicht),
 * und ist der veröffentlichte Stand frisch? Stumme Quellen prüft `pipeline/check-sources.ts --nur-melden`
 * im selben Workflow-Schritt. Beurteilen, ob ein Befund ein Fehler ist, bleibt Sache des Lesers der Meldung.
 *
 * Ein Befund steht auf stdout und als Zeile in `data/meldungen-an-claude.jsonl` (Format wie
 * `pipeline/lib/meldung.ts`). Exit-Code ist immer 0: Rot machen sollen Sammler, nicht ihre Wache.
 *
 * Aufruf (braucht `gh` und `GH_TOKEN`): node tools/wache-woechentlich.mjs [--trocken]
 */
import { LIMIT_STAPEL_MS, mitLimit } from './kind-mit-limit.mjs'
import { appendFileSync, readFileSync } from 'node:fs'
import { FRISTEN_STUNDEN, pruefeFristen } from './wache-fristen.mjs'

const TROCKEN = process.argv.includes('--trocken')
const H = 3600e3

const STAND_MAX_STUNDEN = 36

// WACHE_GH_SKRIPT: Node-Skript statt gh (nur der Prozess-Test setzt es).
const gh = (...a) => (process.env.WACHE_GH_SKRIPT ? mitLimit(process.execPath, [process.env.WACHE_GH_SKRIPT, ...a], { encoding: 'utf8' }) : mitLimit('gh', a, { encoding: 'utf8', maxBuffer: 8 << 20 }))

function letzterErfolg(workflow) {
  const t = gh('run', 'list', '--workflow', workflow, '--status', 'success', '--limit', '1', '--json', 'createdAt', '--jq', '.[0].createdAt // empty').trim()
  return t ? Date.parse(t) : null
}

const jetzt = Date.now()
const befunde = pruefeFristen(letzterErfolg, jetzt, FRISTEN_STUNDEN, console.log)

try {
  const erzeugt = Date.parse(JSON.parse(readFileSync('public/data/meta.json', 'utf8')).generatedAt)
  const alter = (jetzt - erzeugt) / H
  console.log(`Datensatz (meta.generatedAt) vor ${alter.toFixed(1)} h (erlaubt ${STAND_MAX_STUNDEN} h)`)
  if (!(alter <= STAND_MAX_STUNDEN)) befunde.push(`Datensatz public/data/meta.json ist ${Math.round(alter)} h alt, erlaubt ${STAND_MAX_STUNDEN} h`)
} catch (e) {
  befunde.push(`public/data/meta.json nicht lesbar: ${String(e.message).split('\n')[0]}`)
}

// Sammelartikel-Vorschläge (pipeline/fetch-sammelartikel.ts, nur Vorschlagsmodus): eine Zeile mit den Zahlen der letzten sieben Tage.
// Kein Befund — die Aussagen warten auf Auswertung; stumm gilt der Lauf erst nach vier Tagen ohne Lesezeitpunkt.
try {
  const vorschlaege = JSON.parse(readFileSync('data/proposals/aussagen.json', 'utf8'))
  const stand = JSON.parse(readFileSync('data/sammelartikel-stand.json', 'utf8'))
  const grenze = new Date(jetzt - 7 * 24 * H).toISOString().slice(0, 10)
  const neu = (vorschlaege.aussagen ?? []).filter((v) => v.erstGesehen > grenze)
  const zeile = `Sammelartikel: ${neu.length} neue Aussagen, davon ${neu.filter((v) => v.offenOderUnklar).length} offen/unklar`
  console.log(zeile)
  if (!TROCKEN) appendFileSync('data/meldungen-an-claude.jsonl', JSON.stringify({ am: new Date().toISOString(), quelle: 'wache-woechentlich', schwere: 'hinweis', text: zeile }) + '\n', 'utf8')
  const alter = (jetzt - Date.parse(stand.letzterLauf)) / H
  if (!(alter <= 96)) befunde.push(`Sammelartikel-Lauf zuletzt vor ${Math.round(alter)} h (letzter Ausgang: ${stand.letzterAusgang ?? 'unbekannt'}, Pause bis ${stand.pauseBis ?? '-'})`)
} catch (e) {
  console.log(`Sammelartikel: noch kein Stand (${String(e.message).split('\n')[0]})`)
}

/*
  **Weiche Regeln des Daten-Detektivs** (`docs/wissen/daten-detektiv.md`): Befund nur bei Schlüsseln, die nicht in `data/detektiv-bekannt.json` stehen.
  Die harten Regeln laufen als Bau-Invarianten (`pipeline/lib/invarianten*.ts`) und brechen den Bau ab, nicht diese Wache.
*/
try {
  // Daten-Detektiv gemessen 30.10. und 31.10.2026 (je 3 Läufe): 2,7-3,1 s; Stapel-Limit 30 s (rund das Zehnfache).
  // WACHE_DETEKTIV_SKRIPT: Node-Skript statt npx tsx (nur der Prozess-Test setzt es, für den Hänger-Fall).
  const ersatz = process.env.WACHE_DETEKTIV_SKRIPT
  const ausgabe = mitLimit(ersatz ? process.execPath : 'npx', ersatz ? [ersatz] : ['tsx', 'tools/daten-detektiv.ts', '--wache'], { encoding: 'utf8', maxBuffer: 32 << 20, shell: !ersatz && process.platform === 'win32' }, { limitMs: LIMIT_STAPEL_MS })
  const neu = JSON.parse(ausgabe.trim().split('\n').at(-1)).neu
  console.log(`Daten-Detektiv (weiche Regeln): ${neu.length} neue Schlüssel`)
  if (neu.length) befunde.push(`Daten-Detektiv: ${neu.length} neue Funde, z. B. ${neu.slice(0, 3).map((n) => `${n.id} ${n.text}`).join(' | ')} (npm run detektiv -- --nur ${[...new Set(neu.map((n) => n.id))].join(',')})`)
} catch (e) {
  befunde.push(`Daten-Detektiv: Lauf fehlgeschlagen (${String(e.message).split('\n')[0]})`)
}

if (!befunde.length) {
  console.log('Wochenwache: unauffällig')
} else {
  const text = `Wochenwache: ${befunde.join('; ')}`
  console.log(text)
  for (const b of befunde) console.log(`::warning title=Wochenwache::${b}`)
  if (!TROCKEN) {
    appendFileSync('data/meldungen-an-claude.jsonl', JSON.stringify({ am: new Date().toISOString(), quelle: 'wache-woechentlich', schwere: 'warnung', text }) + '\n', 'utf8')
  }
}
