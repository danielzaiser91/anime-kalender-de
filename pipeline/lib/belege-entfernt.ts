/**
 * **Entfernte Handbelege kommen nicht über eine zweite Quelle zurück** (28.10.2026).
 *
 * Wer einen Fehlbeleg aus `data/dub-confirmed.yaml` nimmt, trägt ihn in `data/belege-entfernt.yaml` ein. Die abgeholten
 * Browser-Meldungen (`belege-anhaengen.ts`) hängen ihn dann nicht wieder an: Der Bestandsbau am 28.10.2026 brachte den
 * Made-in-Abyss-Beleg zurück, den #2257 entfernt hatte, weil die Meldung vom 28.09. noch in der Abholung lag.
 * Ein Eintrag gilt für Kennung **und** Adresse; dieselbe Adresse an einem anderen Titel (Staffel, OVA) bleibt erlaubt.
 */
import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { sperrKern, type BelegEntfernt } from './sperr-kern.ts'

export { sperrKern, type BelegEntfernt }

/** Eine fehlende Datei ist eine leere Liste (Wegwerf-Repos der Tests); dass die echte Liste da ist, prüft `pipeline/check-belege-entfernt.ts`. */
export function ladeBelegeEntfernt(datei: string): BelegEntfernt[] {
  if (!existsSync(datei)) return []
  const geladen = yaml.load(readFileSync(datei, 'utf8'))
  return Array.isArray(geladen) ? (geladen as BelegEntfernt[]) : []
}

export function istEntfernt(liste: readonly BelegEntfernt[], anilistId: number | undefined, url: string | undefined): boolean {
  const kern = sperrKern(url)
  return !!kern && liste.some((e) => e.anilistId === anilistId && sperrKern(e.url) === kern)
}

/** Ein Beleg-Block (YAML-Zeilen eines `- anilistId: …`-Eintrags) gehört zu einem entfernten Beleg. */
export function blockIstEntfernt(liste: readonly BelegEntfernt[], block: string[]): boolean {
  try {
    const b = (yaml.load(block.join('\n')) as { anilistId?: number; url?: string }[] | null)?.[0]
    return istEntfernt(liste, b?.anilistId, b?.url)
  } catch {
    return false
  }
}

/** Ausnahmeliste-Eintrag zu einem Handbeleg: Kennung plus Seite (ASIN oder ganze Adresse). */
export interface AusnahmeSchluessel {
  liste: string
  anilistId: number
  seite: string
}

/** `<Kennung>@<Seite>` wie in `ALTFAELLE` und `NOTE_ASIN_ALTFAELLE`. */
export function ausSchluessel(liste: string, schluessel: readonly string[]): AusnahmeSchluessel[] {
  return schluessel.map((s) => ({ liste, anilistId: Number(s.slice(0, s.indexOf('@'))), seite: s.slice(s.indexOf('@') + 1) }))
}

/** Einträge, zu denen es in der Beleg-Datei keinen lebenden Beleg mehr gibt (fehlt oder steht in `belege-entfernt.yaml`); die Seite steht in Adresse oder Notiz („Amazon-Seite …“). */
export function toteAusnahmen(
  eintraege: readonly AusnahmeSchluessel[],
  belege: readonly { anilistId?: number; url?: string; note?: string }[],
  entfernt: readonly BelegEntfernt[],
): string[] {
  return eintraege
    .filter((e) => !belege.some((b) => b.anilistId === e.anilistId && !!b.url && `${b.url} ${b.note ?? ''}`.toLowerCase().includes(e.seite.toLowerCase()) && !istEntfernt(entfernt, b.anilistId, b.url)))
    .map((e) => `${e.liste}: ${e.anilistId}@${e.seite}`)
}
