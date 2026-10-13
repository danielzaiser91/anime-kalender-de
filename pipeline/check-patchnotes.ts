import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
pruefe('Patch-Notes (Gegenprobe): drei Highlights ohne datum (Tage erst nach dem Git-Abgleich bekannt) sind noch kein Widerspruch', pruefePatchnotes([1, 2, 3].map((n) => ({ kategorie: 'feature', text: `Neu ${n}`, highlight: true }))).length === 0)
pruefe('Patch-Notes (Gegenprobe): zwei Highlights am Tag sind erlaubt', pruefePatchnotes([1, 2].map((n) => ({ ...ok, text: `Neu ${n}`, highlight: true }))).length === 0)

/**
 * Drei Highlights ohne `datum` landen nach der Datumsauflösung am selben Tag: `leseAuslieferbarePatchnotes` muss abbrechen.
 * Ein Kindprozess, weil der Zweig `process.exit(1)` ruft; ohne den Zweig liefe der Aufruf durch (Exit 0).
 */
function leseMitDreiHighlights(): { status: number | null; aus: string } {
  const ordner = mkdtempSync(`${tmpdir()}/patchnotes-highlights-`)
  try {
    for (const n of [1, 2, 3]) writeFileSync(`${ordner}/h${n}.yaml`, `kategorie: feature\ntext: Neu ${n}\nhighlight: true\n`)
    const modul = new URL('./lib/patchnotes.ts', import.meta.url).href
    const code = `import { leseAuslieferbarePatchnotes } from ${JSON.stringify(modul)}\nleseAuslieferbarePatchnotes(${JSON.stringify(ordner)})`
    const r = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', code], { encoding: 'utf8', timeout: 60_000 })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
const dreiHighlights = leseMitDreiHighlights()
pruefe('Patch-Notes (Gegenprobe): drei datumslose Highlights, die am selben Tag landen, brechen das Lesen ab', dreiHighlights.status === 1 && dreiHighlights.aus.includes('3 Highlights'), dreiHighlights)

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
const langProbe = pruefePatchnotes([{ ...ok, text: 'eins zwei drei vier fünf sechs sieben acht neun zehn elf' }], ['langer-eintrag'])
pruefe('Patch-Notes: zu langer Text meldet gezählte Wörter und Grenze („11 Wörter, höchstens 8“)', langProbe.some((m) => m.includes('11 Wörter, höchstens 8')), langProbe)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
