/**
 * Prüfung eines eigenen Handlungstextes gegen die Faktenkarte seines Titels (`tools/handlung-fakten.ts`):
 *  1. Wortnähe: ein gemeinsamer 5-Wort-Abschnitt mit einer Quelle ist ein Fehler, der Text geht zurück an den Schreiber.
 *  2. Zahlen: jede Zahl im Text (Ziffern oder „zwölf“) muss in der Karte oder einem Quelltext stehen; eine Folgenzahl, der eine Quelle widerspricht, darf nicht stehen.
 *  3. Wertung: Wörter wie „Kritiker“, „gelobt“, „laut“ gehören nicht in den Text (nur Fakten aus Quellen mit genannter Lizenz).
 *
 *   npx tsx tools/handlung-naehe.ts <titelId> <textdatei>      ein Text
 *   npx tsx tools/handlung-naehe.ts --ordner <ordner>          jede Datei `<titelId>.txt` im Ordner
 *   Zusatz --streng                                            Exit 1, wenn ein Text durchfällt (sonst immer Exit 0, Messlauf)
 *
 * Die Spalten: 5er/4er/3er = Zahl der gemeinsamen Wortfolgen dieser Länge, „längste“ = längste gemeinsame Folge in Wörtern.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { leseKarte, leseKartenMarkdown, leseQuelltexte } from './handlung-fakten/ablage.ts'
import { istBestanden, vergleiche, woerter } from './handlung-fakten/naehe.ts'
import { saetze } from './handlung-fakten/wikitext.ts'
import { enthaeltWertung, unbelegteZahlen, zahlenIn } from './handlung-fakten/zahlen.ts'

/** Meldungen zu Zahlen und Wertung; leer, wenn alles in Ordnung ist. */
function inhaltsProbleme(id: number, text: string, belege: string[]): string[] {
  const probleme: string[] = []
  const frei = unbelegteZahlen(text, [...belege, leseKartenMarkdown(id)])
  if (frei.length) probleme.push(`Zahl ohne Beleg in Karte oder Quellen: ${frei.join(', ')}`)
  const w = leseKarte(id).folgenWiderspruch
  if (w && zahlenIn(text).has(String(w.katalog))) {
    probleme.push(`Zahl ${w.katalog} widerspricht ${w.quellen.map((q) => `${q.name} (${q.wert})`).join(', ')}: weglassen oder die belegende Quelle nennen`)
  }
  for (const s of saetze(text).filter(enthaeltWertung)) probleme.push(`Wertung im Text: „${s.slice(0, 70)}“`)
  return probleme
}

function messe(id: number, text: string): boolean {
  const quellen = leseQuelltexte(id)
  const zeilen = quellen.map((q) => vergleiche(text, q))
  const probleme = inhaltsProbleme(id, text, quellen.map((q) => q.text))
  const ok = istBestanden(zeilen) && probleme.length === 0
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${id} (${woerter(text).length} Wörter, ${zeilen.length} Quelltexte)`)
  for (const z of zeilen) console.log(`    ${z.quelle}: 5er=${z.gemeinsam5} 4er=${z.gemeinsam4} 3er=${z.gemeinsam3} längste=${z.laengste} „${z.folge}“`)
  for (const p of probleme) console.log(`    PRÜFEN ${p}`)
  return ok
}

function texte(): [number, string][] {
  const i = process.argv.indexOf('--ordner')
  if (i < 0) return [[Number(process.argv[2]), readFileSync(process.argv[3]!, 'utf8')]]
  const ordner = process.argv[i + 1]!
  return readdirSync(ordner)
    .filter((f) => /^\d+\.txt$/.test(f))
    .map((f): [number, string] => [Number(f.replace('.txt', '')), readFileSync(join(ordner, f), 'utf8')])
}

const ergebnisse = texte().map(([id, text]) => messe(id, text))
const durchgefallen = ergebnisse.filter((ok) => !ok).length
console.log(`${ergebnisse.length - durchgefallen} von ${ergebnisse.length} bestanden`)
const exitCode = durchgefallen > 0 && process.argv.includes('--streng') ? 1 : 0
console.log(`ENDE ${exitCode}`)
process.exit(exitCode)
