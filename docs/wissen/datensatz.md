# Bau und Anzeige

Ausgelagert aus `CLAUDE.md` am 18.09.2026, wortgleich. **Wann lesen:** Vor Änderungen an `pipeline/build.ts`-Anzeigelogik, am Detail-Panel, an Terminen/Folgenzählung und an Adressen/Slugs.

## Zwei Ausgaben derselben Staffel beim selben Anbieter — beide werden gezeigt

Daniel am 14.09.2026 an Digimon, mit drei Bildern: Die Prime-Pille führte auf `B0CHHNJJW3`, ohne deutschen Ton, und dort hat er gemeldet. Unter `B0CGRJGJX1` liegen dieselben 54 Folgen mit deutscher Synchro, mit anderen Folgentiteln und demselben Datum. „wenn beides legit ist, dann sollten wir diese erkenntnis offen kommunizieren … die pills zu amazon ohne de entsprechend auch anzeigen, aber mit durchstrich".

Die Auflösung stand bei JustWatch **je Angebot**, und die Gegenprobe las sie je Titel:

| JustWatch-Angebot | Ton | Untertitel |
|---|---|---|
| Amazon Prime Video (Flatrate) | de | de |
| Aniverse Amazon Channel | de | de |
| Crunchyroll Amazon Channel | es, ja, pt | u. a. de |

Die Meldung trug `Abos: crunchyrollde`. Sie war also richtig, und das Deutsch gehört einer anderen Ausgabe. `kanal-gegenprobe.ts` hielt sie für einen Widerspruch und legte die Kanal-Seite erneut vor, wo erneut kein Deutsch zu sehen war. Von den fünf „Widersprüchen" vom 09.09.2026 waren drei solche Fälle (Digimon, Bungo Stray Dogs, Touken Ranbu), einer ein belegtes Nein (Trinity Seven: Deutsch nur bei MagentaTV und Apple), einer echt (Free!: das Crunchyroll-Angebot selbst hat de).

Seitdem:

- **Die Gegenprobe vergleicht mit dem Angebot des gemeldeten Kanals.** Ohne Deutsch dort gilt ein Nein für diese Ausgabe. Hat ein **anderes** Amazon-Angebot Deutsch, entsteht `art: 'andere-ausgabe'` in `data/kanal-widerspruch.json`, und die Prüfliste legt statt der Kanal-Seite eine **Suche** vor, auf der die Ausgabe mit Deutsch angekreuzt wird. Ein Urteil gilt der Adresse, nicht dem Titel (`beurteiltSchluessel()`). Achtung beim Bearbeiten: Die alten Schlüssel dort trennten mit einem NUL-Zeichen, das `grep` als Leerzeichen zeigt und an dem `Edit` scheitert.
- **Der Bau legt die Ausgabe mit Deutsch als Verweis an**, wenn jeder vorhandene Weg der Plattform belegt ohne Deutsch ist. Sonst ist die Adresse im Beleg eine Korrektur, siehe `belegFuer()`.
- **`Title.ausgabenOhneDe` hält die Ausgabe ohne Deutsch fest**, nur wenn derselbe Titel beim selben Anbieter einen deutschen Verweis hat. Gelesen wird aus den Belegen, nicht aus den entfernten Verweisen. Das Panel zeigt sie durchgestrichen mit Kanal und „ohne DE" oder „nur dt. Untertitel". Die Regel „ein belegtes Nein entfernt den Verweis" (15.08.2026) gilt für alle übrigen Fälle weiter.
- **Dieselbe Seite wie ein Verweis wird nicht noch einmal gestrichen gezeigt (14.10.2026, Snowball Earth).** Crunchyroll führt `/de/series/X` (Verweis) und `/series/X` (Ausgabe ohne DE) auf dieselbe Serie; `ausgabenOhneDeSichtbar()` (`web/src/components/detail/chips-regeln.ts`) vergleicht `seitenKern()` (der `adressKern` aus `shared/adresse-kern.ts`, den auch der Bau nutzt, plus Sprachsegment; gti und YouTube-Video bleiben unterscheidbar) mit jedem Verweis und Bezugsweg des Titels und blendet solche Ausgaben aus. Gemessen am Bestand vom 14.10.2026: 3 Titel mit Ausgabe ohne DE, davon 1 mit gleicher Seite (Snowball Earth, ausgeblendet), 2 mit anderer Adresse (Digimon Tamers, Saint's Magic Power; bleiben). Der Bau (`11-4-ausgaben.ts`) schreibt den Eintrag unverändert; gefiltert wird nur bei der Anzeige.
- **Ein Prime-Kanal-Termin ohne Verweis erbt „Deutsch" und die Folgen vom Anbieter-Weg (14.10.2026)**, wie der Bau es für Verweise tut (`kanalErbtVomAnbieter`): `kanalTerminQuelle()`, nur bei belegtem Ja des Anbieters und ohne ausdrückliche Ausgabe ohne DE über diesen Kanal und nicht bei einem Termin, dessen Quelle nur OmU nennt. Stream-Pillen nennen zusätzlich „seit/ab <Datum>" des frühesten Termins dieses Anbieters (`seitDatumFuerPille()`), wo einer vorliegt — ohne abgeleitete und OmU-Termine und nicht, wenn der Kasten dasselbe Datum für denselben Anbieter schon nennt („im Angebot seit“, „Auf Deutsch seit · Verlag“, Verlag→Anbieter über `verlagIstAnbieter()`: „Amazon.com, Inc.“ ist Prime Video, „The Walt Disney Company“ Disney+; 14.10.2026: 466 von 2.225 Pillen, 74 wegen Kasten und 3 wegen OmU weggefallen; Daniel hatte am 13.09.2026 „seit datum ist uninteressant" gesagt und am 14.10.2026 das Gegenteil verlangt).

Das erste Bild des gebauten Panels zeigte drei Fehler, die kein Datenblick fand: Die Pille war nur blasser, nicht durchgestrichen. Daneben stand ein alter Abgang („Prime Video — nicht mehr abrufbar"), obwohl Prime jetzt einen gültigen Weg hat. Und der Bezugsweg „Amazon Prime (Crunchyroll)" auf einer dritten Kennung stand ungestrichen neben der gestrichenen Kanal-Ausgabe. Dazu trug „Date a Live II" die Kanal-Seite von Staffel 4, weil die Meldung damals an mehrere Titel der Reihe verteilt worden war. Seitdem: Abgänge fallen am Ende weg, sobald der Anbieter wieder einen Weg hat. Bezugswege desselben Kanals wandern zur Ausgabe ohne Deutsch. Eine Adresse mit Belegen bei mehreren Titeln wird nicht gezeigt. `check:logic` sichert, dass keine Ausgabe ohne Deutsch ohne deutschen Verweis daneben oder zugleich als Verweis dasteht.

**Prüffrage bei jedem Widerspruch zwischen einer Meldung und einer fremden Quelle:** *Meinen beide dieselbe Ausgabe?* Der Abschnitt „Ein Beleg gehört einer Ausgabe, nicht einem Titel" (07.09.2026) zog diese Trennung für unsere Belege. Für die zweite Quelle fehlte sie.

## Eine Notiz für Besucher ist keine Notiz über unsere Zuordnung

Daniel am 13.09.2026 zu „Zum Start am 19.08.2026 standen die Folgen 1 bis 3 gemeinsam bereit, danach geht es im Wochentakt weiter" im Antwort-Kasten: „das interessiert nicht als textform, wir schreiben bereits wieviele folgen draussen sind … rückblickende gebündelte releases sind uninteressant … das ist höchstens für uns interessant."

Gezählt waren es 288 Notizen, und die meisten gehörten zu dieser Sorte — erzeugt vom Bau, um eine Zuordnung zu erklären: „Deutsche Fassung bei Crunchyroll — 12 Folgen mit belegtem Termin (Block …)" (232×), „ADN führt diese Staffel als Folgen …", „Crunchyroll führt dazu bisher genau einen deutschen Termin", „Crunchyroll zählt die Reihe durch", „Automatisch übernommen aus …". Seitdem gibt es zwei Felder: `note` für Besucher (ein Termin, dessen Tag nicht feststeht; ein Film ohne FSK-Freigabe; bei einer Disc die deutsche Tonspur, nicht die fremde) und `herkunft` für uns. Panel und Teilen-Seiten zeigen nur `note`; die Bestandsprüfung liest beide als Erklärung einer auffälligen Folgenzahl.

**Prüffrage vor jeder neuen Notiz: Macht der Besucher etwas anders, weil er sie liest?** Wenn nein, ist es `herkunft`.

## Eine Notiz nennt nur, was der Bildschirm nicht schon sagt (13.10.2026)

Daniel am 13.10.2026 zu zwei Texten im Detail-Panel, die er „useless“ nannte: der Notiz „Deutsche Synchronisation und englischer Originalton mit Untertiteln; zuerst drei Folgen, dann jeden Freitag drei bis vier. Wann die zweite Staffel startet, ist offen.“ (Avatar: Die sieben Häfen) und dem Satz „Kein Bezugsweg bekannt. Eine deutsche Fassung gab es — die Sprecher sind belegt.“ (Durarara!!, `detail.whereDubbedButGone`, entfernt).

**Ein Text im Panel ist unnötig, wenn er** (1) eine andere Fassung als die deutsche nennt (Originalton, Untertitel, englische oder japanische Tonspur — wir verfolgen nur Deutsch), (2) wiederholt, was auf demselben Bildschirm schon steht (Überschrift, Abzeichen „Auf Deutsch verfügbar“, Rhythmuszeile, Sprecherliste, Takt, Blockgröße), (3) aus einer Lücke eine Aussage macht („kein Weg bekannt“ — fehlende Wege sagen das schon) oder (4) von einer anderen Staffel oder einem anderen Titel handelt als dem, zu dem er steht.

Für `note` gilt: den unnötigen Teil streichen; belegt die Notiz etwas, das sonst nirgends steht (Quelle, Ausnahme, Einschränkung, Zählung, Quellenwiderspruch), bleibt dieser Teil, im Zweifel die ganze Notiz. Termine mit `sprache: omu` oder `offen` dürfen die fremde Fassung nennen, dort ist sie die Auskunft. `pipeline/check-notiz-fassung.ts` (in `check:logic`) **warnt** bei Kriterium 1, bricht nie ab; die Warnung ohne Streichung ist begründet, wenn der Rest etwas Eigenes belegt (Stand 13.10.2026: Kaiju No. 8 Komplettbox, One Piece Whole Cake Island). Die Kriterien 2 bis 4 sind nicht maschinell zu prüfen. **Runde 2 (14.10.2026, Daniel: „wenn wir keine bezugswege zeigen, bedeutet es, dass uns keine bekannt sind“):** Die Sätze „Kein Anbieter bekannt.“ und „Kein Streaming- oder Disc-Anbieter bekannt.“ sind entfernt; `wegeHinweisVon` liefert dort `''`, die Überschrift des Kastens („Auf Deutsch verfügbar“, „Deutsch synchronisiert“) bleibt. „Deutsche Fassung nicht geprüft“ (Cartoon ohne jeden Beleg) heißt jetzt „Synchro offen“, wie auf der Karte; der Kasten wäre dort sonst leer — er entfällt seit dem Folgeschritt (14.10.2026) ganz, solange nichts unter der Überschrift steht (`kastenOhneInhalt` in `web/src/components/detail/kasten-leer.tsx`, 172 Cartoons; `pipeline/check-leerer-kasten.ts`; Prüfwerkzeuge finden den Kasten über `[data-kasten] > section`). Es bleiben Sätze, die eine Tatsache tragen: „Lief zuletzt im Fernsehen — kein Termin in der Zukunft bekannt.“, „Synchro und OmU“, „Kaufausgabe — erscheint an einem Tag komplett“. „Sprache der Disc im Artikel nicht genannt“ ist aus den sechs Disc-Notizen gestrichen: Alle sechs Titel haben eine belegte Synchro (Stream mit `dub`), `sprache: offen` an der Disc stellte dort „Synchro offen“ neben „Auf Deutsch verfügbar“; die Kennzeichnung gilt nur für Termine eines Titels ohne Synchro-Beleg.

## Ein Teil gehört zu seiner Staffel — gezählt wird über den Namen, nicht über die Position

Daniel am 13.09.2026 an Mushoku Tensei, mit zwei Bildern: Über der dritten Staffel stand „Staffel 5", und der erste Listeneintrag hieß wie die Reihe. AniList führt die zweite Hälfte einer geteilten Staffel als eigenen Eintrag („Cour 2"), und Kopf wie Liste zählten nach Position — Kopf über `istStaffel`, Liste über `istHauptstaffel`, zwei Rechnungen für dieselbe Frage. Seitdem beantwortet `staffelBeschriftungen()` in `shared/titles.ts` sie für beide: Ein Name mit Staffelnummer setzt die Staffel, ein Name nur mit „Teil N" gehört zur Staffel davor, und hat eine Staffel Teile, heißen alle „Staffel N - Teil M" (bei einer einzigen Staffel nur „Teil M"). Nummern gibt es erst ab zwei Staffeln ohne eigenen Namen, sonst hieße One Piece wieder „Staffel 1".

Gemessen über alle 769 Reihen in `franchises.json`: 14 mit Teilen, alle stimmig, darunter Attack on Titan, Re:Zero, Schleim und die Apothekerin mit japanischem Teil-2-Namen. Der Lauf fand dabei „Kengan Ashura: Staffel 2 — Part.2" — `eindeutschenStaffel()` kannte „Part" nur ohne Punkt. **Eine Namensregel wird über den ganzen Bestand laufen gelassen, bevor sie gilt**; der eine Fall, an dem sie gebaut wurde, zeigt ihre Lücken nicht.

**Bleibt nach dem Reihennamen nur eine Zahl, steht der volle Name da (12.10.2026).** Die Liste zeigte „Jujutsu Kaisen 0" als „0", der Kopf ebenso; `voll.slice(reihenName.length)` lässt bei „Reihe + Zahl" nur die Zahl übrig. Gemessen über `franchises.json` (Kopf und Liste nachgerechnet): 66 Teile betroffen — 8 ohne Staffelnummer (Jujutsu Kaisen 0, Pororo 2 bis 5 und 8, Ghost in the Shell 2.0, Animation Runner Kuromi 2) und 58 Hauptstaffeln, die „Staffel 2 · 2" zeigten (My Hero Academia, Bungo Stray Dogs, Steins;Gate 0, K-On!! als „Staffel 2 · !"). Jetzt 0. Regel in `reihen-regeln.ts` (`istNichtssagend`: weder Buchstabe noch Klammer; „(2016)" bleibt, es unterscheidet Fassungen): Liste und Kopf zeigen den vollen Namen; hinter „Staffel N ·" entfällt der Zusatz, wenn er nur die Staffelnummer wiederholt. Die Zählung der Staffeln (`zaehleStaffeln`) blieb unverändert. Prüfung: `check-reihen-teilname.ts` (Einheiten, ohne Fix rot) und `check-reihen-teilname-bestand.ts` (alle 4955 Teile des Bestands, `check:bestand`).

## Ein verstrichener Termin ist keine erschienene Folge — und das entscheidet eine Funktion

Daniel am 13.09.2026, mit zwei Bildern: Die Kalenderkachel trug „⚠ nicht erschienen", das Detail-Panel daneben „8 von 13 Folgen erschienen" und „Nächste Folge (Folge 9)". Die Kachel las `schedule.verpasst`, die Zählung nur Datum und Uhrzeit (`istErschienen`). Seitdem steigt `istErschienen()` bei `istAusgeblieben()` aus, und **jede** Stelle, die Folgen zählt oder einen nächsten Termin wählt, geht über diese beiden: Panel-Kopf und Fortschritt, „Merken", der Favoriten-Zeitstrahl, der ICS-Titel im Abo. Wer eine neue Anzeige baut, die „erschienen" oder „nächste Folge" sagt, nimmt diese Funktionen und keinen eigenen Datumsvergleich; `EventCard.tsx:88` (`vergangen`) ist bewusst ein reiner Datumsvergleich, weil er nur die Helligkeit steuert.

**Der Kalenderknopf steht nur bei Zukunftsterminen** (30.09.2026). An der Disc-Pille „Kaufausgabe · seit 30.09.2026" stand er noch, weil sein Filter `date >= today` auch den heutigen Tag durchließ — Daniel: „das brauchen nutzer nur für zukunftstermine". Die Regel liegt jetzt in `merkbareTermine(release, today)` (`shared/logic.ts`, strikt `> today`, ohne ausgebliebene Termine) und ist in `check:logic` zugesichert; `detail/merken.tsx` benutzt sie. Eine laufende Serie behält ihre künftigen Folgen — der Knopf verschwindet nur, wenn nichts mehr aussteht.

**Und „nicht erschienen" allein beantwortet die Frage nicht, die es aufwirft** (Daniel, 13.09.2026, 21:34: „aber wann erscheint sie nun? … sodass nutzer beruhigt sind und sich sicher sein können, das sie sich auf den kalender verlassen können"). Seitdem gibt es drei Stufen, verschieden teuer und deshalb verschieden oft (`pipeline/lib/ausgeblieben.ts`):

| Stufe | wer | wie oft | steht im Panel als |
|---|---|---|---|
| Anbieter-Kalender lesen | `termine-pruefen.ts` | mit jedem Sendezeiten-Lauf | „Wir sehen mehrmals täglich bei Crunchyroll nach … Zuletzt nachgesehen: heute, 16:29 Uhr." |
| Anime2You-Pausenmeldungen abgleichen | dito | dito, gegen den täglichen Feed | Artikel mit Verweis, oder „meldet bisher keine Verschiebung" |
| Netz-Recherche (News, Social Media) | `claude-verpasst-recherche.yml` | täglich ab 6 h Verzug, nach 14 Tagen wöchentlich, nach 60 nie | Ergebnis mit Quelle, oder „bis zum … nichts gefunden" |

Drei Riegel, jeder aus einer Falle, die sonst auf der Seite stünde: **„Zuletzt nachgesehen" ist `scrapedAt` des Kalenders**, nicht der Zeitpunkt des Prüflaufs — ein gescheiterter Abruf behauptet sonst ein Nachsehen, das nicht stattfand. **„Anime2You meldet nichts" gilt nur mit einem Feed, der nach dem Termin geholt wurde.** Und **Claude darf nur drei Felder schreiben** (`recherche`, `rechercheQuelle`, `neuErwartet`); `rechercheAm` stempelt der Workflow selbst (`--stempeln`), denn der erste erfolgreiche Lauf trug eine geratene Uhrzeit ein, 36 Minuten in der Zukunft. `verpasst-faellig.ts --pruefen` vergleicht mit dem Stand davor und verwirft den ganzen Lauf bei jeder anderen Änderung, bei `recherche` ohne https-Quelle und bei `neuErwartet` ohne Quelle — denn ein Ersatztermin verschiebt alle folgenden Termine im Kalender.

**Eine neue Prüfung bewertet, was sich geändert hat, nicht den Altbestand.** Der erste Lauf am 13.09.2026 wurde rot, weil `--pruefen` alle Einträge nach den neuen Regeln maß: Die von Hand geschriebene Recherche zu Mushoku Tensei S3 (30.08.) hat 977 Zeichen und kein Quellenfeld, das es damals nicht gab. Claude hatte sie nicht angefasst, verworfen wurde trotzdem der ganze Lauf. Wer einer Datei eine Regel hinzufügt, fragt vorher: *Erfüllt der Bestand sie schon — und wenn nicht, prüft sie dann nur das Neue?*

**Nach `claude-code-action` pusht ein späterer Schritt nicht mehr mit der Anmeldung des Checkouts.** Der zweite Lauf am 13.09.2026 war sauber recherchiert und scheiterte im Einreich-Schritt mit „Invalid username or token": Die Action setzt für sich ein eigenes Token als Git-Anmeldung und widerruft es am Ende. Das Ergebnis war verloren. Wer hinter dem Claude-Schritt noch pusht, setzt die Anmeldung vorher selbst neu (`extraheader` entfernen, `origin` mit `GITHUB_TOKEN`) — so steht es in `claude-verpasst-recherche.yml`.

Die Anime2You-Zuordnung ist absichtlich eng (ganzer Name als Wortfolge, ohne Staffelzusatz, ab acht Zeichen): Gemessen am 13.09.2026 tragen nur 5 von 92 Vorschlägen ein Pausensignal, fast alle zu Disc-Terminen. Die Recherche fängt, was dieser Abgleich verpasst; ein Fehltreffer stünde dagegen als Grund auf der Seite.

## Cartoons sind Titel wie alle anderen — auch im Panel

Daniel an „The Mighty Nein" (16.09.2026), acht Punkte: „JP 2025" über einer US-Serie,
„Noch keine deutsche Fassung" trotz deutscher Fassung, eine Prime-Pille, die auf unsere eigene
Seite führte (`href=""`), keine Beschreibung, keine Wertung, keine ähnlichen Titel, das
Studio „Prime Video" und TMDBs schwarzer Platzhalter als Poster. „fix es … generisch für
alle."

- **Beschreibung und Land lagen seit dem 12.09. im Abruf und wurden nie benutzt** — dieselbe
  Klasse wie „Eine Datei zu schreiben ist nicht dasselbe wie sie zu benutzen". Wer einen
  Bestand an die Oberfläche bringt, prüft jedes Feld des Abrufs gegen `alsTitel()`.
- **`netzwerk` ist der Sender, nicht das Studio**; Studios sind `production_companies`.
- **Das Standardposter von TMDB ist sprachabhängig** und bei `language=de-DE` oft ein
  Platzhalter. `bestesBild()` (lib/cartoons.ts) nimmt das bestbewertete unter de/en/ohne.
- **Ohne Sprachbeleg sagt der Kasten nichts über die Fassung** („In Deutschland verfügbar"
  bzw. „Synchro offen") — TMDB nennt Anbieter, keine Tonspuren.
- **Handbelege mit negativer Kennung** wirken in `schreibeCartoons()` und werden in
  `check:handbelege` mitgeprüft.

## Fernsehen ist ein eigener Anbieter — mit Sender und Sendetagen

Seit dem 16.09.2026 (Daniel an Dragon Ball DAIMA: „tägliche tv releases sind ein
paradebeispiel für eine notwendige erweiterung der webseite"). Bis dahin hängte der
Anime2You-Parser das TV-Premierendatum (28.08., TOGGO plus) an RTL+, wo die Serie erst ab
25.09. abrufbar ist.

- **`platform: tv` braucht `sender`**, `schedule.wochentage` (1 = Mo … 7 = So) ersetzt den
  Wochentakt. `sendeplatz()` in `shared/logic.ts` zählt über die Sendetage; zwischen zwei
  Stützpunkten zählt ein Sendeplan weiter, statt Folgen auf den nächsten belegten Tag zu
  legen (die Nachzügler-Regel für Streaming bleibt ohne `wochentage` unverändert).
  Angezeigt wird der Sender überall über `anbieterName()` — Karte, Panel, ICS, Teilen-Seiten,
  Newsletter.
- **„Noch X bis zum Finale" zählt die Ausgabe der nächsten Folge.** Vorher mischte der Kasten
  TV (bis 22.09.) und RTL+ (ab 25.09.).
- **Quelle: `plus.rtl.de/tv-programm`** (`fetch-tv-programm.ts`, stündlicher Lauf). Nur der
  laufende Tag, nur die RTL-Gruppe (TOGGO plus, Super RTL, RTLZWEI …), keine Folgennummern.
  Rechtsgrundlage: robots `Allow: /`, die AGB verbieten nur kommerzielles TDM — diese Seite
  ist laut Impressum nicht kommerziell. **Wird sie je kommerziell (Werbung, Affiliate), fällt
  diese Quelle weg.** Alle übrigen geprüften Quellen samt Grund stehen in `status.md`
  („Quellen für deutsche TV-Sendetermine"); fernsehserien.de, ARD/KiKA und Joyn sind
  verworfen.
- **Aus Sichtungen wird kein Plan.** `lib/tv-termine.ts` zählt neue Folgentitel als Folgen,
  Wiederholungen nicht, und schreibt nichts fort; eine gesichtete Reihe gilt bis sieben Tage
  nach der letzten Sichtung als laufend (`tvLetzteSichtung`). Ein Handeintrag in
  `data/curated/tv-2026.yaml` beim selben Sender gewinnt — nur er kennt Folgennummern und
  Sendetage.
- **Ein Datum im TV-Umfeld eines Artikels wird kein Streaming-Termin** (`TV_UMFELD` in
  `lib/meldungen.ts`).
- **Wie lange eine Sendung läuft, sagt das Programm, nicht die Folgenlänge** (22.09.2026). Die
  erste Fassung von „läuft gerade" rechnete mit Beginn + 25 Minuten. One Piece lief auf
  ProSieben MAXX aber 18:25–18:50 und 18:50–19:20; die Werbepause verschiebt das Ende (Daniel:
  „einfach im fernsehprogramm gucken bis wann es angesetzt ist"). tv.de liefert `ende` und den
  Folgentitel je Sendung. `sendungenAnhaengen()` hängt sie ab gestern an jeden TV-Termin, auch an
  von Hand gepflegte. Die Folgennummer kommt je Sendung über den Folgentitel aus der Folgenliste,
  auch wo der Termin sonst nur zählt, weil nicht jede Sendung in der Liste steht (One Piece: 12
  von 14).

## Ein Film hat Termine, keine Folgen

Daniel am 17.09.2026 an „Madoka Magica – Walpurgisnacht: Rising": Über einem deutschen
Kinostart stand „Erste Folge erscheint am … · Wöchentlich · letzte Folge · 0 von 1 Folgen".
Dazu: „Meistens kommt Kinofilm wochen vor online streaming, manchmal zeitgleich, manchmal
streaming zuerst." Seitdem bekommt ein Film mit deutschem Kino- oder Streamtermin den Kasten
`filmDe` (`filmTermine()` im Detail-Panel): vorn der nächste Termin, daneben der andere
(„Streamstart noch nicht bekannt", solange keiner da ist), bei gleichem Tag „im Kino und bei
X". Ein Kinostart, der über 60 Tage zurückliegt und keinen Stream hat, fällt auf die alte
Auskunft zurück. Die Kalenderkarte zeigt bei Filmen keine Folgennummer.

## Eine Liste wird nach Entitäten gebündelt, nicht nach Ereignissen

Die Nachrichtenseite führte am 12.09.2026 eine Zeile je **Meldung**. Ein Anime
mit vier Auskünften an einem Tag belegte vier Zeilen, und die Seite wuchs, ohne
mehr zu sagen. Daniel: „pro tag max 1 eintrag je anime — alle infos zu diesem
anime … müssen unter diesem anime gebündelt aufgelistet sein. und die übersicht
muss noch kompakter, damit man nicht so viel scrollen muss."

**Gebündelt wird je Reihe, nicht je Titel.** Für den Leser ist „Lord of
Mysteries" ein Anime; dass die Specials im Datensatz ein eigener Titel sind, ist
eine Auskunft über den Datensatz. Die Meldung nennt ihren Teil in einem Feld,
statt eine eigene Zeile zu bekommen.

**Der Aufbau ist gemessen, nicht ausgedacht.** Zehn vergleichbare Listen im
Browser vermessen (`getBoundingClientRect`, nicht geschätzt):

| Seite | Zeilenhöhe | Textgrößen |
|---|---|---|
| Wikipedia, erweiterte Letzte Änderungen | 22 px | 1 |
| GitHub Activity / Commits | 64 / 71 px | 2 |
| LiveChart Schedule | 80–92 px | 2 |
| Discourse Latest | 88 px | 2 |
| Sentry Issue Stream | 119 px | 3 |

Zwei Befunde daraus tragen jede künftige Liste dieser Art:

- **Keine dieser Listen mischt beliebig viele Ereignisarten in eine Zeile.** Wer
  feste Arten hat, nimmt **Spalten** (Sentry: Events/Users; Discourse:
  Antworten/Aufrufe); wer wechselnde hat, nimmt **Chips**. Spalten ertragen
  keine schwankende Menge — Chips schon.
- **Der Zähler ist der Aufklapper** (Wikipedia „3 Änderungen", incident.io
  „6 components ⌄"), und aufgeklappt wird **inline**. Ein Hover-Popover scheidet
  aus: Auf Touch gibt es keinen Hover, und WCAG 1.4.13 verlangt zusätzlich, dass
  der Inhalt überfahrbar und schließbar bleibt.

Die Chips stehen in **fester** Reihenfolge, nicht nach Häufigkeit — sonst
springen sie von Tag zu Tag an eine andere Stelle. Und der Chip nennt die
**Art**, die Zeile die **Umstände**: „Kino 29.09." neben einem Chip „Im Kino"
wäre dieselbe Auskunft zweimal (siehe „Keine Information zweimal").

**Geprüft wird der aufgeklappte Zustand mit** (`npm run check:news`). Ein Lauf,
der nie klickt, prüft grundsätzlich nicht, was hinter einer Interaktion liegt —
und hier war genau die die Anforderung. Dasselbe Werkzeug misst die Zeilenhöhe
gegen eine Obergrenze, denn Dichte ist hier die Sache selbst und kein Stilwunsch.

## Wer die Schreibweise von Adressen im Bestand ändert, prüft jeden Vergleich

Am 20.09.2026 richtete der Bau alle Prime-Verweise von `/dp/` auf `/gp/video/detail/` — belegt
richtig, 283 Verweise führten vorher auf eine Fehlerseite. Am nächsten Morgen fand der Einleser
eine Meldung nicht mehr: `schluesselAdresse()` in `pipeline/lib/zuordnung.ts` behandelte beide
Pfade als verschiedene Seiten, und Lupin III. Part 6 lag mit zwei Namensvorschlägen bei den
Meldungen ohne Zuordnung. `adressKern()` im Bau setzte beide längst gleich; die zweite
Normalisierung kannte das nicht.

**Prüfgriff vor jeder Umstellung einer Adressform:** `grep -rn "adressKern\|schluesselAdresse\|kennung(" pipeline tools extension`
— jede Funktion, die Adressen vergleicht, muss beide Formen gleichsetzen, und eine Zusicherung
hält es fest.

## Ein Slug ist eine Adresse, und Adressen dürfen nicht wandern

Aus `Release.slug` wird `/r/<slug>/` — eine echte Datei im Bauwerk, in der Sitemap, in
Suchmaschinen und in jedem geteilten Link. **Ändert sich der Slug, stirbt eine Adresse.**

Deshalb darf in einen Slug nur, was sich nicht ändert. Titel und Anbieter sind stabil, ein
**Datum ist es nicht**: Am 16.08.2026 trugen die automatisch übernommenen Termine ihr Datum im
Slug (`auto-171018-disc-2026-10-30`), und Termine verschieben sich in dieser Branche dauernd —
jede Verschiebung hätte eine neue Adresse erzeugt und die alte als 404 zurückgelassen. Google
hat es am selben Tag gemeldet.

Dazu gehört das Gegenstück: Eine Adresse, die es wirklich nicht mehr gibt, braucht eine
brauchbare Antwort. `public/404.html` ist diese Antwort — mit `noindex`, damit Google die
Fehlerseite nicht selbst in den Index nimmt und anschließend als Fehler zurückmeldet.

**Und jede erreichbare Adresse braucht ein `canonical`.** Die Seite liegt unter drei Adressen:
`anime-kalender.de`, `www.anime-kalender.de` und `danielzaiser91.github.io/anime-kalender-de`.
Die beiden hinteren leiten um, aber ohne `canonical` bleibt es Googles Vermutung, welche gilt —
und die Search Console meldet „Seite mit Weiterleitung". Die Zeile steht im `social`-Block von
`web/index.html`, damit `build-share-pages.ts` sie je Teilen-Seite gegen deren eigene tauscht.

### Eine Kürzung, die das Datum frisst, macht aus zwei Terminen eine Adresse

`slugify` schneidet bei 80 Zeichen ab. Bei „My Gift Lvl 9999 Unlimited Gacha:
Backstabbed in a Backwater Dungeon, I'm Out for Revenge!" fiel damit genau der
unterscheidende Teil weg — das Datum. Zwei Verkaufsstarts (08.09. und
24.09.2026) beanspruchten dieselbe Adresse, `data:validate` brach ab, und
**alle Deploys standen** (30.08.2026).

Vier Releases im ausgelieferten Bestand tragen solche gekappten Adressen; der
doppelte Slug war nur der eine Fall, der laut geworden ist. `discSlug()` in
`pipeline/lib/util.ts` kappt deshalb den **Namen** und hängt das Datum danach
an; die Höchstlänge bleibt dieselbe.

**Der zweite Fall im selben Lauf war ein anderer und braucht eine andere
Antwort.** aniSearch führt „The Devil Is a Part-Timer! II" unter einem Artikel,
AniList dieselbe Staffel unter zwei Kennungen (130592, 155168) — gleicher Name,
je zwölf Folgen, die geteilte Ausstrahlung von 2022 und 2023. Der naheliegende
Riegel „ein Quellartikel, ein Eintrag" wäre falsch gewesen: Die
Naruto-Movie-Collection ist **ein** Artikel mit acht Filmen und zwei Specials,
und jedes Werk gehört einzeln in den Kalender. Sechs Artikel erzeugen mehrere
Einträge, fünf davon zu Recht. Der Riegel gilt dem doppelten **Werk** (gleicher
Slug), nicht der doppelten Quelle.

### Ein Skript, das beim Laden arbeitet, darf nicht importiert werden

Für die Zusicherung zu `discSlug()` habe ich die Funktion aus
`pipeline/disc-proposals-to-yaml.ts` importiert. Das Skript ruft `main()` auf
Modulebene auf — der Import ließ also den ganzen Konverter laufen und
**überschrieb `data/curated/disc-anisearch.yaml` von 57 auf 4 Einträge**. Die
Zusicherungen meldeten dabei grün.

Aufgefallen ist es nur, weil danach `git diff --stat` lief. Zwei Regeln:

- **Eine geteilte Funktion gehört in `lib/`**, nicht in ein Skript mit
  Seiteneffekt. `discSlug()` steht deshalb in `pipeline/lib/util.ts`.
- **Der Konverter ist nicht wiederholbar.** Er prüft Vorschläge gegen
  `public/data/releases.json`, und dort stehen die Einträge, die er selbst
  erzeugt hat — ein zweiter Lauf verwirft fast alles als „bereits bekannt".
  Wer die YAML von Hand berichtigt, berichtigt sie und lässt den Konverter in
  Ruhe.

## Ein neues Feld ist erst eingebaut, wenn es am Ziel angekommen ist

Am 28.08.2026 bekam die Prime-Meldung ein Feld `titelId` — samt Kommentar, samt
Begründung, samt Messung („von 67 gemeldeten Adressen ließ sich genau eine
zuordnen"). Es war **drei Tage lang wirkungslos**, und niemand hat es bemerkt.

Der Fehler war eine Ebene: In `AK_OFFENE_AMAZON` trägt der äußere Eintrag Titel
und Adresse, die AniList-Kennung steht je Werk in `eintraege[]`. `eintrag?.id`
ist damit immer `undefined`. Gemessen am 31.08.2026 — **0 von 21 Adressen** mit
äußerem `id`, 19 mit einem in `eintraege`.

Die Folge stand die ganze Zeit im Log:

```
795 Rohfolgen geholt
  0 Adressen zugeordnet (0 Folgen), 795 offen
```

**Drei Lehren, und die dritte ist die allgemeine:**

1. **Der Einbau endet am Empfänger, nicht am Sender.** Wer ein Feld hinzufügt,
   prüft nach der ersten echten Meldung, ob es gefüllt ankommt — ein `SELECT`
   auf die Spalte, ein Blick in die Antwort. Das kostet eine Minute und war hier
   der Unterschied zwischen drei Tagen und keinem Tag.

2. **„0 von N" ist ein Alarm, kein Zwischenstand.** Ein Zuordnungslauf, der
   nichts zuordnet, hat nicht wenig gefunden — er ist kaputt. Solange die Zahl
   nur im Log steht, liest sie niemand; deshalb prüft `check:logic` sie jetzt.

3. **Ein Kommentar behauptet leicht, was er nicht belegt.** Dort stand „Die
   Kennung liegt hier im Auftrag bereit und beendet das Raten" — eine Absicht im
   Indikativ. Der nächste Leser (ich, drei Tage später) hält so etwas für
   gemessen und sucht den Fehler woanders. **Was noch nicht gemessen ist, gehört
   im Futur oder gar nicht in den Kommentar.**

## Ein Riegel prüft den Wert, den er sieht — nicht den, der gleich daraus wird

Am 17.09.2026 stand ein toter Prime-Link („Your Name.", `B0FLLFC2L6`, HTTP 404 gemessen)
nach **jedem** Bau wieder im Datensatz. Drei Riegel wurden nacheinander eingebaut — in der
Ergänzung aus Handbelegen, in der aus den Rohfolgen, in der aus aniSearch —, und keiner
half. Der Filter für tote Verweise lief längst und ließ den Verweis durch, weil er zu
diesem Zeitpunkt die **Suchadresse** trug (`amazon.de/s?k=…`, HTTP 200). Erst wenige
Zeilen weiter ersetzte der Handbeleg sie durch die gelöschte Seite.

**Die Reihenfolge ist der ganze Fehler:** Ein Riegel bewertet den Zustand, den er vorfindet.
Wird derselbe Wert danach ersetzt, war die Bewertung eine über etwas anderes. Prüffrage bei
jeder Prüfung mitten in einer Kette: *Ist der Wert, den ich hier prüfe, derselbe, der am Ende
dasteht?*

**Und drei Fixes aus Vermutungen kosteten mehr als eine Messung.** Gefunden hat es eine
Ausgabe im Lauf selbst (`console.error` an der Filterstelle, Titel fest verdrahtet, danach
zurückgenommen) — dieselbe Lehre wie „beim zweiten Fix am selben Symptom wird gemessen".

**Was bleibt, ist eine Prüfung am Ergebnis statt am Quelltext:** `npm run check:tote-adressen`
(in `check:bestand`) fragt den ausgelieferten Datensatz, ob ein Weg auf eine Adresse mit
belegtem 404 oder einer Regionssperre führt. Eine Zusicherung über den Quelltext fängt immer
nur die Stelle, die man schon kennt; diese nennt jede neue. Sie hat sofort einen zweiten Fall
gefunden, von dem niemand wusste (Fate/Grand Order Solomon auf Netflix).

### „kostenlos", „teilweise kostenlos", „auch kostenlos" (19.09.2026)

Daniel: TOGGO (nicht TOGGO plus) und YouTube sind kostenlose Wege; der Titel soll zeigen, ob er ganz oder teilweise frei zu sehen ist. `shared/kostenlos.ts` zählt je kostenlosem Weg: TOGGO die jetzt offenen Fenster, ein einzelnes Video eine Folge, sonst die deutschen Folgenbereiche; ohne Zahl ist der Weg „unbekannt". Wege werden nicht addiert (dieselben Folgen?), der größte gilt. Verglichen wird mit den deutschen Folgen der Kopfzeile, bei laufenden Serien ohne Gesamtzahl mit der größten belegten Zahl eines Anbieters (Beyblade X: Disney+ 100 gegen TOGGO 117 → „kostenlos"). **Ein Weg ohne Zahl macht nie „teilweise"** — er könnte den Rest abdecken; dann steht „auch kostenlos". **Seit dem 19.09.2026 ist Kostenlos ein eigener Bereich** (Daniel: „trenn die bereiche, sodass es besser visuell sichtbar ist"; das kehrt die Entscheidung vom 03.09.2026 um, die Zugangsart nur an der Pille zu nennen). Aus drei Entwürfen in drei Szenarien (1 frei + 3 Abo + 2 Kauf, 5 frei + 1 Abo, 5 frei + 5 Abo) gewählt: ein grün umrandeter Block mit dem Etikett als Überschrift, darunter „Abo", „Kauf / Leihe", „TV". Nebeneinander-Spalten stapelten sich bei vielen Pillen ohnehin, eine einzige Reihe mit Zwischenlabels zerfiel. Gegliedert wird nur, wenn es einen kostenlosen Weg gibt; der Bereich je Pille kommt als Schlüssel-Zuordnung (`pillenGruppen`) in den Kasten.

### TV-Pille: Folge, Tag, Uhrzeit, Premiere oder Wiederholung (19.09.2026)

Daniel: „im tv muss auch sagen welche folge an dem termin kommt + uhrzeit ist wichtig" und „premiere bzw wiederholung". `web/src/lib/tv-angabe.ts` nennt den nächsten Sendetermin („Fg. 19 · Mo 21:15 · Premiere"), sonst den letzten („zuletzt …"). Sichtungen zu verschiedenen Zeiten tragen jetzt `schedule.zeiten` je Folge. **Premiere** heißt: vor dem Sendetag keine deutsche Veröffentlichung — weder laut Folgenliste (`ersteDeutsch` aus Wikipedia-`EAD` bzw. RTL+-Start; ohne das hieß Dragon Ball Folge 1 von 1999 auf ProSieben MAXX „Premiere") noch im Streaming (Termine des Anbieters, sonst seine belegten Bereiche, `dub: true` ohne Bereich = alles). Disc zählt nicht.

### Pillen: neutral mit Markenstreifen, ✓ auf der Ecke, Premiere als Fähnchen (19.09.2026)

Drei Entscheidungen Daniels aus Entwürfen (je drei bis vier Varianten, dunkel und hell): Fläche neutral, Markenfarbe nur im Zeichen und als 3-px-Streifen links (vorher „rot auf rot"); der Synchro-Beleg als grünes ✓ auf der oberen rechten Ecke mit Tooltip, unbelegte ohne Zeichen („DE ✓" kostete ~35 px je Pille); „Premiere" als Fähnchen auf der oberen Kante (kostet keine Breite). Leitsatz: verfügbaren Platz wirksam nutzen. Die Pillenreihen haben dafür `gap-y-2.5` — Ecke und Fähnchen ragen über die Kante. `DubMark` („🇩🇪 ✓") stand danach nur noch in Favoriten und „Wo sehen?" — beide entfielen am 26.09.2026.

### „TV-Ausstrahlungen anzeigen" — ausgeschaltet bleiben Premieren (19.09.2026)

Der Schalter hieß „TV-Sendungen zeigen" und blendete alles Fernsehen aus. Daniel: umbenennen, Premieren bleiben sichtbar, der Zusatz in einen gekennzeichneten Tooltip. Der Filter in `App.tsx` fragt je TV-Termin `istPremiere` (`lib/tv-angabe.ts`). Der Hinweis hängt an einem eigenen ⓘ neben dem Schalter (Antippen zeigt ihn, ohne umzuschalten); `Tooltip` öffnet auf dem Handy jetzt beim Antippen für drei Sekunden — vorher nur bei Maus und Fokus. Der Kalender-Knopf an den Pillen sitzt als runder Eckknopf unten rechts, Rand und Symbol in der Markenfarbe (Google Material „calendar_add_on", Apache 2.0; Entwurf A2 — die erste Umsetzung als Symbol in der Pille war ein Missverständnis der Auswahl), mit eigenem Tooltip statt `title`; ohne Farbe (Kino-Banner) bleibt er rund in der Zeile.

## Ein Beleg über eine laufende Serie endet am Prüftag — der Wochenplan läuft weiter (25.09.2026)

„Vom Landei zum Schwertheiligen II": Beleg Prime 1–10 vom 13.09.2026, danach Folge 11 und 12 im
Wochentakt. Die Woche zeigte „Ep 12/12", das Detail-Panel „10 von 12 Folgen auf Deutsch — für die
übrigen fehlt uns eine Angabe". Zwei Leitungen für eine Frage: die Woche rechnet mit dem
Terminplan, das Panel nur mit dem Beleg. `bereicheMitTermin()` (`shared/logic.ts`) ergänzt belegte
deutsche Bereiche um die erschienenen Folgen (`istErschienen`) eines Wochen-Releases desselben
Anbieters — ein Wochen-Release in diesem Kalender ist ein deutsches —, außer ein Beleg sagt für die
Folge etwas anderes. Auf dem Bestand änderte das zwei Wege (Landei II, Ascendance of a Bookworm).
Die Wiedervorlage für laufende Serien (`wiedervorlage-frist.ts`) greift nur bei `dub: false`; eine
deutsche Lücke hinter dem Beleg schließt jetzt der Terminplan.

**Herkunft je Folge (12.10.2026):** Die Zusammenführung verwarf, welche Folgen belegt und welche nur aus dem Plan ergänzt
sind — Tank Chair bei Prime (Beleg Folge 1, Folge 2 fortgeschrieben) zeigte „Fg. 1–2“ ohne „≈“. Gewählt wurde nicht, die
Bereiche an der Grenze aufzuteilen (jeder Leser von `dubRanges` — `dubBild`, `dubGrenze`, Kanal-Vereinigung, Kasten —
müsste angrenzende Bereiche wieder verschmelzen, Etiketten wie „DE 1–10, 11–12“ wären die Folge), sondern die ergänzten Folgen
zu merken: `titelMitTerminBereichen` setzt am Weg `ergaenzteFolgen` (`ergaenzteFolgen()` in `shared/logic.ts`, nur im Panel,
nie im Datensatz); die Bereiche bleiben zusammengeführt. `planGeschaetzt`/`ergaenzungGeschaetzt` (`folgen-spanne.ts`) rechnen
eine ergänzte Folge nicht als belegt; „≈“ steht, wenn ihr Termin `estimated` ist (beobachtete Termine bleiben ohne „≈“ —
Wistoria 13–24, Overgeared). Bestand 12.10.2026: 1 von 2.939 Pillen ändert sich (Tank Chair); `check-herkunft-je-folge.ts`.


## Poster-Gestaltung: Kalender, Kopfleiste, Navigation (26.09.2026)

Aus drei Prototypen hat Daniel am 26.09.2026 Richtung B „Poster“ gewählt (Leinwand
https://claude.ai/artifact/AEJUirTAgvme2kH4m8uHpH) und sie in zwei Runden kommentiert. Umgesetzt:

- **Navigation: Kalender (Woche ⇄ Monat) · Datenbank · News.** Agenda, Favoriten und „Wo sehen?“
  sind entfallen: die Woche ist schon eine Tagesliste, „Nur Favoriten“ und die Anbieter-Chips im
  Filter beantworten die beiden anderen. Alte Adressen (`#/agenda`, `#/favoriten`, `#/wo`) leiten in
  `lib/router.ts` weiter und werden in der Leiste umgeschrieben (`ALTE_ANSICHTEN`); Push-Nachrichten
  führen seitdem auf `#/woche?fav=1`.
- **Umzüge:** „gesehen bis Folge N“ steht im Detail-Panel eines Favoriten (`detail/fortschritt.tsx`,
  unter dem Antwortkasten). „N neu“ steht nur an der Kachel der neuesten **erschienenen** Folge
  (`neuesteErschienen()`, ohne Fernsehen, das eigene Nummern zählt; Zusicherung „Neu: …“). Der
  Push-Schalter sitzt im Abo-Menü, das Nachführen der Favoriten beim
  Push-Dienst in `App` (`usePushNachfuehren`, vorher nur bei geöffneter Favoriten-Ansicht).
- **Kopfleiste** klebt oben: Logo (das Favicon-Symbol), Suche (gilt für Kalender und Datenbank,
  von anderen Seiten führt sie in die Datenbank), Abo-Knopf nur mit Kalender- und Glockensymbol,
  Hell/Dunkel, Zahnrad. Auf dem Handy unten Kalender · Datenbank · News · Einstellungen; Hell/Dunkel
  dort im Einstellungsdialog, sonst passte der Name nicht in die Leiste.
- **Woche:** je Tag eine Zeile — Tag, Cover-Raster (`repeat(auto-fill, minmax(128px, 1fr))`, auf
  dem Handy genau zwei Spalten, immer in Zeitreihenfolge — `grid-flow-dense` würfelte sie durcheinander,
  eine Lücke vor einer breiten Kachel wird hingenommen), darunter **„Im Handel“** als kompakte Liste
  (Titel + „DVD / Blu-ray“), rechts „Im Fernsehen“. **Disc-Termine sind seit dem 30.09.2026 kein
  Poster im Raster mehr** (Daniels Wahl nach zwei Prototypen): Sie sind zu viele und zu wenig
  interessant, und als Liste kämpfen sie nicht mit dem Fernseh-Kasten um Platz. Der TV-Kasten füllt
  die Zeilenhöhe (`h-full` im absolut positionierten Rahmen) und scrollt darin; wächst die
  Mittelspalte durch den Disc-Kasten, wächst er mit. Ein Klick auf einen Titel öffnet das Panel mit
  dem Stream/Disc-Umschalter auf **„Disc"** (`detail/disc-start.ts`, 30.09.2026); der Umschalter
  selbst liegt in `detail/umschalter.tsx`. Bilder: `docs/woche-im-handel*.png`.
- **Staffelstart und Staffelfinale** nehmen zwei Spalten ein, das Cover füllt die Breite, der Text
  steht wie bei jeder Kachel darunter (Daniel: kein geteiltes Cover/Text). `istStaffelfinale()`:
  wöchentlich, nicht TV, nicht `available-from`, `episode === episodeCount`, kein
  `episodeCountAssumed`. Zusicherungen: `check:logic`, „Staffelstart: …“, „Staffelfinale: …“.
  Seit 13.10.2026 teilt sich das Finale die Kachel mit den anderen Folgen desselben Tages („Folge 13–14/14“, Abschnitt unten) und es gibt als dritte Auszeichnung den Katalog-Release (belegt, sonst „Katalog-Release ≈“).
- **Monat:** Cover ohne Text; Zeigen nennt Titel, Zeit und Folge (`kalender/Schwebe.tsx`), Klick
  öffnet das Panel. „+N“ klappt alle Termine des Tages auf, die TV-Zeile zeigt beim Zeigen (und
  per Klick) die Ausstrahlungen. Ein Klick auf die Tageszahl springt in der Woche zu diesem Tag
  (`lib/ziel-tag.ts`). Unter `sm` ist die ganze Zelle ein Knopf, der den Tag aufklappt — Cover
  von 22 px wären kein Touch-Ziel.
- **Zählung** je Tag und Monat: „8 Termine · 9 im TV“ (`zaehlung()`); Termine sind Streaming und
  Kino — **nicht Disc** (die stehen im eigenen Kasten, seit 30.09.2026) und nicht Fernsehen. Eine
  Null entfällt, der leere Tag sagt „Kein Termin an diesem Tag.“, ein Tag nur mit Fernsehen sagt
  nichts extra — der Kasten daneben sagt es.
- **Tailwind v4 erzeugt `pt-[calc((100%-0.75rem)*0.75)]` nicht — lautlos, ohne Warnung** (gemessen
  26.09.2026 im gebauten CSS). Verschachtelte `calc` stehen deshalb als eigene Klasse in `styles.css`
  (`.ak-breit-cover`); nach jeder arbiträren Klasse im gebauten CSS nachsehen, ob sie angekommen ist.
- **Kino-Karte „Kinosaal“** (12.10.2026, Daniels Wahl E im Mockup T-124): ein Kino-Termin ohne Staffelring und ohne zweiten
  Anbieter (`istKinoSaal`, `kalender/KinoBuehne.tsx`) nimmt zwei Spalten, so hoch wie die Nachbarn (`ak-breit-cover`); das Cover
  ist ein Fenster (78 % × 68 %) zwischen Vorhängen und Querbehang mit „Kino“, alles CSS (`.ak-saal-*` in `styles.css`, kein Bild,
  keine Animation). Die Unterzeile entfällt. Mehrere Kino-Termine am Tag sind je eine eigene Reihe; ein Staffelfinale trägt nie Vorhänge.
- **Vergangenes** dimmt nur Bilder (`.ak-vorbei`), Text wechselt auf `--ak-leise` — `opacity` am
  ganzen Tag drückte jeden Text unter 4,5:1 (axe, 26.09.2026).
- **Schwebekarten** (`Schwebe.tsx`) stehen nie über der Kopfleiste oder dem Auslöser und rollen
  in sich; per Klick geöffnet bekommen sie den Fokus, Escape schließt und gibt ihn zurück.
- **Wiederholungen** eines Tages bündelt weiter `buendeleTermine()`: im TV-Kasten „+2, zuletzt um 18:50“ (eine weitere: „+1 um 17:35“; die Zeit ist der Beginn der letzten Sendung, nicht ihr Ende)
  (Klick nennt die Zeiten), bei Streaming „+N Folgen“; nie über Sender hinweg, ausgebliebene Termine
  und Premieren nie eingeklappt. Zusicherung: `check:logic`, „Bündel: …“.
- **Ein Titel bei mehreren Streaming-Anbietern am selben Tag** ist eine Kachel (`vereineAnbieter()`, 12.10.2026, Daniel:
  Reborn as a Space Mercenary, Crunchyroll + Prime Video): Farbleiste geteilt, Angaben je Anbieter
  (`AnbieterAngaben.tsx`; was gleich ist, steht einmal), in Woche und Monat. Ausgebliebenes, Premieren und Termine mit
  Sprachhinweis bleiben eigene Kacheln. Zusicherung: `pipeline/check-kachel-anbieter.ts`; Code `web/src/lib/anbieter-kachel.ts`, die Nein-Wiedervorlage (`quellen.md`, 13.10.2026) liest dieselbe Kachel als Widerruf eines Nein. Der Tageskopf („7 Termine“)
  zählt weiter Termine je Anbieter.
- **Farben und Schriften:** Variablen `--ak-*` je Thema in `styles.css`, in Tailwind `bg-ak-grund`,
  `text-ak-leise` usw.; Schrift E (25.10.2026): Systemschrift im Text, Serifen-Stack in Überschriften (`--ak-schrift-*`), keine Webschrift — nichts geht über Google
  Fonts, nichts übermittelt eine IP-Adresse (Vorschaubilder nutzen weiter Unbounded/Manrope serverseitig, `og-schriften.ts`).
- Die Handy-Leiste liegt per Portal am `body` (unter `backdrop-filter` bezöge sich `fixed` sonst auf
  die Kopfleiste); die Seite hält unter `md` unten Platz für sie frei.
- **Steuerleiste unten** (27.09.2026, Daniel: „einfach immer unten am rand anzeigen"): Woche/Monat,
  Filter, ‹ heute ›, Datumssprung docken als Pille unten an (`Steuerleiste` in `KalenderKopf.tsx`,
  `data-steuerleiste`), auf dem Handy über der Navigation. Das Filterfeld öffnet als Blatt darüber,
  Escape schließt es. Die Seite hält im Kalender unten Platz frei (`FUSS_ABSTAND` in `App.tsx`),
  Schwebekarten enden an der Oberkante der Leiste.
- **Sprung zu heute** beim Laden der Woche und beim Klick aufs Logo, auf jeder Breite
  (`useSprungZuHeute`, Ereignis `ak-zu-heute`) — die Poster-Woche steht auch am Rechner untereinander.

## Link-Vorschau im Poster-Stil (27.09.2026)

`pipeline/build-og.ts` zeichnet die 1200×630-Bilder jetzt wie die Seite (`lib/og-karte.ts`): Cover
links, Anbieter-Chips, Titel in Unbounded, Eckdaten als Raster, Wortmarke. **Seit 20.10.2026 (Fassung
`kino-1`, Daniels Wahl F8):** Layout „Kino" — Cover als Plakat rechts und unscharf als Hintergrund,
links Marke „Block AK" (`lib/og-marke.ts`) mit Wortmarke, Titel, Datumsmarke (`terminKopf` in
`lib/og-termin.ts`) mit Folgen daneben, Chips unten; das Standardbild (`lib/og-standard-bild.ts`) trägt
Glut, Wasserzeichen und drei Aussagen, ohne Datum in der Kennung. Der Raster-Absatz oben und die
Schriften darunter stimmen weiter; Raster, Genres und Label entfielen. Zu wissen:

- **Schriften:** Pango (in sharp) liest weder WOFF noch eine eigene fontconfig-Datei — beides fällt
  lautlos auf eine Ersatzschrift zurück. `lib/og-schriften.ts` packt die WOFF aus `@fontsource` in
  TTF um und gibt jedem Schnitt einen eigenen Familiennamen („AKfett"): Pango hält je Familie nur
  den zuerst geladenen Schnitt, „Manrope 600" kam sonst als 800 heraus.
- **Fassung:** `public/og/fassung.txt`. Weicht sie von `FASSUNG` ab, zeichnet der nächste
  Bestandslauf alle Bilder neu — sonst erreichte ein neues Aussehen nur neue Releases. Bei jeder
  Änderung an `og-karte.ts` hochzählen. Stichproben lokal: `npx tsx pipeline/build-og.ts --nur
  default,<slug>` (danach `git checkout public/og`).
- **Caches der Netze:** Messenger merken sich das Bild zur Bild-Adresse. Deshalb hängt an jeder
  `og:image`-Adresse `?v=<Fassung>` (`lib/og-fassung.ts`, auch an der Startseite) — eine neue
  Fassung ist für sie ein neues Bild. Die Seite selbst holen sie erst nach Ablauf ihres Caches neu;
  sofort wirkt der Facebook-Debugger („Scrape Again", gilt auch für WhatsApp).
  **Ein angehängtes `?v=0` an der Seitenadresse hilft nicht:** `og:url` zeigt auf
  `https://anime-kalender.de/`, Facebook und WhatsApp werten jede Variante als diese Adresse und
  zeigen deren gespeicherte Vorschau (27.09.2026, live geprüft: Seite und Bild waren neu).
- **Inhalt:** ohne künftigen Termin „Erste Folge"/„Erschienen" statt „Nächste Folge", Katalogtitel
  „Im Angebot seit"; das Standardbild zählt aus `meta.json` (vorher 504 aus `titles-core`).
- Titelseiten (`/t/…`) behalten Banner oder Cover von AniList: eigene Bilder für 2.781 Titel wären
  rund 170 MB zusätzlich im Repo (899 Release-Bilder = 54 MB).

## Standard-Vorschaubild bleibt aktuell (13.10.2026)

`og/default.jpg` wurde nur gezeichnet, wenn die Datei fehlte; die Zahl blieb stehen (Vorschau zeigte
2.779 bei 2.924 Titeln). Jetzt bildet `lib/og-standard.ts` aus den Eingaben des Bilds eine Kennung
(`public/og/default.txt`); `build-og.ts` zeichnet neu, sobald sie abweicht. Die Zahl ist auf Hunderter
abgerundet („über 2.500"; die Zahl kommt aus `belegtCount`, nur belegte Synchro zählt), damit nicht jeder neue Titel einen Commit auslöst. Dieselbe Kennung hängt als
`?v=` an `og/default.jpg` (Startseite, Titelseiten, Verzeichnis) — sonst hielten Messenger das alte Bild
zur alten Adresse. Keine Plattform-Chips mehr: „Streaming, Disc, Kino, TV" sagt das Wo schon.
Prüfung: `tools/og-standard.test.ts` (Teil von `check:teilseiten`), auch dass das abgelegte Bild zum Bestand passt.

## Neuigkeiten im Detail-Panel (27.09.2026)

Daniel: News eines Titels direkt im Panel sehen und zur Quelle springen. `detail/neuigkeiten.tsx`
zeigt die Meldungen aus `news.json` für den **eigenen Titel** (Teil = `teilId ?? titelId`), neueste
zuerst, drei sichtbar. Satz und Farbe wie auf der News-Seite (`newsSatz`, `NEWS_FARBE`).

- **Quelle:** Meldungen tragen keine Adresse. Genommen wird der jüngste Beleg (`quellen`,
  `gesehenAm`) des Releases der Meldung, sonst `sources[0]`, sonst `platformUrl`; „neu auf Deutsch"
  ohne Release führt zur Serie beim Anbieter (`streams[].url`).
- **Gefiltert** (`meldungenImPanel`, Daniel 27.09.2026): kein anderer Teil der Reihe (bei Pokémon
  standen „Reisen" und „Horizonte" im Panel von „Generationen"); Ankündigung, Disc und Kino fallen
  weg, sobald ihr Tag vorbei ist, und schon vorher, wenn ihr Release zum Titel gehört — dann zeigt
  der Antwortkasten den Termin. Gemessen am 27.09.2026: von 408 Meldungen betreffen 180 einen
  anderen Teil, 159 einen vergangenen Termin, 102 einen kommenden mit eigenem Release (alle 102
  gehören zum Titel der Meldung). Geblieben sind „neu auf Deutsch", Folgen und Verspätungen.

## „0 von 12 erschienen" über einer fertigen Synchro: drei Quellen, keine kam durch (02.10.2026)

**Fall:** „Rooster Fighter" (179813) lief vom 15.03. bis 31.05.2026 vollständig synchronisiert bei
Disney+; das Panel sagte „0 von 12 Folgen erschienen", weil unser einziger Termin der Netflix-Start
am 10.10.2026 war. Drei Quellen hatten es richtig — aniSearch („Deutsch · Synchronisiert ·
Abgeschlossen · 15.03.–31.05.2026 · Disney" samt Disney+-Adresse), JustWatch (17.09.: Disney+ mit
deutschem Ton) und Disney+ selbst.

**Ursachen und was jetzt gilt:**

1. Ein Handbeleg vom 26.08. („Disney+ meldet: nicht in deinem Gebiet verfügbar", eine Serie von 17
   gleichen Belegen an einem Tag) hielt den Disney+-Weg draußen. **Jetzt:** Ein verneinender Beleg,
   dem JustWatch später deutschen Ton entgegenhält, kommt auf die Prüfliste (`tools/verdacht.mjs`,
   `justwatchWiderspruch`). Am Bestand: 1 Disney+-, 12 Prime-Titel.
2. Jeder eigene Termin unterdrückte aniSearchs deutsche Erstausgabe — auch ein späterer auf einer
   anderen Plattform. **Jetzt:** Er verdrängt sie nur, wenn aniSearchs Veröffentlichung nicht schon
   vor ihm endete (`eigenerTerminVerdraengt`). Damit trägt der Titel aniSearchs Marke
   „Synchronisiert", und der Kasten zählt sie als belegte Synchro (bis zum Gegenbeweis).
3. Daniels Prüfung vom 02.10. steht als Handbeleg (Disney+, Folgen 1–12).

**Gemessen am Bestand (02.10.):** 2.349 Titel führt aniSearch als „Deutsch · synchronisiert ·
abgeschlossen" mit vergangenem Ende; 855 davon ohne Weg mit `dub: true`, aber fast alle mit
Erstausgabe. Ein künftiger eigener Termin daneben — das Fehlerbild „0 von N" — traf nur Rooster
Fighter.

## Folgenliste mit deutscher Flagge (04.10.2026)

`pipeline/bau/folgen-dateien.ts` schreibt je Titel `public/data/folgen/<AniList-ID>.json` (`{ f, de, min? }`). Quelle der Folgen ist `data/anisearch-folgen.json` — **abgelegt nach aniSearch-ID**, nicht nach AniList-ID (ein Lesen nach AniList-ID gab bis 04.10.2026 nur bei 117 Zufallstreffern eine Liste). Ein aniSearch-Eintrag, den sich mehrere Titel teilen, bleibt ohne Liste. Die Flagge je Folge (`de`) ist die Vereinigung aus belegten Anbieter-Bereichen (`dubRanges` mit `dub: true`) und den Folgen mit deutscher Erstausstrahlung in der Wikipedia-Episodenliste (`data/wikipedia-folgen.json`, bisher 24 Titel). Minuten stehen einmal als `min`, wenn alle Folgen gleich lang sind (One Piece: 1.173 von 1.173 mit 24 Min.; von 1.692 Titeln mit Minutenangabe sind 1.568 einheitlich).

Handprobe One Piece (Daniel, 04.10.2026): Folge 542 hat in der deutschen Wikipedia kein deutsches Datum und lief laut Googles Gemini-Antwort nicht regulär auf ProSieben MAXX — sie ist eine Bonus-/Crossover-Episode (Chopper-Special), also ohne deutsche Synchro. Unsere Flagge fehlt dort zu Recht (Flagge bei 1–541, 543–589, 591–1122); Folge 590 ist noch nicht von Hand geprüft.

## Magilumière Staffel 2 und das „Im Angebot seit" je Staffel (05.10.2026)

**Frage (Daniel):** Warum landete Magilumière Staffel 2 nie im Kalender? **Befund:** Der Titel stand im Bestand (Prime Video, Synchro belegt, aniSearch-Erstausgabe 04.07.2026), hatte aber **keinen einzigen Termin**:
Prime nennt keine Folgentage, und der Weg über Movie of the Night (`13-3-listen.ts`) führt ein Datum je *Serie* — die zweite Staffel erbte das der ersten (2024) und fiel unter die Grenze 01.01.2026.
Eine Quelle für Folgentage gibt es nicht (aniSearch-Folgen nennen nur Nummern; Prime nur über die Erweiterung). **Lücke im Code:** Das Datum gilt je Titel (aniSearch `deErstausgabe`), wurde aber nur als Stammdatum geführt.
**Schluss:** `pipeline/bau/13-7-erstausgabe-angebot.ts` legt für Titel **ohne Termin** mit Erstausgabe ab 2026 bei einem eindeutigen Streaming-Verlag (Amazon → Prime Video, Netflix, Disney) und belegter Synchro dort einen
„Im Angebot seit"-Eintrag an (`dateMeaning: available-from`, Quelle: aniSearch-Titelseite) — kein Erscheinungstag je Folge. An den Live-Daten messen sich 6 Titel (u. a. Magilumière S2 04.07.2026, Mission: Yozakura Family 10.05.2026, Medalist S2 24.01.2026).

## Eine Disc nimmt dem Titel das „Im Angebot seit“ nicht (13.10.2026)

`13-3-angebot-seit.ts` (Movie of the Night) und `13-7-erstausgabe-angebot.ts` (aniSearch-Erstausgabe) füllen nur Titel ohne Termin. Ein Disc-Termin zählte dabei als Termin und nahm Titeln mit Streaming-Katalogdatum das „Im Angebot seit“ (Pokémon „Die Anfänge“, Titel 527, Netflix seit 02.2025, Box am 27.11.2026: deshalb damals nicht eingetragen). Ein Erscheinungstag einer DVD- oder Blu-ray-Box sagt nichts darüber, seit wann ein Anbieter den Titel führt; es sind verschiedene Wege. Jetzt zählt `titelMitTermin` (`bau/titel-mit-termin.ts`) alle Termine außer `disc`; Streaming, TV und Kino ersetzen das „Im Angebot seit“ wie bisher. **Gemessen** (Bauvergleich 13.10.2026, 30b8bfdd1 gegen e70713317): 9 Titel mit nur einer Disc als Termin bekommen ihr „Im Angebot seit“ am Titel (Detektei Layton, The Quintessential Quintuplets, Jujutsu Kaisen, Die Tagebücher der Apothekerin, Sakamoto Days und vier mit Datum ab 2026), davon 4 auch als Kalendereintrag (`motn-…`: My Next Life as a Villainess X, My Dress-Up Darling, The Café Terrace and Its Goddesses ×2). Offen: Ob TV- oder Kino-Termine das „Im Angebot seit“ verdrängen sollen, ist nicht untersucht; ihre Wege (Fernsehsender, Kinosaal) sind auch keine Streaming-Kataloge.

## Lückenlisten je Feld des Detail-Panels (14.10.2026)

`npm run data:lueckenlisten` (`pipeline/lueckenlisten.ts`, nach dem Bestandsbau) schreibt nach `daniel-zum-abarbeiten/listen/luecken/` (nicht im Repo, wie die anderen Arbeitslisten; der Bau in CI schreibt sie nicht) je Feld eine Datei und `00-uebersicht.md` mit Zahlen und Datum. Gemeinsamer Rahmen `lib/luecken-rahmen.ts`, eine kleine Prüfung je Feld in `lib/luecken-felder.ts` (Cover SD/HQ, Banner, deutscher Titel, Handlung, Studio, Jahr, Folgenzahl, Bezugsweg, Quellenbeleg mit Bild; bedingt: Sprecher, Trailer, FSK, Bewertung, Schlagworte), Laden in `lib/luecken-kontext.ts`. Ein neues Feld ist ein Eintrag in `FELDER`.

- **Liste A** (zuerst): Termin von −90 bis +180 Tage oder mindestens 1.500 aniSearch-Stimmen (`A_MIN_STIMMEN`; gemessen 13.10.2026: A 675, B 2.249; Bericht `berichte/lueckenlisten-inventur-2026-10-13.md`). **Liste B**: der Rest. Innerhalb nach Stimmen absteigend; Zeile = Titel mit Link ins Panel (`#/woche?t=<id>`), Jahr, Stimmen, Grund, Hinweis.
- Die Bekanntheit ist die Stimmenzahl der archivierten aniSearch-Seite (`parseStimmen`), nicht die Wertung. Katalog und Cartoons haben vorerst keine Liste.
- Gegenprobe im Lauf: Titel, Jahr und Cover müssen mit `data/luecken-titel.json` übereinstimmen (sonst eine Logzeile); `tools/lueckenlisten.test.mjs` rechnet A/B-Regel, Sortierung und A + B = Hauptbestand nach.
- Ersetzt `listen/banner-luecken.md` (Stand 11.10.2026, wurde im Plakat-Lauf geschrieben): Der Plakat-Lauf schreibt sie nicht mehr, die Banner-Liste ist `listen/luecken/banner.md`.

## Große Cover, Titelrang und Suche in Zeitscheiben (07.10.2026)

**Anlass:** Daniel, 07.10.2026: Das vergrößerte Cover („Rascal Does Not Dream of a Dear Friend") war unscharf; die Suche in der Datenbank mit dem Schalter „ohne deutsche Synchro" fror die Seite ein.

- **Cover.** AniList liefert höchstens 460 × 644 px (`large`), 551 Titel nur 230 px. TMDB führt dasselbe Plakat bis 2000 × 3000. `pipeline/fetch-tmdb-poster.ts` holt je Titel mit TMDB-Kennung (`data/tmdb-titles.json`) das beste Hochformat (`lib/tmdb-plakat.ts`: erst japanisch, dann ohne Schrift, deutsch, englisch; innerhalb einer Sprache das breiteste) nach `data/tmdb-poster.json` (`{p, w, h, l}`, `null` = TMDB hat keins). Filme ohne Zuordnung werden per Namens- und Jahressuche gefunden (`passtFilm`; 9 von 30). Gemessen 07.10.2026: 2.018 von 2.045 Titeln mit Plakat; 341 unter 920 px, 375 zwischen 920 und 1.279, 1.302 ab 1.280.
- **Auslieferung.** Der Bau hängt `cg: [Pfad, Breite, Höhe]` an die Beschreibung (`synopses/<n>.json`, die das Panel ohnehin lädt) für Plakate ab `MIN_BREITE` = 690 px (1,5-fach AniList; Daniel, 07.10.2026, vorher 920); `bau/cover-gross.ts` schreibt den Monitor `data/cover-klein.json` (id, Name, AniList-Breite, TMDB-Breite, Grund) und warnt im Protokoll. Die Vergrößerung (`web/src/components/detail/cover-max.tsx`) zeigt das AniList-Bild sofort und lädt **erst beim Öffnen** das große (`srcset` 500/780 px, nur 500 bei Datensparmodus oder 3G; `preconnect` beim Überfahren/Berühren des Covers).
- **Stand 07.10.2026 (lokaler Bau mit älterem Cache):** 1.671 von 2.743 Titeln mit großem Cover; 1.072 ohne: 738 ohne TMDB-Zuordnung (meist spätere Staffeln, OVAs, Specials), 338 Plakat zu klein, 27 ohne Plakat. **Offen:** Staffelplakate (`/tv/{id}/season/{n}/images`) für die Staffeln ohne eigene Zuordnung; andere Quellen für die 338 zu kleinen (Kitsu `original`, aniSearch `cover.large` 600 px, Wikipedia/Offizielle Seiten per Websuche).
- **Cover-Vergrößerung gemessen (07.10.2026, Handy 390 px, 3× Pixeldichte, 1,6 Mbit/s, 150 ms, CPU 4×):** vor dem Klick 0 Anfragen an TMDB; nach dem Klick lädt der Browser `w780` (97,9 KB) in 368 ms. Rascal Does Not Dream of a Dear Friend zeigt das Plakat 2000 × 2829 in der 780-px-Fassung.
- **Titelrang.** `bau/titel-rang.ts` schreibt jedem Titel in `titles.json`, `ohne-synchro.json` und `cartoons.json` seinen Platz `tr` in der deutschen Sortierung nach `anzeigeName` — über alle drei zusammen. `sortiereNachTitel` sortiert danach nach einer Zahl: auf einem Handy mit 4-facher CPU-Drosselung war der Namensvergleich über 18.863 Titel ein Block von rund 900 ms. Kosten: `ohne-synchro.json` +67 KB gzip (1,27 → 1,34 MB), `titles.json` +13 KB.
- **Suche in Zeitscheiben.** `sucheGen`, `filterTitlesGen`, `filterEventsGen` sind Generatoren, die nach 6 ms abgeben; `use-zeitscheibe.ts` treibt sie, verwirft veraltete Läufe und lässt das vorige Ergebnis stehen (`laeuft`). Die synchronen Namen (`filterTitles`, `sucheMitFundstellen`) sind Mäntel (`treibe`) mit unverändertem Ergebnis (18 Abfragen gegen den alten Stand verglichen, 0 Abweichungen). Die teure ungefähre Stufe läuft nur, wo ihr Ergebnis zählt. **Gemessen (Handy, 4× CPU, ohne Synchro, 18.864 Titel):** „abc" 836 + 389 ms → 121 + 58 ms; „xqzvwkkk" 2.969 + 2.914 + 2.084 + 1.966 ms → 112 ms; Feld leeren (volle Liste, 18.864 Ergebnisse) 468 + 391 ms → 89 ms. Größter verbleibender Block 121 ms bei vierfach gedrosselter CPU (React-Zeichnen), rund ein Viertel davon auf einem echten Handy. Die Sortierung nach `tr` ordnet ein statt zu vergleichen (`ordneNachRang`, linear).
- **Keine Synchro laut aniSearch.** `fetch-anisearch-dubs.ts` schreibt `data/anisearch-dubs.json` (Titel-Kennung → `d` vertont, `p` geplant, `c` abgebrochen, `-` nicht genannt); `keineSynchroLautAnisearch` (`bau/ohne-beleg.ts`) schiebt Titel mit deutscher Ausgabe, deren Kennzeichen `-` ist und die keinen Stream mit belegter Synchro haben, hinter den Toggle (Handprüfung E: 10 von 10 bestätigt). `ausAnisearchDubs` holt umgekehrt die Titel mit `d`/`p`/`c` in den Bestand (Ranma ½ 1989: 30 deutsche Folgen, Dub abgebrochen). Der Disc-Weg „Ausgabe bei aniSearch" entsteht nur noch mit der Marke „Synchronisiert".
- **Teile ohne belegte Synchro.** `bau/synchro-belegt.ts` markiert in der Reihenliste (nicht im Kalender) Teile ab 2023 mit geringer Sicherheit, ohne belegten Stream, Sprecher oder sicheren Termin als `ohneSynchro` (14 Titel, darunter Black Clover Staffel 2).

## Ladegewicht des Erstaufrufs und „Wochen-Datei zuerst" (08.10.2026)

Reine Messung der Live-Seite `https://anime-kalender.de/`, noch kein Umbau. Rezept: `tools/archiv/ladegewicht-messung.mjs`
(Playwright, 390 × 844, 2× Pixeldichte, `isMobile`, ohne Cache und Service Worker, CDP 1,6 Mbit/s Down, 150 ms, CPU 4×; 5 Läufe).

**Vorbemerkung:** `titles.json` (3,6 MB) wird beim Start schon nicht geladen — der Start holt `titles-core.json`, `releases.json`,
`events.json`, `meta.json` (alle als `preload`, gzip). Der Vorschlag heißt also konkret: diese drei Dateien durch einen
Wochen-Ausschnitt ersetzen und den Rest danach nachladen.

**Übertragene Bytes beim Start (gzip, 08.10.2026):** HTML 4,8 KB · `index-*.js` 191,9 KB · `index-*.css` 27,9 KB · Schriften 46,5 KB
(2 woff2, ohne Kompression) · `titles-core.json` 153,9 KB · `releases.json` 97,3 KB · `events.json` 65,7 KB · `meta.json` 3,7 KB
= **591,8 KB ohne Bilder** (Daten allein 316,9 KB = 54 %). Dazu **21 Bilder = 3.002 KB** (alle von AniList, 12 davon `large`; drei
PNG-Cover zu 553 / 541 / 504 KB) — die Bilder wiegen das 5-Fache von Code und Daten.

**Zeiten (Median von 5, nach Navigationsbeginn):**

| Messgröße | Wert |
|---|---|
| FCP (erst die statische SEO-Hülle) | 3,30 s |
| letzte Nicht-Bild-Datei fertig | 3,70 s |
| erste echte Wochenkarten sichtbar (`Details zu …`) | 3,77 s (3,70–3,89) |
| LCP (`H1 „Diese Woche"`, nur 1 von 5 Läufen meldete ihn) | 3,53 s |
| TBT | 250 ms (211–347) |
| CLS | **0,607** (alle 5 Läufe) — Hülle wird durch die App ersetzt, Budget 0,1 gerissen |
| erstes Karten-Bild im Sichtfeld fertig | 10,5 s (10,47–10,70) |

Die Rechnung passt zur Messung: 592 KB bei 200 KB/s = 2,9 s plus Round-Trips ≈ 3,7 s. Der Start ist bandbreitengebunden, nicht
CPU-gebunden (Lücke „letzte Datei → erste Karte" nur 20–190 ms).

**Wochen-Datei, gerechnet aus den echten Dateien** (Stand der Daten vom 08.10.2026, Woche 05.–11.10.: Events der Woche, deren
Releases, deren Titel; gzip Stufe 6, auf das Verhältnis der Live-Größen umgerechnet):

| Ausschnitt | Events / Releases / Titel | gzip |
|---|---|---|
| diese Woche | 87 / 42 / 39 | **≈ 30 KB** (Events 2,8 · Releases 12,2 · Titel 14,0) |
| Woche ±1 (3 Wochen) | 255 / 93 / 83 | ≈ 57 KB |
| 6 Wochen | 414 / 129 / 116 | ≈ 76 KB |

Start mit Wochen-Datei: 591,8 − 316,9 + 30,4 = **≈ 305 KB** statt 592 KB (−287 KB, −48 %). Mit dem an der Messung geeichten Modell
(Bytes / 200 KB/s + etwa 0,8 s Round-Trips und Ausführung) kommen die ersten Karten bei **≈ 2,3–2,5 s statt 3,8 s (≈ −1,4 s)**. Das ist
**gerechnet, nicht gemessen** (Playwright-Routen umgehen die CDP-Drosselung; ein echter Gegenversuch braucht einen Server mit dem Ausschnitt).
Danach lädt die volle Fassung im Hintergrund nach (+≈ 317 KB, davon ≈ 30 KB doppelt) — nötig für Wochenwechsel, Suche, Monatsansicht.

**Was die Wochen-Datei nicht löst:** Das erste Karten-Bild kommt erst nach ≈ 10,5 s, weil 3 MB Bilder um dieselbe Leitung laufen; das
verkürzt sich durch den früheren Start nur um dieselben ≈ 1,4 s. Größere Hebel stehen daneben: Bildgröße (Karten ≈ 173 CSS-px breit
ziehen bei 2× das `large`-Cover, PNG bis 553 KB), nur die Bilder im Sichtfeld mit Vorrang, CLS 0,607 der Hülle.

**Empfehlung:**
1. **Wochen-Datei zuerst lohnt**, aber als zweiter Schritt nach den Bildern: Bytes ohne Bilder −48 %, Karten ≈ −1,4 s, Kosten: zweiter
   Datenpfad, doppelte Konsistenzprüfung (`check:logic` muss Ausschnitt = Teilmenge des Ganzen zusichern) und ein Wochenwechsel vor
   dem Nachladen.
2. **Schwelle:** umsetzen, solange die ersten Karten auf Slow 4G / CPU 4× über **2,5 s** liegen (heute 3,8 s); nach dem Umbau muss die
   Messung ≤ 2,5 s zeigen, sonst zurücknehmen. Ein Gewinn unter 0,8 s rechtfertigt den zweiten Pfad nicht.
3. **Vorher** (billiger, größerer Hebel auf das sichtbare Ergebnis): Kartenbilder mit passender Breite (`sizes`), PNG-Cover
   vermeiden, nur Sichtfeld-Bilder vorrangig; CLS der Hülle auf < 0,1 bringen. Jeweils mit demselben Rezept nachmessen.

## Wochen-Datei zuerst umgesetzt (08.10.2026)

**Bau.** `bau/13-8-wochen-datei.ts` schneidet nach dem Titelrang `woche.json` aus `titles-core.json`, `releases.json`, `events.json` (Logik in `shared/wochen-datei.ts`):
Montag–Sonntag der Bauwoche (`todayIso()`, Europe/Berlin), dazu alle Releases der gezeigten Titel (`istPremiere` zählt über sie) und je Titel die letzte schon
erschienene Folge vor der Woche (`neuesteErschienen` für „N neu"). Reihenfolge der vollen Dateien bleibt. **Zusicherung** (Bau bricht ab, `check:logic` → `check-wochen-datei.ts`; der Teil am Bestand: `check-wochen-datei-bestand.ts` in `check:bestand`):
jeder Termin, jedes Release, jeder Titel steht byte-gleich in den vollen Dateien (auch nach der Übersetzung in `ak`), jeder Termin der Woche steht drin, jeder Termin hat Release und Titel.
Größe 30,9 KB gzip (166 KB roh; 107 Termine, 56 Releases, 39 Titel); der Repo-Zuwachs ist ein Tagesdiff dieser Größe, die veröffentlichte Seite wächst um dieselbe Datei.

**Start.** `lib/start-daten.ts` (`useStartdaten`): Die Wochenansicht holt `woche.json` + `meta.json` und rendert daraus; `data` ist die Wochen-Datei nur, solange sie reicht
(Wochenansicht, keine Suche, Anker **und** heute in ihrer Woche – sonst fehlten inzwischen erschienene Folgen). Panel, andere Ansichten, Suche, andere Wochen warten wie vorher
auf `voll` und lösen das Laden sofort aus; sonst beginnt es, sobald die Karten im Sichtfeld ihr Bild haben (spätestens 6 s), im Leerlauf, oder sofort bei Tippen/Scrollen/Taste.
Ein Skript im `<head>` (`tools/vite-vorladen.ts`) wählt per Adresse, ob `woche.json` oder die drei vollen Dateien vorgeladen werden, und meldet das als `window.__akWoche`.
Fehlt oder veraltet die Wochen-Datei, läuft der Start wie vorher. Bis die vollen Daten da sind, zeigt das Datumsfeld (`DatumSprung`, nur ab `sm`) nur die Zählung der Woche.

**Gemessen** (`ladegewicht-messung.mjs --lokal`, Handy 390 px, 1,6 Mbit/s + 150 ms, CPU 4×, Median von 5), vorher → nachher: erste Wochenkarten 3,60 s → **2,27 s** (−1,33 s);
erstes Karten-Bild 4,75 s → 2,84 s; Bytes bis zu den Karten (ohne Bilder) 568 → ≈ 295 KB gzip; TBT 673 → 568 ms; CLS 0 → 0; FCP/LCP-Element im Harness (Marke im Gerüst) 1,7 → 1,8 s.
Alle Nicht-Bild-Dateien fertig erst nach ≈ 11,8 s statt 3,1 s (Nachladen hinter den Bildern); Gesamtbytes ohne Bilder +33 KB (die Wochen-Datei). Ergebnis der Wochenansicht
Byte-gleich zum alten Build (`main`-HTML nach dem Nachladen, 173.450 Zeichen), einziger Unterschied zwischen frühem und spätem Stand ist das scrollabhängige `aria-current` am Heute-Knopf (auch im alten Build).

## Kachel-Datei: Wochenstart ohne Panel-Daten (25.10.2026)

`woche-kacheln.json` ist `woche.json` ohne alles, was der Start der Wochenansicht nie liest (`shared/wochen-kacheln.ts`, geschrieben in `bau/13-8-wochen-datei.ts` hinter `woche.json`):
Quellen und Kaufadressen der Releases, vier Namen und Banner je Titel, Wegadressen (außer bei kostenlosen Wegen: `kostenloseFolgen` liest Adresse und Fenster), Sendungstitel.
Termine bleiben ganz, `schedule` ebenfalls (Takt und verpasste Folgen lesen `observed`/`verpasst`). Die Listen sind **Abzugslisten**: ein neues Feld kommt von selbst mit, das Start-Budget zeigt ein Zuviel.
Belegt mit `node tools/kachel-felder-messen.mjs` (Proxys auf der Wochen-Datei, Lesezugriffe auch auf fehlende Felder, Bedienung auf Desktop und Handy, mehrere Wochen); Exit 1, wenn ein gelesenes Feld abgezogen wird.
`useStartdaten` ist unverändert: Panel, andere Ansichten und Filter holen die vollen Dateien (`loadDataset`) im Leerlauf nach dem ersten Bild oder sofort bei Bedienung; das Panel öffnet erst mit den vollen Daten.
Größe 25.10.2026: 18,0 KB statt 36,2 KB gzip, Start-Budget 293,0 → 274,8 KB (`tools/start-budget.mjs` auf zwei Bauten desselben Datenstands). `woche.json` selbst wird nur noch von Prüfungen und Werkzeugen gelesen; Folge: aus der Auslieferung nehmen.

## Bilder und CLS am Start behoben (08.10.2026)

Ursachen: (1) Die Wochenkachel (173 CSS-px) zog bei 2× AniLists `large` (460 px, als PNG bis 553 KB; AniList liefert kein WebP/AVIF, `medium` wiegt ~150 KB);
auch der Offline-Vorrat in `App.tsx` holte `large`. (2) CLS 0,607: Ohne Vorschau `startgeruest` rechnete die App erst eine leere Woche (7 Tage à 190 px)
und sprang beim ersten Ergebnis auf 9.200 px. Änderung: `coverBild(…, dichte)` mit `KACHEL_DICHTE = 1,5` (Kachel und Offline-Vorrat), und das Gerüst
(`useErstesErgebnis`) ist Standard; der Vorschau-Schalter ist seit 09.10.2026 entfernt.
Messung mit `tools/archiv/ladegewicht-messung.mjs --lokal=dist` (gebautes Verzeichnis, Leitung 1,6 Mbit/s nachgebildet, Median 2 Läufe), vorher → nachher:
Bilder 21 / 2.988 KB → 31 / 1.647 KB (die kleineren laden früher nach) · erstes Karten-Bild 7,5–9,5 s → 4,0–4,4 s · CLS 0,607 → 0 · Code+Daten unverändert 567 KB.

## Gleiche MAL-Kennung bei aniSearch- und AniList-Titeln: 27 Fälle, 4 echte Dubletten (08.10.2026)

**Anlass.** Die Cover-Messung (`quellen.md`, „AniList-Cover für aniSearch-Titel ohne Jahresgrenze") fand 24 aniSearch-Titel, deren MAL-Kennung (`data/anisearch-eintraege.json`, Feld `mal`) schon ein AniList-Titel trägt, 4 davon `isAdult`. **Nachgemessen** an `public/data/titles.json` (Titel ab 10000000 = nur bei aniSearch) und `public/data/ohne-synchro.json`: **27** solche aniSearch-Titel, davon 20 mit AniList-Titel im Hauptbestand, 7 mit AniList-Titel in `ohne-synchro`. Die Abweichung zu 24 liegt am Kriterium (der Lauf prüft gegen den Cache `aniBestand`, der lokal fehlt); die 4 Erwachsenen-Titel stehen nicht in den öffentlichen Daten und sind hier nicht prüfbar. Die Zuordnung hat der Bau nicht gewollt: Keiner der 27 trägt dieselbe `anisearchId` wie sein AniList-Gegenstück, außer Beerus und Fool Night (dort ist der Verweis gesetzt, die AniList-Seite liegt aber in `ohne-synchro`).

**Maßstab je Fall:** Folgenzahl und Starttermin beider Seiten, und wie viele aniSearch-Einträge dieselbe MAL tragen (summieren sie sich zur AniList-Folgenzahl, hat AniList zusammengefasst, was aniSearch teilt).

| Art | Fälle | Beleg am Datensatz |
|---|---|---|
| **Echte Dublette** (gleiches Werk, gleiche Folgenzahl, gleicher Start) | **4** — Psyren (aniSearch 21084, AniList 204011), Dragon Ball Super: Beerus (21566 / 206814), Hyouken no Majutsushi ga Sekai o Suberu II (21575 / 212503), Fool Night (21751 / 213457) | je 12 Folgen / Start 05.10., 11.10., 08.–09.10., 26.11.2026; AniList-Seite jeweils in `ohne-synchro`, der Titel steht im Hauptbestand nur über aniSearch (kein sichtbares Doppel, aber zwei Zeilen für ein Werk) |
| **Zweite Fassung** desselben Films (unsicher) | 1 — Kitarou Tanjou: Gegege no Nazo „Shinsei-ban" (19697 / AniList 130622, aniSearch 16981 ist der Film von 2023) | beide 1 Folge, Film 2023 gegen deutscher Termin 04.10.2024; im Hauptbestand stehen beide |
| **Teil eines AniList-Titels** (AniList fasst zusammen, aniSearch teilt) | **16** — Reporter Blues (3873; 8939 trägt die 2. Hälfte, 26+26 = 52 Folgen), Death Note R2 (5194), Aoyama Goushou Tanpenshuu 2 und Making of Meitantei Conan (5879, 10586; AniList 5578 = 7 Folgen), Angel Beats! Stairway to Heaven (6864), Durarara!! Tenmou Kaikai und Tenka Taihei (6984, 6986; AniList 8408 = 2), Kuroshitsuji II Making of und Ciel in Wonderland (6990, 6994; AniList 9136 = 6), Bikini Warriors (2016) (11635; AniList 87480 = 6), Pokémon XYZ-Special (11938; 11939 teilt die MAL), Kishibe Rohan Mutsukabezaka und Shinsaku OVA (13343, 14752; AniList 21778 = 4), Shikioriori zwei Filme (13418, 13419; AniList 101231 = 3), Hanma Baki Dai 2 Ki Oyako Kenka-hen (18616, 14 von 27 Folgen) | mehrere aniSearch-Einträge je MAL, Folgen und Daten liegen innerhalb des AniList-Titels |
| **Zwei Werke** (Special/Bonus unter der MAL der Serie) | **6** — Ookami to Koushinryou Bonus (6828), K-On!! Bangai-hen ×2 (7051, 7052) und K-On! Bangai-hen (7069), Arjuna Bonus (9303), Bikini Warriors „Figure dake de wa …" (13220, Art „Anderes") | aniSearch-Art `Bonus`/`TV-Spezial`/`Anderes`, AniList-Gegenstück ist die TV-Serie mit anderer Folgenzahl und Jahr |

**Folge für die Anzeige.** Bei den Teilen und den zwei Fassungen stehen im Hauptbestand beide Titel mit deutscher Fassung (`dub: d`): dieselben Folgen können als AniList-Titel und als aniSearch-Zeile auftauchen. Bei den Dubletten fehlt der AniList-Seite nur die Verknüpfung.

**Vorschlag (keine Datenänderung in diesem Eintrag).** (1) Die 4 Dubletten über `data/anisearch-ids-hand.yaml` an den AniList-Titel binden, damit der aniSearch-Titel entfällt, sobald der AniList-Titel in den Hauptbestand rückt. (2) Die 16 Teile und die zweite Fassung als Teil des AniList-Titels führen (Zuordnung statt eigener Zeile), erst nach Einzelprüfung der Folgenzahl. (3) Die 6 Zwei-Werke-Fälle bleiben eigene Titel; ihr Cover darf nie über die MAL der Serie kommen (`holeAnisearchCover` überspringt schon jede bekannte MAL). (4) Eine Zusicherung im Bau, die „aniSearch-Titel ohne `anisearchId`-Verknüpfung mit gleicher MAL wie ein AniList-Titel" zählt und bei Zunahme meldet. Messskript: Titel ≥ 10000000 gegen `malId` aller Titel in `titles.json` und `ohne-synchro.json`.

**Umsetzung der Dubletten (08.10.2026, Vorschlag 1 und 4).** Der AniList-Titel gewinnt: Er trägt MAL, Genres, Reihe und die Ankündigung; der aniSearch-Titel ist nur der Ersatz für „bei AniList nicht im Bestand" (`ergaenzeAnisearchTitel`). Die vier stehen jetzt in `data/anisearch-ids-hand.yaml` (204011 → 21084, 206814 → 21566, 212503 → 21575, 213457 → 21751); die fünfte, Bookworm Staffel 5 (217712 → 22017, 11.10.2026), steht weiter unten im Abschnitt „Dublette ohne MAL auf AniList-Seite".
- **Reihenfolge ohne Lücke:** `fetch.ts` holt den AniList-Titel in den Bestand (`ausAnisearchHand`, auch ohne Deutsch); die aniSearch-Zeile entfällt erst, wenn er in `titles` steht (die Handdatei sperrt wie `data/anisearch.json` nur dann, vorher unbedingt). Fehlt er, bleibt die Zeile — kein Werk geht verloren. Die Handdatei zählt auch für `anisearchUmgezogen` und `dubNurHinterToggle` (Verlust-Riegel).
- **Was mitwandert:** die deutsche Erstausgabe der aniSearch-Zeile (`erstausgabeUebernehmen`); der Tag in `data/synchro-historie.json` (sonst „neu mit Synchro" und eine Mail für Psyren und Hyouken); der Slug der automatischen Termine von Beerus und Fool Night (`ALTE_AUTO_KENNUNG` in `lib/meldungen.ts`: Teilen-Adresse `/r/auto-10021566-crunchyroll/` und Termin-Verlauf reißen nicht ab, sonst stünde „Termin zurückgezogen" in den News).
- **Zusicherung** (`check:logic`, `lib/mal-dubletten.ts`): gleiche MAL bei einem aniSearch- und einem AniList-Titel nur mit Eintrag in `MAL_AUSNAHMEN` (16 Teile, 6 Zwei-Werke-Fälle, dazu Kitarou Tanjou „Shinsei-ban" als unsichere zweite Fassung, nicht angefasst). Die vier Dubletten gelten bis 15.10.2026 als Übergang, bis der Bau mit der Handbindung gelaufen ist; danach wird `check:logic` rot, solange eine bleibt. Die aniSearch-Katalogtitel hinter dem Toggle prüft sie nicht.
- **Grenze:** Hyouken II startet bei AniList am 09.10.; bis dahin liegt der AniList-Titel (ohne Termin) hinter dem Toggle, die Zeile fehlt im Hauptbestand. Am Tag nach dem Start (ab 09.10.) steht er im Hauptbestand.
- **Eigene Kennungen (`ak`):** Die `ak` der vier aniSearch-Zeilen (seit 11.10.2026 fünf, mit Bookworm 26256) war öffentlich (Adresse `/t/<ak>/`, Favoriten, versandte Mail-Links). `data/kennungen.json` trägt dafür ein viertes Feld `zuAk` (Nachfolger): `akVon` übersetzt die alte Kennung in die des AniList-Titels (News-Verlauf, Meldungen, Reihen nennen nie die alte); `build-share-pages.ts` schreibt `/t/<alt>/` als Weiterleitung (`noindex`), `ak-umleitung.json` (`[[alt, neu], …]`) schreibt gemerkte Titel um — im Browser einmalig je neuem Paar vor dem ersten Rendern (`web/src/lib/ak-umleitung.ts`, Marke `kennung:umleitung`, höchstens 1,5 s Wartezeit), im Worker beim Lesen jeder Liste (`worker/src/favoriten-lesen.ts`). Dauerhaft, anders als die Karenz bis 05.11.2026. Eine künftige Dublette: Zeile in der Handdatei, `zuAk` an der alten Zeile, ggf. `ALTE_AUTO_KENNUNG`.
- **Probe am Bau (08.10.2026, Cache mit den vier AniList-Titeln, Basis gegen Zweig):** Titelzahl 2922 → 2920 (10021084 und 10021575 entfallen, Psyren 204011 trägt die Erstausgabe); Beerus und Fool Night behalten `auto-10021566-crunchyroll` und `auto-10021751-netflix` (ein Release je Plattform, `vergangen` im Termin-Verlauf leer, kein „zurückgezogen" in `news.json`). Ohne Slug-Erhalt stand dort für beide „zurückgezogen" und ein neuer Slug.

## Datenbank-Vorgabe „Relevanz" mit Gruppen (09.10.2026)

Ohne Suche startet die Datenbank in drei Gruppen: „Läuft jetzt", „Demnächst", „Schon erschienen" (Daniel, Variante C im
Mockup „Datenbank-Einstieg"). Die Regel steht in `web/src/lib/db-relevanz.ts`, die Reihenfolge in `db-liste.ts`,
die Zusicherungen in `pipeline/check-db-relevanz.ts`. Maßgeblich ist die deutsche Erstausgabe (`deErstausgabe`):
ein späteres Neuerscheinen bei einem weiteren Anbieter zählt nicht (Rooster Fighter, Id 179813 → erschienen);
ohne `deErstausgabe` bestimmt der früheste Nicht-Disc-Termin die Erstausgabe (Disc bestimmt nie „Demnächst"; liegt `von` vor dem frühesten Termin, ist sie vorbei, Toleranz 60 Tage; Einzelsendung im TV zählt nicht als „läuft"). Eine vierte, letzte Gruppe „Ohne bekannten Termin" fängt Status `unbekannt` ab.
Gemessen in der Seite am 09.10.2026 (App-Vorgabe mit Cartoons, 3.813 Titel): ungebündelt 21 / 34 / 2.852 / 906, gebündelt 21 / 31 / 1.538 / 900 Reihen; die 900 sind Cartoons ohne Release und ohne Synchro-Hinweis (vorher unter „erschienen", daher die alte Zahl 3.729). Je Datei ohne Cartoons (titles.json komplett, ungebündelt): 21 / 35 / 2.859 / 11. Mit Suche gilt weiter die Treffergüte;
`?sort=relevanz` ist jetzt immer gültig. Die Statuspille entfällt, wo die Überschrift sie schon sagt.

## Sprecher-Suche hinter der Vorschau `sprecher-suche` (08.10.2026)

Idee 2 aus [ideen-2026-10-08.md](ideen-2026-10-08.md). Quellen, Auflagen und Vollständigkeit: [quellen.md](quellen.md), Abschnitt „Sprecher-Suche: Datenquellen".

- **Laden:** `sprecher.json` (20 KB gepackt) kommt beim Fokus auf das Suchfeld oder bei einer Suche ab drei Zeichen — nie im Startpfad; die Rollen einer Gruppe (`sprecher/<buchstabe>.json`) erst beim Aufklappen eines Namens, die Titelnamen aus der schon gemerkten `titles.json`. Die Treffer-Komponente ist ein eigener Chunk (`SprecherTreffer.tsx`, `lazy`), die Standardansicht lädt ihn nie. Gesucht wird im Browser, keine Anfrage an Dritte.
- **Abgleich** (`web/src/lib/sprecher.ts`, `sucheSprecher`): jedes Suchwort muss im normalisierten Namen stehen (`shared/sprecher.ts`: Kleinschreibung, ä→a, ß→ss, Akzente weg); ganzer Name vor Wortanfang vor Teil, dann Titelzahl. Keine unscharfe Suche — ein Name ist eine Behauptung über eine Person. Höchstens 8 Namen, der Rest als „N weitere — genauer tippen".
- **Anzeige:** Gruppe „Sprecher" über den Treffern in Datenbank und Woche (`role="status"` sagt die Trefferzahl an), je Name ein Aufklapp-Knopf (`aria-expanded`/`aria-controls`, 44 px hoch), darunter die Titel mit Rolle als Sprung ins Panel, bei ANN-Rollen der Pflichtlink „ANN ↗". Genau ein Treffer mit vollem Namen klappt von selbst auf. Im Panel sind die Namen unter „Deutsche Stimmen" Knöpfe (`zurSprecherSuche`: Panel zu, `#/datenbank?q=<Name>`).
- **Was sie nicht tut:** keine Bewertung, keine Sprecher-Seite mit Biografie, keine Zusammenlegung von Schreibvarianten, kein Eintrag in `SUCHFELD_ARTEN` (das Fragezeichen am Suchfeld nennt „Sprecher" noch nicht — nachziehen, wenn Daniel die Vorschau freigibt).

## Sprecher-Filter der Datenbank (09.10.2026)

Ersetzt die Sprecher-Suche (Seite in PR 546 gelöscht); der Index aus dem Bau (`sprecher.json`, `sprecher/<buchstabe>.json`) bleibt. Freigabe und Verknüpfung (Daniel, 09.10.2026): eigener Filter in der Filterliste, **nicht** in der Suche.

- **Verknüpfung** (`lib/sprecher-auswahl.ts`, Zusicherung `check:logic` → `check-sprecher-filter.ts`): „mit"-Sprecher ODER, „ohne"-Sprecher UND, beides UND alle anderen Filter. Gespeichert wie die übrigen Listen (`FilterLists.sprecher`; Adresse `sp=` und `xsp=`, Namen, nur Datenbank — im Kalender weder gelesen noch geschrieben). Der Zähler am Filterknopf und „Sprecher (n)" in der Überschrift zählen mit und ohne.
- **Laden** (`lib/sprecher.ts`): beim Öffnen des Filterkastens nichts; `sprecher.json` (20 KB gepackt) erst beim Fokus im Feld; je gewähltem Namen und je sichtbarem Vorschlag die Gruppendatei (7–23 KB gepackt, einmal je Buchstabe zwischengespeichert). Steht ein Name in der Adresse, kommt nur seine Gruppe. Nichts davon in `titles.json`. Ein Fehlschlag bleibt nicht im Zwischenspeicher („Erneut versuchen" holt neu). Solange eine Gruppe fehlt, zeigt die Liste „lädt"/leer statt eines Bestands, der den Filter ignoriert.
- **Eingabe:** ab zwei Zeichen, entprellt (120 ms), höchstens 8 Vorschläge (Wortanfang vor Treffer im Wort), nur Namen aus dem Index; Vorschläge im Fluss der Seite (das Filterfeld scrollt selbst), Tastatur (↑ ↓ Enter Esc), Tippziele ≥ 28 px. Der Pfeil klappt die Titel auf und wählt nichts. Die Eingabe verlässt das Gerät nie.
- Der Filter erscheint nur, wo `SprecherLeiste` die Titelnamen bereitstellt (Datenbank).

## Rollbare Reihen auf dem Handy: `sr-only` braucht einen positionierten Vorfahren (08.10.2026)

Die Datenbank-Schalter rollen auf dem Handy seitlich (`overflow-x-auto`, Pillen `shrink-0 whitespace-nowrap`). Beim ersten Bau standen
Navigation und Filterleiste außerhalb des Bildes: Das `sr-only`-Checkbox-Input des Schalters ist `position: absolute`, und ohne
positionierten Vorfahren liegt es relativ zur Seite — bei der dritten Pille also bei x ≈ 580 px, außerhalb des rollbaren Kastens. Die
Seite bekam damit einen Überlauf von 594 px, und Chrome legt den Handy-Viewport (`isMobile`) dann so breit an (`innerWidth` 594 statt
390). `contain: inline-size`, `min-width: 0` und `overflow-x: hidden` ändern daran nichts; die Pille `relative` setzen schon.
Messen: `document.documentElement.scrollWidth` gegen `innerWidth` im festen 390-px-Fenster — `tools/ansicht-bild.mjs --handy` sieht es ebenfalls.
Gleiches gilt für jedes absolut positionierte Kind (Blase, Marke) in einer rollenden Reihe.

## Vergrößertes Cover zeigt ein anderes Plakat als das Panel (Ishura, 08.10.2026)

Daniel (18:20): Ishura (`/t/14933/`), Klick aufs Cover im Panel — ein anderes Bild als im Panel. Ursache: Das Panel zeigt das
AniList-Cover (`large`, 460 px, hier das Gruppenbild); die Vergrößerung blendet das TMDB-Plakat aus `synopses/<n>.json` (`cg`) darüber,
und `fetch-tmdb-poster.ts` wählt je Titel das **größte Hochformat** (japanisch vor schriftlos vor deutsch vor englisch) — bei Ishura
das Key Visual mit Totenschädel und Schriftzug 異修羅, ein anderes Motiv derselben Serie (TMDB 220286, Zuordnung stimmt). Keine Verwechslung
über MAL/aniSearch; die 1.833 Titel mit TMDB-Plakat sind alle so gewählt, wie oft das Motiv abweicht, war nicht gezählt.
Stichprobe (15 Titel, dHash 9 × 8 zwischen AniList `small` und TMDB `w92`): 6 gleiche Motive mit Abstand 4–16, 9 andere mit 23–38.

Behoben in der Seite (`detail/cover-gleich.ts`): Vor dem Überblenden werden beide Kleinstbilder (zusammen unter 10 KB, nur beim Öffnen)
per dHash verglichen; erst ab Abstand ≤ 18 kommt das große Plakat, sonst bleibt das AniList-Cover — unschärfer, aber dasselbe Bild.
Beide CDNs erlauben `crossOrigin` (geprüft mit `Origin`-Kopf). Besser und noch offen: im Bau unter allen TMDB-Plakaten das dem
AniList-Cover ähnlichste wählen (statt des größten) und `cg` nur dann schreiben — dann gibt es für mehr Titel ein scharfes gleiches Bild
und die Prüfung im Browser entfällt.

## TBT-Befund nach 501–503 und Plakat Dress-Up Darling (08.10.2026)

Messung ohne Netz auf den gebauten Ständen (Playwright, Seite aus `dist/` über `page.route`, Handy 390 × 844, CDP 1,6 Mbit/s × 4 als Ersatz für gzip, 150 ms, CPU 4×, Median von 5, 12 s): TBT vor 501 (`0e6bae771`) 260 ms, nach 501 258, nach 502 291, nach 503 271 ms; Desktop 348 / 323 / 320 / 366 ms — kein Sprung, Streuung ±40 ms. Die Live-Seite maß am selben Abend 393–507 ms (acht Läufe `perf.cjs`), nicht 0,9 s; der Wert 0,9 ließ sich nicht wiederholen. Lange Aufgaben (Handy, 4× CPU): erster Aufbau der Woche 4 Stück zu 60–250 ms (die 200+-ms-Aufgabe ist eine erzwungene Layoutberechnung durch `klebendeUnterkante()` beim Sprung zu heute), und eine Aufgabe 90–140 ms beim Einsetzen der vollen Daten (React-Neuzeichnen, kein `JSON.parse`). Letztere läuft jetzt als `startTransition` (Handy 90 → 55 ms, Desktop 95–140 → 91 ms).
Dress-Up Darling (AniList 132405): dHash-Abstand AniList-Cover gegen TMDB-Plakat = 16 (Schwelle 18, also gleiches Motiv). Die Live-Datei `data/synopses/21.json` (134.250 Byte) enthält den Eintrag 132405 samt `cg` nicht, die im Repo (152.179 Byte, `08bd2d45f`) schon — ohne `cg` gibt es kein großes Plakat. Ursache liegt im ausgelieferten Bestand, nicht an der Schwelle.

## Ein Werk, das auch Anime ist, ist kein Cartoon: Rooster Fighter (09.10.2026)

Daniel (08.10.2026, 23:55): „Rooster Fighter" stand zweimal im Bestand, als Anime (AniList 179813, `ak` 16072, MAL 59393, Disney+ mit Deutsch) und als
Cartoon (TMDB 259819, Disney+ ohne Deutsch-Angabe). Ursache: `fetch-cartoons.ts` holt alle TMDB-Serien mit Genre Animation und `schreibeCartoons()`
legt sie an, ohne den Anime-Bestand zu kennen. Regel (Daniel): Was AniList, aniSearch oder MAL als Anime führen, ist ein Anime.

Umsetzung: `pipeline/lib/cartoon-zwilling.ts` (reiner Vergleich), `pipeline/bau/cartoon-zu-anime.ts` (läuft nach `ohne-synchro.json`, damit nur ein
tatsächlich ausgelieferter Zwilling den Cartoon ersetzt). Belegt ist ein Zwilling über die TMDB-Kennung aus `tmdb-titles.json`, sonst über den vollen
normalisierten Namen; dazu immer Jahr (±1) und Folgenzahl (gleich oder ganzes Vielfaches, TMDB zählt Staffeln). Ein Cartoon hat keine MAL-Kennung; MAL und
aniSearch kommen über den Anime-Titel (`malId`, Titel `10_000_000+id`) ins Spiel. Passt Jahr oder Folgenzahl nicht, bleibt der Cartoon stehen und muss in
`ZWILLING_AUSNAHMEN` begründet sein. Der Umzug steht in `data/cartoon-umzug.json` (wächst nur) und wird in `ak-umleitung.json` zu `[Cartoon, ak]`: gemerkte
Cartoons (Browser) und `#/…?t=<Cartoon>` ziehen auf den Anime-Titel. Der Worker speichert nur positive Kennungen, dort ändert sich nichts.

Messung 09.10.2026 auf dem Datensatz von `main`: 919 Cartoons, 19 Zwillinge (Rooster Fighter, Devil May Cry, Terminator Zero, Ninja Kamui, Rick and Morty: The Anime,
Mech Cadets, Scott Pilgrim Takes Off, ONI, Tekken: Bloodline, Star Wars: Visions, Pacific Rim: The Black, Fena, Eden, Blade Runner: Black Lotus, Saint Seiya: Knights of the
Zodiac, YooHoo to the Rescue, Larva Island, Pac-Man and the Ghostly Adventures, Afro Samurai), 7 gleichnamige, aber andere Werke in `ZWILLING_AUSNAHMEN` (Bakugan ungeklärt).
Bei 9 der 19 fehlt dem Anime-Titel ein Anbieter, den der Cartoon nannte (Devil May Cry, Mech Cadets, ONI,
Pacific Rim, YooHoo, Fena, Blade Runner, Saint Seiya, Afro Samurai) — diese Anbieter übernimmt der Anime-Titel als Weg mit `herkunft: "tmdb"` und ohne Sprachangabe (Projektziel 4; `uebernehmeAnbieter`, Zusicherung in `check-cartoon-zwilling.ts`).
Der Vergleich nutzt nur ausgelieferte Dateien; Titel, die nur im AniList-Katalog liegen, sind erst dann Zwillinge, wenn `ohne-synchro.json` sie führt.

## aniSearch-Zeile und AniList-Katalogtitel: ein Werk, eine Zeile (09.10.2026)

Daniel fand „The Laid-Off Cheat-Granting Mage" zweimal in der Datenbank. Ursache: Die aniSearch-Zeilen (`data/anisearch-eintraege.json`, 8.261 Einträge) und der
AniList-Katalog hinter dem Schalter (`ohne-synchro.json`) kamen unabhängig voneinander in die Ausgabe; `anisearch.json` ordnet nur Titel zu, die einmal
abgerufen wurden. Gemessen am Datensatz von `main` (09.10.2026): **2.389 Paare** (gleiche MAL, Formatklasse, Jahr ±1, Folgenzahl gleich oder auf einer Seite offen), fast
alle Zeilen ohne Deutsch (`dub: '-'`) hinter dem Schalter; die Prüfung `malDubletten` sah sie nie, weil sie nur Zeilen im Hauptbestand mit AniList-Titeln in
`titles.json` vergleicht und die Ausgabe keine MAL an der Zeile trägt.

Regel (`pipeline/bau/anisearch-dubletten.ts`, aufgerufen aus `schreibeOhneSynchro`): Eine Zeile hinter dem Schalter entfällt zugunsten des Katalogtitels; steht
die Zeile im Hauptbestand oder trägt sie einen Termin (Beerus, Fool Night), entfällt der Katalogtitel. Zeilen mit Deutsch (`d`/`p`/`c`) und Zeilen aus `MAL_AUSNAHMEN`
bleiben (die Handdatei bindet sie); bei mehr als einem Treffer auf einer Seite wird nichts geraten. Die Kennung der entfallenen Zeile bekommt keine Umleitung
(`zuAk`), sie stand nur hinter dem Schalter. Zusicherung: `pipeline/check-anisearch-dubletten.ts` (Teil von `check:logic`; am Bestand `check-anisearch-dubletten-bestand.ts` in `check:bestand`), mit Übergang bis 16.10.2026, bis der
nächste Datenlauf den Datensatz neu gebaut hat.

**Cours (09.10.2026, Tougen Anki Nikko Kegon):** AniList führt 24 Folgen, aniSearch zwei Zeilen zu 12 (die zweite „… - Dai 2 Cour" ohne MAL). Gehen die Folgen der
Zeilen mit gleicher MAL, Formatklasse und Jahr (±1) in der Zahl des Katalogtitels auf, entfallen alle (`coursZeilen`); gemessen auf dem Bestand trifft das genau diese zwei.
Titel 15906 ist ein anderes Werk (MAL 50066); Tougen Anki Staffel 1 ist AniList 177474, aniSearch 19258, und die Suche findet ihn im Hauptbestand.

### Magical Explorer zweimal (09.10.2026, Nachtrag)

Daniel sah die Dublette nach dem Fix weiter: **Der ausgelieferte Bestand war seit dem 09.10.2026 00:26 nicht mehr neu gebaut worden.** Jeder Bestandsbau lief durch, wurde aber
mit „Bestand nicht übernommen" verworfen, weil `check:cr-zuordnung` „Titel nur bei aniSearch tragen keinen erratenen Weg" meldete: Seit #521 hängt der Cartoon-Zwilling
(`cartoon-zu-anime.ts`) TMDB-Anbieter (`herkunft: 'tmdb'`) an Anime-Titel, auch an aniSearch-Zeilen (Devil May Cry, Mech Cadets, ONI, Pacific Rim, YooHoo). Die Zusicherung
nimmt TMDB-Wege jetzt aus. Gemessen am Datensatz von `main`: 5.636 aniSearch-Zeilen, 2.568 Paare (1.342 über die aniSearch-Kennung des AniList-Titels, Rest über die MAL).
Zweite Lücke: aniSearch führt asiatische Web-Serien als „TV-Serie", AniList als ONA; `gleichesWerk` verglich die Formatklassen streng (Magical Explorer, Snow Eagle Lord 3,
Frontier Lord, Stepbrother …) — TV und ONA sind jetzt eine Klasse. Dritte Lücke: nur eine Gegenprobe auf dem Bestand, mit Übergang bis 16.10.; jetzt prüft der Bau selbst
(`anisearchZeilenDoppelt`, in `auslieferungsInvarianten`) ohne Übergang, dass keine Zeile ohne Deutsch neben einem AniList-Titel mit ihrer Kennung oder gleichem Werk steht.
Nach dem Bau (Näherung am Cache vom 09.10.): 2.848 Zeilen, 0 Paare. Offen und gewollt: 255 Zeilen ohne Deutsch bleiben unter gleicher MAL, weil Folgenzahl oder Format
abweichen (Mehr-Staffel, Specials: Japan Anima(tor)'s Exhibition 36 Kurzfilme, Wappi-chan 2 × 13 gegen 26); 34 Zeilen mit Deutsch warten auf die Handdatei (u. a. Rick and Morty: The Anime, Titipo 2, Ao Ashi 2).

### Undatierte Katalogeinträge veralten (The Boxer, 09.10.2026)

Der Katalog-Frischlauf holt das laufende und die kommenden Jahre sowie die jüngsten Kennungen. Ein Eintrag **ohne Startdatum mit älterer Kennung** (The Boxer,
163794, angekündigt) erreichte keiner der beiden Wege: Er blieb mit Platzhalter-Cover und falschem Herkunftsland (KR statt JP) stehen, obwohl AniList das Cover am
09.10.2026 nachgetragen hatte. 169 von 279 undatierten Ankündigungen haben eine Kennung unter 200.000. `frischeUndatierte` (`fetch-anilist-katalog.ts`) holt jetzt
in jedem Lauf alle Einträge ohne `start` nach Kennung (`id_in`, 50 je Abfrage). Offen: The Boxer ist laut anime2you (1058533, 1058606, 09.10.2026) ein Crunchyroll-Simulcast
im Original mit Untertiteln, Start unbekannt, keine Synchro genannt — für eine Ankündigung ohne Termin kennt `ankuendigungen.yaml` kein Feld (`omuAb` ist Pflicht und wird in
`vorDemStart`, `ankuendigungs-termin` und der Meldung als Datum gelesen).

## Lief nur noch früher im Fernsehen (09.10.2026)

Super Wings: Das Panel sagte „Kein Anbieter bekannt", die TV-Leiste kannte den Titel. Eine
TV-Pille ist ein Weg nur, solange eine Sendung läuft oder kommt (`tvAngabe`); ist alles vorbei,
zeigt das Panel statt der Leere den letzten Termin je Sender (`lib/tv-zuletzt.ts`,
`detail/tv-vorbei.tsx`) und „Lief zuletzt im Fernsehen — kein Termin in der Zukunft bekannt."
Nur wo sonst „Kein Anbieter bekannt" stünde (keine andere Pille); steht irgendein TV-Termin aus
oder läuft eine Sendung, entfällt die Anzeige. Stand 09.10.2026: 1 von 20 Titeln mit TV-Release
betroffen (Super Wings). Die Programmquelle hält nur den laufenden Tag, der Verlauf stammt aus
den bei uns gesichteten Terminen (`schedule.observed`, `sendungen`).

## Herkunftsland im Hauptbestand: `land` nur bei ≠ JP (09.10.2026)
Quelle ist `countryOfOrigin` aus AniList (Produktionsland, nicht die Vorlage); `titles.json` und
`titles-core.json` tragen `land` (zwei Buchstaben) nur, wenn es nicht JP ist, Kennungen ab
10.000.000 nie (Unbekannt, nichts raten). Zusicherung: `landFehler()` in `pruefung.ts` und
`check:herkunftsland`. Alt-Einträge ohne das Feld holt `nochOffen` in `fetch.ts` einmal neu
(Backfill im ersten CI-Datenlauf). Simulation auf dem Stand 09.10.2026: Hauptbestand KR 31,
CN 27 (Kern: CN 3, KR 1); gzip +431 B bzw. +38 B. Oberfläche folgt separat.

## TV-Premiere nur, wo sie belegt ist (09.10.2026)

Anlass: Super Wings (Staffel 1, deutsche Erstausgabe 25.01.2017) trug in der TV-Leiste PREMIERE und in den News „Erstmals mit deutscher Synchro". `istPremiere()` (`shared/tv-signale.ts`) liefert jetzt `true`/`false`/`undefined`: Premiere nur mit Beleg (Wikipedia-Erstausgabe der Folge ≥ Termin; Folge direkt hinter dem Bestand; Streaming-Termin der Folge erst nach der Sendung), Wiederholung nur mit Beleg, sonst **keine Aussage** — `tvPremiere` fehlt am Termin, keine Pille, im Newsletter unter „TV — Weitere Sendungen". Liegt die belegte deutsche Erstausgabe des Titels über ein Jahr zurück, zählt nur die Wikipedia-Erstausgabe der Folge. News: ein automatischer TV-Termin (`automatisch`) eines Titels mit früherer Erstausgabe zählt nicht als deutscher Start (`istKeinDeutscherStart`, wirkt in `neu-mit-synchro.json` und damit in News und Newsletter). `news.json` wird bei jedem Bau neu gebildet; die Super-Wings-Meldung vom 07.10. verschwindet beim nächsten Bau, bereits versendete Mails bleiben, wie sie waren. Gemessen auf dem Bestand vom 09.10.2026: 23 → 19 Premieren (nur Super Wings, 4 Termine), 1 von 14 „Neu auf Deutsch"-Meldungen entfällt. Zusicherung: `check:logic`, „Super Wings: …".

Nachtrag 09.10.2026: Der Bau (`schreibeTvAuskunft`, `pipeline/bau/10-termine.ts`) übergab `istPremiere` die Releases aller Titel statt nur des eigenen — fremde TV-Folgen mit gleicher Nummer machten jede Folge zur „Wiederholung" (gespeichert: 0 × true, 170 × false). Jetzt je Titel gruppiert wie in der Oberfläche; auf dem Bestand vom 09.10.2026 trägt der Bau 19 × true (Dragon Ball DAIMA Fg. 2–20), 147 × false, 4 × fehlend (Super Wings, Super RTL). Im Newsletter wandern die 19 DAIMA-Termine in „TV — Premieren" (mit Abzeichen), die 4 Super-Wings-Termine stehen ohne Aussage unter „Weitere Sendungen". Bekannte Grenze: Bei Erstausgabe über ein Jahr zurück zählt auch ein späterer Streaming-Termin (c) nicht als Beleg. Zusicherung: `check:logic`, „Bau: …".

## Fußzeile: „belegt“ heißt Stufe stark (09.10.2026)

Die Fußzeile nannte `titleCount` (alle Titel des Hauptbestands) „Anime mit belegter deutscher Synchro“, obwohl 786 von 2.926 nur auf einer mittleren oder schwachen Quelle stehen (Bestand 09.10.2026: very-high 1.529, high 611, normal 412, low 374). Jetzt: `meta.belegtCount` = Titel mit `dubConfidence` high oder very-high (= Belegstärke-Filter „≥ stark“; `zaehleBelegte`, `pipeline/lib/belegstaerke.ts`), der Rest „angekündigt oder wahrscheinlich“. Auf diesem Bestand: 2.140 belegt, 786 angekündigt oder wahrscheinlich. `belegtCount` wird wie die Release-Zahl erst in `13-5-kerndateien.ts` aus `titles.json` gesetzt; `zaehlworteStimmen` prüft es gegen die Datei (`check:invarianten`). Bekannte Grenze: „high“ umfasst auch zwei mittlere Quellen (aniSearch-Marke plus TV), nicht nur Handbeleg und Anbieter-Tonspur.

**Tonspur nur aus der Streaming-Availability-API (25.10.2026):** `dub: true`, das allein `data/motn.json` gesetzt hat (Netflix, `09-5-weitere-quellen.ts`; Vermerk `motnTon`, nicht in `titles.json`), zählt in `belegstaerke()` als mittlere Quelle statt als starke. Allein: normal; mit aniSearch-Marke, TV-Termin oder Forum: high; mit Handbeleg, Kartei oder anderer Anbieter-Tonspur wie bisher. Die 113 „Handbeleg ohne very-high“ des Analysten sind kein Fehler: keiner hat einen Handbeleg mit `dub: true`, es sind Adressbelege ohne Urteil (213 von 251 Titeln mit Beleg ohne Ton-Stream) oder ein `dub: false`.

## Datenschutztext folgt dem Datenfluss (09.10.2026)

`DatenschutzView` (`StaticViews.tsx`) sagte, Favoriten „verlassen dein Gerät nicht“. Tatsächlich gehen sie mit Newsletter-Abgleich (`newsletterSync.ts`, Worker `/favorites`, auch Kalender-Feed) und Web-Push (`push.ts`, Worker `/push/abo`, Endpunkt plus Favoriten, Push-Dienst des Browserherstellers) an den Worker. Dritthosts im Browser: AniList-Bilder, TMDB (schon bei Hover/Touch auf das Cover im Panel per `preconnect`, `cover-max.tsx`; größeres Plakat und w92-Vergleich beim Öffnen der Vergrößerung), YouTube-nocookie erst beim Abspielen (AniList-Listen-Import entfernt am 10.10.2026). Wer einen neuen Aufruf zu einem fremden Host oder neue Daten an den Worker einbaut, ergänzt den Text im selben Zug. Keine Rechtsprüfung; DSGVO-Pflichten unverändert.

## Saison-Ausblick: kommende Saisons nach Terminschärfe (09.10.2026)

Reiter „Ausblick“ der Saison-Ansicht (`SaisonAusblick.tsx`, Gruppenbildung `web/src/lib/saison-ausblick.ts`). Quellen: Hauptbestand (`jpYear`/`jpSeason`), `saison.json` und die eigene, erst im Reiter nachgeladene `saison-ausblick.json` (Bau: `pipeline/bau/saison-datei.ts`, Serien aus `ohne-synchro.json` nach der laufenden Saison, auch ohne Datum; Stand 09.10.2026: 364 Einträge, 12,5 KB gzip). Japan-Start steht so genau wie AniList ihn kennt (Tag, Monat, Saison, Jahr); die Gruppenüberschrift trägt Saison oder Jahr, die Karte nur Tag/Monat. Ein deutscher Termin erscheint nur, wo einer belegt ist (`estimated` → „voraussichtlich“); Anbieter sind die der Synchro oder der Synchro-Ankündigung. Nichts fällt weg: Titel ohne Saison stehen unter ihrem Jahr, Titel ohne jedes Datum unter „Ohne Termin“ (nur Namen, ohne Cover). Messung 09.10.2026 (Serien ohne Synchro, nach der laufenden Saison): 61 mit Monat, 64 mit Jahr, 239 ohne Datum; mit Tag nur die der nächsten Saison (in `saison.json`).

## Premiere und Premiere*: Handbeleg `premiere` am Release (10.10.2026)

Daniel, 10.10.2026: Ein Release, das erstmals auf einem Weg auf Deutsch erscheint, trägt „Premiere“; war die Fassung vorher schon auf Disc oder im Kino, trägt es „Premiere*“ mit Tooltip („Erstmals im Streaming auf Deutsch. Vorher nur auf Disc.“ / „… im TV …“ / „… im Kino.“). **Nur mit Handbeleg, nie abgeleitet** — nicht aus Abwesenheit eines früheren Termins, nicht aus „im Angebot seit“ (Beleg: Neuzugangsmeldungen sagen „erstmals“ nicht).

Feld am kuratierten Release: `premiere: { weg: tv|stream, quelle, vorher?: disc|kino, vorherDatum? }`. `quelle` muss in `sources` stehen; `vorher` verlangt ein `vorherDatum` (YYYY-MM-DD) vor dem Start des Releases; ohne `vorher` heißt die Anzeige „Premiere“. Prüfung `pipeline/lib/premiere.ts` (in `pruefeErgebnis`): Weg passt zur Plattform, Quelle in `sources`, kein früherer Nicht-Disc-Termin desselben Titels (am selben Tag zählt nur der andere Weg als früher). Der Bau warnt, wenn ein Handbeleg ohne `vorher` gegen eine ältere belegte deutsche Erstausgabe des Titels steht. Bau: `schreibePremiere` (`10-termine.ts`) setzt am Termin `premiere` (Streaming, nur der erste Termin des Releases) und `premiereVorher`; im Fernsehen gilt der Handbeleg in `istPremiere()` als gleichwertig zur Wikipedia-Erstausgabe (Fall (d), `tvPremiere`), eine belegte Wiederholung schlägt ihn (Warnung im Bau). Anzeige: `PremiereMarke` (Kachel, Monatsliste, TV-Liste), Fähnchen in der Pille, ICS-Beschreibung, Newsletter-Abzeichen im TV. Texte: `shared/premiere.ts`. Zusicherung: `pipeline/check-premiere.ts` (in `check:logic`).

Erster Eintrag: YAIBA: Samurai Legend, ProSieben MAXX ab 05.11.2026 (`weg: tv`, ohne `vorher`; Anime2You 1059541). Offen: Newsletter ohne eigene Sorte für Streaming-Premieren; Kandidaten Beelzebub (Netflix) und Bleach: Memories of Nobody (ADN) fehlen, solange keine Quelle „erstmals“ sagt (Bericht `daniel-zum-abarbeiten/berichte/premiere-nach-disc.md`).

## Nachleger-Zeilen im Antwortkasten (Daniel, 10.10.2026, Option 2)

Der Kasten zählt den weitesten Anbieter; „Nächste Folge“ zeigt nur Folgen, die nirgends erschienen sind (`ohneSchonErschienene`). Was ein anderer Anbieter noch nachlegt, steht darunter: je Anbieter eine Zeile „Netflix: Folge 16 am Sa 17.10.“ (höchstens drei, früheste zuerst; geschätzt „≈“, Uhrzeit nur wo geführt). Logik `detail/nachleger.ts` (`nachlegerJeAnbieter`, Test in `pipeline/check-zaehlung.ts`), Anzeige `detail/nachleger-zeilen.tsx` im `folgen`-Platz des Kastens. TV, Kino und Disc sind ausgenommen: Die TV-Pille nennt Folge, Tag und Uhrzeit schon selbst (Hell’s Paradise, ProSieben FUN 11./12.10.).

## Folgenblock in der Überschrift des Antwortkastens (Daniel, 13.10.2026)

Erscheinen mehrere **belegte** Folgen derselben Veröffentlichung am selben Berlin-Tag (`schedule.observed`, `estimated` fehlt, Nummern lückenlos), steht der Kasten im Plural: „Nächste Folgen (4–6) erscheinen in 3 Tagen, am Freitag den 16.10.2026.“, ebenso „Erste Folgen (1–3)“ und „Finale Folgen (10–13)“ (Finale: der Block deckt alles, was noch aussteht). Fortgeschriebene Folgen, Wochentakt, TV-Sichtung und Komplettabwurf („Alle N Folgen“) bleiben unverändert. Logik `detail/antwort-block.ts` (`folgenblockBis`, `folgenKopf`), Texte `lib/i18n-antwort.ts`, Test `pipeline/check-folgenblock.ts` (Fall: Avatar: Die sieben Häfen).

## Belege: je Aussage und Anbieter nur der stärkste (10.10.2026)

Daniel, Fall YAIBA: „Quellen 2" mit zwei gleich beschrifteten anime2you.de-Reitern; der zweite Artikel nannte den Titel nur im Nebensatz. „Der selbe Anbieter kann sich nicht selbst belegen."

- **Regel** (`pipeline/lib/beleg-anbieter.ts`, im Bau nach `belegeFuerAlle`/`messungenFuerFolgen`): je Meldung bleibt je Anbieter (Host ohne `www.`) und Typ ein Beleg. Typ ohne Typfeld aus dem Pfad (`shared/beleg-anbieter.ts`): Artikel, Kalender, Katalog, Feed, Seite; Artikel und Kalender desselben Hauses bleiben getrennt. Ein Artikelpfad (`/news/`) schlägt den Kalenderpfad: „simulcast" im Titel macht keinen Kalender; Kalender sind nur `…calendar`/`kalender`-Pfade und der ADN-Endpunkt `gw.api`.
- **Stärke:** (1) dem Titel gewidmet = Titelname, Teil vor dem Doppelpunkt oder Kennung steht im Adresspfad; (1b) belegt die Meldung eine Synchro (`neu`, `angekuendigt`), gewinnt der Artikel, dessen Pfad „synchro", „dub" oder „deutsch" nennt (Crunchyroll „deutsche-synchros" vor „anime-lineup"); (2) mehr Nachweisfelder (Fundstelle, Bild, Veröffentlichungs-, Ausgabedatum, Messung); (3) der ältere. Welche Angaben (Uhrzeit, Sender, Sprache) ein Artikel trägt, steht nur im privaten Artikeltext, nicht im Datensatz; deshalb zählt Stufe 2 Nachweise, nicht Angaben.
- **Spur:** Protokollzeile „Belege je Anbieter: N von M entfallen" mit fünf Beispielen. Zusicherung im Bau (Abbruch): nichts doppelt, keine Meldung ohne Belege, Zählung stimmt, höchstens 30 % entfallen (10.10.2026 gemessen: 88 von 607 = 14,5 %); dazu: eine Quelle, die vorher unter den Belegen stand, steht es nachher noch. Tests: `pipeline/check-beleg-anbieter.ts`.
- **Oberfläche:** teilen sich zwei Reiter den Namen, heißen sie „anime2you.de · Artikel 09.10." (`tabName` in `beleg-dialog.tsx`).
- `NewsMeldung.quelle` (die erste Quelle; der Newsletter verlinkt sie) rückt, wenn ihr Beleg entfällt, auf den behaltenen Beleg desselben Anbieters und Typs (Stärke vor Herkunft: sonst bliebe zu oft der Nebensatz-Artikel; 32 Meldungen, gemessen am 10.10.2026 auf dem main-`news.json`). Sieben Meldungen führen schon vor der Entdoppelung eine Quelle, die nicht unter den Belegen steht (Katalogseite statt Artikel/Kalender); die bleiben unberührt. Belegstärke (`dubConfidence`) hängt nicht an den Belegen der Meldung und ändert sich nicht.

## Dasselbe Werk ohne MAL: Dubletten Stufe 1 (10.10.2026)

Daniel: „Fokus auf keine doppelten Einträge mehr; Titel mit fehlenden Infos im Blick behalten und regelmäßig befüllen." Anlass: „Yomi no Tsugai Dai 2 Ki" (aniSearch 21973, keine MAL) neben „Yomi no Tsugai 2nd Season" (AniList 217013). `gleichesWerk` brauchte die MAL. Bericht: `daniel-zum-abarbeiten/berichte/dubletten-und-luecken.md`.

- **Regel** (`pipeline/bau/werk-doppelt.ts`): Zeile ohne Deutsch (`dub: '-'`) und AniList-Katalogtitel sind **sicher** dasselbe Werk, wenn Format (TV = TV_SHORT = ONA), Jahr (±1; 0 und leer = offen), Folgen, Staffelzählung (`staffelNummern`: „2nd Season", „Staffel 2", „Dai 2 Ki", „第2期", angehängte Ziffer) und MAL nicht widersprechen, der Titel keine andere aniSearch-Kennung trägt, **und** aniSearch es belegt: ein Synonym der Zeile ist ein Name des Titels (oder Reihenname + „Staffel N" mit der Nummer des Titels), oder die Zeile hängt als Prequel/Sequel an einem Teil derselben Reihe und trägt dieselbe Staffelnummer. Nur der gleiche Name (Native oder voller Name): **wahrscheinlich**, es wird nichts versteckt (Daniel, 10.10.2026, umkehrbar). Mehr als ein Partner auf einer Seite: nie sicher.
- **Bau** (`werk-doppelt-bau.ts`, aufgerufen aus `schreibeOhneSynchro`): Die Zeile entfällt, der Katalogtitel trägt ihre aniSearch-Kennung; steht die Zeile im Hauptbestand oder trägt einen Termin, entfällt der Katalogtitel. Keine `zuAk`-Umleitung, solange die Zeile nur hinter dem Schalter stand (wie bei den 2.400 Zeilen des 09.10.); hatte sie schon eine öffentliche `ak` (Bookworm 26256, 11.10.2026), setzt derselbe PR `zuAk` in `data/kennungen.json`. Die Prüfliste `data/dubletten-pruefliste.json` entsteht nur bei Änderung.
- **Zusicherung** (`auslieferungsInvarianten`): ein sicheres Paar in der Ausgabe macht den Bau **rot**; mehr wahrscheinliche Paare als `data/dubletten-grenze.json` (von Hand, darf nur sinken) nur eine **Warnung** (Protokoll und `data/meldungen-an-claude.jsonl`), kein Abbruch: Neue Namenspaare kommen täglich, ein Teil ist nie belegbar (Prüferbefund 10.10.2026). Ausnahmen: `MAL_AUSNAHMEN`. Nicht erfasst: Zeile–Zeile (Bericht: 1 Paar), AniList–AniList (7 Paare) und ein Titel im Hauptbestand gegen eine Zeile im Katalog (kein Fall gemessen).
- **Daten:** `data/anisearch-eintraege.json` trägt `syn` (höchstens fünf Synonyme, je höchstens 80 Zeichen) und `rel` (nur Prequel/Sequel als `{Kennung: Art}`). Abruf unverändert `/v1/anime/<bis 10 Kennungen>?lang=de` (Antwortfelder `synonyms`, `related.anime`); `fetch-anisearch-eintraege.ts` holt sie für vorhandene Zeilen ohne Deutsch nach (Prüfliste zuerst, dann jüngste Kennung zuerst, im Rahmen von `--limit`, 400 je Lauf). 450 Einträge nachgeholt: Datei 1.853.747 → 1.876.393 Byte (+50 Byte je Eintrag); hochgerechnet auf die 8.089 Zeilen ohne Deutsch rund +0,4 MB.
- **Messung am Bestand von `main` (10.10.2026):** 45 Zeilen mit gleichem Namen wie ein Katalogtitel; mit Synonymen/Beziehungen von 450 Zeilen sind 11 sicher (von Hand geprüft: 11 von 11 echt), 36 bleiben wahrscheinlich (meist koreanische/chinesische Titel ohne Synonym).
- **Lücken:** `data/luecken-titel.json` (Bau, nur bei Änderung): je Titel die fehlenden Felder `t` deutscher Titel, `j` Jahr, `c` Cover, `m` MAL, `b` Beschreibung (nur Hauptbestand), getrennt nach `hb`, `kat`, `zeilen`; `zaehler` zählt je Feld. Der tägliche Auffüll-Lauf (Quellen nach Reihenfolge des Berichts, Abschnitt 3C) ist die nächste Stufe.

## Zweitanbieter: Marke im Bau, Zeile unter dem Raster (11.10.2026, Daniel wählte Variante B)

`shared/zweitanbieter.ts` setzt im Bau `zweitanbieter { erster, seit, mindestens? }` an Streaming-Termine, wenn dieselbe Folge (AniList-ID, Film = Folge 1) bei einem anderen Streaming-Anbieter ≥ 7 Tage früher erschien (10.10.2026: 68 Termine; seit 11.10. ohne die 30 ohne Folgennummer, Katalog/Batch: „Im Angebot seit“ ist nicht „erschienen am“, es bleiben 38 aus 2 Titeln). TV, Disc, Kino außen vor; ein Handbeleg „Premiere“ schlägt die Marke. Die Wochenansicht (Handy und Desktop) zeigt diese Termine nicht als Kachel, sondern als Zeile unter dem Raster (`kalender/ZweitanbieterZeilen.tsx`): „Neu auf <Zweitanbieter> · erschien zuerst auf Deutsch bei: <Erster>“ (Wortlaut Daniel); der Zähler im Tageskopf zählt sie weiter mit. Ausblenden: Schnellfilter „Zweitanbieter“ im Modus Ausschließen (`zweitanbieterExcluded`, Vorliebe im Browser). Der Monat zeigt sie unverändert als normale Einträge der Zelle (kein Raster mit Covern, keine Dopplung).

## Folgenzahl der Pille: Belegtes ohne, Abgeleitetes mit „≈“ (11.10.2026)

Grundlinie `tools/datenqualitaet-messen.mjs` vom 11.10.2026: Im Hauptbestand stand an 1.165 von 1.488 Serien-Wegen „N Fg.“ ohne Beleg am Weg. Quelle der Zahl ist dort `Title.episodes` (AniList `media.episodes`, `titleFromMedia`), angezeigt in `folgenAuskunft` letzter Zweig: Haken, keine deutschen Bereiche am Weg, Serie deutsch abgeschlossen (`abgeleiteteFolgen`). Das ist die Annahme „alle Folgen liegen dort auf Deutsch“, kein Beleg. Seitdem trägt diese Zahl „≈ N Fg.“ (`ungefaehr()`, derselbe Weg wie die „≈“ am Release mit `episodeCountAssumed`).

Belegt bleiben ohne „≈“: Bereiche am Weg (Anbieter-API, Handbeleg, Erweiterung), Wochenplan des Anbieters (gezählte Termine; ruhen erschienene Folgen nur auf fortgeschriebenen Terminen, `estimated`, trägt die Spanne „≈“, `planGeschaetzt` — 12.10.2026: 3 von 741 Bereichs-Pillen; offen: 1 Pille mit belegtem Bereich plus fortgeschriebenem Plan, dort ist die Herkunft je Folge nach dem Zusammenführen nicht mehr trennbar), Joyn (hat eigenes „≈ Fg. …“). Releases tragen ihre Annahme schon im Bau (`schedule.episodeCountAssumed`: 12er-Standard, aniSearch „geschätzt“). Zusicherung `pipeline/check-folgenzahl-kennzeichnung.ts` (`check:logic`): jede Pille mit Zahl hat Bereiche, Wochenplan oder „≈“. Messwerkzeug: Klasse „abgeleitet“ = Text mit „≈“ (vorher fälschlich „plan“ bei weekly-Release, dessen Lauf beendet war: 62 Crunchyroll-Wege).

## Cover: TMDB, sonst AniList, sonst keins (11.10.2026, Daniel)

- **Regel** (`pipeline/lib/cover-quelle.ts`, gesetzt von `bau/cover-regel.ts` vor `baueMeta` und in `schreibeOhneSynchro` für den Katalog): TMDB-Plakat des Titels (`data/tmdb-poster.json`, als `w500`), sonst das bisherige AniList-Cover, sonst kein Cover (Platzhalter). **aniSearch-Cover werden nicht verlinkt** (Hotlink nicht erlaubt; Daniel, 11.10.2026).
- **Suche** (`lib/tmdb-plakat-suche.ts`, Teil von `fetch-tmdb-poster.ts`, `--katalog N`, Standard 600 Titel und 12 Minuten je Lauf, 5 Suchen gleichzeitig): für jeden Titel ohne TMDB-Plakat und ohne vermerkten Grund. Reihenfolge: erst Titel ohne jedes Cover, dann Hauptbestand, dann Katalog. Filme unter `/search/movie`, alles andere unter `/search/tv`, mit englischem, Romaji-, deutschem und japanischem Namen nacheinander; angenommen wird nur ein Treffer mit gleichem Namen (`passtFilm`), Genre Animation und Jahr höchstens um eins daneben, bei zwei gleich nahen Werken keiner (`lib/tmdb-suche.ts`, `urteilTreffer`). Lieber kein Cover von TMDB als ein falsches.
- **Gründe** (`data/tmdb-poster-grund.json`): `kein Treffer`, `unsicher` (Name gleich, Jahr oder Genre nicht belegt), `mehrere Kandidaten`, `kein Plakat`. Die Liste zum Prüfen von Hand schreibt der Sammler nach `daniel-zum-abarbeiten/listen/cover-ohne-tmdb.md` (`lib/cover-liste.ts`).
- **Stichprobe vor dem Bau** (11.10.2026, Titel ohne Cover, jeder 22. von 3.394): 150 Titel, 49 sichere Treffer (33 %), 29 mit Hochformat-Plakat (19 %); fünf Gegenproben von Hand (Bild gegen Titel) stimmten.
- **Erster Vollauf lokal** (11.10.2026, 5 Suchen gleichzeitig, rund 11 Titel je Sekunde, 18.523 Titel in 20 Minuten, 0 Fehler): Titel ohne jedes Cover 2.605 gesucht, 308 mit Plakat (12 %); Titel mit AniList-Cover 15.918 gesucht, 6.358 mit Plakat (40 %); zwölf Paare (AniList-Cover neben TMDB-Plakat, Katalog, jeder 528.) alle dasselbe Werk. Gründe ohne Plakat: 9.844 kein Treffer, 1.159 unsicher, 909 kein Plakat, 19 mehrere Kandidaten. Stand danach (20.719 Titel): 8.737 TMDB, 9.611 AniList, 2.371 ohne Cover — alle 2.371 sind reine aniSearch-Titel (Kennung ab 10.000.000, kein AniList-Eintrag).

## Synchro-Beleg am kuratierten Termin und Quellen im Panel (11.10.2026)

Anlass: „Avatar – Die sieben Häfen" (Cartoon -284833, Paramount+) hatte die Synchro nur in `note`/`sources` des Termins — kein Haken, kein Neuigkeitsbereich.

- **Haken ohne Handeintrag:** Ein Termin in `data/curated/*.yaml` mit `anilistId` trägt `dub: true`, `dubQuelle` (eine seiner `sources`), `dubZitat` (der Satz, wörtlich, bejahend, nennt „Synchron…" oder „auf Deutsch") und `dubGeprueftAm`. `loadDubChecks()` macht daraus denselben Beleg wie aus `dub-confirmed.yaml` (`pipeline/lib/dub-aus-terminen.ts`, Zusicherungen `check-dub-aus-terminen.ts`, harte Prüfung in `data:validate`). Ein Handbeleg zum selben Anbieter hat Vorrang; fehlt ein Feld, gilt der Termin als unbelegt. Nur Stream-Termine (nicht TV, Kino, Disc). Wo kein Artikel die Synchro wörtlich nennt: Handbeleg in `dub-confirmed.yaml` (negative Kennung für Cartoons, mit `url`).
- **Cartoons in den Neuigkeiten:** `baueNews()` bekam bis dahin nur die Anime-Titel; Termine von Cartoons fielen heraus. `cartoonsAusReleases()` (`bau/cartoon-kern.ts`) reicht die Cartoons mit Termin nach. Die Quellen kommen wie bei jedem Termin aus `sources`/`quellen` (`belegeVonRelease`).
- **Panel:** Die Start-Meldung eines Termins (`angekuendigt`, `disc`, `kino`) fiel nach dem Starttag aus dem Neuigkeitsbereich. Sie bleibt, solange die Serie läuft (`schedule.lastEpisodeDate` ≥ heute), damit die Quellen sichtbar bleiben.
- **Eigene Serien einer Reihe:** `data/cartoon-eigene-serien.yaml` (ids, grund, https-Quelle) setzt `FranchiseMember.eigenesWerk`; `hauptstaffeln()` zählt sie nicht, das Panel zeigt sie unter „Eigene Serien" (Korra und Die sieben Häfen neben „Der Herr der Elemente", Beleg Wikipedia).
- **Zusicherungen:** `check-cartoon-news.ts` (Cartoon-Meldungen nur Termin-Arten — auch `rhythmus`, belegt aus Handbeleg —, mit Quelle und Belegen), `check-neuigkeiten-panel.ts` (läuft: Start-Meldung bleibt; beendet, ohne Ende, unbekannter Slug: weg).
- **Offen:** Netflix-Meldungen zu „Der Herr der Elemente" (Buch 1–3) lassen sich noch nicht zuordnen, Spezifikation: `daniel-zum-abarbeiten/berichte/zuordnung-ueber-episodentitel.md`.

## Handbelege mit Folgenbereich im Wortlaut tragen `dubRanges` (11.10.2026)

`fetch-pruefungen.ts` lässt `dubRanges` weg, wenn ein Bereich die ganze Staffel deckt (`ganz`). Die Folge: Belege wie Cowboy Bebop/Netflix („Folgen 1–26 mit deutschem Ton“) trugen die Zahl nur im Text, und die Pille stand mit „≈“. Am 11.10.2026 sind 286 solcher Belege in `data/dub-confirmed.yaml` nachgetragen (252 Wege wechseln von „≈“ zu belegt, gemessen mit dem Code aus PR 789). Nur bei eindeutigem Wortlaut („Folgen a–b mit deutschem Ton“, „alle N Folgen geprüft“) und wenn die Zahl zur AniList-Folgenzahl passt; ausgelassen sind Kanal-Titel (424), anderer Zuschnitt (193), Filme (43), Zuordnung nur nach Seitentitel (22), laufende Serien (7). Bei „ANGENOMMEN aus Randprobe“ steht `checked` nur mit den gemessenen Folgen.

## Cartoons: `staffeln` am Titel (11.10.2026, Teil 1 von 3)

- **Feld:** `Title.staffeln: [{nr, folgen, start?}]` plus `staffelnQuelle: 'justwatch' | 'tmdb'` (Typ `shared/cartoon-staffeln-typ.ts`), nur in `cartoons.json`. Ohne Staffel 0 („Extras“). `tmdb` = „laut TMDB“ (Fremddaten), `start` kommt immer von TMDB und nur, wo TMDB dieselbe Nummer mit derselben Folgenzahl führt.
- **Quellen, in dieser Reihenfolge:** JustWatch (`data/justwatch-audio.json`, `staffeln[].folgen` = `totalEpisodeCount`, derselbe Abruf wie der Ton je Staffel, auch `data:justwatch-cartoons`), sonst TMDB (`data/cartoons.json`, `seasons[]` aus dem bisherigen Abruf, `STAND` 3). Regel und Tests: `pipeline/lib/cartoon-staffeln.ts`, `check-cartoon-staffeln.ts`; Bau: `pipeline/bau/cartoon-staffeln.ts`.
- **Prüfliste** `data/cartoon-staffeln-pruefliste.json` (`titleId`, `titel`, `quelle`, `gruende[]`): Quellen widersprechen sich (JustWatch gewinnt trotzdem) oder die Staffelsumme liegt mehr als 3 neben der Gesamtfolgenzahl.
- **Messung 11.10.2026** (JustWatch-Lauf für alle Cartoons, TMDB-Neuabruf): 914 von 920 Cartoons mit Staffeln (811 JustWatch, 103 TMDB), 337 auf der Prüfliste (335 Widerspruch, davon 216 gleiche Staffelzahl mit anderer Folgenzahl, 54 nur andere Staffelzahl, 65 beides). Jack: JustWatch falsch (S1 10 statt 1), PJ Masks: TMDB falsch (1 Staffel statt 7) — beide stehen auf der Liste. `cartoons.json` wächst um 134 kB roh, 21 kB gzip.

## Weg aus einem sicheren Kalendertermin (11.10.2026)

Ein Titel mit sicherem Termin (nicht `estimated`, mit `sources`) bei einem Streaming-Anbieter trägt dort einen Weg, auch ohne Tonurteil: `streams[]` mit `herkunft: 'termin'`, `dub` fehlt (ein Termin ist kein Tonbeleg). Adresse nur, wenn `platformUrl` eine Titelseite ist; Suche und Startseite sind keine, dann `url: ''` (Chip ohne Verweis, wie bei Cartoons). Gebaut in `pipeline/bau/11-7-wege-aus-terminen.ts`, ganz am Ende von `schliesseWegeAb`; der Bau bricht ab, wenn danach ein sicherer Termin ohne Weg bleibt oder ein Termin-Weg `dub` trägt. Bewusst entfernte Verweise (`verweiseEntfernt`) kommen nicht zurück. Am Bestand vom 11.10.2026: 31 Wege (Disney+ 9, Prime 9, ADN 7, Netflix 3, Joyn 2, RTL+ 1), 24 ohne Adresse.

**Weg aus einem Handbeleg bei Titeln nur bei aniSearch (14.10.2026):** `schliesseWegeAb` leert die Wege dieser Titel (Kennung ab 10 Mio.), weil der Name sie nur erraten hätte. Ein Handbeleg „deutsch“ (`dub: true`) mit Adresse ist belegt und bleibt, mit `herkunft: 'handbeleg'` (`lib/handbeleg-weg.ts`, Zusicherung `check-handbeleg-weg.ts`); ein Nein, ein Beleg ohne Adresse oder eine andere Adresse tragen keinen Weg. Beleg: Durarara!! Tenka Taihei (Crunchyroll, Daniel 13.10.2026).

## Cartoons: Wege je Staffel (11.10.2026, Teil 2 von 3)

- **Regel** (`pipeline/lib/cartoon-wege.ts`, Bau `pipeline/bau/cartoon-wege.ts`): Ein Cartoon-Weg wird auf die Staffeln verteilt, wenn der Titel mindestens zwei Staffeln hat, nicht auf der Prüfliste steht **und mindestens eine Staffel einen Haken oder einen JustWatch-Hinweis trägt** (sonst bliebe nur „der Anbieter hat die Serie“ in n Pillen; Entscheidung 11.10.2026): ein Weg je Staffel mit `teilBereich` in **durchlaufender Zählung** (Jack: 1, 2–11, 12–21). Die Teilbereiche eines Anbieters ergeben genau die Staffelsumme.
- **Häkchen** je Staffel nur aus einem Handbeleg mit `dubRanges` (durchlaufend, auf die Staffel beschnitten); eine Staffel, zu der der Beleg schweigt, bleibt ohne Urteil. Ein Handbeleg ohne Bereiche (Barbie: 12 von 110 Folgen) hält den Weg ganz. JustWatchs Ton je Staffel setzt nie `dub`, nur `dubQuelle: 'justwatch'` + `dubStand` — und nur, wo auch die Staffeln von JustWatch stammen (bei TMDB-Staffeln können die Nummern abweichen).
- **Handbeleg gewinnt bei den Staffeln:** `staffeln: [{nr, folgen}]` im Eintrag von `data/dub-confirmed.yaml` schlägt JustWatch und TMDB (`staffelnQuelle: 'handbeleg'`, keine Prüfliste). Erster Fall: Jack der Monsterschreck (JustWatch 10/10/10 falsch, Netflix 1/10/10).
- **Panel:** `wege-sortieren.ts` fasst zwei Pillen nur noch zusammen, wenn auch der Ausschnitt gleich ist, und die Pille trägt ihn im Schlüssel; vorher blieb von vier Prime-Pillen eine mit „Flg. 1–26“ stehen. Ein verteilter Weg zeigt eine Pille je Staffel; die gefaltete Darstellung ist Teil 3.
- **Prüfung:** `check-cartoon-wege.ts` (Teilbereiche lückenlos = Staffelsumme, kein verteilter Weg ohne Haken oder Hinweis in einer Staffel, kein Cartoon-Häkchen ohne Handbeleg, JustWatch-Hinweis nie mit Urteil).

## Cartoons: Wege im Panel falten (14.10.2026, Teil 3 von 3)

- **Befund** (`public/data/cartoons.json`, 14.10.2026): 106 Cartoons haben Wege je Staffel, bis zu 56 Pillen (Om Nom Stories 28 Staffeln, Ninjago 32, Little Angel 17). Staffeln stehen bei 895 von 903 Cartoons (763 JustWatch, 131 TMDB, 1 Handbeleg), 305 auf der Prüfliste; deren Wege bleiben ganz, das Panel behauptet dort keine Staffel.
- **Regel** (`web/src/components/detail/wege-falten.ts`, aufgerufen in `wege-sortieren.ts`): anschließende Teilwege (`bis + 1 = von`) mit gleicher Adresse und gleicher Aussage (Zugang, Urteil, Hinweis, Haken-Bereiche) sind eine Pille; Om Nom Prime: 28 → 3. Jack bleibt dreigeteilt, weil jedes Buch seinen eigenen Haken trägt. Der Daten-Bau ist unverändert.
- **Anzeige:** „Staffel 1–2 · Flg. 1–98" nur, wo der Ausschnitt genau Staffelgrenzen der Titel-`staffeln` trifft (sonst nur „Flg."); `staffelnQuelle: tmdb` heißt „Staffel 1 (laut TMDB)".
- **Eine Angabe, eine Stelle** (Nachbesserung 14.10.2026): Nennt die Folgenangabe der Pille („Fg. 2–11", aus den Haken-Bereichen) schon denselben Bereich, entfällt „Flg." (Jack: „Fg. 2–11 · Staffel 2", vorher „Fg. 2–11 · Staffel 2 · Flg. 2–11"); ein einzelner Teilweg heißt „Flg. 1", nicht „Flg. 1–1". Om Nom bleibt unverändert (Bilder vorher/nachher byte-gleich).
- **Prüfung:** `check-cartoon-wege-falten.ts` (Regel, Mutationen: Hinweis, Haken-Bereiche, Anschluss, Zugang, Kanal, Entfernt-am, geteilte Adresse, Haken, Stand, Staffelgrenzen, TMDB, Folgenangabe) und `check-cartoon-wege-falten-bestand.ts` (Om Nom höchstens 12 Pillen, Jack 3 Netflix-Pillen mit Haken; die Zeilen aus `streamZeilen` mit Jack und Om Nom: Staffel und Folgen je einmal, Tooltip nennt den Ausschnitt). `tools/panel-messen.mjs` misst Jack und Om Nom mit.

## Geteilte Crunchyroll-Seiten: Folgenbereich je Titel (11.10.2026)

- **Problem:** Mehrere unserer Titel zeigen auf dieselbe Crunchyroll-Serienseite (Re:ZERO Staffel 2 = 25 Folgen, bei uns 13 + 12). `bau/09-7-cr-bereiche.ts` überspringt solche Seiten (`sharedWith`); 284 Wege mit Haken standen ohne Bereich (Messung `tools/datenqualitaet-messen.mjs`, Spalte „teilt, de ohne Bereich“, vorher 412 über alle Anbieter im Hauptbestand).
- **Lösung:** `bau/09-7-cr-teilseiten.ts` + `lib/cr-teilseiten.ts`, ohne Abruf: die Folgenliste jeder Seite liegt in `data/crunchyroll-raw/<Serie>.de.json.gz` (deutsche Fassung = `versions` mit `de-DE`). Je Titel ein Fenster auf der Seitenliste: (1) Titelabgleich der aniSearch-Folgentitel (`folgenZuTitel` aus `episodentitel-block.ts`), mindestens 80 % unserer Folgen eindeutig, der Versatz darf im Lauf der Staffel nur wachsen (eingeschobene Zusammenfassung wie bei SAO Alicization); (2) sonst die Folgenzahl: eindeutige Zuordnung gleich großer regulärer Staffeln in derselben Reihenfolge, oder Summe geht genau auf und die Größen stehen nicht nur anders sortiert da; OVA-/Special-/Film-Blöcke zählen nicht. Titel und Zahl widersprechen sich, Fenster überlappen oder ragen über die Seite: keine Zuordnung, Grund in `data/cr-teilseiten-pruefliste.json`.
- **Nummerierung:** `dubRanges` zählt wie überall **unsere** Folgen ab 1 (nicht die der Seite): AoT Staffel 3 Teil 2 steht als 1–10, sein Fenster auf der Seite ist „Season 3 Folge 50 bis 59“. Geschrieben werden nur die deutschen Folgen (wie `setzeCrBereiche`), Lücken bleiben Lücken.
- **Messung (Bau-Vergleich, Ersatz-Cache):** 200 Crunchyroll-Wege bekommen einen Bereich (182 über Titel, 18 über die Zahl; 197 davon ganze Staffel), 128 stehen auf der Prüfliste (Bau-Stand inkl. Katalog-Titel: 60 Folgenzahl passt nicht, 28 keine zählende Staffel, 14 mehrere gleich große Staffeln, 11 kein TV-Titel ohne Treffer, 10 Widersprüche oder Überlappungen, 3 Fenster ohne deutsche Folge, 2 sonstige). Die Probe vom selben Tag hatte 252 von 284 geschätzt; sie nahm bei gleich großen Staffeln Reihenfolge an und ließ eine Zuordnung zu, wo mehrere Staffeln gleich groß sind — das ist hier mehrdeutig und bleibt offen.
- **Nicht gemacht:** Netflix (`anbieter-staffeln.json` nennt nur Name und Zahl je Staffel, nichts zum Ton: ein Fenster sagte nicht, welche Folgen deutsch sind) und Prime (Bereiche kommen aus `prime-zugeordnet.json` je ASIN, anderer Weg); ADN (`adn-raw`, Dan Da Dan: Titel weichen ab, 13 + 12 gegen 12 + 12) als eigener Schritt.

## Geteilte Prime-Seiten: Folgenbereich je Titel (11.10.2026)

- **Befund:** Von 780 Prime-Wegen (Stand `public/data`, 11.10.2026) teilen 38 ihre Seite mit anderen Titeln (17 Seiten). `bau/09-3-prime.ts` liest `data/prime-zugeordnet.json` nur für `dub: true` und die Seitenadresse, nie für `dubRanges`; Prime-Bereiche kamen bisher nur aus Handbelegen. Die Meldungen tragen aber schon unsere Zählung (`folgen[].unsere`, von `fetch-rohfolgen.ts` über Folgentitel und Daten **des Titels** gelegt, nicht über die Position in der Seitenliste).
- **Regel** (`lib/prime-teilseiten.ts`, Bau `bau/09-7-prime-teilseiten.ts`, hinter `setzeCrTeilseiten` im Verteiler `bau/09-7-teilseiten.ts`): ein Weg mit Haken, ohne Bereich, mit `sharedWith` bekommt `dubRanges` aus den **deutschen** Folgen seiner Meldung, wenn sie eindeutig ist: genau eine Meldung des Titels zur Seite; jede deutsche Folge hat eine Nummer in 1 bis Folgenzahl, keine Nummer doppelt; die Folgengruppe (ASIN der ersten Folge) ist keinem anderen Titel derselben Seite gemeldet. Lücken bleiben Lücken (Hyouka: 1–3 und 5–12 von 22 — die übrigen 10 stehen nicht auf dieser Seite).
- **Kanal-Titel ausgenommen:** Amazon zeigt dort die Sprachen des Kanals, nicht die der Folge (Kill Blue, 24.08.2026). Erkannt über den Handbeleg der Adresse (`Abos:` mit genau einem Kanal oder die Warnung „Kanal-Titel“); 18 der 38 Wege stehen deshalb mit Grund auf der Prüfliste, darunter Food Wars und Danganronpa 3. Bei Food Wars kam die Meldung außerdem von anderen Staffelseiten (`seite` ≠ Ablage-Adresse); eine Meldung gilt nur der Seite, von der sie kam.
- **Prüfliste:** `data/prime-teilseiten-pruefliste.json` (Titel, Adresse, Grund). Ein Handbeleg mit Bereichen bleibt unberührt.
- **Prüfung:** `pipeline/check-prime-teilseiten.ts` (in `check:logic`; der Bestandsteil `check-prime-teilseiten-bestand.ts` in `check:bestand`).

## Dublette ohne MAL auf AniList-Seite: Bookworm Staffel 5 (11.10.2026)

Daniel: Kachel `t=26256` zeige kein Cover, den japanischen Namen und „7 Staffeln"; die Kennung sei falsch (richtig 14237). Befund: `kennungen.json` ordnet 26256 der aniSearch-Zeile 10022017 zu (aniSearch 22017, „Kizoku in no Jinshou Toshoiin", MAL 65103, 12 Folgen, Jahr 0). **22017 ist die richtige Kennung dieser Zeile** (aniSearch nennt 18911 = Staffel 4 als Vorgänger); 14237 ist Staffel 1 und hängt richtig an AniList 108268. Die Kachel war eine Dublette des AniList-Titels 217712 (gleiche Staffel, im Katalog ohne MAL, anderer Schreibweise des Namens) — die MAL-Regel (`gleichesWerk`) und die Namensregel (Stufe 1) fanden das Paar nicht. Cover und Name fehlten, weil die Zeile kein Cover von aniSearch trägt und aniSearch für 22017 keinen deutschen Namen führt.
- **Korrektur:** `217712: 22017` in `data/anisearch-ids-hand.yaml`; die Zeile entfällt, der AniList-Titel trägt die Kennung und sein AniList-Cover. Test in `check-anisearch-dubletten.ts`. Ein deutscher Name existiert nicht (AniList ohne `titleEn`).
- **Kennung 26256 (PR 861):** `data/kennungen.json` trägt `[26256,10022017,22017,17943]`; 17943 ist die `ak` des AniList-Titels 217712. `akVon` übersetzt 26256 auf 17943, `ak-umleitung.json` führt gemerkte Titel um, `/t/26256/` ist eine Weiterleitung. Zusicherung: `pipeline/check-bookworm-dublette.ts` (Quellen und Umleitung, `check:logic`) und `check-bookworm-dublette-bestand.ts` (`check:bestand`: keine Zeile 10022017, genau ein Titel mit aniSearch 22017).
- **„7 Staffeln" (PR 862, 12.10.2026):** Die Zeile trug Jahr 0 (aniSearch: Jahr unbekannt) und sortierte vor jede Jahreszahl; sie wurde zur Staffel 1 der Reihe. Jahr 0 und fehlend gelten jetzt überall als „noch offen" und stehen hinten, über einen Schlüssel: `jahrZumSortieren` und `nachJahrUndId` (`shared/titles.ts`) in `ausstrahlungsZeit`/`nachAusstrahlung`, Reihenliste (`reihen-liste.tsx`), `reihen-daten.ts` und den zwei Sortierungen in `lib/meldungen.ts`. Gemessen an `franchises.json` (899 Reihen, Stand 12.10.2026): 11 Reihen mit Jahr-0-Eintrag ändern ihre Reihenfolge, bei 6 wechselt der Reihenvertreter. Nicht betroffen: `fetch-rohfolgen.ts` (`istReihenkopf` filtert Jahr 0 vorher aus). Andere Sortierungen mit `?? 0` (z. B. `lib/crunchyroll-dub.ts`, `lib/tv-termine.ts`) wählen Kandidaten, keine Anzeige; nicht angefasst.
- **Systematik:** Messskript über `titles.json` + `ohne-synchro.json`: 2.738 aniSearch-Zeilen, 1.008 AniList-Titel ohne MAL und ohne aniSearch-Kennung; darunter 19 Zeilen mit fast gleichem Namen, gleichem Format und Jahr (u. a. Ninja Kamui: Red Vendetta, Zero Rise, Black Channel, Kingdom: Zoku-hen) — nicht angefasst, jedes braucht Einzelprüfung; „Blue Gale Xabungle Side L/R" ist ein Fehltreffer (zwei Werke), weitere Fehltreffer möglich.

## Release ohne Titel: Bleach „Memories of Nobody" (12.10.2026)

- **Befund:** `#/woche?t=-1` öffnete „Zu diesem Eintrag liegen keine Metadaten vor". Zwei Releases hatten `titleId -1`: `adn-197` (ADN „Bleach: Memories of Nobody - Movie 1", daneben der Film mit Bild) und `cr-GR3K50PZR` (Anime Awards, kein Anime).
- **Ursache ADN:** `07-adn.ts` fand den AniList-Film nicht — ADN: „Gekijōban Bleach: Memories of Nobody" / „… - Movie 1", AniList: „BLEACH: MEMORIES OF NOBODY MOVIE" (die Filme 2 bis 4 trugen den japanischen Untertitel und trafen). Der Kalenderweg behielt Einträge ohne Treffer ausdrücklich.
- **Fix:** `bau/adn-show-titel.ts` (`titelZurShow`): als letzter Rückfall Namensabgleich ohne „Gekijōban"/„Movie N", nur für Shows, deren Folgen alle ADN-Typ `MOV` sind, nur gegen Format `MOVIE`, nur bei genau einem Treffer.
- **Netz:** `bau/ohne-titel.ts` nimmt Releases und Termine mit `titleId -1` aus dem Kalender (über `entferneVomKalender` in `bau/sperre.ts`, gleich nach `rolleTermineAus`) und meldet sie mit Namen im Bau-Protokoll. `lib/invarianten.ts` (`verweiseAufgeloest`): `-1` ist jetzt ein Fehler (vorher Warnung), ebenso ein Termin ohne vorhandenen Titel. `npx tsx pipeline/check-invarianten.ts --bestand` misst dasselbe an `public/data`.
- **Prüfung:** `pipeline/check-adn-film.ts` (in `check:logic`), Fehlerfälle in `check-invarianten.ts`. Gegenprobe 12.10.2026: `--bestand` meldete 3 Fehler (beide Releases, 2 Termine); mit Fix findet `filmZurShow` für Show 197 den Titel 1686 und `entferneOhneTitel` räumt das Crunchyroll-Event ab.

## AniList-Katalogtitel ohne aniSearch-Treffer: eigene Stammdaten, eingefroren (11.10.2026, Daniel)
- **Entscheidung:** Die 2.857 Titel mit Urteil `keiner` (`data/anisearch-katalog-abgleich.json`) werden nicht gestrichen, sondern von uns gepflegt; AniList-Abrufe für sie sollen enden. Plan: `daniel-zum-abarbeiten/berichte/eigene-stammdaten-plan-2026-10-11.md`, Schritt 1.
- **Datei:** `data/stammdaten/anilist-eingefroren.json` (3.047 Einträge seit dem Nachtrag vom 13.10.2026, davor 2.856; 99643 „Ookami Heart“ steht im Hauptbestand und kommt nicht aus dem Katalog, siehe Nachtrag unten). Eintrag = `KatalogEintrag` wortgleich (Namen, Format, Jahr, Start, Status, Folgen, Genres, Score, Cover-Dateiname, Relationen, `land`, MAL) plus `dauer`, `ende`, `saison`, `herkunftsland`. Cover bleibt die AniList-Adresse; keine Kopien.
- **Erzeugt** einmal von `pipeline/einfrieren-anilist.ts` (116 Abrufe in Blöcken zu 50); das Skript weigert sich, eine vorhandene Datei zu überschreiben (`--neu`). Kein Lauf schreibt sie, deshalb steht sie nicht in `tools/quellen-liste.sh`. Von Hand pflegen.
- **Bau:** `ladeKatalogEintraege()` (`pipeline/lib/katalog-eingefroren.ts`) ersetzt in vier Leseorten den Cache-Katalog bei diesen Kennungen durch die Datei; ohne warmen Cache bleibt er leer wie bisher. Zusicherung: `pipeline/check-katalog-eingefroren.ts` (`check:logic`); die Prüfung an der Ausgabe (höchstens 1 % fehlen) liest `public/data` und steht in `check-katalog-eingefroren-bestand.ts` (`check:bestand`).
- **Nicht mehr automatisch aktuell:** 196 angekündigte (133 ohne Jahr) und 56 laufende Titel; Pflege später über TMDB, aniSearch oder von Hand. Der Tagesabruf `data:katalog` frischt sie im Cache weiter auf, der Bau liest dort nicht mehr — das Abschalten des Abrufs ist ein eigener Schritt.
- **Gegenprobe nach Merge mit main (12.10.2026):** `anisearch-katalog-abgleich.json` zählt jetzt 3.047 `keiner` (beim Einfrieren 2.857); alle 2.856 eingefrorenen Kennungen stehen weiter darin, 191 andere `keiner` sind dazugekommen und nicht eingefroren. Keiner der 2.856 hat eine aniSearch-Zeile als zweiten Titel: keine aniSearch-Kennung kommt in `titles.json` + `ohne-synchro.json` mit einem eingefrorenen Titel mehrfach vor; 6 eingefrorene Titel tragen selbst eine aniSearch-Kennung (u. a. 217712 aus `anisearch-ids-hand.yaml`), sie sind keine Dubletten.

### Nachtrag (13.10.2026): `--nachtragen`, 191 Kennungen nachgefroren

- **Anlass:** Der Prüfer des Einfrier-PR fand 191 `keiner`-Kennungen ohne Eintrag (190 davon mit `vergebenAn`, dazu 99643 „Ookami Heart“). Solange sie fehlen, hängt der Bau für sie am AniList-Abruf, und der Abruf lässt sich nicht abschalten.
- **Werkzeug:** `tsx pipeline/einfrieren-anilist.ts --nachtragen` trägt jede Kennung aus `keiner` nach, die in der Datei fehlt. Katalogeintrag aus dem Cache (`ladeKatalogEintraege()`), nur der Rest per Abruf; die Zusatzfelder (`dauer`, `ende`, `saison`, `herkunftsland`) kommen immer per `mediaByIds`. Vorhandene Einträge werden unverändert zurückgeschrieben (Zeile für Zeile gleich, nur der Kopf bekommt `nachgetragenAm`). Ohne Flag und mit vorhandener Datei bricht das Skript weiter ab.
- **Ookami Heart** hat Format `MUSIC`; `katalogSeite` liefert es nie (`gehoertInKatalog`). Der Nachtrag baut den Eintrag deshalb aus dem Medium (`katalogEintragAus`, `latein` fehlt dort, weil `MEDIA_FIELDS` keine Synonyme holt).
- **Zahlen:** vorher 2.856 Einträge, 191 `keiner` ohne Eintrag (190 `vergebenAn` + Ookami); nachher 3.047 Einträge, 0 fehlen. 188 kamen aus dem Cache (Stand 03.09.2026), 3 per Abruf.
- **Warnung:** `check:bestand` (`check-katalog-eingefroren-bestand.ts`) warnt (ohne Fehlschlag), wenn eine `keiner`-Kennung nicht eingefroren ist, und nennt den Befehl. Neue `keiner`-Kennungen entstehen mit jedem Abgleichlauf, der Nachtrag wiederholt sich also bis zum Abschalten des Abrufs.

## Fremde Originalschrift bei einem aniSearch-Titel: 1 Fall, Feld geleert (14.10.2026)

- **Befund:** Titel 10013612 (aniSearch 13612, „SAO Alternative: GGO – Refrain“) trug als `titleNative` den Namen der Toji-no-Miko-Zusammenfassung (aniSearch 13554) plus „ルフラン“. Ursache ist aniSearch selbst: Die API (`title_native`, Archiv `data/anisearch-eintraege.json`, Feld `n`) und die Titelliste (`ja-kanji`) liefern denselben falschen Wert. Ein richtiger Wert steht nirgends im Repo (AniList führt den Titel nicht), also wurde `n` entfernt statt geraten.
- **Haltbarkeit:** `fetch-anisearch-eintraege.ts` fasst vorhandene Einträge nur für `syn`/`rel` an; die Korrektur bleibt beim Nachabruf stehen.
- **Systematik (14.10.2026, 8.275 Einträge, 7.854 mit `n`):** 9 Gruppen mit gleichem `n` (je gemeinsames Romaji-Wort, also Fortsetzungen/Teile); 740 Einträge, deren `n` mit dem `n` eines anderen beginnt, davon 4 ohne gemeinsames Romaji-Wort, 3 davon stimmig (Short Peace Opening, 十万个冷笑话2, IDOLiSH7 4期). Bleibt 1 Fall: dieser.

## Dieselbe aniSearch-Kennung bei mehreren Titeln: 42 Kennungen, alle gewollt (12.10.2026)

- **Messung** an `public/data/titles.json` (12.10.2026): 42 Kennungen tragen 117 Titel, `ohne-synchro.json` keine. Die Live-Messung vom 11.10. nannte nur zwei (585, 9744), weil sie nur die im Panel geöffneten Titel sah.
- **Einordnung** an den archivierten Seiten (`data/anisearch-raw/`, nichts abgerufen): bei 33 Gruppen nennt die Seite genau so viele Teile wie Titel an ihr hängen („Film, 3": Kizumonogatari, Heaven's Feel, Mardock Scramble), bei 6 steht die Folgenzahl der Seite für Serie samt Special (Wolf's Rain 30 = 26 + 4 OVA, GANTZ 26 = 13 + 13, To Love-Ru Darkness 2nd 14 = 12 + 2); bei 3 laufenden oder mehrteiligen Reihen (Grisaia, Girls und Panzer, Princess Principal) zählt die Seite mehr Teile, als bisher erschienen sind. Echte Dubletten (a): keine; falsche Kennung (b): keine eindeutige; legitim (c): alle 42. Fraglich (nicht angefasst): `daniel-zum-abarbeiten/listen/anisearch-doppelte-kennung.md`.
- **Warum gewollt:** In jeder Gruppe sind alle Titel bis auf höchstens einen in `data/anisearch-ids-hand.yaml` an die Kennung gebunden (nachgesehen), der eine kommt aus der ID-Brücke.
- **Zusicherung** (`lib/anisearch-kennung-mehrfach.ts`, im Bau über `bau/auslieferung-pruefen.ts`, Test `check-anisearch-kennung-mehrfach.ts`): eine Kennung bei mehreren Titeln mit mehr als einem ohne Handbindung bricht den Bau. Die Handdatei ist die Ausnahmeliste; Gegenprobe: ohne sie meldet die Regel die 42 Gruppen, mit ihr keine.
- **Offen:** fünf Paare aniSearch-Zeile (Hauptbestand) gegen AniList-Titel (`ohne-synchro.json`) mit derselben Kennung (BeyWheelz, Spycies, Titipo Titipo 2, Rick and Morty: The Anime, Rohirrim) heilen laut Code beim nächsten Abruf (`ausAnisearchDubs`); nach dem nächsten Datenlauf nachmessen.
- **Nachmessung 13.10.2026:** Die fünf Paare sind geheilt (je nur noch der AniList-Titel in `titles.json`, keine Zeile mehr). Die drei Fraglichen, geprüft gegen die aniSearch-API (`/v1/anime/4405,1119,5473,6984,6986,875`, ein Abruf): **Durarara!! Specials** (AniList 8408) — aniSearch führt zwei Bonus-Seiten 6984 und 6986, beide MAL 8408, die Serie 5473 nur MAL 6746; die Bindung bleibt trotzdem bei der Serie 5473: Der Bauvergleich (`bau-vergleich.mjs`, 13.10.2026) mit `8408: 6984` ließ die Zeile 10006984 ihren deutschen Titel „Gottes Mühlen mahlen langsam, aber sicher“ verlieren (Name, Slug, `dubConfidence` high → normal) und gab 8408 Wertung und Schlagwörter dieser einen Folge. Wer es dennoch umstellen will, braucht zuerst eine Regel für die Teilung 1 AniList-Titel : 2 aniSearch-Seiten. **Tachikoma 2005** (10947) und **Afro Samurai Movie** (13709): keine aniSearch-Seite trägt MAL 10947 bzw. 13709 (4405 = MAL 1335, 1119 = MAL 1292); Dominiks Bindung bleibt, „Auf Deutsch“ steht dort auf der Seite der Serie bzw. der 26 Kurzfilme und bleibt als `dubConfidence: normal`, `einzelquelle` gekennzeichnet — nicht widerlegt, nicht belegt (Bericht `daniel-zum-abarbeiten/berichte/live-messung-rest-2026-10-13.md`).

## Deutsche Folgenzahl bei Teilsynchro (12.10.2026)

Manche Titel sind auf Deutsch nur zum Teil vertont (Wundersame Geschichten: Original 41 Folgen, deutsche Fassung 26), der Bestand führt die Original-Folgenzahl. `data/erstausgabe-von-hand.yaml` nimmt dafür am Eintrag ein optionales `deFolgen` (`n`, `name`, `url`, `zitat` unter 15 Wörtern; Quelle und Zitat Pflicht, `check:logic` prüft). Der Bau legt es in `public/data/synopses/` (Detaildaten des Panels, nicht in `titles.json`), setzt am Titel `deErstausgabe.teil` und das Panel sagt „26 von 41 Folgen auf Deutsch“ mit „Laut <Quelle>: „<Zitat>““ darunter; eine Zahl, die nicht unter der Folgenzahl des Werks liegt, wird im Bau gemeldet und in `check:bestand` bemängelt. Beim Nachtragen: Zahl und Zitat auf der Quellseite selbst lesen. Offen: Transformers: Cybertron (der Kommentar nannte 26 deutsche Folgen, fernsehserien.de zeigt „51 Folgen in 2 Staffeln“).

**Live gemessen 13.10.2026** (`meta.generatedAt` 14:56Z): `synopses/` trägt `deFolgen` für Kirby (52 von 100) und Wundersame Geschichten (26 von 41); im Panel (Playwright, 393 px) steht „52 von 100 Folgen auf Deutsch“ bzw. „26 von 41 Folgen auf Deutsch“ mit „Laut fernsehserien.de: „…““ darunter.

**Befund Wundersame Geschichten `synchro: false`:** `erstausgabeAus` in `pipeline/bau/anisearch-titel.ts` setzt `synchro` nur bei aniSearch-Dub `d`; bei `c` (abgebrochen) wird es `false`, obwohl `pipeline/lib/anisearch-termine.ts` dasselbe Kennzeichen als `synchro: true, teil: true` führt. Betroffen sind vier Titel mit eigener aniSearch-Kennung (3453 Wundersame Geschichten, 9970 Eichhörnchen und Igel, 13695 Kickers: Unsere Legende, 15334 Nori); Wundersame ist über den Handeintrag korrigiert, die Logikänderung für alle vier steht aus (eigener Auftrag, Gegenprobe je Titel nötig).

## Eigene Handlungstexte: Faktensammler, Faktenkarte, Wortnähe (12.10.2026)

Daniels Entscheidung C (12.10.2026): für die Titel ohne deutsche Handlung entstehen eigene Texte aus Fakten, nicht aus fremden Absätzen. Bericht und Muster: `daniel-zum-abarbeiten/berichte/handlung-eigen-poc-2026-10-12.md`. Dies sind die Werkzeuge (Stand: nur Werkzeug, **keine Texte, nichts in `data/` oder `public/`**), Prüfsatz `tools/handlung-fakten.test.mjs` (läuft in `check:workflows`).

- **Lücke:** `npx tsx tools/handlung-luecken.ts` — Titel ohne deutsche Handlung in `public/data/synopses`, abzüglich der Titel, die der Bau aus dem aniSearch-Seitenarchiv füllt (`archivTexte`). 12.10.2026: 164 Titel (31 auf geteilter aniSearch-Seite, 4 ohne aniSearch-Seite).
- **Fakten:** `npx tsx tools/handlung-fakten.ts [--ids a,b] [--max N]` — je Lückentitel (1) geratene Wikipedia-Seitennamen (Englisch, Deutsch, Romaji; dann Reihenname und Name ohne Staffel-/Teilmarke und ohne Zusatz wie „Specials“; vor dem Doppelpunkt; typografische Apostrophe werden gerade; bei abgelehnter Seite „Name (anime)“ usw.), (2) die lokale aniSearch-Archivseite (`data/anisearch-raw`, nie Netz: Format, Studio, Genres, Tags, Figuren, Beziehungen, vorhandene Beschreibung), (3) deutsche aniSearch-Texte der Reihenmitglieder. **Keine Wikidata-Brücke (12.10.2026, Prüfer):** `query.wikidata.org/robots.txt` hat unter `User-agent: *` die Zeile `Disallow: /sparql`, `www.wikidata.org/robots.txt` unter `User-agent: *` u. a. `Disallow: /w/`, `Disallow: /api/` und `Disallow: /wiki/Special:`; damit ist jeder Weg gesperrt, der eine Seite zu einer MAL- oder aniSearch-Kennung sucht (SPARQL, `w/api.php` mit `haswbstatement`, `Special:EntityData`/`Special:Search`). Ein erlaubter Weg bleibt nicht, die Brücke ist entfernt. Raten allein findet für 130 von 164 Titeln eine Wikipedia-Seite. Ein geratener Treffer gilt nur, wenn die Seite von Animation handelt (keine Begriffsklärung); trägt sie das Jahr des Titels nicht oder ist sie eine Weiterleitung, wird sie „reihe“ statt „titel“.
- **Wikipedia-Regeln:** nur `/wiki/<Seite>?action=raw`; `tools/handlung-fakten/robots.ts` liest vor jedem Lauf die `robots.txt` von `de.` und `en.wikipedia.org` (Block `User-agent: *`, längste Regel gilt, `*`/`$` als Platzhalter), bricht ab, wenn der Pfad gesperrt ist, und befragt die Regeln vor jedem einzelnen Abruf, auch für das Ziel einer HTTP-Weiterleitung (`redirect: 'manual'`: höchstens ein Sprung, nur auf dieselbe Wikipedia und nur auf einen erlaubten Pfad, sonst „gesperrt“ ohne Abruf; geprüft 12.10.2026, beide Hosts gleich: `Disallow: /w/`, `Disallow: /api/`, `Disallow: /wiki/Special:` bzw. `/wiki/Spezial:`; `/wiki/<Seite>?action=raw` ist frei). Ein Abruf je Sekunde. User-Agent `anime-kalender-de/1.0 (https://anime-kalender.de/#/impressum; …)` — Kontakt ist das Impressum der Projektseite (`/impressum` ohne Hash gibt es nicht), keine private Adresse. 404 und Treffer liegen im Cache (`data/cache/handlung-fakten/wiki/`, eingetragen in `data/cache-register.json`, ohne Verfallsdatum; zum Auffrischen den Ordner löschen). 429/5xx/Netzfehler: Pause 20, 60, 180 s (`Retry-After` gilt), danach gilt die Seite als „fehler“, der Lauf geht weiter und der nächste Lauf holt sie nach. **Kein Kitsu** (gestrichen), kein TMDB/AniList/MAL, kein Wikidata.
- **Ausgabe** (`data/cache/handlung-fakten/karten/`, nicht getrackt, Quelltexte nie ins Repo): je Titel `<id>.md` (Faktenkarte für den Schreiber: Format, Hauptfiguren, Genre-Ton, Quellenliste, Einordnung — **ohne** Quellsätze), `<id>.quellsaetze.md` (die Plot-Sätze der Quellen, nur für den Stichpunkt-Schritt), `<id>.json` (alles), `<id>.quellen.json` (volle Quelltexte für die Wortnähe). Prämisse und Schauplatz stehen in der Karte als „offen“: der Stichpunkt-Schritt (Agent liest die Quellsätze) füllt sie in eigenen Worten, der Text-Schritt (zweiter Agent) bekommt nur die Karte. Das ist die Stelle, die den Abstand zur Quelle sichert. **Zwei getrennte Agenten (Entscheidung Dirigent, 12.10.2026):** der Stichpunkt-Agent liest nur `<id>.quellsaetze.md` und schreibt die Stichpunkte in die Karte, der Text-Agent bekommt nur die Karte `<id>.md`.
- **Einordnung** (`ordneEin` in `tools/handlung-fakten/karte.ts`): „zu dünn“ bei weniger als zwei Quellen mit Inhalt (außer die einzige Quelle enthält mindestens zwei Plot-Sätze zum Titel selbst, dann reicht eine; Entscheidung Dirigent 12.10.2026) oder weniger als zwei Sätzen über Handlung/Reihe; „titel“ bei mindestens zwei Sätzen über den Titel selbst; sonst „reihe“ (die Karte verlangt die Kennzeichnung „gilt für die Reihe“, aber der Text beginnt nicht mit „Die Reihe handelt von“: das Panel zeigt darüber schon „Zur Reihe – gilt für alle Teile“). Sätze zählen aus dem Plot-Abschnitt der Seite, sonst aus der Einleitung ohne ersten Satz, dazu aniSearch-Beschreibungen (geteilte Seite = „reihe“) und die Texte zweier Reihenmitglieder. Das ist eine Heuristik: eine Einleitung zählt als Plot, auch wenn sie nur Besetzung und Rezeption nennt (PoC-Fall Detektiv Conan: schwächster Beleg) — die Stichprobe von Hand (jeder 10. Text) bleibt.
- **Keine Wertung, keine Zahl ohne Beleg (Dirigent, 12.10.2026):** Sätze mit Rezension, Presse, Wertung oder längerem Zitat (`istWertung` in `tools/handlung-fakten/zahlen.ts`) kommen nie in die Quellsätze (die Zahl der entfernten steht in `<id>.quellsaetze.md`); nur Fakten aus Quellen, deren Lizenz die Karte nennt. Jede Zahl im fertigen Text muss in der Karte oder einem Quelltext stehen; nennt eine Quelle eine andere Folgenzahl als der Katalog (aniSearch-Typzeile, Wikipedia-Infobox), steht „ACHTUNG Folgenzahl“ in der Karte und der Text lässt die Zahl weg oder nennt die belegende Quelle. Beides prüft `tools/handlung-naehe.ts` maschinell mit (Zeile „PRÜFEN“ unter dem Text, der Text zählt dann als durchgefallen, „FEHL“, mit `--streng` Exit 1). Beispiel aus dem Lauf: Wundersame Geschichten, Katalog 41 Folgen, Wikipedia DE 26.
- **Wortnähe und Inhalt:** `npx tsx tools/handlung-naehe.ts <titelId> <textdatei>` oder `--ordner <ordner mit <titelId>.txt>` — Text gegen alle Quelltexte seines Titels (ganze Wikipedia-Seiten, aniSearch-Beschreibungen, Texte der Reihenmitglieder); je Text eine Zeile „OK“ oder „FEHL“; ein gemeinsamer 5-Wort-Abschnitt oder eine „PRÜFEN“-Zeile (Zahl, Wertung) = FEHL, Text zurück an den Schreiber. `--streng` gibt Exit 1 bei Durchfall (sonst Messlauf, Exit 0). Der Test deckt keine Übersetzung ab (englische Quellen ergeben fast immer 0); der Abstand kommt aus der Bauweise.
- **Lauf über alle 164 Lückentitel (12.10.2026, ohne Wikidata, ca. 19 min, Wikipedia-Abrufe insgesamt 1.011 im Cache: 230 Treffer, 781 × 404, null Abruffehler):** **titel 14 · reihe 118 · zu dünn 32** (davon 3 nur wegen einer Quelle ohne zwei Plot-Sätze zum Titel). 130 Titel haben mindestens eine Wikipedia-Seite, 61 Titel hatten Wertungs- oder Zitatsätze, die ausgefiltert wurden, 8 tragen „ACHTUNG Folgenzahl“. **„reihe“ ist weich:** 117 der 118 haben keinen Satz über den Titel selbst; die Seite gilt der Reihe oder ist eine Weiterleitung und kann bei großen Reihen (Pokémon, Detektiv Conan) ein anderer Film der Reihe sein — wer daraus einen Text schreibt, prüft die Seite zuerst. Mit Wikidata-Brücke (vor der Entfernung) waren es titel 20 · reihe 111 · zu dünn 33.
- **Runde 1 (13.10.2026): 10 weitere Texte in `data/handlung-eigen.yaml`** (Beerus und neun der 14 „titel“-Titel; Witcher, Bakugan: Legends und Conan standen schon da). Vorgehen wie beschlossen: erst Stichpunkte aus `<id>.quellsaetze.md`, dann der Text nur aus Stichpunkten und Karte, danach `tools/handlung-naehe.ts` (12 geschrieben, 12 von 12 ohne gemeinsamen 5-Wort-Abschnitt, keine Zahl- oder Wertungsmeldung). **„titel“ der Heuristik ist weicher als gedacht:** bei Mission: Yozakura Family (Staffel 2, Artikel gilt der Serie), Regina Regenbogen (Artikel gilt der Reihe von 1984), Bakugan: Armored Alliance und Beyblade Burst QuadDrive (0 Plot-Sätze zum Titel) trägt der Text nur die Reihe und steht mit `umfang: reihe`. Beerus: die Quellen nennen zur Neufassung nur Form und Start (0 Plot-Sätze); der Handlungssatz steht als „die ursprüngliche Serie beginnt damit“. Mewtu vor dem Erwachen und Der weiße Delphin stützen sich allein auf eine aniSearch-Beschreibung (en bzw. es, vom Archiv), also auf übersetzte Fakten einer einzigen Quelle — **zurückgestellt** (Prüfer 13.10.2026): Satz für Satz übersetzt, das misst `handlung-naehe` nicht, und aniSearch-Text steht nicht unter CC BY-SA. Ein Text braucht Fakten aus mindestens zwei Quellen oder eine Lizenzangabe ohne CC samt Daniels Freigabe. **Assassination Classroom: Our Time** blieb aus: der Titel führt schon einen deutschen TMDB-Text, eigene Texte gelten nur ohne Quelltext (Vorrang der Quellen); Daniels Notiz meinte den Hinweistext zur Verfügbarkeit, nicht die Handlung.
- **Quellenregel als Prüfung (13.10.2026):** `eigeneHandlungFehler` (`pipeline/lib/handlung-eigen.ts`, bricht den Bau, läuft in `check:logic` über `check-handlung-eigen.ts`) verlangt Quellen aus mindestens zwei verschiedenen Familien — alle Wikipedia-Sprachen zählen als eine, aniSearch (jede Seite) als eine. Eine einzige Familie ist ein Fehler, außer der Eintrag trägt `freigabe: "Daniel, TT.MM.JJJJ: …"` (Name und Datum Pflicht). **Nur aniSearch mit einer CC-Lizenz ist immer ein Fehler**, auch mit Freigabe (aniSearch-Text steht nicht unter CC). Messung vor der Regel an `data/handlung-eigen.yaml` auf main: 19 Einträge, alle mit Wikipedia und aniSearch, **0 Verstöße**; Mewtu und Der weiße Delphin stehen nicht in der Datei (nie gemergt), also war nichts zurückzustellen. Ein Eintrag, den die Regel trifft, wird nicht still behalten: aus der Datei nehmen (Text zurück an den Schreiber, Quelle ergänzen) oder mit Daniels Freigabe versehen. Gegenprobe: ohne die Regel sind 6 der 8 neuen Fälle in `check-handlung-eigen.ts` rot. Eintrag 101343 (Made in Abyss: Journey’s Dawn) bleibt: Titel in `titles.json` (Datenbank und Teilen-Seite, kein Kalendertermin), Text aus Wikipedia DE/EN und aniSearch, im Bestand als eigener Text ausgeliefert; die Bau-Warnung „ungenutzt“ in der Ausgabe von `check-handlung-eigen.ts` stammt vom Testaufbau (dort trägt der erste Titeleintrag absichtlich schon einen Quelltext).
- **Überholter Eintrag ist Hinweis, kein Rot (25.10.2026).** Liefert eine Quelle später einen deutschen Text, gewinnt sie schon im Bau (`eigeneTexteAktiv`, Bau-Warnung „ungenutzt“ mit Kennung); `check-handlung-eigen-bestand.ts` (`check:bestand`) färbte den Bestandsbau dafür rot (Fälle 159309, 133007; PR 1574). Jetzt gibt `bewerteEigeneHandlungen` (`pipeline/lib/handlung-eigen-bestand.ts`) „Quelle führt Text“ als einzeilige `⚠ WARNUNG`-Zeile mit Zahl und Kennungen aus (Exit 0; nur solche Zeilen zeigt `tools/commit-data.sh` bei Exit 0 als `::warning::` im Lauf, ein `::warning::` aus `check:bestand` bliebe unsichtbar); nur ein Eintrag zu einem Titel, den es nicht mehr gibt, bleibt Fehler. Aufräumen der Datei von Hand bei Gelegenheit (Hinweis nennt die Kennungen). Test: `check-handlung-eigen-hinweis.ts` (`check:logic`).
- **Hinter dem Toggle ist nicht verwaist (26.10.2026).** Hyouken II (212503) war sichtbar mit eigener Handlung, bekam am 26.10. einen Crunchyroll-Weg ohne Beleg (Serie GDKHZEP21, aniSearch: Deutsch geplant) und wanderte nach der Regel `ausgestrahltOhneBeleg` hinter den Toggle (`10-termine.ts`, `ohne-synchro.json`); `check-handlung-eigen-bestand.ts` meldete "Titel nicht im Bestand" und hielt den Bestandsbau an (nicht der Cache, wie vermutet: mit dem Cache vom 25.10. fällt der Titel ebenso heraus). Jetzt zählt ein Titel in `public/data/ohne-synchro.json` als vorhanden: einzeilige `⚠ WARNUNG` ("ohne deutsche Synchro im Katalog") statt Fehler, die Bau-Warnung (sie kennt die echte Menge `verschoben`) sagt "Eintrag bleibt stehen" statt "löschen". **Grenze:** die Datei führt den ganzen AniList-Katalog (rund 17.700 Titel), Verschobene sind darin nicht zu trennen; der Wächter fängt deshalb nur Kennungen, die auch dort fehlen. Verwaist bleibt, was auch dort fehlt. Test: `check-handlung-eigen-hinweis.ts`.
- **Runde 2 (13.10.2026): 14 weitere Texte in `data/handlung-eigen.yaml`.** Lücke neu gemessen: 147 Titel ohne deutsche Handlung (`handlung-luecken.ts`), davon 15 mit mindestens einem Kalendertermin (events.json; 14 ab 01.07.2026, dazu Urusei Yatsura: Staffel 2). Faktenkarten mit `handlung-fakten.ts --ids` neu gebaut (alle 14 „reihe“, null „titel“), Texte aus den Quellsätzen, `handlung-naehe.ts --streng` 14 von 14 bestanden. Jeder Eintrag nennt Wikipedia (DE und/oder EN, eine Familie) und aniSearch (Seite des Titels plus Reihenmitglieder, eine Familie); die Regel aus #1078 hält. **Zurückgestellt: Tank Chair** (209499): keine Wikipedia-Seite gefunden, nur die aniSearch-Strukturdaten, also eine Familie. Das Werkzeug meldet Tageszahlen eines Datums (aus „23.12.2010“ wird 2312) als „Zahl ohne Beleg“; die Texte nennen deshalb nur Monat und Jahr. Reihentitel mit fünf und mehr Wörtern (The Detective Is Already Dead, A Wild Last Boss Appeared!) zählen dem Test als gemeinsamer 5-Wort-Abschnitt; die Texte nennen sie nicht (das Panel zeigt den Titel ohnehin).
- **Runde 5 (13.10.2026): 15 weitere Texte in `data/handlung-eigen.yaml`.** Lücke neu gemessen: 133 Titel ohne deutsche Handlung (`handlung-luecken.ts`, davon 30 auf geteilter aniSearch-Seite), davon 4 mit Eintrag in `releases.json` (Black Clover: Staffel 2, Bleach: The Calamity, Gintama-Film 2026, Tank Chair) und 11 in „Neu mit Synchro“ (öffentliche Liste vom 13.10.2026), dazu eines im Ausblick (Devil May Cry: Staffel 2). Gewählt: diese Titel zuerst, dann die mit belegter Synchro bei den Anbietern und hoher Punktzahl, soweit mindestens eine Wikipedia-Seite und eine aniSearch-Seite Fakten liefern. Faktenkarten mit `handlung-fakten.ts --ids` (alle „reihe“, null „titel“), `handlung-naehe.ts --streng` 15 von 15 bestanden; zusätzlich jeder großgeschriebene Name der Texte in Karte oder Quelle gefunden (nur Gattungswörter fehlten). **Zurückgestellt:** Tank Chair (209499, „zu dünn“: nur aniSearch-Strukturdaten, keine Wikipedia-Seite), Bakugan (177166, die geratene Wikipedia-Seite gilt „Bakugan Battle Brawlers“ von 2007, nicht dem Netz-Titel von 2023), Hyperventilation, T・P Bon: Staffel 2, Ultraman: Staffel 2 und 3, Persona 5 „Ein Beweis für die Gerechtigkeit“ (keine Wikipedia-Seite, eine Quellfamilie), Der weiße Delphin und Mewtu vor dem Erwachen (eine Quelle, wie in Runde 1). Gleiche Reihe, getrennte Texte: Diablos Tagebuch nennt die Slime-Reihe, Star Wars: Visionen Volume 3 und Die Reise zum dunklen Kopf die Anthologie (zwei Staffeln, kein gemeinsamer Handlungsfaden).
- **Runde 6 (14.10.2026): 15 weitere Texte in `data/handlung-eigen.yaml`.** Lücke neu gemessen: 115 Titel ohne deutsche Handlung (`handlung-luecken.ts`, davon 29 auf geteilter aniSearch-Seite). Gewählt: Titel mit Faktenkarte „reihe“, die aus mindestens einer Wikipedia-Seite und einer aniSearch-Seite Fakten liefern — Zusammenschnitt-, Neben- und Bonusfilme bekannter Reihen (Kuroko’s Basketball Winter Cup 2 und 3, Psycho-Pass Sinners of the System 1 und 3, Attack on Titan Teil 1, Code Geass Akito 1 und 2, Laughing Under the Clouds Gaiden 1–3) und Bonusfolgen (Samurai Gun, Princess Principal Crown Handler OVA, Baki, The Ones Within OVA, Junji Ito: Tomie). Zwei getrennte Agenten wie beschlossen: Stichpunkte aus den Quellsätzen, Text nur aus Karte und Stichpunkten; `handlung-naehe.ts --streng` 15 von 15 bestanden (erster Lauf 11 FEHL, alle durch gemeinsame 5-Wort-Folgen wie „der stärkste Kämpfer der Welt“ oder „die Brüder Tenka, Soramaru und“ — Eigennamen in Reihe sind die häufigste Falle; umformuliert), jeder großgeschriebene Name in der Karte gefunden (nur Gattungswörter fehlten). Sinners of the System 3: der Text nennt für Film 3 nur Rahmen und Figur (Kōgami); der deutsche aniSearch-Text beschreibt auch Teil 3, das Prüfwerkzeug erkennt aber keine unbelegten Zugehörigkeitssätze („X gehört zu Unit One“ war unbelegt, gestrichen) — solche Sätze prüft der Prüfer von Hand. Crown Handler OVA: „ACHTUNG Folgenzahl“ (Bestand 1, aniSearch 6), Zahl weggelassen. Gaiden 1–3: gemeinsamer Reihenrahmen, je ein eigener Satz zum Teil (Tenkas Vergangenheit, Shirasu im Fuuma-Clan, Yamainu-Experimente). **Zurückgestellt:** Tank Chair, Hyperventilation, Persona 5 „Ein Beweis für die Gerechtigkeit“, T・P Bon: Staffel 2, Bakugan, Der weiße Delphin (Gründe wie in Runde 5: eine Quellfamilie oder falsche Wikipedia-Seite). **Neuer Befund:** Fate/kaleid liner Prisma Illya (87488) landet mit der geratenen Seite auf den Fate/stay-night-Artikeln — die Heuristik „Seite handelt von Animation, Jahr fehlt → reihe“ merkt nicht, dass es die falsche Reihe ist; wer daraus schreibt, prüft die Seite zuerst (zurückgestellt).
- **Runde 7 (14.10.2026): 15 weitere Texte in `data/handlung-eigen.yaml`** (Lücke danach: 100 Titel, davon 19 auf geteilter aniSearch-Seite, 2 ohne aniSearch-Seite; `handlung-luecken.ts`). Titel: Grudge of Edinburgh Teil 1 und 2, Princess Principal Crown Handler Kapitel 4–6, To Love Ru Darkness 2 Specials, Slime-Nebengeschichte Luminas’ Erinnerungen, Ajin Shoutotsu und Shougeki, Wolf’s Rain OVA, Kuroko Winter Cup Film 1, My Hero Academia Memories, Afro Samurai the Movie, Sylvanian Families Mini-Episoden Ivy und Peony — alle „reihe“. Der Text-Agent hat **nur den Abschnitt „Stichpunkte“ der Karte** (plus Format-Zeile für Jahr, Laufzeit, Studio) benutzt, nicht Prämisse oder Schauplatz; der Prüfer gleicht in der PR Satz für Satz ab. `handlung-naehe.ts --streng` 15 von 15 bestanden (erster Lauf 5 FEHL: Reihentitel „Meine Wiedergeburt als Schleim in einer anderen Welt“ als 5-Wort-Folge, dazu Stichpunkte, die Wikipedia DE wörtlich folgten — Afro Samurai „nimmt das Schwert seines Vaters und das Stirnband“, Wolf’s Rain „Wölfe den Weg ins Paradies“, Grudge „seinen Freund Lancelot, Bans Sohn“; umformuliert). **Neu:** ein Quellname mit Doppelpunkt (`aniSearch (The Seven Deadly Sins: Urteil des Drachen)`) muss in der YAML in Anführungszeichen stehen, sonst bricht das Parsen. Kapitelzahlen (Crown Handler), Filmzahl (Kuroko) und Folgenzahlen mit „ACHTUNG“ (To Love Ru, Wolf’s Rain, Afro Samurai) stehen nicht im Text; Crown Handler 5 und 6 ohne Jahr (im Bestand offen). Grudge Teil 2 nennt nur den Rahmen aus Teil 1 und die Fortsetzung; Specials und OVAs (To Love Ru, Luminas, Wolf’s Rain, MHA Memories, Sylvanian) tragen nur den Reihenrahmen, weil die Quellen zu den Folgen selbst nichts sagen. Nachbesserung 15.10.2026 (Prüferbefunde): Tode aus den Texten gestrichen, auch wenn die Karte sie nennt (Bishop, Prinz Edward, Afro Samurais Meister); Serienhandlung in Bonusteilen beginnt mit „In der Serie …“ (Wolf’s Rain OVA, To Love Ru Specials), Filmreihen-Verlauf mit „Im Lauf der Filmreihe …“ (Crown Handler 4–6).
- **Runde 8 (14.10.2026): 15 weitere Texte in `data/handlung-eigen.yaml`**, alle „reihe“: Code Geass Akito 2 Picture Drama, Kizuna no Allele Staffel 2, Bear Bear Bear Kuma! und Der Bärdam, Eminence in Shadow Mini-Episoden, W’z OVA, Sindbad (erster Film), Faraway Paladin Zusammenfassung, Fire Force Staffel 2 Miniepisoden, Yuna & Stitch Staffel 2, Maken-ki! Privates, Tachikomatic Days, Space Dandy 2 Picture Drama, Prinz Arthus, Special 7 OVA. Der Text-Agent las nur die Karte (Prämisse, Schauplatz, Stichpunkte, HINWEIS-Zeilen). `handlung-naehe.ts --streng` 15 von 15 bestanden (erster Lauf 4 FEHL durch 5-Wort-Folgen aus den aniSearch-Texten — „in einer BooBies-Filiale aufgelesen“, „nicht auf Hawaii, sondern auf“; Sindbad brauchte zwei Umformulierungen, weil die erste wieder in den Quellwortlaut rutschte). Neu aus der Runde-7-Prüfung und dem Dirigenten-Nachtrag: nur Ausgangslage, keine Auflösungen; Bonus/Minis nur mit Reihenrahmen; Folgenzahlen mit „ACHTUNG“ (Code Geass, Tachikomatic Days) weggelassen; Reihentitel ab fünf Wörtern (Stand Alone Complex, Special 7, King Arthur) nicht ausgeschrieben. Special 7 OVA (113864) war als „dünn“ markiert, die Karte trug aber vier belegte Stichpunkte zur Serienwelt — Text mit vier Sätzen, Zeitpunkt der Handlung („Ein Jahr zuvor“) bewusst nicht behauptet. Prinz Arthus und Sindbad stützen sich auf Wikipedia EN plus aniSearch-Strukturdaten ohne aniSearch-Text (zwei Familien, Regel hält). Nachbesserung 15.10.2026 (Prüferbefunde): bei Karten-HINWEIS „Nur Rahmen“ beginnt die Serienhandlung mit „In der Serie …“ (Maken-ki! Privates, W’z OVA, Eminence Mini, Space Dandy Picture Drama, Bärdam, Yuna & Stitch Staffel 2); Bear Bear Bear Kuma! nennt nur noch Format und einen Reihensatz, weil die Karte zu den Kurzfolgen nichts weiß.
## Snowball Earth: veraltetes „Nein" und stehengebliebene Messung (12.10.2026)

Daniel (12.10.): Das Panel zeigte „10 von 13 Folgen auf Deutsch", Disney+ „✓ DE 1–10", Crunchyroll ohne Häkchen, der Kalender aber Crunchyroll Folge 13/13. Zwei getrennte Ursachen, beide in den Daten:

- **Crunchyroll:** `dub-confirmed.yaml` führte ein „Daniel: keine deutsche Synchro" vom 26.09. Der Bau entfernt einen Verweis mit belegtem Nein bei jedem Lauf (`verweise-entfernt.json`), der Dub-Abruf (`scrape-crunchyroll-dub.ts`) liest nur Verweise, die noch am Titel hängen — die Serie wurde nie wieder geprüft. Der Kalender-Release (`cr-GT00371869`) entsteht dagegen aus dem „(Deutsch)"-Eintrag des Simulcast-Kalenders und kennt das Nein nicht. Seit 12.10. neuer Handbeleg (Folge 1–13), der jüngere `checkedAt` gewinnt.
- **Disney+:** Es gab nie einen Release, nur die Messung der Erweiterung vom 08.10. (`dubRanges` 1–10 ja, 11–13 nein). Ohne Release schreibt nichts die Messung fort. Neuer Handbeleg 1–13. Einen Disney+-Termin gibt es bewusst nicht: Belegt sind nur der Start deutsch Fr 18.09. (Folge 1–2, aniSearch-News 59530, Instagram), Stand 24.09. Folge 1–6 (Anime2You 1053610), 08.10. Folge 1–10, 12.10. alle 13 — kein Tag je Folge (`daniel-zum-abarbeiten/berichte/snowball-earth-disney-termine-2026-10-12.md`). Ein Release für Folge 1–2 würde wegen der zurückgerechneten Crunchyroll-Tage (ab 20.07.) die Marke „Zweitanbieter“ tragen — falsch, bis die Regel „Komplettveröffentlichung als batch“ steht.
- Gemessen am Bestand (12.10.): Von 25 Crunchyroll-Releases aus dem „(Deutsch)“-Kalender (`cr-*`) fehlte nur diesem der Haken. Disney+-Verweise mit Ja- und Nein-Bereich: 3 (One Piece, Snowball Earth, „Though I Am an Inept Villainess“ — dort Messung vom 02.10., Folge 10–11 „nein“, ohne Release; bei der nächsten Erweiterungsmeldung prüfen).
- Folge: `schedule.belegtBis` („bis Folge N lieferbar“) spricht nur Tage nach der frühesten beobachteten Folge frei (`terminGeschaetzt`, `check-beleg-bis-anker.ts`). Davor sind die Tage zurückgerechnet, die Meldung nennt keinen Tag; Snowball Earth Crunchyroll (nur Folge 13 beobachtet) behält Folge 1–12 als geschätzt.

## Folgen desselben Tages, Katalog-Release, Komplettabwurf (13.10.2026)

Daniel (13.10.): Mushoku Tensei Staffel 3 hatte für Folge 13 und 14 am selben Tag zwei Kacheln; Snowball Earth zeigte bei einem Komplettabwurf „Staffelfinale · Folge 13/13“.

- **Eine Kachel je Titel + Anbieter + Tag** (`web/src/lib/buendel.ts`): auch das Finale ist nicht mehr eigenständig. Ausgebliebenes und Premieren bleiben eigen. Die Angabe „Folge 13–14/14“ kommt aus `folgenSpanne()` (`web/src/lib/kachel-folgen.ts`), nur bei lückenloser Reihe; bei einer Lücke bleibt „Folge 11/14 · +1 Folgen“. Die Auszeichnung der Kachel (`kartenArt()`) liest das ganze Bündel: Katalog-Release vor Staffelstart vor Staffelfinale. Gemessen 13.10.2026: 5 Fälle mit zwei Kacheln (Mushoku Tensei S3 am 18.10., Avatar: Die sieben Häfen am 30.10., My Hero Academia: Vigilantes S2 am 13.04., Zom 100 und Ayakashi Triangle), danach 0 (`check-kachel-buendel-bestand.ts`).
- **Katalog-Release** = `katalog: 'belegt' | 'abgeleitet'` am Termin (`shared/katalog-release.ts`, im Bau in `10-termine.ts`): Batch mit Erscheinungsdatum und belegter Zahl ab 3 Folgen, oder ein Wochen-Release, dessen Folgen vom Start bis zum Finale alle **an seinem Starttag** liegen. Nie „im Angebot seit“ (`available-from`), nie ein Batch ohne Zahl (das sind oft Starttermine aus Meldungen), nie mit Herkunft „restlichen“/„Teil“/„N der M“. **Belegt** nur mit Eintrag in `data/katalog-release-von-hand.yaml` (Quelle schreibt „Episoden: N (komplett)“, oder alle Folgen waren am selben Tag im Abruf zu sehen; Art `teil` schließt einen Release aus, z. B. Gachiakuta Part 1 „12 von 24“); sonst abgeleitet, die Kachel sagt „Vermutlich alle 13 Folgen auf einmal“ mit Marke „Katalog-Release ≈“. Violette Marke, zwei Spalten breit. Stand 13.10.2026 nach Prüferbefund: 13 Termine in 13 Releases (11 belegt, 2 abgeleitet: Honey Lemon Soda und Cyberpunk: Edgerunners II, gemessen im Bau-Vergleich 13.10.2026), vorher 40 Termine in 17. **Cyberpunk: Edgerunners II** (20.10.) steht bewusst nicht in der Handdatei: „Episoden: 10 (komplett)“ heißt bei Anime2You „Staffel danach vollständig“, nicht „alle auf einmal“; am 21.10.2026 live nachmessen, ob Netflix alle 10 Folgen am 20.10. bringt, erst dann belegen. `check-katalog-release-bestand.ts` (`check:bestand`) rechnet nach: jede Kennung der Handdatei hat ein Release, und ihre Quelle steht in dessen `sources` (Ausnahme `beobachtet`, dort ist der Abruf die Quelle). Entfallen: Beelzebub (24 der 60 Folgen zum Start), Gachiakuta (Part 1), The Beginning After the End und Tamon’s B-side (alle Folgen tragen das Finale-Datum, Start Monate früher: Wochentakt mit Katalog-Stempel von Crunchyroll, kein Release).
- **Komplettabwurf** (`pipeline/bau/10-komplettabwurf.ts`): Eine einzelne Crunchyroll-Kachel „(Deutsch)“ mit der letzten Folge der belegten Staffellänge (≥ 3) und keiner früheren Woche wird ein Batch am Tag der Kachel statt zwölf zurückgerechneter Wochentermine. Der Schritt steht **vor `rolleTermineAus`**, nicht bei den Simuldubs: Dort fehlten noch die Folgentage, die der Crunchyroll-Katalog später nachträgt; ein früher Umbau hätte drei Serien mit belegten früheren Folgen getroffen. Die Kachel allein belegt „alle Folgen an diesem Tag“ nicht; Snowball Earth ist es durch den Abruf „neu hinzugefügt“ (`data/crunchyroll-neu.json`, 13.10.2026: Folge 1–13 alle auf Deutsch ab 12.10. 17:30; vorher gab es nur Untertitel), eingetragen als `beobachtet` in `data/katalog-release-von-hand.yaml`. Ein anderer Komplettabwurf bliebe „Vermutlich“, bis er dort steht. Zeigt eine spätere Quelle andere Tage, gewinnt der Wochentakt.
- **Zweitanbieter** (`shared/zweitanbieter.ts`): ein `estimated`-Termin (zurückgerechnet oder fortgeschrieben) zählt nicht als „Erster“. Im Bestand 13.10. ohne Wirkung (41 Marken vorher wie nachher), aber Disney+ Folge 1 bei Snowball Earth wäre sonst „Zweitanbieter“ geworden.
- **Kalender-Abo** (`shared/ics-folgen.ts`): lückenlose Folgen desselben Releases, Tages und derselben Uhrzeit sind ein Eintrag („– Folge 13–14/14“), die Kennung bleibt die der ersten Folge. Vorher zwei Einträge.
- Offen: Der Newsletter (Worker) kennt `katalog` noch nicht; „N Termine“ im Tageskopf zählt weiter Termine, nicht Kacheln. `data/news-historie.json` behält die falsche Meldung „angekündigt 20.07.“ zu Snowball Earth unter „vergangen“.

## Erfassungswellen von „Im Angebot seit“: Nachbartage nicht mitzählen (13.10.2026)

Frage (Prüfer zu PR 1117): Soll ein Tag neben einer Welle (≥ 12 Titel je Anbieter und Tag, `STICHTAG_AB`) mitgefiltert werden, wenn er selbst ≥ 5 Titel hat? Gemessen am 13.10.2026 an `data/motn.json` (1.943 Shows, 779 Anbietertitel mit `seit`), je Anbieter Tage mit ≥ 12 Titeln und Titel an den Tagen ±1 bis ±2:

- **Prime Video:** 1 Welle (28.12.2025, 18); Nachbarn 27.12. = 9, 29.12. = 10, ±2 = 7 bzw. 0. Der einzige Fall mit Nachbartagen ≥ 5 (19 Titel im Archiv, davon 7 unsere: 6 am 27.12., 1 am 29.12.; alle vor 2026, also kein Kalendereintrag, nur das Datum am Titel).
- **Netflix:** 7 Wellentage am Stück (05. bis 11.03.2024, 14 bis 25); die Reihe ist schon vollständig gefiltert. Rand: 04.03. = 0, 12.03. = 4 (< 5, 2 unsere Titel).
- **Crunchyroll:** 08.01.2026 (29) und 31.03.2026 (234); Nachbarn höchstens 3.
- **Disney+:** keine Welle (größter Tag 10).

Entscheidung: nichts geändert. Von vier Wellen-Gruppen hat eine (Prime) Nachbartage ≥ 5, an einem Anbieter und in einem Fall. Eine Nachbarregel müsste eine Schwelle (5) setzen, die im Archiv nur diesen einen Fall trennt (die nächsten Nachbarn sind 4 und 3), und würde 7 unserer Titel ihr Datum nehmen, das möglicherweise doch echt ist: Prime-Tage mit 9 und 10 Titeln liegen im Bereich normaler Tage (Disney+ 25.09.2024 hat ohne Welle 10). Wiedervorlage: Taucht bei einer künftigen Welle (≥ 12) ein Nachbartag ≥ 5 auf, die Regel neu messen (`node tools/angebot-wellen-messen.mjs`).

## Eine MAL-Kennung, mehrere aniSearch-Seiten: Messung und Regel „Teilung“ (13.10.2026)

Anlass: Durarara!! Specials (MAL 8408) dreifach (AniList-Titel plus die Zeilen 10006984 und 10006986). Gemessen mit `tools/anisearch-mal-mehrfach.mjs` (Test: `tools/anisearch-mal-mehrfach.test.mjs`; Liste: `daniel-zum-abarbeiten/listen/anisearch-doppelte-kennung.md`): **79** MAL-Kennungen tragen zwei oder mehr aniSearch-Seiten (216 Seiten); **19** sind vollständige Teilungen, nur **3** davon im Hauptbestand (Durarara!! 8408, Angel Beats! 9062, Pokémon 106499); 16 unvollständig (Special/Bonus unter der MAL einer größeren Einheit, Summe passt nicht), 29 ohne AniList-Titel (jede Seite eine eigene Zeile), 15 schon getrennt (jede Seite hat ihren eigenen AniList-Titel).

**Regel „Teilung“, gebaut 13.10.2026** (nur vollständige Teilung; `entferneSammeltitel` in `bau/mal-teilung.ts` ruft sie in `baueTitel` auf; die Bedingung rechnet `ergebenSichZusammen` in `pipeline/lib/mal-teilung.ts` nach, Messwerkzeug und Bau benutzen dieselbe Funktion):
1. Gilt, wenn genau ein AniList-Titel A die MAL m trägt (auch im Katalog gezählt), mindestens zwei aniSearch-Seiten m tragen, jede Seite eine Folgenzahl und eine eigene Zeile hat, und deren Summe gleich `A.episodes` ist. **Deutsch spielt keine Rolle** (seit 14.10.2026, Daniel, F7: „wir wollen keine anilist einteilung mehr, nur noch so wie anisearch es macht“): Unser Konzept ist die einzelne Auflistung wie bei aniSearch, überall, auch im Katalog hinter dem Schalter.
2. Dann sind die **Seiten** das Werk (Titel, Termin, Deutsch, Beleg gehören zur Seite, Daniels Grundsatz „jede aniSearch-Seite ist ein Titel“); A ist nur der Sammelname und steht nicht zusätzlich da.
3. **Vorrang:** Trägt A einen Handbeleg (eine Handdatei unter `data/` nennt seine Kennung), bleibt er mit seinem Beleg stehen; die Regel löscht nichts, was ein Handbeleg nennt. Belege an den Seiten bleiben an ihrer Kennung.
4. Die Handbindung `A → Seite` (`8408: 6984`) ist keine Lösung: sie lässt die Zeile weichen, nicht A (Bau-Vergleich 13.10.2026: 10006984 verlor den deutschen Titel, `dubConfidence` high → normal).

Entschieden (Daniel, 14.10.2026, F7): „Seiten gewinnen“ gilt auch im Katalog hinter dem Schalter, ohne deutsche Fassung. Messung dazu im Absatz „Einzelne Auflistung überall“ unten. Durarara!! entschieden (Daniel, 13.10.2026): der Crunchyroll-Beleg liegt an Tenka Taihei (6986), der Sammeleintrag 8408 fällt mit der Regel weg.
**Einzelne Auflistung überall (14.10.2026, F7).** Die Deutsch-Bedingung ist weg; `findeTeilungen` verlangt nur noch eine Zeile je Seite, genau einen AniList-Titel mit der MAL und die passende Summe. Gemessen an `ohne-synchro.json` und `titles.json` (Listen: `daniel-zum-abarbeiten/listen/einzelauflistung-neu-geteilt.md` und `einzelauflistung-bleibt-zusammen.md`):
- Von den 16 „vollständigen“ Katalogfällen (Summe der Seiten = Folgen) kommen **nur 2** hinzu: Kimagure Orange Road OVA (2458, 1989, 8 Seiten zu je 1 Folge) und Fairy Tail (2014) OVA (150078, 2016, 3 Seiten). Die übrigen **14** (u. a. Aware! Meisaku-kun 21727, sechs Seiten) blieben zusammen, weil `hatZeile` verlangt, dass jede Seite eine eigene Zeile hat, und eine ihrer Seiten der AniList-Titel selbst trägt (`anisearchId`); gelöst im Absatz „Träger-Fälle“ unten (14.10.2026).
- Unvollständig bleiben **16** Gruppen (Summe der Seiten passt nicht zu den Folgen des AniList-Titels, eine Folgenzahl fehlt: Chiikawa 50250). Sie werden nicht umgebaut.
- Bau-Vergleich (Basis `409fb1801`, Kandidat `0a114b2fa`, mit Katalog, dessen MAL aus `ohne-synchro.json` ergänzt, weil der lokale Cache vom 03.09. keine MAL führt): 9 Dateien verschieden, alle zurückzuführen auf 2458 und 150078. Beide entfallen in `ohne-synchro.json` (17630 → 17628) und `franchises.json` (Fairy Tail verliert 150078 als Mitglied); ihre Seiten standen schon als Zeilen da (kein Zuwachs); `titles.json` ändert sich nur im Rang `tr`. **An Titeln mit Synchro ändert sich nichts.**
- Kennungen: Die beiden Sammeltitel hatten `ak` 2055 und 14276 (`data/kennungen.json`, bleibt stehen). Wie bei der ersten Teilung gibt es keine `zuAk`-Umleitung, weil kein eindeutiger Nachfolger existiert (8 bzw. 3 Seiten); eine gemerkte Kennung läuft ins Leere. Share-Seiten (`/t/<ak>/`) gibt es für Katalogtitel nicht.

**Träger-Fälle (14.10.2026, F7, Schritt 2).** Trägt der Sammeltitel selbst eine seiner Seiten (`anisearchId`), bekam diese Seite keine Zeile (`vergebeneSeiten` in `bau/anisearch-titel.ts`: ohne Deutsch und von einem AniList-Titel getragen), und die Teilung griff nicht. Jetzt gibt `freizugebendeSeiten` (`bau/mal-teilung.ts`) diese Seite frei, sobald die Teilung sonst greift: jede andere Seite hat eine Zeile, keine Handdatei nennt den Titel, **nur der Sammeltitel** trägt die Seite (`findeTeilungen` reicht ihm `hatZeile(zeilenId, sammelId)` mit). `ergaenzeAnisearchTitel` legt sie an, `entferneSammeltitel` und `katalogSammeltitel` lassen den Titel weichen. `anisearchDublettenAbziehen` fragt die Sammeltitel **vor** `zeilenMitKennungWeg`, sonst nähme die Kennungsregel die neue Zeile gleich wieder (der Titel trüge ja ihre Kennung).
- Betroffen sind die 14 Katalogfälle aus der Liste (alle ohne Deutsch, alle hinter dem Schalter): SF Saiyuuki Starzinger, xxxHOLiC Rou, Fairy Tail OVA, Hetalia Extra Episodes, Kuromajo-san ga Tooru!!, Hoozuki no Reitetsu OVA, Seitokai Yakuindomo OVA, Aware! Meisaku-kun, Wa Wa Wa Wappi-chan, Dragon Egg, Hentatsu, Move to the Future, Fanren Xiu Xian Zhuan, Fengzi Wuyu: Yinhe Pian.
- Bau-Vergleich (Basis = Umbau-Commit, Kandidat = Verhaltens-Commit, mit Katalog wie oben): 10 Dateien verschieden. `ohne-synchro.json`: 14 Sammeltitel entfallen, 14 Seitenzeilen kommen hinzu (`aniSearch-Dubletten`: 3 → 17 Katalogtitel entfallen); `franchises.json`: xxxHOLiC und Fairy Tail tauschen den Sammeltitel gegen die Seite; sonst Rang `tr`, Zähler in `luecken-titel.json`, 49 Katalog-`franchiseId` (der Vertreter der Gruppe wechselt auf die Seite mit der kleinsten Kennung), 7 Fairy-Tail-Zeilen `sharedWith` 7 → 8 (die neue Seite teilt die Crunchyroll-Serie wie ihre Nachbarn). **`titles.json` ändert sich nur im Rang `tr`**, kein Titel mit Synchro ändert sich.
- Nebenwirkung: Zwei Katalogtitel verlieren ihre Reihe, weil sie nur über den entfallenen Sammeltitel hingen: „Aware! Meisaku-kun: Ryuuguuchuu-hen“ (182545) und „Fanren Xiu Xian Zhuan Movie“ (195881) — dieselbe Folge wie bei jedem Sammeltitel (150078 in Fairy Tail). Behoben im nächsten Punkt.
- **Reihen der Träger-Fälle (14.10.2026).** Ein ausgeschiedener Sammeltitel (`katalogWeg`: Katalogkennung → Zeile) gibt seine AniList-Beziehungen an die Zeile ab. Im reinen Weg (Standard) wirkt das über die Zusatzkanten (`anilistKantenOhneKennung` in `bau/anisearch-reihen-rein-bau.ts`, Parameter `umhaengen`): beide Enden einer Kante werden auf die Zeile umgesetzt, bevor geprüft wird, ob ein Ende eine aniSearch-Kennung hat; wer eine Kennung hat, entscheidet weiter über aniSearch. Im Rückweg (`REIHEN_QUELLE=anilist`) setzt `erbeReihe` (`bau/anisearch-reihen-katalog.ts`) die Reihe der Gruppe des Sammeltitels auf die Reihe der Zeile, außer die Gruppe gehört schon zu einer ausgelieferten Reihe. Bau-Vergleich (Katalog mit ergänzter MAL, Basis `18480a0ca` gegen `0199c905b`): 3 Dateien verschieden, in `ohne-synchro.json` bekommen genau 2 Titel eine `franchiseId`: 182545 → 10011255 (Aware! Meisaku-kun, die sechs Seiten) und 195881 → 10014801 (Fanren Xiu Xian Zhuan); sonst ändert sich nur die Zählung in der Prüfliste des reinen Wegs (`inReihen` 11906 → 11908). Der Umbau davor (`18480a0ca` gegen `2d0610f18`) schreibt dasselbe (0 Dateien verschieden). Der Lokalcache führt die MAL nicht; die Prüfung `pipeline/check-reihen-traeger.ts` nimmt erfundene Titel und hängt nicht von ihm ab. Geprüft nur an diesen beiden Titeln; in der CI kann der MAL-Cache weitere Fälle liefern, sie laufen durch dieselbe Regel.
- Verworfen (Ansatz 2, `ohneDeutsch`-Ausnahme in `vergebeneSeiten` streichen, 2 Dateien, +2/−3 Zeilen): Bau-Vergleich 33 statt 10 Dateien, 73 statt 14 Zeilen hinzu und **Änderungen am Hauptbestand** (5 Titel `dubConfidence` very-high → high, Wege `dub` entfernt, `angebotSeit` weg, 5 `folgen/*.json`, ADN-Quellen) (Ursache nicht untersucht; der Weg ist ohnehin zu breit).
- Kennungen: Die Sammeltitel behalten ihre `ak` ohne `zuAk` (wie bei 2458/150078); Share-Seiten gibt es für Katalogtitel nicht. Die Seite 16369 hat bereits die `ak` 23318 (`kennungen.json`: drittes Feld 0 → 16369).

**Ergebnis des Bau-Vergleichs (13.10.2026, Basis 1052c49c0, mit Katalog):** Hauptbestand 2927 → 2924 Titel; es entfallen 8408, 9062 und 106499, in `ohne-synchro.json` ändert sich außer dem Rang `tr` nichts (die Sammeltitel kommen dort nicht wieder an). Nebenwirkung: Durarara!! (6746) bekommt seine Sprecher (`voices/6746.json`), weil 8408 nicht mehr dieselbe aniSearch-Kennung 5473 trägt. Damit der Katalog die Sammeltitel erkennt, tragen 8408, 9062 und 106499 ihre MAL-Kennung in `data/stammdaten/anilist-eingefroren.json` (der Cache führt sie nicht bei jedem Titel; ohne sie kämen die Titel hinter dem Schalter wieder). `MAL_AUSNAHMEN` verliert 6864, 6984, 6986, 11938; bis zum nächsten Bestandsbau trägt sie `MAL_UEBERGANG` (bis 16.10.2026, Test in `pipeline/check-mal-teilung.ts`).

## „Im Angebot seit“ 2026: Termine und Kern-Titel fehlten seit 27.08.2026 (13.10.2026)

**Befund (Analyst, 13.10.):** Daniels Entscheidung vom 27.08. (jedes „Im Angebot seit“-Release aus 2026 wird ein Kalendereintrag) wurde nie wirksam. **Ursache:** `rolleTermineAus` (`build.ts`) rechnet die Termine, bevor `13-3-listen.ts` (`motn-*`) und `13-7-erstausgabe-angebot.ts` (`anisearch-*`) ihre Releases anhängen; ebenso entstand `titles-core.json` (`schreibeKern`, `13-2-auslieferung.ts`) davor. Das Protokoll meldete trotzdem „auch als Kalendereintrag“.
**Fix:** `pipeline/bau/13-7-angebot-termine.ts` rechnet die Termine der späten Releases nach, sortiert sie in `events` ein (`nachTagUndZeit`) und hängt die Titel im Kern an (ohne Titel hätte die Karte weder Cover noch Namen; `check-wochen-datei` und die Saison-Ansicht lesen den Kern). **Der Kern ist damit nicht mehr „klein“:** `schreibeKern` läuft weiter davor, die späten Titel kommen danach dazu (Umkehr der Begründung aus #1093; die Titel dienen dem Blättern in der Vergangenheit, Kurzsatz-Alternative unten). **Erfassungsstichtage:** `pipeline/bau/angebot-stichtag.ts` (Schwelle `STICHTAG_AB` = 12) lässt Tage aus, an denen ein Anbieter 12 oder mehr Titel auf einmal „im Angebot seit“ hat; das ist der Tag der Erfassung, nicht der Zugang. Gemessen an `data/motn.json` (197 Anbietertage): Normalfall 1 bis 10 Titel je Tag, dann Lücke 11–13, ab 14 Wellen (14, 18, 19, 21, 25, 29, 234); Crunchyroll 08.01.2026 (29) und 31.03.2026 (234) und Netflix 05.03.2024 (14) fallen weg (Fairy Tail, Durarara!!, Rilakkuma verlieren `angebotSeit`), Prime 29.12.2025 (10) und 06.10.2026 (3) bleiben. Der Filter (`13-3-angebot-seit.ts`, `fruehesterAnbieter`) wirkt auch auf `titles.json`: 126 Titel verlieren `angebotSeit` (116 statt 242 behalten es), bei 7 wechselt der Anbieter. Prüfungen: `check-angebot-seit.ts`, `check-angebot-stichtag.ts`, `check-angebot-bestand.ts`; Nachbartage zählen nicht mit (Messung im Abschnitt davor).
**Endstand (Vergleichsbau mit Ersatz-Cache, 13.10.2026):** +71 Termine (56 MOTN, 15 aniSearch-Erstausgabe), `eventCount` 3720 → 3791, 611 Titel im Kern; `titles-core.json` gzip +18,6 KB (Prüfer-Nachmessung; Bauer 18,2 KB), roh +99 KB (vor dem Filter +27 KB gzip bei 109 Terminen); in der Zukunft 0, in den letzten sieben Tagen (Abo-Feeds) 2. 220 Termine tragen `imAngebot` (71 neu, der Rest sind Katalog-Termine, die es vorher schon gab). Ein Kurzsatz je Titel (id, Namen, format, episodes, coverImage, streams, angebotSeit) brächte etwa +6 KB statt +18,6 KB (Vorschlag des Prüfers, nicht umgesetzt; ob das Detail-Panel damit auskommt, ist ungeprüft).
**Wortlaut und Kachel:** `ReleaseEvent.imAngebot` (aus `Release.dateMeaning: 'available-from'`, `expandEvents`) → Kalenderdatei und Google-Link: Titel „Name (neu bei ADN)“ (Anbieter des Termins, bei TV der Sender), Beschreibung „Im Angebot seit diesem Tag – nicht der Erscheinungstag der deutschen Fassung.“ (`shared/ics.ts`), Newsletter: die Marke „Neu bei ADN ›“ ist selbst der Link zum Anbieter (kein zweites „ADN ansehen“). Die Kachel in Woche und Monat sagt „Neu bei ADN“ (`artName`, Anbieter des Termins mit Marke; die Zeile darunter und die Beschriftung der Monatspunkte lassen den Anbieter dann weg, bei mehreren Anbietern bleibt die Liste: `anbieterZeile`, `anbieterNamenDerKachel`; einspaltig seit 14.10.2026, `istBreit`, Fahnenfarbe `ak-marke`; `web/src/lib/kachel-folgen.ts`, `KartenArt` `imAngebot`, Tooltip mit „nicht der Erscheinungstag“); der Monatspunkt bekommt dafür keinen Ring (ein Ring in der Akzentfarbe sähe wie ein Staffelstart aus). Prüfungen: `check-angebot-termine.ts`, `check-kachel-im-angebot.ts` (check:logic), `check-angebot-bestand.ts` (check:bestand, grün erst nach dem nächsten Bestandsbau auf `main`).

## „Erstveröffentlichung“ statt „Neu bei“ (14.10.2026, F9)

**Regel (Daniel, 14.10.):** „Erstveröffentlichung“ nur, wenn kein Anbieter vorher die deutsche Fassung hatte; ein später dazugekommener Anbieter heißt „Neu bei X“. **Befund (Prüfer 19:04):** 17 von 315 „Neu bei“-Terminen liegen genau auf dem Tag, den aniSearch als deutsche Erstausgabe mit belegter Synchro nennt (Darwin’s Incident, Prime, 06.01.2026; 15 `anisearch-*`, dazu `motn-180746` Netflix 07.01.2026 und Hensuki, Crunchyroll 21.10.2021). Der Hinweis „nicht der Erscheinungstag der deutschen Fassung“ stimmte für sie nicht.
**Umsetzung:** `pipeline/bau/erstausgabe-markieren.ts` (`istErstausgabe`, `markiereErstausgabe`) setzt `Release.erstausgabe`, wenn (1) das Release ein Katalogdatum ist (`available-from`, nicht Fernsehen, nicht Disc), (2) `deErstausgabe.synchro` und `deErstausgabe.von` genau auf `schedule.firstEpisodeDate` fallen, (3) kein anderer Termin des Titels (Streaming, Fernsehen oder Disc; nicht widerlegt) vor diesem Tag liegt, (4) kein Nein-Handbeleg (`dub: false`, `neinHandbelege`/`wegVerneint`) den Anbieter verneint und (5) die Synchro an diesem Tag belegt ist: Termin mehr als 30 Tage nach dem japanischen Start (`jpStartTag`, Schwelle `istNahAmJapanStart`, dieselbe wie in `09-5-weitere-quellen.ts`; fehlt der Starttag, gilt es nicht), Handbeleg „Premiere“ im Streaming ohne frühere Ausgabe (`Release.premiere`) oder Netflix-Eigenproduktion. **Warum (5), 14.10. Runde 2:** `deErstausgabe.synchro` ist nur das „dubbed“-Kennzeichen der deutschen aniSearch-Zeile, kein Beleg „ab diesem Tag synchronisiert“; 13 der 17 Termine lagen 0–1 Tage nach dem japanischen Start, dem Tag des OmU-Simulcasts. Bleach „The Calamity“ (Disney+, 25.07.2026) war falsch markiert: `data/dub-confirmed.yaml` führt „Derzeit nur mit Untertiteln“ (20.08.), am 08.10. hatten erst die Folgen 1–6 deutschen Ton. `expandEvents` schreibt dann `ReleaseEvent.erstausgabe` statt `imAngebot`. **Zwei Aufrufe**, weil die Termine in zwei Phasen entstehen: vor `rolleTermineAus` (`10-komplettabwurf.ts`, frühe Releases: 1 Termin) und vor `ergaenzeAngebotTermine` (`13-schreiben.ts`, späte `motn-*`/`anisearch-*`: 16 Termine). Leser des Wertes: Kachel in Woche und Monat (`kartenArt` → `erstausgabe`, Fahne „Erstveröffentlichung“, einspaltig, ohne Ring; das Wort trägt eine Trennstelle U+00AD, sonst schnitt die schmale Desktop-Kachel es ab, Bilder auf dem Zweig `bilder/erstveroeffentlichung`, nach dem Merge zu löschen), Kalenderdatei und Google-Link („Name (Erstveröffentlichung bei X)“, Beschreibung „Erster Tag der deutschen Fassung, laut aniSearch.“), Newsletter (Marke „Erstveröffentlichung bei X ›“ ist der Link), Karte beim Teilen (`og-termin.ts`: „Erstveröffentlichung“).
**Gemessen (Bauvergleich, Ersatz-Cache, 14.10.2026):** Runde 1 (df9930c89 gegen fb55ce9ab): 17 Termine `imAngebot` → `erstausgabe`. **Runde 2 (46bf601ed gegen 5e745069c): 14 davon zurück auf „Neu bei“, es bleiben 3** (Hensuki, Crunchyroll, 836 Tage nach Japan; Milky Subway und Gintama, beide Netflix, Filme 115 und 197 Tage nach Japan); Mission: Yozakura Family bleibt „Neu bei“, weil AniList keinen Starttag hat. Der Umbau (`istNahAmJapanStart` aus `09-5` ausgelagert) schreibt dasselbe (`46bf601ed` gegen `4942bef95`: gleich). `check-handbelege.ts` hält fest, dass kein Release `erstausgabe` trägt, wo ein Nein-Handbeleg den Anbieter verneint (rot auf dem Stand der Runde 1 mit Bleach, grün jetzt). Am Bestand hält `check-angebot-bestand.ts` fest: jeder Katalogtermin trägt genau eine Marke, jede Erstveröffentlichung liegt auf dem aniSearch-Erstausgabetag. Die beiden Aufrufer im Bau (`10-komplettabwurf.ts`, `13-7-angebot-termine.ts`) prüft `check-erstausgabe.ts` über austauschbare Nähte (`rolleTermineAusMitKomplettabwurf(args, { rolle, handNein })`, `ergaenzeAngebotTermine({ events, releases, ab, slim, titles }, { handNein, kern })`; ohne Naht gilt der echte Standard, den `check-erstausgabe.ts` mit dem Nein-Handbeleg zu Titel 98320 bei Prime festhält; Mutationsprobe 15.10.2026: Standardwerte und `alle` je rot), weil `rolleTermineAus` und `titles-core.json` nach `data/` schreiben; `check-angebot-bestand.ts` hält zusätzlich fest: keine Erstveröffentlichung bei früherem Termin des Titels (Disc eingeschlossen). **Nicht in dieser Änderung:** Kanäle eines echten Anbieters (Crunchyroll-Kanal bei Prime) ohne eigenen Termin, ein deutscher Weg ohne Datum als Grund für „Neu bei“ bei Staffelstart (Snowball Earth), das Detail-Panel (sagt weiter „Bei X im Angebot seit …“). **Vorbehalt:** Der Verlag in aniSearch muss nicht der Anbieter des Termins sein (Shiboyugi: Verlag Crunchyroll, Termin Netflix); der Tag stimmt, ob der Anbieter derselbe ist, sagt aniSearch nicht.

## Synchro-Fortschreibung nach den Originalterminen (15.10.2026)

**Anlass:** Tomb Raider King, Folge 12: Die Wochenfortschreibung (`termineAusPlan`) setzte sie auf den 14.10., das Original pausierte vor dem Finale eine Woche und die Synchro folgte mit konstant +20 Tagen (11 Folgen) — richtig 21.10. **Regel:** Hat ein wöchentliches Release mindestens 4 Folgen mit Synchro- und Originaltag (`data/tmdb-folgen.json`, genau eine TMDB-Staffel ab 1) und streuen die Abstände höchstens 1 Tag, liegen die offenen Folgen bis zur Folgenzahl des Releases auf Originaltag plus Abstand. Nur wenn das vom Wochentakt abweicht, wird `schedule.nachOriginal` geschrieben (`shared/synchro-original.ts`, Phase `pipeline/bau/synchro-nach-original.ts`, aufgerufen in `10-komplettabwurf.ts`); gelesen von `expandEvents` und `lastEpisodeDate`. Beobachtung und Stützpunkte schlagen die Tabelle; das Ergebnis bleibt `estimated`. Feste Sendetage (Fernsehen) sind ausgenommen.
**Gemessen (Vergleichsbau, Ersatz-Cache, 15.10.2026):** genau ein Release ändert sich (Tomb Raider King: Folge 12 neu am 21.10., der 14.10. bleibt als „nicht erschienen" stehen, `eventCount` 3843 → 3844, ICS +1). Ohne die Abweichungsregel hätten 13 Releases eine Tabelle bekommen, bei 12 davon gleich dem Wochentakt. Gegenbeispiel „The Maid I Hired Recently Is Mysterious": Abstände 13 und 20 Tage, Streuung 7 → keine Tabelle. Auch keine Tabelle: Polar Opposites S2 (mehrstaffelig), cr-GT00378078 (Streuung 7), Seven Knights (2 Beobachtungen).
**Mindestabweichung (Nachtrag 15.10.2026):** Die Tabelle beginnt erst bei der ersten Folge, die mindestens 2 Tage vom Wochentakt abweicht (`MIN_ABWEICHUNG_TAGE`); ein Tag ist TMDB-Streuung. Rückrechnung `npx tsx tools/synchro-original-rueckrechnung.ts` (jede Beobachtung ab der 5. aus den Folgen davor vorhergesagt, 53 abweichende Vorhersagen): bei 26 Ein-Tages-Abweichungen stimmte 26-mal der Wochentakt, nie die Tabelle; ab 2 Tagen stimmte die Tabelle 19-mal, 6-mal nicht. Gegen den Wochentakt: 23-mal näher am wirklichen Tag, 2-mal schlechter. Echte Fehlgriffe (Takt richtig, Tabelle falsch) sind nur Play It Cool F13 und Fairy Tail F25 (7 Tage: die Synchro folgte der Pause nicht); Seven Mortal Sins F12 und Quality Assurance F5 liegen 1 Tag daneben, Zom 100 F10 und Ayakashi Triangle F7 liegen 14 bzw. 35 Tage daneben, der Wochentakt aber 99 bzw. 189. Kein Merkmal (Versatz, Größe der Abweichung, Staffelgrenze) trennt die Fehlgriffe von den Treffern. Weitere Folgen: die Tabelle beachtet `skipDates` (Sendepause am Tabellentag = eine Woche später), das Staffelfinale steht nur am Ersatztag (nicht am ausgebliebenen Vermerk), `schedule.nachOriginalQuelle` führt die TMDB-Seite als Grundlage der Schätzung (Quellenübersicht; bewusst nicht in `sources`, die Belegprüfung und die News lesen sie als Beleg), und der Kasten schreibt bei geschätztem Ersatztag (ohne recherchiertes `neuErwartet`) „erwartet statt … (geschätzt)“ statt „verschoben vom …“.
**Grenzen:** TMDB-Tage sind ±1 Tag; nur die Tageszahl, keine Uhrzeit. Titel ohne TMDB-Einträge oder mit mehreren TMDB-Staffeln bleiben bei der Wochenfortschreibung. Die Invariante `folgennummernEindeutig` zählt einen ausgebliebenen Tag nicht mehr als zweite Folge (wie `kalender-konsistenz.ts`), sonst bricht der Bau, sobald ein Ausfall einen Ersatztermin bekommt.

## Kalender-Plausibilität: fünf Widersprüche am gebauten Bestand (16.10.2026)

**Anlass:** Prüftisch 16.10.2026, 18 Datenfehler in sieben Tagen, davon 16 ohne Wächter. **Regeln** (`pipeline/lib/kalender-plausibilitaet.ts`): erschienen, aber „Ohne bekannten Termin“; Ende belegt, trotzdem „≈“ oder geschätzter Termin danach; „Sprache offen“ trotz gemessenem Deutsch (`data/urteile.json`, Prime-Kanal ausgenommen); Ereignis ohne News (Start am Termin-Beginn ohne Meldung der Reihe, ausgebliebene Folge ohne „verspätet“, Crunchyroll-Folge der letzten 28 Tage ohne Meldung ±2 Tage; Abgleich über `franchiseId`, die News bündeln unter dem Kopf der Reihe); Termin ohne `sources`. **Wächter:** `check-kalender-plausibilitaet-bestand.ts` in `check:bestand` (Bestandsbau), Treffer je Regel dürfen nur sinken (`tools/kalender-plausibilitaet-grenzen.json`, gesenkt von `tools/commit-data.sh`). **Gemessen:** 0 / 0 / 10 / 2 / 15, Handprobe 5 je Regel alle echt (`daniel-zum-abarbeiten/listen/kalender-plausibilitaet.md`). Verworfene Fassungen: Abgleich über `titleId` (19 Fehlalarme, Reihen-Bündelung), Starts an Cour-Grenzen (2 Fehlalarme), Prime-Kanal mitzählen (133 von 143 Treffern ohne Beleg-Anspruch), Folge von heute (Abruf-Verzug).

## Cartoon-Aufnahme braucht einen Beleg (16.10.2026)

Lehre: Ein Genre-Riegel (Animation) trennt nicht Serie von Webvideo. „The Orange SMP“ (Minecraft-Fanprojekt, TMDB 329249) kam über den Lauf „angekündigt“ ohne `watch_region`. Seit 16.10.2026 braucht ein Cartoon ohne deutschen Anbieter ein Netzwerk, das kein Webkanal ist, oder ein Studio (`pipeline/lib/cartoon-aufnahme.ts`); der Eintrag bleibt in `data/cartoons.json`, nur `schreibeCartoons` blendet ihn aus. Wächter: `check-cartoon-aufnahme.ts` (check:logic), `check-cartoon-aufnahme-bestand.ts` (check:bestand). Gemessen 16.10.2026: 11 von 924 Cartoons betroffen.

Restlücke (16.10.2026): Ein Netzwerk gilt als Beleg, auch wenn es ein Fan-Kanal ist („Ian Channel (US)“ bei „The Sister Hand and Twilight Sparkle Show“), und ein Studio auch, wenn es eine Einzelperson ist („JS Productions“ bei „Battle for the Apps Server!“). Beides lässt sich aus den TMDB-Feldern nicht belegen; erst `type`/`production_countries` aus TMDB könnten helfen. Das Studio „Independent“ (HaneKage) zählt seit dem Nachtrag nicht als Studio. Ablauftest des Baus: `check-cartoon-aufnahme-bau.ts` (check:logic, Kulisse über `AK_ROOT`).

## `empfehlung.json`: Pool für „Was gucke ich als Nächstes?“ (20.10.2026)

**Bau.** `bau/13-10-empfehlung.ts` (Aufruf in `liefereAus`, `build.ts`) leitet die Datei nach der Auslieferung aus `titles.json` und `franchises.json` ab (Logik in `shared/empfehlung-pool.ts`). Pool: Stream mit `dub === true`, nicht gesperrt, Bewertung ≥ 60 oder keine (20.10.2026: 1.357 Titel). Pro Reihe (`franchiseId`) bleibt der früheste Pool-Teil (`jpYear`, dann `id`) als Einstieg (711), mit Genres/Schlagwörtern als Indizes, FSK, Bewertung, Anbietern mit Synchro und Trailer-Marke; `reihe` führt jede andere Pool-Kennung auf ihren Einstieg. **Kein Cover, kein Banner** in der Datei (66 von 78 KB waren Bild-Adressen): der Client leitet sie aus `titles.json` ab oder lädt sie nur für gezeigte Titel.
**Flags.** `duell`: Teil 1 der Reihe (früheste Staffel laut `franchises.json`, auch ohne Synchro) liegt im Pool; nur solche Titel bilden ein Duellpaar. `ab`: Staffelnummer des Einstiegs (`staffelStaende`), wenn Teil 1 fehlt („Beginnt mit Staffel n“); bei Film oder Einzelstaffel steht keine Nummer. 20.10.2026: 643 `duell`, 39 `ab`, 29 ohne beides (Spezifikation 17.1 zählte 665/46 nach „frühester Teil in `titles.json`“; hier zählt `franchises.json` mit, daher strenger).
**Wächter.** `pruefeEmpfehlung` (Widerspruch bricht den Bau ab); fehlendes Cover ist im Bau und im Bestand nur eine Warnung (`coverHinweise`, sonst rollte ein neuer Titel ohne Cover den Tagesbau zurück); das Überschreiten der Grenze von 40 KB gzip (20.10.2026: 32,5 KB) ist im Bau eine Warnung, in der Bestandsprüfung ein Fehler. Tests `pipeline/check-empfehlung.ts`, Bestand `pipeline/check-empfehlung-bestand.ts`.

**Rechenkern (PR 2 von 4, 20.10.2026).** `shared/empfehlung-kern.ts` und `shared/empfehlung-vektor.ts` rechnen die Duelle ohne DOM und ohne Node: Merkmalsvektor je Einstieg (Genres und Schlagwörter mit mindestens 5 Einstiegen, dazu Film, Jahrfünft, FSK, Länge mit halbem Gewicht), Paarwahl (40 Zufallspaare, bestes nach Abstand und Teilung nahe 50:50, nur Einstiege mit `duell`), Eingrenzung (wer dem Sieger näher liegt, nie unter 12), „Kann mich nicht entscheiden“ (Menge bleibt, nächstes Paar quer zum übersprungenen), fünf Vorschläge mit Verworfenen und Zurück. Der Zustand ist reine Daten (JSON), das Paar eine Funktion von Zustand und Startwert, `Sitzung` hält den Verlauf für Zurück. Prüfung: `pipeline/check-empfehlung-kern.ts` (erfundene Datei, `check:logic`) und `check-empfehlung-kern-bestand.ts` (Simulation an der echten Datei, `check:bestand`; 20.10.2026: Treffer 43 / 55 / 61 % nach 4 / 6 / 12 Duellen, Spezifikation 17.3: 42 / 54 / 59).

**Ansicht (PR 3 von 4, 24.10.2026).** `#/empfehlung` (`ViewId` `empfehlung`, ohne Navigationseintrag; der Einstieg folgt mit PR 4) rendert `web/src/components/empfehlung/EmpfehlungView.tsx` als Fläche über der Seite, geladen als eigener Chunk (`EmpfehlungLazy`, Aufruf aus `SeitenAnsichtLazy`). Ablauf: Einleitung → 6 Duelle (`Duell.tsx`) → fünf Vorschläge (`Vorschlaege.tsx`) → Leinwand mit zweiter Ebene (`Leinwand.tsx`, Trailer über `TrailerKino` aus `detail/kino.tsx`); „Noch vier Duelle – genauer“ bis 10, „Von vorn“ lässt Verworfene und Gesehenes stehen. Rechnung nur über `shared/empfehlung-kern.ts`; Ablaufhilfen ohne DOM in `web/src/lib/empfehlung-reise.ts` (Test `pipeline/check-empfehlung-ansicht.ts`). Speicher: `empfehlung:gesehen`, `empfehlung:verworfen` (endgültig, einzeln zurückholbar), `empfehlung:anbieter` (Vorrang für eigene Anbieter, vorbelegt aus `meineAnbieter`; Vorrang = die eigenen rücken innerhalb der ersten 20 der Rangliste nach vorn, kein Filter). ★ ist der echte Favorit (`useFavorites`). **Bilder:** `empfehlung.json` trägt keine Bild-Adressen; die Ansicht holt Cover, Banner, Trailer und Anbieter-Links aus `titles.json` (`loadAllTitles`, ≈ 800 KB gzip) parallel zum Pool — Stand, bis eine schlanke Bild-Datei folgt. Liegt die Restmenge an der Untergrenze (≤ 12), nennt der Text keine Zahl.

**Umbenennung und Duell-Animation (26.10.2026).** Die Ansicht heißt „Entdecken“, die Adresse `#/entdecken` (`ViewId` `entdecken`); der veröffentlichte Link `#/empfehlung` führt über `ALTE_ANSICHTEN` in `router.ts` dorthin (entfernen frühestens 31.12.2026). Dateinamen und Bezeichner `empfehlung-*` blieben. Ein Duell läuft über `web/src/lib/empfehlung-duell-steuerung.ts`: Eingabe sofort gesperrt, Stoß 150 ms, Abgang 350 ms, danach Wechsel des Paars erst, wenn dessen Bilder per `img.decode()` fertig sind (`empfehlung-duell-bilder.ts`, Höchstwartezeit 5 s); bis dahin Platzhalter, nie das alte Cover. Zusicherungen: `pipeline/check-empfehlung-duell.ts`.

## Kopfzeile bei TV-Premiere, OmU-Adresse, „seit“ nur ohne Zukunft (21.10.2026)

**Anlass:** Daniel, Yaiba und Failure Frame. **Regeln:** (1) `deutschBegonnen()` (`web/src/components/detail/antwort-regeln.ts`): „fertig“ („Alle 24 Folgen auf Deutsch“) braucht einen Stream mit Tonspur, eine erschienene deutsche Folge oder eine deutsche Erstausgabe bis heute; `hasVoices` allein belegt keinen Beginn, ein künftiger TV-Termin ist dann „Erste Folge …“ (Welt Worktree-Bestand 21.10.2026, 2.922 Titel gegen den Code davor: genau ein Wechsel, Yaiba). (2) `adresseIstOmu()` (`shared/omu-adresse.ts`): „omu“ als eigenes Wort im Pfad macht die Pille zu „nur Untertitel“ (28 Wege, Pillen „nur Untertitel“ 4 auf 32; „-sub“ zählt nicht, es trifft nur Crunchyroll-Folgenadressen mit Tonspur und „blue-submarine“); sind alle Zeilen nur Untertitel, sagt der Kopf „Anbieter, nur Untertitel“ (10 Titel vorher „Sprache offen“). (3) `deSeitZeigen()` (`web/src/components/detail/de-seit.ts`): „Auf Deutsch seit {Tag}“ nie mit Tag nach heute (10 Titel hatten die deutsche Disc als `von` in der Zukunft) und nicht, wenn ein Anbieter mit Tonspur am selben oder früheren Tag begann (8 Titel). (4) Kaufausgabe-Zeile, Uhrzeit-Herleitung in `Release.note` und die Legende „Sprache offen“ entfallen; die Marke heißt „Sprache offen“ wie der Kopf und entfällt, wo der Kopf „Anbieter, Sprache offen“ schon steht (`kasten-marke.tsx`). (5) Eine belegte TV-Premiere (`premiereBelegtTv`) trägt in der Meldung `premiere: true` (nur bei neu erzeugten Meldungen; `historie.premiere`, `news-einfrieren.ts`) und heißt „Deutsche TV-Premiere bei … am …“ (Seite, Mail); gebaut nur für `angekuendigt`, bestehende Sätze anderer Meldungen bleiben. **Wächter:** `pipeline/check-kopfzeile-premiere.ts` (check:logic).
