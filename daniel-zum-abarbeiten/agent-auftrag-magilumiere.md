Du untersuchst in diesem Repo (anime-kalender-de, Node/TypeScript) eine Datenlücke. Du darfst NICHTS im Repo ändern; schreibe nur deinen Bericht in die Datei, die unten genannt ist. Antworte auf Deutsch.

## Frage
Warum ist die zweite Staffel von „Magilumière Co. Ltd." (englisch „Magilumiere Magical Girls Inc.", japanisch „魔法少女ホワイトシリーズ" nein — suche über „Magilumi" und „Magical Girls Inc") nie in unserem Kalender gelandet? Der Kalender führt Anime mit deutscher Synchronfassung; ein Termin entsteht aus Quellen (Crunchyroll-Katalog, aniSearch, Anbieter-Kalender, Handbelege).

## Vorgehen (Befehle, die du ausführen darfst: node, npx tsx, git status/diff, Lesen)
1. Suche den Titel (alle Staffeln) in `public/data/titles.json`, `public/data/ohne-synchro.json`, `public/data/releases.json`, `public/data/events.json`. Schreibe auf: AniList-Kennung, Titel, Format, `jpYear`, `jpStatus`, Streams, Releases (Anbieter, Datum).
2. Suche in `data/` (Textsuche, auch gz-Dateien unter `data/crunchyroll-raw/` falls nötig mit node): `crunchyroll-dub.json`, `anisearch*.json`, `dub-confirmed.yaml`, `watch-links.yaml`, `curated/*.yaml`, `termine-ausgelassen.json`, `verweise-entfernt.json`. Welche Quelle nennt Staffel 2 oder deren deutsche Fassung?
3. Prüfe, ob Staffel 2 bei uns als eigener Titel existiert oder mit Staffel 1 zusammengelegt ist (Reihen: `public/data/franchises.json`).
4. Lies `pipeline/bau/10-termine.ts` und `pipeline/bau/09-synchro.ts` (nur die Teile zum Vorfilter `verschoben` und zur Synchro-Entscheidung) und sage, an welcher Stelle der Titel ausscheidet, falls er ausscheidet.

## Bericht (Datei: BERICHT)
- Was du gefunden hast, mit Dateipfad und Zeile bzw. Auszug (kurz).
- Welche der folgenden Ursachen zutrifft (eine wählen, mit Beleg): (a) Titel fehlt im Bestand; (b) Titel da, aber keine Synchro-Quelle; (c) Synchro-Quelle da, aber Termin vom Vorfilter verworfen; (d) Zuordnung Staffel/Franchise falsch; (e) anderes.
- Was eine Quelle sein könnte, die es belegt hätte (nur, was du in den Daten wirklich siehst).
- Keine Vermutungen als Tatsachen ausgeben; schreib „nicht gefunden", wenn du nichts findest.
