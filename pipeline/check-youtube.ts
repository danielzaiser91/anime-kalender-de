/**
 * Prüft jeden verlinkten YouTube-Verweis auf das, was einen Besucher wirklich
 * betrifft: Liegt dort etwas, das **in Deutschland** abrufbar ist?
 *
 * Warum das nötig wurde: Für „Sword of the Demon Hunter" stand eine Playlist im
 * Datensatz, die im Browser nur „24 nicht verfügbare Videos werden nicht
 * angezeigt" zeigt (Daniel, 20.08.2026). Die Videos sind nicht gelöscht — sie
 * sind auf den asiatischen Raum beschränkt und tragen chinesische Untertitel bei
 * japanischem Ton. Ein Verweis, der ins Leere führt, ist schlimmer als keiner:
 * Er verspricht ein Angebot, das es hier nicht gibt.
 *
 * Warum die offizielle Schnittstelle und kein Auslesen der Seite: YouTube
 * untersagt automatisierte Zugriffe außerhalb der API — und die API beantwortet
 * die Frage ohnehin besser. Die Ländersperre steht als `regionRestriction`
 * ausdrücklich in der Antwort; im Seitenquelltext steht sie nicht.
 *
 * Kosten: `playlistItems.list` und `videos.list` je eine Einheit, das
 * Tageskontingent sind 10.000. Ein voller Durchgang über rund 510 Adressen
 * braucht etwa 1.100.
 *
 * Aufruf: npx tsx pipeline/check-youtube.ts [--alter 30] [--limit 200]
 */
import { readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const KEY = process.env.YOUTUBE_API_KEY ?? ''
const API = 'https://www.googleapis.com/youtube/v3'
const DATEI = 'data/youtube-check.json'

const args = process.argv.slice(2)
const zahl = (name: string, fallback: number) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const ALTER = zahl('--alter', 30)
const LIMIT = zahl('--limit', 0)

/** Was wir über eine Adresse wissen. */
interface Befund {
  /** Kanäle lassen sich so nicht prüfen — sie sind keine Folgenliste. */
  art: 'playlist' | 'video' | 'kanal'
  /** Wie viele Videos die Adresse führt. */
  gesamt: number
  /** Davon in Deutschland abrufbar. Null heißt: Der Verweis führt ins Leere. */
  inDE: number
  geprueftAm: string
  /** Warum nichts abrufbar ist, sofern die Schnittstelle es sagt. */
  grund?: string
}

type Bestand = Record<string, Befund>

const heute = () => new Date().toISOString().slice(0, 10)

/**
 * Playlist, Einzelvideo — oder Kanal.
 *
 * Kanal ist der Auffangfall, und das mit Absicht: YouTube kennt für Kanäle
 * mindestens vier Schreibweisen (`/channel/UC…`, `/c/Name`, `/user/Name`, `/@Name`)
 * und dazu die nackte Kurzform `/precure`. Eine Liste davon wäre immer
 * unvollständig — am 20.08.2026 fielen genau diese drei durch und blieben
 * dauerhaft in der Warteschlange stehen, ohne je geprüft zu werden.
 *
 * Was weder Playlist noch Video ist, ist auf YouTube eine Kanalseite. Bewertet
 * wird sie ohnehin nicht: Was auf einem Kanal liegt, sagt nichts darüber, ob
 * **dieser** Titel dort abrufbar ist.
 */
function art(url: string): Befund['art'] | undefined {
  if (/[?&]list=/.test(url)) return 'playlist'
  if (/[?&]v=/.test(url) || /youtu\.be\//.test(url)) return 'video'
  if (/youtube\.com\//.test(url)) return 'kanal'
  return undefined
}

const playlistId = (url: string) => /[?&]list=([^&]+)/.exec(url)?.[1]
const videoId = (url: string) => /[?&]v=([^&]+)/.exec(url)?.[1] ?? /youtu\.be\/([^?&/]+)/.exec(url)?.[1]

interface ApiVideo {
  status?: { uploadStatus?: string; privacyStatus?: string }
  contentDetails?: { regionRestriction?: { allowed?: string[]; blocked?: string[] } }
}

async function hole(pfad: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const q = new URLSearchParams({ ...params, key: KEY })
  const res = await fetch(`${API}/${pfad}?${q.toString()}`)
  const body = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const fehler = body.error as { message?: string; errors?: { reason?: string }[] } | undefined
    const grund = fehler?.errors?.[0]?.reason ?? `HTTP ${res.status}`
    throw Object.assign(new Error(fehler?.message ?? grund), { grund })
  }
  return body
}

/**
 * In Deutschland abrufbar?
 *
 * `allowed` und `blocked` schließen einander aus. Fehlt beides, gilt das Video
 * überall — das ist der Normalfall.
 */
function inDeutschland(v: ApiVideo): boolean {
  const rr = v.contentDetails?.regionRestriction
  if (!rr) return true
  if (rr.allowed) return rr.allowed.includes('DE')
  return !(rr.blocked ?? []).includes('DE')
}

/** Zählt, wie viele der Kennungen hier wirklich abrufbar sind. */
async function abrufbare(ids: string[]): Promise<number> {
  let treffer = 0
  for (let i = 0; i < ids.length; i += 50) {
    const body = await hole('videos', {
      part: 'contentDetails,status',
      id: ids.slice(i, i + 50).join(','),
    })
    for (const v of (body.items ?? []) as ApiVideo[]) {
      if (v.status?.uploadStatus && v.status.uploadStatus !== 'processed') continue
      if (inDeutschland(v)) treffer++
    }
    await sleep(120)
  }
  return treffer
}

async function pruefePlaylist(id: string): Promise<Befund> {
  const ids: string[] = []
  let seite: string | undefined
  do {
    const body = await hole('playlistItems', {
      part: 'contentDetails',
      maxResults: '50',
      playlistId: id,
      ...(seite ? { pageToken: seite } : {}),
    })
    for (const it of (body.items ?? []) as { contentDetails?: { videoId?: string } }[]) {
      if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId)
    }
    seite = body.nextPageToken as string | undefined
    await sleep(120)
  } while (seite && ids.length < 500)

  const inDE = ids.length ? await abrufbare(ids) : 0
  return {
    art: 'playlist',
    gesamt: ids.length,
    inDE,
    geprueftAm: heute(),
    // Der Unterschied zählt: Eine leere Liste ist etwas anderes als eine volle,
    // die hier gesperrt ist. Beim ersten lohnt kein zweiter Blick, beim zweiten
    // kann eine Lizenz zurückkommen.
    grund: ids.length === 0 ? 'Playlist führt keine Videos' : inDE === 0 ? 'alle Videos in Deutschland gesperrt' : undefined,
  }
}

async function pruefeVideo(id: string): Promise<Befund> {
  const inDE = await abrufbare([id])
  return {
    art: 'video',
    gesamt: 1,
    inDE,
    geprueftAm: heute(),
    grund: inDE === 0 ? 'in Deutschland nicht abrufbar' : undefined,
  }
}

async function main(): Promise<void> {
  if (!KEY) {
    warn('YOUTUBE_API_KEY fehlt — ohne Schlüssel lässt sich nichts prüfen.')
    process.exit(1)
  }

  const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as unknown
  const titles = (Array.isArray(roh) ? roh : Object.values(roh as object).find(Array.isArray)) as Title[]

  const bestand = readJson<Bestand>(DATEI, {})

  /**
   * Die Warteschlange ist die **Vereinigung**, nicht der aktuelle Datensatz.
   *
   * Ein Verweis, den dieser Lauf als tot erfasst, wird vom Build aus
   * `titles.json` entfernt — und stünde beim nächsten Mal nicht mehr in der
   * Liste, aus der sich die Warteschlange bildet. Er käme also nie wieder dran,
   * und ein Falschbefund wäre für immer einer.
   *
   * Genau davor warnt der Abschnitt „Ein Abruf, der nur ergänzt, veraltet
   * zwangsläufig" in `CLAUDE.md`, und ich bin am 20.08.2026 beim ersten Anlauf
   * hineingelaufen. Deshalb: alles, was je geprüft wurde, bleibt in der Schlange
   * — die Wiedervorlage entscheidet über das Alter, nicht über „schon
   * beantwortet". Kommt eine Lizenz zurück, findet der nächste Lauf es, und der
   * Build nimmt den Verweis von selbst wieder auf.
   */
  const adressen = new Set<string>(Object.keys(bestand))
  for (const t of titles) for (const s of t.streams ?? []) if (s.platform === 'youtube') adressen.add(s.url)
  const grenze = new Date(Date.now() - ALTER * 86_400_000).toISOString().slice(0, 10)
  /**
   * Wiedervorlage nach Alter, nicht nach „schon geprüft".
   *
   * Dieselbe Regel wie bei aniSearch und Crunchyroll: Ein Verweis, der einmal
   * als tot erfasst wurde, muss wieder in die Schlange kommen. Lizenzen kehren
   * zurück, Kanäle laden neu hoch, Ländersperren fallen.
   */
  const offen = [...adressen].filter((u) => {
    const alt = bestand[u]
    return !alt || alt.geprueftAm < grenze
  })
  const arbeit = LIMIT > 0 ? offen.slice(0, LIMIT) : offen
  log(`YouTube: ${adressen.size} Adressen, ${offen.length} fällig, ${arbeit.length} in diesem Lauf.`)

  let geprueft = 0
  let leer = 0
  for (const url of arbeit) {
    const typ = art(url)
    if (!typ) continue
    try {
      if (typ === 'kanal') {
        // Ein Kanal ist keine Folgenliste. Was dort liegt, sagt nichts darüber,
        // ob **dieser** Titel abrufbar ist — erfasst, aber nicht bewertet.
        bestand[url] = { art: 'kanal', gesamt: 0, inDE: 0, geprueftAm: heute(), grund: 'Kanal, keine Folgenliste' }
      } else if (typ === 'playlist') {
        const id = playlistId(url)
        bestand[url] = id
          ? await pruefePlaylist(id)
          : { art: 'playlist', gesamt: 0, inDE: 0, geprueftAm: heute(), grund: 'keine Playlist-Kennung in der Adresse' }
      } else {
        const id = videoId(url)
        bestand[url] = id
          ? await pruefeVideo(id)
          : { art: 'video', gesamt: 0, inDE: 0, geprueftAm: heute(), grund: 'keine Video-Kennung in der Adresse' }
      }
      if (typ !== 'kanal' && bestand[url].inDE === 0) leer++
    } catch (err) {
      const grund = (err as { grund?: string }).grund ?? (err as Error).message
      // „playlistNotFound" und „videoNotFound" sind Befunde, keine Störungen.
      const weg = /notFound/i.test(grund)
      bestand[url] = { art: typ, gesamt: 0, inDE: 0, geprueftAm: heute(), grund }
      if (weg) leer++
      else warn(`YouTube ${url}: ${grund}`)
    }
    if (++geprueft % 50 === 0) log(`  ${geprueft}/${arbeit.length} — ${leer} ohne abrufbares Video`)
    await sleep(150)
  }

  writeJson(DATEI, bestand)
  const tot = Object.values(bestand).filter((b) => b.art !== 'kanal' && b.inDE === 0).length
  log(`YouTube: ${geprueft} geprüft, davon ${leer} ohne abrufbares Video. Im Bestand insgesamt ${tot} tote Verweise.`)
  /*
    Wie bei tmdb-folgen/anisearch-folgen: Der Bestand ist der Erfolgsmaßstab,
    nicht der Ertrag dieses einzelnen Laufs. Die Wiedervorlage (--alter 30)
    lässt eine Woche legitim ganz ohne fällige Adresse verstreichen — sonst
    galt jeder solche Lauf als „stumme Quelle", obwohl nichts kaputt war.
  */
  recordSource('youtube-check', Object.keys(bestand).length, undefined, geprueft)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
