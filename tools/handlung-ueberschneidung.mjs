/**
 * Eigener Handlungstext gegen seine Quellen: meldet jede gemeinsame Wortfolge ab FENSTER Wörtern
 * (Kleinschreibung, Satzzeichen weg), Exit 1 bei Fund. Netz, deshalb nicht in check:vor-commit.
 *
 *   node tools/handlung-ueberschneidung.mjs <id>        ein Eintrag aus data/handlung-eigen.yaml
 *   node tools/handlung-ueberschneidung.mjs --alle      alle Einträge, ein Durchlauf, Pause je Anfrage
 *   node tools/handlung-ueberschneidung.mjs --datei <yaml> <id>   andere Fassung der Datei (z. B. alter Stand)
 *
 * aniSearch-Adressen werden nie abgerufen (übersprungen und gemeldet). Wikipedia: `?action=raw`
 * nach robots.txt-Prüfung, AniList: GraphQL `description`, sonst HTML ohne Tags.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { laengsteFolge, woerter } from './handlung-fakten/naehe.ts'
import { istErlaubt, pruefeRobots } from './handlung-fakten/robots.ts'
import { UA } from './handlung-fakten/typen.ts'
import { sauber } from './handlung-fakten/wikitext.ts'

export const FENSTER = 5
const PAUSE_MS = 1000

/** Gemeinsame Wortfolgen ab `fenster` Wörtern: je Quelle die längste samt Zahl der gemeinsamen Fenster. */
export function findeUeberschneidungen(text, quellen, fenster = FENSTER) {
  const eigen = woerter(text)
  const funde = []
  for (const q of quellen) {
    const fremd = woerter(q.text)
    const { len, folge } = laengsteFolge(eigen, fremd)
    if (len < fenster) continue
    funde.push({ quelle: q.name, laenge: len, folge })
  }
  return funde
}

export const istAniSearch = (url) => /(^|\/\/|\.)anisearch\.[a-z]+(\/|$)/i.test(url)

export function htmlZuText(html) {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;|&#0?39;|&rsquo;/g, "'")
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms))

async function hole(url, optionen = {}) {
  const res = await fetch(url, { ...optionen, headers: { 'User-Agent': UA, ...optionen.headers }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function wikipedia(url, regeln) {
  const u = new URL(url)
  const seite = u.pathname.replace(/^\/wiki\//, '')
  const pfad = `/wiki/${seite}?action=raw`
  if (!regeln[u.hostname] || !istErlaubt(regeln[u.hostname], pfad)) throw new Error('robots.txt sperrt den Abruf')
  return sauber(await hole(`https://${u.hostname}${pfad}`))
}

async function anilist(url) {
  const id = Number(/anilist\.co\/anime\/(\d+)/.exec(url)?.[1])
  const body = JSON.stringify({ query: 'query($id:Int){Media(id:$id){description(asHtml:false)}}', variables: { id } })
  const antwort = JSON.parse(await hole('https://graphql.anilist.co', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }))
  return htmlZuText(antwort.data?.Media?.description ?? '')
}

/** Text einer Quelle; wirft bei Fehler, damit der Aufrufer „nicht abrufbar“ melden kann. */
async function quellText(url, regeln) {
  if (/\.wikipedia\.org\/wiki\//.test(url)) return wikipedia(url, regeln)
  if (/anilist\.co\/anime\/\d+/.test(url)) return anilist(url)
  return htmlZuText(await hole(url))
}

export function ladeEintraege(pfad = 'data/handlung-eigen.yaml') {
  return parse(readFileSync(pfad, 'utf8')) ?? []
}

/** Prüft einen Eintrag; `holeText` ist austauschbar (Test ohne Netz). */
export async function pruefeEintrag(eintrag, holeText, wartezeit = pause) {
  const quellen = []
  const uebersprungen = []
  for (const q of eintrag.quellen ?? []) {
    if (istAniSearch(q.url)) {
      uebersprungen.push(`${q.name}: aniSearch wird nie abgerufen`)
      continue
    }
    try {
      quellen.push({ name: `${q.name} ${q.url}`, text: await holeText(q.url) })
    } catch (e) {
      uebersprungen.push(`${q.name}: nicht abrufbar (${e.message})`)
    }
    await wartezeit(PAUSE_MS)
  }
  return { id: eintrag.id, funde: findeUeberschneidungen(eintrag.text, quellen), uebersprungen }
}

function drucke(r) {
  console.log(`${r.funde.length ? 'FEHL' : 'OK  '} ${r.id}`)
  for (const f of r.funde) console.log(`    ${f.quelle}: ${f.laenge} Wörter gemeinsam „${f.folge}“`)
  for (const u of r.uebersprungen) console.log(`    übersprungen ${u}`)
}

async function main(argv) {
  const dateiIdx = argv.indexOf('--datei')
  const datei = dateiIdx >= 0 ? argv[dateiIdx + 1] : undefined
  const rest = argv.filter((a, i) => dateiIdx < 0 || (i !== dateiIdx && i !== dateiIdx + 1))
  const eintraege = ladeEintraege(datei)
  const gewaehlt = rest.includes('--alle') ? eintraege : eintraege.filter((e) => String(e.id) === rest[0])
  if (!gewaehlt.length) {
    console.log(`Kein Eintrag gewählt (Aufruf: <id> oder --alle)`)
    return 2
  }
  const regeln = await pruefeRobots()
  let fehl = 0
  for (const e of gewaehlt) {
    const r = await pruefeEintrag(e, (url) => quellText(url, regeln))
    drucke(r)
    if (r.funde.length) fehl++
  }
  console.log(`${gewaehlt.length - fehl} von ${gewaehlt.length} ohne gemeinsame ${FENSTER}-Wort-Folge`)
  return fehl ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await main(process.argv.slice(2))
  console.log(`ENDE ${code}`)
  process.exit(code)
}
