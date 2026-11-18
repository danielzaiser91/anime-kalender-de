/**
 * **Erweiterungsversion in Netflix-Meldungen** (18.11.2026, Migration 065): Der Worker speichert `version` aus dem Rumpf an jedem
 * Ort, an dem eine Netflix-Meldung landet — Titelzeile (Stelle 16 im Eintrag), `pruefung.ext_version` (Anbieter ohne Titelzeile)
 * und `pruefung_zurueck.ext_version` (Zurückstellungen) — und nimmt Meldungen ohne Feld weiter an (Version leer). Die Version
 * zählt nie als Änderung: ein Update der Erweiterung schreibt weder eine neue Fassung noch eine neue Zeile.
 * Der Rumpf der Meldung ist der von `beobachtung()` in `extension/melder.js` (Gegenstück: `extension/netflix-meldung-version.test.cjs`).
 *
 * Aufruf: `npx tsx tools/worker-meldung-version.test.ts`
 */
import { handlePruefung } from '../worker/src/pruefung.ts'
import { lies as liesTitelzeile } from '../worker/src/titelzeile-format.ts'
import { neueDatenbank, post, umgebung, zahl } from './worker-titelzeile-hilfe.ts'
import { festeUhr } from './feste-uhr.ts'
import { createHash } from 'node:crypto'
import { meldungsHash } from '../worker/src/pruefung-unveraendert.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string, gefunden?: unknown) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}${bedingung || gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
  if (!bedingung) fehler++
}
festeUhr('2026-11-18T12:00:00Z')
console.error = () => {}
console.warn = () => {}

const URL_NF = 'https://www.netflix.com/title/81000009'
/** Wie `totMelden` in `extension/melder.js`: „nicht bei Netflix“ (ohne Folge), `beobachtung(false)` samt Version. */
const tot = (version?: unknown) => ({
  plattform: 'netflix',
  url: URL_NF,
  titelId: 501,
  sprachen: [],
  vorhanden: 'nein',
  art: 'gemessen',
  notiz: 'Umleitung auf Startseite',
  ...(version === undefined ? {} : { version }),
})
/** Eine Folge wie der Durchgang sie meldet (`beobachtung(true, …)`). */
const folge = (nr: number, version?: unknown) => ({
  plattform: 'netflix',
  url: URL_NF,
  titel: 'Netflix-Serie',
  staffeln: [{ nr: 1, folgen: 10 }],
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  folge_nr: nr,
  staffel: 1,
  ...(version === undefined ? {} : { version }),
})
const antwort = async (r: Response) => (await r.json()) as Record<string, unknown>
const zeilen = (db: ReturnType<typeof neueDatenbank>) => (db.prepare("SELECT daten FROM titel_zeile WHERE plattform = 'netflix'").all() as { daten: string }[]).map((z) => liesTitelzeile(z.daten))

console.log('Titelzeile (Netflix, wie wrangler.toml)')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, 'disneyplus,netflix')
  pruefe((await antwort(await handlePruefung(post(tot('4.32.0')), env))).ok === true, 'Meldung mit Version wird angenommen')
  const e = zeilen(db)[0]?.f[0]
  pruefe(e?.[16] === '4.32.0', 'die Version steht in Stelle 16 des Eintrags', e)
  pruefe(e?.[14] === null && e?.[15] === null, 'Stellen 14 und 15 bleiben leer (JSON-Null, keine Lücke)', e)
  const gleich = await antwort(await handlePruefung(post(tot('4.33.0')), env))
  pruefe(gleich.unveraendert === true, 'dieselbe Meldung von einer neueren Version: unverändert, keine Änderung')
  pruefe(zeilen(db)[0]?.f[0]?.[16] === '4.32.0' && zeilen(db)[0]?.f[0]?.[13] === 0, 'Version und Fassung der Folge bleiben (keine neue Fassung durch den Versionswechsel)')
  const geaendert = await antwort(await handlePruefung(post({ ...tot('4.33.0'), notiz: 'Abspielfehler UI3012' }), env))
  pruefe(geaendert.unveraendert !== true && zeilen(db)[0]?.f[0]?.[16] === '4.33.0' && zeilen(db)[0]?.f[0]?.[13] === 1, 'eine inhaltliche Änderung trägt die Version der ändernden Erweiterung')
}
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, 'disneyplus,netflix')
  pruefe((await antwort(await handlePruefung(post(tot()), env))).ok === true, 'alte Meldung ohne Version: angenommen')
  const e = zeilen(db)[0]?.f[0]
  pruefe(e !== undefined && e.length === 14, 'ohne Version bleibt der Eintrag 14 Felder lang (wie vor Migration 065)', e)
  for (const schlecht of ['x'.repeat(21), 5, '4 32', null, '']) {
    const d = neueDatenbank()
    const r = await antwort(await handlePruefung(post(tot(schlecht)), umgebung(d, { geschrieben: 0 }, 'netflix')))
    pruefe(r.ok === true && zeilen(d)[0]?.f[0]?.length === 14, `unbrauchbare Version ${JSON.stringify(schlecht)}: Meldung gilt, Version bleibt leer`, r)
  }
  const grenze = neueDatenbank()
  await handlePruefung(post(tot('x'.repeat(20))), umgebung(grenze, { geschrieben: 0 }, 'netflix'))
  pruefe(zeilen(grenze)[0]?.f[0]?.[16] === 'x'.repeat(20), 'genau 20 Zeichen sind erlaubt')
  /* Deploy-Tag: der Bestandseintrag hat 14 Felder (ohne Version); dieselbe Meldung mit Version ändert nichts. */
  const alt = await antwort(await handlePruefung(post(tot('4.33.0')), env))
  const nach = zeilen(db)[0]?.f[0]
  pruefe(alt.unveraendert === true && nach?.length === 14 && nach?.[13] === 0, 'Bestandseintrag ohne Version, dieselbe Meldung mit Version: unverändert, 14 Felder, Fassung 0', [alt, nach])
}
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, 'netflix')
  const r = await antwort(await handlePruefung(post({ stapel: [folge(1, '4.32.0'), folge(2, '4.32.0')] }), env))
  const f = zeilen(db)[0]?.f ?? []
  pruefe(r.ok === true && f.length === 2 && f.every((x) => x[16] === '4.32.0'), 'Stapel (Randprobe): jede Folge trägt die Version', f)
}

console.log('pruefung (Anbieter ohne Titelzeile)')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, false)
  await handlePruefung(post(tot('4.32.0')), env)
  const version = () => (db.prepare('SELECT ext_version AS v FROM pruefung').all() as { v: string | null }[]).map((z) => z.v)
  pruefe(JSON.stringify(version()) === '["4.32.0"]', 'ext_version steht in der Zeile', version())
  const gleich = await antwort(await handlePruefung(post(tot('4.33.0')), env))
  pruefe(gleich.unveraendert === true && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1, 'dieselbe Meldung mit neuer Version: unverändert, keine zweite Zeile (Version nicht im Hash)')
  await handlePruefung(post({ ...tot('4.33.0'), url: 'https://www.netflix.com/title/81000010' }), env)
  await handlePruefung(post({ ...tot(), url: 'https://www.netflix.com/title/81000011' }), env)
  pruefe(JSON.stringify(version()) === '["4.32.0","4.33.0",null]', 'neue Zeilen tragen ihre Version, Meldungen ohne Angabe NULL', version())
}

console.log('pruefung: Durchgang und Randprobe tragen die Version auch in rohfolgen[0] (beobachtung() in melder.js)')
/** Wie der Durchgang meldet: `version` oben und in der einen Rohfolge. */
const durchgang = (nr: number, version: string) => ({
  ...folge(nr, version),
  folge: `8200000${nr}`,
  rohfolgen: [{ gti: `8200000${nr}`, nummer: nr, titel: `Folge ${nr}`, staffelText: 'Staffel 1', staffelNr: 1, vorhanden: 'ja', ton_de: 'ja', art: 'gemessen', version, roh: { liste: null } }],
})
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, false)
  const ids = () => (db.prepare('SELECT id FROM pruefung ORDER BY id').all() as { id: number }[]).map((z) => z.id)
  await handlePruefung(post(durchgang(1, '4.32.0')), env)
  const vorher = ids()
  const gleich = await antwort(await handlePruefung(post(durchgang(1, '4.33.0')), env))
  pruefe(gleich.unveraendert === true && JSON.stringify(ids()) === JSON.stringify(vorher) && vorher.length === 1, 'einzeln: andere Version, sonst gleich: unverändert, dieselbe Zeile', [gleich, ids()])
  await handlePruefung(post({ stapel: [durchgang(2, '4.32.0'), durchgang(3, '4.32.0')] }), env)
  const stapelVorher = ids()
  await handlePruefung(post({ stapel: [durchgang(2, '4.33.0'), durchgang(3, '4.33.0')] }), env)
  pruefe(stapelVorher.length === 3 && JSON.stringify(ids()) === JSON.stringify(stapelVorher), 'Stapel: andere Version, sonst gleich: dieselben Zeilen (Ids bleiben)', [stapelVorher, ids()])
}

console.log('meldungsHash: Werte ohne Version bleiben bitgleich (feste Hashes, unabhängig mit node:crypto)')
{
  const sha = (text: string) => createHash('sha256').update(text).digest('hex')
  const fall: [string, unknown, string][] = [
    ['Objekt, Schlüssel sortiert', { b: 2, a: [1, { d: 4, c: 3 }] }, '{"a":[1,{"c":3,"d":4}],"b":2}'],
    ['Array (Rohfolgen-Werte von speichereRohfolgen)', [{ y: 1, x: 2 }, 3], '[{"x":2,"y":1},3]'],
    ['Zeichenkette', 'abc', '"abc"'],
    ['null', null, 'null'],
    ['Objekt mit rohfolgen ohne Version', { a: 1, rohfolgen: [{ nummer: 1, gti: 'g' }] }, '{"a":1,"rohfolgen":[{"gti":"g","nummer":1}]}'],
  ]
  for (const [name, wert, text] of fall) pruefe((await meldungsHash(wert)) === sha(text), `Hash ${name} unverändert`)
  pruefe((await meldungsHash({ a: 1, version: '4.32.0', rohfolgen: [{ nummer: 1, version: '4.32.0' }] })) === sha('{"a":1,"rohfolgen":[{"nummer":1}]}'), 'Version oben und in rohfolgen[] zählt nicht')
}

console.log('pruefung_zurueck (Zurückstellungen)')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 })
  const bis = Date.UTC(2026, 10, 25)
  const meldung = (extra: Record<string, unknown>, eintraege: Record<string, { grund: string; bis: number }> = { 7: { grund: 'Erinnern', bis } }) =>
    handlePruefung(new Request('https://worker.test/pruefung?zurueck=1', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' }, body: JSON.stringify({ plattform: 'netflix', eintraege, ...extra }) }), env)
  const version = () => (db.prepare("SELECT ext_version AS v FROM pruefung_zurueck WHERE plattform = 'netflix'").get() as { v: string | null }).v
  pruefe((await meldung({ version: '4.32.0' })).status === 200 && version() === '4.32.0', 'Zurückstellungen mit Version: gespeichert')
  await meldung({ version: '4.33.0' })
  pruefe(version() === '4.32.0', 'gleiche Menge von einer neueren Version: nichts geschrieben, Version bleibt')
  await meldung({ version: '4.33.0' }, { 7: { grund: 'Erinnern', bis }, 8: { grund: 'Erinnern', bis } })
  pruefe(version() === '4.33.0', 'geänderte Menge: Version der ändernden Erweiterung')
  pruefe((await meldung({}, { 9: { grund: 'x', bis } })).status === 200 && version() === null, 'alte Erweiterung ohne Version: angenommen, Version leer')
}

console.log(fehler === 0 ? '\nErweiterungsversion in Meldungen: alle Zusicherungen erfüllt' : `\n${fehler} Zusicherungen verletzt`)
process.exit(fehler === 0 ? 0 : 1)
