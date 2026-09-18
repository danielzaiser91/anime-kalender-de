/**
 * **Der Folgentitel sagt, zu welchem Titel eine Folge gehört — die Folgenzahl nur vielleicht.**
 *
 * Daniel am 18.09.2026: „warum ist es überhaupt so hart an episodenzahl gekoppelt?
 * episodentitel sind doch viel eindeutiger". Netflix zählt mal durch (Jujutsu Kaisen bis
 * 59), mal je Staffel neu (SAO), und die Staffel einer Meldung war zeitweise die
 * Ladereihenfolge des Lesers statt der Staffel des Anbieters. Der Folgentitel hängt an
 * keiner dieser Zählungen.
 *
 * aniSearch führt die deutschen Folgentitel **je Eintrag**, also genau so aufgeteilt wie
 * unser Bestand, mit eigener Zählung ab 1. Ein Treffer liefert damit Titel und
 * Folgennummer in einem Schritt, ohne Umrechnung.
 *
 * PoC 18.09.2026 über 671 Netflix-Meldungen mit Folgentitel: 466 Treffer, **alle
 * eindeutig**, 0 mehrdeutig. Von 95 Treffern mit Staffelangabe wichen 36 von der
 * Meldung ab — 34 davon Jujutsu Kaisen (Netflix zählt S2/S3 als S1 F26–59, der Anker
 * nennt S2/S3), zwei SAO-Meldungen mit vertauschter Staffel („Welt der Schwerter" als
 * S2 F1 gemeldet, ist SAO Folge 1). In keinem Fall lag der Anker falsch. Ohne Treffer
 * (übersetzte Titel weichen ab, TMDB/aniSearch führen „Folge N") bleibt es bei der
 * Zuordnung über die Zahl.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from './util.ts'

type AsFolge = { nr?: number; de?: string | null }

let asFolgen: Record<string, { folgen?: AsFolge[] }> | null = null
let asKennung: Record<string, { anisearchId?: number }> | null = null

function lade<T>(pfad: string): T {
  try {
    return JSON.parse(readFileSync(resolve(ROOT, pfad), 'utf8')) as T
  } catch {
    return {} as T
  }
}

/** Groß-/Kleinschreibung, Akzente, Satzzeichen und weiche Trennstriche zählen nicht. */
export function folgentitelKern(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/­/g, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/** Platzhalter wie „Folge 7" oder „Episode 12" tragen nichts. */
function traegt(kern: string): boolean {
  return kern.length >= 4 && !/^(folge|episode|ep)\d+$/.test(kern)
}

/** Der Folgentitel aus der Notiz einer Netflix-Meldung („Folge 3: Titel — …"). */
export function folgentitelAusNotiz(notiz: string | null | undefined): string | null {
  return /Folge \d+: ([^—]+?)\s*(?:—|$)/.exec(notiz ?? '')?.[1] ?? null
}

/**
 * Titel und Folgennummer zu einem Folgentitel, gesucht unter `kandidaten`.
 * Nur ein eindeutiger Treffer zählt: genau ein Titel, dort genau eine Folge.
 */
export function folgeUeberTitel(
  folgentitel: string | null | undefined,
  kandidaten: number[],
  /** Nur für Zusicherungen: eigene Daten statt der Dateien unter `data/`. */
  quelle?: { folgen: typeof asFolgen; kennung: typeof asKennung },
): { id: number; nr: number } | null {
  const ziel = folgentitelKern(folgentitel)
  if (!traegt(ziel)) return null
  const folgen = quelle?.folgen ?? (asFolgen ??= lade('data/anisearch-folgen.json'))!
  const kennung = quelle?.kennung ?? (asKennung ??= lade('data/anisearch.json'))!
  const treffer: Array<{ id: number; nr: number }> = []
  for (const id of new Set(kandidaten)) {
    const asId = kennung[String(id)]?.anisearchId
    if (!asId) continue
    for (const f of folgen[String(asId)]?.folgen ?? []) {
      if (typeof f.nr === 'number' && folgentitelKern(f.de) === ziel) treffer.push({ id, nr: f.nr })
    }
  }
  return treffer.length === 1 ? treffer[0]! : null
}
