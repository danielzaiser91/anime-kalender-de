/**
 * Zusicherungen zu den Rechenschritten der Ansicht „Entdecken“ (`web/src/lib/empfehlung-reise.ts`) und zum Wischen
 * (`web/src/components/empfehlung/wischen.ts`) an einer erfundenen Pool-Datei: Abzüge beim Start, Vorrang der eigenen Anbieter,
 * Ersatz auf der Galerie, Zeilen, Zwischenstand, Ziel, Mosaik, Wischweg. Der ganze Ablauf (6 Duelle bis fünf Vorschläge) läuft
 * über die echten Kernfunktionen. Aufruf: `npm run check:logic`.
 */
import type { EmpfehlungsDatei, Kandidat } from '../shared/empfehlung-pool.ts'
import { antworteSitzung, istFertig, neueSitzung, neuerZustand, naechstesPaar, vorschlaege, type Antwort } from '../shared/empfehlung-kern.ts'
import { baueKontext } from '../shared/empfehlung-vektor.ts'
import {
  artWort, ausgeschlossenFuerReise, ersetzeVorschlag, ersteVorschlaege, metaZeile, mosaikIds, naechstesZiel, rangliste, stand,
} from '../web/src/lib/empfehlung-reise.ts'
import { stempelDeckkraft, wischRichtung } from '../web/src/components/empfehlung/wischen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

const GENRES = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Romance', 'Fantasy', 'Horror', 'Sport']
const WOERTER = ['Schule', 'Magie', 'Gegenwart', 'Isekai', 'Weltraum', 'Slapstick', 'Rache', 'Musik']

/** 60 Einstiege; jeder dritte nur bei Crunchyroll, jeder siebte bei Netflix und Crunchyroll, der Rest bei Netflix; jeder neunte beginnt mit Staffel 2 (`ab`, kein `duell`). */
function kulisse(): EmpfehlungsDatei {
  const einstiege: Kandidat[] = []
  for (let i = 0; i < 60; i++) {
    const k: Kandidat = {
      id: 900100 + i,
      n: `Titel ${i}`,
      f: i % 5 === 0 ? 'MOVIE' : 'TV',
      y: 2000 + ((i * 7) % 25),
      e: 1 + ((i * 5) % 40),
      g: [i % 8, (i * 3 + 1) % 8],
      k: [(i * 5) % 8, (i + 2) % 8],
      fsk: [0, 6, 12, 16][i % 4],
      v: 70,
      p: i % 7 === 0 ? [['netflix'], ['crunchyroll']] : [[i % 3 === 0 ? 'crunchyroll' : 'netflix']],
    }
    einstiege.push(i % 9 === 4 ? { ...k, ab: 2 } : { ...k, duell: true })
  }
  return { pool: 80, genres: GENRES, keywords: WOERTER, einstiege, reihe: {} }
}

const datei = kulisse()
const k = baueKontext(datei)
const ids = (liste: Kandidat[]): number[] => liste.map((x) => x.id)

console.log('Abzüge beim Start')
pruefe('leer → keine Ausschlüsse', gleich(ausgeschlossenFuerReise({ favoriten: [], gesehen: [], ausgeblendet: [], gesehenBis: {} }), []))
const aus = ausgeschlossenFuerReise({ favoriten: [1, 2], gesehen: [2, 3], ausgeblendet: [4], gesehenBis: { '5': 12, '6': 3 } })
pruefe('Favoriten, Gesehen, Ausgeblendet und „gesehen bis“ vereint, ohne Doppelte', gleich([...aus].sort(), [1, 2, 3, 4, 5, 6]), aus)

console.log('Vorrang der eigenen Anbieter')
const z0 = neuerZustand(k, 7)
const ohne = rangliste(k, z0, [], new Set())
pruefe('ohne eigene Anbieter = Rangliste des Kerns', gleich(ids(ohne), ids(vorschlaege(k, z0, [], 60))))
const mit = rangliste(k, z0, [], new Set(['crunchyroll']))
pruefe('mit eigenen: dieselben Titel', gleich([...ids(mit)].sort(), [...ids(ohne)].sort()))
const beiCr = (x: Kandidat): boolean => x.p.some(([p]) => p === 'crunchyroll')
pruefe('mit eigenen: Platz 1 ist ein Crunchyroll-Titel', beiCr(mit[0]), mit[0])
pruefe('mit eigenen: Reihenfolge ab Platz 21 unverändert', gleich(ids(mit).slice(20), ids(ohne).slice(20)))
let vorneGeordnet = true
for (let seed = 1; seed <= 12; seed++) {
  const basis = rangliste(k, neuerZustand(k, seed), [], new Set())
  const geordnet = rangliste(k, neuerZustand(k, seed), [], new Set(['crunchyroll']))
  const erste20 = geordnet.slice(0, 20)
  const ersteBei = erste20.filter(beiCr).length
  const sortiert = erste20.every((x, i) => (i < ersteBei ? beiCr(x) : !beiCr(x)))
  const mengeGleich = gleich(ids(erste20).sort(), ids(basis.slice(0, 20)).sort())
  if (!sortiert || !mengeGleich) vorneGeordnet = false
}
pruefe('in 12 Läufen: die ersten 20 = dieselbe Menge, eigene Anbieter (auch einer von mehreren) vor allen anderen', vorneGeordnet)
const nurEiner = rangliste(k, z0, [], new Set(['crunchyroll', 'wow'])).filter(beiCr)
pruefe('Vorrang ist kein Filter: Netflix-Titel bleiben', mit.some((x) => !beiCr(x)) && nurEiner.length > 0)
const eigenerKeiner = rangliste(k, z0, [], new Set(['disneyplus']))
pruefe('Anbieter ohne Treffer ändert nichts', gleich(ids(eigenerKeiner), ids(ohne)))
const abgezogen = rangliste(k, z0, [datei.einstiege[0].id], new Set())
pruefe('verworfene Kennung kommt nicht vor', !ids(abgezogen).includes(datei.einstiege[0].id))

console.log('Galerie: Ersatz')
const rang = ohne
const fuenf = ersteVorschlaege(rang)
pruefe('fünf Vorschläge', fuenf.length === 5, fuenf)
const ersatz = ersetzeVorschlag(fuenf, fuenf[2], rang)
pruefe('Platz bleibt, der sechste rückt ein', gleich(ersatz, [fuenf[0], fuenf[1], rang[5].id, fuenf[3], fuenf[4]]), ersatz)
pruefe('Ersatz nie der Entfernte, auch wenn er in der Rangliste steht', !ersatz.includes(fuenf[2]))
const knapp = ersetzeVorschlag(fuenf, fuenf[0], rang.slice(0, 5))
pruefe('kein Ersatz übrig → Galerie rückt zusammen', gleich(knapp, fuenf.slice(1)), knapp)
pruefe('Rangliste leer → Galerie ohne den Entfernten', gleich(ersetzeVorschlag([7], 7, []), []))

console.log('Zeilen und Zahlen')
pruefe('Film mit Minuten', metaZeile({ f: 'MOVIE', y: 1997, e: 1 }, 133) === 'Film · 1997 · 133 Min')
pruefe('Film ohne Minuten', metaZeile({ f: 'MOVIE', y: 1997 }) === 'Film · 1997')
pruefe('Serie mit Folgen und Minuten', metaZeile({ f: 'TV', y: 2023, e: 28 }, 24) === 'Serie · 2023 · 28 Folgen · ca. 24 Min')
pruefe('Serie mit einer Folge', metaZeile({ f: 'ONA', y: 2023, e: 1 }) === 'Serie · 2023 · 1 Folge')
pruefe('Serie ohne Folgenzahl und Jahr', metaZeile({ f: 'TV' }) === 'Serie')
pruefe('Art', artWort({ f: 'MOVIE' }) === 'Film' && artWort({ f: 'TV' }) === 'Serie' && artWort({}) === 'Serie')
pruefe('Ziel 6 → 10, 8 → 10, 10 bleibt', naechstesZiel(6, 10) === 10 && naechstesZiel(8, 10) === 10 && naechstesZiel(10, 10) === 10)
pruefe('Ziel unter der Obergrenze: 2 → 6', naechstesZiel(2, 10) === 6)
pruefe('Mosaik: 60 Einstiege → 24 Kennungen', mosaikIds(datei.einstiege, 24).length === 24)
pruefe('Mosaik: 5 Einstiege → 5 Kennungen', mosaikIds(datei.einstiege.slice(0, 5), 24).length === 5)
pruefe('Mosaik: leer → leer', mosaikIds([], 24).length === 0)

console.log('Zwischenstand')
const s0 = stand(k, z0, 6)
pruefe('Start: Duell 1 von 6, Rest = Gesamt', s0.nr === 1 && s0.ziel === 6 && s0.rest === s0.gesamt && s0.gesamt === 60, s0)
pruefe('nr nie über dem Ziel', stand(k, { ...z0, gewertet: 6 }, 6).nr === 6)
pruefe('Rest 13 ist ein Messwert', stand(k, { ...z0, rest: Array.from({ length: 13 }, (_, i) => i) }, 6).rest === 13)
pruefe('Rest 12 klebt an der Untergrenze → keine Zahl', stand(k, { ...z0, rest: Array.from({ length: 12 }, (_, i) => i) }, 6).rest === null)
pruefe('Rest 1 → keine Zahl', stand(k, { ...z0, rest: [0] }, 6).rest === null)

console.log('Wischen')
pruefe('−90 → links, 90 → rechts', wischRichtung(-90) === 'links' && wischRichtung(90) === 'rechts')
pruefe('±89 → nichts, 0 → nichts', wischRichtung(-89) === undefined && wischRichtung(89) === undefined && wischRichtung(0) === undefined)
pruefe('Stempel links folgt dem Weg', stempelDeckkraft(-45, 'links') === 0.5 && stempelDeckkraft(-45, 'rechts') === 0)
pruefe('Stempel rechts, gedeckelt', stempelDeckkraft(45, 'rechts') === 0.5 && stempelDeckkraft(500, 'rechts') === 1)

console.log('Ablauf: sechs Duelle bis fünf Vorschläge')
let s = neueSitzung(neuerZustand(k, 11, aus.map((i) => 900100 + i)))
const gezeigtePaare: Array<[number, number]> = []
const muster: Antwort[] = ['A', 'N', 'B', 'A', 'B', 'B', 'A']
for (let i = 0; i < 40 && !istFertig(k, s.zustand, 6); i++) {
  const p = naechstesPaar(k, s.zustand)
  if (p) gezeigtePaare.push(p)
  s = antworteSitzung(k, s, muster[i % muster.length])
}
pruefe('nach 6 gewerteten Duellen fertig', s.zustand.gewertet === 6 && istFertig(k, s.zustand, 6), s.zustand.gewertet)
const endRang = rangliste(k, s.zustand, [], new Set())
const endFuenf = ersteVorschlaege(endRang)
const inDuell = new Set(gezeigtePaare.flat().map((i) => datei.einstiege[i].id))
pruefe('fünf Vorschläge, keiner aus einem Duell', endFuenf.length === 5 && endFuenf.every((id) => !inDuell.has(id)), endFuenf)
pruefe('Vorschläge ohne doppelte Kennung', new Set(endFuenf).size === 5)

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nEmpfehlung (Ansicht): Abzüge, Vorrang, Ersatz, Zeilen, Zwischenstand, Wischweg und Ablauf in Ordnung')
