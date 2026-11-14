/**
 * Zusicherung (14.11.2026, The Vermilion Mask Folge 3): Nach dem Ende des Simulcast-Kalenders (Fenster bis 21.10.2026)
 * urteilt `termine-pruefen.ts` über den Katalog (`crunchyroll-neu.json`), und eine Ankündigung des Wochenprogramms
 * bestätigt keinen Termin. Das Skript läuft beim Import los und liest feste Pfade, deshalb läuft es als eigener Prozess
 * in einer Kopie mit Fixture-Daten (kein Netz, kein echter Bestand). Je Fall eine eigene Serie.
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-termine-katalog-lauf.ts`
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(fileURLToPath(new URL('..', import.meta.url)))
const arbeit = mkdtempSync(join(tmpdir(), 'termine-katalog-'))
let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(join(arbeit, pfad, '..'), { recursive: true })
  writeFileSync(join(arbeit, pfad), JSON.stringify(inhalt))
}

const GEHOLT = '2026-11-14T10:00:00.000Z'
interface Fall {
  slug: string
  date?: string
  time?: string
  episode?: number
  estimated?: boolean
  observed?: Record<string, string>
  staffeln?: string[]
}
/* Ohne Angabe: geschätzter Termin am 14.11. 10:30 (09:30 UTC), Folge 3, Katalog führt Folge 1 in Staffel 1. */
const faelle: Fall[] = [
  { slug: 'verm', estimated: false, observed: { 3: '2026-11-14' } },
  { slug: 'da' },
  { slug: 'nurrel', estimated: false, observed: { 3: '2026-11-14' } },
  { slug: 'kalohne' },
  { slug: 'kalrel', observed: { 3: '2026-11-14' } },
  { slug: 'spanne', estimated: false, episode: 4 },
  { slug: 'geholt', time: '10:45' },
  { slug: 'zufrueh', time: '10:46' },
  { slug: 'tag', date: '2026-11-13', time: '11:45' },
  { slug: 'tagdrueber', date: '2026-11-13', time: '11:44' },
  { slug: 'bookworm', staffeln: ['Staffel 4'] },
  { slug: 'leer', staffeln: [] },
  { slug: 'gemischt', staffeln: ['Staffel 1', 'Staffel 2'] },
  { slug: 'imfenster', date: '2026-10-15' },
  { slug: 'vorher', date: '2026-10-01' },
  { slug: 'nach', date: undefined, observed: { 3: '2026-11-14' } },
  { slug: 'nachkat', date: undefined },
]
const kennung = (slug: string) => `G${slug.toUpperCase()}`
const ADRESSE = (slug: string) => `https://www.crunchyroll.com/de/series/${kennung(slug)}/`

try {
  mkdirSync(join(arbeit, 'pipeline', 'bau'), { recursive: true })
  cpSync(join(wurzel, 'pipeline', 'termine-pruefen.ts'), join(arbeit, 'pipeline', 'termine-pruefen.ts'))
  cpSync(join(wurzel, 'pipeline', 'lib'), join(arbeit, 'pipeline', 'lib'), { recursive: true })
  cpSync(join(wurzel, 'shared'), join(arbeit, 'shared'), { recursive: true })
  cpSync(join(wurzel, 'pipeline', 'bau', 'widerlegung-staffel.ts'), join(arbeit, 'pipeline', 'bau', 'widerlegung-staffel.ts'))
  cpSync(join(wurzel, 'pipeline', 'bau', 'remake-von.ts'), join(arbeit, 'pipeline', 'bau', 'remake-von.ts'))
  cpSync(join(wurzel, 'package.json'), join(arbeit, 'package.json'))
  mkdirSync(join(arbeit, 'daniel-zum-abarbeiten', 'listen'), { recursive: true })
  symlinkSync(join(wurzel, 'node_modules'), join(arbeit, 'node_modules'), 'junction')

  const mitTermin = faelle.filter((f) => !f.slug.startsWith('nach'))
  schreibe(
    'public/data/events.json',
    mitTermin.map((f, i) => ({ id: `${f.slug}@${f.date ?? '2026-11-14'}`, releaseSlug: f.slug, titleId: 900100 + i, name: f.slug, platform: 'crunchyroll', date: f.date ?? '2026-11-14', time: f.time ?? '10:30', episode: f.episode ?? 3, estimated: f.estimated ?? true })),
  )
  schreibe('public/data/releases.json', faelle.map((f, i) => ({ slug: f.slug, titleId: 900100 + i, platformUrl: ADRESSE(f.slug), schedule: { observed: f.observed } })))
  /* Jeder Titel steht allein in seiner Reihe: Der Lauf sucht im Katalog Staffel 1. */
  schreibe('public/data/titles.json', faelle.map((f, i) => ({ id: 900100 + i, franchiseId: 900100 + i, titleDe: f.slug })))
  schreibe('data/crunchyroll-neu.json', {
    geholtAm: GEHOLT,
    folgen: [
      ...faelle.flatMap((f) => (f.staffeln ?? ['Staffel 1']).map((staffel) => ({ serieId: kennung(f.slug), serie: f.slug, staffel, nummer: 1, verfuegbarAb: '2026-10-31T09:30:00.000Z', gesehenAm: '2026-10-31' }))),
      { serieId: kennung('da'), serie: 'da', staffel: 'Staffel 1', nummer: 3, verfuegbarAb: '2026-11-14T09:30:00.000Z', gesehenAm: '2026-11-14' },
      { serieId: kennung('nachkat'), serie: 'nachkat', staffel: 'Staffel 1', nummer: 2, verfuegbarAb: '2026-11-13T09:30:00.000Z', gesehenAm: '2026-11-13' },
    ],
  })
  /* Der Kalender ist tot: Fenster bis 21.10.; er führt nur noch Ankündigungen des Wochenprogramms (`quelle: 'woche'`). */
  const woche = (slug: string, episode?: number) => ({ seriesUrl: `${ADRESSE(slug)}${slug}`, observations: [{ date: '2026-11-14', ...(episode ? { episode } : {}), quelle: 'woche' }] })
  schreibe('data/crunchyroll.json', {
    scrapedAt: '2026-10-21T08:00:00.000Z',
    window: { from: '2026-10-12', to: '2026-10-21' },
    german: { a: woche('verm', 3), b: woche('kalohne'), c: woche('kalrel', 3) },
    slots: [],
  })
  schreibe('data/crunchyroll-woche.json', { uebernommen: [{ seriesId: kennung('verm'), episode: 3, date: '2026-11-14' }] })
  const zeile = (slug: string, von: number, bis: number) => ({ seriesId: kennung(slug), titel: slug, von, bis, datum: '2026-11-14', zeit: '10:30', artikel: 'https://x/', erstmalsAm: '2026-11-10T10:00:00.000Z', bild: `${slug}.webp`, bildAm: '2026-11-10T10:05:00.000Z' })
  schreibe('data/crunchyroll-woche-belege.json', { a: zeile('verm', 3, 3), b: zeile('nurrel', 3, 3), c: zeile('spanne', 3, 5), d: zeile('nach', 3, 3) })
  const offen = (slug: string) => ({ id: `${slug}@2026-11-07`, slug, titleId: 1, name: slug, platform: 'crunchyroll', episode: 2, erwartetAm: '2026-11-07T09:30:00.000Z', bemerktAm: '2026-11-07T12:00:00.000Z', erschienenAm: null })
  schreibe('data/termine-verpasst.json', [offen('nach'), offen('nachkat')])

  const umgebung = { ...process.env, BESTAND_ERLAUBT: '', BESTAND_SPUR: '' }
  const lauf = spawnSync(process.execPath, [join(arbeit, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'pipeline/termine-pruefen.ts', '--jetzt', '2026-11-14T11:00:00Z'], { cwd: arbeit, encoding: 'utf8', env: umgebung, timeout: 120_000 })
  const dateiPfad = join(arbeit, 'data', 'termine-verpasst.json')
  const vermerke = existsSync(dateiPfad) ? (JSON.parse(readFileSync(dateiPfad, 'utf8')) as { slug: string; erschienenAm: string | null; geprueftAm?: string; gestrichen?: boolean }[]) : []
  const je = (slug: string) => vermerke.find((v) => v.slug === slug)
  const vermerkt = vermerke.map((v) => v.slug).sort()
  console.log('\ntermine-pruefen.ts als Prozess, Kalender tot, Katalog vom 14.11. 11:00:')
  pruefe('der Lauf endet ohne Fehler, Logzeile nennt 8 neue Vermerke und den Katalogstand', lauf.status === 0 && lauf.stdout.includes('8 Termin(e) neu als verpasst vermerkt') && lauf.stdout.includes(`danach Katalog vom ${GEHOLT}`), { status: lauf.status, aus: lauf.stdout.slice(-400), fehler: lauf.stderr.slice(-400) })
  const soll = ['geholt', 'imfenster', 'kalohne', 'kalrel', 'nach', 'nachkat', 'nurrel', 'spanne', 'tag', 'verm']
  pruefe('genau die erwarteten Termine stehen als verpasst', JSON.stringify(vermerkt) === JSON.stringify(soll), vermerkt)
  pruefe('Vermilion-Fall: angekündigt (Woche, Kalender, observed), Katalog ohne Folge 3 → nicht erschienen, nachgesehen = Katalogstand', je('verm')?.erschienenAm === null && je('verm')?.geprueftAm === GEHOLT, je('verm'))
  pruefe('Katalog zeigt Folge 3 pünktlich → kein Vermerk', !je('da'))
  pruefe('ein Folgentag aus dem Wochenprogramm-Beleg (observed) bestätigt nicht', je('nurrel')?.erschienenAm === null, je('nurrel'))
  pruefe('ein Kalendereintrag mit quelle „woche“ ohne Folge bestätigt nicht', je('kalohne')?.erschienenAm === null, je('kalohne'))
  pruefe('eine Kalender-Ankündigung macht den gleichlautenden Folgentag (observed) zur Ankündigung', je('kalrel')?.erschienenAm === null, je('kalrel'))
  pruefe('eine Belegzeile „Folge 3–5“ macht Folge 4 prüfbar', je('spanne') !== undefined, vermerkt)
  pruefe('Katalog genau zur Frist geholt → Urteil; eine Minute vor der Frist → kein Urteil', je('geholt') !== undefined && !je('zufrueh'), vermerkt)
  pruefe('Frist genau 24 h her → Urteil; 24 h + 1 min → kein Urteil (Katalog sieht nur die jüngsten Folgen)', je('tag') !== undefined && !je('tagdrueber'), vermerkt)
  pruefe('Katalog führt die Serie in anderer Staffel (Bookworm „Staffel 4“) → kein Urteil', !je('bookworm'))
  pruefe('Katalog kennt die Serie nicht → kein Urteil', !je('leer'))
  pruefe('Katalog führt die Serie in zwei Staffeln → kein Urteil', !je('gemischt'))
  pruefe('im Kalenderfenster urteilt der Lauf wie bisher, davor nicht', je('imfenster') !== undefined && !je('vorher'), vermerkt)
  pruefe('ein offener Vermerk wird nicht über eine Ankündigung nachgeholt', je('nach')?.erschienenAm === null && !je('nach')?.gestrichen, je('nach'))
  pruefe('ein offener Vermerk wird über den Katalog nachgeholt (Kontrolle)', je('nachkat')?.erschienenAm === '2026-11-13T09:30:00.000Z', je('nachkat'))
} finally {
  rmSync(arbeit, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
