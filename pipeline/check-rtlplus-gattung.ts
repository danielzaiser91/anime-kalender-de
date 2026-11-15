/**
 * Hörbuch-Filter des RTL+-Katalogs (`pipeline/lib/rtlplus-gattung.ts`, `pipeline/fetch-rtlplus-katalog.mjs`).
 * Fixtures tragen die echten Beschreibungen (Abruf 15.11.2026). Der Lauf fährt das ganze Skript gegen eine
 * Kulisse (`AK_ROOT`, Abruf-Attrappe per `--import`): Hörbuch fällt heraus, Serie und Film bleiben, ein
 * Abruffehler ist keine Auskunft (Altbestand bleibt, neuer Treffer kommt nicht hinein).
 * Aufruf: `npm run check:logic`.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { type KatalogEintrag, pruefeGattungen, rtlGattung, uebernimmKandidaten } from './lib/rtlplus-gattung.ts'

const seite = (beschreibung: string, zusatz = '') =>
  `<html><head><meta data-rh="true" name="description" content="${beschreibung}"/>${zusatz}</head></html>`
const HOERBUCH = seite('Jetzt The Adventures of Tom Sawyer von Mark Twain hören ► Weitere Hörbücher und Hörspiele auf RTL+ entdecken!')
const KINDER = seite('Jetzt Ronja Räubertochter von Astrid Lindgren Deutsch hören ► Weitere Kinder-Hörbücher auf RTL+ entdecken!')
const SERIE = seite(
  'Naruto Uzumaki ist ein japanischer Weisenjunge der sich nichts mehr als Anerkennung wünscht. Jetzt Naruto auf RTL+ streamen!',
  '<script type="application/ld+json">{"@type":"TVSeries","name":"Naruto"}</script>',
)
const FILM = seite('Summer Wars als Stream auf RTL+. Viele weitere Serien, Filme und Shows auf RTL+ streamen!')

assert.equal(rtlGattung(HOERBUCH), 'nicht-video')
assert.equal(rtlGattung(KINDER), 'nicht-video')
assert.equal(rtlGattung(SERIE), 'video')
assert.equal(rtlGattung(FILM), 'video')
assert.equal(rtlGattung(SERIE.replace('</head>', '</head><body>Jetzt hören ► Podcasts</body>')), 'video', 'die Marke zählt nur in der Beschreibung')
assert.equal(rtlGattung('<html></html>'), 'video', 'ohne Hörmarke bleibt der Eintrag (bisheriges Verhalten)')

// Bausteine: gestempelte Einträge werden nicht erneut abgerufen, ein Abruffehler lässt den Eintrag ungeprüft stehen.
const seiten: Record<string, string> = { 'u/hoer': HOERBUCH, 'u/serie': SERIE, 'u/film': FILM, 'u/hoer2': HOERBUCH }
const abrufe: string[] = []
const zeilen: string[] = []
const lauf = await pruefeGattungen(
  {
    '1': { url: 'u/hoer' },
    '2': { url: 'u/serie' },
    '3': { url: 'u/film', gattung: 'video' },
    '4': { url: 'u/kaputt' },
    '5': { url: 'u/hoer2', gattung: 'nicht-video' },
  },
  async (url) => {
    abrufe.push(url)
    if (!seiten[url]) throw new Error(`HTTP 503 für ${url}`)
    return seiten[url]
  },
  async () => {
    abrufe.push('Pause')
  },
  (z) => zeilen.push(z),
)
assert.deepEqual(abrufe, ['u/hoer', 'Pause', 'u/serie', 'Pause', 'u/kaputt', 'Pause', 'u/hoer2', 'Pause'], 'Pause nach jedem Abruf, gestempelte Einträge ohne Abruf')
assert.deepEqual(lauf.verworfen, ['1', '5'])
assert.deepEqual(lauf.unklar, ['4'])
assert.equal(lauf.geprueft, 4)
assert.deepEqual(Object.keys(lauf.bestand), ['2', '3', '4'])
assert.equal(lauf.bestand['2']?.gattung, 'video')
assert.equal(lauf.bestand['4']?.gattung, undefined, 'ohne Auskunft kein Stempel')
assert.ok(zeilen.some((z) => z.includes('503')), 'die erste Ursache steht im Log')
assert.ok(zeilen.some((z) => z.includes('verworfen') && z.includes('u/hoer')), 'jede Verwerfung steht im Log')

// Treffer aus der Sitemap: Hörbuch davor, Serie danach; gestempelter Eintrag mit Treffer bleibt; Abruffehler ohne Eintrag.
const vorBestand: Record<string, KatalogEintrag> = { '3': { url: 'u/film', gattung: 'video' } }
const reihenfolge: string[] = []
const treffer = await uebernimmKandidaten(
  vorBestand,
  new Map([
    ['1', [{ url: 'u/hoer', slug: 's1', titel: 'Eins' }, { url: 'u/serie', slug: 's2', titel: 'Eins' }, { url: 'u/film', slug: 's3', titel: 'Eins' }]],
    ['2', [{ url: 'u/kaputt', slug: 's4', titel: 'Zwei' }]],
    ['3', [{ url: 'u/film', slug: 's3', titel: 'Drei' }, { url: 'u/hoer', slug: 's1', titel: 'Drei' }]],
  ]),
  async (url) => {
    reihenfolge.push(url)
    if (!seiten[url]) throw new Error(`HTTP 503 für ${url}`)
    return seiten[url]
  },
  async () => {
    reihenfolge.push('Pause')
  },
  () => {},
  '2026-11-15',
)
assert.deepEqual(reihenfolge, ['u/hoer', 'Pause', 'u/serie', 'Pause', 'u/kaputt', 'Pause'], 'Pause nach jedem Abruf; Eintrag 3 ohne Abruf')
assert.deepEqual(treffer.neu, ['1'])
assert.deepEqual(treffer.verworfen, ['u/hoer'])
assert.deepEqual(treffer.unklar, ['u/kaputt'])
assert.deepEqual(treffer.bestand['1'], { url: 'u/serie', slug: 's2', titel: 'Eins', gefundenAm: '2026-11-15', gattung: 'video' })
assert.equal(treffer.bestand['2'], undefined)
assert.deepEqual(Object.keys(vorBestand), ['3'], 'der übergebene Bestand bleibt unverändert')

// Gesamtlauf des Skripts, zweimal hintereinander auf dem Ergebnis des ersten.
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const kulisse = mkdtempSync(join(tmpdir(), 'rtlplus-gattung-'))
const schreibe = (pfad: string, inhalt: string): void => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const titel = (id: number, name: string) => ({ id, titleDe: name, titleEn: name })
schreibe(
  'public/data/titles.json',
  JSON.stringify([
    titel(900001, 'Naruto Kulisse'),
    titel(900002, 'Tom Sawyers Kulisse'),
    titel(900003, 'Doppel Kulisse'),
    titel(900004, 'Altfall Hoerbuch'),
    titel(900005, 'Altfall Ausfall'),
    titel(900006, 'Neufall Ausfall'),
    titel(900007, 'Umgekehrt Kulisse'),
    titel(900008, 'Bestand Kulisse'),
    titel(900009, 'Unbestempelt Kulisse'),
    titel(900010, 'Verschoben Kulisse'),
  ]),
)
const eintrag = (slug: string, gattung?: string) => ({ url: `https://plus.rtl.de/${slug}`, slug, titel: slug, gefundenAm: '2026-08-30', gattung })
schreibe(
  'data/rtlplus-katalog.json',
  JSON.stringify({
    900004: eintrag('altfallhoerbuch-p_4'),
    900005: eintrag('altfallausfall-p_5'),
    900008: eintrag('bestandkulisse-p_11', 'video'),
    900009: eintrag('unbestempeltkulisse-p_13'),
    900010: eintrag('verschobenkulisse-p_15', 'video'),
  }),
)
// Sitemap-Reihenfolge: Doppel = Serie vor Hörbuch, Umgekehrt = Hörbuch vor Serie, Bestand = gestempelte Serie vor Hörbuch.
const sitemap = [
  'narutokulisse-p_1',
  'tomsawyerskulisse-p_2',
  'tomsawyerskulisse-p_2',
  'doppelkulisse-p_7',
  'doppelkulisse-p_8',
  'umgekehrtkulisse-p_9',
  'umgekehrtkulisse-p_10',
  'bestandkulisse-p_11',
  'bestandkulisse-p_12',
  'unbestempeltkulisse-p_13',
  'unbestempeltkulisse-p_14',
  'verschobenkulisse-p_16',
  'neufallausfall-p_6',
]
const seitenKulisse: Record<string, string> = {
  'narutokulisse-p_1': SERIE,
  'tomsawyerskulisse-p_2': HOERBUCH,
  'doppelkulisse-p_7': SERIE,
  'doppelkulisse-p_8': HOERBUCH,
  'umgekehrtkulisse-p_9': HOERBUCH,
  'umgekehrtkulisse-p_10': SERIE,
  'bestandkulisse-p_11': SERIE,
  'bestandkulisse-p_12': HOERBUCH,
  'unbestempeltkulisse-p_13': HOERBUCH,
  'unbestempeltkulisse-p_14': SERIE,
  'verschobenkulisse-p_16': SERIE,
  'altfallhoerbuch-p_4': HOERBUCH,
}
const karten: Record<string, string> = {
  'https://plus.rtl.de/programs.sitemap.xml': '<sitemapindex><sitemap><loc>https://plus.rtl.de/karte1.xml</loc></sitemap></sitemapindex>',
  'https://plus.rtl.de/karte1.xml': `<urlset>${sitemap.map((s) => `<url><loc>https://plus.rtl.de/${s}</loc></url>`).join('')}</urlset>`,
  ...Object.fromEntries(Object.entries(seitenKulisse).map(([slug, html]) => [`https://plus.rtl.de/${slug}`, html])),
}
const abrufLog = join(kulisse, 'abrufe.log')
schreibe(
  'attrappe.mjs',
  `import { appendFileSync } from 'node:fs'
const karten = ${JSON.stringify(karten)}
globalThis.fetch = async (url) => {
  appendFileSync(${JSON.stringify(abrufLog)}, String(url) + '\\n')
  const text = karten[String(url)]
  return text === undefined ? { ok: false, status: 503, text: async () => '' } : { ok: true, status: 200, text: async () => text }
}
`,
)
const fahreLauf = (): { ausgabe: string; abrufe: string[]; ergebnis: Record<string, { url?: string; gattung?: string; gefundenAm?: string }> } => {
  writeFileSync(abrufLog, '')
  const r = spawnSync(
    process.execPath,
    [tsx, '--import', pathToFileURL(join(kulisse, 'attrappe.mjs')).href, join(wurzel, 'pipeline/fetch-rtlplus-katalog.mjs'), '--pause', '0'],
    { env: { ...process.env, AK_ROOT: kulisse }, encoding: 'utf8', timeout: 60000, windowsHide: true },
  )
  const ausgabe = `${r.stdout}${r.stderr}`
  assert.equal(r.status, 0, `Lauf ist durchgelaufen: ${ausgabe}`)
  const abrufe = readFileSync(abrufLog, 'utf8').split('\n').filter((z) => z.includes('-p_')).map((z) => z.replace('https://plus.rtl.de/', ''))
  return { ausgabe, abrufe, ergebnis: JSON.parse(readFileSync(join(kulisse, 'data/rtlplus-katalog.json'), 'utf8')) }
}
const erster = fahreLauf()
const zweiter = fahreLauf()
rmSync(kulisse, { recursive: true, force: true })

// Lauf 1: Serien bleiben (auch wenn ein gleichnamiges Hörbuch davor oder dahinter steht), der gestempelte Bestand wird nicht
// angefasst und nicht abgerufen, Hörbücher und der neue Treffer ohne Auskunft kommen nicht hinein.
assert.deepEqual(Object.keys(erster.ergebnis).sort(), ['900001', '900003', '900005', '900007', '900008', '900009', '900010'], erster.ausgabe)
assert.equal(erster.ergebnis['900003']?.url, 'https://plus.rtl.de/doppelkulisse-p_7', 'Serie vor Hörbuch bleibt')
assert.equal(erster.ergebnis['900007']?.url, 'https://plus.rtl.de/umgekehrtkulisse-p_10', 'Serie nach Hörbuch wird gewählt')
assert.equal(erster.ergebnis['900008']?.url, 'https://plus.rtl.de/bestandkulisse-p_11', 'gestempelter Eintrag wird nicht überschrieben')
assert.equal(erster.ergebnis['900009']?.url, 'https://plus.rtl.de/unbestempeltkulisse-p_14', 'ungestempelter Hörbuch-Eintrag weicht der Serie derselben Kennung')
assert.equal(erster.ergebnis['900010']?.url, 'https://plus.rtl.de/verschobenkulisse-p_16', 'gestempelte Adresse, die nicht mehr in der Sitemap steht, wird ersetzt')
assert.match(String(erster.ergebnis['900001']?.gefundenAm), /^\d{4}-\d{2}-\d{2}$/, 'neuer Eintrag trägt das Funddatum')
for (const id of ['900001', '900003', '900007', '900008', '900009', '900010']) assert.equal(erster.ergebnis[id]?.gattung, 'video')
assert.equal(erster.ergebnis['900005']?.gattung, undefined, 'Altfall ohne Auskunft bleibt ungestempelt')
assert.ok(!erster.abrufe.some((u) => u.startsWith('bestandkulisse')), 'gestempelter Eintrag: kein Abruf, auch nicht des Hörbuchs daneben')
assert.ok(!erster.abrufe.includes('doppelkulisse-p_8'), 'nach dem ersten Videotreffer kein weiterer Abruf')
assert.match(erster.ausgabe, /verworfen \(Hörbuch\/Hörspiel\): 900002 /)
assert.match(erster.ausgabe, /Gattung offen \(900006\): HTTP 503/)
assert.match(erster.ausgabe, /11 Seiten geprüft, 4 Hörbücher\/Hörspiele verworfen, 2 ohne Auskunft/)
assert.match(erster.ausgabe, /5 neue Treffer, 7 im Bestand/)

// Lauf 2 auf dem Ergebnis: dieselben Einträge, keine Abrufe der Serien und keine neuen Treffer;
// nur das Hörbuch ohne Eintrag und die zwei Ausfälle werden erneut gelesen.
assert.deepEqual(zweiter.ergebnis, erster.ergebnis)
assert.deepEqual(zweiter.abrufe.sort(), ['altfallausfall-p_5', 'neufallausfall-p_6', 'tomsawyerskulisse-p_2'])
assert.match(zweiter.ausgabe, /3 Seiten geprüft, 1 Hörbücher\/Hörspiele verworfen, 2 ohne Auskunft/)
assert.match(zweiter.ausgabe, /0 neue Treffer, 7 im Bestand/)

console.log(
  'rtlplus-gattung: Hörbuch/Kinder-Hörbuch raus, Serie/Film bleiben, Abruffehler ohne Stempel, Gesamtlauf mit Kulisse in zwei Läufen (Lauf 1: 5 neu, 4 verworfen, 2 ohne Auskunft; Lauf 2: 0 neu, nur 3 Abrufe)',
)
