# Die Favoriten-Seite

Daniels Vorgaben vom 29.08.2026, dazu die Ergänzungen, die sich aus der Frage
ergeben: *Was will jemand wissen, der hierher navigiert?*

## Die Frage, die die Seite beantwortet

**„Was habe ich verpasst, und was kommt?"** — und erst danach: „Was habe ich mir
eigentlich alles gemerkt?"

Daniel: *„sodass man schnell sehen kann was man verpasst hat und was noch kommt."*
Das ist der Grund, warum der Zeitstrahl oben steht, obwohl er nur ein Fünftel der
Fläche bekommt: Er beantwortet die dringendere Frage.

## Aufbau

### 1. Zeitstrahl — ein Fünftel

Vierzehn Tage: die letzten sieben und die kommenden sieben, heute in der Mitte.
Je Tag eine Spalte; wo ein Favorit erschienen ist oder erscheint, sitzt eine
Marke.

**Was ich ergänze, weil die Frage es verlangt:**

- **Vergangenes und Künftiges sehen verschieden aus** — dieselbe Farbe für
  beides verschenkt die halbe Aussage.
- **Die Seite schreibt nicht „verpasst".** Das wäre eine Annahme über den Leser,
  und wir kennen nur die Termine, nicht seinen Abend (Daniel, 29.08.2026).
  „Erschienen" ist eine Tatsache und sagt genau so viel.
- **Heute ist eine eigene Marke**, keine Grenze zwischen zwei Hälften. Was heute
  erscheint, ist weder verpasst noch künftig.
- **Ein Tag mit mehreren Folgen zeigt die Zahl**, nicht drei Marken übereinander.
- **Klick auf einen Tag** öffnet die Titel dieses Tages in der Übersicht darunter.
- **Leere Tage bleiben sichtbar.** Ein Zeitstrahl, der nur belegte Tage zeigt,
  verliert seinen Maßstab.

### 2. Übersicht — vier Fünftel

Alle Favoriten, kompakt. Daniel: *„ein baum diagram oder so, wo man evtl erste
ebene sieht wieviele favoriten insgesamt, dann sortiert alle aufgelistet."*

**Drei Ebenen:**

1. **Kopf:** Gesamtzahl, aufgeteilt nach laufend / abgeschlossen / ohne Termin.
   Jede Zahl ist ein Filter.
2. **Gruppe:** nach Reihe (`franchiseId`) zusammengefasst — „Digimon (7)" statt
   sieben Zeilen. Reihen mit einem Teil stehen ohne Gruppenkopf da.
3. **Titel:** eine Zeile, ausklappbar für die Details.

**Sortierung:** Datum der Veröffentlichung, alphabetisch, Bewertung.
**Kategorien:** abgeschlossen, laufend. **Umschalter:** nur mit deutscher Synchro.

**Ergänzungen:**

- **Der nächste Termin steht in der Zeile.** Ohne ihn muss man jeden Titel
  öffnen, um die Frage zu beantworten, für die man hergekommen ist.
- **Anbieter als Filter.** Wer heute Abend Netflix schaut, will die Netflix-Titel.
- **Suchfeld**, sobald mehr als zwanzig Favoriten da sind.
- **Entfernen direkt in der Zeile**, mit kurzem Widerruf statt Rückfrage — eine
  Sicherheitsabfrage bei einer Handlung, die man einmal am Tag macht, ist
  Belästigung; ein Rückgängig-Streifen ist es nicht.
- **ICS-Export nur für Favoriten.** Die Seite hat den Export bereits; hier ist er
  am richtigen Ort.

### 3. Details je Titel

Was wir wirklich wissen — nichts erfunden:

| Angabe | Woher |
|---|---|
| gemerkt seit | neu: Datum je Favorit (siehe unten) |
| Status, Fortschritt | `shared/logic.ts`, gegen heute gerechnet |
| nächster Termin | `events.json` |
| wo verfügbar | `streams` mit Sprachangabe |
| Bewertung, Jahr, Studio, Folgen | `titles.json` |

## Was dafür fehlt: das Datum je Favorit

Heute liegt eine Favoritenliste als `Set<number>` im localStorage — **ohne
Datum**. „Gemerkt seit" lässt sich daraus nicht rekonstruieren.

**Das Format wird deshalb erweitert, nicht ersetzt:** Neben der Liste steht eine
zweite Ablage `favorites:seit` mit `{ id: datum }`. Wer die Seite schon benutzt,
verliert nichts — seine Favoriten bleiben, sie tragen nur bis zum nächsten
Antippen kein Datum, und die Zeile schreibt dann „schon länger" statt eines
erfundenen Tages.

Eine Migration, die ein Datum errät, wäre die schlechtere Lösung: Sie sähe
richtig aus und wäre falsch.

## Design

Kein neues Aussehen, sondern das der Seite — Kacheln mit `rounded-xl`, dieselben
Abstände, dieselbe Typografie. Was hinzukommt:

- **Der Zeitstrahl ist die einzige Stelle mit Farbe als Information.** Verpasst
  in Bernstein, künftig in Himmelblau, heute in Weiß mit Ring. Sonst bleibt die
  Seite bei ihren Grautönen.
- **Die Gruppen sind flach**, keine Einrückung über zwei Ebenen. Ein Baum, der
  tief wird, ist keine Übersicht mehr.
- **Zahlen tabellarisch** (`tabular-nums`), damit Spalten stehen.
- **Beide Themen**, wie überall.

## Reihenfolge

1. Datum je Favorit (Speicher + Anzeige „gemerkt seit")
2. Route und Gerüst, Zeitstrahl
3. Übersicht mit Gruppen, Sortierung, Filtern
4. Details, Entfernen mit Widerruf, Export
