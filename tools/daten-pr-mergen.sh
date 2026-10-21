#!/usr/bin/env bash
#
# Daten-Pull-Requests mit dem App-Token mergen (Squash). Aufruf: bash tools/daten-pr-mergen.sh <Nummer>...
#
# `--admin` ist der Bypass der App im Ruleset `main-pruefweg`: Ohne das Flag weigert sich `gh` schon, sobald der Pull Request auf eine Freigabe wartet.
# Ein Pull Request, der sich nicht mergen lässt oder nicht MERGEABLE ist (Konflikt nach dem Auflösen), macht den Lauf rot (Ausgang 1) — still offen bleiben darf er nicht (20.10.2026: grüner Lauf, PR 1556 blieb im Konflikt).
set -uo pipefail

# Die App mergt am Ruleset vorbei, also nur, was sie selbst eingereicht hat: eigener Autor, kein Fork, nur Pfade der Quellenliste.
# Sonst könnte jeder mit einem Zweig `daten/...` beliebige Dateien nach main bringen (Prüfer-Urteil PR 767).
APP_AUTOR="${APP_AUTOR:-app/anime-kalender-daten}"
# shellcheck source=tools/quellen-liste.sh
source "$(dirname "$0")/quellen-liste.sh"

# Gibt den Grund aus und endet mit 1, wenn der Pull Request nicht von der App kommt, aus einem Fork stammt oder fremde Dateien ändert.
fremd_grund() {
  local nr="$1" autor fork datei q erlaubt
  autor="$(gh pr view "$nr" --json author -q .author.login)"
  fork="$(gh pr view "$nr" --json isCrossRepository -q .isCrossRepository)"
  [ "$autor" = "$APP_AUTOR" ] || { echo "Autor ist $autor, nicht $APP_AUTOR"; return 1; }
  [ "$fork" = false ] || { echo "stammt aus einem Fork"; return 1; }
  while IFS= read -r datei; do
    erlaubt=0
    for q in "${QUELLEN[@]}"; do
      if [ "$datei" = "$q" ] || [[ "$datei" == "$q"/* ]]; then erlaubt=1; break; fi
    done
    [ "$erlaubt" = 1 ] || { echo "ändert $datei (nicht in tools/quellen-liste.sh)"; return 1; }
  done < <(gh pr view "$nr" --json files -q '.files[].path')
  return 0
}

fehler=0
for nr in "$@"; do
  # Fremder Autor (Mensch, lokaler Lauf): nicht Sache der App, den Lauf rot zu machen — der Pull Request geht den normalen Prüfweg (Kette, CI-Prüfer).
  autor="$(gh pr view "$nr" --json author -q .author.login)"
  if [ "$autor" != "$APP_AUTOR" ]; then
    echo "::warning::Pull Request $nr übersprungen: Autor ist $autor, nicht $APP_AUTOR (Zweig besser ohne daten/-Präfix benennen)."
    continue
  fi
  zustand=UNKNOWN
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    zustand="$(gh pr view "$nr" --json mergeable -q .mergeable)"
    [ "$zustand" != UNKNOWN ] && break
    sleep 3
  done
  if [ "$zustand" != MERGEABLE ]; then
    echo "::error::Pull Request $nr bleibt offen ($zustand): der Lauf hat ihn nicht konfliktfrei bekommen."
    fehler=1
    continue
  fi
  # Marke aus `tools/quellen-pr.sh`: Die Datenprüfungen waren auf diesem Stand rot, erst ein Mensch löst sie.
  if [[ "$(gh pr view "$nr" --json title -q .title)" == "[Prüfung rot]"* ]]; then
    echo "::notice::Pull Request $nr trägt die Marke „Prüfung rot“ und wird nicht gemergt: erst beheben, dann die Marke aus dem Titel nehmen."
    continue
  fi
  if ! grund="$(fremd_grund "$nr")"; then
    echo "::error::Pull Request $nr wird nicht gemergt: $grund."
    fehler=1
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
