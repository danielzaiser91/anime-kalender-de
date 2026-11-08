/**
 * Wachzeile „Synchro-Wartezeit“: führt der deutsche Crunchyroll-Katalog schon eine datierte Folge einer Staffel, deren einziger
 * Crunchyroll-Termin im ausgelieferten Datensatz `sprache: 'omu'` trägt, und steht seit 90 Minuten kein deutscher Termin daneben?
 * Anlass: Black Clover Staffel 2, 07.11.2026 — Folge 171 deutsch um 17:00, im Kalender erst um 21:39 (Bau rot, Rücknahmen).
 * Als „deutscher Termin“ zählt jeder Crunchyroll-Termin des Titels ohne `sprache`, auch der `-synchro`-Begleiter aus dem Bau.
 *
 * Block, Folgen und Berliner Tag kommen aus `tools/cr-katalogblock.mjs`, die Blockwahl aus `tools/cr-blockwahl.mjs` (auch ohne Zahl
 * im Blocknamen: einziger Block, Name, Folgenzahl), beides dieselben Dateien wie beim Begleiter. Nur die Staffelnummer
 * rechnet die Wache selbst (`staffelnummern`): der Bau nimmt sie aus Reihe und Beziehungsdateien (`katalogStaffeln`), die dieses
 * Skript im Job `abschluss` (ohne `npm ci`, 3 min) nicht lesen kann. Sie ist eine Teilmenge des Bau-Wegs: nur eine ausdrückliche
 * „Staffel n“/„Season n“ am Namensende oder ein Name ohne jede Staffelmarke an einer Serie, die kein anderer Titel teilt.
 * „Geteilt“ kennt die Wache nur aus den Crunchyroll-Terminen des Datensatzes, nicht aus allen Titeln des Baus.
 * Alles andere ist „Staffel unklar“ mit Grund und wird als eigene Zeile gezählt, nie als „kein Alarm“ verschwiegen.
 * Grenze der Untergrenze: Gesehen wird nur, wer schon einen OmU-Termin hat; eine Staffel ganz ohne Termin meldet `check:cr-termine`.
 * Nur Node-Bordmittel (laeufe-aufraeumen.mjs läuft in Workflows ohne `npm ci`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STAFFEL_IM_NAMEN, datierteFolgen, folgenAbOmuStart } from './cr-katalogblock.mjs'
import { blockWahl } from './cr-blockwahl.mjs'

export const SYNCHRO_GRENZE_MINUTEN = 90
const FRIST_MS = 30_000
const SERIE_IM_LINK = /\/series\/([A-Z0-9]+)/
/** Alles, was auf eine andere Zählung als „Staffel 1“ deutet: Zahl, Staffel/Season/Part/Cour/Specials, römische Ziffer. */
const ANDERE_ZAEHLUNG = /\d|\b(?:season|staffel|part|cour|teil|specials?|ova|oad|film|movie|ii+|iv|vi*|ix)\b/i

const serieVon = (release) => SERIE_IM_LINK.exec(release.platformUrl ?? '')?.[1]

/**
 * Die Katalogstaffeln, die zu diesem OmU-Termin gehören können, oder `null` (Staffel unklar):
 * ausdrückliche Nummer am Namensende; sonst Staffel 1, wenn der Name keine andere Zählung trägt und kein anderer Titel die Serie teilt.
 */
export function staffelnummern(omu, cr) {
  const ausdruecklich = STAFFEL_IM_NAMEN.exec(String(omu.name))?.[1]
  if (ausdruecklich) return [Number(ausdruecklich)]
  if (ANDERE_ZAEHLUNG.test(String(omu.name))) return null
  return teilenSerie(omu, cr) ? null : [1]
}

/** Führt ein Crunchyroll-Termin eines anderen Titels zur selben Serie? */
const teilenSerie = (omu, cr) => cr.some((r) => r.titleId !== omu.titleId && serieVon(r) === serieVon(omu))

/** Hat die Serie irgendwo (egal welcher Block) datierte deutsche Folgen ab dem Starttag? Dann ist „Staffel unklar“ eine Lücke. */
function serieHatFolgenAb(katalog, kennung, startTag) {
  return (katalog.serien ?? [])
    .filter((s) => kennung && s.katalog === 'de' && s.seriesId === kennung)
    .flatMap((s) => s.staffeln ?? [])
    .some((block) => folgenAbOmuStart(datierteFolgen(block), startTag).length > 0)
}

/** Was die Wache über den OmU-Termin weiß, damit `blockWahl` einen Block ohne Zahl im Namen finden kann. */
function blockTitel(omu, cr) {
  const zahl = omu.schedule.episodeCountAssumed ? undefined : omu.schedule.episodeCount
  const andereNamen = cr.filter((r) => r.titleId !== omu.titleId && serieVon(r) === serieVon(omu)).map((r) => String(r.name))
  return { nummern: staffelnummern(omu, cr) ?? [], namen: [String(omu.name)], andereNamen, folgen: zahl, geteilt: teilenSerie(omu, cr), ab: omu.schedule.firstEpisodeDate, nummernAusName: true }
}

/**
 * Früheste datierte deutsche Folge (ms) der Staffel ab dem OmU-Start, `undefined` ohne eine,
 * `{ unklar: Grund }` ohne zuordenbaren Block, obwohl die Serie Folgen ab dem Start führt.
 */
export function fruehesteDeutsche(katalog, omu, cr = []) {
  const kennung = serieVon(omu)
  const startTag = omu.schedule.firstEpisodeDate
  const wahl = kennung ? blockWahl(katalog.serien ?? [], kennung, blockTitel(omu, cr)) : { treffer: null, grund: 'keine Serienadresse' }
  if (!wahl.treffer) return serieHatFolgenAb(katalog, kennung, startTag) ? { unklar: wahl.grund } : undefined
  const folgen = folgenAbOmuStart(datierteFolgen(wahl.treffer.block), startTag)
  return folgen.length ? Math.min(...folgen.map((f) => f.ms)) : undefined
}

/** `{ wartende: [{ name, titleId, minuten }], unklar: [Name] }` der OmU-Termine ohne deutschen Termin. */
export function synchroWartende(katalog, releases, jetztMs, grenzeMinuten = SYNCHRO_GRENZE_MINUTEN) {
  const cr = releases.filter((r) => r.platform === 'crunchyroll')
  const raus = { wartende: [], unklar: [] }
  for (const omu of cr.filter((r) => r.sprache === 'omu')) {
    if (cr.some((r) => r.titleId === omu.titleId && r.sprache === undefined)) continue
    const seit = fruehesteDeutsche(katalog, omu, cr)
    if (seit?.unklar) raus.unklar.push(`${omu.name} (${seit.unklar})`)
    if (typeof seit !== 'number') continue
    const minuten = Math.floor((jetztMs - seit) / 60_000)
    if (minuten >= grenzeMinuten) raus.wartende.push({ name: omu.name, titleId: omu.titleId, minuten })
  }
  return raus
}

const HINWEIS = 'Der Begleiter legt den Termin nur mit Synchro-Beleg am Weg an (dub in streams) — fehlt er: Handbeleg oder Hand-Eintrag'

/** Wachzeilen; `holeJson(name)` liefert `'katalog'` oder `'releases'` als Objekt. Nicht lesbar ist selbst eine Zeile. */
export async function synchroWartezeitZeilen(holeJson, jetztMs) {
  try {
    const [katalog, releases] = await Promise.all([holeJson('katalog'), holeJson('releases')])
    const { wartende, unklar } = synchroWartende(katalog, releases, jetztMs)
    const zeilen = wartende.map(
      (w) => `ALARM Synchro-Wartezeit: ${w.name} (Titel ${w.titleId}) — deutsche Folge seit ${w.minuten} min im Katalog, kein deutscher Termin im Datensatz (Grenze ${SYNCHRO_GRENZE_MINUTEN} min). ${HINWEIS}`,
    )
    if (unklar.length) zeilen.push(`Synchro-Wartezeit: ${unklar.length} OmU-Termin(e) nicht prüfbar (Staffel unklar): ${unklar.join('; ')}`)
    return zeilen.length ? zeilen : [`Synchro-Wartezeit: kein Alarm (Grenze ${SYNCHRO_GRENZE_MINUTEN} min)`]
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
export async function holeSynchroJson(name, abruf = fetch, ordner = process.env.AK_SYNCHRO_QUELLE, fristMs = FRIST_MS) {
  if (ordner) return JSON.parse(readFileSync(join(ordner, `${name}.json`), 'utf8'))
  const antwort = await abruf(QUELLEN[name], { signal: AbortSignal.timeout(fristMs) })
  if (!antwort.ok) throw new Error(`${name}: HTTP ${antwort.status}`)
  return antwort.json()
}
