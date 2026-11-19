/**
 * Zusicherungen zu `seiteFremd()` und `titelseitenKennung()` (`lib/meldung-seite.ts`): Eine Meldung, deren Seite eine Titelseite mit
 * fremder Kennung ist, bleibt liegen (Landei II, 19.11.2026). Die Verdrahtung in `fetch-pruefungen.ts` prüft
 * `check-fetch-pruefungen-seite.ts`. Läuft in `check:logic`.
 */
import { seiteFremd, titelseitenKennung, zaehleSeiteFremd } from './lib/meldung-seite.ts'
import type { OhneZuordnung } from './lib/meldungen-liste.ts'

let fehler = 0
let faelle = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  faelle++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) {
    fehler++
    console.error(`FEHLER ${text}: ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`)
  }
}

const UUID_A = '0e5f4b5c-0d6e-4f3a-9c1e-2a3b4c5d6e7f'
const UUID_B = '1f6a5c6d-1e7f-4a4b-8d2f-3b4c5d6e7f80'
pruefe('Netflix /title/', titelseitenKennung('https://www.netflix.com/title/81000001'), 'netflix:81000001')
pruefe('Netflix /watch/ (Player) ist keine Titelseite', titelseitenKennung('https://www.netflix.com/watch/81234567'), undefined)
pruefe('Netflix Startseite', titelseitenKennung('https://www.netflix.com/browse'), undefined)
pruefe('ADN mit Sprachpfad', titelseitenKennung('https://animationdigitalnetwork.com/de/video/1140-x'), 'adn:1140')
pruefe('ADN ohne Sprachpfad', titelseitenKennung('https://animationdigitalnetwork.com/video/1140-x'), 'adn:1140')
pruefe('ADN Startseite', titelseitenKennung('https://animationdigitalnetwork.com/de'), undefined)
pruefe('Disney+ entity', titelseitenKennung(`https://www.disneyplus.com/de-de/browse/entity-${UUID_A.toUpperCase()}`), `disney:${UUID_A}`)
pruefe('Disney+ series/slug trägt keine Kennung', titelseitenKennung('https://www.disneyplus.com/de-de/series/bleach/6g48QKlgQdWK'), undefined)
pruefe('Prime wird nicht beurteilt (dp)', titelseitenKennung('https://www.amazon.de/dp/B0ABC12345'), undefined)
pruefe('Prime wird nicht beurteilt (gti)', titelseitenKennung('https://watch.amazon.de/detail?gti=amzn1.dv.gti.f094ed7f-41c0-4692-99d8-ae469c2ad935'), undefined)

type Z = { id: number; url: string; plattform: string; befund: string; serientitel: string | null; titel: string | null; seiten_adresse?: string | null }
const meldung = (id: number, url: string, seite: string | null | undefined, plattform = 'netflix'): Z => ({ id, url, plattform, befund: 'weg', serientitel: 'Landei II', titel: null, seiten_adresse: seite })
const T = [
  { id: 1, streams: [{ url: 'https://www.netflix.com/title/81000001' }, { url: 'https://animationdigitalnetwork.com/de/video/1140-x' }] },
  { id: 2, streams: [{ url: 'https://www.netflix.com/title/81000002' }] },
  { id: 3, streams: [{ url: `https://www.disneyplus.com/browse/entity-${UUID_A}` }] },
]
function lauf(gruppe: Z[], ids: number[]) {
  const warnungen: string[] = []
  const liste: OhneZuordnung[] = []
  const halt = seiteFremd(gruppe, ids, T, warnungen, liste)
  return { halt, warnungen, liste }
}
const NF1 = 'https://www.netflix.com/title/81000001'

const fremd = lauf([meldung(1, NF1, 'https://www.netflix.com/title/81000002')], [1])
pruefe('fremde Titelseite: bleibt liegen', fremd.halt, true)
pruefe('… eine Warnung mit Meldungsadresse, Seite und „bleibt liegen“', fremd.warnungen.length === 1 && fremd.warnungen[0]!.startsWith(`${NF1} — Seite der Meldung gehört nicht zum Titel (Seite 81000002`) && fremd.warnungen[0]!.endsWith('Meldung bleibt liegen'), true)
pruefe('… ein Eintrag in der Liste mit Titel-ID und Aufgabe', fremd.liste.length === 1 && fremd.liste[0]!.vorschlag.join() === '1' && fremd.liste[0]!.zuTun === 'Meldung prüfen und verwerfen', true)
pruefe('… und zählt (`zaehleSeiteFremd`)', zaehleSeiteFremd(fremd.warnungen), 1)
pruefe('Zähler: fremde Warnungen zählen nicht', zaehleSeiteFremd(['x — im Datensatz nicht gefunden']), 0)

const eigen = lauf([meldung(1, NF1, NF1)], [1])
pruefe('eigene Seite: kein Urteil', [eigen.halt, eigen.warnungen.length, eigen.liste.length], [false, 0, 0])
pruefe('Seite = Adresse eines zweiten Wegs des Titels (ADN, gleiche Art wie die Meldung)', lauf([meldung(1, 'https://animationdigitalnetwork.com/de/video/1140-x', 'https://animationdigitalnetwork.com/de/video/1140-x', 'adn')], [1]).halt, false)
pruefe('Seite = Adresse eines anderen Wegs des Titels (Netflix-Meldung, zweite Netflix-Seite desselben Titels)', lauf([meldung(1, NF1, 'https://www.netflix.com/title/81000001#s2')], [1]).halt, false)
pruefe('Seite gehört dem zweiten Titel der Adresse (ids 1 und 2)', lauf([meldung(1, NF1, 'https://www.netflix.com/title/81000002')], [1, 2]).halt, false)
pruefe('ohne Angabe (Meldung vor Migration 066): kein Urteil', lauf([meldung(1, NF1, null)], [1]).halt, false)
pruefe('Angabe fehlt als Feld: kein Urteil', lauf([meldung(1, NF1, undefined)], [1]).halt, false)
pruefe('Startseite: kein Urteil (keine Titelseite)', lauf([meldung(1, NF1, 'https://www.netflix.com/browse')], [1]).halt, false)
pruefe('Player: kein Urteil', lauf([meldung(1, NF1, 'https://www.netflix.com/watch/81234567')], [1]).halt, false)
pruefe('anderer Anbieter als der Titel führt (Titel 2 hat nur Netflix): kein Urteil', lauf([meldung(1, 'https://www.netflix.com/title/81000002', 'https://animationdigitalnetwork.com/de/video/9-x', 'netflix')], [2]).halt, false)
pruefe('ADN-Seite fremd, Titel führt ADN', lauf([meldung(1, NF1, 'https://animationdigitalnetwork.com/de/video/9999-y')], [1]).halt, true)
pruefe('Disney+ fremde entity, Titel führt eine entity', lauf([meldung(1, `https://www.disneyplus.com/browse/entity-${UUID_A}`, `https://www.disneyplus.com/de-de/browse/entity-${UUID_B}`, 'disneyplus')], [3]).halt, true)
pruefe('Disney+ eigene entity (Großschreibung egal)', lauf([meldung(1, `https://www.disneyplus.com/browse/entity-${UUID_A}`, `https://www.disneyplus.com/de-de/browse/entity-${UUID_A.toUpperCase()}`, 'disneyplus')], [3]).halt, false)
pruefe('Prime-Seite (andere ASIN): kein Urteil', lauf([meldung(1, 'https://www.amazon.de/dp/B0AAAAAAAA', 'https://www.amazon.de/dp/B0BBBBBBBB', 'primevideo')], [1]).halt, false)
const gemischt = lauf([meldung(1, NF1, NF1), meldung(2, NF1, 'https://www.netflix.com/title/81000002'), meldung(3, NF1, NF1)], [1])
pruefe('Gruppe mit einer fremden Seite in der Mitte: ganze Gruppe bleibt liegen, eine Warnung', [gemischt.halt, gemischt.warnungen.length], [true, 1])
pruefe('… die Meldung der Warnung ist die jüngste der Gruppe (Adresse und Name aus `p`)', gemischt.liste[0]?.name.startsWith('Landei II'), true)
pruefe('Titel ohne `streams` und ohne bekannte Adresse derselben Art: kein Urteil', seiteFremd([meldung(1, 'https://x.test/a', 'https://www.netflix.com/title/81000002')], [9], [{ id: 9 }], [], []), false)

if (fehler) {
  console.error(`check-meldung-seite: ${fehler} von ${faelle} Fällen falsch`)
  process.exit(1)
}
console.log(`check-meldung-seite: ${faelle} Fälle grün — fremde Titelseite hält die Meldung, ohne Angabe, Startseite, Player, Prime und andere Anbieter nicht`)
