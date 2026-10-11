/**
 * Zusicherungen zu den eigenen aniSearch-Covern (`lib/anisearch-cover-eigen.ts`, `lib/anisearch-robots.ts`): ohne Netz, mit gefälschter fetch-Antwort.
 * Aufruf: `npm run check:logic`.
 */
import sharp from 'sharp'
import { adresseAus, holeCover, istPlatzhalter, offeneKennungen, quelle300, type Abhaengigkeiten, type Manifest } from './lib/anisearch-cover-eigen.ts'
import { coverFrei, pfadErlaubt, robotsAlterMs } from './lib/anisearch-robots.ts'
import { holeRobots } from './fetch-anisearch-robots.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const CDN = 'https://cdn.anisearch.de/images/anime/cover'
const url = (id: number, gr = 600): string => `${CDN}/${Math.floor(id / 1000)}/${id}_${gr}.webp`
const bildAntwort = (): Response => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'image/webp' } })
const apiAntwort = (cover: Record<number, unknown>): Response => new Response(JSON.stringify({ results: Object.entries(cover).map(([id, c]) => ({ id: Number(id), cover: c })) }), { status: 200 })

interface Spur {
  schlafe: number[]
  geschrieben: string[]
  abgerufen: string[]
  gesichert: number
}

function weltMit(antwort: (adresse: string, n: number) => Response, spur: Spur): Abhaengigkeiten {
  let n = 0
  return {
    abruf: (async (adresse: string | URL | Request) => antwort(String(adresse), n++)) as typeof fetch,
    schlafe: async (ms) => void spur.schlafe.push(ms),
    jetzt: () => Date.parse('2026-10-11T12:00:00Z'),
    wandle: async (b) => b,
    schreibe: (relativ) => void spur.geschrieben.push(relativ),
    sichere: () => void spur.gesichert++,
  }
}
const neueSpur = (): Spur => ({ schlafe: [], geschrieben: [], abgerufen: [], gesichert: 0 })
const OPT = { limit: 400, token: 'x', ende: Date.parse('2026-10-11T12:00:00Z') + 300 * 60_000 }

console.log('\nCover eigen: Auswahl und Adressen')
const titel = [{ id: 10_000_005 }, { id: 10_000_003, coverImage: 'b/x.jpg' }, { id: 10_000_002 }, { id: 99 }, { id: 10_000_007 }]
pruefe('nur aniSearch-Titel ohne Cover, aufsteigend, ohne Manifest-Einträge', offeneKennungen(titel, { 7: { stand: 'x', grund: 'nsfw' } }).join() === '2,5')
pruefe('Adresse aus dem cover-Objekt: groß vor mittel', adresseAus({ medium: url(5, 300), large: url(5) }) === url(5))
pruefe('Adresse von fremdem Host zählt nicht', adresseAus({ large: 'https://example.org/a_600.webp' }) === undefined)
pruefe('Quelle wird _300', quelle300(url(12345)) === url(12345, 300))
pruefe('Platzhalter ecchi und 0_600 erkannt, echtes Cover nicht', istPlatzhalter(`${CDN}/ecchi.v1_600.webp`) && istPlatzhalter(`${CDN}/0_600.webp`) && !istPlatzhalter(url(10)))

console.log('\nCover eigen: Lauf mit gefälschter fetch-Antwort')
{
  const spur = neueSpur()
  const w = weltMit((a) => (a.includes('api.anisearch.com') ? apiAntwort({ 1: { large: url(1) }, 2: { large: `${CDN}/ecchi.v1_600.webp` }, 3: { nsfw: 18, large: url(3) }, 4: {}, 5: { large: url(5) }, 6: { large: url(6) } }) : (spur.abgerufen.push(a), bildAntwort())), spur)
  const m: Manifest = {}
  const z = await holeCover(['1', '2', '3', '4', '5', '6'], m, OPT, w)
  pruefe('zwei Bilder geladen und geschrieben, Pfad relativ zur Bild-Domain', z.neu === 3 && spur.geschrieben.join() === 'anisearch/1.webp,anisearch/5.webp,anisearch/6.webp', spur.geschrieben)
  pruefe('abgerufen wird die _300-Fassung', spur.abgerufen.every((a) => a.endsWith('_300.webp')) && spur.abgerufen.length === 3, spur.abgerufen)
  pruefe('Manifest: Datei, Größe, Quelle, Stand', m['1']?.datei === 'anisearch/1.webp' && m['1']?.groesse === 4 && m['1']?.quelle === url(1, 300) && m['1']?.stand === '2026-10-11', m['1'])
  pruefe('Platzhalter, 18+ und ohne Adresse: kein Bild, Grund vermerkt', m['2']?.grund === 'platzhalter' && m['3']?.grund === 'nsfw' && m['4']?.grund === 'ohne-adresse' && !m['2']?.datei, [m['2'], m['3'], m['4']])
  pruefe('zwei Sekunden Abstand je Bild', spur.schlafe.filter((ms) => ms === 2_000).length === 3, spur.schlafe)
}
{
  const spur = neueSpur()
  const w = weltMit((a) => (a.includes('api.anisearch.com') ? apiAntwort({ 1: { large: url(1) }, 2: { large: url(2) }, 3: { large: url(3) } }) : (spur.abgerufen.push(a), bildAntwort())), spur)
  const z = await holeCover(['1', '2', '3'], {}, { ...OPT, limit: 2 }, w)
  pruefe('--limit begrenzt die Zahl der Titel', z.neu === 2 && spur.geschrieben.length === 2, z)
}

console.log('\nCover eigen: Sperre und Fehler')
{
  const spur = neueSpur()
  let bilder = 0
  const w = weltMit((a) => (a.includes('api.anisearch.com') ? apiAntwort({ 1: { large: url(1) }, 2: { large: url(2) }, 3: { large: url(3) }, 4: { large: url(4) } }) : ++bilder <= 3 ? new Response('', { status: 423 }) : bildAntwort()), spur)
  const m: Manifest = {}
  const z = await holeCover(['1', '2', '3', '4'], m, OPT, w)
  pruefe('423 in Folge: Pause von 10 Minuten statt Abbruch, danach weiter', spur.schlafe.includes(10 * 60_000) && z.neu === 2, [z, spur.schlafe])
  pruefe('Nichtauskunft wird nie vermerkt', m['1']?.grund === undefined, m['1'])
}
{
  const spur = neueSpur()
  const w = weltMit((a) => (a.includes('api.anisearch.com') ? apiAntwort({ 1: { large: url(1) }, 2: { large: url(2) }, 3: { large: url(3) } }) : new Response('', { status: 429 })), spur)
  const m: Manifest = {}
  const z = await holeCover(['1', '2', '3'], m, { ...OPT, ende: Date.parse('2026-10-11T12:05:00Z') }, w)
  pruefe('Reicht die Frist für die Pause nicht, endet der Lauf ohne Eintrag', z.neu === 0 && Object.keys(m).length === 0 && !spur.schlafe.includes(10 * 60_000), [z, spur.schlafe])
}
{
  const spur = neueSpur()
  const w = weltMit((a) => (a.includes('api.anisearch.com') ? apiAntwort({ 1: {}, 2: {}, 3: {} }) : bildAntwort()), spur)
  const m: Manifest = {}
  const z = await holeCover(['1', '2', '3'], m, OPT, w)
  pruefe('Ganzer Block ohne Bildadresse: Lauf endet, nichts vermerkt', Boolean(z.abgebrochen) && Object.keys(m).length === 0, z)
}
{
  const spur = neueSpur()
  const w = weltMit((a) => (a.includes('api.anisearch.com') ? apiAntwort({ 1: { large: url(1) } }) : new Response('', { status: 404 })), spur)
  const m: Manifest = {}
  await holeCover(['1'], m, OPT, w)
  pruefe('404 beim Bild ist eine Antwort: vermerkt', m['1']?.grund === 'nicht-gefunden', m['1'])
}

console.log('\nCover eigen: Umwandlung')
{
  const quelle = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#336699' } }).png().toBuffer()
  const webp = await sharp(quelle).resize({ width: 300, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer()
  const m = await sharp(webp).metadata()
  pruefe('600 px breites Bild wird WebP mit 300 px Breite', m.format === 'webp' && m.width === 300, m)
}

console.log('\nrobots.txt')
const SPERRE = 'User-agent: *\nDisallow: /r/\nDisallow: /images/\n'
const OFFEN = 'User-agent: *\nDisallow: /r/\nDisallow: /usercp/\n'
const datei = (www: string, cdn: string, s = 200): string => `### www.anisearch.de (HTTP 200) Stand x\n${www}\n### cdn.anisearch.de (HTTP ${s}) Stand x\n${cdn}\n`
pruefe('Pfad außerhalb der Sperren: erlaubt', pfadErlaubt(OFFEN, '/images/anime/cover/12/12345_300.webp'))
pruefe('Disallow /images/ für alle: gesperrt', !pfadErlaubt(SPERRE, '/images/anime/cover/12/12345_300.webp'))
pruefe('Allow länger als Disallow gewinnt', pfadErlaubt(`${SPERRE}Allow: /images/anime/cover/\n`, '/images/anime/cover/12/12345_300.webp'))
pruefe('Sperre nur für fremden Agenten gilt nicht für uns', pfadErlaubt('User-agent: GPTBot\nDisallow: /\n', '/images/anime/cover/1/1_300.webp'))
pruefe('Sperre für Mozilla-Kennung trifft uns', !pfadErlaubt('User-agent: Mozilla\nDisallow: /images/\n', '/images/anime/cover/1/1_300.webp'))
pruefe('beide Hosts frei: Lauf darf', coverFrei(datei(OFFEN, OFFEN)).frei)
pruefe('Sperre auf dem Bild-Host: Abbruch', !coverFrei(datei(OFFEN, SPERRE)).frei)
pruefe('Sperre auf www: Abbruch', !coverFrei(datei(SPERRE, OFFEN)).frei)
pruefe('404 auf robots.txt heißt keine Beschränkung', coverFrei(datei(OFFEN, '', 404)).frei)
pruefe('403 auf robots.txt: Abbruch', !coverFrei(datei(OFFEN, '', 403)).frei)
pruefe('fehlender Abschnitt: Abbruch', !coverFrei('').frei)
{
  const roh = await holeRobots((async (a: string | URL | Request) => new Response(`# ${String(a)}\nUser-agent: *\nDisallow: /r/\n`, { status: 200 })) as typeof fetch, new Date('2026-10-11T12:00:00Z'))
  pruefe('Alter der Datei nach dem ältesten Stand; ohne Stand unendlich', robotsAlterMs(datei('', '').replaceAll('Stand x', 'Stand 2026-10-11T10:00:00Z'), Date.parse('2026-10-11T12:00:00Z')) === 7_200_000 && robotsAlterMs(datei('', ''), 0) === Infinity)
pruefe('Abruf schreibt den Wortlaut je Host unverändert', roh.includes('### cdn.anisearch.de (HTTP 200)') && roh.includes('# https://www.anisearch.de/robots.txt\nUser-agent: *') && coverFrei(roh).frei, roh)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nCover eigen: alle Zusicherungen grün.')
