# Status: anime-kalender-de

Stand: 11.08.2026 · Live: https://anime-kalender.de/

## Task Queue

### In Arbeit
_(leer)_

### Queue
| Aufgabe | SP | Notiz |
|---|---|---|
| **Fuzzy-Suche** | 5 | Tippfehler und umgangssprachliche Kurzformen sollen treffen: „ästhetik" oder „aesthetic hero" muss „Aesthetica of a Rogue Hero" finden. Zusätzlich über alle drei Namensformen suchen (romaji/native, deutsch, englisch). Danach erklären, wie sanft die Toleranz steht (Daniel, 12.08.2026) |
| **„Staffeln zusammenfassen" wählt die falsche Kachel** | 3 | Suche „slime" zeigt Staffel 2 und einen Film als Reihen-Vertreter. Erwartet ist die erste reguläre Staffel (Daniel, 12.08.2026, Screenshots 1+2) |
| **„Staffeln dieser Reihe" unvollständig** | 3 | Bei „That Time I Got Reincarnated as a Slime" steht nur Staffel 4, bei „I've Been Killing Slimes" fehlt der Abschnitt ganz. Alle Einträge derselben `franchiseId` müssen erscheinen (Daniel, 12.08.2026, Screenshots 3+4) |
| **Staffelauswahl per Dropdown im Detail-Panel** | 8 | Kopf zeigt nur den Serientitel; darunter ein Dropdown über alle Staffeln/Filme/Specials, vorausgewählt die angeklickte. Jede Auswahl mit eigenen „Alle Termine" — der Abschnitt fehlt heute bei allen außer Staffel 4. Betrifft auch SAO (staffelweise statt 90+ Folgen) (Daniel, 12.08.2026, Screenshot 5) |
| **„Season" aus dem Vokabular streichen** | 2 | Überall „Staffel". Betrifft auch aus AniList übernommene Titel („… Slime Season 2") und die Namen aus ADN und Kuratierung (Daniel, 12.08.2026) |
| Kuratierungsbericht: drei Pausen-Meldungen prüfen | 1 | Der neue Pausen-Filter hat drei Artikel vorgelegt (`data/proposals/anime2you.json`, Feld `pause`): „24 Blu-ray-Termine verschoben" (betrifft AniMoon, Crunchyroll, KSM — teils unsere Disc-Termine), „Disc-Release von »Bleach« auf unbestimmte Zeit verschoben", „»Scarlet« startet früher in Deutschland". Von Hand gegen `data/curated/` abgleichen |
| ~~News-Quellen für Sendepausen~~ — **Filter gebaut, Rest verworfen** | 8 | Serien unterbrechen den Wochentakt (Sommerpause, Best-of-Folgen, Verschiebungen) — das steht in News, nicht in Kalender-Feeds, und ohne die Info rechnet der Kalender stur weiter (Daniels Hinweis, 11.08.2026). Die Pipeline **kann** Pausen bereits abbilden (`schedule.skipDates`), es fehlt allein die Quelle. Vorrecherche vom 11.08. steht unten unter „Recherche News-Quellen". Vorgehen wie bei den übrigen Quellen: Treffer als Vorschlag nach `data/proposals/`, nicht direkt in den Datensatz — „pausiert" aus einem Fließtext zu lesen ist Deutung, und die gehört vor die Quellenpflicht gestellt |
| **Disc-Vorschläge abarbeiten** | 3 | `npm run data:disc-proposals` erzeugt aus dem Archiv 47 Ausgaben an **34 Terminen zu 21 Anime**, die noch nicht im Datensatz stehen (`data/proposals/disc-anisearch.json`, Stand 12.08.2026). Jeder Vorschlag trägt den Grund seiner Einstufung. Übertragen nach `data/curated/` — das ist Handarbeit mit Augenmaß: Mehrere Editionen am selben Tag sind **ein** Kalendereintrag |
| Ansicht „Wo kann ich das sehen?" ausbauen | 5 | **Nicht mehr blockiert** — aniSearch-Bestand seit 10.08.2026 vollständig, 2.109 Titel haben einen Bezugsweg. Der Filter „▶ verfügbar" steht bereits. Offen: nach Anbieter gruppieren (die `watchLinks` tragen nur Namen, keine PlatformId), Kauf von Stream trennen, eigene Ansicht unter `#/wo` |


### Terminiert (läuft von allein)

Geplante Aufgaben, die zu einem festen Zeitpunkt selbst anspringen. Zählen im Footer als 📅,
nicht als „jetzt möglich" — entschieden und eingeplant ist beides schon, es fehlt nur die Zeit.

| Wann | Was | Aufgabe |
|---|---|---|
| 24.08.2026, 10:00 | DMARC-Politik von `p=none` auf `p=quarantine` heben **und `rua=` streichen** — vorher die bis dahin eingegangenen Berichte prüfen; bei einem `fail` oder einer fremden Absender-IP wird nicht umgestellt. Die täglichen Berichtsmails hören damit auf (Daniels Entscheidung 12.08.2026); Preis dafür: keine Belegkette für ein späteres `p=reject` und keine Warnung bei gefälschten Absendern | `dmarc-policy-anime-kalender` |

### Später (nice to have)

Bewusst zurückgestellt. Zählt im Footer als „später", nicht als „jetzt möglich" — damit die
Liste der wirklich anstehenden Arbeit nicht von Dauerbrennern verstopft wird. Wird hier
herausgeholt, wenn der User es sagt.

| Idee | SP | Notiz |
|---|---|---|
| Synchronstudios als Quelle | 8 | **Recherche am 11.08.2026 gemacht, Ergebnis ernüchternd.** Oxygen Sound Studios führt unter [o2studios.com/de/projekte](https://o2studios.com/de/projekte/) eine reine Referenzliste: „Chainsaw Man – Der Film Reze Arc — Deutsche Synchronisation", ohne jedes Datum und ohne Status. Violetmedia ist von hier aus nicht erreichbar (TLS-Handshake bricht ab, wie schon bei aniverse.de). Ein Studio nennt also, **dass** es eine Fassung macht — nicht **wann** sie kommt. Das ist nachvollziehbar: Der Termin gehört dem Lizenznehmer, nicht dem Studio. **Rest-Nutzen:** Die Projektlisten wären ein Beleg dafür, dass eine deutsche Fassung überhaupt existiert oder entsteht — für die `dubConfidence`, nicht für den Kalender. Als Terminquelle zurückgestellt; eine Anfrage lohnt nur, wenn ein Studio überhaupt Termine kennt und nennen dürfte |

### Zu besprechen
_(leer)_

### Warten auf Feedback
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

## Entscheidungen

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
