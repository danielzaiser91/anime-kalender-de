/**
 * **Das YouTube-Kaufangebot eines Films — direkt statt über TMDB** (22.09.2026).
 *
 * TMDB nennt für 100 Filme „YouTube" als Anbieter, aber keine Adresse; die Pille führte deshalb auf
 * TMDBs Übersicht („YouTube (über TMDB)"). Daniel am 22.09.2026: „im nächsten schritt fixen wir es
 * direkt, sodass korrekte direkte weiterleitung ohne (über tmdb) funktioniert".
 *
 * **Weg (PoC 22.09.2026, 8 Suchen):** YouTube Data API `search.list`, `type=video`, `regionCode=DE`,
 * Suchbegriff der deutsche Titel. Das Kauf-/Leihangebot ist ein Video des Kanals **„YouTube Movies"**
 * mit genau dem deutschen Titel — 7 von 8 genau (Chihiro, Der Junge und der Reiher, FF VII Advent
 * Children, 5 Centimeters per Second, Nausicaä, Totto-chan, Kaguya). Der achte (Cardcaptor Sakura:
 * The Movie - Die Reise nach Hongkong) hieß dort nur „Cardcaptor Sakura: The Movie": Er wird als
 * „ähnlich" festgehalten und **nicht** verlinkt.
 *
 * **Kontingent:** Eine Suche kostet 100 von 10.000 Einheiten am Tag; die übrigen YouTube-Läufe
 * (Trailer, Playlist-Prüfung) kommen mit Playlist- und `videos.list`-Aufrufen zu je einer Einheit aus.
 * Deshalb höchstens `--limit` Suchen je Lauf (Standard 30), die ältesten zuerst; ein Treffer wird
 * nach 90 Tagen, ein Fehlschlag nach 30 Tagen erneut gesucht.
 *
 * Ergebnis: `data/youtube-kauf.json` — je Titel `{ video, titel, geprueftAm }`, `{ aehnlich, … }`
 * oder `{ ohneTreffer: true, geprueftAm }`. `build.ts` setzt daraus die direkte Adresse.
 *
 * Aufruf: YOUTUBE_API_KEY=… npx tsx pipeline/fetch-youtube-kauf.ts [--limit 30]
 */
import type { Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'

const KEY = process.env.YOUTUBE_API_KEY ?? ''
const ZIEL = 'data/youtube-kauf.json'
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 30

export type YoutubeKauf = Record<
  string,
  { video?: string; titel?: string; aehnlich?: { video: string; titel: string }[]; ohneTreffer?: true; geprueftAm: string }
>

/** Titelkern zum Vergleich: Kleinbuchstaben, ohne Akzente und Satzzeichen. */
export function titelKern(s: string | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&amp;|&#39;|&quot;/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

const tageSeit = (tag: string) => (Date.parse(todayIso()) - Date.parse(tag)) / 86_400_000

async function main() {
  if (!KEY) {
    warn('YOUTUBE_API_KEY fehlt — nichts gesucht.')
    return
  }
  const roh = readJson<Title[] | { titles: Title[] }>('public/data/titles.json', [])
  const titel = Array.isArray(roh) ? roh : roh.titles
  const bestand = readJson<YoutubeKauf>(ZIEL, {})
  const offen = titel
    .filter((t) => t.format === 'MOVIE' && t.titleDe)
    .filter((t) => (t.watchLinks ?? []).some((w) => w.name === 'YouTube' && (w.ueberTmdb || /themoviedb\.org/.test(w.url))))
    .filter((t) => {
      const b = bestand[String(t.id)]
      if (!b) return true
      return tageSeit(b.geprueftAm) > (b.video ? 90 : 30)
    })
    .sort((a, b) => (bestand[String(a.id)]?.geprueftAm ?? '').localeCompare(bestand[String(b.id)]?.geprueftAm ?? ''))
    .slice(0, LIMIT)
  log(`${offen.length} Filme zu suchen (höchstens ${LIMIT} je Lauf)`)

  let genau = 0
  let aehnlich = 0
  for (const t of offen) {
    const url =
      'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&regionCode=DE&relevanceLanguage=de' +
      `&q=${encodeURIComponent(t.titleDe!)}&key=${KEY}`
    const r = await fetch(url)
    if (r.status === 403) {
      warn('Kontingent erschöpft oder Schlüssel gesperrt (403) — Lauf endet, nichts als Befund gespeichert.')
      break
    }
    if (!r.ok) {
      warn(`${t.id}: HTTP ${r.status} — übersprungen`)
      continue
    }
    const j = (await r.json()) as { items?: { id: { videoId?: string }; snippet: { title: string; channelTitle: string } }[] }
    const yM = (j.items ?? []).filter((i) => i.snippet.channelTitle === 'YouTube Movies' && i.id.videoId)
    const treffer = yM.find((i) => titelKern(i.snippet.title) === titelKern(t.titleDe))
    if (treffer) {
      bestand[String(t.id)] = { video: treffer.id.videoId, titel: treffer.snippet.title, geprueftAm: todayIso() }
      genau++
    } else if (yM.length) {
      bestand[String(t.id)] = {
        aehnlich: yM.slice(0, 3).map((i) => ({ video: i.id.videoId!, titel: i.snippet.title })),
        geprueftAm: todayIso(),
      }
      aehnlich++
    } else bestand[String(t.id)] = { ohneTreffer: true, geprueftAm: todayIso() }
    await sleep(300)
  }
  writeJson(ZIEL, bestand, true)
  log(`${genau} genau, ${aehnlich} nur ähnlich, ${offen.length - genau - aehnlich} ohne Treffer → ${ZIEL}`)
}

if (process.argv[1]?.endsWith('fetch-youtube-kauf.ts')) await main()
