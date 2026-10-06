# Aufträge für Daniel

Alles, wofür ich dich brauche, steht hier — nummeriert, je Punkt ein Link, Vorher / Erwartet / Falsch, wenn …. Während des autonomen Modus (bis 23:30, Start 05.10.2026 13:32) frage ich nicht nach; ich lege sie dir auf Anfrage vor. Erledigtes wird abgehakt und rutscht nach unten.

Stand: 06.10.2026 10:15

## Offen

1. **Tokyo Revengers S3 Folge 2 — stündlich ab Fr 09.10. 19:00 nachsehen** (die Seite zeigt die Zeit „voraussichtlich")
   [Tokyo Revengers S3](https://anime-kalender.de/t/15957/)
   - Vorher: Folge 2 steht mit „Freitag 19:00" laut Disney+-Presse und offizieller Seite.
   - Erwartet: Folge 2 erscheint zur genannten Zeit bei Disney+.
   - Falsch, wenn: Sie erscheint zu einer anderen Zeit oder gar nicht. Dann Zeit in der Meldung berichtigen (News-Meldung, keine Umschreibung).

3. **Favoriten-Umschreibung entfernen — 05.11.2026** (ich mache das; `check:logic` wird dann rot und erinnert)
   - Nur zur Kenntnis: Bis dahin schreiben Browser und Worker alte AniList-Favoriten auf unsere Kennung um.

4. **One Piece: Folgenpfeil, Folgenliste, Disc-Aufklapper ansehen** (alles live seit ca. 20:00)
   [One Piece](https://anime-kalender.de/t/12/)
   - Vorher: kein Pfeil an der Antwort, Folgen ab 11 ohne Flagge als „noch nicht erschienen", die 20 Boxen unter „Disc" nicht erreichbar.
   - Erwartet: Pfeil an der Antwort öffnet die Folgenliste (1180 Folgen, 1119 auf Deutsch); Folgen über 10 ohne „noch nicht erschienen"; unter Disc ein Aufklapper „Einzelausgaben" (19 Ausgaben) mit den Boxen.
   - Falsch, wenn: kein Pfeil, oder Folgen ab 11 tragen „noch nicht erschienen", oder der Aufklapper fehlt. Der Folgenpfeil fehlte bei 1.671 Titeln (Übersetzungsfehler in Stufe 1) und ist jetzt behoben — Stichprobe: [Detektiv Conan](https://anime-kalender.de/t/204/).

5. **Entscheidung: angekündigte Teile in der Reihen-Box** (ich habe eine Wahl getroffen, bei Widerspruch sagen)
   - Du schriebst am 04.10.: Mit „ohne Synchro ausblenden" sollen nur Teile mit belegter Synchro (oder der Titel selbst) in „Teile in dieser Reihe" stehen. Das habe ich so gebaut — auch angekündigte und laufende Teile ohne Synchro sind jetzt hinter dem Schalter (119 Teile). Das widerspricht deiner Entscheidung vom 04.09. („Black Clover Staffel 2 sofort sehen").
   - Prüfen: [Ranma 1/2](https://anime-kalender.de/t/210/) — Staffel 3 (läuft) steht nur noch hinter dem Schalter.
   - Wenn angekündigte Teile sichtbar bleiben sollen: sag es, dann nehme ich nur die laufenden aus (eine Zeile in `reihen-regeln.ts`).

6. **One Piece bei Joyn: Weg und Adresse** (ich trage nichts ein, ohne dass du es bestätigst)
   - Es gibt keinen Joyn-Weg und keinen Beleg für One Piece (JustWatch kennt Joyn nicht, nichts in `dub-confirmed.yaml`); die Adresse `joyn.de/serien/one-piece` antwortet mit 200, ist aber ungeprüft.
   - Entscheidung: Soll ich einen Handbeleg „Joyn führt die zuletzt gesendeten Folgen als rollendes Fenster" ohne Folgenzahl eintragen? Dann bräuchte ich die Adresse, die du gesehen hast.

8. **Entscheidung: tägliche Prüfliste aus dem aniSearch-Dubs-Endpoint** (Messung steht in `docs/wissen/quellen.md`, „aniSearch-Dubs-Endpoint gemessen")
   Der Endpoint nennt 5 + 297 + 72 Titel mit deutscher Synchro, die bei uns fehlen, und 161 Titel von uns, die aniSearch ohne Deutsch führt. Ich würde daraus eine Liste bauen, die nichts automatisch ändert.
   - Sag „ja" oder „nein".

9. **Antwort von Dominik (aniSearch) abwarten**
   Du hast die Mail am 05.10. abgeschickt. Fragen darin: Passt die Quellenzeile, und was heißt „unter Vorbehalt". Bis zur Antwort ändere ich nichts mehr an aniSearch.

10. **Entscheidung: Hosting** (Recherche liegt vor: [hosting-vergleich-2026-10-06.md](file:///C:/code/ai/anime-kalender-de/docs/wissen/hosting-vergleich-2026-10-06.md))
   Empfehlung: GitHub Pages vorerst behalten und Cloudflare (Workers Static Assets, 0 €, Zone liegt schon dort) als zweites Deploy-Ziel vorbereiten. Umschalten, wenn die 30-Tage-Messung (`site_probe`) unter 99,9 % liegt oder ein Ausfall der ausgelieferten Seite belegt ist. Pages bleibt dann als Rückfall.
   - Sag „so", oder was du anders willst (z. B. gleich eigener Server).

## Entscheidungen, die ich getroffen habe (zur Kenntnis, bei Widerspruch sagen)

- Domains für Belege: Reihenfolge Joyn, Disney+, Netflix, Wikipedia, Kinoheld, Amazon — jede erst nach Handprüfung auf Banner und Wand.
- Ankündigungen: Eintrag bleibt am Fundtag, das ältere Quelldatum steht im Satz („— laut anime2you.de vom 21.08.").
- Beleg-HTML bleibt privat; öffentlich nur Bild, Prüfdaten und Original-Link.
- Crunchyroll-Serienseiten werden nicht fotografiert (Sony-Banner, Nutzungsbedingungen, schwarze Aufnahme).

## Erledigt

- Stufe 1 und 1d der eigenen Kennungen (Seite spricht `ak`, `/t/<ak>/`, Favoriten umgezogen).
- Testmail in Gmail angekommen; Adressen-Vorschlag `/t/<ak>/` bestätigt.
- D1-Kontingent: Vollexporte in R2, Verbrauch unter 25 %.
