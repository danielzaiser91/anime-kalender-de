#!/usr/bin/env node
/**
 * Herabgestufte Bestandsprüfungen im Posteingang (26.10.2026): Eine Prüfung, die den Bau nicht mehr sperrt, druckt eine Zeile
 * `⚠ WARNUNG [vorher rot] …` (`pipeline/lib/bestand-warnzeile.ts`). Hier wird sie, einmal je Wortlaut, als Warnung an
 * `data/meldungen-an-claude.jsonl` gehängt — sonst bliebe sie ein `::warning::` im Lauf-Log, das niemand liest.
 * Es wird nur angehängt, nie etwas geändert oder gelöscht; unlesbare Zeilen der Datei bleiben stehen.
 *
 * Aufruf (nur `tools/commit-data.sh`, nach grünem `check:bestand`):
 *   node tools/bestand-warnung-melden.mjs <prüfprotokoll> <meldungen.jsonl>
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const MARKE = '[vorher rot]'
/** Mehr neue Wortlaute je Lauf sind ein Fehler in der Prüfung, kein Posteingang wert. */
export const HOECHSTENS = 5
/** So viele Zeilen vom Ende der Datei zählen für „schon gemeldet“. */
export const RUECKBLICK = 500

/** Die Texte der herabgestuften Warnzeilen eines Prüfprotokolls, ohne das Zeichen `⚠ WARNUNG `. */
export function warnTexte(protokoll) {
  const texte = []
  for (const zeile of protokoll.split('\n')) {
    const i = zeile.indexOf('⚠ WARNUNG ')
    if (i < 0) continue
    const text = zeile.slice(i + '⚠ WARNUNG '.length).trim()
    if (text.includes(MARKE) && !texte.includes(text)) texte.push(text)
  }
  return texte
}

/** Die `text`-Felder der letzten `RUECKBLICK` Zeilen; eine unlesbare Zeile zählt nicht. */
export function bekannteTexte(jsonl) {
  const bekannt = new Set()
  for (const zeile of jsonl.split('\n').slice(-RUECKBLICK)) {
    try {
      const text = JSON.parse(zeile).text
      if (typeof text === 'string') bekannt.add(text)
    } catch {
      continue
    }
  }
  return bekannt
}

/** Die anzuhängenden Zeilen (mit Zeilenende) für Protokoll und bisherigen Inhalt der Datei. */
export function neueZeilen(protokoll, jsonl, jetzt) {
  const bekannt = bekannteTexte(jsonl)
  return warnTexte(protokoll)
    .filter((text) => !bekannt.has(text))
    .slice(0, HOECHSTENS)
    .map((text) => JSON.stringify({ am: jetzt.toISOString(), quelle: 'bestand-bauen', schwere: 'warnung', text }) + '\n')
}

export function main(args, jetzt = new Date()) {
  const [protokoll, ziel] = args
  if (!protokoll || !ziel) {
    console.log('Aufruf: node tools/bestand-warnung-melden.mjs <prüfprotokoll> <meldungen.jsonl>')
    return 2
  }
  const text = existsSync(protokoll) ? readFileSync(protokoll, 'utf8') : ''
  const bisher = existsSync(ziel) ? readFileSync(ziel, 'utf8') : ''
  const zeilen = neueZeilen(text, bisher, jetzt)
  if (!zeilen.length) return 0
  const luecke = bisher === '' || bisher.endsWith('\n') ? '' : '\n'
  appendFileSync(ziel, luecke + zeilen.join(''))
  console.log(`Posteingang: ${zeilen.length} herabgestufte Warnung(en) gemeldet.`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)))
