/**
 * Prozesstest der Verdrahtung (06.11.2026): `fetch-tmdb-poster.ts` misst am Ende des Laufs die neuen AniList-Cover und schreibt
 * `data/anilist-cover-masse.json`. Der Lauf startet als eigener Prozess in einem Wegwerf-Ordner (`AK_ROOT`); `fetch` ist ersetzt
 * (AniList-Cover liefern ein JPEG, alles andere 404), TMDB-Schlüssel nur zum Starten. Fällt der Aufruf in `main` weg, fehlt die Datei.
 * Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const BASIS = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/'
const STUB = `
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x89, 0x01, 0xcc, 0x03]), Buffer.alloc(30)])
globalThis.fetch = async (url) => String(url).startsWith('https://s4.anilist.co/') ? new Response(new Uint8Array(jpeg), { status: 200 }) : new Response('{}', { status: 404 })
`
const wurzel = mkdtempSync(join(tmpdir(), 'cover-masse-poster-'))
try {
  mkdirSync(join(wurzel, 'public/data'), { recursive: true })
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  const titel = [{ id: 900001, slug: 'a', coverImage: `${BASIS}large/neu1.jpg` }, { id: 900002, slug: 'b', coverImage: `${BASIS}medium/bekannt.jpg` }]
  writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify(titel))
  writeFileSync(join(wurzel, 'data/anilist-cover-masse.json'), JSON.stringify({ 'medium/bekannt.jpg': [225, 293, 38220] }))
  const stub = `data:text/javascript,${encodeURIComponent(STUB)}`
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--import', stub, 'pipeline/fetch-tmdb-poster.ts'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: 'attrappe' },
  })
  pruefe('Lauf endet mit Exit 0 und der Schlusszeile', r.status === 0 && r.stdout.includes('Titeln mit Plakat'), `${r.status} ${r.stdout.slice(-300)} ${r.stderr.slice(-300)}`)
  pruefe('Lauf meldet die Messung', r.stdout.includes('AniList-Cover: 1 ohne Messung, 1 gemessen'), r.stdout.slice(-300))
  const datei = join(wurzel, 'data/anilist-cover-masse.json')
  const bestand = existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as Record<string, number[]>) : {}
  pruefe('Datei hat das neue Cover (460×649, 42 Byte) und das bekannte unverändert', bestand['large/neu1.jpg']?.join() === '460,649,42' && bestand['medium/bekannt.jpg']?.join() === '225,293,38220' && Object.keys(bestand).length === 2, JSON.stringify(bestand))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`[cover-masse-poster-lauf] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[cover-masse-poster-lauf] ${faelle} Fälle grün (Poster-Lauf misst neue AniList-Cover, Bekanntes bleibt)`)
