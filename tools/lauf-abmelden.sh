#!/usr/bin/env bash
#
# Letzter Handgriff eines Ein-Job-Datenlaufs: meldet der Statusanzeige das Ergebnis.
# Aufruf: bash tools/lauf-abmelden.sh <Job-Status: success|failure|cancelled> ["Namen der fehlgeschlagenen Schritte"]
#
# Ein erfolgreicher Job mit fehlgeschlagenen Einzelschritten (`tools/schritt.sh`) meldet sich **gelb** (warnung): Der Lauf ist nicht rot, aber etwas, das er
# holen sollte, kam nicht (05.10.2026 — bis dahin sah ein stiller Fehlschlag aus wie ein grüner Haken).
set -u
STATUS="${1:-failure}"
FEHLER="${2:-}"
FEHLER="$(printf '%s' "$FEHLER" | tr -s '[:space:]' ' ')"
FEHLER="${FEHLER# }"; FEHLER="${FEHLER% }"
MELDER="${MELDER:-$(dirname "${BASH_SOURCE[0]}")/lauf-melden.sh}"

case "$STATUS" in
  success)
    if [ -n "$FEHLER" ]; then
      bash "$MELDER" warnung "Schritte fehlgeschlagen: $FEHLER"
    else
      bash "$MELDER" ok
    fi
    ;;
  cancelled) bash "$MELDER" abgebrochen ;;
  *) bash "$MELDER" fehler ;;
esac
exit 0
