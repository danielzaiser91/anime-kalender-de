/**
 * Zusicherung: Ein Nein, das neu gemessen werden soll, steht wieder auf den Prüflisten der Erweiterung — mit der Adresse
 * aus Beleg oder Gedächtnis der entfernten Verweise, ohne den Beleg zu ändern; auf der Disney+-Liste stehen Wiedervorlagen
 * vorn, die laufende Synchro zuerst, dann das älteste Nein (`shared/nein-wiedervorlage.ts`). Läuft in `check:bestand` (baut ein Mini-Repo mit dem Layout `public/data`).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzelRepo = join(import.meta.dirname, '..')
const laden = (pfad: string) => import(pathToFileURL(join(wurzelRepo, pfad)).href)
const verdacht = await laden('tools/verdacht.mjs')
const bestand = await laden('tools/pruef-bestand.mjs')

/* Ein Mini-Repo: ein Titel ohne Disney+-Weg (sein Nein hat den Verweis genommen), ein Beleg weit über 28 Tage alt. */
const wurzel = mkdtempSync(join(tmpdir(), 'nein-liste-'))
mkdirSync(join(wurzel, 'public/data'), { recursive: true })
mkdirSync(join(wurzel, 'data'), { recursive: true })
const url = 'https://www.disneyplus.com/de-de/series/probe/AbCdEf123456'
writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify([{ id: 7, titleDe: 'Probe', streams: [] }, { id: 8, titleDe: 'Prime-Probe', streams: [] }]))
writeFileSync(join(wurzel, 'public/data/releases.json'), '[]')
const nein = (id: number, platform: string): string => `- anilistId: ${id}\n  platform: ${platform}\n  dub: false\n  checkedAt: '2026-01-05'\n`
writeFileSync(join(wurzel, 'data/dub-confirmed.yaml'), nein(7, 'disneyplus') + nein(8, 'primevideo'))
const partnerAdresse = 'https://www.amazon.de/dp/B0D84DKFSH?tag=anisearch.de-21'
const entfernt = [
  { titleId: 7, plattform: 'disneyplus', url, entferntAm: '2026-01-06' },
  { titleId: 8, plattform: 'primevideo', url: partnerAdresse, entferntAm: '2026-01-06' },
]
writeFileSync(join(wurzel, 'data/verweise-entfernt.json'), JSON.stringify({ verweise: entfernt }))
const belegVorher = readFileSync(join(wurzel, 'data/dub-confirmed.yaml'), 'utf8')

try {
  console.log('\nPrüfliste: das Nein kommt als Weg zurück')
  const titel = bestand.ladeBestand(wurzel)
  const weg = titel[0]?.streams?.find((s: { platform: string }) => s.platform === 'disneyplus')
  pruefe('der Titel trägt wieder einen Disney+-Weg mit der Adresse des entfernten Verweises', weg?.url === url, titel[0])
  pruefe('der Weg trägt sein Nein (dub: false)', weg?.dub === false, weg)
  const faelle = verdacht.verdachtsfaelle(wurzel, 'disneyplus')
  pruefe('der Titel steht als Wiedervorlage auf der Disney+-Liste', faelle.get(7)?.neinFrist?.grund === 'frist', [...faelle])
  pruefe('der Hinweis nennt Messdatum und Alter', /vom 2026-01-05 ist \d+ Tage alt/.test(verdacht.verdachtHinweis(faelle.get(7))), verdacht.verdachtHinweis(faelle.get(7)))
  const prime = titel[1]?.streams?.find((s: { platform: string }) => s.platform === 'primevideo')
  pruefe('Prime: die Partneradresse (/dp/…?tag=) wird zur Titelseite, die die Prüfliste kennt', prime?.url === 'https://www.amazon.de/gp/video/detail/B0D84DKFSH', prime)
  pruefe('für Netflix gilt der Fall nicht', verdacht.verdachtsfaelle(wurzel, 'netflix').size === 0)
  pruefe('der Beleg bleibt unverändert', readFileSync(join(wurzel, 'data/dub-confirmed.yaml'), 'utf8') === belegVorher)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log('\nDisney+-Liste: laufende Synchro zuerst, dann das älteste Nein, dann der Rest')
const rang = verdacht.verdachtRang
const folge = [
  { name: 'ohne', v: undefined },
  { name: 'Nein 09-20', v: { neinFrist: { messAm: '2026-09-20' }, seit: '2026-09-20' } },
  { name: 'laufend 10-02', v: { laufendeSynchro: { bis: 9, am: '2026-10-02' }, seit: '2026-10-09' } },
  { name: 'Nein 08-26', v: { neinFrist: { messAm: '2026-08-26' }, seit: '2026-08-26' } },
]
const geordnet = [...folge].sort((a, b) => rang(a.v)[0] - rang(b.v)[0] || rang(a.v)[1].localeCompare(rang(b.v)[1])).map((f) => f.name)
pruefe('laufend 10-02, Nein 08-26, Nein 09-20, ohne', geordnet.join(', ') === 'laufend 10-02, Nein 08-26, Nein 09-20, ohne', geordnet)
const liste = readFileSync(join(wurzelRepo, 'tools/extension-offene-disney.mjs'), 'utf8')
pruefe('extension-offene-disney.mjs ordnet die Liste mit verdachtRang', liste.includes('nachAlter(nachRang(') && liste.includes('verdachtRang(verdachtVon('))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('\nOK')
console.log('VERSTÖSSE: 0')
