/**
 * Zusicherungen zum Rechenkern der Empfehlung (`shared/empfehlung-kern.ts`, `empfehlung-vektor.ts`) an einer erfundenen Pool-Datei:
 * Paarwahl, Eingrenzung, „Kann mich nicht entscheiden“, Zurück, Vorschläge mit Verworfenen, Abzüge. Die Simulation am echten
 * Bestand steht in `check-empfehlung-kern-bestand.ts`. Aufruf: `npm run check:logic`.
 */
import type { EmpfehlungsDatei, Kandidat } from '../shared/empfehlung-pool.ts'
import {
  antworte, antworteSitzung, DUELLE_MAX, DUELLE_START, fortschritt, istFertig, naechstesPaar, neueSitzung, neuerZustand, SCHRITTE_MAX, teilung,
  UNTERGRENZE_REST, VORSCHLAEGE, vorschlaege, zurueck, type Antwort, type Zustand,
} from '../shared/empfehlung-kern.ts'
import { baueKontext, cos, zufall } from '../shared/empfehlung-vektor.ts'
import { brauchbareProfile, PROFILE, schwellenFehler, type Messwerte } from './lib/empfehlung-simulation.ts'

/** Erwartete Werte fest im Test (nicht aus dem Kern importiert): sonst zöge eine Änderung der Konstante den Test mit. */
const START = 6
const MAX = 10
const SCHRITTE = 30
const UNTER = 12

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const GENRES = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Romance', 'Fantasy', 'Horror', 'Sport']
const WOERTER = ['Schule', 'Magie', 'Gegenwart', 'Isekai', 'Weltraum', 'Slapstick', 'Rache', 'Musik']
/** 40 Einstiege mit Mustern, die sich überlappen; jeder neunte beginnt mit Staffel 2 (`ab`, kein `duell`). */
function kulisse(): EmpfehlungsDatei {
  const einstiege: Kandidat[] = []
  for (let i = 0; i < 40; i++) {
    const k: Kandidat = {
      id: 100 + i,
      n: `Titel ${i}`,
      f: i % 5 === 0 ? 'MOVIE' : 'TV',
      y: 2000 + ((i * 7) % 25),
      e: 1 + ((i * 5) % 40),
      g: [i % 8, (i * 3 + 1) % 8],
      k: [(i * 5) % 8, (i + 2) % 8],
      fsk: i % 7 === 0 ? undefined : [0, 6, 12, 16][i % 4],
      v: 70,
      p: [['netflix']],
    }
    einstiege.push(i % 9 === 4 ? { ...k, ab: 2 } : { ...k, duell: true })
  }
  return { pool: 60, genres: GENRES, keywords: WOERTER, einstiege, reihe: { '9001': 100, '9002': 103 } }
}

const datei = kulisse()
const k = baueKontext(datei)
const ids = (liste: Kandidat[]): number[] => liste.map((x) => x.id)
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const ohneDuell = new Set(datei.einstiege.map((e, i) => (e.duell ? -1 : i)).filter((i) => i >= 0))

/** Spielt `n` gewertete Duelle mit abwechselnden Antworten A, B, B, A …; liefert Zustand und alle gezeigten Paare. */
function spiele(z0: Zustand, n: number, muster: Antwort[] = ['A', 'B', 'B', 'A']): { z: Zustand; paare: Array<[number, number]> } {
  let z = z0
  const paare: Array<[number, number]> = []
  for (let i = 0; z.gewertet < n && i < 100; i++) {
    paare.push(naechstesPaar(k, z)!)
    z = antworte(k, z, muster[i % muster.length])
  }
  return { z, paare }
}

console.log('\nEmpfehlung, Merkmalsvektor:')
{
  pruefe('ein Vektor je Einstieg', k.vektoren.length === 40)
  const norm = k.vektoren.map((v) => v.reduce((s, a) => s + a * a, 0))
  pruefe('jeder Vektor hat Länge 1', norm.every((n) => Math.abs(n - 1) < 1e-9), norm.find((n) => Math.abs(n - 1) > 1e-9))
  pruefe('Ähnlichkeit zu sich selbst ist 1', Math.abs(cos(k, 3, 3) - 1) < 1e-9)
  pruefe('Ähnlichkeit ist symmetrisch', cos(k, 2, 9) === cos(k, 9, 2))
  const r1 = zufall(7)
  const r2 = zufall(7)
  pruefe('Zufall: gleicher Startwert, gleiche Folge', r1() === r2() && r1() === r2())
  pruefe('Zufall: anderer Startwert, andere Folge', zufall(7)() !== zufall(8)())
}

console.log('\nEmpfehlung, Start und Abzüge:')
{
  const z = neuerZustand(k, 1)
  pruefe('Start: alle 40 Einstiege in der Restmenge', z.rest.length === 40 && z.gewertet === 0 && z.schritt === 0)
  const aus = neuerZustand(k, 1, [105, 9001, 9001, 424242])
  pruefe('Abzug: Einstieg 105 und Reihe des Teils 9001 (Einstieg 100) fallen weg, Unbekanntes nicht', gleich(aus.ausgeschlossen, [0, 5]) && aus.rest.length === 38, aus.ausgeschlossen)
  pruefe('Abzug: der Teil 9002 trifft den Einstieg 103', gleich(neuerZustand(k, 1, [9002]).ausgeschlossen, [3]))
  const f = fortschritt(k, aus, START)
  pruefe('Fortschritt: gesamt zählt ohne Abzüge, Rest = Restmenge', f.gesamt === 38 && f.rest === 38 && !f.fertig, f)
}

console.log('\nEmpfehlung, Paare:')
{
  let ok = true
  let teil2 = 0
  let gleichesPaar = 0
  for (let s = 1; s <= 40; s++) {
    const { paare } = spiele(neuerZustand(k, s), MAX)
    for (const [a, b] of paare) {
      if (ohneDuell.has(a) || ohneDuell.has(b)) teil2++
      if (a === b) ok = false
    }
    let z = neuerZustand(k, s)
    for (let i = 0; i < MAX; i++) {
      const frisch = z.rest.filter((t) => !ohneDuell.has(t) && !z.gesehen.includes(t))
      const paar = naechstesPaar(k, z)!
      if (frisch.length >= 2 && paar.some((t) => z.gesehen.includes(t))) gleichesPaar++
      z = antworte(k, z, i % 2 ? 'A' : 'B')
    }
  }
  pruefe('nie zwei gleiche Titel in einem Paar', ok)
  pruefe('nie ein Einstieg ohne Teil 1 (ab) im Duell, 40 Läufe zu 10 Duellen', teil2 === 0, teil2)
  pruefe('kein Titel kommt in einem späteren Duell wieder, solange zwei frische in der Restmenge sind', gleichesPaar === 0, gleichesPaar)
  const z = neuerZustand(k, 3)
  pruefe('gleicher Zustand, gleiches Paar', gleich(naechstesPaar(k, z), naechstesPaar(k, JSON.parse(JSON.stringify(z)))))
  pruefe('anderer Startwert, anderes Paar (mindestens einmal in 10)', Array.from({ length: 10 }, (_, s) => naechstesPaar(k, neuerZustand(k, s + 1))!.join()).some((p, _i, l) => p !== l[0]))
  const klein = { ...neuerZustand(k, 1), rest: [0] }
  pruefe('weniger als zwei Duell-Titel: kein Paar', naechstesPaar(k, klein) === null)
  pruefe('nur Titel ohne Teil 1 in der Restmenge: kein Paar', naechstesPaar(k, { ...z, rest: [...ohneDuell] }) === null)
  const ausgeschlossen = neuerZustand(k, 1, [100, 101, 102])
  pruefe('ausgeschlossene Titel kommen nie als Paar', Array.from({ length: 20 }, (_, s) => naechstesPaar(k, { ...ausgeschlossen, startwert: s })!).every((p) => p.every((i) => i > 2)))
}

console.log('\nEmpfehlung, Eingrenzung:')
{
  const z0 = neuerZustand(k, 5)
  const [a, b] = naechstesPaar(k, z0)!
  const sa = antworte(k, z0, 'A')
  const sb = antworte(k, z0, 'B')
  pruefe('Antwort A: a gewinnt, beide gelten als gesehen', sa.sieger[0] === a && gleich(sa.gesehen, [a, b]) && sa.gewertet === 1 && sa.schritt === 1, sa)
  pruefe('Antwort B: b gewinnt', sb.sieger[0] === b && sb.gewertet === 1)
  pruefe('A und B grenzen verschieden ein', !gleich(sa.rest, sb.rest))
  pruefe('Restmenge nach A: jeder ist a so nah wie b oder näher', sa.rest.length >= UNTER && sa.rest.every((t) => cos(k, t, a) >= cos(k, t, b)))
  pruefe('Restmenge nach A enthält alle, die a näher sind (unabhängig nachgezählt)', z0.rest.filter((t) => cos(k, t, a) >= cos(k, t, b)).length === sa.rest.length || sa.rest.length === UNTER)
  pruefe('der Ausgangszustand bleibt unverändert', z0.rest.length === 40 && z0.sieger.length === 0 && z0.gesehen.length === 0 && z0.gewertet === 0)
  let min = 99
  let nurZwoelf = 0
  for (let s = 1; s <= 60; s++) {
    const { z } = spiele(neuerZustand(k, s), 9)
    min = Math.min(min, z.rest.length)
    if (z.rest.length === UNTER) nurZwoelf++
  }
  pruefe(`Untergrenze: Restmenge nie unter ${UNTER}`, min >= UNTER, min)
  pruefe('Untergrenze wird in 60 Läufen erreicht (sonst prüft der Fall nichts)', nurZwoelf > 0, nurZwoelf)
  const klein = { ...z0, rest: z0.rest.slice(0, 5) }
  pruefe('Restmenge unter der Untergrenze bleibt, wie sie ist (kein Auffüllen)', antworte(k, klein, 'A').rest.length <= 5)
  const zwoelf = { ...z0, rest: z0.rest.slice(0, 13) }
  const nachDuell = antworte(k, zwoelf, 'A').rest.length
  pruefe('13 in der Restmenge: nach dem Duell 12 oder 13', nachDuell === 12 || nachDuell === 13, nachDuell)
  const zwei = spiele(neuerZustand(k, 9), 2).z
  pruefe('Restmenge schrumpft von Duell zu Duell nicht', zwei.rest.length <= 40 && zwei.rest.every((i) => z0.rest.includes(i)))
}

console.log('\nEmpfehlung, Kann mich nicht entscheiden:')
{
  const z0 = neuerZustand(k, 11)
  const paar = naechstesPaar(k, z0)!
  const n = antworte(k, z0, 'N')
  pruefe('neutral: Restmenge, Sieger und Fortschritt bleiben', gleich(n.rest, z0.rest) && n.sieger.length === 0 && n.gewertet === 0)
  pruefe('neutral: Duell zählt als gezeigt, beide Titel sind gesehen', n.schritt === 1 && gleich(n.gesehen, [...paar]) && gleich(n.neutral, paar))
  pruefe('neutral: das nächste Paar ist ein anderes', !gleich(naechstesPaar(k, n), paar) && !naechstesPaar(k, n)!.some((i) => paar.includes(i)))
  pruefe('eine Antwort danach löscht die Richtung', antworte(k, n, 'A').neutral === null)
  const diffCos = (p: number[], q: number[]): number => {
    const d = k.vektoren[p[0]].map((x, m) => x - k.vektoren[p[1]][m])
    const e = k.vektoren[q[0]].map((x, m) => x - k.vektoren[q[1]][m])
    const dot = d.reduce((s, x, m) => s + x * e[m], 0)
    return Math.abs(dot / (Math.sqrt(d.reduce((s, x) => s + x * x, 0) * e.reduce((s, x) => s + x * x, 0)) || 1))
  }
  let mit = 0
  let ohne = 0
  for (let s = 1; s <= 200; s++) {
    const z = neuerZustand(k, s)
    const p = naechstesPaar(k, z)!
    const nz = antworte(k, z, 'N')
    mit += diffCos(naechstesPaar(k, nz)!, p)
    ohne += diffCos(naechstesPaar(k, { ...nz, neutral: null })!, p)
  }
  pruefe('neutral: das nächste Paar liegt im Mittel quer zum übersprungenen, ohne Richtung nicht', mit < ohne * 0.9, { mit: mit / 200, ohne: ohne / 200 })
  let z = neuerZustand(k, 2)
  for (let i = 0; i < SCHRITTE - 1; i++) z = antworte(k, z, 'N')
  pruefe(`${SCHRITTE - 1} Mal „kann nicht“: noch nicht fertig`, z.schritt === SCHRITTE - 1 && !istFertig(k, z, START), z.schritt)
  z = antworte(k, z, 'N')
  pruefe(`${SCHRITTE} Mal „kann nicht“: fertig, nichts gewertet`, z.schritt === SCHRITTE && z.gewertet === 0 && istFertig(k, z, START))
}

console.log('\nEmpfehlung, Ende der Duelle:')
{
  const z = neuerZustand(k, 4)
  for (const [gewertet, ziel, fertig] of [[5, 6, false], [6, 6, true], [7, 6, true], [9, 10, false], [10, 10, true]] as const) {
    pruefe(`${gewertet} von ${ziel} gewertet: fertig=${fertig}`, istFertig(k, { ...z, gewertet }, ziel) === fertig)
  }
  pruefe('ohne Paar ist es fertig', istFertig(k, { ...z, rest: [0] }, 6))
  pruefe('Konstanten fest: 6 Duelle, bis 10, höchstens 30 Schritte, Untergrenze 12, 5 Vorschläge', DUELLE_START === 6 && DUELLE_MAX === 10 && SCHRITTE_MAX === 30 && UNTERGRENZE_REST === 12 && VORSCHLAEGE === 5)
  const ohnePaar = { ...z, rest: [0] }
  pruefe('ohne Paar ändert eine Antwort nichts', antworte(k, ohnePaar, 'A') === ohnePaar)
}

console.log('\nEmpfehlung, Vorschläge:')
{
  const { z } = spiele(neuerZustand(k, 6, [110, 111]), START)
  const v = vorschlaege(k, z)
  pruefe('fünf Vorschläge', v.length === 5 && new Set(ids(v)).size === 5, ids(v))
  const verboten = new Set([...z.gesehen, ...z.ausgeschlossen].map((i) => 100 + i))
  pruefe('kein Duell-Titel und kein Ausgeschlossener unter den Vorschlägen', ids(v).every((id) => !verboten.has(id)), ids(v))
  const frei = z.rest.filter((i) => !z.gesehen.includes(i) && !z.ausgeschlossen.includes(i))
  const nah = (i: number): number => z.sieger.reduce((s, w) => s + cos(k, w, i), 0) / z.sieger.length
  const bester = Math.max(...frei.map(nah))
  pruefe('die Vorschläge kommen aus der Restmenge, solange sie reicht', frei.length < 5 || ids(v).every((id) => frei.includes(id - 100)), ids(v))
  pruefe('der erste Vorschlag ist der den Siegern nächste (unabhängig nachgerechnet)', nah(ids(v)[0] - 100) >= bester - 2e-4, { erster: nah(ids(v)[0] - 100), bester })
  pruefe('die Vorschläge sind nach Nähe zu den Siegern geordnet', ids(v).slice(1).every((id, j) => nah(ids(v)[j] - 100) >= nah(id - 100) - 2e-4))
  const bilanz = (verworfen: number[]): number[] => ids(vorschlaege(k, z, verworfen))
  const vorher = ids(v)
  const ohneErsten = bilanz([vorher[0]])
  pruefe('Verworfen: der Titel kommt nicht wieder, der Platz wird aufgefüllt', !ohneErsten.includes(vorher[0]) && ohneErsten.length === 5, ohneErsten)
  pruefe('Verworfen: die übrigen vier behalten ihre Reihenfolge', gleich(ohneErsten.slice(0, 4), vorher.slice(1, 5)), ohneErsten)
  pruefe('Verworfen rückgängig: exakt die frühere Liste', gleich(bilanz([]), vorher) && gleich(bilanz([vorher[0], vorher[1]]), bilanz([vorher[1], vorher[0]])))
  const einzeln = bilanz([vorher[0], vorher[1]])
  pruefe('zwei verworfen, einen zurückgeholt: der andere bleibt fort', !bilanz([vorher[1]]).includes(vorher[1]) && bilanz([vorher[1]]).includes(vorher[0]) && einzeln.length === 5)
  let alle: number[] = []
  let wieder = 0
  for (let i = 0; i < 25; i++) {
    const neu = bilanz(alle)
    wieder += neu.filter((id) => alle.includes(id)).length
    alle = [...alle, neu[0]]
  }
  pruefe('25 Mal den ersten verworfen: nie taucht ein Verworfener wieder auf', wieder === 0, wieder)
  pruefe('Verworfen über den Teil einer Reihe (9001 = Einstieg 100) schließt den Einstieg aus', !bilanz([9001]).includes(100) && gleich(bilanz([100]), bilanz([9001])))
  const wenige = neuerZustand(k, 1, Array.from({ length: 37 }, (_, i) => 100 + i))
  pruefe('nur drei Titel übrig: drei Vorschläge, kein Absturz', ids(vorschlaege(k, wenige)).length === 3, ids(vorschlaege(k, wenige)))
  pruefe('mit Anzahl 2: zwei', vorschlaege(k, z, [], 2).length === 2 && gleich(ids(vorschlaege(k, z, [], 2)), vorher.slice(0, 2)))
  const mitAb = new Set<number>()
  for (let s = 1; s <= 30; s++) vorschlaege(k, spiele(neuerZustand(k, s), 6).z).forEach((x) => x.ab && mitAb.add(x.id))
  pruefe('Titel „ab Staffel 2“ dürfen vorgeschlagen werden (nur nie im Duell)', mitAb.size > 0, mitAb.size)
}

console.log('\nEmpfehlung, Zurück:')
{
  let s = neueSitzung(neuerZustand(k, 8))
  const stand: string[] = [JSON.stringify(s)]
  const paare: Array<[number, number] | null> = [naechstesPaar(k, s.zustand)]
  const antworten: Antwort[] = ['A', 'N', 'B', 'A', 'N', 'B', 'B']
  for (const a of antworten) {
    s = antworteSitzung(k, s, a)
    stand.push(JSON.stringify(s))
    paare.push(naechstesPaar(k, s.zustand))
  }
  pruefe('Verlauf wächst mit jeder Antwort', s.verlauf.length === antworten.length)
  let alleGleich = true
  for (let i = antworten.length - 1; i >= 0; i--) {
    s = zurueck(s)
    if (JSON.stringify(s) !== stand[i] || !gleich(naechstesPaar(k, s.zustand), paare[i])) alleGleich = false
  }
  pruefe('sieben Mal zurück: jedes Mal exakt der Zustand von damals und dasselbe Paar', alleGleich)
  pruefe('am Anfang: zurück ändert nichts', zurueck(s) === s)
  const vorEingabe = JSON.stringify(s)
  antworteSitzung(k, s, 'A')
  pruefe('Antworten verändert die alte Sitzung nicht', JSON.stringify(s) === vorEingabe)
  const ohnePaar = neueSitzung({ ...neuerZustand(k, 1), rest: [0] })
  pruefe('ohne Paar wächst der Verlauf nicht', antworteSitzung(k, ohnePaar, 'A') === ohnePaar)
  const nachNeutral = antworteSitzung(k, neueSitzung(neuerZustand(k, 8)), 'N')
  pruefe('neutral lässt sich zurücknehmen', gleich(zurueck(nachNeutral).zustand, neuerZustand(k, 8)))
  const aufDatei = JSON.parse(JSON.stringify(s.zustand)) as Zustand
  pruefe('Zustand übersteht JSON (Speicher) ohne Verlust', gleich(naechstesPaar(k, aufDatei), naechstesPaar(k, s.zustand)))
}

/** 24 Einstiege in drei Gruppen (X, Y, Z) mit je gleichen Merkmalen: Z liegt X und Y gleich nah (Gleichstand), innerhalb der Gruppen sind alle gleich. */
function zwillinge(): EmpfehlungsDatei {
  const einstiege: Kandidat[] = []
  for (let i = 0; i < 24; i++) {
    const gruppe = Math.floor(i / 8)
    einstiege.push({ id: 500 + i, n: `Z${i}`, f: 'TV', y: 2012, e: 12, g: [gruppe * 2, gruppe * 2 + 1], k: [], fsk: 12, v: 70, p: [['netflix']], duell: true })
  }
  return { pool: 24, genres: ['a', 'b', 'c', 'd', 'e', 'f'], keywords: [], einstiege, reihe: {} }
}

console.log('\nEmpfehlung, Grenzfälle der Eingrenzung (Gleichstand, Untergrenze, Auffüllen):')
{
  const kz = baueKontext(zwillinge())
  const gruppeVon = (i: number): number => Math.floor(i / 8)
  const zahlen = (n: number, von: number): number[] => Array.from({ length: n }, (_, j) => von + j)
  let gleichstandOk = true
  let auffuellenOk = true
  for (let s = 1; s <= 30; s++) {
    const z = neuerZustand(kz, s)
    const [a, b] = naechstesPaar(kz, z)!
    const sieger = gruppeVon(a) === gruppeVon(b) ? -1 : a
    if (sieger < 0) continue
    const nachA = antworte(kz, z, 'A')
    const erwartet = zahlen(24, 0).filter((t) => gruppeVon(t) === gruppeVon(a) || gruppeVon(t) === 3 - gruppeVon(a) - gruppeVon(b))
    if (!gleich(nachA.rest, erwartet)) gleichstandOk = false
    const ohneZ = neuerZustand(kz, s, zahlen(8, 516))
    const [c, d] = naechstesPaar(kz, ohneZ)!
    const nachC = antworte(kz, ohneZ, 'A')
    const andere = gruppeVon(c) === 0 ? 1 : 0
    const erwartetAuf = [...zahlen(8, gruppeVon(c) * 8), ...zahlen(4, andere * 8)]
    if (gruppeVon(c) !== gruppeVon(d) && !gleich(nachC.rest, erwartetAuf)) auffuellenOk = false
  }
  pruefe('Gleichstand zählt zum Sieger: Gruppe Z (gleich nah an beiden) bleibt in der Restmenge', gleichstandOk)
  pruefe('unter der Untergrenze: die zwölf nächsten, Gleichstand nach niedrigster Nummer (8 vom Sieger + 4 niedrigste der anderen)', auffuellenOk)
  const nah = (rest: number[], a: number, b: number): number => teilung(kz, rest, a, b)
  pruefe('Teilung: Anteil der Restmenge, der a mindestens so nah liegt wie b (X gegen Y: 8 + 8 Z im Gleichstand von 24 = 2/3)', Math.abs(nah(zahlen(24, 0), 0, 8) - 16 / 24) < 1e-12, nah(zahlen(24, 0), 0, 8))
  pruefe('Teilung: X gegen Y ohne Z: 1/2', nah(zahlen(16, 0), 0, 8) === 0.5)
  pruefe('Teilung: zwei Titel nahe a, einer nahe b: 2/3', Math.abs(nah([0, 1, 8], 0, 8) - 2 / 3) < 1e-12)
  const lang = baueKontext(kulisse())
  let genau = 0
  let abweichung = 0
  for (let m = 12; m <= 40; m++) {
    for (let s = 1; s <= 25; s++) {
      const z = { ...neuerZustand(lang, s), rest: zahlen(m, 0) }
      const paar = naechstesPaar(lang, z)
      if (!paar) continue
      const nah = z.rest.filter((t) => cos(lang, t, paar[0]) >= cos(lang, t, paar[1]))
      const nach = antworte(lang, z, 'A').rest
      if (nah.length === UNTER) genau++
      if (nah.length >= UNTER ? !gleich(nach, nah) : nach.length !== UNTER) abweichung++
    }
  }
  pruefe('Restmenge nach einem Duell: genau die dem Sieger näheren, oder zwölf; 725 Zustände', abweichung === 0, abweichung)
  pruefe('darunter Zustände, in denen genau zwölf näher liegen (Randfall der Untergrenze)', genau > 0, genau)
}

console.log('\nEmpfehlung, Profile der Simulation (Wache gegen Datendrift):')
{
  const mitIsekaiKomoedie = (n: number): EmpfehlungsDatei => ({
    ...mini(Array.from({ length: n }, () => ({ g: [0, 1] })), ['Isekai', 'Comedy'], []),
  })
  const g10 = brauchbareProfile(baueKontext(mitIsekaiKomoedie(10)))
  const g9 = brauchbareProfile(baueKontext(mitIsekaiKomoedie(9)))
  pruefe('Profil mit genau 10 Kerntiteln bleibt', g10.profile.map((p) => p.name).includes('Isekai-Komödie') && !g10.uebersprungen.some((u) => u.startsWith('Isekai-Komödie')))
  pruefe('Profil mit 9 Kerntiteln wird übersprungen und mit Zahl genannt', !g9.profile.map((p) => p.name).includes('Isekai-Komödie') && g9.uebersprungen.includes('Isekai-Komödie (9)'), g9.uebersprungen)
  const leer = brauchbareProfile(baueKontext(mini([])))
  pruefe('Datei ohne passende Schlagwörter: kein Profil, alle fünf übersprungen (kein Absturz)', leer.profile.length === 0 && leer.uebersprungen.length === 5, leer.uebersprungen)
  pruefe('Profilmenge fest: fünf Profile', Object.keys(PROFILE).length === 5)
  const gut: Messwerte = { q4: 0.43, q6: 0.55, q12: 0.61, q6neutral: 0.58, rest: [186, 52, 16] }
  const mit = (m: Partial<Messwerte>): string[] => schwellenFehler({ ...gut, ...m })
  const restMit = (i: number, w: number): string[] => mit({ rest: gut.rest.map((r, j) => (j === i ? w : r)) })
  pruefe('Schwellen: die Werte vom 20.10.2026 sind in Ordnung', mit({}).length === 0, mit({}))
  pruefe('Schwelle nach 6 Duellen: 50 % gilt, 49,9 % nicht', mit({ q6: 0.5 }).length === 0 && mit({ q6: 0.499 }).length === 1)
  pruefe('Schwelle nach 4 Duellen: 30 % ist Zufallsbereich, 30,1 % nicht', mit({ q4: 0.3 }).length === 1 && mit({ q4: 0.301 }).length === 0)
  pruefe('Anstieg: gleiche Quote nach 6 und 12 Duellen ist ein Fehler', mit({ q12: 0.55 }).length === 1 && mit({ q12: 0.551 }).length === 0)
  pruefe('Anstieg: gleiche Quote nach 4 und 6 Duellen ist ein Fehler', mit({ q4: 0.55 }).length === 1)
  pruefe('Schwelle bei 30 % neutral: 40 % gilt, 39,9 % nicht', mit({ q6neutral: 0.4 }).length === 0 && mit({ q6neutral: 0.399 }).length === 1)
  const grenzen = [[0, 120, 400], [1, 35, 140], [2, 12, 50]] as const
  for (const [i, unten, oben] of grenzen) {
    pruefe(`Restmenge nach ${[2, 4, 6][i]} Duellen: ${unten} und ${oben} sind schon außerhalb, ${unten + 1} und ${oben - 1} nicht`, restMit(i, unten).length === 1 && restMit(i, oben).length === 1 && restMit(i, unten + 1).length === 0 && restMit(i, oben - 1).length === 0)
  }
  pruefe('mehrere Verstöße ergeben mehrere Meldungen', mit({ q6: 0.4, q6neutral: 0.3 }).length >= 2)
}

console.log('\nEmpfehlung, Zufall, Abzüge und Rangfolge (Gegenproben):')
{
  const z0 = neuerZustand(k, 4)
  const verschieden = (liste: Array<[number, number] | null>): boolean => new Set(liste.map((p) => p!.join())).size > 1
  pruefe('der Schritt geht in die Paarwahl ein (gleiche Restmenge, anderer Schritt, anderes Paar)', verschieden(Array.from({ length: 12 }, (_, j) => naechstesPaar(k, { ...z0, schritt: j }))))
  pruefe('der Startwert geht in die Paarwahl ein', verschieden(Array.from({ length: 12 }, (_, j) => naechstesPaar(k, { ...z0, startwert: j }))))
  const mittelCos = (paare: Array<[number, number]>): number => paare.reduce((s, [a, b]) => s + cos(k, a, b), 0) / paare.length
  let alle = 0
  let n = 0
  for (let i = 0; i < 40; i++) for (let j = i + 1; j < 40; j++, n++) alle += cos(k, i, j)
  const erste = Array.from({ length: 80 }, (_, s) => naechstesPaar(k, neuerZustand(k, s + 1))!)
  pruefe('erste Duelle sind weit auseinander: mittlere Ähnlichkeit des Paars unter dem Durchschnitt aller Paare', mittelCos(erste) < (alle / n) * 0.8, { paare: mittelCos(erste), alle: alle / n })
  const teilung = (a: number, b: number): number => neuerZustand(k, 1).rest.filter((t) => cos(k, t, a) >= cos(k, t, b)).length / 40
  const nahBeiHalb = erste.reduce((s, [a, b]) => s + Math.abs(teilung(a, b) - 0.5), 0) / erste.length
  pruefe('erste Duelle teilen die Menge ungefähr hälftig (im Mittel höchstens 0,2 daneben)', nahBeiHalb < 0.2, nahBeiHalb)
  const w = 7
  const fern = z0.rest.filter((t) => t !== w).sort((p, q) => cos(k, p, w) - cos(k, q, w)).slice(0, 6)
  const engeRest = { ...z0, rest: fern, sieger: [w], gesehen: [w] }
  const aus = ids(vorschlaege(k, engeRest, [], 5))
  pruefe('Restmenge geht vor Ähnlichkeit: auch weit entfernte Titel der Restmenge stehen vor näheren außerhalb', aus.length === 5 && aus.every((id) => fern.includes(id - 100)), aus)
  const rest5 = { ...z0, rest: [0, 1, 2, 3, 4], sieger: [0], gesehen: [] as number[] }
  pruefe('Verworfen über den Teil 9001 trifft den Einstieg 100 auch an der Spitze der Liste', ids(vorschlaege(k, rest5, [])).includes(100) && !ids(vorschlaege(k, rest5, [9001])).includes(100))
  const ohneSieger = (s: number): string => ids(vorschlaege(k, neuerZustand(k, s))).join()
  pruefe('ohne Sieger (nur „kann nicht“) hängt die Reihenfolge vom Startwert ab, bei gleichem Startwert nicht', new Set(Array.from({ length: 10 }, (_, s) => ohneSieger(s + 1))).size > 1 && ohneSieger(3) === ohneSieger(3))
}

/** Datei aus Einträgen mit nur den angegebenen Merkmalen; zehn Füller mit dem Genre `A` (immer dabei) sorgen für Mindesthäufigkeiten. */
function mini(eintraege: Array<Partial<Kandidat>>, genres = ['A', 'X', 'Y', 'Z'], keywords = ['K', 'L']): EmpfehlungsDatei {
  const fueller = Array.from({ length: 10 }, (_, i): Kandidat => ({ id: 800 + i, n: `F${i}`, f: 'TV', y: 2012, e: 12, g: [0], k: [], fsk: 12, p: [] }))
  const eigene = eintraege.map((e, i): Kandidat => ({ id: 700 + i, n: `E${i}`, f: 'TV', y: 2012, e: 12, g: [0], k: [], fsk: 12, p: [], ...e }))
  return { pool: 0, genres, keywords, einstiege: [...eigene, ...fueller], reihe: {} }
}

console.log('\nEmpfehlung, Merkmalsvektor im Einzelnen (Gruppengrenzen und Mindesthäufigkeit):')
{
  /** Zwei Einträge, die sich nur in `abweichung` unterscheiden: gleicher Vektor (Ähnlichkeit 1) oder verschiedener. */
  const gleicherVektor = (a: Partial<Kandidat>, b: Partial<Kandidat>): boolean => {
    const kc = baueKontext(mini([a, b]))
    return Math.abs(cos(kc, 0, 1) - 1) < 1e-9
  }
  for (const [a, b, gleichGruppe] of [
    [2004, 2005, false], [2005, 2009, true], [2009, 2010, false], [2010, 2014, true], [2014, 2015, false], [2015, 2019, true], [2019, 2020, false], [2020, 2030, true],
  ] as const) pruefe(`Jahr ${a} und ${b}: ${gleichGruppe ? 'gleiche' : 'verschiedene'} Jahrfünft-Gruppe`, gleicherVektor({ y: a }, { y: b }) === gleichGruppe)
  pruefe('ohne Jahr zählt wie die jüngste Gruppe', gleicherVektor({ y: undefined }, { y: 2024 }))
  for (const [a, b, gleichGruppe] of [[0, 6, true], [6, 12, false], [12, 16, false], [16, 18, true], [undefined, 12, false], [undefined, 16, false], [undefined, 0, false]] as const) {
    pruefe(`FSK ${a ?? 'fehlt'} und ${b}: ${gleichGruppe ? 'gleiche' : 'verschiedene'} Gruppe`, gleicherVektor({ fsk: a }, { fsk: b }) === gleichGruppe)
  }
  for (const [a, b, gleichGruppe] of [[1, 13, true], [13, 14, false], [14, 26, true], [26, 27, false], [undefined, 12, true]] as const) {
    pruefe(`Folgen ${a ?? 'fehlt'} und ${b}: ${gleichGruppe ? 'gleiche' : 'verschiedene'} Längengruppe`, gleicherVektor({ e: a }, { e: b }) === gleichGruppe)
  }
  pruefe('Film und Serie unterscheiden sich, zwei Filme nicht', !gleicherVektor({ f: 'MOVIE' }, { f: 'TV' }) && gleicherVektor({ f: 'MOVIE' }, { f: 'MOVIE' }) && gleicherVektor({ f: 'OVA' }, { f: 'TV' }))
  const mitGenre = mini(Array.from({ length: 5 }, () => ({ g: [0, 1] })))
  const ohneGenre = mini(Array.from({ length: 5 }, () => ({ g: [0] })))
  pruefe('Genre mit 5 Einstiegen wird Dimension, ohne sind Vektoren gleich', cos(baueKontext(mitGenre), 0, 10) < 1 - 1e-9 && Math.abs(cos(baueKontext(ohneGenre), 0, 10) - 1) < 1e-9)
  const mitWort = mini(Array.from({ length: 5 }, () => ({ k: [0] })))
  pruefe('Schlagwort mit 5 Einstiegen wird Dimension (Schlagwörter zählen wie Genres)', cos(baueKontext(mitWort), 0, 10) < 1 - 1e-9)
  const vier = mini(Array.from({ length: 4 }, () => ({ g: [0, 1] })))
  pruefe('Genre mit nur 4 Einstiegen fällt weg (Vektor wie ohne)', Math.abs(cos(baueKontext(vier), 0, 10) - 1) < 1e-9)
  const vierWort = mini(Array.from({ length: 4 }, () => ({ k: [0] })))
  pruefe('Schlagwort mit nur 4 Einstiegen fällt weg', Math.abs(cos(baueKontext(vierWort), 0, 10) - 1) < 1e-9)
  const geteilt = mini([{ g: [0, 1] }, { g: [0, 1] }, { g: [0, 1] }, { k: [0] }, { k: [0] }], ['A', 'X'], ['X'])
  const gk = baueKontext(geteilt)
  pruefe('gleicher Name in Genre (3 Einstiege) und Schlagwort (2): eine Dimension, beide Seiten tragen sie', cos(gk, 0, 5) < 1 - 1e-9 && cos(gk, 3, 5) < 1 - 1e-9, [cos(gk, 0, 5), cos(gk, 3, 5)])
  const einTag = baueKontext(mini([{ g: [0, 1] }, ...Array.from({ length: 4 }, () => ({ g: [0, 1] }))]))
  const groesste = Math.max(...einTag.vektoren[0])
  pruefe('Gruppen zählen halb gegenüber Genres: größte Komponente 1/√(2 + 3·0,25)', Math.abs(groesste - 1 / Math.sqrt(2 + 0.75)) < 1e-9, groesste)
  const r = zufall(1)
  const folge = [r(), r(), r()].map((x) => Math.round(x * 1e9))
  pruefe('Zufall: bekannte mulberry32-Folge für Startwert 1 (0,6270739…)', gleich(folge, [627073941, 2735721, 527447040]), folge)
}

if (verletzt > 0) {
  console.error(`\nEmpfehlung (Kern): ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nEmpfehlung (Kern): Paare, Eingrenzung, neutral, Zurück, Vorschläge mit Verworfenen und Abzüge in Ordnung')
