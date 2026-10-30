/**
 * Rendert die echte `EmpfehlungView` (Mini-DOM aus `tools/mini-dom.ts`) mit einem gemerkten Stand, der zu einem fremden Pool gehört:
 * drei gemerkte Vorschläge, kein Duellstand → die Ansicht zeigt wieder fünf Vorschläge (Auffüllen aus der Rangliste, `fuelleAuf`)
 * und zeichnet keine Einleitung. Daneben: selber Pool mit offenem Duell → Fortsetzen; kaputter Stand → Start.
 * Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { EmpfehlungsDatei, Kandidat } from '../shared/empfehlung-pool.ts'
import { baueKontext } from '../shared/empfehlung-vektor.ts'
import { neuerZustand } from '../shared/empfehlung-kern.ts'
import type { Dataset } from '../web/src/lib/data.ts'
import { poolKennung, REISE_SCHLUESSEL } from '../web/src/lib/empfehlung-reise-speicher.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { default: EmpfehlungView } = await import('../web/src/components/empfehlung/EmpfehlungView.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const einstiege: Kandidat[] = []
for (let i = 0; i < 60; i++) {
  einstiege.push({ id: 900800 + i, n: `Titel ${i}`, f: 'TV', y: 2000 + ((i * 7) % 25), e: 1 + ((i * 5) % 40), g: [i % 8, (i * 3 + 1) % 8], k: [(i * 5) % 8, (i + 2) % 8], fsk: [0, 6, 12, 16][i % 4], v: 70, p: [['netflix']], duell: true })
}
const datei: EmpfehlungsDatei = {
  pool: 70,
  genres: ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Romance', 'Fantasy', 'Horror', 'Sport'],
  keywords: ['Schule', 'Magie', 'Gegenwart', 'Isekai', 'Weltraum', 'Slapstick', 'Rache', 'Musik'],
  einstiege,
  reihe: {},
}
const kontext = baueKontext(datei)
const drei = [einstiege[3]!.id, einstiege[11]!.id, einstiege[27]!.id]

/** Gemerkter Stand: `pool` ist die Kennung des Pools, aus dem er stammt (fremd = andere Zahl). */
const gemerkt = (pool: number) => JSON.stringify({ ziel: 5, gezeigt: drei, zustand: neuerZustand(kontext, 7, []), pool })

const speicher = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => void speicher.set(k, v), removeItem: (k: string) => void speicher.delete(k) },
  fetch: async (adresse: string) => {
    const körper = adresse.includes('empfehlung') ? datei : []
    return { ok: true, status: 200, json: async () => körper }
  },
})

const karten = (wurzel: MiniKnoten) => wurzel.finde((k) => k.tagName === 'LI' && (k.getAttribute('class') ?? '').includes('empf-rein'))

async function zeige(stand: string) {
  speicher.clear()
  speicher.set(REISE_SCHLUESSEL, stand)
  const uhr = attrappeUhr()
  const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() }))
  const wurzel = createRoot(dom.wurzel as never)
  const data = { titles: [], titleById: new Map(), releases: [], releaseBySlug: new Map(), events: [], eventsByDate: new Map(), releasesByTitle: new Map(), meta: {} } as unknown as Dataset
  await act(async () => wurzel.render(h(EmpfehlungView, { data })))
  /* Die Kontextrechnung läuft nach dem ersten Bild (setTimeout 0); die Attrappe-Uhr stellt sie vor. */
  await act(async () => {
    await new Promise((r) => setImmediate(r))
    await uhr.schiebe(1, (f) => act(async () => f()))
  })
  await act(async () => {
    await new Promise((r) => setImmediate(r))
    await uhr.schiebe(1, (f) => act(async () => f()))
  })
  const ergebnis = { karten: karten(dom.wurzel), text: dom.wurzel.textContent }
  await act(async () => wurzel.unmount())
  dom.entferne()
  return ergebnis
}

console.log('EmpfehlungView mit gemerktem Stand')
const fremd = await zeige(gemerkt(poolKennung(kontext) ^ 1))
pruefe('Fremder Pool: die Ansicht zeigt die Vorschläge, nicht die Einleitung', fremd.karten.length > 0, fremd.text.slice(0, 80))
pruefe('Fremder Pool: aus drei gemerkten werden fünf Vorschläge (Auffüllen)', fremd.karten.length === 5, fremd.karten.length)
const eigen = await zeige(gemerkt(poolKennung(kontext)))
const leer = await zeige('kaputt')
pruefe('Eigener Pool, Duell offen: die Ansicht bietet das Fortsetzen statt der Vorschläge', eigen.karten.length === 0 && eigen.text !== leer.text, eigen.text.slice(0, 80))
pruefe('Kaputter Stand: keine Vorschläge, die Ansicht fällt auf den Start zurück', leer.karten.length === 0, leer.karten.length)

if (verletzt) {
  console.error(`${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('EmpfehlungView: gemerkter Stand bei fremdem und eigenem Pool wird auf fünf Vorschläge aufgefüllt, offener eigener Stand bietet das Fortsetzen, kaputter Stand fällt auf den Start zurück')
