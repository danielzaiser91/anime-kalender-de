# Der Weg zur Autonomie

Geschrieben am 28.08.2026, nachdem Daniel eine berechtigte Frage gestellt hat:
*„deshalb hab ich dich auch darauf angesetzt einen plan zu entwickeln wie das am
besten umzusetzen ist. was ist daraus geworden?"*

Antwort: Der Plan steht seit dem Morgen in `prime-erfassung-neu.md`, und ich habe
den Tag über Symptome gefixt statt ihn umzusetzen. Achtundzwanzig Fassungen der
Erweiterung, jede einzelne berechtigt, keine davon auf dem Weg zum Ziel.

Dieses Dokument ist der Plan dorthin. Es beschreibt keinen Umbau der Erweiterung,
sondern den Weg zu einem Projekt, das ohne Daniel und ohne mich läuft.

## Das Ziel, in einer Zahl

**Die Prüfliste ist leer, und sie füllt sich nicht wieder.**

Heute stehen dort 190 Prime-Suchen, 45 Netflix-Verweise und 22 YouTube-Verweise.
Jede Zeile kostet Daniel einen Klick, eine Prüfung und eine Entscheidung. Er hat
das am 28.08.2026 so beschrieben: *„die prüfliste ist extrem mühselig für mich
abzuarbeiten."*

Autonomie heißt nicht, dass die Liste verschwindet — sie heißt, dass **nur noch
das darin steht, was eine Maschine nicht entscheiden kann**, und dass dieser Rest
klein und stabil ist.

## Die zwei Regeln, aus denen alles folgt

Beide stammen von Daniel, beide sind gemessen bestätigt:

### 1. Gemeldet wird generisch, zugeordnet wird später

> „generisches melden von den seiten, anschließend das mapping genauer machen"

Die Erweiterung soll **nicht** entscheiden, welche Folge zu welcher Staffel
gehört. Sie steht im Browser, sieht eine Seite, und die Seite verrät ihre
Zuordnung nicht — Prime führt Higurashi Kai als Staffel 2, unser Bestand als
eigenen Titel; Prime nummeriert Danganronpa durch, unser Bestand trennt in Arcs.

Jeder Versuch, das auf der Seite zu lösen, endet in einer Sonderregel. Der Tag
hat davon ein Dutzend gesehen — Bündelung, Teilung, Bände, Kanal-Titel,
Jahreszahlen, Teilnummern. Sie waren alle richtig und keine hat das Problem
gelöst.

### 2. Der gemeinsame Schlüssel ist der Folgentitel, nicht die Nummer

> „jeder anbieter sortiert anders, aber die folgen heißen identisch überall
> (episodentitel). episodennummer etc können unterschiedlich sein, aber
> episodentitel und original release date zB nicht"

Das deckt sich mit allem, was dieses Projekt gemessen hat: Prime führt in einer
Liste die deutsche Zählung neben der japanischen (149–151 neben 1146–1148),
Crunchyroll vergibt Staffelnummern der Form `S00095473`, Netflix zählt wieder
anders. Der Folgentitel ändert sich dabei nicht, und das Erstausstrahlungsdatum
auch nicht.

**Keine Wortlisten, keine Heuristiken.** Daniel ausdrücklich: *„nur einfache
logik, keine komplexe, keine wortliste oder sonstiges wo filme und ova
mitrutschen könnten, nur simple staffel zuordnungen."*

## Wo wir heute stehen — gemessen, nicht geschätzt

| Was | Stand 28.08.2026 |
|---|---|
| Rohfolgen im Briefkasten | 5.219 (nach dem Dubletten-Fix) |
| davon automatisch zugeordnet | **1 von 67 Adressen** |
| Titel mit Folgentiteln (TMDB) | 594 von 2.763 |
| davon mit **echten** Titeln (nicht „Folge 1") | 544 |
| echte Folgentitel gesamt | 17.706 |
| Titel mit aniSearch-Kennung | 2.615 von 2.763 |
| aniSearch-Episodenlisten geholt | **0** |

Die entscheidende Zeile ist die zweite: Die Kette liefert, aber sie ordnet nicht
zu. Der Grund ist banal und in einer Stunde behoben (Phase 1).

Die vierte und die letzte Zeile sind der eigentliche Engpass: Für zwei Drittel
unserer Titel kennen wir keine Folgentitel, und die beste Quelle dafür holen wir
gar nicht ab.

## Die Phasen

### Phase 1 — Die Adress-Lücke schließen

**Problem:** Die Erweiterung meldet unter der Adresse aus unserem Bestand (der
Suchadresse), die Rohfolgen tragen dieselbe Adresse — aber `fetch-rohfolgen.ts`
sucht den Titel über `titles.streams.url`, und dort steht bei einem Titel ohne
Verweis nichts. Deshalb 66 von 67 Adressen mit „kein Titel zu dieser Adresse".

**Lösung:** Die Meldung trägt bereits die Titel-Kennung im Auftrag (`id`). Sie
muss mitgeschickt und in `prime_folge` gespeichert werden. Dann ist die Zuordnung
Adresse → Titel keine Suche mehr, sondern eine Angabe.

**Messgröße:** zugeordnete Adressen von 1 auf über 60.
**Aufwand:** Migration, Worker-Feld, ein Feld in der Meldung. Eine Stunde.

### Phase 2 — aniSearch-Episodenlisten als Anker

**Problem:** TMDB kennt 594 unserer Titel, davon 50 nur mit Platzhaltertiteln.
aniSearch führt **deutsche** Folgentitel, trennt korrekt nach Arcs (Daniels
Danganronpa-Beispiel) — und wir holen von dort nur die Folgen*zahl*.

**Lösung:** `anisearch.de/anime/<id>/episodes` abrufen und je Folge Nummer,
Datum, Laufzeit und die drei Titel (japanisch, englisch, deutsch) archivieren.
Der Abruf ist derselbe Weg wie der bestehende `fetch-anisearch.ts`, mit
demselben Takt und derselben Archivierung.

**Messgröße:** Titel mit echten Folgentiteln von 544 auf über 2.000.
**Aufwand:** Ein Abrufskript plus Parser, Vorlage vorhanden. Ein halber Tag.

### Phase 3 — Zuordnung über Titel und Datum, ohne Nummern

**Problem:** `shared/folgen-zuordnung.ts` versucht heute Datum, dann Titel, dann
Position. Die Position ist der Notausgang, der falsche Ergebnisse erzeugt, wenn
die anderen beiden nicht greifen.

**Lösung:** Die Position fällt weg. Was sich weder über den Titel noch über das
Datum zuordnen lässt, bleibt **offen** und landet in einer Liste, die niemand
abarbeiten muss — sie ist der Messwert dafür, wie gut die Anker sind.

Dazu die Regel, die Daniel vorgibt: **nur einfache Zuordnungen**. Zwei Folgen mit
demselben normalisierten Titel und demselben Datum sind dieselbe Folge. Alles
andere ist offen.

**Messgröße:** Anteil zugeordneter Rohfolgen; offen bleiben ist erlaubt, falsch
zuordnen nicht.
**Aufwand:** Umbau einer vorhandenen Datei. Ein halber Tag.

### Phase 4 — Die Erweiterung hört auf zu urteilen

Erst wenn Phase 3 nachweislich trägt. Dann fällt aus `amazon.js` alles weg, was
über Staffeln, Bündel, Bände, Teilbereiche und Vollständigkeit entscheidet — nach
heutigem Stand rund neunzig Entscheidungspunkte. Übrig bleibt: lesen, alles
schicken, Erfolg anzeigen.

**Das ist ein Abzug, kein Anbau.** Die Erweiterung wird kleiner, nicht größer.

**Messgröße:** Zeilen in `amazon.js` (heute 6.400), Zahl der Fassungen je Woche.
**Aufwand:** Ein Tag, überwiegend Löschen.

### Phase 5 — Die Prüfliste schrumpft von selbst

Was heute in der Liste steht, ist zu großen Teilen kein echter Prüffall:

- **Fortsetzungen**, die über die Serienseite mitgeprüft werden (Higurashi Kai,
  Bungo Stray Dogs 2). Sie fallen weg, sobald die Zuordnung Folgen statt Staffeln
  vergleicht — dann ist es gleichgültig, unter welchem Eintrag gemeldet wurde.
- **Falsche TMDB-Vorschläge.** Gemessen an einem Beispiel: Unsere OVA 20779
  wurde auf die TV-Serie TMDB 61695 abgebildet, und deren Anbieter landeten als
  Vorschlag in der Liste. Ein Abgleich von Format und Jahr zwischen unserem
  Eintrag und dem TMDB-Treffer sortiert das aus.
- **Titel ohne deutsche Fassung.** Wo ANN keine deutschen Sprechrollen kennt und
  keine Quelle einen deutschen Ton nennt, ist die Wahrscheinlichkeit gering. Sie
  gehören ans Ende der Liste, nicht an den Anfang.

**Messgröße:** Länge der Prüfliste. Ziel: unter 50 Einträge, und zwar solche, die
wirklich nur ein Mensch entscheiden kann.

### Phase 6 — Was ein Mensch entscheiden muss, wird beantwortbar

Der Rest wird nie null. Aber er kann so aufbereitet sein, dass eine Antwort
Sekunden statt Minuten kostet:

- Die Frage steht ausformuliert da („Ist Folge 13 auf dieser Seite unsere Folge 1
  des Despair Arc?"), statt dass Daniel sie sich erschließen muss.
- Die Vergleichsdaten stehen daneben: unser Folgentitel, der Folgentitel der
  Seite, beide Daten.
- Die Antwort ist ein Klick, kein Formular.

## Was das für heute heißt

Die Reihenfolge ist bindend: Phase 1 zuerst, weil ohne sie nichts gemessen werden
kann. Phase 2 danach, weil Phase 3 ohne Anker nichts zu vergleichen hat.

**Was in dieser Reihenfolge nicht vorkommt, wird nicht gebaut** — auch dann
nicht, wenn ein Screenshot einen echten Fehler zeigt. Ein Fehler in der
Erweiterung, der in Phase 4 ohnehin gelöscht wird, ist kein Fehler mehr, sondern
Ballast. Er kommt in `status.md`, nicht in eine neue Fassung.

Das ist die eigentliche Lehre des 28.08.2026: Achtundzwanzig Fassungen an einem
Tag sind kein Fleiß, sondern ein Ausweichen vor der eigentlichen Arbeit.
