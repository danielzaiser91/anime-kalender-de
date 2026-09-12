# Was es bedeuten würde, die Seite um Cartoons zu erweitern

**Stand: 12.09.2026.** Alle Zahlen in diesem Text sind an diesem Tag gemessen,
die Messbefehle stehen jeweils dabei.

Anlass ist Daniels Frage: „wieso haben wir avatar: Herr der Elemente nicht in
der datenbank? Und ‚AVATAR: DIE SIEBEN HÄFEN‘ … The Mighty Nein — den führen
wir auch nicht, einer meiner Lieblinge. Liegt es daran, dass diese nicht
offiziell als Anime gelten?"

Kurz: Ja — und die Grenze verläuft anders, als der Begriff „Cartoon" vermuten
lässt.

## 1. Warum sie fehlen

Unser Bestand stammt aus AniList. Gemessen an dessen Katalog (17.882 Titel im
lokalen Zwischenspeicher):

| gesucht | im Katalog |
|---|---|
| Avatar (alle Teile), Castlevania, Arcane, The Mighty Nein, Vox Machina | **keiner** |
| RWBY: Ice Queendom | ja |
| Cyberpunk: Edgerunners, Edgerunners 2 | ja |

Gegenprobe, damit „nicht gefunden" nicht heißt „nicht gesucht": dieselbe
Suchfunktion findet Demon Slayer (10 Treffer), Frieren (6), One Piece.

**Die Trennlinie ist die Produktion, nicht das Aussehen.** „RWBY: Ice Queendom"
ist ein US-Stoff, in Japan bei Studio Shaft animiert — und steht drin.
„Cyberpunk: Edgerunners" kommt von Trigger — steht drin. „Avatar: Die sieben
Häfen" produzieren Nickelodeon Animation und Avatar Studios, animiert wird bei
La Chouette Compagnie in Frankreich — steht nicht drin.

aniSearch zieht dieselbe Linie und diskutiert sie seit Jahren im eigenen Forum:
Der schöpferische Teil muss aus Japan kommen, und das Werk muss dort auch
erschienen sein. Grenzfälle werden dort einzeln entschieden, nicht nach Regel.

**Es ist also keine Lücke unserer Pipeline.** Beide großen Tracker führen diese
Titel bewusst nicht, und kein Abruf, keine Frist und kein Namensabgleich würde
daran etwas ändern.

## 2. Welche Quelle es trüge

TMDB — und es liegt bereits ein Schlüssel im Projekt.

```
GET /3/search/tv?query=<name>&language=de-DE
```

| gesucht | TMDB | deutscher Titel dort |
|---|---|---|
| Avatar Seven Havens | 284833 | Avatar – Die sieben Häfen |
| The Mighty Nein | 219080 | The Mighty Nein |
| Avatar The Last Airbender | 82452 | Avatar – Der Herr der Elemente |
| Arcane | 94605 | Arcane |

TMDB liefert zu jedem Eintrag `origin_country` und `original_language` — die
Herkunft, an der sich die beiden Sorten sauber trennen lassen, ohne dass
jemand sie von Hand pflegt.

## 3. Wie viel dazukäme

```
GET /3/discover/tv?with_genres=16&with_original_language=en&first_air_date.gte=2000-01-01
```

| | Titel |
|---|---|
| TV, Animation, englischsprachig, ab 2000 | 2.903 |
| davon mit Streaming-Angebot in Deutschland | **778** |
| zum Vergleich: TV, Animation, japanisch, ab 2000 | 4.034 |
| unser heutiger Bestand mit belegter deutscher Synchro | 2.771 |

Die Filmzahl ist nicht brauchbar: TMDB deckelt die Ausgabe bei 20.000, und
genau das meldet die Abfrage zurück. Für eine Entscheidung reicht die
Serienzahl.

**778 ist die Größenordnung, um die es geht** — rund ein Viertel unseres
heutigen Bestands. Und die Zahl ist eine **Obergrenze**: „in Deutschland im
Abo verfügbar" heißt nicht „auf Deutsch", und genau diese Unterscheidung ist
der Kern dieser Seite.

## 4. Der eigentliche Einwand: die Frage der Seite verliert ihren Sinn

Der Kalender beantwortet eine Frage: *Gibt es das auf Deutsch, und ab wann?*
Für japanische Produktionen ist das eine echte Frage — die Antwort lautet oft
nein, oft „nur untertitelt", oft „erst in acht Monaten". Genau daran hängt der
ganze Aufwand dieses Projekts: Handbelege, Folgenbereiche, Anbieterzählung.

Für eine US-Serie auf Netflix, Disney+ oder Paramount+ lautet die Antwort fast
immer **ja, zum Start**. Deutsche Synchronfassungen westlicher Serien sind der
Normalfall, nicht die Ausnahme. Ein Kalender, der bei 778 Titeln immer
dasselbe sagt, sagt nichts.

**Das ist der Grund, warum die Erweiterung mehr kostet als Datenpflege.** Sie
verändert, wofür die Seite da ist: vom „wo gibt es die deutsche Fassung" zum
„was läuft wann an Animation". Das ist eine andere Seite mit anderem Namen.

## 5. Was trotzdem dafür spricht

- **Daniel sucht danach.** Drei Titel an einem Abend, zwei davon erklärte
  Lieblinge. Wer die Seite benutzt, bringt eine Erwartung mit, die die
  Tracker-Definition nicht kennt.
- **Anime2You berichtet darüber.** Unsere eigene Nachrichtenquelle führt
  „Deutscher Synchro-Trailer zu »Avatar: Die sieben Häfen«" — deren Grenze ist
  die Zielgruppe, nicht die Herkunft. Wer ihren Meldungen folgt, findet bei uns
  einen Teil davon nicht.
- **Die Termine sind dieselbe Arbeit.** Kinostart, Disc, Streaming-Premiere:
  Die Pipeline dahinter unterscheidet nicht, woher ein Werk kommt.

## 6. Drei Wege, mit Kosten

### A — gar nicht, aber sichtbar begründet

Eine Zeile in der Suche: „Avatar: Die sieben Häfen führen wir nicht — die Seite
sammelt Anime, und die Tracker zählen westliche Produktionen nicht dazu."

**Kosten:** ein Tag. **Nutzen:** Niemand hält die Lücke mehr für einen Fehler.
**Grenze:** Löst Daniels Anliegen nicht, es erklärt es nur.

### B — eigener Bereich, getrennt gezählt

Ein zweiter Bestand aus TMDB, hinter einem eigenen Schalter wie heute schon
„Anime ohne deutsche Synchro". Getrennte Zählung, getrennte Filter, dieselbe
Kalenderlogik.

**Kosten:** rund eine Woche — Abruf, Zuordnung, Bestandsprüfung, zweite
Sorte durch alle Ansichten und durch den Newsletter. Dazu dauerhaft: ein
zweiter Quellenlauf, der veralten kann.
**Nutzen:** Die Titel sind da, die Trennlinie bleibt sichtbar, der Name der
Seite stimmt weiter.
**Grenze:** Für diese 778 fehlt die Synchro-Prüfung, die den Rest der Seite
trägt — sie stünden ohne das, was unsere Angaben belastbar macht.

### C — Grenze verschieben, Seite umbenennen

Ein Bestand, ein Begriff („Animation mit deutscher Fassung"), neuer Name.

**Kosten:** Wochen, plus jede Adresse, jede Teilen-Seite und jede
Suchmaschinen-Position, die auf „Anime-Kalender" zeigt.
**Nutzen:** Eine Seite ohne Sonderfall.
**Grenze:** Die 2.771 mühsam belegten Synchro-Angaben stehen dann neben 778
Titeln, bei denen die Frage keine ist. Das verwässert die Auskunft, für die es
die Seite gibt.

## 7. Empfehlung

**B, aber erst nach einer Messung, die noch fehlt.** Bevor eine Woche in einen
zweiten Bestand fließt, ist eine Frage zu beantworten, die alles entscheidet:

> Wie viele der 778 haben **keine** deutsche Fassung — und wie viele haben eine
> mit einem Termin, den man vorher wissen will?

Ist die Antwort „fast alle sind längst deutsch da", dann beantwortet ein
Kalender für sie nichts, und A ist die ehrliche Lösung. Ist sie „ein
nennenswerter Teil startet später oder gar nicht auf Deutsch", trägt B.

Die Messung ist billig: TMDBs `watch/providers` je Titel für eine Stichprobe
von hundert, dazu die Sprachangaben aus denselben Quellen, die wir für Netflix,
Disney+ und Prime ohnehin nutzen. Ein Tag, und danach ist die Entscheidung
keine Geschmacksfrage mehr.

## Quellen

- aniSearch-Forum zur Definition von „Anime" und zur Aufnahme westlicher
  Produktionen: <https://www.anisearch.com/forum/thread/8032,definition-anime-auf-anisearch>
  und <https://www.anisearch.com/forum/thread/7702,sollen-eintrage-die-keine-anime-sind-aus-der-datenbank-geloscht-werden>
- Avatar: Seven Havens — Produktion und Starttermin:
  <https://en.wikipedia.org/wiki/Avatar:_Seven_Havens>,
  <https://www.awn.com/news/paramount-sets-avatar-seven-havens-october-9-premiere>
- AniList-Katalog: `data/cache/anilist-katalog.json` (17.882 Titel, Stand 03.09.2026)
- TMDB: `search/tv` und `discover/tv`, gemessen am 12.09.2026
