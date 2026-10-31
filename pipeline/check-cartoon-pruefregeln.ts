/**
 * Fälle zu zwei Bestandsprüfungen der Cartoons, ohne `public/data` des Repos zu lesen:
 * - `belegeMitAdresse` (check-cartoon-news.ts): API-Beleg nur mit `seite` ist eine Adresse.
 * - check-cartoon-wege-bestand.ts als Prozess gegen eine Kulisse (AK_ROOT im Wegwerf-Ordner): ein ADN-Häkchen ohne Handbeleg
 *   gilt nur mit Handlisten-Serie samt Folgen und Adresse als belegt. Das Soll steht fest im Test, nicht aus `adnShowJeCartoon`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { belegeMitAdresse } from './lib/cartoon-news-regel.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`)
}

console.log('Meldungsbelege (belegeMitAdresse)')
const api = 'https://gw.api.animationdigitalnetwork.com/video/show/887'
const seite = 'https://animationdigitalnetwork.com/de/video/887'
const artikel = 'https://news.animationdigitalnetwork.com/de/2026/09/18/dreamland'
pruefe('API-Beleg ohne Serienseite: rot', !belegeMitAdresse([{ url: api }]))
pruefe('API-Beleg mit Serienseite: grün', belegeMitAdresse([{ url: api, seite }]))
pruefe('API-Beleg ohne Seite neben einem Artikel: rot', !belegeMitAdresse([{ url: artikel }, { url: api }]))
pruefe('Artikel und API-Beleg mit Seite: grün', belegeMitAdresse([{ url: artikel }, { url: api, seite }]))
pruefe('Beleg ohne Adresse (kein http): rot', !belegeMitAdresse([{ url: 'dreamland' }]))
pruefe('keine Belege: rot', !belegeMitAdresse([]) && !belegeMitAdresse(undefined))

type Kulisse = { adnId?: number; episodes: unknown[]; url: string; nurErster?: boolean }
/** Zwei Cartoons mit ADN-Häkchen (-5 und -6); die Kulisse bestimmt, ob ADN -5 als belegt kennt. */
function lauf(k: Kulisse): { exit: number | null; text: string } {
  const wurzel = mkdtempSync(join(tmpdir(), 'cartoon-wege-'))
  try {
    for (const d of ['data/curated', 'public/data']) mkdirSync(join(wurzel, d), { recursive: true })
    const roh = { '-5': { id: -5, ...(k.adnId ? { adnId: k.adnId } : {}) }, '-6': { id: -6 } }
    writeFileSync(join(wurzel, 'data/cartoons.json'), JSON.stringify(roh))
    const show = { showId: 7, title: 'x', url: k.url, episodes: k.episodes }
    writeFileSync(join(wurzel, 'data/adn-catalog.json'), JSON.stringify({ scrapedAt: '', window: { from: '', to: '' }, shows: [show] }))
    const weg = { platform: 'adn', url: 'https://adn.example/7', dub: true }
    writeFileSync(join(wurzel, 'public/data/cartoons.json'), JSON.stringify([{ id: -5, streams: [weg] }, ...(k.nurErster ? [] : [{ id: -6, streams: [weg] }])]))
    const r = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'pipeline/check-cartoon-wege-bestand.ts'], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8', windowsHide: true, timeout: 120000 })
    return { exit: r.status, text: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

console.log('\nADN-Häkchen ohne Handbeleg (check-cartoon-wege-bestand.ts als Prozess)')
const mitSerie = lauf({ adnId: 7, episodes: [{ date: '2026-10-17' }], url: 'https://adn.example/7' })
pruefe('Serie mit Folgen und Adresse: nur der Cartoon ohne Handlisten-Eintrag (-6) ist rot', mitSerie.exit === 1 && /ohne Handbeleg -6\b/.test(mitSerie.text) && !/Handbeleg -5/.test(mitSerie.text) && !/-6,/.test(mitSerie.text), mitSerie)
const gruen = lauf({ adnId: 7, episodes: [{ date: '2026-10-17' }], url: 'https://adn.example/7', nurErster: true })
pruefe('Serie mit Folgen und Adresse, nur der belegte Cartoon im Bestand: grün', gruen.exit === 0 && /erfüllt/.test(gruen.text), gruen)
const ohneFolgen =lauf({ adnId: 7, episodes: [], url: 'https://adn.example/7' })
pruefe('Serie ohne Folgen: beide rot (-5,-6)', ohneFolgen.exit === 1 && /ohne Handbeleg -5,-6/.test(ohneFolgen.text), ohneFolgen)
const ohneAdresse = lauf({ adnId: 7, episodes: [{ date: '2026-10-17' }], url: '' })
pruefe('Serie ohne Adresse: beide rot', ohneAdresse.exit === 1 && /ohne Handbeleg -5,-6/.test(ohneAdresse.text), ohneAdresse)
const ohneEintrag = lauf({ episodes: [{ date: '2026-10-17' }], url: 'https://adn.example/7' })
pruefe('Cartoon ohne ADN-Kennung in der Handliste: beide rot', ohneEintrag.exit === 1 && /ohne Handbeleg -5,-6/.test(ohneEintrag.text), ohneEintrag)

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('Cartoon-Prüfregeln: 11 Zusicherungen erfüllt')
