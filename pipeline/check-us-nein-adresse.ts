/**
 * Zusicherung: Ein „nicht mehr verfügbar“ aus dem US-Katalog entfernt nur Wege auf die US-Adresse, nicht den
 * deutschen Weg, wenn der deutsche Katalog dieselbe Serienkennung mit Staffeln führt (24.10.2026, My Teen Romantic
 * Comedy SNAFU: Climax). Geprüft wird `ordneCrSerienZu` an fester Kulisse, ohne Echtdaten.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-us-nein-adresse.ts`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StreamLink, Title } from '../shared/types.ts'
import type { CrDubData, CrSerie } from './lib/crunchyroll-dub.ts'
import { ordneCrSerienZu } from './bau/09-4-1-serien.ts'

/** `ordneCrSerienZu` liest `data/dub-confirmed.yaml` selbst; die Kulisse hat keine Belege. */
function startInKulisse(): never {
  const kulisse = mkdtempSync(join(tmpdir(), 'us-nein-adresse-'))
  mkdirSync(join(kulisse, 'data', 'curated'), { recursive: true })
  writeFileSync(join(kulisse, 'data', 'kino-ankuendigungen.yaml'), '')
  writeFileSync(join(kulisse, 'data', 'dub-confirmed.yaml'), '')
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
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ID = 'GTESTA001'
const DE_ADRESSE = `https://www.crunchyroll.com/de/series/${ID}/testserie`
const US_ADRESSE = `https://www.crunchyroll.com/series/${ID}/testserie`
const staffeln = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `S${i + 1}` }))

const usNein = { url: DE_ADRESSE, seriesId: ID, katalog: 'us', nichtVerfuegbar: true } as unknown as CrSerie
const deJa = (rest: object = {}) => ({ url: DE_ADRESSE, seriesId: ID, katalog: 'de', staffeln: staffeln(3), ...rest }) as unknown as CrSerie

const weg = (url: string): StreamLink => ({ platform: 'crunchyroll', url }) as StreamLink
const titel = (id: number, url: string): Title => ({ id, episodes: 1, streams: [weg(url)], keywords: [], genres: [] }) as unknown as Title

/** Zuordnen und die Adressen zurückgeben, die je Titel (Kennung 900001 …) übrig bleiben. */
function uebrig(serien: CrSerie[], urls: string[]): string[][] {
  const ts = urls.map((u, i) => titel(900_001 + i, u))
  ordneCrSerienZu({
    titles: new Map(ts.map((t) => [t.id, t])),
    crDub: { scrapedAt: '', serien } as unknown as CrDubData,
    usNeinWiderlegt: () => false,
    verweiseEntfernt: [],
  })
  return ts.map((t) => t.streams.map((s) => s.url))
}

console.log('\nUS-Nein trifft nur die US-Adresse (09-4-1):')
{
  const [de, us] = uebrig([usNein, deJa()], [DE_ADRESSE, US_ADRESSE])
  pruefe('deutscher Katalog führt die Serie: der deutsche Weg bleibt', de!.length === 1, de)
  pruefe('Gegenprobe: der Weg auf die US-Adresse fällt', us!.length === 0, us)
}
{
  const [a, b] = uebrig([usNein, deJa()], [DE_ADRESSE, `${DE_ADRESSE}?x=1`])
  pruefe('mehrere Titel an derselben Kennung: alle deutschen Wege bleiben', a!.length === 1 && b!.length === 1, [a, b])
}
{
  const http = `http://www.crunchyroll.com/de/series/${ID}/testserie`
  const ohneWww = `https://crunchyroll.com/de/series/${ID}/testserie`
  const andereSprache = `https://www.crunchyroll.com/fr/series/${ID}/testserie`
  /* Ohne /series/ greift nur der Adressvergleich mit der Adresse des US-Satzes (so steht SNAFU im Bestand). */
  const nurAdresse = (url: string) => uebrig([{ ...usNein, url } as CrSerie, deJa()], [url])[0]!
  pruefe('deutsche Adresse mit http bleibt', nurAdresse(http).length === 1, nurAdresse(http))
  pruefe('deutsche Adresse ohne www bleibt', nurAdresse(ohneWww).length === 1, nurAdresse(ohneWww))
  pruefe('Gegenprobe: eine andere Sprachfassung fällt', nurAdresse(andereSprache).length === 0, nurAdresse(andereSprache))
  const ohneStaffelnFeld = { url: DE_ADRESSE, seriesId: ID, katalog: 'de' } as unknown as CrSerie
  pruefe('Gegenprobe: deutscher Satz ohne Staffel-Feld schützt nicht', uebrig([usNein, ohneStaffelnFeld], [DE_ADRESSE])[0]!.length === 0)
}
{
  const fremd = 'https://www.crunchyroll.com/de/series/GANDERE99/fremd'
  const [serieA, fremdWeg] = uebrig([usNein, deJa()], [DE_ADRESSE, fremd])
  pruefe('Gegenprobe: eine fremde Kennung wird nicht berührt', fremdWeg!.length === 1 && serieA!.length === 1, [serieA, fremdWeg])
}
{
  const [de] = uebrig([usNein], [DE_ADRESSE])
  pruefe('Gegenprobe: ohne deutschen Katalogsatz fällt auch der /de/-Weg (US-Nein allein widerlegt nicht, entfernt aber wie bisher)', de!.length === 0, de)
}
{
  const [de] = uebrig([usNein, deJa({ nichtVerfuegbar: true })], [DE_ADRESSE])
  pruefe('Gegenprobe: deutscher Satz „nicht verfügbar“ → der Weg fällt', de!.length === 0, de)
}
{
  const [de] = uebrig([usNein, deJa({ staffeln: [] })], [DE_ADRESSE])
  pruefe('Gegenprobe: deutscher Satz ohne Staffeln → der Weg fällt', de!.length === 0, de)
}
{
  const [de] = uebrig([usNein, deJa({ staffeln: staffeln(1) })], [DE_ADRESSE])
  pruefe('genau eine deutsche Staffel genügt', de!.length === 1, de)
}
{
  const zweiterTot = deJa({ url: `${DE_ADRESSE}-zwei`, nichtVerfuegbar: true })
  const [de] = uebrig([usNein, deJa(), zweiterTot], [DE_ADRESSE])
  pruefe('Gegenprobe: ein zweiter deutscher Satz derselben Kennung verneint → der Weg fällt', de!.length === 0, de)
}
{
  const ohneId = { ...usNein, seriesId: null } as unknown as CrSerie
  const [de] = uebrig([ohneId, deJa()], [DE_ADRESSE])
  pruefe('Gegenprobe: ohne Serienkennung gilt der Adressvergleich wie bisher', de!.length === 0, de)
}

console.log(`\nUS-Nein/Adresse: ${faelle} Fälle, ${verletzt} verletzt`)
process.exit(verletzt ? 1 : 0)
