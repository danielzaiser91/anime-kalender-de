# TODO

## Quellenlage — Stand 08.08.2026

Ziel war: nicht nur Crunchyroll maschinell, sondern jede legale deutsche
Bezugsquelle, und der Datenbestand mindestens täglich aktuell. Was daraus
geworden ist:

**Maschinell, mit belegter Uhrzeit und belegter Synchro:**

| Quelle | Liefert | Wie |
|---|---|---|
| Crunchyroll-Simulcastkalender | Uhrzeit, Folgennummer, „(Deutsch)"-Kennzeichnung | Playwright, stündlich |
| ADN | Datum, Uhrzeit **und Sprachcode** (`vde` = Synchro, `vostde` = nur UT) | öffentliche JSON-Schnittstelle, täglich |

ADN ist der wertvollere Fund: Die Schnittstelle sagt je Folge selbst, ob eine
deutsche Synchro existiert. Da muss nichts abgeleitet werden.

**Maschinell, aber nur als Vorschlag:**

| Quelle | Liefert | Wie |
|---|---|---|
| Anime2You (drei Nachrichten-Feeds) | Ankündigungen zu Netflix, Disney+, Prime, Aniverse, WOW, Joyn, RTL+, Kino, Disc | RSS, täglich → `data/proposals/` |

Warum nur Vorschlag: Der Text einer Meldung ist kein Datensatz. „Ab dem 4.
September" kann sich auf den Titel in der Überschrift beziehen oder auf einen,
der im dritten Absatz erwähnt wird. Maschinell ist das nicht sicher zu
trennen. Der Wochenlauf schreibt deshalb eine Liste „was ist gemeldet, steht
aber noch nicht im Datensatz" in seine Zusammenfassung — `npm run data:report`
erzeugt sie auch lokal.

**Weiterhin Handarbeit, und das bleibt vermutlich so:**

Netflix, Disney+ und Prime Video veröffentlichen keinen Kalender, nennen keine
Uhrzeiten und weisen die Sprachfassung nicht maschinenlesbar aus. Die
JustWatch-GraphQL-Schnittstelle wäre eine Möglichkeit, ist aber inoffiziell und
in den Nutzungsbedingungen ein Graubereich — bewusst nicht angebunden.
aniverse.de ist von hier aus nicht erreichbar (TLS-Handshake bricht ab).

## Polling

Drei Workflows statt eines Nachtlaufs, alle mit `concurrency: daten`, damit sie
sich nicht gegenseitig ins Repo schreiben:

- **stündlich** (`refresh-hourly.yml`) — Crunchyroll, drei Wochen Fenster
- **täglich** (`refresh-data.yml`) — alle Quellen, danach `data:check`
- **wöchentlich** (`refresh-weekly.yml`) — weite Fenster (CR zwölf Wochen, ADN
  ein halbes Jahr), Kuratierungsbericht

Committet wird nur bei echter Änderung.

`pipeline/check-sources.ts` ist der Wachhund gegen den lautlosesten Fehler
dieses Projekts: Ein Scraper läuft weiter durch, findet aber nichts mehr, weil
die Gegenseite ihre Seite umgebaut hat. Schweigt eine Quelle länger als vier
Tage, wird der Lauf rot — und GitHub schickt die Mail.

## Offene Kästchen

- [ ] Kuratierungsbericht regelmäßig abarbeiten — die Liste aus
      `npm run data:report` in `data/curated/` übertragen. Das ist die
      wiederkehrende Pflegearbeit, die kein Skript abnehmen kann.
- [ ] Tracking-Absatz aus der Datenschutzerklärung entfernen, sobald der erste
      Versand über `kalender@send.anime-kalender.de` bestätigt ist — auf der
      eigenen Domain ist Öffnungs- und Klick-Erfassung abgeschaltet, der Absatz
      beschreibt dann etwas, das nicht mehr passiert.

## Erledigt

- [x] Impressum und Datenschutzerklärung ausformulieren
- [x] Uhrzeiten der laufenden Crunchyroll-Simuldubs belegen
- [x] Newsletter-Worker deployen
- [x] Eigene Domain und Absenderdomain einrichten
- [x] Projekt ins Portfolio eintragen
- [x] ADN als zweite maschinelle Quelle anbinden
- [x] Anime2You als Vorschlagsquelle anbinden
- [x] Polling-Kaskade stündlich/täglich/wöchentlich
- [x] Wachhund gegen stumm gewordene Quellen
