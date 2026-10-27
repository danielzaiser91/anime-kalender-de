#!/usr/bin/env bash
#
# Prüft, was ein Sammel-Lauf einreichen will, bevor der Pull Request entsteht (17.10.2026).
# Anlass: Ein Sammler-PR brachte zwei Sammlerdateien in Widerspruch (aniSearch-Kennung 18892: Dub-Liste „geplant", Eintrag „nicht genannt");
# erst der Bestandsbau merkte es, und `main` war über sieben Stunden rot.
#
# Wird mit `source` geladen (`quellen-pr.sh`). `quellen_pruefen` läuft im Arbeitsverzeichnis des Sammlers, auf dem Stand, der eingereicht wird.
# Rückgabe: Exit 0 = grün; sonst rot, auch wenn die Prüfung nicht startet oder die Frist reißt. Auf stdout steht dann der Grund (alle roten Prüfungen),
# das ganze Protokoll geht nach stderr. `check:logic` liest nur `data/` und den Code, nie `public/data` (Sperre), und braucht kein Chromium.
#
# `quellen_neue_fehler` zieht davon ab, was `origin/main` selbst schon rot hat: Ist `main` rot, markiert nicht jeder Sammler seinen PR, und nach der Reparatur
# bleibt nichts liegen. Verglichen wird je Prüfung (die Zeilen `  - <Prüfdatei>`), nicht je Fehler: Ist eine Prüfung auf `main` schon rot, fällt ein neuer
# Fehler des Funds in derselben Prüfung nicht auf und wird gemergt. Tragbar, weil `main` dann ohnehin rot und im Bestandsbau sichtbar ist.
#
# Das App-Token (GH_TOKEN) sieht die Prüfung nicht: Es mergt am Ruleset vorbei und gehört nur `quellen-pr.sh` (`tools/app-token-sperre.mjs`).
#
# `QUELLEN_PRUEFBEFEHL` und `QUELLEN_PRUEFFRIST` sind Schalter für den Test; kein Workflow setzt sie (`tools/sammler-pruefschritt-waechter.test.mjs`).

# Fristen (17.10.2026): check:logic braucht in der CI unter einer Minute (lokal unter Windows knapp 3). Fund und Vergleich auf `main` zusammen samt dem
# übrigen Job passen in den kleinsten Job-Timeout eines Einreichers; das rechnet der Wächter aus den Workflows nach (`pruefeFristen` in `tools/sammler-pruefschritt-waechter.mjs`).
QUELLEN_PRUEFFRIST_STANDARD=420
QUELLEN_BASISFRIST_STANDARD=240

quellen_pruefen() {
  local protokoll status=0
  protokoll="$(mktemp)"
  CI=true timeout "${QUELLEN_PRUEFFRIST:-$QUELLEN_PRUEFFRIST_STANDARD}" \
    env -u GH_TOKEN -u GITHUB_TOKEN bash -c "${QUELLEN_PRUEFBEFEHL:-npm run check:logic -- --alle}" > "$protokoll" 2>&1 || status=$?
  cat "$protokoll" >&2
  if [ "$status" = 0 ]; then
    rm -f "$protokoll"
    return 0
  fi
  if [ "$status" = 124 ]; then
    echo "Die Prüfung brauchte länger als ${QUELLEN_PRUEFFRIST:-$QUELLEN_PRUEFFRIST_STANDARD} s und wurde abgebrochen."
  elif grep -qE '^  - ' "$protokoll"; then
    grep -E '^  - ' "$protokoll"
  else
    echo "Die Prüfung endete mit Exit $status:"
    tail -n 5 "$protokoll"
  fi
  rm -f "$protokoll"
  return 1
}

# Dieselbe Prüfung auf dem Stand von `origin/main` (eigener Arbeitsbaum, `node_modules` verlinkt); stdout wie bei `quellen_pruefen`. Nie ein Abbruch.
quellen_pruefen_main() {
  local dir
  dir="$(mktemp -d)"
  if git worktree add --detach --quiet "$dir/main" origin/main >&2; then
    if [ -e node_modules ]; then ln -s "$PWD/node_modules" "$dir/main/node_modules"; fi
    # Exit 1 = main selbst ist rot (die Liste auf stdout ist der Befund); jeder andere Exit bleibt sichtbar statt verschluckt.
    local status=0
    (
      cd "$dir/main" || exit 2
      QUELLEN_PRUEFFRIST="${QUELLEN_PRUEFFRIST:-$QUELLEN_BASISFRIST_STANDARD}" quellen_pruefen
    ) || status=$?
    if [ "$status" -gt 1 ]; then
      echo "Die Prüfung auf main konnte nicht laufen (Exit $status); der Vergleich gilt ohne Basis." >&2
    fi
    rm -f "$dir/main/node_modules"
    git worktree remove --force "$dir/main" >&2 || true
  else
    echo "Kein Arbeitsbaum für origin/main; der Vergleich gilt ohne Basis." >&2
  fi
  rm -rf "$dir"
}

# $1 = stdout von `quellen_pruefen` (rot). Gibt aus, was davon neu ist gegenüber `main`; leer = `main` hat dieselben Fehler schon.
# Nur eine Liste roter Prüfungen ist vergleichbar; Frist, Absturz und alles andere bleiben ganz stehen (rot).
quellen_neue_fehler() {
  local fund="$1" basis
  if printf '%s\n' "$fund" | grep -qvE '^  - '; then
    printf '%s\n' "$fund"
    return 0
  fi
  basis="$(quellen_pruefen_main)" || basis=""
  printf '%s\n' "$fund" | grep -vxFf <(printf '%s\n' "$basis") || true
}
