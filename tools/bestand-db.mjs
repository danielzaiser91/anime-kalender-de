#!/usr/bin/env node
/**
 * **Der Bauplatz als Datenbank** — erster Schritt (02.10.2026).
 *
 * Anlass: Daniel — „wir bewegen jeden Arbeitstag zig Gigabyte Text, um ein paar Kilobyte Antwort
 * zu finden" (gemessen: 292 MB Wurzel, 68 % davon `data/`, ≈ 22 Suchen je Arbeitsstunde). Der Plan
 * steht in `docs/wissen/datenbank-plan.md`.
 *
 * Dieses Werkzeug baut `data/bestand.sqlite` **aus dem, was schon ausgeliefert ist** — kein neuer
 * Abruf, keine Änderung am Bau. Es ist der Beweis, dass die Fragen von heute als Abfrage gehen:
 *
 *   node tools/bestand-db.mjs                 baut die Datei und zählt die Tabellen
 *   node tools/bestand-db.mjs --frage slots   deutsche Crunchyroll-Slots ohne deutschen Weg
 *
 * `data/bestand.sqlite` ist ein **Artefakt** und gehört nicht ins Repo (siehe `.gitignore`).
 * Sobald Stufe 2 des Plans steht, entsteht der Bestand selbst aus der DB statt umgekehrt.
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATEI = resolve(WURZEL, 'data/bestand.sqlite')

const lies = (p) => (existsSync(resolve(WURZEL, p)) ? JSON.parse(readFileSync(resolve(WURZEL, p), 'utf8')) : null)
const liste = (j, feld) => (Array.isArray(j) ? j : (j?.[feld] ?? []))

if (!existsSync(dirname(DATEI))) mkdirSync(dirname(DATEI), { recursive: true })
const db = new DatabaseSync(DATEI)

db.exec(`
  PRAGMA foreign_keys = OFF;
  DROP TABLE IF EXISTS titel; DROP TABLE IF EXISTS stream; DROP TABLE IF EXISTS release;
  DROP TABLE IF EXISTS slot;    DROP TABLE IF EXISTS historie;
  CREATE TABLE titel (id INTEGER PRIMARY KEY, name TEXT, jp_start TEXT, ohne_synchro INTEGER DEFAULT 0);
  CREATE TABLE stream (titel_id INTEGER NOT NULL REFERENCES titel(id), platform TEXT NOT NULL,
                       url TEXT, dub INTEGER CONSTRAINT stream_dub_ist_wahr CHECK (dub IN (0,1)));
  CREATE TABLE release (slug TEXT PRIMARY KEY, titel_id INTEGER NOT NULL REFERENCES titel(id),
                        platform TEXT, art TEXT, start TEXT, estimated INTEGER DEFAULT 0);
  CREATE TABLE slot (key TEXT, serie_id TEXT, titel TEXT, datum TEXT, zeit TEXT,
                     episode INTEGER, german INTEGER);
  CREATE TABLE historie (titel_id INTEGER PRIMARY KEY, seit TEXT);
  CREATE INDEX stream_titel ON stream(titel_id);
  CREATE INDEX release_titel ON release(titel_id);
  CREATE INDEX slot_serie ON slot(serie_id);
  PRAGMA foreign_keys = ON;
`)

const titel = liste(lies('public/data/titles.json'), 'titles')
const ohne = liste(lies('public/data/ohne-synchro.json'), 'titles')
const releases = liste(lies('public/data/releases.json'), 'releases')
const cr = lies('data/crunchyroll.json')
const hist = lies('data/synchro-historie.json')

const setTitel = db.prepare('INSERT INTO titel (id, name, jp_start, ohne_synchro) VALUES (?,?,?,?)')
const setStream = db.prepare('INSERT INTO stream (titel_id, platform, url, dub) VALUES (?,?,?,?)')
const setRelease = db.prepare('INSERT INTO release (slug, titel_id, platform, art, start, estimated) VALUES (?,?,?,?,?,?)')
const setSlot = db.prepare('INSERT INTO slot (key, serie_id, titel, datum, zeit, episode, german) VALUES (?,?,?,?,?,?,?)')
const setHist = db.prepare('INSERT OR REPLACE INTO historie (titel_id, seit) VALUES (?,?)')

db.exec('BEGIN')
for (const t of titel) {
  setTitel.run(t.id, t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id), t.jpStart ?? null, t.ohneSynchro ? 1 : 0)
  for (const s of t.streams ?? []) setStream.run(t.id, s.platform, s.url ?? null, s.dub === true ? 1 : 0)
}
/* Die ganz ohne Synchro gehören dazu — sonst findet die Frage unten ihre Kandidaten nicht. */
for (const t of ohne) {
  setTitel.run(t.id, t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id), t.jpStart ?? null, 1)
  for (const s of t.streams ?? []) setStream.run(t.id, s.platform, s.url ?? null, s.dub === true ? 1 : 0)
}
const luecken = []
const gesehen = new Set()
let doppelt = 0
const hatTitel = new Set()
for (const t of titel) hatTitel.add(t.id)
for (const t of ohne) hatTitel.add(t.id)
/*
  **Ein Release ohne Titel ist ein Loch im Bestand** — genau die Klasse, die eine Dateiablage
  versteckt und ein Fremdschlüssel sichtbar macht. Sie werden gezählt und genannt, nicht
  mitgeschrieben.
*/
for (const r of releases) {
  if (!hatTitel.has(r.titleId)) {
    luecken.push(`${r.slug} → Titel ${r.titleId}`)
    continue
  }
  if (gesehen.has(r.slug)) {
    doppelt++
    continue
  }
  gesehen.add(r.slug)
  setRelease.run(r.slug, r.titleId, r.platform, r.releaseType, r.schedule?.firstEpisodeDate ?? null, r.schedule?.estimated ? 1 : 0)
}
for (const [key, v] of Object.entries(cr?.german ?? {})) {
  setSlot.run(key, v.seriesId ?? null, (v.rawTitle ?? '').replace(/\s*\(Deutsch\)\s*$/i, ''), v.earliest?.date ?? null, v.time ?? null, v.earliest?.episode ?? null, 1)
}
/* `seit` kennt Titel, die nicht mehr im Bestand sind — der Fremdschlüssel lässt sie fallen. */
for (const [id, seit] of Object.entries(hist?.seit ?? {})) {
  if (titel.some((t) => t.id === Number(id)) || ohne.some((t) => t.id === Number(id))) setHist.run(Number(id), seit)
}
db.exec('COMMIT')

const zaehl = (t) => db.prepare(`select count(*) c from ${t}`).get().c
const frage = process.argv[2] === '--frage' ? process.argv[3] : null

if (!frage) {
  console.log(`bestand.sqlite gebaut: titel ${zaehl('titel')} · streams ${zaehl('stream')} · releases ${zaehl('release')} · deutsche Slots ${zaehl('slot')} · Historien ${zaehl('historie')}`)
  console.log(`Löcher (Release ohne Titel): ${luecken.length}${luecken.length ? ' → ' + luecken.slice(0, 5).join(', ') : ''}`)
  console.log(`doppelte Release-Kennungen: ${doppelt}`)
  console.log('Fragen: --frage slots | --frage ohne-stream | --frage dub')
} else if (frage === 'slots') {
  /* **Die Frage, die den Anlass gab:** Ein deutscher Crunchyroll-Slot, zu dessen Serie im Bestand
     kein deutscher Weg steht — Overgeared, 02.10.2026. Ein Join, keine Dateisuche. */
  const zeilen = db.prepare(`
    select s.serie_id, s.titel, s.datum, s.episode
    from slot s
    left join titel t on t.name like s.titel || '%'
    left join stream st on st.titel_id = t.id and st.platform = 'crunchyroll' and st.dub = 1
    where st.url is null
    group by s.serie_id, s.titel
    order by s.datum
  `).all()
  console.log(`deutsche Crunchyroll-Slots ohne deutschen Weg im Bestand: ${zeilen.length}`)
  for (const z of zeilen) console.log(`  ${z.datum}  ${z.titel}  (Serie ${z.serie_id}, Folge ${z.episode})`)
} else if (frage === 'ohne-stream') {
  const z = db.prepare(`select t.id, t.name from titel t left join stream s on s.titel_id = t.id where s.url is null limit 20`).all()
  console.log(`Titel ohne jeden Weg (erste 20 von …): ${z.length}`)
  for (const x of z) console.log(`  ${x.id}  ${x.name}`)
} else if (frage === 'dub') {
  console.log('deutsche Streams:', db.prepare('select count(*) c from stream where dub = 1').get().c)
}
db.close()
