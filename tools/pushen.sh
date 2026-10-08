#!/usr/bin/env bash
#
# Prüfen, dann pushen — nie in anderer Reihenfolge (07.10.2026: zweimal ein Stand gepusht, obwohl `check:vor-commit` oder `check:logic` rot war,
# weil die Befehle mit `;` statt `&&` verkettet waren und nur das Ende der Ausgabe gelesen wurde).
#
# Aufruf: bash tools/pushen.sh            (hart: Prüfkette, dann fetch, rebase, push nach main; der Deploy wartet auf seine Prüfungen)
#         bash tools/pushen.sh --schlank  (kleine Oberflächenänderung, lokal vollständig geprüft: nur Typprüfung und Umfang, der Deploy läuft gleich nach dem Bau,
#                                          seine Prüfungen laufen daneben weiter und melden sich rot; erlaubt nur für web/, docs/, status.md und die Auslieferungsdateien in public/)
#         bash tools/pushen.sh --ohne-pruefung   (nur für Änderungen an Doku und Status)
set -euo pipefail
modus="${1:-hart}"

if [ "$modus" = "--schlank" ]; then
  git fetch -q
  fremd="$(git diff --name-only origin/main...HEAD | grep -Ev '^(web/|docs/|status\.md$|daniel-zum-abarbeiten/|vite\.config\.ts$|public/(icons|og|sw\.js|manifest\.webmanifest|404\.html|beleg\.html)(/|$))' || true)"
  if [ -n "$fremd" ]; then
    echo "✖ --schlank gilt nur für Oberfläche und Doku — diese Dateien verlangen den harten Weg:" >&2
    echo "$fremd" >&2
    exit 1
  fi
  npm run -s typecheck
  npm run -s check:umfang
elif [ "$modus" != "--ohne-pruefung" ]; then
  npm run -s check:vor-commit
fi

git fetch -q
git rebase -q origin/main
if [ "$modus" = "--schlank" ] && ! git log -1 --format=%B | grep -q '\[schlank\]'; then
  git commit -q --amend -m "$(git log -1 --format=%B)" -m "[schlank]"
fi
git push -q origin HEAD:main
git log --oneline -1
