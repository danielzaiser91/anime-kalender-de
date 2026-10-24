#!/usr/bin/env bash
#
# Hilfen für den Neuversuch in `commit-data.sh` (wird mit `source` eingebunden).
# Anlass (24.10.2026, Lauf 40091570662): Jeder Neuversuch nach einem abgelehnten Push baute und prüfte alles neu (~7,5 min), main bewegte
# sich schneller, also verlor der Bau sechsmal den Wettlauf. Was nach einer Bewegung noch laufen muss, entscheidet
# `tools/neuversuch-art.mjs` (nichts / daten / code); jede Unsicherheit ergibt `code`, die volle Kette.

# Setzt NEUVERSUCH_ART. Nur nach einem vollständig grünen Versuch (Bau, Listen, Bestand, check:logic) gibt es etwas anderes als `code`.
neuversuch_klassifizieren() {
  NEUVERSUCH_ART=code
  if [ "${PRUEFUNG_GRUEN:-0}" = 1 ] && [ -n "${LOGIK_BASIS:-}" ] && [ -n "${BAU_BASIS:-}" ]; then
    NEUVERSUCH_ART="$(node tools/neuversuch-art.mjs "$LOGIK_BASIS" "$BAU_BASIS" origin/main 2> /dev/null || echo code)"
  fi
  case "$NEUVERSUCH_ART" in nichts | daten | code) ;; *) NEUVERSUCH_ART=code ;; esac
}

# War der eben abgelehnte Versuch vollständig grün? (Aufrufer: Flags dieses Versuchs.) AUFBAU_KAPUTT und die Bau-Art brauchen keinen eigenen Term: Ohne gelaufene Prüfung (NUR_QUELLEN, Aufbau gescheitert) bleibt LOGIK_BASIS leer.
neuversuch_gruen() {
  [ "${AUFBAU_GESCHEITERT:-0}" = 0 ] && [ "${BESTAND_KAPUTT:-0}" = 0 ] &&
    [ "${LISTEN_GESCHEITERT:-0}" = 0 ] && [ "${QUARANTAENE_AKTIV:-0}" = 0 ] && [ -n "${LOGIK_BASIS:-}" ] &&
    [ -n "${BAU_BASIS:-}" ]
}

# Aufsetzen auf dem Fernstand und die gebauten Erzeugnisse behalten: gilt nur, wenn der Fernstand sie nicht berührt hat (Art `nichts`).
erzeugnisse_behalten_aufsetzen() {
  local sicher="$TEMP_LAUF/erzeugnisse"
  local ordner
  rm -rf "$sicher"
  mkdir -p "$sicher/public"
  for ordner in public/data public/og; do
    if [ -d "$ordner" ]; then cp -r "$ordner" "$sicher/$ordner"; fi
  done
  quellen_aufsetzen origin/main
  for ordner in public/data public/og; do
    rm -rf "$ordner"
    if [ -d "$sicher/$ordner" ]; then cp -r "$sicher/$ordner" "$ordner"; fi
  done
}
