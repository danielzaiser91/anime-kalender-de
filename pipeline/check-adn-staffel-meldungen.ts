/**
 * Zusicherung: ADN-Meldungen zählen je Staffel (Anlass: JoJo, Meldung vom 09.11.2026 mit je Staffel 26, 48, 39, 39 Folgen). Der alte
 * Weg verteilte die Nummern als durchgezählt und schrieb 14719 als „ohne deutschen Ton", Stardust Crusaders mit Teilbereichen.
 * Läuft `pipeline/fetch-pruefungen.ts` ohne `--trocken` gegen eine Attrappe (`tools/adn-staffel-mock.mjs`, Folgenzahlen wie in
 * `public/data`) und die echte `data/adn-staffelzuordnung.yaml`; geschrieben wird nur in eine Wegwerfdatei im Temp-Ordner.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import yaml from 'js-yaml'
import { bereicheJeAdnTitel } from './lib/meldungen-bereiche.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/adn-staffel-mock.mjs')).href

type Meldung = { befund: 'dub' | 'kein_dub'; staffel: number | null; folge_nr: number; gemeldet_am: string }
type Beleg = { anilistId: number; dub?: boolean; dubRanges?: { from: number; to: number; dub: boolean }[]; note?: string }

/** Staffel `staffel` mit den Folgen 1..`folgen`, alle mit demselben Befund. */
function staffel(nr: number | null, folgen: number, dub: boolean): Meldung[] {
  return Array.from({ length: folgen }, (_, i) => ({
    befund: dub ? 'dub' : 'kein_dub',
    staffel: nr,
    folge_nr: i + 1,
    gemeldet_am: '2026-11-09T21:33:26Z',
  }))
}

function lauf(ordner: string, name: string, meldungen: Meldung[], fehler: string[]): Beleg[] {
  const datei = join(ordner, `${name}.yaml`)
  writeFileSync(datei, `- anilistId: 1\n  platform: adn\n  url: https://animationdigitalnetwork.com/de/video/1\n  dub: true\n  checkedAt: '2026-10-01'\n`)
  const r = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], {
    cwd: wurzel,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, LAUF_TOKEN: 'test', ADN_MOCK_YAML: datei, ADN_MOCK_MELDUNGEN: JSON.stringify(meldungen) },
  })
  if (r.status !== 0) fehler.push(`${name}: Lauf endete mit ${r.status}: ${r.stderr.slice(-300)}`)
  return (yaml.load(readFileSync(datei, 'utf8')) as Beleg[]).slice(1)
}

/** Kurzform eines Belegs: `dub` plus Bereiche, oder `-`, wo der Beleg fehlt. */
function kurz(belege: Beleg[], id: number): string {
  const b = belege.find((x) => x.anilistId === id)
  if (!b) return '-'
  const bereiche = (b.dubRanges ?? []).map((r) => `${r.from}-${r.to}:${r.dub}`).join('+')
  return `${b.dub}${bereiche ? ` ${bereiche}` : ''}`
}

/** Wo der alte Weg gilt (ein Titel, keiner in der Datei) und was ein Titel ohne Eintrag bekommt (nichts). */
function pruefeGrenzen(fehler: string[]): void {
  const titel = (id: number, folgen: number) => ({ id, titel: String(id), folgen })
  const meldungen = staffel(1, 26, true)
  if (bereicheJeAdnTitel(meldungen, [titel(14719, 26)], { 14719: '1' }) !== undefined) fehler.push('ein Titel an der Adresse geht nicht den alten Weg')
  if (bereicheJeAdnTitel(meldungen, [titel(1, 26), titel(2, 24)], {}) !== undefined) fehler.push('ohne Eintrag in der Datei geht die Adresse nicht den alten Weg')
  const teil = bereicheJeAdnTitel(meldungen, [titel(14719, 26), titel(555, 24)], { 14719: '1' })
  if (!teil?.get(14719)?.length || teil.has(555)) fehler.push('ein Titel ohne Eintrag bekommt Bereiche oder der mit Eintrag keine')
  const andere = bereicheJeAdnTitel(meldungen, [titel(14719, 26), titel(555, 24)], { 14719: '2', 555: '3' })
  if (!andere || andere.size !== 0) fehler.push('eine Staffel ohne Meldung bekommt Bereiche')
}

const ordner = mkdtempSync(join(tmpdir(), 'adn-staffel-'))
const fehler: string[] = []
const pruefe = (name: string, belege: Beleg[], erwartet: Record<number, string>, neuerWeg = true): void => {
  for (const [id, soll] of Object.entries(erwartet)) {
    const ist = kurz(belege, Number(id))
    if (ist !== soll) fehler.push(`${name}: ${id} ist "${ist}", erwartet "${soll}"`)
  }
  const notizen = belege.filter((b) => /Widersprüchliche|zählt durch/.test(b.note ?? '')).length
  if (neuerWeg && notizen) fehler.push(`${name}: ${notizen} Belege tragen die Durchzähl-Notiz`)
}
try {
  /* Die echte Meldung vom 09.11.2026: Staffel 1 bis 3 mit Ton, Staffel 4 nur Untertitel; jede Staffel zählt ab 1. */
  const echt = [...staffel(1, 26, true), ...staffel(2, 48, true), ...staffel(3, 39, true), ...staffel(4, 39, false)]
  pruefe('jojo-echt', lauf(ordner, 'jojo-echt', echt, fehler), {
    14719: 'true',
    20474: 'true',
    20799: 'true',
    21450: 'true',
    102883: 'false',
  })
  /* Staffel 2 teilt sich auf zwei Titel (24 + 24): Folge 25 bis 48 gehört 20799, und nur dort fehlt der Ton. */
  const geteilt = [...staffel(2, 24, true), ...staffel(2, 48, false).slice(24).map((m) => ({ ...m, befund: 'kein_dub' as const }))]
  pruefe('staffel-geteilt', lauf(ordner, 'staffel-geteilt', geteilt, fehler), { 14719: '-', 20474: 'true', 20799: 'false', 21450: '-' })
  /* Eine Meldung ohne Staffel geht den alten Weg (durchgezählt, auf die Folgenzahlen verteilt): Folge 27 ist die erste von 20474. */
  const ohne = staffel(null, 27, true).map((m) => ({ ...m, befund: m.folge_nr === 27 ? ('kein_dub' as const) : m.befund }))
  pruefe('ohne-staffel', lauf(ordner, 'ohne-staffel', ohne, fehler), { 14719: 'true', 20474: 'false 1-1:false' }, false)
  pruefeGrenzen(fehler)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`check-adn-staffel-meldungen: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-adn-staffel-meldungen: ADN-Meldungen zählen je Staffel, geteilte Staffel 2 trifft 20474 und 20799 einzeln, ohne Staffel gilt der alte Weg.')
