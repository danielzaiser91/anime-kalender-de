/**
 * Erzeugt die Bilder, die Messenger und soziale Netze in der Link-Vorschau zeigen.
 *
 * Ein Bild je Release (1200×630, das von allen Diensten erwartete Format) mit
 * Cover, Titel, Termin, Uhrzeit, Plattform und FSK — plus ein Standardbild für
 * Links ohne Release.
 *
 * Gerendert wird über SVG → PNG mit sharp. Das Cover kommt vom AniList-CDN und
 * wird lokal zwischengespeichert, damit wiederholte Läufe nicht jedes Mal
 * hundert Bilder nachladen.
 *
 * Aufruf: npm run data:og   [-- --force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import type { OverlayOptions } from 'sharp'
import { PLATFORMS, RELEASE_TYPES, type Release, type Title } from '../shared/types.ts'
import { expandEvents, releaseStatus } from '../shared/logic.ts'
import { formatDate, todayIso, weekdayName } from '../shared/time.ts'
import { GENRE_DE } from '../shared/mappings.ts'
import { ROOT, log, readJson, warn } from './lib/util.ts'

const FORCE = process.argv.includes('--force')
const W = 1200
const H = 630
const OUT_DIR = resolve(ROOT, 'public/og')
const COVER_CACHE = resolve(ROOT, 'data/cache/covers')

/** In SVG dürfen diese fünf Zeichen nicht roh vorkommen. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Zeilenumbruch von Hand: SVG kann keinen Textfluss. Die Breite wird über eine
 * Zeichenbreiten-Schätzung ermittelt — genau genug für Überschriften, und es
 * spart eine Schriftmetrik-Bibliothek.
 */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxChars && current) {
      lines.push(current)
      current = word
      if (lines.length === maxLines) break
    } else {
      current = candidate
    }
  }
  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1}$/, '…')
  }
  return lines
}

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

interface CardData {
  title: string
  subtitle?: string
  lines: { label: string; value: string }[]
  badges: { text: string; color: string }[]
  accent: string
  footer: string
}

const COVER_W = 400

/** Hintergrund: kommt UNTER das Cover, darf es also nicht überdecken. */
function background(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="18%" cy="12%" r="90%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#0a0e17" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a0e17"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</svg>`
}

/**
 * Breite eines Zeichens grob geschätzt. Ohne Schriftmetrik gibt es keinen
 * exakten Wert; 0,52 der Schriftgröße trifft eine gemischte deutsche Zeile
 * nah genug, um Überlauf zu vermeiden.
 */
function fitChars(widthPx: number, fontSize: number): number {
  return Math.max(8, Math.floor(widthPx / (fontSize * 0.52)))
}

function card(data: CardData, hasCover: boolean): string {
  const textX = hasCover ? COVER_W + 56 : 72
  const textW = W - textX - 56

  // Erst mit großer Schrift versuchen; passt der Titel nicht in zwei Zeilen,
  // eine Stufe kleiner werden statt ihn abzuschneiden.
  let titleSize = 50
  let titleLines = wrap(data.title, fitChars(textW, titleSize), 2)
  if (titleLines.join(' ').length < data.title.length) {
    titleSize = 38
    titleLines = wrap(data.title, fitChars(textW, titleSize), 3)
  }
  let y = 132 - (titleLines.length - 1) * 10

  const parts: string[] = []
  parts.push(`<rect x="0" y="0" width="10" height="${H}" fill="${data.accent}"/>`)
  if (hasCover) {
    // Weicher Übergang vom Cover in den Hintergrund, damit die Kante nicht
    // wie ein aufgeklebtes Rechteck wirkt.
    parts.push(
      `<rect x="${COVER_W - 90}" y="0" width="90" height="${H}" fill="url(#fade)"/>`,
    )
  }

  for (const line of titleLines) {
    parts.push(
      `<text x="${textX}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="${titleSize}" font-weight="700" fill="#ffffff">${esc(line)}</text>`,
    )
    y += titleSize + 10
  }

  if (data.subtitle) {
    y += 4
    parts.push(
      `<text x="${textX}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#8fa0bd">${esc(
        wrap(data.subtitle, fitChars(textW, 24), 1)[0] ?? '',
      )}</text>`,
    )
    y += 34
  }

  y += 22
  let badgeX = textX
  for (const badge of data.badges) {
    const width = badge.text.length * 13 + 28
    parts.push(
      `<rect x="${badgeX}" y="${y - 24}" width="${width}" height="36" rx="8" fill="${badge.color}22" stroke="${badge.color}88"/>`,
      `<text x="${badgeX + 14}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="600" fill="${badge.color}">${esc(badge.text)}</text>`,
    )
    badgeX += width + 12
  }
  y += 56

  for (const line of data.lines) {
    parts.push(
      `<text x="${textX}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#7c8aa5">${esc(line.label)}</text>`,
      `<text x="${textX + 168}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" fill="#dbe3f2">${esc(line.value)}</text>`,
    )
    y += 38
  }

  parts.push(
    `<text x="${textX}" y="${H - 46}" font-family="Segoe UI, Arial, sans-serif" font-size="21" fill="#66748f">${esc(data.footer)}</text>`,
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0a0e17" stop-opacity="0"/>
      <stop offset="100%" stop-color="#0a0e17" stop-opacity="1"/>
    </linearGradient>
  </defs>
  ${parts.join('\n  ')}
</svg>`
}

/**
 * Reihenfolge der Ebenen ist entscheidend: Hintergrund, dann das Cover,
 * dann erst Text und Verlauf. Läge das Text-SVG mit deckendem Hintergrund
 * darüber, verschwände das Cover darunter — genau dieser Fehler ist beim
 * ersten Anlauf passiert.
 */
async function renderCard(data: CardData, cover: Buffer | undefined, file: string): Promise<void> {
  const layers: OverlayOptions[] = [
    { input: Buffer.from(background(data.accent)), top: 0, left: 0 },
  ]

  if (cover) {
    const coverPng = await sharp(cover)
      .resize(COVER_W, H, { fit: 'cover', position: 'attention' })
      .png()
      .toBuffer()
    layers.push({ input: coverPng, top: 0, left: 0 })
  }

  layers.push({ input: Buffer.from(card(data, !!cover)), top: 0, left: 0 })

  await sharp({ create: { width: W, height: H, channels: 4, background: '#0a0e17' } })
    .composite(layers)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(file)
}

async function main(): Promise<void> {
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const titles = readJson<Title[]>('public/data/titles-core.json', [])
  const titleById = new Map(titles.map((t) => [t.id, t]))
  const today = todayIso()

  mkdirSync(OUT_DIR, { recursive: true })

  // --- Standardbild für Links ohne Release ---------------------------------
  const defaultFile = resolve(OUT_DIR, 'default.jpg')
  if (FORCE || !existsSync(defaultFile)) {
    await renderCard(
      {
        title: 'Anime-Kalender DE',
        subtitle: 'Jede Woche auf einen Blick, was mit deutscher Synchro erscheint',
        lines: [
          { label: 'Anime', value: `${titles.length}+ mit belegter Synchro` },
          { label: 'Termine', value: 'Streaming, Disc, Kino' },
          { label: 'Export', value: 'Google Calendar & ICS-Abo' },
        ],
        badges: [
          { text: 'Crunchyroll', color: PLATFORMS.crunchyroll.color },
          { text: 'Netflix', color: PLATFORMS.netflix.color },
          { text: 'Prime Video', color: PLATFORMS.primevideo.color },
        ],
        accent: '#38bdf8',
        footer: 'anime-kalender-de',
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
    if (!FORCE && existsSync(file)) continue

    const title = titleById.get(release.titleId)
    const events = expandEvents(release)
    const next = events.find((e) => e.date >= today) ?? events[0]
    const type = RELEASE_TYPES[release.releaseType]
    const status = releaseStatus(release, today)

    const lines: { label: string; value: string }[] = []
    if (next) {
      lines.push({
        label: release.releaseType === 'weekly' ? 'Nächste Folge' : 'Termin',
        value: `${weekdayName(next.date, true)}, ${formatDate(next.date)}`,
      })
      lines.push({
        label: 'Uhrzeit',
        value: next.time
          ? `${next.time} Uhr`
          : release.releaseType === 'disc'
            ? 'im Handel'
            : 'noch offen',
      })
    }
    if (release.releaseType === 'weekly' && release.schedule.episodeCount) {
      lines.push({
        label: 'Folgen',
        value: `${next?.episode ?? 1} von ${release.schedule.episodeCount}`,
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

    await renderCard(
      {
        title: release.name,
        subtitle: title?.titleRomaji !== release.name ? title?.titleRomaji : undefined,
        lines,
        badges,
        accent: type.color,
        footer: 'anime-kalender-de · alles mit deutscher Synchro',
      },
      await loadCover(title?.coverImage),
      file,
    )
    written++
  }

  log(`${written} Vorschaubilder erzeugt, ${releases.length} Releases insgesamt`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
