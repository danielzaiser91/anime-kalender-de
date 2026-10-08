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
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'

const TROCKEN = process.argv.includes('--trocken')
const H = 3600e3

/** Workflow: erlaubtes Alter des letzten erfolgreichen Laufs in Stunden (Takt plus Luft, Stand 08.10.2026). */
const FRISTEN_STUNDEN = {
  'refresh-hourly.yml': 12,
  'refresh-data.yml': 36,
  'bestand-bauen.yml': 36,
  'deploy.yml': 48,
  'adn-laufende.yml': 24,
  'claude-verpasst-recherche.yml': 36,
  'anisearch-katalog.yml': 48,
  'refresh-weekly.yml': 216,
  // Wie `motn` in check-sources.ts: ein Kontingentzyklus plus zwei Tage.
  'tonspuren-monatlich.yml': 792,
}
const STAND_MAX_STUNDEN = 36

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 8 << 20 })

function letzterErfolg(workflow) {
  const t = gh('run', 'list', '--workflow', workflow, '--status', 'success', '--limit', '1', '--json', 'createdAt', '--jq', '.[0].createdAt // empty').trim()
  return t ? Date.parse(t) : null
}

const befunde = []
const jetzt = Date.now()
for (const [workflow, max] of Object.entries(FRISTEN_STUNDEN)) {
  let t = null
  try {
    t = letzterErfolg(workflow)
  } catch (e) {
    befunde.push(`${workflow}: Abfrage fehlgeschlagen (${String(e.message).split('\n')[0]})`)
    continue
  }
  const alter = t === null ? null : (jetzt - t) / H
  console.log(`${workflow.padEnd(32)} letzter Erfolg vor ${alter === null ? 'nie' : alter.toFixed(1) + ' h'} (erlaubt ${max} h)`)
  if (alter === null || alter > max) befunde.push(`${workflow}: letzter erfolgreicher Lauf ${alter === null ? 'nie' : 'vor ' + Math.round(alter) + ' h'}, erlaubt ${max} h`)
}

try {
  const erzeugt = Date.parse(JSON.parse(readFileSync('public/data/meta.json', 'utf8')).generatedAt)
  const alter = (jetzt - erzeugt) / H
  console.log(`Datensatz (meta.generatedAt) vor ${alter.toFixed(1)} h (erlaubt ${STAND_MAX_STUNDEN} h)`)
  if (!(alter <= STAND_MAX_STUNDEN)) befunde.push(`Datensatz public/data/meta.json ist ${Math.round(alter)} h alt, erlaubt ${STAND_MAX_STUNDEN} h`)
} catch (e) {
  befunde.push(`public/data/meta.json nicht lesbar: ${String(e.message).split('\n')[0]}`)
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
