import { existsSync, readdirSync } from 'node:fs'
import { log, readJson, warn, writeJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import { ARCHIV_SEITEN, leseSeite } from '../lib/anisearch-relationen.ts'
import { OUT } from './grundlagen.ts'
import { schreibeDatensatz } from './13-schreiben.ts'
import { ANISEARCH_ID_BASIS, alle } from './anisearch-titel.ts'
import { type Kante, type Namen, type Regel, REGEL, malKanten, reihenWurzel } from './anisearch-reihen.ts'
import { type Einheit, type ReihenBericht, vergleicheReihen } from './anisearch-reihen-vergleich.ts'

/**
 * **Abweichungsliste Reihen: aniSearch gegen `franchiseId`** (`data/anisearch-reihen-abweichungen.json`, Stufe C der AniList-Ablösung, 10.10.2026). Zähler je Urteil
 * (gesamt und je Hälfte) und je Cluster-Art, dazu höchstens 20 Beispiele je Abweichungsart. Nichts davon wird ausgeliefert: die Seite zeigt weiter die Reihen aus
 * AniLists Beziehungen; die Datei ist Messgrundlage für den Umzug. Gelesen wird, was der Bau soeben nach `public/data/` geschrieben hat (Hauptbestand und Katalog, jeweils mit `franchiseId`).
 */
export const REIHEN_DATEI = 'data/anisearch-reihen-abweichungen.json'

type TitelZeile = { haupt?: boolean; id: number; titleRomaji?: string; titleEn?: string; anisearchId?: number; malId?: number; franchiseId?: number }
export type Deckung = { titel: number; mitSeite: number; ohneSeite: number; ohneAnisearchKennung: number; ohneReferenz: number; seitenImArchiv: number; kanten: number }
export type ReihenDatei = { stand: string; deckung: Deckung } & ReihenBericht

/** Kanten (nur Anime) und Namen aller Archivseiten; `mitSeite` sind die Kennungen, deren Seite da ist. */
export function ladeBeziehungen(dir = ARCHIV_SEITEN): { kanten: Kante[]; namen: Namen; mitSeite: Set<number> } {
  const [kanten, namen, mitSeite]: [Kante[], Namen, Set<number>] = [[], new Map(), new Set()]
  const merke = (id: number, name: string): void => {
    if (name && !(namen.get(id) ?? []).includes(name)) namen.set(id, [...(namen.get(id) ?? []), name])
  }
  for (const datei of existsSync(dir) ? readdirSync(dir) : []) {
    const id = Number(datei.replace('.html.gz', ''))
    const seite = Number.isInteger(id) ? leseSeite(id, dir) : undefined
    if (!seite) continue
    mitSeite.add(id)
    seite.titel.forEach((t) => merke(id, t))
    for (const r of seite.relationen.filter((x) => x.medium === 'anime')) {
      merke(r.id, r.name)
      kanten.push({ a: id, b: r.id, art: r.art })
    }
  }
  return { kanten, namen, mitSeite }
}

/** Titel ohne Referenz-Reihe: ein aniSearch-Titel (ab 10.000.000), dessen `franchiseId` kein zweiter Titel teilt — AniList kennt ihn nicht, seine „Reihe" wäre nur er selbst. */
function ohneReferenzReihe(titel: TitelZeile[]): Set<number> {
  const groesse = new Map<number, number>()
  for (const t of titel) groesse.set(t.franchiseId ?? t.id, (groesse.get(t.franchiseId ?? t.id) ?? 0) + 1)
  return new Set(titel.filter((t) => t.id >= ANISEARCH_ID_BASIS && groesse.get(t.franchiseId ?? t.id) === 1).map((t) => t.id))
}

/** Titel des Hauptbestands und des Katalogs mit ihrer aniSearch-Kennung; aniSearch-Titel (ab 10.000.000) tragen sie in der eigenen Kennung. */
function ladeTitelZeilen(): TitelZeile[] {
  const zeilen = new Map<number, TitelZeile>()
  for (const datei of ['titles.json', 'ohne-synchro.json']) {
    for (const t of readJson<TitelZeile[]>(`${OUT}/${datei}`, [])) if (!zeilen.has(t.id)) zeilen.set(t.id, { ...t, haupt: datei === 'titles.json' })
  }
  return [...zeilen.values()].map((t) => ({ ...t, anisearchId: t.anisearchId ?? (t.id >= ANISEARCH_ID_BASIS ? t.id - ANISEARCH_ID_BASIS : undefined) }))
}

export type Messdaten = { einheiten: Einheit[]; referenz: Map<number, string>; kanten: Kante[]; namen: Namen; deckung: Deckung }

/** Alles, was der Vergleich braucht, einmal gelesen (das Einstellen der Regel rechnet mehrfach darauf). */
export function ladeMessdaten(): Messdaten {
  const titel = ladeTitelZeilen()
  const { kanten, namen, mitSeite } = ladeBeziehungen()
  // Die MAL-Kennung eines aniSearch-Titels steht in der Eintragsdatei, nicht im Titel (gleiche Kennung = gleiche Reihe, wie `anisearchReihenKanten`).
  const eintraege = alle()
  const mal = (t: TitelZeile): number | undefined => t.malId ?? (t.anisearchId ? eintraege[String(t.anisearchId)]?.mal : undefined)
  const keineReferenz = ohneReferenzReihe(titel)
  const einheiten: Einheit[] = titel
    .filter((t) => t.anisearchId && mitSeite.has(t.anisearchId) && !keineReferenz.has(t.id))
    .map((t) => ({ id: t.id, name: t.titleRomaji ?? t.titleEn ?? `#${t.id}`, anisearchId: t.anisearchId!, haupt: t.haupt }))
  const ohneKennung = titel.filter((t) => !t.anisearchId).length
  const deckung = { titel: titel.length, mitSeite: einheiten.length, ohneSeite: titel.length - einheiten.length - ohneKennung - keineReferenz.size, ohneAnisearchKennung: ohneKennung, ohneReferenz: keineReferenz.size, seitenImArchiv: mitSeite.size, kanten: kanten.length }
  return {
    einheiten,
    referenz: new Map(titel.map((t) => [t.id, String(t.franchiseId ?? t.id)])),
    kanten: [...kanten, ...malKanten(titel.map((t) => ({ anisearchId: t.anisearchId, mal: mal(t) })))],
    namen,
    deckung,
  }
}

/** Der Vergleich ohne Schreiben: Bericht für Bau und Prüfskript. */
export function messeReihen(d: Messdaten = ladeMessdaten(), regel: Regel = REGEL): ReihenDatei {
  const bericht = vergleicheReihen(d.einheiten, d.referenz, reihenWurzel(d.kanten, regel, d.namen))
  return { stand: todayIso(), deckung: d.deckung, ...bericht }
}

/** Misst und schreibt die Liste — nur bei Änderung, damit der Stand nicht täglich committet wird. Ein Messfehler stoppt den Bau nie. */
export function schreibeReihenAbweichungen(): void {
  try {
    const neu = messeReihen()
    const alt = readJson<Partial<ReihenDatei>>(REIHEN_DATEI, {})
    if (JSON.stringify({ ...alt, stand: '' }) !== JSON.stringify({ ...neu, stand: '' })) writeJson(REIHEN_DATEI, neu, true)
    const g = neu.gesamt
    log(`aniSearch-Reihen gegen franchiseId: ${g.titel} Titel mit Seite, ${g.gleich} gleich, ${g.fehlen} fehlen, ${g.zusaetzlich} zusätzlich, ${g.gemischt} gemischt (${neu.deckung.ohneSeite} Titel ohne Seite) — Liste: ${REIHEN_DATEI}`)
  } catch (e) {
    warn(`aniSearch-Reihenliste übersprungen (Messfehler): ${(e as Error).message}`)
  }
}

/** `schreibeDatensatz` samt anschließender Messung der Reihen: die Messung liest, was der Bau gerade geschrieben hat, und ändert `public/data/` nicht. */
export function schreibeDatensatzGemessen(...args: Parameters<typeof schreibeDatensatz>): ReturnType<typeof schreibeDatensatz> {
  const ergebnis = schreibeDatensatz(...args)
  schreibeReihenAbweichungen()
  return ergebnis
}
