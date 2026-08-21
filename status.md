# Status: anime-kalender-de

Stand: 17.08.2026 · Live: https://anime-kalender.de/

## Task Queue

### In Arbeit

**Beides läuft seit dem 21.08.2026, 00:35 Uhr in der Cloud** — angestoßen über
`.github/workflows/claude-auftrag.yml`, Ergebnis kommt jeweils als Pull Request.
Zwei Aufträge laufen nacheinander, nicht parallel (eine Sperre verhindert zwei
widersprüchliche PRs am selben Repo).

| Aufgabe | SP | Lauf | Notiz |
|---|---|---|---|
| **Erfundene Termine durch durchlaufende Folgenzählung** | 5 | [Lauf 32461914436](https://github.com/danielzaiser91/anime-kalender-de/actions/runs/32461914436) | **Live-Fehler, gemessen am 21.08.2026.** „Wistoria: Wand and Sword Staffel 2" führt auf der Seite zwölf Termine vom 08.02. bis 26.04.2026 — die Staffel lief nachweislich vom 31.05. bis 19.07., belegt durch acht Folgen in unserem **eigenen** Kalenderabruf (`observed` 17–24). Alle zwölf angezeigten Termine sind erfunden, die acht belegten fehlen. Ursache: Crunchyroll zählt die Reihe durch (Staffel 2 = Folgen 13–24), AniList zählt je Staffel (12). Ohne `firstEpisodeNumber` rechnet `build.ts` aus „Folge 17 am 31.05." einen Start am 08.02. zurück. **Umfang:** 18 Releases mit zusammen 129 zurückgerechneten Terminen; nicht alle davon sind falsch. Zweig `claude/durchlaufende-folgenzaehlung` |
| **Crunchyroll-Rückstand nachholen** | 1 | [Lauf 32461498580](https://github.com/danielzaiser91/anime-kalender-de/actions/runs/32461498580) | 769 Serienadressen ohne frische Tonspur-Prüfung, gemessen am 21.08.2026. Gemessener Takt: 6,7 s je Serie, also rund 85 Minuten — nicht vier Wochen, wie ich zuerst gerechnet hatte. Der Deckel `--limit 250` im Wochenlauf schützt dessen Laufzeit, nicht Crunchyroll, ist bei 954 Adressen und 28 Tagen Wiedervorlage aber zugleich genau die Erhaltungsrate: Ein Rückstand baut sich damit nie ab. Dafür gibt es jetzt `crunchyroll-nachholen.yml` |
| **React-Hooks-Regeln in die Prüfkette** | 2 | [32424595802](https://github.com/danielzaiser91/anime-kalender-de/actions/runs/32424595802) | Anlass ist der weiße Bildschirm vom 20.08.2026 (React #310, Hooks hinter einem frühen `return`). Prüfkette **und** `tsc` waren dabei grün — gefunden wurde es nur durch einen Blick auf die laufende Seite. Schlanke Flat-Config, nur `rules-of-hooks` (Fehler) und `exhaustive-deps` (Warnung), eingehängt in npm-Skript, `CLAUDE.md` und Deploy-Workflow. Zweig `claude/react-hooks-in-die-pruefkette` |


### Queue
| Aufgabe | SP | Notiz |
|---|---|---|
| **Prüfliste „Wo läuft es" abarbeiten** (Dauerauftrag) | — | 1.732 Anbieter-Verweise ohne belegte Synchro, Liste: `data/dub-pruefliste.md`, erzeugt mit `npm run data:dub-checks`. Daniel arbeitet sie in Zehnerschritten ab; ich lege den Batch vor, er meldet je Nummer ja/nein, ich trage es in `data/dub-confirmed.yaml` ein und baue neu. **Stand: Batch 1 bis 3 ausgewertet, 65 Prüfungen eingetragen — 33 Angaben belegt, 32 tote Verweise entfernt.** Crunchyroll ist seit 13.08.2026 weitgehend maschinell belegt (234 ja / 988 nein / **25 offen**); die Handarbeit verteilt sich jetzt auf Netflix (727), YouTube (528) und Prime Video (219) — Anbieter, die die Sprachfassung nirgends öffentlich nennen. Kurzschrift der Antworten (`1`/`0`/`x`, mehrere je Zeile mit Punkt) steht im Kopf der Liste und in der `CLAUDE.md`. Je Batch kurz sagen, woher der Verweis stammt und warum er unsicher ist |
| ~~News-Quellen für Sendepausen~~ — **Filter gebaut, Rest verworfen** | 8 | Serien unterbrechen den Wochentakt (Sommerpause, Best-of-Folgen, Verschiebungen) — das steht in News, nicht in Kalender-Feeds, und ohne die Info rechnet der Kalender stur weiter (Daniels Hinweis, 11.08.2026). Die Pipeline **kann** Pausen bereits abbilden (`schedule.skipDates`), es fehlt allein die Quelle. Vorrecherche vom 11.08. steht unten unter „Recherche News-Quellen". Vorgehen wie bei den übrigen Quellen: Treffer als Vorschlag nach `data/proposals/`, nicht direkt in den Datensatz — „pausiert" aus einem Fließtext zu lesen ist Deutung, und die gehört vor die Quellenpflicht gestellt |


### Terminiert (läuft von allein)

Geplante Aufgaben, die zu einem festen Zeitpunkt selbst anspringen. Zählen im Footer als 📅,
nicht als „jetzt möglich" — entschieden und eingeplant ist beides schon, es fehlt nur die Zeit.

| Wann | Was | Aufgabe |
|---|---|---|
| **20.08.2026, ab 13:45** | **Wochenlauf nachsehen** — von Hand angestoßen am 20.08. um 12:31 Uhr, Lauf-Nummer 32359320442. Der letzte vollständige Wochenlauf brauchte **57 Minuten** (17.08., 06:03–07:00 UTC); dieser hat mehr zu tun, weil die ADN-Warteschlange von 179 auf 242 Serien gewachsen ist und die Zuordnungsphase am AniList-Ratenlimit hängt. **Erwartetes Ende: 13:30 bis 13:50 Uhr.** Abfragen mit `gh run list --workflow refresh-weekly.yml --limit 1 --repo danielzaiser91/anime-kalender-de`. Zu prüfen: Ist er grün, hat der ADN-Katalog wieder ~109 Serien mit Synchro, und lief der neue YouTube-Schritt durch (er sollte „0 fällig" melden, weil der Bestand vom selben Tag stammt) | erster Lauf mit vereinigter ADN-Warteschlange und YouTube-Prüfung |
| 24.08.2026, 10:00 | DMARC-Politik von `p=none` auf `p=quarantine` heben **und `rua=` streichen** — vorher die bis dahin eingegangenen Berichte prüfen; bei einem `fail` oder einer fremden Absender-IP wird nicht umgestellt. Die täglichen Berichtsmails hören damit auf (Daniels Entscheidung 12.08.2026); Preis dafür: keine Belegkette für ein späteres `p=reject` und keine Warnung bei gefälschten Absendern | `dmarc-policy-anime-kalender` |

### Später (nice to have)

Bewusst zurückgestellt. Zählt im Footer als „später", nicht als „jetzt möglich" — damit die
Liste der wirklich anstehenden Arbeit nicht von Dauerbrennern verstopft wird. Wird hier
herausgeholt, wenn der User es sagt.

| Idee | SP | Notiz |
|---|---|---|
| **Angabe je Folgenbereich statt ja/nein** | 3 | Heute kennt `data/dub-confirmed.yaml` nur „hat deutsche Synchro" oder „hat keine" — je Verweis, für die ganze Reihe. Bei Black Clover auf Netflix stimmt beides nicht: Folgen 1 bis 155 sind deutsch, 156 bis 171 nicht (Daniel, 21.08.2026). Derzeit steht es als `dub: true` mit einer Notiz, die niemand auswerten kann. **Die Bezugsgröße muss die werkinterne Folgennummer sein, nicht die Staffel des Anbieters** — Daniel am 21.08.2026: „jeder anbieter kann die folgen beliebig in staffeln sortieren, das macht crunchy manchmal ganz anders im vergleich zu prime oder netflix". Netflix teilt Black Clover in vier Staffeln, Crunchyroll zählt bis 170 durch. Eine Angabe „ab Staffel 4 nicht" wäre also anbieterabhängig und damit wertlos |
| **Statusanzeige fürs Handy** | 2 | Die Anzeige liegt unter `C:codeai__assets	oolslauf-status` und startet seit dem 21.08.2026 beim Anmelden von selbst (`Laufstatus.vbs` im Autostart). Für das Handy müsste die Datei nur irgendwo erreichbar liegen — sie fragt eine einzige Adresse ab und braucht keinen Schlüssel. **Zurückgestellt am 21.08.2026:** „die idee mit handy brauchen wir erstmal nicht". Der zweite Rest, ein Fenster das immer oben bleibt, ist mit dem Autostart hinfällig — Daniel schiebt es sich einmal am Monitor zurecht |
| Synchronstudios als Quelle | 8 | **Recherche am 11.08.2026 gemacht, Ergebnis ernüchternd.** Oxygen Sound Studios führt unter [o2studios.com/de/projekte](https://o2studios.com/de/projekte/) eine reine Referenzliste: „Chainsaw Man – Der Film Reze Arc — Deutsche Synchronisation", ohne jedes Datum und ohne Status. Violetmedia ist von hier aus nicht erreichbar (TLS-Handshake bricht ab, wie schon bei aniverse.de). Ein Studio nennt also, **dass** es eine Fassung macht — nicht **wann** sie kommt. Das ist nachvollziehbar: Der Termin gehört dem Lizenznehmer, nicht dem Studio. **Rest-Nutzen:** Die Projektlisten wären ein Beleg dafür, dass eine deutsche Fassung überhaupt existiert oder entsteht — für die `dubConfidence`, nicht für den Kalender. Als Terminquelle zurückgestellt; eine Anfrage lohnt nur, wenn ein Studio überhaupt Termine kennt und nennen dürfte |

### Zu besprechen

**Kalender-Abo enthält ein Jahrzehnt Vergangenheit** (gemessen 20.08.2026). Das ausgelieferte
`all.ics` führt **742 Termine, davon 641 in der Vergangenheit** — 86 Prozent, zurück bis zum
12.01.2015. Wer das Abo einträgt, bekommt das alles in seinen Kalender.

**Warum ich es nicht einfach geändert habe:** Ich hatte ein Rückblick-Fenster von zwölf Monaten
eingebaut und wieder zurückgenommen. Der Nutzen ist kleiner, als er klingt — Kalenderprogramme
zeigen Vergangenes nur, wer zurückblättert —, die Kehrseite dagegen konkret: Bei jedem
Abonnenten **verschwinden** Einträge, die er heute sieht. Das wirkt nach außen, und dafür gilt
die Rückfrageregel.

Gemessene Wirkung, falls du es willst: 365 Tage Rückblick lassen 453 statt 742 Termine übrig
(ältester dann 21.08.2025), die Datei schrumpft von 348 auf 243 KB. Alle 101 künftigen Termine
bleiben in jedem Fall drin, und `events.json` auf der Seite bleibt vollständig — die
Vergangenheit ist dort weiter durchblätterbar.

Drei Möglichkeiten: so lassen, zwölf Monate, oder enger (90 Tage lassen ungefähr 150 vergangene
stehen).

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
