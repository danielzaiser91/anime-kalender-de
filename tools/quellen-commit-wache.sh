#!/usr/bin/env bash
#
# Pre-commit-Wache: keine Datei aus QUELLEN auf main committen, während der Bestandsbau läuft.
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
  # Dazu die Umfangsprüfung (1 s): Eine Zeile zu viel in einer überlangen Funktion machte am
  # 02.10.2026 drei Stunden lang jeden Deploy rot, weil der Commit ohne check:vor-commit lief.
  # Dazu die Patch-Notes-Prüfung (nur bei gestagten data/patchnotes/*.yaml): ein Doppelpunkt im Untertitel fiel am 12.10.2026 erst
  # in check:vor-commit auf. Die Hook-Datei liegt für alle Worktrees im gemeinsamen Git-Verzeichnis; Zweige ohne das Werkzeug überspringen es.
  hook=$(git rev-parse --git-path hooks/pre-commit)
  printf '#!/usr/bin/env bash\nbash tools/quellen-commit-wache.sh && node tools/umfang-pruefen.mjs && { [ ! -f tools/patchnotes-gestagt-pruefen.mjs ] || node tools/patchnotes-gestagt-pruefen.mjs; }\n' > "$hook"
  chmod +x "$hook"
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

# Nur auf main: Ein Commit auf einem Zweig erreicht den Bestand erst über einen Pull Request, und den Konflikt meldet GitHub.
# Die Wache hielt am 10.10.2026 einen Branch-Commit 42 Minuten an (Datenlauf auf Abruf).
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || exit 0

# Es gibt nur noch einen Lauf, der direkt auf main committet: den Bestandsbau (`commit-data.sh`). Alle Sammler, der Datenlauf auf Abruf,
# der Crunchyroll-Rückstand und „Fund nachliefern“ reichen per Pull Request ein (05.10.2026), die PR-Läufe schreiben nichts.
laufend=$(gh run list --repo danielzaiser91/anime-kalender-de --limit 30 \
  --json status,workflowName,databaseId \
  --jq '.[] | select(.status=="in_progress" or .status=="queued")
        | select(.workflowName | test("^Bestand"))
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
