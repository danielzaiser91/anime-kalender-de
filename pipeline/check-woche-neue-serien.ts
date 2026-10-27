/**
 * Zusicherung (neue Serien aus dem Wochenprogramm, 27.10.2026): Seit ~21.10. liefert der Simulcast-Kalender nichts mehr
 * (umgeleitet auf /de/simulcasts), also legt niemand mehr Kalendereinträge an. Das Wochenprogramm legt sie jetzt an.
 * Die Zeilen sind wörtlich aus `data/crunchyroll-woche.json` (Lauf 27.10.2026 08:02 UTC): Die Tagebücher der Apothekerin
 * (G3KHEVDJ7) und A Wild Last Boss Appeared! Staffel 2 (GT00361955) standen dort als „ohne Kalendereintrag".
 *
 * Kein Netz: `AK_ROOT` zeigt auf einen Wegwerf-Ordner. Aufruf: `tsx pipeline/check-woche-neue-serien.ts`
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ordner = mkdtempSync(join(tmpdir(), 'woche-neue-serien-'))
mkdirSync(join(ordner, 'data'))
process.env.AK_ROOT = ordner
const { neueEintraege } = await import('./lib/woche-neue-eintraege.ts')
const { zeilenEntscheiden } = await import('./scrape-crunchyroll-woche.ts')
type Zeile = Parameters<typeof neueEintraege>[0][number]
type Kalender = Parameters<typeof neueEintraege>[1]

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const apothekerin = { seriesId: 'G3KHEVDJ7', titel: 'Die Tagebücher der Apothekerin (Staffel 3)', sprache: 'de', von: 2, bis: 2, zeit: '17:00', datum: '2026-10-30', abweichend: false }
const lastBoss = { seriesId: 'GT00361955', titel: 'A Wild Last Boss Appeared! Staffel 2', sprache: 'de', von: 3, bis: 3, zeit: '15:30', datum: '2026-10-31', abweichend: false }
const HEUTE = '2026-10-27'
const keys = (z: Zeile[], k: Kalender = {}, heute = HEUTE) => Object.keys(neueEintraege(z, k, heute).neu)
const grund = (z: Zeile[], k: Kalender = {}) => neueEintraege(z, k, HEUTE).verworfen.map((v) => v.grund)

// Reine Regel
const zwei = neueEintraege([apothekerin, lastBoss], {}, HEUTE)
pruefe('beide echten Zeilen legen je einen Eintrag an', Object.keys(zwei.neu).length === 2 && zwei.verworfen.length === 0, zwei)
const a = zwei.neu[Object.keys(zwei.neu)[0]!]!
pruefe('Eintrag trägt Zeit, Wochentag (Freitag = 4), Kennung und Adresse', a.time === '17:00' && a.weekday === 4 && a.seriesId === 'G3KHEVDJ7' && a.seriesUrl === 'https://www.crunchyroll.com/de/series/G3KHEVDJ7', a)
pruefe('Beobachtung ist als Wochenprogramm gekennzeichnet, nicht als gemessen', JSON.stringify(a.observations) === '[{"date":"2026-10-30","episode":2,"quelle":"woche"}]', a.observations)
pruefe('frühester Termin trägt Datum und Folge', JSON.stringify(a.earliest) === '{"date":"2026-10-30","episode":2}', a.earliest)
pruefe('Wochentag der zweiten Serie (Samstag = 5)', zwei.neu[Object.keys(zwei.neu)[1]!]!.weekday === 5)
pruefe('Folgen 10-12 an einem Tag: drei Beobachtungen', neueEintraege([{ ...lastBoss, von: 10, bis: 12 }], {}, HEUTE).neu[keys([lastBoss])[0]!]!.observations!.map((o) => o.episode).join() === '10,11,12')
pruefe('Untertitel-Zeile legt nichts an', keys([{ ...lastBoss, sprache: 'ja' }]).length === 0)
pruefe('Zeile von gestern legt nichts an', keys([lastBoss], {}, '2026-11-01').length === 0)
pruefe('Zeile von heute legt an (Grenze genau heute)', keys([{ ...lastBoss, datum: HEUTE }]).length === 1)
pruefe('ohne Kennung: verworfen und gezählt', grund([{ ...lastBoss, seriesId: null }]).join() === 'ohne Serienkennung', grund([{ ...lastBoss, seriesId: null }]))
pruefe('ohne Uhrzeit: verworfen und gezählt', grund([{ ...lastBoss, zeit: null }]).join() === 'ohne Uhrzeit')
const bekannt = { 'wild last boss s2': { time: '15:30', weekday: 5, dates: [], rawTitle: 'x', seriesId: 'GT00361955' } } as Kalender
pruefe('Kennung unter anderem Namen schon geführt: kein zweiter Eintrag', keys([lastBoss], bekannt).length === 0 && grund([lastBoss], bekannt).length === 1)
pruefe('gleicher Schlüssel schon geführt: nichts anlegen, nichts verwerfen', keys([lastBoss], { [keys([lastBoss])[0]!]: bekannt['wild last boss s2']! }).length === 0 && grund([lastBoss], { [keys([lastBoss])[0]!]: bekannt['wild last boss s2']! }).length === 0)
const zweiStaffeln = [lastBoss, { ...lastBoss, titel: 'A Wild Last Boss Appeared! Staffel 3', von: 1, bis: 1 }]
pruefe('Mehrstaffel: gleiche neue Kennung unter zweitem Namen wird nicht doppelt angelegt', keys(zweiStaffeln).length === 1 && grund(zweiStaffeln).length === 1)
const zweiTage = neueEintraege([{ ...lastBoss, von: 4, bis: 4, datum: '2026-11-07' }, lastBoss], {}, HEUTE).neu[keys([lastBoss])[0]!]!
pruefe('zwei Zeilen derselben neuen Serie, späterer Tag zuerst: ein Eintrag, Tage aufsteigend, früheste Folge als Beginn', zweiTage.dates.join() === '2026-10-31,2026-11-07' && zweiTage.observations!.length === 2 && JSON.stringify(zweiTage.earliest) === '{"date":"2026-10-31","episode":3}', zweiTage)
const zweiMalGleich = neueEintraege([lastBoss, { ...lastBoss, von: 4, bis: 4 }], {}, HEUTE).neu[keys([lastBoss])[0]!]!
pruefe('zwei Zeilen am selben Tag: der Tag steht einmal, beide Folgen beobachtet', zweiMalGleich.dates.join() === '2026-10-31' && zweiMalGleich.observations!.length === 2, zweiMalGleich)

// Lauf: Datei im Wegwerf-Ordner, Kreislauf Woche 1 → Woche 2
const datei = join(ordner, 'data', 'crunchyroll.json')
const fremd = { 'alt s1': { time: '10:00', weekday: 0, dates: ['2026-10-12'], rawTitle: 'Alt Staffel 1 (Deutsch)', seriesId: 'GALT00000', observations: [{ date: '2026-10-12', episode: 1 }] } }
const anfang = { scrapedAt: '2026-10-21T20:02:22.931Z', window: { from: '2026-10-12', to: '2026-10-21' }, german: fremd, slots: [{ key: 'alt s1' }] }
writeFileSync(datei, JSON.stringify(anfang, null, 2))
const lies = () => JSON.parse(readFileSync(datei, 'utf8')) as typeof anfang & { german: Record<string, { observations?: { episode?: number; date: string }[] }> }
const woche1 = zeilenEntscheiden([apothekerin as never, lastBoss as never], HEUTE)
const nach1 = lies()
pruefe('Lauf: zwei Einträge angelegt, der fremde bleibt byte-gleich', Object.keys(nach1.german).length === 3 && JSON.stringify(nach1.german['alt s1']) === JSON.stringify(fremd['alt s1']), Object.keys(nach1.german))
pruefe('Lauf: scrapedAt, Fenster und Slots unverändert', nach1.scrapedAt === anfang.scrapedAt && JSON.stringify(nach1.window) === JSON.stringify(anfang.window) && JSON.stringify(nach1.slots) === JSON.stringify(anfang.slots))
pruefe('Lauf: neue Serien gelten nicht mehr als „ohne Kalendereintrag"', woche1.ohneEintrag.length === 0 && woche1.uebernommen.length === 0 && woche1.abweichungen.length === 0, woche1)
const vorher = readFileSync(datei, 'utf8')
zeilenEntscheiden([apothekerin as never, lastBoss as never], HEUTE)
pruefe('zweiter Lauf: Datei unverändert', readFileSync(datei, 'utf8') === vorher)
const naechste = { ...apothekerin, von: 3, bis: 3, datum: '2026-11-06' }
const woche2 = zeilenEntscheiden([naechste as never], '2026-11-02')
pruefe('nächste Woche: Folge 3 schließt an Folge 2 an und wird übernommen', woche2.uebernommen.length === 1 && woche2.uebernommen[0]!.episode === 3 && woche2.abweichungen.length === 0, woche2)
const luecke = zeilenEntscheiden([{ ...apothekerin, von: 5, bis: 5, datum: '2026-11-13' } as never], '2026-11-09')
pruefe('Folge 5 nach Folge 2 ist eine Abweichung, nichts wird übernommen', luecke.uebernommen.length === 0 && luecke.abweichungen.length === 1, luecke)

// Der ganze Artikel-Weg (was `main()` aufruft): Überschrift und Zeilen wie rohLesen sie liefert
writeFileSync(datei, JSON.stringify(anfang, null, 2))
const roh = {
  ueberschrift: 'Crunchyrolls aktuelles Wochenprogramm vom 26.10. bis 1.11.',
  jahr: '2026',
  eintraege: [
    { tag: 'Freitag', seriesUrl: 'https://www.crunchyroll.com/de/series/G3KHEVDJ7/the-apothecary-diaries', titel: apothekerin.titel, zeilen: [{ flagge: 'https://x/deutschland-flagge.png', text: 'Folge 2\n17:00 Uhr' }, { flagge: 'https://x/japan-flag.png', text: 'Folge 2\n17:00 Uhr' }] },
  ],
}
const { artikelAuswerten } = await import('./scrape-crunchyroll-woche.ts')
const artikel = await artikelAuswerten(roh as never, 'https://example.invalid/artikel', HEUTE)
pruefe('Artikel-Weg: Wochenprogramm geschrieben, Serie im Kalenderbestand, kein „ohne Kalendereintrag"', artikel.programm.ohneEintrag.length === 0 && Object.keys(lies().german).length === 2 && artikel.eintraege.length === 2, artikel.programm)
const woche = JSON.parse(readFileSync(join(ordner, 'data', 'crunchyroll-woche.json'), 'utf8')) as { wocheAb: string }
pruefe('Artikel-Weg: Woche ab 26.10. gelesen', woche.wocheAb === '2026-10-26', woche.wocheAb)

// Prüfer 2170 R1: Die Marke „Kalender reicht bis" (Bau Phase 04) darf durch neue Einträge nicht in die Zukunft rücken.
const { indiziereCrSendeplaetze } = await import('./bau/04-cr-sendeplaetze.ts')
const bau = indiziereCrSendeplaetze({ titles: new Map() })
const spaetesterTermin = Object.values(lies().german).flatMap((e) => (e as { dates?: string[] }).dates ?? []).sort().at(-1)
pruefe('Bau: neue Serie führt einen Termin nach dem gelesenen Stand (30.10.)', spaetesterTermin === '2026-10-30', spaetesterTermin)
pruefe('Bau: Kalendermarke bleibt auf dem gelesenen Stand 21.10.', bau.crKalenderBis === '2026-10-21', bau.crKalenderBis)
writeFileSync(datei, JSON.stringify({ ...anfang, window: { from: '2026-10-12', to: '2026-10-12' } }, null, 2))
pruefe('Bau: Termine bis zum Fensterende zählen (Grenze genau am Fenster)', indiziereCrSendeplaetze({ titles: new Map() }).crKalenderBis === '2026-10-12')
writeFileSync(datei, JSON.stringify({ ...anfang, window: { from: '2026-10-12', to: '2026-11-01' } }, null, 2))
pruefe('Bau: Fenster weiter als der letzte Termin: der letzte Termin gilt', indiziereCrSendeplaetze({ titles: new Map() }).crKalenderBis === '2026-10-12')
writeFileSync(datei, JSON.stringify({ ...anfang, window: undefined }, null, 2))
pruefe('Bau: ohne Fenster gilt der letzte Termin', indiziereCrSendeplaetze({ titles: new Map() }).crKalenderBis === '2026-10-12')

rmSync(ordner, { recursive: true, force: true })
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('check-woche-neue-serien: alle Fälle grün (Regel 16, Lauf 6, Artikel-Weg 2, Bau-Marke 5)')
