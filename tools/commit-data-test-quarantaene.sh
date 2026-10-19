# Szenarien der Titel-Quarantäne (18.10.2026, `tools/quarantaene.mjs`) für `tools/commit-data-test.sh`, das diese Datei einbindet
# und `szenario`, `pruefe` und `im_fernstand` mitbringt. FAKE_ROT nennt die roten Titel der Attrappe (Gruppen durch Komma).

# Zählt die Zeilen im npm-Protokoll des Szenarios, die das Muster enthalten.
aufrufe() { grep -c -- "$2" "$ARBEIT/$1/npm.txt" || true; }
# ja, wenn DATEN_WARNUNG des Szenarios das Muster enthält.
warnt() { grep -q -- "^DATEN_WARNUNG=.*$2" "$ARBEIT/$1/env.txt" 2> /dev/null && echo ja || echo nein; }
# Ein Bau-Lauf mit eigener GITHUB_ENV-Datei.
bau_szenario() {
  local name="$1"
  shift
  mkdir -p "$ARBEIT/$name"
  szenario "$name" BAU_LAUF=1 GITHUB_ENV="$ARBEIT/$name/env.txt" "$@"
}
rot() { [ "$CODE" -ne 0 ] && echo ja || echo nein; }
zurueckgestellt_im_fernstand() { git -C "$ORIGIN" show main:public/data/meta.json 2> /dev/null | grep -o '"titleId":[-0-9]*' | cut -d: -f2 | tr '\n' ' '; }

echo "Quarantäne: Bau-Lauf ohne roten Titel bleibt grün ohne Warnung, die Kalender-Grenzen werden festgeschrieben"
bau_szenario q-sauber
pruefe "Exit 0" 0 "$CODE"
pruefe "kein Neubau ohne Titel" 0 "$(aufrufe q-sauber 'data:build  *q=ja')"
pruefe "Historie-Zeile bleibt" 0 "$(aufrufe q-sauber 'data:historie')"
pruefe "keine Warnung" nein "$(warnt q-sauber 'zurückgestellt')"
pruefe "Kalender-Grenzen festgeschrieben" 1 "$(aufrufe q-sauber 'check:kalender-plausibilitaet -- --festschreiben')"

echo "Quarantäne: ein roter Titel mit Kennung wird zurückgestellt, der Rest geht aus, der Lauf ist gelb"
bau_szenario q-einer FAKE_ROT=22
pruefe "Exit 0" 0 "$CODE"
pruefe "ein Neubau ohne den Titel" 1 "$(aufrufe q-einer 'data:build  *q=ja')"
pruefe "Arbeitslisten nach dem Neubau" 1 "$(aufrufe q-einer 'data:start-liste')"
pruefe "Historie-Zeile des ersten Baus ersetzt (einmal)" 1 "$(aufrufe q-einer 'data:historie -- --ersetzen')"
pruefe "Erzeugnis gepusht" ja "$(im_fernstand public/data/titles.json)"
pruefe "meta.json nennt den Titel" "22 " "$(zurueckgestellt_im_fernstand)"
pruefe "Warnung nennt Titel und Prüfung" ja "$(warnt q-einer '1 Titel zurückgestellt: 22 (probe)')"
pruefe "Kalender-Grenzen bleiben stehen" 0 "$(aufrufe q-einer 'check:kalender-plausibilitaet -- --festschreiben')"
pruefe "Neubau beginnt beim committeten Stand ohne Reste" 'q=ja {"stand":"alt"} stand.json ' "$(grep '^q=ja' "$ARBEIT/q-einer/vorbau.txt")"
pruefe "Log zeigt die rote Runde und das Gate" 2 "$(grep -c -e 'FEHLER: Titel 22 rot' -e 'Quarantäne: 1 Titel zurückgestellt: 22 (probe)' "$ARBEIT/q-einer/log.txt")"

echo "Quarantäne: zeigt der Neubau einen weiteren Titel, kommt er dazu (zwei Runden)"
bau_szenario q-zwei FAKE_ROT="22,33"
pruefe "Exit 0" 0 "$CODE"
pruefe "zwei Neubauten" 2 "$(aufrufe q-zwei 'data:build  *q=ja')"
pruefe "meta.json nennt beide" "22 33 " "$(zurueckgestellt_im_fernstand)"
pruefe "Historie-Zeile nur beim grünen Neubau ersetzt (nicht je Runde)" 1 "$(aufrufe q-zwei 'data:historie -- --ersetzen')"
pruefe "Warnung nennt beide" ja "$(warnt q-zwei '2 Titel zurückgestellt: 22 (probe), 33 (probe)')"

echo "Quarantäne: genau drei Titel auf einmal sind erlaubt"
bau_szenario q-drei FAKE_ROT="11 22 33"
pruefe "Exit 0" 0 "$CODE"
pruefe "meta.json nennt alle drei" "11 22 33 " "$(zurueckgestellt_im_fernstand)"

echo "Quarantäne: Fehler ohne Kennung sperren wie bisher, ohne Neubau"
bau_szenario q-ohne FAKE_BESTAND=fehler
pruefe "Exit ≠ 0" ja "$(rot)"
pruefe "kein Neubau ohne Titel" 0 "$(aufrufe q-ohne 'data:build  *q=ja')"
pruefe "gesperrt: Historie nicht angefasst (der Bau-Lauf nimmt sie zurück)" 0 "$(aufrufe q-ohne 'data:historie')"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"
pruefe "Warnung nennt die Sperre" ja "$(warnt q-ohne 'keine Quarantäne: die Fehler tragen keine neue Titel-Kennung')"

echo "Quarantäne: bleibt nach dem Zurückstellen ein Fehler ohne Kennung (Struktur), wird gesperrt"
bau_szenario q-struktur FAKE_ROT=22 FAKE_STRUKTUR=ja
pruefe "Exit ≠ 0" ja "$(rot)"
pruefe "ein Neubau versucht" 1 "$(aufrufe q-struktur 'data:build  *q=ja')"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"
pruefe "Warnung nennt Fehler und Sperre" ja "$(warnt q-struktur 'Struktur ohne Kennung .*keine neue Titel-Kennung')"

echo "Quarantäne: check:logic rot (ohne Kennung) sperrt auch nach dem Zurückstellen"
bau_szenario q-logik FAKE_ROT=22 FAKE_LOGIK=fail
pruefe "Exit ≠ 0" ja "$(rot)"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"

echo "Quarantäne: vier Titel auf einmal sperren"
bau_szenario q-vier FAKE_ROT="11 22 33 44"
pruefe "Exit ≠ 0" ja "$(rot)"
pruefe "kein Neubau ohne Titel" 0 "$(aufrufe q-vier 'data:build  *q=ja')"
pruefe "Warnung nennt die Obergrenze" ja "$(warnt q-vier '4 Titel betroffen, zurückgestellt werden höchstens 3')"

echo "Quarantäne: der vierte Titel in der zweiten Runde sperrt ebenfalls"
bau_szenario q-vier-spaet FAKE_ROT="11 22,33,44"
pruefe "Exit ≠ 0" ja "$(rot)"
pruefe "zwei Neubauten" 2 "$(aufrufe q-vier-spaet 'data:build  *q=ja')"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"

echo "Quarantäne: ein Cartoon (negative Kennung) wird nicht zurückgestellt"
bau_szenario q-cartoon FAKE_ROT="22 -5"
pruefe "Exit ≠ 0" ja "$(rot)"
pruefe "Warnung nennt den Cartoon" ja "$(warnt q-cartoon 'nur Anime-Titel, nicht -5')"

echo "Quarantäne: scheitert der Neubau ohne die Titel, wird gesperrt"
bau_szenario q-neubau FAKE_ROT=22 FAKE_BAU=neubau
pruefe "Exit ≠ 0" ja "$(rot)"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"
pruefe "Warnung nennt den Neubau" ja "$(warnt q-neubau 'Neubau ohne die Titel ist gescheitert')"

echo "Quarantäne: nur im Bau-Lauf — ein Sammler-Lauf sperrt wie bisher"
szenario q-sammler FAKE_ROT=22
pruefe "Exit ≠ 0" ja "$(rot)"
pruefe "kein Neubau ohne Titel" 0 "$(aufrufe q-sammler 'data:build  *q=ja')"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"

echo "Quarantäne: scheitert der Push, beginnt Versuch 2 ohne die Liste aus Versuch 1 (derselbe Titel bleibt rot)"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 bau_szenario q-neuversuch FAKE_ROT=22
pruefe "Exit 0" 0 "$CODE"
pruefe "Versuch 2 gepusht" ja "$(grep -q '^Gepusht (Versuch 2)' "$ARBEIT/q-neuversuch/log.txt" && echo ja || echo nein)"
pruefe "meta.json nennt den Titel" "22 " "$(zurueckgestellt_im_fernstand)"

echo "Quarantäne: ist in Versuch 2 ein anderer Titel rot, wird nur dieser zurückgestellt"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 bau_szenario q-neuversuch-anders FAKE_ROT=22 FAKE_ROT_NACH_PAUSE=33
pruefe "Exit 0" 0 "$CODE"
pruefe "meta.json nennt nur den neuen Titel" "33 " "$(zurueckgestellt_im_fernstand)"
pruefe "Warnung nennt nur den neuen Titel" ja "$(warnt q-neuversuch-anders ': 33 (probe)$')"

echo "Quarantäne: Titel aus Versuch 1 zählen in Versuch 2 nicht auf die Obergrenze"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 bau_szenario q-neuversuch-grenze FAKE_ROT="11 22" FAKE_ROT_NACH_PAUSE="33 44"
pruefe "Exit 0, meta.json nennt die zwei neuen" "0 33 44 " "$CODE $(zurueckgestellt_im_fernstand)"

echo "Quarantäne: ist in Versuch 2 nichts mehr rot, gilt die Warnung aus Versuch 1 nicht mehr, die frühere bleibt"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 bau_szenario q-neuversuch-gruen FAKE_ROT=22 FAKE_ROT_NACH_PAUSE="" DATEN_WARNUNG=vorher
pruefe "Exit 0, nichts zurückgestellt, letzte Warnung wie vor dem Lauf" "0 DATEN_WARNUNG=vorher" "$CODE $(zurueckgestellt_im_fernstand)$(grep '^DATEN_WARNUNG=' "$ARBEIT/q-neuversuch-gruen/env.txt" | tail -n 1)"
