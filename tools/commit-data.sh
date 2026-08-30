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
  data/anisearch-folgen.json
  data/anisearch-folgen-raw
  data/crunchyroll.json
  # Was ein Lauf an Verweisen entfernt hat, mit Grund und Prüfdatum. Kein
  # Erzeugnis der Website, sondern das Gedächtnis dazu — siehe build.ts.
  data/verweise-entfernt.json
  data/adn.json
  # Fehlte hier, seit es die Datei gibt — gefunden am 14.08.2026 durch die neue
  # Prüfung in `tools/check-workflows.mjs`. `npm run data:adn:catalog` läuft
  # **wöchentlich** in der CI und holt 583 KB Katalogdaten; committet wurden sie
  # nie, und bei bewegtem Fernstand warf der Reset sie weg. Der Lauf tat also
  # jede Woche dieselbe Arbeit umsonst.
  data/adn-catalog.json
  # Die ADN-Rohantworten, rund 5 KB je Serie. Sie standen hier nie — und weil
  # `git add` nur diese Liste kennt, hat **kein** CI-Lauf je eine archiviert:
  # Der Bestand wuchs nur, wenn jemand von Hand committete (zuletzt am
  # 21.08.2026, „206 ADN-Rohantworten nachgetragen"). Seit der Build die
  # Sprachangabe je Folge aus diesem Archiv liest, ist das keine verschenkte
  # Bequemlichkeit mehr, sondern eine Quelle, die nicht mitwächst.
  data/adn-raw
  # Dasselbe für aniSearch: 110 Seiten liegen im Repo, jede weitere, die ein
  # Lauf holt, fiele ohne diese Zeile unter den Tisch — und ein Abruf über 2.612
  # Seiten ist genau das, was das Archiv ersparen soll.
  data/anisearch-raw
  # Was die Browser-Erweiterung meldet, landet über `data:pruefungen` hier —
  # die einzige Quelle im Projekt, die weder rät noch schweigt, und die
  # teuerste, weil sie Daniels Zeit kostet statt Rechenzeit. Der Schritt läuft
  # seit dem 24.08.2026 täglich; ohne diese Zeile hätte der Reset seine Arbeit
  # jeden Tag verworfen, und die Meldungen wären im Worker liegen geblieben.
  data/dub-confirmed.yaml
  # Die Staffelaufteilung je Anbieter-Adresse, aus denselben Meldungen. Sie
  # ist der Schlüssel, um eine Meldung später einer unserer Staffeln
  # zuzuordnen, auch wenn der Anbieter anders einteilt.
  data/anbieter-staffeln.json
  data/tmdb.json
  # Deutsche Handlung, FSK und Anbieter je Titel. Fehlte hier bis zum
  # 21.08.2026 — der Abruf lief allerdings auch in keinem Workflow.
  data/tmdb-titles.json
  data/tmdb-folgen.json
  data/anbieter-vorschlaege.json
  data/wiedervorlage.json
  data/qualitaet-verlauf.json
  data/disc-ausgaben.json
  data/prime-zugeordnet.json
  data/prime-unzugeordnet.json
  data/cr-vorschlaege.json
  data/adn-vorschlaege.json
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
  # Wann welche ANN-Kennung zuletzt abgefragt wurde. Ohne diese Datei bildet die
  # Warteschlange sich wieder aus „welche Rohdatei fehlt" — und ist nach dem
  # ersten vollständigen Durchlauf für immer leer (25.08.2026). Das Dateidatum
  # taugt als Ersatz nicht: `git checkout` setzt es auf jetzt.
  data/ann-holstand.json
  # Ergebnis des Crunchyroll-Synchro-Laufs. Steht hier vorsorglich: Läuft er
  # eines Tages in der CI, wären 918 Seitenabrufe sonst nach einem Reset weg.
  data/crunchyroll-dub.json
  # Adresse → Serienkennung. Ein Gedächtnis, kein Zwischenspeicher: Die alte
  # Slug-Form `/de/<slug>` trägt keine Kennung, und sie herauszufinden kostet
  # einen vollen Seitenaufruf je Adresse. Würfe der Reset die Datei weg, zahlte
  # jeder Lauf diesen Preis erneut — 676 Seitenaufrufe auf einem fremden Server
  # für eine Angabe, die sich nie ändert.
  data/crunchyroll-series-ids.json
  # Die Rohantworten der Content-API. Aus demselben Grund wie `data/adn-raw`:
  # Ein später gebrauchtes Feld muss eine Änderung am Parser sein können und
  # nicht ein zweiter Lauf über 959 Serien. Hier hängt konkret der deutsche
  # Termin je Folge daran — er liegt schon in diesen Dateien, ausgewertet wird
  # er noch nicht.
  data/crunchyroll-raw
  # Ergebnis der YouTube-Prüfung: je Adresse, wie viele der dort verlinkten
  # Videos in Deutschland überhaupt abrufbar sind. Ohne diese Zeile würfe der
  # Reset sie weg, und der nächste Lauf befragte dieselben 513 Adressen erneut.
  data/youtube-check.json
  # Antwortstatus je Anbieter-Adresse. Ohne diese Zeile fängt der nächste
  # Lauf wieder bei null an und klopft 945 fremde Seiten erneut ab.
  data/link-check.json
  # Deutsche Tonspuren von der Streaming Availability API. Die teuerste Quelle
  # im Bestand, gemessen in Kontingent: 1.000 Anfragen im **Monat**, und in der
  # Datei steht neben den Ergebnissen auch der Verbrauch je Monat und der
  # Cursor des Katalogdurchlaufs. Würfe der Reset sie weg, begänne der nächste
  # Lauf den Katalog von vorn — und der Zähler stünde wieder auf null, während
  # die Anfragen längst verbraucht sind.
  data/motn.json
  # Die Rohantworten dazu. Aus demselben Grund wie `data/ann-raw`: Ein später
  # gebrauchtes Feld muss eine Änderung am Parser sein können, kein zweiter
  # Lauf gegen ein Monatskontingent.
  data/motn-raw
  # Die Anbieter-Deep-Links, aus dem Archiv gezogen (`pipeline/motn-links.ts`).
  # Sie ersetzen im Bau die Amazon-Suchadressen, die aniSearch liefert — ohne
  # diese Zeile wäre die Datei nach jedem CI-Lauf wieder weg, und der Bau
  # fiele stillschweigend auf die Suche zurück.
  data/motn-links.json
  # Deutsche Anime-Kinostarts, wöchentlich bei TMDB geholt. Vorschläge, kein
  # Kalender — ohne diese Zeile wäre der Fund nach jedem CI-Lauf wieder weg,
  # und niemand sähe je, dass ein Kinostart fehlt.
  data/tmdb-kino.json
  # Die Sprachfassung der Kinostarts, bei der FSK belegt. Sie ist die einzige
  # geprueefte Quelle, die deutsche Synchro von OmU unterscheidet.
  data/fsk-kino.json
  # Kinotermine und Sprachfassung von CineStar, je Vorstellung ueber 43
  # Standorte. Die genaueste Fassungsquelle, die geprueeft wurde.
  data/cinestar.json
  # Kontrollmessung und Arbeitslisten. Sie entstehen aus dem Datensatz, aber
  # ein Mensch arbeitet mit ihnen — sie gehören ins Repo, nicht in den Lauf.
  # Was YouTubes oEmbed und die Videoseite je Adresse hergeben: lebt der
  # Verweis, welcher Kanal, welche Tonspur, und ob ein Kaufangebot dahintersteht.
  # Fehlte bis zum 24.08.2026 — jeder wöchentliche Lauf holte die Antworten und
  # der Reset warf sie weg. Die Datei im Repo stammte deshalb vom 23.08. aus
  # einem lokalen Lauf, und die Kauffilme standen unterdessen als "kostenlos"
  # im Kalender.
  data/youtube-befunde.json
  # Dasselbe für RTL+: welche Adresse lebt, welche leitet auf die Startseite um.
  data/rtlplus-befunde.json
  # Der Abgleich gegen RTL+' eigene Sitemaps (30.08.2026). Deren robots.txt lädt
  # ausdrücklich dazu ein — `Allow: /`, keine einzige namentliche Bot-Sperre —
  # und der Katalog führt weit mehr als die 40 Verweise, die wir bis dahin
  # hatten. Ohne diese Zeile wäre der Lauf in jedem CI-Durchgang umsonst.
  data/rtlplus-katalog.json
  # Die Neuzugänge der Streaming Availability API, ein Abruf am Tag gegen ein
  # Monatskontingent von 1.000. Ohne diese Zeile war der teuerste Lauf im
  # Projekt der einzige ohne Gedächtnis.
  data/motn-changes.json
  # Terminvorschläge aus aniSearch. Sie entstehen aus dem Archiv und werden von
  # Hand geprüft — eine verworfene Fassung kostet den Prüfschritt erneut.
  data/curated/disc-anisearch.yaml
  data/motn-messung.md
  daniel-zum-abarbeiten/07-alle-anbieter.md
  # Die Liste, mit der die Browser-Erweiterung arbeitet. Sie entsteht aus dem
  # gebauten Datensatz und veraltet ohne diese Zeile still: Bis zum 25.08.2026
  # lief ihr Erzeuger in keinem Workflow, die Datei stammte vom 23.08., und die
  # Erweiterung bot Titel zum Melden an, die längst geprüft waren — 384 offene
  # Prime-Titel, von denen ein guter Teil erledigt war.
  data/bestand-historie.jsonl
  data/crunchyroll-de-kennungen.json
  data/cr-einzelwerke.json
  data/cr-filmbloecke.json
  data/cr-katalog-de.json
  data/cr-katalog-zuordnung.json
  extension/offene-amazon.js
  extension/offene-amazon-suche.js
  extension/offene-netflix.js
  extension/offene-disney.js
  daniel-zum-abarbeiten/08-arbeitspakete.md
  # Die Listen je Anbieter — sieben Dateien, die `data:dub-checks` bei jedem Lauf
  # neu schreibt und die bis zum 29.08.2026 keine einzige Zeile hier hatten.
  # Ergebnis: Der Lauf erzeugte sie, der Commit nahm sie nicht mit, der `git
  # reset` warf sie weg. Im Repo stand der Stand vom 24.08. — `07-primevideo.md`
  # nannte **588 offene Verweise**, tatsaechlich offen waren 58.
  #
  # Genau die Falle aus CLAUDE.md, „Ein neuer Abruf braucht drei Dinge", nur fuer
  # ein Erzeugnis: Wer eine Datei schreibt, ohne sie hier einzutragen, schreibt
  # sie in jedem Lauf umsonst.
  daniel-zum-abarbeiten/07-adn.md
  daniel-zum-abarbeiten/07-crunchyroll.md
  daniel-zum-abarbeiten/07-disneyplus.md
  daniel-zum-abarbeiten/07-joyn.md
  daniel-zum-abarbeiten/07-netflix.md
  daniel-zum-abarbeiten/07-primevideo.md
  daniel-zum-abarbeiten/07-youtube.md
  daniel-zum-abarbeiten/06-netflix-rest.md
  daniel-zum-abarbeiten/09-youtube-liste.md
  daniel-zum-abarbeiten/10-rtlplus.md
  daniel-zum-abarbeiten/10-kinostarts.md
  daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md
  daniel-zum-abarbeiten/00-START-HIER.md
)
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
