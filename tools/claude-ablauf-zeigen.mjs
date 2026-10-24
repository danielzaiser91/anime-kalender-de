/**
 * Zeigt den Ablauf eines Claude-Laufs (claude-execution-output.json der Action) im Schrittprotokoll:
 * die Action druckt nur Init und Ergebnis, nicht was Claude getan hat (Lauf 39397639406, 20.10.2026: grün, 8 Züge, PR 1556 blieb im Konflikt, Grund unsichtbar).
 * Aufruf: node tools/claude-ablauf-zeigen.mjs <datei>. Endet immer mit 0 — ein Anzeigefehler darf den Lauf nicht färben.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const KUERZE = 300

function kurz(text) {
  const eine = String(text).replace(/\s+/g, ' ').trim()
  return eine.length > KUERZE ? `${eine.slice(0, KUERZE)}…` : eine
}

function zeilenAusInhalt(inhalt) {
  const zeilen = []
  for (const teil of Array.isArray(inhalt) ? inhalt : []) {
    if (teil?.type === 'text') zeilen.push(`Claude: ${kurz(teil.text)}`)
    if (teil?.type === 'tool_use') zeilen.push(`Aufruf ${teil.name}: ${kurz(teil.input?.command ?? JSON.stringify(teil.input ?? {}))}`)
    if (teil?.type === 'tool_result') zeilen.push(`Ergebnis${teil.is_error ? ' (Fehler)' : ''}: ${kurz(typeof teil.content === 'string' ? teil.content : JSON.stringify(teil.content ?? ''))}`)
  }
  return zeilen
}

/** Zeilen für das Protokoll; nimmt den Inhalt der Datei als Text und scheitert nie. */
export function ablaufZeilen(text) {
  let nachrichten
  try {
    nachrichten = JSON.parse(text)
  } catch {
    return ['Ablauf nicht lesbar: kein gültiges JSON.']
  }
  if (!Array.isArray(nachrichten)) return ['Ablauf nicht lesbar: kein Array.']
  const zeilen = []
  for (const n of nachrichten) {
    if (n?.type === 'assistant' || n?.type === 'user') zeilen.push(...zeilenAusInhalt(n.message?.content))
    if (n?.type === 'result') zeilen.push(`Ende (${n.subtype}, ${n.num_turns} Züge): ${kurz(n.result ?? '')}`)
  }
  return zeilen.length ? zeilen : ['Ablauf leer.']
}

function main(datei) {
  let text
  try {
    text = readFileSync(datei, 'utf8')
  } catch {
    console.log(`Ablauf: ${datei} fehlt.`)
    return
  }
  for (const z of ablaufZeilen(text)) console.log(z)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2])
