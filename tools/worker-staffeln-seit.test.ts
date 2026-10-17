/**
 * **`?stand=1` liest nur Titel mit einer Meldung seit dem Prüfstand** (17.10.2026).
 *
 * Lehre: `titel_zeile.gemeldet_am` war der Zeitpunkt des letzten Schreibens. Das Abhaken des Bestandsbaus schrieb damit
 * „jetzt“ in jeden abgehakten Titel, und `staffelnSeit` packte all diese Titel mit `json_each` aus: Ø 13.268 Lesezeilen
 * je `?stand=1`, 60 % des Tagesverbrauchs (Bericht `d1-rest-2026-10-17.md` §3). Seitdem trägt die Spalte die jüngste
 * Meldung unter den Folgen (`juengsteMeldung`), wie `pruefung.gemeldet_am`, das Abhaken nie anfasst.
 *
 * Gezählt werden die Folgen, die `staffelnSeit` über die Sicht `pruefung_titel` auspackt (eine Zählfunktion als
 * Argument von `json_each`, sonst die Sicht aus Migration 058 unverändert); die Lesezeilen in workerd misst
 * `tools/worker-staffeln-seit-messen.ts`. Nie gegen den echten Briefkasten.
 *
 * Aufruf: `npx tsx tools/worker-staffeln-seit.test.ts`
 */
import { readFileSync } from 'node:fs'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { berechnePruefstand } from '../worker/src/pruefung-stand.ts'
import { juengsteMeldung, lies as liesDaten, type Eintrag, type TitelDaten } from '../worker/src/titelzeile-format.ts'
import { staffelnSeit } from '../worker/src/titelzeile-lesen.ts'
import { lies, neueDatenbank, post, stand, umgebung, zahl, type Hilfe } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}

const ALT = '2026-10-10T08:00:00Z'
const SEIT = '2026-10-16T12:00:00.000Z'
const TITEL = 9
const MITTE = 4
const url = (i: number) => `https://www.disneyplus.com/browse/entity-${i}`
const STAFFELN = { anbieter: 'disney', staffeln: [{ nr: 1, folgen: 3 }, { nr: 2, folgen: 3 }] }
const folge = (i: number, staffel: number, nr: number) => ({
  plattform: 'disneyplus',
  url: url(i),
  titelId: 100 + i,
  sprachen: ['de', 'ja'],
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  titel: `Serie ${i}`,
  folge: `Folge ${staffel}-${nr}`,
  folge_nr: nr,
  staffel,
  staffeln: STAFFELN,
  serientitel: `Serie ${i}`,
  rohfolgen: [{ gti: `gti-${i}-${staffel}-${nr}`, nummer: nr, titel: `Folge ${staffel}-${nr}`, sprachen: ['de', 'ja'], staffelNr: staffel, vorhanden: 'ja', ton_de: 'ja' }],
})

console.log('juengsteMeldung')
{
  const e = (am: string) => [1, 1, null, null, null, 'ja', 'ja', 'gemessen', null, am, 0, 0, null, 0] as Eintrag
  const daten = (am: string[]): TitelDaten => ({ s: null, t: null, st: null, f: am.map(e) })
  pruefe(juengsteMeldung(daten([ALT, '2026-10-17T09:00:00Z', '2026-10-12T00:00:00Z'])) === '2026-10-17T09:00:00Z', 'die jüngste Folge, auch wenn sie in der Mitte steht')
  pruefe(juengsteMeldung(daten([])) === '', 'ohne Folgen: leer (vor jedem Prüfstand)')
}

/* Die Sicht aus Migration 058, nur `json_each` bekommt den Text über eine Zählfunktion: so viele Folgen packt ein Leser aus. */
const db = neueDatenbank()
let ausgepackt = 0
db.function('gezaehlt', (daten: unknown) => {
  ausgepackt += (JSON.parse(String(daten)) as { f: unknown[] }).f.length
  return daten as string
})
const sicht = readFileSync('worker/migrations/058-titel-zeile-seiten.sql', 'utf8')
db.exec(sicht.replace("json_each(t.daten, '$.f')", "json_each(gezaehlt(t.daten), '$.f')"))
const h: Hilfe = { geschrieben: 0 }
const env = umgebung(db, h)

for (let i = 0; i < TITEL; i++) for (const [s, n] of [[1, 1], [1, 2], [2, 1], [2, 2]]) await handlePruefung(post(folge(i, s!, n!)), env)
/* Alle Folgen vor dem Prüfstand gemeldet: Zeitpunkte zurückdatieren. */
for (const z of db.prepare('SELECT url, daten FROM titel_zeile').all() as { url: string; daten: string }[]) {
  const d = liesDaten(z.daten)
  d.f = d.f.map((e) => [...e.slice(0, 9), ALT, ...e.slice(10)] as Eintrag)
  db.prepare('UPDATE titel_zeile SET daten = ?, gemeldet_am = ? WHERE url = ?').run(JSON.stringify(d), ALT, z.url)
}
stand.erzeugtAm = SEIT
stand.anbieter = [{ name: 'Disney+', plattform: 'disneyplus', offen: TITEL, gesamt: TITEL, gemeldet: 0, ziele: Array.from({ length: TITEL }, (_, i) => ({ url: url(i), titel: `Serie ${i}` })) }]

const lesen = async () => {
  ausgepackt = 0
  const zeilen = await staffelnSeit(env, SEIT)
  return { ausgepackt, zeilen }
}
const offeneZiele = async () => {
  const antwort = (await (await berechnePruefstand({ env, antwort: (b) => Response.json(b) })).json()) as { anbieter: { ziele: { url: string }[] }[] }
  return antwort.anbieter[0]!.ziele.map((z) => z.url)
}
const gemeldet = async () => [...new Set(((await lies(env, 'zaehlen=1')) as { gemeldet: string[] }).gemeldet)].sort()

console.log('Abhaken nach dem Prüfstand')
{
  const offen = (await lies(env, '')) as { pruefungen: { id: number }[] }
  await handlePruefung(post({ uebernommen: offen.pruefungen.map((p) => p.id) }), env)
  pruefe(zahl(db, `SELECT COUNT(*) AS n FROM titel_zeile WHERE offen_meldung = 0`) === TITEL, `alle ${TITEL} Titel abgehakt (${offen.pruefungen.length} Folgen)`)
  pruefe(zahl(db, `SELECT COUNT(*) AS n FROM titel_zeile WHERE gemeldet_am > '${SEIT}'`) === 0, 'Abhaken setzt titel_zeile.gemeldet_am nicht auf jetzt')
  const r = await lesen()
  pruefe(r.ausgepackt === 0 && r.zeilen.length === 0, `staffelnSeit packt keinen abgehakten Titel aus (${r.ausgepackt} Folgen, vorher ${TITEL * 4})`)
  pruefe((await offeneZiele()).length === TITEL, 'alle Ziele bleiben offen: Abhaken ist keine Meldung seit dem Prüfstand')
  pruefe((await gemeldet()).length === 0, '?zaehlen=1 führt abgehakte Titel nicht als gemeldet (vorher alle neun)')
}

console.log('Frische: eine eben gemeldete Adresse ist im nächsten Stand erledigt')
{
  await handlePruefung(post(folge(MITTE, 2, 3)), env)
  const r = await lesen()
  pruefe(r.ausgepackt === 5, `nur der gemeldete Titel wird ausgepackt (${r.ausgepackt} Folgen; Budget 5 = seine Folgen)`)
  pruefe(JSON.stringify(r.zeilen) === JSON.stringify([{ plattform: 'disneyplus', url: url(MITTE), staffel: 2 }]), 'staffelnSeit nennt genau die gemeldete Staffel')
  const offen = await offeneZiele()
  pruefe(offen.length === TITEL - 1 && !offen.includes(url(MITTE)), `Stand: ${url(MITTE)} erledigt, die übrigen ${TITEL - 1} offen`)
  pruefe(JSON.stringify(await gemeldet()) === JSON.stringify([url(MITTE)]), '?zaehlen=1 nennt genau die gemeldete Adresse')
}

console.log('Wiedervorlage und Abhaken der neuen Meldung')
{
  await handlePruefung(post(folge(MITTE + 2, 1, 1)), env)
  pruefe((await gemeldet()).includes(url(MITTE + 2)), 'gleiche Folge erneut gemeldet (übernommen, neuer Tag): zählt als Meldung seit dem Prüfstand')
  const offen = (await lies(env, '')) as { pruefungen: { id: number }[] }
  await handlePruefung(post({ uebernommen: offen.pruefungen.map((p) => p.id) }), env)
  const r = await lesen()
  pruefe(r.ausgepackt === 9 && !(await offeneZiele()).includes(url(MITTE)), `abgehakte neue Meldung bleibt gemeldet (${r.ausgepackt} Folgen = 5 + 4)`)
}

console.log('Neuer Titel nach dem Prüfstand')
{
  await handlePruefung(post(folge(TITEL, 1, 1)), env)
  const r = await lesen()
  pruefe(r.zeilen.some((z) => z.url === url(TITEL)) && (await gemeldet()).includes(url(TITEL)), 'die erste Meldung eines Titels zählt sofort (INSERT trägt ihren Zeitpunkt)')
}

console.log('Neuer Titel vor dem nächsten Prüfstand, ohne Abhaken')
{
  await handlePruefung(post(folge(TITEL + 1, 1, 1)), env)
  const spaeter = new Date(Date.now() + 60_000).toISOString()
  stand.erzeugtAm = spaeter
  ausgepackt = 0
  const zeilen = await staffelnSeit(env, spaeter)
  const n = ausgepackt
  pruefe(n === 0 && zeilen.length === 0, `kein Titel zählt nach einem jüngeren Prüfstand, auch der neu angelegte nicht (${n} Folgen)`)
  pruefe((await gemeldet()).length === 0, '?zaehlen=1 nennt nach einem jüngeren Prüfstand keine Adresse')
}

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen` : '\nalle Prüfungen bestanden')
process.exit(fehler ? 1 : 0)
