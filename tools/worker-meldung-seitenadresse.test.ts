/**
 * Die Adresse der Seite, auf der eine Meldung entstand (19.11.2026, Migration 066): Der Worker legt `seitenAdresse` aus dem Rumpf in
 * `pruefung.seiten_adresse` ab, liefert sie mit den offenen Meldungen an den Datenlauf und nimmt Meldungen ohne Feld weiter an
 * (Spalte NULL). Die Adresse steht nicht im Meldungs-Hash: ein anderer Seitenaufruf schreibt keine Meldung neu.
 * Gegenstück in der Erweiterung: `extension/meldung-seitenadresse.test.cjs`.
 *
 * Aufruf: `npx tsx tools/worker-meldung-seitenadresse.test.ts`
 */
import { handlePruefung } from '../worker/src/pruefung.ts'
import { offenePruefungen } from '../worker/src/titelzeile-lesen.ts'
import { neueDatenbank, post, umgebung, zahl } from './worker-titelzeile-hilfe.ts'
import { festeUhr } from './feste-uhr.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string, gefunden?: unknown) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}${bedingung || gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
  if (!bedingung) fehler++
}
festeUhr('2026-11-19T12:00:00Z')
console.error = () => {}
console.warn = () => {}

/** Wie `amazon.js` meldet: „nicht bei Prime“ zu einer Suchadresse, gelesen auf einer Titelseite. */
const prime = (extra: Record<string, unknown> = {}) => ({
  plattform: 'primevideo',
  version: '4.32.187',
  url: 'https://www.amazon.de/dp/B0TESTTEST',
  titelId: 501,
  sprachen: [],
  vorhanden: 'nein',
  art: 'gemessen',
  notiz: 'Titelseite geprüft',
  ...extra,
})
const antwort = async (r: Response) => (await r.json()) as Record<string, unknown>
const spalte = (db: ReturnType<typeof neueDatenbank>) => (db.prepare('SELECT seiten_adresse AS s FROM pruefung ORDER BY id').all() as { s: string | null }[]).map((z) => z.s)

console.log('pruefung: Seitenadresse in der Zeile')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, false)
  const r = await antwort(await handlePruefung(post(prime({ seitenAdresse: 'https://www.amazon.de/dp/B0SEITE001?ref_=x#a' })), env))
  pruefe(r.ok === true, 'Meldung mit Seitenadresse wird angenommen', r)
  pruefe(JSON.stringify(spalte(db)) === '["https://www.amazon.de/dp/B0SEITE001"]', 'die Adresse steht ohne Suchteil und Anker in der Zeile', spalte(db))
  const gleich = await antwort(await handlePruefung(post(prime({ seitenAdresse: 'https://www.amazon.de/' })), env))
  pruefe(gleich.unveraendert === true && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1, 'dieselbe Meldung von einer anderen Seite: unverändert, keine zweite Zeile (nicht im Hash)', gleich)
  await handlePruefung(post(prime({ url: 'https://www.amazon.de/dp/B0TESTNEU1' })), env)
  await handlePruefung(post(prime({ url: 'https://www.amazon.de/dp/B0TESTNEU2', seitenAdresse: 'javascript:alert(1)' })), env)
  pruefe(JSON.stringify(spalte(db)) === '["https://www.amazon.de/dp/B0SEITE001",null,null]', 'Meldung ohne Angabe und mit unbrauchbarer Angabe: NULL, beide gelten', spalte(db))
}

console.log('Datenlauf: die offenen Meldungen tragen die Seitenadresse')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, 'disneyplus,netflix')
  await handlePruefung(post(prime({ seitenAdresse: 'https://www.amazon.de/dp/B0SEITE001' })), env)
  await handlePruefung(post(prime({ url: 'https://www.amazon.de/dp/B0TESTNEU1' })), env)
  await handlePruefung(post({ plattform: 'netflix', url: 'https://www.netflix.com/title/81000009', titelId: 501, sprachen: [], vorhanden: 'nein', art: 'gemessen', seitenAdresse: 'https://www.netflix.com/title/81000009' }), env)
  const offen = (await offenePruefungen(env, null)) as { plattform: string; url: string; seiten_adresse: string | null }[]
  const von = (url: string) => offen.find((z) => z.url === url)
  pruefe(von('https://www.amazon.de/dp/B0TESTTEST')?.seiten_adresse === 'https://www.amazon.de/dp/B0SEITE001', 'offene Prime-Meldung liefert die Seitenadresse', offen)
  pruefe(von('https://www.amazon.de/dp/B0TESTNEU1')?.seiten_adresse === null, 'alte Meldung ohne Angabe: null', offen)
  pruefe(von('https://www.netflix.com/title/81000009')?.seiten_adresse === null, 'Titelzeilen-Meldung (Netflix, Disney+) trägt sie noch nicht: null, die Meldung kommt trotzdem an', offen)
}

if (fehler) {
  console.error(`worker-meldung-seitenadresse: ${fehler} Fehler`)
  process.exit(1)
}
console.log('worker-meldung-seitenadresse: alle Zusicherungen erfüllt')
