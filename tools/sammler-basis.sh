#!/usr/bin/env bash
# Gibt den Kopf-Commit des neuesten Laufs von bestand-bauen.yml aus, dessen Job „bauen“ wirklich gebaut hat (Basis für
# tools/sammler-zuruecknehmen.mjs). Ein Lauf mit übersprungenem Job „bauen“ (vorab: nichts nötig) ist auch „success“,
# hat aber nichts gebaut (gemessen 01.11.2026: Lauf 41317501990 vorab=success, bauen=skipped). Ohne Treffer bleibt die Ausgabe leer.
set -euo pipefail
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY fehlt}"
for zeile in $(timeout 60 gh api "repos/$repo/actions/workflows/bestand-bauen.yml/runs?status=success&branch=main&per_page=20" --jq '.workflow_runs[]|"\(.id):\(.head_sha)"'); do
  gebaut="$(timeout 60 gh api "repos/$repo/actions/runs/${zeile%%:*}/jobs" --jq '[.jobs[]|select(.name=="bauen" and .conclusion=="success")]|length')"
  if [ "$gebaut" = 1 ]; then
    echo "${zeile#*:}"
    exit 0
  fi
done
