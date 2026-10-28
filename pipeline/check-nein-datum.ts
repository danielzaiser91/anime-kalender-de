/**
 * Wächter: dasselbe Nein noch einmal gemessen erneuert das Messdatum des vorhandenen Belegs (24.10.2026).
 *
 * Anlass: Disney+ „nichts da?" für Fire Force S3, One-Punch Man S3, Shield Hero S2, Chainsaw Man, Children of the
 * Sea und Aoashi. Jede Antwort war wörtlich der Beleg vom 26.08.2026; `neueBelegBloecke()` verwarf sie, `checkedAt`
 * blieb 26.08., und die Wiedervorlage („Nein ist 28 Tage alt") kam nach jedem Bau zurück.
 *
 * Fährt `erneuereNeinDatum` direkt (Fallliste) und `haengeBelegeAn` als Prozess-Lauf gegen eine Kulisse (`AK_ROOT`).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import yaml from 'js-yaml'
import { neinWiedervorlage, type NeinBeleg } from '../shared/nein-wiedervorlage.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/nein-datum-mock.mjs')).href

const kulisse = mkdtempSync(join(tmpdir(), 'nein-datum-'))
process.env.AK_ROOT = kulisse
mkdirSync(join(kulisse, 'data'), { recursive: true })

const { erneuereNeinDatum } = await import('./lib/nein-datum-erneuern.ts')
const { haengeBelegeAn } = await import('./lib/belege-anhaengen.ts')

const fehler: string[] = []
let faelle = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  faelle++
  if (!ok) fehler.push(`${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const weg = (datum: string, extra: Record<string, string> = {}) => [
  `- anilistId: ${extra.id ?? 149118}`,
  '  title: "Fire Force: Staffel 3"',
  `  platform: ${extra.platform ?? 'disneyplus'}`,
  `  url: ${extra.url ?? 'https://www.disneyplus.com/de-de/browse/entity-5973'}`,
  '  available: false',
  `  checkedAt: ${datum}`,
  `  note: "${extra.note ?? 'Disney+ meldet: nicht in deinem Gebiet verfügbar'}"`,
]
const ja = (datum: string, id = 149118, platform = 'disneyplus') => [
  `- anilistId: ${id}`,
  `  platform: ${platform}`,
  '  dub: true',
  `  checkedAt: '${datum}'`,
]
const datei = (...bloecke: string[][]) => bloecke.map((b) => b.join('\n')).join('\n\n') + '\n'
const neu = (...bloecke: string[][]) => bloecke.flatMap((b) => ['', ...b])

try {
  /* Anlassfall: das Nein vom 26.08. wird am 24.10. wörtlich wiederholt. */
  const alt = datei(ja('2026-08-01', 1, 'netflix'), weg("'2026-08-26'"), ja('2026-08-02', 2, 'netflix'))
  const a = erneuereNeinDatum(alt, neu(weg("'2026-10-24'")))
  pruefe('Anlass: Messdatum rückt auf den 24.10.', a.erneuert === 1 && a.text.includes("checkedAt: '2026-10-24'") && !a.text.includes('2026-08-26'), a)
  pruefe('Anlass: fremde Belege bleiben byte-gleich', a.text.replace("'2026-10-24'", "'2026-08-26'") === alt, a.text)
  const zweiter = erneuereNeinDatum(a.text, neu(weg("'2026-10-24'")))
  pruefe('zweiter Lauf: nichts mehr zu erneuern, Text gleich', zweiter.erneuert === 0 && zweiter.text === a.text, zweiter)
  pruefe('gleiches Datum (delta 0): unverändert', erneuereNeinDatum(alt, neu(weg("'2026-08-26'"))).erneuert === 0)
  pruefe('ältere Messung: Datum geht nicht zurück', erneuereNeinDatum(alt, neu(weg("'2026-08-20'"))).erneuert === 0)
  pruefe('Datum nur einen Tag später zählt', erneuereNeinDatum(alt, neu(weg("'2026-08-27'"))).erneuert === 1)
  const doppelt = erneuereNeinDatum(alt, neu(weg("'2026-09-01'"), weg("'2026-10-24'")))
  pruefe('zwei neue Messungen: die jüngste gewinnt', doppelt.text.includes("checkedAt: '2026-10-24'") && !doppelt.text.includes('2026-09-01'), doppelt)

  const jungZuerst = erneuereNeinDatum(alt, neu(weg("'2026-10-24'"), weg("'2026-09-01'")))
  pruefe('zwei neue Messungen, die jüngere zuerst: sie gewinnt', jungZuerst.text.includes("checkedAt: '2026-10-24'") && !jungZuerst.text.includes('2026-09-01'), jungZuerst)

  /* „Ohne deutschen Ton“ (dub: false) ist ebenso ein Nein wie „nicht verfügbar“ (available: false). */
  const ton = (datum: string) => ['- anilistId: 161476', '  platform: disneyplus', '  dub: false', `  checkedAt: '${datum}'`, '  note: "ohne deutschen Ton"']
  const tonNeu = erneuereNeinDatum(datei(ton('2026-08-26')), neu(ton('2026-10-24')))
  pruefe('dub: false wird wie available: false erneuert', tonNeu.erneuert === 1 && tonNeu.text.includes("'2026-10-24'"), tonNeu)

  /* Ja im Stapel: ein gleich junges Ja neben dem neuen Nein hebt es auf, ein älteres nicht. */
  const stapelJa = erneuereNeinDatum(alt, neu(weg("'2026-10-24'"), ja('2026-10-24')))
  pruefe('Stapel: Nein und Ja vom selben Tag — Bestand bleibt', stapelJa.erneuert === 0 && stapelJa.text === alt, stapelJa)
  pruefe('Stapel: älteres Ja neben dem neuen Nein — erneuert', erneuereNeinDatum(alt, neu(weg("'2026-10-24'"), ja('2026-08-01'))).erneuert === 1)
  pruefe('Stapel: Ja eines anderen Anbieters stört nicht', erneuereNeinDatum(alt, neu(weg("'2026-10-24'"), ja('2026-10-24', 149118, 'netflix'))).erneuert === 1)

  /* Ja heißt wie im Bau (`urteilVon`): auch ein deutscher Bereich ohne `dub:`, nicht bei `available: false`. */
  const bereich = (datum: string) => ['- anilistId: 149118', '  platform: disneyplus', '  dubRanges:', '    - from: 1', '      to: 3', '      dub: true', `  checkedAt: '${datum}'`]
  pruefe('Ja nur über dubRanges (jünger) hebt das Nein auf', erneuereNeinDatum(datei(weg("'2026-08-26'"), bereich('2026-09-15')), neu(weg("'2026-10-24'"))).erneuert === 0)
  pruefe('dubRanges ohne dub: true ist kein Ja', erneuereNeinDatum(datei(weg("'2026-08-26'"), bereich('2026-09-15').map((z) => z.replace('dub: true', 'dub: false'))), neu(weg("'2026-10-24'"))).erneuert === 1)

  /* Kreislauf: nach dem Erneuern ist die Wiedervorlage weg, ein zweiter Lauf ändert nichts. */
  const faelle = (text: string) => neinWiedervorlage(yaml.load(text) as NeinBeleg[], [], new Date('2026-10-24T20:00:00Z')).filter((f) => f.titleId === 149118)
  const kreis = erneuereNeinDatum(alt, neu(weg("'2026-10-24'")))
  pruefe('Kreislauf: vorher eine Wiedervorlage, nachher keine', faelle(alt).length === 1 && faelle(kreis.text).length === 0, [faelle(alt).length, faelle(kreis.text).length])
  const nochmal = erneuereNeinDatum(kreis.text, neu(weg("'2026-10-24'")))
  pruefe('Kreislauf: zweiter Lauf auf dem Ergebnis — Datei unverändert', nochmal.erneuert === 0 && nochmal.text === kreis.text)

  /* Anführungszeichen und Einrückung des alten Belegs. */
  const dq = erneuereNeinDatum(datei(weg('"2026-08-26"')), neu(weg("'2026-10-24'")))
  pruefe('Datum in doppelten Anführungszeichen wird ersetzt, Einrückung bleibt', dq.text.includes("\n  checkedAt: '2026-10-24'\n"), dq)

  /* Was nicht erneuert wird. */
  pruefe('anderer Text im Beleg (note): nicht erneuert', erneuereNeinDatum(alt, neu(weg("'2026-10-24'", { note: 'anderer Grund' }))).erneuert === 0)
  pruefe('andere Adresse (Mehrstaffel-Adresse, zweiter Beleg): nicht erneuert', erneuereNeinDatum(alt, neu(weg("'2026-10-24'", { url: 'https://x/zweite' }))).erneuert === 0)
  pruefe('anderer Anbieter, gleiche Kennung: nicht erneuert', erneuereNeinDatum(alt, neu(weg("'2026-10-24'", { platform: 'netflix' }))).erneuert === 0)
  pruefe('andere Kennung: nicht erneuert', erneuereNeinDatum(alt, neu(weg("'2026-10-24'", { id: '5' }))).erneuert === 0)
  const nurJa = datei(ja('2026-08-26'))
  pruefe('ein Ja wird nie erneuert', erneuereNeinDatum(nurJa, neu(ja('2026-10-24'))).erneuert === 0)
  const nurJaNeu = erneuereNeinDatum(alt, neu(ja('2026-10-24')))
  pruefe('neue Meldung ist ein Ja: das alte Nein bleibt', nurJaNeu.erneuert === 0 && nurJaNeu.text === alt, nurJaNeu)

  /* Ein jüngeres oder gleich altes Ja hebt das Nein auf und bleibt oben. */
  pruefe('jüngeres Ja im Bestand: Nein nicht erneuert', erneuereNeinDatum(datei(weg("'2026-08-26'"), ja('2026-09-15')), neu(weg("'2026-10-24'"))).erneuert === 0)
  pruefe('gleich altes Ja im Bestand: Nein nicht erneuert', erneuereNeinDatum(datei(weg("'2026-08-26'"), ja('2026-08-26')), neu(weg("'2026-10-24'"))).erneuert === 0)
  pruefe('älteres Ja im Bestand: Nein wird erneuert', erneuereNeinDatum(datei(ja('2026-08-25'), weg("'2026-08-26'")), neu(weg("'2026-10-24'"))).erneuert === 1)
  pruefe('mehrere Ja: das jüngste zählt, auch wenn ein älteres später in der Datei steht',
    erneuereNeinDatum(datei(weg("'2026-08-26'"), ja('2026-09-15'), ja('2026-08-01')), neu(weg("'2026-10-24'"))).erneuert === 0)
  pruefe('jüngeres Ja einer anderen Kennung am selben Anbieter stört nicht', erneuereNeinDatum(datei(weg("'2026-08-26'"), ja('2026-09-15', 5)), neu(weg("'2026-10-24'"))).erneuert === 1)
  pruefe('Ja eines anderen Anbieters stört nicht', erneuereNeinDatum(datei(weg("'2026-08-26'"), ja('2026-09-15', 149118, 'netflix')), neu(weg("'2026-10-24'"))).erneuert === 1)

  const ohneUrteil = ['- anilistId: 149118', '  platform: disneyplus', '  url: https://x/neu', "  checkedAt: '2026-09-15'"]
  pruefe('jüngerer Beleg ohne Urteil (nur Adresse) stört nicht', erneuereNeinDatum(datei(weg("'2026-08-26'"), ohneUrteil), neu(weg("'2026-10-24'"))).erneuert === 1)

  /* Zwei Belege derselben Adresse (mit und ohne url): nur der wörtlich gleiche rückt vor. */
  const ohneUrl = weg("'2026-08-26'").filter((z) => !z.startsWith('  url:'))
  const paarAlt = datei(ohneUrl, weg("'2026-08-26'"))
  const paar = erneuereNeinDatum(paarAlt, neu(weg("'2026-10-24'")))
  pruefe('Beleg ohne url neben dem mit url: nur der mit url rückt vor', paar.erneuert === 1 && paar.text.split("'2026-10-24'").length === 2 && paar.text.includes('2026-08-26'), paar)

  /* Kaputte und leere Eingaben. */
  pruefe('leere Datei', erneuereNeinDatum('', neu(weg("'2026-10-24'"))).erneuert === 0)
  pruefe('keine neuen Zeilen', erneuereNeinDatum(alt, []).text === alt)
  pruefe('unlesbarer neuer Block: kein Absturz, nichts erneuert', erneuereNeinDatum(alt, ['- a: [', '  b: {']).erneuert === 0)
  const kaputtAlt = alt + '\n- kaputt: [\n  x: {\n'
  const kaputt = erneuereNeinDatum(kaputtAlt, neu(weg("'2026-10-24'")))
  pruefe('unlesbarer Block im Bestand: bleibt stehen, lesbarer wird erneuert', kaputt.erneuert === 1 && kaputt.text.endsWith('- kaputt: [\n  x: {\n'), kaputt)

  /* Der Läufer: Datei lesen, erneuern, schreiben — zwei Läufe, Kopfzeile nur bei neuen Belegen. */
  const ziel = join(kulisse, 'data/dub-confirmed.yaml')
  const ENTFERNT = join(dirname(ziel), 'belege-entfernt.yaml')
  writeFileSync(ENTFERNT, '[]')
  writeFileSync(ziel, alt)
  const meldungen: string[] = []
  const lauf = () => haengeBelegeAn({ datei: ziel, zeilen: neu(weg("'2026-10-24'")), heute: '2026-10-24', log: (t) => meldungen.push(t), warn: (t) => meldungen.push(t) })
  lauf()
  const nachEins = readFileSync(ziel, 'utf8')
  /* `schreibeBelege` → `entdoppleBelege` lässt die Leerzeilen zwischen Belegen weg (bestehendes Verhalten). */
  const ohneLeer = (s: string) => s.split('\n\n').join('\n')
  pruefe('Läufer: Datei trägt das neue Messdatum, sonst nichts', nachEins === ohneLeer(alt).replace("'2026-08-26'", "'2026-10-24'"), nachEins)
  pruefe('Läufer: Kopfzeile „abgeholt am“ nur bei angehängten Belegen', !nachEins.includes('Aus dem Browser gemeldet'), nachEins)
  pruefe('Läufer: Meldung zählt die Erneuerung', meldungen.some((t) => t.startsWith('1 Nein-Beleg(e)')), meldungen)
  lauf()
  pruefe('Läufer: zweiter Lauf ändert nichts', readFileSync(ziel, 'utf8') === nachEins)
  writeFileSync(ziel, alt)
  haengeBelegeAn({ datei: ziel, zeilen: neu(weg("'2026-10-24'"), ja('2026-10-24', 77)), heute: '2026-10-24', log: () => {}, warn: () => {} })
  const gemischt = readFileSync(ziel, 'utf8')
  pruefe('Läufer: Erneuern und Anhängen im selben Lauf', gemischt.includes("checkedAt: '2026-10-24'") && gemischt.includes('anilistId: 77') && !gemischt.includes('2026-08-26'), gemischt)
  writeFileSync(ziel, alt)
  haengeBelegeAn({ datei: ziel, zeilen: neu(weg("'2026-10-24'", { note: 'anderer Grund' })), heute: '2026-10-24', log: () => {}, warn: () => {} })
  pruefe('Läufer: anderes Nein wird wie bisher angehängt, altes Datum bleibt', readFileSync(ziel, 'utf8').includes('2026-08-26') && readFileSync(ziel, 'utf8').includes('anderer Grund'))

  /* Der echte Abruf: fetch-pruefungen.ts als Prozess mit einer Disney+-Meldung „weg“ (Attrappe `tools/nein-datum-mock.mjs`). */
  const abruf = (bestand: 'leer' | 'nein' | 'ja') => {
    const { AK_ROOT: _kulisse, DATEN_WARNUNG: _warnung, ...umgebung } = process.env
    const log = join(kulisse, `abruf-${bestand}.jsonl`)
    const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], {
      cwd: wurzel,
      encoding: 'utf8',
      env: { ...umgebung, LAUF_TOKEN: 'test', NEIN_DATUM_ALT: bestand, NEIN_DATUM_LOG: log, GITHUB_ENV: join(kulisse, 'github-env.txt') },
    })
    const zeilen = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z) as { pfad: string; inhalt: string })
    return { status: lauf.status, fehler: lauf.stderr.slice(-300), belege: zeilen.filter((s) => /dub-confirmed\.yaml$/.test(s.pfad)).map((s) => s.inhalt) }
  }
  const leer = abruf('leer')
  pruefe('Abruf, leerer Bestand: das Nein wird wie bisher angehängt', leer.status === 0 && leer.belege.length === 1 && /# --- Aus dem Browser gemeldet, abgeholt am \d{4}-\d{2}-\d{2} ---/.test(leer.belege[0]!), leer)
  const gleich = abruf('nein')
  pruefe('Abruf, dasselbe Nein vom 26.08.: Messdatum 24.10., kein neuer Block, keine Kopfzeile',
    gleich.status === 0 && gleich.belege.length === 1 && gleich.belege[0]!.includes("checkedAt: '2026-10-24'") && !gleich.belege[0]!.includes('2026-08-26') && !gleich.belege[0]!.includes('Aus dem Browser'), gleich)
  const jungesJa = abruf('ja')
  pruefe('Abruf, jüngeres Ja im Bestand: nichts geschrieben', jungesJa.status === 0 && jungesJa.belege.length === 0, jungesJa)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-nein-datum:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-nein-datum: ${faelle} Fälle ok (Erneuern, Ja-Schutz, kaputte Eingaben, Läufer, Abruf als Prozess).`)
