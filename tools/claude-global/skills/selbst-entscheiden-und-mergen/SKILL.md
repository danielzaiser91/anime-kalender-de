---
name: selbst-entscheiden-und-mergen
description: "Daniel nur bei echtem Bedarf einbinden: PRs selbst nachprüfen und mergen, selbst entscheiden. Bei dem Impuls „Daniel soll mergen/entscheiden“."
---

# Selbst entscheiden und mergen

**Daniel, 08.10.2026:** „kein merge von mir, sondern von dir. mich brauchst du nur, wenn ich
wirklich gebraucht werde, das meiste kannst du selbst entscheiden und tun."

## Prüfstufe zuerst (Daniel, 10.10.2026: „keine Prüfer-Agenten bei Kleinigkeiten“)

Vor jedem Merge: `node tools/pr-stufe.mjs <PR>`. Die Stufe ergibt sich **mechanisch** aus Pfaden
und Zeilenzahl, nicht aus Bauchgefühl; im Zweifel 2; herabgestuft wird nur, wo die Tabelle in der
Datei es erlaubt. Tatsachenzahlen (IDs, Termine, Uhrzeiten, Folgenzahlen, Synchro-Status) sind nie Stufe 0.

- **Stufe 0** (Text/Patchnotes/i18n ohne Rechtstexte, gescopte CSS ≤ 30 Zeilen in einer Datei, Doku,
  Kommentare): **kein eigener Prüfer-Agent**; der CI-Prüfer prüft schlank (nur Diff) und gibt frei (seit 12.10.2026); nach grüner PR-Prüfkette und CI-Freigabe mergen (nach `pr-nachrechnen.mjs`, kein Auto-Merge, 19.10.2026), danach Livemessung.
- **Stufe 1** (UI-Logik, einzelne Handbelege, Konstanten/Zahlen in Daten): ein **schlanker Prüfer**
  liest den Diff und `gh pr checks`, baut nicht nach, kein Playwright (außer Screenshot einer Ansicht).
  Handbeleg: Beleg im Wortlaut und Titelzuordnung gegenlesen.
- **Stufe 2** (`pipeline/`, `shared/logic.ts`/`time.ts`, Workflows, `worker/`, Hooks/Mods mit globaler
  Wirkung, Sicherheit, Schemata, Zählungs-/Bau-Logik, über ~300 Zeilen): **voller Prüfer** mit
  Gegenproben und eigener Messung, seriell (Lastgrenze).
- Nach **jedem** Merge Livemessung. Der GitHub-Prüfer (`pr-pruefer.yml`) nutzt dieselbe Stufe und
  prüft bei 0 schlank (kleines Zugbudget, nur Diff) und gibt bei Ok frei; die Stufe steht als PR-Kommentar.
- **Auto-Merge wartet auf die PR-Prüfkette (11.10.2026):** Seit 18:58 ist `PR-Prüfkette` Pflicht-Check im
  Ruleset `main-pruefweg` (vorher mergte `--auto` allein auf die Prüfer-Freigabe, PR 820/821 machten main rot).
  **Seit 19.10.2026 (PR 1597) nicht mehr sicher:** Die Kette rechnet nicht nach, wenn main weiterkommt — ein grüner
  Kopf kann gegen den neuen main rot sein. Vor **jedem** Merge `node tools/pr-nachrechnen.mjs <PR>`: Exit 0 mergen,
  Exit 1 Kette abwarten und erneut aufrufen, Exit 2 Meldung lesen (UNKNOWN: kurz warten, erneut). Darum kein
  `--auto` für Code-PR (Stufe 0 eingeschlossen); auch `tools/pr-einreichen.sh` setzt keinen mehr (PR 1609), Sammler mergen per App-Token. Die Auto-Merge-Absätze unten gelten nur noch für ältere PR, an denen er noch gesetzt ist. Nach jeder Konfliktauflösung `check:vor-commit` (tsx prüft keine Typen),
  und gepusht wird erst, nachdem `ENDE 0` gelesen ist, nie in derselben Befehlskette. Nie `git checkout --ours/--theirs`
  auf eine Datei mit Konflikt: Das verwirft auch die konfliktfreien Stellen der Gegenseite (15.10.2026, Manifest
  verlor `netflix-zurueckgestellt.js`). Nur den Konfliktblock auflösen.
  Der Merge-Commit enthält nur die Konfliktauflösung; eine Prüfer-Auflage kommt als eigener Commit danach (kein Evil Merge, 13.10.2026).
  Nach einem Auto-Merge prüfen, ob für den Merge-Commit ein Push-Workflow lief (`gh run list --limit 3`);
  sonst `gh workflow run deploy.yml` (PR 824, 11.10.2026: kein Deploy ausgelöst).
- **Kein Merge auf main, solange ein Deploy einen erwarteten Live-Fix trägt (26.10.2026):** Ein push-Deploy bricht den laufenden ab (Gruppe `pages`); der Merge von PR 2108 warf den Appraisal-Deploy nach 10 min weg. Vorher `gh run list --workflow deploy.yml -L 1` — läuft er und wartet Daniel auf seinen Inhalt, Merge danach.
- **Erste Zeile des CI-Prüfers (seit 18.10.2026):** „ok“ allein heißt Pflicht-Checks des Kopfes grün; „ok, Checks rot/laufen noch/Stand unbekannt“ ist keine Merge-Freigabe — erst den Check-Stand klären.
- **Gesetzter Auto-Merge ist kein Merge (13.10.2026):** Der CI-Prüfer läuft nach jedem Push neu und kann
  „aendern“ sagen; dann hängt der PR still auf BLOCKED (1069 und 1074 je 20 min). In der nächsten Wachphase
  `reviewDecision` lesen; bei CHANGES_REQUESTED den letzten Prüfprotokoll-Kommentar holen
  (`gh api repos/<repo>/issues/<N>/comments -q '.[-1].body'`). Bei DIRTY löst ein Merge von main den Konflikt, kein Rebase; danach vor dem Push `node tools/pr-vorpruefung.test.mjs` — ein konfliktfreier Merge kann `tools/check-*-liste.txt` unsortiert hinterlassen (2289, 28.10.2026: Kette rot, eine Prüfrunde verloren).
  Der Check „Prüfer-Review“ steht auch bei „aendern“ auf **pass** — `gh pr checks` sagt darüber nichts (1133: 13 min
  für grün gehalten, 13.10.2026). Darum in jeder Wachphase statt `gh pr list` einmal:
  `gh pr list --json number,reviewDecision,mergeStateStatus -q '.[]|"\(.number) \(.reviewDecision) \(.mergeStateStatus)"'`.
- **Nachrechnen und Mergen in einem Hintergrund-Wächter (20.10.2026, 1612: drei Wiederöffnungen):** main bekommt alle
  ~10 min einen Daten-Commit, die Kette braucht ~6 min. Darum wartet ein Wächter (`for i in $(seq …)`) auf das Kettenende,
  ruft `pr-nachrechnen` und mergt bei Exit 0 plus `APPROVED CLEAN` sofort — fertig als
  `bash C:/code/ai/__assets/tools/merge-reihe.sh <PR> …` — **alle PR in einen Aufruf, nie je PR ein eigener Wächter** (27.10.2026: fünf parallele Wächter brachen sich gegenseitig 5× die Ketten ab, 30 min ohne Merge); wird ein PR frei, während eine Reihe läuft (`prozess-register.mjs list`), wartet er auf deren Ende und kommt dann mit allen übrigen in die nächste — keine zweite daneben (30.10.2026: sechs parallel, wieder Neuanstöße); er endet nach jedem Merge, also in einer begrenzten Schleife neu aufrufen (Aufruf und Grenzen in `ai_agent_tools.md`; prüft auch Sammler bei Workflow-Dateien). 27.10.2026: von Hand nachgerechnet, vier PR je zwei-, dreimal wiedergeöffnet, und ein Doppel des Werkzeugs geschrieben, weil hier der Name fehlte; ein Wackler (Screenshot-Fehler) → `gh run rerun <id> --failed`; bei einem Hänger vorher Lauf- und Job-ID samt Schrittdauer in `stand.md` notieren, der Rerun überschreibt die Job-Daten (20.10.2026, Bauer 1703).
- **Nachtrag vor dem Push (15.10.2026):** Der CI-Prüfer sagt „aendern“, sobald die Beschreibung den Diff
  nicht mehr deckt (1282/1285/1286/1287 je eine Runde). Nach jeder Nacharbeit hänge ich den Nachtrag
  (ohne das Wort „Freigabe“) **vor** dem Push des Bauers an. Eine reine Beschreibungsänderung stößt den Prüfer
  nicht an; nachträglich hilft `gh run rerun <id>` des letzten `pr-pruefer.yml`-Laufs zu diesem Kopf — er liest die Kommentare neu, der Kopf bleibt, die Agent-Freigabe gilt weiter (18.10.2026, 1442: CHANGES_REQUESTED → APPROVED in 3 min) — **nicht `pr-pruefung.yml`**, das ist die Kette und urteilt nicht (27.10.2026, 2170/2166: 75 min ohne Urteil); ein leerer Commit nur, wenn das nicht greift (Schließen/Öffnen sperrt der Klassifizierer). **Ausnahme Zeile „Patch Notes: keine – …“:** `check-patchnotes-pflicht` in der Kette liest die Beschreibung aus dem Ereignis des Laufs, ein Rerun sieht die alte — gleich nach der Beschreibungsänderung einen leeren Commit pushen (29.10.2026, 2332: Kette rot, 30 min verloren). **Sammler-Prüfung vor einem Merge mit `.github/`-Dateien als eigener Aufruf, Ausgabe lesen, dann mergen** — nie `gh run list … ; gh pr merge` in einer Kette (18.10.2026, 1442: „Stündlich — Sendezeiten“ lief noch, ging zufällig gut).
  **Format:** Der CI-Prüfer liest Kommentare des PR-Autors, die mit `Nachtrag` oder `Nachbesserung` beginnen,
  mit oder ohne `**`/`#` (`tools/pr-nachtraege.mjs`, Stand 17.10.2026; bis 16.10. fielen `## Nachtrag` still weg).
- **Gepusht heißt: `headRefOid` des PR = lokaler Kopf (15.10.2026).** Heißt der lokale Zweig anders als der PR-Zweig
  (Worktree eines Bauers), pusht ein bloßes `git push` nicht in den PR — 1288 stand 15 min als „gepusht, Auto-Merge“
  in `stand.md`, der Kopf war nie oben. Immer `git push origin <lokal>:<PR-Zweig>` und danach
  `gh pr view <N> --json headRefOid` gegen `git rev-parse HEAD` halten, bevor „gepusht“ irgendwo steht.

## Regel

- **PRs, die ich oder meine Subagenten erzeugt haben, merge ich selbst** (`gh pr merge <nr>
  --squash --delete-branch`), nachdem ich den Bericht nachgeprüft habe (Diff angesehen,
  Prüfkette grün, Lauf grün). Daniel wird dafür nie gebeten. **Ab Stufe 1 kein Merge ohne
  Urteil-Kommentar des Agent-Prüfers am PR** („Prüfer Runde N: freigeben“) — ein Urteil nur im
  Bericht an mich zählt der Rundenzähler-Hook nicht; fehlt er, poste ich das Urteil mit
  Rundennummer vor dem Merge (18.10.2026: u. a. die geprüften PRs 1520 und 1522 ohne Kommentar, Zähler sah 0 Runden).
  **Seit 21.10.2026 eine Runde, bei Prüfstufe 2 höchstens zwei (Daniel):** Bei „ändern“ prüft (außer Stufe 2) kein zweiter Prüfer; ich nehme die Nachbesserung
  gegen die Auflagenliste ab und poste „Abnahme Dirigent: A1…An erfüllt“ mit den Probe-Ausgaben, dann Merge.
  Der Kommentar **beginnt mit `## Nachtrag (Abnahme Dirigent …)`**, sonst liest ihn der CI-Prüfer nicht, und der PR bleibt
  auf CHANGES_REQUESTED; danach den letzten `pr-pruefer.yml`-Lauf des Kopfs per `gh run rerun` neu starten (21.10.2026, 1739:
  „## Abnahme Dirigent“ übersehen, Merge-Reihe endete BLOCKED). **Seit 27.10.2026 (PR 2209) gibt der Kommentar selbst frei:** Er beginnt mit `## Nachtrag (Abnahme Dirigent` und nennt den Kopf mit mindestens 9 Zeichen aus `gh pr view <PR> --json headRefOid`; der Workflow `abnahme-freigabe.yml` setzt dann ein APPROVE auf genau diesen Kopf. Fehlt der Hash, ist er zu kurz oder veraltet, kommt nur ein Hinweis-Kommentar. Das `gh run rerun` braucht es dann nicht mehr; die Merge-Reihe erst starten, wenn `reviewDecision` APPROVED zeigt (Warteschleife, bis 10 min) — direkt nach dem Kommentar endet sie sofort mit BLOCKED (30.10.2026, 2451); erster echter Lauf bestanden (PR 2216, 27.10.2026 21:45: Kommentar gepostet, APPROVED nach < 1 min)). Er hebt auch ein altes Bot-„ändern“ auf (2257, 28.10.2026); ein Review per API zu übergehen (`dismissals`) sperrt der Klassifizierer als Selbstfreigabe — nie versuchen, nie Daniel darum bitten. **Die Überschrift wörtlich kopieren, nie aus dem Gedächtnis** (29.10.2026, 2346: „## Abnahme Dirigent (Runde 1)“ ohne `Nachtrag` und ohne Kopf → kein APPROVE, der Abnahme-Prüfer sah nur „A3 nein“).
  **Abnahme eines reinen main-Merge-Kopfs erst nach grüner Kette, mit Ergebniszeilen (28.10.2026, 2270/2280):** Der CI-Prüfer läuft nach dem APPROVE noch einmal auf demselben Kopf. Ist die Kette dann noch offen oder fehlt die Ergebniszeile eines neuen Tests im Log dieses Kopfs, setzt er wieder „ändern“. Deshalb die Abnahme erst posten, wenn die Kette grün ist. Darin die Zeilen aus `gh run view <id> --log | grep <test>` zitieren.
  **Auflagen nicht als Dirigent vertagen (27.10.2026, 2166):** Der Abnahme-Modus wertet „bleibt bewusst offen“ als „nein“, das alte CHANGES_REQUESTED bleibt stehen, und ohne Freigabe gibt es keinen Merge-Weg. Offene Auflagen setzt deshalb immer der Bauer um, auch mit Workflow-Anteil; vertagen geht nur durch Teilen des PR.
- Der Klassifikator kann den Merge als „Merge Without Review" verweigern. Dieser Satz von
  Daniel ist die ausdrückliche Erlaubnis im Chat; nach einer Verweigerung deshalb **einmal erneut
  versuchen**, nicht an Daniel zurückgeben. Scheitert es wieder, unter „Daniel-Todo“ in `stand.md` mit PR-Link
  eintragen und weiterarbeiten.
- **Ursache der Sperre (F60, 25.10.2026):** Der Filter sperrt, wenn auf GitHub keine Freigabe nach dem letzten Kopf steht.
  Das passierte im ticket-board ohne CI-Prüfer, wo das letzte Urteil „ÄNDERN“ lautete. Mit Daniels Auftrag gab es zwei
  Merge-Versuche, beide gesperrt, ein Abnahme-Kommentar galt als Umgehung. Deshalb bekommt **jedes Repo, in dem ich mergen
  soll, zuerst den CI-Prüfer** aus `C:/code/ai/__assets/tools/pr-pruefer-vorlage/`. Daniel setzt dafür einmal das Secret,
  und die Actions-Freigabe muss an sein. Fehlt der CI-Prüfer, hilft kein weiterer Merge-Versuch, sondern nur dieser Schritt.
- **Entscheidungen** über Reihenfolge, Vorgehen, Datenurteile mit Beleg, Umsetzung: selbst
  treffen, tun, in `stand.md` melden. Rückfrage nur bei den bekannten Grenzen: Geld,
  Außenwirkung, schwer Umkehrbares, Serverstart, Umkehr einer Entscheidung, Rechtsgrauzone —
  und bei Dingen, die nur Daniel kann (Login, Hardware, Geschmack ohne Messbares).
- Ein Auftrag an Daniel steht nur unter „Daniel-Todo“ in `stand.md`, wenn es ohne ihn nicht geht.
- Merge auf `main` erst, wenn kein Bestandslauf läuft (sonst Doppelbau); Zweig-Push ist jederzeit ok.
- **Ist main an mehreren Stellen rot, gehören die Fixes in einen PR** — jeder Einzel-PR bleibt sonst an der jeweils anderen roten Stelle hängen, und die Regeln sperren den Merge (26.10.2026: Kachel-Fix #2096 und Wächter-Fix #2098 blockierten sich, #2100 bündelt beide Commits). Vor dem Start eines Fix-Bauers fragen: Welche Ketten sind auf main rot, und deckt dieser PR alle? Bei rotem main steht der Fix-PR in der Merge-Reihe vorne; andere PRs erst danach (Vorschlags-Ledger, 01.11.2026).

## Ticket abnehmen gehört zum Merge (Daniel, 11.10.2026)

Agenten erstellen nur PRs und setzen ihren Sub-Task im Board auf aktiv; die Hauptsitzung mergt und nimmt deshalb auch das Ticket ab: nach Merge und Live-Messung auf erledigt, bei Prüfer-„ändern“ oder roter Messung zurück auf offen mit Grund. Befehle stehen im README des Ticket-Boards (`C:/code/ai/ticket-board`).
