/**
 * Die Folgenlisten von aniSearch — deutsche Folgentitel als Zuordnungsanker.
 *
 * **Warum das gebraucht wird.** Jeder Anbieter sortiert anders. Prime führt
 * „Danganronpa 3" als eine durchlaufende Liste, in der unsere Folge 1 des
 * Despair Arc die Nummer 13 trägt; Crunchyroll vergibt Staffelnummern der Form
 * `S00095473`; Netflix zählt wieder anders. Daniel am 28.08.2026:
 *
 * > „die folgen heißen identisch überall (episodentitel). episodennummer etc
 * > können unterschiedlich sein, aber episodentitel und original release date
 * > zB nicht"
 *
 * Genau diese beiden Angaben stehen auf `anisearch.de/anime/<id>/episodes`, und
 * zwar **je Sprache getrennt** und nach Arc korrekt aufgeteilt. TMDB kennt nur
 * 594 unserer Titel, 50 davon mit Platzhaltern („Folge 1").
 *
 * **Gemessen am 29.08.2026** an Danganronpa (aniSearch 11301):
 *
 * ```
 * <tr data-episode="true" itemprop="episode">
 *   <th itemprop="episodeNumber"><b>1</b></th>
 *   <td>… <div class="grey" lang="ja">24 min</div> …</td>
 *   <td>… <div class="grey" lang="ja">14. Jul 2016</div> …</td>
 *   <td>… <span itemprop="name" lang="de">Willkommen auf der Hope’s Peak Academy</span></td>
 * </tr>
 * ```
 *
 * **Erlaubt.** Die robots.txt sperrt `/r/`, `/rr/`, `/redirect/`, `/usercp/`
 * und einen Bilderpfad — `/anime/<id>/episodes` steht dort nicht.
 *
 * **Der Takt ist derselbe wie beim Titel-Abruf**: sechs Sekunden zwischen zwei
 * Seiten. aniSearch gehört einer kleinen Redaktion, und jeder Abruf kostet dort
 * Last.
 *
 * Aufruf: `npm run data:anisearch-folgen [-- --limit 150] [-- --alter 90]`
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Title } from '../shared/types.ts'

const UA = 'anime-kalender.de/1.0 (+https://anime-kalender.de; danielzaiser91@googlemail.com)'
const DELAY_MS = 6000
const args = process.argv.slice(2)
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 150
/**
 * Wiedervorlage nach neunzig Tagen.
 *
 * Folgentitel ändern sich fast nie — aber „fast nie" ist nicht „nie": Bei einer
 * laufenden Staffel kommen Folgen dazu, und ein deutscher Titel wird manchmal
 * nachgetragen. Die Warteschlange läuft deshalb über das Alter, nicht über
 * „schon geholt" (siehe CLAUDE.md, „Ein Abruf, der nur ergänzt, veraltet
 * zwangsläufig").
 */
const MAX_AGE_DAYS = Number(args[args.indexOf('--alter') + 1]) || 90
const ARCHIV = 'data/anisearch-folgen-raw'
const ZIEL = 'data/anisearch-folgen.json'

/** Eine Folge, wie aniSearch sie führt. */
export interface AsFolge {
  /** Die Nummer **innerhalb dieses Eintrags** — bei uns wie dort ab 1. */
  nr: number
  /** Japanische Erstausstrahlung, ISO. Der Anker über Anbieter hinweg. */
  datum?: string
  minuten?: number
  /** Der deutsche Titel — der Anker, den kein Anbieter neu vergibt. */
  de?: string
  en?: string
  ja?: string
}

interface Eintrag {
  anisearchId: number
  folgen: AsFolge[]
  geholtAm: string
}

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * „14. Jul 2016" → „2016-07-14".
 *
 * aniSearch schreibt deutsche Monatskürzel. Ein Datum ohne Tag („Jul 2016")
 * kommt vor und wird verworfen — ein halbes Datum ist als Anker wertlos.
 */
const MONATE: Record<string, string> = {
  jan: '01', feb: '02', mär: '03', mar: '03', apr: '04', mai: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dez: '12',
}
export function alsIso(text: string): string | undefined {
  const t = (text ?? '').replace(/&nbsp;/g, ' ').trim()
  const m = /^(\d{1,2})\.\s*([A-Za-zÄäÖöÜü]{3,})\.?\s*(\d{4})$/.exec(t)
  if (!m) return undefined
  const monat = MONATE[m[2].slice(0, 3).toLowerCase()]
  if (!monat) return undefined
  return `${m[3]}-${monat}-${m[1].padStart(2, '0')}`
}

/**
 * Die Folgen aus der Seite lesen.
 *
 * Gearbeitet wird über die `itemprop`-Auszeichnungen, nicht über Klassennamen:
 * Sie sind schema.org und ändern sich mit dem Aussehen der Seite nicht.
 */
export function ausSeite(html: string): AsFolge[] {
  const folgen: AsFolge[] = []
  const zeilen = html.split('<tr data-episode="true"').slice(1)
  for (const roh of zeilen) {
    const zeile = roh.slice(0, roh.indexOf('</tr>') + 5)
    const nr = Number(/itemprop="episodeNumber"[^>]*>\s*<b>(\d+)/.exec(zeile)?.[1])
    if (!Number.isFinite(nr)) continue

    const titel: Record<string, string> = {}
    for (const t of zeile.matchAll(/<span itemprop="name" lang="(ja|en|de)"[^>]*>([\s\S]*?)<\/span>/g)) {
      const text = t[2].replace(/<[^>]*>/g, '').replace(/&#039;/g, "'").replace(/&amp;/g, '&').trim()
      if (text && text !== '&nbsp;') titel[t[1]] = text
    }

    /*
      Datum und Laufzeit stehen je Sprache; maßgeblich ist die japanische Spalte
      — sie trägt die Erstausstrahlung, die deutschen Spalten sind meist leer.
    */
    const datumZelle = /data-title="Veröffentlichung"([\s\S]*?)<\/td>/.exec(zeile)?.[1] ?? ''
    const datumJa = /lang="ja">([^<]*)</.exec(datumZelle)?.[1] ?? ''
    const minutenZelle = /data-title="Laufzeit"([\s\S]*?)<\/td>/.exec(zeile)?.[1] ?? ''
    const minuten = Number(/(\d+)\s*min/i.exec(minutenZelle)?.[1])

    folgen.push({
      nr,
      datum: alsIso(datumJa),
      minuten: Number.isFinite(minuten) ? minuten : undefined,
      de: titel.de,
      en: titel.en,
      ja: titel.ja,
    })
  }
  return folgen
}

function archiviere(id: number, html: string): void {
  if (!existsSync(ARCHIV)) mkdirSync(ARCHIV, { recursive: true })
  writeFileSync(resolve(ARCHIV, `${id}.html.gz`), gzipSync(html))
}

async function holeFolgen(id: number): Promise<AsFolge[] | undefined> {
  try {
    const res = await fetch(`https://www.anisearch.de/anime/${id}/episodes`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
      redirect: 'follow',
    })
    if (!res.ok) {
      warn(`aniSearch ${id}/episodes: HTTP ${res.status}`)
      return undefined
    }
    const html = await res.text()
    /* Erst archivieren, dann auswerten — ein Parserfehler kostet dann keinen
       zweiten Abruf. Dieselbe Regel wie beim Titel-Abruf. */
    archiviere(id, html)
    return ausSeite(html)
  } catch (e) {
    warn(`aniSearch ${id}/episodes: ${(e as Error).message}`)
    return undefined
  }
}

async function main(): Promise<void> {
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const zuordnung = readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {})
  const bestand = readJson<Record<string, Eintrag>>(ZIEL, {})

  const grenze = new Date(Date.now() - MAX_AGE_DAYS * 86400_000).toISOString()

  /*
    **Wer zuerst drankommt.** Titel mit Verweis stehen vorn: Für sie kommen
    Meldungen herein, und dort entscheidet die Zuordnung. Innerhalb dessen
    zuerst, was noch gar nichts hat.
  */
  const mitVerweis = new Set(titles.filter((t) => (t.streams ?? []).length > 0).map((t) => t.id))
  const queue = titles
    .map((t) => ({ t, asId: zuordnung[String(t.id)]?.anisearchId }))
    .filter((x): x is { t: Title; asId: number } => Number.isFinite(x.asId))
    .filter((x) => {
      const da = bestand[String(x.asId)]
      return !da || da.geholtAm < grenze
    })
    .sort((a, b) => {
      const v = Number(mitVerweis.has(b.t.id)) - Number(mitVerweis.has(a.t.id))
      if (v !== 0) return v
      return Number(Boolean(bestand[String(a.asId)])) - Number(Boolean(bestand[String(b.asId)]))
    })
    .slice(0, LIMIT)

  if (!queue.length) {
    log('aniSearch-Folgen: nichts nachzuladen.')
    recordSource('anisearch-folgen', Object.keys(bestand).length, undefined, 0)
    return
  }

  log(`aniSearch-Folgen: ${queue.length} Titel (${Object.keys(bestand).length} im Bestand)`)
  let geholt = 0
  let mitDeutsch = 0
  let folgenGesamt = 0

  for (const { t, asId } of queue) {
    const folgen = await holeFolgen(asId)
    await schlaf(DELAY_MS)
    if (!folgen) continue
    geholt++
    folgenGesamt += folgen.length
    const deutsche = folgen.filter((f) => f.de).length
    if (deutsche) mitDeutsch++
    bestand[String(asId)] = { anisearchId: asId, folgen, geholtAm: new Date().toISOString() }
    if (geholt % 25 === 0) {
      writeJson(ZIEL, bestand, true)
      log(`  ${geholt}/${queue.length} — zuletzt ${t.titleDe ?? t.titleEn}: ${folgen.length} Folgen`)
    }
  }

  writeJson(ZIEL, bestand, true)
  log(
    `aniSearch-Folgen: ${geholt} Titel geholt, ${folgenGesamt} Folgen, ` +
      `${mitDeutsch} mit deutschen Folgentiteln (Bestand ${Object.keys(bestand).length})`,
  )
  recordSource('anisearch-folgen', folgenGesamt, undefined, geholt)
}

await main()
