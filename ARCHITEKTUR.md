# Architektur und Skalierung

Stand: 11.08.2026

Dieses Dokument beantwortet eine Frage: **Trägt die heutige Bauweise, und woran merken wir,
dass sie es nicht mehr tut?** Es steht hier, damit die Antwort nicht jedes Mal neu aus dem
Bauch kommt, sondern aus Zahlen — und damit ein späterer Umbau eine geplante Entscheidung ist
statt einer Notoperation.

## Wie es heute läuft

Eine statische Seite ohne Backend. Alles, was der Browser braucht, liegt als Datei auf GitHub
Pages; erzeugt wird es von einer Pipeline, die mehrmals täglich als GitHub Action läuft.

```
Quellen (Crunchyroll, ADN, AniList, TMDB, aniSearch, Anime2You)
   ↓  Actions: stündlich / täglich / wöchentlich
data/cache/, data/anisearch.json, data/curated/*.yaml   ← Rohdaten, im Repo
   ↓  pipeline/build.ts
public/data/*.json                                       ← ausgeliefert
   ↓  vite build
dist/                                                    ← GitHub Pages
```

Der Newsletter ist das einzige bewegliche Teil: ein Cloudflare Worker mit D1-Datenbank. Er ist
bewusst optional — fehlt er, zeigt das Formular einen ehrlichen Hinweis statt eines kaputten
Knopfs.

## Die drei Größen, die man nicht verwechseln darf

Das ist der Kern, und der häufigste Denkfehler:

| | Was es ist | Heute | Grenze | Wer es merkt |
|---|---|---|---|---|
| **Ladelast** | was ein Besucher wirklich herunterlädt | **142 KB** (gzip) | gefühlt ab ~1 MB | jeder Besucher, sofort |
| **Veröffentlichte Seite** | Inhalt von `dist/` | 20 MB | **1 GB** (GitHub Pages) | niemand, bis es reißt |
| **Repo** | alles inkl. Rohdaten und Historie | 108 MB (`.git` 64 MB gepackt) | ~1 GB empfohlen | nur wer klont |

**Rohdaten in `data/` kosten keine Ladelast und zählen nicht zur Pages-Grenze.** Sie liegen
außerhalb von `public/`, wandern also nie nach `dist/`. Das aniSearch-Rohdaten-Archiv darf
deshalb ruhig wachsen: Es macht das Klonen langsamer, sonst nichts. Wer über Ladelast
nachdenkt, muss auf die erste Zeile schauen, nicht auf die dritte.

### Was der Erstaufruf tatsächlich kostet

| Datei | roh | über die Leitung |
|---|---|---|
| `index-*.js` (App) | 302 KB | 94 KB |
| `titles-core.json` | 117 KB | 27 KB |
| `events.json` | 118 KB | 9 KB |
| `releases.json` | 66 KB | 9 KB |
| `meta.json` | 8 KB | 3 KB |
| **Summe** | | **≈ 142 KB** |

Nachgeladen wird nur, wer es anfordert:

- `titles.json` (2,6 MB → **551 KB** gzip) erst beim Öffnen der Datenbank-Ansicht
- Handlungsbeschreibungen in **32 Gruppen** — eine Kachel lädt nur ihre eigene Gruppe
- Cover-Bilder direkt von AniList, nicht von uns

Diese Trennung ist die wichtigste Architekturentscheidung des Projekts und der Grund, warum
der Kalender trotz 2.753 Titeln in 142 KB startet.

## Wo wir an den Grenzen stehen

Quelle: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

| Grenze | Wert | Heute | Abstand |
|---|---|---|---|
| Veröffentlichte Seite | 1 GB | 20 MB | **50-fach** |
| Bandbreite | 100 GB/Monat | ~142 KB je Aufruf | reicht für **~700.000 Aufrufe/Monat** |
| Builds pro Stunde | 10 (entfällt bei eigenem Actions-Workflow — den haben wir) | 3 Läufe/Tag | greift nicht |
| Deploy-Dauer | 10 Minuten | ~2 Minuten | 5-fach |
| Datei | 100 MB | größte: 2,6 MB | 38-fach |

Kein Wert liegt näher als Faktor fünf an seiner Grenze. Die Bandbreite ist die einzige, die
allein durch Erfolg reißen könnte — dafür bräuchte es 23.000 Besucher am Tag.

## Wann umgebaut werden muss — und worauf

Jede Zeile nennt den Auslöser, nicht ein Gefühl. Solange keiner eintritt, ist Umbauen
verschwendete Zeit.

### 1. Ladelast über 300 KB beim Erstaufruf

**Auslöser:** `titles-core.json` oder `events.json` wachsen so, dass die Summe 300 KB gzip
überschreitet — realistisch bei etwa 400 gleichzeitig laufenden Serien statt heute 125.

**Reaktion:** `events.json` nach Monat aufteilen, wie es die Beschreibungen schon vorleben.
Der Kalender zeigt ohnehin nie mehr als eine Woche gleichzeitig. Aufwand: klein, die
Ladelogik dafür steht bereits.

### 2. Ein Datenfeld interessiert nur eine Minderheit

**Auslöser:** Eine neue Angabe würde `titles.json` deutlich vergrößern, aber die wenigsten
Besucher fragen sie ab. Der erste konkrete Fall: **deutsche Synchronsprecher.** Bei etwa
zwanzig Rollen je Titel und 2.753 Titeln reden wir über 55.000 Einträge — ein Vielfaches des
heutigen Datensatzes, für eine Angabe, die man erst sieht, wenn man eine Kachel öffnet und
aufklappt.

**Reaktion:** Eine Datei je Titel unter `public/data/<bereich>/<id>.json`, geladen erst beim
Aufklappen. **Nicht** in `titles.json`. Das ist derselbe Weg wie bei den Beschreibungen und
kostet Uninteressierte exakt null.

> Ein eigener Host ist dafür **nicht** nötig. Eine Datei, die niemand anfordert, wird auch
> nicht übertragen — egal wo sie liegt. Ein zweiter Host löst ein anderes Problem
> (Repo-Größe, Deploy-Kopplung), nicht das der Ladelast.

### 3. Repo über 1 GB

**Auslöser:** Das aniSearch-Archiv wächst auf ~35 MB bei vollem Bestand. Erst wenn weitere
Archive dazukommen — etwa Rohdaten der Synchronkartei — käme man in die Nähe.

**Reaktion, in dieser Reihenfolge:**

1. Alte Archivstände nicht mitschleppen: Jede Datei wird genau einmal geschrieben und danach
   nicht mehr angefasst. Das ist bereits so gebaut — deshalb wächst die Historie nicht mit
   jedem Nachtlauf.
2. Archive in ein zweites Repo (`anime-kalender-daten`), als Submodul oder gar nicht
   eingebunden. Die Seite braucht sie nicht, nur die Pipeline.
3. Cloudflare R2 (10 GB kostenlos), wenn es wirklich groß wird.

### 4. Bandbreite über 100 GB im Monat

**Auslöser:** ~23.000 Besucher täglich. Bis dahin ist es weit.

**Reaktion:** Cloudflare vor die Seite hängen — die Domain liegt ohnehin dort, der Worker
läuft dort. Der Wechsel ist eine DNS-Änderung, kein Umbau.

### 5. Daten müssen sich zwischen zwei Nachtläufen ändern

**Auslöser:** Nutzer sollen etwas eintragen oder korrigieren können, oder Termine müssen
minutenaktuell sein.

**Reaktion:** Dann, und wirklich erst dann, kommt eine Datenbank ins Spiel — Cloudflare D1
steht bereits, der Worker auch. **Heute wäre eine Datenbank ein Rückschritt:** Ein statisches
JSON vom CDN antwortet in Millisekunden ohne Kaltstart, ohne Ausfallrisiko und ohne Kosten.
Eine Datenbank lohnt sich, wenn geschrieben wird — nicht, wenn viel gelesen wird.

### 6. Die Folgen-Ebene wird sichtbar

**Auslöser:** Folgentitel, Folgentermine und Tonspuren je Folge sollen auf der Seite stehen —
nicht nur je Staffel.

**Warum das die erste echte Schwelle ist, die näher rückt:** Der aniSearch-Lauf holt seit dem
29.08.2026 Folgenlisten mit deutschen Folgentiteln. Gemessen am ersten Lauf: **6.874 Folgen aus
100 Titeln**, davon 5.347 mit deutschem Titel. Über den Bestand von 2.615 zugeordneten Titeln
hochgerechnet sind das weit über 150.000 Folgen.

Das ist eine andere Größenordnung als alles Bisherige. `titles.json` mit 2.763 Titeln ist
2,6 MB; eine Folgen-Datei wäre ein Vielfaches davon, und sie ließe sich nicht sinnvoll
vorladen — niemand braucht 150.000 Folgen, jeder braucht die zwölf einer Staffel.

**Reaktion:** Kein Umbau, sondern ein Endpunkt. Die Folgen wandern nach D1 (steht bereits, der
Worker auch), und die Seite fragt sie beim Öffnen eines Titels ab — dieselbe Stelle, an der
heute schon die Handlungsbeschreibung nachgeladen wird. Alles andere bleibt statisch.

**Was dagegen weiterhin nicht in eine Datenbank gehört:** die 2.763 Titel, die 889 Termine, die
Verweise. Sie ändern sich dreimal am Tag, werden bei jedem Seitenaufruf gebraucht und sind als
Datei schneller, billiger und ausfallsicherer.

## Was bewusst nicht gemacht wird

- **Keine Datenbank für Lesedaten.** Siehe oben. Der Termindatensatz ändert sich dreimal am
  Tag; ihn bei jedem Seitenaufruf abzufragen wäre teurer und langsamer als eine Datei.
- **Kein serverseitiges Rendering.** Die Teilen-Seiten unter `dist/r/` werden im Build als
  echte HTML-Dateien erzeugt — das löst das Vorschaubild-Problem ohne laufenden Server.
- **Kein Live-Abruf fremder Seiten beim Seitenaufruf.** Das macht aus einem Abruf je Titel und
  Woche einen je Besucher: dieselbe Last, unbegrenzt, dazu ein fremder Server im Ladepfad.
- **Kein Auslagern um des Auslagerns willen.** Jede Trennung kostet einen Ort mehr, an dem
  etwas kaputtgehen kann.

## Zusammengefasst

Die Bauweise trägt, und zwar mit großem Abstand. Der begrenzende Faktor ist nicht die Technik,
sondern die Datenpflege. Die nächste Architekturentscheidung steht an, wenn die
Synchronsprecher kommen — und die Antwort steht schon fest: eine Datei je Titel, nachgeladen
beim Aufklappen, nicht in den Hauptdatensatz.
