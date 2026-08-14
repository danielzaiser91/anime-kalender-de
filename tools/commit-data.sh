#!/usr/bin/env bash
#
# Ergebnisse eines Datenlaufs committen — ohne je einen Merge-Konflikt zu
# riskieren.
#
# Das Problem, das dieses Skript löst (aufgetreten am 09. und 10.08.2026):
# Ein Lauf dauert zwanzig Minuten und mehr. Wird in dieser Zeit auf `main`
# gepusht — von einem zweiten Lauf oder von einem Menschen —, scheiterte der
# abschließende `git pull --rebase` an Konflikten in `public/data/*.json`. Der
# Lauf brach ab, und mit ihm gingen die frisch geholten Caches verloren: beim
# zweiten Mal 200 aniSearch-Seiten, also gut zwanzig Minuten Anfragen an eine
# fremde Seite, für nichts.
#
# Der Denkfehler war, Quellen und Erzeugnisse gleich zu behandeln:
#
#   data/*.json      Quellen. Teuer erkauft (fremde APIs, Ratenlimits), oft
#                    nicht wiederholbar. Was dieser Lauf geholt hat, gewinnt.
#   public/data/*    Erzeugnisse. Entstehen in Sekunden aus den Quellen. Sie
#                    zu mergen ist sinnlos — man baut sie einfach neu.
#
# Deshalb wird hier nie gemergt. Stattdessen: Quellen beiseitelegen, hart auf
# den aktuellen Fernstand gehen, Quellen zurücklegen, Erzeugnisse neu bauen,
# committen. Ein Konflikt kann dabei nicht entstehen, weil es nichts zu
# vereinen gibt. Kommt jemand beim Push zuvor, läuft dasselbe noch einmal.
#
# Aufruf: bash tools/commit-data.sh "chore(data): Sendezeiten aktualisiert"

set -euo pipefail

NACHRICHT="${1:?Commit-Nachricht fehlt}"
VERSUCHE="${2:-3}"

# Alles, was ein Lauf schreiben kann. Nicht jeder Lauf berührt alles; fehlende
# Pfade werden übersprungen.
QUELLEN=(
  data/anisearch.json
  data/crunchyroll.json
  data/adn.json
  # Fehlte hier, seit es die Datei gibt — gefunden am 14.08.2026 durch die neue
  # Prüfung in `tools/check-workflows.mjs`. `npm run data:adn:catalog` läuft
  # **wöchentlich** in der CI und holt 583 KB Katalogdaten; committet wurden sie
  # nie, und bei bewegtem Fernstand warf der Reset sie weg. Der Lauf tat also
  # jede Woche dieselbe Arbeit umsonst.
  data/adn-catalog.json
  data/tmdb.json
  data/anime-ids.json
  data/curated-ids.json
  data/source-health.json
  data/proposals
  # Gedächtnis, keine Momentaufnahme — und deshalb hier lebenswichtig.
  #
  # `data/synchro-historie.json` hält fest, seit wann ein Titel eine belegte
  # deutsche Synchro hat. Fehlte die Datei in dieser Liste, passierte zweierlei:
  # Der Lauf committet sie nie, und beim `git reset --hard` weiter unten wird
  # die frisch geschriebene Fassung verworfen. Ein Titel, der im CI eine Synchro
  # bekommt, stünde damit bei **jedem** Lauf erneut als Neuzugang da — und jeder
  # Abonnent bekäme bis zu sechzig Tage lang täglich dieselbe Mail über
  # dieselbe Serie. Gefunden am 14.08.2026, einen Tag nach dem Einbau, bevor
  # der erste Nachtlauf darüberlief.
  data/synchro-historie.json
  # Ergebnis des Crunchyroll-Synchro-Laufs. Steht hier vorsorglich: Läuft er
  # eines Tages in der CI, wären 918 Seitenabrufe sonst nach einem Reset weg.
  data/crunchyroll-dub.json
)
ERZEUGNISSE=(public/data public/og)

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

for versuch in $(seq 1 "$VERSUCHE"); do
  git fetch origin main --quiet

  if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo "Fernstand hat sich bewegt — Quellen retten und neu aufsetzen (Versuch $versuch)."

    # Die Quellen aus dem Arbeitsverzeichnis in Sicherheit bringen. `mktemp -d`
    # liegt außerhalb des Repos, wird vom Reset also nicht angefasst.
    RETTUNG="$(mktemp -d)"
    for pfad in "${QUELLEN[@]}"; do
      [ -e "$pfad" ] || continue
      mkdir -p "$RETTUNG/$(dirname "$pfad")"
      cp -r "$pfad" "$RETTUNG/$pfad"
    done

    git reset --hard origin/main --quiet

    for pfad in "${QUELLEN[@]}"; do
      [ -e "$RETTUNG/$pfad" ] || continue
      mkdir -p "$(dirname "$pfad")"
      cp -r "$RETTUNG/$pfad" "$pfad"
    done
    rm -rf "$RETTUNG"

    # Erzeugnisse passen jetzt weder zum einen noch zum anderen Stand — neu
    # bauen ist die einzige richtige Antwort.
    npm run data:build
  fi

  git add "${ERZEUGNISSE[@]}" "${QUELLEN[@]}" 2>/dev/null || true

  if git diff --staged --quiet; then
    echo "Keine Änderung — nichts zu committen."
    exit 0
  fi

  git commit -m "$NACHRICHT" --quiet

  if git push --quiet 2>/dev/null; then
    echo "Gepusht (Versuch $versuch)."
    exit 0
  fi

  echo "Push abgelehnt, jemand war schneller. Nächster Versuch."
  # Den eigenen Commit zurücknehmen, die Dateien behalten — die nächste Runde
  # setzt ohnehin auf dem neuen Fernstand neu auf.
  git reset --soft HEAD~1
done

echo "::error::Nach $VERSUCHE Versuchen nicht gepusht. Die geholten Daten sind im Lauf-Verzeichnis, nicht im Repo."
exit 1
