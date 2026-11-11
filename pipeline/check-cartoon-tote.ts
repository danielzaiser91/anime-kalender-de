/**
 * Zusicherungen zu toten TMDB-Kennungen im Cartoon-Bestand (`lib/cartoon-tote.ts`, `fetch-cartoons.ts`).
 * Teil 1: `pruefeTote` mit erfundenen Antworten (404 mit/ohne Treffer, 200, Nichtauskunft, Dublette, Wiederkehr, mehrdeutig).
 * Teil 2: `fetch-cartoons.ts` als Prozess gegen eine fetch-Attrappe in einer Wegwerf-Wurzel (`AK_ROOT`).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { hatAufnahmeBeleg } from './lib/cartoon-aufnahme.ts'
import { pruefeTote, zaehlzeileTote, type ToteAbruf, type TmdbStatus } from './lib/cartoon-tote.ts'
import type { CartoonEintrag } from './lib/cartoons.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function eintrag(tmdbId: number, name: string, jahr: number, extra: Partial<CartoonEintrag> = {}): CartoonEintrag {
  return { id: -tmdbId, tmdbId, titleEn: name, jahr, genres: ['Animation'], anbieterDe: ['Netflix'], land: ['US'], geholtAm: '2026-10-01', ...extra }
}
const treffer = (id: number, name: string, jahr: number, genre = 16) => ({ id, name, original_name: name, first_air_date: `${jahr}-01-01`, genre_ids: [genre] })

function abruf(status: Record<number, TmdbStatus>, suchtreffer: Record<string, ReturnType<typeof treffer>[]>): ToteAbruf {
  return {
    status: async (id) => status[id] ?? 'ok',
    suche: async (b) => suchtreffer[b] ?? [],
    holen: async (id) => eintrag(id, 'Neu', 2012, { adnId: undefined }),
  }
}

async function teil1(): Promise<void> {
  const zeilen: string[] = []
  const log = (z: string) => void zeilen.push(z)

  let bestand: Record<string, CartoonEintrag> = { '-111': eintrag(111, 'Alpha', 2012, { adnId: 7 }), '-222': eintrag(222, 'Beta', 2013) }
  let b = await pruefeTote(bestand, ['-111', '-222'], abruf({ 111: 'tot' }, { Alpha: [treffer(999, 'Alpha', 2012)] }), '2999-12-31', log)
  pruefe('404 mit eindeutigem Treffer: alter Schlüssel weg, neuer da', !bestand['-111'] && bestand['-999']?.tmdbId === 999, Object.keys(bestand))
  pruefe('ADN-Kennung bleibt bei der Neuzuordnung', bestand['-999']?.adnId === 7, bestand['-999'])
  pruefe('200 bleibt unverändert', JSON.stringify(bestand['-222']) === JSON.stringify(eintrag(222, 'Beta', 2013)))
  pruefe('Bilanz 2 geprüft, 1 tot, 1 neu, 0 Liste', b.geprueft === 2 && b.tot === 1 && b.neuZugeordnet === 1 && b.aufListe === 0 && b.unklar === 0, b)
  pruefe('Zählzeile', zaehlzeileTote(b) === '1 tote Kennungen, 1 neu zugeordnet, 0 auf Liste (2 geprüft, 0 ohne Auskunft)', zaehlzeileTote(b))

  bestand = { '-111': eintrag(111, 'Alpha', 2012) }
  b = await pruefeTote(bestand, ['-111'], abruf({ 111: 'tot' }, {}), '2999-12-31', log)
  pruefe('404 ohne Treffer: Eintrag bleibt, tmdbTot gesetzt', bestand['-111']?.tmdbTot === '2999-12-31' && b.aufListe === 1 && b.neuZugeordnet === 0, bestand)
  pruefe('Eintrag mit tmdbTot erscheint nicht', !hatAufnahmeBeleg(bestand['-111']))
  pruefe('Eintrag mit ADN-Kennung und tmdbTot erscheint ebenfalls nicht', !hatAufnahmeBeleg({ ...bestand['-111'], adnId: 5 }))
  await pruefeTote(bestand, ['-111'], abruf({ 111: 'tot' }, {}), '3000-01-01', log)
  pruefe('zweiter Lauf behält das erste Datum', bestand['-111']?.tmdbTot === '2999-12-31', bestand['-111'])
  await pruefeTote(bestand, ['-111'], abruf({ 111: 'ok' }, {}), '3000-01-02', log)
  pruefe('wieder erreichbar: tmdbTot entfällt', bestand['-111'] && !bestand['-111'].tmdbTot && hatAufnahmeBeleg(bestand['-111']), bestand['-111'])

  for (const s of ['unklar'] as const) {
    bestand = { '-111': eintrag(111, 'Alpha', 2012) }
    b = await pruefeTote(bestand, ['-111'], abruf({ 111: s }, { Alpha: [treffer(999, 'Alpha', 2012)] }), '2999-12-31', log)
    pruefe(`${s}: nichts geändert, 0 tot`, bestand['-111']?.tmdbId === 111 && !bestand['-111'].tmdbTot && b.tot === 0 && b.unklar === 1, b)
  }

  bestand = { '-111': eintrag(111, 'Alpha', 2012) }
  b = await pruefeTote(bestand, ['-111'], abruf({ 111: 'tot' }, { Alpha: [treffer(998, 'Alpha', 2012), treffer(999, 'Alpha', 2012)] }), '2999-12-31', log)
  pruefe('mehrdeutig: auf Liste, nicht geraten', bestand['-111']?.tmdbTot === '2999-12-31' && !bestand['-998'] && !bestand['-999'], Object.keys(bestand))

  bestand = { '-111': eintrag(111, 'Alpha', 2012) }
  await pruefeTote(bestand, ['-111'], abruf({ 111: 'tot' }, { Alpha: [treffer(999, 'Alpha', 2012, 18)] }), '2999-12-31', log)
  pruefe('Treffer ohne Animation zählt nicht', bestand['-111']?.tmdbTot === '2999-12-31' && !bestand['-999'])

  bestand = { '-111': eintrag(111, 'Alpha', 2012) }
  await pruefeTote(bestand, ['-111'], abruf({ 111: 'tot' }, { Alpha: [treffer(999, 'Alpha', 2020)] }), '2999-12-31', log)
  pruefe('Treffer mit anderem Jahr zählt nicht', bestand['-111']?.tmdbTot === '2999-12-31' && !bestand['-999'])

  bestand = { '-111': eintrag(111, 'Alpha', 2012), '-999': eintrag(999, 'Alpha', 2012) }
  b = await pruefeTote(bestand, ['-111'], abruf({ 111: 'tot' }, { Alpha: [treffer(999, 'Alpha', 2012)] }), '2999-12-31', log)
  pruefe('neue Kennung schon im Bestand: alter Eintrag weg, kein Doppel', !bestand['-111'] && Object.keys(bestand).length === 1 && b.neuZugeordnet === 1, Object.keys(bestand))

  bestand = { '-111': eintrag(111, 'Alpha', 2012) }
  const ohneHolen: ToteAbruf = { ...abruf({ 111: 'tot' }, { Alpha: [treffer(999, 'Alpha', 2012)] }), holen: async () => null }
  await pruefeTote(bestand, ['-111'], ohneHolen, '2999-12-31', log)
  pruefe('Treffer, aber Abruf liefert nichts (Genre verloren): auf Liste', bestand['-111']?.tmdbTot === '2999-12-31' && !bestand['-999'])
  pruefe('Log nennt je tote Kennung eine Zeile', zeilen.length >= 5, zeilen.length)
}

/** Fake-`fetch` für den Prozess: Kennung 111 tot, 222 lebt, 333 (neu) ist eine Animationsserie, 444 liefert 429. */
const ATTRAPPE = `
const antwort = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status })
globalThis.fetch = async (url) => {
  const u = String(url)
  if (u.includes('/discover/tv')) return antwort(200, { results: [], total_pages: 1 })
  if (u.includes('/search/tv')) return antwort(200, { results: [{ id: 333, name: 'Alpha', original_name: 'Alpha', first_air_date: '2012-03-04', genre_ids: [16] }] })
  const m = /\\/tv\\/(\\d+)/.exec(u)
  const id = Number(m?.[1])
  if (id === 111) return antwort(404, { success: false })
  if (id === 444) return antwort(429, {})
  return antwort(200, { id, name: id === 333 ? 'Alpha' : 'Beta', original_name: id === 333 ? 'Alpha' : 'Beta', first_air_date: '2012-03-04', genres: [{ id: 16, name: 'Animation' }], seasons: [] })
}
`

function teil2(): void {
  const wurzel = mkdtempSync(join(tmpdir(), 'cartoon-tote-'))
  try {
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
    writeFileSync(join(wurzel, 'data', 'cartoon-handliste.yaml'), 'eintraege: []\n')
    const alt = (id: number, name: string) => ({ id: -id, tmdbId: id, titleEn: name, jahr: 2012, genres: ['Animation'], anbieterDe: ['Netflix'], land: ['US'], geholtAm: '2026-10-01', stand: 3 })
    writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify({ '-111': alt(111, 'Alpha'), '-222': alt(222, 'Beta'), '-444': alt(444, 'Gamma') }))
    writeFileSync(join(wurzel, 'attrappe.mjs'), ATTRAPPE)
    const lauf = spawnSync(process.execPath, ['--import', 'tsx', '--import', pathToFileURL(join(wurzel, 'attrappe.mjs')).href, join(process.cwd(), 'pipeline', 'fetch-cartoons.ts')], {
      env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: 'test' },
      encoding: 'utf8',
      timeout: 120_000,
      windowsHide: true,
    })
    pruefe('Prozess endet mit Exit 0', lauf.status === 0, { status: lauf.status, err: lauf.stderr.slice(-300) })
    pruefe('Zählzeile im Lauf', lauf.stdout.includes('1 tote Kennungen, 1 neu zugeordnet, 0 auf Liste (3 geprüft, 1 ohne Auskunft)'), lauf.stdout.slice(-400))
    const neu = JSON.parse(readFileSync(join(wurzel, 'data', 'cartoons.json'), 'utf8')) as Record<string, CartoonEintrag>
    pruefe('Prozess: 111 ersetzt durch 333, 222 und 444 unverändert', !neu['-111'] && neu['-333']?.tmdbId === 333 && neu['-222']?.tmdbId === 222 && neu['-444']?.tmdbId === 444 && !neu['-444'].tmdbTot, Object.keys(neu))
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

await teil1()
teil2()

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nCartoon tote Kennungen: alle Zusicherungen erfüllt')
