/**
 * Laufzeittest statt Quelltext-Zusicherung für `fetch-pruefungen.ts` (Muster 2472): Der Abholer läuft als Prozess gegen eine Attrappe
 * (`tools/meldung-staffel-mock.mjs`: Reihe aus Staffel 1, OVA und Staffel 2 unter einer Netflix-Adresse).
 * 1. Staffel 2 gemeldet (Auftrag nannte Staffel 1): der Beleg geht an „Staffelreihe 2“ — nicht an den Auftragstitel, nicht an die OVA
 *    an der Position 2 der Reihe (Staffelnummer über die Namen, nicht über `slice`; vier falsche Belege am 10.09.2026).
 * 2. Staffel 1 und 2 unter derselben Netflix-Adresse werden nicht in eine Staffel zusammengelegt (Quintuplets, 18.09.2026); eine Prime-Seite
 *    mit zwei Staffelnummern in einer Gruppe geht nicht in den Staffelblock.
 * 3. Ohne `--trocken` landet der Beleg über `haengeBelegeAn` in `data/dub-confirmed.yaml` der Wegwerf-Wurzel (`AK_ROOT`).
 * 4. Staffel 2 gemeldet, unser Titel trägt keine Zahl (Haikyu!! TO THE TOP, 22.09.2026): kennt `data/anbieter-staffeln.json` Netflix' Staffel 2,
 *    wird die Meldung über die Aufteilung verteilt und es gibt einen Beleg; ohne diese Auskunft bleibt sie liegen.
 * 5. 24 durchgezählte Meldungen mit Notiz je Folge: der Beleg der ersten Staffel (Folge 1–12) trägt die Notiz seiner letzten Meldung (Folge 12),
 *    nicht die der Gruppe (Haikyu!!, 22.09.2026: „gemessen: Folge 14 und 25“ stand auch am Titel mit den Rändern 1 und 13).
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/meldung-staffel-mock.mjs')).href
const fehler: string[] = []

function lauf(szenario: string, extra: string[], ak?: string, umgebung: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts'), ...extra], {
    cwd: wurzel,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    env: { ...process.env, LAUF_TOKEN: 'test', AK_SZENARIO: szenario, ...(ak ? { AK_ROOT: ak } : {}), ...umgebung },
  })
  if (r.status !== 0) fehler.push(`Lauf ${szenario} ${extra.join(' ')} endete mit ${r.status}: ${r.stderr.slice(-300)}`)
  return r
}
const belegTitel = (text: string) => text.split('\n').filter((z) => /^- anilistId: -?\d+$/.test(z)).map((z) => z.replace('- anilistId: ', ''))

const zwei = belegTitel(lauf('zwei', ['--trocken']).stdout)
if (zwei.join() !== '900003') fehler.push(`Staffel 2: Beleg für ${zwei.join(', ') || 'keinen'} statt nur 900003`)
const gemischt = belegTitel(lauf('gemischt', ['--trocken']).stdout)
if (gemischt.join() !== '900001,900003') fehler.push(`Staffel 1 und 2: Belege für ${gemischt.join(', ') || 'keinen'} statt 900001 und 900003`)

/* Eine Prime-Seite mit Meldungen zweier Staffeln: der Staffelblock verlangt EINE Staffelnummer und fasst die Gruppe nicht an. */
const primeGemischt = belegTitel(lauf('primegemischt', ['--trocken']).stdout)
if (primeGemischt.join() !== '900001') fehler.push(`Prime-Seite mit Staffel 1 und 2: Belege für ${primeGemischt.join(', ') || 'keinen'} statt nur 900001`)

/* Staffel 1 auf einer fremden Seite: der Beleg trägt die gelesene Seite, nicht die Bestandsadresse (Higurashi Kai, 02.11.2026). */
const fremdeUrls = lauf('fremdeseite', ['--trocken']).stdout.split('\n').filter((z) => z.startsWith('  url: '))
if (fremdeUrls.join() !== '  url: https://www.amazon.de/gp/video/detail/B0TESTFREMD') fehler.push(`Staffel 1 fremde Seite: ${fremdeUrls.join(' | ') || 'keine url-Zeile'}`)

/* Ein „weg", das nicht die ganze Adresse entwertet (jüngeres „dub" ohne Folge), schreibt kein Tonspur-Nein; ein „weg" für die ganze Seite bleibt `available: false`. */
const wegAlt = lauf('wegalt', ['--trocken']).stdout
/* Ist die letzte Meldung ein Teil-„weg", gilt das jüngste Urteil ohne „weg" nach Datum: dub vor Teil-weg bleibt dub, ohne Urteil entsteht keins (Vermerk). */
const wegNur = lauf('nurweg', ['--trocken']).stdout
if (belegTitel(wegAlt).length !== 3 || (wegAlt.match(/^  dub: true$/gm) ?? []).length !== 3 || /^  available: /m.test(wegAlt) || wegAlt.includes('gilt nicht für die ganze Adresse')) fehler.push(`dub vor Teil-weg: drei Belege mit dub true, ohne available und Vermerk erwartet: ${wegAlt.slice(0, 400)}`)
if (belegTitel(wegNur).length < 1 || /^  dub: /m.test(wegNur) || /^  available: /m.test(wegNur) || !wegNur.includes('gilt nicht für die ganze Adresse')) fehler.push(`Nur Teil-weg: Belege ohne dub-/available-Zeile mit Vermerk erwartet: ${wegNur.slice(0, 400)}`)
const keinDubWeg = lauf('keindubweg', ['--trocken']).stdout
if (belegTitel(keinDubWeg).length !== 3 || (keinDubWeg.match(/^  dub: false$/gm) ?? []).length !== 3 || keinDubWeg.includes('gilt nicht für die ganze Adresse')) fehler.push(`kein_dub vor Teil-weg: drei Belege mit dub false erwartet: ${keinDubWeg.slice(0, 400)}`)
const datumVorId = lauf('datumvorid', ['--trocken']).stdout
if (belegTitel(datumVorId).length !== 3 || (datumVorId.match(/^  dub: false$/gm) ?? []).length !== 3) fehler.push(`Datum gegen Reihenfolge: das jüngere Datum (kein_dub) gilt, drei Belege mit dub false erwartet: ${datumVorId.slice(0, 400)}`)
const datumVorId2 = lauf('datumvorid2', ['--trocken']).stdout
if (belegTitel(datumVorId2).length !== 3 || (datumVorId2.match(/^  dub: false$/gm) ?? []).length !== 3) fehler.push(`Datum gegen Reihenfolge, umgekehrt: das jüngere Datum (kein_dub) gilt, drei Belege mit dub false erwartet: ${datumVorId2.slice(0, 400)}`)
/* Ohne „weg" gilt die letzte Meldung, auch wenn eine frühere das jüngere Datum trägt. */
const letztesUrteil = lauf('letztesurteil', ['--trocken']).stdout
if (belegTitel(letztesUrteil).length !== 3 || (letztesUrteil.match(/^  dub: false$/gm) ?? []).length !== 3) fehler.push(`Ohne weg gilt die letzte Meldung (kein_dub), drei Belege mit dub false erwartet: ${letztesUrteil.slice(0, 400)}`)
const wegGanz = lauf('wegganz', ['--trocken']).stdout
if (belegTitel(wegGanz).length !== 3 || (wegGanz.match(/^  available: false$/gm) ?? []).length !== 3 || /^  dub: /m.test(wegGanz) || wegGanz.includes('gilt nicht für die ganze Adresse')) fehler.push(`Ganzes weg: drei Belege mit available false, ohne dub und Vermerk erwartet: ${wegGanz.slice(0, 400)}`)

if (!wegNur.includes('): Netflix-Seite: Staffeltest')) fehler.push(`Teil-weg: die Notiz der Meldung fehlt hinter dem Vermerk: ${wegAlt.slice(0, 400)}`)
/* Mit Folgenbefund schreibt der Folgen-Zweig sein Urteil und keinen Vermerk; ein „kein_dub" ohne Folge bleibt ein Nein. */
const wegFolge = lauf('wegfolge', ['--trocken']).stdout
if (!/^  dub: true$/m.test(wegFolge) || wegFolge.includes('gilt nicht für die ganze Adresse')) fehler.push(`Weg mit Folgenbefund: dub-Urteil ohne Vermerk erwartet: ${wegFolge.slice(0, 400)}`)
const keinDub = lauf('keindub', ['--trocken']).stdout
if ((keinDub.match(/^  dub: false$/gm) ?? []).length !== 3 || keinDub.includes('gilt nicht für die ganze Adresse')) fehler.push(`kein_dub ohne Folge: drei Belege mit dub false erwartet: ${keinDub.slice(0, 400)}`)

/* Wegwerf-Wurzel, optional mit Netflix' Aufteilung (zwei Staffeln) für die Adresse der Attrappe. */
function trockenIn(szenario: string, mitAufteilung: boolean) {
  const wurzelTmp = mkdtempSync(join(tmpdir(), 'fetch-pruefungen-trocken-'))
  try {
    for (const ordner of ['data/curated', 'public/data', 'extension', 'daniel-zum-abarbeiten']) mkdirSync(join(wurzelTmp, ordner), { recursive: true })
    for (const d of ['cartoons', 'ohne-synchro']) writeFileSync(join(wurzelTmp, 'public/data', `${d}.json`), '[]')
    if (mitAufteilung) {
      const staffeln = [1, 2].map((seq) => ({ seq, name: `Staffel ${seq}`, folgen: 12, erste: 1 }))
      writeFileSync(join(wurzelTmp, 'data/anbieter-staffeln.json'), JSON.stringify({ 81152346: { staffeln, gemeldetAm: '2026-09-22' } }))
    }
    return lauf(szenario, ['--trocken'], wurzelTmp).stdout
  } finally {
    rmSync(wurzelTmp, { recursive: true, force: true })
  }
}
const VERTEILT = "über Netflix' Staffelaufteilung verteilt"
const mitAuskunft = trockenIn('ohnezahl', true)
if (belegTitel(mitAuskunft).join() !== '900001' || !mitAuskunft.includes(VERTEILT) || !mitAuskunft.includes('Netflix-Seite: Staffeltest')) fehler.push(`Staffel 2 ohne Zahl im Namen, Aufteilung bekannt: kein Beleg über die Aufteilung: ${mitAuskunft.slice(0, 300)}`)
const ohneAuskunft = trockenIn('ohnezahl', false)
if (belegTitel(ohneAuskunft).length || ohneAuskunft.includes(VERTEILT)) fehler.push(`Staffel 2 ohne Zahl, Aufteilung unbekannt: Meldung muss liegenbleiben: ${ohneAuskunft.slice(0, 300)}`)
const notizen = trockenIn('notizen', false)
  .split('\n')
  .filter((z) => z.startsWith('  note: '))
if (notizen.length !== 1 || !notizen[0]!.includes('Randprobe Folge 12"')) fehler.push(`Notiz je Staffel: ${notizen.join(' | ')}`)

/*
  6. Staffelsumme (F100): Netflix führt nur Staffel 2 (12 Folgen), JustWatch nennt 28 Folgen davor, unser Cartoon hat 40. Passen die Folgentitel der
  Meldungen zur umgerechneten Stelle, entsteht der Beleg 29–40 mit dem Bestätigungsvermerk; sind sie um 5 verschoben (oder fehlt JustWatch), bleibt die
  Meldung liegen. Die Folgenliste liefert die Wegwerf-Wurzel (Cartoon-Folgen "Titel n").
*/
function summeIn(szenario: string, mitJustWatch: boolean, mitRtl = false): string {
  const wurzelTmp = mkdtempSync(join(tmpdir(), 'fetch-pruefungen-summe-'))
  try {
    for (const ordner of ['data/curated', 'public/data', 'extension', 'daniel-zum-abarbeiten']) mkdirSync(join(wurzelTmp, ordner), { recursive: true })
    for (const d of ['cartoons', 'ohne-synchro']) writeFileSync(join(wurzelTmp, 'public/data', `${d}.json`), '[]')
    const folgenListe = Array.from({ length: 40 }, (_, i) => ({ s: 1, e: i + 1, en: `Titel ${i + 1}` }))
    writeFileSync(join(wurzelTmp, 'data/cartoon-folgen.json'), JSON.stringify({ '-900001': { tmdbId: 1, geholtAm: '2026-11-02', folgen: folgenListe } }))
    if (mitJustWatch) writeFileSync(join(wurzelTmp, 'data/justwatch-audio.json'), JSON.stringify({ '-900001': { staffeln: [{ nr: 1, folgen: 28 }, { nr: 2, folgen: 12 }] } }))
    const videos = Array.from({ length: 12 }, (_, i) => [{ staffel: 2, folge: i + 1, titel: `Titel ${29 + i}` }, { staffel: 1, folge: i + 1, titel: `Titel ${i + 1}` }]).flat()
    if (mitRtl) writeFileSync(join(wurzelTmp, 'data/rtlplus-folgen.json'), JSON.stringify({ titel: { '-900001': { videos } } }))
    return lauf(szenario, ['--trocken'], wurzelTmp, { PRUEFLISTE_ERWEITERT: '1' }).stdout
  } finally {
    rmSync(wurzelTmp, { recursive: true, force: true })
  }
}
const summeGut = summeIn('summe', true)
if (belegTitel(summeGut).join() !== '-900001' || !summeGut.includes('from: 29') || !summeGut.includes('to: 40') || !summeGut.includes('bestätigt durch: Folgentitel (12 von 12')) fehler.push(`Staffelsumme: Beleg 29–40 mit Vermerk fehlt: ${summeGut.slice(0, 400)}`)
const summeVerschoben = summeIn('summefalsch', true)
if (belegTitel(summeVerschoben).length) fehler.push(`Staffelsumme mit verschobenen Titeln: kein Beleg erwartet: ${summeVerschoben.slice(0, 300)}`)
/* Netflix meldet keine Titel (Beyblade X): RTL+ bestätigt; ohne RTL+ bleibt die Meldung liegen; mit zwei Anbieter-Staffeln zählt die Summe davor mit. */
const summeRtl = summeIn('summerl', true, true)
if (belegTitel(summeRtl).join() !== '-900001' || !summeRtl.includes('from: 29') || !summeRtl.includes('to: 40') || !summeRtl.includes('RTL+ Staffel 2 gegen unsere Liste')) fehler.push(`Staffelsumme über RTL+: Beleg 29–40 fehlt: ${summeRtl.slice(0, 400)}`)
const summeOhneRtl = summeIn('summerl', true, false)
if (belegTitel(summeOhneRtl).length) fehler.push(`Staffelsumme ohne jede Titelbestätigung: kein Beleg erwartet: ${summeOhneRtl.slice(0, 300)}`)
const summeZwei = summeIn('summerl2', true, true)
if (belegTitel(summeZwei).join() !== '-900001,-900001' || !summeZwei.includes('from: 29') || !summeZwei.includes('to: 34') || !summeZwei.includes('from: 35') || !summeZwei.includes('to: 40')) fehler.push(`Staffelsumme mit Anbieter-Staffel 2 und 3: Belege 29–34 und 35–40 fehlen: ${summeZwei.slice(0, 400)}`)
/* Staffel 3 trägt Titel in der Notiz: sie stellen nicht die Bestätigung von Staffel 2 (Meldungs-Staffelfilter); RTL+ Staffel 1 zählt nicht mit (RTL-Staffelfilter). */
const summeDrei = summeIn('summerl3', true, true)
if (belegTitel(summeDrei).join() !== '-900001,-900001' || !summeDrei.includes('from: 35') || !summeDrei.includes('to: 40')) fehler.push(`Staffelsumme, Staffel 3 mit eigenen Titeln: Belege 29–34 und 35–40 fehlen: ${summeDrei.slice(0, 400)}`)
/* Zwei Titel an einer Adresse: die Summe gilt nur für genau einen Titel. */
const summeZweiTitel = summeIn('summezwei', true, true)
if (belegTitel(summeZweiTitel).length) fehler.push(`Staffelsumme bei zwei Titeln an der Adresse: kein Beleg erwartet: ${summeZweiTitel.slice(0, 300)}`)
const summeOhneJw = summeIn('summe', false)
if (belegTitel(summeOhneJw).length) fehler.push(`Staffelsumme ohne JustWatch: kein Beleg erwartet: ${summeOhneJw.slice(0, 300)}`)

const tmp = mkdtempSync(join(tmpdir(), 'fetch-pruefungen-laufzeit-'))
try {
  for (const ordner of ['data/curated', 'public/data', 'extension', 'daniel-zum-abarbeiten']) mkdirSync(join(tmp, ordner), { recursive: true })
  for (const d of ['cartoons', 'ohne-synchro']) writeFileSync(join(tmp, 'public/data', `${d}.json`), '[]')
  writeFileSync(join(tmp, 'data/dub-confirmed.yaml'), '# leer\n')
  lauf('zwei', [], tmp)
  const yaml = readFileSync(join(tmp, 'data/dub-confirmed.yaml'), 'utf8')
  if (!yaml.includes('anilistId: 900003') || yaml.includes('anilistId: 900002')) fehler.push(`dub-confirmed.yaml ohne den Beleg für 900003: ${yaml.slice(0, 200)}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`check-fetch-pruefungen-laufzeit: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-fetch-pruefungen-laufzeit: Staffel 2 an Staffelreihe 2 (nicht OVA), Staffel 1 und 2 getrennt, Beleg in dub-confirmed.yaml angehängt, Staffel ohne Zahl über Netflix\' Aufteilung verteilt, Notiz je Staffel, Staffelsumme (Beleg 29–40 mit Bestätigungsvermerk; verschobene Titel und fehlendes JustWatch lassen die Meldung liegen), Teil-weg: jüngstes Urteil nach Datum (dub, kein_dub, Datum gegen Reihenfolge), nur Teil-weg ohne dub-Zeile mit Vermerk, ganzes weg als available false.')
