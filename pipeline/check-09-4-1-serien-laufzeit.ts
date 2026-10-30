/**
 * Zusicherung: **Die Bauphase 09-4-1 (`ordneCrSerienZu`) entfernt tote Crunchyroll-Serien über die Kennung** — als Lauf gegen
 * eine Kulisse (`AK_ROOT`), nicht als Textsuche im Quelltext. Ersetzt in `check-logic.ts` die beiden Regex-Zusicherungen
 * „die tote Serie wird über die Kennung gesucht" / „und der Verweis über die Kennung entfernt" (Perfect Blue, 28.09.2026:
 * Dub-Bestand `…/de/fr/series/ID/…`, Datensatz `…/de/series/ID/…`). Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import type { CrDubData, CrSerie } from './lib/crunchyroll-dub.ts'
import type { EntfernterVerweis } from './bau/grundlagen.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'cr-serien-laufzeit-'))
process.env.AK_ROOT = kulisse
const fehler: string[] = []
let pruefungen = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  pruefungen++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
const cr = (kennung: string, pfad = 'de/series') => `https://www.crunchyroll.com/${pfad}/${kennung}/serie`
const MIT_BLOCK = [{ name: 'Staffel 1', folgen: 12, kacheln: 12, deutsch: 12, fremd: 0 }]

interface Fall {
  id: number
  name: string
  /** Adresse des Verweises im Datensatz. */
  stream: string
  /** Derselbe Titel führt unter der Adresse zusätzlich einen Netflix-Weg. */
  netflixDazu?: boolean
  serie: Partial<CrSerie> & { url: string }
  /** Soll: bleibt der Verweis stehen? */
  bleibt: boolean
}
/* Die tote Serie steht im Dub-Bestand unter der französischen Schreibweise, der Datensatz führt die deutsche (Perfect Blue). */
const TOT = { nichtVerfuegbar: true, geprueftAm: '2026-10-01' }
const faelle: Fall[] = [
  { id: 900301, name: 'Kontrolle: gleiche Adresse, tote Serie', stream: cr('GAAAAAAA1'), serie: { url: cr('GAAAAAAA1'), seriesId: 'GAAAAAAA1', ...TOT }, bleibt: false },
  { id: 900302, name: 'andere Schreibweise, gleiche Kennung: Verweis weg', stream: cr('GBBBBBBB2'), serie: { url: cr('GBBBBBBB2', 'de/fr/series'), seriesId: 'GBBBBBBB2', ...TOT }, bleibt: false },
  { id: 900303, name: 'andere Schreibweise, andere Kennung: Verweis bleibt', stream: cr('GCCCCCCC3'), serie: { url: cr('GDDDDDDD4', 'de/fr/series'), seriesId: 'GDDDDDDD4', ...TOT }, bleibt: true },
  { id: 900304, name: 'andere Schreibweise ohne Kennung der Serie: Verweis bleibt', stream: cr('GEEEEEEE5'), serie: { url: cr('GEEEEEEE5', 'de/fr/series'), ...TOT }, bleibt: true },
  { id: 900305, name: 'Netflix-Weg unter derselben Adresse bleibt, der Crunchyroll-Weg geht', stream: cr('GFFFFFFF6'), netflixDazu: true, serie: { url: cr('GFFFFFFF6', 'de/fr/series'), seriesId: 'GFFFFFFF6', ...TOT }, bleibt: false },
  { id: 900306, name: 'Serie nicht tot, mit Block: Verweis bleibt', stream: cr('GGGGGGG7'), serie: { url: cr('GGGGGGG7'), seriesId: 'GGGGGGG7', katalog: 'de', staffeln: MIT_BLOCK }, bleibt: true },
  { id: 900307, name: 'deutscher Katalog ohne einen Block: Verweis weg', stream: cr('GHHHHHHH8'), serie: { url: cr('GHHHHHHH8'), seriesId: 'GHHHHHHH8', katalog: 'de', staffeln: [] }, bleibt: false },
  { id: 900308, name: 'US-Katalog ohne Block: Verweis bleibt', stream: cr('GIIIIIII9'), serie: { url: cr('GIIIIIII9'), seriesId: 'GIIIIIII9', katalog: 'us', staffeln: [] }, bleibt: true },
  { id: 900309, name: 'deutscher Katalog ohne Block, aber ohne Kennung: Verweis bleibt', stream: cr('GJJJJJJJA'), serie: { url: cr('GJJJJJJJA'), katalog: 'de', staffeln: [] }, bleibt: true },
  { id: 900310, name: 'US-Nein vom deutschen Katalog widerlegt: Verweis bleibt', stream: cr('GKKKKKKKB'), serie: { url: cr('GKKKKKKKB'), seriesId: 'GKKKKKKKB', ...TOT }, bleibt: true },
]
/* Das Gedächtnis hängt an der Kennung: der widerlegte Fall ist der einzige, den `usNeinWiderlegt` durchlässt. */
const widerlegt = (serie: { seriesId?: string | null }) => serie.seriesId === 'GKKKKKKKB'

try {
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  writeFileSync(join(kulisse, 'data/dub-confirmed.yaml'), '# leer\n')
  /* Beim Laden liest `bau/grundlagen.ts` diese Handdatei; leer genügt. */
  writeFileSync(join(kulisse, 'data/kino-ankuendigungen.yaml'), '[]\n')
  const { ordneCrSerienZu } = await import('./bau/09-4-1-serien.ts')
  const titles = new Map<number, Title>(
    faelle.map((f) => [
      f.id,
      { id: f.id, slug: `serie-${f.id}`, titleDe: `Serie ${f.id}`, streams: [{ platform: 'crunchyroll', url: f.stream }, ...(f.netflixDazu ? [{ platform: 'netflix', url: f.stream }] : [])] } as unknown as Title,
    ]),
  )
  const crDub = { serien: faelle.map((f) => ({ staffeln: [], ...f.serie })) } as unknown as CrDubData
  const verweiseEntfernt: EntfernterVerweis[] = []
  const ergebnis = ordneCrSerienZu({ titles, crDub, usNeinWiderlegt: widerlegt, verweiseEntfernt })
  for (const f of faelle) erwarte(f.name, titles.get(f.id)!.streams.some((s) => s.platform === 'crunchyroll'), f.bleibt)
  erwarte('der Netflix-Weg an der Adresse der toten Serie bleibt', titles.get(900305)!.streams.map((s) => s.platform), ['netflix'])
  const weg = faelle.filter((f) => !f.bleibt)
  erwarte('verschwunden zählt die entfernten Verweise', ergebnis.verschwunden, weg.length)
  erwarte('widerlegte US-Nein zählt als offen', ergebnis.usNeinOffen, 1)
  erwarte('Protokoll: ein Eintrag je entfernter Verweis', verweiseEntfernt.map((e) => e.titleId).sort(), weg.map((f) => f.id).sort())
  for (const e of verweiseEntfernt) {
    erwarte(`Eintrag ${e.titleId}: entferntAm ist ein Datum`, /^\d{4}-\d{2}-\d{2}$/.test(e.entferntAm ?? ''), true)
    erwarte(`Eintrag ${e.titleId}: letzter Weg`, e.letzterWeg, !faelle.find((f) => f.id === e.titleId)?.netflixDazu)
  }
  const kennung = verweiseEntfernt.find((e) => e.titleId === 900302)
  erwarte('Eintrag Kennungsfall: Serienadresse und Kennung des Dub-Bestands', [kennung?.url, kennung?.seriesId], [cr('GBBBBBBB2', 'de/fr/series'), 'GBBBBBBB2'])
  erwarte('Grund nennt das Nein von Crunchyroll', verweiseEntfernt.find((e) => e.titleId === 900301)?.grund.includes('nicht mehr verfügbar'), true)
  erwarte('Grund nennt den leeren deutschen Katalog', verweiseEntfernt.find((e) => e.titleId === 900307)?.grund.includes('keine einzige Staffel'), true)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-09-4-1-serien-laufzeit:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-09-4-1-serien-laufzeit: ${pruefungen} Prüfungen ok.`)
