/**
 * **Anime2You automatisch vollständig lesen, Stufe P2: Claude wertet neue Artikel aus** (Termine, Anbieter, Sprachfassung, Sender).
 *
 * Zwei Aufrufe, beide aus `claude-anime2you-extraktion.yml`:
 *
 * - `--auswahl --verzeichnis <ordner>`: holt die Gesamt-Feeds, wählt die noch nicht gelesenen Artikel mit Deutschland-Bezug, legt je Artikel
 *   `artikel/<id>.txt` an (`ergebnis/` bleibt leer, Claude legt `ergebnis/<id>.json` neu an) und meldet `anzahl=<n>`. Bei null startet kein Claude.
 * - `--uebernehmen --verzeichnis <ordner>`: prüft jede Antwort gegen den Artikeltext (`lib/anime2you-vorschlag.ts`), hängt die bestandenen
 *   Vorschläge an `data/proposals/anime2you-extraktion.json` und schreibt `zusammenfassung.md` für den Pull Request.
 *
 * Claude darf nur Dateien in `ergebnis/` schreiben. Die Quelle eines Vorschlags setzt dieses Skript aus der Artikelkennung – nie das Modell.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseFeed } from './lib/feed.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { eingearbeiteteAdressen } from './lib/eingearbeitet.ts'
import { todayIso } from '../shared/time.ts'
import { artikelText, lohntLesung, neueKandidaten, type Kandidat } from './lib/anime2you-artikel.ts'
import { beschreibe, pruefeVorschlag } from './lib/anime2you-vorschlag.ts'
import { ergaenzeBestand, mitWiderspruechen, type Bestand, type GelesenerArtikel, type GespeicherterVorschlag } from './lib/anime2you-bestand.ts'
import { zusammenfassung, type Verworfen } from './lib/anime2you-bericht.ts'

const DATEI = 'data/proposals/anime2you-extraktion.json'
const UA = 'Mozilla/5.0 (compatible; anime-kalender.de/1.0; +https://anime-kalender.de)'
/** Der Gesamt-Feed führt rund zehn Artikel am Tag; zwei Seiten (50) fangen auch einen verpassten Lauf auf. */
const FEED_SEITEN = 2
/** Höchstens so viele Seiten holt ein Lauf, höchstens so viele gehen an Claude (Kosten, Züge im Abo). */
const HOECHSTENS_ABRUFE = 30
const HOECHSTENS_LESUNGEN = 20
const HOECHSTENS_JE_ARTIKEL = 15

interface Auswahl {
  kandidaten: Kandidat[]
  uebersprungen: { id: string; titel: string; grund: string }[]
}

async function hole(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) return await res.text()
    warn(`${url}: HTTP ${res.status}`)
  } catch (err) {
    warn(`${url}: ${(err as Error).message}`)
  }
  return undefined
}

async function feedArtikel(): Promise<ReturnType<typeof parseFeed>> {
  const alle: ReturnType<typeof parseFeed> = []
  for (let seite = 1; seite <= FEED_SEITEN; seite++) {
    const xml = await hole(`https://www.anime2you.de/feed/${seite > 1 ? `?paged=${seite}` : ''}`)
    if (xml) alle.push(...parseFeed(xml))
    await sleep(1200)
  }
  return alle
}

async function auswahl(ordner: string): Promise<void> {
  const bestand = readJson<Bestand>(DATEI, { gelesen: {}, vorschlaege: [] })
  const feed = await feedArtikel()
  if (!feed.length) throw new Error('Kein Artikel im Feed – Aufbau geändert oder Seite nicht erreichbar')
  const kandidaten = neueKandidaten(feed, new Set(Object.keys(bestand.gelesen)), eingearbeiteteAdressen(), HOECHSTENS_ABRUFE)
  const aus: Auswahl = { kandidaten: [], uebersprungen: [] }
  mkdirSync(resolve(ordner, 'artikel'), { recursive: true })
  mkdirSync(resolve(ordner, 'ergebnis'), { recursive: true })
  for (const k of kandidaten) {
    if (aus.kandidaten.length >= HOECHSTENS_LESUNGEN) break
    const html = await hole(k.url)
    await sleep(1500)
    const text = html ? artikelText(html) : ''
    if (!text) {
      warn(`Artikel ${k.id}: kein Text gelesen – morgen erneut`)
      continue
    }
    if (!lohntLesung(k.titel, text)) {
      aus.uebersprungen.push({ id: k.id, titel: k.titel, grund: 'kein Deutschland-Bezug' })
      continue
    }
    writeFileSync(resolve(ordner, 'artikel', `${k.id}.txt`), `${k.titel}\nVeröffentlicht: ${k.veroeffentlicht}\n\n${text}\n`, 'utf8')
    aus.kandidaten.push(k)
  }
  writeFileSync(resolve(ordner, 'auswahl.json'), JSON.stringify(aus, null, 2), 'utf8')
  log(`${aus.kandidaten.length} Artikel für Claude, ${aus.uebersprungen.length} übersprungen (von ${kandidaten.length} neuen)`)
  for (const k of aus.kandidaten) log(`  · ${k.id} ${k.veroeffentlicht} ${k.titel}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `anzahl=${aus.kandidaten.length}\n`)
}

interface Antwort {
  gelesen?: unknown
  vorschlaege?: unknown
}

/** Eine Antwortdatei lesen; undefined, wenn sie fehlt, kaputt ist oder Claude den Artikel nicht als gelesen gemeldet hat. */
function leseAntwort(pfad: string): unknown[] | undefined {
  if (!existsSync(pfad)) return undefined
  try {
    const a = JSON.parse(readFileSync(pfad, 'utf8')) as Antwort
    return a.gelesen === true && Array.isArray(a.vorschlaege) ? a.vorschlaege.slice(0, HOECHSTENS_JE_ARTIKEL) : undefined
  } catch {
    return undefined
  }
}

function uebernehmen(ordner: string): void {
  const heute = todayIso()
  const bestand = readJson<Bestand>(DATEI, { gelesen: {}, vorschlaege: [] })
  const plan = JSON.parse(readFileSync(resolve(ordner, 'auswahl.json'), 'utf8')) as Auswahl
  const gelesen: Record<string, GelesenerArtikel> = {}
  const neu: GespeicherterVorschlag[] = []
  const verworfen: Verworfen[] = []
  const ungelesen: string[] = []
  for (const u of plan.uebersprungen) gelesen[u.id] = { am: heute, vorschlaege: 0, uebersprungen: u.grund }
  for (const k of plan.kandidaten) {
    const antwort = leseAntwort(resolve(ordner, 'ergebnis', `${k.id}.json`))
    if (!antwort) {
      ungelesen.push(k.id)
      continue
    }
    const text = readFileSync(resolve(ordner, 'artikel', `${k.id}.txt`), 'utf8')
    for (const roh of antwort) {
      const geprueft = pruefeVorschlag(roh, { text, titel: k.titel, veroeffentlicht: k.veroeffentlicht })
      if ('grund' in geprueft) verworfen.push({ artikelId: k.id, titel: k.titel, vorschlag: beschreibe(roh), grund: geprueft.grund })
      else neu.push({ ...geprueft.ok, artikelId: k.id, artikel: k.titel, quelle: k.url, veroeffentlicht: k.veroeffentlicht, gelesenAm: heute })
    }
    gelesen[k.id] = { am: heute, vorschlaege: antwort.length }
  }
  const neuer = ergaenzeBestand(bestand, neu, gelesen, heute)
  writeJson(DATEI, { ...neuer, vorschlaege: mitWiderspruechen(neuer.vorschlaege) }, true)
  const md = zusammenfassung({ neu, verworfen, ungelesen, uebersprungen: plan.uebersprungen.length }, heute)
  writeFileSync(resolve(ordner, 'zusammenfassung.md'), md, 'utf8')
  log(md)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`)
  if (plan.kandidaten.length && ungelesen.length === plan.kandidaten.length) throw new Error('Claude hat keinen einzigen Artikel als gelesen gemeldet')
}

const args = process.argv.slice(2)
const ordner = /--verzeichnis[= ](\S+)/.exec(args.join(' '))?.[1]
if (!ordner || !(args.includes('--auswahl') || args.includes('--uebernehmen'))) {
  console.error('Aufruf: anime2you-extraktion.ts --auswahl|--uebernehmen --verzeichnis <ordner>')
  process.exit(1)
}
try {
  if (args.includes('--auswahl')) await auswahl(ordner)
  else uebernehmen(ordner)
} catch (err) {
  console.error(err)
  process.exit(1)
}
