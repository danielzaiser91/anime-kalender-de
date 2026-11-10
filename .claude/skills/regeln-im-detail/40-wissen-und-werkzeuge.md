# Wissen, Werkzeuge, Secrets

**Erkenntnisse festhalten — kein Aufschub:** Sobald eine Schwierigkeit überwunden ist —
unerwartetes Verhalten, stiller Fehlschlag, ein Werkzeug, das etwas anderes tut als
dokumentiert, eine falsche Annahme, ein Fehler, der Geld oder Zeit gekostet hat — wird die
Erkenntnis **in derselben Antwort verankert, in der ihr Beleg steht**: der grüne Gegentest, die
Messung, der durchgelaufene Lauf, Daniels Bestätigung. Ungefragt, ohne dass er daran erinnern
muss. Nicht am Ende einer langen Sitzung bündeln.

**Nicht mitten in den Fix hinein**, solange er ungeprüft ist (Daniel, 21.08.2026): Eine Regel
aus einer Vermutung zeigt künftig in die falsche Richtung, und niemand hinterfragt sie mehr,
weil sie ja aufgeschrieben ist. Dauert der Beleg — ein Lauf über neunhundert Serien entscheidet
erst am Ende —, kommt eine Zeile in die Aufgabenliste („Erkenntnisse offen"): was vermutet wird
und woran es sich entscheidet. Eingelöst wird sie, wenn der Beleg da ist.

Prüffrage am Ende jeder Antwort, die einen Beleg enthält: **Was wusste ich vor dieser Sitzung
nicht, das gerade bewiesen wurde?** Steht die Antwort nirgends dauerhaft, gehört sie hinein,
bevor die Antwort rausgeht.

Zielort: im Skill des betroffenen Werkzeugs, in `ai_agent_learnings.md`, in der
Projekt-`CLAUDE.md`, im Memory oder als Kommentar direkt neben dem Code. Wo möglich zusätzlich
als Test oder Zusicherung, damit sie im Weg steht statt überlesen zu werden. Gibt es keinen
passenden Skill, wird einer angelegt. Vorgehen und Zielwahl stehen im Skill
`erkenntnisse-festhalten`. Faustregel: **Jede Hürde darf genau einmal kosten.**

**Eine Korrektur von Daniel gilt der Regel, nicht dem Einzelfall:** Korrigiert er eine
Arbeitsweise, fragt nach, warum etwas so aussieht, oder weist auf einen Widerspruch hin, dann
hat ein Dokument diesen Fehler zugelassen — eine Regel hier, ein Skill, eine `CLAUDE.md`, ein
Memory. Dieses Dokument wird **in derselben Antwort** geschärft, ungefragt; den Einzelfall zu
beheben genügt nicht, sonst meldet er denselben Fehler ein zweites Mal. Prüffrage: *Hätte der
Text, so wie er jetzt dasteht, genau diesen Fehler verhindert?* Vorgehen, Zielwahl und die
Formen, die tatsächlich tragen, stehen im Skill `korrektur-schaerft-die-regel`.

**Dasselbe gilt ohne Korrektur von außen** (Daniel, 23.08.2026): „wenn du sowas merkst, das du
was falsch gemacht hast und hättest anders müssen, dann verschärfe entsprechend den skill sofort."
Der Auslöser ist die Einsicht, nicht die Rückmeldung — ein Fehlschlag im eigenen Testlauf zählt
genauso. Am schwersten wiegt der **Fehler zum zweiten Mal, obwohl die Lehre schon geschrieben
steht**: Dann ist nicht der Fehler das Problem, sondern der Text, der nicht getragen hat.

`improve-learnings.md` ist damit **kein Ergänzungs-Mechanismus**, sondern reines periodisches
Aufräumen (Duplikate zusammenlegen, Veraltetes korrigieren) — kein Slash-Command, sondern
etwas, das ich selbst anstoße, wenn eine Aufräumung sinnvoll erscheint. Finden sich dabei viele
noch nicht festgehaltene Kandidaten, ist das selbst ein Symptom, keine normale Bestandsaufnahme.

**Learnings-Check:** Sobald die Art des Projekts erkennbar ist (Sprache, Framework, Domäne), in
der Kategorie-Tabelle von `C:\code\ai\ai helper files\ai_agent_learnings.md` nachschauen, welche
Kategorien passen, und **nur diese** lesen — nicht die ganze Datei. Ziel: bekannte Fallstricke
vorher vermeiden statt sie neu zu erleiden.

**Projekt-Check, sobald ein anderes Projekt zur Sprache kommt:** Nennt Daniel etwas, woran wir
gerade nicht arbeiten, steht es in `C:\code\ai\ai helper files\ai_agent_projects.md` — eine
Zeile je Projekt, mit Ort und Repo. **Vor jedem „ich baue dir X" die Frage: Gibt es X schon?**
Anlass (21.08.2026): Er erwähnte seine „chrome utilities extension", ich kannte sie nicht und
schlug eine neue vor — obwohl seine vorhandene bereits Netflix, Disney+ und Crunchyroll bedient
und auf genau der Seite eigene Bedienelemente einblendet, um die es ging. Ein neues Repo bekommt
dort eine Zeile, sobald es mehr ist als ein leeres Gerüst.

**Werkzeug-Check vor jedem Download UND vor jeder Benutzung:** Bevor ein Werkzeug
heruntergeladen oder installiert wird, in `C:\code\ai\ai helper files\ai_agent_tools.md`
nachschauen, ob es schon da ist oder ein vorhandenes die Frage beantwortet. Wird doch etwas
Neues besorgt und es bewährt sich: dauerhaft unter `C:\code\ai\__assets\tools\` ablegen (nicht
im Scratchpad — der wird gelöscht) und mit getestetem Aufrufbefehl eintragen.

**Und „wo liegt eigentlich X?" ist eine Werkzeugfrage, keine Suchfrage.** Zuerst wird `ai_agent_tools.md` gelesen, erst danach das Dateisystem durchsucht — auch und gerade bei Selbstgebautem. Was dort nicht steht, wird eingetragen, bevor weitergearbeitet wird (Anlass im Skill `werkzeugkasten-zuerst`).

**Und „das kann ich nicht" ist dieselbe Frage, nur gefährlicher:** Eine Suche kostet Minuten, eine falsche Absage die Aufgabe — und sie klingt nach einer Feststellung, die niemand hinterfragt (zwei reale Fälle im Skill `werkzeugkasten-zuerst`).

**Prüffrage vor jedem Satz der Form „ich kann X nicht", „dafür fehlt mir der
Zugang", „das musst du selbst machen": Steht X in `ai_agent_tools.md`?** Und wenn
das Werkzeug dort steht, aber gerade nicht läuft: **starten**, nicht melden. Der
Startbefehl steht in seinem Abschnitt. Erst wenn er fehlschlägt, wird gefragt.

**Der Blick hinein gilt genauso, wenn nichts heruntergeladen wird.** Sobald ein Werkzeug aus
dem Kasten angefasst wird, wird **vor dem ersten Handgriff** sein Abschnitt gelesen, besonders
die „Fallstricke" — nicht erst, wenn etwas klemmt. Anlass (10.08.2026): Im FanControl-Abschnitt
standen bereits „Kennungen nicht raten" und „Umschalten geht per `-c`". Nicht hineingesehen,
Sensor-Kennungen geraten — Lüftersteuerung eine Viertelstunde tot, zwei falsche Aussagen, und
fünf unnötige Neustarts mit UAC-Abfrage. Der Werkzeugkasten ist die erste Handlung, keine
Nachschlage-Reserve für den Notfall.

**API-Doku vor dem ersten Abruf:** Bevor eine Zeile Abrufcode gegen einen fremden Dienst
entsteht, wird nach dessen offizieller API und deren Rate Limits gesucht — Suchbegriff
`<domain> api documentation rate limit`, drei Minuten Aufwand. Unterlassen führte dazu, dass
ein Scraper mit dem Sechsfachen des dokumentierten Limits lief und eine IP-Sperre auslöste, die
auch Daniel selbst aussperrte. Gibt es keine API, gilt das dokumentierte Limit trotzdem als
Taktvorgabe für Seitenaufrufe. robots.txt wird im selben Schritt gelesen, nicht danach.

**Und vor dem ersten Massenabruf steht der Ausweichweg fest** (Daniel, 20.09.2026: „bevor du
solche abfragen machst die evtl in sperren laufen, immer möglichkeit in hinterhand haben darauf
zu reagieren mit anderer ip oder anderen wegen"). Eine Sperre ist keine Überraschung, sondern
der wahrscheinlichste Ausgang — wer erst danach überlegt, steht mit einem halben Ergebnis da und
kann den Rest tagelang nicht holen. Drei Griffe, alle **vor** dem Lauf:

- **Nachschlagen, wie dieser Anbieter sperrt**: Schwelle, Dauer, gilt sie der Adresse oder der
  IP. Steht es schon im eigenen Wissen (`docs/wissen/`, Learnings), zählt das; sonst kurz suchen.
- **Den Ausweichweg benennen und an *einer* Adresse testen**, bevor tausend laufen: andere
  Leitung, anderer Dienst, offizielle Schnittstelle, ein Extraktionsdienst, der Browser des
  Users. Ein Ausweich, der erst im Ernstfall das erste Mal probiert wird, ist keiner.
- **Den Lauf so bauen, dass er die Sperre überlebt**: kleine Blöcke, Pause statt Abbruch, und
  die Nichtauskunft wird nie als Befund gespeichert.

Und der billigste Griff zuerst: **prüfen, ob die Sperre überhaupt noch steht**, statt sie aus
dem letzten Lauf zu vermuten — aber mit einer kleinen **Serie**, nicht mit einem Abruf. Am
20.09.2026 kamen zwei Einzelabrufe bei Amazon voll durch; der Lauf vier Minuten später war nach
zwanzig Abrufen wieder gesperrt. Ein einzelner Treffer sagt nichts über die Serie, die gleich
folgt.

**Bei einer Rechtsfrage zum Abrufen: erst die `robots.txt` lesen, dann die AGB.** Ein
maschinenlesbares Verbot des **konkreten Pfads** entscheidet die Sache schneller und
eindeutiger als jede Auslegung einer Vertragsklausel — und es ist in dreißig Sekunden
gemessen statt in zwei Stunden ergoogelt. Belegt am 24.08.2026 an Amazon: Die Frage, ob eine
Informationspflicht das Data-Mining-Verbot der Nutzungsbedingungen aufwiegt, ließ sich
juristisch stundenlang von beiden Seiten betrachten. Entschieden hat sie eine Zeile:
`/gp/video/api` ist gesperrt — genau der Aufruf, über den die vollständige Folgenliste käme.
Dazu über neunzig namentlich gesperrte Bots, und damit fehlte dem BGH-Urteil, das geholfen
hätte (I ZR 159/10), seine tragende Voraussetzung („keine besonderen Vorkehrungen getroffen").

Zwei Griffe, die dabei nicht fehlen dürfen: **den Pfad prüfen, den man wirklich braucht** —
die Titelseite war erlaubt, die Nachlade-Schnittstelle nicht — und **die namentlichen
User-agent-Blöcke lesen**, nicht nur den `*`-Block. Sie sagen, ob der Betreiber automatisiertes
Auslesen überhaupt duldet.

**Und „keine dokumentierte API" heißt nicht „keine Schnittstelle".** Fast jede moderne Seite
ist eine JavaScript-Anwendung, die ihren Inhalt über JSON nachlädt — diese Schnittstelle ist
da, auch wenn niemand sie beschreibt. **Vor jeder Zeile Scraping-Code wird deshalb der
Netzwerkverkehr der Seite gelesen**, nicht nur nach einer Doku gesucht. Real am 21.08.2026:
Zehn Tage lang wurden Crunchyroll-Seiten gerendert und Textmuster gelesen, 5 bis 23 Sekunden
je Abruf; die Seite selbst holt dieselben Daten als JSON in 70 bis 200 Millisekunden — und
zwar genauer, weil je Folge statt je Staffel. Daniel: „du hättest es direkt am anfang vor dem
scraping vor tagen bereits erkennen müssen." Prüffrage: **Woher hat die Seite selbst diese
Angabe?** Handgriffe, Fallen und die Grenzen im Skill `netzwerkverkehr-statt-scraping`.

**Secret-Sharing:** Teilt Daniel irgendein Secret (API-Key, Passwort, Token,
Benutzername+Passwort) — als Text oder Screenshot — sofort in
`C:\code\ai\ai helper files\my_secrets.md` eintragen (Projekt/Dienst, Typ, Wert). Ziel: künftige
Sitzungen finden alle bekannten Secrets an diesem einen Ort. Die Datei wird **nicht**
automatisch in jede Sitzung geladen — sie wird gelesen, wenn ein Zugang gebraucht wird.

