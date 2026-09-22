# Projektregeln: anime-kalender-de

## Projektziel

Ein **Gesamtüberblick aller Anime, für die es eine deutsche Synchronfassung gibt oder geben
wird** — die bereits erschienenen ebenso wie die angekündigten. Dazu **filterbar**, **durchsuchbar**
und als **Kalendereintrag** übernehmbar (Daniel, 11.08.2026).

Fünf Punkte gehören aus der bisherigen Arbeit dazu, weil ohne sie keiner der vier oben trägt:

1. **Synchro ist nicht Untertitel.** Das ist die Trennlinie, an der sich das Projekt von jedem
   anderen Kalender scheidet. Chiikawa hat 120 deutsche Folgen — alle untertitelt, keine
   synchronisiert; unser Kalender führt es zu Recht nicht. Wer diese Unterscheidung nicht
   trifft, beantwortet eine andere Frage als die gestellte.
2. **Nichts behaupten, was nicht belegt ist** (siehe nächster Abschnitt). Ein Kalender, dem man
   nicht trauen kann, ist wertlos — er kostet dann Zeit, statt sie zu sparen.
3. **Unsicheres kennzeichnen statt weglassen.** Der Sinn ist vorherzusagen, damit niemand etwas
   verpasst. Ein Eintrag wird nur gestrichen, wenn eine Quelle ihn **aktiv widerlegt** — nicht,
   weil er unbestätigt ist. Sonst fehlt genau der Termin, für den jemand die Seite aufruft.
4. **Nicht nur wann, auch wo.** Zu jedem Titel gehört, wo man ihn sehen oder kaufen kann. Bei
   den meisten Titeln ist das die eigentliche Frage — nur gut hundert haben überhaupt einen
   anstehenden Termin.
5. **Rechtzeitig Bescheid geben.** Kalender-Abo, ICS-Export und Newsletter sind kein Beiwerk:
   Wer die Seite nicht täglich aufruft, verpasst sonst genau das, wovor sie bewahren soll.

Was **nicht** zum Ziel gehört: eine Community-Plattform, Bewertungen, Wasserstandsmeldungen zu
japanischen Ausstrahlungen. Der Kalender beantwortet eine Frage, und die auf Deutsch.

## Grundsatz: nichts behaupten, was nicht belegt ist

Dieses Projekt lebt davon, dass die Termine stimmen. Deshalb gilt ausnahmslos:

- **Kein Termin ohne `sources`.** `npm run data:validate` bricht sonst ab, und das ist Absicht.
- **Keine erfundenen Uhrzeiten.** Ist die Uhrzeit nicht belegt, bleibt `time` leer — die
  Oberfläche schreibt dann „Zeit offen". Das ist besser als eine plausible Falschangabe.
- **Abgeleitetes kennzeichnen.** Datum aus dem Simulcast-Start übernommen statt aus einer
  Dub-Ankündigung? Dann `estimated: true`. Folgenzahl geraten? Setzt die Pipeline selbst als
  `episodeCountAssumed`. Beides erscheint im UI als `≈`.
- **Keine Folgenzahl erfinden, auch nicht als Rückfall.** Ein einzelner Termin im
  Crunchyroll-Kalender ist kein Beleg für eine Wochenserie — dort stehen auch Specials,
  Filmpremieren und die Anime Awards. Ein `Math.max(12, …)` als Standardwert machte daraus neun
  zwölfteilige Reihen (10.08.2026), und der Kalender behauptete Woche für Woche eine Folge, die
  es nicht gibt. Ein Termin ohne belegte Stückzahl über eins ist ein Einzeltermin.
- **Ein Wochentakt muss gemessen sein, nicht angenommen.** „Nicht alles an einem Tag" heißt
  nicht „jede Woche eine Folge". ADN nahm Sword Art Online in zwei Wellen ins Angebot (11.06.
  und 17.07.2025, 49 und 47 Folgen); weil die Einstufung nur `dates.size === 1` prüfte, galt der
  Eintrag als Wochenserie, und der Kalender rechnete daraus 96 Termine bis 2027 — zusammen mit
  Sailor Moon **196 von 867 Terminen frei erfunden** (12.08.2026). Entscheidend sind der
  Abstand zwischen den Terminen **und** die Zahl der Folgen je Termin; beides prüft
  `bestimmeRhythmus()` in `pipeline/lib/adn.ts`.
- **Ein belegtes Ende schlägt jede Fortschreibung.** `expandEvents` bricht bei
  `schedule.lastEpisodeDate` ab. Vorher las nur `releaseStatus()` das Feld, `expandEvents` nicht
  — der Datensatz behauptete gleichzeitig „abgeschlossen seit Juli 2025" und „nächste Folge
  nächsten Mittwoch".
- **Eine Plattform-Serienkennung ist ein Franchise, keine Staffel.** ADN führt unter einer
  Kennung alle drei Staffeln von SAO, alle fünf von Sailor Moon, acht Blöcke von Haikyu!! —
  neun der 37 Serien. Zerlegt wird über das Feld `season` der Quelle
  (`staffelBloecke()`); die Zuordnung zur richtigen AniList-Staffel läuft über die
  **Folgenzahl**, nicht über den Namen: ADN-Staffel 3 von SAO hat 47 Folgen = Alicization 24 +
  War of Underworld 12 + Part 2 11. Geht die Summe nicht exakt auf, bleibt der Block lieber
  unzugeordnet, als einen fremden Titel mitzubringen.
- **Umgekehrt gilt es auch: ein Anime gehört genau einer Serienkennung.** ADN führt „To Love-Ru"
  unter 217 **und** 670, beide mit 26 Folgen. Die Namenssuche gibt für Fortsetzungen gern den
  Reihenkopf zurück, und `passtZuSerie` nimmt ihn an, sobald ein Wort geteilt wird — bei
  „To Love-Ru - Darkness" gegen „To Love Ru" ist das „love". Beide Kennungen beanspruchten
  AniList 3455, `pruefeErgebnis` meldete zu Recht „zusammen 52 Folgen bei 26 vorhandenen" und
  brach ab. **Drei Wochenläufe in Folge haben deshalb nichts geschrieben** (10.–17.08.2026): Der
  Abbruch schützt den Datensatz, aber er verwirft auch alles andere, was der Lauf geholt hat.
  Ist ein Treffer schon vergeben, wird deshalb die nächste Schreibweise probiert, nicht
  aufgegeben. Die Zusicherung dazu steht in `check-logic.ts` — wer den Melder weicher stellt, um
  einen grünen Lauf zu bekommen, bricht sie.
- **Es gewinnt der beste Treffer, nicht der erste — und kurze Wörter entscheiden.** Ein
  Namensabgleich, der Wörter unter vier Zeichen wegwirft, wirft genau die Kürzel weg, die eine
  Nebenausgabe von der Hauptserie trennen: `OVA`, `ONA`, `OAD`, `TV`. „Wolf's Rain OVA" (4 Folgen)
  sah dadurch wie „Wolf's Rain" aus und gewann gegen die Serie (26) — für eine ADN-Kennung mit 30
  Folgen, was den Build abbrach (17.08.2026). Diese vier Kürzel zählen deshalb mit; Füllwörter wie
  „the", „no", „to" weiterhin nicht. `bewerteTreffer` wertet je Titelschreibweise (geteilte Wörter
  doppelt, fremde einfach dagegen) und lässt den **japanischen** Titel außen vor: Sein
  lateinischer Rest verliert genau das unterscheidende Wort — „To LOVEる -とらぶる- ダークネス"
  schrumpft auf „love", und „Darkness" ist weg.
- **Ein Vorfilter verschiebt, er löscht nicht.** Wer aus dem Hauptbestand fällt, muss hinter dem
  Toggle ankommen, und zwar nachweislich: Sich darauf zu verlassen, dass der AniList-Katalog ihn
  von selbst wieder mitbringt, ging bei acht von neun Titeln gut — der neunte war über keinen Weg
  mehr erreichbar. Ein Titel, den man nirgends findet, ist stillschweigend gestrichen, und
  gestrichen wird nur, was eine Quelle aktiv widerlegt.
- **„Früheste Beobachtung" ist nicht „erste Folge".** `earliest` in `data/crunchyroll.json` ist
  der früheste Tag, den ein Abruf **gesehen** hat — der Kalender holt ein Fenster von acht bis
  zwölf Wochen, was davor lief, steht dort nie. Bei „Wistoria: Wand and Sword" Staffel 2 ist
  das der 31.05.2026 mit Folge 17; die Staffel begann am 03.05.2026 mit Folge 13 (Daniel,
  21.08.2026, bestätigt durch einen Artikel vom 04.05.2026). Wer die beiden verwechselt,
  verschiebt eine ganze Staffel — der Datensatz führte dafür zwölf Termine von Februar bis
  April, und keinen einzigen echten. Dieselbe Verwechslung ist mir am 21.08.2026 auch in der
  **Beschreibung** des Fehlers unterlaufen, nicht nur dem Code: „die Staffel lief vom 31.05.
  bis 19.07." stand in einem Auftrag, der genau diesen Fehler beheben sollte.

- **Der erste Eintrag einer Staffelliste ist nicht deren erste Folge.** Crunchyroll führt unter
  „Wistoria" Staffel 2 an erster Stelle ein Rückblick-Special **ohne** deutsche Synchro. Wer
  nach Position zählt statt nach Folgennummer, verschiebt die ganze Staffel um eins und nimmt
  einen untertitelten Eintrag in einen Synchro-Kalender auf (Daniel, 21.08.2026).

- **„Im Angebot seit" ist nicht „erschienen am".** Nimmt eine Plattform einen Katalogtitel auf,
  kennt sie nur das Datum ihrer eigenen Aufnahme. Für SAO war das der 11.06.2025 — die deutsche
  Fassung gibt es seit 2013, die von Alicization seit August 2019 auf Disc. Deshalb trägt jedes
  nicht-wöchentliche ADN-Release `dateMeaning: 'available-from'`, und die Oberfläche schreibt
  „Im Angebot seit" statt „Start".
- **Geteilte Staffelstarts über `schedule.firstEpisodeNumber` abbilden.** Netflix brachte Steel
  Ball Run als eine Folge im März und den Rest im September. Zwei Releases, aber eine
  durchlaufende Zählung: Ohne das Feld beginnt die Terminliste des zweiten Teils wieder bei „1."
  und liest sich wie der Termin der Auftaktfolge.
- Bei Fortsetzungen die **AniList-ID prüfen**, nicht der Suche vertrauen. `npx tsx
  pipeline/qa-resolve.ts` zeigt Verdachtsfälle; die Folgenzahl wird nur übernommen, wenn das
  japanische Ausstrahlungsjahr zum deutschen Termin passt.

## Was erzeugt wird, wird auch geprüft

`npm run data:validate` sichert nur `data/curated/*.yaml` — also den Teil, den ohnehin jemand
durchdacht hat. Der Fehler vom 12.08.2026 entstand vollständig in `build.ts` und wäre dort nie
aufgefallen. Deshalb prüft `pipeline/lib/pruefung.ts` am Ende jedes Builds den **erzeugten**
Datensatz und bricht bei einem Widerspruch ab, bevor etwas geschrieben wird:

- kein Termin nach dem belegten `lastEpisodeDate`
- keine Folgenzahl über dem Doppelten der AniList-Angabe (Ausnahme: `firstEpisodeNumber` oder
  ein erklärender `note`)
- keine zwei Releases, die zusammen mehr Folgen behaupten, als der Anime hat
- kein Release ohne Quelle

`npm run check:logic` stellt zusätzlich die vier Annahmen nach, aus denen der Fehler entstand.
Beide gehören zur Prüfkette vor dem Commit.

**Drei Prüfungen sichern die Synchro-Auswertung, und sie messen Verschiedenes.** Das ist
Absicht: Jede einzelne davon kann grün bleiben, während die anderen einen echten Ausfall sehen.

| Lauf | misst | blinder Fleck |
|---|---|---|
| `check:handbelege` | steht jede Handprüfung so im Datensatz? | **merkt einen Ausfall der Automatik nicht** — der Build setzt Handprüfungen direkt, sie decken den Ausfall zu |
| `check:cr-zuordnung` | tut `beurteile()` das Richtige? | kennt nur die neun hinterlegten Fälle |
| `check:quellen` | widerspricht eine Quelle einer Handprüfung? | kleine Kontrollgruppe, sagt nichts über Ungeprüftes |

Der mittlere Lauf ist die Antwort auf Daniels Frage vom 23.08.2026: „ist das jetzt von dir
korrigiert worden, sodass zukünftige läufe es nicht erneut kaputt machen? nicht nur speziell
für den fall, sondern generisch gelöst?" Er stellt neun reale Fälle nach — Gun Gale Online,
Fruits Basket, KONOSUBA, Food Wars, Free!, den US-Katalog — und zieht darunter eine
**Untergrenze auf dem echten Bestand**: Fällt die Auswertung unter 300 Urteile (Stand
23.08.2026: 470), ist etwas gebrochen, auch wenn jeder Einzelfall noch stimmt.

`npm run check:handbelege` hält seit dem 23.08.2026 die **1.946 von Hand geprüften Angaben**
aus `data/dub-confirmed.yaml` gegen den gebauten Datensatz. Sie sind die einzige Quelle im
Projekt, die weder rät noch schweigt — und die teuerste, weil sie Daniels Zeit kostet statt
Rechenzeit.

Ihr Schutz besteht in `build.ts` aus drei Stellen mit `if (stream.dub !== undefined) continue`,
also aus einer **Reihenfolge**. Reihenfolgen brechen leise: Wer eine Quelle nach oben zieht
oder die Bedingung vergisst, sieht danach einen Datensatz, der genauso vollständig aussieht —
nur steht an einzelnen Stellen die Vermutung einer Quelle, wo eine Messung stand. Der Anlass
war Daniels Frage vom 23.08.2026, ob seine Netflix-Meldungen vom Vortag beim nächsten Lauf
überschrieben werden könnten.

## Ein laufender Datenlauf committet den Stand von seinem Start

Am 29.08.2026 wurden 19 berichtigte Handbelege wieder falsch — keine Stunde,
nachdem sie behoben waren. Die Ursache steht in `tools/commit-data.sh`, und sie
ist kein Fehler, sondern eine Abwägung, die man kennen muss:

Hat sich der Fernstand während des Laufs bewegt, rettet das Skript die
**Quellen** aus seinem Arbeitsverzeichnis, setzt hart auf `origin/main` zurück
und spielt sie wieder ein. Für geholte Daten ist das richtig — sonst wäre eine
Stunde Abrufarbeit weg. Für eine Datei, an der **zwischenzeitlich jemand
anderes gearbeitet hat**, bedeutet es: Die ältere Fassung gewinnt.

Betroffen ist alles unter `QUELLEN` in diesem Skript, allen voran
`data/dub-confirmed.yaml` — ausgerechnet die Datei mit den 2.947 von Hand
geprüften Angaben.

**Praktische Folge:** Eine Korrektur an einer Quelldatei, während ein Datenlauf
läuft, ist nicht sicher. Entweder man wartet ihn ab (`gh run list`), oder man
prüft nach seinem Ende nach, ob die Korrektur noch steht. Ein roter
`check:logic` ist dabei der Freund: Er hat genau diesen Fall gemeldet, zwanzig
Minuten nachdem er eingetreten war.

**Zweiter Fall, 16.09.2026, und er traf eine Datei, die ich lokal neu erzeugt hatte.**
`data/disc-ausgaben.json` bekam um 15:21 Uhr neue Felder (Format, Art); ein Nachhol-Lauf,
der um 15:19 Uhr gestartet war, committete um 16:07 Uhr seinen alten Stand darüber. Der
Bau danach fand keine Felder, die Disc-Pillen blieben aus — bemerkt erst bei der
Live-Prüfung. **Vor dem Commit einer Datei aus `QUELLEN` wird `gh run list` gefragt**, ob
ein Datenlauf läuft; wenn ja, wird nach seinem Ende nachgesehen, ob die eigene Fassung
noch steht.

**Dritter Fall, 16.09.2026 abends — und diesmal stand der laufende Bau in der Ausgabe
direkt über dem Commit.** `bestand-bauen` (in_progress) committete danach seinen Stand von
`data/verweise-von-hand.yaml` und nahm den Daima-YouTube-Verweis wieder heraus;
`dub-confirmed.yaml` im selben Commit überlebte. Nachsehen allein hat also nicht getragen.
**Läuft ein Datenlauf oder Bau, wird eine Datei aus `QUELLEN` nicht committet, sondern
gewartet** — im Hintergrund, bis er fertig ist.

**Seit dem 18.09.2026 hält das eine Maschine fest** (dritter Fall, Rückfall-Register):
`tools/quellen-commit-wache.sh` hängt als pre-commit-Hook im lokalen Repo (einrichten mit
`bash tools/quellen-commit-wache.sh --einrichten`) und hält jeden Commit an, der eine Datei aus
`QUELLEN` enthält, solange ein Lauf außer Deploy, Aussehen und Claude läuft.

**Vierter Fall, 21.09.2026 — ausgelöst von einem Commit, der gar keine Quelle anfasste.** Während
`bestand-bauen` lief, ging eine Doku-Änderung auf `main`. Der Fernstand hatte sich bewegt, der Lauf
nahm den Rettungsweg und spielte die Erweiterungslisten zurück (in `QUELLEN`), ihre ausgelieferte
Prüfsumme `public/data/pruefliste-stand.json` aber nicht (nicht in `QUELLEN`). Der Deploy wurde rot
(Lauf 35567600545). Seitdem stehen beide Hälften des Generatorschritts in `tools/quellen-liste.sh`.
**Was ein Schritt zusammen schreibt, steht zusammen in `QUELLEN` — oder gar nicht.**

**Und deshalb gehört zu jeder Datenkorrektur eine Zusicherung.** Die Korrektur
allein hält einen Lauf nicht aus; die Zusicherung meldet sich, wenn sie
verlorengeht. Am selben Tag zweimal bewiesen — beim Kanal-Nein und bei den
Prime-Meldungen.

## Architektur

Bauweise, Grenzen und die Schwellen, ab denen umgebaut werden müsste: [ARCHITEKTUR.md](ARCHITEKTUR.md).

Die eine Regel, die man dort nicht nachlesen muss: **Ladelast, veröffentlichte Seite und
Repo-Größe sind drei verschiedene Dinge.** Rohdaten unter `data/` kosten keine Ladelast und
zählen nicht zur Pages-Grenze — sie wandern nie nach `dist/`. Ein neues Feld gehört nur dann
in `titles.json`, wenn es die Mehrheit der Besucher braucht; alles andere kommt als eigene
Datei, nachgeladen bei Bedarf.

## Datenfluss

`data/curated/*.yaml` (Handarbeit) + `data/cache/*` (APIs) → `pipeline/build.ts` → `public/data/*`

`public/data/` wird **mit committet** — die Seite ist statisch und lädt genau diese Dateien.
`data/cache/` ist bewusst nicht im Repo; die nächtliche Action baut ihn neu auf.

## Keine Information zweimal

Daniel am 03.09.2026 zum blauen Kasten im Detail-Panel: Dort stand „Auf Deutsch
verfügbar", darunter „Vollständig synchronisiert" und darunter „Alle 24 Folgen
auf Deutsch" — drei Zeilen für eine Auskunft. Sein Urteil: „blauer kasten sagt
quasi 3x das selbe … zusammenfassen zu 1, so spart man sich 3 und benötigt nur
1 zeile → mehr platz für andere elemente… **Globale Regel: Keine
Information-Dopplung.**"

**Prüffrage vor jeder Zeile in der Oberfläche: Steht das, was sie sagt, schon
irgendwo auf demselben Bildschirm?** Wenn ja, wird sie gestrichen — nicht
umformuliert. Zwei Formulierungen derselben Sache lesen sich wie zwei Angaben,
und der Leser sucht dann den Unterschied, den es nicht gibt.

Das gilt für die drei Häufungen, die dabei immer wieder auftauchen:

- **Überschrift und Inhalt.** „WO LÄUFT ES" über drei Anbieter-Pillen sagt
  nichts, was die Pillen nicht selbst zeigen.
- **Zustand in Wort und Bild.** Ein voller Fortschrittsbalken **und** „Alle 24
  Folgen auf Deutsch" **und** „Vollständig synchronisiert" sind dreimal dasselbe.
- **Der Reihenname in jeder Zeile einer Reihe.** Er steht in der Überschrift;
  darunter gehört nur, was die Teile unterscheidet.

**Die Grenze:** Zwei Angaben, die *heute zufällig* dasselbe sagen, sind keine
Dopplung. „24 Folgen" im Kopf und „24 von 24 auf Deutsch" im Kasten fallen
auseinander, sobald eine Staffel halb synchronisiert ist — das ist eine
Auskunft über zwei verschiedene Dinge, die gerade übereinstimmen.

## Sprache

Oberfläche, Kommentare, Commit-Messages und Dokumentation auf Deutsch. Feldnamen im Code
bleiben englisch (`releaseType`, `firstEpisodeDate`), damit sie zu den Fremd-APIs passen.

## Wo was liegt

- `shared/` wird von Pipeline, Web-App **und** Worker importiert. Nichts hier hineinschreiben,
  was Node-APIs oder DOM braucht.
- Statusberechnung (`airing`/`abgeschlossen`/`tba`/`unbekannt`) steht in `shared/logic.ts` und
- **Diese Statusberechnung nie selbst nachbauen — auch nicht für ein Hilfsskript.**
  `schedule.lastEpisodeDate` ist bei den meisten Releases **nicht gesetzt**; es entsteht zur
  Laufzeit aus Startdatum, Folgenzahl und Sendepausen. Wer das Feld direkt liest und sein
  Fehlen als „läuft noch" auslegt, erklärt jede abgeschlossene Reihe für laufend. Real am
  21.08.2026: Eine Arbeitsliste meldete „Dorohedoro Staffel 2 — läuft, 11/11" für eine
  Staffel, die seit dem 27.05. durch ist. Daniel hat es gemeldet, nicht der Code.

  Dazu gehört ein zweiter Griff: **Ein Anbieter-Verweis gehört zum Release seiner eigenen
  Plattform.** Nimmt man je Titel einfach das Release mit dem spätesten Termin, macht ein
  künftiger Disc-Termin aus „auf Netflix längst fertig" ein „läuft noch, 0/51" — die Disc hat
  mit Netflix nichts zu tun. Nach der Berichtigung beider Fehler blieben von elf angeblich
  laufenden Netflix-Reihen **null** übrig.

  wird nie gespeichert, sondern immer gegen das heutige Datum gerechnet.
- Zeitzonen laufen ausschließlich über `shared/time.ts`. Alle Datumsangaben im Datensatz sind
  Ortszeit Europe/Berlin; die Umrechnung nach UTC für ICS und Google Calendar passiert dort
  über `Intl`, damit die Sommerzeit stimmt.

## Newsletter

Der Worker in `worker/` ist optional. Ohne gesetztes `VITE_NEWSLETTER_API` zeigt das Formular
einen ehrlichen Hinweis statt eines kaputten Buttons. DSGVO-Pflichten (Double-Opt-in,
Abmeldelink, Impressum, Datenschutzerklärung) sind kein Nice-to-have — nichts davon entfernen.

## Ein roter Lauf wird bemerkt, nicht gemeldet — und die Anzeige danach geleert

Daniel am 07.09.2026, 15:50: „in status app sind 2 rote läufe (vor 3h+). wann
immer ein lauf fehlschlägt musst du selbst mitbekommen, anschauen, und handeln,
und im anschluss status app säubern. jeder überprüfte lauf in status app muss
aus status app auch wieder verschwinden."

Beide Läufe standen seit drei Stunden, beide gingen auf **meine** Commits
zurück, und beide hätte ich beim nächsten `gh run list` sehen können — ich habe
nur nicht hingesehen. Die Aufräum-Regel darunter gab es längst; was fehlte, war
der Blick.

**Der Griff gehört an jede Wachphase und an jeden eigenen Push**, nicht an einen
Vorsatz:

```
LAUF_TOKEN=… node tools/laeufe-aufraeumen.mjs --trocken
```

Er zeigt in zwei Sekunden, was in der Anzeige rot steht, und sagt dazu, ob ein
erfolgreicher Lauf desselben Workflows nachgekommen ist. Was er **nicht**
abnimmt, ist genau das, was ich mir ansehen muss.

### Was an diesem Tag die Ursache war — und sie kommt wieder

```
! [remote rejected] daten/34112899516-… → refusing to allow a GitHub App to
  create or update workflow `.github/workflows/refresh-weekly.yml`
  without `workflows` permission
```

Ein Datenlauf legt seinen Fund auf einen Zweig `daten/<lauf>`. Zieht er dabei
einen Stand von `main`, auf dem eine **Workflow-Datei** geändert wurde, will er
sie mitpushen — und das darf das `GITHUB_TOKEN` nicht. Der ganze Lauf endet
rot, obwohl seine Arbeit fehlerfrei war.

**Praktische Folge:** Wer `.github/workflows/*` ändert, macht damit jeden
Datenlauf rot, der gerade läuft oder in den nächsten Minuten startet. Das ist
kein Grund, es zu lassen — aber ein Grund, danach hinzusehen und den Lauf neu
anzustoßen. Der Fund ist nicht verloren; die Quellen werden beim nächsten Lauf
erneut geholt.

## Datenläufe laufen remote, nicht hier

Daniel am 24.08.2026: „stoß die läufe ab jetzt immer remote an, damit das herunterfahren kein
absturz der läufe bedeutet."

Jeder Lauf, der Daten holt oder schreibt, wird über GitHub angestoßen:

```bash
gh workflow run <datei>.yml --repo danielzaiser91/anime-kalender-de [-f budget=240]
```

Er läuft dann auf GitHubs Rechnern, committet selbst, überlebt jedes Herunterfahren und ist
später im Verlauf nachlesbar. Ein lokaler Lauf hat nichts davon: Er stirbt mit dem Fenster,
und was er geholt hat, liegt unversioniert herum.

**Ausgenommen sind nur Läufe, die nur hier funktionieren:**

- `tools/cr-zugang-holen.mjs` — braucht eine deutsche IP, sonst kommt der US-Katalog
- Prüfläufe ohne Netzzugriff (`check:*`, `typecheck`, `build`) — sie schreiben nichts und
  gehören vor jeden Commit
- eine einzelne Messung zur Fehlersuche, die nichts in den Bestand schreibt

**Und was ohnehin nach Plan läuft, wird nicht von Hand angestoßen.** Die vier Workflows decken
den Regelfall ab; ein Lauf von Hand ist die Ausnahme für einen Nachzügler oder ein Kontingent,
das sonst verfällt.

## Vor dem Commit

```bash
npm run check:vor-commit
```

**Ein Generator schreibt mehr als die Datei, wegen der man ihn aufruft.** Am 14.09.2026 habe ich die Prüflisten neu erzeugt und `extension/offene-*.js` committet — `public/data/pruefliste-stand.json`, die dieselben Werkzeuge im selben Zug schreiben, blieb liegen. `tools/extension-listenstand-pruefen.cjs` vergleicht beide Stände, und der Deploy wurde rot („stimmt mit der ausgelieferten überein"), bis der nächste Commit die Datei nachholte. Nach jedem Generatorlauf deshalb `git status` und **alles** stagen, was er geändert hat — nicht nur die erwarteten Pfade.

**Jeder rote Lauf ist eine Mail an Daniel** (16.09.2026: „soviele emails wegen failenden runs,
allein heute und gestern"). Gezählt am 15./16.09.: 14 Fehlermails, alle von meinen eigenen
Pushes oder Versuchen — Daten-Commits ohne `check:logic` (Deploy 07:55–11:30 rot), ein
Typfehler an `synonyms`, ein 404 in `check:ansichten`, drei umgehängte Belege ohne
`check:handbelege`, ein Messlauf, der absichtlich scheitern durfte. Drei Griffe dagegen:
Vor dem Push die Prüfungen fahren, die die CI **zusätzlich** fährt (`check:ansichten` und
`check:panel` bei Änderungen an `web/src`, `check:handbelege` nach einem Bau bei geänderten
Belegen). Ein Mess- oder Versuchslauf endet mit Exit 0 und schreibt sein Ergebnis ins
Protokoll, statt rot zu werden. Und ein Messlauf wird erst angestoßen, wenn feststeht,
dass sein Ergebnis nicht schon anderswo liegt (die Cron-Landmessung stand seit dem 22.08.
in D1).

**Wer in `build.ts` ändert, was entfernt wird, sucht die Zusicherungen, die das Entfernen festhalten.** `check:cr-zuordnung` läuft erst im Bau (`commit-data.sh`) und hielt „keine tote Crunchyroll-Adresse im Datensatz" fest; der Fix vom 17.09.2026, der US-„nicht verfügbar" nicht mehr als tot wertet, machte den Bau deshalb rot (Lauf 35225087674). Prüfgriff: `grep -rn "<Grund oder Feldname>" pipeline/check-*.ts tools/*-pruefen*` vor dem Push.

**Wer einen Handbeleg auf eine andere Kennung umhängt, fährt `check:handbelege` vorher mit.** Das steht nicht in `check:vor-commit` (es braucht den gebauten Datensatz) und bricht den Bau ab, wenn die neue Kennung nicht im Bestand steht — am 16.09.2026 bei drei umgehängten Prime-Belegen (Lauf 35125372002). Entweder die Staffel kommt über `synchro-von-hand.yaml` in den Bestand, oder der Beleg trägt `nichtImBestand: true` mit dem Grund in der Notiz.

**Auch ein reiner Daten-Commit läuft durch `check:logic`.** Am 15.09.2026 gingen im Durchgang
morgens mehrere Handbeleg-Commits ohne Prüfkette raus; zwei davon (FGO 1–22 bei 21 Folgen,
Shiboyugi 1–12 bei 11) hoben „Handbelege über der Folgenzahl" von 8 auf 10, und **jeder Deploy
blieb von 07:55 bis 11:30 rot**. Bemerkt wurde es erst beim nächsten Code-Commit. Eine Zeile in
`data/dub-confirmed.yaml` ist für die Zusicherungen genauso Code wie eine Zeile in `build.ts`.
Und beim Beheben: **Eine Schwelle nicht auf den Messwert des Augenblicks senken.** Ich setzte
sie danach von 8 auf 5, und der nächste Bau machte den Deploy sofort wieder rot, weil er zwei
Zuordnungsaufträge aus demselben Durchgang als Belege übernahm. Dazu kam, dass ich beim
Aufräumen einen roten Lauf gelöscht habe, ohne ihn anzusehen: **Vor `gh run delete` wird jeder
einzelne Lauf angesehen, nicht die Liste der roten von heute.**

**Ein Aufruf statt einer Liste zum Abtippen** — und der Grund ist ein Fehlschlag
vom 06.09.2026: In der Liste, die hier stand, fehlte `check:workflows`. Der
CI-Lauf fährt ihn, die Kette hier nicht, und so gingen **drei Deploys
hintereinander** rot, weil eine neue Datendatei nicht in `tools/quellen-liste.sh`
stand. Eine Kette, die man von Hand zusammensetzt, ist genau um die Glieder
kürzer, an die man gerade nicht denkt.

Was darin läuft, in dieser Reihenfolge:

```
data:validate · check:logic · check:workflows · typecheck · check:worker
check:hooks · check:extension · check:wiedervorlage · check:zugangsart · build
```

**Jedes `tsc` hier braucht `--noEmit`, und die Skripte setzen es.** Ohne das legt `tsc -b`
neben jede `.ts`/`.tsx` eine übersetzte `.js` — 85 Dateien in `web/src` und `shared`. Sie
stehen in `.gitignore`, richten also keinen Schaden im Repo an, aber der **nächste** Schritt
der Kette fällt über sie: `eslint web/src` liest die erzeugten `.js` mit und bricht mit
„Definition for rule 'react-hooks/exhaustive-deps' was not found" ab (real am 22.08.2026). Der
Fehler zeigt dann auf eine Datei, die niemand geschrieben hat. Aufräumen lässt sich das nur von
Hand — deshalb steht `--noEmit` seit dem 22.08.2026 fest in `typecheck` und `build`.

**`npm run check:worker` nicht weglassen.** Das Haupt-`tsconfig.json` deckt nur `web/src`,
`pipeline` und `shared` ab — `worker/` hat ein eigenes und wird von `tsc -b` **nicht** erfasst.
Am 12.08.2026 meldete `tsc -b` „sauber" für Code, in dem fünfmal eine gelöschte Variable stand;
der Fehler wäre erst beim `wrangler deploy` aufgefallen.

**`npm run check:hooks` steht dort, weil `tsc` die Hooks-Regeln nicht sehen kann.** Für den
Compiler ist `useMemo(…)` ein gewöhnlicher Funktionsaufruf mit passenden Typen; dass React
seine Hooks über die Zahl und Reihenfolge der Aufrufe je Renderdurchlauf zuordnet, steht in
keinem Typ und lässt sich in keinem prüfen. Am 20.08.2026 lagen zwei `useMemo` hinter dem
`if (!title) return` des Detail-Panels: bei geschlossenem Panel liefen sie nicht, beim Öffnen
schon. React brach mit Fehler #310 die ganze Anwendung ab, die Seite war weiß — und der
Service Worker lieferte das kaputte Bundle weiter aus. Die vollständige Prüfkette war grün,
`tsc -b` auch. Der Lauf ist rot bei `react-hooks/rules-of-hooks`;
`react-hooks/exhaustive-deps` bleibt Warnung, weil die Regel bekannte Fehlalarme hat.

Dieselbe Prüfung hängt zusätzlich vorne in `npm run build` — dort, wo sie niemand vergessen
kann. Ein Deploy-Schritt schützt nur den einen Workflow, der ihn trägt; als erster Schritt des
Baus gilt sie überall, wo diese Seite entsteht. Der Deploy wird dadurch rot, bevor ein `dist/`
existiert. In der Prüfkette oben steht sie trotzdem eigens, damit ein Verstoß beim Namen
genannt wird und nicht als Baufehler erscheint.

## Wissen nach Thema — vor der Arbeit lesen, nicht erinnern

Diese Datei war bis zum 18.09.2026 auf 338 KB gewachsen und wurde in jeder Sitzung ganz geladen (rund 85.000 Tokens). Hier steht nur noch, was bei **jeder** Arbeit gilt. Das Fachwissen liegt wortgleich in `docs/wissen/`; die Überschriften unten sind die Regeln in Kurzform. **Prüffrage vor jeder Arbeit: Welche Datei nennt ihr Auslöser für das, was ich gleich anfasse?** Die wird gelesen, bevor die erste Zeile geändert wird — ein Verweis „steht in CLAUDE.md, Abschnitt X" meint seitdem den Abschnitt gleichen Namens dort. Neue Erkenntnisse kommen in die passende Themendatei, nicht hierher.

### [Browser-Erweiterung (Amazon, Netflix, Disney+)](docs/wissen/erweiterung.md)

**Lesen:** Vor jeder Änderung an `extension/` und vor jedem Fix an einem Melde-Knopf, Leser, Kasten oder Durchlauf.

- Amazon: die Folgenliste kommt seitenweise, und die Seite verrät ihre eigenen Zugänge
- Der Quelltext veraltet beim Staffelwechsel — und das ist die Wurzel
- Ein `let` weiter unten ist kein `undefined`, sondern ein Absturz
- Ein Titelwechsel sieht aus wie ein richtiger Befund — die Kennung entlarvt ihn
- Prime teilt eine Staffel in Bände — die Folgenzahl gilt dann für beide
- Prime schneidet Reihen anders zu — die Folgenzahl ist deshalb kein Urteil
- Ein Film braucht den Mitleser nicht — die Tonspuren stehen im DOM
- Ein geschluckter Fehler sieht aus wie ein langsamer Rechner
- Beim Styling der Erweiterung wird hingesehen, nicht gerechnet
- Ein Zwischenspeicher, dessen Schlüssel sich ständig ändert, ist keiner
- Der Briefkasten ist die einzige Quelle für „schon gemeldet"
- In die Prüfliste kommen Werke, keine Staffeln
- Ein Datenfeld schlägt ein Textmuster — auch beim eigenen Fix
- Eine Abweichung ist kein Ereignis — daran hing der Staffelwechsel fest
- Ein Reihenname mitten im Titel trennt, was zusammengehört
- Abgehaktes muss einzeln zurückzuholen sein
- Prime zählt Teile, wo unser Bestand keinen Teil kennt
- Ein Durchlauf braucht einen sichtbaren Notausgang — und zwei Riegel, nicht einen
- Ein Test über den Quelltext fängt keinen doppelt vergebenen Namen
- Eine Diagnose, die in der Konsole endet, ist keine
- Eine Überbrückung gehört nicht in den Speicher, den sie überbrückt
- Ein Rückfall, den niemand befüllt, ist kein Rückfall
- Wer einen Fehlalarm abstellt, muss sagen, was der Wächter noch fangen soll
- Netflix leitet auf die Reihe um — und das ist meistens richtig
- Untertitel sind keine Tonspur — und ein Sammel-Set weiß nicht, welche es waren
- Die Adresse nennt die Staffel — die Meldung kann alt sein
- Eine Kulisse, die ein Feld von Hand setzt, prüft an der Stelle vorbei, die es löscht
- Drei Zustände je Folge, zwei Quellen, eine Funktion
- Die Ladereihenfolge ist keine Staffelnummer — auch nicht in der Meldung
- Eine Auflösefunktion ist kein Test — sie sagt nie nein
- Ein Gerüst für drei Anbieter — und was beim Teilen wirklich bricht
- Beim Fernsehen ist die Erweiterung unsichtbar
- Netflix leitet im Browser um, nicht per HTTP
- Ein Wert, der weiterreicht, muss überall dieselbe Quelle haben
- Der Sandkasten fängt, was die Textprüfung nicht sehen kann
- Die Prüfliste kennt genau eine Wahrheit — den Briefkasten
- Ein Auftrag gehört zu einer Suche — nicht zu „einer Suchseite"
- Ein Auftrag mit zwei Ausgaben ist nach der ersten Meldung nicht fertig
- „Staffel gewechselt" stand auf Seiten mit genau einer Staffel
- Die Gegenprobe fällt — fünf Mängel einer Kulisse, keiner zu erraten
- Der fünfte `let`-Zugriff vor der Deklaration — gefangen vom Sandkasten
- Ein Helfer im Modulscope ist eine `function`, keine `const`-Pfeilfunktion
- Zurück auf die Prüfliste: ein Aufruf, `tools/erneut-melden.mjs`

### [Datenquellen und ihre Grenzen](docs/wissen/quellen.md)

**Lesen:** Vor jeder Arbeit an einem Abruf (`pipeline/fetch-*`, `scrape-*`), an Sprachurteilen, Belegen, Zuordnungen und Terminen — und bevor eine Quelle als untauglich oder als Beleg gilt.

- „Wo läuft es" — ein Verweis ist keine Sprachangabe
- Prime-Verweise zeigen auf JustWatchs gti-Adresse (17.09.2026)
- Amazon duldet keinen Agenten — die Prüfliste bleibt deshalb Handarbeit
- Zwei Meldungen zu einer Reihe widersprechen sich selten — meist reden sie über verschiedene Staffeln
- Bei einem Kanal-Titel ist Amazons Sprachangabe kein Beleg
- Ein Beleg gehört einer Ausgabe, nicht einem Titel
- Eine Serie ist bei Crunchyroll kein Block — und ein Block ist kein Beleg über die Serie
- Wie eine Folge eindeutig wird — gemessen am 25.08.2026
- Die Suche im deutschen Katalog — und ein Token ohne Browser (25.08.2026)
- Disney+ beantwortet mit einem POST, wofür Netflix einen Player braucht
- Eine Abfrage mit LIMIT beantwortet eine andere Frage als die gestellte
- Disney+ sagt auf drei Arten Nein — und nur eine davon ist ein Befund
- Disney+ führt dieselbe Serie unter zwei Adressen
- ADN antwortet jedem Skript mit 403 — und sein Katalog gibt eine Seite heraus, keinen Katalog
- Eine Nebenausgabe hat bei Crunchyroll oft zwei Blöcke — und nur einer ist der richtige
- Eine Folgennummer kann im Block neu beginnen — die laufende Nummer nicht
- Wer eine Abdeckung misst, zählt alle Quellen — nicht die eine, die am Verweis steht
- Ein Kinostart ist keine Sprachfassung — bei Anime fallen beide regelmäßig auseinander
- Ein Anbieter meldet, was neu ist — fragen muss man ihn selbst
- Für 85 Titel ist „kein Anbieter bekannt" die Antwort, nicht die Lücke
- Ein Pinyin-Titel ist kein Name — und das Synonym daneben ist einer
- Eine Warteschlange, die sich aus dem Bestand bildet, kann eine Lücke nie schließen
- Ein deutscher Sprachblock bei aniSearch ist keine Synchro — die Marke daneben ist es
- Terminquellen: der Shop schlägt die News schlägt die Datenbank
- Ein Katalog, der Adressen repariert, kann auch welche anlegen
- Eine Folgenzahl am Weg braucht einen Sprachbeleg an genau diesem Weg
- Die Folgenzahl einer Disc sagt der Herausgeber, nicht der Händler — die EAN verbindet beide
- Was MyDubList nicht kennt, kommt über `synchro-von-hand.yaml` in den Bestand
- aniSearchs deutsches Datum ist oft der Simulcast, nicht die Synchro
- Stream oder Disc entscheidet der Anbieter, nicht die Quelle
- Für den deutschen Namen gibt es drei Quellen — und die dritte heißt Nachsehen
- Die Uhrzeit steht in der Start-Meldung, nicht in der Ankündigung
- Eine Störung ist kein Befund — und ein unplausibler Lauf schreibt nicht
- Ein Lauf ergänzt und berichtigt — er löscht keine Metadaten
- Ein Abruf, der nur ergänzt, veraltet zwangsläufig
- Beim Scrapen nichts wegwerfen
- Netflix gibt die Tonspuren nur mit dem Player heraus — dreifach gemessen
- Und doch ein Weg: der Player liest je Folge, wenn man ihm die Videodaten abdreht
- Ein Notbehelf, der auf eine Suche zeigt, ist schlechter als kein Weg
- Der Rückkanal ist die eigentliche Falle
- Zwei Aufgaben, zwei Stellen
- Eine Datei zu schreiben ist nicht dasselbe wie sie zu benutzen
- Eine Summe belegt, dass es passt — nicht, dass es die richtigen sind
- Der Anbieter zählt kumulativ — Position gegen Position ist keine Zuordnung
- Eine fremde Quelle taugt als Wegweiser, auch wo sie als Zeuge nicht taugt
- Wer eine Datei anwendet, muss hinter jeder Stelle stehen, die Verweise anlegt
- Die Linkprüfung maß Amazons Shop-Adresse, nicht die Video-Seite
- Eine falsche TMDB-Kennung verteilt fremde Wege über den ganzen Titel
- Eine Überschrift ist keine Sprachangabe — der aniSearch-Titelabruf taugt nur für den Katalog
- Ein HTTP 200 von Amazon heißt nicht, dass es die Seite gibt
- Die Crunchyroll-Fragezeichen liegen an der Zuordnung, nicht an der Quelle
- Amazons Abwehr macht nach rund 660 Abrufen zu — und dann für alles
- Ein Adressbeleg ist kein Sprachbeleg — und hat einen verdrängt
- Eine Nichtauskunft löscht keinen Befund
- Eine Suchadresse ist ein Auftrag, kein Angebot — auch beim Schreiben
- JustWatch ist die zweite Quelle, die dieses Projekt lange gesucht hat
- Ein „Widerspruch" zwischen Quelle und Handprüfung ist oft ein Zeitversatz
- Joyn: nicht selbst auslesen — JustWatch liefert die Adressen (22.09.2026)

### [Betrieb: Läufe, Worker, Git, Prüfungen](docs/wissen/betrieb.md)

**Lesen:** Vor Änderungen an `.github/workflows`, `worker/`, `tools/commit-data.sh`, an Zusicherungen, und bei jedem roten Lauf.

- Statusanzeige und Erweiterung lesen denselben Stand — den des Workers
- Sammeln und Zusammenführen sind zwei Läufe — nur der zweite darf rot werden
- Ein neuer Abruf braucht drei Dinge, nicht eines
- `git add` bricht ganz ab, wenn ein Pfad fehlt — und `2>/dev/null` verschweigt es
- `git push | tail` verschluckt den Fehlschlag
- Eine Migration wird angewandt **und** gebucht — sonst läuft die Buchführung weg
- Der Worker wird aus `worker/` ausgeliefert, nicht aus der Wurzel
- Der Worker läuft dem Web-Client immer hinterher
- Die Statusanzeige wird benachrichtigt, sie fragt nicht mehr nach
- Eine Antwort ohne Ziel ist nicht dasselbe wie keine Antwort
- Wer die Live-Seite prüft, räumt zuerst den Service Worker ab
- Caches: die Adresse ist die Version
- Eine Prüfung, die rot wird, weil die Arbeit erledigt ist, misst das Falsche
- Ein geklärter roter Lauf wird entfernt
- Wie der Stand geprüft wird, ohne Daniels Rechner
- Die Wache läuft, Claude wertet aus — und beim nächsten Sitzungsstart lese ich beides
- Der stündliche Lauf läuft fünfmal am Tag, nicht vierundzwanzigmal
- Und die Seite selbst wird genauso abgebildet — zwei Werkzeuge, ein Griff
- Kein Prettier — das Projekt formatiert von Hand
- Die Erweiterung zählt zweistellig — und hinten
- Eine Unterabfrage ohne Index kostet das Tageskontingent
- Der Auslöser war die Unterabfrage — die Ursache war der Takt

### [Bau und Anzeige](docs/wissen/datensatz.md)

**Lesen:** Vor Änderungen an `pipeline/build.ts`-Anzeigelogik, am Detail-Panel, an Terminen/Folgenzählung und an Adressen/Slugs.

- Zwei Ausgaben derselben Staffel beim selben Anbieter — beide werden gezeigt
- Eine Notiz für Besucher ist keine Notiz über unsere Zuordnung
- Ein Teil gehört zu seiner Staffel — gezählt wird über den Namen, nicht über die Position
- Ein verstrichener Termin ist keine erschienene Folge — und das entscheidet eine Funktion
- Cartoons sind Titel wie alle anderen — auch im Panel
- Fernsehen ist ein eigener Anbieter — mit Sender und Sendetagen
- Ein Film hat Termine, keine Folgen
- Eine Liste wird nach Entitäten gebündelt, nicht nach Ereignissen
- Ein Slug ist eine Adresse, und Adressen dürfen nicht wandern
- Eine Kürzung, die das Datum frisst, macht aus zwei Terminen eine Adresse
- Ein Skript, das beim Laden arbeitet, darf nicht importiert werden
- Ein neues Feld ist erst eingebaut, wenn es am Ziel angekommen ist
- Ein Riegel prüft den Wert, den er sieht — nicht den, der gleich daraus wird

