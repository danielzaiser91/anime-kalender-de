/**
 * Zusicherung: **Die Bauphase 09-4-4-1 (`legeCrWegeAusKatalogAn`) legt fehlende Crunchyroll-Wege aus dem deutschen Katalog an** — als
 * Lauf gegen eine Kulisse (`AK_ROOT`), nicht als Textsuche im Quelltext. Ersetzt in `check-logic.ts` die Zusicherung „der deutsche
 * Katalog legt fehlende Crunchyroll-Wege an" (Kill Blue, 06.09.2026: Verweis zu Recht entfernt, Synchro später erschienen). Läuft in
 * `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'cr-katalog-wege-laufzeit-'))
process.env.AK_ROOT = kulisse
const fehler: string[] = []
let pruefungen = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  pruefungen++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
const adresse = (kennung: string) => `https://www.crunchyroll.com/de/series/${kennung}/serie`
const DE = ['ja-JP', 'de-DE']

interface Fall {
  id: number
  name: string
  kennung?: string
  /** Quelle der aniSearch-Adresse; sonst `crunchyroll`. */
  anbieter?: string
  katalog?: { audio?: string[]; folgen?: number; staffeln?: number } | null
  vorhandenerWeg?: boolean
  handNein?: 'titel' | 'adresse'
  /** Soll: Adressen der Crunchyroll-Wege danach. */
  soll: string[]
}
const faelle: Fall[] = [
  { id: 900501, name: 'Kontrolle: Katalog führt de-DE, kein Weg vorhanden: Weg angelegt', kennung: 'WKONTR001', soll: [adresse('WKONTR001')] },
  { id: 900502, name: 'Katalog ohne de-DE: kein Weg', kennung: 'WOHNEDE01', katalog: { audio: ['ja-JP'] }, soll: [] },
  { id: 900503, name: 'Katalogeintrag ohne Folgen: kein Weg', kennung: 'WOHNEFOL1', katalog: { folgen: 0 }, soll: [] },
  { id: 900504, name: 'Franchise mit zwei Staffeln: kein Weg', kennung: 'WZWEISTA1', katalog: { staffeln: 2 }, soll: [] },
  { id: 900505, name: 'Eintrag ohne Staffelzahl: kein Weg', kennung: 'WOHNESTA1', katalog: { staffeln: undefined }, soll: [] },
  { id: 900506, name: 'Kennung fehlt im Katalog: kein Weg', kennung: 'WUNBEKAN1', katalog: null, soll: [] },
  { id: 900507, name: 'aniSearch-Verweis eines anderen Anbieters: kein Weg', kennung: 'WANDERER1', anbieter: 'netflix', soll: [] },
  { id: 900508, name: 'es gibt schon einen Crunchyroll-Weg: nichts doppelt', kennung: 'WSCHONDA1', vorhandenerWeg: true, soll: ['https://www.crunchyroll.com/de/series/WVORHAND1/alt'] },
  { id: 900509, name: 'Handbeleg verneint den Anbieter: kein Weg', kennung: 'WHANDNEI1', handNein: 'titel', soll: [] },
  { id: 900510, name: 'Handbeleg verneint genau diese Adresse: kein Weg', kennung: 'WHANDNEI2', handNein: 'adresse', soll: [] },
]

try {
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  /* Beim Laden liest `bau/grundlagen.ts` diese Handdatei; leer genügt. */
  writeFileSync(join(kulisse, 'data/kino-ankuendigungen.yaml'), '[]\n')
  const eintraege = faelle
    .filter((f) => f.kennung && f.katalog !== null)
    .map((f) => ({ id: f.kennung, audio: DE, folgen: 12, staffeln: 1, ...f.katalog }))
  writeFileSync(join(kulisse, 'data/cr-katalog-de.json'), JSON.stringify({ eintraege }))
  const { legeCrWegeAusKatalogAn } = await import('./bau/09-4-4-1-katalog-wege.ts')
  const { dubKey, adressKern } = await import('./lib/dub-confirmed.ts')
  const titles = new Map<number, Title>(
    faelle.map((f) => [
      f.id,
      {
        id: f.id,
        slug: `wege-${f.id}`,
        streams: f.vorhandenerWeg ? [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/WVORHAND1/alt' }] : [],
      } as unknown as Title,
    ]),
  )
  const anisearch = Object.fromEntries(
    faelle.map((f) => [f.id, { streams: [{ provider: f.anbieter ?? 'crunchyroll', url: `${adresse(f.kennung!)}?utm=x` }] }]),
  ) as unknown as Parameters<typeof legeCrWegeAusKatalogAn>[0]['anisearch']
  const handNein = new Set(
    faelle.flatMap((f) =>
      f.handNein === 'titel' ? [dubKey(f.id, 'crunchyroll')] : f.handNein === 'adresse' ? [`${dubKey(f.id, 'crunchyroll')}|${adressKern(adresse(f.kennung!))}`] : [],
    ),
  )
  legeCrWegeAusKatalogAn({ titles, anisearch, handNein })
  for (const f of faelle) {
    const wege = titles.get(f.id)!.streams.filter((s) => s.platform === 'crunchyroll')
    erwarte(f.name, wege.map((s) => s.url), f.soll)
  }
  const neu = titles.get(900501)!.streams[0]!
  erwarte('neuer Weg: ohne Anhang der aniSearch-Adresse, deutsch belegt', [neu.url.includes('?'), neu.dub], [false, true])
  erwarte('Ein Titel ohne aniSearch-Eintrag bleibt ohne Weg', (() => {
    const t = { id: 900511, slug: 'wege-900511', streams: [] } as unknown as Title
    legeCrWegeAusKatalogAn({ titles: new Map([[t.id, t]]), anisearch: {}, handNein })
    return t.streams.length
  })(), 0)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-09-4-4-1-katalog-wege-laufzeit:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-09-4-4-1-katalog-wege-laufzeit: ${pruefungen} Prüfungen ok.`)
