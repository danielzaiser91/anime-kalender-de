/**
 * Zusicherungen zur Vorschau der Titelseiten (03.11.2026, WhatsApp zeigte für Bright Samurai Soul keine Karte):
 * Jedes `og:image` trägt Maße und ist entweder ein Bild der eigenen Domain oder ein TMDB-Banner in w780 oder ein TMDB-Plakat in w500, jeweils mit zur Größe passender Breite;
 * „1 Folgen“ kommt nicht vor. Die Fälle sind die echten Auslöser (AniList-Banner 135432, TMDB-Banner w1280).
 * Läuft in `check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { titelKopf } from './lib/titel-seite.ts'
import { plakatVorschauMaengel } from './lib/plakat-vorschau-wache.ts'
import { bildMeta, folgenText, plakatMasse, vorschauBild, vorschauMaengel } from './lib/titel-vorschau.ts'
import type { Umfeld } from './lib/titel-umfeld.ts'

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
const ANILIST = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/135432-kmwEDXyeMdhE.jpg'
const ANILIST_COVER = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx135432-wi3xfmdF7qTW.jpg'
const TMDB = 'https://image.tmdb.org/t/p/w1280/7SJ4Oz86UgKuKivmMXvOanTVCJa.jpg'
const UMFELD = { krumenJsonLd: '', krumenHtml: '', aehnlichHtml: '' } as unknown as Umfeld
/* Echte Plakate aus data/tmdb-poster.json (Rozen Maiden, Tenchi Muyo!): Originalmaße 1546×2175 und 2000×3000, in w500 gemessen 500×703 und 500×750. */
const ROZEN = 'https://image.tmdb.org/t/p/w500/yZ0vpJi7H5piebWbHXCD4aKcvyL.jpg'
const TENCHI = 'https://image.tmdb.org/t/p/w500/xoqpeAa3UH3LI7eYW45RDEhl2qC.jpg'
const MASSE = plakatMasse({
  '1': { p: '/yZ0vpJi7H5piebWbHXCD4aKcvyL.jpg', w: 1546, h: 2175 },
  '2': { p: '/xoqpeAa3UH3LI7eYW45RDEhl2qC.jpg', w: 2000, h: 3000 },
  '3': { p: null, w: 10, h: 10 },
  '4': { p: '/ohne-hoehe.jpg', w: 10, h: null },
  '5': null,
  '6': { p: '/rundung.jpg', w: 1000, h: 1405 },
})

function titel(extra: Partial<Title>): Title {
  return { id: 1, slug: 'bright-samurai-soul', titleDe: 'Bright Samurai Soul', format: 'ONA', episodes: 1, ...extra } as Title
}

/* Auslöser: AniList-Banner, eine Folge. */
const kopfAnilist = titelKopf(titel({ bannerImage: ANILIST, coverImage: ANILIST_COVER }), UMFELD, 'abc12345', false, MASSE)
pruefe('AniList-Banner: Standardbild mit Maßen', kopfAnilist.includes(`og:image" content="${STANDARD}"`) && kopfAnilist.includes('og:image:width" content="1200"') && kopfAnilist.includes('og:image:height" content="630"'))
pruefe('AniList-Banner: Kopf besteht den Wächter', vorschauMaengel(kopfAnilist, SITE).length === 0)
pruefe('1 Folge im Singular', kopfAnilist.includes('1 Folge.') && !kopfAnilist.includes('1 Folgen'))
pruefe('große Karte', kopfAnilist.includes('twitter:card" content="summary_large_image"'))

const nurCover = titelKopf(titel({ coverImage: ANILIST_COVER }), UMFELD, 'abc12345', false, MASSE)
pruefe('nur AniList-Cover: Standardbild', nurCover.includes(`og:image" content="${STANDARD}"`) && nurCover.includes('summary_large_image'))

/* TMDB-Plakat (793 Titel ohne TMDB-Banner, 278 davon mit w500-Plakat): eigenes Bild mit wahren Maßen, kleine Karte. */
const plakat = titelKopf(titel({ coverImage: ROZEN }), UMFELD, 'abc12345', false, MASSE)
pruefe('Plakat: w500 mit 500×703, kleine Karte', plakat.includes(`og:image" content="${ROZEN}"`) && plakat.includes('width" content="500"') && plakat.includes('height" content="703"') && plakat.includes('twitter:card" content="summary"'))
pruefe('Plakat: Kopf besteht den Wächter', vorschauMaengel(plakat, SITE).length === 0)
pruefe('Plakat 2000×3000: Höhe 750', titelKopf(titel({ coverImage: TENCHI }), UMFELD, 'abc12345', false, MASSE).includes('height" content="750"'))
const plakatUndAnilist = titelKopf(titel({ bannerImage: ANILIST, coverImage: TENCHI }), UMFELD, 'abc12345', false, MASSE)
pruefe('AniList-Banner + TMDB-Plakat: das Plakat', plakatUndAnilist.includes(`og:image" content="${TENCHI}"`) && plakatUndAnilist.includes('width" content="500"'))
const ohneMasse = titelKopf(titel({ coverImage: ROZEN }), UMFELD, 'abc12345')
pruefe('Plakat ohne bekannte Maße: Standardbild', ohneMasse.includes(`og:image" content="${STANDARD}"`) && ohneMasse.includes('twitter:card" content="summary_large_image"'))
pruefe('Plakat in anderer Größe: Standardbild', vorschauBild(undefined, ROZEN.replace('w500', 'w185'), STANDARD, MASSE).url === STANDARD)
pruefe('Höhe wird gerundet (702,5 → 703)', vorschauBild(undefined, 'https://image.tmdb.org/t/p/w500/rundung.jpg', STANDARD, MASSE).hoehe === 703)
pruefe('Banner geht dem Plakat vor', vorschauBild(TMDB, ROZEN, STANDARD, MASSE).breite === 780)
pruefe('plakatMasse: nur vollständige Einträge', [...MASSE.keys()].join() === '/yZ0vpJi7H5piebWbHXCD4aKcvyL.jpg,/xoqpeAa3UH3LI7eYW45RDEhl2qC.jpg,/rundung.jpg')

const tmdb = titelKopf(titel({ bannerImage: TMDB, episodes: 12 }), UMFELD, 'abc12345', false, MASSE)
pruefe('TMDB: w780 mit 780×439', tmdb.includes('og:image" content="https://image.tmdb.org/t/p/w780/7SJ4Oz86UgKuKivmMXvOanTVCJa.jpg"') && tmdb.includes('width" content="780"') && tmdb.includes('height" content="439"'))
pruefe('12 Folgen im Plural', tmdb.includes('12 Folgen.'))

pruefe('vorschauBild: fremder TMDB-Pfad bleibt Standard', vorschauBild('https://image.tmdb.org/t/p/original/x.jpg', undefined, STANDARD, MASSE).url === STANDARD)
pruefe('folgenText', folgenText(1) === '1 Folge' && folgenText(2) === '2 Folgen' && folgenText(11) === '11 Folgen')
pruefe('bildMeta: vier Zeilen', bildMeta(vorschauBild(undefined, undefined, STANDARD, MASSE)).split('\n').filter(Boolean).length === 4)

/* Wächter: je Mangel ein roter Fall, dazu der gute. */
const gut = bildMeta(vorschauBild(undefined, undefined, STANDARD, MASSE))
pruefe('Wächter: gute Seite ohne Mangel', vorschauMaengel(gut, SITE).length === 0)
pruefe('Wächter: tmdb w780 gut', vorschauMaengel(bildMeta(vorschauBild(TMDB, undefined, STANDARD, MASSE)), SITE).length === 0)
pruefe('Wächter: AniList-Bild rot', vorschauMaengel(`<meta property="og:image" content="${ANILIST}" />`, SITE).length === 3, 'Fremdbild plus beide Maße')
pruefe('Wächter: TMDB w1280 rot', vorschauMaengel(`<meta property="og:image" content="${TMDB}" />\n${gut.split('\n').slice(2).join('\n')}`, SITE).length === 1)
const w780 = bildMeta(vorschauBild(TMDB, undefined, STANDARD, MASSE))
const w500 = bildMeta(vorschauBild(undefined, ROZEN, STANDARD, MASSE))
pruefe('Wächter: w500 gut', vorschauMaengel(w500, SITE).length === 0)
pruefe('Wächter: w780 mit Breite 1200 rot', vorschauMaengel(w780.replace('width" content="780"', 'width" content="1200"'), SITE).length === 1)
pruefe('Wächter: w500 mit Breite 780 rot', vorschauMaengel(w500.replace('width" content="500"', 'width" content="780"'), SITE).length === 1)
pruefe('Wächter: w780 mit Breite 500 rot', vorschauMaengel(w780.replace('width" content="780"', 'width" content="500"'), SITE).length === 1)
pruefe('Wächter: Standardbild mit Breite 1200 gut', vorschauMaengel(gut, SITE).length === 0)
pruefe('Wächter: Breite fehlt', vorschauMaengel(gut.replace(/.*image:width.*\n/, ''), SITE).join().includes('width'))
pruefe('Wächter: Höhe fehlt', vorschauMaengel(gut.replace(/.*image:height.*\n/, ''), SITE).join().includes('height'))
pruefe('Wächter: „1 Folgen“ rot', vorschauMaengel(`${gut}<p>Auf Deutsch. 1 Folgen.</p>`, SITE).length === 1)
pruefe('Wächter: „11 Folgen“ und „2,1 Folgen“ nicht rot', vorschauMaengel(`${gut}<p>11 Folgen. 21 Folgen.</p>`, SITE).length === 0)
pruefe('Wächter: Seite ohne og:image (Weiterleitung) ohne Mangel', vorschauMaengel('<p>x</p>', SITE).length === 0)

/* Plakat-Wächter (check-teilseiten): Standardbild bei einem Titel mit Plakat und Maßen ist rot, Plakat und Terminbild sind grün. */
const TERMINBILD = `${SITE}og/the-slayers.jpg?v=1`
const gemischt = [{ slug: '1', bild: ROZEN }, { slug: '2', bild: STANDARD }, { slug: '3', bild: TERMINBILD }, { slug: '4', bild: STANDARD }, { slug: '5', bild: undefined }]
pruefe('Plakat-Wächter: genau die zwei Seiten mit Standardbild rot', plakatVorschauMaengel(gemischt, SITE).map((m) => m.split(':')[0]).join() === '2,4')
pruefe('Plakat-Wächter: alle mit Plakat oder Terminbild grün', plakatVorschauMaengel(gemischt.filter((s) => s.slug === '1' || s.slug === '3'), SITE).length === 0)
pruefe('Plakat-Wächter: eine einzelne Seite mit Standardbild rot', plakatVorschauMaengel([{ slug: '9', bild: STANDARD }], SITE).length === 1)

if (fehler) {
  console.error(`[titel-vorschau] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[titel-vorschau] ${faelle} Fälle grün (Bild mit Maßen, TMDB w780/w500, Standardbild, Singular „1 Folge“)`)
