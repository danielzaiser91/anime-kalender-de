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
