/**
 * **Freigabe eines Vorschlags** (Sammler `pipeline/fetch-offizielle-news.ts` → `data/proposals/offizielle-news.json` → `data/offizielle-meldungen.yaml`).
 * Das Werkzeug `pipeline/offizielle-freigabe.ts` macht aus einem Vorschlag den Handeintrag, ohne Tippfehler in Tag, Adresse oder Überschrift: Es übernimmt sie
 * wörtlich aus dem Vorschlag; Kategorie, Kachel und Name der Freigabe setzt der Mensch.
 */
import { KATEGORIEN_OFFIZIELL, offiziellFehler, type OffizielleMeldung } from './news-offiziell.ts'
import type { OffiziellKategorie } from '../../shared/types.ts'

/** Die Felder eines Vorschlags, die ein Eintrag übernimmt (Form der Sammlerdatei). */
export interface Vorschlag {
  id: string
  titel: string
  datum: string
  url: string
  sprache: string
  titelIds: number[]
}

export interface FreigabeAngaben {
  kategorie?: string
  titleId?: number
  freigabe?: string
}

/** Der Eintrag zu einem Vorschlag; wirft mit allen Fehlern, wenn er unvollständig oder falsch wäre. */
export function eintragAusVorschlag(v: Vorschlag, a: FreigabeAngaben, bekannteIds: Set<string>): OffizielleMeldung {
  const eintrag = { id: v.id, titleId: a.titleId ?? (v.titelIds.length === 1 ? v.titelIds[0] : undefined), kategorie: a.kategorie, datum: v.datum, url: v.url, titel: v.titel, sprache: v.sprache, freigabe: a.freigabe }
  const fehler = offiziellFehler(eintrag, bekannteIds)
  if (fehler.length) throw new Error(`Vorschlag ${v.id}: ${fehler.join('; ')}${v.titelIds.length > 1 ? ` (mehrere Kacheln möglich: ${v.titelIds.join(', ')} – mit --titel wählen)` : ''}`)
  return eintrag as OffizielleMeldung
}

/** Der Eintrag als YAML-Block zum Anhängen; Zeichenketten in Anführungszeichen (JSON-Schreibweise ist gültiges YAML), damit Doppelpunkte und Datumsformen nichts verändern. */
export function eintragText(e: OffizielleMeldung): string {
  const zeilen = [
    `  - id: ${JSON.stringify(e.id)}`,
    `    titleId: ${e.titleId}`,
    `    kategorie: ${e.kategorie}`,
    `    datum: ${JSON.stringify(e.datum)}`,
    `    url: ${JSON.stringify(e.url)}`,
    `    titel: ${JSON.stringify(e.titel)}`,
    `    sprache: ${e.sprache}`,
    `    freigabe: ${JSON.stringify(e.freigabe)}`,
  ]
  return `${zeilen.join('\n')}\n`
}

export const kategorienText = (): string => (KATEGORIEN_OFFIZIELL as readonly OffiziellKategorie[]).join(' | ')
