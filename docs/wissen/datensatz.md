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

Daniel: TOGGO (nicht TOGGO plus) und YouTube sind kostenlose Wege; der Titel soll zeigen, ob er ganz oder teilweise frei zu sehen ist. `web/src/lib/kostenlos.ts` zählt je kostenlosem Weg: TOGGO die jetzt offenen Fenster, ein einzelnes Video eine Folge, sonst die deutschen Folgenbereiche; ohne Zahl ist der Weg „unbekannt". Wege werden nicht addiert (dieselben Folgen?), der größte gilt. Verglichen wird mit den deutschen Folgen der Kopfzeile, bei laufenden Serien ohne Gesamtzahl mit der größten belegten Zahl eines Anbieters (Beyblade X: Disney+ 100 gegen TOGGO 117 → „kostenlos"). **Ein Weg ohne Zahl macht nie „teilweise"** — er könnte den Rest abdecken; dann steht „auch kostenlos". **Seit dem 19.09.2026 ist Kostenlos ein eigener Bereich** (Daniel: „trenn die bereiche, sodass es besser visuell sichtbar ist"; das kehrt die Entscheidung vom 03.09.2026 um, die Zugangsart nur an der Pille zu nennen). Aus drei Entwürfen in drei Szenarien (1 frei + 3 Abo + 2 Kauf, 5 frei + 1 Abo, 5 frei + 5 Abo) gewählt: ein grün umrandeter Block mit dem Etikett als Überschrift, darunter „Abo", „Kauf / Leihe", „TV". Nebeneinander-Spalten stapelten sich bei vielen Pillen ohnehin, eine einzige Reihe mit Zwischenlabels zerfiel. Gegliedert wird nur, wenn es einen kostenlosen Weg gibt; der Bereich je Pille kommt als Schlüssel-Zuordnung (`pillenGruppen`) in den Kasten.

### TV-Pille: Folge, Tag, Uhrzeit, Premiere oder Wiederholung (19.09.2026)

Daniel: „im tv muss auch sagen welche folge an dem termin kommt + uhrzeit ist wichtig" und „premiere bzw wiederholung". `web/src/lib/tv-angabe.ts` nennt den nächsten Sendetermin („Fg. 19 · Mo 21:15 · Premiere"), sonst den letzten („zuletzt …"). Sichtungen zu verschiedenen Zeiten tragen jetzt `schedule.zeiten` je Folge. **Premiere** heißt: vor dem Sendetag keine deutsche Veröffentlichung — weder laut Folgenliste (`ersteDeutsch` aus Wikipedia-`EAD` bzw. RTL+-Start; ohne das hieß Dragon Ball Folge 1 von 1999 auf ProSieben MAXX „Premiere") noch im Streaming (Termine des Anbieters, sonst seine belegten Bereiche, `dub: true` ohne Bereich = alles). Disc zählt nicht.

### Pillen: neutral mit Markenstreifen, ✓ auf der Ecke, Premiere als Fähnchen (19.09.2026)

Drei Entscheidungen Daniels aus Entwürfen (je drei bis vier Varianten, dunkel und hell): Fläche neutral, Markenfarbe nur im Zeichen und als 3-px-Streifen links (vorher „rot auf rot"); der Synchro-Beleg als grünes ✓ auf der oberen rechten Ecke mit Tooltip, unbelegte ohne Zeichen („DE ✓" kostete ~35 px je Pille); „Premiere" als Fähnchen auf der oberen Kante (kostet keine Breite). Leitsatz: verfügbaren Platz wirksam nutzen. Die Pillenreihen haben dafür `gap-y-2.5` — Ecke und Fähnchen ragen über die Kante. `DubMark` („🇩🇪 ✓") bleibt in Favoriten und „Wo sehen?".

### „TV-Ausstrahlungen anzeigen" — ausgeschaltet bleiben Premieren (19.09.2026)

Der Schalter hieß „TV-Sendungen zeigen" und blendete alles Fernsehen aus. Daniel: umbenennen, Premieren bleiben sichtbar, der Zusatz in einen gekennzeichneten Tooltip. Der Filter in `App.tsx` fragt je TV-Termin `istPremiere` (`lib/tv-angabe.ts`). Der Hinweis hängt an einem eigenen ⓘ neben dem Schalter (Antippen zeigt ihn, ohne umzuschalten); `Tooltip` öffnet auf dem Handy jetzt beim Antippen für drei Sekunden — vorher nur bei Maus und Fokus. Der Kalender-Knopf an den Pillen sitzt als runder Eckknopf unten rechts, Rand und Symbol in der Markenfarbe (Google Material „calendar_add_on", Apache 2.0; Entwurf A2 — die erste Umsetzung als Symbol in der Pille war ein Missverständnis der Auswahl), mit eigenem Tooltip statt `title`; ohne Farbe (Kino-Banner) bleibt er rund in der Zeile.
