/**
 * Zusicherung für den Bau (02.11.2026, Beelzebub): `schliesseWegeAb` legt aus einem sicheren Termin keinen Weg auf eine Adresse an,
 * die die Linkprüfung als tot kennt, auch wenn ein Handbeleg „deutsch" dazu steht. Der Bestandsbau war 13 Läufe rot, weil
 * `ergaenzeWegeAusTerminen` nur `toteAdressen` (Handbelege „nicht verfügbar") kannte. Hier läuft der ganze Abschluss.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-tote-adresse-termin.ts`
 */
import type { Release, Title } from '../shared/types.ts'
import { schliesseWegeAb } from './bau/11-wege-abschluss.ts'
import { suchadressenInTemp } from './lib/suchadressen-temp.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ID = 9000030
const TOT = 'https://www.netflix.com/title/81253271'
const LEBT = 'https://www.netflix.com/title/81253272'
const HANDBELEG = {
  anilistId: ID,
  platform: 'netflix',
  url: TOT,
  dub: true,
  dubRanges: [{ from: 1, to: 48, dub: true }],
  checkedAt: '2026-09-24',
} as unknown as DubCheck

suchadressenInTemp()

/** Lässt den Abschluss mit einem Netflix-Termin (Adresse `url`) und dem Handbeleg laufen; liefert die Wege des Titels. */
function lauf(url: string, tot: (u: string) => boolean): Title['streams'] {
  const titel = { id: ID, streams: [], keywords: [], genres: [], watchLinks: [] } as unknown as Title
  const termin = {
    slug: 'tote-adresse-termin',
    titleId: ID,
    platform: 'netflix',
    releaseType: 'batch',
    platformUrl: url,
    schedule: { firstEpisodeDate: '2026-10-02' },
    sources: ['https://quelle.example/'],
  } as unknown as Release
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
    alleChecks: [HANDBELEG],
    lautPruefungTot: tot,
    checksJePlattform: new Map(),
    belegFuer: (id, plattform, u) => (id === ID && plattform === 'netflix' && u === TOT ? HANDBELEG : undefined),
  })
  return titel.streams
}

console.log('\nWege aus Terminen und die Linkprüfung:')
{
  const tot = (u: string) => u === TOT
  const mitTotem = lauf(TOT, tot) ?? []
  pruefe('Termin auf tote Adresse: kein Weg mit dieser Adresse', !mitTotem.some((s) => s.url === TOT), mitTotem)
  pruefe('Kontrolle: ohne Prüfbefund legt der Termin den Weg samt Handbeleg-Urteil an', (lauf(TOT, () => false) ?? []).some((s) => s.url === TOT && s.dub === true))
  pruefe('lebende Adresse (andere Kennung) bleibt Weg des Termins', (lauf(LEBT, tot) ?? []).some((s) => s.url === LEBT))
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
