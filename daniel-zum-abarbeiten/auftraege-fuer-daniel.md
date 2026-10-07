# Aufträge für Daniel

Alles, wofür ich dich brauche, steht hier — nummeriert, je Punkt ein Link, Vorher / Erwartet / Falsch, wenn …. Im autonomen Modus (bis 23:30, 07.10.2026) frage ich nicht nach; ich lege sie dir auf Anfrage vor. Erledigtes wird abgehakt und rutscht nach unten.

Stand: 07.10.2026 09:00

## Datiert (nach Datum, das früheste zuerst)

1. **Tokyo Revengers S3 Folge 2 — Fr 09.10. ab 19:00 stündlich nachsehen** (die Seite zeigt die Zeit „voraussichtlich")
   [Tokyo Revengers S3](https://anime-kalender.de/t/15957/)
   - Vorher: Folge 2 steht mit „Freitag 19:00" laut Disney+-Presse und offizieller Seite.
   - Erwartet: Folge 2 erscheint zur genannten Zeit bei Disney+.
   - Falsch, wenn: Sie erscheint zu einer anderen Zeit oder gar nicht. Dann Zeit in der Meldung berichtigen (News-Meldung, keine Umschreibung).

2. **Favoriten-Umschreibung entfernen — 05.11.2026** (ich mache das; `check:logic` wird dann rot und erinnert)
   - Nur zur Kenntnis: Bis dahin schreiben Browser und Worker alte AniList-Favoriten auf unsere Kennung um.

## Offen

3. **Beleg-Fenster am Desktop lesbar machen** (dein #2 — ich gehe davon aus, dass du das Beleg-Fenster meinst; sag, wenn nicht)
   Das Seitenbild steht bis 1.800 px breit und wird auf einem Desktop verkleinert, die Schrift ist dann zu klein. Drei Wege, mein Vorschlag ist A:
   - **A — Ausschnitt zuerst:** Das Fenster zeigt oben die markierte Fundstelle als Ausschnitt in Lesegröße (Bild um die Marke zugeschnitten, mit Rand), darunter die ganze Seite; „Ganze Seite" klappt sie auf. Auf dem Handy dasselbe, der Kopftext ist schon auf zwei Zeilen gekürzt.
   - **B — Direkt zur Fundstelle:** Das Fenster öffnet in 100 % Größe an der Marke; gelesen wird durch Scrollen.
   - **C — Lupe:** Das Bild bleibt klein, ein Klick vergrößert den Bereich unter dem Zeiger.
   - Sag „A", „B" oder „C".

7. **GitHub-Secret `ANISEARCH_TOKEN` anlegen** (damit der Wochenlauf aniSearch-Einträge holen kann; ohne Token antwortet die API mit 403)
   - Vorher: Ich hole die Einträge von diesem Rechner aus (Token aus `my_secrets.md`, 1 Abruf alle 5 Sekunden). Der Wochenlauf überspringt den Schritt mit Warnung.
   - Auftrag: Im Terminal `gh secret set ANISEARCH_TOKEN --repo danielzaiser91/anime-kalender-de` ausführen und den Wert aus `my_secrets.md` (Abschnitt „aniSearch-API-Token“) einfügen. Einen Token trage ich selbst nirgends ein.
   - Erwartet: Beim nächsten Wochenlauf steht im Protokoll „aniSearch-Einträge: N in diesem Lauf“.

4. **Entscheidung: Hosting** (Recherche liegt vor: [hosting-vergleich-2026-10-06.md](file:///C:/code/ai/anime-kalender-de/docs/wissen/hosting-vergleich-2026-10-06.md))
   Empfehlung: GitHub Pages vorerst behalten und Cloudflare (Workers Static Assets, 0 €, Zone liegt schon dort) als zweites Deploy-Ziel vorbereiten. Umschalten, wenn die 30-Tage-Messung (`site_probe`) unter 99,9 % liegt oder ein Ausfall der ausgelieferten Seite belegt ist. Pages bleibt dann als Rückfall.
   - Sag „so", oder was du anders willst (z. B. gleich eigener Server).


## Entscheidungen, die ich getroffen habe (zur Kenntnis, bei Widerspruch sagen)

- Domains für Belege: Reihenfolge Joyn, Disney+, Netflix, Wikipedia, Kinoheld, Amazon — jede erst nach Handprüfung auf Banner und Wand.
- Ankündigungen: Eintrag bleibt am Fundtag, das ältere Quelldatum steht im Satz („— laut anime2you.de vom 21.08.").
- Beleg-HTML bleibt privat; öffentlich nur Bild, Prüfdaten und Original-Link.
- Crunchyroll-Serienseiten werden nicht fotografiert (Sony-Banner, Nutzungsbedingungen, schwarze Aufnahme).
- Black Clover Staffel 2 und ähnliche Teile ohne belegte Synchro stehen in der Reihenliste hinter dem Schalter mit „DE ✕" (14 Titel, 07.10.2026).
- aniSearch ist die Grundlage der Einträge (Daniel, 06.10.2026); Plan und Zahlen in `status.md` („AUFGABE aniSearch-Einträge vollständig").

## Erledigt

- TMDB-Logo heruntergeladen und im Impressum eingebunden (07.10.2026, [Impressum](https://anime-kalender.de/#/impressum)).
- Antwort an Dominik (aniSearch) abgeschickt (06.10.2026).
- Cover-Rückfall: „nichtkommerziell" bestätigt (06.10.2026); TMDB-Plakate für die Vergrößerung in Arbeit.
- One Piece Folgenpfeil und Folgenliste: von dir gesehen, in Ordnung.
- Handprüfung E/G abgeschlossen (alle 14 Urteile durch den Dub-Endpunkt bestätigt).
- Stufe 1 und 1d der eigenen Kennungen (Seite spricht `ak`, `/t/<ak>/`, Favoriten umgezogen).
- Testmail in Gmail angekommen; Adressen-Vorschlag `/t/<ak>/` bestätigt.
- D1-Kontingent: Vollexporte in R2, Verbrauch unter 25 %.
