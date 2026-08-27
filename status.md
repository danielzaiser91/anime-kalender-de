# Status: anime-kalender-de

Stand: 27.08.2026 · Live: https://anime-kalender.de/

**Der aktuelle Plan steht in [PLAN.md](PLAN.md)** — mit gemessenen Zahlen und der Frage,
was noch von einem vollständigen Kalender trennt. Was hier darunter steht, ist die
Arbeitsgeschichte: die Pläne früherer Tage, ihre Messungen und ihre Begründungen. Sie bleibt
stehen, weil eine verworfene Quelle sonst in drei Monaten ein zweites Mal geprüft wird.

## Task Queue

### In Arbeit

| Aufgabe | SP | Notiz |
|---|---|---|
| **Prime-Suchadressen prüfen** | — | Erweiterung 3.39 zeigt auf den 118 Suchseiten, welcher Titel gemeint ist. Wartet auf Daniels erste Runde |
| **Delta-Überwachung** | 1 | `node tools/delta-pruefen.mjs` täglich ansehen, bis zum 30.08.2026. Bisher unauffällig: Titel ±0, Urteile +4 |

### Erledigt seit dem 25.08.2026

Die Phasen 1 und 2 des Plans vom 25.08. sind durch — sie stehen unten unverändert, weil ihre
Messungen weiter gelten:

| | Was daraus wurde |
|---|---|
| **1.1–1.5 Crunchyroll je Folge** | Suchweg im deutschen Katalog gefunden (anonymes Bearer-Token per POST), Serienkennung wird gesucht statt aus der Adresse geraten, die Tonspur je Folge gelesen. Conan als Prüfstein hält |
| **2.1–2.3 Erweiterung** | Disney+ vollständig erschlossen — 558 Meldungen zu 31 Titeln über den Playback-Aufruf, ohne Player und ohne DRM. Netflix und Prime laufen |
| **Prime-Suchadressen** | 27.08.2026, Erweiterung 3.39: der Hinweis auf der Suchseite und die Adressberichtigung in der Übernahme. Der letzte Weg mit dreistelligem Ertrag |

**Offen geblieben und in [PLAN.md](PLAN.md) fortgeschrieben:** die 43 Crunchyroll-Specials
ohne Block, die 287 Serien, die der deutsche Katalog gar nicht führt, und der Umbau der
Oberfläche auf Folgen-Ebene.

### Der Plan, Stand 25.08.2026, 15:00 (erledigt, siehe oben)

**Gemessen, nicht geschätzt** — alle Zahlen aus dem heute ausgelieferten Datensatz:

| Anbieter | Verweise | ohne Sprachangabe | belegt deutsch |
|---|---|---|---|
| **Crunchyroll** | 966 | **462** | 504 |
| Prime Video | 563 | 208 | 355 |
| Disney+ | 47 | 36 | 11 |
| Netflix | 376 | 26 | 350 |
| YouTube | 72 | 22 | 50 |
| ADN | 128 | 5 | 123 |
| Joyn | 2 | 2 | 0 |

Dazu: 865 von 2.762 Titeln zeigen keinen Weg. Im Crunchyroll-Befund haben 507 von 959 Serien
Staffeldaten, 324 finden keine, 128 gelten als nicht verfügbar; 107 stammen noch aus dem
US-Katalog.

**Die Reihenfolge folgt dem Schaden, nicht der Bequemlichkeit.** Crunchyroll steht vorn, weil
dort nicht nur Auskunft fehlt, sondern **aktiv falsche entsteht**: Der Detektiv-Conan-Fall hat
gezeigt, dass ein Fehlurteil einen richtigen Verweis **löscht**. Eine Lücke ist ärgerlich, eine
gelöschte Wahrheit ist schlimmer.

#### Phase 1 — Crunchyroll je Folge lesen statt je Serie raten

| # | Aufgabe | SP | Warum hier |
|---|---|---|---|
| 1.1 | **Suchweg im deutschen Katalog finden.** `cms/v2<bucket>/search` antwortet mit 502; gebraucht wird ein Pfad, der zu einem Titel die Serienkennung liefert. | 3 | **Ohne das geht 1.2 nicht** — und ohne 1.2 bleiben Conan und die 324 kennungslosen Serien ungelöst. |
| 1.2 | **Serienkennung nicht mehr aus der Adresse ableiten.** Conan trug `crunchyroll.com/de/case-closed` → `G6JQVM3ER` → ein Block, 33 Folgen, `ja-JP`. Die deutschen Blöcke liegen unter einer anderen Kennung. | 5 | Behebt die Ursache, nicht das Symptom. |
| 1.3 | **Urteil je Folge statt je Serie.** `versions[].audio_locale` steht an der Folge; damit ist der Befund unabhängig davon, welchen Block man erwischt. Trailer (`sequence_number` 0) und Specials (Brüche) getrennt führen. | 8 | Daniels Auftrag: „der lauf muss jede folge individuell prüfen". |
| 1.4 | **Zusicherung mit Conan als Prüfstein.** Daniels Handstand: Folgen 1–254 und 334–483 deutsch, drei Specials, 1–182 als HD-Remaster. Der umgebaute Lauf muss das reproduzieren. | 3 | Ein Umbau ohne Prüfstein ist eine Vermutung mit mehr Zeilen. |
| 1.5 | **Lauf remote, Wirkung messen.** Erwartet: die 462 offenen Verweise sinken deutlich, kein belegter Verweis verschwindet. | 2 | Ohne Messung weiß niemand, ob der Umbau half. |

**Der deutsche Verweis muss den englischen schlagen.** Bei Conan verdrängte
`crunchyroll.com/de/case-closed` das von aniSearch gelieferte `crunchyroll.com/detektiv-conan`,
weil je Anbieter nur ein Verweis übernommen wird und der erste gewinnt. Das gehört in 1.2 mit
hinein: Wer zuerst kam, ist kein Kriterium.

#### Phase 2 — die Erweiterung, weil Daniel damit arbeitet

| # | Aufgabe | SP | Warum hier |
|---|---|---|---|
| 2.1 | **SPA-Navigation.** Die Knöpfe erscheinen erst nach F5. | 5 | Grundlage für 2.2 und 2.3 — jeder Test dort kostet sonst ein Neuladen je Titel. |
| 2.2 | **Prime-Folgennummern nicht mehr glauben.** Eine Staffelansicht führt 149–151 neben 1146–1148, mit Terminen aus zwei Jahren. | 3 | Korrektheit vor Reichweite: Was falsch ankommt, muss später von Hand berichtigt werden. |
| 2.3 | **Disney+ aufnehmen.** 36 von 47 Verweisen ohne Sprachangabe, und `robots.txt` sperrt alles — die Erweiterung ist der **einzige** Weg. | 8 | Nach 2.1, sonst ist die Prüfrunde unnötig zäh. |

#### Nachgetragen am 25.08.2026, 16:10 — aus Daniels Prüfrunde

| # | Aufgabe | SP | Befund |
|---|---|---|---|
| 4.1 | **ADN-Release von Dan Da Dan S2 trägt keine `firstEpisodeNumber`.** Der Eintrag `adn-1160-s1-20241003-185660` führt 12 Folgen ab 03.07.2025, letzte am 18.09.2025 — die Terminliste zählt deshalb ab „1." statt ab „13.", obwohl der Hinweis darüber „Folgen 13–24 der ADN-Staffel 1" sagt. | 3 | Genau der Fall, den `CLAUDE.md` für Steel Ball Run beschreibt. |
| 4.2 | **Ein abgeschlossener Termin aus 2025 steht unter „Release-Termine".** Letzte Folge 18.09.2025, Label „Abgeschlossen" ausgegraut — im Bereich für kommende Termine hat er nichts zu suchen. | 3 | Daniel: „letzte folge 2025 … also eig gibts kein grund warum es dort extra aufgelistet ist". |
| 4.3 | **ADN erscheint zweimal**: oben als Anbieter („2 Einträge"), unten als Terminblock. Solange 4.2 offen ist, sieht das wie eine Dopplung aus. | 2 | Hängt an 4.2 — ist der abgeschlossene Block weg, bleibt oben ein Eintrag. |
| 4.4 | **„Wo läuft es" als Pills umbauen.** Streams und Kaufwege als kompakte, klickbare Pills mit allen Angaben darin, statt breiter Zeilen; laufende Folgen in denselben Bereich. Erst klickbare Mockups zur Auswahl. | 8 | Daniel: „sie müssen pills sein die anklickbar sind … extrem viel weniger platz". |

#### Phase 3 — die verbleibende Lücke

| # | Aufgabe | SP | Warum zuletzt |
|---|---|---|---|
| 3.1 | **TMDB-Zuordnung verbessern.** 865 Titel ohne Weg; ein großer Teil wird bei TMDB nicht gefunden. | 5 | Reine Lücke, kein Schaden — und der Nutzen hängt daran, dass Phase 1 die Sprachangaben liefert. |

**Was ausdrücklich nicht in diesen Plan gehört:** Die 128 als „nicht verfügbar" geführten
Crunchyroll-Serien. Für ihr Entfernen verlangt `CLAUDE.md` einen zweiten Beleg, und den gibt es
erst, wenn Phase 1 den deutschen Katalog je Folge liest. Danach beantwortet sich die Frage von
selbst — vorher wäre jede Entscheidung geraten.

### Der Plan, Stand 23.08.2026, 19:15

**Gemessen, nicht geschätzt.** 2.233 Anbieter-Verweise, davon **1.161 ohne Sprachangabe**.
Verteilung und Ursache je Anbieter:

| Anbieter | offen | Ursache | Lösbar durch |
|---|---|---|---|
| Prime Video | 600 | keine Quelle nennt die Tonspur öffentlich | Streaming Availability API — Kontingent reicht nicht |
| Crunchyroll | 464 | **462 stehen im Bestand, aber ohne Staffeldaten** | eigener Lauf, siehe unten |
| Disney+ | 40 | `robots.txt` sperrt alles | nur die Erweiterung |
| YouTube | 23 | oEmbed nennt keine Tonspur | Data API, braucht Schlüssel |
| ADN | 7 | Rest nach dem Sprachcode-Lauf | eigener Lauf |
| Joyn | 2 | keine Quelle | offen |

**Der größte Einzelhebel ist Crunchyroll**, und die Ursache ist keine fehlende Quelle, sondern
ein unvollständiger Abruf. Die 453 Serien ohne Staffeldaten teilen sich auf:

| Zahl | Grund im Bestand | Was zu tun ist |
|---|---|---|
| **240** | „Content-API kennt keine Staffel zu dieser Kennung" | **gemessen 23.08.2026: die Kennung ist gültig** — siehe unten |
| **127** | `nichtVerfuegbar` — Serie dort nicht mehr | Verweise entfernen, prüfen ob der Build das tut |
| **86** | „keine Serienkennung hinter dieser Adresse" | Adressen neu auflösen, vermutlich veraltete URLs |

### Gemessen am 23.08.2026, 20:15: die 240 Kennungen sind nicht veraltet

Die Aufgabe hieß „Kennung neu auflösen — vermutlich veraltete `seriesId`". Die Vermutung ist
**widerlegt**. Gemessen mit frischem Zugangspaket (deutscher Katalog) an zehn Fällen, über
**beide** API-Pfade:

| Abfrage | Ergebnis |
|---|---|
| `cms/v2<bucket>/seasons?series_id=…` | 10× HTTP 200, `total: 0` |
| `content/v2/cms/series/<id>/seasons` | 8× HTTP 200, `0` Staffeln |
| `content/v2/cms/series/<id>` (die Serie selbst) | 10× HTTP 200, **richtiger Titel** |
| Kontrollgruppe (Serien mit Staffeln im Bestand) | 4× je 1 Staffel — der Pfad tut es also |

Die Kennung stimmt, Crunchyroll kennt die Serie, und der deutsche Katalog führt **null
abrufbare Folgen**. Ein Auflösungslauf hätte 240-mal dieselbe Kennung wiedergefunden.

**Was daraus folgt, ist offen — und zwar bewusst.** `CLAUDE.md` verlangt für das Entfernen
eines Verweises einen zweiten Beleg, und zwei Pfade derselben API sind kein zweiter Beleg.
Dazu kommt ein Fall, der stutzig macht: **DanMachi** (`G6DQN9KGR`) steht in dieser Gruppe —
eine große, laufende Reihe. Entweder ist sie in Deutschland wirklich nicht auf Crunchyroll,
oder die Messung greift bei manchen Serien daneben. Das entscheidet die Stichprobe (Aufgabe E).

### Auch die 86 Adressen: dasselbe Bild, plus drei Datenfehler

Gemessen am 23.08.2026, 20:30. Die 86 zerfallen nach Adressform:

| Form | Zahl | Beispiel |
|---|---|---|
| Folgen-Adresse statt Serien-Adresse | 38 | `/amagi-brilliant-park/episode-14-800072?ssid=` |
| Serien-Adresse mit Slug | 25 | `/de/jungle-emperor-leo` |
| sonstige Formen | 22 | `/cencoroll-connect/de-cencoroll-connect-…` |
| **eine Amazon-Adresse im Crunchyroll-Bestand** | 1 | `https://www.amazon.de/dp/B0C9H2BQWM` |

**Der eigene Fehler zuerst:** Die erste Messung nahm das letzte Pfadstück als Suchbegriff und
fragte damit nach „episode 14 800072". Die Crunchyroll-Suche antwortet auf alles mit drei
Ergebnissen, also meldete der Lauf „7 von 8 wiedergefunden" — richtig war **einer**. Eine
Trefferquote aus einer Suche, die nie leer ausgeht, misst gar nichts.

Mit korrekt gezogenem Serien-Slug und **exaktem** `slug_title`-Vergleich (keine Ähnlichkeit,
keine Schwelle) sind es 10 von 25. Eine Bewertung nach Wortanteil war zwischendurch versucht
und wieder verworfen: Bei Schwelle 60 % fiel `haikyu-dubs → Haikyu!!` zu Unrecht durch, während
`detektiv-conan-movies → Detektiv Conan` zu Unrecht durchkam — die Filme sind nicht die Serie.

**Und die 10 Treffer bestätigen den Befund von oben:** sieben davon haben `episode_count: 0`.
Nur `love-stage` (10), `origin-spirits-of-the-past` (1) und `fairy-tail-movies` (1) führen
überhaupt Folgen.

Der Schluss über alle 453 Serien ohne Staffeldaten lautet damit: **Das ist zum weit
überwiegenden Teil kein Datenfehler bei uns, sondern eine Aussage über das deutsche
Crunchyroll-Angebot.** Was daraus für die Verweise folgt, hängt an Stichprobe E.

### Entschieden 23.08.2026: Die Erweiterung bleibt im öffentlichen Repo

Daniels Sorge: „die extension soll nicht ins github, sonst könnte jeder die runterladen und
random sachen melden, nur ich soll das können."

**Gemessen, bevor umgebaut wurde:** Der Melde-Endpunkt antwortet ohne gültigen `LAUF_TOKEN`
mit **HTTP 403**, mit falschem Token ebenso. Wer die Erweiterung herunterlädt, kann damit
nichts melden — der Token liegt in Daniels Browser-Speicher, nicht im Repo.

```
POST /pruefung ohne Token          → 403 {"error":"Nicht erlaubt"}
POST /pruefung mit falschem Token  → 403 {"error":"Nicht erlaubt"}
```

Der Schutz ist also das Token, nicht die Geheimhaltung des Quelltexts. Ein privates Repo hätte
drei Nachteile erkauft, ohne einen Angriff zu verhindern: Die Zusicherungen liefen nicht mehr
in derselben Prüfkette, die Listen (`offene-amazon.js`, `offene-netflix.js`) müssten über eine
Repo-Grenze erzeugt werden, und die Historie des öffentlichen Repos behielte die Dateien
ohnehin — sie zu tilgen verlangte einen Force-Push auf main.

**Wann das neu zu bewerten wäre:** Wenn der Melde-Endpunkt je ohne Token erreichbar wird, oder
wenn die Listen mehr verraten als „welche Titel sind offen".

### MOTN-Lauf vom 23.08.2026, 22:15: Kontingent genutzt, Wirkung null

Der Workflow läuft erst am 2. jeden Monats — das August-Kontingent wäre verfallen. Von Hand
angestoßen mit Budget 240:

```
212 Anfragen verbraucht, 204 Serien geholt (über die TMDB-Kennung)
Verbrauch: 962 im Monat 2026-08 von 1.000
Die Quelle selbst meldet 0 Anfragen als Rest des Monats
```

**Die Zahl der Verweise ohne Sprachangabe blieb bei 1.161 — exakt wie vorher.** Die 204 neuen
Serien haben keinen einzigen Beleg erzeugt.

Was daran offen ist, und zwar messbar: Der MOTN-Bestand führt **352 Serien mit deutscher
Tonspur** (198 Netflix, 123 Prime Video, 44 Disney+, 12 Crunchyroll) — also genau bei den
Anbietern, wo uns die Angaben fehlen. Der Build belegt daraus aber nur **110** Angaben. Wo die
übrigen bleiben, ist nicht gemessen; zu suchen ist in `ordneShowsZu()` und `uebernehmbar()`
in `pipeline/lib/motn.ts`. **Das ist der Hebel, nicht mehr Abrufe.**

**Nebenbefund zum Zähler:** Unsere Zählung sagt 962 von 1.000, die Quelle selbst meldet 0
Rest — eine Lücke von 38. Maßgeblich ist die Angabe der Quelle; unser Zähler unterschätzt den
Verbrauch und würde einen Lauf ins Limit rennen lassen.

### Die 7 ADN-Reste: gemessen am 23.08.2026, 22:30

Fünf der sieben sind JoJo unter **einer** ADN-Kennung (444). Die Rohdaten liegen vollständig
im Repo (`data/adn-raw/444.json.gz`, 152 Folgen), und die Zuordnung ist eindeutig — die
Summen gehen exakt auf:

| ADN-Staffel | Folgen | Sprachen | Unser Titel | Folgen |
|---|---:|---|---|---:|
| 1 | 26 | `vostde`, **`vde`** | JoJo no Kimyou na Bouken (TV) | 26 |
| 2 | 48 | `vostde`, **`vde`** | Stardust Crusaders + Part 2 | 24 + 24 |
| 3 | 39 | `vostde`, **`vde`** | Diamond wa Kudakenai | 39 |
| 4 | 39 | nur `vostde` | Ougon no Kaze | 39 |

**Staffel 4 trägt kein `vde`** — für „Ougon no Kaze" wäre das ein belegtes Nein, kein
Fragezeichen. Die übrigen drei sind belegte Synchros.

**Nachgesehen am 23.08.2026, 23:37 — die Automatik schweigt zu Recht.** Der Build nennt den
Grund selbst:

> „Serie 444 ist gemischt (113 von 152 mit vde), der Verweis nennt keine Staffel"

Unsere Verweise zeigen auf `/video/444-jojo-s-bizarre-adventure` **ohne Staffelangabe**. Über
die Folgenzahl zuzuordnen scheitert genau dort, wo es darauf ankäme:

| unsere Folgen | passt auf ADN-Staffel | eindeutig? |
|---:|---|---|
| 26 | 1 (26) | ja |
| 24 + 24 | 2 (48) | nur als Paar |
| 39 | **3 (39) oder 4 (39)** | **nein** |

Und ausgerechnet diese beiden unterscheiden sich im Befund: Staffel 3 trägt `vde`, Staffel 4
nicht. Eine Zuordnung über die Reihenfolge (Diamond 2016 vor Ougon 2018) wäre plausibel und
unbelegt — und im Fehlerfall behauptete sie eine Synchro, die es nicht gibt.

**Was hier wirklich hilft, ist eine Handprüfung**, nicht mehr Code. Die drei ADN-Stichproben
stehen ohnehin an; „Ougon no Kaze" gehört dazu.

Die beiden übrigen Reste sind Einzelfälle: „Kiznaiver" und „Peter Grill … Super Extra".

### Amazon-Suchadressen: 202, nicht 27 — und sie behaupten eine Zugangsart

Gemessen am 23.08.2026, 23:55. Der Datensatz führt **202 Verweise** auf
`amazon.de/s?k=<Titel>` — Suchergebnisseiten, keine Titelseiten. Die Zahl 27 aus der früheren
Notiz war nur der Ausschnitt mit `zugang: kauf`.

**Alle tragen eine Zugangsart, die niemand geprüft hat.** Beispiele: „Cowboy Bebop", „AKIRA",
„Full Metal Panic!", „Tenjou Tenge" — alle mit `zugang: abo`. Der Kalender sagt also „Mit Abo",
und dahinter liegt eine Suche. Ob der Titel dort im Abo ist, gekauft werden muss oder gar nicht
angeboten wird, weiß niemand.

**Ein leeres Feld reicht als Behebung nicht:** `DetailPanel.tsx` setzt `s.zugang ?? 'abo'` — ein
fehlender Wert erscheint weiterhin als „Mit Abo". Nötig ist eine eigene Kennzeichnung, etwa
„bei Amazon suchen" statt einer Zugangsangabe.

Für die Erweiterung sind diese Adressen ohnehin unbrauchbar: Sie tragen keine ASIN, der
Melde-Knopf erscheint dort nicht.

### Was ohne Daniel geht

| # | Aufgabe | SP |
|---|---|---|
| 1 | ~~240 Crunchyroll-Kennungen neu auflösen~~ — **hinfällig**, die Kennungen sind gültig (Messung oben). Nachfolgeaufgabe hängt an Stichprobe E | — |
| 2 | **86 unauflösbare Adressen** über die Suche neu bestimmen | 3 |
| 3 | **127 tote Verweise**: prüfen, ob der Build sie wirklich entfernt, und die Zahl belegen | 1 |
| 4 | **Robustheitstest erweitern** um aniSearch, YouTube und die Zugangsart | 3 |
| 5 | **MOTN-Katalog weiterlaufen lassen** — 250 Anfragen Restkontingent im August | 2 |
| 6 | **ADN: 7 Reste** nachziehen | 2 |

### Wo Daniel gebraucht wird

| # | Aufgabe | warum nur er |
|---|---|---|
| A | **Drei ADN-Stichproben** aus `check:quellen` | 107 Urteile, **keine einzige Kontrolle** — der blindeste Fleck im Projekt |
| B | **YouTube-Data-API-Schlüssel** anlegen | Konto nötig, löst 23 Verweise |
| C | **Prime Video und Disney+ mit der Erweiterung** | beide sperren automatisierte Abrufe; zusammen 640 Verweise |
| D | **Drei Prime-Stichproben** zu den 101 `zugang: kauf` | abgeglichen, nie validiert |
| E | **Drei Crunchyroll-Stichproben** zu den 240 ohne Folgen | entscheidet über 240 Verweise; DanMachi macht die Messung fragwürdig |

### Offene Aufgabe: Woher kommen die Prime- und Disney-Verweise?

Daniel am 23.08.2026, 19:05: „aktuell besitzen wir bereits prime und disney links im kalender,
woher kommen die? ich hab sie nicht manuell hinzugefügt, also sind sie irgendwie automatisiert
reingekommen, oder? es muss quellen dafür geben, wir müssen die quellen nur finden."

**Er hat recht, und die Unterscheidung ist wichtig:** Die **Verweise** kommen automatisch —
aus aniSearch (Abschnitt `#streams`) und aus TMDB/JustWatch (`watch/providers`). Was fehlt, ist
allein die **Tonspur**. Bisher wurde nur nach Quellen gesucht, die beides liefern; nach einer
Quelle, die *nur* die Sprachfassung kennt und über eine bestehende Kennung anzubinden wäre,
noch nie systematisch.

Zu prüfen, in dieser Reihenfolge:

1. ~~**aniSearch selbst**~~ — **geprüft und widerlegt am 23.08.2026, 19:20.** Die Verweise im
   Abschnitt `#streams` tragen ein Symbol (`<span class="badge bicon2">`), das nach einer
   Sprachangabe aussieht: drei Varianten, ungleich verteilt (`bicon2` 620×, `bicon3` 116×,
   `bicon1` 2×). Gegen unsere Handprüfungen gehalten — **mit Negativkontrolle**, also auch
   gegen die belegten „kein Deutsch" — trennt es nicht:

   ```
   bicon2 → Handprüfung dub=true    459
   bicon2 → Handprüfung dub=false    18   ← dasselbe Symbol bei beiden
   bicon3 → Handprüfung dub=true      1
   ```

   Dasselbe Symbol steht bei deutscher und bei fremder Fassung; es bedeutet vermutlich
   „Stream vorhanden". **Der Abschnitt `#streams` nennt keine Sprache** — weder im Symbol noch
   im Text noch in einem Attribut. Damit ist die naheliegendste Quelle ausgeschlossen.
2. **AniList** — dort liegen die deutschen Sprechrollen (1.746 Titel belegt). Sie sagen, *dass*
   eine Synchro existiert, nicht *wo* sie läuft. In Verbindung mit einem belegten Verweis wäre
   das ein Indiz, kein Beleg — sauber getrennt zu halten.
3. **Die Anbieter-eigenen JSON-Schnittstellen**, die die Web-Oberfläche selbst nutzt
   (Skill `netzwerkverkehr-statt-scraping`). Für Prime Video ist belegt, dass `audioTracks` je
   Folge in der Seite steht — rechtlich gesperrt, technisch vorhanden. Für Disney+ ungeprüft.
4. **Die Streaming Availability API mit `series_granularity=episode`** für Prime — die
   Folgendaten waren im Test sauber, nur der Bestand ist unvollständig.

### Der Konflikt, der offen bleibt

Daniels Grundsatz vom 23.08.2026 lautet: „die extension … keine dauerhafte lösung … wir müssen
unsere datenquellen automatisieren." **Für Prime Video und Disney+ gibt es aber keine
automatisierbare Quelle** — beide sperren Abrufe, und die Streaming Availability API deckt
Prime nur teilweise und Disney+ gar nicht in brauchbarer Qualität. Zusammen sind das 640 der
1.161 offenen Verweise, also **mehr als die Hälfte**.

Entweder bleibt die Erweiterung dort dauerhaft im Einsatz, oder diese 640 bleiben offen. Ein
dritter Weg ist bislang nicht gefunden.

### Behoben am 25.08.2026: drei Fehler, die der Deploy und Daniel gefunden haben

**1. Die Wege-Ergänzung überschrieb Handprüfungen.** Ein Lauf gab 14 Titeln ohne Weg einen
Verweis aus TMDB-Anbieter plus MOTN-Archiv. Fünf davon hatten ihren Verweis absichtlich nicht:
Daniel hatte sie geprüft und als „ohne deutsche Tonspur" bzw. „nicht verfügbar" eingetragen.
Der bestehende Schutz (`if (stream.dub !== undefined) continue`) greift nur bei **vorhandenen**
Verweisen — eine Ergänzung legt einen neuen an und läuft daran vorbei. `check:handbelege` hat
es gefangen, vier Deploys blieben rot. Ergänzt wird jetzt nur, wo zu Titel und Plattform keine
Handprüfung vorliegt.

**2. Release-Termine und Reihen-Karussell hingen an „kein Anbieter bekannt".** Der Umbau vom
24.08.2026 („Reihen-Umschalter zieht nach unten") ließ das schließende `</div>)}` zweihundert
Zeilen zu weit unten stehen. Damit lagen beide Abschnitte im Zweig „kein Anbieter bekannt":
**Jeder Titel mit einem Stream-Verweis verlor die Release-Termine** — also genau die Auskunft,
für die es diese Seite gibt. Live gemessen an Dan Da Dan, Clevatess und Sakamoto Days.
Aufgefallen an einer Nebenwirkung, die Daniel meldete: Klick im Karussell eines Kinofilms auf
einen Teil mit Disney+-Verweis ließ das Karussell verschwinden.

**JSX verschluckt so etwas lautlos** — der Baum bleibt gültig, `tsc` und ESLint sehen nichts,
und der Unterschied zeigt sich nur an Titeln, die die Bedingung **nicht** erfüllen.

**3. Ein Crossover verschmolz drei Reihen zu einer.** „Lupin III. vs Detektiv Conan" trägt bei
AniList zwei `PARENT`-Kanten — zu Detective Conan (235) und zu Lupin the 3rd (1412). Union-Find
kennt nur eine Zugehörigkeit je Knoten, also zog dieser Film beide Reihen zusammen; über „Lupin
III. vs. Cat's Eye" kam Cat's Eye dazu. Das Panel zeigte eine Reihe mit **114 Teilen** namens
„Lupin III.: Teil 1" — der Vertreter ist der älteste TV-Teil, und Lupin von 1971 schlägt Conan
von 1996.

Erkannt wird das jetzt an AniLists eigener Auskunft, nicht am Namen. **Ein Namensmuster auf
„vs"/„x" wurde gemessen und verworfen:** Es trifft „Hunter x Hunter", „SPY x FAMILY" und
„HAIKYU!! LAND VS. AIR" — allesamt gewöhnliche Teile ihrer eigenen Reihe.

| | Zahl |
|---|---|
| Titel mit zwei oder mehr `PARENT`-Kanten | 24 |
| davon beide Eltern in derselben Reihe (unberührt) | 17 |
| **echte Crossover** | **7** |

Wirkung: Conan 114 → 63 Teile, Lupin 114 → 45, Cat's Eye 114 → 3. Der Crossover selbst bleibt
in der Reihe seines ersten Elternteils sichtbar — wer die Conan-Reihe durchsieht, sucht genau
diesen Film.

### Queue

**Performance der Prime-Erweiterung — Review vom 25.08.2026.** Messwerte, Begründungen und
die Verhaltensrisiken je Änderung stehen vollständig in
[`extension/PERFORMANCE.md`](extension/PERFORMANCE.md); wiederholbar mit
`node tools/amazon-regex-kosten.js`. **Erledigt in 2.0:** der `seitenTitel()`-Rückfall
(179,6 ms → 1,8 ms bei 2,2 Mio. Zeichen, Faktor 97 gegengemessen), der adaptive Takt
(4.000 ms bei vollständigem Zählstand), `asinAusSeite()` und der `includes`-Wächter in
`regionFolgenAusDom()`. Ausgangswert aus Daniels Sitzung: `taktSchnitt: 226 ms`,
`taktMax: 417 ms` bei einem 500-ms-Takt.

| Aufgabe | SP | Notiz |
|---|---|---|
| `amazon-leser.js`: `innerHTML` je Takt einmal statt zweimal, an `abschnittsFinger()` und `ausSeite()` durchgereicht | 2 | rund 9 MB Zeichenketten je Sekunde in der Seitenwelt; der 2.0-Takt greift dort nicht |
| `amazon-leser.js`: `textContent`-Wächter fällt mit weg | 1 | Er greift nie — „Folgen" steht auf jeder Titelseite |
| `zeichnen()`: `spuren()`, `zugangsart()`, `abos()`, `ueberKanal()` je Takt einmal statt zwei- bis viermal | 2 | Zwischenspeicher an `htmlGelesenAm`, wie `asinAusSeite()` ihn hat |
| `zeichnen()`: Diagnosefeld aus den bereits berechneten Werten bauen | 1 | Inhalt bleibt gleich; **nicht** hinter den Sparschalter schieben |
| `offeneZahl()`/`fertig()`: Serien-Zuordnung einmal je `erledigt`-Änderung aufbauen | 2 | 0,94 ms je Takt; sechs Stellen ersetzen `erledigt`, alle sechs müssen sie neu bauen |
| `uebersichtZeichnen()`: Text und Titel nur bei Änderung schreiben | 1 | Sonst je Takt ein neuer Textknoten |
| `taktSchritt()`: `const fertig` verdeckt die Funktion `fertig(asinEintrag)` | 1 | Heute harmlos, beim nächsten Zugriff ein stiller Fehlgriff |
| `taktSchritt()`: zweiter Bremsgrund für Seiten, die nie vollständig werden | 2 | Fehlerseite, Film, Regionshinweis bleiben dauerhaft bei 500 ms |
| Meldekörper: doppelter Schlüssel `zugang` (`amazon.js:3176` und `:3210`) | 1 | Zweiter gewinnt; `zugangsart()` läuft beim Melden viermal |
| Offen: `innerHTML` und `body.innerText` im echten Chrome messen | 1 | Node kann beides nicht — Skript steht in `PERFORMANCE.md`, Abschnitt 6 |

### FSK für Serien: geprüft und zurückgestellt (25.08.2026)

Der Gedanke war verlockend: Jede deutsche Disc-Veröffentlichung braucht eine FSK-Freigabe, also
müsste sich über `superType=serial` belegen lassen, **dass es eine deutsche Synchro gibt** —
unabhängig davon, ob ein Anbieter sie führt. Das hätte die 457 offenen Crunchyroll-Verweise von
einer ganz anderen Seite angegriffen, und es hätte zum Projektziel gepasst wie keine andere
Quelle.

**Zwei Einzelfälle sahen auch gut aus:** „Jujutsu Kaisen Eps 30–35" und „Chainsaw Man Staffel 1"
tragen beide `productLanguages: ["german"]`.

**Die Stichprobe hat es widerlegt.** Fünf Serien aus dem Bestand ohne Synchro, alle TV-Serien
mit mindestens zwölf Folgen aus den Jahren 2005 bis 2022:

| Suche | Treffer | verwertbar |
|---|---|---|
| Honey and Clover | 0 von 0 | nein |
| Full Metal Panic! The Second Raid | 1 von 20 | nein — `productLanguages: []` |
| Magical Girl Lyrical Nanoha | 0 von 0 | nein |
| SHUFFLE | 7 von 18 | nein — Treffer sind „Murdoch Mysteries" und „Barbie im Doppelpack" |
| Air | 143 von 400 | nein — „Die Addams Familie", „Gossip Girl" … |

**Null von fünf.** Zwei Gründe, und beide sind grundsätzlich:

1. **Die Titelsuche ist unscharf.** Sie sucht als Teilzeichenkette, nicht als Wort — „Air"
   trifft jede Serie mit „air" irgendwo im Titel, und die FSK-Datenbank enthält das gesamte
   deutsche Fernseh- und Disc-Programm, nicht nur Anime. Bei einem generischen Anime-Titel
   ertrinkt der Treffer im Rauschen.
2. **Alte Freigaben tragen das Sprachfeld nicht.** Das war schon beim Kino aufgefallen (Venus
   Wars 1996, Chihiro 2003) und trifft Katalogtitel besonders — also genau die, um die es hier
   ginge.

**Was bleibt:** Für **Kinostarts** trägt die FSK (aktuelle Freigaben, eindeutige Verleihtitel),
und dort läuft sie. Für Serien im Katalog trägt sie nicht. Wieder aufgegriffen würde das nur
mit einem anderen Einstieg als der Titelsuche — etwa über die Freigabenummer aus einer anderen
Quelle. Solange die fehlt, ist der Weg zu.

### CineStar hat eine offene API — und sie ist die beste Quelle für die Fassung (25.08.2026)

**Erst war die Bewertung falsch, und der Grund gehört dazu.** Der erste Durchgang prüfte nur die
HTML-Seite, fand kein Programm darin und schloss: „bestätigt, was läuft, kündigt aber nichts
an". Daniels Nachfrage — „hast du auch network traffic ausgewertet ob die evtl direkt für uns
nutzbar sind?" — hat das umgeworfen. Genau dafür steht die Regel
`netzwerkverkehr-statt-scraping` im Skill-Verzeichnis; angewandt hatte ich sie nicht.

Gefunden wurde die Schnittstelle **ohne Browser**: Das Bundle `/build/app.*.js` nennt seine
Endpunkte im Klartext.

**Was die API kann:**

| Endpunkt | liefert |
|---|---|
| `/api/cinema/` | **43 Kinos** bundesweit, mit `id`, `city`, `slug`, Koordinaten |
| `/api/cinema/{id}/show/` | alle Filme des Standorts samt `attributes` und `showtimes` |
| `/api/attribute/` | die Bedeutung der Attribute — 80 Stück |
| `/api/movie/{id}/`, `/api/show/{id}` | Einzelabruf |
| `/api/cinema/{id}/preview/` | kommende Filme, aber **ohne** Attribute und Datum |

`robots.txt` sperrt nur `/app_dev.php`, `/app.php` und `/admin` — `/api/` ist erlaubt. Kein
Schlüssel, keine Anmeldung.

**Die Sprachfassung steht doppelt drin.** Je Film als Attribut, je Vorstellung im Namen:

```
Detektiv Conan Film 29 – CineAnime
  Attribute: AUDIO_OmU, LANG_JA, LANG_DE, OMU, OV, ZGP_CINEANIME
  17:00  Detektiv Conan 29: Gefallene Engel (jap.OmU)
  20:00  Detektiv Conan 29: Gefallene Engel        ← ohne Zusatz: deutsch
  16:50  Detektiv Conan 29: Gefallene Engel
```

Die Attributliste führt `LANG_DE`, `LANG_JA`, `AUDIO_OmU`, `AUDIO_OV`, `AUDIO_OmeU`, `OMU`
(„OmU (Original mit Untertitel)") und `OV` („OV (Originalversion)"). Dazu `ZGP_CINEANIME` — die
Anime-Reihe der Kette ist ein eigenes Attribut, also ohne Titelraten filterbar.

**Und die Reichweite widerlegt den ersten Befund:** Die Vorstellungen des Standorts Mainz gehen
von heute **bis zum 05.06.2027** — 348 Termine, fast ein Jahr Vorlauf. Was auf der HTML-Seite
fehlt, liefert die API.

**Regionsunabhängig?** Ja, durch Iteration. Es gibt keinen bundesweiten Endpunkt, aber
`/api/cinema/` nennt alle 43 Standorte, und jeder ist einzeln abrufbar. Zur Gegenprobe:
Berlin-CUBIX (id 3) führt denselben Conan-Film mit denselben Sprachattributen. Für die Frage
„läuft dieser Film irgendwo in Deutschland auf Deutsch?" genügt die Vereinigung — 43 Abrufe je
Lauf, bei einer Anfrage je Sekunde also eine knappe Minute.

**Damit die Rangfolge für die Sprachfassung im Kino:**

1. **CineStar** — je Vorstellung, bis zu einem Jahr voraus, offene API, bundesweit
2. **FSK** — amtlich und für Serien nutzbar, aber nur je Fassung, nicht je Vorstellung; alte
   Freigaben tragen das Feld nicht
3. **Anime2You** — nennt es im Ankündigungsartikel, hängt aber an der Nachrichtenlage

### Die FSK belegt die Sprachfassung — auch für Serien (25.08.2026)

Daniels Einwand gegen Anime2You: „sie verlässt sich darauf, dass ein Nachrichtensender darüber
einen Artikel schreibt … man kann sich nicht 100% darauf verlassen, dass sie rechtzeitig
berichten."

**Die FSK hat diese Schwäche nicht.** Jede Fassung, die in einem deutschen Kino läuft oder auf
Disc erscheint, braucht eine Freigabe — das ist keine redaktionelle Entscheidung, sondern
gesetzliche Voraussetzung.

- `robots.txt`: `Disallow:` **leer**, dazu eine Sitemap. Nichts gesperrt.
- Schnittstelle: `/fskapi/ReleaseSearch`, Parameter `searchTitle`, `searchLayout=full`,
  `superType=single` (Kino) oder `serial` (Serien).
- Entscheidend: `subproducts[].productLanguages`.

**Kino, gemessen an vier Filmen:**

| Film | `productLanguages` | Wirklichkeit |
|---|---|---|
| Detektiv Conan Film 29 | `["german"]` | deutsche Synchro — von Daniel im Kino gesehen |
| Colorful Stage! The Movie | `["subtitles"]` | „exklusiv OmU, keine Synchro geplant" |
| Gundam GQuuuuuuX -Beginning- | `["foreign","subtitles","englishSubtitles"]` | OmU |
| Overlord: The Sacred Kingdom | `["foreign","subtitles"]` | OmU |

**Und für Serien über die Disc-Freigaben** (`superType=serial`, Auswertungsform „Home
Entertainment"):

| Suche | Treffer | `productLanguages` |
|---|---|---|
| Jujutsu Kaisen | „Serie, Staffel 2", Eps 30–35 und 42–47 | `["german"]` |
| Chainsaw Man | „Serie, Staffel 1", 12 Folgen | `["german"]` |

**Was das bedeutet, und was nicht.** Eine Disc-Freigabe belegt, dass eine deutsche
Synchronfassung **existiert** — nicht, dass ein bestimmter Anbieter sie führt. Für ein `dub` an
einem Stream taugt sie deshalb nicht. Für die Frage, die dieses Projekt im Titel trägt — „für
welche Anime gibt es eine deutsche Synchronfassung?" — ist sie dagegen die direkteste Auskunft,
die es gibt.

**Der Geltungsbereich, ebenfalls gemessen:**

- **Ein leeres `productLanguages` ist ein Schweigen, kein Nein.** „Venus Wars" (freigegeben
  09.09.1996) und „Chihiros Reise ins Zauberland" (03.09.2003) tragen beide `[]`, obwohl beide
  auf Deutsch laufen. Die FSK hat das Feld erst später eingeführt.
- **Eine Freigabe kommt erst kurz vor dem Start.** Für „Madoka: Walpurgisnacht Rising"
  (24.11.2026) gab es am 25.08. noch keine.
- **`releaseDate` ist nicht der Kinostart.** Bei „A New Dawn" steht dort der 02.08.2026, der
  Film läuft am 15.10. an. Die FSK liefert die Fassung, TMDB den Termin.
- **Trailer tragen oft eine andere Fassung als der Film** — gefiltert wird auf
  `productType: "SP"`.
- **Die Titelsuche ist unscharf.** „Frieren" liefert „Peter Hase" und „Ein Engel auf Erden".
  Wo es Treffer gibt, sind sie belastbar; die Zuordnung muss streng bleiben.

**Stand:** `pipeline/fetch-fsk.ts` deckt die Kino-Releases ab (vier von fünf gefunden, zwei mit
belegter Fassung, die übrigen zu Recht „unklar"). Der Serienteil ist **noch nicht gebaut** —
das ist der nächste große Schritt, denn er greift eine andere Frage an als alles bisher: nicht
„läuft es dort auf Deutsch", sondern „gibt es überhaupt eine deutsche Fassung".

### Kino-Termine und Sprachfassung — Quellenlage gemessen (25.08.2026)

**Der Auftrag** (Daniel, 25.08.2026, 10:40): „kinoapi wird benötigt um termine und sprachfassung
zu bestätigen … heute steht ein detektiv conan kinofilm im kalender, aber dort steht deutsche
sprachfassung unbestätigt, hab in meinem lokalen kino geguckt heute um 17 uhr ist die vorstellung
auf deutsch, später am tag die omu version."

**Der Fall steht im Datensatz:** „Meitantei Conan: Highway no Datenshi", 25.08.2026,
`platform: 'kino'`, Notiz „Kinostart bestätigt; die Sprachfassungen …". Insgesamt führt der
Kalender fünf Kinofilme, zwei davon mit unbestätigter Fassung.

| Quelle | Kinostart | Sprachfassung je Vorstellung | Rechtslage |
|---|---|---|---|
| **TMDB** | **ja** — 18 Termine über 6 Filme, nach Typ getrennt (Kino/Digital/Disc/TV) | **nein** — `iso_639_1` bei **17 von 18** leer | Schlüssel liegt im Projekt |
| **kinoheld.de** | ja | **ja** — `languageFlags`: `deutsch`, `OmU` | `/ajax/`, `/payment/`, `/user/` gesperrt; **kein** `Disallow: /` |
| **kino.de** | ja | ungeprüft | `/api/` gesperrt |
| **KinoCheck** | nein | nein — nur Trailer und Clips | offen |
| **MovieGlu** | ja | **nein** — `version_type` ist das Bildformat | kostenpflichtig, Doku nur UK |
| **InsideKino** | ja, kuratiert | **nein** — 0 Treffer für OmU/OV/Fassung | keine robots.txt |
| **allekinos.de** | ? | ? | keine robots.txt, per `curl` nicht erreichbar |

**TMDB breit nachgemessen** (25.08.2026), nachdem der erste Befund auf einem einzigen Film
beruhte: 18 deutsche Termine über sechs Anime-Kinofilme. Das Feld `iso_639_1` ist bei
**siebzehn** davon leer; das eine gefüllte `"de"` steht an einer **TV-Ausstrahlung**
(ProSieben MAXX), nicht an einem Kinostart. Bei **keinem** Eintrag vom Typ 3 (Kino) ist eine
Sprache hinterlegt. Die `note` trägt stattdessen Kontext wie „25th anniversary",
„DVD / Blu-ray / 4K Ultra HD" oder den Sendernamen.

**Was TMDB dafür kann und wir noch nicht nutzen:** Termine **nach Typ getrennt** — Kino (3),
Digital (4), Disc (5), TV (6), dazu Festivalpremieren (1). „Chihiros Reise ins Zauberland"
führt dort sechs Termine von 2003 bis 2026. Für Disc- und Streaming-Termine wäre das eine
Ergänzung, die keine unserer bisherigen Quellen liefert.

**InsideKino** führt einen gepflegten Startplan (Stand 22.08.2026), nennt aber keine
Sprachfassung — null Treffer für „OmU", „OV", „Fassung", „synchron" auf 108 KB. Und die Liste
ist kuratiert: Weder „Detektiv Conan" noch „Madoka" kommen darin vor.

**Was am 25.08.2026 gemessen wurde**, jeweils an der echten Seite:

- TMDB kennt den Film (1545621) und nennt für Deutschland genau **einen** Termin: 25.08.2026,
  Typ 3 (Kino). Das deckt sich mit unserem Bestand — als **Terminbestätigung** taugt TMDB also.
  Die Felder für die Sprache sind leer, und zwar nicht „nicht gefunden", sondern leer geliefert.
- Der Nuxt-Payload der kinoheld-Filmseite trägt die Sprachfassung strukturiert:
  `"languageFlags","Sprache",[…],"OmU",…,"deutsch","Deutsch"`. Das ist aber die **Filterliste**;
  Uhrzeiten stehen im ausgelieferten HTML keine — null Treffer für `"HH:MM"` und für
  Zeitstempel. Die Vorstellungen kommen per Nachladen.

**Die eine offene Frage:** über welchen Pfad. Liegt er unter `/ajax/`, ist er gesperrt und der
Weg endet dort. Liegt er woanders, ist er erlaubt — und liefert die Sprachfassung mit.

Das kann nur ein Mensch am eigenen Browser messen. Dafür liegt
`tools/kino-netzwerk-messen.js` bereit: einfügen, auf der Filmseite ein Kino auswählen,
`akKino()` aufrufen. Die Tabelle zeigt jeden Abruf mit Pfad, ob er unter einem gesperrten
Pfad liegt, und ob „OmU"/„deutsch" in der Antwort stehen.

**Zwei Quellen geprüft und verworfen** (25.08.2026, auf Daniels Nachfrage zur Google-Suche
„kino api"):

- **KinoCheck** (`api.kinocheck.com`) liefert **nur Videomaterial** — Trailer, Teaser, Clips,
  Featurettes, über die Endpunkte `/movies`, `/shows`, `/trailers`. Keine Spielzeiten, keine
  Starttermine. Das `language`-Feld meint die Sprache **des Trailers**, nicht die einer
  Vorstellung. Für die Fassungsfrage also gegenstandslos. (Als Trailer-Quelle für die
  Detailseiten wäre sie brauchbar — das ist ein eigenes Thema, kein Ersatz.)
- **MovieGlu** (`developer.movieglu.com`) ist eine echte Spielzeiten-API für über 60 Länder,
  und ihr `version_type` klingt zunächst nach dem, was wir brauchen. Die Doku sagt aber
  ausdrücklich: „Standard, 3D, IMAX, IMAX3D, Other" — das ist das **Bildformat**, nicht die
  Sprache. Kein Feld für Synchronfassung oder Untertitel. Dazu zeigt die Doku ausschließlich
  `"territory": "UK"`, und die API ist kostenpflichtig.

**Das Muster hinter beiden Absagen:** OV, OmU und Synchronfassung sind eine **deutsche
Besonderheit** des Kinobetriebs. Internationale Schnittstellen bilden Bildformate ab (3D, IMAX)
und nehmen die Sprache als gegeben — im Ursprungsland läuft ein Film in der Landessprache.
Wer die Fassung braucht, kommt an deutschen Portalen nicht vorbei. Das macht Daniels Messung
mit `akKino()` zum entscheidenden Schritt, nicht zu einem von mehreren.

### Die TMDB-Parametermatrix, vollständig durchgespielt (25.08.2026)

Daniels Frage: Filtert `region=DE` vielleicht schon die Filme heraus, für die es keine deutsche
Fassung gibt? Dann wäre die Trefferliste selbst der Beleg. Geprüft an „COLORFUL STAGE! The
Movie" (TMDB 1322752) — einem Film, der in Deutschland **ausdrücklich ohne Synchronfassung**
lief.

**Alle vier Kombinationen aus `region` und `language`, an `/movie` und `/release_dates`:**

| Parameter | `/movie`: `spoken_languages` | `/release_dates`: DE-Eintrag | `iso_639_1` |
|---|---|---|---|
| — | `["ja"]` | 05.04.2025, Typ 3 | leer |
| `region=DE` | `["ja"]` | 05.04.2025, Typ 3 | leer |
| `language=de-DE` | `["ja"]` | 05.04.2025, Typ 3 | leer |
| beide | `["ja"]` | 05.04.2025, Typ 3 | leer |

**`region` und `language` ändern an `/release_dates` gar nichts** — alle vier Aufrufe liefern
dieselben 23 Länder mit identischen Feldern. An `/movie` ändert `language` allein die
Schreibweise des Titels (gerader gegen typografischer Apostroph), sonst nichts; die Feldzahl
bleibt bei 27.

**An `discover` wirkt `region` dagegen scharf** — und das ist der brauchbare Teil:

| Parameter | Treffer im Fenster 2024–2027 |
|---|---|
| — | **592** japanische Animationsfilme mit Kinostart |
| `region=DE` | **45** |
| `language=de-DE` | 592 — ändert nichts an der Menge |
| beide | 45 |

**Die Hypothese ist damit widerlegt.** `region=DE` filtert auf „hat einen deutschen Kinostart",
nicht auf „hat eine deutsche Fassung" — denn unter den 45 stehen alle drei nachweislichen
OmU-only-Fälle. Ein Lauf über März/April 2025 gibt fünf Treffer, drei davon sind genau diese
Filme.

### Was der Abgleich der 45 mit unserem Kalender ergab

Von den 45 liegen zwei in der Zukunft: „Detektiv Conan Film 29" (25.08., **haben wir**) und
**„All You Need Is Kill" (29.09.2026, fehlte)**. Umgekehrt kennt TMDB unsere beiden anderen
künftigen Kinostarts nicht — „A New Dawn" (15.10.) und „Madoka: Walpurgisnacht Rising"
(24.11.) stehen dort nicht als deutsche Kinostarts.

**Die Quellen ergänzen sich also, keine ersetzt die andere.** Anime2You meldet früher und
kennt kleinere Verleihe; TMDB fängt, was durch die Nachrichtenlage fällt.

**Nachgetragen:** „All You Need is Kill" mit Kinostart 29.09.2026 **und** Disc-Termin
22.10.2026 (Collector's Edition, KSM Anime). Beide standen im selben Anime2You-Artikel, der
deutsche Ton ist dort ausdrücklich bestätigt — „mit deutscher Synchronisation sowie im
japanischen Originalton mit Untertiteln".

**Was unabhängig davon gebaut werden kann:** TMDB als Terminbestätigung für alle Kino-Releases.
Der Abruf ist rechtlich sauber, der Schlüssel liegt vor, und er beantwortet die halbe Frage —
ob der Termin stimmt. Die Sprachfassung bleibt bis zur Messung offen.


**ann-voices ist stumm — seit 9,1 Tagen null deutsche Rollen** (24.08.2026, 23:53)

Der Tageslauf ist daran rot geworden, und die Warnung tut genau, was sie soll:

```
⚠  ann-voices: seit 9.1 Tage nichts geliefert (zuletzt 0 Treffer)
   — keine deutschen Rollen gefunden
```

Der Lauf **läuft**, er findet nur nichts mehr. Das ist das Muster einer geänderten Seitenstruktur
bei Anime News Network, nicht das eines Ausfalls. 1.746 Titel hängen an dieser Quelle — sie ist
der Beleg für deutsche Sprechrollen und damit für Synchros, die sonst nirgends stehen.

**Zu prüfen:** Ein Einzelabruf gegen eine bekannte ANN-Seite, an der die Rollen früher standen.
Liefert er HTML ohne die erwarteten Stellen, sind die Selektoren fällig; kommt eine Fehlerseite
oder eine Bot-Sperre, ist es etwas anderes.

**Bakugan: drei Listeneinträge, drei Staffeln derselben Amazon-Serie** (Daniel, 24.08.2026)

„das war 3x in der Liste, ich hab vorhin bereits gesagt die links zeigen auf staffel 1, 5, 9,
also wieder unterschied zwischen quellen wie sie bezeichnet wird."

Unsere Titel heißen „Spieler des Schicksals", „Neu Vestroia", „Invasion der Gundalianer"; Amazon
führt eine Serie mit fünfzehn Staffeln, und unsere drei Verweise zeigen auf die Staffeln 1, 5
und 9. Welche Amazon-Staffel zu welchem unserer Titel gehört, sagt keine der beiden Seiten.

**Was schon geht:** Die Meldungen kommen vollständig an — 13 Staffeln unter einer Adresse, je
eine unter den beiden anderen, alle mit ihrer Nummer. Zuzuordnen sind sie über die
**Folgenzahl**, denselben Weg, den das Projekt bei ADN schon geht (`staffelBloecke()`): Bakugan
Staffel 1 hat 26 Folgen, „Neu Vestroia" 52, „Gundalianer" 39. Geht die Summe nicht auf, bleibt
der Block unzugeordnet — das ist besser als eine geratene Zuordnung.

### Offen für morgen: drei Beobachtungen an JoJo, ungeklärt

Aufgenommen am 25.08.2026, 02:28, ohne Eingriff — Daniel: „notier das, mach nix, wir gucken
morgen weiter". Alle drei an derselben Serie, alle drei mit Bild.

**1. Zwei Kennungen für dieselbe Staffel, je nach Weg.** Der Klick aus unserer Übersichtsliste
führt auf `amazon.de/dp/B0CG7S59KL`; die Wahl derselben Staffel 3 aus Amazons Auswahlfeld
führt auf `amazon.de/gp/video/detail/B0CG76MH1K?ref_=atv_dp_season_select_s3`. Unsere Liste
kennt nur die erste, deshalb steht auf der zweiten „nicht auf der Prüfliste" — formal richtig,
praktisch eine Sackgasse.

**Was zu klären ist:** Ob die beiden Kennungen dieselbe Staffel meinen (dann gehört die zweite
als Alias in die Liste) oder verschiedene Fassungen (Kauf gegen Kanal-Abo). Amazons Auswahlfeld
führt für JoJo mehrere Staffeln doppelt, insofern ist beides denkbar.

**2. „5 Folgen", wo keine sind.** Auf `B0CG76MH1K` mit Staffel 3 zeigte der Knopf
„🇩🇪 Deutsch · 5 Folgen · Kauf/Leihe · melden", während die Seite keine Folgenliste hat —
weder Reiter noch Kacheln. Die fünf Nummern stammen also nicht von dieser Seite.

**3. Der Zähler wandert mit dem Weg.** Dieselbe Staffel zeigte im Lauf einer Viertelstunde
nacheinander „3 Folgen", „48 Folgen" und „5 Folgen", je nachdem, ob neu geladen, gewechselt
oder aus der Liste geöffnet wurde.

**Wie es angegangen wird — nicht durch Raten.** `tools/amazon-diagnose.js` in die Konsole der
offenen Seite einfügen und `akDiagnose()` nach jedem Wechsel aufrufen. Die Tabelle nennt je
Zeitpunkt Adresse, Kennung, Staffelnummer und Zahl der gelesenen Folgen — dieselbe Messung hat
am 24.08.2026 ein Dutzend scheinbar verschiedene Fehler auf eine Ursache zurückgeführt.

**Und das ist die eigentliche Lehre dieser Nacht.** Zwischen 00:30 und 02:30 sind sieben
Fassungen der Erweiterung entstanden, jede als Antwort auf einen Screenshot, und drei davon
haben einen neuen Fehler erzeugt (15 Folgen statt 13, dann 3 statt 24, dann „nicht abrufbar"
über einer Seite mit 48 sichtbaren Folgen). Die Projektregel dazu steht seit dem 24.08. in
`CLAUDE.md` und wurde nicht befolgt: **Wo nur ein Mensch messen kann, wird die Messung erbeten,
nicht ersetzt.**

### Stand nach der Nacht auf den 25.08.2026 — die Prime-Liste ist praktisch durch

**Gemessen am Briefkasten des Workers, 01:45 Uhr:** 358 Meldungen unter 263 Kennungen; die
Liste führt 257. **Genau zwei Kennungen haben noch keine einzige Meldung:**

| Kennung | Titel | AniList | Folgen |
|---|---|---|---|
| `B0CG7S59KL` | JoJo no Kimyou na Bouken: Stardust Crusaders | 20474 | 24 |
| `B0CH5BXKFX` | Mahouka Koukou no Rettousei: Raihousha-hen | 112300 | 13 |

Beide sind die Fälle, an denen die Erweiterung in dieser Nacht hängen blieb — die doppelt
gelistete JoJo-Staffel und die Mahouka-Staffel mit zwei gesperrten Folgen. Gemeldet wurden
beide Serien, aber unter der **Sammelkennung** der Reihe (`B0CH1LLV72` bzw. `B0CN3Q9DH8`),
nicht unter der Kennung, die unsere Liste erwartet.

**Mahouka ist beantwortet** (Daniel, 25.08.2026, 02:00, selbst nachgesehen): Unter
`B0CH5BXKFX` liegt Staffel 2. Die Folgen 1, 2 und 5 sind in Deutschland nicht abrufbar, die
übrigen zehn laufen im Prime-Abo — eine davon angespielt, deutscher Ton bestätigt. Steht als
Handbeleg in `data/dub-confirmed.yaml`.

Der Widerspruch, der hier zuvor stand, war keiner: Die Meldung „Staffel 3, kein Deutsch"
meinte die **nächste** Staffel (`B0CWRDZVBY`, über den Crunchyroll-Kanal, nur englischer Ton),
nicht diese. Beide Angaben hatten recht.

**Auch JoJo ist beantwortet** (Daniel, 25.08.2026, 02:20). Amazons Staffel 3 **ist** „Stardust
Crusaders", mit 48 Folgen — beide AniList-Einträge zu je 24 zusammen (20474 und 20799), die
Summe geht exakt auf. Sie läuft über das Crunchyroll-Kanal-Abo, und die deutsche Synchro hat
Daniel dort selbst gesehen; aus Amazons Sprachfeld wäre sie bei einem Kanal-Titel kein Beleg.
Steht als Handbeleg in `data/dub-confirmed.yaml`.

Meine „24 Folgen" davor waren die Zahl **unseres Listeneintrags**, nicht die der Serie — und
ohne diesen Zusatz gelesen eine falsche Auskunft.

**Damit ist die Prime-Prüfliste durch.** Was danach noch als „nicht auf der Prüfliste"
erscheint, ist meist richtig: Wer einen Titel über Amazons **Suche** öffnet, landet auf einer
anderen Kennung als der, die unsere Liste führt (JoJo: `B0GYBTWX28` statt `B0CG7S59KL`).

**Die ~10 Titel, die vor dem Zurücksetzen offen standen, sind nicht verloren.** Sie hatten im
Worker längst Meldungen, nur der lokale Stand kannte sie nicht; der Abgleich hat sie
zurückgeholt. Deshalb sank die Zahl nach dem Zurücksetzen von zehn auf zwei.

### Erweiterung 0.86 bis 0.90 — was in dieser Nacht behoben wurde

| Fassung | Befund |
|---|---|
| 0.86 | Speicherlast gedrittelt (zweiter „Out of Memory"), Neuladezwang bei jeder Staffel über 1, Regionshinweis einzelner Folgen, Volume-Nummern lesbar |
| 0.87 | „Dieses Video ist derzeit nicht verfügbar" ist meldbar (Filme haben keine Folgenliste) |
| 0.88 | Veralteter Quelltext kippte seine Folgen jede halbe Sekunde in den Zählstand zurück; Staffel ohne Folgen wieder meldbar |
| 0.89 | Meldungen ohne Staffelnummer — 203 von 297 im Briefkasten, weil nur die Adresse gelesen wurde |
| 0.90 | Die Zahl über der Folgenliste ist der Prüfstein für den Quelltext; `staffelZahl()` las Empfehlungskacheln; gesperrte Folgen zählen als beantwortet; doppelt gelistete Staffel gilt als gemeldet |

**Der rote Tageslauf vom 24.08. ist erklärt und behoben.** Er wurde ausschließlich an
`ann-voices` rot; die Warteschlange liefert wieder (drei Titel im Probelauf), der
Gesundheitsstand meldet den Bestand statt des Zuwachses. Beide Läufe sind gelöscht.

### Daniels Prüfrunde vom 25.08.2026, 00:30–01:45 — fünf Befunde, alle behoben

Gepusht als Erweiterung **0.87**: Speicherlast (zweiter „Out of Memory"), Neuladezwang bei
jeder Staffel über 1, Regionshinweis einzelner Folgen, Amazons Volume-Nummern, und „Dieses
Video ist derzeit nicht verfügbar" als meldbarer Befund.

**Offen geblieben ist genau eine Sache — eine Meldung ohne Staffelnummer.**

Daniel zu „Haha wo Tazunete Sanzenri": „da steht 2/8 aber im tooltip steht nur s1 gemeldet,
und S ohne nummer, also irgendeine staffel ohne nummer wurde gemeldet für diesen anime oder
was?"

Genau so ist es. Unter `B016J8RJ9G` liegen zwei Meldungen: eine für Staffel 1 und eine, die
ihre Nummer nicht mitgeschickt hat — sie stammt aus einer Fassung der Erweiterung vor 0.72,
die den Staffelschlüssel noch nicht kannte. Der Zähler „2/8" ist damit richtig gezählt und
trotzdem irreführend: Er sagt nicht, welche der acht Staffeln die zweite war.

**Zu tun:** Die Meldungen im Worker nach `staffel: null` durchsehen. Der Eintrag trägt
Folgenzahl und Zeitstempel; über die Folgenzahl lässt sich die Staffel in aller Regel
zuordnen, so wie bei ADN. Was sich nicht zuordnen lässt, wird gelöscht statt geraten — Daniel
meldet die Staffel dann noch einmal, das kostet ihn dreißig Sekunden.

**Zwei Amazon-Sonderfälle, die keine Arbeit machen** (25.08.2026, beide von Daniel gemessen):

- **Dieselbe Staffelnummer zweimal im Auswahlfeld.** „Naruto Shippuden" führt „Staffel 13"
  doppelt: `B081TKST2W` mit 14 Folgen und deutschem Ton, `B07YJ5ZK7Y` mit 13 und dem
  Regionshinweis. Die Folgentitel sind identisch; in der zweiten Fassung ist Folge 4 eine
  Doppelfolge (46 statt 23 Minuten). Kein Handlungsbedarf: Der Melde-Stand hängt an der
  **Kennung**, nicht an der Nummer, und die beiden sind verschieden.
- **Staffeln in Bänden.** „Made in Abyss" führt „Staffel 2, Volume 1" als `seasonNumber: 201`
  (Hunderterstelle Staffel, Rest Band). Seit 0.86 zeigt der Knopf „2, Vol. 1"; der Schlüssel
  bleibt Amazons Zahl, denn er muss eindeutig sein.

**Und einer, der erklärt werden muss, weil er richtig aussieht wie ein Fehler:** Bei „High
School DxD" stand nach zwei von drei Staffeln „alles gemeldet". Unsere Liste führt unter
`B09QFHGS6L` **einen** offenen Eintrag (12 Folgen) — mehr braucht der Kalender dort nicht.
Amazons Staffelzahl und unsere Zahl offener Einträge sind zwei verschiedene Dinge, und der
Knopf zählt die zweite. Weitere Meldungen schaden nicht, sie sind zusätzliche Belege.

### Offen aus Daniels Prüfrunde vom 24.08.2026, 19:16

Behoben und gepusht sind: Fokus-Bug, Klick auf ganze Zeile, Staffel-Schlüssel
(Sindbad/Bakugan/Barbapapa), falsche Folgenzahl beim Wechsel, „welche Staffeln fehlen"
als Tooltip, tote Verweise meldbar.

| Aufgabe | SP | Notiz |
|---|---|---|
| **Erweiterung lädt nicht bei SPA-Navigation** | 3 | Daniel: „extension lädt nicht korrekt wenn ich von amazon homepage auf ein prime titel navigiere, erscheinen die buttons erst nach neuladen der seite (f5)". **Ursache steht fest:** Das Content-Script hängt in `manifest.json` an `https://www.amazon.de/dp/*` und `/gp/video/detail/*`. Wechselt Amazon per History-API dorthin, injiziert Chrome nichts nach — erst ein echter Seitenaufruf greift. Zwei Wege: den Match auf `amazon.de/*` erweitern und im Skript prüfen, ob eine Titelseite vorliegt (einfach, aber das Skript läuft dann auf jeder Amazon-Seite), oder `chrome.webNavigation.onHistoryStateUpdated` im Service Worker mit Nachinjektion (sauberer, braucht die Berechtigung `webNavigation`). **Zu klären, bevor gebaut wird:** `amazon.js` steigt bei fehlender Titel-Kennung mit `return` aus — es müsste stattdessen warten und erneut prüfen |
| **Arbeitsliste nach Anbieter trennen** | 2 | Daniel: „verweis auf gesamte liste ist nicht sortiert nach anbieter, trenn das nach anbieter auf." Betrifft `daniel-zum-abarbeiten/07-alle-anbieter.md` — eine Datei je Anbieter, erzeugt von `report-dub-checks.ts`. Prime Video und Crunchyroll haben eigene Wege, offen sind vor allem Disney+ (40) und die Reste |
| **Disney+ in die Erweiterung** | 5 | Daniel: „evtl melde extension auf disney+ erweitern, damit es schneller geht." 40 Verweise in 34 Reihen, je ~30 Sekunden von Hand. Bauweise wie bei Netflix: Der Player nennt seine Tonspuren, ein Skript in `world: MAIN` liest sie mit. Der bisherige Einwand („bei 40 einmaligen Prüfungen ist Handarbeit schneller") gilt weiter — er kippt, sobald regelmäßig neue Disney-Titel dazukommen |
| **Netflix: kein Melden von der Übersicht** | 2 | Daniel zu AnoHana: „keine anime-liste button sichtbar, wo ich nachgucken könnte ob dieser titel überhaupt eingetragen ist, der titel lässt sich nicht abspielen, kein melden möglich von der overview." Zwei Dinge: (1) Der Übersichts-Knopf fehlt auf Netflix-Seiten, die keine `/watch/`-Adresse sind — bei Prime Video gibt es ihn. (2) AnoHana trägt bei Netflix nur „Erinnerung", keinen Abspiel-Knopf: Der Titel ist **angekündigt, nicht verfügbar**. Dann gibt es dort nichts zu melden, und der Verweis gehört als „noch nicht abrufbar" markiert statt als offene Prüfung geführt |


**Ähnliche Titel vorschlagen** — Idee von Daniel, 24.08.2026, 16:43

Ein ausklappbarer Bereich im Detail-Panel, der Titel vorschlägt, die diesem ähneln.
Grundlage: die Überschneidung der Genres. Erweiterung: Genres an- und abwählbar, damit man
die ausblenden kann, an denen man kein Interesse hat.

**Die Datenlage trägt das.** Gemessen am 24.08.2026:

| | |
|---|---|
| Titel mit Genres | 2.749 von 2.762 |
| verschiedene Genres | 58 |
| im Schnitt je Titel | 5,4 |

**Ein Probelauf mit Jaccard-Ähnlichkeit** (Schnittmenge geteilt durch Vereinigungsmenge)
für „The Ghost in the Shell" — Genres Action, Psychological, Sci-Fi, Cyberpunk, Dystopian,
Crime:

```
75 %  Cyberpunk: Edgerunners                 ★ 8.5
75 %  PSYCHO-PASS Sinners of the System 1    ★ 7.0
71 %  Animatrix                              ★ 7.0
71 %  Mardock Scramble: The Second Combustion ★ 6.9
67 %  Psycho-Pass 3: First Inspector          ★ 7.7
```

Das sind brauchbare Empfehlungen — Edgerunners und Psycho-Pass sind genau das, was ein
Ghost-in-the-Shell-Zuschauer als Nächstes sehen will. **Ohne eine Zeile Zusatzdaten.**

**Zwei Dinge, die der Probelauf gleich mit aufgedeckt hat:**

1. **Reihen müssen gebündelt werden.** Unter den ersten acht Treffern standen vier Teile von
   Psycho-Pass. Eine Empfehlungsliste, die viermal dieselbe Reihe nennt, ist eine Liste mit
   fünf Vorschlägen, die wie acht aussieht. Die Bündelung nach `franchiseId` gibt es im
   Projekt bereits.
2. **58 Genres sind grob.** „Action" trägt fast nichts zur Ähnlichkeit bei, „Cyberpunk" sehr
   viel. Eine Gewichtung nach Seltenheit (wer selten vorkommt, zählt mehr) wäre der nächste
   Schritt — dieselbe Rechnung, die Suchmaschinen als IDF kennen. Erst danach lohnt die
   Frage nach feineren Tags aus einer zusätzlichen Quelle.

**Zur Abwählbarkeit:** Sie ist mehr als Bequemlichkeit — sie macht die Empfehlung
nachvollziehbar. Wer sieht, *warum* etwas vorgeschlagen wird (weil beide „Cyberpunk" und
„Psychological" tragen), versteht auch, warum ein Vorschlag danebenliegt. Das ist der
Unterschied zwischen einer Empfehlung und einem Orakel.

**Offen:** Sollen Titel ohne deutsche Synchro vorgeschlagen werden? Dagegen spricht der Zweck
der Seite; dafür spricht, dass ein Vorschlag mit Stern-Merken der natürliche Weg ist, wie
jemand von einem Titel zum nächsten kommt.


| Aufgabe | SP | Notiz |
|---|---|---|
| ~~① Automatisierte Quelle für Tonspuren und Neuzugänge~~ — **steht, läuft täglich** (23.08.2026, 14:45) | 5 | **Die Quelle war seit dem 21.08. angebunden, lief aber nur am 2. jedes Monats** (`tonspuren-monatlich.yml`) und holte nur den Bestandskatalog. Eine Staffel, die am 3. startet, war damit dreissig Tage unsichtbar. Neu: `pipeline/fetch-motn-changes.ts` fragt `/changes` mit `change_type=new` fuer Netflix, Prime Video und Disney+ ab und haengt im taeglichen `refresh-data`-Lauf. **Kosten: eine Anfrage am Tag** (~30 im Monat) gegen ein Kontingent von 1.000. Liefert die Tonspur mit (`audios: [deu, jpn]`) und `imdbId`/`tmdbId` fuer die Zuordnung. **Gemessen statt angenommen:** `upcoming` ist fuer Anime nutzlos (12 kuenftige Serien fuer ganz Deutschland, kein Anime), `new` bringt welche (Beelzebub, The Dangers in My Heart, GTO 2026). ~~**Offen als naechster Schritt:** Die gesammelten Aenderungen mit unserem Datensatz verknuepfen~~ — **gemessen 24.08.2026: es gibt nichts zu verknuepfen.** 11 von 152 Meldungen sind einem unserer Titel zuzuordnen, 5 tragen deutschen Ton, **0 fehlen im MOTN-Bestand.** Der Lauf meldet die Zahl jetzt selbst und warnt, sobald sie ueber null steigt — Einzelheiten im Archiv |
| **Prüfstand aller Entscheidungen vom 23.08.2026** (nach Daniels Korrektur, 15:20) | — | Daniel: „du hast falsche annahmen basierend auf falschen grundlagen gehabt, du hättest verweise gelöscht… du musst auf tatsächlicher echten grundlage entscheiden." Jede Änderung dieses Tages durch das Raster aus `pruefen-und-belegen` (Abgleich ≠ Validierung): <br>**① Amazon-Verweise sind Prime Video statt Kaufshop (360 Stück) — VALIDIERT.** Daniels Blick in sein Konto bestätigt vier Titel, die wir seither als `primevideo, zugang=abo` führen: Digimon Tamers, Gankutsuou, Mayonaka no Occult Koumuin, Mahoutsukai no Yakusoku. Vier Fälle, offener Ausgang, in der schädlichen Richtung geprüft. <br>**② Zugangsart aus JustWatch/TMDB (28 Verweise abo→kauf) — ABGEGLICHEN, NICHT VALIDIERT.** Gegenprobe mit der Streaming Availability API am 23.08.: Für DEATH NOTE, Made in Abyss und Dr. STONE meldet sie „kein Prime-Angebot" — Schweigen, also weder Beleg noch Gegenbeleg. Der schädliche Irrtum wäre „kauf, obwohl im Abo": Ein Abonnent hält den Titel für kostenpflichtig und klickt nicht, es fällt nie auf. **Bleibt bis zu Daniels Prüfung als unvalidiert markiert.** Zurückgenommen wird sie nicht — der Vorzustand (aus dem Anbieternamen geraten) war nachweislich schlechter. <br>**③ `change_type=removed` — WIDERLEGT**, siehe eigene Zeile. Sammelt nur noch. <br>**④ Crunchyroll aus der Änderungsquelle entfernt** — belegt durch Daniels Lycoris-Recoil-Prüfung **und** die eigene Kontrollmessung (96 von 99 „Quelle schweigt"). <br>**⑤ Ohne Datenrisiko:** doppelte Überschrift im Detail-Panel, Quellenangaben für JustWatch und Movie of the Night, Genre-Filter im Katalog, `loadEnv` in `fetch-motn.ts`, Disney+-robots.txt-Befund |
| **Aktualitätsmessung an einer laufenden Serie** (Daniels Vorgabe, 23.08.2026, 14:55) | — | Getestet an „Vom Landei zum Schwertheiligen" Staffel 2 (Prime Video, laufend, Folge 7 seit drei Tagen draussen). **Was die Quelle kann:** Sie fuehrt **jede einzelne Folge** mit Datum und Tonspur — Folge 1 bis 6 der laufenden Staffel, alle als `DEUTSCH` belegt, dazu die offiziellen deutschen Folgentitel. Diese Aufloesung hat sonst keine Quelle im Projekt. **Was sie nicht kann:** Folge 7 (unser Termin: 20.08.) kennt sie am 23.08. **nicht**. Und `availableSince` ist ein **Entdeckungsdatum, kein Erscheinungsdatum** — im Vergleich mit unseren Terminen: Folge 5 exakt gleich, Folge 6 einen Tag frueher, Folge 2 aber sieben Tage spaeter, weil die Quelle einen Durchlauf verpasst hat. **Schlussfolgerung: als Terminquelle ungeeignet, als folgengenauer Synchro-Beleg sehr gut.** Die Termine bleiben bei Crunchyroll (stuendlich) und der Wochentakt-Prognose; diese Quelle beantwortet „laeuft es dort auf Deutsch", nicht „wann kommt es" |
| **Bestand ohne Geld und ohne Scraping — belegt am 23.08.2026, 14:45** | 3 | Daniels Vorgabe: „wir bleiben kostenlos… beleg das scraping an einem beispiel bevor du hochscalierst." **Das Beispiel hat ergeben, dass es kein Scraping braucht.** Eine Titelsuche „Naruto" bei der Streaming Availability API liefert acht Titel mit vollstaendiger Anbieter- und Sprachinfo, inklusive `subscription` / `addon` (Aniverse-Kanal) / `buy` bei Prime Video — genau die Angabe, fuer die am Vortag Amazon-Seiten abgerufen wurden. **Der Engpass war nie das Kontingent, sondern der Zuschnitt:** Der Katalogweg fragte den kompletten deutschen Netflix-Serienkatalog ohne Genre-Filter ab und liess Prime Video und Disney+ ganz aus. Mit `genres=animation` und drei Katalogen in einer Anfrage stehen 10 Serien je Seite, 15 von 20 mit deutscher Tonspur. **Rechnung: 661 offene Titel, geschaetzt 60 bis 100 Anfragen fuer den Anime-Katalog, dazu eine am Tag fuer die Aenderungen — gegen 1.000 im Monat.** Die 49-USD-Stufe ist damit gegenstandslos. Naechster Schritt: den Katalog in Etappen durchlaufen lassen, das Restkontingent August (223) reicht fuer den Anfang |
| **JustWatch direkt auslesen — geprüft und verworfen** (23.08.2026, 14:30) | — | Daniels Vorschlag: „1x justwatch scraping für gesamt stand, und dann nur über änderung täglich per api nachfragen?" **Die Architektur ist richtig, die Quelle nicht.** JustWatchs `robots.txt` erlaubt alles (`User-agent: *` / `Disallow:` leer) und die Titelseiten tragen `audioLanguage` als schema.org-Daten — technisch waere es der kuerzeste Weg. Die Nutzungsbedingungen verbieten es aber ausdruecklich, **Abschnitt 7.1**: „In connection with the use of the Website users will not engage in or use any data mining, robots, scraping or similar data gathering or extraction methods." **Keine Ausnahme fuer private oder nicht-kommerzielle Nutzung** — Abschnitt 1.2/5.4 erlaubt die private Nutzung der Plattform, ausdruecklich nicht auf automatisiertem Weg. Dazu: „users agree not to implement any measures to circumvent such blocking" (IP-Sperre). **Dritter Fall an einem Tag, in dem die robots.txt freundlicher ist als die AGB** (nach Amazon und der Synchronkartei). Zweite Huerde, unabhaengig davon: Wir haben gar keine JustWatch-Adressen — das Feld `justwatchUrl` in `data/tmdb-titles.json` enthaelt eine **TMDB**-Adresse (`themoviedb.org/tv/<id>/watch?locale=DE`), nicht justwatch.com. **Bestandsquelle bleibt daher die Streaming Availability API**, deren Bedingungen Speichern und Anzeigen ausdruecklich erlauben |
| **⓪ Grundsatz: die Erweiterung ist kein Dauerbetrieb** (Daniel, 23.08.2026, 14:12) | — | Wörtlich: „wir können die extension zum prüfen nutzen, aber nur einmalig als bestätigung das der automatismus funktioniert, keine dauerhafte lösung… wir müssen unsere datenquellen automatisieren… wir brauchen die beste quelle, schnellster weg aktuelle infos für die webseite beschaffen, nicht erst tage später, besonders für zukünftige releases." **Damit ist der Rang der Aufgaben neu:** Eine Quelle, die von allein läuft, schlägt jede Lösung, die Daniels Handgriff braucht — auch dann, wenn sie mehr Arbeit macht. Die Erweiterung bleibt als **Gegenprobe** erlaubt (stimmt, was die Automatik liefert?), nicht als Beschaffungsweg. Zweite Vorgabe im selben Satz: **Aktualität ist Teil der Qualität.** Ein Termin, der drei Tage später ankommt, ist für einen Kalender wertlos — künftige Veröffentlichungen wiegen schwerer als Katalogpflege |
| ~~① Rechtsfrage Amazon zu Ende prüfen~~ — **grösstenteils gegenstandslos** (23.08.2026, 14:45) | 3 | **Die Zugangsart braucht Amazon gar nicht.** Recherche am 23.08.: JustWatch **scrapt nicht**, sondern bezieht ueber Partner-Integrationen — und liefert seine Daten ueber die TMDB-API weiter, die dieses Projekt seit Monaten nutzt. `watch/providers` nennt `flatrate`, `rent`, `buy` und `ads`: genau Daniels drei Kategorien, lizenziert, mit Attributionspflicht („JustWatch", steht jetzt auf der Quellenseite). Die Angaben lagen als `offers` in `data/tmdb-titles.json` und wurden nur fuer Anbieter **ohne** eigene Plattform ausgewertet. **Offen bleibt allein die Tonspur** — die fuehrt TMDB nicht; dafuer weiter ② . Nebenbefund: Die PA-API wurde am 15.05.2026 eingestellt, Nachfolger ist die Creators API (ungeprueft, ob sie Prime-Video-Metadaten fuehrt). Daniels Informationspflicht-Argument bleibt als Frage bestehen, hat aber keine praktische Dringlichkeit mehr — Bewertung im Abschnitt „Rechtslage" weiter unten |
| **Disney+: 40 Verweise ohne Sprachangabe — nur ueber die Erweiterung** (geprueft 23.08.2026, 14:50) | 2 | `disneyplus.com/robots.txt` sperrt mit `User-agent: *` / `Disallow: /` alles, ausgenommen sind namentlich genannte Suchmaschinen-Bots (Googlebot, Bingbot, Applebot, Yandex …). Damit ist Disney+ **derselbe Fall wie Netflix**: kein automatisierter Abruf, der Weg fuehrt ueber die Erweiterung. TMDB hilft nicht — `watch/providers` nennt Anbieter, aber keine Tonspuren. **Zusammen mit Prime Video haengen 640 Verweise an der Erweiterung**, das ist der groesste Hebel im Projekt. Adressformen im Bestand: `/de-de/series/<slug>/<id>` und `/browse/entity-<uuid>` |
| ~~**① Rechtsfrage Amazon: Restfrage Informationspflicht**~~ — **geprüft und entschieden am 24.08.2026**, Einzelheiten im Archiv unter „Rechtsfrage Amazon zu Ende geprüft". Kurz: Die Informationspflicht besteht (Art. 246a § 1 Abs. 1 Nr. 1 EGBGB), gilt aber gegenüber dem Käufer und begründet kein Zugriffsrecht Dritter. Entschieden hat es am Ende nicht die Auslegung, sondern eine Messung: Amazons `robots.txt` sperrt `/gp/video/api` — genau den Aufruf, über den die vollständige Folgenliste käme — und listet über 90 Bots namentlich mit `Disallow: /`. Damit fehlt dem BGH-Fall, der helfen würde (I ZR 159/10), seine tragende Voraussetzung. Es bleibt bei der Erweiterung. Der ursprüngliche Auftrag lautete: | 2 | „ich denke automatisiert wäre es besser, wenn es wirklich rechtlich nicht geht dann lassen wir es, aber ich würde das nochmal genauer untersuchen… es sind simple informationen die öffentlich zugänglich sein müssen, sonst könnten käufer sich nie dafür entscheiden." **Sein Ansatz ist neu und noch nicht geprüft: die Informationspflicht als Gegengewicht.** Zu untersuchen: (1) **Art. 246a § 1 EGBGB / § 312d BGB** — bei Fernabsatz über digitale Inhalte muss der Anbieter über „Funktionsweise" und „Kompatibilität" informieren; ob die Sprachfassung darunterfällt, ist die Kernfrage. (2) **Digitale-Inhalte-Richtlinie (EU) 2019/770**, Art. 6–8: Vertragsmäßigkeit umfasst Eigenschaften, die der Verbraucher erwarten darf. (3) Trägt eine Pflichtangabe überhaupt Datenbankschutz? Argument: Wer veröffentlichen **muss**, investiert nicht in die Beschaffung — Anschluss an EuGH *British Horseracing Board*. (4) Wie halten es **JustWatch und werstreamt.es**, die genau dieselbe Angabe zeigen — Partnerprogramm, Lizenz oder Duldung? Das ist der praktische Beleg, der mehr wiegt als jede Auslegung. **Ergebnis entscheidet, ob ② nötig ist oder ein Lauf doch geht** |
| ~~**② Erweiterung liest Amazon mit**~~ — **gebaut und in Betrieb** (23./24.08.2026) | 5 | Der Plan ist umgesetzt: `extension/amazon-leser.js` liest `audioTracks` je Folge und `benefitId` je Staffel, holt die übrigen Folgenabschnitte über `getDetailWidgets` selbst nach und markiert Kanal-Titel mit ⚠, weil Amazons Sprachangabe dort die des Kanals ist und nicht die der Folge (gemessen an „Kill Blue": Amazon behauptet 12 deutsche Folgen, ADN und Netflix sagen übereinstimmend 4). Einzelheiten in `CLAUDE.md`, Abschnitte „Amazon: die Folgenliste kommt seitenweise" und „Bei einem Kanal-Titel ist Amazons Sprachangabe kein Beleg". Der ursprüngliche Plan lautete: Der Bot darf Amazon nicht abrufen (Nutzungsbedingungen, siehe Abschnitt „Rechtslage" unten), ein Mensch mit offener Seite schon — derselbe Weg wie bei Netflix. **Was zu bauen ist:** (1) `extension/manifest.json` um `*://*.amazon.de/*` erweitern, Content-Script wie bei Netflix in `world: "MAIN"`; (2) `extension/leser.js` liest die Seiten-Fracht statt des Players — die Angaben stehen im ausgelieferten HTML, kein Netzwerk-Mitschnitt noetig; (3) auszulesen sind `audioTracks` (**je Folge**, nennt „Deutsch") und `benefitId` (**je Staffel**: `Prime`, `aniversede`, `crunchyrollde`) — **niemals `entitlementType`**, das ist kontoabhaengig und anonym immer „Unentitled"; (4) Meldung je Staffel statt je Folge, das ist der Vorteil gegenueber Netflix; (5) die Uebersicht in `melder.js` um die offenen Amazon-Titel erweitern, Adressform `https://www.amazon.de/gp/video/detail/<ASIN>?ref_=atv_dp_season_select_sN`. **Daran haengen 243 Prime-Video-Verweise ohne Sprachangabe** plus die Zugangsart je Staffel, die sonst nirgends steht. Messbelege im Abschnitt „Amazon nennt Tonspur und Abo-Bedingung selbst" |
| **Reihenfolge: neue Anime zuerst** | — | Daniels Vorgabe vom 23.08.2026: „im fokus stehen neue anime, das ist das aller wichtigste". Was 2016 und aelter ist, kommt zuletzt — auch dann, wenn dort mehr Luecken sind. Ein Kalender lebt von dem, was demnaechst laeuft; ein Katalogtitel von 2005 ist Nachschlagewerk. |
| **Crunchyroll: 172 Befunde aus dem US-Katalog nachziehen** | 2 | **Der deutsche Katalog ist erreichbar, seit dem 22.08.2026 belegt:** Der Worker frischt das Zugangspaket selbst auf — gemessen um 16:14 Uhr, geholt über eine Londoner Leitung, `land: DE`, Bucket `/DE/M2/-`, gültig 24 Stunden. Im Archiv tragen **762 Serien `katalog: de`**, und die Zahl mit belegter deutscher Fassung ist von 226 auf **406** gestiegen. Offen sind die **172 Serien mit `katalog: "us"`** und 25 ohne Angabe aus dem Lauf vom 21.08.2026. Sie sind nicht veraltet, sie beantworten eine andere Frage — die Wiedervorlage schützte sie trotzdem. Seit dem 22.08.2026 schlägt der Katalog die Frist, damit kommen sie von selbst wieder dran |
| **„Nicht mehr im Angebot" ohne Seitenanzeige erkennen** | 3 | Die Content-API meldet den Rückzug einer Serie **nicht**: Für „Dragon Ball" und „Dragon Ball Z" liefert sie 153 bzw. 291 Folgen, die Seite zeigt das Banner „Leider sind die Videos dieser Serie nicht mehr verfügbar" (Daniel, 22.08.2026). Beide Reihen stehen dadurch als erster Eintrag in `daniel-zum-abarbeiten/08-arbeitspakete.md` — 19 tote Verweise in einer Zeile. **Widerlegt am 22.08.2026:** `availability_ends` trennt die Fälle nicht — Dragon Ball (weg) und JoJo (sichtbar) tragen beide den 31.12.2025, und Daniel hat JoJo wie Lycoris Recoil als normal sichtbar bestätigt. Die Ursache ist eine andere und steht in der Zeile darüber: Der Lauf sah den US-Katalog. Drei Gruppen gemessen: 57 Serien mit Ende 12/2025 (darunter Dragon Ball Z **und Fairy Tail**), 226 mit Enden aus 2022, 220 ohne jedes Ende. Daniels erste Runde passt dazu: Ende 12/2025 → Banner; Ende 2022 (Conan, Gintama, Yu-Gi-Oh! GX) → sichtbar; ohne Ende (One Piece) → sichtbar. ~~**Entscheidet sich an zwei, drei weiteren Prüfungen aus der 12/2025-Gruppe.**~~ — **die Prüfungen sind gegenstandslos** (24.08.2026). Die These war, das Ablaufdatum trenne die Fälle; sie ist längst widerlegt, und die drei belegten Fälle reichen: Dragon Ball (weg), JoJo (sichtbar) und Lycoris Recoil (sichtbar) tragen **alle** den 31.12.2025. Weitere Stichproben würden nur bestätigen, was feststeht. Was offen bleibt, ist ein **anderes** Merkmal — und dessen Suche ist Arbeit an den Daten, nicht an Daniels Zeit |
| **Prime Video: 243 Verweise ohne Sprachangabe** (gemessen 23.08.2026, 02:05) | 5 | Der groesste offene Posten nach dem Netflix-Abend. Nur 5 von 245 Verweisen sind belegt. Die Erweiterung koennte dieselbe Arbeit leisten wie bei Netflix, muesste aber auf Amazons Seite umgebaut werden. **Messung am 23.08.2026 gemacht, Ergebnis besser als erhofft** (Abschnitt „Amazon nennt Tonspur und Abo-Bedingung selbst" weiter unten): Es braucht nicht einmal den Player — die Seite selbst nennt `audioTracks` **je Folge** und `benefitId` **je Staffel**, beides ohne Anmeldung lesbar. Ein einziger Seitenaufruf traegt damit mehr als bei Netflix, wo je Folge geklickt werden muss. **Ein Bot darf es trotzdem nicht holen** — Amazons Nutzungsbedingungen untersagen Data Mining ausdruecklich, auch einmalig. Bleibt der Netflix-Weg: mitlesen, waehrend Daniel die Seite ohnehin offen hat |
| **Sieben Netflix-Titel mit offener Staffel** | 1 | Netflix ist am 22.08.2026 von 258 offenen Adressen auf sieben gefallen, **340 Synchros sind belegt und 145 tote Verweise entfernt**. Was bleibt: ONE PIECE (sieben Arcs), KONOSUBA, Kakegurui, Ghost in the Shell SAC_2045, Pokémon Horizons, DAN DA DAN, BEYBLADE X — je eine bis sieben Staffeln. Die Erweiterung zeigt sie, sobald Daniel sie oeffnet |
| ~~**YouTube-Data-API-Schlüssel**~~ — **geprüft, bringt nichts** (23.08.2026, 19:35) | 2 | Der Schlüssel stand als Aufgabe für Daniel auf der Liste. **Vor der Bitte geprüft, und die Prüfung hat sie erledigt:** Die Data API führt für Audiosprachen **ein einziges Feld**, `snippet.defaultAudioLanguage` — die Standard-Tonspur, keine Liste. Genau dieses Feld steht normalerweise auch in der Videoseite, die ohne Schlüssel lesbar ist. An drei der offenen Verweise nachgesehen: Es **fehlt dort vollständig**, also hat der Uploader es nie gesetzt — dann ist es in der API ebenso leer. Der Schlüssel hätte Daniels Zeit gekostet und nichts geliefert. |
| **Die 23 offenen YouTube-Verweise sind großteils gar nicht deutschsprachig** (23.08.2026) | 2 | Nach Kanal aufgeschlüsselt, ohne Schlüssel ermittelt: **6× „YouTube Movies"** (Kauffilme — die Tonspur steht dort erst nach dem Kauf fest), **4× „The Official Pokémon YouTube channel"**, je einmal Nozomi Entertainment und Aniplex USA (beide US-Kanäle mit englischen Titeln), **2× animeondemand** (deutscher Anbieter). Dazu neun Playlists, überwiegend Kurzformate (Sylvanian Families, Pokémon Evolutions, Mini-Anime). ~~**Nebenbefund:** Alle 23 stehen als `zugang: kostenlos`, obwohl sechs davon Kauffilme sind~~ — **behoben 23./24.08.2026 in zwei Schritten.** Zuerst über den Kanalnamen (40 Verweise), dann über die sechs, die bei oEmbed mit HTTP 401 antworten und deshalb gar keinen Kanal tragen: Ihre Videoseite nennt eine `offerId`, das ist der Beleg. Alle sechs stehen jetzt als `kauf`, zwei Zusicherungen in `check:zugangsart` halten beide Richtungen fest. **Dabei mitgefunden:** Zwei der 401-Fälle heißen „Tokyo Ghoul … OmU" und „My Hero Academia … OmU" — Untertitel statt Synchro, vom Uploader selbst benannt. Sieben solche Verweise stehen jetzt ganz oben in `daniel-zum-abarbeiten/09-youtube-liste.md` und warten auf Daniels `0` | Alle 93 wurden am 23.08.2026 geprueft — erst ueber oEmbed (Titel und Kanal), dann ueber die JSON-Fracht der Videoseite, die die Tonspur strukturiert nennt. **41 Verweise sagen ihre Fassung selbst**, 40 davon deutsch; dazu sechs, deren Videotitel sie benennt. Kein Verweis ist geloescht, neun sind kostenpflichtig (HTTP 401 bei oEmbed, Kauf- und Leihfilme). Die uebrigen 46 nennen nichts — dort haette nur die Data API mit Schluessel eine Antwort, und die kostet Kontingent. Reste in `daniel-zum-abarbeiten/09-youtube-liste.md` |
| ~~RTL+: Verweise offen~~ — **0, erledigt** (gemessen 23.08.2026, 02:05) | 1 | 36 sind eingetragen, nachdem Daniel am 23.08.2026 festgelegt hat: „rtl+ eintraege kannst du immer davon ausgehen das sie deutsch sind, es ist ein rein deutschsprachiger online streaming dienst." Das steht als Festlegung in den Daten, nicht als Messung — RTL+ nennt die Tonspur nirgends strukturiert. Geprueft wurde, was pruefbar war: alle 42 Verweise leben, einer zeigte auf einen anderen Titel (Demon Slayer → Mugen-Train-Film) und ist ausgenommen |
| **Prüfliste „Wo läuft es" abarbeiten** (Dauerauftrag) | — | **1.158 Anbieter-Verweise ohne Sprachangabe (gemessen 24.08.2026, 11:00 aus `public/data/titles.json`)**. Verteilung: Prime Video 597, Crunchyroll 462, Disney+ 40, Netflix 26, YouTube 24, ADN 7, Joyn 2, RTL+ 0. **Belegt sind 1.081 von 2.239 Verweisen.** (Vorstand 23.08.2026, 14:45: 1.226 offen von 2.234 — der Rückgang um 68 kommt aus dem Crunchyroll-Anteil, 523 → 462, also aus dem Montags-Tiefendurchlauf.) Der Crunchyroll-Anteil laeuft maschinell nach (Montags-Durchlauf), Netflix ist mit der Erweiterung fast durch. **Die Zahlen werden gemessen, nicht fortgeschrieben** — Griff: `node -e` ueber `public/data/titles.json`, `streams[].dub`. <br>**Warum die Summe gegenueber 02:05 (872) gestiegen ist:** nicht durch Rueckschritt, sondern durch Ehrlichkeit. Der Amazon-Fix vom selben Tag hat 360 Verweise von `watchLinks` (dort standen sie als „Kaufen oder leihen") in die Prime-Video-Streams geholt. Sie waren vorher genauso ohne Sprachangabe, nur zaehlte sie niemand — Prime Video springt dadurch von 243 auf 600 offene. |
| ~~News-Quellen für Sendepausen~~ — **Filter gebaut, Rest verworfen** | 8 | Serien unterbrechen den Wochentakt (Sommerpause, Best-of-Folgen, Verschiebungen) — das steht in News, nicht in Kalender-Feeds, und ohne die Info rechnet der Kalender stur weiter (Daniels Hinweis, 11.08.2026). Die Pipeline **kann** Pausen bereits abbilden (`schedule.skipDates`), es fehlt allein die Quelle. Vorrecherche vom 11.08. steht unten unter „Recherche News-Quellen". Vorgehen wie bei den übrigen Quellen: Treffer als Vorschlag nach `data/proposals/`, nicht direkt in den Datensatz — „pausiert" aus einem Fließtext zu lesen ist Deutung, und die gehört vor die Quellenpflicht gestellt |

### Terminiert (läuft von allein)

Geplante Aufgaben, die zu einem festen Zeitpunkt selbst anspringen. Zählen im Footer als 📅,
nicht als „jetzt möglich" — entschieden und eingeplant ist beides schon, es fehlt nur die Zeit.

| Wann | Was | Aufgabe |
|---|---|---|
| stündlich :23 | **Sendezeiten** | `refresh-hourly.yml`, Crunchyroll-Kalender über drei Wochen. Committet nur bei echter Änderung |
| täglich 06:17 | **Alle Quellen** | `refresh-data.yml`: AniList, Crunchyroll, ADN, Anime2You, aniSearch, danach `data:check` als Wachhund gegen stumm gewordene Quellen |
| 02.09.2026, 06:17 | **Tonspuren bei Netflix, Prime und Disney+** | `tonspuren-monatlich.yml`, 800 der 1.000 Monatsabrufe der Streaming Availability API. Läuft am 2. jedes Monats, einen Tag nach dem Zurücksetzen des Kontingents |
| montags 07:41 | **Wöchentlicher Tiefendurchlauf** | Läuft von allein (`cron: 41 5 * * 1`), nächster am 24.08.2026. Steht hier, damit er nicht als Aufgabe verwechselt wird — anzustoßen ist nichts. Nur wenn er rot wird, springt `claude-reparatur.yml` an und öffnet einen Pull Request |

### Später (nice to have)

Bewusst zurückgestellt. Zählt im Footer als „später", nicht als „jetzt möglich" — damit die
Liste der wirklich anstehenden Arbeit nicht von Dauerbrennern verstopft wird. Wird hier
herausgeholt, wenn der User es sagt.

| Idee | SP | Notiz |
|---|---|---|
| **Statusanzeige fürs Handy** | 2 | Die Anzeige liegt unter `C:codeai__assets	oolslauf-status` und startet seit dem 21.08.2026 beim Anmelden von selbst (`Laufstatus.vbs` im Autostart). Für das Handy müsste die Datei nur irgendwo erreichbar liegen — sie fragt eine einzige Adresse ab und braucht keinen Schlüssel. **Zurückgestellt am 21.08.2026:** „die idee mit handy brauchen wir erstmal nicht". Der zweite Rest, ein Fenster das immer oben bleibt, ist mit dem Autostart hinfällig — Daniel schiebt es sich einmal am Monitor zurecht |
| Synchronstudios als Quelle | 8 | **Recherche am 11.08.2026 gemacht, Ergebnis ernüchternd.** Oxygen Sound Studios führt unter [o2studios.com/de/projekte](https://o2studios.com/de/projekte/) eine reine Referenzliste: „Chainsaw Man – Der Film Reze Arc — Deutsche Synchronisation", ohne jedes Datum und ohne Status. Violetmedia ist von hier aus nicht erreichbar (TLS-Handshake bricht ab, wie schon bei aniverse.de). Ein Studio nennt also, **dass** es eine Fassung macht — nicht **wann** sie kommt. Das ist nachvollziehbar: Der Termin gehört dem Lizenznehmer, nicht dem Studio. **Rest-Nutzen:** Die Projektlisten wären ein Beleg dafür, dass eine deutsche Fassung überhaupt existiert oder entsteht — für die `dubConfidence`, nicht für den Kalender. Als Terminquelle zurückgestellt; eine Anfrage lohnt nur, wenn ein Studio überhaupt Termine kennt und nennen dürfte |

### Gemessen am 24.08.2026: nextVideoReleaseDate bringt derzeit nichts

Der ADN-Endpunkt `/show/<id>` liefert ein Feld `nextVideoReleaseDate` — den exakten
Termin der nächsten Folge, anonym abrufbar. Das klang nach einer Terminquelle, die dem
Projektziel direkt dient, und stand als Aufgabe in der Liste.

**Die Messung sagt etwas anderes.** Von 20 laufenden Serien tragen 6 einen künftigen Termin:

| Serie | Termin | Sprachen |
|---|---|---|
| One Piece | 30.08.2026, 23:00 | `vde`, `vostde` |
| HELL MODE | 28.08.2026, 18:30 | nur `vostde` |
| Rilakkuma | 29.08.2026, 03:00 | nur `vostde` |
| The Forsaken Saintess | 24.08.2026, 16:30 | nur `vostde` |
| The World is Dancing | 24.08.2026, 15:30 | nur `vostde` |
| Flaming Dodgeball Girl Danko | 24.08.2026, 16:30 | nur `vostde` |

**Auch der One-Piece-Termin ist keiner.** Das `vde` auf Serienebene stammt von älteren
Folgen; die laufenden Folgen 1172 bis 1175 tragen alle nur `vostde`, und Folge 1176 am
30.08. wird ebenso eine Untertitelfolge sein. Die Serienangabe ist eine ODER-Verknüpfung
über alle Folgen und sagt über die nächste nichts.

Damit sind **alle sechs** künftigen Termine Untertitel-Termine. Für einen Kalender, der
deutsche Fassungen zeigt, ist der Gewinn null — `fetch-adn.ts` filtert Folgen ohne `vde`
bewusst heraus.

**Wann das neu zu bewerten wäre:** Wenn der Kalender künftig auch Untertitel-Termine zeigen
soll (Produktentscheidung, nicht Technik), ist das Feld sofort nutzbar und liefert exakte
Termine auf die Minute. Oder wenn eine Simulcast-Serie mit laufender Synchro auftaucht —
dann nennt das Feld den nächsten deutschen Termin.

### Zu besprechen

*(nichts offen)*

### Warten auf Feedback

**Google-DMARC-Bericht unter der neuen Politik** — erwartet ab dem 26.08.2026

Seit dem 24.08.2026, 12:05 steht die Zone auf `p=quarantine`. Ob die Empfänger das auch so
anwenden, sagt erst der nächste Aggregatbericht: Unter `<policy_published>` muss dort
`<p>quarantine</p>` stehen statt `none`. `<disposition>` bleibt dagegen bei sauberen Mails
auf `none` — es gibt nichts auszusortieren; sie springt erst um, wenn eine Mail durchfällt.
Wer das verwechselt, hält eine funktionierende Umstellung für gescheitert.

Der Weg dorthin: Der Newsletter geht täglich um 07:00 Berliner Zeit raus, Google fasst einen
Tag zusammen und schickt den Bericht am Folgetag. Der erste Bericht unter der neuen Politik
deckt also den 25.08. ab und trifft am 26.08. ein. Daniel legt ihn in den Übergabeordner,
ausgewertet wird er mit `tools/dmarc-auswerten.mjs`. Die bisherigen 15 Berichte liegen
gesammelt unter `__assets/notes/dmarc-berichte/` — bewusst ausserhalb des Repos, weil sie
Mailadresse und Absender-IPs enthalten.

**Fällt dort etwas durch**, ist die Umstellung in fünf Minuten zurückgedreht: in
`tools/inwx-dns.mjs` wieder `p=none`, dann `node tools/inwx-dns.mjs --apply`.
| Thema | Seit |
|---|---|
| Antwort von aniSearch auf die Anfrage nach einer Titeldaten-Schnittstelle (abgeschickt 09.08.2026 an api@anisearch.com); dabei auch gefragt, ob die Beschreibungen mit Quellenangabe öffentlich stehen dürfen | 09.08.2026 |

## Recherche News-Quellen (11.08.2026, angefangen — nicht abgeschlossen)

Erster Schritt der Aufgabe „News-Quellen für Sendepausen". Geprüft wurde nur, was ohne
Abrufcode zu prüfen ist: robots.txt und ob es einen Feed gibt. **Kein Zeilencode geschrieben,
keine Inhalte ausgewertet.**

| Quelle | robots.txt | Feed | Bewertung |
|---|---|---|---|
| anime2you.de | erlaubt (sperrt nur `wp-admin`) | `/feed/` → 200, echtes RSS, 54 KB | **Bester Kandidat.** Wir lesen die Seite ohnehin schon (`scrape-anime2you.ts`), aber bisher nur die Termin-Artikel. Ein Feed ist der schonendste Weg überhaupt: eine Anfrage statt vieler |
| nipponinsider.de | erlaubt (sperrt nur `wp-admin`) | `/feed/` → 200, echtes RSS, 12 KB | Zweiter Kandidat, kleinere Redaktion |
| crunchyroll.com/de/news | `/news` nicht gesperrt | `/de/news/rss` → 200, aber `text/html` — **kein Feed** | Ginge nur als HTML-Auslesen. Zurückstellen, bis die beiden Feeds ausgewertet sind |
| anisearch.de/news | erlaubt | `/news/rss` → 404 | Kein Feed vorhanden |

### Nachtrag 11.08.2026: Lizenznehmer statt Studios — und wer sie beobachtet

Aus der Studio-Recherche folgt die Frage, ob man nicht bei den **Lizenznehmern** suchen sollte.
Die zerfallen in zwei Gruppen, und nur eine hilft:

- **Streaming-Lizenznehmer sind die Plattformen selbst.** Crunchyroll und ADN lesen wir bereits
  maschinell; Netflix, Prime und Disney+ veröffentlichen keine Kalender. Kein neuer Weg.
- **Disc- und Kino-Publisher** (peppermint, KAZÉ, AniMoon, Nipponart, Universum, polyband)
  müssen Termine nennen, weil man vorbestellen soll. Genau diese pflegen wir bisher von Hand.

Direkt bei den Publishern auszulesen ist aber der mühsamste Weg: zehn Seiten, zehn Bauweisen.
peppermints Übersicht (`/anime`) rendert per JavaScript, im HTML steht kein einziges Datum;
AniMoon und Universum waren von hier aus nicht erreichbar. polyband sperrt in seiner robots.txt
ausschließlich `ClaudeBot`.

**Erledigt am 12.08.2026 — und zwar ohne eine einzige Publisher-Seite abzurufen.** aniSearch
führt beides selbst: den **deutschen Publisher** je Titel (in 310 ausgewerteten Infoboxen 60
verschiedene, von Crunchyroll mit 83 Titeln bis polyband mit 13) und im Abschnitt `items` die
**deutschen Neuerscheinungen mit Datum**, Jahre im Voraus — „Banana Fish – Vol. 1/2 [Blu-ray],
21.08.2026". In 110 archivierten Seiten stecken 136 künftige Termine, 96 Seiten führen
überhaupt eine solche Liste.

Damit ist die polyband-Frage hinfällig: Wir bekommen dieselbe Auskunft aus einer Quelle, die
uns das Lesen erlaubt, und zwar für **alle** Publisher zugleich. Die Rohabschnitte liegen schon
im Archiv — `items` war beim Archivieren am 11.08. bewusst mit aufgenommen worden, weil
deutsche Disc-Termine dort „das Wertvollste auf der Seite" wären, falls sie darin stehen. Sie
stehen darin. Neue Aufgabe in der Queue.

**Der bessere Hebel sind Seiten, die alle Publisher zugleich beobachten:**

| Quelle | robots | Feed | Was sie liefert |
|---|---|---|---|
| **anime2you.de** | erlaubt | RSS | **Die stärkste Quelle, und wir haben sie schon.** Fasst Ankündigungen je Season gebündelt zusammen: „Crunchyroll zeigt zehn Anime-Neustarts im Sommer 2026 auf Deutsch". Bisher werten wir nur die Termin-Artikel aus, nicht diese Übersichten |
| manga-passion.de | erlaubt (`Disallow:` leer) | ja | Schwerpunkt Manga, deckt aber Publisher-News mit ab |
| sumikai.com | erlaubt | RSS | Japan-News allgemein, Anime als Teilbereich |
| nipponinsider.de | erlaubt | RSS | kleinere Redaktion, zweite Meinung |
| animehunter.de | zu prüfen | zu prüfen | Führt Jahreslisten „Deutsche Anime-Lizenzen 20XX" über **alle** Publisher hinweg — genau die Lizenznehmer-Übersicht, die einzeln zu scrapen mühsam wäre |

**Wettbewerber gefunden — und der Vergleich schärft, worin unser Unterschied besteht:**
[animeradar.de](https://www.animeradar.de/kalender) bietet einen Release-Kalender filterbar nach
deutscher Synchro, dazu Android-App, Community, Discord, Toplisten, Nutzerprofile. Der Aufbau
ist ausgereifter als unserer. **Ihre Datenbasis sind laut eigenem Impressum-Hinweis TMDb und
AniList** — beides Quellen, die wir ebenfalls nutzen.

Genau daraus folgt die Grenze, und sie schreiben sie selbst unter ihren Filter:

> „Bestätigt nur, dass eine deutsche Synchro **existiert**"

TMDb und AniList führen den **Originaltermin**: AniLists `airingSchedule` ist der japanische
Sendeplan, TMDbs `air_date` die Erstausstrahlung. Ein deutscher Ausstrahlungstermin steht in
keiner der beiden APIs. Ablesbar auch an der Menge: **120 Releases in der Woche vom 10.08.**
gegenüber einer Handvoll bei uns — das ist der japanische Sendeplan mit einem Ja/Nein-Filter
darüber, nicht ein deutscher Terminkalender.

Was aus TMDb + AniList prinzipiell **nicht** abzuleiten ist und bei uns aus eigenen Quellen kommt:

| | unsere Quelle |
|---|---|
| **Wann** die deutsche Folge läuft | Crunchyroll-Simulcastkalender (Playwright, stündlich), ADN |
| **Uhrzeit** der deutschen Folge | derselbe Kalender |
| Ob **diese eine Folge** synchronisiert ist | ADN-Sprachcode je Folge (`vde` vs. `vostde`) — eine Reihe kann mit Untertiteln starten und erst später eine Synchro bekommen |
| Disc- und Kino-Termine | Handpflege aus Publisher- und Presseangaben |
| Sendepausen im deutschen Takt | offen — siehe Aufgabe „News-Quellen" |
| Quellenangabe je Termin | Pflichtfeld im Datensatz |

**Gegenprobe am Einzelfall (Daniel, 11.08.2026):** AnimeRadar zeigte „Chiikawa Folge 369
erscheint in 2 Tagen". Nachgeprüft über die ADN-API: ADN Deutschland führt Chiikawa mit **120
Folgen, Sprachcode `vostde`** — deutsche **Untertitel**, nicht Synchro (`vde`). Damit sind es
zwei Fehler in einer Zeile: die Folgennummer stammt aus dem japanischen Sendeplan, und eine
deutsche Synchro gibt es überhaupt nicht. **Unser Kalender liegt richtig, indem er den Titel
nicht führt** — der ADN-Abruf prüft den Sprachcode je Folge. Genau diese Trennlinie kann ein
Ja/Nein-Filter aus TMDb oder AniList nicht ziehen.

Das bestätigt den Kurs: Der Aufwand mit Playwright, ADN und Handpflege **ist** der Unterschied.
Als Quelle taugt AnimeRadar folglich nicht — es wäre Abschreiben bei jemandem, der die Frage
„wann kommt es auf Deutsch" gar nicht beantwortet. Als Maßstab für Funktionsumfang und
Bedienung dagegen sehr wohl.

**Offen und vor dem Bauen zu klären:** Wie oft steht eine Sendepause überhaupt in diesen News,
und mit welchen Worten? Bevor ein Erkenner gebaut wird, sollte einmal von Hand durch ein paar
Wochen Feed gelesen werden — sonst baut man eine Mustererkennung für einen Fall, den es in der
Praxis dreimal im Jahr gibt. Kandidaten für Signalwörter: Pause, pausiert, Sendepause, entfällt,
verschoben, Best-of, Recap.

## Recherche Synchro-Belege (15.08.2026)

**Anlass:** Nach der Rücknahme der Crunchyroll-Gastauskunft standen 2.678 Anbieter-Verweise auf
„unbekannt". Daniel hat sich gegen angemeldetes Crawling und für eine unabhängige Quelle
entschieden.

**Ergebnis: Die beste Quelle liegt seit dem 11.08.2026 im Repo und wurde für diese Frage nie
benutzt** — die deutschen Sprechrollen von AniList unter `public/data/voices/<id>.json`.

- **1.746 von 2.758 Titeln haben deutsche Sprechrollen.** Ein deutscher Sprecher zu einer Rolle
  ist ein direkter Beleg dafür, dass eine deutsche Fassung existiert — kein Indiz, kein
  Rückschluss über Verfügbarkeit.
- **1.543 davon haben weder einen deutschen Termin noch einen belegten Stream.** Für sie ist das
  bislang die einzige Auskunft, die wir maschinell haben, und sie lag ungenutzt herum.
- **Frieren: Beyond Journey's End: 13 deutsche Rollen** (Julia Casper, Linda Fölster, Janek
  Schächter, Alexander Merbeth). Damit ist belegt, dass Crunchyrolls `deutschImAngebot: false`
  ein Falschnegativ war — Daniels Einschätzung vom 15.08. bestätigt sich.

**Grenze der Quelle, und sie ist scharf:** Sprechrollen belegen, **dass** es eine deutsche
Fassung gibt — nicht, **wo** sie läuft. Ein `stream.dub = true` darf daraus nicht abgeleitet
werden; die Frage „gibt es eine Synchro" und die Frage „hat dieser Anbieter sie" sind zwei
verschiedene, und genau ihre Vermischung war der Fehler bei Crunchyroll.

### Geprüfte und verworfene Kandidaten

- **AnimeSchedule (v3)** — verworfen. Die API kennt zu Tonspuren nur `subPremier`, `dubPremier`,
  `subTime`, `dubTime`, und alle vier sind laut eigener Dokumentation ausdrücklich auf
  **Englisch** bezogen. Es gibt kein Feld für eine andere Sprache. Die `StreamEntry`-Objekte
  führen Plattform und Adresse, aber keine Sprachangabe.
  Quelle: <https://animeschedule.net/api/v3/documentation/anime>
- **MyDubList** — bleibt als Bestandsquelle, taugt aber nicht für diese Frage. Die Stufen sind
  reine Quellenzählungen (`low` ≥ 1 Quelle … `very-high` ≥ 4), und es gibt **keine**
  Unterscheidung zwischen „Synchro existiert" und „Synchro angekündigt".
  Quelle: <https://github.com/Joelis57/MyDubList>
- **Deutsche Synchronkartei** — rechtlich ausgeschlossen, unverändert seit 11.08.2026:
  „Insbesondere ist ein automatisiertes Auslesen des Internetangebots nicht gestattet."
- **Crunchyroll selbst** — als Quelle über sich selbst ungeeignet, siehe CLAUDE.md. Drei
  verschiedene Ansichten je nach Anmeldestatus; ein Direktabruf am 15.08. lief zusätzlich in die
  Bot-Sperre (313 Zeichen Seiteninhalt).

- **JustWatch** — **vollständig verworfen** (15.08.2026), auch für die Terminfrage.

  Zwischenzeitlich stand hier, die `upcoming`-Zeitfenster machten JustWatch zum
  aussichtsreichsten Kandidaten für Termine. Das war aus der **Feldliste** geschlossen und nicht
  gemessen — der Fehler, gegen den die Regel „prüfen und belegen" gerichtet ist. Die Messung
  danach kippt es:

  - Die deutsche Übersicht „demnächst verfügbare Serien" führt **104 Titel für ganz
    Deutschland**, über alle Anbieter zusammen, und darunter ist Anime praktisch nicht
    vertreten. Unser Datensatz hat allein 181 Releases und 689 Termine.
  - Gegenprobe an einem belegten Fall: Für „The Dangers in My Heart" führt JustWatch nur die
    **bestehende** Verfügbarkeit. Der Netflix-Start von Staffel 2 am 20.08.2026, den wir aus
    Anime2You haben, steht dort nicht.

  JustWatch beantwortet „wo läuft es **jetzt**" — und das beantworten AniList, TMDB und aniSearch
  für uns bereits. Ein Partnervertrag für eine Auskunft, die wir haben, und ohne die, die uns
  fehlt, lohnt nicht. Der Vollständigkeit halber bleibt unten stehen, was die API kann und was
  eine Partnerschaft verlangt hätte.

  Verworfen für Tonspuren: Das dokumentierte Offer-Objekt führt `monetization_type`,
  `provider_id`, `presentation_type` (nur `sd`/`hd`), `date_created`, `retail_price`, `currency`
  und `urls` — **kein Feld für die Tonspur**. `audioLanguage`/`subtitleLanguage` tauchen nur in
  kodierten Adressparametern auf und sind in allen Beispielen leer. `original_language` ist die
  Produktionssprache, bei Anime also Japanisch.

  Interessant ist etwas anderes: Für noch nicht verfügbare Titel liefert die API statt `offers`
  ein `upcoming`-Feld mit `release_window_from`, `release_window_to`, `release_type`, `country`
  und `provider_id`. Das ist genau unsere Kalenderfrage für Netflix, Prime Video und Disney+ —
  die Anbieter, für die Anime2You bisher unsere **einzige** Quelle ist. Ein Zeitfenster statt
  eines Tages passt außerdem zu unserem Umgang mit Unsicherheit.

  Zwei weitere Passgenauigkeiten: `id_type` akzeptiert `tmdb`, und TMDB-Kennungen haben wir
  bereits — die Zuordnung wäre ohne Titelraten. Und Serien lassen sich je `season_number`
  abfragen, also in unserer Staffel-Granularität.

  **Ablauf der Partnerschaft** (15.08.2026 recherchiert): Formular auf der Produktseite oder Mail
  an `data-partner@justwatch.com` → Vertrag („Once the contract is concluded") → ein eindeutiger
  Partner-Token, der an jede Anfrage angehängt wird. Drei Bezugsformen stehen zur Wahl: API,
  Daten-Abzug („data dump") und Widget.

  **Kosten sind nirgends öffentlich.** Weder die API-Doku noch der Content-Partner-Leitfaden,
  das Partnerportal, die Produktseite oder das offizielle WordPress-Plugin nennen einen Preis
  oder eine kostenlose Stufe. Es ist ein Vertriebsgespräch, kein Self-Service — ob ein
  unkommerzielles Projekt etwas zahlt, klärt erst die Anfrage. Nicht behaupten, es sei
  kostenlos.

  Preis: Zugang nur mit **Partnervertrag** und Partner-Token, und jede Einbindung muss „branded
  links to the JustWatch website" zeigen — Ankertext „JustWatch" oder das Logo mit alt-Text, und
  der Link muss in die länderspezifische Unterseite des jeweiligen Titels führen.

  **Nachtrag 21.08.2026 — auch für die Sprachfrage gemessen und verworfen.** Daniel bat um
  eine Quelle, die Handarbeit ganz erspart. JustWatch wäre der naheliegende Kandidat: Die
  öffentliche GraphQL-Schnittstelle unter `apis.justwatch.com/graphql` braucht keinen
  Schlüssel, und beide robots.txt (`www.` und `apis.`) enthalten `Disallow:` ohne Wert,
  erlauben also alles. Sie kennt unsere Titel sogar folgengenau — für „Thunder 3" liefert sie
  zwölf Episoden mit Titeln.

  **Aber `audioLanguages` ist leer.** Gemessen an zwei Titeln, Serien- wie Episodenebene:
  „Thunder 3" (2026) und „Beastars" (2019) liefern für jedes Netflix-Angebot
  `audioLanguages: []` und `subtitleLanguages: []`. Damit ist JustWatch genau dort blind, wo
  wir es bräuchten. Das deckt sich mit einem fremden Erfahrungsbericht, der dieselbe Aufgabe
  löst ([ma.ttias.be](https://ma.ttias.be/finding-dutch-audio-across-streaming-services/)):
  Der Autor nutzt JustWatch als Grundgerüst und die Streaming Availability API, um genau
  diese Sprachlücken zu füllen.

  Die beworbene Produkt-API von JustWatch ist davon unberührt — sie läuft weiter über einen
  Partnervertrag (`data-partner@justwatch.com`) und ist damit aus denselben Gründen
  ausgeschlossen wie am 11.08.2026 festgestellt.

- **JustWatchs privater GraphQL-Endpunkt** (`https://apis.justwatch.com/graphql`) — verworfen
  (15.08.2026). Anlass war eine kursierende Anleitung, die ihn mit Puppeteer und
  `--disable-web-security` plus `setBypassCSP(true)` anspricht und dabei die Kopfzeilen der
  JustWatch-Weboberfläche mitschickt (`App-Version: 3.8.0-web-web`, `DEVICE-ID`).

  Drei Gründe, und der erste allein genügt:

  1. **Der beschriebene Trick löst ein Problem, das wir nicht haben.** CORS ist eine
     Browser-Beschränkung. Unsere Pipeline läuft in Node auf GitHub Actions; dort gibt es kein
     CORS. Der gesamte Kunstgriff des Artikels ist für uns gegenstandslos.
  2. **Es liefert nicht, was uns fehlt.** Zurück kommen Titel, Poster, IMDB-Wertung, Genres und
     Anbieterpakete — alles vorhanden. Eine Tonspurangabe ist in keinem der nachgebauten Clients
     dokumentiert, und in der offiziellen Partner-API sind genau diese Felder leer.
  3. **Es hieße, ihre Weboberfläche zu imitieren.** Eigene Kopfzeilen nachzubauen und CSP zu
     umgehen ist das Umgehen einer technischen Maßnahme, während JustWatch die Datennutzung
     ausdrücklich über Vertrag und Token führt. Dazu praktisch: undokumentiert, ändert sich ohne
     Ankündigung, keine veröffentlichten Rate Limits — „excessive usage could lead to throttling
     or blocking".

  Was an JustWatch für uns wertvoll wäre — die `upcoming`-Zeitfenster —, liegt gerade **nicht**
  in diesem Endpunkt, sondern hinter dem Vertrag. Letzteres ist mit diesem Projekt vereinbar (wir
  verlinken Quellen ohnehin, und es ist unkommerziell) — der Vertrag ist eine Entscheidung, die
  Daniel treffen muss. Die inoffiziellen Endpunkte scheiden aus: JustWatch untersagt dort die
  kommerzielle Nutzung, und sie sind ungeschützt gegen Änderungen.
  Quelle: <https://apis.justwatch.com/docs/api/>
- **TMDB `watch/providers`** — verworfen. Die Antwort enthält je Anbieter nur `provider_id`,
  `provider_name`, `logo_path`, `display_priority` und die Verfügbarkeitsart (`flatrate`, `rent`,
  `buy`, `ads`). Keine Tonspur, an keiner Stelle.
  Quelle: <https://developer.themoviedb.org/reference/movie-watch-providers>

  Der Vorschlag, TMDB neben JustWatch zu legen, um daraus eine Audio-Matrix zu bauen, stammt aus
  einer Gemini-Antwort (Daniel, 15.08.2026) und hält der Nachprüfung nicht stand — **keine** der
  beiden Quellen führt die Tonspur. Notiert, weil er plausibel klingt und sonst ein zweites Mal
  geprüft würde.

### GitHub-Durchsicht (15.08.2026)

Durchsucht nach Projekten, die deutsche Synchro- oder Termindaten führen. Zwei Funde, einer davon
wichtig.

**Gefunden und übernehmenswert: `manami-project/anime-offline-database`**
(<https://github.com/manami-project/anime-offline-database>, ODbL + DbCL, wöchentlich aktualisiert,
5,8 MB komprimiert). 41.537 Einträge, jeder mit den Adressen desselben Anime bei zehn Diensten.
Gemessen gegen unseren Bestand:

- **2.756 unserer 2.758 Titel** sind darin enthalten.
- 2.613 mit aniSearch-Kennung — für uns **ohne Wert**, unsere eigene Zuordnung hat 15.265 Einträge
  und ist damit besser.
- **2.112 mit ANN-Kennung** und 2.401 mit AniDB-Kennung — beides haben wir nicht.

**Warum die ANN-Kennung zählt:** Die Encyclopedia-API von Anime News Network führt Sprechrollen
**nach Sprache**, `<cast gid="…" lang="DE">`. Nachgemessen am 15.08.2026:

- Frieren: 13 deutsche Rollen bei ANN, exakt so viele wie bei AniList — dieselben Namen.
- Entscheidender Test an **8 Titeln, für die AniList keine deutschen Stimmen führt**: **5 haben
  bei ANN welche** (Eyeshield 21: 6, Gankutsuou: 8, FAKE: 5, MUSHI-SHI: 3, Three Little Ghosts: 1).
  622 unserer Titel fallen in diese Gruppe; die Stichprobe legt rund 380 zusätzlich belegte
  Synchros nahe.

Bedingungen von ANN, alle erfüllbar: Quellennennung, ein Link zum jeweiligen Encyclopedia-Eintrag
auf jeder Seite, die die Angaben zeigt, und **1 Anfrage pro Sekunde** je IP. 2.112 Titel wären
damit ein einmaliger Lauf von rund 35 Minuten.
Quelle: <https://www.animenewsnetwork.com/encyclopedia/api.php>

**Geprüft und verworfen:**

- `StrikerLUL/anime-ger-dub-tracker` — 125 Titel, scrapt aniSearch, keine Lizenz, ausdrücklich
  „Work in Progress". Wir haben denselben Bestand vollständiger im eigenen Archiv.
- `Funami580/MAL-GerDubs` — Handkuratierung wie MyDubList („whenever I see a new dub
  announcement"), kein eigenständiger Datenstand.
- `saitho/synchronkartei-api-server` — zwischengespeicherte Synchronkartei-Inhalte. Ändert nichts
  daran, dass die Synchronkartei automatisiertes Auslesen untersagt; ein fremder Zwischenspeicher
  wäscht das nicht.
- `princessmiku/anime2you` — RSS-Bibliothek für Anime2You. Wir lesen die Artikel bereits selbst
  und brauchen mehr als die Kurzfassung des Feeds.

### Offen

- **aniSearch-API** — Anfrage seit 09.08.2026 unbeantwortet.
- ~~**Anime News Network** — ungeprüft, ob deutscher Cast dort breiter gepflegt ist als bei
  AniList.~~ **Am 16.08.2026 gemessen und angebunden.** Die Encyclopedia-API führt Sprechrollen je
  Sprache (`<cast lang="DE">`), erlaubt eine Anfrage pro Sekunde und verlangt Quellenangabe samt
  Verweis auf den Eintrag. Die Zuordnung AniList → ANN kommt aus dem Offline-Datensatz von
  manami-project (8.876 Kennungen). Ergebnis: **218 Titel mehr mit belegten deutschen
  Sprechrollen, 8.737 Rollen** — ANN pflegt den deutschen Cast tatsächlich breiter. Läuft
  wöchentlich (`data:ann:ids`, `data:ann:voices`), Rohantworten liegen unter `data/ann-raw/`.

## Recherche Sprachangaben ohne Handarbeit (21.08.2026)

**Anlass:** Daniel fragte, wofür er bei der Prüfliste noch gebraucht wird. Gemessene
Verteilung der 1.971 offenen Verweise: Crunchyroll 969, Netflix 532, Prime Video 214,
YouTube 92, ADN 61, RTL+ 42, Disney+ 38, Aniverse 21, Joyn 2.

**Netflix scrapen ist ausgeschlossen, und zwar nicht technisch.** `netflix.com/robots.txt`
beginnt mit:

    User-agent: *
    Disallow: /

Danach folgt eine Liste namentlich erlaubter Suchmaschinen-Bots (Googlebot, Applebot,
bingbot, Baiduspider, Yandex und weitere). Wir stehen nicht darauf. Das ist eine
ausgesprochene Absage, kein Hindernis — abgehakt, nicht aufgeschoben.

**Amazon ist nicht gesperrt.** `amazon.de/robots.txt` verbietet unter `/gp/video/` nur
`api`, `settings`, `library`, `watchlist` und `mystuff` — also Konto- und
Schnittstellenpfade. Produktseiten sind nicht ausgenommen.

### Geprüfte Quellen

| Quelle | Audio-Sprachen? | Urteil |
|---|---|---|
| [Streaming Availability API](https://www.movieofthenight.com/about/api) (Movie of the Night) | ja, ISO-639-2 je Streaming-Option | **aussichtsreichste Quelle**, siehe unten |
| [uNoGS](https://unogs.com/) | ja, je Titel und Land | Rückfallebene — siehe Bedenken unten |
| JustWatch | ungeprüft für Audio | am 15.08.2026 als Terminquelle gemessen und verworfen (104 künftige Titel für ganz Deutschland, fast kein Anime); für Sprachen nicht erneut geprüft |
| TMDB | nein | führt Anbieter je Land, aber keine Tonspuren |

### Streaming Availability API — die Zahlen

- **Kostenlose Stufe: 1.000 Anfragen im Monat**, ohne Zahlungsdaten
  ([Preisseite](https://www.movieofthenight.com/about/api/pricing)). Bezahlt ab 49 USD/Monat
  für 25.000 Anfragen.
- **Katalog statt Einzelabfrage:** `GET /shows/search/filters` filtert nach `country`,
  `catalogs` (bis zu 32 Dienste, mit Typ: subscription/free/rent/buy/addon), `show_type`,
  `genres`, Jahr und Bewertung. Cursor-Paginierung über `hasMore`/`nextCursor`, 15 bis 20
  Ergebnisse je Anfrage. Der deutsche Anime-Katalog eines Anbieters ist damit eine Sache von
  ein bis zwei Dutzend Anfragen, nicht von 532.
- **Deckt mehr ab als Netflix:** 66 Länder, und in der Filterliste stehen Netflix, Prime
  Video, Disney+ und weitere. Eine Anbindung könnte also Netflix **und** Prime **und**
  Disney+ auf einmal erledigen — das sind zusammen 784 der offenen Verweise.
- **Nutzungsbedingungen** ([TERMS.md](https://github.com/movieofthenight/streaming-availability-api/blob/main/TERMS.md)),
  im Wortlaut geprüft:
  - Speichern erlaubt, auch dauerhaft: „Once The API User's subscription ends, The API User
    can still keep the data retrieved from the API".
  - Anzeige auf der eigenen Seite erlaubt, **mit sichtbarer Quellenangabe**: „The API User
    shall give an attribution to The API Provider", „visible to the users of the
    website/application", verlinkt auf movieofthenight.com/about/api.
  - Verboten ist das Weiterverkaufen und Weiterverteilen der Daten: „shall not
    reshare/resell/redistribute the streaming availability data". Betrifft uns nicht.
  - Kommerzielle Nutzung ausdrücklich gestattet.
  - Die Bildbandbreite ist auf 1 GB im Monat begrenzt — für uns unerheblich, wir brauchen
    Metadaten, keine Bilder.

**Was fehlt:** ein API-Schlüssel. Den kann nur Daniel anlegen — ein Konto zu eröffnen ist
mir verwehrt. Danach gehört er nach `my_secrets.md` und als Repo-Secret ins Projekt.

**Was vor der ersten Anzeige zu prüfen ist:** ob die Audio-Angaben stimmen. Wir haben eine
Kontrollgruppe im Haus — 190 über Crunchyroll belegte Fälle, 98 über ADN belegte, dazu
`data/dub-confirmed.yaml` mit Daniels eigenen Prüfungen. Eine fremde Quelle wird daran
gemessen, bevor ihr geglaubt wird.

### uNoGS als Rückfallebene

[unogs.com](https://unogs.com/) ist aktiv und führt je Titel Land, Audio-Sprachen,
Untertitel und Ablaufdaten; Zugang über RapidAPI, kostenlose Stufe 100 Anfragen am Tag.
Zwei Gründe, warum es die zweite Wahl ist: Es ist **eine Anfrage je Titel** statt eines
Katalogs, und die Betreiber schreiben selbst, dass „Netflix make it harder and harder for us
to pull information" — die Daten sind also von derselben Sperre bedroht, die uns das
Scrapen verbietet. Bleibt als Vergleichsquelle brauchbar.


## Crunchyrolls eigene Content-API — der Weg, der alle Textmuster ersetzt

**Gefunden am 21.08.2026 auf Daniels Vorschlag** („prüf ob du die infos direkt aus crunchy
network traffic lesen kannst, dann brauch man nicht auf seitenelemente warten"). Die
Serienseite ist eine React-Anwendung; sie holt ihre Daten selbst über eine JSON-Schnittstelle,
und die ist ungleich besser als alles, was sich aus dem gerenderten Text ablesen lässt.

### Die drei Aufrufe

    POST /auth/v1/token
         authorization: Basic Y3Jfd2ViOg==      (das ist „cr_web:", anonym)
         content-type:  application/x-www-form-urlencoded
         body:          grant_type=client_id

    GET  /content/v2/cms/series/<serienId>/seasons?locale=de-DE
    GET  /content/v2/cms/seasons/<staffelId>/episodes?locale=de-DE
         authorization: Bearer <access_token>

### Was drinsteht

**Je Staffel** ein Feld `versions` mit jeder Tonspur-Fassung:

    "versions": [
      {"audio_locale":"ja-JP","guid":"GS00374452JAJP","original":true},
      {"audio_locale":"de-DE","guid":"GS00374452DEDE","original":false},
      …
    ]

**Je Episode** dasselbe Feld — und damit die Frage, an der dieses Projekt hängt, folgengenau
beantwortet. Für „Mushoku Tensei" Staffel 3 am 21.08.2026:

    F1  ab 04.07.  ja-JP, en-US, pt-BR, es-419, es-ES, it-IT, de-DE   → deutsch
    F2  ab 04.07.  … de-DE                                             → deutsch
    F3  ab 12.07.  … de-DE                                             → deutsch
    F4  ab 19.07.  ja-JP, en-US, it-IT, es-ES, pt-BR, es-419           → nein
    F5–F8                                                              → nein

**Drei von acht.** Genau der Stand, den Daniel am selben Tag von Hand festgestellt hatte.
Dazu liefert jede Episode ein `premium_available_date` — das Datum, an dem sie verfügbar wurde.

### Warum das alles ändert

| | Serienseite lesen | Content-API |
|---|---|---|
| Zeit je Serie | 5 bis 23 Sekunden | **70 bis 200 Millisekunden** |
| Grundlage | Textmuster im gerenderten HTML | strukturiertes JSON |
| Sprachangabe | „Audio: Deutsch" irgendwo auf der Seite | `audio_locale` je Fassung |
| Folgengenau | nein, nur Staffelzählung über Kacheln | **ja** |
| Übersetzungsabhängig | ja — die Zeile heißt auf jeder Sprachfassung anders | nein |

### Die Grenze: nur aus dem Browser heraus

Ein Direktabruf mit `fetch` bekommt Cloudflares Bot-Sperre („Just a moment…", HTTP 403). Der
Weg führt weiterhin über Playwright — aber nur noch **einmal** zum Aufwärmen: Eine Seite laden,
das Token aus dem Netzwerkverkehr mitnehmen, danach alle Serien über `page.evaluate(fetch)` im
Browser-Kontext abfragen. Gemessen: 1.310 ms Aufwärmen, danach 70 bis 208 ms je Serie.

### Rechtslage

`crunchyroll.com/robots.txt` sperrt `/showtag`, Suche, Konto, Merkliste, Verlauf, Bezahlseiten
und einige Verwaltungspfade. **`/content/` und `/auth/` stehen nicht darauf** — ebenso wenig
wie `/series/`, das dieses Projekt seit dem 12.08.2026 liest.

## NACHTRAG — das Verfügbarkeitsdatum steht woanders (21.08.2026)

**Daniel hat einen Fehler in meiner ersten Messung gefunden:** Ich hatte
„F1 ab 04.07., F3 ab 12.07." notiert. Das sind die Daten der **japanischen**
Fassung. Die deutschen Folgen 1 bis 3 erschienen alle am **19.08.2026**.

Der Grund: `/content/v2/cms/seasons/<id>/episodes` liefert die Episoden der
**Originalstaffel**, auch wenn man die Kennung der deutschen Fassung einsetzt.
Das Feld `versions` je Episode sagt zwar, **dass** es eine deutsche Fassung gibt,
aber die Datumsfelder gehören zur japanischen.

**Die deutsche Fassung ist ein eigenes Objekt** und wird über ihre eigene
Kennung abgefragt:

    GET /content/v2/cms/objects/<guid der de-DE-Fassung>?locale=de-DE

Für „Mushoku Tensei" Staffel 3, Folge 1 (`GE00374453DEDE`):

    audio_locale:            de-DE
    premium_available_date:  2026-08-19T11:00:00Z   ← der deutsche Termin
    episode_air_date:        2026-07-04T00:00:00Z   ← japanische Ausstrahlung
    availability_starts:     9998-11-30             ← Platzhalter, unbrauchbar

**Damit ist es mehr als eine Sprachauskunft.** `premium_available_date` der
deutschen Fassung ist ein **belegter Termin je Folge, mit Uhrzeit** — genau das,
was dieses Projekt bisher aus Kalenderkacheln zusammensuchen musste. Die
11:00 UTC sind 13:00 Ortszeit.

**Der Weg je Folge ist damit dreistufig:**

    1. seasons  → Staffeln und deren `versions`
    2. episodes → Folgen der Originalstaffel, je Folge `versions`
    3. objects  → die de-DE-Kennung aus `versions`, dort steht der deutsche Termin

Ob Schritt 3 sich für mehrere Kennungen auf einmal abfragen lässt
(`objects/<guid1>,<guid2>,…`), ist **ungeprüft** — bei Crunchyroll ist diese Form
sonst üblich und würde die Zahl der Aufrufe stark senken.

### Drei weitere Befunde vom 21.08.2026

**Der Sammelabruf trägt.** `objects/<guid1>,<guid2>,<guid3>?locale=de-DE` liefert alle
angefragten Objekte auf einmal. Damit ist die Skalierungsfrage beantwortet: Statt eines
Aufrufs je Folge — bei 959 Serien über zehntausend — genügen wenige Bündel.

**Die Quelle kündigt nichts an.** Folge 4 und 5 von „Mushoku Tensei" Staffel 3 führen in
`versions` schlicht kein `de-DE`: keine Kennung, kein künftiges Datum, kein Hinweis. Die
Schnittstelle sagt „ist da" oder „ist nicht da" — sie sagt nie „kommt am". Für die Vorschau
bleibt es beim Kalenderabruf und bei der Fortschreibung.

**`is_dubbed` ist eine Falle und darf nicht benutzt werden.** Das Feld steht auf `true`, sobald
es **irgendeine** Synchronfassung gibt — bei Folge 4 und 5 also auch, obwohl dort nur Englisch,
Italienisch, Spanisch und Portugiesisch vorliegen. Wer danach ginge, hielte jede Folge für
deutsch synchronisiert. Maßgeblich ist ausschließlich `de-DE` in `versions`.

**Die Uhrzeiten sind echt und einzeln.** Die drei deutschen Folgen erschienen am 19.08.2026 um
11:00, 11:30 und 15:00 UTC — also nicht als ein Block zur selben Minute. Das Projekt führt
`schedule.time` bisher nur, wo es belegt ist; hier wäre es belegt.

### Was daran hängt

969 der 1.914 offenen Verweise in der Prüfliste sind Crunchyroll. Sie sind damit nicht mehr
Handarbeit, sondern ein Abruf von wenigen Minuten — und die Antwort ist genauer als alles, was
ein Mensch auf der Seite ablesen könnte, weil sie je Folge kommt.

### Umgesetzt am 21.08.2026 — und was die Messung ergeben hat

`scrape-crunchyroll-dub.ts` liest den Regelweg jetzt über die API; die Seitenanzeige bleibt
als Rückfallebene hinter `--seitenanzeige`. Gelesen wurden **alle 911 Crunchyroll-Adressen**
aus `titles.json`, 693 verschiedene Serien, 17.686 Folgen.

**Die Serienkennung** steht nur in 280 der 911 Adressen (31 %); 592 tragen die alte
Slug-Form, 39 zeigen auf eine einzelne Folge. Die Slug-Form löst sich über die Weiterleitung
auf (rund 900 ms je Adresse), der Folgenverweis über `objects` → `series_id`. Beides steht
in `data/crunchyroll-series-ids.json` und kostet damit **einmal** einen Seitenaufruf.

**Der Vergleich mit der Seitenanzeige** (Stand `main` vom selben Tag, 17:42):

| alt → neu | Adressen |
|---|---|
| keine Auskunft → beantwortet | **488** |
| beide „deutsch" / beide „kein Deutsch" | 314 |
| beide ohne Auskunft | 65 |
| **Widerspruch** | 44 |

Von den 44 Widersprüchen sagt der alte Weg 33-mal „deutsch", wo die API keine deutsche
Fassung findet. **Die API hat recht**, und zwar gemessen: Für „High School DxD",
„Steins;Gate 0", „Vampire Knight", „Space Dandy", „Plastic Memories", „Zom 100",
„NieR:Automata" und „The Promised Neverland" nennt die Serienseite selbst als Tonspuren
„Japanese, English" — kein Deutsch. Und dieselbe **alte** Programmzeile, heute noch einmal
auf „High School DxD" losgelassen, meldet ebenfalls kein Deutsch. Der alte Weg gibt also auf
dieselbe Adresse binnen weniger Stunden zwei verschiedene Antworten; er ist nicht
reproduzierbar. Die übrigen elf Widersprüche sind Serien, die Crunchyroll inzwischen aus dem
Angebot genommen hat („Leider sind die Videos dieser Serie nicht mehr verfügbar").

**Kontrollgruppe** `data/dub-confirmed.yaml`, 24 von Hand geprüfte Crunchyroll-Fälle: neuer
Weg 24 richtig, 0 falsch, 0 stumm; alter Weg 19 richtig, 0 falsch, 5 stumm.

**Die Termine sind da:** 4.826 deutsche Folgen tragen ein `premium_available_date` ihrer
eigenen de-DE-Fassung — ein belegter deutscher Termin mit Uhrzeit, je Folge. Ausgewertet
wird davon noch nichts; er liegt in `data/crunchyroll-dub.json` und in den Rohantworten
unter `data/crunchyroll-raw/` (693 Dateien, 11 MB gzip).

**„3 von 8" gibt es jetzt wirklich:** 20 Staffeln sind nur teilweise deutsch. Diese Angabe
war über die Serienseite gar nicht zu haben. Für den Datensatz heißt der Umstieg: 138 Titel
bekommen ein Urteil, das sie vorher nicht hatten, 50 verlieren eines (weil die Zuordnung
nicht sauber aufgeht), keiner dreht sich um.

**Widerspricht die Staffelebene der Folgenebene?** Nein — anders als bei der Streaming
Availability API. Über alle 693 Serien gibt es **keine einzige** Staffel, die `de-DE` in
ihren `versions` führt und keine einzige deutsche Folge hat.

### Zwei Grenzen, beide teuer bezahlt

**Crunchyroll sperrt nach rund 300 Serien.** Mit 250 ms Pause zwischen den Aufrufen kam nach
25 Minuten HTTP 403, danach lieferte auch die Aufwärmseite kein Token mehr; nach einer
Viertelstunde ging es wieder. Mit 400 ms Pause liefen 409 Adressen am Stück durch. Die Pause
ist deshalb jetzt 400 ms, und die Sperre beendet den Lauf, statt ihn ins Leere weiterlaufen
zu lassen.

**Ein misslungener `page.goto` wechselt die Seite nicht.** Während der Sperre scheiterte
jeder Seitenaufruf — und `page.url()` lieferte weiter die Adresse der Aufwärmseite, also
„Jujutsu Kaisen". **91 fremde Adressen bekamen dessen Staffelliste zugeschrieben**,
„sing-a-bit-of-harmony" mitsamt „JUJUTSU KAISEN: 24/24". Die Einträge sind entfernt, vor
jedem Aufruf wird auf `about:blank` geräumt, und die Aufwärmseite gilt nie als Ergebnis
(`kennungAusZiel`, zugesichert in `check-logic.ts`).

## Rechtliche Einordnung der Crunchyroll-Content-API (geprüft 22.08.2026)

**Nutzungsbedingungen** — Fassung vom 22.08.2026 unter <https://www.crunchyroll.com/tos/>
(Gatsby-Seite, Text nur nach dem Rendern sichtbar; deutsche Fassung `?lang=de`, wortgleich
aufgebaut). **Kein Änderungsdatum im Dokument.** Drei Klauseln treffen uns, alle in
**Abschnitt 5 „Access and Use of Services"**:

> **Automated Access:** Employ any robot, spider, scraper, deep-link, mod, hack, exploit,
> cheat utility, trainer, or other automated data gathering or extraction tool, program, or
> algorithm to access, acquire, modify, copy, monitor, or otherwise interfere with any portion
> of the Services or Content.

> **Integration and Indexing:** Incorporate the Content into, or stream or retransmit the
> Content via, any hardware or software application, or make it available via frames or in-line
> links. Furthermore, you are strictly prohibited from creating, recreating, distributing, or
> advertising an index of any significant portion of the Content without express written
> authorization from Crunchyroll.

> **Commercial Exploitation:** Build or operate a business utilizing the Services, whether or
> not for profit.

Dazu **Abschnitt 4**: Lizenz „solely for your personal, non-commercial purposes". Und der
Einstieg: „By creating an Account, clicking ‚I agree', **or otherwise accessing or using any
Service**, you are binding yourself to these Terms" — die Bedingungen greifen also auch ohne
Konto. **Der Wortlaut deckt unser Vorgehen ab; ein Vertragsverstoß liegt vor.** Abschnitt 17
nennt als Rechtsfolge ausschließlich, dass Crunchyroll Konten sperren darf („restrict, suspend,
or terminate any Account for any reason at any time") — keine Vertragsstrafe.

**robots.txt** (abgerufen 22.08.2026):
- `www.crunchyroll.com/robots.txt` — 39 Zeilen, ein `User-agent: *`-Block. Gesperrt sind
  `/showtag`, Suche, `/user`, `*/account`, `*/watchlist`, `*/history`, `*/crunchylists`,
  `*/payments/`, `/vilos/` und Verwaltungspfade. **`/content/`, `/auth/`, `/index/` und `/cms/`
  stehen nicht darauf.**
- `beta-api.crunchyroll.com/robots.txt` — **HTTP 502** (Cloudflare, keine Datei). Nach
  RFC 9309 §2.3.1.4 ist eine per 5xx unerreichbare robots.txt „undefined" und ein Crawler
  „MUST assume complete disallow" — formal also ein Nein für die API-Domain, allerdings aus
  einem Serverfehler heraus, nicht aus einer Absicht.

**Belegte Folgen — nur Video, nie Metadaten.** Im Register `github/dmca` liegen 35
Crunchyroll-Meldungen (2018 bis 2026-06). Ziel war **ausnahmslos** Wiedergabe, Download oder
DRM-Umgehung: `Crunchy-DL/Crunchy-Downloader` (16.06.2026, ausdrücklich 17 U.S.C. §1201),
`hayase-app`, `Dantotsu`, `aniyomi-extensions`, `powanime`, diverse Sora-Module. **Kein
einziger Fall betrifft ein Projekt, das nur Metadaten liest.** `crunchy-labs/crunchy-cli`
(634 Sterne) steht auf keiner Liste; es ist archiviert, weil Crunchyroll am 14.03.2024 die
DRM-freien Streams abschaltete (Issue #362), nicht wegen einer Abmahnung.
`crunchy-labs/crunchyroll-rs` wird weiterentwickelt (letzter Push 15.08.2026).
`hyugogirubato/KeyDive` ist online — aber ein Widevine-Werkzeug und damit eine andere
Rechtskategorie (§1201), die uns nicht berührt. Konto-Sperren wegen API-Nutzung: **keine
belegte Meldung gefunden** (Suche über Issues beider crunchy-labs-Repos und Websuche).

**Crunchyrolls eigene Auskunft zu IP-Sperren**
([Hilfeartikel 18933076022676](https://help.crunchyroll.com/hc/en-us/articles/18933076022676-Why-was-my-IP-banned),
abgerufen 22.08.2026) nennt als Ursachen VPN, Browser-Erweiterungen und geteilte Netze, als
Abhilfe einen Router-Neustart für eine neue IP. **Automatisierung wird dort nicht erwähnt, eine
Sperrdauer nicht genannt.** Ein dokumentiertes Rate Limit für die Content-API existiert nicht —
weder offiziell noch in den inoffiziellen Doku-Repos.

**Gemessen am 22.08.2026** (ein einzelner Abruf von Daniels Anschluss):
- `POST /auth/v1/token` mit `Basic Y3Jfd2ViOg==` und `grant_type=client_id` → HTTP 200,
  `expires_in: 3600`, JWT-Nutzteil `"anonymous_id": ""`, `"client_id": "cr_web"`.
- **`"country": "DE"`** und CMS-Bucket **`/DE/M2/-`** — von hier aus kommt also die deutsche
  Region ohne Konto. Der US-Befund vom 21.08. lag an den US-GitHub-Runnern, nicht am Verfahren.
- Der CloudFront-Zugang aus `/index/v2` läuft **24 Stunden** (`expires`
  `2026-08-23T08:25:55Z`). Die 403 vom 21.08.2026 nach ~25 Minuten war deshalb **keine
  abgelaufene Signatur, sondern eine Drosselung an der Kante** — sie traf auch den
  Token-Endpunkt und löste sich nach einer Viertelstunde von selbst.
- Ein Direktabruf per `curl` gegen `beta-api.crunchyroll.com` funktioniert; nur
  `www.crunchyroll.com` hängt hinter Cloudflares Bot-Sperre.

## Entscheidungen

- **Die Regel „mindestens eine Folge auf Deutsch erschienen" wird nicht umgesetzt** (17.08.2026).
  Daniel hatte sie am 15.08. vorgegeben: Titel ohne eine einzige erschienene deutsche Folge
  gehören hinter den Toggle „Anime ohne deutsche Synchro". Gemessen, bevor gebaut wurde — und die
  Messung widerlegt die Umsetzbarkeit.

  Als Beleg für „eine deutsche Fassung existiert" stehen drei Dinge zur Verfügung: ein Release mit
  Datum, deutsche Sprechrollen (AniList oder ANN) oder ein bestätigter Stream. Fehlen alle drei und
  behauptet nur eine einzige Quelle die Synchro (`dubConfidence: 'low'`), trifft die Regel
  **361 von 2.760 Titeln**.

  Darunter sind **Frieren: Beyond Journey's End Staffel 2** und **Fire Force Staffel 3 Teil 2** —
  beide laut Daniel (15.08.2026) vollständig deutsch synchronisiert, keine Folge ohne Synchro. Sie
  tragen keine Sprechrollen, weil AniList und ANN ihre Besetzungslisten für laufende Serien erst
  mit Verzögerung führen, und keinen Termin, weil wir keinen belegt haben.

  Die Regel würde also genau das tun, wovor Daniel gewarnt hat, und sie verletzt den
  Projektgrundsatz aus `CLAUDE.md`: „Ein Eintrag wird nur gestrichen, wenn eine Quelle ihn
  **aktiv widerlegt** — nicht, weil er unbestätigt ist." Fehlender Beleg ist kein Gegenbeleg.

  **Schwelle für eine Neubewertung:** Sobald es eine verlässliche Auskunft über die deutsche
  Tonspur laufender Serien gibt — ein angemeldeter Crunchyroll-Abruf oder eine andere Quelle, die
  je Titel Ja oder Nein sagt. Dann ist „keine Folge auf Deutsch" ein Befund statt einer Lücke, und
  die Regel trägt. Der grobe Vorfilter bleibt bis dahin in Kraft: Titel, deren japanische
  Ausstrahlung noch nicht begonnen hat, stehen schon hinter dem Toggle.


- **Keine Fallback-Kette über Wikipedia für Beschreibungen** (11.08.2026). Am 11.08. gemessen
  statt geschätzt: Es fehlen nur noch **70** von 2.753 Beschreibungen (nicht 516 — die Zahl
  stammte von vor dem vollständigen aniSearch-Bestand), und von diesen 70 haben **2** einen
  deutschen Wikipedia-Artikel. Eine ganze Quellenkette für zwei Texte lohnt nicht. Wikidata
  bleibt als ID-Brücke interessant, für Inhaltsangaben ist es zu knapp.
- **Die Seite bleibt einsprachig deutsch** (11.08.2026). Die Idee „weitere Sprachen" ist
  gestrichen, nicht zurückgestellt: anime-kalender.de sagt, wann ein Anime **auf Deutsch**
  erscheint. Eine englische Fassung derselben Seite hätte keinen Inhalt, den es nicht
  anderswo besser gäbe.

- **Keine Affiliate-Links** (08.08.2026). Das Projekt bleibt unkommerziell. Damit bleibt auch die
  TMDB-Nutzung im privaten Rahmen, und die Amazon-Links sind schlichte Kauflinks ohne Partner-Tag.
- **Keine Pull Requests für Termine** (08.08.2026). Die Datenpflege bleibt in einer Hand — die
  Quellenpflicht ist die Grundregel des Projekts, und sie ist nur haltbar, solange jeder Termin
  durch dieselbe Prüfung geht.
- **Gesamtabnahme der ersten Version erteilt** (08.08.2026). Die letzte offene Ausnahme, die
  Newsletter-Abmeldung, ist am 10.08.2026 geprüft — damit ist die erste Version vollständig
  abgenommen.

## Archiv

### Rechtsfrage Amazon zu Ende geprüft (24.08.2026) — die Entscheidung bleibt

Daniels Einwand vom 23.08.2026: „es sind simple informationen die öffentlich zugänglich sein
müssen, sonst könnten käufer sich nie dafür entscheiden." Der Ansatz ist die
**Informationspflicht als Gegengewicht** zum Data-Mining-Verbot in Amazons Nutzungsbedingungen.
Vier Teilfragen, alle nachgesehen. **Das ist eine Recherche, keine Rechtsberatung** — ich bin
kein Anwalt, und bei einer streitigen Auseinandersetzung entscheidet niemand danach.

#### ① Die Informationspflicht besteht — sie gilt aber gegenüber dem Käufer, nicht gegenüber uns

[Art. 246a § 1 Abs. 1 EGBGB](https://dejure.org/gesetze/EGBGB/246a.html) verlangt vom
Unternehmer Angaben zu

- **Nr. 1** „die wesentlichen Eigenschaften der Waren oder Dienstleistungen"
- **Nr. 17** „die Funktionalität … einschließlich anwendbarer technischer Schutzmaßnahmen"
- **Nr. 18** „die Kompatibilität und die Interoperabilität …, soweit diese Informationen dem
  Unternehmer bekannt sind oder bekannt sein müssen"

Die Sprachfassung eines Films fällt für einen deutschen Käufer unter **Nr. 1**, nicht unter
17/18 — dort geht es um DRM und technische Ausspielbarkeit. Daniels Grundannahme stimmt also:
Amazon **muss** es hinschreiben.

**Nur folgt daraus nichts für uns.** Es ist eine **vorvertragliche Informationspflicht des
Unternehmers gegenüber dem Verbraucher**. Sie sagt, dass die Angabe dastehen muss — nicht, dass
ein Dritter sie automatisiert einsammeln darf. Aus einer Pflicht zu veröffentlichen folgt kein
Recht zu ernten.

#### ② Der BGH-Fall, der helfen würde, passt nicht auf Amazon

[BGH, 22.06.2011, I ZR 159/10 (Automobil-Onlinebörse)](https://ihde.de/bundesgerichtshof-zum-screen-scraping-auslesen-von-datenbanken-durch-bots-bgh-urteil-vom-22-06-2011-az-i-zr-159-10-automobil-onlineboerse/)
ist der Leitfall, und er fiel gegen den Portalbetreiber aus — an drei Punkten:

| Der BGH sagte | Trifft auf Amazon zu? |
|---|---|
| AGB-Verbot unwirksam, weil Abfragen **ohne AGB-Annahme** möglich waren und es „keine besonderen Vorkehrungen" gab | **Nein** — Amazon erkennt und sperrt Bots aktiv |
| Kein Datenbankrechtsverstoß, weil nur **Einzelabfragen zum konkreten Suchauftrag** eines Nutzers | **Nein** — ein Durchlauf über 385 Titel ist kein Suchauftrag |
| Kein UWG-Verstoß, wer „ungeschützt öffentlich zugänglich" macht, muss mit automatischen Aufrufen rechnen | **Nein** — siehe ④ |

Das Urteil trägt also gerade **nicht**. Es beschreibt den Gegenfall.

#### ③ Das Datenbankrecht ist wirklich schwach — hilft aber nicht

Daniels Vermutung war richtig: Nach
[EuGH C-203/02 (British Horseracing Board)](https://lexetius.com/2004,2512) zählt für den
Schutz nur die Investition ins **Beschaffen** vorhandener Daten, nicht ins **Erzeugen**.
Amazons Sprachangaben entstehen im eigenen Haus, sind also eher Erzeugung — der sui-generis-
Schutz greift schwach.

**Das ändert nichts**, weil das Datenbankrecht gar nicht der Engpass ist. Bleibt das
Vertragsverhältnis, und das besteht unabhängig davon.

Ebenso wenig hilft die TDM-Schranke aus [§ 44b UrhG](https://www.gesetze-im-internet.de/urhg/__44b.html):
Sie erlaubt automatisierte Analyse **urheberrechtlich geschützter Werke** mit maschinenlesbarem
Nutzungsvorbehalt als Grenze. „Deutsch" als Tonspur-Angabe ist eine Tatsache ohne
Schöpfungshöhe — für sie braucht es keine Schranke, und sie gibt auch keine.

#### ④ Der praktisch entscheidende Fund steht in der robots.txt

Gemessen am 24.08.2026 an `https://www.amazon.de/robots.txt`, 416 Zeilen:

- **`/gp/video/detail/` ist für `User-agent: *` nicht gesperrt.** Die Titelseite selbst dürfte
  ein Bot also abrufen.
- **`/gp/video/api` ist gesperrt** — und genau darüber läuft `getDetailWidgets`, der Aufruf, der
  die **vollständige** Folgenliste nachlädt. Ohne ihn sieht man 24 von 51 Folgen.
- **Über 90 Bots sind namentlich mit `Disallow: /` ausgesperrt**, darunter `GPTBot`, `ClaudeBot`,
  `Scrapy`, `Crawl4AI`, `Diffbot`, `Bytespider` und ein `Datenbank Crawler`.

Damit ist die Frage entschieden, und zwar ohne Auslegung: Der Weg, den ein automatischer Lauf
gehen müsste, ist **maschinenlesbar untersagt**. Und die namentliche Sperrliste ist genau die
„besondere Vorkehrung", deren Fehlen den BGH-Fall damals kippen ließ.

#### ⑤ Der Vergleich mit JustWatch und werstreamt.es taugt nicht als Vorbild

- **JustWatch scrapt nicht** (belegt am 23.08.2026): bezieht über Partner-Integrationen und
  liefert seine Daten über die TMDB-API weiter — die wir bereits lizenziert nutzen.
- **werstreamt.es** gehört seit 2017 zur FUNKE Mediengruppe (Gong Verlag). Zur Datenherkunft
  ist öffentlich nichts belegt; eine FAQ-Seite ist von hier nicht abrufbar.

Wer eine Lizenz oder eine Partnerschaft hat, ist kein Beleg dafür, dass es ohne geht.

#### Ergebnis

**Die Entscheidung bleibt, wie sie ist.** Die Erweiterung liest mit, während Daniel die Seite
ohnehin offen hat; ein Bot ruft Amazon nicht ab. Das ist kein Kompromiss aus Vorsicht, sondern
das, was nach ④ übrig bleibt.

**Was sich ändert:** Die Frage ist beantwortet und muss nicht wiederkehren. Und die Messung gibt
eine Linie für künftige Anbieter — **erst die robots.txt lesen, dann die AGB**: Ein
maschinenlesbares Verbot des konkreten Pfads entscheidet die Sache schneller und eindeutiger als
jede Auslegung einer Vertragsklausel.

**Neu bewerten**, wenn eines davon eintritt: Amazon veröffentlicht eine Metadaten-Schnittstelle
(die PA-API wurde am 15.05.2026 eingestellt, Nachfolger ist die Creators API — ungeprüft, ob sie
Prime-Video-Metadaten führt), oder eine lizenzierte Quelle nennt Tonspuren je Folge.

### Nachtrag zum Panel-Umbau: Das Bühnenbild überdeckte den Antwortkasten

Gemeldet von Daniel mit Bildschirmabzug, 24.08.2026: Der Kasten „1 von 170 Folgen erschienen"
stand angeschnitten da — obere Kante weg, der Rest sichtbar. Dazu die Frage, ob ich es
überhaupt bemerkt hätte. Hatte ich nicht.

**Ursache, gemessen an der laufenden Seite:** Das Bild ist 340 px hoch, sein Container nur so
hoch wie Titel und Unterzeile. Die letzten 56 px ragen darüber hinaus, und das ist Absicht —
die ersten Inhalte sollen darauf stehen. Nur gewinnt beim Malen sonst das Bild: Der Container
ist positioniert und erzeugt über `isolation: isolate` einen eigenen Stapel; ein nachfolgendes
Geschwister **ohne** `position` wird davon überdeckt, ganz gleich, welchen z-index das Bild
innerhalb des Stapels trägt. Beide Inhaltsbereiche standen `static`.

Gegenprobe an der ausgelieferten Seite, an den drei Zeilen des Kastens im Bildbereich:

```
ohne relative: 275:BILD   300:BILD   326:BILD
mit relative:  275:KASTEN 300:KASTEN 326:KASTEN
```

**Die eigentliche Lehre ist nicht das CSS.** Sechs Commits, jeder mit grüner Kette — Typecheck,
Linter, Build. Keiner von ihnen sieht ein Bild. Daniel: „in zukunft bitte selbst sowas
mitbekommen und automatisch fixen." Festgehalten im Skill `pruefen-und-belegen` unter „Grün ist
nicht richtig — was sichtbar ist, wird angesehen".

**Eine Messfalle steckte darin**, die künftig Zeit spart: `elementFromPoint` misst
Trefferbarkeit, nicht Sichtbarkeit. Die Bildschichten tragen `pointer-events: none`, also
meldete die Probe „Kasten liegt oben", während er in Wahrheit verdeckt war — die erste
Gegenprobe zeigte deshalb keinen Unterschied, und ich hielt meine richtige Diagnose kurz für
widerlegt. Für die Messung müssen die Schichten kurz auf `pointer-events: auto`.

### Gemessen 24.08.2026: Die Änderungsquelle bringt für uns derzeit null

Die Aufgabe hieß „die gesammelten Änderungen mit unserem Datensatz verknüpfen". Nachgerechnet
an den 152 Meldungen, die seit dem 23.08.2026 in `data/motn-changes.json` liegen:

| | |
|---|---|
| Meldungen gesamt | 152 |
| einem unserer Titel zuzuordnen | **11** |
| davon mit deutscher Tonspur | **5** |
| davon **nicht** schon im MOTN-Bestand | **0** |

Die fünf sind 86 EIGHTY-SIX, Fate/Zero, Fate/stay night [UBW], Fate/Grand Order Babylonia und
Naruto Shippūden — alle längst über den Katalogweg erfasst.

**Es gibt also nichts zu verknüpfen**, und ein Verknüpfungslauf hätte keine Arbeit. Abgeschaltet
wird die Quelle trotzdem nicht: Sie kostet eine Anfrage am Tag gegen ein Monatskontingent von
1.000, und ihr Zweck ist genau der seltene Fall — ein Anime, der neu erscheint und in keinem
Katalogdurchlauf steht.

Statt eines Laufs steht die Zahl seit dem 24.08.2026 in jeder Ausgabe von
`fetch-motn-changes.ts`, und wenn sie über null steigt, meldet er es als Warnung. Die Frage
wird damit nicht mehr von Hand beantwortet.

**Eine Falle steckt in der Zuordnung:** Beide Seiten schreiben die TMDB-Kennung verschieden.
`data/tmdb-titles.json` führt `tmdbId: 30991` mit `kind: 'tv'`, die Änderungsquelle
`tmdbId: 'tv/331650'`. Der erste Messversuch verglich sie direkt und ergab sauber null Treffer
— was wie „die Quelle taugt nichts" aussieht und nur ein Formatfehler war.

### Vier Messdateien gingen in jedem CI-Lauf verloren (24.08.2026)

Gefunden beim Nachgehen einer YouTube-Preisangabe, und der größere der beiden Funde.

`tools/commit-data.sh` legt vor dem `git reset --hard` die Dateien beiseite, die ein Lauf
unter `data/` geschrieben hat. Vier standen nicht in der Liste:

| Datei | Taktung |
|---|---|
| `data/youtube-befunde.json` | wöchentlich |
| `data/rtlplus-befunde.json` | wöchentlich |
| `data/motn-changes.json` | **täglich**, gegen ein Monatskontingent von 1.000 |
| `data/curated/disc-anisearch.yaml` | wöchentlich |

Sichtbar war es nur am Commit-Datum: alle vier zuletzt am 23.08.2026 durch einen lokalen
Lauf beschrieben, seither nichts — obwohl zwei davon täglich bzw. wöchentlich neu geholt
werden.

**Die Prüfung, die das melden soll, hatte zwei blinde Flecken.** Sie las nur `.ts`-Dateien
(die `.mjs`-Läufe also gar nicht) und suchte nur nach `writeJson('data/…')`, fand also kein
Ziel, das in einer Konstanten steht. Jetzt zählt jedes `data/…`-Literal in einer Datei, die
überhaupt schreibt — auch reine Lesepfade. Das ist die richtige Seite zum Irren: Eine Datei
zu viel in der Liste wird beiseitegelegt und unverändert zurückgelegt; eine zu wenig kostet
die Arbeit jedes Laufs, und zwar still. Gegentest gemacht: Zeile entfernt → rot, Zeile
zurück → grün.

### Neun YouTube-Kauffilme standen als „kostenlos" (24.08.2026)

Neun Verweise antworten bei oEmbed mit HTTP 401. Der Lauf legte das pauschal als
„kostenpflichtig" ab, und `zugangsart()` las das Feld nie — „Your Name", „FF7 Advent
Children" und „Fireworks" standen als Gratisangebot im Kalender.

**Auch die Ablage war falsch.** An den Videoseiten nachgemessen: sechs der neun tragen eine
`offerId`, also ein echtes Kaufangebot, drei nicht. Der 401 hat mehrere Ursachen. Belegt wird
der Kauf seither über `offerId`, sein Fehlen bleibt Schweigen.

**Der Nebenfund wiegt für dieses Projekt schwerer:** Zwei der drei heißen „Tokyo Ghoul,
2. Staffel, 1. Episode, OmU" und „Anime, My Hero Academia, Episode 01, OmU" — Untertitel
statt Synchro, vom Uploader selbst benannt, und das ist genau die Trennlinie, an der dieser
Kalender hängt. `pipeline/lib/titel-muster.mjs` erkennt sie jetzt, ebenso eine fremde
Synchronfassung („English Dub" bei drei Attack-on-Titan-Filmen). Sieben Verweise stehen
dadurch ganz oben in `daniel-zum-abarbeiten/09-youtube-liste.md`; ein `dub: false` setzt
weiterhin ein Mensch.

### Detail-Panel neu gebaut — sechs Schritte, 24.08.2026

Daniel am 24.08.2026: „eventuell sollten wir über ein re-design des detail panels nachdenken".
Aus fünfzehn Mockup-Fassungen wurde eine, aus der eine Reihenfolge. Gebaut in sechs Commits,
jeder für sich prüfbar:

| Schritt | Was |
|---|---|
| 1 | Bühne aus dem Cover statt aus dem Banner, Titel als zusammenhängende Pille |
| 2 | „Wo läuft es" **vor** die Termine — das grüne „DE ✓" ist die wertvollste Angabe der Seite |
| 3 | Antwortkasten mit fester Höhe: vier Fälle, ein Platz, keine springenden Elemente |
| 4 | Werkangaben ans Ende, Genres auf drei begrenzt |
| 5 | Reihen-Umschalter unter die Anbieter, mit Zahl in der Überschrift |
| 6 | Knopf-Beschriftungen nennen die Wirkung statt des Ziels |

**Zwei Beobachtungen von Daniel sind darin aufgegangen:**

- „unter dem grünen balken steht x von y erschienen … das führt dazu, dass die elemente nach
  klick zwischen titel hoch/runter schieben" → der Antwortkasten hat eine feste Mindesthöhe,
  alle vier Fälle belegen denselben Platz.
- „wenn ich the ghost in the shell detail panel öffne wird im karussell nicht an die stelle
  horizontal gescrollt zu dem gerade ausgewählten titel" (16:05) → der aktive Teil macht sich
  beim Öffnen selbst sichtbar. Bewusst zurückgestellt gewesen, weil der Umbau den Umschalter
  ohnehin an einen neuen Platz brachte; jetzt in Schritt 5 mitgenommen. Senkrecht wird dabei
  auf „nearest" gescrollt statt auf „center", damit die Seite nicht springt — bewegen soll
  sich nur das Band.

**Was der Umbau nicht angefasst hat:** Die Gruppierung der Kaufwege nach Shop steht seit dem
20.08.2026 und trägt die Synchro-Angabe je Anbieter bereits; sie ist in Schritt 2 unverändert
mitgewandert.

### DMARC steht auf `p=quarantine` (24.08.2026, 12:05)

Der Termin vom 24.08. ist eingelöst — zwei Stunden später als geplant, weil die Grundlage
erst nachgereicht werden musste. Daniel hat 15 Google-Aggregatberichte in den Übergabeordner
gelegt, Zeitraum 07.–22.08.2026:

| | |
|---|---|
| Mails insgesamt | 30 |
| `dkim`-Fehler | **0** |
| `spf`-Fehler | **0** |
| Absender-IPs | 17, **alle** Amazon SES (`54.240.3.x`, `54.240.6.x`) |

Der 19.08. fehlt in der Kette, und das ist kein Loch: Google schickt einen Bericht nur, wenn
an dem Tag Mail geflossen ist. Der Newsletter verschickt nur bei neuen Terminen.

**`rua=` bleibt entgegen der Absicht vom 12.08. stehen.** Daniel hat das am 24.08. so
entschieden, nachdem der Zusammenhang klar war: Die Berichte sind das einzige Fenster darauf,
ob die schärfere Politik überhaupt ankommt — und ob sie eines Tages eigene Post aussortiert.
Wer sie abschaltet, macht die Umstellung unprüfbar und müsste für ein späteres `p=reject`
bei null neu sammeln. Die täglichen Berichtsmails sind der Preis dafür.

**Beim Umstellen ist ein Fehler im eigenen Werkzeug aufgefallen, und zwar rechtzeitig.**
Der Trockenlauf meldete `+ TXT _dmarc` — *anlegen*, nicht *aktualisieren*. Die Ursache stand
in `tools/inwx-dns.mjs`: Die Liste der Typen, bei denen ein Eintrag ersetzt statt danebengelegt
wird, enthielt nur `CNAME`. Für TXT ist „mehrere erlaubt" im Allgemeinen richtig — die Wurzel
trägt SPF und die Google-Verifizierung nebeneinander —, aber nicht für zwei Einträge
**derselben Sorte**: Zwei DMARC-Records auf `_dmarc` sind nach RFC 7489 §6.6.3 dasselbe wie
keiner, der Empfänger verwirft beide. Die Umstellung hätte den Schutz also **abgeschaltet**
statt ihn zu verschärfen, und im DNS hätte danach eine Politik gestanden, die niemand anwendet.

Behoben durch Unterscheidung nach dem `v=`-Präfix (`DMARC1`, `spf1`, `DKIM1`): Ein Eintrag
ersetzt den vorhandenen derselben Sorte und lässt alle anderen in Ruhe. Nach dem Fix meldete
der Trockenlauf `~ … 1 aktualisiert, 0 angelegt`, und die Wurzel-TXT mit der
Google-Verifizierung blieb unangetastet. Aufgefallen war es nie, weil sich bis dahin kein
TXT-Inhalt geändert hatte.

**Geprüft nach dem Schreiben** (24.08.2026, 12:05):

| Auflöser | Antwort |
|---|---|
| INWX (autoritativ) | `v=DMARC1; p=quarantine; rua=…` ✓ |
| Cloudflare `1.1.1.1` | `p=quarantine` ✓ |
| Google `8.8.8.8` | noch `p=none` — alter Cache, TTL 3600 |

Genau **ein** Eintrag auf `_dmarc`. Der Wirkungsnachweis steht noch aus und wartet unter
„Warten auf Feedback" auf den Bericht vom 26.08.

### 23.08.2026 — der Crunchyroll-Negativbefund war laengst belastbar

Die Aufgabe stand seit dem 21.08. offen: 366 Serien galten als „keine deutsche Fassung", und
uebernommen wurde davon nichts. Der Grund war gut — ein fehlendes Deutsch in der **Gast-Ansicht**
bewies nichts, 975 Falschangaben hatten das gezeigt.

Mit dem deutschen Zugang vom 22.08. ist die Frage eine andere, und der Code entscheidet bereits
so: `beurteile()` macht aus `deutschImAngebot: false` genau dann ein Nein, wenn `katalog === "de"`
ist. Aus dem US-Katalog nie.

**Die Kontrollgruppe bestaetigt es:** 26 von 26 Handbelegen stimmen mit dem DE-Katalog ueberein,
kein einziger Widerspruch. Und die Zahl selbst ist gefallen — statt 366 sind es 100 Negativ-
Befunde, alle aus dem deutschen Katalog, keiner mit Fehlermeldung.

Daniels Frage traf den Punkt: „warum kann bei crunchy ueberhaupt ein schiefstand sein? seit wir
den lauf mit auth token gemacht haben ... sollte es doch perfekt sein fuer alle?" — Es war
perfekt, nur stand die alte Vorsicht noch in der Aufgabenliste.

Wirkung im Datensatz: 491 Synchro-Angaben aus den Serienseiten belegt, 188 Verweise ohne deutsche
Synchro entfernt.

### 22./23.08.2026 — Netflix von Hand, mit einer Erweiterung, die mitlernt

Daniel hat an einem Abend **352 Netflix-Pruefungen** gemeldet: 178 belegte deutsche Synchros,
24 Titel ohne deutschen Ton, 145 Verweise, die ins Leere fuehren. Die offenen Adressen fielen
von 258 auf sieben.

Die 145 toten Verweise sind dabei so wertvoll wie die Belege: Netflix leitet einen
verschwundenen Titel auf die Startseite um, und das sieht fuer jede automatische Pruefung wie
HTTP 200 aus. Kein Automat haette sie gefunden.

**Die Erweiterung lernte im Lauf des Abends, was Netflix ihr sagt.** Sie meldet seit v0.23.0
die Staffelaufteilung mit — und die widerlegte gleich mehrere Annahmen: Netflix zaehlt bei
Jujutsu Kaisen ueber alle Staffeln durch (Staffel 7 beginnt bei Folge 146), bei Sword Art
Online faengt jede Staffel neu bei 1 an. Wer das umrechnet statt es zu lesen, schreibt Befunde
an die falsche Staffel. Netflix rechnet ausserdem OVAs als Folgen der Staffel mit, waehrend
AniList sie getrennt fuehrt: HAIKYU!! hat dort 26 statt 25 Folgen, KONOSUBA 11 statt 10.

**Ein Fehler ist mir dabei zweimal unterlaufen**, und beide Male hat Daniel ihn gemeldet: Die
Erweiterung schickte Befunde zu Serien, die er einfach ansah — erst „Heroes" ohne jede
Einschraenkung, dann noch einmal, weil eine Bruecke fuer abweichende Kennungen zu breit war.
Sie verlangt jetzt, dass der Name passt.

**Der Ertrag fuer die Seite:** 340 belegte Netflix-Synchros statt 178 am Vortag, und 145
Kacheln weniger, die jemanden ins Leere geschickt haetten.

### 22.08.2026 — Netflix mitlesen: am Ergebnis, nicht am Aufruf

Drei Anläufe, zwei davon haben Netflix mitten in Daniels Sitzung lahmgelegt (NSES-UHX):
`window.fetch` und `XMLHttpRequest.prototype.open` zu ersetzen war wirkungslos (Netflix setzt
beide danach selbst neu); dieselben Stellen hinter einen Zugriffsschutz zu legen war schlimmer
— Netflix las beim eigenen Wrappen zuerst den bestehenden Wert, bekam die Hülle, und beide
riefen einander auf. *Maximum call stack size exceeded*, die Seite lud nicht mehr.

Daniels Einwand wies den Weg: „man muss ja nicht direkt fetch überschreiben". Umhüllt wird
jetzt, was die Seite **liest** — `Response.prototype.json` und der Getter von
`XMLHttpRequest.prototype.responseText`. Die native Funktion liegt in einer Closure, niemand
kann sie verdrängen, niemand verwendet unseren Wert als „Original" weiter.

**Was es einbrachte**, gleich bei der ersten Meldung (v0.23.0, 18:29 Uhr): Netflix meldet zu
Sword Art Online `[{seq:1, folgen:25, erste:1}, {seq:2, folgen:24, erste:1}]`. Das `erste: 1`
widerlegte die Annahme, der Anbieter zähle über die Staffeln hinweg durch — bei Jujutsu Kaisen
tut er es (bis 59), hier nicht. Die Umrechnung hätte Daniels Folge 24 der zweiten Staffel an
„Sword Art Online" geschrieben statt an „Alicization", und der Befund hätte ausgesehen wie ein
geprüfter. Aus derselben Antwort folgte, dass Netflix nur zwei der vier Staffeln unter dieser
Adresse führt; die beiden „War of Underworld"-Verweise sind entfernt.

Die Regel steht im Skill `netzwerkverkehr-statt-scraping`, samt der beiden Wege, die
ausgeschlossen sind (`PerformanceObserver` sieht keinen Inhalt, `chrome.webRequest` gibt es in
Manifest v3 ohne Body-Zugriff).

### 22.08.2026 — Folgenbereiche: wo der deutsche Ton aufhört

Bis dahin kannte `data/dub-confirmed.yaml` nur „hat deutsche Synchro" oder „hat keine", je
Verweis für die ganze Reihe. Bei Black Clover auf Netflix stimmte beides nicht: Folgen 1 bis
155 sind deutsch, 156 bis 171 nicht. Ein Kommentar in der Datei hielt fest, dass es „kein Feld
für eine Teilmenge" gebe.

Jetzt gibt es eins, und drei Stücke greifen ineinander:

- **`pipeline/lib/folgenbereiche.ts`** bildet aus Einzelmeldungen Bereiche. Daniel am
  22.08.2026: „melden von 1,3,4,13 müsste reichen, um daraus die infos zu ziehen das 1-3 keine
  und 4-13 eine synchro haben." Interpoliert wird nur zwischen **gleichen** Befunden — aus
  „3 ohne" und „6 mit" wird „4–5 ungeprüft", keine geratene Grenze.
- **Dieselbe Datei rechnet durchgezählte Anbieternummern um.** Netflix zählt Jujutsu Kaisen
  bis 59 durch (Daniel mit Bild: „staffel 1 (bis 24) staffel 2 (bis 47) staffel 3 (bis 59)"),
  unser Datensatz führt drei Einträge mit 24, 23 und 12 Folgen. Eine Staffel ohne geprüfte
  Folge bekommt **gar keinen** Eintrag — vorher wies eine Prüfung an Folge 59 auch Staffel 1
  als geprüft aus.
- **`shared/dub-grenze.ts`** entscheidet, ob im Detail-Panel etwas dazu steht. Nur bei
  gemischten Staffeln: „Deutsch bis Flg. 155". Ist eine ganz deutsch oder gar nicht, sagt das
  Häkchen daneben schon alles.

19 Zusicherungen in `check:logic`. Dabei zwei stille Verluste behoben: Ein Protokollbuchstabe
(`http` gegen `https`) verwarf eine gültige Prüfung, und Meldungen zu unbekannten Adressen
fielen lautlos aus dem Lauf, statt in `daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md` zu landen.

- ✅ **Crunchyrolls Tonspuren kommen aus der Content-API** (21.08.2026, [PR #6](https://github.com/danielzaiser91/anime-kalender-de/pull/6),
  Merge-Commit 9afdd11e). 911 Adressen, 693 Serien, 17.686 Folgen in einem Lauf gelesen —
  vorher 5 bis 23 Sekunden je Seite, jetzt 3 bis 5. **488 Adressen bekommen eine Auskunft, die
  der alte Weg nie geben konnte**; 44 widersprechen ihm, und in allen 44 hat die API recht.

  **Selbst nachgeprüft, nicht übernommen:** Kontrollgruppe aus `data/dub-confirmed.yaml` 24
  richtig / 0 falsch / 0 stumm; die Zahlen des Berichts nachgezählt (313 deutsch, 426 ohne, 107
  nicht mehr verfügbar, 65 ohne Auskunft, 20 teilweise deutsche Staffeln, 4.826 deutsche Folgen
  mit belegtem Termin); der Streitfall „High School DxD" aus der archivierten Rohantwort belegt
  — `versions` trägt `ja-JP` und `en-US`, kein Deutsch, bei `is_dubbed: true`. Mushoku Tensei
  Staffel 3 stimmt mit Daniels eigenem Befund überein: 3 von 8 deutsch, Folgen 1 bis 3 am
  19.08.2026 um 11:00, 11:30 und 15:00 UTC.

  **Wer über die 911 Adressen statt über die 693 Serien zählt, bekommt andere Zahlen** (37
  statt 20 teilweise deutsche Staffeln, 8.434 statt 4.826 Termine) — mehrere Adressen zeigen
  auf dieselbe Serie. Das ist beim Nachrechnen der erste Fallstrick.

  Drei Fehler hat der Lauf dabei gefunden und behoben: ein misslungener `page.goto` gab die
  **vorige** Seite zurück und hängte 91 Adressen die Staffelliste von „Jujutsu Kaisen" an;
  Crunchyroll sperrt nach rund 300 Serien für eine Viertelstunde; und eine Nichtauskunft galt
  als „frisch geprüft" und blockierte damit vier Wochen lang ihre eigene Wiederholung.

  Nachgezogen, weil der Cloud-Lauf keine `workflows`-Rechte hat: Deckel im Wochenlauf von 250
  auf 300. Ebenfalls dabei: `tsconfig.tsbuildinfo` liegt nicht mehr im Repo — sie war der
  einzige Konflikt dieses Merges.
- ✅ **Alle Läufe melden ihre Schritte** (21.08.2026). Nach `deploy.yml` jetzt auch
  `refresh-hourly` (4 Schritte), `refresh-data` (8), `refresh-weekly` (18),
  `tonspuren-monatlich` (2) und `crunchyroll-nachholen` (1). **Live belegt:** Der von Hand
  angestoßene Stundenlauf 32519352698 zeigte „1/4 · Rohdaten holen" und endete mit „4/4 ·
  Vorschaubilder für neue Releases", parallel dazu der Deploy mit „5/7 · Hooks-Regeln geprüft".

  Die Frage dahinter war, wie sich zwei Zählweisen im selben Lauf vertragen: Der Schrittzähler
  sagt „3/8 Rohdaten geholt", das Pipeline-Skript darin meldet „233/594 Serien". Beide
  schreiben dieselben drei Felder, und der Worker setzte sie einzeln per `COALESCE` — ein
  Melder ohne Gesamtzahl hätte die 594 seines Vorgängers geerbt. Die drei Felder sind deshalb
  jetzt eine Gruppe. Gegen den ausgerollten Worker durchgespielt: Schritt 3/8, dann eine
  Meldung mit 12 ohne Gesamtzahl → „12/null" statt „12/594", danach eine Meldung ohne
  Fortschritt → Werte bleiben stehen.

- ✅ **TMDB holt nach Alter nach, nicht nach „schon mal geholt"** (21.08.2026). `fetchedAt` je
  Eintrag, `--alter` mit 60 Tagen als Vorgabe, ältestes zuerst. Probelauf: „2761 von 2761
  Titeln fällig (10 noch nie geholt, Rest älter als 60 Tage)". Dabei fiel auf, dass dieser
  Abruf keine der drei Voraussetzungen aus der `CLAUDE.md` hatte: kein Platz in einem
  Workflow — er lief einmal von Hand und veraltete danach still —, keine Zeile in
  `tools/commit-data.sh` (ein CI-Lauf hätte `data/tmdb-titles.json` verworfen) und keine Frist
  in `check-sources.ts`. Alle drei nachgezogen: Wochenlauf mit `--limit 400`, Frist neun Tage,
  Bestandsmeldung über `recordSource()`.

- ✅ **`loadEnv()` liegt in `pipeline/lib/util.ts`** (21.08.2026) statt als identische Kopie in
  `fetch.ts` und `fetch-tmdb-titles.ts`. Im Trockenlauf geprüft: drei Werte aus `.env` gelesen,
  ein bereits gesetzter bleibt stehen — das ist die Eigenschaft, auf die sich die Cloud
  verlässt, wo die Schlüssel aus den Repo-Secrets kommen.

- ✅ **Crunchyroll-Rückstand ist abgearbeitet** (21.08.2026, nebenbei gemessen). Der
  Nachhollauf 32519594875 meldete „0 Serienadressen offen (911 in den letzten 28 Tagen
  gelesen)". Heute früh waren es 769 offene.
- ✅ **Kalender-Abo führt keine zehn Jahre Vergangenheit mehr** (21.08.2026, Daniels
  Entscheidung: sieben Tage Rückblick). `all.ics` führte am 20.08.2026 noch **742 Termine,
  davon 641 in der Vergangenheit** — zurück bis zum 12.01.2015, 348 KB. Wer das Abo eintrug,
  bekam das alles in seinen Kalender. **Live nachgemessen am 21.08.2026:**
  `https://anime-kalender.de/data/feeds/all.ics` liefert **232 Termine**. Alle künftigen sind
  drin; `events.json` auf der Seite bleibt vollständig, die Vergangenheit ist dort weiter
  durchblätterbar.

- ✅ **Die Statusanzeige zeigt Zweck, Ziel und Fortschritt je Lauf** (21.08.2026). Vorher stand
  je Lauf eine Zeile, die je nach Lauf etwas anderes trug — bei drei Auftrags-Läufen dreimal
  denselben Workflow-Namen. Jetzt liefert **der Lauf selbst** die Angaben (`LAUF_ZWECK`,
  `LAUF_ZIEL` als `env` am Job), der Worker hält sie in zwei neuen Spalten, die Anzeige zeigt
  drei Zeilen. `deploy.yml` meldet zusätzlich seine sieben Schritte einzeln — belegt im Lauf
  32517576468 mit „5/7 · Hooks-Regeln geprüft". Die Prüfung `check:workflows` macht einen Lauf
  rot, der sich meldet, ohne seinen Zweck zu nennen; Gegentest gemacht.

  Zwei Fehler im Fortschritt fielen dabei auf und sind behoben: `git rev-list --count HEAD`
  zählte die mitgeklonte Historie mit (`fetch-depth: 50`), die Zahl begann also bei 50 — und
  „121 Dateien offen" waren Rohdaten aus einem Testabruf, kein Arbeitsstand.
- ✅ **Wochenlauf vom 20.08.2026 nachgesehen** — Lauf 32359320442, grün durch. Der Eintrag stand
  bis zum 21.08.2026 unter „terminiert" und wanderte von dort in den Footer, wo ich ihn als
  „anzustoßen" führte. Beides falsch: Der Lauf war erledigt, und angestoßen wird er ohnehin nie
  von Hand — er hat einen Cron. Daniel hat es gemeldet („sollte das nicht automatisch angestoßen
  werden?").

- ✅ **Abweichungen vom Wochentakt sind eintragbar** (21.08.2026, erarbeitet in der Cloud,
  hier nachgemessen). Ein kuratiertes `schedule.observed` wird jetzt über die aus dem
  Crunchyroll-Kalender abgeleiteten Beobachtungen gelegt statt von ihnen überschrieben —
  dieselbe Vorrangregel wie bei `data/dub-confirmed.yaml`. Erster Fall: Mushoku Tensei
  Staffel 3, Folgen 1 bis 3 am 19.08.2026 gemeinsam erschienen. **Am erzeugten Datensatz
  gemessen:** drei Termine am 19.08. mit den Kennungen `#1`/`#2`/`#3`, nächster Termin am
  26.08. ist Folge **4** statt Folge 2, Ende am 04.11. statt 18.11., Anzeige **3/14** statt
  1/14. Dabei mitgefunden und mitrepariert: `lastEpisodeDate()` kannte die Stützpunkte aus
  `observed` nicht und widersprach der Terminliste darunter; vier Releases bekommen dadurch
  ihr richtiges Enddatum. Ebenfalls mitgefunden: `npm run check:worker` lief in einem frischen
  Checkout gar nicht — `@cloudflare/workers-types` fehlte in `package.json`.

- ✅ **Claude arbeitet jetzt auch in der Cloud, mit ausgeschaltetem PC** (21.08.2026). Daniels
  Frage war: „könnte so ein task nach unserer cli einrichtung in der cloud weitergearbeitet werden
  während mein pc aus ist?" Antwort: ja, und es ist eingerichtet. Das Abo-Token aus
  `claude setup-token` liegt als Repo-Secret `CLAUDE_CODE_OAUTH_TOKEN`; damit ist
  `.github/workflows/claude-reparatur.yml` scharf — bei einem roten Datenlauf liest Claude das
  Protokoll und öffnet einen Reparatur-PR, ohne dass hier jemand am Rechner sitzt.
  **Belegt, nicht angenommen:** ein Wegwerf-Workflow lief am 20.08. um 22:16 (Lauf 32423507534)
  und lieferte `is_error: false`, `num_turns: 1`, Modell `claude-sonnet-5`. Danach wieder gelöscht.
  **Die Lehre daraus steht in `ai_agent_learnings.md` als Kategorie 30:** Der erste Probelauf
  meldete `success`, obwohl gar kein Claude gelaufen war — ohne `actions/checkout` bricht die
  Action nach 250 ms in `configureGitAuth` ab (`fatal: not in a git directory`) und **schluckt den
  Fehler**. Ein grüner Haken ist bei dieser Action kein Beleg; der Beleg ist der JSON-Block
  `"type": "result"` im Protokoll.

- ✅ **Jeder fünfte Anbieter-Verweis führte auf eine Fehlerseite** (20.08.2026). Aufgefallen bei
  einer Stichprobe, dann vollständig gemessen: **195 von 945 prüfbaren Adressen antworten mit 404**.
  Aufgeschlüsselt:

  | Anbieter | Verweise | davon tot |
  |---|---|---|
  | Netflix | 596 | **174 (29 %)** |
  | Amazon / Prime Video | 261 | 9 (3 %) |
  | Disney+ | 39 | 4 (10 %) |
  | Joyn | 8 | **6 (75 %)** |
  | RTL+ | 27 | 0 |

  Bei Netflix erklärt sich der hohe Anteil: Die Kennungen stammen aus einem weltweiten Bestand, und
  viele dieser Titel stehen im **deutschen** Katalog gar nicht. Aus derselben Leitung antworten 422
  andere mit 200 — es ist also keine Bot-Abwehr, sondern der Befund, den auch ein Besucher bekäme.

  Im Datensatz waren es 220 Verweise, weil Adressen bei mehreren Titeln stehen. Titel ganz ohne
  Bezugsquelle steigen dadurch von 665 auf 683 — und das ist die ehrlichere Zahl: Diese 18 hatten
  vorher nur einen kaputten Link. Seit demselben Tag sagen sie das auch („Kein Anbieter bekannt").

  **Crunchyroll und ADN werden nicht geprüft.** Beide antworten jedem Skript mit 403; das wäre kein
  Befund über den Verweis, sondern der Nachweis, dass wir kein Browser sind. Entfernt wird ohnehin
  nur bei einem harten 404 — Zeitüberschreitung, 403 und Netzfehler ändern nichts.

- 📌 **Und ein Fehler in der eigenen Arbeit desselben Tages**, gefunden beim Nachmessen: Die
  YouTube-Prüfung bildete ihre Warteschlange allein aus `titles.json` — aus der der Build tote
  Verweise entfernt. Ein einmal als tot erfasster Verweis wäre nie wieder geprüft worden, ein
  Falschbefund für immer einer. Das ist wörtlich die Falle, der `CLAUDE.md` einen eigenen Abschnitt
  widmet. Beide Prüfungen bilden ihre Schlange jetzt aus der Vereinigung von Datensatz und allem je
  Geprüften; `check-links.ts` hatte es von Anfang an so.

- ✅ **Der Wochenlauf ist grün — zum ersten Mal seit dem 10.08.2026** (20.08., 66 Minuten). Alle
  Schritte erfolgreich, auch der neue YouTube-Schritt: In der CI waren 3 Adressen fällig und wurden
  geprüft, das Secret trägt also. Geschrieben: 2.760 Titel, 245 Releases, 892 Termine. Damit ist die
  Reparatur der ADN-Zuordnung am echten Lauf bestätigt, nicht nur lokal.

- ✅ **ADN verliert keine Serien mehr** (20.08.2026). Die Serienliste von ADN ist von Lauf zu Lauf
  verschieden — 179 gegen 176 am selben Tag —, und der Katalog wurde jedes Mal allein aus dem
  aktuellen Lauf gebaut. **25 Serien mit belegter Synchro lagen im eigenen Archiv und fehlten
  trotzdem im Katalog: 762 Folgen**, darunter Yu-Gi-Oh! mit 236, Fire Force, Clannad und DAN DA DAN.
  Die Warteschlange ist jetzt die Vereinigung aus aktueller Liste, letztem Katalog und Archiv — 242
  statt 179 Serien, 109 statt 81 mit Synchro. Ob eine Serie bleibt, entscheidet weiterhin allein die
  frische Antwort; verliert ADN eine Lizenz, fällt sie heraus.

  Aufgefallen ist es, weil Daniel „Sword of the Demon Hunter" bei ADN offen im Angebot fand, während
  unsere Seite „DE ?" zeigte. Der Sprachcode `vde` stand auf allen 24 Folgen in unserem Archiv.

- ✅ **Tote YouTube-Verweise werden erkannt und entfernt** (20.08.2026). Neues Skript gegen die
  offizielle Data API v3 — kein Auslesen der Seite, das untersagt YouTube, und die Ländersperre
  steht ohnehin nur in der API (`regionRestriction`), nicht im Seitenquelltext. Befund: **Von 460
  bewertbaren Adressen führten 362 ins Leere** — 290 Playlists vollständig landgesperrt, 46
  Einzelvideos hier nicht abrufbar, 17 gelöscht, 9 ohne Inhalt. Brauchbar sind 95. Der Build
  entfernt sie; im Datensatz waren es 397 Verweise, weil Adressen bei mehreren Titeln stehen.
  Kanäle bleiben unangetastet — ein Kanal ist keine Folgenliste. Wiedervorlage nach 30 Tagen, denn
  Lizenzen kehren zurück.

- ✅ **Die Kalenderansicht war für Vorleseprogramme nicht begehbar** (20.08.2026). Bei einer
  Durchsicht gefunden: **keine einzige Überschrift** auf Kalender, Datenbank und „Wo sehen?" — kein
  `h1`, gar nichts —, dazu über zweihundert `span[role="note"]`. Das ist die Rolle für eine
  Anmerkung am Rande; das Element war aber der Auslöser, der eine zeigt, und mit seiner Blase gar
  nicht verknüpft. Jetzt trägt jede Ansicht eine unsichtbare `h1`, die Wochentage sind `h2`, und der
  Auslöser zeigt über `aria-describedby` auf seine Blase. Am ausgelieferten Programmcode
  gegengeprüft: `role="note"` kommt dort nicht mehr vor.

- ✅ **„Kein Anbieter bekannt" statt gar nichts** (20.08.2026). Bei 665 von 2.760 Titeln fiel der
  ganze Abschnitt „Wo läuft es" weg, sobald wir keine Bezugsquelle kannten. Für einen Besucher waren
  damit zwei sehr verschiedene Dinge nicht zu unterscheiden: „läuft nirgends" und „wissen wir
  nicht". Bei „.hack//SIGN" etwa ist die deutsche Synchro über Sprechrollen belegt, nur weiß niemand,
  wo man sie heute noch sehen kann. Ein Satz beendet das Suchen auf dieser Seite.

- 📌 **Geprüft und für gut befunden** (20.08.2026), damit es niemand ein zweites Mal misst: Die
  Startseite lädt in 317 ms mit 6 Anfragen und 204 KB, ohne einen einzigen Konsolenfehler. Auf 375
  Pixeln gibt es keinen waagrechten Überlauf, und von 201 Tippzielen sind nur 5 unter 24 Pixeln.
  Bilder, Knöpfe und Eingabefelder tragen durchgehend Beschriftungen. Die Karten in Kalender und
  Datenbank sind mit Enter und Leertaste bedienbar — der leere `onkeydown` im DOM täuscht, React
  hängt seine Behandlung an den Wurzelknoten.


- ✅ **One Piece steht wieder vollständig da — 515 statt 10 Folgen** (17.08.2026). ADN teilt die
  deutschen Folgen in zwölf Blöcke mit Namen wie „Saga 2 : Alabasta". AniList kennt für die Serie
  **einen** Eintrag, und in unserem Bestand hat die Reihe außer ihm nur zwei Mitglieder (den
  Pilotfilm von 1998 und Fishman Island). Also fand die Staffelsuche für keinen einzigen Block
  einen eigenen Teil, alle zwölf zeigten auf denselben Titel, und die Sperre gegen Doppelungen
  behielt den ersten — zehn Folgen — und warf 505 weg.

  Neue Regel: Findet die Suche für **keinen** Block einen eigenen Reihenteil, waren die Schnitte
  Lieferwellen und keine Staffeln; dann wird die Serie wieder zu einem Release zusammengefasst.
  Ergebnis: ein Eintrag über alle 515 Folgen, „Im Angebot seit 20.05.2019", und **ein** einziger
  Kalendereintrag statt 515. Der Slug bleibt `adn-561`, also stirbt keine Adresse. Fünf
  Zusicherungen in `check-logic.ts`.

- 📌 **To Love-Ru - Darkness bleibt ohne Release — und das ist die richtige Antwort.**
  ADN-Kennung 217 bündelt 26 Folgen unter „Staffel 3". Der Bestand kennt Darkness (12) und
  Darkness 2nd (12); zusammen 24, nicht 26 — die beiden übrigen sind Sonderfolgen, und die lässt
  `staffelnDesFranchise` bewusst draußen, weil sie jede Folgenzahl-Rechnung sprengen.

  Ohne aufgehende Summe gibt es drei Möglichkeiten, und zwei davon sind falsch: 26 Folgen auf den
  Zwölfteiler „Darkness" zu buchen wäre eine Falschangabe, und der Treffer über die reine
  Folgenzahl führte auf „To LOVE-Ru" (26 Folgen) — die **Originalserie**, die ADN unter einer
  eigenen Kennung führt. Bleibt die dritte: kein Release. Das ist der Projektgrundsatz aus
  `CLAUDE.md`, wörtlich — „Geht die Summe nicht exakt auf, bleibt der Block lieber unzugeordnet,
  als einen fremden Titel mitzubringen."

  **Kein offener Punkt mehr.** Er würde erst wieder einer, wenn AniList die beiden Sonderfolgen
  als Staffelmitglieder führte oder ADN die Kennung aufteilte.

- ✅ **Das Favicon ist angemeldet, wie Google es verlangt** (17.08.2026, live). In der
  Ergebnisliste stand der graue Standard-Globus, aniSearch daneben mit seinem Logo (Daniels
  Screenshot). Angemeldet waren nur ein SVG und ein 32×32-PNG; Googles Dokumentation empfiehlt
  „larger than 48x48px". Jetzt kommen ein 96er PNG und ein echtes `/favicon.ico` dazu — letzteres
  gab es überhaupt nicht, jede Anfrage dorthin lief in die 404-Seite. Live geprüft: 200 mit
  `image/vnd.microsoft.icon` beziehungsweise `image/png`, und im Kopf stehen alle vier `rel`-Werte,
  die Google akzeptiert.

  **Wann es in der Suche erscheint, entscheidet Google**, nicht wir: „Crawling can take anywhere
  from several days to several weeks." Behoben ist die Ursache, nicht schon das Ergebnis.

- ✅ **Der Wochenlauf schreibt wieder — und verliert nichts mehr, wenn er scheitert**
  (17.08.2026). Seit dem 10.08. hatte der wöchentliche Tiefendurchlauf dreimal nichts
  committet. Ursache war ein einziger Titel: ADN führt „To Love-Ru" unter zwei Kennungen (217
  und 670), beide mit 26 Folgen, und die Namenssuche gab beiden denselben AniList-Eintrag 3455.
  `passtZuSerie` nimmt einen Reihenkopf an, sobald ein Wort geteilt wird — bei „To Love-Ru -
  Darkness" gegen „To Love Ru" ist das „love". Die Prüfung meldete zu Recht „zusammen 52 Folgen
  bei 26 vorhandenen" und brach ab.

  Der Abbruch war richtig, seine Reichweite nicht. Drei Änderungen:

  - **Zuordnung** (`fetch-adn.ts`): Ein bereits vergebener AniList-Eintrag lässt die nächste
    Schreibweise probieren statt aufzugeben. Genau dafür gibt es die Suchvarianten.
  - **Sperre** (`build.ts`): Sie galt je Serienkennung, weil sie innerhalb der Schleife stand.
    Jetzt gilt sie über alle ADN-Serien.
  - **Zusicherung** (`check-logic.ts`): Der Fall steht mit seinen echten Zahlen als Prüfung im
    Weg. Wer den Melder weicher stellt, um einen grünen Lauf zu bekommen, bricht sie.

  Dazu die Härtung, die den eigentlichen Schaden verhindert: Der Commit-Schritt lief hinter dem
  Aufbau **ohne** `if: always()`. Ein Abbruch nahm damit die ganze Ernte mit — knapp eine Stunde
  Abrufe bei ADN, AniList, ANN, Crunchyroll und aniSearch, dreimal dieselbe Last auf denselben
  fremden Servern. Quellen sind teuer erkauft, Erzeugnisse entstehen in Sekunden; jetzt
  überleben die Quellen einen roten Lauf, und rot bleibt er, damit die Meldung kommt.
  `commit-data.sh` bricht dafür auch nicht mehr an seinem eigenen internen Neuaufbau ab.

- ✅ **Kein Titel fällt mehr zwischen Hauptbestand und Toggle** (17.08.2026). Der Vorfilter für
  Titel, deren japanische Ausstrahlung noch aussteht, löschte sie aus dem Hauptbestand und
  verließ sich darauf, dass sie über den AniList-Katalog hinter dem Toggle wieder auftauchen.
  Bei acht von neun stimmte das; „Xiao Mao Diao Yu" (215520) stand in keinem der beiden Bestände
  und war über keinen Weg mehr erreichbar. Verschobene Titel werden jetzt gesammelt und in
  `ohne-synchro.json` nachgetragen. Ein Titel, den man nirgends findet, ist stillschweigend
  gestrichen — und gestrichen wird nur, was eine Quelle aktiv widerlegt.

- ✅ **Der Dauerschlüssel läuft jetzt ab — ohne jemanden zu trennen** (17.08.2026, live).
  Die alte Notiz („der Abgleich-Schlüssel steht in **jeder** Newsletter-Mail und gilt ewig") war
  zur Hälfte überholt: Seit dem 14.08.2026 steht in der Mail ein eigener `sync_token` mit dreißig
  Tagen Frist, und erst sein Einlösen an `/sync` übergibt den Dauerschlüssel. Offen war der
  Dauerschlüssel selbst — er hatte kein Ablaufdatum, und `handleSync` hängt ihn beim Weiterleiten
  an die Adresse (`/#/newsletter?sync=…`), er liegt also im Browserverlauf.

  Eine feste Frist wäre die falsche Antwort gewesen: Sie hätte genau die Leute getroffen, die
  alles richtig machen. Jetzt gleitet sie — `pref_expires`, bei jeder Benutzung um zwölf Monate
  weitergeschoben, Prüfen und Weiterschieben in **einer** SQL-Anweisung, damit dazwischen kein
  Zeitfenster liegt. Der Einmal-Link aus der Mail **setzt** die Frist statt sie zu prüfen: Wer
  Postfachzugriff nachweist, belebt einen verfallenen Schlüssel wieder.

  Geprüft, nicht angenommen: Die sechs Fälle der SQL-Bedingung (keine Frist, gültig, abgelaufen,
  gekündigtes Abo, unbekannter Schlüssel, derselbe Wert erneut) liefen gegen eine **lokale**
  D1-Kopie — der letzte Fall entscheidet, ob ein zweiter Aufruf in derselben Sekunde noch gilt,
  und SQLite zählt ihn als Änderung. Danach Migration 006 und Deploy; am laufenden Dienst
  gegengeprüft: unbekannter Schlüssel → 404, und beide Bestandsabos stehen weiter auf
  `pref_expires IS NULL`, also gültig. Niemand hat seine Verbindung verloren.

- ✅ **Abmelden aus dem verbundenen Browser** (16.08.2026, live). Wer verbunden ist, beendet sein
  Abo jetzt direkt auf der Newsletter-Seite, zweistufig. Vorher hing der Abmeldelink allein am
  `unsub_token` aus der Mail, den die Seite nicht kennt. `/unsubscribe` nimmt zusätzlich POST mit
  dem `pref_token`; dasselbe Vertrauensniveau, denn auch der kam per Mail an dieses Postfach. Am
  17.08.2026 am laufenden Worker gegengeprüft: Die Route antwortet routenspezifisch, ist also
  deployt.

- 📌 **Datenlage Inazuma Eleven S1 — kein offener Punkt, sondern der Normalzustand.**
  Unser **04.09.2026** ist belegt (Anime2You, „24 Blu-ray-Termine verschoben", 31.07.2026,
  verschoben vom 14.08.). aniSearch führt den **25.09.**, AniMoon selbst nur „September 26"
  ohne Tag; am 13.08.2026 fünf Händler geprüft, keiner nennt einen Liefertag. Der
  Zweitkandidat steht über `disputedDates` im Detail-Panel, verlinkt und als unsicher
  gekennzeichnet — damit ist die Sache abgeschlossen.
  **Nicht mehr im Footer zählen** (Daniel, 14.08.2026): Auf künftige Terminangaben zu warten
  ist die tägliche Arbeit dieses Projekts und kein Rückstand. Ein Punkt entsteht daraus erst
  wieder, wenn eine Quelle etwas Neues sagt — und das meldet der Datenlauf von selbst.


- ✅ **Favoriten gehen nicht mehr verloren** (14.08.2026, live). Gemerkte Titel lagen nur im
  Browser: Browserdaten gelöscht, Gerät gewechselt, neues Handy — weg. iOS-Safari räumt den
  Speicher sogar nach sieben Tagen ohne Besuch von allein auf. Serverseitig lagen sie längst,
  es fehlte allein der Rückweg (`/favorites` war reines POST).
  Jetzt: **Wiederherstellung per E-Mail-Link**, ohne Konto und ohne Passwort. Die Eingabe einer
  Adresse gibt dem Browser **nichts** zurück — die Mail geht ans Postfach, und wer das lesen
  kann, ist der Berechtigte. Drei Schutzmaßnahmen: Einmal-Link mit 30 Minuten Frist,
  Ratenbegrenzung (eine Mail je Adresse in 15 Minuten, zehn Anfragen je IP und Stunde), und
  **immer dieselbe Antwort**, auch bei unbekannter Adresse und selbst wenn der Versand
  scheitert. Beim Wiederherstellen wird **vereinigt statt ersetzt**.
  Dazu `navigator.storage.persist()` gegen die automatische Löschung.

- 🔒 **Sicherheitslücke geschlossen: fremde Anmeldung überschrieb ein aktives Abo**
  (14.08.2026, live). Gefunden auf Daniels Frage hin — es war keine hypothetische Sorge.
  `/subscribe` überschrieb per `ON CONFLICT(email) DO UPDATE` sofort `frequency`, `platforms`
  und `favorites`, und der Status blieb ausdrücklich `active`. Wer eine fremde Adresse ins
  Formular tippte, ersetzte damit **ohne einen einzigen Klick** die Einstellungen und die
  gemerkten Titel eines anderen Menschen.
  Der Kern des Fehlers war, Anmeldung und Änderung gleich zu behandeln. Eine Anmeldung darf
  jeder auslösen — sie bewirkt bis zum Klick nichts. Eine Änderung an einem bestätigten Abo
  darf nur, wer das Postfach lesen kann. Jetzt landen die Wünsche in `pending_*` und greifen
  erst mit `/confirm`; die Bestätigungsmail hat dafür eine zweite Fassung, die vor allem sagt,
  dass **Nichtstun sicher ist**.

- 🔒 **Alt-Abos ohne `pref_token` repariert** (14.08.2026). Das Feld kam erst mit Migration 002
  und hat den Vorgabewert `''` — wer vorher bestätigt hat (Daniel selbst), hatte keinen und
  bekam bis heute keinen Abgleich-Link in seinen Mails. Der neue Wiederherstellungs-Link hätte
  es verschlimmert: `?sync=` mit leerem Wert, der Browser hätte einen leeren Schlüssel
  gespeichert. `sichereSchluessel()` legt ihn jetzt an, wenn er fehlt — ein Alt-Abo repariert
  sich beim ersten Klick selbst.

- 📌 **Migrationen 003 und 004 sind auf der Live-Datenbank eingespielt**, Worker deployt
  (Version `9add16ef`). Gegengeprüft: sechs neue Spalten, Tabelle `rate_limit`, und die
  Endpunkte antworten wie vorgesehen.


- ✅ **Detail-Panel neu geordnet: Karussell statt Auswahlliste** (13.08.2026). Vorher standen
  links ein Cover, rechts die Angaben und weiter unten eine Auswahlliste mit der Überschrift
  „Staffel, Film oder Special" — drei Bausteine für eine Sache. Jetzt zeigt ein Karussell alle
  Teile der Reihe als Vorschaukarten, der gewählte ist hervorgehoben, die Angaben stehen darunter
  über die volle Breite. Die Überschrift entfällt: Ein Karussell aus Covern erklärt sich selbst.
  *Der eigentliche Fund:* Die alte Liste hing allein an `franchises.json`, und darin steht der
  AniList-Katalog nicht. „Link Click" war korrekt gebündelt, hatte aber **gar keinen**
  Umschalter, weil kein einziger seiner sieben Teile eine deutsche Synchro hat. Das Karussell
  speist deshalb aus beiden Beständen. `franchises.json` trägt dafür jetzt Cover — die frühere
  Begründung („für eine Auswahlliste braucht es sie nicht") gilt nicht mehr, eine Vorschaukarte
  ohne Bild ist keine. 63 KB gzip statt 33, weiterhin erst beim ersten Öffnen geholt.
  *Dazu drei kleinere Korrekturen:* Das Banner bleibt beim Wechsel stehen (eigenes, sonst
  geliehen vom ersten Teil der Reihe, der eines hat) — vorher sprang der Kopf um 112 Pixel. Der
  Reihen-Stern hängt absolut statt im Fluss, weil er sonst beim Merken das halbe Panel nach unten
  schob. Und Status und FSK stehen nur noch im Terminblock: Der nennt sie je Release, und eine
  Disc kann eine andere Freigabe tragen als der Stream.

- 📌 **Neue Projektregel: zwei Termine, keiner belegbar → beide führen** (Daniel, 13.08.2026).
  Nicht heimlich einen wählen und den anderen in eine Fußnote schieben. Beide erscheinen im
  Detail-Panel, jeder mit seiner Quelle verlinkt, dazu der Satz, dass wir es nicht klären
  konnten. Der **Kalender** führt weiterhin einen Termin — zwei Einträge würden behaupten, es
  gebe zwei Veröffentlichungen, und das wäre die schlimmere Falschaussage.
  Technisch `Release.disputedDates`, gepflegt in `data/curated/*.yaml`; die Regel steht in der
  `CLAUDE.md` unter „Terminquellen". Erster und bisher einziger Fall: Inazuma Eleven S1.

- ⚠️ **Fallstrick beim Prüfen: der Service Worker der Vorschau** (13.08.2026). Ein Service
  Worker, der aus einer früheren `npm run preview`-Sitzung auf demselben Port registriert blieb,
  bediente `/data/` hartnäckig aus seinem Cache — der Dev-Server lieferte längst die neuen
  Daten, der Browser zeigte die alten, und selbst `fetch(..., { cache: 'no-store' })` kam nicht
  daran vorbei. Erkennbar daran, dass `curl` gegen denselben Port das richtige Ergebnis liefert.
  Abhilfe: `navigator.serviceWorker.getRegistrations()` abmelden und `caches.keys()` löschen.


- ✅ **Anime ohne deutsche Synchro: merken und benachrichtigt werden** (13.08.2026). Der
  häufigste Grund, die Seite immer wieder aufzurufen, ist eine Serie, die es auf Deutsch gar
  nicht gibt — nachsehen, nichts finden, nächste Woche wieder (Daniel aus eigener Erfahrung).
  Jetzt holt ein Schalter in der Datenbank **15.103 Titel ohne belegte Synchro** dazu; wer einen
  davon merkt, bekommt eine Mail, sobald es eine gibt. Auch dann, wenn sonst nichts ansteht —
  vorher verschickte der Newsletter nur bei Terminen im Fenster, und eine Ankündigung ist kein
  Termin.
  *Datenquelle:* `pipeline/fetch-anilist-katalog.ts` holt den Gesamtbestand (17.852 Anime),
  zerlegt nach Startjahr, weil AniList je Abfrage nur 5.000 Einträge durchblättern lässt und es
  kein `id_greater` gibt; ein Nachlauf über die jüngsten Kennungen sammelt 285 Titel ohne
  Jahrgang ein.
  *Ladelast:* Eigene Datei, **1.018 KB gzip**, geholt nur beim Umlegen des Schalters. Der
  Service Worker lädt sie ausdrücklich nicht vor — die Begründung steht jetzt an seiner
  Vorladeliste, damit sie niemand ergänzt.
  *Beinahe-Katastrophe:* Beim zweiten Bau galten **alle 2.753** bestehenden Titel als Neuzugang,
  weil der Ausgangsstand das heutige Datum trägt. Jeder Abonnent hätte eine Mail über Serien
  bekommen, die er seit Jahren kennt. `check:logic` stellt den Ablauf jetzt nach.

- 📌 **Korrektur einer eigenen Behauptung vom selben Tag** (13.08.2026). Vormittags stand in der
  `CLAUDE.md`, aniSearch nenne „den weltweit frühesten Termin, nicht den deutschen" — mit
  Daniels Lesart, der 20.08. sei der Termin der Ausgabe mit japanischer Tonspur. **Widerlegt:**
  Der Anime2You-Verschiebungsartikel nennt für dieselben Titel exakt diese Daten als die alten
  **deutschen** Termine (Most Heretical 20.08. → 03.09., Café Terrace 21.08. → 04.09.). aniSearch
  pflegt Verschiebungen also schlicht nicht nach. Das ist eine andere Diagnose mit anderer Folge:
  Ein aniSearch-Datum, das **später** liegt als unseres, ist kein Fremdrelease, sondern ein
  ernstzunehmender Verdacht auf eine Verschiebung, die uns fehlt.


- ✅ **Zehn Disc-Widersprüche geprüft, neun erledigt** (13.08.2026, Daniel von Hand, je über die
  Shops). Ergebnis in drei Teilen:

  **Vier waren gar keine Widersprüche, sondern ein Fehler bei uns.** aniSearch führt US-, UK- und
  französische Ausgaben gleichberechtigt in derselben Liste; `extract-disc-dates.ts` nahm sie alle
  mit und hängte jedem Vorschlag den **deutschen** Publisher an. Eine britische Blu-ray sah damit
  aus wie eine deutsche von Crunchyroll. Betroffen: Black Butler Emerald Witch Arc, MHA Vigilantes
  S1, Kaiju No. 8 Mission Recon, Dr. STONE Science Future. Erkennbar am Flaggenbild im Block
  (`class="flag"`) — deutsche Ausgaben tragen keine. **28 von 122 Vorschlägen waren ausländisch.**
  *Damit fällt auch meine Vermutung vom selben Tag*, die höhere aniSearch-Artikelnummer trage das
  spätere Datum: Es waren schlicht US- und UK-Termine (Daniel: „also evtl doch nicht so einfach
  wie du vermutest").

  **Fünf sind bestätigt — unser Termin stimmt.** The Most Heretical Last Boss Queen S1 (03.09.,
  anime-planet.de: „Lieferung zum Release am 3. September 2026"), I'm Standing on a Million Lives
  S1, My One-Hit Kill Sister S1, Re:Monster S1, The Café Terrace S1 (alle 04.09., jpc). Warum wir
  richtig lagen: Die Termine stehen **von Hand** in `data/curated/disc-august-2026.yaml`, mit dem
  Anime2You-Artikel „24 Blu-ray-Termine verschoben" (news/1035909, 31.07.2026) als zweiter Quelle.
  Der maschinelle Auszug aus genau diesem Artikel enthält `dates: []` — die Pipeline hat daraus
  **kein einziges Datum** gelesen, nur die Markierung `pause: "verschoben"`. **Die Richtigkeit
  skaliert also nicht**; sie hing an einem Menschen, der einen Artikel gelesen hat.

  **Einer bleibt offen:** Inazuma Eleven S1, siehe Queue.

- 📌 **Recherche: Rangfolge der Terminquellen** (13.08.2026, Daniel). Ausführlich in der
  `CLAUDE.md` unter „Terminquellen". Kurz: **Shop mit Vorbestellung** ist am verlässlichsten (er
  muss liefern), aber nicht jeder pflegt nach — ofdb.de führte für Million Lives noch den
  überholten 19.06., jpc und alle übrigen schon den 04.09. **Anime2You** ist ein guter Indikator,
  aber lückenhaft: Ein Artikel vom 11.07.2026 nennt für dieselbe Staffel den 07.08. und wurde nie
  nachgezogen — nicht jede Verschiebung bekommt eine eigene Meldung. **aniSearch** nennt den
  weltweit frühesten Termin, nicht den deutschen; für die fünf AniMoon-Boxen steht dort der
  20./21.08., nach Daniels Prüfung der Termin der Ausgabe mit japanischer Tonspur.
  *Verworfen, mit Grund:* aniSearch als Beleg für einen deutschen Termin — dafür taugt es nicht.
  Als Hinweis, **dass** es zu einem Titel überhaupt eine Ausgabe gibt, bleibt es nützlich.


- ✅ **Crunchyroll-Lauf abgeschlossen: 917 von 918 Seiten gelesen** (13.08.2026, 06:25–07:03).
  Die 316 Restadressen des abgebrochenen Laufs vom 12.08. nachgeholt; der Wiederaufsatz übersprang
  die 601 bekannten von selbst. **1.146 Synchro-Angaben belegt.**
  Crunchyroll steht damit bei **234 ja / 988 nein / 25 offen** — vorher 122 / 745 / 380. Knapp
  tausend belegte Neins sind knapp tausend Klicks, die niemand mehr machen muss: „dort nur
  Originalton" ist eine genauso brauchbare Auskunft wie ein Häkchen.
  Die Prüfliste fällt von 2.078 auf **1.732** offene Verweise. Was bleibt, ist Handarbeit bei
  Anbietern ohne jede öffentliche Sprachangabe.
  *Beim Rebase auf die Nachtläufe kollidierten die erzeugten Dateien* (`public/data/*`). Nicht von
  Hand aufgelöst, sondern die Quelldaten zusammengeführt und `data:build` neu laufen lassen — bei
  erzeugten Dateien ist jede Handauflösung eine Erfindung.


- ✅ **Ansicht „Wo sehen?" gebaut** (13.08.2026, `#/wo`, neuer Reiter). Der Kalender von der
  anderen Seite gelesen: nach **Anbieter** statt nach Datum, getrennt in *Ansehen* und *Kaufen
  oder leihen*. Für die meisten Titel ist das die eigentliche Frage — nur gut hundert der 2.753
  Anime haben überhaupt einen anstehenden Termin. **2.103 Titel auf 53 Anbietern**, je Anbieter
  die Bilanz ✓/✕/? und aufgeklappt die Titel mit Verweis nach draußen.
  *Gebündelt wird über Name und Zugangsart*, nicht über die Herkunft der Angabe: Sonst stand
  „Prime Video" zweimal in der Liste (231 aus `streams`, 6 aus `watchLinks`) und die kleinere
  Zahl las sich wie ein anderer Dienst. „YouTube zum Ansehen" und „YouTube zum Kaufen" bleiben
  dagegen getrennt — das sind zwei verschiedene Antworten.

- ✅ **Zwei Anzeigefehler beim Bau der Ansicht gefunden und behoben** (13.08.2026).
  *Der Tooltip schob die ganze Seite auf:* Die Blase stand dauerhaft im DOM und wurde nur per
  `opacity-0` unsichtbar gemacht — ein durchsichtiges Element nimmt aber weiter Platz im
  Überlauf ein. Bei den Hinweisen am rechten Bildrand ragten 320 Pixel hinaus, gemessen 1.302
  Pixel Inhalt bei 1.270 Pixel Fensterbreite. Jetzt entsteht die Blase erst beim Zeigen und wird
  einmal gemessen, damit sie mit acht Pixeln Abstand ins Bild passt.
  *Die Navigation passte nicht mehr aufs Handy:* Mit dem fünften Reiter überstand die Leiste
  375 Pixel. Gelöst über eine Kurzform („Wo?") und knappere Innenabstände auf schmalen Schirmen;
  `overflow-x-auto` liegt als Reißleine darunter, falls je ein sechster Reiter dazukommt.
  *Lehre für die Animation:* Der erste Entwurf blendete die Blase von `opacity: 0` auf — im
  Browser-Pane blieb sie damit unsichtbar, weil dort `document.hidden` gilt und Animationen gar
  nicht erst anlaufen. Eine hängende Animation darf einen Inhalt nie verschlucken; jetzt
  animiert nur noch eine Verschiebung um drei Pixel, und die steht mit im Keyframe, weil eine
  `transform`-Animation das statische `-translate-x-1/2` sonst überschreibt.


- ✅ **Crunchyroll-Lauf: 601 Seiten gelesen, 791 Angaben belegt** (12./13.08.2026). Die offenen
  Crunchyroll-Verweise fielen damit von **1.156 auf 380**, die Prüfliste insgesamt von 2.847 auf
  **2.078** Verweise. 551 der gelesenen Seiten führen gar keine deutsche Tonspur — das sind
  belegte Neins, für die niemand mehr klicken muss.
  *Beinahe-Verlust und die Lehre daraus:* Der Lauf schrieb sein Ergebnis erst **am Ende**. Beim
  Abbruch nach 579 Seiten wäre alles weg gewesen — anderthalb Stunden Last auf einem fremden
  Server für nichts. Gerettet über `pipeline/recover-cr-dub.ts`, das die Protokollzeilen zurück
  in den Datensatz übersetzt. Seitdem schreibt der Scraper alle zehn Seiten einen Zwischenstand
  und überspringt beim nächsten Start, was schon gelesen ist. **Ein langer Lauf ohne
  Zwischenstand ist ein Lauf ohne Netz.**
  *Nebenbei:* Ein Fehlschlag wird nicht mehr als „keine Synchro" gespeichert — sonst stünde eine
  Zeitüberschreitung später als belegtes Nein im Datensatz, und der Wiederaufsatz fasste die
  Seite nie wieder an.


- ✅ **Crunchyroll-Serienseiten liefern die Synchro-Auskunft selbst** (12.08.2026). Aus der
  Frage nach Crunchyrolls Staffelzählung wurde etwas viel Nützlicheres: Die Serienseite nennt
  je Folge „Synchro", „Synchro English" oder nur „Untertitel" — also genau das, was Daniel
  bisher von Hand prüft. `npm run data:cr-dub` liest das aus.
  *Zwei Stufen:* Fehlt „Deutsch" in der Audio-Zeile des Kopfes, ist die Seite nach einem
  Ladevorgang erledigt (Daniels Abbruchbedingung); im Probelauf traf das auf fünf von sechs
  Adressen zu. Sonst wird jede Staffel durchgeblättert und je Folge gezählt.
  *Drei Fallen, alle gemessen und behoben:* Die Folgenliste zeigt nur zwanzig Kacheln und lädt
  weitere erst auf Klick auf „Mehr anzeigen" (der erste Versuch meldete deshalb drei
  Slime-Staffeln als „20/20"); Badges müssen je Kachel gelesen werden, nicht aus dem Fließtext;
  und gezählt werden **Folgennummern statt Kacheln**, weil Crunchyroll Folgen doppelt führt —
  das korrigierte Slime-Staffel 1 von 25 auf die richtigen 24.
  *Grundsatz:* Crunchyrolls Einteilung wird nicht übernommen, nur die Tonspur. Ein teilweise
  vertonter Block bleibt ohne Urteil. Sechs Zusicherungen in `check:logic` halten das fest.
  *Gegenprobe an Slime:* Staffel 4 mit 15 von 17 Folgen deutsch — genau Daniels Befund.


- ✅ **Disc-Vorschläge abgearbeitet** (12.08.2026). Von 101 Vorschlägen aus dem aniSearch-Archiv
  führten wir 77 bereits mit demselben Datum. Von den 24 offenen blieben nach dem Abgleich genau
  **zwei** echte Lücken: „Spice and Wolf – Vol. 2/4" (02.10.) und „Witch Watch – Vol. 2/2"
  (17.09.) — beides Zwischenausgaben von Reihen, deren übrige Volumes wir schon führen.
  Der Rest zerfiel in drei Gruppen: **veraltete Termine**, die der Verschiebungs-Artikel vom
  31.07. längst überholt hat (I'm Standing on a Million Lives, One-Hit Kill Sister, Re:Monster,
  Café Terrace, Most Heretical Last Boss Queen — alle mit dem alten 21.08. bzw. 20.08.);
  **Platzhalter** mit dem 31.12., den aniSearch für „steht noch nicht fest" verwendet; und
  **sieben echte Widersprüche**, die je einen Blick auf die Produktseite brauchen und deshalb in
  der Queue stehen.
  *Nebenbei bestätigt:* aniSearch nennt für „Café Terrace – Staffel 1" den 21.08. — also genau
  das alte Datum aus dem Verschiebungs-Artikel. Unser bisheriger 07.08. war damit falsch, und
  die Entscheidung, auf den neuen 04.09. zu gehen, war richtig.


- ✅ **Drei Pausen-Meldungen abgearbeitet** (12.08.2026). Der Filter hatte sie am 11.08. vorgelegt,
  aber ohne Datumsangaben — die stehen nur im Fließtext bzw. in einer Tabelle. Ergebnis nach
  einem Abruf des einen Artikels, der Termine nennt:
  - **„24 Blu-ray-Termine verschoben" (31.07.2026):** Die Tabelle nennt 27 Änderungen von
    AniMoon, Crunchyroll, KSM und peppermint. **15 davon betrafen unsere Termine** und sind
    verschoben — unter anderem sechs Komplettboxen vom 07.08. auf den 04.09. Sechs weitere
    Ausgaben (Strike Witches Vol. 2/3, Virgin Road Vol. 2/3, World's End Harem Vol. 2) standen
    bereits auf dem neuen Datum, weil der aniSearch-Import sie schon aktualisiert hatte.
    **Drei Ausgaben fehlten ganz** und sind neu: Takamine Vol. 2 (16.10.), Million Lives
    Staffel 2 (04.12.), Sakamoto Days Vol. 2 (02.10.).
  - **Nicht übernommen:** „Jujutsu Kaisen – Staffel 1 (Bundle), 07.08. → 07.05." — ein Termin,
    der vor dem Artikel läge. Entweder Tippfehler oder 2027 gemeint; ohne zweite Quelle bleibt
    er draußen. Die drei gestrichenen Eyeshield-21-Ausgaben führen wir ohnehin nicht.
  - **Abweichung notiert:** Für „The Café Terrace and Its Goddesses – Staffel 1" nennt der
    Artikel als **altes** Datum den 21.08., bei uns stand der 07.08. Übernommen wurde das neue
    Datum (04.09.) — der Artikel ist die jüngere und ausdrückliche Quelle.
  - **Bleach und Scarlet** betreffen uns nicht: Beide Titel stehen in keinem unserer Einträge.
    „Bleach auf unbestimmte Zeit verschoben" hat ohnehin kein Datum; „Scarlet" wäre ein
    Kinotermin, den wir noch nicht führen — als Kandidat notiert, nicht als Termin.


- ✅ **Batch 3 ausgewertet, zwei Regeln fürs Vorlegen gelernt** (12.08.2026). 33 Angaben belegt,
  32 tote Verweise entfernt (65 Prüfungen). Zwei Fehler auf meiner Seite, beide beim Vorlegen im
  Chat: Ich hatte die Einträge einer Zeile **umsortiert** (Serien vor Filme statt in der
  Reihenfolge der Liste) und zwölf Netflix-Einträge zu „12 weitere Filme/Ableger"
  zusammengefasst, statt sie zu verlinken — die blieben damit ungeprüft. Ab jetzt: jeder Eintrag
  einzeln verlinkt, Reihenfolge wie in der Liste, und bei gleicher Adresse nur **ein** Link mit
  den zu prüfenden Namen in Klammern.
  *Befund am Rande:* Crunchyroll zeigt „Café Terrace" und „Vanitas" je als **eine** Staffel mit
  24 Folgen, während wir sie getrennt führen. Daraus wurde `StreamLink.sharedWith` und ein
  Hinweis unter „Wo läuft es".


- ✅ **Batch 1 der Prüfliste ausgewertet, Format umgestellt** (12.08.2026). Daniels zehn
  Antworten brachten einen Befund, den ich nicht erwartet hatte: **sechs von zehn Verweisen waren
  tot**, nicht untertitelt. Deshalb kennt `data/dub-confirmed.yaml` jetzt drei Ergebnisse —
  `dub: true`, `dub: false` (dort nur Untertitel, Verweis bleibt mit ✕) und
  `available: false` (Titel dort nicht zu haben, Verweis wird **entfernt**). 16 Angaben belegt,
  6 Verweise entfernt.
  *Neues Listenformat:* Eine Zeile ist jetzt eine **Reihe auf einem Anbieter**, nicht eine
  einzelne Staffel — wer den Crunchyroll-Verweis von Attack on Titan öffnet, sieht dort alle
  Staffeln auf einmal. In der letzten Spalte stehen die noch offenen Einträge, jeder als eigener
  Verweis; die Anbieter-Spalte entfällt, sie ergibt sich aus der Adresse. 1.691 Zeilen statt
  2.910 Einzelposten.

- ✅ **Eigene Tooltips statt der Browser-Kästchen** (12.08.2026, Daniel). `Tooltip` in
  `ui.tsx`, eingehängt in die gemeinsamen Bausteine (Button, Chip, FskBadge,
  ReleaseTypeBadge, FavoriteStar, HideEye, ShareIcon, Toggle) — damit greifen die 25
  Aufrufstellen auf einmal. Erscheint auch bei Tastaturbedienung. Einzige Ausnahme: die
  abgeschnittenen Namen der Sprecherliste, wo der Browser-Hinweis genau seine Aufgabe erfüllt.
  Dazu die Abkürzung MAL erklärt und der veraltete Hinweistext von „Staffeln zusammenfassen"
  korrigiert (sprach noch von „der neuesten Staffel").

- ✅ **Quelle der Handlung stimmt und steht an einer Stelle** (12.08.2026). aniSearch hängt sie
  als Fließtext an die Beschreibung; bei 2.385 von 2.683 Texten stand sie deshalb mitten im
  Absatz, und darunter behauptete unsere eigene Zeile pauschal „themoviedb.org". Die Pipeline
  löst sie jetzt heraus und führt sie als `deSource` mit.


- ✅ **Detail-Panel aufgeräumt** (12.08.2026, zehn Punkte von Daniel). Genres nach oben neben das
  Cover, Keywords ganz ans Ende, „Alles aus dieser Reihe" gestrichen (steht schon im
  Umschalter). Im Terminblock: Datum und Uhrzeit in einer Zeile, Uhrzeit weg statt „unbekannt",
  der Bedeutungs-Hinweis als Hovertext am gepunktet unterstrichenen Datum, Release-Name raus.
  Titel ohne Termin bekommen denselben Block mit „Im Angebot seit — unbekannt" statt eines
  eigenen Kastens. Kalender- und ICS-Knopf nur noch bei künftigen Terminen, ICS mit
  Erklär-Fragezeichen. Handlung auf 200 Zeichen mit „mehr anzeigen", Quelle darunter als
  Verweis. Im Browser gegengeprüft (Dev-Server 5183, danach gestoppt).


- ✅ **Drei Nachbesserungen an der Staffel-Ansicht** (12.08.2026, Daniel).
  *Auswahlliste unlesbar:* Im Dunkelmodus hatte das `select` `bg-white/5` — 95 % durchsichtiges
  Weiß. Geschlossen richtig, aufgeklappt malt Windows es über Weiß, und die helle Schrift des
  Dunkelmodus stand hellgrau auf Weiß. Feste Farben für `option` in `styles.css`, einmal für
  beide Auswahllisten der Seite. Gemessen: Kontrast 11,87 (dunkel) und 17,85 (hell).
  *Progressive-Filme abgetrennt:* AniList verknüpft sie über `ALTERNATIVE`, und dieser
  Beziehungstyp fehlte in `FRANCHISE_RELATIONS`. Ergänzt um `ALTERNATIVE`, `SPIN_OFF`,
  `SUMMARY`, `COMPILATION` — bewusst **ohne** `CHARACTER`, das nur „hier kommt jemand vor"
  bedeutet und fremde Reihen verschmelzen würde. 1.504 → 1.413 Reihen; SAO ist eine Kachel mit
  zwölf Einträgen.
  *Schalter-Vorgabe:* „Staffeln zusammenfassen" startet jetzt aus.


- ✅ **Cache-Busting: normaler Refresh reicht** (12.08.2026, Daniel: „das harte Neuladen sollte
  nie notwendig sein"). Ursache war keine Fehlfunktion, sondern eine Adresse: `/data/events.json`
  hieß nach dem Deploy genauso wie davor. Der Service Worker fuhr „Cache sofort, Netz im
  Hintergrund", und der Hintergrund-Abruf lief seinerseits in den HTTP-Cache des Browsers
  (GitHub Pages: `max-age=600`) — aufgefrischt wurde also mit demselben alten Inhalt, beliebig
  oft. Jede Datenadresse trägt jetzt den Datenstand aus `meta.generatedAt`
  (`?v=20260812142619`), eingesetzt in `vite.config.ts`; der Service Worker antwortet bei
  gleicher Kennung sofort aus dem Cache, sonst aus dem Netz, und ignoriert die Kennung nur
  offline. Navigationen fragen mit `cache: 'no-cache'` beim Server nach, damit altes HTML nicht
  zehn Minuten lang auf ein altes Bündel zeigt.
  *Im Browser bewiesen*, nicht nur gebaut: Datenstand geändert, Dev-Server neu gestartet,
  **normal** neu geladen — neuer Inhalt da, alter weg, beide Fassungen nebeneinander im Cache.
  Offline-Zweig einzeln geprüft: unbekannte Kennung ohne Server liefert die letzte bekannte
  Fassung (682 Termine) statt eines Fehlers.
  *Nebenbefund mitbehoben:* Die Programmdateien jedes Deploys blieben liegen — rund 400 KB je
  Veröffentlichung, unbegrenzt. Jetzt bleiben die letzten vierzig, und das Aufräumen fasst
  ausdrücklich nur `/assets/` an: Die Startseite steht in der Einfügereihenfolge ganz vorn und
  wäre als Erstes gelöscht worden, obwohl ohne sie offline gar nichts mehr geht.


- ✅ **Suche und Staffel-Navigation überarbeitet** (12.08.2026, gemeldet von Daniel).
  *Suche:* liest jetzt Wort für Wort statt die Eingabe als eine Zeichenkette („aesthetic hero"
  fand vorher nichts), und fällt bei leerem Ergebnis auf eine nachsichtige Stufe zurück
  („ästhetik" → Aesthetica, „bochi the rok" → Bocchi the Rock!). Toleranz nach Wortlänge:
  bis 2 Zeichen keine, 3–6 ein Tippfehler, ab 7 zwei, dazu Bigramm-Ähnlichkeit ab 0,60 und
  gemeinsame Wortanfänge ab vier Zeichen auf **beiden** Seiten. Die zweite Stufe sieht nur
  Titel an, nicht Genres oder Keywords. `npm run check:search` sichert das gegen den echten
  Bestand ab, samt Laufzeitgrenze.
  *Deutsche Namen:* Der Name aus dem Crunchyroll-Kalender hing nur am Termin, nicht am Anime —
  „Meine Wiedergeburt als Schleim" war nicht auffindbar. Jetzt 93 statt 84 Titel mit deutschem
  Namen.
  *Reihen:* Vertreter einer Reihe ist die erste reguläre Staffel statt der neuesten (Suche
  „slime" zeigte vorher eine Fortsetzung und einen Film). „Staffeln dieser Reihe" las die 133
  Kalender-Titel statt aller — neu über `public/data/franchises.json` (460 Reihen, 33 KB gzip,
  nachgeladen). Im Detail-Panel steht jetzt der Reihenname im Kopf und darunter ein Umschalter
  über alle Staffeln, Filme und Specials. „Season" ist aus Titeln, Terminnamen und Oberfläche
  verschwunden (`eindeutschenStaffel()` in `shared/titles.ts`).
  *Im Browser geprüft* (Dev-Server auf Port 5183, danach gestoppt): Kacheln, Umschalter, Termine
  je Staffel, Suche nach „ästhetik". Dabei zwei Dinge gefunden, die kein Test gezeigt hätte —
  die Eindeutschung lief **nach** dem Ausrollen der Termine, stand also in `releases.json` und
  nicht in `events.json`; und die Mehrzahlform „Seasons 1 & 2" (Urusei Yatsura) fiel durch die
  Einzahl-Regel.


- ✅ **196 erfundene Termine beseitigt — der schwerste Fehler bisher** (12.08.2026). Gemeldet
  von Daniel: Der Kalender führte „Sword Art Online" mit 96 Wochenfolgen bis zum 07.04.2027,
  obwohl die deutsche Fassung der dritten Staffel seit August 2019 auf Disc existiert (Quelle:
  [anime2you, 15.04.2019](https://www.anime2you.de/) — peppermint anime beginnt im August 2019
  mit dem Disc-Release von »Sword Art Online -Alicization-«). Sailor Moon dasselbe bis zum
  16.11.2027. Zusammen **196 von 867 Terminen frei erfunden**, 101 davon in der Zukunft, zwei
  in der laufenden Woche und ohne ≈ ausgewiesen. Vollständige Analyse:
  [anime-kalender-adn-staffeln-und-falsche-termine.md](file:///C:/code/ai/__assets/notes/anime-kalender-adn-staffeln-und-falsche-termine.md).

  Vier Ursachen hintereinander, alle behoben:
  1. `?limit=100` ohne `offset` — ADN liefert die neuesten Folgen zuerst, abgeschnitten wurde
     der Anfang. Sailor Moon 100 statt 199 (und ein um vier Monate falscher Start), Eyeshield 21
     100 statt 145, Dragon Ball Super 100 statt 131.
  2. Die Felder `season`, `reference`, `order`, `type`, `duration` der ADN-Antwort wurden
     weggeworfen. Eine ADN-Kennung ist ein Franchise: SAO = 3 Staffeln, Sailor Moon = 5,
     Haikyu!! = 8, neun von 37 Serien betroffen.
  3. Komplettabwurf wurde an `dates.size === 1` erkannt — zwei Veröffentlichungswellen galten
     als Wochentakt.
  4. `expandEvents` las `lastEpisodeDate` nicht, obwohl `releaseStatus()` in derselben Datei es
     auswertet. Der Datensatz sagte gleichzeitig „abgeschlossen" und „nächste Folge Mittwoch".

  Ergebnis: 46 ADN-Releases aus 48 Staffelblöcken statt 28 Sammel-Einträgen, Termine von 867
  auf 682, zukünftige Termine von 291 auf 191. SAO steht jetzt als fünf Einträge da —
  Staffel 1, Staffel 2, Alicization, War of Underworld, WoU Part 2 —, jeder mit seiner eigenen
  Folgenzahl und dem Hinweis, wie ADN sie zählt („Folgen 25–36 der ADN-Staffel 3").

  *Neu dazu:* `pipeline/lib/pruefung.ts` prüft am Ende jedes Builds den **erzeugten** Datensatz
  und bricht bei einem Widerspruch ab (bisher prüfte `validate.ts` nur die Handarbeit — also
  ausgerechnet den durchdachten Teil). `npm run check:logic` stellt die vier Annahmen nach.
  `npm run data:adn:refresh` frischt die bekannten Katalogserien auf, ohne alle 580 anzufragen.
  Rohantworten liegen ab sofort unter `data/adn-raw/*.json.gz` (35 Dateien, 196 KB).

  *Nebenbefunde derselben Art, mitbehoben:* 32 Anime hießen nach einer Blu-ray-Ausgabe
  („Bocchi the Rock! – Vol. 1"), weil der Release-Name zum Werktitel wurde. Die beiden
  Disc-Ausgaben von DAN DA DAN Staffel 2 hingen über `search: "Dandadan"` an der ersten Staffel.

- ✅ **Disc-Termine aus dem aniSearch-Archiv** (12.08.2026). Der `items`-Abschnitt jeder
  archivierten Seite führt die deutschen Neuerscheinungen mit maschinenlesbarem Datum
  (`data-date="2026-10-30"`), Jahre im Voraus, über **alle** Publisher hinweg. Damit erledigt
  sich die Frage nach den Verlagsseiten: peppermint rendert per JavaScript, AniMoon und
  Universum waren nicht erreichbar, polyband sperrt Bots — hier steht alles an einem Ort, in
  einer Quelle, die uns das Lesen erlaubt. **Ohne einen einzigen neuen Abruf**, gelesen wird nur
  das Archiv. Ergebnis aus 110 Seiten: 101 künftige Ausgaben, davon 47 neu (34 Termine, 21
  Anime). `npm run data:disc-proposals`.
  *Strenge Auswahl:* Als Bildträger gilt nur, was sich belegen lässt — `[Blu-ray]`/`[DVD]`, die
  Bruchzählung „Vol. 2/3" (die es bei Büchern nicht gibt), Box, Gesamtausgabe, Staffel.
  Ausgeschlossen: `[eBook]` und „Bd. 02" (Manga), dazu Nendoroid, Pop!, Figuren, Spiele,
  Soundtracks. Was in keine Gruppe fällt, wird verworfen statt geraten — 106 von 207 Einträgen.

- ✅ **Wächter meldet erst beim zweiten Fehlschlag** (12.08.2026, deployt — Version
  `af64e37e-0ef9-4bf2-9270-0877434ad67e`). Auslöser war ein Fehlalarm: Am 11.08.2026 kam
  „Störung: Isekai-Idle-Mockups, HTTP 503". Nachgeprüft war es keiner — letzter grüner Abruf
  01:00:28Z, Mail aus dem Lauf um 02:00Z, also genau **ein** roter Lauf; die Seite ist unverändert
  (`Last-Modified` 17.07.2026), GitHub meldete für den 10./11.08. keinen Pages-Vorfall, und ein
  503 vor einer Pages-Seite kommt aus dem Fastly-Edge davor, nicht aus dem Repo. `runMonitor`
  alarmierte bei `down.length > 0`. Jetzt gilt eine Seite erst ab `failStreak >= 2` als gestört —
  der Wert wurde ohnehin schon in `site_status` fortgeschrieben und nur nie gelesen. Der Preis ist
  eine Stunde Verzug im echten Ausfall; eine Mail, der man nicht mehr glaubt, ist teurer.
  `outageMail` bekam dazu ein `okCount`-Argument: Es zählte bisher `totalCount - down.length` und
  hätte eine gleichzeitig erstmalig rote Seite als „antwortet normal" mitgezählt.
- ✅ **Karteileichen in `site_status`** (12.08.2026, dieselbe Änderung). `/status` führte eine Zeile
  „Newsletter-Dienst" auf `ok=0, HTTP 404, checked_at 08.08.2026` — Rest vom zurückgenommenen
  Selbstüberwachungs-Versuch (`sites.ts:34`). Sie wurde nie wieder geprüft und stand darum
  dauerhaft auf Rot im Admin-Panel. `runMonitor` löscht jetzt nach jedem Lauf, was nicht mehr in
  `SITES` steht. Auf die Mails hatte es nie Einfluss — die lesen `checkAllSites()`, nicht die
  Tabelle.
- ✅ **ADN-Katalog statt nur Kalender** (11.08.2026). Der Abruf las nur `/video/calendar` — also
  nur, was in einem Zeitfenster **neu** erscheint. Serien, die vollständig im Angebot liegen,
  tauchten dort nie auf: Wir kannten **4** ADN-Titel, es sind **28**. Releases 125 → 149,
  Termine 486 → 853. Neu darunter: DAN DA DAN, Sword Art Online, Haikyu!!, Dragon Ball Super,
  Parasyte, Eyeshield 21. Läuft als eigener seltener Lauf (`npm run data:adn:catalog`) im
  Wochen-Workflow, nicht täglich — es sind rund 390 Einzelabfragen.
  *Drei Anläufe, drei ungeprüfte Zahlen:* (1) `limit=500` überschritt die API-Grenze von 100,
  jede Anfrage kam als `400` und lief in denselben Zweig wie ein `404` — Ergebnis „0 Serien",
  fehlerfrei gemeldet. (2) `total` meldet 580, das ist der **französische** Katalog; mit
  deutschem Regionskopf sind es 387, und die Schleife sammelte darüber hinaus Wiederholungen
  (12 Doubletten). Jetzt wird nach Kennung entdoppelt und bei Sättigung abgebrochen. (3) Die
  Vorab-Stichprobe zog aus den ersten 100 Einträgen und schätzte 19 Treffer — die Liste ist
  unsortiert, also war sie nicht repräsentativ.
  *Nachtrag am selben Tag — Zuordnung statt Verwerfen:* Die erste Fassung warf Titel weg, deren
  Anime-Zuordnung scheiterte, darunter acht One-Piece-Filme mit belegter deutscher Synchro.
  **Das war falsch** (Daniels Hinweis mit Screenshot der Wiedergabesprachen): Nicht der Ton war
  französisch, nur der Name. Jetzt schlägt der Katalog-Lauf die AniList-Kennung nach; beim
  Bauen gewinnt sie vor dem Namensabgleich. **35 statt 28 Titel**, kein französischer Name mehr.
  Der Abgleich scheitert an vier Dingen, daher eine Kaskade: der Zählung („Movie 3", die AniList
  nicht führt), Diakritika („Kyôkai"/„Kyoukai", „Haikyū"/„Haikyu"), der Schreibweise im Kern
  („Chinjuu Shima"/„Chinjuu-jima") und der Sprache des Originaltitels.
  *Zwei Fehlversuche dabei:* Eine Prüfung auf **Folgenzahl verwarf 10 korrekte** Zuordnungen —
  ADN bündelt Staffeln unter einer Serie („Haikyu!!" = 90 Folgen), AniList führt sie einzeln
  (25). Das Format taugt als Kriterium, die Folgenzahl nicht. Und die Kürzung auf den Namenskern
  rettet „Chopper Oukoku", trifft mit zwei Wörtern aber beliebiges: „no Bouken" fand „The
  Enchanted Journey". Ein Treffer muss jetzt ein Wort ab vier Zeichen mit dem ADN-Titel teilen;
  zwei One-Piece-Filme bleiben deshalb unzugeordnet — richtig so.
- ✅ **Gefälschte Browser-Kennung im ADN-Abruf entfernt** (11.08.2026). Dort stand seit jeher
  eine Chrome-Kennung — derselbe Fehler, der bei aniSearch die IP-Sperre einbrachte und danach
  als Lehre festgehalten wurde, ohne zu prüfen, wo er sonst noch im Code steckt. Mit ehrlicher
  Kennung antwortet dieselbe Schnittstelle mit 200; nötig war die Tarnung nie.

- ✅ **Deutsche Synchronsprecher im Detail-Panel** (11.08.2026). 1.746 von 2.753 Titeln haben
  eine Besetzung, zusammen **21.924 Rollen**. Quelle ist **AniList** — dieselbe Schnittstelle,
  die das Projekt seit Monaten abfragt. Der Umweg dorthin ist die eigentliche Lehre: Erst
  Deutsche Synchronkartei recherchiert (800.000 Einträge, saubere Rollentabellen), dafür eine
  Wikidata-Brücke über P4834/P3844 gebaut und gemessen (675 unserer Titel erreichbar) — und
  dann in deren rechtlichen Hinweisen gelesen: „Insbesondere ist ein automatisiertes Auslesen
  des Internetangebots nicht gestattet." Die robots.txt hätte grünes Licht gegeben, wo keines
  ist. synchrondatenbank.de veröffentlicht frei nur Synchronisationen, die über dreißig Jahre
  zurückliegen. **Regel für künftige Quellensuchen: erst die eigenen Quellen ausreizen.**
  *Architektur:* eine Datei je Titel (~640 B) unter `public/data/voices/`, geholt **erst beim
  Aufklappen** — live nachgeprüft, genau ein Abruf, ausgelöst durch den Klick. Der Erstaufruf
  bleibt bei 142 KB. Der Merker `hasVoices` sorgt dafür, dass der Bereich nur erscheint, wo es
  Stimmen gibt; `titles-core` bleibt trotzdem bei 27 KB gzip.
  *Beinahe durchgerutscht:* Die erste Fassung fragte deutsche und japanische Stimmen in einer
  Auswahl ab. AniList löst das gleichnamige Feld genau einmal auf — Liste gefüllt, Namen
  plausibel, nur hieß Henriettas „deutsche" Stimme Yuuka Nanri.

- ✅ **aniSearch-Seiten werden archiviert statt verworfen** (11.08.2026). Bisher wurden je Seite
  zwei Felder herausgelöst und 110 KB weggeworfen; die gebrauchte Folgenzahl stand auf jeder
  bereits geholten Seite und wäre nur über einen zweiten Lauf über 2.612 Seiten zu bekommen
  gewesen — vier Stunden Last auf einer fremden Redaktionsseite (Daniels Einwand: „besser zu
  viele Daten als zu wenig"). Jetzt liegen die inhaltlichen Abschnitte unter
  `data/anisearch-raw/` (~14 KB je Titel gepackt, 1,5 MB für die ersten 110). Forum,
  Kommentare, Rezensionen und Bearbeiterlisten bleiben draußen. Die Infobox wird vollständig
  gelesen: Folgenzahl mit Schätzungs-Markierung, Laufzeit, Studio, Staff mit Funktion,
  Sendeplatz, Synonyme sowie Titel, Status, Zeitraum und Publisher je Sprachfassung.
  **Live-Scraping beim Seitenaufruf wurde verworfen** — es macht aus einem Abruf je Titel und
  Woche einen je Besucher.
  *Sofort bezahlt gemacht:* Die erste Stichprobe fand einen Fehler im frischen Parser — die
  Folgenzahl wurde nur bei 3 % erkannt, weil eine Regex die Laufzeit traf statt der
  Folgenzahl. Reparatur über `data:anisearch:reparse` ohne einen einzigen neuen Abruf,
  Trefferquote 100 %. `data:anisearch:check` wacht seither auch über die Folgenzahl.
- ✅ **Folgenzahl von aniSearch statt geraten** (11.08.2026). Fehlte die Angabe bei AniList,
  wurden zwölf angesetzt. „Meine Wiedergeburt als Schleim" stand damit mit 16 statt 24 Folgen
  im Kalender. Kennzeichnet aniSearch die Zahl selbst als vorläufig, trägt sie weiter das ≈ —
  aber mit dem Hinweis, dass die Schätzung von dort stammt und nicht unsere eigene Annahme
  ist. Neues Feld `schedule.episodeCountSource`.

- ✅ **aniSearch-Bestand vollständig** (10.08.2026): alle 2.612 zuordenbaren Titel geholt, an
  einem Tag von 960 auf 2.612. Deutsche Beschreibungen von 2.041 auf **2.689 von 2.759**,
  Titel mit belegtem Bezugsweg von 498 auf **2.109**. Die letzten drei Läufe lief eine Kette,
  die nach jedem Durchgang im Repo nachzählte und nur bei Bedarf den nächsten anstieß

- ✅ **Discord-Bereich vervollständigt** (10.08.2026): Die Kategorie „🌐 Anime-Kalender DE" hatte
  nur `#info`. Jetzt mit `#news`, der Ping-Rolle „Anime-Kalender News" (erwähnbar, wie bei den
  anderen Projekten) und einem Webhook — beide in `my_secrets.md`. Erste Release-Meldung mit den
  Änderungen dieses Tages ist raus

- ✅ **Monitoring-Mails vom Newsletter unterscheidbar**: Beide kamen als „Anime-Kalender DE" an,
  obwohl die Erreichbarkeitsprüfung 19 Seiten aus allen Projekten überwacht — Daniel hielt die
  Wochenübersicht deshalb für den Newsletter. Absendername und Kopfzeile hängen jetzt an einer
  `BRAND`-Konstante: Newsletter „📺 Anime-Kalender DE", Prüfung „🛰️ Seiten-Wächter". Betreffe
  sagen jetzt, worum es geht („Störung: …", „Wochenbericht: …"), die Fußzeile schreibt
  „kein Newsletter". Adresse bleibt gleich, weil `send.anime-kalender.de` die einzige verifizierte
  Domain ist
- ✅ **DMARC-Berichte von Google ausgewertet** (07.–09.08.2026): drei Aggregatberichte, 9 Mails,
  DKIM (Resend und amazonses) und SPF durchgehend `pass`, ausschließlich Amazon-SES-IPs, kein
  fremder Absender. Kein Handlungsbedarf am Versand; offen ist nur, ob die Politik von `none`
  angehoben wird
- ✅ **Abmeldung Ende zu Ende geprüft** (10.08.2026), nicht nur die Seite, sondern die Wirkung in
  D1: Link aus der echten Digest-Mail → „Abgemeldet", Datensatz gelöscht (2 Abos → 1), das fremde
  Abo unberührt. Zweiter Aufruf desselben Links → „Nichts zu tun" statt Fehler. Neuanmeldung →
  Bestätigungsmail → „Abo aktiv", wieder 2 Abos, beide `active`, keins hängen geblieben.
  Nebenbefund: Der Wochen-Digest ging am selben Morgen raus, der wöchentliche Versand war bis
  dahin nie bestätigt
- ✅ **Geteilte Staffelstarts zählen durch**. Netflix brachte Steel Ball Run am 19.03.2026 als
  einzelne 47-Minuten-Folge und den Rest ein halbes Jahr später als „2nd & 3rd STAGE". Die
  Terminliste des zweiten Teils begann wieder bei „1. Fr 25.09.2026" und las sich damit wie der
  Termin der Auftaktfolge. Neues Feld `schedule.firstEpisodeNumber`: aus „Ep 1/11" wird „Ep 2/12",
  im Panel steht die Spanne „2–12" statt der nackten „11". Beide Hinweistexte sagen jetzt, welche
  Folge wann kommt
- ✅ **Specials werden nicht mehr zu zwölfteiligen Serien**. Der Kalender behauptete eine neue Folge
  von „I am a hero too"; es gibt genau eine, am 02.08.2026. Drei Fehler zusammen: ein einzelner
  Termin galt als Wochenserie (`Math.max(12, …)`), die Zuordnung lief über die Crunchyroll-Serien-ID
  (die alle Staffeln einer Reihe teilen — daher „Staffel 6"), und der Rückfall prüfte die
  Staffelnummer nicht („Schleim Staffel 4" hing an „Slime Season 3"). Vorher 9 Einträge mit
  geratener Folgenzahl und 3 ohne Titel, jetzt 2 und 1 — letzterer sind die Anime Awards
- ✅ **Nachtläufe gehen jetzt auch live**. Der Datenlauf committete nach `public/data` und pushte —
  aber ein Push aus einer Action mit dem `GITHUB_TOKEN` löst keine weiteren Workflows aus, und
  genau daran hing der Deploy. Seit dem Einrichten der Kaskade ging kein automatisch geholter
  Datensatz live, außer wenn zufällig ein Mensch am selben Tag etwas pushte. `deploy.yml` hört
  jetzt zusätzlich per `workflow_run` auf die drei Refresh-Workflows; mit einem Bot-Lauf verifiziert
- ✅ **aniSearch: ehrliche Kennung**. Der Abruf gab sich als Chrome aus. In deren Doku steht, dass
  fehlende oder generische Kennungen als Missbrauch gewertet werden und zur IP-Sperre führen — die
  Rate war also nicht der einzige Fehler. Jetzt `anime-kalender.de/1.0 (+URL; Mail)`, Kontingent
  200 je Lauf; erster Lauf 200 von 200 ohne Fehlschlag
- ✅ **Anbieter vollständig aus TMDB** (Datenbasis JustWatch — dieselbe Quelle, aus der werstreamt.es
  schöpft). Der Abruf fragte bisher nur flatrate und buy und behielt davon nur die Dienste mit
  eigener Plattform; Videobuster, maxdome, Apple TV, MagentaTV, Videoload, Sky Store, Rakuten und
  Akibapass wurden verworfen. Jetzt 291 Titel mit Bezugswegen
- ⚠️ **aniSearch-Sperre selbst verschuldet**: Scraper lief mit 60 Anfragen je Minute, dokumentiert
  sind 10. Jetzt 6 Sekunden Takt, 60 Titel je Lauf. Neue Immer-Regel: API-Doku vor dem ersten
  Abrufcode lesen

- ✅ **aniSearch als Quelle**: deutsche Inhaltsangaben (redaktionell, ausführlich) und Bezugsquellen
  auch für alte Katalogtitel. ID-Zuordnung über die anime-offline-database (ODbL), weil ein
  Titelvergleich „.hack//Quantum" und „.hack//Sign" nicht auseinanderhält
- ✅ **Hinweis bei Titeln ohne Termin** unterscheidet jetzt: erschienen (Datum fehlt nur bei uns)
  gegen wartend. Bezugswege stehen darunter, Streams vor Kauflinks, fremde Partner-Kennungen
  entfernt
- ✅ **Steel Ball Run** kuratiert: 1st STAGE seit 19.03.2026 auf Netflix, Fortsetzung ab 25.09.2026

- ✅ **Sendepausen verschieben alles Folgende**: Der Sendeplan hängt jetzt an Stützpunkten — jede
  Folge rechnet ab der jüngsten Beobachtung vor ihr weiter, nicht ab Folge 1. Eine Pause muss
  nirgends gepflegt werden, sie ergibt sich aus dem, was im Kalender stand. Folgen jenseits der
  letzten Beobachtung tragen das ≈: 220 von 555 Terminen sind belegt, der Rest ist Fortschreibung

- ✅ **Offline nutzbar ab dem ersten Besuch**: Der Worker liest beim Einrichten die Bündel-Adressen
  aus der ausgelieferten HTML (Hash-Namen, feste Liste wäre lautlos veraltet), holt die vier
  Datendateien vorab und legt die Cover der aktuellen und nächsten Woche ab. Seitenaufrufe haben
  drei Sekunden Zeitlimit — „kein Netz" heißt selten Fehler, meistens Hängen
- ✅ **Sendetermine über die Mehrheit ankern**: Ein einzelner Ausreißer (Skeleton Knight, Folge 1 an
  einem Samstag) hatte die ganze Staffel um zwei Tage verschoben. Jetzt bestimmt der häufigste
  Wochentag den Sendeplatz, und gesehene Einzeltermine schlagen jede Hochrechnung

- ✅ **Als App installierbar (PWA)**: Manifest, gezeichnete PNG-Symbole samt `maskable`-Fassung,
  Service Worker mit drei Strategien (Seiten aus dem Netz zuerst, gehashte Bündel aus dem Cache,
  Termine sofort aus dem Cache und im Hintergrund aufgefrischt). Auf dem Handy einmalig die Frage
  „installieren oder im Browser weiter", danach der Knopf in der Kopfzeile; auf iOS die Anleitung
  übers Teilen-Menü, weil Safari kein `beforeinstallprompt` kennt
- ✅ **Mobil auf heute**: Der Blick landet beim nächsten anstehenden Termin, 30px Vorlauf, einmal
  je Ankunft. Dazu zwei Farbfelder im heutigen Tag — vorbei grau, kommend blau
- ✅ **Bei Google angemeldet**: `sitemap.xml` (122 Adressen) und `robots.txt` entstehen jetzt im
  Build aus dem Datenbestand. Domain-Property in der Search Console über einen TXT-Eintrag in der
  INWX-Zone bestätigt, Sitemap eingereicht — Status „Erfolgreich", 122 Seiten erkannt
- ✅ Datenschutzerklärung: Der Abschnitt zur Erfolgsmessung beschrieb die Zeit der gemeinsam
  genutzten Absenderdomain. Seit dem Wechsel auf `send.anime-kalender.de` wird nicht mehr
  getrackt; der Text sagt das jetzt auch

- ✅ **Ausschluss-Filter**: Umschalter über den Tags; im Modus „Ausschließen" macht ein Klick aus
  einem Tag ein Verbot statt einer Auswahl (roter, durchgestrichener Chip). Ausschluss schlägt
  Einschluss, ein Wert kann nie beides sein. Steht in der Adresse als `xg=`, `xkw=` usw.
- ✅ **Titel ausblenden**: Auge neben dem Stern. Die Karte bleibt an ihrem Platz, zeigt aber nur
  den Namen — kein Bild, keine Tags, nicht anklickbar; auch das Detail-Panel bleibt zu.
  Verdeckt statt gefiltert, damit man sieht, dass da etwas ist
- ✅ **Notbremse im Build**: Der stündliche Workflow hatte `data:build` ohne `data:fetch`
  aufgerufen und damit einen Datensatz mit null Titeln veröffentlicht. Der Build bricht jetzt ab,
  wenn der Cache leer ist, und die drei Workflows teilen sich einen `actions/cache`

- ✅ Kuratierungsbericht abgearbeitet: 6 belegte Termine übernommen (Chihiro-Wiederaufführung,
  Yu-Gi-Oh-Komplettbox, Bocchi Vol. 1+2, Oshi no Ko S3 Vol. 1+2), 5 bestehende Termine mit einer
  zweiten Quelle belegt. Ohne belegte deutsche Fassung bleibt ein Titel draußen
- ✅ Uhrzeiten außerhalb von Crunchyroll geklärt: Nur Netflix macht dazu eine belastbare Aussage
  (Eigenproduktionen 00:00 Pacific, Lizenztitel Mitternacht Ortszeit) — Disney+ und Prime Video
  veröffentlichen keine. Statt eine Faustregel als Uhrzeit einzutragen, erklärt die Karte jetzt,
  warum dort nichts steht, mit Quellenlink

- ✅ **ADN als zweite maschinelle Quelle**: Die öffentliche JSON-Schnittstelle nennt je Folge
  Datum, Uhrzeit UND Sprachcode (`vde` = Synchro, `vostde` = nur Untertitel). Damit beantwortet
  sie von sich aus die Frage, für die es sonst keine maschinenlesbare Antwort gibt. 4 Serien
  mit deutscher Synchro gefunden, alle vorher nicht erfasst
- ✅ **Anime2You als Vorschlagsquelle**: drei RSS-Feeds, deutsche Datumserkennung, Abgleich gegen
  die `sources` der kuratierten Einträge. Erzeugt bewusst keine Termine, sondern die Liste
  „gemeldet, aber noch nicht erfasst" (`npm run data:report`) — 16 offene Meldungen beim ersten Lauf
- ✅ **Polling-Kaskade**: stündlich Crunchyroll, täglich alle Quellen, wöchentlich mit weitem
  Fenster. Alle drei teilen sich eine `concurrency`-Gruppe, committen nur bei echter Änderung
- ✅ **Wachhund gegen stumme Quellen**: `data/source-health.json` merkt sich je Quelle den letzten
  erfolgreichen Lauf; schweigt eine länger als vier Tage, wird der Workflow rot und GitHub mailt.
  Gegen den lautlosesten Fehler des Projekts — ein Scraper, der nach einem Seitenumbau einfach
  nichts mehr findet

- ✅ Teilbare Adresse ohne Umweg: sobald eine Karte offen ist, steht /r/<slug>/ in der
  Adressleiste (replaceState, kein Neuladen) — kopieren genügt, der Teilen-Knopf ist nur Beiwerk

- ✅ Newsletter-Mails verlinken: Titel → Teilen-Seite des Releases (mit Vorschaubild, springt in
  die Wochenansicht des Tages), Anbietername → Serie beim Streamingdienst bzw. Kaufseite
- ✅ Unbelegte Crunchyroll-Termine verwerfen: liegt ein behaupteter Start im abgesuchten
  Kalenderfenster, hat dort aber keine deutsche Folge, fällt der Termin raus

- ✅ Quellen- und Tool-Recherche (`docs/recherche-quellen.md`)
- ✅ Plan mit Datenmodell und Story Points (`docs/plan.md`)
- ✅ Scaffold: Vite + React + TS + Tailwind v4, Pfad-Aliase, Typecheck grün
- ✅ Datenpipeline: MyDubList (3.080 MAL-IDs) → AniList (2.977 aufgelöst) → 2.751 Titel nach
  Adult-Filter; TMDB für FSK und DE-Anbieter
- ✅ Kuratierter Seed: 13 Simuldubs Sommer 2026 + 37 Disc-Releases August 2026 = 50 Releases,
  197 Einzeltermine
- ✅ AniList-IDs der Fortsetzungen von Hand korrigiert (Suche traf mehrfach die falsche Staffel)
- ✅ Wochen-, Monats-, Agenda- und Datenbank-Ansicht
- ✅ Filter für Plattform, Release-Art, Status, FSK, Jahr, Genre, Keywords + Volltextsuche,
  Zustand in der URL
- ✅ Detail-Panel mit Terminliste, Deeplinks, Kauflinks, Quellenangabe
- ✅ Google-Calendar-Links, ICS-Einzeldownload, ICS-Abo-Feeds (gesamt/Plattform/Genre)
- ✅ Newsletter-Worker: Double-Opt-in, D1-Schema, stündlicher Cron mit Berlin-Prüfung,
  Resend-/Brevo-Adapter, Mail-Templates
- ✅ GitHub Actions: Pages-Deploy + nächtliche Datenaktualisierung
- ✅ TMDB-API-Key besorgt und in `my_secrets.md` hinterlegt
- ✅ Repo `danielzaiser91/anime-kalender-de` (public) angelegt, Pages auf Actions-Quelle
  gestellt, Secret `TMDB_API_KEY` und Variable `SITE_URL` gesetzt, Deploy grün
- ✅ **Crunchyroll-Sendezeiten**: Der Simulcast-Kalender ist mit `filter=premium` öffentlich
  lesbar (kein Login, kein Abo) und markiert deutsche Synchro-Folgen mit „(Deutsch)". Playwright
  nötig, weil die Seite ihre Kacheln per JS baut. 25 Titel mit belegter Uhrzeit, 16 davon
  vorher gar nicht erfasst
- ✅ Favoriten (lokal), Sprachumschalter DE/EN, Staffel-Bündelung über AniList-Beziehungen,
  Status „Erschienen", Trennung nach Uhrzeit, 58 Genres statt 18
- ✅ **Link-Vorschaubilder**: 1200×630 je Release aus den Daten gerendert (SVG über sharp),
  echte Teilen-Seiten unter `/r/<slug>/` — Hash-Routen können prinzipbedingt keine eigene
  Vorschau tragen. Teilen-Knöpfe auf Kacheln, Karten und im Detail-Panel. Muster als globaler
  Skill `link-vorschaubilder` festgehalten
- ✅ Sprachwahl mit gezeichneten SVG-Flaggen statt Emoji (Windows rendert Regional-Indicator
  nur als Buchstaben)
- ✅ Impressum und Datenschutzerklärung ausformuliert (Kontakt per E-Mail, ohne Anschrift —
  bewusste Entscheidung des Betreibers für ein privates, nicht kommerzielles Angebot)
- ✅ **Newsletter live**: Worker unter `newsletter.animekalender.workers.dev`, D1-Datenbank
  `anime-kalender` in Westeuropa, stündlicher Cron, Versand über Resend. Ende-zu-Ende getestet:
  Anmeldung → Bestätigungsmail → Bestätigung → Tages-Digest mit 17 Terminen verschickt.
  GitHub-Variable `NEWSLETTER_API_URL` gesetzt, Formular auf der Live-Seite verbunden.
  Brevo fiel aus — deren Registrierung war defekt.
- ✅ **Eigene Domain `anime-kalender.de`** bei INWX registriert. DNS-Zone per API gesetzt
  (`tools/inwx-dns.mjs`, idempotent): GitHub Pages A/AAAA, www-CNAME, drei Resend-Einträge,
  DMARC. Die drei INWX-Parkeinträge mussten weichen, sonst hätte sich jeder Aufruf zufällig
  zwischen Seite und Platzhalter entschieden
- ✅ **Absenderdomain `send.anime-kalender.de` verifiziert**, Öffnungs- und Klick-Tracking von
  Anfang an abgeschaltet. Absender jetzt `kalender@send.anime-kalender.de`
- ✅ Deutsche Handlungsbeschreibungen von TMDB für 1.453 von 2.751 Titeln, mit Jahres- und
  Titelabgleich gegen Fehlzuordnung; englischer Rückfall mit Hinweis. FSK für 942 Titel
- ✅ **Favoriten im Newsletter**: eigener Block „★ Deine Favoriten" über den übrigen Terminen,
  Betreff nennt sie zuerst. Favoriten werden bei der Anmeldung mitgeschickt und in D1 gespiegelt;
  ein Abgleich-Link mit eigenem Token in jeder Mail hält sie aktuell
- ✅ **HTTPS für anime-kalender.de**. Das Zertifikat war über eine Stunde lang nie beantragt worden:
  Beim Setzen der Domain per API fehlte das Feld `https_certificate` vollständig. Auslöser ist das
  **erneute** Setzen — einmal entfernen und neu setzen, dann war es in einer Minute da. In
  `ai_agent_learnings.md` unter „GitHub Pages / CI-Deploy" festgehalten
- ✅ **Erreichbarkeitsprüfung für 19 Seiten** im selben Worker: stündlich, höchstens eine
  Störungsmail pro Tag, montags eine Wochenübersicht als Lebensnachweis. Liste per
  Pages-Schnittstelle aus allen 32 Repos ermittelt statt aus READMEs. Der Dienst überwacht
  sich bewusst **nicht** selbst
- ✅ Prime-Video-Links laufen über amazon.de. Die ASIN ist **nicht** marktübergreifend gleich —
  das Umschreiben von `amazon.com` auf `amazon.de` führte zuverlässig auf eine Fehlerseite


## Amazon nennt Tonspur und Abo-Bedingung selbst (23.08.2026, gemessen)

Anlass: Daniels Frage, ob der Grund für das Kauf-Symbol strukturiert in der Seite steht.
Gemessen an *Naruto Shippuden* (`B0CWDYLZ1S`), drei Staffeln einzeln abgerufen, **ohne Anmeldung**.

### Was in der Seite steht

| Feld | Wert im Beispiel | Taugt wofür |
|---|---|---|
| `audioTracks` **je Folge** | `["Deutsch","日本語"]` | Synchro-Beleg, feiner als alles bisherige |
| `benefitId` je Staffel | `Prime`, `aniversede`, `crunchyrollde` | Zugangsart (Abo / welches Abo) |
| `cast` | Tobias Pippig, Henning Nöhren | deutsche Sprecher = zweiter Synchro-Beleg |
| `studios`, `categorizedGenres`, `releaseYear`, `episodeNumber`, `subtitles` | Pierrot Co., Action/Anime/Abenteuer | Stammdaten-Abgleich |
| `seasonLink` / `seasonId` | alle 9 Staffeln im Quelltext der Serienseite | Staffel-Adressen ohne Raten |

### Der entscheidende Befund

**`benefitId` ist kontounabhängig, `entitlementType` nicht.** `benefitId` sagt, *welches Abo
nötig ist*; `entitlementType` sagt, *ob dieses Konto es hat* — anonym steht dort bei allen
Staffeln „Unentitled", auch bei denen, die Daniel im Prime-Abo sieht. Gelesen wird also
ausschließlich `benefitId`.

Messung, die Daniels Beobachtung bestätigt:

```
Staffel 1 (B0CWDYLZ1S)  Prime, aniversede, crunchyrollde   20/20 Folgen mit Deutsch
Staffel 4 (B0FBJWV6MJ)  aniversede                         24/24 Folgen mit Deutsch  ← kein Prime, daher das Schloss
Staffel 9 (B07VP6VPVR)  Prime, aniversede                  13/13 Folgen mit Deutsch
```

Damit wird die frühere Einschätzung „Zugangsart anonym nicht messbar" **zurückgenommen**. Sie
galt für `entitlementType` und wurde fälschlich auf die ganze Frage übertragen.

### Folgenschärfe

Amazon meldet einzelne Folgen ehrlich als nur-japanisch (S1F3 „Neue Teams, alte Feinde",
S4F5 „Die drei Tabus des Shinobi"). Diese Auflösung hat sonst keine Quelle im Projekt.

### Grenze: ein Abruf je Staffel

Die Serienseite trägt nur die Angebote der **geladenen** Staffel. `benefitId` je Staffel
verlangt daher `?ref_=atv_dp_season_select_sN` einzeln. Die Staffel-Adressen selbst stehen
vollständig im Quelltext der Serienseite — kein Raten nötig.

### Umfang eines Laufs (gemessen an `data/anisearch.json`)

- 1.073 Titel mit Amazon-Verweis, 1.195 verschiedene Adressen
- davon **1.181 in der Form `/dp/`** — die ist mehrdeutig: Video **oder** Disc. Genau diese
  Trennung ist der erste Zweck des Laufs.
- nur 14 sind bereits eindeutig `/gp/video/detail/`
- Staffel-Abrufe kommen obendrauf, erst nach Schritt 1 bezifferbar

### Rechtslage — geprüft am 23.08.2026, und sie verbietet den Lauf

**`robots.txt` allein wäre kein Hindernis.** Kein pauschales `Disallow: /` für `*`; gesperrt
sind Kontofunktionen (`/gp/video/library`, `/watchlist`, `/mystuff`, `/profiles`, `/search`,
`/auth`, `/api`), nicht die Detailseiten. `/gp/video/detail/` und `/dp/` kommen als Sperre
nicht vor, ein `Crawl-delay` fehlt. **Aber:** 100 KI-Bots sind einzeln mit `Disallow: /`
aufgeführt (Bytespider, AI2Bot, Andibot …) — die Absicht ist unmissverständlich, auch wenn
unser Abrufer namentlich nicht dabei wäre.

**Die Nutzungsbedingungen entscheiden die Frage — dagegen.** Wortlaut von
[amazon.de, nodeId=508088](https://www.amazon.de/gp/help/customer/display.html?nodeId=508088):

> „Insbesondere dürfen Sie ohne die ausdrückliche schriftliche Zustimmung von Amazon.de kein
> Data Mining, keine Robots oder ähnliche Datensammel- und Extraktionsprogramme einsetzen, um
> irgendwelche wesentlichen Teile eines Amazon Services zur Wiederverwendung zu extrahieren
> (gleichgültig ob einmalig oder mehrfach). Sie dürfen ferner ohne die ausdrückliche
> schriftliche Zustimmung von Amazon.de keine eigene Datenbank herstellen […]"

**Nachtrag 23.08.2026, 02:10 — die erste Bewertung war zu grob.** Daniels Einwand: „wir bieten
lediglich einen link zu amazon an […] wir helfen amazon mehr kunden zu bekommen". Der Einwand
trägt weiter, als die erste Lesart zuließ:

- **„Wiederverwendung" ist ein Fachbegriff** (§ 87b UrhG, RL 96/9/EG): „jede Form der
  öffentlichen Verfügbarmachung". Unsere Anzeige „läuft auf Prime, deutsch" fällt darunter —
  insoweit greift die Klausel dem Wortlaut nach.
- **Geschützt sind aber nur *wesentliche* Teile.** 1.195 Wahrheitswerte über Tonspuren sind
  weder quantitativ noch qualitativ ein wesentlicher Teil eines Katalogs mit Millionen Artikeln.
- **BGH „Paperboy" (I ZR 259/00, 2003)** hat den Fall im Kern entschieden: Ein Suchdienst, der
  tief verlinkt und Fundstellen anzeigt, greift das Angebot nicht an, sondern erleichtert den
  Zugang. Das ist wörtlich unsere Lage.
- **Der Auffangtatbestand** (§ 87b Abs. 1 S. 2, wiederholte Entnahme unwesentlicher Teile)
  verlangt, dass die Nutzung „der normalen Auswertung zuwiderläuft". Kunden zu Amazon zu
  schicken tut das Gegenteil.

**Was trotzdem gegen den Lauf spricht:**

- **AGB wirken unabhängig vom Datenbankrecht** — EuGH Ryanair/PR Aviation (C-30/14, 2015): Ein
  Betreiber darf vertraglich mehr verbieten, als das Gesetz hergibt. Ob Amazons AGB gegenüber
  einem Abrufer ohne Konto wirksam einbezogen sind (§ 305 BGB), ist bestreitbar — aber das
  klärt ein Gericht, nicht wir vorher.
- **Das reale Risiko ist die Sperre, nicht die Klage.** Mehrere tausend Abrufe von einer IP
  lösen Amazons Bot-Erkennung aus. In diesem Projekt ist das schon einmal passiert und traf
  auch Daniels eigenen Zugang.

**Entscheidung: Der Lauf findet trotzdem nicht statt** — nicht weil er sicher unzulässig wäre,
sondern weil der Weg über die Erweiterung ohne diese Frage auskommt **und bessere Daten
liefert** (Staffel-Ebene statt Titel-Ebene, weil eine geöffnete Seite ohnehin alles ausliefert).

**Offener Prüfpunkt: Amazon PartnerNet.** Die Verweise in `data/anisearch.json` tragen
`tag=anisearch.de-21` — aniSearch ist Amazon-Partner und hat damit Zugang zur Product
Advertising API. Ob die auch Prime-Video-Tonspuren führt, ist ungeprüft; wäre sie es, gäbe es
eine ausdrücklich erlaubte Schnittstelle statt der Grauzone.

### Zweiter Nachtrag 23.08.2026, 02:15 — die maßgebliche Klausel steht in Abschnitt 5, nicht 3

Daniels Frage: „ich weiß ja nicht ob das tatsächlich geistiges eigentum von amazon ist, ob eine
folge deutsch ist oder nicht […] wie könnten sie anspruch auf einzelne wörter haben".

**Bei der Eigentumsfrage hat er recht — die Angabe ist nicht schutzfähig:**

- **Urheberrecht:** § 2 Abs. 2 UrhG verlangt persönliche geistige Schöpfung. „Deutsch, 日本語"
  hat keine Gestaltungshöhe. EuGH *Infopaq* (C-5/08) lässt schon elf Wörter genügen, aber nur
  wenn sie eigene geistige Schöpfung ausdrücken — bei einer Sprachliste ausgeschlossen.
- **Datenbankrecht:** § 87b schützt erst *wesentliche* Teile; einzelne Fakten zu entnehmen ist
  erlaubt.
- **EuGH *British Horseracing Board* (C-203/02):** Der Schutz gilt der Investition in die
  **Beschaffung** vorhandener Daten, nicht in deren **Erzeugung**. Amazons Katalogangaben
  entstehen als Nebenprodukt des eigenen Geschäfts.
- Die Tatsache selbst steht im Abspann und auf der Hülle — sie gehört Amazon ohnehin nicht.

Auch das Schutzziel stützt seine Lesart: Abschnitt 3 nennt als Beispiel „**unsere Preise und
Produktinformationen**", an anderer Stelle „zugunsten eines anderen Händlers" — die Klausel
zielt auf Preis-Scraping durch Wettbewerber.

**Die operative Schranke steht aber in Abschnitt 5 „Lizenz und Zugang", und die ist schärfer:**

> „gewähren Ihnen Amazon und seine Anbieter von Inhalten eine beschränkte […] Lizenz für den
> Zugriff und die nicht-kommerzielle Nutzung der Amazon Services. Diese Lizenz beinhaltet nicht
> […] eine **Erfassung und Nutzung von Produktinformationen**, Beschreibungen oder Preisen […]
> oder (mit Ausnahme der Verwendung durch Forscher oder zuständige Behörden […]) die Nutzung
> von **Data-Mining, Robotern** oder ähnlichen Datenerfassungs- und Extraktions-Programmen."

Hier fehlt die Wesentlichkeitsschwelle, und es geht nicht um Eigentum, sondern um den **Umfang
der Zugriffserlaubnis**. Eine solche Zugangsbedingung kann auch Gemeinfreies erfassen — EuGH
*Ryanair/PR Aviation* (C-30/14).

**Ergebnis:** Kein geistiges Eigentum, aber trotzdem keine Lizenz für einen Bot-Lauf. Die
Erweiterung umgeht beides: Ein Mensch, der eine Seite ansieht, nutzt die Lizenz
bestimmungsgemäß — kein Roboter, kein Data Mining.

Nicht betroffen: die drei Handabrufe vom 23.08.2026, mit denen der Befund oben gemessen wurde.
Drei angesehene Seiten sind kein systematisches Extrahieren wesentlicher Teile.

### Der gangbare Weg: derselbe wie bei Netflix

Was ein Bot nicht darf, darf ein Mensch, der die Seite ohnehin ansieht. Für Netflix
(`robots.txt: Disallow: /`) steht dieser Weg längst: Die Chrome-Erweiterung liest mit, während
Daniel die Seite offen hat, und meldet den Befund. Amazon ließe sich mit derselben Mechanik
bedienen — die Felder sind bekannt (`audioTracks`, `benefitId`), sie stehen in der geladenen
Seite, und die Erweiterung liest bereits Netzwerkantworten mit.

Vorteil gegenüber Netflix: Amazon nennt die Tonspur **je Folge** und das nötige Abo **je
Staffel** — ein einziger Seitenaufruf trägt also deutlich mehr als bei Netflix, wo Daniel je
Folge klicken muss.
