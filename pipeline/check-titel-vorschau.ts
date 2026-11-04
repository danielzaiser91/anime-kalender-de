/**
 * Zusicherungen zur Vorschau der Titelseiten (03.11.2026, WhatsApp zeigte für Bright Samurai Soul keine Karte):
 * Jedes `og:image` trägt Maße und ist entweder ein Bild der eigenen Domain oder ein TMDB-Banner in w780;
 * „1 Folgen“ kommt nicht vor. Die Fälle sind die echten Auslöser (AniList-Banner 135432, TMDB-Banner w1280).
 * Läuft in `check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { titelKopf } from './lib/titel-seite.ts'
import { bildMeta, folgenText, vorschauBild, vorschauMaengel } from './lib/titel-vorschau.ts'
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

function titel(extra: Partial<Title>): Title {
  return { id: 1, slug: 'bright-samurai-soul', titleDe: 'Bright Samurai Soul', format: 'ONA', episodes: 1, ...extra } as Title
}

/* Auslöser: AniList-Banner, eine Folge. */
const kopfAnilist = titelKopf(titel({ bannerImage: ANILIST, coverImage: ANILIST_COVER }), UMFELD, 'abc12345')
pruefe('AniList-Banner: Standardbild mit Maßen', kopfAnilist.includes(`og:image" content="${STANDARD}"`) && kopfAnilist.includes('og:image:width" content="1200"') && kopfAnilist.includes('og:image:height" content="630"'))
pruefe('AniList-Banner: Kopf besteht den Wächter', vorschauMaengel(kopfAnilist, SITE).length === 0)
pruefe('1 Folge im Singular', kopfAnilist.includes('1 Folge.') && !kopfAnilist.includes('1 Folgen'))
pruefe('große Karte', kopfAnilist.includes('twitter:card" content="summary_large_image"'))

const nurCover = titelKopf(titel({ coverImage: ANILIST_COVER }), UMFELD, 'abc12345')
pruefe('nur Cover: Standardbild', nurCover.includes(`og:image" content="${STANDARD}"`) && nurCover.includes('summary_large_image'))

const tmdb = titelKopf(titel({ bannerImage: TMDB, episodes: 12 }), UMFELD, 'abc12345')
pruefe('TMDB: w780 mit 780×439', tmdb.includes('og:image" content="https://image.tmdb.org/t/p/w780/7SJ4Oz86UgKuKivmMXvOanTVCJa.jpg"') && tmdb.includes('width" content="780"') && tmdb.includes('height" content="439"'))
pruefe('12 Folgen im Plural', tmdb.includes('12 Folgen.'))

pruefe('vorschauBild: fremder TMDB-Pfad bleibt Standard', vorschauBild('https://image.tmdb.org/t/p/original/x.jpg', STANDARD).url === STANDARD)
pruefe('folgenText', folgenText(1) === '1 Folge' && folgenText(2) === '2 Folgen' && folgenText(11) === '11 Folgen')
pruefe('bildMeta: vier Zeilen', bildMeta(vorschauBild(undefined, STANDARD)).split('\n').filter(Boolean).length === 4)

/* Wächter: je Mangel ein roter Fall, dazu der gute. */
const gut = bildMeta(vorschauBild(undefined, STANDARD))
pruefe('Wächter: gute Seite ohne Mangel', vorschauMaengel(gut, SITE).length === 0)
pruefe('Wächter: tmdb w780 gut', vorschauMaengel(bildMeta(vorschauBild(TMDB, STANDARD)), SITE).length === 0)
pruefe('Wächter: AniList-Bild rot', vorschauMaengel(`<meta property="og:image" content="${ANILIST}" />`, SITE).length === 3, 'Fremdbild plus beide Maße')
pruefe('Wächter: TMDB w1280 rot', vorschauMaengel(`<meta property="og:image" content="${TMDB}" />\n${gut.split('\n').slice(2).join('\n')}`, SITE).length === 1)
pruefe('Wächter: Breite fehlt', vorschauMaengel(gut.replace(/.*image:width.*\n/, ''), SITE).join().includes('width'))
pruefe('Wächter: Höhe fehlt', vorschauMaengel(gut.replace(/.*image:height.*\n/, ''), SITE).join().includes('height'))
pruefe('Wächter: „1 Folgen“ rot', vorschauMaengel(`${gut}<p>Auf Deutsch. 1 Folgen.</p>`, SITE).length === 1)
pruefe('Wächter: „11 Folgen“ und „2,1 Folgen“ nicht rot', vorschauMaengel(`${gut}<p>11 Folgen. 21 Folgen.</p>`, SITE).length === 0)
pruefe('Wächter: Seite ohne og:image (Weiterleitung) ohne Mangel', vorschauMaengel('<p>x</p>', SITE).length === 0)

if (fehler) {
  console.error(`[titel-vorschau] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[titel-vorschau] ${faelle} Fälle grün (Bild mit Maßen, TMDB w780, Standardbild, Singular „1 Folge“)`)
