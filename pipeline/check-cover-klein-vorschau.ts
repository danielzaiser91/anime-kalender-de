/**
 * Zusicherungen zur Link-Vorschau mit kleiner Fassung (11.11.2026): ein AniList-`large`-Cover über 250 KB führt die Seite mit seiner
 * `medium`-Fassung (alle 100 solchen Fassungen gemessen, höchstens 250 KB), und das w342-Cover eines Cartoons führt sie mit gemessenen
 * Maßen (`data/cartoon-cover-masse.json`). Werte aus echten Messungen: large/bx44 PNG 460×667 (412.397 B), medium/bx44 230×334 (122.873 B),
 * Cartoon-Cover /xslZBngK5IFpVNjT9Yr11klSgkk.jpg in w342 342×513 (53.648 B). Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

const tmp = mkdtempSync(join(tmpdir(), 'cover-klein-'))
process.env.AK_ROOT = tmp
const { anilistMasse, mediumFassung, ungemessene } = await import('./lib/anilist-cover-masse.ts')
const { cartoonMasse, cartoonPfad, messeCartoon, ungemesseneCartoon } = await import('./lib/cartoon-cover-masse.ts')
const { messeAnilistCoverImLauf, COVER_MASSE_DATEI, CARTOON_MASSE_DATEI } = await import('./lib/anilist-cover-lauf.ts')
const { bildMeta, vorschauBild, vorschauMaengel } = await import('./lib/titel-vorschau.ts')
const { titelKopf } = await import('./lib/titel-seite.ts')
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
const BASIS = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/'
const GROSS = `${BASIS}large/bx44-MG5I672UbWAy.png`
const KLEIN = `${BASIS}medium/bx44-MG5I672UbWAy.png`
const GUT = `${BASIS}large/bx298-4NawsRDRVaHR.jpg`
const BANNER = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/135432-kmwEDXyeMdhE.jpg'
const BESTAND = {
  'large/bx44-MG5I672UbWAy.png': [460, 667, 412397],
  'medium/bx44-MG5I672UbWAy.png': [230, 334, 122873],
  'large/bx298-4NawsRDRVaHR.jpg': [460, 649, 136264],
  'medium/bx298-4NawsRDRVaHR.jpg': [225, 317, 40000],
} as const
const MASSE = anilistMasse(BESTAND)
const UMFELD = { krumenJsonLd: '', krumenHtml: '', aehnlichHtml: '' } as never
const titel = (extra: Partial<Title>): Title => ({ id: 1, slug: 'x', titleDe: 'X', format: 'TV', episodes: 12, ...extra }) as Title

/* Kleine Fassung: nur aus einer large-Adresse des Bilderdienstes. */
pruefe('mediumFassung: large wird medium', mediumFassung(GROSS) === KLEIN)
pruefe('mediumFassung: medium bleibt ohne', mediumFassung(KLEIN) === undefined)
pruefe('mediumFassung: Banner und Fremdes ohne', mediumFassung(BANNER) === undefined && mediumFassung(GROSS.replace('s4.anilist.co', 'example.org')) === undefined)
pruefe('mediumFassung: ohne Adresse', mediumFassung(undefined) === undefined)

/* Ungemessene: die kleine Fassung kommt nur dazu, wenn large gemessen und unbrauchbar ist und sie selbst fehlt. */
const grosses = { 'large/bx44-MG5I672UbWAy.png': [460, 667, 412397] } as const
pruefe('ungemessene: zu großes large bringt seine medium-Fassung', ungemessene([GROSS], grosses).join() === KLEIN)
pruefe('ungemessene: genau 250.001 Byte zählt als zu groß', ungemessene([GROSS], { 'large/bx44-MG5I672UbWAy.png': [460, 667, 250_001] }).join() === KLEIN)
pruefe('ungemessene: genau 250.000 Byte reicht, keine medium-Fassung', ungemessene([GROSS], { 'large/bx44-MG5I672UbWAy.png': [460, 667, 250_000] }).length === 0)
pruefe('ungemessene: zu schmal (199) bringt die medium-Fassung', ungemessene([GROSS], { 'large/bx44-MG5I672UbWAy.png': [199, 300, 1000] }).join() === KLEIN)
pruefe('ungemessene: Breite 200 reicht, keine medium-Fassung', ungemessene([GROSS], { 'large/bx44-MG5I672UbWAy.png': [200, 300, 1000] }).length === 0)
pruefe('ungemessene: ungemessenes large nur selbst, ohne medium', ungemessene([GROSS], {}).join() === GROSS)
pruefe('ungemessene: schon gemessene medium-Fassung nicht noch einmal', ungemessene([GROSS], BESTAND).length === 0)
pruefe('ungemessene: brauchbares large ohne medium-Fassung', ungemessene([GUT], { 'large/bx298-4NawsRDRVaHR.jpg': [460, 649, 136264] }).length === 0)
pruefe('ungemessene: zweimal dasselbe Cover, medium einmal', ungemessene([GROSS, GROSS], grosses).length === 1)
pruefe('ungemessene: eine medium-Adresse allein bringt keine weitere', ungemessene([KLEIN], { 'medium/bx44-MG5I672UbWAy.png': [230, 334, 400_000] }).length === 0)

/* Vorschau: large geht vor medium, medium nur bei unbrauchbarem large, sonst Standard. */
const v = vorschauBild(undefined, GROSS, STANDARD, MASSE)
pruefe('zu großes large: medium 230×334 als png, kleine Karte', v.url === KLEIN && v.breite === 230 && v.hoehe === 334 && v.typ === 'image/png' && v.karte === 'summary')
const vg = vorschauBild(undefined, GUT, STANDARD, MASSE)
pruefe('brauchbares large geht der medium-Fassung vor', vg.url === GUT && vg.breite === 460 && vg.hoehe === 649)
pruefe('large zu groß, medium ungemessen: Standard', vorschauBild(undefined, GROSS, STANDARD, anilistMasse({ 'large/bx44-MG5I672UbWAy.png': [460, 667, 412397] })).url === STANDARD)
pruefe('medium-Cover selbst führt wie bisher', vorschauBild(undefined, KLEIN, STANDARD, MASSE).url === KLEIN)
pruefe('Banner geht vor', vorschauBild('https://image.tmdb.org/t/p/w1280/7SJ4Oz86UgKuKivmMXvOanTVCJa.jpg', GROSS, STANDARD, MASSE).breite === 780)
const kopf = titelKopf(titel({ coverImage: GROSS }), UMFELD, 'abc12345', false, MASSE)
pruefe('Kopf: og:image ist die medium-Fassung mit 230×334', kopf.includes(`og:image" content="${KLEIN}"`) && kopf.includes('width" content="230"') && kopf.includes('height" content="334"'))
pruefe('Kopf: Wächter ohne Mangel', vorschauMaengel(kopf, SITE).length === 0)
pruefe('Kopf ohne Maße: Standardbild', titelKopf(titel({ coverImage: GROSS }), UMFELD, 'abc12345').includes(`og:image" content="${STANDARD}"`))

/* Cartoon-Cover in w342. */
const PFAD = '/xslZBngK5IFpVNjT9Yr11klSgkk.jpg'
const C342 = `https://image.tmdb.org/t/p/w342${PFAD}`
const CBESTAND = { [PFAD]: [342, 513, 53648] } as const
pruefe('cartoonPfad: w342 ja, w500, w780 und Fremdes nein', cartoonPfad(C342) === PFAD && cartoonPfad(C342.replace('w342', 'w500')) === undefined && cartoonPfad(C342.replace('image.tmdb.org', 'example.org')) === undefined && cartoonPfad(undefined) === undefined)
pruefe('cartoonMasse: 342×513 brauchbar', cartoonMasse(CBESTAND).get(`cartoon:${PFAD}`)?.join() === '342,513')
pruefe('cartoonMasse: 250.000 Byte gut, 250.001 nicht', cartoonMasse({ '/a.jpg': [342, 513, 250_000] }).size === 1 && cartoonMasse({ '/a.jpg': [342, 513, 250_001] }).size === 0)
pruefe('cartoonPfad: Adresse mit fremdem Vorspann nicht', cartoonPfad(`https://example.org/?u=${C342}`) === undefined)
pruefe('cartoonMasse: Breite 341 nicht (Kopf müsste 342 sagen), Höhe 0 nicht', cartoonMasse({ '/a.jpg': [341, 513, 1000] }).size === 0 && cartoonMasse({ '/a.jpg': [342, 0, 1000] }).size === 0)
const vc = vorschauBild(undefined, C342, STANDARD, cartoonMasse(CBESTAND))
pruefe('Cartoon-Cover: 342×513, kleine Karte, jpeg', vc.url === C342 && vc.breite === 342 && vc.hoehe === 513 && vc.karte === 'summary' && vc.typ === 'image/jpeg')
pruefe('Cartoon-Cover ungemessen: Standard', vorschauBild(undefined, C342, STANDARD, new Map()).url === STANDARD)
pruefe('Cartoon-Cover: Maße eines anderen Pfads zählen nicht', vorschauBild(undefined, C342, STANDARD, cartoonMasse({ '/anders.jpg': [342, 600, 1000] })).url === STANDARD)
const ckopf = titelKopf(titel({ id: -5, coverImage: C342 }), UMFELD, 'abc12345', false, cartoonMasse(CBESTAND))
pruefe('Cartoon-Kopf: Cover mit 342×513 und kein Mangel', ckopf.includes(`og:image" content="${C342}"`) && ckopf.includes('height" content="513"') && vorschauMaengel(ckopf, SITE).length === 0)
pruefe('Wächter: w342 mit Breite 500 rot, mit 342 gut', vorschauMaengel(bildMeta({ ...vc, breite: 500 }), SITE).length === 1 && vorschauMaengel(bildMeta(vc), SITE).length === 0)
pruefe('Wächter: w342 ohne Höhe rot', vorschauMaengel(`<meta property="og:image" content="${C342}" /><meta property="og:image:width" content="342" />`, SITE).length === 1)

/* Ungemessene und Messen der Cartoon-Cover: je Pfad einmal, nur eindeutige Antworten, Limit, Pause. */
const cartoons = [titel({ coverImage: C342 }), titel({ coverImage: C342 }), titel({ coverImage: 'https://image.tmdb.org/t/p/w342/neu.jpg' }), titel({ coverImage: 'https://image.tmdb.org/t/p/w500/x.jpg' }), titel({})]
pruefe('ungemesseneCartoon: je Pfad einmal, nur w342', ungemesseneCartoon(cartoons, {}).join() === `${PFAD},/neu.jpg`)
pruefe('ungemesseneCartoon: Gemessene nicht', ungemesseneCartoon(cartoons, CBESTAND).join() === '/neu.jpg')
function jpeg(breite: number, hoehe: number): Buffer {
  const kopf = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, hoehe >> 8, hoehe & 255, breite >> 8, breite & 255, 0x03])
  return Buffer.concat([Buffer.from([0xff, 0xd8]), kopf, Buffer.alloc(20)])
}
const abgerufen: string[] = []
let pausen = 0
const hole = async (url: string): Promise<{ status: number; bytes: Buffer }> => {
  abgerufen.push(url)
  if (url.endsWith('/404.jpg')) return { status: 404, bytes: jpeg(342, 513) }
  if (url.endsWith('/muell.jpg')) return { status: 200, bytes: Buffer.from('<html>') }
  if (url.endsWith('/fehler.jpg')) throw new Error('Zeitüberschreitung')
  return { status: 200, bytes: jpeg(342, url.endsWith('/gut2.jpg') ? 500 : 513) }
}
const neu = {} as Record<string, readonly [number, number, number]>
const n = await messeCartoon(['/404.jpg', '/muell.jpg', '/fehler.jpg', '/gut1.jpg', '/gut2.jpg', '/gut3.jpg'], neu, 5, hole, async () => { pausen++ })
pruefe('messeCartoon: gut1 und gut2 gemessen (Limit 5 von 6)', n === 2 && Object.keys(neu).join() === '/gut1.jpg,/gut2.jpg' && abgerufen.length === 5)
pruefe('messeCartoon: Abruf der w342-Adresse', abgerufen[3] === 'https://image.tmdb.org/t/p/w342/gut1.jpg')
pruefe('messeCartoon: Wert [Breite, Höhe, Bytes] je Datei', neu['/gut1.jpg']?.join() === `342,513,${jpeg(342, 513).length}` && neu['/gut2.jpg']?.join() === `342,500,${jpeg(342, 500).length}`)
pruefe('messeCartoon: Pause nach jedem Abruf', pausen === 5)
pruefe('messeCartoon: 404, Müll und Fehler bleiben ungemessen', !('/404.jpg' in neu) && !('/muell.jpg' in neu) && !('/fehler.jpg' in neu))

/* Verdrahtung: Messlauf misst die medium-Fassung und die Cartoon-Cover und schreibt beide Dateien; ladeVorschauMasse liest sie. */
const echtesFetch = globalThis.fetch
const geholt: string[] = []
globalThis.fetch = (async (url: string) => {
  geholt.push(url)
  return new Response(new Uint8Array(jpeg(url.includes('/w342/') ? 342 : 230, 334)), { status: 200 })
}) as typeof fetch
mkdirSync(join(tmp, 'public/data'), { recursive: true })
mkdirSync(join(tmp, 'data'), { recursive: true })
writeFileSync(join(tmp, 'public/data/titles.json'), JSON.stringify([titel({ id: 900001, coverImage: GROSS })]))
writeFileSync(join(tmp, 'public/data/cartoons.json'), JSON.stringify([titel({ id: -900002, coverImage: C342 })]))
writeFileSync(join(tmp, COVER_MASSE_DATEI), JSON.stringify({ 'large/bx44-MG5I672UbWAy.png': [460, 667, 412397] }))
writeFileSync(join(tmp, CARTOON_MASSE_DATEI), JSON.stringify({ '/fremd.jpg': [342, 400, 5] }))
try {
  await messeAnilistCoverImLauf()
} finally {
  globalThis.fetch = echtesFetch
}
const anilist = JSON.parse(readFileSync(join(tmp, COVER_MASSE_DATEI), 'utf8')) as Record<string, number[]>
const cartoon = JSON.parse(readFileSync(join(tmp, CARTOON_MASSE_DATEI), 'utf8')) as Record<string, number[]>
pruefe('Lauf: medium-Fassung des zu großen Covers abgerufen und eingetragen', geholt.includes(KLEIN) && anilist['medium/bx44-MG5I672UbWAy.png']?.slice(0, 2).join() === '230,334')
pruefe('Lauf: large nicht noch einmal abgerufen', !geholt.includes(GROSS) && anilist['large/bx44-MG5I672UbWAy.png']?.[2] === 412397)
pruefe('Lauf: Cartoon-Cover abgerufen, eingetragen, Fremdes bleibt', geholt.includes(C342) && cartoon[PFAD]?.slice(0, 2).join() === '342,334' && cartoon['/fremd.jpg']?.join() === '342,400,5')
const geladen = ladeVorschauMasse()
pruefe('ladeVorschauMasse: medium-Fassung und Cartoon-Cover aus den Dateien', geladen.get('anilist:medium/bx44-MG5I672UbWAy.png')?.join() === '230,334' && geladen.get(`cartoon:${PFAD}`)?.join() === '342,334')
pruefe('ladeVorschauMasse: Cartoon-Titel führt sein Cover', vorschauBild(undefined, C342, STANDARD, geladen).url === C342)
rmSync(tmp, { recursive: true, force: true })

if (fehler) {
  console.error(`[cover-klein-vorschau] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[cover-klein-vorschau] ${faelle} Fälle grün (medium-Fassung bei zu großem large, Cartoon-w342 mit Maßen, Messlauf und Maße-Ladung als Verdrahtung)`)
