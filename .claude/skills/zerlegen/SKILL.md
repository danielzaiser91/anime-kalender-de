---
name: zerlegen
description: Eine übergroße Funktion, Komponente oder Datei in diesem Repo sicher zerlegen (Bau-Phasen, DetailPanel, Worker, Erweiterung). Nutzen, wenn check:umfang rot ist, wenn Neues in eine Funktion über 80 / Datei über 800 Zeilen soll, oder wenn ein Umbau ohne Verhaltensänderung ansteht.
---

# Zerlegen ohne Verhaltensänderung

Ziel: kleinere Einheiten mit sichtbaren Ein- und Ausgaben — und ein Ergebnis, das beweisbar
dasselbe tut wie vorher. Umbau und Verhaltensänderung stehen nie im selben Commit.

## 1. Stelle wählen

- `node tools/umfang-pruefen.mjs --liste` zeigt die größten Funktionen und Dateien.
- Nahtstellen: Abschnittsmarken (`// --- … ---`), `**fette**` Blockkommentare, eigenständige
  `{ … }`-Blöcke, `if`-Zweige, die mit `return` enden, große JSX-Kinder.
- Von hinten nach vorn arbeiten — dann verschieben sich die Zeilen davor nicht. Nach jedem
  Schritt die Zeilen neu bestimmen (das Werkzeug fügt oben einen Import ein).

## 2. Schnittstelle ansehen

```bash
node tools/abschnitt-schnittstelle.mjs <datei> <von> <bis>   # ein / ändert / aus
```

## 3. Herauslösen — mit dem Werkzeug, nicht von Hand

```bash
node tools/modul-umzug.mjs namen     <quelle> <ziel> a,b,c            # Deklarationen verschieben
node tools/modul-umzug.mjs abschnitt <quelle> <von> <bis> <ziel> fn   # Anweisungen → Funktion
node tools/modul-umzug.mjs jsx       <quelle> <von> <bis> <ziel> Name # JSX-Kinder → Komponente
node tools/modul-umzug.mjs aufraeumen <datei…>                        # unbenutzte Importe weg
```

Es verschiebt wörtlich, setzt Parameter/Props mit Typen vom Typprüfer (eingeengt am Ort der
Verwendung), ergänzt Importe auf beiden Seiten und räumt sie auf. Zu wissen:

- **Ziel nie gleich Quelle** (12.11.2026): `abschnitt <datei> … <datei> fn` überschreibt die
  Datei und verliert die neue Funktion. Teilschritte einer schon ausgelagerten Funktion zuerst in
  der Ursprungsdatei herauslösen (Zieldatei = neue Datei), dann die große Funktion dorthin.
- Zeilennummern nach jedem Schritt per `grep -n` auf einen Ankertext neu bestimmen — der neue
  Import kommt als eigene Zeile oder in einen vorhandenen Importsatz, die Verschiebung ist 0 oder 1.
- **`<bis>` ist die letzte Zeile einer ganzen Anweisung**: Endet der Bereich auf `if (x)`, dessen
  Rumpf in der nächsten Zeile steht, trennt das Werkzeug beide still (aus `x` wird eine Ausgabe,
  das `if` bewacht danach das `return`). Vorher `sed -n "<bis>,+1p"` ansehen.
- `ändert` (neu zugewiesene äußere `let`) meldet es nur — dann die Variable in die Funktion
  holen, die sie als einzige erhöht, und zurückgeben (so bei `adnVerweiseErgaenzt`).
- Ein Abschnitt mit `return` muss mit `return` enden; der Aufruf wird `return await fn(…)`.
- „braucht Namen der obersten Ebene": diese Deklarationen zuerst mit `namen` auslagern. Aus
  `build.ts` wird nie importiert (es ruft beim Laden `main()` auf).
- Lange Typen (Warnung) durch Namen ersetzen: `ReturnType<typeof f>`, ein exportierter Typ.
- Bau-Phasen heißen `pipeline/bau/NN-name.ts`, Teilschritte `NN-M-name.ts` (Aufrufreihenfolge);
  `bauQuelltext()` liest sie in dieser Reihenfolge für die Text-Zusicherungen in `check:logic`.
  Ebenso `panelQuelltext()` (Panel) und `workerQuelltext()` (Worker).
- Kommentare wandern mit; Chronik dabei auf ein bis drei Zeilen kürzen.

## 4. Beweisen

```bash
npx tsc --noEmit -p tsconfig.json && npm run check:logic
git commit …                                      # die Vergleiche arbeiten auf Commits
node tools/bau-vergleich.mjs origin/main HEAD     # pipeline/: Ausgabe byte-gleich; feste Hashes, Exit 4 = Konflikt, WARNUNG = Zweig hinter main
node tools/panel-vergleich.mjs origin/main HEAD   # web/src: Panel-HTML von 80 Titeln gleich
npm run check:worker                              # worker/
node tools/umfang-pruefen.mjs                     # „Überlänge gesunken“ genügt; NICHT festschreiben
```

`tools/umfang-grenzen.json` senkt nur der Bestandsbau auf main (`--festschreiben` in
`tools/commit-data.sh`), nie ein PR — sonst kollidieren offene PRs in der Datei
(projektregeln-im-detail.md, `check:umfang`).

Beide Vergleiche bauen in eigenen Worktrees (≈ 5 bzw. 2 min), das Arbeitsverzeichnis bleibt frei.
In der Cloud-Sitzung nie gleichzeitig mit `check:logic` laufen lassen: `panel-vergleich` plus
`check:logic --alle` beendete den Container (Exit 137, 12.11.2026) — nacheinander starten.
Jeder läuft nur einmal gleichzeitig. `bau-vergleich` wartet der Reihe nach (Schlange, FIFO, bis zu 45 min; die Meldung nennt Platz und Halter) —
nicht abbrechen, keine eigene Wiederholschleife. **Exit 3** heißt dort „45 min nichts frei“ (Halter ansehen, dann erneut aufrufen);
`panel-vergleich` bricht bei belegter Sperre sofort mit Exit 3 ab: warten und neu starten.
Der Bau läuft im Vergleichsmodus (`BAU_VERGLEICH=1`): Invarianten-Widersprüche sind dort Warnungen im Protokoll — keine Invarianten von Hand abschalten, keinen Cache dazulegen. Die Ausgabe nennt die verschiedenen Felder.
**Mitternacht Berlin (23/22 Uhr UTC) zwischen Basis- und Kandidatenbau** macht jede Datumsangabe
verschieden (`stand`, `entferntAm`, Feeds; 12.11.2026: 50 Dateien) — die Basis-Ablage
`$TMPDIR/bau-vergleich/<basis>-auf-<basis>-*` löschen und beide neu bauen lassen.
Meldet einer „VERSCHIEDEN": nicht die Ausgabe erklären, sondern den Umbau korrigieren. Danach
die volle Kette `npm run check:vor-commit`.
