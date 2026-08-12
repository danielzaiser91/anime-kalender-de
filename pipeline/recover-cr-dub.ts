/**
 * Rettet einen abgebrochenen Crunchyroll-Lauf aus seinem Protokoll.
 *
 * Anlass (12.08.2026): Der erste Volldurchlauf schrieb sein Ergebnis erst **am
 * Ende** in eine Datei. Beim Abbruch nach 579 von 918 Seiten wäre damit alles
 * verloren gewesen — anderthalb Stunden Last auf einem fremden Server, für
 * nichts. Die Zeilen des Protokolls tragen aber jede Auskunft, die auch in die
 * Datei gewandert wäre.
 *
 * Der Wiederaufsatz im Scraper selbst (`scrape-crunchyroll-dub.ts` schreibt
 * jetzt fortlaufend) macht dieses Skript für die Zukunft überflüssig. Es bleibt
 * als Werkzeug für genau diesen einen Fall — und als Erinnerung daran, dass ein
 * langer Lauf ohne Zwischenstand ein Lauf ohne Netz ist.
 *
 * Aufruf: npx tsx pipeline/recover-cr-dub.ts <protokoll>
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, readJson, ROOT, warn, writeJson } from './lib/util.ts'
import type { CrDubData, CrSerie, CrStaffel } from './lib/crunchyroll-dub.ts'
import type { Title } from '../shared/types.ts'

const datei = process.argv[2]
if (!datei) {
  console.error('Aufruf: npx tsx pipeline/recover-cr-dub.ts <protokoll>')
  process.exit(1)
}

const titles = readJson<Title[]>('public/data/titles.json', [])
const adressen = new Set<string>()
for (const t of titles) {
  for (const s of t.streams) if (s.platform === 'crunchyroll' && s.dub === undefined) adressen.add(s.url)
}

/** Wie der Scraper die Adresse fürs Protokoll kürzt. */
const kurzVon = (url: string) => url.replace(/^https?:\/\/(www\.)?crunchyroll\.com\/de\//, '').slice(0, 52)

const nachKurz = new Map<string, string[]>()
for (const url of adressen) {
  const k = kurzVon(url)
  nachKurz.set(k, [...(nachKurz.get(k) ?? []), url])
}

const heute = new Date().toISOString().slice(0, 10)
const serien: CrSerie[] = []
let ohneTreffer = 0

for (const zeile of readFileSync(resolve(ROOT, datei), 'utf8').split(/\r?\n/)) {
  const m = /^\[pipeline\]\s+\d+\/\d+ (—|🇩🇪) (.+)$/.exec(zeile)
  if (!m) continue
  const deutsch = m[1] === '🇩🇪'
  const rest = m[2]
  const klammer = rest.indexOf(' (')
  const kurz = klammer >= 0 ? rest.slice(0, klammer) : rest

  const urls = nachKurz.get(kurz)
  if (!urls?.length) {
    ohneTreffer++
    continue
  }

  let staffeln: CrStaffel[] | undefined
  if (deutsch && klammer >= 0) {
    // „Staffel 1: 24/24, Staffel 4: 15/17 [17 Kacheln]"
    staffeln = []
    for (const teil of rest.slice(klammer + 2, -1).split(', ')) {
      const s = /^(.*): (\d+)\/(\d+)(?: \[(\d+) Kacheln\])?$/.exec(teil)
      if (!s) continue
      staffeln.push({
        name: s[1],
        deutsch: Number(s[2]),
        folgen: Number(s[3]),
        kacheln: Number(s[4] ?? s[3]),
        fremd: 0,
      })
    }
    if (!staffeln.length) staffeln = undefined
  }

  /**
   * Mehrere Adressen können dieselbe Kurzform haben — meist `http://` und
   * `https://` derselben Seite. Sie zeigen auf dieselbe Seite, also gilt das
   * Ergebnis für alle. Das ist kein Raten, sondern dieselbe Auskunft.
   */
  for (const url of urls) {
    serien.push({ url, deutschImAngebot: deutsch, staffeln, geprueftAm: heute })
  }
}

if (ohneTreffer) warn(`${ohneTreffer} Protokollzeilen ließen sich keiner Adresse zuordnen`)
const vorhanden = readJson<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] })
const zusammen = new Map(vorhanden.serien.map((s) => [s.url, s]))
for (const s of serien) zusammen.set(s.url, s)

writeJson('data/crunchyroll-dub.json', { scrapedAt: new Date().toISOString(), serien: [...zusammen.values()] }, true)
log(`${serien.length} Seiten aus dem Protokoll gerettet, ${zusammen.size} insgesamt in data/crunchyroll-dub.json`)
log(`  davon ohne deutsche Tonspur: ${[...zusammen.values()].filter((s) => !s.deutschImAngebot).length}`)
