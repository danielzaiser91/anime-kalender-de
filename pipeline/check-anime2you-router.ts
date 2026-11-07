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
import { zusammenfassung } from './lib/anime2you-bericht.ts'
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
  claude: { titel: string; art: string; plattform: string; sprache: string }[]
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
const echt = JSON.parse(readFileSync(join(wurzel, 'tools/anime2you-router-faelle.json'), 'utf8')) as Fall[]
/** Diese fünf echten Artikel erklärte die erste Fassung des Routers; sie tragen `Simulcast:` mit Uhrzeit bzw. `Hinweis:`, die die Regel nicht liest (A1/A2) und gehen heute an Claude. */
const FRUEHER_ERKLAERT = ['1063615', '1064193', '1065119', '1066100', '1060946']
const ohneUngelesenes = (text: string): string => text.replace(/^[ \t]*(Simulcast|Hinweis):.*\n/gm, '')
/** Die Testmenge für Schritt, Plan und Übernahme: die fünf ohne ihre ungelesenen Zeilen (Weg `regel` wie zuvor), die übrigen echt. */
const faelle = echt.map((f) => (FRUEHER_ERKLAERT.includes(f.id) ? { ...f, text: ohneUngelesenes(f.text) } : f))
const fall = (id: string): Fall => faelle.find((f) => f.id === id)!
const art = (f: Fall, rubriken = f.rubriken, text = f.text) => ({ id: f.id, text, rubriken })

/** Claude-Vorschläge zu den sechs Regel-Artikeln, die kein Regel-Gegenstück gleicher Art haben (`art/Titel/Plattform`). 1064193 und 1060946: `start`, die Claude aus `Simulcast:`/`Hinweis:` las (im echten Text). */
const CLAUDE_REST: Record<string, string[]> = {
  '1063615': [],
  '1064193': ['start/Aoashi – Staffel 2/crunchyroll', 'start/Aoashi – Staffel 2/primevideo', 'start/PSYREN/crunchyroll', 'start/PSYREN/primevideo'],
  '1065119': [],
  '1066100': [],
  '1066144': ['start/Der Held ohne Klasse: Der Aufstieg eines Talentlosen/netflix', 'folgen/My Happy Marriage/netflix'],
  '1060946': ['start/Avatar: Die sieben Häfen/primevideo', 'start/Yoyo & Nene – Die magischen Schwestern/primevideo'],
}

/** Behauptungen der Regel (Titel), zu denen Claude nur eine andere Art als `sprachfassung` schrieb (`start`/`folgen`: Claude las dort Simulcast, Hinweis oder Episoden mit). */
const SPRACHFASSUNG_FEHLT: Record<string, string[]> = {
  '1063615': [],
  '1064193': ['Aoashi', 'PSYREN'],
  '1065119': [],
  '1066100': [],
  '1066144': ['Der Held ohne Klasse: Der Aufstieg eines Talentlosen', 'My Happy Marriage'],
  '1060946': ['Avatar: Die sieben Häfen', 'Yoyo & Nene – Die magischen Schwestern'],
}

/* Echte Artikel: Weg, Grund, Behauptungen. */
for (const f of faelle) {
  const e = entscheide(art(f))
  pruefe(`${f.id} (${f.name}): Weg ${f.weg}`, e.weg === f.weg, e.grund)
  if (f.weg === 'claude') pruefe(`${f.id}: Grund „${f.grund}“`, e.grund === f.grund && e.vorschlaege === undefined, e)
  else {
    const v = e.vorschlaege ?? []
    pruefe(`${f.id}: Titel der Behauptungen`, v.map((x) => x.titel).join('|') === f.titel!.join('|'), v.map((x) => x.titel))
    pruefe(`${f.id}: Plattform ${f.plattform} und Art sprachfassung bei allen`, v.every((x) => x.plattform === f.plattform && x.art === 'sprachfassung'), v)
    // Fehlbeleg = Regel behauptet deutsch, Claude hat zu Titel und Plattform (gleich welcher Art) keinen deutschen Vorschlag.
    const gleichTitel = (c: Fall['claude'][number], x: Record<string, unknown>): boolean => c.plattform === x.plattform && c.titel.toLowerCase().startsWith(String(x.titel).toLowerCase())
    const gleich = (c: Fall['claude'][number], x: Record<string, unknown>): boolean => gleichTitel(c, x) && c.art === x.art
    const fehlbelege = v.filter((x) => !f.claude.some((c) => gleichTitel(c, x) && c.sprache.startsWith('deutsch')))
    pruefe(`${f.id}: Fehlbelege gegen Claude (Titel, Plattform) = 0`, fehlbelege.length === 0, fehlbelege)
    // A3: die Art zählt mit. Behauptungen der Regel (sprachfassung), zu denen Claude keine sprachfassung gleichen Titels geschrieben hat, stehen fest je Artikel.
    const ohneGleicheArt = v.filter((x) => !f.claude.some((c) => gleich(c, x))).map((x) => String(x.titel))
    pruefe(`${f.id}: Regel-Behauptungen ohne Claude-sprachfassung: ${SPRACHFASSUNG_FEHLT[f.id]!.length}`, ohneGleicheArt.join('|') === SPRACHFASSUNG_FEHLT[f.id]!.join('|'), ohneGleicheArt)
    // Claude-Vorschläge ohne Regel-Gegenstück (auch anderer Art): fester Soll je Artikel, gemessen an Claudes Rohantwort.
    const rest = f.claude.filter((c) => !v.some((x) => gleich(c, x)))
    pruefe(`${f.id}: Claude-Rest ${CLAUDE_REST[f.id]!.length}`, rest.map((c) => `${c.art}/${c.titel}/${c.plattform}`).join('|') === CLAUDE_REST[f.id]!.join('|'), rest)
  }
}

/* Plan über alle 16: erspart, Stichprobe (Kennung durch 5 teilbar), Rest. */
const plan = plane(faelle.map((f) => art(f)))
pruefe('Plan: erspart', plan.erspart.join() === '1064193,1065119,1066144,1060946', plan.erspart)
pruefe('Plan: Stichprobe', plan.stichprobe.join() === '1063615,1066100', plan.stichprobe)
pruefe('Plan: Rest = 10 Artikel', plan.rest.length === 10 && plan.entscheidungen.length === 16, plan.rest)

/* Die echten Texte der fünf (A1/A2): unlesbare Zeilen schicken sie zu Claude, nur 1066144 (Netflix, ohne Simulcast/Hinweis) bleibt erklärt. */
const GRUND_ECHT: Record<string, string> = {
  '1063615': 'Datum oder Uhrzeit außerhalb der Regel: 15:30 Uhr',
  '1064193': 'Datum oder Uhrzeit außerhalb der Regel: 11:00 Uhr',
  '1065119': 'Datum oder Uhrzeit außerhalb der Regel: 17:15 Uhr',
  '1066100': 'Datum oder Uhrzeit außerhalb der Regel: 18:00 Uhr',
  '1060946': 'Feld ohne Regel: Hinweis',
}
for (const f of echt) {
  if (!(f.id in GRUND_ECHT)) continue
  const e = entscheide(art(f))
  pruefe(`${f.id} echter Text: Claude, „${GRUND_ECHT[f.id]}“`, e.weg === 'claude' && e.grund === GRUND_ECHT[f.id], e)
}
pruefe('1066144 echter Text: weiter erklärt', entscheide(art(echt.find((f) => f.id === '1066144')!)).weg === 'regel')
const planEcht = plane(echt.map((f) => art(f)))
pruefe('Plan mit echten Texten: erspart nur 1066144, keine Stichprobe, Rest 15', planEcht.erspart.join() === '1066144' && planEcht.stichprobe.length === 0 && planEcht.rest.length === 15, planEcht)

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
/* A1: Felder ohne Regel (je Feld ein Fall, Feld im ersten und im letzten Block, Feld ohne Datum). */
const nachSprache = (zeile: string, letzter = false): string => {
  const zeilen = ok.text.split('\n')
  const idx = letzter ? zeilen.map((z) => z.trim().startsWith('Sprache:')).lastIndexOf(true) : zeilen.findIndex((z) => z.trim().startsWith('Sprache:'))
  zeilen.splice(idx + 1, 0, ` ${zeile}`)
  return zeilen.join('\n')
}
pruefe('A1 Fall bereit: Sprache-Zeile gefunden', nachSprache('X').length === ok.text.length + 3 && nachSprache('X', true) !== nachSprache('X'))
for (const [feld, zeile] of [['Start', 'Start: 12. Dezember 2026 um 15:30 Uhr'], ['Start', 'Start: bald'], ['Hinweis', 'Hinweis: Die Episoden 2 und 3 sind im Paramount+-Channel verfügbar.']] as const) {
  pruefe(`A1 ${zeile.slice(0, 30)}… im ersten Block: Claude, Feld ${feld}`, mit(nachSprache(zeile)).grund === `Feld ohne Regel: ${feld}`, mit(nachSprache(zeile)))
  pruefe(`A1 ${zeile.slice(0, 30)}… im letzten Block: Claude, Feld ${feld}`, mit(nachSprache(zeile, true)).grund === `Feld ohne Regel: ${feld}`, mit(nachSprache(zeile, true)))
}
pruefe('A1 Feld Laufzeit bleibt erlaubt (Regel braucht es nicht, es trägt keine Aussage)', mit(nachSprache('Laufzeit: 24 Minuten')).weg === 'regel')
/* A2: Datum oder Uhrzeit außerhalb der gelesenen Stellen – unabhängig von der Anführung. */
const satzFall = (satz: string): string => `${ok.text}\n${satz}\n`
for (const [name, satz, treffer] of [
  ['typografische Anführung', 'Außerdem startet „Foo Bar“ am 5. Dezember 2026 um 18:00 Uhr auf Crunchyroll mit deutscher Synchro.', '5. Dezember'],
  ['gerade Anführung', 'Außerdem startet "Foo Bar" am 5. Dezember 2026 um 18:00 Uhr auf Crunchyroll mit deutscher Synchro.', '5. Dezember'],
  ['ohne Anführung', 'Außerdem startet Foo Bar am 5. Dezember 2026 um 18:00 Uhr auf Crunchyroll mit deutscher Synchro.', '5. Dezember'],
  ['Spitzklammer-Anführung ohne Behauptung', 'Außerdem startet »Foo Bar« am 5. Dezember 2026 auf Crunchyroll.', null],
  ['nur Uhrzeit mit Uhr', 'Foo Bar läuft um 18:00 Uhr.', '18:00 Uhr'],
  ['nur Uhrzeit mit Doppelpunkt', 'Foo Bar läuft ab 18:30.', '18:30'],
  ['volle Stunde', 'Foo Bar läuft um 18 Uhr.', '18 Uhr'],
  ['Zahlendatum', 'Foo Bar startet am 05.12. auf Crunchyroll.', '05.12.'],
  ['ISO-Datum', 'Foo Bar startet 2026-12-05 auf Crunchyroll.', '2026-12-05'],
  ['Monatsmitte', 'Foo Bar startet Mitte Dezember auf Crunchyroll.', 'Mitte Dezember'],
  ['Monatsende klein geschrieben', 'Foo Bar startet ende dezember auf Crunchyroll.', 'ende dezember'],
  ['Tag und Monat klein geschrieben', 'Foo Bar startet am 5. dezember auf Crunchyroll.', '5. dezember'],
  ['Uhrzeit mit Punkt', 'Foo Bar läuft um 18.30 Uhr.', '18.30 Uhr'],
] as const) {
  const e = mit(satzFall(satz))
  pruefe(`A2 ${name}: ${treffer ? `Claude, „${treffer}“` : 'Claude (Titel ohne Behauptung)'}`, e.weg === 'claude' && (treffer === null ? e.grund === 'Titel ohne Behauptung: Foo Bar' : e.grund === `Datum oder Uhrzeit außerhalb der Regel: ${treffer}`), e)
}
pruefe('A2 Tag ohne Leerzeichen vor dem Monat („5.Dezember“): Claude', mit(satzFall('Foo Bar startet am 5.Dezember.')).grund === 'Datum oder Uhrzeit außerhalb der Regel: 5.Dezember')
const zeilenVon = ok.text.split('\n')
const ersteTextzeile = [...zeilenVon.slice(0, 3), 'Am 5. Dezember geht es los.', ...zeilenVon.slice(3)].join('\n')
pruefe('A2 erste Textzeile nach der Veröffentlicht-Zeile ist gelesen: Claude', mit(ersteTextzeile).grund === 'Datum oder Uhrzeit außerhalb der Regel: 5. Dezember', mit(ersteTextzeile))
const autorAlsSatz = (zeile: string): string => ok.text.replace(' 24. Oktober 2026 um 17:54 Uhr ', zeile)
pruefe('A2 Fall bereit: Autorenzeile ersetzt', autorAlsSatz('X') !== ok.text)
pruefe('A2 Autorenzeile mit Text davor ist keine Autorenzeile: Claude', mit(autorAlsSatz(' Foo startet am 24. Oktober 2026 um 17:54 Uhr ')).grund === 'Datum oder Uhrzeit außerhalb der Regel: 24. Oktober')
pruefe('A2 Autorenzeile mit Text dahinter ist keine Autorenzeile: Claude', mit(autorAlsSatz(' 24. Oktober 2026 um 17:54 Uhr und mehr ')).grund === 'Datum oder Uhrzeit außerhalb der Regel: 24. Oktober')
pruefe('A2 Autorenzeile mit Tag vor Monat falsch (anderer Monat): Claude', mit(autorAlsSatz(' 24. November 2026 um 17:54 Uhr ')).grund === 'Datum oder Uhrzeit außerhalb der Regel: 24. November')
const zweiBloecke = 'Neue Titel auf Crunchyroll\nVeröffentlicht: 2026-10-24\n\n2. November: »Foo Bar«\nSprache: Deutsch, Japanisch (UT)\nStream: Crunchyroll\n\n3. November: »Baz Qux«\nSprache: Deutsch, Japanisch (UT)\nStream: Crunchyroll\n'
pruefe('A2 zwei Blöcke, beide mit Tag vor dem Titel: erklärt', entscheide({ id: '1', rubriken: ['Crunchyroll'], text: zweiBloecke }).weg === 'regel', entscheide({ id: '1', rubriken: ['Crunchyroll'], text: zweiBloecke }))
pruefe('A2 zweiter Block mit Datum hinter dem Titel, erster ohne: Claude', entscheide({ id: '1', rubriken: ['Crunchyroll'], text: zweiBloecke.replace('»Baz Qux«', '»Baz Qux« ab 7. Dezember') }).grund === 'Datum oder Uhrzeit außerhalb der Regel: 7. Dezember')
pruefe('A2 erster Block mit Datum hinter dem Titel, zweiter ohne: Claude', entscheide({ id: '1', rubriken: ['Crunchyroll'], text: zweiBloecke.replace('»Foo Bar«', '»Foo Bar« ab 7. Dezember') }).grund === 'Datum oder Uhrzeit außerhalb der Regel: 7. Dezember')
pruefe('A1 „Start:“ mitten im Titel ist kein Feld: erklärt', entscheide({ id: '1', rubriken: ['Crunchyroll'], text: 'Neuer Titel auf Crunchyroll\nVeröffentlicht: 2026-10-24\n\n»Quick Start: Foo Bar«\nSprache: Deutsch, Japanisch (UT)\nStream: Crunchyroll\n' }).weg === 'regel')
pruefe('A2 Satz ohne Datum und Uhrzeit: erklärt', mit(satzFall('Foo Bar kommt bald auf Crunchyroll.')).weg === 'regel')
pruefe('A2 Zahlen ohne Datum („Staffel 2.“, „1.5 Mio“): erklärt', mit(satzFall('Die Serie hat 2. Staffel Folgen und 1.5 Mio Fans.')).weg === 'regel')
pruefe('A2 Autorenzeile mit anderem Tag als Veröffentlicht: Claude', mit(ok.text.replace('24. Oktober 2026 um', '25. Oktober 2026 um')).grund === 'Datum oder Uhrzeit außerhalb der Regel: 25. Oktober', mit(ok.text.replace('24. Oktober 2026 um', '25. Oktober 2026 um')))
pruefe('A2 zweite Zeile mit der Zeit des Veröffentlichungstags: Claude (nur die Autorenzeile ist Vorspann)', mit(satzFall('24. Oktober 2026 um 17:54 Uhr')).grund === 'Datum oder Uhrzeit außerhalb der Regel: 24. Oktober', mit(satzFall('24. Oktober 2026 um 17:54 Uhr')))
const kopfMit = (nachsatz: string): string => 'Neuer Titel auf Crunchyroll\nVeröffentlicht: 2026-10-24\n\n2. November: »Foo Bar«' + nachsatz + '\nSprache: Deutsch, Japanisch (UT)\nStream: Crunchyroll\n'
pruefe('A2 Kopfzeile: Tag vor dem Titel ist gelesen → erklärt', entscheide({ id: '1', rubriken: ['Crunchyroll'], text: kopfMit('') }).weg === 'regel')
pruefe('A2 Kopfzeile: Datum hinter dem Titel ist ungelesen → Claude', entscheide({ id: '1', rubriken: ['Crunchyroll'], text: kopfMit(' – ab 5. Dezember') }).grund === 'Datum oder Uhrzeit außerhalb der Regel: 5. Dezember')
pruefe('A2 Sprache-Zeile mit Uhrzeit ist ungelesen → Claude', entscheide({ id: '1', rubriken: ['Crunchyroll'], text: kopfMit('').replace('Japanisch (UT)', 'Japanisch (UT), 18:00 Uhr') }).grund === 'Datum oder Uhrzeit außerhalb der Regel: 18:00 Uhr')
pruefe('A2 Stream-Zeile mit Datum ist ungelesen → Claude', entscheide({ id: '1', rubriken: ['Crunchyroll'], text: kopfMit('').replace('Stream: Crunchyroll', 'Stream: Crunchyroll (ab 5. Dezember)') }).grund === 'Datum oder Uhrzeit außerhalb der Regel: 5. Dezember')
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
  // A4: die Zusammenfassung für den Daten-PR nennt die Kennungen der Regel-Artikel (Reihenfolge der Auswahl, `regel`).
  const md = lies(join(sc, 'zusammenfassung.md'))
  pruefe('Übernahme: Zusammenfassung nennt die vier Regel-Artikel', md.includes('Von der Regel gelesen, Claude hat sie nicht gelesen: 4 (1064193, 1065119, 1066144, 1060946).'), md.slice(0, 600))
  const ohneRegel = zusammenfassung({ neu: [], verworfen: [], ungelesen: [], uebersprungen: 0 }, '2026-11-07')
  const regelLeer = zusammenfassung({ neu: [], verworfen: [], ungelesen: [], uebersprungen: 0, regel: [] }, '2026-11-07')
  pruefe('Zusammenfassung ohne Regel-Artikel: keine Regel-Zeile (fehlend und leer)', !ohneRegel.includes('Von der Regel') && !regelLeer.includes('Von der Regel'), ohneRegel)
  // Eine Regel-Antwortdatei fehlt: der Artikel ist ungelesen und steht nicht unter „von der Regel gelesen“.
  const sc2 = ordnerAnlegen('scharf-ohne-datei')
  routerSchritt(sc2, true)
  rmSync(join(sc2, 'ergebnis', '1065119.json'))
  for (const id of ['1063615', '1066100']) schreibe(join(sc2, 'ergebnis', `${id}.json`), JSON.stringify({ gelesen: true, vorschlaege: [] }))
  const akU2 = join(tmp, 'wurzel-uebernehmen-2')
  mkdirSync(akU2, { recursive: true })
  const uebernahme2 = starte('anime2you-extraktion.ts', akU2, {}, '--uebernehmen', '--verzeichnis', sc2)
  const md2 = lies(join(sc2, 'zusammenfassung.md'))
  pruefe('Übernahme ohne eine Regel-Antwortdatei: Exit 0, Zeile nennt nur die drei gelesenen', uebernahme2.status === 0 && md2.includes('Von der Regel gelesen, Claude hat sie nicht gelesen: 3 (1064193, 1066144, 1060946).'), md2.slice(0, 600))
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
console.log(`✓ Anime2You-Router: ${faelle.length} echte Artikel (echte Texte: 1 erklärt = 1 erspart, 15 Rest; ohne Simulcast/Hinweis-Zeilen 6 erklärt, 4 erspart, 2 Stichprobe, 10 Rest; Fehlbelege gegen Claude 0, Art mitgemessen), A1 Felder ohne Regel, A2 Datum/Uhrzeit außerhalb, Zusammenfassung nennt Regel-Artikel, Bedingungen einzeln, Rubrik-Leser, Schritt Schatten/scharf/Rückbau, Übernahme, Schattenzeile, Prozesse, Workflow`)
