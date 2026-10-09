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

Das erste Bild des gebauten Panels zeigte drei Fehler, die kein Datenblick fand: Die Pille war nur blasser, nicht durchgestrichen. Daneben stand ein alter Abgang („Prime Video — nicht mehr abrufbar"), obwohl Prime jetzt einen gültigen Weg hat. Und der Bezugsweg „Amazon Prime (Crunchyroll)" auf einer dritten Kennung stand ungestrichen neben der gestrichenen Kanal-Ausgabe. Dazu trug „Date a Live II" die Kanal-Seite von Staffel 4, weil die Meldung damals an mehrere Titel der Reihe verteilt worden war. Seitdem: Abgänge fallen am Ende weg, sobald der Anbieter wieder einen Weg hat. Bezugswege desselben Kanals wandern zur Ausgabe ohne Deutsch. Eine Adresse mit Belegen bei mehreren Titeln wird nicht gezeigt. `check:logic` sichert, dass keine Ausgabe ohne Deutsch ohne deutschen Verweis daneben oder zugleich als Verweis dasteht.

**Prüffrage bei jedem Widerspruch zwischen einer Meldung und einer fremden Quelle:** *Meinen beide dieselbe Ausgabe?* Der Abschnitt „Ein Beleg gehört einer Ausgabe, nicht einem Titel" (07.09.2026) zog diese Trennung für unsere Belege. Für die zweite Quelle fehlte sie.

## Eine Notiz für Besucher ist keine Notiz über unsere Zuordnung

Daniel am 13.09.2026 zu „Zum Start am 19.08.2026 standen die Folgen 1 bis 3 gemeinsam bereit, danach geht es im Wochentakt weiter" im Antwort-Kasten: „das interessiert nicht als textform, wir schreiben bereits wieviele folgen draussen sind … rückblickende gebündelte releases sind uninteressant … das ist höchstens für uns interessant."

Gezählt waren es 288 Notizen, und die meisten gehörten zu dieser Sorte — erzeugt vom Bau, um eine Zuordnung zu erklären: „Deutsche Fassung bei Crunchyroll — 12 Folgen mit belegtem Termin (Block …)" (232×), „ADN führt diese Staffel als Folgen …", „Crunchyroll führt dazu bisher genau einen deutschen Termin", „Crunchyroll zählt die Reihe durch", „Automatisch übernommen aus …". Seitdem gibt es zwei Felder: `note` für Besucher (ein Termin, dessen Tag nicht feststeht; ein Film ohne FSK-Freigabe; Tonspuren einer Disc) und `herkunft` für uns. Panel und Teilen-Seiten zeigen nur `note`; die Bestandsprüfung liest beide als Erklärung einer auffälligen Folgenzahl.

**Prüffrage vor jeder neuen Notiz: Macht der Besucher etwas anders, weil er sie liest?** Wenn nein, ist es `herkunft`.

## Ein Teil gehört zu seiner Staffel — gezählt wird über den Namen, nicht über die Position

Daniel am 13.09.2026 an Mushoku Tensei, mit zwei Bildern: Über der dritten Staffel stand „Staffel 5", und der erste Listeneintrag hieß wie die Reihe. AniList führt die zweite Hälfte einer geteilten Staffel als eigenen Eintrag („Cour 2"), und Kopf wie Liste zählten nach Position — Kopf über `istStaffel`, Liste über `istHauptstaffel`, zwei Rechnungen für dieselbe Frage. Seitdem beantwortet `staffelBeschriftungen()` in `shared/titles.ts` sie für beide: Ein Name mit Staffelnummer setzt die Staffel, ein Name nur mit „Teil N" gehört zur Staffel davor, und hat eine Staffel Teile, heißen alle „Staffel N - Teil M" (bei einer einzigen Staffel nur „Teil M"). Nummern gibt es erst ab zwei Staffeln ohne eigenen Namen, sonst hieße One Piece wieder „Staffel 1".

Gemessen über alle 769 Reihen in `franchises.json`: 14 mit Teilen, alle stimmig, darunter Attack on Titan, Re:Zero, Schleim und die Apothekerin mit japanischem Teil-2-Namen. Der Lauf fand dabei „Kengan Ashura: Staffel 2 — Part.2" — `eindeutschenStaffel()` kannte „Part" nur ohne Punkt. **Eine Namensregel wird über den ganzen Bestand laufen gelassen, bevor sie gilt**; der eine Fall, an dem sie gebaut wurde, zeigt ihre Lücken nicht.

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
  bzw. „Deutsche Fassung nicht geprüft") — TMDB nennt Anbieter, keine Tonspuren.
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
  Push-Dienst in `App` (`usePushNachfuehren`, vorher nur bei geöffneter Favoriten-Ansicht), der
  AniList-Import unter „Nur Favoriten“ im Filterfeld.
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
- **Vergangenes** dimmt nur Bilder (`.ak-vorbei`), Text wechselt auf `--ak-leise` — `opacity` am
  ganzen Tag drückte jeden Text unter 4,5:1 (axe, 26.09.2026).
- **Schwebekarten** (`Schwebe.tsx`) stehen nie über der Kopfleiste oder dem Auslöser und rollen
  in sich; per Klick geöffnet bekommen sie den Fokus, Escape schließt und gibt ihn zurück.
- **Wiederholungen** eines Tages bündelt weiter `buendeleTermine()`: im TV-Kasten „+2 bis 18:50“
  (Klick nennt die Zeiten), bei Streaming „+N Folgen“; nie über Sender hinweg, ausgebliebene Termine
  und Premieren nie eingeklappt. Zusicherung: `check:logic`, „Bündel: …“.
- **Farben und Schriften:** Variablen `--ak-*` je Thema in `styles.css`, in Tailwind `bg-ak-grund`,
  `text-ak-leise` usw.; Unbounded und Manrope selbst gehostet (`@fontsource`), nicht über Google
  Fonts — ein Abruf dort übermittelt die IP-Adresse.
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
links, Anbieter-Chips, Titel in Unbounded, Eckdaten als Raster, Wortmarke. Zu wissen:

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
erschienene Folge vor der Woche (`neuesteErschienen` für „N neu"). Reihenfolge der vollen Dateien bleibt. **Zusicherung** (Bau bricht ab, `check:logic` → `check-wochen-datei.ts`):
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

**Umsetzung der Dubletten (08.10.2026, Vorschlag 1 und 4).** Der AniList-Titel gewinnt: Er trägt MAL, Genres, Reihe und die Ankündigung; der aniSearch-Titel ist nur der Ersatz für „bei AniList nicht im Bestand" (`ergaenzeAnisearchTitel`). Die vier stehen jetzt in `data/anisearch-ids-hand.yaml` (204011 → 21084, 206814 → 21566, 212503 → 21575, 213457 → 21751).
- **Reihenfolge ohne Lücke:** `fetch.ts` holt den AniList-Titel in den Bestand (`ausAnisearchHand`, auch ohne Deutsch); die aniSearch-Zeile entfällt erst, wenn er in `titles` steht (die Handdatei sperrt wie `data/anisearch.json` nur dann, vorher unbedingt). Fehlt er, bleibt die Zeile — kein Werk geht verloren. Die Handdatei zählt auch für `anisearchUmgezogen` und `dubNurHinterToggle` (Verlust-Riegel).
- **Was mitwandert:** die deutsche Erstausgabe der aniSearch-Zeile (`erstausgabeUebernehmen`); der Tag in `data/synchro-historie.json` (sonst „neu mit Synchro" und eine Mail für Psyren und Hyouken); der Slug der automatischen Termine von Beerus und Fool Night (`ALTE_AUTO_KENNUNG` in `lib/meldungen.ts`: Teilen-Adresse `/r/auto-10021566-crunchyroll/` und Termin-Verlauf reißen nicht ab, sonst stünde „Termin zurückgezogen" in den News).
- **Zusicherung** (`check:logic`, `lib/mal-dubletten.ts`): gleiche MAL bei einem aniSearch- und einem AniList-Titel nur mit Eintrag in `MAL_AUSNAHMEN` (16 Teile, 6 Zwei-Werke-Fälle, dazu Kitarou Tanjou „Shinsei-ban" als unsichere zweite Fassung, nicht angefasst). Die vier Dubletten gelten bis 15.10.2026 als Übergang, bis der Bau mit der Handbindung gelaufen ist; danach wird `check:logic` rot, solange eine bleibt. Die aniSearch-Katalogtitel hinter dem Toggle prüft sie nicht.
- **Grenze:** Hyouken II startet bei AniList am 09.10.; bis dahin liegt der AniList-Titel (ohne Termin) hinter dem Toggle, die Zeile fehlt im Hauptbestand. Am Tag nach dem Start (ab 09.10.) steht er im Hauptbestand.
- **Eigene Kennungen (`ak`):** Die `ak` der vier aniSearch-Zeilen war öffentlich (Adresse `/t/<ak>/`, Favoriten, versandte Mail-Links). `data/kennungen.json` trägt dafür ein viertes Feld `zuAk` (Nachfolger): `akVon` übersetzt die alte Kennung in die des AniList-Titels (News-Verlauf, Meldungen, Reihen nennen nie die alte); `build-share-pages.ts` schreibt `/t/<alt>/` als Weiterleitung (`noindex`), `ak-umleitung.json` (`[[alt, neu], …]`) schreibt gemerkte Titel um — im Browser einmalig je neuem Paar vor dem ersten Rendern (`web/src/lib/ak-umleitung.ts`, Marke `kennung:umleitung`, höchstens 1,5 s Wartezeit), im Worker beim Lesen jeder Liste (`worker/src/favoriten-lesen.ts`). Dauerhaft, anders als die Karenz bis 05.11.2026. Eine künftige Dublette: Zeile in der Handdatei, `zuAk` an der alten Zeile, ggf. `ALTE_AUTO_KENNUNG`.
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
(`zuAk`), sie stand nur hinter dem Schalter. Zusicherung: `pipeline/check-anisearch-dubletten.ts` (Teil von `check:logic`), mit Übergang bis 16.10.2026, bis der
nächste Datenlauf den Datensatz neu gebaut hat.

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

## Datenschutztext folgt dem Datenfluss (09.10.2026)

`DatenschutzView` (`StaticViews.tsx`) sagte, Favoriten „verlassen dein Gerät nicht“. Tatsächlich gehen sie mit Newsletter-Abgleich (`newsletterSync.ts`, Worker `/favorites`, auch Kalender-Feed) und Web-Push (`push.ts`, Worker `/push/abo`, Endpunkt plus Favoriten, Push-Dienst des Browserherstellers) an den Worker. Dritthosts im Browser: AniList-Bilder, TMDB (schon bei Hover/Touch auf das Cover im Panel per `preconnect`, `cover-max.tsx`; größeres Plakat und w92-Vergleich beim Öffnen der Vergrößerung), YouTube-nocookie erst beim Abspielen, graphql.anilist.co beim AniList-Import. Wer einen neuen Aufruf zu einem fremden Host oder neue Daten an den Worker einbaut, ergänzt den Text im selben Zug. Keine Rechtsprüfung; DSGVO-Pflichten unverändert.

## Saison-Ausblick: kommende Saisons nach Terminschärfe (09.10.2026)

Reiter „Ausblick“ der Saison-Ansicht (`SaisonAusblick.tsx`, Gruppenbildung `web/src/lib/saison-ausblick.ts`). Quellen: Hauptbestand (`jpYear`/`jpSeason`), `saison.json` und die eigene, erst im Reiter nachgeladene `saison-ausblick.json` (Bau: `pipeline/bau/saison-datei.ts`, Serien aus `ohne-synchro.json` nach der laufenden Saison, auch ohne Datum; Stand 09.10.2026: 364 Einträge, 12,5 KB gzip). Japan-Start steht so genau wie AniList ihn kennt (Tag, Monat, Saison, Jahr); die Gruppenüberschrift trägt Saison oder Jahr, die Karte nur Tag/Monat. Ein deutscher Termin erscheint nur, wo einer belegt ist (`estimated` → „voraussichtlich“); Anbieter sind die der Synchro oder der Synchro-Ankündigung. Nichts fällt weg: Titel ohne Saison stehen unter ihrem Jahr, Titel ohne jedes Datum unter „Ohne Termin“ (nur Namen, ohne Cover). Messung 09.10.2026 (Serien ohne Synchro, nach der laufenden Saison): 61 mit Monat, 64 mit Jahr, 239 ohne Datum; mit Tag nur die der nächsten Saison (in `saison.json`).
