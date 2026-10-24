/**
 * Verdrahtung: `fetch-rohfolgen.ts` teilt eine Netflix-Adresse nach Staffel (`lib/netflix-staffeln.ts`), 16.10.2026.
 * Das ganze Skript läuft gegen eine Kulisse (`AK_ROOT`, Attrappe `tools/rohfolgen-ablauf-mock.mjs`): Zwei Titel an einer
 * Adresse, Netflix meldet Staffel 1 (12) und 2 (13). Fehlt der Aufruf im Skript, bleibt die Adresse „2 Titel teilen diese Adresse".
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/rohfolgen-ablauf-mock.mjs')).href

// Erfundene Adressen und Kennungen: gibt es im echten Repo nicht.
const URL_DREI = 'https://www.netflix.com/title/700000001'
const URL_ZWEI = 'https://www.netflix.com/title/700000002'
// Uneinheitliche Tonspuren: darf nicht als Beleg für den Titel gelten.
const URL_VIER = 'https://www.netflix.com/title/700000003'
// Lücke wie My Hero Academia: bei uns Staffel 1 und 6, das Menü führt sieben.
const URL_LUECKE = 'https://www.netflix.com/title/700000004'
// Devil May Cry: bei uns [12, 8], Netflix führt [8, 8]; gemeldet wird Netflix' Staffel 2 (8 Folgen).
const URL_DMC = 'https://www.netflix.com/title/700000005'
let id = 0
const zeilen = (url: string, nr: number, text: string, anzahl: number, titelVorsatz: string, von: number, englischAb = anzahl) =>
  Array.from({ length: anzahl }, (_, i) => ({
    id: ++id,
    url,
    asin: null,
    gti: null,
    nummer: i + 1,
    titel: `${titelVorsatz} ${i + 1}`,
    erschienen: null,
    dauer_sek: null,
    sprachen: JSON.stringify(i >= englischAb ? ['en|English'] : ['de|Deutsch']),
    untertitel: null,
    staffel_text: `${text} · von ${von}`,
    staffel_nr: nr,
    gemeldet_am: '2026-10-16T10:00:00Z',
    titel_id: null,
    plattform: 'netflix',
  }))

const titel = (tid: number, jpYear: number, episodes: number, url: string, name: string, franchiseId: number) => ({
  id: tid,
  franchiseId,
  titleDe: name,
  jpYear,
  episodes,
  format: 'TV',
  streams: [{ platform: 'netflix', url }],
})

// Mitte und hinten: Staffel 2 von dreien und Staffel 2 von zweien; die Folgenzahl der Staffel 3 passt nicht.
const rohfolgen = [
  ...zeilen(URL_DREI, 2, 'Staffel 2 (13 Folgen)', 13, 'Zebra', 3),
  ...zeilen(URL_ZWEI, 1, 'Staffel 1 (12 Folgen)', 12, 'Quokka', 2),
  ...zeilen(URL_ZWEI, 2, 'Staffel 2 (13 Folgen)', 13, 'Okapi', 2),
  ...zeilen(URL_VIER, 1, 'Staffel 1 (12 Folgen)', 12, 'Gnu', 2, 6),
  ...zeilen(URL_VIER, 2, 'Staffel 2 (13 Folgen)', 13, 'Emu', 2, 6),
  ...zeilen(URL_LUECKE, 2, 'Staffel 2 (25 Folgen)', 25, 'Yak', 7),
  ...zeilen(URL_DMC, 2, 'Staffel 2 (8 Folgen)', 8, 'Dachs', 2),
]
const titles = [
  titel(7001, 2021, 12, URL_DREI, 'Zebra eins', 1),
  titel(7002, 2023, 13, URL_DREI, 'Zebra zwei', 1),
  titel(7003, 2025, 9, URL_DREI, 'Zebra drei', 1),
  titel(7011, 2023, 12, URL_ZWEI, 'Quokka eins', 2),
  titel(7012, 2025, 13, URL_ZWEI, 'Quokka zwei', 2),
  titel(7021, 2023, 12, URL_VIER, 'Gnu eins', 3),
  titel(7022, 2025, 13, URL_VIER, 'Gnu zwei', 3),
  titel(7031, 2016, 13, URL_LUECKE, 'Yak eins', 4),
  titel(7032, 2022, 25, URL_LUECKE, 'Yak sechs', 4),
  titel(7041, 2007, 12, URL_DMC, 'Dachs alt', 5),
  titel(7042, 2025, 8, URL_DMC, 'Dachs neu', 5),
]

const kulisse = mkdtempSync(join(tmpdir(), 'netflix-staffel-ablauf-'))
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
schreibe('rohfolgen.json', JSON.stringify(rohfolgen))
schreibe('public/data/titles.json', JSON.stringify(titles))
schreibe('public/data/cartoons.json', '[]')
schreibe('data/dub-confirmed.yaml', '[]\n')
schreibe('data/cartoon-folgen.json', '{}')
// Netflix' Staffellisten (data/anbieter-staffeln.json): die Zuordnung gilt nur, wo unsere Folgenzahlen Position für Position gleichen.
const liste = (folgen: number[]) => ({ staffeln: folgen.map((f, i) => ({ seq: i + 1, folgen: f })) })
schreibe(
  'data/anbieter-staffeln.json',
  JSON.stringify({
    '700000001': liste([12, 13, 9]),
    '700000002': liste([12, 13]),
    '700000003': liste([12, 13]),
    '700000004': liste([13, 1, 1, 1, 1, 25, 1]),
    '700000005': liste([8, 8]),
  }),
)

const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-rohfolgen.ts')], {
  cwd: wurzel,
  encoding: 'utf8',
  env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: 'test' },
})
const lies = (pfad: string) => JSON.parse(readFileSync(join(kulisse, pfad), 'utf8'))
const fehler: string[] = []
try {
  if (lauf.status !== 0) fehler.push(`Lauf endete mit ${lauf.status}: ${lauf.stderr.slice(-300)}`)
  const zugeordnet = lies('data/prime-zugeordnet.json') as Record<string, { titleId: number }>
  const ziel = (schluessel: string) => zugeordnet[schluessel]?.titleId
  if (ziel(`${URL_DREI}#s2`) !== 7002) fehler.push(`Staffel 2 von dreien (Mitte): ${ziel(`${URL_DREI}#s2`)}, erwartet 7002`)
  if (ziel(`${URL_ZWEI}#s1`) !== 7011) fehler.push(`Staffel 1 von zweien (vorn): ${ziel(`${URL_ZWEI}#s1`)}, erwartet 7011`)
  if (ziel(`${URL_ZWEI}#s2`) !== 7012) fehler.push(`Staffel 2 von zweien (hinten): ${ziel(`${URL_ZWEI}#s2`)}, erwartet 7012`)
  const offen = lies('data/prime-unzugeordnet.json') as { url: string }[]
  const offenUrls = [...new Set(offen.map((o) => o.url))].sort()
  if (offenUrls.join() !== [URL_VIER, URL_LUECKE, URL_DMC].sort().join()) fehler.push(`offen: ${offenUrls.join(' ')}, erwartet die uneinheitliche, die Lücken- und die Devil-May-Cry-Adresse`)
  const belegt = Object.keys(zugeordnet).filter((k) => k.startsWith(URL_VIER) || k.startsWith(URL_LUECKE) || k.startsWith(URL_DMC))
  if (belegt.length) fehler.push(`uneinheitliche Töne oder Lücke trotzdem zugeordnet: ${belegt.join(' ')}`)
  const abgehakt = (lies('data/cache/rohfolgen-abhaken.json') as number[]).length
  const zugeordneteZeilen = rohfolgen.filter((z) => z.url === URL_DREI || z.url === URL_ZWEI).length
  if (abgehakt !== zugeordneteZeilen) fehler.push(`abgehakt: ${abgehakt}, erwartet ${zugeordneteZeilen} (offene bleiben im Briefkasten; seit 17.10. merkt der Zuordner nur, abgehakt wird nach dem Commit)`)
} catch (e) {
  fehler.push(`Ergebnis nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-netflix-staffel-ablauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-netflix-staffel-ablauf: drei Netflix-Staffeln an zwei Adressen zugeordnet; uneinheitliche Töne und eine Lücke bleiben offen.')
