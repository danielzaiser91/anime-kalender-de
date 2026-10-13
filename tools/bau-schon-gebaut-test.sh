#!/usr/bin/env bash
#
# Simulationstest für `tools/bau-schon-gebaut.sh` mit einer Attrappe-`gh` über einem lokalen Git-Verlauf (kein Netz).
# Anlass (12.10.2026): Ein Bau-Commit nur mit Verlaufsdateien (Bau an check:bestand gescheitert) galt als "gebaut".
#
# Aufruf: bash tools/bau-schon-gebaut-test.sh   (Exit 0 = grün; `tools/bau-schon-gebaut.test.mjs` ruft es in `check:workflows` auf)

set -uo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARBEIT="$(mktemp -d)"
trap 'rm -rf "$ARBEIT"' EXIT
FEHLER=0
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.autocrlf GIT_CONFIG_VALUE_0=false

pruefe() {
  if [ "$2" = "$3" ]; then
    echo "  ✓ $1"
  else
    echo "  ✗ $1 — erwartet: $2, gefunden: $3"
    FEHLER=$((FEHLER + 1))
  fi
}

# Attrappe: antwortet wie die GitHub-API aus dem lokalen Verlauf (`REPO_DIR`) und wendet das echte `--jq` mit jq an.
mkdir -p "$ARBEIT/attrappe"
cat > "$ARBEIT/attrappe/gh" <<'SKRIPT'
#!/usr/bin/env bash
endpunkt="$2"
jqfilter="$4"
cd "$REPO_DIR" || exit 1
case "$endpunkt" in
  *"/commits?"*)
    pfad=""
    case "$endpunkt" in
      *path=*)
        pfad="${endpunkt#*path=}"
        pfad="${pfad%%&*}"
        ;;
    esac
    git log --format="%H%x09%s" -10 main -- ${pfad:+"$pfad"} |
      jq -R -s -c 'split("\n") | map(select(length > 0) | split("\t") | {sha: .[0], commit: {message: .[1]}})' |
      jq -r "$jqfilter" | sed "s/[[:cntrl:]]*$//"
    ;;
  *"/compare/"*)
    spanne="${endpunkt#*/compare/}"
    von="${spanne%%...*}"
    nach="${spanne##*...}"
    if [ "$von" = "$nach" ]; then echo identical
    elif git merge-base --is-ancestor "$von" "$nach"; then echo ahead
    else echo behind
    fi
    ;;
esac
SKRIPT
chmod +x "$ARBEIT/attrappe/gh"

REPO="$ARBEIT/repo"
git init -q -b main "$REPO"
cd "$REPO" || exit 1
git config user.name t
git config user.email t@t
commit() { # <Nachricht> <Datei…>
  local nachricht="$1"
  shift
  for datei in "$@"; do
    mkdir -p "$(dirname "$datei")"
    echo "$nachricht $RANDOM" > "$datei"
  done
  git add -A
  git commit -q -m "$nachricht"
  git rev-parse HEAD
}
frage() { # <sha> → Antwort des Skripts
  PATH="$ARBEIT/attrappe:$PATH" REPO_DIR="$REPO" GITHUB_REPOSITORY=x/y bash "$WURZEL/tools/bau-schon-gebaut.sh" "$1"
}

BAU="chore(data): Bestand neu gebaut"
commit "$BAU" public/data/titles.json > /dev/null # Bau vor dem Auslöser
ausloeser="$(commit "feat: Meldung" data/news.yaml)"

pruefe "kein Bau nach dem Auslöser" nein "$(frage "$ausloeser")"
commit "$BAU" data/bestand-historie.jsonl data/source-health.json > /dev/null
pruefe "Bau nur mit Verlaufsdateien zählt nicht (Bau gescheitert, 12.10.2026)" nein "$(frage "$ausloeser")"
commit "feat: von Hand" public/data/titles.json > /dev/null
pruefe "Handcommit mit public/data ist kein Bau" nein "$(frage "$ausloeser")"
commit "$BAU" public/data/titles.json data/bestand-historie.jsonl > /dev/null
pruefe "Bau mit public/data nach dem Auslöser zählt" ja "$(frage "$ausloeser")"
spaeter="$(commit "feat: noch eine Meldung" data/news.yaml)"
pruefe "Bau mit public/data vor dem Auslöser zählt nicht" nein "$(frage "$spaeter")"

if [ "$FEHLER" -gt 0 ]; then
  echo "$FEHLER Fehler."
  exit 1
fi
echo "Alles grün."
