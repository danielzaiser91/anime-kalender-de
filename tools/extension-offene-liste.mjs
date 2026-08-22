/**
 * Die Liste der Netflix-Titel, bei denen eine Prüfung noch etwas bringt.
 *
 * Ohne sie meldete die Erweiterung **jede** Netflix-Seite: Am 22.08.2026 kam
 * ein Befund zu „Heroes" an, während Daniel dort einfach eine Serie sah. Sein
 * Urteil: „die extension stört beim gucken und will ich da nicht sehen."
 *
 * Aufgenommen wird nur, wo die Antwort fehlt — ein Titel, dessen Synchro schon
 * belegt ist, braucht keinen Knopf mehr.
 *
 * Je Adresse steht dabei, **welche Folgen** sich lohnen. Denn eine Netflix-Seite
 * bedient oft mehrere unserer Staffeln: „My Hero Academia" führt sieben unter
 * einer Adresse. Wer dort nur die erste Folge prüft, weiß nichts über Staffel 7
 * — und genau dort hört die deutsche Fassung auf (Daniel, 22.08.2026).
 *
 * Empfohlen werden **erste und letzte Folge je Staffel**: Sind beide gleich,
 * ist die Staffel einheitlich; weichen sie ab, liegt die Grenze dazwischen und
 * wird gesucht.
 *
 * Aufruf: node tools/extension-offene-liste.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const titel = Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))

/** Die Kennung aus einer Netflix-Adresse — `/title/70302573` → `70302573`. */
function kennung(url) {
  return /\/title\/(\d+)/.exec(url)?.[1]
}

/** Reihenfolge der Staffeln: japanische Erstausstrahlung, nicht AniList-Kennung. */
const JAHRESZEIT = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
function vergleiche(a, b) {
  return (a.jpYear ?? 0) - (b.jpYear ?? 0) || (JAHRESZEIT[a.jpSeason] ?? 0) - (JAHRESZEIT[b.jpSeason] ?? 0)
}

/** Alle unsere Einträge je Netflix-Adresse — auch die schon beantworteten. */
const jeAdresse = new Map()
for (const t of titel) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'netflix') continue
    const id = kennung(s.url)
    if (!id) continue
    jeAdresse.set(id, [...(jeAdresse.get(id) ?? []), { t, dub: s.dub }])
  }
}

const offen = {}
for (const [id, eintraege] of jeAdresse) {
  // Eine Adresse kommt auf die Liste, sobald **eine** ihrer Staffeln offen ist.
  if (!eintraege.some((e) => e.dub === undefined)) continue
  const sortiert = [...eintraege].sort((a, b) => vergleiche(a.t, b.t))
  offen[id] = {
    titel: sortiert[0].t.titleDe ?? sortiert[0].t.titleEn ?? sortiert[0].t.titleRomaji ?? '',
    staffeln: sortiert.map((e, i) => ({
      nr: i + 1,
      name: e.t.titleDe ?? e.t.titleEn ?? e.t.titleRomaji ?? '',
      folgen: e.t.episodes ?? 0,
      // Was hier schon beantwortet ist, muss niemand mehr anklicken.
      offen: e.dub === undefined,
    })),
  }
}

const ziel = resolve(wurzel, 'extension/offene-netflix.js')
/**
 * Als Skript, nicht als JSON.
 *
 * Der Weg über `fetch(chrome.runtime.getURL(…))` scheiterte an Netflix'
 * Sicherheitsregeln: Die Seite lässt keine Abrufe auf `chrome-extension://` zu,
 * und die Erweiterung blieb stumm — kein Knopf, keine Meldung (Daniel,
 * 22.08.2026, mit Bild von netflix.com/browse).
 *
 * Ein Content-Script wird dagegen vom Browser selbst geladen, bevor die Seite
 * etwas dazu sagen kann. Daran kommt keine Regel der Seite heran.
 */
writeFileSync(ziel, 'globalThis.AK_OFFENE_TITEL = ' + JSON.stringify(offen) + '\n')
const staffeln = Object.values(offen).reduce((n, o) => n + o.staffeln.filter((s) => s.offen).length, 0)
console.log(`${Object.keys(offen).length} Netflix-Adressen mit ${staffeln} offenen Staffeln`)
