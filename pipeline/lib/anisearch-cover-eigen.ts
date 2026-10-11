import { nachFehlern } from './anisearch-sperre.ts'
import { anisearchKopf } from './anisearch-api.ts'
import { log, warn } from './util.ts'

/**
 * **Eigene Kopien der aniSearch-Cover** (11.10.2026, Daniel: herunterladen und selbst ausliefern ist erlaubt, nie hotlinken; R2 als Ziel).
 * Dieses Modul entscheidet und lädt; Netz, Pausen, Umwandlung und Schreiben kommen als `Abhaengigkeiten` herein, damit die Prüfung ohne Netz läuft.
 *
 * Manifest `data/cover-eigen.json`: aniSearch-Kennung → Eintrag. `datei` ist der künftige Pfad relativ zur Bild-Domain (und zum Ordner `cover-ausgabe/`),
 * `quelle` die geladene Adresse, `groesse` die Bytes der WebP-Datei. Einträge mit `grund` haben kein Bild (Platzhalter, 18+, keine Adresse, 404) und werden nicht erneut gefragt.
 * Nichtauskunft (403/423/429, 5xx, Netzfehler) wird nie vermerkt: Der Titel bleibt offen.
 */
export type Grund = 'platzhalter' | 'nsfw' | 'ohne-adresse' | 'nicht-gefunden'
export interface CoverEintrag {
  datei?: string
  groesse?: number
  quelle?: string
  grund?: Grund
  stand: string
}
export type Manifest = Record<string, CoverEintrag>

export interface Abhaengigkeiten {
  abruf: typeof fetch
  schlafe: (ms: number) => Promise<void>
  jetzt: () => number
  wandle: (bild: Buffer) => Promise<Buffer>
  schreibe: (relativ: string, daten: Buffer) => void
  sichere: (manifest: Manifest) => void
}

export interface Optionen {
  limit: number
  token: string
  /** Zeitpunkt (ms), bis zu dem der Lauf spätestens endet; Pausen, die darüber hinausgehen, werden nicht genommen. */
  ende: number
}

export interface Zaehler {
  neu: number
  ohneBild: number
  fehler: number
  abgebrochen?: string
}

const ANISEARCH_ID_BASIS = 10_000_000
const BILD_HOST = 'https://cdn.anisearch.de/'
const BILD_ABSTAND_MS = 2_000
const API_BLOCK = 10
const MAX_FEHLER = 3
const BILD_ORDNER = 'anisearch'

/** aniSearch-Kennungen der Titel ohne Cover, die noch nicht im Manifest stehen, aufsteigend. Titelkennung = 10.000.000 + aniSearch-Kennung. */
export function offeneKennungen(titel: { id: number; coverImage?: string }[], manifest: Manifest): string[] {
  const ids = titel.filter((t) => t.id >= ANISEARCH_ID_BASIS && !t.coverImage).map((t) => String(t.id - ANISEARCH_ID_BASIS))
  return [...new Set(ids)].filter((id) => !manifest[id]).sort((a, b) => Number(a) - Number(b))
}

/** Die Adresse aus dem `cover`-Objekt der API (groß vor mittel), nur vom Bild-Host; sonst nichts. */
export function adresseAus(cover: unknown): string | undefined {
  const kandidaten = typeof cover === 'string' ? [cover] : cover && typeof cover === 'object' ? ['large', 'medium'].map((k) => (cover as Record<string, unknown>)[k]) : []
  return kandidaten.find((k): k is string => typeof k === 'string' && k.startsWith(BILD_HOST))
}

/** Die Adresse, die das Muster der Seiten vorgibt (2.601 von 2.705 archivierten Seiten bestätigt, 11.10.2026): `<Kennung/1000 abgerundet>/<Kennung>_300.webp`. */
export const adresseAusKennung = (id: string): string => `${BILD_HOST}images/anime/cover/${Math.floor(Number(id) / 1000)}/${id}_300.webp`

/** Die Stufe des Kennzeichens am Cover (18 = Hentai, kleinere Werte = Ecchi o. Ä.); fehlt es, 0. */
const nsfwStufe = (cover: unknown): number => Number((cover as { nsfw?: number } | null | undefined)?.nsfw) || 0

/**
 * Die Adresse für einen Titel: die der API, sonst aus der Kennung gebildet, sobald die API ein `cover`-Objekt führt (Probelauf 11.10.2026: das Objekt trug keine
 * Adresse im erwarteten Schlüssel). Ohne `cover` bleibt es bei „keine Adresse“: Dort ist das Bild nicht freigegeben oder fehlt (`cover/0_600`).
 */
export function bildAdresse(id: string, cover: unknown): string | undefined {
  return adresseAus(cover) ?? (cover && typeof cover === 'object' ? adresseAusKennung(id) : undefined)
}

/** Kurze Beschreibung der Antwortform für das Log (Schlüssel, `cover` als JSON, gekürzt): macht eine falsche Annahme im nächsten Lauf sichtbar. */
export const formVon = (info: Record<string, unknown>): string => `Schlüssel [${Object.keys(info).join(', ')}], cover = ${(JSON.stringify(info.cover) ?? 'fehlt').slice(0, 300)}`

/** `ecchi.v1_600.webp` (aniSearch verbirgt das Bild) und `cover/0_600.webp` (kein Cover) sind keine Titelbilder. */
export const istPlatzhalter = (url: string): boolean => /\/cover\/(ecchi[^/]*|0_\d+\.\w+)$/.test(url)

/** Die Quelle ist `_300` (43 KB; `_100`/`_200` sind gesperrt, 423). */
export const quelle300 = (url: string): string => url.replace(/_\d+\.(webp|jpe?g|png)$/, '_300.webp')

type Bild = { art: 'ok'; bild: Buffer } | { art: 'weg' } | { art: 'fehler'; status: number }

async function ladeBild(url: string, dep: Abhaengigkeiten): Promise<Bild> {
  try {
    const antwort = await dep.abruf(url, { headers: { ...anisearchKopf(undefined), accept: 'image/webp,image/*' } })
    if (antwort.status === 404 || antwort.status === 410) return { art: 'weg' }
    if (!antwort.ok || !(antwort.headers.get('content-type') ?? '').startsWith('image/')) return { art: 'fehler', status: antwort.status }
    return { art: 'ok', bild: Buffer.from(await antwort.arrayBuffer()) }
  } catch {
    return { art: 'fehler', status: 0 }
  }
}

type Info = Record<string, unknown> & { id: number; cover?: unknown }

async function holeInfos(ids: string[], opt: Optionen, dep: Abhaengigkeiten): Promise<Map<string, Info> | undefined> {
  try {
    const antwort = await dep.abruf(`https://api.anisearch.com/v1/anime/${ids.join(',')}?lang=de`, { headers: anisearchKopf(opt.token) })
    if (!antwort.ok) return void warn(`aniSearch-API: HTTP ${antwort.status}`)
    const roh = ((await antwort.json()) as { results?: Info[] }).results ?? []
    return new Map(roh.map((r) => [String(r.id), r]))
  } catch (fehler) {
    return void warn(`aniSearch-API: ${(fehler as Error).message}`)
  }
}

interface Sperre {
  fehlerInFolge: number
  pausen: number
}

/** Nach einem Fehlschlag: weiter mit dem nächsten Titel, nach Pause denselben noch einmal, oder Ende des Laufs. */
async function reagiere(s: Sperre, opt: Optionen, dep: Abhaengigkeiten): Promise<'weiter' | 'wiederholen' | 'ende'> {
  s.fehlerInFolge++
  const folge = nachFehlern(s.fehlerInFolge, MAX_FEHLER, s.pausen, opt.ende - dep.jetzt())
  if (folge.art === 'pause') {
    warn(`${MAX_FEHLER} Fehlschläge in Folge (403/423/429 oder Netz) — Pause ${folge.minuten} Minuten, danach eine einzelne Anfrage.`)
    await dep.schlafe(folge.minuten * 60_000)
    s.pausen++
    s.fehlerInFolge = MAX_FEHLER - 1
    return 'wiederholen'
  }
  return folge.art === 'ende' ? 'ende' : 'weiter'
}

const stand = (dep: Abhaengigkeiten): string => new Date(dep.jetzt()).toISOString().slice(0, 10)

/** Lädt, wandelt und legt ein Bild ab; gibt zurück, ob der Lauf weitermachen soll. */
async function einBild(id: string, url: string, manifest: Manifest, s: Sperre, opt: Optionen, z: Zaehler, dep: Abhaengigkeiten): Promise<boolean> {
  for (;;) {
    const bild = await ladeBild(url, dep)
    if (bild.art === 'ok') {
      const datei = `${BILD_ORDNER}/${id}.webp`
      const webp = await dep.wandle(bild.bild)
      dep.schreibe(datei, webp)
      manifest[id] = { datei, groesse: webp.length, quelle: url, stand: stand(dep) }
      s.fehlerInFolge = 0
      z.neu++
      return true
    }
    if (bild.art === 'weg') {
      manifest[id] = { grund: 'nicht-gefunden', quelle: url, stand: stand(dep) }
      s.fehlerInFolge = 0
      z.ohneBild++
      return true
    }
    z.fehler++
    const weiter = await reagiere(s, opt, dep)
    if (weiter === 'ende') return false
    if (weiter === 'weiter') return true
  }
}

/** Ein Titel aus der API-Antwort: Auslassungen sofort vermerken, sonst das Bild holen. */
async function einTitel(id: string, info: Info, manifest: Manifest, s: Sperre, opt: Optionen, z: Zaehler, dep: Abhaengigkeiten): Promise<boolean> {
  const adresse = bildAdresse(id, info.cover)
  const grund: Grund | undefined = nsfwStufe(info.cover) > 0 ? 'nsfw' : !adresse ? 'ohne-adresse' : istPlatzhalter(adresse) ? 'platzhalter' : undefined
  if (grund) {
    manifest[id] = { grund, ...(adresse ? { quelle: adresse } : {}), stand: stand(dep) }
    z.ohneBild++
    return true
  }
  const weiter = await einBild(id, quelle300(adresse!), manifest, s, opt, z, dep)
  await dep.schlafe(BILD_ABSTAND_MS)
  return weiter
}

/**
 * Holt höchstens `opt.limit` offene Titel: je zehn Kennungen eine API-Antwort, dann die Bilder im Abstand von zwei Sekunden; das Manifest wird nach jedem Zehnerblock gesichert.
 * Liefert die API für einen ganzen Block (mindestens drei Titel) keine einzige Bildadresse, stimmt die Annahme über das `cover`-Objekt nicht: Der Lauf endet, ohne etwas zu vermerken.
 */
export async function holeCover(offen: string[], manifest: Manifest, opt: Optionen, dep: Abhaengigkeiten): Promise<Zaehler> {
  const z: Zaehler = { neu: 0, ohneBild: 0, fehler: 0 }
  const s: Sperre = { fehlerInFolge: 0, pausen: 0 }
  const ziel = offen.slice(0, opt.limit)
  for (let k = 0; k < ziel.length; k += API_BLOCK) {
    const block = ziel.slice(k, k + API_BLOCK)
    const infos = await holeInfos(block, opt, dep)
    if (!infos) {
      z.fehler++
      if ((await reagiere(s, opt, dep)) === 'ende') break
      continue
    }
    if (k === 0) for (const i of [...infos.values()].slice(0, 3)) log(`aniSearch-API, Form der Antwort für ${i.id}: ${formVon(i)}`)
    if (infos.size >= 3 && ![...infos.values()].some((i) => bildAdresse(String(i.id), i.cover) || nsfwStufe(i.cover) > 0)) {
      z.abgebrochen = `API führt kein cover-Objekt (Form prüfen): ${formVon([...infos.values()][0]!)}`
      break
    }
    let weiter = true
    for (const id of block) {
      const info = infos.get(id)
      if (!info) continue
      weiter = await einTitel(id, info, manifest, s, opt, z, dep)
      if (!weiter) break
    }
    dep.sichere(manifest)
    if (!weiter) break
  }
  dep.sichere(manifest)
  return z
}
