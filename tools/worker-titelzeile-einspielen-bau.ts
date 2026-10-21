/**
 * **Titelzeilen aus den Altzeilen bauen, lokal statt in der Datenbank** (14.10.2026, Daniel: „warum nicht löschen und
 * neufüllen? wir wissen doch was drin steht?“). Rein, ohne Datenbank: Eingang sind die exportierten Zeilen aus `pruefung`
 * und `prime_folge` eines Anbieters (Abfragen in `exportSql`) und die Titelzeilen, die es schon gibt; Ausgang sind die
 * SQL-Anweisungen, die nur die fertigen Zeilen schreiben. Ablauf und Messung: docs/wissen/betrieb.md, Abschnitt
 * „Titelzeile einspielen: Export, lokal bauen, einfügen“.
 *
 * Das Format der Folge kommt aus dem Worker (`eintragAusMeldung`, `kopfAusMeldung`, `zaehleOffene`, `setzeEin`), die
 * Ableitung alter Meldungen aus `leiteAb`. Hier stehen nur die Regeln, die es nur beim Umzug gibt: je Folge die jüngste
 * Meldung, Rohfolge aus der Meldung oder sonst aus `prime_folge`, Folgen nur in `prime_folge`, Abhak-Marken der Altzeilen.
 */
import { leiteAb } from '../worker/src/pruefung-ableiten.ts'
import {
  AM,
  eintragAusMeldung,
  gleicheFolge,
  kopfAusMeldung,
  lies,
  MELDUNG_UEBERNOMMEN,
  NUMMER,
  ROHFOLGE_UEBERNOMMEN,
  setzeEin,
  STAFFEL,
  zaehleOffene,
  type Eintrag,
  type TitelDaten,
} from '../worker/src/titelzeile-format.ts'

/** Eine Altzeile aus `pruefung`, wie `exportSql('pruefung', …)` sie liefert (`r_gti`/`r_titel` aus der Spalte `rohfolge`). */
export type PruefZeile = {
  id: number
  url: string
  staffel: number | null
  folge_nr: number | null
  folge: string | null
  r_gti: string | null
  r_titel: string | null
  sprachen: string | null
  vorhanden: string | null
  ton_de: string | null
  art: string | null
  befund: string
  titel_id: number | null
  uebernommen: number
  roh_uebernommen: number | null
  notiz: string | null
  folgen: number | null
  gemeldet_am: string
  staffeln: string | null
  titel: string | null
  serientitel: string | null
}

/** Eine Rohfolge aus `prime_folge` (nur mit `gti`); `angenommen` aus `roh`. */
export type RohZeile = {
  id: number
  url: string
  staffel_nr: number | null
  nummer: number | null
  gti: string
  titel: string | null
  sprachen: string | null
  vorhanden: string | null
  ton_de: string | null
  uebernommen: number
  angenommen: number | null
  gemeldet_am: string
}

/** Eine vorhandene Titelzeile, wie `exportSql('titel_zeile', …)` sie liefert. */
export type Vorhanden = { url: string; version: number; daten: string; gemeldet_am: string }

export type Tabelle = 'pruefung' | 'prime_folge' | 'titel_zeile'

/** Zeilen je Abfrage beim Export; die Antwort der D1-API bleibt so bei wenigen MB (Staffelstruktur bis rund 750 Byte je Zeile). */
export const SEITE = 1000

const SPALTEN: Record<Tabelle, string> = {
  pruefung: `id, url, staffel, folge_nr, folge, json_extract(rohfolge, '$.gti') AS r_gti, json_extract(rohfolge, '$.titel') AS r_titel,
       sprachen, vorhanden, ton_de, art, befund, titel_id, uebernommen, roh_uebernommen, notiz, folgen, gemeldet_am, staffeln, titel, serientitel`,
  prime_folge: `id, url, staffel_nr, nummer, gti, titel, sprachen, vorhanden, ton_de, uebernommen,
       CASE WHEN json_valid(roh) THEN json_extract(roh, '$.angenommen') END AS angenommen, gemeldet_am`,
  titel_zeile: 'url, version, daten, gemeldet_am',
}

/**
 * Eine Seite des Exports. `pruefung`/`prime_folge` nach `id` ab `ab` (ohne Index auf `plattform` liest jede Seite die
 * Zeilen aller Anbieter in ihrem Id-Bereich, alle Seiten zusammen jede Tabelle also einmal); `titel_zeile` ganz. `bis`
 * (nur die Probeseite) deckelt den Id-Bereich, damit die Seite höchstens so viele Zeilen liest.
 */
export function exportSql(tabelle: Tabelle, plattform: string, ab = 0, bis?: number): string {
  const anbieter = `plattform = ${text(plattform)}`
  if (tabelle === 'titel_zeile') return `SELECT ${SPALTEN[tabelle]} FROM titel_zeile WHERE ${anbieter}`
  const gti = tabelle === 'prime_folge' ? ' AND gti IS NOT NULL' : ''
  const grenze = bis === undefined ? '' : ` AND id <= ${Math.trunc(bis)}`
  return `SELECT ${SPALTEN[tabelle]} FROM ${tabelle} WHERE ${anbieter}${gti} AND id > ${Math.trunc(ab)}${grenze} ORDER BY id LIMIT ${SEITE}`
}

/** Eine fertige Titelzeile: Daten und je Kopffeld der Zeitpunkt der Meldung, aus der es stammt. */
export type Gebaut = { daten: TitelDaten; kopfAm: { s: string; t: string; st: string } }

const folgenSchluessel = (s: number | null, n: number | null) => `${s ?? -1}|${n ?? -1}`
const juenger = (a: { gemeldet_am: string; id: number }, b: { gemeldet_am: string; id: number }) =>
  a.gemeldet_am > b.gemeldet_am || (a.gemeldet_am === b.gemeldet_am && a.id > b.id)
const json = (w: string | null): unknown => {
  if (w === null) return null
  try {
    return JSON.parse(w)
  } catch {
    return null
  }
}

/** Je Adresse und Folge die jüngste Zeile. */
function juengsteJeFolge<Z extends { url: string; id: number; gemeldet_am: string }>(zeilen: Z[], folge: (z: Z) => string) {
  const je = new Map<string, Map<string, Z>>()
  for (const z of zeilen) {
    const folgen = je.get(z.url) ?? new Map<string, Z>()
    const alt = folgen.get(folge(z))
    if (!alt || juenger(z, alt)) folgen.set(folge(z), z)
    je.set(z.url, folgen)
  }
  return je
}

/** Die Folge aus der jüngsten Meldung `j` und der jüngsten Rohfolge `r` derselben Folge (eine von beiden fehlt höchstens). */
export function eintragAusAltzeilen(j: PruefZeile | undefined, r: RohZeile | undefined): Eintrag {
  if (!j) return eintragNurRohfolge(r!)
  const gti = j.r_gti ?? r?.gti ?? null
  const rohTitel = j.r_titel ?? r?.titel ?? null
  const daten = {
    staffel: j.staffel,
    folge_nr: j.folge_nr,
    folge: j.folge,
    rohfolgen: gti !== null || rohTitel !== null ? [{ gti, titel: rohTitel }] : undefined,
    sprachen: json(j.sprachen),
    titel_id: j.titel_id,
    notiz: j.notiz,
    folgen: j.folgen,
  }
  /* Meldungen vor Stufe 1 (22.09.2026) haben nur `befund`; der Worker leitet daraus ab. */
  const ab = j.vorhanden === null || j.ton_de === null || j.art === null ? leiteAb({ befund: j.befund, notiz: j.notiz }) : null
  if (ab && 'fehler' in ab) throw new Error(`pruefung ${j.id}: ${ab.fehler}`)
  const e = eintragAusMeldung(daten, { vorhanden: j.vorhanden ?? ab!.vorhanden, tonDe: j.ton_de ?? ab!.tonDe, art: j.art ?? ab!.art }, j.gemeldet_am)
  e[MELDUNG_UEBERNOMMEN] = j.uebernommen ? 1 : 0
  e[ROHFOLGE_UEBERNOMMEN] = (j.roh_uebernommen ?? r?.uebernommen ?? 1) ? 1 : 0
  return e
}

/** Eine Folge, die nur in `prime_folge` steht: keine offene Meldung, Folgentitel als `folge`. */
function eintragNurRohfolge(r: RohZeile): Eintrag {
  const daten = { staffel: r.staffel_nr, folge_nr: r.nummer, folge: r.titel, rohfolgen: [{ gti: r.gti, titel: r.titel }], sprachen: json(r.sprachen) }
  const art = r.angenommen ? 'angenommen' : 'gemessen'
  const e = eintragAusMeldung(daten, { vorhanden: r.vorhanden ?? 'ja', tonDe: r.ton_de ?? 'unbekannt', art }, r.gemeldet_am)
  e[MELDUNG_UEBERNOMMEN] = 1
  e[ROHFOLGE_UEBERNOMMEN] = r.uebernommen ? 1 : 0
  return e
}

/** Der Kopf einer Adresse: je Feld der jüngste Wert, der nicht leer ist (wie `setzeEin` ihn Meldung für Meldung setzt). */
function kopfJeAdresse(zeilen: PruefZeile[]): Pick<Gebaut, 'kopfAm'> & Pick<TitelDaten, 's' | 't' | 'st'> {
  const kopf: Pick<TitelDaten, 's' | 't' | 'st'> = { s: null, t: null, st: null }
  const kopfAm = { s: '', t: '', st: '' }
  for (const z of [...zeilen].sort((a, b) => (juenger(a, b) ? 1 : -1))) {
    const neu = kopfAusMeldung({ staffeln: json(z.staffeln), titel: z.titel, serientitel: z.serientitel })
    for (const feld of ['s', 't', 'st'] as const) {
      if (neu[feld] === null) continue
      Object.assign(kopf, { [feld]: neu[feld] })
      kopfAm[feld] = z.gemeldet_am
    }
  }
  return { ...kopf, kopfAm }
}

const nachFolge = (a: Eintrag, b: Eintrag) => (a[STAFFEL] ?? -Infinity) - (b[STAFFEL] ?? -Infinity) || (a[NUMMER] ?? -Infinity) - (b[NUMMER] ?? -Infinity)

/** Je Adresse die Titelzeile aus allen Altzeilen eines Anbieters. */
export function baueTitelzeilen(pruefung: PruefZeile[], prime: RohZeile[]): Map<string, Gebaut> {
  const meldungen = juengsteJeFolge(pruefung, (z) => folgenSchluessel(z.staffel, z.folge_nr))
  const rohfolgen = juengsteJeFolge(prime, (z) => folgenSchluessel(z.staffel_nr, z.nummer))
  // Map.groupBy fehlt in der Worker-Lib (ES2022).
  const jeAdresse = new Map<string, PruefZeile[]>()
  for (const z of pruefung) {
    const liste = jeAdresse.get(z.url)
    if (liste) liste.push(z)
    else jeAdresse.set(z.url, [z])
  }
  const ergebnis = new Map<string, Gebaut>()
  for (const url of [...new Set([...meldungen.keys(), ...rohfolgen.keys()])].sort()) {
    const j = meldungen.get(url) ?? new Map<string, PruefZeile>()
    const r = rohfolgen.get(url) ?? new Map<string, RohZeile>()
    const f = [...new Set([...j.keys(), ...r.keys()])].map((k) => eintragAusAltzeilen(j.get(k), r.get(k))).sort(nachFolge)
    const { kopfAm, ...kopf } = kopfJeAdresse(jeAdresse.get(url) ?? [])
    ergebnis.set(url, { daten: { ...kopf, f }, kopfAm })
  }
  return ergebnis
}

/**
 * Altzeilen in eine vorhandene Titelzeile übernehmen: je Folge und Kopffeld gewinnt das Jüngere. Eine Titelzeile gibt es
 * für eine Adresse mit Altzeilen nur, wenn ein früherer Lauf sie angelegt hat (der Worker legt sie dort nie an,
 * `hatAltzeilen`): Ihr Stand ist dann so alt wie der Export oder jünger (Worker seither), nur Nachzügler aus der Zeit
 * zwischen Export und Einfügen sind jünger. Eingesetzt wird wie im Worker (`setzeEin`: neue Fassung bei geändertem Inhalt).
 * `null`: nichts zu schreiben.
 * `gemeldet_am` = jüngste Folge (seit 17.10.2026); eine reine Kopfänderung des Workers hebt es nicht. Vor dem nächsten
 * Einspielen den Kopfvergleich prüfen.
 */
export function fuehreZusammen(vorhanden: Vorhanden, gebaut: Gebaut): TitelDaten | null {
  /* Kopffelder gegen die jüngste Folge der Titelzeile, nicht gegen ihr letztes Schreiben (siehe oben). */
  const juengerAls = (am: string) => am > vorhanden.gemeldet_am
  const kopf = {
    s: juengerAls(gebaut.kopfAm.s) ? gebaut.daten.s : null,
    t: juengerAls(gebaut.kopfAm.t) ? gebaut.daten.t : null,
    st: juengerAls(gebaut.kopfAm.st) ? gebaut.daten.st : null,
  }
  let stand = lies(vorhanden.daten)
  let geaendert = false
  for (const e of gebaut.daten.f) {
    const alt = stand.f.find((x) => gleicheFolge(x, e))
    if (alt && alt[AM] >= e[AM]) continue
    const r = setzeEin(stand, [...e] as Eintrag, kopf)
    if (r.art === 'gleich' && !r.kopfNeu) continue
    stand = r.daten
    geaendert = true
  }
  return geaendert ? stand : null
}

/** SQL-Text in einfachen Anführungszeichen. */
export const text = (w: string) => `'${w.replaceAll("'", "''")}'`

/** D1 nimmt höchstens 100.000 Byte je Anweisung (Limits, Stand 14.10.2026); ein längerer Titel kommt in Teilen. */
export const GRENZE = 100_000
const bytes = (s: string) => Buffer.byteLength(s)

/**
 * Die Anweisungen für eine Titelzeile: neu (`INSERT … ON CONFLICT DO NOTHING`, `nr` wie im Worker) oder gegen die gelesene
 * Version (`UPDATE … WHERE version = ?`, hat der Worker seither geschrieben, ändert sie nichts; der nächste Lauf liest neu).
 * Passt sie nicht in eine Anweisung, hängen weitere die übrigen Folgen an, nur an genau die eben geschriebene Fassung.
 */
export function anweisungen(plattform: string, url: string, daten: TitelDaten, vorhanden?: Vorhanden): string[] {
  const offen = zaehleOffene(daten)
  const am = [vorhanden?.gemeldet_am ?? '', ...daten.f.map((e) => e[AM])].reduce((a, b) => (b > a ? b : a))
  const version = vorhanden ? vorhanden.version + 1 : 1
  const wo = `url = ${text(url)} AND plattform = ${text(plattform)}`
  const zeile = (f: Eintrag[]) => {
    const d = text(JSON.stringify({ ...daten, f }))
    if (vorhanden) {
      return `UPDATE titel_zeile SET daten = ${d}, version = ${version}, gemeldet_am = ${text(am)}, offen_meldung = ${offen.meldung}, offen_rohfolge = ${offen.rohfolge} WHERE ${wo} AND version = ${vorhanden.version};`
    }
    return `INSERT INTO titel_zeile (url, plattform, nr, version, daten, gemeldet_am, offen_meldung, offen_rohfolge) VALUES (${text(url)}, ${text(plattform)}, (SELECT IFNULL(MAX(nr), 0) + 1 FROM titel_zeile), 1, ${d}, ${text(am)}, ${offen.meldung}, ${offen.rohfolge}) ON CONFLICT DO NOTHING;`
  }
  const anhang = (f: Eintrag[], schon: number) =>
    `UPDATE titel_zeile SET daten = json_insert(daten${f.map((e) => `, '$.f[#]', json(${text(JSON.stringify(e))})`).join('')}) WHERE ${wo} AND version = ${version} AND gemeldet_am = ${text(am)} AND json_array_length(daten, '$.f') = ${schon};`
  const teile = inTeile(daten.f, bytes(zeile([])), (e) => bytes(text(JSON.stringify(e))) + 1)
  const ergebnis = [zeile(teile[0] ?? [])]
  let schon = teile[0]?.length ?? 0
  for (const rest of inTeile(daten.f.slice(schon), bytes(anhang([], 0)) + 10, (e) => bytes(`, '$.f[#]', json(${text(JSON.stringify(e))})`))) {
    ergebnis.push(anhang(rest, schon))
    schon += rest.length
  }
  return ergebnis
}

/** Folgen der Reihe nach in Teile, deren Anweisung (Grundlänge + Länge je Folge) unter `GRENZE` bleibt. */
function inTeile(f: Eintrag[], grund: number, laenge: (e: Eintrag) => number): Eintrag[][] {
  const teile: Eintrag[][] = []
  let teil: Eintrag[] = []
  let summe = grund
  for (const e of f) {
    if (teil.length && summe + laenge(e) > GRENZE) {
      teile.push(teil)
      teil = []
      summe = grund
    }
    teil.push(e)
    summe += laenge(e)
  }
  if (teil.length) teile.push(teil)
  return teile
}

/**
 * Alle Anweisungen eines Laufs: jede Adresse ohne Titelzeile neu, jede mit Titelzeile nur, wo die Altzeilen Jüngeres tragen
 * (Nachzügler); nach Adresse sortiert, damit `nr` in derselben Reihenfolge vergeben wird wie früher im Einspiel-SQL.
 * Leer = nichts mehr zu tun.
 */
export function einspielAnweisungen(plattform: string, pruefung: PruefZeile[], prime: RohZeile[], titelzeilen: Vorhanden[]): string[] {
  const da = new Map(titelzeilen.map((t) => [t.url, t]))
  const ergebnis: string[] = []
  for (const [url, gebaut] of baueTitelzeilen(pruefung, prime)) {
    const vorhanden = da.get(url)
    if (!vorhanden) {
      ergebnis.push(...anweisungen(plattform, url, gebaut.daten))
      continue
    }
    const neu = fuehreZusammen(vorhanden, gebaut)
    if (neu) ergebnis.push(...anweisungen(plattform, url, neu, vorhanden))
  }
  return ergebnis
}
