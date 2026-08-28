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

  Daraus folgt der Ablauf in `daniel-zum-abarbeiten/06-netflix-rest.md`: **Abspielen** verlinkt direkt auf
  `/watch/<reihe>`, der Player startet, die Erweiterung liest, ein Klick meldet.

- **Was auf der Titelseite läuft, ist nicht die Serie.** Der Player führt dort eine Sitzung
  namens `motion-billboard-…` — die Vorschau des Hero-Elements der **Startseite**, die hinter
  dem Titel-Overlay weiterläuft. Für „Pokémon Sonne & Mond", eine Reihe ohne eine einzige
  abrufbare Folge, meldete sie 18 Sprachen samt Deutsch: die des Films im Hintergrund
  (`movieId 82819831` gegen Reihe `80186475`). Die Erweiterung verwirft Sitzungen mit
  `motion-billboard`, `trailer` oder `preview` im Namen und liest nur auf `/watch/`.
- **Ein Fehlercode ist keine Auskunft — bei YouTube kostete das neun Preisangaben.** Neun
  Verweise antworten bei oEmbed mit HTTP 401. Der Lauf legte das als „kostenpflichtig" ab, und
  weil `zugangsart()` das Feld nie las, standen sie als **kostenlos** im Kalender: „Your Name",
  „FF7 Advent Children", „Fireworks". Beim Nachmessen an den Videoseiten (24.08.2026) stellte
  sich heraus, dass auch die Ablage falsch war — **sechs** der neun tragen eine `offerId`, also
  ein echtes Kaufangebot, drei nicht. Der 401 hat mehrere Ursachen (Kaufangebot,
  Altersfreigabe, Einbettungssperre), und oEmbed nennt keine davon.

  Zwei Folgen, und die zweite war der eigentliche Fund:

  - **Belegt wird der Kauf über `offerId`**, nicht über den Fehlercode. Sein Fehlen ist
    Schweigen. Zwei Zusicherungen in `check:zugangsart` halten beide Richtungen fest.
  - **Der Videotitel nennt die Fassung, wenn niemand ihn liest.** Zwei der drei heißen „Tokyo
    Ghoul, 2. Staffel, 1. Episode, **OmU**" und „My Hero Academia, Episode 01, **OmU**" —
    Untertitel statt Synchro, also genau die Trennlinie dieses Projekts, ausgesprochen vom
    Uploader selbst. `pipeline/lib/titel-muster.mjs` erkennt sie, ebenso eine fremde
    Synchronfassung („English Dub"). Ein `dub: false` folgt daraus **nicht** von selbst; die
    Fälle stehen ganz oben in `daniel-zum-abarbeiten/09-youtube-liste.md`.

  **Beim Preis wiegt ein Irrtum schwerer als beim Termin.** Wer „kostenlos" liest und an einer
  Kasse landet, ist schlechter dran als jemand, der gar keine Auskunft bekommen hätte.

- **Aus dem Fragezeichen wird ein Häkchen nur durch Nachsehen.** Geprüfte Fälle stehen in
  `data/dub-confirmed.yaml`, mit Datum. `dub: false` ist genauso wertvoll wie `true`.
- **Was ein Mensch geprüft hat, schlägt jede Ableitung** — der Eintrag gilt auch gegen ein
  automatisch gesetztes `true`.
- **Und gegen jede Ergänzung: ein Titel ohne Verweis ist nicht dasselbe wie ein Titel ohne
  geprüften Verweis.** Der Schutz in `build.ts` bestand bis zum 25.08.2026 nur aus drei
  `if (stream.dub !== undefined) continue` — der schützt einen **vorhandenen** Verweis vor
  Überschreibung. Eine Ergänzung, die einen entfernten Verweis neu **anlegt**, läuft daran
  vorbei: Dort gibt es kein `stream`, dessen `dub` man prüfen könnte.

  Genau das ist passiert. Ein Lauf gab 14 Titeln ohne Weg einen Verweis, weil TMDB einen
  Anbieter nannte und das MOTN-Archiv eine Adresse dazu hatte. Fünf davon hatten ihren Verweis
  aus gutem Grund nicht — Daniel hatte sie geprüft und als „ohne deutsche Tonspur" oder „nicht
  verfügbar" eingetragen, woraufhin der Bau sie entfernt. „Kino's Journey" auf Netflix etwa,
  geprüft am 22.08.2026: Folgen 1 bis 13 ohne deutschen Ton.

  **Ein fehlender Verweis ist deshalb selbst eine Angabe**, und `data/dub-confirmed.yaml` ist
  der Ort, an dem steht, ob er fehlt, weil niemand nachgesehen hat, oder weil jemand
  nachgesehen hat. Wer etwas hinzufügt, fragt die Datei genauso wie jemand, der etwas ändert.

  Gefangen hat es `check:handbelege`; der Deploy wurde rot, bevor etwas ausgeliefert war. Das
  ist die Prüfung, die genau dafür gebaut ist — und der Beleg, dass eine Zusicherung mehr wert
  ist als der Vorsatz, an die Regel zu denken.
- **Nie raten, auch nicht bei starken Indizien.** Eine YouTube-Playlist des deutschen
  Crunchyroll-Kanals ist ein Hinweis, kein Beleg; dieselbe Playlist enthält auch untertitelte
  Folgen.
- `npm run data:dub-checks` erzeugt aus dem aktuellen Stand die Arbeitsliste
  `daniel-zum-abarbeiten/07-alle-anbieter.md` — nach hinten sortiert von heute, ohne Künftiges (das kann niemand
  nachsehen) und ohne bereits Geprüftes. Eine Zeile ist eine **Reihe auf einem Anbieter**: Wer
  den Verweis öffnet, sieht dort in aller Regel alle Staffeln auf einmal.

**Kurzschrift für Daniels Antworten** (12.08.2026) — sie steht auch im Kopf der Liste:

| Zeichen | Bedeutung | wird zu |
|---|---|---|
| `1` | hat deutsche Synchro | `dub: true` |
| `0` | keine deutsche Synchro, nur Untertitel | `dub: false`, **und der Verweis wird entfernt** |
| `x` | kein Video: nicht verfügbar, tot, Weiterleitung | `available: false`, Verweis wird entfernt |

**Ein belegtes Nein entfernt den Verweis — seit dem 15.08.2026.** Bis dahin blieb er stehen
und trug ein rotes „🇩🇪 ✕"; die Begründung war, die Auskunft „dort nur Originalton" sei ja
brauchbar. Für diese Seite ist sie es nicht: Sie beantwortet **eine** Frage, und zwar wo ein
Anime auf Deutsch zu sehen ist (Daniel: „wir interessieren uns als app nur für deutsche
synchros, keine anderen synchron sprachen"). Die Stelle ist `build.ts`, direkt nach den
Anbieterrunden.

Deshalb steht im ausgelieferten Datensatz bei **keinem** Verweis ein `dub: false` — nicht,
weil keiner eins bekäme, sondern weil er danach nicht mehr da ist. Wer die Zahl der Urteile
aus dem Baulog gegen den Datensatz hält, findet dort zwangsläufig weniger und darf daraus
nicht auf einen Verlust schließen: Am 27.08.2026 meldete der Bau 625 Crunchyroll-Urteile,
im Datensatz standen 568 — die Differenz waren die entfernten Neins, kein Fehler.

**Ein unbeantwortetes `undefined` bleibt selbstverständlich stehen.** Es heißt „wir wissen es
nicht", nicht „dort gibt es keine".
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

### Amazon: die Folgenliste kommt seitenweise, und die Seite verrät ihre eigenen Zugänge

Prime Video zeigt lange Staffeln in Abschnitten („Folgen 1–24", „25–48", „49–51"). **Im
Quelltext steht immer nur der gewählte Abschnitt** — wer ihn als Staffel liest, hält 24 von 51
Folgen für das Ganze. Genau das tat die erste Fassung der Erweiterung (Daniel, 23.08.2026, mit
Bild: „aber warum steht beim button 27? auf der seite gibt es ein dropdown für folge 1-24").

Nachgeladen wird über `/gp/video/api/getDetailWidgets?titleID=<ASIN>&widgets=[…]`. Die Antwort
ist gültiges JSON und trägt neben dem Abschnitt **die Zugänge zu allen übrigen**:

```
widgets.episodeList.episodeCount                     → 51
widgets.episodeList.episodes[].detail.audioTracks    → ["Deutsch"]
widgets.episodeList.episodes[].detail.episodeNumber  → 25 … 48
widgets.episodeList.actions.episodePages[].token     → alle drei Abschnitte
```

Drei Dinge, die man beim Weiterbauen braucht:

- **Geparst, nicht abgetastet.** Die erste Fassung suchte per Muster ein `episodeNumber`
  innerhalb von 240 Zeichen hinter `audioTracks`. Gemessen sind es 217 — es ging gut, mit 23
  Zeichen Luft, und nur weil `contributors.cast` bei dieser Serie leer ist. Ein Abstand, der
  vom Inhalt eines Nachbarfelds abhängt, ist keine Regel, sondern ein Zufall mit Frist.
- **`episodeCount` schlägt die Zahl im Seitengerüst.** Die dort steht für die gerade gewählte
  Staffel; die Nachlade-Antwort meint die Folgenliste, um die es geht.
- **Aus einem Ausschnitt entsteht nie ein Nein.** „Deutsch gefunden" bleibt wahr, auch bei 24
  von 51 Folgen. „Kein Deutsch" wäre eine Aussage über die ganze Staffel, gestützt auf die
  Hälfte — dieselbe Asymmetrie, die dieses Projekt an fremden Quellen bemängelt.

**Die erste Fundstelle eines Feldnamens ist fast nie die richtige.** `titleID` steht im
Quelltext der Digimon-Seite **220-mal** — 1,6 MB, Empfehlungsleisten, Verfolgungsmarken, leere
Vorlagen. Eine Fassung, die `indexOf` nimmt und beim Misserfolg aufgibt, scheitert an der
falschen Stelle und sieht die richtige nie; genau daran blieb der Knopf zweimal bei „24 von
51" stehen. Gesucht wird über **alle** Fundstellen, bis eine einen brauchbaren Wert trägt.

**Und was direkt daneben steht, gehört nicht dazu.** Hinter `episodePages` führt Amazon
dieselben Abschnitte ein zweites Mal als `pagination` („Vorherige Seite", „Nächste Seite") —
unter **eigenen Tokens**. Ein Ausschnitt fester Länge fängt beide, und der Leser holte einen
Abschnitt doppelt: 267 KB umsonst je Seitenaufruf. Geschnitten wird deshalb über die Klammern
des Arrays, nicht über eine Zeichenzahl und nicht über das Stichwort dahinter.

**Die Erweiterung holt die übrigen Abschnitte selbst**, mit den mitgelieferten Tokens, in
Daniels angemeldeter Sitzung, 400 ms auseinander, höchstens 25 Stück. Das ist Zeichen für
Zeichen der Abruf, den ein Klick aufs Auswahlfeld auslöst — keine Suche, kein Durchlauf, keine
zweite Serie. Wo die Grenze greift oder ein Abruf fehlschlägt, bleibt die Zahl unvollständig,
und der Knopf sagt es.

**Und eine Prime-Kennung hat nicht immer zehn Zeichen.** Sieben Muster in der Erweiterung
suchten sie als `[A-Z0-9]{10}` — die Länge einer ASIN. Prime Video führt daneben **GTIs mit 26
Zeichen**, und das Muster schnitt sie ab: Aus `0J16B1NAB82TO0O5A5Q8TLG1VP` wurde
`0J16B1NAB8`. Der Abgleich zwischen Adresse und Quelltext scheiterte damit zwangsläufig, die
Tonspuren wurden gar nicht erst gelesen, und der Knopf blieb auf „Tonspuren noch nicht geladen"
stehen — bei „Babylon" wie bei „Akame ga Kill" (25.08.2026).

**Aufgefallen ist es nur durch eine Messung in Daniels Sitzung**, und das ist die eigentliche
Lehre: Von außen sah es aus, als fehlten die Daten. Tatsächlich lagen 15 Tonspurangaben mit
Deutsch auf der Seite, und die Paarung fand 12 Folgen — gelesen wurden sie nie, weil ein
Wächter davor die Seite für die falsche hielt. Ein Befund „nichts gefunden" beantwortet die
Frage nicht, **ob überhaupt gesucht wurde**.

Der Feldabstand aus derselben Messung gehört dazu: Zwischen `audioTracks` und der zugehörigen
`episodeNumber` lagen **33.651 Zeichen**. Jede feste Abstandsgrenze im Muster wäre daran
gescheitert; gepaart wird deshalb über die Reihenfolge — zur Tonspurangabe gehört die nächste
Folgennummer dahinter, solange vorher keine weitere Tonspurangabe kommt.


**Was die Erweiterung je Takt kostet, steht gemessen in
[`extension/PERFORMANCE.md`](extension/PERFORMANCE.md)** — mit den Stellen, die man
zwischenspeichern darf, und denen, die aussehen wie Sparpotenzial und keins sind. Wer an
`amazon.js` oder `amazon-leser.js` etwas an der Leistung ändern will, liest das zuerst:
Mehrere der teuer aussehenden Muster sind Reparaturen echter Fehlschläge.

### Der Quelltext veraltet beim Staffelwechsel — und das ist die Wurzel

**Amazon tauscht beim Wechsel über das Auswahlfeld den Quelltext nicht aus.** Adresse und ASIN
wandern mit, die JSON-Fracht im Skriptblock bleibt die der geladenen Seite. Gemessen am
24.08.2026 mit `tools/amazon-diagnose.js`, an zwei Titeln unabhängig:

```
GOSICK, Staffel 1 → 2
ms     adrAsin       adrStaffel   qtAsin        qtStaffel
262    B0B8MTPWRN    —            B0B8MTPWRN    1
7261   B0B8XVGL62    2            B0B8MTPWRN    1
8519   B0B8XVGL62    2            B0B8MTPWRN    1

Captain Tsubasa, Staffel 1 → 2 → 3
263    B07C1D8JXX    —            B07C1D8JXX    1
12018  B07CZRCQ6V    2            B07C1D8JXX    1
19766  B07DNKH81W    3            B07C1D8JXX    1
```

Nach zwanzig Sekunden und zwei Wechseln steht der Quelltext unverändert auf Staffel 1.
Folgenzahl, Staffelnummer, Kennung und Abschnitts-Tokens gehören danach alle zur **alten**
Staffel.

**Daraus folgt für jede Auswertung dieser Seite:** Nach einem Dropdown-Wechsel ist der
Quelltext wertlos. Verlässlich bleibt allein die Adresse — sie trägt `?ref_=…_sN` und die ASIN
der gewählten Staffel.

Die Erweiterung verlangt deshalb seit dem 24.08.2026 ein Neuladen, sobald Adresse und
Quelltext verschiedene Staffelnummern nennen. Das ist keine Notlösung: Sie kann nicht wissen,
was Staffel 3 enthält, wenn Amazon es nirgends hinschreibt.

**Was das an einem Abend gekostet hat**, gehört dazu: ein Dutzend Fehler, die alle wie
verschiedene Fehler aussahen — falsche Folgenzahl, verschluckte Meldungen, „nicht abrufbar"
bei vorhandenen Titeln, hängende Knöpfe. Dagegen wurden nacheinander sechs Wächter gebaut
(Beruhigungsfristen, Signaturvergleiche, Zustandsprüfungen), von denen drei zurückgenommen
werden mussten, weil sie neue Fehler erzeugten — und einer brachte den Tab mit „Out of Memory"
zum Absturz, weil jede neue Prüfung den 1,6 MB großen Quelltext ein weiteres Mal las.

**Die Lehre ist nicht die Regel, sondern der Weg dorthin:** Drei Minuten Messung an der echten
Seite hätten das an jedem Punkt des Abends beendet. Der Grund, warum es sie nicht gab, war,
dass die Seite in Daniels angemeldeter Sitzung läuft — also wurde geraten statt gefragt. Wo
eine Messung nur ein Mensch machen kann, wird sie **erbeten**, nicht ersetzt.


**Und ein sprunghafter Fehler ist ein Wettlauf, kein Zustand.** Am 25.08.2026 kostete diese
Verwechslung vier Fassungen: Die Erweiterung zeigte beim Wechsel zwischen Titeln mal die
richtige Folgenzahl, mal die des vorigen. Gesucht wurde jedes Mal im Zustand — ein hängender
Wert, ein zweiter, ein Vergleich, der zweimal dieselbe Quelle abfragte. Jede Erklärung passte zu
den Daten, keine hielt.

Gefunden hat es Daniel durch **Abwarten**: sofort weiterklicken ergab „13 von 24", zwanzig
Sekunden warten „24 von 24". Die noch laufenden Nachlade-Abrufe des vorigen Titels antworteten
nach dem Wechsel, und ihre Daten landeten im frisch geleerten Zählstand des neuen.

**Der Prüfgriff dauert zwei Durchläufe** — dieselbe Handlung einmal so schnell wie möglich,
einmal mit Pause. Unterscheiden sich die Ergebnisse, ist es Timing, und jede Zustandsanalyse
davor war verlorene Zeit.

**Der Fix ist immer derselbe:** Jede asynchrone Antwort trägt mit, wozu sie gehört, und der
Empfänger verwirft Fremdes. Hier ist es `fuerAdresse` an jeder Mitleser-Meldung. Eine überholte
Antwort ist schlimmer als keine — sie sieht aus wie ein Ergebnis.


### Ein `let` weiter unten ist kein `undefined`, sondern ein Absturz

Am 25.08.2026 meldete Daniel: „dialog öffnet sich nicht auf amazon.de". Das Fehlerbild aus
`chrome://extensions`:

```
Uncaught ReferenceError: Cannot access 'listenId' before initialization
amazon.js:1286 (anonymous function)
```

`listenSignatur()` liest `listenId` rund 300 Zeilen **vor** dessen `let`. Beides steht im
selben Scope, und ein `let` hebt den Namen zwar hoch, aber nicht den Wert: Jeder Zugriff
davor wirft, statt `undefined` zu liefern.

**Aufgefallen ist es erst nach Monaten, und der Grund dafür ist die eigentliche Lehre.** Der
Fehler tritt nur auf Seiten auf, deren Adresse **keine Kennung** trägt. Gemessen am Stand
vor dem Fix, mit demselben Klick auf drei Adressen:

| Adresse | Klick auf den Übersichts-Knopf |
|---|---|
| `/` | **Fehler** — Cannot access 'listenId' |
| `/gp/video/storefront` | **Fehler** — dito |
| `/dp/B0DJYJBNWF` | ok |

Auf einer Titelseite setzt der Ablauf den Wert, bevor jemand die Liste öffnet. **Und alle
43 Zusicherungen starteten mit genau dieser dritten Adresse** — die Prüfung deckte den
Normalfall vollständig ab und den Fehlerfall gar nicht.

Zwei Folgen für jede künftige Prüfung:

1. **Wo eine Erweiterung überall läuft, gehört in die Zusicherungen.** Das Manifest sagt
   `https://www.amazon.de/*` — das ist die Startseite, der Shop und jede Videoseite. Wer nur
   die interessanteste davon prüft, prüft die Seite, auf der ohnehin niemand klickt.
2. **Ein sichtbarer Knopf beweist nicht, dass das Skript durchgelaufen ist.** Er entsteht vor
   der Absturzstelle. Was danach kommt — Zahl aktualisieren, Liste öffnen — läuft nicht mehr,
   und die Zahl auf dem Knopf bleibt stehen, wie sie beim Aufbau gerade war. Das sieht aus
   wie ein veralteter Wert und ist ein toter Ablauf.

Nachprüfbar mit `node tools/amazon-startseite-pruefen.cjs` — es lädt `amazon.js` in einem
Sandkasten, einmal je Adresse, und klickt.

### Ein Titelwechsel sieht aus wie ein richtiger Befund — die Kennung entlarvt ihn

Am 25.08.2026 meldete die Erweiterung für **„My Isekai Life"** neun Tonspuren
einschließlich Deutsch, und der Knopf war grün. Daniel: „button war grün, aber titel
hat keine deutsche sprachausgabe."

Die Meldung trug zwei Kennungen, und darin steckt der ganze Fall:

```
url:      .../gp/video/detail/0RNU3R7XQ7HDN1EOCZRAFD5R5R
notiz:    „Amazon-Seite B0FMNQMXXG"
sprachen: Deutsch, English, Español ×2, Français, Italiano, Português, ไทย, 日本語
```

Beide nachgemessen, ohne Anmeldung:

| Kennung | Titel | Zugang | `audioTracks` je Folge |
|---|---|---|---|
| `0RNU3R7XQ7HDN1EOCZRAFD5R5R` | My Isekai Life | `animedigitalde` (ADN-Kanal) | `["日本語"]`, 12×12 |
| `B0FMNQMXXG` | Ein Stern, heller als die Sonne | `Prime`, `FVOD` | die neun Sprachen, 13× |

Der zweite Titel war Daniels **vorige** Meldung — abgeschickt vier Sekunden früher.
Die Adresse war schon gewandert, der Quelltext noch nicht.

**Keiner der drei vorhandenen Prüfsteine konnte greifen**, und das ist der Kern:
Die Staffelnummer war in beiden Fällen dieselbe, die Folgenzahl **beide Male 12**,
und ohne gezielt geholten Block (`frischeStaffel === null`) fiel der Kennungsvergleich
ganz aus — bewusst, damit Sammelseiten funktionieren. Drei Wächter, drei blinde Flecken
am selben Punkt.

**Was trägt, ist eine andere Frage als die bisherige.** Bisher wurde gefragt: *Nennt der
Quelltext dieselbe Kennung wie die Adresse?* Darauf antwortet eine echte Seite regelmäßig
mit Nein, ohne dass etwas kaputt ist — Digimon Tamers liegt unter der Adresse
`B0CQ4VL364` und trägt im Quelltext die `titleID` `B0CKPCSHMC`. Die tragfähige Frage
lautet stattdessen: **Kennt der Quelltext die Kennung aus der Adresse überhaupt?**

An sechs Seitenabrufen gemessen:

| | Treffer |
|---|---|
| eigene Kennung im eigenen Quelltext | 11× bis 119× |
| fremde Kennung im Quelltext | **0×** |
| Digimon: Adress-Kennung neben fremder `titleID` | 11× (die `titleID` 79×) |
| GOSICK Staffel 1: Kennung der **zweiten** Staffel | 3× |

Die letzten beiden Zeilen sind die eigentliche Gegenprobe: Ein *Staffel*wechsel und eine
Seite mit zwei Ausgaben laufen nicht hinein, ein *Titel*wechsel schon. Null Treffer heißt
deshalb eindeutig: Der Quelltext gehört zu einem anderen Titel.

**Und die allgemeine Lehre steht über dem Einzelfall:** Ein Wächter, der zwei Dinge auf
Gleichheit prüft, scheitert an jedem Fall, in dem Ungleichheit erlaubt ist — und die
Ausnahme, die man dafür einbaut, ist genau das Loch. Die Frage nach **Zugehörigkeit**
(kommt es vor?) trägt, wo die Frage nach **Gleichheit** (ist es dasselbe?) eine Ausnahme
braucht.

### Zwei Meldungen zu einer Reihe widersprechen sich selten — meist reden sie über verschiedene Staffeln

Am 25.08.2026 stand für „Mahouka Koukou no Rettousei" beides im Bestand: eine Meldung
„Staffel 3, 13 Folgen, **kein Deutsch**" und, Minuten später auf derselben Seite, ein Knopf
mit „🇩🇪 Deutsch · 13 Folgen". Das sah nach einem Fehler in der Erweiterung aus. Es war keiner.

Daniel hat nachgesehen, und die Auflösung ist eine Regel für jede künftige Zuordnung:

- Unsere Listen-Kennung `B0CH5BXKFX` („Raihousha-hen") führt auf Amazons **Staffel 2** — zehn
  von dreizehn Folgen im Prime-Abo, deutscher Ton in einer davon angespielt und bestätigt.
- Die Meldung „Staffel 3, kein Deutsch" gehört zu `B0CWRDZVBY` — der **nächsten** Staffel, die
  über den Crunchyroll-Kanal läuft und nur englischen Ton hat.

**Eine Amazon-Kennung zeigt auf eine Staffel, unsere Titel-Kennung auf einen Anime — und
Amazons Staffelnummer ist keine von beiden.** Wer zwei Angaben zu „derselben Serie"
vergleicht, muss deshalb zuerst prüfen, ob sie dieselbe Staffel meinen. Widersprechen sie sich
danach immer noch, ist es ein echter Widerspruch; vorher ist es eine Verwechslung.

Der praktische Griff dazu: Die **Kennung** vergleichen, nicht den Titel und nicht die Nummer.
Sie ist das Einzige, was Amazon und unser Bestand gemeinsam führen.

### Bei einem Kanal-Titel ist Amazons Sprachangabe kein Beleg

Prime Video führt zweierlei unter derselben Oberfläche: eigene Inhalte („In Prime enthalten",
`benefitId: "Prime"`) und **Kanal-Abos** wie ADN, aniverse oder Crunchyroll, die man dort
dazubucht. Der Unterschied entscheidet, ob die Tonspur-Angabe etwas taugt.

Daniel am 24.08.2026: „prüft die extension wirklich ob jede einzelne folge eine deutsche
tonspur hat, oder liest sie nur aus dem audio feld auf der overview? die erste folge kann ich
als deutsch dort bestätigen, für die anderen brauch man die prime adn subscription."

Die Frage traf. Gemessen an „Kill Blue", das auf Prime nur über die Kanäle ADN, aniverse und
Crunchyroll läuft:

| Quelle | deutsche Folgen |
|---|---|
| **Amazon behauptet** | **12** |
| ADN direkt (Daniels Konto) | 4 |
| Netflix (am selben Tag) | 4 |
| Crunchyroll | 0 |

Zwei unabhängige Messungen sagen vier, Amazon sagt zwölf. Bei einem Kanal-Titel zeigt Amazon
offenbar die Sprachen, die der **Kanal** führt, nicht die der einzelnen Folge — die Angabe
steht je Folge im Quelltext, wiederholt aber dieselbe Auskunft.

**Bei „Digimon Tamers" stimmte sie**, und der Unterschied ist ablesbar: Dort stand „In Prime
enthalten". Deshalb prüft die Erweiterung seit dem 24.08.2026 das `benefitId`:

- `Prime` dabei → eigener Inhalt, die Angabe zählt
- nur Kanäle → der Knopf trägt **⚠ Kanal**, die Meldung das Feld `ueberKanal`, und die Notiz
  sagt es im Klartext
- Kauf- oder Leihtitel → zählt ebenfalls, denn was gekauft wird, hat seine eigene Tonspur

Die Meldung wird nicht unterdrückt — ein Hinweis bleibt ein Hinweis. Aber aus ihr darf kein
Beleg werden, und das ist dieselbe Trennung, die dieses Projekt bei Crunchyroll schon zieht.

## Eine Serie ist bei Crunchyroll kein Block — und ein Block ist kein Beleg über die Serie

Am 25.08.2026 fehlte im Kalender jeder Crunchyroll-Verweis für **Detektiv Conan**, obwohl die
Serie dort auf Deutsch läuft. Daniel: „crunchyroll hat die titel, prime hat sie auch mit
crunchy abo, unser crunchy lauf hätte alle finden müssen." Sein Stand, von Hand geprüft:
**Folgen 1–254 und 334–483 auf Deutsch, dazu drei Specials und 1–182 als HD-Remaster.**

Die Kette, die dazu geführt hat, ist vollständig nachgemessen:

1. aniSearch liefert die richtige Adresse: `crunchyroll.com/detektiv-conan`.
2. Im Titel steckte aber schon ein Crunchyroll-Verweis — `crunchyroll.com/de/**case-closed**`,
   der **englische** Titel. Weil je Anbieter nur ein Verweis übernommen wird, verdrängte er den
   deutschen.
3. Der Lauf las zu `case-closed` die Serienkennung `G6JQVM3ER`, fand dort **eine** Staffel mit
   33 Folgen und `ja-JP`, und schrieb `deutschImAngebot: false`.
4. Weil der Befund `katalog: 'de'` trug, wurde daraus ein `dub: false` — und der Filter „ohne
   deutsche Synchro" entfernte den letzten Crunchyroll-Verweis der Serie.

Am Ende blieb eine Prime-**Suchadresse** übrig. Genau das sah Daniel.

**Der Fehler steckt in Schritt 3, und er ist kein Einzelfall.** Eine Serienkennung bei
Crunchyroll bezeichnet einen **Block**, nicht das Werk: Der ältere CMS-Pfad legt je Tonspur
und je Ausgabe eine eigene Staffel an, und bei langen Serien liegen die deutschen Folgen unter
einer anderen Kennung als die japanischen. „33 Folgen, kein Deutsch" ist deshalb eine wahre
Aussage über `G6JQVM3ER` und eine falsche über Detektiv Conan.

**Daraus folgt (Daniel, 25.08.2026): „der lauf muss jede folge individuell prüfen."** Solange
die Einheit der Prüfung die Staffel oder gar die Serie ist, entscheidet die Auswahl des Blocks
über das Ergebnis — und die Auswahl trifft eine Adresse, die aus einer fremden Datenbank
stammt. Je Folge geprüft, ist der Befund unabhängig davon, welchen Block man erwischt hat.

**Und Prime zählt anders als Prime.** Im selben Zug gemessen (Daniels Bildschirmabzug vom
25.08.2026, `primevideo.com/detail/0QH1CWNXTTK6IXP1G4H5B8M7W9`): In **einer** Staffelansicht
stehen nebeneinander

| Nummer | Titel | Datum |
|---|---|---|
| 149 | Besucht doch mal die Heimat des Steinzeitmenschen | 25. Juli 2026 |
| 150 | Wer ist das Ziel? | 1. Aug. 2026 |
| 151 | Das verfluchte Nachbarhaus | 22. Aug. 2026 |
| **1146** | The Whistling Bookstore 4 | **21. Dez. 2024** |
| **1147** | 1147 - Case Closed - S03 | — |

Dieselbe Liste führt die deutsche Zählung (149–151) und die japanische Gesamtzählung
(1146–1148) nebeneinander, mit Titeln in zwei Sprachen und Terminen aus zwei Jahren. **Eine
Folgennummer von Prime ist damit kein Ordnungsmerkmal**, und ein Releasedatum dort belegt
keinen deutschen Termin. Verlässlich bleibt, was je Folge an der Folge steht — die Tonspur.

### Wie eine Folge eindeutig wird — gemessen am 25.08.2026

Daniel: „du musst herausfinden wie du episoden eindeutig zuordnen kannst." Die Antwort steht in
der Antwort der API selbst; sie wurde bisher nur nicht gelesen. **Jede Folge nennt ihre
sämtlichen Sprachfassungen mit**:

```
identifier            GR751KNZY|S2|E26          Serie | Staffel | Folge
episode_air_date      2017-04-01T…+09:00        japanische Erstausstrahlung
slug_title            beast-titan               englischer Slug, sprachunabhängig
versions[]            ja-JP*, en-US, pt-BR, es-419, de-DE, es-ES, pl-PL
```

**`versions` ist der Schlüssel, und er hängt an der Folge, nicht am Block.** Damit wird die
Frage „gibt es diese Folge auf Deutsch" beantwortet, ohne dass man den richtigen Block erraten
muss — der Fehler, an dem Detektiv Conan gescheitert ist. Gemessen an zwei Serien:

| Serie | Block | Folgen mit `de-DE` |
|---|---|---|
| Attack on Titan, Staffel 2 (`GR49C7303`) | Originalblock | **12 von 12** |
| Blue Exorcist, Kyoto Saga (`GY9P57Z9R`) | Originalblock | **0 von 12** |
| Blue Exorcist, Shimane Illuminati (`GRDQCGKJ0`) | eigener Block | trägt `de-DE` |

Blue Exorcist zeigt, warum die Serienebene nicht genügt: **Dieselbe Serie ist blockweise
verschieden** — eine Staffel deutsch, die andere nicht. Ein Urteil über „die Serie" ist
deshalb immer entweder zu großzügig oder zu streng.

**Und über Anbieter hinweg trägt nur `episode_air_date`.** Folgennummern taugen nicht: Prime
führt in einer Liste die deutsche Zählung (149–151) neben der japanischen Gesamtzählung
(1146–1148), Crunchyroll vergibt bei Blue Exorcist eine Staffelnummer der Form `S00095473`.
Die japanische Erstausstrahlung ist dagegen ein Datum, das keine Plattform neu vergibt — sie
ist der gemeinsame Anker zu AniList und zu jedem anderen Dienst. Als zweiter Anker dient
`slug_title`: Er ist englisch und ändert sich mit der Tonspur nicht.


**Die japanische Erstausstrahlung allein genügt nicht — gemessen an 1.416 Folgen aus 24
Serien und 80 Blöcken.** Daniel hatte den Prüfweg vorgegeben: „prüf das am besten an
beispielen die gleichzeitig oder fast gleichzeitig erschienen sind und an combined episodes."

| Prüfung | Befund |
|---|---|
| zwei **verschiedene** Folgen mit demselben Datum im selben Block | **188** |
| kombinierte Folgen (`episode` als „1-2") | 0 |
| Folgen ohne `episode_number` | 2 |
| `episode_number` weicht von `sequence_number` ab | 1 |

Der Bruch hat einen Namen: **Katalogtitel**. Bei JoJo (`GRZXCM7PM`) tragen alle Folgen den
`2021-11-18` — das ist der Tag, an dem Crunchyroll die Serie ins Angebot genommen hat, nicht
die japanische Erstausstrahlung von 2012. `episode_air_date` meint bei Wochenserien die
Ausstrahlung und bei Katalogtiteln die Aufnahme, und die Antwort verrät nicht, welches von
beidem sie gerade ist.

Die beiden anderen Befunde zeigen, warum auch `episode_number` allein nicht trägt: „PV1"
kommt ohne Nummer (`sequence_number: 0` — ein Trailer, keine Folge), und Specials tragen
gebrochene Werte (`6.5`, `8.5`), wobei eines davon `episode_number: 2` neben
`sequence_number: 8.5` führt.

**Was daraus folgt, ist eine Kombination statt eines Werts:**

| Zweck | Schlüssel |
|---|---|
| Folge **innerhalb** Crunchyroll | `series_id` + `season_sequence_number` + `sequence_number` |
| dieselbe Folge in einer anderen Tonspur | `versions[].guid` — die Folge nennt ihre Fassungen selbst |
| Folge **über Anbieter hinweg** | `episode_air_date`, **aber nur wenn es innerhalb des Blocks variiert**; sonst fällt es auf die Nummer zurück |
| „ist das überhaupt eine Folge" | `sequence_number` ganzzahlig und ≥ 1 — Trailer tragen 0, Specials Brüche |

**Für die Sprachfrage braucht es die Zuordnung gar nicht.** `versions[].audio_locale` steht an
der Folge selbst; ob es sie auf Deutsch gibt, ist damit ohne jeden Abgleich beantwortet. Die
Zuordnung wird erst gebraucht, wenn der Befund an unsere Folgennummern gehängt wird — und dort
ist die Reihenfolge maßgeblich, nicht das Datum.


### Die Suche im deutschen Katalog — und ein Token ohne Browser (25.08.2026)

Zwei Funde, die zusammen den Detektiv-Conan-Fall und die 324 Serien ohne Staffeldaten lösen.

**1. Ein anonymes Bearer-Token gibt es per einfachem POST.** Bisher holte der Lauf es aus dem
Netzwerkverkehr einer mit Playwright geladenen Seite:

```
POST https://beta-api.crunchyroll.com/auth/v1/token
Authorization: Basic <base64 von "noaihdevm_6iyg0a8l0q:">
Content-Type: application/x-www-form-urlencoded
grant_type=client_id
```

Antwort: HTTP 200, `access_token`, **3600 Sekunden gültig**, dazu `country` — bei einem Abruf
von hier steht dort `DE`. Gegen `www.crunchyroll.com` läuft derselbe Aufruf in Cloudflares
„Just a moment…" (403); über `beta-api` gibt es keine Bot-Sperre.

**2. Damit antwortet die Suche.** `cms/v2<bucket>/search` gibt 502 und `content/v2` ohne Token
401 — mit Token liefert sie genau das, was aus einer Adresse nie zu bekommen war:

```
GET https://beta-api.crunchyroll.com/content/v2/discover/search
    ?q=Detektiv+Conan&n=12&type=series&locale=de-DE
```

```
GW4HM7NV3  Detektiv Conan       Folgen 0    Staffeln 0  audio=ja-JP,de-DE
G6JQVM3ER  Detective Conan      Folgen 581  Staffeln 2  audio=ja-JP
```

**Das ist der ganze Fehler in zwei Zeilen.** Unser Bestand führte `G6JQVM3ER` — den
englischsprachigen Eintrag, abgeleitet aus der Adresse `crunchyroll.com/de/case-closed`. Die
deutsche Serie liegt unter `GW4HM7NV3`, und die Suche nennt ihre Tonspuren gleich mit.

**Der Prüfstein hält.** Daniel hatte von Hand gemeldet: Folgen 1–254 und 334–483 auf Deutsch,
drei Specials, 1–182 als HD-Remaster. Was `GW4HM7NV3` liefert:

| Block | Folgen | Spanne | mit `de-DE` |
|---|---|---|---|
| Detektiv Conan 1-182 (HD Remaster) | 171 | 1–182 | 171 |
| Detektiv Conan 1-111 (Dt. Opening) | 111 | 1–111 | 111 |
| Detektiv Conan 112-182 (Dt. Opening) | 71 | 112–182 | 71 |
| Detektiv Conan 183-254 (Dt. Opening) | 72 | 183–254 | 72 |
| Detektiv Conan 334-433 | 100 | 334–433 | 100 |
| Detektiv Conan 434-483 | 50 | 434–483 | 50 |
| TV Special — LUPIN III. | 2 | — | 2 |
| TV Special — Episode ONE | 2 | — | 2 |
| TV Special — Lovestory | 2 | — | 2 |

405 deutsche Folgen, Bereiche **1–254 und 334–483**, drei Specials, HD-Remaster als eigener
Block. Punkt für Punkt Daniels Stand — ohne dass jemand eine Zahl von Hand eingetragen hätte.

**Was daraus für den Lauf folgt:** Die Serienkennung wird gesucht, nicht aus der Adresse
geraten. Und weil das Token an die **IP** gebunden ist (`country`), entsteht die Zuordnung
Titel → Kennung auf einem Rechner in Deutschland und wird als Datei committet; der Cloud-Lauf
liest sie nur noch.


### Disney+ beantwortet mit einem POST, wofür Netflix einen Player braucht

Gemessen am 26.08.2026 an Jujutsu Kaisen, nachdem der Netflix-Weg zehn Tage
gekostet hatte. Der Unterschied ist nicht graduell:

```
POST https://disney.playback.edge.bamgrid.com/v7/playback/ctr-regular
     { playback: {…}, playbackId: "<resourceId der Folge>" }
  -> stream.renditions.audio[] = [{ language: "de", name: "German" }, …]
```

**Acht Tonspuren im Klartext, ohne Player, ohne Wiedergabe, ohne DRM, ohne ein
einziges Videosegment.** Bei Netflix steht dieselbe Angabe nur an einem
laufenden Player, und das Manifest ist MSL-verschlüsselt.

Drei Einzelheiten, die den Weg tragen:

- **Die `playbackId` steht offen in der Folgenliste.** Sie ist wörtlich die
  `resourceId`, die `/explore/v1.18/page/` und `/season/` je Folge mitliefern —
  base64 über `{mediaId, availId, availVersion, sourceId, contentType}`. Dazu
  `visuals.seasonNumber` und `visuals.episodeNumber` im Klartext. Der
  Seitenaufruf allein bringt schon 15 Folgen mit; ein Staffelwechsel ist für die
  erste Staffel nicht nötig.
- **Der zweite Weg wird nicht gebraucht.** `stream.sources[].complete.url` führt
  auf eine HLS-Master-Playlist, und die ist **unverschlüsselt**:
  `#EXT-X-MEDIA:TYPE=AUDIO,NAME="German",LANGUAGE="de"`. Sie ist signiert und
  ohne Token abrufbar. Für die Sprachfrage genügt aber schon die Antwort selbst.
- **Kein Base64-Feld der Seite trägt Sprachinformation.** Über den ganzen
  Mitschnitt geprüft: 1.265 Kandidaten, 422 entschlüsselbar, davon 202
  Telemetrie-`infoBlock`s und der Rest JWTs der Zustimmungsverwaltung — **null
  mit Sprachbezug**. Gegenprobe: dieselbe Schleife findet 95 Felder mit
  `mediaId`, die Dekodierung funktioniert also. Die Sprachen stehen
  ausschließlich hinter dem Playback-Aufruf.

**Offen: ob der POST einen Eintrag unter „Weiterschauen" erzeugt.** Nach dem
ersten Durchlauf stand dort „Jujutsu Kaisen, Noch 23 Min., S2:F1" — nur hatte
Daniel dieselbe Folge kurz zuvor selbst abgespielt, um den Playback-Aufruf
mitzuschneiden. Der Eintrag belegt also nichts; er hat genauso gut den einen
Grund wie den anderen. Seine Rückfrage: „du machst voreilige schlüsse, ich hab
doch selbst auch die episode aufgemacht."

**Der Griff, der es entscheidet, ist eine Gegenprobe**, und es ist derselbe, der
schon bei `getVideoMetadataByVideoId` den Unterschied gemacht hat: eine Serie
prüfen, die **nie** geöffnet wurde. Steht sie danach in „Weiterschauen", liegt es
am POST; steht sie nicht dort, an der Handarbeit. Solange das offen ist, meldet
die Erweiterung bei Disney+ nichts — eine Meldung lässt sich zurücknehmen, ein
Eintrag in Daniels Verlauf ist Handarbeit.

**Und die Lehre über dem Einzelfall:** Der Fund kam aus einer Frage, die ich beim
ersten Durchgang nicht gestellt hatte. Ich hatte den Mitschnitt nach
Klartext-Sprachfeldern durchsucht und „nichts gefunden" gemeldet; Daniels
Rückfrage lautete: „was ist mit den ganzen anderen base64, hast du alle
dekodiert und geprüft?" Die Antwort war nein. Ein Befund „nichts gefunden"
beantwortet nicht, **wonach** gesucht wurde — und kodierte Felder sind für eine
Textsuche unsichtbar.

### Eine Abfrage mit LIMIT beantwortet eine andere Frage als die gestellte

Am 26.08.2026 stand nach Daniels Disney-Durchgang die Frage, ob eine Meldung
angekommen ist. Der Briefkasten-Abruf `GET /pruefung?token=…` gab 497 Einträge
zurück, darunter keinen für „Undead Unluck" — also, so der Schluss, ist die
Meldung verlorengegangen.

Sie war da. Die Abfrage trägt `LIMIT 500`, und der Briefkasten hielt 563
Meldungen. Aufgefallen ist es erst, weil eine Testmeldung die Antwort
`{"ok":true,"offen":563}` zurückgab — die einzige Stelle, die die **ganze**
Zahl nennt.

Der Schaden ging über die falsche Auskunft hinaus: Beim Aufräumen der
Testmeldung traf der Löschbefehl `{url, nummern:[1]}` auch die echte Folge 1
derselben Serie. Zwei Einträge weg, einer davon Daniels Arbeit.

**Zum Zählen ist `?zaehlen=1` da**, nicht die Liste. Sie zählt über den ganzen
Bestand; die Liste ist zum Ansehen einzelner Einträge gedacht und deshalb
begrenzt.

**Und die Prüffrage gilt für jede Abfrage, die eine Zahl liefern soll:** *Kann
diese Antwort abgeschnitten sein?* Ein `LIMIT`, eine Seitengröße, ein
Standardwert von 100 — sie machen aus „so viele gibt es" ein „so viele habe ich
geholt", und die beiden sehen gleich aus.

### Disney+ sagt auf drei Arten Nein — und nur eine davon ist ein Befund

Am 26.08.2026 beim Durchgehen der Prüfliste dreimal aufgetreten, jedes Mal
anders zu bewerten:

| Was zu sehen ist | Was es heißt | Was zu tun ist |
|---|---|---|
| `/de-de/error?src=bap`, „Sorry, something went wrong" | **nichts** — kann auch eine Störung sein | zweiter Versuch |
| „Je nach Standort, Einstellungen für die Altersfreigabe oder Abodetails …" | unklar, drei mögliche Gründe | Suche entscheidet |
| die Suche im deutschen Katalog findet ihn nicht | der Titel wird hier nicht geführt | `available: false` |

**Die Fehlerseite ist der gefährlichste Fall**, weil sie am eindeutigsten
aussieht. „Bright Sun: Dark Shadows" landete dort, und derselbe Klick eine
Minute später führte auf die Seite (Daniel: „erneuter klick auf link in liste
führt korrekt zur seite"). Eine Meldung, die daraus entstanden war, musste aus
dem Briefkasten verworfen werden.

**Die Verfügbarkeitsmeldung nennt drei Gründe und sagt nicht, welcher gilt** —
Standort, Altersfreigabe oder Abo. Entschieden wird sie mit zwei Griffen: die
**Suche** im deutschen Katalog, und die **Altersfreigabe des Profils**. Bei
„Children of the Sea" war die Suche leer und die Freigabe stand auf 18, der
höchsten Stufe; damit blieb nur die Region übrig.

**Die Erweiterung meldet deshalb nichts davon von selbst.** Sie bietet auf einer
Fehlerseite einen zweiten Versuch an; „nichts da" bleibt ein Klick von Hand.

### Disney+ führt dieselbe Serie unter zwei Adressen

Unser Bestand hat 27 Verweise der Form `/browse/entity-<uuid>` und 19 der Form
`/series/<slug>/<id>`. **Die zweite leitet auf die erste um**: „Bright Sun: Dark
Shadows" steht bei uns als `/series/summer-time-rendering/3AHbeFV7Lqvn`, der
Klick landet auf `/browse/entity-ad803e91-…`. Dieselbe Serie, andere Kennung —
und die neue steht in keiner Liste.

Gelöst über den Klick: Wer aus der Prüfliste heraus öffnet, hinterlegt für zehn
Minuten, welcher Titel gemeint war. Kennt die Zielseite ihre Kennung nicht, erbt
sie ihn. Gemeldet wird trotzdem unter der Adresse aus unserem Bestand — die ist
es, nach der die Pipeline sucht.

Dieselbe Notiz trägt den Fehlerseiten-Fall, wo überhaupt keine Kennung mehr in
der Adresse steht.

## Ein Kinostart ist keine Sprachfassung — bei Anime fallen beide regelmäßig auseinander

Bei Serien zieht dieses Projekt die Trennlinie zwischen Synchro und Untertitel längst. Beim
**Kino** ist sie genauso nötig, und dort ist die Verwechslung verlockender: Wenn ein Film in
Deutschland ins Kino kommt, klingt „deutscher Kinostart" wie „läuft auf Deutsch".

Naheliegende Vermutung (Daniel, 25.08.2026): TMDB führe einen deutschen Kinostart ohnehin nur
dann, wenn es eine deutsche Fassung gibt — dann wäre die Trefferliste selbst schon der Beleg.

**Gemessen und widerlegt.** Drei Anime-Kinostarts ohne deutsche Synchronfassung stehen bei TMDB
mit deutschem Kinostart vom Typ 3 (regulär):

| TMDB | Film | DE-Start | Beleg |
|---|---|---|---|
| 1322752 | COLORFUL STAGE! The Movie | 05.04.2025 | „exklusiv als OmU, eine Synchronfassung ist nicht geplant" |
| 1397163 | Gundam GQuuuuuuX -Beginning- | 11.03.2025 | lief im Original mit Untertiteln |
| 1014505 | Overlord: The Sacred Kingdom | 16.03.2025 | OmU-Premiere am 20.09.2024 |

Ein `discover`-Lauf über März/April 2025 gibt **fünf** Treffer zurück — drei davon sind genau
diese Filme. Der Filter `region=DE` mit `with_release_type=2|3` sagt „hat einen deutschen
Kinostart", nicht „hat eine deutsche Fassung".

**Was daraus folgt:** `pipeline/fetch-tmdb-kino.ts` schreibt nach `data/tmdb-kino.json` und
damit in eine **Vorschlagsdatei**, die `build.ts` nie liest. Ein Kinostart wandert erst dann in
`data/curated/kino-2026.yaml`, wenn jemand die Fassung nachgesehen hat.

**Und die Fassung steht bei TMDB nirgends.** Über fünf Endpunkte geprüft — `release_dates`,
`translations`, `alternative_titles`, `watch/providers`, die Filmdaten selbst. Der Gegentest
entscheidet: „Chihiros Reise ins Zauberland" und „Your Name." haben beide eine deutsche
Synchronfassung und tragen trotzdem nur `spoken_languages: [ja]`. Das Feld meint die Sprache
**des Films**, nicht die verfügbaren Fassungen. Über 18 deutsche Termine in sechs Filmen ist
`iso_639_1` siebzehnmal leer; das eine `"de"` steht an einer TV-Ausstrahlung.

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

## Ein Lauf ergänzt und berichtigt — er löscht keine Metadaten

Daniel am 24.08.2026: „metadaten sollten nie gelöscht werden von läufen, die dürfen höchstens
datum anpassungen machen und verfügbarkeit von streaming/käufen … solche komplett löschungen
sollten nicht passieren."

Was ein Lauf ändern darf: **Termine**, **Verfügbarkeit** und **Sprachfassung** — also das, was
sich in der Wirklichkeit ändert. Was er nicht anfassen darf: Titel, Cover, Genres, Folgenzahl,
Studio, Jahr. Diese Angaben ändern sich nicht; wenn sie verschwinden, ist etwas kaputt.

**Der Anlass:** „Jaadugar: A Witch in Mongolia" zeigte im Detail-Panel „Zu diesem Eintrag
liegen keine Metadaten vor", obwohl es Stunden vorher funktioniert hatte. Der Termin stand in
`events.json` und `releases.json`, der Titel fehlte in `titles.json` — das Release trug
`titleId: -1`.

Die Ursache lag außerhalb: AniList war abgeschaltet („The AniList API has been temporarily
disabled due to severe stability issues"). Die Titelsuche für Crunchyroll-Kalendereinträge
fragte dort nach — und ging leer aus.

**Die Metadaten lagen die ganze Zeit im Haus.** `data/cache/anilist-katalog.json` führt rund
3.000 Titel mit Namen, Format, Jahr, Genres und Cover, darunter diesen. Nur nachgesehen hat
dort niemand. Seit dem 24.08.2026 ist der Katalog die letzte Stufe der Titelsuche
(`titelAusKatalog()` in `build.ts`) — das repariert nicht nur den Ausfall, es spart im
Normalbetrieb eine Abfrage je neuem Titel.

**Zwei Regeln daraus:**

1. **Ein Ausfall einer Fremdquelle darf keinen Lauf beenden, solange der Cache trägt.**
   `fetch.ts` unterscheidet seit dem 24.08.2026 zwischen einer kaputten Abfrage (muss
   auffallen) und einer abgeschalteten Quelle (der Lauf macht weiter und sagt es am Ende).
   Der stündliche Lauf brach sonst mitsamt den Crunchyroll-Sendezeiten ab, die von AniList gar
   nicht abhängen.
2. **Was einmal im Bestand war, wird nicht stillschweigend weniger.** Ein Titel ohne Metadaten
   ist im Kalender ein halber Eintrag — sichtbar, anklickbar, leer.

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
   gerade geholt wurde. Die Prüfung in `tools/check-workflows.mjs` fängt das ab — **seit dem
   24.08.2026 auch wirklich.** Bis dahin las sie nur `.ts`-Dateien und suchte nur nach
   `writeJson('data/…')`; vier Dateien fielen durch beide Maschen und gingen in **jedem**
   CI-Lauf verloren: `youtube-befunde.json`, `rtlplus-befunde.json`, `motn-changes.json`,
   `curated/disc-anisearch.yaml`. Sichtbar war es nur am Commit-Datum — alle vier zuletzt
   durch einen lokalen Lauf beschrieben, obwohl zwei davon täglich bzw. wöchentlich geholt
   werden. Jetzt zählt **jedes** `data/…`-Literal in einer Datei, die überhaupt schreibt. Das
   meldet auch reine Lesepfade mit, und das ist die richtige Seite zum Irren: Eine Datei zu
   viel in der Liste wird beiseitegelegt und unverändert zurückgelegt; eine zu wenig kostet
   die Arbeit jedes Laufs, und zwar still.
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

## Eine Prüfung, die rot wird, weil die Arbeit erledigt ist, misst das Falsche

Am 25.08.2026 um 05:07 hat der nächtliche Lauf die letzten Amazon-Meldungen übernommen.
`extension/offene-amazon.js` fiel damit auf **null** Einträge — genau das Ziel, auf das
wochenlang hingearbeitet wurde. Die Zusicherungen der Prime-Übersicht lasen diese Datei und
arbeiteten mit ihrem ersten Eintrag; vier von ihnen wurden rot, **der Deploy blieb drei Läufe
lang hängen, und die Seite wurde nicht mehr ausgeliefert**.

Die Erweiterung selbst kam mit der leeren Liste einwandfrei zurecht — der Knopf schrieb
„Prime: alles geprüft". Nur die Prüfung hielt das für einen Fehler.

**Testdaten gehören in den Test, nicht in den Datenbestand.** Eine Zusicherung prüft die
Logik; wer sie an echte Daten hängt, prüft den Datenstand mit — und der ändert sich täglich
durch die Läufe. Was heute grün ist, ist morgen rot, ohne dass jemand eine Zeile Code
angefasst hat.

**Dieselbe Falle hatte einen Tag vorher schon zugeschlagen, eine Ebene tiefer.** Am 24.08.2026
fiel eine fest verdrahtete Kennung aus der Liste, weil Daniel sie gemeldet hatte. Die Antwort
damals war `Object.keys(ECHTE_LISTE)[0]` — dieselbe Abhängigkeit, nur beweglicher. Sie hat
genau einen Tag gehalten.

Die Prüffrage vor jeder Zusicherung, die eine Datei aus `data/` oder `extension/offene-*.js`
liest: **Was passiert mit dieser Prüfung, wenn die Datei leer ist?** Ist die Antwort „sie wird
rot", gehört sie umgebaut — denn leer ist bei einer Arbeitsliste der Normalfall am Ende.

Was an echten Daten trotzdem zusicherbar ist, und deshalb dort steht: dass die Datei sich
laden lässt, und dass der leere Fall sauber durchläuft.

## Ein geklärter roter Lauf wird entfernt

Daniel am 24.08.2026: „du hast die läufe im status geprüft, warum sind die immer noch sichtbar.
wenn die geprüft wurden, können die dort entfernt werden, sonst bekomme ich einen falschen
eindruck."

Die Liste der Läufe ist eine **Statusanzeige**, kein Archiv. Steht dort ein rotes Kreuz, heißt
das „hier ist etwas zu tun" — und wenn nichts mehr zu tun ist, lügt es.

Also: Sobald ein roter Lauf **geprüft und die Ursache behoben oder festgehalten** ist, wird er
gelöscht:

```bash
gh run delete <id> --repo danielzaiser91/anime-kalender-de
```

**Erst prüfen, dann löschen — nie umgekehrt.** Was in dem Lauf stand, ist danach weg; die
Erkenntnis daraus muss vorher woanders stehen, in einem Commit, in `status.md` oder hier. Am
24.08.2026 waren es drei: ein AniList-Ausfall, ein Typfehler von mir und ein abgebrochener
Seitenaufruf bei Crunchyroll. Alle drei sind behoben und beschrieben; die Läufe selbst brauchte
niemand mehr.

**Und das GitHub-Löschen ist nur die Hälfte.** Daniels Laufstatus-App liest den Worker, nicht
GitHub — dort bleibt ein Lauf mit `zustand: 'fehler'` stehen, bis ihn jemand ausdrücklich
abnimmt. Das ist so gebaut und richtig so: Ein roter Lauf, der von selbst verschwindet, ist
schlimmer als keine Anzeige. Nur muss die Abnahme dann auch passieren.

```bash
curl -X POST https://newsletter.animekalender.workers.dev/lauf \
  -H "Content-Type: application/json" -H "X-Lauf-Token: <LAUF_TOKEN>" \
  -d '{"lauf_id":"<id>","zustand":"erledigt","notiz":"<warum geklärt>"}'
```

Am 25.08.2026 standen dort **elf** rote Läufe, der älteste 13 Stunden alt — alle längst
behoben, jeder mit Commit. Daniel: „räum die status app auf, warum so viele rote läufe, gab es
kein erfolgreichen deploy?" Es gab einen, zwanzig Minuten vorher; er war nur nicht zu sehen.

**Die Regel gehört an den Fix, nicht an eine Aufräumrunde:** Wer einen roten Lauf behebt,
nimmt ihn im selben Zug ab. Sonst sammelt sich eine Anzeige, die etwas anderes sagt als der
Zustand — und dann ist sie wertlos, obwohl jede einzelne Zeile einmal stimmte.
**Und weil ein Vorsatz das zweimal nicht getragen hat, gibt es jetzt ein Werkzeug.** Am
25.08.2026 musste Daniel dieselbe Aufräumung **zweimal an einem Tag** anmahnen — vormittags
elf rote Läufe, nachmittags zehn: „räum die status app auf, furchtbar diese ganzen roten läufe
die ich da sehe." Danach die Verschärfung: „räum immer auf, wenn du bereits drüber geschaut
hast."

```
LAUF_TOKEN=… node tools/laeufe-aufraeumen.mjs [--auch-github]
```

Es liest die roten Läufe aus der App und nimmt genau die ab, die **überholt** sind — also die,
deren Workflow danach erfolgreich durchgelaufen ist. Das ist gemessen, nicht angenommen: Ein
roter Lauf ohne grünen Nachfolger bleibt stehen, denn der ist ein offenes Problem. `--trocken`
zeigt nur, was geschähe.

**Die Prüffrage gehört an das Ende jeder Antwort, die einen Lauf betraf:** *Steht in der App
noch etwas Rotes, das ich längst geklärt habe?* Ein Vorsatz, der bei jedem einzelnen Fix neu
eingehalten werden muss, wird übersehen — ein Aufruf nicht.


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
npm run data:validate && npm run check:logic && npm run typecheck && npm run check:worker && npm run check:hooks && npm run check:extension && npm run check:zugangsart && npm run build
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

### Prime teilt eine Staffel in Bände — die Folgenzahl gilt dann für beide

Daniel am 25.08.2026 an „Yu-Gi-Oh! ZEXAL" Staffel 3 (`B0FHGJ7KS1`), mit Bild: „extension
erwartet 96, ausklappbar sind nur 48, weil prime es in 2 volumes gesplittet hat."

Die Staffelliste im Hydration-Block sagt es selbst — und mischt dabei zwei Schreibweisen in
**einer** Liste:

```
B0CB8SGJCZ  Staffel 1, Band 2      sequenceNumber 1
B0GTJV4S7L  Season 1, Volume 2     sequenceNumber 1
B0GV8N71SL  Season 2, Volume 2     sequenceNumber 2   ← gewählt
B0FHGJ7KS1  Season 3, Volume 2     sequenceNumber 3
```

`metadata.episodeCount` nennt dazu „96 Folgen" — die Zahl der **ganzen Staffel 3**. Von dieser
Seite aus erreichbar sind vier Abschnitte (1–8, 9–16, 17–25, 25–48), zusammen 49 Einträge. Der
Knopf wartete auf 96 und stand für immer auf „lädt nach".

**Vollständig ist deshalb, wenn kein Abschnitt mehr aussteht — nicht, wenn eine Zahl erreicht
ist.** Der Mitleser kennt jedes Token, das die Seite genannt hat, und weiß, welche er geholt
hat; er meldet beides als `abschnitte: { gesamt, offen }`. `istVollstaendig()` in `amazon.js`
entscheidet daran und fällt nur dann auf den Zahlenvergleich zurück, wenn die Seite gar keine
Abschnitte nennt (Film, kurze Staffel).

**Ein Textmuster auf „Volume" wäre der falsche Weg gewesen**, und die Liste oben zeigt warum:
Dieselbe Serie führt „Band" und „Volume" nebeneinander, und `sequenceNumber` ist bei beiden
Bänden derselbe. Die Frage „steht noch etwas aus?" beantwortet die Sache direkt, ohne über die
Beschriftung zu raten.

**Und `sequenceNumber` ist dort ein Sortierschlüssel, keine Staffelnummer.** Dieselbe Liste,
vollständig:

```
B0CB8SGJCZ  seq 1    Staffel 1, Band 2
B0GTJV4S7L  seq 1    Season 1, Volume 2
B0GV8N71SL  seq 2    Season 2, Volume 2   ← gewählt
B0FHGJ7KS1  seq 3    Season 3, Volume 2
B01EKI0P2U  seq 101  Season 1, Volume 1
B01EKI0SQ8  seq 201  Season 2, Volume 1
```

Daniel dazu: „yu gi oh zexal has weird seasons." Sechs Einträge für drei Staffeln, zwei
Schreibweisen nebeneinander, Band 2 vor Band 1 — und die beiden Bände 1 tragen 101 und 201.

**Die Adresse trägt genau diese Zahl** (`?ref_=atv_dp_season_select_s101`). Solange
`staffelAusAdresse()` vorn stand, hätte ein Klick auf „Season 1, Volume 1" also **Staffel 101**
gemeldet. `headerDetail.seasonNumber` sagt dagegen sauber 1 — geprüft am gewählten Band, wo es
2 sagt und die Adresse `s2` trägt.

Seit 2.8 gilt deshalb: **`seasonNumber` aus dem Hydration-Block schlägt die Adresse**, und eine
Adresszahl über 50 wird verworfen statt gemeldet. Dazu geht der **Bandname** als eigenes Feld
mit (`band: "Season 2, Volume 2"`) — ohne ihn sähen zwei Meldungen zu „Staffel 2" wie ein
Widerspruch aus, obwohl sie verschiedene Folgen meinen.

### Prime schneidet Reihen anders zu — die Folgenzahl ist deshalb kein Urteil

Am 28.08.2026 hat Daniel dieselbe Sperre dreimal gemeldet, und die ersten beiden
Fälle widerlegen einander:

| Titel | Seite | erwartet | was wirklich vorliegt |
|---|---|---|---|
| Captain Tsubasa (2018) | 91 | 52 | Prime **bündelt** beide Staffeln unter einer Seite |
| Chibi Maruko-chan | 52 | 142 | Prime **teilt**, wo unser Bestand eine Reihe führt |
| Blood-C: The Last Dark | Film | 1 | ein Film, den die Erkennung nicht als solchen sah |

Der Knopf sagte zweimal „andere Staffel wählen" — und beide Male gab es keine
Staffel zu wählen, die die erwartete Zahl zeigt. Ein Vergleich mit der erwarteten
Folgenzahl beantwortet also **keine** Frage, die auf dieser Seite entscheidbar
wäre: Prime schneidet die Welt anders zu als AniList, mal zusammen, mal
auseinander, und beides ist der Normalfall.

**Der Riegel hielt genau die Daten zurück, die den Fall auflösen.** Seit 3.77
trägt jede Meldung ihre Folgen einzeln mit Nummer, Titel, Datum und Laufzeit;
`pipeline/fetch-rohfolgen.ts` legt sie über TMDBs Folgentitel und
Erstausstrahlungsdaten auf unsere Zählung. Die Zuordnung passiert dort, wo die
Anker liegen — nicht im Browser, wo keiner liegt.

Seit 3.78 gilt deshalb: **Die Zahl erzeugt einen Hinweis, keine Sperre.** Bei
Bündelung stehen **beide** Fenster als Knopf bereit (vorderes und hinteres), denn
welcher Teil gemeint ist, weiß nur der Auftrag: Bei „Captain Tsubasa (2018)" sind
es die ersten 52, beim „Junior Youth Arc" die letzten 39 — dieselbe Seite, zwei
richtige Antworten. Die echten Riegel bleiben: `falscheStaffel` vergleicht die
Staffel im Titel mit der offenen, `quelltextPasst()` fängt den Titelwechsel.
Beides prüft die Sache, nicht ein Zahlenverhältnis.

**Und „1 Folge laut Seite" schließt einen Film nicht aus — es beschreibt ihn.**
`istFilmSeite()` verlangte `!lage.folgenLautSeite`, also gar keine Zahl.
„Blood-C: The Last Dark" nennt eine, galt damit als Serie, und der Knopf wartete
42 Sekunden auf eine Folgenliste, die es nicht gibt. Entscheidend sind die beiden
anderen Merkmale: **kein Folgen-Reiter** und **eine Laufzeit im Kopf**.

**Warum es durch 236 grüne Zusicherungen kam:** keine einzige prüfte die
Folgenzahl gegen die Erwartung. `extension/amazon-folgenzahl.test.cjs` tut es
jetzt und führt `istFilmSeite()` dabei wirklich aus, mit den Werten wörtlich aus
Daniels Bericht.

### Ein Film braucht den Mitleser nicht — die Tonspuren stehen im DOM

Am 28.08.2026 blieben zwei Filme dauerhaft hängen: „Blood-C: The Last Dark" auf
„Tonspuren nicht gefunden — Seite neu laden", „Have A Nice Day" auf „Folgen
werden geladen …". Neu laden half nicht, und das war der Hinweis: Der Quelltext
war nie das Problem.

**Zwei Ursachen, beide gemessen.** Die erste steht im Ablauf: Der Film-Zweig in
`zeichnen()` verlangte `quelltextVeraltet()`, die beiden folgenden Zweige waren
durch `!istFilmSeite()` gesperrt. Für einen Film mit **frischem** Quelltext gab
es damit gar keinen Zweig — der Ablauf fiel bis zum Warte-Zweig durch und blieb
dort stehen.

Die zweite steht in den Daten. Anonym von amazon.de geholt (die Seiten sind ohne
Anmeldung lesbar):

| Titel | Adresse | pageTitleId | audioTracks |
|---|---|---|---|
| Blood-C: The Last Dark | B0GQJFL1XG | **B0GQJ8WYJD** | Deutsch, 日本語 |
| Have A Nice Day | B0FYSH898T | **B0FWK8XMDJ** | Deutsch |
| Avatar Aang (geht) | B0H6QYBZFS | B0H6QYBZFS | Deutsch, English |

Der Block ist vollständig, `entityType` sagt „Movie", die Tonspuren stehen im
Klartext — und trotzdem kam am Knopf nichts an. Der Zählstand im Bericht zeigt
warum: **`gesamt: 1` bei `fuerAdresse: null`**. Diese Eins stammt aus dem
Seitengerüst (die Stelle, die sie setzt, solange keine Antwort da ist), nicht vom
Mitleser. Der hat für diese Seiten nie geliefert.

**Statt die Nachrichtenkette zu reparieren, entfällt sie für Filme.** Mitleser
und Erweiterung teilen sich das DOM; das `<script>` mit dem Block ist für beide
dasselbe Element. Bei einem Film ist ohnehin nichts nachzuladen — keine
Abschnitte, keine Folgenliste, ein einziger Satz Tonspuren. Der Umweg über eine
Nachricht hat dort nie etwas hinzugefügt, nur eine Fehlerquelle. `filmAusSeite()`
liest den Block direkt, einmal je Adresse zwischengespeichert (er ist 145 bis
204 KB groß — ihn je Takt zu parsen wäre genau die Arbeit, die am selben Tag
schon einmal die Seite lahmgelegt hat).

**Die abweichende `pageTitleId` ist dabei kein Titelwechsel.** Prime führt einen
Film regelmäßig unter einer anderen Kennung als die Adresse — dasselbe Bild wie
bei Digimon Tamers weiter oben. Die Adress-Kennung kommt im Quelltext trotzdem
vor (11×), der Zugehörigkeits-Wächter greift also zu Recht nicht.

### Ein Reihenname mitten im Titel trennt, was zusammengehört

„Arpeggio of Blue Steel - Cadenza" ergibt bei Prime genau eine Karte, und die
heißt „Arpeggio of Blue Steel — **Ars Nova** — Cadenza" (Daniel, 28.08.2026).
Derselbe Film mit dem Reihennamen dazwischen; unser japanischer Titel führt ihn
sogar mit, nur der deutsche lässt ihn weg.

**Ein Zusatz am Rand war längst abgedeckt, einer in der Mitte nicht.**
`ohneBeiwerk` schneidet Klammern und Fassungsangaben ab, der Rückfall über
`includes` fängt Präfixe — beide arbeiten auf der Zeichenkette, und die ist an
dieser Stelle aufgetrennt. `wortFolgePasst()` vergleicht deshalb wortweise: Alle
Wörter des Auftrags müssen in der Karte vorkommen, in derselben Reihenfolge,
dazwischen darf stehen, was will.

**Drei Riegel halten das eng**, und jeder hat seinen belegten Fall:

| Riegel | sonst passierte |
|---|---|
| höchstens zwei fremde Wörter | „Sword Art Online" träfe „Alicization War of Underworld" |
| kein Fortsetzungswort (`final`, `movie`, `chapter`, …) | „Attack on Titan" träfe „Attack on Titan: Final Season" |
| **keine reine Zahl** | „Captain Tsubasa" träfe „Captain Tsubasa (1983)" |

Der letzte Riegel ist nicht ausgedacht: Die Zusicherung dazu stand schon seit
dem 27.08.2026 und wurde beim Bau dieser Regel sofort rot. 1983 hat 128 Folgen,
2018 hat 52 — eine Jahreszahl ist nie Beiwerk. `staffelImTitel()` hätte keinen
der drei Fälle gefangen, weil keiner eine nummerierte Staffel nennt.

### Abgehaktes muss einzeln zurückzuholen sein

Am 28.08.2026 brauchte Daniel zwei erledigte Einträge zurück, um eine Messung
nachliefern zu können. Der einzige vorhandene Weg war „Abhaken zurücksetzen" in
der Übersicht — der leert den **ganzen** Speicher, an dem Tag sechzig Einträge.
Zwei zurückholen hätte achtundfünfzig Wiederholungen gekostet.

    document.dispatchEvent(new CustomEvent('ak-oeffnen', { detail: 'digimon' }))

Verglichen wird gegen Titel und Serienname. Der Weg über ein Ereignis am
`document` ist derselbe wie beim Diagnosebericht, und aus demselben Grund: Der
Speicher liegt in `chrome.storage`, an das die Seiten-Konsole nicht herankommt.

**Die allgemeine Lehre:** Eine Sammelaktion ersetzt keine einzelne. Wo etwas
abgehakt, ausgeblendet oder erledigt werden kann, muss dasselbe einzeln
rückgängig zu machen sein — sonst steht am Ende die Wahl zwischen „gar nicht"
und „alles noch einmal".

### Prime zählt Teile, wo unser Bestand keinen Teil kennt

„Code Geass: Akito the Exiled — The Wyvern Arrives": Die Karte auf Platz 1 der
Trefferliste war der richtige Titel, der Kasten sagte „2 Treffer gelesen, keiner
passt" (Daniel, 28.08.2026).

    Auftrag  codegeassakitotheexiled thewyvernarrives
    Karte    codegeassakitotheexiled1thewyvernarrivesova

Zwei Abweichungen, beide von Prime hinzugefügt: die **Teilnummer** mitten im
Titel und das **Typ-Kürzel** am Ende. `titelKern()` streicht „Teil 1" und „Part
1", eine nackte Ziffer war nie vorgesehen — und weil sie in der Mitte steht,
greift auch der Rückfall über `includes` nicht.

`titelKernLocker()` ist deshalb eine **zusätzliche** Schreibweise, kein Ersatz:
Verglichen wird weiterhin zuerst streng, Typ- und Staffelprüfung gelten
unverändert. Beide Regeln sind eng gefasst, und das muss so bleiben — die Ziffer
fällt nur **einstellig** und nur als eigenes Wort („Mob Psycho 100" behält seine
Zahl, „Golden Kamuy 2" auch, wo sie die Staffel ist), das Kürzel nur **am Ende**
(mittendrin trennt es Ausgaben, siehe „Wolf's Rain OVA" gegen die Serie). Alle
drei Gegenproben stehen als Zusicherung.

### Netflix gibt die Tonspuren nur mit dem Player heraus — dreifach gemessen

Am 22.08.2026 stand fest, dass die **Titelseite** im Ruhezustand nichts hergibt. Offen blieb,
ob die **Folgenliste** mehr weiß — Daniel am 26.08.2026: „wir sollten da nochmal untersuchen ob
wir bessere metadaten haben, und evtl die infos bereits in overview hab, sonst muss ich
schlimmstenfalls alle ep einzeln durchklicken, bei über 1000 ist das zu viel."

Er hat den Aufruf mitgeschnitten, mit dem Netflix die Folgenliste holt:

```
POST https://web.prod.cloud.netflix.com/graphql
operationName  PreviewModalEpisodeSelectorSeasonEpisodes
variables      { seasonId: 82756676, count: 30 }
persistedQuery { id: "4cf0a279-dd32-454d-9758-486359c0d48b", version: 102 }
```

**204 Feldpfade, kein einziger mit Sprache, Tonspur oder Untertitel.** Was die Antwort führt:
Nummer, Titel, Laufzeit, Beschreibung, Bild, `isAvailable`, `isPlayable` — und je Folge eine
eigene `videoId` (Folge 1156 → `82756678`).

Drei Wege danach gegeneinander gemessen, alle in Daniels angemeldeter Sitzung:

| Weg | Ergebnis |
|---|---|
| `shakti/metadata?movieid=<videoId>` | **HTTP 404, Antwortkörper „BLOCKED"** |
| dieselbe GraphQL-Operation, Folge einzeln | HTTP 200, 3.763 Zeichen, **0 Sprachfelder** |
| Seitenzustand (`falcorCache`, `models.graphql`) | 2 Treffer, beide die **Profilsprache** |

Damit ist es keine Vermutung mehr: **Für Netflix gibt es keinen lesenden Weg zu den Tonspuren
je Folge.** Es bleibt das Player-Manifest, und das setzt eine Wiedergabe-Sitzung samt
DRM-Lizenz voraus — ein Klick je Folge.

**Was der Mitschnitt trotzdem wert ist:** Die `videoId` je Folge steht jetzt fest und ist ohne
Klicken zu haben. Sollte je ein Manifest-Weg in Frage kommen, fehlt daran nichts mehr als die
Entscheidung, ob wir ihn gehen wollen.

**Und die Folge für den Kalender:** Bei einer Reihe wie One Piece (1.175 Folgen) beantwortet
**ADN** die Frage nach der Synchro (`vde` je Folge, im Datensatz: 1–516 deutsch, ab 780 nicht).
Netflix ist dann nur noch ein zweiter Ort für dieselben Folgen — und ob er sie führt, ist eine
andere Frage als die, die dieses Projekt stellt.

**Und der Player-Weg ist verschlüsselt — damit ist die Frage abschließend beantwortet.** Daniel
hat am 26.08.2026 den ganzen Verkehr eines Folgenklicks mitgeschnitten: 208 Aufrufe, davon 190
Videosegmente von `nflxvideo.net` und **ein** Manifest.

```
POST /msl/playapi/cadmium/licensedmanifest/1?mainContentViewableId=82756678
     HTTP 200, 110.824 Zeichen
     {"headerdata":"eyJjaXBoZXJ0ZXh0IjoiRXhIaDcxbnhBcGYwcW84…
```

`/msl/` ist Netflix' **Message Security Layer**: Die Nutzlast ist Chiffrat, der Klartext
entsteht erst im Player-JS. Die Aussage weiter oben, das Manifest trage `audioTracks`, gilt
also für den **entschlüsselten Zustand im Browser** — nicht für etwas, das sich abrufen ließe.

Damit steht der vollständige Befund:

| Weg | Ergebnis |
|---|---|
| Folgenliste (`PreviewModalEpisodeSelectorSeasonEpisodes`) | 204 Felder, keine Sprache |
| `shakti/metadata?movieid=…` | HTTP 404, Antwortkörper „BLOCKED" |
| Seitenzustand (`falcorCache`, `models.graphql`) | nur die Profilsprache |
| Player-Manifest über die Leitung | **MSL-verschlüsselt** |

**Für Netflix bleibt es bei einem Klick je Folge** — genau der Weg, den die Erweiterung geht.
Eine Reihe wie One Piece ist damit nicht abzudecken, und das muss sie auch nicht sein: Die
Frage „gibt es diese Folge auf Deutsch" beantwortet ADN (`vde` je Folge), und Netflix wäre nur
ein zweiter Ort für dieselben Folgen.

Wer diesen Weg noch einmal aufmacht, sollte einen neuen Anlass haben — hier ist er viermal
zugegangen.

**Fünfter Versuch, fünfte Absage: Die Player-API kennt keinen Weg ohne Wiedergabe.** Daniel am
26.08.2026: „welche interne funktion ruft netflix auf die das auslöst?" Die Bestandsaufnahme
zeigt 94 Methoden in `getAPI()` und 66 in `videoPlayer` — **alle** arbeiten auf einer
bestehenden Sitzung (`…BySessionId`). Es gibt kein `openPlaybackSession`, kein
`prefetchManifest`.

Die einzige Ausnahme nimmt eine Kennung statt einer Sitzung: `getVideoMetadataByVideoId`. An
drei Folgen von One Piece geprüft, mit der laufenden als Kontrolle:

| Folge | Kennung | Antwort |
|---|---|---|
| 1156, läuft gerade | `82756678` | Objekt — Felder `_metadataObject`, `_video`, `_seasons` |
| 1157, nie geöffnet | `82756679` | **`undefined`** |
| 1158, nie geöffnet | `82756680` | **`undefined`** |

Zweimal widerlegt also: Die Funktion liest nur den Zwischenspeicher der **laufenden** Sitzung,
und selbst dort steht keine Tonspur. Was der Filter als 41 Treffer meldete, waren `trackIds`
und `trackingInfo` — Verfolgungsmarken für Empfehlungen.

**Die Gegenprobe war der ganze Wert der Messung.** Nur die laufende Folge abzufragen hätte ein
Objekt geliefert, das aussieht wie eine Lösung. Wer einen Zwischenspeicher misst, misst seine
eigene Vorarbeit.

**Und ein Wort zum Suchmuster:** `/track/i` fängt `trackId`, `trackingInfo`, `soundtrack`.
Beim nächsten Mal enger fassen — `audioTrack`, `bcp47`, `audio_locale` — sonst ertrinkt der
echte Fund in Fehlalarmen.

**Nebenbefund, direkt verwertbar:** One Piece Folge 1156 hat auf Netflix genau eine Tonspur,
`ja / Japanisch [Original]`. Daniels Meldung war richtig.

### Und doch ein Weg: der Player liest je Folge, wenn man ihm die Videodaten abdreht

Fünf Wege waren zu, und der sechste kam von Daniel (26.08.2026): „was wenn du ein skript
machst von overview, das im player das lädt, und player pausiert, keine playback, nur daten
reinladen?"

Der Gedanke trägt, weil **die Tonspurliste vor den Videodaten da ist**. Gemessen in vier
Anläufen an One Piece:

| Vorgehen | Zeit je Folge | Videodaten |
|---|---|---|
| `pause()` nach dem Lesen | — | 129 Segmente / 42 MB in fünf Sekunden |
| zurück zur Titelseite | 7,6 s | 83–100 Segmente, ~8 MB |
| **Segmentabrufe abweisen, sobald die Liste steht** | **3,1 s** | **0 bis 8 Segmente** |

Weder Anhalten noch Verlassen stoppt das Vorausladen — der Player füllt seinen Puffer weiter.
Was greift, ist, ihm die Segmente gar nicht erst zu geben: Jeder Abruf an `nflxvideo.net` wird
abgewiesen, sobald `getAudioTrackList()` etwas liefert. Der Player bricht dann ab, und genau
das ist gewollt. **Für Netflix bedeutet das weniger Last, nicht mehr.**

**Die Gegenprobe entscheidet, und sie hält.** Drei Folgen des Elbaph Arc (1160–1162) melden
`ja` — plausibel, ADN führt One Piece nur bis 516 auf Deutsch. Das allein beweist nichts: Ein
Auslesen, das stumpf die erste Tonspur zurückgibt, sähe genauso aus. Eine Folge aus **East
Blue** (`80107105`) meldet dagegen:

```
de, ja, it, fr, es-ES, en, ar      0 Segmente geladen
```

Deutsch dabei, im belegten Bereich, bei null Videodaten. Das Auslesen unterscheidet wirklich.

**Was noch fehlt: die Kennungen.** Der Abruf der Folgenliste ließ sich zweimal nicht abfangen —
Netflix holt sie einmal und bedient sich danach aus seinem Zwischenspeicher. Im gerenderten
Dialog steht nur **eine** Kennung, die des „Fortsetzen"-Verweises. Ohne eine Liste aller
`videoId`s gibt es keinen Durchlauf, und geraten wird sie nicht: Im Elbaph-Mitschnitt lagen sie
fortlaufend beieinander (82756678, 82756679, 82756680), aber aus drei Zahlen wird keine Regel.

**Kosten, hochgerechnet:** 3,1 s je Folge, nahezu keine Datenmenge. 1.175 Folgen wären rund
eine Stunde. Jede Folge bleibt aber eine echte Wiedergabe-Sitzung mit Lizenzabruf und landet in
„Weiter ansehen" — das ist Daniels Entscheidung, nicht meine.

**Und ein Testblock hinter `process.exit` läuft nie — dritter Fall an einem Tag.** Beim
Anhängen von Zusicherungen ist mir dasselbe jetzt dreimal passiert: Der Ergebnis-Block einer
Testdatei steht am Ende, und was man dahinter hängt, wird nie ausgeführt. Zweimal fiel es auf,
weil die neuen Zeilen fehlten; einmal wäre es fast durchgegangen, weil die Datei trotzdem grün
meldete.

**Prüffrage nach jedem Anhängen an eine Testdatei:** *Steht mein Block vor dem Abschluss — und
sind meine Zusicherungen in der Ausgabe wirklich zu sehen?* Eine Zusicherung, die man nicht in
der Ausgabe zählen kann, hat nicht stattgefunden.

Dazu gehört der zweite Teil desselben Fehlgriffs: Jede Testdatei in diesem Repo hat ihre eigene
Bauweise. `mitlesen.test.cjs` prüfte über ein Ergebnis-Objekt und kannte kein `pruefe`; der
angehängte Block rief es trotzdem auf. Vor dem Anhängen wird gelesen, wie die Datei prüft.

### Ein Durchlauf braucht einen sichtbaren Notausgang — und zwei Riegel, nicht einen

Der erste Durchlauf über One Piece hat am 26.08.2026 fremde Serien geöffnet: Heroes, Lucifer,
Ozark. **42 falsche Meldungen** gingen an den Worker, alle unter der Adresse von One Piece.
Daniel: „es öffnen sich andere serien als one piece (keine anime, ganz andere serien)."

Die Ursache war eine zu breite Suche. Nachdem der feste Pfad `data.videos.episodes.edges`
nicht griff, nahm die neue Fassung **jeden** Knoten mit einer Nummer und einer Kennung über
einer Million — und die hat jeder Netflix-Titel. Damit fielen die Empfehlungsleisten und
„Weiter ansehen" mit hinein.

**Der eigentliche Fehler war aber der fehlende Notausgang.** Daniels nächste Nachricht:
„welchen knopf soll ich sofort anklicken? ich schließe mal den tab." Der Abbrechen-Knopf saß
nur auf der Titelseite — und ein Durchlauf ist die meiste Zeit im Player. Es gab keinen Weg,
ihn anzuhalten.

Daraus drei Regeln für alles, was in Serie läuft:

1. **Der Abbruch ist sichtbar, wo die Arbeit stattfindet.** Der Knopf bleibt jetzt während des
   Durchlaufs stehen, auch im Player, und die Escape-Taste bricht ebenfalls ab — ein Knopf kann
   von fremder Oberfläche verdeckt werden, eine Taste nicht.
2. **Ein Riegel genügt nicht.** Die Typ-Prüfung im Leser (`__typename` muss „Episode" nennen)
   ist der erste. Der zweite sitzt vor jeder Meldung: Der Player nennt die Reihe der laufenden
   Folge; weicht sie von der Seite ab, wird übersprungen und nichts gemeldet.
3. **Und was falsch ankam, wird sofort verworfen**, bevor der nächste Lauf es übernimmt:

   ```
   curl -s "https://newsletter.animekalender.workers.dev/pruefung?token=<LAUF_TOKEN>"
   curl -X POST …/pruefung -H "X-Lauf-Token: <TOKEN>" -d '{"uebernommen":[<ids>]}'
   ```

   Abhaken ohne Übernahme ist der richtige Griff: Die Meldung verschwindet aus dem Briefkasten,
   ohne den Datensatz zu berühren.

**Was das über die Reihenfolge sagt:** Ein Durchlauf über tausend Folgen wird nicht an tausend
Folgen erprobt, sondern an fünf. Der Knopf hätte eine Obergrenze gebraucht, bevor er das erste
Mal lief — dieselbe Lehre wie bei der Amazon-Erweiterung, nur teurer, weil hier Meldungen
entstanden statt nur falscher Zahlen.

**Und eine Sekunde ESLint fängt, was 236 Zusicherungen nicht sehen.** Beim Umbau des Dialogs
auf Bereiche fiel die Variable `empfohlen` weg; eine spätere Zeile nutzte sie weiter. Der
Dialog ließ sich danach nicht mehr öffnen (Daniel, 26.08.2026: „anime kalender click not
working and i see an error"), und **keine einzige Prüfung hat es bemerkt** — sie prüfen die
Daten, nicht das DOM.

Ein Sandkasten für den ganzen Dialog wäre der gründliche Weg und kostet einen Tag.
`extension/eslint.config.mjs` prüft stattdessen nur `no-undef` — kein Stil, keine Meinung — und
hängt seit dem 26.08.2026 in `check:extension`. Was dort rot wird, ist ein Absturz im Browser.

Dieselbe Klasse Fehler ist mir an diesem Tag **dreimal** unterlaufen: `empfohlen` im Dialog,
`location` im Test-Sandkasten, `MARKE_FOLGEN` im ausgeschnittenen Block. Alle drei hätte diese
Prüfung genannt.
