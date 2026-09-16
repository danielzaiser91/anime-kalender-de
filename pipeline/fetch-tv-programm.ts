/**
 * **Was heute im Fernsehen läuft — aus dem Programm von RTL+.**
 *
 * Anlass (16.09.2026): Dragon Ball DAIMA lief ab dem 28.08. täglich bei TOGGO
 * plus, und der Kalender wusste davon nichts. Daniel: „tägliche tv releases
 * sind ein paradebeispiel für eine notwendige erweiterung der webseite".
 *
 * **Warum diese Quelle.** Die Recherche vom selben Abend (status.md, „Quellen
 * für deutsche TV-Sendetermine") hat fernsehserien.de, TVmaze, ARD/KiKA, Joyn
 * und iptv-org verworfen. `plus.rtl.de/tv-programm` erlaubt das Auslesen
 * (robots `Allow: /`), die AGB schließen nur **kommerzielles** Text- und
 * Data-Mining aus — und diese Seite ist laut Impressum ein nicht kommerzielles
 * Fan-Projekt ohne Werbung. Abgedeckt sind die Sender der RTL-Gruppe, darunter
 * TOGGO plus, Super RTL und RTLZWEI; **nur der laufende Tag**, deshalb läuft der
 * Abruf täglich und sammelt.
 *
 * Die Seite trägt das Programm als eingebettetes JSON: je Sendung Beginn, Ende,
 * Titel, Folgentitel und eine Kennung `rtlde_<sender>+<nr>+<tag>` (base64).
 *
 * Zugeordnet wird nur, was **wörtlich** einem Titel des Bestands entspricht
 * (deutscher, englischer oder Original-Name, aniSearch-Synonyme), mit einer
 * einzigen erlaubten Endung „: Die Serie" — „Pokémon Horizonte: Die Serie" ist
 * „Pokémon Horizonte". Ein Namensteil genügt nicht (CLAUDE.md, Reihenkopf).
 *
 * Ergebnis: `data/tv-programm.json`, je Sendung ein Eintrag, 120 Tage lang.
 *
 * Aufruf: npx tsx pipeline/fetch-tv-programm.ts [--trocken]
 */
import type { Title } from '../shared/types.ts'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const DATEI = 'data/tv-programm.json'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
const TROCKEN = process.argv.includes('--trocken')

/** Sendernamen, wie der Kalender sie zeigt. Unbekannte Kürzel bleiben sichtbar statt geraten. */
export const SENDER: Record<string, string> = {
  rtl: 'RTL',
  vox: 'VOX',
  rtlzwei: 'RTLZWEI',
  nitro: 'NITRO',
  ntv: 'ntv',
  rtlup: 'RTLup',
  voxup: 'VOXup',
  super_rtl: 'Super RTL',
  toggo_plus: 'TOGGO plus',
  now: 'NOW',
}

export interface TvSendung {
  titleId: number
  titel: string
  folge?: string
  sender: string
  start: string
  ende: string
  gesehenAm: string
}

/** Vergleichbare Form eines Namens. */
export const namensKern = (s: string | undefined | null): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Liest die Sendungen aus der Seite. Reine Funktion — `check-logic.ts` prüft sie. */
export function sendungenAusSeite(html: string): { start: string; ende: string; titel: string; folge?: string; kennung: string }[] {
  const s = html.replace(/\\"/g, '"')
  const re =
    /\{"start":\{"date":"([^"]+)"[^}]*\},"end":\{"date":"([^"]+)"[^}]*\},"title":"((?:[^"\\]|\\.)*)","extraTitle":(null|"(?:[^"\\]|\\.)*")[\s\S]{0,300}?"value_modal":\{"id":"([^"]+)"/g
  const aus = []
  for (const m of s.matchAll(re)) {
    const kennung = Buffer.from(m[5]!, 'base64').toString('utf8')
    if (!/^rtlde_[a-z_]+\+\d+\+\d{4}-\d{2}-\d{2}$/.test(kennung)) continue
    aus.push({
      start: m[1]!,
      ende: m[2]!,
      titel: m[3]!,
      folge: m[4] === 'null' ? undefined : m[4]!.slice(1, -1),
      kennung,
    })
  }
  return aus
}

/** Ordnet einen Sendungstitel einem Titel des Bestands zu — nur wörtlich. */
export function titelZuordnen(sendung: string, namen: Map<string, number>): number | undefined {
  const kern = namensKern(sendung)
  return namen.get(kern) ?? namen.get(kern.replace(/ die serie$/, ''))
}

export async function main(): Promise<void> {
  const r = await fetch('https://plus.rtl.de/tv-programm', { headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE' } })
  if (!r.ok) {
    warn(`RTL+-Programm: HTTP ${r.status}`)
    recordSource('tv-programm', 0, `HTTP ${r.status}`)
    process.exitCode = 1
    return
  }
  const sendungen = sendungenAusSeite(await r.text())
  log(`${sendungen.length} Sendungen im RTL+-Programm.`)
  if (!sendungen.length) {
    warn('Keine Sendung gelesen — hat RTL+ die Seite umgebaut?')
    recordSource('tv-programm', 0, 'keine Sendung gelesen')
    process.exitCode = 1
    return
  }

  const roh = readJson<Title[] | Record<string, Title>>('public/data/titles.json', [])
  const titles = (Array.isArray(roh) ? roh : Object.values(roh)) as (Title & { ohneSynchro?: boolean })[]
  const synonyme = readJson<Record<string, string[]>>('public/data/synonyme.json', {})
  const namen = new Map<string, number>()
  const doppelt = new Set<string>()
  for (const t of titles) {
    if (t.ohneSynchro) continue
    for (const n of [t.titleDe, t.titleEn, t.titleRomaji, ...(synonyme[String(t.id)] ?? [])]) {
      const k = namensKern(n)
      if (k.length < 4) continue
      if (namen.has(k) && namen.get(k) !== t.id) doppelt.add(k)
      namen.set(k, t.id)
    }
  }
  /* Ein Name, der zwei Titeln gehört, ordnet nichts zu. */
  for (const k of doppelt) namen.delete(k)

  const bestand = readJson<{ sendungen?: Record<string, TvSendung> }>(DATEI, {}).sendungen ?? {}
  const heute = new Date().toISOString().slice(0, 10)
  let neu = 0
  for (const s of sendungen) {
    const titleId = titelZuordnen(s.titel, namen)
    if (!titleId) continue
    const code = s.kennung.split('+')[0]!.replace(/^rtlde_/, '')
    if (!bestand[s.kennung]) neu++
    bestand[s.kennung] = {
      titleId,
      titel: s.titel,
      ...(s.folge ? { folge: s.folge } : {}),
      sender: SENDER[code] ?? code,
      start: s.start,
      ende: s.ende,
      gesehenAm: bestand[s.kennung]?.gesehenAm ?? heute,
    }
    log(`  ${SENDER[code] ?? code} ${s.start.slice(0, 16)} ${s.titel}${s.folge ? ` — ${s.folge}` : ''} → ${titleId}`)
  }
  /* 120 Tage reichen für jede Staffel; ältere Sendungen fallen heraus. */
  const grenze = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10)
  for (const [k, v] of Object.entries(bestand)) if (v.start.slice(0, 10) < grenze) delete bestand[k]

  log(`${neu} neue Anime-Sendungen, ${Object.keys(bestand).length} im Bestand.`)
  if (TROCKEN) return
  writeJson(DATEI, { geholtAm: new Date().toISOString(), sendungen: bestand })
  recordSource('tv-programm', sendungen.length)
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('pipeline/fetch-tv-programm.ts')) await main()
