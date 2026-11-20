/**
 * Zusicherung: **Pokémon Horizonte führt seine eigenen deutschen Staffeln** (Auftrag Dirigent, 20.11.2026: „aufteilen in einzelne
 * Staffeln, statt alles in 1“). Hält `data/curated/horizonte-staffeln.yaml` gegen die zweite Größe — die Folgenzahl je Staffel bei
 * de.wikipedia und TOGGO (beide am 20.11.2026: 45, 44, 47; hier festgeschrieben, damit die Prüfung keine Sammler-Datei liest) — und
 * ihre Wirkung auf Staffelnummer, Spanne, Detaildatei und Kopfzählung. Den Abgleich mit den Sammlerdaten macht
 * `check-horizonte-staffeln-bestand.ts`. Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { hauptstaffeln, staffelStaende } from '../shared/titles.ts'
import { alleStaffelQuellen } from './bau/staffel-quelle.ts'
import {
  HORIZONTE_STAFFELN,
  POKEMON_STAFFELN,
  abweichungenZurQuelle,
  fehlerInGrenzen,
  folgenJeStaffelAusSt,
  hoechsteJeStaffel,
  ladeStaffelGrenzen,
  letzteFolgen,
  staffelEnden,
  staffelListen,
  zaehleFolgen,
} from './lib/pokemon-staffeln.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const ID = 158871
const QUELLE_JE_STAFFEL = [45, 44, 47] // de.wikipedia „Pokémon (Anime)/Horizonte“ und TOGGO VSE292, Staffel 1–3, gelesen 20.11.2026

const horizonte = ladeStaffelGrenzen(HORIZONTE_STAFFELN)
const h = horizonte[0]!
pruefe('Datei führt genau Horizonte', horizonte.length === 1 && h.anilistId === ID, JSON.stringify(horizonte.map((t) => t.anilistId)))
pruefe('Grenzen in Ordnung', fehlerInGrenzen(h, undefined).length === 0, fehlerInGrenzen(h, undefined).join('; '))
const geschlossen = h.staffeln.filter((s) => !s.offen)
pruefe('Staffel 1–3 abgeschlossen, Folgen wie Wikipedia/TOGGO', geschlossen.map((s) => `${s.nr}:${s.folgen}`).join() === QUELLE_JE_STAFFEL.map((n, i) => `${i + 1}:${n}`).join(), JSON.stringify(geschlossen))
pruefe('Summe Staffel 1–3 = 136 (RTL+-Bereich 1–136)', geschlossen.reduce((a, s) => a + (s.folgen ?? 0), 0) === 136)
const offen = h.staffeln[h.staffeln.length - 1]!
pruefe('Staffel 4 offen ab Folge 137, ohne erfundenes Ende', offen.nr === 4 && offen.von === 137 && offen.offen === true && offen.bis === undefined && offen.folgen === undefined, JSON.stringify(offen))

/* Der Staffel-4-Termin hängt an Staffel 4: seine Folgennummer ist ihr Beginn. */
const nachtrag = yaml.load(readFileSync('data/curated/streaming-nachtrag-2026.yaml', 'utf8')) as { slug: string; anilistId?: number; schedule?: { firstEpisodeNumber?: number } }[]
const s4 = nachtrag.find((r) => r.slug === 'pokemon-horizonte-s4-rtlplus')
pruefe('Termin pokemon-horizonte-s4-rtlplus beginnt mit der ersten Folge von Staffel 4', s4?.anilistId === ID && s4.schedule?.firstEpisodeNumber === offen.von, JSON.stringify(s4?.schedule))

/* Ohne Argument liest der Bau beide Dateien; die Hauptserie bleibt bei ihren zwölf Titeln. */
const alle = ladeStaffelGrenzen()
pruefe('ladeStaffelGrenzen() liest beide Dateien (12 + 1)', alle.length === 13 && alle.some((t) => t.anilistId === ID) && ladeStaffelGrenzen(POKEMON_STAFFELN).length === 12, String(alle.length))
pruefe('staffelQuelle 1 (Standardaufruf wie im Bau)', alleStaffelQuellen().get(ID) === 1, String(alleStaffelQuellen().get(ID)))
pruefe('staffelBis 4', staffelEnden(alle).get(ID) === 4, String(staffelEnden(alle).get(ID)))
pruefe('Detaildatei s: drei geschlossene, eine offene Staffel', JSON.stringify(staffelListen(alle).get(ID)) === '[[1,1,45],[2,46,89],[3,90,136],[4,137]]', JSON.stringify(staffelListen(alle).get(ID)))
pruefe('letzte belegte Folge: Horizonte 137, Pokémon 527 276', letzteFolgen(alle).get(ID) === 137 && letzteFolgen(alle).get(527) === 276)

/* Horizonte bleibt eigene Serie: mit Staffelnummern zählt die Hauptserie weiter „von 25“ ohne sie. */
const quellen = alleStaffelQuellen([], alle)
const enden = staffelEnden(alle)
const reihe = [[527, 1997], [1564, 2002], [112153, 2019], [158870, 2023], [ID, 2023]].map(([id, jahr]) => ({
  id: id!, name: id === ID ? 'Pokémon Horizonte' : `Pokémon ${id}`, format: 'TV', jpYear: jahr, staffelQuelle: quellen.get(id!), staffelBis: enden.get(id!), eigenesWerk: id === ID,
}))
const stand = staffelStaende(hauptstaffeln(reihe), 'Pokémon')
pruefe('Hauptserie „von 25“, Horizonte nicht darin', [...stand.values()][0]?.von === 25 && !stand.has(ID), JSON.stringify([...stand]))

/* Offene Staffel: nur als letzte, ohne bis/folgen; die Folgenzahl des Titels wird dann nicht gehalten. */
const zwei = { anilistId: 1, staffeln: [{ nr: 1, von: 1, bis: 10, folgen: 10 }, { nr: 2, von: 11, offen: true as const }] }
pruefe('Offene letzte Staffel ohne Befund, auch bei abweichender Folgenzahl', fehlerInGrenzen(zwei, 99).length === 0)
pruefe('Offene Staffel vor einer weiteren', fehlerInGrenzen({ anilistId: 1, staffeln: [{ nr: 1, von: 1, offen: true }, { nr: 2, von: 1, bis: 5, folgen: 5 }] }, undefined).some((f) => f.includes('nicht die letzte')))
pruefe('Offene Staffel mit bis', fehlerInGrenzen({ anilistId: 1, staffeln: [{ nr: 1, von: 1, bis: 4, offen: true }] }, undefined).length === 1)
pruefe('Offene Staffel mit folgen', fehlerInGrenzen({ anilistId: 1, staffeln: [{ nr: 1, von: 1, folgen: 4, offen: true }] }, undefined).length === 1)
pruefe('Geschlossene Staffel ohne bis', fehlerInGrenzen({ anilistId: 1, staffeln: [{ nr: 1, von: 1, folgen: 4 }] }, undefined).length === 1)
pruefe('Offene Staffel muss an der Grenze beginnen', fehlerInGrenzen({ anilistId: 1, staffeln: [{ nr: 1, von: 1, bis: 10, folgen: 10 }, { nr: 2, von: 12, offen: true }] }, undefined).length === 1)
pruefe('Ohne offene Staffel gilt die Folgenzahl weiter', fehlerInGrenzen({ anilistId: 1, staffeln: [{ nr: 1, von: 1, bis: 10, folgen: 10 }] }, 11).length === 1)

/* Kopfzählung (vorher „122 von 122“: aniSearch führt 122 Folgen, die deutschen Staffeln 1–3 haben 136). */
const nummern = Array.from({ length: 122 }, (_, i) => i + 1)
pruefe('Horizonte: 136 von 137', zaehleFolgen(nummern, [[1, 136]], 137).join() === '137,136', zaehleFolgen(nummern, [[1, 136]], 137).join())
pruefe('Ohne Staffelgrenzen unverändert (122 von 122)', zaehleFolgen(nummern, [[1, 136]], undefined).join() === '122,122')
pruefe('Grenzen bis genau zur Listenlänge: die Liste zählt', zaehleFolgen([1, 2, 4], [[4, 9]], 3).join() === '3,1')
pruefe('Deutsch zählt nur Folgen in den Bereichen', zaehleFolgen([1, 2], [[2, 3], [6, 6]], 7).join() === '7,3')
pruefe('Liste länger als die Grenzen: Liste zählt', zaehleFolgen([1, 2, 3, 5], [[1, 2]], 3).join() === '4,2')

/* Quellenvergleich (Bestand): Wikipedia-Spalte „Folge in der Staffel“, TOGGO höchste Folge je Staffel. */
pruefe('Folgen je Staffel aus st', folgenJeStaffelAusSt([{ st: 1 }, { st: 2 }, { st: 1 }, { st: 2 }, { st: 3 }, { st: 1 }]).join() === '2,3,1')
pruefe('Liste ohne st 1 am Anfang beginnt trotzdem eine Staffel', folgenJeStaffelAusSt([{ st: 5 }, { st: 6 }]).join() === '2')
pruefe('Höchste Folge je Staffel, Lücken bleiben leer', JSON.stringify(hoechsteJeStaffel([{ staffel: 1, folge: 3 }, { staffel: 3, folge: 2 }, { staffel: 1, folge: 9 }, { staffel: 1, folge: 4 }])) === '[9,null,2]')
pruefe('Quelle gleich: kein Befund', JSON.stringify(abweichungenZurQuelle(h, [45, 44, 47, 23], 'X')) === '{"fehler":[],"hinweise":[]}')
pruefe('Quelle zählt eine Staffel anders: Fehler', abweichungenZurQuelle(h, [45, 45, 47], 'X').fehler.join() === 'Staffel 2: 44 Folgen, X 45')
pruefe('Staffel fehlt in der Quelle: kein Befund', abweichungenZurQuelle(h, [undefined, 44, 47], 'X').fehler.length === 0)
pruefe('Offene Staffel wird nicht gezählt', abweichungenZurQuelle(h, [45, 44, 47, 99], 'X').fehler.length === 0)
pruefe('Quelle führt Staffel 5: Hinweis', abweichungenZurQuelle(h, [45, 44, 47, 24, 1], 'X').hinweise.length === 1 && abweichungenZurQuelle(h, [45, 44, 47, 24, 1], 'X').fehler.length === 0)

if (fehler) process.exit(1)
console.log('check-horizonte-staffeln: ok')
