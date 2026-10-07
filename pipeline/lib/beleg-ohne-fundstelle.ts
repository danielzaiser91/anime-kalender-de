/**
 * **Belege, auf deren Seite die Aussage nicht zu finden war** (Daniel, 07.10.2026): Ein Bild ohne Fundstelle ist ein Indiz — vielleicht ein Beweis —, dass der Artikel den Titel
 * gar nicht nennt und der Beleg hinfällig ist. Die Liste wird von Hand geprüft; die Oberfläche zeigt solche Belege als ganze Seite mit Warnzeichen statt als Ausschnitt.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { meldeAnClaude } from './meldung.ts'
import type { BelegGedaechtnis } from './beleg-lesung.ts'
import type { Gruppe } from './beleg-suche.ts'
import { BILD_FASSUNG } from './beleg-bild.ts'

const DATEI = 'daniel-zum-abarbeiten/listen/22-belege-ohne-fundstelle.md'

/** Je Artikel-Adresse die Titel, deren Fundstelle im letzten gültigen Bild fehlt. */
export function ohneFundstelle(gedaechtnis: BelegGedaechtnis, gruppen: Map<string, Gruppe[]>): { url: string; am: string; titel: string[] }[] {
  const raus: { url: string; am: string; titel: string[] }[] = []
  for (const [url, e] of Object.entries(gedaechtnis)) {
    const l = e.lesungen.filter((x) => x.qs === 'ok' && x.bild).at(-1)
    if ((l?.bildfassung ?? 1) < BILD_FASSUNG) continue
    if (!l) continue
    const g = gruppen.get(url) ?? []
    const fehlt = g.length > 1 ? g.filter((x) => !l.markierungen?.[x.id]) : l.markierung ? [] : g.slice(0, 1)
    if (fehlt.length || (!g.length && !l.markierung)) raus.push({ url, am: l.am, titel: fehlt.map((x) => `${x.suchen[0] ?? x.id} (${x.id})`) })
  }
  return raus
}

export function schreibeOhneFundstelle(gedaechtnis: BelegGedaechtnis, gruppen: Map<string, Gruppe[]>): void {
  const liste = ohneFundstelle(gedaechtnis, gruppen)
  const zeilen = liste.map((x) => `- ${x.url} (gelesen ${x.am}) — ${x.titel.join(', ') || 'kein Titel zugeordnet'}`)
  const neu = `# Belege ohne Fundstelle (${liste.length})\n\nDie Aussage war auf der Seite nicht zu finden. Von Hand prüfen: nennt der Artikel den Titel und den Termin? Wenn nein, ist der Beleg hinfällig und der Termin braucht eine andere Quelle.\n\n${zeilen.join('\n') || 'Keine.'}\n`
  const geaendert = !existsSync(DATEI) || readFileSync(DATEI, 'utf8') !== neu
  writeFileSync(DATEI, neu)
  if (liste.length && geaendert) meldeAnClaude('beleg-lesen', 'hinweis', `${liste.length} Belege ohne Fundstelle — von Hand prüfen`, DATEI)
}
