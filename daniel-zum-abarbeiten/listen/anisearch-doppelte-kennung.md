# aniSearch: dieselbe Kennung bei mehreren Titeln — Fraglich

Stand 2026-10-12. Gemessen an `public/data/titles.json`: **42 Kennungen, 117 Titel**; alle 42 sind gewollt (Handdatei bindet sie, aniSearch führt Filmreihen und Serie samt Special auf einer Seite).
Nichts davon ist geändert. Hier stehen die Fälle, die nicht eindeutig belegt sind. Quelle: lokale Archivseiten `data/anisearch-raw/<Kennung>.html.gz`, kein Abruf.

## Titel, deren Seite nicht sicher zu ihnen passt

| Titel (AniList-Kennung) | Jahr | Umfang | aniSearch-Seite | Grund |
|---|---|---|---|---|
| Durarara!! Specials (8408) | 2010 | 2 Folgen | 5473 (Serie, 24 Folgen) | aniSearch führt die zwei Specials als eigene Bonus-Seiten 6984 und 6986 (je 1 Folge, MAL 8408); Handbindung stammt von Dominik (06.10.), „Folgen 12.5 und 25". Die Zeilen 10006984/10006986 stehen zusätzlich in `ohne-synchro.json`. |
| Ghost in the Shell SAC: The Laughing Man – Tachikoma no Hibi (10947) | 2005 | 1 Folge | 4405 („Bonus, 26", 2002–2003) | Jahr und Folgenzahl der Seite passen nicht zum Titel; ein eigener Eintrag für das Special aus 2005 ist lokal nicht zu sehen (Seite nicht abgerufen). |
| AFRO SAMURAI Movie (13709) | 2007 | 1 Film | 1119 (Serie, 5 Folgen) | Zusammenschnitt der Serie; aniSearch führt dazu keine eigene Film-Seite (nur „Resurrection" und „Pilot Film" in den Beziehungen). Vermutlich richtig, nur nicht belegt. |

## Vorübergehend doppelt (heilt beim nächsten Abruf, nachmessen)

Dieselbe Kennung steht in `titles.json` (aniSearch-Zeile mit Deutsch) und in `ohne-synchro.json` (AniList-Titel). `data/anisearch-dubs.json` führt die AniList-Titel seit 12.10. 05:30 mit `d`; `fetch.ts` holt sie dann ins Hauptbestand (`ausAnisearchDubs`), die Zeile entfällt. Bleibt das Paar nach dem nächsten Datenlauf stehen, gehört es in `data/anisearch-ids-hand.yaml`.

| Titel | Jahr | Umfang | Zeile / AniList | aniSearch |
|---|---|---|---|---|
| BeyWheelz | 2012 | TV, 13 | 10014517 / 136668 | 14517 |
| Spycies: Zwei tierisch coole Agenten | 2020 | Film | 10014868 / 163696 | 14868 |
| Titipo Titipo 2 | 2019 | TV, 26 | 10017355 / 188067 | 17355 |
| Rick and Morty: The Anime | 2024 | TV, 10 | 10019445 / 150103 | 19445 |
| Der Herr der Ringe: Die Schlacht der Rohirrim | 2024 | Film | 10019566 / 185613 | 19566 |
