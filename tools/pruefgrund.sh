#!/usr/bin/env bash
#
# Kurzer Grund aus dem Protokoll einer roten Prüfung, für die Statusanzeige (Aufruf: bash tools/pruefgrund.sh <datei>).
#
# Nur `✖`-Zeilen zu suchen ließ den Grund leer: `check:logic` meldet „<datei> ist rot", ohne `✖`
# (Bestandsbau 18.10.2026 09:26 und 09:48, Anzeige „Neue Meldungen zurückgestellt: " ohne Grund).
# Fehlt jede bekannte Marke, bleiben die letzten drei Zeilen — ein leerer Grund darf nie entstehen.
set -uo pipefail

DATEI="${1:?Protokolldatei fehlt}"

# Formatzeilen von check-logic-alle.mjs: `<name>: <datei> ist rot (` bzw. `<name>: N von M Prüfungen rot:` mit `  - <datei>`.
# Grüne Testzeilen enthalten oft auch „ist rot" (`✓ … ist rot`), deshalb nur am Zeilenanfang suchen.
rote_liste() { sed -n '/^[^ ]*: [0-9]* von [0-9]* Prüfungen rot:$/,$p' "$DATEI" | grep -E '^[^ ]+: |^  - '; }
gefunden="$({ grep -E '✖' "$DATEI"; grep -E '^[^ ]+: [^ ]+ ist rot \(' "$DATEI"; rote_liste; } | head -n 3 | tr -d '\"' | tr -s '[:space:]' ' ')"
if [ -z "$gefunden" ]; then
  gefunden="$(grep -v '^[[:space:]]*$' "$DATEI" | tail -n 3 | tr -d '\"' | tr -s '[:space:]' ' ')"
fi
if [ -z "$gefunden" ]; then
  gefunden="Prüfung rot, Protokoll leer"
fi
printf '%s\n' "${gefunden# }"
