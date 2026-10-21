/**
 * Treffer des Leser-Wächters (`pr-nachrechnen-bot-pfade-leser.mjs`), die eine Bot-Datei nur nennen, aber im echten Repo nicht lesen
 * (Handdurchsicht 21.10.2026; Löschprobe des Prüfers: alle Bot-Dateien der Liste gelöscht, Kette unverändert grün). Form `Datei|Eintrag`.
 */
const WEGWERF_WURZEL = {
  'tools/akroot-schreibziel.test.mjs': ['daniel-zum-abarbeiten/listen/22-belege-ohne-fundstelle.md'],
  'tools/bestand-handbelege-schritt.test.mjs': ['data/meldungen-uebernahme.json', 'data/meldungen-zurueckgestellt.json'],
  'tools/briefkasten-wache.test.mjs': ['daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md', 'data/meldungen-uebernahme.json', 'data/meldungen-zurueckgestellt.json'],
  'tools/link-check-ende.test.ts': ['data/source-health.json'],
  'tools/link-check-zeitbudget.test.ts': ['data/source-health.json'],
  'tools/meldungen-eingrenzen.test.mjs': ['daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md', 'data/meldungen-uebernahme.json', 'data/meldungs-auffaelligkeiten.json'],
  'tools/meldungen-stapel.test.mjs': ['data/meldungen-uebernahme.json'],
  'tools/pr-nachrechnen.test.mjs': ['daniel-zum-abarbeiten/00-START-HIER.md', 'daniel-zum-abarbeiten/listen/12-verpasste-termine.md', 'data/source-health.json'],
  'tools/quellen-aufsetzen.test.mjs': ['data/source-health.json'],
  'tools/quellen-gesundheit.test.ts': ['data/source-health.json'],
  'tools/wache-urteil.test.mjs': ['data/source-health.json'],
  'tools/worker-rohfolgen-rettung.test.ts': ['data/prime-kanal-aussortiert.json'],
  'pipeline/check-anisearch-marke-nachziehen.ts': ['data/source-health.json'],
  'pipeline/check-kanal-aussortieren.ts': ['data/prime-kanal-aussortiert.json'],
  'pipeline/check-sammelartikel.ts': ['data/proposals/aussagen.json', 'data/sammelartikel-stand.json'],
  'pipeline/check-termine-woche-lauf.ts': ['data/crunchyroll-woche-belege.json'],
  'pipeline/check-vorfaelle-ablauf.ts': ['daniel-zum-abarbeiten/listen/17-vorfaelle.md'],
  'tools/bau-eingaben.test.mjs': ['data/bestand-historie.jsonl'],
  'tools/delta-wache-historie.test.mjs': ['data/bestand-historie.jsonl'],
  'tools/delta-wache-pendel.test.mjs': ['data/bestand-historie.jsonl'],
}

// Wächter, die das Lesen verbieten oder prüfen, nennen den Namen als Muster.
const VERBOTSLISTE = {
  'pipeline/check-sammler-lesezugriffe.ts': ['data/crunchyroll-woche-belege.json'],
  'pipeline/check-sammler-lesezugriffe-faelle.ts': ['data/crunchyroll-woche-belege.json'],
}

// nebendateien.ts schreibt 18-suchadressen.md; lib/health.ts schreibt source-health.json und wird vom Bau nur über adn-news.ts erreicht.
// 13-2-auslieferung.ts nennt die Datei nur in einem Kommentar ohne Sternzeile.
const SCHREIBER = {
  'pipeline/bau/13-2-auslieferung.ts': ['data/bestand-historie.jsonl'],
  'pipeline/bau/nebendateien.ts': ['daniel-zum-abarbeiten/listen/18-suchadressen.md'],
  'pipeline/lib/health.ts': ['data/source-health.json'],
}

export const BEKANNT_TREFFER = new Set(
  [WEGWERF_WURZEL, VERBOTSLISTE, SCHREIBER].flatMap((gruppe) => Object.entries(gruppe).flatMap(([datei, eintraege]) => eintraege.map((e) => `${datei}|${e}`))),
)
