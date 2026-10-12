/**
 * Reihen für westliche Animationsserien (TMDB, negative Kennungen) — belegt über Wikidata.
 *
 * TMDB kennt für Serien keine Reihenbeziehung; AniList kennt diese Titel nicht. Wikidata (CC0) führt sie
 * mit Beziehungen, die Menschen gepflegt haben. Befund, Zahlen und verworfene Wege:
 * `docs/wissen/cartoon-reihen.md`. Dieses Modul ist reine Logik (kein Netz, kein Dateizugriff).
 */

/** Wikidata-Eigenschaften, die eine Reihe stiften (gemeinsames Ziel = gemeinsame Reihe). */
export const HUB_EIGENSCHAFTEN = ['P179', 'P361', 'P8345'] as const
/** Beziehung direkt zwischen zwei Cartoons des Bestands: „basiert auf" (Ableger). */
export const KANTE_OHNE_RIEGEL = 'P144'
/** „folgt auf / gefolgt von": bei Fernsehserien oft nur der Sendeplatz — zählt nur mit gemeinsamem Wort. */
export const KANTEN_MIT_RIEGEL = ['P155', 'P156'] as const

export const ALLE_EIGENSCHAFTEN: readonly string[] = [...HUB_EIGENSCHAFTEN, KANTE_OHNE_RIEGEL, ...KANTEN_MIT_RIEGEL]

/** Was von einem Wikidata-Item gespeichert wird. `qid: null` = TMDB nennt kein Item (Nichtauskunft, kein Befund). */
export interface ReihenEintrag {
  qid: string | null
  /** Wikidata-Bezeichnung (de, sonst en) — nur für den Wortriegel und zum Nachlesen. */
  label?: string
  /** Eigenschaft → Items, auf die sie zeigt. Fehlt `rel`, sind die Aussagen noch nicht geholt. */
  rel?: Record<string, string[]>
  /** Tag, an dem die Aussagen zuletzt gelesen wurden; ältere werden neu gelesen, bei Ausfall bleiben die alten stehen. */
  aussagenAm?: string
  geholtAm: string
}

export interface HandReihe {
  name: string
  /** Cartoon-Kennungen (negativ). */
  ids: number[]
  /** Adresse, die die Zugehörigkeit belegt (Wikipedia). */
  quelle: string
}

export interface CartoonReihe {
  /** Kleinste (negativste) Kennung der Glieder — wird `franchiseId`. */
  id: number
  glieder: number[]
  /** Was die Zugehörigkeit trägt: `wikidata:Q1>P8345>Q2`, `wikidata:Q1=Q1`, `hand:<adresse>`. */
  belege: string[]
}

/** Antwort von TMDB `/tv/{id}/external_ids` → Wikidata-Kennung (oder null). */
export function qidAusExternalIds(antwort: unknown): string | null {
  const q = (antwort as { wikidata_id?: unknown } | null)?.wikidata_id
  return typeof q === 'string' && /^Q\d+$/.test(q) ? q : null
}

interface WbAussage {
  mainsnak?: { snaktype?: string; datavalue?: { value?: { id?: string } } }
  rank?: string
}
interface WbEntitaet {
  labels?: Record<string, { value?: string }>
  claims?: Record<string, WbAussage[]>
}

/** Antwort von `wbgetentities` (props=claims|labels) → Eintrag je angefragter Kennung. Fehlende Items fehlen im Ergebnis. */
export function leseEntitaeten(antwort: unknown, heute: string): Record<string, ReihenEintrag> {
  const entitaeten = (antwort as { entities?: Record<string, WbEntitaet & { missing?: unknown }> } | null)?.entities ?? {}
  const aus: Record<string, ReihenEintrag> = {}
  for (const [qid, e] of Object.entries(entitaeten)) {
    if (e.missing !== undefined) continue
    const rel: Record<string, string[]> = {}
    for (const p of ALLE_EIGENSCHAFTEN) {
      const ziele = (e.claims?.[p] ?? [])
        .filter((a) => a.mainsnak?.snaktype === 'value' && a.rank !== 'deprecated')
        .map((a) => a.mainsnak?.datavalue?.value?.id)
        .filter((id): id is string => typeof id === 'string' && /^Q\d+$/.test(id))
      if (ziele.length) rel[p] = [...new Set(ziele)].sort()
    }
    aus[qid] = { qid, label: e.labels?.de?.value ?? e.labels?.en?.value, rel, geholtAm: heute, aussagenAm: heute }
  }
  return aus
}

const UNWICHTIG = new Set(['the', 'and', 'tales', 'show', 'adventures', 'with', 'from', 'next', 'time', 'life', 'into', 'girl', 'boys'])
const woerter = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !UNWICHTIG.has(w)),
  )
/** Haben zwei Namen ein Wort (ab drei Buchstaben, ohne Füllwörter) gemeinsam? Nur Riegel nach einem Beleg, nie Quelle einer Zuordnung. */
export function gemeinsamesWort(a: string, b: string): boolean {
  const wa = woerter(a)
  for (const w of woerter(b)) if (wa.has(w)) return true
  return false
}

/**
 * Bildet die Reihen aus gespeicherten Wikidata-Aussagen und der Handdatei.
 *
 * @param daten    TMDB-Kennung (positiv, als Text) → Eintrag
 * @param namen    Cartoon-Kennung (negativ) → englischer Titel; nur diese Cartoons zählen
 * @param ausgeschlossen Kennungen, die nicht (mehr) als Cartoon gelten (Umzug zu den Animes)
 */
export function bildeReihen(
  daten: Record<string, ReihenEintrag>,
  namen: Map<number, string>,
  hand: HandReihe[],
  ausgeschlossen: ReadonlySet<number> = new Set(),
): CartoonReihe[] {
  const gilt = (id: number) => namen.has(id) && !ausgeschlossen.has(id)
  const g = neueGruppierung()
  const idsVonQid = new Map<string, number[]>()
  const eintragVon = new Map<number, ReihenEintrag>()
  for (const [tmdb, e] of Object.entries(daten)) {
    const id = -Number(tmdb)
    if (!gilt(id) || !e.qid) continue
    eintragVon.set(id, e)
    idsVonQid.set(e.qid, [...(idsVonQid.get(e.qid) ?? []), id])
  }
  verbindeWikidata(g, eintragVon, idsVonQid, (id) => `${namen.get(id) ?? ''} ${eintragVon.get(id)?.label ?? ''}`)
  for (const h of hand) {
    const ids = h.ids.filter(gilt)
    for (const id of ids.slice(1)) g.vereine(ids[0]!, id)
    g.beleg(ids, `hand:${h.quelle}`)
  }
  return g.reihen([...namen.keys()].filter(gilt))
}

interface Gruppierung {
  vereine(a: string | number, b: string | number): void
  beleg(ids: number[], text: string): void
  /** Die Gruppen mit mindestens zwei belegten Gliedern aus `kandidaten`. */
  reihen(kandidaten: number[]): CartoonReihe[]
}

/** Union-Find über Cartoon-Kennungen und Hub-Namen, dazu die Belege je Cartoon. */
function neueGruppierung(): Gruppierung {
  const parent = new Map<string | number, string | number>()
  const finde = (x: string | number): string | number => {
    if (!parent.has(x)) parent.set(x, x)
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(x, r)
    return r
  }
  const belege = new Map<number, Set<string>>()
  return {
    vereine(a, b) {
      const ra = finde(a)
      const rb = finde(b)
      if (ra !== rb) parent.set(ra, rb)
    },
    beleg(ids, text) {
      for (const id of ids) {
        if (!belege.has(id)) belege.set(id, new Set())
        belege.get(id)!.add(text)
      }
    },
    reihen(kandidaten) {
      const gruppen = new Map<string | number, number[]>()
      for (const id of kandidaten) {
        if (!belege.has(id)) continue
        const w = finde(id)
        gruppen.set(w, [...(gruppen.get(w) ?? []), id])
      }
      const reihen: CartoonReihe[] = []
      for (const glieder of gruppen.values()) {
        if (glieder.length < 2) continue
        glieder.sort((a, b) => a - b)
        const b = [...new Set(glieder.flatMap((x) => [...(belege.get(x) ?? [])]))].sort()
        reihen.push({ id: glieder[0]!, glieder, belege: b })
      }
      return reihen.sort((a, b) => a.id - b.id)
    },
  }
}

/** Verbindet Cartoons über gleiche Items, gemeinsame Hubs und Kanten (Regeln: Kopf der Datei und `docs/wissen/cartoon-reihen.md`). */
function verbindeWikidata(
  g: Gruppierung,
  eintragVon: Map<number, ReihenEintrag>,
  idsVonQid: Map<string, number[]>,
  name: (id: number) => string,
): void {
  for (const [qid, ids] of idsVonQid) {
    // Zwei TMDB-Serien, ein Wikidata-Item: dasselbe Werk (TMDB führt Staffeln mitunter einzeln).
    for (const id of ids.slice(1)) g.vereine(ids[0]!, id)
    if (ids.length > 1) g.beleg(ids, `wikidata:${qid}=${qid}`)
  }
  for (const [id, e] of eintragVon) {
    for (const p of HUB_EIGENSCHAFTEN) {
      for (const ziel of e.rel?.[p] ?? []) {
        const eigene = idsVonQid.get(ziel)
        g.vereine(id, eigene ? eigene[0]! : `hub:${ziel}`)
        g.beleg([id, ...(eigene ?? [])], `wikidata:${e.qid}>${p}>${ziel}`)
      }
    }
    for (const p of [KANTE_OHNE_RIEGEL, ...KANTEN_MIT_RIEGEL]) {
      for (const ziel of e.rel?.[p] ?? []) {
        for (const anderer of idsVonQid.get(ziel) ?? []) {
          if (p !== KANTE_OHNE_RIEGEL && !gemeinsamesWort(name(id), name(anderer))) continue
          g.vereine(id, anderer)
          g.beleg([id, anderer], `wikidata:${e.qid}>${p}>${ziel}`)
        }
      }
    }
  }
}

/** Zusicherungen an das Ergebnis; liefert Verstöße als Text (leer = in Ordnung). */
export function pruefeReihen(reihen: CartoonReihe[], hand: HandReihe[]): string[] {
  const fehler: string[] = []
  const gesehen = new Map<number, number>()
  for (const r of reihen) {
    if (r.glieder.length < 2) fehler.push(`Reihe ${r.id} hat weniger als zwei Glieder`)
    if (!r.belege.length) fehler.push(`Reihe ${r.id} ohne Beleg`)
    if (r.id !== Math.min(...r.glieder)) fehler.push(`Reihe ${r.id}: Kennung ist nicht die kleinste`)
    for (const g of r.glieder) {
      if (gesehen.has(g)) fehler.push(`Cartoon ${g} liegt in zwei Reihen (${gesehen.get(g)} und ${r.id})`)
      gesehen.set(g, r.id)
    }
  }
  for (const h of hand) {
    if (!/^https:\/\/\S+$/.test(h.quelle ?? '')) fehler.push(`Handreihe „${h.name}" ohne Adresse als Quelle`)
    if ((h.ids ?? []).length < 2 || h.ids.some((i) => !(i < 0))) fehler.push(`Handreihe „${h.name}": mindestens zwei negative Kennungen nötig`)
  }
  return fehler
}
