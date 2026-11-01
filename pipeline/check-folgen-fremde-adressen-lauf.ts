/**
 * Der echte Lauf von `fetch-folgen-zuordnung.ts` (`--aus`, ohne Worker) gegen eine Kulisse in `os.tmpdir()` (`AK_ROOT`, cwd):
 * Die Folge an der Cartoon-Adresse bekommt keinen Titel, die an der eigenen Adresse schon, und eine frühere Zuordnung auf einen
 * Titel außerhalb von `titles.json` entfällt. Fängt, wenn der Lauf die Sperre nicht aufruft oder ihre Quellen leer ankommen.
 * Erfundene Kennungen ab 900000 und eine erfundene Adresse: Grün beweist, dass die Kulisse gelesen wird.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const EIGEN = 'https://www.amazon.de/gp/video/detail/B0KULISSE1'
const FREMD = 'https://www.disneyplus.com/browse/entity-00000000-kulisse-fremd'
/* Cartoon-Adresse, die ein Handbeleg auch für den eigenen Titel belegt (Sammelseite): bleibt offen. */
const SAMMEL = 'https://www.disneyplus.com/browse/entity-00000000-kulisse-sammel'
/* Adresse eines Handbelegs für einen Titel außerhalb von titles.json (`nichtImBestand`), deren Folgen den Namen eines eigenen Titels tragen (Mahouka, B0CWRDZVBY): bleibt gesperrt. */
const NICHTIMBESTAND = 'https://www.amazon.de/dp/B0KULISSE9'

const beobachtung = (id: number, url: string, asin: string) => ({
  id,
  plattform: 'primevideo',
  url,
  asin,
  gti: null,
  nummer: id,
  titel: `Kulissenfolge ${id}`,
  erschienen: null,
  titel_id: null,
  gemeldet_am: '2026-10-16T10:00:00Z',
})
/* Netflix-Folgen ohne gti: zwei an der eigenen Adresse (zählen), eine an der fremden (zählt als fremd). */
const ZUSATZ = [
  { ...beobachtung(6, 'https://www.netflix.com/title/900001', ''), plattform: 'netflix', asin: null, titel: 'Netflixfolge Sechs' },
  { ...beobachtung(7, 'https://www.netflix.com/title/900001', ''), plattform: 'netflix', asin: null, titel: 'Netflixfolge Sieben' },
  { ...beobachtung(8, FREMD, ''), plattform: 'netflix', asin: null, titel: 'Fremdfolge Acht' },
]

/*
  Aufgeteilte Staffel (31.10.2026): Die Meldung kennt nur den Reihennamen („Kulissenreihe“, Suchadresse), keinen Auftragstitel; die zwei Staffeln
  der Reihe heißen länger. Der Namensanfang führt zur Reihe, das Erscheinungsjahr 2018 der Folgen zur zweiten Staffel (900012).
*/
const REIHE_FOLGEN = [1, 2, 3].map((n) => ({
  ...beobachtung(20 + n, 'https://www.amazon.de/s?k=Kulissenreihe&i=instant-video', `KREIHE00${n}`),
  erschienen: '5. Mai 2018',
  seiten_kennung: 'KTEIL01',
  staffel_nr: 2,
}))

const kulisse = mkdtempSync(join(tmpdir(), 'ffa-lauf-'))
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
}
schreibe('public/data/titles.json', [
  {
    id: 900001,
    titleDe: 'Kulissenserie Eins',
    episodes: 12,
    streams: [
      { platform: 'primevideo', url: EIGEN },
      { platform: 'disneyplus', url: SAMMEL },
    ],
    watchLinks: [],
  },
  { id: 900002, titleDe: 'Kulissenserie Zwei', episodes: 13, streams: [], watchLinks: [] },
  { id: 900011, titleDe: 'Kulissenreihe Alpha', franchiseId: 900011, jpYear: 2015, episodes: 12, streams: [], watchLinks: [] },
  { id: 900012, titleDe: 'Kulissenreihe Beta', franchiseId: 900011, jpYear: 2018, episodes: 12, streams: [], watchLinks: [] },
])
schreibe('public/data/cartoons.json', [
  {
    id: -900100,
    titleDe: 'Kulissencartoon',
    streams: [
      { platform: 'disneyplus', url: FREMD },
      { platform: 'disneyplus', url: SAMMEL },
    ],
  },
])
schreibe('public/data/ohne-synchro.json', [])
schreibe('data/dub-confirmed.yaml', `- anilistId: 900001\n  url: ${SAMMEL}\n- anilistId: 900050\n  url: ${NICHTIMBESTAND}\n  nichtImBestand: true\n`)
schreibe('data/folgen-zuordnung.json', {
  'primevideo:ALTFREMD01': { titel: 900009, folge: 3, grund: 'titel', gesehen: '2026-09-01' },
  'primevideo:NBELEG0001': { titel: 900002, folge: 1, grund: 'titel', gesehen: '2026-09-01' },
})
schreibe('beobachtungen.json', [
  { results: [beobachtung(1, EIGEN, 'KULISSE001'), beobachtung(2, FREMD, 'KULISSE002'), beobachtung(3, FREMD, 'KULISSE003'), beobachtung(4, SAMMEL, 'KULISSE004'), { ...beobachtung(5, NICHTIMBESTAND, 'NBELEG0001'), titel: 'Kulissenserie Zwei I' }, ...ZUSATZ, ...REIHE_FOLGEN] },
])

const lauf = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/fetch-folgen-zuordnung.ts'), '--aus', join(kulisse, 'beobachtungen.json')], {
  cwd: kulisse,
  env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: '' },
  encoding: 'utf8',
  windowsHide: true,
  timeout: 120000,
})
const ausgabe = `${lauf.stdout}${lauf.stderr}`
let ergebnis: Record<string, { titel?: number; grund: string }> = {}
try {
  ergebnis = JSON.parse(readFileSync(join(kulisse, 'data/folgen-zuordnung.json'), 'utf8'))
} catch {
  /* bleibt leer, die Zusicherung „Lauf endete“ meldet es */
}
rmSync(kulisse, { recursive: true, force: true })

const fehler: string[] = []
const pruefe = (name: string, ok: boolean) => {
  if (!ok) fehler.push(name)
}
pruefe('Lauf endete mit Exit 0', lauf.status === 0)
pruefe('Folge an der eigenen Adresse ordnet dem Titel zu', ergebnis['primevideo:KULISSE001']?.titel === 900001)
pruefe('Folge an der Cartoon-Adresse bleibt ohne Titel', ergebnis['primevideo:KULISSE002']?.titel === undefined && ergebnis['primevideo:KULISSE002']?.grund === 'ohne-kandidat')
pruefe('zweite Folge an der Cartoon-Adresse ebenso', ergebnis['primevideo:KULISSE003']?.titel === undefined && ergebnis['primevideo:KULISSE003']?.grund === 'ohne-kandidat')
pruefe('frühere Zuordnung auf Titel außerhalb von titles.json entfällt', ergebnis['primevideo:ALTFREMD01']?.titel === undefined)
pruefe('Folge an der Sammelseite (Handbeleg für den eigenen Titel) bleibt zugeordnet', ergebnis['primevideo:KULISSE004']?.titel === 900001)
pruefe(
  'Folge an der Adresse eines Fremdbelegs (nichtImBestand) bleibt ohne Titel, auch wenn ein eigener Titel vorher dort stand',
  ergebnis['primevideo:NBELEG0001']?.titel === undefined && ergebnis['primevideo:NBELEG0001']?.grund === 'ohne-kandidat',
)
pruefe(
  'Teil ohne Auftragstitel: Reihenname führt zur Reihe, das Jahr zur Staffel (900012, Grund jahr)',
  [1, 2, 3].every((n) => ergebnis[`primevideo:KREIHE00${n}`]?.titel === 900012 && ergebnis[`primevideo:KREIHE00${n}`]?.grund === 'jahr'),
)
pruefe(
  'Lauf meldet die Zählung',
  ausgabe.includes('Fremde Adressen (Cartoon, ohne Synchro, fremder Beleg): 4 Beobachtungen und 3 Folgen ohne Zuordnung, 1 frühere Zuordnungen'),
)
pruefe('Lauf nennt je Titel, wie viele Einträge ihren Titel verlieren', ausgabe.includes('Titel-ID: Anzahl): 900002: 1, 900009: 1\n'))
pruefe(
  'Lauf meldet Beobachtungen ohne Kennung mit Beispielen (die fremde zählt dort, nicht hier)',
  ausgabe.includes('Beobachtungen ohne ASIN und gti (fallen aus der Zuordnung): 2 (z. B. netflix: Netflixfolge Sechs; netflix: Netflixfolge Sieben)\n'),
)
if (fehler.length) {
  console.error(`check-folgen-fremde-adressen-lauf: ${fehler.join('; ')}\n${ausgabe.slice(-1500)}`)
  process.exit(1)
}
console.log('check-folgen-fremde-adressen-lauf: 11 Zusicherungen grün, der Lauf sperrt Folgen an fremden Adressen und entfernt veraltete Zuordnungen.')
