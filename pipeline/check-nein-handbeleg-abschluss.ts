/**
 * Zusicherung für den Aufruf im Bau (14.10.2026, Prüfer-Befund zu „Nein-Belege überall berücksichtigen“): `schliesseWegeAb` reicht
 * die Handbelege an `entferneBezugswegeTrotzNein` weiter. Die Funktion selbst ist in `check-nein-handbeleg.ts` getestet; fiele der Aufruf
 * (oder die weitergereichten `alleChecks`) weg, bliebe dort alles grün und erst der nächste Bestandsbau schlüge an. Hier läuft der Abschluss.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-nein-handbeleg-abschluss.ts`
 */
import type { Title, WatchLink } from '../shared/types.ts'
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

/* `bereinigeWege` schreibt bei jedem Lauf die Suchadressen-Liste; der Test lenkt sie in einen Temp-Ordner um. */
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

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
