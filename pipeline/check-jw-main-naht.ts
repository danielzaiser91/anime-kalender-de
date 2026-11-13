/**
 * Fährt `main()` aus `fetch-justwatch-audio.ts` im selben Prozess gegen eine Kulisse (`AK_ROOT` und Arbeitsordner im Wegwerf-Ordner, feste Uhr,
 * Abruf-Attrappe, Pause ohne Wartezeit) und belegt die Verdrahtung: Kennung-fremd-Prüfung (`nimmTreffer`) mit Warnzeile, `--limit`, `--namen`,
 * `--nur-cartoons`, Abruf und Pause über die Welt, Plausibilitätsriegel vor dem Schreiben. Kein echter Abruf; läuft in `check:logic`.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { festeUhr } from '../tools/feste-uhr.ts'
import type { fetchJson } from './lib/util.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'ak-jw-main-'))
const ordner = join(wurzel, 'da' + 'ta')
const oeffentlich = join(wurzel, 'public', 'da' + 'ta')
mkdirSync(ordner, { recursive: true })
mkdirSync(oeffentlich, { recursive: true })
const LISTE = join(wurzel, 'daniel-zum-abarbeiten', 'listen', '16-justwatch-' + 'tonspuren.md')
process.env.AK_ROOT = wurzel
process.chdir(wurzel)
festeUhr('2026-10-23T12:00:00Z')
const modul = './fetch-justwatch-audio.ts?nur-laden'
const { main } = (await import(modul)) as { main: (args: string[], welt: { abruf: typeof fetchJson; pause: () => Promise<void> }) => Promise<void> }

let fehler = 0
let geprueft = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  geprueft++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

type Bestand = Record<string, { geprueftAm?: string; jwId?: string; ohneTreffer?: boolean; tmdbId?: number; ueberName?: boolean; angebote?: unknown[] }>
const film = (id: number, tmdbId: number | undefined) => ({
  id,
  tmdbId,
  titleEn: `Titel ${id}`,
  format: 'TV',
  streams: [{ platform: 'netflix', url: `https://www.netflix.com/title/${id}`, dub: true }],
  watchLinks: [],
})
const knoten = (jwId: string, tmdb: number, offers: unknown[]) => ({
  id: jwId,
  objectType: 'SHOW',
  content: { title: 'Titel', fullPath: `/de/serie/${jwId}`, ageCertification: '6', externalIds: { tmdbId: String(tmdb) } },
  offers,
  seasons: [],
})
const angebot = [{ monetizationType: 'FLATRATE', audioLanguages: ['de'], subtitleLanguages: [], standardWebURL: 'https://x', package: { clearName: 'Netflix' } }]

interface Kulisse {
  titles: unknown[]
  bestand?: Bestand
  /** Antwort je Suchbegriff; `fremd`: jede Suche liefert beide Reihen unter derselben JustWatch-Kennung. */
  antwort: 'fremd' | 'treffer-mit-angebot' | 'treffer-leer' | 'nichts'
  /** Je Titelabruf (in Reihenfolge) `true` = Fehler „429 …“; darüber hinaus Erfolg. */
  sperren?: boolean[]
}

interface Ergebnis {
  bestand: Bestand
  zeilen: string[]
  urls: string[]
  /** Anzahl der Titelabrufe (Suchbegriff „Titel N“). */
  titelAbrufe: number
  pausen: number
  health?: { lastCount?: number }
  listeDa: boolean
}

async function lauf(k: Kulisse, args: string[]): Promise<Ergebnis> {
  writeFileSync(join(oeffentlich, 'titles.json'), JSON.stringify(k.titles))
  writeFileSync(join(oeffentlich, 'releases.json'), '[]')
  writeFileSync(join(ordner, 'tmdb-von-hand.yaml'), '[]\n')
  writeFileSync(join(ordner, 'justwatch-audio.json'), JSON.stringify(k.bestand ?? {}))
  rmSync(join(ordner, 'source-' + 'health.json'), { force: true })
  rmSync(LISTE, { force: true })
  const urls: string[] = []
  let pausen = 0
  let titelAbrufe = 0
  const abruf = (async (url: string, init?: RequestInit) => {
    urls.push(String(url))
    const q: string = JSON.parse(String(init?.body ?? '{}')).variables?.q ?? ''
    if (q.startsWith('Titel ') && k.sperren?.[titelAbrufe++] === true) throw new Error('429 Too Many Requests')
    const nr = Number(q.replace('Titel ', '')) % 1000
    const edges =
      k.antwort === 'fremd'
        ? [{ node: knoten('JW1', 2, []) }, { node: knoten('JW1', 1, []) }]
        : k.antwort === 'nichts'
          ? []
          : [{ node: knoten(`JW${nr}`, nr, k.antwort === 'treffer-mit-angebot' ? angebot : []) }]
    return { data: { popularTitles: { edges } } }
  }) as unknown as typeof fetchJson
  const zeilen: string[] = []
  const log = console.log
  const warnung = console.warn
  console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
  console.warn = (...a: unknown[]) => void zeilen.push(a.join(' '))
  try {
    await main(args, { abruf, pause: async () => void pausen++ })
  } finally {
    console.log = log
    console.warn = warnung
  }
  const gesund = join(ordner, 'source-' + 'health.json')
  const health = existsSync(gesund) ? JSON.parse(readFileSync(gesund, 'utf8'))['justwatch-audio'] : undefined
  const listeDa = existsSync(LISTE)
  return { bestand: JSON.parse(readFileSync(join(ordner, 'justwatch-audio.json'), 'utf8')), zeilen, urls, titelAbrufe, pausen, health, listeDa }
}

const halter = { geprueftAm: '2026-10-23', jwId: 'JW1', tmdbId: 1, angebote: [] }

/* Kennung-fremd: Halter 900001 (TMDB 1) hält JW1; 900002 (TMDB 2, Fancy-Nancy-Fall) darf sie nicht bekommen, 900003 (TMDB 1) ist dieselbe Reihe. */
const fremd = await lauf({ titles: [film(900002, 2), film(900003, 1)], bestand: { 900001: halter }, antwort: 'fremd' }, ['--limit', '5', '--alter', '0'])
pruefe('fremd: Fremdtitel bekommt JW1 nicht und steht als ohneTreffer', fremd.bestand['900002']?.ohneTreffer === true && !fremd.bestand['900002']?.jwId, fremd.bestand['900002'])
pruefe('fremd: gleiche Reihe wird angenommen', fremd.bestand['900003']?.jwId === 'JW1', fremd.bestand['900003'])
pruefe('fremd: Warnzeile nennt Titel und Halter', fremd.zeilen.some((z) => /1 Treffer abgewiesen.*\(900002, Halter 900001\)/.test(z)), fremd.zeilen)
pruefe('fremd: Abruf lief über die Welt (Endpunkt)', fremd.urls.length > 0 && fremd.urls.every((u) => u === 'https://apis.justwatch.com/graphql'), fremd.urls)
pruefe('fremd: Pause lief über die Welt', fremd.pausen > 0, fremd.pausen)

/* Limit: zwei offene Titel, `--limit 1` fragt genau einen. */
const limit = await lauf({ titles: [film(900011, 11), film(900012, 12)], antwort: 'treffer-mit-angebot' }, ['--limit', '1', '--alter', '0'])
pruefe('limit: genau ein Titel verbucht', Object.keys(limit.bestand).length === 1, Object.keys(limit.bestand))
const beide = await lauf({ titles: [film(900011, 11), film(900012, 12)], antwort: 'treffer-mit-angebot' }, ['--limit', '2', '--alter', '0'])
pruefe('limit: bei --limit 2 beide Titel verbucht', Object.keys(beide.bestand).length === 2 && !!beide.bestand['900011']?.jwId && !!beide.bestand['900012']?.jwId, Object.keys(beide.bestand))
pruefe('limit: Schlusszeile zählt 2 zugeordnet, 2 mit Deutsch', beide.zeilen.some((z) => /JustWatch: 2 Titel zugeordnet \(0 ohne Angebot\), 2 davon mit deutscher Tonspur/.test(z)), beide.zeilen)

/* Namenssuche: ohne TMDB-Kennung fragt nur `--namen N`; ohne den Schalter bleibt der Titel unberührt. */
const ohneSchalter = await lauf({ titles: [film(900021, undefined)], antwort: 'nichts' }, ['--limit', '5', '--alter', '0'])
pruefe('namen: ohne --namen kein Eintrag für den Titel ohne Kennung', !ohneSchalter.bestand['900021'] && !ohneSchalter.zeilen.some((z) => z.includes('Namenssuche')), ohneSchalter.zeilen)
const mitSchalter = await lauf({ titles: [film(900021, undefined)], antwort: 'nichts' }, ['--limit', '5', '--alter', '0', '--namen', '3'])
pruefe('namen: --namen 3 fragt den Titel (Eintrag über Name)', mitSchalter.bestand['900021']?.ueberName === true && mitSchalter.zeilen.some((z) => z.includes('Namenssuche')), mitSchalter.zeilen)

/* Nur Cartoons: der Titel aus dem Hauptbestand wird nicht gefragt, es gibt keine Cartoons. */
const nurCartoons = await lauf({ titles: [film(900031, 31)], antwort: 'treffer-mit-angebot' }, ['--limit', '5', '--alter', '0', '--nur-cartoons'])
pruefe('nur-cartoons: Hauptbestand bleibt unberührt, keine Suche nach dem Titel', !nurCartoons.bestand['900031'], nurCartoons.bestand)

const cartoonsNamen = await lauf({ titles: [film(900032, undefined)], antwort: 'nichts' }, ['--alter', '0', '--nur-cartoons', '--namen', '3'])
pruefe('nur-cartoons: keine Namenssuche, auch mit --namen', !cartoonsNamen.zeilen.some((z) => z.includes('Namenssuche')) && !cartoonsNamen.bestand['900032'], cartoonsNamen.zeilen)

/* Plausibilitätsriegel: 20 Treffer ohne jedes Angebot — nichts wird geschrieben. */
const zwanzig = Array.from({ length: 20 }, (_, i) => film(900100 + i, 100 + i))
const leer = await lauf({ titles: zwanzig, antwort: 'treffer-leer' }, ['--limit', '40', '--alter', '0'])
pruefe('plausibel: 20 leere Treffer werden nicht geschrieben', Object.keys(leer.bestand).length === 0 && leer.zeilen.some((z) => z.includes('unplausibel')), leer.zeilen.slice(-3))
const gut = await lauf({ titles: zwanzig, antwort: 'treffer-mit-angebot' }, ['--limit', '40', '--alter', '0'])
pruefe('plausibel: 20 Treffer mit Angebot werden geschrieben', Object.keys(gut.bestand).length === 20, Object.keys(gut.bestand).length)
pruefe('erfolg: Quellenstand meldet 20, Arbeitsliste entsteht', gut.health?.lastCount === 20 && gut.listeDa, [gut.health, gut.listeDa])
pruefe('plausibel: verworfener Lauf meldet 0 und schreibt keine Liste', leer.health?.lastCount === 0 && !leer.listeDa, [leer.health, leer.listeDa])

/* Alter: ein Befund von vor drei Tagen ist bei `--alter 0` fällig, bei `--alter 5` noch nicht. */
const alt = { geprueftAm: '2026-10-20', erstAm: '2026-09-01', jwId: 'JW41', tmdbId: 41, altersangabe: '6', staffeln: [], angebote: [{ anbieter: 'Netflix', art: 'FLATRATE', audio: ['de'], untertitel: [], url: 'https://x' }] }
const faellig = await lauf({ titles: [film(900041, 41)], bestand: { 900041: alt }, antwort: 'treffer-mit-angebot' }, ['--alter', '0'])
pruefe('alter: --alter 0 fragt den Titel erneut', faellig.bestand['900041']?.geprueftAm === '2026-10-23', faellig.bestand['900041'])
const frisch = await lauf({ titles: [film(900041, 41)], bestand: { 900041: alt }, antwort: 'treffer-mit-angebot' }, ['--alter', '5'])
pruefe('alter: --alter 5 lässt den Titel in Ruhe, keine offenen Verweise', frisch.bestand['900041']?.geprueftAm === '2026-10-20' && frisch.zeilen.some((z) => z.includes('keine offenen Verweise')) && !frisch.zeilen.some((z) => z.includes('Titel zugeordnet')), frisch.zeilen)

/* Namenssuche-Anzahl: zwei Titel ohne Kennung, `--namen 1` fragt nur einen. */
const eins = await lauf({ titles: [film(900051, undefined), film(900052, undefined)], antwort: 'nichts' }, ['--alter', '0', '--namen', '1'])
pruefe('namen: --namen 1 fragt genau einen Titel', Object.keys(eins.bestand).length === 1, Object.keys(eins.bestand))

/* 429-Abbruch der Hauptschleife (`frageOffene`): drei Sperren in Folge beenden den Lauf, zwei nicht, ein Erfolg setzt den Zähler zurück. */
const sechs = Array.from({ length: 6 }, (_, i) => film(900200 + i, 200 + i))
const abbruch = await lauf({ titles: sechs, antwort: 'treffer-mit-angebot', sperren: [true, true, true] }, ['--limit', '6', '--alter', '0'])
pruefe('429: drei Sperren in Folge beenden den Lauf (Warnzeile)', abbruch.zeilen.some((z) => /JustWatch: 3 Sperren in Folge/.test(z)), abbruch.zeilen)
pruefe('429: nach der dritten Sperre kein weiterer Titelabruf, nichts verbucht', abbruch.titelAbrufe === 3 && Object.keys(abbruch.bestand).length === 0, [abbruch.titelAbrufe, Object.keys(abbruch.bestand)])
const zwei = await lauf({ titles: sechs, antwort: 'treffer-mit-angebot', sperren: [true, true] }, ['--limit', '6', '--alter', '0'])
pruefe('429: zwei Sperren in Folge beenden den Lauf nicht (N-1)', !zwei.zeilen.some((z) => /Sperren in Folge/.test(z)) && zwei.titelAbrufe === 6 && Object.keys(zwei.bestand).length === 4, [zwei.titelAbrufe, Object.keys(zwei.bestand)])
const reset = await lauf({ titles: sechs, antwort: 'treffer-mit-angebot', sperren: [true, true, false, true, true] }, ['--limit', '6', '--alter', '0'])
pruefe('429: ein Erfolg dazwischen setzt den Zähler zurück, alle sechs Titel werden gefragt', !reset.zeilen.some((z) => /Sperren in Folge/.test(z)) && reset.titelAbrufe === 6 && Object.keys(reset.bestand).length === 2, [reset.titelAbrufe, Object.keys(reset.bestand)])

process.chdir(tmpdir())
rmSync(wurzel, { recursive: true, force: true, maxRetries: 3 })
if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log(`check-jw-main-naht: ok (${geprueft} Prüfungen, main() im Prozess auf Kulisse mit Abruf-Attrappe: Kennung fremd, Limit, Alter, Namenssuche, nur Cartoons, Welt, Plausibilität, 429-Abbruch der Hauptschleife, Quellenstand, Liste)`)
