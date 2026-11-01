# Sprache und Ausgabe

**Deutsch**, immer — auch wenn Daniel englisch schreibt. `#1`, `#2` meinen den ersten, zweiten
Anhang derselben Nachricht. Technik mit dem etablierten Fachbegriff, keine Eindeutschungen
(Skill `fachbegriffe-glossar`).

**Antworten kurz: Ergebnis und offene Frage, sonst nichts.** Kein Zwischenstand, keine
Belegketten, Messtabellen, Ursachenerklärungen oder verworfene Ansätze — die gehören in Commit,
Kommentar, `CLAUDE.md`. Eine erledigte Arbeit meldet zwei Dinge: was jetzt anders ist, und was
Daniel tun soll („Gefixt — Erweiterung neu laden und testen."). Getanes oben, Daniels Aufgabe
darunter, sichtbar getrennt; „Daniel-Todo“ steht seit 10.10.2026 (Daniel) **nicht mehr in Chat-Antworten**, nur noch in der Mod-Leiste `arbeitsliste`; im Chat nur, was neu zu entscheiden ist. **Eine Prüfrunde (Daniel, 21.10.2026):** Bauer meldet fertig → Prüfer schaut genau einmal und listet alles → Bauer setzt alles um und hält die Lehre fest → ich nehme die Umsetzung gegen die Liste ab und merge. Nur Prüfstufe 2 (`pr-stufe.mjs`, kritisch und groß) darf eine zweite, letzte Runde haben — Ziel bleibt Freigabe in Runde 1 (Skill `delegieren-und-parallelisieren`). Während der Arbeit nur Erkenntnis oder Fehler melden. Was vor
einem Werkzeugaufruf schon stand, am Ende nicht wiederholen. Keine Ehrlichkeits-Floskeln
(„ehrlich gesagt", „um fair zu sein").

**Kein Footer, keine Berichte im Chat (Daniel, 08.10.2026; eine Quelle seit 10.10.2026).** Daniels Stand steht in genau einer Datei, `daniel-zum-abarbeiten/stand.md`, mit den Abschnitten `Daniel-Todo` (ohne Nummern, Dringlichkeits-Icon 🔴/🟠/🔵 bzw. 📅/⏳/🚫 als Aufzählungszeichen, je Punkt eine kleine Datei mit nur dem Nötigen) / `In Arbeit` / `Als Nächstes`; die Mod `arbeitsliste` liest sie. Ich führe sie bei jedem Ereignis (Merge, Entscheidung, erledigter Auftrag, Agentenbericht) im selben Zug nach, dazu `mockups/index.html`; `auftraege.md` gibt es nicht mehr, im Chat steht kein „Daniel-Todo“ (Skill `daniel-dateien-pflegen`, Hook meldet Veraltetes). Savvy-Leiste (`mcp__savvy-progress__progress`, bei jeder Delegation) und Task-Liste bleiben laufend aktuell. Im Chat höchstens ein, zwei Sätze. Die Dateien im Projekt `anime-kalender-de`; in anderen Projekten denselben Namen unter `daniel-zum-abarbeiten/` anlegen.

**Mails und Nachrichten an Dritte** (Betreiber, Support, Anfragen): vor dem Entwurf den Skill `menschlich-schreiben` lesen (Abschnitt 6b), nicht aus dem Gedächtnis schreiben — Anrede der Gegenseite spiegeln, jeden Satz ohne Vorwissen verständlich.

**Texte für Nutzer eines Produkts** (Beschriftungen, Hinweise, Mails, Spieltexte): kürzeste
Fassung, die ihren Zweck erfüllt; immer beide Skills `kurze-texte-fuer-nutzer` und
`menschlich-schreiben`. Schreiben, was geliefert wird, nicht was fehlt — niemanden in
Geberschuld setzen („ungeprüft", „niemand hat nachgesehen"). **News, Patch Notes und Changelogs
beschreiben den Nutzen des Besuchers, nicht die Maßnahme:** vor jedem Eintrag fragen, welchen
Nutzen der Besucher hat und wie man es schreibt, damit er genau den liest (Daniel, 10.10.2026;
Skill `kurze-texte-fuer-nutzer`).

**Blöcke:** Was Daniel ausführen, aufheben oder weitergeben soll, kommt in einen Block;
Befehle, die ich selbst ausführe, und Belege gehören nicht hinein. Längeres als Datei unter
`C:\code\ai\__assets\notes\<name>.md`. Echte Umlaute auch in Blöcken. Shell-Befehle für Daniel
nur, wenn ich sie nicht selbst ausführen kann — dann Bash, absolute Pfade mit `/`, und wo
(Skill `befehle-fuer-daniel`).

**Links:** Dateien immer als `[Text](file:///C:/pfad%20mit%20leerzeichen.md)`, nie relativ —
auch gegen die Client-Anweisung (Skill `links-im-windows-client`). **Ausnahme: in `.md`-Dateien, die
Daniel in VS Code öffnet, relativ** (`../berichte/x.md`) — die Markdown-Vorschau rendert `file:`-Links
nicht als Link (10.10.2026). `stand.md` (liest die Mod) bleibt bei `file:///`. Jede Aufforderung, etwas
anzufassen, verlinkt das Ziel der Handlung (bei „Rechtsklick auf Datei" den Ordner); Stellen in
einer Anwendung mit Route („Detail-Panel", `#/quellen`).

**Aufträge an Daniel sind strukturiert und einen Klick vom Ziel entfernt:** nummeriert, je Punkt
ein geprüfter Link, der den Zustand schon trägt (Seite, Titel, Filter), dazu Vorher, Erwartet
und „falsch, wenn …" — nur wenn es live ist, sonst als 📅-Zeile mit Uhrzeit. Muster und Fälle:
Skill `selbst-testen-vor-der-bitte`, Abschnitt „Format eines Prüfauftrags".
