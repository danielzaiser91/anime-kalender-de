/**
 * **Einen Vorschlag des Sammlers freigeben** → Handeintrag in `data/offizielle-meldungen.yaml`.
 *
 * Aufruf: `npx tsx pipeline/offizielle-freigabe.ts <id> --kategorie staffel|film|synchro|termin [--titel <AniList-Kennung>] --freigabe "Name, TT.MM.JJJJ" [--trocken]`
 *
 * Tag, Adresse, Überschrift und Sprache kommen wörtlich aus dem Vorschlag (`data/proposals/offizielle-news.json`); Kategorie und Freigabe setzt der Mensch, die Kachel
 * (`--titel`) nur, wo die Seite mehrere Titel trägt. Vorher prüfen: Ist die Seite offiziell für genau diesen Titel, und sagt die Überschrift wirklich, was die Kategorie behauptet?
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, readJson } from './lib/util.ts'
import { OFFIZIELL_DATEI, offizielleLaden } from './lib/news-offiziell.ts'
import { eintragAusVorschlag, eintragText, kategorienText, type Vorschlag } from './lib/news-offiziell-freigabe.ts'

const wert = (name: string): string | undefined => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined)

const id = process.argv[2]
const vorschlaege = readJson<{ vorschlaege: Vorschlag[] }>('data/proposals/offizielle-news.json', { vorschlaege: [] }).vorschlaege
const vorschlag = vorschlaege.find((v) => v.id === id)
if (!id || !vorschlag) {
  console.error(`Vorschlag ${id ?? '(keine Kennung)'} nicht gefunden. Aufruf: <id> --kategorie ${kategorienText()} --freigabe "Name, TT.MM.JJJJ" [--titel <Kennung>]`)
  process.exit(1)
}
const titel = wert('--titel')
const bekannt = new Set(offizielleLaden(ROOT).map((e) => e.id))
const eintrag = eintragAusVorschlag(vorschlag, { kategorie: wert('--kategorie'), titleId: titel ? Number(titel) : undefined, freigabe: wert('--freigabe') }, bekannt)
const text = eintragText(eintrag)
console.log(text)
if (!process.argv.includes('--trocken')) {
  const datei = resolve(ROOT, OFFIZIELL_DATEI)
  appendFileSync(datei, readFileSync(datei, 'utf8').endsWith('\n') ? text : `\n${text}`, 'utf8')
  console.log(`Angehängt an ${OFFIZIELL_DATEI}.`)
}
