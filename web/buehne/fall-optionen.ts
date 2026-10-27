import type { Fall } from './faelle-bau.ts'

/** Alle Felder, aus denen das Panel die Tonspur einer Zeile liest (`streamStatus`, `streamWegStatus`, `streamNurOmu`). */
export const TONSPUR_FELDER = ['dub', 'dubRanges', 'dubQuelle', 'dubStand', 'dubHintOnly', 'dubAbgeleitet'] as const

/** Die Dateien eines Falls, die Titel samt Stream- und Kaufwegen tragen. */
const TITEL_DATEIEN = ['titles-core.json', 'titles.json']

/** Überschreibt Felder eines Falls; `tonspur: 'ohne-beleg'` löscht jeden Sprachbeleg an allen Wegen. */
export interface FallOptionen {
  tonspur?: 'ohne-beleg'
}

/** Abgeleitete Fälle: Kennung → Ausgangsfall, Anzeigename und Optionen. */
export const OPTIONS_FAELLE: Record<string, { von: string; name: string; optionen: FallOptionen }> = {
  '86-ohne-beleg': { von: '86', name: '86 – alle Zeilen ohne Sprachbeleg', optionen: { tonspur: 'ohne-beleg' } },
  /* Gleiche Daten, andere Ausgangslage: das Mockup öffnet die Datenbank hier mit einem Jahresfilter (`suchadressen`). */
  'hajime-no-ippo-jahr': { von: 'hajime-no-ippo', name: 'Hajime no Ippo – Suche mit Jahresfilter', optionen: {} },
  'tokyo-revengers-jahr': { von: 'tokyo-revengers', name: 'Tokyo Revengers – Suche mit Jahresfilter', optionen: {} },
  /* Mit „Staffeln zusammenfassen“ (Adresse `staffeln=1`) zählt der Suchhinweis Karten statt Titel. */
  'attack-on-titan-zusammen': { von: 'attack-on-titan', name: 'Attack on Titan – Staffeln zusammengefasst', optionen: {} },
  'hajime-no-ippo-zusammen': { von: 'hajime-no-ippo', name: 'Hajime no Ippo – Staffeln zusammengefasst', optionen: {} },
}

type Weg = Record<string, unknown>

function ohneTonspur(weg: Weg): Weg {
  return Object.fromEntries(Object.entries(weg).filter(([feld]) => !(TONSPUR_FELDER as readonly string[]).includes(feld)))
}

function titelOhneTonspur(titel: Record<string, unknown>): Record<string, unknown> {
  const neu = { ...titel }
  for (const liste of ['streams', 'watchLinks']) {
    if (Array.isArray(neu[liste])) neu[liste] = (neu[liste] as Weg[]).map(ohneTonspur)
  }
  return neu
}

/** Eine Kopie des Falls mit den Optionen; der Ausgangsfall bleibt unverändert. */
export function mitOptionen(fall: Fall, optionen: FallOptionen, name: string): Fall {
  const kopie: Fall = { ...fall, name }
  if (optionen.tonspur === 'ohne-beleg') {
    for (const datei of TITEL_DATEIEN) {
      if (Array.isArray(fall[datei])) kopie[datei] = (fall[datei] as Record<string, unknown>[]).map(titelOhneTonspur)
    }
  }
  return kopie
}

/** Ergänzt `faelle` um die abgeleiteten Fälle aus `OPTIONS_FAELLE`. */
export function ergaenzeOptionsFaelle(faelle: Record<string, Fall>, vorlage = OPTIONS_FAELLE): void {
  for (const [kennung, spec] of Object.entries(vorlage)) {
    const von = faelle[spec.von]
    if (von) faelle[kennung] = mitOptionen(von, spec.optionen, spec.name)
  }
}
