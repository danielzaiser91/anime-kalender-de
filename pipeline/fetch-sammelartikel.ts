/**
 * **Sammelartikel-Lauf im Vorschlagsmodus** (Fahrplan Schritte 6–7, `docs/wissen/sammelartikel-poc.md`).
 *
 * Liest Anime2You-Artikel, die seit dem letzten Stand neu oder geändert sind, macht daraus Aussagen
 * (`lib/aussagen-anime2you.ts`), ordnet sie dem Bestand zu und hält sie in `data/proposals/aussagen.json`
 * fest. **Schreibt nur diese Datei und `data/sammelartikel-stand.json`** — nie `data/curated/`, nie
 * `data/ankuendigungen.yaml`; die Übernahme ist ein getrennter Schritt nach einigen Wochen Auswertung.
 * Die Wochenwache (`tools/wache-woechentlich.mjs`) meldet „N neue Aussagen, davon M offen/unklar".
 *
 * Weg: REST `wp-json/wp/v2/posts?modified_after=<Stand>` (ein Aufruf bis 100 Artikel, mit Volltext). robots.txt
 * wird vor dem Abruf gelesen (`/wp-json/` muss erlaubt sein, sonst ruht der Lauf). Nicht erreichbar, gesperrt
 * (403/429) oder Zeitüberschreitung: **Pause statt Abbruch** (`pauseBis` im Stand), der Stand rückt nicht vor,
 * Exit 0. Antwortet die REST-Schnittstelle dauerhaft nicht, liest der Ausweichweg den Streaming-Feed
 * (die jüngsten 25 Meldungen) und holt deren Artikelseiten. Eine Nichtauskunft ist nie ein Befund.
 *
 * Aufruf: npx tsx pipeline/fetch-sammelartikel.ts [--seit <ISO>] [--ausweichweg] [--trocken]
 *   --seit         statt des gespeicherten Stands ab diesem Zeitpunkt lesen
 *   --ausweichweg  REST überspringen und den Feed-Weg nehmen (Test des Ausweichwegs)
 *   --trocken      nichts schreiben, nur berichten
 */
import { artikelZeilen } from './lib/sammelartikel.ts'
import { aussagenAusAnime2You } from './lib/aussagen-anime2you.ts'
import { ergebnisseZu, katalogLaden, releasesLaden } from './lib/aussagen-abgleich.ts'
import { parseFeed } from './lib/feed.ts'
import type { Aussage } from './lib/aussagen.ts'
import {
  ABGANG, STAND_DATEI, VORSCHLAG_DATEI, beschneide, fuehreZusammen, inPause, leseAb, pauseBis, robotsErlaubt, schreibeNurVorschlag, wachezeile,
  type Stand, type Vorschlag,
} from './lib/sammelartikel-lauf.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'

const UA = 'Mozilla/5.0 (compatible; anime-kalender.de/1.0; +https://anime-kalender.de)'
const BASIS = 'https://www.anime2you.de'
const REST = `${BASIS}/wp-json/wp/v2/posts`
const FEED = `${BASIS}/streaming-news/feed/`
const FORMAT = 2
const SEITE = 100
/** Höchstens so viele REST-Seiten je Lauf (Schutz vor einer Endlosschleife; 10 × 100 Artikel). */
const MAX_SEITEN = 10
const PAUSE_ZWISCHEN_MS = 1500
/** Ausweichweg: so viele Artikelseiten höchstens je Lauf. */
const MAX_AUSWEICH = 12

class Gesperrt extends Error {
  constructor(msg: string, readonly retryAfter?: number) { super(msg) }
}

interface Post {
  id: number
  link: string
  date: string
  modified: string
  modified_gmt: string
  title: { rendered: string }
  content: { rendered: string }
}

function entitaeten(s: string): string {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
}

/** Abruf mit drei Versuchen (5 s, 20 s Pause). 403/429 sind eine Sperre und werden nicht bedrängt. */
async function hole(url: string): Promise<Response> {
  let letzter = ''
  for (const warteMs of [0, 5000, 20000]) {
    if (warteMs) await sleep(warteMs)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json, text/html, */*' }, signal: AbortSignal.timeout(30_000) })
      if (res.status === 403 || res.status === 429) throw new Gesperrt(`HTTP ${res.status}`, Number(res.headers.get('retry-after')) || undefined)
      if (res.status < 500) return res
      letzter = `HTTP ${res.status}`
    } catch (err) {
      if (err instanceof Gesperrt) throw err
      letzter = (err as Error).message
    }
  }
  throw new Error(`${url}: ${letzter}`)
}

async function robotsOk(): Promise<boolean | undefined> {
  try {
    const res = await hole(`${BASIS}/robots.txt`)
    if (!res.ok) return undefined
    return robotsErlaubt(await res.text(), '/wp-json/wp/v2/posts')
  } catch (err) {
    if (err instanceof Gesperrt) throw err
    return undefined
  }
}

/** Ein Artikel → Aussagen. Nur Artikel in der Form eines Sammelartikels (mindestens zwei Köpfe mit Feldern) zählen. */
function aussagenAusArtikel(zeilenText: string, kopf: { url: string; veroeffentlicht: string; aktualisiert?: string; ueberschrift: string }): Aussage[] {
  if (ABGANG.test(kopf.ueberschrift)) return []
  const aussagen = aussagenAusAnime2You(zeilenText.split('\n').map((z) => z.trim()).filter(Boolean), kopf)
  return aussagen.length >= 2 ? aussagen : []
}

/** REST: alle Artikel, die seit `ab` neu oder geändert sind. Gibt die Aussagen und den jüngsten `modified_gmt` zurück. */
async function ueberRest(ab: string): Promise<{ aussagen: Aussage[]; artikel: number; sammel: number; jetzt?: string }> {
  const aussagen: Aussage[] = []
  let artikel = 0
  let sammel = 0
  let jetzt: string | undefined
  for (let seite = 1; seite <= MAX_SEITEN; seite++) {
    const url = `${REST}?modified_after=${encodeURIComponent(ab)}&per_page=${SEITE}&page=${seite}&_fields=id,link,date,modified,modified_gmt,title,content`
    const res = await hole(url)
    if (res.status === 400 && seite > 1) break // WordPress: Seite hinter dem Ende
    if (!res.ok) throw new Error(`REST: HTTP ${res.status}`)
    const posts = (await res.json()) as Post[]
    if (!Array.isArray(posts)) throw new Error('REST: keine Liste')
    for (const p of posts) {
      artikel++
      const a = aussagenAusArtikel(artikelZeilen(p.content.rendered), {
        url: p.link,
        veroeffentlicht: p.date.slice(0, 10),
        ...(p.modified.slice(0, 10) !== p.date.slice(0, 10) ? { aktualisiert: p.modified.slice(0, 10) } : {}),
        ueberschrift: entitaeten(p.title.rendered).replace(/[»«]/g, ''),
      })
      if (a.length) { sammel++; aussagen.push(...a); log(`  Sammelartikel (${a.length}): ${entitaeten(p.title.rendered)}`) }
      const gmt = `${p.modified_gmt}Z`
      if (!jetzt || gmt > jetzt) jetzt = gmt
    }
    log(`REST Seite ${seite}: ${posts.length} Artikel`)
    if (posts.length < SEITE) break
    await sleep(PAUSE_ZWISCHEN_MS)
  }
  return { aussagen, artikel, sammel, ...(jetzt ? { jetzt } : {}) }
}

/** Ausweichweg: die Meldungen des Streaming-Feeds seit `ab`, jede Artikelseite einzeln. */
async function ueberFeed(ab: string): Promise<{ aussagen: Aussage[]; artikel: number; sammel: number }> {
  const res = await hole(FEED)
  if (!res.ok) throw new Error(`Feed: HTTP ${res.status}`)
  const items = parseFeed(await res.text()).filter((i) => i.publishedAt >= ab.slice(0, 10)).slice(0, MAX_AUSWEICH)
  const aussagen: Aussage[] = []
  let sammel = 0
  for (const i of items) {
    await sleep(PAUSE_ZWISCHEN_MS)
    const seite = await hole(i.link)
    if (!seite.ok) { warn(`${i.link}: HTTP ${seite.status}`); continue }
    const a = aussagenAusArtikel(artikelZeilen(await seite.text()), { url: i.link, veroeffentlicht: i.publishedAt, ueberschrift: i.title })
    if (a.length) { sammel++; aussagen.push(...a) }
  }
  return { aussagen, artikel: items.length, sammel }
}

function schreibe(pfad: string, daten: unknown, trocken: boolean): void {
  schreibeNurVorschlag(pfad)
  if (!trocken) writeJson(pfad, daten, true)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const wert = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
  const trocken = args.includes('--trocken')
  const jetzt = new Date()
  const heute = jetzt.toISOString().slice(0, 10)
  const stand = readJson<Stand>(STAND_DATEI, {})
  const neuerStand = (s: Partial<Stand>): Stand => ({ ...stand, ...s, letzterLauf: jetzt.toISOString().replace(/\.\d+Z$/, 'Z') })

  if (inPause(stand, jetzt)) { log(`Pause bis ${stand.pauseBis} — kein Abruf.`); return }

  try {
    const ok = await robotsOk()
    if (ok === undefined) { warn('robots.txt nicht lesbar — kein Abruf in diesem Lauf (Nichtauskunft ist keine Erlaubnis).'); schreibe(STAND_DATEI, neuerStand({ letzterAusgang: 'robots' }), trocken); return }
    if (!ok) { warn('robots.txt sperrt /wp-json/ — kein Abruf.'); schreibe(STAND_DATEI, neuerStand({ letzterAusgang: 'robots', pauseBis: pauseBis(jetzt, 86_400) }), trocken); return }

    const ab = wert('--seit') ?? leseAb(stand, jetzt)
    log(`Lese Anime2You seit ${ab}`)
    let gelesen: Awaited<ReturnType<typeof ueberRest>> | (Awaited<ReturnType<typeof ueberFeed>> & { jetzt?: undefined })
    let ausgang = 'ok'
    try {
      if (args.includes('--ausweichweg')) throw new Error('Ausweichweg verlangt')
      gelesen = await ueberRest(ab)
    } catch (err) {
      if (err instanceof Gesperrt) throw err
      warn(`REST nicht lesbar (${(err as Error).message}) — Ausweichweg über den Feed.`)
      ausgang = 'ausweichweg'
      gelesen = await ueberFeed(ab)
    }

    const { katalog, titel } = katalogLaden()
    const ergebnisse = ergebnisseZu(gelesen.aussagen, katalog, titel, releasesLaden())
    const datei = readJson<{ format?: number; aussagen?: Vorschlag[] }>(VORSCHLAG_DATEI, {})
    const alt = datei.format === FORMAT ? datei.aussagen ?? [] : [] // die PoC-Fassung (ohne format) war eine Wegwerfausgabe
    const z = fuehreZusammen(alt, ergebnisse, heute)
    const liste = beschneide(z.liste, heute)
    log(`${gelesen.artikel} Artikel gelesen, ${gelesen.sammel} Sammelartikel, ${gelesen.aussagen.length} Aussagen: ${z.neu.length} neu, ${z.geaendert.length} geändert`)
    for (const v of [...z.neu, ...z.geaendert].filter((v) => v.offenOderUnklar)) {
      const e = v.ergebnis
      log(`  offen/unklar: »${e.titel}«${e.zusatz ? ` – ${e.zusatz}` : ''} (${e.deutsch}, Konfidenz ${e.konfidenz}) ${e.offen?.grund ?? e.zuordnung?.vorbehalt ?? ''}`)
    }
    schreibe(VORSCHLAG_DATEI, {
      format: FORMAT,
      stand: heute,
      hinweis: 'Vorschlagsmodus: nur gelesen, nie übernommen — docs/wissen/sammelartikel-poc.md (Abschnitt „Vorschlagslauf"). Schreiber: pipeline/fetch-sammelartikel.ts',
      aussagen: liste,
    }, trocken)
    // Der Feed-Weg kennt kein Änderungsdatum: dort rückt der Stand nicht vor (erneutes Lesen ist wegen der Kennung unschädlich).
    const { pauseBis: _weg, ...ohnePause } = stand
    schreibe(STAND_DATEI, neuerStand({ ...ohnePause, ...(gelesen.jetzt ? { stand: gelesen.jetzt } : {}), letzterAusgang: ausgang }), trocken)
    log(wachezeile(liste, heute).text)
  } catch (err) {
    // Sperre oder Zeitüberschreitung: Pause statt Abbruch. Der Stand bleibt, der nächste Lauf liest dasselbe Fenster.
    const gesperrt = err instanceof Gesperrt
    warn(`Sammelartikel-Lauf pausiert: ${(err as Error).message}`)
    schreibe(STAND_DATEI, neuerStand({ letzterAusgang: 'pause', pauseBis: pauseBis(jetzt, gesperrt ? (err as Gesperrt).retryAfter : 3600) }), trocken)
  }
}

main().catch((err) => { warn(`Sammelartikel-Lauf: ${(err as Error).message}`) })
