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

## Umsetzung

**Stufe 1 — umgesetzt am 22.09.2026 (Worker 47bfb526 + Erweiterung 4.21.0).**
- `pruefung` hat `vorhanden` / `ton_de` / `art` (Migration 034), `prime_folge` hat `vorhanden` / `ton_de`
  (Migration 035). Der Worker leitet `befund` für den heutigen Einleser daraus ab; eine alte Meldung
  bekommt die Felder abgeleitet (`ANGENOMMEN` in der Notiz → `art: angenommen`). `vorhanden: ja` mit
  `ton_de: unbekannt` weist er als Störung ab (400).
- Netflix: Die Randprobe meldet ihre zwei abgespielten Folgen `gemessen`, den Rest `angenommen`.
- Disney+: jede Folge einzeln abgefragt, immer `gemessen`.
- Prime: Die Staffelmeldung bleibt, aber jede Rohfolge trägt `vorhanden` und `ton_de`. **Gesperrte
  Folgen gehen jetzt mit** (`vorhanden: nein`); bis 4.20 fielen sie weg. `?rohfolgen=1` lässt sie aus,
  bis Stufe 2 den Zuordner ersetzt. Eine eigene Briefkasten-Zeile je Prime-Folge braucht es nicht:
  `prime_folge` ist bereits die Beobachtung je Folge.
- Live gemessen mit Testmeldungen an `example.invalid` (alt, neu, weg, Störung, Prime mit gesperrter
  Folge); Testzeilen gelöscht.
- **Befristet:** `befund` annehmen und ableiten entfällt, sobald Stufe 2 den Einleser ersetzt und keine
  Erweiterung unter 4.21.0 mehr meldet.

**Stufe 2 — erster Schnitt gebaut am 22.09.2026, der Bau liest ihn noch nicht.** `pipeline/lib/folgen-je-folge.ts`
(`ordneFolgenZu`) ordnet jede Beobachtung je Plattform-Folge zu, `pipeline/fetch-folgen-zuordnung.ts`
(`npm run data:folgen-zuordnung`, Schritt im Bestandslauf) holt alle Zeilen über `?rohfolgen=1&alle=1`
und schreibt `data/folgen-zuordnung.json`: je `plattform:kennung` Titel, Folge, Grund, bei offen die
Kandidaten. Frühere Zuordnungen bleiben stehen, wenn ein Lauf keinen Titel mehr findet. Erster Stand:
5.271 Folgen, 2.471 mit Titel und Folge, 1.478 nur Titel, 341 offen, 980 ohne Kandidat, 1 strittig.
`check:logic` stellt Yamada-kun (zwei Adressen), Vinland Saga (Anker schlägt Auftrag), das Festhalten und
die Suchadresse nach.

**Zweiter Schnitt, gleicher Abend: Namen und Reihe.** Trifft kein Anker, kommen die übrigen Titel der
Reihe dazu (`franchiseId`), dazu der Serienname aus der Meldung derselben Adresse (`?rohfolgen=1&namen=1`)
und der Suchbegriff eines Suchauftrags — jeweils ganze Reihe, der Anker entscheidet die Staffel. Dazu
führt `folgenKern()` „ō" auf „o" zurück (Prime „Tōtsuki", aniSearch „Totsuki"). Stand: **3.423 mit Titel
und Folge (65 %)**, 1.303 nur Titel, 390 offen, 153 ohne Kandidat, 2 strittig. Stichprobe: Food Wars
B0CK66ZZ8G (Meldung „Food Wars!", keine Adresse im Bestand) verteilt sich 11 + 11 auf Third Plate und
Totsuki Train, 2 offen; Schneeprinzessin B0FVLKDZQ5 12 von 13; Digimon Frontier (Suchauftrag) 42 von 50;
Chibi Maruko-chan 52 von 52; Captain Tsubasa B0GXPFJJZK 12 auf 2018 (F25–52), 38 auf Junior Youth.
Werkzeug für solche Stichproben: `tools/poc-urteil/stichprobe-adresse.ts <export> <adressteil> …`.

**Dritter Schnitt: ein Name darf den Titel beginnen.** Die Meldung nennt „Hell Mode", der Bestand
„Hell Mode: The Hardcore Gamer …"; „Das Dschungelbuch" gegen „Das Dschungelbuch: Die Serie"; bei
Pokémon den Staffelnamen. Beginnt ein Name genau einen Titel, zählt er (ab sechs Zeichen, bei
mehreren Treffern nein). Stand: **3.551 mit Titel und Folge (67 %)**, 1.324 nur Titel, 393 offen,
3 strittig, **0 ohne Kandidat**. Stichprobe: Hell Mode 21 Folgen auf 185262, Dschungelbuch Staffel 2
auf F27–50 von 2569, Pokémon Ultra-Abenteuer auf F133–146 von 97634.

**Was offen bleibt (393), ist ein Muster:** Reihen, deren Folgentitel in keinem Anker stehen —
Higurashi (42), JoJo (63), Bungo Stray Dogs (24), Dr. STONE (24), Haikyu!! (59), KonoSuba (22),
Cardcaptor Sakura (21), Detektiv Conan (15). Dort fehlen die deutschen Folgentitel bei aniSearch und
TMDB, oder Prime schneidet die Staffel anders. Das ist kein Zuordnungsfehler, sondern eine Lücke in
den Ankern — und sie entscheidet sich erst in Stufe 3, wo sich zeigt, ob eine Folge ohne Nummer die
Anzeige überhaupt stört.

**Stufe 3, Urteil je Folge (22.09.2026, `tools/poc-urteil/urteil-folge.ts`, schreibt nichts):** Quellen sind
die Rohfolgen über `data/folgen-zuordnung.json` und die Meldungen mit Folgennummer; je (Titel, Anbieter,
Folge) gilt die jüngste, am selben Tag gemessen vor angenommen. Ergebnis: **3.356 Urteile je Folge**,
verglichen mit `dubRanges` bzw. `dub` des heutigen Datensatzes — **2.794 gleich, 167 abweichend**, der
Rest ohne Weg dieses Anbieters (395) oder heute unbekannt (59).

**Die Abweichungen sind vollständig erklärt:** **146 von 167 sind Kanal-Seiten** (Yu-Gi-Oh! 5D's 42,
JoJo Golden Wind 37, We Never Learn 13, Captain Tsubasa 7, Slime 3, …) — leere Tonspuren ohne Kanal-Abo,
im Modell „unbekannt + Prüfliste mit Abo prüfen", nicht „kein Deutsch". Die übrigen **21 sind Fairy Tail**,
wo die Meldung vom 22.09.2026 absichtlich noch nicht im Bestand steht. **Keine einzige ungeklärte
Abweichung.**

Zwei Dinge hat erst die Einzelliste gezeigt (`--einzeln`): Das Kanal-Merkmal muss an der **Meldung**
hängen, nicht nur an der Rohfolge — bei Captain Tsubasa, Haikyu!!, Slime und Trapped in a Dating Sim
stammte das Nein aus `pruefung`, während die Rohfolge leere Tonspuren trug und ohnehin als Störung
ausschied. Und eine Rohfolge ohne Tonspuren ist keine Beobachtung, sondern eine Störung (Szenario 10).

**Stufe 3 — im Bau seit dem 22.09.2026, der Datensatz liest sie noch nicht.** `pipeline/lib/urteil-je-folge.ts`
(`urteileJeFolge`, reine Funktion) und `pipeline/fetch-urteile.ts` (`npm run data:urteile`, Schritt im
Bestandslauf) schreiben `data/urteile.json`: je `titel|anbieter|folge` das Urteil, seine Art und sein Tag,
bei Kanal-Nein der Grund `kanal-ohne-abo`. Quellen sind alle Beobachtungen aus D1 — Rohfolgen über die
Zuordnung aus Stufe 2 und Meldungen mit Folgennummer (Worker `?alle=1`, ausgeliefert 0f9ba244). Erster
Stand: **3.228 Urteile aus 7.893 Beobachtungen — 2.784 deutsch, 408 unbekannt (Kanal ohne Abo), 36 kein
Deutsch.** `check:logic` hält Kanal-Nein, die jüngste Beobachtung, gemessen vor Randprobe und „gesperrt
heißt nicht verfügbar" fest.

**Als Nächstes in Stufe 3/4:** die Pill-Achse (welcher Verweis gehört zur Folge), die Nachprüfliste aus
`unbekannt` und Widersprüchen, und dann der Bau, der `dub` aus den Urteilen setzt statt an 26 Stellen. **Offen in Stufe 2:** die Pill-Achse (welcher Verweis), eine Liste für die offenen
Folgen zum Nachprüfen, Detektiv Conan ohne Kandidat.

**Schlüssel ist die Folgenkennung der Plattform, nicht die gemeldete Adresse** (22.09.2026). Yamada-kun
(20966) kam zweimal an, einmal über `watch.amazon.de/detail?gti=…`, einmal über
`amazon.de/gp/video/detail/B0H16J2S3P`. Das ergab 24 `prime_folge`-Zeilen mit denselben zwölf Folgen-ASINs.
`fetch-rohfolgen.ts` gruppiert heute je Adresse und führt dieselbe Staffel so zweimal. Stufe 2 fasst über
`asin` (Prime) bzw. `gti` (Netflix/Disney+) zusammen, und die jüngste Beobachtung gewinnt.

**Gemessen an allen `prime_folge`-Zeilen (22.09.2026, 10.976 Zeilen):** 5.271 verschiedene Plattform-Folgen,
930 davon mehrfach gemeldet, 798 unter mehreren Adressen. Eine Folgennummer widerspricht sich nie, die
Anbieter-Staffelnummer 410-mal. 39 Folgen tragen **zwei verschiedene `titel_id`**, und zwar in vier Fällen:
„Is This a Zombie?“ (8841) und „…of the Dead“ (10790), Hamatora (20711) und Re:␣Hamatora (21003), zwei
gti-Seiten (102060/113653), jeweils über Suchaufträge auf derselben Prime-Seite; dazu bei Netflix dieselbe
Folgenkennung unter 80193163 und 81499847 (97986/135806). **Folgerung:** Die `titel_id` einer Meldung
beschreibt den Auftrag, nicht die Folge. Die Zuordnung je Folge entscheidet über Anker (Folgentitel,
Nummer gegen Folgenzahl), `titel_id` ist nur ein Kandidat. Widersprechen sich zwei Kandidaten ohne
entscheidenden Anker, bleibt die Folge unzugeordnet (Szenario 11).

**Stufe 2, dritter Schnitt (22.09.2026), je Plattform-Folge** (`tools/poc-urteil/zuordnung-folge.ts`,
schreibt nichts): Kandidaten = alle `titel_id` der Folge + Titel mit Weg zur Adresse + frühere Zuordnung
(`prime-zugeordnet.json`, `dub-confirmed.yaml`); je Kandidat `ordneZu` gegen aniSearch- bzw. TMDB-Anker.
Von 5.271 Folgen: **47 % eindeutig** (2.471), 28 % nur dem Titel zuzuordnen (1.478, ein Kandidat, kein
Anker trifft — Folgennummer offen), 6 % offen (341, mehrere Kandidaten, kein Anker: JoJo, Dr. STONE,
KonoSuba 1/2, Haikyu!!, Captain Tsubasa, Edens Zero/Clannad), 19 % ohne Kandidat (980, vor allem Detektiv
Conan an Adressen, die nicht mehr im Datensatz stehen), 1 strittig. Zwei Messfehler des ersten Laufs,
beide Adresskerne: Amazon-Suchadressen fielen auf „amazon.de/s" zusammen, `watch.amazon.de/detail?gti=…`
verlor die gti — beide sammelten Dutzende fremde Titel als Kandidaten. **Der Adresskern muss die gti
behalten und Suchadressen verwerfen**, auch im späteren Bau.

**Gegenprobe (22.09.2026):** Von den 2.471 eindeutigen Folgen stimmen 1.497 mit dem Auftrag überein, 801
hatten keinen, **173 widersprechen ihm**, alle an Staffelgrenzen (Captain Tsubasa 2018 ↔ Junior Youth,
Vinland Saga → Staffel 2, JoJo Diamond Is Unbreakable → Teil 1/2, Classroom of the Elite, Fruits Basket
→ Staffel 3, Saekano, Danganronpa 3, Takagi-san, KonoSuba, Haikyu!!). Stichprobe an fünf Paaren: In jedem
Fall trifft der Folgentitel wörtlich die Folge der **anderen** Staffel, und die Prime-Seite führt diese
Staffel (Vinland Saga `B0C55SJB1W` „Sklaven", „Ketils Hof" = Staffel 2 F1–2; Fruits Basket `B0GDFC7BL6` =
Staffel 3; Captain Tsubasa `B0GXPFJJZK` Nr. 53 „A New Challenge" = Junior Youth F1). Bei JoJo und
Captain Tsubasa Junior Youth lief der Auftrag über eine Suchadresse, die auf die falsche Staffel führte.
**Der Anker schlägt den Auftrag.** Im Bestand stehen diese Seiten bereits richtig, aber nicht von selbst:
`prime-zugeordnet.json` führt B0C55SJB1W unter 136430 und B0GDFC7BL6 unter 124194 (Fruits Basket am
16.09.2026 von Hand umgehängt), B0GXPFJJZK dagegen noch unter 100745; die Belege dazu hat eine
Handzuordnung vom 15.09.2026 auf 163024 berichtigt. Der Anker je Folge hätte alle drei ohne Handarbeit
richtig gesetzt.

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
| 1 | Synchro kommt später: früher „kein Deutsch" gemessen, jetzt sagt eine Quelle „Deutsch" | Kill Blue | **festgelegt 22.09.2026**, siehe unten |
| 2 | Synchro oder Titel verschwindet: früher „Deutsch", jetzt „kein Deutsch" / „nicht verfügbar" | Lizenzende | **festgelegt 22.09.2026**, siehe unten |
| 3 | Schwache Quelle widerspricht starker zur selben Zeit | MOTN gegen Meldung | **festgelegt 22.09.2026**, siehe unten |
| 4 | Kanal-Nein: Kanal-Seite ohne Abo zeigt kein Deutsch, andere Quelle Deutsch | A Silent Voice | **festgelegt 22.09.2026** |
| 5 | Angenommen (Randprobe) gegen gemessen (Einzelfolge) | — | offen |
| 6 | Zwei Ausgaben beim selben Anbieter mit verschiedenem Stand | Digimon Tamers | **Anzeige festgelegt 22.09.2026** |
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

**Ergänzungen (Daniel, 22.09.2026):**
- **Die Nachprüfliste nennt ihren Grund:** Quelle, deren Aussage, eigene Aussage mit Datum, Art
  (Wechsel/Erstaussage), seit wann, bisherige Trefferquote der Quelle.
- **Startgewicht Crunchyroll-Lauf: 90** — direkt unter der eigenen Messung, über ADN (80) und Randprobe
  (70). „vertraue ich unserem Crunchyroll Lauf sehr viel mehr als den anderen Quellen."
- **Szenario 1 bestätigt** in der Fassung: eigene neue Messung, Randprobe, ADN, Crunchyroll → Deutsch
  (+ Nachprüfung, außer bei eigener Messung); MOTN → Wechsel: Deutsch, Erstaussage: ≈ Deutsch;
  JustWatch/aniSearch → Wechsel: ≈ Deutsch, Erstaussage: bleibt „kein Deutsch"; jede Abweichung von der
  eigenen Messung auf die Nachprüfliste und ins Protokoll.

## Szenario 2 — festgelegt (Daniel, 22.09.2026)

Vorher „Deutsch" gemessen, jetzt sagt eine Quelle „kein Deutsch" / „nicht verfügbar":

| Quelle | Verhalten |
|---|---|
| eigene neue Messung | übernommen |
| Crunchyroll-Lauf, ADN | **übernommen + Nachprüfung** |
| Linkprüfung 404 — **nur wenn vorher 200** | **übernommen + Nachprüfung** |
| alle anderen (MOTN, JustWatch, aniSearch, Kanal-Nein …) | **nicht übernommen + Nachprüfung** |

„Nicht mehr abrufbar" bleibt als Angabe im Bestand; die durchgestrichenen Pills dazu entfallen in der
Oberfläche vorerst („war nette idee, aber brauchen wir vorerst nicht").

## Gewichte sind Handarbeit, keine Automatik (Daniel, 22.09.2026)

Die Tabellen je Szenario legen fest, **welcher Quelle in welchem Fall vertraut wird** — von Hand.
Es gibt **keine** Gewichtslogik, die sich selbst verschiebt. Die Trefferquoten aus den Nachprüfungen
werden **wöchentlich** ausgewertet; danach entscheidet Daniel, ob eine Quelle in einem Szenario mehr
Vertrauen bekommt, und die Tabelle wird geändert. Die Zahlen oben (100, 95, 90 …) sind damit nur noch
eine Rangfolge zur Orientierung.

## Szenario 3 — festgelegt (Daniel, 22.09.2026)

Zwei frische Aussagen widersprechen sich, **weniger als 3 Tage** auseinander (darüber gelten
Szenario 1 oder 2): Anzeige bleibt bei der stärkeren (eigene Messung), Nachprüfung mit Vermerk
„Widerspruch zur selben Zeit" und beiden Aussagen samt Datum. Ausnahme wie in Szenario 2:
Crunchyroll-Lauf, ADN, 404 nach vorher 200 werden übernommen + Nachprüfung.

## Szenario 4 — festgelegt (Daniel, 22.09.2026)

Kanal-Ja → Deutsch wie eine Messung. Kanal-Nein allein → **unbekannt** (nicht „kein Deutsch") +
Prüfliste „mit Abo prüfen". Kanal-Nein + Crunchyroll-Lauf „kein Deutsch" (beim Crunchyroll-Kanal) oder
JustWatch ohne `de` für genau dieses Kanal-Angebot → kein Deutsch. Kanal-Nein + Crunchyroll-Lauf, ADN
oder MOTN „Deutsch" → Deutsch + Nachprüfung. Kanal-Nein + nur JustWatch/aniSearch „Deutsch" → ≈ Deutsch
+ Nachprüfung.

## Szenario 6 (Anzeige) — festgelegt (Daniel, 22.09.2026)

Hat ein Anbieter mehr als einen Verweis für eine Serie, werden **alle** Pills gezeigt — auch die der
Ausgabe ohne Deutsch (Beispiel Digimon Tamers, Prime: Kaufseite mit, zweite Ausgabe ohne Deutsch).
Führen verschiedene Adressen auf **dasselbe Kernziel** (dieselben Folgen unter anderer Kennung), gibt
es nur **eine** Pill, die des Kernziels. Das gilt nur, wenn **mindestens eine** dieser Pills Deutsch
hat; hat keine Deutsch, wird keine gezeigt — im Datenbestand bleibt alles unverändert.

## Das Modell nach der Besprechung (22.09.2026) — ersetzt die Gewichtstabellen oben

**Ziel:** Der Kalender zeigt je Folge und Anbieter, was der Anbieter selbst einem normalen Nutzer
zeigt. Weiß das niemand aus eigener Prüfung, zeigt er die beste Vermutung der zuständigsten Quelle —
gekennzeichnet — und legt sie zur Prüfung vor. Jede Prüfung eicht die Quellen; über Gewichte entscheidet
Daniel wöchentlich von Hand.

**Drei Grundregeln**
1. **Urteil je Folge und je Anbieter-Verweis (Pill).** Eine Messung gilt für die gemessene Folge; eine neue
   Folge erbt nichts.
2. **Zwei Ebenen.** (a) Eigene Prüfung beim Anbieter vorhanden → sie gilt (die jüngste; gemessen vor
   angenommen), auch ein Kanal-Nein, denn es ist das, was der Anbieter Nutzern ohne Abo zeigt. Andere
   Quellen ändern die Anzeige nicht, sie lösen Nachprüfung aus. Einzige Ausnahme: echtes 404 nach vorher
   200 (Auskunft des Anbieters selbst). (b) Keine eigene Prüfung → es gilt die **für diese Lage
   zuständigste** Quelle (Crunchyroll-Lauf für Crunchyroll und Crunchyroll-Kanal, ADN für ADN); sonst die
   anbieterbezogenen Quellen (MOTN, JustWatch) gleichrangig, bei Gleichstand **≈ Ja** + Prüfliste.
3. **Eine Quelle zählt nur, worüber sie etwas weiß.** Crunchyroll-Lauf und ADN sprechen nur für ihren
   Katalog; aniSearch sagt nichts über einen Anbieter und zählt nur fürs **Gesamturteil der Folge**
   (Ja, sobald eine Pill Ja/≈ Ja sagt; ohne Pill aus den titelbezogenen Quellen).

**Dokumentation (nicht im Algorithmus):** Je Quelle × Anbieter × Folge wird festgehalten, **wann eine
Aussage zuerst auftauchte, wann sie sich änderte** (nicht jeder gleiche Abruf), dazu die angekündigten
Erscheinungstermine JP und DE mit Uhrzeit. So lässt sich später auswerten, ob eine Quelle eine
Sprachfassung behauptet, bevor es sie geben kann.

**Statistik:** Jede Nachprüfung zählt je Quelle × Anbieter × (vor/nach Erscheinen) bestätigt oder
widerlegt; Auswertung wöchentlich.

**Wiedervorlage:** Eigene Prüfungen verfallen für die Nachprüfung nach 180 Tagen.

**Folgen für bestehende Regeln:** Die Projektregel „Bei einem Kanal-Titel ist Amazons Sprachangabe kein
Beleg" und die Kanal-Gegenprobe entfallen im neuen Modell (nachzuziehen in `CLAUDE.md` und
`docs/wissen/quellen.md`, sobald umgebaut wird).

**Szenarien 5–11 ergeben sich daraus:** 5 Messung gilt je Folge, Widerspruch zur Randprobe → Staffel
einzeln prüfen · 6 Anzeigeregel oben · 7 Sperre gilt nur den eigenen Folgen · 8 aniSearch nur
Gesamturteil · 9 neue Folge erbt nichts · 10 Störung ist keine Beobachtung · 11 unsicher Zuordenbares
bleibt unzugeordnet, eigene Zuordnungsliste.

**PoC nach dem neuen Modell, Ebene (a) (22.09.2026, `tools/poc-urteil/urteil-pill.mjs`):** Urteil je Pill
aus der jüngsten eigenen Prüfung. 409 Pills mit eigener Prüfung; von den 320, die heute im Datensatz
stehen, stimmen **311 (97 %)** überein. Die 9 Abweichungen sind alle erklärt: 5 Kanal-Nein (gewollte
Modelländerung), 1 Fairy Tail (heutige Meldung, gewollt), 3 gemischte Folgen (Das Band der Unterwelt,
One Piece, Medalist) — brauchen das Urteil je Folge. Keine Abweichung widerlegt das Modell.

## Stufe 4, Schritt 3 — begonnen am 26.09.2026

**Karte der Setzstellen** (42 Zeilen, die `dub` oder `dubRanges` setzen; seit dem Umbau vom
26.09.2026 nach Modul und Funktion, nicht nach Zeile — `build.ts` ist nur noch die Phasenfolge).
Ebene (a), eigene Prüfung: `09-2-linkpruefung · werteLinkpruefungAus` (Handbelege aus
`dub-confirmed.yaml`), `09-3-prime · uebernehmePrimeUndCrVorschlaege` (Prime-Rohmeldungen),
`09-6-anisearch-wege · ergaenzeAnisearchWege` (spät ergänzte Wege mit Handbeleg),
`09-7-abschluss · schliesseSynchroAb` (das Urteil, füllt nur Lücken). Ebene (b), zuständige Quelle:
Crunchyroll (`09-4-1` bis `09-4-4`, 16 Stellen), ADN (`07-adn`, `09-5`), Joyn und weitere
(`09-5-weitere-quellen`), JustWatch (`11-2`), Cartoons (`nebendateien · schreibeCartoons`), dazu
`09-1-belege · sammleBelege` und `10-termine`. In Ebene (a) kommt **dieselbe Beobachtung auf drei Wegen**
in den Bau.

**Erster Befund: Das Urteil kann die eingelesenen Belege noch nicht ablösen.** `dub-confirmed.yaml` führt
2.203 Belege, 2.010 davon aus der Erweiterung eingelesen („Aus dem Browser gemeldet, abgeholt am …“),
193 von Hand. Nur **564 der 2.010** tragen ein Urteil (28 %). Von den 1.446 ohne: 418 `available: false`,
632 mit Adresse, 396 ohne; 1.329 stammen aus dem August. Eine Ursache ist im Code sichtbar:
`fetch-urteile.ts` verwarf jede Meldung ohne Folgennummer — alle Prime-Filme (Kikis kleiner
Lieferservice, The First Slam Dunk, Girls und Panzer: Der Film) und jede Staffelmeldung, deren Rohfolgen
nicht zugeordnet sind.

**Behoben:** Ein Einzelwerk (Film, einteiliges Special) beobachtet Folge 1 (`folgenDerMeldung`,
`check:logic`). Jeder übrige Verwerfungsgrund steht mit Zahl im Log des Bestandslaufs („Meldungen ohne
Beobachtung je Folge: …“).

**Reihenfolge ab hier:** (1) nach dem nächsten Bestandslauf die Verwerfungszahlen lesen und die Abdeckung
neu messen (Skript: Herkunft je Beleg aus den Abschnittskommentaren, Urteil je `titel|anbieter`);
(2) die großen Gründe einzeln schließen — Staffelmeldungen ohne Nummer über die Rohfolgen, `available:
false` als eigenes Urteil je Weg; (3) erst bei voller Abdeckung schlägt das Urteil die eingelesenen
Belege, mit `check:handbelege` als Gegenprobe; (4) danach liest der Einleser nicht mehr nach
`dub-confirmed.yaml`, die Datei bleibt „Daniel von Hand“.
