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
 * **Nur ein hartes 404 zählt.** Zeitüberschreitung, 403 und Netzfehler beweisen
 * nichts über den Verweis, sondern etwas über den Weg dorthin — sie ändern
 * nichts. Das ist derselbe Grundsatz wie überall hier: gestrichen wird nur, was
 * eine Quelle aktiv widerlegt.
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
}

type Bestand = Record<string, Befund>

const heute = () => new Date().toISOString().slice(0, 10)

async function pruefe(url: string): Promise<Befund> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'anime-kalender.de/1.0 (+https://anime-kalender.de; danielzaiser91@googlemail.com)' },
    })
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
    if (bestand[url].status === 404) tot++
    if (++geprueft % 100 === 0) log(`  ${geprueft}/${arbeit.length} — ${tot} tot`)
    await sleep(700)
  }

  writeJson(DATEI, bestand)
  const gesamtTot = Object.values(bestand).filter((b) => b.status === 404).length
  log(`Verweise: ${geprueft} geprüft, ${tot} davon tot. Im Bestand insgesamt ${gesamtTot} mit 404.`)
  if (!geprueft && offen.length) warn('Nichts geprüft, obwohl etwas fällig war — Aufruf prüfen.')
  recordSource('link-check', geprueft, geprueft ? undefined : 'nichts fällig')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
