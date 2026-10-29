/**
 * Prüft den Lauf der Beleg-Lesung (`pipeline/lib/beleg-lauf.ts`, aufgerufen von `pipeline/belege-lesen.ts`) mit Attrappen für Browser, Lesen, Bild und Ablage:
 * Schlange, Seitenwahl, Fehlschläge, Speichern und Schließen — und die Marken je Titel im Sammelartikel als Kreislauf (Lesung mit Lücke → Schlange → neue Lesung →
 * nicht wieder gelesen → neuer Titel → wieder gelesen) samt Wächter am Lauf-Ende. Aufruf: npx tsx pipeline/check-beleg-lauf.ts   (Exit 1 bei Verstoß)
 */
import type { Page } from 'playwright'
import { fuehreLaufAus, type Leser, type Lauf } from './lib/beleg-lauf.ts'
import { textHash, type BelegGedaechtnis, type Lesung } from './lib/beleg-lesung.ts'
import type { Beleg } from './lib/beleg-bild.ts'
import type { Gruppe } from './lib/beleg-suche.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, info = ''): void => {
  console.log(ok ? '✓' : '✗', name, info)
  if (!ok) fehler++
}

const HEUTE = '2026-10-30'
const CR = 'https://www.crunchyroll.com/de/news/anime/2026/1'
const A2Y1 = 'https://www.anime2you.de/news/1/'
const A2Y2 = 'https://www.anime2you.de/news/2/'
const cr = { name: 'cr' } as unknown as Page
const andere = { name: 'andere' } as unknown as Page

interface Spur {
  seiten: string[]
  geschlossen: number
  gespeichert: { gelesen: number; adressen: string[] }[]
}

/** Ein Lauf mit Attrappen; `lies` und `bild` dürfen je Adresse antworten oder werfen. */
interface Optionen {
  limit?: number
  wirft?: string[]
  gedaechtnis?: BelegGedaechtnis
  gruppen?: Map<string, Gruppe[]>
  bild?: Leser['bild']
  /** Gemeinsame Spur mehrerer Läufe oder eines Laufs, der wirft. */
  spur?: Spur
}

const artikeltext = (url: string): string => `${url} ${'Artikeltext '.repeat(60)}`

async function lauf(adressen: string[], opt: Optionen = {}): Promise<{ spur: Spur; ged: BelegGedaechtnis; fehlschlaege: Lauf['fehlschlaege'] }> {
  const ged = opt.gedaechtnis ?? {}
  const fehlschlaege: Lauf['fehlschlaege'] = {}
  const spur: Spur = opt.spur ?? { seiten: [], geschlossen: 0, gespeichert: [] }
  const leser: Leser = {
    lies: async (seite, url) => {
      spur.seiten.push(`${(seite as unknown as { name: string }).name}:${url}`)
      if (opt.wirft?.includes(url)) throw new Error('Seite nicht erreichbar')
      return { text: artikeltext(url), veroeffentlicht: '2026-10-01', aktualisiert: '2026-10-01' }
    },
    bild: opt.bild ?? (async () => ({ bild: Buffer.from('b'), text: Buffer.from('t'), markierung: [0, 0.1, 1, 0.1] }) as Beleg),
    ablegen: async (key) => key,
    info: async () => 'Attrappe',
  }
  const l: Lauf = { gedaechtnis: ged, heute: HEUTE, suchbegriffe: new Map(adressen.map((u) => [u, ['Titel']])), gruppen: opt.gruppen ?? new Map(), tage: new Map(), adressen, fehlschlaege, limit: opt.limit ?? 60, abstand: 7 }
  await fuehreLaufAus(l, {
    oeffne: async () => ({ cr, andere, schliessen: async () => { spur.geschlossen++ } }),
    speichern: (gelesen) => spur.gespeichert.push({ gelesen, adressen: Object.keys(ged) }),
    leser,
  })
  return { spur, ged, fehlschlaege }
}

const a = await lauf([CR, A2Y1])
pruefe('Seitenwahl: Crunchyroll auf der Desktop-Seite, alle anderen auf der zweiten', a.spur.seiten.includes(`cr:${CR}`) && a.spur.seiten.includes(`andere:${A2Y1}`) && a.spur.seiten.length === 2, a.spur.seiten.join(' '))
pruefe('Lesen: beide Lesungen im Gedächtnis, mit Bild und Wand-Prüfung', Object.keys(a.ged).length === 2 && a.ged[CR]!.lesungen[0]!.qs === 'ok' && a.ged[CR]!.lesungen[0]!.bild !== undefined)
pruefe('Speichern: genau einmal, mit der Zahl der gelesenen Adressen, danach ist der Browser geschlossen', a.spur.gespeichert.length === 1 && a.spur.gespeichert[0]!.gelesen === 2 && a.spur.geschlossen === 1)

const b = await lauf([A2Y1, A2Y2, CR], { wirft: [A2Y1] })
pruefe('Fehlschlag: die Adresse mit Fehler steht nicht im Gedächtnis, die anderen werden gelesen', !b.ged[A2Y1] && Boolean(b.ged[A2Y2]) && Boolean(b.ged[CR]))
pruefe('Fehlschlag: sie bekommt eine Marke mit dem Tag, die gelesenen nicht', b.fehlschlaege[A2Y1]?.am === HEUTE && !b.fehlschlaege[A2Y2] && !b.fehlschlaege[CR])
pruefe('Fehlschlag: gespeichert wird trotzdem, gezählt nur, was gelesen ist', b.spur.gespeichert.length === 1 && b.spur.gespeichert[0]!.gelesen === 2)

const c = await lauf([A2Y1, A2Y2, CR], { limit: 1 })
pruefe('Obergrenze: höchstens so viele Adressen wie das Limit', c.spur.seiten.length === 1 && c.spur.gespeichert[0]!.gelesen === 1)

/* Marken je Titel: die Herbstübersicht mit drei Titeln, die Lesung vom 23.10.2026 hatte nur für den ersten eine Marke (Rayearth, 29.10.2026). */
const HERBST = 'https://www.crunchyroll.com/de/news/seasonal-lineup/2026/9/15/crunchyroll-deutsche-synchros-herbst-2026'
const M: [number, number, number, number] = [0.05, 0.64, 0.9, 0.03]
const titel = (...ids: number[]): Gruppe[] => ids.map((id) => ({ id, suchen: [`Titel ${id}`], tage: [] }))
const altlesung = (extra: Partial<Lesung> = {}): BelegGedaechtnis => ({
  [HERBST]: { zuletzt: '2026-10-23', lesungen: [{ am: '2026-10-23', hash: textHash(artikeltext(HERBST)), veroeffentlicht: '2026-10-01', aktualisiert: '2026-10-01', bild: 'alt.webp', text: 'alt.txt.gz', qs: 'ok', bildfassung: 3, markierung: M, markierungen: { 1: M }, ...extra }] },
})
const bildAufrufe: number[] = []
const mitMarken = (marken: Record<number, typeof M>, ohne: Record<number, 'nicht-gefunden' | 'ausserhalb'> | undefined): Leser['bild'] => async (_s, _su, _t, gruppen) => {
  bildAufrufe.push(gruppen?.length ?? 0)
  return { bild: Buffer.from('b'), text: Buffer.from('t'), markierung: M, markierungen: marken, ...(ohne ? { ohneMarke: ohne } : {}) } as Beleg
}
const ausgabe = async (f: () => Promise<unknown>): Promise<string> => {
  const alt = console.log
  const zeilen: string[] = []
  console.log = (...a: unknown[]) => { zeilen.push(a.join(' ')) }
  try { await f() } finally { console.log = alt }
  return zeilen.join('\n')
}

const g3 = new Map([[HERBST, titel(1, 2, 3)]])
const d1 = altlesung()
const s1 = await lauf([], { gedaechtnis: d1, gruppen: g3, bild: mitMarken({ 1: M, 2: M }, { 3: 'ausserhalb' }) })
pruefe('Kreislauf 1: die Altlesung mit Lücke steht ohne Termin in der Schlange und wird neu aufgenommen, mit allen drei Titeln', s1.spur.seiten.length === 1 && bildAufrufe.join() === '3', s1.spur.seiten.join(' '))
pruefe('Kreislauf 1: danach hat jeder Titel Marke oder Grund, gespeichert ist es', Boolean(d1[HERBST]!.lesungen[0]!.markierungen?.[2]) && d1[HERBST]!.lesungen[0]!.ohneMarke?.[3] === 'ausserhalb' && s1.spur.gespeichert.length === 1)
const s2 = await lauf([], { gedaechtnis: d1, gruppen: g3, bild: mitMarken({}, {}) })
pruefe('Kreislauf 2: im nächsten Lauf ist sie nicht wieder fällig (kein zweiter Abruf)', s2.spur.seiten.length === 0 && bildAufrufe.length === 1)
const s3 = await lauf([], { gedaechtnis: d1, gruppen: new Map([[HERBST, titel(1, 2, 3, 4)]]), bild: mitMarken({ 1: M, 2: M, 4: M }, { 3: 'ausserhalb' }) })
pruefe('Kreislauf 3: ein vierter Titel im Artikel bringt sie wieder in die Schlange', s3.spur.seiten.length === 1 && bildAufrufe.join() === '3,4' && Boolean(d1[HERBST]!.lesungen[0]!.markierungen?.[4]))

/* Wächter am Lauf-Ende: Ein Aufnahme-Ergebnis ohne Gründe für die fehlenden Titel macht den Lauf rot — nachdem gespeichert ist. */
const d4 = altlesung()
let wurf = ''
const spur4: Spur = { seiten: [], geschlossen: 0, gespeichert: [] }
try {
  await lauf([], { gedaechtnis: d4, gruppen: g3, bild: mitMarken({ 1: M }, undefined), spur: spur4 })
} catch (e) { wurf = (e as Error).message }
pruefe('Lauf-Ende: Marken ohne Gründe für zwei von drei Titeln → der Lauf wirft mit der Adresse', wurf.includes(HERBST) && wurf.includes('2 von 3'), wurf.slice(0, 160))
pruefe('Lauf-Ende: der Wurf kam nach dem Speichern und nach dem Schließen des Browsers (nichts geht verloren)', spur4.gespeichert.length === 1 && spur4.gespeichert[0]!.gelesen === 1 && spur4.geschlossen === 1)

/* Nichtauskunft ist keine Lesung: kein Ausschnitt, einfarbig, Wand — der Lauf bleibt grün, die Adresse bekommt eine Fehlschlag-Marke, die Lücke bleibt für später. */
const nein: [string, Leser['bild']][] = [['kein Ausschnitt', async () => undefined], ['einfarbig', async () => 'leer'], ['Zustimmungswand', async () => 'wand']]
for (const [name, bild] of nein) {
  const d = altlesung()
  const r = await lauf([], { gedaechtnis: d, gruppen: g3, bild })
  pruefe(`Nichtauskunft (${name}): kein Wurf, Fehlschlag-Marke, nichts als gelesen gezählt`, r.fehlschlaege[HERBST]?.am === HEUTE && r.spur.gespeichert[0]?.gelesen === 0)
  if (name !== 'Zustimmungswand') pruefe(`Nichtauskunft (${name}): die Lesung bleibt unverändert, ohne erfundenen Grund`, d[HERBST]!.lesungen[0]!.ohneMarke === undefined && Object.keys(d[HERBST]!.lesungen[0]!.markierungen ?? {}).join() === '1')
}

/* Genau eine Lücke (zwei Titel, eine Marke) ist schon eine Lücke. */
const d8 = altlesung()
const r8 = await lauf([], { gedaechtnis: d8, gruppen: new Map([[HERBST, titel(1, 2)]]), bild: async () => undefined })
pruefe('Nichtauskunft (kein Ausschnitt) mit genau einer Lücke: Fehlschlag-Marke, nichts als gelesen gezählt', r8.fehlschlaege[HERBST]?.am === HEUTE && r8.spur.gespeichert[0]?.gelesen === 0)

/* Dieselbe Textfassung, aber neues Aktualisiert-Datum: Die neue Lesung erbt Marken und Gründe, sonst wäre der Artikel am nächsten Tag wieder in der Schlange. */
const d9 = altlesung({ aktualisiert: '2026-10-02', ohneMarke: { 2: 'ausserhalb', 3: 'nicht-gefunden' } })
const r9 = await lauf([HERBST], { gedaechtnis: d9, gruppen: g3 })
const neuste = d9[HERBST]!.lesungen.at(-1)!
pruefe('Erbe: eine Lesung mit neuem Datum trägt die Gründe und Marken der alten weiter', d9[HERBST]!.lesungen.length === 2 && neuste.ohneMarke?.[3] === 'nicht-gefunden' && Boolean(neuste.markierungen?.[1]) && r9.spur.seiten.length === 1)
const r9b = await lauf([], { gedaechtnis: d9, gruppen: g3 })
pruefe('Erbe: am nächsten Tag steht sie nicht wegen einer Lücke in der Schlange', r9b.spur.seiten.length === 0)
const d10 = altlesung({ aktualisiert: '2026-10-02' })
await lauf([HERBST], { gedaechtnis: d10, gruppen: g3, bild: mitMarken({ 1: M, 2: M }, { 3: 'ausserhalb' }) })
const neuste10 = d10[HERBST]!.lesungen.at(-1)!
pruefe('Erbe: hatte die alte Lesung eine Lücke, trägt die neue Lesung die frisch festgestellten Gründe, nicht nur die alte', d10[HERBST]!.lesungen.length === 2 && neuste10.ohneMarke?.[3] === 'ausserhalb' && Boolean(neuste10.markierungen?.[2]))

/* Altlesungen, die ein Lauf nicht mehr schafft (Limit), stehen als Warnzeile im Log. */
const log6 = await ausgabe(() => lauf([], { gedaechtnis: altlesung(), gruppen: g3, limit: 0 }))
pruefe('Warnzeile: eine nicht erreichte Altlesung mit Lücke steht als einzeilige ⚠ WARNUNG im Log', log6.includes("⚠ WARNUNG Belege: 1 Sammelartikel"))
const log7 = await ausgabe(() => lauf([], { gedaechtnis: altlesung({ ohneMarke: { 2: 'ausserhalb', 3: 'nicht-gefunden' } }), gruppen: g3, limit: 0 }))
pruefe('Warnzeile: mit Gründen für alle Titel keine Warnung', !log7.includes('WARNUNG'))

console.log(fehler ? `✖ ${fehler} Verstöße` : '✔ Beleg-Lauf: Seitenwahl, Lesen, Fehlschläge, Obergrenze, Speichern und Marken je Titel (Kreislauf, Wächter, Nichtauskunft) in Ordnung')
process.exit(fehler ? 1 : 0)
