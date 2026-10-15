# Netflix „alle durchgehen“: warum Übersprungene und „Erinnern“-Titel wiederkommen

Stand 15.10.2026, nur gelesen (Erweiterung 4.31.0, Repo-Stand `edf445a07`). Keine D1, keine Netflix-Seite abgerufen. Meldungskopie (`data/cache/meldungskopie/`) liegt nicht vor und wurde nicht geholt; es wurden keine Daten daraus gebraucht.

## 1. Woher die Liste kommt und warum Titel wiederkehren

- **Quelle der Liste:** `extension/offene-netflix.js` (256 Titel, zuletzt am 14.10.2026 22:08 erzeugt von `tools/extension-offene-liste.mjs`; Zählung per Skript). Sie ist ins Paket gebacken, nicht im Netz. Ob ein Titel „fertig“ ist, entscheidet `fertig()` in `melder.js` (ab Zeile 2190) nach dem Worker-Stand (`standZieleNetflix`): fertig ist nur, wozu es eine **gemeldete** Antwort gibt.
- **Yu-Gi-Oh! (70177034) und Pokémon Sonne & Mond (80186475)** stehen mit `zustand: "erneut"` auf der Liste. Das ist die Wiedervorlage „einer Angabe widerspricht eine zweite Quelle“ (`extension-offene-liste.mjs` Zeile 115, `data/anisearch.json` führt Yu-Gi-Oh mit Netflix-Adresse). Sie verschwindet erst, wenn **nach** dem Prüfstand eine Meldung zu dieser Adresse eintrifft.
- **Der Durchgang meldet bei „Erinnern“ bewusst nichts** (`netflix-erinnern.js`, Beschluss 13.10.2026, `docs/wissen/erweiterung.md` Abschnitt „Durchgang: Erinnern …“). Er wartet 3 s, trägt den Titel in `selbstUebersprungen` ein und geht weiter. Ergebnis: nichts erreicht den Worker, der Titel bleibt offen.
- **Die Merkliste ist nur Arbeitsspeicher.** `selbstUebersprungen` ist eine `Map` in `melder.js` (Zeile 2511); `laufStarten()` leert sie bei jedem Klick auf „▶ alle durchgehen“ (Zeile 2473), ein Neuladen der Seite verliert sie ebenfalls (nur der Startzeitpunkt liegt in `sessionStorage`). Jeder neue Lauf geht also wieder an jedem Erinnern-Titel vorbei, und `naechsterAuftrag()` (Zeile 2815) findet sie wieder. Dasselbe gilt für „keine Folgenliste in 20 s“ und „nach N Versuchen noch offen“.
- **Unbelegt, aber wahrscheinlich:** Auch innerhalb eines Laufs kann ein Neuladen (z. B. nach Player) die Map verlieren; `selbstGezaehlt`/`selbstGrenze` werden dann ebenfalls neu gesetzt. Nicht gemessen.

## 2. Wird „nicht im Angebot“ / Glocke erkannt und gemeldet?

- **Erkannt:** ja, aber nur über Text: `keineFolgeVorhanden()` sucht „Erinnern“ oder „Remind me“ im ganzen `body.innerText` (Zeile 1096); `erscheinungsdatum()` liest „Ab 29. September“ (Zeile 1845). Kein Selektor oder Netzwerkbefund, laut Doku unbelegt; ob das Datum so auf Yu-Gi-Oh! steht, ist nicht gemessen.
- **Gemeldet:** nur per Hand. Der Knopf „Noch nicht da – ‚ab …‘ melden“ (`melden()`, Zeile 1207) schickt `vorhanden: nein`, `erscheint`, `notiz`. Der Worker hat **kein** Feld `erscheint` (kein Treffer in `worker/src`); das Datum steht nur im Freitext `notiz`, die Pipeline wertet es nicht aus. Der Befund heißt `weg` („nicht verfügbar“, `pruefung-ableiten.ts`) und kennt kein „noch nicht“. Danach wird nie neu geprüft, auch wenn der Titel erscheint.
- **Umleitung auf `/browse`** (Titel gar nicht bei Netflix): nur manueller Knopf (`browseWegKnopf`, Zeile 1617). Im Durchgang gibt es dafür keine Automatik; ob er dort nach einer Zeitgrenze weitergeht, habe ich nicht geprüft.
- **Verloren geht es also an zwei Stellen:** (a) der Durchgang merkt sich das Überspringen nicht dauerhaft, (b) das Datenmodell hat keinen Zustand „erscheint am …“.

## 3. Fix

**Untergrenze:** `selbstUebersprungen` samt Ablaufzeit in `chrome.storage.local` schreiben, beim Start lesen. Keine Worker-, keine D1-Änderung.

**Ansatz A (empfohlen): Zurückstellung lokal, mit Ablauf.**
- Neue Datei (z. B. `extension/netflix-zurueckgestellt.js`, `melder.js` liegt über der Zeilengrenze, `check:umfang` darf nur sinken). Schlüssel `netflixZurueckgestellt = { [Kennung]: { grund, bis } }`.
- Ablauf je Grund: Erinnern mit Datum → bis zu diesem Tag (Netflix nennt kein Jahr, es liegt immer voraus: nächstes Vorkommen); Erinnern ohne Datum → 7 Tage; „keine Folgenliste“ → 1 Tag; „nach N Versuchen offen“ → 1 Tag. Sieht die Seite wieder Folgen, wird der Eintrag gelöscht.
- Eingriffe: `akNetflixListeWarten`/`selbstUebersprungen.set` schreiben mit; `naechsterAuftrag()` überspringt Einträge mit `bis > jetzt`; Dialog zeigt „zurückgestellt bis 12.11.“ ausgegraut mit Rücknahme. Knopfzahl und Statusanzeige bleiben unverändert (sie müssen mit dem Worker übereinstimmen).
- Kosten: D1 0 Lesen/0 Schreiben, 0 Worker-Aufrufe; höchstens 256 Einträge. Aufwand grob 40 bis 60 Zeilen plus Test (Gegenprobe: Titel nach Ablauf wieder dran). Nachteil: gilt je Browser-Profil. Erfüllt die drei Erwartungen: Übersprungene kehren nicht wieder, Erinnern mit Datum wird bis dahin nicht angeboten, „nicht da“ fliegt für den Durchgang raus. Das Entfernen aus der Statusanzeige leistet es nicht.

**Ansatz B: im Worker/Datensatz.** Neuer Zustand „erscheint am“ (Spalte oder Feld in `titel_zeile`, Prüfstand blendet bis zum Datum aus, analog `wartet` in `tools/offen-erschienen.mjs`). Wirkt auf allen Geräten und in der Statusanzeige, kostet aber je Titel ein D1-Schreiben, Migration, Pipeline- und Prüfstandänderung, und der Durchgang müsste das automatisch melden. Das widerspricht dem Beschluss vom 13.10.2026, weil die „Erinnern“-Erkennung unbelegt ist und eine falsche Meldung im Datensatz stünde. Erst sinnvoll, wenn ein Mitschnitt einer Glocken-Seite ein sicheres Merkmal liefert.

**Empfehlung:** A jetzt; B später, wenn das Merkmal belegt ist.

## Offen
- Mitschnitt/Bericht einer echten Erinnern-Seite (Datumsformat, Selektor) fehlt; ohne ihn bleibt `erscheinungsdatum()` ungeprüft.
- Wie viele der 256 Titel Erinnern-Fälle sind, ist unbekannt (Meldungskopie fehlt; Netflix wird nicht abgerufen). Der Bericht des nächsten Durchgangs (`nfBericht().durchgang.uebersprungen`) nennt sie.
