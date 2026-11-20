/**
 * Eine unveränderte Meldung, die `gemeldet_am` auffrischt, trägt auch Version und Seitenadresse ihrer Erweiterung nach (20.11.2026).
 *
 * Anlass: 47 von 50 Prime-Zeilen des Durchgangs vom 20.11. (15:58–16:00 UTC) standen ohne `ext_version` und `seiten_adresse` in der
 * Kopie, obwohl der Rumpf beides trug: Der Hash ignoriert beide Felder, die Meldungen waren unverändert, und der Worker frischte nur
 * `gemeldet_am` der alten Zeile auf (Zeilen-IDs 21988–27503, alt; die 3 neu eingefügten trugen 4.32.183). Die Felder sind nicht im Hash
 * und bleiben es; aufgefrischt wird nur, wo der Worker ohnehin schon schreibt (kein zusätzlicher D1-Schreibzugriff).
 *
 * Aufruf: `npx tsx tools/worker-meldung-auffrischen.test.ts`
 */
import { handlePruefung } from '../worker/src/pruefung.ts'
import { neueDatenbank, post, stand, umgebung, zahl } from './worker-titelzeile-hilfe.ts'
import { festeUhr } from './feste-uhr.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string, gefunden?: unknown) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}${bedingung || gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}

/** Wie der Prime-Durchgang je Folge meldet (`amazon.js`, Meldehandler). */
const folge = (extra: Record<string, unknown> = {}) => ({
  plattform: 'primevideo',
  url: 'https://www.amazon.de/gp/video/detail/B09KX2VLPR',
  titel: 'Higurashi Kai',
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  folge_nr: 1,
  staffel: 2,
  ...extra,
})
const KOPF = { version: '4.32.183', seitenAdresse: 'https://www.amazon.de/gp/video/detail/B0CYWDP17J' }
const antwort = async (r: Response) => (await r.json()) as Record<string, unknown>
const zeile = (db: ReturnType<typeof neueDatenbank>) =>
  db.prepare('SELECT id, gemeldet_am AS g, ext_version AS v, seiten_adresse AS s FROM pruefung').all() as { id: number; g: string; v: string | null; s: string | null }[]

/** Eine alte Zeile ohne Kopf (Stand vor der Erweiterung 4.32.183), danach ein Listenbau, dann dieselbe Meldung mit Kopf. */
async function ablauf(name: string, uebernommen: boolean, neu: Record<string, unknown>, listenbau: string, alt: Record<string, unknown> = {}, jetzt = '2026-11-20T16:00:00Z') {
  console.log(name)
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, false)
  festeUhr('2026-11-20T10:00:00Z')
  await handlePruefung(post(folge(alt)), env)
  if (uebernommen) db.prepare('UPDATE pruefung SET uebernommen = 1').run()
  stand.erzeugtAm = listenbau
  festeUhr(jetzt)
  const r = await antwort(await handlePruefung(post(folge(neu)), env))
  pruefe(r.unveraendert === true && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1, 'dieselbe Meldung: unverändert, keine zweite Zeile', r)
  return zeile(db)[0]!
}

{
  const z = await ablauf('offene Zeile, Listenbau danach: gemeldet_am wird erneuert', false, KOPF, '2026-11-20T12:00:00Z')
  pruefe(z.g === '2026-11-20T16:00:00Z', 'gemeldet_am erneuert', z)
  pruefe(z.v === '4.32.183' && z.s === KOPF.seitenAdresse, 'Version und Seitenadresse der auffrischenden Meldung stehen in der Zeile', z)
}
{
  const z = await ablauf('übernommene Zeile, Listenbau danach', true, KOPF, '2026-11-20T12:00:00Z')
  pruefe(z.g === '2026-11-20T16:00:00Z' && z.v === '4.32.183' && z.s === KOPF.seitenAdresse, 'gemeldet_am, Version und Seitenadresse erneuert', z)
}
{
  const z = await ablauf('übernommene Zeile, neuer Tag (öffnet die Zeile wieder)', true, KOPF, '2020-01-02T00:00:00Z', {}, '2026-11-21T10:00:00Z')
  pruefe(z.g === '2026-11-21T10:00:00Z' && z.v === '4.32.183' && z.s === KOPF.seitenAdresse, 'gemeldet_am, Version und Seitenadresse erneuert', z)
}
{
  const z = await ablauf('Auffrischung ohne Kopf (alte Erweiterung) löscht vorhandene Werte nicht', false, {}, '2026-11-20T12:00:00Z', KOPF)
  pruefe(z.g === '2026-11-20T16:00:00Z' && z.v === '4.32.183' && z.s === KOPF.seitenAdresse, 'Version und Seitenadresse der Zeile bleiben', z)
}
{
  const z = await ablauf('keine Auffrischung nötig (Zeile jünger als der Listenbau): nichts wird geschrieben', false, KOPF, '2026-11-20T09:00:00Z')
  pruefe(z.g === '2026-11-20T10:00:00Z' && z.v === null && z.s === null, 'Zeile unverändert, auch Version und Seite', z)
}
{
  const z = await ablauf('unbrauchbare Werte werden nicht übernommen', false, { version: 'x y', seitenAdresse: 'javascript:alert(1)' }, '2026-11-20T12:00:00Z')
  pruefe(z.g === '2026-11-20T16:00:00Z' && z.v === null && z.s === null, 'Zeitstempel erneuert, Version und Seite bleiben NULL', z)
}
{
  const ALT = { version: '4.30.0', seitenAdresse: 'https://www.amazon.de/gp/video/detail/B0ALTALTAL' }
  const z = await ablauf('alte Zeile mit anderer Version und Seite: die neue Meldung gewinnt', false, KOPF, '2026-11-20T12:00:00Z', ALT)
  pruefe(z.g === '2026-11-20T16:00:00Z' && z.v === '4.32.183' && z.s === KOPF.seitenAdresse, 'Version und Seitenadresse der neuen Meldung ersetzen die alten', z)
}

if (fehler) {
  console.log(`\n${fehler} Fehler`)
  process.exit(1)
}
console.log('\nworker-meldung-auffrischen: alle Fälle ok (7 Abläufe)')
