/**
 * **Folgen der RTL+-Serien, die im Fernsehen laufen** (19.09.2026).
 *
 * Anlass: Beyblade X lief am 19.09.2026 auf TOGGO plus mit „Wechseln oder auflösen" —
 * RTL+ führt das als Staffel 3 Folge 15, also Folge 115 unserer Zählung. Ohne Nummer
 * stand im Kalender „Erste Folge heute" (Daniel). Die Wikipedia hat für Beyblade X keine
 * Episodenliste; RTL+ selbst ist die Quelle (siehe `lib/rtlplus-folgen.ts`).
 *
 * **Welche Titel:** die im TV-Programm gesichteten mit RTL+-Verweis im Katalog
 * (`data/rtlplus-katalog.json`) und ohne Wikipedia-Liste.
 *
 * **Abrufe:** die Video-Sitemaps (rund 100 Teilkarten, zusammen ~170 MB), die Staffelseiten
 * der gefragten Serien und je Folge, die keine Staffelseite nennt, einmal die Folgenseite —
 * danach steht sie in `data/rtlplus-folgen.json` und wird nicht wieder geholt.
 * `plus.rtl.de/robots.txt`: `User-agent: *` / `Allow: /`, die Sitemaps bietet der
 * Betreiber selbst an (gelesen 19.09.2026). Deshalb nur wöchentlich.
 */
import { readJson, writeJson, log, warn } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import {
  durchzaehlen,
  folgeAusSeite,
  staffelEintraege,
  videosAusSitemap,
  zuordnen,
  type RtlFolge,
  type RtlVideo,
} from './lib/rtlplus-folgen.ts'
import type { TvSendung } from './fetch-tv-programm.ts'

const UA = 'anime-kalender-de/1.0 (https://anime-kalender.de; wöchentlicher Abgleich)'
const ZIEL = 'data/rtlplus-folgen.json'
const PAUSE = 400

export type RtlplusFolgenDatei = {
  geholtAm: string
  titel: Record<string, { programm: string; videos: RtlVideo[]; folgen: RtlFolge[] }>
}

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))
const hole = async (url: string) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`HTTP ${r.status} bei ${url}`)
  return r.text()
}

const tv = readJson<{ sendungen?: Record<string, TvSendung> }>('data/tv-programm.json', {}).sendungen ?? {}
const wiki = readJson<{ titel?: Record<string, unknown> }>('data/wikipedia-folgen.json', {}).titel ?? {}
const katalog = readJson<Record<string, { slug?: string }>>('data/rtlplus-katalog.json', {})

/* Programm-Slug → Titel-ID, nur für gesichtete Titel ohne Wikipedia-Liste. */
const programme = new Map<string, number>()
for (const id of new Set(Object.values(tv).map((s) => s.titleId))) {
  const slug = katalog[String(id)]?.slug
  if (slug && !wiki[String(id)]) programme.set(slug, id)
}

const alt = readJson<RtlplusFolgenDatei>(ZIEL, { geholtAm: '', titel: {} })
const ergebnis: RtlplusFolgenDatei = { geholtAm: new Date().toISOString(), titel: {} }
let abrufe = 0
let fehler = 0

if (programme.size) {
  /* 1. Alle Folgen der gefragten Serien aus den Video-Sitemaps — jede steht dort zweimal. */
  const videos = new Map<number, RtlVideo[]>()
  const schonDa = new Set<string>()
  const index = await hole('https://plus.rtl.de/videos.sitemap.xml')
  for (const teil of [...index.matchAll(/<loc>([^<]+)/g)].map((m) => m[1]!)) {
    try {
      for (const v of videosAusSitemap(await hole(teil), programme)) {
        if (schonDa.has(v.video)) continue
        schonDa.add(v.video)
        const { titleId, ...rest } = v
        videos.set(titleId, [...(videos.get(titleId) ?? []), rest])
      }
    } catch (err) {
      fehler++
      warn(`RTL+ ${teil}: ${err instanceof Error ? err.message : String(err)}`)
    }
    abrufe++
    await warte(PAUSE)
  }

  /* 2. Staffelseiten aus der Staffel-Sitemap. */
  const staffelIndex = await hole('https://plus.rtl.de/seasons.sitemap.xml')
  const staffelSeiten = new Map<string, string[]>()
  for (const teil of [...staffelIndex.matchAll(/<loc>([^<]+)/g)].map((m) => m[1]!)) {
    const xml = await hole(teil)
    abrufe++
    for (const m of xml.matchAll(/<loc>(https:\/\/plus\.rtl\.de\/([^/<]+)\/season-[^<]+)<\/loc>/g))
      if (programme.has(m[2]!)) staffelSeiten.set(m[2]!, [...(staffelSeiten.get(m[2]!) ?? []), m[1]!])
    await warte(PAUSE)
  }

  for (const [slug, id] of programme) {
    const liste = videos.get(id) ?? []
    const vorher = new Map((alt.titel[String(id)]?.videos ?? []).map((v) => [v.video, v]))
    /* Was eine frühere Folgenseite schon verraten hat, bleibt. */
    for (const v of liste) {
      const a = vorher.get(v.video)
      if (a?.staffel && a.folge) Object.assign(v, { staffel: a.staffel, folge: a.folge })
    }
    try {
      for (const seite of staffelSeiten.get(slug) ?? []) {
        zuordnen(liste, staffelEintraege(await hole(seite)))
        abrufe++
        await warte(PAUSE)
      }
      /* 3. Der Rest über die Folgenseite, je Folge einmal. */
      for (const v of liste.filter((x) => !x.staffel)) {
        const f = folgeAusSeite(await hole(`https://plus.rtl.de/${slug}/video/${v.video}`))
        abrufe++
        if (f) Object.assign(v, f)
        await warte(PAUSE)
      }
    } catch (err) {
      fehler++
      warn(`RTL+ ${slug}: ${err instanceof Error ? err.message : String(err)}`)
    }
    const folgen = durchzaehlen(liste)
    if (!liste.length && alt.titel[String(id)]) {
      /* Keine Adresse gefunden ist bei einer Störung kein Befund — der alte Stand bleibt. */
      ergebnis.titel[String(id)] = alt.titel[String(id)]!
      continue
    }
    ergebnis.titel[String(id)] = { programm: slug, videos: liste, folgen }
    log(`RTL+ ${slug}: ${liste.length} Folge(n), ${folgen.length} durchgezählt`)
  }
}

writeJson(ZIEL, ergebnis, true)
recordSource('rtlplus-folgen', Object.keys(ergebnis.titel).length, fehler ? `${fehler} Abruf(e) gescheitert` : undefined, abrufe, programme.size === 0)
log(`${programme.size} RTL+-Serie(n), ${abrufe} Abrufe → ${ZIEL}`)
