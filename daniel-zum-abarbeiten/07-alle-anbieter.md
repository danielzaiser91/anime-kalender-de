# Prüfliste: Wo läuft es wirklich auf Deutsch?

Stand 2026-09-17 · **16 offene Verweise** in **11 Zeilen**.

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
| [Prime Video](07-primevideo.md) | 11 |
| [Crunchyroll](07-crunchyroll.md) | 5 |

## Zu prüfen

| # | Datum | Reihe | Noch zu bestätigen |
|---|---|---|---|
| 1 | 2026-03-31 | Classroom of the Elite | [Hauptserie](https://www.amazon.de/dp/B0GGJKGT5P) |
| 2 | 2022-12-29 | Patema Inverted: Beginning of the Day | [Patema Inverted](https://www.amazon.de/dp/B0CMHJ7FCB) |
| 3 | 2021-09-28 | Princess Principal | [Picture Drama](https://www.crunchyroll.com/de/series/GEXH3W414/princess-principal) · [Crown Handler - Chapter 1: BUSY EASY MONEY](https://www.crunchyroll.com/de/series/GEXH3W414/princess-principal) |
| 4 | 2020-11-24 | Tsubasa Chronicle | [2](https://www.amazon.de/dp/B0CHQSJDSB) |
| 5 | 2020-03-27 | One Punch Man | [OVAs](https://www.crunchyroll.com/de/series/G63K98PZ6/one-punch-man) · [Staffel 2 OVAs](https://www.crunchyroll.com/de/series/G63K98PZ6/one-punch-man) |
| 6 | 2019-04-01 | Captain Tsubasa: Die tollen Fußballstars | [Captain Tsubasa](https://www.crunchyroll.com/series/GZJH3D7G9/captain-tsubasa) |
| 7 | 2011-07-16 | Pokémon | [Der Film - Weiß: Victini und Zekrom](https://www.amazon.de/dp/B01ASXCBV4) |
| 8 | 2010-01-23 | Yu☆Gi☆Oh! | [Yu-Gi-Oh!: Bonds Beyond Time](https://www.amazon.de/dp/B0CPST368C) |
| 9 | 2008-04-19 | Detektiv Conan | [Der Magier des letzten Jahrhunderts](https://www.amazon.de/dp/B0CHLNLGXR) · [Der Killer in ihren Augen](https://www.amazon.de/dp/B0CHPN1F7G) · [Das Phantom der Baker Street](https://www.amazon.de/dp/B0751KL252) · [Die Partitur des Grauens](https://www.amazon.de/dp/B0CGHZLCMK) |
| 10 | 2005-09-14 | Final Fantasy VII: Advent Children | [Hauptserie](https://www.amazon.de/dp/B00FYUILJ8) |
| 11 | 2004-08-21 | Naruto | [The Movie - Geheimmission im Land des ewigen Schnees](https://www.amazon.de/dp/B0G43M2BNY) |

## Warum die einzelnen Anbieter unsicher sind

- **Crunchyroll:** Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.
- **Prime Video:** Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.
