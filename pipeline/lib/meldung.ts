/**
 * **Der Posteingang: was ein Lauf mir sagen will, wenn niemand zusieht.**
 *
 * Daniel am 20.09.2026: „eine zentrale stelle an die eine datei mit meldungen steht, die du
 * liest wenn ein flag true gesetzt wird." Anlass war ein Riegel, der 264 Serien verwarf, ohne
 * dass irgendwo eine Zahl davon erzählte — gemerkt hat es ein Nutzer, nicht der Lauf.
 *
 * Geschrieben wird als JSONL, eine Zeile je Meldung, angehängt statt überschrieben: Ein Lauf
 * weiß nicht, was der vorige zu sagen hatte. Gelesen wird die Datei von
 * `~/.claude/hooks/posteingang.js`, der beim nächsten Prompt nur die **neuen** Zeilen nennt.
 *
 * Die Datei wird mitcommittet (`tools/quellen-liste.sh`) — sonst bliebe eine Meldung aus der
 * Cloud auf dem Läufer liegen.
 *
 * **Sparsam sein.** Was jeden Lauf gleich lautet, gehört ins Protokoll, nicht hierher. Hier
 * steht, was sich geändert hat und wovon ich sonst nichts erfahre.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const ZIEL = 'data/meldungen-an-claude.jsonl'

export function meldeAnClaude(
  quelle: string,
  schwere: 'hinweis' | 'warnung',
  text: string,
  datei?: string,
): void {
  try {
    const pfad = resolve(process.cwd(), ZIEL)
    mkdirSync(dirname(pfad), { recursive: true })
    appendFileSync(
      pfad,
      JSON.stringify({ am: new Date().toISOString(), quelle, schwere, text, ...(datei ? { datei2: datei } : {}) }) + '\n',
      'utf8',
    )
  } catch {
    /* Eine Meldung, die nicht geschrieben werden kann, darf keinen Lauf abbrechen. */
  }
}
