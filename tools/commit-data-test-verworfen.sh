# Verworfener Bau-Lauf (18.10.2026, `bau_lauf_zuruecknehmen` in `tools/commit-data.sh`) für `tools/commit-data-test.sh`, das diese
# Datei einbindet und `szenario`, `pruefe`, `im_fernstand`, `quelle_gepusht`, `stempel` mitbringt. Lauf 39161629649 nahm nur Belege und
# Stempel zurück und committete die daraus erzeugten Listen; hier muss jeder Quellen-Pfad außer den Abrufen von data:fetch zurück.

# Startstand: je ein Erzeugnis der Listen-Schritte, ein Beleg und beide Abruf-Dateien von data:fetch.
verworfen_start() {
  mkdir -p "$1/extension" "$1/public/data"
  echo alt > "$1/extension/offene-amazon.js"
  echo '{"alt":1}' > "$1/public/data/pruefstand.json"
  echo '- alt' > "$1/data/dub-confirmed.yaml"
  echo '{"alt":1}' > "$1/data/anbieter-staffeln.json"
  echo '{"alt":1}' > "$1/data/tmdb-titles.json"
  echo '{"alt":1}' > "$1/data/tmdb.json"
}
# Der Lauf ändert alles davon und legt neue Dateien an (auch in einem Ordner aus QUELLEN).
verworfen_lauf() {
  echo neu > "$1/extension/offene-amazon.js"
  echo '{"neu":1}' > "$1/public/data/pruefstand.json"
  echo '- neu' > "$1/data/dub-confirmed.yaml"
  echo '{"neu":1}' > "$1/data/anbieter-staffeln.json"
  echo '{"neu":1}' > "$1/data/tmdb-titles.json"
  echo '{"neu":1}' > "$1/data/tmdb.json"
  echo '{"neu":1}' > "$1/data/curated-ids.json"
  echo '{"lauf":1}' > "$1/data/bestand-historie.jsonl"
  mkdir -p "$1/data/anisearch-raw"
  echo '{"neu":1}' > "$1/data/anisearch-raw/neu.json"
}
# Inhalt einer Datei im Fernstand, „fehlt“ ohne sie.
fern() { git -C "$ORIGIN" show "main:$1" 2> /dev/null | tr -d '\n' || true; }
fern_oder_fehlt() { git -C "$ORIGIN" cat-file -e "main:$1" 2> /dev/null && fern "$1" || echo fehlt; }
# Stand aller Testdateien im Fernstand, eine Zeile.
verworfen_stand() {
  local p
  for p in extension/offene-amazon.js public/data/pruefstand.json data/anbieter-staffeln.json data/tmdb-titles.json data/tmdb.json data/curated-ids.json data/bestand-historie.jsonl data/anisearch-raw/neu.json; do
    printf '%s=%s ' "${p##*/}" "$(fern_oder_fehlt "$p")"
  done
}
ZURUECK='offene-amazon.js=alt pruefstand.json={"alt":1} anbieter-staffeln.json={"alt":1} tmdb-titles.json={"alt":1} tmdb.json={"neu":1} curated-ids.json={"neu":1} bestand-historie.jsonl=fehlt neu.json=fehlt '
UEBERNOMMEN='offene-amazon.js=neu pruefstand.json={"neu":1} anbieter-staffeln.json={"neu":1} tmdb-titles.json={"neu":1} tmdb.json={"neu":1} curated-ids.json={"neu":1} bestand-historie.jsonl={"lauf":1} neu.json={"neu":1} '

for bewegung in bewegt unbewegt; do
  echo "Bau-Lauf verworfen (Fernstand $bewegung): alles aus dem Lauf geht zurück, nur die Abrufe von data:fetch bleiben"
  mkdir -p "$ARBEIT/verworfen-$bewegung"
  UNBEWEGT="$([ "$bewegung" = unbewegt ] && echo ja || echo nein)" START_EXTRA=verworfen_start LAUF_EXTRA=verworfen_lauf \
    szenario "verworfen-$bewegung" FAKE_BESTAND=fail BAU_LAUF=1 GITHUB_ENV="$ARBEIT/verworfen-$bewegung/env.txt"
  pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
  pruefe "Stand im Fernstand" "$ZURUECK" "$(verworfen_stand)"
  pruefe "anisearch.json nicht vom Lauf" nein "$(quelle_gepusht)"
  pruefe "Übernahme-Stempel zurückgenommen" '{"zuletzt":"alt"}' "$(stempel)"
  pruefe "Belege zurückgenommen" "- alt" "$(fern data/dub-confirmed.yaml)"
  # Danach laufen noch Schritte im selben Arbeitsbaum (`data:check`): Er muss auf HEAD stehen, ohne Löcher und ohne Reste.
  pruefe "Arbeitsbaum des Laufs sauber" "" "$(git -C "$ARBEIT/verworfen-$bewegung/lauf" status --porcelain -uall -- extension public/data/pruefstand.json data)"
  pruefe "Fehlerzeile nennt den Bau-Lauf" ja "$(grep -q '^::error::.*Aus dem Bau-Lauf wird nichts committet außer den Abrufen von data:fetch' "$ARBEIT/verworfen-$bewegung/log.txt" && echo ja || echo nein)"
done

echo "Gegenprobe: derselbe Bau-Lauf mit grünem Bestand übernimmt alles"
mkdir -p "$ARBEIT/uebernommen"
START_EXTRA=verworfen_start LAUF_EXTRA=verworfen_lauf szenario uebernommen BAU_LAUF=1 GITHUB_ENV="$ARBEIT/uebernommen/env.txt"
pruefe "Exit 0" 0 "$CODE"
pruefe "Stand im Fernstand" "$UEBERNOMMEN" "$(verworfen_stand)"

echo "Gegenprobe: ein Sammler-Lauf (ohne BAU_LAUF) sichert bei verletzter Zusicherung weiter alle Quellen"
START_EXTRA=verworfen_start LAUF_EXTRA=verworfen_lauf szenario verworfen-sammler FAKE_BESTAND=fail
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Stand im Fernstand" "$UEBERNOMMEN" "$(verworfen_stand)"
pruefe "Fehlerzeile wie bisher" ja "$(grep -q '^::error::.*Die Erzeugnisse werden nicht committet; die Quellen schon\.' "$ARBEIT/verworfen-sammler/log.txt" && echo ja || echo nein)"

echo "Drei ⚠-Zeilen vor einer ✗-Zeile: DATEN_WARNUNG nennt den ✗-Fehler zuerst"
mkdir -p "$ARBEIT/warnzeichen"
szenario warnzeichen FAKE_BESTAND=warnzeichen BAU_LAUF=1 GITHUB_ENV="$ARBEIT/warnzeichen/env.txt"
pruefe "Warnung beginnt mit dem Fehler" ja "$(grep -q '^DATEN_WARNUNG=.*Bestand nicht übernommen: *✗ Netflix-Liste enthält Cartoon-Adressen — 89 ⚠ Hinweis eins ⚠ Hinweis zwei *· ' "$ARBEIT/warnzeichen/env.txt" && echo ja || echo nein)"

echo "Zeilen mit mehreren Marken stehen genau einmal im Grund"
for fall in doppelt-a doppelt-b; do
  mkdir -p "$ARBEIT/$fall"
  szenario "$fall" FAKE_BESTAND="$fall" BAU_LAUF=1 GITHUB_ENV="$ARBEIT/$fall/env.txt"
done
pruefe "FEHLER:, ✖, ⚠" ja "$(grep -q '^DATEN_WARNUNG=Bestand nicht übernommen: FEHLER: a ✗ ⚠ ✖ b ⚠ ⚠ c *· ' "$ARBEIT/doppelt-a/env.txt" && echo ja || echo nein)"
pruefe "✗ mit ⚠, dann ⚠" ja "$(grep -q '^DATEN_WARNUNG=Bestand nicht übernommen: ✗ b ⚠ ⚠ c *· ' "$ARBEIT/doppelt-b/env.txt" && echo ja || echo nein)"
