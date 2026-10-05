#!/usr/bin/env bash
#
# Führt einen Schritt eines Datenlaufs aus: Ein Scheitern macht den Job nicht rot, bleibt aber **sichtbar** — Anmerkung im Lauf, Zeile in der
# Zusammenfassung, Meldung an die Statusanzeige. Ersetzt das Paar „Schritt mit continue-on-error + Fortschrittsschritt".
#
# Aufruf:  bash tools/schritt.sh [--zeit 40m] "Name" -- befehl arg...
#
# Warum es das gibt (05.10.2026): Fast jeder Schritt der Datenläufe trug `continue-on-error`. Ein Fehlschlag stand dann als grüner Haken im Lauf, und
# man sah ihn nur, wenn man das Protokoll las. Hier wird er gezählt (`schritte-auswerten.sh`), und der Lauf meldet sich bei Fehlschlägen gelb.
# `--zeit` begrenzt den Schritt, damit ein hängender Abruf (Sperre, Rate-Limit) nicht das Zeitlimit des Jobs reißt und mit ihm den Pull Request.
set -u

ZEIT=""
if [ "${1:-}" = "--zeit" ]; then
  ZEIT="${2:?--zeit braucht eine Dauer}"
  shift 2
fi
NAME="${1:?Name fehlt}"
shift
[ "${1:-}" = "--" ] && shift

PROTOKOLL="${RUNNER_TEMP:-/tmp}/schritte.tsv"
START="$(date +%s)"

echo "::group::${NAME}"
if [ -n "$ZEIT" ]; then
  timeout --signal=TERM --kill-after=30 "$ZEIT" "$@"
else
  "$@"
fi
RC=$?
echo "::endgroup::"

DAUER=$(( $(date +%s) - START ))
printf '%s\t%s\t%s\n' "$NAME" "$RC" "$DAUER" >> "$PROTOKOLL"

if [ "$RC" -eq 0 ]; then
  ZEICHEN="✓"
else
  GRUND="Exit ${RC}"
  [ "$RC" -eq 124 ] && GRUND="Zeitgrenze ${ZEIT} erreicht"
  echo "::warning title=Schritt fehlgeschlagen::${NAME} (${GRUND}, ${DAUER}s)"
  ZEICHEN="✗ ${GRUND}"
fi

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  if [ ! -s "${PROTOKOLL}.kopf" ]; then
    printf '| Schritt | Ergebnis | Dauer |\n|---|---|---|\n' >> "$GITHUB_STEP_SUMMARY"
    : > "${PROTOKOLL}.kopf"
    echo x >> "${PROTOKOLL}.kopf"
  fi
  printf '| %s | %s | %dm %02ds |\n' "$NAME" "$ZEICHEN" $((DAUER / 60)) $((DAUER % 60)) >> "$GITHUB_STEP_SUMMARY"
fi

# Der Statusanzeige genügt der letzte Stand; ohne Token oder ohne Melder passiert nichts.
if [ -n "${MELDER:-}" ] && [ -f "${MELDER}" ]; then
  bash "$MELDER" laeuft "${JOB_ANZEIGE:-Job}: ${NAME} — ${ZEICHEN}" || true
fi
exit 0
