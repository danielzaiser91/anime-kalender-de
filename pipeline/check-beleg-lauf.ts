/**
 * Prüft den Lauf der Beleg-Lesung (`pipeline/lib/beleg-lauf.ts`, aufgerufen von `pipeline/belege-lesen.ts`) mit Attrappen für Browser, Lesen, Bild und Ablage:
 * Schlange, Seitenwahl, Fehlschläge, Speichern und Schließen. Aufruf: npx tsx pipeline/check-beleg-lauf.ts   (Exit 1 bei Verstoß)
 */
import type { Page } from 'playwright'
import { fuehreLaufAus, type Leser, type Lauf } from './lib/beleg-lauf.ts'
import type { BelegGedaechtnis } from './lib/beleg-lesung.ts'
import type { Beleg } from './lib/beleg-bild.ts'

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
async function lauf(adressen: string[], opt: { limit?: number; wirft?: string[]; gedaechtnis?: BelegGedaechtnis } = {}): Promise<{ spur: Spur; ged: BelegGedaechtnis; fehlschlaege: Lauf['fehlschlaege'] }> {
  const ged = opt.gedaechtnis ?? {}
  const fehlschlaege: Lauf['fehlschlaege'] = {}
  const spur: Spur = { seiten: [], geschlossen: 0, gespeichert: [] }
  const leser: Leser = {
    lies: async (seite, url) => {
      spur.seiten.push(`${(seite as unknown as { name: string }).name}:${url}`)
      if (opt.wirft?.includes(url)) throw new Error('Seite nicht erreichbar')
      return { text: `${url} ${'Artikeltext '.repeat(60)}`, veroeffentlicht: '2026-10-01', aktualisiert: '2026-10-01' }
    },
    bild: async () => ({ bild: Buffer.from('b'), text: Buffer.from('t'), markierung: [0, 0.1, 1, 0.1] }) as Beleg,
    ablegen: async (key) => key,
    info: async () => 'Attrappe',
  }
  const l: Lauf = { gedaechtnis: ged, heute: HEUTE, suchbegriffe: new Map(adressen.map((u) => [u, ['Titel']])), gruppen: new Map(), tage: new Map(), adressen, fehlschlaege, limit: opt.limit ?? 60, abstand: 7 }
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

console.log(fehler ? `✖ ${fehler} Verstöße` : '✔ Beleg-Lauf: Seitenwahl, Lesen, Fehlschläge, Obergrenze und Speichern in Ordnung')
process.exit(fehler ? 1 : 0)
