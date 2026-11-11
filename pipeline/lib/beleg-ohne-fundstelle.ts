/**
 * **Belege, auf deren Seite die Aussage nicht zu finden war** (Daniel, 07.10.2026): Ein Bild ohne Fundstelle ist ein Indiz — vielleicht ein Beweis —, dass der Artikel den Titel
 * gar nicht nennt und der Beleg hinfällig ist. Die Liste wird von Hand geprüft; die Oberfläche zeigt solche Belege als ganze Seite mit Warnzeichen statt als Ausschnitt.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { meldeAnClaude } from './meldung.ts'
import { ROOT, writeText } from './util.ts'
import type { BelegGedaechtnis } from './beleg-lesung.ts'
import type { Gruppe } from './beleg-suche.ts'
import { BILD_FASSUNG } from './beleg-bild.ts'

const DATEI = 'daniel-zum-abarbeiten/listen/22-belege-ohne-fundstelle.md'

const ANISEARCH_KURZ = /^(https?:\/\/www\.anisearch\.de\/article\/\d+)$/

/** Die aniSearch-Kurzadresse (`/article/216599`) ist dieselbe Seite wie die Slug-Form (`/article/216599,slug`); steht die Slug-Form auch im Gedächtnis, zählt nur sie. */
function hatSlugForm(url: string, alle: string[]): boolean {
  const kurz = ANISEARCH_KURZ.exec(url)?.[1]
  return kurz !== undefined && alle.some((a) => a.startsWith(`${kurz},`))
}

/** Je Artikel-Adresse die Titel, deren Fundstelle im letzten gültigen Bild fehlt. */
export function ohneFundstelle(gedaechtnis: BelegGedaechtnis, gruppen: Map<string, Gruppe[]>): { url: string; am: string; titel: string[] }[] {
  const raus: { url: string; am: string; titel: string[] }[] = []
  for (const [url, e] of Object.entries(gedaechtnis)) {
    if (hatSlugForm(url, Object.keys(gedaechtnis))) continue
    const l = e.lesungen.filter((x) => x.qs === 'ok' && x.bild).at(-1)
    if ((l?.bildfassung ?? 1) < BILD_FASSUNG) continue
    if (!l) continue
    const g = gruppen.get(url) ?? []
    /* Ein Titel, dessen Fundstelle nur außerhalb des Bild-Ausschnitts liegt, steht im Artikel — er gehört nicht auf die Liste „nicht zu finden“ (29.10.2026). */
    const fehlt = g.length > 1 ? g.filter((x) => !l.markierungen?.[x.id] && l.ohneMarke?.[x.id] !== 'ausserhalb') : l.markierung ? [] : g.slice(0, 1)
    if (fehlt.length) raus.push({ url, am: l.am, titel: fehlt.map((x) => `${x.suchen[0] ?? x.id} (${x.id})`) })
  }
  return raus
}

const KOPF = 'Je Adresse die Titel, für die die letzte Lesung keine Zeile mit Titel und Termin gefunden hat (Fundstelle nur außerhalb des Bildausschnitts zählt nicht; Adressen ohne zugeordneten Titel und aniSearch-Kurzadressen neben ihrer Slug-Form fehlen). Von Hand prüfen: steht der Name im Seitentext, hat das Lesen die Marke verloren (der Lauf meldet es als Warnung „stehen im Seitentext, haben aber keine Marke“); sonst nennt der Artikel den Titel oder den Termin nicht, oder in verschiedenen Zeilen. Fehlt eines davon, ist der Beleg hinfällig und der Termin braucht eine andere Quelle.'

export function schreibeOhneFundstelle(gedaechtnis: BelegGedaechtnis, gruppen: Map<string, Gruppe[]>): void {
  const liste = ohneFundstelle(gedaechtnis, gruppen)
  const zeilen = liste.map((x) => `- ${x.url} (gelesen ${x.am}) — ${x.titel.join(', ')}`)
  const neu = `# Belege ohne Fundstelle (${liste.length})\n\n${KOPF}\n\n${zeilen.join('\n') || 'Keine.'}\n`
  const geaendert = !existsSync(resolve(ROOT, DATEI)) || readFileSync(resolve(ROOT, DATEI), 'utf8') !== neu
  writeText(DATEI, neu)
  if (liste.length && geaendert) meldeAnClaude('beleg-lesen', 'hinweis', `${liste.length} Belege ohne Fundstelle — von Hand prüfen`, DATEI)
}
