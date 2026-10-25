/**
 * Sammelartikel-Liste „nicht zugeordnet“: Eine Meldung, die ein Handeintrag desselben Titels beim selben Anbieter schon
 * belegt, steht nicht darauf (Blue Box Staffel 2, Netflix, 18.10.2026: Eintrag `auto-189123-netflix` ersetzt den Bot-Termin).
 * Die Einträge der Probe sind die wörtlichen aus `data/proposals/anime2you.json` (Artikel 1052708), die Kennungen erfunden.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'unzugeordnet-'))
process.env.AK_ROOT = wurzel

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

async function main(): Promise<void> {
  const { releasesAus } = await import('./lib/meldungen.ts')
  const { vorschlaegeAusAllenSammelartikeln } = await import('./lib/sammelartikel.ts')
  const { unzugeordnet, schreibeUnzugeordnet } = await import('./lib/sammel-unzugeordnet.ts')

  const artikel = {
    articleTitle: 'Netflix: Alle Anime-Neuzugänge im Oktober 2026',
    articleUrl: 'https://www.anime2you.de/news/1052708/netflix-anime-neu-im-oktober-2026/',
    publishedAt: '2026-09-23',
    category: 'streaming',
    platforms: ['netflix'],
    dates: [],
    dub: 'unklar',
    sammel: [
      { titel: 'Blue Box', zusatz: 'Staffel 2', datum: '2026-10-04', deutsch: true, woechentlich: true, stream: ['Netflix'] },
      { titel: 'Cyberpunk: Edgerunners II', datum: '2026-10-20', deutsch: true, woechentlich: false, stream: ['Netflix'], folgen: 10 },
    ],
  }
  const sammelV = vorschlaegeAusAllenSammelartikeln([artikel as never])
  const titles = [
    { id: 900122, franchiseId: 900122, titleEn: 'Blue Box', titleDe: 'Blue Box', format: 'ONA', jpYear: 2024 },
    { id: 900123, franchiseId: 900122, titleEn: 'Blue Box Season 2', titleDe: 'Blue Box: Staffel 2', format: 'TV', jpYear: 2026 },
  ] as never[]
  const handeintrag = {
    slug: 'auto-900123-netflix',
    titleId: 900123,
    name: 'Blue Box: Staffel 2',
    platform: 'netflix',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-10-04' },
    sources: [],
  } as never

  const abgedeckt: never[] = []
  const neu = releasesAus(sammelV, titles, [handeintrag], '2026-10-25', [], abgedeckt)
  const titelListe = (l: { titel: string; anbieter: string[] }[]) => l.map((e) => `${e.titel}/${e.anbieter.join(',')}`)

  pruefe('Kulisse: der Handeintrag verdrängt den Bot-Termin bei Netflix', neu.every((r) => r.platform !== 'netflix' || r.titleId !== 900123), neu.length)
  pruefe('Kulisse: genau die Netflix-Meldung zu Blue Box ist abgedeckt', abgedeckt.length === 1, abgedeckt.length)
  const ohne = unzugeordnet(sammelV, neu)
  const mit = unzugeordnet(sammelV, neu, abgedeckt)
  pruefe('alt: Blue Box/Netflix stand fälschlich auf der Liste', titelListe(ohne).includes('Blue Box/netflix'), titelListe(ohne))
  pruefe('neu: Blue Box/Netflix fällt von der Liste', !titelListe(mit).includes('Blue Box/netflix'), titelListe(mit))
  pruefe('Gegenfall: Edgerunners II (kein Termin im Bestand) bleibt', titelListe(mit).includes('Cyberpunk: Edgerunners II/netflix'), titelListe(mit))
  pruefe('genau ein Eintrag weniger als vorher', ohne.length - mit.length === 1, [ohne.length, mit.length])

  mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
  const zeilen: string[] = []
  const alt = console.log
  console.log = (...a: unknown[]) => void zeilen.push(a.join(' '))
  try {
    schreibeUnzugeordnet(sammelV, neu, abgedeckt)
  } finally {
    console.log = alt
  }
  const datei = JSON.parse(readFileSync(join(wurzel, 'data', 'proposals', 'nicht-zugeordnet.json'), 'utf8')) as { eintraege: { titel: string }[] }
  pruefe('Datei: Blue Box/Netflix nicht darin, Edgerunners darin', datei.eintraege.some((e) => e.titel.includes('Edgerunners')) && datei.eintraege.length === mit.length, datei.eintraege.length)
  const zeile = zeilen.find((z) => z.includes('belegt schon ein Termin'))
  pruefe('Log: Ausnahme wird gezählt und benannt', !!zeile && zeile.includes('] 1 Sammelartikel-Meldungen belegt') && zeile.includes('Blue Box (netflix)'), zeilen)
  // Verdrahtung im Bau: derselbe Fall durch `ergaenzeTermineAusNewsUndTv`, nicht nur durch die Einzelfunktionen.
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]')
  writeFileSync(join(wurzel, 'data', 'proposals', 'anime2you.json'), JSON.stringify({ proposals: [artikel] }))
  const { ergaenzeTermineAusNewsUndTv } = await import('./bau/08-news-tv.ts')
  const stumm = console.log
  console.log = () => undefined
  try {
    ergaenzeTermineAusNewsUndTv({ titles: new Map(titles.map((t) => [(t as { id: number }).id, t])), releases: [handeintrag] } as never)
  } finally {
    console.log = stumm
  }
  const imBau = JSON.parse(readFileSync(join(wurzel, 'data', 'proposals', 'nicht-zugeordnet.json'), 'utf8')) as { eintraege: { titel: string }[] }
  pruefe('Bau: nur Edgerunners steht auf der Liste, Blue Box nicht', imBau.eintraege.length === 1 && imBau.eintraege[0]!.titel.includes('Edgerunners'), imBau.eintraege)
}

try {
  await main()
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log(`Sammel-Unzugeordnet: ${fehler ? 'FEHLER' : 'alle Zusicherungen erfüllt'}`)
if (fehler) process.exit(1)
