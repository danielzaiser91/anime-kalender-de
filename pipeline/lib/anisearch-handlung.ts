/**
 * **Die deutsche Inhaltsangabe aus dem HTML einer aniSearch-Seite** (Abruf in `fetch-anisearch.ts`).
 */

export function decode(raw: string): string {
  return raw
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}

/**
 * Zieht die deutsche Inhaltsangabe aus der Seite.
 *
 * aniSearch legt je Sprache einen eigenen Block an; ohne die Sprachprüfung
 * bekäme man den englischen Text und hätte nichts gewonnen.
 */
export function extractDescription(html: string): string | undefined {
  const section = /<section id="description">([\s\S]*?)<\/section>/.exec(html)?.[1]
  if (!section) return undefined
  const german = /<div lang="de"[^>]*>([\s\S]*?)<\/div>/.exec(section)?.[1]
  if (!german) return undefined
  const text = decode(
    german
      .replace(/<br\s*\/?>/gi, '\n')
      // Der Quellenhinweis am Ende ist Fußnote, nicht Inhalt.
      .replace(/<span class="source">[\s\S]*$/i, '')
      .replace(/Source:[\s\S]*$/i, '')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > 40 && !istPlatzhalter(text) ? text : undefined
}

/**
 * **Der Aufruf zum Mitschreiben ist keine Handlung.**
 *
 * Wo aniSearch keine deutsche Inhaltsangabe hat, steht trotzdem etwas im
 * `<div lang="de">` — eine Bitte an die Leser: „Eine kurze Inhaltsangabe zum
 * Anime ‚X' würde vielen Anime- und Manga-Fans weiterhelfen. Du kennst diesen
 * Anime bereits? Dann unterstütze aniSearch und füge eine kurze Beschreibung
 * hinzu."
 *
 * Der Text ist über 40 Zeichen lang, deutsch und wohlgeformt — er kam durch
 * jede Prüfung, die es hier gab. Am 04.09.2026 gemessen: **121 Titel** zeigten
 * live einen Mitmach-Aufruf an der Stelle, an der ihre Handlung stehen sollte,
 * und verdeckten dabei die englische Fassung, die es sehr wohl gab.
 *
 * **Die Lehre ist größer als der Fall:** Eine Quelle, die ein Feld immer
 * füllt, füllt es auch, wenn sie nichts hat. Ein Längentest prüft, dass etwas
 * dasteht — nicht, dass es die Frage beantwortet.
 */
function istPlatzhalter(text: string): boolean {
  return /unterstütze aniSearch|füge eine kurze Beschreibung|würde vielen Anime- und Manga-Fans/i.test(
    text,
  )
}
