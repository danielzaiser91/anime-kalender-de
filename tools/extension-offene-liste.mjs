/**
 * Die Liste der Netflix-Titel, bei denen eine Prüfung noch etwas bringt.
 *
 * Ohne sie meldete die Erweiterung **jede** Netflix-Seite: Am 22.08.2026 kam
 * ein Befund zu „Heroes" an, während Daniel dort einfach eine Serie sah. Sein
 * Urteil: „die extension stört beim gucken und will ich da nicht sehen."
 *
 * Aufgenommen wird nur, wo die Antwort fehlt — ein Titel, dessen Synchro schon
 * belegt ist, braucht keinen Knopf mehr. Alles andere bleibt still: kein Knopf,
 * keine Meldung, kein Eingriff in die Seite.
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

const offen = new Map()
for (const t of titel) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'netflix' || s.dub !== undefined) continue
    const id = kennung(s.url)
    if (!id) continue
    // Mehrere unserer Einträge teilen sich oft eine Adresse. Der Name dient nur
    // der Anzeige im Knopf, deshalb genügt der erste.
    if (!offen.has(id)) offen.set(id, t.titleDe ?? t.titleEn ?? t.titleRomaji ?? '')
  }
}

const ziel = resolve(wurzel, 'extension/offene-netflix.json')
writeFileSync(ziel, JSON.stringify(Object.fromEntries([...offen].sort()), null, 0) + '\n')
console.log(`${offen.size} offene Netflix-Titel nach extension/offene-netflix.json`)
