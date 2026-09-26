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
    if (!b.titel || !b.folge || !b.vorhanden) continue
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
  m: { titel_id: number | null; folge_nr: number | null; teil_von: number | null; teil_bis: number | null },
  vorhanden: string | null,
  einzelwerk: (titelId: number) => boolean,
): { von: number; bis: number } | { verworfen: MeldungVerworfen } {
  if (!m.titel_id) return { verworfen: 'ohne Titel' }
  if (!vorhanden) return { verworfen: 'ohne Befund' }
  let von = m.folge_nr ?? m.teil_von
  let bis = m.folge_nr ?? m.teil_bis
  if (!von && !bis && einzelwerk(m.titel_id)) von = bis = 1
  if (!von || !bis) return { verworfen: 'ohne Folgennummer' }
  if (bis < von || bis - von > 500) return { verworfen: 'Spanne unplausibel' }
  return { von, bis }
}
