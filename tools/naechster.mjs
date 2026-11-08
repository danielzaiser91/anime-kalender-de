#!/usr/bin/env node
/**
 * Rangliste aus stand.md: liest die Kennzeichen `{Art · Dringlichkeit · Ziel · Eingang [· wartet: …]}` der Zeilen in
 * „In Arbeit“ und „Als Nächstes“ und gibt Rangliste, nächsten startbaren Punkt und „Gerade in Arbeit“ aus.
 * Rang: Art → Dringlichkeit → Ziel → älterer Eingang (Regeln: tools/claude-global/mods/arbeitsliste/hooks/stand-kennzeichen.mjs).
 *
 *   node tools/naechster.mjs [--json] [--datei <stand.md>] [--jetzt <ISO-Zeit>]
 *
 * Exit 1, wenn eine Zeile kein gültiges Kennzeichen trägt (Meldung mit Zeilennummer).
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { auswerten } from './claude-global/mods/arbeitsliste/hooks/stand-kennzeichen.mjs'

const STAND = 'C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/stand.md'

/** Eine Zeile je Eintrag: `Nr. Titel {Kennzeichen}`. */
function zeileVon(e, nr) {
  const k = e.k
  const warte = k.wartet ? ` · wartet: ${k.wartet}` : ''
  return `${nr}. ${e.titel}  [${k.art} · ${k.dringlichkeit} · ${k.ziel} · ${String(k.tag).padStart(2, '0')}.${String(k.monat).padStart(2, '0')}.${warte}] (Zeile ${e.nr})`
}

/** Ausgabetext: Fehler zuerst, dann Gerade in Arbeit, Nächster, Rangliste. */
export function text(a) {
  const aus = a.fehler.map((f) => `FEHLER Zeile ${f.nr}: ${f.grund} — ${f.zeile.slice(0, 80)}`)
  aus.push('Gerade in Arbeit:', ...a.laufend.map((e, i) => `  ${zeileVon(e, i + 1)}`))
  aus.push(`Nächster startbarer Punkt: ${a.naechster ? zeileVon(a.naechster, 1) : 'keiner'}`)
  aus.push('Rangliste:', ...a.rangliste.map((e, i) => `  ${zeileVon(e, i + 1)}`))
  return aus.join('\n')
}

/** Schlanke Fassung für die Mod: nur, was sie zeigt. */
export function jsonVon(a) {
  const kurz = (e) => ({ nr: e.nr, abschnitt: e.abschnitt, titel: e.titel, ...e.k })
  return { laufend: a.laufend.map(kurz), naechster: a.naechster ? kurz(a.naechster) : null, fehler: a.fehler.map(({ nr, grund }) => ({ nr, grund })) }
}

export function main(argv, jetzt) {
  const wert = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined)
  const a = auswerten(readFileSync(wert('--datei') ?? STAND, 'utf8'), wert('--jetzt') ? Date.parse(wert('--jetzt')) : jetzt)
  console.log(argv.includes('--json') ? JSON.stringify(jsonVon(a)) : text(a))
  return a.fehler.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2), Date.now()))
