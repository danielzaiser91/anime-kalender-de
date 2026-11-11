/**
 * Handzeilen aus `data/tmdb-von-hand.yaml` streichen Banner und Folgen der alten Kennung (Anlass: Kitaro 10019697, 08.11.2026, von Hand repariert).
 * Prozesstest gegen `fetch-tmdb-titles.ts` auf einer Kulisse im Temp-Ordner, dazu die reine Funktion. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { uebernimmVonHand, type Abgeleitet } from './lib/tmdb-von-hand.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const bild = { p: '/x.jpg', w: 1, h: 1, inhaltAm: '2999-12-31' }
const bestand = (): Abgeleitet => ({
  banner: { 900401: bild, 900402: bild, 900403: bild, 900404: bild },
  folgen: { 900401: { tmdbId: 5 }, 900402: { tmdbId: 6 }, 900403: { tmdbId: 9 }, 900405: { tmdbId: 8 } },
  staffel0: { 900404: {} },
  verworfen: [],
})
const titel = (): Record<string, { tmdbId: number; kind: 'tv' }> => ({ 900401: { tmdbId: 5, kind: 'tv' }, 900402: { tmdbId: 6, kind: 'tv' }, 900405: { tmdbId: 8, kind: 'tv' } })

console.log('\nTMDB von Hand: reine Funktion')
{
  const a = bestand()
  const n = uebernimmVonHand(titel(), [{ anilistId: 900401, ohne: true }, { anilistId: 900402, tmdbId: 7 }, { anilistId: 900404, ohne: true }, { anilistId: 900405, tmdbId: 8 }], 'x', a)
  pruefe('ohne: Banner und Folgen der alten Kennung entfallen', !('900401' in a.banner) && !('900401' in a.folgen), a)
  pruefe('neue Kennung: Banner und Folgen der alten entfallen', !('900402' in a.banner) && !('900402' in a.folgen), a)
  pruefe('Titel mit Staffel-0-Zuordnung behält sein Banner', '900404' in a.banner, a)
  pruefe('gleiche Kennung: Folgen bleiben', a.folgen['900405']?.tmdbId === 8, a)
  pruefe('Fremdes ohne Handzeile bleibt', '900403' in a.banner && '900403' in a.folgen, a)
  pruefe('Verworfenes ist gezählt und benannt', a.verworfen.length === 4 && a.verworfen.includes('Banner 900401') && a.verworfen.includes('Folgen 900402'), a.verworfen)
  pruefe('Rückgabe zählt Titeländerungen: 900401 ohne, 900402 neu', n === 2, n)
  const c = titel()
  const folgenNeu = bestand()
  folgenNeu.folgen['900402'] = { tmdbId: 7 }
  uebernimmVonHand(c, [{ anilistId: 900402, tmdbId: 7 }], 'x', folgenNeu)
  pruefe('Kennungswechsel: Folgen, die schon zur neuen Kennung gehören, bleiben', folgenNeu.folgen['900402']?.tmdbId === 7, folgenNeu)
  const leer = bestand()
  uebernimmVonHand({}, [{ anilistId: 900403, ohne: true }], 'x', leer)
  pruefe('ohne: auch ohne Bestandseintrag werden Altfälle gestrichen', !('900403' in leer.banner) && !('900403' in leer.folgen), leer)
}

console.log('\nTMDB von Hand: Lauf von fetch-tmdb-titles.ts')
const wurzel = mkdtempSync(join(tmpdir(), 'tmdb-von-hand-abgeleitet-'))
try {
  mkdirSync(join(wurzel, 'data'))
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  const schreibe = (pfad: string, inhalt: string): void => writeFileSync(join(wurzel, pfad), inhalt)
  const schreibeD = (name: string, inhalt: string): void => schreibe(join('data', name), inhalt)
  schreibe(join('public', 'data', 'titles.json'), '[]')
  schreibeD('tmdb-titles.json', JSON.stringify(titel()))
  schreibeD('tmdb-banner.json', JSON.stringify(bestand().banner))
  schreibeD('tmdb-folgen.json', JSON.stringify({ ...bestand().folgen, 900404: { tmdbId: 4 } }))
  schreibeD('tmdb-staffel0.json', JSON.stringify(bestand().staffel0))
  schreibeD('tmdb-folgen-404.json', '{}')
  schreibeD('tmdb-von-hand.yaml', '- anilistId: 900401\n  ohne: true\n- anilistId: 900402\n  tmdbId: 7\n  kind: tv\n- anilistId: 900404\n  ohne: true\n')
  const kulisse = join(wurzel, 'kulisse.mjs')
  schreibe('kulisse.mjs', "globalThis.fetch = async () => new Response(JSON.stringify({ results: [] }))\n")
  const r = spawnSync(
    process.execPath,
    ['--import', import.meta.resolve('tsx'), '--import', pathToFileURL(kulisse).href, fileURLToPath(new URL('./fetch-tmdb-titles.ts', import.meta.url))],
    { cwd: wurzel, env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: 'kulisse' }, encoding: 'utf8', windowsHide: true, timeout: 60_000 },
  )
  const liesD = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(wurzel, 'data', name), 'utf8'))
  const banner = liesD('tmdb-banner.json')
  const folgen = liesD('tmdb-folgen.json')
  pruefe('Prozess endet mit 0', r.status === 0, [r.status, r.stderr.slice(0, 300)])
  pruefe('Banner: nur die Titel ohne Handzeile (und mit Staffel 0) bleiben', Object.keys(banner).join() === '900403,900404', Object.keys(banner))
  pruefe('Folgen: nur die Titel ohne Handzeile bleiben', Object.keys(folgen).join() === '900403,900405', Object.keys(folgen))
  pruefe('Staffel 0 mit Handzeile ohne: Banner bleibt, Folgen fallen', '900404' in banner && !('900404' in folgen) && r.stdout.includes('Folgen 900404') && !r.stdout.includes('Banner 900404'), [Object.keys(banner), Object.keys(folgen)])
  pruefe('das Log nennt die verworfenen Einträge', r.stdout.includes('Banner 900401') && r.stdout.includes('Folgen 900402'), r.stdout.slice(0, 400))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} von ${faelle} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nTMDB von Hand, abgeleitete Tabellen: ${faelle} Zusicherungen grün.`)
