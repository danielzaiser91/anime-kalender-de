/**
 * Zusicherungen zur Link-Vorschau mit eigener aniSearch-Kopie (10.11.2026): Die Kopie auf `cover.anime-kalender.de` führt die Titelseite nur
 * mit gemessenen Maßen und Größe bis 250 KB; sonst bleibt das Standardbild. Köpfe aus drei echten Dateien (4158, 4442, 4821; Maße von Hand
 * aus den Kopfbytes gelesen: 300×233, 300×447, 300×381). Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

const tmp = mkdtempSync(join(tmpdir(), 'eigene-cover-'))
process.env.AK_ROOT = tmp
const { eigeneDatei, eigeneMasse, messeEigene, ungemesseneEigene, webpMasse } = await import('./lib/eigene-cover-masse.ts')
const { messeNeueEigeneCover, messeAnilistCoverImLauf, EIGENE_MASSE_DATEI } = await import('./lib/anilist-cover-lauf.ts')
const { vorschauBild, vorschauMaengel } = await import('./lib/titel-vorschau.ts')
const { ladeVorschauMasse } = await import('./lib/vorschau-masse.ts')

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const SITE = 'https://anime-kalender.de/'
const STANDARD = `${SITE}og/default.jpg?v=abc12345`
const BASIS = 'https://cover.anime-kalender.de/anisearch/'
const KOPF: Record<string, string> = {
  '4158': '52494646d62200005745425056503820ca220000708b009d012a2c01e9003e9d',
  '4442': '52494646864a000057454250565038207a4a00005059019d012a2c01bf013e95',
  '4821': '52494646ae4900005745425056503820a2490000f02f019d012a2c017d013e95',
}
const kopf = (id: string): Buffer => Buffer.from(KOPF[id]!, 'hex')
const titel = (extra: Partial<Title>): Title => ({ id: 1, slug: 'x', titleDe: 'X', format: 'TV', episodes: 12, ...extra }) as Title

pruefe('webpMasse VP8 4158', webpMasse(kopf('4158'))?.join() === '300,233')
pruefe('webpMasse VP8 4442', webpMasse(kopf('4442'))?.join() === '300,447')
pruefe('webpMasse VP8 4821', webpMasse(kopf('4821'))?.join() === '300,381')
pruefe('webpMasse: kein WebP, zu kurz, JPEG', webpMasse(Buffer.from('<html>'.repeat(10))) === undefined && webpMasse(kopf('4158').subarray(0, 20)) === undefined && webpMasse(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(0)])) === undefined)
const vp8l = Buffer.alloc(30)
vp8l.write('RIFF', 0, 'latin1')
vp8l.write('WEBPVP8L', 8, 'latin1')
vp8l[20] = 0x2f
vp8l.writeUInt32LE(299 | (445 << 14), 21)
pruefe('webpMasse VP8L (verlustfrei) 300×446', webpMasse(vp8l)?.join() === '300,446')
const vp8x = Buffer.alloc(30)
vp8x.write('RIFF', 0, 'latin1')
vp8x.write('WEBPVP8X', 8, 'latin1')
vp8x.writeUIntLE(299, 24, 3)
vp8x.writeUIntLE(449, 27, 3)
pruefe('webpMasse VP8X 300×450', webpMasse(vp8x)?.join() === '300,450')

pruefe('eigeneDatei: nur Bucket der eigenen Domain', eigeneDatei(`${BASIS}4158.webp`) === 'anisearch/4158.webp' && eigeneDatei('https://cdn.anisearch.de/images/anime/cover/4/4158_300.webp') === undefined && eigeneDatei('https://fremd.example/anisearch/4158.webp') === undefined && eigeneDatei(`${BASIS}4158.jpg`) === undefined && eigeneDatei(undefined) === undefined)

/* Maße: zu groß und zu schmal fallen heraus, der Schlüssel trägt das Präfix. */
const BESTAND = { 'anisearch/4158.webp': [300, 233, 8926], 'anisearch/2.webp': [300, 400, 250_001], 'anisearch/3.webp': [199, 300, 1000], 'anisearch/4.webp': [300, 400, 250_000], 'anisearch/5.webp': [300, 0, 1000] } as const
const MASSE = eigeneMasse(BESTAND)
pruefe('eigeneMasse: genau 4158 und 4 (Grenze 250 KB genau drin, Rest draußen)', [...MASSE.keys()].sort().join() === 'eigen:anisearch/4.webp,eigen:anisearch/4158.webp', [...MASSE.keys()].join())

/* Entscheidung: mit Maßen eigene Kopie (hochformatig, kleine Karte), ohne Maße oder fremde Adresse Standard. */
const v = vorschauBild(undefined, `${BASIS}4158.webp`, STANDARD, MASSE)
pruefe('vorschauBild: Kopie mit Maßen', v.url === `${BASIS}4158.webp` && v.breite === 300 && v.hoehe === 233 && v.karte === 'summary' && v.typ === 'image/webp', JSON.stringify(v))
pruefe('vorschauBild: Kopie ohne Maße → Standard', vorschauBild(undefined, `${BASIS}2.webp`, STANDARD, MASSE).url === STANDARD)
pruefe('vorschauBild: aniSearch selbst (Hotlink) → Standard', vorschauBild(undefined, 'https://cdn.anisearch.de/images/anime/cover/4/4158_300.webp', STANDARD, MASSE).url === STANDARD)
pruefe('vorschauBild: TMDB-Banner geht vor der Kopie', vorschauBild('https://image.tmdb.org/t/p/w1280/b.jpg', `${BASIS}4158.webp`, STANDARD, MASSE).breite === 780)

/* Prüfung der gebauten Seite. */
const seite = (bild: string, breite: number): string => `<meta property="og:image" content="${bild}" /><meta property="og:image:width" content="${breite}" /><meta property="og:image:height" content="233" />`
pruefe('vorschauMaengel: Kopie mit 300 breit ist in Ordnung', vorschauMaengel(seite(`${BASIS}4158.webp`, 300), SITE).length === 0)
pruefe('vorschauMaengel: Kopie mit 150 breit wird gemeldet', vorschauMaengel(seite(`${BASIS}4158.webp`, 150), SITE).some((m) => m.includes('unter 200')))
pruefe('vorschauMaengel: fremde Domain bleibt ein Mangel', vorschauMaengel(seite('https://cdn.anisearch.de/x/1_300.webp', 300), SITE).length === 1)

/* Messung mit Attrappe: nur 200 mit lesbarem Kopf zählt, Fehler und Müll bleiben offen, Limit gilt. */
const antworten: Record<string, { status: number; bytes: Buffer } | 'fehler'> = {
  [`${BASIS}4158.webp`]: { status: 200, bytes: kopf('4158') },
  [`${BASIS}4442.webp`]: { status: 404, bytes: kopf('4442') },
  [`${BASIS}4821.webp`]: 'fehler',
  [`${BASIS}9.webp`]: { status: 200, bytes: Buffer.from('<html>'.repeat(10)) },
}
const neu: Record<string, [number, number, number]> = {}
const gerufen: string[] = []
const gemessen = await messeEigene(
  ['anisearch/4158.webp', 'anisearch/4442.webp', 'anisearch/4821.webp', 'anisearch/9.webp'],
  neu,
  10,
  async (url) => {
    gerufen.push(url)
    const a = antworten[url]
    if (a === 'fehler' || !a) throw new Error('Netz')
    return a
  },
  async () => undefined,
)
pruefe('messeEigene: nur 4158 gemessen (Breite, Höhe, Bytes der Datei)', gemessen === 1 && Object.keys(neu).join() === 'anisearch/4158.webp' &&neu['anisearch/4158.webp']?.join() === '300,233,32', JSON.stringify(neu))
pruefe('messeEigene: Abruf von der eigenen Domain, nie von aniSearch', gerufen.length === 4 && gerufen.every((u) => u.startsWith('https://cover.anime-kalender.de/')))
pruefe('messeEigene: Limit 2 ruft genau 2 ab', (await messeEigene(['anisearch/4158.webp', 'anisearch/4442.webp', 'anisearch/4821.webp'], {}, 2, async () => ({ status: 200, bytes: kopf('4158') }), async () => undefined)) === 2)
pruefe('ungemesseneEigene: bekannte, AniList- und Fremdadressen zählen nicht, je Datei einmal', ungemesseneEigene([titel({ coverImage: `${BASIS}4158.webp` }), titel({ coverImage: `${BASIS}7.webp` }), titel({ coverImage: `${BASIS}7.webp` }), titel({ coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/1.jpg' }), titel({})], { 'anisearch/4158.webp': [300, 233, 1] }).join() === 'anisearch/7.webp')

/* Verdrahtung des Laufs: derselbe Schritt, der die AniList-Cover misst, misst auch die eigenen Kopien (Hauptbestand und Katalog). */
const echtesFetch = globalThis.fetch
const geholt: string[] = []
globalThis.fetch = (async (url: string) => {
  geholt.push(url)
  return new Response(new Uint8Array(kopf('4442')), { status: 200 })
}) as typeof fetch
mkdirSync(join(tmp, 'public/data'), { recursive: true })
mkdirSync(join(tmp, 'data'), { recursive: true })
writeFileSync(join(tmp, 'public/data/titles.json'), JSON.stringify([titel({ id: 900001, coverImage: `${BASIS}4158.webp` }), titel({ id: 900002, coverImage: `${BASIS}8.webp` })]))
writeFileSync(join(tmp, 'public/data/ohne-synchro.json'), JSON.stringify([titel({ id: 900003, coverImage: `${BASIS}6.webp` })]))
writeFileSync(join(tmp, EIGENE_MASSE_DATEI), JSON.stringify({ 'anisearch/4158.webp': [300, 233, 8926], 'anisearch/fremd.webp': [1, 2, 3] }))
const start = performance.now()
await messeAnilistCoverImLauf()
/* Untergrenze: zwei Abrufe mit je 150 ms Pause (nur nach unten geprüft, eine langsame Maschine stört nicht). */
pruefe('Lauf: Pause von 150 ms nach jedem Abruf', performance.now() - start >= 290, `${performance.now() - start} ms`)
const danach = JSON.parse(readFileSync(join(tmp, EIGENE_MASSE_DATEI), 'utf8')) as Record<string, number[]>
pruefe('Lauf: zwei neue Kopien abgerufen (Hauptbestand und Katalog), die bekannte nicht', geholt.length === 2 && geholt.every((u) => u.includes('/anisearch/8.webp') || u.includes('/anisearch/6.webp')), geholt.join())
pruefe('Lauf: Datei hat alte und neue Einträge, Fremdeintrag unverändert', Object.keys(danach).sort().join() === 'anisearch/4158.webp,anisearch/6.webp,anisearch/8.webp,anisearch/fremd.webp' && danach['anisearch/fremd.webp']?.join() === '1,2,3' && danach['anisearch/8.webp']?.join() === '300,447,32', JSON.stringify(danach))
const geladen = ladeVorschauMasse()
pruefe('ladeVorschauMasse: die gemessenen Kopien stehen in der Tabelle', geladen.get('eigen:anisearch/8.webp')?.join() === '300,447' && geladen.has('eigen:anisearch/4158.webp'))
geholt.length = 0
await messeAnilistCoverImLauf()
pruefe('Lauf: zweiter Lauf ruft nichts mehr ab', geholt.length === 0)
pruefe('messeNeueEigeneCover: Limit 1 misst genau 1', (await messeNeueEigeneCover([titel({ coverImage: `${BASIS}21.webp` }), titel({ coverImage: `${BASIS}22.webp` })], {}, 1)) === 1)
globalThis.fetch = echtesFetch
rmSync(tmp, { recursive: true, force: true })

if (fehler) {
  console.error(`[eigene-cover-vorschau] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[eigene-cover-vorschau] ${faelle} Fälle grün (WebP-Köpfe, Maßtabelle, Entscheidung, Seitenprüfung, Messung, Lauf-Verdrahtung)`)
