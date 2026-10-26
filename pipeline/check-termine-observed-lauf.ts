/**
 * Zusicherung (16.10.2026): `termine-pruefen.ts` schließt und vermeidet Vermerke auch über `schedule.observed` der Veröffentlichung,
 * nicht nur über den Simulcast-Kalender (Das Band der Unterwelt: Folgen 22–24 pünktlich, trotzdem „ausgeblieben"). Läuft wie
 * `check-termine-woche-lauf.ts` als eigener Prozess in einer Kopie mit Fixture-Daten, ohne Netz und ohne echten Bestand.
 * Jetzt = 05.11. 00:30 Berlin, aber noch der 04.11. in UTC: eine Beobachtung vom 05.11. zählt (Berliner Tag), eine vom 06.11. nicht.
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-termine-observed-lauf.ts`
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(fileURLToPath(new URL('..', import.meta.url)))
const arbeit = mkdtempSync(join(tmpdir(), 'termine-observed-'))
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

interface Vermerk {
  titleId: number
  name: string
  platform: string
  bemerktAm: string
  folgenVerfuegbar: number | null
  neuErwartet: string | null
  recherche: string | null
  id: string
  slug: string
  episode: number | null
  erwartetAm: string
  erschienenAm: string | null
  verzugStunden: number | null
}

try {
  mkdirSync(join(arbeit, 'pipeline'), { recursive: true })
  cpSync(join(wurzel, 'pipeline', 'termine-pruefen.ts'), join(arbeit, 'pipeline', 'termine-pruefen.ts'))
  cpSync(join(wurzel, 'pipeline', 'lib'), join(arbeit, 'pipeline', 'lib'), { recursive: true })
  cpSync(join(wurzel, 'shared'), join(arbeit, 'shared'), { recursive: true })
  mkdirSync(join(arbeit, 'pipeline', 'bau'), { recursive: true })
  cpSync(join(wurzel, 'pipeline', 'bau', 'widerlegung-staffel.ts'), join(arbeit, 'pipeline', 'bau', 'widerlegung-staffel.ts'))
  cpSync(join(wurzel, 'package.json'), join(arbeit, 'package.json'))
  mkdirSync(join(arbeit, 'daniel-zum-abarbeiten', 'listen'), { recursive: true })
  symlinkSync(join(wurzel, 'node_modules'), join(arbeit, 'node_modules'), 'junction')

  const release = (slug: string, kennung: string, observed?: Record<number, string>) => ({
    slug,
    platformUrl: `https://www.crunchyroll.com/de/series/${kennung}/`,
    schedule: { firstEpisodeDate: '2026-04-01', ...(observed ? { observed } : {}) },
  })
  const vermerk = (slug: string, episode: number, erwartetAm: string): Vermerk => ({
    id: `${slug}@${erwartetAm.slice(0, 10)}`,
    slug,
    titleId: 1,
    name: slug,
    platform: 'crunchyroll',
    episode,
    erwartetAm,
    bemerktAm: erwartetAm,
    erschienenAm: null,
    verzugStunden: null,
    folgenVerfuegbar: null,
    neuErwartet: null,
    recherche: null,
  })
  const ereignis = { id: 'gleich@2026-10-14', releaseSlug: 'gleich', titleId: 1, name: 'gleich', platform: 'crunchyroll', date: '2026-10-14', time: '19:25', episode: 12, estimated: true }
  schreibe('public/data/events.json', [ereignis])
  schreibe('public/data/releases.json', [
    release('gleich', 'GGLEICH', { 12: '2026-10-14' }),
    release('spaet', 'GSPAET', { 12: '2026-10-16' }),
    release('punkt', 'GPUNKT', { 12: '2026-10-14' }),
    release('mitternacht', 'GMITTERNACHT', { 3: '2026-11-05' }),
    release('zukunft', 'GZUKUNFT', { 5: '2026-11-06' }),
    release('frueher', 'GFRUEHER', { 12: '2026-10-10' }),
    release('ohne', 'GOHNE'),
    { ...release('aristocrat-s3', 'GG5H5XQMD'), titleId: 185756 },
    { ...release('aristocrat-s2', 'GG5H5XQMD'), titleId: 178434 },
  ])
  /* Die drei Titel der echten Reihe (Staffelnummer kommt aus der Reihe) und die echte Katalogzeile von Folge 2 (crunchyroll-neu.json, 26.10.2026). */
  const reihe = (id: number, titleEn: string, titleRomaji: string, jpYear: number, episodes?: number) => ({
    id,
    franchiseId: 164702,
    titleEn,
    titleRomaji,
    format: 'TV',
    jpYear,
    ...(episodes ? { episodes } : {}),
    streams: [],
  })
  const kopf = "As a Reincarnated Aristocrat, I'll Use My Appraisal Skill to Rise in the World"
  schreibe('public/data/titles.json', [
    reihe(164702, kopf, 'Tensei Kizoku, Kantei Skill de Nariagaru', 2024, 12),
    reihe(178434, `${kopf} Season 2`, 'Tensei Kizoku, Kantei Skill de Nariagaru 2nd Season', 2024, 12),
    reihe(185756, `${kopf} Season 3`, 'Tensei Kizoku, Kantei Skill de Nariagaru 3rd Season', 2026),
  ])
  schreibe('data/crunchyroll-neu.json', {
    geholtAm: '2026-10-26',
    folgen: [
      { guid: 'GE00384134DEDE', serieId: 'GG5H5XQMD', serie: kopf, staffelId: 'GS00384021DEDE', staffel: 'Staffel 3', nummer: 2, titel: 'Canarre in Gefahr', ausstrahlung: '2026-10-04T00:00:00.000Z', verfuegbarAb: '2026-10-25T15:00:00.000Z', gesehenAm: '2026-10-26' },
    ],
  })
  schreibe('data/termine-verpasst.json', [
    vermerk('spaet', 12, '2026-10-14T17:25:00.000Z'),
    vermerk('punkt', 12, '2026-10-14T17:25:00.000Z'),
    vermerk('mitternacht', 3, '2026-11-04T17:25:00.000Z'),
    vermerk('zukunft', 5, '2026-10-14T17:25:00.000Z'),
    vermerk('frueher', 12, '2026-10-14T17:25:00.000Z'),
    vermerk('ohne', 5, '2026-10-14T17:25:00.000Z'),
    { ...vermerk('aristocrat-s3', 2, '2026-10-25T16:00:00.000Z'), titleId: 185756 },
    { ...vermerk('aristocrat-s2', 2, '2026-10-25T16:00:00.000Z'), titleId: 178434 },
  ])
  schreibe('data/crunchyroll.json', { scrapedAt: '2026-11-04T12:00:00Z', window: { from: '2026-10-01', to: '2026-11-30' }, german: {}, slots: [] })

  /* Die Sperre von check:logic (`bestand-sperre.cjs`) gilt dem echten Bestand in `public/data`; hier liegen nur Fixture-Daten in der Kopie. */
  const umgebung = { ...process.env, NODE_OPTIONS: '', BESTAND_ERLAUBT: '', BESTAND_SPUR: '' }
  const lauf = spawnSync(process.execPath, [join(arbeit, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'pipeline/termine-pruefen.ts', '--jetzt', '2026-11-04T23:30:00Z'], { cwd: arbeit, encoding: 'utf8', env: umgebung })
  const dateiPfad = join(arbeit, 'data', 'termine-verpasst.json')
  const vermerke = existsSync(dateiPfad) ? (JSON.parse(readFileSync(dateiPfad, 'utf8')) as Vermerk[]) : []
  const je = (slug: string) => vermerke.find((v) => v.slug === slug)
  console.log('\ntermine-pruefen.ts, Folgentage aus schedule.observed:')
  pruefe('der Lauf endet ohne Fehler', lauf.status === 0, { status: lauf.status, fehler: lauf.stderr.slice(-300) })
  pruefe('Termin mit Beobachtung am selben Tag wird gar nicht erst vermerkt', je('gleich') === undefined, je('gleich'))
  pruefe('Folge am erwarteten Tag beobachtet: Vermerk entfällt', je('punkt') === undefined, je('punkt'))
  pruefe('zwei Tage später beobachtet: erschienenAm mit Uhrzeit des Termins, 48 Stunden Verzug', je('spaet')?.erschienenAm === '2026-10-16T17:25:00.000Z' && je('spaet')?.verzugStunden === 48, je('spaet'))
  pruefe('Beobachtung vom heutigen Berliner Tag (UTC noch gestern) zählt', je('mitternacht')?.erschienenAm === '2026-11-05T17:25:00.000Z', je('mitternacht'))
  pruefe('Beobachtung in der Zukunft (Ankündigung) schließt nicht', je('zukunft') !== undefined && je('zukunft')?.erschienenAm === null, je('zukunft'))
  pruefe('Beobachtung vor dem erwarteten Tag schließt nicht', je('frueher') !== undefined && je('frueher')?.erschienenAm === null, je('frueher'))
  pruefe('ohne Beobachtung bleibt der Vermerk offen', je('ohne') !== undefined && je('ohne')?.erschienenAm === null, je('ohne'))
  pruefe('Katalog sieht Folge 2 der Staffel 3 am erwarteten Tag: Vermerk entfällt (Aristocrat S3)', je('aristocrat-s3') === undefined, je('aristocrat-s3'))
  pruefe('Folge 2 der Schwesterstaffel unter derselben Serienkennung bleibt offen', je('aristocrat-s2') !== undefined && je('aristocrat-s2')?.erschienenAm === null, je('aristocrat-s2'))
} finally {
  rmSync(arbeit, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nAlle Zusicherungen halten.')
