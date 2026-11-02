/**
 * Zusicherung für den Bau (02.11.2026, Beelzebub): Jede Runde von `schliesseWegeAb`, die Wege anlegt, kennt beide Quellen von „tot“:
 * Handbeleg „nicht verfügbar“ (`toteAdressen`) und Linkprüfung (`lautPruefungTot`). Der Bestandsbau war 13 Läufe rot, weil
 * `ergaenzeWegeAusTerminen` nur die erste kannte. Je Runde ein Fall mit einer Adresse, die nur die Linkprüfung als tot kennt
 * (`toteAdressen` bleibt leer), dazu die lebende Zwillingsadresse als Kontrolle; ein Handbeleg-Fall prüft die andere Quelle.
 * Der ganze Abschluss läuft auf einer Kulisse im Temp-Ordner (`AK_ROOT`), so erreicht der Test auch die Verdrahtung.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-tote-adresse-runden.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'
import type { DubCheck } from './lib/dub-confirmed.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'tote-adresse-runden-'))
process.env.AK_ROOT = wurzel
const daten = join(wurzel, 'data')
mkdirSync(join(daten, 'curated'), { recursive: true })
writeFileSync(join(daten, 'kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(daten, 'shop-wege-falsches-ziel.yaml'), '[]\n')
writeFileSync(join(daten, 'fanservice-urteil.yaml'), '')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const NF = (n: number) => `https://www.netflix.com/title/8125327${n}`
const GTI = (n: number) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.0000000${n}-0000-0000-0000-000000000000`
const TMDB = 'https://www.themoviedb.org/tv/1/watch'
const IDS = { motnTot: 9000051, motnLebt: 9000052, ohneWeg: 9000041, abo: 9000042, kauf: 9000043, tmdb: 9000044, extra: 9000045, anisearch: 9000046, termin: 9000047 }
/* Diese Adressen kennt die Linkprüfung als tot (alle mit Endung 0 bzw. tot0). */
const tot = (u: string): boolean => u === NF(0) || u === GTI(0) || u.endsWith('tot0')

const angebot = (anbieter: string, art: string, url: string) => ({ anbieter, art, audio: ['de'], untertitel: [], url })
const befund = (id: number, angebote: unknown[]) => ({ geprueftAm: '2999-12-31', jwId: `tm${id}`, altersangabe: '16', angebote })
writeFileSync(
  join(daten, 'justwatch-audio.json'),
  JSON.stringify({
    [IDS.ohneWeg]: befund(IDS.ohneWeg, [angebot('Netflix', 'FLATRATE', NF(0))]),
    [IDS.abo]: befund(IDS.abo, [angebot('Netflix', 'FLATRATE', NF(0))]),
    [IDS.kauf]: befund(IDS.kauf, [angebot('Amazon Video', 'BUY', GTI(0))]),
    [IDS.tmdb]: befund(IDS.tmdb, [angebot('Videoload', 'BUY', 'https://www.videoload.de/film/tot0')]),
    [IDS.extra]: befund(IDS.extra, [angebot('Apple TV', 'BUY', 'https://tv.apple.com/de/movie/tot0')]),
  }),
)

/* Kulisse für Phase 13-3 (MOTN-Adressen): imdb tt51 führt auf die tote, tt52 auf die lebende Netflix-Adresse. */
mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
writeFileSync(join(daten, 'motn-links.json'), JSON.stringify({ links: { tt51: { netflix: NF(0) }, tt52: { netflix: NF(1) } } }))
writeFileSync(join(daten, 'motn.json'), JSON.stringify({ tmdb: { 'tv/51': { imdbId: 'tt51' }, 'tv/52': { imdbId: 'tt52' } } }))
writeFileSync(
  join(daten, 'tmdb-titles.json'),
  JSON.stringify({
    [IDS.motnTot]: { tmdbId: 51, kind: 'tv', providers: ['netflix'] },
    [IDS.motnLebt]: { tmdbId: 52, kind: 'tv', providers: ['netflix'] },
  }),
)

const blu = { name: 'aniSearch', url: 'https://www.anisearch.de/article/1,x', kind: 'buy', zugang: 'kauf' }
const titel = (id: number, watchLinks: unknown[] = []) => ({ id, streams: [], watchLinks, keywords: [], genres: [] }) as unknown as Title
const adressen = (t: Title): string[] => [...(t.streams ?? []).map((s) => s.url), ...(t.watchLinks ?? []).map((w) => w.url)]

/** Handbeleg „deutsch“ zu einer Netflix-Adresse; macht aus einem Termin dort einen Weg mit Urteil. */
const handbeleg = (id: number, url: string) =>
  ({ anilistId: id, platform: 'netflix', url, dub: true, dubRanges: [{ from: 1, to: 48, dub: true }], checkedAt: '2026-09-24' }) as unknown as DubCheck
const termin = (id: number, url: string) =>
  ({ slug: `tot-${id}`, titleId: id, platform: 'netflix', releaseType: 'batch', platformUrl: url, schedule: { firstEpisodeDate: '2026-10-02' }, sources: ['https://quelle.example/'] }) as unknown as Release

type Lauf = (t: Title, opt?: { anisearch?: Record<string, never>; releases?: Release[]; checks?: DubCheck[]; hand?: string[]; pruefung?: (u: string) => boolean }) => Title

function linkpruefungFaelle(lauf: Lauf, jwRunden: (t: Title, pruefung: (u: string) => boolean) => Title): void {
console.log('\nJede Runde legt keine Adresse an, die nur die Linkprüfung als tot kennt:')
{
  const a = lauf(titel(IDS.ohneWeg))
  pruefe('11-2-2 (Titel ohne Weg): keine tote Adresse', !adressen(a).includes(NF(0)), a)
  const k = lauf(titel(IDS.ohneWeg), { pruefung: () => false })
  pruefe('Kontrolle 11-2-2: ohne Prüfbefund legt die Runde den Weg an', adressen(k).includes(NF(0)), k)
}
{
  const a = jwRunden(titel(IDS.abo, [blu]), tot)
  pruefe('11-2-3 (Abo-Weg): keine tote Adresse', !adressen(a).includes(NF(0)), a)
  const k = jwRunden(titel(IDS.abo, [blu]), () => false)
  pruefe('Kontrolle 11-2-3: ohne Prüfbefund legt die Runde den Abo-Weg an', adressen(k).includes(NF(0)), k)
}
{
  const a = jwRunden(titel(IDS.kauf, [blu]), tot)
  pruefe('11-2-4 (Prime-Kauf): keine tote Adresse', !adressen(a).includes(GTI(0)), a)
  const k = jwRunden(titel(IDS.kauf, [blu]), () => false)
  pruefe('Kontrolle 11-2-4: ohne Prüfbefund legt die Runde den Kauf-Weg an', adressen(k).includes(GTI(0)), k)
}
{
  const w = { name: 'Videoload', url: TMDB, kind: 'stream' }
  const a = lauf(titel(IDS.tmdb, [w]))
  pruefe('11-2 (TMDB-Adresse ersetzen): tote JustWatch-Adresse ersetzt sie nicht', !adressen(a).includes('https://www.videoload.de/film/tot0'), a)
  const k = lauf(titel(IDS.tmdb, [{ ...w }]), { pruefung: () => false })
  pruefe('Kontrolle 11-2 (ersetzen): ohne Prüfbefund ersetzt JustWatch die TMDB-Adresse', adressen(k).includes('https://www.videoload.de/film/tot0'), k)
}
{
  const a = lauf(titel(IDS.extra, [blu]))
  pruefe('11-2 (übrige Angebote): keine tote Adresse', !adressen(a).includes('https://tv.apple.com/de/movie/tot0'), a)
  const k = lauf(titel(IDS.extra, [blu]), { pruefung: () => false })
  pruefe('Kontrolle 11-2 (übrige): ohne Prüfbefund kommt das Angebot dazu', adressen(k).includes('https://tv.apple.com/de/movie/tot0'), k)
}
{
  const quelle = { [IDS.anisearch]: { streams: [{ provider: 'netflix-de', url: NF(0) }] } } as unknown as Record<string, never>
  const a = lauf(titel(IDS.anisearch), { anisearch: quelle })
  pruefe('11-3 (aniSearch-Wege): keine tote Adresse', !adressen(a).includes(NF(0)), a)
  const k = lauf(titel(IDS.anisearch), { anisearch: quelle, pruefung: () => false })
  pruefe('Kontrolle 11-3: ohne Prüfbefund legt die Runde den Weg an', adressen(k).includes(NF(0)), k)
}
{
  const checks = [handbeleg(IDS.termin, NF(0))]
  const a = lauf(titel(IDS.termin), { releases: [termin(IDS.termin, NF(0))], checks })
  pruefe('11-7 (Termin, Handbeleg „deutsch“): keine tote Adresse', !adressen(a).includes(NF(0)), a)
  const k = lauf(titel(IDS.termin), { releases: [termin(IDS.termin, NF(0))], checks, pruefung: () => false })
  pruefe('Kontrolle 11-7: ohne Prüfbefund legt der Termin den Weg samt Urteil an', (k.streams ?? []).some((s) => s.url === NF(0) && s.dub === true), k)
}

}

function handbelegFaelle(lauf: Lauf): void {
console.log('\nDie andere Quelle (Handbeleg „nicht verfügbar“) hält weiter:')
{
  const a = lauf(titel(IDS.ohneWeg), { hand: [NF(0)], pruefung: () => false })
  pruefe('11-2-2: Adresse aus toteAdressen entfällt', !adressen(a).includes(NF(0)), a)
  const b = lauf(titel(IDS.kauf, [blu]), { hand: [GTI(0)], pruefung: () => false })
  pruefe('11-2-4: Adresse aus toteAdressen entfällt', !adressen(b).includes(GTI(0)), b)
  const c = lauf(titel(IDS.termin), { releases: [termin(IDS.termin, NF(0))], hand: [NF(0)], pruefung: () => false })
  pruefe('11-7: Adresse aus toteAdressen entfällt', !adressen(c).includes(NF(0)), c)
}
}

/** Phase 13-3 (`schreibeListen`): Weg aus TMDB-Anbieter und MOTN-Adresse; die tote Adresse kennt nur die Linkprüfung. */
async function motnFaelle(): Promise<void> {
  const { schreibeListen } = await import('./bau/13-3-listen.ts')
  const { baueIstTot } = await import('./lib/adresse-tot.ts')
  const streams = (pruefung: (u: string) => boolean): Map<number, string[]> => {
    const slim = [IDS.motnTot, IDS.motnLebt].map((id) => ({ id, streams: [], watchLinks: [] }))
    schreibeListen({ slim: slim as never, tmdbTitles: {}, releases: [], titles: new Map(), istTot: baueIstTot(new Set(), pruefung) })
    return new Map(slim.map((s) => [s.id, (s.streams as { url: string }[]).map((x) => x.url)]))
  }
  console.log('\n13-3 (MOTN-Adresse ohne jeden Weg):')
  const mit = streams(tot)
  pruefe('13-3: tote MOTN-Adresse legt keinen Weg an', mit.get(IDS.motnTot)?.length === 0, [...mit])
  pruefe('13-3: lebende MOTN-Adresse legt den Weg an', mit.get(IDS.motnLebt)?.length === 1, [...mit])
  const ohne = streams(() => false)
  pruefe('Kontrolle 13-3: ohne Prüfbefund legt auch die tote Adresse den Weg an', ohne.get(IDS.motnTot)?.length === 1, [...ohne])
}

async function main(): Promise<void> {
  const { schliesseWegeAb } = await import('./bau/11-wege-abschluss.ts')
  const { ergaenzeWegeAusJustwatch } = await import('./bau/11-2-justwatch.ts')
  const { baueIstTot } = await import('./lib/adresse-tot.ts')
  const { suchadressenInTemp } = await import('./lib/suchadressen-temp.ts')
  suchadressenInTemp()

  /** Lässt den Abschluss mit einem Titel laufen; `lautPruefung` ist die Linkprüfung, `toteAdressen` die Handbeleg-Menge. */
  function lauf(t: Title, opt: Parameters<Lauf>[1] = {}): Title {
    schliesseWegeAb({
      titles: new Map([[t.id, t]]),
      anisearch: (opt.anisearch ?? {}) as never,
      releases: opt.releases ?? [],
      zugangJeAdresse: new Map(),
      tmdbMehrdeutig: new Set(),
      toteAdressen: new Set(opt.hand ?? []),
      linkBefunde: {},
      verweiseEntfernt: [],
      crAdresseZu: () => undefined,
      beantworteteSuchen: new Set(),
      suchOffen: [],
      alleChecks: opt.checks ?? [],
      lautPruefungTot: opt.pruefung ?? tot,
      checksJePlattform: new Map(),
      belegFuer: (id, plattform, u) => (opt.checks ?? []).find((c) => c.anilistId === id && c.platform === plattform && c.url === u),
    })
    return t
  }

  /** Die JustWatch-Runden 11-2-3 und 11-2-4 allein: der Abschluss nimmt Wege ohne Tonurteil später wieder heraus. */
  function jwRunden(t: Title, pruefung: (u: string) => boolean): Title {
    ergaenzeWegeAusJustwatch({ titles: new Map([[t.id, t]]), tmdbMehrdeutig: new Set(), istTot: baueIstTot(new Set(), pruefung) })
    return t
  }

  linkpruefungFaelle(lauf, jwRunden)
  handbelegFaelle(lauf)
  await motnFaelle()
}

try {
  await main()
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
