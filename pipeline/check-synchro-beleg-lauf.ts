/**
 * Prozesstest zu `anime2you-extraktion.ts --belege` (F108, 07.11.2026): das echte Skript läuft in einem Wegwerf-Ordner (AK_ROOT) mit
 * Vorschlagsdatei, Katalog und Belegdatei. Belegt die Verdrahtung (Fenster von 7 Tagen, Katalog lesen, Beleg schreiben, `anzahl`
 * für den Workflow, Kommentardatei), nicht nur die Auswahlfunktion. Der Tag (2999, nie die echte Uhr) kommt über `--heute`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import yaml from 'js-yaml'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const tsx = resolve('node_modules/tsx/dist/cli.mjs')
const skript = resolve('pipeline/anime2you-extraktion.ts')
const ZITAT = 'Darüber hinaus ist heute die erste Episode von »Devils‘ Crest« erschienen. Neue Folgen werden fortan jeden Freitag mit deutscher Sprachausgabe sowie im japanischen Originalton mit Untertiteln veröffentlicht.'
const HAND = "- anilistId: 900001\n  title: \"Fremd\"\n  platform: netflix\n  dub: false\n  checkedAt: '2026-10-16'\n"
const vorschlag = (veroeffentlicht: string) => ({
  titel: 'Devils‘ Crest',
  art: 'start',
  plattform: 'primevideo',
  anbieter: 'Prime Video',
  sender: null,
  datum: null,
  uhrzeit: null,
  wochentage: null,
  sprache: 'deutsch+omu',
  folgen: null,
  zitat: ZITAT,
  unsicher: null,
  wochentag: null,
  warnungen: [],
  artikelId: '1068059',
  artikel: 'Prime Video',
  quelle: 'https://www.anime2you.de/news/1068059/prime-video-devils-crest-und-mehr/',
  veroeffentlicht,
  gelesenAm: veroeffentlicht,
})
const katalog = [{ id: 203275, titleRomaji: "Demons' Crest", titleEn: "Devils' Crest", titleDe: 'Devils’ Crest', streams: [{ platform: 'primevideo' }] }]

interface Lauf { status: number | null; aus: string; yaml: string; anzahl: string; kommentar: boolean; flaute: string }

function lauf(vorschlaege: object[] | null, heute = '2999-12-30', katalogDatei = 'titles.json', inhalt: object[] = katalog): Lauf {
  const wurzel = mkdtempSync(join(tmpdir(), 'synchro-lauf-'))
  try {
    for (const d of ['data/proposals', 'public/data']) mkdirSync(join(wurzel, d), { recursive: true })
    if (vorschlaege) writeFileSync(join(wurzel, 'data/proposals/anime2you-extraktion.json'), JSON.stringify({ gelesen: {}, vorschlaege }))
    writeFileSync(join(wurzel, 'public/data', katalogDatei), JSON.stringify(inhalt))
    writeFileSync(join(wurzel, 'data/dub-confirmed.yaml'), HAND)
    const ausgabe = join(wurzel, 'github-output.txt')
    const r = spawnSync(process.execPath, [tsx, skript, '--belege', '--verzeichnis', join(wurzel, 'a2y'), '--heute', heute], {
      cwd: wurzel,
      env: { ...process.env, AK_ROOT: wurzel, GITHUB_OUTPUT: ausgabe },
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
    })
    return {
      status: r.status,
      aus: `${r.stdout}${r.stderr}`,
      yaml: readFileSync(join(wurzel, 'data/dub-confirmed.yaml'), 'utf8'),
      anzahl: existsSync(ausgabe) ? readFileSync(ausgabe, 'utf8').trim() : '',
      kommentar: existsSync(join(wurzel, 'a2y/belege.md')),
      flaute: existsSync(join(wurzel, 'a2y/flaute.txt')) ? readFileSync(join(wurzel, 'a2y/flaute.txt'), 'utf8') : '',
    }
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const treffer = lauf([vorschlag('2999-12-29')])
pruefe('Treffer: Exit 0, anzahl=1, Kommentardatei da', treffer.status === 0 && treffer.anzahl === 'anzahl=1' && treffer.kommentar, treffer)
pruefe('Treffer: Beleg 203275 primevideo dub true steht in der Datei, der Handblock davor unverändert', treffer.yaml.startsWith(HAND) && /anilistId: 203275\n {2}title: "Devils’ Crest"\n {2}platform: primevideo\n {2}dub: true\n {2}checkedAt: '2999-12-30'/.test(treffer.yaml), treffer.yaml)
pruefe('Treffer: Log nennt den Auto-Beleg', treffer.aus.includes('Auto-Beleg: Devils’ Crest (203275) bei primevideo, Artikel 1068059'), treffer.aus)

const grenze = lauf([vorschlag('2999-12-23')])
pruefe('Fenster: Artikel genau 7 Tage alt (23.12. bei heute 30.12.) zählt noch', grenze.status === 0 && grenze.anzahl === 'anzahl=1', grenze)
const zuAlt = lauf([vorschlag('2999-12-22')])
pruefe('Fenster: 8 Tage alt (22.12.) zählt nicht, anzahl=0, Datei unverändert', zuAlt.status === 0 && zuAlt.anzahl === 'anzahl=0' && zuAlt.yaml === HAND, zuAlt)

const ohneDatei = lauf(null)
pruefe('Ohne Vorschlagsdatei: Exit 0, anzahl=0, Datei unverändert', ohneDatei.status === 0 && ohneDatei.anzahl === 'anzahl=0' && ohneDatei.yaml === HAND, ohneDatei)

const doppelt = lauf([vorschlag('2999-12-29'), { ...vorschlag('2999-12-29'), artikelId: '1068061' }])
pruefe('Zwei Vorschläge zum selben Titel und Weg: ein Beleg', doppelt.anzahl === 'anzahl=1' && doppelt.yaml.split('anilistId: 203275').length === 2, doppelt)

const ohneSynchro = lauf([vorschlag('2999-12-29')], '2999-12-30', 'ohne-synchro.json')
pruefe('Titel steht nur in ohne-synchro.json: Beleg (zweite Katalogdatei wird gelesen)', ohneSynchro.status === 0 && ohneSynchro.anzahl === 'anzahl=1', ohneSynchro)

// --- Flaute: viele strittige Vorschläge, kein Beleg -> Warnung (Lauf 08.11.2026, 0 von 18) -------------------------------------
const unbekannt = (n: number) => Array.from({ length: n }, (_, i) => ({ ...vorschlag('2999-12-29'), titel: `Unbekannt ${i}`, artikelId: `9${i}` }))
const flaute = lauf(unbekannt(5))
pruefe('Flaute: 5 Vorschläge ohne Katalogtreffer, 0 Belege: ::warning:: mit Liste, flaute.txt, Ausgabe flaute=1, Exit 0',
  flaute.status === 0 && flaute.aus.includes('::warning::Synchro-Belege: 0 Belege bei 5 Vorschlägen') && flaute.aus.includes('Unbekannt 4 (Artikel 94): Titel nicht im Katalog') && flaute.flaute.startsWith('Synchro-Belege: 0 Belege bei 5') && flaute.anzahl === 'anzahl=0\nflaute=1', flaute)
const vier = lauf(unbekannt(4))
pruefe('Flaute: 4 Vorschläge (unter der Schwelle 5): keine Warnung', vier.status === 0 && !vier.aus.includes('::warning::') && vier.flaute === '' && vier.anzahl === 'anzahl=0', vier)
const nurRichtig = lauf(unbekannt(6).map((v) => ({ ...v, titel: 'Devils‘ Crest' })), '2999-12-30', 'titles.json', [{ ...katalog[0]!, streams: [{ platform: 'primevideo', dub: true }] }])
pruefe('Flaute: 6 Vorschläge, alle „Weg trägt schon dub: true“ (richtig): keine Warnung', nurRichtig.status === 0 && nurRichtig.aus.includes('Weg trägt schon dub: true') && !nurRichtig.aus.includes('::warning::') && nurRichtig.flaute === '', nurRichtig)
const gemischt = lauf(unbekannt(4).concat(unbekannt(3).map((v) => ({ ...v, titel: 'Devils‘ Crest' }))), '2999-12-30', 'titles.json', [{ ...katalog[0]!, streams: [{ platform: 'primevideo', dub: true }] }])
pruefe('Flaute: 4 strittige plus 3 richtige: gezählt werden nur die strittigen, keine Warnung', gemischt.status === 0 && gemischt.flaute === '', gemischt)
const mitBeleg = lauf(unbekannt(5).concat([vorschlag('2999-12-29')]))
pruefe('Flaute: 5 strittige, aber ein Beleg: keine Warnung', mitBeleg.status === 0 && mitBeleg.anzahl === 'anzahl=1' && mitBeleg.flaute === '', mitBeleg)

// --- Der Workflow ruft den Schritt wirklich und legt den Fund auch ohne neuen Artikel vor ---------------------------------------
interface Schritt {
  name?: string
  id?: string
  if?: string
  run?: string
}
const workflow = yaml.load(readFileSync(resolve('.github/workflows/claude-anime2you-extraktion.yml'), 'utf8')) as { jobs: { lesen: { steps: Schritt[] } } }
const schritte = workflow.jobs.lesen.steps
const platz = (f: (s: Schritt) => boolean) => schritte.findIndex(f)
const belegeSchritt = platz((s) => s.id === 'belege')
const uebernehmen = platz((s) => (s.run ?? '').includes('--uebernehmen'))
const appToken = platz((s) => s.id === 'app')
const einreichen = platz((s) => s.id === 'einreichen')
pruefe('Workflow: Schritt „belege“ ruft --belege mit dem Arbeitsordner, ohne if (jeder Lauf)', belegeSchritt >= 0 && schritte[belegeSchritt]!.run === 'npx tsx pipeline/anime2you-extraktion.ts --belege --verzeichnis "$ARBEITSORDNER"' && schritte[belegeSchritt]!.if === undefined, schritte[belegeSchritt])
pruefe('Workflow: Reihenfolge übernehmen, belege, App-Token, einreichen', uebernehmen >= 0 && uebernehmen < belegeSchritt && belegeSchritt < appToken && appToken < einreichen, [uebernehmen, belegeSchritt, appToken, einreichen])
const ODER = "steps.auswahl.outputs.anzahl != '0' || steps.belege.outputs.anzahl != '0'"
pruefe('Workflow: App-Token und Einreichen laufen bei neuen Artikeln oder neuen Belegen', schritte[appToken]!.if === ODER && schritte[einreichen]!.if === ODER, [schritte[appToken]!.if, schritte[einreichen]!.if])
const kommentare = schritte.filter((s) => (s.run ?? '').startsWith('gh pr comment'))
pruefe('Workflow: Zusammenfassung nur mit neuen Artikeln, Belegkommentar nur mit Belegen, beide mit PR',
  kommentare.length === 2 &&
    kommentare[0]!.if === "steps.einreichen.outputs.pr != '' && steps.auswahl.outputs.anzahl != '0'" &&
    kommentare[0]!.run!.includes('zusammenfassung.md') &&
    kommentare[1]!.if === "steps.einreichen.outputs.pr != '' && steps.belege.outputs.anzahl != '0'" &&
    kommentare[1]!.run!.includes('belege.md'),
  kommentare)

console.log(fehler ? `\n${fehler} von ${faelle} Fällen verletzt.` : `check-synchro-beleg-lauf: ${faelle} Fälle ok (Prozess --belege: Verdrahtung, Fenster 7 Tage, anzahl für den Workflow, Schritte im Workflow).`)
process.exit(fehler ? 1 : 0)
