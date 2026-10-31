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

echo "Jobfrist (31.10.2026): ein Neuversuch der Art code läuft nur, wenn die Restzeit für Neubau (900 s) und Push (180 s) reicht"
FRIST_JETZT=1000000
NEUVERSUCH_JETZT=$FRIST_JETZT BAU_FRIST_EPOCH=$((FRIST_JETZT + 1079)) VERSUCHE_N=2 szenario nv-frist-knapp
pruefe "Frist 1 s zu knapp: Exit 1" 1 "$CODE"
pruefe "Frist 1 s zu knapp: Log nennt die Restzeit" ja "$(grep -q 'Restzeit des Jobs reicht' "$ARBEIT/nv-frist-knapp/log.txt" && echo ja || echo nein)"
# Ohne einen einzigen npm-Aufruf gibt es kein Protokoll, `aufrufe` druckt dann nichts.
pruefe "Frist 1 s zu knapp: kein Bau" "" "$(aufrufe nv-frist-knapp data:build 2> /dev/null)"
pruefe "Frist 1 s zu knapp: nichts gepusht" nein "$(quelle_gepusht)"
NEUVERSUCH_JETZT=$FRIST_JETZT BAU_FRIST_EPOCH=$((FRIST_JETZT + 1080)) VERSUCHE_N=2 szenario nv-frist-genau
pruefe "Frist genau passend: gepusht, Exit 0" "ja 0" "$(grep -q '^Gepusht (Versuch 1)' "$ARBEIT/nv-frist-genau/log.txt" && echo ja || echo nein) $CODE"
pruefe "Frist genau passend: Bau einmal" 1 "$(aufrufe nv-frist-genau data:build)"
# Verdrahtung (Prüfer A1): Versuch 1 (Art code) läuft mit genau passender Restzeit, bei Versuch 2 (Art daten) ist die Frist überschritten
# und der Neuversuch gehört trotzdem durch. Ersetzte commit-data.sh die Art durch das Literal code, bräche Versuch 2 ab.
# Attrappe `date +%s`: liefert nacheinander die Werte aus FAKE_JETZT_SEQ (jeder Aufruf in commit-data.sh ist einer je Versuch).
DATUM="$ARBEIT/datum-attrappe"
mkdir -p "$DATUM"
cat > "$DATUM/date" <<'SKRIPT'
#!/usr/bin/env bash
if [ "$*" = "+%s" ] && [ -n "${FAKE_JETZT_SEQ:-}" ]; then
  read -ra werte <<< "$FAKE_JETZT_SEQ"
  n=$(cat "$FAKE_JETZT_ZAEHLER" 2> /dev/null || echo 0)
  echo $((n + 1)) > "$FAKE_JETZT_ZAEHLER"
  echo "${werte[$n]:-${werte[${#werte[@]}-1]}}"
  exit 0
fi
exec "$(PATH="${PATH#*"$(dirname "$0")":}" command -v date)" "$@"
SKRIPT
chmod +x "$DATUM/date"
PATH="$DATUM:$PATH" FAKE_JETZT_SEQ="$FRIST_JETZT $((FRIST_JETZT + 5000))" FAKE_JETZT_ZAEHLER="$ARBEIT/datum.n" BAU_FRIST_EPOCH=$((FRIST_JETZT + 1080)) ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 PAUSE_DATEI=public/data/fremd.json szenario nv-frist-daten
pruefe "Frist: Versuch 1 knapp passend, Versuch 2 (daten) nach der Frist: gepusht, Exit 0" "ja 0" "$(grep -q '^Gepusht (Versuch 2)' "$ARBEIT/nv-frist-daten/log.txt" && echo ja || echo nein) $CODE"
# Fehlende Frist im Bau-Lauf (Prüfer A2): Warnung; mit Frist und ohne Bau-Lauf keine.
BAU_LAUF=1 VERSUCHE_N=1 szenario nv-ohne-frist
pruefe "Bau-Lauf ohne Frist: Warnung" ja "$(grep -q '^::warning::BAU_FRIST_EPOCH fehlt' "$ARBEIT/nv-ohne-frist/log.txt" && echo ja || echo nein)"
BAU_LAUF=1 BAU_FRIST_EPOCH=$((FRIST_JETZT + 5000)) NEUVERSUCH_JETZT=$FRIST_JETZT VERSUCHE_N=1 szenario nv-mit-frist
pruefe "Bau-Lauf mit Frist: keine Warnung" nein "$(grep -q 'BAU_FRIST_EPOCH fehlt' "$ARBEIT/nv-mit-frist/log.txt" && echo ja || echo nein)"
VERSUCHE_N=1 szenario nv-handlauf
pruefe "Handlauf ohne Frist: keine Warnung" nein "$(grep -q 'BAU_FRIST_EPOCH fehlt' "$ARBEIT/nv-handlauf/log.txt" && echo ja || echo nein)"
# Reine Entscheidung: Art nichts/daten und fehlende Frist sind nie begrenzt, abgelaufene Frist stoppt code.
zeit() { (source "$WURZEL/tools/neuversuch.sh" && neuversuch_zeit_reicht "$@" && echo ja || echo nein); }
pruefe "Zeit: code, Frist abgelaufen" nein "$(zeit code 999 1000)"
pruefe "Zeit: code, ohne Frist" ja "$(zeit code '' 1000)"
pruefe "Zeit: daten, Frist abgelaufen" ja "$(zeit daten 999 1000)"
pruefe "Zeit: nichts, Frist abgelaufen" ja "$(zeit nichts 999 1000)"
pruefe "Zeit: code, genau 1080 s übrig" ja "$(zeit code 2080 1000)"
pruefe "Zeit: code, 1079 s übrig" nein "$(zeit code 2079 1000)"

echo "Neuversuch nach einem nicht grünen Versuch 1 (Prüfliste scheitert, Bestand rot): auch bei Bot-Dateien volle Kette"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 PAUSE_DATEI=data/abruf-stempel.json szenario nv-liste FAKE_LISTE=einmal FAKE_ZAEHLER="$ARBEIT/nv-liste/zaehler"
pruefe "Liste: Bau zweimal" 2 "$(aufrufe nv-liste data:build)"
# Seit dem Logik-Beleg (26.10.2026) genügt der Abdruck: derselbe Inhalt außerhalb der Datenpfade braucht kein zweites check:logic, auch nach einem nicht grünen Versuch.
pruefe "Liste: check:logic nur einmal (gleicher Abdruck)" 1 "$(aufrufe nv-liste check:logic)"
pruefe "Liste: Log nennt den Beleg" ja "$(grep -q "check:logic übersprungen: gleicher Inhalt" "$ARBEIT/nv-liste/log.txt" && echo ja || echo nein)"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 PAUSE_DATEI=data/abruf-stempel.json szenario nv-bestand FAKE_BESTAND=fail
pruefe "Bestand rot: Bau zweimal" 2 "$(aufrufe nv-bestand data:build)"
pruefe "Bestand rot: check:bestand zweimal" 2 "$(aufrufe nv-bestand check:bestand)"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 PAUSE_DATEI=data/abruf-stempel.json szenario nv-logik FAKE_LOGIK=fail
pruefe "Logik rot: check:logic zweimal" 2 "$(aufrufe nv-logik check:logic)"

echo "Drei Versuche (Prüfer R1 A3): ein roter Versuch 2 darf nicht von einer Bot-Bewegung in Pause 2 überbrückt werden"
ZWEI_ABLEHNEN=ja VERSUCHE_N=3 PAUSE_DATEI="public/data/fremd.json data/abruf-stempel.json" szenario nv3-bestand FAKE_BESTAND=fail-nur-2
pruefe "3 Versuche, Bestand in Versuch 2 rot: Versuch 3 gepusht, Exit 0" "ja 0" "$(grep -q '^Gepusht (Versuch 3)' "$ARBEIT/nv3-bestand/log.txt" && echo ja || echo nein) $CODE"
pruefe "3 Versuche, Bestand rot: Bau dreimal" 3 "$(aufrufe nv3-bestand data:build)"
pruefe "3 Versuche, Bestand rot: check:bestand dreimal" 3 "$(aufrufe nv3-bestand check:bestand)"
pruefe "3 Versuche, Bestand rot: check:logic nur in Versuch 1 (Versuch 3: gleicher Abdruck)" 1 "$(aufrufe nv3-bestand check:logic)"
ZWEI_ABLEHNEN=ja VERSUCHE_N=3 PAUSE_DATEI="public/data/fremd.json data/abruf-stempel.json" szenario nv3-bau FAKE_BAU=fail-nur-2
pruefe "3 Versuche, Bau in Versuch 2 kaputt: Bau dreimal" 3 "$(aufrufe nv3-bau data:build)"
pruefe "3 Versuche, Bau kaputt: check:bestand zweimal (Versuch 1 und 3)" 2 "$(aufrufe nv3-bau check:bestand)"
ZWEI_ABLEHNEN=ja VERSUCHE_N=3 PAUSE_DATEI="fremd.txt data/abruf-stempel.json" bau_szenario nv3-quarantaene FAKE_ROT= FAKE_ROT_NACH_PAUSE=22
pruefe "3 Versuche, Quarantäne in Versuch 2: Versuch 3 baut voll (Bau, Quarantäne-Neubau, Bau, Quarantäne-Neubau)" 5 "$(aufrufe nv3-quarantaene data:build)"
