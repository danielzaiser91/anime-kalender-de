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

export type Sprachbefund = 'ja' | 'offen' | 'unklar' | 'nein'

/** Originalton mit Untertiteln — ein Satz damit und ohne deutsche Fassung ist keine Synchro-Aussage. */
const NUR_UNTERTITEL =
  /(originalton mit (deutschen )?untertiteln|\bomu\b|mit deutschen untertiteln|im (japanischen )?originalton|japanisch(?:e[nr]?)? (?:ton|tonspur)\b|japanisch \(ut\)|(?:nur|ausschließlich) (?:mit )?untertitel)/i

/**
 * Irgendein Bezug auf eine deutsche Tonfassung, auch in Formen, die `DUB_CONFIRMED` nicht als Zusage liest („deutsche
 * Tonspur", „deutsch vertont", „Synchro"). Steht so etwas im Text, wird „Originalton mit Untertiteln" nicht zum `nein`:
 * Ein falsches Nein verwirft einen echten Termin, ein falsches `unklar` behält ihn mit Notiz. Die Formen nicht als Zusage
 * aufzunehmen ist Absicht — „die deutsche Tonspur fehlt noch" wäre sonst ein `ja` (Prüfer-Befund PR 649, 10.10.2026).
 */
const DEUTSCH_BEZUG =
  /deutsch\w*\s+(?:ton|sprach|dub\b|fassung|synchro|vertont|synchronisiert)|synchro|\b(?:simul)?dub\b|vertont\b|synchronisiert/i

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
 *
 * **`nein`: Die Meldung nennt nur Originalton mit Untertiteln** und erwähnt keine deutsche Tonfassung (`DEUTSCH_BEZUG`).
 * Ihr Termin ist dann kein deutscher („Dragon Ball Super: Beerus", Anime2You 01.10.2026: „bei
 * Crunchyroll und ADN im Originalton mit Untertiteln" stand als Synchro-Start im Kalender).
 */
export function dubBefund(text: string): Sprachbefund {
  const saetze = text.split(/(?<=[.!?])\s+|\n+/)
  const nurUntertitel = !DEUTSCH_BEZUG.test(text) && saetze.some((s) => NUR_UNTERTITEL.test(s))
  if (DUB_OPEN.test(text)) return nurUntertitel ? 'nein' : 'offen'
  const mitBezug = saetze.filter((s) => DUB_CONFIRMED.test(s))
  if (mitBezug.some((s) => !DUB_ZWEIFEL.test(s))) return 'ja'
  if (nurUntertitel) return 'nein'
  return mitBezug.length ? 'offen' : 'unklar'
}

/**
 * Der Sprachbefund eines **gespeicherten** Vorschlags. Der Abruf wertete den ganzen Feed-Text;
 * ältere Vorschläge kennen `nein` noch nicht, ihre Fundstellen tragen den Satz aber oft
 * (Beerus: „… ADN im Originalton mit Untertiteln. Bei Netflix …"). Eine Zusage schlägt alles.
 */
export function spracheDerMeldung(v: { dub?: string; articleTitle: string; dates?: { context: string }[] }): Sprachbefund {
  if (v.dub === 'ja' || v.dub === 'zugesagt') return 'ja'
  const ausFundstellen = dubBefund([v.articleTitle, ...(v.dates ?? []).map((d) => d.context)].join('\n'))
  if (v.dub === 'nein' || ausFundstellen === 'nein') return 'nein'
  return v.dub === 'offen' ? 'offen' : ausFundstellen
}

/** Fernsehsender, Verlage und Dienste, die im Gesamt-Feed einen Deutschland-Bezug anzeigen, auch wo keine Plattform der Liste genannt wird. */
const DEUTSCHLAND_BEZUG = /prosieben|rtl zwei|toggo|\bsky\b|free-tv|pay-tv|fernseh|tv-guide|paramount\+|deutschland|deutsche[rn]? (?:kinos?|synchro|sprach|fassung)|auf deutsch|polyband|peppermint|animoon|kazé|akiba/i

/** Betrifft eine Meldung des Gesamt-Feeds die deutsche Fassung? Japanische Ankündigungen, Figuren und Trailer nicht. */
export function deutschlandBezug(text: string, dub: Sprachbefund): boolean {
  return dub !== 'unklar' || DEUTSCHLAND_BEZUG.test(text)
}
