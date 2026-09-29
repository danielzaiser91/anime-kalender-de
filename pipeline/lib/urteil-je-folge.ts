import { schluesselAdresse, titelSchluessel } from './zuordnung.ts'
import { adressKern } from './dub-confirmed.ts'
import { staffelNummern } from './staffel-nummern.ts'

/**
 * **Stufe 3: das Urteil je Titel × Anbieter × Folge** (22.09.2026, Modell in
 * `docs/konzept-meldungen-architektur.md`). Reine Funktion, schreibt nichts.
 *
 * Ebene (a) des Modells: **Wo eine eigene Prüfung vorliegt, gilt sie** — die jüngste, am selben Tag
 * gemessen vor abgeleitet vor angenommen. Zwei Quellen liefern sie:
 * - eine Beobachtung je Anbieter-Folge (`prime_folge`) über die Zuordnung aus Stufe 2,
 * - eine Meldung mit Folgennummer (`pruefung`), die ihre Folge selbst nennt.
 *
 * Zwei Regeln aus dem PoC vom 22.09.2026, beide gemessen:
 * - **Ein Nein von einer Kanal-Seite ist keine Auskunft**, sondern `unbekannt` mit Grund
 *   „mit Abo prüfen" — ohne das Abo des Kanals zeigt Prime keine Tonspuren. Das Merkmal hängt an
 *   der Meldung (`abos`), nicht nur an der Rohfolge: Bei Captain Tsubasa, Haikyu!!, Slime und
 *   Trapped in a Dating Sim stand das Nein in der Meldung.
 * - **Eine Rohfolge ohne Tonspuren ist eine Störung**, keine Beobachtung (Szenario 10).
 */
export interface UrteilBeobachtung {
  titel: number
  anbieter: string
  folge: number
  /** `ja` · `nein` (gesperrt/nicht im Angebot) */
  vorhanden: string
  /** `ja` · `nein` · `unbekannt` */
  tonDe: string
  art: 'gemessen' | 'abgeleitet' | 'angenommen'
  /** Tag der Beobachtung, `YYYY-MM-DD`. */
  tag: string
  /** Das Nein stammt von einer Kanal-Seite ohne Abo. */
  kanal?: boolean
}

export interface Urteil {
  /** `deutsch` · `kein deutsch` · `nicht verfügbar` · `unbekannt` */
  urteil: string
  art: UrteilBeobachtung['art']
  tag: string
  /** Warum es unbekannt ist, wenn eine Beobachtung vorlag. */
  grund?: 'kanal-ohne-abo'
}

const RANG: Record<UrteilBeobachtung['art'], number> = { gemessen: 3, abgeleitet: 2, angenommen: 1 }

export function urteileJeFolge(beobachtungen: UrteilBeobachtung[]): Record<string, Urteil> {
  const jung = new Map<string, UrteilBeobachtung>()
  for (const b of beobachtungen) {
    if (!b.titel || b.folge == null || b.folge < 0 || !b.vorhanden) continue
    const k = `${b.titel}|${b.anbieter}|${b.folge}`
    const alt = jung.get(k)
    if (!alt || b.tag > alt.tag || (b.tag === alt.tag && RANG[b.art] > RANG[alt.art])) jung.set(k, b)
  }
  const aus: Record<string, Urteil> = {}
  for (const [k, b] of jung) {
    if (b.vorhanden === 'nein') aus[k] = { urteil: 'nicht verfügbar', art: b.art, tag: b.tag }
    else if (b.tonDe === 'ja') aus[k] = { urteil: 'deutsch', art: b.art, tag: b.tag }
    else if (b.tonDe === 'nein' && b.kanal) aus[k] = { urteil: 'unbekannt', art: b.art, tag: b.tag, grund: 'kanal-ohne-abo' }
    else if (b.tonDe === 'nein') aus[k] = { urteil: 'kein deutsch', art: b.art, tag: b.tag }
    else aus[k] = { urteil: 'unbekannt', art: b.art, tag: b.tag }
  }
  return wegUrteileBereinigen(aus)
}

/**
 * **Folge 0 ist der ganze Weg** (27.09.2026, Stufe 4 Schritt 3): Eine Meldung „nicht verfügbar" ohne
 * Folgennummer gilt der Seite, nicht einer Folge. Ihr Urteil weicht, sobald eine **jüngere**
 * Beobachtung einer einzelnen Folge desselben Wegs vorliegt — dann ist die Seite offenbar wieder da.
 */
function wegUrteileBereinigen(aus: Record<string, Urteil>): Record<string, Urteil> {
  const juengsteFolge = new Map<string, string>()
  for (const [k, u] of Object.entries(aus)) {
    if (k.endsWith('|0')) continue
    const weg = k.slice(0, k.lastIndexOf('|'))
    if (u.tag > (juengsteFolge.get(weg) ?? '')) juengsteFolge.set(weg, u.tag)
  }
  for (const [k, u] of Object.entries(aus)) {
    if (k.endsWith('|0') && (juengsteFolge.get(k.slice(0, -2)) ?? '') > u.tag) delete aus[k]
  }
  return aus
}

/** Warum eine Meldung keine Beobachtung je Folge ergibt — gezählt, nicht still verworfen. */
export type MeldungVerworfen = 'ohne Titel' | 'ohne Befund' | 'ohne Folgennummer' | 'Spanne unplausibel'

/**
 * **Welche Folgen eine Meldung beobachtet** (26.09.2026, Stufe 4 Schritt 3).
 *
 * Bis hierhin ergab eine Meldung ohne Folgennummer gar keine Beobachtung. Gemessen am 26.09.2026:
 * Von 2.010 aus der Erweiterung eingelesenen Handbelegen trug nur 564 ein Urteil — darunter fehlten
 * alle Prime-Filme (Kikis kleiner Lieferservice, The First Slam Dunk, Girls und Panzer: Der Film),
 * weil eine Filmseite keine Folgennummer meldet. Ein Einzelwerk hat genau eine Folge; dort ist die
 * Nummer keine Annahme. Eine Staffelmeldung ohne Nummer bleibt verworfen — welche Folgen sie meint,
 * sagen nur die Rohfolgen über die Zuordnung.
 */
export function folgenDerMeldung(
  m: { titel_id: number | null; folge_nr: number | null; teil_von: number | null; teil_bis: number | null; plattform?: string; url?: string },
  vorhanden: string | null,
  einzelwerk: (titelId: number) => boolean,
  /**
   * **Der Rückfall über die Rohfolgen** (29.09.2026): Eine Meldung über eine ganze Staffel trägt oft
   * keine Nummer — der Kasten meldet „alle 12 Folgen deutsch", nicht „Folge 5". Solange die Rohfolgen
   * derselben Adresse feststehen, ist die Spanne bekannt.
   */
  rohspanne?: (titelId: number, plattform: string, url: string) => { von: number; bis: number } | undefined,
): { von: number; bis: number } | { verworfen: MeldungVerworfen } {
  if (!m.titel_id) return { verworfen: 'ohne Titel' }
  if (!vorhanden) return { verworfen: 'ohne Befund' }
  let von = m.folge_nr ?? m.teil_von
  let bis = m.folge_nr ?? m.teil_bis
  if (!von && !bis && einzelwerk(m.titel_id)) von = bis = 1
  /* "Nicht verfügbar" ohne Nummer meint die ganze Seite: Folge 0 (`wegUrteileBereinigen`). */
  if (!von && !bis && vorhanden === 'nein') return { von: 0, bis: 0 }
  if (!von || !bis) {
    const roh = rohspanne && m.plattform && m.url ? rohspanne(m.titel_id, m.plattform, m.url) : undefined
    if (roh) return roh
    return { verworfen: 'ohne Folgennummer' }
  }
  if (bis < von || bis - von > 500) return { verworfen: 'Spanne unplausibel' }
  return { von, bis }
}

/**
 * **Welche Folgen eine Adresse laut Rohfolgen führt** — für Meldungen ohne Nummer (29.09.2026).
 *
 * Die Rohfolgen aus `?rohfolgen=1&alle=1` tragen keine Nummer; sie bekommt jede über die Zuordnung
 * aus Stufe 2 (`data/folgen-zuordnung.json`, `plattform:asin|gti → { titel, folge }`). Für die
 * Zuordnung zählen hier **Titel, Anbieter und Adresse** zusammen: Nur dann gilt die Spanne für die
 * Meldung, sonst würde eine Staffelmeldung auf Folgen gestempelt, die sie nie gesehen hat.
 *
 * Gemessen im Bestandslauf vom 29.09.2026: **799 Meldungen** wurden als „ohne Folgennummer"
 * verworfen (`pipeline/fetch-urteile.ts`).
 */
export function rohfolgenSpanne(
  rohfolgen: { plattform: string; url: string; asin: string | null; gti: string | null }[],
  zuordnung: Record<string, { titel?: number; folge?: number }>,
): (titelId: number, plattform: string, url: string) => { von: number; bis: number } | undefined {
  const karte = new Map<string, { von: number; bis: number }>()
  for (const f of rohfolgen) {
    const z = zuordnung[`${f.plattform}:${f.asin ?? f.gti}`]
    if (!z?.titel || !z.folge) continue
    const k = `${z.titel}|${f.plattform}|${adressKern(f.url)}`
    const alt = karte.get(k)
    karte.set(k, alt ? { von: Math.min(alt.von, z.folge), bis: Math.max(alt.bis, z.folge) } : { von: z.folge, bis: z.folge })
  }
  return (titelId, plattform, url) => karte.get(`${titelId}|${plattform}|${adressKern(url)}`)
}

/**
 * Adresse → unsere Titel, aus `streams` samt geöffneter Seite (`seite`) — wie im Einleser. Eine
 * Prime-Suchadresse (`/s?k=…`) löst der Suchbegriff auf, wie `ausSuchadresse` in
 * `fetch-pruefungen.ts`: Name gleich nach `titelSchluessel`, nur eindeutig.
 */
export function adressIndex(
  titel: { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string; streams?: { url: string; seite?: string }[] }[],
): (url: string) => number[] | undefined {
  const nachName = new Map<string, Set<number>>()
  for (const t of titel)
    for (const n of [t.titleDe, t.titleEn, t.titleRomaji]) {
      const k = n ? titelSchluessel(n) : ''
      if (k) nachName.set(k, (nachName.get(k) ?? new Set()).add(t.id))
    }
  const ausSuche = (url: string): number[] | undefined => {
    let begriff: string | null = null
    try {
      begriff = new URL(url).searchParams.get('k')
    } catch {
      return undefined
    }
    for (const v of begriff ? [begriff, begriff.replace(/\s+[—–-]\s+Teil\s+\d+\s*$/i, '')] : []) {
      const ids = nachName.get(titelSchluessel(v))
      if (ids?.size === 1) return [...ids]
    }
    return undefined
  }
  const index = new Map<string, number[]>()
  for (const t of titel)
    for (const s of t.streams ?? [])
      for (const u of new Set([s.url, s.seite])) {
        if (!u) continue
        const liste = index.get(schluesselAdresse(u)) ?? []
        if (!liste.includes(t.id)) index.set(schluesselAdresse(u), [...liste, t.id])
      }
  return (url) => index.get(schluesselAdresse(url)) ?? (url.includes('/s?k=') ? ausSuche(url) : undefined)
}

/** Ein Kandidat für die Staffel-Zuordnung — nur, was `staffelNummern()` braucht. */
export interface StaffelKandidat {
  id: number
  name: string
  episodes?: number | null
  jpYear?: number
  jpStart?: string
  format?: string
  beiwerk?: boolean
}

/** Die Folgenzahl, die der Anbieter für seine Staffel `staffel` nennt — aus der gemeldeten Struktur. */
function folgenDerAnbieterStaffel(staffeln: string | null, staffel: number): number | null {
  try {
    const liste = JSON.parse(staffeln ?? '[]') as { seq?: number; folgen?: number }[]
    return liste.find((s) => s.seq === staffel)?.folgen ?? null
  } catch {
    return null
  }
}

/**
 * **Die mehrdeutige Adresse über die Staffel entscheiden** (29.09.2026).
 *
 * Der zweite große Posten der Meldungen ohne Titel (768 von 4.693 im Bestandslauf 29.09.) waren
 * Adressen, die **mehrere unserer Titel** tragen: eine Netflix- oder Disney+-Serienseite führt
 * mehrere Staffeln, und bei uns hängt jede Staffel als eigener Titel an derselben Adresse
 * (gemessen: JJK 60 Meldungen, Vinland Saga 26, Kuroko 27). Die Adresse allein sagt dort nicht,
 * welche Staffel gemeint ist — die **Meldung** nennt sie aber: `staffel` samt Anbieter-Struktur.
 *
 * Drei Riegel, jeder aus einem gemessenen Fall:
 * - **Genau ein Kandidat** muss die gemeldete Staffelnummer tragen (`staffelNummern()` auf die
 *   Kandidatengruppe). Trägt sie keiner oder mehrere, bleibt es offen.
 * - **Dasselbe Werk zweimal** ist nicht entscheidbar (Fate/Zero, Go! Go! Loser Ranger stehen doppelt
 *   im Bestand) — gleicher normalisierter Name heißt: liegen lassen.
 * - **Die Folgenzahl muss passen** (wie im Einleser, 19.09.2026): Nennt der Anbieter für seine
 *   Staffel eine andere Zahl als der Kandidat (Tokyo Revengers: Anbieter 24, Kandidat 13), gilt die
 *   Nummer nicht. Toleranz drei Folgen, wie bei `ordneMeldungZu()`.
 *
 * Gemessen am 29.09.2026 an den echten 768: 389 werden so zuordenbar (59 fallen am Folgenzahl-Riegel,
 * 176 nennen keine Staffel, 144 sind mehrdeutig oder ohne Nummer).
 */
export function staffelTreffer(
  m: { staffel?: number | null; staffeln?: string | null; folgen?: number | null },
  kandidaten: StaffelKandidat[],
): number | null {
  if (m.staffel == null) return null
  const benannt = kandidaten.filter((k) => k.name)
  if (benannt.length < 2) return null
  const namen = benannt.map((k) =>
    k.name.normalize('NFD').replace(/\p{M}|[^\p{L}\p{N}]/gu, '').toLowerCase(),
  )
  if (new Set(namen).size !== namen.length) return null
  const nummern = staffelNummern(benannt)
  const treffer = benannt.filter((k) => nummern.get(k.id) === m.staffel)
  if (treffer.length !== 1) return null
  const ziel = treffer[0]!
  const anbieterFolgen =
    folgenDerAnbieterStaffel(m.staffeln ?? null, m.staffel) ?? (typeof m.folgen === 'number' ? m.folgen : null)
  if (anbieterFolgen && ziel.episodes && Math.abs(anbieterFolgen - ziel.episodes) > 3) return null
  return ziel.id
}

/**
 * **Eine Adresse unbekannte Meldung über ihren Namen zuordnen** — wie der Einleser
 * (`fetch-pruefungen.ts`, Zeile 599–649): Der Anbieter-Name (`serientitel`, sonst `titel`) muss
 * **exakt** auf genau einen unserer Titel passen. Ein Name ist eine Ähnlichkeit, kein Beleg
 * (Daniel, 23.08.2026: „ein Name ist eine Ähnlichkeit, kein Beleg") — deshalb nichts Ungefähres,
 * kein Anfangstreffer, nur der eine exakte.
 */
export function nameIndex(
  titel: { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string }[],
): (name: string) => number[] | undefined {
  const nachName = new Map<string, Set<number>>()
  for (const t of titel)
    for (const n of [t.titleDe, t.titleEn, t.titleRomaji]) {
      const k = n ? titelSchluessel(n) : ''
      if (k) (nachName.get(k) ?? nachName.set(k, new Set()).get(k)!).add(t.id)
    }
  return (name) => {
    const ids = nachName.get(titelSchluessel(name))
    return ids ? [...ids] : undefined
  }
}

/**
 * **Eine Meldung ohne Titel über ihre Adresse zuordnen** — wie der Einleser (`fetch-pruefungen.ts`),
 * aber nur eindeutig: Die Adresse gehört genau einem unserer Titel, und die Meldung nennt keine
 * spätere Staffel (eine Serienseite führt oft mehrere, bei uns hängt nur eine daran). Vor dem
 * 02.09.2026 schickte die Erweiterung keine `titel_id` mit — 5.807 von 7.510 Meldungen.
 * Gemessen 27.09.2026: Handbelege mit Urteil 552 → 702 von 2.049 (docs/konzept-meldungen-architektur.md).
 *
 * Trägt die Adresse **mehrere** Titel, entscheidet die gemeldete Staffel (`staffelTreffer`), sofern
 * der Aufrufer die Kandidaten mitgibt — die bewusste Regel für spätere Staffeln bleibt davor.
 *
 * Ist die Adresse **gar nicht bekannt**, entscheidet der Name (`nameIndex`) — dieselbe Reihenfolge
 * wie im Einleser. Gemessen am 29.09.2026 trugen 665 der 763 solchen Meldungen einen Serientitel,
 * der genau einen unserer Titel exakt trifft.
 */
export function titelDerMeldung(
  m: {
    titel_id: number | null
    url: string
    staffel?: number | null
    staffeln?: string | null
    folgen?: number | null
    titel?: string | null
    serientitel?: string | null
  },
  nachAdresse: (url: string) => number[] | undefined,
  kandidaten?: (ids: number[]) => StaffelKandidat[],
  nachName?: (name: string) => number[] | undefined,
): number | null {
  if (m.titel_id) return m.titel_id
  if (m.staffel != null && m.staffel !== 1) return null
  const ids = nachAdresse(m.url)
  if (ids?.length === 1) return ids[0]!
  if (ids && ids.length > 1) return kandidaten ? staffelTreffer(m, kandidaten(ids)) : null
  const name = m.serientitel ?? m.titel
  if (!name || !nachName) return null
  const treffer = nachName(name)
  return treffer?.length === 1 ? treffer[0]! : null
}

/**
 * **Warum eine Meldung ohne Titel bleibt** (29.09.2026).
 *
 * Der größte Verwerfungsposten des Urteilslaufs: **4.693 Meldungen** (Bestandslauf 29.09., 17:13).
 * Sie erzeugen keine einzige Beobachtung — ihre Auskunft fehlt also im Urteil. Bevor daran gebaut
 * wird, wird gezählt, **welcher Anteil welchen Grund** hat: Die drei Gründe brauchen drei
 * verschiedene Antworten (eine Regel, eine Adressauflösung, oder gar keine).
 */
export type MeldungOhneTitel = 'späte Staffel' | 'Adresse unbekannt' | 'Adresse mehrdeutig'

export function meldungGrund(
  m: { titel_id: number | null; url: string; staffel?: number | null },
  nachAdresse: (url: string) => number[] | undefined,
): MeldungOhneTitel | null {
  if (m.titel_id) return null
  /* Eine Serienseite führt oft mehrere Staffeln, bei uns hängt nur eine daran - bewusst offen. */
  if (m.staffel != null && m.staffel !== 1) return 'späte Staffel'
  const ids = nachAdresse(m.url)
  if (!ids?.length) return 'Adresse unbekannt'
  return 'Adresse mehrdeutig'
}
