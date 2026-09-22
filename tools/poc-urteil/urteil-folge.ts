/**
 * **PoC Stufe 3, Urteil je Folge** (22.09.2026, Modell in `docs/konzept-meldungen-architektur.md`).
 *
 * Zwei Quellen, beide „eigene Prüfung" im Sinne des Modells:
 * - `prime_folge` (Beobachtung je Anbieter-Folge) über `data/folgen-zuordnung.json` auf Titel und Folge,
 * - `pruefung` mit `folge_nr` bzw. `teil_von/teil_bis` — dort sagt die Meldung selbst, welche Folgen
 *   sie meint, und die Zuordnung steckt in `titel_id`.
 *
 * Je (Titel, Anbieter, Folge) gilt die jüngste Beobachtung; am selben Tag gemessen vor angenommen.
 * Verglichen wird mit dem heutigen Datensatz: `dubRanges` des Weges dieses Anbieters, sonst `dub`.
 * Schreibt nichts.
 *
 * Aufruf: npx tsx tools/poc-urteil/urteil-folge.ts <pruefung.json> <prime_folge.json>
 */
import { readFileSync } from 'node:fs'
import { adressKern } from '../../pipeline/lib/dub-confirmed.ts'
import type { Title } from '../../shared/types.ts'

interface PruefZeile {
  plattform: string
  titel_id: number | null
  folge_nr: number | null
  teil_von: number | null
  teil_bis: number | null
  gemeldet_am: string
  vorhanden: string | null
  ton_de: string | null
  art: string | null
  befund: string | null
  notiz: string | null
  abos: string | null
}
interface FolgenZeile {
  plattform: string
  url: string
  sprachen: string | null
  asin: string | null
  gti: string | null
  gemeldet_am: string
  vorhanden: string | null
  ton_de: string | null
}

const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const pruef = lies(process.argv[2]!)[0].results as PruefZeile[]
const folgen = lies(process.argv[3]!)[0].results as FolgenZeile[]
const zuordnung = lies('data/folgen-zuordnung.json') as Record<string, { titel?: number; folge?: number }>
const roh = lies('public/data/titles.json')
const titel = new Map<number, Title>((Array.isArray(roh) ? roh : roh.titles).map((t: Title) => [t.id, t]))

/*
  **Kanal-Seiten**: Ohne das Abo des Kanals zeigt Prime keine Tonspuren — ein Nein von dort ist keine
  Auskunft (CLAUDE.md, „Bei einem Kanal-Titel ist Amazons Sprachangabe kein Beleg"). Welche Adresse ein
  Kanal ist, steht in der Meldung (`abos`).
*/
const KANAL = /crunchyroll|aniverse|animedigital|pokemon|prosieben|kixi|midnight|arthouse|rtl/i
const kanalAdresse = new Set(
  (lies(process.argv[2]!)[0].results as { url: string; abos: string | null }[])
    .filter((z) => KANAL.test(z.abos ?? ''))
    .map((z) => adressKern(z.url)),
)

const RANG: Record<string, number> = { gemessen: 3, abgeleitet: 2, angenommen: 1 }
type Beob = { tag: string; rang: number; vorhanden: string; tonDe: string; kanal?: boolean }
const jeFolge = new Map<string, Beob>()
const setze = (titelId: number, anbieter: string, folge: number, b: Beob) => {
  const k = `${titelId}|${anbieter}|${folge}`
  const alt = jeFolge.get(k)
  if (!alt || b.tag > alt.tag || (b.tag === alt.tag && b.rang > alt.rang)) jeFolge.set(k, b)
}

for (const f of folgen) {
  const z = zuordnung[`${f.plattform}:${f.asin ?? f.gti}`]
  if (!z?.titel || !z.folge) continue
  /*
    Vor der Erweiterung 4.21 trug eine Rohfolge kein `vorhanden` — sie stand nur in der Liste, und
    ihre Tonspuren sagen, ob Deutsch dabei war. Eine leere Liste ist keine Auskunft (Störung).
  */
  const sprachen = (() => {
    try {
      return JSON.parse(f.sprachen ?? '[]') as string[]
    } catch {
      return []
    }
  })()
  const vorhanden = f.vorhanden ?? (sprachen.length ? 'ja' : null)
  if (!vorhanden) continue
  const tonDe = f.ton_de ?? (sprachen.some((s) => /deutsch|german|^de(\||$)/i.test(s)) ? 'ja' : 'nein')
  setze(z.titel, f.plattform, z.folge, {
    tag: f.gemeldet_am.slice(0, 10),
    rang: RANG.gemessen!,
    vorhanden,
    tonDe,
    kanal: tonDe === 'nein' && kanalAdresse.has(adressKern(f.url)),
  })
}
/* Alte Meldungen tragen nur `befund` — Migration 034 hat die Felder nicht nachgetragen. */
const ausBefund = (z: PruefZeile) => ({
  vorhanden: z.vorhanden ?? (z.befund === 'weg' ? 'nein' : z.befund ? 'ja' : null),
  tonDe: z.ton_de ?? (z.befund === 'dub' ? 'ja' : z.befund === 'kein_dub' ? 'nein' : 'unbekannt'),
})
for (const p of pruef) {
  const v = ausBefund(p)
  if (!p.titel_id || !v.vorhanden) continue
  const von = p.folge_nr ?? p.teil_von
  const bis = p.folge_nr ?? p.teil_bis
  if (!von || !bis || bis < von || bis - von > 500) continue
  for (let n = von; n <= bis; n++) {
    setze(p.titel_id, p.plattform, n, {
      tag: p.gemeldet_am.slice(0, 10),
      rang: RANG[p.art ?? (/ANGENOMMEN/.test(p.notiz ?? '') ? 'angenommen' : 'gemessen')] ?? 2,
      vorhanden: v.vorhanden,
      tonDe: v.tonDe,
      /* Ein Nein von einer Kanal-Seite ist auch in der Meldung keine Auskunft — nicht nur in der Rohfolge. */
      kanal: v.tonDe === 'nein' && KANAL.test(p.abos ?? ''),
    })
  }
}

/** Was sagt der heutige Datensatz für diese Folge bei diesem Anbieter? */
function heute(titelId: number, anbieter: string, folge: number): string {
  const t = titel.get(titelId)
  if (!t) return 'Titel nicht im Bestand'
  const wege = (t.streams ?? []).filter((s) => s.platform === anbieter)
  if (!wege.length) return 'kein Weg dieses Anbieters'
  for (const w of wege) {
    const bereich = (w.dubRanges ?? []).find((r) => r.from <= folge && folge <= r.to)
    if (bereich) return bereich.dub ? 'deutsch' : 'kein deutsch'
  }
  const dub = wege.some((w) => w.dub === true) ? true : wege.every((w) => w.dub === false) ? false : undefined
  return dub === true ? 'deutsch' : dub === false ? 'kein deutsch' : 'unbekannt'
}

const urteil = (b: Beob) => (b.vorhanden === 'nein' ? 'nicht verfügbar' : b.tonDe === 'ja' ? 'deutsch' : b.tonDe === 'nein' ? 'kein deutsch' : 'unbekannt')

const matrix = new Map<string, number>()
const abweichung = new Map<string, { n: number; bsp: string }>()
for (const [k, b] of jeFolge) {
  const [id, anbieter, folge] = k.split('|')
  const neu = urteil(b)
  const alt = heute(Number(id), anbieter!, Number(folge))
  const m = `${neu.padEnd(16)} ← heute ${alt}`
  matrix.set(m, (matrix.get(m) ?? 0) + 1)
  if (neu !== alt && !alt.startsWith('kein Weg') && alt !== 'Titel nicht im Bestand') {
    const g = `${titel.get(Number(id))?.titleDe ?? id} · ${anbieter} · PoC ${neu}${b.kanal ? " (Kanal-Nein)" : ""} ← heute ${alt}`
    const e = abweichung.get(g) ?? { n: 0, bsp: `F${folge} (${b.tag})` }
    e.n++
    abweichung.set(g, e)
  }
}
console.log(`${jeFolge.size} Urteile je Titel × Anbieter × Folge\n`)
for (const [k, v] of [...matrix].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(6), k)
console.log(`\n${[...abweichung.values()].reduce((a, b) => a + b.n, 0)} abweichende Folgen in ${abweichung.size} Gruppen, die größten 15:`)
for (const [g, e] of [...abweichung].sort((a, b) => b[1].n - a[1].n).slice(0, 15)) console.log(String(e.n).padStart(5), g, '·', e.bsp)
/* Mit --einzeln: die Abweichungen ohne Kanal-Nein, Folge für Folge — die Fälle zum Ansehen. */
if (process.argv.includes('--einzeln')) {
  console.log('\nOhne Kanal-Nein, einzeln:')
  for (const [k, b] of jeFolge) {
    const [id, anbieter, folge] = k.split('|')
    const neu = urteil(b)
    const alt = heute(Number(id), anbieter, Number(folge))
    if (neu === alt || alt.startsWith('kein Weg') || alt === 'Titel nicht im Bestand' || b.kanal) continue
    console.log(`  ${titel.get(Number(id))?.titleDe ?? id} (${id}) · ${anbieter} · F${folge} · PoC ${neu} (${b.tag}, ${b.rang === 3 ? 'gemessen' : b.rang === 2 ? 'abgeleitet' : 'angenommen'}) ← heute ${alt}`)
  }
}
