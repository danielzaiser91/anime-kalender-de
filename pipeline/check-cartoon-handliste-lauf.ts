/**
 * Prozesstest zu `fetch-cartoons.ts` mit der Handliste: der Abruf läuft als eigener Prozess gegen eine Kulisse (`AK_ROOT` im Temp-Ordner)
 * mit vorgetäuschtem `fetch` (Vorlader). Erfundene TMDB-Antworten; Kennungen ab 900000.
 * Zugesichert: Treffer wird mit `adnId` gespeichert, mehrdeutig und Grenzfall nicht, der zweite Lauf sucht und holt nichts neu.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'cartoon-handliste-lauf-'))
mkdirSync(join(wurzel, 'data'), { recursive: true })
const anfragen = join(wurzel, 'anfragen.log')
writeFileSync(join(wurzel, 'data', 'cartoon-handliste.yaml'), [
  'eintraege:',
  '  - { adn: 887, name: Dreamland, original: Dreamland }',
  '  - { adn: 1178, name: Babar, original: Babar }',
  '  - { adn: 748, name: Cousteau, pruefen: "Doku oder Animation?" }',
  '  - { adn: 1000, name: Nirgends }',
  '  - { adn: 1001, name: Fehlantwort }',
  '',
].join('\n'))
/* Vorlader: ersetzt `fetch`; jede Anfrage steht (ohne Schlüssel) in der Protokolldatei. */
const stub = join(wurzel, 'stub-fetch.mjs')
writeFileSync(stub, `
import { appendFileSync } from 'node:fs'
const antwort = (daten) => ({ ok: true, json: async () => daten })
const treffer = (id, name) => ({ id, name, original_name: name, first_air_date: '2026-10-17', genre_ids: [16] })
globalThis.fetch = async (url) => {
  const u = new URL(url)
  appendFileSync(${JSON.stringify(anfragen)}, u.pathname + '?' + (u.searchParams.get('query') ?? '') + '\\n')
  if (u.pathname.endsWith('/discover/tv')) return antwort({ results: [], total_pages: 0 })
  if (u.pathname.endsWith('/search/tv')) {
    const q = u.searchParams.get('query')
    if (q === 'Fehlantwort') return { ok: false, json: async () => null }
    return antwort({ results: q === 'Dreamland' ? [treffer(900887, 'Dreamland')] : q === 'Babar' ? [treffer(900001, 'Babar'), treffer(900002, 'Babar')] : [] })
  }
  if (u.pathname.endsWith('/tv/900887')) {
    return antwort({ id: 900887, name: 'Dreamland', original_name: 'Dreamland', first_air_date: '2026-10-17', number_of_episodes: 12, genres: [{ id: 16, name: 'Animation' }], overview: 'x', origin_country: ['FR'], networks: [], production_companies: [], seasons: [], images: {}, keywords: { results: [] }, 'watch/providers': { results: {} } })
  }
  return { ok: false, json: async () => null }
}
`)
const skript = fileURLToPath(new URL('./fetch-cartoons.ts', import.meta.url))
function lauf(): { status: number; out: string; err: string } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--import', pathToFileURL(stub).href, skript], {
    encoding: 'utf8',
    windowsHide: true,
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: 'x' },
  })
  return { status: r.status ?? -1, out: r.stdout, err: r.stderr }
}
const gespeichert = () => JSON.parse(readFileSync(join(wurzel, 'data', 'cartoons.json'), 'utf8')) as Record<string, { adnId?: number; tmdbId: number }>
const protokoll = () => readFileSync(anfragen, 'utf8').split('\n').filter(Boolean)

/* Dreamland steht schon im Bestand, aber ohne ADN-Kennung (Altstand, geholt in ferner Zukunft: nicht fällig): die Kennung allein löst den neuen Abruf aus. */
writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify({ '-900887': { id: -900887, tmdbId: 900887, titleEn: 'Dreamland', genres: ['Animation'], anbieterDe: [], land: [], stand: 3, geholtAm: '2999-12-31' } }))
try {
  const eins = lauf()
  pruefe('erster Lauf endet mit Exit 0 und nennt die Bilanz', eins.status === 0 && /0 neu/.test(eins.out), eins)
  const bestand = gespeichert()
  pruefe('Dreamland (Altstand ohne Kennung) trägt jetzt die ADN-Kennung 887', bestand['-900887']?.adnId === 887 && bestand['-900887'].tmdbId === 900887, bestand)
  pruefe('mehrdeutiger Treffer (Babar) und Grenzfall (Cousteau) sind nicht im Bestand', Object.keys(bestand).join() === '-900887', Object.keys(bestand))
  pruefe('Log: mehrdeutig mit Begründung, Grenzfall ausgelassen, Treffer begründet', eins.out.includes('1178') && eins.out.includes('mehrdeutig') && eins.out.includes('Grenzfall: Doku') && eins.out.includes('TMDB 900887 gefunden'), eins.out)
  pruefe('A1: Treffer-Zeile nennt Jahr/Folgen', eins.out.includes('TMDB 900887 gefunden') && eins.out.includes('Jahr/Folgen 2026/?'), eins.out)
  pruefe('A2: Fehlantwort heißt „Suche fehlgeschlagen“, ein echter Nicht-Treffer (Nirgends) nicht', eins.out.includes('Suche fehlgeschlagen für „Fehlantwort“') && !eins.out.includes('Suche fehlgeschlagen für „Nirgends“'), eins.out)
  pruefe('Cousteau wird nie gesucht', !protokoll().some((z) => z.includes('Cousteau')), protokoll())
  const suchen1 = protokoll().filter((z) => z.startsWith('/3/search/tv')).length
  const einzel1 = protokoll().filter((z) => z.startsWith('/3/tv/')).length
  pruefe('erster Lauf: gesucht wird, Dreamland einmal geholt', suchen1 > 0 && einzel1 === 1, protokoll())
  const vorher = protokoll().length

  const zwei = lauf()
  const neu = protokoll().slice(vorher)
  pruefe('zweiter Lauf endet mit Exit 0', zwei.status === 0, zwei)
  pruefe('zweiter Lauf: Dreamland wird nicht neu gesucht und nicht neu geholt (Kennung steht im Bestand)', !neu.some((z) => z.includes('Dreamland')) && !neu.some((z) => z.startsWith('/3/tv/')), neu)
  pruefe('zweiter Lauf: der Eintrag trägt seine ADN-Kennung weiter', gespeichert()['-900887']?.adnId === 887)
  pruefe('zweiter Lauf: Babar wird weiter gesucht (nicht entschieden), Nirgends ebenso', neu.some((z) => z.includes('Babar')) && neu.some((z) => z.includes('Nirgends')), neu)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nCartoon-Handliste im Abruf: alle Zusicherungen erfüllt')
