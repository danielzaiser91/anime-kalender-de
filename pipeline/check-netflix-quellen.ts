/**
 * Netflix-Kennungen aus verschiedenen Quellen (Anlass: sieben Titel, 25.10.2026): `abweichendeNetflixKennungen`,
 * `titelAufPruefliste`, `bekannteNetflixStaffeln` und der Prozess `check-netflix-quellen-bestand.ts` (Warnzeile, Exit 0).
 * Kennungen ab 900001 sind erfunden.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abweichendeNetflixKennungen, nachPruefliste, titelAufPruefliste, type QuellenDateien, type QuellenTitel } from './lib/netflix-quellen-abweichung.ts'
import { bekannteNetflixStaffeln } from './lib/netflix-staffeln-bekannt.ts'

const fehler: string[] = []
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (!ok) fehler.push(`${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}
const nf = (k: string) => `https://www.netflix.com/title/${k}`
const titel = (id: number, k: string | null, anisearchId?: number): QuellenTitel => ({
  id,
  anisearchId,
  streams: k ? [{ platform: 'netflix', url: nf(k) }] : [],
})
const dateien = (anisearch: Record<string, string[]>, justwatch: Record<string, string[]>): QuellenDateien => ({
  anisearch: Object.fromEntries(Object.entries(anisearch).map(([a, ks]) => [`x${a}`, { anisearchId: Number(a), streams: ks.map((k) => ({ url: nf(k) })) }])),
  justwatch: Object.fromEntries(Object.entries(justwatch).map(([id, ks]) => [id, { angebote: ks.map((k) => ({ url: nf(k) })) }])),
})
const ids = (t: QuellenTitel[], d: QuellenDateien) => abweichendeNetflixKennungen(t, d).map((f) => f.id)

/* Abweichung: jede Quelle einzeln gegen die anderen, in beide Richtungen. */
pruefe('aniSearch weicht ab', ids([titel(1, '900001', 11)], dateien({ 11: ['900002'] }, {})).join() === '1')
pruefe('JustWatch weicht ab (Kakegurui)', ids([titel(2, '900001', 12)], dateien({ 12: ['900001'] }, { 2: ['900003'] })).join() === '2')
pruefe('Datensatz weicht ab, beide anderen gleich (Magmell)', ids([titel(3, '900001', 13)], dateien({ 13: ['900002'] }, { 3: ['900002'] })).join() === '3')
pruefe('alle gleich: kein Fund', ids([titel(4, '900001', 14)], dateien({ 14: ['900001'] }, { 4: ['900001'] })).length === 0)
pruefe('nur eine Quelle nennt etwas: kein Fund', ids([titel(5, '900001', 15)], dateien({ 15: [] }, {})).length === 0)
pruefe('Netflix und Netflix mit Werbung, gleiche Adresse: kein Fund', ids([titel(6, '900001')], dateien({}, { 6: ['900001', '900001'] })).length === 0)
pruefe('Titel ohne Datensatz-Weg, zwei Quellen verschieden', ids([titel(7, null, 17)], dateien({ 17: ['900001'] }, { 7: ['900002'] })).join() === '7')
pruefe('Titel ohne aniSearch-Kennung', ids([titel(8, '900001')], dateien({ 18: ['900002'] }, {})).length === 0)
pruefe('andere aniSearch-Kennung wird nicht verwechselt', ids([titel(9, '900001', 19)], dateien({ 20: ['900002'] }, {})).length === 0)
pruefe('Umleitung zählt als dieselbe Kennung (Ranma)', ids([titel(10, '81171925', 21)], dateien({ 21: ['81301833'] }, { 10: ['81171925'] })).length === 0)
pruefe('Nicht-Netflix-Weg zählt nicht', ids([{ id: 11, streams: [{ platform: 'primevideo', url: nf('900009') }] }], dateien({}, { 11: ['900001'] })).length === 0)
const fund = abweichendeNetflixKennungen([titel(12, '900001', 22)], dateien({ 22: ['900002'] }, { 12: ['900002'] }))[0]
pruefe('Fund nennt die Kennungen je Quelle', JSON.stringify(fund?.kennungen) === JSON.stringify({ datensatz: ['900001'], anisearch: ['900002'], justwatch: ['900002'] }), fund)

/* Prüfliste: die Seite des Titels steht im Prüfstand. */
const t3 = [titel(31, '900001'), titel(32, '900002'), titel(33, null), { id: 34, streams: [{ platform: 'primevideo', url: nf('900001') }] }]
const liste = titelAufPruefliste(t3, [nf('900001'), nf('900777')])
pruefe('Titel mit Seite im Prüfstand', liste.has(31), [...liste])
pruefe('Titel ohne Seite im Prüfstand', !liste.has(32) && !liste.has(33))
pruefe('Fremder Anbieter zählt nicht', !liste.has(34))
pruefe('Umleitung im Prüfstand trifft die neue Seite', titelAufPruefliste([titel(35, '81171925')], [nf('81301833')]).has(35))
const geteilt = nachPruefliste(abweichendeNetflixKennungen([titel(41, '900001', 51), titel(42, '900003', 52)], dateien({ 51: ['900002'], 52: ['900004'] }, {})), new Set([41]))
pruefe('Teilung: 41 auf der Liste, 42 offen', geteilt.aufListe.map((f) => f.id).join() === '41' && geteilt.offen.map((f) => f.id).join() === '42', geteilt)

/* Staffelaufteilung bekannt (aus fetch-pruefungen herausgelöst). */
const struktur = { '900001': { staffeln: [{ seq: 1 }, { seq: 3 }] }, '81171925': { staffeln: [{ seq: 2 }] }, '900002': {} }
pruefe('Staffeln der Titelseite', bekannteNetflixStaffeln(nf('900001'), struktur).map((s) => s.seq).join() === '1,3')
pruefe('Abspieladresse führt auf dieselbe Seite', bekannteNetflixStaffeln('https://www.netflix.com/watch/900001?x=1', struktur).length === 2)
pruefe('Umleitung findet die Staffeln der neuen Kennung', bekannteNetflixStaffeln(nf('81301833'), struktur).map((s) => s.seq).join() === '2')
pruefe('Eintrag ohne Staffeln', bekannteNetflixStaffeln(nf('900002'), struktur).length === 0)
pruefe('unbekannte Kennung', bekannteNetflixStaffeln(nf('900003'), struktur).length === 0)
pruefe('Adresse ohne Kennung', bekannteNetflixStaffeln('https://www.netflix.com/browse', struktur).length === 0)
pruefe('fremder Anbieter', bekannteNetflixStaffeln('https://www.amazon.de/gp/video/detail/900001', struktur).length === 0)

/* Prozess: Warnzeile bei offenem Fund (Exit 0), keine bei Fund auf der Liste, Exit 1 bei kaputter Eingabe. */
const skript = fileURLToPath(new URL('./check-netflix-quellen-bestand.ts', import.meta.url))
const wurzel = mkdtempSync(join(tmpdir(), 'nf-quellen-'))
mkdirSync(wurzel, { recursive: true })
const schreibe = (name: string, inhalt: unknown) => {
  const pfad = join(wurzel, name)
  writeFileSync(pfad, typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
  return pfad
}
const titelPfad = schreibe('titles.json', [titel(900101, '900001', 61), titel(900102, '900003', 62)])
const asPfad = schreibe('anisearch.json', dateien({ 61: ['900002'], 62: ['900003'] }, {}).anisearch)
const jwPfad = schreibe('jw.json', {})
const stand = (ziele: string[]) => schreibe('stand.json', { anbieter: [{ plattform: 'netflix', ziele: ziele.map((url) => ({ url })) }] })
const lauf = (...args: string[]) => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, ...args], { encoding: 'utf8', windowsHide: true })
  return { status: r.status, out: `${r.stdout}${r.stderr}` }
}
const offen = lauf(titelPfad, asPfad, jwPfad, stand([]))
pruefe('Prozess offen: Exit 0 und Warnzeile mit Titel', offen.status === 0 && offen.out.includes('⚠ WARNUNG Netflix-Kennung: Titel 900101'), offen)
pruefe('Prozess offen: Zählzeile', offen.out.includes('1 Titel mit Abweichung, 0 auf der Prüfliste, 1 ohne'), offen)
const gelistet = lauf(titelPfad, asPfad, jwPfad, stand([nf('900001')]))
pruefe('Prozess gelistet: Exit 0, keine Warnzeile, gezählt', gelistet.status === 0 && !gelistet.out.includes('WARNUNG') && gelistet.out.includes('1 auf der Prüfliste, 0 ohne'), gelistet)
const kaputt = lauf(schreibe('kaputt.json', '{'), asPfad, jwPfad, stand([]))
pruefe('Prozess kaputte Eingabe: Exit ungleich 0', kaputt.status !== 0, kaputt)
rmSync(wurzel, { recursive: true, force: true })

if (fehler.length) {
  console.error(`FEHL check-netflix-quellen: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-netflix-quellen: Abweichung je Quelle, Prüfliste, bekannte Staffeln und Warnzeile (Exit 0) geprüft.')
