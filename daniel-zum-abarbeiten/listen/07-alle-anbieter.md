# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-10-30 · **39 offene Verweise** in **33 Zeilen**.

Erzeugt von `npm run data:dub-checks`, **nicht von Hand pflegen**. Was geprüft ist, gehört
nach `data/dub-confirmed.yaml`; beim nächsten Lauf verschwindet es hier.

**Eine Zeile ist eine Reihe auf einem Anbieter.** Wer den Verweis öffnet, sieht dort in aller
Regel alle Staffeln auf einmal und kann sie auch auf einmal beantworten. In der letzten Spalte
steht, welche Einträge dieser Reihe dort noch offen sind — bereits Bestätigtes fehlt dort.

Sortiert von heute in die Vergangenheit, ausschließlich Titel, die es schon gibt.

Zum Abarbeiten gibt es dieselben Zeilen in `dub-batches.md` — nach Nutzen sortiert und in
Paketen zu je zwanzig.

## Wie geantwortet wird

Kurzschrift, damit ein Batch in einer Zeile beantwortet werden kann (Daniel, 12.08.2026):

| Zeichen | Bedeutung | wird zu |
|---|---|---|
| `1` | hat deutsche Synchro | `dub: true` |
| `0` | keine deutsche Synchro, nur Untertitel | `dub: false` — Verweis bleibt mit ✕ |
| `x` | kein Video: nicht verfügbar, Verweis tot, Weiterleitung | `available: false` — Verweis wird entfernt |

Stehen in einer Zeile **mehrere** Einträge zum Prüfen, werden die Ergebnisse mit Punkt
getrennt in derselben Reihenfolge angegeben: `1.0` heißt „erster Eintrag ja, zweiter nein".
Eine **einzelne** Angabe gilt für alle Einträge der Zeile.

Beispiel: `1-x 2-1 3-1.0 4-x` — Zeile 1 tot, Zeile 2 Synchro, Zeile 3 erster Eintrag
Synchro und zweiter ohne, Zeile 4 tot.

| Offen je Anbieter | Verweise |
|---|---|
| [Prime Video](07-primevideo.md) | 31 |
| [Netflix](07-netflix.md) | 5 |
| [Disney+](07-disneyplus.md) | 2 |
| [ADN](07-adn.md) | 1 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-10-29 | Puella Magi Madoka Magica | [Hauptserie]() |
| 2 | 2026-10-25 | Meine ganz besondere Hochzeit | [Special]() |
| 3 | 2026-10-22 | All You Need Is Kill | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.8ae81ee2-03f2-4f55-9027-c453f804a727) |
| 4 | 2026-10-15 | Sankarea: Undying Love | [Hauptserie]() |
| 5 | 2026-10-10 | Demon Slayer: Kimetsu no Yaiba | [Mugen Train Arc]() · [Entertainment District Arc]() · [Infinity Castle](https://www.amazon.de/gp/video/detail/B0GZSDPCV4) |
| 6 | 2026-10-06 | My Hero Academia | [Vigilantes](https://www.netflix.com/title/82036361) · [Vigilantes Staffel 2](https://www.netflix.com/title/82036361) |
| 7 | 2026-10-03 | Hände weg, Kotesashi-kun | [Hauptserie](https://www.amazon.de/gp/video/detail/B0FR3P275F) |
| 8 | 2026-09-26 | Welcome to Demon School! Iruma-kun | [Staffel 4](https://www.disneyplus.com/browse/entity-b042544d-cd7d-40c6-9be4-db79666a1b51) |
| 9 | 2026-09-13 | Kuroko’s Basketball: | [Kuroko’s Basketball - Winter Cup Highlights Movie 3 Crossing the Door](https://watch.amazon.de/detail?gti=amzn1.dv.gti.63b9a08d-3318-4dd4-be6f-9f48926fd70b) |
| 10 | 2026-08-29 | Yu-Gi-Oh! (1998) | [Yu-Gi-Oh! GX]() |
| 11 | 2025-11-21 | Scarlet | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.9a001bc0-718e-4acb-8909-aaad6633e395) |
| 12 | 2025-04-03 | Devil May Cry | [Hauptserie](https://www.netflix.com/title/81506915) |
| 13 | 2023-12-15 | Psycho-Pass | [Providence](https://watch.amazon.de/detail?gti=amzn1.dv.gti.3f227d98-2ca8-4ad6-bf0e-07169fe309d8) |
| 14 | 2023-07-23 | NieR:Automata Ver1.1a | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.f447a318-045f-4f1d-871d-f6ac4d53cf8a) |
| 15 | 2023-07-14 | Der Junge und der Reiher | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.a0a1e77c-4dab-4120-9298-b2d49ecb5d9d) |
| 16 | 2022-11-25 | Meine Wiedergeburt als Schleim in einer anderen Welt | [Der Film - Feuerrote Bande](https://watch.amazon.de/detail?gti=amzn1.dv.gti.abac5db1-37b2-44b3-b7eb-cc7a0ddc8e95) |
| 17 | 2021-02-17 | Project Itoh: Genocidal Organ | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.78b91eef-2e25-9512-4024-a8c43ad3e1f9) |
| 18 | 2021-01-08 | Tayo: Der Kleine Bus | [Tayo und die kleinen Zauberer](https://watch.amazon.de/detail?gti=amzn1.dv.gti.0445703e-9803-4665-a6a5-9c1ac591e4b7) |
| 19 | 2020-12-30 | Aya und die Hexe | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.def5b6f7-df33-4eff-9c45-9b72997a7402) |
| 20 | 2020-12-25 | Pokémon | [Mewtu schlägt zurück - Evolution](https://watch.amazon.de/detail?gti=amzn1.dv.gti.40baebee-963d-05df-8082-9aa7c5a15ea7) · [Der Film - Geheimnisse des Dschungels](https://watch.amazon.de/detail?gti=amzn1.dv.gti.2f20592a-93ae-4698-b458-c4496238db0c) |
| 21 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.netflix.com/title/81099976) |
| 22 | 2020-06-26 | Titipo: Der kleine Zug | [Titipo Titipo 2](https://www.amazon.de/gp/video/detail/B0FVF9T7ZP) |
| 23 | 2018-11-09 | Godzilla: Planet der Monster | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.a1b18e96-858e-4960-bf41-2920e0837925) · [Godzilla: Eine Stadt am Rande der Schlacht](https://watch.amazon.de/detail?gti=amzn1.dv.gti.f2e24b4d-774f-4038-9d29-da82d247ed44) · [Godzilla: Zerstörer der Welt](https://watch.amazon.de/detail?gti=amzn1.dv.gti.3a6b794b-7c37-40c1-a043-95c83e5c2682) |
| 24 | 2018-09-29 | Yunas Geisterhaus | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.31c2fcde-089d-47dd-bf2b-09bca0de572f) |
| 25 | 2015-12-06 | Free! Iwatobi Swim Club | [High Speed! Free! Starting Days](https://watch.amazon.de/detail?gti=amzn1.dv.gti.e2b9fee5-686e-dae3-6127-14321a1c7d1c) |
| 26 | 2013-04-13 | Aura: Koga Maryuin’s Last War | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.d2894273-ef85-4257-8ccb-f07be49c0758) |
| 27 | 2013-03-30 | Dragon Ball | [Z: Kampf der Götter](https://watch.amazon.de/detail?gti=amzn1.dv.gti.3b1459a1-1f09-4e3e-a509-00cd5dc4ac50) |
| 28 | 2012-01-26 | Speckles: Die Abenteuer eines Dinosauriers | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.36eedcf2-91ec-4fdc-8b33-80ac2699950d) |
| 29 | 2008-04-19 | Detektiv Conan | [Die Partitur des Grauens](https://watch.amazon.de/detail?gti=amzn1.dv.gti.52b88c64-9014-cd52-2245-089e6c2cf91e) |
| 30 | 2002-07-20 | Das Königreich der Katzen | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.dcf86418-9547-4d15-b4d5-91cf1b3f105f) |
| 31 | 2000-08-25 | Vampire Hunter D | [Bloodlust](https://watch.amazon.de/detail?gti=amzn1.dv.gti.68239688-dba5-4abc-a3b5-5e554d51081f) |
| 32 | 1995-07-15 | Stimme des Herzens: Whisper of the Heart | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.d80cfa8e-16ef-4540-a4da-8b91bf29e1c1) |
| 33 | 1993-03-30 | Christoph Columbus | [Hauptserie](https://watch.amazon.de/detail?gti=amzn1.dv.gti.4ecd1f39-5235-49ff-b803-577d9e035a87) |

## Warum die einzelnen Anbieter unsicher sind

- **ADN:** Der Titel steht nicht im ADN-Bestand mit Sprachcode vde. Möglich, dass er inzwischen dazugekommen ist.
- **Disney+:** Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.
- **Netflix:** Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
