/**
 * Erzeugt die Bilder, die Messenger und soziale Netze in der Link-Vorschau zeigen.
 *
 * Ein Bild je Release (1200×630, das von allen Diensten erwartete Format) mit
 * Cover, Titel, Termin, Uhrzeit, Plattform und FSK — plus ein Standardbild für
 * Links ohne Release. Das Aussehen steht in `lib/og-karte.ts`.
 *
 * Das Cover kommt vom AniList-CDN und wird lokal zwischengespeichert, damit
 * wiederholte Läufe nicht jedes Mal hundert Bilder nachladen.
 *
 * Aufruf: npm run data:og   [-- --force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PLATFORMS, RELEASE_TYPES, type Release, type Title } from '../shared/types.ts'
import { expandEvents, releaseStatus } from '../shared/logic.ts'
import { todayIso } from '../shared/time.ts'
import { ROOT, log, readJson, warn } from './lib/util.ts'
import { zeichneKarte, type KartenDaten } from './lib/og-karte.ts'
import { zeichneStandard } from './lib/og-standard-bild.ts'
import { OG_FASSUNG } from './lib/og-fassung.ts'
import { terminKopf } from './lib/og-termin.ts'
import { mussNeuZeichnen, standardKarte, standardKennung } from './lib/og-standard.ts'

const OUT_DIR = resolve(ROOT, 'public/og')
const COVER_CACHE = resolve(ROOT, 'data/cache/covers')

/**
 * **Fassung des Aussehens.** Ohne sie würde ein neues Design nur neue Releases erreichen — der
 * Lauf überspringt vorhandene Bilder. Weicht die gespeicherte Fassung ab, zeichnet er einmal alle
 * neu (27.09.2026: Poster-Gestaltung). Die Kennung steht in `lib/og-fassung.ts`.
 */
const FASSUNG = OG_FASSUNG
const FASSUNG_DATEI = resolve(OUT_DIR, 'fassung.txt')
const FORCE =
  process.argv.includes('--force') || !existsSync(FASSUNG_DATEI) || readFileSync(FASSUNG_DATEI, 'utf8').trim() !== FASSUNG

/** Nur diese Slugs zeichnen (`--nur a,b`) — für Stichproben, ohne die übrigen anzufassen. */
const NUR = (() => {
  const i = process.argv.indexOf('--nur')
  return i >= 0 ? new Set(process.argv[i + 1]?.split(',')) : undefined
})()

async function loadCover(url: string | undefined): Promise<Buffer | undefined> {
  if (!url) return undefined
  mkdirSync(COVER_CACHE, { recursive: true })
  const file = resolve(COVER_CACHE, url.split('/').pop()!.replace(/[^\w.-]/g, '_'))
  if (existsSync(file)) return readFileSync(file)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const buffer = Buffer.from(await res.arrayBuffer())
    writeFileSync(file, buffer)
    return buffer
  } catch (err) {
    warn(`Cover nicht ladbar (${url}): ${(err as Error).message}`)
    return undefined
  }
}


/** Standardbild neu zeichnen, wenn die abgelegte Kennung nicht mehr zu seinen Eingaben passt (`lib/og-standard.ts`). */
async function standardBild(): Promise<void> {
  const datei = resolve(OUT_DIR, 'default.jpg')
  const kennungDatei = resolve(OUT_DIR, 'default.txt')
  const { belegtCount } = readJson<{ belegtCount: number }>('public/data/meta.json', { belegtCount: 0 })
  const karte = standardKarte(belegtCount)
  const kennung = standardKennung(karte)
  const abgelegt = existsSync(kennungDatei) ? readFileSync(kennungDatei, 'utf8') : undefined
  if (NUR ? !NUR.has('default') : !mussNeuZeichnen(existsSync(datei), abgelegt, kennung, FORCE)) return
  await zeichneStandard(karte, datei)
  writeFileSync(kennungDatei, `${kennung}\n`)
  log('Standard-Vorschaubild geschrieben')
}

// Titel aus Kern und `titles.json`: Der Kern kennt nur Titel, deren Release beim Schreiben schon feststand („Im Angebot seit" kommt später); Cartoons stehen nur im Kern.
async function main(): Promise<void> {
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const titles = [...readJson<Title[]>('public/data/titles-core.json', []), ...readJson<Title[]>('public/data/titles.json', [])]
  const titleById = new Map(titles.map((t) => [t.id, t]))
  const today = todayIso()

  mkdirSync(OUT_DIR, { recursive: true })

  // --- Standardbild für Links ohne Release ---------------------------------
  await standardBild()

  // --- Ein Bild je Release --------------------------------------------------
  let written = 0
  for (const release of releases) {
    const file = resolve(OUT_DIR, `${release.slug}.jpg`)
    if (NUR ? !NUR.has(release.slug) : !FORCE && existsSync(file)) continue

    const title = titleById.get(release.titleId)
    const events = expandEvents(release)
    const type = RELEASE_TYPES[release.releaseType]
    const status = releaseStatus(release, today)

    const kopf = terminKopf(release, events, today) ?? { datum: '', folge: '', fakt: '' }

    const badges: KartenDaten['badges'] = [
      { text: PLATFORMS[release.platform].name, color: PLATFORMS[release.platform].color },
      { text: type.short, color: type.color },
    ]
    if (release.fsk !== undefined) badges.push({ text: `FSK ${release.fsk}`, color: '#e2e8f0' })
    if (status === 'airing') badges.push({ text: 'Läuft', color: '#ff5a36', akzent: true })

    await zeichneKarte(
      { title: release.name, ...kopf, badges },
      await loadCover(title?.coverImage),
      file,
    )
    written++
  }

  log(`${written} Vorschaubilder erzeugt, ${releases.length} Releases insgesamt`)
  if (!NUR) writeFileSync(FASSUNG_DATEI, `${FASSUNG}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
