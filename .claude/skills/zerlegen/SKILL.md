---
name: zerlegen
description: Eine übergroße Funktion oder Datei in diesem Repo sicher zerlegen (build.ts, DetailPanel, Worker, Erweiterung). Nutzen, wenn check:umfang rot ist, wenn Neues in eine Funktion über 80 / Datei über 800 Zeilen soll, oder wenn ein Umbau ohne Verhaltensänderung ansteht.
---

# Zerlegen ohne Verhaltensänderung

Ziel: kleinere Einheiten mit sichtbaren Ein- und Ausgaben — und ein Ergebnis, das beweisbar
dasselbe tut wie vorher. Umbau und Verhaltensänderung stehen nie im selben Commit.

## 1. Stelle wählen

- `node tools/umfang-pruefen.mjs --liste` zeigt die größten Funktionen und Dateien.
- Nahtstellen sind vorhandene Abschnittsmarken (`// --- Releases aufbauen ---`) oder
  `**fette**` Blockkommentare. Von hinten anfangen: Abschnitte am Ende lesen meist nur.

## 2. Schnittstelle ermitteln

```bash
node tools/abschnitt-schnittstelle.mjs pipeline/build.ts <von> <bis>
```

- `ein` → Parameter (bei vielen: ein Objekt `{ titles, releases, … }`).
- `ändert` → der Abschnitt weist eine äußere `let`-Variable neu zu: den neuen Wert zurückgeben
  und im Aufrufer zuweisen. Mutationen an Maps/Arrays bleiben Mutationen, aber der Name steht
  jetzt in der Signatur.
- `aus` → Rückgabe (Objekt), im Aufrufer mit `const { … } = phase(…)` entpacken.

## 3. Herauslösen

- Code wörtlich verschieben, nicht nebenbei umschreiben. Einrückung anpassen ist erlaubt.
- Funktionen in Aufrufreihenfolge anordnen; Bau-Phasen liegen als `pipeline/bau/NN-name.ts`,
  die Nummer ist die Aufrufreihenfolge (Zusicherungen in `check:logic` lesen den Bau als Text in
  genau dieser Reihenfolge über `bauQuelltext()`).
- Modulweite Helfer, die mehrere Phasen brauchen, nach `pipeline/bau/hilfen-*.ts` bzw.
  `pipeline/lib/`. Nie aus `build.ts` importieren — es ruft beim Laden `main()` auf.
- Kommentare wandern mit; Chronik (Datum, Anlass, Laufkennung) dabei auf ein bis drei Zeilen
  kürzen, Ausführliches nach `docs/wissen/`.
- React: Unterkomponenten in eigene Dateien unter `web/src/components/<bereich>/`, Props statt
  Closure-Zugriff. Hooks-Reihenfolge nicht ändern (`check:hooks`).

## 4. Beweisen

```bash
npm run typecheck && npm run check:logic
git commit …                                  # Bau-Vergleich braucht einen Commit
node tools/bau-vergleich.mjs origin/main HEAD # bei pipeline/: muss „gleich" melden
node tools/umfang-pruefen.mjs --festschreiben # gesunkene Überlänge übernehmen
```

Web: zusätzlich `npm run build`, `check:ansichten`, `check:panel`. Worker: `check:worker`.
Erweiterung: `check:extension`. Danach die volle Kette `npm run check:vor-commit`.

Meldet der Vergleich „VERSCHIEDEN": nicht die Ausgabe erklären, sondern den Umbau korrigieren —
meist wurde eine `let`-Zuweisung nicht zurückgegeben oder eine Reihenfolge vertauscht.
