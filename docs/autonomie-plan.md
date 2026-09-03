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

| Was | 28.08.2026 | 03.09.2026 |
|---|---|---|
| Titel im Bestand | 2.763 | 2.766 |
| Titel mit Folgentiteln (TMDB) | 594 | 807 |
| **Titel mit aniSearch-Folgenliste** | **0** | **2.618** |
| Titel mit mindestens einer Folgenliste | 594 | **2.625 (95 %)** |
| echte Folgentitel gesamt | 17.706 | **40.552** |
| Titel mit aniSearch-Kennung | 2.615 | 2.618 |

**Der Engpass von Phase 2 ist weg.** Am 28.08. kannten wir für zwei Drittel
unserer Titel keine Folgentitel, und die beste Quelle dafür wurde gar nicht
abgerufen. Heute hat die überwältigende Mehrheit eine Liste mit deutschem,
englischem und japanischem Folgentitel samt Erstausstrahlungsdatum — das Ziel
der Phase („von 544 auf über 2.000") ist übertroffen.

**Was damit noch nicht bewiesen ist:** wie viele Rohfolgen sich damit wirklich
zuordnen lassen. Diese Zahl kommt nur aus einem Lauf mit Briefkasten-Zugang;
lokal ist `data/prime-zugeordnet.json` leer, weil der Abruf ein `LAUF_TOKEN`
braucht. Der Prüfstand am 03.09.2026 nennt **zwei** offene Adressen, und beide
sind Sonderfälle (siehe `status.md`): ein Titel, den unser Bestand gar nicht
führt, und ein Segment-Anime, dessen aniSearch-Folgentitel Verkettungen von vier
Kurzgeschichten sind („Lehrbuch / Hypnose / Aufwachen / Steine hüpfen lassen").
Kein Anbieter schreibt solche Titel gleich — dort trägt der Anker bauartbedingt
nicht, und das ist eine Grenze des Verfahrens, kein Fehler darin.

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
**Erledigt am 03.09.2026: 2.625 von 2.766 Titeln (95 %), 40.552 Folgentitel.**
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

### Phase 7 — Vollautomatisierung: was geht, was nicht, und woran es liegt

Daniel am 31.08.2026: „ziel soll vollautomatisierung sein, nicht meine manuelle
handarbeit … sodass du und ich beide nichts mehr manuell anpacken müssen, alles
muss von allein laufen."

Der Plan endete bisher bei Phase 6 mit dem Satz „der Rest wird nie null". Das
stimmt für den **Klick**, aber es beantwortet die Frage nicht: Wo genau hängt
die Handarbeit, und was davon ist wirklich unausweichlich?

#### Der Bestand, gemessen (31.08.2026)

3.285 Handbelege stehen in `data/dub-confirmed.yaml`. **2.794 davon sind über
die Erweiterung entstanden** — also nicht in Handarbeit im engeren Sinn, sondern
in Daniels angemeldeter Sitzung mit einem Klick.

| Anbieter | Belege | automatisch lesbar? |
|---|---|---|
| Netflix | 2.018 | **Ja, technisch** — der Player-Weg vom 26.08.2026 liest je Folge 3,1 s, wenn man die Videosegmente abweist. Braucht eine angemeldete Sitzung, aber **keinen Klick je Folge**. |
| Prime Video | 982 | **Nein** — 19 namentliche Bot-Blöcke in der robots.txt, `/gp/video/api` ausdrücklich gesperrt. |
| YouTube | 95 | Ja, läuft (oEmbed plus Videotitel-Muster) |
| Disney+ | 74 | **Ja** — der POST an `disney.playback.edge.bamgrid.com` liefert acht Tonspuren ohne Player, ohne DRM, ohne ein Videosegment |
| Crunchyroll | 63 | Ja, läuft (deutscher Katalog je Folge) |
| RTL+ | 42 | offen, nie gemessen |
| ADN | 10 | Ja, läuft (`vde` je Folge) |

#### Der Engpass ist nicht die Technik, sondern die Sitzung

Netflix, Prime und Disney+ geben ihre Sprachangaben nur einer **angemeldeten**
Sitzung heraus. Ein Cloud-Lauf hat keine — und ein Lauf mit Daniels Zugangsdaten
wäre genau das, was diese Dienste in ihren Bedingungen untersagen.

Was es gibt, ist sein Browser, in dem die Erweiterung ohnehin läuft. **Der Schritt
zur Vollautomatisierung ist deshalb kein neuer Abrufweg, sondern eine andere
Bauweise der Erweiterung:** Statt auf Klicks zu warten, holt sie sich Aufträge
vom Worker, arbeitet sie im Hintergrund ab und meldet die Ergebnisse — gedrosselt,
während er sowieso am Rechner ist.

Das löst **Netflix (2.018) und Disney+ (74) vollständig**, denn beide Wege sind
gemessen und funktionieren ohne Klick je Folge. Es löst Prime **nicht**.

#### Warum Prime der harte Fall bleibt

Amazons robots.txt nennt neunzehn Agenten beim Namen und sperrt jeden komplett,
dazu `/gp/video/api`. Das ist die „besondere Vorkehrung", an der die Rechtslage
hängt (BGH I ZR 159/10). Ein selbsttätiger Durchlauf in Daniels Browser wäre
technisch möglich und rechtlich nicht sauber: Er ist kein Mensch, der blättert.

**Ein Teil der 982 Prime-Belege ist trotzdem automatisch erreichbar — über die
Kanäle.** Gemessen an den Notizen der Belege:

| Zugang | Belege |
|---|---|
| über den Crunchyroll-Kanal | **160** |
| über aniverse | **280** |
| Prime eigen (`benefitId: Prime`) | 166 |
| Kauf oder Leihe | 217 |

Bei einem Kanal-Titel ist Amazons Sprachangabe ohnehin kein Beleg (siehe
CLAUDE.md, 24.08.2026) — der Beleg gehört dem Kanalbetreiber. Für die 160
Crunchyroll-Fälle liest ihn der Katalog-Lauf bereits automatisch; sie brauchen
Prime gar nicht.

**aniverse hat keine eigene Schnittstelle — gemessen am 01.09.2026.** Der Posten
sah mit 280 Belegen nach dem größten Hebel aus. Er ist keiner:

    http://aniverse.de/   -> 200  https://www.amazon.de/-/en/gp/video/storefront/?ie=UTF8&benefitId=aniversede
    https://aniverse.de/  -> ERR_SSL_TLSV1_UNRECOGNIZED_NAME

Die Domain leitet auf Amazons Kanal-Storefront um; über HTTPS antwortet sie gar
nicht. **aniverse ist ein Prime-Kanal, keine Plattform** — die 280 Belege sind
Prime-Belege und liegen hinter derselben robots.txt-Sperre. Es gibt hier nichts
zu messen und nichts zu erschließen.

#### Was übrig bliebe

Nach Netflix, Disney+ und den Kanälen blieben rund **550 Prime-Belege**, die nur
in einer angemeldeten Amazon-Sitzung entstehen können. Für sie gilt weiterhin,
was Phase 5 festgestellt hat: nicht Automatisierungsrückstand, sondern die
Grenze, die der Betreiber gezogen hat.

**Die ehrliche Antwort auf „alles muss von allein laufen" lautet damit: fast
alles kann es, und der Rest ist kein technisches Problem.**

#### Die Reihenfolge, nach Nutzen je Aufwand

1. ~~**aniverse messen**~~ — **erledigt am 01.09.2026, ohne Ertrag.** Die Domain
   leitet auf Amazons Kanal-Storefront um; es gibt keine eigene Schnittstelle.
2. **Disney+ selbsttätig** — der Weg ist gemessen und braucht keinen Player.
   **Die offene Frage ist am 01.09.2026 beantwortet:** Eine Gegenprobe an „Cat's
   Eye", einer nie geöffneten Serie, hat gezeigt, dass der Playback-Abruf
   **keinen** Eintrag unter „Weiterschauen" erzeugt (`tools/disney-gegenprobe.js`).
3. **Netflix selbsttätig** — **von Daniel freigegeben am 01.09.2026**: „ja soll
   sie." Anders als bei Disney+ ist dort jede Folge eine echte Wiedergabesitzung
   mit Lizenzabruf (3,1 s) und landet in „Weiter ansehen"; das war die
   Entscheidung, die ihm gehörte, nicht mir.
4. **Wiedervorlage nach Alter** — schließt die stille Lücke bei allen Anbietern,
   ist aber die Rückfallebene, nicht das Ziel: Sie erzeugt Arbeit, statt sie
   abzunehmen.

## Was das für heute heißt

Die Reihenfolge ist bindend: Phase 1 zuerst, weil ohne sie nichts gemessen werden
kann. Phase 2 danach, weil Phase 3 ohne Anker nichts zu vergleichen hat.

**Was in dieser Reihenfolge nicht vorkommt, wird nicht gebaut** — auch dann
nicht, wenn ein Screenshot einen echten Fehler zeigt. Ein Fehler in der
Erweiterung, der in Phase 4 ohnehin gelöscht wird, ist kein Fehler mehr, sondern
Ballast. Er kommt in `status.md`, nicht in eine neue Fassung.

Das ist die eigentliche Lehre des 28.08.2026: Achtundzwanzig Fassungen an einem
Tag sind kein Fleiß, sondern ein Ausweichen vor der eigentlichen Arbeit.
