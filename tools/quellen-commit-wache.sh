#!/usr/bin/env bash
#
# Pre-commit-Wache: keine Datei aus QUELLEN committen, während ein Datenlauf läuft.
#
# Ein laufender Lauf committet am Ende den Stand von seinem Start und überschreibt
# dabei, was zwischendurch lokal committet wurde (CLAUDE.md, „Ein laufender Datenlauf
# committet den Stand von seinem Start"). Die Lehre stand geschrieben und ist trotzdem
# dreimal passiert: 29.08. Handbelege, 16.09. disc-ausgaben.json, 16.09.
# verweise-von-hand.yaml. Ab dem zweiten Rückfall gibt es keinen weiteren Satz, sondern
# diese Prüfung (rueckfall-register.md, 18.09.2026).
#
# Eingebunden als .git/hooks/pre-commit (`bash tools/quellen-commit-wache.sh --einrichten`).
# Ohne Netz oder ohne gh lässt sie den Commit durch und sagt es — eine Wache, die bei
# einem Funkloch jeden Commit sperrt, würde abgeschaltet.

set -u
cd "$(git rev-parse --show-toplevel)" || exit 0

if [ "${1:-}" = "--einrichten" ]; then
  printf '#!/usr/bin/env bash\nexec bash tools/quellen-commit-wache.sh\n' > .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "pre-commit-Wache eingerichtet"
  exit 0
fi

source tools/quellen-liste.sh

betroffen=()
while IFS= read -r datei; do
  for q in "${QUELLEN[@]}"; do
    if [ "$datei" = "$q" ] || [[ "$datei" == "$q/"* ]]; then betroffen+=("$datei"); break; fi
  done
done < <(git diff --cached --name-only)

[ ${#betroffen[@]} -eq 0 ] && exit 0

# Läufe, die selbst auf main committen. Deploy, Aussehen und die Claude-Läufe schreiben
# keine Quellen; die Sammler reichen per Pull Request ein, dort meldet GitHub den Konflikt.
laufend=$(gh run list --repo danielzaiser91/anime-kalender-de --limit 30 \
  --json status,workflowName,databaseId \
  --jq '.[] | select(.status=="in_progress" or .status=="queued")
        | select(.workflowName | test("^(Deploy|Aussehen|Claude)") | not)
        | "\(.databaseId)  \(.workflowName)"' 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "quellen-commit-wache: Laufstand nicht abrufbar — Commit ohne Prüfung durchgelassen" >&2
  exit 0
fi

if [ -n "$laufend" ]; then
  echo "quellen-commit-wache: Commit angehalten." >&2
  echo "  Gestagt aus QUELLEN: ${betroffen[*]}" >&2
  echo "  Laufend:" >&2
  echo "$laufend" | sed 's/^/    /' >&2
  echo "  Warten, bis der Lauf fertig ist, danach nachsehen, ob die eigene Fassung noch steht." >&2
  exit 1
fi
exit 0
