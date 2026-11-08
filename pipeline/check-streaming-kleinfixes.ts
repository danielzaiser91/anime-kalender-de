/**
 * Streaming-Kleinfixes (06.11.2026): aniSearch-Anbieter `animation-digital-network-(de)` und `aniverse` (09-6) sowie der
 * Amazon-Kanal als Prime-Weg mit Kanalname (11-2-3). Die aniSearch-Runde läuft im Kindprozess mit Wegwerf-`AK_ROOT`.
 *
 * Aufruf: `npx tsx pipeline/check-streaming-kleinfixes.ts`
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { StreamLink, Title } from '../shared/types.ts'
import { neinHandbelege } from './lib/dub-confirmed.ts'
import { amazonKanal, ergaenzeAboWege } from './bau/11-2-3-abo-wege.ts'

const GEORGIE = 'https://www.amazon.de/dp/B0DMHSFLGQ'
const UTENA = 'https://animationdigitalnetwork.com/de/video/1338'
const UTENA2 = 'https://animationdigitalnetwork.com/de/video/1339'

/** Kindprozess: Die Bau-Module werden erst nach dem Setzen von `AK_ROOT` geladen. */
async function kind(): Promise<void> {
  const { ergaenzeAnisearchWege } = await import('./bau/09-6-anisearch-wege.ts')
  const lauf = (befunde: Record<string, { status: number; prime?: boolean }>, vorab: StreamLink[] = []) => {
    const titles = new Map([
      [2542, { id: 2542, streams: [...vorab] }],
      [441, { id: 441, streams: [] }],
      [442, { id: 442, streams: [] }],
    ])
    ergaenzeAnisearchWege({
      verweiseEntfernt: [],
      crDub: { scrapedAt: '2026-11-06', serien: [] } as never,
      usNeinWiderlegt: () => false,
      titles: titles as never,
      anisearch: {
        '2542': { streams: [{ provider: 'aniverse', url: `${GEORGIE}?tag=anisearch.de-21` }] },
        '441': { streams: [{ provider: 'animation-digital-network-(de)', url: UTENA }] },
        '442': { streams: [{ provider: 'anime-digital-network-(de)', url: UTENA2 }] },
      } as never,
      belegFuer: () => undefined,
      linkBefunde: befunde,
      lautPruefungTot: () => false,
      crAdresseZu: () => undefined,
      crKatalogDeutsch: new Set(),
      checks: new Map(),
      adnArchiv: { serien: new Map() } as never,
      adnStreamSchaerfen: () => false,
    })
    return [...titles.values()].map((t) => [t.id, t.streams.map((s) => `${s.platform} ${s.url}`)])
  }
  const prime = { [GEORGIE]: { status: 200, prime: true } }
  console.log(JSON.stringify({ mit: lauf(prime), ohne: lauf({}), schon: lauf(prime, [{ platform: 'primevideo', url: 'https://x.test/a' }]) }))
}

let fehler = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const kanalAngebot = (anbieter: string, url = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.test', art = 'FLATRATE', audio = ['de', 'ja']) => ({ anbieter, art, audio, url })
const titel = (id: number, streams: StreamLink[] = []) => ({ id, streams, keywords: [], genres: [] }) as unknown as Title
const abo = (t: Title, angebote: ReturnType<typeof kanalAngebot>[], handNein = new Set<string>()) => {
  ergaenzeAboWege({ titles: new Map([[t.id, t]]), jw: { [String(t.id)]: { angebote } }, handNein, tmdbMehrdeutig: new Set(), istTot: () => false })
  return (t.streams ?? []) as StreamLink[]
}
const neinNurDort = neinHandbelege([
  { anilistId: 900010, platform: 'primevideo', url: 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.test', dub: false },
  { anilistId: 900010, platform: 'primevideo', url: 'https://example.org/ja', dub: true },
])
const kurz = (s: StreamLink[]) => s.map((x) => `${x.platform}|${x.kanal ?? ''}|${x.zugang ?? ''}`).join(',')

if (process.argv[2] === '--kind') {
  await kind()
} else {
  console.log('\nPunkt 4: Amazon-Kanal als Prime Video mit Kanalname')
  pruefe('amazonKanal: Aniverse → aniverse', amazonKanal('Aniverse Amazon Channel') === 'aniverse')
  pruefe('amazonKanal: Anime Digital Network → ADN', amazonKanal('Anime Digital Network Amazon Channel') === 'ADN')
  pruefe('amazonKanal: Crunchyroll behält den Namen', amazonKanal('Crunchyroll Amazon Channel') === 'Crunchyroll')
  pruefe('amazonKanal: RTL+ Max behält den Namen (nicht RTL+)', amazonKanal('RTL+ Max Amazon Channel') === 'RTL+ Max')
  pruefe('amazonKanal: kein Kanal → undefined', amazonKanal('Amazon Prime Video') === undefined && amazonKanal('Crunchyroll') === undefined)
  pruefe('Kanal ohne Prime-Weg: primevideo mit Kanalname, nie RTL+', kurz(abo(titel(900001), [kanalAngebot('RTL+ Max Amazon Channel')])) === 'primevideo|RTL+ Max|abo')
  pruefe('Kanal Aniverse: primevideo|aniverse', kurz(abo(titel(900002), [kanalAngebot('Aniverse Amazon Channel')])) === 'primevideo|aniverse|abo')
  const zwei = abo(titel(900003), [kanalAngebot('Aniverse Amazon Channel'), kanalAngebot('Anime Digital Network Amazon Channel')])
  pruefe('zwei Kanäle derselben Adresse: nur ein Prime-Weg', zwei.length === 1 && zwei[0]!.kanal === 'aniverse', zwei)
  pruefe('Kanal mit Werbung: zugang kostenlos', kurz(abo(titel(900004), [kanalAngebot('Aniverse Amazon Channel', undefined, 'ADS')])) === 'primevideo|aniverse|kostenlos')
  const prime = titel(900005, [{ platform: 'primevideo', url: 'https://www.amazon.de/dp/B000000001' }])
  pruefe('Titel hat schon einen Prime-Weg: Kanal bleibt draußen', abo(prime, [kanalAngebot('Aniverse Amazon Channel')]).length === 1 && prime.streams[0]!.kanal === undefined)
  const crTitel = titel(900012, [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/GTEST' }])
  pruefe('Titel hat schon einen anderen Weg (Crunchyroll): Kanal bleibt draußen, keine Doppelpille', abo(crTitel, [kanalAngebot('Crunchyroll Amazon Channel')]).length === 1 && crTitel.streams[0]!.platform === 'crunchyroll')
  const mitLink = { ...titel(900014), watchLinks: [{ name: 'Amazon Prime (Crunchyroll)', url: 'https://x.test/a', kind: 'stream' }] } as unknown as Title
  pruefe('Titel hat schon einen Stream-Link in watchLinks: Kanal bleibt draußen', abo(mitLink, [kanalAngebot('Crunchyroll Amazon Channel')]).length === 0)
  const nurKauf = { ...titel(900015), watchLinks: [{ name: 'Amazon', url: 'https://x.test/b', kind: 'buy' }] } as unknown as Title
  pruefe('Titel nur mit Kauf-Link: Kanal kommt', abo(nurKauf, [kanalAngebot('Crunchyroll Amazon Channel')]).length === 1)
  const netflixErst = abo(titel(900013), [kanalAngebot('Netflix', 'https://www.netflix.com/title/900013'), kanalAngebot('Aniverse Amazon Channel')])
  pruefe('Titel ganz ohne Weg: Netflix-Angebot davor sperrt den Kanal nicht (Reihenfolge)', kurz(netflixErst) === 'netflix||abo,primevideo|aniverse|abo', kurz(netflixErst))
  pruefe('Kanal ohne deutschen Ton: kein Weg', abo(titel(900006), [kanalAngebot('Aniverse Amazon Channel', undefined, 'FLATRATE', ['ja'])]).length === 0)
  pruefe('Kanal als Kauf (BUY): kein Weg', abo(titel(900007), [kanalAngebot('Aniverse Amazon Channel', undefined, 'BUY')]).length === 0)
  pruefe('Kanal mit fremder Adresse (nicht watch.amazon.de): kein Weg', abo(titel(900008), [kanalAngebot('Aniverse Amazon Channel', 'https://www.example.org/x')]).length === 0)
  pruefe('Kanal mit Hand-Nein für Prime: kein Weg', abo(titel(900009), [kanalAngebot('Aniverse Amazon Channel')], new Set(['900009|primevideo'])).length === 0)
  pruefe('Kanal mit Hand-Nein an der Adresse: kein Weg', abo(titel(900010), [kanalAngebot('Aniverse Amazon Channel')], neinNurDort).length === 0)
  pruefe('Anbieter ohne Kanal bleibt wie bisher (Crunchyroll)', kurz(abo(titel(900011), [kanalAngebot('Crunchyroll', 'https://www.crunchyroll.com/de/watch/GTEST')])) === 'crunchyroll||abo')

  console.log('\nPunkt 1: aniSearch-Anbieter')
  const wurzel = mkdtempSync(join(tmpdir(), 'streaming-kleinfixes-'))
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
  const skript = fileURLToPath(import.meta.url)
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, '--kind'], { encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...process.env, AK_ROOT: wurzel } })
  const zeile = r.stdout.split('\n').filter((z) => z.startsWith('{')).pop()
  const erg = zeile ? (JSON.parse(zeile) as Record<string, [number, string[]][]>) : undefined
  pruefe('Kindprozess lief', r.status === 0 && Boolean(erg), { status: r.status, err: r.stderr.slice(-400) })
  const von = (art: string, id: number) => erg?.[art]?.find(([i]) => i === id)?.[1]
  pruefe('Utena (441): animation-digital-network-(de) → adn', JSON.stringify(von('mit', 441)) === JSON.stringify([`adn ${UTENA}`]), erg)
  pruefe('Schreibweise anime-digital-network-(de) → adn', JSON.stringify(von('mit', 442)) === JSON.stringify([`adn ${UTENA2}`]), erg)
  pruefe('Georgie (2542): aniverse mit Prime-Befund → primevideo, ohne Parameter', JSON.stringify(von('mit', 2542)) === JSON.stringify([`primevideo ${GEORGIE}`]), erg)
  pruefe('Georgie ohne Prime-Befund: kein Weg (Disc-Schutz)', von('ohne', 2542)?.length === 0, erg)
  pruefe('Georgie mit vorhandenem Prime-Weg: keiner dazu', von('schon', 2542)?.length === 1, erg)
  console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
  process.exit(fehler ? 1 : 0)
}
