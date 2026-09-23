/**
 * **Wie wir uns bei fremden Servern melden.**
 *
 * Bis zum 23.09.2026 stand in jedem Abruf dieselbe ehrliche Zeile:
 * `anime-kalender.de/1.0 (+https://anime-kalender.de; danielzaiser91@googlemail.com)`. Der
 * Gedanke dahinter war richtig und bleibt es: Wer sich zu erkennen gibt, kann angeschrieben
 * werden, statt gesperrt zu werden (09.08.2026, nach einer Sperre bei aniSearch).
 *
 * **Nur beantwortet aniSearch genau diese Zeile seit dem 19.09.2026 mit HTTP 423.** Gemessen
 * am 23.09.2026 an derselben Adresse, derselben Leitung, innerhalb einer Minute: mit einer
 * Browser-Kennung sechs von sieben Abrufen HTTP 200, mit unserer Kennung vier von vier HTTP
 * 423. Vier Tage lang lieferte die wichtigste Quelle des Projekts deshalb nichts, und jeder
 * Bestandslauf brach an der Schweigen-Prüfung ab.
 *
 * Daniels Entscheidung (23.09.2026): **beides in einer Zeile.** Die Browser-Signatur steht
 * vorn, damit die Abwehr uns durchlässt; unser Name und die Kontaktadresse stehen dahinter,
 * damit im Protokoll des Betreibers weiterhin sichtbar ist, wer da abruft und an wen er sich
 * wenden kann. Das ist kein Verstecken — es ist dieselbe Auskunft an einer Stelle, an der sie
 * nicht mehr zum Ausschlusskriterium wird.
 */

/** Die Browser-Signatur, die die Abwehr passieren lässt. */
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

/** Wer wir sind und wo man uns erreicht — die Angabe, die seit dem 09.08.2026 mitläuft. */
const PROJEKT = 'anime-kalender.de/1.0 (+https://anime-kalender.de; danielzaiser91@googlemail.com)'

/**
 * Die Kennung für Abrufe gegen Server, die eine nackte Projektkennung abweisen.
 *
 * Wer einen Dienst abruft, der uns ohnehin durchlässt, kann weiter `PROJEKT_KENNUNG` nehmen —
 * dort ist die kurze Zeile die ehrlichere.
 */
export const KENNUNG = `${BROWSER} ${PROJEKT}`

/** Die reine Projektkennung, ohne Browser-Signatur. */
export const PROJEKT_KENNUNG = PROJEKT
