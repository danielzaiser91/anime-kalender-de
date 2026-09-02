#!/usr/bin/env node
/**
 * **„Alles geprüft" ist nur wahr, solange die Liste aktuell ist.**
 *
 * `extension/offene-amazon.js` liegt in der Erweiterung, nicht auf dem Server:
 * Was der Bau hinzufügt, sieht der Browser erst nach einem Neuladen in
 * `chrome://extensions`. Am 02.09.2026 kam „Karakai Jouzu no Takagi-san 2" um
 * 08:53 in die Liste; um 11:16 stand der Titel auf dem Bildschirm, die
 * Statusanzeige zählte ihn als offen — und der Knopf meldete „Prime: alles
 * geprüft". Beide hatten recht, nur aus verschiedenen Ständen, und nichts sagte
 * es.
 *
 * Die Erweiterung vergleicht seit 4.10.3 ihren eingebauten Datenstand gegen
 * `meta.json` der Live-Seite. Diese Prüfung hält die Kette zusammen, die das
 * trägt — sie ist über vier Dateien verteilt, und jede kann für sich richtig
 * aussehen, während die Kette gerissen ist.
 */
const { readFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')

const wurzel = join(__dirname, '..')
const lies = (p) => readFileSync(join(wurzel, p), 'utf8')

let fehler = 0
const pruefe = (bedingung, text) => {
  console.log((bedingung ? '  ok   ' : '  FEHL ') + text)
  if (!bedingung) fehler++
}

console.log('Listenstand der Erweiterung')

/* 1. Die Standdatei gibt es, und sie trägt einen Zeitstempel. */
const standDatei = 'extension/offene-amazon-stand.js'
pruefe(existsSync(join(wurzel, standDatei)), `${standDatei} vorhanden`)
const stand = existsSync(join(wurzel, standDatei)) ? lies(standDatei) : ''
const zeit = stand.match(/"(\d{4}-\d{2}-\d{2}T[^"]+)"/)?.[1] ?? null
pruefe(!!zeit, `trägt einen Zeitstempel (${zeit ?? '—'})`)

/*
  2. Er darf nicht **neuer** sein als der gebaute Datensatz — das wäre unmöglich
     und hieße, dass jemand die Datei von Hand angefasst hat.

  **Gleichheit zu verlangen war falsch, und zwar am selben Tag zum zweiten Mal.**
  Die erste Fassung prüfte `zeit === meta.generatedAt`. Das gilt nur in dem
  Moment, in dem der Erzeuger gerade gelaufen ist — der Deploy prüft aber **vor**
  dem Bau, mit dem committeten Stand, und der stammt aus dem vorigen Lauf. Am
  02.09.2026 um 09:51 stand der Deploy still: meta.json von 09:45, Listenstand
  von 08:53.

  Ein Rückstand ist hier kein Fehler, sondern der Normalzustand zwischen zwei
  Läufen — und genau der Fall, für den der „veraltet"-Hinweis in der Erweiterung
  gebaut ist. Sie vergleicht ohnehin gegen die **Live-Seite**, nicht gegen diese
  Datei.

  Dieselbe Lehre wie bei der Rohfolgen-Zusicherung drei Stunden vorher: Eine
  Prüfung, die am Tagesstand hängt, wird rot, weil die Welt weitergelaufen ist,
  nicht weil etwas kaputt ist (CLAUDE.md, 25.08.2026).
*/
const meta = JSON.parse(lies('public/data/meta.json'))
pruefe(
  !zeit || !meta.generatedAt || Date.parse(zeit) <= Date.parse(meta.generatedAt),
  `ist nicht neuer als meta.json (${meta.generatedAt})`,
)

/*
  3. Die Prüfliste selbst bleibt unberührt: genau eine Zuweisung, und der Rest
     parst als JSON. Der erste Versuch schrieb den Stand als zweite Zeile dort
     hinein und brach drei Leser — die Zusicherung der Übersicht, `fetch-pruefungen.ts`
     und `report-start.ts` schneiden alle auf ihre eigene Weise.
*/
const liste = lies('extension/offene-amazon.js')
pruefe(
  (liste.match(/globalThis\./g) ?? []).length === 1,
  'die Prüfliste enthält genau eine Zuweisung',
)
let geladen = null
try {
  geladen = JSON.parse(liste.replace(/^globalThis\.AK_OFFENE_AMAZON = /, '').replace(/;?\s*$/, ''))
} catch {
  geladen = null
}
pruefe(geladen !== null && typeof geladen === 'object', 'die Prüfliste parst als JSON')

/* 4. Das Manifest lädt die Standdatei — sonst ist die Variable im Browser nie gesetzt. */
const manifest = JSON.parse(lies('extension/manifest.json'))
const geladenIm = (manifest.content_scripts ?? []).some(
  (b) => Array.isArray(b.js) && b.js.includes('offene-amazon-stand.js') && b.js.includes('amazon.js'),
)
pruefe(geladenIm, 'das Manifest lädt sie zusammen mit amazon.js')

/* 5. Und die Erweiterung liest sie auch wirklich. */
const code = lies('extension/amazon.js')
pruefe(code.includes('AK_OFFENE_AMAZON_STAND'), 'amazon.js liest den Stand')
pruefe(
  code.includes('anime-kalender.de/data/meta.json'),
  'amazon.js hält ihn gegen meta.json der Live-Seite',
)
pruefe(
  manifest.host_permissions?.some((h) => h.includes('anime-kalender.de')),
  'das Manifest erlaubt den Abruf von anime-kalender.de',
)
pruefe(code.includes('listeVeraltet'), 'der Befund erreicht die Anzeige')

console.log(fehler ? `\n${fehler} Fehler` : '\nalles grün')
process.exit(fehler ? 1 : 0)
