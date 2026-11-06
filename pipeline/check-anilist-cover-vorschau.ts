/**
 * Zusicherungen zur Link-Vorschau mit AniList-Cover (06.11.2026, a-31): Ein Cover führt die Titelseite nur mit gemessenen Maßen und
 * Größe bis 250 KB; sonst bleibt das Standardbild. Fälle aus echten Messungen (alle 465 Cover von `titles.json`, 06.11.2026).
 * Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

const tmp = mkdtempSync(join(tmpdir(), 'anilist-cover-'))
process.env.AK_ROOT = tmp
const { anilistMasse, bildMasse, coverDatei, messeCover, ungemessene } = await import('./lib/anilist-cover-masse.ts')
const { messeNeueAnilistCover, messeAnilistCoverImLauf, COVER_MASSE_DATEI } = await import('./lib/anilist-cover-lauf.ts')
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
/* Echte Cover: 298 JPEG 460×649 (136.264 B), 44 PNG 460×667 (412.397 B, zu groß), medium 365 JPEG 225×293 (38.220 B), medium b482 PNG 230×345 (185.694 B). */
const C298 = `${BASIS}large/bx298-4NawsRDRVaHR.jpg`
const C44 = `${BASIS}large/bx44-MG5I672UbWAy.png`
const C365 = `${BASIS}medium/365.jpg`
const C482 = `${BASIS}medium/b482-c14JwoMTmKAU.png`
const BANNER = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/135432-kmwEDXyeMdhE.jpg'
const TMDB_BANNER = 'https://image.tmdb.org/t/p/w1280/7SJ4Oz86UgKuKivmMXvOanTVCJa.jpg'
const ROZEN = 'https://image.tmdb.org/t/p/w500/yZ0vpJi7H5piebWbHXCD4aKcvyL.jpg'
const BESTAND = {
  'large/bx298-4NawsRDRVaHR.jpg': [460, 649, 136264],
  'large/bx44-MG5I672UbWAy.png': [460, 667, 412397],
  'medium/365.jpg': [225, 293, 38220],
  'medium/b482-c14JwoMTmKAU.png': [230, 345, 185694],
} as const
const MASSE = anilistMasse(BESTAND)
const UMFELD = { krumenJsonLd: '', krumenHtml: '', aehnlichHtml: '' } as never
const titel = (extra: Partial<Title>): Title => ({ id: 1, slug: 'x', titleDe: 'X', format: 'TV', episodes: 12, ...extra }) as Title

/* Adressen: nur Cover auf dem Bilderdienst, Banner und Fremdes nicht. */
pruefe('coverDatei large', coverDatei(C298) === 'large/bx298-4NawsRDRVaHR.jpg')
pruefe('coverDatei medium', coverDatei(C365) === 'medium/365.jpg')
pruefe('coverDatei: Banner nicht', coverDatei(BANNER) === undefined)
pruefe('coverDatei: fremder Host nicht', coverDatei(C298.replace('s4.anilist.co', 'example.org')) === undefined)
pruefe('coverDatei: ohne Adresse', coverDatei(undefined) === undefined)

/* Auswahl: Größe und Breite, jeweils an der Grenze und eins darüber. */
pruefe('anilistMasse: 298, 365 und b482 brauchbar, 44 (412 KB) nicht', [...MASSE.keys()].sort().join() === 'anilist:large/bx298-4NawsRDRVaHR.jpg,anilist:medium/365.jpg,anilist:medium/b482-c14JwoMTmKAU.png')
pruefe('anilistMasse: Maße als [Breite, Höhe]', MASSE.get('anilist:medium/365.jpg')?.join() === '225,293')
pruefe('anilistMasse: 250.000 Byte gut', anilistMasse({ 'large/a.jpg': [460, 600, 250_000] }).size === 1)
pruefe('anilistMasse: 250.001 Byte zu groß', anilistMasse({ 'large/a.jpg': [460, 600, 250_001] }).size === 0)
pruefe('anilistMasse: Breite 200 gut', anilistMasse({ 'medium/a.jpg': [200, 300, 50_000] }).size === 1)
pruefe('anilistMasse: Breite 199 zu schmal', anilistMasse({ 'medium/a.jpg': [199, 300, 50_000] }).size === 0)
pruefe('anilistMasse: Höhe 0 nicht', anilistMasse({ 'medium/a.jpg': [200, 0, 50_000] }).size === 0)

/* Vorschau: Cover in eigener Größe, kleine Karte, Typ nach Endung; Banner und Plakat gehen vor. */
const v298 = vorschauBild(undefined, C298, STANDARD, MASSE)
pruefe('Cover 298: 460×649, summary, jpeg', v298.url === C298 && v298.breite === 460 && v298.hoehe === 649 && v298.karte === 'summary' && v298.typ === 'image/jpeg')
const v482 = vorschauBild(undefined, C482, STANDARD, MASSE)
pruefe('Cover b482: 230×345, png', v482.breite === 230 && v482.hoehe === 345 && v482.typ === 'image/png')
pruefe('Cover 44 (zu groß): Standardbild', vorschauBild(undefined, C44, STANDARD, MASSE).url === STANDARD)
pruefe('Cover ungemessen: Standardbild 1200×630', vorschauBild(undefined, C298, STANDARD, new Map()).breite === 1200)
pruefe('AniList-Banner + Cover: das Cover', vorschauBild(BANNER, C298, STANDARD, MASSE).url === C298)
pruefe('TMDB-Banner geht dem Cover vor', vorschauBild(TMDB_BANNER, C298, STANDARD, MASSE).breite === 780)
const plakatMasse = new Map([...MASSE, ['/yZ0vpJi7H5piebWbHXCD4aKcvyL.jpg', [1546, 2175] as const]])
pruefe('TMDB-Plakat geht dem Cover vor', vorschauBild(undefined, ROZEN, STANDARD, plakatMasse).breite === 500)

/* Durch den Seitenkopf: Maße stehen im Kopf, der Wächter nimmt ihn an. */
const kopf = titelKopf(titel({ coverImage: C298 }), UMFELD, 'abc12345', false, MASSE)
pruefe('Kopf: og:image ist das Cover mit 460×649', kopf.includes(`og:image" content="${C298}"`) && kopf.includes('width" content="460"') && kopf.includes('height" content="649"') && kopf.includes('twitter:card" content="summary"'))
pruefe('Kopf: Wächter ohne Mangel', vorschauMaengel(kopf, SITE).length === 0)
pruefe('Kopf ohne Maße: Standardbild', titelKopf(titel({ coverImage: C298 }), UMFELD, 'abc12345').includes(`og:image" content="${STANDARD}"`))
pruefe('Wächter: Cover mit Breite 199 rot', vorschauMaengel(bildMeta({ ...v298, breite: 199 }), SITE).length === 1)
pruefe('Wächter: Cover mit Breite 200 gut', vorschauMaengel(bildMeta({ ...v298, breite: 200 }), SITE).length === 0)
pruefe('Wächter: AniList-Banner bleibt rot', vorschauMaengel(`<meta property="og:image" content="${BANNER}" />`, SITE).length === 3)

/* Dateikopf: PNG, JPEG baseline und progressiv, Müll. */
const png = Buffer.alloc(33)
Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png)
png.writeUInt32BE(460, 16)
png.writeUInt32BE(667, 20)
/* APP0 trägt in der Nutzlast ein scheinbares SOF0 (ff c0 …), DHT (ff c4) steht vor dem echten SOF: nur das Überspringen nach Längenfeld und der Ausschluss von c4 lesen richtig. */
const jpeg = (sof: number): Buffer => {
  const app = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x05, 0x00, 0x07, 0x03, 0, 0, 0, 0])
  const dqt = Buffer.from([0xff, 0xdb, 0x00, 0x05, 0, 0, 0])
  const dht = Buffer.from([0xff, 0xc4, 0x00, 0x05, 0, 0, 0])
  const kopf = Buffer.from([0xff, sof, 0x00, 0x11, 0x08, 0x02, 0x89, 0x01, 0xcc, 0x03])
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app, dqt, dht, kopf, Buffer.alloc(20)])
}
pruefe('bildMasse PNG 460×667', bildMasse(png)?.join() === '460,667')
pruefe('bildMasse JPEG baseline: Breite 460, Höhe 649', bildMasse(jpeg(0xc0))?.join() === '460,649')
pruefe('bildMasse JPEG progressiv', bildMasse(jpeg(0xc2))?.join() === '460,649')
pruefe('bildMasse: Müll', bildMasse(Buffer.from('<html>kaputt</html>')) === undefined)
pruefe('bildMasse: abgeschnittenes JPEG', bildMasse(jpeg(0xc0).subarray(0, 30)) === undefined)

/* Ungemessene: je Datei einmal, Banner und Fremdes nicht. */
pruefe('ungemessene: neue ja, bekannte, Banner und Fremdes nicht', ungemessene([C298, C365, `${BASIS}large/neu.jpg`, `${BASIS}large/neu.jpg`, BANNER, undefined, ROZEN], { 'large/bx298-4NawsRDRVaHR.jpg': [460, 649, 1] }).join() === `${C365},${BASIS}large/neu.jpg`)

/* Messen: nur eine eindeutige Antwort zählt; Limit und Pause je Abruf. */
const abgerufen: string[] = []
let pausen = 0
const hole = async (url: string): Promise<{ status: number; bytes: Buffer }> => {
  abgerufen.push(url)
  if (url.endsWith('404.jpg')) return { status: 404, bytes: jpeg(0xc0) }
  if (url.endsWith('muell.jpg')) return { status: 200, bytes: Buffer.from('<html>') }
  if (url.endsWith('fehler.jpg')) throw new Error('Zeitüberschreitung')
  return { status: 200, bytes: jpeg(0xc0) }
}
const neu = {} as Record<string, readonly [number, number, number]>
const urls = ['404', 'muell', 'fehler', 'gut1', 'gut2', 'gut3'].map((n) => `${BASIS}large/${n}.jpg`)
const n = await messeCover(urls, neu, 5, hole, async () => { pausen++ })
pruefe('messeCover: nur gut1 und gut2 gemessen (Limit 5 von 6, gut3 nicht abgerufen)', n === 2 && Object.keys(neu).join() === 'large/gut1.jpg,large/gut2.jpg' && abgerufen.length === 5)
pruefe('messeCover: Wert [Breite, Höhe, Bytes]', neu['large/gut1.jpg']?.join() === `460,649,${jpeg(0xc0).length}`)
pruefe('messeCover: Pause nach jedem Abruf', pausen === 5)
pruefe('messeCover: 404, Müll und Fehler bleiben ungemessen', !('large/404.jpg' in neu) && !('large/muell.jpg' in neu) && !('large/fehler.jpg' in neu))

/* Verdrahtung des Laufs: liest die Titel, misst fehlende Cover mit der Attrappe, schreibt die Datei, Fremdes bleibt. */
const echtesFetch = globalThis.fetch
const geholt: string[] = []
globalThis.fetch = (async (url: string) => {
  geholt.push(url)
  return new Response(new Uint8Array(jpeg(0xc0)), { status: 200 })
}) as typeof fetch
mkdirSync(join(tmp, 'public/data'), { recursive: true })
mkdirSync(join(tmp, 'data'), { recursive: true })
writeFileSync(join(tmp, 'public/data/titles.json'), JSON.stringify([titel({ id: 900001, coverImage: C298 }), titel({ id: 900002, coverImage: `${BASIS}large/neu900002.jpg` })]))
writeFileSync(join(tmp, 'public/data/ohne-synchro.json'), JSON.stringify([titel({ id: 900003, coverImage: `${BASIS}medium/neu900003.jpg` })]))
writeFileSync(join(tmp, COVER_MASSE_DATEI), JSON.stringify({ 'large/bx298-4NawsRDRVaHR.jpg': [460, 649, 136264], 'large/fremd.jpg': [1, 2, 3] }))
await messeAnilistCoverImLauf()
const danach = JSON.parse(readFileSync(join(tmp, COVER_MASSE_DATEI), 'utf8')) as Record<string, number[]>
pruefe('Lauf: beide neuen Cover (Hauptbestand und Katalog) abgerufen, das bekannte nicht', geholt.length === 2 && !geholt.includes(C298))
pruefe('Lauf: Datei hat die alten und die zwei neuen Einträge', Object.keys(danach).sort().join() === 'large/bx298-4NawsRDRVaHR.jpg,large/fremd.jpg,large/neu900002.jpg,medium/neu900003.jpg')
pruefe('Lauf: Fremdeintrag unverändert', danach['large/fremd.jpg']?.join() === '1,2,3' && danach['large/bx298-4NawsRDRVaHR.jpg']?.join() === '460,649,136264')
writeFileSync(join(tmp, 'data/tmdb-poster.json'), JSON.stringify({ '1': { p: '/yZ0vpJi7H5piebWbHXCD4aKcvyL.jpg', w: 1546, h: 2175 } }))
const geladen = ladeVorschauMasse()
pruefe('ladeVorschauMasse: TMDB-Plakat und gemessenes AniList-Cover in einer Tabelle', [...geladen.keys()].sort().join() === '/yZ0vpJi7H5piebWbHXCD4aKcvyL.jpg,anilist:large/bx298-4NawsRDRVaHR.jpg,anilist:large/neu900002.jpg,anilist:medium/neu900003.jpg', [...geladen.keys()].join())
geholt.length = 0
await messeAnilistCoverImLauf()
pruefe('Lauf: zweiter Lauf ruft nichts mehr ab', geholt.length === 0)
const viele = Array.from({ length: 5 }, (_, i) => titel({ id: 900100 + i, coverImage: `${BASIS}large/v${i}.jpg` }))
pruefe('Lauf: Limit 3 misst genau 3', (await messeNeueAnilistCover(viele, {}, 3)) === 3)
globalThis.fetch = echtesFetch
rmSync(tmp, { recursive: true, force: true })

if (fehler) {
  console.error(`[anilist-cover-vorschau] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[anilist-cover-vorschau] ${faelle} Fälle grün (Auswahl bis 250 KB und ab 200 px, Maße im Kopf, Messlauf mit Limit, Banner/Plakat gehen vor)`)
