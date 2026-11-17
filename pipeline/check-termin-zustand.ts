/**
 * Umbau „Zustand eines Termins“ (15.11.2026): `istErschienen` ruft `terminZustand` auf und darf sein Ergebnis nicht ändern.
 * Referenz ist die alte Fassung, wörtlich als Kopie; sie läuft gegen ein Raster aus Terminen, Uhren und Schaltern.
 * Dazu die Stufentabelle `shared/ausbleiben-plan.ts` (Takt, Wortstufen, Fälligkeit) mit festen Zahlen und Grenzen.
 * Läuft in `check:logic`. Die Uhr steht fest, die Systemuhr spielt keine Rolle.
 */
import { istAusgeblieben, istErschienen, istKatalogstartOhneUhrzeit } from '../shared/logic.ts'
import { terminZustand, type TerminFelder } from '../shared/termin-zustand.ts'
import { berlinToUtc } from '../shared/time.ts'
import {
  faelligeArten,
  naechstePruefung,
  pruefungFaellig,
  RECHERCHE_AB_MS,
  RECHERCHE_BIS_MS,
  RECHERCHE_SPAET_AB_MS,
  RECHERCHE_TAKT_FRUEH_MS,
  RECHERCHE_TAKT_SPAET_MS,
  AUSBLEIBEN_NACH_MS,
  STUFEN,
  taktFuer,
  wortStufe,
} from '../shared/ausbleiben-plan.ts'
import { abgleichFaellig, hinweiseAnhaengen, terminFrist } from './lib/ausgeblieben.ts'
import * as altRecherche from '../shared/recherche-plan.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

/** Die Fassung von `istErschienen` vor dem Umbau (shared/logic.ts, Stand 5bd708a86). */
function istErschienenAlt(e: TerminFelder, jetzt: Date, katalogAmTagesbeginn: boolean): boolean {
  if (istAusgeblieben(e) || e.nachLuecke) return false
  const grenze = e.time ?? (katalogAmTagesbeginn && istKatalogstartOhneUhrzeit(e) ? '00:00' : '23:59')
  return berlinToUtc(e.date, grenze).getTime() <= jetzt.getTime()
}

const MIN = 6e4
const H = 36e5
const T = 24 * H

// Raster: Tag/Zeit/Art/Vermerke/Lücke gegen Uhren rund um die Grenze (Berlin im November UTC+1, im Sommer UTC+2).
const tage = ['2026-03-28', '2026-03-29', '2026-07-01', '2026-10-25', '2026-11-15']
const zeiten = [undefined, '00:00', '15:00', '23:59']
const arten = [{}, { releaseType: 'batch' }, { releaseType: 'batch', platform: 'tv' }, { releaseType: 'weekly', platform: 'crunchyroll' }]
const vermerke = [undefined, {}, { erschienenAm: '2026-11-15' }]
let raster = 0
for (const date of tage) {
  for (const time of zeiten) {
    for (const art of arten) {
      for (const verpasst of vermerke) {
        for (const nachLuecke of [false, true]) {
          const e: TerminFelder = { date, time, ...art, verpasst, nachLuecke }
          const mitte = berlinToUtc(date, time ?? '23:59').getTime()
          for (const versatz of [-T, -MIN, -1, 0, 1, MIN, T]) {
            for (const katalog of [true, false]) {
              const jetzt = new Date(mitte + versatz)
              raster++
              pruefe('istErschienen wie vorher', istErschienen(e, jetzt, katalog) === istErschienenAlt(e, jetzt, katalog), JSON.stringify({ e, jetzt, katalog }))
            }
          }
        }
      }
    }
  }
}
pruefe('Raster hat Umfang', raster === 5 * 4 * 4 * 3 * 2 * 7 * 2, String(raster))

// Zustände: eine Zeile je Zweig.
const slot = { date: '2026-11-15', time: '15:00' }
const vor = new Date('2026-11-15T13:59:59Z')
const genau = new Date('2026-11-15T14:00:00Z')
const nach = new Date('2026-11-15T14:19:00Z')
pruefe('zukünftig: angekündigt', terminZustand(slot, vor) === 'angekuendigt')
pruefe('genau zur Zeit: erschienen', terminZustand(slot, genau) === 'erschienen')
pruefe('ohne Sichtung vorher: angekündigt', terminZustand({ ...slot, ohneSichtung: true }, vor) === 'angekuendigt')
pruefe('ohne Sichtung genau zur Zeit: fällig', terminZustand({ ...slot, ohneSichtung: true }, genau) === 'faellig')
pruefe('ohne Sichtung später: fällig', terminZustand({ ...slot, ohneSichtung: true }, nach) === 'faellig')
pruefe('ohne Sichtung genau 24 h danach: noch fällig', terminZustand({ ...slot, ohneSichtung: true }, new Date('2026-11-16T14:00:00Z')) === 'faellig')
pruefe('ohne Sichtung 24 h und 1 ms danach: erschienen (Deckel)', terminZustand({ ...slot, ohneSichtung: true }, new Date('2026-11-16T14:00:00.001Z')) === 'erschienen')
pruefe('fällig ist nicht erschienen', !istErschienen({ ...slot, ohneSichtung: true }, nach))
pruefe('Vermerk schlägt fällig', terminZustand({ ...slot, ohneSichtung: true, verpasst: {} }, nach) === 'ausgeblieben')
pruefe('nachgeholt, ohne Sichtung: fällig', terminZustand({ ...slot, ohneSichtung: true, verpasst: { erschienenAm: '2026-11-15' } }, nach) === 'faellig')
pruefe('hinter Lücke: angekündigt', terminZustand({ ...slot, nachLuecke: true }, nach) === 'angekuendigt')
pruefe('ohne Uhrzeit, am Tag: angekündigt', terminZustand({ date: '2026-11-15' }, nach) === 'angekuendigt')
pruefe('Katalogstart ohne Uhrzeit ab 00:00', terminZustand({ date: '2026-11-15', releaseType: 'batch' }, new Date('2026-11-14T23:00:00Z')) === 'erschienen')
pruefe('Katalogstart im Push erst 23:59', terminZustand({ date: '2026-11-15', releaseType: 'batch' }, new Date('2026-11-14T23:00:00Z'), false) === 'angekuendigt')

// Stufentabelle: feste Werte, Grenzen genau, eins davor, eins danach.
const stufen: [number, number | null][] = [
  [-1, null], [0, 5 * MIN], [15 * MIN - 1, 5 * MIN], [15 * MIN, 15 * MIN], [H - 1, 15 * MIN], [H, 30 * MIN],
  [2 * H - 1, 30 * MIN], [2 * H, H], [T - 1, H], [T, 2 * H], [2 * T - 1, 2 * H], [2 * T, T], [60 * T - 1, T], [60 * T, null],
]
for (const [abstand, takt] of stufen) pruefe(`Sichtung Takt bei ${abstand}`, taktFuer('sichtung', abstand) === takt, String(taktFuer('sichtung', abstand)))
const rech: [number, number | null][] = [
  [6 * H - 1, null], [6 * H, 20 * H], [14 * T - 1, 20 * H], [14 * T, 6.5 * T], [60 * T - 1, 6.5 * T], [60 * T, null],
]
for (const [abstand, takt] of rech) pruefe(`Recherche Takt bei ${abstand}`, taktFuer('recherche', abstand) === takt)

// Die Tabellen selbst: lückenlos und mit festen Zahlen (eine Zeile mit falscher Grenze würde `taktFuer` nur durch die Reihenfolge verdecken).
const tabelle = (art: 'sichtung' | 'recherche') => STUFEN[art].map((s) => [s.vonMs, s.bisMs, s.taktMs].join(':')).join(' ')
pruefe('Tabelle Sichtung', tabelle('sichtung') === [`0:${15 * MIN}:${5 * MIN}`, `${15 * MIN}:${H}:${15 * MIN}`, `${H}:${2 * H}:${30 * MIN}`, `${2 * H}:${T}:${H}`, `${T}:${2 * T}:${2 * H}`, `${2 * T}:${60 * T}:${T}`].join(' '), tabelle('sichtung'))
pruefe('Tabelle Recherche', tabelle('recherche') === [`${6 * H}:${14 * T}:${20 * H}`, `${14 * T}:${60 * T}:${6.5 * T}`].join(' '), tabelle('recherche'))

// Wortstufen.
const worte: [number, string][] = [[0, 'wird-geprueft'], [5 * MIN - 1, 'wird-geprueft'], [5 * MIN, 'verspaetet'], [2 * H - 1, 'verspaetet'], [2 * H, 'verspaetet'], [T, 'verspaetet']]
for (const [abstand, wort] of worte) pruefe(`Wortstufe bei ${abstand}`, wortStufe(abstand) === wort)

// Fälligkeit und nächste Prüfung (Termin = 0).
pruefe('ohne frühere Prüfung sofort fällig', pruefungFaellig('sichtung', 0, undefined, 0))
pruefe('vor dem Termin nie fällig', !pruefungFaellig('sichtung', 0, undefined, -1))
pruefe('Takt 5 min: nach 4:59 nicht fällig', !pruefungFaellig('sichtung', 0, 0, 5 * MIN - 1))
pruefe('Takt 5 min: nach 5:00 fällig', pruefungFaellig('sichtung', 0, 0, 5 * MIN))
pruefe('Takt 15 min bei 20 min Abstand', !pruefungFaellig('sichtung', 0, 10 * MIN, 24 * MIN) && pruefungFaellig('sichtung', 0, 10 * MIN, 25 * MIN))
pruefe('Recherche vor 6 h nie fällig', !pruefungFaellig('recherche', 0, undefined, 6 * H - 1))
pruefe('Recherche ab 6 h fällig', pruefungFaellig('recherche', 0, undefined, 6 * H))
pruefe('naechstePruefung ohne Letzte', naechstePruefung('sichtung', 100 * MIN, undefined, 90 * MIN) === 100 * MIN)
pruefe('naechstePruefung nie in der Vergangenheit', naechstePruefung('sichtung', 0, undefined, 7 * MIN) === 7 * MIN)
pruefe('naechstePruefung Letzte + Takt', naechstePruefung('sichtung', 0, 20 * MIN, 21 * MIN) === 35 * MIN)
pruefe('naechstePruefung Recherche: Letzte vor dem Beginn zählt den ersten Takt', naechstePruefung('recherche', 0, H, 0) === 21 * H)
pruefe('naechstePruefung Recherche: ohne Letzte erst ab 6 h', naechstePruefung('recherche', 0, undefined, 0) === 6 * H)
pruefe('naechstePruefung: Letzte hinter der letzten Stufe: keine', naechstePruefung('sichtung', 0, 61 * T, 61 * T) === null)
pruefe('naechstePruefung nach der letzten Stufe: keine', naechstePruefung('sichtung', 0, undefined, 60 * T) === null)
const gemeinsam = faelligeArten(0, { sichtung: 6 * H - 10 * MIN }, 6 * H)
pruefe('faelligeArten: Sichtung nicht, Recherche und Abgleich ja', gemeinsam.join() === 'recherche,abgleich-anime2you', gemeinsam.join())
pruefe('faelligeArten: nur Sichtung in den ersten Minuten', faelligeArten(0, {}, 6 * MIN).join() === 'sichtung')
pruefe('faelligeArten: Termin in der Zukunft: keine Art', faelligeArten(0, {}, -1).length === 0)
pruefe('faelligeArten: Abgleich ab 15 min, davor nicht', faelligeArten(0, {}, AUSBLEIBEN_NACH_MS - 1).join() === 'sichtung' && faelligeArten(0, {}, AUSBLEIBEN_NACH_MS).join() === 'sichtung,abgleich-anime2you')
pruefe('faelligeArten: Abgleich bei jedem Lauf, auch direkt nach dem letzten', faelligeArten(0, { 'abgleich-anime2you': 20 * MIN }, 20 * MIN).includes('abgleich-anime2you'))
pruefe('faelligeArten: Abgleich ohne Altersgrenze (61 Tage)', faelligeArten(0, {}, 61 * T).join() === 'abgleich-anime2you')
pruefe('faelligeArten: Recherche vor 60 Tagen ja, ab 60 Tagen nein', faelligeArten(0, {}, 60 * T - 1).includes('recherche') && !faelligeArten(0, {}, 60 * T).includes('recherche'))
// Kulisse für das Gate in termine-pruefen.ts: derselbe Vorschlag, ein Vermerk jünger, einer älter als 15 min.
const vorschlag = { articleTitle: 'Testserie Eins pausiert', articleUrl: 'https://a2y.example/1', publishedAt: '2026-11-15T10:00:00Z', category: 'streaming', platforms: ['crunchyroll'], pause: 'Pause' }
const neuerVermerk = () => ({ erwartetAm: '2026-11-15T14:00:00Z', platform: 'crunchyroll' as string, hinweise: undefined as { quelle: string; titel: string; url: string; datum: string }[] | undefined })
const jung = neuerVermerk()
const alt = neuerVermerk()
pruefe('hinweiseAnhaengen: jünger als 15 min kein Hinweis', hinweiseAnhaengen(jung, [vorschlag], ['Testserie Eins'], new Date('2026-11-15T14:14:59Z')) === 0 && !jung.hinweise)
pruefe('hinweiseAnhaengen: ab 15 min ein Hinweis', hinweiseAnhaengen(alt, [vorschlag], ['Testserie Eins'], new Date('2026-11-15T14:15:00Z')) === 1 && alt.hinweise?.[0]?.url === vorschlag.articleUrl)
pruefe('hinweiseAnhaengen: bekannte URL nicht doppelt', hinweiseAnhaengen(alt, [vorschlag], ['Testserie Eins'], new Date('2026-11-16T14:00:00Z')) === 0 && alt.hinweise?.length === 1)
pruefe('hinweiseAnhaengen: ungültiges erwartetAm ergibt keinen Hinweis und keinen Absturz', hinweiseAnhaengen({ ...neuerVermerk(), erwartetAm: 'x' }, [vorschlag], ['Testserie Eins'], new Date('2026-11-16T14:00:00Z')) === 0)
pruefe('AUSBLEIBEN_NACH_MS', AUSBLEIBEN_NACH_MS === 15 * MIN)
pruefe('abgleichFaellig: ab 15 min, ohne Altersgrenze', !abgleichFaellig('2026-11-15T14:00:00Z', new Date('2026-11-15T14:14:59Z')) && abgleichFaellig('2026-11-15T14:00:00Z', new Date('2026-11-15T14:15:00Z')) && abgleichFaellig('2026-11-15T14:00:00Z', new Date('2027-02-01T00:00:00Z')))
pruefe('terminFrist: Uhrzeit + 15 min, ohne Uhrzeit Tagesschluss', terminFrist('2026-11-15', '20:00').toISOString() === '2026-11-15T19:15:00.000Z' && terminFrist('2026-11-15').toISOString() === '2026-11-15T22:59:59.000Z')
pruefe('Tabelle Abgleich', STUFEN['abgleich-anime2you'].map((x) => [x.vonMs, x.bisMs, x.taktMs].join(':')).join(' ') === `${15 * MIN}:Infinity:0`)

// Recherche-Konstanten: feste Zahlen, und das alte Modul liefert dieselben Werte.
pruefe('RECHERCHE_AB_MS', RECHERCHE_AB_MS === 21600000)
pruefe('RECHERCHE_TAKT_FRUEH_MS', RECHERCHE_TAKT_FRUEH_MS === 72000000)
pruefe('RECHERCHE_TAKT_SPAET_MS', RECHERCHE_TAKT_SPAET_MS === 561600000)
pruefe('RECHERCHE_SPAET_AB_MS', RECHERCHE_SPAET_AB_MS === 1209600000)
pruefe('RECHERCHE_BIS_MS', RECHERCHE_BIS_MS === 5184000000)
pruefe('recherche-plan liefert dieselben Konstanten', altRecherche.RECHERCHE_AB_MS === RECHERCHE_AB_MS && altRecherche.RECHERCHE_TAKT_FRUEH_MS === RECHERCHE_TAKT_FRUEH_MS && altRecherche.RECHERCHE_TAKT_SPAET_MS === RECHERCHE_TAKT_SPAET_MS && altRecherche.RECHERCHE_SPAET_AB_MS === RECHERCHE_SPAET_AB_MS && altRecherche.RECHERCHE_BIS_MS === RECHERCHE_BIS_MS)
const vermerk = { erwartetAm: '2026-11-15T14:00:00Z' }
// Grenzen über rechercheFaellig (Lauf): Die Grenze selbst gehört zur neuen Stufe (halboffen, wie die Tabelle).
const ab = (ms: number) => new Date(Date.parse(vermerk.erwartetAm) + ms)
const lt = (ms: number) => ab(ms).toISOString()
pruefe('rechercheFaellig ab 6 h', altRecherche.rechercheFaellig(vermerk, ab(6 * H)))
pruefe('rechercheFaellig bei 14 d: spät, 6 d nach der Letzten nicht', !altRecherche.rechercheFaellig({ ...vermerk, rechercheAm: lt(8 * T) }, ab(14 * T)))
pruefe('rechercheFaellig bei 14 d - 1 ms: früh, 6 d nach der Letzten ja', altRecherche.rechercheFaellig({ ...vermerk, rechercheAm: lt(8 * T) }, ab(14 * T - 1)))
pruefe('rechercheFaellig bei 60 d - 1 ms ja, bei 60 d nein', altRecherche.rechercheFaellig(vermerk, ab(60 * T - 1)) && !altRecherche.rechercheFaellig(vermerk, ab(60 * T)))
pruefe('rechercheFaellig erschienen nie', !altRecherche.rechercheFaellig({ ...vermerk, erschienenAm: '2026-11-16' }, ab(7 * T)))
pruefe('rechercheFaellig ungültiges Datum nie', !altRecherche.rechercheFaellig({ erwartetAm: 'x' }, ab(7 * T)))
pruefe('rechercheFaellig vor 6 h nein', !altRecherche.rechercheFaellig(vermerk, new Date('2026-11-15T19:59:59Z')))
pruefe('naechsteRecherche: nächster Tageslauf 11:17 UTC', altRecherche.naechsteRecherche(vermerk, new Date('2026-11-15T20:00:00Z'))?.toISOString() === '2026-11-16T11:17:00.000Z')
pruefe('naechsteRecherche: frühestens 6 h nach dem Termin, Lauf am Folgetag', altRecherche.naechsteRecherche(vermerk, new Date('2026-11-15T10:00:00Z'))?.toISOString() === '2026-11-16T11:17:00.000Z')
pruefe('naechsteRecherche: Lauf noch am selben Tag', altRecherche.naechsteRecherche({ erwartetAm: '2026-11-14T02:00:00Z' }, new Date('2026-11-15T10:00:00Z'))?.toISOString() === '2026-11-15T11:17:00.000Z')
pruefe('rechercheFaellig ab 6 h ja', altRecherche.rechercheFaellig(vermerk, new Date('2026-11-15T20:00:00Z')))

console.log(`check-termin-zustand: ${faelle} Fälle (Raster ${raster}), ${fehler} Fehler`)
if (fehler) process.exit(1)
