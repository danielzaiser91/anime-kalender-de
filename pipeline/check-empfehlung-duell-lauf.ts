/**
 * Lässt die echte Komponente `Duell.tsx` samt Hook `use-duell.ts` laufen (react-dom/client auf dem Mini-DOM aus `tools/mini-dom.ts`,
 * Attrappe-Uhr): Doppelklick ruft genau ein `antworte`, Abbruch beim Abbauen, „Andere Vorschläge“, Zurück.
 * Die Logik dahinter prüft `check-empfehlung-duell.ts`; hier geht es um die React-Anbindung. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { Antwort } from '../shared/empfehlung-kern.ts'
import { naechstesPaar, neueSitzung, neuerZustand } from '../shared/empfehlung-kern.ts'
import type { EmpfehlungsDatei, Kandidat } from '../shared/empfehlung-pool.ts'
import { baueKontext } from '../shared/empfehlung-vektor.ts'
import type { Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { Duell } = await import('../web/src/components/empfehlung/Duell.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const einstiege: Kandidat[] = []
for (let i = 0; i < 60; i++) {
  einstiege.push({ id: 900500 + i, n: `Titel ${i}`, f: 'TV', y: 2000 + ((i * 7) % 25), e: 1 + ((i * 5) % 40), g: [i % 8, (i * 3 + 1) % 8], k: [(i * 5) % 8, (i + 2) % 8], fsk: [0, 6, 12, 16][i % 4], v: 70, p: [['netflix']], duell: true })
}
const datei: EmpfehlungsDatei = {
  pool: 70,
  genres: ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Romance', 'Fantasy', 'Horror', 'Sport'],
  keywords: ['Schule', 'Magie', 'Gegenwart', 'Isekai', 'Weltraum', 'Slapstick', 'Rache', 'Musik'],
  einstiege,
  reihe: {},
}
const kontext = baueKontext(datei)
const titel = new Map<number, Title>(einstiege.map((k) => [k.id, { id: k.id, bannerImage: `https://image.tmdb.org/t/p/w1280/${k.id}.jpg` } as unknown as Title]))

/** Dekodieren endet sofort; so wartet der Wechsel nur auf die Animation. */
const bild = () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() })
const karte = (wurzel: MiniKnoten, seite: 'a' | 'b') => wurzel.finde((k) => k.tagName === 'BUTTON' && k.getAttribute('data-seite') === seite)[0]!
const knopf = (wurzel: MiniKnoten, text: string) => wurzel.finde((k) => k.tagName === 'BUTTON' && k.textContent === text)[0]!
const schritt = (wurzel: MiniKnoten) => wurzel.finde((k) => k.getAttribute('data-schritt') !== null)[0]?.getAttribute('data-schritt')

const klassen = (k: MiniKnoten) => k.getAttribute('class') ?? ''

async function aufbau(verlauf: boolean, reduziert = false) {
  const uhr = attrappeUhr()
  /* Nur die Abfrage nach reduzierter Bewegung antwortet mit `reduziert`; die Breitenabfrage der Karten bleibt schmal. */
  const matchMedia = (abfrage: string) => ({ matches: reduziert && abfrage.includes('prefers-reduced-motion'), addEventListener() {}, removeEventListener() {} })
  const dom = installiereMiniDom({ ...uhr, matchMedia }, bild)
  const antworten: Antwort[] = []
  const scheine: Array<string | undefined> = []
  let zurueckGerufen = 0
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  let sitzung = neueSitzung(neuerZustand(kontext, 5, []))
  if (verlauf) sitzung = { ...sitzung, verlauf: [sitzung.zustand] }
  await act(async () => {
    wurzel.render(h(Duell, { kontext, sitzung, ziel: 6, titel, antworte: (a: Antwort) => void antworten.push(a), zurueck: () => void zurueckGerufen++, schein: (url) => void scheine.push(url) }))
  })
  const schiebe = (ms: number) => uhr.schiebe(ms, (f) => act(async () => f()))
  const klick = (k: MiniKnoten) => act(async () => klicke(dom.wurzel, k))
  const abbau = async () => {
    await act(async () => wurzel.unmount())
    dom.entferne()
  }
  return { dom, antworten, scheine, zurueck: () => zurueckGerufen, schiebe, klick, offen: uhr.offen, abbau }
}

console.log('Duell.tsx und use-duell.ts laufen wirklich')
{
  const t = await aufbau(false)
  const w = t.dom.wurzel
  pruefe('Start: beide Karten da, Schritt bereit', schritt(w) === 'bereit' && !!karte(w, 'a') && !!karte(w, 'b'), schritt(w))
  await t.klick(karte(w, 'a'))
  await t.klick(karte(w, 'b'))
  await t.klick(karte(w, 'a'))
  pruefe('Doppel- und Dreifachklick: Schritt „stoss“, noch kein antworte', schritt(w) === 'stoss' && t.antworten.length === 0, { s: schritt(w), a: t.antworten })
  const idA = naechstesPaar(kontext, neueSitzung(neuerZustand(kontext, 5, [])).zustand)![0]
  pruefe('Schein nur einmal, mit dem Banner des Siegers A (300 px)', t.scheine.length === 1 && t.scheine[0] === `https://image.tmdb.org/t/p/w300/${kontext.datei.einstiege[idA].id}.jpg`, t.scheine)
  pruefe('Sieger gewinnt, Verlierer verliert', klassen(karte(w, 'a')).includes('gewinnt') && klassen(karte(w, 'b')).includes('verliert'), [klassen(karte(w, 'a')), klassen(karte(w, 'b'))])
  await t.schiebe(499)
  pruefe('499 ms: noch kein antworte', t.antworten.length === 0 && schritt(w) === 'abgang', { s: schritt(w), a: t.antworten })
  await t.schiebe(1)
  pruefe('500 ms: genau ein antworte, und zwar die erste Wahl (A)', t.antworten.length === 1 && t.antworten[0] === 'A', t.antworten)
  pruefe('Schritt „herein“, Klick darin wirkungslos', schritt(w) === 'herein')
  pruefe('mit dem Wechsel ist die Wahl gelöscht: keine Karte gewinnt oder verliert mehr', !/gewinnt|verliert/.test(klassen(karte(w, 'a')) + klassen(karte(w, 'b'))), [klassen(karte(w, 'a')), klassen(karte(w, 'b'))])
  await t.klick(karte(w, 'b'))
  await t.schiebe(350)
  pruefe('danach wieder bereit, weiterhin genau ein antworte', schritt(w) === 'bereit' && t.antworten.length === 1, { s: schritt(w), a: t.antworten })
  await t.klick(karte(w, 'b'))
  await t.schiebe(500)
  pruefe('nächster Klick zählt: zweites antworte mit B', t.antworten.length === 2 && t.antworten[1] === 'B', t.antworten)
  await t.abbau()
}
{
  const t = await aufbau(false)
  await t.klick(knopf(t.dom.wurzel, 'Andere Vorschläge'))
  pruefe('„Andere Vorschläge“: Schritt „fall“', schritt(t.dom.wurzel) === 'fall', schritt(t.dom.wurzel))
  await t.schiebe(350)
  pruefe('nach 350 ms: antworte mit N', t.antworten.length === 1 && t.antworten[0] === 'N', t.antworten)
  await t.abbau()
}
{
  const t = await aufbau(false)
  await t.klick(karte(t.dom.wurzel, 'b'))
  await t.abbau()
  pruefe('Abbauen mitten im Duell löscht alle Zeitgeber', t.offen() === 0, t.offen())
  await t.schiebe(10000)
  pruefe('nach dem Abbauen kommt kein antworte mehr', t.antworten.length === 0, t.antworten)
}
{
  const t = await aufbau(true)
  const w = t.dom.wurzel
  await t.klick(karte(w, 'a'))
  await t.klick(knopf(w, '← Zurück'))
  pruefe('Zurück: ruft zurueck genau einmal und bricht den Ablauf ab', t.zurueck() === 1 && schritt(w) === 'bereit' && t.offen() === 0, { z: t.zurueck(), s: schritt(w), o: t.offen() })
  await t.schiebe(10000)
  pruefe('nach Zurück kommt das abgebrochene antworte nicht', t.antworten.length === 0, t.antworten)
  pruefe('Zurück löscht die Wahl: keine Karte gewinnt oder verliert', !/gewinnt|verliert/.test(klassen(karte(w, 'a')) + klassen(karte(w, 'b'))), [klassen(karte(w, 'a')), klassen(karte(w, 'b'))])
  await t.abbau()
}
{
  const t = await aufbau(false, true)
  const w = t.dom.wurzel
  await t.klick(karte(w, 'a'))
  pruefe('reduzierte Bewegung: Schritt „blende“', schritt(w) === 'blende', schritt(w))
  await t.schiebe(149)
  pruefe('reduzierte Bewegung: 149 ms noch kein antworte', t.antworten.length === 0, t.antworten)
  await t.schiebe(1)
  pruefe('reduzierte Bewegung: nach 150 ms antworte A', t.antworten.length === 1 && t.antworten[0] === 'A', t.antworten)
  await t.abbau()
}

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nEmpfehlung (Duell-Lauf): Doppelklick ein antworte, Abbruch beim Abbauen und bei Zurück, „Andere Vorschläge“ in Ordnung')
