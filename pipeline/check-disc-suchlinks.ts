/**
 * Ratsche für Disc-Namenssuchen: Rechenregel (`suchlinkBilanz`) und der Bestandswächter als eigener Prozess gegen einen
 * Wegwerf-Ordner (`AK_ROOT`): Zeile, Exit 0 und die Fälle neu / über der Grenze / erledigt / leere Dateien.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { suchlinkBilanz, type SuchlinkStand } from './lib/disc-suchlinks.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const NAME = 'https://www.amazon.de/s?k=Conan%20Anime%20Blu-ray'
const EAN = 'https://www.amazon.de/s?k=7630017545978'
const DP = 'https://www.amazon.de/dp/B0HGB36K4K'
const disc = (slug: string, buyUrl?: string, releaseType = 'disc') => ({ slug, releaseType, ...(buyUrl ? { buyUrl } : {}) })
const stand = (slugs: string[], hoechstens = slugs.length): SuchlinkStand => ({ stand: '2026-10-27', hoechstens, slugs })

console.log('\nBilanz:')
const b1 = suchlinkBilanz([disc('a', NAME), disc('b', EAN), disc('c', DP), disc('d'), disc('e', NAME, 'weekly')], stand(['a']))
pruefe('nur Disc-Namenssuchen zählen (EAN, /dp/, ohne Link, kein Disc: nicht)', b1.anzahl === 1 && !b1.neu.length && !b1.erledigt.length && !b1.ueberGrenze, b1)
const b2 = suchlinkBilanz([disc('a', NAME), disc('neu', NAME)], stand(['a']))
pruefe('eine Namenssuche außerhalb des Standes ist neu (genau 1)', b2.neu.length === 1 && b2.neu[0]!.slug === 'neu' && b2.ueberGrenze, b2)
const b3 = suchlinkBilanz([disc('a', EAN)], stand(['a', 'b']))
pruefe('erledigte Slugs werden genannt', b3.anzahl === 0 && b3.erledigt.join() === 'a,b' && !b3.ueberGrenze, b3)
const b4 = suchlinkBilanz([disc('a', NAME), disc('b', NAME)], stand(['a', 'b'], 1))
pruefe('über der Grenze, obwohl alle Slugs bekannt', b4.ueberGrenze && !b4.neu.length, b4)
pruefe('genau an der Grenze ist nicht darüber', !suchlinkBilanz([disc('a', NAME)], stand(['a'], 1)).ueberGrenze)
pruefe('leerer Bestand', suchlinkBilanz([], stand([])).anzahl === 0)

console.log('\nBestandswächter als Prozess:')
const skript = fileURLToPath(new URL('./check-disc-suchlinks-bestand.ts', import.meta.url))
function lauf(releases: unknown, standInhalt: unknown): { code: number | null; ausgabe: string } {
  const w = mkdtempSync(join(tmpdir(), 'disc-suchlinks-'))
  try {
    mkdirSync(join(w, 'data'))
    mkdirSync(join(w, 'public', 'data'), { recursive: true })
    if (releases !== undefined) writeFileSync(join(w, 'public', 'data', 'releases.json'), JSON.stringify(releases))
    if (standInhalt !== undefined) writeFileSync(join(w, 'data', 'disc-suchlinks-stand.json'), JSON.stringify(standInhalt))
    const r = spawnSync(process.execPath, ['--import', 'tsx', skript], { env: { ...process.env, AK_ROOT: w }, encoding: 'utf8', timeout: 60_000, windowsHide: true })
    return { code: r.status, ausgabe: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(w, { recursive: true, force: true })
  }
}
const ruhig = lauf([disc('a', NAME)], stand(['a']))
pruefe('Stand eingehalten: Exit 0, Zählzeile, keine Warnung', ruhig.code === 0 && ruhig.ausgabe.includes('Disc-Namenssuchen: 1 (Stand 2026-10-27: höchstens 1)') && !ruhig.ausgabe.includes('WARNUNG'), ruhig)
const neu = lauf([disc('a', NAME), disc('x-neu', NAME)], stand(['a']))
pruefe('neue Namenssuche: Exit 0 und Zeile „⚠ WARNUNG“ mit dem Slug', neu.code === 0 && /⚠ WARNUNG Disc-Kauflink: 1 neue Amazon-Namenssuche\(n\).*x-neu/.test(neu.ausgabe) && neu.ausgabe.includes('mehr als die Grenze 1'), neu)
const erledigt = lauf([], stand(Array.from({ length: 10 }, (_, i) => `s${i}`)))
pruefe('zehn erledigte Slugs: Hinweis zum Kürzen, Exit 0', erledigt.code === 0 && erledigt.ausgabe.includes('10 Slugs'), erledigt)
const neun = lauf([], stand(Array.from({ length: 9 }, (_, i) => `s${i}`)))
pruefe('neun erledigte Slugs: noch kein Hinweis', neun.code === 0 && !neun.ausgabe.includes('WARNUNG'), neun)
const leer = lauf(undefined, undefined)
pruefe('beide Dateien fehlen: Exit 0, Zählzeile mit 0', leer.code === 0 && leer.ausgabe.includes('Disc-Namenssuchen: 0'), leer)

console.log(`\nDisc-Suchlinks: ${verletzt ? `${verletzt} verletzt` : 'alle Prüfungen bestanden'}`)
if (verletzt) process.exit(1)
