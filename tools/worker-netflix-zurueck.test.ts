/**
 * **Zurückgestellte Netflix-Titel im Worker-Prüfstand** (Daniel 15.11.2026: Laufstatus „Netflix 160“, Erweiterung „0 zu prüfen,
 * 160 zurückgestellt“). Geprüft: der Schnellweg am nachgestellten Stand (160 offene Ziele, alle zurückgestellt: `titel`
 * 160 → 0), die Regeln von `ohneZurueck` (Reihenfolge, `ziel`, Anbieter getrennt, Ablauf genau an der Grenze, kaputte Zeilen,
 * fehlende Tabelle), die Meldung (`pruefeZurueck`) und der ganze Weg über `handlePruefung` gegen eine echte SQLite-Datenbank
 * mit der Migration 064: Token, Tagesdeckel, Zeilen je Schreibzugriff (1, bei unverändertem Inhalt 0), Stand danach.
 *
 * Aufruf: `npx tsx tools/worker-netflix-zurueck.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { festeUhr } from './feste-uhr.ts'
import { rechnePruefstand, type Anbieter } from './worker-pruefstand-attrappe.ts'
import { d1, lies, neueDatenbank, stand, umgebung, type Hilfe } from './worker-titelzeile-hilfe.ts'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { leseZurueck, pruefeZurueck, speichereZurueck } from '../worker/src/pruefung-zurueck.ts'

festeUhr('2026-11-15T00:30:00Z')
console.error = () => {}

let fehler = 0
const pruefe = (bedingung: boolean, text: string, gefunden?: unknown) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}${bedingung || gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
  if (!bedingung) fehler++
}

const JETZT = Date.UTC(2026, 10, 15, 0, 30)
const TAG = 24 * 3600 * 1000
const url = (id: number) => `https://www.netflix.com/title/${id}`
const ziel = (id: number) => ({ url: url(id), titel: `Titel ${id}` })
const netflix = (ids: number[], extra: Partial<Anbieter> = {}): Anbieter => ({
  name: 'Netflix',
  plattform: 'netflix',
  offen: ids.length,
  gesamt: 300,
  gemeldet: 0,
  ziele: ids.map(ziel),
  ...extra,
})
const zurueckZeile = (plattform: string, ids: number[], bis = JETZT + TAG) => ({
  plattform,
  daten: JSON.stringify(Object.fromEntries(ids.map((i) => [String(i), { grund: 'Erinnern', bis }]))),
})
const einer = async (a: Anbieter, zurueck: ReturnType<typeof zurueckZeile>[] | Error = []) =>
  (await rechnePruefstand([], [a], '2026-11-14T16:00:00.000Z', [], zurueck, JETZT)).anbieter[0]!

/* Die 160 aus Daniels Durchgang: nachgestellt mit Kennungen ab 900001 (Testbereich). */
const IDS = Array.from({ length: 160 }, (_, i) => 900001 + i)

console.log('Schnellweg: 160 offene Ziele, alle zurückgestellt')
{
  const vorher = await einer(netflix(IDS))
  const nachher = await einer(netflix(IDS), [zurueckZeile('netflix', IDS)])
  pruefe(vorher.titel === 160 && vorher.zurueck === 0, 'ohne Meldung des Browsers: titel 160 (die falsche Zahl der Laufstatus-App)', [vorher.titel, vorher.zurueck])
  pruefe(nachher.titel === 0 && nachher.zurueck === 160, 'mit Meldung: titel 0, zurueck 160', [nachher.titel, nachher.zurueck])
  pruefe(nachher.ziel === null, 'kein Ziel mehr für die Pille (sie führt dann zum Anbieter)', nachher.ziel)
  pruefe(nachher.ziele.length === 160 && nachher.ziele.every((z) => z.zurueck === true), 'ziele behält alle 160 (die Erweiterung hält Fehlendes für erledigt), je mit zurueck: true')
}

console.log('Teilfall und Reihenfolge')
{
  const a = await einer(netflix([900001, 900002, 900003, 900004, 900005]), [zurueckZeile('netflix', [900001, 900003])])
  pruefe(a.titel === 3 && a.zurueck === 2, '5 Ziele, 2 zurückgestellt: titel 3, zurueck 2', [a.titel, a.zurueck])
  pruefe(a.ziel === url(900002), 'ziel ist der erste nicht zurückgestellte, obwohl das erste Ziel zurückgestellt ist', a.ziel)
  pruefe(a.ziele.map((z) => z.url.split('/').pop()).join() === '900002,900004,900005,900001,900003', 'Offene zuerst (Reihenfolge erhalten), dann die Zurückgestellten', a.ziele.map((z) => z.url))
  pruefe(a.ziele.filter((z) => z.zurueck).length === 2 && !a.ziele[0]!.zurueck, 'nur die Zurückgestellten tragen zurueck: true')
}

console.log('Anbieter und Kennungen getrennt')
{
  const a = await einer(netflix([900001, 900002]), [zurueckZeile('disneyplus', [900001, 900002])])
  pruefe(a.titel === 2 && a.zurueck === 0, 'Zurückstellungen eines anderen Anbieters ziehen bei Netflix nichts ab', [a.titel, a.zurueck])
  const b = await einer(netflix([900001, 900002]), [zurueckZeile('netflix', [900009])])
  pruefe(b.titel === 2 && b.zurueck === 0, 'eine Kennung, die nicht unter den Zielen steht (z. B. schon gemeldet), zählt nicht mit', [b.titel, b.zurueck])
  const c = await einer({ ...netflix([900001]), ziele: [{ url: `${url(900001)}?trackId=1`, titel: 'mit Suchteil' }] }, [zurueckZeile('netflix', [900001])])
  pruefe(c.titel === 0 && c.zurueck === 1, 'die Kennung ist der letzte Pfadabschnitt ohne Suchteil', [c.titel, c.zurueck])
}

console.log('Suchadressen bleiben Arbeit')
{
  const a = await einer(netflix([900001, 900002], { suchAdressen: ['https://www.netflix.com/search?q=a'] }), [zurueckZeile('netflix', [900001, 900002])])
  pruefe(a.titel === 0 && a.zurueck === 2, 'beide Titel zurückgestellt: titel 0', [a.titel, a.zurueck])
  pruefe(a.ohneSeite === 1 && a.ziel === 'https://www.netflix.com/search?q=a', 'die Suchadresse bleibt offen und ist das Ziel', [a.ohneSeite, a.ziel])
}

console.log('Ablauf an der Grenze')
{
  const bei = async (bis: number) => (await einer(netflix([900001]), [zurueckZeile('netflix', [900001], bis)])).zurueck
  pruefe((await bei(JETZT + 1)) === 1, 'bis eine Millisekunde nach jetzt: gilt noch')
  pruefe((await bei(JETZT)) === 0, 'bis genau jetzt: abgelaufen, der Titel zählt wieder als offen')
  pruefe((await bei(JETZT - 1)) === 0, 'bis eine Millisekunde davor: abgelaufen')
  const a = await einer(netflix([900001]), [{ plattform: 'netflix', daten: JSON.stringify({ 900001: { grund: 'x', bis: JETZT } }) }])
  pruefe(a.titel === 1, 'abgelaufen: titel zählt wieder 1', a.titel)
}

console.log('Nichtauskunft und kaputte Zeilen')
{
  const a = await einer(netflix([900001, 900002]), new Error('D1_ERROR: no such table: pruefung_zurueck'))
  pruefe(a.titel === 2 && a.zurueck === 0, 'Tabelle fehlt (Migration 064 noch nicht gelaufen): kein Abzug, kein Fehler', [a.titel, a.zurueck])
  let geworfen = ''
  try {
    await einer(netflix([900001]), new Error("D1_ERROR: Your account has exceeded D1's free tier daily row read limit."))
  } catch (e) {
    geworfen = String((e as Error).message)
  }
  pruefe(/daily row read limit/.test(geworfen), 'ein anderer D1-Fehler (Tageslimit) wird nicht verschluckt, die Route antwortet dann wie bisher')
  const kaputt = await einer(netflix([900001]), [{ plattform: 'netflix', daten: '{kein json' }])
  pruefe(kaputt.titel === 1, 'kaputtes JSON: kein Abzug, kein Absturz', kaputt.titel)
  const ohneDaten = await einer(netflix([900001]), [{ plattform: 'netflix', daten: null as unknown as string }])
  pruefe(ohneDaten.titel === 1, 'Zeile ohne Daten: kein Abzug', ohneDaten.titel)
}

console.log('Meldung: pruefeZurueck')
{
  const gut = pruefeZurueck({ plattform: 'netflix', eintraege: { 7: { grund: 'Erinnern', bis: JETZT + TAG } } }, JETZT)
  pruefe('eintraege' in gut && gut.eintraege['7']?.bis === JETZT + TAG && gut.plattform === 'netflix', 'gültige Meldung bleibt unverändert', gut)
  const lang = pruefeZurueck({ plattform: 'netflix', eintraege: { 7: { grund: 'x', bis: JETZT + 365 * TAG } } }, JETZT)
  pruefe('eintraege' in lang && lang.eintraege['7']?.bis === JETZT + 30 * TAG + 3600 * 1000, 'ein Jahr voraus wird auf 30 Tage plus eine Stunde gekürzt', lang)
  const genau = pruefeZurueck({ plattform: 'netflix', eintraege: { 7: { grund: 'x', bis: JETZT + 30 * TAG + 3600 * 1000 } } }, JETZT)
  pruefe('eintraege' in genau && genau.eintraege['7']?.bis === JETZT + 30 * TAG + 3600 * 1000, 'genau die Obergrenze bleibt')
  const alt = pruefeZurueck({ plattform: 'netflix', eintraege: { 7: { grund: 'x', bis: JETZT }, 8: { grund: 'x', bis: JETZT - 1 }, 9: { grund: 'x', bis: JETZT + 1 } } }, JETZT)
  pruefe('eintraege' in alt && Object.keys(alt.eintraege).join() === '9', 'Abgelaufenes (bis ≤ jetzt) wird nicht gespeichert', alt)
  const grund = pruefeZurueck({ plattform: 'netflix', eintraege: { 7: { grund: 'g'.repeat(200), bis: JETZT + 1 }, 8: { bis: JETZT + 1 } } }, JETZT)
  pruefe('eintraege' in grund && grund.eintraege['7']?.grund.length === 80 && grund.eintraege['8']?.grund === '', 'Grund auf 80 Zeichen gekürzt, fehlender Grund leer')
  const schlecht = pruefeZurueck({ plattform: 'netflix', eintraege: { 'a b': { grund: 'x', bis: JETZT + 1 }, 7: { grund: 'x', bis: 'morgen' }, 8: { grund: 'x', bis: NaN }, 9: 'x', 10: null, 11: { grund: 'x', bis: JETZT + 1 } } }, JETZT)
  pruefe('eintraege' in schlecht && Object.keys(schlecht.eintraege).join() === '11', 'ungültige Kennung, Zeit oder Form werden verworfen, der Rest bleibt', schlecht)
  const sortiert = pruefeZurueck({ plattform: 'netflix', eintraege: { 30: { grund: 'x', bis: JETZT + 1 }, 4: { grund: 'x', bis: JETZT + 1 }, 200: { grund: 'x', bis: JETZT + 1 } } }, JETZT)
  pruefe('eintraege' in sortiert && Object.keys(sortiert.eintraege).join() === '4,30,200', 'Kennungen nach Text sortiert (stabiler Inhalt für den Vergleich im Worker)', sortiert)
  const viele = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [String(i), { grund: 'x', bis: JETZT + 1 }]))
  pruefe('status' in pruefeZurueck({ plattform: 'netflix', eintraege: viele }, JETZT), '2001 Einträge: abgelehnt')
  const grenze = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [String(i), { grund: 'x', bis: JETZT + 1 }]))
  pruefe('eintraege' in pruefeZurueck({ plattform: 'netflix', eintraege: grenze }, JETZT), '2000 Einträge: erlaubt')
  pruefe('status' in pruefeZurueck({ plattform: 'primevideo', eintraege: {} }, JETZT), 'unbekannter Anbieter: abgelehnt')
  pruefe('status' in pruefeZurueck({ plattform: 'netflix' }, JETZT) && 'status' in pruefeZurueck({ plattform: 'netflix', eintraege: [] }, JETZT) && 'status' in pruefeZurueck(null, JETZT), 'ohne eintraege, mit Liste, ohne Rumpf: abgelehnt')
  pruefe('eintraege' in pruefeZurueck({ plattform: 'netflix', eintraege: {} }, JETZT), 'leere Menge ist gültig (alles wieder offen)')
}

console.log('Speichern: eine Zeile, bei unverändertem Inhalt keine')
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h) as unknown as Parameters<typeof speichereZurueck>[0]
  const menge = { 1: { grund: 'a', bis: JETZT + TAG }, 2: { grund: 'b', bis: JETZT + 2 * TAG } }
  await speichereZurueck(env, 'netflix', menge, new Date(JETZT))
  pruefe(h.geschrieben === 1, 'erste Meldung mit 2 Einträgen: 1 geschriebene Zeile (nicht 2)', h.geschrieben)
  await speichereZurueck(env, 'netflix', menge, new Date(JETZT))
  pruefe(h.geschrieben === 1, 'dieselbe Menge noch einmal: 0 weitere Zeilen', h.geschrieben)
  await speichereZurueck(env, 'netflix', { ...menge, 3: { grund: 'c', bis: JETZT + TAG } }, new Date(JETZT))
  pruefe(h.geschrieben === 2, 'geänderte Menge: 1 weitere Zeile', h.geschrieben)
  pruefe(Number((db.prepare('SELECT COUNT(*) AS n FROM pruefung_zurueck').get() as { n: number }).n) === 1, 'in der Tabelle steht eine Zeile je Anbieter')
  const migration = readFileSync('worker/migrations/064-pruefung-zurueck.sql', 'utf8')
  pruefe(/WITHOUT ROWID/.test(migration), 'Migration 064: WITHOUT ROWID (kein Indexeintrag je Schreibzugriff)')
  const gelesen = await leseZurueck(env as never, JETZT)
  pruefe(Object.keys(gelesen.get('netflix') ?? {}).join() === '1,2,3', 'leseZurueck gibt die gespeicherte Menge zurück')
  const spaeter = await leseZurueck(env as never, JETZT + TAG)
  pruefe(Object.keys(spaeter.get('netflix') ?? {}).join() === '2', 'einen Tag später: 1 und 3 (bis = jetzt) sind abgelaufen, 2 gilt noch', Object.keys(spaeter.get('netflix') ?? {}))
  const nach = await leseZurueck(env as never, JETZT + 10 * TAG)
  pruefe(!nach.has('netflix'), 'alles abgelaufen: der Anbieter fehlt in der Antwort')
  const leer = new DatabaseSync(':memory:')
  pruefe((await leseZurueck(umgebung(leer, { geschrieben: 0 }) as never, JETZT)).size === 0, 'ohne Tabelle: leer, kein Fehler')
}

console.log('Der ganze Weg über handlePruefung')
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h)
  stand.erzeugtAm = '2026-11-14T16:00:00.000Z'
  stand.anbieter = [netflix(IDS)]
  const meldung = (body: unknown, kopf: Record<string, string> = { 'X-Lauf-Token': 't' }) =>
    handlePruefung(new Request('https://worker.test/pruefung?zurueck=1', { method: 'POST', headers: { 'Content-Type': 'application/json', ...kopf }, body: JSON.stringify(body) }), env)
  const eintraege = Object.fromEntries(IDS.map((i) => [String(i), { grund: 'Erinnern', bis: JETZT + 7 * TAG }]))
  const titelJetzt = async () => ((await lies(env, 'stand=1')) as { anbieter: { titel: number; zurueck: number }[] }).anbieter[0]!

  const vor = await titelJetzt()
  pruefe(vor.titel === 160 && vor.zurueck === 0, 'Stand vor der Meldung: titel 160', vor)
  pruefe((await meldung({ plattform: 'netflix', eintraege }, {})).status === 403, 'ohne Token: 403')
  pruefe((await meldung({ plattform: 'netflix', eintraege }, { 'X-Lauf-Token': 'falsch' })).status === 403, 'falscher Token: 403')
  pruefe((await titelJetzt()).titel === 160, 'nach den abgelehnten Versuchen unverändert 160')
  pruefe((await meldung({ plattform: 'disneyplus', eintraege })).status === 400, 'unbekannter Anbieter: 400')
  pruefe((await meldung({ plattform: 'netflix' })).status === 400, 'ohne eintraege: 400')
  const vorZeilen = h.geschrieben
  const r = await meldung({ plattform: 'netflix', eintraege })
  const antwort = (await r.json()) as { ok: boolean; eintraege: number }
  pruefe(r.status === 200 && antwort.ok && antwort.eintraege === 160, 'gültige Meldung mit 160 Einträgen: 200', antwort)
  const dazu = h.geschrieben - vorZeilen
  pruefe(dazu === 2, 'geschriebene Zeilen: 1 für die 160 Einträge und 1 für die Buchung des Tagesdeckels (nicht 160)', dazu)
  const nach = await titelJetzt()
  pruefe(nach.titel === 0 && nach.zurueck === 160, 'Stand danach: titel 0, zurueck 160 (Laufstatus-Pille und Knopf gleich)', nach)
  const vor2 = h.geschrieben
  await meldung({ plattform: 'netflix', eintraege })
  /* Die Attrappe meldet `rows_read` 0; an der echten D1 buchte der Deckel den Aufruf trotzdem (1 Zeile in `schreib_tag`). */
  pruefe(h.geschrieben - vor2 === 0, 'dieselbe Meldung noch einmal: 0 Zeilen für die Daten (der Vergleich im Upsert greift)', h.geschrieben - vor2)
  await meldung({ plattform: 'netflix', eintraege: {} })
  const frei = await titelJetzt()
  pruefe(frei.titel === 160 && frei.zurueck === 0, 'leere Menge gemeldet: alle 160 wieder offen', frei)
  await meldung({ plattform: 'netflix', eintraege })
  stand.anbieter = [netflix(IDS.slice(0, 100))]
  const teil = await titelJetzt()
  pruefe(teil.titel === 0 && teil.zurueck === 100, 'Ziele, die der Prüfstand nicht mehr führt (gemeldet), zählen nicht als zurückgestellt', teil)

  const tag = new Date(JETZT).toISOString().slice(0, 10)
  db.prepare('INSERT OR REPLACE INTO schreib_tag (tag, zeilen, gelesen) VALUES (?1, 50000, 0)').run(tag)
  const gedeckelt = await meldung({ plattform: 'netflix', eintraege })
  pruefe(gedeckelt.status === 429, 'Tagesdeckel erreicht: 429 wie bei jeder schreibenden Route', gedeckelt.status)
}

console.log('Migration fehlt: 503 mit Grund, Stand unverändert')
{
  const ohne = new DatabaseSync(':memory:')
  ohne.exec('CREATE TABLE schreib_tag (tag TEXT PRIMARY KEY, zeilen INTEGER NOT NULL DEFAULT 0, gelesen INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID')
  const env = { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: d1(ohne, { geschrieben: 0 }) } as never
  const r = await handlePruefung(
    new Request('https://worker.test/pruefung?zurueck=1', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' }, body: JSON.stringify({ plattform: 'netflix', eintraege: { 1: { grund: 'x', bis: JETZT + TAG } } }) }),
    env,
  )
  const k = (await r.json()) as { ok: boolean; error: string }
  pruefe(r.status === 503 && !k.ok && /Migration 064/.test(k.error), 'ohne die Tabelle: 503 und der Grund nennt die Migration', [r.status, k])
}

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.')
process.exit(fehler ? 1 : 0)
