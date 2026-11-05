/**
 * Wächter: kein toter Anker in irgendeiner Mutationsliste (tools/mutationen/*.json), nicht nur in den Listen des Diffs.
 * Läuft über tests-alle in jedem PR auf dem Merge-Ref, sieht also Rennen paralleler PRs (#2817/#2822, 05.11.2026).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

// Exit-Code von `--alle` als eigener Prozess in einem Wegwerf-Repo (cwd = Wegwerf-Ordner, Listen relativ dazu).
const skript = fileURLToPath(new URL('./mutationsanker.mjs', import.meta.url))
function alleImWegwerfRepo(listenInhalt) {
  const wurzel = mkdtempSync(join(tmpdir(), 'mutationsanker-'))
  try {
    mkdirSync(join(wurzel, 'tools', 'mutationen'), { recursive: true })
    writeFileSync(join(wurzel, 'a.ts'), 'eins zwei\n')
    for (const [name, inhalt] of Object.entries(listenInhalt)) writeFileSync(join(wurzel, 'tools', 'mutationen', name), JSON.stringify(inhalt))
    const r = spawnSync(process.execPath, [skript, '--alle'], { cwd: wurzel, encoding: 'utf8', timeout: 30000, windowsHide: true })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}
const lebend = [{ name: 'ok', datei: 'a.ts', suche: 'zwei', ersetze: 'X' }]
const toterAnker = [{ name: 'weg', datei: 'a.ts', suche: 'verschwunden', ersetze: 'X' }]
const sauber = alleImWegwerfRepo({ 'gut.json': lebend })
pruefe('--alle sauber: Exit 0 und Schlusszeile', sauber.status === 0 && sauber.aus.includes('Mutationsanker (alle): 1 Listen, 1 Mutanten, 0 Anker nicht auffindbar'))
const kaputt = alleImWegwerfRepo({ 'gut.json': lebend, 'alt.json': toterAnker })
pruefe('--alle mit totem Anker: Exit 1, Schlusszeile und Fehlerzeile', kaputt.status === 1 && kaputt.aus.includes('2 Listen, 2 Mutanten, 1 Anker nicht auffindbar') && kaputt.aus.includes('„weg“'))

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
