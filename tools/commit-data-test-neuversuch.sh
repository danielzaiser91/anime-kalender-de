# Szenarien der Neuversuch-Verkürzung (24.10.2026, `tools/neuversuch.sh`) für `tools/commit-data-test.sh`, das diese Datei einbindet
# und `szenario`, `pruefe`, `im_fernstand` und (aus der Quarantäne-Datei) `aufrufe` mitbringt.
# Der erste Versuch läuft ganz durch (der Fernstand hat sich schon vor dem Start bewegt, fremd.txt = Code), der Push wird abgelehnt,
# und in der Pause bewegt sich der Fernstand um PAUSE_DATEI. Was der zweite Versuch noch tut, steht im npm-Protokoll.

# Fernstand-Inhalt einer Datei, Zeilenumbrüche entfernt.
inhalt_fern() { git -C "$ORIGIN" show "main:$1" 2> /dev/null | tr -d '\n'; }

echo "Neuversuch, Fernstand bewegt nur Bot-Dateien ohne Leser: kein Bau, keine Prüfung, Erzeugnisse und Fremdstand kommen mit"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 PAUSE_DATEI=data/abruf-stempel.json szenario nv-nichts
pruefe "nichts: Versuch 2 gepusht, Exit 0" "ja 0" "$(grep -q '^Gepusht (Versuch 2)' "$ARBEIT/nv-nichts/log.txt" && echo ja || echo nein) $CODE"
pruefe "nichts: Bau nur einmal" 1 "$(aufrufe nv-nichts data:build)"
pruefe "nichts: check:bestand nur einmal" 1 "$(aufrufe nv-nichts check:bestand)"
pruefe "nichts: check:logic nur einmal" 1 "$(aufrufe nv-nichts check:logic)"
pruefe "nichts: Log nennt den Grund" ja "$(grep -q 'nur Bot-Dateien ohne Leser' "$ARBEIT/nv-nichts/log.txt" && echo ja || echo nein)"
pruefe "nichts: Bot-Datei des Fernstands bleibt" pause "$(inhalt_fern data/abruf-stempel.json)"
pruefe "nichts: Erzeugnis aus Versuch 1 gepusht" '{"neu":true}' "$(inhalt_fern public/data/titles.json)"
pruefe "nichts: Quelle gepusht" ja "$(quelle_gepusht)"

echo "Neuversuch, Fernstand bewegt nur Datenpfade: neu bauen und check:bestand, aber nicht check:logic"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 PAUSE_DATEI=public/data/fremd.json szenario nv-daten
pruefe "daten: Versuch 2 gepusht, Exit 0" "ja 0" "$(grep -q '^Gepusht (Versuch 2)' "$ARBEIT/nv-daten/log.txt" && echo ja || echo nein) $CODE"
pruefe "daten: Bau zweimal" 2 "$(aufrufe nv-daten data:build)"
pruefe "daten: check:bestand zweimal" 2 "$(aufrufe nv-daten check:bestand)"
pruefe "daten: check:logic nur einmal" 1 "$(aufrufe nv-daten check:logic)"
pruefe "daten: Log nennt die Auslassung" ja "$(grep -q 'check:logic übersprungen' "$ARBEIT/nv-daten/log.txt" && echo ja || echo nein)"

echo "Neuversuch, Fernstand bewegt Code: volle Kette"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 PAUSE_DATEI=tools/anderes.txt szenario nv-code
pruefe "code: Versuch 2 gepusht, Exit 0" "ja 0" "$(grep -q '^Gepusht (Versuch 2)' "$ARBEIT/nv-code/log.txt" && echo ja || echo nein) $CODE"
pruefe "code: Bau zweimal" 2 "$(aufrufe nv-code data:build)"
pruefe "code: check:bestand zweimal" 2 "$(aufrufe nv-code check:bestand)"
pruefe "code: check:logic zweimal" 2 "$(aufrufe nv-code check:logic)"

echo "Neuversuch nach einem nicht grünen Versuch 1 (Prüfliste scheitert, Bestand rot): auch bei Bot-Dateien volle Kette"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 PAUSE_DATEI=data/abruf-stempel.json szenario nv-liste FAKE_LISTE=einmal FAKE_ZAEHLER="$ARBEIT/nv-liste/zaehler"
pruefe "Liste: Bau zweimal" 2 "$(aufrufe nv-liste data:build)"
pruefe "Liste: check:logic zweimal" 2 "$(aufrufe nv-liste check:logic)"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 PAUSE_DATEI=data/abruf-stempel.json szenario nv-bestand FAKE_BESTAND=fail
pruefe "Bestand rot: Bau zweimal" 2 "$(aufrufe nv-bestand data:build)"
pruefe "Bestand rot: check:bestand zweimal" 2 "$(aufrufe nv-bestand check:bestand)"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 PAUSE_DATEI=data/abruf-stempel.json szenario nv-logik FAKE_LOGIK=fail
pruefe "Logik rot: check:logic zweimal" 2 "$(aufrufe nv-logik check:logic)"
