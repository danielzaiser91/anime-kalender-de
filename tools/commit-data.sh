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

# Alles, was ein Lauf schreiben kann. Nicht jeder Lauf berührt alles; fehlende
# Pfade werden übersprungen.
QUELLEN=(
  data/anisearch.json
  data/crunchyroll.json
  data/adn.json
  # Fehlte hier, seit es die Datei gibt — gefunden am 14.08.2026 durch die neue
  # Prüfung in `tools/check-workflows.mjs`. `npm run data:adn:catalog` läuft
  # **wöchentlich** in der CI und holt 583 KB Katalogdaten; committet wurden sie
  # nie, und bei bewegtem Fernstand warf der Reset sie weg. Der Lauf tat also
  # jede Woche dieselbe Arbeit umsonst.
  data/adn-catalog.json
  data/tmdb.json
  data/anime-ids.json
  data/curated-ids.json
  data/source-health.json
  data/proposals
  # Gedächtnis, keine Momentaufnahme — und deshalb hier lebenswichtig.
  #
  # `data/synchro-historie.json` hält fest, seit wann ein Titel eine belegte
  # deutsche Synchro hat. Fehlte die Datei in dieser Liste, passierte zweierlei:
  # Der Lauf committet sie nie, und beim `git reset --hard` weiter unten wird
  # die frisch geschriebene Fassung verworfen. Ein Titel, der im CI eine Synchro
  # bekommt, stünde damit bei **jedem** Lauf erneut als Neuzugang da — und jeder
  # Abonnent bekäme bis zu sechzig Tage lang täglich dieselbe Mail über
  # dieselbe Serie. Gefunden am 14.08.2026, einen Tag nach dem Einbau, bevor
  # der erste Nachtlauf darüberlief.
  data/synchro-historie.json
  # Ebenfalls Gedächtnis: Jede Adresse, die je zu einem Termin geführt hat.
  # Fehlte sie hier, ginge beim nächsten Reset genau das verloren, wofür sie da
  # ist — die überholten Belege. Der Datensatz führte dann wieder nur die
  # neueste Quelle, und die Frage „woher kam der alte Termin?" wäre erneut
  # unbeantwortbar.
  data/quellen-historie.json
  # Zuordnung AniList → Anime News Network, aus dem Offline-Datensatz von
  # manami-project. Ohne sie fände `data:ann:voices` keinen einzigen Titel und
  # der Lauf wäre still wirkungslos.
  data/ann-ids.json
  # Die Rohantworten der ANN-Encyclopedia, rund 8 KB je Titel. Sie stehen hier
  # aus demselben Grund wie das aniSearch-Archiv: ANN erlaubt **eine** Anfrage
  # pro Sekunde, ein voller Lauf über 2.112 Titel dauert 35 Minuten. Ein später
  # gebrauchtes Feld muss eine Änderung am Parser sein können und nicht ein
  # zweiter Lauf über eine fremde Schnittstelle mit hartem Limit.
  data/ann-raw
  # Ergebnis des Crunchyroll-Synchro-Laufs. Steht hier vorsorglich: Läuft er
  # eines Tages in der CI, wären 918 Seitenabrufe sonst nach einem Reset weg.
  data/crunchyroll-dub.json
  # Ergebnis der YouTube-Prüfung: je Adresse, wie viele der dort verlinkten
  # Videos in Deutschland überhaupt abrufbar sind. Ohne diese Zeile würfe der
  # Reset sie weg, und der nächste Lauf befragte dieselben 513 Adressen erneut.
  data/youtube-check.json
)
ERZEUGNISSE=(public/data public/og)

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

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

    for pfad in "${QUELLEN[@]}"; do
      [ -e "$RETTUNG/$pfad" ] || continue
      mkdir -p "$(dirname "$pfad")"
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
    if ! npm run data:build; then
      echo "::warning::Der Neuaufbau ist gescheitert. Die Quellen werden trotzdem committet — sie sind der teure Teil, die Erzeugnisse baut der nächste Lauf neu."
      AUFBAU_KAPUTT=1
    fi
  fi

  # Ohne gelungenen Aufbau bleiben die Erzeugnisse außen vor: Sie stehen dann auf
  # dem Fernstand, und den noch einmal zu committen wäre bestenfalls ein Leerlauf.
  if [ "${AUFBAU_KAPUTT:-0}" = 1 ]; then
    git add "${QUELLEN[@]}" 2>/dev/null || true
  else
    git add "${ERZEUGNISSE[@]}" "${QUELLEN[@]}" 2>/dev/null || true
  fi

  if git diff --staged --quiet; then
    echo "Keine Änderung — nichts zu committen."
    exit 0
  fi

  git commit -m "$NACHRICHT" --quiet

  if git push --quiet 2>/dev/null; then
    echo "Gepusht (Versuch $versuch)."
    exit 0
  fi

  echo "Push abgelehnt, jemand war schneller. Nächster Versuch."
  # Den eigenen Commit zurücknehmen, die Dateien behalten — die nächste Runde
  # setzt ohnehin auf dem neuen Fernstand neu auf.
  git reset --soft HEAD~1
done

echo "::error::Nach $VERSUCHE Versuchen nicht gepusht. Die geholten Daten sind im Lauf-Verzeichnis, nicht im Repo."
exit 1
