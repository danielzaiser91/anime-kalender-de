/**
 * PoC Stufe 2, dritter Schnitt (22.09.2026) — Zuordnung **je Plattform-Folge**, nicht je Adresse.
 *
 * Schlüssel ist `plattform:kennung` (Prime: Folgen-ASIN, Netflix/Disney+: gti). Kandidaten sind alle
 * `titel_id`, unter denen die Folge gemeldet wurde, dazu die Titel, die einen Weg zur gemeldeten
 * Adresse tragen. Je Kandidat wird die Folge gegen seine Anker gehalten (aniSearch-Folgentitel, sonst
 * die TMDB-Staffel mit passender Folgenzahl), mit denselben Regeln wie `fetch-rohfolgen.ts`
 * (`ordneZu`: Datum, dann Titel; keine Position).
 *
 * Ergebnis je Folge: `eindeutig` (genau ein Kandidat trifft), `strittig` (mehrere treffen), `titel`
 * (ein einziger Kandidat, aber kein Anker trifft — die Folge gehört dem Titel, ohne Nummer),
 * `offen` (mehrere Kandidaten, keiner trifft) oder `ohne` (kein Kandidat). Schreibt nichts in den
 * Bestand.
 *
 * Aufruf: npx tsx tools/poc-urteil/zuordnung-folge.ts <prime_folge-export.json>
 */
import { readFileSync } from 'node:fs'
import {
  ausAnisearch,
  englischeSchreibweisen,
  findeStaffel,
  ordneZu,
  type AsFolgeRoh,
  type TmdbFolge,
} from '../../shared/folgen-zuordnung.ts'
import type { Title } from '../../shared/types.ts'

interface Zeile {
  id: number
  plattform: string
  url: string
  asin: string | null
  gti: string | null
  nummer: number | null
  titel: string | null
  erschienen: string | null
  titel_id: number | null
  gemeldet_am: string
}

const lies = <T>(p: string, leer: T): T => {
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T
  } catch {
    return leer
  }
}
const zeilen = (JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as { results: Zeile[] }[])[0]!.results
const roh = lies<Title[] | { titles: Title[] }>('public/data/titles.json', [])
const titel = new Map((Array.isArray(roh) ? roh : roh.titles).map((t) => [t.id, t]))
const tmdb = lies<Record<string, { folgen: TmdbFolge[] }>>('data/tmdb-folgen.json', {})
const asFolgen = lies<Record<string, { folgen: AsFolgeRoh[] }>>('data/anisearch-folgen.json', {})
const asKennung = lies<Record<string, { anisearchId?: number }>>('data/anisearch.json', {})

/*
  Eine Suchadresse („amazon.de/s?k=…") ist kein Anker: ohne Abfrageteil fallen alle auf denselben
  Kern „amazon.de/s", und der erste Lauf sammelte darunter rund 90 Titel als Kandidaten jeder Folge.
*/
const kern = (u: string | null | undefined) => {
  /* „watch.amazon.de/detail?gti=…" trägt die Kennung im Abfrageteil — sie ist der Schlüssel. */
  const gti = /[?&]gti=([^&#]+)/.exec(String(u ?? ''))?.[1]
  if (gti) return `gti:${decodeURIComponent(gti)}`
  const k = String(u ?? '')
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/(gp\/video\/detail|dp)\//, '/')
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '')
  return /\/s$|\/search$|^[^/]*$/.test(k) ? '' : k
}
const jeAdresse = new Map<string, Set<number>>()
for (const t of titel.values()) {
  for (const w of [...(t.streams ?? []), ...(t.watchLinks ?? [])] as { url?: string; seite?: string }[]) {
    for (const u of [w.url, w.seite].filter(Boolean)) {
      const k = kern(u)
      if (!k) continue
      if (!jeAdresse.has(k)) jeAdresse.set(k, new Set())
      jeAdresse.get(k)!.add(t.id)
    }
  }
}

/*
  **Frühere Zuordnungen als Kandidaten.** Wege ändern sich (gti-Brücke, neue ASINs); eine Meldung von
  damals trägt die Adresse von damals. `prime-zugeordnet.json` (Einleser) und `dub-confirmed.yaml`
  (Belege) halten fest, welchem Titel sie seinerzeit gehörte.
*/
for (const [url, x] of Object.entries(lies<Record<string, { titleId?: number }>>('data/prime-zugeordnet.json', {}))) {
  if (!x.titleId) continue
  const k = kern(url)
  if (!k) continue
  if (!jeAdresse.has(k)) jeAdresse.set(k, new Set())
  jeAdresse.get(k)!.add(x.titleId)
}
{
  let id: number | null = null
  for (const zeile of readFileSync('data/dub-confirmed.yaml', 'utf8').split('\n')) {
    const neu = /^- anilistId: (\d+)/.exec(zeile)
    if (neu) id = Number(neu[1])
    const url = /^ {2}url: (\S+)/.exec(zeile)?.[1]
    if (url && id && titel.has(id)) {
      const k = kern(url)
      if (!k) continue
      if (!jeAdresse.has(k)) jeAdresse.set(k, new Set())
      jeAdresse.get(k)!.add(id)
    }
  }
}

const ankerCache = new Map<number, TmdbFolge[] | null>()
function anker(id: number): TmdbFolge[] | null {
  if (ankerCache.has(id)) return ankerCache.get(id)!
  const t = titel.get(id)
  let a: TmdbFolge[] | null = null
  const asId = asKennung[String(id)]?.anisearchId
  const as = asId ? asFolgen[String(asId)] : undefined
  if (as?.folgen?.length) a = [...ausAnisearch(as.folgen), ...englischeSchreibweisen(as.folgen)]
  else if (t && tmdb[String(id)]) {
    const s = findeStaffel(tmdb[String(id)]!.folgen, t.episodes ?? null, t.jpYear ?? null)
    if (s !== null) a = tmdb[String(id)]!.folgen.filter((f) => f.s === s)
  }
  ankerCache.set(id, a)
  return a
}

const jeFolge = new Map<string, Zeile[]>()
for (const z of zeilen) {
  const k = `${z.plattform}:${z.asin ?? z.gti}`
  jeFolge.set(k, [...(jeFolge.get(k) ?? []), z])
}

const zaehl: Record<string, number> = {}
const offenJeReihe = new Map<string, number>()
const gegenJePaar = new Map<string, number>()
const beispiele: Record<string, string[]> = {}
const fall = (art: string, text: string) => {
  zaehl[art] = (zaehl[art] ?? 0) + 1
  if ((beispiele[art] ??= []).length < 6) beispiele[art]!.push(text)
}
for (const [k, liste] of jeFolge) {
  const jung = [...liste].sort((a, b) => b.gemeldet_am.localeCompare(a.gemeldet_am))[0]!
  const kandidaten = new Set<number>()
  for (const z of liste) {
    if (z.titel_id != null && titel.has(z.titel_id)) kandidaten.add(z.titel_id)
    for (const id of jeAdresse.get(kern(z.url)) ?? []) kandidaten.add(id)
  }
  if (!kandidaten.size) {
    fall('ohne', `${k} ${jung.titel ?? ''}`)
    continue
  }
  const treffer: { id: number; unsere: number; grund: string }[] = []
  for (const id of kandidaten) {
    const a = anker(id)
    if (!a) continue
    const [p] = ordneZu(
      [{ nummer: jung.nummer, titel: jung.titel, datum: jung.erschienen?.slice(0, 10) ?? null, minuten: null }],
      a,
    )
    if (p?.unsere != null) treffer.push({ id, unsere: p.unsere, grund: p.grund })
  }
  const namen = [...kandidaten].map((id) => `${id} ${titel.get(id)?.titleDe ?? ''}`).join(' | ')
  if (treffer.length === 1) {
    fall('eindeutig', `${k} → ${treffer[0]!.id} F${treffer[0]!.unsere} (${treffer[0]!.grund})`)
    /* Gegenprobe: Widerspricht die Zuordnung dem Auftrag, unter dem gemeldet wurde? */
    const auftrag = new Set(liste.map((z) => z.titel_id).filter((v) => v != null))
    fall(
      !auftrag.size ? 'gegenprobe: ohne Auftrag' : auftrag.has(treffer[0]!.id) ? 'gegenprobe: wie Auftrag' : 'gegenprobe: gegen Auftrag',
      `${k} „${jung.titel}" → ${treffer[0]!.id} ${titel.get(treffer[0]!.id)?.titleDe ?? ''} F${treffer[0]!.unsere}, Auftrag ${[...auftrag].map((id) => `${id} ${titel.get(id as number)?.titleDe ?? ''}`).join(', ')}`,
    )
    if (auftrag.size && !auftrag.has(treffer[0]!.id)) {
      const p = `${[...auftrag].map((id) => `${id} ${titel.get(id as number)?.titleDe ?? ''}`).join(', ')} → ${treffer[0]!.id} ${titel.get(treffer[0]!.id)?.titleDe ?? ''} (${treffer[0]!.grund})`
      gegenJePaar.set(p, (gegenJePaar.get(p) ?? 0) + 1)
    }
  }
  else if (treffer.length > 1) fall('strittig', `${k} „${jung.titel}" → ${treffer.map((t) => `${t.id} F${t.unsere}`).join(', ')}`)
  else if (kandidaten.size === 1) fall('titel', `${k} „${jung.titel}" → ${namen}`)
  else {
    const mitAnker = [...kandidaten].filter((id) => anker(id)).length
    fall(mitAnker ? 'offen, Anker trifft nicht' : 'offen, kein Kandidat hat Anker', `${k} „${jung.titel}" Kandidaten: ${namen}`)
    const reihe = [...kandidaten].sort().join('/')
    offenJeReihe.set(reihe, (offenJeReihe.get(reihe) ?? 0) + 1)
  }
}
console.log('\nGegen den Auftrag, je Paar Auftrag → Zuordnung:')
for (const [p, n] of [...gegenJePaar].sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${p}`)
console.log('\nOffen je Kandidatengruppe (größte 12):')
for (const [r, n] of [...offenJeReihe].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${n}  ${r.split('/').map((id) => `${id} ${titel.get(Number(id))?.titleDe ?? ''}${anker(Number(id)) ? '' : ' [kein Anker]'}`).join(' | ')}`)
}
console.log(`${jeFolge.size} Plattform-Folgen aus ${zeilen.length} Zeilen`)
for (const [art, n] of Object.entries(zaehl).sort((a, b) => b[1] - a[1])) {
  console.log(`\n${art}: ${n} (${Math.round((100 * n) / jeFolge.size)} %)`)
  for (const b of beispiele[art] ?? []) console.log(`  ${b}`)
}
