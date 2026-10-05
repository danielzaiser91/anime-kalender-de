#!/usr/bin/env bash
#
# Setzt das Arbeitsverzeichnis auf den aktuellen Fernstand und legt **nur** zurück, was dieser Lauf selbst an Quellen geändert hat.
# Wird mit `source` geladen (nach `tools/quellen-liste.sh`); `commit-data.sh` und `quellen-pr.sh` rufen `quellen_aufsetzen`.
#
# **Warum nicht mehr alle Quellen.** Bis zum 05.10.2026 rettete der Reset jede Datei aus `QUELLEN`, auch die unveränderten. Hatte ein anderer Lauf
# zwischenzeitlich eine davon aktualisiert, überschrieb der ältere Stand des Retters sie still (29.08. Handbelege, 16.09. disc-ausgaben.json).
# Dagegen stand die Gruppe `daten`, die alle Datenläufe hintereinander hielt — und mit ihr der Preis: Der Wochenlauf blockierte Bau und Stundenlauf
# für bis zu anderthalb Stunden. Wer nur die eigenen Änderungen zurücklegt, kann niemandem etwas überschreiben, was er nicht angefasst hat.
#
# Zwei Dateien werden zusammengeführt statt ersetzt, weil mehrere Läufe daran schreiben: `data/dub-confirmed.yaml` (Belege) und
# `data/source-health.json` (je Quelle der jüngere Eintrag).
#
# Ergebnis: Rückgabewert 0; auf `QUELLEN_GEAENDERT` steht die Zahl der zurückgelegten Dateien (für das Protokoll).

quellen_aufsetzen() {
  local fernstand="${1:-origin/main}"
  local rettung zeile status datei
  rettung="$(mktemp -d)"
  : > "$rettung/.geloescht"

  # Dateiebene (-uall), ohne Umbenennungserkennung: Eine Umbenennung ist hier eine Löschung plus eine neue Datei.
  while IFS= read -r zeile; do
    [ -n "$zeile" ] || continue
    status="${zeile:0:2}"
    datei="${zeile:3}"
    case "$status" in
      *D*) printf '%s\n' "$datei" >> "$rettung/.geloescht" ;;
      *)
        [ -f "$datei" ] || continue
        mkdir -p "$rettung/files/$(dirname "$datei")"
        cp "$datei" "$rettung/files/$datei"
        ;;
    esac
  done < <(git -c status.renames=false status --porcelain -uall -- "${QUELLEN[@]}" 2>/dev/null)

  git reset --hard "$fernstand" --quiet

  QUELLEN_GEAENDERT=0
  while IFS= read -r datei; do
    [ -n "$datei" ] || continue
    rm -f "$datei"
    QUELLEN_GEAENDERT=$((QUELLEN_GEAENDERT + 1))
  done < "$rettung/.geloescht"

  if [ -d "$rettung/files" ]; then
    while IFS= read -r datei; do
      datei="${datei#"$rettung/files/"}"
      mkdir -p "$(dirname "$datei")"
      case "$datei" in
        data/dub-confirmed.yaml)
          if [ -e "$datei" ]; then
            node tools/dub-belege-vereinen.mjs "$datei" "$rettung/files/$datei" || true
          else
            cp "$rettung/files/$datei" "$datei"
          fi
          ;;
        data/source-health.json)
          if [ -e "$datei" ]; then
            node tools/health-vereinen.mjs "$datei" "$rettung/files/$datei"
          else
            cp "$rettung/files/$datei" "$datei"
          fi
          ;;
        *) cp "$rettung/files/$datei" "$datei" ;;
      esac
      QUELLEN_GEAENDERT=$((QUELLEN_GEAENDERT + 1))
    done < <(find "$rettung/files" -type f)
  fi
  rm -rf "$rettung"
  echo "Quellen auf $fernstand aufgesetzt: $QUELLEN_GEAENDERT eigene Änderung(en) zurückgelegt."
}
