# Gegenprobe: führt JustWatchs Amazon-Link auf unsere Seite?

**Abgeschlossen 17.09.2026, 18:42:** 8 von 8 lebenden Seiten tragen JustWatchs gti; die tote Seite (Zeile 9) findet ihren Ersatz über JustWatchs Weiterleitung. Ursprünglich: Zeile 1 ist entschieden: Die Seite nennt als `catalogId` genau JustWatchs gti. Amazon führt je Titel mindestens vier Kennungen (Link-ASIN `B0B8TR93HR`, `pageTitleId` `B0B8TQBBS6`, 26-stellige Adresse, gti). Verglichen wird deshalb die gti.

**Für Zeile 2 bis 9:** nur **unseren Link** öffnen, das Skript [`tools/amazon-kennungen-messen.js`](file:///C:/code/ai/anime-kalender-de/tools/amazon-kennungen-messen.js) in die Konsole (F12) einfügen und das Ergebnis aus der Zwischenablage schicken. Sie sagt selbst, ob die Seite die JustWatch-gti einer Zeile trägt. Zeile 9 ist der kritische Fall mit toter ASIN: Dort ist „Seite nicht gefunden" die erwartete Antwort.

| # | Titel | unser Link | JustWatch-Link |
|---|---|---|---|
| 1 | Cowboy Bebop: Der Film | [B0B8TR93HR](https://www.amazon.de/dp/B0B8TR93HR) | [Amazon Video BUY](https://watch.amazon.de/detail?gti=amzn1.dv.gti.f094ed7f-41c0-4692-99d8-ae469c2ad935) |
| 2 | Vampire Hunter D | [B0GJS98J3L](https://www.amazon.de/dp/B0GJS98J3L) | [Amazon Video RENT](https://watch.amazon.de/detail?gti=amzn1.dv.gti.124692a7-6dd2-4f93-b099-a60ffc917fbc) |
| 3 | Naruto: The Movie 3 - Die Hüter des Sichelmondreiches | [B01HSH3W3E](https://www.amazon.de/dp/B01HSH3W3E) | [RTL+ Max Amazon Channel FLATRATE](https://watch.amazon.de/detail?gti=amzn1.dv.gti.e4aad14d-365a-1308-5e8d-51d225df7177) |
| 4 | Evangelion: 2.22 - You Can (Not) Advance. | [B0FPM4KVVM](https://www.amazon.de/dp/B0FPM4KVVM) | [Amazon Video RENT](https://watch.amazon.de/detail?gti=amzn1.dv.gti.fdd997fe-4acd-4348-a926-a7cda983026d) |
| 5 | K-On! The Movie | [B0CKPFDTQQ](https://www.amazon.de/dp/B0CKPFDTQQ) | [Crunchyroll Amazon Channel FLATRATE](https://watch.amazon.de/detail?gti=amzn1.dv.gti.eb29c573-fe12-4060-a4b0-3e2d4d9c5acf) |
| 6 | Pokémon Origins | [B0170N47P8](https://www.amazon.de/dp/B0170N47P8) | [Amazon Video BUY](https://watch.amazon.de/detail?gti=amzn1.dv.gti.22a9f6dc-01df-9e1a-0ffc-fcc73d2b5778) |
| 7 | Detektiv Conan: Die Sonnenblumen des Infernos | [B0FWY92KD3](https://www.amazon.de/dp/B0FWY92KD3) | [Amazon Video BUY](https://watch.amazon.de/detail?gti=amzn1.dv.gti.c2b90e12-85ff-afcf-0914-b7cdc28c7f0f) |
| 8 | Liz und der Blaue Vogel | [B0FPB92278](https://www.amazon.de/dp/B0FPB92278) | [Amazon Video RENT](https://watch.amazon.de/detail?gti=amzn1.dv.gti.e0b92698-9683-46dd-a03e-2caff0878b85) |
| 9 | Afro Samurai — **unsere ASIN ist tot** | [B0CGS2DRMV](https://www.amazon.de/dp/B0CGS2DRMV) | [Crunchyroll Amazon Channel FLATRATE](https://watch.amazon.de/detail?gti=amzn1.dv.gti.ca1b18e0-a3bf-477f-8e67-ecfe82f1a871) |

## Ergebnisse

| # | Messung (17.09.2026) | gti gleich? |
|---|---|---|
| 1 | Link-ASIN B0B8TR93HR, pageTitleId B0B8TQBBS6, catalogId = JustWatch-gti | ja |
| 2 | /dp/B0GJS98J3L, pageTitleId B0GJS98J3L, catalogId = JustWatch-gti | ja |
| 3 | /dp/B01HSH3W3E, pageTitleId B01HSH3W3E, catalogId = JustWatch-gti (RTL+-Kanal) | ja |
| 4 | /dp/B0FPM4KVVM, pageTitleId B0FPM4KVVM, catalogId = JustWatch-gti | ja |
| 5 | /dp/B0CKPFDTQQ, pageTitleId B0CKPFDTQQ, catalogId = JustWatch-gti (Crunchyroll-Kanal) | ja |
| 6 | /dp/B0170N47P8, pageTitleId B0170N47P8, catalogId = JustWatch-gti | ja |
| 7 | /dp/B0FWY92KD3, pageTitleId **B0FV8PGNQ8** (weicht von der Link-ASIN ab), catalogId = JustWatch-gti | ja |
| 8 | /dp/B0FPB92278, pageTitleId B0FPB92278, catalogId = JustWatch-gti | ja |
| 9a | unser Link /dp/B0CGS2DRMV: „Seite nicht gefunden" (erwartet) | — |
| 9b | JustWatch-Link (gti ca1b18e0…) leitet weiter auf /gp/video/detail/0R4CS7G3NT1H60K640P2L18PKH, pageTitleId B0GVQ26CY4, catalogId **6fa106dc…** | **nein** — Amazon leitet die alte gti auf eine Seite mit neuer gti |
| 9c | Zielseite von 9b ist Afro Samurai, Staffel 1 (2007), Crunchyroll-Kanal, Wiedergabesprache nur English (Daniels Bild) — derselbe Titel wie unser toter Link (1292) | Weiterleitung trägt |

**Befund Zeile 9:** Für lebende Seiten genügt der gti-Vergleich (6 von 6). Bei einer toten Seite hat Amazon den Titel unter einer neuen gti neu angelegt; JustWatchs alte gti leitet dorthin weiter. Ein reiner Kennungsvergleich findet den Ersatz also nicht, das Verfolgen der Weiterleitung schon — und das geht nur in einer Browsersitzung, nicht aus der Cloud (robots.txt).
