# Louds und Rainbow High: Befund zur Ratsche OFFEN_OHNE_ZUORDNUNG (03.11.2026)

Messbasis: Meldungskopie vom 03.11.2026 03:01 Z (`node tools/meldungskopie.mjs abfrage`), `origin/main` e9a750fe5. Kein Netflix-Abruf, kein aniSearch-Zugriff. Nichts an `data/` geändert, weil dort keine Fehlzuordnung steht (Begründung unten).

## 1. Willkommen bei den Louds, Netflix 81186971

**Die Adresse gehört Louds.** Beleg: `public/data/cartoons.json` führt sie als Netflix-Weg von -68073 (TMDB 68073); `data/prime-zugeordnet.json` ordnet beide Gruppen (`#0`, `#1`) -68073 zu; die 26 Meldungen von Netflix-Staffel 3 (Staffelkennung 81944948) tragen Louds-Folgentitel ("Der Selfie-Wettstreit / Hausunterricht rockt!", "Die Vampir-Fans / Rita auf Abwegen"). Je Hälfte getrennt gegen `data/cartoon-folgen.json` (-68073) gelesen, treffen 28 von 48 Hälften genau eine Folge, alle in TMDB-Staffel 3 (ein Skript im Scratchpad, `folgenZuTitel` je Hälfte).

**Die 13 "Barbie"-Meldungen (Netflix-Staffel 2, Kennung 81184773) sind ein Lesefehler der Erweiterung, keine Fehlzuordnung in `data/`.**
- Dieselben 13 Zeilen (gleiche Nummern, gleiche Titel, gleiche Staffelkennung 81184773) liegen auch unter `https://www.netflix.com/title/81184735` (Barbie, -335643): gemeldet 15:53:32 Z, unter Louds 15:54:12 Z am selben Tag. Die Seite hatte beim Louds-Lauf noch die Barbie-Staffelliste.
- Louds' eigene Staffel 2 (laut Titelzeile 26 Folgen) kam nie an.
- Wirkung auf den Bestand: keine falsche Aussage. Gruppe `#0` trifft keinen Louds-Titel und fällt auf "gilt dem Titel" (`unsere: null`, einheitliche Tonspuren); der deutsche Ton von Louds auf Netflix ist durch die 26 echten Zeilen von Staffel 3 ohnehin belegt.
- Ändern lässt sich das nur in der Meldungsquelle (D1), nicht in `data/`. Das Löschen der 13 Zeilen unter 81186971 ist eine D1-Handlung (nicht getan, Auftrag: nie an der echten D1).

**Klasse (gemessen, Meldungskopie, Netflix, numerische Staffelkennung):** 27 Staffelkennungen stehen unter zwei Adressen, verteilt auf 8 Adresspaare. Mindestens ein Paar ist eine bekannte Umleitung (70171942/70171947, Ranma); die übrigen sieben (u. a. 81184735/81186971, 80193163/81499847, 81246530/81259476) sind nicht einzeln geprüft.

**Warum die Ratsche Louds führt:** `81186971` ist in `anbieter-staffeln.json` nicht vorhanden (Cartoon-Weg, die Anime-Staffelliste wird nie angelegt). `offeneListen` zählt ihn deshalb nicht, `verletzteRatsche` ist grün. Der Eintrag ist ein Platzhalter für den Fall, dass die Liste doch entsteht; er sinkt erst, wenn Louds eine Zuordnung per Folgentitel oder Summe bekommt. Er wurde deshalb nicht gestrichen: ein Streichen würde den Fall verschweigen, statt ihn zu lösen.

**Offen, Empfehlung (nicht gebaut, eigener PR):**
1. Der Zuordner (`ordneCartoonAdresse`, `folgenInListe`) liest "A / B" als einen Titel; mit Aufspaltung an " / " ordnet er 28 statt 0 Hälften zu. Dann würde die Louds-Gruppe `#1` Einzelfolgen statt "gilt dem Titel", und die nicht treffenden Hälften fielen weg: das ist eine Verhaltensänderung für alle Cartoons mit Doppelfolgen und braucht `bau-vergleich`.
2. Wächter in `fetch-rohfolgen`: dieselbe Netflix-Staffelkennung unter zwei Adressen, die keine Umleitung sind, ergibt "offen" statt Zuordnung.
3. Reihenfolge von Netflix-Staffel 3 und TMDB-Staffel 3 weichen ab (Netflix Pos 3 = TMDB s3e1/e2, Pos 1 = s3e3/e4); eine Zuordnung per Position oder Summe wäre falsch, nur Titel tragen.

## 2. Rainbow High, Netflix 81397437

**Quelle mit Folgenbeschreibungen: keine im Bestand, messbar begründet.**
- Die 10 Meldungen (`titel_zeile`, Version 5) heißen "Teil 1" bis "Teil 5" je in Netflix-Staffel 2 und 3 (Staffelkennungen 81580499.., 81630950..). Es ist Netflix' eigener Folgentitel; `prime_folge` hat zu dieser Adresse keine Zeile.
- `data/cartoon-folgen.json` (-124331): 134 Folgen, nur englische Titel ("Welcome Back, Bella!", "BFF Blowup!"), keine Beschreibung. Staffelgrößen 18/15/18/14/14/16/3, Netflix-Staffeln haben 5 und 5: keine passt.
- JustWatch (`data/justwatch-audio.json`, -124331): Netflix führt Staffel 2 (15) und 3 (20), also nur einen Teil jeder Staffel; Zahl und Reihenfolge der fehlenden Folgen sind nicht bekannt. Die Summe trägt nicht.
- Der Handbeleg (`data/dub-confirmed.yaml`, Rainbow High, 81397437) hat den Bereich schon am 01.11.2026 entfernt ("Folgentitel bestätigt die Verschiebung nicht"), der Titel bleibt als Ganzes belegt.

**Vorschlag (nicht gebaut):** Die Erweiterung meldet zusätzlich Netflix' Folgenbeschreibung und Laufzeit (`dauer_sek`) je Folge. Beschreibung gegen TMDB-Handlung (`data/tmdb-folgen.json` führt heute nur Titel) oder Laufzeit gegen TMDB-Laufzeit würde die 10 Folgen einer TMDB-Staffel zuordnen. Vorher messen, ob TMDB die Beschreibungen für Rainbow High deutsch/englisch führt.

## Ergebnis der Ratsche

Keine Änderung: `OFFEN_OHNE_ZUORDNUNG` bleibt bei `81186971,81397437`. Beide Fälle sind aufgeklärt; ein Absenken wäre erst mit der Zuordnung (Louds: Punkt 1 oben; Rainbow High: neue Quelle) ehrlich.
