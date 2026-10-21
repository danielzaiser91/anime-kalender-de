# Deploy aus Build bei Daten-Commits: Ansatzvergleich (17.10.2026)

**Frage:** Der Deploy nimmt den schnellen Weg (geprüfter Bau der PR-Prüfkette, live in 36–59 s statt 131–295 s, Median der letzten 30 Neubauten etwa 175 s) zu selten. Zwei Fehlschläge: „Baum weicht ab (main ist weitergewandert)“ und „kein gemergter PR“ (Datenbauten).

## Befund vorab

- **Datenbauten können den schnellen Weg nicht nehmen.** Jeder der 11 Datenbau-Commits seit 16.10. ändert `public/data`. Daraus entstehen `buildId` (SHA-1 über `public/data/*.json`, per `define` ins Bündel kompiliert), damit die Hashes der Bündel, die Vorlade-Zeilen in `index.html` und alle Teilseiten `t/<slug>` aus `build-share-pages.ts`. „Altes Web-Paket plus neue Daten“ ergäbe ein Bündel, dessen Cache-Kennung nicht zu den Daten passt. Die Voraussetzung der Idee trifft nicht zu.
- **„Weitergewandert“ ist oft nur Daten.** Von 8 solchen Fällen (30 PR-Merges #1339–#1450) änderte der Zwischen-Commit in 5 nur Dateien, die der Seitenbau nicht liest (`data/bestand-historie.jsonl`, `data/source-health.json`, `status.md`, Listen, `tools/umfang-grenzen.json`).
- **Beleg byte-gleich:** Artefakt der Kette gegen Neubau des Deploys, zwei echte Paare genau dieses Falls (#1450: Lauf 39035487008 gegen 39035734647; #1447: 39034281778 gegen 39035316317). Je 10.169 Dateien, 3.845 verschieden, alle allein durch `__APP_VERSION__` (`v` in `version.json` und die beiden Chunks `index-*.js`, `PatchnotesDialog-*.js`, die `v` enthalten) und `baum`. Nach dieser Normalisierung 0 Abweichungen. Dieselbe Abweichung nimmt der bestehende Treffer-Weg schon hin.

## Ansätze

| | Weg | Treffer (30 Merges) | Sicherheit | Aufwand |
|---|---|---|---|---|
| U | Untergrenze: nichts ändern | 11/30 | wie heute | 0 |
| A1 | feste Freiliste (`data/**` außer bekannten Eingaben), ohne Spur | 16/30 | ein neuer Leser in Vite oder den Ausgabeschritten bliebe unbemerkt (`cartoon-umzug.json` wird z. B. über einen abgeleiteten Pfad gelesen) | klein |
| **A2** | **Freiliste plus deklarierte Eingaben, Spur aller fs-Zugriffe beim Bau als Wächter, `abdruck` in `version.json` (gebaut)** | **16/30, seit Runde 3 15/30** | ein unerklärter Lesezugriff führt zu „kein Abdruck“ und damit zum Neubau | mittel |
| A3 | Manifest der gelesenen Dateien im Artefakt | 16/30 | wie A2 | etwa 10 KB öffentliche Datei oder Umbau von Kette und Kettenwächter |
| B | `pruefen` im Deploy überspringen, wenn sich nur Daten ändern (Datenbau) | Datenbau ~40–80 s schneller | braucht einen eigenen Sicherheitsbeweis: `pruefen` prüft gerade die Daten | nicht gebaut |
| C | `buildId` aus dem Bündel lösen, Daten als Overlay | Datenbau-Treffer möglich | Umbau des Web-Pakets | nicht gebaut |

**Gewählt: A2.** Gleiche Trefferzahl wie A1, aber ein künftiger Leser eines freien Pfads wird gemessen statt übersehen. Rückfall in jedem Zweifelsfall auf Neubau: fehlender, verkürzter oder falscher Abdruck, Git-Fehler, unerklärter Lesezugriff, neue, gelöschte oder umbenannte freie Datei.

## Gewinn

Runde 3 (Prüfer): Der Abdruck enthält jetzt die Ausgabe von `git log` über `data/patchnotes` (das Datum jeder Patch Note steht auf der Seite). Ein PR mit eigener Patch Note bekommt beim Squash eine neue Commit-Zeit und trifft daher nicht mehr; unter den fünf neuen Treffern betrifft das #1450. Datencommits ohne Patch Note lassen den Abdruck gleich.

4 von 30 Merges (13 %, vor Runde 3 5) wechseln vom Neubau (typisch 145–200 s) auf den schnellen Weg (36–59 s). Ersparnis also etwa 2 min je betroffenem Merge. Datenbauten bleiben bei ~175 s; der nächste Hebel dort wäre B, mit eigenem Beleg.
