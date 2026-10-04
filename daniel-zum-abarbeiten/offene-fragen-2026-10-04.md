# Offene Fragen und Handprüfungen für Daniel (gesammelt im autonomen Modus, 04.10.2026 ab 18:12)

Alles, wofür ich dich brauche, steht hier; ich arbeite mit allem anderen weiter. Erledigtes wird gestrichen.

## Entscheidungen

1. **Konzept eigene Kennungen statt AniList-IDs** ([konzept-eigene-ids.md](file:///C:/code/ai/anime-kalender-de/docs/wissen/konzept-eigene-ids.md)): eigene, nie wiederverwendete Zahl (`ak`) je Titel, aniSearch als Quelle, AniList/MAL/TMDB nur als Zuordnung; wegfallende und zusammengelegte Titel bleiben mit Weiterleitung. Drei Fragen stehen am Ende des Konzepts: einverstanden? Wie lange gelten alte Adressen (`t=<AniList-ID>`; mein Vorschlag sechs Monate nach der Abschaltung von AniList als Quelle)? Umstellung vor dem Katalog-Lauf (mein Vorschlag)?
2. **Cover:** Recherche steht in [quellen.md](file:///C:/code/ai/anime-kalender-de/docs/wissen/quellen.md) (Abschnitt „Cover-Bilder"). Kurz: Bei uns sind es nur Verweise auf AniLists Server; eine bedenkenlos freie Alternative gibt es nicht. Vorschlag stufenweise (AniList behalten, bei aniSearch nachfragen, TMDB mit Attribution als Rückfall). **Dein Teil:** in deine offene Mail an `api@anisearch.com` die Frage aufnehmen, ob wir ihre Cover verlinken dürfen.

## Handprüfungen

- Handprüfung **E/G** (`daniel-zum-abarbeiten/handpruefung-E-G.html`), später.
- **Prüfaufträge, umgesetzt am 04.10.2026 (Gegenprobe nach dem Deploy, ca. 21:25 Uhr):** (1) Filterleiste: bei geöffnetem „mehr Filter" bleibt die Leiste mit dem Knopf sichtbar, nur der Inhalt scrollt; (2) Schnellfilter: untere Hälften füllen ihre Zelle, die Zeichen stehen mittig; (3) Kopfzeile der Datenbank: drei Schalter in einer Zeile, darunter „N Ergebnisse (gebündelt) · davon Flagge N Anime und M Cartoons · … ohne Flagge"; (4) Folgenliste: Anzahl und Minuten ohne Aufklappen, „Noch nicht erschienen" statt „keine Synchro belegt" bei Folgen in der Zukunft (Folgentitel kommen mit den aniSearch-Läufen, die Titel sind bereits in `data/anisearch-folgen.json` vorgesehen). Dazu Detail-Panel: Neuigkeiten und Handlung als Karten.
- 📅 **KALENDER-NOTIZ — Fr 09.10., 19:00 Uhr: Tokyo Revengers S3 Folge 2 bei Disney+ nachsehen (stündlich, bis sie erscheint).** Bleibt hier stehen, bis du nachgesehen und Bescheid gegeben hast; ich erinnere dich am Freitag noch einmal. Deine eigene Handy-Erinnerung steht (Daniel, 04.10.2026).
  - **Stand der Belege (Rangfolge nach Daniel):** (1) offizielle Serienseite [tokyo-revengers-anime.com/news/archives/4935](https://tokyo-revengers-anime.com/news/archives/4935): Disney+ weltweit, freitags 2:00 Uhr (Nachtzählung, = Samstag 02:00 JST = **Freitag 19:00 Uhr MESZ**; Daniel hat die japanische Seite übersetzt und bestätigt); (2) Disney+-Pressemeldung Oktober (Premiere 02.10., Folgen freitags, keine Uhrzeit); (3) Anime2You nennt „samstags 19:00 Uhr". Ergänzend: Disney+ Brasilien „freitags 14:00" (= 17:00 UTC), Kaizen-Anime-Kalender „Freitag 19 Uhr". Wir folgen den offiziellen Quellen; der Unterschied zu Anime2You steht offen im Hinweis am Release.
  - **Vorher (Kalender):** Wöchentlich freitags um 19:00 Uhr (Folge 2 am 09.10.), ab 30.10. um 18:00 Uhr (Winterzeit, gleiche Sendezeit in Japan); die News-Meldung vom 04.10. nennt Freitag 19 Uhr und Anime2Yous Samstag hinter „mehr".
  - **Nachher (was du findest):** Disney+ zeigt Folge 2 als „Neue Folge" am **Fr 09.10. um 19:00** — oder erst später (dann hat Anime2You recht).
  - **Auftrag:** Am Freitag, 09.10., **ab 19:00 Uhr stündlich** in der Disney+-App nachsehen ([Tokyo Revengers bei Disney+](https://www.disneyplus.com/de-de/browse/entity-be391742-6617-42ad-b53a-be368ee73335), Staffel 3 wählen), bis Folge 2 da ist; die erste Uhrzeit mit „Neue Folge" notieren (Tag + Minute). Kommt sie erst samstags, korrigiere ich Kalender und Wochentakt und berichtige per News-Meldung mit unserem Beleg. Gleiches für Folge 3: Fr 16.10. ab 19:00.

## Betrieb (04.10.2026, 22:00)

- 📅 **Testmail:** Um 21:52 habe ich von `daniel-zaiser@daniel-zaiser.de` an `info@daniel-zaiser.de` geschrieben (Betreff „Test Weiterleitung info@ -> Googlemail (04.10.2026)"; PurelyMail hat sie angenommen). **Dein Teil:** In Gmail nach diesem Betreff suchen (Posteingang und Spam) und mir sagen, ob sie da ist.
- ⏳ **Resend:** DKIM „verified", SPF und Rücklauf noch „pending" (Stand 21:55); die Mail um 07:00 sollte im Posteingang landen.

## Wartet auf Dritte

- aniSearch-**Token** (Antrag ist draußen).
