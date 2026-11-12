/**
 * Prüft den Lauf der Beleg-Lesung (`pipeline/lib/beleg-lauf.ts`, aufgerufen von `pipeline/belege-lesen.ts`) mit Attrappen für Browser, Lesen, Bild und Ablage:
 * Schlange, Seitenwahl, Fehlschläge, Speichern und Schließen — und die Marken je Titel im Sammelartikel als Kreislauf (Lesung mit Lücke → Schlange → neue Lesung →
 * nicht wieder gelesen → neuer Titel → wieder gelesen) samt Wächter am Lauf-Ende. Aufruf: npx tsx pipeline/check-beleg-lauf.ts   (Exit 1 bei Verstoß)
 */
import type { Page } from 'playwright'
import { fuehreLaufAus, type Gelesen, type Leser, type Lauf } from './lib/beleg-lauf.ts'
import { bildOhnePruefung, braucheBild, textHash, type BelegGedaechtnis, type Lesung } from './lib/beleg-lesung.ts'
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
  /** Was die Seite zeigt (Standard: Artikeltext der Attrappe). */
  gelesen?: (url: string) => Gelesen
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
      return opt.gelesen?.(url) ?? { text: artikeltext(url), veroeffentlicht: '2026-10-01', aktualisiert: '2026-10-01' }
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

/* Kennzahl „Name im Text, Marke fehlt": Der Artikeltext der Attrappe nennt „Artikeltext" — Titel 3 heißt so, Titel 2 nicht. */
const imText = new Map([[HERBST, [{ id: 1, suchen: ['Titel 1'], tage: [] }, { id: 2, suchen: ['Titel 2'], tage: [] }, { id: 3, suchen: ['Artikeltext'], tage: [] }]]])
const warnungen = async (gruppen: typeof imText): Promise<string> => {
  const alt = console.warn
  const zeilen: string[] = []
  console.warn = (...a: unknown[]) => { zeilen.push(a.join(' ')) }
  try { await lauf([HERBST], { gedaechtnis: {}, gruppen, bild: mitMarken({ 1: M }, { 2: 'nicht-gefunden', 3: 'nicht-gefunden' }) }) } finally { console.warn = alt }
  return zeilen.join('\n')
}
const w1 = await warnungen(imText)
pruefe('Name im Text: der Lauf meldet genau den Titel, dessen Name im Seitentext steht, ohne den anderen', w1.includes('1 Titel stehen im Seitentext') && w1.includes('(3)') && !w1.includes('2)'), w1)
const w2 = await warnungen(new Map([[HERBST, imText.get(HERBST)!.slice(0, 2)]]))
pruefe('Name im Text: steht kein Name im Seitentext, bleibt der Lauf still', !w2.includes('Seitentext'), w2)

/* Kreislauf der Markenfassung (11.11.2026): Lesung mit `nicht-gefunden` aus älterer Fassung → in der Schlange → neu aufgenommen und gestempelt → nicht wieder fällig → nur die alte Fassung kommt dran. */
const aelter = altlesung({ ohneMarke: { 2: 'ausserhalb', 3: 'nicht-gefunden' } })
const aktuell = altlesung({ ohneMarke: { 2: 'ausserhalb', 3: 'nicht-gefunden' }, markenfassung: 2 })
const ohneNicht = altlesung({ ohneMarke: { 2: 'ausserhalb', 3: 'ausserhalb' } })
pruefe('Markenfassung: nur die Lesung mit nicht-gefunden und älterer Fassung kommt vorn in die Schlange', bildOhnePruefung(aelter[HERBST]) && !bildOhnePruefung(aktuell[HERBST]) && !bildOhnePruefung(ohneNicht[HERBST]))
const dMf = aelter
const sMf = await lauf([HERBST], { gedaechtnis: dMf, gruppen: g3, bild: mitMarken({ 1: M }, { 2: 'ausserhalb', 3: 'nicht-gefunden' }) })
pruefe('Markenfassung: die Lesung wird neu aufgenommen und trägt die Fassung 2', sMf.spur.seiten.length === 1 && dMf[HERBST]!.lesungen.at(-1)!.markenfassung === 2 && dMf[HERBST]!.lesungen[0]!.markenfassung === 2)
pruefe('Markenfassung: danach ist sie nicht wieder fällig (kein zweiter Bau)', !bildOhnePruefung(dMf[HERBST]) && !braucheBild(dMf[HERBST]!.lesungen.at(-1)!, ['x'], titel(1, 2, 3)))
const dMg = altlesung({ ohneMarke: { 2: 'ausserhalb', 3: 'nicht-gefunden' }, aktualisiert: '2026-10-02', markenfassung: 2 })
await lauf([HERBST], { gedaechtnis: dMg, gruppen: g3 })
pruefe('Markenfassung: gleicher Text, neue Lesung erbt die Fassung (sonst wäre sie sofort wieder veraltet)', dMg[HERBST]!.lesungen.length === 2 && dMg[HERBST]!.lesungen.at(-1)!.markenfassung === 2)

/* Seitentitel (12.11.2026): aniSearch 185053 zeigte am 07.11. einen Manga-eBook (Text wörtlich aus der Ablage) statt Gods' Games We Play; sein Erscheinungstag galt trotzdem. */
const GODS = 'https://www.anisearch.de/article/185053,gods-games-we-play-gesamtausgabe-blu-ray'
const EBOOK = [
  'Merchandise', 'Märchen Boss & Cool Colleague: Happy Ever After - Bd. 02 [eBook]', 'Märchen Boss & Cool Colleague: Happy Ever After - Bd. 02 [eBook]',
  'Übersicht', 'Gekauft', 'Wunschliste', 'Lesezeichen', 'Produktinformationen', '\t', 'Märchen Boss & Cool Colleague: Happy Ever After - Bd. 02 [eBook]',
  'Typ: Manga', 'Veröffentlicht: 5. Mär 2027', 'Altersempfehlung: 16', 'Medium: eBook', 'Publisher: Kazé Deutschland', 'Sprache: Deutsch', 'Autor: MINAMOTO, Kazuki',
  'Erhältlich in folgenden Onlineshops:', 'Möglicherweise erhältlich in folgenden Onlineshops:',
  'Du möchtest aniSearch gern unterstützen? Mit dem Einkauf über unsere Partnerlinks erhält aniSearch eine kleine Vermittlungsprovision. Dir entstehen dadurch keinerlei Mehrkosten und uns hilft es das Projekt weiterzuentwickeln. Vielen Dank für Deine Unterstützung!',
  'Manga', 'Manga, 2+/11+ (2021-12-15)', 'Märchen Boss & Cool Colleague: Happy Ever After', 'Tokuma Shoten Publishing Co., Ltd.', '?', 'Weitere Artikel',
  'Märchen Boss & Cool Colleague: Happy Ever After - Bd. 02', '5. Mär 2027', 'Details zeigen', 'amazon.de',
  'Märchen Boss & Cool Colleague: Happy Ever After - Bd. 01 [eBook]', '15. Jan 2027', 'eBook', 'Details zeigen', 'amazon.de',
  'Mitgliederstatistik', 'Gekauft', '0', '\tWunschliste', '0', '', 'Lesezeichen', '1', 'Top Eintrager', 'RocketsSnorlax', '128 Kekse', 'Teilen',
].join('\n')
const RICHTIG = EBOOK.replace(/Märchen Boss & Cool Colleague: Happy Ever After - Bd\. 02 \[eBook\]/g, 'Gods’ Games We Play - Gesamtausgabe [Blu-ray]')
const gods = new Map([[GODS, [{ id: 7, suchen: ['Gods’ Games We Play', 'GODS’ GAMES WE PLAY!', '神々の遊びを…'], tage: ['2027-03-05'] }]]])
const godsLesen = (text: string) => (): Gelesen => ({ text, veroeffentlicht: '2027-03-05' })
const letzteAusgabe = (d: BelegGedaechtnis, u: string) => d[u]?.lesungen.at(-1)?.ausgabe
const dG1: BelegGedaechtnis = {}
const wG1w: string[] = []
const logAlt = console.log
console.log = (...a: unknown[]) => { wG1w.push(a.join(' ')) }
try { await lauf([GODS], { gedaechtnis: dG1, gruppen: gods, gelesen: godsLesen(EBOOK) }) } finally { console.log = logAlt }
pruefe('Seitentitel: die Seite zeigt den Manga-eBook, der Erscheinungstag wird nicht übernommen', letzteAusgabe(dG1, GODS) === undefined && Boolean(dG1[GODS]))
pruefe('Seitentitel: der Verwurf steht als WARNUNG mit Adresse im Log, nicht still', wG1w.join('\n').includes('⚠ WARNUNG Beleg ' + GODS) && wG1w.join('\n').includes('Erscheinungstag verworfen'), wG1w.join('\n'))
const dG2: BelegGedaechtnis = {}
await lauf([GODS], { gedaechtnis: dG2, gruppen: gods, gelesen: godsLesen(RICHTIG) })
pruefe('Seitentitel: dieselbe Seite mit dem richtigen Titel behält ihren Erscheinungstag', letzteAusgabe(dG2, GODS) === '2027-03-05')
const dG3: BelegGedaechtnis = {}
await lauf([GODS], { gedaechtnis: dG3, gruppen: new Map(), gelesen: godsLesen(EBOOK) })
pruefe('Seitentitel: ohne bekannte Namen gibt es nichts zu vergleichen, die Seite gilt', letzteAusgabe(dG3, GODS) === '2027-03-05')
const JOYN = 'https://www.joyn.de/serien/gods-games'
const dG4: BelegGedaechtnis = {}
await lauf([JOYN], { gedaechtnis: dG4, gruppen: new Map([[JOYN, gods.get(GODS)!]]), gelesen: godsLesen(EBOOK) })
pruefe('Seitentitel: nur aniSearch-Produktseiten werden verglichen, eine andere Adresse behält ihren Tag', letzteAusgabe(dG4, JOYN) === '2027-03-05')
/* Kreislauf: die am 07.11. gespeicherte Lesung (gleicher Text, fremder Tag) wird beim nächsten Lesen geheilt und gespeichert, obwohl keine neue Lesung entsteht. */
const dG5: BelegGedaechtnis = { [GODS]: { zuletzt: '2026-10-01', lesungen: [{ am: '2026-10-01', hash: textHash(EBOOK), hf: 2, ausgabe: '2027-03-05', bild: 'alt.webp', text: 'alt.txt.gz', qs: 'ok', bildfassung: 3, markierung: M }] } }
const log5 = await ausgabe(() => lauf([GODS], { gedaechtnis: dG5, gruppen: gods, gelesen: godsLesen(EBOOK) }))
pruefe('Seitentitel: der schon gespeicherte fremde Erscheinungstag wird entfernt, es bleibt eine Lesung', letzteAusgabe(dG5, GODS) === undefined && dG5[GODS]!.lesungen.length === 1)
pruefe('Seitentitel: die Heilung zählt als neuer Stand („1 mit neuem Stand“ im Log)', log5.includes('1 gelesen, 1 mit neuem Stand'), log5)
const dG6: BelegGedaechtnis = { [GODS]: { zuletzt: '2026-10-01', lesungen: [{ am: '2026-10-01', hash: textHash(RICHTIG), hf: 2, ausgabe: '2027-03-05', bild: 'alt.webp', text: 'alt.txt.gz', qs: 'ok', bildfassung: 3, markierung: M }] } }
const log6b = await ausgabe(() => lauf([GODS], { gedaechtnis: dG6, gruppen: gods, gelesen: godsLesen(RICHTIG) }))
pruefe('Seitentitel: passt die Seite, bleibt der gespeicherte Tag und es gibt keinen neuen Stand', letzteAusgabe(dG6, GODS) === '2027-03-05' && log6b.includes('1 gelesen, 0 mit neuem Stand'), log6b)

console.log(fehler ? `✖ ${fehler} Verstöße` : '✔ Beleg-Lauf: Seitenwahl, Lesen, Fehlschläge, Obergrenze, Speichern, Marken je Titel (Kreislauf, Wächter, Nichtauskunft), Name im Text, Markenfassung und Seitentitel in Ordnung')
process.exit(fehler ? 1 : 0)
