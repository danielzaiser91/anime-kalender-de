#!/usr/bin/env bash
# Schließt offene "Bestandsbau rot"-Issues, die vor Beginn dieses grünen Baus entstanden sind.
#
# Reparatur-Läufe und Agenten öffnen sie bei einem roten Bau (claude-reparatur.yml, Schritt 0).
# Nichts schloss sie: am 11.10.2026 standen acht offen, alle längst behoben. Ein grüner Bau
# nach dem Issue heißt: die Ursache ist weg, der Bau läuft auf dem Stand mit der Reparatur.
#
# Aufruf: GH_TOKEN=… GITHUB_REPOSITORY=… bash tools/bau-issues-schliessen.sh <lauf-id> <beginn-iso>
set -u
lauf="${1:?lauf fehlt}"
beginn="${2:?beginn fehlt}"
repo="${GITHUB_REPOSITORY:?}"

# Titelformen aus der Praxis: "Bestandsbau rot: …", "Bestand-Bau rot: …",
# "Bestandsbau <Lauf>: …", "Bestand-Lauf <Lauf>: …".
muster='^Bestand(s?bau|-Bau|-Lauf)( rot| [0-9])'
filter=".[] | select(.createdAt < \"$beginn\") | select(.title | test(\"$muster\")) | .number"

gh issue list --repo "$repo" --state open --limit 100 --json number,title,createdAt --jq "$filter" |
while read -r nr; do
  gh issue close "$nr" --repo "$repo" --comment \
    "Der Bestandsbau ist wieder grün (Lauf $lauf: https://github.com/$repo/actions/runs/$lauf). Geschlossen vom Bau selbst; bei Wiederholung öffnet der nächste rote Bau ein neues Issue." || true
done
