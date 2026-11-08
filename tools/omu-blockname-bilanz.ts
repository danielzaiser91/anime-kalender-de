/**
 * Bilanz „Katalogblock ohne Zahl im Namen“ (Auftrag omu-begleiter-blockname-ohne-zahl): zählt über alle Paare (Titel, Crunchyroll-Serie)
 * mit Synchro-Beleg am Weg (`dub === true`, nicht abgeleitet) und datiertem deutschem Block, wie viele Paare der Block-Zuordnung
 * vorher (nur Zahl im Namen, `katalogBlock`) und nachher (`blockWahl`) gelingen, je Weg bzw. Verwerfungsgrund.
 * Liest `public/data/titles.json`, `public/data/releases.json` und `data/crunchyroll-dub.json` (Datenstand: Commit im PR-Text).
 * Aufruf: npx tsx tools/omu-blockname-bilanz.ts [--liste] [--abgleich]
 *   --liste     nennt zu jedem Weg bzw. Grund die Titel
 *   --abgleich  prüft jede Zuordnung ohne Zahl gegen Angaben, die die Wahl nicht benutzt (Folgenzahl, Jahr der ersten deutschen Folge),
 *               und fährt den echten Begleiter (`legeOmuBegleiterAn`) und die echte Wache (`fruehesteDeutsche`) je Paar auf diesen Daten
 */
import { readFileSync } from 'node:fs'
import { crunchyrollSeriesId } from '../pipeline/lib/crunchyroll.ts'
import { blockWahlFuer } from '../pipeline/bau/block-wahl-titel.ts'
import { legeOmuBegleiterAn } from '../pipeline/bau/omu-synchro-begleiter.ts'
import { katalogStaffeln } from '../pipeline/bau/widerlegung-staffel.ts'
import { anzeigeName } from '../shared/titles.ts'
import { katalogBlock, nachBerlin } from './cr-katalogblock.mjs'
import { blockName, istPlatzhalter } from './cr-blockwahl.mjs'
import { fruehesteDeutsche, staffelnummern } from './synchro-wartezeit.mjs'
import type { Release, Title } from '../shared/types.ts'
import type { CrDubData, CrStaffel } from '../pipeline/lib/crunchyroll-dub.ts'

const titles = new Map((JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as Title[]).map((t) => [t.id, t]))
const crDub = JSON.parse(readFileSync('data/crunchyroll-dub.json', 'utf8')) as CrDubData
const crReleases = (JSON.parse(readFileSync('public/data/releases.json', 'utf8')) as Release[]).filter((r) => r.platform === 'crunchyroll')
const hatDatum = (b: CrStaffel) => (b.deutscheFolgen ?? []).some((f) => f.verfuegbarAb)
const hatEchtesDatum = (b: CrStaffel) => (b.deutscheFolgen ?? []).some((f) => f.verfuegbarAb && !istPlatzhalter(f))
const ersteFolge = (b: CrStaffel) => (b.deutscheFolgen ?? []).map((f) => f.verfuegbarAb ?? '').filter(Boolean).sort()[0] ?? ''

interface Paar {
  t: Title
  k: string
  url: string
  /** Ohne Starttag (Titel allein) — eine Obergrenze: der Bau kennt immer einen OmU-Termin mit Starttag. */
  wahl: ReturnType<typeof blockWahlFuer>
  /** Mit Starttag = japanischer Start und Folgenzahl des Titels, wie der Bau einen OmU-Termin anlegt. */
  wahlAb: ReturnType<typeof blockWahlFuer>
}
type Wahl = (p: Paar) => ReturnType<typeof blockWahlFuer>

/** Der Starttag, mit dem `omuTermin` und damit der Bau einen OmU-Termin anlegt. */
const startTag = (t: Title) => t.jpStart ?? `${t.jpYear}-01-01`

/** Was `paareLaden` nicht erfasst, je Weg (nicht je Paar): jeder Verwerfungsgrund mit Zahl. */
const ausfaelle = { ohneBeleg: 0, ohneSerienId: 0, ohneDatiertenBlock: 0 }

function paareLaden(): Paar[] {
  const raus: Paar[] = []
  for (const t of titles.values()) {
    const crWege = t.streams.filter((s) => s.platform === 'crunchyroll')
    const wege = crWege.filter((s) => s.dub === true && !s.dubAbgeleitet)
    ausfaelle.ohneBeleg += crWege.length - wege.length
    for (const s of wege) {
      const k = crunchyrollSeriesId(s.url)
      const bloecke = crDub.serien.filter((x) => x.katalog === 'de' && x.seriesId === k).flatMap((x) => x.staffeln ?? [])
      if (!k) ausfaelle.ohneSerienId++
      else if (!bloecke.some(hatDatum)) ausfaelle.ohneDatiertenBlock++
    }
    for (const k of new Set(wege.map((s) => crunchyrollSeriesId(s.url)))) {
      const bloecke = crDub.serien.filter((s) => s.katalog === 'de' && s.seriesId === k).flatMap((s) => s.staffeln ?? [])
      if (!k || !bloecke.some(hatDatum)) continue
      const url = wege.find((s) => crunchyrollSeriesId(s.url) === k)!.url
      const ab = { ab: startTag(t), folgen: t.episodes }
      raus.push({ t, k, url, wahl: blockWahlFuer(t, titles, k, crDub.serien), wahlAb: blockWahlFuer(t, titles, k, crDub.serien, ab) })
    }
  }
  return raus
}

/** Die Wege, die nie ein Paar werden (Skill stille-ausfaelle-verhindern): eigene Zeilen, damit die Zählbasis ihre Ausfälle nennt. */
function nenneAusfaelle(paare: Paar[]): void {
  console.log(`Ausfälle vor der Zählbasis (Wege, nicht Paare): ohne Synchro-Beleg (dub nicht true oder abgeleitet): ${ausfaelle.ohneBeleg}`)
  console.log(`Ausfälle: belegt, ohne Serien-ID (Slug-Adresse): ${ausfaelle.ohneSerienId}`)
  console.log(`Ausfälle: belegt, ohne datierten deutschen Block: ${ausfaelle.ohneDatiertenBlock}`)
  console.log(`Zählbasis: ${paare.length} Paare (Titel, Serie)`)
}

/** Serien, in denen zwei datierte deutsche Blöcke nach dem Glätten denselben Namen tragen (Kollisionsprüfung über alle Blöcke einer Serie). */
function nenneKollisionen(paare: Paar[]): void {
  const doppelt = new Set<string>()
  for (const k of new Set(paare.map((p) => p.k))) {
    const namen = new Map<string, Set<string>>()
    for (const s of crDub.serien.filter((x) => x.katalog === 'de' && x.seriesId === k)) {
      for (const b of (s.staffeln ?? []).filter(hatEchtesDatum)) namen.set(blockName(b.name), (namen.get(blockName(b.name)) ?? new Set()).add(b.name))
    }
    if ([...namen.values()].some((n) => n.size > 1)) doppelt.add(k)
  }
  const betroffen = paare.filter((p) => doppelt.has(p.k))
  const verdeckt = betroffen.filter((p) => p.wahlAb.grund?.startsWith('Blockname gleicht')).length
  console.log(`Kollisionen: ${doppelt.size} Serien mit doppeltem Glattnamen, ${betroffen.length} Paare dort, davon ${verdeckt} wegen des Namens offen (mit Starttag)`)
}

function zaehle(paare: Paar[], mitListe: boolean, wahl: Wahl, kopf: string): void {
  const nachher: Record<string, string[]> = {}
  const vorher = paare.filter((p) => katalogBlock(crDub.serien, p.k, katalogStaffeln(p.t, titles, p.k))).length
  for (const p of paare) {
    const schluessel = wahl(p).treffer ? `zugeordnet über ${wahl(p).weg}` : `offen: ${wahl(p).grund}`
    nachher[schluessel] ??= []
    nachher[schluessel].push(`${p.t.titleEn ?? p.t.titleRomaji} (${p.t.id})`)
  }
  const zugeordnet = paare.filter((p) => wahl(p).treffer).length
  console.log(`== ${kopf} ==`)
  console.log(`Paare mit Synchro-Beleg und datiertem deutschem Block: ${paare.length}`)
  console.log(`vorher (Zahl im Blocknamen): ${vorher} zugeordnet, ${paare.length - vorher} offen`)
  for (const [k, v] of Object.entries(nachher).sort()) console.log(`nachher ${k}: ${v.length}`, mitListe ? v.join('; ') : '')
  console.log(`nachher zugeordnet insgesamt (${kopf}): ${zugeordnet}`)
}

/** Folgenzahl und Jahr der ersten deutschen Folge gegen die Angaben des Titels, je Weg ohne Zahl. */
function abgleich(paare: Paar[], wahl: Wahl): void {
  for (const weg of ['einzig', 'name', 'folgen']) {
    const gewaehlt = paare.filter((p) => wahl(p).weg === weg)
    const zahl = (p: Paar) => (p.t.episodes === undefined ? undefined : wahl(p).treffer!.block.folgen - p.t.episodes)
    const gleich = gewaehlt.filter((p) => zahl(p) === 0).length
    const um1 = gewaehlt.filter((p) => Math.abs(zahl(p) ?? 0) === 1).length
    const unbekannt = gewaehlt.filter((p) => zahl(p) === undefined).length
    const weit = gewaehlt.filter((p) => Math.abs(zahl(p) ?? 0) > 1)
    const vorJapan = gewaehlt.filter((p) => ersteFolge(wahl(p).treffer!.block).slice(0, 4) < String(p.t.jpYear))
    console.log(`Abgleich ${weg}: ${gewaehlt.length} Paare, Folgenzahl gleich ${gleich}, um 1 ${um1}, ohne Titelangabe ${unbekannt}, um mehr ${weit.length}, erste deutsche Folge vor dem japanischen Jahr ${vorJapan.length}`)
    for (const p of gewaehlt.filter((q) => Math.abs(zahl(q) ?? 0) === 1)) console.log(`   um 1: ${anzeigeName(p.t)} (${p.t.id}) ${p.t.episodes} Folgen, Block „${wahl(p).treffer!.block.name}“ ${wahl(p).treffer!.block.folgen}`)
    for (const p of weit) console.log(`   um mehr: ${anzeigeName(p.t)} (${p.t.id}) ${p.t.episodes} Folgen, Block „${wahl(p).treffer!.block.name}“ ${wahl(p).treffer!.block.folgen}`)
    for (const p of vorJapan) console.log(`   vor Japan: ${anzeigeName(p.t)} (${p.t.id}) jpYear ${p.t.jpYear}, Block „${wahl(p).treffer!.block.name}“ ab ${ersteFolge(wahl(p).treffer!.block).slice(0, 10)}`)
    if (weg === 'folgen') for (const p of gewaehlt) console.log(`   ${anzeigeName(p.t)} (${p.t.id}, jpStart ${p.t.jpStart}, ${p.t.episodes} Folgen) → „${wahl(p).treffer!.block.name}“ ab ${ersteFolge(wahl(p).treffer!.block).slice(0, 10)}, ${wahl(p).treffer!.block.folgen} Folgen`)
  }
}

/** Ein OmU-Termin zum Titel; Start = japanischer Start des Titels (OmU läuft nahe daran), sonst 1. Januar seines Jahres. */
function omuTermin(p: Paar): Release {
  const start = p.t.jpStart ?? `${p.t.jpYear}-01-01`
  const schedule = { firstEpisodeDate: start, ...(p.t.episodes === undefined ? {} : { episodeCount: p.t.episodes }) }
  return { slug: `probe-${p.t.id}`, titleId: p.t.id, name: anzeigeName(p.t), platform: 'crunchyroll', platformUrl: p.url, releaseType: 'weekly', sprache: 'omu', schedule, year: 2026, sources: [] } as unknown as Release
}

/** Die echten Funktionen von Bau und Wache je Paar mit einem solchen OmU-Termin: wer ordnet zu, wer nicht, welcher Block. */
function echteWege(paare: Paar[]): void {
  const stand = { beide: 0, nurBau: 0, nurWache: 0, verschieden: 0, keiner: 0, neuUneins: 0 }
  const gruende: Record<string, number> = {}
  for (const p of paare) {
    const omu = omuTermin(p)
    const releases = [omu]
    legeOmuBegleiterAn(releases, titles, crDub, gruende)
    const bau = releases[1]?.schedule.firstEpisodeDate
    const wache = fruehesteDeutsche(crDub, omu, [...crReleases, omu])
    const wacheTag = typeof wache === 'number' ? nachBerlin(new Date(wache).toISOString())?.datum : undefined
    const nummern = staffelnummern(omu, [...crReleases, omu])
    const vorher = nummern && katalogBlock(crDub.serien, p.k, nummern) ? ' [schon vor diesem PR über die Zahl]' : ' [neu durch diesen PR]'
    const neu = vorher.includes('neu') ? 1 : 0
    if (bau && wacheTag) {
      const gleich = bau === wacheTag
      stand[gleich ? 'beide' : 'verschieden']++
      if (!gleich) console.log(`   verschieden: ${anzeigeName(p.t)} (${p.t.id}) Bau ab ${bau}, Wache ab ${wacheTag}${vorher}`)
      if (!gleich) stand.neuUneins += neu
    } else if (bau) stand.nurBau++
    else if (wacheTag) {
      stand.nurWache++
      stand.neuUneins += neu
      console.log(`   nur die Wache ordnet zu: ${anzeigeName(p.t)} (${p.t.id}), Bau: ${p.wahlAb.grund}${vorher}`)
    } else stand.keiner++
  }
  console.log(`Echter Bau und echte Wache je Paar: beide gleich ${stand.beide}, nur Bau ${stand.nurBau}, nur Wache ${stand.nurWache}, verschiedener Block ${stand.verschieden}, keiner ${stand.keiner}`)
  console.log(`davon Uneinigkeit, die erst durch die neuen Wege entsteht: ${stand.neuUneins}`)
  console.log(`Gründe des echten Begleiters: ${JSON.stringify(gruende)}`)
}

const paare = paareLaden()
const mitListe = process.argv.includes('--liste')
nenneAusfaelle(paare)
zaehle(paare, mitListe, (p) => p.wahl, 'ohne Starttag (Obergrenze, Platzhalter zählen nicht)')
zaehle(paare, mitListe, (p) => p.wahlAb, 'mit Starttag = japanischer Start (im Bau erreichbar)')
const platzhalter = paare.filter((p) => p.wahlAb.grund === 'deutsche Folgen nur mit Platzhalter-Datum')
console.log(`reine Platzhalterpaare (nie zugeordnet): ${platzhalter.length} ${mitListe ? platzhalter.map((p) => `${p.t.titleEn ?? p.t.titleRomaji} (${p.t.id})`).join('; ') : ''}`)
const aufPlatzhalter = (wahl: Wahl) => paare.filter((p) => wahl(p).treffer && !hatEchtesDatum(wahl(p).treffer!.block))
console.log(`Zuordnungen auf einen Block nur mit Platzhalter-Datum: ohne Starttag ${aufPlatzhalter((p) => p.wahl).length}, mit Starttag ${aufPlatzhalter((p) => p.wahlAb).length} (${aufPlatzhalter((p) => p.wahlAb).map((p) => `${p.t.id} über ${p.wahlAb.weg}`).join(', ')})`)
nenneKollisionen(paare)
if (process.argv.includes('--abgleich')) {
  abgleich(paare, (p) => p.wahlAb)
  echteWege(paare)
}
