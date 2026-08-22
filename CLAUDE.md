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

## „Wo läuft es" — ein Verweis ist keine Sprachangabe

Ein Stream-Verweis sagt, **dass** ein Titel dort läuft, nicht **in welcher Sprache**. Belegen
kann die Pipeline die deutsche Fassung nur bei ADN (Sprachcode `vde` je Folge) und Crunchyroll
(„(Deutsch)" im Kalender). Bei YouTube, Netflix, Prime Video, Disney+, RTL+, Joyn und Aniverse
gibt es keine öffentliche Auskunft — dort steht „🇩🇪 ?", und das ist die ehrliche Antwort.

**Crunchyroll ist eine schlechte Quelle über Crunchyroll** (Daniel, 15.08.2026). Die
Serienseite zeigt je nach Betrachter etwas anderes: nicht angemeldet, angemeldet ohne
Abo und angemeldet mit Abo sind drei verschiedene Ansichten. Ein Scraper ohne Anmeldung
sieht deshalb nicht „was es gibt", sondern „was ein Gast sehen darf" — und ein fehlendes
„Deutsch" in der Audio-Zeile ist dann kein Beleg gegen eine Synchro.

Das passt zum Messwert: Der Lauf vom 12./13.08.2026 fand auf nur **151 von 917** Seiten
überhaupt Deutsch, und „Frieren: Beyond Journey's End" steht dort als
`deutschImAngebot: false`. Ein Direktabruf am 15.08.2026 lief zusätzlich in Crunchyrolls
Bot-Sperre (313 Zeichen Seiteninhalt statt einer Seite), klärt also nichts.

Zwei Folgen daraus:

1. **`deutschImAngebot: false` aus diesem Lauf ist kein Beleg**, sondern bestenfalls ein
   schwaches Indiz. Als `dub: false` in den Datensatz darf es nur, wenn ein Mensch es in
   `data/dub-confirmed.yaml` bestätigt hat.
2. **Ein einmal gesetztes `false` muss wieder prüfbar sein.** `scrape-crunchyroll-dub.ts`
   bildet seine Kandidatenliste aus `titles.json` über `stream.dub === undefined` — was
   einmal falsch als `false` erfasst wurde, kommt nie wieder in die Warteschlange. Ein
   Falschnegativ ist damit dauerhaft. Wiedervorlage muss über das Alter der Prüfung
   laufen, nicht über „noch nie geprüft".

- **Eine fremde Anbieter-Schnittstelle belegt nur, was da ist — nie, was fehlt.** Geprüft am
  21.08.2026 an der [Streaming Availability API](https://www.movieofthenight.com/about/api)
  (Movie of the Night): Sie liefert Tonspuren je Folge, getrennt nach `audios` und
  `subtitles`, und traf bei `thunder-3` unseren belegten Stand — Folgen 1 bis 6 mit deutschem
  Ton auf Netflix. Folge 7 kannte sie nicht, **obwohl sie seit dem 19.08. auf Netflix in
  deutscher Fassung liegt** (Daniel, 21.08.2026). Mindestens zwei Tage Verzug. Ein fehlender
  Eintrag heißt dort „noch nicht bekannt", und aus dieser Quelle wird deshalb nie ein
  `dub: false`.

  Zwei weitere gemessene Grenzen derselben Quelle: Ihre **Serienebene widerspricht ihrer
  eigenen Episodenebene** — bei „Frieren" meldet sie oben deutschen Ton bei Crunchyroll,
  während alle 28 Crunchyroll-Episoden `audios: [{"language":"jpn"}]` tragen. Und ihre
  **Staffelzählung ist eine andere als unsere**: „Frieren" ist dort eine Staffel mit 39
  Folgen, „Mushoku Tensei" drei mit 61. Zugeordnet wird über Folgennummern, nie über
  Staffelnummern.


- **Wo der Abruf steht, entscheidet, was er sieht — und Cloud-Läufe stehen in den USA.** Der
  Crunchyroll-Lauf vom 21.08.2026 lief auf GitHub-Runnern und hat **1.655 geprüfte Folgen in
  592 Serien** mit `eligible_region: "US"` archiviert, ausnahmslos. Zwei Folgen daraus, und die
  zweite ist die wichtigere:

  - **Ein `de-DE` in `versions` ist trotzdem ein Beleg.** Die Sprachliste eines Objekts nennt
    die Fassungen, die es gibt — dass die US-Antwort sie kennt, macht sie nicht falsch. Die 226
    Serien mit deutscher Folge bleiben also gültig, und die Kontrollgruppe bestätigt sie: 24 von
    Hand geprüfte Fälle, 24 Treffer.
  - **Ein fehlendes `de-DE` belegt gar nichts.** „Fairy Tail" trägt in der US-Antwort für alle
    drei Blöcke nur `ja-JP, en-US` — Daniel sieht in Deutschland die Folgen 1 bis 277 auf
    Deutsch (22.08.2026). Dasselbe gilt für die Verfügbarkeit: „Dragon Ball" und „Dragon Ball Z"
    liefern vollständige Folgenlisten, während die deutsche Seite „Leider sind die Videos dieser
    Serie nicht mehr verfügbar" zeigt.

  Deshalb steigt `beurteile()` bei `deutschImAngebot: false` aus — **außer** der Eintrag trägt
  `katalog: 'de'` (siehe den nächsten Abschnitt). Im ausgelieferten Datensatz steht bei **keinem**
  der 1.116 Crunchyroll-Verweise ein `dub: false` — die Regel hat gehalten.

  **Verworfen, weil gemessen:** `availability_ends` taugt nicht als Ersatz. Dragon Ball (weg)
  und JoJo (sichtbar) tragen beide den 31.12.2025; von 592 Serien hätten 445 als „abgelaufen"
  gegolten, darunter „Lycoris Recoil", das Daniel am 22.08.2026 als normal sichtbar bestätigt hat.


- **Der deutsche Katalog ist erreichbar — über ein Zugangspaket von hier.** Crunchyroll leitet
  die Region aus der **IP des Abrufs** ab; kein Parameter und kein Header ändert daran etwas
  (20 Versuche, `docs/messung-crunchyroll-region.md`). Die CloudFront-Signatur, die den Zugang
  zum CMS trägt, enthält jedoch **nur eine Zeitbedingung, keine IP-Bindung**. Ein Paket, das an
  Daniels Leitung entsteht, gilt deshalb auch von einem Rechner in den USA — belegt am
  22.08.2026 im Lauf 32537041109 am Prüfstein „Fairy Tail":

  ```
  Fairy Tail (German Dub)           | ja-JP,de-DE
  Fairy Tail                        | ja-JP,de-DE
  Fairy Tail Series 2 (German Dub)  | ja-JP,de-DE
  Fairy Tail Staffel 2              | ja-JP,de-DE
  Fairy Tail Final Season           | ja-JP
  ```

  Genau der Stand, den Daniel von Hand gesehen hatte — Folgen 1 bis 277 deutsch, der letzte
  Block nicht. Aus derselben Serie meldet die US-Antwort bei allen Blöcken `ja-JP, en-US`.

  Drei Einzelheiten, die den Weg tragen:
  - **`beta-api.crunchyroll.com` hat keine Bot-Sperre.** Derselbe Aufruf gegen
    `www.crunchyroll.com` endet in Cloudflares „Just a moment…" (HTTP 403), aus der Cloud wie
    von hier. Über die beta-api genügt ein gewöhnlicher `fetch` mit Browser-Kennung — kein
    Playwright, kein Aufwärmen.
  - **Das Bearer-Token braucht der CMS-Pfad nicht.** Die Signatur allein genügt, und sie gilt
    **24 Stunden** statt einer.
  - **Der ältere CMS-Pfad führt je Tonspur eine eigene Staffel** („Fairy Tail (German Dub)").
    Die deutsche Fassung ist dort also nicht nur eine Sprachangabe, sondern ein eigener Block.

  Geholt wird das Paket mit `node tools/cr-zugang-holen.mjs --secret`; es landet als Repo-Secret
  `CR_ZUGANG`. **Muss auf einem Rechner in Deutschland laufen** und ist nach einem Tag
  wertlos — ein Lauf, der es braucht, holt sich also entweder ein frisches oder meldet, dass
  seines abgelaufen ist.

- **Aus dem deutschen Katalog wird ein fehlendes `de-DE` zum Beleg — aus keinem anderen.** Seit
  dem 22.08.2026 läuft `data:cr-dub` über die beta-api mit diesem Paket, und jeder Eintrag trägt
  `katalog`. Nur bei `'de'` macht `beurteile()` daraus ein `dub: false`; alles ohne belegte
  Region (der Altbestand, der Browser-Weg hinter `--browser`) bleibt bei der Vorsichtsregel.
  Fehlt das Paket oder ist es abgelaufen, **bricht der Lauf ab** und weicht nicht still auf den
  US-Katalog aus: Ein Lauf, der unbemerkt die falsche Region liest, ist schlimmer als keiner.

  Gemessen an 60 Serien (`docs/messung-crunchyroll-de-katalog.md`, Stichprobe geschichtet nach
  bisherigem Befund):

  | | Zahl |
  |---|---|
  | „kein Deutsch", in Wahrheit deutsch | 3 von 32 |
  | „kein Deutsch", jetzt **belegt** | 10 von 32 |
  | Verweise mit belegtem Urteil | 20 → 38 |
  | im deutschen Katalog gar nicht geführt | 25 von 60 |

  Drei Einzelheiten, die man beim Weiterbauen braucht:

  - **Der ältere CMS-Pfad führt je Tonspur eine eigene Staffel.** „Tower of God" hat dort 18
    Blöcke für zwei Staffeln, einen je Sprache. `hauptStaffeln()` legt sie über `original` in
    `versions` wieder zusammen und nimmt den **Originalblock** — nur an ihm hängt die
    vollständige Folgenliste. Am deutschen Block wäre jede Staffel zu 100 Prozent deutsch, und
    „15 von 17" ließe sich nie mehr ablesen.
  - **Der Namenszusatz „(German Dub)" ist die Kontrolle, nicht der Beleg — und er fehlt meistens.**
    Bei älteren Titeln trägt die Synchronfassung ihn („Fairy Tail (German Dub)", „Michiko &
    Hatchin (German Dub)"), bei neueren heißen alle neun Sprachblöcke gleich („Staffel 1").
    Sein Fehlen ist deshalb Schweigen und kein Widerspruch; nur die Gegenrichtung — Name nennt
    Deutsch, `versions` kennt es nicht — wird festgehalten, und dort gewinnt `versions`.
  - **„Kennt der deutsche Katalog nicht" ist nicht `nichtVerfuegbar`.** 25 der 60 Serien
    antworten mit HTTP 200 und `total: 0`; „Trigun", „Soul Eater" und „Spice and Wolf" gibt es
    hier schlicht nicht. Daraus einen Verweis zu **entfernen** verlangte einen zweiten Beleg,
    und der zweite Beleg wäre Crunchyrolls eigene Fehlerseite — die ein Cloud-Lauf weiterhin
    aus US-Sicht liest. Umgekehrt gilt dasselbe: „Flowers of Evil" und „Digimon Savers" stehen
    im Bestand als `nichtVerfuegbar`, weil die **US-Seite** das Banner zeigte; der deutsche
    Katalog führt beide, „Flowers of Evil" mit 13 deutschen Folgen. Wo eine Serienkennung
    bekannt ist, entscheidet deshalb der Katalog und nicht die Seite.
- **Netflix gibt die Sprachen erst mit dem Player heraus — gemessen, nicht vermutet.** Am
  22.08.2026 auf einer offenen Titelseite mit zwei Konsolen-Skripten geprüft:
  `models.graphql.data` umfasst 6.797 Zeichen und enthält Profile und Benachrichtigungen, null
  Treffer für `audioLocale`, `de-DE` oder `Deutsch`; im übrigen Seitenzustand stehen nur
  Oberflächentexte. Erst beim Abspielen lädt Netflix ein Manifest
  (`/playapi/cadmium/manifest/1`, rund 198 KB) mit `audioTracks`, `language` und
  `languageDescription`.

  Daraus folgt der Ablauf in `data/netflix-von-hand.md`: **Abspielen** verlinkt direkt auf
  `/watch/<reihe>`, der Player startet, die Erweiterung liest, ein Klick meldet.

- **Was auf der Titelseite läuft, ist nicht die Serie.** Der Player führt dort eine Sitzung
  namens `motion-billboard-…` — die Vorschau des Hero-Elements der **Startseite**, die hinter
  dem Titel-Overlay weiterläuft. Für „Pokémon Sonne & Mond", eine Reihe ohne eine einzige
  abrufbare Folge, meldete sie 18 Sprachen samt Deutsch: die des Films im Hintergrund
  (`movieId 82819831` gegen Reihe `80186475`). Die Erweiterung verwirft Sitzungen mit
  `motion-billboard`, `trailer` oder `preview` im Namen und liest nur auf `/watch/`.
- **Aus dem Fragezeichen wird ein Häkchen nur durch Nachsehen.** Geprüfte Fälle stehen in
  `data/dub-confirmed.yaml`, mit Datum. `dub: false` ist genauso wertvoll wie `true`.
- **Was ein Mensch geprüft hat, schlägt jede Ableitung** — der Eintrag gilt auch gegen ein
  automatisch gesetztes `true`.
- **Nie raten, auch nicht bei starken Indizien.** Eine YouTube-Playlist des deutschen
  Crunchyroll-Kanals ist ein Hinweis, kein Beleg; dieselbe Playlist enthält auch untertitelte
  Folgen.
- `npm run data:dub-checks` erzeugt aus dem aktuellen Stand die Arbeitsliste
  `data/dub-pruefliste.md` — nach hinten sortiert von heute, ohne Künftiges (das kann niemand
  nachsehen) und ohne bereits Geprüftes. Eine Zeile ist eine **Reihe auf einem Anbieter**: Wer
  den Verweis öffnet, sieht dort in aller Regel alle Staffeln auf einmal.

**Kurzschrift für Daniels Antworten** (12.08.2026) — sie steht auch im Kopf der Liste:

| Zeichen | Bedeutung | wird zu |
|---|---|---|
| `1` | hat deutsche Synchro | `dub: true` |
| `0` | keine deutsche Synchro, nur Untertitel | `dub: false`, Verweis bleibt mit ✕ |
| `x` | kein Video: nicht verfügbar, tot, Weiterleitung | `available: false`, Verweis wird entfernt |

Zwei Wendungen kommen so oft vor, dass Daniel sie am 20.08.2026 abgekürzt hat:

| Kurzform | Was er gesehen hat | wird zu |
|---|---|---|
| **„schief-Error"** | Der Treffer steht in der Suche, beim Klick kommt „Da ist etwas schief gelaufen" | `available: false` |
| **„404"** | Weiterleitung auf die Startseite des Anbieters, der Titel ist dort nicht zu finden — **kein echter** HTTP-404, aber als Rückmeldung kürzer | `available: false` |

Beide meinen dasselbe Ergebnis und unterscheiden sich nur darin, wie der Anbieter sein Nein
mitteilt. Festgehalten wird die Unterscheidung trotzdem in der `note`: Sie sagt, ob eine Adresse
kaputt ist oder ein Angebot verschwunden.

Mehrere Einträge in einer Zeile werden mit Punkt getrennt in derselben Reihenfolge beantwortet
(`1.0` = erster ja, zweiter nein). Eine einzelne Angabe gilt für alle Einträge der Zeile.
Beispiel für einen ganzen Batch: `1-x 2-1 3-1.0 4-x`.

## Terminquellen: der Shop schlägt die News schlägt die Datenbank

Am 13.08.2026 hat Daniel zehn angebliche Terminwidersprüche einzeln nachgeprüft. Das
Ergebnis ist eine Rangfolge, die für jeden künftigen Disc-Termin gilt:

1. **Ein Shop mit Vorbestellung ist die verlässlichste Quelle** — er muss liefern und
   korrigiert seinen Termin deshalb. jpc, anime-planet.de, Akiba Pass, Amazon. Bei „The
   Most Heretical Last Boss Queen" stand dort „Lieferung zum Release am 3. September
   2026", genau unser Termin. **Aber nicht jeder Shop pflegt nach:** Für „I'm Standing on
   a Million Lives" führte ofdb.de noch den überholten 19.06., während jpc und alle
   übrigen schon den 04.09. hatten. Mehrheit schlägt Einzelfund.
2. **Anime2You ist ein guter Indikator, aber lückenhaft.** Die Monatsübersicht ist die
   Grundlage unseres Bestands, und der Artikel „24 Blu-ray-Termine verschoben"
   (news/1035909, 31.07.2026) ist der Grund, warum unsere Termine für sieben AniMoon-Boxen
   stimmen. Verlassen kann man sich darauf trotzdem nicht: Ein Artikel vom 11.07.2026 nennt
   für dieselbe Staffel den 07.08. und wurde nie nachgezogen. **Nicht jede Verschiebung
   bekommt eine eigene Meldung.**
3. **aniSearch führt veraltete deutsche Termine weiter — es pflegt Verschiebungen nicht
   nach.** Das ist die belegte Fassung; die erste Vermutung (13.08.2026 vormittags), dort
   stünde der Termin der Ausgabe mit japanischer Tonspur, ist **widerlegt**. Der
   Anime2You-Artikel „24 Blu-ray-Termine verschoben" nennt für dieselben Titel die alten
   **deutschen** Termine, und die stehen bei aniSearch noch: „The Most Heretical Last Boss
   Queen" wurde vom 20.08. auf den 03.09. verschoben — aniSearch zeigt 20.08.,
   „Café Terrace" vom 21.08. auf den 04.09. — aniSearch zeigt 21.08. Bei drei weiteren
   liegt aniSearchs Datum zwischen dem ursprünglichen und dem aktuellen, dort gab es
   offenbar eine frühere Verschiebung.

   Folge: Als Beleg für einen **aktuellen** deutschen Termin taugt aniSearch nicht. Als
   Hinweis darauf, dass es zu einem Titel überhaupt eine Ausgabe gibt, sehr wohl — und ein
   aniSearch-Datum, das **später** liegt als unseres, ist ein ernstzunehmender Verdacht auf
   eine Verschiebung, die Anime2You nicht gemeldet hat (offener Fall: Inazuma Eleven S1,
   aniSearch 25.09. gegen unseren belegten 04.09.).

**Praktische Folge:** Widerspricht aniSearch einem Termin, der aus Anime2You stammt und von
Hand nachgezogen wurde, gewinnt unser Termin. Widerspricht ein **Shop**, wird nachgesehen.

**Zwei Termine, keiner belegbar? Dann werden beide geführt** (Daniels Regel, 13.08.2026).
Nicht heimlich einen wählen und den anderen in einer Fußnote verstecken: Wenn zwei Quellen
verschiedene Tage nennen und sich keiner davon bestätigen lässt, bekommt der Leser beide —
jeden mit seiner Quelle verlinkt, dazu der Satz, dass wir es nicht klären konnten. Er
entscheidet dann selbst, und er weiß, woran er ist.

Technisch: `Release.disputedDates`, gepflegt in `data/curated/*.yaml`. Der **Kalender** führt
weiterhin nur einen Termin — zwei Einträge würden behaupten, es gebe zwei Veröffentlichungen,
und das wäre die schlimmere Falschaussage. Der Zweitkandidat erscheint im Detail-Panel unter
dem Terminblock.

Erster Fall: „Inazuma Eleven – Staffel 1". Anime2You nennt den 04.09.2026, aniSearch den
25.09.2026 für dieselbe AniMoon-Ausgabe, der Verlag selbst nur „September 2026" ohne Tag.
Fünf Händler geprüft, keiner nennt einen Liefertag.

**Ausländische Ausgaben gehören nicht in den Bestand.** aniSearch führt US-, UK- und
französische Veröffentlichungen gleichberechtigt in derselben Liste. Bis zum 13.08.2026 nahm
`extract-disc-dates.ts` sie alle mit und hängte jedem Vorschlag den **deutschen** Publisher
an — eine britische Blu-ray sah damit aus wie eine deutsche von Crunchyroll, und drei
angebliche Widersprüche gingen allein darauf zurück. Erkennbar sind sie am Flaggenbild im
Block (`class="flag" alt="us"`); **deutsche Ausgaben tragen keine Flagge**. 28 von 122
Vorschlägen waren ausländisch.

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

## Ein Abruf, der nur ergänzt, veraltet zwangsläufig

**Jede Warteschlange wird nach dem Alter gebildet, nie nach „schon beantwortet".** Ein Filter
der Form „hole, was noch fehlt" macht jede Antwort endgültig: Der Eintrag verlässt die
Warteschlange und kommt nie zurück, und ein Falschbefund kann sich nicht mehr korrigieren.

Das ist keine Theorie, es ist am 15.08.2026 dreimal am selben Tag aufgefallen:

- `scrape-crunchyroll-dub.ts` bildete seine Liste aus `stream.dub === undefined`. Was einmal ein
  `false` erzeugt hatte, kam nie wieder dran — die Antwort verhinderte ihre eigene Überprüfung.
- `fetch-anisearch.ts` filterte auf `!cache[t.id].info`. Nach dem ersten erfolgreichen Abruf war
  ein Titel dauerhaft erledigt, sein Bestand an Anbietern eingefroren.
- Beide zusammen führten dazu, dass 975 Titel ein unbelegtes „keine deutsche Synchro" trugen.

**Warum das gerade hier gefährlich ist:** Verliert ein Streamingdienst die Lizenzrechte, nimmt er
die deutsche Fassung wieder aus dem Angebot. Crunchyroll führt aus diesem Grund keine erste
Staffel von „Attack on Titan" mehr (Daniel, 15.08.2026). Ein Bestand, der nur wachsen kann,
behauptet solche Angebote weiter — und zwar für immer.

Also: `--alter <tage>` als Vorgabe, Wiedervorlage über `fetchedAt` beziehungsweise `geprueftAm`,
und die Frist am Tempo der Sache bemessen. Vierzehn Tage bei aniSearch, achtundzwanzig bei
Crunchyroll. Was ein Mensch in `data/dub-confirmed.yaml` bestätigt hat, bleibt davon unberührt.

## Beim Scrapen nichts wegwerfen

Der Abruf ist der teure und der schädliche Teil, nicht das Speichern. Wer eine fremde Seite
holt und nur zwei Felder herauslöst, zahlt für jedes später gebrauchte Feld ein zweites Mal —
und zwar mit Last auf einem fremden Server, nicht mit eigenem Speicherplatz.

- **Paginierte Schnittstellen paginiert abfragen.** `?limit=100` ohne `offset` ist keine
  Begrenzung, sondern stiller Datenverlust — und weil ADN die **neuesten** Folgen zuerst
  liefert, fehlte ausgerechnet der Anfang: 99 von 199 Folgen bei Sailor Moon, 45 von 145 bei
  Eyeshield 21, 31 von 131 bei Dragon Ball Super. Bei Sailor Moon fielen dadurch die beiden
  frühesten Veröffentlichungstermine weg, und der Datensatz führte den 23.12.2025 als Start
  statt des richtigen 29.10.2025.
- **Rohantworten archivieren** (`data/adn-raw/*.json.gz`, `data/anisearch-raw/*.html.gz`, rund
  9 KB je Titel). Ein
  nachträglich gebrauchtes Feld ist dann eine Änderung am Parser, kein zweiter Lauf über 2.612
  Seiten. Genau das war am 11.08.2026 der Fall: Die Folgenzahl stand auf jeder bereits geholten
  Seite und war trotzdem nur durch einen kompletten Neuabruf zu bekommen.
- **Infobox vollständig auslesen**, auch Felder, die heute niemand anzeigt. Das kostet nichts.
- **Nicht archiviert werden** Forum, Kommentare, Rezensionen, Umfragen und Bearbeiterlisten.
  Das ist keine Platzfrage: Es sind Beiträge einzelner Menschen, veröffentlicht auf aniSearch
  und nicht in unserem Repo.
- **Kein Live-Scraping beim Seitenaufruf.** Das macht aus einem Abruf je Titel und Woche einen
  Abruf je Besucher — dieselbe Last, unbegrenzt, und ein fremder Server im Ladepfad der
  eigenen Seite.
- `npm run data:anisearch:check` prüft den Parser gegen das Archiv, ohne einen einzigen neuen
  Abruf. Bricht er ab, hat aniSearch die Seitenstruktur geändert.

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

## Ein neuer Abruf braucht drei Dinge, nicht eines

Ein Abrufskript zu schreiben ist der kleinere Teil. Ohne die beiden anderen ist es entweder
wirkungslos oder es macht Lärm:

1. **Ein Platz in einem Workflow.** Sonst läuft es genau einmal — von Hand — und veraltet danach
   still. Am 16.08.2026 standen `data:ann:ids`, `data:ann:voices` und `data:cr-dub` in keinem
   einzigen Workflow; die ANN-Daten wären nach der ersten Nacht eingefroren.
2. **Eine Zeile in `tools/commit-data.sh`.** Sonst wirft der `git reset` im CI-Lauf weg, was
   gerade geholt wurde. Die Prüfung in `tools/check-workflows.mjs` fängt das ab.
3. **Eine Frist in `pipeline/check-sources.ts`.** Die Vorgabe sind vier Tage, und die passt nur
   für tägliche Abrufe.

**Punkt drei ist der, den man vergisst.** Der ADN-Katalog wird wöchentlich geholt, montags um
5:41. Gegen die Vier-Tage-Frist gemessen meldet er sich ab jedem Freitag als stumm — am
16.08.2026 kam deshalb eine Fehlermail für einen Lauf, an dem nichts kaputt war. Eine Warnung,
die jede Woche zuverlässig zu Unrecht kommt, ist schlimmer als keine: Man hört auf hinzusehen,
und die echte Störung geht darin unter.

Die Frist ist die Taktung plus zwei Tage Luft. Ein ausgefallener Lauf soll noch keinen Alarm
auslösen, zwei hintereinander schon.

## Der Worker läuft dem Web-Client immer hinterher

**Neue Endpunkte sind erst da, wenn `wrangler deploy` gelaufen ist — die Seite ist es schon beim
nächsten Push.** Zwischen beidem liegt ein Fenster, in dem der Client eine Route anspricht, die
es noch nicht gibt. Der Worker antwortet dann mit `404 Unbekannter Pfad`, und das sieht genauso
aus wie „dieses Abo gibt es nicht".

Am 15.08.2026 hat genau das Daniels Newsletter-Verbindung gekappt: Die neue Abfrage `/prefs`
bekam vom laufenden Worker ein 404, wertete es als erloschenes Abo und rief `clearSyncToken()`.
Sichtbar war es als Flackern — die verbundene Ansicht erschien für unter einer Sekunde und
sprang dann zurück.

Daraus zwei Regeln:

- **Ein 404 darf nur dort etwas löschen, wo die Route sicher existiert.** Über den Bestand eines
  Abos entscheidet allein `/favorites`; jede andere Abfrage meldet einen Fehler und lässt den
  Schlüssel in Ruhe.
- **Zerstörende Schlüsse brauchen einen zweiten Beleg.** „Der Server antwortet nicht wie
  erwartet" ist kein Beweis dafür, dass Nutzerdaten weg sind — es ist meist der Beweis, dass ein
  Deploy fehlt.

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

## Caches: die Adresse ist die Version

Datenadressen tragen den Datenstand (`/data/events.json?v=20260812142619`), eingesetzt in
`vite.config.ts` aus `meta.generatedAt`. Ohne das blieb nach einem Deploy die alte Fassung
stehen, und nur Strg+Shift+R half — dieselbe Adresse ist für Browser-Cache und Service Worker
dieselbe Datei, egal was darin steht.

- **Datenstand, nicht Commit-Hash.** Ein Deploy ohne Datenänderung soll niemanden 551 KB
  Titeldaten erneut laden lassen.
- **ICS-Feeds bekommen keine Kennung** (`feedUrl`). Die Adresse wird abonniert, nicht abgerufen;
  eine Kennung darin wäre beim nächsten Deploy ein totes Abo.
- **Offline ignoriert die Kennung** (`ignoreSearch` in `sw.js`) — lieber alte Termine als eine
  leere Seite.
- Jeder Cache im Service Worker hat eine Obergrenze. Ohne sie wächst er still: einmal 313 MB
  Cover (10.08.2026), einmal 400 KB Programmdateien je Deploy (12.08.2026).

## Wie der Stand geprüft wird, ohne Daniels Rechner

Alle Datenläufe arbeiten auf GitHubs Rechnern und committen selbst — stündlich die
Sendezeiten, täglich alle Quellen, montags der Tiefendurchlauf. Ob Daniels PC läuft, spielt für
den Datenbestand keine Rolle.

**Zu Beginn jeder Sitzung wird deshalb der Stand abgefragt, nicht vermutet:**

```bash
gh run list --limit 8 --repo danielzaiser91/anime-kalender-de
```

Dazu die beiden Dateien, die den Stand dauerhaft festhalten und im Repo liegen — sie sind auch
dann lesbar, wenn gerade kein Lauf sichtbar ist:

- **`data/source-health.json`** — je Quelle der Zeitpunkt des letzten erfolgreichen Abrufs.
  `npm run data:check` misst ihn gegen die Frist aus `pipeline/check-sources.ts` und macht den
  Lauf rot, wenn eine Quelle stumm geworden ist. **Das ist der Alarm**, und er kommt als
  Fehlermail von GitHub.
- **`public/data/meta.json`** — `generatedAt`, `titleCount`, `releaseCount`, `eventCount` des
  zuletzt ausgelieferten Datensatzes. Dieselben Zahlen stehen im Seitenfuß.

Eine Meldung an mich, wenn ein Lauf **erfolgreich** durch ist, gibt es nicht — GitHub meldet nur
Fehler. Wer sie will, legt einen Discord-Webhook an; eingehängt ist er in zwei Zeilen. Bis dahin
gilt: nachsehen statt annehmen.

## Vor dem Commit

```bash
npm run data:validate && npm run check:logic && npx tsc -b && npm run check:worker && npm run check:hooks && npm run build
```

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
