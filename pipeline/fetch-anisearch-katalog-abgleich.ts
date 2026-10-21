/**
 * Bindet AniList-Titel ohne aniSearch-Kennung (Katalog `ohne-synchro.json` und Hauptbestand `titles.json`) an aniSearch — **nur über die API** (nie Seiten).
 *
 * Es gibt dort keine Suche; die Gesamtliste `GET /v1/anime/titles` (Jahr, Haupttitel, Japanisch, Kanji, Sprachen, Synonyme) ist der Suchraum. Sie wird höchstens
 * einmal je Tag geholt (Limit mit Token: 1 je Stunde, gemessen 11.10.2026) und liegt in `data/cache/anisearch-titelliste.json`. Zu jedem Namenstreffer
 * kommt der Einzelabruf (`/v1/anime/<Kennungen>`, zehn je Abruf, alle 5,5 s wie `fetch-anisearch-eintraege.ts`, Pause statt Abbruch bei 429) für Format,
 * Jahr, Folgen und MAL-Kennung; die Urteilsregeln stehen in `lib/anisearch-katalog-abgleich.ts`.
 *
 * Ergebnis: `data/anisearch-ids-katalog.json` (sicher: AniList-Kennung → aniSearch-Kennung; der Bau liest sie, ein Lauf **ergänzt** sie nur: einmal gebundene
 * Titel fallen aus der Liste der offenen und die Datei trägt auch die von Hand gesichteten) und `data/anisearch-katalog-abgleich.json` (Zählung, Prüfliste mit
 * Grund, Titel ohne Kandidat). Gesichtetes „kein Treffer" steht in `data/anisearch-katalog-kein-treffer.json` (AniList-Kennung → verworfene aniSearch-Kennungen)
 * und kommt nicht wieder auf die Prüfliste.
 *
 * Aufruf: `npx tsx pipeline/fetch-anisearch-katalog-abgleich.ts [--test N]` (`--test`: N gleichmäßig gewählte Titel, schreibt nichts außer dem Cache)
 */
import { readFileSync } from 'node:fs'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { anisearchKopf, anisearchToken } from './lib/anisearch-api.ts'
import { kompakt } from './fetch-anisearch-eintraege.ts'
import { FORMAT } from './bau/anisearch-titel.ts'
import { anisearchKatalogPaare } from './lib/anisearch-katalog-ids.ts'
import { holeAnilistMerkmale } from './lib/anilist-merkmale.ts'
import {
  type AsEintrag,
  type AsTitel,
  type Index,
  type KatalogTitel,
  type Kandidat,
  type Urteil,
  doppelteEntschaerfen,
  kandidaten,
  urteile,
  wortIndex,
} from './lib/anisearch-katalog-abgleich.ts'
import { todayIso } from '../shared/time.ts'

const API = 'https://api.anisearch.com/v1/anime'
export const TITELLISTE = 'data/cache/anisearch-titelliste.json'
const EINTRAEGE_ABRUF = 'data/cache/anisearch-abgleich-eintraege.json'
const IDS_KATALOG = 'data/anisearch-ids-katalog.json'
const KEIN_TREFFER = 'data/anisearch-katalog-kein-treffer.json'
const MERKMALE_ZWISCHEN = 'data/cache/anilist-abgleich-merkmale.json'
const PAUSE_MS = 5_500
const TAG_MS = 24 * 3600 * 1000

type Roh = Record<string, unknown>
export interface Ausgeliefert {
  id: number
  malId?: number
  anisearchId?: number
  titleRomaji?: string
  titleEn?: string
  titleNative?: string
  format?: string | null
  jpYear?: number | null
  jpStart?: string
  episodes?: number | null
}

/** Eine Zeile der Titelliste → Jahr und alle Schreibweisen als flache Liste. */
export function zeileZuTitel(id: string, z: Roh): AsTitel {
  const namen: string[] = []
  for (const [schluessel, wert] of Object.entries(z)) {
    if (schluessel === 'year') continue
    if (typeof wert === 'string') namen.push(wert)
    else if (schluessel === 'synonyms' && wert && typeof wert === 'object') namen.push(...Object.values(wert as Roh).flat().filter((s): s is string => typeof s === 'string'))
  }
  return { id: Number(id), jahr: typeof z.year === 'number' ? z.year : undefined, namen: [...new Set(namen)] }
}

export type Zwischenspeicher = { geholtAm?: string; titel?: Record<string, Roh> }

/** Grenzen eines Abrufs: `versuche` (nach dem letzten 429 wird nicht mehr gewartet) und `frist` in ms je Antwort. */
export interface AbrufGrenzen {
  versuche: number
  frist?: number
}

export async function holen<T>(url: string, token: string, grenzen: AbrufGrenzen = { versuche: 4 }): Promise<T | undefined> {
  for (let versuch = 1; versuch <= grenzen.versuche; versuch++) {
    const antwort = await fetch(url, { headers: anisearchKopf(token), signal: grenzen.frist ? AbortSignal.timeout(grenzen.frist) : undefined })
    if (antwort.status === 429) {
      const warten = Number(antwort.headers.get('retry-after')) || 20
      warn(`aniSearch 429, ${versuch < grenzen.versuche ? `Pause ${warten} s` : 'aufgegeben'}`)
      if (versuch < grenzen.versuche) await sleep(warten * 1000)
      continue
    }
    if (!antwort.ok) {
      warn(`aniSearch ${url.slice(0, 70)}: HTTP ${antwort.status}`)
      return undefined
    }
    return (await antwort.json()) as T
  }
  return undefined
}

/** Wirft, wenn die Liste nicht kommt; `grenzen` begrenzt den Abruf (der Wochenlauf des ADN-Katalogs versucht es nur einmal). */
export async function ladeTitelliste(token: string, grenzen?: AbrufGrenzen, zwischen = readJson<Zwischenspeicher>(TITELLISTE, {})): Promise<Map<number, AsTitel>> {
  let titel = zwischen.titel
  if (!titel || !zwischen.geholtAm || Date.now() - Date.parse(zwischen.geholtAm) > TAG_MS) {
    const frisch = await holen<Record<string, Roh>>(`${API}/titles`, token, grenzen)
    if (!frisch || Object.keys(frisch).length < 10_000) throw new Error('aniSearch-Titelliste nicht abrufbar (Limit 1 je Stunde, Token prüfen)')
    titel = frisch
    writeJson(TITELLISTE, { geholtAm: new Date().toISOString(), titel })
  }
  return new Map(Object.entries(titel).map(([id, z]) => [Number(id), zeileZuTitel(id, z)]))
}

/** MAL-Kennung → aniSearch-Kennungen: aus der Brücke `anisearch-mal.json` und aus allen schon geholten Einzelabrufen. */
function malZuAnisearch(eintraege: Record<string, AsEintrag>): Map<number, number[]> {
  const raus = new Map<number, Set<number>>()
  const dazu = (mal: number | undefined, asId: number): void => {
    if (mal) raus.set(mal, (raus.get(mal) ?? new Set<number>()).add(asId))
  }
  for (const [mal, asId] of Object.entries(readJson<Record<string, number>>('data/anisearch-mal.json', {}))) dazu(Number(mal), asId)
  for (const [asId, e] of Object.entries(eintraege)) dazu(e.mal, Number(asId))
  return new Map([...raus].map(([mal, ids]) => [mal, [...ids]]))
}

function katalogTitel(t: Ausgeliefert, malZuAs: Map<number, number[]>): KatalogTitel {
  return {
    id: t.id,
    mal: t.malId,
    malAsIds: t.malId ? malZuAs.get(t.malId) : undefined,
    namen: [t.titleRomaji, t.titleEn, t.titleNative].filter((n): n is string => Boolean(n)),
    format: t.format ?? null,
    jahr: t.jpYear ?? null,
    folgen: t.episodes ?? null,
    start: t.jpStart,
  }
}

/** Alle Titel ohne Kennung und die Menge der schon vergebenen aniSearch-Kennungen (damit kein Kandidat doppelt gebunden wird). */
function ladeAnilistTitel(): { offen: Ausgeliefert[]; vergeben: Set<number> } {
  const alle = [...readJson<Ausgeliefert[]>('public/data/titles.json', []), ...readJson<Ausgeliefert[]>('public/data/ohne-synchro.json', [])]
  /* Eigene aniSearch-Zeilen (Kennung ab 10.000.000) tragen ihre Kennung selbst und binden nichts: sie sind die Dubletten, die der Bau auflöst. */
  const vergeben = new Set<number>(alle.filter((t) => t.id < 10_000_000).map((t) => t.anisearchId).filter((i): i is number => Boolean(i)))
  for (const z of Object.values(readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {}))) if (z.anisearchId) vergeben.add(z.anisearchId)
  for (const [, asId] of anisearchKatalogPaare()) vergeben.add(asId)
  for (const m of readFileSync('data/anisearch-ids-hand.yaml', 'utf8').matchAll(/^(\d+):\s*(\d+)/gm)) vergeben.add(Number(m[2]))
  const handAl = [...readFileSync('data/anisearch-ids-hand.yaml', 'utf8').matchAll(/^(\d+):/gm)].map((m) => Number(m[1]))
  const gebunden = new Set<number>([...anisearchKatalogPaare().map(([al]) => al), ...handAl])
  return { offen: offeneTitel(alle, gebunden), vergeben }
}

/**
 * Titel, die der Abgleich entscheiden darf: ohne eigene Kennung und ohne Bindung in `gebunden` (Abgleich, Handdatei) — auch wenn der Bestand die Kennung noch nicht trägt:
 * ein Lauf darf gesichtete Paare nicht neu entscheiden. Eine Zeile je AniList-Kennung.
 */
export function offeneTitel(alle: Ausgeliefert[], gebunden: Set<number>): Ausgeliefert[] {
  const offen = alle.filter((t) => t.id < 10_000_000 && !t.anisearchId && !gebunden.has(t.id))
  return [...new Map(offen.map((t) => [t.id, t])).values()]
}

/** Was der Abgleich aus einem kompakten Eintrag braucht. */
const alsEintrag = (e: AsEintrag): AsEintrag => ({ ty: e.ty, y: e.y, f: e.f, mal: e.mal, von: e.von, bis: e.bis, min: e.min })

function bekannteEintraege(): Record<string, AsEintrag> {
  const aus = (roh: Record<string, AsEintrag>) => Object.fromEntries(Object.entries(roh).map(([id, e]) => [id, alsEintrag(e)]))
  return { ...aus(readJson('data/anisearch-eintraege.json', {})), ...aus(readJson(EINTRAEGE_ABRUF, {})) }
}

/** Holt die fehlenden Einzelabrufe, zehn je Abruf; sichert nach jedem Abruf, damit ein Abbruch nichts kostet. */
async function holeEintraege(ids: number[], bekannt: Record<string, AsEintrag>, token: string): Promise<void> {
  const fehlend = ids.filter((id) => !bekannt[String(id)])
  log(`Einzelabrufe: ${fehlend.length} Kennungen, ${Math.ceil(fehlend.length / 10)} Abrufe`)
  const gespeichert = readJson<Record<string, unknown>>(EINTRAEGE_ABRUF, {})
  for (let k = 0; k < fehlend.length; k += 10) {
    const antwort = await holen<{ results?: { id: number }[] }>(`${API}/${fehlend.slice(k, k + 10).join(',')}?lang=de`, token)
    for (const r of antwort?.results ?? []) {
      const kurz = kompakt(r as Parameters<typeof kompakt>[0])
      gespeichert[String(r.id)] = kurz
      bekannt[String(r.id)] = alsEintrag(kurz as AsEintrag)
    }
    writeJson(EINTRAEGE_ABRUF, gespeichert)
    await sleep(PAUSE_MS)
  }
}

const formatVon = (ty: string | undefined): string | undefined => (ty ? FORMAT[ty] : undefined)

function benoetigteEintraege(kand: Map<number, Kandidat[]>): number[] {
  const ids = new Set<number>()
  for (const cs of kand.values()) {
    for (const c of cs.filter((x) => x.gleicherName || x.ueberMal)) ids.add(c.asId)
    for (const c of cs.filter((x) => !x.gleicherName && !x.ueberMal).slice(0, 2)) ids.add(c.asId)
  }
  return [...ids]
}

/** Für die unsicheren Titel holt AniList Folgenlänge und Endtag (der Bestand trägt sie nicht); danach entscheiden Tag, Länge und Namensteil mit. */
async function zweiterDurchgang(offen: KatalogTitel[], urteil: Map<number, Urteil>, kand: Map<number, Kandidat[]>, titel: Map<number, AsTitel>, eintraege: Record<string, AsEintrag>): Promise<void> {
  const unsicher = offen.filter((k) => urteil.get(k.id)!.art === 'unsicher')
  const merkmale = await holeAnilistMerkmale(unsicher.map((k) => k.id), MERKMALE_ZWISCHEN)
  for (const k of unsicher) {
    k.dauer = merkmale.get(k.id)?.dauer
    k.ende = merkmale.get(k.id)?.ende
    urteil.set(k.id, urteile(k, kand.get(k.id)!, titel, eintraege, formatVon))
  }
}

function ergebnisDatei(offen: KatalogTitel[], urteil: Map<number, Urteil>, titel: Map<number, AsTitel>, eintraege: Record<string, AsEintrag>, nTitelliste: number, vergebenAn: Map<number, number>) {
  const nach = (art: Urteil['art']) => offen.filter((k) => urteil.get(k.id)!.art === art)
  const zeile = (k: KatalogTitel) => ({ id: k.id, name: k.namen[0] ?? k.namen[1], jahr: k.jahr, format: k.format })
  const unsicher = nach('unsicher').map((k) => {
    const u = urteil.get(k.id) as Extract<Urteil, { art: 'unsicher' }>
    const t = titel.get(u.asId)
    return { ...zeile(k), asId: u.asId, asName: t?.namen[0], asJahr: eintraege[String(u.asId)]?.y ?? t?.jahr, asFormat: eintraege[String(u.asId)]?.ty, weil: u.weil, weitere: u.weitere.map((c) => c.asId) }
  })
  return {
    stand: todayIso(),
    titelliste: nTitelliste,
    zaehlung: { sicher: nach('sicher').length, unsicher: unsicher.length, widerlegt: nach('widerlegt').length, keiner: nach('keiner').length },
    unsicher,
    widerlegt: nach('widerlegt').map((k) => ({ ...zeile(k), weil: (urteil.get(k.id) as Extract<Urteil, { art: 'widerlegt' }>).weil })),
    keiner: nach('keiner').map((k) => ({ ...zeile(k), ...(vergebenAn.has(k.id) ? { vergebenAn: vergebenAn.get(k.id) } : {}) })),
  }
}

/** Titel ohne Kandidat, dessen nächster Namenstreffer schon an einen anderen AniList-Titel gebunden ist (meist Special oder Teil derselben aniSearch-Zeile). */
function nahVergeben(offen: KatalogTitel[], urteil: Map<number, Urteil>, titel: Map<number, AsTitel>, index: Index): Map<number, number> {
  const raus = new Map<number, number>()
  for (const k of offen.filter((x) => urteil.get(x.id)!.art === 'keiner')) {
    const erster = kandidaten(k, titel, index, new Set())[0]
    if (erster) raus.set(k.id, erster.asId)
  }
  return raus
}

async function main(): Promise<void> {
  const token = anisearchToken()
  if (!token) throw new Error('kein aniSearch-Token (ANISEARCH_TOKEN)')
  const test = Number(process.argv[process.argv.indexOf('--test') + 1]) || 0
  const titel = await ladeTitelliste(token)
  const index = wortIndex([...titel.values()])
  const { offen: roh, vergeben } = ladeAnilistTitel()
  const schritt = Math.max(1, test ? Math.floor(roh.length / test) : 1)
  const eintraege = bekannteEintraege()
  const malZuAs = malZuAnisearch(eintraege)
  const offen = (test ? roh.filter((_, i) => i % schritt === 0).slice(0, test) : roh).map((t) => katalogTitel(t, malZuAs))
  log(`${titel.size} aniSearch-Titel, ${offen.length} AniList-Titel ohne Kennung, ${vergeben.size} Kennungen schon vergeben`)
  const keinTreffer = readJson<Record<string, number[]>>(KEIN_TREFFER, {})
  const kand = new Map(offen.map((k) => [k.id, kandidaten(k, titel, index, vergeben).filter((c) => !keinTreffer[String(k.id)]?.includes(c.asId))]))
  await holeEintraege(benoetigteEintraege(kand), eintraege, token)
  const urteil = new Map(offen.map((k) => [k.id, urteile(k, kand.get(k.id)!, titel, eintraege, formatVon)]))
  await zweiterDurchgang(offen, urteil, kand, titel, eintraege)
  const doppelt = doppelteEntschaerfen(urteil)
  const ergebnis = ergebnisDatei(offen, urteil, titel, eintraege, titel.size, nahVergeben(offen, urteil, titel, index))
  log(`sicher ${ergebnis.zaehlung.sicher}, unsicher ${ergebnis.zaehlung.unsicher}, widerlegt ${ergebnis.zaehlung.widerlegt}, keiner ${ergebnis.zaehlung.keiner} (davon ${doppelt} wegen doppelter Kennung entschärft)`)
  if (test) {
    for (const k of offen) console.log(k.id, k.namen[0], k.jahr, k.format, JSON.stringify(urteil.get(k.id)))
    return
  }
  const neu = [...urteil].filter(([, u]) => u.art === 'sicher').map(([id, u]) => [id, (u as { asId: number }).asId] as const)
  const sicher = Object.fromEntries([...anisearchKatalogPaare(), ...neu].sort((a, b) => a[0] - b[0]))
  writeJson(IDS_KATALOG, sicher, true)
  writeJson('data/anisearch-katalog-abgleich.json', ergebnis)
}

if (process.argv[1]?.endsWith('fetch-anisearch-katalog-abgleich.ts')) await main()
