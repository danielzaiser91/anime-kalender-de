/**
 * Je Titel genau ein Crunchyroll-Eintrag zur Serie (Anlass: The Vermilion Mask, 01.11.2026 — „Crunchyroll ✓ Deutsch“ und darunter
 * „Crunchyroll nur Untertitel“). Ursache: `ordneNeueSerienZu` hängte den Serienweg an einen Titel, der schon den JustWatch-Folgen-Link
 * `/watch/GE00384363JAJP` trug. Die Adressen stehen wörtlich in `public/data/titles.json` (Stand 01.11.2026). Der Wächter hängt in
 * `pruefeErgebnis` (Bau-Abschluss); hier läuft er durch dieses echte Tor und durch die echte Zuordnung.
 *
 * Aufruf: npx tsx pipeline/check-cr-doppelt-weg.ts
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import type { NeueSerienFolge } from './lib/cr-neue-serie.ts'

/* `bereinigeWege` schreibt Nebendateien (Suchadressen): Wurzel vor dem Laden der Module in einen Wegwerf-Ordner legen. */
process.env.AK_ROOT = mkdtempSync(join(tmpdir(), 'cr-doppelt-'))
mkdirSync(join(process.env.AK_ROOT, 'data'), { recursive: true })
mkdirSync(join(process.env.AK_ROOT, 'daniel-zum-abarbeiten', 'listen'), { recursive: true })
writeFileSync(join(process.env.AK_ROOT, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(process.env.AK_ROOT, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
const { crWegDoppelt } = await import('./lib/cr-doppelter-weg.ts')
const { ordneNeueSerienZu } = await import('./lib/cr-neue-serie.ts')
const { pruefeErgebnis } = await import('./lib/pruefung.ts')
const { bereinigeWege, entdoppleCrWege } = await import('./bau/11-3-bereinigung.ts')

const WATCH = 'https://www.crunchyroll.com/de/watch/GE00384363JAJP'
const SERIE = 'https://www.crunchyroll.com/de/series/GT00384015'
const FOLGE: NeueSerienFolge = { guid: 'GE00384363DEDE', serieId: 'GT00384015', serie: 'The Vermilion Mask', staffelId: 'GS00384047DEDE', staffel: 'Staffel 1', nummer: 1, ausstrahlung: '2026-10-10T00:00:00.000Z', verfuegbarAb: '2026-10-31T09:30:00.000Z', gesehenAm: '2026-10-31' }
const PRIME = (n: string) => ({ platform: 'primevideo', url: `https://watch.amazon.de/detail?gti=amzn1.dv.gti.${n}` })
const NETFLIX = (n: string) => ({ platform: 'netflix', url: `https://www.netflix.com/title/${n}` })

const vermilion = (streams: Record<string, unknown>[]): Title => ({ id: 195571, titleEn: 'The Vermilion Mask', titleRomaji: 'Shuiro no Kamen', jpYear: 2026, streams }) as unknown as Title

let fehler = 0
let faelle = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  faelle++
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const zuordnen = (t: Title) => ordneNeueSerienZu({ folgen: [FOLGE], titles: [t], nachUrl: new Map(), handNein: new Set() })

console.log('Wächter crWegDoppelt')
const alt = vermilion([{ platform: 'crunchyroll', url: WATCH, zugang: 'abo' }, { platform: 'crunchyroll', url: SERIE, dub: true }])
pruefe('Vermilion wie live (Watch + Serie): ein Fehler mit Titelkennung', crWegDoppelt(new Map([[alt.id, alt]])).length === 1 && crWegDoppelt(new Map([[alt.id, alt]]))[0]!.startsWith('Anime 195571'))
pruefe('Serienseite zuerst, Watch danach: ebenfalls Fehler', crWegDoppelt(new Map([[1, vermilion([{ platform: 'crunchyroll', url: SERIE }, { platform: 'crunchyroll', url: WATCH }])]])).length === 1)
pruefe('Nur Watch (keine Serie bekannt): in Ordnung', crWegDoppelt(new Map([[1, vermilion([{ platform: 'crunchyroll', url: WATCH }])]])).length === 0)
pruefe('Nur Serie: in Ordnung', crWegDoppelt(new Map([[1, vermilion([{ platform: 'crunchyroll', url: SERIE }])]])).length === 0)
pruefe('Prime mit mehreren ASINs und Netflix mit mehreren Titelseiten (je Staffel): in Ordnung', crWegDoppelt(new Map([[1, vermilion([PRIME('a'), PRIME('b'), NETFLIX('1'), NETFLIX('2')])]])).length === 0)
pruefe('Watch bei Crunchyroll neben Serie bei Netflix-Titelseiten: nur Crunchyroll zählt', crWegDoppelt(new Map([[1, vermilion([{ platform: 'crunchyroll', url: WATCH }, NETFLIX('1')])]])).length === 0)

console.log('Zuordnung und Tor')
const zuerst = vermilion([{ platform: 'crunchyroll', url: WATCH, zugang: 'abo' }, PRIME('a')])
const aus = zuordnen(zuerst)
pruefe('Zuordnung: Serie dub:true ersetzt die Watch-Adresse an derselben Stelle, Prime bleibt dahinter', aus.zugeordnet.length === 1 && JSON.stringify(zuerst.streams.map((s) => s.url)) === JSON.stringify([SERIE, PRIME('a').url]) && zuerst.streams[0]!.dub === true, zuerst.streams)
const mitte = vermilion([NETFLIX('1'), { platform: 'crunchyroll', url: WATCH }, PRIME('a')])
zuordnen(mitte)
pruefe('Watch in der Mitte: Serie steht an ihrer Stelle', mitte.streams.map((s) => s.platform).join() === 'netflix,crunchyroll,primevideo', mitte.streams)
const tor = (t: Title) => pruefeErgebnis([], [], new Map([[t.id, t]]), '2026-11-01').fehler.filter((f) => f.includes('Folgen-Link'))
pruefe('Tor pruefeErgebnis: Zustand nach der Zuordnung ohne Fehler', tor(zuerst).length === 0, tor(zuerst))
pruefe('Tor pruefeErgebnis: alter Zustand (Watch + Serie) meldet den Fehler', tor(alt).length === 1, tor(alt))

console.log('Zusammenführung im Bau (11-3, nach JustWatch)')
const crUrls = (t: Title) => t.streams.filter((s) => s.platform === 'crunchyroll').map((s) => s.url)
const mapVon = (t: Title) => new Map([[t.id, t]])
const zwei = vermilion([{ platform: 'crunchyroll', url: WATCH, zugang: 'abo' }, { platform: 'crunchyroll', url: SERIE, dub: true, dubRanges: [{ from: 1, to: 1, dub: true }] }, PRIME('a'), PRIME('b')])
pruefe('entdoppleCrWege: Watch neben Serie entfällt (1 entfernt), Serie mit dub bleibt, beide ASINs bleiben', entdoppleCrWege(mapVon(zwei)) === 1 && JSON.stringify(crUrls(zwei)) === JSON.stringify([SERIE]) && zwei.streams[0]!.dub === true && zwei.streams.length === 3, zwei.streams)
const umgekehrt = vermilion([{ platform: 'crunchyroll', url: SERIE, dub: true }, { platform: 'crunchyroll', url: WATCH }])
pruefe('entdoppleCrWege: Serie vor Watch: ebenso', entdoppleCrWege(mapVon(umgekehrt)) === 1 && JSON.stringify(crUrls(umgekehrt)) === JSON.stringify([SERIE]), umgekehrt.streams)
const nurW = vermilion([{ platform: 'crunchyroll', url: WATCH }, NETFLIX('1')])
pruefe('entdoppleCrWege: Watch ohne Serie bleibt', entdoppleCrWege(mapVon(nurW)) === 0 && nurW.streams.length === 2, nurW.streams)
const fremd = vermilion([{ platform: 'netflix', url: 'https://www.netflix.com/watch/81089326' }, { platform: 'crunchyroll', url: SERIE, dub: true }])
pruefe('entdoppleCrWege: /watch/ bei anderem Anbieter bleibt', entdoppleCrWege(mapVon(fremd)) === 0 && fremd.streams.length === 2, fremd.streams)
const imBau = vermilion([{ platform: 'crunchyroll', url: WATCH }, { platform: 'crunchyroll', url: SERIE, dub: true }])
bereinigeWege({ titles: mapVon(imBau), anisearch: {}, toteAdressen: new Set(), linkBefunde: {}, verweiseEntfernt: [], crAdresseZu: () => undefined, beantworteteSuchen: new Set(), suchOffen: [] })
pruefe('bereinigeWege (Bau-Aufrufer) ruft die Zusammenführung: Vermilion danach mit einem Eintrag', JSON.stringify(crUrls(imBau)) === JSON.stringify([SERIE]), imBau.streams)

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log(`check-cr-doppelt-weg: ${faelle} Fälle grün (Vermilion Watch+Serie rot, nach Zuordnung grün)`)
