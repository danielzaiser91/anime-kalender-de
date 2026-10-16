#!/bin/bash
# Bestandsprüfungen auf der Bauausgabe des PR-Datenbaus (Job `PR-Datenbau`). Die lange Liste (check:bestand-liste, ≈ 40 s)
# läuft neben dem Rest, damit die Kette nur um die längere der beiden Hälften wächst. Beide lesen nur.
set -u
LOG="${RUNNER_TEMP:-/tmp}/bestand-liste.log"
npm run check:bestand-liste > "$LOG" 2>&1 &
LISTE=$!
REST=0
npm run check:bestand-rest || REST=1
LISTE_RC=0
wait "$LISTE" || LISTE_RC=1
echo "=== check:bestand-liste"
cat "$LOG"
if [ "$REST" != 0 ] || [ "$LISTE_RC" != 0 ]; then
  echo "::error::Der gebaute Bestand verletzt eine Zusicherung aus check:bestand (rest=$REST, liste=$LISTE_RC)"
  exit 1
fi
