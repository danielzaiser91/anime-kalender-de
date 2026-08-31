#!/usr/bin/env bash
#
# Die eine Liste aller Pfade, die ein Datenlauf schreiben darf.
#
# Sie stand bis zum 30.08.2026 in `commit-data.sh`. Seit `quellen-pr.sh` sie
# ebenfalls braucht, liegt sie hier: Zwei Fassungen derselben Liste laufen
# auseinander, und eine fehlende Zeile kostet die Arbeit eines ganzen Laufs —
# still, denn `git add` kennt nur, was hier steht.
#
# Wird mit `source` eingebunden, nicht ausgeführt.

# Alles, was ein Lauf schreiben kann. Nicht jeder Lauf berührt alles; fehlende
# Pfade werden übersprungen.
QUELLEN=(
  data/anisearch.json
  data/anisearch-folgen.json
  data/anisearch-titel.json
  data/termine-verpasst.json
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
  daniel-zum-abarbeiten/12-verpasste-termine.md
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
