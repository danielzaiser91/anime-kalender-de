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

# Ausgabe des Baus, die nie in einen Commit geht (data:dub-checks, `NIE_COMMITTET` in logik-beleg.mjs): der Handstand liegt im Fernstand, der Lauf überschreibt ihn.
ausgabe_start() { mkdir -p "$1/data" && echo "Handstand" > "$1/data/dub-pruefliste-zurueckgestellt.md"; }
ausgabe_lauf() { echo "Bau: 17 offene Verweise" > "$1/data/dub-pruefliste-zurueckgestellt.md"; }
# Code-Datei, die ein Bau-Schritt schreibt und kein Commit aufnimmt (liegt weder in QUELLEN noch in ERZEUGNISSE).
fremd_lauf() { echo "x" > "$1/tools/bau-ausgabe.mjs"; }

echo "Logik-Beleg: Bau-Ausgabe ohne Commit (überschriebene Handstand-Datei, Fernstand unbewegt): der Beleg bleibt und der Deploy erkennt ihn im Klon"
UNBEWEGT=ja START_EXTRA=ausgabe_start LAUF_EXTRA=ausgabe_lauf bau_szenario beleg-ausgabe
pruefe "Exit 0" 0 "$CODE"
pruefe "der Fernstand behält den Handstand" Handstand "$(git -C "$ORIGIN" show main:data/dub-pruefliste-zurueckgestellt.md)"
pruefe "Commit trägt die Beleg-Zeile" ja "$([ -n "$(beleg_im_fernstand)" ] && echo ja || echo nein)"
pruefe "der Deploy erkennt den Beleg im Klon" ja "$(deploy_erkennt beleg-ausgabe)"

echo "Logik-Beleg: eine andere nie committete Datei außerhalb der Datenpfade: kein Beleg, die Warnung nennt den Pfad im Lauf-Log"
LAUF_EXTRA=fremd_lauf bau_szenario beleg-ungestagt
pruefe "Exit 0" 0 "$CODE"
pruefe "kein Beleg im Commit" "" "$(beleg_im_fernstand)"
pruefe "der Deploy erkennt keinen Beleg" nein "$(deploy_erkennt beleg-ungestagt)"
pruefe "Log nennt den Pfad" ja "$(grep -q '^::warning::Logik-Beleg entfällt, der Commit nähme nicht mit: tools/bau-ausgabe.mjs$' "$ARBEIT/beleg-ungestagt/log.txt" && echo ja || echo nein)"
