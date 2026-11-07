/**
 * Artikel-Router der Anime2You-Auswertung (`lib/anime2you-router.ts`, `lib/anime2you-router-lauf.ts`, `anime2you-router.ts`, Verdrahtung im Workflow):
 * 16 echte Artikel (`tools/anime2you-router-faelle.json`: Text, echte Rubriken von anime2you.de, Claudes Rohantwort; Soll von Hand am Artikeltext gelesen),
 * die Bedingungen einzeln, Stichprobe, Rubrik-Leser, Schritt gegen Wegwerf-Ordner (Schatten, scharf, Rückbau), Übernahme durch `--uebernehmen`,
 * Schattenzeile und beide Skripte als eigener Prozess. Soll-Werte stehen fest im Test, nie aus dem geprüften Modul.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { alsVorschlag, entscheide, istStichprobe, plane, rubrikenAusHtml } from './lib/anime2you-router.ts'
import { leseRouterZeile, routerSchritt } from './lib/anime2you-router-lauf.ts'
import { bilanz, type Lauf } from './lib/anime2you-schatten.ts'
import { schattenSchritt } from './lib/anime2you-schatten-lauf.ts'
import type { Bestand } from './lib/anime2you-bestand.ts'

interface Fall {
  id: string
  menge: string
  name: string
  rubriken: string[]
  weg: 'regel' | 'claude'
  grund?: string
  plattform?: string
  titel?: string[]
  text: string
  claude: { titel: string; plattform: string; sprache: string }[]
}
interface Schritt {
  id?: string
  name?: string
  uses?: string
  run?: string
  if?: string
  env?: Record<string, string>
  [schluessel: string]: unknown
}

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const faelle = JSON.parse(readFileSync(join(wurzel, 'tools/anime2you-router-faelle.json'), 'utf8')) as Fall[]
const fall = (id: string): Fall => faelle.find((f) => f.id === id)!
const art = (f: Fall, rubriken = f.rubriken, text = f.text) => ({ id: f.id, text, rubriken })

/* Echte Artikel: Weg, Grund, Behauptungen. */
for (const f of faelle) {
  const e = entscheide(art(f))
  pruefe(`${f.id} (${f.name}): Weg ${f.weg}`, e.weg === f.weg, e.grund)
  if (f.weg === 'claude') pruefe(`${f.id}: Grund „${f.grund}“`, e.grund === f.grund && e.vorschlaege === undefined, e)
  else {
    const v = e.vorschlaege ?? []
    pruefe(`${f.id}: Titel der Behauptungen`, v.map((x) => x.titel).join('|') === f.titel!.join('|'), v.map((x) => x.titel))
    pruefe(`${f.id}: Plattform ${f.plattform} und Art sprachfassung bei allen`, v.every((x) => x.plattform === f.plattform && x.art === 'sprachfassung'), v)
    // Fehlbeleg = Regel behauptet deutsch, Claude hat zu Titel und Plattform keinen deutschen Vorschlag.
    const fehlbelege = v.filter((x) => !f.claude.some((c) => c.plattform === x.plattform && c.titel.toLowerCase().startsWith(String(x.titel).toLowerCase()) && c.sprache.startsWith('deutsch')))
    pruefe(`${f.id}: Fehlbelege gegen Claude = 0`, fehlbelege.length === 0, fehlbelege)
    // Claude-Vorschläge ohne Regel-Gegenstück: nur Aoashi/PSYREN bei Prime Video (Claudes eigener Fehlbeleg), sonst keiner.
    const rest = f.claude.filter((c) => !v.some((x) => x.plattform === c.plattform && c.titel.toLowerCase().startsWith(String(x.titel).toLowerCase())))
    pruefe(`${f.id}: Claude-Rest ${f.id === '1064193' ? 'Aoashi und PSYREN bei Prime Video' : 'leer'}`, rest.map((c) => `${c.titel}/${c.plattform}`).join('|') === (f.id === '1064193' ? 'Aoashi – Staffel 2/primevideo|PSYREN/primevideo' : ''), rest)
  }
}

/* Plan über alle 16: erspart, Stichprobe (Kennung durch 5 teilbar), Rest. */
const plan = plane(faelle.map((f) => art(f)))
pruefe('Plan: erspart', plan.erspart.join() === '1064193,1065119,1066144,1060946', plan.erspart)
pruefe('Plan: Stichprobe', plan.stichprobe.join() === '1063615,1066100', plan.stichprobe)
pruefe('Plan: Rest = 10 Artikel', plan.rest.length === 10 && plan.entscheidungen.length === 16, plan.rest)

/* Bedingungen einzeln, am erklärten Artikel 1063615 verändert. */
const ok = fall('1063615')
const mit = (text: string, rubriken = ok.rubriken) => entscheide({ id: '1063615', text, rubriken })
pruefe('Grundlage: 1063615 mit eigenen Rubriken ist erklärt', mit(ok.text).weg === 'regel')
pruefe('ohne Rubrik: Claude, „keine Rubrik“', mit(ok.text, []).grund === 'keine Rubrik')
pruefe('Rubrik Merchandise neben einer erlaubten: Claude', mit(ok.text, ['Crunchyroll', 'Merchandise']).grund === 'Rubrik Merchandise')
pruefe('Rubrik Merchandise vor einer erlaubten: Claude', mit(ok.text, ['Merchandise', 'Crunchyroll']).grund === 'Rubrik Merchandise')
pruefe('zwei erlaubte Rubriken (ADN und Crunchyroll): erklärt', mit(ok.text, ['ADN', 'Crunchyroll']).weg === 'regel')
for (const r of ['Crunchyroll', 'Netflix', 'Prime Video', 'Disney+', 'Paramount+', 'ADN', 'aniverse']) pruefe(`Rubrik ${r} ist erlaubt`, mit(ok.text, [r]).weg === 'regel')
for (const r of ['Merchandise', 'Promo-Video', 'Japan', 'DVD & Blu-ray', 'Ankündigung', 'TV-Guide', 'ProSieben MAXX', 'crunchyroll', '']) pruefe(`Rubrik „${r}“ ist nicht erlaubt`, mit(ok.text, [r]).weg === 'claude')
pruefe('Text ohne „Veröffentlicht“: keine Behauptung', mit(ok.text.replace('Veröffentlicht:', 'Datum:')).grund === 'keine Behauptung')
const mitSatz = `${ok.text}\nAußerdem läuft »Foo Bar« ab sofort auf Crunchyroll mit deutscher Synchronisation.\n`
pruefe('zusätzliche Satz-Behauptung: Claude', mit(mitSatz).grund === 'Satz-Behauptung')
const text2 = (zusatz: string): string => `${ok.text}\n${zusatz}\n`
pruefe('Titel ohne Behauptung: Claude mit dem Titel', mit(text2('Mehr zu »Apothekerin Spin-off« folgt.')).grund === 'Titel ohne Behauptung: Apothekerin Spin-off')
pruefe('Titel enthält den Titel einer Behauptung (länger im Text): erklärt', mit(text2('Mehr zu »A Wild Last Boss Appeared! Special« folgt.')).weg === 'regel')
pruefe('Titel steckt im Titel einer Behauptung (kürzer im Text, vier Zeichen): erklärt', mit(text2('Mehr zu »Tagebücher« folgt.')).weg === 'regel')
pruefe('Text-Titel mit drei Zeichen im Titel einer Behauptung: Claude', mit(text2('Mehr zu »Wil« folgt.')).grund === 'Titel ohne Behauptung: Wil')
pruefe('Text-Titel mit vier Zeichen im Titel einer Behauptung: erklärt', mit(text2('Mehr zu »Wild« folgt.')).weg === 'regel')
pruefe('Block mit Titel unter vier Zeichen deckt sich nicht selbst: Claude', entscheide({ id: '1', rubriken: ['Crunchyroll'], text: 'Neuer Titel auf Crunchyroll\nVeröffentlicht: 2026-10-24\n\n»Ao«\nSprache: Deutsch, Japanisch (UT)\nStream: Crunchyroll\n' }).grund === 'Titel ohne Behauptung: Ao')
const ohneErsteZeile = ok.text.slice(ok.text.indexOf('\n') + 1)
pruefe('Titel nur in der Überschrift (erste Zeile): Claude', mit(`Zwei Neuzugänge: »Foo Bar« auf Crunchyroll\n${ohneErsteZeile}`).grund === 'Titel ohne Behauptung: Foo Bar')
const mitTag = entscheide({ id: '1', rubriken: ['Crunchyroll'], text: 'Neuer Titel auf Crunchyroll\nVeröffentlicht: 2026-10-24\n\n2. November: »Foo Bar«\nSprache: Deutsch, Japanisch (UT)\nStream: Crunchyroll\n' })
pruefe('Block mit Tag vor dem Titel: erklärt, Datum 2026-11-02 gegen den Veröffentlichungstag geprüft', mitTag.weg === 'regel' && mitTag.vorschlaege?.[0]?.datum === '2026-11-02', mitTag)
// Das zweite Zitat scheitert an der Prüfung (Länge über 500): nicht nur der erste Block wird geprüft.
const lang = ok.text.replace(/Stream: Prime Video , Crunchyroll(?![\s\S]*Stream: Prime Video , Crunchyroll)/, `Stream: Crunchyroll ${'x'.repeat(600)}`)
pruefe('Fall zum Zitat über 500 Zeichen verändert den Text', lang !== ok.text && lang.length > ok.text.length + 500)
pruefe('zweite Behauptung scheitert an der Prüfung: Claude mit Grund „Prüfung: …“', mit(lang).grund?.startsWith('Prüfung: zitat') === true, mit(lang))
const lang1 = ok.text.replace('Stream: Prime Video , Crunchyroll', `Stream: Crunchyroll ${'x'.repeat(600)}`)
pruefe('erste Behauptung scheitert an der Prüfung: Claude', mit(lang1).grund?.startsWith('Prüfung: zitat') === true, mit(lang1))

/* alsVorschlag: feste Felder. */
const v1 = alsVorschlag({ titel: 'Foo', plattform: 'netflix', sprache: 'deutsch+omu', zitat: 'Zitat', familie: 'block' })
pruefe('Vorschlag aus Behauptung: alle Felder, Datum null', JSON.stringify(v1) === JSON.stringify({ titel: 'Foo', art: 'sprachfassung', plattform: 'netflix', anbieter: null, sender: null, datum: null, uhrzeit: null, wochentage: null, sprache: 'deutsch+omu', folgen: null, zitat: 'Zitat', unsicher: null }), v1)
pruefe('Vorschlag aus Behauptung: Datum übernommen', alsVorschlag({ titel: 'Foo', plattform: 'netflix', sprache: 'deutsch', zitat: 'Z', familie: 'block', datum: '2026-11-02' }).datum === '2026-11-02')

/* Stichprobe: jede fünfte Kennung. */
for (const [id, soll] of [['1000005', true], ['1000010', true], ['1000015', true], ['1000001', false], ['1000002', false], ['1000003', false], ['1000004', false], ['1000006', false], ['1000008', false], ['abc', true], ['10x5', true]] as const) pruefe(`Stichprobe ${id}: ${soll}`, istStichprobe(id) === soll)

/* Rubriken aus dem JSON-LD (Formen von anime2you.de und Umgehungen). */
const seite = (...bloecke: string[]): string => `<html><head>${bloecke.map((b) => `<script type="application/ld+json" class="x">${b}</script>`).join('\n')}</head></html>`
const graph = (sektion: string): string => `{"@context":"https:\\/\\/schema.org","@graph":[{"@type":"WebPage"},{"@type":"Article","headline":"H","articleSection":${sektion}}]}`
pruefe('Rubrik: Liste im @graph', rubrikenAusHtml(seite(graph('["Crunchyroll"]'))).join('|') === 'Crunchyroll')
pruefe('Rubrik: zwei Einträge', rubrikenAusHtml(seite(graph('["ADN","Crunchyroll"]'))).join('|') === 'ADN|Crunchyroll')
pruefe('Rubrik: Objekt statt Liste ({"1":"Netflix"}, Artikel 1062641)', rubrikenAusHtml(seite(graph('{"1":"Netflix"}'))).join('|') === 'Netflix')
pruefe('Rubrik: Zeichenkette', rubrikenAusHtml(seite(graph('"Disney+"'))).join('|') === 'Disney+')
pruefe('Rubrik: Entität aufgelöst', rubrikenAusHtml(seite(graph('["DVD &amp; Blu-ray"]'))).join('|') === 'DVD & Blu-ray')
pruefe('Rubrik: Artikel ohne articleSection', rubrikenAusHtml(seite('{"@graph":[{"@type":"Article"}]}')).length === 0)
pruefe('Rubrik: kein Artikelknoten', rubrikenAusHtml(seite('{"@graph":[{"@type":"WebPage","articleSection":["Netflix"]}]}')).length === 0)
pruefe('Rubrik: Artikel ohne @graph', rubrikenAusHtml(seite('{"@type":"Article","articleSection":["Netflix"]}')).join('|') === 'Netflix')
pruefe('Rubrik: NewsArticle', rubrikenAusHtml(seite('{"@type":"NewsArticle","articleSection":["Netflix"]}')).join('|') === 'Netflix')
pruefe('Rubrik: kaputter Block, dahinter ein guter', rubrikenAusHtml(seite('{ kaputt', graph('["Netflix"]'))).join('|') === 'Netflix')
pruefe('Rubrik: kein JSON-LD', rubrikenAusHtml('<html></html>').length === 0)
pruefe('Rubrik: nur Zeichenketten und ohne Leerraum', rubrikenAusHtml(seite(graph('[" Netflix ", 3, null, ""]'))).join('|') === 'Netflix')

/* Der Schritt gegen Wegwerf-Ordner. */
const tmp = mkdtempSync(join(tmpdir(), 'a2y-router-'))
const schreibe = (pfad: string, inhalt: string): string => {
  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, inhalt, 'utf8')
  return pfad
}
const kandidat = (f: Fall) => ({ id: f.id, url: `https://www.anime2you.de/news/${f.id}/`, titel: f.text.split('\n')[0]!, veroeffentlicht: f.text.split('\n')[1]!.replace('Veröffentlicht: ', ''), rubriken: f.rubriken })
function ordnerAnlegen(name: string): string {
  const o = join(tmp, name)
  schreibe(join(o, 'auswahl.json'), JSON.stringify({ kandidaten: faelle.map(kandidat), uebersprungen: [{ id: '9', titel: 'Figur', grund: 'kein Deutschland-Bezug' }] }, null, 2))
  mkdirSync(join(o, 'ergebnis'), { recursive: true })
  for (const f of faelle) schreibe(join(o, 'artikel', `${f.id}.txt`), f.text)
  return o
}
const lies = (p: string): string => readFileSync(p, 'utf8')
try {
  const sch = ordnerAnlegen('schatten')
  const vorher = lies(join(sch, 'auswahl.json'))
  const rs = routerSchritt(sch, false)
  pruefe('Schatten: Zeile', JSON.stringify(rs.zeile) === JSON.stringify({ scharf: false, artikel: 16, erspart: 4, stichprobe: 2, rest: 10 }), rs.zeile)
  pruefe('Schatten: Claude liest alle 16', rs.claude === 16)
  pruefe('Schatten: auswahl.json byte-gleich, keine Antwortdatei', lies(join(sch, 'auswahl.json')) === vorher && readdirSync(join(sch, 'ergebnis')).length === 0)
  const proto = JSON.parse(lies(join(sch, 'router.json'))) as { zeile: unknown; entscheidungen: { id: string; weg: string; grund?: string }[] }
  pruefe('Schatten: router.json hält Zeile und 16 Entscheidungen mit Grund', proto.entscheidungen.length === 16 && proto.entscheidungen.find((e) => e.id === '1058839')?.grund === 'Rubrik Merchandise' && proto.entscheidungen.find((e) => e.id === '1064193')?.weg === 'regel', proto)
  pruefe('leseRouterZeile liest sie', leseRouterZeile(sch)?.erspart === 4 && leseRouterZeile(join(tmp, 'gibt-es-nicht')) === undefined)

  const sc = ordnerAnlegen('scharf')
  const rc = routerSchritt(sc, true)
  pruefe('Scharf: Zeile scharf, Claude liest 12', rc.zeile.scharf === true && rc.claude === 12 && rc.zeile.erspart === 4, rc)
  pruefe('Scharf: Antwortdateien genau für die vier ersparten', readdirSync(join(sc, 'ergebnis')).sort().join() === '1060946.json,1064193.json,1065119.json,1066144.json')
  const antwort = JSON.parse(lies(join(sc, 'ergebnis', '1064193.json'))) as { gelesen: boolean; vorschlaege: { titel: string }[] }
  pruefe('Scharf: Antwortdatei hat gelesen und die Vorschläge', antwort.gelesen === true && antwort.vorschlaege.map((x) => x.titel).join() === 'Aoashi,PSYREN', antwort)
  const au = JSON.parse(lies(join(sc, 'auswahl.json'))) as { kandidaten: { id: string }[]; regel: { id: string; titel: string; rubriken: string[] }[]; uebersprungen: unknown[] }
  pruefe('Scharf: kandidaten ohne die vier, Reihenfolge erhalten', au.kandidaten.length === 12 && au.kandidaten[0]!.id === '1063615' && !au.kandidaten.some((k) => ['1064193', '1065119', '1066144', '1060946'].includes(k.id)), au.kandidaten.map((k) => k.id))
  pruefe('Scharf: Stichprobe 1063615 und 1066100 bleiben bei Claude', ['1063615', '1066100'].every((i) => au.kandidaten.some((k) => k.id === i)))
  pruefe('Scharf: regel = die vier, voll mit Titel und Rubriken; uebersprungen erhalten', au.regel.map((k) => k.id).join() === '1064193,1065119,1066144,1060946' && au.regel[0]!.titel.length > 5 && au.regel[0]!.rubriken[0] === 'Crunchyroll' && au.uebersprungen.length === 1, au)

  // Rückbau: die zweite Antwortdatei lässt sich nicht schreiben (Verzeichnis im Weg) → die erste wird entfernt, auswahl.json bleibt.
  const rb = ordnerAnlegen('rueckbau')
  mkdirSync(join(rb, 'ergebnis', '1065119.json'), { recursive: true })
  const rbVorher = lies(join(rb, 'auswahl.json'))
  let geworfen = false
  try {
    routerSchritt(rb, true)
  } catch {
    geworfen = true
  }
  pruefe('Rückbau: wirft, auswahl.json unverändert, erste Antwortdatei entfernt', geworfen && lies(join(rb, 'auswahl.json')) === rbVorher && !existsSync(join(rb, 'ergebnis', '1064193.json')))

  /* Übernahme: `--uebernehmen` liest die Regel-Antworten wie Claudes und vermerkt `durch: regel`. */
  const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
  const starte = (skript: string, ak: string, env: Record<string, string>, ...args: string[]) => {
    const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline', skript), ...args], { cwd: ak, env: { ...process.env, AK_ROOT: ak, LAUF_TOKEN: '', GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '', ROUTER_SCHARF: '', ...env }, encoding: 'utf8', timeout: 120_000, windowsHide: true })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  }
  // Claude hat nur die beiden Stichprobe-Artikel beantwortet (leere Liste); die übrigen zehn Rest-Artikel sind in diesem Probelauf ungelesen.
  for (const id of ['1063615', '1066100']) schreibe(join(sc, 'ergebnis', `${id}.json`), JSON.stringify({ gelesen: true, vorschlaege: [] }))
  const akU = join(tmp, 'wurzel-uebernehmen')
  mkdirSync(akU, { recursive: true })
  const uebernahme = starte('anime2you-extraktion.ts', akU, {}, '--uebernehmen', '--verzeichnis', sc)
  // Der Bestand heißt nach der Extraktion; der Name wird gesucht, nicht als Pfad geschrieben (Bot-Pfade-Wächter, `pr-nachrechnen-bot-pfade`).
  const vorschlagDir = join(akU, 'data', 'proposals')
  const bestand = JSON.parse(lies(join(vorschlagDir, readdirSync(vorschlagDir).find((n) => n.startsWith('anime2you-extraktion'))!))) as Bestand
  const durch = (id: string) => bestand.gelesen[id]?.durch
  pruefe('Übernahme: Exit 0', uebernahme.status === 0, uebernahme.aus.slice(-400))
  pruefe('Übernahme: die vier Regel-Artikel sind gelesen, durch regel', ['1064193', '1065119', '1066144', '1060946'].every((i) => durch(i) === 'regel'), bestand.gelesen)
  const regelVorschlaege = bestand.vorschlaege.filter((v) => ['1064193', '1065119', '1066144', '1060946'].includes(v.artikelId))
  pruefe('Übernahme: 8 geprüfte Vorschläge der Regel (2+2+2+2), Art sprachfassung, Quelle gesetzt', regelVorschlaege.length === 8 && regelVorschlaege.every((v) => v.art === 'sprachfassung' && v.quelle === `https://www.anime2you.de/news/${v.artikelId}/`), regelVorschlaege.length)
  pruefe('Übernahme: Claudes Stichprobe-Artikel tragen kein „durch“', durch('1063615') === undefined && bestand.gelesen['1063615']?.vorschlaege === 0 && durch('1066100') === undefined && bestand.gelesen['1066100']?.vorschlaege === 0)
  pruefe('Übernahme: Stichprobe-Artikel ohne Antwortdatei wären ungelesen, nicht „regel“', durch('1058839') === undefined && bestand.gelesen['1058839'] === undefined)

  /* Schattenzeile und Bilanz. */
  const speicher = { laeufe: [] as Lauf[] }
  schattenSchritt(sch, { lies: () => speicher, schreibe: (b) => { speicher.laeufe = b.laeufe } }, '2026-11-07', () => 0, () => undefined)
  pruefe('Schattenschritt übernimmt die Routerzeile', JSON.stringify(speicher.laeufe[0]?.router) === JSON.stringify({ scharf: false, artikel: 16, erspart: 4, stichprobe: 2, rest: 10 }), speicher.laeufe[0])
  const speicher2 = { laeufe: [] as Lauf[] }
  schattenSchritt(join(tmp, 'ohne-router'), { lies: () => speicher2, schreibe: (b) => { speicher2.laeufe = b.laeufe } }, '2026-11-07', () => 0, () => undefined)
  pruefe('Schattenschritt ohne router.json: kein router-Feld', speicher2.laeufe.length === 1 && !('router' in speicher2.laeufe[0]!), speicher2.laeufe[0])
  const zeile = (am: string, router?: Lauf['router']): Lauf => ({ am, artikel: 0, ohneAntwort: 0, schattenFehler: 0, gleich: 0, nurRegel: 0, nurClaude: 0, ms: 0, faelle: [], ...(router ? { router } : {}) })
  const b2 = bilanz({ laeufe: [zeile('2026-11-01', { scharf: false, artikel: 10, erspart: 1, stichprobe: 1, rest: 8 }), zeile('2026-11-02', { scharf: true, artikel: 7, erspart: 2, stichprobe: 0, rest: 5 }), zeile('2026-11-03')] })
  pruefe('Bilanz: Router-Summen (17 Artikel, 3 erspart; Lauf ohne Router zählt 0)', b2.routerArtikel === 17 && b2.routerErspart === 3, b2)

  /* Die Skripte als eigener Prozess. */
  const akP = join(tmp, 'wurzel-p')
  mkdirSync(akP, { recursive: true })
  const bilanzDatei = schreibe(join(tmp, 'bilanz.json'), JSON.stringify({ laeufe: [zeile('2026-11-01', { scharf: false, artikel: 10, erspart: 1, stichprobe: 1, rest: 8 }), zeile('2026-11-02', { scharf: true, artikel: 7, erspart: 2, stichprobe: 0, rest: 5 })] }))
  const auswertung = starte('anime2you-schatten-auswerten.ts', akP, {}, bilanzDatei)
  pruefe('Auswertung nennt die Router-Summe (3 von 17)', auswertung.aus.includes('Router: 3 von 17 Artikeln'), auswertung)
  const ausgabe = join(tmp, 'github-output.txt')
  const schattenLauf = starte('anime2you-router.ts', akP, { GITHUB_OUTPUT: ausgabe }, '--verzeichnis', ordnerAnlegen('p-schatten'))
  pruefe('Prozess Schatten: Exit 0, Zeile, claude=16', schattenLauf.status === 0 && schattenLauf.aus.includes('Router (Schatten): 16 Artikel') && lies(ausgabe) === 'claude=16\n', schattenLauf)
  const pScharf = ordnerAnlegen('p-scharf')
  writeFileSync(ausgabe, '', 'utf8')
  const scharfLauf = starte('anime2you-router.ts', akP, { GITHUB_OUTPUT: ausgabe, ROUTER_SCHARF: 'ja' }, '--verzeichnis', pScharf)
  pruefe('Prozess scharf (ROUTER_SCHARF=ja): Exit 0, Zeile, claude=12, vier Antwortdateien', scharfLauf.status === 0 && scharfLauf.aus.includes('Router (scharf): 16 Artikel') && lies(ausgabe) === 'claude=12\n' && readdirSync(join(pScharf, 'ergebnis')).length === 4, scharfLauf)
  for (const wert of ['nein', 'JA', 'true', '1', ' ja']) {
    const o = ordnerAnlegen(`p-${wert.trim() || 'leer'}-${wert.length}`)
    const l = starte('anime2you-router.ts', akP, { ROUTER_SCHARF: wert }, '--verzeichnis', o)
    pruefe(`Prozess: ROUTER_SCHARF=„${wert}“ bleibt Schatten`, l.status === 0 && l.aus.includes('Router (Schatten)') && readdirSync(join(o, 'ergebnis')).length === 0, l)
  }
  writeFileSync(ausgabe, '', 'utf8')
  const ohneOrdner = starte('anime2you-router.ts', akP, { GITHUB_OUTPUT: ausgabe }, '--verzeichnis', join(tmp, 'gibt-es-nicht'))
  pruefe('Prozess: Ordner fehlt → Exit 0, Ausfall im Log und als Abbruch, kein claude=', ohneOrdner.status === 0 && ohneOrdner.aus.includes('Router: Ausfall') && ohneOrdner.aus.includes('Abbruch (anime2you-router)') && lies(ausgabe) === '', ohneOrdner)
  const ohneArg = starte('anime2you-router.ts', akP, { GITHUB_OUTPUT: ausgabe })
  pruefe('Prozess: ohne Argument → Exit 0 und Aufrufhinweis', ohneArg.status === 0 && ohneArg.aus.includes('Aufruf: anime2you-router.ts --verzeichnis') && lies(ausgabe) === '', ohneArg)

  /* `--auswahl` legt die Rubriken der Seite in `auswahl.json` (Attrappe: Feed mit einem Artikel, Rubrik als Objekt {"1":"Crunchyroll"}). */
  const akA = join(tmp, 'wurzel-auswahl')
  mkdirSync(akA, { recursive: true })
  const mock = pathToFileURL(join(wurzel, 'tools/anime2you-auswahl-mock.mjs')).href
  const auswahlLauf = starte('anime2you-extraktion.ts', akA, { NODE_OPTIONS: `--import ${mock}` }, '--auswahl', '--verzeichnis', join(tmp, 'a2y-auswahl'))
  const auswahlDatei = join(tmp, 'a2y-auswahl', 'auswahl.json')
  const gewaehlt = existsSync(auswahlDatei) ? (JSON.parse(lies(auswahlDatei)) as { kandidaten: { id: string; rubriken?: string[] }[] }).kandidaten : []
  pruefe('--auswahl: Exit 0, ein Artikel mit der Rubrik der Seite', auswahlLauf.status === 0 && gewaehlt.length === 1 && gewaehlt[0]!.id === '1063615' && gewaehlt[0]!.rubriken?.join() === 'Crunchyroll', auswahlLauf.aus.slice(-400))

  /* Verdrahtung im Workflow. */
  const wf = parse(lies(join(wurzel, '.github/workflows/claude-anime2you-extraktion.yml'))) as { jobs: { lesen: { steps: Schritt[] } } }
  const schritte = wf.jobs.lesen.steps
  const nr = (f: (s: Schritt) => boolean): number => schritte.findIndex(f)
  const iAuswahl = nr((s) => s.id === 'auswahl')
  const iRouter = nr((s) => s.id === 'router')
  const iClaude = nr((s) => String(s.uses ?? '').startsWith('anthropics/claude-code-action'))
  const iUebernahme = nr((s) => String(s.run ?? '').includes('--uebernehmen'))
  const router = schritte[iRouter]
  pruefe('Workflow: Router nach der Auswahl und vor Claude', iAuswahl >= 0 && iRouter > iAuswahl && iRouter < iClaude && iClaude < iUebernahme, [iAuswahl, iRouter, iClaude, iUebernahme])
  pruefe('Workflow: Router darf scheitern, Frist bis 5 min, läuft nur bei Artikeln', router?.['continue-on-error'] === true && Number(router['timeout-minutes']) > 0 && Number(router['timeout-minutes']) <= 5 && router.if === schritte[iUebernahme]!.if, router)
  pruefe('Workflow: Schalter nur aus der Repository-Variable (ohne Variable aus), LAUF_TOKEN für den Vorfall', JSON.stringify(router?.env) === JSON.stringify({ LAUF_TOKEN: '${{ secrets.LAUF_TOKEN }}', ROUTER_SCHARF: '${{ vars.ANIME2YOU_ROUTER_SCHARF }}' }), router?.env)
  pruefe('Workflow: Claude läuft nur bei Artikeln und wenn der Router nicht „0“ meldet', schritte[iClaude]?.if === "steps.auswahl.outputs.anzahl != '0' && steps.router.outputs.claude != '0'", schritte[iClaude]?.if)
  const wortlaut = String(router?.run ?? '').trim().split(/\s+/)
  pruefe('Workflow: Aufruf mit dem Arbeitsordner des Laufs', wortlaut.join(' ') === 'npx tsx pipeline/anime2you-router.ts --verzeichnis "$ARBEITSORDNER"', wortlaut)
  writeFileSync(ausgabe, '', 'utf8')
  const ausWf = starte(wortlaut[2]!.replace('pipeline/', ''), akP, { GITHUB_OUTPUT: ausgabe }, wortlaut[3]!, ordnerAnlegen('p-wf'))
  pruefe('Workflow: der Aufruf aus der YAML läuft durch (Schatten, claude=16)', ausWf.status === 0 && lies(ausgabe) === 'claude=16\n', ausWf)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (fehler) {
  console.error(`✖ ${fehler} Fehler`)
  process.exit(1)
}
console.log(`✓ Anime2You-Router: ${faelle.length} echte Artikel (6 erklärt, 4 erspart, 2 Stichprobe, 10 Rest; Fehlbelege gegen Claude 0), Bedingungen einzeln, Rubrik-Leser, Schritt Schatten/scharf/Rückbau, Übernahme, Schattenzeile, Prozesse, Workflow`)
