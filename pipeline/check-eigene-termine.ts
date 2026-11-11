/**
 * **Prüfung: Termin je Anbieter aus der Handzeile** (`bau/eigene-termine.ts`, `data/eigene-titel.yaml`).
 * Ein Wegwerf-Ordner (`AK_ROOT`) trägt die Handdatei und einen Feed ohne den Artikel (der Artikel ist herausgefallen): der echte Bau-Schritt
 * `ergaenzeTermineAusNewsUndTv` muss trotzdem je Anbieter einen Termin liefern; steht ein Termin aus der Meldung schon da, bleibt er unberührt.
 *
 * Aufruf: npx tsx pipeline/check-eigene-termine.ts
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release } from '../shared/types.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'eigene-termine-'))
mkdirSync(join(wurzel, 'data', 'proposals'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]')
process.env.AK_ROOT = wurzel
const { ladeEigeneTitel } = await import('./bau/eigene-titel.ts')
const { termineAusEigenen } = await import('./bau/eigene-termine.ts')
const { ergaenzeTermineAusNewsUndTv } = await import('./bau/08-news-tv.ts')
const { zaehltAlsDeutscherTermin } = await import('./lib/news.ts')

let fehler = 0
let faelle = 0
const pruefe = (text: string, bedingung: boolean, detail?: unknown) => {
  faelle++
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}${bedingung || detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`)
  if (!bedingung) fehler++
}
const datei = (zeilen: string[]) => writeFileSync(join(wurzel, 'data', 'eigene-titel.yaml'), zeilen.join('\n'))
const zeile = (nr: number, name: string, format: string, anbieter: string, extra: string[] = []) => [
  `- nr: ${nr}`, `  name: ${name}`, `  format: ${format}`, `  anbieter: [${anbieter}]`, '  tag: 2999-01-02',
  '  sources: [https://example.org/artikel]', '  zitat: "Fixture-Zitat"', '  coverGrund: Fixture', ...extra,
]
const ID = 5_000_910

try {
  console.log('Termine aus der Zeile')
  datei([...zeile(910, 'Film Eins', 'MOVIE', 'joyn, primevideo', ['  geschaetzt: true', '  folgen: 5']), ...zeile(911, 'Serie Zwei', 'TV', 'joyn, primevideo', ['  folgen: 73', '  kanal: Aniverse'])])
  const zeilen = ladeEigeneTitel(wurzel)
  const neu = termineAusEigenen(zeilen, [])
  const film = neu.filter((r) => r.titleId === ID)
  const serie = neu.find((r) => r.titleId === ID + 1 && r.platform === 'primevideo')
  const serieJoyn = neu.find((r) => r.titleId === ID + 1 && r.platform === 'joyn')
  pruefe('je Anbieter ein Termin: Film und Serie je bei Joyn und Prime Video (4)', neu.length === 4 && film.map((r) => r.platform).join() === 'joyn,primevideo', neu.map((r) => r.platform))
  pruefe('Film (Zeile nennt folgen: 5): movie, Tag aus der Zeile, ≈ (geschaetzt), keine Folgenzahl, keine Uhrzeit', film.every((r) => r.releaseType === 'movie' && r.schedule.firstEpisodeDate === '2999-01-02' && r.schedule.estimated === true && r.schedule.episodeCount === undefined && !r.schedule.time), film[0])
  pruefe('Serie: batch mit 73 Folgen, Kanal Aniverse, nicht geschätzt', serie?.releaseType === 'batch' && serie.schedule.episodeCount === 73 && serie.kanal === 'Aniverse' && serie.schedule.estimated === undefined, serie)
  pruefe('Kanal nur bei Prime Video: Serie mit kanal trägt ihn bei Prime Video, ihr Joyn-Termin keinen', serieJoyn !== undefined && serieJoyn.kanal === undefined && serie?.kanal === 'Aniverse', serieJoyn)
  pruefe('Kanal nur bei Prime Video: Film bei Joyn trägt keinen', film.every((r) => r.kanal === undefined))
  pruefe('Alle Termine sind automatisch (Leser: news, joyn-block-wache, auto-release-pruefung)', neu.every((r) => r.automatisch === true))
  const kanalTermin = zaehltAlsDeutscherTermin(serie!, { streams: [] } as never)
  pruefe('Kanal-Termin ohne eigenes Ja zählt nicht als deutscher Start (news.ts, Regel 13.10.)', kanalTermin === false && zaehltAlsDeutscherTermin(serieJoyn!, { streams: [] } as never) === true, kanalTermin)
  pruefe('Quelle und Zitat stehen am Termin, Slug ohne Datum (auto-<Kennung>-<Anbieter>)', film[0]?.sources[0] === 'https://example.org/artikel' && film[0].herkunft?.includes('Fixture-Zitat') === true && film[0].slug === `auto-${ID}-joyn`, film[0])
  pruefe('Jahr aus dem Tag', film[0]?.year === 2999)

  console.log('Vorhandene Termine bleiben')
  const vorhanden = [{ titleId: ID, platform: 'joyn' }, { titleId: ID + 5, platform: 'primevideo' }] as Pick<Release, 'titleId' | 'platform'>[]
  const rest = termineAusEigenen(zeilen, vorhanden)
  pruefe('Film bei Joyn aus der Meldung: nur Prime Video kommt dazu; ein fremder Titel bei Prime Video zählt nicht', rest.map((r) => `${r.titleId}/${r.platform}`).join() === `${ID}/primevideo,${ID + 1}/joyn,${ID + 1}/primevideo`, rest.map((r) => r.platform))
  pruefe('Zwei Läufe hintereinander: der zweite liefert nichts Neues', termineAusEigenen(zeilen, [...vorhanden, ...rest]).length === 0)

  console.log('Ausnahmen')
  datei([...zeile(912, 'Weg', 'MOVIE', 'joyn', ['  widerrufen: Fixture, 2999-01-03']), ...zeile(913, 'Umgezogen', 'MOVIE', 'joyn', ['  zuId: 77']), ...zeile(914, 'Lebt', 'MOVIE', 'joyn')])
  const ausnahme = termineAusEigenen(ladeEigeneTitel(wurzel), [])
  pruefe('widerrufen und umgezogen (zuId) ergeben keinen Termin, die lebende Zeile einen', ausnahme.length === 1 && ausnahme[0]!.titleId === ID + 4, ausnahme.map((r) => r.titleId))
  datei([''])
  pruefe('leere Datei: keine Termine', termineAusEigenen(ladeEigeneTitel(wurzel), []).length === 0)

  console.log('Zeilenprüfung der neuen Felder')
  const wirft = (extra: string[], teil: string): boolean => {
    datei(zeile(910, 'A', 'TV', 'joyn', extra))
    try {
      ladeEigeneTitel(wurzel)
      return false
    } catch (e) {
      return String((e as Error).message).includes(teil)
    }
  }
  pruefe('folgen 0 bricht ab', wirft(['  folgen: 0'], 'folgen'))
  pruefe('folgen 1,5 bricht ab', wirft(['  folgen: 1.5'], 'folgen'))
  pruefe('kanal leer bricht ab', wirft(['  kanal: " "'], 'kanal'))
  pruefe('geschaetzt als Text bricht ab', wirft(['  geschaetzt: ja'], 'geschaetzt'))
  datei(zeile(910, 'A', 'TV', 'joyn', ['  folgen: 1']))
  pruefe('folgen 1 (kleinste Zahl) ist gültig', ladeEigeneTitel(wurzel)[0]?.folgen === 1)

  console.log('Bau-Schritt ergaenzeTermineAusNewsUndTv (Feed ohne den Artikel)')
  datei([...zeile(910, 'Film Eins', 'MOVIE', 'joyn, primevideo', ['  geschaetzt: true'])])
  writeFileSync(join(wurzel, 'data', 'proposals', 'anime2you.json'), JSON.stringify({ proposals: [] }))
  const titles = new Map([[ID, { id: ID, titleDe: 'Film Eins', format: 'MOVIE', streams: [] }]])
  const releases: Release[] = []
  const stumm = console.log
  console.log = () => undefined
  try {
    ergaenzeTermineAusNewsUndTv({ titles, releases } as never)
  } finally {
    console.log = stumm
  }
  pruefe('Bau ohne Artikel im Feed: Termin bei Joyn und Prime Video aus der Zeile', releases.map((r) => `${r.titleId}/${r.platform}`).sort().join() === `${ID}/joyn,${ID}/primevideo`, releases.map((r) => r.platform))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(fehler ? `\n${fehler} Fehler` : `\nEigene Termine: ${faelle} Fälle in Ordnung`)
process.exit(fehler ? 1 : 0)
