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

**Stand 29.08.2026: Phase 3 trägt, die Blockade lag woanders — und ist behoben.**

Die Zuordnung ist gemessen: 6.887 Folgen mit um zwölf verschobener Nummerierung,
99 % richtig, **0 falsch**. Damit wäre Phase 4 fällig. Der Lauf gegen echte
Meldungen ordnete trotzdem **0 von 67 Adressen** zu — und der Grund war keine
fehlende Meldung mit 3.90, wie hier zuerst stand:

`prime_folge.titel_id` gibt es seit Migration 018, `fetch-rohfolgen.ts` liest
das Feld seit demselben Tag — **der Worker hat es nie ausgeliefert.** Es stand
nicht im SELECT. Der Bau fiel deshalb auf die Adresse zurück, und die steht bei
einem Titel ohne Verweis nicht im Bestand; genau die stehen in der Prüfliste.

Im selben Griff gefunden: `LIMIT 5000` bei 5.620 offenen Rohfolgen. 620 hätten
den Bau nie erreicht — sie wären erst nachgerückt, nachdem die älteren
übernommen sind, also nach einem Lauf, den es ohne sie nicht gegeben hätte.
Beides behoben; `?nach=<id>` setzt fort.

**Was jetzt noch fehlt, ist ein `wrangler deploy`.** Danach ist messbar, wie
viele Adressen die Kennung tragen — und erst diese Zahl rechtfertigt, neunzig
Entscheidungspunkte aus `amazon.js` zu löschen. Ein Abzug, der auf einer
Vermutung beruht, ist kein Abzug, sondern ein Ausfall.

**Nachgemessen am 29.08.2026, 11:30 — und der Abzug fällt aus.**

Die „rund neunzig Entscheidungspunkte" waren eine Schätzung. Gezählt sind es
**zehn** Stellen, an denen `amazon.js` das Melden sperrt, und **keine einzige
davon urteilt über unsere Daten**:

| Sperre | worüber sie entscheidet |
|---|---|
| „alles gemeldet", „Staffel gemeldet" | was schon im Briefkasten liegt |
| Störung, Fehlerseite, nicht abrufbar | Zustand der Seite |
| Folgenliste noch nicht geladen | Zustand der Seite |
| Stand noch nicht geladen | Zustand der Erweiterung |
| Zahlen instabil nach Staffelwechsel | Zustand der Seite |
| unvollständig geladen | siehe unten |

Der Zahlenvergleich mit unserer Folgenzahl ist am 28.08.2026 zum **Hinweis**
geworden, die Umrechnung durchgezählter Nummern läuft längst im Bau
(`fetch-pruefungen.ts`), und die Wächter, die bleiben — `quelltextPasst`,
`beiStaffelwechsel`, `istFilmSeite` — prüfen, ob die gelesenen Daten überhaupt
zu dieser Seite gehören. Sie zu entfernen brächte die Fehler zurück, die
CLAUDE.md seitenweise beschreibt.

**Phase 4 ist damit erfüllt, nur anders als gedacht:** Nicht durch einen Abzug,
sondern weil die urteilenden Stellen einzeln weggefallen sind, als der Bau ihre
Aufgabe übernahm. Ein Löschen um der Zeilenzahl willen wäre Schaden.

**Eine Sperre ist entbehrlich geworden — und bleibt trotzdem stehen.**
`istVollstaendig` verbietet das Melden, solange nicht alle Abschnitte geladen
sind. Ihre Begründung war: Die Meldung trägt die Folgenzahl, und aus „24 von 26"
würde im Datensatz eine Reichweite bis 24. Seit 3.77 trägt jede Meldung ihre
Folgen **einzeln** mit Nummer, Titel und Datum; aus 24 gelesenen werden 24
Belege und keine Grenze. Der Grund ist damit weg.

Sie stammt aber aus Daniels ausdrücklicher Ansage („make reporting not possible
until all entries are loaded"), und eine getroffene Entscheidung kehrt man nicht
im Alleingang um. **Vorzulegen, nicht zu machen.** Der Gewinn wäre spürbar: Bei
langen Serien mit vielen Abschnitten müsste er nicht mehr auf alle warten.

**Die Lehre über dem Einzelfall:** Eine neue Spalte ist erst da, wenn sie am
anderen Ende ankommt. Zwei Seiten waren fertig — Migration und Leser —, die
dritte fehlte, und niemandem fiel es auf, weil der Rückfall funktionierte. Ein
Rückfall, der still einspringt, verdeckt genau den Ausfall, gegen den er gebaut
wurde.

### Phase 5 — Die Prüfliste schrumpft von selbst

**Stand 29.08.2026: gemacht, was ohne Daniel geht. Das Ziel „unter 50" ist es
nicht — und zwar aus einem Grund, der sich nicht wegprogrammieren lässt.**

Drei Gruppen sind erledigt:

| | vorher | jetzt |
|---|---|---|
| **Fortsetzungen**, über die Serienseite mitgeprüft | in der Liste | 6 ausgelassen |
| **Falsche TMDB-Vorschläge** (Format oder Jahr passt nicht) | still mitgeschleppt | 8 mit Vermerk, ans Ende sortiert |
| **Titel ohne belegte deutsche Sprechrollen** | gemischt | 44 hinter den aussichtsreichen |

Der Vermerk steht im Kasten der Erweiterung selbst („TMDB kennt nur die Serie,
wir führen OVA"). Gelöscht wird keiner: Ein Vorfilter verschiebt, er löscht
nicht.

**Was übrig bleibt, sind 115 echte Prüffälle** — Titel mit belegter deutscher
Synchro, für die eine Quelle Prime nennt, ohne dass wir eine Titelseite hätten.
Sie ließen sich nur auflösen, indem jemand die Amazon-Suche aufruft und den
richtigen Treffer erkennt.

**Automatisch geht das nicht, und der Beleg ist eindeutig.** Amazons robots.txt
sperrt `/s?k=` im `*`-Block zwar nicht — aber sie führt **19 namentliche
Bot-Blöcke, jeden mit `Disallow: /`**: ClaudeBot, GPTBot, CCBot, PerplexityBot,
Devin, Scrapy, Diffbot und zwölf weitere (gemessen 29.08.2026). Das ist genau die
„besondere Vorkehrung", an der die Rechtslage hängt; der Betreiber sagt damit
unmissverständlich, dass er automatisiertes Auslesen durch Agenten nicht duldet.
`/gp/video/api` — der Weg zur Folgenliste — ist zusätzlich ausdrücklich gesperrt.

**Die Liste ist damit so kurz, wie sie zulässig werden kann.** Was bleibt, ist
kein Automatisierungsrückstand, sondern Arbeit, die nur in einer angemeldeten
Sitzung stattfinden darf — und dort ist sie ein Klick, kein Abgleich: Die
Erweiterung liest, Daniel bestätigt.

**Messgröße, korrigiert:** nicht die Länge der Liste, sondern **der Aufwand je
Eintrag**. Ein Eintrag, der die Frage mitbringt und die Antwort in einem Klick
entgegennimmt, ist billig — hundert davon sind es auch. Ein Eintrag, bei dem
Daniel erst herausfinden muss, was gefragt ist, ist teuer, und zehn davon sind zu
viel. Genau das war seine Ansage am 28.08.2026: „am besten meldung simple und
schnell halten, sodass ich minimalen aufwand hab."

### Phase 6 — Was ein Mensch entscheiden muss, wird beantwortbar

Der Rest wird nie null. Aber er kann so aufbereitet sein, dass eine Antwort
Sekunden statt Minuten kostet:

- Die Frage steht ausformuliert da („Ist Folge 13 auf dieser Seite unsere Folge 1
  des Despair Arc?"), statt dass Daniel sie sich erschließen muss.
- Die Vergleichsdaten stehen daneben: unser Folgentitel, der Folgentitel der
  Seite, beide Daten.
- Die Antwort ist ein Klick, kein Formular.

**Stand 29.08.2026: erfüllt — und die eigentliche Arbeit lag woanders, als hier
stand.**

Der Plan ging davon aus, dass die **Fragen** zu unklar gestellt sind. Gemessen
war das Problem ein anderes: Die Listen, in denen sie stehen, waren falsch.

| | stand dort | war wirklich |
|---|---|---|
| `00-START-HIER.md` (die erste Seite) | „Prime Video: 384 Adressen" | 166 Suchen, 19 Titelseiten |
| `06-netflix-rest.md` | 1 Titel | 42 |
| `07-primevideo.md` | 588 offene Verweise | 65 |
| `07-crunchyroll.md` | Stand 24.08. | 60 offene |

Drei Ursachen, alle behoben: Sieben der neun Listen standen nicht in
`commit-data.sh` und wurden bei jedem Lauf weggeworfen; `data:netflix-rest`
und `data:vorschlaege` hingen in keinem Workflow; und der Netflix-Filter
verlangte, dass MOTN den Titel *vergeblich gesucht* hat — was über die Tonspur
nichts aussagt.

**Die Frage war also längst gut gestellt. Sie stand nur in einem Dokument, das
niemand mehr nachgezogen hat.** Das ist die Lehre über der Phase: Ein Auftrag
kostet nicht nur Zeit, wenn er unklar ist, sondern auch, wenn er falsch ist —
und Letzteres merkt niemand, weil die Liste ja aussieht wie immer.

`00-START-HIER.md` wird deshalb seit heute **erzeugt**, nicht gepflegt: mit
gemessenen Zahlen, dem Weg je Aufgabe („Titelseite öffnen, Abspielen, warten,
zurück") und der Auskunft, worum es geht — 862 Titel ohne Bezugsweg, 538 davon
mit belegter Synchro.

## Was das für heute heißt

Die Reihenfolge ist bindend: Phase 1 zuerst, weil ohne sie nichts gemessen werden
kann. Phase 2 danach, weil Phase 3 ohne Anker nichts zu vergleichen hat.

**Was in dieser Reihenfolge nicht vorkommt, wird nicht gebaut** — auch dann
nicht, wenn ein Screenshot einen echten Fehler zeigt. Ein Fehler in der
Erweiterung, der in Phase 4 ohnehin gelöscht wird, ist kein Fehler mehr, sondern
Ballast. Er kommt in `status.md`, nicht in eine neue Fassung.

Das ist die eigentliche Lehre des 28.08.2026: Achtundzwanzig Fassungen an einem
Tag sind kein Fleiß, sondern ein Ausweichen vor der eigentlichen Arbeit.
