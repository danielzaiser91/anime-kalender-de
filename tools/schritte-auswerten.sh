#!/usr/bin/env bash
#
# Am Ende eines Jobs: zählt die Fehlschläge aus dem Protokoll von `tools/schritt.sh` und gibt sie als Job-Ausgabe `fehler` weiter
# (Namen, durch „ · " getrennt; leer = alles gelungen). Der abschließende Job eines Workflows macht daraus die gelbe Meldung der Statusanzeige.
set -u
PROTOKOLL="${RUNNER_TEMP:-/tmp}/schritte.tsv"
FEHLER=""
GESAMT=0
if [ -f "$PROTOKOLL" ]; then
  while IFS=$'\t' read -r name rc dauer; do
    GESAMT=$((GESAMT + 1))
    if [ "$rc" != "0" ]; then
      FEHLER="${FEHLER:+$FEHLER · }${name}"
    fi
  done < "$PROTOKOLL"
fi
echo "Schritte: ${GESAMT}, davon fehlgeschlagen: ${FEHLER:-keiner}"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  printf 'fehler=%s\n' "$FEHLER" >> "$GITHUB_OUTPUT"
fi
# Mit Fehlschlag endet der Schritt rot (im Workflow `continue-on-error: true`, der Job bleibt grün): Nur so sieht ihn
# `laeufe-aufraeumen.mjs` (`wache-weicher-schritt.mjs` liest die „FEHLER:“-Zeile des roten Schritts aus dem Log).
if [ -n "$FEHLER" ]; then
  echo "FEHLER: Schritte fehlgeschlagen: ${FEHLER}"
  exit 1
fi
exit 0
