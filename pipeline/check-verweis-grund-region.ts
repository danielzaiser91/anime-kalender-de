/**
 * Zusicherung: Ein Prime-Weg, den ein Nein mit gemessener Regionssperre der Seite („In deiner Region nicht mehr auf Prime Video verfügbar“,
 * Notiz `regionsperre=`) entfernt, steht in `verweise-entfernt.json` mit dem Grund „laut Seite in dieser Region nicht mehr im Angebot“,
 * nicht mit „keine deutsche Tonspur“ — die Seite sagt nichts über den Ton. Ein Nein ohne Regionssperre behält den alten Grund.
 * Anlass Chaika (20462, 20719, Prime B07LHCSXV6): Ja vom 28.08. mit Prime-Abo, Nein vom 28.09. mit `regionsperre=laut Seite nicht mehr im Abo`;
 * die echten Zeilen stehen wörtlich unten. Der Bauschritt `werteWeitereQuellenAus` läuft gegen eine Kulisse (`AK_ROOT`).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-verweis-grund-region.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'ak-verweis-grund-'))
process.env.AK_ROOT = kulisse

let fehler = 0
let faelle = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  faelle++
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}

const JA = (id: number) => `- anilistId: ${id}
  title: "Chaika"
  platform: primevideo
  url: https://www.amazon.de/dp/B07LHCSXV6
  dub: true
  checkedAt: '2026-08-28'
  note: "Tonspuren: Deutsch — Amazon-Seite B07LHCSXV6: alle 10 Folgen geprüft, Abos: Prime, zugang=abo_und_kauf"
`
const NEIN_REGION = (id: number) => `- anilistId: ${id}
  title: "Chaika"
  platform: primevideo
  url: https://www.amazon.de/gp/video/detail/B07LHCSXV6
  dub: false
  checkedAt: '2026-09-28'
  note: "Amazon-Seite B07LHCSXV6: nur 0 von 12 Folgen geladen — Rest ungeprüft, Abos: keine Angabe, gti=amzn1.dv.gti.4ab3e446-1e73-5556-5d01-9905ded6ea33, regionsperre=laut Seite nicht mehr im Abo"
`
const NEIN_TON = (id: number) => `- anilistId: ${id}
  title: "Ohne Ton"
  platform: primevideo
  url: https://www.amazon.de/dp/B0KULISSE01
  dub: false
  checkedAt: '2026-09-28'
  note: "Tonspuren: English, 日本語 — Amazon-Seite B0KULISSE01: alle 12 Folgen geprüft, Abos: Prime"
`
const CHAIKA = 900301
const OHNE_TON = 900302
const NETFLIX_REGION = 900303
const JA_MIT_ALTNOTIZ = 900304
schreibe(
  'data/dub-confirmed.yaml',
  JA(CHAIKA) +
    NEIN_REGION(CHAIKA) +
    NEIN_TON(OHNE_TON) +
    NEIN_REGION(NETFLIX_REGION).replace('platform: primevideo', 'platform: netflix') +
    NEIN_REGION(JA_MIT_ALTNOTIZ).replace('dub: false', 'dub: true'),
)
for (const leer of ['anisearch.json', 'anisearch-dubs.json', 'justwatch-audio.json', 'disc-ausgaben.json']) schreibe(`data/${leer}`, '{}')
schreibe('data/anisearch-ids-hand.yaml', '{}\n')
for (const leer of ['kino-ankuendigungen.yaml', 'ankuendigungen.yaml', 'offizielle-meldungen.yaml', 'folgen-hinweise.yaml']) schreibe(`data/${leer}`, '[]\n')

/* Erst nach dem Schreiben der Kulisse: `grundlagen.ts` liest beim Laden Dateien. */
const { werteWeitereQuellenAus } = await import('./bau/09-5-weitere-quellen.ts')
const { entferneVerweiseMitNein, regionGesperrteWege } = await import('./bau/verweis-grund.ts')
const { ladeHandbelege } = await import('./lib/dub-confirmed.ts')

const GRUND_REGION = 'belegtes Nein: laut Seite in dieser Region nicht mehr im Angebot (keine Aussage zur Tonspur)'
const GRUND_TON = 'belegtes Nein: dort gibt es keine deutsche Tonspur'
const mk = (id: number, plattform: string): Title =>
  ({ id, titleRomaji: `Kulisse ${id}`, format: 'TV', jpYear: 2014, streams: [{ platform: plattform, url: `https://x.example/${id}`, dub: false }] }) as unknown as Title

try {
  console.log('Schlüsselmenge aus den echten Chaika-Zeilen')
  const region = regionGesperrteWege(ladeHandbelege())
  pruefe('Chaika Prime: Regionssperre erkannt', region.has(`${CHAIKA}|primevideo`), [...region])
  pruefe('Nein mit gelesenen Folgen, ohne Regionssperre: nicht darin', !region.has(`${OHNE_TON}|primevideo`), [...region])
  pruefe('Ja mit Regionssperre-Text in der Notiz: nicht darin (jüngstes Urteil zählt)', !region.has(`${JA_MIT_ALTNOTIZ}|primevideo`), [...region])
  pruefe('dieselbe Notiz bei Netflix: nur dort', region.has(`${NETFLIX_REGION}|netflix`) && !region.has(`${CHAIKA}|netflix`), [...region])

  console.log('\nDer Bauschritt werteWeitereQuellenAus schreibt den Grund')
  const titles = new Map([mk(CHAIKA, 'primevideo'), mk(OHNE_TON, 'primevideo'), mk(CHAIKA + 100, 'primevideo')].map((t) => [t.id, t]))
  const entfernt: Parameters<typeof werteWeitereQuellenAus>[0]['verweiseEntfernt'] = []
  werteWeitereQuellenAus({ releases: [] as Release[], titles, adnKatalog: { shows: [] } as never, adnVerweiseErgaenzt: 0, verweiseEntfernt: entfernt, schreibWurzel: kulisse })
  const grundVon = (id: number) => entfernt.find((e) => e.titleId === id)?.grund
  pruefe('entfernt: alle drei Verweise', entfernt.length === 3, entfernt.length)
  pruefe('Chaika (Regionssperre): Grund Regionssperre', grundVon(CHAIKA) === GRUND_REGION, grundVon(CHAIKA))
  pruefe('Titel ohne Ton (kein regionsperre=): Grund keine Tonspur', grundVon(OHNE_TON) === GRUND_TON, grundVon(OHNE_TON))
  pruefe('Titel ohne Handbeleg: Grund keine Tonspur', grundVon(CHAIKA + 100) === GRUND_TON, grundVon(CHAIKA + 100))
  pruefe('jeder Grund beginnt mit „belegtes Nein“ (Gedächtnis `NUR_DIESER_TITEL`, `primeNeinTitel`)', entfernt.every((e) => /^belegtes Nein/.test(e.grund)))

  console.log('\nDer Bauschritt ergaenzeAnisearchWege (frisch ergänzte Verweise gleich wieder entfernt)')
  const { ergaenzeAnisearchWege } = await import('./bau/09-6-anisearch-wege.ts')
  const titles2 = new Map([mk(CHAIKA, 'primevideo'), mk(OHNE_TON, 'primevideo')].map((t) => [t.id, t]))
  const entfernt2: typeof entfernt = []
  ergaenzeAnisearchWege({
    verweiseEntfernt: entfernt2,
    crDub: { scrapedAt: '2026-11-11', serien: [] } as never,
    usNeinWiderlegt: () => false,
    titles: titles2,
    anisearch: {},
    belegFuer: () => undefined,
    linkBefunde: {},
    lautPruefungTot: () => false,
    crAdresseZu: () => undefined,
    crKatalogDeutsch: new Set(),
    checks: new Map(),
    adnArchiv: { serien: new Map() } as never,
    adnStreamSchaerfen: () => false,
  })
  const grund2 = (id: number) => entfernt2.find((e) => e.titleId === id)?.grund
  pruefe('Wege-Schritt: Chaika (Regionssperre): Grund Regionssperre', grund2(CHAIKA) === GRUND_REGION, entfernt2)
  pruefe('Wege-Schritt: Titel ohne Ton: Grund keine Tonspur', grund2(OHNE_TON) === GRUND_TON, entfernt2)

  console.log('\nDer Helfer: Netflix-Sperre trifft Prime nicht')
  const netflix = mk(NETFLIX_REGION, 'primevideo')
  const rest: typeof entfernt = []
  pruefe('Region nur bei Netflix gesperrt: Prime-Weg derselben Kennung behält „keine Tonspur“', entferneVerweiseMitNein(netflix, rest, region) === 1 && rest[0]?.grund === GRUND_TON, rest)
} catch (e) {
  fehler++
  console.error(`  ✖ lief nicht: ${(e as Error).stack}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

console.log(`\nVerweis-Grund Regionssperre: ${faelle} Fälle, ${fehler} Fehler`)
if (fehler) process.exit(1)
