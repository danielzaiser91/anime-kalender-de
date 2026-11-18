// Anime2You-Belegsuche für die Synchro-Belegarbeit (Mängel-Blöcke 9b/10). Schreibt NIE in data/: Ausgabe ist JSON auf stdout,
// Bewertung und Eintragen bleiben Handarbeit.
//   node tools/anime2you-suche.mjs liste [--kanal <Wort>] [--datei <dub-confirmed.yaml>]
//       Titel mit Kanal-Titel-Warnung in dub-confirmed.yaml, bei denen keine Zeile eine zweiteQuelle trägt (--kanal z. B. aniverse).
//   node tools/anime2you-suche.mjs suche <Titel> [--seiten N] [--filter <Wort>]
//       WordPress-Schnittstelle /wp-json/wp/v2/posts?search= (robots.txt erlaubt sie, gelesen 18.11.2026, docs/wissen/quellen.md).
//   node tools/anime2you-suche.mjs artikel <URL|ID>...
//       Artikeltext mit Titelblöcken (»Titel«, Zeile „Sprache:“) und Sprachstellen.
// Abrufregeln wie pipeline/scrape-anime2you.ts: eigener generischer User-Agent, Pause zwischen Anfragen, bei 429/403 Pause und
// Wiederholung statt Abbruch; bleibt es dabei, steht die Stelle als Nichtauskunft („fehler“) in der Ausgabe, nie als „kein Treffer“.
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import yaml from 'js-yaml'

export const BASIS = 'https://www.anime2you.de'
export const UA = 'Mozilla/5.0 (compatible; anime-kalender.de/1.0; +https://anime-kalender.de)'
export const PAUSE_MS = 1500
export const SPERRE_PAUSEN_MS = [30000, 60000]
export const SEITEN_HOECHSTENS = 5
export const ARTIKEL_HOECHSTENS = 20
const SPRACHE = /sprache|synchron|deutsch|\bdub\b|\bOmU\b|\(UT\)/i

export function kanalTitelOhneZweite(eintraege, kanal = '') {
  const alle = new Map()
  const mit = new Set()
  for (const e of eintraege) {
    if (e.dub !== true || !/Kanal-Titel/.test(e.note || '')) continue
    if (kanal && !(e.note || '').toLowerCase().includes(kanal.toLowerCase())) continue
    if (!alle.has(e.anilistId)) alle.set(e.anilistId, { anilistId: e.anilistId, titel: e.title, abos: abosAus(e.note) })
  }
  for (const e of eintraege) if (e.zweiteQuelle && alle.has(e.anilistId)) mit.add(e.anilistId)
  return [...alle.values()].filter((t) => !mit.has(t.anilistId))
}

function abosAus(note) {
  return (/Abos:\s*(.+?)(?:,\s*(?:Seitenadresse|zugang)|\s+—|$)/.exec(note || '') || [])[1] || ''
}

export function sucheUrl(titel, seite = 1) {
  const q = encodeURIComponent(titel)
  return `${BASIS}/wp-json/wp/v2/posts?search=${q}&per_page=20&page=${seite}&_fields=id,link,title,date`
}

export function artikelId(eingabe) {
  const m = /^(\d+)$/.exec(eingabe) || /anime2you\.de\/[^?#]*?\/(\d{5,})(?:\/|$)/.exec(eingabe)
  return m ? m[1] : ''
}

export function artikelUrl(id) {
  return `${BASIS}/wp-json/wp/v2/posts/${id}?_fields=id,link,title,date,content`
}

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&#038;': '&', '&#8211;': '–', '&#8217;': '’', '&#8220;': '„', '&#8221;': '“', '&raquo;': '»', '&laquo;': '«', '&#187;': '»', '&#171;': '«' }

export function textZeilen(html) {
  const roh = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:#\d+|[a-z]+);/g, (e) => ENTITIES[e] ?? e)
  return roh.split('\n').map((s) => s.trim()).filter(Boolean)
}

const KOPF = /»([^«]+)«/

export function artikelBloecke(zeilen) {
  const bloecke = []
  for (let i = 0; i < zeilen.length; i++) {
    const m = KOPF.exec(zeilen[i])
    if (!m || zeilen[i].length > 170) continue
    let sprache = ''
    for (let j = i + 1; j < zeilen.length && j < i + 14; j++) {
      if (KOPF.test(zeilen[j]) && zeilen[j].length <= 170 && !/^Sprache/.test(zeilen[j])) break
      const s = /^Sprache:\s*(.+)$/.exec(zeilen[j])
      if (s) { sprache = s[1]; break }
    }
    bloecke.push({ kopf: zeilen[i], name: m[1], sprache })
  }
  return bloecke
}

export function sprachStellen(zeilen) {
  return zeilen.filter((z) => z.length <= 400 && SPRACHE.test(z)).slice(0, 40)
}

export function artikelAuszug(post) {
  const zeilen = textZeilen(post.content?.rendered || '')
  const datum = (post.date || '').slice(0, 10)
  return { id: post.id, url: post.link, titel: textZeilen(post.title?.rendered || '').join(' '), datum, bloecke: artikelBloecke(zeilen), sprachstellen: sprachStellen(zeilen) }
}

/** Holt JSON mit Wiederholung bei 429/403 (Pause statt Abbruch); liefert { daten } oder { fehler } als Nichtauskunft. */
export async function holeJson(url, { fetchFn, schlafen }) {
  let letzter = ''
  for (let versuch = 0; versuch <= SPERRE_PAUSEN_MS.length; versuch++) {
    let res
    try {
      res = await fetchFn(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) })
    } catch (e) {
      return { fehler: `Netz: ${e.message}` }
    }
    if (res.status === 429 || res.status === 403) {
      letzter = `HTTP ${res.status}`
      if (versuch < SPERRE_PAUSEN_MS.length) await schlafen(SPERRE_PAUSEN_MS[versuch])
      continue
    }
    if (!res.ok) return { fehler: `HTTP ${res.status}` }
    try {
      return { daten: await res.json() }
    } catch (e) {
      return { fehler: `Antwort kein JSON: ${e.message}` }
    }
  }
  return { fehler: `${letzter} nach ${SPERRE_PAUSEN_MS.length} Wiederholungen (Nichtauskunft, kein Befund)` }
}

export function optionen(args) {
  const opt = {}
  const rest = []
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]
    else rest.push(args[i])
  }
  return { opt, rest }
}

export async function suche(titel, { seiten, filter, fetchFn, schlafen }) {
  const treffer = []
  const fehler = []
  for (let p = 1; p <= seiten; p++) {
    const r = await holeJson(sucheUrl(titel, p), { fetchFn, schlafen })
    if (r.fehler) { fehler.push(`Seite ${p}: ${r.fehler}`); break }
    for (const x of r.daten) treffer.push({ id: x.id, url: x.link, titel: textZeilen(x.title?.rendered || '').join(' '), datum: (x.date || '').slice(0, 10) })
    if (r.daten.length < 20) break
    await schlafen(PAUSE_MS)
  }
  const gefiltert = filter ? treffer.filter((t) => (t.url + ' ' + t.titel).toLowerCase().includes(filter.toLowerCase())) : treffer
  return { suchbegriff: titel, treffer: gefiltert, fehler }
}

export async function artikel(eingaben, { fetchFn, schlafen }) {
  const ergebnis = []
  for (const eingabe of eingaben.slice(0, ARTIKEL_HOECHSTENS)) {
    const id = artikelId(eingabe)
    if (!id) { ergebnis.push({ eingabe, fehler: 'keine Artikelnummer in der Adresse' }); continue }
    const r = await holeJson(artikelUrl(id), { fetchFn, schlafen })
    ergebnis.push(r.fehler ? { eingabe, fehler: r.fehler } : artikelAuszug(r.daten))
    await schlafen(PAUSE_MS)
  }
  return ergebnis
}

export async function main(args, { fetchFn = fetch, schlafen = (ms) => new Promise((r) => setTimeout(r, ms)), schreibe = (s) => console.log(s) } = {}) {
  const [befehl, ...restArgs] = args
  const { opt, rest } = optionen(restArgs)
  let ausgabe
  if (befehl === 'liste') {
    const eintraege = yaml.load(fs.readFileSync(opt.datei || 'data/dub-confirmed.yaml', 'utf8'))
    const titel = kanalTitelOhneZweite(eintraege, opt.kanal || '')
    ausgabe = { kanal: opt.kanal || '', anzahl: titel.length, titel }
  } else if (befehl === 'suche' && rest.length) {
    const seiten = Math.min(Number(opt.seiten || 1), SEITEN_HOECHSTENS)
    ausgabe = await suche(rest.join(' '), { seiten, filter: opt.filter, fetchFn, schlafen })
  } else if (befehl === 'artikel' && rest.length) {
    ausgabe = await artikel(rest, { fetchFn, schlafen })
  } else {
    schreibe('Aufruf: anime2you-suche.mjs liste [--kanal W] | suche <Titel> [--seiten N] [--filter W] | artikel <URL|ID>...')
    return 2
  }
  schreibe(JSON.stringify(ausgabe, null, 1))
  const fehl = Array.isArray(ausgabe) ? ausgabe.some((a) => a.fehler) : Boolean(ausgabe.fehler?.length)
  return fehl ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)))
