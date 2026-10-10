/**
 * Was eine Meldung über die deutsche Sprachfassung sagt — aus `scrape-anime2you.ts` gelöst, damit der Bau
 * (`lib/meldungen.ts`) und `check-logic` es nutzen können, ohne den Abruf beim Import zu starten.
 */

/** Formulierungen, die eine deutsche Sprachfassung ausdrücklich zusagen. */
const DUB_CONFIRMED =
  /(deutsche[rn]? (synchro|synchronisation|sprachfassung|fassung)|auf deutsch|deutsch(er)? ton|deutsch und japanisch|synchronfassung)/i
/** Formulierungen, die sie ausdrücklich offen lassen — das ist die Warnung. */
const DUB_OPEN =
  /(sprachfassung(en)? (sind|stehen|ist) noch (offen|aus)|sprache unbekannt|noch nicht bekannt.{0,40}sprach)/i
/**
 * Wörter, die einen Satz über die Synchro zur **Frage** machen statt zur Zusage.
 *
 * Der Anlass ist ein Satz, den beide Muster oben falsch lesen (gefunden am
 * 07.09.2026 an „Fool Night", Artikel 1043399):
 *
 * > „Ob auch eine **deutsche Synchronisation** angeboten wird, ist zum
 * > aktuellen Zeitpunkt noch offen."
 *
 * `DUB_CONFIRMED` trifft die Wortfolge und meldet „Synchro zugesagt".
 * `DUB_OPEN` trifft nicht, denn es sucht „Sprachfassungen sind noch offen" —
 * eine andere Formulierung derselben Aussage. Der Vorschlag stand damit als
 * **✅ zugesagt** im Bericht, und genau das darf dieses Projekt nicht: Ein
 * Termin mit falscher Sprachzusage ist schlimmer als kein Termin.
 */
const DUB_ZWEIFEL = /\b(ob\b|noch offen|noch nicht|nicht bekannt|unklar|bislang|steht (noch )?aus|keine angabe|fraglich)/i

/**
 * **Satzweise statt über den ganzen Artikel.**
 *
 * Beide Muster oben liefen über den zusammengesetzten Text aus Titel,
 * Beschreibung und Fundstellen. Damit genügte **irgendwo** im Artikel eine
 * Wortfolge, und ein Satz weiter konnte das Gegenteil stehen.
 *
 * Gewertet wird deshalb je Satz: Trägt **jeder** Satz mit Synchro-Bezug einen
 * Zweifel, lautet der Befund `offen`. Bleibt einer ohne, ist es eine Zusage.
 * Ohne jeden Bezug bleibt es `unklar` — das ist die Mehrheit.
 */
export function dubBefund(text: string): 'ja' | 'offen' | 'unklar' {
  if (DUB_OPEN.test(text)) return 'offen'
  const saetze = text.split(/(?<=[.!?])\s+|\n+/)
  const mitBezug = saetze.filter((s) => DUB_CONFIRMED.test(s))
  if (!mitBezug.length) return 'unklar'
  const ohneZweifel = mitBezug.filter((s) => !DUB_ZWEIFEL.test(s))
  return ohneZweifel.length ? 'ja' : 'offen'
}
