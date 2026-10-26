/**
 * **Prüfung: Eine frische Synchro-Ankündigung wird nicht hinter den Toggle verschoben** (26.10.2026, Iceblade Sorcerer Staffel 2:
 * Crunchyroll kündigte die Synchro an, der Katalog meldete „0 von 3 deutsch“, die Staffel wanderte hinter den Toggle). Regel:
 * `frischAngekuendigt` / `ausgestrahltOhneBeleg` in `bau/ohne-beleg.ts`, 60 Tage nach `omuAb`. Dazu die Bestandswache
 * `check-ankuendigung-versteckt-bestand.ts` als Prozess gegen einen Wegwerf-Ordner.
 *
 * Aufruf: npx tsx pipeline/check-ankuendigung-sichtbar.ts
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Title } from '../shared/types.ts'
import type { AniListMedia } from './lib/anilist.ts'

/* Der Bau schreibt Dateien unter `data/` (widerlegte Termine, Sprecherquellen): Er läuft gegen einen Wegwerf-Ordner (`AK_ROOT`), nie gegen das Repo. */
const bauOrdner = mkdtempSync(join(tmpdir(), 'ankuendigung-sichtbar-bau-'))
mkdirSync(join(bauOrdner, 'data'))
for (const datei of ['ohne-synchro-von-hand.yaml', 'kino-ankuendigungen.yaml']) copyFileSync(join(import.meta.dirname, '..', 'data', datei), join(bauOrdner, 'data', datei))
mkdirSync(join(bauOrdner, 'data', 'curated'))
process.env.AK_ROOT = bauOrdner
const { ankuendigungenLaden } = await import('./lib/ankuendigungen.ts')
const { setzeMarkenFuerPruefung } = await import('./lib/anisearch-marke.ts')
const { ANKUENDIGUNG_FRIST_TAGE, ausgestrahltOhneBeleg, frischAngekuendigt, keineSynchroGilt } = await import('./bau/ohne-beleg.ts')
const { ohneBelegteSynchro } = await import('./bau/synchro-belegt.ts')
const { rolleTermineAusMitKomplettabwurf } = await import('./bau/10-komplettabwurf.ts')
const { baueTitel } = await import('./bau/02-titel.ts')
const { versteckteFrischeAnkuendigungen, versteckteWarnzeile } = await import('./lib/ankuendigung-versteckt.ts')

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
const wurzel = fileURLToPath(new URL('..', import.meta.url))

const titel = (id: number, ank: Title['ankuendigung'] | undefined, extra: Partial<Title> = {}): Title =>
  ({ id, jpYear: 2026, streams: [{ platform: 'crunchyroll' }], ankuendigung: ank, ...extra }) as unknown as Title
const ank = (omuAb: string, synchro: 'angekuendigt' | 'offen' = 'angekuendigt') => ({ platform: 'crunchyroll', omuAb, synchro, quellen: [], stand: '2026-09-15' }) as Title['ankuendigung']
/* AniList-Medium wie im Bau (Vorbild check-herkunftsland.ts): `titleFromMedia` erzeugt den Titel, nichts wird von Hand ergänzt. */
const medium = (id: number): AniListMedia => ({
  id,
  idMal: null,
  title: { romaji: 'Test', english: null, native: null },
  format: 'TV',
  status: 'RELEASING',
  episodes: 12,
  duration: 24,
  season: 'FALL',
  seasonYear: 2026,
  startDate: { year: 2026, month: 10, day: 7 },
  genres: [],
  tags: [],
  externalLinks: [],
  studios: { nodes: [] },
  coverImage: { large: null, extraLarge: null },
  bannerImage: null,
  averageScore: null,
  isAdult: false,
  description: null,
  countryOfOrigin: 'JP',
})

console.log('Frist')
{
  pruefe(ANKUENDIGUNG_FRIST_TAGE === 60, '60 Tage')
  const t = titel(900001, ank('2026-10-08'))
  pruefe(frischAngekuendigt(t, '2026-10-08'), 'am Starttag frisch')
  pruefe(frischAngekuendigt(t, '2026-12-07'), 'Tag 60 (07.12.): frisch')
  pruefe(!frischAngekuendigt(t, '2026-12-08'), 'Tag 61 (08.12.): abgelaufen')
  pruefe(frischAngekuendigt(t, '2026-10-01'), 'vor dem Start (Ankündigung gilt schon): frisch')
  const monat = titel(900002, ank('2026-10'))
  pruefe(frischAngekuendigt(monat, '2026-11-30'), 'nur Monat: zählt ab dem 1. — Tag 60 (30.11.) frisch')
  pruefe(!frischAngekuendigt(monat, '2026-12-01'), 'nur Monat: Tag 61 (01.12.) abgelaufen')
  pruefe(!frischAngekuendigt(titel(900003, ank('2026-10-08', 'offen')), '2026-10-09'), 'Synchro „offen“ ist keine Ankündigung der Synchro')
  pruefe(!frischAngekuendigt(titel(900004, undefined), '2026-10-09'), 'ohne Ankündigung: nie frisch')
}

console.log('ausgestrahltOhneBeleg: Ankündigung schlägt den Katalog, bis sie abläuft')
{
  /* Iceblade Sorcerer II: der Eintrag steht wörtlich in data/ankuendigungen.yaml, aniSearch führt Deutsch als „geplant“ (p), der Weg ist ein Crunchyroll-Weg ohne Beleg. */
  const echt = ankuendigungenLaden(wurzel).get(212503)
  pruefe(echt?.omuAb === '2026-10-08' && echt.synchro === 'angekuendigt', `echter Eintrag 212503: ${echt?.omuAb} / ${echt?.synchro}`)
  setzeMarkenFuerPruefung({ 212503: 'p', 900010: 'p' })
  const iceblade = titel(212503, echt)
  pruefe(!ausgestrahltOhneBeleg(iceblade, '2026-10-26'), 'Iceblade am Bau-Tag 26.10.2026: bleibt im Hauptbestand')
  pruefe(!ausgestrahltOhneBeleg(iceblade, '2026-12-07'), 'Iceblade Tag 60: bleibt')
  pruefe(ausgestrahltOhneBeleg(iceblade, '2026-12-08'), 'Iceblade Tag 61: die bisherige Regel gilt wieder (zweiter Bau, wieder hinter dem Toggle)')
  const ohne = titel(900010, undefined)
  pruefe(ausgestrahltOhneBeleg(ohne, '2026-10-26'), 'Gegenprobe: gleicher Titel ohne Ankündigung wird verschoben')
  pruefe(ausgestrahltOhneBeleg(titel(900010, ank('2026-10-08', 'offen')), '2026-10-26'), 'Gegenprobe: Ankündigung ohne Synchro-Aussage schützt nicht')
  pruefe(!ausgestrahltOhneBeleg(titel(900010, ank('2026-10-08'), { streams: [] } as Partial<Title>), '2026-12-08'), 'bisherige Regeln bleiben: ohne Weg nie verschoben')
  pruefe(!ausgestrahltOhneBeleg(titel(900010, ank('2026-10-08'), { jpYear: 2019 } as Partial<Title>), '2026-12-08'), 'bisherige Regeln bleiben: vor 2023 nie verschoben')
  pruefe(ausgestrahltOhneBeleg(titel(900010, undefined, { jpYear: 2023 } as Partial<Title>), '2026-10-26'), 'bisherige Grenze: 2023 wird verschoben')
  pruefe(!ausgestrahltOhneBeleg(titel(900010, undefined, { jpYear: 2022 } as Partial<Title>), '2026-10-26'), 'bisherige Grenze: 2022 bleibt')
  setzeMarkenFuerPruefung(undefined)
}

console.log('Ankündigung schlägt aniSearch „Deutsch nicht genannt“ (F70, Rayearth)')
{
  /* Rayearth 2026 (178868) wörtlich aus data/ankuendigungen.yaml; aniSearch führt Deutsch als „-“, der Weg ist ein Crunchyroll-Weg ohne Beleg. */
  const echt = ankuendigungenLaden(wurzel).get(178868)
  pruefe(echt?.omuAb === '2026-10-07' && echt.synchro === 'angekuendigt', `echter Eintrag 178868: ${echt?.omuAb} / ${echt?.synchro}`)
  setzeMarkenFuerPruefung({ 178868: '-', 900051: '-', 900052: '-' })
  const rayearth = titel(178868, echt, { dubConfidence: 'low' } as Partial<Title>)
  pruefe(!keineSynchroGilt(rayearth, '2026-10-26'), 'Rayearth am 26.10.2026: aniSearchs „keine Synchro“ gilt nicht')
  pruefe(!keineSynchroGilt(rayearth, '2026-12-06'), 'Rayearth Tag 60: gilt nicht')
  pruefe(keineSynchroGilt(rayearth, '2026-12-07'), 'Rayearth Tag 61: aniSearch gilt wieder')
  pruefe(keineSynchroGilt(titel(900051, undefined), '2026-10-26'), 'Gegenprobe: ohne Ankündigung gilt aniSearch')
  pruefe(keineSynchroGilt(titel(900051, ank('2026-10-08', 'offen')), '2026-10-26'), 'Gegenprobe: Ankündigung ohne Synchro-Aussage schützt nicht')
  /* Der Streifen „keine deutsche Synchro“ (ohneBelegteSynchro) bleibt auch bei frischer Ankündigung (Daniel, F71, 26.10.2026). */
  pruefe(ohneBelegteSynchro(rayearth, []), 'Streifen: Rayearth mit frischer Ankündigung behält ihn')
  pruefe(ohneBelegteSynchro(titel(900051, ank('2000-01-01'), { dubConfidence: 'low' } as Partial<Title>), []), 'Streifen: abgelaufene Ankündigung ebenso')
  pruefe(ohneBelegteSynchro(titel(900051, undefined, { dubConfidence: 'low' } as Partial<Title>), []), 'Streifen Gegenprobe: ohne Ankündigung bleibt er')
  setzeMarkenFuerPruefung(undefined)
}

console.log('Ende zu Ende: Bau-Phasen 02 und 10 mit Titeln aus titleFromMedia, Ankündigung nur aus der Datei')
{
  /* Kein Titel trägt `ankuendigung` von Hand: sie kommt aus der Datei (echtes Format) über die Bauphase. Ferne Zukunft = frisch, 2000 = abgelaufen (uhrunabhängig). */
  const ids = { frisch: 900061, frischOhneWeg: 900062, abgelaufen: 900063, offen: 900064, ohne: 900065, katalog: 900066, katalogOffen: 900067, nirgends: 900068 }
  const eintrag = (id: number, omuAb: string, synchro: string) => `  - { anilistId: ${id}, titel: "Fixture ${id}", platform: crunchyroll, omuAb: "${omuAb}", synchro: ${synchro}, stand: "2026-09-15", quellen: [lineup] }`
  const zeilen = ['quellen:', '  lineup: https://example.org/lineup', 'eintraege:',
    eintrag(ids.frisch, '2999-01-01', 'angekuendigt'), eintrag(ids.frischOhneWeg, '2999-01-01', 'angekuendigt'),
    eintrag(ids.abgelaufen, '2000-01-01', 'angekuendigt'), eintrag(ids.offen, '2999-01-01', 'offen'),
    eintrag(ids.katalog, '2999-01-01', 'angekuendigt'), eintrag(ids.katalogOffen, '2999-01-01', 'offen'), eintrag(ids.nirgends, '2999-01-01', 'angekuendigt')]
  writeFileSync(join(bauOrdner, 'data', 'ankuendigungen.yaml'), zeilen.join('\n'))
  /* Katalogeintrag im Format von data/cache/anilist-katalog.json (Rayearth 2026 als Vorlage); nur diese beiden stehen im Katalog, in keinem Bestand. */
  const katalogZeile = (id: number) => ({ id, mal: 59204, t: ['Katalog Fixture', null, null], format: 'TV', jahr: 2026, start: '2026-10-07', status: 'RELEASING', latein: null, synonyme: [], folgen: null, genres: ['Fantasy'], score: 69, cover: null, eltern: [], rel: [] })
  mkdirSync(join(bauOrdner, 'data', 'cache'), { recursive: true })
  writeFileSync(join(bauOrdner, 'data', 'cache', 'anilist-katalog.json'), JSON.stringify({ eintraege: [katalogZeile(ids.katalog), katalogZeile(ids.katalogOffen)] }))
  setzeMarkenFuerPruefung({ [ids.frisch]: '-', [ids.frischOhneWeg]: 'p', [ids.abgelaufen]: '-', [ids.offen]: '-', [ids.ohne]: '-', [ids.katalog]: '-' })
  /* Der echte Erzeuger (baueTitel, darin titleFromMedia und die Ankündigung aus der Datei); nur die Wege kommen aus späteren Phasen und stehen von Hand dran. */
  const byAniId = Object.fromEntries([ids.frisch, ids.frischOhneWeg, ids.abgelaufen, ids.offen, ids.ohne].map((id) => [String(id), medium(id)]))
  const { titles, jpStart, jpStartAnzeige } = baueTitel({ byMal: {}, byAniId, confidenceRaw: {} })
  for (const t of titles.values()) if (t.id !== ids.katalog) t.streams = [{ platform: 'crunchyroll' }] as Title['streams']
  const { verschoben } = rolleTermineAusMitKomplettabwurf({ releases: [], titles, jpStart }, { handNein: () => new Set(), tmdb: {} })
  const weg = verschoben.map((t) => t.id).sort().join()
  pruefe(weg === [ids.abgelaufen, ids.offen, ids.ohne].join(), `verschoben: ${weg} (abgelaufene, offene und fehlende Ankündigung; frische bleiben trotz „-“ bzw. „p“)`)
  pruefe(titles.has(ids.frisch) && titles.has(ids.frischOhneWeg), 'beide frischen Titel bleiben im Bestand')
  pruefe(titles.get(ids.frisch)?.ankuendigung?.omuAb === '2999-01-01', 'die Ankündigung kommt aus der Datei an den Titel')
  const ausKatalog = titles.get(ids.katalog)
  pruefe(ausKatalog !== undefined && ausKatalog.ankuendigung?.synchro === 'angekuendigt' && ausKatalog.malId === 59204 && jpStart.get(ids.katalog) === '2026-10-07' && jpStartAnzeige.get(ids.katalog) === '2026-10-07', 'Katalogtitel mit angekündigter Synchro kommt in den Bestand (mit MAL-Kennung und Start)')
  pruefe(!verschoben.some((t) => t.id === ids.katalog), 'und wird trotz aniSearch „-“ nicht verschoben (Rayearth)')
  pruefe(!titles.has(ids.katalogOffen) && !jpStart.has(ids.katalogOffen), 'Katalogtitel mit Synchro „offen“ bleibt draußen')
  pruefe(!titles.has(ids.nirgends), 'Ankündigung ohne Titel in Bestand und Katalog: nichts wird erfunden, kein Absturz')
  setzeMarkenFuerPruefung(undefined)
}

console.log('Bestandswache')
{
  const a = titel(900021, ank('2026-10-08'), { titleEn: 'Frisch' } as Partial<Title>)
  const b = titel(900022, ank('2026-08-01'), { titleEn: 'Abgelaufen' } as Partial<Title>)
  const c = titel(900023, undefined, { titleEn: 'Ohne' } as Partial<Title>)
  const treffer = versteckteFrischeAnkuendigungen([a, b, c], '2026-10-26')
  pruefe(treffer.length === 1 && treffer[0]!.id === 900021, 'nur der frische Titel')
  pruefe(versteckteWarnzeile([]) === undefined, 'keine Warnzeile ohne Treffer')
  pruefe(/2 Titel .*: 900021 Frisch; 900024 Zweiter$/.test(versteckteWarnzeile([a, titel(900024, ank('2026-10-08'), { titleEn: 'Zweiter' } as Partial<Title>)]) ?? ''), 'zwei Titel, mit „; “ getrennt')
  pruefe(/^ {2}⚠ WARNUNG Ankündigung: 1 Titel .*: 900021 Frisch$/.test(versteckteWarnzeile(treffer) ?? ''), versteckteWarnzeile(treffer) ?? '')

  // Als Prozess gegen einen Wegwerf-Ordner (Datei unter dem Namen, den die Wache liest).
  const ordner = mkdtempSync(join(tmpdir(), 'ankuendigung-versteckt-'))
  const daten = join(ordner, 'public', 'data')
  mkdirSync(daten, { recursive: true })
  writeFileSync(join(daten, 'ohne-synchro.json'), JSON.stringify([a, b, c]))
  mkdirSync(join(ordner, 'data'), { recursive: true })
  const eintraege = [900021, '2026-10-08', 900041, '2999-01-01', 900042, '2000-01-01']
  const yamlZeilen = ['quellen:', '  lineup: https://example.org/lineup', 'eintraege:']
  for (let i = 0; i < eintraege.length; i += 2) yamlZeilen.push(`  - { anilistId: ${eintraege[i]}, titel: "Wache ${eintraege[i]}", platform: crunchyroll, omuAb: "${eintraege[i + 1]}", synchro: angekuendigt, stand: "2026-09-15", quellen: [lineup] }`)
  writeFileSync(join(ordner, 'data', 'ankuendigungen.yaml'), yamlZeilen.join('\n'))
  const hauptDatei = join(daten, 'titles.json')
  writeFileSync(hauptDatei, JSON.stringify([{ id: 900021 }, { id: 900041 }, { id: 900042 }]))
  const lauf = (heute: string) =>
    spawnSync(process.execPath, ['--import', 'tsx', join(wurzel, 'pipeline', 'check-ankuendigung-versteckt-bestand.ts'), ordner, heute], { cwd: wurzel, encoding: 'utf8' })
  const warnt = lauf('2026-10-26')
  pruefe(warnt.status === 0 && /⚠ WARNUNG Ankündigung: 1 Titel/.test(warnt.stdout) && warnt.stdout.includes('VERSTÖSSE: 0'), `Prozess heute 26.10.: Warnung, Exit 0 — ${warnt.stdout.trim().slice(0, 120)}`)
  const still = lauf('2027-03-01')
  pruefe(still.status === 0 && !/WARNUNG/.test(still.stdout) && /✓ Ankündigung/.test(still.stdout), 'Prozess später: keine Warnung (Frist abgelaufen), Exit 0')
  // Fehlt ein Titel mit frischer Ankündigung in titles.json (egal wo sonst), warnt die Wache — auch wenn er nirgends steht.
  writeFileSync(hauptDatei, JSON.stringify([{ id: 900042 }]))
  const fehlt = lauf('2026-10-26')
  pruefe(fehlt.status === 0 && /⚠ WARNUNG Ankündigung: 2 Titel .* fehlen in titles\.json .*: 900021; 900041$/m.test(fehlt.stdout) && fehlt.stdout.includes('VERSTÖSSE: 0'), `Prozess: fehlende Titel mit frischer Ankündigung warnen, Exit 0 — ${fehlt.stdout.trim().slice(-160)}`)
  const fehltSpaeter = lauf('2027-03-01')
  pruefe(/⚠ WARNUNG Ankündigung: 1 Titel .* fehlen in titles\.json .*: 900041$/m.test(fehltSpaeter.stdout), 'Prozess: das übergebene Datum zählt (900021 ist am 01.03.2027 abgelaufen, nur 900041 fehlt)')
  pruefe(!/fehlen in titles/.test(warnt.stdout) && /✓ Ankündigung: jeder Titel/.test(warnt.stdout), 'Prozess: stehen alle in titles.json, keine Fehlt-Warnung')
  writeFileSync(hauptDatei, JSON.stringify([{ id: 900021 }, { id: 900041 }, { id: 900042 }]))
  // Ohne Datumsargument gilt der Tag des Laufs: ferner Start = immer frisch (Warnung), alter Start = abgelaufen (keine).
  writeFileSync(join(daten, 'ohne-synchro.json'), JSON.stringify([titel(900041, ank('2999-01-01'), { titleEn: 'Fern' } as Partial<Title>)]))
  const ohneDatum = spawnSync(process.execPath, ['--import', 'tsx', join(wurzel, 'pipeline', 'check-ankuendigung-versteckt-bestand.ts'), ordner], { cwd: wurzel, encoding: 'utf8' })
  pruefe(ohneDatum.status === 0 && /WARNUNG Ankündigung: 1 Titel .*900041 Fern/.test(ohneDatum.stdout), 'Prozess ohne Datum: Tag des Laufs, ferner Start warnt')
  writeFileSync(join(daten, 'ohne-synchro.json'), JSON.stringify([titel(900042, ank('2000-01-01'))]))
  const altOhneDatum = spawnSync(process.execPath, ['--import', 'tsx', join(wurzel, 'pipeline', 'check-ankuendigung-versteckt-bestand.ts'), ordner], { cwd: wurzel, encoding: 'utf8' })
  pruefe(altOhneDatum.status === 0 && !/WARNUNG/.test(altOhneDatum.stdout), 'Prozess ohne Datum: alter Start warnt nicht')
  rmSync(ordner, { recursive: true, force: true })
}

rmSync(bauOrdner, { recursive: true, force: true })
if (fehler) {
  console.error(`${fehler} Fall/Fälle rot`)
  process.exit(1)
}
console.log('check-ankuendigung-sichtbar: alle Fälle grün')
