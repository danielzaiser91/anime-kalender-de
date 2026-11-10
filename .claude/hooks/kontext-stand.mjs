#!/usr/bin/env node
/**
 * UserPromptSubmit: nennt den **echten** Füllstand des Kontexts (Versuch Sitzungsschnitt, 08.10.2026).
 *
 * Quelle: die Aufzeichnung der Sitzung (`transcript_path`). Jede Antwort trägt dort `usage`; die Summe aus `input_tokens`, `cache_creation_input_tokens` und
 * `cache_read_input_tokens` der **letzten** Antwort ist, was das Modell beim letzten Zug gelesen hat — also der Kontext. Gemessen am 08.10.2026 in einer
 * Sitzung mit zehn Zusammenfassungen: Der Kontext fällt jedes Mal von rund 960.000 auf rund 100.000, das Fenster ist also 1.000.000 Tokens
 * (`KONTEXT_FENSTER` überschreibt es). Fehlt etwas, gibt der Hook nichts aus und stört nie.
 */
import { openSync, readSync, fstatSync, closeSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const FENSTER = Number(process.env.KONTEXT_FENSTER) || 1_000_000
const SCHNITT = 0.3 // 300k (Daniel, 09.10.2026; vorher 200k): Lesemenge je Zug wächst linear mit dem Kontext (Messung 09.10.2026, Notiz prompt-caching-tokens.md)
const UMZUG = 0.5 // 500k

function eingabe() {
  try {
    let s = ''
    const fd = 0
    const buf = Buffer.alloc(65536)
    for (;;) {
      let n = 0
      try { n = readSync(fd, buf, 0, buf.length, null) } catch { break }
      if (!n) break
      s += buf.toString('utf8', 0, n)
    }
    return JSON.parse(s)
  } catch {
    return {}
  }
}

function letzterKontext(pfad) {
  const fd = openSync(pfad, 'r')
  try {
    const groesse = fstatSync(fd).size
    for (const bytes of [2_000_000, 20_000_000]) {
      const von = Math.max(0, groesse - bytes)
      const buf = Buffer.alloc(groesse - von)
      readSync(fd, buf, 0, buf.length, von)
      const zeilen = buf.toString('utf8').split('\n')
      for (let i = zeilen.length - 1; i >= 0; i--) {
        const z = zeilen[i]
        if (!z.includes('"type":"assistant"')) continue
        const m = /"usage":\{"input_tokens":(\d+),"cache_creation_input_tokens":(\d+),"cache_read_input_tokens":(\d+)/.exec(z)
        if (m) return Number(m[1]) + Number(m[2]) + Number(m[3])
      }
      if (von === 0) break
    }
  } finally {
    closeSync(fd)
  }
  return undefined
}

/** Meldetext oder leer; der Bündel-Dispatcher ruft das im selben Prozess auf. */
export function lauf(input) {
  const pfad = input.transcript_path
  if (!pfad) return ''
  const k = letzterKontext(pfad)
  if (!k) return ''
  const anteil = k / FENSTER
  const prozent = Math.round(anteil * 100)
  // Sitzungsschnitt-Versuch beendet (Daniel, 10.10.2026): nur noch Stand melden, keinen Schnitt anbieten.
  const hinweis = ''
  return `[Kontext: ${Math.round(k / 1000)}k von ${Math.round(FENSTER / 1000)}k Tokens = ${prozent} %${hinweis}]`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const text = lauf(eingabe())
    if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }))
  } catch {
    /* Nie stören. */
  }
}
