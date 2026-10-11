import { auslieferbarePatchnotes, pruefePatchnotes } from '../shared/patchnotes.ts'
import { lesePatchnotesDateien, mitDatum } from './lib/patchnotes.ts'
import { einfuehrungstage, hinzufuegungenAusLog } from './lib/patchnotes-datum.ts'

/** Zusicherung für `data/patchnotes/` und die Auslieferung; reale Fehlerfälle als Gegenproben. */
let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const dateien = lesePatchnotesDateien()
const roh = dateien.map((d) => d.eintrag)
const f = pruefePatchnotes(roh, dateien.map((d) => d.name))
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

const aus = auslieferbarePatchnotes(mitDatum(dateien, (namen) => new Map(namen.map((n) => [n, '2026-10-10']))))
pruefe('Patch-Notes: alle Einträge des Ordners werden ausgeliefert, neueste zuerst', aus.length === roh.length && aus.every((e, i) => i === 0 || aus[i - 1]!.datum >= e.datum))
const probe = auslieferbarePatchnotes([
  { datum: '2026-10-08', kategorie: 'bugfix', text: 'B' },
  { datum: '2026-10-08', kategorie: 'feature', text: 'F' },
  { datum: '2026-10-08', kategorie: 'feature', text: 'H', highlight: true },
])
pruefe('Patch-Notes: Highlight vor Feature vor Bugfix', probe.map((e) => e.text).join() === 'H,F,B', probe)

// 1750032000 = 2025-06-16 00:00 UTC, 1750118400 = ein Tag später; die neueste Hinzufügung steht oben wie im git log.
const log = '@1750118400\ndata/patchnotes/b.yaml\ndata/patchnotes/c.yaml\n\n@1750032000\ndata/patchnotes/a.yaml\ndata/patchnotes/b.yaml\n'
const hinzu = hinzufuegungenAusLog(log)
pruefe('Patch-Notes: git-Log wird in Dateiname und Berliner Tag zerlegt', hinzu.length === 4 && hinzu[0]!.name === 'b' && hinzu[0]!.tag === '2025-06-17' && hinzu[3]!.tag === '2025-06-16', hinzu)
const tage = einfuehrungstage(hinzu, ['a', 'b', 'c', 'd'])
pruefe('Patch-Notes: Tag = Commit, der die Datei angelegt hat; bei erneutem Anlegen zählt das neueste', tage.get('a') === '2025-06-16' && tage.get('b') === '2025-06-17' && tage.get('c') === '2025-06-17', [...tage])
pruefe('Patch-Notes: eine Datei, die nicht in der Historie steht (nicht eingecheckt), bekommt dort keinen Tag', !tage.has('d'))
const ergaenzt = mitDatum(
  [{ name: 'x', eintrag: { kategorie: 'bugfix', text: 'X' } }, { name: 'y', eintrag: { datum: '2026-10-01', kategorie: 'bugfix', text: 'Y' } }],
  (namen) => new Map(namen.map((n) => [n, '2026-10-11'])),
)
pruefe('Patch-Notes: fehlendes datum wird ergänzt, ein vorhandenes bleibt', ergaenzt[0]!.datum === '2026-10-11' && ergaenzt[1]!.datum === '2026-10-01', ergaenzt)
const namensProbe = pruefePatchnotes([{ ...ok, kategorie: 'anderes' }], ['mein-eintrag'])
pruefe('Patch-Notes: Meldungen nennen den Dateinamen', namensProbe.some((m) => m.startsWith('mein-eintrag:')), namensProbe)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
