#!/usr/bin/env bash
# Meldet den Zustand eines Cloud-Laufs an den Worker, damit die Statusanzeige
# ihn ohne Umweg über die GitHub-API sieht.
#
# Warum der Lauf sich selbst meldet: Er weiß, was er tut. Die GitHub-API zeigt
# nur den Workflow-Namen — bei den Auftrags-Läufen also dreimal dasselbe.
#
# Aufruf:
#   bash tools/lauf-melden.sh laeuft   "Auftrag: netflix-tonspuren"
#   bash tools/lauf-melden.sh ok       "769 Serien geprüft"
#   bash tools/lauf-melden.sh fehler   "Prüfkette rot"
#
# Nötig: LAUF_TOKEN als Secret. Fehlt es, endet das Skript still und ohne
# Fehler — eine fehlende Statusmeldung darf niemals einen Datenlauf rot machen.
set -uo pipefail

ZUSTAND="${1:-laeuft}"
NOTIZ="${2:-}"

[ -z "${LAUF_TOKEN:-}" ] && exit 0
[ -z "${GITHUB_RUN_ID:-}" ] && exit 0

WORKER="${LAUF_WORKER:-https://newsletter.animekalender.workers.dev}"
URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID}"

# Der Auftragsname kommt aus dem Zweig, den ein Auftrags-Lauf anlegt; bei den
# Datenläufen bleibt er leer und die Anzeige zeigt dann den Workflow-Namen.
AUFTRAG="${LAUF_AUFTRAG:-}"

# Über eine Datei statt über die Kommandozeile: Anführungszeichen und Umlaute in
# der Notiz haben sonst schon ganze Meldungen zerlegt.
TMP="$(mktemp)"
cat > "$TMP" <<JSON
{
  "lauf_id": "${GITHUB_RUN_ID}",
  "repo": "${GITHUB_REPOSITORY:-}",
  "workflow": "${GITHUB_WORKFLOW:-}",
  "auftrag": "${AUFTRAG}",
  "zustand": "${ZUSTAND}",
  "url": "${URL}",
  "notiz": "${NOTIZ}"
}
JSON

curl -sS --max-time 15 -X POST "${WORKER}/lauf" \
  -H "Content-Type: application/json" \
  -H "X-Lauf-Token: ${LAUF_TOKEN}" \
  --data-binary @"$TMP" >/dev/null 2>&1 || true

rm -f "$TMP"
exit 0
