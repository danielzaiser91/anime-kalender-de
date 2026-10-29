/**
 * Zusicherung: **Eine offene Kanal-Gruppe ohne Deutsch wird nur aussortiert, wenn alle drei Bedingungen gelten** (16.10.2026,
 * `lib/kanal-aussortieren.ts`): (a) keine Folge nennt Deutsch, (b) genau eine gelesene Seite, die ein Kanal-Beleg desselben Titels nennt,
 * (c) der Titel hat eine andere Adresse mit Deutsch. Fährt `fetch-rohfolgen.ts` ganz gegen eine Kulisse (`AK_ROOT`, Attrappe
 * `tools/rohfolgen-ablauf-mock.mjs`): Je Fall eine Gruppe, jede Bedingung einzeln gebrochen (jeweils auf der Grenze: 1 statt 0 deutsche
 * Folgen, 2 statt 1 Seite). Aussortiert wird verschoben: Zeilen stehen in der eigenen Datei und sind abgehakt, die offene Liste verliert sie.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/rohfolgen-ablauf-mock.mjs')).href
const dp = (asin: string) => `https://www.amazon.de/dp/${asin}`

interface Fall {
  titel: number
  /** Gelesene Seiten der Zeilen, in Reihenfolge (leer = Zeile ohne Seite). */
  seiten: string[]
  /** Wie viele Zeilen (von vorn) Deutsch nennen. */
  deutsch: number
  /** Die Seite, die der Kanal-Beleg nennt. */
  belegSeite: string | null
  /** Eine andere Adresse mit Handbeleg-Ja. */
  andereAdresse: boolean
  /** Art des Belegs zur Seite: Kanal-Warnung (Vorgabe), ohne Warnung, oder Kanal mit zweiter Quelle (dann zählt sein Ja). */
  beleg?: 'ohneKanal' | 'zweiteQuelle'
  /** Der Kanal-Beleg steht nur in der Merkliste `data/kanal-seiten.json`, nicht in der YAML (Handbeleg zurückgestellt). */
  nurMerkliste?: boolean
  /** Gruppe kommt erst im zweiten Lauf. */
  spaeter?: boolean
  erwartet: 'aussortiert' | 'offen' | 'zugeordnet'
  name: string
}

const NOTIZ = (seite: string) => `Tonspuren: Japanisch, Englisch — Amazon-Seite ${seite}: alle 5 Folgen geprüft, Abos: crunchyrollde — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg`
const fuenf = (seite: string) => [seite, seite, seite, seite, seite]
const faelle: Fall[] = [
  { titel: 801, name: 'alle drei Bedingungen', seiten: fuenf('B0KANAL801'), deutsch: 0, belegSeite: 'B0KANAL801', andereAdresse: true, erwartet: 'aussortiert' },
  { titel: 802, name: 'eine Folge nennt Deutsch (Grenze 0/1)', seiten: fuenf('B0KANAL802'), deutsch: 1, belegSeite: 'B0KANAL802', andereAdresse: true, erwartet: 'offen' },
  { titel: 803, name: 'zwei gelesene Seiten (Grenze 1/2)', seiten: ['B0KANAL803', 'B0KANAL803', 'B0KANAL803', 'B0KANALXXX', 'B0KANALXXX'], deutsch: 0, belegSeite: 'B0KANAL803', andereAdresse: true, erwartet: 'offen' },
  { titel: 804, name: 'eine Zeile ohne gelesene Seite', seiten: ['B0KANAL804', 'B0KANAL804', 'B0KANAL804', 'B0KANAL804', ''], deutsch: 0, belegSeite: 'B0KANAL804', andereAdresse: true, erwartet: 'offen' },
  { titel: 805, name: 'der Kanal-Beleg nennt eine andere Seite', seiten: fuenf('B0KANAL805'), deutsch: 0, belegSeite: 'B0ANDERE805', andereAdresse: true, erwartet: 'offen' },
  { titel: 806, name: 'der Titel hat keine andere Adresse mit Deutsch', seiten: fuenf('B0KANAL806'), deutsch: 0, belegSeite: 'B0KANAL806', andereAdresse: false, erwartet: 'offen' },
  { titel: 807, name: 'Deutsch nur über zugeordnete Rohfolgen einer anderen Seite', seiten: fuenf('B0KANAL807'), deutsch: 0, belegSeite: 'B0KANAL807', andereAdresse: false, erwartet: 'aussortiert' },
  { titel: 808, name: 'die andere Seite mit Deutsch ist selbst ein Kanal', seiten: fuenf('B0KANAL808'), deutsch: 0, belegSeite: 'B0KANAL808', andereAdresse: false, erwartet: 'offen' },
  { titel: 809, name: 'zwei Titel nennen dieselbe Kanal-Seite', seiten: fuenf('B0KANAL809'), deutsch: 0, belegSeite: 'B0KANAL809', andereAdresse: true, erwartet: 'offen' },
  { titel: 811, name: 'der Beleg zur Seite trägt keine Kanal-Warnung', seiten: fuenf('B0KANAL811'), deutsch: 0, belegSeite: 'B0KANAL811', andereAdresse: true, beleg: 'ohneKanal', erwartet: 'offen' },
  { titel: 812, name: 'Deutsch gibt es nur auf der Kanal-Seite selbst (zweite Quelle)', seiten: fuenf('B0KANAL812'), deutsch: 0, belegSeite: 'B0KANAL812', andereAdresse: false, beleg: 'zweiteQuelle', erwartet: 'offen' },
  { titel: 813, name: 'Deutsch gibt es nur auf derselben Seite (früher zugeordnet)', seiten: fuenf('B0KANAL813'), deutsch: 0, belegSeite: 'B0KANAL813', andereAdresse: false, erwartet: 'offen' },
  { titel: 814, name: 'schon zugeordnete Gruppe wird nicht aussortiert', seiten: fuenf('B0KANAL814'), deutsch: 0, belegSeite: 'B0KANAL814', andereAdresse: true, erwartet: 'zugeordnet' },
  { titel: 817, name: 'Gegenprobe B0F9FWKDXT: ADN-Staffeln gemischt in Amazon-Staffel 1, Deutsch stimmt (Daniel 16.10.2026)', seiten: fuenf('B0F9FWKDXT'), deutsch: 5, belegSeite: 'B0F9FWKDXT', andereAdresse: true, erwartet: 'offen' },
  { titel: 818, name: 'Gegenprobe Akudama Drive B0H348BY3J: Deutsch, in Prime enthalten, kein Kanal mit 18 Folgen (Daniel 16.10.2026)', seiten: fuenf('B0H348BY3J'), deutsch: 5, belegSeite: 'B0H348BY3J', andereAdresse: true, erwartet: 'offen' },
  { titel: 819, name: 'der Kanal-Beleg steht nur in der Merkliste (Handbeleg im Lauf zurückgestellt)', seiten: fuenf('B0KANAL819'), deutsch: 0, belegSeite: 'B0KANAL819', andereAdresse: true, nurMerkliste: true, erwartet: 'aussortiert' },
  { titel: 815, name: 'zweiter Lauf: weitere Gruppe', seiten: fuenf('B0KANAL815'), deutsch: 0, belegSeite: 'B0KANAL815', andereAdresse: true, spaeter: true, erwartet: 'aussortiert' },
]

const gruppenUrl = (f: Fall) => dp(f.belegSeite ?? `B0KANAL${f.titel}`)
const zeilenId = (f: Fall, i: number) => f.titel * 10 + i
const zeilen = (f: Fall) =>
  f.seiten.map((seite, i) => ({
    id: zeilenId(f, i),
    url: gruppenUrl(f),
    asin: null,
    gti: null,
    nummer: i + 1,
    titel: `Folge ${i + 1} von ${f.titel}`,
    erschienen: null,
    dauer_sek: null,
    sprachen: JSON.stringify(i < f.deutsch ? ['Deutsch', 'Japanisch'] : ['Japanisch', 'Englisch']),
    untertitel: null,
    staffel_text: null,
    staffel_nr: null,
    gemeldet_am: '2026-10-16T10:00:00Z',
    titel_id: f.titel,
    plattform: 'primevideo',
    seiten_kennung: seite || null,
  }))

const beleg = (id: number, url: string, dub: boolean, note: string, extra = '', platform = 'primevideo') =>
  `- anilistId: ${id}
  title: "Kulisse ${id}"
  platform: ${platform}
  url: ${url}
  dub: ${dub}
  checkedAt: '2026-10-10'
  note: "${note}"
${extra}`

/** Der Beleg zur Seite der Gruppe: Kanal-Nein (Vorgabe), ohne Kanal-Warnung oder mit zweiter Quelle (dann zählt sein Ja). */
function belegZurSeite(f: Fall): string {
  if (f.nurMerkliste) return ''
  if (f.beleg === 'ohneKanal') return beleg(f.titel, gruppenUrl(f), false, `Tonspuren: Japanisch — Amazon-Seite ${f.belegSeite}: Kauf ohne Deutsch`)
  if (f.beleg === 'zweiteQuelle') return beleg(f.titel, gruppenUrl(f), true, NOTIZ(f.belegSeite!), '  zweiteQuelle: JustWatch\n')
  return beleg(f.titel, gruppenUrl(f), false, NOTIZ(f.belegSeite!))
}

function handbelege(): string {
  const teile = faelle.map(belegZurSeite)
  for (const f of faelle.filter((x) => x.andereAdresse)) teile.push(beleg(f.titel, dp(`B0DEUTSCH${f.titel}`), true, 'Tonspuren: Deutsch'))
  teile.push(beleg(806, 'https://www.netflix.com/title/806', true, 'Deutsch bei Netflix', '', 'netflix'))
  teile.push(beleg(810, dp('B0KANAL809'), false, NOTIZ('B0KANAL809')))
  teile.push(beleg(808, dp('B0KANAL808B'), true, NOTIZ('B0KANAL808B')))
  return teile.join('')
}

const zugeordnet = (titel: number, seite: string) => [
  `${dp(seite)}#0`,
  { titleId: titel, plattform: 'primevideo', asin: null, seite, folgen: [{ unsere: 1, sprachen: ['Deutsch'] }] },
]

const lies = (kulisse: string, pfad: string) => JSON.parse(readFileSync(join(kulisse, pfad), 'utf8'))

function schreibeKulisse(kulisse: string): void {
  const schreibe = (pfad: string, inhalt: string) => {
    mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
    writeFileSync(join(kulisse, pfad), inhalt)
  }
  schreibe('public/data/titles.json', JSON.stringify(faelle.map((f) => ({ id: f.titel, titleDe: `Kulisse ${f.titel}`, episodes: 5, jpYear: 2020, streams: [] }))))
  schreibe('data/tmdb-folgen.json', JSON.stringify({ 814: { tmdbId: 1, folgen: [1, 2, 3, 4, 5].map((e) => ({ s: 1, e, titel: `Folge ${e} von 814`, datum: '2020-04-01', minuten: null })) } }))
  schreibe('public/data/cartoons.json', '[]')
  schreibe('public/data/ohne-synchro.json', '[]')
  schreibe('data/dub-confirmed.yaml', handbelege())
  schreibe('data/kanal-seiten.json', JSON.stringify(faelle.filter((f) => f.nurMerkliste).map((f) => ({ anilistId: f.titel, platform: 'primevideo', url: gruppenUrl(f), checkedAt: '', note: NOTIZ(f.belegSeite!), kanalOhneBeleg: true }))))
  const netflixDeutsch = [`https://www.netflix.com/title/806#0`, { titleId: 806, plattform: 'netflix', asin: null, seite: null, folgen: [{ unsere: 1, sprachen: ['Deutsch'] }] }]
  schreibe('data/prime-zugeordnet.json', JSON.stringify(Object.fromEntries([zugeordnet(807, 'B0ZUGEORD807'), zugeordnet(808, 'B0KANAL808B'), zugeordnet(813, 'B0KANAL813'), netflixDeutsch])))
}

function pruefeErgebnis(kulisse: string): string[] {
  const fehler: string[] = []
  const offen = new Set((lies(kulisse, 'data/prime-unzugeordnet.json') as { url: string }[]).map((o) => o.url))
  const weg = Object.values(lies(kulisse, 'data/prime-kanal-aussortiert.json') as Record<string, { titleId: number; andereAdresse: string; folgen: { id: number }[] }>)
  const zugeordnet = Object.values(lies(kulisse, 'data/prime-zugeordnet.json') as Record<string, { titleId: number }>)
  const abgehakt = new Set(lies(kulisse, 'data/cache/quittung-offen/rohfolgen-abhaken.json') as number[])
  for (const f of faelle.filter((x) => !x.spaeter)) {
    const eintrag = weg.find((w) => w.titleId === f.titel)
    const ids = f.seiten.map((_, i) => zeilenId(f, i))
    if (f.erwartet === 'aussortiert') {
      if (!eintrag) fehler.push(`${f.name}: nicht aussortiert`)
      else if (!eintrag.andereAdresse) fehler.push(`${f.name}: Adresse mit Deutsch fehlt`)
      else if (JSON.stringify(eintrag.folgen.map((x) => x.id)) !== JSON.stringify(ids)) fehler.push(`${f.name}: Zeilen nicht verschoben`)
      if (offen.has(gruppenUrl(f))) fehler.push(`${f.name}: steht noch in der offenen Liste`)
      if (!ids.every((id) => abgehakt.has(id))) fehler.push(`${f.name}: Zeilen nicht abgehakt`)
    } else if (f.erwartet === 'zugeordnet') {
      if (eintrag) fehler.push(`${f.name}: wurde aussortiert`)
      if (!zugeordnet.some((z) => z.titleId === f.titel)) fehler.push(`${f.name}: nicht zugeordnet (die Kulisse greift nicht)`)
    } else {
      if (eintrag) fehler.push(`${f.name}: wurde aussortiert`)
      if (!offen.has(gruppenUrl(f))) fehler.push(`${f.name}: fehlt in der offenen Liste`)
      if (ids.some((id) => abgehakt.has(id))) fehler.push(`${f.name}: Zeilen abgehakt`)
    }
  }
  return fehler
}

/** Ein Lauf des Zuordners gegen die Kulisse mit den gegebenen Rohfolgen; gibt eine Fehlermeldung oder null zurück. */
function laufe(kulisse: string, rohfolgen: unknown[]): string | null {
  writeFileSync(join(kulisse, 'rohfolgen.json'), JSON.stringify(rohfolgen))
  const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-rohfolgen.ts')], {
    cwd: wurzel,
    encoding: 'utf8',
    env: { ...process.env, AK_ROOT: kulisse, LAUF_TOKEN: 'test' },
  })
  return lauf.status === 0 ? null : `Lauf endete mit ${lauf.status}: ${lauf.stderr.slice(-300)}`
}

/** Zweiter Lauf mit einer weiteren Gruppe: Die Datei behält die früheren Gruppen. Dritter Lauf ohne Kanal-Gruppe: Es entsteht keine Datei. */
function pruefeFolgelaeufe(kulisse: string): string[] {
  const fehler: string[] = []
  const spaeter = faelle.find((f) => f.spaeter)!
  const zweiter = laufe(kulisse, zeilen(spaeter))
  if (zweiter) return [zweiter]
  const titel = Object.values(lies(kulisse, 'data/prime-kanal-aussortiert.json') as Record<string, { titleId: number }>).map((w) => w.titleId)
  for (const erwartet of [801, 807, spaeter.titel]) if (!titel.includes(erwartet)) fehler.push(`zweiter Lauf: Gruppe ${erwartet} fehlt in der Datei (früheres geht verloren)`)
  rmSync(join(kulisse, 'data/prime-kanal-aussortiert.json'))
  const dritter = laufe(kulisse, zeilen(faelle[1]!))
  if (dritter) fehler.push(dritter)
  else if (existsSync(join(kulisse, 'data/prime-kanal-aussortiert.json'))) fehler.push('ohne Kanal-Gruppe entstand trotzdem eine Datei')
  return fehler
}

const kulisse = mkdtempSync(join(tmpdir(), 'kanal-aussortieren-'))
const fehler: string[] = []
try {
  schreibeKulisse(kulisse)
  const erster = laufe(kulisse, faelle.filter((f) => !f.spaeter).flatMap(zeilen))
  if (erster) fehler.push(erster)
  else fehler.push(...pruefeErgebnis(kulisse), ...pruefeFolgelaeufe(kulisse))
} catch (e) {
  fehler.push(`Ergebnis nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-kanal-aussortieren:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-kanal-aussortieren: ${faelle.length} Fälle ok, Zeilen verschoben und abgehakt.`)
