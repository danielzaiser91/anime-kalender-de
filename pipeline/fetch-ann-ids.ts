/**
 * Holt die Zuordnung AniList-Kennung → Anime-News-Network-Kennung.
 *
 * **Warum wir diese Zuordnung brauchen:** ANNs Encyclopedia-API führt
 * Sprechrollen nach Sprache (`<cast lang="DE">`) und ist damit unsere zweite
 * Quelle für den Nachweis einer deutschen Synchronfassung. Sie kennt aber nur
 * ihre eigenen Kennungen; AniList kennt ANN nicht. Ohne Brücke bliebe nur
 * Titelraten, und wie gut das geht, hat der Anime2You-Abgleich gezeigt: 17 von
 * 24 bei exakter Schreibweise.
 *
 * **Warum aus dem Offline-Datensatz statt selbst gebaut:**
 * `manami-project/anime-offline-database` führt zu 41.537 Anime die Adressen
 * bei zehn Diensten und wird wöchentlich neu gebaut (ODbL + DbCL). Gemessen am
 * 15.08.2026: **2.756 unserer 2.758 Titel** sind darin enthalten, **2.112**
 * davon mit ANN-Kennung. Diese Zuordnung selbst zu pflegen wäre Arbeit an einem
 * Problem, das jemand anders bereits gelöst hat — und zwar besser, weil er
 * zehn Quellen abgleicht statt zwei.
 *
 * Die aniSearch-Kennungen aus derselben Datei bleiben ungenutzt: Unsere eigene
 * Zuordnung in `data/anime-ids.json` hat 15.265 Einträge und ist damit die
 * bessere.
 *
 * Aufruf: npm run data:ann:ids
 */
import { zstdDecompressSync } from 'node:zlib'
import { log, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const RELEASE_API = 'https://api.github.com/repos/manami-project/anime-offline-database/releases/latest'
const ASSET = 'anime-offline-database-minified.json.zst'

interface Eintrag {
  sources: string[]
}

/** Die Kennung aus einer Adresse ziehen — `null`, wenn der Dienst nicht dabei ist. */
function kennung(sources: string[], muster: RegExp): string | undefined {
  for (const url of sources) {
    const treffer = muster.exec(url)
    if (treffer) return treffer[1]
  }
  return undefined
}

async function main(): Promise<void> {
  const meta = (await (await fetch(RELEASE_API)).json()) as {
    tag_name?: string
    assets?: { name: string; browser_download_url: string }[]
  }
  const asset = meta.assets?.find((a) => a.name === ASSET)
  if (!asset) {
    warn(`Kein Asset "${ASSET}" im neuesten Release — Zuordnung bleibt auf dem letzten Stand.`)
    recordSource('anime-offline-database', 0, 'Asset nicht gefunden')
    return
  }
  log(`anime-offline-database ${meta.tag_name}: ${asset.name} wird geholt`)

  const roh = Buffer.from(await (await fetch(asset.browser_download_url)).arrayBuffer())
  /**
   * Zstandard, nicht gzip. Node kann das seit Version 22 selbst — deshalb
   * braucht es hier **keine** zusätzliche Abhängigkeit, und deshalb steht hier
   * dieser Satz: Der naheliegende Griff zu einem npm-Paket wäre unnötig.
   */
  const daten = JSON.parse(zstdDecompressSync(roh).toString('utf8')) as
    | { data: Eintrag[] }
    | Eintrag[]
  const eintraege = Array.isArray(daten) ? daten : daten.data

  const ann: Record<number, number> = {}
  const anidb: Record<number, number> = {}
  for (const e of eintraege) {
    const anilist = kennung(e.sources, /anilist\.co\/anime\/(\d+)/)
    if (!anilist) continue
    const a = kennung(e.sources, /animenewsnetwork\.com\/encyclopedia\/anime\.php\?id=(\d+)/)
    if (a) ann[Number(anilist)] = Number(a)
    const d = kennung(e.sources, /anidb\.net\/anime\/(\d+)/)
    if (d) anidb[Number(anilist)] = Number(d)
  }

  writeJson('data/ann-ids.json', {
    updatedAt: new Date().toISOString(),
    quelle: 'https://github.com/manami-project/anime-offline-database',
    lizenz: 'ODbL v1.0 + DbCL v1.0',
    release: meta.tag_name,
    ann,
    anidb,
  })
  log(`Zuordnung geschrieben: ${Object.keys(ann).length} ANN-, ${Object.keys(anidb).length} AniDB-Kennungen`)
  recordSource('anime-offline-database', Object.keys(ann).length)
}

await main()
