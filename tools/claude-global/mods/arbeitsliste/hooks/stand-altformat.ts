// Echter Ausschnitt aus daniel-zum-abarbeiten/stand.md (Altformat, Stand 16.10.2026 15:14): Kopf, Top-Prios, Neu und live testbar.
// Erzeugt mit dem Skript des PR 1357; nur Testdaten.
export const STAND_ALTFORMAT = [
  "# Stand (für Daniel)",
  "",
  "Aktualisiert: 16.10.2026 15:32 (autonomer Modus bis 23:30, Ruhemodus aus seit 10:31)",
  "",
  "## Top-Prios",
  "- **D1** — heute 1,29 Mio. Zeilen gelesen (25,8 % des Tagesdeckels, 14:01), 5.935 geschrieben (5,9 %). Zuordner kennt jetzt Cartoons und Handbelege (≈ 15.700 Folgenzeilen weniger je Bau, Prüfer fand einen Fehler bei Disney-Sprachcodes, wird nachgebessert). Danach Schritte 1–3 (Altzeilen abhaken, Rest parken, Cache), dann Probeläufe je Anbieter mit dir.",
  "- **Speed (Kleinigkeit in unter 5 min live)** — Heute Auftrag bis live im Median 74 min. Live seit 14:07: Vorprüfung vor dem PR (fängt Beschreibungsfehler vor dem Push). Live seit 14:20: Deploy bricht nicht mehr grundlos ab (vorher 119 Fehlabbrüche in 7 Tagen; Nachmessung nach 5 Deploys, morgen, 23.10.). In Arbeit: Prüfkette parallel statt nacheinander (heute 4,9 min, Ziel ≈ 2,3), danach Deploy direkt aus dem geprüften Build (≈ 1 statt 3,3 min). Damit ≈ 4,4 min. Berichte: [Engpass](file:///C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/berichte/workflow-engpass-2026-10-16.md), [Gegenentwurf](file:///C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/berichte/schnellweg-gegenentwurf-2026-10-16.md)",
  "- **Unzuordenbare Folgen** — Rest ≈ 1.680 Folgen nach dem Cartoon-Fix, Ursachen alle geklärt ([Bericht](file:///C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/berichte/d1-rest-ursachen-2026-10-16.md)). In Arbeit, Prüfer fand je eine Lücke, beide werden nachgebessert: Adressen aus Handbelegen (321 Folgen, z. B. Angry Birds Toons; Test las die echte statt der Testdatei) und Zuordner-Lücken (Staffeln derselben Reihe, TMDB als zweiter Anker; Gefahr falscher Staffel bei gleichem Datum und Platzhaltertiteln „Folge n“) — danach ≈ 700 übrig (geschätzt). Netflix-Doppelstaffeln: F23. Dann zeige ich dir den Rest.",
  "",
  "## Neu und live testbar (Zeilen `- [JJJJ-MM-TT HH:MM] Kurztext — [Link](https://…)`; nur Sichtbares mit Mehrwert; Pflege löscht Einträge nach 2 Tagen)",
  "- [2026-10-16 14:14] **Avatar – Die sieben Häfen erscheint um ≈ 11:00** (deine Ansage); der Hinweis an der Uhrzeit sagt „Voraussichtlich, nicht gemessen“ — [Avatar im Panel](https://anime-kalender.de/#/datenbank?t=-284833)",
  "- [2026-10-15 16:30] **Tomb Raider King: Folge 12 jetzt am 21.10. (geschätzt), weil das Original eine Woche Pause hatte; der Beleg „nicht erschienen“ zeigt zusätzlich das Crunchyroll-Wochenprogramm mit markierter Kachel**; Dialog springt zur Kachel (live geprüft 16:25, mobil und Desktop, beide Themen, keine Konsolenfehler) — [Tomb Raider King](https://anime-kalender.de/t/16348/#/woche?t=16348)",
  "- [2026-10-14 15:45] **Durarara!! Frieden im ganzen Land zeigt jetzt Crunchyroll** (dein Hinweis von gestern) — [Durarara im Panel](https://anime-kalender.de/#/datenbank?t=18055)",
].join('\n') + '\n'
