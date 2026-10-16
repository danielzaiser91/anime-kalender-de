#!/usr/bin/env bash
#
# Den aktuellen Zweig als Pull Request einreichen und Auto-Merge einschalten.
#
# Seit dem 11.10.2026 schützt das Ruleset `main-pruefweg` den Hauptzweig: Direkt-Pushes sind nur der Daten-App erlaubt. Alles andere geht als Pull
# Request, GitHub mergt selbst (Squash), sobald die Freigabe des PR-Prüfers da ist. Kein `--admin`.
#
# Aufruf: bash tools/pr-einreichen.sh "<Titel>" ["<Text für die Squash-Nachricht>"]
# Der Text landet in der Squash-Nachricht; `deploy.yml` liest dort `[schlank]`.
set -euo pipefail

TITEL="${1:?Titel fehlt}"
TEXT="${2:-}"
ZWEIG="$(git rev-parse --abbrev-ref HEAD)"
if [ "$ZWEIG" = HEAD ] || [ "$ZWEIG" = main ]; then
  echo "✖ Ein Pull Request braucht einen eigenen Zweig (aktuell: $ZWEIG)." >&2
  exit 1
fi

# Vorprüfung (tools/pr-vorpruefung.mjs): fängt vor dem Push, was der CI-Prüfer sonst mit „ändern“ zurückgibt. Rot bricht ab.
# Gibt es den PR schon, gilt seine (unveränderliche) Beschreibung, sonst der Text dieses Aufrufs.
if gh pr view "$ZWEIG" --json number -q .number > /dev/null 2>&1; then
  PR_TEXT="$(gh pr view "$ZWEIG" --json body -q .body)"
else
  PR_TEXT="${TEXT:-$TITEL}"
fi
export PR_TEXT
node tools/pr-vorpruefung.mjs --titel "$TITEL" || { echo "✖ Einreichen abgebrochen: Vorprüfung rot (Befunde oben)." >&2; exit 1; }

git push -q -u origin "$ZWEIG"
if ! gh pr view "$ZWEIG" --json number -q .number > /dev/null 2>&1; then
  gh pr create --base main --head "$ZWEIG" --title "$TITEL" --body "${TEXT:-$TITEL}"
fi
gh pr merge "$ZWEIG" --auto --squash --delete-branch --body "$TEXT"
