#!/usr/bin/env bash
#
# Daten-Pull-Requests mit dem App-Token mergen (Squash). Aufruf: bash tools/daten-pr-mergen.sh <Nummer>...
#
# `--admin` ist der Bypass der App im Ruleset `main-pruefweg`: Ohne das Flag weigert sich `gh` schon, sobald der Pull Request auf eine Freigabe wartet.
# Ein Pull Request, der sich nicht mergen lässt, macht den Lauf rot (Ausgang 1) — still offen bleiben darf er nicht.
set -uo pipefail

fehler=0
for nr in "$@"; do
  zustand=UNKNOWN
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    zustand="$(gh pr view "$nr" --json mergeable -q .mergeable)"
    [ "$zustand" != UNKNOWN ] && break
    sleep 3
  done
  if [ "$zustand" != MERGEABLE ]; then
    echo "::notice::Pull Request $nr bleibt offen ($zustand)."
    continue
  fi
  titel="$(gh pr view "$nr" --json title -q .title)"
  gemergt=0
  for versuch in 1 2 3 4; do
    if gh pr merge "$nr" --squash --admin --delete-branch --subject "$titel"; then
      gemergt=1
      break
    fi
    echo "::notice::Merge von Pull Request $nr, Versuch $versuch von 4 abgelehnt."
    sleep $((3 + RANDOM % 8))
  done
  if [ "$gemergt" != 1 ]; then
    echo "::error::Pull Request $nr ist mergebar, ließ sich aber nicht mergen (Ruleset/Bypass der App prüfen)."
    fehler=1
  fi
done
exit "$fehler"
