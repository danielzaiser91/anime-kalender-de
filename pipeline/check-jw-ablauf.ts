/**
 * Ablauftest zur Verdrahtung von „Deutsch laut JustWatch“ im Bau (PR 1377, Auflage des Prüfers): Die Regel selbst steht in
 * `check-jw-seite.ts`; hier laufen die Bauphasen mit erfundenen Titeln auf einer Kulisse im Temp-Ordner (`AK_ROOT`) und die Ausgabe
 * wird zugesichert. Fiele ein Aufruf weg (`0 && …`, leere Argumente, falscher Schalter), bliebe sonst alles grün, weil null Flaggen
 * für die Bestandsprüfungen stimmig sind.
 *
 * Cartoons: `schreibeCartoons` (nebendateien.ts → cartoon-jw-seite.ts). Anime: `schliesseWegeAb` (11-wege-abschluss.ts → 11-6-jw-vertrauen.ts).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, StreamLink, Title } from '../shared/types.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'jw-ablauf-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(wurzel, 'data', 'shop-wege-falsches-ziel.yaml'), '[]\n')

const { todayIso } = await import('../shared/time.ts')
const HEUTE = todayIso()
const disney = (n: number) => `https://www.disneyplus.com/de-de/series/erfunden/Kennung${n}`
const crunchy = (n: number) => `https://www.crunchyroll.com/de/series/GJWABLAUF${n}/erfunden`
const staffel = (nr: number) => ({ nr, folgen: 10, angebote: [] })

function befund(url: string, anbieter: string, staffeln: number, audio = ['de', 'ja']) {
  return {
    jwId: `ts-${url}`,
    jwPfad: '/de/Serie/erfunden',
    geprueftAm: HEUTE,
    angebote: [{ anbieter, art: 'FLATRATE', audio, url }],
    staffeln: Array.from({ length: staffeln }, (_, i) => staffel(i + 1)),
  }
}

const cartoon = (id: number, staffeln: number, anbieter: string) => [
  String(id),
  {
    id,
    tmdbId: -id,
    titleEn: `Erfunden ${id}`,
    genres: ['Animation'],
    anbieterDe: [anbieter],
    land: ['US'],
    studios: [],
    keywords: [],
    geholtAm: HEUTE,
    episodes: 10 * staffeln,
    staffeln: Array.from({ length: staffeln }, (_, i) => ({ nr: i + 1, folgen: 10 })),
  },
]

/** Cartoons: -1 eine Staffel (Flagge), -2 zwei Staffeln (nur Hinweis am Titel), -3 Messurteil „nein“ (Widerspruch), -4 Handbeleg „nein“ (Weg weg, Widerspruch). */
const CARTOONS = [-1, -2, -3, -4]
writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify(Object.fromEntries(CARTOONS.map((id) => cartoon(id, id === -2 ? 2 : 1, id < -2 ? 'Crunchyroll' : 'Disney Plus')))))
const alleBefunde: Record<string, unknown> = {
  '-1': befund(disney(1), 'Disney Plus', 1),
  '-2': befund(disney(2), 'Disney Plus', 2),
  '-3': befund(crunchy(13), 'Crunchyroll', 1),
  '-4': befund(crunchy(14), 'Crunchyroll', 1),
  '101': befund(crunchy(1), 'Crunchyroll', 1),
  '102': befund(crunchy(2), 'Crunchyroll', 2),
  '103': befund(disney(103), 'Disney Plus', 1),
  '104': befund(crunchy(4), 'Crunchyroll', 1),
  '105': befund(disney(105), 'Disney Plus', 1),
}
writeFileSync(join(wurzel, 'data', 'justwatch-audio.json'), JSON.stringify(alleBefunde))
writeFileSync(
  join(wurzel, 'data', 'urteile.json'),
  JSON.stringify({ '-3|crunchyroll|1': { urteil: 'kein deutsch' }, '103|disneyplus|1': { urteil: 'kein deutsch' } }),
)
writeFileSync(
  join(wurzel, 'data', 'dub-confirmed.yaml'),
  `- anilistId: -4\n  platform: crunchyroll\n  dub: false\n  url: ${crunchy(14)}\n  checkedAt: '2026-10-01'\n`,
)

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Der Abschnitt einer Phase aus der Widerspruchs-Liste. */
function listenAbschnitt(art: 'anime' | 'cartoons'): string {
  const text = readFileSync(join(wurzel, 'daniel-zum-abarbeiten', 'listen', 'justwatch-widersprueche.md'), 'utf8')
  return new RegExp(`<!-- ${art}:start -->[\\s\\S]*?<!-- ${art}:end -->`).exec(text)?.[0] ?? ''
}

/** Nur die Tabelle „Widersprüche“ (die Kandidaten darunter nennen dieselben Titel). */
function widerspruchsTabelle(abschnitt: string): string {
  return /### Widersprüche[\s\S]*?### Kandidaten/.exec(abschnitt)?.[0] ?? ''
}

const stream = (t: Title | undefined, platform: string): StreamLink | undefined => t?.streams?.find((s) => s.platform === platform)
const zustand = (s: StreamLink | undefined) => (s ? { quelle: s.dubQuelle, hinweis: s.dubHintOnly, dub: s.dub } : undefined)

{
  const { schreibeCartoons } = await import('./bau/nebendateien.ts')
  schreibeCartoons()
  const titel = JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'cartoons.json'), 'utf8')) as Title[]
  const je = (id: number) => titel.find((t) => t.id === id)
  const abschnitt = listenAbschnitt('cartoons')
  const liste = widerspruchsTabelle(abschnitt)

  console.log('\nCartoons (schreibeCartoons):')
  const eins = stream(je(-1), 'disneyplus')
  pruefe('eine Staffel und „de“ an derselben Seite: Flagge', eins?.dubQuelle === 'justwatch' && !eins.dubHintOnly && eins.dub === undefined, zustand(eins))
  pruefe('die Flagge trägt den Stand des Befunds', eins?.dubStand === HEUTE, eins?.dubStand)
  const zwei = stream(je(-2), 'disneyplus')
  pruefe('zwei Staffeln: keine Flagge am Weg', zwei !== undefined && zwei.dubQuelle === undefined, zustand(zwei))
  pruefe('zwei Staffeln: der Hinweis steht am Titel', Boolean(je(-2)?.dubHinweis), je(-2)?.dubHinweis)
  pruefe('Messurteil „nein“ schlägt JustWatch-„de“: keine Flagge', stream(je(-3), 'crunchyroll')?.dubQuelle === undefined, zustand(stream(je(-3), 'crunchyroll')))
  pruefe('Messurteil „nein“ steht in der Widerspruchsliste', liste.includes('(-3)'))
  pruefe('Handbeleg „nein“: der Weg ist entfernt, keine Flagge', stream(je(-4), 'crunchyroll') === undefined)
  pruefe('Handbeleg „nein“ (Weg entfernt) steht in der Widerspruchsliste', liste.includes('(-4)'))
  pruefe('Flagge, Mehrstaffel und Staffel-Titel stehen nicht in der Widerspruchsliste', !liste.includes('(-1)') && !liste.includes('(-2)'))
  pruefe('die Liste zählt genau eine Flagge, keinen Hinweis', abschnitt.includes('Flagge „Deutsch“: 1 Wege, nur Hinweis: 0.'), abschnitt.split('\n').find((z) => z.startsWith('Flagge')))
}

try {
  const { schliesseWegeAb } = await import('./bau/11-wege-abschluss.ts')
  /* 103 liegt bei Disney+, damit sein Widerspruch den Wächter von Crunchyroll (101, 102, 104) nicht mit abschaltet; 105 hat seinen Weg dieser Seite durch den Handbeleg „nein“ verloren und nur noch einen an anderer Seite. */
  const streamsVon = (id: number): StreamLink[] => {
    if (id === 105) return [{ platform: 'disneyplus', url: disney(999) }] as StreamLink[]
    return [id === 103 ? { platform: 'disneyplus', url: disney(id) } : { platform: 'crunchyroll', url: crunchy(id - 100) }] as StreamLink[]
  }
  const anime = (id: number) => ({ id, titleRomaji: `Erfunden ${id}`, jpYear: 2024, streams: streamsVon(id), keywords: [], genres: [], watchLinks: [] }) as unknown as Title
  const titles = new Map([101, 102, 103, 104, 105].map((id) => [id, anime(id)]))
  const checks = [{ anilistId: 105, platform: 'disneyplus', dub: false, url: disney(105), checkedAt: '2026-10-01' }] as DubCheck[]
  schliesseWegeAb({
    titles,
    anisearch: {},
    releases: [] as Release[],
    zugangJeAdresse: new Map(),
    tmdbMehrdeutig: new Set(['104']),
    toteAdressen: new Set(),
    linkBefunde: {},
    verweiseEntfernt: [],
    crAdresseZu: () => undefined,
    beantworteteSuchen: new Set(),
    suchOffen: [],
    alleChecks: checks,
    lautPruefungTot: () => false,
    checksJePlattform: new Map(),
    belegFuer: () => undefined,
  })
  const liste = readFileSync(join(wurzel, 'daniel-zum-abarbeiten', 'listen', 'justwatch-widersprueche.md'), 'utf8')
  const anime1 = widerspruchsTabelle(listenAbschnitt('anime'))
  const cr = (id: number) => stream(titles.get(id), id === 103 ? 'disneyplus' : 'crunchyroll')

  console.log('\nAnime (schliesseWegeAb):')
  pruefe('eine Staffel und „de“ an derselben Seite: Flagge', cr(101)?.dubQuelle === 'justwatch' && !cr(101)?.dubHintOnly, zustand(cr(101)))
  pruefe('mehrere Staffeln: nur Hinweis „laut JustWatch“', cr(102)?.dubQuelle === 'justwatch' && cr(102)?.dubHintOnly === true, zustand(cr(102)))
  pruefe('Messurteil „nein“ schlägt JustWatch-„de“: keine Flagge', cr(103)?.dubQuelle === undefined, zustand(cr(103)))
  pruefe('Messurteil „nein“ steht in der Widerspruchsliste', anime1.includes('(103)'))
  pruefe('TMDB-mehrdeutiger Titel bleibt ohne Kennzeichnung', cr(104)?.dubQuelle === undefined, zustand(cr(104)))
  pruefe('Handbeleg „nein“ (Weg entfernt) steht in der Widerspruchsliste', anime1.includes('(105)'))
  pruefe('keine Flagge am Titel mit Handbeleg „nein“', cr(105)?.dubQuelle === undefined, zustand(cr(105)))
  pruefe('Anime- und Cartoon-Abschnitt stehen beide in der Liste', liste.includes('<!-- anime:start -->') && liste.includes('<!-- cartoons:start -->'))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
