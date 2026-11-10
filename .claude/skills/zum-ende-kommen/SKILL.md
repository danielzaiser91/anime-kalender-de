---
name: zum-ende-kommen
description: "Bei „ende“, „zum ende kommen“, „feierabend“, „nichts neues mehr“ (auch mit Uhrzeit): nichts Neues anfangen, Laufendes abschließen, aufräumen, Übergabe."
---

# Zum Ende kommen (Daniel, 18.10.2026)

„Ende“ heißt: **Ende — danach läuft nichts mehr** (Daniel, 05.11.2026: „wenn ende dann ende. dann darf nichts mehr laufen“). Agenten halten an einem sauberen Punkt an, schreiben ihre Übergabe und hören auf; nichts wird „noch fertig“ laufen gelassen. Danach steht eine Übergabe, mit der die nächste Sitzung ohne Nachfragen weitermacht. Die alte Fassung („nichts abwürgen, Laufendes darf fertig werden“) ist aufgehoben; die Abschnitte unten gelten nur noch für ein Ende mit Uhrzeit, bis diese erreicht ist.

**„Schluss für heute“ / „ende“ am Abend heißt: der PC wird heruntergefahren (Daniel, 05.11.2026 00:14).** Dann läuft lokal nichts weiter — keine Merge-Reihe, kein Monitor, kein Hintergrundskript. Bauer schreiben ihre Übergabe und hören auf, lokale Reihen und Monitore werden sofort beendet (`ps -ef`, Kontrolle: nichts außer der eigenen Shell). Was über Nacht laufen soll, läuft remote (GitHub Actions, Cloud), sonst morgen. Anlass: Die Merge-Reihe sollte bis 01:34 laufen und blockierte das Git-Update; dazu 62 verwaiste `tail`/`grep`-Monitore seit 09:42.

## Was ab jetzt nicht mehr passiert

- Kein neuer Bauer, keine neue Analyse, kein neuer Plan, kein neuer Punkt aus der Queue — auch nicht auf einem frei gewordenen Platz.
- Eine nächste Runde (R+1) nach einem Prüfer-„ändern“ wird **nicht** gestartet: Auflagen in `stand.md`, „beim nächsten freien Platz“.
- Autonomer Modus endet sofort: eigenen Marker `autonomer-modus/<Sitzungs-ID>.txt` löschen (die alte globale Datei liest niemand mehr; 19.10.2026 hielt sie den grünen Ball fälschlich leer), `ScheduleWakeup({ stop: true })`.

## Was trotzdem zu Ende gebracht wird (zählt nicht als „neu“)

- Ein fertiger Bauer-Bericht wird abgeschlossen: `git status`, pushen (rebaster PR-Zweig mit `--force-with-lease=<zweig>:<alter SHA>`), Konflikt mit main mergen, Nachtrag per `gh pr comment --body-file`, CI abwarten (im Hintergrund), **Prüfer starten** — der Prüfer schließt die laufende Runde ab.
- Ein Prüfer-„frei“ oder eine von mir abgenommene Nachbesserung (eine Prüfrunde, 21.10.2026) wird gemergt, danach `git pull --ff-only`, `laeufe-aufraeumen --trocken`.
- Eine laufende Messung oder ein Lauf, auf den Daniel gerade wartet, wird ausgewertet und gemeldet.
- Daniels Fragen werden weiter beantwortet; ein neuer Auftrag von ihm hebt das Ende auf.

## Der Schnitt, sofort nach „ende“

1. **Bestand aufnehmen:** `ListAgents`/Aufgabenliste (wer läuft noch, woran), `CronList` (sitzungsgebundene Termine), `node C:/code/ai/__assets/tools/prozess-register.mjs aufraeumen --still` und `list`.
2. **Eigene Hintergrundbefehle** ohne Zweck beenden; nur die lassen, deren Ergebnis noch gebraucht wird.
3. **`stand.md` nachführen** (Skill `daniel-dateien-pflegen`): In-Arbeit-Kopf mit Uhrzeit und „Ende“, jede laufende Sache mit ihrem nächsten Schritt, Auflagen offener Runden, Termine als 📅-Zeile. Lehren aus den letzten Berichten verankern (bauer.md, pruefer.md, Skills).
4. **Übergabe schreiben:** Memory `project-uebergabe.md` überschreiben (nicht ergänzen), Zeile in `MEMORY.md` mitziehen. Inhalt:
   - Stand mit Datum und Uhrzeit, Daniels Wortlaut, Modus (autonom aus, Ruhemodus);
   - **was noch läuft und was bei welchem Ergebnis zu tun ist** („frei“ → mergen, „ändern“ → Auflagen eintragen);
   - Warteschlange in Reihenfolge (Verweis auf `stand.md`, nicht kopieren);
   - feste Termine und Crons, die nur in dieser Sitzung leben, samt Ersatzweg, falls die Sitzung endet.
5. **Antwort an Daniel**, drei, vier Sätze: was noch läuft und was ich damit tue, wann der nächste Termin ist. Kein Footer, keine Liste des Erledigten.

## Danach, bis alles still ist

Jeder eintreffende Bericht wird wie oben abgeschlossen, die Übergabe danach im selben Zug nachgeführt (wer nicht mehr läuft, fliegt aus „läuft noch“). Ist nichts mehr offen, steht in der Übergabe „nichts läuft mehr“ und im Chat ein Satz dazu. Kein Wecker, keine Schleife — die Berichte wecken von selbst.

## Geplantes Ende („ende 23 uhr“, Daniel 18.10.2026)

Nennt Daniel eine Uhrzeit, gilt bis dahin der normale Betrieb; um die Uhrzeit startet der Schnitt von selbst, ohne dass er „ende“ schreiben muss.

1. **Sofort:** Uhrzeit als ISO mit Offset in `~/.claude/ende-um.txt` (z. B. `2026-10-18T23:00:00+02:00`), Zeile in `stand.md`, Daniel einen Satz bestätigen. Läuft ein autonomer Modus mit späterem Ende, gewinnt die frühere Zeit.
2. **Bis dahin:** Das Hook-Modul `ende-termin.mjs` meldet an jeder Eingabe „[Ende geplant HH:MM (in N min) …]“ — kein `ScheduleWakeup` über diese Zeit hinaus, der letzte Wecker fällt genau auf sie. Neue Agenten nur, wenn ihr Bericht realistisch vorher kommt; sonst gleich in die Übergabe.
3. **Ab der Uhrzeit** meldet das Modul „[Ende fällig …]“: Schnitt wie oben, dann `ende-um.txt` löschen. Ohne diesen Wecker endet der Turn und nichts passiert — der Wecker ist der Auslöser, nicht der Vorsatz.
