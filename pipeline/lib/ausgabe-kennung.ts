/**
 * **Die Grenze zu den eigenen Kennungen** (Stufe 1, `docs/wissen/konzept-eigene-ids.md`).
 *
 * Die Pipeline und `public/data/` arbeiten intern mit der AniList-Kennung. Beim Bau der Seite
 * (`tools/ausgabe-uebersetzen.ts`, nach `vite build`) werden die Dateien in `dist/data/` auf unsere
 * Kennung `ak` umgeschrieben; Web, Worker und Erweiterung kennen nur noch `ak`.
 * Negative Kennungen (Cartoons aus TMDB) bleiben, wie sie sind.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type AkVon = (anilist: number) => number

/** Gruppengröße der Teildateien `synopses/` und `disc/` (`SYNOPSIS_GROUPS` im Web). */
const GRUPPEN = 32

export function ladeAkVon(kennungenPfad: string): { akVon: AkVon; zeilen: [number, number, number][] } {
  const roh = JSON.parse(readFileSync(kennungenPfad, 'utf8')) as { titel: [number, number, number][] }
  const karte = new Map(roh.titel.map((z) => [z[1], z[0]]))
  const akVon: AkVon = (anilist) => {
    if (!Number.isInteger(anilist) || anilist < 0) return anilist
    const ak = karte.get(anilist)
    if (ak === undefined) throw new Error(`Keine Kennung für AniList ${anilist} in data/kennungen.json (tools/kennungen-erzeugen.mjs ausführen)`)
    return ak
  }
  return { akVon, zeilen: roh.titel }
}

const num = (v: unknown, ak: AkVon) => (typeof v === 'number' ? ak(v) : v)

/** Eine Titelzeile: Kennung, Reihenkennung, Adresse (`slug` = Kennung, also `/t/<ak>/`); die AniList-Kennung bleibt als `al` für den Quellenverweis. */
function titel(t: Record<string, unknown>, ak: AkVon): Record<string, unknown> {
  const id = t.id as number
  if (typeof id !== 'number' || id < 0) return t
  const neu: Record<string, unknown> = { ...t, id: ak(id), al: id }
  if (typeof t.franchiseId === 'number') neu.franchiseId = ak(t.franchiseId)
  if (typeof t.slug === 'string') neu.slug = String(ak(id))
  return neu
}

const liste = (v: unknown, f: (x: Record<string, unknown>) => Record<string, unknown>) => (Array.isArray(v) ? v.map(f) : v)

function schluessel(o: unknown, ak: AkVon, wert: (v: unknown) => unknown = (v) => v): Record<string, unknown> {
  const raus: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) raus[String(ak(Number(k)))] = wert(v)
  return raus
}

/** Übersetzt eine Datei von `public/data/` (Name relativ, z. B. `titles.json`); unbekannte Dateien bleiben unverändert. */
export function uebersetzeDatei(name: string, daten: unknown, ak: AkVon): unknown {
  switch (name) {
    case 'titles.json':
    case 'titles-core.json':
    case 'ohne-synchro.json':
      return liste(daten, (t) => titel(t, ak))
    case 'releases.json':
    case 'events.json':
      return liste(daten, (r) => ({ ...r, titleId: num(r.titleId, ak) }))
    case 'meldungen.json':
      return liste(daten, (m) => ({ ...m, titleId: num(m.titleId, ak) }))
    case 'neu-mit-synchro.json':
      return liste(daten, (n) => ({ ...n, ...titel(n, ak) }))
    case 'news.json':
      return liste(daten, (e) => ({
        ...e,
        titelId: num(e.titelId, ak),
        slug: typeof e.slug === 'string' && typeof e.titelId === 'number' ? String(ak(e.titelId)) : e.slug,
        meldungen: liste(e.meldungen, (m) => (typeof m.teilId === 'number' ? { ...m, teilId: ak(m.teilId) } : m)),
      }))
    case 'franchises.json':
      return schluessel(daten, ak, (v) => liste(v, (m) => ({ ...m, id: num(m.id, ak), al: m.id })))
    case 'reihen.json':
      return schluessel(daten, ak, (v) => ({ ...(v as object), f: num((v as { f: number }).f, ak) }))
    case 'synonyme.json':
    case 'folgen/zaehlung.json':
      return schluessel(daten, ak)
    default:
      return daten
  }
}

const lies = (pfad: string) => JSON.parse(readFileSync(pfad, 'utf8')) as unknown
const schreibe = (pfad: string, daten: unknown) => writeFileSync(pfad, JSON.stringify(daten))

/** Teildateien nach Kennung: `synopses/`, `disc/` (neu gruppiert) und `folgen/`, `voices/` (je Titel, Dateiname und Inhalt). */
function uebersetzeTeildateien(wurzel: string, ak: AkVon): void {
  for (const ordner of ['synopses', 'disc']) {
    const pfad = join(wurzel, ordner)
    if (!existsSync(pfad)) continue
    const gruppen = new Map<number, Record<string, unknown>>()
    for (const datei of readdirSync(pfad)) {
      for (const [k, v] of Object.entries(lies(join(pfad, datei)) as Record<string, unknown>)) {
        const neu = ak(Number(k))
        const g = gruppen.get(neu % GRUPPEN) ?? {}
        g[String(neu)] = v
        gruppen.set(neu % GRUPPEN, g)
      }
      rmSync(join(pfad, datei))
    }
    for (const [g, inhalt] of gruppen) schreibe(join(pfad, `${g}.json`), inhalt)
  }
  for (const ordner of ['folgen', 'voices']) {
    const pfad = join(wurzel, ordner)
    if (!existsSync(pfad)) continue
    const neuPfad = join(wurzel, `${ordner}.neu`)
    mkdirSync(neuPfad, { recursive: true })
    for (const datei of readdirSync(pfad)) {
      const id = Number(datei.replace(/\.json$/, ''))
      if (!Number.isInteger(id)) {
        schreibe(join(neuPfad, datei), uebersetzeDatei(`${ordner}/${datei}`, lies(join(pfad, datei)), ak))
        continue
      }
      const inhalt = lies(join(pfad, datei)) as Record<string, unknown>
      if (typeof inhalt.titleId === 'number') inhalt.titleId = ak(inhalt.titleId)
      schreibe(join(neuPfad, `${ak(id)}.json`), inhalt)
    }
    rmSync(pfad, { recursive: true })
    renameSync(neuPfad, pfad)
  }
}

/** Schreibt `wurzel` (= `dist/data`) in unseren Kennungen um und legt `anilist-ak.json` (`[[ak, anilist], …]`) für Import und Favoriten-Umschreibung ab. */
export function uebersetzeVerzeichnis(wurzel: string, kennungenPfad: string): { dateien: number } {
  const { akVon, zeilen } = ladeAkVon(kennungenPfad)
  let dateien = 0
  for (const name of readdirSync(wurzel)) {
    if (!name.endsWith('.json')) continue
    const pfad = join(wurzel, name)
    let neu: unknown
    try {
      neu = uebersetzeDatei(name, lies(pfad), akVon)
    } catch (e) {
      throw new Error(`${name}: ${(e as Error).message}`)
    }
    schreibe(pfad, neu)
    dateien++
  }
  uebersetzeTeildateien(wurzel, akVon)
  schreibe(join(wurzel, 'anilist-ak.json'), zeilen.map((z) => [z[0], z[1]]))
  return { dateien }
}
