/**
 * Der ganze Bauschritt `schreibeOhneWeg` über eine Kulisse (`AK_ROOT` im Temp-Ordner, vor jedem Import gesetzt): liest die fertigen Dateien,
 * schreibt `ohne-weg.json`, zweiter Lauf byte-gleich. Die Regeln selbst prüft `check-ohne-weg.ts`. Aufruf: `npm run check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, extra: Record<string, unknown> = {}) => ({ id, format: 'TV', streams: [], ...extra })
const jw = (jwId: string, tmdbId: number, art: string[]) => ({ geprueftAm: '2026-11-17', jwId, tmdbId, angebote: art.map((a) => ({ anbieter: 'X', art: a, audio: [] })) })

const wurzel = mkdtempSync(join(tmpdir(), 'ohne-weg-'))
try {
  for (const o of ['public/data', 'data']) mkdirSync(join(wurzel, o), { recursive: true })
  const dateien: Record<string, unknown> = {
    'titles.json': [titel(900101), titel(900102, { streams: [{ platform: 'netflix' }] }), titel(900103, { format: 'MOVIE' }), titel(900105)],
    'cartoons.json': [titel(-900104)],
    /* 2999: der Starttag liegt in jedem Lauf in der Zukunft, ohne dass der Test die Uhr liest. */
    'events.json': [{ titleId: 900101, platform: 'netflix', date: '2999-01-01' }],
  }
  for (const [n, d] of Object.entries(dateien)) writeFileSync(join(wurzel, 'public', 'data', n), JSON.stringify(d))
  writeFileSync(join(wurzel, 'data', ['justwatch', 'audio.json'].join('-')), JSON.stringify({ 900103: jw('k1', 21, []), '-900104': jw('k2', 22, ['RENT']) }))
  process.env.AK_ROOT = wurzel
  const { schreibeOhneWeg } = await import('./bau/13-13-ohne-weg.ts')
  const lies = () => readFileSync(join(wurzel, 'public', 'data', 'ohne-weg.json'), 'utf8')
  schreibeOhneWeg()
  const erst = JSON.parse(lies()) as Record<string, { reason: string }>
  pruefe('Lauf: je ein Eintrag für die vier Titel ohne Weg, keiner für den mit Stream', Object.keys(erst).sort().join() === '-900104,900101,900103,900105', Object.keys(erst))
  pruefe('Lauf: Gründe aus Termin, JustWatch-Film, JustWatch-Cartoon, offen', erst['900101']?.reason === 'angekuendigt' && erst['900103']?.reason === 'film-ohne-abo' && erst['-900104']?.reason === 'nur-kauf' && erst['900105']?.reason === 'offen', erst)
  const text = lies()
  schreibeOhneWeg()
  pruefe('Zweiter Lauf: Datei byte-gleich', lies() === text)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n✖ ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\n✓ ohne-weg-lauf: Bauschritt schreibt je Titel ohne Weg einen Grund, zweiter Lauf gleich')
