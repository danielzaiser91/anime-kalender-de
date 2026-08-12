# Änderungen

Alle nennenswerten Änderungen an [anime-kalender.de](https://anime-kalender.de).

Die Datenaktualisierungen der Nachtläufe stehen hier nicht — die laufen täglich und
sind in der Fußzeile der Seite am Stand ablesbar. Hier steht, was sich an der Seite
selbst oder an der Art ändert, wie Termine zustande kommen.

## Unveröffentlicht

### Wenn der Anbieter anders zählt als wir

Bei „The Café Terrace and Its Goddesses" führt Crunchyroll **eine** Staffel mit 24 Folgen, wo
AniList zwei zu je zwölf kennt; bei „The Case Study of Vanitas" genauso. Wer bei uns Staffel 2
anklickt und dort eine Liste mit 24 Folgen vorfindet, hält zwangsläufig eine der beiden Angaben
für falsch — dabei zählen bloß beide anders.

Unter „Wo läuft es" steht jetzt dabei, wenn eine Adresse mehrere unserer Einträge bedient
(878 Verweise, 344 Adressen). Der Hinweis sagt bewusst „kann abweichen" und nicht „weicht ab":
Belegt ist nur, dass dieselbe Seite mehrere unserer Staffeln bedient. Wie der Anbieter selbst
einteilt, steht auf einer Seite, die ihre Staffelliste per JavaScript nachlädt — geprüft ist
das also nicht.


### Eigene Hinweise statt der Kästchen des Betriebssystems

Erklärungen hingen bisher am `title`-Attribut — dem Standard-Tooltip des Browsers: heller
Kasten mit fremder Schrift mitten in einer dunklen Seite, eine Sekunde Verzögerung, auf dem
Handy gar nicht erreichbar. Jetzt zeichnet die Seite ihre Hinweise selbst, in ihrem eigenen
Stil, und sie erscheinen auch bei Bedienung per Tastatur.

Eingebaut ist das in die gemeinsamen Bausteine — Knöpfe, Chips, FSK-Plaketten, Stern,
Auge, Teilen, Schalter. Damit gilt es überall auf einen Schlag. Die einzige Ausnahme ist die
Sprecherliste: Dort zeigt der Browser bei abgeschnittenen Namen den vollen Text, und das ist
seine eigene Aufgabe.

Nebenbei erklärt sich jetzt auch **MAL** — die Kennung neben den Metadaten stand bisher
unkommentiert da.

### Geprüfte Anbieter-Verweise

- **Tote Verweise verschwinden.** Sechs von zehn Verweisen aus dem ersten Prüfdurchgang waren
  nicht „vorhanden, aber nur untertitelt", sondern schlicht weg — „Videos nicht verfügbar" oder
  eine Weiterleitung auf die Startseite. Ein „🇩🇪 ✕" hätte dort ein Angebot ohne deutsche Fassung
  behauptet, wo es überhaupt kein Angebot gibt.
- **16 Angaben sind jetzt belegt**, darunter Attack on Titan samt OADs, Blue Exorcist (außer der
  Kyoto Saga, die es dort nur mit englischer Synchro gibt), Campfire Cooking und
  „I Was Reincarnated as the 7th Prince" — alle auf Crunchyroll.

### Die Quelle der Handlung stimmt jetzt

Bei 2.385 von 2.683 deutschen Beschreibungen stand die Quelle mitten im Fließtext („Quelle:
www.anisearch.de/anime/1572"), und darunter noch einmal eine eigene Zeile, die pauschal
„themoviedb.org" behauptete — auch dort, wo der Text von aniSearch kam. Die Quelle wird jetzt
beim Bauen herausgelöst, mitgeführt und einmal als Verweis dargestellt.


### Detail-Panel aufgeräumt

Das Panel war über die Zeit zu einer Liste von Kästen geworden, in der das Wichtigste unten
stand. Zehn Änderungen, alle aus einem Blick von Daniel am 12.08.2026:

- **Genres stehen jetzt oben neben dem Cover.** Sie beantworten die erste Frage an einen
  unbekannten Titel — „ist das überhaupt meins?". **Keywords** stehen dafür ganz am Ende.
- **„Alles aus dieser Reihe" ist weg.** Dieselben Einträge stehen zwei Handbreit darüber im
  Umschalter; zwei Listen mit gleichem Inhalt sind keine doppelte Auskunft, sondern doppelte
  Länge.
- **Datum und Uhrzeit stehen in einer Zeile**, und fehlt die Uhrzeit, steht dort gar nichts
  mehr statt „unbekannt" samt Erklärknopf.
- **Der Hinweis, was das Datum bedeutet, ist Hovertext geworden** — das Datum ist gepunktet
  unterstrichen. Vorher stand der Satz bei jedem Katalogtitel als eigener Absatz im Weg.
- **Der Name des Releases entfällt** — er stand schon im Umschalter darüber.
- **Titel ohne Termin sehen aus wie alle anderen:** „Im Angebot seit — unbekannt", statt eines
  eigenen Kastens mit zwei Sätzen.
- **Kalender-Knöpfe nur, wenn es etwas einzutragen gibt.** Bei einem Katalogtitel führte „Zu
  Google Calendar" bisher zu einem Termin in der Vergangenheit.
- **Die ICS-Datei erklärt sich jetzt selbst.** Ein Fragezeichen daneben sagt, was das Format
  ist und wohin die Datei gehört — Allgemeinwissen ist das nicht.
- **Die Handlung zeigt zwei Sätze**, der Rest kommt auf Klick. Eine Inhaltsangabe von tausend
  Zeichen schob vorher alles Weitere aus dem Bild.
- **Die Quelle der Handlung steht als Verweis darunter**, im selben Stil wie unter einem Termin.


### Kleinigkeiten mit großer Wirkung

- **Die Auswahlliste des Staffel-Umschalters war im Dunkelmodus nicht zu lesen.** Das Element
  hatte einen fast durchsichtigen Hintergrund — geschlossen sah das richtig aus, aufgeklappt
  malte Windows es über Weiß, und die helle Schrift stand hellgrau auf Weiß. Jetzt haben die
  Einträge feste Farben: Kontrast 11,9 zu 1 im Dunkeln, 17,9 zu 1 im Hellen.
- **Die beiden Filme „Sword Art Online -Progressive-" standen als eigene Reihe daneben.**
  AniList verknüpft sie als „alternative Erzählung", nicht als Fortsetzung — und genau diese
  Verknüpfung wurde beim Bündeln übergangen. Dasselbe traf Ableger, Zusammenschnitte und
  Rückblick-Filme. Aus 1.504 Reihen wurden 1.413; Sword Art Online ist jetzt eine Kachel mit
  zwölf Einträgen statt zwei Kacheln.
- **„Staffeln zusammenfassen" ist jetzt standardmäßig aus.** Wer die Datenbank öffnet, sucht
  meist einen bestimmten Titel — und der steht dann unter seinem eigenen Namen da.


### Neue Daten kommen jetzt beim normalen Neuladen an

Nach einem Deploy zeigte die Seite weiter den alten Stand; nur ein hartes Neuladen half. Schuld
war nicht ein Fehler, sondern eine Adresse: `/data/events.json` hieß nach dem Deploy genauso wie
davor, und was unter derselben Adresse liegt, gilt dem Browser-Cache wie dem Service Worker als
dieselbe Datei. Die „Auffrischung im Hintergrund" holte deshalb zehn Minuten lang denselben
alten Inhalt.

Jede Datenadresse trägt jetzt den **Datenstand**: `/data/events.json?v=20260812142619`. Ändern
sich die Daten, ändert sich die Adresse — für beide Caches ist das ein Erstabruf, kein
Auffrischen. Ein Deploy, der nur Code ändert, lässt die Adressen dagegen in Ruhe; niemand lädt
deswegen erneut 551 KB Titeldaten.

Offline bleibt es, wie es war: Fehlt das Netz, wird die Kennung ignoriert und die letzte bekannte
Fassung genommen — lieber Termine von vorgestern als eine leere Seite.

Nebenbei aufgeräumt: Die alten Programmdateien jedes Deploys blieben im Speicher liegen, rund
400 KB pro Veröffentlichung. Jetzt bleiben die letzten vierzig.


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
