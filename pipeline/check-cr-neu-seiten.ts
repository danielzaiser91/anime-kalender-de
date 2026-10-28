/**
 * Test des Katalogfunds `fetch-crunchyroll-neu.ts` und von `lib/cr-neu-seiten.ts`: Der Lauf hört auf zu blättern, sobald eine Seite
 * deutsche Folgen zeigt und alle bekannt sind (vorher immer 6 Seiten, stündlich also 6 Abrufe pro Lauf). Der Prozess läuft mit
 * gefälschtem `fetch` (Vorlader) gegen eine Kulisse in `AK_ROOT`; die Abrufe der Kulisse werden gezählt. Kennungen sind die echten
 * aus `data/crunchyroll-neu.json` (Stand 28.10.2026).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { seiteNurBekannt } from './lib/cr-neu-seiten.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

const PSYREN = 'GE00384252DEDE'
const AOASHI = 'GE00384109DEDE'
const OVERGEARED = 'GE00384232DEDE'
const LAST_BOSS_1 = 'GE00384097DEDE'
const eintrag = (id: string, audio: string, serie = 'GT00371866') => ({ id, title: 'x', episode_metadata: { audio_locale: audio, series_id: serie, series_title: 'S', premium_available_date: '2026-10-26T14:30:00.000Z' } })
const de = (id: string) => eintrag(id, 'de-DE')
const ja = (id: string) => eintrag(id, 'ja-JP')

/* Die Entscheidungsfunktion. */
const bekannt = new Set([PSYREN, AOASHI])
pruefe('Seite mit lauter bekannten deutschen Folgen: aufhören', seiteNurBekannt([de(PSYREN), ja('J1'), de(AOASHI)], bekannt))
pruefe('eine unbekannte deutsche Folge: weiterlesen', !seiteNurBekannt([de(PSYREN), de(LAST_BOSS_1)], bekannt))
pruefe('genau eine deutsche Folge und die ist bekannt: aufhören', seiteNurBekannt([ja('J1'), de(AOASHI)], bekannt))
pruefe('keine deutsche Folge auf der Seite: weiterlesen', !seiteNurBekannt([ja('J1'), ja(PSYREN)], bekannt))
pruefe('leere Seite: weiterlesen (die Schleife endet dort selbst)', !seiteNurBekannt([], bekannt))
pruefe('bekannte Kennung in anderer Sprache zählt nicht als deutsch', !seiteNurBekannt([ja(PSYREN)], bekannt))
pruefe('deutsche Folge ohne Kennung: weiterlesen', !seiteNurBekannt([{ episode_metadata: { audio_locale: 'de-DE' } }], bekannt))

/* Der Prozess mit gefälschtem fetch. */
const wurzel = mkdtempSync(join(tmpdir(), 'cr-neu-seiten-'))
const vorlader = join(wurzel, 'fetch-attrappe.mjs')
writeFileSync(
  vorlader,
  [
    "import { appendFileSync, readFileSync } from 'node:fs'",
    'globalThis.fetch = async (url) => {',
    "  const u = String(url)",
    "  if (u.includes('/auth/v1/token')) return Response.json({ access_token: 't', country: 'DE' })",
    "  appendFileSync(process.env.ATTRAPPE_LOG, u + '\\n')",
    "  const start = Number(new URL(u).searchParams.get('start'))",
    "  const seiten = JSON.parse(readFileSync(process.env.ATTRAPPE_SEITEN, 'utf8'))",
    '  return Response.json({ data: seiten[start / 100] ?? [] })',
    '}',
  ].join('\n'),
)
const skript = fileURLToPath(new URL('./fetch-crunchyroll-neu.ts', import.meta.url))
let nummer = 0
function lauf(name: string, seiten: unknown[][], vorhanden: string[], argumente: string[] = []) {
  const ordner = join(wurzel, `${++nummer}-${name}`)
  mkdirSync(join(ordner, 'data'), { recursive: true })
  const folgen = vorhanden.map((guid) => ({ guid, serieId: 'GT00371866', serie: 'S', verfuegbarAb: '2026-10-26T14:30:00.000Z', gesehenAm: '2999-01-01' }))
  writeFileSync(join(ordner, 'data', 'crunchyroll-neu.json'), JSON.stringify({ geholtAm: '', folgen }))
  const log = join(ordner, 'abrufe.log')
  const seitenDatei = join(ordner, 'seiten.json')
  writeFileSync(log, '')
  writeFileSync(seitenDatei, JSON.stringify(seiten))
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--import', pathToFileURL(vorlader).href, skript, ...argumente], {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, AK_ROOT: ordner, ATTRAPPE_LOG: log, ATTRAPPE_SEITEN: seitenDatei },
  })
  const abrufe = readFileSync(log, 'utf8').split('\n').filter(Boolean).length
  const datei = join(ordner, 'data', 'crunchyroll-neu.json')
  const gespeichert = existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')).folgen as { guid: string }[]).map((f) => f.guid) : []
  return { status: r.status, abrufe, gespeichert, ausgabe: r.stdout + r.stderr }
}
const sechs = (erste: unknown[]) => [erste, ...Array.from({ length: 5 }, (_, i) => [ja(`J${i}`)])]

const a = lauf('alles-bekannt', sechs([de(PSYREN), de(AOASHI), ja('J0')]), [PSYREN, AOASHI, OVERGEARED])
pruefe('Seite 1 nur bekannt: ein Abruf statt sechs, Datei bleibt', a.status === 0 && a.abrufe === 1 && a.gespeichert.length === 3, a)
const b = lauf('neu-dann-bekannt', [[de(LAST_BOSS_1), de(PSYREN)], [de(AOASHI)], [de('SPAET1')], [], [], []], [PSYREN, AOASHI])
pruefe('Seite 1 mit neuer Folge, Seite 2 nur bekannt: zwei Abrufe, die neue Folge steht in der Datei', b.status === 0 && b.abrufe === 2 && b.gespeichert.includes(LAST_BOSS_1) && !b.gespeichert.includes('SPAET1'), b)
const c = lauf('kein-deutsch', sechs([ja('J0'), ja('J9')]), [PSYREN])
pruefe('keine deutsche Folge auf Seite 1: es wird weiter bis zur sechsten Seite gelesen', c.status === 0 && c.abrufe === 6, c)
const d = lauf('erster-lauf', sechs([de(LAST_BOSS_1)]), [])
pruefe('leerer Bestand: nichts ist bekannt, alle sechs Seiten', d.status === 0 && d.abrufe === 6 && d.gespeichert.includes(LAST_BOSS_1), d)
const e = lauf('spaetere-neue', [[de(PSYREN)], [de(LAST_BOSS_1)], [], [], [], []], [PSYREN])
pruefe('Seite 1 nur bekannt, neue Folge erst auf Seite 2: bewusst nicht gelesen (ein Abruf)', e.status === 0 && e.abrufe === 1 && !e.gespeichert.includes(LAST_BOSS_1), e)
const f = lauf('seiten-2', [[de(LAST_BOSS_1)], [de('NEU2')], [de('NEU3')], [], [], []], [], ['--seiten', '2'])
pruefe('--seiten 2 begrenzt weiter: zwei Abrufe', f.status === 0 && f.abrufe === 2, f)
const g = lauf('leere-seite', [[de(LAST_BOSS_1)], [], [de('NEU3')]], [PSYREN])
pruefe('leere zweite Seite beendet das Lesen: zwei Abrufe', g.status === 0 && g.abrufe === 2 && !g.gespeichert.includes('NEU3'), g)
pruefe('die Zusammenfassung nennt die gelesenen Seiten', /1 Seiten, 3 Folgen gelesen/.test(a.ausgabe), a.ausgabe)

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
