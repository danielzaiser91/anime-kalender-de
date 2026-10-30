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
import type { Zustand } from '../shared/empfehlung-kern.ts'
import { ANFANG, antworten, fortfahren, neueReise, oeffnen, vorschauIds, zuStart, type Ablauf } from '../web/src/lib/empfehlung-ablauf.ts'
import { reiseMerken, reiseVergessen, reiseWiederherstellen, type ReiseSpeicher } from '../web/src/lib/empfehlung-reise-speicher.ts'
import { zeichnung, type Zeichenlage } from '../web/src/lib/empfehlung-zeichnung.ts'
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
/** Die Lage, in der `EmpfehlungView` einen wiederhergestellten Ablauf zeichnet (Daten geladen, Hook-Felder aus dem Ablauf). */
const lage = (a: Ablauf): Zeichenlage => ({ kontext: true, phase: a.phase, sitzung: !!a.sitzung, fortsetzbar: !!a.sitzung, aktuell: a.aktuell !== undefined })
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
  reiseMerken(fertig, k, s)
  const zurueck = reiseWiederherstellen(k, KEINE, s)
  pruefe('Ergebnis: wieder bei den Vorschlägen, dieselben fünf', zurueck?.phase === 'ergebnis' && JSON.stringify(zurueck.gezeigt) === JSON.stringify(fertig.gezeigt), zurueck?.gezeigt)
  pruefe('Ziel und Zustand kommen zurück (genauer geht weiter)', zurueck?.ziel === fertig.ziel && JSON.stringify(zurueck.sitzung?.zustand) === JSON.stringify(fertig.sitzung?.zustand))
  pruefe('Der Verlauf ist leer (Zurück im Duell gibt es nicht)', zurueck?.sitzung?.verlauf.length === 0)

  const s2 = attrappe()
  reiseMerken(oeffnen(fertig, fertig.gezeigt[1]), k, s2)
  pruefe('Leinwand wird gemerkt, kommt aber als Galerie zurück', reiseWiederherstellen(k, KEINE, s2)?.phase === 'ergebnis')

  const s3 = attrappe()
  const frisch = neueReise(k, ANFANG, 7, [])
  reiseMerken(frisch, k, s3)
  pruefe('Duell ohne gewertete Antwort wird nicht gemerkt', s3.daten.size === 0)
  const eine = antworten(k, frisch, 'A', rang)
  reiseMerken(eine, k, s3)
  const offen = reiseWiederherstellen(k, KEINE, s3)
  pruefe('Duell mit genau einer Antwort wird gemerkt und kommt als Start zum Fortfahren zurück', offen?.phase === 'start' && offen.sitzung?.zustand.gewertet === 1 && offen.ziel === 6, offen?.phase)
  pruefe('Offenes Duell: die Ansicht zeichnet das Fortsetzen', offen !== undefined && zeichnung(lage(offen)) === 'fortsetzen', offen && zeichnung(lage(offen)))
  pruefe('Ergebnis mit Duellstand: die Ansicht zeichnet die Vorschläge', zurueck !== undefined && zeichnung(lage(zurueck)) === 'ergebnis')
  pruefe('Zum offenen Duell gehört ein Zustand, den fortfahren() ins Duell zurückführt', fortfahren(k, offen!).phase === 'duell')
  s3.daten.clear()
  reiseMerken(ANFANG, k, s3)
  pruefe('Der Anfang wird nicht gemerkt', s3.daten.size === 0)
  pruefe('Nichts gemerkt → undefined', reiseWiederherstellen(k, KEINE, attrappe()) === undefined)
}

console.log('Veraltet und kaputt')
{
  const s = attrappe()
  reiseMerken(fertig, k, s)
  const [a, b] = fertig.gezeigt
  const ohne = reiseWiederherstellen(k, new Set([a, b]), s)
  const weitere = ohne?.gezeigt.slice(3) ?? []
  pruefe('Seitdem verworfene oder gesehene Titel fehlen, die übrigen bleiben vorn', JSON.stringify(ohne?.gezeigt.slice(0, 3)) === JSON.stringify(fertig.gezeigt.slice(2)) && !ohne?.gezeigt.some((id) => id === a || id === b), ohne?.gezeigt)
  pruefe('Zwei fehlen → aus der Rangliste auf fünf aufgefüllt, ohne Doppelte', ohne?.gezeigt.length === 5 && new Set(ohne.gezeigt).size === 5, ohne?.gezeigt)
  const rangOhne = rangliste(k, (JSON.parse(s.daten.get('empfehlung:reise')!) as { zustand: Zustand }).zustand, [a, b], new Set()).map((x) => x.id)
  const erwartet = rangOhne.filter((id) => !fertig.gezeigt.slice(2).includes(id)).slice(0, 2)
  pruefe('Aufgefüllt in der Reihenfolge der Rangliste', JSON.stringify(weitere) === JSON.stringify(erwartet), weitere)
  const einer = reiseWiederherstellen(k, new Set(fertig.gezeigt.slice(1)), s)
  pruefe('Genau einer übrig → wieder fünf (Schwelle 1)', einer?.gezeigt.length === 5 && einer.gezeigt[0] === fertig.gezeigt[0] && new Set(einer.gezeigt).size === 5, einer?.gezeigt)
  pruefe('Alle weg → Start statt leerer Galerie', reiseWiederherstellen(k, new Set(fertig.gezeigt), s) === undefined)

  const kaputt = ['', '{', 'null', '[]', '{"ziel":6}', '"x"']
  for (const roh of kaputt) {
    const t = attrappe()
    t.daten.set('empfehlung:reise', roh)
    pruefe(`Eintrag ${JSON.stringify(roh)} → undefined`, reiseWiederherstellen(k, KEINE, t) === undefined)
  }
  const gespeichert = JSON.parse(s.daten.get('empfehlung:reise')!) as { zustand: Record<string, unknown>; gezeigt: unknown[]; ziel: number; pool?: number }
  const mit = (aendere: (r: typeof gespeichert) => void) => {
    const kopie = JSON.parse(s.daten.get('empfehlung:reise')!) as typeof gespeichert
    aendere(kopie)
    const t = attrappe()
    t.daten.set('empfehlung:reise', JSON.stringify(kopie))
    return reiseWiederherstellen(k, KEINE, t)
  }
  pruefe('Kontrolle: unveränderter Eintrag geht', mit(() => undefined) !== undefined)
  pruefe('Pool-Kennung fehlt → undefined', mit((r) => delete r.pool) === undefined)
  const gleich = (a?: Ablauf, b?: Ablauf) => JSON.stringify(a?.gezeigt) === JSON.stringify(b?.gezeigt)
  const anders = mit((r) => ((r.pool as number) += 1))
  pruefe('Pool-Kennung anders → Vorschläge bleiben, ohne Duellstand', anders?.phase === 'ergebnis' && gleich(anders, fertig) && anders.sitzung === undefined, anders)
  const andererPool = (aendere: (l: Kandidat[]) => Kandidat[]) => baueKontext({ ...datei, einstiege: aendere([...datei.einstiege]) })
  const mitPool = (kk: ReturnType<typeof baueKontext>) => reiseWiederherstellen(kk, KEINE, s)
  const gleicher = mitPool(andererPool((l) => l))
  pruefe('Kontrolle: gleich gebauter Pool → mit Duellstand wie bisher', gleicher?.sitzung?.zustand.gewertet === fertig.sitzung?.zustand.gewertet && gleich(gleicher, fertig))
  const vorn = mitPool(andererPool((l) => [{ ...l[0], id: 900001, n: 'Neu' }, ...l]))
  pruefe('Neuer Titel vorn (Indizes verschoben) → Vorschläge bleiben, kein Duellstand', vorn?.phase === 'ergebnis' && gleich(vorn, fertig) && vorn.sitzung === undefined, vorn)
  const hinten = mitPool(andererPool((l) => [...l, { ...l[0], id: 909999, n: 'Neu' }]))
  pruefe('Neuer Titel hinten → Vorschläge bleiben, kein Duellstand', hinten?.phase === 'ergebnis' && gleich(hinten, fertig) && hinten.sitzung === undefined, hinten)
  const vertauscht = mitPool(andererPool((l) => [l[1], l[0], ...l.slice(2)]))
  pruefe('Zwei Titel vertauscht → Vorschläge bleiben, kein Duellstand', gleich(vertauscht, fertig) && vertauscht?.sitzung === undefined, vertauscht)
  for (const [name, a] of [['Pool-Kennung anders', anders], ['Neuer Titel vorn', vorn], ['Neuer Titel hinten', hinten], ['Titel vertauscht', vertauscht], ['gleicher Pool', gleicher]] as const) {
    pruefe(`${name}: die Ansicht zeichnet etwas (nicht schwarz)`, a !== undefined && zeichnung(lage(a)) === 'ergebnis', a && zeichnung(lage(a)))
  }
  const ohneEinen = mitPool(andererPool((l) => l.filter((e) => e.id !== fertig.gezeigt[0])))
  pruefe('Titel aus dem Pool entfernt → fällt aus den Vorschlägen', JSON.stringify(ohneEinen?.gezeigt) === JSON.stringify(fertig.gezeigt.slice(1)), ohneEinen?.gezeigt)
  const nurEiner = mitPool(andererPool((l) => l.filter((e) => e.id === fertig.gezeigt[0] || !fertig.gezeigt.includes(e.id))))
  pruefe('Anderer Pool, nur ein Vorschlag übrig → noch da (Schwelle 1)', nurEiner?.gezeigt.length === 1)
  const keiner = mitPool(andererPool((l) => l.filter((e) => !fertig.gezeigt.includes(e.id))))
  pruefe('Anderer Pool, alle Vorschläge fort → undefined', keiner === undefined)
  const verworfen = reiseWiederherstellen(andererPool((l) => [...l, { ...l[0], id: 909999, n: 'Neu' }]), new Set([fertig.gezeigt[1]]), s)
  pruefe('Anderer Pool: verworfene fallen heraus', JSON.stringify(verworfen?.gezeigt) === JSON.stringify(fertig.gezeigt.filter((id) => id !== fertig.gezeigt[1])), verworfen?.gezeigt)
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
    reiseMerken(fertig, k, gesperrt)
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
  reiseMerken(fertig, k, s)
  const start = zuStart(fertig)
  pruefe('Von vorn: Startbildschirm, Sitzung und Galerie bleiben', start.phase === 'start' && start.sitzung === fertig.sitzung && start.gezeigt === fertig.gezeigt)
  pruefe('Fortfahren nach erreichtem Ziel: zu den Vorschlägen', fortfahren(k, start).phase === 'ergebnis' && fortfahren(k, start).gezeigt === fertig.gezeigt)
  pruefe('Fortfahren ohne Sitzung: nichts ändert sich', fortfahren(k, ANFANG) === ANFANG)
  pruefe('Vorschau bei erreichtem Ziel: die gezeigten fünf', JSON.stringify(vorschauIds(k, start, rang(fertig.sitzung!.zustand))) === JSON.stringify(fertig.gezeigt))
  const offenes = antworten(k, neueReise(k, ANFANG, 7, []), 'A', rang)
  const vor = vorschauIds(k, zuStart(offenes), rang(offenes.sitzung!.zustand))
  pruefe('Vorschau bei offenem Duell: die ersten fünf der Rangliste', JSON.stringify(vor) === JSON.stringify(rang(offenes.sitzung!.zustand).slice(0, 5).map((x) => x.id)) && vor.length === 5, vor)
  pruefe('Vorschau ohne Sitzung: leer', vorschauIds(k, ANFANG, []).length === 0)
  reiseVergessen(s)
  pruefe('Vergessen löscht den Eintrag', s.daten.size === 0 && reiseWiederherstellen(k, KEINE, s) === undefined)
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
    const dom = installiereMiniDom({ ...attrappeUhr(), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
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
  const jetzt = zweiter.reise().gezeigt
  await act(async () => zweiter.reise().vonVorn())
  const r = zweiter.reise()
  pruefe('Von vorn: Startbildschirm mit Fortfahren, Eintrag bleibt', r.phase === 'start' && r.fortsetzbar && speicher.daten.has('empfehlung:reise'), r.phase)
  pruefe('Vorschau = die Vorschläge', JSON.stringify(r.vorschau) === JSON.stringify(jetzt), r.vorschau)
  await act(async () => zweiter.reise().fortfahren())
  pruefe('Fortfahren: zurück bei denselben Vorschlägen', zweiter.reise().phase === 'ergebnis' && JSON.stringify(zweiter.reise().gezeigt) === JSON.stringify(jetzt))
  await act(async () => zweiter.reise().vonVorn())
  speicher.daten.set('empfehlung:gesehen', '[900703]')
  speicher.daten.set('empfehlung:verworfen', '[900704]')
  mengen.gesehen = new Set([900703])
  mengen.verworfen = new Set([900704])
  await act(async () => zweiter.reise().verwerfenUndNeu())
  const neu = zweiter.reise()
  pruefe('Verwerfen und von vorn: neues Duell, gemerkte Vorschläge weg', neu.phase === 'duell' && !speicher.daten.has('empfehlung:reise') && neu.sitzung?.zustand.gewertet === 0, neu.phase)
  pruefe('Gesehenes bleibt gespeichert und ausgeschlossen', speicher.daten.get('empfehlung:gesehen') === '[900703]' && neu.sitzung?.zustand.ausgeschlossen.includes(3) === true, neu.sitzung?.zustand.ausgeschlossen)
  pruefe('Verworfenes bleibt gespeichert', speicher.daten.get('empfehlung:verworfen') === '[900704]')
  await act(async () => zweiter.reise().antworte('A'))
  await act(async () => zweiter.reise().antworte('B'))
  await zweiter.abbau()
  const dritter = await aufbau()
  const d = dritter.reise()
  pruefe('Duell verlassen: beim Wiederkommen Start mit Fortfahren und fünf Vorschau-Titeln', d.phase === 'start' && d.fortsetzbar && d.vorschau.length === 5, [d.phase, d.vorschau])
  await act(async () => dritter.reise().fortfahren())
  pruefe('Fortfahren setzt das Duell fort (drittes Duell)', dritter.reise().phase === 'duell' && dritter.reise().stehen?.nr === 3, [dritter.reise().phase, dritter.reise().stehen?.nr])
  await dritter.abbau()
}

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nEmpfehlung (Reise-Speicher): Merken, Wiederkommen und Von vorn in Ordnung')
