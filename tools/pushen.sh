#!/usr/bin/env bash
#
# Prüfen, dann pushen — nie in anderer Reihenfolge (07.10.2026: zweimal ein Stand gepusht, obwohl `check:vor-commit` oder `check:logic` rot war,
# weil die Befehle mit `;` statt `&&` verkettet waren und nur das Ende der Ausgabe gelesen wurde).
#
# Aufruf: bash tools/pushen.sh            (Prüfkette, dann fetch, rebase, push nach main)
#         bash tools/pushen.sh --ohne-pruefung   (nur für Änderungen an Doku und Status)
set -euo pipefail
if [ "${1:-}" != "--ohne-pruefung" ]; then
  npm run -s check:vor-commit
fi
git fetch -q
git rebase -q origin/main
git push -q origin HEAD:main
git log --oneline -1
