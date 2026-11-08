/**
 * Wachzeile „Synchro-Wartezeit“: führt der deutsche Crunchyroll-Katalog schon eine datierte Folge einer Staffel, deren einziger
 * Crunchyroll-Termin im ausgelieferten Datensatz `sprache: 'omu'` trägt, und steht seit 90 Minuten kein deutscher Termin daneben?
 * Anlass: Black Clover Staffel 2, 07.11.2026 — Folge 171 deutsch um 17:00, im Kalender erst um 21:39 (Bau rot, Rücknahmen).
 * Als „deutscher Termin“ zählt jeder Crunchyroll-Termin des Titels ohne `sprache`, auch der `-synchro`-Begleiter aus dem Bau.
 * Grenze der Untergrenze: Gesehen wird nur, wer schon einen OmU-Termin hat; eine Staffel ganz ohne Termin meldet `check:cr-termine`.
 * Nur Node-Bordmittel (laeufe-aufraeumen.mjs läuft in Workflows ohne `npm ci`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SYNCHRO_GRENZE_MINUTEN = 90
const STAFFEL_AM_ENDE = /(?:staffel|season)\s+(\d+)\s*$/i
const SERIE_IM_LINK = /\/series\/([A-Z0-9]+)/

/** Staffelnummer am Ende eines Namens; ohne Zahl zählt Staffel 1 (eigene Serie). */
const staffelNr = (name) => Number(STAFFEL_AM_ENDE.exec(String(name))?.[1] ?? 1)

/** Früheste datierte deutsche Folge (ms) der passenden Staffel ab dem OmU-Start, `undefined` ohne eine. */
export function fruehesteDeutsche(katalog, omu) {
  const kennung = SERIE_IM_LINK.exec(omu.platformUrl ?? '')?.[1]
  const start = Date.parse(`${omu.schedule.firstEpisodeDate}T00:00:00Z`) - 2 * 3_600_000
  const nr = staffelNr(omu.name)
  const zeiten = (katalog.serien ?? [])
    .filter((s) => kennung && s.katalog === 'de' && s.seriesId === kennung)
    .flatMap((s) => s.staffeln ?? [])
    .filter((block) => STAFFEL_AM_ENDE.test(block.name) && staffelNr(block.name) === nr)
    .flatMap((block) => block.deutscheFolgen ?? [])
    .map((f) => Date.parse(f.verfuegbarAb))
    .filter((t) => t >= start)
  return zeiten.length ? Math.min(...zeiten) : undefined
}

/** `[{ name, titleId, minuten }]` der OmU-Termine ohne deutschen Termin, deren Katalogfolge älter als die Grenze ist. */
export function synchroWartende(katalog, releases, jetztMs, grenzeMinuten = SYNCHRO_GRENZE_MINUTEN) {
  const cr = releases.filter((r) => r.platform === 'crunchyroll')
  const wartende = []
  for (const omu of cr.filter((r) => r.sprache === 'omu')) {
    if (cr.some((r) => r.titleId === omu.titleId && r.sprache === undefined)) continue
    const seit = fruehesteDeutsche(katalog, omu)
    if (seit === undefined) continue
    const minuten = Math.floor((jetztMs - seit) / 60_000)
    if (minuten >= grenzeMinuten) wartende.push({ name: omu.name, titleId: omu.titleId, minuten })
  }
  return wartende
}

/** Wachzeilen; `holeJson(name)` liefert `'katalog'` oder `'releases'` als Objekt. Nicht lesbar ist selbst eine Zeile. */
export async function synchroWartezeitZeilen(holeJson, jetztMs) {
  try {
    const [katalog, releases] = [await holeJson('katalog'), await holeJson('releases')]
    const wartende = synchroWartende(katalog, releases, jetztMs)
    if (!wartende.length) return [`Synchro-Wartezeit: kein Alarm (Grenze ${SYNCHRO_GRENZE_MINUTEN} min)`]
    return wartende.map((w) => `ALARM Synchro-Wartezeit: ${w.name} (Titel ${w.titleId}) — deutsche Folge seit ${w.minuten} min im Katalog, kein deutscher Termin im Datensatz (Grenze ${SYNCHRO_GRENZE_MINUTEN} min)`)
  } catch (fehler) {
    return [`SYNCHRO? Wartezeit nicht lesbar: ${String(fehler.message).split('\n')[0]}`]
  }
}

const QUELLEN = {
  katalog: 'https://raw.githubusercontent.com/danielzaiser91/anime-kalender-de/main/data/crunchyroll-dub.json',
  releases: 'https://anime-kalender.de/data/releases.json',
}

/**
 * Abruf der beiden Dateien mit Frist (Katalog ~5 MB, gzip übertragen); Fehlstatus wirft.
 * `ordner` (Prozesstests, `AK_SYNCHRO_QUELLE`) liest `<ordner>/<name>.json` statt des Netzes.
 */
export async function holeSynchroJson(name, abruf = fetch, ordner = process.env.AK_SYNCHRO_QUELLE) {
  if (ordner) return JSON.parse(readFileSync(join(ordner, `${name}.json`), 'utf8'))
  const antwort = await abruf(QUELLEN[name], { signal: AbortSignal.timeout(30_000) })
  if (!antwort.ok) throw new Error(`${name}: HTTP ${antwort.status}`)
  return antwort.json()
}
