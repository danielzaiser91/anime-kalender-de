---
name: stille-ausfaelle-verhindern
description: "Bei Code, der Daten verwirft, überspringt oder bedingt übernimmt (Filter, Zuordnung, Import, Riegel): jeden Verwerfungspfad zählen, benennen und melden."
---

# Stille Ausfälle verhindern

## Der Anlass

Am 20.09.2026 fiel Daniel im Kalender auf, dass „Das Band der Unterwelt" fehlte: Crunchyroll
hatte Folge 21 am Vortag mit deutschem Ton veröffentlicht, unsere Seite zeigte nichts. Ursache
war eine Zeile in der Terminableitung:

```ts
/* Riegel 2: die Folgenzahl geht exakt auf, oder die ganze Serie fällt. */
if (folgen.length !== titel.episodes) return []
```

Der Riegel ist richtig — er verhindert, dass ein fremder Block einem Titel zugeschlagen wird.
Falsch war, **was danach passierte: nichts.** Keine Zahl im Lauf, kein Eintrag in einer Liste,
keine Warnung. 210 Serien fielen so durch, und keine davon war je als Frage sichtbar.

Daniels Ansage: „wenn du bei entwicklung dran gedacht hättest das im fall von kein datum bei der
condition mit datum die serien alarmlos durchfallen, hättest du sie wenigstens auf ne manuelle
prüfliste oder so packen können … sodass du bei entwicklung alle pfade logisch durchdenkst, und
solche fälle im voraus verhinderst, bzw korrekt selbstständig informiert wirst, ohne das es mir
auffallen muss und ich es melde."

## Die Regel

**Jeder Pfad, der Daten verwirft, hinterlässt eine Spur.** Wer `continue`, `return []`,
`filter(...)` oder `if (!passt) …` schreibt, beantwortet im selben Zug drei Fragen:

1. **Wie viele?** Ein Zähler je Grund, nicht einer für alles.
2. **Wer erfährt es?** Eine Zeile im Lauf-Protokoll ist das Minimum; was jemand ansehen soll,
   gehört zusätzlich in eine Datei (Arbeitsliste, Prüfliste, Bericht).
3. **Woran erkennt man, dass es zu viel ist?** Eine Zahl ohne Erwartung sagt nichts. Entweder
   ein Vergleich mit dem letzten Lauf, oder eine Schwelle, ab der die Meldung auffällig wird.

**Prüffrage vor jedem Verwerfen: Wenn dieser Zweig morgen hundertmal greift — wer merkt es?**
Lautet die Antwort „niemand", ist der Zweig nicht fertig.

## Drei Stufen, je nach Gewicht

| Was verworfen wird | Mindestens | Beispiel |
|---|---|---|
| Einzelfall ohne Folgen für die Anzeige | Zähler + eine Zeile im Protokoll | „12 Meldungen ohne Kennung übersprungen" |
| Etwas, das jemand klären könnte | Eintrag in einer Arbeitsliste mit Grund und Adresse | `daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md` |
| Etwas, das die Seite ärmer macht | zusätzlich eine Warnung, die den Lauf gelb macht | fehlende Termine einer laufenden Staffel |

## Was nicht zählt

- **Ein Kommentar ist keine Meldung.** „Wir überspringen hier X, weil Y" erklärt den Code, nicht
  den Betrieb.
- **Ein Zähler ohne Ausgabe ist keine Meldung.** Er muss im Protokoll landen, und zwar bei jedem
  Lauf, nicht nur bei einem Schalter.
- **Eine Liste, die niemand öffnet, ist keine Meldung.** Sie braucht einen Ort, an dem sie
  ohnehin gelesen wird (Wache, Statusanzeige, Prüfliste der Erweiterung).

## Beim Ändern eines Riegels

Wer eine Bedingung verschärft, misst **vorher**, wie viele Datensätze sie künftig verwirft, und
schreibt die Zahl in die Meldung des Laufs. Wer sie lockert, misst dasselbe in die andere
Richtung. Beides ist eine Zeile Messcode und ersetzt die Frage „merkt das jemand?" durch eine
Zahl.

## Auch beim Liefern

Dasselbe gilt für das, was ein Lauf **schreibt**: Eine Ausgabedatei, die in keiner Lieferliste steht, geht bei jedem Lauf lautlos verloren (05.10.2026: `public/data/voices` seit 30.08.,
`data/adn-vde-historie.json` seit 10.09. — die Messreihe, für die der Lauf überhaupt existiert). Die Prüffrage heißt hier: **Wo landet die Datei, wenn der Lauf endet?** Und ein Sammler, dessen
Lieferung scheitert, braucht eine Sicherung davor (Artefakt) — sonst ist der Fehlschlag am letzten Schritt ein Totalverlust. Siehe `datenlaeufe-entwerfen`.

## Musterlesende Wächter: Zählprobe von Anfang an (25.10.2026)

Ein Wächter, der Stellen per Muster findet (Regex auf HTML, Manifest, Quelltext), zählt zusätzlich die rohen Vorkommen des Stichworts. Weichen sie von den erkannten Treffern ab, ist das ein Mangel („N Stellen in unbekannter Schreibweise“). Sonst rutscht eine neue Schreibweise (`url(...)` statt Anführungszeichen) still am Wächter vorbei. Vorbild: `iconMaengel` in `tools/icon-kennung.mjs` (PR 1958). Erst der Prüfer hat die Lücke gefunden.

## Ende-zu-Ende-Wächter: Quelle gegen Ausgabe (25.10.2026)

Eine Verwerfungsliste mit Zähler genügt nicht, wenn sie normal hoch ist: `termine-ausgelassen.json` zählte 221 verworfene Crunchyroll-Serien, niemand las sie, und drei deutsche Synchros fehlten im Kalender, bis Daniel sie fand. Für jede Quelle, deren Einträge auf der Seite erscheinen sollen, gehört ein Wächter dazu, der die frischen Quelleinträge (z. B. neue deutsche Folgen der letzten 14 Tage) gegen die Ausgabe hält und jeden fehlenden Eintrag namentlich meldet. Ein altes Nein braucht außerdem ein Ablaufdatum, sonst schlägt es jeden neueren Befund.

## Verwandte Regeln

- `pruefen-und-belegen`: misst, statt zu vermuten — hier geht es um das, was gar nicht erst
  gemessen wird, weil es vorher wegfällt.
- `wissen-veraltet-nie`: eine Arbeitsliste, die aus solchen Ausfällen entsteht, wird auch wieder
  abgeräumt.
