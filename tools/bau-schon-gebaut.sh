#!/usr/bin/env bash
# Gibt "ja" aus, wenn auf main schon ein Bau-Commit steht, der von $1 abstammt und `public/data` berührt.
#
# Der Bau checkt `main` aus (nicht den auslösenden Commit) und baut bei bewegtem
# Fernstand neu (commit-data.sh). Zwei Merges im Abstand von Sekunden lösen darum
# zwei Läufe aus, von denen der erste beide Stände schon verbaut (11.10.2026,
# 10:05:32 und 10:05:37 UTC: zwei Bau-Commits, der zweite machte nur Rauschen).
#
# Nur ein Bau-Commit mit `public/data` beweist einen gelungenen Bau (12.10.2026): Bei verletzter Zusicherung
# committet commit-data.sh die Quellen und Verlaufsdateien, aber keine Erzeugnisse — dieser Commit hieß
# ebenfalls "Bestand neu gebaut", der Folgelauf übersprang darauf den Bau, und die Meldung aus PR 959 fehlte live.
# Ein erfolgreicher Bau ohne geänderte Erzeugnisse zählt darum nicht; der Preis ist ein Zweitbau, kein Datenverlust.
# Jeder Fehler gilt als "nein": im Zweifel wird gebaut.
#
# Aufruf: GH_TOKEN=… GITHUB_REPOSITORY=… bash tools/bau-schon-gebaut.sh <sha>
set -u
sha="${1:?sha fehlt}"
repo="${GITHUB_REPOSITORY:?}"

# `path=` filtert serverseitig auf Commits, die `public/data` berühren (die Dateiliste eines Commits wäre bei großen Bauten ab 300 Dateien geteilt).
baucommits="$(gh api "repos/$repo/commits?sha=main&path=public/data&per_page=10" \
  --jq '.[] | select(.commit.message | startswith("chore(data): Bestand neu gebaut")) | .sha' 2>/dev/null)" || baucommits=""

for bau in $baucommits; do
  status="$(gh api "repos/$repo/compare/$sha...$bau" --jq .status 2>/dev/null)" || continue
  if [ "$status" = "ahead" ]; then
    echo ja
    exit 0
  fi
done
echo nein
