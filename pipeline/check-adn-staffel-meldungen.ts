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

/** Ein anderer Bestand als die fünf JoJo-Titel: Adresse und Titel (Kennung, Folgen, Jahr, Jahreszeit). */
type Bestand = { url: string; titel: [number, number, number, string][] }
let ausgabe = ''

function lauf(ordner: string, name: string, meldungen: Meldung[], fehler: string[], bestand?: Bestand): Beleg[] {
  const datei = join(ordner, `${name}.yaml`)
  /* Zweiter Saat-Beleg: 14719 hängt im echten Bestand schon an der JoJo-Seite (Besitz laut Zuordnung: ein anderer Titel), das ist kein neuer Treffer des Laufs. */
  writeFileSync(datei, `- anilistId: 1\n  platform: adn\n  url: https://animationdigitalnetwork.com/de/video/1\n  dub: true\n  checkedAt: '2026-10-01'\n- anilistId: 14719\n  platform: adn\n  url: ${ADN}444-jojo-s-bizarre-adventure\n  dub: true\n  checkedAt: '2026-10-01'\n`)
  const eigener = bestand ? { ADN_MOCK_URL: bestand.url, ADN_MOCK_TITEL: JSON.stringify(bestand.titel) } : {}
  const r = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], {
    cwd: wurzel,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, LAUF_TOKEN: 'test', ADN_MOCK_YAML: datei, ADN_MOCK_MELDUNGEN: JSON.stringify(meldungen), ...eigener },
  })
  if (r.status !== 0) fehler.push(`${name}: Lauf endete mit ${r.status}: ${r.stderr.slice(-300)}`)
  ausgabe = `${r.stdout}\n${r.stderr}`
  return (yaml.load(readFileSync(datei, 'utf8')) as Beleg[]).slice(2)
}

/** Kurzform eines Belegs: `dub` plus Bereiche, oder `-`, wo der Beleg fehlt. */
function kurz(belege: Beleg[], id: number): string {
  const b = belege.find((x) => x.anilistId === id)
  if (!b) return '-'
  const bereiche = (b.dubRanges ?? []).map((r) => `${r.from}-${r.to}:${r.dub}`).join('+')
  return `${b.dub}${bereiche ? ` ${bereiche}` : ''}`
}

/** Wo der alte Weg gilt (keiner in der Datei), was ein Titel ohne Eintrag bekommt (nichts) und dass `weg`-Meldungen nicht zählen. */
function pruefeGrenzen(fehler: string[]): void {
  const titel = (id: number, folgen: number) => ({ id, titel: String(id), folgen })
  const meldungen = staffel(1, 26, true)
  if (bereicheJeAdnTitel(meldungen, [titel(1, 26), titel(2, 24)], {}) !== undefined) fehler.push('ohne Eintrag in der Datei geht die Adresse nicht den alten Weg')
  const teil = bereicheJeAdnTitel(meldungen, [titel(14719, 26), titel(555, 24)], { 14719: '1' })
  if (!teil?.get(14719)?.bereiche.length || teil.has(555)) fehler.push('ein Titel ohne Eintrag bekommt Bereiche oder der mit Eintrag keine')
  const andere = bereicheJeAdnTitel(meldungen, [titel(14719, 26), titel(555, 24)], { 14719: '2', 555: '3' })
  if (!andere || andere.size !== 0) fehler.push('eine Staffel ohne Meldung bekommt Bereiche')
  /* Eine „weg“-Meldung trägt eine Folgennummer, sagt aber nichts über den Ton: Folge 5 bliebe sonst als Nein im Bereich. */
  const mitWeg = [...meldungen, { befund: 'weg', staffel: 1, folge_nr: 5 }]
  const ohneWeg = bereicheJeAdnTitel(mitWeg, [titel(14719, 26)], { 14719: '1' })?.get(14719)?.bereiche
  if (JSON.stringify(ohneWeg) !== JSON.stringify([{ von: 1, bis: 26, dub: true, belegt: [] }])) fehler.push(`eine weg-Meldung verändert die Bereiche: ${JSON.stringify(ohneWeg)}`)
}

const ADN = 'https://animationdigitalnetwork.com/de/video/'

/** Serien aus den Meldungen vom 11.11.2026 (Meldungskopie): Tougen Anki, Sword Art Online, ohne Eintrag, durchgezählt, Widerspruch. */
function pruefeWeitere(ordner: string, fehler: string[]): void {
  const sicher = (name: string, belege: Beleg[], erwartet: Record<number, string>, noten = /Widersprüchliche|zählt durch/): void => {
    for (const [id, soll] of Object.entries(erwartet)) if (kurz(belege, Number(id)) !== soll) fehler.push(`${name}: ${id} ist "${kurz(belege, Number(id))}", erwartet "${soll}"`)
    if (belege.some((b) => noten.test(b.note ?? ''))) fehler.push(`${name}: ein Beleg trägt eine Durchzähl-Notiz`)
  }
  /* Ein Titel, zwei ADN-Staffeln: die sechs Folgen der Staffel 2 ohne Ton gehören nicht zu Staffel 1 (vorher 1-6 nein, 7-24 ja). */
  const tougen = { url: `${ADN}1311-tougen-anki`, titel: [[177474, 24, 2025, 'SPRING']] as Bestand['titel'] }
  sicher('tougen-anki', lauf(ordner, 'tougen-anki', [...staffel(1, 24, true), ...staffel(2, 6, false)], fehler, tougen), { 177474: 'true' })
  /* SAO zählt je Staffel ab 1: Staffel 2 (24 Folgen, alle mit Ton) ist nicht 1-22, Staffel 3 teilt sich auf drei Titel (24 + 12 + 11). */
  const sao = { url: `${ADN}442-sword-art-online`, titel: [[11757, 25, 2012, 'SUMMER'], [20594, 24, 2014, 'SUMMER'], [100182, 24, 2018, 'FALL'], [108759, 12, 2019, 'FALL'], [114308, 11, 2020, 'SPRING']] as Bestand['titel'] }
  const saoMeldungen = [...staffel(1, 25, true), ...staffel(2, 24, true), ...staffel(3, 47, true)]
  sicher('sao', lauf(ordner, 'sao', saoMeldungen, fehler, sao), { 11757: 'true', 20594: 'true', 100182: 'true', 108759: 'true', 114308: 'true' })
  /* Gemischt: Folge 37 bis 47 der Staffel 3 ohne Ton ist nur der letzte Titel (11 Folgen), nicht der erste und nicht der zweite. */
  const saoGemischt = [...staffel(1, 25, true), ...staffel(2, 24, true), ...staffel(3, 36, true), ...staffel(3, 47, false).slice(36)]
  sicher('sao-gemischt', lauf(ordner, 'sao-gemischt', saoGemischt, fehler, sao), { 11757: 'true', 20594: 'true', 100182: 'true', 108759: 'true', 114308: 'false' })
  /* Sailor Moon, fünf Staffeln, nur die dritte (532, 38 Folgen) ohne Ton: jede Nachbarstaffel behält ihr Ja. */
  const mond = { url: `${ADN}427-sailor-moon`, titel: [[530, 46, 1992, 'WINTER'], [740, 43, 1993, 'FALL'], [532, 38, 1994, 'FALL'], [1239, 39, 1995, 'FALL'], [996, 34, 1996, 'FALL']] as Bestand['titel'] }
  const mondMeldungen = [...staffel(1, 46, true), ...staffel(2, 43, true), ...staffel(3, 38, false), ...staffel(4, 39, true), ...staffel(5, 34, true)]
  sicher('sailor-moon', lauf(ordner, 'sailor-moon', mondMeldungen, fehler, mond), { 530: 'true', 740: 'true', 532: 'false', 1239: 'true', 996: 'true' })
  /* Zählt eine Serie ohne Eintrag je Staffel, geht sie den alten Weg und der Lauf sagt es. */
  const ohneEintrag = { url: `${ADN}9999-ohne-eintrag`, titel: [[900001, 12, 2020, 'FALL'], [900002, 12, 2021, 'FALL']] as Bestand['titel'] }
  lauf(ordner, 'ohne-eintrag', [...staffel(1, 12, true), ...staffel(2, 12, false)], fehler, ohneEintrag)
  if (!/zählen je Staffel, aber keiner von 900001, 900002 steht in der Staffelzuordnung/.test(ausgabe)) fehler.push('ohne-eintrag: keine Warnung, dass die Serie je Staffel zählt')
  /* Dorohedoro zählt durch (Staffel 2 trägt 13-23): der alte Weg stimmt und warnt nicht. */
  const doro = { url: `${ADN}1375-dorohedoro`, titel: [[105228, 12, 2020, 'SPRING'], [173172, 11, 2026, 'WINTER']] as Bestand['titel'] }
  const dorohedoro = [...staffel(1, 12, false), ...staffel(2, 23, true).slice(12).map((m) => ({ ...m, staffel: 2 }))]
  const doroBelege = lauf(ordner, 'dorohedoro', dorohedoro, fehler, doro)
  if (kurz(doroBelege, 105228) !== 'false' || kurz(doroBelege, 173172) !== 'true') fehler.push(`dorohedoro: ${kurz(doroBelege, 105228)} / ${kurz(doroBelege, 173172)}, erwartet false / true`)
  if (/zählen je Staffel/.test(ausgabe)) fehler.push('dorohedoro: warnt, obwohl die Serie durchzählt')
  /* Widersprechen sich Meldungen derselben Staffel, steht das in der Notiz (Folge 3 zweimal, einmal Ja, einmal Nein). */
  const wider = [...staffel(1, 26, true), { befund: 'kein_dub' as const, staffel: 1, folge_nr: 3, gemeldet_am: '2026-11-09T21:40:00Z' }]
  const widerBelege = lauf(ordner, 'widerspruch', wider, fehler)
  if (!/Widersprüchliche Meldungen zu Folge 3/.test(widerBelege.find((b) => b.anilistId === 14719)?.note ?? '')) fehler.push('widerspruch: die Notiz nennt den Widerspruch in Folge 3 nicht')
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
  pruefeWeitere(ordner, fehler)
  pruefeGrenzen(fehler)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`check-adn-staffel-meldungen: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-adn-staffel-meldungen: ADN-Meldungen zählen je Staffel (JoJo, SAO, Tougen Anki), ohne Eintrag gilt der alte Weg mit Warnung, Dorohedoro zählt durch, Widersprüche bleiben in der Notiz.')
