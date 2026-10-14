/**
 * **Die Titelzeile (Migration 055, Pilot Disney+)** — 13.10.2026.
 *
 * Gegen eine echte SQLite-Datenbank (`node:sqlite`) mit den Migrationen des Workers. Geprüft wird:
 * - Schreiben: Aus bei leerer Einstellung, neue Adresse, weitere Folge, unveränderte Wiederholung (nur der Tageszähler),
 *   Gebietssperre, Adresse mit Altzeilen bleibt beim alten Weg;
 * - gleichzeitige Meldungen (Version): Zusammenstoß wird wiederholt, keine Folge geht verloren, bei Dauerzusammenstoß 503;
 * - Leser-Vergleich: dieselben Meldungen einmal in `pruefung`/`prime_folge`, einmal in der Titelzeile, einmal nach dem
 *   Einspielen der Altzeilen (`worker/einmalig/titel-zeile-einspielen.sql`) — jeder Leser liefert dieselben Zeilen;
 * - Abhaken, Wiederöffnen, Löschen für Folgen in Titelzeilen.
 * Die geschriebenen Zeilen mit Indexen und die gelesenen misst `tools/worker-schreibzeilen-messen.ts` lokal in workerd.
 *
 * Aufruf: `npx tsx tools/worker-titelzeile.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { gemeldetSchluessel } from '../worker/src/pruefung-gemeldet-cache.ts'
import { berechnePruefstand } from '../worker/src/pruefung-stand.ts'
import { eintragAusMeldung, kopfAusMeldung, leereDaten, lies as liesDaten, setzeEin, TITEL_ID_AB } from '../worker/src/titelzeile-format.ts'
import { VERSUCHE } from '../worker/src/titelzeile-zeile.ts'
import { d1, einspielSql, lies, loesche, neueDatenbank, post, stand, umgebung, verlustSql, zaehlerStimmen, zahl, type Hilfe } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}

const URL_A = 'https://www.disneyplus.com/browse/entity-a'
const URL_B = 'https://www.disneyplus.com/browse/entity-b'
const STAFFELN = { anbieter: 'disney', staffeln: [{ nr: 1, folgen: 3 }, { nr: 2, folgen: 2 }] }
const folge = (url: string, staffel: number, nr: number, ton = 'ja', mehr: Record<string, unknown> = {}) => ({
  plattform: 'disneyplus',
  url,
  titelId: 100 + staffel,
  sprachen: ton === 'ja' ? ['de', 'ja'] : ['ja'],
  vorhanden: 'ja',
  ton_de: ton,
  art: 'gemessen',
  titel: 'Testserie',
  folge: `Folge ${staffel}-${nr}`,
  folge_nr: nr,
  staffel,
  staffeln: STAFFELN,
  serientitel: 'Testserie',
  rohfolgen: [{ gti: `pb-${staffel}-${nr}-${url.slice(-1)}`, nummer: nr, titel: `Folge ${staffel}-${nr}`, sprachen: ton === 'ja' ? ['de', 'ja'] : ['ja'], staffelNr: staffel, vorhanden: 'ja', ton_de: ton }],
  ...mehr,
})
const weg = (url: string) => ({ plattform: 'disneyplus', url, vorhanden: 'nein', art: 'gemessen', titel: 'Testserie', serientitel: 'Testserie', notiz: 'Disney+ meldet: nicht in deinem Gebiet verfügbar' })

console.log('Schreiben')
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const aus = umgebung(db, h, false)
  await handlePruefung(post(folge(URL_A, 1, 1)), aus)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 0 && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1, 'TITELZEILE_PLATTFORMEN leer: alles beim alten Weg (pruefung + prime_folge)')
}
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h)
  const r1 = await handlePruefung(post(folge(URL_A, 1, 1)), env)
  const j1 = (await r1.json()) as { ok?: boolean; befund?: string }
  pruefe(r1.status === 200 && j1.ok === true && j1.befund === 'dub', 'neue Adresse: Antwort ok, befund dub')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 1 && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 0 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 0, 'eine Titelzeile, nichts in pruefung und prime_folge')
  pruefe(h.geschrieben === 2, `eine Tabellenzeile + Tageszähler (${h.geschrieben} Änderungen; mit Indexen in workerd gemessen)`)
  const z = db.prepare('SELECT * FROM titel_zeile').get() as { nr: number; version: number; daten: string }
  const d = JSON.parse(z.daten)
  pruefe(z.nr === 1 && z.version === 1 && d.t === 'Testserie' && d.s.staffeln.length === 2 && d.f.length === 1, 'Kopf (Titel, Staffelstruktur) einmal, eine Folge')
  pruefe(JSON.stringify(d.f[0].slice(0, 9)) === JSON.stringify([1, 1, 'Folge 1-1', 'pb-1-1-a', ['de', 'ja'], 'ja', 'ja', 'gemessen', 101]) && d.f[0][10] === 0 && d.f[0][11] === 0, 'Folge als Feld ohne Schlüsselnamen, offen für Bau und Zuordner')

  h.geschrieben = 0
  await handlePruefung(post(folge(URL_A, 1, 2)), env)
  const z2 = db.prepare('SELECT version, daten FROM titel_zeile').get() as { version: number; daten: string }
  pruefe(z2.version === 2 && JSON.parse(z2.daten).f.length === 2 && h.geschrieben === 2, `weitere Folge: dieselbe Zeile (Version 2), eine Änderung + Tageszähler (${h.geschrieben})`)

  h.geschrieben = 0
  const wiederholt = await handlePruefung(post(folge(URL_A, 1, 2)), env)
  const jw = (await wiederholt.json()) as { unveraendert?: boolean }
  pruefe(jw.unveraendert === true && h.geschrieben === 0, `unveränderte Wiederholung: keine Änderung (${h.geschrieben}), Antwort unveraendert`)

  h.geschrieben = 0
  await handlePruefung(post(folge(URL_A, 1, 2, 'nein')), env)
  const z3 = JSON.parse((db.prepare('SELECT daten FROM titel_zeile').get() as { daten: string }).daten)
  const f12 = z3.f.find((e: unknown[]) => e[1] === 2)
  pruefe(h.geschrieben === 2 && f12[6] === 'nein' && f12[13] === 1 && f12[10] === 0, `geänderte Folge: ersetzt, Fassung 1, wieder offen (${h.geschrieben} Änderungen)`)

  await handlePruefung(post(weg(URL_A)), env)
  const z4 = JSON.parse((db.prepare('SELECT daten FROM titel_zeile').get() as { daten: string }).daten)
  pruefe(z4.f.length === 3 && z4.f.some((e: unknown[]) => e[0] === null && e[1] === null && e[5] === 'nein') && z4.s !== null, 'Gebietssperre: Eintrag ohne Staffel und Nummer, der Kopf bleibt')
  await handlePruefung(post({ ...folge(URL_A, 1, 3), staffeln: undefined, titel: undefined }), env)
  const z5 = JSON.parse((db.prepare('SELECT daten FROM titel_zeile').get() as { daten: string }).daten)
  pruefe(z5.t === 'Testserie' && z5.s !== null, 'eine Meldung ohne Titel und Staffelstruktur lässt den bekannten Kopf stehen')
}
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  await handlePruefung(post(folge(URL_B, 1, 1)), umgebung(db, h, false))
  await handlePruefung(post(folge(URL_B, 1, 2)), umgebung(db, h))
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 0 && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 2, 'Adresse mit Altzeilen, noch ohne Titelzeile: bleibt beim alten Weg (bis zum Einspielen)')
}

console.log('Zähler der offenen Folgen')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 })
  await spiele(env)
  const z = db.prepare('SELECT url, offen_meldung AS m, offen_rohfolge AS r FROM titel_zeile ORDER BY url').all() as { url: string; m: number; r: number }[]
  pruefe(zaehlerStimmen(db) && z[0]!.m === 5 && z[0]!.r === 5 && z[1]!.m === 1 && z[1]!.r === 0, `nach den Meldungen: ${z.map((x) => `${x.m}/${x.r}`).join(' ')} (Adresse mit Gebietssperre: eine offene Meldung, keine Rohfolge)`)
  const offen = (await lies(env, '')) as { pruefungen: { id: number; url: string }[] }
  await handlePruefung(post({ uebernommen: offen.pruefungen.map((p) => p.id) }), env)
  pruefe(zaehlerStimmen(db) && zahl(db, 'SELECT SUM(offen_meldung) AS n FROM titel_zeile') === 0 && zahl(db, 'SELECT SUM(offen_rohfolge) AS n FROM titel_zeile') === 5, 'nach dem Abhaken der Meldungen: keine offene Meldung, Rohfolgen noch offen')
  const roh = (await lies(env, 'rohfolgen=1&nach=0')) as { folgen: { id: number }[] }
  await handlePruefung(post({ rohfolgenUebernommen: roh.folgen.map((f) => f.id) }), env)
  pruefe(zaehlerStimmen(db) && zahl(db, 'SELECT SUM(offen_rohfolge) AS n FROM titel_zeile') === 0, 'nach dem Abhaken der Rohfolgen: auch sie 0')
  await handlePruefung(post(folge(URL_A, 1, 1, 'nein')), env)
  pruefe(zaehlerStimmen(db) && zahl(db, `SELECT offen_meldung AS n FROM titel_zeile WHERE url = '${URL_A}'`) === 1, 'eine geänderte Folge macht den Titel wieder offen (1)')
  const leer = (await lies(env, '')) as { pruefungen: { url: string }[] }
  pruefe(leer.pruefungen.length === 1, 'der offene Auszug liefert nur diese Folge — Titel ohne offene Folgen werden übersprungen')
}

console.log('Gleichzeitige Meldungen (Version)')
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h)
  await handlePruefung(post(folge(URL_A, 1, 1)), env)
  /* Der Zusammenstoß: zwischen Lesen und Schreiben der Meldung (Folge 2) schreibt eine andere (Folge 3) dieselbe Zeile. */
  let eingemischt = false
  h.vorUpdate = () => {
    if (eingemischt) return
    eingemischt = true
    const alt = JSON.parse((db.prepare('SELECT daten FROM titel_zeile').get() as { daten: string }).daten)
    alt.f.push([1, 3, 'Folge 1-3', 'pb-1-3-A', ['de', 'ja'], 'ja', 'ja', 'gemessen', 101, '2026-10-13T10:00:00Z', 0, 0, null, 0])
    db.prepare('UPDATE titel_zeile SET daten = ?, version = version + 1').run(JSON.stringify(alt))
  }
  const r = await handlePruefung(post(folge(URL_A, 1, 2)), env)
  const z = db.prepare('SELECT version, daten FROM titel_zeile').get() as { version: number; daten: string }
  const nummern = JSON.parse(z.daten).f.map((e: unknown[]) => e[1]).sort()
  pruefe(r.status === 200 && nummern.join() === '1,2,3', `Zusammenstoß: die Meldung wird wiederholt, Folge 2 und die der anderen Meldung (3) stehen beide drin (${nummern.join()})`)
  pruefe(z.version === 3, `... Version zählt beide Änderungen (${z.version})`)
}
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h)
  await handlePruefung(post(folge(URL_A, 1, 1)), env)
  let versuche = 0
  h.vorUpdate = () => {
    versuche++
    db.prepare('UPDATE titel_zeile SET version = version + 1').run()
  }
  const r = await handlePruefung(post(folge(URL_A, 1, 2)), env)
  pruefe(r.status === 503 && versuche === VERSUCHE, `Dauerzusammenstoß: nach ${VERSUCHE} Versuchen 503 (${r.status}, ${versuche} Versuche)`)
  pruefe(JSON.parse((db.prepare('SELECT daten FROM titel_zeile').get() as { daten: string }).daten).f.length === 1, '... und die Zeile bleibt unverändert (die Erweiterung wiederholt die Meldung)')
}
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h)
  let eingemischt = false
  const originalPrepare = db.prepare.bind(db)
  /* Zwei neue Adressen gleichzeitig: beide wollen Nummer 1; die zweite scheitert am eindeutigen Index und wiederholt. */
  const eigener = {
    prepare: (sql: string) => {
      if (sql.startsWith('INSERT INTO titel_zeile') && !eingemischt) {
        eingemischt = true
        originalPrepare("INSERT INTO titel_zeile (url, plattform, nr, daten, gemeldet_am) VALUES ('https://x.test/anderer', 'disneyplus', 1, '{\"f\":[]}', '2026-10-13T10:00:00Z')").run()
      }
      return d1(db, h).prepare(sql)
    },
    batch: d1(db, h).batch,
  }
  const r = await handlePruefung(post(folge(URL_A, 1, 1)), { ...(env as object), DB: eigener } as never)
  const nummern = (db.prepare('SELECT nr FROM titel_zeile ORDER BY nr').all() as { nr: number }[]).map((x) => x.nr)
  pruefe(r.status === 200 && nummern.join() === '1,2', `zwei neue Adressen gleichzeitig: Nummern 1 und 2, keine doppelt (${nummern.join()})`)
}

/** Dieselbe Meldungsfolge in jede Datenbank: Disney+-Titel mit zwei Staffeln, ein Titel mit Gebietssperre, ein geänderter Ton. */
async function spiele(env: never) {
  for (const m of [
    folge(URL_A, 1, 1),
    folge(URL_A, 1, 2),
    folge(URL_A, 1, 3, 'nein'),
    folge(URL_A, 2, 1),
    folge(URL_A, 2, 2),
    folge(URL_A, 1, 3, 'ja'),
    weg(URL_B),
  ]) {
    await handlePruefung(post(m), env)
  }
}

/** Was die Leser liefern, ohne Ids und Zeitpunkte (die Meldungen stammen aus verschiedenen Sekunden). */
async function leserAuszug(env: never, db: DatabaseSync) {
  const ohne = (zeilen: Record<string, unknown>[], auch: string[] = []) =>
    zeilen
      .map((z) => {
        const k = { ...z }
        for (const s of ['id', 'gemeldet_am', ...auch]) delete k[s]
        return JSON.stringify(Object.entries(k).sort(([a], [b]) => a.localeCompare(b)))
      })
      .sort()
  const rohfolgenOffen = (await lies(env, 'rohfolgen=1&nach=0')) as { folgen: Record<string, unknown>[] }
  const rohfolgenAlle = (await lies(env, 'rohfolgen=1&alle=1&nach=0')) as { folgen: Record<string, unknown>[] }
  const alle = (await lies(env, 'alle=1&nach=0')) as { pruefungen: Record<string, unknown>[] }
  const offen = (await lies(env, '')) as { pruefungen: Record<string, unknown>[] }
  const nurDisney = (await lies(env, 'plattform=disneyplus')) as { pruefungen: Record<string, unknown>[] }
  const gemeldet = (await lies(env, `gemeldet=${encodeURIComponent(URL_A)}`)) as { paare: { nummer: number; staffel: number; folge: string }[] }
  const zaehlen = (await lies(env, 'zaehlen=1&nummern=1')) as { imBriefkasten: Record<string, number>; gemeldet: string[]; eintraege: { url: string; folge_nr: number; staffel: number }[] }
  const namen = (await lies(env, 'rohfolgen=1&namen=1')) as { namen: { url: string; titel: string }[] }
  stand.anbieter = [{ name: 'Disney+', plattform: 'disneyplus', offen: 2, gesamt: 2, gemeldet: 0, ziele: [{ url: URL_A, titel: 'Testserie', seit: '2019-12-01' }, { url: 'https://x.test/nie', titel: 'Nie', seit: '2019-12-01' }] }]
  const standAntwort = await berechnePruefstand({ env, antwort: (b) => Response.json(b) })
  const ziele = ((await standAntwort.json()) as { anbieter: { ziele: unknown[] }[] }).anbieter[0]!.ziele.length
  void db
  return {
    rohfolgenOffen: ohne(rohfolgenOffen.folgen),
    rohfolgenAlle: ohne(rohfolgenAlle.folgen),
    alle: ohne(alle.pruefungen),
    offen: ohne(offen.pruefungen),
    nurDisney: ohne(nurDisney.pruefungen),
    gemeldet: JSON.stringify(gemeldet.paare.map((p) => [p.nummer, p.staffel, p.folge]).sort()),
    zaehlen: JSON.stringify([zaehlen.imBriefkasten, [...new Set(zaehlen.gemeldet)].sort(), zaehlen.eintraege.map((e) => [e.url, e.folge_nr, e.staffel]).sort()]),
    namen: JSON.stringify(namen.namen.map((n) => [n.url, n.titel]).sort()),
    ziele,
  }
}

console.log('Leser-Vergleich: Altzeilen, Titelzeile direkt und eingespielte Altzeilen')
{
  const alt = neueDatenbank()
  const hAlt: Hilfe = { geschrieben: 0 }
  const envAlt = umgebung(alt, hAlt, false)
  await spiele(envAlt)
  const vorher = await leserAuszug(envAlt, alt)
  pruefe(vorher.alle.length === 6 && vorher.rohfolgenAlle.length >= 5, `Ausgang: Altzeilen in pruefung (${vorher.alle.length}) und prime_folge (${vorher.rohfolgenAlle.length})`)

  alt.exec(einspielSql())
  pruefe(zahl(alt, 'SELECT COUNT(*) AS n FROM titel_zeile') === 2 && zaehlerStimmen(alt), 'Einspielen: eine Titelzeile je Adresse (zwei), die Zähler der offenen Folgen stimmen')
  const nachher = await leserAuszug(envAlt, alt)
  for (const feld of Object.keys(vorher) as (keyof typeof vorher)[]) {
    pruefe(JSON.stringify(vorher[feld]) === JSON.stringify(nachher[feld]), `nach dem Einspielen unverändert: ${feld}`)
    if (JSON.stringify(vorher[feld]) !== JSON.stringify(nachher[feld])) console.log('     vorher', JSON.stringify(vorher[feld]), 'nachher', JSON.stringify(nachher[feld]))
  }
  const wieder = await handlePruefung(post(folge(URL_A, 1, 1)), umgebung(alt, hAlt))
  pruefe(((await wieder.json()) as { unveraendert?: boolean }).unveraendert === true, 'danach schreibt eine unveränderte Meldung der eingespielten Adresse nichts')
  const nochmal = zahl(alt, 'SELECT COUNT(*) AS n FROM titel_zeile')
  alt.exec(einspielSql())
  pruefe(zahl(alt, 'SELECT COUNT(*) AS n FROM titel_zeile') === nochmal, 'Einspielen ist wiederholbar (Adressen mit Titelzeile werden übersprungen)')

  const neu = neueDatenbank()
  const hNeu: Hilfe = { geschrieben: 0 }
  const envNeu = umgebung(neu, hNeu)
  await spiele(envNeu)
  const direkt = await leserAuszug(envNeu, neu)
  pruefe(zahl(neu, 'SELECT COUNT(*) AS n FROM pruefung') === 0, 'Titelzeile direkt: dieselben Meldungen schreiben nichts in pruefung')
  for (const feld of Object.keys(vorher) as (keyof typeof vorher)[]) {
    pruefe(JSON.stringify(vorher[feld]) === JSON.stringify(direkt[feld]), `direkt in die Titelzeile geschrieben wie Altzeilen: ${feld}`)
  }
}

console.log('Leser-Vergleich: Rohfolgen der Altzeilen in prime_folge (vor Migration 054)')
{
  const bezug = neueDatenbank()
  const envBezug = umgebung(bezug, { geschrieben: 0 }, false)
  await spiele(envBezug)
  const erwartet = await leserAuszug(envBezug, bezug)

  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, false)
  await spiele(env)
  /* Wie vor Migration 054: die Rohfolge steht in prime_folge, nicht in der Spalte. */
  db.exec(`INSERT INTO prime_folge (url, gti, nummer, titel, sprachen, staffel_nr, titel_id, plattform, vorhanden, ton_de, gemeldet_am, uebernommen)
           SELECT url, json_extract(rohfolge, '$.gti'), json_extract(rohfolge, '$.nummer'), json_extract(rohfolge, '$.titel'), json_extract(rohfolge, '$.sprachen'),
                  json_extract(rohfolge, '$.staffel_nr'), json_extract(rohfolge, '$.titel_id'), plattform, json_extract(rohfolge, '$.vorhanden'), json_extract(rohfolge, '$.ton_de'),
                  gemeldet_am, roh_uebernommen FROM pruefung WHERE rohfolge IS NOT NULL;
           UPDATE pruefung SET rohfolge = NULL, roh_uebernommen = NULL`)
  const alt = await leserAuszug(env, db)
  db.exec(einspielSql())
  const eingespielt = await leserAuszug(env, db)
  for (const feld of Object.keys(erwartet) as (keyof typeof erwartet)[]) {
    pruefe(JSON.stringify(erwartet[feld]) === JSON.stringify(alt[feld]) && JSON.stringify(erwartet[feld]) === JSON.stringify(eingespielt[feld]), `prime_folge-Altzeilen und eingespielte Titelzeile liefern dasselbe: ${feld}`)
  }
}

console.log('Abhaken, Wiederöffnen, Löschen')
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h)
  await spiele(env)
  const offen = (await lies(env, '')) as { pruefungen: { id: number; url: string; folge_nr: number | null; staffel: number | null }[] }
  const ids = offen.pruefungen.filter((p) => p.url === URL_A && p.id >= TITEL_ID_AB).map((p) => p.id)
  pruefe(ids.length === 5 && ids.every((i) => i >= TITEL_ID_AB), `offene Folgen der Titelzeile haben Ids ab ${TITEL_ID_AB} (${ids.length})`)
  h.geschrieben = 0
  const r = await handlePruefung(post({ uebernommen: ids }), env)
  pruefe(r.status === 200 && h.geschrieben === 1, `Abhaken von 5 Folgen eines Titels schreibt eine Zeile (${h.geschrieben}), vorher je 50 Ids ein UPDATE`)
  const danach = (await lies(env, '')) as { pruefungen: { url: string }[] }
  pruefe(danach.pruefungen.filter((p) => p.url === URL_A).length === 0 && danach.pruefungen.filter((p) => p.url === URL_B).length === 1, 'abgehakte Folgen sind aus dem offenen Auszug, die Gebietssperre der anderen Adresse bleibt')

  /* Eine Änderung nach dem Abholen: die alte Id hakt die geänderte Fassung nicht ab. */
  const alteId = ids.find((i) => i % 100_000 === 1 && Math.floor((i % 10_000_000_000) / 100_000) % 1000 === 1)!
  await handlePruefung(post(folge(URL_A, 1, 1, 'nein')), env)
  const neuOffen = (await lies(env, '')) as { pruefungen: { id: number; url: string; folge_nr: number; staffel: number }[] }
  const neueFassung = neuOffen.pruefungen.find((p) => p.url === URL_A && p.folge_nr === 1 && p.staffel === 1)!
  pruefe(neueFassung.id !== alteId, 'eine inhaltliche Änderung gibt der Folge eine neue Id (Fassung)')
  await handlePruefung(post({ uebernommen: [alteId] }), env)
  const nochOffen = (await lies(env, '')) as { pruefungen: { url: string; folge_nr: number }[] }
  pruefe(nochOffen.pruefungen.some((p) => p.url === URL_A && p.folge_nr === 1), 'die veraltete Id hakt die geänderte Folge nicht ab')

  const roh = (await lies(env, 'rohfolgen=1&nach=0')) as { folgen: { id: number; url: string }[] }
  const rohA = roh.folgen.filter((f) => f.url === URL_A)
  pruefe(rohA.length === 5, `offene Rohfolgen der Titelzeile (${rohA.length})`)
  await handlePruefung(post({ rohfolgenUebernommen: rohA.map((f) => f.id) }), env)
  pruefe(((await lies(env, 'rohfolgen=1&nach=0')) as { folgen: unknown[] }).folgen.length === 0, 'rohfolgenUebernommen: der offene Auszug ist leer')

  const stufe = await handlePruefung(post({ reoeffnen: { plattform: 'disneyplus', seit: '2020-01-01T00:00:00Z' } }), env)
  const jr = (await stufe.json()) as { reoeffnet: number }
  pruefe(jr.reoeffnet >= 4, `reoeffnen öffnet übernommene Folgen in Titelzeilen wieder (${jr.reoeffnet})`)

  /* Der Cache-Stub merkt sich, welche Adresse verworfen wird und wie viele Folgen die Titelzeile dann noch hat (erst löschen, dann verwerfen). */
  const verworfen: { schluessel: string; folgenDann: number }[] = []
  const folgenJetzt = () => zahl(db, `SELECT COUNT(*) AS n FROM titel_zeile, json_each(daten, '$.f') WHERE url = '${URL_A}'`)
  Object.assign(globalThis, { caches: { default: { match: async () => undefined, put: async () => undefined, delete: async (r: Request) => void verworfen.push({ schluessel: r.url, folgenDann: folgenJetzt() }) } } })
  const vorherFolgen = folgenJetzt()
  const einzeln = await handlePruefung(loesche({ ids: [neueFassung.id] }), env)
  pruefe(((await einzeln.json()) as { geloescht: number }).geloescht === 1, 'DELETE mit Id: die Folge verschwindet aus der Titelzeile')
  pruefe(verworfen.length > 0 && verworfen.every((v) => v.schluessel === gemeldetSchluessel('https://worker.test/pruefung', URL_A) && v.folgenDann === vorherFolgen - 1), 'DELETE nur mit Titelzeilen-Id: die Adresse wird verworfen, nachdem gelöscht ist')
  verworfen.length = 0
  const nummern = await handlePruefung(loesche({ url: URL_A, nummern: [2] }), env)
  pruefe(((await nummern.json()) as { geloescht: number }).geloescht === 2, 'DELETE mit Adresse und Nummern: Folge 2 beider Staffeln')
  pruefe(verworfen.length > 0 && verworfen.every((v) => v.folgenDann === vorherFolgen - 3), 'DELETE mit Adresse und Nummern: verworfen wird erst nach dem Löschen')
  verworfen.length = 0
  const ganz = await handlePruefung(loesche({ url: URL_A }), env)
  pruefe(verworfen.length > 0 && zahl(db, `SELECT COUNT(*) AS n FROM titel_zeile WHERE url = '${URL_A}'`) === 0, 'DELETE mit Adresse: verworfen wird erst nach dem Löschen der Titelzeile')
  Object.assign(globalThis, { caches: { default: { match: async () => undefined, put: async () => undefined, delete: async () => false } } })
  pruefe(((await ganz.json()) as { geloescht: number }).geloescht >= 1 && zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile WHERE url = \'' + URL_A + '\'') === 0, 'DELETE mit Adresse: die Titelzeile ist weg')
}

console.log('Seiten über alle Quellen')
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h)
  db.exec(`WITH RECURSIVE z(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM z WHERE n < 4999)
           INSERT INTO pruefung (plattform, url, befund, folge_nr, staffel, gemeldet_am) SELECT 'netflix', 'https://www.netflix.com/title/1', 'dub', n, 1, '2026-10-13T10:00:00Z' FROM z`)
  await spiele(env)
  const erste = (await lies(env, 'alle=1&nach=0')) as { pruefungen: { id: number }[]; weiter: number | null }
  pruefe(erste.pruefungen.length === 5000 && erste.weiter === erste.pruefungen[4999]!.id && erste.pruefungen[4999]!.id >= TITEL_ID_AB, 'erste Seite: 4.999 Altzeilen + 1 Folge der Titelzeile, Fortsetzung = letzte Id')
  const zweite = (await lies(env, `alle=1&nach=${erste.weiter}`)) as { pruefungen: unknown[]; weiter: number | null }
  pruefe(zweite.pruefungen.length === 5 && zweite.weiter === null, `zweite Seite: die übrigen Folgen (${zweite.pruefungen.length}), Ende`)
}

console.log('Rechenzeit im Worker (Free-Plan: 10 ms CPU je Anfrage)')
{
  /* Der größte Disney+-Titel am 13.10.2026: 405 Meldungen, 21 Staffeln, Staffelstruktur 1.179 Zeichen (nur SELECT gegen D1). */
  const staffeln = { anbieter: 'disney', staffeln: Array.from({ length: 21 }, (_, i) => ({ nr: i + 1, folgen: 20, id: 'a'.repeat(40) })) }
  const meldung = (nr: number) => folge(URL_A, 1 + (nr % 21), 1 + Math.floor(nr / 21), 'ja', { staffeln })
  const eintrag = (nr: number) => eintragAusMeldung(meldung(nr), { vorhanden: 'ja', tonDe: 'ja', art: 'gemessen' }, '2026-10-13T10:00:00Z')
  let daten = leereDaten()
  for (let nr = 0; nr < 405; nr++) daten = setzeEin(daten, eintrag(nr), kopfAusMeldung(meldung(nr))).daten
  const text = JSON.stringify(daten)
  const zeiten: number[] = []
  for (let lauf = 0; lauf < 60; lauf++) {
    const von = performance.now()
    /* Was eine Meldung im Worker rechnet: lesen, Folge einsetzen, schreiben (Antworttext und Datenbank zählen nicht zur Rechenzeit). */
    const neu = setzeEin(liesDaten(text), eintrag(lauf), kopfAusMeldung(meldung(lauf)))
    JSON.stringify(neu.daten)
    zeiten.push(performance.now() - von)
  }
  zeiten.sort((a, b) => a - b)
  const mittel = zeiten[30]!
  console.log(`     405 Folgen, ${(text.length / 1024).toFixed(1)} KB: Mittel ${mittel.toFixed(2)} ms, schlechtester ${zeiten[59]!.toFixed(2)} ms (Node 24)`)
  pruefe(mittel < 5 && text.length < 200_000, 'lesen + einsetzen + schreiben des größten Titels: Mittel unter 5 ms (halbe Grenze), Zeile unter 200 KB (Grenze 2 MB)')
}

console.log('Adresse mit Altzeilen nur in prime_folge bleibt beim alten Weg, bis das Einspielen sie umzieht')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 })
  db.exec(`INSERT INTO prime_folge (plattform, url, gti, staffel_nr, nummer, titel, gemeldet_am, uebernommen)
           VALUES ('disneyplus', '${URL_A}', 'alt-1', 1, 7, 'nur Rohfolge', '2026-10-01T09:00:00Z', 0)`)
  const r = await handlePruefung(post(folge(URL_A, 1, 1)), env)
  pruefe(r.status === 200 && zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 0, 'keine Titelzeile für eine Adresse, die nur in prime_folge Altzeilen hat')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1, 'die Meldung geht den alten Weg in pruefung')
  db.exec(einspielSql())
  const ids = zahl(db, "SELECT COUNT(*) AS n FROM titel_zeile, json_each(daten, '$.f') WHERE json_extract(value, '$[1]') = 7")
  pruefe(ids === 1, 'das Einspielen nimmt die Rohfolge der Adresse mit (Folge 7 in der Titelzeile)')
}

console.log('Meldung mit mehreren Rohfolgen')
{
  const mehrere = (url: string) => folge(url, 1, 1, 'ja', { rohfolgen: [...folge(url, 1, 1).rohfolgen, ...folge(url, 1, 2).rohfolgen] })
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 })
  await handlePruefung(post(folge(URL_A, 1, 1)), env)
  const vorher = zahl(db, 'SELECT COUNT(*) AS n FROM pruefung')
  const r = await handlePruefung(post(mehrere(URL_A)), env)
  const j = (await r.json()) as { error?: string }
  pruefe(r.status === 400 && /höchstens eine Rohfolge/.test(j.error ?? ''), `Adresse mit Titelzeile: Meldung mit zwei Rohfolgen wird mit 400 und klarer Meldung abgewiesen (${r.status})`)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === vorher && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 0, 'nichts landet unsichtbar in pruefung oder prime_folge')
  const neu = await handlePruefung(post(mehrere('https://www.disneyplus.com/browse/entity-z')), env)
  pruefe(neu.status === 200 && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === vorher + 1, 'Adresse ohne Titelzeile: der bisherige Weg nimmt die Meldung an')
}

console.log('Einspielen: Folgen, die nur in prime_folge stehen, gehen nicht verloren (echte D1 am 14.10.2026: 27 Folgen in 1 Adresse)')
{
  /* Dieselbe Abfrage hat die Verluste an der echten D1 gezählt; ohne titel_zeile-Klausel, solange die Tabelle fehlte. */
  const verlust = `SELECT COUNT(*) AS n FROM (SELECT url, staffel_nr, nummer FROM prime_folge
      WHERE plattform = 'disneyplus' AND gti IS NOT NULL AND url NOT IN (SELECT url FROM titel_zeile)
      GROUP BY url, IFNULL(staffel_nr, -1), IFNULL(nummer, -1)) r
    WHERE NOT EXISTS (SELECT 1 FROM pruefung p WHERE p.plattform = 'disneyplus' AND p.url = r.url
      AND IFNULL(p.staffel, -1) = IFNULL(r.staffel_nr, -1) AND IFNULL(p.folge_nr, -1) = IFNULL(r.nummer, -1))`
  const db = neueDatenbank()
  db.exec(`INSERT INTO pruefung (plattform, url, befund, staffel, folge_nr, gemeldet_am, uebernommen) VALUES
             ('disneyplus', 'u1', 'dub', 1, 1, '2026-10-01T10:00:00Z', 0), ('disneyplus', 'u1', 'dub', 1, 2, '2026-10-01T10:00:00Z', 0);
           INSERT INTO prime_folge (plattform, url, gti, staffel_nr, nummer, titel, gemeldet_am, uebernommen) VALUES
             ('disneyplus', 'u1', 'g2', 1, 2, 'in beiden', '2026-10-01T09:00:00Z', 0),
             ('disneyplus', 'u1', 'g3', 1, 3, 'nur Rohfolge', '2026-10-01T09:00:00Z', 0),
             ('disneyplus', 'u2', 'g4', 1, 1, 'Adresse nur Rohfolge', '2026-10-01T09:00:00Z', 1)`)
  pruefe(zahl(db, verlust) === 2, 'Ausgang: zwei Rohfolgen ohne pruefung-Zeile (eine in u1, eine in der Adresse u2)')
  const fehlen = () => JSON.stringify(db.prepare(verlustSql('disneyplus')).all())
  const alleFehlen = '[{"herkunft":"prime_folge","folgen":3,"adressen":2},{"herkunft":"pruefung","folgen":2,"adressen":1}]'
  pruefe(fehlen() === alleFehlen, `Verlustabfrage vor dem Einspielen: alle Folgen fehlen (${fehlen()})`)
  db.exec(einspielSql())
  const zeilen = db.prepare("SELECT url, daten, offen_meldung, offen_rohfolge FROM titel_zeile ORDER BY url").all() as { url: string; daten: string; offen_meldung: number; offen_rohfolge: number }[]
  pruefe(zeilen.length === 2, `Einspielen: eine Titelzeile je Adresse (${zeilen.length})`)
  const nummern = (z: { daten: string }) => liesDaten(z.daten).f.map((e) => `${e[0]}/${e[1]}`).sort().join(' ')
  pruefe(nummern(zeilen[0]!) === '1/1 1/2 1/3', `u1: Folge nur in pruefung, in beiden und nur in prime_folge (${nummern(zeilen[0]!)})`)
  pruefe(nummern(zeilen[1]!) === '1/1', 'u2: Adresse ohne jede pruefung-Zeile hat ihre Titelzeile')
  pruefe(zeilen[0]!.offen_meldung === 2 && zeilen[0]!.offen_rohfolge === 2 && zeilen[1]!.offen_meldung === 0 && zeilen[1]!.offen_rohfolge === 0, 'Zähler: Rohfolge-Folge bringt keine offene Meldung, nur ihre offene Rohfolge')
  const ohneEintrag = `SELECT COUNT(*) AS n FROM (SELECT DISTINCT url, staffel_nr, nummer FROM prime_folge WHERE plattform = 'disneyplus' AND gti IS NOT NULL) r
      WHERE NOT EXISTS (SELECT 1 FROM titel_zeile t, json_each(t.daten, '$.f') j WHERE t.url = r.url
        AND IFNULL(json_extract(j.value, '$[0]'), -1) = IFNULL(r.staffel_nr, -1) AND IFNULL(json_extract(j.value, '$[1]'), -1) = IFNULL(r.nummer, -1))`
  pruefe(zahl(db, ohneEintrag) === 0, 'danach hat jede Rohfolge ihren Eintrag in einer Titelzeile (Verlust 0)')
  pruefe(fehlen() === '[]', `Verlustabfrage danach leer (${fehlen()})`)
}

if (fehler) {
  console.log(`${fehler} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('Alles in Ordnung.')
process.exit(0)
