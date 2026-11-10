/**
 * Ratsche für Disc-Handlinks ohne EAN: Rechenregel (`suchlinkBilanz(…, 'produkt')`) und der Bestandswächter als eigener
 * Prozess gegen einen Wegwerf-Ordner (`AK_ROOT`): Zeile mit Titel und Datum, Exit 0 und die Fälle neu / über der Grenze /
 * erledigt / leere Dateien. Neuer Handlink ohne EAN → Warnzeile; Handlink mit EAN (EAN-Suche) wird nicht gezählt.
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
const DP_LANG = 'https://www.amazon.de/Banana-Fish-Staffel-Vol-1-Blu-ray/dp/B0H26RZXLW'
const ANDERER = 'https://www.example-shop.de/conan-box-1'
const disc = (slug: string, buyUrl?: string, releaseType = 'disc') => ({
  slug,
  releaseType,
  name: `Titel ${slug}`,
  schedule: { firstEpisodeDate: '2026-11-20' },
  ...(buyUrl ? { buyUrl } : {}),
})
const stand = (slugs: string[], hoechstens = slugs.length): SuchlinkStand => ({ stand: '2026-11-06', hoechstens, slugs })

console.log('\nBilanz:')
const b1 = suchlinkBilanz([disc('a', DP), disc('b', EAN), disc('c', NAME), disc('d'), disc('e', DP, 'weekly'), disc('f', ANDERER), disc('g', DP_LANG)], stand(['a', 'g']), 'produkt')
pruefe('nur Disc-Handlinks zählen (EAN, Namenssuche, ohne Link, kein Disc, anderer Händler: nicht; Titel im Pfad: ja)', b1.anzahl === 2 && b1.alle.map((r) => r.slug).join() === 'a,g' && !b1.neu.length && !b1.erledigt.length && !b1.ueberGrenze, b1)
const b2 = suchlinkBilanz([disc('a', DP), disc('neu', DP)], stand(['a']), 'produkt')
pruefe('ein Handlink außerhalb des Standes ist neu (genau 1)', b2.neu.length === 1 && b2.neu[0]!.slug === 'neu' && b2.ueberGrenze, b2)
const b3 = suchlinkBilanz([disc('a', EAN)], stand(['a', 'b']), 'produkt')
pruefe('Handlink mit EAN-Suche ersetzt: Slug erledigt, nicht gezählt', b3.anzahl === 0 && b3.erledigt.join() === 'a,b' && !b3.ueberGrenze, b3)
const b4 = suchlinkBilanz([disc('a', DP), disc('b', DP)], stand(['a', 'b'], 1), 'produkt')
pruefe('über der Grenze, obwohl alle Slugs bekannt', b4.ueberGrenze && !b4.neu.length, b4)
pruefe('genau an der Grenze ist nicht darüber', !suchlinkBilanz([disc('a', DP)], stand(['a'], 1), 'produkt').ueberGrenze)
pruefe('leerer Bestand', suchlinkBilanz([], stand([]), 'produkt').anzahl === 0)
pruefe('Standardart bleibt die Namenssuche (Handlink zählt dort nicht)', suchlinkBilanz([disc('a', DP), disc('b', NAME)], stand([])).alle.map((r) => r.slug).join() === 'b')

console.log('\nBestandswächter als Prozess:')
const skript = fileURLToPath(new URL('./check-disc-handlinks-bestand.ts', import.meta.url))
function lauf(releases: unknown, standInhalt: unknown): { code: number | null; ausgabe: string } {
  const w = mkdtempSync(join(tmpdir(), 'disc-handlinks-'))
  try {
    mkdirSync(join(w, 'data'))
    mkdirSync(join(w, 'public', 'data'), { recursive: true })
    if (releases !== undefined) writeFileSync(join(w, 'public', 'data', 'releases.json'), JSON.stringify(releases))
    if (standInhalt !== undefined) writeFileSync(join(w, 'data', 'disc-handlinks-stand.json'), JSON.stringify(standInhalt))
    const r = spawnSync(process.execPath, ['--import', 'tsx', skript], { env: { ...process.env, AK_ROOT: w }, encoding: 'utf8', timeout: 60_000, windowsHide: true })
    return { code: r.status, ausgabe: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(w, { recursive: true, force: true })
  }
}
const ruhig = lauf([disc('a', DP), disc('b', EAN)], stand(['a']))
pruefe('Stand eingehalten: Exit 0, Zählzeile, Auflistung mit Titel und Datum, keine Warnung', ruhig.code === 0 && ruhig.ausgabe.includes('Disc-Handlinks ohne EAN: 1 (Stand 2026-11-06: höchstens 1)') && ruhig.ausgabe.includes('Handlink: Titel a (2026-11-20)') && !ruhig.ausgabe.includes('Titel b') && !ruhig.ausgabe.includes('WARNUNG'), ruhig)
const neu = lauf([disc('a', DP), disc('x-neu', DP)], stand(['a']))
pruefe('neuer Handlink ohne EAN: Exit 0 und Zeile „⚠ WARNUNG“ mit Titel und Datum', neu.code === 0 && /⚠ WARNUNG Disc-Handlink: 1 neue\(r\) Amazon-Handlink\(s\).*Titel x-neu \(2026-11-20\)/.test(neu.ausgabe) && neu.ausgabe.includes('mehr als die Grenze 1'), neu)
const erledigt = lauf([], stand(Array.from({ length: 10 }, (_, i) => `s${i}`)))
pruefe('zehn erledigte Slugs: Hinweis zum Kürzen, Exit 0', erledigt.code === 0 && erledigt.ausgabe.includes('10 Slugs'), erledigt)
const neun = lauf([], stand(Array.from({ length: 9 }, (_, i) => `s${i}`)))
pruefe('neun erledigte Slugs: noch kein Hinweis', neun.code === 0 && !neun.ausgabe.includes('WARNUNG'), neun)
const leer = lauf(undefined, undefined)
pruefe('beide Dateien fehlen: Exit 0, Zählzeile mit 0', leer.code === 0 && leer.ausgabe.includes('Disc-Handlinks ohne EAN: 0'), leer)

console.log(`\nDisc-Handlinks: ${verletzt ? `${verletzt} verletzt` : 'alle Prüfungen bestanden'}`)
if (verletzt) process.exit(1)
