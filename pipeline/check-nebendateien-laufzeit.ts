/**
 * Laufzeittest statt Quelltext-Zusicherungen für `bau/nebendateien.ts` und die MAL-Kennung im AniList-Katalog (Muster 2472).
 * Die Wurzel (`AK_ROOT`) ist ein Wegwerf-Ordner; die Module werden erst danach geladen, weil sie die Wurzel beim Import festlegen.
 * 1. Die Katalogabfrage verlangt `idMal`, der Eintrag trägt es als `mal` (Attrappe antwortet wie AniList nur auf eine Abfrage mit `idMal`).
 * 2. `schreibeOhneSynchro` legt `malId` an den Titel in `ohne-synchro.json`.
 * 3. Kommt der Katalog ohne MAL-Kennungen an, warnt der Bau „Keine MAL-Kennung“; mit Kennung nicht.
 * 4. Kuratierte Quellen erfinden keine Aussage: `quellenPflegen` setzt kein `sagt` (unser Termin als Aussage der Quelle).
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fehler: string[] = []
const pruefe = (name: string, ok: boolean, info?: unknown) => {
  if (!ok) fehler.push(`${name}${info === undefined ? '' : ` (${JSON.stringify(info)})`}`)
}
const tmp = mkdtempSync(join(process.argv[2] ?? tmpdir(), 'check-nebendateien-laufzeit-'))
process.env.AK_ROOT = tmp
for (const o of ['data/cache', 'public/data', 'data/curated']) mkdirSync(join(tmp, o), { recursive: true })
/* Die Module lesen beim Import ihre Handdateien aus der Wurzel: die kleinen Dateien aus `data/` (ohne Cache) werden mitkopiert. */
for (const d of readdirSync('data', { withFileTypes: true })) {
  if (d.isFile() && /\.(json|yaml)$/.test(d.name) && statSync(join('data', d.name)).size < 200_000) copyFileSync(join('data', d.name), join(tmp, 'data', d.name))
}
/* Ohne Handurteile: sonst bricht die Gegenprobe „kein Anime hinter dem Toggle“ den Lauf wegen der echten Liste ab. */
writeFileSync(join(tmp, 'data', 'ohne-synchro-von-hand.yaml'), '[]\n')

try {
  /* 1. Katalogabfrage: AniList liefert `idMal` nur, wenn die Abfrage es verlangt. */
  const { katalogSeite } = await import('./lib/anilist.ts')
  globalThis.fetch = (async (_url: unknown, opt: { body: string }) => {
    const { query } = JSON.parse(opt.body) as { query: string }
    const medium = {
      id: 900001,
      title: { romaji: 'Malprobe', english: null, native: null },
      synonyms: [],
      format: 'TV',
      episodes: 12,
      seasonYear: 2026,
      status: 'FINISHED',
      startDate: { year: 2026, month: 1, day: 1 },
      genres: [],
      coverImage: { large: null },
      ...(/\bidMal\b/.test(query) ? { idMal: 4242 } : {}),
    }
    return new Response(JSON.stringify({ data: { Page: { pageInfo: { hasNextPage: false }, media: [medium] } } }), { status: 200 })
  }) as typeof fetch
  const seite = await katalogSeite(1)
  pruefe('Katalog holt die MAL-Kennung als `mal`', seite.eintraege[0]?.mal === 4242, seite.eintraege[0])

  /* 2./3. Der Schreiber legt malId an; ohne Kennungen warnt der Bau. */
  const { schreibeOhneSynchro } = await import('./bau/nebendateien.ts')
  const eintrag = (mal?: number) => ({ id: 900001, ...(mal ? { mal } : {}), t: ['Malprobe', null, null], format: 'TV', jahr: 2026, folgen: 12, start: '2026-01-01', status: 'FINISHED', genres: [], cover: null })
  const warnungen: string[] = []
  const echteWarnung = console.warn
  console.warn = (...a: unknown[]) => void warnungen.push(a.join(' '))
  const baue = (mal?: number) => {
    writeFileSync(join(tmp, 'data/cache/anilist-katalog.json'), JSON.stringify({ eintraege: [eintrag(mal)] }))
    warnungen.length = 0
    schreibeOhneSynchro(new Map())
    return JSON.parse(readFileSync(join(tmp, 'public/data/ohne-synchro.json'), 'utf8')) as { id: number; malId?: number }[]
  }
  const mitMal = baue(4242)
  pruefe('Schreiber legt malId an den Titel', mitMal[0]?.malId === 4242, mitMal)
  pruefe('mit MAL-Kennung keine Warnung', !warnungen.some((w) => w.includes('Keine MAL-Kennung')), warnungen)
  const ohneMal = baue()
  pruefe('ohne MAL-Kennung bleibt malId leer', ohneMal[0]?.malId === undefined, ohneMal)
  pruefe('ohne MAL-Kennung warnt der Bau', warnungen.some((w) => w.includes('Keine MAL-Kennung an 1 Titeln')), warnungen)
  console.warn = echteWarnung

  /* 4. Kuratierte Quellen: kein `sagt` aus dem eigenen Termin. */
  const { quellenPflegen } = await import('./bau/nebendateien.ts')
  const release = {
    slug: 'malprobe-staffel-1',
    titleId: 900001,
    platform: 'netflix',
    schedule: { firstEpisodeDate: '2026-10-07' },
    sources: ['https://example.org/kuratiert'],
  }
  quellenPflegen([release] as never)
  const quellen = (release as { quellen?: { url: string; sagt?: string }[] }).quellen ?? []
  pruefe('kuratierte Quelle bleibt erhalten', quellen.some((q) => q.url === 'https://example.org/kuratiert'), quellen)
  pruefe('kuratierte Quelle trägt kein `sagt`', quellen.every((q) => q.sagt === undefined), quellen)

  /* 5. „Neu auf Deutsch“ bezieht den ersten Termin ohne automatische TV-Termine eines Titels ohne eigenes Ja (Super Wings, 13.10.2026). */
  const { ersterTerminMitGrund } = await import('./bau/nebendateien.ts')
  const tv = (auto: boolean) => ({
    slug: 'sw-rtl',
    titleId: 900002,
    name: 'Super Wings',
    platform: 'tv',
    sender: 'Super RTL',
    releaseType: 'weekly',
    kanal: 'Super RTL',
    automatisch: auto,
    schedule: { firstEpisodeDate: '2026-10-07', time: '09:50', episodeCount: 1, firstEpisodeNumber: 12 },
    sources: ['x'],
  })
  const titel = { id: 900002, streams: [], deErstausgabe: { von: '2017-01-25', synchro: true } }
  pruefe('automatischer TV-Termin ohne eigenes Ja gibt keinen ersten Termin', ersterTerminMitGrund([tv(true)] as never, [titel] as never).size === 0)
  /* Ohne Erstausgabe zählt `ersterDeutscherTermin` allein ihn als Start; nur der Filter des Baus hält ihn (Kanal ohne eigenes Ja) heraus. */
  const ohneErstausgabe = { id: 900002, streams: [] }
  pruefe('automatischer TV-Termin eines Titels ohne eigenes Ja zählt auch ohne Erstausgabe nicht', ersterTerminMitGrund([tv(true)] as never, [ohneErstausgabe] as never).size === 0)
  pruefe('von Hand belegter TV-Termin ohne Erstausgabe zählt', ersterTerminMitGrund([tv(false)] as never, [ohneErstausgabe] as never).get(900002) === '2026-10-07')
  pruefe('von Hand belegter TV-Termin gibt den ersten Termin', ersterTerminMitGrund([tv(false)] as never, [titel] as never).get(900002) === '2026-10-07')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`check-nebendateien-laufzeit: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-nebendateien-laufzeit: MAL-Kennung vom Katalog bis ohne-synchro.json, Warnung ohne Kennungen, kuratierte Quellen ohne `sagt`.')
