---
name: befehle-fuer-daniel
description: "Wenn ein Shell-Befehl für Daniel in eine Antwort soll: erst prüfen, ob ich ihn selbst ausführe; sonst Bash, absolute Pfade mit /, Ort angeben, ein Block je Handlung."
---

# Befehle, die Daniel ausführen soll

## 0 · Die erste Frage: Muss er das überhaupt selbst tun?

**Der beste Befehlsblock ist der, den es nicht gibt.** Bevor einer geschrieben
wird, gilt die Prüffrage: *Kann ich das nicht selbst ausführen?* In den meisten
Fällen lautet die Antwort ja — und dann ist ein Block an Daniel keine
Hilfestellung, sondern abgeschobene Arbeit (seine Ansage, 14.08.2026: „oder noch
besser du führst es selbst aus").

Bei ihm landet ein Befehl nur, wenn einer dieser Gründe zutrifft:

- Er **braucht seine Zustimmung** — Server starten, Geld ausgeben, Wirkung nach
  außen (siehe `20-arbeitsweise.md`). Dann wird gefragt, und nach dem Ja führe
  **ich** aus.
- Es geht **nur an seinem Gerät oder in seinem Konto** — BIOS, ein Login, das
  ich nicht habe, eine Oberfläche ohne Befehlszeile.
- Er hat es **ausdrücklich so verlangt**.

Trifft nichts davon zu: ausführen, Ergebnis berichten, fertig.

Bleibt ein Block übrig, dann gelten die Regeln darunter — **und dazu gehört, wo
er ausgeführt werden soll.** Ein Befehl ohne Ort ist eine halbe Anleitung.

---

Ein Befehl in meiner Shell und ein Befehl in Daniels Terminal sehen gleich aus,
sind aber nicht dasselbe: Meine steht im Projektverzeichnis, seine steht
irgendwo.

**Prüffrage vor jedem Befehlsblock: Funktioniert er, wenn Daniel ihn in ein
frisch geöffnetes Fenster einfügt — ohne zu wissen, wo er gerade steht?**

---

## 1 · Zielschale ist Bash

Die Regel „kein PowerShell" aus `30-system-und-sicherheit.md` gilt nicht nur für
mich, sondern beschreibt auch, womit Daniel arbeitet: **Bash oder cmd, nicht
PowerShell.** Ein Block mit ` ```bash ` bekommt im Client außerdem einen
Ausführen-Knopf, und der führt Bash aus.

Daraus folgt unmittelbar für Pfade — und das ist der Punkt, an dem es schiefgeht:

```
✗ C:\code\ai\projekt\worker\wrangler.toml     Rückwärtsschrägstriche sind in Bash Escapes
✓ C:/code/ai/projekt/worker/wrangler.toml     funktioniert
✓ /c/code/ai/projekt/worker/wrangler.toml     ebenfalls, Git-Bash-Schreibweise
```

`&&` und `||` sind hier ausdrücklich **in Ordnung** — anders als in PowerShell,
wo sie ein Parser-Fehler wären. Ein Block darf also mehrere Schritte verketten,
solange sie zusammen eine Handlung ergeben.

**Anlass für diesen Skill (14.08.2026):** Erst standen dort relative Pfade mit
`cd worker` als Vorspann; danach schrieb ich die Regel mit
Rückwärtsschrägstrichen und dem Hinweis, `&&` zu vermeiden — beides aus der
falschen Annahme, seine Shell sei PowerShell. Daniels Korrektur:
„PowerShell soll auch grundsätzlich vermieden werden, ich hätte Bash oder cmd
benutzt."

---

## 2 · Absolute Pfade, immer

Ein relativer Pfad setzt ein Arbeitsverzeichnis voraus, das ich nicht kenne. Für
mich stimmt es, weil ich vorher hingewechselt bin; sein Fenster steht womöglich
im Benutzerordner.

```
✗ cd worker
✗ npx wrangler d1 execute anime-kalender --file=./migrations/004.sql
✓ npx wrangler d1 execute anime-kalender --config C:/code/ai/projekt/worker/wrangler.toml --file C:/code/ai/projekt/worker/migrations/004.sql
```

Pfade mit Leerzeichen kommen in doppelte Anführungszeichen.

---

## 3 · Lieber die Option des Werkzeugs als ein `cd`

Braucht ein Werkzeug ein Arbeitsverzeichnis, hat es dafür meist eine eigene
Angabe — `wrangler --config`, `npm --prefix`, `git -C`, `docker -f`. Die ist
vorzuziehen: Sie ist absolut, sie verändert Daniels Fenster nicht, und sie
überlebt das Kopieren in einen anderen Zusammenhang.

```
✓ npm --prefix C:/code/ai/projekt run build
✓ git -C C:/code/ai/projekt status
```

Gibt es keine solche Option, ist `cd "C:/code/ai/projekt" && befehl` in **einem**
Block richtig — nicht ein `cd` allein in einem Block davor. Der Ausführen-Knopf
startet jeden Block in einer eigenen Sitzung; ein einzelnes `cd` verpufft.

---

## 4 · Ein Block, eine abgeschlossene Handlung

Der Block ist eine Handlungsaufforderung, und der Knopf daneben führt ihn als
Ganzes aus. Was zusammengehört, gehört also zusammen in einen Block; was
getrennt entschieden werden soll, in zwei.

Unverändert gilt die Regel aus `10-sprache-und-ausgabe.md`: **Nur hinein, was
Daniel wirklich ausführen soll.** Befehle, die ich selbst schon ausgeführt habe,
Prüfketten, Belege für funktionierende Arbeit — die gehören in einen Satz, nicht
in einen Block mit Knopf.

Dazu: **Sag vor dem Block, was er bewirkt und was er voraussetzt.** Eine
Migration, die vor einem Deploy laufen muss, ist ohne diesen Satz eine Falle.

**Und der Satz gehört zu jeder Wiederholung, nicht nur zum ersten Mal.** Am
20.09.2026 stand ein Messskript zweimal im Chat: beim ersten Mal mit Begründung,
beim zweiten Mal nackt, als Erinnerung an einen offenen Punkt. Daniels Reaktion:
„warum postest du messskript? soll ich es ausführen oder warum?" Ein Block ohne
Satz sieht aus wie ein Zwischenstand meiner eigenen Arbeit — die Aufforderung
geht dabei verloren. Wer einen Befehl erneut zeigt, schreibt den Zweck erneut
dazu; wer nur erinnern will, nimmt eine Footer-Zeile statt eines Blocks.

**Ein Block läuft beim Einfügen unverändert (17.10.2026).** Keine Platzhalter wie `<Token aus …>`: Bash liest
`<` als Umleitung und scheitert („No such file or directory“). Geheime Werte fragt der Block selbst verdeckt ab
(`read -rsp "Token: " X && export X && …`), mehrere Schritte stehen in einer Zeile mit `&&`, damit ein Fehler
die Folgeschritte anhält.

---

## 4b · Browser-Konsole: das Ergebnis gehört in die Zwischenablage

**Jeder Einzeiler für die Web-Konsole endet mit `copy(…)`.** Daniel am 23.08.2026: „wann immer
du console commands für mich zum in die web console pasten gibst, mach das es automatisch das
erwartete ergebnis in die zwischenablage packt."

Der Anlass war eine Diagnose auf einer Amazon-Seite: Die Ausgabe stand in der Konsole, und er
musste sie von Hand markieren und kopieren — bei einer Zeile lästig, bei einer Liste von
Folgennummern eine Zumutung.

`copy()` ist eine Funktion der Entwicklerwerkzeuge selbst (Chrome, Edge, Firefox), nicht des
Seitenskripts. Sie legt ihr Argument als Text in die Zwischenablage.

```javascript
const h=document.documentElement.innerHTML;copy(`audioTracks: ${(h.match(/"audioTracks"/g)||[]).length} | Folgen: ${[...h.matchAll(/"episodeNumber":(\d+)/g)].map(m=>m[1]).join(',')}`)
```

Drei Punkte, die dabei zählen:

- **Ein `copy()` je Befehl**, ganz am Ende. Zwei Aufrufe überschreiben einander, und was zuerst
  kam, ist weg.
- **`copy()` gibt `undefined` zurück** — die Konsole zeigt also nichts Sinnvolles an. Das ist
  kein Fehler, aber es gehört dazugesagt, sonst sieht es nach einem Fehlschlag aus.
- **Objekte als Text übergeben.** `copy(obj)` legt JSON ab, was oft unlesbar ist; besser eine
  Zeichenkette bauen, die man direkt einfügen kann.

Braucht die Antwort mehrere Werte, kommen sie in **eine** Zeichenkette — nicht in mehrere
Aufrufe.

## 5 · Abschlussprüfung

> **Öffne ein Fenster im Benutzerordner, füge den Block ein — läuft er?**

Wenn die Antwort „nur wenn er vorher woanders hingewechselt ist" lautet oder ein
Rückwärtsschrägstrich im Pfad steht, ist der Block falsch.
