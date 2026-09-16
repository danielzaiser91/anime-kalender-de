/**
 * Sucht deutsche Werktitel bei Wikidata — für Titel, die bei uns keinen haben.
 *
 * **Warum eine dritte Quelle.** `titleDe` kommt bisher aus aniSearchs deutschem
 * Sprachblock und aus TMDB. Am 16.09.2026 blieben damit 132 Titel ohne
 * deutschen Namen, 57 davon mit **belegter deutscher Fassung** (Sprechrollen,
 * deutsche Erstausgabe oder ein Verweis mit `dub: true`) — die haben also einen
 * Namen, wir kennen ihn nur nicht. Gemessen:
 *
 * | Quelle | Ergebnis |
 * |---|---|
 * | aniSearch-Archiv (54 der 132 liegen dort) | 3 deutsche Sprachblöcke, **0 mit Namen** |
 * | TMDB `language=de-DE`, Stichprobe 15 | 0 echte Übersetzungen — es fällt auf den Originaltitel zurück |
 * | **Wikidata über die MAL-Kennung (P4086)** | **33 Treffer, 14 mit abweichendem Namen** |
 *
 * Wikidata trägt die MyAnimeList-Kennung als Eigenschaft, und die haben wir zu
 * jedem Titel. Eine einzige SPARQL-Abfrage beantwortet damit den ganzen Stapel.
 *
 * **Geschrieben wird ein Vorschlag, kein Titel.** Unter den Labels stehen drei
 * Sorten, und nur eine taugt:
 *
 *   „Sorcerer Hunters: Heiße Früchtchen zum Vernaschen"  — der deutsche Titel
 *   „Bakuman."                     zu „Bakuman. 3"       — der **Reihenkopf**
 *   „Marudukku sukuranburu: Nenshou"                     — eine Romanisierung
 *
 * Die beiden hinteren automatisch zu übernehmen hieße, einen falschen Namen zu
 * behaupten — und ein deutscher Name, unter dem niemand sucht, ist schlimmer
 * als keiner (belegt am 01.09.2026 mit „Yuu Gi Ou"). Die offensichtlichen Fälle
 * sortiert dieser Lauf aus, der Rest wird von Hand entschieden und landet in
 * `data/titel-de.yaml`.
 *
 * Aufruf: npx tsx pipeline/fetch-wikidata-titel.ts
 */
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Title } from '../shared/types.ts'

const UA = 'anime-kalender.de/1.0 (https://anime-kalender.de; Kalender deutscher Anime-Synchronfassungen)'
const ENDPUNKT = 'https://query.wikidata.org/sparql'
/** Wikidata verträgt große VALUES-Listen, aber eine Antwort soll lesbar bleiben. */
const JE_ABFRAGE = 200

export interface WikidataTitel {
  malId: number
  /** Das deutschsprachige Label des Werks, wie Wikidata es führt. */
  label?: string
  /** Der Titel des deutschen Wikipedia-Artikels, falls es einen gibt. */
  artikel?: string
  /** Warum der Lauf ihn nicht selbst übernimmt — leer heißt: er taugt als Vorschlag. */
  verworfen?: string
}

/**
 * **Ein Label, das im eigenen Titel steckt, ist der Reihenkopf — das umgekehrte nicht.**
 *
 * Die Richtung entscheidet, und der erste Anlauf am 16.09.2026 hatte sie falsch
 * herum: Er verwarf „Sorcerer Hunters: Heiße Früchtchen zum Vernaschen", weil
 * „Sorcerer Hunters" darin steckt — das ist aber genau der deutsche Verleihtitel,
 * der den Namen um seinen Untertitel **erweitert**.
 *
 * Verworfen wird deshalb nur das **kürzere** Label: „Bakuman." zu „Bakuman. 3"
 * ist der Reihenkopf, „Chapter 2 – Determination" zu „Digimon Adventure tri.
 * Chapter 2: Determination" ist der Name ohne seine Reihe. Beide behaupten für
 * diesen Titel etwas Falsches.
 */
export function istReihenkopf(label: string, titel: string[]): boolean {
  const kern = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const l = kern(label)
  if (!l) return true
  return titel.filter(Boolean).some((t) => {
    const k = kern(t)
    return k !== l && k.includes(l)
  })
}

/**
 * **Ein Schrägstrich macht aus einem Artikelnamen einen Pfad.**
 *
 * Die deutsche Wikipedia führt Staffeln als Unterseiten: „City Hunter/Staffel 4",
 * „MegaMan NT Warrior/Staffel 2", „Shakugan no Shana/Staffel 3". Als Werktitel
 * angezeigt stünde dort ein Dateipfad, und die Staffelnummer sagt der Bau
 * ohnehin selbst.
 */
export function istSeitenpfad(label: string): boolean {
  return label.includes('/')
}

/** Gleich dem englischen, romanisierten oder japanischen Namen — dann ist es keine Übersetzung. */
export function istDerselbe(label: string, titel: (string | undefined)[]): boolean {
  const kern = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return titel.filter(Boolean).some((t) => kern(t!) === kern(label))
}

async function frage(malIds: number[]): Promise<Map<number, { label?: string; artikel?: string }>> {
  const werte = malIds.map((id) => `"${id}"`).join(' ')
  const sparql = `SELECT ?mal ?labelDe ?artikel WHERE {
  VALUES ?mal { ${werte} }
  ?werk wdt:P4086 ?mal .
  OPTIONAL { ?werk rdfs:label ?labelDe . FILTER(LANG(?labelDe) = "de") }
  OPTIONAL { ?artikel schema:about ?werk ; schema:isPartOf <https://de.wikipedia.org/> }
}`
  const res = await fetch(`${ENDPUNKT}?format=json&query=${encodeURIComponent(sparql)}`, {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  })
  if (!res.ok) throw new Error(`Wikidata: HTTP ${res.status}`)
  const daten = (await res.json()) as {
    results: { bindings: { mal: { value: string }; labelDe?: { value: string }; artikel?: { value: string } }[] }
  }
  const treffer = new Map<number, { label?: string; artikel?: string }>()
  for (const zeile of daten.results.bindings) {
    const id = Number(zeile.mal.value)
    const artikel = zeile.artikel?.value
      ? decodeURIComponent(zeile.artikel.value.split('/wiki/')[1] ?? '').replace(/_/g, ' ')
      : undefined
    const vorhanden = treffer.get(id) ?? {}
    treffer.set(id, { label: zeile.labelDe?.value ?? vorhanden.label, artikel: artikel ?? vorhanden.artikel })
  }
  return treffer
}

async function main(): Promise<void> {
  const roh = readJson<Title[] | Record<string, Title>>('public/data/titles.json', [])
  const alle = Array.isArray(roh) ? roh : Object.values(roh)
  const offen = alle.filter((t) => !t.titleDe && t.malId)
  log(`${offen.length} Titel ohne deutschen Namen mit MAL-Kennung`)

  const gefunden: Record<string, WikidataTitel> = {}
  let brauchbar = 0
  for (let i = 0; i < offen.length; i += JE_ABFRAGE) {
    const teil = offen.slice(i, i + JE_ABFRAGE)
    let treffer: Map<number, { label?: string; artikel?: string }>
    try {
      treffer = await frage(teil.map((t) => t.malId!))
    } catch (err) {
      warn(`Abfrage fehlgeschlagen: ${(err as Error).message}`)
      continue
    }
    for (const titel of teil) {
      const eintrag = treffer.get(titel.malId!)
      if (!eintrag?.label && !eintrag?.artikel) continue
      const namen = [titel.titleEn, titel.titleRomaji, titel.titleNative]
      const label = eintrag.label ?? eintrag.artikel!
      const verworfen = istDerselbe(label, namen)
        ? 'gleich dem vorhandenen Namen'
        : istSeitenpfad(label)
          ? 'Wikipedia-Unterseite, kein Werktitel'
          : istReihenkopf(label, namen.filter(Boolean) as string[])
            ? 'Reihenkopf oder Name ohne seine Reihe'
            : undefined
      if (!verworfen) brauchbar++
      gefunden[titel.id] = { malId: titel.malId!, ...eintrag, ...(verworfen ? { verworfen } : {}) }
    }
    log(`  ${Math.min(i + JE_ABFRAGE, offen.length)}/${offen.length} abgefragt`)
  }

  writeJson('data/wikidata-titel.json', { geholtAm: new Date().toISOString(), titel: gefunden }, true)
  recordSource('wikidata-titel', Object.keys(gefunden).length, Object.keys(gefunden).length ? undefined : 'keine Treffer')
  log(`${Object.keys(gefunden).length} Treffer, davon ${brauchbar} als Vorschlag brauchbar → data/wikidata-titel.json`)

  const namenZu = new Map(alle.map((t) => [String(t.id), t.titleEn ?? t.titleRomaji ?? String(t.id)]))
  for (const [id, eintrag] of Object.entries(gefunden)) {
    if (eintrag.verworfen) continue
    log(`  · ${namenZu.get(id)} → ${eintrag.label ?? eintrag.artikel}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
