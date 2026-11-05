/**
 * Wächter: kein toter Anker in irgendeiner Mutationsliste (tools/mutationen/*.json), nicht nur in den Listen des Diffs.
 * Läuft über tests-alle in jedem PR auf dem Merge-Ref, sieht also Rennen paralleler PRs (#2817/#2822, 05.11.2026).
 */
import { listenAufPlatte, pruefeListen } from './mutationsanker.mjs'

const fehler = []
const pruefe = (name, ok) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}`)
}

// Fallliste mit Attrappe-Dateisystem: ein toter und ein lebender Anker in verschiedenen Listen.
const dateien = { 'a.ts': 'eins zwei\n', 'tools/mutationen/gut.json': JSON.stringify([{ datei: 'a.ts', suche: 'zwei', ersetze: 'X' }]) }
const tot = { ...dateien, 'tools/mutationen/alt.json': JSON.stringify([{ name: 'weg', datei: 'a.ts', suche: 'verschwunden', ersetze: 'X' }]) }
const gelesen = (d) => (p) => d[p] ?? null
pruefe('lebende Liste: keine Fehler', pruefeListen(['tools/mutationen/gut.json'], gelesen(dateien)).fehler.length === 0)
pruefe('tote Liste neben lebender: genau ein Fehler', pruefeListen(['tools/mutationen/gut.json', 'tools/mutationen/alt.json'], gelesen(tot)).fehler.length === 1)

const listen = listenAufPlatte()
pruefe('Listenordner gefunden (mehr als 0 Listen)', listen.length > 0)
const echt = pruefeListen(listen)
for (const f of echt.fehler) console.error(`  ✖ ${f}`)
pruefe(`alle ${listen.length} Listen, ${echt.anzahl} Mutanten: kein toter Anker`, echt.fehler.length === 0)

if (fehler.length) {
  console.error(`✗ mutationsanker-alle: ${fehler.length} Fälle rot`)
  process.exit(1)
}
console.log(`✓ mutationsanker-alle: ${listen.length} Listen, ${echt.anzahl} Mutanten, 0 tote Anker`)
