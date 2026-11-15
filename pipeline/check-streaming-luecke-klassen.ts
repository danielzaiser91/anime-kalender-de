/**
 * Titel ohne Streaming-Weg nach Klassen: ein Titel je Klasse mit seinen Grenzfällen, Gegenprobe (Titel mit Stream zählt nicht, Summe = Titel ohne Weg)
 * und der Bestandswächter als Prozess gegen einen Wegwerf-Ordner (`AK_ROOT`). Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { klasseDerLuecke, lueckenKlassenZeile, zaehleLueckenKlassen, type LueckenQuellen, type TitelFuerKlasse } from './lib/streaming-luecke-klassen.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const abo = (anbieter: string, audio?: string[]) => ({ art: 'FLATRATE', anbieter, audio })
const t = (id: number, extra: Partial<TitelFuerKlasse> = {}): TitelFuerKlasse => ({ id, format: 'TV', episodes: 12, jpYear: 2010, ...extra })
const q: LueckenQuellen = {
  jw: {
    '900101': { tmdbId: 1, angebote: [abo('Netflix', ['de'])] },
    '900102': { tmdbId: 1, angebote: [abo('Netflix', ['de'])] },
    '900103': { tmdbId: 1, angebote: [abo('Netflix', ['ja']), abo('Amazon Channel X', ['de'])] },
    '900104': { tmdbId: 1, angebote: [abo('Amazon Channel X', ['de'])] },
    '900105': { tmdbId: 1, angebote: [abo('Amazon Channel X', ['de']), abo('Joyn', ['de'])] },
    '900107': { tmdbId: 1, angebote: [abo('Netflix', ['ja']), abo('Joyn')] },
    '900106': { tmdbId: 1, angebote: [{ art: 'FLATRATE', anbieter: 'JustWatch TV', audio: ['de'] }] },
    '900301': { tmdbId: 1, ohneTreffer: true },
    '900302': { tmdbId: 1, angebote: [] },
    '900303': { tmdbId: 1, angebote: [{ art: 'BUY', anbieter: 'Videobuster' }] },
    '900304': { tmdbId: 1, angebote: [{ art: 'BUY', anbieter: 'Videobuster' }, { art: 'FLATRATE', anbieter: 'JustWatch TV' }] },
    '900305': { tmdbId: 1, angebote: [{ art: 'FREE_TRIAL', anbieter: 'Irgendwer' }] },
    '900306': { tmdbId: 1, angebote: [{ art: 'CINEMA', anbieter: 'Kino' }] },
    '900309': { ohneTreffer: true },
    '900402': { tmdbId: 5 },
  },
  tmdb: { '900202': { tmdbId: 7 }, '900309': { tmdbId: 7 } },
  anisearch: {
    '900201': { streams: [{ provider: 'netflix' }] },
    '900202': { streams: [{ provider: 'netflix' }] },
    '900203': { streams: [{ provider: 'aniverse' }] },
    '900204': { streams: [{ provider: 'aniverse' }, { provider: 'netflix' }] },
    '900205': { streams: [{ provider: 'youtube' }] },
    '900206': { streams: [{ provider: 'youtube' }, { provider: 'aniverse' }] },
    '900207': { streams: [{ provider: 'youtube' }, { provider: 'crunchyroll' }] },
    '900208': { streams: [{ provider: 'netflix' }] },
  },
  verweiseEntfernt: new Set([900101, 900201]),
  kino: new Set([900401]),
}
const fall = (name: string, titel: TitelFuerKlasse, soll: string): void => pruefe(`${name} → ${soll}`, klasseDerLuecke(titel, q) === soll, klasseDerLuecke(titel, q))

console.log('Klassen:')
fall('JW-Abo, Handbeleg-Nein', t(900101), 'A1a')
fall('JW-Abo mit Ton de, nur Amazon-Channel', t(900104), 'A1b')
fall('JW-Abo mit Ton de, kein Kanal: Bau übernimmt ohne Grund nicht', t(900102), 'A1x')
fall('JW-Abo, kein Angebot mit Ton de', t(900107), 'A1c')
fall('Amazon Channel de plus Joyn: kein reiner Kanal', t(900105), 'A1x')
fall('nur JustWatch TV zählt nicht als Abo (Disc-Klasse C3)', t(900106), 'C3')
fall('aniSearch-Stream mit Handbeleg-Nein', t(900201), 'A3a')
fall('aniSearch-Stream Netflix', t(900208), 'A3b')
fall('aniSearch nur Aniverse', t(900203), 'A3c')
fall('aniSearch Aniverse plus Netflix: Dienst bekannt', t(900204), 'A3b')
fall('aniSearch nur YouTube', t(900205), 'A3d')
fall('aniSearch YouTube plus unbekannter Dienst', t(900206), 'A3c')
fall('aniSearch YouTube plus bekannter Dienst', t(900207), 'A3b')
fall('Ankündigung', t(900400, { ankuendigung: { platform: 'netflix', omuAb: '2027-01-01', synchro: 'offen', quellen: [], stand: '2026-11-15' } }), 'K')
fall('Kino-Fund', t(900401), 'K')
fall('JW-Angebot Kino', t(900306), 'K')
fall('Start 2026 ohne Ende', t(900403, { jpYear: 2026 }), 'K')
fall('Start 2026 mit Ende zählt nicht als Ankündigung', t(900404, { jpYear: 2026, jpEnd: '2026-06-30' }), 'B2')
fall('keine TMDB-Kennung, Film mit einer Folge', t(900405, { format: 'MOVIE', episodes: 1 }), 'B1')
fall('keine TMDB-Kennung, Film ohne Folgenzahl', t(900406, { format: 'OVA', episodes: undefined }), 'B1')
fall('keine TMDB-Kennung, Einzelwerk mit zwei Folgen', t(900407, { format: 'OVA', episodes: 2 }), 'B2')
fall('keine TMDB-Kennung, Serie', t(900408), 'B2')
fall('TMDB-Kennung nur im JW-Eintrag', t(900402), 'C2')
fall('aniSearch-Stream geht der TMDB-Prüfung vor', t(900202, { format: 'MOVIE', episodes: 1 }), 'A3b')
fall('JW ohne Treffer', t(900301), 'C1')
fall('JW ohne Treffer, aber TMDB in tmdb-titles', t(900309), 'C1')
fall('JW-Seite ohne Angebot', t(900302), 'C2')
fall('JW nur Videobuster', t(900303), 'C3')
fall('JW Videobuster plus JustWatch TV', t(900304), 'C3')
fall('JW Angebot unbekannter Art', t(900305), 'C4')

console.log('\nZählung:')
const n = zaehleLueckenKlassen([t(900101), t(900104), t(900301), t(900302), t(900302)], q)
pruefe('Anzahl je Klasse', n.A1a === 1 && n.A1b === 1 && n.C1 === 1 && n.C2 === 2 && n.C3 === 0, n)
pruefe('Summe der Klassen = übergebene Titel', Object.values(n).reduce((s, x) => s + x, 0) === 5, n)
pruefe('Zeile nennt nur belegte Klassen und die Summe', lueckenKlassenZeile(n) === 'Streaming-Lücke nach Klassen: A1a 1, A1b 1, C1 1, C2 2 (Summe 5)', lueckenKlassenZeile(n))
pruefe('keine Titel: Summe 0', lueckenKlassenZeile(zaehleLueckenKlassen([], q)) === 'Streaming-Lücke nach Klassen:  (Summe 0)', lueckenKlassenZeile(zaehleLueckenKlassen([], q)))

console.log('\nBestandswächter als Prozess (Gegenprobe: Titel mit Stream zählt nicht):')
const wurzel = mkdtempSync(join(tmpdir(), 'streaming-klassen-'))
try {
  mkdirSync(join(wurzel, 'data'))
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  const stream = { platform: 'netflix', url: 'https://www.netflix.com/title/1' }
  const titel = [
    { id: 900101, streams: [], watchLinks: [], format: 'TV', jpYear: 2010 },
    { id: 900301, streams: [], watchLinks: [], format: 'TV', jpYear: 2026 },
    { id: 900302, streams: [], watchLinks: [], format: 'TV', jpYear: 2010 },
    { id: 900303, streams: [stream], watchLinks: [], format: 'TV', jpYear: 2010 },
  ]
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titel))
  writeFileSync(join(wurzel, 'public', 'data', 'releases.json'), '[]')
  writeFileSync(join(wurzel, 'data', 'justwatch-audio.json'), JSON.stringify(q.jw))
  writeFileSync(join(wurzel, 'data', 'verweise-entfernt.json'), JSON.stringify({ verweise: [{ titleId: 900101 }] }))
  const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL('./check-streaming-luecke-bestand.ts', import.meta.url))], {
    cwd: wurzel,
    env: { ...process.env, AK_ROOT: wurzel },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
  })
  const aus = r.stdout + r.stderr
  pruefe('Prozess endet mit Exit 0 und Schlusszeile', r.status === 0 && /VERSTÖSSE: 0/.test(aus), aus)
  pruefe('Klassenzeile: A1a 1, C2 1, K 1 (Start 2026), Summe 3 = Titel ohne Streaming-Weg', /Streaming-Lücke nach Klassen: A1a 1, K 1, C2 1 \(Summe 3\)/.test(aus) && /ohne Streaming-Weg: 3,/.test(aus), aus)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} von ${faelle} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nStreaming-Lücke nach Klassen: ${faelle} Zusicherungen grün (alle Klassen, Grenzfälle, Summe, Wächter-Prozess).`)
