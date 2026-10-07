/**
 * Gegenprobe des Datensatzes gegen die Dub-Liste von aniSearch (`data/anisearch-dubs.json`, Kennzeichen `d` vertont, `p` geplant, `c` abgebrochen,
 * `-` nicht genannt). Liest die veröffentlichte Seite, schreibt nichts.
 *
 * A) Hauptbestand, aniSearch nennt kein Deutsch und wir haben keinen eigenen Beleg → Kandidaten für eine falsche Synchro-Behauptung.
 * B) Hinter dem Toggle, aber aniSearch nennt `d` oder `c` → fehlen im Hauptbestand (der Tageslauf holt sie über `ausAnisearchDubs` nach).
 *
 * Aufruf: node tools/dub-abgleich.mjs
 */
import { readFileSync } from 'node:fs'
const W = new URL('../', import.meta.url)
const dubs = JSON.parse(readFileSync(new URL('data/anisearch-dubs.json', W), 'utf8'))
const lad = async (f) => {
  const j = await (await fetch(`https://anime-kalender.de/data/${f}?x=${Date.now()}`)).json()
  return Array.isArray(j) ? j : j.titles
}
const haupt = await lad('titles.json')
const hinter = await lad('ohne-synchro.json')
const kenn = (t) => dubs[String(t.id)] ?? '?'
const hatBeleg = (t) => (t.streams ?? []).some((s) => s.dub === true) || t.deErstausgabe?.synchro || t.hasVoices
const zaehle = (a) => a.reduce((m, t) => ((m[kenn(t)] = (m[kenn(t)] ?? 0) + 1), m), {})
const name = (t) => t.titleEn ?? t.titleRomaji
console.log('Hauptbestand nach Kennzeichen:', zaehle(haupt))
console.log('Hinter dem Toggle nach Kennzeichen:', zaehle(hinter))
const a = haupt.filter((t) => kenn(t) === '-' && !hatBeleg(t))
const b = hinter.filter((t) => ['d', 'c'].includes(kenn(t)))
console.log(`A) ${a.length}:`, a.map(name).join(' | '))
console.log(`B) ${b.length}:`, b.slice(0, 40).map((t) => `${name(t)} [${kenn(t)}]`).join(' | '))
