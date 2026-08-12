# Änderungen

Alle nennenswerten Änderungen an [anime-kalender.de](https://anime-kalender.de).

Die Datenaktualisierungen der Nachtläufe stehen hier nicht — die laufen täglich und
sind in der Fußzeile der Seite am Stand ablesbar. Hier steht, was sich an der Seite
selbst oder an der Art ändert, wie Termine zustande kommen.

## Unveröffentlicht

### Suche: Tippfehler, Kurzformen und alle drei Sprachen

- **Die Suche liest jetzt Wort für Wort.** Bisher wurde die gesamte Eingabe als
  zusammenhängende Zeichenkette gesucht — „aesthetic hero" fand deshalb nichts, obwohl
  „Aesthetica of a Rogue Hero" beide Wörter enthält. Die Reihenfolge ist jetzt gleichgültig.
- **Verschrieben ist nicht verloren.** Findet die genaue Suche nichts, wird ein zweites Mal
  nachsichtig gesucht: „ästhetik" führt zu „Aesthetica", „bochi the rok" zu „Bocchi the Rock!".
  Diese Stufe greift **nur bei leerem Ergebnis** — eine Suche nach „slime" liefert weiterhin
  genau die Slime-Titel und nicht alles, was entfernt so klingt.
- **Deutsche Namen sind endlich durchsuchbar.** Der Name, den Crunchyroll im deutschen Kalender
  führt, hing bisher nur am Termin, nicht am Anime: „Meine Wiedergeburt als Schleim" fand
  nichts. Statt 84 haben jetzt 93 Titel einen deutschen Namen. Gesucht wird ohnehin in allen
  Formen — deutsch, englisch, Umschrift und japanische Schrift.

### Staffeln: eine Reihe, ein Umschalter

- **„Staffeln zusammenfassen" zeigte die falsche Kachel.** Vertreter einer Reihe war die
  neueste Staffel. Eine Suche nach „slime" lieferte deshalb „I've Been Killing Slimes … Season
  2" und „That Time I Got Reincarnated as a Slime the Movie" — eine Fortsetzung und einen Film,
  während die beiden gesuchten Serien nirgends auftauchten. Vertreter ist jetzt die erste
  reguläre Staffel.
- **„Staffeln dieser Reihe" war fast immer leer oder unvollständig.** Der Abschnitt las die
  Titel des Kalenders — und das sind nur die 133 mit Termin. Bei „That Time I Got Reincarnated
  as a Slime" stand deshalb allein Staffel 4, bei „I've Been Killing Slimes" gar nichts. Jetzt
  stehen dort alle Staffeln, Filme und Specials, in Ausstrahlungsreihenfolge.
- **Der Kopf nennt die Reihe, ein Umschalter die Staffel.** Statt „That Time I Got Reincarnated
  as a Slime Season 4" steht dort der Serienname; darunter wird gewählt, worauf sich alles
  Weitere bezieht — jede Staffel, jeder Film, jedes Special, jeweils mit den eigenen Terminen.
- **„Season" steht nirgends mehr.** Weder im Kopf noch im Terminnamen noch im Kalendereintrag.

### Behoben: 196 Termine, die es nicht gibt

Der schwerste Fehler, den die Seite bisher hatte. Für **Sword Art Online** stand Woche für
Woche eine neue Folge im Kalender, bis zum 07.04.2027 — für **Sailor Moon** bis zum
16.11.2027. Zusammen **196 von 867 Terminen** waren frei erfunden, davon 101 in der Zukunft
und zwei in der laufenden Woche, beide ohne Näherungszeichen und damit als belegt ausgewiesen.

Vier Annahmen gerieten hintereinander:

- **ADN wurde nur bis Folge 100 gelesen.** `?limit=100` ohne Blätterung, und die Schnittstelle
  liefert die neuesten Folgen zuerst — abgeschnitten wurde also der Anfang. Sailor Moon: 100
  statt 199 Folgen und ein um vier Monate falscher Start. Eyeshield 21: 100 statt 145. Dragon
  Ball Super: 100 statt 131.
- **Die Staffelangabe der Quelle wurde weggeworfen.** Eine ADN-Serienkennung führt ein ganzes
  Franchise; unter „Sword Art Online" liegen drei Staffeln, unter „Sailor Moon" fünf, unter
  „Haikyu!!" acht. Der Kalender machte daraus je eine Reihe mit durchlaufender Zählung — und
  behauptete 96 Folgen am Stück statt 25 + 24 + 47.
- **Zwei Veröffentlichungstermine galten nicht als Komplettabwurf.** Erkannt wurde nur „alles
  an einem Tag". ADN nahm Sword Art Online in zwei Wellen ins Angebot, 36 Tage auseinander —
  also galt der Eintrag als Wochenserie.
- **Das belegte Enddatum wurde beim Ausrollen der Termine nicht gelesen.** Es stand daneben.
  Der Statusknopf sagte „Abgeschlossen", die Terminliste darunter lief bis 2027.

Was sich dadurch für Besucher ändert:

- **Staffeln stehen jetzt einzeln da, unter ihrem eigenen Namen.** Aus einem Eintrag „Sword Art
  Online, 96 Folgen" wurden fünf: Staffel 1, Staffel 2, Alicization, War of Underworld und War
  of Underworld Part 2 — jede mit ihrer eigenen Folgenzahl. Wo eine Plattform anders zählt als
  wir, steht es dabei: „ADN führt diese Staffel als Folgen 25–36 der ADN-Staffel 3."
- **„Im Angebot seit" statt „Start"** bei Katalogtiteln. Der 11.06.2025 ist der Tag, an dem ADN
  Sword Art Online ins Angebot nahm — die deutsche Fassung gibt es seit 2013, die von
  Alicization seit August 2019 auf Disc. Ein Hinweis unter dem Datum sagt das jetzt auch.
- **32 Anime hießen nach einer Blu-ray-Ausgabe.** „Bocchi the Rock! – Vol. 1" war der Name
  einer Disc und wurde zum Namen des Anime — in Suche, Kachel und Teilen-Seite. Der
  Ausgaben-Zusatz fällt jetzt weg, die Staffelangabe bleibt.
- Die beiden Disc-Ausgaben von **DAN DA DAN Staffel 2** hingen an der ersten Staffel.

Damit so etwas auffällt, bevor es online geht, prüft die Pipeline ab sofort ihr **eigenes
Ergebnis** und bricht bei einem Widerspruch ab, statt zu schreiben. Bisher wurden nur die von
Hand gepflegten Dateien geprüft — also ausgerechnet der Teil, den ohnehin jemand durchdacht
hatte.

### Mehr Titel im Überblick

- **ADN-Serien, die keinen neuen Termin mehr haben, fehlten komplett.** Gelesen wurde nur der
  Veröffentlichungskalender — also nur, was gerade erscheint. Serien, die vollständig im
  Angebot liegen, tauchen dort nie auf. Statt **4** ADN-Titeln sind es jetzt **28**, darunter
  DAN DA DAN, Sword Art Online, Haikyu!!, Dragon Ball Super und Parasyte. Insgesamt stieg die
  Zahl der Termine von 486 auf 853.

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
