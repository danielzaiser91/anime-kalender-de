import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { auslieferbarePatchnotes, pruefePatchnotes } from '../shared/patchnotes.ts'
import { PATCHNOTES_YAML, mitDatum } from './lib/patchnotes.ts'
import { einfuehrungstage, type Fassung } from './lib/patchnotes-datum.ts'

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

const ok = { datum: '2026-10-09', kategorie: 'feature', text: 'Neuer Knopf' }
const gegen = (name: string, eintraege: unknown[]) => pruefe(`Patch-Notes (Gegenprobe): ${name} wird gemeldet`, pruefePatchnotes(eintraege).length > 0)
gegen('ungültiges Datum', [{ ...ok, datum: '2026-13-40' }])
gegen('Datum als YAML-Datum statt Text', [{ ...ok, datum: new Date('2026-10-09') }])
gegen('unbekannte Kategorie', [{ ...ok, kategorie: 'anderes' }])
gegen('neun Wörter', [{ ...ok, text: 'eins zwei drei vier fünf sechs sieben acht neun' }])
gegen('Duplikat', [ok, ok])
gegen('derselbe Text an zwei Tagen (der Text ist der Schlüssel für den Tag)', [ok, { ...ok, datum: '2026-10-10' }])
gegen('altes live-Feld', [{ ...ok, live: true }])
pruefe('Patch-Notes (Gegenprobe): Eintrag ohne datum ist in Ordnung', pruefePatchnotes([{ kategorie: 'bugfix', text: 'Neuer Knopf' }]).length === 0)
gegen('drei Highlights am Tag', [1, 2, 3].map((n) => ({ ...ok, text: `Neu ${n}`, highlight: true })))
gegen('verbotenes Wort (Debug)', [{ ...ok, text: 'Einstellungen ohne Debug-Bereich' }])
gegen('verbotenes Wort (Erweiterung) im Untertitel', [{ ...ok, untertitel: 'Erweiterung 4.24.16' }])
gegen('Link ohne Hash', [{ ...ok, link: 'https://x.de' }])
pruefe('Patch-Notes (Gegenprobe): zwei Highlights am Tag sind erlaubt', pruefePatchnotes([1, 2].map((n) => ({ ...ok, text: `Neu ${n}`, highlight: true }))).length === 0)

const aus = auslieferbarePatchnotes(mitDatum(roh as Record<string, unknown>[], () => new Map()))
pruefe('Patch-Notes: alle Einträge der Datei werden ausgeliefert, neueste zuerst', aus.length === (roh as unknown[]).length && aus.every((e, i) => i === 0 || aus[i - 1]!.datum >= e.datum))
const probe = auslieferbarePatchnotes([
  { datum: '2026-10-08', kategorie: 'bugfix', text: 'B' },
  { datum: '2026-10-08', kategorie: 'feature', text: 'F' },
  { datum: '2026-10-08', kategorie: 'feature', text: 'H', highlight: true },
])
pruefe('Patch-Notes: Highlight vor Feature vor Bugfix', probe.map((e) => e.text).join() === 'H,F,B', probe)

const fassung = (tag: string, ...texte: string[]): Fassung => ({ tag, texte: new Set(texte) })
const verlauf = [fassung('2026-10-12', 'A', 'B', 'C'), fassung('2026-10-11', 'A', 'B'), fassung('2026-10-10', 'A'), fassung('2026-10-09'), fassung('2026-10-08', 'A')]
const tage = einfuehrungstage(verlauf, ['A', 'B', 'C', 'D'])
pruefe('Patch-Notes: Tag = Commit, der den Text eingeführt hat; eine frühere, unterbrochene Strecke zählt nicht', tage.get('A') === '2026-10-10' && tage.get('B') === '2026-10-11' && tage.get('C') === '2026-10-12', [...tage])
pruefe('Patch-Notes: Text, der in der neuesten Fassung fehlt (nicht eingecheckt), bekommt keinen Tag aus der Historie', !tage.has('D'))
const ergaenzt = mitDatum([{ kategorie: 'bugfix', text: 'X' }, { datum: '2026-10-01', kategorie: 'bugfix', text: 'Y' }], (t) => new Map(t.map((x) => [x, '2026-10-11'])))
pruefe('Patch-Notes: fehlendes datum wird ergänzt, ein vorhandenes bleibt', ergaenzt[0]!.datum === '2026-10-11' && ergaenzt[1]!.datum === '2026-10-01', ergaenzt)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
