/**
 * Zusicherungen zum Beleg „angekündigt“ einer Nicht-erschienen-Meldung (Wochenprogramm als Bild, 15.10.2026): welche Zeilen ein Bild brauchen,
 * welches Bild zu welchem ausgebliebenen Termin gehört, dass die Meldung beide Belege trägt (Wochenprogramm zuerst, dann Kalender) und
 * dass die tägliche Beleg-Lesung den Wanderartikel nicht überschreibt. Das Foto selbst prüft `check-woche-bild.ts`.
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-woche-beleg.ts`
 */
import { BELEG_SCHLUESSEL } from '../shared/beleg-schluessel.ts'
import type { Release } from '../shared/types.ts'
import type { VermerkMitAnkuendigung } from '../shared/woche-beleg-typ.ts'
import { verpasstAmTermin } from './bau/verpasst-am-termin.ts'
import { staerksteJeAnbieter } from './lib/beleg-anbieter.ts'
import { istArtikel } from './lib/beleg-lesung.ts'
import { verspaetungsMeldungen } from './lib/news-verspaetung.ts'
import { newsSatz } from '../web/src/lib/news-text.ts'
import { newsSatz as mailSatz } from '../worker/src/mail-abschnitte.ts'
import { terminFrist, terminZeitpunkt } from './lib/ausgeblieben.ts'
import { belegFuerTermin, belegeAnhaengen, bildSchluessel, fortschreiben, zeilenSchluessel, type WocheBelege } from './lib/woche-beleg.ts'
import type { WochenEintrag } from './scrape-crunchyroll-woche.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ARTIKEL = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/10/5/crunchyroll-wochenprogramm-herbst-2026'
const SERIE = 'GT00378123'
const zeile = (extra: Partial<WochenEintrag> = {}): WochenEintrag => ({ seriesId: SERIE, titel: 'Tomb Raider King', sprache: 'de', von: 12, bis: 12, datum: '2026-10-14', zeit: '19:20', abweichend: false, ...extra })
const MARKE: [number, number, number, number] = [0.1, 0.8, 0.2, 0.1]

console.log('\nWochenprogramm-Belege: welche Zeilen ein Bild brauchen')
{
  const r = fortschreiben({}, [zeile(), zeile({ sprache: 'ja', von: 13, bis: 13 }), zeile({ seriesId: null, titel: 'Ohne Kennung' })], ARTIKEL, '2026-10-15T12:00:00.000Z')
  const k = zeilenSchluessel(zeile())
  pruefe('neue deutsche Zeile: eingetragen mit erster Sichtung und offen', r.offen.join() === k && r.belege[k]?.erstmalsAm === '2026-10-15T12:00:00.000Z', r)
  pruefe('japanische Zeile und Zeile ohne Serienkennung zählen nicht', Object.keys(r.belege).length === 1)
  pruefe('dieselbe Zeile zweimal im Artikel: einmal offen, einmal fotografiert', fortschreiben({}, [zeile(), zeile()], ARTIKEL, '2026-10-15T12:00:00.000Z').offen.length === 1)
  const mitBild = { ...r.belege, [k]: { ...r.belege[k]!, bild: 'x.webp', bildAm: '2026-10-15T12:00:00.000Z' } }
  pruefe('Zeile mit Bild: nicht mehr offen, erste Sichtung bleibt', fortschreiben(mitBild, [zeile()], ARTIKEL, '2026-10-16T12:00:00.000Z').offen.length === 0 && fortschreiben(mitBild, [zeile()], ARTIKEL, '2026-10-16T12:00:00.000Z').belege[k]?.erstmalsAm === '2026-10-15T12:00:00.000Z')
  const vorgemerkt: WocheBelege = { [k]: { ...r.belege[k]!, erstmalsAm: '2026-10-12T11:04:14.990Z' } }
  const nachher = fortschreiben(vorgemerkt, [zeile()], ARTIKEL, '2026-10-15T12:00:00.000Z')
  pruefe('vorgemerkte Zeile ohne Bild (Tomb Raider King, gesehen 12.10.): offen, aber die erste Sichtung bleibt 12.10.', nachher.offen.join() === k && nachher.belege[k]?.erstmalsAm === '2026-10-12T11:04:14.990Z')
  const geaendert = fortschreiben(mitBild, [zeile({ zeit: '19:50' })], ARTIKEL, '2026-10-16T12:00:00.000Z')
  pruefe('geänderte Uhrzeit: neue Zeile mit neuem Bild, die alte bleibt', geaendert.offen.join() === zeilenSchluessel(zeile({ zeit: '19:50' })) && Boolean(geaendert.belege[k]?.bild), geaendert.offen)
  const alt = { [k]: { ...r.belege[k]!, datum: '2026-09-24' }, b: { ...r.belege[k]!, datum: '2026-09-25' } }
  const kulisse = fortschreiben(vorgemerkt, [zeile(), zeile({ von: 13, bis: 13, datum: '2026-10-21' })], ARTIKEL, '2026-10-15T12:00:00.000Z').belege
  pruefe('die fortgeschriebene Liste: jeder Schlüssel ist der der Zeile (die Vormerkung für Tomb Raider King F12 findet ihre Zeile wieder)', Object.entries(kulisse).every(([s, b]) => s === zeilenSchluessel(b)) && Object.keys(kulisse).length === 2 && Boolean(kulisse[k]), Object.keys(kulisse))
  pruefe('nach 21 Tagen fällt eine Zeile heraus, am 21. Tag nicht', Object.keys(fortschreiben(alt, [], ARTIKEL, '2026-10-16T12:00:00.000Z').belege).join() === 'b')
}

console.log('\nWochenprogramm-Belege: welches Bild zu welchem Termin gehört')
{
  const bel = (extra: object = {}) => ({ seriesId: SERIE, titel: 'Tomb Raider King', von: 12, bis: 12, datum: '2026-10-14', zeit: '19:20', artikel: ARTIKEL, erstmalsAm: '2026-10-12T11:04:14.990Z', bild: 'a.webp', bildAm: '2026-10-15T13:00:00.000Z', markierung: MARKE, ...extra })
  const t = { seriesId: SERIE, episode: 12, datum: '2026-10-14', erwartetAm: '2026-10-14T17:25:00.000Z' }
  const treffer = belegFuerTermin({ a: bel() }, t)
  pruefe('Serie, Tag und Folge passen: Artikel, erste Sichtung, Bild, Markierung', treffer?.url === ARTIKEL && treffer.gesehenAm === '2026-10-12T11:04:14.990Z' && treffer.bild === 'a.webp' && treffer.markierung === MARKE, treffer)
  pruefe('andere Serie, anderer Tag, andere Folge: kein Bild', !belegFuerTermin({ a: bel() }, { ...t, seriesId: 'GX' }) && !belegFuerTermin({ a: bel() }, { ...t, datum: '2026-10-21' }) && !belegFuerTermin({ a: bel() }, { ...t, episode: 13 }))
  pruefe('Zeile mit Folgenbereich 10–12 trägt Folge 11', belegFuerTermin({ a: bel({ von: 10, bis: 12 }) }, { ...t, episode: 11 })?.bild === 'a.webp' && !belegFuerTermin({ a: bel({ von: 10, bis: 12 }) }, { ...t, episode: 9 }))
  pruefe('ohne Bild kein Beleg; eine Zeile, die erst nach dem Termin gesehen wurde, belegt keine Ankündigung', !belegFuerTermin({ a: bel({ bild: undefined }) }, t) && !belegFuerTermin({ a: bel({ bildAm: undefined }) }, t) && !belegFuerTermin({ a: bel({ erstmalsAm: '2026-10-14T18:00:00.000Z' }) }, t))
  pruefe('mehrere Fassungen derselben Zeile: die jüngste vor dem Termin', belegFuerTermin({ a: bel({ zeit: '19:00', erstmalsAm: '2026-10-10T10:00:00.000Z', bild: 'alt.webp' }), b: bel({ bild: 'neu.webp' }) }, t)?.bild === 'neu.webp')
  const v = (extra: Partial<VermerkMitAnkuendigung & { slug: string; episode: number | null }> = {}) => ({ slug: 'tomb-raider-king', episode: 12 as number | null, erwartetAm: '2026-10-14T17:25:00.000Z', ...extra })
  const liste = [v(), v({ episode: null }), v({ slug: 'unbekannt' }), v({ erwartetAm: '2026-10-21T17:25:00.000Z' }), v({ wocheBeleg: { url: 'x', gesehenAm: 'y', bild: 'bleibt.webp', bildAm: 'z' } })]
  const n = belegeAnhaengen(liste, { a: bel() }, (slug) => (slug === 'tomb-raider-king' ? SERIE : undefined))
  pruefe('Vermerke: nur der ohne Bild, mit Folge und bekannter Serie bekommt es; ein vorhandenes bleibt', n === 1 && liste[0]!.wocheBeleg?.bild === 'a.webp' && !liste[1]!.wocheBeleg && !liste[2]!.wocheBeleg && liste[4]!.wocheBeleg?.bild === 'bleibt.webp' && !liste[3]!.wocheBeleg, liste)
  const zu = [v({ erschienenAm: '2026-10-20T17:25:00.000Z' })]
  pruefe('ein geschlossener Vermerk bekommt kein Bild mehr (seine Meldung ist geschrieben)', belegeAnhaengen(zu, { a: bel() }, () => SERIE) === 0 && !zu[0]!.wocheBeleg, zu[0])
  /* Der Offset folgt dem Datum: vor dem 25.10.2026 gilt +02:00, danach +01:00 — der Vermerk eines Termins um 00:30 muss zur Zeile seines Berliner Tages passen. */
  const winter = [v({ erwartetAm: terminZeitpunkt('2026-10-26', '00:30').toISOString() })]
  pruefe('Wintertermin 00:30 (MEZ) = 23:30 UTC am Vortag; sein Vermerk bekommt das Bild der Zeile vom 26.10.', winter[0]!.erwartetAm === '2026-10-25T23:30:00.000Z' && belegeAnhaengen(winter, { a: bel({ datum: '2026-10-26' }) }, () => SERIE) === 1, winter[0])
  const sommer = [v({ erwartetAm: terminZeitpunkt('2026-10-14', '00:30').toISOString() })]
  pruefe('Sommertermin 00:30 (MESZ) = 22:30 UTC am Vortag; sein Vermerk bekommt das Bild der Zeile vom 14.10.', sommer[0]!.erwartetAm === '2026-10-13T22:30:00.000Z' && belegeAnhaengen(sommer, { a: bel({ datum: '2026-10-14' }) }, () => SERIE) === 1, sommer[0])
  pruefe('Frist: Uhrzeit plus 15 Minuten, im Sommer 19:25 → 17:40 UTC, im Winter → 18:40 UTC', terminFrist('2026-10-14', '19:25').toISOString() === '2026-10-14T17:40:00.000Z' && terminFrist('2026-11-03', '19:25').toISOString() === '2026-11-03T18:40:00.000Z')
  pruefe('Frist ohne Uhrzeit: 23:59:59 Ortszeit, im Sommer 21:59:59 UTC, im Winter 22:59:59 UTC', terminFrist('2026-10-14').toISOString() === '2026-10-14T21:59:59.000Z' && terminFrist('2026-11-03').toISOString() === '2026-11-03T22:59:59.000Z')
  const nachts = [v({ erwartetAm: '2026-10-14T22:30:00.000Z' })]
  pruefe('der Tag des Vermerks ist der Berliner: 00:30 am 15.10. (22:30 UTC am 14.10.) gehört zur Zeile vom 15.10.', belegeAnhaengen(nachts, { a: bel({ datum: '2026-10-15' }) }, () => SERIE) === 1)
  const schluessel = bildSchluessel(bel() as never, '2026-10-15T13:00:12.345Z')
  pruefe('Ablageschlüssel entspricht der Regel des Workers', BELEG_SCHLUESSEL.test(schluessel) && schluessel.endsWith('.webp'), schluessel)
}

console.log('\nWochenprogramm-Belege: die Meldung')
{
  const wocheBeleg = { url: ARTIKEL, gesehenAm: '2026-10-12T11:04:14.990Z', bild: 'www.crunchyroll.com/wochenprogramm/gt00378123/2026-10-14-f12-x.webp', bildAm: '2026-10-15T13:00:00.000Z', markierung: MARKE }
  const vermerke = [{ slug: 'tomb-raider-king', episode: 12, erwartetAm: '2026-10-14T17:25:00.000Z', bemerktAm: '2026-10-14T18:02:41.716Z', messbeleg: { bild: 'www.crunchyroll.com/simulcastcalendar/2026-10-14/2026-10-14-18-02.jpg' }, wocheBeleg }]
  const verpasst = verpasstAmTermin('tomb-raider-king', vermerke)
  const release = { slug: 'tomb-raider-king', titleId: 1, name: 'Tomb Raider King', platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-07-29', episodeCount: 13, estimated: true, verpasst } } as unknown as Release
  const m = verspaetungsMeldungen(release).find((x) => x.art === 'verspaetet')
  pruefe('der Bau reicht das Bild an den Vermerk weiter', verpasst?.[12]?.wocheBeleg?.bild === wocheBeleg.bild, verpasst)
  pruefe('die Meldung trägt zwei Belege: Wochenprogramm (Vorher) zuerst, dann der Kalender (Nachher)', m?.belege?.length === 2 && m.belege[0]!.url === ARTIKEL && m.belege[1]!.url.includes('simulcastcalendar'), m?.belege)
  pruefe('der Wochenprogramm-Beleg hat Bild und Markierung („Zur Fundstelle“) und nennt erste Sichtung und Bild-Tag', m?.belege?.[0]?.name === 'Crunchyroll-Wochenprogramm' && m.belege[0].markierung === MARKE && m.belege[0].bild === wocheBeleg.bild && m.belege[0].erstGeprueftAm === '2026-10-12' && m.belege[0].bildAm === '2026-10-15', m?.belege?.[0])
  pruefe('der Kalender-Beleg behält sein Bild', m?.belege?.[1]?.bild === 'www.crunchyroll.com/simulcastcalendar/2026-10-14/2026-10-14-18-02.jpg')
  pruefe('beide Belege überstehen das Entdoppeln (Artikel und Kalender sind verschiedene Typen)', staerksteJeAnbieter(m!.belege!, ['tomb raider king']).behalten.length === 2)
  const ohne = verspaetungsMeldungen({ ...release, schedule: { ...release.schedule, verpasst: verpasstAmTermin('tomb-raider-king', [{ ...vermerke[0]!, wocheBeleg: undefined }]) } } as Release).find((x) => x.art === 'verspaetet')
  pruefe('ohne Foto der Ankündigung bleibt es bei einem Beleg (der Kalender)', ohne?.belege?.length === 1 && ohne.belege[0]!.url.includes('simulcastcalendar'), ohne?.belege)
  pruefe('die tägliche Beleg-Lesung liest den Wanderartikel nicht (sie überschriebe Datum und Bild des Belegs), andere Season-Artikel schon',
    !istArtikel(ARTIKEL) && istArtikel('https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-anime-lineup-herbst-2026'))
  pruefe('Wortwahl „Nicht erschienen“: mit Foto der Ankündigung „angekündigt“, sonst „erwartet“ — Seite und Mail gleich',
    newsSatz(m!) === 'Folge 12 war für den 14.10.2026 angekündigt und ist nicht erschienen' && mailSatz(m!) === 'Folge 12 war für den 14.10.2026 angekündigt und ist nicht erschienen' &&
    newsSatz(ohne!) === 'Folge 12 war für den 14.10.2026 erwartet und ist nicht erschienen' && mailSatz(ohne!) === 'Folge 12 war für den 14.10.2026 erwartet und ist nicht erschienen',
    [newsSatz(ohne!), mailSatz(ohne!)])
  const spaet = (mitFoto: boolean) => {
    const v = { ...vermerke[0]!, erschienenAm: '2026-10-15T17:25:00.000Z', wocheBeleg: mitFoto ? wocheBeleg : undefined }
    const rel = { ...release, schedule: { ...release.schedule, verpasst: verpasstAmTermin('tomb-raider-king', [v]) } } as Release
    return verspaetungsMeldungen(rel).find((x) => x.art === 'nachgereicht')!
  }
  pruefe('Wortwahl „Verspätet erschienen“: nur mit Foto der Ankündigung „angekündigt war“, sonst „erwartet war“',
    newsSatz(spaet(true)) === 'Folge 12 ist da, angekündigt war der 14.10.2026' && newsSatz(spaet(false)) === 'Folge 12 ist da, erwartet war der 14.10.2026',
    [newsSatz(spaet(true)), newsSatz(spaet(false))])
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
