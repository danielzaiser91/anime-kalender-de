/**
 * Dateien, die nur ein Bot-Lauf (github-actions[bot], anime-kalender-daten[bot]) auf main schreibt und die kein Schritt der PR-Prüfkette
 * liest (21.10.2026, Messung: die letzten 200 Bot-Commits auf main). Gelesen heißt: `pipeline/build.ts` (data:build) und was es importiert,
 * `data:validate`, die Prüfungen von `check:vor-commit`, `check:logic` und `tests-alle` lesen die Datei im echten Repo (Tests mit Wegwerf-Wurzel
 * zählen nicht). Eine Bewegung dieser Pfade auf main entwertet die Kettenläufe offener PRs nicht (F55). Gelesene Bot-Dateien
 * (Tabelle in der PR-Beschreibung) bleiben draußen, ebenso `extension/` und `tools/umfang-grenzen.json`; Bilder unter `public/og/` (außer `default.*`) regelt `istBotBild`.
 * Ein Eintrag ohne Schrägstrich am Ende ist eine Datei, ein Ordner steht ohne Endstrich (`istBotDatei` hängt ihn an).
 * Wächter gegen späteres Lesen im Bau: `pr-nachrechnen-bot-pfade.test.mjs`.
 */
export const BOT_DATEIEN_OHNE_LESER = [
  'daniel-zum-abarbeiten/00-START-HIER.md',
  'daniel-zum-abarbeiten/00-wache-auswertung.md',
  'daniel-zum-abarbeiten/listen/06-netflix-rest.md',
  'daniel-zum-abarbeiten/listen/07-adn.md',
  'daniel-zum-abarbeiten/listen/07-alle-anbieter.md',
  'daniel-zum-abarbeiten/listen/07-crunchyroll.md',
  'daniel-zum-abarbeiten/listen/07-disneyplus.md',
  'daniel-zum-abarbeiten/listen/07-joyn.md',
  'daniel-zum-abarbeiten/listen/07-netflix.md',
  'daniel-zum-abarbeiten/listen/07-primevideo.md',
  'daniel-zum-abarbeiten/listen/07-youtube.md',
  'daniel-zum-abarbeiten/listen/08-arbeitspakete.md',
  'daniel-zum-abarbeiten/listen/09-youtube-liste.md',
  'daniel-zum-abarbeiten/listen/10-rtlplus.md',
  'daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md',
  'daniel-zum-abarbeiten/listen/12-verpasste-termine.md',
  'daniel-zum-abarbeiten/listen/15-news-vorschau.md',
  'daniel-zum-abarbeiten/listen/16-justwatch-tonspuren.md',
  'daniel-zum-abarbeiten/listen/17-vorfaelle.md',
  'daniel-zum-abarbeiten/listen/18-suchadressen.md',
  'daniel-zum-abarbeiten/listen/22-belege-ohne-fundstelle.md',
  'daniel-zum-abarbeiten/listen/23-nur-originalton.md',
  'daniel-zum-abarbeiten/listen/cover-ohne-tmdb.md',
  'daniel-zum-abarbeiten/listen/tmdb-staffel0-unsicher.md',
  'data/abruf-stempel.json',
  'data/anbieter-vorschlaege.json',
  'data/anisearch-folgen-raw',
  'data/anisearch-sprecher-raw',
  'data/ann-holstand.json',
  'data/ann-raw',
  'data/beleg-fehlschlaege.json',
  'data/bestand-historie.jsonl',
  'data/folgen-zuordnung.json',
  'data/imdb-ids.json',
  'data/kanal-widerspruch.json',
  'data/meldungen-uebernahme.json',
  'data/meldungen-zurueckgestellt.json',
  'data/meldungs-auffaelligkeiten.json',
  'data/motn-raw',
  'data/pillen-luecken.json',
  'data/prime-kanal-aussortiert.json',
  'data/proposals/anime2you-extraktion.json',
  'data/proposals/aussagen.json',
  'data/proposals/offizielle-news.json',
  'data/qualitaet-verlauf.json',
  'data/rtlplus-katalog.json',
  'data/sammelartikel-stand.json',
  'data/source-health.json',
  'data/tmdb-kino.json',
  'data/tmdb-poster-grund.json',
  'data/wiedervorlage.json',
  'data/wikidata-titel.json',
  'public/og/fassung.txt',
  'public/og/schaetz.txt',
  'tools/kalender-plausibilitaet-grenzen.json',
]

/**
 * Vorschaubilder unter `public/og/` (vom Bestandsbau erzeugt, 27.10.2026: kein Schritt der Kette liest sie). Ausgenommen `default.*`:
 * `tools/og-standard.test.ts` liest `default.txt`, und `default.jpg` hängt an dessen Kennung.
 */
export const istBotBild = (datei) => /^public\/og\/(?!default\.)[^/]+\.(jpg|png|webp)$/.test(datei)

/** Datei oder Ordnerinhalt aus der Liste oben. */
export const istBotDatei = (datei) => BOT_DATEIEN_OHNE_LESER.some((p) => datei === p || datei.startsWith(`${p}/`))
