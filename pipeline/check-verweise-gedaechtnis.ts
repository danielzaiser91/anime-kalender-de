/**
 * Zusicherung: Das Gedächtnis `data/verweise-entfernt.json` ist idempotent (11.10.2026). Princess Principal Kapitel 3/4 hatten ein
 * titelgebundenes Nein an der Serienadresse, die Kapitel 1/2 tragen; der Bau schrieb den Eintrag abwechselnd hinein und heraus.
 * Läuft in `check:logic`.
 */
import { neuerStand, uebernommeneVerweise } from './bau/verweise-gedaechtnis.ts'
import type { EntfernterVerweis } from './bau/grundlagen.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`)
}

const URL = 'https://www.crunchyroll.com/de/series/GEXH3W414/princess-principal'
const eintrag = (titleId: number, grund: string): EntfernterVerweis => ({
  titleId,
  titel: 'x',
  plattform: 'crunchyroll',
  url: URL,
  seriesId: null,
  grund,
  geprueftAm: null,
  entferntAm: '2026-10-11',
  letzterWeg: false,
})
const NEIN = 'belegtes Nein: dort gibt es keine deutsche Tonspur'
const GRENZE = '2026-09-13'
// Kapitel 1 (id 1) trägt die Adresse, Kapitel 3 (id 3) nicht mehr: sie wurde als belegtes Nein entfernt.
const titel = [{ id: 1, streams: [{ url: URL }] }, { id: 3, streams: [] }]

const kap3 = eintrag(3, NEIN)
pruefe('titelgebundenes Nein bleibt, obwohl ein Geschwister die Adresse trägt', uebernommeneVerweise([kap3], [], titel, GRENZE).length === 1)
pruefe('es wird nicht doppelt geschrieben, wenn der Lauf es selbst entfernt hat', uebernommeneVerweise([kap3], [kap3], titel, GRENZE).length === 0)
pruefe('titelgebundenes Nein fällt weg, wenn der Titel die Adresse selbst trägt', uebernommeneVerweise([kap3], [], [{ id: 3, streams: [{ url: URL }] }], GRENZE).length === 0)
const adresse = eintrag(3, 'die Adresse ist tot')
pruefe('adressgebundener Eintrag fällt weg, sobald irgendein Titel die Adresse trägt', uebernommeneVerweise([adresse], [], titel, GRENZE).length === 0)
pruefe('abgelaufene Frist fällt weg', uebernommeneVerweise([{ ...kap3, entferntAm: '2026-08-01' }], [], titel, GRENZE).length === 0)

// Zwei Bauten auf demselben Stand: der zweite sieht den Eintrag im Gedächtnis statt neu entfernt zu werden.
const bau1 = [kap3]
const bau2 = uebernommeneVerweise(bau1, [], titel, GRENZE)
pruefe('zweiter Bau ergibt dieselben Verweise wie der erste', JSON.stringify(bau1) === JSON.stringify(bau2))
pruefe('Zeitstempel bleibt bei gleichen Verweisen', neuerStand({ stand: 'A', verweise: bau1 }, bau2) === 'A')
pruefe('Zeitstempel erneuert sich bei anderen Verweisen', neuerStand({ stand: 'A', verweise: bau1 }, []) !== 'A')

if (fehler > 0) process.exit(1)
console.log('check-verweise-gedaechtnis: ok')
