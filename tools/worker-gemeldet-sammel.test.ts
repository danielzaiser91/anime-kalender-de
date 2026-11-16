/**
 * **`?gemeldet-liste=` — viele Adressen, eine Anfrage** (16.11.2026, Issue 4058). Gegen echte SQLite mit den Migrationen:
 * dieselbe Antwort je Adresse wie `?gemeldet=`, leere Liste, unbekannte Adresse, Altzeilen ohne Titelzeile, Riegel.
 *
 * Aufruf: `npx tsx tools/worker-gemeldet-sammel.test.ts`
 */
import { handlePruefung } from '../worker/src/pruefung.ts'
import { SAMMEL_MAX } from '../worker/src/pruefung-gemeldet-sammel.ts'
import { lies, neueDatenbank, post, umgebung, type Hilfe } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}

const VOR = 'https://www.disneyplus.com/browse/entity-'
const folge = (url: string, nr: number) => ({
  plattform: 'disneyplus',
  url,
  titelId: 101,
  sprachen: ['de', 'ja'],
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  titel: 'T',
  folge: `F${nr}`,
  folge_nr: nr,
  staffel: 1,
  staffeln: { anbieter: 'disney', staffeln: [{ nr: 1, folgen: 3 }] },
  serientitel: 'T',
  rohfolgen: [
    { gti: `g-${url.slice(-1)}-${nr}`, nummer: nr, titel: `F${nr}`, sprachen: ['de', 'ja'], staffelNr: 1, vorhanden: 'ja', ton_de: 'ja' },
  ],
})

const db = neueDatenbank()
const h: Hilfe = { geschrieben: 0 }
const env = umgebung(db, h)
await handlePruefung(post(folge(`${VOR}a`, 1)), env)
await handlePruefung(post(folge(`${VOR}a`, 2)), env)
/* Adresse ohne Titelzeile: Altzeile in `pruefung` (Schalter leer = alter Weg). */
await handlePruefung(post(folge(`${VOR}b`, 5)), umgebung(db, h, false))

type Sammel = { adressen?: Record<string, { nummern: number[]; paare: unknown[] }> }
const sammel = (suche: string) => lies(env, suche) as Promise<Sammel>
const einzel = async (u: string) => (await lies(env, `gemeldet=${encodeURIComponent(u)}`)) as { nummern: number[] }

const r = await sammel(`gemeldet-liste=${encodeURIComponent('a,b,zz')}&vor=${encodeURIComponent(VOR)}`)
pruefe(JSON.stringify(r.adressen?.[`${VOR}a`]) === JSON.stringify(await einzel(`${VOR}a`)) && r.adressen![`${VOR}a`]!.nummern.length === 2, 'Titelzeile: gleiche Antwort wie ?gemeldet=')
pruefe(JSON.stringify(r.adressen?.[`${VOR}b`]) === JSON.stringify(await einzel(`${VOR}b`)) && r.adressen![`${VOR}b`]!.nummern[0] === 5, 'Altzeilen ohne Titelzeile: gleiche Antwort wie ?gemeldet=')
pruefe(JSON.stringify(r.adressen?.[`${VOR}zz`]) === JSON.stringify({ nummern: [], paare: [] }), 'unbekannte Adresse: leer, nicht weggelassen')

const leer = await sammel('gemeldet-liste=')
pruefe(JSON.stringify(leer.adressen) === '{}', 'leere Liste: leere Antwort')

const lang = Array.from({ length: SAMMEL_MAX }, (_, i) => `x${i}`).join(',')
const viele = await sammel(`gemeldet-liste=${lang}&vor=${encodeURIComponent(VOR)}`)
pruefe(Object.keys(viele.adressen ?? {}).length === SAMMEL_MAX, `Liste am Riegel (${SAMMEL_MAX}): alle beantwortet`)
const zuviele = await handlePruefung(new Request(`https://worker.test/pruefung?gemeldet-liste=${lang},y`), env)
pruefe(zuviele.status === 400, 'über dem Riegel: 400')

const doppelt = await sammel(`gemeldet-liste=a,a&vor=${encodeURIComponent(VOR)}`)
pruefe(Object.keys(doppelt.adressen ?? {}).length === 1, 'doppelte Adresse zählt einmal')

/* Budget: Adressen ohne Titelzeile brauchen zwei Abfragen (Titelzeile, Altzeilen); je `DB.batch` höchstens 50 Anweisungen. */
{
  const batches: number[] = []
  const echt = (env as unknown as { DB: { prepare: (s: string) => unknown; batch: (l: unknown[]) => Promise<unknown> } }).DB
  const gezaehlt = { ...(env as object), DB: { prepare: (s: string) => echt.prepare(s), batch: (l: unknown[]) => (batches.push(l.length), echt.batch(l)) } } as never
  const davor = h.geschrieben
  const anfrage = new Request(`https://worker.test/pruefung?gemeldet-liste=${lang}&vor=${encodeURIComponent(VOR)}`)
  const antwort = await handlePruefung(anfrage, gezaehlt)
  pruefe(antwort.status === 200 && batches.length === 2 * Math.ceil(SAMMEL_MAX / 50), `${SAMMEL_MAX} Adressen ohne Titelzeile: 5 + 5 Batches (${batches.length})`)
  pruefe(Math.max(...batches) <= 50 && batches.reduce((a, b) => a + b, 0) === 2 * SAMMEL_MAX, `höchstens 50 Anweisungen je Batch (größter: ${Math.max(...batches)}), je Adresse zwei`)
  pruefe(h.geschrieben === davor, 'Lesen schreibt nichts')
}

process.exit(fehler ? 1 : 0)
