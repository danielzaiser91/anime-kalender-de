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
#   bash tools/lauf-melden.sh schritt "Seite gebaut"   (zählt einen Schritt weiter)
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

# Zweck und Ziel stehen fest, solange der Lauf läuft — der Fortschritt bewegt
# sich. Deshalb drei getrennte Angaben statt einer Zeile Freitext:
#
#   Zweck  wofür es diesen Lauf gibt  („Hält die Crunchyroll-Daten aktuell")
#   Ziel   was am Ende erreicht sein soll („594 Serien prüfen")
#   Fortschritt  wie weit er ist („233/594")
#
# Ohne sie stand in der Anzeige nur der Workflow-Name, und der sagt bei drei
# Auftrags-Läufen dreimal dasselbe (Daniel, 21.08.2026).
ZWECK="${LAUF_ZWECK:-}"
ZIEL="${LAUF_ZIEL:-}"

# Anführungszeichen, Backslashes und Zeilenumbrüche zerlegen das JSON unten.
# In einem Zweck-, Ziel- oder Notiztext tragen sie nichts bei, also fallen sie weg.
saeubern() { printf '%s' "$1" | tr -d '\\"' | tr -s '[:space:]' ' '; }
AUFTRAG="$(saeubern "$AUFTRAG")"
ZWECK="$(saeubern "$ZWECK")"
ZIEL="$(saeubern "$ZIEL")"
NOTIZ="$(saeubern "$NOTIZ")"

# Ein Lauf aus lauter Einzelschritten kann seinen Fortschritt zählen.
#
#   bash lauf-melden.sh schritt "Seite gebaut"
#
# Jeder Aufruf zählt einen Schritt weiter und meldet ihn als `n/LAUF_SCHRITTE`.
# Die Anzeige macht daraus einen Balken und eine Prozentzahl. Daniel am
# 21.08.2026: „dort müsste es auch möglich sein die einzelnen deploy schritte
# als fortschrittschritte und prozentzahl aufzuzeigen."
#
# Der Zähler liegt in einer Datei, weil jeder Schritt eines Workflows in einer
# eigenen Shell läuft — eine Variable überlebt das nicht.
if [ "$ZUSTAND" = "schritt" ]; then
  ZAEHLER="${RUNNER_TEMP:-/tmp}/lauf-schritt.txt"
  N=$(( $(cat "$ZAEHLER" 2>/dev/null || echo 0) + 1 ))
  printf '%s' "$N" > "$ZAEHLER"
  ZUSTAND="laeuft"
  TEXT="$NOTIZ"
  NOTIZ=""
  FORTSCHRITT_JSON=",
  \"fortschritt\": $N,
  \"fortschritt_gesamt\": ${LAUF_SCHRITTE:-0},
  \"fortschritt_text\": \"$TEXT\""
fi

# Über eine Datei statt über die Kommandozeile: Anführungszeichen und Umlaute in
# der Notiz haben sonst schon ganze Meldungen zerlegt.
TMP="$(mktemp)"
cat > "$TMP" <<JSON
{
  "lauf_id": "${GITHUB_RUN_ID}",
  "repo": "${GITHUB_REPOSITORY:-}",
  "workflow": "${GITHUB_WORKFLOW:-}",
  "auftrag": "${AUFTRAG}",
  "zweck": "${ZWECK}",
  "ziel": "${ZIEL}",
  "zustand": "${ZUSTAND}",
  "url": "${URL}",
  "notiz": "${NOTIZ}"${FORTSCHRITT_JSON:-}
}
JSON

curl -sS --max-time 15 -X POST "${WORKER}/lauf" \
  -H "Content-Type: application/json" \
  -H "X-Lauf-Token: ${LAUF_TOKEN}" \
  --data-binary @"$TMP" >/dev/null 2>&1 || true

rm -f "$TMP"
exit 0
