/**
 * **Laufender D1-Export: 503 mit `Retry-After`, und nichts geht still verloren** (17.10.2026).
 *
 * Am 16.10.2026 um 21:38:45 UTC antwortete die Meldung „Die Dinos sind los“ (Prime) mit 500: D1 wies sie ab
 * („Currently processing a long-running export.“), weil der Lauf `meldungskopie.yml` gerade exportierte.
 * Die Attrappe (echtes SQLite, `node:sqlite`, Migrationen des Workers) wirft diese Meldung ab einem gewählten
 * D1-Aufruf (Export beginnt mitten in der Anfrage) oder nur bei genau diesem (Export endet sofort wieder).
 * Für jeden Aufruf einer Meldung gilt: Antwort 503 mit `Retry-After` (oder 200, wenn nichts verloren ging),
 * und nach der Wiederholung stehen Meldung **und** Rohfolgen vollständig da. Gegenprobe: ein anderer Fehler bleibt 500.
 *
 * Aufruf: `npx tsx tools/worker-d1-export.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import worker from '../worker/src/index.ts'
import { mitAuffangnetz } from '../worker/src/auffangnetz.ts'
import { EXPORT_PAUSE_SEKUNDEN, EXPORT_PAUSE_TEXT, istD1Export, istD1Tageslimit } from '../worker/src/d1-limit.ts'
import { ablehnungLoggen, ausnahmeAls, kennungDerMeldung } from '../worker/src/pruefung-ablehnung.ts'
import { verarbeiteStapel } from '../worker/src/pruefung-stapel.ts'
import { migriere } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  if (!bedingung) console.log(`  FEHL ${text}`)
  if (!bedingung) fehler++
}
const protokoll: string[] = []
console.error = (...a: unknown[]) => void protokoll.push(a.map(String).join(' '))
console.warn = (...a: unknown[]) => void protokoll.push(a.map(String).join(' '))

/** Wortlaut aus dem Worker-Log vom 16.10.2026 21:38:45 UTC. */
const EXPORT = () => new Error('D1_ERROR: Currently processing a long-running export.')
const ANDERER = () => new Error('D1_ERROR: boom')
const URSPRUNG = 'https://anime.example'

type Anweisung = {
  run: () => Promise<unknown>
  all: () => Promise<unknown>
  first: () => Promise<unknown>
  bind: (...w: unknown[]) => Anweisung
  /** Ausführen ohne eigenen Aufruf (für `batch`). */
  roh: () => unknown
}
/** `ab`: ab diesem D1-Aufruf wirft jeder; `nur`: nur dieser. Ein `batch` ist ein Aufruf und läuft ganz oder gar nicht (wie D1). */
type Stoerung = { schritt: number; ab?: number; nur?: number; fehler: () => Error }

function d1(db: DatabaseSync, s: Stoerung) {
  const tor = () => {
    const i = s.schritt++
    if ((s.ab !== undefined && i >= s.ab) || i === s.nur) throw s.fehler()
  }
  const schreibe = (sql: string, werte: unknown[]) => {
    const r = db.prepare(sql).run(...(werte as never[]))
    return { meta: { changes: Number(r.changes), rows_written: Number(r.changes), rows_read: 0 } }
  }
  const anweisung = (sql: string, werte: unknown[] = []): Anweisung => ({
    bind: (...w) => anweisung(sql, w),
    roh: () => schreibe(sql, werte),
    run: async () => {
      tor()
      return schreibe(sql, werte)
    },
    all: async () => {
      tor()
      return { results: db.prepare(sql).all(...(werte as never[])), meta: { rows_written: 0, rows_read: 0 } }
    },
    first: async () => {
      tor()
      return db.prepare(sql).get(...(werte as never[])) ?? null
    },
  })
  return {
    prepare: (sql: string) => anweisung(sql),
    batch: async (liste: Anweisung[]) => {
      tor()
      return liste.map((a) => a.roh())
    },
  }
}

const umgebung = (db: DatabaseSync, s: Stoerung) =>
  ({ LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', ALLOWED_ORIGIN: URSPRUNG, TITELZEILE_PLATTFORMEN: '', DB: d1(db, s) }) as never

globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] }))) as typeof fetch
Object.assign(globalThis, { caches: { default: { match: async () => undefined, put: async () => undefined, delete: async () => false } } })
const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext

const sende = (pfad: string, body: unknown, env: never) =>
  worker.fetch(
    new Request(`https://worker.test${pfad}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' }, body: JSON.stringify(body) }),
    env,
    ctx,
  )

/** Eine Prime-Meldung mit drei Rohfolgen (gti g1–g3); `ton` unterscheidet zwei Fassungen derselben Seite. */
const meldung = (ton: string) => ({
  plattform: 'primevideo',
  url: 'https://www.amazon.de/gp/video/detail/B00LDDJYB4',
  suchUrl: 'https://www.amazon.de/s?k=die+dinos+sind+los',
  seiten_kennung: 'B00LDDJYB4',
  vorhanden: 'ja',
  ton_de: ton,
  art: 'gemessen',
  titel: 'Die Dinos sind los',
  staffel: 1,
  rohfolgen: ['g1', 'g2', 'g3'].map((gti, i) => ({ gti, nummer: i + 1, vorhanden: 'ja', ton_de: ton })),
})

const zahl = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { n: number }).n)

/** Der Stand nach der Wiederholung: genau eine offene Meldung der Fassung `ton`, und deren drei Rohfolgen je einmal. */
function vollstaendig(db: DatabaseSync, ton: string): string | null {
  const meldungen = db.prepare('SELECT ton_de FROM pruefung WHERE uebernommen = 0').all() as { ton_de: string }[]
  if (meldungen.length !== 1 || meldungen[0]!.ton_de !== ton) return `Meldungen: ${JSON.stringify(meldungen)}`
  const roh = db.prepare('SELECT gti, ton_de FROM prime_folge WHERE uebernommen = 0 ORDER BY gti').all() as { gti: string; ton_de: string }[]
  const erwartet = ['g1', 'g2', 'g3'].map((gti) => ({ gti, ton_de: ton }))
  return JSON.stringify(roh) === JSON.stringify(erwartet) ? null : `Rohfolgen: ${JSON.stringify(roh)}`
}

/** Datenbank mit der älteren Fassung `nein`; danach meldet derselbe Klick `ja` (ersetzt Meldung und Rohfolgen). */
async function mitAlterFassung(s: Stoerung) {
  const db = migriere(new DatabaseSync(':memory:'))
  const env = umgebung(db, s)
  const r = await sende('/pruefung', meldung('nein'), env)
  pruefe(r.status === 200, `Vorbereitung: alte Fassung gespeichert (${r.status})`)
  s.schritt = 0
  return { db, env }
}

/** Wie viele D1-Aufrufe die neue Fassung ohne Störung braucht. */
async function aufrufeOhneStoerung(): Promise<number> {
  const s: Stoerung = { schritt: 0, fehler: EXPORT }
  const { db, env } = await mitAlterFassung(s)
  const r = await sende('/pruefung', meldung('ja'), env)
  pruefe(r.status === 200 && vollstaendig(db, 'ja') === null, 'ohne Störung: neue Fassung vollständig')
  return s.schritt
}

/** Ein Klick mit Störung, dann derselbe Klick ohne: Antwort 503 (oder 200) und am Ende alles da. */
async function klickMitStoerung(art: 'ab' | 'nur', k: number): Promise<number> {
  const s: Stoerung = { schritt: 0, fehler: EXPORT }
  const { db, env } = await mitAlterFassung(s)
  s[art] = k
  const erster = await sende('/pruefung', meldung('ja'), env)
  const text = ((await erster.json()) as { error?: string }).error
  if (erster.status === 503) {
    pruefe(erster.headers.get('Retry-After') === String(EXPORT_PAUSE_SEKUNDEN), `${art} ${k}: Retry-After ${EXPORT_PAUSE_SEKUNDEN}`)
    pruefe(erster.headers.get('Access-Control-Allow-Origin') === '*', `${art} ${k}: CORS * (die Erweiterung liest die Antwort)`)
    pruefe(text === EXPORT_PAUSE_TEXT, `${art} ${k}: verständlicher Text (${text})`)
  } else pruefe(erster.status === 200, `${art} ${k}: erster Klick 503 oder 200, war ${erster.status} (${text})`)
  s.ab = undefined
  s.nur = undefined
  const zweiter = await sende('/pruefung', meldung('ja'), env)
  pruefe(zweiter.status === 200, `${art} ${k}: zweiter Klick 200 (${zweiter.status})`)
  const rest = vollstaendig(db, 'ja')
  pruefe(rest === null, `${art} ${k}: nach der Wiederholung vollständig (${rest})`)
  return erster.status
}

async function jederSchritt() {
  const n = await aufrufeOhneStoerung()
  pruefe(n >= 8, `Die Meldung braucht mehrere D1-Aufrufe (${n})`)
  const status = { ab: [] as number[], nur: [] as number[] }
  for (let k = 0; k < n; k++) {
    status.ab.push(await klickMitStoerung('ab', k))
    status.nur.push(await klickMitStoerung('nur', k))
  }
  pruefe(status.ab[0] === 503, 'Export ab dem ersten Aufruf (der Fall vom 16.10.2026): 503')
  pruefe(status.ab.filter((x) => x === 503).length >= n - 2, `ab Schritt k: fast jeder Fall 503 (${status.ab.join(',')})`)
  console.log(`  ok   ${n} D1-Aufrufe, je Schritt gestört (ab: ${status.ab.join(',')}; nur: ${status.nur.join(',')})`)
}

/** Das Tageslimit weist ebenso vorübergehend ab: Auch dann holt der nächste Klick die Rohfolgen nach (`istD1Abweisung`). */
async function tageslimitJederSchritt() {
  const status: number[] = []
  for (let k = 0; k < 8; k++) {
    const s: Stoerung = { schritt: 0, fehler: () => new Error('D1_ERROR: Exceeded free tier daily row write limit') }
    const { db, env } = await mitAlterFassung(s)
    s.nur = k
    status.push((await sende('/pruefung', meldung('ja'), env)).status)
    s.nur = undefined
    await sende('/pruefung', meldung('ja'), env)
    const rest = vollstaendig(db, 'ja')
    pruefe(rest === null, `Tageslimit nur ${k}: nach der Wiederholung vollständig (${rest})`)
  }
  console.log(`  ok   Tageslimit je Schritt: ${status.join(',')}`)
}

/** Gegenprobe je Schritt: Ein anderer Fehler beim Laden, Löschen oder Einfügen der Rohfolgen reißt die Meldung nicht mit (wie bisher). */
async function andererFehlerJederSchritt() {
  const status: number[] = []
  for (let k = 0; k < 8; k++) {
    const s: Stoerung = { schritt: 0, fehler: ANDERER }
    const { env } = await mitAlterFassung(s)
    s.nur = k
    status.push((await sende('/pruefung', meldung('ja'), env)).status)
  }
  pruefe(status.join() === '200,500,200,200,200,500,500,200', `anderer Fehler je Schritt: Rohfolgen-Schritte bleiben 200 (${status.join()})`)
}

/** Gegenprobe: Ein anderer D1-Fehler bleibt 500 ohne Retry-After, mit dem bisherigen Grund. */
async function gegenprobe() {
  const s: Stoerung = { schritt: 0, fehler: ANDERER }
  const { env } = await mitAlterFassung(s)
  s.ab = 0
  const r = await sende('/pruefung', meldung('ja'), env)
  const j = (await r.json()) as { error?: string }
  pruefe(r.status === 500 && r.headers.get('Retry-After') === null, `anderer Fehler: 500 ohne Retry-After (${r.status})`)
  pruefe(j.error === 'ausnahme Error', `anderer Fehler: Grund wie bisher (${j.error})`)
  pruefe(istD1Export(EXPORT()) && !istD1Export(ANDERER()) && !istD1Export(undefined), 'istD1Export erkennt nur die Export-Meldung')
  pruefe(!istD1Tageslimit(EXPORT()), 'Export ist kein Tageslimit (Retry-After nicht bis Mitternacht)')
  /* Gegenproben mit fast gleichem Text: nur der Wortlaut des laufenden Exports zählt. */
  pruefe(!istD1Export(new Error('D1_ERROR: cannot export this table')), 'istD1Export: "export" allein genügt nicht')
  pruefe(!istD1Export(new Error('D1_ERROR: long-running query timed out')), 'istD1Export: "long-running" allein genügt nicht')
  pruefe(EXPORT_PAUSE_SEKUNDEN === 30, `Pause 30 s wie gemessen, fest eingetragen (${EXPORT_PAUSE_SEKUNDEN})`)
}

/** Einzelmeldung bei laufendem Export (der Fall vom 16.10.2026): 503 und eine Protokollzeile mit der Kennung der Seite. */
async function protokollzeileBeiExport() {
  const s: Stoerung = { schritt: 0, fehler: EXPORT }
  const { env } = await mitAlterFassung(s)
  s.ab = 0
  protokoll.length = 0
  const r = await sende('/pruefung', meldung('ja'), env)
  pruefe(r.status === 503, `Einzelmeldung bei Export: 503 (${r.status})`)
  const zeilen = protokoll.filter((z) => z.includes('meldung_abgelehnt')).map((z) => JSON.parse(z) as { kennung?: string; status?: number })
  pruefe(zeilen.length === 1 && zeilen[0]!.kennung === 'B00LDDJYB4', `Einzelmeldung bei Export: Protokollzeile mit Kennung (${protokoll.join(' | ')})`)
  pruefe(zeilen[0]?.status === 503, `Einzelmeldung bei Export: Protokollzeile Status 503 (${zeilen[0]?.status})`)
}

/** Andere schreibende Routen laufen über dasselbe Auffangnetz: `/lauf` (Sammler) und `/status`. */
async function andereRouten() {
  const s: Stoerung = { schritt: 0, ab: 0, fehler: EXPORT }
  const env = umgebung(migriere(new DatabaseSync(':memory:')), s)
  const lauf = await sende('/lauf', { lauf_id: '1', zustand: 'ok' }, env)
  pruefe(lauf.status === 503 && lauf.headers.get('Retry-After') === String(EXPORT_PAUSE_SEKUNDEN), `/lauf: 503 mit Retry-After (${lauf.status})`)
  pruefe(lauf.headers.get('Access-Control-Allow-Origin') === '*', '/lauf: CORS *')
  const status = await worker.fetch(new Request('https://worker.test/status'), env, ctx)
  pruefe(status.status === 503 && status.headers.get('Access-Control-Allow-Origin') === URSPRUNG, `/status: 503 mit eigenem Ursprung (${status.status})`)
  protokoll.length = 0
  const anders = await mitAuffangnetz('/prefs', {}, async () => {
    throw ANDERER()
  })
  pruefe(anders.status === 500 && anders.headers.get('Retry-After') === null, `Auffangnetz: anderer Fehler 500 (${anders.status})`)
  pruefe(protokoll.some((z) => z.startsWith('[fetch] Fehler')) && !protokoll.some((z) => z.includes('d1_export')), 'Auffangnetz: anderer Fehler als Fehler geloggt')
  protokoll.length = 0
  const netz = await mitAuffangnetz('/prefs', {}, async () => {
    throw EXPORT()
  })
  pruefe(!protokoll.some((z) => z.startsWith('[fetch] Fehler')), 'Auffangnetz: Export ist kein Fehler im Log')
  pruefe(netz.status === 503 && ((await netz.json()) as { error: string }).error === EXPORT_PAUSE_TEXT, 'Auffangnetz: 503 mit Export-Text')
  pruefe(protokoll.some((z) => z.includes('d1_export_abgewiesen') && z.includes('/prefs')), 'Auffangnetz: zählbare Logzeile mit Pfad')
}

/** Im Stapel scheitert nur die betroffene Meldung, mit 503 und demselben Satz. */
async function stapel() {
  const a = ausnahmeAls(EXPORT())
  pruefe(a.status === 503 && a.grund === EXPORT_PAUSE_TEXT && /long-running export/.test(a.fehler ?? ''), 'ausnahmeAls: Export -> 503, Satz, Meldung fürs Protokoll')
  pruefe(ausnahmeAls(ANDERER()).status === 500, 'ausnahmeAls: anderer Fehler bleibt 500')
  const m = (n: number) => ({ plattform: 'netflix', url: `https://www.netflix.com/title/${n}` })
  const ergebnisse = await verarbeiteStapel([m(1), m(2), m(3)], async (x) => {
    if ((x as { url: string }).url.endsWith('/2')) throw EXPORT()
    return { ok: true, befund: 'ja' }
  })
  pruefe(ergebnisse.map((e) => (e.ok ? 200 : e.status)).join() === '200,503,200', `Stapel: nur die mittlere 503 (${JSON.stringify(ergebnisse)})`)
}

/** Kennung im Protokoll (Log vom 16.10.2026: `kennung: "s"`): die Seite vor der Adresse, eine Suchadresse nennt keinen Titel. */
function kennungImProtokoll() {
  const such = 'https://www.amazon.de/s?k=die+dinos+sind+los'
  const faelle: [Record<string, unknown>, string | null, string][] = [
    [{ url: such, suchUrl: such, seiten_kennung: 'B00LDDJYB4' }, 'B00LDDJYB4', 'Suchauftrag mit Seite -> ASIN'],
    [{ url: such, suchUrl: such }, null, 'Suchauftrag ohne Seite -> keine Kennung, nicht „s“'],
    [{ url: 'https://www.amazon.de/gp/video/detail/B0URL', suchUrl: such, seiten_kennung: 'B0SEITE' }, 'B0SEITE', 'Seite schlägt Adresse'],
    [{ url: 'https://www.netflix.com/title/80000002', seiten_kennung: 'a.b' }, '80000002', 'ungültige Seite -> Adresse'],
    [{ url: 'https://www.netflix.com/title/80000003' }, '80000003', 'ohne Seite -> Adresse'],
  ]
  for (const [m, soll, text] of faelle) {
    const ist = kennungDerMeldung(m)
    pruefe(ist === soll, `kennungDerMeldung: ${text} (${ist})`)
  }
  protokoll.length = 0
  ablehnungLoggen('pruefung', ausnahmeAls(EXPORT()), meldung('ja'))
  ablehnungLoggen('pruefung', ausnahmeAls(EXPORT()), { ...meldung('ja'), url: such, suchUrl: such })
  const kennungen = protokoll.map((z) => (JSON.parse(z) as { kennung?: string }).kennung)
  pruefe(kennungen.join() === 'B00LDDJYB4,B00LDDJYB4', `Protokoll: Kennung der Seite (${kennungen.join()})`)
}

await jederSchritt()
await tageslimitJederSchritt()
await andererFehlerJederSchritt()
await gegenprobe()
await protokollzeileBeiExport()
await andereRouten()
await stapel()
kennungImProtokoll()
if (fehler) {
  console.log(`\n${fehler} Prüfung(en) rot`)
  process.exit(1)
}
console.log('\nworker-d1-export.test: Alles in Ordnung.')
