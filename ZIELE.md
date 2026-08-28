# Ziele des Projekts

Festgehalten am 28.08.2026 nach Daniels Auftrag. Diese Datei ist das Manifest:
Was hier steht, wird nicht vergessen, und jede Arbeit am Projekt lässt sich
daran messen. Sie wird fortgeschrieben, nicht neu geschrieben — was erreicht
ist, bekommt einen Haken und bleibt stehen.

## Hauptziel 1: Der Bestand ist vollständig und richtig

> „alle anime müssen wir im bestand haben, alle verweise auf deutsche synchros
> müssen korrekt verlinkt sein, alle anime müssen korrekt gekennzeichnet und
> episoden korrekt zugeordnet sein"

**Stand 28.08.2026, gemessen:**

| Kennzahl | Wert |
|---|---|
| Titel im Bestand | 2.762 |
| davon mit mindestens einem Verweis | 1.431 |
| davon ohne jeden Verweis | 1.331 |
| mit belegter deutscher Synchro | 1.278 |
| Verweise gesamt | 1.847 (Crunchyroll 637, Prime 533, Netflix 399, ADN 128, YouTube 72, RTL+ 40, Disney+ 36, Joyn 2) |

**Was dafür offen ist:**

- Folgen-genaue Zuordnung statt Staffel-Schätzung → `docs/prime-erfassung-neu.md`
- 1.331 Titel ohne Verweis: prüfen, ob es sie wirklich nirgends deutsch gibt
- Die 62 offenen Prime-Suchen und 30 Netflix-Titel der Prüfliste

## Hauptziel 2: Die Webseite bleibt aktuell

> „automatisches Erfassen von Informationen zu Neu-Ankündigungen … sobald
> offizielle Einträge angelegt wurden … Release-Termine der deutschen Synchro
> für kommende Episoden, Filme, Titel sind schnellstmöglich automatisch zu
> erfassen"

**Stand:** 889 Termine, davon 196 künftige bis Juni 2027. Fünf Cron-Läufe:
stündlich Sendezeiten, täglich 04:17 alle Quellen, alle sechs Stunden ADN,
montags 05:41 Tiefendurchlauf, monatlich Tonspuren.

**Was dafür offen ist:**

- Neue AniList-Einträge erscheinen bisher erst mit dem Tageslauf. Prüfen, ob ein
  kürzerer Takt für Ankündigungen sinnvoll ist.
- Deutsche Synchro-Termine kommen aus Handmeldungen und wenigen Quellen. Jede
  Handmeldung ist eine Übergangslösung — die automatische Quelle dahinter suchen.

## Hauptziel 3: Hohe Datenqualität, keine falschen Daten

> „Hohe Datenqualität ist oberstes Gut. Falsche Daten sind absolut zu vermeiden."

Das ist die Regel, an der alle anderen gemessen werden. Konkret:

- **Kein Urteil ohne Grundlage.** Eine Lücke im Wissen wird als Lücke geführt,
  nicht als Befund. (Ein Beispiel, das es fast in den Bestand geschafft hätte:
  „kein Deutsch" bei 15 von 39 gelesenen Folgen, 27.08.2026.)
- **Nur funktionierende Verweise auf der Seite.** Tote Links werden entfernt,
  nicht mit „✕" markiert.
- **Veralten ist ein Ereignis, kein Zustand.** Läuft eine Synchro-Lizenz aus,
  muss das auffallen und den Bestand ändern.

**Was dafür offen ist:**

- Automatische Erkennung ausgelaufener Lizenzen (siehe Hauptziel 4)
- Die Zusicherungen des Bestands laufen bei jedem Bau; ihre Abdeckung
  regelmäßig prüfen

## Hauptziel 4: Veralten wird bemerkt

> „Daten können über Zeit veralten, diese Information müssen wir automatisch
> mitbekommen und erfassen (Synchro-Lizenz ausgelaufen bei Anbieter → nicht mehr
> stream/kaufbar mit deutscher Synchro → update Bestand & Webseite)"

**Stand:** `pipeline/check-youtube.ts` prüft YouTube-Verweise gegen die Data API.
`data/link-check.json` führt einen Linkstatus. Für Prime, Netflix und Crunchyroll
gibt es keine laufende Prüfung; Änderungen fallen nur auf, wenn jemand hinsieht.

**Was dafür offen ist:**

- Ein wiederkehrender Lauf, der bestehende Verweise nachprüft, nicht nur neue
  sucht
- Ein Verfallsdatum je Verweis: Was länger als X nicht geprüft wurde, kommt in
  die Prüfliste

## Nebenziel A: Bessere automatische Informationsbeschaffung

Recherche nach Quellen, die heute von Hand ersetzt werden. Jede Handmeldung ist
ein Hinweis auf eine fehlende Automatik.

## Nebenziel B: Die Prüflisten-Erweiterung

Für jede Seite, wo Handarbeit nötig bleibt. Aktuell: Prime, Netflix, Disney+.
Offen: Crunchyroll, ADN, RTL+.

## Nebenziel C: Die Status-App

Zeigt Läufe und Prüfstand. Offen: Sie soll auch zeigen, was gerade veraltet.

## Querschnittsanforderungen

Diese gelten für jede Änderung, nicht für ein einzelnes Ziel:

- **Schlank und performant.** Was die Webseite lädt, enthält nur, was ein
  Besucher sieht. Rohdaten bleiben in der Datenbank und unter `data/`.
- **Keine Speicherlecks.** Besonders in der Erweiterung, die auf jeder Seite
  mitläuft. Ringpuffer werden gekappt, Messungen laufen einmal je Takt.
- **Bugs und Unschönheiten werden erkannt, nicht gemeldet.** Wo eine Prüfung
  möglich ist, läuft sie automatisch.
- **Wissen veraltet nie.** Was sich ändert, wird im selben Zug nachgeführt —
  hier, in `status.md`, in `CLAUDE.md`, in den Kommentaren.

## Fortschritt

### 28.08.2026 — Grundlagen für die Folgen-Zuordnung

Der Tag begann mit der Erkenntnis aus `docs/prime-erfassung-neu.md`: Die
Erweiterung entscheidet auf der Seite über Dinge, die dort nicht entscheidbar
sind. Gebaut wurde die Grundlage dafür, das an die richtige Stelle zu holen.

| Was | Wirkung |
|---|---|
| `pipeline/fetch-tmdb-folgen.ts` | 594 Titel, 23.522 Folgen mit Titel und Erstausstrahlung — der Anker, den AniList nicht liefert |
| `shared/folgen-zuordnung.ts` | Datum vor Titel vor Position; 254 von 300 Staffeln eindeutig, Haikyu vollständig über das Datum |
| `pipeline/vorschlaege-anbieter.ts` | 224 Titel ohne Verweis, für die TMDB einen Anbieter nennt → 158 neue Prime-Suchen |
| `pipeline/wiedervorlage.ts` | Belege veralten; Fristen je Anbieter, heute noch nichts fällig |
| `pipeline/check-qualitaet.ts` | Kennzahlen mit Verlauf, drei harte Punkte machen den Lauf rot |
| TMDB-Suche mit vier Schreibweisen | 1.247 Fehlschläge bekommen einen zweiten Versuch mit japanischem und deutschem Titel |
| TMDB als zweite Titelquelle | gegen die 194 Titel ohne deutschen Namen |
| `.github/workflows/daten-auf-abruf.yml` | einzelne Datenläufe ohne den ganzen Wochenlauf |

**Offen aus diesem Tag:** Schritt 2 und 4 des Umbauplans — der Worker braucht
eine Tabelle je Folge, und die Erweiterung muss die Liste schicken statt der
Zahl.

## Wie diese Datei benutzt wird

Vor jeder größeren Arbeit: Welchem Ziel dient sie? Steht das Ziel hier? Wenn
nicht, gehört es ergänzt oder die Arbeit unterlassen.

Nach jeder Arbeit: Hat sich eine Kennzahl geändert? Dann wird sie hier
nachgezogen, mit Datum.
