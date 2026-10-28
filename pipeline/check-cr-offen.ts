/**
 * Test von `data:cr-dub -- --nur-neu --limit 60 --offen-pruefen` (`lib/cr-offen.ts`): Der Lauf zählt, wie viele Serien er lesen würde,
 * ohne Zugangspaket und ohne Abruf, und meldet die Zahl als `cr_offen` an die Schritte danach (Datei `GITHUB_OUTPUT`). Der
 * Stundenlauf holt das Paket der Weiche nur, wenn sie nicht 0 ist. Kulisse in `AK_ROOT`; Kennungen sind die echten aus
 * `data/crunchyroll-neu.json` (Last Boss Folgen 1 und 2 vom 25.10.2026, Psyren). Tage weit in der Zukunft, damit keine Uhr zählt.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const LB = 'GT00361955'
const PSYREN = 'GT00371866'
const F1 = 'GE00384097DEDE'
const F2 = 'GE00384098DEDE'
const adresse = (id: string) => `https://www.crunchyroll.com/de/series/${id}/x`
const titel = (id: number, serie: string) => ({ id, streams: [{ platform: 'crunchyroll', url: adresse(serie) }] })
const fund = (serieId: string, guid: string, gesehenAm: string) => ({ guid, serieId, serie: 'S', gesehenAm, verfuegbarAb: `${gesehenAm}T10:00:00.000Z` })
const eintrag = (serie: string, geprueftAm: string, mehr: Record<string, unknown> = {}) => ({ url: adresse(serie), seriesId: serie, katalog: 'de', geprueftAm, deutschImAngebot: true, ...mehr })

const skript = fileURLToPath(new URL('./scrape-crunchyroll-dub.ts', import.meta.url))
const wurzel = mkdtempSync(join(tmpdir(), 'cr-offen-'))
let nummer = 0
function zaehle(name: string, funde: unknown[], bestand: unknown[], mitAusgabe = true) {
  const ordner = join(wurzel, `${++nummer}-${name}`)
  mkdirSync(join(ordner, 'data'), { recursive: true })
  mkdirSync(join(ordner, 'public', 'data'), { recursive: true })
  writeFileSync(join(ordner, 'public', 'data', 'titles.json'), JSON.stringify([titel(1, LB), titel(2, PSYREN)]))
  writeFileSync(join(ordner, 'data', 'crunchyroll-neu.json'), JSON.stringify({ geholtAm: '', folgen: funde }))
  writeFileSync(join(ordner, 'data', 'crunchyroll-dub.json'), JSON.stringify({ scrapedAt: '', serien: bestand }))
  const ausgabe = join(ordner, 'github-output.txt')
  writeFileSync(ausgabe, '')
  const env: Record<string, string | undefined> = { ...process.env, AK_ROOT: ordner, CR_ZUGANG: undefined }
  if (mitAusgabe) env.GITHUB_OUTPUT = ausgabe
  else delete env.GITHUB_OUTPUT
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, '--nur-neu', '--limit', '60', '--offen-pruefen'], { encoding: 'utf8', windowsHide: true, env: env as NodeJS.ProcessEnv })
  const dub = readFileSync(join(ordner, 'data', 'crunchyroll-dub.json'), 'utf8') === JSON.stringify({ scrapedAt: '', serien: bestand })
  return { status: r.status, ausgabe: readFileSync(ausgabe, 'utf8'), log: r.stdout + r.stderr, dubUnberuehrt: dub }
}

const frisch = zaehle('nichts-neu', [fund(LB, F1, '2999-12-30')], [eintrag(LB, '2999-12-31', { neuFolgen: [F1] })])
pruefe('Folge schon beim letzten Lesen bekannt: nichts zu lesen, cr_offen=0', frisch.status === 0 && frisch.ausgabe === 'cr_offen=0\n', frisch)
const neuer = zaehle('neuer-tag', [fund(LB, F1, '2999-12-31')], [eintrag(LB, '2999-12-30')])
pruefe('Folge nach dem letzten Lesen: cr_offen=1', neuer.status === 0 && neuer.ausgabe === 'cr_offen=1\n', neuer)
const doppel = zaehle('doppelstart', [fund(LB, F1, '2999-12-31'), fund(LB, F2, '2999-12-31')], [eintrag(LB, '2999-12-31', { neuFolgen: [F1] })])
pruefe('Doppelstart: zweite Folge desselben Tages, nur die erste bekannt: cr_offen=1', doppel.status === 0 && doppel.ausgabe === 'cr_offen=1\n', doppel)
const beide = zaehle('doppelstart-erledigt', [fund(LB, F1, '2999-12-31'), fund(LB, F2, '2999-12-31')], [eintrag(LB, '2999-12-31', { neuFolgen: [F1, F2] })])
pruefe('Doppelstart gelesen: cr_offen=0', beide.status === 0 && beide.ausgabe === 'cr_offen=0\n', beide)
const unbekannt = zaehle('nie-gelesen', [fund(PSYREN, 'GE00384252DEDE', '2999-12-31')], [])
pruefe('Serie mit Titel, nie gelesen: cr_offen=1', unbekannt.status === 0 && unbekannt.ausgabe === 'cr_offen=1\n', unbekannt)
const leer = zaehle('kein-fund', [], [eintrag(LB, '2999-12-30')])
pruefe('kein Katalogfund: cr_offen=0', leer.status === 0 && leer.ausgabe === 'cr_offen=0\n', leer)
const us = zaehle('us-katalog', [fund(LB, F1, '2999-12-30')], [eintrag(LB, '2999-12-31', { neuFolgen: [F1], katalog: 'us' })])
pruefe('Eintrag aus dem US-Katalog gilt für den deutschen Zugang als offen: cr_offen=1', us.status === 0 && us.ausgabe === 'cr_offen=1\n', us)
const zwei = zaehle('zwei-serien', [fund(LB, F1, '2999-12-30'), fund(PSYREN, 'GE00384252DEDE', '2999-12-31')], [eintrag(LB, '2999-12-31', { neuFolgen: [F1] }), eintrag(PSYREN, '2999-12-30')])
pruefe('zwei Serien, nur eine offen: cr_offen=1', zwei.status === 0 && zwei.ausgabe === 'cr_offen=1\n', zwei)
const ohneDatei = zaehle('ohne-ausgabe', [fund(LB, F1, '2999-12-31')], [eintrag(LB, '2999-12-30')], false)
pruefe('ohne GITHUB_OUTPUT (lokal): Exit 0 und Logzeile, keine Datei nötig', ohneDatei.status === 0 && ohneDatei.log.includes('1 Serien würden gelesen') && ohneDatei.ausgabe === '', ohneDatei)
pruefe('die Zählung verändert den Bestand nicht', [frisch, neuer, doppel, beide, unbekannt, leer, us, zwei].every((z) => z.dubUnberuehrt))

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
