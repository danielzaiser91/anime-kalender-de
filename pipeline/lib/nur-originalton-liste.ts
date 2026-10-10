/**
 * **Meldungen, aus denen kein deutscher Termin wird, weil sie nur Originalton nennen** (10.10.2026, Prüfer-Befund PR 649).
 * Ein falsches Nein verwirft einen echten Termin still — deshalb steht jede verworfene Meldung mit Fundstelle in einer
 * Liste, und eine geänderte Liste geht als Hinweis in den Posteingang (`meldung.ts`).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { meldeAnClaude } from './meldung.ts'
import { terminDerMeldung, type Vorschlag } from './meldungen.ts'

const DATEI = 'daniel-zum-abarbeiten/listen/23-nur-originalton.md'

export function schreibeNurOriginalton(meldungen: Vorschlag[]): void {
  const zeilen = meldungen.map(
    (v) => `- [${v.articleTitle}](${v.articleUrl}) — Termin ${terminDerMeldung(v) ?? '?'}: „${(v.dates ?? []).map((d) => d.context).find((c) => /untertitel|originalton|omu|\(ut\)/i.test(c)) ?? '–'}"`,
  )
  const neu = `# Meldungen mit nur Originalton (${meldungen.length})\n\nAus diesen Anime2You-Meldungen entsteht kein deutscher Termin: Sie nennen Originalton mit Untertiteln und keine deutsche Tonfassung (\`dubBefund\`, \`pipeline/lib/sprachbefund.ts\`). Von Hand prüfen, ob der Artikel doch eine Synchro nennt — dann ist das Muster zu weit.\n\n${zeilen.join('\n') || 'Keine.'}\n`
  const geaendert = !existsSync(DATEI) || readFileSync(DATEI, 'utf8') !== neu
  writeFileSync(DATEI, neu)
  if (meldungen.length && geaendert)
    meldeAnClaude('bestand-bauen', 'hinweis', `${meldungen.length} Meldungen ohne deutschen Termin (nur Originalton): ${meldungen.map((v) => v.articleTitle).join(' | ')}`, DATEI)
}
