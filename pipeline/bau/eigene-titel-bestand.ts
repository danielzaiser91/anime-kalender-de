import { type EigenerEintrag, eigeneId, katalogFuehrtJetzt } from './eigene-titel.ts'

type Titel = Parameters<typeof katalogFuehrtJetzt>[1][number] & { coverImage?: string }

export interface EigeneLage {
  /** Zeilen, die nicht in der Ausgabe stehen oder deren Titel nach `zuId` noch da ist: der Bau hat sie nicht richtig umgesetzt. */
  rot: { text: string; titleId?: number }[]
  /** `⚠ WARNUNG`-Zeilen: der Katalog führt den Titel jetzt, der Termin aus der Meldung oder das Cover fehlt. */
  warnungen: string[]
}

/** Was an einem vorhandenen eigenen Titel fehlt: der Termin beim belegten Anbieter, das Cover (es gibt keine Quelle, bis eine TMDB-Zuordnung getragen ist). */
function fehlendes(e: EigenerEintrag, titel: Titel, releases: { titleId: number; platform: string }[]): string[] {
  const raus: string[] = []
  if (!releases.some((r) => r.titleId === titel.id && e.anbieter.includes(r.platform))) raus.push(`„${e.name}“ (Zeile ${e.nr}): die Meldung hat keinen Termin bei ${e.anbieter.join('/')} ergeben — der Titel steht ohne Datum im Kalender`)
  if (!titel.coverImage) raus.push(`„${e.name}“ (Zeile ${e.nr}) hat kein Cover — der Titel steht ohne Bild im Kalender`)
  return raus
}

/**
 * Prüft die Handdatei gegen die gebaute Ausgabe (`titles.json` = `haupt`, `ohne-synchro.json` = `hinter`, `releases.json`).
 * Rot: eine Zeile ohne `zuId` und ohne Widerruf muss im Hauptbestand stehen (nie hinter dem Schalter, nie fehlen); eine mit `zuId` darf
 * nirgends mehr stehen; eine widerrufene auch nicht. Warnung: „Katalog führt jetzt X“, ein Titel ohne Termin beim belegten Anbieter, ein Titel ohne Cover.
 */
export function pruefeEigeneImBestand(eintraege: EigenerEintrag[], haupt: Titel[], hinter: Titel[], releases: { titleId: number; platform: string }[]): EigeneLage {
  const lage: EigeneLage = { rot: [], warnungen: [] }
  const imHaupt = new Map(haupt.map((t) => [t.id, t]))
  const imHinter = new Set(hinter.map((t) => t.id))
  for (const e of eintraege) {
    const id = eigeneId(e.nr)
    const da = imHaupt.has(id) || imHinter.has(id)
    if (e.zuId || e.widerrufen) {
      if (da) lage.rot.push({ titleId: id, text: `„${e.name}“ (Zeile ${e.nr}) steht in der Ausgabe, obwohl ${e.zuId ? `zuId ${e.zuId} gesetzt` : 'widerrufen'} ist` })
      continue
    }
    const titel = imHaupt.get(id)
    if (!titel) lage.rot.push({ ...(da ? { titleId: id } : {}), text: `„${e.name}“ (Zeile ${e.nr}) steht ${da ? 'hinter dem Schalter' : 'nicht in der Ausgabe'}, nicht im Hauptbestand` })
    else lage.warnungen.push(...fehlendes(e, titel, releases))
  }
  lage.warnungen.push(...katalogFuehrtJetzt(eintraege, [...haupt, ...hinter]))
  return lage
}
