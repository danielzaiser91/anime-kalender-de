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
  Kalendertags beim Bemerken und beim Nachreichen; braucht den Worker-Deploy. Seit 15.10.2026 kommt bei „nicht erschienen“ ein zweiter Beleg
  dazu: das Wochenprogramm als Bild mit markierter Zeile (Abschnitt „Beleg ‚angekündigt‘“ unten).
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

## Rückwirkend eingetragen (Daniel, 04.10.2026, Tokyo Revengers Staffel 3)

Folge 1 erschien am 02.10. bei Disney+, kam aber erst am 04.10. in den Kalender (Anime2Yous Disney+-Sammelartikel wurde nicht als Start erkannt). Eine Ankündigung „Start am 02.10." an einem Tag, den wir nicht kannten, wäre ein falscher Tag; deshalb die Art `nachgetragen`: datiert am Tag des Eintragens, Satz „Folge N erschien am … bei … mit deutscher Synchro", der Rest hinter „mehr" (Entwurf G: Weiterlaufen, Grund, Abhilfe). Auslöser ist das Handfeld `nachtrag` am kuratierten Release; „Neu auf Deutsch" desselben Titels entfällt, die frühere Ankündigung derselben Linie gilt nicht als zurückgezogen (`news-verlauf.ts`). Noch nicht automatisch: ein Release, das mit lange zurückliegendem Termin neu auftaucht, bräuchte die Erkennung am ersten Auftauchen (offen). „Samstag 19 Uhr" folgt Anime2You ausdrücklich (Daniel: wir vertrauen und prüfen selbst); stimmt es nicht, berichtigt eine neue Meldung mit unserem Beleg.

## Angekündigte Simulcasts ohne Starttag (Daniel, 10.10.2026, PSYREN)

Das Panel sagte „Deutsche Synchro angekündigt", unter „Neuigkeiten" fehlte die Meldung: `omuMeldungen()` übersprang jeden Eintrag aus `data/ankuendigungen.yaml`, dessen `omuAb` nur den Monat nennt („2026-10"). Die Aussage „Synchro angekündigt" hat aber ihren Beleg (Crunchyroll-Artikel vom 15.09.) und ihren Tag, auch wo der Starttag fehlt. Jetzt entsteht die Meldung am Tag der Quelle; der Satz sagt „Start im Oktober 2026 bei Crunchyroll mit Untertiteln, deutsche Synchro angekündigt" (`omuStartText()`, `shared/ankuendigung.ts`), das Panel zeigt sie bis zum Monatsende. Gemessen 10.10.2026: von 48 Einträgen war genau einer betroffen (PSYREN); Overgeared fehlt zu Recht, dort gibt es schon ein Release mit eigener Meldung.

## Folgenrhythmus als eigene Meldung (Daniel, 12.10.2026, Avatar: Die sieben Häfen)

Daniel: „es fehlt der Beleg und die News bezüglich des 3–4-Episoden-pro-Woche-Rhythmus, das hab ich auf Anime2You gelesen.“ Der Artikel (1059483, 10.10.) war schon in `sources`, stand aber in keiner Meldung: Die Start-Meldung (09.10.) behält je Aussage und Anbieter nur den stärksten Beleg (`beleg-anbieter.ts`), der zweite Anime2You-Artikel fiel heraus. „Wöchentlich drei bis vier Folgen bis 30.10.“ ist eine eigene Aussage mit eigenem Tag.

- **Handbeleg `Release.rhythmus`** (`stand` = Tag der Quelle, `quelle` aus `sources`, `bis`, `proWoche: [von, bis]`; Typ `shared/folgenrhythmus.ts`). `rhythmusMeldung()` (`pipeline/lib/news-rhythmus.ts`) macht daraus eine Meldung der Art `rhythmus` mit `proWoche` und `datum` = Ende, am Tag der Quelle, mit genau deren Beleg. Der Satz sagt nur, was die Quelle sagt („Bis 30.10.2026 wöchentlich 3–4 neue Folgen bei Paramount+“), nicht die Sprache und nicht die Blöcke.
- **Prüfung beim Bau:** Quelle in `sources`, Tage gültig, Spanne ganzzahlig, Ende nicht vor dem Start, und die Folgen je Tag in `schedule.observed` liegen nach dem Start in der Spanne (Avatar: 3, 3, 4). Ein Fehler bricht den Bau ab. Nie aus `observed` abgeleitet: Dort stehen auch nachgereichte Pakete (Hana-Kimi 10–12); gemessen 12.10.2026: 34 Releases haben nach dem Start Tage mit mindestens zwei Folgen (Crunchyroll-Pakete, TV-Doppelfolgen) — das ist Messung, keine Ankündigung.
- **Start-Meldung:** trägt jetzt den Trailer-Artikel 1048545 (10.09.), weil dessen Pfad „deutscher“ nennt und er die Blöcke 4–6 / 7–9 / 10–13 samt Synchro nennt; der Satz sagt „laut anime2you.de vom 10.09.“.

## Meldungen offizieller Websites: Art `offiziell` (Daniel, 12.10.2026; gebaut 13.10.2026)

Daniel (12.10.2026, 22:00): Die Website eines Titels gilt als offiziell, wenn die Trailer-Beschreibung sie verlinkt; ihre Meldungen zählen als Quelle und sollen im Neuigkeiten-Bereich der Kachel stehen (Anlass: `snowballearth.net` „Season 2 Production Confirmed!“, 27.06.2026). Der Sammler (`pipeline/fetch-offizielle-news.ts`, Beschreibung in `quellen.md`) liefert nur Vorschläge; dieser Abschnitt ist die zweite Hälfte.

- **Freigabe ist die Handdatei** `data/offizielle-meldungen.yaml` (Eintrag je Meldung: `id` des Vorschlags, `titleId`, `kategorie` `staffel|film|synchro|termin`, `datum`, `url`, `titel` wörtlich, `sprache`, `freigabe` = wer und wann). `npx tsx pipeline/offizielle-freigabe.ts <id> --kategorie … --freigabe "Name, TT.MM.JJJJ" [--titel <Kennung>]` hängt den Eintrag an und übernimmt Tag, Adresse, Überschrift und Sprache wörtlich aus dem Vorschlag. Die Kategorie behauptet etwas, deshalb setzt sie der Mensch: `staffel` = weitere Staffel bestätigt, `film` = Film angekündigt, `synchro` = Hinweis zur Synchronfassung, `termin` = Start- oder Sendetermin genannt. Ein Fehler im Eintrag bricht den Bau ab (`pipeline/lib/news-offiziell.ts`); ein Titel, der im Bestand fehlt, ergibt keine Meldung (`check-news-offiziell-bestand.ts` prüft jede Kennung gegen `titles.json`).
- **Die Meldung** (`news-offiziell.ts`, `offizielleMeldungen()`): Art `offiziell`, Tag = `datum` der Seite (`fallback`; „am“ bleibt der Tag der Seite, Grundsatz 1 — wird der Eintrag später korrigiert, bleibt die Meldung an ihrem ersten Tag, Schlüssel `offiziell:<id>`), Beleg = die Seite mit `veroeffentlichtAm` und der Überschrift **wörtlich mit Sprache** (`NewsBeleg.ueberschrift`, im Beleg-Fenster: „Überschrift der Seite (englisch): …“). Der Satz auf der Kachel sagt nur, was die Kategorie bedeutet („Weitere Staffel bestätigt“), die Pille heißt „Offizielle Website“; derselbe Wortlaut in Mail (`shared/news-offiziell-satz.ts`) und RSS. Keine Volltexte, keine Übersetzung der Seite.
- **Fenster 365 statt 120 Tage** (`fensterBeginn()`): Offizielle Meldungen sind selten (etwa eine je Woche) und veralten langsam; die Snowball-Meldung wäre am 25.10.2026 aus `news.json` gefallen. Dazu eine **Ausnahme von der Obergrenze von 400 Einträgen** (`traegtOffizielle()`): `news.json` lag am 13.10.2026 genau auf 400 Einträgen und reichte nur bis 04.09.; ohne die Ausnahme hätte die Obergrenze eine 108 Tage alte Meldung als erste abgeschnitten. Die Seite „News“ zeigt wie bisher die letzten 14 Tage, Älteres auf Knopfdruck; das Panel der Kachel zeigt die Meldung, solange sie im Fenster steht (sie ist kein Termin, der vorbeigeht). Der Newsletter nimmt nur frische Einträge; eine erst später freigegebene Meldung erscheint darin nicht mehr.
- **Gleiche Meldungen**: Zwei Meldungen desselben Titels am selben Tag bleiben beide (`bereinigeNews` unterscheidet die Art `offiziell` zusätzlich nach Adresse).
- **Prüfung**: `pipeline/check-news-offiziell.ts` (Meldung am Tag der Seite, nie umgeschrieben, Fenster 365/120 und Obergrenze, Freigabe-Fehler und -Werkzeug, Satz in Seite/Kurzform/Mail gleich, Panel). Gegenprobe von Hand: Fenster auf 120 zurück, Obergrenze ohne Ausnahme, Adresse aus dem Schlüssel — jeweils rot.
- **Beleg-Lesung**: Seiten offizieller Websites stehen (bis auf `tokyo-revengers-anime.com`, dort schon von Hand geprüft) nicht in `ARTIKEL` (`pipeline/lib/beleg-lesung.ts`) und werden daher nicht gelesen oder fotografiert; ein Beleg-Bild gäbe es erst nach der Handprüfung der Domain auf eine Zustimmungswand (`data/beleg-domains.json`). Offen.
- **Offen**: automatische Gegenprobe „Trailer-Beschreibung verlinkt die Seite“; Freigabe der übrigen Vorschläge des Sammlers (Stand 13.10.2026: 6 Vorschläge, davon 3 treffend).

## Falsche „Neu“-Meldungen: Weg und Altfälle (13.10.2026)

- **Weg für eine zu Unrecht gezeigte Meldung.** Der Verlauf (`news-verlauf.ts`, `zurueckgezogen`) gilt nur für Termin-Meldungen mit `release`; „neu“ trägt keins, und `news.json` wird aus dem Bestand jedes Mal neu gebaut. Es gibt keine Ausschlussliste. Die kleinste Lösung ist deshalb die Regel am Erzeuger: Wer die Aussage nicht mehr belegt, erzeugt sie nicht mehr; geändert wird kein Wortlaut und kein Tag einer anderen Meldung (Grundsatz 1).
- **Regel (`erreichtesRelease()`, `news.ts`):** Ohne eigenen Anbieter-Weg (`eigenesJa`) zählt ein automatisch übernommener Prime-Kanal-Termin (`kanal` und `automatisch`) nicht als Grund für „Neu auf Deutsch“. Er stammt aus einem Artikel über den Kanal-Anbieter (hier: Anime2You „Crunchyroll: 19 neue Herbst-2026-Simulcasts“) und belegt kein Prime-Ja. Ein Kanal-Termin von Hand und jeder Prime-Termin ohne Kanal bleiben. Prüfung: `pipeline/check-kanal-erbt.ts` (ohne die Regel rot, mit dem Fall der drei Titel).
- **Altfälle (21 „neu“-Meldungen mit Prime im Bestand vom 13.10.2026, einzeln geprüft):** 3 ohne je ein Prime-Ja (Detective Is Already Dead S2 07.10., Reincarnated Aristocrat S3 27.09., Wild Last Boss S2 26.09.): erst im Bau vom 13.10. 04:27 UTC erschienen, in keinem früheren `news.json`, der Prime-Weg ohne Urteil (`herkunft: termin`, `kanal: Crunchyroll`); sie entfallen mit dem nächsten Bestandsbau. 15 mit eigenem Prime-Ja am Meldetag (Amazon-Seite mit deutscher Tonspur, Handbeleg oder Messung je Folge; kein Kanal-Weg). 3 mit einem Kanal-Weg als Quelle (JoJo, Patema Inverted, Attack on Titan): Das Ja steht nach Daniels Regel „Kanal-Ja zählt als Beleg“ (17.09.2026) im Bestand; ob es für „weiterer Anbieter“ reicht, bleibt Daniels Entscheidung.
- **Nicht gelöscht, nur nicht mehr erzeugt:** Die drei waren weniger als einen Tag zu sehen und hatten nie eine belegte Aussage; eine durchgestrichene „zurückgezogen“-Zeile für „neu“ bräuchte ein Gedächtnis für „neu“ (neues Feld, Leser in Web, RSS, Worker) und wäre mehr Bau als der Fall trägt.
- **Altfall Fruits Basket S1 (16.10.2026):** Die Joyn-Meldung ohne `teil` war seit 22.09.2026 live, länger als die drei vom 13.10.; sie hing an einem Serienton-Ja von JustWatch (PR 1383), wird nicht umgeschrieben und entfällt mit dem nächsten Bestandsbau, weil der Erzeuger sie nicht mehr bildet. Die Meldung zu Staffel 2 bleibt.
- **Altfall My Hero Academia Teil 2, Prime (16.10.2026, B0CH986TFL; Eintrag 20.10.2026):** Die Meldung „Jetzt auch auf Deutsch bei Prime Video“ ist nicht gelöscht, sondern wird nur nicht mehr erzeugt: Das Prime-Ja kam allein über eine Kanal-Seite ohne zweite Quelle (PR 1613). Sie entfällt mit dem nächsten Bestandsbau; ein „zurückgezogen“ gibt es für „neu“ nicht (siehe oben).

- **Derselbe Weg für „Neu auf Deutsch“ (`neu-mit-synchro.json`, 13.10.2026).** Der Newsletter-Zulieferer zählte die drei Titel über `ersterDeutscherTermin` weiter als belegt. `ersterTerminMitGrund()` (`nebendateien.ts`) filtert die Termine mit `zaehltAlsDeutscherTermin()` (`news.ts`, dieselbe Prüfung wie `erreichtesRelease()`): Ein automatischer Kanal-Termin zählt nur bei eigenem Ja des Titels. Kanal-Ja mit Urteil (JoJo, Patema, Attack on Titan) bleibt unberührt. Prüfung: `check-kanal-erbt.ts`.
- **Auch der Streams-Zweig zählt nur eigenes Ja (13.10.2026).** `belegteDeutscheSynchro()` (`nebendateien.ts`) liest `s.dub === true` über `eigenesJa()` (`news.ts`): Ein geerbtes Kanal-Ja belegt für sich nichts. Gemessen am Bestand vom 13.10.2026 (118 Einträge in `neu-mit-synchro.json`, 84 Prime-Kanal-Wege mit Anbieter-Ja): 0 Titel fallen heraus, denn ein Erbe setzt einen Anbieter-Weg mit Ja am selben Titel voraus, und der belegt weiter. Die Regel sichert den Fall, dass der Anbieter-Weg später fehlt. Prüfung: `check-kanal-erbt.ts`.

## Beleg „angekündigt“ bei „nicht erschienen“ (Daniel, 15.10.2026, Tomb Raider King F12)

Der Kalender-Beleg (Schritt 5) zeigt den Nachher-Stand: „wir sahen nichts“. Dass Crunchyroll den Termin **angekündigt** hatte, zeigte nur der Git-Verlauf von `data/crunchyroll-woche.json`; das Wochenprogramm ist ein Wanderartikel (gleiche Adresse, jede Woche anderer Inhalt), die Zeile steht nach der Woche nicht mehr da. Daniel: „das wäre ein echter wichtiger Beweis … crunchy schuld, nicht wir“.

- **Ankündigung bleibt am Sendetag (PR 1).** `entscheiden()` übernimmt Zeilen ab heute (vorher nach heute); sonst fiel die Zeile um 00:06 heraus, der Termin wurde wieder geschätzt. `terminPruefen()` (`ausgeblieben.ts`) prüft deshalb auch angekündigte, belegte Termine, sonst käme das „nicht erschienen“ erst nach Mitternacht.
- **Foto beim Einlesen (PR 2).** `scrape-crunchyroll-woche.ts` ruft zuletzt `belegeAktualisieren()` (`lib/woche-bild.ts`): jede deutsche Zeile mit Serienkennung wird in `data/crunchyroll-woche-belege.json` mit dem Tag der ersten Sichtung geführt (Schlüssel Serie|Folgen|Tag|Uhrzeit; ändert sich eins, ist es eine neue Zeile mit neuem Bild) und einmal fotografiert. Gemessen im Lauf am 15.10.2026: bei 900 px Breite Raster zu vier Spalten, Streifen mit dem Wochentag, je Eintrag Cover, Titel, Flagge, „Folge N“, Uhrzeit; Ausschnitt vom Streifen bis unter die Zeile (höchstens 1500 px), 1×, WebP Qualität 20, rund 50 KB. Das Bild liegt in der Beleg-Ablage (Schreiben nur mit Token, Lesen mit bekanntem Schlüssel öffentlich; die Schlüssel stehen in `news.json`) (`www.crunchyroll.com/wochenprogramm/<kennung>/…webp`), die Zeile im Bild ist markiert („Zur Fundstelle“). Höchstens 20 Fotos je Lauf; ohne `LAUF_TOKEN` oder Ablage bleibt die Zeile offen und der nächste Lauf versucht es wieder. Bis zu 21 Tage geführt (länger als das Fenster der Messbelege).
- **An den Vermerk.** `termine-pruefen.ts` hängt das Bild (`belegeAnhaengen`) an jeden Vermerk derselben Serie, desselben Tags und derselben Folge, auch an bestehende: `wocheBeleg` in `data/termine-verpasst.json` → `schedule.verpasst[n].wocheBeleg` (`bau/verpasst-am-termin.ts`) → `verspaetungsMeldungen()`. Die Meldung trägt dann zwei Belege: „Crunchyroll-Wochenprogramm“ (Vorher, mit Markierung, öffnet zuerst) und der Kalender (Nachher). Der Satz der Meldung bleibt, wie er war: Ein zusätzlicher Beleg schreibt keine Meldung um (`news.json` wird jedes Mal aus dem Bestand gebaut, das Gedächtnis hält nur den Tag).
- **Ehrlich datiert.** „Erstmals geprüft am …“ ist der Tag, an dem **ein Lauf** die Zeile zuerst sah, nicht notwendig der, an dem Crunchyroll sie schrieb; „Bild vom …“ ist der Tag der Aufnahme. Tomb Raider King F12 ist von Hand vorgemerkt (erste Sichtung 12.10.2026 11:04 UTC, Git `3c831edb4`); sein Bild entsteht im ersten Lauf mit dem neuen Code, solange der Artikel die Woche 12.–18.10. zeigt.
- **Wanderartikel nicht täglich lesen.** `ARTIKEL` in `beleg-lesung.ts` nimmt `…wochenprogramm…` aus: Eine Lesung der Beleg-Warteschlange überschriebe `erstGeprueftAm`/`bildAm` des Belegs mit eigenen Daten.
- **Offen.** Die Meldung sagt weiter „war angekündigt“ auch dort, wo kein Foto vorliegt (8 von 9 Fällen am 15.10.2026 ohne Vorab-Quelle): Textfrage, siehe Bericht `daniel-zum-abarbeiten/berichte/beleg-nicht-erschienen-2026-10-15.md`. Markierung im Kalender-Messbild (Variante C) nicht gebaut.

## Re:ZERO Staffel 4: drei Lücken in den Meldungen (16.10.2026)

Bericht: `daniel-zum-abarbeiten/berichte/rezero-doppelfolge-2026-10-16.md`. Behoben in `fix/rezero-news`:
- **Folgen-Meldung an der falschen Staffel:** Teilen Staffeln eine Crunchyroll-Kennung, wählt `waehleStaffel()` (`pipeline/lib/news-cr-zuordnung.ts`) die Staffel mit einem Crunchyroll-Release dieser Kennung, das am Tag lief und die Folgennummern abdeckt (jüngste zuerst); sonst der erste Titel wie vorher.
- **Ausfall-Vermerke bei Auto-Simuldubs:** `ergaenzeVerpasstAnReleases()` (nach Phase 06 in `build.ts`) hängt `schedule.verpasst` an jedes Release ohne Vermerke.
- **Obergrenze 400:** `bleibtTrotzObergrenze()` (`news-obergrenze.ts`) nimmt Folgen-/Verspätungs-/Nachreich-Einträge der letzten 56 Tage und offizielle Meldungen von der Kappung aus.
- Fortschreibung F16–F19 war schon `estimated`; der Hinweis „Takt unklar“ gehört zur geplanten Art `takt` (Phase 2, nicht gebaut).
- **Runde 2 (16.10.2026):** `news.json` hat eine harte Gesamtgrenze von 440 Einträgen (`GESAMT_HOECHSTENS`, offizielle ausgenommen). Der Tag einer Crunchyroll-Folge ist der Berliner Tag von `verfuegbarAb` (nicht der UTC-Tag). Ein `neuErwartet`, hinter dem eine gleiche oder frühere Folge beobachtet wurde, zählt nicht mehr als Stützpunkt (`shared/logic.ts`); der Re:ZERO-Vermerk F16 (4p.de meinte Folge 14) ist berichtigt.

## Takt: Meldung und „Takt unklar“ (Phase 2 zu Re:ZERO, 16.10.2026)

Rechnung in `shared/takt.ts` (`taktTage`, `taktUnklar`), nur aus `schedule.observed`, nie aus Fortschreibung. Ein Folgen-Tag weicht ab, wenn der Abstand zum vorigen Folgen-Tag (Sendepausen aus `skipDates` abgezogen) nicht 6–8 Tage beträgt oder mehrere Folgen kamen; der Starttag zählt nicht, und eine Lücke in der Zählung (Folge fehlt in `observed`) schließt den Tag aus.
- **Art `takt`** (`pipeline/lib/news-takt.ts`), nur Crunchyroll mit `weekly` und ohne Handbeleg `rhythmus`, bis heute, Beleg wie bei `nachgereicht` der Kalender des Tages. Drei Fälle, in dieser Rangfolge: `pause` (Abstand ab 21 Tagen: „Nach 5 Wochen Pause wieder neue Folgen: Folge 14“), `doppelt` („Zwei Folgen auf einmal: 12 und 13“), `folgetag` (höchstens 5 Tage, und der Tag ist nicht der Sendetag der Serie, also der häufigste Wochentag bisher; „Folge 15 ist schon da — einen Tag nach Folge 14“). Ohne erkennbaren Sendetag keine Folgetag-Meldung: Nach einer späten Doppelfolge am Freitag ist der Mittwoch der gewohnte Tag. Wortlaut in `shared/takt-text.ts` für Seite, Feed und Mail.
- **Keine Doppelung** (`ohneDoppelteTakte`): `pause` und `doppelt` entfallen neben „verspätet erschienen“ desselben Release und Tages (sagt es schon); `doppelt` entfällt neben einer Folgen-Meldung, die alle Folgen nennt („Folgen 12–13“). `pause` und `folgetag` bleiben neben der Folgen-Meldung, sie sagen etwas, das diese nicht sagt.
- **Gedächtnis:** Schlüssel `takt:<slug>:<Tag>`, Tag = Tag der Folge; Verlauf und Obergrenze (56 Tage) wie bei Folgen/Verspätungen. Fällt eine Takt-Meldung später durch die Doppelungsregel weg (die Folgen-Meldung kommt nachträglich), zeigt der Verlauf sie als zurückgezogen.
- **Panel:** In der Nebenzeile des „läuft“-Kastens steht „Takt unklar“ statt „Wöchentlich“, wenn einer der letzten drei Folgen-Tage abwich und die nächste Folge nur fortgeschrieben ist (`estimated`); das Finale-Datum bekommt „≈“. Kein neues Feld am Ereignis, der Kalender behält sein „≈“. Nicht für Fernsehen, Komplettabwürfe und angekündigte Rhythmen (Avatar). Nach drei regelmäßigen Folgen-Tagen trägt der Takt wieder.
- Prüfung: `pipeline/check-takt.ts` (in `check:logic`).

## Der Satz einer bestehenden Meldung kippt nicht (20.10.2026)

- **Befund:** `weiterer` wurde bei jedem Bau aus den heutigen Wegen eines Titels neu abgeleitet (`terminMeldungen`). In 126 Ständen von `news.json` (04.–20.10.) wechselte es an 20 Meldungen 77-mal, 12 Meldungen gingen hin und her.
- **Regel:** Der Wert vom ersten Bau, der die Meldung erzeugte, gilt (`news-historie.json`, Feld `weiterer`, Schlüssel `angekuendigt:<release>:<datum>`; `lib/news-einfrieren.ts`). Trägt der Beleg die Aussage nicht mehr, wird die Meldung nicht mehr erzeugt, aber nie umgeschrieben. Bestehende Meldungen wurden einmalig aus ihrem ersten Stand in der git-Historie gesät (`pipeline/news-einfrieren-saeen.ts`).
- **Wächter:** `check-news-einfrieren.ts` (check:logic, Fixture mit drei Titeln und getauschten Wegen über drei Bauten) und `check-news-einfrieren-bestand.ts` (check:bestand, `news.json` gegen das Festgehaltene).
- **Offen:** Weitere abgeleitete Felder wechseln ebenfalls (`jahre`, `discSeitText`, `ausgabe`, `omu`, `teil`, `hinweis`, `geschaetzt`); sie sind nicht eingefroren, weil mehrere davon nachträglich eingeführt wurden und die Meldungen bewusst nachgerüstet bekamen.
