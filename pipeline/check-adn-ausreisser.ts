/**
 * Zusicherungen zu `lib/adn-ausreisser.ts` (09.11.2026, Demon Slave): Eine einzelne `vde`-Folge unter lauter `vostde` setzt keinen
 * ADN-Termin und kein `dub: true`. Die Auslöser stammen wörtlich aus dem Archiv (Stand 11.11.2026), eingefroren in
 * `fixtures/adn-ausreisser-archiv.json` (nur die nötigen Videos, damit eine Bereinigung bei ADN den Wächter nicht kippt):
 * Demon Slave 1125, GTO 307, One Piece 561 (Wano 1 von 208) sind Ausreißer; Dreamland 887 (3 von 4) und Dorohedoro 1375
 * (S2 alle 11, S1 keine) sind es nicht. Der Verdrahtungsteil lässt `ergaenzeAdnTitel` auf einer Kulisse im Temp-Ordner
 * (`AK_ROOT`) laufen, mit und ohne Archivdatei (aus dem Fixture geschrieben).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import type { Release, Title } from '../shared/types.ts'
import { vdeAusreisser, videoIdAusAdresse, ohneAusreisser, type AusreisserVideo } from './lib/adn-ausreisser.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const REPO = resolve(import.meta.dirname, '..')
const archiv = JSON.parse(readFileSync(join(REPO, 'pipeline', 'fixtures', 'adn-ausreisser-archiv.json'), 'utf8')) as Record<string, AusreisserVideo[]>
const videosVon = (id: number): AusreisserVideo[] => archiv[String(id)]

const video = (id: number, nummer: number, sprachen: string[], staffel = '1'): AusreisserVideo => ({ id, shortNumber: String(nummer), languages: sprachen, season: staffel })
const nein = ['vostde']
const ja = ['vostde', 'vde']

console.log('\nEingefrorene Archivfälle (Stand 11.11.2026)')
pruefe('Demon Slave: genau Video 24139 (S1F6)', [...vdeAusreisser(videosVon(1125))].join() === '24139', [...vdeAusreisser(videosVon(1125))])
pruefe('GTO: ein Ausreißer', vdeAusreisser(videosVon(307)).size === 1)
pruefe('One Piece: Wano-Folge 1088 ist Ausreißer, die vollständig deutsche Saga 7 nicht', vdeAusreisser(videosVon(561)).size === 1)
pruefe('Dreamland (3 von 4 deutsch, ab Folge 1): kein Ausreißer', vdeAusreisser(videosVon(887)).size === 0)
pruefe('Dorohedoro (S2 alle deutsch, S1 keine): kein Ausreißer', vdeAusreisser(videosVon(1375)).size === 0)

console.log('\nGrenzen (je Teilbedingung ein Fall, der nur sie trifft)')
const staffel = (...v: AusreisserVideo[]) => vdeAusreisser(v).size
pruefe('eine vde-Folge mitten unter drei vostde: Ausreißer', staffel(video(1, 1, nein), video(2, 2, nein), video(3, 3, ja), video(4, 4, nein)) === 1)
pruefe('nur zwei Folgen ohne vde: kein Ausreißer', staffel(video(1, 1, nein), video(2, 2, nein), video(3, 3, ja)) === 0)
pruefe('zwei vde-Folgen: kein Ausreißer', staffel(video(1, 1, nein), video(2, 2, nein), video(3, 3, ja), video(4, 4, ja), video(5, 5, nein)) === 0)
pruefe('Vertonung fängt vorn an (Folge 1 deutsch): kein Ausreißer', staffel(video(1, 1, ja), video(2, 2, nein), video(3, 3, nein), video(4, 4, nein)) === 0)
const lang = (anzahl: number) => [video(1, 1, ja), ...Array.from({ length: anzahl - 1 }, (_, i) => video(i + 2, i + 2, nein))]
pruefe('Staffel von genau 50 Folgen, deutsch ab Folge 1: kein Ausreißer', staffel(...lang(50)) === 0)
pruefe('Staffel von 51 Folgen, nur die erste deutsch: Ausreißer (One Piece Wano)', staffel(...lang(51)) === 1)
const franzoesisch = ['vostf', 'vf']
pruefe('Staffel mit französisch vertonten Folgen (One Piece Wano 11.11.2026) und einer vde-Folge: Ausreißer', staffel(video(1, 1, nein), video(2, 2, nein), video(3, 3, franzoesisch), video(4, 4, franzoesisch), video(5, 5, ja)) === 1)
pruefe('Folge ohne Sprachangabe in der Staffel: kein Urteil', staffel(video(1, 1, nein), video(2, 2, nein), video(3, 3, ja), video(4, 4, nein), video(5, 5, [])) === 0)
const ohneFeld = (id: number, nummer: number): AusreisserVideo => ({ id, shortNumber: String(nummer), season: '1' })
pruefe('Folge ganz ohne languages-Feld in der Staffel: kein Urteil', staffel(video(1, 1, nein), video(2, 2, nein), video(3, 3, ja), video(4, 4, nein), ohneFeld(5, 5)) === 0)
pruefe('drei Folgen ohne languages-Feld und eine vde-Folge: kein Urteil', staffel(ohneFeld(1, 1), ohneFeld(2, 2), ohneFeld(3, 3), video(4, 4, ja)) === 0)
pruefe('zweite Staffel zählt für sich', vdeAusreisser([video(1, 1, ja, '1'), video(2, 2, ja, '1'), video(3, 1, nein, '2'), video(4, 2, nein, '2'), video(5, 3, ja, '2'), video(6, 4, nein, '2')]).has(5))
const pv = (id: number, sprachen: string[]): AusreisserVideo => ({ ...video(id, id, sprachen), type: 'PV', number: 'Teaser' })
const mitPv = [pv(1, nein), pv(2, nein), pv(3, ja), pv(4, nein)]
pruefe('Vorschau-Videos (drei ohne, eines mit vde) sind kein Ausreißer', vdeAusreisser(mitPv).size === 0, [...vdeAusreisser(mitPv)])
const fixture = JSON.parse(readFileSync(join(REPO, 'extension', 'adn-ausreisser.fixture.json'), 'utf8')) as { erwartet: number[]; videos: AusreisserVideo[] }
pruefe('gemeinsames Fixture mit der Erweiterung: Staffel mit EPS und vde-OAV, Vorschau und NC', [...vdeAusreisser(fixture.videos)].sort().join() === fixture.erwartet.join(), [...vdeAusreisser(fixture.videos)])
pruefe('Videokennung aus der Adresse', videoIdAusAdresse('https://animationdigitalnetwork.com/de/video/1125-demon-slave/24139-folge-6') === 24139)
const serien = [{ showId: 1, episodes: [{ url: 'x/1-a/7-folge-1' }] }, { showId: 2, episodes: [{ url: 'x/2-b/8-folge-1' }, { url: 'x/2-b/9-folge-2' }] }]
const bereinigt = ohneAusreisser(serien, new Set([7, 9]))
pruefe('Serie, die damit leer wird, fällt heraus; die andere behält ihre übrige Folge', bereinigt.length === 1 && bereinigt[0].episodes.length === 1, bereinigt)

console.log('\nVerdrahtung im Bau (ergaenzeAdnTitel)')
/* ROOT wird beim ersten Import gelesen: eine Kulisse für beide Läufe, nur die Archivdatei kommt und geht. */
const wurzel = mkdtempSync(join(tmpdir(), 'adn-ausreisser-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'adn-raw'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
const katalog = JSON.parse(readFileSync(join(REPO, 'data', 'adn-catalog.json'), 'utf8'))
const demon = katalog.shows.find((s: { showId: number }) => s.showId === 1125)
writeFileSync(join(wurzel, 'data', 'adn-catalog.json'), JSON.stringify({ ...katalog, shows: [{ ...demon, title: 'Demon Slave Probe', anisearchId: undefined }] }))
const { ergaenzeAdnTitel } = await import('./bau/07-adn.ts')
const { normalizeTitle } = await import('./lib/crunchyroll.ts')
async function baue(mitArchiv: boolean) {
  const kopie = join(wurzel, 'data', 'adn-raw', '1125.json.gz')
  if (mitArchiv) writeFileSync(kopie, gzipSync(JSON.stringify({ videos: videosVon(1125) })))
  else rmSync(kopie, { force: true })
  const titel = { id: 900125, franchiseId: 900125, titleRomaji: 'Demon Slave Probe', titleEn: 'Demon Slave Probe', episodes: 12, keywords: [], genres: [], streams: [] } as unknown as Title
  const releases: Release[] = []
  ergaenzeAdnTitel({ titles: new Map([[titel.id, titel]]), releases, titleByName: new Map([[normalizeTitle('Demon Slave Probe'), titel]]), seenSlugs: new Set() })
  return { releases, titel }
}
const mit = await baue(true)
pruefe('mit Archiv: kein ADN-Termin', mit.releases.filter((r) => r.platform === 'adn').length === 0, mit.releases.length)
pruefe('mit Archiv: kein ADN-Weg mit dub: true', !mit.titel.streams.some((s) => s.platform === 'adn' && s.dub === true), mit.titel.streams)
const ohne = await baue(false)
pruefe('Kontrolle ohne Archiv: dieselbe Kulisse baut den Termin und den Weg', ohne.releases.some((r) => r.platform === 'adn') && ohne.titel.streams.some((s) => s.platform === 'adn' && s.dub === true), [ohne.releases.length, ohne.titel.streams])

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt` : '\nADN-Ausreißer: alle Zusicherungen erfüllt')
process.exit(fehler ? 1 : 0)
