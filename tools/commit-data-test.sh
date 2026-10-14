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
case "$2" in
  data:build)
    [ "${FAKE_BAU:-ok}" = fail ] && { echo "✖ Titelschwund"; exit 1; }
    mkdir -p public/data
    echo '{"neu":true}' > public/data/titles.json
    ;;
  check:bestand)
    [ "${FAKE_BESTAND:-ok}" = fail ] && { echo "✗ Handbeleg ohne Titel"; exit 1; }
    [ "${FAKE_BESTAND:-ok}" = fehler ] && { echo "FEHLER: Cover fehlt bei Titel 7"; exit 1; }
    [ "${FAKE_BESTAND:-ok}" = gemischt ] && { printf '⚠ Hinweis eins\n⚠ Hinweis zwei\n⚠ Hinweis drei\nFEHLER: Cover fehlt bei Titel 9\n'; exit 1; }
    ;;
esac
exit 0
SKRIPT
chmod +x "$ATTRAPPE/npm"

# Ein Szenario: frisches Repo, der Fernstand hat sich bewegt (das löst den Neuaufbau-Zweig aus), der Lauf hat data/anisearch.json geändert.
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
  for datei in commit-data.sh quellen-liste.sh quellen-aufsetzen.sh health-vereinen.mjs dub-belege-vereinen.mjs; do
    cp "$WURZEL/tools/$datei" "$d/start/tools/$datei"
  done
  echo '{"v":1}' > "$d/start/data/anisearch.json"
  git -C "$d/start" add -A
  git -C "$d/start" -c user.name=t -c user.email=t@t commit -q -m start
  git -C "$d/start" push -q origin HEAD:main
  git clone -q "$ORIGIN" "$d/lauf" 2>/dev/null
  git clone -q "$ORIGIN" "$d/anderer" 2>/dev/null
  echo "x" > "$d/anderer/fremd.txt"
  git -C "$d/anderer" add -A
  git -C "$d/anderer" -c user.name=t -c user.email=t@t commit -q -m fremd
  git -C "$d/anderer" push -q origin HEAD:main
  if [ "${LAUF_AENDERT:-ja}" = ja ]; then
    echo '{"v":2,"von":"lauf"}' > "$d/lauf/data/anisearch.json"
  fi
  (cd "$d/lauf" && env "$@" PATH="$ATTRAPPE:$PATH" bash tools/commit-data.sh "chore(data): test" 1 > "$d/log.txt" 2>&1)
  CODE=$?
}

im_fernstand() { git -C "$ORIGIN" cat-file -e "main:$1" 2>/dev/null && echo ja || echo nein; }
quelle_gepusht() { git -C "$ORIGIN" show main:data/anisearch.json 2>/dev/null | grep -q '"von":"lauf"' && echo ja || echo nein; }

echo "Aufbau gelingt, Bestand ok: grün, Erzeugnisse und Quellen im Fernstand"
szenario gruen FAKE_BAU=ok FAKE_BESTAND=ok
pruefe "Exit 0" 0 "$CODE"
pruefe "Quelle gepusht" ja "$(quelle_gepusht)"
pruefe "Erzeugnis gepusht" ja "$(im_fernstand public/data/titles.json)"

echo "data:build scheitert: rot, Quellen trotzdem gesichert, keine Erzeugnisse"
szenario aufbau FAKE_BAU=fail
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Quelle gepusht" ja "$(quelle_gepusht)"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"

echo "check:bestand scheitert (Zusicherung, seit PR 866): rot, Quellen gesichert, keine Erzeugnisse"
szenario bestand FAKE_BESTAND=fail
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Quelle gepusht" ja "$(quelle_gepusht)"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"

echo "Prüfung meldet nur mit FEHLER: (Bau-Lauf): DATEN_WARNUNG nennt den Grund"
mkdir -p "$ARBEIT/warnung"
szenario warnung FAKE_BESTAND=fehler BAU_LAUF=1 GITHUB_ENV="$ARBEIT/warnung/env.txt"
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"
pruefe "Warnung enthält den Grund" ja "$(grep -q '^DATEN_WARNUNG=.*FEHLER: Cover fehlt bei Titel 7' "$ARBEIT/warnung/env.txt" && echo ja || echo nein)"

echo "Drei ⚠-Zeilen vor einer FEHLER:-Zeile: DATEN_WARNUNG nennt den Fehler zuerst"
mkdir -p "$ARBEIT/reihenfolge"
szenario reihenfolge FAKE_BESTAND=gemischt BAU_LAUF=1 GITHUB_ENV="$ARBEIT/reihenfolge/env.txt"
pruefe "Warnung beginnt mit dem Fehler" ja "$(grep -q '^DATEN_WARNUNG=.*Bestand nicht übernommen: FEHLER: Cover fehlt bei Titel 9' "$ARBEIT/reihenfolge/env.txt" && echo ja || echo nein)"

echo "NUR_QUELLEN=1 (Abruf-Lauf, kein Bau): grün, nur Quellen"
szenario abruf NUR_QUELLEN=1 FAKE_BAU=fail
pruefe "Exit 0" 0 "$CODE"
pruefe "Quelle gepusht" ja "$(quelle_gepusht)"
pruefe "kein Erzeugnis gepusht" nein "$(im_fernstand public/data/titles.json)"

echo "data:build scheitert und es gibt nichts zu committen: trotzdem rot"
LAUF_AENDERT=nein szenario leer FAKE_BAU=fail
pruefe "Exit ≠ 0" ja "$([ "$CODE" -ne 0 ] && echo ja || echo nein)"

echo "Gleichzeitige Läufe teilen sich keine festen Pfade (Wackeln unter Last, 14.10.2026)"
pruefe "kein fester /tmp-Pfad in commit-data.sh" 0 "$(grep -c "/tmp/" "$WURZEL/tools/commit-data.sh" || true)"

if [ "$FEHLER" -gt 0 ]; then
  echo "commit-data-test: $FEHLER Prüfung(en) rot."
  exit 1
fi
echo "commit-data-test: grün."
