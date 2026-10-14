/**
 * **Die Titelzeile für Netflix** (14.10.2026) — die drei Meldungsformen der Erweiterung (`extension/melder.js`):
 * Hand-Meldung (ohne Rohfolge, mit `folgen`), Durchlauf (eine Rohfolge, `folge` = Kennung der Folge) und Randprobe
 * (Stapel bis zehn Folgen eines Titels, `roh.angenommen`). Geprüft wird:
 * - Freigabe: nur Anbieter aus `TITELZEILE_TAUGLICH`; Prime und ADN gehen auch eingeschaltet den bisherigen Weg;
 * - `folgen` und der Rohfolgen-Titel stehen in der Titelzeile und zählen als Inhalt (Änderung = neue Fassung);
 * - Randprobe: ein Stapel schreibt die Titelzeile einmal; Gruppe mit Altzeilen oder mit unpassender Meldung bleibt beim
 *   bisherigen Weg;
 * - Leser-Vergleich: Altzeilen, Titelzeile direkt und eingespielte Altzeilen (`einspielSql('netflix')`) liefern dasselbe
 *   — bis auf `angenommen` 0 statt leer und Felder, die die Titelzeile nicht trägt (betrieb.md, Abschnitt „Titelzeile“);
 * - Abhaken der Netflix-Ids.
 *
 * Aufruf: `npx tsx tools/worker-titelzeile-netflix.test.ts`
 */
import { handlePruefung } from '../worker/src/pruefung.ts'
import { TITEL_ID_AB } from '../worker/src/titelzeile-format.ts'
import { einspielSql, lies, neueDatenbank, post, umgebung, verlustSql, zaehlerStimmen, zahl, type Hilfe } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}

const AN = 'disneyplus,netflix'
const HAND = 'https://www.netflix.com/title/81000001'
const LAUF = 'https://www.netflix.com/title/81000002'
const RAND = 'https://www.netflix.com/title/81000003'
const STAFFELN = { staffeln: [{ nr: 1, folgen: 10 }] }
const SPRACHEN = ['de|Deutsch', 'ja|Japanisch']

const kopf = (url: string) => ({ plattform: 'netflix', url, titel: 'Netflix-Serie', serientitel: 'Netflix-Serie', staffeln: STAFFELN, titelId: 501, sprachen: SPRACHEN })
const hand = (nr: number, folgen: number) => ({ ...kopf(HAND), vorhanden: 'ja', ton_de: 'ja', art: 'gemessen', folge_nr: nr, staffel: 1, folgen })
const lauf = (nr: number, titel = `Der Anfang ${nr}`) => ({
  ...kopf(LAUF),
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  folge: `8200000${nr}`,
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [{ gti: `8200000${nr}`, nummer: nr, titel, staffelText: 'Staffel 1', staffelNr: 1, vorhanden: 'ja', ton_de: 'ja', roh: { liste: null } }],
})
/** Wie `extension/melder.js` die Randprobe meldet: Folgen 1 und 10 gemessen, dazwischen angenommen. */
const rand = (nr: number, url = RAND) => {
  const angenommen = nr !== 1 && nr !== 10
  const art = angenommen ? 'angenommen' : 'gemessen'
  return {
    ...kopf(url),
    vorhanden: 'ja',
    ton_de: 'ja',
    art,
    folge: `8300000${nr}`,
    folge_nr: nr,
    staffel: 1,
    notiz: angenommen ? 'Randprobe: Folgen 1 und 10 gemessen, ANGENOMMEN dazwischen' : 'Randprobe: gemessen',
    rohfolgen: [{ gti: `8300000${nr}`, nummer: nr, titel: `Folge ${nr}`, staffelText: 'Staffel 1', staffelNr: 1, vorhanden: 'ja', ton_de: 'ja', art, roh: { liste: null, angenommen } }],
  }
}
const randStapel = (url = RAND) => ({ stapel: Array.from({ length: 10 }, (_, i) => rand(i + 1, url)) })
const antwort = async (r: Response) => (await r.json()) as Record<string, unknown>

console.log('Freigabe: nur Disney+ und Netflix')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, 'disneyplus,netflix,primevideo,adn')
  const eins = { vorhanden: 'ja', ton_de: 'ja', art: 'gemessen', folge_nr: 1, staffel: 1 }
  const rohfolge = { gti: 'amzn1.dv.gti.1', asin: 'B0F1', nummer: 1, titel: 'Folge 1', staffelNr: 1 }
  const prime = { ...eins, plattform: 'primevideo', url: 'https://www.amazon.de/dp/B0TEST', rohfolgen: [rohfolge] }
  const adn = { ...eins, plattform: 'adn', url: 'https://animationdigitalnetwork.com/video/1-test' }
  await handlePruefung(post(prime), env)
  await handlePruefung(post(adn), env)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 0 && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 2, 'Prime (eine Rohfolge) und ADN gehen auch eingeschaltet den bisherigen Weg')
  await handlePruefung(post(hand(1, 10)), env)
  pruefe(zahl(db, "SELECT COUNT(*) AS n FROM titel_zeile WHERE plattform = 'netflix'") === 1, 'Netflix eingeschaltet: Titelzeile')
}

console.log('Hand-Meldung: Folgenzahl')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, AN)
  await handlePruefung(post(hand(1, 10)), env)
  const folgen = async () => (await alleZeilen(env)).find((z) => z.url === HAND)?.folgen
  pruefe((await folgen()) === 10, 'die Folgenzahl der Seite steht im Leser')
  const gleich = await antwort(await handlePruefung(post(hand(1, 10)), env))
  pruefe(gleich.unveraendert === true, 'dieselbe Meldung ist unverändert')
  const mehr = await antwort(await handlePruefung(post(hand(1, 12)), env))
  pruefe(mehr.unveraendert !== true && (await folgen()) === 12, 'eine geänderte Folgenzahl ist eine Änderung (12 im Leser)')
}

async function alleZeilen(env: never) {
  return ((await lies(env, 'alle=1&nach=0')) as { pruefungen: Record<string, unknown>[] }).pruefungen
}
const rohAlle = async (env: never) => ((await lies(env, 'rohfolgen=1&alle=1&nach=0')) as { folgen: Record<string, unknown>[] }).folgen

console.log('Durchlauf: Folgentitel statt Kennung')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, AN)
  await handlePruefung(post(lauf(1)), env)
  const titel = async () => (await rohAlle(env)).find((f) => f.url === LAUF)?.titel
  pruefe((await titel()) === 'Der Anfang 1', `der Zuordner liest den Folgentitel, nicht die Kennung (${await titel()})`)
  const anders = await antwort(await handlePruefung(post(lauf(1, 'Der neue Anfang')), env))
  pruefe(anders.unveraendert !== true && (await titel()) === 'Der neue Anfang', 'ein geänderter Folgentitel ist eine Änderung')
}

console.log('Randprobe: ein Stapel, eine Zeile')
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h, AN)
  const r = await antwort(await handlePruefung(post(randStapel()), env))
  const ergebnisse = (r.ergebnisse ?? []) as { ok: boolean }[]
  pruefe(ergebnisse.length === 10 && ergebnisse.every((e) => e.ok), `alle zehn Folgen angenommen (${JSON.stringify(ergebnisse.filter((e) => !e.ok))})`)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 1 && zahl(db, 'SELECT version AS n FROM titel_zeile') === 1, 'eine Titelzeile, einmal geschrieben (Version 1)')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 0 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 0 && zaehlerStimmen(db), 'nichts in pruefung/prime_folge, Zähler stimmen')
  const angenommen = (await rohAlle(env)).filter((f) => f.angenommen).map((f) => f.nummer).sort((a, b) => Number(a) - Number(b))
  pruefe(JSON.stringify(angenommen) === '[2,3,4,5,6,7,8,9]', `angenommen sind genau die Folgen 2 bis 9 (${JSON.stringify(angenommen)})`)
}

console.log('Randprobe: bisheriger Weg für Altzeilen und unpassende Meldungen')
{
  const db = neueDatenbank()
  const env = umgebung(db, { geschrieben: 0 }, AN)
  await handlePruefung(post(rand(1)), umgebung(db, { geschrieben: 0 }, false))
  await handlePruefung(post(randStapel()), env)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 0 && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 10, 'Adresse mit Altzeilen: der ganze Stapel geht in pruefung')

  const zwei = randStapel('https://www.netflix.com/title/81000004')
  const f = zwei.stapel[4]!
  f.rohfolgen = [...f.rohfolgen, ...rand(11).rohfolgen]
  const r = await antwort(await handlePruefung(post(zwei), env))
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 0 && zahl(db, "SELECT COUNT(*) AS n FROM pruefung WHERE url LIKE '%81000004'") === 10, 'neue Adresse mit einer Meldung mit zwei Rohfolgen: der ganze Stapel geht den bisherigen Weg')
  pruefe(((r.ergebnisse ?? []) as { ok: boolean }[]).every((e) => e.ok), 'und wird ganz angenommen')
}

/** Alle Meldungsformen auf einer Datenbank. */
async function spiele(env: never) {
  await handlePruefung(post(hand(1, 10)), env)
  await handlePruefung(post(hand(2, 10)), env)
  await handlePruefung(post(lauf(1)), env)
  await handlePruefung(post(lauf(2)), env)
  await handlePruefung(post(randStapel()), env)
}

/**
 * Was die Leser liefern, ohne Ids und Zeitpunkte. `angenommen` als ja/nein: die Altzeile trägt 0, wo die Erweiterung
 * `angenommen: false` schickt, die Titelzeile leer (die Pipeline prüft nur auf wahr, `pipeline/lib/urteil-je-folge.ts`).
 * Staffel-Text und Sprachen der Rohfolge trägt die Titelzeile nicht (Sprachen = die der Meldung).
 */
async function leserAuszug(env: never) {
  const ohne = (zeilen: Record<string, unknown>[], auch: string[] = []) =>
    zeilen
      .map((z) => {
        const k: Record<string, unknown> = { ...z, angenommen: Boolean(z.angenommen) }
        for (const s of ['id', 'gemeldet_am', ...auch]) delete k[s]
        return JSON.stringify(Object.entries(k).sort(([a], [b]) => a.localeCompare(b)))
      })
      .sort()
  const rohOhne = ['staffel_text', 'sprachen', 'dauer_sek', 'untertitel']
  return {
    rohfolgenOffen: ohne(((await lies(env, 'rohfolgen=1&nach=0')) as { folgen: Record<string, unknown>[] }).folgen, rohOhne),
    rohfolgenAlle: ohne(await rohAlle(env), rohOhne),
    alle: ohne(await alleZeilen(env)),
    offen: ohne(((await lies(env, '')) as { pruefungen: Record<string, unknown>[] }).pruefungen),
    namen: JSON.stringify(((await lies(env, 'rohfolgen=1&namen=1')) as { namen: { url: string; titel: string }[] }).namen.map((n) => [n.url, n.titel]).sort()),
  }
}

console.log('Leser-Vergleich: Altzeilen, Titelzeile direkt und eingespielte Altzeilen')
{
  const alt = neueDatenbank()
  const envAlt = umgebung(alt, { geschrieben: 0 }, false)
  await spiele(envAlt)
  const vorher = await leserAuszug(envAlt)
  pruefe(vorher.alle.length === 14 && vorher.rohfolgenAlle.length === 12, `Ausgang: Altzeilen in pruefung (${vorher.alle.length}) und Rohfolgen (${vorher.rohfolgenAlle.length})`)
  alt.exec(einspielSql('netflix'))
  pruefe(zahl(alt, 'SELECT COUNT(*) AS n FROM titel_zeile') === 3 && zaehlerStimmen(alt), 'Einspielen: eine Titelzeile je Adresse (drei), Zähler stimmen')
  pruefe(JSON.stringify(alt.prepare(verlustSql('netflix')).all()) === '[]', 'Verlustabfrage nach dem Einspielen leer')
  const nachher = await leserAuszug(envAlt)
  const neu = neueDatenbank()
  const envNeu = umgebung(neu, { geschrieben: 0 }, AN)
  await spiele(envNeu)
  const direkt = await leserAuszug(envNeu)
  pruefe(zahl(neu, 'SELECT COUNT(*) AS n FROM pruefung') === 0, 'Titelzeile direkt: nichts in pruefung')
  for (const feld of Object.keys(vorher) as (keyof typeof vorher)[]) {
    const [a, b, c] = [vorher[feld], nachher[feld], direkt[feld]].map((x) => JSON.stringify(x))
    pruefe(a === b, `nach dem Einspielen unverändert: ${feld}`)
    pruefe(a === c, `direkt in die Titelzeile geschrieben wie Altzeilen: ${feld}`)
    if (a !== b || a !== c) console.log('     alt', a, '\n     eingespielt', b, '\n     direkt', c)
  }
}

console.log('Abhaken')
{
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h, AN)
  await spiele(env)
  const offen = ((await lies(env, '')) as { pruefungen: { id: number; plattform: string }[] }).pruefungen.filter((p) => p.plattform === 'netflix')
  pruefe(offen.length === 14 && offen.every((p) => p.id >= TITEL_ID_AB), `14 offene Netflix-Folgen mit Ids der Titelzeile (${offen.length})`)
  h.geschrieben = 0
  await handlePruefung(post({ uebernommen: offen.map((p) => p.id) }), env)
  pruefe(h.geschrieben === 3, `Abhaken schreibt je Titel eine Zeile (${h.geschrieben})`)
  pruefe(((await lies(env, '')) as { pruefungen: unknown[] }).pruefungen.length === 0, 'danach ist der offene Auszug leer')
  const roh = ((await lies(env, 'rohfolgen=1&nach=0')) as { folgen: { id: number }[] }).folgen
  await handlePruefung(post({ rohfolgenUebernommen: roh.map((f) => f.id) }), env)
  pruefe(roh.length === 12 && ((await lies(env, 'rohfolgen=1&nach=0')) as { folgen: unknown[] }).folgen.length === 0, `Rohfolgen abgehakt (${roh.length})`)
}

if (fehler) {
  console.log(`${fehler} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('Alles in Ordnung.')
