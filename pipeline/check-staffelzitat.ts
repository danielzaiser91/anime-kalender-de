/**
 * Test zum Staffelzitat-Wächter (`lib/staffelzitat.ts`, `check-staffelzitat-bestand.ts`): Fälle aus dem echten Bestand (Wortlaut der Notizen und Zitate
 * aus `data/dub-confirmed.yaml`, 18.11.2026) und der Wächter als eigener Prozess gegen eine Wegwerf-Wurzel (`AK_ROOT`).
 * Aufruf: `tsx pipeline/check-staffelzitat.ts`
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { staffelzitatVerstoesse, veralteteBekannte } from './lib/staffelzitat.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const A2Y = (satz: string): string => `Anime2You 2026-03-26: ${satz} — https://www.anime2you.de/news/994767/aniverse-april-2026-neuzugaenge/`
// 115740 (By the Grace of the Gods) vor der Korrektur: „erste Staffel“ an einer Staffel-2-Adresse
const ZITAT_115740 = A2Y('Die erste Staffel von »By the Grace of the Gods« ist ab dem 23. April 2026 mit deutscher Synchronisation sowie im Originalton bei aniverse zu finden.')
const NOTE_115740 = 'Tonspuren: Deutsch, 日本語, English — Amazon-Seite B0CTLKK9LQ: alle 12 Folgen geprüft, Abos: FVOD, aniversede, Seitenadresse: B0CTLKK9LQ, laut Adresse Staffel 2, zugang=abo_und_kauf — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg'
// Clannad: After Story (4181): Zitat „zweite Staffel“; die Notiz „Staffel 1“ gehört zur Seitenadresse B0D956JD5Y, die Zeile liest B0CJQF3729
const ZITAT_CLANNAD = A2Y('Ab dem 21. Dezember 2023 ist die zweite Staffel der Drama-Serie »Clannad« mit deutscher und japanischer Vertonung bei aniverse verfügbar.')
const NOTE_CLANNAD_FREMD = 'Tonspuren: Deutsch, 日本語 — Amazon-Seite B0CJQF3729: alle 24 Folgen geprüft, Abos: animedigitalde, aniversede, Seitenadresse: B0D956JD5Y, laut Adresse Staffel 1, zugang=abo_und_kauf'
const NOTE_CLANNAD_EIGEN = 'Tonspuren: Deutsch, 日本語 — Amazon-Seite B0CJQF3729: alle 25 Folgen geprüft, Abos: animedigitalde, aniversede, laut Adresse Staffel 2, zugang=abo_und_kauf'
// Freezing (9367): Adresse B0CH9BW1PW zeigt 18 Folgen, AniList 12; Zitat „zweite Staffel“ (bekannter Fund)
const ZITAT_FREEZING = 'Anime2You 2024-10-30: Die zweite Staffel von »Freezing« sowie die dazugehörigen OVA-Episoden sind ab dem 14. November 2024 mit deutscher Synchronisation sowie im Originalton bei aniverse auf Abruf verfügbar. — https://www.anime2you.de/news/842289/aniverse-november-2024-neuzugaenge/'
const NOTE_FREEZING = 'Tonspuren: Deutsch, 日本語 — Amazon-Seite B0CH9BW1PW: alle 18 Folgen geprüft, Abos: aniversede, zugang=abo_und_kauf'
const url = (asin: string): string => `https://www.amazon.de/gp/video/detail/${asin}`
const folgen = new Map<number, number | null>([[115740, 12], [4181, 24], [7, 12]])

const rot = staffelzitatVerstoesse([{ anilistId: 115740, url: url('B0CTLKK9LQ'), note: NOTE_115740, zweiteQuelle: ZITAT_115740 }], folgen)
pruefe('115740 alt: „erste Staffel“ an Staffel-2-Adresse ist ein Verstoß', rot.length === 1 && rot[0].id === 115740 && rot[0].grund.includes('Adresse ist Staffel 2'), rot)

const clannad = staffelzitatVerstoesse(
  [
    { anilistId: 4181, url: url('B0CJQF3729'), note: NOTE_CLANNAD_FREMD, zweiteQuelle: ZITAT_CLANNAD },
    { anilistId: 4181, url: url('B0CJQF3729'), note: NOTE_CLANNAD_EIGEN, zweiteQuelle: ZITAT_CLANNAD },
  ],
  folgen,
)
pruefe('Clannad 4181: kein Fehlalarm (Staffel der Notiz gehört zur fremden Seitenadresse, Staffel-2-Zeile passt)', clannad.length === 0, clannad)

const ohneStaffel = staffelzitatVerstoesse([{ anilistId: 7, url: url('B0X'), note: 'laut Adresse Staffel 3', zweiteQuelle: A2Y('Der Film »X« ist auf Deutsch verfügbar.') }], folgen)
pruefe('Zitat ohne Staffel: kein Verstoß', ohneStaffel.length === 0, ohneStaffel)
const fremdeQuelle = staffelzitatVerstoesse([{ anilistId: 7, url: url('B0X'), note: 'laut Adresse Staffel 3', zweiteQuelle: 'Synchronkartei: erste Staffel' }], folgen)
pruefe('andere Quelle als Anime2You: nicht Sache des Wächters', fremdeQuelle.length === 0, fremdeQuelle)
const ohneZweite = staffelzitatVerstoesse([{ anilistId: 7, url: url('B0X'), note: 'laut Adresse Staffel 3' }], folgen)
pruefe('Zeile ohne zweiteQuelle: kein Verstoß', ohneZweite.length === 0, ohneZweite)
const folgenAbweichung = staffelzitatVerstoesse([{ anilistId: 7, url: url('B0X'), note: 'Amazon-Seite B0X: alle 18 Folgen geprüft', zweiteQuelle: A2Y('Die zweite Staffel läuft.') }], folgen)
pruefe('Staffel der Adresse unbekannt, aber 18 statt 12 Folgen: Verstoß', folgenAbweichung.length === 1, folgenAbweichung)
const unbekannt = staffelzitatVerstoesse([{ anilistId: 7, url: url('B0X'), note: 'Amazon-Seite B0X: alle 12 Folgen geprüft', zweiteQuelle: A2Y('Die zweite Staffel läuft.') }], folgen)
pruefe('Staffel der Adresse unbekannt, Folgenzahl passt: „unbekannt“ ist kein Verstoß', unbekannt.length === 0, unbekannt)
const adresseMitStaffelwort = staffelzitatVerstoesse(
  [{ anilistId: 7, url: url('B0X'), note: 'laut Adresse Staffel 3', zweiteQuelle: 'Anime2You 2026-03-26: Der Film »X« ist auf Deutsch verfügbar. — https://www.anime2you.de/news/1/zweite-staffel-x/' }],
  folgen,
)
pruefe('Staffelwort nur in der Adresse des Zitats: kein Verstoß', adresseMitStaffelwort.length === 0, adresseMitStaffelwort)
const nurSeitenadresse = staffelzitatVerstoesse(
  [{ anilistId: 7, url: url('B0X'), note: 'Folgen geprüft, Seitenadresse: B0Y, laut Adresse Staffel 1', zweiteQuelle: A2Y('Die zweite Staffel läuft.') }],
  folgen,
)
pruefe('Seitenadresse ohne Amazon-Seite: Staffel der Notiz gilt, Zitat Staffel 2 gegen Staffel 1 ist ein Verstoß', nurSeitenadresse.length === 1 && nurSeitenadresse[0].grund.includes('Adresse ist Staffel 1'), nurSeitenadresse)
const ohneTitel = staffelzitatVerstoesse([{ anilistId: 99, url: url('B0X'), note: 'Amazon-Seite B0X: alle 18 Folgen geprüft', zweiteQuelle: A2Y('Die zweite Staffel läuft.') }], folgen)
pruefe('Titel fehlt in der Folgenzahl-Liste: Folgenzahl-Regel stumm, kein Verstoß', ohneTitel.length === 0, ohneTitel)
const stale = veralteteBekannte([{ id: 9367, url: '', grund: '' }], new Set([9367, 5]))
pruefe('veralteteBekannte: nur die Kennung ohne Fund (5)', stale.length === 1 && stale[0] === 5, stale)
pruefe('veralteteBekannte: ohne Verstöße ist jeder Eintrag veraltet', veralteteBekannte([], new Set([9367, 5])).length === 2)

// Der Wächter als Prozess (Verdrahtung: Datei lesen, Urteil, Exit-Code, Marke)
const repo = fileURLToPath(new URL('..', import.meta.url))
const wurzel = mkdtempSync(join(tmpdir(), 'staffelzitat-'))
function lauf(eintraege: string): { status: number | null; ausgabe: string } {
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'data', 'dub-confirmed.yaml'), eintraege)
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify([{ id: 115740, episodes: 12 }, { id: 4181, episodes: 24 }, { id: 9367, episodes: 12 }]))
  const r = spawnSync(process.execPath, [join(repo, 'node_modules/tsx/dist/cli.mjs'), join(repo, 'pipeline/check-staffelzitat-bestand.ts')], {
    env: { ...process.env, AK_ROOT: wurzel },
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  return { status: r.status, ausgabe: `${r.stdout}${r.stderr}` }
}
const zeile = (id: number, asin: string, note: string, zitat: string): string =>
  `- anilistId: ${id}\n  platform: primevideo\n  url: ${url(asin)}\n  dub: true\n  note: ${JSON.stringify(note)}\n  zweiteQuelle: ${JSON.stringify(zitat)}\n`
try {
  const freezing = zeile(9367, 'B0CH9BW1PW', NOTE_FREEZING, ZITAT_FREEZING)
  const schlecht = lauf(zeile(115740, 'B0CTLKK9LQ', NOTE_115740, ZITAT_115740) + freezing)
  pruefe('Prozess, 115740 alt: Exit 1, Fehlerzeile, Marke, VERSTÖSSE: 1', schlecht.status === 1 && schlecht.ausgabe.includes('FEHLER: Staffelzitat 115740') && schlecht.ausgabe.includes('VERSTÖSSE: 1') && schlecht.ausgabe.includes('staffelzitat-bestand'), schlecht.ausgabe)
  const gut = lauf(zeile(4181, 'B0CJQF3729', NOTE_CLANNAD_FREMD, ZITAT_CLANNAD) + zeile(4181, 'B0CJQF3729', NOTE_CLANNAD_EIGEN, ZITAT_CLANNAD) + freezing)
  pruefe('Prozess, Clannad: Exit 0, 3 Zitate geprüft, VERSTÖSSE: 0', gut.status === 0 && gut.ausgabe.includes('3 Zitate geprüft, 0 Verstöße') && gut.ausgabe.includes('VERSTÖSSE: 0'), gut.ausgabe)
  const veraltet = lauf(zeile(4181, 'B0CJQF3729', NOTE_CLANNAD_EIGEN, ZITAT_CLANNAD))
  pruefe('Prozess, bekannter Eintrag 9367 ohne Fund: Exit 1, Fehlerzeile, VERSTÖSSE: 1', veraltet.status === 1 && veraltet.ausgabe.includes('STAFFELZITAT_BEKANNT enthält 9367 ohne Fund') && veraltet.ausgabe.includes('VERSTÖSSE: 1'), veraltet.ausgabe)
  const bekannt = lauf(freezing)
  pruefe('Prozess, Freezing 9367 (bekannter Fund): Exit 0, WARNUNG statt Fehler, kein Rot', bekannt.status === 0 && bekannt.ausgabe.includes('⚠ WARNUNG Staffelzitat 9367') && !bekannt.ausgabe.includes('FEHLER') && bekannt.ausgabe.includes('0 Verstöße, 1 bekannt'), bekannt.ausgabe)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`check-staffelzitat: ${verletzt} von ${faelle} Fällen verletzt`)
  process.exit(1)
}
console.log(`check-staffelzitat: ${faelle} Fälle grün (Zitat-Staffel gegen Adresse, Fremd-Seitenadresse, Folgenzahl, Prozess)`)
