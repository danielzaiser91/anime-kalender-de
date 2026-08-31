/**
 * **Ein geschätzter Termin, an dem nichts erscheint, muss das sagen.**
 *
 * Bis zum 31.08.2026 verstrich eine Schätzung spurlos: Der Kalender zeigte
 * „Mushoku Tensei Staffel 3, Folge 6, 30.08." mit dem Näherungszeichen, die
 * deutsche Fassung kam nicht, und am nächsten Tag stand der Termin unverändert
 * da. Daniel: „warum hat der lauf diesen mis-stand nicht bemerkt und behoben?"
 *
 * Der Grund war eine Lücke, keine Fehlmessung: `scrape-crunchyroll.ts` hält
 * fest, was im Anbieter-Kalender **steht**. Ein fehlender Eintrag hinterlässt
 * dort nichts, und der Bau rechnet unbeirrt weiter — er liest nicht einmal das
 * `weeklyConfirmed`-Feld, das bei dieser Staffel ausdrücklich `false` sagt.
 *
 * Dieser Lauf schließt sie. Er vergleicht die geschätzten Termine mit dem, was
 * der Anbieter-Kalender wirklich gezeigt hat:
 *
 * - **Überfällig** (mehr als fünfzehn Minuten vorbei, keine Beobachtung): Der
 *   Termin wird als verpasst vermerkt. Er verschwindet nicht — er sagt jetzt,
 *   dass der Anbieter ihn nicht eingehalten hat, und wann wir das nächste Mal
 *   nachsehen. Daniel: „falsche infos auf der webseite sind unbedingt zu
 *   vermeiden."
 * - **Nachgeholt** (später doch eine Beobachtung): Der Eintrag bekommt das
 *   echte Datum und nennt den Verzug.
 *
 * **Nur im gelesenen Fenster.** `data/crunchyroll.json` trägt, welchen Zeitraum
 * der Scrape abgedeckt hat. Ein Termin davor hat keine Beobachtung, weil
 * niemand hingesehen hat — ihn als verpasst zu führen wäre eine Behauptung
 * über etwas Ungeprüftes.
 *
 * Was hier landet, gehört gelesen: `daniel-zum-abarbeiten/12-verpasste-termine.md`
 * listet die Fälle samt Feldern für die Handrecherche. Ein dort eingetragener
 * `neuErwartet` wird vom nächsten Lauf bestätigt oder verworfen.
 *
 * Aufruf: `tsx pipeline/termine-pruefen.ts [--jetzt 2026-08-31T18:00:00Z]`
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, readJson, ROOT, writeJson } from './lib/util.ts'

/** Fünfzehn Minuten Nachsicht — ein Anbieter stellt selten auf die Sekunde ein. */
const KARENZ_MS = 15 * 60 * 1000

const JETZT = new Date(
  /--jetzt[= ](\S+)/.exec(process.argv.join(' '))?.[1] ?? new Date().toISOString(),
)

interface Ereignis {
  id: string
  releaseSlug: string
  titleId: number
  name: string
  platform: string
  date: string
  time?: string
  episode?: number
  estimated?: boolean
}
interface Beobachtung {
  date: string
  episode?: number
}
interface Kalender {
  window?: { from?: string; to?: string }
  german?: Record<string, { seriesUrl?: string; observations?: Beobachtung[] }>
}

/**
 * Ein verpasster Termin, wie er in `data/termine-verpasst.json` steht.
 *
 * `neuErwartet` und `recherche` füllt ein Mensch — sie sind der Grund, warum
 * die Datei im Repo liegt und nicht nur im Kalender steht.
 */
export interface VerpassterTermin {
  id: string
  slug: string
  titleId: number
  name: string
  platform: string
  episode: number | null
  /** Der Termin, den wir angekündigt hatten. */
  erwartetAm: string
  /** Wann der Lauf gemerkt hat, dass nichts kam. */
  bemerktAm: string
  /** Wann die Folge wirklich kam — gefüllt, sobald der Anbieter sie zeigt. */
  erschienenAm: string | null
  /** Verzug in Stunden, sobald beides bekannt ist. */
  verzugStunden: number | null
  /** Wie viele Folgen der Anbieter zu diesem Zeitpunkt wirklich zeigte. */
  folgenVerfuegbar: number | null
  /** Von Hand: der neue erwartete Termin, wenn die Recherche einen ergibt. */
  neuErwartet: string | null
  /** Von Hand: was die Recherche ergeben hat, mit Quelle. */
  recherche: string | null
}

const ereignisse = readJson<Ereignis[]>('public/data/events.json', [])
const kalender = readJson<Kalender>('data/crunchyroll.json', {})
const verpasst = readJson<VerpassterTermin[]>('data/termine-verpasst.json', [])

/* Beobachtungen je Serienadresse — der Schlüssel, über den ein Termin bestätigt wird. */
const gesehen = new Map<string, Beobachtung[]>()
for (const eintrag of Object.values(kalender.german ?? {})) {
  if (!eintrag.seriesUrl) continue
  gesehen.set(eintrag.seriesUrl, [
    ...(gesehen.get(eintrag.seriesUrl) ?? []),
    ...(eintrag.observations ?? []),
  ])
}
/* Ein Ereignis kennt die Serienadresse nicht — die Veröffentlichung schon. */
const veroeffentlichungen = readJson<Array<{ slug: string; platformUrl?: string }>>(
  'public/data/releases.json',
  [],
)
const adresseJeSlug = new Map(veroeffentlichungen.map((r) => [r.slug, r.platformUrl]))

function beobachtungen(slug: string): Beobachtung[] {
  const adresse = adresseJeSlug.get(slug)
  return adresse ? (gesehen.get(adresse) ?? []) : []
}

function zeitpunkt(e: Ereignis): Date {
  return new Date(`${e.date}T${e.time ?? '00:00'}:00+02:00`)
}

/**
 * Wie viele Folgen der Anbieter zu dieser Serie wirklich zeigt.
 *
 * Steht im Kalender „Folge 6 kommt heute" und kam sie nicht, ist die nächste
 * Frage, wie weit die Staffel überhaupt ist. Die Zahl steht im Dub-Bestand, den
 * der Crunchyroll-Lauf schreibt.
 */
const dub = readJson<{
  serien?: Array<{
    url?: string
    seriesId?: string
    staffeln?: Array<{ deutscheFolgen?: Array<{ nummer: number }> }>
  }>
}>('data/crunchyroll-dub.json', {}).serien ?? []
function folgenBeimAnbieter(slug: string): number | null {
  const adresse = adresseJeSlug.get(slug)
  if (!adresse) return null
  const kennung = /\/series\/([A-Z0-9]+)/.exec(adresse)?.[1]
  const eintrag = dub.find((d) => (kennung ? d.seriesId === kennung : d.url === adresse))
  if (!eintrag) return null
  const zahlen = (eintrag.staffeln ?? []).flatMap((s) => (s.deutscheFolgen ?? []).map((f) => f.nummer))
  return zahlen.length ? Math.max(...zahlen) : null
}

const von = kalender.window?.from ?? '9999-12-31'
const bis = kalender.window?.to ?? '0000-01-01'
const bekannt = new Set(verpasst.map((v) => v.id))

let neu = 0
for (const e of ereignisse) {
  if (!e.estimated || bekannt.has(e.id)) continue
  /* Nur, wo wirklich hingesehen wurde — sonst ist „nichts gefunden" keine Auskunft. */
  if (e.date < von || e.date > bis) continue
  if (JETZT.getTime() - zeitpunkt(e).getTime() < KARENZ_MS) continue
  const treffer = beobachtungen(e.releaseSlug).some(
    (o) => o.date === e.date || (e.episode != null && o.episode === e.episode),
  )
  if (treffer) continue
  verpasst.push({
    id: e.id,
    slug: e.releaseSlug,
    titleId: e.titleId,
    name: e.name,
    platform: e.platform,
    episode: e.episode ?? null,
    erwartetAm: zeitpunkt(e).toISOString(),
    bemerktAm: JETZT.toISOString(),
    erschienenAm: null,
    verzugStunden: null,
    folgenVerfuegbar: folgenBeimAnbieter(e.releaseSlug),
    neuErwartet: null,
    recherche: null,
  })
  neu++
}

/* Nachgeholt: Steht die Folge inzwischen im Kalender, bekommt der Eintrag ihr Datum. */
let nachgeholt = 0
for (const v of verpasst) {
  if (v.erschienenAm) continue
  const treffer = beobachtungen(v.slug).find((o) => v.episode != null && o.episode === v.episode)
  if (!treffer) continue
  const wirklich = new Date(`${treffer.date}T00:00:00+02:00`)
  v.erschienenAm = wirklich.toISOString()
  v.verzugStunden = Math.round((wirklich.getTime() - new Date(v.erwartetAm).getTime()) / 36e5)
  nachgeholt++
}

writeJson('data/termine-verpasst.json', verpasst, true)

/* Die Arbeitsliste für die Handrecherche — offene Fälle zuerst. */
const offen = verpasst.filter((v) => !v.erschienenAm)
const zeilen = [
  '# Verpasste Termine',
  '',
  'Geschätzte Termine, an denen beim Anbieter nichts erschienen ist. Der Lauf trägt sie',
  'automatisch ein; auf der Seite steht danach, dass der Anbieter den Termin nicht eingehalten',
  'hat, und wann wir das nächste Mal nachsehen. Erscheint die Folge später doch, füllt er',
  '`erschienenAm` und nennt den Verzug.',
  '',
  '**Was von Hand dazugehört:** In `data/termine-verpasst.json` stehen je Eintrag die Felder',
  '`neuErwartet` und `recherche`. Wer nachsieht, warum sich etwas verschoben hat — Meldung des',
  'Anbieters, News-Seite, Social Media —, trägt den neuen Termin und die Quelle dort ein. Der',
  'nächste Lauf bestätigt ihn oder verwirft ihn.',
  '',
  `Stand: ${JETZT.toISOString().slice(0, 16).replace('T', ' ')} · ${offen.length} offen, ${verpasst.length - offen.length} nachgeholt`,
  '',
  '| Titel | Folge | erwartet | beim Anbieter | neu erwartet | Recherche |',
  '|---|---|---|---|---|---|',
  ...offen.map(
    (v) =>
      `| ${v.name} | ${v.episode ?? '—'} | ${v.erwartetAm.slice(0, 16).replace('T', ' ')} | ${v.folgenVerfuegbar ?? '?'} Folgen | ${v.neuErwartet ?? '—'} | ${v.recherche ?? '**offen**'} |`,
  ),
  '',
]
writeFileSync(resolve(ROOT, 'daniel-zum-abarbeiten/12-verpasste-termine.md'), zeilen.join('\n'))

log(
  `${neu} Termin(e) neu als verpasst vermerkt, ${nachgeholt} nachgeholt, ${offen.length} offen ` +
    `(Fenster ${von} bis ${bis})`,
)
