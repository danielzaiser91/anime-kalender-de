# Shell-Gegenstück zu ghMitLimit (tools/gh-ratelimit.mjs). Einbinden mit `. tools/gh-mit-limit.sh`, aufrufen wie `gh`:
#   ghl pr comment "$PR" --body-file datei
# stdout ist nur das von gh; Fehlertext, Warte- und Konto-Zeilen gehen nach stderr. Scheitert gh mit „rate limit“, wartet
# `node tools/gh-ratelimit.mjs warten` bis zum Reset (nur wenn das Zeitkonto des Jobs es deckt) und gh läuft genau einmal neu.
# Jeder andere Fehler und jeder Fehler ohne Wartezeit behält den Exit-Code von gh.
ghl() {
  local e rc=0
  e=$(mktemp)
  gh "$@" 2> "$e" || rc=$?
  cat "$e" >&2
  if [ "$rc" -ne 0 ] && node tools/gh-ratelimit.mjs warten "$e" >&2; then
    rc=0
    gh "$@" || rc=$?
  fi
  rm -f "$e"
  return "$rc"
}
