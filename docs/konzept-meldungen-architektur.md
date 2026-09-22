# Meldungen, Belege, Urteile: Analyse und Konzept

Stand 22.09.2026. Anlass: Daniels Zweifel am Architekturkonzept („melden – eintragen – zuordnen –
anzeigen … möglichst simpel, möglichst genau und fehler-unanfällig"). Umgesetzt wird erst nach
seinem OK.

## Die Zweifel und was der Code dazu sagt

| # | Zweifel | Befund im Code | Urteil |
|---|---|---|---|
| 1 | Getrennte Angaben für „vorhanden" und „deutsch"? | Die Meldung (`pruefung`, D1) hat **ein** Feld `befund` mit `dub \| kein_dub \| weg`. Verfügbarkeit und Sprache stecken im selben Feld. Gesperrte Folgen schickt Prime **nicht als Zeile**: Sie werden aus der Zählung genommen und nur in der Notiz genannt (`amazon.js`, `gesehen.gesperrt`). | **bestätigt** |
| 2 | Melder und Zuordner getrennt? | Die Erweiterung meldet nicht nur, sie deutet: Prime schickt meist **ein** Urteil je Staffel statt je Folge, Netflix rechnet Staffeln selbst zu (`staffelnDerGruppe`), die Randprobe schreibt angenommene Folgen als `dub`. Der Einleser (`fetch-pruefungen.ts`, 1.499 Zeilen) ordnet zu **und** verdichtet zu Bereichen **und** schreibt das Ergebnis als Handbeleg. | **bestätigt** |
| 3 | Wacklig statt simpel? | `build.ts` hat 8.838 Zeilen, 26 Stellen setzen `dub`, 14 Riegel `if (dub !== undefined) continue` legen die Rangfolge der Quellen **durch die Reihenfolge im Code** fest. Heute allein: Staffel-4-Zuordnung, Notiz der falschen Meldung, Linkbefund gegen Handprüfung, Zusicherung mit Rückfall auf fremden Weg — alles Folgen davon, dass jede Stelle ihre eigene Teilwahrheit rechnet. | **bestätigt** |
| 4 | Glaubwürdigkeit je Behauptung? | Gibt es nicht als Zahl. Es gibt eine feste Reihenfolge (Handbeleg vor Automatik vor Quelle) und viele Einzelausnahmen (Kanal-Titel, „Nichtauskunft ist kein Nein", Randprobe). | **bestätigt** |
| 5 | Nachprüfung nach Zeit und auf Verdacht? | **Teilweise vorhanden**: `wiedervorlage.ts` (180 Tage), `tonspur-verdacht.ts` (MOTN nimmt eine Aussage zurück), `kanal-gegenprobe.ts` (Widerspruch). Drei getrennte Mechanismen, jeder mit eigener Datei. | **teilweise** |
| 6 | Rohdaten und Deutung vermischt | Nach dem Einlesen gilt `data/dub-confirmed.yaml` (2.001 Einträge) — das ist schon gedeutet (AniList-Kennung, Bereiche, Notiz). Die Rohmeldung bleibt in D1, wird aber vom Bau nicht mehr gelesen. Eine falsche Zuordnung ist damit **eingebrannt**. | **bestätigt** |
| 7 | Rangfolge als Code-Reihenfolge | siehe 3; `CLAUDE.md` warnt selbst davor („Reihenfolgen brechen leise"). | **bestätigt** |
| 8 | Urteile auf Titel- statt Folgenebene | `weg` als jüngste Meldung → `available: false` für den **ganzen Titel** (Fairy Tail: Staffel 1 gesperrt würde Staffel 2–9 streichen). | **bestätigt** |
| 9 | Zuordnung an mehreren Stellen | Erweiterung (Staffelwahl, Prüfliste in Netflix-Zählung), Einleser (Staffelnummern, Anbieterstruktur, Folgentitel-Anker), Bau (`belegFuer`, Adresskerne). | **bestätigt** |
| 10 | Mehrere Wahrheiten für „offen" | Prüfstand, Worker (`?stand=1`), lokaler Abhak-Speicher der Erweiterung, Briefkasten. | **bestätigt** |
| 11 | Angenommen nicht als Angabe | „ANGENOMMEN aus Randprobe" steht nur im Freitext der Notiz. | **bestätigt** |
| 12 | Belege hängen an AniList-Einträgen | Anbieter schneiden anders (Fate UBW: AniList 13+13, MOTN 25, Netflix 13+13 als „Teile"; Haikyu TO THE TOP: Netflix-Staffel 4 = zwei AniList-Titel). Jede Abweichung braucht eine Sonderregel. | **bestätigt** |

**Kurz:** Die Zweifel sind berechtigt. Die Einzelteile funktionieren, aber jede Stufe tut mehr als
ihre eine Aufgabe, und das Urteil entsteht aus der Reihenfolge von Sonderfällen statt aus einer Regel.

## Konzept: vier getrennte Stufen

```
Beobachtung (roh, unveränderlich)  →  Zuordnung (Anbieter-Folge → unsere Folge)
        →  Urteil (je Folge und Anbieter, aus allen Beobachtungen)  →  Anzeige (je Titel)
```

### 1. Beobachtung — der Melder schreibt nur, was er sah

Eine Zeile je **Anbieter-Folge** und Quelle, nie verdichtet, nie überschrieben:

| Feld | Werte |
|---|---|
| anbieter, seite (ASIN / Netflix-Kennung / Serien-ID), anbieter_staffel, anbieter_folge, folgentitel | wie auf der Seite |
| vorhanden | `ja` · `nein` (gesperrt, nicht im Angebot) · `unbekannt` |
| ton_de | `ja` · `nein` · `unbekannt` (bei `vorhanden: nein` immer `unbekannt`) |
| art | `gemessen` · `angenommen` (Randprobe) |
| quelle, zeitpunkt, notiz | Erweiterung, Daniel von Hand, MOTN, JustWatch, ADN, Crunchyroll … |

Meldet Daniel Folge 10 von Staffel 4, entsteht **eine** Zeile. Alles andere bleibt ungemeldet.
Die Erweiterung rechnet nichts zu und urteilt über keine Staffel. D1 `pruefung` ist schon nahe dran;
es fehlen die getrennten Felder und die Zeile je Folge bei Prime.

### 2. Zuordnung — eigene Tabelle, jederzeit neu berechenbar

`(anbieter, seite, anbieter_staffel, anbieter_folge) → (AniList-Titel, Folge)`, mit eigenem Beleg
(Folgentitel, TMDB, Zählung, von Hand). Die heutigen Werkzeuge (Folgentitel-Anker,
`anbieter-staffeln.json`, Staffelnummern) wandern **hierher** und nur hierher. Eine falsche Zuordnung
wird an einer Stelle berichtigt, und alle Urteile rechnen sich neu — nichts ist eingebrannt.

### 3. Urteil — eine Funktion, eine Regel

Je `(Titel, Folge, Anbieter)` alle zugeordneten Beobachtungen; Gewicht = Glaubwürdigkeit der Quelle ×
Alter. Vorschlag:

| Quelle | Gewicht |
|---|---|
| Erweiterung, gemessen | 100 |
| Daniel von Hand (Bild, Text) | 95 |
| Erweiterung, angenommen (Randprobe) | 70 |
| Anbieter-Schnittstelle (ADN `vde`, Crunchyroll-Katalog) | 80 |
| MOTN | 60 |
| JustWatch | 50 |
| aniSearch / Katalog-Angaben | 30 |

Das jüngste Urteil der höchsten Gewichtsklasse gilt; Gewicht halbiert sich z. B. alle 180 Tage.
**Widersprechen sich zwei Quellen oberhalb einer Schwelle, entsteht ein Verdacht** — und der landet
in der Prüfliste. Das ersetzt Wiedervorlage, Tonspur-Verdacht und Kanal-Gegenprobe durch **einen**
Mechanismus. Kanal-Titel sind dann keine Sonderregel mehr, sondern eine Quelle mit niedrigem Gewicht
für `ton_de: nein`.

### 4. Anzeige — der Bau fragt nur noch das Urteil

„x von N Folgen auf Deutsch", „nicht verfügbar", „Staffel 1 fehlt" ergeben sich aus den Urteilen je
Folge. Der Bau setzt `dub` an **einer** Stelle. Prüfliste, Prüfstand und Worker lesen dasselbe
Urteil: offen ist, was `unbekannt` ist oder einen Verdacht trägt.

## Weg dorthin — erst belegen, dann umbauen

1. **PoC ohne Schreiben:** Stufe 1–3 aus den vorhandenen Daten rechnen (D1-Meldungen,
   `dub-confirmed.yaml`, MOTN, ADN, Crunchyroll) und das Ergebnis gegen den heutigen Datensatz halten.
   Ausgabe: Trefferquote und Liste aller Abweichungen, bewusst mit den schwierigen Fällen von heute
   (Fate UBW, Haikyu TO THE TOP, Fairy Tail, A Silent Voice, Dr. STONE, Kanal-Titel).
2. Erst wenn der PoC trägt: Erweiterung auf „eine Zeile je Folge, getrennte Felder" umstellen
   (Worker-Migration, Prime und Netflix).
3. Einleser wird zum reinen Zuordner; `dub-confirmed.yaml` bleibt als Quelle „Daniel von Hand"
   bestehen, aber nicht mehr als Sammelbecken für eingelesene Meldungen.
4. Bau: die 26 Setzstellen durch das Urteil ersetzen, Schritt für Schritt je Quelle, mit
   `check:handbelege` als Gegenprobe.

Aufwand grob: PoC 1–2 Tage, Umbau insgesamt eine bis zwei Wochen, gestaffelt, ohne dass die Seite
zwischendurch schlechter wird.

## PoC — Messungen

**Rohmeldungen in D1, 22.09.2026 (4.433 Zeilen):** 1.563 (35 %) sind Staffelurteile ohne
Folgennummer, davon 1.395 von Prime; 912 Netflix-Zeilen sind Randproben-Annahmen (nur am Notiztext
„ANGENOMMEN" erkennbar); alle 315 `weg`-Meldungen sind staffelweit — eine einzelne gesperrte Folge
lässt sich heute nicht melden. Folge für Stufe 1: Prime muss je Folge melden; bis dahin gelten
Staffelurteile im PoC als `art: abgeleitet` für alle Folgen der Anbieter-Staffel.

**Stufe 2, erster Schnitt (22.09.2026), nur über die Adresse:** von 4.433 Rohmeldungen 57 % eindeutig
(1.889 über Weg oder frühere Zuordnung aus `dub-confirmed.yaml`, 632 mit `titel_id` aus der Meldung),
25 % mehrdeutig (1.122 — mehrere unserer Titel an derselben Adresse, braucht Anbieter-Staffel und
Folge), 18 % ohne jeden Anker (790, vor allem Prime: die Seite von damals steht nicht mehr im
Datensatz — gti-Brücke, neue ASINs). **Folgerung:** Eine Beobachtung muss ihren Titel beim
Zuordnen festhalten (Stufe 2 ist eine eigene, gespeicherte Tabelle), sonst verliert sie ihn, sobald
sich der Weg ändert.

**Stufe 2, zweiter Schnitt (22.09.2026), mehrdeutige Adressen:** Mit dem Folgentitel-Anker und
`ordneMeldungZu` gegen Netflix' Staffelaufteilung löst der PoC 358 von 410 mehrdeutigen
Netflix-Meldungen (211 über den Folgentitel). Disney+ (157) fehlt eine Staffelaufteilung als Datei,
Prime-Staffelurteile ohne Folge (33) sind grundsätzlich nicht auflösbar. **Befund mit Gewicht:** Die
Reihenfolge der Titel an einer Adresse (japanische Ausstrahlung, im PoC wie im Einleser
`staffelnDerAdresse`) liegt dort falsch, wo ein Special zwischen zwei Staffeln lief, der Anbieter es
aber hinten anhängt — Dr. STONE: Ryusui (2022) vor New World (2023), Netflix führt es als Folge 23
von Staffel 3. Ohne Folgentitel landet S3 F1 beim Special. Die Prüfliste der Erweiterung ordnet
dieselbe Staffel richtig — zwei Zuordnungen, zwei Ergebnisse (Zweifel 9).

**Stufe 3, erster Schnitt (22.09.2026), ein Urteil je Titel × Anbieter** (`tools/poc-urteil/urteil.mjs`,
höchstes Gewicht, dann jüngstes): 589 Urteile. Von 421 vergleichbaren stimmen 390 mit dem heutigen
Datensatz überein; 31 widersprechen, alle in drei Mustern — (1) **Zeit**: eine ältere gemessene
Beobachtung schlägt eine neuere (Kill Blue: Synchro kam später; Das Band der Unterwelt), (2)
**Ausgaben**: zwei Prime-Seiten eines Titels vermischt (Digimon Tamers), (3) **Staffel statt Titel**:
„nicht verfügbar" einer Staffel gilt dem Titel (Arifureta, Goblin Slayer 2). Folgerung: Das Urteil
braucht die Achsen Seite und Folge, und Aktualität muss gegen Gewicht abgewogen werden.

## Szenarien — gewünschtes Verhalten (wird mit Daniel festgelegt, bevor eine Regel gewählt wird)

| # | Szenario | Beispiel | gewünschtes Verhalten |
|---|---|---|---|
| 1 | Synchro kommt später: früher „kein Deutsch" gemessen, jetzt sagt eine Quelle „Deutsch" | Kill Blue | offen |
| 2 | Synchro oder Titel verschwindet: früher „Deutsch", jetzt „kein Deutsch" / „nicht verfügbar" | Lizenzende | offen |
| 3 | Schwache Quelle widerspricht starker zur selben Zeit | MOTN gegen Meldung | offen |
| 4 | Kanal-Nein: Kanal-Seite ohne Abo zeigt kein Deutsch, andere Quelle Deutsch | A Silent Voice | offen |
| 5 | Angenommen (Randprobe) gegen gemessen (Einzelfolge) | — | offen |
| 6 | Zwei Ausgaben beim selben Anbieter mit verschiedenem Stand | Digimon Tamers | offen |
| 7 | Teilweise nicht verfügbar (Staffel oder Folgen gesperrt) | Fairy Tail, Arifureta | offen |
| 8 | Keine Beobachtung, nur Katalogangabe | aniSearch-Marke | offen |
| 9 | Laufende Staffel, spätere Folgen noch nicht erschienen | — | offen |
| 10 | Störung statt Auskunft (Fehlerseite, 403, leere Tonspurliste) | — | offen |
| 11 | Nicht sicher zuordenbar (mehrere unserer Titel) | Dr. STONE S3 | offen |

## Regel über allen Szenarien: Überstimmung der eigenen Aussage (Daniel, 22.09.2026)

Wann immer im Kalender nicht mehr die eigene Aussage (höchste Wertigkeit) steht, sondern die einer
anderen Quelle — auch als „vermutlich" (≈) —, dann:

1. **sofort auf die Nachprüfliste**, mit Grund (welche Quelle, was sie sagt, seit wann);
2. **Protokoll** jeder Überstimmung (Folge, eigene Aussage, fremde Aussage, Zeitpunkt, angewandte Regel);
3. **Eichung**: Die Nachprüfung bestätigt oder widerlegt die fremde Quelle; jede Quelle führt eine
   Trefferquote (bestätigt / widerlegt). Die Gewichte in der Tabelle oben sind nur Startwerte und
   werden durch gemessene Trefferquoten ersetzt.

## Szenario 1 — Stand der Besprechung (22.09.2026)

Unterschieden wird **Wechsel** (die Quelle sagte zu dieser Folge vorher „kein Deutsch" und jetzt
„Deutsch" — glaubhaft) von **Erstaussage** (erste Aussage der Quelle zu dieser Folge — weniger
glaubhaft). Heute führen einen Verlauf nur die eigenen Meldungen (D1) und ADN
(`adn-vde-historie.json`); MOTN nur teilweise (`motn-changes.json` hält neue Titel, keine
Sprachwechsel), JustWatch, aniSearch und der Crunchyroll-Katalog gar nicht. **Voraussetzung:**
Stufe 1 speichert jeden Abruf jeder Quelle als eigene Beobachtung.

| neue Quelle sagt „Deutsch" | als Wechsel | als Erstaussage |
|---|---|---|
| eigene neue Messung | Deutsch, bestätigt | Deutsch, bestätigt |
| Randprobe, Anbieter-Schnittstelle | Deutsch, bestätigt | Deutsch, bestätigt |
| MOTN | Deutsch + Nachprüfliste | ≈ Deutsch + Nachprüfliste |
| JustWatch, aniSearch | ≈ Deutsch + Nachprüfliste | bleibt „kein Deutsch", nur Nachprüfliste |

Offen: Daniels Bestätigung dieser Fassung.
