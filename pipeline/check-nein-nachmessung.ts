/**
 * Wächter: eine Kanal-Meldung „kein Deutsch“ nach dem Messdatum startet die Nein-Frist neu (07.11.2026).
 *
 * Anlass: Prime-Kanal-Titel wie „Granblue Fantasy: The Animation“ (Nein vom 25.08., Kanal-Meldung „kein Deutsch“ am 31.10.): Die Meldung
 * war abgehakt, der Beleg blieb auf dem 25.08., und die Prüfliste zeigte weiter „Das Nein ist 74 Tage alt“ (22 von 116 Wiedervorlagen).
 * Geprüft: die Regel (`neinWiedervorlage`), die Schreibfunktion (`merkeNachmessung`) und der Abruf als Prozess (`fetch-pruefungen.ts`).
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import yaml from 'js-yaml'
import { neinWiedervorlage, type NeinBeleg } from '../shared/nein-wiedervorlage.ts'
import type { Release } from '../shared/types.ts'
import { merkeNachmessung, nachmessungen, type NachmessMeldung } from './lib/nein-nachmessung.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const fehler: string[] = []
let faelle = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  faelle++
  if (!ok) fehler.push(`${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const JETZT = new Date('2026-11-07T10:00:00Z')
const nein = (id: number, platform: string, datum: string, extra: string[] = []) => [
  `- anilistId: ${id}`,
  `  platform: ${platform}`,
  '  dub: false',
  `  checkedAt: '${datum}'`,
  ...extra,
  '  note: "Tonspuren: 日本語"',
]
const ja = (id: number, platform: string, datum: string) => [`- anilistId: ${id}`, `  platform: ${platform}`, '  dub: true', `  checkedAt: '${datum}'`]
const datei = (...bloecke: string[][]) => bloecke.map((b) => b.join('\n')).join('\n') + '\n'
const kanal = (datum: string, extra: Partial<NachmessMeldung> = {}): NachmessMeldung => ({
  plattform: 'primevideo',
  befund: 'kein_dub',
  notiz: 'Amazon-Seite X: alle 13 Folgen geprüft ⚠ Kanal-Titel',
  gemeldet_am: `${datum}T10:00:00Z`,
  titel_id: 7,
  ...extra,
})
const faellig = (text: string, termine: Release[] = []) => neinWiedervorlage(yaml.load(text) as NeinBeleg[], termine, JETZT).filter((f) => f.titleId === 7)
const stand = (text: string): string => String((yaml.load(text) as NeinBeleg[])[0]!.nachgemessenAm ?? '')

/* Regel: Frist ab Nachmessung. */
const alt = datei(nein(7, 'primevideo', '2026-08-25'))
pruefe('Kontrolle: Nein vom 25.08. ist am 07.11. fällig (Frist)', faellig(alt).length === 1 && faellig(alt)[0]!.grund === 'frist', faellig(alt))
const mit = (datum: string) => datei(nein(7, 'primevideo', '2026-08-25', [`  nachgemessenAm: '${datum}'`]))
pruefe('Nachmessung am 31.10.: nicht fällig', faellig(mit('2026-10-31')).length === 0, faellig(mit('2026-10-31')))
pruefe('Nachmessung genau 27 Tage zurück (11.10.): nicht fällig', faellig(mit('2026-10-11')).length === 0)
pruefe('Nachmessung genau 28 Tage zurück (10.10.): fällig', faellig(mit('2026-10-10')).length === 1)
pruefe('Nachmessung älter als das Messdatum: ohne Wirkung, fällig', faellig(mit('2026-08-01')).length === 1)
const frisch = datei(nein(7, 'primevideo', '2026-10-20'))
pruefe('frisches Nein ohne Nachmessung: nicht fällig', faellig(frisch).length === 0)
pruefe('frisches Nein mit älterer Nachmessung: nicht fällig (Messdatum zählt)', faellig(datei(nein(7, 'primevideo', '2026-10-20', ["  nachgemessenAm: '2026-08-01'"]))).length === 0)
const kachel = (datum: string): Release[] => [{ slug: 'p-7', titleId: 7, name: 'Probe', platform: 'primevideo', releaseType: 'weekly', schedule: { firstEpisodeDate: datum, episodeCount: 3, estimated: false }, sources: ['https://example.org/'] } as Release]
const mitKachel = faellig(mit('2026-10-31'), kachel('2026-09-10'))
pruefe('Kachel nach dem Messdatum bleibt Grund trotz Nachmessung', mitKachel.length === 1 && mitKachel[0]!.grund === 'kachel' && mitKachel[0]!.messAm === '2026-08-25', mitKachel)

/* Meldungen: nur Kanal, nur kein_dub, Berliner Tag, jüngste je Titel und Anbieter. */
const tage = (...m: NachmessMeldung[]) => [...nachmessungen(m)]
pruefe('Kanal kein_dub zählt', JSON.stringify(tage(kanal('2026-10-31'))) === '[["7|primevideo","2026-10-31"]]', tage(kanal('2026-10-31')))
pruefe('ohne Kanal-Warnung: zählt nicht', tage(kanal('2026-10-31', { notiz: 'Amazon-Seite X' })).length === 0)
pruefe('Notiz leer: zählt nicht', tage(kanal('2026-10-31', { notiz: null })).length === 0)
pruefe('Befund dub: zählt nicht', tage(kanal('2026-10-31', { befund: 'dub' })).length === 0)
pruefe('Befund weg: zählt nicht', tage(kanal('2026-10-31', { befund: 'weg' })).length === 0)
pruefe('ohne titel_id: zählt nicht', tage(kanal('2026-10-31', { titel_id: null })).length === 0 && tage(kanal('2026-10-31', { titel_id: undefined })).length === 0)
pruefe('23:30 UTC ist schon der nächste Berliner Tag', tage(kanal('2026-10-31', { gemeldet_am: '2026-10-31T23:30:00Z' }))[0]![1] === '2026-11-01')
pruefe('die jüngste von mehreren gewinnt, in beiden Reihenfolgen', tage(kanal('2026-10-20'), kanal('2026-10-31'))[0]![1] === '2026-10-31' && tage(kanal('2026-10-31'), kanal('2026-10-20'))[0]![1] === '2026-10-31')
pruefe('zwei Titel: zwei Einträge', tage(kanal('2026-10-31'), kanal('2026-10-30', { titel_id: 8 })).length === 2)

/* Schreiben. */
const a = merkeNachmessung(alt, [kanal('2026-10-31')])
pruefe('Feld steht hinter checkedAt, sonst nichts geändert', a.gemerkt === 1 && a.text === mit('2026-10-31'), a)
pruefe('Kreislauf: vorher fällig, nachher nicht', faellig(alt).length === 1 && faellig(a.text).length === 0)
pruefe('zweiter Lauf: Text gleich, nichts gemerkt', (() => { const z = merkeNachmessung(a.text, [kanal('2026-10-31')]); return z.gemerkt === 0 && z.text === a.text })())
const spaeter = merkeNachmessung(a.text, [kanal('2026-11-03')])
pruefe('spätere Meldung ersetzt das Feld (kein zweites)', spaeter.gemerkt === 1 && stand(spaeter.text) === '2026-11-03' && spaeter.text.split('nachgemessenAm').length === 2, spaeter)
pruefe('frühere Meldung zieht das Feld nicht zurück', merkeNachmessung(a.text, [kanal('2026-10-20')]).gemerkt === 0)
pruefe('Meldung am Tag des Messdatums: nichts', merkeNachmessung(alt, [kanal('2026-08-25')]).gemerkt === 0)
const altesFeld = datei(nein(7, 'primevideo', '2026-08-25', ["  nachgemessenAm: '2026-08-01'"]))
pruefe('Feld älter als das Messdatum, Meldung am Messtag: nichts', merkeNachmessung(altesFeld, [kanal('2026-08-25')]).gemerkt === 0)
pruefe('Feld älter als das Messdatum, Meldung danach: Feld rückt vor', stand(merkeNachmessung(altesFeld, [kanal('2026-08-26')]).text) === '2026-08-26')
pruefe('Meldung vor dem Messdatum: nichts', merkeNachmessung(alt, [kanal('2026-08-24')]).gemerkt === 0)
pruefe('Meldung einen Tag nach dem Messdatum: gemerkt', merkeNachmessung(alt, [kanal('2026-08-26')]).gemerkt === 1)
const fremd = datei(nein(8, 'primevideo', '2026-08-25'), nein(7, 'netflix', '2026-08-25'), nein(7, 'primevideo', '2026-08-25'), ja(9, 'primevideo', '2026-08-25'))
const f = merkeNachmessung(fremd, [kanal('2026-10-31')])
pruefe('andere Titel und Anbieter bleiben byte-gleich, nur der Treffer trägt das Feld', f.gemerkt === 1 && f.text.replace("  nachgemessenAm: '2026-10-31'\n", '') === fremd && f.text.split('nachgemessenAm').length === 2, f)
const jungJa = datei(nein(7, 'primevideo', '2026-08-25'), ja(7, 'primevideo', '2026-09-15'))
pruefe('jüngeres Ja hebt das Nein auf: kein Feld', merkeNachmessung(jungJa, [kanal('2026-10-31')]).gemerkt === 0)
const zweiNein = datei(nein(7, 'primevideo', '2026-08-25'), nein(7, 'primevideo', '2026-09-10'))
const z2 = merkeNachmessung(zweiNein, [kanal('2026-10-31')])
pruefe('zwei Nein desselben Titels: nur das jüngste trägt das Feld', z2.gemerkt === 1 && z2.text.split('nachgemessenAm').length === 2 && z2.text.indexOf('nachgemessenAm') > z2.text.indexOf('2026-09-10'), z2)
pruefe('Beleg ohne Urteil (nur Adresse): kein Feld', merkeNachmessung(datei(['- anilistId: 7', '  platform: primevideo', '  url: https://x', "  checkedAt: '2026-08-25'"]), [kanal('2026-10-31')]).gemerkt === 0)
pruefe('available: false zählt wie dub: false', merkeNachmessung(datei(['- anilistId: 7', '  platform: primevideo', '  available: false', "  checkedAt: '2026-08-25'"]), [kanal('2026-10-31')]).gemerkt === 1)
pruefe('leere Datei', merkeNachmessung('', [kanal('2026-10-31')]).text === '')
pruefe('keine Meldungen', merkeNachmessung(alt, []).text === alt)
pruefe('unlesbarer Block im Bestand: bleibt, lesbarer wird gemerkt', (() => { const k = merkeNachmessung(alt + '- kaputt: [\n  x: {\n', [kanal('2026-10-31')]); return k.gemerkt === 1 && k.text.endsWith('- kaputt: [\n  x: {\n') })())

/* Abruf als Prozess: fetch-pruefungen.ts mit einer Kanal-Meldung, auf einer bekannten Adresse: sie wird ausgelassen, es entsteht kein Beleg (Attrappe `tools/nein-datum-mock.mjs`). */
const kulisse = mkdtempSync(join(tmpdir(), 'nein-nachmessung-'))
try {
  const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
  const mock = pathToFileURL(join(wurzel, 'tools/nein-datum-mock.mjs')).href
  const { AK_ROOT: _kulisse, DATEN_WARNUNG: _warnung, ...umgebung } = process.env
  const log = join(kulisse, 'abruf.jsonl')
  const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], {
    cwd: wurzel,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...umgebung, LAUF_TOKEN: 'test', NEIN_DATUM_ALT: 'kanal', NEIN_DATUM_LOG: log, GITHUB_ENV: join(kulisse, 'github-env.txt') },
  })
  const schreibzugriffe = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z) as { pfad: string; inhalt: string })
  const belege = schreibzugriffe.filter((s) => /dub-confirmed\.yaml$/.test(s.pfad)).map((s) => s.inhalt)
  pruefe('Abruf (Prozess) endet mit Exit 0', lauf.status === 0, lauf.stderr.slice(-300))
  pruefe('Abruf: genau ein Schreibzugriff auf die Belege, das Nein behält checkedAt und trägt nachgemessenAm', belege.length === 1 && belege[0]!.includes("checkedAt: '2026-08-26'") && belege[0]!.includes("nachgemessenAm: '2026-10-24'") && !belege[0]!.includes('Aus dem Browser'), belege)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`FEHL check-nein-nachmessung:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-nein-nachmessung: ${faelle} Fälle ok (Frist ab Nachmessung, Kachel-Grund, Meldungsfilter, Schreiben, Abruf als Prozess).`)
