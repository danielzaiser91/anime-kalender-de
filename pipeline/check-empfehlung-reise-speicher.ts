/**
 * Zusicherungen zum Merken der letzten Vorschläge in „Entdecken“ (`web/src/lib/empfehlung-reise-speicher.ts`) und zum Weg
 * „Von vorn“: Speichern und Wiederherstellen über die echten Kernfunktionen, kaputte oder veraltete Einträge, gesperrter Speicher,
 * dazu der echte Hook `use-reise.ts` (Mini-DOM): zurückkommen landet bei den Vorschlägen, „Von vorn“ führt zum Start und vergisst sie.
 * Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { EmpfehlungsDatei, Kandidat } from '../shared/empfehlung-pool.ts'
import { baueKontext } from '../shared/empfehlung-vektor.ts'
import { ANFANG, antworten, neueReise, oeffnen, zuStart, type Ablauf } from '../web/src/lib/empfehlung-ablauf.ts'
import { reiseMerken, reiseVergessen, reiseWiederherstellen, type ReiseSpeicher } from '../web/src/lib/empfehlung-reise-speicher.ts'
import { rangliste } from '../web/src/lib/empfehlung-reise.ts'
import { installiereMiniDom, attrappeUhr, ignoriereCss } from '../tools/mini-dom.ts'
ignoriereCss()
const { useReise } = await import('../web/src/components/empfehlung/use-reise.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const einstiege: Kandidat[] = []
for (let i = 0; i < 60; i++) {
  einstiege.push({ id: 900700 + i, n: `Titel ${i}`, f: 'TV', y: 2000 + ((i * 7) % 25), e: 1 + ((i * 5) % 40), g: [i % 8, (i * 3 + 1) % 8], k: [(i * 5) % 8, (i + 2) % 8], fsk: [0, 6, 12, 16][i % 4], v: 70, p: [['netflix']], duell: true })
}
const datei: EmpfehlungsDatei = {
  pool: 70,
  genres: ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Romance', 'Fantasy', 'Horror', 'Sport'],
  keywords: ['Schule', 'Magie', 'Gegenwart', 'Isekai', 'Weltraum', 'Slapstick', 'Rache', 'Musik'],
  einstiege,
  reihe: {},
}
const k = baueKontext(datei)
const KEINE = new Set<number>()
const rang = (z: Parameters<Parameters<typeof antworten>[3]>[0]) => rangliste(k, z, [], new Set())

function attrappe(sperre = false): ReiseSpeicher & { daten: Map<string, string> } {
  const daten = new Map<string, string>()
  const werfen = () => {
    if (sperre) throw new Error('gesperrt')
  }
  return {
    daten,
    getItem: (key) => (werfen(), daten.get(key) ?? null),
    setItem: (key, v) => (werfen(), void daten.set(key, v)),
    removeItem: (key) => (werfen(), void daten.delete(key)),
  }
}

/** Eine Reise bis zu den Vorschlägen, mit dem Wechsel A/B, damit die Antworten verschieden sind. */
function ergebnis(): Ablauf {
  let a = neueReise(k, ANFANG, 7, [])
  for (let i = 0; a.phase === 'duell' && i < 30; i++) a = antworten(k, a, i % 2 ? 'B' : 'A', rang)
  return a
}
const fertig = ergebnis()

console.log('Merken und Wiederherstellen')
{
  pruefe('Kulisse: die Reise endet bei den Vorschlägen', fertig.phase === 'ergebnis' && fertig.gezeigt.length === 5, fertig.phase)
  const s = attrappe()
  reiseMerken(fertig, s)
  const zurueck = reiseWiederherstellen(k, KEINE, s)
  pruefe('Ergebnis: wieder bei den Vorschlägen, dieselben fünf', zurueck?.phase === 'ergebnis' && JSON.stringify(zurueck.gezeigt) === JSON.stringify(fertig.gezeigt), zurueck?.gezeigt)
  pruefe('Ziel und Zustand kommen zurück (genauer geht weiter)', zurueck?.ziel === fertig.ziel && JSON.stringify(zurueck.sitzung?.zustand) === JSON.stringify(fertig.sitzung?.zustand))
  pruefe('Der Verlauf ist leer (Zurück im Duell gibt es nicht)', zurueck?.sitzung?.verlauf.length === 0)

  const s2 = attrappe()
  reiseMerken(oeffnen(fertig, fertig.gezeigt[1]), s2)
  pruefe('Leinwand wird gemerkt, kommt aber als Galerie zurück', reiseWiederherstellen(k, KEINE, s2)?.phase === 'ergebnis')

  const s3 = attrappe()
  reiseMerken({ ...fertig, phase: 'duell' }, s3)
  pruefe('Mitten im Duell wird nichts gemerkt', s3.daten.size === 0)
  reiseMerken(ANFANG, s3)
  pruefe('Der Anfang wird nicht gemerkt', s3.daten.size === 0)
  pruefe('Nichts gemerkt → undefined', reiseWiederherstellen(k, KEINE, attrappe()) === undefined)
}

console.log('Veraltet und kaputt')
{
  const s = attrappe()
  reiseMerken(fertig, s)
  const [a, b] = fertig.gezeigt
  const ohne = reiseWiederherstellen(k, new Set([a, b]), s)
  pruefe('Seitdem verworfene oder gesehene Titel fehlen', JSON.stringify(ohne?.gezeigt) === JSON.stringify(fertig.gezeigt.slice(2)), ohne?.gezeigt)
  pruefe('Genau einer übrig → noch da (Schwelle 1)', reiseWiederherstellen(k, new Set(fertig.gezeigt.slice(1)), s)?.gezeigt.length === 1)
  pruefe('Alle weg → Start statt leerer Galerie', reiseWiederherstellen(k, new Set(fertig.gezeigt), s) === undefined)

  const kaputt = ['', '{', 'null', '[]', '{"ziel":6}', '"x"']
  for (const roh of kaputt) {
    const t = attrappe()
    t.daten.set('empfehlung:reise', roh)
    pruefe(`Eintrag ${JSON.stringify(roh)} → undefined`, reiseWiederherstellen(k, KEINE, t) === undefined)
  }
  const gespeichert = JSON.parse(s.daten.get('empfehlung:reise')!) as { zustand: Record<string, unknown>; gezeigt: unknown[]; ziel: number }
  const mit = (aendere: (r: typeof gespeichert) => void) => {
    const kopie = JSON.parse(s.daten.get('empfehlung:reise')!) as typeof gespeichert
    aendere(kopie)
    const t = attrappe()
    t.daten.set('empfehlung:reise', JSON.stringify(kopie))
    return reiseWiederherstellen(k, KEINE, t)
  }
  pruefe('Kontrolle: unveränderter Eintrag geht', mit(() => undefined) !== undefined)
  pruefe('Index außerhalb des Pools (rest) → undefined', mit((r) => ((r.zustand.rest as number[])[0] = 60)) === undefined)
  pruefe('Index im Pool (rest, 59) → geht', mit((r) => ((r.zustand.rest as number[])[0] = 59)) !== undefined)
  pruefe('Index außerhalb (sieger) → undefined', mit((r) => (r.zustand.sieger = [60])) === undefined)
  pruefe('Index außerhalb (gesehen) → undefined', mit((r) => (r.zustand.gesehen = [-1])) === undefined)
  pruefe('Index außerhalb (ausgeschlossen) → undefined', mit((r) => (r.zustand.ausgeschlossen = [1.5])) === undefined)
  pruefe('Neutral mit falscher Länge → undefined', mit((r) => (r.zustand.neutral = [1])) === undefined)
  pruefe('Neutral als Paar → geht', mit((r) => (r.zustand.neutral = [1, 2])) !== undefined)
  pruefe('Ziel keine Zahl → undefined', mit((r) => ((r as { ziel: unknown }).ziel = 'x')) === undefined)
  pruefe('Schritt keine Zahl → undefined', mit((r) => (r.zustand.schritt = null)) === undefined)
  pruefe('Kennung keine Ganzzahl → undefined', mit((r) => (r.gezeigt = [1.5])) === undefined)

  const gesperrt = attrappe(true)
  let geworfen = false
  try {
    reiseMerken(fertig, gesperrt)
    reiseVergessen(gesperrt)
    pruefe('Gesperrter Speicher: Wiederherstellen → undefined', reiseWiederherstellen(k, KEINE, gesperrt) === undefined)
  } catch {
    geworfen = true
  }
  pruefe('Gesperrter Speicher wirft nicht', !geworfen)
}

console.log('Von vorn')
{
  const s = attrappe()
  reiseMerken(fertig, s)
  const start = zuStart()
  pruefe('Von vorn: Startbildschirm ohne Sitzung und Galerie', start.phase === 'start' && !start.sitzung && start.gezeigt.length === 0)
  reiseVergessen(s)
  pruefe('Von vorn vergisst die Vorschläge', s.daten.size === 0 && reiseWiederherstellen(k, KEINE, s) === undefined)
  reiseVergessen(s)
  pruefe('Zweimal ist harmlos', s.daten.size === 0)
}

console.log('Der Hook läuft wirklich (use-reise.ts)')
{
  const speicher = attrappe()
  const g = globalThis as unknown as { localStorage: ReiseSpeicher }
  g.localStorage = speicher
  const mengen = { favoriten: new Set<number>(), ausgeblendet: new Set<number>(), gesehen: new Set<number>(), verworfen: new Set<number>(), eigene: [] as string[] }
  type Reise = ReturnType<typeof useReise>
  const aufbau = async () => {
    const dom = installiereMiniDom(attrappeUhr(), () => ({}))
    let jetzt!: Reise
    const Probe = () => {
      jetzt = useReise(k, mengen, () => 7)
      return h('div')
    }
    const wurzel = createRoot(dom.wurzel as unknown as Element)
    await act(async () => wurzel.render(h(Probe)))
    return { reise: () => jetzt, abbau: async () => { await act(async () => wurzel.unmount()); dom.entferne() } }
  }
  const erster = await aufbau()
  pruefe('Erster Besuch: Start', erster.reise().phase === 'start')
  await act(async () => erster.reise().neu())
  for (let i = 0; erster.reise().phase === 'duell' && i < 30; i++) await act(async () => erster.reise().antworte(i % 2 ? 'B' : 'A'))
  const gezeigt = erster.reise().gezeigt
  pruefe('Reise endet bei den Vorschlägen und schreibt sie weg', erster.reise().phase === 'ergebnis' && speicher.daten.has('empfehlung:reise'), erster.reise().phase)
  await erster.abbau()
  const zweiter = await aufbau()
  pruefe('Wiederkommen: gleich bei denselben Vorschlägen', zweiter.reise().phase === 'ergebnis' && JSON.stringify(zweiter.reise().gezeigt) === JSON.stringify(gezeigt), zweiter.reise().phase)
  pruefe('Wiederkommen: genauer geht weiter', zweiter.reise().kannGenauer && !!zweiter.reise().stehen)
  await act(async () => zweiter.reise().entferne(gezeigt[0]))
  pruefe('Ein Titel weg: der nächste rückt nach, fünf bleiben', zweiter.reise().gezeigt.length === 5 && !zweiter.reise().gezeigt.includes(gezeigt[0]), zweiter.reise().gezeigt)
  await act(async () => zweiter.reise().vonVorn())
  pruefe('Von vorn: Startbildschirm, Eintrag gelöscht', zweiter.reise().phase === 'start' && !speicher.daten.has('empfehlung:reise'), zweiter.reise().phase)
  await zweiter.abbau()
  const dritter = await aufbau()
  pruefe('Danach wieder Start statt alter Vorschläge', dritter.reise().phase === 'start', dritter.reise().phase)
  await dritter.abbau()
}

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nEmpfehlung (Reise-Speicher): Merken, Wiederkommen und Von vorn in Ordnung')
