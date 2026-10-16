/** Bestandsprüfung der aniSearch-Kennung in den Prüflisten der Erweiterung — Logik und Anlass in tools/pruefliste-asid.mjs. */
import { pruefeAsId } from './pruefliste-asid.mjs'

const fehler = pruefeAsId('.')
for (const f of fehler) console.error(`FEHLER: ${f}`)
if (fehler.length > 0) process.exit(1)
console.log('pruefliste-asid-bestand: ok')
