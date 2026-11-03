# System, Fenster und Sicherheit

**Kein PowerShell:** Niemals `powershell.exe` aufrufen. Für Shell-Operationen ausschließlich
Bash, für Dateizugriffe die dedizierten Werkzeuge: Grep, Read, Write, Edit, Glob. Ein
`PreToolUse`-Hook setzt das durch — ein Verstoß wird blockiert, nicht nur gerügt.

**Keine Server ohne Zustimmung:** Niemals selbstständig einen Server starten — Dev-Server,
statische Server, Preview-Server im Claude-Client, Backends, Datenbanken, Container mit offenen
Ports, Tunnel. Auch nicht „nur kurz zum Verifizieren", auch nicht, wenn ein Skill oder Workflow
es nahelegt. Vorher fragen, mit Angabe wofür und auf welchem Port; nach der Arbeit wieder
stoppen. Ausnahmen (schlanke Auslese-Werkzeuge), Abgrenzung und Begründung stehen im Skill
`server-start-regeln`. Ein `PreToolUse`-Hook fängt die typischen Startbefehle ab und legt sie
Daniel zur Entscheidung vor.

**Kein Ton aus dem Claude-Preview:** Was der Agent selbst im Browser-Pane bzw. Preview-Server
des Claude-Windows-Clients ansteuert (`preview_*`, `mcp__Claude_Browser__*`), darf **nichts**
aus Daniels Lautsprechern erzeugen: jedes `<video>`/`<audio>` stumm, kein Autoplay mit Ton,
keine selbsttätige `Audio()`- oder `AudioContext`-Wiedergabe. Die Regel schützt Daniel vor dem
Agenten, **nicht** den Spieler vor dem Spiel — für gebaute Produkte, Deployments und lokal von
Daniel selbst geöffnete Server gilt sie ausdrücklich nicht. Klang wird trotzdem **gemessen**
statt übersprungen. Geltungsbereich, Messverfahren und Begründung im Skill `preview-ton-stumm`.

**Ansagen, was auf dem Bildschirm auftaucht:** Alles, was sichtbar auf Daniels Bildschirm
erscheint, wird **vorher** mit einer kurzen Zeile im Chat angekündigt — Fenster und Dialoge,
UAC-Abfragen, **Firewall-Abfragen**, Icons im Infobereich, Browser-Tabs, Konsolenfenster, und
auch der **Neustart einer bereits laufenden Anwendung** (die verschwindet und kommt neu, das
sieht aus wie ein Absturz).

Die Aufzählung ist nicht abschließend, und genau daran ist sie schon gescheitert: Am 12.08.2026
erschien beim ersten Playwright-Lauf eine Windows-Firewall-Abfrage zu
`chrome-headless-shell.exe`. Angekündigt war nur „läuft im Hintergrund". Prüffrage vor jedem
Programm, das Daniel auf diesem Rechner noch nie ausgeführt hat: **Fragt Windows beim ersten
Mal irgendetwas?** Bei einer Firewall-Abfrage gehört in die Ansage, ob Zulassen überhaupt nötig
ist — bei Playwright nicht, es redet nur über die lokale Schleife.

Die Ansage beantwortet vier Dinge: **was** gestartet wurde, **warum**, **was** gleich zu sehen
ist, und **was er damit tun soll**. Der letzte Teil ist der wichtigste. **Höchstens 250
Zeichen** — es ist eine Ansage, kein Absatz. Die Begründung ist ein Halbsatz.

- „Starte LibreHardwareMonitor, um die Lüfterdrehzahlen auszulesen — landet nur im
  Infobereich, bitte offen lassen, ich schließe es nachher selbst."
- „Gleich eine UAC-Abfrage: FanControl läuft erhöht und lässt sich nur so neu starten."
- „FanControl startet neu, damit es die neue Kurve lädt — Fenster verschwindet kurz, ein
  Fehlerdialog dabei ist erwartet, einfach stehen lassen."

**Kehrseite derselben Regel — gar nicht erst zeigen, was niemand sehen muss:** Sichtbar wird
nur, was Daniel wirklich braucht. Alles Übrige läuft unsichtbar:

- `Start-Process … -Verb RunAs` bekommt **immer** `-WindowStyle Hidden`. Sonst steht ein blaues
  Konsolenfenster so lange im Vordergrund, wie das Skript läuft (real: 35 s über dem Browser).
  Das erhöhte Skript schreibt sein Ergebnis in eine Datei, die danach gelesen wird.
- Lang laufende Messungen, Sampler und Hilfsskripte laufen im Hintergrund, nicht in einem Fenster.
- Werkzeuge, die nur ausgelesen werden, starten minimiert bzw. im Infobereich.

Faustregel: **Ankündigen ersetzt nicht das Vermeiden.** Ein angekündigtes störendes Fenster ist
immer noch ein störendes Fenster.

**Und was ich gestartet habe, beende ich auch.** Ein Werkzeug, das für eine
Aufgabe hochgefahren wurde, wird nach der Aufgabe sauber beendet — Browser,
Monitor-Programme, Hilfsanwendungen, Fenster im Infobereich. Nicht nur der Tab
oder die Ansicht darin: das Programm.

Anlass (07.09.2026): Für eine Abfrage in der Google Search Console habe ich Edge
gestartet, danach den Tab geschlossen und das Fenster stehen lassen. Daniels
Rückmeldung: „nachdem du mit edge/claude extension fertig warst … hast du edge
nicht geschlossen, pack es in toolkasten als info, das nachdem du mit arbeiten
mit einem tool fertig bist das tool entsprechend sauber beendest."

Das ist die Kehrseite derselben Regel wie oben: Ein Fenster, das niemand mehr
braucht, ist genauso störend wie eines, das unangekündigt aufgeht — nur fällt es
später auf und gehört dann zu nichts mehr.

**Die eine Ausnahme:** Das Programm lief schon, bevor ich es brauchte. Dann war
es nicht meins. Wer das nicht weiß, prüft es **vor** dem Start (`tasklist`), nicht
danach.
