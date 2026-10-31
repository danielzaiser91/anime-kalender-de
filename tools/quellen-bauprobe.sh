#!/usr/bin/env bash
#
# Probebau eines Funds vor dem Einreichen (31.10.2026). Anlass: PR 2524 (Lauf auf Abruf, data:cartoons) kam ohne Bau auf `main`
# (Daten-PRs überspringen die Kette, der App-Merge ist ein Bypass); der Bestandsbau war danach über Stunden rot.
#
# Wird mit `source` geladen (`quellen-pr.sh`) und läuft nur, wenn der Einreicher es verlangt (`QUELLEN_BAUPROBE=1`, Eingabe `bauprobe` der Aktion einreichen).
# `quellen_bauprobe` läuft auf dem Stand, der eingereicht wird (HEAD = Fund-Commit, HEAD^1 = Spitze von main), und fährt `npm run data:bauprobe`:
# Datensatz bauen (dabei prüft `pipeline/lib/pruefung.ts`), „Gemessenes Ja hat einen Weg“ und alle Prüfungen aus `check:bestand` (rot nur was auf main grün ist;
# dieselben Schritte wie der Job PR-Datenbau in pr-pruefung.yml). Rückgabe: Exit 0 = grün; sonst rot, auch bei Frist oder Absturz, der Grund steht auf stdout.
# Der Bau schreibt `public/data` im Arbeitsbaum; der Fund ist committet, danach wird alles Getrackte zurückgesetzt.
#
# **Basis-Vergleich (A2, 31.10.2026):** Scheitert der Bau auf dem Fund (nicht an der Frist), läuft derselbe Bau (`data:bauprobe-basis`) auf HEAD^1. Scheitert er dort
# auch, ist das Rot von `main` geerbt: der Fund wird eingereicht und gemergt (Warnung „main ist schon rot“). Ein rotes `main` hält so nicht jeden Fund an, und ein Fund,
# der `main` repariert, kommt durch. Binär (Bau grün oder rot), nicht je Fehler: ein neuer Fehler neben einem alten von `main` fällt nicht auf; tragbar, weil `main`
# dann ohnehin rot und im Bestandsbau sichtbar ist. Lässt sich die Basis nicht bauen (Arbeitsbaum, Frist), bleibt der Fund rot.
#
# `QUELLEN_BAUBEFEHL`, `QUELLEN_BAUBASISBEFEHL`, `QUELLEN_BAUFRIST` und `QUELLEN_BAUBASISFRIST` sind Schalter für den Test; kein Workflow setzt sie (`tools/sammler-pruefschritt-waechter.mjs`).

# Frist: Bau 64 s plus Bestandsprüfungen, der Job PR-Datenbau braucht gesamt 2,5 bis 4 min (gemessen 31.10.2026, vier Läufe); dreifache Reserve.
QUELLEN_BAUFRIST_STANDARD=900
# Basis: nur Bau und „Gemessenes Ja hat einen Weg“, gemessen 31.10.2026 rund 70 s im Job PR-Datenbau; achtfache Reserve.
QUELLEN_BAUBASISFRIST_STANDARD=600

# Dieselbe Prüfung auf HEAD^1 (eigener Arbeitsbaum, node_modules und Cache verlinkt). Exit 0 = grün, 1 = rot (geerbt), jeder andere Wert = nicht vergleichbar
# (kein Arbeitsbaum = 2, Frist = 124, Absturz).
quellen_bauprobe_basis() {
  local dir status=2
  dir="$(mktemp -d)"
  if git worktree add --detach --quiet "$dir/main" HEAD^1 >&2; then
    if [ -e node_modules ]; then ln -s "$PWD/node_modules" "$dir/main/node_modules"; fi
    if [ -e data/cache ]; then ln -s "$PWD/data/cache" "$dir/main/data/cache"; fi
    status=0
    (
      cd "$dir/main" || exit 2
      CI=true timeout "${QUELLEN_BAUBASISFRIST:-$QUELLEN_BAUBASISFRIST_STANDARD}" \
        env -u GH_TOKEN -u GITHUB_TOKEN bash -c "${QUELLEN_BAUBASISBEFEHL:-npm run data:bauprobe-basis}" >&2
    ) || status=$?
    rm -f "$dir/main/node_modules" "$dir/main/data/cache"
    git worktree remove --force "$dir/main" >&2
  else
    echo "Kein Arbeitsbaum für HEAD^1; der Vergleich gilt ohne Basis." >&2
  fi
  rm -rf "$dir"
  return "$status"
}

quellen_bauprobe() {
  local protokoll status=0 basis=0
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
    rm -f "$protokoll"
    return 1
  fi
  quellen_bauprobe_basis || basis=$?
  if [ "$basis" = 1 ]; then
    echo "::warning title=main ist schon rot::Der Bau scheitert auch auf main (HEAD^1); der Fund bringt keinen neuen Bauabbruch und wird wie bisher eingereicht." >&2
    rm -f "$protokoll"
    return 0
  fi
  echo "Der Probebau (Datensatz bauen, Bestandsprüfungen) endete mit Exit $status:"
  tail -n 8 "$protokoll"
  rm -f "$protokoll"
  return 1
}
