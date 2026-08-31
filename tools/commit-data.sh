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

NACHRICHT="${1:?Commit-Nachricht fehlt}"
VERSUCHE="${2:-3}"

# Die Liste der Quellpfade liegt in einer eigenen Datei — `quellen-pr.sh`
# braucht dieselbe, und zwei Fassungen laufen auseinander.
source "$(dirname "${BASH_SOURCE[0]}")/quellen-liste.sh"
ERZEUGNISSE=(public/data public/og)

# Die Bot-Identität gilt **nur für den Commit dieses Skripts**, nicht für das
# Repo.
#
# Bis zum 22.08.2026 stand hier `git config user.name …` ohne `--global`. Das
# schreibt in `.git/config` und bleibt dort stehen — in der CI harmlos, weil
# der Arbeitsordner nach dem Lauf verschwindet. Wird das Skript aber **von
# Hand** ausgeführt, färbt es jeden späteren Commit in diesem Ordner: 177
# Commits zwischen dem 17. und 22.08.2026 tragen den Bot als Autor, darunter
# Handarbeit. `git blame` zeigt dort einen Automaten, der nie am Werk war.
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

for versuch in $(seq 1 "$VERSUCHE"); do
  git fetch origin main --quiet

  if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo "Fernstand hat sich bewegt — Quellen retten und neu aufsetzen (Versuch $versuch)."

    # Die Quellen aus dem Arbeitsverzeichnis in Sicherheit bringen. `mktemp -d`
    # liegt außerhalb des Repos, wird vom Reset also nicht angefasst.
    RETTUNG="$(mktemp -d)"
    for pfad in "${QUELLEN[@]}"; do
      [ -e "$pfad" ] || continue
      mkdir -p "$RETTUNG/$(dirname "$pfad")"
      cp -r "$pfad" "$RETTUNG/$pfad"
    done

    git reset --hard origin/main --quiet

    # Zurückspielen — und hier steckte bis zum 24.08.2026 ein Fehler, der das
    # Repository in 14 Tagen um 13.458 Dateien aufgebläht hat.
    #
    # `cp -r QUELLE ZIEL` legt die Quelle **in** das Ziel, wenn das Ziel bereits
    # ein Verzeichnis ist. Genau das ist hier der Normalfall: Der `git reset`
    # eine Zeile höher stellt `data/adn-raw` aus dem Fernstand wieder her, also
    # existiert der Ordner, wenn die Rettung zurückkommt. Ergebnis:
    # `data/adn-raw/adn-raw`.
    #
    # Und es blieb nicht bei einer Ebene: Beim nächsten Lauf wurde der bereits
    # verschachtelte Ordner gerettet und erneut hineinkopiert. Am 21.08.2026
    # wuchs die Tiefe an einem einzigen Tag von 1 auf 8 — im Takt der Läufe.
    # Zuletzt lag `data/proposals` 21 Ebenen tief; auf Windows liess sich das
    # Repository nicht mehr auschecken („Filename too long"), und `git pull`
    # brach ab.
    #
    # Der Fehler war unsichtbar, weil er nichts kaputt macht: Die Läufe liefen
    # grün, die Daten stimmten, nur wuchs im Hintergrund eine Kopie der Kopie.
    #
    # Deshalb Zielordner erst weg, dann kopieren. Das ist eindeutig, egal ob das
    # Ziel existiert oder nicht — und behandelt einzelne Dateien mit.
    for pfad in "${QUELLEN[@]}"; do
      [ -e "$RETTUNG/$pfad" ] || continue
      mkdir -p "$(dirname "$pfad")"
      # `dub-confirmed.yaml` wächst — sie wird zusammengeführt, nicht ersetzt.
      #
      # Für jede andere Quelle ist „Arbeitsstand gewinnt" richtig: Der Lauf hat
      # sie gerade frisch geholt. Diese eine trägt Belege, und der Fernstand kann
      # welche haben, die dieser Lauf nie gesehen hat. Am 31.08.2026 hat genau
      # das 300 Belege gekostet — zwei Bauläufe kurz hintereinander, dazwischen
      # ein Push mit 210 neuen, und der ältere Lauf schrieb seinen Stand darüber.
      if [ "$pfad" = "data/dub-confirmed.yaml" ] && [ -e "$pfad" ]; then
        node tools/dub-belege-vereinen.mjs "$pfad" "$RETTUNG/$pfad" || true
        continue
      fi
      rm -rf "$pfad"
      cp -r "$RETTUNG/$pfad" "$pfad"
    done
    rm -rf "$RETTUNG"

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
    if [ "${NUR_QUELLEN:-0}" = 1 ]; then
      echo "NUR_QUELLEN=1 — kein Neuaufbau, nur die geholten Quellen."
      AUFBAU_KAPUTT=1
    elif ! npm run data:build; then
      echo "::warning::Der Neuaufbau ist gescheitert. Die Quellen werden trotzdem committet — sie sind der teure Teil, die Erzeugnisse baut der nächste Lauf neu."
      AUFBAU_KAPUTT=1
    fi

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
      echo "::warning::Die Prüflisten sind nicht neu entstanden. Sie zählen dann gegen einen älteren Bestand."
    fi

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
    if [ "${AUFBAU_KAPUTT:-0}" != 1 ]; then
      if ! npm run check:bestand; then
        echo "::error::Der gebaute Bestand verletzt eine Zusicherung. Die Erzeugnisse werden nicht committet; die Quellen schon."
        BESTAND_KAPUTT=1
      fi
    fi
  fi

  # Ohne gelungenen Aufbau bleiben die Erzeugnisse außen vor: Sie stehen dann auf
  # dem Fernstand, und den noch einmal zu committen wäre bestenfalls ein Leerlauf.
  if [ "${AUFBAU_KAPUTT:-0}" = 1 ] || [ "${BESTAND_KAPUTT:-0}" = 1 ]; then
    git add "${QUELLEN[@]}" 2>/dev/null || true
  else
    git add "${ERZEUGNISSE[@]}" "${QUELLEN[@]}" 2>/dev/null || true
  fi

  if git diff --staged --quiet; then
    echo "Keine Änderung — nichts zu committen."
    exit 0
  fi

  git -c user.name="$BOT_NAME" -c user.email="$BOT_MAIL" commit -m "$NACHRICHT" --quiet

  if git push --quiet 2>/dev/null; then
    echo "Gepusht (Versuch $versuch)."
    # Die Quellen sind gesichert — jetzt darf der Lauf scheitern.
    [ "${BESTAND_KAPUTT:-0}" = 1 ] && exit 1
    exit 0
  fi

  echo "Push abgelehnt, jemand war schneller. Nächster Versuch."
  # Den eigenen Commit zurücknehmen, die Dateien behalten — die nächste Runde
  # setzt ohnehin auf dem neuen Fernstand neu auf.
  git reset --soft HEAD~1
done

echo "::error::Nach $VERSUCHE Versuchen nicht gepusht. Die geholten Daten sind im Lauf-Verzeichnis, nicht im Repo."
exit 1
