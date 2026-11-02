---
name: patchnotes-autor
description: "Patch Notes („Neu auf der Webseite“) gegenlesen und für Besucher umschreiben; beim täglichen Fable-Lauf und jeder Arbeit an data/patchnotes/."
---

# Patch-Notes-Autor: die Stimme der Webseite

Du schreibst für Besucher von anime-kalender.de: Anime-Fans, die wissen wollen, **wann und wo** ihre Serie auf Deutsch läuft. Sie lesen die Patch Notes im Dialog „Neu auf der Webseite“ in Sekunden. Jeder Eintrag muss in einem Satz sagen, was sie jetzt sehen oder tun können, das vorher nicht ging.

Vorher lesen (Pflicht): Skills `kurze-texte-fuer-nutzer` und `menschlich-schreiben` (`~/.claude/skills/<name>/SKILL.md`). Diese Datei ergänzt sie, ersetzt sie nicht.

## Der tägliche Lauf (23:59)

1. `git fetch` im Hauptordner `C:/code/ai/anime-kalender-de`; Worktree `C:/code/_worktrees/anime-kalender-de/patchnotes-autor` (zentral, Regel 25.10.2026; der alte Pfad `C:/code/ai/_wtpatchnotes-autor` gilt nicht mehr) vom aktuellen `origin/main` (Zweig `text/patchnotes-JJJJ-MM-TT`).
2. `data/patchnotes/*.yaml` (eine Datei je Eintrag, seit 11.10.2026): alle Einträge der letzten 7 Tage lesen — Tag = Commit, der die Datei anlegte (`git log --diff-filter=A --format=%cs --name-only -- data/patchnotes`). Jeder sichtbare PR bringt seinen Eintrag selbst mit (Prüfkette erzwingt es seit 10.10.2026); du ergänzt nur, wenn `git log --since=<gestern 23:59> origin/main` einen sichtbaren Merge ohne Eintrag zeigt (Quelle: `gh pr view`). **„Patch Notes: keine – <Grund>“ ist kein Freibrief (Daniel 01.11.2026):** Jeden solchen Merge des Tages gegen seinen Diff halten; bringt er Besuchern etwas Sichtbares (neue Titel, Termine, Uhrzeiten, Belege, behobene Anzeige), schreibst du den Eintrag selbst. Nicht sichtbar sind nur Umbau, Tests, Werkzeuge, CI und Erweiterungs-Interna. Im PR je solchem Merge eine Zeile „ergänzt“ oder „zu Recht keine, weil …“ — am 31.10. blieben so 31 Merges ohne Eintrag, darunter neue ADN-Cartoons. Ist dein PR wegen eines roten main rot, steht das im PR-Text; der Dirigent mergt ihn nach dem grünen Bestandsbau.
2b. **Vorrat (seit 01.11.2026, `docs/wissen/betrieb.md` „vertagt hat einen Besitzer“):** `npx tsx pipeline/patchnotes-vorrat.ts liste`. Jeden Eintrag, dessen Wirkung in `public/data/` steht (Datei lesen, live gegenprüfen), mit `frei <name>` in den Hauptordner holen — sein Tag wird der Merge-Tag. Deckt ein bestehender Eintrag denselben PR schon ab, löschen statt freigeben (02.11.2026: Golden-Kamuy-Vorrat war seit dem 29.10. Eintrag). Sagt ein Merge des Tages „keine“, obwohl die Wirkung erst nach einem Lauf kommt, legst du den Vorrats-Entwurf selbst an (`wartetAuf`, `seit`, kein `datum`). Einträge über Erweiterung oder Worker (nur Daniel sieht sie) löschen — `VERBOTENE_WOERTER` in `shared/patchnotes.ts` nennt die Wörter; am 01.11. kamen zwei solche Einträge durch die Kette.
3. Jeden Eintrag nach den Regeln unten prüfen und umschreiben. Fakten nie ändern (Zahlen, Namen, Termine), nur Sprache, Gewichtung, Einordnung. **Format-Regeln der Datei (Check `check-patchnotes` wird sonst rot):** Text höchstens 8 Wörter, Details in `untertitel`; Kategorie nur `feature` oder `bugfix`; `highlight: true` höchstens 2 je Tag; kein Feld `live`. **Der Dateiname ist der Schlüssel fürs Datum:** Text umschreiben ändert den Tag nicht; eine Datei umbenennen oder neu anlegen schon — dann `datum: 'JJJJ-MM-TT'` mit dem bisherigen Tag setzen.
4. **Stempel setzen:** `data/patchnotes/_ueberarbeitet-bis.txt` auf den jüngsten Tag setzen, dessen Texte dieser PR umgeschrieben hat (eine Zeile JJJJ-MM-TT; auch wenn nichts zu ändern war, aber der Tag durchgesehen ist). Ohne den Stempel behält der Tag den Entwurfs-Stift. `npm run check:vor-commit` (Logdatei, vorher `tasklist`), PR eröffnen mit Titel „Patch Notes TT.MM.: Texte“ und in der Beschreibung je geändertem Eintrag vorher → nachher. **Nicht mergen.** Gibt es nichts zu verbessern, trotzdem einen PR, der nur den Stempel hebt (Titel „Patch Notes TT.MM.: durchgesehen“) — ohne PR bliebe der Tag für immer Entwurf (17.10.2026).
5. Bericht höchstens fünf Zeilen.

## Einordnung: welche Art?

| Art | Woran erkennbar | Beispiel |
|---|---|---|
| **Neu** (Feature) | Besucher kann etwas, das vorher nicht ging, oder sieht neue Information | „Im Detail-Panel stehen alle Teile einer Reihe jetzt als Karte – Staffel, Filme, Specials auf einen Blick.“ |
| **Verbessert** | Bekanntes geht schneller, klarer, vollständiger | „Die Monatsansicht am Handy lädt ohne Mini-Cover und zeigt Anbieter als farbige Punkte.“ |
| **Behoben** (Bugfix) | Etwas zeigte Falsches oder ging nicht, jetzt stimmt es | „Folgenzahlen stimmen wieder, wenn eine Serie bei mehreren Anbietern läuft (vorher z. B. „27 von 24“).“ |
| **Mehr Daten** | Neue oder korrigierte Termine, Belege, Titel – sichtbar im Kalender | „YAIBA: Samurai Legend läuft ab 05.11. als TV-Premiere auf ProSieben MAXX.“ |
| *nicht aufnehmen* | Unsichtbar für Besucher: Prüfketten, Pipeline-Umbau, Agenten, Erweiterung, Worker ohne sichtbare Wirkung | – |

Grenzfälle: Ein Umbau, der die Seite spürbar schneller macht, ist „Verbessert“ (mit gemessener Zahl). Ein Bugfix, den kaum jemand bemerkt hat, wird kurz oder entfällt. Ein Datenfix für einen einzelnen Titel nur, wenn er gerade läuft oder gefragt ist.

## Hervorheben

Pro Tag **höchstens zwei** Einträge als Höhepunkt (`highlight: true`): den, der am meisten Besuchern auffällt oder hilft. Neues Design, das man sofort sieht, schlägt einen Datenfix. Kein Superlativ („riesig“, „endlich“), der Inhalt hebt sich selbst hervor.

## Schreibregeln

- **Nutzen zuerst, Maßnahme nie:** „Du siehst jetzt …“, „Ab sofort …“, „… stimmt wieder“. Nicht: „Wir haben die Zählung umgebaut“, nicht „Fix für #688“.
- Text höchstens 8 Wörter (Kern des Nutzens), `untertitel` ein kurzer Satz mit Beispiel. Die Beispiele in der Tabelle oben zeigen den Inhalt, nicht die Länge — sie gehören auf Text + Untertitel verteilt. Konkretes Beispiel schlägt Abstraktion (ein Titel, eine Zahl, ein Ort auf der Seite).
- **Titel = `titleDe` aus `public/data/titles.json`, wörtlich** (nicht englisch/Romaji, nicht gekürzt); `pipeline/check-patchnotes-titel.ts` meldet abweichende Namen, nur in der PR-Kette, lokal meldet es „hier nicht“ (19.10.2026; Dateiname geprüft 20.10.2026).
- Die Arten der Tabelle (Neu/Verbessert/Behoben/Mehr Daten) sind Denkhilfe; in der Datei gibt es nur `feature` (Neu, Verbessert, Mehr Daten) und `bugfix` (Behoben).
- Wo es auf der Seite ist, wenn nicht offensichtlich: „im Detail-Panel“, „in der Wochenansicht“.
- Deutsch, Du-Form, keine Fachwörter aus dem Code (kein `franchiseId`, „Pille“ nur, wenn Besucher das Wort kennen – sonst „Anbieter-Knopf“). Ebenso „Abzeichen“, „Kachel-Bedingung“: Code- und PR-Wörter; den sichtbaren Wortlaut der Seite nehmen (PR 2477, 31.10.2026). Der Zähler trennt an Leerzeichen, „…“ und „Rock!:“ zählen je als Wort.
- Nichts versprechen, was nicht live ist; nichts behaupten ohne Beleg (Projektregel). Unsicheres („voraussichtlich“, „≈“) bleibt so gekennzeichnet.
- Keine Geberschuld („wir haben uns Mühe gegeben“), keine Entschuldigung, keine Ehrlichkeits-Floskeln.
- Gleiches bündeln: drei kleine Datenfixes desselben Tages = ein Eintrag.

## Selbstprüfung vor dem PR

Für jeden Eintrag: Würde ein Fan, der die Seite seit einer Woche nutzt, ihn verstehen, ohne die Seite zu öffnen? Weiß er, wo er hinschauen muss? Ist es wahr und schon live? Wenn eine Antwort nein ist: umschreiben oder streichen.

## Tooltip „heute“ (Daniel, 11.10.2026)

Jeder Tag nach dem Stempel `data/patchnotes/_ueberarbeitet-bis.txt` trägt im Dialog einen Stift mit Tooltip (Konstante `heuteHinweis` in `web/src/lib/patchnotes-texte.ts`): seine Einträge sind Entwürfe. Der Stift hängt am Stempel, nicht am Kalendertag (17.10.2026). Wortlaut am 13.10.2026 im ersten Lauf gekürzt; im täglichen Lauf nur noch mitlesen, ob er zu den Einträgen passt.

## Erfahrungen aus den Läufen

- 13.10.2026 (erster Lauf): 119 Einträge, davon 6 Doppelungen desselben Tags (Katalog-Links, ≈-Zeichen, Handlung, Folgen pro Woche, Reihen-Anfang, Anbieter-Pillen) zu je einem Eintrag gebündelt; Fakten für Beispiele aus `gh pr view <PR>` (Beleg-Tabellen nennen Titel). Der Tag eines Eintrags steht nicht in der Datei: `git log --diff-filter=A --format=%cs --name-only -- data/patchnotes` liefert ihn. Untertitel höchstens 10 Wörter (Check), das Wort „Pille“ ist Code-Jargon, auf der Seite heißt es nirgends so.
- 02.11.2026: Live-Dateien (`https://anime-kalender.de/data/<datei>.json`, Folgen unter `data/folgen/<live-id>.json`) tragen eigene `id`s; vergleichen über `titleDe` oder `al` (AniList-ID). Ein Eintrag gilt erst, wenn die Wirkung **live** steht: der Bestandsbau nach einem späten Merge (23:36) hatte den Stand von vor dem Merge gebaut, der nächste lief erst um 00:11. Titel ohne Synchro (`ohne-synchro.json`) zeigt die Seite mit `titleEn`, der Titel-Check kennt sie nicht — Anzeigenamen trotzdem nehmen.
