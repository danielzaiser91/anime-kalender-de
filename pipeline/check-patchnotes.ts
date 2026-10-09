import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { auslieferbarePatchnotes, pruefePatchnotes } from '../shared/patchnotes.ts'
import { PATCHNOTES_YAML } from './lib/patchnotes.ts'

/** Zusicherung für `data/patchnotes.yaml` und die Auslieferung; reale Fehlerfälle als Gegenproben. */
let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const roh = yaml.load(readFileSync(PATCHNOTES_YAML, 'utf8'), { schema: yaml.JSON_SCHEMA })
const f = pruefePatchnotes(roh)
pruefe('Patch-Notes: Datum parsebar, Kategorie gültig, Text ≤ 8 Wörter, keine Duplikate, höchstens 2 Highlights je Tag', f.length === 0, f)

const ok = { datum: '2026-10-09', kategorie: 'feature', text: 'Neuer Knopf', live: true }
const gegen = (name: string, eintraege: unknown[]) => pruefe(`Patch-Notes (Gegenprobe): ${name} wird gemeldet`, pruefePatchnotes(eintraege).length > 0)
gegen('ungültiges Datum', [{ ...ok, datum: '2026-13-40' }])
gegen('Datum als YAML-Datum statt Text', [{ ...ok, datum: new Date('2026-10-09') }])
gegen('unbekannte Kategorie', [{ ...ok, kategorie: 'anderes' }])
gegen('neun Wörter', [{ ...ok, text: 'eins zwei drei vier fünf sechs sieben acht neun' }])
gegen('Duplikat', [ok, ok])
gegen('drei Highlights am Tag', [1, 2, 3].map((n) => ({ ...ok, text: `Neu ${n}`, highlight: true })))
gegen('Link ohne Hash', [{ ...ok, link: 'https://x.de' }])
pruefe('Patch-Notes (Gegenprobe): zwei Highlights am Tag sind erlaubt', pruefePatchnotes([1, 2].map((n) => ({ ...ok, text: `Neu ${n}`, highlight: true }))).length === 0)

const aus = auslieferbarePatchnotes(roh as Record<string, unknown>[])
pruefe('Patch-Notes: ausgeliefert wird nur live, neueste zuerst', aus.length > 0 && aus.every((e, i) => i === 0 || aus[i - 1]!.datum >= e.datum))
const probe = auslieferbarePatchnotes([
  { datum: '2026-10-08', kategorie: 'bugfix', text: 'B', live: true },
  { datum: '2026-10-08', kategorie: 'feature', text: 'F', live: true },
  { datum: '2026-10-08', kategorie: 'feature', text: 'H', highlight: true, live: true },
  { datum: '2026-10-09', kategorie: 'feature', text: 'noch nicht', live: false },
])
pruefe('Patch-Notes: Highlight vor Feature vor Bugfix, nicht-live fehlt', probe.map((e) => e.text).join() === 'H,F,B', probe)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
