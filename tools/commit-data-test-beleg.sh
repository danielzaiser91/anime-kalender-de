# Szenarien des Logik-Belegs (26.10.2026, `tools/logik-beleg.mjs`) für `tools/commit-data-test.sh`, das diese Datei einbindet
# und `szenario`, `pruefe`, `aufrufe`, `bau_szenario` mitbringt.
# Der Bau-Commit trägt „Logik-geprueft: <Abdruck>“ nur, wenn check:logic für genau diesen Inhalt grün war; ein Klon des Fernstands
# bestätigt mit `logik-beleg.mjs gueltig` (so liest es der Deploy), dass der Beleg dort gilt.

# Beleg-Zeile des obersten Commits im Fernstand (leer, wenn keine).
beleg_im_fernstand() {
  local zeile
  zeile="$(git -C "$ORIGIN" log -1 --format=%B main 2> /dev/null | grep -o '^Logik-geprueft: [0-9a-f]\{64\}$')" || zeile=""
  echo "$zeile"
}
# ja, wenn der Deploy-Schritt „Logik-Beleg“ im Klon des Fernstands den Beleg anerkennt.
deploy_erkennt() {
  rm -rf "$ARBEIT/$1/klon" "$ARBEIT/$1/ausgabe.txt"
  git clone -q "$ORIGIN" "$ARBEIT/$1/klon" 2> /dev/null
  (cd "$ARBEIT/$1/klon" && GITHUB_OUTPUT="$ARBEIT/$1/ausgabe.txt" node tools/logik-beleg.mjs gueltig > /dev/null 2>&1)
  grep -qs '^gueltig=1$' "$ARBEIT/$1/ausgabe.txt" && echo ja || echo nein
}

echo "Logik-Beleg: grüner Bau-Lauf ohne Vorprüfung fährt check:logic einmal und schreibt den Beleg in den Commit"
bau_szenario beleg-eigen
pruefe "Exit 0" 0 "$CODE"
pruefe "check:logic einmal" 1 "$(aufrufe beleg-eigen check:logic)"
BELEG_EIGEN="$(beleg_im_fernstand)"
pruefe "Commit trägt die Beleg-Zeile" ja "$([ -n "$BELEG_EIGEN" ] && echo ja || echo nein)"
pruefe "der Deploy erkennt den Beleg im Klon" ja "$(deploy_erkennt beleg-eigen)"

echo "Logik-Beleg: die Vorprüfung hat denselben Inhalt schon grün geprüft: check:logic entfällt, der Beleg bleibt"
mkdir -p "$ARBEIT/beleg-vor"
printf '%s' "${BELEG_EIGEN#Logik-geprueft: }" > "$ARBEIT/beleg-vor/gruen.txt"
bau_szenario beleg-vor LOGIK_GRUEN_DATEI="$ARBEIT/beleg-vor/gruen.txt"
pruefe "Exit 0" 0 "$CODE"
pruefe "check:logic nicht gefahren" 0 "$(aufrufe beleg-vor check:logic)"
pruefe "check:bestand trotzdem gefahren" 1 "$(aufrufe beleg-vor check:bestand)"
pruefe "Log nennt die Auslassung" ja "$(grep -q 'check:logic übersprungen: gleicher Inhalt' "$ARBEIT/beleg-vor/log.txt" && echo ja || echo nein)"
pruefe "Commit trägt denselben Beleg" "$BELEG_EIGEN" "$(beleg_im_fernstand)"
pruefe "der Deploy erkennt den Beleg im Klon" ja "$(deploy_erkennt beleg-vor)"

echo "Logik-Beleg: die Vorprüfung gilt für anderen Inhalt: check:logic läuft"
mkdir -p "$ARBEIT/beleg-fremd"
printf '%s' "$(printf 'f%.0s' $(seq 1 64))" > "$ARBEIT/beleg-fremd/gruen.txt"
bau_szenario beleg-fremd LOGIK_GRUEN_DATEI="$ARBEIT/beleg-fremd/gruen.txt"
pruefe "Exit 0" 0 "$CODE"
pruefe "check:logic einmal" 1 "$(aufrufe beleg-fremd check:logic)"
pruefe "Commit trägt den Beleg des tatsächlich geprüften Inhalts" "$BELEG_EIGEN" "$(beleg_im_fernstand)"

echo "Logik-Beleg: leere oder fehlende Beleg-Datei: check:logic läuft"
mkdir -p "$ARBEIT/beleg-leer"
: > "$ARBEIT/beleg-leer/gruen.txt"
bau_szenario beleg-leer LOGIK_GRUEN_DATEI="$ARBEIT/beleg-leer/gruen.txt"
pruefe "leere Datei: check:logic einmal" 1 "$(aufrufe beleg-leer check:logic)"
bau_szenario beleg-fehlt LOGIK_GRUEN_DATEI="$ARBEIT/beleg-fehlt/gibt-es-nicht.txt"
pruefe "fehlende Datei: Exit 0, check:logic einmal" "0 1" "$CODE $(aufrufe beleg-fehlt check:logic)"

echo "Logik-Beleg: check:logic rot: kein Beleg im Commit (nur die Quellen gehen hinaus)"
bau_szenario beleg-rot FAKE_LOGIK=fail
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "kein Beleg im Commit" "" "$(beleg_im_fernstand)"
pruefe "der Deploy erkennt keinen Beleg" nein "$(deploy_erkennt beleg-rot)"

echo "Logik-Beleg: check:bestand rot: kein Beleg, check:logic nicht gefahren"
bau_szenario beleg-bestand-rot FAKE_BESTAND=fail
pruefe "kein Beleg im Commit" "" "$(beleg_im_fernstand)"
pruefe "check:logic nicht gefahren" 0 "$(aufrufe beleg-bestand-rot check:logic)"

echo "Logik-Beleg: Abruf-Lauf ohne Bau (NUR_QUELLEN=1): kein Beleg"
szenario beleg-abruf NUR_QUELLEN=1
pruefe "kein Beleg im Commit" "" "$(beleg_im_fernstand)"
