/**
 * Der echte Ablauf von `fetch-rohfolgen.ts` mit kleinen Fixtures (Prüfer-Runde 2, PR 1348): Cartoon-Adresse, Handbeleg-Adresse
 * und unbekannte Adresse laufen durch das ganze Skript gegen eine Kulisse (`AK_ROOT`, Attrappe `tools/rohfolgen-ablauf-mock.mjs`).
 * Fängt, wenn die Cartoon-Zuordnung nicht aufgerufen wird oder ihre Quellen (cartoons.json, dub-confirmed.yaml) leer ankommen.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/rohfolgen-ablauf-mock.mjs')).href

const NETFLIX = 'https://www.netflix.com/title/70234440'
// Erfundene Adresse und Kennung: gibt es im echten Repo nicht, Grün beweist also, dass die Kulisse gelesen wird.
const DISNEY = 'https://www.disneyplus.com/browse/entity-00000000-kulisse-zebra'
const ANIME = 'https://www.netflix.com/title/777'
const FREMD = 'https://www.netflix.com/title/999'

const zeile = (id: number, url: string, sprachen: string[], plattform: string, titel?: string) => ({
  id,
  url,
  asin: null,
  gti: null,
  nummer: id,
  titel: titel ?? `Folge ${id}`,
  erschienen: null,
  dauer_sek: null,
  sprachen: JSON.stringify(sprachen),
  untertitel: null,
  staffel_text: null,
  staffel_nr: null,
  gemeldet_am: '2026-10-16T10:00:00Z',
  titel_id: null,
  plattform,
})

const rohfolgen = [
  zeile(1, NETFLIX, ['de|Deutsch', 'en|English'], 'netflix', 'Ausflug zum Leuchtturm'),
  zeile(2, NETFLIX, ['de|Deutsch', 'en|English'], 'netflix', 'Hitch und das Geheimnis'),
  zeile(3, DISNEY, ['en'], 'disneyplus'),
  // Ältere wörtliche Wiederholung von Zeile 5: veraltet, wird mit abgehakt, obwohl ihre Adresse offen bleibt.
  { ...zeile(5, FREMD, ['Deutsch'], 'primevideo'), id: 8, gemeldet_am: '2026-10-15T10:00:00Z' },
  zeile(4, DISNEY, ['en'], 'disneyplus'),
  zeile(5, FREMD, ['Deutsch'], 'primevideo'),
  zeile(6, FREMD, ['Deutsch'], 'primevideo'),
  zeile(7, ANIME, ['Deutsch'], 'netflix', 'Erste Kulissenfolge'),
  // Zeile aus dem Bungo-Vorfall (Meldungskopie 24.10.2026, id 18012): vor dem Staffelwechsel-Fix, „Staffel 1“ mit Nummer 5.
  {
    ...zeile(9, 'https://www.amazon.de/dp/B0BZGQZCFT', ['Deutsch'], 'primevideo', 'Die Zukunft ist unvorhersehbar und änderbar'),
    staffel_text: 'Staffel 1',
    staffel_nr: 5,
    gemeldet_am: '2026-09-10T06:49:16Z',
  },
]

const cartoons = [{ id: -100, titleDe: 'Testpony', streams: [{ platform: 'netflix', url: NETFLIX }] }]
const handbelege = `- anilistId: -987654
  title: "Kulissen-Zebra"
  platform: disneyplus
  url: ${DISNEY}
  dub: false
- anilistId: -987655
  title: "Anime-Adresse im Handbeleg"
  platform: netflix
  url: ${ANIME}
  dub: false
`

const anime = { id: 7, titleDe: 'Kulissen-Anime', streams: [{ platform: 'netflix', url: ANIME }] }

const kulisse = mkdtempSync(join(tmpdir(), 'rohfolgen-ablauf-'))
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
schreibe('rohfolgen.json', JSON.stringify(rohfolgen))
schreibe('public/data/titles.json', JSON.stringify([anime]))
schreibe('public/data/cartoons.json', JSON.stringify(cartoons))
schreibe('data/dub-confirmed.yaml', handbelege)
schreibe('data/cartoon-folgen.json', JSON.stringify({ '-100': { folgen: [{ s: 1, e: 1, en: 'Ausflug zum Leuchtturm' }, { s: 1, e: 2, en: 'Hitch und das Geheimnis' }] } }))

const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-rohfolgen.ts')], {
  cwd: wurzel,
  encoding: 'utf8',
  env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: 'test' },
})
const lies = (pfad: string) => JSON.parse(readFileSync(join(kulisse, pfad), 'utf8'))
const MERKER = 'data/cache/quittung-offen/rohfolgen-abhaken.json'
const FREI = 'data/cache/quittung-frei/rohfolgen-abhaken.json'
const abhaken = (status: number) =>
  spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/rohfolgen-abhaken.ts')], {
    cwd: wurzel,
    encoding: 'utf8',
    env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: 'test', AK_POST_STATUS: String(status) },
  })

/**
 * Der Zuordner merkt nur (17.10.2026); abgehakt wird erst, wenn `commit-data.sh` den Merker nach dem Commit freigegeben
 * hat — vorher schickt `rohfolgen-abhaken.ts` nichts ab, gleich wie es aufgerufen wird. Ein Fehlschlag beim Worker
 * lässt den Merker stehen, ein Erfolg räumt ihn weg.
 */
function pruefeAbhakenNachCommit(): string[] {
  const fehler: string[] = []
  if (existsSync(join(kulisse, 'post.json'))) fehler.push('der Zuordner hat selbst abgehakt — das darf erst nach dem Commit geschehen')
  const gemerkt = (lies(MERKER) as number[]).sort()
  if (JSON.stringify(gemerkt) !== '[1,2,3,4,7,8,9]') fehler.push(`gemerkt: ${JSON.stringify(gemerkt)}, erwartet [1,2,3,4,7,8,9]`)
  const vorher = abhaken(200)
  if (vorher.status !== 0 || existsSync(join(kulisse, 'post.json'))) fehler.push('vor der Freigabe abgehakt (Quittung vor dem Commit)')
  if (!existsSync(join(kulisse, MERKER))) fehler.push('Abhaken vor der Freigabe hat den Merker angefasst')
  mkdirSync(dirname(join(kulisse, FREI)), { recursive: true })
  renameSync(join(kulisse, MERKER), join(kulisse, FREI))
  abhaken(500)
  if (!existsSync(join(kulisse, FREI))) fehler.push('HTTP 500 beim Abhaken hat den Merker gelöscht')
  const lauf2 = abhaken(200)
  if (lauf2.status !== 0) fehler.push(`Abhaken endete mit ${lauf2.status}: ${lauf2.stderr.slice(-300)}`)
  const abgehakt = (lies('post.json') as { rohfolgenUebernommen: number[] }).rohfolgenUebernommen.sort()
  if (JSON.stringify(abgehakt) !== '[1,2,3,4,7,8,9]') fehler.push(`abgehakt: ${JSON.stringify(abgehakt)}, erwartet [1,2,3,4,7,8,9]`)
  if (existsSync(join(kulisse, FREI))) fehler.push('der Merker bleibt nach erfolgreichem Abhaken liegen')
  return fehler
}

const fehler: string[] = []
try {
  if (lauf.status !== 0) fehler.push(`Lauf endete mit ${lauf.status}: ${lauf.stderr.slice(-300)}`)
  const zugeordnet = lies('data/prime-zugeordnet.json') as Record<string, { titleId: number; folgen: { unsere: number | null }[] }>
  if (zugeordnet[`${NETFLIX}#0`]?.titleId !== -100 && zugeordnet[NETFLIX]?.titleId !== -100) fehler.push('Cartoon-Adresse nicht zugeordnet')
  const unsere = Object.values(zugeordnet).find((z) => z.titleId === -100)?.folgen.map((x) => x.unsere)
  if (JSON.stringify(unsere) !== '[1,2]') fehler.push(`Folgenliste nicht genutzt: ${JSON.stringify(unsere)}`)
  if (zugeordnet[DISNEY]?.titleId !== -987654) fehler.push('Handbeleg-Adresse nicht zugeordnet')
  if (Object.values(zugeordnet).some((z) => z.titleId === -987655)) fehler.push('Anime-Adresse landete im Handbeleg-Weg')
  if (zugeordnet[ANIME]?.titleId !== 7) fehler.push('Anime-Adresse nicht beim Anime-Weg zugeordnet')
  fehler.push(...pruefeAbhakenNachCommit())
  const offen = lies('data/prime-unzugeordnet.json') as { url: string; grund: string }[]
  if (offen.length !== 1 || offen[0]!.url !== FREMD) fehler.push('die unbekannte Adresse bleibt nicht als einziger Rest offen')
} catch (e) {
  fehler.push(`Ergebnis nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-rohfolgen-ablauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-rohfolgen-ablauf: Cartoon- und Handbeleg-Adresse zugeordnet, nach dem Commit abgehakt, Fremde bleibt offen.')
