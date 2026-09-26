/**
 * **Stufe 3: die Urteile je Titel × Anbieter × Folge berechnen und festhalten** (22.09.2026).
 *
 * Quellen sind die Beobachtungen aus D1 — die Rohfolgen (`?rohfolgen=1&alle=1`) über die Zuordnung
 * aus Stufe 2 (`data/folgen-zuordnung.json`) und die Meldungen mit Folgennummer (`?alle=1`). Die
 * Regeln stehen in `lib/urteil-je-folge.ts`; hier wird nur geholt, zusammengesetzt und geschrieben.
 *
 * **Der Bau liest die Datei noch nicht.** Bis Stufe 4 ist sie ein Messwert: Wie viele Folgen tragen
 * ein Urteil, wie viele sind unbekannt, und wie steht es gegen den heutigen Datensatz
 * (`tools/poc-urteil/urteil-folge.ts`).
 *
 * Aufruf: LAUF_TOKEN=… npx tsx pipeline/fetch-urteile.ts
 */
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { folgenDerMeldung, urteileJeFolge, type Urteil, type UrteilBeobachtung } from './lib/urteil-je-folge.ts'
import type { Title } from '../shared/types.ts'
import { adressKern } from './lib/dub-confirmed.ts'
import type { FolgenZuordnung } from './lib/folgen-je-folge.ts'

const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
const TOKEN = process.env.LAUF_TOKEN ?? ''
const ZIEL = 'data/urteile.json'

/* Kanal-Seiten: ohne das Abo des Kanals zeigt Prime keine Tonspuren (CLAUDE.md). */
const KANAL = /crunchyroll|aniverse|animedigital|pokemon|prosieben|kixi|midnight|arthouse|rtl/i

interface RohMeldung {
  plattform: string
  url: string
  befund: string | null
  folge_nr: number | null
  teil_von: number | null
  teil_bis: number | null
  titel_id: number | null
  notiz: string | null
  abos: string | null
  gemeldet_am: string
  vorhanden: string | null
  ton_de: string | null
  art: string | null
}
interface RohFolge {
  plattform: string
  url: string
  asin: string | null
  gti: string | null
  sprachen: string | null
  gemeldet_am: string
  vorhanden: string | null
  ton_de: string | null
}

/** Holt eine seitenweise Liste; `null` heißt Störung — dann wird nichts geschrieben. */
async function seiten<T>(pfad: string, feld: string): Promise<T[] | null> {
  const alle: T[] = []
  let nach = 0
  for (;;) {
    const r = await fetch(`${WORKER}/pruefung?${pfad}&nach=${nach}&token=${encodeURIComponent(TOKEN)}`)
    if (!r.ok) {
      warn(`Worker antwortet ${r.status} (${pfad}) — Lauf endet ohne zu schreiben.`)
      return null
    }
    const j = (await r.json()) as Record<string, unknown>
    alle.push(...((j[feld] as T[]) ?? []))
    const weiter = j.weiter as number | null
    if (weiter == null) return alle
    nach = weiter
  }
}

async function main() {
  if (!TOKEN) {
    warn('LAUF_TOKEN fehlt — nichts geholt.')
    return
  }
  const meldungen = await seiten<RohMeldung>('alle=1', 'pruefungen')
  const rohfolgen = await seiten<RohFolge>('rohfolgen=1&alle=1', 'folgen')
  if (!meldungen || !rohfolgen) return
  const zuordnung = readJson<Record<string, FolgenZuordnung>>('data/folgen-zuordnung.json', {})

  /*
    Welche Adresse ist eine Kanal-Seite? Das steht in der Meldung (`abos`), gilt aber auch für die
    Rohfolgen derselben Adresse: Dort trägt die Zeile nur Tonspuren, nicht den Kanal.
  */
  const kanalAdresse = new Set(meldungen.filter((m) => KANAL.test(m.abos ?? '')).map((m) => adressKern(m.url)))

  const beobachtungen: UrteilBeobachtung[] = []
  for (const f of rohfolgen) {
    const z = zuordnung[`${f.plattform}:${f.asin ?? f.gti}`]
    if (!z?.titel || !z.folge) continue
    /* Eine Rohfolge ohne Tonspuren ist eine Störung, keine Beobachtung (Szenario 10). */
    let sprachen: string[] = []
    try {
      sprachen = JSON.parse(f.sprachen ?? '[]') as string[]
    } catch {
      sprachen = []
    }
    const vorhanden = f.vorhanden ?? (sprachen.length ? 'ja' : null)
    if (!vorhanden) continue
    const tonDe = f.ton_de ?? (sprachen.some((s) => /deutsch|german|^de(\||$)/i.test(s)) ? 'ja' : 'nein')
    beobachtungen.push({
      titel: z.titel,
      anbieter: f.plattform,
      folge: z.folge,
      vorhanden,
      tonDe,
      art: 'gemessen',
      tag: f.gemeldet_am.slice(0, 10),
      kanal: tonDe === 'nein' && kanalAdresse.has(adressKern(f.url)),
    })
  }
  /* Ein Einzelwerk (Film, einteiliges Special) hat genau Folge 1 — siehe `folgenDerMeldung`. */
  const titelListe = readJson<Title[] | { titles: Title[] }>('public/data/titles.json', [])
  const einzel = new Set(
    (Array.isArray(titelListe) ? titelListe : titelListe.titles)
      .filter((t) => t.format === 'MOVIE' || t.episodes === 1)
      .map((t) => t.id),
  )
  const verworfen: Record<string, number> = {}
  /* Eine Meldung ohne die Felder aus Migration 034 trägt nur `befund`. */
  for (const m of meldungen) {
    const vorhanden = m.vorhanden ?? (m.befund === 'weg' ? 'nein' : m.befund ? 'ja' : null)
    const tonDe = m.ton_de ?? (m.befund === 'dub' ? 'ja' : m.befund === 'kein_dub' ? 'nein' : 'unbekannt')
    const spanne = folgenDerMeldung(m, vorhanden, (id) => einzel.has(id))
    if ('verworfen' in spanne) {
      verworfen[spanne.verworfen] = (verworfen[spanne.verworfen] ?? 0) + 1
      continue
    }
    const { von, bis } = spanne
    /* `folgenDerMeldung` hat beide schon geprüft — ohne Titel oder Befund gibt es keine Spanne. */
    if (!m.titel_id || !vorhanden) continue
    const art = m.art === 'angenommen' || /ANGENOMMEN/.test(m.notiz ?? '') ? 'angenommen' : 'gemessen'
    for (let n = von; n <= bis; n++) {
      beobachtungen.push({
        titel: m.titel_id,
        anbieter: m.plattform,
        folge: n,
        vorhanden,
        tonDe,
        art,
        tag: m.gemeldet_am.slice(0, 10),
        kanal: tonDe === 'nein' && KANAL.test(m.abos ?? ''),
      })
    }
  }

  const urteile = urteileJeFolge(beobachtungen)
  writeJson(ZIEL, urteile, true)
  const zaehl: Record<string, number> = {}
  for (const u of Object.values(urteile) as Urteil[]) {
    const k = u.grund ? `${u.urteil} (${u.grund})` : u.urteil
    zaehl[k] = (zaehl[k] ?? 0) + 1
  }
  log(
    `${Object.keys(urteile).length} Urteile je Titel × Anbieter × Folge aus ${beobachtungen.length} Beobachtungen → ${ZIEL}: ` +
      Object.entries(zaehl)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${n} ${k}`)
        .join(', '),
  )
  /* Jeder Verwerfungspfad mit Zahl (Skill `stille-ausfaelle-verhindern`). */
  log(
    'Meldungen ohne Beobachtung je Folge: ' +
      (Object.entries(verworfen)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${n} ${k}`)
        .join(', ') || 'keine'),
  )
}

if (process.argv[1]?.endsWith('fetch-urteile.ts')) await main()
