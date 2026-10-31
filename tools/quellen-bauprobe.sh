#!/usr/bin/env bash
#
# Probebau eines Funds vor dem Einreichen (31.10.2026). Anlass: PR 2524 (Lauf auf Abruf, data:cartoons) kam ohne Bau auf `main`
# (Daten-PRs überspringen die Kette, der App-Merge ist ein Bypass); der Bestandsbau war danach über Stunden rot.
#
# Wird mit `source` geladen (`quellen-pr.sh`) und läuft nur, wenn der Einreicher es verlangt (`QUELLEN_BAUPROBE=1`, Eingabe `bauprobe` der Aktion einreichen).
# `quellen_bauprobe` läuft auf dem Stand, der eingereicht wird (HEAD = Fund-Commit, HEAD^1 = Spitze von main), und fährt `npm run data:bauprobe`:
# Datensatz bauen (dabei prüft `pipeline/lib/pruefung.ts`), „Gemessenes Ja hat einen Weg“ und alle Prüfungen aus `check:bestand`, rot nur was auch auf main
# grün ist (dieselben Schritte wie der Job PR-Datenbau in pr-pruefung.yml). Rückgabe: Exit 0 = grün; sonst rot, auch bei Frist oder Absturz, der Grund steht auf stdout.
# Der Bau schreibt `public/data` im Arbeitsbaum; der Fund ist committet, danach wird alles Getrackte zurückgesetzt.
#
# `QUELLEN_BAUBEFEHL` und `QUELLEN_BAUFRIST` sind Schalter für den Test; kein Workflow setzt sie (`tools/sammler-pruefschritt-waechter.mjs`).

# Frist: Bau 64 s plus Bestandsprüfungen, der Job PR-Datenbau braucht gesamt 2,5 bis 4 min (gemessen 31.10.2026, vier Läufe); dreifache Reserve.
QUELLEN_BAUFRIST_STANDARD=900

quellen_bauprobe() {
  local protokoll status=0
  protokoll="$(mktemp)"
  CI=true timeout "${QUELLEN_BAUFRIST:-$QUELLEN_BAUFRIST_STANDARD}" \
    env -u GH_TOKEN -u GITHUB_TOKEN bash -c "${QUELLEN_BAUBEFEHL:-npm run data:bauprobe}" > "$protokoll" 2>&1 || status=$?
  cat "$protokoll" >&2
  git reset --hard HEAD --quiet
  git clean -fdq -- public
  if [ "$status" = 0 ]; then
    rm -f "$protokoll"
    return 0
  fi
  if [ "$status" = 124 ]; then
    echo "Der Probebau brauchte länger als ${QUELLEN_BAUFRIST:-$QUELLEN_BAUFRIST_STANDARD} s und wurde abgebrochen."
  else
    echo "Der Probebau (Datensatz bauen, Bestandsprüfungen) endete mit Exit $status:"
    tail -n 8 "$protokoll"
  fi
  rm -f "$protokoll"
  return 1
}
