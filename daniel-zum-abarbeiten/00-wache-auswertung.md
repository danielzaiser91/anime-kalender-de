# Auswertung der Wache

Die Wache (`daniel-zum-abarbeiten/00-wache.md`) meldet, wenn der Bestand etwas
verliert. Sie kann nicht wissen, **warum** — hier steht es. Neue Auswertungen
kommen oben dazu, ältere bleiben stehen: An der Reihe zeigt sich, ob eine Lücke
wiederkehrt.

## 02.10.2026, 15:05 — durchgesehen, eine stumme Quelle gefunden

**Was läuft korrekt.** 0 rote Läufe in der Statusanzeige (`laeufe-aufraeumen.mjs --trocken`),
`check:vor-commit` grün, alle Quellen bis auf eine in ihrer Frist (`check-sources.ts`).

**Was falsch läuft — JustWatch seit 9 Tagen stumm.** Der Wochenlauf vom 28.09. (`36418896451`)
lief nach vier Minuten in eine Sperre (318× HTTP 429) und fragte im Sekundentakt weiter. Der
Plausibilitätsriegel hat richtig nichts geschrieben — aber damit auch die 26 guten Treffer
verworfen. Der Blocker steht korrekt in der Statusanzeige. Als Queue-Punkt in `status.md`, fällig
vor dem nächsten Lauf (Mo 05.10.).

**Was noch offen ist.** Der JustWatch-Punkt. Die Verwerfungen der Terminableitung wachsen langsam
(„Blöcke und Titel verschieden viele" 208 → 212 seit 28.09.) — beobachten, kein Sprung.

## 01.10.2026, 07:20 — durchgesehen, zwei stille Ausfälle gefunden und behoben

**Was läuft korrekt.** In der Statusanzeige stehen 27 gemeldete Läufe, **keiner** rot; `meta.generatedAt`
ist von heute 06:16, die Seite wird also gebaut. Die Wache-Datei steht seit dem 25.09. auf
„unauffällig" — das ist so gedacht (seit dem 26.09. wird nur ein **Befund** committet, Daniel:
„Behalten, still bei Ruhe"), und die Datei sagt es jetzt auch: Ihre Zeile nennt den letzten Befund,
nicht den letzten Lauf (`tools/wache-schreiben.mjs`).

**Was komplett falsch lief — acht Stunden Stillstand der Seite.** Der Deploy war dreimal rot
(30.09. 22:30, 01.10. 00:04, 06:17). Ursache war **meine** Prüfung aus der Nacht: `check:workflows`
hielt jeden **erwähnten** Pfad unter `daniel-zum-abarbeiten/` für einen **geschriebenen**. Meine neue,
handgeschriebene Anleitung `21-disneyplus-gruen.md` steht als Link in `report-start.ts`
(`datei: '…/21-disneyplus-gruen.md'`), nicht als Schreibziel — die Prüfkette brach damit **vor** dem
Bauen ab, und die Seite bekam keine neuen Daten. Behoben (`ab575abf2`): ein Pfad zählt nur, wenn im
Umfeld ein `writeFileSync`/`writeJson`/`writeText` steht; nachgemessen werden weiterhin **11** echte
Schreiber erkannt, keiner fehlt. Der Deploy danach grün.

**Der zweite stille Ausfall — drei Tage.** Der Wochenprogramm-Leser warf seit dem **28.09.** bei jedem
Stundelauf (der Artikel wechselte auf „vom 28.9. bis 4.10.", der Leser kannte nur ausgeschriebene
Monate). Der Schritt ist `continue-on-error`, der Lauf blieb grün, `data/crunchyroll-woche.json` stand
auf der Vorwoche — aufgefallen ist es erst, als eine daraus gebaute Farbauskunft die falsche Woche
zeigte. Behoben (`wocheAus` liest beide Schreibweisen, Zusicherungen in `check:logic`), der Datensatz
neu geschrieben. **Und die Bauart ist jetzt ausgeschlossen:** Der Leser meldet sich an `recordSource`
(Erfolg *und* Abbruch), schickt bei einem Abbruch einen Vorfall, `check-sources` führt ihn mit Frist
1 Tag, und `check:workflows` verlangt von jedem geduldeten Schritt, dass sein Skript `recordSource()`
oder `meldeAbbruch()` enthält — `termine-pruefen.ts` fehlte das ebenfalls und hat es jetzt.

**Wo echte Risiken waren.** Kein Verlust im Bestand, aber zweimal **Stillstand**, und den sieht die
Wache nicht: Sie zählt, was verschwindet. Der Deploy-Fall wurde nur gefunden, weil ich die Läufe
angesehen habe — nicht durch eine Meldung.

**Was noch offen ist.** Nichts Rotes. Die drei Deploy-Fehlläufe sind mit `ab575abf2` abgelöst; die
Wache-Datei bleibt bis zum nächsten Befund stehen.

---

## 29.09.2026, 08:16 — durchgesehen, einen seit drei Tagen roten Prüflauf gefunden

**Was läuft korrekt.** Von 30 Läufen der letzten Stunden sind 27 grün; die Wachläufe vom 26.–28.09.
alle grün, die Wache-Datei steht seit dem 25.09. auf „unauffällig" — so ist es gedacht (seit dem
26.09. wird nur ein **Befund** committet, Daniel: „Behalten, still bei Ruhe"). Der heutige Wachlauf
steht für 11:20 noch aus.

**Was komplett falsch lief — und drei Tage unbemerkt blieb.** „Aussehen prüfen" war seit dem
**27.09.** viermal rot: „der Schalter blendet die westlichen Titel wirklich aus — 2781 → 2781". Der
Schalter wirkt; **die Messung las die falsche Zahl.** Seit die Trefferzeile „N Anime **und M
westliche Serien** mit belegter deutscher Synchro" heißt, ist N um die westlichen schon vermindert —
die erste Zahl der Zeile kann sich beim Umlegen also gar nicht ändern. Gemessen wird jetzt die Summe
aus beiden (3696 → 2781, `2317fcdf`).

**Warum es niemand gesehen hat.** Von 18 Workflows melden elf an die Statusanzeige — dieser nicht,
obwohl seine Lauf-Art dort längst steht (`LAUF_ARTEN` im Worker kennt „Aussehen prüfen"). Genau das
war der blinde Fleck: Der rote Lauf stand in Actions, nicht in der Anzeige. Nachgetragen (`ed3a6240`).

**Wo echte Risiken waren.** Im Bestand keines. Ein Fehlerbild, das die Wache nicht sehen kann (wie
am 27.09. — falsche Angaben sind keine Verluste): 25 Netflix-Meldungen zu „The Dangers in My Heart"
trugen den Titel der zuletzt offenen Seite, „Shangri-La Frontier". Ursache war `document.title`,
das Netflix' SPA erst nach dem Seitenwechsel umsetzt; jetzt schlägt der Serientitel **dieser** Seite
(`stand.serientitel`) ihn (`96424e1f`, Zusicherung im Leisten-Prüflauf).

**Was die Wache nicht messen kann.** Dass ein Versprechen eingehalten wird: Die Neuigkeiten nennen
seit heute die Quelle, an der wir gelesen haben („inkl Link zur Quelle", Daniel). Und der
Datenbankverbrauch: acht Stunden nach den drei Großposten 3,4 % des Tageskontingents, der Rest ist
echte Übertragungsarbeit (gemessen, `80bac137`).

---

## 27.09.2026, 21:55 — durchgesehen, nichts offen

**Was läuft korrekt.** Wachläufe 23.–27.09.2026 alle grün, die Datei steht seit dem 25.09. auf
„unauffällig" (sie wird nur bei einem Befund neu geschrieben). Keine roten Läufe in der Statusanzeige.

**Wo echte Risiken waren — alle heute gefunden und behoben, keiner über die Wache.** (1) Vier
Staffeln mit angekündigter, noch nicht erschienener Synchro standen als deutsch (Last Boss S2,
Black Clover S2, Apothekerin S3, Reincarnated Aristocrat S3): Messungen vor dem Untertitel-Start
urteilten über sie; `vorDemStart()`, im Bestandslauf bestätigt. (2) Der Synonym-Abruf holte
Einträge ohne deutschen Namen in jedem Lauf neu — Blöcke drehten sich im Kreis; 30-Tage-Frist,
danach 1.134 Namen neu belegt. (3) Anime2You-Sammelartikel zu verschobenen Blu-ray-Terminen wurden
nie ausgewertet, 22 Disc-Termine standen auf überholten Tagen; greift mit dem nächsten Tageslauf.

**Was die Wache nicht sehen kann.** Alle drei waren falsche Angaben, keine Verluste — die Wache
zählt nur, was verschwindet. Ein Mittel dagegen ist Stufe 4 des Meldemodells (ein Urteil je Folge
statt 42 Setzstellen).

---

## 26.09.2026, 09:45 — durchgesehen, nichts offen

**Was läuft korrekt.** Wachläufe 21.–25.09.2026 alle „unauffällig“; zuletzt 2.776 Titel, 2.154 Urteile, 5 offen (+64 Urteile seit dem 20.09.). Die letzten 25 Läufe grün, keine offenen PRs. aniSearch liefert wieder (zuletzt ok 25.09.), seit die Kennung Browser-Signatur und Projektname trägt.

**Wo Verbesserungspotenzial ist.** Der Briefkasten hält 37 Meldungen (Prime 24, Netflix 13), 24 davon noch nicht gelistet — Nachzügler unter der 60er-Schwelle, kein Verlust.

---

## 20.09.2026, 21:25 — durchgesehen, nichts offen

**Was läuft korrekt.** Wachlauf vom 20.09.2026, 14:23, „unauffällig": 2.775 Titel, 2.090 Urteile, **4 offen**; über 24 Stunden +3 Titel und +25 Urteile. Briefkasten leer, Statusanzeige ohne roten Lauf, die Liste der ungeklärten Meldungen steht bei zwei Adressen.

**Die vier Auffälligkeiten sind meine eigenen Korrekturen.** Alle vier melden „primevideo: Synchro-Belege weniger" und stammen aus dem Durchgang vom 19./20.09.: zurückgenommene Belege ohne Urteil (JoJo-Sammelseiten, Fushigi Yuugi, Edens Zero Staffel 2) und drei Belege, die das Messskript `prime-geteilte-adressen.mjs` als „belegt gar nichts" ausgewiesen hat. Kein Verlust, sondern gelöschte Behauptungen.

**Wo echte Risiken waren.** Einer, und die Wache konnte ihn nicht sehen, weil nichts verloren ging: Rund 300 von 643 Prime-Verweisen standen unter `amazon.de/dp/<ASIN>` und antworteten dort mit 404, während unser Linkbefund „lebt" lautete — die Prüfung weicht bei einem 404 still auf die Video-Adresse aus und bucht den Erfolg unter der alten Adresse. Gemessen an fünfzehn Verweisen: sieben tot unter `/dp/`, fünfzehn von fünfzehn lebendig unter `/gp/video/detail/`. Behoben, der Bau richtet die Adressen jetzt zum Schluss.

**Die 264 verworfenen Ableitungen kosten keine Termine** (nachgemessen am 21.09.2026, 06:57). 33 der Fälle betreffen Serien mit einer gerade laufenden Staffel; für neun davon ist die letzte beobachtete Folge mit Crunchyrolls deutschen Folgen verglichen worden — Re:Zero S4 13/13, Tanya S2 8/8, Classroom of the Elite S4 16/16, Slime S4 20/20, Rent-a-Girlfriend S5 12/12, Iruma-kun S4 23/23, Trapped in a Dating Sim S2 8/8, Skeleton Knight S2 11/11, Black Clover S2 startet erst. Neun von neun ohne Lücke: Der Simulcast-Kalender liefert die Beobachtungen ohnehin, die Ableitung aus der Serienseite ist ein Zusatzweg für Folgen vor dem Kalenderfenster.

**Nachtrag, 21.09.2026, 06:55 — zwei rote Bauläufe in der Nacht.** 22:34 und 01:17 brach der Bau ab, weil zwei Titel aus dem Datensatz gefallen wären: Black Clover S2 (Start 03.10.) und die Apothekerin S3 (Start 01.10.). Der Riegel „kein deutscher Eintrag bei Crunchyroll — verworfen" galt auch künftigen Starts, und das Kalenderfenster reicht zwei Wochen voraus. Behoben (verworfen wird nur ein Start, der schon war), Zusicherung in `check:logic`, der Bau danach grün. Die Statusanzeige war bereits leer.

---

## 19.09.2026, 23:55 — durchgesehen, nichts offen

**Was läuft korrekt.** Letzter Wachlauf 19.09.2026, 13:55, „unauffällig": 2.772 Titel, 2.065 Urteile, 4 offen; über 24 Stunden +1 Urteil, −38 offen. Am Abend kamen im Durchgang rund 40 Belege dazu (JustWatch-Kandidaten, JoJo, Grisaia); die nächste Wache zeigt sie.

**Die Verlustzeile ist gewollt.** „19.09., 01:20 verweise −37, ohneUrteil −37": die 37 toten aniSearch-Adressen der Prime-Prüfliste, im nächtlichen Durchgang als „weg“ gemeldet; für 14 davon kamen JustWatch-Kandidaten, die heute Abend gemeldet und gebucht wurden (`docs/prime-kandidaten-justwatch.md`).

**Wo es heute hakte.** Drei Bauläufe wurden rot, alle an `check:handbelege`, alle aus demselben Grund: Die Prüfung verglich bei mehreren Belegen je Titel und Anbieter den falschen Weg. Behoben (137b10e4, 8c657081), Statusanzeige geräumt.

---

## 17.09.2026, 13:50 — durchgesehen, zwei Fehler behoben

**Was läuft korrekt.** Letzter Wachlauf 16.09.2026, 14:36, „unauffällig": 2.771 Titel, 2.011 Urteile, 15 offen. Der heutige Lauf fehlt nicht, er kommt nur spät: GitHub startet den 07:20-UTC-Termin seit Tagen gegen 12:40 UTC. Statusanzeige ohne rote Läufe.

**Was komplett falsch lief.** Die Deltazeilen vom 16.09. wechselten im Minutentakt zwischen „verweise −2" und „+2". In `data/bestand-historie.jsonl` sprang `entferntProtokolliert` bei jedem Bau zwischen 836 und 769: 78 Crunchyroll-Adressen wurden aus aniSearch ergänzt, als belegtes Nein entfernt, im nächsten Lauf vom Gedächtnis gesperrt und deshalb nicht mehr notiert, im übernächsten wieder ergänzt. Behoben in `build.ts` (das Gedächtnis übernimmt gesperrte Einträge); zwei Bauläufe danach stehen beide auf 847.

**Wo echte Lücken waren.** Sechs Joyn-Adressen führte `data/link-check.json` seit dem 20.08. als 404, im Datensatz standen sie trotzdem, ohne Sprachurteil (9 der 13 offenen Verweise). Die späten Ergänzungsrunden legen solche Adressen jetzt nicht mehr an. Übrig bleiben vier Prime-Verweise, die nur über die Erweiterung zu klären sind.

**Wo Verbesserungspotenzial ist.** Die Amazon-Linkprüfung liefert aus der Cloud kaum Befunde (Recherche 17.09. in `status.md`); ihr Abbruch hielt bis heute auch die übrigen Anbieter auf.

---

## 15.09.2026, 08:35 — durchgesehen, nichts offen

**Was läuft korrekt.** Letzter Lauf 14.09.2026, 16:04, „unauffällig": 2.771 Titel, 1.980 Urteile, 7 offen; über 24 Stunden +8 Urteile, −12 offen. Alle Läufe der Nacht grün, Statusanzeige ohne roten Lauf, Briefkasten leer.

**Die eine Verlustzeile ist gewollt.** „14.09., 12:01 verweise −5, mitUrteil −2" kommt aus der Ausgaben-Umstellung: belegte Neins für die Crunchyroll-Kanal-Ausgaben von Digimon und Bungo Stray Dogs sowie für Trinity Seven auf Prime, dazu doppelte `/dp/`- und `/gp/video/detail/`-Verweise (Date a Live V), die zusammengelegt wurden. Digimon hat dafür einen Verweis mit Deutsch gewonnen.

**Wo Verbesserungspotenzial ist.** Die Kanal-Gegenprobe läuft nur montags im Tiefendurchlauf. Eine neue Kanal-Meldung wartet damit bis zu einer Woche auf ihre zweite Quelle. Das bleibt so, solange nicht mehrere Meldungen pro Woche anfallen.

---

## 13.09.2026, 20:47 — durchgesehen, nichts offen

**Was läuft korrekt.** Letzter Lauf 13.09.2026, 14:43, „unauffällig“: 2.771 Titel, 1.972 Urteile, 19 offen; über 24 Stunden +3 Urteile, −1 offen. Keine Verluste.

**Briefkasten.** 32 Meldungen (Prime 26, Netflix 6), alle in 11-meldungen-ohne-zuordnung.md gelistet. Die 6 Netflix-Meldungen (Haikyu) sind am Abend von Hand verbucht und abgehakt; die 26 Prime-Meldungen gehören zu einem Kanal-Titel (Haikyuu!!, ADN-Kanal) und tragen kein Urteil.

**Wo echte Risiken sind.** Keines im Bestand. Der Durchgang am Abend hat Zuordnungsfehler gezeigt, die für die Wache unsichtbar sind, weil sie nie als Verlust auftreten: ein Prime-Beleg am falschen Titel (Plus-Sized Elf unter Trinity Seven), ein falsches Nein des Crunchyroll-Laufs (Chunibyo-OVA). Beide berichtigt, die Ursachen stehen als Aufgaben in status.md.

---

## 09.09.2026, 19:10 — durchgesehen, nichts offen

**Was läuft korrekt.** Sieben Läufe in 24 Stunden, keiner mit Veränderung, der
Briefkasten leer — der Stand ist seit dem 08.09. unbewegt (2.768 Titel, 1.913
Urteile, 74 offen). Die Zahlen der Wache decken sich mit dem, was am Abend von
Hand gemessen wurde.

**Der Verbesserungsvorschlag vom 07.09. ist erledigt** — und zwar am selben Tag:
`bestand-historie.ts` rechnet je Anbieter die **begründeten** Entfernungen aus
`data/verweise-entfernt.json` gegen den Verlust und meldet nur den Rest
(„… Synchro-Belege weniger (N weitere sind begründet entfernt)"). Der Vorschlag
bleibt hier stehen, damit niemand ihn ein zweites Mal aufschreibt.

**Wo echte Risiken sind.** Keines aus diesen Läufen. Der bekannte Punkt bleibt:
Die Wache läuft um 09:20, ein Arbeitstag erzeugt bis zum Abend Dutzende
Änderungen, und sie meldet sie erst am nächsten Morgen. Genau dafür gibt es
diese Datei.

**Was komplett falsch läuft.** Nichts. Die drei Fehler dieses Abends
(Melde-Kasten, Auftrag über zwei Ausgaben, Staffelwarnung) liegen alle in der
Erweiterung und berühren den Bestand nicht — der eine, der ihn berührte (ein
verlorener Beleg zu „Death Note: Relight"), war für die Wache unsichtbar: Er
entstand aus zwei Meldungen, die zu **einem** Beleg wurden. Ein Verlust, den es
nie in den Bestand geschafft hat, taucht in keiner Delta-Zeile auf.

---


## 07.09.2026, 15:31 — fünf gemeldete Verluste, alle erklärt

**Was läuft korrekt.** Die Wache hat genau das getan, wofür es sie gibt: Sie hat
jede Verweis-Entfernung des Tages bemerkt und benannt, mit Anbieter und Zahl.
Der Status blieb dabei richtigerweise auf „unauffällig" — die Schwelle für einen
Alarm war keiner der Fälle.

**Woher die Verluste kommen — alle fünf sind gewollt:**

| Wache-Zeile | Ursache |
|---|---|
| netflix: 1 Beleg weniger | „Date a Live" Staffel 1: Der Prime-Weg trug ein `dub: true` aus dem Beleg zu einer **anderen** Ausgabe; der Beleg zur eigenen Adresse sagt „kein Deutsch" |
| crunchyroll: 1 und 6 Belege weniger | dieselbe Umstellung, plus die 16 YouTube-Verweise ohne belegte Synchro (Daniel: „youtube hat nur untertitel, also weg damit") |
| primevideo: 3 und 1 Belege weniger | die FSK-18-Fassung von Date a Live (S2 und S4) und „7th Time Loop" — beide mit belegtem Nein aus zwei unabhängigen Quellen |

**Wo Verbesserungspotenzial liegt.** Die Wache unterscheidet nicht zwischen
einem Verlust durch einen Fehler und einer Entfernung, die ein Handbeleg
ausgelöst hat. Beides sieht für sie gleich aus. Der Unterschied steht in
`data/verweise-entfernt.json` — dort trägt jeder entfernte Verweis seinen Grund
und seit heute auch ein `entferntAm`. Eine künftige Fassung könnte die
Wache-Zeile damit anreichern: „6 Belege weniger, davon 6 mit belegtem Nein"
liest sich anders als dieselbe Zahl ohne Zusatz.

**Wo echte Risiken sind.** Keines aus diesem Lauf. Der eine Punkt, der bleibt:
Die Wache läuft täglich um 09:20, und ein Arbeitstag wie dieser erzeugt bis zum
Abend Dutzende Änderungen. Sie meldet sie erst am nächsten Morgen gesammelt —
wer die Ursache dann noch kennt, hat Glück. Deshalb diese Datei.

**Was komplett falsch läuft.** Nichts in diesem Lauf.


## 07.10.2026 — Bestand-Bau rot (Lauf 37620950313), kein Wache-Befund

**Was läuft korrekt.** Der Riegel gegen verlorene Titel hat gegriffen: Der Bau brach ab, ehe `public/data` mit 2931 statt 2939 Titeln geschrieben wurde (Zeile „ABBRUCH: 8 Titel wuerden aus dem Datensatz fallen", `pipeline/bau/13-2-auslieferung.ts`). Der Datensatz auf `main` blieb unverändert.

**Wo ist Verbesserungspotenzial?** Der Riegel kannte nur „hinter den Toggle verschoben", nicht „unter anderer Kennung weitergeführt". Er zählt jetzt auch Titel mit, deren aniSearch-Kennung inzwischen einem AniList-Titel gehört (`anisearchUmgezogen`).

**Wo sind echte Risiken und Lücken?** Die 8 Titel (alle Dub-Kennzeichen `c`, alte Serien wie „Iruka to Shounen" = „Der weiße Delphin") standen vorher als eigene aniSearch-Titel im Hauptbestand; ihre AniList-Gegenstücke (11421, 9978, 5091, 7956, 6262, 10282, 4439, 6771) liegen hinter dem Toggle. Die Zuordnung durch den Katalog-Lauf (11:20) verschiebt sie also faktisch aus dem Hauptbestand — ob das gewollt ist, ist offen (Eintrag in `status.md`). Kein Riegel meldet das.

**Was läuft komplett falsch?** Nichts im Code. Die Ursache ist die Reihenfolge: `ergaenzeAnisearchTitel` (`pipeline/bau/anisearch-titel.ts`, Zeile mit `vergeben`) unterdrückt einen Titel, sobald `data/anisearch.json` seine Kennung vergibt, ohne zu prüfen, ob der Besitzer im Hauptbestand ankommt.


## 07.10.2026 (später) — Bestand-Bau rot (Lauf 37641860391), kein Wache-Befund

**Was läuft korrekt.** Die Zusicherung „jeder Handtitel zeigt auf einen Titel im Bestand“ (`pipeline/check-logic.ts:5042`) hat gegriffen und verhindert, dass ein Bestand mit totem Handtitel (`✖ … gefunden: [21726]`) ausgeliefert wird; der Datensatz auf `main` blieb unverändert. Der Folgelauf 37642452101 zeigte denselben Befund — reproduzierbar, kein Zufall.

**Wo ist Verbesserungspotenzial?** Der Lauf versuchte sechsmal zu pushen („Push abgelehnt, jemand war schneller“), obwohl er nichts Übernehmbares hatte; die Wiederholung kostete 13 Minuten und endete rot statt als Warnung. Wer die Zusicherung verletzt sieht, sollte den Push gar nicht erst versuchen.

**Wo sind echte Risiken und Lücken?** Commit 0570debf6 (Dub-Liste `-` gilt jetzt auch ohne deutsche Ausgabe) verschiebt Titel aus dem Hauptbestand, ohne die Handtitel (`data/titel-de.yaml`) gegenzuprüfen — die fielen erst im Bau auf, nicht in `check:vor-commit`. Zudem fand ich 21726 im Checkout weder in `titles.json` des Laufs noch in `ohne-synchro.json`; ob „verschiebt, löscht nicht“ hier hält, ist nicht gemessen.

**Was läuft komplett falsch?** `data/titel-de.yaml` Zeile 38: „Aggretsuko“ stand unter 21726 (Kurzfilmreihe 2016, aniSearch-Dub `-`), gemeint ist die Netflix-Serie 101571 (Dub `d`). Auf 101571 umgestellt, `check:logic` hält.


## 08.10.2026 — Bestand-Bau rot (Lauf 37730481739), kein Wache-Befund

**Was läuft korrekt.** Der Verlust-Riegel (`pipeline/bau/13-2-auslieferung.ts`, „ABBRUCH: 8 Titel wuerden aus dem Datensatz fallen (2908 → 2930)") hat gegriffen; `public/data` auf `main` blieb unverändert. Es sind dieselben acht Titel wie am 07.10. (10000325 u. a., aniSearch-Dub „abgebrochen").

**Wo ist Verbesserungspotenzial?** Dieselbe Ursache hat nun drei Pull Requests erzeugt (#411, #412, #439), keiner wurde zusammengeführt; #412 ist inzwischen konfliktbehaftet. Die Einreichung eines Fixes durch einen roten Lauf bleibt liegen, solange niemand mergt — der nächste Lauf wird wieder rot und baut den dritten.

**Wo sind echte Risiken und Lücken?** #439 hätte nicht gereicht: Es zählt den Nachfolger nur, wenn er im Hauptbestand (`slim`) steht; die acht AniList-Titel (11421, 9978, 5091, 7956, 6262, 10282, 4439, 6771) stehen aber in `ohne-synchro.json`, also hinter dem Toggle. Offen bleibt die inhaltliche Frage aus dem Eintrag vom 07.10.: Titel mit Dub-Kennzeichen `c` standen als eigene aniSearch-Titel im Hauptbestand und liegen nach der Zuordnung dahinter. Kein Riegel meldet das.

**Was läuft komplett falsch?** Nichts im Bau selbst. Die Annahme des Riegels („jede verschwundene Kennung ist ein Verlust") kennt keinen Kennungswechsel. Neu: `anisearchUmgezogen` (`pipeline/bau/anisearch-titel.ts`) rechnet eine Kennung als umgezogen, wenn ihr AniList-Nachfolger im Hauptbestand, in `verschoben` oder im AniList-Katalog ankommt; #411, #412, #439 sind damit überholt. Nicht lokal gemessen (kein Cache).
