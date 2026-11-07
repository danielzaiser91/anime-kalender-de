/**
 * Hält die gesammelten Schattenvergleiche gegen die Schwellen (0 Fehlbelege bei mindestens 100 Behauptungen und 7 Tagen, Rest höchstens 15 %).
 * Aufruf: `npx tsx pipeline/anime2you-schatten-auswerten.ts [datei]` (Vorgabe `data/proposals/anime2you-schatten.json`). Exit 0 bei „ja“ und „offen“,
 * 1 bei „nein“ – ein Lesewerkzeug, kein Tor der Kette.
 */
import { readJson } from './lib/util.ts'
import { bilanz, type SchattenBestand } from './lib/anime2you-schatten.ts'

const datei = process.argv[2] ?? 'data/proposals/anime2you-schatten.json'
const bestand = readJson<SchattenBestand>(datei, { laeufe: [] })
const b = bilanz(bestand)
console.log(`Schatten-Bilanz ${datei}: ${b.laeufe} Läufe über ${b.tage} Tage, ${b.behauptungen} Behauptungen (gleich ${b.gleich}, nur Regel = Fehlbelege ${b.fehlbelege}, davon Widerspruch ${b.widersprueche}), nur Claude ${b.nurClaude}, Restquote ${(b.restquote * 100).toFixed(1)} %, Schattenfehler ${b.schattenFehler}, Artikel ohne Antwort ${b.ohneAntwort}, längster Schritt ${Math.round(b.maxMs)} ms`)
console.log(`Router: ${b.routerErspart} von ${b.routerArtikel} Artikeln von der Regel erklärt und ohne Stichprobe (Claude liest sie nicht mehr, sobald der Router scharf ist)`)
for (const l of bestand.laeufe) {
  for (const f of l.faelle.filter((x) => x.seite === 'nurRegel')) console.log(`  Fehlbeleg? ${l.am} Artikel ${f.artikelId}: ${f.titel} / ${f.plattform}${f.widerspruch ? ' (Claude widerspricht)' : ''}`)
}
console.log(`Urteil: ${b.urteil}${b.gruende.length ? ` – ${b.gruende.join('; ')}` : ''}`)
process.exit(b.urteil === 'nein' ? 1 : 0)
