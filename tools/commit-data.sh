#!/usr/bin/env bash
#
# Ergebnisse eines Datenlaufs committen — ohne je einen Merge-Konflikt zu
# riskieren.
#
# Das Problem, das dieses Skript löst (aufgetreten am 09. und 10.08.2026):
# Ein Lauf dauert zwanzig Minuten und mehr. Wird in dieser Zeit auf `main`
# gepusht — von einem zweiten Lauf oder von einem Menschen —, scheiterte der
# abschließende `git pull --rebase` an Konflikten in `public/data/*.json`. Der
# Lauf brach ab, und mit ihm gingen die frisch geholten Caches verloren: beim
# zweiten Mal 200 aniSearch-Seiten, also gut zwanzig Minuten Anfragen an eine
# fremde Seite, für nichts.
#
# Der Denkfehler war, Quellen und Erzeugnisse gleich zu behandeln:
#
#   data/*.json      Quellen. Teuer erkauft (fremde APIs, Ratenlimits), oft
#                    nicht wiederholbar. Was dieser Lauf geholt hat, gewinnt.
#   public/data/*    Erzeugnisse. Entstehen in Sekunden aus den Quellen. Sie
#                    zu mergen ist sinnlos — man baut sie einfach neu.
#
# Deshalb wird hier nie gemergt. Stattdessen: Quellen beiseitelegen, hart auf
# den aktuellen Fernstand gehen, Quellen zurücklegen, Erzeugnisse neu bauen,
# committen. Ein Konflikt kann dabei nicht entstehen, weil es nichts zu
# vereinen gibt. Kommt jemand beim Push zuvor, läuft dasselbe noch einmal.
#
# Aufruf: bash tools/commit-data.sh "chore(data): Sendezeiten aktualisiert"

set -euo pipefail

# Eigener Ordner je Lauf: feste Pfade unter /tmp überschrieben sich bei gleichzeitigen Läufen (Test: 5 von 20 rot).
TEMP_LAUF="$(mktemp -d)"
trap 'rm -rf "$TEMP_LAUF"' EXIT

NACHRICHT="${1:?Commit-Nachricht fehlt}"
VERSUCHE="${2:-6}" # 3 genügten nicht, wenn Stündlich, Daten-PR und ein Mensch zugleich pushen (Bestandsbau 04.10.2026 16:17 rot)

# Die Liste der Quellpfade liegt in einer eigenen Datei — `quellen-pr.sh`
# braucht dieselbe, und zwei Fassungen laufen auseinander.
source "$(dirname "${BASH_SOURCE[0]}")/quellen-liste.sh"
source "$(dirname "${BASH_SOURCE[0]}")/quellen-aufsetzen.sh"
source "$(dirname "${BASH_SOURCE[0]}")/neuversuch.sh"
ERZEUGNISSE=(public/data public/og)

# Erst nach einem gelungenen Commit (oder wenn es nichts zu committen gab) und nur bei grünem Ausgang dürfen die
# Quittungsschritte abschicken, was die Datenschritte gemerkt haben: Sie lesen nur aus quittung-frei/, und dorthin
# verschiebt allein diese Stelle (pipeline/lib/spaeter-quittieren.ts, 17.10.2026). Wie ein Quittungsschritt
# geschrieben ist und wo er steht, spielt damit keine Rolle mehr.
quittungen_freigeben() {
  local datei
  for datei in data/cache/quittung-offen/*; do
    if [ -f "$datei" ]; then
      mkdir -p data/cache/quittung-frei
      mv -f "$datei" data/cache/quittung-frei/
    fi
  done
}

# Die Bot-Identität gilt **nur für den Commit dieses Skripts**, nicht für das
# Repo.
#
# Ohne `--global` schriebe `git config user.name …` in `.git/config` und bliebe
# dort — von Hand ausgeführt, trügen alle späteren Commits im Ordner den Bot
# als Autor (177 Commits im August 2026).
#
# `git -c` unten setzt beides nur für den einen Aufruf.
BOT_NAME="github-actions[bot]"
BOT_MAIL="41898282+github-actions[bot]@users.noreply.github.com"

# Der `git reset --hard` weiter unten rettet ausschließlich die Pfade aus
# `QUELLEN`. Alles andere ist danach weg — auch **eigene Commits**, die noch
# nicht gepusht sind.
#
# In der CI kann das nicht passieren: Dort steht HEAD beim Start immer auf
# `origin/main`. Von Hand schon: Am 17.08.2026 lag hier ein frischer Commit mit
# der One-Piece-Reparatur, der Fernstand hatte sich inzwischen bewegt, und der
# Reset hat ihn samt Arbeitsstand gelöscht. Zurückgeholt hat ihn nur das Reflog.
#
# Deshalb bricht das Skript ab, statt zu löschen. Es entscheidet nicht, was
# wichtiger ist — das entscheidet, wer es aufgerufen hat.
git fetch origin main --quiet
EIGENE="$(git rev-list --count origin/main..HEAD)"
if [ "$EIGENE" -gt 0 ]; then
  echo "::error::$EIGENE eigene(r) Commit(s) sind noch nicht auf origin/main. Der Reset in diesem Skript wuerde sie loeschen."
  echo "Erst pushen (git push), dann dieses Skript erneut aufrufen."
  git log --oneline origin/main..HEAD
  exit 1
fi

# Neuversuch-Verkürzung (tools/neuversuch.sh): Basis, auf der gebaut bzw. check:logic grün war, und ob der letzte Versuch ganz grün war.
BAU_BASIS=""
LOGIK_BASIS=""
PRUEFUNG_GRUEN=0
for versuch in $(seq 1 "$VERSUCHE"); do
  # Die Quarantäne-Liste gilt nur für den Bau dieses Versuchs; nach dem Neuaufsetzen zählt allein der neue Prüfstand.
  rm -f "$TEMP_LAUF/quarantaene.json" "$TEMP_LAUF/quarantaene.txt"
  # Ebenso die Warnung: die letzte Zeile in GITHUB_ENV gilt, ohne diese stünde nach einem grünen Versuch 2 der Text von Versuch 1.
  echo "DATEN_WARNUNG=${DATEN_WARNUNG:-}" >> "${GITHUB_ENV:-/dev/null}"
  git fetch origin main --quiet
  FERN="$(git rev-parse origin/main)"
  neuversuch_klassifizieren
  LOGIK_UEBERSPRINGEN=0
  NEUVERSUCH_SCHNELL=0
  case "$NEUVERSUCH_ART" in
    nichts) NEUVERSUCH_SCHNELL=1 ;;
    daten) LOGIK_UEBERSPRINGEN=1 ;;
  esac

  if [ "$(git rev-parse HEAD)" != "$FERN" ] && [ "$NEUVERSUCH_SCHNELL" = 1 ]; then
    echo "Fernstand hat sich bewegt, nur Bot-Dateien ohne Leser — Bau und Prüfungen gelten weiter, nur neu aufsetzen (Versuch $versuch)."
    erzeugnisse_behalten_aufsetzen
  elif [ "$(git rev-parse HEAD)" != "$FERN" ]; then
    echo "Fernstand hat sich bewegt — Quellen retten und neu aufsetzen (Versuch $versuch, Art $NEUVERSUCH_ART)."

    # Nur die eigenen Änderungen an den Quellen kommen zurück (`tools/quellen-aufsetzen.sh`, seit 05.10.2026) — die Lehren zu `cp -r`, zum fehlenden
    # Pfad und zu den zusammengeführten Dateien stehen dort.
    quellen_aufsetzen origin/main

    # Erzeugnisse passen jetzt weder zum einen noch zum anderen Stand — neu
    # bauen ist die einzige richtige Antwort.
    #
    # Scheitert der Aufbau, ist das **kein** Grund, hier auszusteigen. Der Build
    # bricht bewusst ab, wenn er einen Widerspruch findet (siehe
    # `pipeline/lib/pruefung.ts`) — und genau dann wären die Quellen dieses Laufs
    # das Einzige, was ihn retten kann. Unter `set -e` riss ein solcher Abbruch
    # bis zum 17.08.2026 auch die Quellen mit: Der Wochenlauf vom selben Tag hat
    # 57 Minuten lang fünf fremde Server befragt und alles verworfen.
    # Ein Abruf-Lauf holt eine einzelne Quelle und hat keinen AniList-Cache —
    # `data:build` bräche dort zwangsläufig ab („data/cache/ ist leer"), und die
    # Meldung sähe nach einem Fehler aus, obwohl alles richtig läuft. Mit
    # NUR_QUELLEN=1 wird gar nicht erst gebaut; den Bau macht der nächste
    # planmäßige Lauf, der den Cache ohnehin aufbaut.
    #
    # Der Lauf endet danach trotzdem rot (AUFBAU_GESCHEITERT, seit 12.10.2026): Bei gescheitertem Aufbau ging das Skript mit
    # Exit 0 hinaus, und `deploy.yml` (startet nur bei success) lieferte nichts aus, ohne dass es jemand sah.
    # NUR_QUELLEN ist kein Fehler und bleibt grün.
    AUFBAU_KAPUTT=0
    AUFBAU_GESCHEITERT=0
    LISTEN_GESCHEITERT=0
    if [ "${NUR_QUELLEN:-0}" = 1 ]; then
      echo "NUR_QUELLEN=1 — kein Neuaufbau, nur die geholten Quellen."
      AUFBAU_KAPUTT=1
    elif ! npm run data:build; then
      echo "::error::Der Neuaufbau ist gescheitert. Die Quellen werden trotzdem committet — sie sind der teure Teil —, die Erzeugnisse nicht; der Lauf endet rot."
      AUFBAU_KAPUTT=1
      AUFBAU_GESCHEITERT=1
    fi
    NEU_GEBAUT=1

    # Die Prüflisten gehören zum Aufbau, nicht zum Workflow.
    #
    # Sie zählen gegen `titles.json` und werden im Workflow einen Schritt nach
    # `data:build` erzeugt — hier im Rettungszweig aber wurde nur neu gebaut.
    # Der Prüfstand ging damit auf dem Stand von vorhin mit ins Repo.
    #
    # Am 27.08.2026 sichtbar geworden: Der Bau hatte acht Netflix-Adressen auf
    # ihre Titelform gebracht, `titles.json` führte danach 7 Verweise ohne
    # Kennung — der Prüfstand meldete weiter 15, und die Pille in der Status-App
    # führte auf eine Liste, in der nichts stand.
    if [ "${AUFBAU_KAPUTT:-0}" != 1 ] && ! npm run data:extension-liste; then
      echo "::error::Die Prüflisten sind nicht neu entstanden. Sie zählen dann gegen einen älteren Bestand; der Lauf endet rot."
      LISTEN_GESCHEITERT=1
    fi
  fi
  # Seit dem 17.09.2026 außerhalb des Neuaufbau-Zweigs: nach einem Neuaufbau und
  # im Bau-Lauf (BAU_LAUF) immer — vorher lief sie dort nur, wenn sich
  # der Fernstand bewegt hatte.

  # Was der Bestand behauptet, wird hier geprüft — nicht erst beim Deploy.
  #
  # **Der Grund ist eine Reihenfolge, die sieben rote Deploys erzeugt hat.**
  # Die Zusicherungen unten messen den Datenbestand: ob jede Handprüfung im
  # Datensatz steht, ob die Crunchyroll-Auswertung noch trifft, ob jeder
  # Verweis eine Zugangsart hat. Sie liefen bisher nur im Deploy — also an
  # einer Stelle, die den Bestand weder erzeugt noch reparieren kann.
  #
  # Wer Code pusht, dessen Wirkung erst der nächste Bau zeigt, bekam deshalb
  # zwangsläufig einen roten Deploy: Der Datensatz im Repo war der von
  # vorhin. Von acht roten Läufen der letzten beiden Tage gingen sieben genau
  # darauf zurück (gemessen am 27.08.2026), und keiner davon war ein Fehler
  # in dem, was gerade gepusht wurde.
  #
  # Hier stehen sie richtig: Dieser Lauf hat den Bestand gerade gebaut. Ist
  # er kaputt, erreicht er das Repo gar nicht erst — und der Lauf wird rot,
  # wie es sich gehört, denn hier ist wirklich etwas kaputt.
  #
  # Die Quellen bleiben davon unberührt und werden committet. Sie sind der
  # teure Teil (fremde APIs, Ratenlimits), und an ihnen liegt es nicht.
  # Ausnahme Bau-Lauf: Seine Quellen entstehen aus dem verworfenen Stand (bau_lauf_zuruecknehmen).
  BESTAND_KAPUTT=0
  QUARANTAENE_AKTIV=0
  # Beide Prüfketten in eine Datei; check:logic läuft nur nach grünem check:bestand.
  # Mit LOGIK_UEBERSPRINGEN=1 (seit der letzten grünen check:logic bewegten sich nur Datenpfade, neuversuch-art.mjs) entfällt allein check:logic.
  bestand_pruefen() {
    npm run check:bestand > "$TEMP_LAUF/bestand-pruefung.txt" 2>&1 || return 1
    if [ "$LOGIK_UEBERSPRINGEN" = 1 ]; then
      echo "check:logic übersprungen: seit $LOGIK_BASIS bewegten sich nur Datenpfade." >> "$TEMP_LAUF/bestand-pruefung.txt"
      return 0
    fi
    npm run check:logic >> "$TEMP_LAUF/bestand-pruefung.txt" 2>&1 && LOGIK_BASIS="$FERN"
  }
  # Die Historie-Zeile dieses Laufs (Schritt „Delta am Bestand festhalten“) misst den Bau vor der Quarantäne. Ausgeliefert wird ein
  # anderer Bestand: Zeile verwerfen (`verworfen: true`, die Wache überspringt sie) und neu messen (19.10.2026: Pendeln gegen Stände,
  # die nie live waren). Ein verworfener Bau-Lauf ohne Auslieferung nimmt die Zeile mit `bau_lauf_zuruecknehmen` zurück.
  historie_neu_messen() {
    npm run data:historie -- --ersetzen || echo "::warning::Die Historie-Zeile dieses Laufs ließ sich nicht neu messen."
  }
  # Titel-Quarantäne (18.10.2026, tools/quarantaene.mjs): Tragen die roten Prüfungen Titel-Kennungen, wird ohne genau diese
  # Titel neu gebaut und erneut geprüft, bis es grün ist oder das Gate sperrt (keine neue Kennung, Cartoon, mehr als drei).
  # Nur im Bau-Lauf; der Neubau sieht denselben Vorstand (public/data von HEAD) wie der erste.
  quarantaene_versuchen() {
    [ "${BAU_LAUF:-0}" = 1 ] || return 1
    while node tools/quarantaene.mjs sammeln "$TEMP_LAUF/bestand-pruefung.txt" "$TEMP_LAUF/quarantaene.json" > "$TEMP_LAUF/quarantaene.txt"; do
      cat "$TEMP_LAUF/bestand-pruefung.txt" "$TEMP_LAUF/quarantaene.txt"
      git checkout HEAD -- public/data 2>/dev/null || true
      git clean -fdq -- public/data
      if ! BAU_QUARANTAENE="$TEMP_LAUF/quarantaene.json" npm run data:build; then
        echo "keine Quarantäne: der Neubau ohne die Titel ist gescheitert" > "$TEMP_LAUF/quarantaene.txt"
        return 1
      fi
      # Dieselben Listen wie der Workflow-Schritt „Arbeitslisten und Prüfstand neu erzeugen“ (bestand-bauen.yml).
      if ! { npm run data:vorschlaege && npm run data:dub-checks && npm run data:extension-liste && npm run data:start-liste; }; then
        echo "::warning::Die Arbeitslisten sind nach der Quarantäne nicht neu entstanden."
      fi
      if bestand_pruefen; then
        historie_neu_messen
        return 0
      fi
    done
    return 1
  }
  # Verworfener Bau-Lauf: Jeder Schritt vor diesem (bestand-bauen.yml) schreibt aus dem verworfenen Stand — Meldungen, Bau,
  # Prüflisten, Prüfstand, Historie — oder aus Briefkästen, die erst nach dem Commit geleert werden. Nur `data:fetch` holt
  # Eigenes (pipeline/fetch.ts, mit `holeAnisearchCover`); das bleibt, alles andere geht auf HEAD zurück. Bis 18.10.2026 nur Belege und Stempel,
  # die Listen daraus kamen trotzdem ins Repo (Lauf 39161629649: 95 Wiedervorlagen fehlten in Prüfliste und Prüfstand).
  # Vollständig gegen die Schreibziele von fetch.ts: tools/fetch-schreibziele.mjs, Probe in tools/commit-data-test-verworfen.sh.
  BAU_LAUF_BEHALTEN=(data/tmdb.json data/curated-ids.json data/anisearch-cover.json)
  bau_lauf_zuruecknehmen() {
    local zeile datei
    while IFS= read -r zeile; do
      datei="${zeile:3}"
      case " ${BAU_LAUF_BEHALTEN[*]} " in *" $datei "*) continue ;; esac
      if git cat-file -e "HEAD:$datei" 2>/dev/null; then
        git checkout HEAD -- "$datei"
      else
        # Auch aus dem Index: eine vorher gestagte neue Datei käme sonst mit dem Commit nach main.
        git rm -q --cached --ignore-unmatch -- "$datei"
        rm -f "$datei"
      fi
    done < <(git -c status.renames=false status --porcelain -uall -- "${QUELLEN[@]}")
  }
  if [ "$NEUVERSUCH_SCHNELL" != 1 ] && [ "${AUFBAU_KAPUTT:-0}" != 1 ] && { [ "${NEU_GEBAUT:-0}" = 1 ] || [ "${BAU_LAUF:-0}" = 1 ]; }; then
    # Seit dem 17.09.2026 auch check:logic, und im Bau-Lauf (BAU_LAUF=1) werden
    # die neuen Meldungen samt allem daraus Erzeugten zurückgenommen (bau_lauf_zuruecknehmen): Sie bleiben im Briefkasten, die
    # Statusanzeige zeigt den Grund. Bis dahin gingen Belege, die eine
    # Zusicherung verletzen, als Quelle ins Repo und machten danach jeden
    # Deploy rot. Der Lauf endet rot, auch im Bau-Lauf (seit 11.10.2026:
    # von 15:14 bis 21:08 UTC lieferte er grün keine Erzeugnisse aus, sechs Stunden unbemerkt).
    if ! bestand_pruefen && ! quarantaene_versuchen; then
      cat "$TEMP_LAUF/bestand-pruefung.txt"
      # Die sechs Prüfungen in `check:bestand` melden über `warn()` (Zeichen
      # `⚠`) oder mit `✗` (U+2717); nur `check-logic.ts` und `build.ts`
      # selbst nutzen `✖` (U+2716). Ein Muster, das nur `✖` sucht, findet bei
      # jedem `check:bestand`-Fehlschlag keinen Treffer — `grep` beendet sich
      # dann mit Exit-Code 1, und unter `set -euo pipefail` reißt das diese
      # einfache Zuweisung mit: kein `if`/`&&`/`||`-Kontext, den `set -e`
      # ausnimmt. Das Skript brach dadurch ab, bevor es die
      # `BAU_LAUF`-Behandlung darunter erreichte (21.09.2026, Lauf
      # 35566086288, ausgelöst von `check:handbelege`). `|| true` fängt außerdem
      # den Fall ab, in dem keines der drei Zeichen vorkommt.
      # FEHLER:-Zeilen zuerst, dann ✖/✗, ⚠ zuletzt: Sonst füllen drei ⚠-Hinweise die drei Plätze, und der echte Fehler fehlt in der Meldung
      # (18.10.2026, Lauf 39161629649: der ✗ aus check-episodentitel.ts stand hinter drei ⚠).
      grund="$({
        grep -E 'FEHLER:' "$TEMP_LAUF/bestand-pruefung.txt"
        grep -E '✖|✗' "$TEMP_LAUF/bestand-pruefung.txt" | grep -v 'FEHLER:'
        grep -E '⚠' "$TEMP_LAUF/bestand-pruefung.txt" | grep -Ev 'FEHLER:|✖|✗'
      } | head -n 3 | tr -d '\"' | tr -s '[:space:]' ' ')" || true
      if [ -s "$TEMP_LAUF/quarantaene.txt" ]; then
        grund="$grund · $(tail -n 1 "$TEMP_LAUF/quarantaene.txt")"
      fi
      if [ "${BAU_LAUF:-0}" != 1 ]; then
        echo "::error::Der gebaute Bestand verletzt eine Zusicherung. Die Erzeugnisse werden nicht committet; die Quellen schon."
      else
        echo "::error::Der gebaute Bestand verletzt eine Zusicherung. Aus dem Bau-Lauf wird nichts committet außer den Abrufen von data:fetch."
        bau_lauf_zuruecknehmen
        rm -f data/cache/quittung-offen/pruefungen-abhaken.json
        echo "DATEN_WARNUNG=${DATEN_WARNUNG:+$DATEN_WARNUNG · }Bestand nicht übernommen: $grund" >> "${GITHUB_ENV:-/dev/null}"
      fi
      BESTAND_KAPUTT=1
    else
      cat "$TEMP_LAUF/bestand-pruefung.txt" | tail -3
      # Zurückgestellte Titel (meta.quarantaene): Lauf gelb mit der Liste. Die Kalender-Grenzen bleiben stehen, sonst sänken sie um die fehlenden Titel.
      if zurueck="$(node tools/quarantaene.mjs text public/data/meta.json)"; then
        QUARANTAENE_AKTIV=1
        echo "::warning::Bestand ohne zurückgestellte Titel übernommen: $zurueck"
        echo "DATEN_WARNUNG=${DATEN_WARNUNG:+$DATEN_WARNUNG · }$zurueck" >> "${GITHUB_ENV:-/dev/null}"
      fi
    fi
  fi

  # Ohne gelungenen Aufbau bleiben die Erzeugnisse außen vor: Sie stehen dann auf
  # dem Fernstand, und den noch einmal zu committen wäre bestenfalls ein Leerlauf.
  #
  # **Jeder Pfad einzeln — ein fehlender darf nicht alles mitreißen.**
  #
  # `git add a b` bricht ab, sobald einer der Pfade nicht existiert
  # („pathspec did not match any files"), und staged dann **gar nichts**. Mit
  # `2>/dev/null || true` daneben sieht das aus wie Erfolg: Der Lauf meldet
  # „Keine Änderung — nichts zu committen" und wird grün.
  #
  # Am 02.09.2026 hat der Bau 222 abgeleitete Crunchyroll-Termine erzeugt
  # (313 → 535 Releases, 949 → 2.786 Termine) und **nichts** davon committet.
  # Die Liste ist 216 Zeilen lang; es genügt, dass eine einzige Quelle in
  # diesem Lauf nicht entstanden ist.
  #
  # Einzeln hinzugefügt trägt jeder Pfad nur sein eigenes Fehlen, und wer fehlt,
  # steht im Log — sonst sucht man den Verlust beim nächsten Mal wieder im Bau.
  hinzu() {
    local fehlend=()
    local pfad
    for pfad in "$@"; do
      if [ -e "$pfad" ]; then
        git add "$pfad" 2>/dev/null || true
      else
        fehlend+=("$pfad")
      fi
    done
    if [ ${#fehlend[@]} -gt 0 ]; then
      echo "::warning::${#fehlend[@]} Pfad(e) nicht vorhanden, übersprungen: ${fehlend[*]}"
    fi
  }

  pflicht_erzeugnisse_da() {
    local pfad
    local da=0
    for pfad in public/og public/data/titles.json; do
      if [ ! -e "$pfad" ]; then
        echo "::error::Pflicht-Erzeugnis fehlt: $pfad"
        da=1
      fi
    done
    return $da
  }

  # Gesunkene Umfangsgrenzen übernimmt nur dieser Lauf auf main, nie ein PR: Sonst ändert fast jeder PR dieselbe Zeile
  # in tools/umfang-grenzen.json und macht die übrigen offenen PRs DIRTY (11.10.2026). Scheitert es, bleibt alles beim Alten.
  grenzen_festschreiben() {
    if node tools/umfang-pruefen.mjs --festschreiben > /dev/null 2>&1; then
      hinzu tools/umfang-grenzen.json
    fi

    # Dasselbe für die alten Farbklassen in web/src (docs/wissen/design-regeln.md, Abschnitt 7).
    if node tools/design-klassen.mjs --festschreiben > /dev/null 2>&1; then
      hinzu tools/design-klassen-grenzen.json
    fi

    # Dasselbe für die echte Uhr in Tests (tools/uhr-in-tests.mjs).
    if node tools/uhr-in-tests.mjs --festschreiben > /dev/null 2>&1; then
      hinzu tools/uhr-in-tests-grenzen.json
    fi

    # Dasselbe für „heute“ als UTC-Tag (tools/heute-utc.mjs).
    if node tools/heute-utc.mjs --festschreiben > /dev/null 2>&1; then
      hinzu tools/heute-utc-grenzen.json
    fi

    # Dasselbe für die Treffer der Kalender-Plausibilität (pipeline/lib/kalender-plausibilitaet.ts): gesunkene Zahlen übernehmen.
    if [ "$QUARANTAENE_AKTIV" != 1 ] && npm run check:kalender-plausibilitaet -- --festschreiben > /dev/null 2>&1; then
      hinzu tools/kalender-plausibilitaet-grenzen.json
    fi
  }
  # Nur in der Stunde 02 UTC (der Sendezeiten-Sammler löst jede Stunde einen Bau aus): Jeder Bau nach einem Merge schrieb
  # die Grenzen, damit machte jeder Merge den nächsten offenen PR „nicht aktuell“ (21.10.2026).
  if [ "${STUNDE_UTC:-$(date -u +%H)}" = 02 ]; then
    grenzen_festschreiben
  fi

  # Rot endet der Lauf, sobald Aufbau oder Bestand scheitern — nach dem Sichern der Quellen.
  LAUF_ROT=0
  if [ "${AUFBAU_GESCHEITERT:-0}" = 1 ] || [ "${BESTAND_KAPUTT:-0}" = 1 ] || [ "${LISTEN_GESCHEITERT:-0}" = 1 ]; then
    LAUF_ROT=1
  fi
  # Ein Pflicht-Erzeugnis, das nach gelungenem Bau fehlt, ist ein Fehler (18.10.2026: `hinzu` übersprang es still).
  if [ "${AUFBAU_KAPUTT:-0}" != 1 ] && ! pflicht_erzeugnisse_da; then
    LAUF_ROT=1
  fi

  if [ "${AUFBAU_KAPUTT:-0}" = 1 ] || [ "${BESTAND_KAPUTT:-0}" = 1 ]; then
    hinzu "${QUELLEN[@]}"
  else
    hinzu "${ERZEUGNISSE[@]}" "${QUELLEN[@]}"
  fi

  if git diff --staged --quiet; then
    echo "Keine Änderung — nichts zu committen."
    [ "$LAUF_ROT" = 1 ] && exit 1
    quittungen_freigeben
    exit 0
  fi

  git -c user.name="$BOT_NAME" -c user.email="$BOT_MAIL" commit -m "$NACHRICHT" --quiet

  # Die Meldung bleibt sichtbar: Am 11.10.2026 scheiterten sechs Pushes bei unbewegtem Fernstand, und ohne Text war nicht zu sagen, ob es ein Wettlauf oder eine Ablehnung (Rechte, Schutzregel) war.
  if git push --quiet 2>"$TEMP_LAUF/push-fehler.txt"; then
    echo "Gepusht (Versuch $versuch)."
    # Die Quellen sind gesichert — jetzt darf der Lauf scheitern.
    [ "$LAUF_ROT" = 1 ] && exit 1
    quittungen_freigeben
    exit 0
  fi

  echo "Push abgelehnt (Versuch $versuch): $(tr '\n' ' ' < "$TEMP_LAUF/push-fehler.txt" | cut -c1-400)"
  # Den eigenen Commit zurücknehmen, die Dateien behalten — die nächste Runde
  # setzt ohnehin auf dem neuen Fernstand neu auf.
  git reset --soft HEAD~1
  BAU_BASIS="$FERN"
  if neuversuch_gruen; then PRUEFUNG_GRUEN=1; else PRUEFUNG_GRUEN=0; fi
  # Kurze, zufällige Pause: Zwei Läufe, die zugleich abgelehnt wurden, sollen nicht im Gleichschritt neu ansetzen.
  sleep $((5 + RANDOM % 16))
done

echo "::error::Nach $VERSUCHE Versuchen nicht gepusht. Die geholten Daten sind im Lauf-Verzeichnis, nicht im Repo."
exit 1
