/**
 * Handbeleg-Block (Prime), dessen Notiz „Amazon-Seite X“ eine andere Seite nennt als seine `url`, und X ist die `url` eines
 * Blocks genau eines anderen Titels (03.11.2026, Anlass Es war einmal … der Weltraum: Staffel-2-Adresse, Messung der
 * Staffel-1-Seite). Der Besitz kommt allein aus den Handbelegen; `titles.json` deckt `check-handbeleg-notizseite-bestand.ts` ab.
 * Eine abweichende Notizseite allein ist kein Fehler: die Erweiterung schreibt dieselbe Messung an die Adressen mehrerer
 * Staffeln desselben Titels (230 von 2909 Prime-Blöcken, Stand 03.11.2026). Nennt die Notiz auch die Adresse des Blocks
 * („Kauf-Seite X, Abo auf Y“), gilt der Block als stimmig.
 * Abgrenzung zu `findeFremdeNotizseiten`: dort kommt der Besitz aus `titles.json`; hier nur aus den Handbelegen. Die
 * Doppelführung von 20913 und 180745 in beiden Wächtern ist gewollt (die Bestandsprüfung filtert sie über deren Ratsche).
 */
import { asinsAus, notizSeiteVon, type BlockSeite } from './handbeleg-notizseite.ts'

/** Schlüssel `<Kennung>@<Notizseite>`, sortiert. */
export function findeFremdeNoteAsins(belege: BlockSeite[]): string[] {
  const besitzer = new Map<string, Set<number>>()
  for (const b of belege) {
    const u = asinsAus(b.url)[0]
    if (b.platform !== 'primevideo' || b.anilistId === undefined || !u) continue
    besitzer.set(u, (besitzer.get(u) ?? new Set()).add(b.anilistId))
  }
  const treffer = new Set<string>()
  for (const b of belege) {
    const u = asinsAus(b.url)[0]
    const x = notizSeiteVon(b.note)
    if (b.platform !== 'primevideo' || b.anilistId === undefined || !u || !x || asinsAus(b.note).includes(u)) continue
    const o = besitzer.get(x)
    if (o && o.size === 1 && !o.has(b.anilistId)) treffer.add(`${b.anilistId}@${x}`)
  }
  return [...treffer].sort()
}

/** Ratsche (Stand 03.11.2026): Treffer des Bestands, die `check-handbeleg-notizseite-bestand.ts` nicht schon führt. Nur streichen, Ziel 0. */
export const NOTE_ASIN_ALTFAELLE: string[] = []
