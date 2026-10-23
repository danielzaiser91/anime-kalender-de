/**
 * Prozess-Test zur Verdrahtung des täglichen JustWatch-Laufs (`fetch-justwatch-audio.ts`, `frisch: frischeAusTermine()`): Das Skript läuft als eigener
 * Prozess auf einer Kulisse im Temp-Ordner (`AK_ROOT`, Arbeitsordner) mit fester Uhr und `--limit 0` (kein Abruf). Ein Film mit Disc-Termin gestern und einem
 * fünf Tage alten Kino-Befund ist nur dann „offen“, wenn der Lauf die Termine liest; ohne Termin, mit Prime-Kauf im Befund oder mit frischem Befund bleibt die
 * Schlange leer. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = join(import.meta.dirname, '..')
const JETZT = '2026-10-23T12:00:00Z'
const OFFEN = /1 Titel mit offenem Verweis/
const LEER = /keine offenen Verweise zur Wiedervorlage/

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const kino = { anbieter: 'Filmspiegel', art: 'CINEMA', audio: [], untertitel: [], url: 'https://example.org/kino' }
const prime = { anbieter: 'Amazon Video', art: 'BUY', audio: ['de'], untertitel: [], url: 'https://watch.amazon.de/detail?gti=x' }
const befund = (geprueftAm: string, angebote: object[]) => ({ geprueftAm, jwId: 'tm900001', tmdbId: 1, altersangabe: '12', angebote })
const termin = (datum: string) => [{ slug: 'film-disc', titleId: 900001, platform: 'disc', schedule: { firstEpisodeDate: datum } }]

/** Ein Lauf auf einer eigenen Kulisse; Rückgabe: Ausgabe und Exit-Code. */
function lauf(termine: object[], befunde: Record<string, object>): { text: string; status: number | null } {
  const wurzel = mkdtempSync(join(tmpdir(), 'jw-frisch-'))
  try {
    mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
    mkdirSync(join(wurzel, 'data'), { recursive: true })
    const film = { id: 900001, tmdbId: 1, format: 'MOVIE', streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/1', dub: true }], watchLinks: [] }
    writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify([film]))
    writeFileSync(join(wurzel, 'public', 'data', 'releases.json'), JSON.stringify(termine))
    writeFileSync(join(wurzel, 'data', 'justwatch-audio.json'), JSON.stringify(befunde))
    writeFileSync(join(wurzel, 'data', 'tmdb-von-hand.yaml'), '[]\n')
    const huelle = join(wurzel, 'huelle.mts')
    const ziel = pathToFileURL(join(REPO, 'pipeline', 'fetch-justwatch-audio.ts')).href
    const uhr = pathToFileURL(join(REPO, 'tools', 'feste-uhr.ts')).href
    writeFileSync(huelle, `import { festeUhr } from '${uhr}'\nfesteUhr('${JETZT}')\nawait import('${ziel}')\n`)
    const tsx = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs')
    const r = spawnSync(process.execPath, [tsx, huelle, '--limit', '0'], { cwd: wurzel, env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8', windowsHide: true })
    return { text: `${r.stdout}${r.stderr}`, status: r.status }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const gestern = termin('2026-10-22')
const fuenfTage = { '900001': befund('2026-10-18', [kino]) }
const offen = lauf(gestern, fuenfTage)
pruefe('Disc-Termin gestern + 5 Tage alter Kino-Befund: der Lauf nimmt den Titel in die Schlange', OFFEN.test(offen.text), offen.text.slice(-400))
pruefe('Kontrolle: der Lauf endet mit Exit 0', offen.status === 0, offen.status)
pruefe('ohne Termine bleibt die Schlange leer', LEER.test(lauf([], fuenfTage).text))
pruefe('Termin vor 91 Tagen: leer', LEER.test(lauf(termin('2026-07-24'), fuenfTage).text))
pruefe('Termin vor 90 Tagen: offen', OFFEN.test(lauf(termin('2026-07-25'), fuenfTage).text))
pruefe('Prime-Kauf schon im Befund: leer', LEER.test(lauf(gestern, { '900001': befund('2026-10-18', [kino, prime]) }).text))
pruefe('Befund von vorgestern: leer', LEER.test(lauf(gestern, { '900001': befund('2026-10-21', [kino]) }).text))
pruefe('Befund von vor 3 Tagen: offen', OFFEN.test(lauf(gestern, { '900001': befund('2026-10-20', [kino]) }).text))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-frisch-lauf: ok (8 Fälle, Prozess auf Kulisse mit fester Uhr)')
