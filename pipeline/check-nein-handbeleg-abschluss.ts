/**
 * Zusicherung für den Aufruf im Bau (14.10.2026, Prüfer-Befund zu „Nein-Belege überall berücksichtigen“): `schliesseWegeAb` reicht
 * die Handbelege an `entferneBezugswegeTrotzNein` weiter. Die Funktion selbst ist in `check-nein-handbeleg.ts` getestet; fiele der Aufruf
 * (oder die weitergereichten `alleChecks`) weg, bliebe dort alles grün und erst der nächste Bestandsbau schlüge an. Hier läuft der Abschluss.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-nein-handbeleg-abschluss.ts`
 */
import type { Release, StreamLink, Title, WatchLink } from '../shared/types.ts'
import { schliesseWegeAb } from './bau/11-wege-abschluss.ts'
import { suchadressenInTemp } from './lib/suchadressen-temp.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ID = 9000020
const weg = (name: string, url: string): WatchLink => ({ name, url, kind: 'stream' }) as WatchLink
const beleg = (platform: string, rest: { dub?: boolean; available?: boolean }) => ({ anilistId: ID, platform, ...rest }) as DubCheck

/* Der Abschluss schreibt bei jedem Lauf die JustWatch-Widerspruchsliste; der Test lenkt sie in einen Temp-Ordner um. */
suchadressenInTemp()

/** Lässt den Abschluss mit einem Titel (Netflix- und Prime-Bezugsweg) und den Handbelegen laufen; liefert die Namen der verbleibenden Bezugswege. */
function lauf(alleChecks: DubCheck[]): string {
  const titel = {
    id: ID,
    streams: [],
    keywords: [],
    genres: [],
    watchLinks: [weg('Netflix', 'https://www.netflix.com/title/81567663'), weg('Prime Video', 'https://www.amazon.de/dp/B000000000')],
  } as unknown as Title
  schliesseWegeAb({
    titles: new Map([[ID, titel]]),
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
    alleChecks,
    lautPruefungTot: () => false,
    checksJePlattform: new Map(),
    belegFuer: () => undefined,
  })
  return (titel.watchLinks ?? []).map((w) => w.name).join()
}

console.log('\nWege-Abschluss reicht die Handbelege weiter:')
{
  pruefe('Vorbedingung: ohne Handbeleg bleiben beide Bezugswege stehen', lauf([]) === 'Netflix,Prime Video', lauf([]))
  pruefe('ein „nicht verfügbar“ für Netflix nimmt dessen Bezugsweg heraus, Prime bleibt', lauf([beleg('netflix', { available: false })]) === 'Prime Video', lauf([beleg('netflix', { available: false })]))
  pruefe('ein Ja derselben Plattform neben dem Nein lässt den Weg stehen', lauf([beleg('netflix', { available: false }), beleg('netflix', { dub: true })]) === 'Netflix,Prime Video')
}

/** Kamisama-Kiss-Lage (14713): Aniverse-Termin vom 08.10.2026 ohne Adresse, Prime-Nein „Suche ohne Treffer“ ohne Adresse; liefert die Prime-Wege des Titels. */
function lauf14713(nein: { checkedAt: string }): StreamLink[] {
  const titel = { id: ID, streams: [], keywords: [], genres: [], watchLinks: [] } as unknown as Title
  const termin = { slug: 'auto-14713-primevideo', titleId: ID, platform: 'primevideo', kanal: 'Aniverse', releaseType: 'batch', schedule: { firstEpisodeDate: '2026-10-08', episodeCount: 13 }, sources: ['https://www.anime2you.de/news/1056322/aniverse-oktober-2026-neuzugaenge/'] } as unknown as Release
  schliesseWegeAb({
    titles: new Map([[ID, titel]]),
    anisearch: {},
    releases: [termin],
    zugangJeAdresse: new Map(),
    tmdbMehrdeutig: new Set(),
    toteAdressen: new Set(),
    linkBefunde: {},
    verweiseEntfernt: [],
    crAdresseZu: () => undefined,
    beantworteteSuchen: new Set(),
    suchOffen: [],
    alleChecks: [{ ...beleg('primevideo', { available: false }), ...nein }],
    lautPruefungTot: () => false,
    checksJePlattform: new Map(),
    belegFuer: () => ({ ...beleg('primevideo', { available: false }), ...nein }),
  })
  return titel.streams.filter((s) => s.platform === 'primevideo')
}

console.log('\nWege-Abschluss: überholtes Prime-Nein bei Kanal-Termin (`ueberholteNeins`):')
{
  const alt = lauf14713({ checkedAt: '2026-08-27' })
  pruefe('Nein vom 27.08. vor dem Termin vom 08.10.: Weg mit Kanal, ohne Tonurteil, Herkunft Termin', alt.length === 1 && alt[0]!.kanal === 'Aniverse' && alt[0]!.dub === undefined && alt[0]!.herkunft === 'termin', alt)
  const jung = lauf14713({ checkedAt: '2026-10-20' })
  pruefe('Nein jünger als der Termin: kein Weg', jung.length === 0, jung)
}

console.log(verletzt ?`\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
