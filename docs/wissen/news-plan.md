# News: jede Meldung ist eine Aussage zu ihrem Tag, mit eigenem Beleg (Plan vom 02.10.2026)

Anlass: Hana-Kimi Staffel 2 (Daniel, 02.10.2026). Folge 9 kam am 09.09., die Folgen 10–12 kamen
gemeinsam am 02.10. — erwartet am 16.09., 23.09. und 30.09. Das Panel zeigte zwei Einträge
„Nicht erschienen", deren Text inzwischen „kam mit Verspätung am 02.10." lautete, an den falschen
Tagen und Folgen, beide mit denselben zwei Quellen; dazu „11 von 13 erschienen" statt 12.

## Grundsätze

1. **Eine Meldung ist eine Aussage zu ihrem Tag und wird nicht umgeschrieben.** Was später
   passiert, ist eine neue Meldung (die Kette „ersetzt durch" bleibt für Termine).
2. **Eine Quelle, eine Meldung.** Jede Meldung trägt die Belege genau ihrer Aussage — nicht die
   gesammelten Quellen des Release.
3. **Eine Messung ist ein eigener Beleg.** „Nicht erschienen" und „verspätet erschienen" sind
   unsere Beobachtung; ihr Beleg ist die Stelle, an der man es nachsehen kann (Crunchyrolls
   Simulcast-Kalender **an diesem Tag**, `?filter=premium&date=<Tag>`), dazu unser
   privates Bild davon (Beleg-Lesung).
4. **Der Tooltip nennt, was zur Aussage gehört:** bei einem Artikel das Veröffentlichungs- bzw.
   Aktualisierungsdatum, bei einer Messung den Tag der Messung — nicht, wann wir etwas gelesen haben.

## Ursachen und Schritte

| # | Ursache | Schritt |
|---|---|---|
| 1 | Ein verpasster Termin bekam die Nummer der Folge, die der umgeplante Kalender dort zeigte. Am 30.09. war das wieder Folge 10 (statt 12); je Folge gilt der jüngste Vermerk, also stand Folge 10 als „erwartet 30.09." da, Folge 12 fehlte. | Nummer nach Takt: letzte beobachtete Folge + Wochen seither (`folgeNachTakt`). Datenkorrektur für Hana-Kimi, Zusicherung. |
| 2 | Die Verspätungsmeldung schrieb ihren Satz um, sobald die Folge kam. | `verspaetet` bleibt „war für den … angekündigt und ist nicht erschienen". Neue Art `nachgereicht`: je Release und Tag **gebündelt** („Folgen 10–12 verspätet erschienen"), datiert am Tag des Erscheinens. |
| 3 | Beide Meldungsarten hängten `belegeVonRelease()` an — dieselben Quellen an jedem Eintrag. | Beleg = Messung: Crunchyroll-Kalender an diesem Tag, „nachgesehen am …". |
| 4 | Der Tooltip zeigte „gelesen am 01.10." | Artikel: „veröffentlicht am …" (aus `data/beleg-lesungen.json`); Messung: „gemessen am …". |
| 5 | Die Messungsbelege haben kein Bild. | Die Kalenderwochen der Meldungen kommen in die Warteschlange der Beleg-Lesung (Bild + HTML.gz, privat). Wirkt erst nach dem Worker-Deploy. |
| 6 | Die Ankündigung nennt den **heutigen** Termin des Release (15.07.), datiert ihn auf diesen Tag und hängt alle Quellen an; die Quelle selbst (aniSearch, 29.06.) sagte „ab 01.07., auch als Simuldub". | Später, eigener Schritt: je Quelle eine Ankündigung, datiert am Veröffentlichungstag (Beleg-Lesung), Text aus dem, was die Quelle sagt. Braucht verlässliches `sagt` je Quelle und berührt das News-Gedächtnis (`ersetzt`-Ketten) — erst messen, dann umbauen. |

## Stand (02.10.2026)

- 1–4 gebaut: `folgeAmVerpasstenTermin()` (`pipeline/lib/ausgeblieben.ts`), `nachgereichteFolgen()`
  (`bau/verpasst-am-termin.ts`), `verspaetungsMeldungen()`/`ohneDoppelteFolgen()`
  (`pipeline/lib/news-verspaetung.ts`), `mitArtikeldaten()` (`pipeline/lib/beleg-lesung.ts`),
  Tooltip in `web/src/components/news-belege.tsx`. Zusicherungen in `check:logic`
  („Folge am verpassten Termin", „Verspätete Folgen in den News").
- **Link je Tag statt je Woche:** Crunchyroll nimmt jeden Tag als `date` an und zeigt dessen Woche
  (gemessen 02.10.2026: `date=2026-09-30` → 28.09.–04.10.). Am 30.09. führte die Seite Hana-Kimi
  Folge 12 auf Französisch, Spanisch, Portugiesisch und Englisch (13), ohne Deutsch — genau der
  Beleg. Der Tageslink hält zwei Meldungen derselben Woche auseinander (eine Quelle, eine Meldung).
- 5: `pipeline/messbelege.ts` (stündlich hinter `termine-pruefen.ts`) — je Vermerk ein Bild des
  Kalendertags beim Bemerken und beim Nachreichen; braucht den Worker-Deploy.
- 6 offen: wartet auf die ersten Beleg-Lesungen (`data/beleg-lesungen.json`, täglicher Lauf).

## Fälle, die das abdecken muss

- Eine Folge fällt aus und kommt eine Woche später allein → `verspaetet` am erwarteten Tag,
  `nachgereicht` „Folge N" am Tag des Erscheinens.
- Mehrere fallen aus und kommen gesammelt (Hana-Kimi, Mushoku Tensei 6–8) → je Ausfall ein
  `verspaetet`, **ein** `nachgereicht` „Folgen 10–12".
- Eine Folge fällt aus und kommt nie → nur `verspaetet`; die Recherche (`neuErwartet`) bleibt
  Vermerk am Termin, keine Meldung über eine Vermutung.
- Der Prüflauf irrt sich (Folge kam am selben Tag) → kein Verzug, Vermerk wird gestrichen (wie bisher).
- Andere Plattformen ohne Kalender → keine Messung, keine Verspätungsmeldung (wie bisher).

## Entscheidungen vom 03.10.2026 (Daniel)

- **Ein späterer Beleg ist legitim und wird nicht ausgeblendet.** Er bestätigt die Behauptung und ist ein Aktualisierungsbeleg. Künftig entsteht der Beleg (Bild + Text) **zeitgleich** mit der Meldung und wird gemeinsam veröffentlicht; ältere Meldungen behalten ihre Quellen, auch wenn eine erst später erschien (Beelzebub 25.07./26.07.).
- **Überholte Meldungen stehen im selben Eintrag, neuester Stand zuerst** (Entwurf B, „Verlauf", `daniel-zum-abarbeiten/news-ueberholt-mockups.html`): oben die geltende Aussage mit ihren Belegen, darunter gedämpft und durchgestrichen die überholten Stände mit „überholt am …" und ihrem eigenen Beleg. Der Beleg des Alten bleibt.
- **Daten einer Quelle tragen ihre Bedeutung als Attribut.** Eine Disc-Produktseite kennt mehrere Daten: seit wann die Disc kaufbar ist, seit wann es die deutsche Synchro gibt, das Original-Erscheinen, und seit wann die Seite existiert (Amazon lässt Händler Produktseiten ersetzen — Kommentare von 2020 unter einem Artikel von Dezember 2026). Gelesen wird deshalb nur, was die Seite eindeutig nennt: bei aniSearch-Produktseiten `ausgabe` (Erscheinungstag der Ausgabe), im Tooltip „Produktseite, Ausgabe erscheint am …".
- **Jeder Hash-Wechsel ohne Datumswechsel ist eine Anomalie** (`tools/belege-pruefen.mjs` wird rot, Feld `aenderungOhneDatum`), kein Schwellenwert.
- **Frische Artikel werden täglich gelesen** (erste drei Tage), ältere alle sieben.
- **Jede neue Domain steht erst auf der Prüfliste** (`data/beleg-domains.json`): von Hand prüfen, ob eine Zustimmungswand den Artikel verdeckt, Fix in `beleg-bild.ts`, erst dann lesen. Der Wachhund wird rot bei gelesener, aber ungeprüfter Domain.
- **Gelesen wird, solange ein Termin offen ist** (Daniel, 03.10.2026): Ein Artikel, dessen Termine alle erreicht sind (Status `abgeschlossen`), wird nicht mehr gelesen — einmal aber immer, damit sein Beleg existiert (`adressenMitOffenemTermin`).
