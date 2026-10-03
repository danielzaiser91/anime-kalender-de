/**
 * Wachhund für die Beleg-Lesungen (`data/beleg-lesungen.json`) und ihre Domains (`data/beleg-domains.json`).
 *
 * Rot wird er bei:
 * - **jedem** Wechsel des Hashs ohne Wechsel eines Datums (Veröffentlicht, Aktualisiert, Ausgabe): Das
 *   darf nie vorkommen, es heißt, dass Unwesentliches (Empfehlungen, Zähler) den Hash ändert und jede
 *   Lesung ein neues Bild erzeugt. Jeder Fall wird untersucht (Daniel, 03.10.2026);
 * - einer Lesung ohne Bild (Ablage nicht erreichbar oder Zustimmungswand);
 * - gleichem Text mit neuem Bild;
 * - einer Produktseite mit Veröffentlichungsdatum (ihr Datum ist der Erscheinungstag der Ausgabe);
 * - einer gelesenen Domain, die nicht in der Prüfliste steht oder noch nicht von Hand geprüft ist.
 *
 * Aufruf: node tools/belege-pruefen.mjs   (Exit 1 bei Verstoß)
 */
import { readFileSync } from 'node:fs'

const g = JSON.parse(readFileSync('data/beleg-lesungen.json', 'utf8'))
const domains = JSON.parse(readFileSync('data/beleg-domains.json', 'utf8'))
const urls = Object.keys(g)
const fehler = []
let lesungen = 0
let mehrfach = 0
let ohneDatum = 0
for (const url of urls) {
  const l = g[url].lesungen
  lesungen += l.length
  if (l.length > 1) mehrfach++
  for (let i = 1; i < l.length; i++) {
    const [a, b] = [l[i - 1], l[i]]
    if (b.hash !== a.hash && a.veroeffentlicht === b.veroeffentlicht && a.aktualisiert === b.aktualisiert && a.ausgabe === b.ausgabe) {
      ohneDatum++
      fehler.push(`${url} ${b.am}: Text geändert, Daten gleich — untersuchen`)
    }
    if (b.hash === a.hash && b.bild && b.bild !== a.bild) fehler.push(`${url} ${b.am}: gleicher Text, neues Bild`)
  }
  for (const e of l) {
    if (!e.bild) fehler.push(`${url} ${e.am}: Lesung ohne Bild`)
    if (/anisearch\.de\/article\//.test(url) && e.veroeffentlicht) fehler.push(`${url}: Produktseite mit Veröffentlichungsdatum`)
  }
  const host = new URL(url).hostname
  if (!domains[host]) fehler.push(`${host}: gelesen, aber nicht in data/beleg-domains.json — erst von Hand prüfen`)
}
for (const [host, d] of Object.entries(domains))
  if (!host.startsWith('_') && urls.some((u) => new URL(u).hostname === host) && !d.geprueft) fehler.push(`${host}: wird gelesen, aber noch nicht von Hand geprüft (${d.beleg})`)
console.log(`${urls.length} Adressen, ${lesungen} Lesungen, ${mehrfach} mit mehr als einer, ${ohneDatum} Wechsel ohne Datumsänderung`)
for (const f of [...new Set(fehler)]) console.log('✗', f)
console.log(fehler.length ? `${fehler.length} Verstöße` : 'in Ordnung')
process.exit(fehler.length ? 1 : 0)
