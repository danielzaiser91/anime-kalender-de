import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { todayIso } from '../../shared/time.ts'
import type { Title } from '../../shared/types.ts'
import { log, readJson, writeJson } from '../lib/util.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'
import { VOICES_DIR } from './grundlagen.ts'
import { sammleSchreibweisen } from './sprecher-namen.ts'
import { fuehreZusammen, type AnisearchRolle, type Rolle } from './sprecher-zusammen.ts'

/**
 * Bauphase „Sprecher aus aniSearch" (Stufe D der AniList-Ablösung, 11.10.2026): schreibt vor `rolleTermineAus` die
 * aniSearch-Besetzung in `public/data/voices/<id>.json`. AniList- und ANN-Rollen bleiben nur, wo aniSearch den Sprecher
 * nicht führt (Regel: `sprecher-zusammen.ts`). Wiederholbar: aniSearch-Rollen (`von: 'anisearch'`) werden jedes Mal neu
 * aus `data/anisearch-sprecher.json` abgeleitet, die übrigen bleiben stehen.
 *
 * Eine Kennung, die mehrere Titel teilen, bleibt außen vor: ihre Seite gehört der ganzen Reihe, nicht einer Staffel.
 */
const QUELLEN_DATEI = 'data/sprecher-quellen.json'

interface VoiceDatei {
  titleId: number
  updatedAt: string
  roles: Rolle[]
  annUrl?: string
}

type Quelle = 'anilist' | 'ann' | 'anisearch'

/** Zähler je Quelle: Titel mit mindestens einer Rolle von dort, und Rollen. */
export type Zaehlung = Record<Quelle, { titel: number; rollen: number }> & { titelGesamt: number }

export interface Messung {
  vorher: Zaehlung
  nachher: Zaehlung
  /** Titel mit Rollen vorher, die nachher keine mehr haben — muss 0 sein. */
  titelVerloren: number
  /** Titel, die erst durch aniSearch Rollen bekommen. */
  titelNeu: number
  /** Titel mit geteilter Kennung, die übersprungen wurden. */
  geteilt: number
  rollenErsetzt: number
  rollenBehalten: number
}

const quelleVon = (r: Rolle): Quelle => r.von ?? 'anilist'

export function zaehle(dateien: Iterable<Rolle[]>): Zaehlung {
  const z: Zaehlung = { anilist: { titel: 0, rollen: 0 }, ann: { titel: 0, rollen: 0 }, anisearch: { titel: 0, rollen: 0 }, titelGesamt: 0 }
  for (const rollen of dateien) {
    if (rollen.length) z.titelGesamt++
    for (const q of new Set(rollen.map(quelleVon))) z[q].titel++
    for (const r of rollen) z[quelleVon(r)].rollen++
  }
  return z
}

function liesDateien(): Map<number, VoiceDatei> {
  const aus = new Map<number, VoiceDatei>()
  if (!existsSync(VOICES_DIR)) return aus
  for (const name of readdirSync(VOICES_DIR)) {
    if (!name.endsWith('.json')) continue
    try {
      const d = JSON.parse(readFileSync(`${VOICES_DIR}/${name}`, 'utf8')) as VoiceDatei
      aus.set(d.titleId, d)
    } catch {
      /* Kaputte Datei: der nächste Sprecher-Lauf schreibt sie neu. */
    }
  }
  return aus
}

/** Kennungen, die mehr als ein Titel trägt. */
function geteilteKennungen(kennung: Map<number, number>): Set<number> {
  const je = new Map<number, number>()
  for (const asId of kennung.values()) je.set(asId, (je.get(asId) ?? 0) + 1)
  return new Set([...je].filter(([, n]) => n > 1).map(([id]) => id))
}

function uebernehmeAnisearchSprecher({ titles }: { titles: Map<number, Title> }): { messung: Messung; mitStimmen: Set<number> } {
  const seiten = readJson<Record<string, { de?: AnisearchRolle[]; fetchedAt?: string }>>('data/anisearch-sprecher.json', {})
  mkdirSync(VOICES_DIR, { recursive: true })
  const dateien = liesDateien()
  const vorher = zaehle([...dateien.values()].map((d) => d.roles ?? []))
  const mitRollen = new Set([...dateien].filter(([, d]) => d.roles?.length).map(([id]) => id))
  const bekannt = sammleSchreibweisen([...dateien.values()].flatMap((d) => (d.roles ?? []).map((r) => r.actor)))
  const kennung = anisearchKennungen([...titles.values()].map((t) => ({ id: t.id, mal: t.malId })))
  const geteilt = geteilteKennungen(kennung)
  const m: Omit<Messung, 'vorher' | 'nachher'> = { titelVerloren: 0, titelNeu: 0, geteilt: 0, rollenErsetzt: 0, rollenBehalten: 0 }
  for (const t of titles.values()) {
    const asId = kennung.get(t.id)
    const de = asId ? seiten[String(asId)]?.de : undefined
    if (!de?.length) continue
    if (geteilt.has(asId!)) {
      m.geteilt++
      continue
    }
    const alt = dateien.get(t.id)
    const z = fuehreZusammen(alt?.roles ?? [], de, bekannt)
    if (!z.rollen.length) continue
    m.rollenErsetzt += z.ersetzt
    m.rollenBehalten += z.behalten
    if (!alt?.roles?.length) m.titelNeu++
    const neu: VoiceDatei = { ...(alt ?? { titleId: t.id, updatedAt: seiten[String(asId)]!.fetchedAt ?? new Date().toISOString() }), roles: z.rollen }
    if (!z.rollen.some((r) => r.von === 'ann')) delete neu.annUrl
    if (JSON.stringify(alt) === JSON.stringify(neu)) continue
    writeFileSync(`${VOICES_DIR}/${t.id}.json`, JSON.stringify(neu))
    dateien.set(t.id, neu)
  }
  const nachher = zaehle([...dateien.values()].map((d) => d.roles ?? []))
  const verloren = [...mitRollen].filter((id) => !dateien.get(id)?.roles?.length).length
  if (verloren) throw new Error(`Sprecher: ${verloren} Titel verlören durch aniSearch alle Rollen`)
  const mitStimmen = new Set([...dateien].filter(([, d]) => d.roles?.length).map(([id]) => id))
  return { messung: { ...m, vorher, nachher, titelVerloren: verloren }, mitStimmen }
}

/** Geschrieben wird nur bei geänderten Zahlen, damit der Stand nicht täglich committet wird. */
function schreibeQuellenZaehlung(m: Messung): void {
  const alt = readJson<{ stand?: string }>(QUELLEN_DATEI, {})
  const { stand: _stand, ...altOhneStand } = alt
  if (JSON.stringify(altOhneStand) !== JSON.stringify(m)) writeJson(QUELLEN_DATEI, { stand: todayIso(), ...m }, true)
  const z = (q: Quelle) => `${m.vorher[q].titel}→${m.nachher[q].titel}`
  log(`Sprecher je Quelle (Titel vorher→nachher): AniList ${z('anilist')}, ANN ${z('ann')}, aniSearch ${z('anisearch')}; ${m.titelNeu} Titel neu, ${m.geteilt} wegen geteilter Kennung übersprungen`)
}

/** Die Titel mit deutschen Sprechrollen, nachdem die aniSearch-Besetzung in `voices/` liegt (Aufruf aus `rolleTermineAus`). */
export function sprecherRollen({ titles }: { titles: Map<number, Title> }): Set<number> {
  const { messung, mitStimmen } = uebernehmeAnisearchSprecher({ titles })
  schreibeQuellenZaehlung(messung)
  return mitStimmen
}
