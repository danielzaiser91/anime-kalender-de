/**
 * Zusicherung: **kündigt eine Plattform mehr Folgen an, als die Datenbank für Japan kennt, sagen Panel und Kachel dasselbe**
 * (18.10.2026, „Though I Am an Inept Villainess": AniList 11, Wochenplan Folge 12 — das Panel zeigte „11 von 11" neben
 * „Finale Folge (Folge 12)", die Kachel war nicht breit). Die Ankündigung gilt als Annahme: Gesamtzahl „≈ 12", kein „Finale".
 * Läuft in `check:logic`.
 */
import type { Release, ReleaseEvent, Title } from '../shared/types.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { folgenKopf } from '../web/src/components/detail/antwort-block.ts'
import { angekuendigteLaenge, gesamtGeschaetzt } from '../web/src/components/detail/antwort-regeln.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const t = (key: string, params?: Record<string, string | number>): string => (params ? `${key}${JSON.stringify(params)}` : key)
const HEUTE = '2026-10-18'
/* 14:00 UTC = 16:00 Berlin: Folge 12 (17:45) steht noch aus. */
const JETZT = new Date('2026-10-18T14:00:00Z')

const titel = (episodes: number | undefined): Title => ({ id: 1, format: 'TV', episodes, jpYear: 2026, streams: [] }) as unknown as Title
const plan = (slug: string, anzahl: number, angenommen: boolean): Release =>
  ({
    slug,
    titleId: 1,
    name: 'Plan',
    platform: 'crunchyroll',
    platformUrl: 'https://www.crunchyroll.com/de/series/X',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-08-02', time: '17:45', episodeCount: anzahl, episodeCountAssumed: angenommen || undefined },
    sources: [],
  }) as unknown as Release

function laeuft(title: Title, releases: Release[]) {
  const a = berechneAntwort({ title, releases, today: HEUTE, jetzt: JETZT })
  return a?.art === 'laeuft' ? { gesamt: a.gesamt, geschaetzt: a.gesamtGeschaetzt, kopf: folgenKopf(a, t) } : undefined
}

const ueber = laeuft(titel(11), [plan('a', 12, true)])
pruefe('Ankündigung über der Datenbankzahl: Gesamtzahl 12, geschätzt', ueber?.gesamt === 12 && ueber.geschaetzt === true, JSON.stringify(ueber))
pruefe('… und die Überschrift sagt nicht „Finale"', ueber?.kopf === 'antwort.naechsteFolgeNr{"n":12}', JSON.stringify(ueber))

const gleich = laeuft(titel(12), [plan('a', 12, true)])
pruefe('Datenbankzahl deckt die Annahme: nicht geschätzt, Finale bleibt', gleich?.gesamt === 12 && gleich.geschaetzt === false && gleich.kopf === 'antwort.finaleFolgeNr{"n":12}', JSON.stringify(gleich))

const belegt = laeuft(titel(11), [plan('a', 12, false)])
pruefe('Belegte Zahl (nicht angenommen): Datenbankzahl bleibt, nicht geschätzt', belegt?.gesamt === 11 && belegt.geschaetzt === false, JSON.stringify(belegt))

const ohneZahl = laeuft(titel(undefined), [plan('a', 12, true)])
pruefe('Ohne Datenbankzahl: geschätzt wie bisher, Gesamtzahl aus den Terminen', ohneZahl?.geschaetzt === true && ohneZahl.kopf === 'antwort.naechsteFolgeNr{"n":12}', JSON.stringify(ohneZahl))

const ohneZahlBelegt = laeuft(titel(undefined), [plan('a', 12, false)])
pruefe('Ohne Datenbankzahl, Folgenzahl belegt: nicht geschätzt', ohneZahlBelegt?.geschaetzt === false, JSON.stringify(ohneZahlBelegt))

/* Das Release des Termins entscheidet, nicht das erste oder letzte der Liste. */
const termin = { releaseSlug: 'b' } as ReleaseEvent
const mitte = [plan('a', 14, true), plan('b', 12, false), plan('c', 14, true)]
const mitteAngenommen = [plan('a', 11, false), plan('b', 12, true), plan('c', 11, false)]
pruefe('Termin gehört zu einem belegten Release: nicht geschätzt', gesamtGeschaetzt(titel(11), mitte, termin) === false)
pruefe('Termin gehört zu einem angenommenen Release: geschätzt', gesamtGeschaetzt(titel(11), mitteAngenommen, termin) === true)

/* Auswahl: größte Annahme in der Mitte der Liste; kleinere, gleiche und belegte zählen nicht. */
const liste = [plan('a', 11, true), plan('b', 14, false), plan('c', 13, true), plan('d', 12, true), plan('e', 10, true)]
pruefe('Längste angekündigte Folge gewinnt, belegte zählt nicht', angekuendigteLaenge(titel(11), liste) === 13, String(angekuendigteLaenge(titel(11), liste)))
pruefe('Nichts über der Datenbankzahl: 0', angekuendigteLaenge(titel(13), liste) === 0)
pruefe('Ohne Datenbankzahl: 0', angekuendigteLaenge(titel(undefined), liste) === 0)
const versetzt = { ...plan('f', 12, true), schedule: { ...plan('f', 12, true).schedule, firstEpisodeNumber: 3 } } as Release
pruefe('Startnummer zählt mit (3 + 12 − 1)', angekuendigteLaenge(titel(11), [versetzt]) === 14, String(angekuendigteLaenge(titel(11), [versetzt])))

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('Folge über Titelzahl: alle Prüfungen bestanden')
