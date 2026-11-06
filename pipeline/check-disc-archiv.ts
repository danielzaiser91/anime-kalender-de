/**
 * Ratsche „Archiv führt eine deutsche Disc, der Titel zeigt keinen Disc-Verweis": Rechenregel (`archivBilanz`, `titelMitDiscVerweis`)
 * und der Bestandswächter als eigener Prozess gegen einen Wegwerf-Ordner (`AK_ROOT`) mit einer Archivseite, die zwei Titel trägt.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { archivBilanz, titelMitDiscVerweis, type ArchivStand } from './lib/disc-archiv-luecke.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const stand = (ids: number[], hoechstens = ids.length): ArchivStand => ({ stand: '2026-11-06', hoechstens, ids })

console.log('\nVerweis:')
const mit = titelMitDiscVerweis(
  [
    { id: 1, watchLinks: [{ kind: 'buy' }] },
    { id: 2, watchLinks: [{ kind: 'stream' }] },
    { id: 3 },
    { id: 4, watchLinks: [{ kind: 'stream' }, { kind: 'buy' }] },
  ],
  [
    { titleId: 5, releaseType: 'disc' },
    { titleId: 6, releaseType: 'weekly' },
  ],
)
pruefe('Kauflink oder Disc-Termin zählt, Stream und Wochentermin nicht', [...mit].sort().join() === '1,4,5', [...mit])

console.log('\nBilanz:')
const b1 = archivBilanz([10, 11], new Set([1]), stand([10, 11]))
pruefe('zwei offene, beide im Stand: nichts neu', b1.anzahl === 2 && !b1.neu.length && !b1.erledigt.length && !b1.ueberGrenze, b1)
const b2 = archivBilanz([10, 11], new Set([1]), stand([10]))
pruefe('ein offener Titel außerhalb des Standes ist neu (genau 1)', b2.neu.join() === '11' && b2.ueberGrenze, b2)
const b3 = archivBilanz([10], new Set([10]), stand([10, 12]))
pruefe('Titel mit Verweis fällt heraus, Stand-Kennungen ohne Archiv sind erledigt', b3.anzahl === 0 && b3.erledigt.join() === '10,12' && !b3.ueberGrenze, b3)
pruefe('über der Grenze, obwohl alle Kennungen bekannt', archivBilanz([10, 11], new Set(), stand([10, 11], 1)).ueberGrenze)
pruefe('genau an der Grenze ist nicht darüber', !archivBilanz([10], new Set(), stand([10], 1)).ueberGrenze)
pruefe('dieselbe Kennung auf zwei Seiten zählt einmal', archivBilanz([10, 10], new Set(), stand([10])).anzahl === 1)
pruefe('leerer Bestand', archivBilanz([], new Set(), stand([])).anzahl === 0)

console.log('\nBestandswächter als Prozess:')
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const skript = join(wurzel, 'pipeline/check-disc-archiv-bestand.ts')
const seite = (titel: string, rank = '<div class="rank">Blu-ray</div>') =>
  `<html><section id="items"><ul><li class="merch1" data-date="2024-01-01">${rank}<span class="title">${titel}</span><a data-href="article/900091,x">x</a></li></ul></section></html>`
function lauf(titles: unknown[], releases: unknown[], standInhalt: unknown): { code: number | null; ausgabe: string } {
  const w = mkdtempSync(join(tmpdir(), 'disc-archiv-'))
  const schreibe = (teile: string[], inhalt: string | Buffer) => {
    mkdirSync(dirname(join(w, ...teile)), { recursive: true })
    writeFileSync(join(w, ...teile), inhalt)
  }
  try {
    schreibe(['data', 'anisearch-raw', '7777.html.gz'], gzipSync(seite('Probe - Komplettset [Blu-ray]')))
    schreibe(['data', 'anisearch-raw', '7778.html.gz'], gzipSync(seite('Probe - Bd. 1', '')))
    schreibe(['data', 'anisearch.json'], '{}')
    schreibe(['public', 'data', 'titles.json'], JSON.stringify(titles))
    schreibe(['public', 'data', 'releases.json'], JSON.stringify(releases))
    if (standInhalt !== undefined) schreibe(['data', 'disc-archiv-stand.json'], JSON.stringify(standInhalt))
    const r = spawnSync(process.execPath, ['--import', 'tsx', skript], { cwd: wurzel, env: { ...process.env, AK_ROOT: w }, encoding: 'utf8', timeout: 60_000, windowsHide: true })
    return { code: r.status, ausgabe: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(w, { recursive: true, force: true })
  }
}
const sieben = { id: 900071, anisearchId: 7777, titleEn: 'Probe' }
const geteilt = { id: 900072, anisearchId: 7777, titleEn: 'Probe 2' }
const leerSeite = { id: 900073, anisearchId: 7778, titleEn: 'Ohne Ausgaben' }
const ruhig = lauf([sieben, geteilt, leerSeite], [], stand([900071, 900072]))
pruefe('Stand eingehalten: Exit 0, Zählzeile (beide Titel der Seite), keine Warnung', ruhig.code === 0 && ruhig.ausgabe.includes('Archiv-Disc ohne Disc-Verweis: 2 (Stand 2026-11-06: höchstens 2)') && !ruhig.ausgabe.includes('WARNUNG') && ruhig.ausgabe.includes('VERSTÖSSE: 0'), ruhig)
const neu = lauf([sieben, geteilt], [], stand([900071]))
pruefe('neuer Titel ohne Verweis: Exit 0, Zeile „⚠ WARNUNG“ mit der Kennung und Grenze', neu.code === 0 && /⚠ WARNUNG Archiv-Disc: 1 Titel .*neu seit dem Stand: 900072/.test(neu.ausgabe) && neu.ausgabe.includes('mehr als die Grenze 1'), neu)
const mitKauf = lauf([{ ...sieben, watchLinks: [{ kind: 'buy' }] }, geteilt], [], stand([900072]))
pruefe('Kauflink an einem Titel der geteilten Seite: nur der andere zählt', mitKauf.code === 0 && mitKauf.ausgabe.includes('Archiv-Disc ohne Disc-Verweis: 1') && !mitKauf.ausgabe.includes('WARNUNG'), mitKauf)
const mitTermin = lauf([sieben, geteilt], [{ titleId: 900071, releaseType: 'disc' }], stand([900072]))
pruefe('Disc-Termin gilt als Verweis', mitTermin.code === 0 && mitTermin.ausgabe.includes('Archiv-Disc ohne Disc-Verweis: 1'), mitTermin)
const alle = lauf([{ ...sieben, watchLinks: [{ kind: 'buy' }] }, { ...geteilt, watchLinks: [{ kind: 'buy' }] }], [], stand(Array.from({ length: 10 }, (_, i) => 100 + i)))
pruefe('zehn erledigte Kennungen: Hinweis zum Kürzen, Exit 0', alle.code === 0 && alle.ausgabe.includes('10 Kennungen'), alle)
const neun = lauf([{ ...sieben, watchLinks: [{ kind: 'buy' }] }, { ...geteilt, watchLinks: [{ kind: 'buy' }] }], [], stand(Array.from({ length: 9 }, (_, i) => 100 + i)))
pruefe('neun erledigte Kennungen: noch kein Hinweis', neun.code === 0 && !neun.ausgabe.includes('WARNUNG'), neun)
const ohneStand = lauf([sieben], [], undefined)
pruefe('Stand-Datei fehlt: Exit 0, Zeile „⚠ WARNUNG“ über der Grenze 0', ohneStand.code === 0 && ohneStand.ausgabe.includes('mehr als die Grenze 0'), ohneStand)

console.log(`\nArchiv-Disc: ${verletzt ? `${verletzt} verletzt` : 'alle Prüfungen bestanden'}`)
if (verletzt) process.exit(1)
