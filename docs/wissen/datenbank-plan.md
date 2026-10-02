# Datenbank-Plan: Bauplatz statt Dateihaufen

Stand: 02.10.2026. Anlass: Daniel — „wir müssen auf Datenbankstruktur wechseln … review code and
architecture, und komm mit einem Plan". Die Zahlen unten sind **gemessen**, nicht geschätzt
(Quelle: Werkzeugprotokolle von 9 Sitzungen, 6.224 Aufrufe, 108 h Fenster, davon 55 berührte
Stunden).

## Der Need in Zahlen

| Messgröße | Wert |
|---|---|
| `read`-Aufrufe | 948 über **340 verschiedene Dateien** |
| Suchläufe | **1.220** (≈ 22 je berührter Arbeitsstunde, ≈ 130 je 6-Stunden-Tag) |
| Repo ohne `node_modules`/`.git`/`dist` | **291,9 MB** |
| davon `data/` | **197,9 MB — 68 %** |
| davon `public/data/` | 21,4 MB — 7 % |
| `status.md` | **554 kB, 40× gelesen, 157× angefasst — rund einmal je Arbeitsstunde** |
| `pipeline/check-logic.ts` | 25× gelesen, 37× durchsucht (366 kB) |
| `crunchyroll-dub.json` | 5× **vollständig** gelesen (5 MB je Aufruf) |

**Jede Suche ohne Pfadangabe zahlt die volle Wurzel — 292 MB, zu zwei Dritteln JSON-Bestand.**
Über die zuordenbaren Läufe gemittelt: ~197 MB je Suche. Auf einen Arbeitstag gerechnet sind das
**13–39 GB bewegter Text**, um ein paar Kilobyte Antwort zu finden.

*Vorbehalte:* Suchen ohne Pfad sind mit der Wurzelgröße gerechnet (Kostenschätzer, kein
Unikat-Messwert; `.git`/`node_modules` sind abgezogen). Das Fenster sind die letzten Tage, nicht
die Projektgeschichte.

## Leitentscheidung

**Die Datenbank ist der Bauplatz, nicht die Auslieferung.** Die Seite bleibt statisch (schnell,
offline-fähig, kein Server davor). Ablauf:

```
Eingaben (kuratiert, Caches, Abrufe)  →  bestand.sqlite  →  publish/*.json  →  Seite/Worker
                                             ↑
                                    Prüfungen als Abfragen
```

- **Git behält**: `data/curated/*.yaml`, Handbelege, die ausgelieferten JSON — und **nicht** die DB
  (Artefakt, wird im Lauf gebaut; eine Binärdatei im Repo wäre ein neuer Haufen).
- **Kein Server vor die Seite.** Der Bestand bleibt abrufbar wie heute.
- **Kein Big Bang**: 182 Pipeline-Dateien werden nicht auf einmal umgebaut; jede Stufe ist allein
  auslieferbar.

## Die Stufen

### Stufe 1 — Gedächtnis und offene Punkte in Tabellen
Betroffen: `data/synchro-historie.json`, `data/news-historie.json`, `data/quellen-historie.json`,
`data/folgen-zuordnung.json` und die **Liste der offenen Punkte** aus `status.md`.
Tabellen statt Merge-JSON: `(schluessel, datum, grund, quelle)`.
Warum zuerst: Heute ist eine Datei gleichzeitig Eingabe, Ableitung und Gedächtnis — ein Eintrag,
der nicht mehr belegbar ist, muss von Hand gelöscht werden (Overgeared: `212888`). Und die Liste
kostet **jede Antwort** 554 kB.
Nutzen: Ausfälle weg, Antwortkosten weg.

### Stufe 2 — Bestand als Schema
`titel`, `release`, `event`, `stream`, `quelle`, `beleg`, `ankuendigung`, `slot` mit
**Fremdschlüsseln**. Der Bau wird zu Abfragen; Zusicherungen werden SQL statt Quelltext-Regex.
Der heutige Fehler wäre hier aufgefallen: Ein deutscher Crunchyroll-Slot **ohne** `stream`-Zeile
ist eine verletzte Zusicherung, kein stilles Loch.
Nutzen: die 68 % bewegter Masse werden indiziert; genau diese Fehlerklasse verschwindet.

### Stufe 3 — Publish aus Abfragen
`public/data/*.json` je Ansicht aus der DB geschrieben, mit `stand`/ETag. Heute lädt die Seite
möglicherweise Dateien mit, die sie nie zeigt (`anisearch.json` 10 MB).
Nutzen: Ladevolumen und Bauzeit sinken; messbar am ausgelieferten Umfang.

### Stufe 4 — D1 für das Belegmodell
`Quelle → Lesung → Snapshot (R2)`; „Sicherheit der Angaben" wird `COUNT(DISTINCT artikel)`. Der
Worker hat D1 bereits (Prüfungen, Lauf-Status).
Wartet auf Daniels Entscheidungen (öffentlicher Bucket? Schreibweg?).

### Stufe 5 — `status.md` teilen
**Vorgezogen am 02.10.2026, ohne DB:** Offenes bleibt in `status.md` (23 kB), Erledigtes und die
Arbeitsgeschichte stehen in `docs/archiv/status-archiv.md` (551 kB). Offen bleibt, die Liste zu Daten
zu machen.
Die **Liste** wird Daten (Stufe 1), die **Anlässe und Lehren** bleiben Text und wandern nach
`docs/wissen/` (dort gibt es den Ort schon). Nicht in eine Tabelle gezwungen: Prosa mit
Begründungen ist kein Bestand.

## Was ausdrücklich nicht passiert

| Ding | Warum nicht |
|---|---|
| Kuratierte YAML und Handbelege in die DB | Sie sind **Handarbeit** und müssen in Git reviewbar bleiben |
| Server vor die Website | Die Seite ist statisch und soll es bleiben |
| `bestand.sqlite` einchecken | Neuer Haufen; im Lauf gebaut, nie committet |
| Erweiterungscode (`melder.js`, `amazon.js`), `worker/src`, `FilterDetails.tsx` | **Code, kein Bestand** — dort hilft `zerlegen`, nicht eine Tabelle |

## Erster Schritt (läuft)

`tools/bestand-db.mjs` baut `data/bestand.sqlite` aus dem, was schon ausgeliefert ist
(`titles.json`, `releases.json`, `data/crunchyroll.json`, `data/synchro-historie.json`) und kennt
eine erste Frage: **deutsche Crunchyroll-Slots, zu deren Serie kein deutscher Weg im Bestand
steht.** Genau dieser Fall (Overgeared, 02.10.2026) hat den Anlass gegeben.
