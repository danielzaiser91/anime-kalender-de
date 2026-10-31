/**
 * Zusicherung: Ein Handbeleg „deutsch“ mit Adresse trägt seinen Weg bis in den Datensatz (14.10.2026, Durarara!! Tenka Taihei).
 * Zwei Stellen warfen ihn heraus: das „nicht mehr verfügbar“ des US-Katalogs über die Serienkennung (`09-4-1`) und das Leeren der Wege
 * aller Titel nur bei aniSearch (`11-wege-abschluss`). Geprüft werden beide Phasen samt Aufrufer an fester Kulisse (kein Echtdatenstand; die echten Handbelege prüft check:handbelege).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-handbeleg-weg.ts`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StreamLink, Title } from '../shared/types.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'
import { ordneCrSerienZu } from './bau/09-4-1-serien.ts'
import { schliesseWegeAb } from './bau/11-wege-abschluss.ts'
import { suchadressenInTemp } from './lib/suchadressen-temp.ts'
import { behalteNurHandbelegteWege } from './lib/handbeleg-weg.ts'
import { verschmelze, type DubCheck } from './lib/dub-confirmed.ts'
import { baueNews, type NewsHistorie } from './lib/news.ts'
import { addDays, todayIso } from '../shared/time.ts'

/**
 * Ohne `AK_ROOT` startet die Prüfung sich selbst gegen eine Kulisse mit genau einem Handbeleg: `ordneCrSerienZu` liest
 * `data/dub-confirmed.yaml` selbst, der Sammlerstand der echten Datei soll den Fall nicht kippen.
 */
const KULISSEN_BELEG = [
  '- anilistId: 10006986',
  '  platform: crunchyroll',
  '  url: https://www.crunchyroll.com/series/G619XVNEY/durarara',
  '  dub: true',
  "  checkedAt: '2026-10-13'",
  '',
].join('\n')
function startInKulisse(): never {
  const kulisse = mkdtempSync(join(tmpdir(), 'handbeleg-weg-'))
  mkdirSync(join(kulisse, 'data', 'curated'), { recursive: true })
  writeFileSync(join(kulisse, 'data', 'kino-ankuendigungen.yaml'), '')
  writeFileSync(join(kulisse, 'data', 'shop-wege-falsches-ziel.yaml'), '[]\n')
  writeFileSync(join(kulisse, 'data', 'dub-confirmed.yaml'), KULISSEN_BELEG)
  const r = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url)], {
    env: { ...process.env, AK_ROOT: kulisse },
    stdio: 'inherit',
    windowsHide: true,
  })
  rmSync(kulisse, { recursive: true, force: true })
  process.exit(r.status ?? 1)
}
if (!process.env.AK_ROOT) startInKulisse()

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const OVA = 10006986
const SERIE = 'G619XVNEY'
/** Feste Kulisse statt Echtdaten (Adresse wie im Handbeleg, 14.10.2026): ein Sammler-PR darf dub-confirmed.yaml bewegen, ohne den Fall zu kippen. */
const URL_BELEG = 'https://www.crunchyroll.com/series/G619XVNEY/durarara'

const weg = (url: string, rest: Partial<StreamLink> = {}): StreamLink => ({ platform: 'crunchyroll', url, ...rest }) as StreamLink
const titel = (id: number, streams: StreamLink[]): Title => ({ id, episodes: 1, streams, keywords: [], genres: [] }) as unknown as Title
const ja = (rest: Partial<DubCheck> = {}): DubCheck => ({ anilistId: OVA, platform: 'crunchyroll', url: URL_BELEG, dub: true, checkedAt: '2026-10-13', ...rest })

console.log('\nUS-Nein über die Serienkennung (09-4-1), eigene Kulisse (kein Sammlerstand):')
/** Die Serie steht im US-Katalog als nicht verfügbar; der Sammler darf sie im echten Bestand umsetzen, der Fall bleibt. */
const usNeinKatalog = {
  scrapedAt: '',
  serien: [{ url: URL_BELEG, seriesId: SERIE, katalog: 'us', nichtVerfuegbar: true }],
} as unknown as CrDubData
function zuordnen(titel_: Title[]): void {
  ordneCrSerienZu({
    titles: new Map(titel_.map((t) => [t.id, t])),
    crDub: usNeinKatalog,
    usNeinWiderlegt: () => false,
    verweiseEntfernt: [],
  })
}
const ova = titel(OVA, [weg(URL_BELEG)])
const fremdeSeite = titel(6746, [weg(URL_BELEG)])
const andereAdresse = titel(OVA + 1, [weg(`https://www.crunchyroll.com/de/series/${SERIE}/durarara`)])
zuordnen([ova, fremdeSeite, andereAdresse])
pruefe('der Handbeleg-Weg überlebt das US-Nein der Serie', ova.streams.length === 1, ova.streams)
pruefe('Gegenprobe: dieselbe Adresse an einem Titel ohne Handbeleg fällt', fremdeSeite.streams.length === 0, fremdeSeite.streams)
pruefe('Gegenprobe: eine andere Adresse derselben Serie fällt (Beleg gilt der Adresse)', andereAdresse.streams.length === 0, andereAdresse.streams)

/* Der deutsche Katalog entscheidet weiter: Führt er die Serie als nicht verfügbar, fällt auch der Handbeleg-Weg. */
const deTot = titel(OVA, [weg(URL_BELEG)])
ordneCrSerienZu({
  titles: new Map([[OVA, deTot]]),
  crDub: { scrapedAt: '', serien: [{ url: URL_BELEG, seriesId: SERIE, katalog: 'de', nichtVerfuegbar: true }] } as unknown as CrDubData,
  usNeinWiderlegt: () => false,
  verweiseEntfernt: [],
})
pruefe('Gegenprobe: ein „nicht verfügbar“ des deutschen Katalogs entfernt auch den Handbeleg-Weg', deTot.streams.length === 0, deTot.streams)

console.log('\nTitel nur bei aniSearch (behalteNurHandbelegteWege):')
const behalten = (checks: DubCheck[], streams: StreamLink[]): StreamLink[] => {
  const t = titel(OVA, streams)
  behalteNurHandbelegteWege(t, checks)
  return t.streams
}
const mitHerkunft = behalten([ja()], [weg(URL_BELEG), weg('https://www.netflix.com/title/1', { platform: 'netflix' })])
pruefe('der belegte Weg bleibt, mit Herkunft „handbeleg“, der erratene fällt', mitHerkunft.length === 1 && mitHerkunft[0]!.herkunft === 'handbeleg', mitHerkunft)
pruefe('Gegenprobe: ohne Beleg fällt alles', behalten([], [weg(URL_BELEG)]).length === 0)
pruefe('Gegenprobe: ein Nein trägt keinen Weg', behalten([ja({ dub: false })], [weg(URL_BELEG)]).length === 0)
pruefe('Gegenprobe: ein Beleg ohne Adresse trägt keinen Weg', behalten([ja({ url: undefined })], [weg(URL_BELEG)]).length === 0)
/* Ohne die Adress-Bedingung träfe der leere Kern des Belegs den leeren Kern eines Wegs ohne Adresse. */
pruefe('Gegenprobe: ein Beleg ohne Adresse trägt auch keinen Weg ohne Adresse', behalten([ja({ url: undefined })], [weg('')]).length === 0)
const spaeterWeg = verschmelze(ja(), { anilistId: OVA, platform: 'crunchyroll', url: URL_BELEG, available: false, checkedAt: '2026-10-14' })
pruefe('Gegenprobe: ein jüngeres „nicht verfügbar“ zur selben Adresse nimmt dem Ja den Weg', spaeterWeg.dub === true && behalten([spaeterWeg], [weg(URL_BELEG)]).length === 0, spaeterWeg)
pruefe('Gegenprobe: eine andere Adresse fällt', behalten([ja()], [weg('https://www.crunchyroll.com/series/GANDERE/x')]).length === 0)
pruefe('Gegenprobe: der Beleg eines anderen Titels trägt nichts', behalten([ja({ anilistId: 1 })], [weg(URL_BELEG)]).length === 0)
pruefe('Gegenprobe: eine andere Plattform fällt', behalten([ja({ platform: 'netflix' })], [weg(URL_BELEG)]).length === 0)

console.log('\nAufrufer (schliesseWegeAb) reicht die Belege durch:')
/** Der Abschluss schreibt nebenbei die Listen der offenen Suchadressen; die Prüfung lenkt sie in einen Temp-Ordner um. */
suchadressenInTemp()
function abschliessen(checks: DubCheck[]): StreamLink[] {
  const nurAnisearch = titel(10_000_000 + OVA, [weg(URL_BELEG, { dub: true })])
  schliesseWegeAb({
    titles: new Map([[nurAnisearch.id, nurAnisearch]]),
    anisearch: {},
    releases: [],
    zugangJeAdresse: new Map(),
    tmdbMehrdeutig: new Set(),
    toteAdressen: new Set(),
    linkBefunde: {},
    verweiseEntfernt: [],
    crAdresseZu: () => undefined,
    beantworteteSuchen: new Set(),
    suchOffen: [],
    alleChecks: checks,
    lautPruefungTot: () => false,
    checksJePlattform: new Map(),
    belegFuer: () => undefined,
  })
  return nurAnisearch.streams
}
pruefe('ein Titel nur bei aniSearch behält den Weg seines Handbelegs', abschliessen([ja({ anilistId: 10_000_000 + OVA })]).length === 1)
pruefe('Gegenprobe: ohne Handbeleg bleibt er ohne Weg', abschliessen([]).length === 0)

console.log('\nNews: ein Handbeleg-Weg belegt das Angebot, nicht seinen Beginn (keine rückdatierte Meldung „neu“):')
const nachrichtTitel = (streams: StreamLink[]): Title[] =>
  [{ id: OVA, franchiseId: OVA, slug: 'ova', titleEn: 'OVA', keywords: [], genres: [], streams }] as unknown as Title[]
const neuMeldungen = (streams: StreamLink[]): string[] =>
  baueNews(nachrichtTitel(streams), [], [{ id: OVA, seit: addDays(todayIso(), -7) }], [], { zuerst: {} })
    .flatMap((e) => e.meldungen)
    .filter((m) => m.art === 'neu')
    .map((m) => `${m.platform}`)
pruefe('ein Titel mit nur einem Handbeleg-Weg bekommt kein „neu auf Deutsch“', neuMeldungen([weg(URL_BELEG, { dub: true, herkunft: 'handbeleg' })]).length === 0)
pruefe('Gegenprobe: derselbe Weg ohne Herkunft „handbeleg“ meldet', neuMeldungen([weg(URL_BELEG, { dub: true })]).join() === 'crunchyroll')
/** Meldungen „jetzt auch bei“ nach einem ersten Bau, der den Crunchyroll-Weg schon kannte. */
function weitereAnbieter(herkunft: StreamLink['herkunft']): string[] {
  const historie: NewsHistorie = { zuerst: {} }
  const cr = weg(URL_BELEG, { dub: true, herkunft })
  baueNews(nachrichtTitel([cr]), [], [], [], historie)
  const netflix = weg('https://www.netflix.com/title/1', { platform: 'netflix', dub: true, herkunft })
  return baueNews(nachrichtTitel([cr, netflix]), [], [], [], historie).flatMap((e) => e.meldungen.filter((m) => m.weiterer).map((m) => `${m.platform}`))
}
pruefe('ein weiterer Handbeleg-Weg bekommt kein „jetzt auch bei“', weitereAnbieter('handbeleg').length === 0, weitereAnbieter('handbeleg'))
pruefe('Gegenprobe: derselbe Weg ohne Herkunft „handbeleg“ meldet', weitereAnbieter(undefined).join() === 'netflix', weitereAnbieter(undefined))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
