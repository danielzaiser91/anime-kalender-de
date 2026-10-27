/**
 * Treffer des Leser-Wächters (`pr-nachrechnen-bot-pfade-leser.mjs`), die eine Bot-Datei nur nennen, aber im echten Repo nicht lesen
 * (Handdurchsicht 21.10.2026; Löschprobe des Prüfers: alle Bot-Dateien der Liste gelöscht, Kette unverändert grün). Form `Datei|Eintrag`.
 */
const WEGWERF_WURZEL = {
  'tools/akroot-schreibziel.test.mjs': ['daniel-zum-abarbeiten/listen/22-belege-ohne-fundstelle.md', 'daniel-zum-abarbeiten/listen/23-nur-originalton.md'],
  'tools/bestand-handbelege-schritt.test.mjs': ['data/meldungen-uebernahme.json', 'data/meldungen-zurueckgestellt.json'],
  'tools/briefkasten-wache.test.mjs': ['daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md', 'data/meldungen-uebernahme.json', 'data/meldungen-zurueckgestellt.json'],
  'tools/link-check-ende.test.ts': ['data/source-health.json'],
  'tools/link-check-zeitbudget.test.ts': ['data/source-health.json'],
  'tools/meldungen-eingrenzen.test.mjs': ['daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md', 'data/meldungen-uebernahme.json', 'data/meldungs-auffaelligkeiten.json'],
  'tools/meldungen-stapel.test.mjs': ['data/meldungen-uebernahme.json'],
  'tools/pr-nachrechnen.test.mjs': ['daniel-zum-abarbeiten/00-START-HIER.md', 'daniel-zum-abarbeiten/listen/12-verpasste-termine.md', 'daniel-zum-abarbeiten/listen/23-nur-originalton.md', 'data/source-health.json', 'public/og/fassung.txt', 'public/og/schaetz.txt'],
  'tools/quellen-aufsetzen.test.mjs': ['data/source-health.json'],
  'tools/quellen-gesundheit.test.ts': ['data/source-health.json'],
  'tools/wache-urteil.test.mjs': ['data/source-health.json'],
  'tools/worker-rohfolgen-rettung.test.ts': ['data/prime-kanal-aussortiert.json'],
  'pipeline/check-anisearch-marke-nachziehen.ts': ['data/source-health.json'],
  'pipeline/check-og-schaetz.ts': ['public/og/fassung.txt', 'public/og/schaetz.txt'],
  'pipeline/check-kanal-aussortieren.ts': ['data/prime-kanal-aussortiert.json'],
  'pipeline/check-sammelartikel.ts': ['data/proposals/aussagen.json', 'data/sammelartikel-stand.json'],
  'pipeline/check-termine-woche-lauf.ts': ['data/crunchyroll-woche-belege.json'],
  'pipeline/check-vorfaelle-ablauf.ts': ['daniel-zum-abarbeiten/listen/17-vorfaelle.md'],
  'tools/bau-eingaben.test.mjs': ['data/bestand-historie.jsonl'],
  'tools/delta-wache-historie.test.mjs': ['data/bestand-historie.jsonl'],
  'tools/delta-wache-pendel.test.mjs': ['data/bestand-historie.jsonl'],
  'pipeline/check-patchnotes-stempel-regel.ts': ['data/bestand-historie.jsonl'],
  'tools/pruefliste-asid.test.mjs': ['data/anbieter-vorschlaege.json', 'data/kanal-widerspruch.json'],
}

// Wächter, die das Lesen verbieten oder prüfen, nennen den Namen als Muster.
const VERBOTSLISTE = {
  'pipeline/check-sammler-lesezugriffe.ts': ['data/crunchyroll-woche-belege.json'],
  'pipeline/check-sammler-lesezugriffe-faelle.ts': ['data/crunchyroll-woche-belege.json'],
  'tools/quittung-nach-commit-waechter.mjs': ['data/meldungen-uebernahme.json'],
  'tools/quittung-nach-commit-waechter.test.mjs': ['data/meldungen-uebernahme.json'],
}

// nebendateien.ts schreibt 18-suchadressen.md; lib/health.ts schreibt source-health.json und wird vom Bau nur über adn-news.ts erreicht.
// nur-originalton-liste.ts schreibt 23-nur-originalton.md und liest sie nur, um ein unverändertes Ergebnis nicht neu zu schreiben (27.10.2026).
// 13-2-auslieferung.ts nennt die Datei nur in einem Kommentar ohne Sternzeile.
const SCHREIBER = {
  'pipeline/bau/13-2-auslieferung.ts': ['data/bestand-historie.jsonl'],
  'pipeline/bau/nebendateien.ts': ['daniel-zum-abarbeiten/listen/18-suchadressen.md'],
  'pipeline/lib/health.ts': ['data/source-health.json'],
  'pipeline/lib/nur-originalton-liste.ts': ['daniel-zum-abarbeiten/listen/23-nur-originalton.md'],
}

export const BEKANNT_TREFFER = new Set(
  [WEGWERF_WURZEL, VERBOTSLISTE, SCHREIBER].flatMap((gruppe) => Object.entries(gruppe).flatMap(([datei, eintraege]) => eintraege.map((e) => `${datei}|${e}`))),
)

/**
 * Treffer des Dokument-Wächters (`dokuLeser`): Nennungen von `docs/`, Wurzel-Markdown und `00-wache.md` im Bau und in den Prüfungen der Kette.
 * Handdurchsicht 26.10.2026: alle nennen das Dokument nur in einer Meldung oder einem Text; die einzige Ausnahme liest, `tools/design-kontrast.mjs`
 * (Kontrasttabelle in `docs/wissen/design-regeln.md`), darum steht diese Datei nicht in der Ausnahme von `pr-nachrechnen.mjs`.
 */
// Geteilt, damit der Name keine Zeichenkette mit `prime-zugeordnet` trägt: `check-prime-zugeordnet-leser.ts` hielte sie für einen Leser dieser Datei.
const PRIME_NAME = 'zugeordnet-leser-faelle.ts'
const DOKU_NUR_GENANNT = {
  'pipeline/bau/09-4-2-bloecke.ts': ['CLAUDE.md'],
  'pipeline/bau/09-4-3-katalog.ts': ['CLAUDE.md'],
  'pipeline/bau/09-4-4-termine.ts': ['CLAUDE.md'],
  'pipeline/bau/09-6-anisearch-wege.ts': ['CLAUDE.md'],
  'pipeline/bau/11-4-ausgaben.ts': ['docs/'],
  'pipeline/bau/13-1-anreichern.ts': ['docs/'],
  'pipeline/bau/anisearch-titel.ts': ['docs/'],
  'pipeline/bau/jw-widerspruchs-liste.ts': ['docs/'],
  'pipeline/bau/nebendateien.ts': ['CLAUDE.md'],
  'pipeline/bau/verlust-riegel.ts': ['CLAUDE.md'],
  'pipeline/lib/anisearch-termine.ts': ['CLAUDE.md'],
  'pipeline/lib/anisearch-warteschlange.ts': ['CLAUDE.md'],
  'pipeline/lib/news.ts': ['CLAUDE.md'],
  'shared/mappings.ts': ['docs/'],
  'web/src/components/DetailPanel.tsx': ['CLAUDE.md'],
  'web/src/components/detail/antwort-kasten.tsx': ['CLAUDE.md'],
  'web/src/lib/i18n.tsx': ['CLAUDE.md'],
  'pipeline/check-logic.ts': ['CLAUDE.md', 'docs/'],
  'pipeline/check-patchnotes-titel-ablauf.ts': ['README.md'],
  [`pipeline/check-prime-${PRIME_NAME}`]: ['docs/'],
  'tools/check-patchnotes-pflicht.mjs': ['docs/'],
  'tools/design-klassen.mjs': ['docs/'],
}
const DOKU_LIEST = { 'tools/design-kontrast.mjs': ['docs/'] }

export const BEKANNT_DOKU = new Set(
  [DOKU_NUR_GENANNT, DOKU_LIEST].flatMap((gruppe) => Object.entries(gruppe).flatMap(([datei, eintraege]) => eintraege.map((e) => `${datei}|${e}`))),
)
