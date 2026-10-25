#!/usr/bin/env bash
#
# Simulationstest für `tools/commit-data.sh` mit einem Attrappe-`npm` (kein echter Bau, kein Netz).
# Anlass (12.10.2026): Bei gescheitertem `data:build` endete das Skript mit Exit 0 — der Lauf blieb grün,
# `deploy.yml` (startet nur bei success) lieferte nichts aus, niemand sah es. Seit PR 866 gilt dasselbe
# schon für eine verletzte Zusicherung (`check:bestand`); beide Ausgänge sind hier festgehalten.
#
# Aufruf: bash tools/commit-data-test.sh   (Exit 0 = alles grün; `tools/commit-data.test.mjs` ruft es in `check:workflows` auf)

set -uo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARBEIT="$(mktemp -d)"
trap 'rm -rf "$ARBEIT"' EXIT
FEHLER=0
# Keine CRLF-Warnungen der Windows-Git-Voreinstellung im Testprotokoll.
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.autocrlf GIT_CONFIG_VALUE_0=false

pruefe() {
  if [ "$2" = "$3" ]; then
    echo "  ✓ $1"
  else
    echo "  ✗ $1 — erwartet: $2, gefunden: $3"
    FEHLER=$((FEHLER + 1))
  fi
}

# Attrappe: `npm run <skript>`. FAKE_BAU und FAKE_BESTAND steuern, ob data:build bzw. check:bestand scheitern.
ATTRAPPE="$ARBEIT/attrappe"
mkdir -p "$ATTRAPPE"
cat > "$ATTRAPPE/npm" <<'SKRIPT'
#!/usr/bin/env bash
# Jeder Aufruf landet im Protokoll des Szenarios (Arbeitsordner ist <szenario>/lauf), samt Quarantäne-Liste des Baus.
echo "$2 ${3:-} ${4:-} q=${BAU_QUARANTAENE:+ja}" >> ../npm.txt
case "$2" in
  data:build)
    [ "${FAKE_BAU:-ok}" = fail ] && { echo "✖ Titelschwund"; exit 1; }
    # fail-nur-2: nur der zweite Aufruf scheitert (Neuversuch-Szenarien mit drei Versuchen).
    [ "${FAKE_BAU:-ok}" = fail-nur-2 ] && [ "$(grep -c '^data:build' ../npm.txt)" = 2 ] && { echo "✖ Titelschwund (zweiter Bau)"; exit 1; }
    [ "${FAKE_BAU:-ok}" = neubau ] && [ -n "${BAU_QUARANTAENE:-}" ] && { echo "✖ Neubau"; exit 1; }
    # Vorstand des Baus: Inhalt der committeten stand.json und alle Dateien in public/data (der Neubau beginnt ohne Reste des ersten).
    echo "q=${BAU_QUARANTAENE:+ja} $(cat public/data/stand.json 2> /dev/null) $(ls public/data 2> /dev/null | tr '\n' ' ')" >> ../vorbau.txt
    mkdir -p public/data public/og
    echo '{"neu":true}' > public/data/titles.json
    echo '{"stand":"gebaut"}' > public/data/stand.json
    echo bild > public/og/a.txt
    # Wie `vermerkeQuarantaene`: die zurückgestellten Titel stehen in meta.json, ohne Liste fehlt das Feld.
    liste="${BAU_QUARANTAENE:-}"
    if [ -n "$liste" ] && command -v cygpath > /dev/null; then
      liste="$(cygpath -w "$liste")"
    fi
    node -e 'const fs = require("fs"); const p = process.argv[1]; const q = p ? JSON.parse(fs.readFileSync(p, "utf8")) : []; fs.writeFileSync("public/data/meta.json", JSON.stringify(q.length ? { quarantaene: q } : {}))' "$liste"
    [ "${FAKE_BAU:-ok}" = ohne-titles ] && rm public/data/titles.json && echo '{}' > public/data/woche.json
    [ "${FAKE_BAU:-ok}" = ohne-og ] && rm -r public/og
    ;;
  data:extension-liste)
    [ "${FAKE_LISTE:-ok}" = fail ] && { echo "Prüfstand-Abbruch"; exit 1; }
    # `einmal`: nur der erste Aufruf scheitert (FAKE_ZAEHLER merkt ihn sich).
    if [ "${FAKE_LISTE:-ok}" = einmal ] && [ ! -e "$FAKE_ZAEHLER" ]; then : > "$FAKE_ZAEHLER"; echo "Prüfstand-Abbruch (erster Aufruf)"; exit 1; fi
    ;;
  check:bestand)
    [ "${FAKE_BESTAND:-ok}" = fail ] && { echo "✗ Handbeleg ohne Titel"; exit 1; }
    [ "${FAKE_BESTAND:-ok}" = fail-nur-2 ] && [ "$(grep -c '^check:bestand' ../npm.txt)" = 2 ] && { echo "✗ Handbeleg ohne Titel (zweite Prüfung)"; exit 1; }
    [ "${FAKE_BESTAND:-ok}" = fehler ] && { echo "FEHLER: Cover fehlt bei Titel 7"; exit 1; }
    [ "${FAKE_BESTAND:-ok}" = gemischt ] && { printf '⚠ Hinweis eins\n⚠ Hinweis zwei\n⚠ Hinweis drei\nFEHLER: Cover fehlt bei Titel 9\n'; exit 1; }
    [ "${FAKE_BESTAND:-ok}" = warnzeichen ] && { printf '⚠ Hinweis eins\n⚠ Hinweis zwei\n⚠ Hinweis drei\n  ✗ Netflix-Liste enthält Cartoon-Adressen — 89\n'; exit 1; }
    # Grüner Lauf mit Warnzeile weit vor den letzten drei Zeilen (tail -3 zeigt sie sonst nicht).
    [ "${FAKE_BESTAND:-ok}" = adn-warnung ] && { printf '  ⚠ WARNUNG ADN-Titelliste: 2 Serie(n) mit „titelliste-fehlt“\n  ✓ a\n  ✓ b\n  ✓ c\n'; exit 0; }
    # Zeilen mit mehreren Marken: jede steht genau einmal im Grund.
    [ "${FAKE_BESTAND:-ok}" = doppelt-a ] && { printf 'FEHLER: a ✗ ⚠\n✖ b ⚠\n⚠ c\n'; exit 1; }
    [ "${FAKE_BESTAND:-ok}" = doppelt-b ] && { printf '✗ b ⚠\n⚠ c\n'; exit 1; }
    [ "${FAKE_BESTAND:-ok}" = doppelt-c ] && { printf 'FEHLER: d ⚠\n⚠ c\n'; exit 1; }
    # FAKE_ROT: Gruppen roter Titel ("11 22,33"), je Titel eine Marke; rot ist die erste Gruppe, die noch nicht zurückgestellt ist.
    # FAKE_ROT_NACH_PAUSE: rote Titel, sobald der Fernstand in der Pause bewegt wurde (Versuch 2).
    grep -qs pause fremd.txt && FAKE_ROT="${FAKE_ROT_NACH_PAUSE-$FAKE_ROT}"
    zurueck=" $(grep -o '"titleId":[-0-9]*' public/data/meta.json 2> /dev/null | cut -d: -f2 | tr '\n' ' ') "
    IFS=, read -ra gruppen <<< "${FAKE_ROT:-}"
    for gruppe in "${gruppen[@]}"; do
      rot=0
      for id in $gruppe; do
        case "$zurueck" in
          *" $id "*) ;;
          *)
            echo '  QUARANTAENE {"titleId":'"$id"',"pruefung":"probe","grund":"rot an '"$id"'"}'
            echo "FEHLER: Titel $id rot"
            rot=1
            ;;
        esac
      done
      [ "$rot" = 1 ] && exit 1
    done
    [ "${FAKE_STRUKTUR:-nein}" = ja ] && { echo "FEHLER: Struktur ohne Kennung"; exit 1; }
    ;;
  check:logic)
    [ "${FAKE_LOGIK:-ok}" = fail ] && { echo "✖ Logik ohne Kennung"; exit 1; }
    ;;
esac
exit 0
SKRIPT
chmod +x "$ATTRAPPE/npm"

# Attrappe `sleep`: kein Warten zwischen den Versuchen. Mit NACH_PAUSE (Klon eines anderen Pushers) bewegt sie in der Pause den Fernstand.
cat > "$ATTRAPPE/sleep" <<'SKRIPT'
#!/usr/bin/env bash
if [ -n "${NACH_PAUSE:-}" ]; then
  # PAUSE_DATEI nennt eine Datei oder eine Liste (Leerzeichen): die n-te Pause bewegt die n-te, danach bleibt es bei der letzten.
  n=$(cat "$NACH_PAUSE.n" 2> /dev/null || echo 0)
  echo $((n + 1)) > "$NACH_PAUSE.n"
  read -ra pausen <<< "${PAUSE_DATEI:-fremd.txt}"
  ziel="${pausen[$n]:-${pausen[${#pausen[@]}-1]}}"
  mkdir -p "$(dirname "$NACH_PAUSE/$ziel")"
  echo "pause" >> "$NACH_PAUSE/$ziel"
  git -C "$NACH_PAUSE" add -A
  git -C "$NACH_PAUSE" -c user.name=t -c user.email=t@t commit -q -m pause
  git -C "$NACH_PAUSE" push -q origin HEAD:main
fi
exit 0
SKRIPT
chmod +x "$ATTRAPPE/sleep"

# Ein Szenario: frisches Repo, der Fernstand hat sich bewegt (das löst den Neuaufbau-Zweig aus), der Lauf hat data/anisearch.json geändert.
# Wahlschalter (Umgebung des Aufrufs): UNBEWEGT=ja (Fernstand bleibt, `public/` liegt schon im Repo), OHNE_TITLES=ja (Lauf löscht titles.json),
# ERSTEN_ABLEHNEN=ja (Bare-Repo lehnt den ersten Push ab, in der Pause bewegt sich der Fernstand), VERSUCHE_N (Versuche, Standard 1).
# Ergebnis in $CODE (Exit des Skripts) und $ORIGIN (Fernstand zum Nachsehen).
szenario() {
  local name="$1"
  shift
  local d="$ARBEIT/$name"
  mkdir -p "$d"
  ORIGIN="$d/origin.git"
  git init -q --bare -b main "$ORIGIN"
  git clone -q "$ORIGIN" "$d/start" 2>/dev/null
  mkdir -p "$d/start/tools" "$d/start/data"
  for datei in commit-data.sh quellen-liste.sh quellen-aufsetzen.sh health-vereinen.mjs dub-belege-vereinen.mjs quarantaene.mjs neuversuch.sh neuversuch-art.mjs pr-nachrechnen.mjs pr-nachrechnen-bot-pfade.mjs; do
    cp "$WURZEL/tools/$datei" "$d/start/tools/$datei"
  done
  # js-yaml für dub-belege-vereinen: ohne scheitert quellen_aufsetzen jetzt laut.
  mkdir -p "$d/start/node_modules" && cp -r "$WURZEL/node_modules/js-yaml" "$d/start/node_modules/"
  echo '{"v":1}' > "$d/start/data/anisearch.json"
  mkdir -p "$d/start/public/data"
  echo '{"stand":"alt"}' > "$d/start/public/data/stand.json"
  echo '{"zuletzt":"alt"}' > "$d/start/data/meldungen-uebernahme.json"
  if [ "${UNBEWEGT:-nein}" = ja ]; then
    mkdir -p "$d/start/public/data" "$d/start/public/og"
    echo '{}' > "$d/start/public/data/titles.json"
    echo bild > "$d/start/public/og/a.txt"
  fi
  # START_EXTRA / LAUF_EXTRA: Funktion, die weitere Dateien in den Startstand bzw. den Lauf legt (Argument: Ordner).
  "${START_EXTRA:-:}" "$d/start"
  git -C "$d/start" add -A
  git -C "$d/start" -c user.name=t -c user.email=t@t commit -q -m start
  git -C "$d/start" push -q origin HEAD:main
  git clone -q "$ORIGIN" "$d/lauf" 2>/dev/null
  git clone -q "$ORIGIN" "$d/anderer" 2>/dev/null
  if [ "${UNBEWEGT:-nein}" != ja ]; then
    echo "x" > "$d/anderer/fremd.txt"
    git -C "$d/anderer" add -A
    git -C "$d/anderer" -c user.name=t -c user.email=t@t commit -q -m fremd
    git -C "$d/anderer" push -q origin HEAD:main
  fi
  if [ "${LAUF_AENDERT:-ja}" = ja ]; then
    echo '{"v":2,"von":"lauf"}' > "$d/lauf/data/anisearch.json"
    echo '{"zuletzt":"neu"}' > "$d/lauf/data/meldungen-uebernahme.json"
  fi
  # Gemerkte Quittungen der Datenschritte (pipeline/lib/spaeter-quittieren.ts): frei erst nach grünem Commit.
  LAUF="$d/lauf"
  mkdir -p "$LAUF/data/cache/quittung-offen"
  echo '[1]' > "$LAUF/data/cache/quittung-offen/rohfolgen-abhaken.json"
  echo '[2]' > "$LAUF/data/cache/quittung-offen/pruefungen-abhaken.json"
  "${LAUF_EXTRA:-:}" "$d/lauf"
  [ "${OHNE_TITLES:-nein}" = ja ] && rm "$d/lauf/public/data/titles.json"
  local pause=""
  if [ "${PUSH_SPERRE:-nein}" = ja ]; then
    printf '#!/bin/sh\nexit 1\n' > "$ORIGIN/hooks/pre-receive"
    chmod +x "$ORIGIN/hooks/pre-receive"
  fi
  if [ "${ERSTEN_ABLEHNEN:-nein}" = ja ]; then
    printf '#!/bin/sh\nif [ ! -e schon-abgelehnt ]; then : > schon-abgelehnt; echo "abgelehnt (Test)" >&2; exit 1; fi\n' > "$ORIGIN/hooks/pre-receive"
    chmod +x "$ORIGIN/hooks/pre-receive"
    pause="$d/anderer"
  fi
  # ZWEI_ABLEHNEN=ja: die ersten zwei Pushes scheitern (drei Versuche), in jeder Pause bewegt sich der Fernstand.
  if [ "${ZWEI_ABLEHNEN:-nein}" = ja ]; then
    # Nur Pushes des Bots zählen: die Pausen-Pushes des anderen Pushers (Autor t) gehen immer durch.
    printf '#!/bin/sh\nread alt neu ref\n[ "$(git log -1 --format=%%an "$neu")" = "github-actions[bot]" ] || exit 0\nn=$(cat abgelehnt-n 2>/dev/null || echo 0)\nif [ "$n" -lt 2 ]; then echo $((n+1)) > abgelehnt-n; echo "abgelehnt (Test)" >&2; exit 1; fi\n' > "$ORIGIN/hooks/pre-receive"
    chmod +x "$ORIGIN/hooks/pre-receive"
    pause="$d/anderer"
  fi
  (cd "$d/lauf" && env "$@" NACH_PAUSE="$pause" PATH="$ATTRAPPE:$PATH" bash tools/commit-data.sh "chore(data): test" "${VERSUCHE_N:-1}" > "$d/log.txt" 2>&1)
  CODE=$?
}

frei() { [ -f "$LAUF/data/cache/quittung-frei/$1" ] && echo ja || echo nein; }
offen() { [ -f "$LAUF/data/cache/quittung-offen/$1" ] && echo ja || echo nein; }
im_fernstand() { git -C "$ORIGIN" cat-file -e "main:$1" 2>/dev/null && echo ja || echo nein; }
quelle_gepusht() { git -C "$ORIGIN" show main:data/anisearch.json 2>/dev/null | grep -q '"von":"lauf"' && echo ja || echo nein; }
stempel() { git -C "$ORIGIN" show main:data/meldungen-uebernahme.json 2>/dev/null | tr -d '\n'; }

echo "Aufbau gelingt, Bestand ok: grün, Erzeugnisse und Quellen im Fernstand"
szenario gruen FAKE_BAU=ok FAKE_BESTAND=ok
pruefe "Exit 0" 0 "$CODE"
pruefe "Quelle gepusht" ja "$(quelle_gepusht)"
pruefe "Erzeugnis gepusht" ja "$(im_fernstand public/data/titles.json)"
pruefe "Quittungen freigegeben" "ja ja nein" "$(frei rohfolgen-abhaken.json) $(frei pruefungen-abhaken.json) $(offen rohfolgen-abhaken.json)"
pruefe "Übernahme-Stempel gepusht" '{"zuletzt":"neu"}' "$(stempel)"

echo "Bestandsprüfung grün, aber mit „⚠ WARNUNG“-Zeile hinter dem tail -3: der Lauf zeigt sie als ::warning::"
szenario adnwarnung FAKE_BAU=ok FAKE_BESTAND=adn-warnung
pruefe "Exit 0, Erzeugnis gepusht" "0 ja" "$CODE $(im_fernstand public/data/titles.json)"
pruefe "Anmerkung mit dem Text der Warnung" ja "$(grep -q '^::warning::WARNUNG ADN-Titelliste: 2 Serie(n)' "$ARBEIT/adnwarnung/log.txt" && echo ja || echo nein)"
pruefe "grüner Lauf ohne Warnzeile: keine Anmerkung dazu" nein "$(grep -q 'WARNUNG ADN' "$ARBEIT/gruen/log.txt" && echo ja || echo nein)"

echo "data:build scheitert: rot, Quellen trotzdem gesichert, keine Erzeugnisse"
szenario aufbau FAKE_BAU=fail
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Quittungen nicht freigegeben" "nein ja" "$(frei rohfolgen-abhaken.json) $(offen rohfolgen-abhaken.json)"
pruefe "Quelle gepusht" ja "$(quelle_gepusht)"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"

echo "check:bestand scheitert (Zusicherung, seit PR 866): rot, Quellen gesichert, keine Erzeugnisse"
szenario bestand FAKE_BESTAND=fail
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Quittungen nicht freigegeben" "nein nein" "$(frei rohfolgen-abhaken.json) $(frei pruefungen-abhaken.json)"
pruefe "Quelle gepusht" ja "$(quelle_gepusht)"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"

echo "Prüfung meldet nur mit FEHLER: (Bau-Lauf): DATEN_WARNUNG nennt den Grund"
mkdir -p "$ARBEIT/warnung"
szenario warnung FAKE_BESTAND=fehler BAU_LAUF=1 GITHUB_ENV="$ARBEIT/warnung/env.txt"
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Warnung enthält den Grund" ja "$(grep -q '^DATEN_WARNUNG=.*FEHLER: Cover fehlt bei Titel 7' "$ARBEIT/warnung/env.txt" && echo ja || echo nein)"
pruefe "verworfene Meldungen nicht mehr gemerkt, nichts frei" "nein nein ja" "$(offen pruefungen-abhaken.json) $(frei pruefungen-abhaken.json) $(offen rohfolgen-abhaken.json)"
pruefe "Übernahme-Stempel zurückgenommen" '{"zuletzt":"alt"}' "$(stempel)"

echo "Drei ⚠-Zeilen vor einer FEHLER:-Zeile: DATEN_WARNUNG nennt den Fehler zuerst"
mkdir -p "$ARBEIT/reihenfolge"
szenario reihenfolge FAKE_BESTAND=gemischt BAU_LAUF=1 GITHUB_ENV="$ARBEIT/reihenfolge/env.txt"
pruefe "Warnung beginnt mit dem Fehler" ja "$(grep -q '^DATEN_WARNUNG=.*Bestand nicht übernommen: FEHLER: Cover fehlt bei Titel 9' "$ARBEIT/reihenfolge/env.txt" && echo ja || echo nein)"

echo "NUR_QUELLEN=1 (Abruf-Lauf, kein Bau): grün, nur Quellen"
szenario abruf NUR_QUELLEN=1 FAKE_BAU=fail
pruefe "Exit 0" 0 "$CODE"
pruefe "Quittungen freigegeben" ja "$(frei rohfolgen-abhaken.json)"
pruefe "Quelle gepusht" ja "$(quelle_gepusht)"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"

echo "data:build scheitert und es gibt nichts zu committen: trotzdem rot"
LAUF_AENDERT=nein szenario leer FAKE_BAU=fail
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Quittungen nicht freigegeben" "nein ja" "$(frei rohfolgen-abhaken.json) $(offen rohfolgen-abhaken.json)"

echo "Nichts zu committen, grün: Quittungen freigegeben"
LAUF_AENDERT=nein szenario leer-gruen NUR_QUELLEN=1
pruefe "Exit 0" 0 "$CODE"
pruefe "Keine Änderung erreicht" ja "$(grep -q 'Keine Änderung' "$LAUF/../log.txt" && echo ja || echo nein)"
pruefe "Quittungen freigegeben" ja "$(frei rohfolgen-abhaken.json)"

echo "Push abgelehnt: rot, Quittungen bleiben gesperrt"
PUSH_SPERRE=ja szenario push-sperre FAKE_BAU=ok
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Quittungen nicht freigegeben" "nein ja" "$(frei rohfolgen-abhaken.json) $(offen rohfolgen-abhaken.json)"

echo "data:extension-liste scheitert (18.10.2026): rot, Quellen und Erzeugnisse trotzdem gesichert"
szenario liste FAKE_LISTE=fail
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Quelle gepusht" ja "$(quelle_gepusht)"
pruefe "Erzeugnis gepusht" ja "$(im_fernstand public/data/titles.json)"
pruefe "Fehlerzeile im Log" ja "$(grep -q '::error::Die Prüflisten sind nicht neu entstanden' "$ARBEIT/liste/log.txt" && echo ja || echo nein)"

echo "Pflicht-Erzeugnis fehlt nach gelungenem Bau: rot, Quellen gesichert, Fehler im Log"
szenario ohnetitles FAKE_BAU=ohne-titles
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Quelle gepusht" ja "$(quelle_gepusht)"
pruefe "Fehler nennt die Datei" ja "$(grep -q '::error::Pflicht-Erzeugnis fehlt: public/data/titles.json' "$ARBEIT/ohnetitles/log.txt" && echo ja || echo nein)"
szenario ohneog FAKE_BAU=ohne-og
pruefe "ohne public/og: Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "ohne public/og: Fehler nennt den Ordner" ja "$(grep -q '::error::Pflicht-Erzeugnis fehlt: public/og' "$ARBEIT/ohneog/log.txt" && echo ja || echo nein)"

echo "Grüner Lauf: fehlende Quellen bleiben ein Hinweis, kein Pflicht-Fehler"
pruefe "kein Pflicht-Fehler im grünen Lauf" 0 "$(grep -c 'Pflicht-Erzeugnis fehlt' "$ARBEIT/gruen/log.txt" || true)"
pruefe "Pfad-Warnung für Quellen bleibt" ja "$(grep -q '::warning::.*nicht vorhanden' "$ARBEIT/gruen/log.txt" && echo ja || echo nein)"

echo "Üblicher Weg im Bestandsbau (BAU_LAUF=1, Fernstand unbewegt): Pflicht-Erzeugnisse werden auch ohne Neuaufbau geprüft"
UNBEWEGT=ja szenario unbewegt BAU_LAUF=1
pruefe "Erzeugnisse da: Exit 0" 0 "$CODE"
pruefe "Erzeugnisse da: kein Pflicht-Fehler" 0 "$(grep -c 'Pflicht-Erzeugnis fehlt' "$ARBEIT/unbewegt/log.txt" || true)"
UNBEWEGT=ja OHNE_TITLES=ja szenario unbewegt-ohne BAU_LAUF=1
pruefe "titles.json fehlt: Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "titles.json fehlt: Fehler nennt die Datei" ja "$(grep -q '^::error::Pflicht-Erzeugnis fehlt: public/data/titles.json$' "$ARBEIT/unbewegt-ohne/log.txt" && echo ja || echo nein)"
pruefe "titles.json fehlt: Quelle trotzdem gepusht" ja "$(quelle_gepusht)"

echo "Prüfliste scheitert im ersten Versuch, der Push wird abgelehnt, der zweite Versuch baut sauber: grün"
ERSTEN_ABLEHNEN=ja VERSUCHE_N=2 szenario neuversuch FAKE_LISTE=einmal FAKE_ZAEHLER="$ARBEIT/neuversuch/zaehler"
pruefe "Versuch 1 abgelehnt" ja "$(grep -q '^Push abgelehnt (Versuch 1)' "$ARBEIT/neuversuch/log.txt" && echo ja || echo nein)"
pruefe "Versuch 1 meldete die Prüfliste als gescheitert" ja "$(grep -q '^::error::Die Prüflisten sind nicht neu entstanden' "$ARBEIT/neuversuch/log.txt" && echo ja || echo nein)"
pruefe "Versuch 2 gepusht" ja "$(grep -q '^Gepusht (Versuch 2)' "$ARBEIT/neuversuch/log.txt" && echo ja || echo nein)"
pruefe "Exit 0 (die Warnung aus Versuch 1 gilt nicht mehr)" 0 "$CODE"

source "$WURZEL/tools/commit-data-test-quarantaene.sh"
source "$WURZEL/tools/commit-data-test-verworfen.sh"
source "$WURZEL/tools/commit-data-test-neuversuch.sh"

echo "Gleichzeitige Läufe teilen sich keine festen Pfade (Wackeln unter Last, 14.10.2026)"
pruefe "kein fester /tmp-Pfad in commit-data.sh" 0 "$(grep -c "/tmp/" "$WURZEL/tools/commit-data.sh" || true)"

if [ "$FEHLER" -gt 0 ]; then
  echo "commit-data-test: $FEHLER Prüfung(en) rot."
  exit 1
fi
echo "commit-data-test: grün."
