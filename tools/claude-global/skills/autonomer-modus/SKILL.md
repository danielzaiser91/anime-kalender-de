---
name: autonomer-modus
description: "Wenn Daniel selbstständiges Arbeiten über einen Zeitraum aufträgt („autonomer modus bis 20 uhr\"): zuerst Wecker stellen, Ablauf je Wachphase, Arbeitsquellen, Rückfragegrenzen."
---

# Autonomer Modus: der erste Handgriff ist der Wecker

## Warum es diesen Skill gibt

Am 06.09.2026 um 08:02 Uhr lautete der Auftrag: *„autonomer modus bis 20 uhr, entscheide
selbst was dem projekt am meisten hilft, und arbeite dann dran."* Gearbeitet wurde bis
**10:30 Uhr**. Daniels nächste Nachricht kam um **19:16 Uhr**: *„du hast vor 9h aufgehört zu
arbeiten."*

Dazwischen lagen **acht Stunden und sechsundvierzig Minuten**, in denen nichts geschah — nicht
weil die Arbeit ausging (der Footer führte weiter offene Punkte, Läufe warteten auf
Auswertung), sondern weil **niemand mich wieder angestoßen hat**.

Das ist der ganze Fehler, und er ist mechanischer Natur: Ein Turn endet, wenn die Antwort
steht. Ohne einen Wecker gibt es keinen nächsten. Ein Vorsatz („ich arbeite dann weiter")
ersetzt ihn nicht — er ist genau das „als nächstes mache ich X", das die Arbeitsregeln als
Abbruch benennen.

**Also: Der Wecker wird gestellt, bevor die erste Aufgabe angefasst wird.**

## Schritt 1 — Wecker stellen, sofort

Noch vor jeder Recherche, jedem Werkzeugaufruf zur Sache, jeder Planung:

1. **Endzeit bestimmen.** Aus dem Auftrag („bis 20 uhr" → heute 20:00). Die aktuelle Uhrzeit
   steht im `[Systemzeit: HH:MM Uhr]`-Vermerk am Prompt — sie wird gelesen, nicht geschätzt.
   **Standard-Ende: 23:30 Uhr, 30 Minuten vor Tagesende** (Daniel, 10.10.2026) — gilt immer,
   wenn Daniel keine andere Endzeit nennt; nicht nachfragen. Nennt er eine, gilt seine. Auch
   bei „weiter“ in einer neuen Sitzung mit Übergabe „Autonomer Modus“ wird der Modus mit
   diesem Ende gestartet. Ein autonomer Modus ohne Ende gibt es nie.
2. **Prüfen, ob schon eine Schleife läuft** (`TaskList`). Zwei Schleifen auf denselben Auftrag
   wecken doppelt und arbeiten gegeneinander.
3. **Marker schreiben:** Endzeit (ISO, mit Offset) in `~/.claude/autonomer-modus/<Sitzungs-ID>.txt` (Sitzungs-ID = Name des Scratchpad-Ordners bzw. der Transkript-Datei; je Sitzung ein Marker, damit Routinen und andere Sitzungen nicht mitlaufen — Daniel, 14.10.2026)
   (Anzeige im Mod `arbeitsliste`: grün, solange die Zeit in der Zukunft liegt; jedes Beenden löscht die Datei).
4. **Schleife starten** — über den `loop`-Skill, ohne Intervall, damit die Taktung von der
   Sache abhängt und nicht von einer Zahl:

   ```
   Skill({ skill: "loop", args: "<Auftrag im Wortlaut> — autonomer Modus bis <HH:MM>" })
   ```

   Der Auftragstext muss die **Endzeit im Klartext** enthalten. Er wird bei jedem Wecken
   wörtlich zurückgereicht; steht die Endzeit nicht darin, weiß die nächste Wachphase nicht,
   wann Schluss ist.

**Warum die Schleife und nicht ein fester Cron-Takt:** Ein Takt von fünfzehn Minuten weckt auch
dann, wenn ein Lauf noch vierzig Minuten braucht — das sind drei Wachphasen, die nichts tun
können. Die selbstgewählte Taktung setzt den nächsten Weckruf dorthin, wo er etwas
vorfindet.

## Schritt 2 — was in jeder Wachphase passiert

Immer in dieser Reihenfolge:

1. **Zeit prüfen.** Systemzeit gegen die Endzeit. Ist sie erreicht oder überschritten:
   Abschluss (siehe unten), sonst weiter.
2. **Stand einsammeln**, ohne zu raten:
   - `status.md` des Projekts (Abschnitte „In Arbeit", „Queue", Dauerauftrag)
   - `TODO.md`, falls vorhanden
   - laufende und fertige Läufe (`gh run list`), Ergebnisse auswerten, die seit dem letzten
     Wecken angekommen sind
   - **rote Läufe in einer Statusanzeige** — der Teil, den man am leichtesten übersieht,
     weil er nicht im Repo steht. Gibt es ein Aufräum-Werkzeug, wird es mit `--trocken`
     gefahren: Was es **nicht** von selbst abnimmt, ist genau das, was ich mir ansehen muss.
     Auch eine Warnung („ROT im Verlauf … warnung“) bekommt in derselben Wachphase einen
     Besitzer (Analyst oder Fix) — der Wochenlauf stand 6 Tage gelb, jede Wachphase sah ihn,
     keine handelte (18.10.2026). Ist sie geprüft und schon behoben, der nächste grüne Lauf aber noch Tage entfernt: mit `node C:/code/ai/__assets/tools/mit-lauf-token.mjs laeufe-aufraeumen C:/code/ai/anime-kalender-de --erledigt <lauf_id> --notiz "behoben durch …, Nachprüfung <Datum>"` abnehmen und die Nachprüfung als 📅 eintragen (23.10.2026).
   - Hintergrundaufgaben dieser Sitzung (`TaskList`)
   - **Rechnerlast:** `node C:/code/ai/__assets/tools/last-blick.mjs` — jede „ZU VIEL“-Zeile wird in derselben Wachphase behoben (Agent anweisen, Prüfkette serialisieren, Bauer-Zahl senken), nicht nur notiert; Daniel bemerkte 91 bash und Ruckeln vor mir (18.10.2026).
   - **Liegende PRs** (anime-kalender-de, seit 21.10.2026): `node tools/liegegut.mjs` — jede Zeile bekommt in derselben Wachphase einen Besitzer (Merge-Reihe, Nachbesserung in den Vorrat, Schließen mit Beleg); 13 PRs lagen bis zu 4 Tage, weil niemand hinsah.
   - **Ticket-Board an die PRs angleichen:** `node C:/code/ai/ticket-board/bin/ticket.mjs abgleich --alle-projekte` (offen → in-arbeit, gemergt → bald-live, geschlossen → verworfen; seit 28.10.2026, vorher standen 13 Tickets „in Arbeit“ mit längst gemergtem PR).
   - **Prüftisch:** in der ersten Wachphase des Tages den fälligen Bereich nach Skill
     `prueftisch` an einen Analysten geben (Daniel, 16.10.2026).

   **Ein roter Lauf wird bemerkt, nicht gemeldet.** Daniel am 07.09.2026: „wann immer ein
   lauf fehlschlägt musst du selbst mitbekommen, anschauen, und handeln, und im anschluss
   status app säubern. jeder überprüfte lauf in status app muss aus status app auch wieder
   verschwinden." Zwei Läufe standen dort drei Stunden rot, beide durch meine eigenen
   Commits verursacht — bei jeder Wachphase sichtbar gewesen, wenn ich hingesehen hätte.
   - **Nebenbei beobachten** (Skill `prueftisch`, fünf Linsen: Performance, Stabilität, Effizienz, Last-Ort, Ideen) — auch Last auf Daniels PC (`prozess-inventur`, Anzahl Ordner unter `C:/code/_worktrees/`), und jeden Vorschlag der Agenten im selben Zug entscheiden.
3. **Arbeiten, bis nichts Grünes mehr offen ist** — nach `bis-nichts-mehr-offen-ist`. Eine
   Wachphase ist kein Statusbericht, sie ist eine Arbeitseinheit: **Arbeit an Subagenten
   delegieren, Berichte auswerten und nachprüfen, entscheiden, committen, ausliefern**
   (Skill `delegieren-und-parallelisieren`); selbst nur kleine Handgriffe.
4. **Erst dann den nächsten Weckruf setzen.** Der Turn endet, sobald `ScheduleWakeup`
   zurückkommt — alles, was danach käme, passiert nicht mehr.

## Schritt 3 — wann der nächste Weckruf sitzt

**Dynamischer Wecker, nach JEDEM Turn neu gesetzt** (Daniel, 06.10.2026): Solange in der Todo-Liste mindestens ein Eintrag steht, an dem ich selbst arbeiten kann und der nicht schon an einen Subagenten delegiert ist, **pausiere ich nicht**: Der Turn arbeitet weiter, und endet er trotzdem (Kontext, Nachricht von Daniel), steht ein Wecker auf **60 Sekunden**. Gibt es nichts Aktives mehr (alles delegiert, wartet auf Läufe oder auf Daniel), steht er auf **10 Minuten**, um erneut zu prüfen. Anlass: Ein 25-Minuten-Wecker lief nie ab, weil Daniels Nachrichten die Turns füllten und danach kein neuer gestellt wurde — über 50 Minuten ohne eigene Arbeit. Auch ein Turn, der durch eine Nachricht von Daniel ausgelöst wurde, endet mit `ScheduleWakeup`. Die Tabelle unten gilt nur für Wartezeiten auf einen Lauf. Reihenfolge- und Vorgehensfragen entscheidet Claude selbst.

**Antwort an Daniel steht nach dem Wecker, nie davor (Daniel, 24.10.2026 „wo?“):** Der Desktop-Client klappt Text vor dem letzten Werkzeugaufruf weg und zeigt nur, was danach kommt. Also erst `ScheduleWakeup`, dann die Antwort als letzter Text.

`ScheduleWakeup` nimmt 60 bis 3600 Sekunden. Gewählt wird nach dem, worauf gewartet wird:

| Lage | Verzögerung |
|---|---|
| Ein Lauf braucht noch ~20 min, danach ist er auszuwerten | ~1200 s, passend zum Lauf |
| Nichts läuft, Aufgaben sind da, aber der Kontext ist voll | 60–300 s, nur zum Weiterarbeiten |
| Alles abgearbeitet, nichts läuft, es fehlt eine Idee | 1200–1800 s, dann neu suchen |
| Warten auf Daniel (🙋) und sonst nichts offen | 1800 s, und im `reason` sagen, worauf |

`noop: true` für eine Wachphase, die nichts verändert hat (ein Lauf war noch nicht fertig) —
`noop: false`, sobald etwas entstanden ist. Der `prompt` ist **immer** der ursprüngliche
`/loop`-Text im Wortlaut, samt Endzeit.

**Hängt der nächste Schritt an einem Ereignis** — ein Lauf endet, eine Datei ändert sich —,
gehört ein `Monitor` mit `persistent: true` dazu. Dann weckt das Ereignis, und der Weckruf ist
nur noch die Rückfallebene (1200–1800 s).
**Monitore filtern (11.10.2026, Token-Messung):** Jede Monitor-Meldung kostet einen vollen Turn der Hauptsitzung (ganzer Kontext aus dem Cache). Nur Endzustände melden (MERGED, neues Prüfer-Urteil, Lauf fertig), nie Statusflattern wie DIRTY/UNKNOWN.

**Plätze sind immer voll (Daniel, 11.10.2026):** Die Agentenplätze werden in jeder Wachphase ohne Bedingung bis zum Limit gefüllt — 5 Nicht-Prüfer (Prüfer zählen nicht), im Ruhemodus 2 (seit 14.10.2026), Prüfer ebenfalls nicht mitgezählt (hart/sanft: Skill `delegieren-und-parallelisieren`) —, in fester Reihenfolge: **zuerst Angefangenes** (liegende PRs aus `node tools/liegegut.mjs`, älteste zuerst; dann Vorhaben mit gemergten Teilen, z. B. Empfehlungen 2 von 4), erst danach „In Arbeit“ und „Als Nächstes“ — Ausnahme nur echt Kritisches (Daniel, 24.10.2026: 18 PRs lagen > 2 Tage, weil Neues immer oben einsortiert und zuerst vergeben wurde), ob gerade auf Läufe gewartet wird oder nicht. Prüffrage vor jedem `ScheduleWakeup`: Sind weniger Agenten aktiv als erlaubt, obwohl es eigenständige Punkte gibt? **Und nie mehr als erlaubt (Daniel, 11.10.2026 14:11: 8 statt 5):** vor jedem Start UND jeder Nachbesserung per SendMessage zählen — eine wieder aufgenommene Nachbesserung und ein wartender Agent (Polling auf einen Merge) belegen je einen Platz. Ist das Limit erreicht, Nachbesserung in die Warteschlange statt SendMessage.

## Schritt 4 — woher die Arbeit kommt, wenn die Liste leer ist

Der Auftrag lautet „entscheide selbst, was dem Projekt am meisten hilft". Eine leere Liste ist
deshalb **kein** Grund aufzuhören, sondern der Anfang der eigentlichen Arbeit. In dieser
Reihenfolge:

1. **Offene Punkte im Footer**, die auf eine eigene Vorarbeit warten (🟡) — ist die Vorarbeit
   jetzt fertig?
2. **Das Projektziel gegen den Bestand halten.** Die `CLAUDE.md` nennt es; wo klafft die größte
   Lücke, gemessen statt vermutet? So ist am 06.09.2026 die Detektiv-Conan-Lücke gefunden
   worden: 405 deutsche Folgen bei einem Anbieter, im Datensatz kein einziger Weg dorthin.
3. **Dokumentierte Fehlschläge nachmessen.** Was steht als „gescheitert" in `status.md`, und
   gilt der Grund heute noch?
4. **Prüfungen erweitern**, wo eine Regel bisher nur ein Vorsatz ist.
5. **Wissensbestände nachziehen** (`wissen-veraltet-nie`): veraltete Zahlen, erledigte
   Aufgaben, widerlegte Annahmen.

Was dabei entsteht, wird **sofort eingetragen**, nicht nur getan — sonst weiß die nächste
Wachphase nichts davon.

## Was auch im autonomen Modus nicht ohne Rückfrage passiert

Der Modus erweitert den Handlungsspielraum, nicht die Erlaubnisse. Unverändert vorher fragen:

- alles, was **Geld** kostet
- alles, was **nach außen** wirkt (Mails, Veröffentlichungen, fremde Server, Beiträge)
- **schwer Umkehrbares** (Löschungen, Force-Push, Datenverlust)
- das **Umkehren einer getroffenen Entscheidung** — auch einer eigenen, die dokumentiert ist
- **rechtliche Grauzonen** (Abrufe gegen Betreiber, die es untersagen)
- ein **Server**, der einen Port öffnet

Kommt so etwas auf, wird es als 🙋 eingetragen und die Wachphase macht mit etwas anderem
weiter — sie hält nicht an.

## Melden: während der Arbeit still, am Ende belegt

Es gilt weiter „während der Arbeit wird nicht erzählt": Gemeldet wird eine **Erkenntnis** oder
ein **Fehler**, sonst nichts. Eine Wachphase ohne Ergebnis meldet gar nichts und setzt nur den
nächsten Weckruf (`noop: true`).

**Am Ende der Endzeit** steht eine Meldung, die zwei Fragen beantwortet: Was ist jetzt anders,
und was soll Daniel damit tun. **Kein Footer** — nie, auch nicht in der Abschlussmeldung (Daniel,
02.10.2026); der Stand steht in `status.md`. Kein Tagebuch der Wachphasen.

## Beenden

Beim Beenden den eigenen Marker `autonomer-modus/<Sitzungs-ID>.txt` löschen (Mod zeigt dann grau). Die Schleife endet, wenn eine dieser Bedingungen eintritt:

- **Die Endzeit ist erreicht** → Abschlussmeldung, dann `ScheduleWakeup({ stop: true })`.
- **Daniel sagt Stopp** oder gibt einen neuen Auftrag, der den alten ersetzt → Schleife
  beenden, das sagen.
- **Es geht wirklich nicht weiter** — alles Offene hängt an Daniel oder an einem Lauf, der
  erst morgen kommt. Dann wird das gesagt, mit der Liste, und die Schleife endet; sie läuft
  nicht als leere Hülle bis zur Endzeit weiter.

Ein neuer Auftrag von Daniel mitten in der Schleife hat **Vorrang**: erst seine Sache, dann
die Schleife fortsetzen. Der Weckruf wird dabei neu gesetzt, sonst endet der Turn mit seiner
Antwort und die Schleife ist tot.

## Die zwei Fehler, gegen die dieser Skill gebaut ist

1. **Der Turn endet ohne Wecker.** Genau das ist am 06.09.2026 passiert: acht Stunden
   Stillstand, obwohl Arbeit dalag. Prüffrage vor dem Absenden **jeder** Antwort im autonomen
   Modus: *Steht ein Weckruf, oder war das gerade das Ende?*
2. **Der Wecker wird gestellt, aber die Endzeit fehlt im Prompt.** Dann wacht die nächste
   Phase ohne Auftrag auf und hält sich für fertig. Die Endzeit gehört in den Text, nicht ins
   Gedächtnis.
