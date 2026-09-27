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
import { formatDate, todayIso, weekdayName } from '../shared/time.ts'
import { GENRE_DE } from '../shared/mappings.ts'
import { ROOT, log, readJson, warn } from './lib/util.ts'
import { zeichneKarte } from './lib/og-karte.ts'
import { OG_FASSUNG } from './lib/og-fassung.ts'

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


/**
 * Datum und Uhrzeit des Termins. **Ohne künftigen Termin ist das Datum der Start, keine „nächste
 * Folge"** — die alte Fassung schrieb „Nächste Folge: Fr, 31.01.2025" über eine längst
 * abgeschlossene Staffel (27.09.2026). Eine Uhrzeit steht dann auch nicht mehr da. Ein Katalogtitel
 * ist „im Angebot seit", nicht „erschienen am" (`dateMeaning`).
 */
function terminZeilen(release: Release, events: ReturnType<typeof expandEvents>, today: string): { label: string; value: string }[] {
  const kommend = events.find((e) => e.date >= today)
  const termin = kommend ?? events[0]
  if (!termin) return []
  const woechentlich = release.releaseType === 'weekly'
  const zeilen = [
    {
      label: release.dateMeaning === 'available-from' ? 'Im Angebot seit' : kommend ? (woechentlich ? 'Nächste Folge' : 'Termin') : woechentlich ? 'Erste Folge' : 'Erschienen',
      value: `${weekdayName(termin.date, true)}, ${formatDate(termin.date)}`,
    },
  ]
  if (kommend) {
    const zeit = kommend.time ? `${kommend.time} Uhr` : release.releaseType === 'disc' ? 'im Handel' : 'noch offen'
    zeilen.push({ label: 'Uhrzeit', value: zeit })
  }
  return zeilen
}

async function main(): Promise<void> {
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const titles = readJson<Title[]>('public/data/titles-core.json', [])
  const titleById = new Map(titles.map((t) => [t.id, t]))
  const today = todayIso()

  mkdirSync(OUT_DIR, { recursive: true })

  // --- Standardbild für Links ohne Release ---------------------------------
  const defaultFile = resolve(OUT_DIR, 'default.jpg')
  if (NUR ? NUR.has('default') : FORCE || !existsSync(defaultFile)) {
    await zeichneKarte(
      {
        title: 'Anime-Kalender DE',
        subtitle: 'Alles mit deutscher Synchro, Woche für Woche',
        lines: [
          { label: 'Anime', value: `${readJson<{ titleCount: number }>('public/data/meta.json', { titleCount: 0 }).titleCount.toLocaleString('de-DE')} mit Synchro` },
          { label: 'Termine', value: 'Streaming, Disc, Kino' },
          { label: 'Abo', value: 'Kalender und Newsletter' },
        ],
        badges: [
          { text: 'Crunchyroll', color: PLATFORMS.crunchyroll.color },
          { text: 'Netflix', color: PLATFORMS.netflix.color },
          { text: 'Prime Video', color: PLATFORMS.primevideo.color },
        ],
        accent: '#ff5a36',
      },
      undefined,
      defaultFile,
    )
    log('Standard-Vorschaubild geschrieben')
  }

  // --- Ein Bild je Release --------------------------------------------------
  let written = 0
  for (const release of releases) {
    const file = resolve(OUT_DIR, `${release.slug}.jpg`)
    if (NUR ? !NUR.has(release.slug) : !FORCE && existsSync(file)) continue

    const title = titleById.get(release.titleId)
    const events = expandEvents(release)
    const type = RELEASE_TYPES[release.releaseType]
    const status = releaseStatus(release, today)

    const lines = terminZeilen(release, events, today)
    if (release.releaseType === 'weekly' && release.schedule.episodeCount) {
      /*
        **„Folgen: x von y" ist eine Fortschrittsangabe — also zählt sie, was
        raus ist, nicht was als nächstes kommt.**

        Hier stand `next?.episode ?? 1`: die Nummer der nächsten Folge. Bei einer
        Staffel, die erst in vier Wochen anfängt, ergab das „1 von 12" — und
        genau so wurde es gelesen: eine Folge sei schon da. Daniel am 04.09.2026
        zum Vorschaubild von „Die Tagebücher der Apothekerin: Staffel 3 — Teil 1":
        „url preview image says 1 of 12? fail". Die Zeile darüber sagt bereits,
        wann Folge 1 kommt; darunter zu behaupten, sie sei erschienen, widerspricht
        ihr im selben Bild.

        Erschienen ist, was ein Datum bis heute hat. Ist noch nichts erschienen,
        gibt es keinen Fortschritt zu melden — dann steht dort die Gesamtzahl.
      */
      const raus = events.filter((e) => e.date <= today).length
      lines.push({
        label: 'Folgen',
        value: raus ? `${raus} von ${release.schedule.episodeCount}` : `${release.schedule.episodeCount} geplant`,
      })
    }
    if (release.publisher) lines.push({ label: 'Label', value: release.publisher })
    if (title?.genres.length) {
      lines.push({
        label: 'Genres',
        value: title.genres.slice(0, 3).map((g) => GENRE_DE[g] ?? g).join(', '),
      })
    }

    const badges = [
      { text: PLATFORMS[release.platform].name, color: PLATFORMS[release.platform].color },
      { text: type.short, color: type.color },
    ]
    if (release.fsk !== undefined) badges.push({ text: `FSK ${release.fsk}`, color: '#e2e8f0' })
    if (status === 'airing') badges.push({ text: 'Läuft', color: '#34d399' })

    await zeichneKarte(
      {
        title: release.name,
        subtitle: title?.titleRomaji !== release.name ? title?.titleRomaji : undefined,
        lines,
        badges,
        accent: type.color,
      },
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
