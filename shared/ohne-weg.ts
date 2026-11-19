/**
 * **Titel ohne Streaming-Weg: der Grund steht in `ohne-weg.json`** (18.11.2026). Eine Datei neben dem Hauptbestand, nicht ein Feld
 * in `titles.json`: Sie betrifft 1.291 von 3.842 Titeln und wird nur im Detail-Panel gelesen.
 * Gründe gibt es nur mit Beleg; was kein Beleg trägt, heißt `offen`.
 */
export const OHNE_WEG_GRUENDE = ['angekuendigt', 'kein-dub', 'nur-kauf', 'film-ohne-abo', 'abo-ohne-ton', 'nur-disc', 'kein-angebot', 'offen'] as const
export type OhneWegGrund = (typeof OHNE_WEG_GRUENDE)[number]

/**
 * Wer den Grund belegt: ein Termin (`events.json`), ein Handbeleg (`dub-confirmed.yaml`), JustWatch (`justwatch-audio.json`) oder eine erschienene Disc
 * (`disc-ausgaben.json`; `checkedAt` ist dort der Tag des JustWatch-Eintrags, der keinen Stream fand).
 */
export type OhneWegQuelle = 'termin' | 'handbeleg' | 'justwatch' | 'disc'

/**
 * Ein Eintrag von `ohne-weg.json` (Schlüssel = Titelkennung). `checkedAt` ist der Tag der Prüfung aus der Quelle, `ab` der künftige Starttag;
 * `offen` trägt weder das eine noch das andere.
 */
export interface OhneWegEintrag {
  reason: OhneWegGrund
  checkedAt?: string
  ab?: string
  source?: OhneWegQuelle
}

/**
 * Ohne Streaming-Weg heißt: kein `streams`-Eintrag und kein `watchLinks`-Eintrag mit `kind: 'stream'` —
 * dieselbe Aussage wie `hatStreamingWeg` in `tools/streaming-weg-zaehlen.mjs` (ein Test hält beide gleich; `tools/` ist im Web nicht importierbar).
 */
export function ohneStreamingWeg(t: { streams?: unknown[]; watchLinks?: { kind?: string }[] }): boolean {
  return !t.streams?.length && !(t.watchLinks ?? []).some((w) => w.kind === 'stream')
}
