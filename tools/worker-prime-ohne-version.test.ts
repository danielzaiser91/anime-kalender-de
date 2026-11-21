/**
 * **Prime-Meldungen ohne Erweiterungsversion werden abgewiesen** (21.11.2026, Aufgabe 18): HTTP 400 mit Grund, nichts geschrieben,
 * Ablehnung im Protokoll (`meldung_abgelehnt`, zählbar). Mit Version, und Meldungen anderer Anbieter ohne Version, laufen wie bisher.
 * Gilt auch für jedes Element eines Stapels. Rumpf wie `extension/amazon.js` (`akKontext.meldungKopf()`).
 *
 * Aufruf: `npx tsx tools/worker-prime-ohne-version.test.ts`
 */
import { handlePruefung } from '../worker/src/pruefung.ts'
import { neueDatenbank, post, umgebung, zahl } from './worker-titelzeile-hilfe.ts'
import { festeUhr } from './feste-uhr.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string, gefunden?: unknown) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}${bedingung || gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
  if (!bedingung) fehler++
}
festeUhr('2026-11-21T12:00:00Z')
const protokoll: string[] = []
console.error = () => {}
console.warn = (z: unknown) => void protokoll.push(String(z))
console.log = ((log) => (...a: unknown[]) => log(...a))(console.log)

const meldung = (version?: unknown, plattform = 'primevideo') => ({
  plattform,
  url: 'https://www.amazon.de/dp/B00TEST123',
  titel: 'Prime-Serie',
  vorhanden: 'nein',
  art: 'gemessen',
  ...(version === undefined ? {} : { version }),
})
const lies = async (r: Response): Promise<Record<string, unknown>> => ({ status: r.status, ...((await r.json()) as Record<string, unknown>) })
const zeilen = (db: ReturnType<typeof neueDatenbank>) => zahl(db, 'SELECT COUNT(*) AS n FROM pruefung')

console.log('Einzelmeldung')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, false)
  const r = await lies(await handlePruefung(post(meldung()), env))
  pruefe(r.status === 400 && /version/i.test(String(r.error)), 'ohne Version: 400 mit Grund', r)
  pruefe(zeilen(db) === 0, 'ohne Version: nichts geschrieben')
  for (const schlecht of [null, '', 5, 'x'.repeat(21), '4 32']) {
    const s = await lies(await handlePruefung(post(meldung(schlecht)), env))
    pruefe(s.status === 400, `unbrauchbare Version ${JSON.stringify(schlecht)}: 400`, s)
  }
  pruefe(zeilen(db) === 0, 'keine davon geschrieben')
  const ok = await lies(await handlePruefung(post(meldung('4.32.187')), env))
  pruefe(ok.status === 200 && ok.ok === true && zeilen(db) === 1, 'mit Version: angenommen und geschrieben', ok)
}

console.log('Stapel')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, false)
  const r = await lies(await handlePruefung(post({ stapel: [{ ...meldung('4.32.187'), folge_nr: 1 }, { ...meldung(), folge_nr: 2 }] }), env))
  const n = zeilen(db)
  const e = (r.ergebnisse ?? []) as { ok: boolean; status?: number; grund?: string }[]
  pruefe(e[0]?.ok === true && e[1]?.ok === false && e[1]?.status === 400 && /version/i.test(String(e[1]?.grund)), 'Stapel: das Element ohne Version wird abgewiesen (400, Grund), das mit Version angenommen', e)
  pruefe(n === 1, 'nur das Element mit Version ist geschrieben', n)
}

console.log('andere Anbieter bleiben unberührt')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, false)
  const r = await lies(await handlePruefung(post(meldung(undefined, 'disneyplus')), env))
  pruefe(r.status === 200 && r.ok === true, 'Disney+ ohne Version: angenommen', r)
}

console.log('Zählbarkeit')
pruefe(protokoll.some((z) => z.includes('meldung_abgelehnt') && z.includes('Erweiterungsversion fehlt')), 'die Ablehnung steht als `meldung_abgelehnt` im Protokoll', protokoll.slice(0, 2))

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('alle Zusicherungen erfüllt')
