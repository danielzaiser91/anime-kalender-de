/**
 * Zusicherungen zu `lib/prime-gleiche-gti.ts` (09.11.2026, Anlass Goblin Slayer 2: B0D98PQ1FW und B0CFL5Y7XN tragen dieselbe gti,
 * der Termin verlor mit zwei Wegen seine Adresse): die Regel, ihr Aufruf im Wege-Abschluss und der Bestandswächter als Prozess.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-prime-gleiche-gti.ts`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { schliesseWegeAb } from './bau/11-wege-abschluss.ts'
import { adresseDesWegs } from './bau/13-1-termin-adressen.ts'
import { suchadressenInTemp } from './lib/suchadressen-temp.ts'
import { findeGleicheGti, fuehrePrimeWegeGleicherGtiZusammen, type GtiBelegt } from './lib/prime-gleiche-gti.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const GTI_A = 'amzn1.dv.gti.61834376-ed4f-4023-aeb8-77d64030b60e'
const GTI_B = 'amzn1.dv.gti.99a568db-85e8-4fef-9505-e019a9b483fe'
const belegt: GtiBelegt = {
  'amazon:b0d98pq1fw': GTI_A,
  'amazon:b0cfl5y7xn': GTI_A,
  'amazon:b0cfkzq6fn': GTI_B,
}
const seite = (asin: string) => `https://www.amazon.de/gp/video/detail/${asin}`
const prime = (url: string, rest: Partial<StreamLink> = {}): StreamLink => ({ platform: 'primevideo', url, ...rest }) as StreamLink
const urls = (s: StreamLink[]) => s.map((x) => x.url.slice(-10))

console.log('\nPrime-Wege gleicher gti:')
{
  // Goblin Slayer 2: zwei Adressen derselben Ausgabe, der Kanal-Weg ohne Urteil steht zuerst.
  const gs2 = [prime(seite('B0CFL5Y7XN'), { kanal: 'aniverse', zugang: 'abo' }), prime(seite('B0D98PQ1FW'), { kanal: 'aniverse', zugang: 'abo', dub: true })]
  const n = fuehrePrimeWegeGleicherGtiZusammen(gs2, belegt)
  pruefe('zwei Wege gleicher gti: einer bleibt, 1 entfernt', n === 1 && gs2.length === 1, { n, u: urls(gs2) })
  pruefe('der Weg mit Urteil bleibt, auch wenn er hinten stand', gs2[0]!.url.endsWith('B0D98PQ1FW') && gs2[0]!.dub === true, gs2)

  const ohneUrteil = [prime(seite('B0CFL5Y7XN')), prime(seite('B0D98PQ1FW'))]
  fuehrePrimeWegeGleicherGtiZusammen(ohneUrteil, belegt)
  pruefe('ohne Urteil bleibt der erste', ohneUrteil.length === 1 && ohneUrteil[0]!.url.endsWith('B0CFL5Y7XN'), urls(ohneUrteil))

  const luecken = [prime(seite('B0CFL5Y7XN'), { dub: true, dubRanges: [{ from: 1, to: 12, dub: true }] }), prime(seite('B0D98PQ1FW'), { kanal: 'aniverse', zugang: 'abo' })]
  fuehrePrimeWegeGleicherGtiZusammen(luecken, belegt)
  pruefe('fehlende Angaben (Kanal, Zugang) kommen vom entfernten Weg, das Urteil bleibt', luecken.length === 1 && luecken[0]!.kanal === 'aniverse' && luecken[0]!.zugang === 'abo' && luecken[0]!.dub === true && luecken[0]!.dubRanges?.length === 1, luecken)

  const geerbt = [prime(seite('B0CFL5Y7XN'), { kanal: 'x' }), prime(seite('B0D98PQ1FW'), { dub: true, dubRanges: [{ from: 1, to: 3, dub: true }], kanal: 'y' })]
  fuehrePrimeWegeGleicherGtiZusammen(geerbt, belegt)
  pruefe('eigene Angaben des bleibenden Wegs werden nicht überschrieben', geerbt[0]!.kanal === 'y' && geerbt[0]!.dubRanges?.length === 1, geerbt)

  const verschieden = [prime(seite('B0CFKZQ6FN')), prime(seite('B0D98PQ1FW'))]
  pruefe('verschiedene gti: beide bleiben', fuehrePrimeWegeGleicherGtiZusammen(verschieden, belegt) === 0 && verschieden.length === 2)

  const ohneGti = [prime(seite('B0AAAAAAAA')), prime(seite('B0BBBBBBBB'))]
  pruefe('ohne belegte gti: beide bleiben', fuehrePrimeWegeGleicherGtiZusammen(ohneGti, belegt) === 0 && ohneGti.length === 2)

  const widerspruch = [prime(seite('B0CFL5Y7XN'), { dub: false }), prime(seite('B0D98PQ1FW'), { dub: true })]
  pruefe('Ja gegen Nein: nichts wird zusammengeführt', fuehrePrimeWegeGleicherGtiZusammen(widerspruch, belegt) === 0 && widerspruch.length === 2)
  pruefe('Ja gegen Nein: der Wächter findet den Titel', findeGleicheGti([{ id: 7, streams: widerspruch }], belegt).join() === `7@${GTI_A}`)
  pruefe('zwei Nein: ein Weg bleibt mit Nein', (() => { const s = [prime(seite('B0CFL5Y7XN'), { dub: false }), prime(seite('B0D98PQ1FW'), { dub: false })]; fuehrePrimeWegeGleicherGtiZusammen(s, belegt); return s.length === 1 && s[0]!.dub === false })())

  const vermerk = [prime(seite('B0CFL5Y7XN'), { entferntAm: '2026-11-01' }), prime(seite('B0D98PQ1FW'))]
  pruefe('ein Vermerk „nicht mehr im Katalog“ ist kein Weg und bleibt', fuehrePrimeWegeGleicherGtiZusammen(vermerk, belegt) === 0 && vermerk.length === 2)

  const andere = [{ platform: 'netflix', url: seite('B0CFL5Y7XN') }, { platform: 'netflix', url: seite('B0D98PQ1FW') }] as StreamLink[]
  pruefe('nur Prime: andere Anbieter bleiben', fuehrePrimeWegeGleicherGtiZusammen(andere, belegt) === 0 && andere.length === 2)

  const dreifach = [prime(seite('B0CFL5Y7XN')), prime(seite('B0CFKZQ6FN')), prime(seite('B0D98PQ1FW')), prime(`https://watch.amazon.de/detail?gti=${GTI_A}`)]
  const dn = fuehrePrimeWegeGleicherGtiZusammen(dreifach, belegt)
  pruefe('drei Wege einer gti und ein fremder: 2 bleiben (je gti einer)', dn === 2 && dreifach.length === 2 && dreifach.some((s) => s.url.endsWith('B0CFKZQ6FN')), urls(dreifach))

  const ueberSeite = [prime(`https://watch.amazon.de/detail?gti=${GTI_A}`, { seite: seite('B0D98PQ1FW') }), prime(seite('B0CFL5Y7XN'))]
  pruefe('gti in der Adresse und ASIN-Seite einer anderen: ein Weg', fuehrePrimeWegeGleicherGtiZusammen(ueberSeite, belegt) === 1 && ueberSeite.length === 1)
}

console.log('\nWege-Abschluss ruft die Zusammenführung (Termin behält die Adresse):')
{
  suchadressenInTemp()
  const ID = 9000030
  const gtiUrl = (zusatz: string) => `https://watch.amazon.de/detail?gti=${GTI_A}${zusatz}`
  const titel = {
    id: ID,
    jpYear: 2023,
    streams: [prime(gtiUrl(''), { kanal: 'aniverse', zugang: 'abo', herkunft: 'termin' }), prime(gtiUrl('&ref_=x'), { kanal: 'aniverse', zugang: 'abo', herkunft: 'termin' })],
    keywords: [],
    genres: [],
    watchLinks: [],
  } as unknown as Title
  const termin = { titleId: ID, platform: 'primevideo', kanal: 'aniverse' } as unknown as Release
  const vorher = adresseDesWegs(termin, titel)
  pruefe('Vorbedingung: mit zwei Wegen vergibt der Termin keine Adresse', vorher === undefined, vorher)
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
    alleChecks: [],
    lautPruefungTot: () => false,
    checksJePlattform: new Map(),
    belegFuer: () => undefined,
  })
  const nachher = adresseDesWegs(termin, titel)
  pruefe('nach dem Abschluss: ein Prime-Weg, der Termin bekommt seine Adresse', titel.streams.length === 1 && nachher === titel.streams[0]!.url, { n: titel.streams.length, nachher })
}

console.log('\nBestandswächter als Prozess:')
{
  const tsx = resolve('node_modules/tsx/dist/cli.mjs')
  const skript = resolve('pipeline/check-prime-gleiche-gti-bestand.ts')
  const lauf = (titel: unknown[]): { status: number | null; aus: string } => {
    const wurzel = mkdtempSync(join(tmpdir(), 'prime-gti-'))
    try {
      mkdirSync(join(wurzel, 'public/data'), { recursive: true })
      mkdirSync(join(wurzel, 'data'), { recursive: true })
      writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify(titel))
      writeFileSync(join(wurzel, 'data/amazon-gti-belegt.json'), JSON.stringify(belegt))
      const r = spawnSync(process.execPath, [tsx, skript], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
      return { status: r.status, aus: `${r.stdout}${r.stderr}` }
    } finally {
      rmSync(wurzel, { recursive: true, force: true })
    }
  }
  const rot = lauf([{ id: 900040, streams: [prime(seite('B0CFL5Y7XN')), prime(seite('B0D98PQ1FW'))] }, { id: 900041, streams: [prime(seite('B0CFKZQ6FN'))] }])
  pruefe('zwei Wege einer gti: Exit 1, Fehlerzeile, Marke nur für den Treffer', rot.status === 1 && rot.aus.includes('✖ Treffer') && rot.aus.includes('"titleId":900040,"pruefung":"prime-gleiche-gti"') && !rot.aus.includes('"titleId":900041'), rot)
  pruefe('Zählzeile nennt 1 Treffer', /1 Treffer \(Ziel 0\)/.test(rot.aus), rot)
  const gruen = lauf([{ id: 900040, streams: [prime(seite('B0CFL5Y7XN')), prime(seite('B0CFKZQ6FN'))] }])
  pruefe('verschiedene gti: Exit 0, keine Marke', gruen.status === 0 && !gruen.aus.includes('"titleId"') && /0 Treffer/.test(gruen.aus), gruen)
  const leer = lauf([])
  pruefe('leerer Bestand: Exit 0', leer.status === 0 && /0 Treffer/.test(leer.aus), leer)
}

console.log(verletzt ? `\n${verletzt} von ${faelle} Zusicherung(en) verletzt.` : `\ncheck-prime-gleiche-gti: ${faelle} Zusicherungen halten.`)
process.exit(verletzt ? 1 : 0)
