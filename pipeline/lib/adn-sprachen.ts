/**
 * Deutsche Synchro aus dem ADN-Archiv belegen — ohne einen einzigen neuen Abruf.
 *
 * ADN sagt die Sprache selbst, und zwar je Folge: `languages` trägt `vde` für
 * die deutsche Synchronfassung und `vostde` für den japanischen Ton mit
 * deutschen Untertiteln. Genau dieses Feld liegt seit dem 11.08.2026 in
 * `data/adn-raw/<serienId>.json.gz` — vollständig, weil `ladeSerie()` seitenweise
 * holt und `archiviereSerie()` die Antwort ungekürzt ablegt.
 *
 * Trotzdem trugen am 21.08.2026 **63 ADN-Verweise** kein Wort zur Sprache. Der
 * Grund ist keine fehlende Fähigkeit, sondern der Weg: Ein `dub: true` entstand
 * bisher nur dort, wo aus einer Serie auch ein **Release** wurde. Ein Verweis
 * ohne Termin — der Katalogtitel von 2010, der Film, die OVA — blieb bei „🇩🇪 ?",
 * obwohl die Antwort im eigenen Archiv lag.
 *
 * ## Warum das hier eine Ableitung bleibt und nicht in `dub-confirmed.yaml` darf
 *
 * `data/dub-confirmed.yaml` hält fest, was ein **Mensch nachgesehen** hat; es
 * schlägt deshalb jede Ableitung, auch ein automatisches `true`. Schriebe man
 * Archivbefunde dort hinein, hätten sie dieselbe Kraft wie Daniels Augen —
 * und die Datei könnte beides nicht mehr auseinanderhalten. Ein Archivbefund
 * ist stark, aber er ist maschinell und kann durch eine spätere Prüfung
 * korrigiert werden. Also läuft er, wie der Crunchyroll-Serienseiten-Befund
 * auch, als Ableitung im Build und rührt nur an, was noch `undefined` ist.
 *
 * ## Was als Beleg zählt
 *
 * Entscheidend ist, **worauf der Verweis zeigt** — nicht, was die Serie im
 * Ganzen anbietet. Eine ADN-Serienkennung ist ein Franchise, keine Staffel
 * (`444` führt vier JoJo-Staffeln, `1375` beide von Dorohedoro), und die
 * Sprachen unterscheiden sich zwischen ihnen: Bei Dorohedoro trägt Staffel 2
 * alle elf Folgen mit `vde`, Staffel 1 keine einzige ihrer dreizehn.
 *
 * Deshalb wird so eng ausgewertet, wie der Verweis es zulässt:
 *
 * - **Folgenverweis** (`…/1329-love-hina/29929-folge-26`) — die `languages`
 *   dieser einen Folge entscheiden. Fehlt `vde`, gilt das Nein nur dann, wenn
 *   auch keine andere Folge **derselben ADN-Staffel** eine deutsche Fassung
 *   hat; sonst wäre es eine Aussage über die Staffel, die die Folge nicht
 *   hergibt.
 * - **Staffelverweis** (`…/1375-dorohedoro?s=2`) — alle Folgen dieser Staffel
 *   mit `vde` heißt ja, keine einzige heißt nein.
 * - **Serienverweis** (`…/1069-cardcaptor-sakura`) — dieselbe Regel über alle
 *   Folgen der Serie.
 * - **Gemischt und ohne Anhaltspunkt, welche Staffel gemeint ist** — offen.
 *   Fünf JoJo-Verweise zeigen auf die nackte Serienseite, drei ADN-Staffeln
 *   sind deutsch und eine nicht; welche unser Eintrag meint, sagt der Verweis
 *   nicht. Raten wäre hier billig zu haben und genau deshalb falsch.
 *
 * `show.languages` aus derselben Antwort wird **nicht** ausgewertet: Das Feld
 * ist nicht serienweit gleich, sondern wechselt innerhalb einer Datei mit der
 * Folge (bei Serie 444 kommen `["vostde"]` und `["vde","vostde"]` nebeneinander
 * vor). Was je Folge steht, steht ohnehin schon je Folge.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { ROOT, warn } from './util.ts'

const ARCHIV_DIR = resolve(ROOT, 'data/adn-raw')

interface ArchivFolge {
  vde: boolean
  season: string | null
}

interface ArchivSerie {
  showId: string
  /** Namensteil der ADN-Adresse, z. B. `love-hina` — der Schlüssel für alte Verweise ohne Kennung. */
  slug?: string
  folgen: Map<string, ArchivFolge>
}

export interface AdnArchiv {
  serien: Map<string, ArchivSerie>
  /** Folgenkennung → Serienkennung. Alte Adressen tragen die Serie nicht im Pfad. */
  folgeZuSerie: Map<string, string>
  /** Namensteil → Serienkennungen. Mehrdeutige bleiben stehen und werden nicht benutzt. */
  slugZuSerie: Map<string, string[]>
  /** Nur für den Bericht: wie viele Folgen das Archiv hält und wie viele davon deutsch sind. */
  folgenGesamt: number
  folgenMitVde: number
}

/** Wie sicher der Befund zustande kam — steht so im Bauprotokoll. */
export type AdnBefundArt =
  | 'folge'
  | 'staffel'
  | 'serie'
  | 'gemischt'
  | 'folge-fehlt'
  | 'serie-fehlt'
  | 'nicht-zuzuordnen'

export interface AdnBefund {
  /** Fehlt, wenn das Archiv die Frage nicht beantwortet — dann bleibt „🇩🇪 ?" stehen. */
  dub?: boolean
  art: AdnBefundArt
  /** Serienkennung, soweit ermittelt. Für die Liste der Lücken im Archiv. */
  showId?: string
  grund: string
}

export function leeresArchiv(): AdnArchiv {
  return {
    serien: new Map(),
    folgeZuSerie: new Map(),
    slugZuSerie: new Map(),
    folgenGesamt: 0,
    folgenMitVde: 0,
  }
}

/** Nimmt die Folgenliste einer Serie in den Bestand — aus einer Datei oder aus einem Prüffall. */
export function nimmSerieAuf(archiv: AdnArchiv, showId: string, videos: AdnRohVideo[]): void {
  const serie: ArchivSerie = { showId, folgen: new Map() }
  for (const video of videos) {
    if (video?.id === undefined) continue
    const id = String(video.id)
    serie.folgen.set(id, {
      vde: (video.languages ?? []).includes('vde'),
      season: video.season ?? null,
    })
    archiv.folgeZuSerie.set(id, showId)
    if (!serie.slug) serie.slug = slugAus(video.show?.url)
  }
  if (!serie.folgen.size) return
  archiv.serien.set(showId, serie)
  for (const folge of serie.folgen.values()) {
    archiv.folgenGesamt++
    if (folge.vde) archiv.folgenMitVde++
  }
  if (serie.slug) {
    const liste = archiv.slugZuSerie.get(serie.slug) ?? []
    liste.push(showId)
    archiv.slugZuSerie.set(serie.slug, liste)
  }
}

/**
 * Liest das Archiv einmal ein.
 *
 * 241 Dateien zu je rund 5 KB, entpackt in weniger als einer Sekunde — billiger
 * als eine Zwischendatei, die zwangsläufig veraltet, sobald der Montagslauf das
 * Archiv erweitert. Die Quelle liegt im Repo, also ist der Befund immer so
 * aktuell wie der letzte Abruf, und ein Nein von heute kann nächste Woche
 * wieder ein Ja werden, ohne dass jemand eine Warteschlange aufräumen muss.
 */
export function ladeAdnArchiv(): AdnArchiv {
  const archiv = leeresArchiv()
  if (!existsSync(ARCHIV_DIR)) return archiv

  for (const datei of readdirSync(ARCHIV_DIR)) {
    if (!datei.endsWith('.json.gz')) continue
    let roh: { showId?: number; videos?: AdnRohVideo[] }
    try {
      roh = JSON.parse(gunzipSync(readFileSync(`${ARCHIV_DIR}/${datei}`)).toString())
    } catch {
      // Eine kaputte Datei ist kein Grund, den Bau abzubrechen: Der nächste
      // Abruf schreibt sie neu, und bis dahin ist die Antwort eben „unbekannt".
      warn(`ADN-Archiv: ${datei} ist nicht lesbar — übersprungen.`)
      continue
    }
    nimmSerieAuf(archiv, String(roh.showId ?? datei.replace('.json.gz', '')), roh.videos ?? [])
  }
  return archiv
}

export interface AdnRohVideo {
  id?: number
  languages?: string[]
  season?: string | null
  show?: { url?: string }
}

/** `https://…/de/video/1329-love-hina` → `love-hina`. */
function slugAus(url: string | undefined): string | undefined {
  const treffer = (url ?? '').match(/\/video\/(?:\d+-)?([^/?#]+)/)
  return treffer?.[1]
}

interface AdnAdresse {
  showId?: string
  slug?: string
  videoId?: string
  season?: string
}

/**
 * Zerlegt eine ADN-Adresse in das, was sie über Serie, Staffel und Folge sagt.
 *
 * Fünf Formen kommen im Bestand vor, und nur die neuen tragen die Kennung:
 *
 *   animationdigitalnetwork.com/de/video/1329-love-hina/29929-folge-26
 *   animationdigitalnetwork.com/de/video/1069-cardcaptor-sakura
 *   animationdigitalnetwork.com/de/video/438
 *   animationdigitalnetwork.de/video/clannad/12851-folge-24-das-tomoyo-kapitel
 *   animationdigitalnetwork.de/video/one-piece-le-film
 *
 * Die Ziffernvorsilbe gilt deshalb **nur** unter `/de/video/`. Unter der alten
 * Adresse `animationdigitalnetwork.de/video/` steht dort ein Name, und
 * `50-nuances-de-gras` („Plus-Sized Elf" auf Französisch) wäre sonst die Serie
 * mit der Kennung 50.
 */
export function zerlegeAdnAdresse(url: string): AdnAdresse {
  let pfad: string
  let season: string | undefined
  try {
    const adresse = new URL(url)
    pfad = adresse.pathname
    season = adresse.searchParams.get('s') ?? undefined
  } catch {
    return {}
  }
  const mitKennung = pfad.startsWith('/de/video/')
  const teile = pfad.replace(/^\/de/, '').replace(/^\/video\/?/, '').split('/').filter(Boolean)
  const aus: AdnAdresse = { season }
  if (teile[0]) {
    const kennung = mitKennung ? teile[0].match(/^(\d+)(?:-(.*))?$/) : null
    if (kennung) {
      aus.showId = kennung[1]
      aus.slug = kennung[2] || undefined
    } else {
      aus.slug = teile[0]
    }
  }
  if (teile[1]) {
    const folge = teile[1].match(/^(\d+)/)
    if (folge) aus.videoId = folge[1]
  }
  return aus
}

/**
 * Was das Archiv zu diesem einen Verweis sagt.
 *
 * Ein `false` ist hier so wertvoll wie ein `true` — aber nur, weil es aus
 * derselben Auskunft stammt: ADN nennt zu jeder Folge, in welchen Sprachen sie
 * vorliegt. Fehlt die Folge oder die Serie im Archiv, ist die Antwort
 * „unbekannt" und nicht „nein".
 */
export function beurteileAdnVerweis(url: string, archiv: AdnArchiv): AdnBefund {
  const adresse = zerlegeAdnAdresse(url)

  let showId = adresse.showId && archiv.serien.has(adresse.showId) ? adresse.showId : undefined
  if (!showId && adresse.videoId) showId = archiv.folgeZuSerie.get(adresse.videoId)
  if (!showId && adresse.slug) {
    const treffer = archiv.slugZuSerie.get(adresse.slug)
    // Bei zwei Serien mit demselben Namensteil wäre die Zuordnung geraten.
    if (treffer?.length === 1) showId = treffer[0]
  }
  if (!showId) {
    return adresse.showId
      ? { art: 'serie-fehlt', showId: adresse.showId, grund: `Serie ${adresse.showId} nicht im Archiv` }
      : { art: 'nicht-zuzuordnen', grund: `keine Serienkennung in der Adresse (${adresse.slug ?? url})` }
  }

  const serie = archiv.serien.get(showId)!
  const alle = [...serie.folgen.values()]

  if (adresse.videoId) {
    const folge = serie.folgen.get(adresse.videoId)
    if (!folge) return { art: 'folge-fehlt', showId, grund: `Folge ${adresse.videoId} nicht im Archiv von ${showId}` }
    if (folge.vde) return { dub: true, art: 'folge', showId, grund: `Folge ${adresse.videoId} führt vde` }
    const staffel = alle.filter((f) => f.season === folge.season)
    if (staffel.some((f) => f.vde))
      return { art: 'gemischt', showId, grund: `Folge ${adresse.videoId} ohne vde, ihre ADN-Staffel aber gemischt` }
    return {
      dub: false,
      art: 'folge',
      showId,
      grund: `Folge ${adresse.videoId} und alle ${staffel.length} Folgen ihrer ADN-Staffel ohne vde`,
    }
  }

  const menge = adresse.season ? alle.filter((f) => f.season === adresse.season) : alle
  const art: AdnBefundArt = adresse.season ? 'staffel' : 'serie'
  const bezug = adresse.season ? `ADN-Staffel ${adresse.season} von ${showId}` : `Serie ${showId}`
  if (!menge.length) return { art: 'folge-fehlt', showId, grund: `${bezug} ist im Archiv leer` }
  if (menge.every((f) => f.vde)) return { dub: true, art, showId, grund: `alle ${menge.length} Folgen von ${bezug} führen vde` }
  if (menge.every((f) => !f.vde)) return { dub: false, art, showId, grund: `keine der ${menge.length} Folgen von ${bezug} führt vde` }
  return {
    art: 'gemischt',
    showId,
    grund: `${bezug} ist gemischt (${menge.filter((f) => f.vde).length} von ${menge.length} mit vde), der Verweis nennt keine Staffel`,
  }
}
