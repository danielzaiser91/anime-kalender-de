# Änderungen

Alle nennenswerten Änderungen an [anime-kalender.de](https://anime-kalender.de).

Die Datenaktualisierungen der Nachtläufe stehen hier nicht — die laufen täglich und
sind in der Fußzeile der Seite am Stand ablesbar. Hier steht, was sich an der Seite
selbst oder an der Art ändert, wie Termine zustande kommen.

## Unveröffentlicht

### Neu: deutsche Synchronsprecher

- **„Wer spricht diese Figur auf Deutsch"** steht jetzt im Detail-Panel — bei 1.746 von 2.753
  Titeln, zusammen 21.924 Rollen. Der Bereich ist zugeklappt und lädt erst beim Aufklappen;
  wer ihn nicht öffnet, lädt auch nichts. Angaben von AniList.

### Genauere Folgenzahlen

- **Die Folgenzahl kommt jetzt von aniSearch, statt geraten zu werden.** Fehlte die
  Angabe bei AniList, setzte die Pipeline zwölf an — die übliche Länge, aber eben
  geraten. Bei einer 24-teiligen Reihe fehlte der Kalender damit ab Folge 13. aniSearch
  pflegt die Zahl redaktionell; sie wird jetzt von dort übernommen.
- **Vorläufige Angaben bleiben als solche erkennbar.** aniSearch kennzeichnet selbst,
  wenn eine Folgenzahl noch nicht feststeht. Diese Kennzeichnung wandert mit in den
  Datensatz und erscheint als ≈ — mit dem Hinweis, dass die Schätzung von aniSearch
  stammt und nicht unsere eigene Annahme ist. Wo aniSearch die Zahl als gesichert
  führt, verschwindet das ≈ dagegen.

### Unter der Haube

- **Abgerufene Seiten werden archiviert.** Bisher wurden aus jeder aniSearch-Seite zwei
  Felder herausgelöst und der Rest verworfen — was jedes später gebrauchte Feld zu einem
  neuen Lauf über tausende Seiten einer fremden Redaktion machte. Die inhaltlichen
  Abschnitte liegen jetzt komprimiert im Repo (~9 KB je Titel). Forum, Kommentare und
  Rezensionen bleiben ausdrücklich draußen: fremde Beiträge gehören nicht in unser Repo.
- **Aus der Infobox wird alles gelesen**, auch was heute niemand anzeigt: Studio, Staff
  mit Funktion, Sendeplatz, Folgenlänge, Synonyme, Publisher und Status je Sprachfassung.
- `npm run data:anisearch:check` prüft den Parser gegen das Archiv, ohne einen einzigen
  neuen Abruf; `data:anisearch:reparse` wertet den Bestand nach einer Parser-Änderung neu
  aus. Beides hat sich sofort bezahlt gemacht: Die Folgenzahl wurde anfangs nur bei 3 %
  der Titel erkannt, weil eine Regex die Laufzeit traf statt der Folgenzahl.

## 0.2.0 — 10.08.2026

### Falsche Termine

- **Aus einem einzelnen Termin wurde keine Serie mehr hochgerechnet.** Fehlte die
  Folgenzahl, setzte die Pipeline bisher mindestens zwölf an — auch wenn genau ein
  Termin belegt war. Betroffen waren neun Einträge: „My Hero Academia I am a hero too"
  bekam elf Folgen, die es nie geben wird, und selbst die Crunchyroll Anime Awards
  standen als Wochenserie im Kalender. Jetzt gilt: ein Termin ohne belegte Folgenzahl
  über eins ist ein Einzeltermin.
- **Specials landen nicht mehr bei der falschen Staffel.** Crunchyroll führt alle
  Staffeln und Specials einer Reihe unter derselben Serien-Kennung; behalten wurde
  bisher der erste Treffer. Deshalb hing „I am a hero too" an Staffel 6. Die Zuordnung
  läuft jetzt zuerst über den vollständigen Namen.
- **„Slime Staffel 4" hing an „Slime Season 3"**, mitsamt deren Folgenzahl, Cover und
  Beschreibung. Nennt der Kalender eine Staffelnummer, muss der Titel sie tragen.
- **Geteilte Staffelstarts zählen durch.** Netflix brachte „Steel Ball Run" am 19.03. als
  einzelne 47-Minuten-Folge und den Rest ab dem 25.09. Die Terminliste des zweiten Teils
  begann wieder bei „1." und las sich wie der Termin der Auftaktfolge. Neues Feld
  `schedule.firstEpisodeNumber`: aus „Ep 1/11" wird „Ep 2/12".

### Neu

- **Filter „verfügbar"** in der Datenbank-Ansicht. Der Kalender kennt 2.753 Anime mit
  belegter deutscher Synchro, aber nur gut hundert haben einen anstehenden Termin. Bei
  den übrigen ist die Frage nicht *wann*, sondern *wo* — für 1.856 davon gibt es jetzt
  eine Antwort. Steht als `wo=1` in der Adresse, ist also teilbar.
- **Seite „Quellen & Lizenzen"** unter `#/quellen`.

### Geändert

- **Die Oberfläche ist einsprachig.** Der Sprachumschalter, das englische Wörterbuch und
  die zugehörige Mechanik sind entfernt. Die Seite sammelt deutsche Synchronfassungen;
  zwei Sprachfassungen zu pflegen war Aufwand für einen Fall, den es nicht gab.
  Serientitel bleiben unverändert — „Steel Ball Run — 1st STAGE" ist ein Eigenname.
- **Keywords und Formatangaben auf Deutsch.** 234 von 340 Keywords wurden roh aus der
  Quelle durchgereicht und standen englisch in den Filtern und im Detail-Panel
  („Terrorism", „Bullying", „Witch"). Ebenso die Formatangabe („MOVIE", „TV_SHORT",
  „MUSIC"). Unverändert bleibt, was im Deutschen ohnehin so heißt — Noir, Cosplay,
  Battle Royale — und was als japanischer Fachbegriff etabliert ist: Chuunibyou, Gyaru,
  Kaiju, Rakugo, Tokusatsu, Youkai, ebenso OVA, ONA und Special.
- **Deutsche Inhaltsangaben: 2.238 von 2.754 Titeln** (vorher 2.041). Quelle ist
  aniSearch, der Bestand wächst über die Nachtläufe weiter.
- **Der Footer ist von zehn auf zwei Zeilen geschrumpft.** Die Quellenangaben liegen
  jetzt auf der eigenen Seite — verschwinden dürfen sie nicht, ODbL und CC BY 4.0
  verlangen die Nennung.
- **Die Teilen-Seiten unter `/r/<slug>/` haben Inhalt bekommen**: Titel, Eckdaten,
  deutsche Inhaltsangabe und die vollständige Terminliste. Vorher bestanden sie aus
  Meta-Angaben und einer Weiterleitung, was für die Link-Vorschau reichte, aber für
  Suchmaschinen eine leere Seite war.
- **Der Hinweis, warum bei Netflix und Prime Video keine Uhrzeit steht**, liegt hinter
  einem Fragezeichen statt dauerhaft zwischen den Eckdaten.

### Behoben

- Der Favoriten-Stern ragte in schmalen Spalten aus der Karte heraus.
- Das Angebot „App installieren" erschien im Footer auch auf dem Desktop.
- Die Erreichbarkeitsprüfung verschickte ihre Mails unter demselben Absendernamen wie
  der Newsletter, obwohl sie 19 Seiten aus allen Projekten überwacht.

### Intern

- **Die Nachtläufe gingen nie live.** Ein Push aus einer Action mit dem `GITHUB_TOKEN`
  löst keine weiteren Workflows aus — genau daran hing der Deploy. Seit dem Einrichten
  der Polling-Kaskade wurde kein automatisch geholter Datensatz veröffentlicht, außer
  wenn zufällig ein Mensch am selben Tag etwas pushte.
- **Datenläufe verlieren bei einem Push-Konflikt nichts mehr.** Zweimal brach ein Lauf
  beim Commit ab und nahm die frisch geholten Caches mit — beim zweiten Mal 200
  aniSearch-Seiten, gut zwanzig Minuten Abrufe. Quellen und Build-Artefakte werden
  jetzt getrennt behandelt: Quellen gewinnen, Artefakte werden neu gebaut.
- **Kaputte Workflow-Dateien fallen auf.** Ein `: ` in einem YAML-Wert machte alle drei
  Datenläufe ungültig, ohne dass GitHub es meldete. Der Deploy prüft die Dateien jetzt.

## 0.1.0 — 08.08.2026

Erste Fassung. Wochen-, Monats-, Agenda- und Datenbank-Ansicht, Filter und Suche,
Google-Calendar- und ICS-Export, Newsletter mit Double-Opt-in, PWA mit Offline-Betrieb,
Link-Vorschaubilder, Erreichbarkeitsprüfung für alle Projektseiten.
