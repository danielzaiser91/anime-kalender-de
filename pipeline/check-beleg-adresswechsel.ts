/**
 * Zusicherung: **Ein PR, der die Adresse eines Handbelegs in `data/dub-confirmed.yaml` ändert, sperrt die alte Adresse**
 * (10.11.2026, Anlass #3339): Eintrag in `data/belege-entfernt.yaml` mit Kennung und alter Adresse (`pipeline/lib/beleg-adresswechsel.ts`).
 * Die echte Prüfung läuft nur im Ereignis `pull_request` gegen die Basis
 * `HEAD^1`; die Fälle und ein Ablauf in einem Wegwerf-Repo (Merge-Commit wie in der Kette) laufen immer.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import yaml from 'js-yaml'
import { adresswechsel } from './lib/beleg-adresswechsel.ts'
import { ladeBelegeEntfernt } from './lib/belege-entfernt.ts'
import { ROOT } from './lib/util.ts'
import { ladeBasis } from '../tools/pr-basis.mjs'

const BELEGE = 'data/dub-confirmed.yaml'
const ENTFERNT = 'data/belege-entfernt.yaml'

function ereignis(): void {
  const git = (...a: string[]): string => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] })
  const alt = (yaml.load(git('show', `${ladeBasis(git)}:${BELEGE}`)) as unknown[] | null) ?? []
  const neu = (yaml.load(readFileSync(join(ROOT, BELEGE), 'utf8')) as unknown[] | null) ?? []
  const { wechsel, ungedeckt } = adresswechsel(alt as never, neu as never, ladeBelegeEntfernt(join(ROOT, ENTFERNT)))
  if (ungedeckt.length) {
    console.error(`  ✖ Beleg-Adresswechsel: alte Adresse ohne Deckung: ${ungedeckt.join('; ')}\n    Eintrag in ${ENTFERNT} (Kennung + alte Adresse, mit Grund), sonst hängt die nächste Browser-Meldung den Block wieder an.`)
    process.exit(1)
  }
  console.log(`  ✓ Beleg-Adresswechsel: ${wechsel} Adresswechsel, alle gedeckt.`)
}

if (process.env.GITHUB_EVENT_NAME === 'pull_request') ereignis()
if (process.env.ADRESSWECHSEL_OHNE_PROBEN) process.exit(0)

const fehler: string[] = []
let pruefungen = 0
const erwarte = (name: string, ist: unknown, soll: unknown): void => {
  pruefungen++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}

/* Fälle wörtlich aus #3339: Blöcke von 150672 an der Kanal-Adresse B0GFPBT6FG (Notiz nennt B0B7D5DRV2) zogen auf B0B7D5DRV2 um, der Pauschalblock vom 23.08. wurde gelöscht. */
const SEITE = 'https://www.amazon.de/gp/video/detail/'
const NOTIZ = 'Folgen 1–3 mit deutschem Ton — Tonspuren: Deutsch, 日本語 — Amazon-Seite B0B7D5DRV2: alle 12 Folgen geprüft'
const alt = [{ anilistId: 150672, url: `${SEITE}B0GFPBT6FG`, note: NOTIZ }]
const neu = [{ anilistId: 150672, url: `${SEITE}B0B7D5DRV2`, note: NOTIZ }]
const ALTE = `150672 ${SEITE}B0GFPBT6FG`
const sperre = (anilistId: number, url: string): { anilistId: number; url: string; grund: string; entferntAm: string }[] => [{ anilistId, url, grund: 'x', entferntAm: 'x' }]
const urteil = (a: unknown[], n: unknown[], e = sperre(1, 'https://x.example/a')) => adresswechsel(a as never, n as never, e)

erwarte('#3339: Notiz nennt die neue Adresse, ohne Eintrag trotzdem ungedeckt', urteil(alt, neu), { wechsel: 1, ungedeckt: [ALTE] })
erwarte('Adresse auf eine andere Seite geändert: ungedeckt', urteil(alt, [{ ...neu[0], url: `${SEITE}B0AAAAAAAA` }]).ungedeckt, [ALTE])
erwarte('Eintrag in der Sperrliste deckt', urteil(alt, neu, sperre(150672, `${SEITE}B0GFPBT6FG`)), { wechsel: 1, ungedeckt: [] })
erwarte('Sperre einer anderen Kennung an derselben Adresse deckt nicht', urteil(alt, neu, sperre(182587, `${SEITE}B0GFPBT6FG`)).ungedeckt, [ALTE])
erwarte('Sperre derselben Kennung an anderer Adresse deckt nicht', urteil(alt, neu, sperre(150672, `${SEITE}B0CCCCCCCC`)).ungedeckt, [ALTE])
erwarte('Sperre in dp-Form deckt die gp/video/detail-Adresse', urteil(alt, neu, sperre(150672, 'https://www.amazon.de/dp/B0GFPBT6FG')).ungedeckt, [])
erwarte('neue Adresse bei einer anderen Kennung ist kein Wechsel von 150672', urteil(alt, [{ ...neu[0], anilistId: 99 }]), { wechsel: 0, ungedeckt: [] })
erwarte('reines Löschen ohne neue Adresse ist kein Wechsel', urteil(alt, []), { wechsel: 0, ungedeckt: [] })
erwarte('unverändert: kein Wechsel', urteil(alt, alt), { wechsel: 0, ungedeckt: [] })
erwarte('ein weiterer Beleg derselben Kennung ohne Löschung ist kein Wechsel', urteil(alt, [...alt, ...neu]), { wechsel: 0, ungedeckt: [] })
erwarte('Adresse bleibt, anderer Block wird neu: kein Wechsel', urteil(alt, [...alt, { anilistId: 7, url: `${SEITE}B0DDDDDDDD` }]), { wechsel: 0, ungedeckt: [] })
erwarte('Pauschalblock und umgehängter Block an derselben Adresse: ein Wechsel, ein Eintrag', urteil([alt[0], { ...alt[0], note: 'Amazon-Seite B0GFPBT6FG' }], neu), { wechsel: 1, ungedeckt: [ALTE] })
erwarte('zwei Adresswechsel derselben Kennung: beide genannt', urteil([...alt, { ...alt[0], url: `${SEITE}B0EEEEEEEE` }], neu).ungedeckt, [ALTE, `150672 ${SEITE}B0EEEEEEEE`])
erwarte('dieselbe Seite in dp-Form statt gp/video/detail ist kein Wechsel', urteil(alt, [{ ...alt[0], url: 'https://www.amazon.de/dp/B0GFPBT6FG' }, ...neu]), { wechsel: 0, ungedeckt: [] })
erwarte('leere Listen', urteil([], []), { wechsel: 0, ungedeckt: [] })
erwarte('Beleg ohne Adresse wird übergangen', urteil([{ anilistId: 1 }], neu), { wechsel: 0, ungedeckt: [] })

/* Ablauf: Wegwerf-Repo mit Merge-Commit wie in der Kette (HEAD^1 = main, HEAD^2 = PR); die Prüfung läuft als Kindprozess dieser Datei. */
const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx/esm')).href
const skript = fileURLToPath(import.meta.url)
const ordner = mkdtempSync(join(tmpdir(), 'beleg-adresswechsel-'))
const g = (...a: string[]): void => void execFileSync('git', ['-C', ordner, '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { stdio: 'pipe', timeout: 60_000 })
const schreibe = (pfad: string, inhalt: string): void => {
  mkdirSync(join(ordner, 'data'), { recursive: true })
  writeFileSync(join(ordner, pfad), inhalt)
}
const belegDatei = (b: { anilistId: number; url: string; note: string }[]): string => yaml.dump(b)
const KEINE_SPERRE = '[]\n'

function ablauf(vorher: string, nachher: string, sperrListe = KEINE_SPERRE): { status: number | null; aus: string } {
  rmSync(ordner, { recursive: true, force: true })
  mkdirSync(ordner, { recursive: true })
  g('init', '-q', '-b', 'main')
  schreibe(BELEGE, vorher)
  schreibe(ENTFERNT, KEINE_SPERRE)
  g('add', '-A')
  g('commit', '-q', '-m', 'basis')
  g('checkout', '-q', '-b', 'pr')
  schreibe(BELEGE, nachher)
  schreibe(ENTFERNT, sperrListe)
  g('add', '-A')
  g('commit', '-q', '-m', 'pr')
  g('checkout', '-q', 'main')
  schreibe('fremd.txt', 'main ging weiter')
  g('add', '-A')
  g('commit', '-q', '-m', 'main')
  g('merge', '-q', '--no-ff', 'pr', '-m', 'merge')
  const r = spawnSync(process.execPath, ['--import', tsx, skript], {
    cwd: ordner,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, AK_ROOT: ordner, GITHUB_EVENT_NAME: 'pull_request', ADRESSWECHSEL_OHNE_PROBEN: '1' },
  })
  return { status: r.status, aus: `${r.stdout}${r.stderr}` }
}

const rot = ablauf(belegDatei(alt), belegDatei(neu))
erwarte('Ablauf: Adresswechsel ohne Deckung endet mit Exit 1', rot.status, 1)
erwarte('Ablauf: Fehlertext nennt Kennung und alte Adresse', rot.aus.includes(`150672 ${SEITE}B0GFPBT6FG`), true)
const mitSperre = ablauf(belegDatei(alt), belegDatei(neu), yaml.dump(sperre(150672, `${SEITE}B0GFPBT6FG`)))
erwarte('Ablauf: Eintrag in der Sperrliste deckt, Exit 0', mitSperre.status, 0)
erwarte('Ablauf: Ergebniszeile nennt den Wechsel', /✓ Beleg-Adresswechsel: 1 Adresswechsel, alle gedeckt/.test(mitSperre.aus), true)
const ohneWechsel = ablauf(belegDatei(alt), belegDatei([{ ...alt[0]!, note: `${NOTIZ} (nachgemessen)` }]))
erwarte('Ablauf: kein Wechsel, Exit 0 und Zeile mit 0', [ohneWechsel.status, /✓ Beleg-Adresswechsel: 0 Adresswechsel/.test(ohneWechsel.aus)], [0, true])
rmSync(ordner, { recursive: true, force: true })

if (fehler.length) {
  console.error(`check-beleg-adresswechsel: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log(`check-beleg-adresswechsel: ${pruefungen} Prüfungen grün (Fälle und Abläufe im Wegwerf-Repo); echte Prüfung nur im PR-Ereignis.`)
if (process.env.GITHUB_EVENT_NAME !== 'pull_request') console.log('  – Beleg-Adresswechsel: echte Prüfung nur im PR-Ereignis.')
