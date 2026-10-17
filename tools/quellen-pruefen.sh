#!/usr/bin/env bash
#
# Prüft, was ein Sammel-Lauf einreichen will, bevor der Pull Request entsteht (17.10.2026).
# Anlass: Ein Sammler-PR brachte zwei Sammlerdateien in Widerspruch (aniSearch-Kennung 18892: Dub-Liste „geplant", Eintrag „nicht genannt");
# erst der Bestandsbau merkte es, und `main` war über sieben Stunden rot.
#
# Wird mit `source` geladen (`quellen-pr.sh`). `quellen_pruefen` läuft im Arbeitsverzeichnis des Sammlers, auf dem Stand, der eingereicht wird.
# Rückgabe: Exit 0 = grün; sonst rot, auch wenn die Prüfung nicht startet oder die Frist reißt. Auf stdout steht dann der Grund (rote Prüfungen),
# das ganze Protokoll geht nach stderr. `check:logic` liest nur `data/` und den Code, nie `public/data` (Sperre), und braucht kein Chromium.
#
# `QUELLEN_PRUEFBEFEHL` und `QUELLEN_PRUEFFRIST` sind Schalter für den Test; kein Workflow setzt sie (`tools/sammler-pruefschritt.test.mjs`).

QUELLEN_PRUEFFRIST_STANDARD=900

quellen_pruefen() {
  local protokoll status=0
  protokoll="$(mktemp)"
  CI=true timeout "${QUELLEN_PRUEFFRIST:-$QUELLEN_PRUEFFRIST_STANDARD}" \
    bash -c "${QUELLEN_PRUEFBEFEHL:-npm run check:logic -- --alle}" > "$protokoll" 2>&1 || status=$?
  cat "$protokoll" >&2
  if [ "$status" = 0 ]; then
    rm -f "$protokoll"
    return 0
  fi
  if [ "$status" = 124 ]; then
    echo "Die Prüfung brauchte länger als ${QUELLEN_PRUEFFRIST:-$QUELLEN_PRUEFFRIST_STANDARD} s und wurde abgebrochen."
  elif grep -qE '^  - ' "$protokoll"; then
    grep -E '^  - ' "$protokoll" | head -20
  else
    echo "Die Prüfung endete mit Exit $status:"
    tail -n 5 "$protokoll"
  fi
  rm -f "$protokoll"
  return 1
}
