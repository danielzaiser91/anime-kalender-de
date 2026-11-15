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
import { pruefeGattungen, rtlGattung } from './lib/rtlplus-gattung.ts'

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

// Gesamtlauf des Skripts.
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
    titel(900003, 'Peter Pan Kulisse'),
    titel(900004, 'Altfall Hoerbuch'),
    titel(900005, 'Altfall Ausfall'),
    titel(900006, 'Neufall Ausfall'),
  ]),
)
const eintrag = (slug: string) => ({ url: `https://plus.rtl.de/${slug}`, slug, titel: slug, gefundenAm: '2026-08-30' })
schreibe(
  'data/rtlplus-katalog.json',
  JSON.stringify({ 900004: eintrag('altfallhoerbuch-p_4'), 900005: eintrag('altfallausfall-p_5') }),
)
const karten: Record<string, string> = {
  'https://plus.rtl.de/programs.sitemap.xml': '<sitemapindex><sitemap><loc>https://plus.rtl.de/karte1.xml</loc></sitemap></sitemapindex>',
  'https://plus.rtl.de/karte1.xml': `<urlset>${['narutokulisse-p_1', 'tomsawyerskulisse-p_2', 'peterpankulisse-p_3', 'neufallausfall-p_6']
    .map((s) => `<url><loc>https://plus.rtl.de/${s}</loc></url>`)
    .join('')}</urlset>`,
  'https://plus.rtl.de/narutokulisse-p_1': SERIE,
  'https://plus.rtl.de/tomsawyerskulisse-p_2': HOERBUCH,
  'https://plus.rtl.de/peterpankulisse-p_3': HOERBUCH,
  'https://plus.rtl.de/altfallhoerbuch-p_4': HOERBUCH,
}
schreibe(
  'attrappe.mjs',
  `const karten = ${JSON.stringify(karten)}
globalThis.fetch = async (url) => {
  const text = karten[String(url)]
  return text === undefined ? { ok: false, status: 503, text: async () => '' } : { ok: true, status: 200, text: async () => text }
}
`,
)
const r = spawnSync(
  process.execPath,
  [tsx, '--import', pathToFileURL(join(kulisse, 'attrappe.mjs')).href, join(wurzel, 'pipeline/fetch-rtlplus-katalog.mjs'), '--pause', '0'],
  { env: { ...process.env, AK_ROOT: kulisse }, encoding: 'utf8', timeout: 60000, windowsHide: true },
)
const ausgabe = `${r.stdout}${r.stderr}`
assert.equal(r.status, 0, `Lauf ist durchgelaufen: ${ausgabe}`)
const ergebnis = JSON.parse(readFileSync(join(kulisse, 'data/rtlplus-katalog.json'), 'utf8')) as Record<string, { gattung?: string }>
rmSync(kulisse, { recursive: true, force: true })

assert.deepEqual(Object.keys(ergebnis).sort(), ['900001', '900005'], `Serie und Altfall ohne Auskunft bleiben, Hörbücher und Neufall ohne Auskunft nicht: ${ausgabe}`)
assert.equal(ergebnis['900001']?.gattung, 'video')
assert.equal(ergebnis['900005']?.gattung, undefined)
assert.match(ausgabe, /verworfen \(Hörbuch\/Hörspiel\): 900002 /)
assert.match(ausgabe, /Gattung offen \(900006\): HTTP 503/)
assert.match(ausgabe, /6 Seiten geprüft, 3 Hörbücher\/Hörspiele verworfen, 2 ohne Auskunft/)

console.log('rtlplus-gattung: Hörbuch/Kinder-Hörbuch raus, Serie/Film bleiben, Abruffehler ohne Stempel, Gesamtlauf mit Kulisse (3 verworfen, 2 ohne Auskunft)')
