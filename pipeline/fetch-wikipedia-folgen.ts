/**
 * **Folgennummern und deutsche Erstausstrahlung aus den Episodenlisten der de.wikipedia**
 * (19.09.2026).
 *
 * Wofür: Das TV-Programm nennt nur Folgentitel. Ohne Nummer zählte `tv-termine.ts` die
 * gesichteten Titel als „Folge 1, 2 …" — bei Beyblade X stand dadurch „Erste Folge heute"
 * über einer Reihe mit 100 deutschen Folgen (Daniel, 19.09.2026). Mit der Episodenliste
 * wird aus „Durchbreche dein Limit! Goku meistert den Ultra-Instinkt!" die Folge 110.
 *
 * **Welche Titel:** nur die, die im TV-Programm gesichtet wurden (`data/tv-programm.json`) —
 * genau dort fehlt die Nummer. Gesucht wird je Titel über feste Seitennamen
 * (`<Name>/Episodenliste`, `<Name> (Anime)/Episodenliste`, `<Name>`, `<Name> (Anime)`),
 * nicht über die Suche.
 *
 * **Warum `/wiki/<Seite>?action=raw` und nicht die API:** Die robots.txt der Wikipedia
 * sperrt für alle Agenten `Disallow: /w/` und `Disallow: /api/` — also auch `api.php` und
 * die Suche (gelesen 19.09.2026). `/wiki/` ist frei, und `action=raw` liefert dort
 * denselben Wikitext. Ein Abruf je Seite und Tag, 1 s Abstand, erkennbarer User-Agent.
 *
 * **Lizenz:** Text der Wikipedia steht unter CC BY-SA 4.0. Übernommen werden Nummer,
 * Datum und der deutsche Folgentitel nur zum Abgleich; die Quelle steht am Termin.
 *
 * Ergebnis: `data/wikipedia-folgen.json` — je Titel die Seite und ihre Folgen.
 */
import { readJson, writeJson, log, warn } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { folgenAusTabellen, folgenAusWikitext, type WikiFolge } from './lib/wikipedia-folgen.ts'
import type { TvSendung } from './fetch-tv-programm.ts'

const UA = 'anime-kalender-de/1.0 (https://anime-kalender.de; ein Abruf je Seite und Tag)'
const ZIEL = 'data/wikipedia-folgen.json'

export type WikipediaFolgenDatei = {
  geholtAm: string
  titel: Record<string, { seite: string; folgen: WikiFolge[] }>
}

type Titel = { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string }

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))
const seitenAdresse = (seite: string) =>
  `https://de.wikipedia.org/wiki/${encodeURIComponent(seite.replace(/ /g, '_')).replace(/%2F/g, '/')}`

/** Wikitext einer Seite; folgt einer Weiterleitung. `null` = gibt es nicht. */
async function wikitext(seite: string, tiefe = 0): Promise<{ seite: string; text: string } | null> {
  const r = await fetch(`${seitenAdresse(seite)}?action=raw`, { headers: { 'User-Agent': UA } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`HTTP ${r.status} bei ${seite}`)
  const text = await r.text()
  const ziel = /^#(?:WEITERLEITUNG|REDIRECT)\s*\[\[([^\]#|]+)/i.exec(text.trim())?.[1]
  if (ziel && tiefe < 2) {
    await warte(1000)
    return wikitext(ziel.trim(), tiefe + 1)
  }
  return { seite, text }
}

const tv = readJson<{ sendungen?: Record<string, TvSendung> }>('data/tv-programm.json', {}).sendungen ?? {}
const titles = readJson<Titel[] | { titles: Titel[] }>('public/data/titles.json', [])
const jeId = new Map((Array.isArray(titles) ? titles : titles.titles).map((t) => [t.id, t]))

/* Je Titel die Namen, unter denen er gesucht wird: erst der des Senders, dann unsere. */
const namen = new Map<number, string[]>()
for (const s of Object.values(tv)) {
  const t = jeId.get(s.titleId)
  const liste = [s.titel, t?.titleDe, t?.titleEn, t?.titleRomaji].filter((x): x is string => Boolean(x))
  namen.set(s.titleId, [...new Set([...(namen.get(s.titleId) ?? []), ...liste])])
}

const alt = readJson<WikipediaFolgenDatei>(ZIEL, { geholtAm: '', titel: {} })
const ergebnis: WikipediaFolgenDatei = { geholtAm: new Date().toISOString(), titel: {} }
let fehler = 0
let abrufe = 0
for (const [id, liste] of namen) {
  const kandidaten = [
    ...(alt.titel[String(id)] ? [alt.titel[String(id)]!.seite] : []),
    ...liste.flatMap((n) => [`${n}/Episodenliste`, `${n} (Anime)/Episodenliste`, n, `${n} (Anime)`]),
  ]
  try {
    for (const k of [...new Set(kandidaten)]) {
      const w = await wikitext(k)
      abrufe++
      await warte(1000)
      /* Erst die Vorlagen, sonst die Tabellenform (Detektiv Conan). */
      const vorlagen = w ? folgenAusWikitext(w.text) : []
      const folgen = vorlagen.length || !w ? vorlagen : folgenAusTabellen(w.text)
      if (!w || !folgen.length) continue
      ergebnis.titel[String(id)] = { seite: w.seite, folgen }
      log(`Wikipedia ${w.seite}: ${folgen.length} Folge(n), ${folgen.filter((f) => f.ead).length} mit deutscher EA`)
      break
    }
  } catch (err) {
    fehler++
    warn(`Wikipedia (${liste[0]}): ${err instanceof Error ? err.message : String(err)}`)
    /* Eine Störung ist kein Befund — der Stand von gestern bleibt. */
    if (alt.titel[String(id)]) ergebnis.titel[String(id)] = alt.titel[String(id)]!
  }
}

writeJson(ZIEL, ergebnis, true)
recordSource(
  'wikipedia-folgen',
  Object.keys(ergebnis.titel).length,
  fehler ? `${fehler} Titel ohne Antwort` : undefined,
  abrufe,
  namen.size === 0,
)
log(`${namen.size} TV-Titel gefragt, ${Object.keys(ergebnis.titel).length} mit Episodenliste, ${abrufe} Abrufe → ${ZIEL}`)
