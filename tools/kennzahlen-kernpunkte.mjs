/**
 * Kernpunkte aus Tagesberichten (daniel-zum-abarbeiten/berichte/tagesbericht-JJJJ-MM-TT*.md) nach tools/kennzahlen/kernpunkte.yaml.
 * Je Tag „geschafft“ (Was geschafft / Für Besucher sichtbar / Schneller zur Synchro) und „probleme“ (Wo es Probleme gab / Beim Prüfer / Mit Auflagen offen).
 *   node tools/kennzahlen-kernpunkte.mjs [berichte-ordner]   ergänzt/aktualisiert die Tage, für die ein Bericht vorliegt; andere Tage bleiben
 * Die Berichte sind lokal ausgeschlossen (nicht im Repo): die yaml ist die committete Fassung.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ZIEL = resolve(WURZEL, 'tools/kennzahlen/kernpunkte.yaml')
const GESCHAFFT = /^## (Was geschafft wurde|Für Besucher sichtbar|Schneller zur Synchro)/
const PROBLEME = /^## (Wo es Probleme gab|Beim Prüfer|Mit Auflagen offen)/
const MAX_JE_GRUPPE = 8
const MAX_ZEICHEN = 140

function bereinige(zeile) {
  const text = zeile
    .replace(/^- /, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*`]/g, '')
    .trim()
  return text.length > MAX_ZEICHEN ? `${text.slice(0, MAX_ZEICHEN - 1).trimEnd()}…` : text
}

/** Zeilen je Abschnittsart; mit Aufzählung zählen nur deren oberste Ebene, sonst die Textzeilen. */
function punkte(abschnitte) {
  const alle = []
  for (const zeilen of abschnitte) {
    const listen = zeilen.filter((z) => z.startsWith('- '))
    const quelle = listen.length > 0 ? listen : zeilen.filter((z) => z.trim() !== '' && !z.startsWith('#') && !z.startsWith(' '))
    for (const z of quelle) alle.push(bereinige(z))
  }
  return alle.filter((t) => t !== '').slice(0, MAX_JE_GRUPPE)
}

export function kernpunkteAus(text) {
  const abschnitte = { geschafft: [], probleme: [] }
  let aktuell = null
  for (const zeile of text.split('\n')) {
    if (zeile.startsWith('## ')) {
      const art = GESCHAFFT.test(zeile) ? 'geschafft' : PROBLEME.test(zeile) ? 'probleme' : null
      aktuell = art ? [] : null
      if (art) abschnitte[art].push(aktuell)
    } else if (aktuell) aktuell.push(zeile)
  }
  return { geschafft: punkte(abschnitte.geschafft), probleme: punkte(abschnitte.probleme) }
}

export function tagAusDateiname(name) {
  return /^tagesbericht-(\d{4}-\d{2}-\d{2})/.exec(name)?.[1] ?? null
}

/** Bestand (yaml-Objekt) um alle Berichte im Ordner ergänzen; ein Bericht ersetzt den Eintrag seines Tags. */
export function ergaenze(bestand, ordner) {
  const neu = { ...bestand }
  if (!existsSync(ordner)) return neu
  for (const name of readdirSync(ordner).sort()) {
    const tag = tagAusDateiname(name)
    if (!tag || !name.endsWith('.md')) continue
    neu[tag] = kernpunkteAus(readFileSync(resolve(ordner, name), 'utf8'))
  }
  return Object.fromEntries(Object.entries(neu).sort(([a], [b]) => (a < b ? -1 : 1)))
}

export function aktualisiereKernpunkte(ordner = resolve(WURZEL, 'daniel-zum-abarbeiten/berichte'), ziel = ZIEL) {
  const bestand = existsSync(ziel) ? yaml.load(readFileSync(ziel, 'utf8'), { schema: yaml.CORE_SCHEMA }) ?? {} : {}
  const neu = ergaenze(bestand, ordner)
  writeFileSync(ziel, yaml.dump(neu, { lineWidth: -1 }))
  return Object.keys(neu).length
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = aktualisiereKernpunkte(process.argv[2] ? resolve(process.argv[2]) : undefined)
  console.log(`kernpunkte.yaml: ${n} Tage`)
}
