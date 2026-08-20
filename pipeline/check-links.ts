/**
 * Prüft, ob die Anbieter-Verweise überhaupt noch irgendwohin führen.
 *
 * Anlass war eine Stichprobe am 20.08.2026: Von 41 Verweisen zu Joyn und
 * Aniverse antworteten **18 mit 404** — bei Joyn 9 von 11, bei Aniverse 9 von
 * 30. Ein toter Verweis ist schlimmer als keiner: Er verspricht ein Angebot und
 * führt auf eine Fehlerseite.
 *
 * **Zwei Anbieter bleiben absichtlich außen vor.** Crunchyroll und ADN
 * beantworten jede Anfrage ohne Browser mit `403` — für sie ist ein solcher
 * Test kein Befund, sondern nur der Nachweis, dass wir kein Browser sind. Sie
 * hier trotzdem zu prüfen hieße, reihenweise gültige Verweise zu verwerfen.
 * (Bei ADN ist das ohne Belang: Dessen Bestand kommt ohnehin aus der offiziellen
 * Schnittstelle, die sauber antwortet.)
 *
 * **Zwei Befunde entfernen einen Verweis: ein hartes 404 — und Amazons Satz „In
 * deiner Region nicht mehr auf Prime Video verfügbar", der mit HTTP 200 kommt.**
 * Zeitüberschreitung, 403 und Netzfehler beweisen dagegen nichts über den
 * Verweis, sondern etwas über den Weg dorthin; sie ändern nichts. Das ist
 * derselbe Grundsatz wie überall hier: gestrichen wird nur, was eine Quelle
 * aktiv widerlegt.
 *
 * Aufruf: npx tsx pipeline/check-links.ts [--alter 30] [--limit 300]
 */
import { readFileSync } from 'node:fs'
import type { PlatformId, Title } from '../shared/types.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const DATEI = 'data/link-check.json'

/**
 * Anbieter, deren Antwort auf eine schlichte Anfrage etwas bedeutet.
 *
 * YouTube fehlt hier mit Absicht: Dafür gibt es `check-youtube.ts`, das die
 * offizielle Schnittstelle fragt und dabei auch die Ländersperre sieht — die
 * ein Seitenabruf gar nicht zeigen würde.
 */
const PRUEFBAR = new Set<PlatformId>(['netflix', 'primevideo', 'disneyplus', 'rtlplus', 'joyn', 'aniverse', 'wow'] as PlatformId[])

const args = process.argv.slice(2)
const zahl = (name: string, fallback: number) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const ALTER = zahl('--alter', 30)
const LIMIT = zahl('--limit', 0)

interface Befund {
  /** HTTP-Status, oder ein Wort, wenn es gar nicht erst dazu kam. */
  status: number | string
  geprueftAm: string
  /**
   * Ist diese Amazon-Seite ein **Prime-Video-Eintrag**?
   *
   * Der Unterschied entscheidet, ob die Adresse einen Suchlink ersetzen darf.
   * Amazon schreibt ihn in den Seitentitel: „Amazon.de: <Titel> ansehen | Prime
   * Video" steht über einem Video, über einer Disc steht er nicht. aniSearch
   * führt beide unter demselben Anbieternamen `amazon`, deshalb lässt sich das
   * nicht aus den Daten ableiten — nur an der Seite ablesen.
   */
  prime?: boolean
}

type Bestand = Record<string, Befund>

const heute = () => new Date().toISOString().slice(0, 10)

/**
 * Prime-Video-Seiten sagen „nicht verfügbar" mit HTTP **200**.
 *
 * Daniel öffnete am 20.08.2026 unseren Verweis auf Staffel 2 von „The Dangers in
 * My Heart" und fand dort: „In deiner Region nicht mehr auf Prime Video
 * verfügbar." Die Seite lädt tadellos, der Statuscode ist 200 — die reine
 * Statusprüfung sieht davon nichts.
 *
 * Deshalb wird bei Amazon-Video-Seiten der Text mitgelesen. Der Griff bleibt
 * eng: **eine** feste Wendung, kein Herumraten an verschlüsselten Klassennamen.
 * Daniels kopierter Selektor lautete `#dv-action-box > div > div > div > div >
 * div.FrkFbz > div.ZsR2Ti > div > button > span` — solche Namen wechseln mit
 * jedem Deploy, der Satz nicht.
 *
 * Erlaubt ist der Blick: Amazons robots.txt sperrt `/gp/video/api`, `/settings`,
 * `/library` und `/watchlist` — die Detailseite ausdrücklich **nicht**. Und es
 * ist derselbe Abruf wie bisher, nur dass die Antwort auch gelesen wird.
 */
const AMAZON_VIDEO = /amazon\.[a-z.]+\/(gp\/video\/detail|dp)\//i
const NICHT_IN_REGION = /In deiner Region nicht mehr auf Prime Video verfügbar/i

async function pruefe(url: string): Promise<Befund> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'anime-kalender.de/1.0 (+https://anime-kalender.de; danielzaiser91@googlemail.com)' },
    })
    if (res.ok && AMAZON_VIDEO.test(url)) {
      const text = await res.text()
      if (NICHT_IN_REGION.test(text)) return { status: 'region', geprueftAm: heute() }
      const titel = /<title>([^<]{0,160})/.exec(text)?.[1] ?? ''
      return { status: res.status, geprueftAm: heute(), prime: /\|\s*Prime Video/i.test(titel) }
    }
    return { status: res.status, geprueftAm: heute() }
  } catch (err) {
    return { status: (err as Error).name === 'TimeoutError' ? 'timeout' : 'fehler', geprueftAm: heute() }
  }
}

async function main(): Promise<void> {
  const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as unknown
  const titles = (Array.isArray(roh) ? roh : Object.values(roh as object).find(Array.isArray)) as Title[]

  const bestand = readJson<Bestand>(DATEI, {})

  /**
   * Vereinigung aus Datensatz und allem, was je geprüft wurde.
   *
   * Ein als tot erkannter Verweis verschwindet aus `titles.json` — käme die
   * Schlange allein von dort, wäre er nie wieder prüfbar und ein Falschbefund
   * für immer einer. Genau diesen Fehler hatte `check-youtube.ts` beim ersten
   * Anlauf am 20.08.2026.
   */
  const adressen = new Set<string>(Object.keys(bestand))
  for (const t of titles) {
    for (const s of t.streams ?? []) if (PRUEFBAR.has(s.platform)) adressen.add(s.url)
    /**
     * Auch die Amazon-Adressen aus `watchLinks` — sie sind der Ersatz für die
     * Suchlinks.
     *
     * Am 20.08.2026 waren **225 von 226** Prime-Verweisen bloße Suchen: AniList
     * liefert für die meisten Titel keinen Deeplink. Für 137 davon steht die
     * echte Adresse längst in unserem aniSearch-Bestand, nur unter dem
     * Anbieternamen `amazon`, der bei uns als Kauf gilt. Ob dahinter ein Video
     * oder eine Disc liegt, verrät erst der Seitentitel — also wird sie hier
     * mitgeprüft, und `build.ts` entscheidet danach.
     */
    for (const w of t.watchLinks ?? []) if (AMAZON_VIDEO.test(w.url)) adressen.add(w.url)
  }

  const grenze = new Date(Date.now() - ALTER * 86_400_000).toISOString().slice(0, 10)
  const offen = [...adressen].filter((u) => {
    const alt = bestand[u]
    return !alt || alt.geprueftAm < grenze
  })
  const arbeit = LIMIT > 0 ? offen.slice(0, LIMIT) : offen
  log(`Verweise: ${adressen.size} bekannt, ${offen.length} fällig, ${arbeit.length} in diesem Lauf.`)

  let tot = 0
  let geprueft = 0
  for (const url of arbeit) {
    bestand[url] = await pruefe(url)
    if (bestand[url].status === 404 || bestand[url].status === 'region') tot++
    if (++geprueft % 100 === 0) log(`  ${geprueft}/${arbeit.length} — ${tot} unbrauchbar`)
    await sleep(700)
  }

  writeJson(DATEI, bestand)
  const gesamtTot = Object.values(bestand).filter((b) => b.status === 404 || b.status === 'region').length
  log(`Verweise: ${geprueft} geprüft, ${tot} davon unbrauchbar. Im Bestand insgesamt ${gesamtTot} unbrauchbar.`)
  if (!geprueft && offen.length) warn('Nichts geprüft, obwohl etwas fällig war — Aufruf prüfen.')
  recordSource('link-check', geprueft, geprueft ? undefined : 'nichts fällig')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
