# F100: Staffelsumme – Plan, Messung, Stand (02.11.2026)

Auftrag: `vorrat/a-f100-staffelsumme-mehrfach.md` (Daniel 01.11.2026: Summe plus mindestens ein unabhängiges Merkmal, Rest von Hand zuordnen).

## Untergrenze und Ansätze

- **Untergrenze:** Versatz = Summe der früheren Staffeln laut JustWatch (`data/justwatch-audio.json`), ohne Bestätigung. Einfach, aber falsch, wo JustWatch anders zählt als Netflix.
- **Ansatz A (gebaut):** Summe als Vorschlag, Bestätigung durch Folgentitel (`folgenZuTitel` gegen unsere Folgenliste, Regel wie `ordneBlockZu`: mindestens 2 Treffer am Versatz, mindestens 80 % der eindeutigen Treffer).
- **Ansatz B (verworfen):** Versatz allein aus den Folgentiteln (`ordneBlockZu` ohne Summe). Scheitert, wo Netflix keine Titel meldet (Beyblade X: 0 von 49) oder Doppelfolgen meldet (Shaun).

## Messung (Meldungskopie 02.11.2026 03:01, Skripte im Scratchpad `f100/poc1.mjs`–`poc8.ts`)

13 Netflix-/Disney-Adressen haben eine Anbieter-Liste, die nicht bei Staffel 1 beginnt (454 Meldungen, davon 64 offen). Bei vier Titeln mit Titeln in der Meldung stimmen JustWatch-Summe und Titelversatz überein:

| Titel | JW-Summe | Titelversatz | Treffer |
|---|---|---|---|
| Kleine Prinzessin | 30 | 30 | 30 von 34 eindeutigen (88 %) |
| Heidi | 65 | 65 | 26 von 26 |
| LEGO Friends | 16 | 16 | 26 von 26 |
| Beyblade X (RTL+ Staffel 2 gegen aniSearch) | 51 | 51 | 14 von 15 (Netflix selbst meldet keine Titel) |

Die Summe allein trägt nicht: Alvinnn!!! (JW 208, Titel 211/215 gleich stark) und EarthSpark (JW 26, Handbeleg 23) weichen ab. Das ist der Grund für die Bestätigung. Schwelle 80 % und mindestens 2 Treffer: die schwächste Messung (Kleine Prinzessin) liegt bei 88 %.

Beschreibungen: die Meldungskopie führt keine Netflix-Folgenbeschreibungen (Spalten `folge`/`rohfolge` leer für Netflix), ein Beschreibungs-Treffer ist deshalb nicht messbar; Folgentitel tragen die Bestätigung.

## Gebaut

- `pipeline/lib/staffelsumme.ts`: Summe, Bestätigung, Vermerktext, Wächter-Funktion. `pipeline/check-staffelsumme.ts` (33 Fälle, in `check-logic-liste.txt`); `lib/staffelsumme-gruppe.ts` verdrahtet sie in `fetch-pruefungen.ts` (die Datei schrumpft dabei von 1302 auf 1297 Zeilen), Laufzeittest `check-fetch-pruefungen-laufzeit.ts` mit sieben Szenarien der Summe.
- `check:handbelege`: jede Umrechnung mit "Staffelsumme" braucht "bestätigt durch:" (Prozesstest in `check-handbelege-anbieter-zaehlung-lauf.ts`).
- Schnellweg `tools/staffelsumme-vorschau.ts`: Beyblade X Netflix Staffel 2 Folge 1..49 = unsere 52..100.
- Daten: Beyblade X Netflix 53–99 wird 52–100 (alle 49 Meldungen belegt, Folge 1 und 49 waren "nicht geprüft", sind aber gemeldet). Shaun das Schaf Netflix: Staffel 4 und 5 = unsere 101–150 ohne deutschen Ton (Doppelfolgen, 19 von 25 Titeln exakt, Rest im selben Block).

## Stand / offen

- Im Bau (Meldung → Handbeleg über `fetch-pruefungen.ts`) verdrahtet: `summeFuerGruppe` vor dem Abbruch "Liste beginnt bei Staffel N", `verteileMeldungen` rechnet über `nummerUeberSumme` um, der Vermerk landet in der Notiz des Belegs. Titel zur Bestätigung: Netflix-Notiz, sonst RTL+ (Beyblade X).
- Offen (Handzuordnung nicht möglich): Willkommen bei den Louds (39 Meldungen; die Netflix-Folgentitel unter der Adresse 81186971 lauten "Echte Freunde", "Hilfe, Vampire!", "Barbie, Brownies und Bären!" und stehen in keiner unserer Louds-Listen: Verdacht auf falsche Adresse), Rainbow High (10 Meldungen, Netflix nennt nur "Teil 1–5", keine Beschreibung in der Kopie).
- Ratsche: `check:handbelege` zählt die Netflix-Listen ab Staffel > 1 ohne Umrechnungsvermerk und vergleicht mit `OFFEN_OHNE_ZUORDNUNG` (Louds, Rainbow High; Louds steht noch nicht in `anbieter-staffeln.json`).
