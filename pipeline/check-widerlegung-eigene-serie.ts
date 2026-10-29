/**
 * Zusicherung (29.10.2026): Der Katalog schlägt das Nur-OmU des Wochenprogramms auch für einen Neustart mit eigener
 * Crunchyroll-Serie, dessen Reihe ältere Titel führt. Anlass: Magic Knight Rayearth (2026), Reihe mit Titeln von 1994 bis 1998,
 * Katalog „Staffel 1“ der neuen Serie GT00383994; die Reihe zählte Staffel 3, die deutsche Folge 1 wurde widerlegt.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-widerlegung-eigene-serie.ts`
 */
import type { Release, Title } from '../shared/types.ts'
import { deutscheFolgenTage, sammleWiderlegungen } from './bau/widerlegung-woche.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const NEU = 'https://www.crunchyroll.com/de/series/GT00383994/magic-knight-rayearth-2026'
const ALT = 'https://www.crunchyroll.com/de/series/GALT00001/old'
const stream = (url: string) => ({ platform: 'crunchyroll', url, dub: true })
const titel = (id: number, jpYear: number, name: string, url?: string) =>
  ({ id, franchiseId: 900070, format: 'TV', titleEn: name, jpYear, episodes: 12, streams: url ? [stream(url)] : [] }) as unknown as Title
/** `urlAlt`: auch der ältere Titel hängt an der Crunchyroll-Serie (eine Serie mit mehreren Staffeln). */
function reihe(urlAlt?: string): Map<number, Title> {
  const t = [
    titel(900070, 1994, 'Magic Knight Rayearth', urlAlt),
    titel(900071, 1995, 'Magic Knight Rayearth II'),
    titel(900072, 2026, 'Magic Knight Rayearth (2026)', NEU),
  ]
  return new Map(t.map((x) => [x.id, x]))
}

const release = { slug: 'rayearth-crunchyroll-de-2026-10-28', titleId: 900072, platform: 'crunchyroll', platformUrl: NEU, schedule: { firstEpisodeDate: '2026-10-28' } } as unknown as Release
const woche = { wocheAb: '2026-10-26', eintraege: [{ seriesId: 'GT00383994', titel: 'Magic Knight Rayearth', sprache: 'ja', datum: '2026-10-28' }] }
const katalog = (staffel: string) =>
  deutscheFolgenTage({ folgen: [{ serieId: 'GT00383994', serie: 'Magic Knight Rayearth (2026)', staffel, verfuegbarAb: '2026-10-28T15:15:00.000Z' }] })

console.log('\nWiderlegung: Neustart mit eigener Crunchyroll-Serie:')
{
  const frei = sammleWiderlegungen([release], reihe(), woche, {}, katalog('Staffel 1'))
  pruefe('eigene Serie, Reihe mit älteren Titeln, Katalog „Staffel 1“: Folge 1 bleibt', frei.anzahl === 0 && frei.gedaechtnis[release.slug] === undefined, frei)
  const ohneKatalog = sammleWiderlegungen([release], reihe(), woche, {}, new Set())
  pruefe('ohne deutsche Katalogfolge bleibt das Nur-OmU eine Widerlegung', ohneKatalog.anzahl === 1 && ohneKatalog.gedaechtnis[release.slug] !== undefined, ohneKatalog)
  const alteWiderlegung = { [release.slug]: { am: '2026-10-28', grund: 'x', gemeldet: true } }
  const aufgehoben = sammleWiderlegungen([release], reihe(), { wocheAb: '2026-11-02', eintraege: [] }, alteWiderlegung, katalog('Staffel 1'))
  pruefe('eine gemerkte Widerlegung fällt, sobald der Katalog die Folge führt', aufgehoben.gedaechtnis[release.slug] === undefined, aufgehoben)
  const staffel2 = sammleWiderlegungen([release], reihe(), woche, {}, katalog('Staffel 2'))
  pruefe('eigene Serie in Reihe-Staffel 3, Katalog „Staffel 2“: bleibt widerlegt, nichts geraten', staffel2.anzahl === 1, staffel2)
  /* Trapped S2: Staffel 1 liegt an einer anderen Serie, die Reihe zählt 2 wie der Katalog. */
  const zweiTitel = new Map([titel(900070, 2025, 'Reihe'), titel(900072, 2026, 'Reihe Season 2', NEU)].map((x) => [x.id, x]))
  const trapped = sammleWiderlegungen([release], zweiTitel, woche, {}, katalog('Staffel 2'))
  pruefe('Reihe-Staffel 2 gleich Katalog „Staffel 2“: Folge bleibt wie bisher', trapped.anzahl === 0, trapped)
  const anderer = deutscheFolgenTage({ folgen: [{ serieId: 'GANDERE', staffel: 'Staffel 1', verfuegbarAb: '2026-10-28T15:15:00.000Z' }] })
  const fremdeSerie = sammleWiderlegungen([release], reihe(), woche, {}, anderer)
  pruefe('deutsche Folge einer anderen Serie am selben Tag hebt nichts auf', fremdeSerie.anzahl === 1, fremdeSerie)
  const andererTag = deutscheFolgenTage({ folgen: [{ serieId: 'GT00383994', staffel: 'Staffel 1', verfuegbarAb: '2026-10-21T15:15:00.000Z' }] })
  const fruehererTag = sammleWiderlegungen([release], reihe(), woche, {}, andererTag)
  pruefe('deutsche Folge derselben Serie an einem anderen Tag hebt nichts auf', fruehererTag.anzahl === 1, fruehererTag)
  /* Hängt der Titel selbst nicht an der Serie (Weg noch nicht gesetzt), gilt die Staffel der Reihe, nicht „jede“. */
  const ohneWeg = reihe()
  ohneWeg.get(900072)!.streams = []
  const ohneWegZwei = sammleWiderlegungen([release], ohneWeg, woche, {}, katalog('Staffel 2'))
  pruefe('Titel ohne eigenen Weg, Katalog „Staffel 2“ gegen Reihenstaffel 3: bleibt widerlegt', ohneWegZwei.anzahl === 1, ohneWegZwei)
  const ohneWegEins = sammleWiderlegungen([release], ohneWeg, woche, {}, katalog('Staffel 1'))
  pruefe('Titel ohne eigenen Weg, Katalog „Staffel 1“ gegen Reihenstaffel 3: bleibt widerlegt', ohneWegEins.anzahl === 1, ohneWegEins)
  const allein = new Map([[900080, { ...ohneWeg.get(900072)!, id: 900080, franchiseId: 900080 }]])
  const alleinEins = sammleWiderlegungen([{ ...release, titleId: 900080 }], allein, woche, {}, katalog('Staffel 1'))
  pruefe('Titel allein in seiner Reihe ohne Weg: Katalog „Staffel 1“ hebt auf', alleinEins.anzahl === 0, alleinEins)
  const alleinZwei = sammleWiderlegungen([{ ...release, titleId: 900080 }], allein, woche, {}, katalog('Staffel 2'))
  pruefe('Titel allein in seiner Reihe ohne Weg: Katalog „Staffel 2“ bleibt widerlegt', alleinZwei.anzahl === 1, alleinZwei)
  /* Gegenprobe: hängt auch der ältere Titel an derselben Serie, zählt weiter die Staffel der Reihe (3), nicht „1“. */
  const geteilt = reihe(NEU)
  const gleicheSerie = sammleWiderlegungen([release], geteilt, woche, {}, katalog('Staffel 1'))
  pruefe('geteilte Serie: „Staffel 1“ des Katalogs gehört dem älteren Titel, Staffel 3 bleibt widerlegt', gleicheSerie.anzahl === 1, gleicheSerie)
  const dritte = sammleWiderlegungen([release], geteilt, woche, {}, katalog('Staffel 3'))
  pruefe('geteilte Serie: Katalog „Staffel 3“ hebt die Widerlegung auf', dritte.anzahl === 0, dritte)
  const andereSerie = sammleWiderlegungen([release], reihe(ALT), woche, {}, katalog('Staffel 1'))
  pruefe('älterer Titel an einer anderen Serie: wie eigene Serie, Folge bleibt', andereSerie.anzahl === 0, andereSerie)
}

if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\nWiderlegung eigene Serie: alle Prüfungen bestanden')
