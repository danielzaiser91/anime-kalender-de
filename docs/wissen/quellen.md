# Datenquellen und ihre Grenzen

Ausgelagert aus `CLAUDE.md` am 18.09.2026, wortgleich. **Wann lesen:** Vor jeder Arbeit an einem Abruf (`pipeline/fetch-*`, `scrape-*`), an Sprachurteilen, Belegen, Zuordnungen und Terminen — und bevor eine Quelle als untauglich oder als Beleg gilt.

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

  **Ein Paket, das 24 Stunden lebt, und ein Lauf, der wöchentlich kommt — das geht
  rechnerisch nicht auf.** Gemessen am 06.09.2026: Das Secret trug den Stand vom
  **29.08., 17:04**, war also seit dem 30.08. tot; `crunchyroll-dub` hat zuletzt am
  **31.08.** etwas geschrieben. Acht Tage lang lief der Lauf gegen ein abgelaufenes
  Paket, und **niemandem ist es aufgefallen** — die Frist in `check-sources.ts` steht
  auf neun Tagen (Taktung plus zwei), war also bis zuletzt grün.

  Der Alarm ist damit richtig gebaut und trotzdem stumpf: Er misst, wann die Quelle
  zuletzt **geschrieben** hat, nicht ob sie überhaupt arbeiten **kann**. Wer den
  Rückstand aufholen will, erneuert das Paket kurz vorher von hier aus und stößt den
  Lauf selbst an:

  ```
  node tools/cr-zugang-holen.mjs --secret
  gh workflow run crunchyroll-nachholen.yml -f limit=0 -f alter=28
  ```

  **Gelöst am 16.09.2026:** Jeder Workflow holt das Paket vor seinen Crunchyroll-Schritten
  selbst, über die Vercel-Weiche (`cr-zugang-holen.mjs --github-env` → `CR_ZUGANG_FRISCH`);
  das Secret ist nur noch Rückfall. Der Absatz darunter beschreibt den Stand davor.

  **Der wöchentliche Lauf bleibt davon unberührt** — er läuft weiter ins Leere, solange
  niemand am Vortag daran denkt. Das ist keine Nachlässigkeit, sondern die Folge der
  IP-Bindung: Ein Paket kann nur an Daniels Leitung entstehen, und die steht nicht unter
  GitHubs Kontrolle.

- **Ein Cloudflare Worker macht einen Abruf nicht deutsch — er reicht das Land des Aufrufers
  durch** (16.09.2026, verworfen nach Messung). Ein Worker in Frankfurt (Placement,
  `colo=FRA`) bekam von `auth/v1/token` `DE`, solange **ich** ihn aufrief; vom GitHub-Runner
  aus `US` bei unverändertem `colo=FRA` (`/cdn-cgi/trace`: `loc=US`), und ein **Cron** der
  Weiche lief in Osaka mit `US` — wie die 606 Cron-Messungen des Newsletter-Workers seit dem
  22.08. Cloudflare gibt bei Unteranfragen an Cloudflare-Zonen das Land der **eingehenden**
  Anfrage weiter. Placement ändert den Ort, nicht das Land. Weiche (`cr-weiche`) und
  Secret wieder entfernt.

  **Was dabei trug:** Ein in Deutschland geholtes anonymes Token liefert auch vom US-Runner
  den deutschen Katalog (`content/v2/cms/series/<id>/seasons`, Fairy Tail: DE-Token „DE",
  US-Token „–"). Die Cloud braucht also nur ein frisches deutsches Token (1 Stunde) oder
  das CMS-Paket (24 Stunden) — und beides entsteht bisher nur an Daniels Leitung.
  **Getragen hat Vercel** (am selben Abend): eine Funktion in `fra1` (`weiche-vercel/`,
  Projekt `cr-weiche`, Konto per Google) meldet vom GitHub-Runner aus dreimal
  `{"region":"fra1","crunchyroll":"DE"}`. Dahinter steht AWS Frankfurt, kein Cloudflare,
  also reicht niemand das Land des Aufrufers durch. Sie leitet nur an
  `beta-api.crunchyroll.com` weiter und verlangt `X-Weiche-Token` (GitHub-Secret
  `CR_WEICHE_TOKEN`, Vercel-Env `WEICHE_TOKEN`); `data:cr-offene` nutzt sie, sobald das
  Secret gesetzt ist. Ausliefern: `cd weiche-vercel && npx vercel deploy --prod --token …`
  (Token in `my_secrets.md`). **Das Vercel-Projekt darf nicht mit dem GitHub-Repo verbunden
  sein** (17.09.2026): Beim Anlegen am 16.09. um 21:31 hat Vercel `cr-weiche` mit
  `danielzaiser91/anime-kalender-de` verknüpft, ohne Stammverzeichnis. Seitdem hat jeder Push
  das ganze Repo als Produktion ausgeliefert — über 100 Deployments in 19 Stunden, 75 % der
  10 GB Deployment-Speicher (Vercel-Mail 15:17), und `cr-weiche.vercel.app` zeigte die
  Kalender-Seite statt der Funktion: `/api/cr` gab 404, der Nachhol-Lauf 35225541742 fiel auf
  das Secret zurück. Behoben am selben Tag: Verbindung getrennt, das CLI-Deployment vom
  16.09. wieder befördert (`POST /v10/projects/<id>/promote/<dpl>` — ein neues Deployment ließ
  das Tageslimit von 100 nicht mehr zu), 147 Git-Deployments gelöscht. Prüfgriff:
  `GET /v9/projects/<id>` darf kein `link` tragen.
  Vercels Node-Laufzeit will benannte `GET`/`POST`-Handler — ein
  `export default` stürzt mit `FUNCTION_INVOCATION_FAILED` ab. `wrangler delete`
  scheitert mit unserem Token („Memberships->Read"); gelöscht wird über
  `DELETE /accounts/<id>/workers/scripts/<name>`, KV anlegen darf das Token nicht.

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
    **Der Bau hielt sich bis zum 17.09.2026 nicht daran:** 109 Serien trugen `nichtVerfuegbar`
    aus dem US-Lauf vom 21.08., 33 davon führt der deutsche Katalog mit deutscher Tonspur
    (u. a. Flowers of Evil, Kokoro Connect, UQ Holder). 14 davon waren nie mit deutschem Zugang
    geprüft; ihre Verweise wurden entfernt und kamen nie mehr zur Prüfung. Seitdem bleibt ein
    solcher Verweis offen (`usNeinWiderlegt()`). Gibt es unter anderer Schreibweise schon einen
    deutschen Befund (19 Fälle), entscheidet der — die breite erste Fassung kostete fünf „DE ✓".
  - **Und er kennt gar keine Filme.** Gemessen am 07.09.2026: Alle 1.589 Einträge in
    `data/cr-katalog-de.json` tragen `typ: "series"`. „Millennium Actress", „Okko und ihre
    Geisterfreunde", „Liz und der Blaue Vogel", „Sin: The Movie", „Cencoroll Connect" und
    „Street Fighter II" fehlen dort **alle** — nicht weil es sie nicht gäbe, sondern weil der
    Abruf nur Serien holt. Wer aus „nicht im Katalog" auf „gibt es nicht" schließt, streicht
    bei einem Film zuverlässig das Falsche. Für Filme antwortet allein
    `content/v2/discover/search` mit `type=movie_listing`.
- **Netflix gibt die Sprachen erst mit dem Player heraus — gemessen, nicht vermutet.** Am
  22.08.2026 auf einer offenen Titelseite mit zwei Konsolen-Skripten geprüft:
  `models.graphql.data` umfasst 6.797 Zeichen und enthält Profile und Benachrichtigungen, null
  Treffer für `audioLocale`, `de-DE` oder `Deutsch`; im übrigen Seitenzustand stehen nur
  Oberflächentexte. Erst beim Abspielen lädt Netflix ein Manifest
  (`/playapi/cadmium/manifest/1`, rund 198 KB) mit `audioTracks`, `language` und
  `languageDescription`.

  Daraus folgt der Ablauf in `daniel-zum-abarbeiten/listen/06-netflix-rest.md`: **Abspielen** verlinkt direkt auf
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
    Fälle stehen ganz oben in `daniel-zum-abarbeiten/listen/09-youtube-liste.md`.

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
  `daniel-zum-abarbeiten/listen/07-alle-anbieter.md` — nach hinten sortiert von heute, ohne Künftiges (das kann niemand
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

### Prime-Verweise zeigen auf JustWatchs gti-Adresse (17.09.2026)

Amazon führt je Titel mehrere Kennungen: die ASIN im Link, eine interne `pageTitleId`, eine
26-stellige Adresse und die gti (`amzn1.dv.gti.…`), die im Hydration-Block als `catalogId`
steht. JustWatch nennt je Angebot `watch.amazon.de/detail?gti=…`. Gemessen in Daniels Sitzung
(`docs/poc-justwatch-amazon.md`): **8 von 8** lebenden Seiten tragen genau JustWatchs gti,
zweimal bei abweichender `pageTitleId`. Eine tote Seite (Afro Samurai) leitet über die alte gti
auf eine **neu angelegte** Seite mit neuer gti weiter. Verglichen wird deshalb nie über die ASIN,
und der haltbare Link ist JustWatchs Adresse selbst.

Der Bau stellt erst **am Ende** um (`pipeline/lib/amazon-gti.ts`, genau ein Prime-Weg und genau
eine gti), und **nur, wo die Erweiterung dieselbe gti auf unserer Seite abgelesen hat**
(`data/amazon-gti-belegt.json`, aus `gti=` in der Notiz seit 4.20.25). Grund: Daniels
Gegenprobe am selben Abend — JustWatch führt „Pokémon: Der Film – Weiß" richtig, sein
Amazon-Angebot trägt aber die gti von „Schwarz". Die erste Fassung stellte 198 Verweise
ungeprüft um und ersetzte 22 tote; beides ist zurückgenommen. Bis dahin rechnet er mit der ASIN. Sie bleibt als `seite` am Verweis, und alles, was
an ihr hängt, liest sie: Handbelege (`check:handbelege`), Import der Meldungen, Rohfolgen,
Prüfliste, Wiedervorlage, Linkprüfung. Der Ersatz toter Adressen ist abgeschaltet (`ERSATZ_TOTER_AMAZON_LINKS`): Ohne alte Seite gibt
es nichts, woran sich JustWatchs Zuordnung prüfen ließe. **Wer eine neue Stelle baut, die Prime-Adressen aus dem
Datensatz liest, nimmt `seite ?? url`.**

### Amazon duldet keinen Agenten — die Prüfliste bleibt deshalb Handarbeit

Am 29.08.2026 gemessen, weil die Frage naheliegt: Ließen sich die 161
Prime-Suchadressen nicht einfach automatisch auflösen, statt sie Daniel
vorzulegen?

Die robots.txt beantwortet sie in zwei Zeilen. Der `*`-Block sperrt `/s?k=`
**nicht** — aber darunter stehen **19 namentliche Bot-Blöcke, jeder mit
`Disallow: /`**:

    ClaudeBot, GPTBot, CCBot, PerplexityBot, Google-Extended,
    GoogleAgent-Mariner, GoogleAgent-Shopping, meta-externalagent,
    Bytespider, Scrapy, PetalBot, Devin, omgili, AI2Bot,
    Gemini-Deep-Research, PanguBot, MistralAI-User, Diffbot,
    Sidetrade indexer bot, EtaoSpider

Dazu `/gp/video/api` ausdrücklich — genau der Aufruf, über den die
Folgenliste käme. Damit ist die Sache entschieden, und zwar auf demselben Weg
wie am 24.08.2026: **Die namentlichen Blöcke sagen, ob der Betreiber
automatisiertes Auslesen überhaupt duldet**, und hier sagen sie neunzehnmal
nein. Wo ein Betreiber besondere Vorkehrungen trifft, fehlt der Berufung auf
BGH I ZR 159/10 ihre tragende Voraussetzung.

**Was Daniel in seiner angemeldeten Sitzung tut, ist davon nicht berührt** — er
ist ein Kunde, der eine Seite ansieht, und die Erweiterung liest, was ihm
ohnehin angezeigt wird. Die Trennlinie verläuft zwischen einem Agenten, der
Amazon abruft, und einem Menschen, der dort blättert.

Die praktische Folge steht in `docs/autonomie-plan.md`, Phase 5: Die Prüfliste
wird nicht kürzer, sie wird **billiger je Eintrag**. Jeder Eintrag bringt die
Frage mit und nimmt die Antwort in einem Klick entgegen.

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

### „Wiedergabesprachen“ auf der Titelseite ist die Vereinigung aller Folgen

Daniel am 19.09.2026 im Durchgang: „bei wiedergabesprache steht deutsch selbst wenn nur eine
folge deutsch hat.“ Der Kasten unter „Details“ nennt jede Sprache, die **irgendeine** Folge der
Seite hat. Daraus folgt:

- **Film** (ein Stück): Die Angabe ist ein Beleg, in beide Richtungen.
- **Serie, Deutsch fehlt**: Beleg für „kein Deutsch“ — keine Folge hat es (Edens Zero S2).
- **Serie, Deutsch steht da**: **kein** Beleg für die ganze Staffel. Übernommen wird nur die
  Adresse (`verweise-von-hand.yaml`); das Urteil kommt aus der Meldung der Erweiterung, die
  jede Folge einzeln liest und `dubRanges` schreibt. Air Gear war kurz als ganze Serie
  „deutsch“ gebucht und wurde zurückgenommen.

Beim Kanal-Titel gilt zusätzlich der Abschnitt darunter.

### Bei einem Kanal-Titel ist Amazons Sprachangabe kein Beleg

**Der Kopf einer Sammelseite ist kein Weg zu einer Staffel** (21.09.2026). Golden Wind trug zwei
Prime-Pillen, die identisch aussahen: B0G1ZD14D3 und B0CG7KDCTS. Daniels Klicktest: Auf
B0CG7KDCTS springt die Auswahl „Staffel 4" auf B0G1ZD14D3, dort bleibt die Kennung stehen.
B0CG7KDCTS ist also der Kopf der JoJo-Sammelseite, der die neueste Staffel vorwählt — eine
fünfte Staffel würde er morgen zeigen. Beide Diagnoseberichte trugen **dieselben Folgen-GTIs**
(`gtisImQuelltext`) in derselben Reihenfolge; das ist das eindeutige Merkmal, denn eine Folgen-GTI
gehört genau einer Folge. Die Kopfadresse kam aus aniSearch und trägt jetzt `available: false`.

**Eine generische Zusammenlegung über die Folgen-GTIs trägt derzeit nicht.** Gemessen am selben
Tag über `prime_folge` (GTI und `seiten_kennung` je gemeldeter Folge): Außer Golden Wind teilte
sich genau ein Seitenpaar Folgen, und das waren zwei Bögen mit zwei gemeinsamen Folgen, keine
doppelte Staffel. Doppelte Adressen entstehen aus Fremdquellen, deren Seite niemand meldet — dort
hat der Bau keine GTIs zum Vergleichen. Neu bewerten, sobald die Erweiterung auf einer Fremdseite
selbst meldet, dass sie dieselben Folgen zeigt wie eine schon gemeldete.

**Geändert am 17.09.2026 für das Ja:** Daniel: „Unsere Meldung per Extension sollte höchste
Confidence haben … bau es so, das wir direkt mitbekommen wenn die extension schuld ist."
Eine Kanal-Meldung **mit** deutschem Ton wird seitdem ein Beleg (`dub: true`, Notiz behält den
Kanal-Hinweis); ausgelassen wird nur noch das Nein. Sonst legte die Prüfliste dieselbe Seite
endlos wieder vor (Golden Kamuy). Fehler der Erweiterung sollen stattdessen auffallen:
`fetch-pruefungen.ts` schreibt Auffälligkeiten (Titel der Meldung passt nicht zur Staffel der
Seite, Folgenzahl höher als beim Titel) nach `data/meldungs-auffaelligkeiten.json` und macht bei neuen
Befunden den Bau gelb (Stand seit 19.10.2026: Abschnitt „Meldungs-Auffälligkeiten: Momentaufnahme“ unten). Der Rest dieses Abschnitts beschreibt, warum das Nein weiter zwei Quellen braucht.

**Zurückgenommen am 11.10.2026 für das Ja.** Daniel an Hell Mode: „Auf Deutsch, Prime Video ✓ Deutsch“ ist
falsch, bei ADN gibt es den Titel nur mit Untertiteln. Der Handbeleg vom 30.08. trug `dub: true` **und**
die eigene Warnung „Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg“ — der Widerspruch stand in
790 Belegen (832 mit Warnung). Seitdem gilt: Ein Kanal-Titel belegt keine Synchro, weder Ja noch Nein.
`loadDubChecks()` lässt `dub` und `dubRanges` solcher Zeilen weg (`lib/kanal-titel.ts`, außer mit
`zweiteQuelle`); die Zeile bleibt als Adressbeleg stehen, die Pille zeigt „🇩🇪 ?“. Dasselbe gilt für das
Urteil aus Stufe 3 (`bau/urteil-schliesst-luecken.ts`), das aus derselben Amazon-Angabe ein Ja machte.
Die Datei bleibt unverändert (die Erweiterung hängt weiter an), die Invariante D-25 hält jeden anderen
Weg zu. Ein Titel behält „Auf Deutsch“, wenn eine zweite Quelle es trägt (aniSearch, Crunchyroll, ADN,
Netflix, eine Erstausgabe mit Synchro, eine andere Prime-Ausgabe). Liste der betroffenen Titel:
`daniel-zum-abarbeiten/listen/kanal-titel-belege.md`.

**Drei Wege führten zum selben Ja, alle sind zu** (Bau-Vergleich 12.10.2026): der Handbeleg (`lib/kanal-titel.ts`),
das Urteil aus Stufe 3 und die gemeldeten Folgen (`prime-zugeordnet.json`, `rohBelegtDeutsch()` in
`09-3-prime.ts`: der Verweis wird weiter angelegt, nur das Häkchen entfällt). Der Schlüssel ist
„Titel|Adresse", weil eine Seite mehreren Titeln gehören kann (Stardust Crusaders und Battle in Egypt).
D-25 meldet nur, wo der Titel sonst nichts Deutsches trägt: Termin bei Prime, aniSearch „deutsch",
Erstausgabe, Sprecher oder ein anderer Weg mit Häkchen schlagen an (Pokémon, Attack on Titan). Gemessen
(Ersatz-Cache, Basis 6005eb2af): Prime-Häkchen 775 → 554, davon auf Kanal-Wegen 275 → 12; drei Titel
verlassen die Hauptliste (Hell Mode, Freezing OVA, Freezing Vibration OVAs — aniSearch führt Deutsch dort
als „geplant“ bzw. „nicht genannt“, der Kanal war die einzige Stütze); 110 Titel verlieren jedes Häkchen,
tragen „Auf Deutsch“ aber weiter über aniSearch, Erstausgabe, Sprecher oder Termin. JustWatch nennt bei 154
der 209 Titel mit verlorenem Häkchen `de` am Kanal-Angebot (Hell Mode: nur `ja`); dafür fehlt meist die
gti am Weg, die „Deutsch laut JustWatch“ (`lib/jw-vertrauen.ts`) verlangt — das Kennzeichen kommt, sobald
die Erweiterung die gti liest.

**Die gemeldeten Folgen erkennen eine Kanal-Seite nur über einen Handbeleg** (16.10.2026, Bestandsbau rot an
Demon Slayer 166240/145139). `rohDeutsch()` kennt Kanal-Seiten nur aus Zeilen mit `kanalOhneBeleg`; eine neue
Meldung zu einer Kanal-Seite ohne solche Zeile setzt das Häkchen, und das Erbe vom Anbieter setzt es auch. Gegen
Termine, die alle `sprache` tragen, nimmt `tonDerKanalWege()` (`bau/deutsch-nicht-gegen-sprach-termin.ts`) jedes
Kanal-Ja ohne Handbeleg wieder weg, nach dem Erbe. Offen: 19 Rohmeldungs-Ja an Kanal-Wegen ohne Termin (gemessen
16.10.2026 an `prime-zugeordnet.json`), darunter Aniverse-Titel wie Yu-Gi-Oh! GX, die ohne das Häkchen keins mehr trügen.

**Ein Nein zu einer anderen Adresse gilt für den Kanal-Weg nicht** (12.10.2026, Prüfer: Goblin Slayer II, JoJo
Diamond is Unbreakable). Nach `ohneKanalSprache()` hat die Kanal-Zeile kein `dub` mehr und zählt als Adressbeleg;
`belegFuer()` fiel bei einem Weg auf `liste[0]` zurück und nahm das Nein einer fremden Adresse. Jetzt hält die
Kanal-Zeile ihre Adresse (`kanalAdressenOhneBeleg()` in `09-1-belege.ts`), der Weg bleibt mit „🇩🇪 ?“ stehen.
Invariante D-26 (`kanalWegEntfernt()`) meldet jeden Kanal-Weg ohne eigene Aussage in `verweise-entfernt.json`.
Bau-Vergleich mit Katalog-Ersatz (Basis c97234b40, Kandidat cafd78846): `verweise-entfernt.json` 855 → 855 ohne
neuen Eintrag, kein Titel verliert einen Prime-Weg (sechs gewinnen einen), `ohne-synchro.json` nimmt Hell Mode,
Freezing OVA und Freezing Vibration OVAs auf (17615 → 17618).

**Der Prime-Weg ging ohne Protokoll verloren, wenn er eine Amazon-Suche war** (12.10.2026, 16 Titel: One Piece Film: Strong World,
Akame ga Kill, Mob Psycho 100 III u. a.). AniList verlinkt bei Prime meist einen fremden Marktplatz; daraus macht der Bau die Suche
(`mapStreams`). Bis PR 863 setzte `belegFuer()` die Adresse des Handbelegs an ihre Stelle (Rückfall bei einem Weg), aber nur für
Belege mit Aussage; die Kanal-Zeile ist seitdem ein Adressbeleg und erreicht ihn nicht mehr. Die Suche blieb, 11-3 („was am Ende
noch auf eine Suche zeigt, fliegt“) warf sie heraus, ohne Eintrag in `verweise-entfernt.json`. Titel ohne AniList-Link waren
nicht betroffen: Dort legt der Ergänzungsblock in 09-2 den Weg aus der Adresse des Belegs an. Jetzt ersetzt derselbe Block die
einzige Suche (`ersetztSucheUndMeldetWeg()`, `lib/weg-aus-beleg.ts`); der Weg bleibt ohne Urteil, ein Kanal-Beleg trägt weder Ja noch Nein. Nachweis: Der Bau mit
Ersatz-Cache, der AniLists Amazon-Link nachbildet (Daten vom 12.10.2026 09:31 Uhr, `82c82ef5e`), verlor 73 Prime-Wege, darunter
alle 16; mit der Änderung kommen alle 16 zurück.

**Anbieter-Ja trägt den Kanal-Weg** (13.10.2026, Daniel: „Prime Video (Crunchyroll)“ wie Crunchyroll, Reborn as a Space Mercenary).
Ist der Anbieter hinter dem Kanal ein eigener Weg desselben Titels (Crunchyroll, ADN; `shared/kanal-anbieter.ts`) mit belegtem Ja, erbt der
Kanal-Weg `dub` und `dubRanges` (`kanalErbtVomAnbieter()`, `bau/kanal-erbt-anbieter.ts`, aufgerufen in 13-schreiben). Das ist die zweite Quelle der
Kanal-Regel, aus einer anderen Messung (Dub-Liste des Anbieters). Ein Nein oder offenes Urteil des Anbieters, ein eigenes Urteil des Kanals und
Kanäle ohne eigenen Anbieter-Weg (Aniverse u. a.) bleiben unberührt (Hell Mode, Golden Wind). Im Kalender geht der Prime-Kanal-Termin in der
Kachel seines Anbieters auf (`vereineAnbieter`, `kanalVon`); ohne den Anbieter am Tag bleibt er.

**Nachtrag 12.10.2026 (Abend): Das Kanal-Ja wird nachgemessen, die Regel bleibt.** Daniel: „Erst messen, dann entscheiden.“ Herkunft von Hell Mode
(`daniel-zum-abarbeiten/berichte/hell-mode-herkunft-2026-10-12.md`): Der Melder bis 4.20.10 (15.09.2026, `141e692d8`) füllte über eine Rückfallebene ein
Sammel-Set `gesehen.sprachen` ohne Folgennummer; Amazon zeigte auch am 30.08. nur 日本語. Altes Seiten-HTML war es nicht.

- **Betroffene** (Stand `dub-confirmed.yaml` 12.10.): 796 Belegzeilen mit Kanal-Warnung und Ja ohne `zweiteQuelle` = 524 Adressen = **355 Titel**. Davon aus der Zeit vor
  4.20.10 (`checkedAt` bis 14.09., die Datei nennt keine Version): 339 Zeilen = 180 Adressen = 161 Titel. Die 105 Titel aus der Liste von PR 991 liegen alle darunter.
- **Gegenprobe** ohne neue Messung (`data/prime-zugeordnet.json`, je Folge, Meldungen ab 28.09.): 176 Adressen mit Deutsch, **3 nie Deutsch** (Hell Mode 185262,
  There’s No Freaking Way I’ll Be Your Lover 184591, Akame ga Kill 20613), 345 ohne Meldung. 65 der 105 aus PR 991 sind nicht bestätigt, 40 schon.
- **Prüfliste:** Es gab schon eine Wiedervorlage, `data/erneut-melden.yaml` (`tools/erneut-melden.mjs`). Sie nahm Kanal-Titel aus (30.09.2026: ihr Nein erzeugt keinen Beleg,
  die Liste liefe endlos). Jetzt gilt `kanal: true`: **195 Titel** stehen mit `seit: 2026-10-13`, Vorrang 1 (145: Beleg von vor 4.20.10 oder Gegenprobe widerspricht) und
  2 (50). Weitere 9 Titel ohne Gegenprobe (darunter Hell Mode) haben keinen Prime-Weg im Bestand und lassen sich nicht öffnen. Der Prime-Durchgang sortierte alphabetisch; `akPrimeVergleich()` (`extension/prime-titelseite.js`, 4.30.4) stellt Einträge mit `vorrang` davor.
- **Löst eine neue Messung den alten Beleg ab?** Ein Ja ja: Es kommt als jüngerer Block derselben Adresse, `verschmelze()` nimmt den neueren. Ein Nein nein: Die Meldung
  einer bekannten Adresse ohne Folgenbefund wurde ausgelassen (`kanalOhneAussage()`), das alte Ja blieb unter der Sperre liegen. Seit jetzt schreibt `fetch-pruefungen.ts`
  auf einer Adresse mit altem Kanal-Ja auch das Nein, und jede Kanal-Meldung trägt `kanalMessung: ja|nein`. Das Feld zählt nicht als Urteil (kein `dub: false`, das
  `check:logic` für Kanal-Titel verbietet); wer die Regel später lockert, liest es statt des alten `dub: true`. Die Messung beendet auch die Wiedervorlage.
  Ein Nein löst das Ja ab (12.10.2026): `kanalJaAdressKerne()` zählt eine Adresse mit `kanalMessung: nein` nicht mehr, weitere Nein-Meldungen darauf schreiben keinen Block mehr, ein neues Ja schon (`check:logic`: `check-kanal-messung.ts`, Lauf über `tools/kanal-messung-mock.mjs`).
- **Auswertung:** `node tools/kanal-nachmessung-vergleich.mjs [--liste]` (Kern `tools/kanal-nachmessung.mjs`): je Adresse alt Ja, neu Ja/Nein/fehlt, Gegenprobe; die Zahl der
  Abweichungen (alt Ja, neu Nein) trägt Daniels Entscheidung. Messung frühestens am 13.10.2026 nach 02:00 (Leselimit).

**Und der Beleg nimmt die Seite, auf der gemeldet wurde.** Eine Meldung trägt zwei Adressen:
`url` ist der Eintrag der Prüfliste (bei einem Staffelwechsel die Seite von Staffel 1),
`seiten_kennung` die Seite, die wirklich angesehen wurde — **für neue Meldungen**. Im
**Altbestand** vor dem 17.09. gilt das nicht verlässlich, gemessen am 18.09.2026: Bei
Arifureta und Babylon war die „Seitenadresse" in der Notiz richtig und die `url` fremd, bei
Clannad genau umgekehrt (Seitenadresse = veraltete Startseite nach einem Staffelwechsel).
Eine Massenumstellung auf die Seitenadresse hätte Clannad und After Story von richtig auf
falsch gedreht. Welche Kennung stimmt, entscheidet dort nur der Titel im Kopfblock der
Seite (`tools/prime-geteilte-adressen.mjs`, misst und schreibt nichts). Bis zum 17.09.2026 schrieb der
Import `url`; ab Staffel 2 nimmt er jetzt `seiten_kennung`, und die Staffel bestimmt
`staffelNummern()` über die Namen der Reihe (auch „Golden Kamuy 4", „Final Season").
Die Erweiterung schickt `titelId` nach einem Staffelwechsel nicht mehr mit (4.20.24).
**Dasselbe galt für die Rohfolgen** (17.09.2026): Sie lagen im Worker nur unter `url`. Vinland
Saga Staffel 2 wurde so der Seite von Staffel 1 zugeordnet (`B0C55SJB1W`, nur Japanisch) und
stand mit „DE ✓" im Panel; das Aufräumen je Adresse löschte außerdem die offenen Folgen der
zuerst gemeldeten Staffel. Seit Migration 030 trägt `prime_folge` die `seiten_kennung`, der
Zuordner reicht sie als `seite` durch, und der Bau nimmt sie, wenn ein Handbeleg die Adresse
einem anderen Titel zuschreibt. Ohne Seitenkennung (Altbestand) wird eine solche Zuordnung
übersprungen.

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

**Und das gilt in beide Richtungen — auch für ein fehlendes Deutsch.** Daniel am 07.09.2026
an „7th Time Loop": „ich habe ihn gemeldet per extension, damit wäre bestätigt das er keine
deutsche synchro hat". Der Schluss liegt nahe und trägt trotzdem nicht: Bei einem Kanal-Titel
zeigt Amazon die Tonspuren, die dem **Betrachter** zugänglich sind, und ohne das Kanal-Abo
fehlt die deutsche.

Gemessen an unseren eigenen Daten: **45 Kanal-Meldungen ohne Deutsch, und bei 14 davon ist
Deutsch bei Prime anderweitig belegt** — JoJo (zweimal), Fruits Basket, Railgun S, Edens Zero
Staffel 2, The Irregular at Magic High School und weitere. Fast jedes dritte „kein Deutsch"
wäre ein Falschnegativ gewesen.

**Was trägt, ist ein zweiter unabhängiger Beleg.** Bei „7th Time Loop" nennt JustWatch für
beide Crunchyroll-Angebote `audio: ja, pt` und führt Deutsch ausschließlich unter
`subtitles` — dasselbe Muster wie bei Chiikawa, also untertitelt statt synchronisiert. Zwei
Quellen, die unabhängig voneinander kein Deutsch im **Ton** finden, ergeben zusammen ein
belegtes Nein; eine allein nicht.

**Und eine ausgelassene Meldung muss die Gegenprobe trotzdem erreichen.** Nukitashi stand am
15.09.2026 seit dem 28.08. auf der Prüfliste: `fetch-pruefungen.ts` lässt eine Kanal-Meldung
ohne Folgenbefund aus, wenn der Datensatz ihre Adresse schon kennt, und schreibt dann keinen
Beleg mit „Kanal" in der Notiz — genau die Zeilen, die `kanal-gegenprobe.ts` liest. Die zweite
Quelle (JustWatch: Aniverse-Kanal nur Ton ja) lag die ganze Zeit bereit, und eine erneute
Meldung wäre wieder ausgelassen worden. Die Gegenprobe liest deshalb zusätzlich
`data/prime-zugeordnet.json`: eine Adresse ohne jeden Beleg, deren gemeldete Folgen alle
Tonspuren tragen und keine davon Deutsch. **Prüffrage bei jedem Auslassen: Wer braucht die
Zeile, die jetzt nicht geschrieben wird?**

#### Die Merkliste `data/kanal-seiten.json` (19.10.2026, Issue #1601)

Der Kanal-Hinweis steht nur in der Notiz des Handbelegs. Stellt der Lauf „Neue Handbelege prüfen“ eine Meldung zurück, fehlt der Beleg im Bau, und die Rohfolgen derselben Seite brachten ein Ja zurück. Die Merkliste hält die Kanal-Seiten (Titel, Adresse, gelesene Seite in der Notiz) ohne eigenes Ja fest.

- **Wer schreibt:** `fetch-pruefungen.ts` über `schreibeBelege()` (`pipeline/lib/dub-confirmed.ts`, Liste in `pipeline/lib/kanal-merkliste.ts`), nach jedem Schreiben der Handbelege, sortiert und ohne Dubletten. Die Datei wird beim Zurückstellen nicht zurückgesetzt (`ARBEITSDATEIEN` in `tools/meldungen-eingrenzen.mjs` nennt sie bewusst nicht).
- **Wer liest:** jeder Leser des Kanal-Wissens über `ladeKanalWissen()` bzw. `kanalWissen()` (`pipeline/lib/kanal-wissen.ts`): Wegwahl (`belegFuer`), Prime-Phase (`rohDeutsch`), Stufe 3 und spätes Urteil, die Wächter D-25 bis D-27, das Aussortieren der Rohfolgen und die Bestandsprüfung `check:kalender-plausibilitaet`. Ein neuer Leser nimmt dieselbe Quelle; `pipeline/check-kanal-leser.ts` führt jeden Leser gegen eine Kulisse.
- **Wann wirkt ein Eintrag:** solange kein Handbeleg desselben Titels dieselbe Seite nennt. Ein Handbeleg zur Seite (zweite Quelle, Korrektur) gilt vor dem Eintrag. Steht dieselbe Kennung@Adresse in `data/belege-entfernt.yaml`, lässt `kanalWissen()` den Eintrag weg (Filter beim Lesen; die Datei bleibt, `ergaenzeMerkliste` sieht sie ungefiltert), damit ein umgehängter Handbeleg seinen Kanal-Hinweis nicht an der fremden Seite behält (29.10.2026).
- **Entfernen:** nur von Hand aus der Datei; der Lauf fügt Einträge hinzu und löscht nie. Ein von Hand entfernter Eintrag kommt mit dem nächsten Lauf zurück, solange der Kanal-Beleg in der YAML steht (`tools/quellen-liste.sh` führt die Datei als Lauf-Ausgabe).

## Ein Beleg gehört einer Ausgabe, nicht einem Titel

Am 07.09.2026 stand über „Date a Live IV" ein grünes „DE ✓", und die verlinkte
Amazon-Seite hatte keine deutsche Tonspur. Daniel: „staffel 4 und 5 wurden von
mir gemeldet auf prime, und beide haben dort keine synchro, also wieso steht da
DE ✅??? … schlimmer fehler" — und, als sich zeigte, dass die Meldung seit dem
28.08. vorlag: „das ist ja umso schlimmer."

Prime führt die Reihe zweimal:

| Adresse | was sie ist | Deutsch |
|---|---|---|
| `B0CK5N448R` | Staffel 4 im Prime-Abo | ja |
| `B0CJJF26WZ` | derselbe Titel über den Crunchyroll-Kanal | nein |

`loadDubChecks()` legte beide Belege unter denselben Schlüssel — **Titel plus
Plattform, ohne Adresse** — und verschmolz sie. Das `dub: true` gewann und
färbte den Verweis, der auf die Kanal-Adresse zeigt.

**Zwei Regeln daraus, und die zweite ist die allgemeinere:**

1. **Verschmolzen wird nur, was dieselbe Ausgabe meint.** Der Adressvergleich
   kennt Amazons beide Schreibweisen (`/dp/<ASIN>` und
   `/gp/video/detail/<ASIN>`) — sonst stünden zwei Belege für dieselbe Seite
   nebeneinander und stritten.
2. **Die Strenge hängt an der Zahl der Wege.** Hat ein Titel nur einen Verweis
   dieser Plattform, ist die `url` im Beleg eine **Korrektur** der Adresse —
   genau dafür ist das Feld da. Erst ab zwei Wegen wird sie zur
   **Unterscheidung**. Ein erster, strengerer Anlauf hätte 60 Belege
   weggeworfen, darunter lauter berechtigte Korrekturen; gemessen richtig sind
   vier.

**Dieselbe Verwechslung eine Ebene tiefer** — am selben Tag gefunden: In
`data/prime-zugeordnet.json` lagen drei Staffel-Adressen unter Titel 15583
(„Date a Live", Staffel 1), weil Amazon jede Staffel schlicht „Date a Live"
nennt und der beste Namenstreffer der Reihenkopf ist. Staffel 1 bekam so die
Adresse von Staffel 2 samt deren `dub: true`.

Die Meldung wusste es besser: Die Erweiterung liest die Staffel aus der Adresse
(`?ref_=atv_dp_season_select_sN`) und schickt sie mit. **Ab Staffel 2 wird ein
Reihenkopf-Treffer deshalb verworfen** — lieber keine Zuordnung als eine
falsche, denn eine falsche erzeugt eine Sprachaussage über den falschen Titel.

**Die gemeinsame Prüffrage**, und sie steht in derselben Familie wie „Eine
Amazon-Kennung zeigt auf eine Staffel, unsere Titel-Kennung auf einen Anime"
(25.08.2026): *Meinen die beiden Angaben, die ich hier zusammenlege, wirklich
dieselbe Sache?* Titel und Plattform genügen dafür nicht — bei Prime nie.

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

**Der POST erzeugt keinen Eintrag unter „Weiterschauen" — gemessen am
01.09.2026.** Die Frage stand seit dem 26.08. offen: Nach dem ersten Durchlauf
stand dort „Jujutsu Kaisen, Noch 23 Min., S2:F1" — nur hatte Daniel dieselbe
Folge kurz zuvor selbst abgespielt, um den Playback-Aufruf mitzuschneiden. Der
Eintrag belegte also nichts. Seine Rückfrage: „du machst voreilige schlüsse, ich
hab doch selbst auch die episode aufgemacht."

**Entschieden hat es eine Gegenprobe an einer nie geöffneten Serie** — derselbe
Griff, der schon bei `getVideoMetadataByVideoId` den Unterschied gemacht hat.
`tools/disney-gegenprobe.js` fragt genau **eine** Folge ab und spricht dafür den
Mitleser an, nicht Disney direkt; es läuft deshalb auch auf einem Titel, der
nicht auf der Prüfliste steht.

| | |
|---|---|
| Serie | „Cat's Eye: Ein Supertrio", Serienseite mit **ABSPIELEN** statt „WEITER" |
| Abruf | eine Folge, Antwort `de, en, es-419, es-ES, fr-FR, it, ja, pt-BR` |
| „Weiterschauen" davor | Undead Unluck · Inept Villainess · Dragon Ball Super · TENGOKU-DAIMAKYO · Jujutsu Kaisen |
| „Weiterschauen" danach | dieselben — **Cat's Eye fehlt** |

**Der Fortschrittsbalken ist dabei der Prüfstein für den Kandidaten.** Der erste
Versuch lief auf „Go, Go, Loser Ranger!", und die Seite zeigte „S1:F7 … Noch 25
Min." mit „WEITER" — angefangen, also als Gegenprobe wertlos. Auf der Startseite
stand die Serie trotzdem nicht; die Reihe „Weiterschauen" zeigt nicht alles.
**Wer prüft, ob eine Serie unangetastet ist, sieht auf der Serienseite nach, nicht
auf der Startseite.**

**Damit darf die Erweiterung bei Disney+ selbsttätig durchgehen.** Für Netflix
folgt daraus **nichts**: Dort ist es keine Anfrage, sondern eine echte
Wiedergabesitzung samt Lizenzabruf (siehe oben, 3,1 s je Folge) — die landet in
„Weiter ansehen", und das ist eine andere Entscheidung.

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

**Die Erweiterung meldet deshalb nichts davon von selbst (Ausnahme seit 4.31.11: der Durchgang bei dem Hinweis, siehe unten).** Sie bietet auf einer
Fehlerseite einen zweiten Versuch an; „nichts da" bleibt ein Klick von Hand. Auch der
Durchgang (▶ alle durchgehen) meldet bei Startseiten-Umleitung oder dem Hinweis „nicht in
deinem Gebiet verfügbar" nichts an den Worker: Er merkt den Titel nur lokal und öffnet ihn
7 Tage lang nicht wieder (`erweiterung.md`, 4.30.9; Entscheidung 13.10.2026, Prüfer zu PR 1147). **Seit 4.31.11 (21.10.2026) meldet der Durchgang den Hinweis „nicht in deinem Gebiet verfügbar“ selbst** (Dirigent, Anlass sechs von Hand geprüfte Titel); Startseiten-Umleitung und Zeitablauf melden weiterhin nichts (`erweiterung.md`).

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

### ADN antwortet jedem Skript mit 403 — und sein Katalog gibt eine Seite heraus, keinen Katalog

Zwei Messungen vom 06.09.2026, beide gegen eine naheliegende Vermutung.

**Der Fehlercode sagt nichts.** 65 der 135 ADN-Verweise zeigen auf die alte
Domain `animationdigitalnetwork.de/video/<slug>`, und alle antworten mit HTTP
403. Der Schluss „die Adresse ist tot" liegt nahe und ist falsch: Die **neue**
Adresse antwortet genauso. Beide Domains liegen hinter CloudFront, das jeden
Aufruf ohne Browser abweist — selbst `robots.txt` ist nicht lesbar. Was
antwortet, ist die Schnittstelle: `gw.api.animationdigitalnetwork.com/show/<id>`
mit `X-Target-Distribution: de` gibt Titel, Sprachen (`vde`/`vostde`) und die
kanonische Adresse heraus.

**Nachtrag 21.09.2026 — im Browser ist die alte Domain doch tot.** Der 403 sagte
nichts, der Schluss oben stimmt insoweit. Aber Daniel hat den Folgenverweis von
„Sister New Devil Burst" (`animationdigitalnetwork.de/video/…/25604-ova-11`) im
Browser geöffnet: Weiterleitung auf die Startseite. Für ein Skript sind beide
Domains gleich stumm; entscheiden kann das nur ein Browser. Seitdem stellt der Bau
jeden Folgenverweis auf der alten Domain auf die Adresse um, die ADN selbst im
Archiv zu genau dieser Folge ausgibt (`adnFolgenAdresse`), und Slug-Verweise
bekommen ihre Kennung wie bisher über den Katalog oder `data/adn-adressen.yaml`.

**Der Katalog kann einen Film einem fremden Titel zuordnen.** Gemessen am
21.09.2026: 882 („One Piece • Le Film") → AniList 18617 (Girls und Panzer der
Film), 904 → 8184, 924 → 2679. Die drei One-Piece-Filme im Bestand (459, 460,
2107) blieben deshalb auf der alten Domain, bis `adn-adressen.yaml` sie von Hand
bekam — und „Girls und Panzer der Film" trug einen One-Piece-Link, weil beide nur
„film" teilten. Seitdem zählt ein Werkwort (`WERKWOERTER` in `lib/adn.ts`) nicht als
gemeinsamer Name, und der Bau verwirft solche Katalogzuordnungen selbst.

**Und `/show?limit=100` ist keine Katalogabfrage.** Sie liefert 96 Serien und
meldet dabei `total: 252`; über drei Seiten gesammelt sind es 184 eindeutige.
Die Zahl 96 als „der deutsche Katalog" zu lesen, hat am selben Vormittag vier
Serien als „gibt es hier nicht" eingetragen — alle vier existieren, sie standen
nur nicht auf der ersten Seite. Dieselbe Falle wie beim Briefkasten
(`LIMIT 500`, 26.08.2026), diesmal mit einem Feld daneben, das die Wahrheit
sagt.

Der Sammellauf war davon nicht betroffen: `fetchCatalog()` paginiert bis zwei
Seiten nichts Neues mehr bringen und führt den Katalog über Läufe hinweg fort —
der Kommentar dort beschreibt genau dieses Verhalten seit dem 20.08.2026. Wer
also von Hand misst, misst schlechter als der Lauf, wenn er nur eine Seite holt.

**Praktische Folge für Adressen ohne Kennung.** `animationdigitalnetwork.de/video/<slug>`
trägt keine Serienkennung, und der Namensteil ist teils französisch
(`50-nuances-de-gras` für „Plus-Sized Elf", `a-quoi-tu-joues-ayumu`). Damit
findet `beurteileAdnVerweis` nichts im Archiv, und der Verweis bleibt bei
„🇩🇪 ?", obwohl ADN die Antwort je Folge längst geliefert hat. Von 135
ADN-Verweisen bekamen am 06.09.2026 **48 kein Urteil aus dem Archiv** (viele
davon tragen ihr `dub` aus einer anderen Quelle, sichtbar offen waren zwölf),
und 33 dieser 48 gingen allein auf die fehlende Kennung zurück.

Die Kennung wird **nachgeschlagen, nicht gesucht**: Der Katalog trägt je Serie
eine `anisearchId` (dieselbe Zuordnung, aus der die übrigen ADN-Adressen
stammen), und `data/adn-adressen.yaml` hält die wenigen Serien fest, die er
gerade nicht führt. Ein zweiter Namensabgleich wäre hier der falsche Weg — die
Fallen stehen weiter oben (`To Love-Ru`, `Wolf's Rain OVA`).

**Ein Folgenverweis wird dabei nicht angefasst.** `…/clannad/12851-folge-24-…`
nennt eine Folgen-Id aus ADNs alter Ablage; an eine neue Serienkennung gehängt
entstünde eine Adresse, die niemand geprüft hat, und der Verweis verlöre seine
Aussage über genau diese Folge.

### ADN im Browser: die Sprache steht je Video in der Schnittstelle, nicht in den Abzeichen der Seite (14.10.2026)

Anlass: ADN in der Erweiterung (4.31.0, `erweiterung.md` „ADN: Sprache je Video"). Gemessen an Daniels gespeicherten Seiten (13.10.2026, 7 Seiten) und am Archiv `data/adn-raw/` (262 Serien, 7.332 Videos, Stand 14.10.2026).

- **Sprache je Video:** `GET gw.api.animationdigitalnetwork.com/video/show/<id>?limit=100&offset=…` (Kopf `x-target-distribution: de`) gibt je Video `languages`: `["vostde"]` 3.156, `["vostde","vde"]` 2.660, `["vde"]` 1.482, `[]` 34. Auch `season`, `number`/`shortNumber`, `type` (`EPS` 7.269, `MOV` 28, `OAV` 27, `PV` 8), `reference`, `available` (alle 7.332 `true`). Die Folgenliste der Seite (`/video/show/<id>/seasons`) hat keine Sprache.
- **Das Abzeichen „SYNCHRO"/„UNTERTITEL" gilt für die Serie.** Dorohedoro (`1375`): beide Staffelseiten zeigen beide Abzeichen, im Archiv hat Staffel 1 (12 Folgen und eine OVA) kein `vde`, Staffel 2 (11 Folgen) alle. Wer das Abzeichen als Staffelaussage liest, bucht Synchro für Staffel 1.
- **Die Seite im Browser:** Kopf mit Abzeichen (`data-testid="text-SYNCHRO"`/`text-UNTERTITEL`/`text-HD`, `text-count` = „2 Staffeln", „18 Videos", „1 Video", „0 Videos"), dann der erste Reiter (`show-tab`), dahinter Folgenliste (`show-video-item`) und Empfehlungen, die ihre eigenen Abzeichen tragen. Staffeln sind Reiter `season-<n>`/`season-<n>-selected` mit Adresse `?s=<n>`. Ohne Video: „Kein Video verfügbar.", „0 Videos", kein Abzeichen im Kopf (The Legend of Hei II, Madoka Magica Film 3).
- **ADN zählt Folgen über Staffeln durch.** Dorohedoro Staffel 2 hat `number` „Folge 13" bis „Folge 23", `reference` zählt je Staffel (`dorohedoro_tv2_0001`). Filme tragen `number` „Film" oder „Film 1"; es gibt „OVA 1", „Épisode spécial 1" und „Folge 3 (NC)" (Fassung ohne Vor- und Abspann, 13 Videos).
- **Persönliche Daten stehen im Kopf der Seite** (Name, Abo, „Mitglied seit") und in `__NEXT_DATA__` (gehört zur zuerst geladenen Seite, nicht zur angezeigten). Testdaten im Repo kommen deshalb aus dem Archiv und aus einer Positivliste von `data-testid` im `<main>` (`tools/adn-ausschnitte-erzeugen.mjs`).

### Eine Nebenausgabe hat bei Crunchyroll oft zwei Blöcke — und nur einer ist der richtige

Gemessen am 13.09.2026 von Daniel an zwei Titeln, beide mit Bild:

| Titel | Block | Folgen | Fassung |
|---|---|---|---|
| Chunibyo Heart Throb | „(German Dub)“ | 13 = Staffel 12 + OVA als S2 E13 | Synchro |
| Chunibyo Heart Throb | „(OVA)“ | 1 | nur Untertitel |
| Durarara!! | Serie | 25 = 24 + Special Tenka Taihei (aniSearch 6986, belegt) | Synchro |

Der Lauf hatte die OVA über ihren eigenen Block beurteilt und ein **Nein** gebucht, obwohl dieselbe Folge im Dub-Block synchronisiert steckt; die Staffel blieb offen, weil er eine Staffel mit genau 12 Folgen suchte. **Vor einem Nein zu einer Nebenausgabe wird deshalb nach einem deutschen Block gesucht, der eine Hauptserie der Reihe um die Nebenausgabe übersteigt**, und eine Staffel darf als Summe aus Werk plus Nebenausgabe derselben Reihe aufgehen (fetch-crunchyroll-offene.ts). Dieselbe Rechnung wie „Der Anbieter zählt kumulativ“ bei Netflix, nur eine Ebene tiefer.

### Eine Folgennummer kann im Block neu beginnen — die laufende Nummer nicht

Captain Tsubasa 2018 (17.09.2026): Crunchyroll führt die Serie von 2018 (1–52) und „Junior
Youth" unter **einer** Kennung, im selben Block. Junior Youth beginnt bei `episode_number` 1,
`sequence_number` läuft 53–91 weiter — und genau diese 39 Folgen sind deutsch. Die Regel
„einzige Serie an der Adresse bekommt die deutschen Folgen" und die Bereichsübertragung
schrieben daraus „Crunchyroll Fg. 1–39 DE ✓" an die Serie von 2018, deren Folgen dort nur
japanisch laufen. Seitdem speichert `deutscheFolgen` auch `laufend`, nachgetragen aus dem
Archiv (`tools/cr-laufend-nachtragen.ts`, 24.860 Folgen, keine fehlte), und
`deutscheFolgenNachDemEnde()` sperrt beide Wege. Über 248 Serien gemessen trifft das genau
diesen einen Fall. **Es waren vier Wege, nicht zwei:** Nach dem ersten Fix stand das Ja weiter
da, weil auch der Namensabgleich in `beurteileJeBlock`, die zweite Bereichsübertragung und die
Katalog-Runden in `build.ts` (Kennung mit genau einer Staffel und `de-DE`) es setzten.
`check:logic` zählt die Sperren. Wer ein Ja für Crunchyroll setzt, sucht vorher jede Stelle mit
`stream.dub = true` für diese Plattform.

## Wer eine Abdeckung misst, zählt alle Quellen — nicht die eine, die am Verweis steht

Am 14.09.2026 stand die Frage, wie viele deutsche Verweise eine belegte Folgenzahl je Anbieter haben. Meine erste Antwort war „93 von 1.982, 5 %" — gezählt hatte ich nur `dubRanges` am Verweis. Daniel: „guck nochmal genau in bestand ob wir evtl schon mehr wissen als die 5% die du ansprichst." Es waren **66 %**, und der Rest (682) sind abgeschlossene Serien, für die die Folgenzahl des Titels gilt:

| Quelle | Verweise |
|---|---|
| Film (eine Folge) | 517 |
| Crunchyroll-Dub-Bestand, `deutscheFolgen` je Staffel | 515 |
| ADN-Historie (`data/adn-vde-historie.json`) | 98 |
| Handbelege und Meldungen (`dubRanges`) | 91 |
| Streaming-Availability-Archiv, `dienste.<anbieter>.deutsch` | 79 |

**Das Feld am Datensatz ist das Ergebnis des Baus, nicht der Bestand dahinter.** Der Bau überträgt nur einen Teil der Einzelbelege in `dubRanges`; wer eine Abdeckung aus `titles.json` abliest, misst den Bau, nicht das Wissen. Prüffrage vor jeder Abdeckungszahl: *Welche Dateien unter `data/` beantworten dieselbe Frage — und habe ich jede davon gezählt?* Nachmessen mit `node tools/folgenzahl-abdeckung-messen.mjs`; die Regeln, die daraus für die Pillen folgen, stehen an `folgenAngabeFuer()`. Wächst die Spalte „laufend", bekommen mehr Pillen keine Zahl — dann lohnt es, die fehlende Quelle zu suchen.

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

## „Zuletzt im Kino: April 2026“ — TMDB `release_dates` rückwärts gelesen (13.10.2026)

Anlass: Assassination Classroom: Our Time (AniList 198373, TMDB 1542877) hat die deutsche Fassung ab 25.04.2026 (aniSearch), im Datensatz
stand kein Kinostart — die Kino-Quellen (`fetch-tmdb-kino.ts`, Kinoheld, Cinestar) schauen nur zwölf Monate nach vorn.

**Gemessen** (13.10.2026, `GET /movie/{id}/release_dates`, ein Abruf je Film, 60 ms Abstand; TMDB nennt ~50 Anfragen/s als Obergrenze):

| Messung | Ergebnis |
|---|---|
| Our Time (1542877) | DE, Typ 3, **2026-04-25** → „April 2026“ stimmt, deckt sich mit dem aniSearch-Datum |
| 12 Stichproben | Typ 3: Our Time, Kitaro 2025-11-19, Dragon Maid 2026-03-31, Tom-Crosby-Mäusebrigade 1978; Typ 2: Detektiv Conan 2020-06-30 („KAZÉ Anime Nights“); nur Typ 4/5/6: Cowboy Bebop (4), xxxHOLiC (5), Pokémon Lucario (6), Mardock Scramble (5); kein DE-Eintrag: 3 |
| alle 716 Filme mit TMDB-Kennung | **254 mit DE-Kinostart bis heute** (35 %), 3 nur künftig, 294 nur Typ 1/4/5/6, 165 ohne DE-Eintrag, 0 Fehler |
| Alter der 254 (jüngster Start) | 2026: 12, 2025: 16, 2024: 18, 2023: 13, 2022: 11, 2021: 13, 2020: 12, 2010–19: 111, 2000–09: 38, vor 2000: 10 |

Mit der echten Anzeigelogik gezählt (`berechneAntwort` + `fragtKinoZuletzt` auf `titles.json`/`releases.json`): **247 Filme** bekämen die Zeile,
einer wäre `filmDe` (hat schon einen Kino-Termin im Kasten), einer `fertig`.

**Bauweise.** `fetch-tmdb-titles.ts` ruft `release_dates` für Filme ohnehin (FSK) — `kinoDe` (alle DE-Starts Typ 2/3) kostet keinen zusätzlichen Abruf und fällt
unter die 150-Tage-Regel (`INHALTSFELDER`). Film-Einträge ohne `kinoDe` sind sofort fällig (`kinoFehlt`), so füllt sich der Bestand in zwei Wochenläufen
(`--limit 400`, 716 Filme) statt in 60 Tagen. Der Bau schreibt `public/data/kino-zuletzt.json` (AniList → Monat, nur Format `MOVIE` mit TMDB-Art `movie`;
Kennungen werden zu `ak`), das Panel lädt sie erst beim Öffnen eines Films — nicht in `titles.json`, weil nur eine Minderheit sie braucht.

**Regeln.** (1) Nur Land DE und Typ 2/3; Typ 4/5 sind Stream und Disc. (2) Nur Monat und Jahr, nie ein Tag. (3) Ein künftiger Start zählt erst ab seinem Tag
(der tägliche Bau entscheidet; `check-kino-zuletzt.ts`). (4) Die Zeile steht nur bei belegter Synchro und nicht unter einem Kino-Banner: Der Kinostart sagt nichts
über die Fassung (OmU-only-Filme haben denselben Eintrag, s. o.), die Zeile behauptet deshalb keine deutsche Kinofassung. (5) Mehrfach vergebene TMDB-Filmkennungen
sind schon vor dem Bau verworfen (`mehrdeutigeFilmzuordnungen`).

**Offen:** Die 111 + 38 + 10 Einträge vor 2020 sind meist Erstaufführungen der 2000er („Zuletzt im Kino: April 2004“) — belegt, aber für Besucher kaum von Nutzen.
Ein Schnitt (z. B. nur ab 2015) ist eine Zeile in `zuletztImKino()`; Entscheidung bei Daniel.

## Ein Anbieter meldet, was neu ist — fragen muss man ihn selbst

Am 10.09.2026 erschienen die drei Specials zu „Lord of Mysteries" auf Deutsch
bei Crunchyroll. Unser Prüflauf hatte die Serie am **09.09.** gelesen. Die Seite
zeigte danach: keine Specials, keine deutsche Fassung, kein Termin. Daniel am
12.09.2026: „thats a huge flaw of the website … this was announced in advance on
various news sites, and it did get dub on crunchyroll, 2 ways that we cover and
should have been notified about."

Vier Fehler trafen an einem Titel zusammen, und drei davon sind allgemein.

**1. Die Wiedervorlage war die falsche Frage.** `scrape-crunchyroll-dub.ts` geht
1.100 Serien reihum durch, mit Fristen von Tagen bis Wochen. Wer so sucht, findet
eine neue Synchro im Mittel eine halbe Frist zu spät — hier wären es vier Wochen
gewesen. Crunchyroll beantwortet die Frage dagegen direkt:

    GET /content/v2/discover/browse?type=episode&sort_by=newly_added&n=100
    → data[].episode_metadata.audio_locale === 'de-DE'

Gemessen am 12.09.2026: 41 deutsche Folgen aus 20 Serien in den 400 jüngsten
Einträgen, darunter die Specials. Vier Abrufe, wenige Sekunden — deshalb
täglich (`fetch-crunchyroll-neu.ts`). Der Fund urteilt nicht, er **hebt die
Frist auf**: Die Serie kommt sofort wieder dran, und das Urteil fällt wie immer
mit dem deutschen Zugangspaket.

**Der Filter der Schnittstelle taugt nicht** — `audio_locales=de-DE` ändert das
Ergebnis nicht (drei Varianten gemessen). Gefiltert wird bei uns.

**2. Ein Titel ohne Verweis wird nie beurteilt.** `beurteile()` bekommt die Titel,
die diese Crunchyroll-Adresse **tragen**. Die Specials sind bei AniList ein
eigener Eintrag ohne jeden Verweis — also ohne Urteil, also ohne Verweis. Das ist
dieselbe Bauform wie im Abschnitt darunter („Eine Warteschlange, die sich aus dem
Bestand bildet"), nur eine Ebene tiefer: nicht die Warteschlange bewacht ihre
Lücke, sondern die Zuordnung.

Seit dem 12.09.2026 schließt eine Runde im Bau sie, und zwar eng: Ein Block muss
**vollständig deutsch** sein, keiner der Titel dieser Adresse darf dieselbe
Folgenzahl haben, und unter den Geschwistern der Reihe darf es genau **einen**
Titel mit dieser Folgenzahl geben. Trifft das zu, holt der Bau den Titel aus dem
Katalog in den Bestand und legt den Verweis an. Bleibt es mehrdeutig, passiert
nichts — eine falsche Zuordnung behauptet eine Sprachfassung über den falschen
Titel.

**3. Bei chinesischen Produktionen sagt das Format nichts.** Alle vier Teile der
Reihe sind ONA; im Panel stand deshalb alles unter „Hauptserie". AniLists
`PARENT`-Kante trennt es sauber: Specials und Chibi-Theater nennen die Serie,
zu der sie gehören, der nächste Arc nicht. Der Bau reicht das als `beiwerk`
durch.

**4. Ohne `startDate` hat ein Katalogtitel keine einzige Zeitangabe.** Die
Katalogabfrage holte nur `seasonYear`, und der ist bei Ankündigungen und
Donghua meist leer: drei von vier Teilen standen ohne Jahr und ohne Termin da.
Seit dem 12.09.2026 holt sie `startDate` und `status` mit; angezeigt wird so
genau, wie die Quelle ist (`2026`, `06.2026`, `19.06.2026`).

**5. Crunchyroll nennt das deutsche Datum — an der deutschen Folge.** Gemessen
am 12.09.2026 an zehn Serien quer durch den Neu-Lauf: `premium_available_date`
trägt an einem Objekt mit `audio_locale: de-DE` den **deutschen**
Verfügbarkeitstermin, `episode_air_date` daneben die originale Ausstrahlung.
Für die Lord-of-Mysteries-Specials steht dort der 10.09.2026 gegen den
19./26./27.06.2026 — auf den Tag Daniels Angabe. Bei einem Simulcast-Dub fallen
beide zusammen, sonst liegen Wochen dazwischen.

Das war im Haus: `crunchyroll-dub.ts` führt das Feld seit jeher als
`verfuegbarAb`, 23.404 Folgen tragen es, und `crunchyroll-termine.ts` baut
daraus Kalendereinträge. Der Kommentar im **neuen** Lauf behauptete trotzdem das
Gegenteil — er stammte aus einer Messung an der **Originalfassung**. Dieselbe
Verwechslung, vor der diese Akte an drei Stellen warnt: ein Objekt je Tonspur,
und die Frage ist immer, welches man gerade in der Hand hält. Ein Fund datiert
seitdem auf `verfuegbarAb`, nicht auf unseren Fundtag.

**Und die Titel: 1.001 Katalogtitel trugen einen „deutschen" Namen, den niemand
als deutsch belegt hatte** — die aniSearch-Überschrift aus Läufen vor dem
08.09.2026, 335 davon zu chinesischen Originalen („Guimi Zhi Zhu: Tebie Pian -
Liewu", während „Lord of Mysteries Specials" danebenlag). Als deutscher Titel
gilt jetzt nur noch, was aus dem Sprachblock oder den Synonymen stammt. Wo
AniList keinen englischen Namen führt (8.683 Titel, 656 davon in der Reihe eines
Bestandstitels), liefert aniSearchs Sprachblock ihn nach.

**Seit 27.10.2026 stündlich statt täglich.** Psyren Folge 1 war am 26.10. um 14:30 UTC auf Deutsch verfügbar, im
Bestand stand sie erst am 27.10. um 04:37 (Katalogfund und Urteil liefen nur im Tageslauf 04 UTC; das
Wochenprogramm trug die DE-Zeile erst 0,6–1,6 h nach Release). Daniel: „spätestens wenn unser crunchy lauf es
bestätigt muss es im kalender auftauchen“. `refresh-hourly.yml` führt deshalb dieselben drei Schritte wie der
Tageslauf aus: `data:cr-neu`, Zugangspaket über die Weiche, `data:cr-dub -- --nur-neu` (Frist-Regel und
Tageslauf unverändert). Gemessen am Tageslauf 27.10.2026: 4 s / 2 s / 4 s; 6 Browse-Abrufe plus ein anonymes Token
je Lauf bei Crunchyroll (24 × 7 = 168 am Tag statt 7) und ein Weichen-Abruf je Lauf. Das Urteil liest nur Serien mit
neuer Folge, deren letzter Blick älter ist als der Fund (Tagesgenauigkeit: eine zweite neue Folge derselben Serie am
selben Tag wartet bis zum nächsten Tag). Verworfen: nur `data:cr-neu` (liefert Meldung und Prüfung, aber keinen
Termin: die Termine entstehen aus dem Urteil `crunchyroll-dub.json`) und das Wochenprogramm häufiger (zeigt die DE-Zeile
erst, wenn Crunchyroll sie in den Wochenplan setzt, ohne exakte Minute). Wächter: `pipeline/check-cr-neu-stuendlich.ts`.

## Für 85 Titel ist „kein Anbieter bekannt" die Antwort, nicht die Lücke

Am 12.09.2026 durchgemessen, weil die Aufgabenliste seit Tagen „Titel ohne
jeden Bezugsweg" führte. Von 2.771 Titeln haben **235** weder Stream noch
Kaufweg noch Termin. Aufgeschlüsselt:

| | Zahl | was dort steht |
|---|---|---|
| deutsche Erstausgabe aus aniSearch | 116 | „Auf Deutsch seit 08.01.2003 · Dybex" |
| belegte Sprechrollen, kein Weg | 34 | „Eine deutsche Fassung gab es — die Sprecher sind belegt" |
| gar nichts | **85** | „Kein Anbieter bekannt" |

**Vier Quellen dafür geprüft, alle vier verworfen — mit Grund, damit niemand
sie in drei Monaten erneut prüft:**

- **JustWatch** hat 232 der 235 bereits abgefragt und nichts gefunden.
- **aniSearchs `websites`** trägt bei 102 etwas — ausnahmslos japanische
  Studioseiten (Sunrise, Pierrot, Toei).
- **JPC** sperrt weder KI-Bots namentlich noch den Suchpfad (robots.txt
  geprüft), führt Anime-DVDs aber unter `poprock` ohne eigene Kategorie und
  **ohne EAN im Treffer**: „Sorcerer Hunters" liefert dort ein Jazz-Album „The
  Sorcerers". Ein Namensabgleich ohne eindeutigen Schlüssel erzeugt genau die
  Kauflinks, vor denen diese Akte warnt — und beim Preis wiegt ein Irrtum
  schwerer als beim Termin.
- **Anime News Network** führt EANs an Releases (1.576 der 2.119 archivierten
  Titel), aber **null deutsche Ausgaben**: Die Encyclopedia pflegt den
  englischsprachigen Markt. Und Sprecher hat es für diese Titel ebenfalls
  nicht — 2.119 von 2.120 Kennungen sind längst abgefragt, nur eine war nie
  dran. Die Warteschlange ist also nicht schuld.

**Was daraus folgt, ist eine Haltung, keine Aufgabe.** Diese 85 sind meist vor
2000 erschienen und liefen hier im Fernsehen; es gibt sie heute nirgends mehr
zu sehen oder zu kaufen. „Kein Anbieter bekannt" ist dafür die richtige
Auskunft — sie beendet das Suchen, statt es zu verlängern (dieselbe Aufgabe wie
bei `dub: undefined` gegen `dub: false`).

**Wieder aufgegriffen wird es, sobald je Titel eine EAN vorliegt.** Dann trägt
ein Shop-Abgleich, weil er nicht mehr über Namen laufen muss. Vorher nicht.

## Ein Pinyin-Titel ist kein Name — und das Synonym daneben ist einer

AniLists `romaji` ist bei japanischen Werken die etablierte Umschrift; „Shingeki
no Kyojin" sucht auch hier jemand so. Bei chinesischen und koreanischen
Produktionen ist es eine Umschrift, die niemand kennt: „Guimi Zhi Zhu: Wu Mian
Ren Pian" (Daniel, 12.09.2026: „wu mian ren pian ist weiterhin chinesisch").

Fehlt dort der englische Name, führt AniList ihn oft unter **`synonyms`** — für
diesen Titel „Lord of the Mysteries 2". Der Katalogabruf holt `synonyms` und
`countryOfOrigin` seit dem 12.09.2026 mit; `bestesSynonym()` nimmt davon den
längsten rein lateinischen Eintrag, und nur bei `countryOfOrigin` ≠ JP.

Drei Riegel, jeder mit belegtem Fall aus derselben Liste: **nur ASCII-Latein**
(sonst gewinnt „Chúa Tể Huyền Bí"), **mindestens sechs Zeichen** (sonst „LOTM"),
und **Kleinbuchstaben müssen vorkommen** (ein reines Versalienkürzel ist kein
Name). Was übrig bleibt, ist ein Vorschlag für `titleEn` — nie für `titleDe`:
Ein englischer Name ist keine deutsche Fassung, und genau dort verläuft die
Trennlinie dieses Projekts.

**Die allgemeine Form:** Ein Feld, das für die halbe Welt die richtige Antwort
ist, ist deshalb noch keine Antwort für die andere Hälfte. Die Frage ist nicht
„ist das Feld gefüllt", sondern „beantwortet es hier die Frage".

## Eine Warteschlange, die sich aus dem Bestand bildet, kann eine Lücke nie schließen

`scrape-crunchyroll-dub.ts` bildet seine Liste aus den Crunchyroll-Verweisen,
die schon im Bestand stehen. Das ist naheliegend und hat einen blinden Fleck,
den man erst sieht, wenn man ihn sucht: **Wo kein Verweis steht, wird keiner
geprüft — und wo keiner geprüft wird, entsteht auch keiner.**

Der Beleg ist der teuerste Einzelfall des Projekts. Detektiv Conan läuft bei
Crunchyroll mit **405 deutschen Folgen** (von Hand belegt am 25.08.2026,
Kennung `GW4HM7NV3`, Bereiche 1–254 und 334–483). Im ausgelieferten Datensatz
stand dazu am 06.09.2026 ein Amazon-Kaufweg und sonst nichts:

1. Der falsche Verweis `crunchyroll.com/de/case-closed` (der englische Block)
   wurde als belegtes Nein entfernt — richtig.
2. Der richtige wurde nie angelegt — und konnte es nicht, weil die
   Warteschlange nur kennt, was schon dasteht.
3. aniSearch führte ihn die ganze Zeit: `crunchyroll.com/detektiv-conan`.

**aniSearch nennt zu jedem Werk seine Bezugsquellen**, und der Bau las davon
genau eine Zeile (die Ersetzung von Prime-Suchadressen). Gemessen fehlten
**625 Anbieter**, die aniSearch kennt und der Datensatz nicht führte — 388
Prime, 154 Crunchyroll, 33 ADN, 32 YouTube, 15 Netflix, 3 Disney+.

Seit dem 06.09.2026 ergänzt `build.ts` sie, mit vier Riegeln:

| Riegel | Anlass |
|---|---|
| die **Adresse** zählt, nicht der Anbieter | ein Crunchyroll-Block ist nicht das Werk — ein Nein zu `case-closed` ist keins zu `detektiv-conan` |
| was einmal entfernt wurde, bleibt entfernt (`data/verweise-entfernt.json`) | sonst legt jeder Bau wieder an, was der Prüflauf gerade verwarf — ein Flattern zwischen zwei Läufen |
| ein Handbeleg schlägt alles, auch ein verneinender | am 25.08.2026 hat ein Lauf so fünf geprüfte Neins überschrieben |
| bei Amazon nur, was als Video belegt ist | hinter `/dp/` kann eine DVD liegen |

**Der Block steht hinter dem Entfernen der Neins**, und das ist keine
Kleinigkeit: Weiter oben sind die Anbieter noch besetzt, dort kamen im
Probelauf 83 statt 123 Verweise heraus.

**Wer unten ergänzt, muss unten auch beurteilen.** Die Auswertungen laufen
weiter oben und sehen nur, was zu ihrem Zeitpunkt dastand — ein hier
entstandener Verweis bekäme sein Urteil erst beim nächsten Bau. Für Conan hieß
das: ein Crunchyroll-Weg mit „🇩🇪 ?", während der Prüflauf am selben Vormittag
581 deutsche Folgen belegt hatte. Die Nachrunde fragt dieselben Quellen je
Verweis (die geprüften Crunchyroll-Serien nach Adresse, das ADN-Archiv), beide
sind dort geladen.

Zwei Dinge gehören dazu, und beide sind gemessen:

- **Auch die Nachrunde entfernt ein belegtes Nein.** 78 der 123 ergänzten
  Verweise zeigen auf Blöcke ohne deutsche Tonspur; ohne diesen Schritt stünde
  erstmals ein `dub: false` im ausgelieferten Datensatz. Das Ergebnis ist kein
  Verlust, sondern Wissen: 78 belegte Neins, die vorher niemand hatte.
- **Das Gedächtnis reicht bis in den laufenden Lauf hinein.**
  `data/verweise-entfernt.json` trägt den Stand des **letzten** Laufs; was
  wenige Zeilen weiter oben gerade verworfen wurde, steht dort noch nicht. Ohne
  `verweiseEntfernt` legte derselbe Lauf wieder an, was er selbst eben entfernt
  hat — das Flattern entstünde innerhalb einer einzigen Ausführung.
- **Und ein Nein gilt dem Titel, eine tote Adresse allen** (17.09.2026). Das Gedächtnis
  schlüsselt „belegtes Nein" nach Titel und Adresse; sonst nahm das Nein zu Princess
  Principal Kapitel 3 den deutschen Kapiteln 1 und 2 ihre gemeinsame Serienadresse. Und
  `adressKern()` behält bei YouTube die Kennung (`v`, `list`) — ohne sie hieß jedes Video
  `youtube.com/watch`, und ein einziges Nein sperrte alle. **Wer einen Adresskern baut,
  prüft, ob die Kennung im Pfad oder im Parameter steht.**
- **Und es schreibt auch mit, was es selbst gesperrt hat** (17.09.2026). Bis dahin
  stand in der Datei nur, was der jeweilige Lauf entfernt hatte. Ein gesperrter Verweis
  wurde dadurch nicht mehr entfernt, also nicht mehr notiert, und der übernächste Lauf
  legte ihn wieder an: 78 Crunchyroll-Adressen flatterten von Bau zu Bau (836 ↔ 769
  Einträge in `data/bestand-historie.jsonl`). Gefunden hat es die Wache, nicht ein Test.

Die ergänzten Verweise tragen sonst **keine** Sprachangabe. Sie sagen „hier
gibt es das", nicht „auf Deutsch", und füllen damit genau die Warteschlangen,
die vorher an ihrer eigenen Lücke verhungert sind.

**Ein abgebrochener Bau hinterlässt dieses Gedächtnis trotzdem — gemessen am
06.09.2026.** `data/verweise-entfernt.json` wird in `build.ts` rund 430 Zeilen
**vor** dem Riegel geschrieben, der einen Titelschwund abfängt. Ein lokaler Lauf
mit älterem `data/cache/` brach dort ab („2 Titel würden aus dem Datensatz
fallen") — und die Datei war da bereits von 782 Zeilen auf zwei geschrumpft, weil
dieser Lauf weniger entfernte Verweise gesehen hatte. Committet, hätte der
nächste Bau alles wieder angelegt, was frühere Läufe als belegtes Nein entfernt
haben.

Gefangen hat es `git status` vor dem Commit; in der CI bleibt der Lauf rot und
committet nichts. **Der Riegel schützt also den Datensatz, nicht die Nebendateien
daneben** — wer nach einem abgebrochenen Bau committet, sieht den Diff der
Nebendateien durch, nicht nur den von `public/data/`.

## Ein deutscher Sprachblock bei aniSearch ist keine Synchro — die Marke daneben ist es

aniSearch führt je Werk einen Block pro Sprache, mit Titel, Status, Datum und
Verlag. Der Block „Deutsch" sagt: **es gibt hier eine Veröffentlichung**. Ob sie
synchronisiert oder untertitelt ist, sagt er nicht — und genau daran hängt die
Trennlinie dieses Projekts.

**Die Auskunft steht daneben**, seit jeher, und der Parser liest sie:

    <a href="…?dubbed=en" class="dubbed dubbed-1">
      <span class="dubbed-1-text1">Synchronisiert</span>

Gemessen am 06.09.2026 an den Handbelegen: **917 von 967** Titeln mit belegtem
`dub: true` tragen diese Marke. Sie ist damit das belastbare Signal;
`languages[].language === 'Deutsch'` ist es nicht.

**Was das für den Katalog hinter dem Toggle heißt.** 11.607 Katalogtitel haben
eine aniSearch-Kennung, und keiner davon war je geholt worden — der volle
Durchlauf kostet bei 6 Sekunden Abstand rund 19 Stunden. Drei Stichproben über
zusammen **560 Titel**, die letzte mit der Sortierung „aussichtsreiche zuerst":

| | Zahl |
|---|---|
| deutscher Beschreibungstext | 526 |
| Stream-Angabe | 33 |
| deutscher Sprachblock | 84 |
| **davon mit Synchro-Marke** | **0** |
| Synchro-Marke in **irgendeiner** Sprache | **401** |

Die letzte Zeile ist die Gegenprobe, und ohne sie wäre der Befund wertlos: Der
Detektor arbeitet, er findet 401-mal eine Synchronfassung — nur nie eine
deutsche. Ein „nichts gefunden" ohne diesen Beleg beantwortet nicht, ob
überhaupt gesucht wurde.

Ohne die Marke sähe das nach 84 gefundenen deutschen Fassungen aus. Mit ihr ist
es null, und der Durchlauf wäre 19 Stunden für einen Beschreibungstext.
**Entschieden am 06.09.2026: Er wird nicht gefahren.** Der Schalter
`data:anisearch --katalog` bleibt für den deutschen Text und die Streams
bestehen, ohne Vorrang.

**Und der Befund sagt etwas über den Hauptbestand.** Der Katalog hinter dem
Toggle ist genau die Menge, für die MyDubList keine deutsche Synchro kennt. Für
560 davon widerspricht aniSearch **kein einziges Mal**. Das ist der bisher
beste Beleg dafür, dass die Hauptquelle des Projekts vollständig ist — er ist
nebenbei entstanden, aus einer Messung, die etwas anderes suchte.

**Die allgemeine Form:** Eine Quelle, die auf die Frage des Projekts *fast*
antwortet, ist gefährlicher als eine, die schweigt. „Es gibt eine deutsche
Veröffentlichung" und „es gibt eine deutsche Synchronfassung" sehen in einer
Trefferliste gleich aus, und die Differenz ist genau das, wofür es diese Seite
gibt.

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

### Ein Katalog, der Adressen repariert, kann auch welche anlegen

Am 16.09.2026 stand über „Code Geass: Akito the Exiled - The Brightness Falls" ein „Noch keine
deutsche Fassung" — während Crunchyroll die Reihe unter `GRP585ZQR` mit „Audio: Japanese,
**Deutsch**, Français" führt und alle fünf Folgen als „Synchro | Untertitel" ausweist. Vier der
fünf Teile hatten einen Prime-Weg, der fünfte gar keinen (Daniel: „Sogar auf crunchyroll
existent, wo wir 100%-ige abdeckung haben sollten").

**Zwei bekannte Muster trafen sich in einem Titel:**

- `data/cr-katalog-de.json` liegt seit dem 22.08.2026 im Repo und wurde nur benutzt, um eine
  **vorhandene** kaputte Adresse zu ersetzen („Eine Datei zu schreiben ist nicht dasselbe wie
  sie zu benutzen").
- Die Warteschlange des Dub-Laufs bildet sich aus den vorhandenen Verweisen — ohne Verweis
  keine Prüfung, ohne Prüfung kein Verweis („Eine Warteschlange, die sich aus dem Bestand
  bildet, kann eine Lücke nie schließen").

Gemessen: 2.142 Titel ohne Crunchyroll-Verweis, 304 mit Katalogtreffer, **75 davon in einem
Eintrag mit `de-DE`**. Nach den Riegeln (früher entfernt, tote Serienkennung, verneinender
Handbeleg) legt der Bau **33** an.

**Angelegt wird ohne Sprachurteil.** Die Tonspurliste des Katalogs gilt der Reihe, nicht der
Folge — Wegweiser, nicht Zeuge (dieselbe Trennung wie bei JustWatch, 10.09.2026). Das Urteil
holt der nächste `data:cr-dub`-Lauf, der den Verweis jetzt überhaupt erst sieht. Die Kette hat
am selben Tag durchgetragen: Katalog → Verweis → Dub-Lauf (16 offene Adressen) → alle fünf
Akito-Teile mit belegtem „DE ✓".

### Eine Folgenzahl am Weg braucht einen Sprachbeleg an genau diesem Weg

Am 16.09.2026 stand an der Prime-Pille von „Dragon Quest: Die Abenteuer von Dai" eine
Folgenzahl mit „DE", obwohl der Prime-Kanal nur Untertitel führt (Daniel, mit Bild). Die
deutsche Synchro gibt es nur auf Disc (DVD-Gesamtausgabe Folgen 1–75). Die Zahl gehörte der
**Reihe** — `folgenAngabeFuer()` fand sie über einen Verweis desselben Titels, nicht über den
Weg, an dem sie stand.

Seitdem zeigt eine Weg-Pille eine Folgenzahl nur, wenn ein Verweis mit **derselben Adresse**
`dub: true` trägt; sonst steht dort „DE ?". 160 Titel verloren damit eine Zahl, die nichts
über ihren Weg sagte. Dieselbe Trennung wie „Ein Beleg gehört einer Ausgabe, nicht einem
Titel" (07.09.2026), diesmal in der Anzeige.

### Die Folgenzahl einer Disc sagt der Herausgeber, nicht der Händler — die EAN verbindet beide

Animeversand führte die DVD-Gesamtausgabe von „Dragon Quest: The Adventure of Dai" mit
„Episoden: 1-75"; eingetragen, und im Panel stand „Folgen 76–100 führt kein bekannter
Anbieter". Daniel hatte den richtigen Verdacht („eig sind es 25 je volume"): Der Herausgeber
(crunchyroll-vertrieb.de) nennt für **dieselbe EAN** 100 Folgen, Volume 1 = 1–25. Ein
Händlerfeld ist eine Abschrift; vor einer Folgenspanne aus einem Shop wird die EAN beim
Verlag nachgeschlagen. Und aniSearch nennt auf Artikelseiten **keine** Folgen, nur Sprache,
Untertitel und EAN (geprüft 16.09.2026).

### Was MyDubList nicht kennt, kommt über `synchro-von-hand.yaml` in den Bestand

„Yu-Gi-Oh! Capsule Monsters" stand am 16.09.2026 als „Noch keine deutsche Fassung" hinter
dem Toggle. Die Serie wurde nie in Japan ausgestrahlt (4Kids-Auftragsproduktion), lief aber
auf RTL II und steht bei TOGGO — in der deutschen Zählung als **Staffel 6 von „Yu-Gi-Oh!",
Folgen 225–236** (fernsehserien.de). aniSearch führt sie gar nicht; der Suchlink im Panel
lief deshalb ins Leere.

Der Hauptbestand entsteht aus MyDubList, und für Titel, die dort fehlen, gab es keinen Weg
hinein — `watch-links.yaml` ergänzt nur, was schon da ist. `data/synchro-von-hand.yaml` ist
dieser Weg: zwei Quellen je Eintrag, `fetch.ts` holt die AniList-Daten mit, der Bau nimmt
den Titel auf.

**Prüfgriff bei „Noch keine deutsche Fassung" für einen alten Titel:** die deutsche Zählung
der Hauptreihe ansehen. Fernsehsender und Streamer zählen Nebenserien oft als weitere
Staffel mit — dasselbe Muster wie „Der Anbieter zählt kumulativ".

### aniSearchs deutsches Datum ist oft der Simulcast, nicht die Synchro

Der deutsche Sprachblock nennt die **erste** deutsche Veröffentlichung, und die ist bei neueren
Titeln der OmU-Simulcast. „Dragon Quest: The Adventure of Dai": „Synchronisiert, 03.10.2020 –
22.10.2022, Publisher: Crunchyroll, Kazé Deutschland" — die Marke sagt, dass es eine Synchro
gibt, Datum und erster Verlag gehören zum Simulcast, die Synchro zu Kazés Disc. Im Panel stand
„Auf Deutsch seit 03.10.2020 · Crunchyroll" (Daniel, 16.09.2026).

Gemessen: 375 Titel mit deutschem Datum höchstens sieben Tage neben dem japanischen Start und
einem Dienst als erstem Verlag, **119** ohne belegten Dub-Stream bei diesem Dienst. Dort fallen
Datum und Dienst weg, ein Disc-Verlag bleibt (`verlagAlsDienst()` in
`lib/anisearch-termine.ts`). Verweise, die der Bau erst später aus aniSearch ergänzt, sieht die
Regel nicht — dort fehlt dann höchstens ein Datum.

### Stream oder Disc entscheidet der Anbieter, nicht die Quelle

maxdome und freenet meinVOD standen am 16.09.2026 im Disc-Reiter: Die TMDB- und
JustWatch-Runden legten jedes Kauf- oder Leihangebot als `kind: 'buy'` an. Ein Kauf-Stream ist
aber ein Stream mit `zugang: 'kauf'`. `buy` bekommen nur physische Shops (`PHYSISCHE_SHOPS` in
`build.ts`). Wege mit einer themoviedb.org-Adresse bekommen den Direktlink aus JustWatch, wo
er bekannt ist — TMDB ist ein Verzeichnis, kein Anbieter.

**Und eine TMDB-Filmkennung, die mehreren Titeln gehört, belegt keinen.**
`mehrdeutigeFilmzuordnungen()` verwirft sie samt JustWatch-Angeboten. Achtung beim Nachmessen:
tv und movie haben **getrennte Nummernräume** — dieselbe Zahl ist dort zwei verschiedene Werke.
Die erste Zählung vermischte beide und kam auf 139, echt waren 5.

### Für den deutschen Namen gibt es drei Quellen — und die dritte heißt Nachsehen

Am 16.09.2026 standen 132 Titel ohne `titleDe` da, **57 davon mit belegter deutscher Fassung**
(Sprechrollen, deutsche Erstausgabe oder ein Verweis mit `dub: true`). Die haben einen Namen,
wir kannten ihn nur nicht. Gemessen, bevor gebaut wurde:

| Quelle | Ergebnis |
|---|---|
| aniSearch-Archiv, 54 der 132 liegen dort | 3 deutsche Sprachblöcke, **0 mit Namen** |
| TMDB `language=de-DE`, Stichprobe 15 | **0 Übersetzungen** — es fällt still auf den Originaltitel zurück |
| Wikidata über `P4086` (MAL-Kennung) | 29 Treffer, 6 brauchbare Kandidaten |

**Wikidata liefert Kandidaten, keine Titel.** Unter den deutschen Labels stehen vier Sorten,
und nur eine taugt:

```
Sorcerer Hunters: Heiße Früchtchen zum Vernaschen   der Verleihtitel        ✓
Bakuman.                     zu „Bakuman. 3"        der Reihenkopf          ✗
City Hunter/Staffel 4                               Wikipedia-Unterseite    ✗
Marudukku sukuranburu: Nenshou                      eine Romanisierung      ✗
```

**Die Richtung entscheidet beim Reihenkopf-Riegel**, und der erste Anlauf hatte sie falsch
herum: Er verwarf „Sorcerer Hunters: Heiße Früchtchen zum Vernaschen", weil der englische
Name darin steckt — das ist aber genau die **Erweiterung** um den Untertitel. Verworfen wird
nur das **kürzere** Label.

**Eingetragen wird von Hand, mit zwei Quellen**, in `data/titel-de.yaml`; der Bau liest sie vor
aniSearch und TMDB. Von sechs Kandidaten hielten drei der Prüfung stand (Cat’s Eye – Ein
Supertrio, Made in Abyss: Gefährten der Dämmerung, Aggretsuko), einer fiel mangels zweiter
Quelle durch. Das ist dieselbe Stufenfolge wie bei der Synchro — und derselbe Grund: Ein
deutscher Name, unter dem niemand sucht, ist schlechter als keiner (belegt am 01.09.2026 mit
„Yuu Gi Ou").

### Die Uhrzeit steht in der Start-Meldung, nicht in der Ankündigung

Am 16.09.2026 standen 13 künftige Netflix-Termine ohne Uhrzeit im Kalender (Thunder 3,
JoJo Steel Ball Run), gegenüber 65 von 89 bei Crunchyroll. Die Frage war, ob es dafür
überhaupt eine Quelle gibt. Gemessen:

| Quelle | Sendezeit genannt |
|---|---|
| Anime2You, „Simulcast gestartet" | **3 von 3** — „Weitere Episoden erscheinen jeden Samstag um 18:00 Uhr" |
| Anime2You, Ankündigung / Monatsübersicht / Season-Vorschau | 0 von 3 |
| die 25 Anime2You-Artikel, die bei uns als Quelle stehen | **0 von 25** |
| RSS-Auszug (alle drei Feeds, 75 Artikel) | 0 — der Auszug bricht vor dem Ablaufteil ab |
| Netflix selbst, zu Steel Ball Run | keine Angabe (whats-on-netflix, 16.09.2026) |

**Rückwirkend ist hier nichts zu holen, künftig schon** — und die Start-Meldungen fielen
bisher durch den Zukunfts-Filter des Vorschlagslaufs: Sie sagen „seit heute", nennen also
ein vergangenes Datum, und tragen die einzige Uhrzeitangabe, die es zu dieser Serie gibt.
Seit dem 16.09.2026 holt `scrape-anime2you.ts` bei Streaming-Meldungen mit Start-Signal den
Volltext nach (höchstens zwölf je Lauf) und legt gefundene Zeiten als Vorschlag vor —
dieselbe Ausnahme wie bei den Pausenmeldungen.

**Der Wochentag ist der Riegel.** Eine nackte Uhrzeit trifft die Zeitstempel der
Seitenleiste („Neueste News … 19:45 Uhr"): elf Fehlalarme je Seite, gemessen an acht
Artikeln, null davon mit Wochentag davor. Die Gegenprobe steht in `check:logic`.

**Die 13 Termine bleiben trotzdem ohne Uhrzeit**, und das ist die richtige Auskunft — die
Entscheidung von früher gilt unverändert: keine Faustregel als Uhrzeit eintragen. Die
„00:00 Pacific"-Regel für Netflix-Eigenproduktionen ist keine Angabe über diese Serie.

## Eine Störung ist kein Befund — und ein unplausibler Lauf schreibt nicht

Am 17.09.2026 auf Daniels Frage („die sicherung klingt gut, wie sieht es an unseren anderen
stellen aus?") alle Abrufe durchgesehen. Drei Wege entfernten Verweise aus einer
**Nichtauskunft**:

| Lauf | was passierte | jetzt |
|---|---|---|
| `check-youtube.ts` | jeder Fehler (Kontingent, Netz, Teilausfall einer Playlist) wurde als `inDE: 0` gespeichert, der Bau entfernte den Verweis | Störung wird `unklar: true`, der alte Befund bleibt; der Bau überspringt `unklar` |
| `scrape-crunchyroll-dub.ts` | antwortete die Content-API nicht, ersetzte der Fehlersatz den guten Eintrag; der Bau las „keine Staffel" und entfernte | ein Fehlersatz überschreibt keinen guten Eintrag |
| `fetch-justwatch-audio.ts` | eine verfehlte Namenssuche löschte alle Angebote | die alte Antwort bleibt, `verfehltAm` hält den Fehlgriff fest |

Dazu zwei stille Datenverluste ohne Entfern-Pfad: `fetch-voices.ts` schrieb bei einem
AniList-Ausfall `roles: []` über belegte Sprechrollen, `fetch-tmdb-titles.ts` ersetzte bei
einem Fehltreffer die gefundene `tmdbId` — an der JustWatch, die Streaming-Availability-Daten
und die Trailer hängen.

**Zwei Griffe, die jeder neue Abruf braucht:**

1. **Unterscheide „nicht gefunden" von „nicht gefragt".** Nur das Erste ist ein Befund. Alles
   andere lässt den alten Stand stehen — mit einem Vermerk, nicht mit einem Wert.
2. **Ein Mengen-Riegel vor dem Schreiben.** Ändert eine Quelle ihre Schnittstelle, sieht das
   aus wie „überall nichts". `fetch-justwatch-audio.ts` (25 % leere Treffer, 70 % ohne
   Treffer) und `check-youtube.ts` (50 % ohne Video) brechen dann ab, ohne zu schreiben; die
   Grundlinie steht als gemessene Zahl im Kommentar.

Wer einen Abruf baut, beantwortet beide Fragen im Code — nicht im Kopf.

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
- **Und am 15.09.2026 ein drittes Mal, bei AniList selbst.** `fetch.ts` holte nur fehlende
  Kennungen. Black Clover Staffel 2 blieb auf dem Abruf vom 03.09. („Oktober 2026", ohne Tag),
  obwohl AniList seit der Ankündigung vom 07.09. den 03.10. führt; `isoDate()` füllte den
  fehlenden Tag mit 31 auf, und das Panel zeigte „JP 31.10.2026" (Daniel: „wir haben anime2you
  geparsed, und wissen das es am 03.10. in japan erscheint"). Seitdem werden nicht
  abgeschlossene Titel bei jedem Lauf neu geholt, und die Anzeige bekommt das Datum nur so genau,
  wie die Quelle es kennt (`isoDatumGenau`). **Ein aufgefüllter Wert ist für eine Rechnung
  vorsichtig und als Anzeige erfunden** — wer ein Datum für beides benutzt, braucht zwei Felder.

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

**Und ein Folgendatum gibt Netflix gar nicht heraus — gemessen am 15.09.2026.** Seit 4.19.3 schickt `melder.js` je Folge jedes kleine Feld aus Folgenliste, Player und Reihe (`prime_folge.roh`). An den jüngsten Zeilen (`?rohfolgen=1&probe=netflix`) steht die Laufzeit zweimal (`liste.runtimeSec`, `player.runtime`), ein Erscheinungs- oder Ausstrahlungsdatum nirgends. `player.bookmark.watchedDate` ist der Sehverlauf des Kontos, kein Datum der Folge. Folgendaten für die Zuordnung kommen weiter von TMDB.

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

## Ein Notbehelf, der auf eine Suche zeigt, ist schlechter als kein Weg

Daniel am 10.09.2026, mit Bild: Für „Kaiju No. 8 Narumi's Week at Work" stand
im Kalender ein Crunchyroll-Verweis, der Klick landete auf
`crunchyroll.com/de/search?q=Kaiju%20No.%208%20Narumi's%20Week%20at%20Work` —
und dort auf **„Es konnte nichts gefunden werden"**. Seine Ansage: „alle links
die auf such query gehen, statt direkt auf treffer, müssen entfernt werden von
der webseite."

Der Verweis war absichtlich so gebaut. `build.ts` machte aus einer pfadlosen
Adresse eine Suche mit unserem Titel als Suchbegriff, mit der ausdrücklichen
Begründung, ein Verweis sei besser als keiner. **Er ist es nicht:** Ein Weg,
der aussieht wie eine Auskunft und auf eine leere Trefferliste führt, kostet
den Besucher einen Klick und die Seite ihre Glaubwürdigkeit. Ein fehlender Weg
sagt „wir wissen es nicht" — dieselbe Unterscheidung, die dieses Projekt bei
`dub: false` gegen `dub: undefined` längst zieht.

**Und die richtige Adresse lag im Repo.** `data/cr-katalog-de.json` (seit dem
22.08.2026, 1.656 Serien) führt „Kaiju No. 8" unter `GG5H5XQ7D`/`kaiju-no-8` —
Zeichen für Zeichen die Adresse, die Daniel danach von Hand herausgesucht hat.
Sechster Fall der Klasse im Abschnitt darunter.

**Warum ein Namensabgleich hier zulässig ist**, wo er sonst zu Recht als
untauglich gilt (`To Love-Ru`, `Wolf's Rain OVA`): Die Frage ist eine andere.
Nicht „läuft dieses Werk dort?", sondern „unter welcher Adresse liegt das Werk,
von dem wir schon wissen, dass es dort läuft?" — der Verweis steht bereits samt
Sprachurteil, ersetzt wird nur seine kaputte Adresse. Dieselbe Trennung wie bei
JustWatch am selben Tag: eine Quelle, die als Zeuge nicht taugt, taugt als
Wegweiser.

Der Reihenkopf ist dabei die **richtige** Antwort, nicht die zweitbeste: Eine
Crunchyroll-Serienseite führt alle Blöcke einer Reihe, bei Kaiju No. 8 sind das
„Season 1 · Mission Recon · Season 2 · Narumi's Week at Work" unter einer
Adresse.

### Der Rückkanal ist die eigentliche Falle

Die Suchadresse wieder loszuwerden war schwerer als gedacht, und der Grund ist
allgemein: **Was der Bau erzeugt, kommt über die Quellen zurück.** Ein früherer
Lauf hat die erzeugte Adresse aus dem Datensatz nach
`data/crunchyroll-series-ids.json` übernommen; von dort liest der Bau sie
wieder ein. Die Erzeugung abzuschalten genügt deshalb nicht — sie muss auch
dort entfernt werden, wo sie inzwischen gespeichert ist.

**Prüffrage, wenn eine erzeugte Angabe verschwinden soll:** *Hat sie in der
Zwischenzeit den Weg in eine Quelldatei gefunden?* Ein `grep` über `data/`
beantwortet das in Sekunden und spart die Runde Fehlersuche, in der die Zeile
„trotz Fix immer noch da" heißt.

### Zwei Aufgaben, zwei Stellen

Repariert wird **früh** (eine pfadlose Adresse überlebt die nachfolgenden
Runden nicht — sie fliegt als kaputter Verweis heraus, und dann gibt es nichts
mehr zu reparieren), entfernt wird **spät** (dazwischen ersetzen andere Runden
Suchadressen noch durch echte Titelseiten aus Daniels Meldungen; wer sie vorher
wegwirft, nimmt ihnen die Gelegenheit). Ein erster Anlauf mit nur einer Stelle
warf **230 statt 43** Adressen weg — die Differenz waren genau die, die eine
spätere Runde noch aufgelöst hätte.

Was übrig bleibt, wechselt den Ort statt zu verschwinden:
`daniel-zum-abarbeiten/listen/18-suchadressen.md`. Bei Prime kann die Frage niemand
anders beantworten — Amazons robots.txt sperrt 19 Bots namentlich, und die acht
Adressen, die aniSearch dazu kennt, stehen im Link-Check auf `unklar`.

**Wer einen Wert umzieht, zieht jeden Leser mit.** Die Statusanzeige las ab dem
10.09.2026 `data/suchadressen-offen.json`, die Prüfliste der Erweiterung
(`tools/extension-offene-amazon.mjs`) weiter die Verweise im Datensatz, in
denen keine Suche mehr stand. Sechs Tage lang zeigte die Statusanzeige
„Suchadressen 1", die Erweiterung kannte keine, und auf Amazons Suchseite stand
kein Kasten (Daniel, 16.09.2026, Yu-Gi-Oh! Capsule Monsters). Prüfgriff beim
Umzug: `grep` nach dem **alten** Fundort (hier `/\/s\?/` über `t.streams`).

## Eine Datei zu schreiben ist nicht dasselbe wie sie zu benutzen

Am 06. und 07.09.2026 sind an zwei Tagen **fünf** Fälle derselben Art
aufgefallen. Jedes Mal war die Auskunft erhoben, lag im Repo, war committet —
und keine Zeile Code las sie:

| Fall | was dalag | wie lange |
|---|---|---|
| Handbeleg | ein **bejahendes** `dub: true` sperrte die Ergänzung, statt sie auszulösen | seit dem ersten Riegel |
| `data/adn-adressen.yaml` | sechs ADN-Serienkennungen, am Vortag von Hand belegt | 1 Tag |
| `data/cr-katalog-de.json` | 1.589 Einträge des deutschen Katalogs mit Tonspuren | 5 Tage |
| `data/rtlplus-befunde.json` | zwei tote Adressen als `lebt: false, aufStartseite: true` | 16 Tage |
| aniSearchs Sprachblock | deutsche Veröffentlichung mit Verlag — der Bezugsweg für 246 Titel | seit jeher |

Zusammen waren das an einem Vormittag: 13 Verweise mit Sprachurteil, 10 tote
Adressen berichtigt und **246 Titel, die aus „kein Anbieter bekannt" einen
belegten Bezugsweg bekamen** — ohne einen einzigen neuen Abruf.

**Die Gemeinsamkeit ist nicht Nachlässigkeit, sondern die Bauform.** Ein Lauf
schreibt eine Datei, der Commit belegt die Arbeit, die Quellen-Frist in
`check-sources.ts` bleibt grün — und ob die Daten je gelesen werden, prüft
niemand. **Ein Abruf ohne Leser sieht in jeder Statistik genauso aus wie einer
mit.**

Dieselbe Klasse steht schon zweimal weiter oben, nur je an einem Einzelfall
festgemacht: „Ein neues Feld ist erst eingebaut, wenn es am Ziel angekommen ist"
(28.08.2026) und „Wer unten ergänzt, muss unten auch beurteilen" (06.09.2026).
Fünf Fälle in zwei Tagen machen daraus ein Muster.

**Der Prüfgriff ist ein Einzeiler** — für jede Datendatei zählen, wer sie
außerhalb ihres eigenen Schreibers nennt:

```bash
ls data/*.json data/*.yaml | while read f; do
  n=$(grep -rl "$(basename "$f")" pipeline/ tools/ worker/src web/src shared 2>/dev/null | wc -l)
  printf "%-38s %s\n" "$(basename "$f")" "$n"
done | sort -k2 -n | head -20
```

Was oben mit **0 oder 1** steht, ist verdächtig: null heißt niemand, eins heißt
meist der Schreiber selbst. Genau so sind `cr-tiefensuche.json` (0) und
`cr-katalog-de.json` (1) aufgefallen.

**Ein Werkzeug daraus zu machen, ist am 07.09.2026 gescheitert** — nach sechs
Anläufen verworfen. Die Unterscheidung „Zugriff im Code" gegen „Erwähnung im
Kommentar" ist in diesem Projekt schwer zu ziehen: Pfade stehen in Kommentaren
regelmäßig in Backticks, Blockkommentare brechen ohne `*`-Präfix um, und
`data` als Ordnername kommt in fast jeder Datei vor. Jede Fassung war entweder
blind oder voller Fehlalarme, und **nur die Gegenprobe hat das gezeigt** (den
echten Leser entfernen — die Prüfung muss anschlagen). Der Einzeiler oben ist
ungenauer und trägt trotzdem, weil ein Mensch die zwanzig Zeilen liest.

**Die Prüffrage gehört an jeden neuen Abruf**, neben die drei aus dem Abschnitt
„Ein neuer Abruf braucht drei Dinge": *Wer liest, was er schreibt — und steht
dessen Name irgendwo im Code?*

## Eine Summe belegt, dass es passt — nicht, dass es die richtigen sind

Am Vormittag des 10.09.2026 ist die kumulative Rechnung eingebaut worden, und
sie hat vier Netflix-Adressen aufgelöst. Am Nachmittag hat dieselbe Rechnung
vier **falsche** Belege erzeugt.

Die Prime-Seite `B0D2NL5GYX` ist Haikyu!!s Staffel 4 mit 27 Folgen:

```
richtig:  TO THE TOP 13 + LAND VS. AIR 2 + Part 2 zwölf   = 27
gebucht:  Special 1 + 3rd Season 10 + Special 1 + TO THE TOP 13 + LAND VS. AIR 2 = 27
```

**Beide Summen ergeben 27.** Bei einer Reihe mit neun Einträgen gibt es mehrere
Teilmengen mit derselben Summe, und die erste gewinnt. Die Folgenzahl-Kontrolle
merkte nichts — sie prüft, **dass** es aufgeht, nicht **welche** Titel es sind.

**Die Ursache war ein Nebeneffekt:** `staffelnDerAdresse()` führt seit demselben
Vormittag OVAs und Specials mit. Für `ordneNachStaffelliste()` ist das richtig
— es rechnet über Folgenzahlen und braucht sie. Ein zweiter Block liest
dieselbe Liste aber als **Staffelfolge** (`reihe.slice(staffelNr - 1)`), und
dort verschiebt jede Nebenausgabe den Index um eins.

**Die Regel, und sie gilt über diesen Fall hinaus:**

> **Wer über einen Index zugreift, braucht eine andere Liste als wer rechnet.**
> Dieselbe Funktion für beides zu benutzen sieht sparsam aus und koppelt zwei
> Fragen, die nichts miteinander zu tun haben. Ändert sich die Liste für die
> eine, kippt lautlos die andere.

**Und der Prüfgriff nach jeder Änderung an einer geteilten Liste:** Wer liest
sie noch, und **wie** — nach Position oder nach Inhalt? Ein `slice`, ein
`[i]`, ein `.length` gegen eine Nummer sind Positionszugriffe; sie vertragen
keine neuen Einträge in der Mitte.

Der Schaden war hier gering, weil die Handbelege eine Datei sind, die man lesen
kann. Bei einem Wert im Datensatz wäre er unsichtbar geblieben — vier Staffeln
mit einem Urteil, das nie jemand für sie geprüft hat.

## Der Anbieter zählt kumulativ — Position gegen Position ist keine Zuordnung

Am 10.09.2026 fand Daniel „Haikyu!! Lev ist hier!" bei Netflix unter
`/watch/81308427`; der Zurück-Pfeil führte auf **Staffel 1, Folge 26**. Die OVA
ist dort keine eigene Staffel — sie hängt am Ende der Staffel, zu der sie
gehört. Unsere Prüfliste wollte ihn gerade „gibt es hier nicht" melden lassen.

**Die Rechnung stand seit dem 22.08.2026 als Kommentar im Code:** „Netflix
meldet 26 + 26 + 11 + 27 = 90 Folgen, unsere Fernsehstaffeln haben 85, die vier
OVA-Einträge zusammen fünf." Gezogen wurde daraus nur der Schluss, die OVAs zu
**verstecken** — nicht der, sie zuzuordnen.

Die Zuordnung paarte stattdessen Position gegen Position und verglich die
Folgenzahlen nur auf „Abstand höchstens 3". Bei Haikyu!! passte **keine**
einzige Position (25↔26, 25↔26, 10↔11, 13↔27), und drei exakte Treffer deckten
die vierte Abweichung. Der überzählige fünfte Eintrag — „TO THE TOP Part 2",
zwölf Folgen — galt als nicht geführt und bekam `available: false`. In Wahrheit
steckt er in Netflix' Staffel 4: **27 = 13 + 2 + 12**.

**Der Schaden lief in drei Stufen**, und die dritte macht die Klasse aus:

| Stufe | was geschah |
|---|---|
| 1 | Ein echter Verweis wurde entfernt (22.08.2026), mit einer Notiz, die wie eine Prüfung aussieht |
| 2 | Ohne ihn ging die Folgenrechnung nicht mehr auf (78 statt 90) |
| 3 | Vier OVAs blieben unzuordenbar — und der nächste Schritt wäre gewesen, sie **auch** wegzumelden |

Sechs solcher Belege standen in `dub-confirmed.yaml`, alle nach demselben
Muster: eine Fortsetzung, die der Anbieter der Vorstaffel zurechnet (SAO
Alicization War of Underworld und Part 2, BEASTARS Final Season Part 2,
Dr. STONE New World und Part 2, HAIKYU!! Part 2).

**Richtigstellung vom 11.09.2026: Bei SAO stimmte der Schluss nicht.** Daniel
hatte am 06.09. das Netflix-Dropdown abgebildet: genau zwei Staffeln, SAO (25)
und SAO II (24), alle 49 Folgen gemessen. 25 + 24 geht mit SAO und SAO II
**exakt** auf; War of Underworld hat dort keinen Platz. Die beiden
„nicht vorhanden"-Belege sind wiederhergestellt. Die Regel oben bleibt richtig
— sie verlangt, dass die Summe aufgeht, und das tat sie bei SAO mit anderen
Titeln. Zurückgenommen wurde am 10.09. also ein Beleg, dessen Gegenprobe
(welche Titel füllen die Staffeln?) niemand gerechnet hat.

**Und das Gedächtnis entfernter Verweise muss Adresse und Titel trennen.** Die
Platzprüfung warf War of Underworld zu Recht hinaus, das Gedächtnis merkte sich
aber nur die Adresse — und sperrte damit SAO II, dem sie gehört. Die Prüfliste
flatterte von Bau zu Bau. Seit dem 11.09.2026 gelten „kein Platz" und „andere
Reihe" nur für den einen Titel (`NUR_DIESER_TITEL` in `build.ts`), tote
Adressen weiter für alle.

**Die Regel, die daraus folgt:**

> **Ein Anbieter teilt anders als AniList — aber er zählt lückenlos.** Unsere
> Titel liegen der Reihe nach in seinen Staffeln. Geht eine Staffel als **Summe
> exakt** auf, ist die Zuordnung belegt, und jeder Titel kennt seine erste
> Folgennummer dort. Geht sie nicht auf, wird nichts behauptet.

Die Summe ist der belastbare Anker, nicht die Position und nicht die einzelne
Zahl. Und die Umkehrung gilt genauso: **„Keine eigene Staffel" heißt nicht
„läuft dort nicht".** Bevor ein Titel als nicht geführt gilt, wird
nachgerechnet, wie viele Folgen der Anbieter mehr führt, als die gepaarten Titel
hergeben — passt der überzählige in diesen Platz, ist er dort.

Wirkung am selben Tag: Vier von sechs offenen Netflix-Adressen lösten sich auf,
ohne einen einzigen Abruf. „Dorohedoro: Teuflische Anekdoten" ist S1 E13,
„Hi Score Girl: Extra Stage" S1 E13–15, „BAKI-DOU Part 2" S1 E14–25.

## Eine fremde Quelle taugt als Wegweiser, auch wo sie als Zeuge nicht taugt

Am 07.09.2026 ist entschieden worden, dass aus JustWatchs Tonspurangabe **kein**
`dub` wird: Sie gilt der Serie, nicht der Folge, und unser Kalender antwortet je
Ausgabe. Die Entscheidung steht.

Am 10.09.2026 hat dieselbe Datei trotzdem einen Verweis geklärt — über etwas
anderes, das nebenbei darin steht:

```json
{ "anbieter": "Crunchyroll", "audio": ["de", "en", "ja"],
  "url": "https://www.crunchyroll.com/watch/GVWU0Q527" }
```

Unser eigener Verweis lautete `crunchyroll.com/de/sword-art-online` — ein Slug
aus der Frühzeit, der auf die **Reihe** zeigt, während unser Titel die EXTRA
EDITION ist. Aus einem Slug wird kein Urteil. Aus der Kennung daneben schon:
Damit greift der Zweig, der ohnehin der beste ist, und Crunchyroll nennt selbst
die Fassungen dieser Folge.

**Der Unterschied ist nicht die Quelle, sondern die Frage an sie.** „Läuft das
auf Deutsch" beantwortet JustWatch schlechter als der Anbieter selbst. „Wo genau
liegt das beim Anbieter" beantwortet JustWatch besser als unser Altbestand — und
diese Antwort ist überprüfbar, weil die erste Hand danach gefragt wird.

**Prüffrage vor jedem „diese Quelle taugt nicht":** Taugt sie *für diese eine
Angabe* nicht — oder für gar nichts? Eine verworfene Quelle wird sonst zweimal
verworfen: einmal zu Recht, einmal zu Unrecht.

**Und geliehene Kennungen belegen nur sich selbst.** Der erste Lauf lieferte den
Gegenfall sofort mit: Für „Okko's Inn" nennt JustWatch `GWDU8PMGG`, Crunchyroll
kennt die Kennung nicht mehr — und der Code hätte daraus `herkunft: 'tot'`
gemacht und **unseren** Verweis auf `/okkos-inn/…` entfernt, der davon
unberührt ist. Ein 404 gilt dem Verweis, der die Kennung selbst trägt; alles
andere ist ein Schluss von einer fremden Adresse auf die eigene.

## Wer eine Datei anwendet, muss hinter jeder Stelle stehen, die Verweise anlegt

Am 10.09.2026 dreimal in zwei Stunden derselbe Fehler, jedes Mal an einer
anderen Stelle — und alle drei sahen aus wie „die Quelle weiß es nicht":

| Fall | was dastand | was fehlte |
|---|---|---|
| 11 Verweise mit `herkunft: 'tot'` | der Bau **zählte** sie und schrieb daneben, sie flögen „weiter unten über dieselbe Regel" | die Regel läuft über `crDub.serien` und kennt diese Adressen nicht |
| „Millennium Actress" | die Serienadresse flog raus, aniSearch legte `…/watch/GPWUKPVP4/…` neu an | der Riegel `toteCrAdressen` kannte nur `crDub.serien` |
| drei fertige Urteile (2× `false`, 1× `true`) | standen in `crunchyroll-offene.json` | die Nachrunde beurteilt über `crNachUrl` — dort stehen frisch ergänzte Adressen nie |

**Die gemeinsame Ursache ist keine Nachlässigkeit, sondern die Reihenfolge.**
`build.ts` beurteilt oben und ergänzt unten. Jede Auswertung, die oben steht,
sieht nur, was zu ihrem Zeitpunkt dastand — und jede Adresse, die unten entsteht,
ist für sie unsichtbar. Das steht seit dem 06.09.2026 als „Wer unten ergänzt,
muss unten auch beurteilen" in dieser Datei; die Nachrunde tut es auch, nur mit
**ihren** Quellen (Handbeleg, `crNachUrl`, ADN-Archiv). Kommt eine vierte Quelle
dazu, muss sie an **beiden** Stellen stehen.

**Der Prüfgriff nach jeder neuen Befundquelle**, und er kostet zwei Minuten:

> Die Datei in `build.ts` suchen. Steht ihr Name **einmal** da, ist sie
> vermutlich falsch eingebaut — ergänzt wird an zwei Stellen, angewandt an
> zweien.

**Und das Symptom ist immer dasselbe**, weshalb es dreimal gedauert hat: Ein
Verweis ohne Urteil sieht aus wie eine ungeklärte Frage. Dass die Antwort längst
im Repo liegt, sieht man ihm nicht an — nur der Vergleich zwischen Lauf-Log und
Datensatz zeigt es („17 offen" gegen „28 im Datensatz"). Wo diese beiden Zahlen
auseinandergehen, ist die Ursache nie die Quelle.

Wirkung an einem Vormittag: Crunchyroll von 28 auf 11 Verweise ohne
Sprachurteil, ohne einen einzigen neuen Abruf.

## Die Linkprüfung maß Amazons Shop-Adresse, nicht die Video-Seite

Am 18.09.2026 stand der Bau rot: `check:tote-adressen` fand Horimiya und Mob Psycho 100 mit
Adressen, die als tot belegt waren — eine Stunde, nachdem Daniel beide Seiten besucht und
gemeldet hatte. `/dp/B0CH8YTK4T` antwortet mit 404 „Seite wurde nicht gefunden",
`/gp/video/detail/B0CH8YTK4T` mit „Mob Psycho 100 – Staffel 1 ansehen". Amazon führt viele
Prime-Titel **nur** als Video-Seite.

Gemessen an einer Zufallsstichprobe der 403 als tot geführten `/dp/`-Adressen: **11 von 11**
erreichbaren lebten unter der Video-Adresse. Der Bau hatte die zugehörigen Verweise über Wochen
entfernt — lokal nachgemessen kamen danach 39 Prime-Verweise und rund 218 Kaufwege zurück.

Seitdem prüft `check-links.ts` einen `/dp/`-404 an der Video-Seite derselben Kennung nach —
**nur als zweiten Versuch**, denn DVDs und Blu-rays gibt es nur unter `/dp/`. Die alten Befunde
sind auf `unklar` zurückgestuft.

**Die Prüffrage bei jedem Befund „tot":** *Habe ich die Seite gefragt, die ein Besucher öffnet —
oder eine andere Form derselben Kennung?* Ein Anbieter mit zwei Adressformen antwortet nicht für
beide gleich.

**„Echte Auskunft“ des Link-Checks (25.10.2026):** Eine Regel, `istAuskunft` in `pipeline/lib/link-befund.ts`
(dort auch `istTot`: 404/region). Als Auskunft zählt ein HTTP-Status unter 500 außer 403/429, dazu
`region`; 5xx (503 = Dienst nicht erreichbar), `unklar`, `timeout`, `fehler` zählen nicht. Ein Lauf, der
nur 5xx liefert, meldet „nur Nichtauskünfte“ statt gesund. Stand `data/link-check.json`: 96 Einträge mit 503.
Ein 5xx-Befund wird beim nächsten Lauf fällig (`istFaellig` in `link-befund.ts`, wie `unklar`), nicht erst nach 30 Tagen. Drankommen heißt das noch nicht: der Wochenlauf in `refresh-weekly.yml` nimmt mit `--limit 400` die ältesten `geprueftAm` zuerst, und 5xx hat keinen Vorrang. Stand 25.10.2026 kommt keiner der 75 neu fälligen 503-Links in den nächsten Lauf (3.197 ältere stehen davor); die Änderung wirkt erst, wenn der Rückstand abgebaut ist. Alle 96 503-Befunde sind `www.amazon.de` (Bot-Abwehr, kein Ausfall) und zählen nicht für `SPERR_SCHWELLE` (zählt nur `unklar`).

## Eine falsche TMDB-Kennung verteilt fremde Wege über den ganzen Titel

Daniel am 17.09.2026 an „Your Name.": „appletv pill führt zu #2 (bug? wie ist dieser
verweis entstanden, symptom eines größeren problems?)". Der Verweis führte zu einem
anderen Film, und die Kette dahinter beginnt eine Ebene tiefer.

`fetch-tmdb-titles.ts` maß die Titelähnlichkeit gegen den **kürzeren** der beiden Namen.
„Your Name." steckt vollständig in „Call Me by Your Name" — Ähnlichkeit 1,0, und die
Kennung 398818 wurde gespeichert. An der Kennung hängt alles Weitere: JustWatch-Angebote,
Trailer, die Streaming-Availability-Daten und über `justwatchUrl` die Bezugswege. Ein
einziger Zuordnungsfehler erzeugt damit eine ganze Reihe plausibel aussehender Wege zu
einem fremden Werk.

Drei Griffe, alle am selben Tag gemessen:

- **Geteilt wird durch den längeren Namen** (`Math.max`), Schwelle 0,75. Bei Gleichstand
  gewinnt der bekanntere Treffer (`vote_count + popularity`) — der erste Fix landete sonst
  auf einem leeren Eintrag (553301) statt auf 372058.
- **Ein Fehltreffer behält die alte Zuordnung.** Vorher ersetzte ein leerer Suchlauf die
  gefundene `tmdbId`, und mit ihr alles, was daran hängt.
- **Der Altbestand wird nachgemessen, nicht gehofft.** `tools/tmdb-teilstueck-treffer.mjs`
  holt zu jeder gespeicherten Kennung die echten Titel und meldet genau dieses Muster
  (unser Titel ⊂ fremder Titel, fremde Zusatzwörter **vorn**). Über den Bestand: 16
  Verdachtsfälle, 15 davon legitime Präfixe („Wind Breaker: Staffel 2" ⊂ „Wind Breaker").

**Und ein Befund, der gegen die falsche Kennung entstanden ist, ist hinfällig.**
`fetch-justwatch-audio.ts` speichert deshalb auch am Fehlschlag die Kennung, gegen die er
lief, und fragt sofort neu, sobald sie abweicht — sonst hielte ein „nichts gefunden" die
Wiedervorlage 28 Tage auf, obwohl es einen anderen Film meinte.

**Die Prüffrage bei jedem Verweis, der zum falschen Werk führt:** *Welche Kennung hat ihn
erzeugt, und wer hängt noch an ihr?* Ein falscher Link ist selten ein Einzelfall — er ist
das sichtbare Ende einer Zuordnung.

### Ein Special erbt die TMDB-Hauptserie nicht — auch nicht im Sammler (12.10.2026)

Der TMDB-Durchlauf vom 12.10. (05:30) ordnete drei aniSearch-Specials (Fate/Stay Night UBW Prologue, SAO Alternative GGO Refrain,
Slime: Veldora’s Journal; Titel-ID ≥ 10.000.000) den Hauptserien tv/61415, 78204 und 82684 zu; im Bau trugen sie deren Anbieterwege,
und der Bestandsbau wurde rot. Die Bau-Sperre `sperreSerienTreffer` (`lib/treffer-erben.ts`) kennt nur AniList/MAL-Titel (`medien`), nicht
die aniSearch-only-Titel — und `fetch-tmdb-titles.ts` suchte jedes Nicht-MOVIE-Format unter `search/tv` und nahm den besten Namenstreffer.

- **Regel im Sammler** (`lib/tmdb-hauptserie.ts`, am Ende von `fetch-tmdb-titles.ts`): SPECIAL/OVA/ONA/MUSIC, deren TMDB-Serie auch ein
  TV/TV_SHORT-Titel unseres Bestands trägt, verlieren die Kennung samt Handlung, FSK und Anbietern (Eintrag wird `miss`, Wiedervorlage
  nach 7 Tagen) — außer Name (`nameDe` = englischer/Romaji-Name) oder Folgenzahl (`tmdb-folgen.json`) passen oder `tmdb-von-hand.yaml`
  führt den Titel. Dieselbe Prüfung wie im Bau (`darfTrefferErben`), nur eben vor dem Speichern und für alle Titel.
- **Movie:** unverändert, `search/movie` kann keine Serienkennung liefern.
- **Bestand 12.10.2026:** 45 Titel gestrichen (22 OVA, 22 SPECIAL, 1 ONA), 42 AniList-Titel, die der Bau ohnehin sperrte, und die drei aniSearch-only.
- **Reste entfernt (12.10.2026, Folge-PR):** `tmdb-poster.json` (42), `tmdb-banner.json` (45), `tmdb-folgen.json` (8), `justwatch-audio.json` (42)
  führten für diese Titel Kopien der Hauptserie (Bilder byte-gleich mit dem TV-Titel, JustWatch-Befund derselben `jwId`). Gestrichen; die Titel
  fallen auf das AniList-Cover und -Banner zurück, wo AniList keins hat (18 Titel, dazu die drei aniSearch-only) auf die Banner-Lückenliste. Poster-`null`
  (die drei aniSearch-Titel) bleibt. `check-tmdb-hauptserie.ts` hält fest: Banner und Folgenliste nur mit der Kennung aus `tmdb-titles.json`.
  Neue Abrufe kommen nicht mehr dazu (jeder Sammler geht von einer Kennung in `tmdb-titles.json` aus).
- **Offen:** Die Bau-Sperre für Titel ohne Eintrag in `medien` (aniSearch-only) ist weiter nur durch PR 906 (`13-3-1-tmdb-wege.ts`) für die Wege gedeckt.

### Eine Überschrift ist keine Sprachangabe — der aniSearch-Titelabruf taugt nur für den Katalog

Am 01.09.2026 lag der Schluss nahe: 139 Titel **mit** belegter deutscher Synchro
tragen keinen deutschen Namen, 56 davon haben eine aniSearch-Kennung, und
`fetch-anisearch-titel.ts` holt genau solche Seiten. Also den Hauptbestand in
die Warteschlange, fertig.

Der Lauf ist durchgelaufen, der Bau hat 30 Titel übernommen — und das Ergebnis
war **schlechter als die Lücke**:

| unser Titel | was ankam |
|---|---|
| Yu☆Gi☆Oh! | „Yuu Gi Ou" |
| Mobile Suit Gundam Wing: Endless Waltz | „Gundam Wing Endless Waltz OVA" |
| Pocket Monsters Diamond & Pearl | „Pocket Monsters: Diamond &amp; Pearl …" |

Romaji, englische Namen, HTML-Entities. **Die `<h1 id="htitle">` einer
aniSearch-Seite ist der Haupttitel, nicht der deutsche** — sie trägt keine
Sprachkennzeichnung, und aniSearch wählt dort die gebräuchlichste Schreibweise.
Beide Commits sind zurückgenommen.

**Für den Katalog hinter dem Toggle bleibt der Abruf richtig.** Dort steht sonst
gar nichts, und ein Romaji-Titel ist besser als keiner — 938 der 15.118
Katalogtitel haben so überhaupt erst einen Namen bekommen. Im Hauptbestand
überschreibt derselbe Wert die Suche mit einem Namen, unter dem niemand sucht.

**Die allgemeine Form, und sie ist teurer als sie aussieht:** Zwei Bestände mit
derselben Lücke brauchen nicht dieselbe Quelle. Was für den einen ein Gewinn
ist, ist für den anderen ein Rückschritt — und das entscheidet nicht die Lücke,
sondern was an ihrer Stelle stünde. Hier: nichts gegen einen falschen Namen.

**Was den Fehler sichtbar gemacht hat, war die Stichprobe nach dem Einbau.** Die
Zahl allein sah gut aus (139 → 109); erst die Liste der 29 übernommenen Titel
zeigte, was darin steht. Eine Zahl, die sich in die gewünschte Richtung bewegt,
ist kein Beleg für die Qualität dessen, was sie zählt.

### Ein HTTP 200 von Amazon heißt nicht, dass es die Seite gibt

Daniel meldete am 07.09.2026 vier tote Verweise am selben Werk — „aniverse pill
hier führt auf toten link", dann Staffel 4, dann Staffel 3 — und stellte die
Frage, auf die es ankam: **„kannst du das auch selbst mitbekommen und evtl
generisch fixen? weil ich nicht alle manuell prüfen kann."**

Die Antwort stand im eigenen Bestand. Für `amazon.de/dp/B0C9VS255F` führte
`data/link-check.json` **HTTP 200, geprüft am 24.08.2026**. Derselbe Abruf am
07.09.2026 antwortete mit 404 und dem Titel „Seite wurde nicht gefunden" — die
ASIN gab es schon damals nicht. Amazon hatte beim Massenlauf eine Zwischenseite
ausgeliefert: Status 200, 2.299 Zeichen, kein Produktinhalt. Der Lauf buchte das
als „Adresse lebt", und damit war sie dreißig Tage lang nicht mehr fällig.

**Das Muster ist älter als der Fall.** Dieselbe Datei trägt seit dem 20.08.2026
einen Kommentar darüber, dass Amazon bei Massenläufen Zwischenseiten schickt —
er stand am Feld `prime` und galt einem Zusatzbefund. Dass derselbe Abruf auch
den **Status** wertlos macht, hat niemand zu Ende gedacht. Eine Lehre, die nur
an der Stelle steht, an der sie entdeckt wurde, trägt nicht bis zur nächsten.

**Zwei Riegel, und sie wirken nur zusammen** (`pipeline/check-links.ts`):

- `PRODUKTSEITE` — eine echte Detailseite trägt `dp-container`, `productTitle`,
  `av-detail-section` oder „| Prime Video" im Titel. Fehlen alle bei einem 200,
  war es keine Produktseite.
- `status: 'unklar'` statt eines Befunds, **und** `unklar` gilt in der
  Fälligkeit als ungeprüft. Ohne den zweiten Teil wäre der erste nur eine andere
  Schreibweise für denselben Falschbefund — dreißig Tage Ruhe für eine tote
  Adresse.

Dazu erkennt `NICHT_GEFUNDEN` Amazons Fehlerseite am Wortlaut, denn sie kommt
nicht immer mit 404.

`check-logic.ts` hält beide Riegel fest („ein Amazon-200 ohne Produktseite gilt
nicht als lebende Adresse"). Ein Kommentar hält niemanden auf, der die Stelle
umbaut.

**Die allgemeine Form:** Bei einer Quelle mit Bot-Abwehr ist der Statuscode
keine Auskunft über die Adresse, sondern über den Abruf. Belastbar wird er erst
mit einem **positiven Merkmal im Inhalt** — und was dieses Merkmal nicht zeigt,
gehört als offene Frage gespeichert, nie als Ja.


### Die Crunchyroll-Fragezeichen liegen an der Zuordnung, nicht an der Quelle

Daniel am 07.09.2026 zur „Wo sehen?"-Liste: „39 Fragezeichen? wir haben
crunchyroll automatisiert, es sollte 0 fragezeichen geben, wieso funktioniert
unser automatismus nicht perfekt..."

Gemessen: 35 Crunchyroll-Verweise ohne Sprachurteil — 18 MOVIE, 4 OVA, 1
SPECIAL, 12 TV.

**Die erste Erklärung war falsch, und das gehört hierher.** Weil
`data/cr-katalog-de.json` in jedem Eintrag `typ: series` trägt, lag der Schluss
nahe, der Katalog kenne keine Filme. Er stand schon als Lehre geschrieben, als
die Messung ihn widerlegte: `discover/browse?type=movie_listing` meldet 69
Filme, davon 44 mit deutschem Ton — und **alle 69 stehen bereits im
gespeicherten Katalog**. Crunchyroll gibt in `it.type` schlicht für jeden
Eintrag `series` aus; unser Feld übernimmt das ungeprüft. Die Quelle ist
vollständig, das Etikett ist es nicht.

Die Lehre daraus ist die ältere: **Ein Feld, das überall denselben Wert trägt,
beschreibt nichts** — es ist die Vermutung wert, dass es gar nicht gefüllt wird.
Bevor eine Lücke der Quelle zugeschrieben wird, wird die Quelle gefragt.

**Woran es wirklich liegt:** Crunchyroll führt Filme unter Kurznamen. „Fruits
Basket -prelude-" heißt dort „-prelude-", „Free! -Timeless Medley- Kizuna"
heißt „The Bond". Von 23 Film-, OVA- und Special-Verweisen ist über den Titel
genau **einer** zuzuordnen. Ein Namensvergleich löst das nicht und darf es auch
nicht: Ein Namensteil trifft immer den Reihennamen, und die Serie vererbt ihre
Sprache nicht an ihre Filme (fünf „Free!"-Filme zeigen auf die Serienadresse,
die Chunibyo-OVA auf ihre Serie, „Promised Neverland Staffel 2" auf Staffel 1).

**Der tragfähige Weg ist die Kennung in der Adresse, und er ist gemessen.**
`content/v2/cms/objects/<Kennung>?locale=de-DE` löst eine `/watch/<ID>/`-Adresse
auf und nennt die Tonspur **des Videos** — nicht die Liste der verfügbaren
Sprachen. An sechs Fällen geprüft (07.09.2026):

| Titel | Kennung | Antwort |
|---|---|---|
| given: To the Sea | `GE00266947DEDE` | `audio_locale: de-DE`, Serie `GRG5WWD4R` |
| Rascal … Sister Venturing Out | `G0DUMXDPZ` | `audio_locale: ja-JP`, Serie `GYW4MG9G6`, Folge 1 |
| Rascal … Knapsack Kid | `GWDU73EX8` | `audio_locale: ja-JP`, Serie `GYW4MG9G6`, Folge 3 |
| Millennium Actress, One-Punch-Man-OVAs (2×) | `GPWUKPVP4` u. a. | HTTP 404 — die Video-Kennung ist abgelaufen |

**Und die Auswertung braucht die Unterscheidung vom 15.08.2026.** `de-DE` am
Video ist ein sicheres **Ja**. `ja-JP` ist **kein** sicheres Nein: Eine deutsche
Fassung hat bei Crunchyroll eine **eigene** Videokennung, und dass wir sie nicht
kennen, ist keine Auskunft über sie. Ein Nein entsteht erst, wenn zusätzlich der
Serieneintrag im Katalog kein `de-DE` führt. Wer das überspringt, wiederholt die
975 Falschangaben, die genau aus dieser Verwechslung entstanden sind.

Ein 404 sagt nichts über die Tonspur, aber viel über den Verweis: Die Adresse
führt ins Leere und gehört geprüft.

**JustWatchs `/watch/<Kennung>` ist kein Beleg für das Werk (13.10.2026).** Zwei Fälle aus PR 1126, per `cms/objects/<Kennung>?locale=de-DE` nachgeprüft: Black Butler (2008, 24 Folgen) bekam `GVWU82XX0` — das ist Folge 1 der **Spanisch**-Synchro von „Emerald Witch Arc" (2024); der deutsche Katalog führt unter der Serie nur die zwei 2024er Staffeln. Magic Kaito 1412 (24 Folgen) bekam `GX9UQD7XQ` — das ist Folge 1 der 12-Folgen-Serie `GMEHMENQM`, deren Folgentitel in aniSearch beim Titel 8310 (Magic Kaito 2010) an gleicher Stelle stehen (10 von 12 wörtlich), bei 1412 an keiner. Beide Wege sind per Handbeleg `available: false` gestrichen. Vor einem Handbeleg aus einer Kennung also Serie, Staffel, Folgenzahl und Tonspur **der Kennung** lesen, nicht nur ihr `de-DE`.

**Alle Crunchyroll-Wege aus JustWatch nachgeprüft (13.10.2026, Fälle und Belege in `daniel-zum-abarbeiten/listen/cr-justwatch-wege-pruefung.md`).** Prüfweg: Kennung über `cms/objects` auflösen, Staffel über `number_of_episodes`, Folgentitel an gleicher Stelle wörtlich gegen `data/anisearch-folgen.json` (ähnlich genügt nicht), Serie muss `de-DE` führen. Zwei Lücken lassen einen Nein-Handbeleg wirkungslos: `uebernehmeAnbieter` in `bau/cartoon-zu-anime.ts` legt den Anbieter danach neu an, und der erste Block in `bau/11-2-justwatch.ts` kennt `handNein` nicht — vor einem Handbeleg deshalb im Bau-Vergleich nachsehen, ob er wirkt.

### Amazons Abwehr macht nach rund 660 Abrufen zu — und dann für alles

Der erste Lauf mit dem Inhalts-Riegel (07.09.2026) über 1.286 Amazon-Adressen
lieferte **552 gute und 116 tote** Befunde — und danach **623 mal `unklar` am
Stück**. Zwanzig Minuten lang klopfte der Lauf gegen eine geschlossene Tür.

Die Gegenprobe im Einzelabruf, unmittelbar danach: Auch `B0DML22FHP` („Date a
Live II"), die eine Stunde zuvor 936.253 Zeichen mit vollem Produktinhalt
geliefert hatte, kam nur noch als **3.815-Zeichen-Seite ohne Titel** zurück.
Die Sperre gilt also nicht der einzelnen Adresse, sondern uns — und sie
unterscheidet nicht zwischen lebenden und toten ASINs.

**Zwei Dinge folgen daraus, und das erste ist das wichtigere:**

- **Der Riegel hat gearbeitet.** Ohne ihn stünden jetzt 623 falsche „lebt" im
  Bestand, jedes dreißig Tage haltbar. Mit ihm stehen dort 623 offene Fragen,
  die im nächsten Lauf wieder drankommen. Das ist der ganze Unterschied
  zwischen einer Messung und einer Behauptung.
- **Ein zweiter Versuch nach Sekunden hilft nicht.** Eingebaut, an zwölf Fällen
  gemessen, bei keinem einzigen erfolgreich — und wieder ausgebaut. Die Sperre
  ist zeitlich, nicht anfragebezogen.

Deshalb hält der Lauf bei **zwanzig Zwischenseiten in Folge** an
(`SPERR_SCHWELLE` in `pipeline/check-links.ts`). Einzelne kommen auch im
gesunden Betrieb vor; eine Serie von zwanzig ist die Abwehr.

**Seit dem 20.09.2026 wird die Sperre ausgesessen statt abgebrochen** — weil
inzwischen gemessen ist, wie lange sie hält. Der vierte lokale Schub machte um
13:59 nach **669 Abrufen** zu (07.09.: 668, beide bei 700 ms Takt — so dicht
beieinander, dass ein Mengenkontingent näher liegt als eine Taktgrenze). Die
Probe um **14:16**, fünfzehn Minuten später: `gp/video/detail/B0GXK7RJFW` kam
mit 2.002.277 Zeichen und vollem Produktinhalt, `dp/B0CGS2DRMV` mit 404.

**Eine Einzelprobe belegt aber keine Freigabe — das ist der eigentliche Befund
dieses Tages.** Der Lauf, der um 14:20 mit 3 s Takt startete, machte nach
**zwanzig** Amazon-Abrufen wieder zu. Zwei Abrufe kommen durch, zwanzig nicht:
Amazon misst offensichtlich die Serie, nicht die einzelne Anfrage, und nach
einer Sperre bleibt die Leitung für Serienabrufe heiß, auch wenn ein einzelner
Abruf voll beantwortet wird. Wer die Sperre also prüfen will, muss sie mit einer
kleinen **Serie** prüfen, nicht mit einem Griff.

**Und langsamer laufen hilft nicht — gemessen an demselben Nachmittag.** Der
Lauf von 14:20 bis 15:16 fuhr mit 3 s Takt und 15 min Pause und kam nach der
ersten Sperre auf **20, 20, 20 und 91** Abrufe. Gegenüber 669 Abrufen bei 700 ms
am selben Tag heißt das: Die Stellschraube ist nicht das Tempo, sondern die
**Menge je Zeitfenster**, und eine Viertelstunde Ruhe stellt das Kontingent
nicht wieder her. Praktisch: **ein Schub von höchstens rund 600 Amazon-Adressen,
dann Stunden Ruhe.**

Die Reihe dazu, alle bei 700 ms Takt: 669 Abrufe nach langer Ruhe (20.09., 13:59),
301 nach 2¾ Stunden (18:07), 284 nach drei Stunden (21:25), **600 ohne Sperre**
nach neun Stunden (21.09., 07:10). Damit waren alle 2.159 Amazon-Adressen
gemessen; „unklar" stand danach bei null.

Der Lauf wartet deshalb `--sperrpause` (Standard 60 min), hängt die zwanzig
Adressen aus der Sperrphase hinten wieder an und macht weiter; nach zwei
Sperren wird Amazon übersprungen, statt es weiter zu reizen. Dazu `--pause` für
den Takt und ein Zufallsanteil von ±30 %, weil ein exakt gleichmäßiger Takt für
sich schon ein Bot-Merkmal ist. Beim Zumachen meldet der Lauf **Abrufe und
Takt** — die Messzeile, aus der die Zahlen oben stammen.

**Der Ausweichweg ist gemessen, nicht vermutet.** Für den Fall, dass Warten
nicht reicht: `tavily_extract` holt dieselben Seiten über fremde IPs und
unterscheidet die beiden Fälle richtig — die lebende Video-Seite kam mit Titel
und allen 24 Folgentiteln zurück, die tote als „404 page not found"
(20.09.2026). Das kostet Tavily-Kontingent und ist deshalb die Rückfallebene,
nicht der Normalweg. Die Cloud ist keine: Vom GitHub-Runner sperrt Amazon nach
wenigen Dutzend Abrufen.

**Der Probelauf über zehn unserer „unklar"-Adressen zeigt aber auch die Grenze**
(20.09.2026, während Amazon uns gesperrt hatte): Alle zehn `/dp/`-Adressen kamen
als „404 page not found" zurück — und die Gegenprobe über die **Video**-Adresse
derselben ASINs lieferte für zwei von drei volle Seiten (Space Dandy mit 24
Folgentiteln, Anti-Magic Academy mit deutscher Tonspur), für die dritte „Error
fetching content". Zweierlei folgt daraus: Der Befund ist plausibel, denn
`/dp/` ist bei Prime-Titeln regelmäßig tot, während die Video-Seite lebt. Und
**Tavily hat seine eigene Nichtauskunft** — „Error fetching content" ist
dasselbe wie unser `unklar` und darf keinen Befund setzen.

**Die Gegenprobe ist inzwischen gemacht: zehn von zehn** (20.09.2026, 20:55,
nach drei Stunden Ruhe über die freie Leitung). Alle zehn `/dp/`-Adressen
antworteten mit HTTP 404 und 2.299 Zeichen — genau das, was Tavily gemeldet
hatte. Tavilys „404 page not found" ist damit Amazons 404, und der Dienst taugt
als Rückfallebene für Befunde.

**Und die Sperre stoppt nur Amazon (17.09.2026).** Vom GitHub-Runner aus sperrt Amazon
nach wenigen Dutzend Abrufen; der alte Abbruch ließ dadurch zehn Tage lang auch alle
übrigen Anbieter ungeprüft (1.037 fällig, 41 geprüft). Seitdem überspringt der Lauf nach
der Sperre nur die Amazon-Adressen. Amazon selbst liefert Befunde praktisch nur von einer
deutschen Leitung (07.09.: 552 gute von hier, 14.09.: 2 aus der Cloud).

**Die allgemeine Form:** Bei einer Quelle mit Bot-Abwehr ist die erste Frage
nicht „wie schnell darf ich fragen", sondern **„wie viel darf ich in einer
Sitzung fragen"**. Ein Takt schützt vor Überlast, nicht vor einem Kontingent —
und ein Lauf, der nach der Sperre weiterläuft, erzeugt keine Daten, sondern nur
den Anschein von Arbeit.

### Ein Adressbeleg ist kein Sprachbeleg — und hat einen verdrängt

`data/dub-confirmed.yaml` führt zwei Arten von Einträgen, und sie sehen fast
gleich aus:

```yaml
- anilistId: 21856          # Sprachurteil — trägt dub, keine url
  platform: netflix
  dub: false
  note: "Tonspuren: ja|Japanisch [Original], fr|Französisch, … 7 Tonspuren"

- anilistId: 21856          # Adressbeleg — trägt url, kein dub
  platform: netflix
  url: https://www.netflix.com/title/80135674
  note: "Verweis aus Netflix' eigener Staffelliste erschlossen"
```

Solange `loadDubChecks()` beide zu **einem** Eintrag verschmolz, fiel das nicht
auf: Adresse und Urteil landeten in derselben Zeile. Seit der Trennung je
Ausgabe (07.09.2026, wegen Date a Live IV) stehen sie nebeneinander — und
`belegFuer()` wählte nach der Regel „Beleg mit derselben Adresse zuerst". Die
hatte nur der Adressbeleg. Das Urteil kam nie zum Zug.

Fünf Staffeln „My Hero Academia", auf Netflix nachweislich ohne deutsche
Tonspur, standen deshalb weiter im Datensatz.

**Zwei Dinge sind hier gut gegangen, und beide gehören genannt:**

- `check:handbelege` hat es gefunden und den Datenlauf rot gemacht — eine
  Prüfung, die genau ihren Zweck erfüllt hat. Ohne sie wäre der Fehler still
  gewesen.
- Der Fehler entstand aus einem **richtigen** Fix. Die Trennung je Ausgabe war
  nötig; sie hat nur eine zweite Bedeutung derselben Datenstruktur offengelegt.

**Die Lehre:** Wo eine Datei zwei Arten von Zeilen führt, muss jede Auswahl
sagen, welche Art sie meint. `belegFuer()` sucht eine Aussage über den Verweis
und filtert deshalb auf `dub` **oder** `available`. Was der Adressbeleg
beiträgt, wird an anderer Stelle gelesen.

**Und die Sorten sind nicht zwei, sondern drei.** Der erste Anlauf filterte nur
auf `dub` — und warf damit 262 `available: false`-Belege weg, die Verweise
entfernen sollen. Aus sechs Meldungen in `check:handbelege` wurden 268. Beide
Felder sind verschiedene Aussagen („kein deutscher Ton" gegen „dort gibt es gar
nichts"), aber beide sind Aussagen; nur der Adressbeleg ist keine. Wer eine
Sorte benennt, zählt besser einmal durch, wie viele es wirklich gibt.

**Und die allgemeinere:** Ein Feld, das in der Hälfte der Zeilen fehlt,
unterscheidet zwei Sorten — auch wenn niemand sie je benannt hat. Beim nächsten
Umbau derselben Struktur ist die erste Frage: *Welche Sorten liegen hier
eigentlich, und meint dieser Zugriff alle?*

### Ein Adressbeleg richtet die Adresse — solange kein zweiter auf der alten steht

Am 28.09.2026 hatte „Mission: Yozakura Family" (182578) in `data/dub-confirmed.yaml` **zwei**
Belege für Disney+, beide `dub: true`, beide vom selben Tag: einen maschinell aus den zwölf
Meldungen der Staffel 2 mit der Adresse aus dem Datensatz (`entity-ac689bea…`), und einen von
Hand mit der richtigen (`entity-0113d236…` — die alte leitet auf die Startseite).

Beabsichtigt war, dass `09-2-linkpruefung.ts` die Adresse umschreibt (`stream.url = check.url`).
`belegFuer()` sucht aber **zuerst nach derselben Adresse** — und die hatte der maschinelle
Beleg. Der Handbeleg kam nie zum Zug, die tote Adresse blieb stumm stehen.

**Die Regel:** Ein Adressbeleg ist eine Korrektur, aber eine Adresse, die einen eigenen Beleg
hat, wird nicht korrigiert. Wer eine Adresse berichtigt, muss den Beleg der alten **ersetzen**,
nicht danebenlegen. `check:handbelege` hätte den Widerspruch nicht gemeldet — beide Aussagen
waren in sich stimmig, nur die Wirkung fehlte. Aufgefallen ist es beim Nachsehen am gebauten
Bestand, nicht durch eine Zusicherung.

### Zwei Sprachkennungen in einer Adresse ergeben eine 404

AniLists `externalLinks` nennen einen Streaming-Dienst in irgendeiner Sprache — „As a
Reincarnated Aristocrat … 3rd Season" kam als `crunchyroll.com/pt-pt/series/GG5H5XQMD/…`.
`germanizeUrl()` setzte die deutsche Kennung davor, ohne die fremde zu entfernen:
`crunchyroll.com/de/pt-pt/series/…` — und die Seite antwortet mit **404**. Am 28.09.2026
stand genau dieser Verweis in der Statusanzeige, und Daniel klickte die Crunchyroll-Pille
darauf: „click auf crunchy-pill in status app führt auf 404".

Der erste Schritt ist deshalb: **alle** führenden Sprachsegmente entfernen
(`(?:[a-z]{2}(?:-[a-z0-9]{2,3})?\/)+`, gedacht für `de`, `de-de`, `es-419`), dann die
deutsche Kennung setzen. Bei Disney+ gab es denselben Fehler schon am 20.08.2026 (vier
Verweise, u. a. `disneyplus.com/de-de/en-gb/series/bleach/…`) — dort entfernte die erste
Fassung aber nur `de-de` und setzte es gleich wieder davor, sodass `de-de/en-gb/…` auch
danach kaputt war. Beide Zweige machen es jetzt gleich, und `check:logic` hält fünf Fälle
fest (fremde Kennung, doppelte Kennung, deutsche Kennung, keine Kennung, Disney+).

**Aufgefallen ist es nicht durch eine Prüfung, sondern durch einen Klick von Daniel.** Die
Verweisprüfung sieht eine Weiterleitung auf die Startseite als HTTP 200 — dieselbe Lücke wie
bei Netflix am 22.08.2026.

### Eine Nichtauskunft löscht keinen Befund

Am 07.09.2026 zweimal hintereinander passiert, und beim zweiten Mal war es
sichtbar: Zwei Aniverse-Adressen waren einzeln als 404 gemessen und im Bestand
eingetragen. Zwanzig Minuten später lief ein Prüflauf, geriet in Amazons Abwehr
und schrieb für beide `unklar`. Die zwei toten Verweise standen danach wieder
auf der Seite.

Der Fehler steckte in einer Zeile, die harmlos aussieht:

```ts
bestand[url] = await pruefe(url)   // überschreibt bedingungslos
```

`unklar` ist aber gerade **kein** Befund — es heißt „uns wurde diesmal nichts
gezeigt". Eine Nichtauskunft ersetzt keine Messung. Der alte Eintrag bleibt
deshalb stehen; nur sein Datum wird nicht erneuert, damit die Adresse fällig
bleibt. Ein echter Befund — 200 mit Produktseite, 404, Regionssperre —
überschreibt weiterhin alles.

**Die allgemeine Form, und sie gilt für jeden Zwischenspeicher mit Befunden:**
Ein Wert, der „weiß nicht" bedeutet, darf nie denselben Platz einnehmen wie
einer, der etwas weiß. Wer beide in dasselbe Feld schreibt, muss beim Schreiben
unterscheiden — sonst frisst die schlechtere Auskunft die bessere, und zwar
lautlos.

### Eine Suchadresse ist ein Auftrag, kein Angebot — auch beim Schreiben

Am 09.09.2026 hat Daniel beide Ausgaben von „Death Note: Relight" gemeldet
(`B0FVDZ286F` und `B0FWYWSS3M`). Im Bestand stand danach **eine**.

`fetch-pruefungen.ts` bündelt Meldungen je Adresse — richtig, denn eine Reihe
wird Folge für Folge gemeldet und soll einen Beleg ergeben. Der Schlüssel war
`plattform + url`, und bei einem Suchauftrag ist die `url` für beide Ausgaben
dieselbe: Aus zwei Meldungen wurde eine Gruppe, aus der Gruppe der Befund der
**jüngeren** Meldung.

Beim **Lesen** zieht `loadDubChecks()` diese Trennung seit dem 07.09.2026 (Date a
Live IV, siehe oben). Beim Schreiben fehlte sie. Der Schlüssel trägt jetzt
zusätzlich `seiten_kennung`; Meldungen ohne Kennung bleiben beieinander — das
sind die Folgen-Meldungen, für die es die Bündelung gibt.

**Die allgemeine Form, und sie ist in diesem Projekt jetzt dreimal aufgetreten:**
Wo zwei Ebenen dieselbe Adresse benutzen — Auftrag und Angebot —, muss **jede**
Stelle sagen, welche sie meint. Lesen und Schreiben sind dabei zwei Stellen.

### JustWatch ist die zweite Quelle, die dieses Projekt lange gesucht hat

Am 09.09.2026 abends dreimal in einer Stunde derselbe Griff, jedes Mal mit
Ergebnis — und jedes Mal aus einer Datei, die seit dem 07.09. im Repo liegt
(`data/justwatch-audio.json`, 351 Titel, 80 mit Angeboten).

**1. Kanal-Meldungen ohne Deutsch werden zu belegten Neins.** Bei einem
Kanal-Titel zeigt Prime nur die Tonspuren, die dem Betrachter zugänglich sind;
eine Meldung „kein Deutsch" ist dort für sich kein Beleg. Aus 39 solchen
Meldungen macht `pipeline/kanal-gegenprobe.ts` **18 belegte Nein** — Prime fiel
damit von 29 auf 11 Verweise ohne Sprachurteil.

**2. Wo JustWatch widerspricht, war die Meldung falsch.** Fünf Titel führen dort
deutschen Ton. Sie bekommen **kein** Urteil (JustWatch sagt „irgendwo deutsch",
nicht „bei diesem Anbieter"), sondern einen Vermerk in
`data/kanal-widerspruch.json` — und darüber stehen sie wieder in Daniels
Prüfliste. Ohne ihn verhinderte die Meldung ihre eigene Überprüfung.

**3. Ein Anbieter, den JustWatch nicht nennt, führt den Titel nicht.** Für die
Crunchyroll-Adressen, die im deutschen Katalog fehlen, ist das die zweite
Quelle: Kennt JustWatch den Titel, führt Angebote und **kein** Crunchyroll, ist
die Adresse tot. Fünf von neun tragen das; einer widerspricht („Okko und ihre
Geisterfreunde" läuft dort, nur unter anderem Slug).

**4. Und die Adressen dort sind kanonisch — mit Kennung.** Der letzte ADN-Verweis
ohne Urteil hing daran, dass `/show?limit=100&offset=…` nur 171 von 252 Shows
herausgibt. JustWatch nannte
`animationdigitalnetwork.com/de/video/1181/25475-film`, und
`/video/show/1181` bestätigte `vde`. Der Weg über die Angebotsadresse ist neu
und trägt weiter, wo ein Katalog lückenhaft ist.

**Die gemeinsame Form:** JustWatch beantwortet nicht die Sprachfrage — seine
Angabe gilt der Serie und ist oft leer. Es beantwortet die Frage **daneben**:
*Führt dieser Anbieter dieses Werk überhaupt, und unter welcher Adresse?* Genau
daran sind hier drei Automatismen gescheitert, und alle drei laufen jetzt.

**Die Grenze bleibt:** Ein leeres `audio` ist Schweigen, kein Nein. Gewertet wird
nur ein Angebot mit belegter Tonspur — dieselbe Asymmetrie, die dieses Projekt an
jeder fremden Quelle anlegt.

### Ein „Widerspruch" zwischen Quelle und Handprüfung ist oft ein Zeitversatz

`npm run check:quellen` meldete am 09.09.2026 einen falsch negativen Befund:
„Kill Ao" (198113) — die Crunchyroll-Quelle sage nein, die Handprüfung deutsch.
Nachgesehen stehen dort **zwei** Handprüfungen, und beide sind richtig:

| Datum | Befund | Daniels Wortlaut |
|---|---|---|
| 24.08.2026 | `dub: false` | „auf crunchy gibt es fuer kill blue keine synchronisierte folge" |
| 07.09.2026 | `dub: true`, Folgen 1–8 | „crunchy und netflix haben 1-8" |

Dazwischen ist die deutsche Fassung erschienen. Der Quellenbefund in
`data/crunchyroll-dub.json` trägt `geprueftAm: 2026-08-22` — er ist nicht
falsch, sondern **älter als die Wirklichkeit**.

**Die Lehre gilt jeder Robustheitsprüfung dieser Art:** Sie hält zwei Aussagen
gegeneinander, die zu **verschiedenen Zeitpunkten** entstanden sind. Bei einer
laufenden Serie ändert sich die Antwort während der Ausstrahlung — genau
deshalb wird jede Warteschlange nach dem Alter gebildet und nicht nach „schon
beantwortet" (siehe „Ein Abruf, der nur ergänzt, veraltet zwangsläufig").

**Der Prüfgriff, bevor ein Widerspruch untersucht wird:** die beiden
Zeitstempel nebeneinanderlegen. Liegt die Handprüfung nach dem Quellenabruf und
lief die Serie dazwischen weiter, ist der Fall geklärt und niemand hat sich
geirrt. Erst wenn die Quelle **jünger** ist, lohnt die Suche nach einem Fehler.

`check:quellen` gehört bewusst nicht zu `check:vor-commit`: Ein solcher Befund
macht keinen Lauf rot, und das ist richtig so.

### aniSearchs Amazon-Links veralten — JustWatchs nicht (19.09.2026)

Daniels Prüfliste-Durchgang in der Nacht zum 19.09.2026: **37 von 37** Prime-Adressen, die nur aniSearch kannte (Partnerlinks `tag=anisearch.de-21`, sieben noch im Format `exec/obidos/ASIN/…`), waren bei Amazon tot. JustWatch kannte zu **20** davon eine aktuelle, andere Prime-Adresse; bei 12 führte aniSearch selbst eine zweite Kennung im Prime-Kanal (Crunchyroll/Aniverse) — und die stand längst als eigener Weg „Amazon Prime (Crunchyroll)“ auf der Seite (`watchLinks`, bewusst getrennt von den Prime-Verweisen, weil bei Kanal-Titeln Amazons Sprachangabe kein Beleg ist). **Korrigiert 19.09.2026, 11:05:** Meine erste Lesart „nie verwendet“ kam aus einer Auswertung, die nur `streams` ansah; ein Umbau darauf (10:48) war überflüssig und ist zurückgenommen. Prüfgriff: Wer fragt, ob ein Weg fehlt, sieht in `streams`, `entfernteStreams` **und** `watchLinks` nach. **Einordnung:** aniSearch ist eine gute Quelle für „gibt es das auf Deutsch", eine schwache für die aktuelle Amazon-Adresse. JustWatch pflegt Adressen laufend, übernommen wird trotzdem nur mit Gegenprobe (Pokémon Weiß/Schwarz, 17.09.2026). Folge: Eine aniSearch-Amazon-Adresse ohne jede weitere Bestätigung ist vor der Prüfung verdächtig, nicht neutral.

### TOGGO nennt je Folge ihr freies Fenster — und das ist nicht überall eine Woche (19.09.2026)

toggo.de ist eine JavaScript-Anwendung; die Folgenliste kommt von `production-n.toggo.de/api/assetstore/vod/asset?expand=false&filter=type[episode]&filter=series_id[VSE…]&size=500` (Serienkennung aus unserer Adresse `…-vse446`). Je Folge drei Fenster: `catchup_*` (frei nach TV-Ausstrahlung), `fvod_*` (frei auf Zeit), `svod_*` (Abo — bei Daima ab 25.09. bis 2030, das ist RTL+). Gemessen: **Daima** — jede Folge genau 7 Tage frei (21:37 bis 21:15 eine Woche später), auf der Seite deshalb nur 14–18. **Boruto** — 30 von 292 Folgen frei bis 31.12.2026, je Staffel fünf. Wer „TOGGO zeigt nur die letzten Folgen“ als Regel annimmt, liegt bei Boruto falsch — gemessen statt angenommen. `robots.txt` der API: `Disallow: /` und `Allow /api/` ohne Doppelpunkt; Daniel hat am 19.09.2026 entschieden, das als Freigabe zu lesen. TOGGO zeigt ausschließlich deutsche Fassungen (Daniel) — der Weg trägt immer „DE ✓“. Abruf: `pipeline/fetch-toggo.ts`, Anzeige: `web/src/lib/toggo.ts`.

### Trailer: drei Lücken auf einmal (19.09.2026)

Daniel vermisste Trailer bei zwei Kinofilmen (Detektiv Conan Film 29, Madoka „Walpurgisnacht“). Drei Ursachen, alle gemessen: (1) Dem Trailer-Schritt in `refresh-data.yml` fehlte `TMDB_API_KEY` — Weg 3 und der englische/japanische Rückfall liefen in der Cloud **nie** („0 deutsche über TMDB, 0 fremdsprachig“); mit Schlüssel kamen im ersten Lauf 413 fremdsprachige Trailer dazu. (2) Der Namensabgleich schnitt genau am Wort „Trailer“; „… Highways Teaser Trailer Deutsch“ (KinoCheck Anime) ergab „… highways teaser“. (3) Der deutsche Verleih lädt selbst hoch: „Crunchyroll Deutschland“ führt „… | Offizieller Trailer – Synchro“, den KinoCheck nicht hat — der Kanal steht jetzt im Index, „Synchro“ gilt als deutsch, „OmU“ nicht, Synchro-Trailer schlägt Trailer schlägt Teaser. **Rhythmus:** Jeder Film ohne deutschen Trailer (auch mit fremdsprachigem Rückfall) wird täglich neu gesucht; alle gespeicherten Videos prüft `videos.list` täglich auf Erreichbarkeit, ein gelöschtes fliegt raus und steht am selben Tag wieder zur Suche an.

### TV-Folgennummern aus den Wikipedia-Episodenlisten — und warum nicht über die API (19.09.2026)

Das TV-Programm (RTL+, tv.de) nennt nur Folgentitel. Die Episodenlisten der de.wikipedia führen je Folge `NR_GES`, `NR_ST`, `DT` (deutscher Titel) und `EAD` (deutschsprachige Erstausstrahlung), über die Vorlagen `Episodenlisteneintrag` **und** `Episodenlisteneintrag2` (gleiche Felder). **Gemessen am 19.09.2026: 32 von 32 gesichteten Folgentiteln wörtlich in der Liste** (One Piece 12, Dragon Ball Super 6, Dragonball 4, Pokémon Horizonte 4, Daima 3, Gachiakuta 3). Detektiv Conan führt eine Tabelle statt der Vorlage (japanische und deutsche Nummer je Zeile, `rowspan` bei geteilten Doppelfolgen) — `folgenAusTabellen` liest sie, 7/7 Titel passten; tv.de schreibt „(3)“, die Wikipedia „– Teil 3“, `folgenKern` gleicht das an. Keine Liste: Solo Leveling, Eyeshield 21, Beyblade X.

**robots.txt:** `User-agent: *` mit `Disallow: /w/` und `Disallow: /api/` — damit sind `api.php` und die Suche gesperrt (die Recherche vom selben Morgen hatte „robots ohne Claude-Sperre“ notiert und nur die namentlichen Blöcke gelesen). `/wiki/<Seite>?action=raw` liegt unter `/wiki/` und liefert denselben Wikitext; gesucht wird deshalb über feste Seitennamen statt über die Suche. Abruf: `pipeline/fetch-wikipedia-folgen.ts`, Auswertung: `pipeline/lib/tv-termine.ts`.

**Reihenfolge der Listen:** Wikipedia vor RTL+ vor TMDB (`data/tmdb-folgen.json`, deutsche Titel über Staffeln durchgezählt, Staffel 0 zählt nicht). TMDB-Titel sind oft andere Übersetzungen als die des Senders — bei Eyeshield 21 passten 0 von 5 —, deshalb gilt eine Liste nur, wenn **jede** Sichtung darin steht. Und eine Nummer über der Folgenzahl unseres Titels gehört in eine spätere Staffel: ProSieben MAXX „Solo Leveling“ mit TMDB-Folge 14 ist „Arise from the Shadow“ Folge 2 (unser „Solo Leveling“ hat 12).

**Zwei Fallen:** Die Pokémon-Liste zählt über das ganze Franchise (Horizonte beginnt bei 1235) — gezählt wird deshalb ab der ersten Folge der Seite. Und echte Nummern haben Lücken (Super RTL: werktags 78–80, samstags 127); `expandEvents` legt für eine TV-Sichtung deshalb nur Termine für gesichtete Folgen an, sonst lägen 46 erfundene Folgen auf dem Samstag.

### RTL+ kennt Staffel und Nummer — aber an drei Stellen verteilt (19.09.2026)

Für Serien ohne Wikipedia-Liste (Beyblade X) ist RTL+ selbst die Folgenquelle. Die **Video-Sitemap** (`videos.sitemap.xml`, 100 Teilkarten, zusammen **177 MB**, 160 s) nennt je Folge Adresse, Titel und `publication_date` (= `uploadDate` der Folgenseite), aber keine Staffel und Nummer — und **jede Folge steht zweimal** darin, dazu eine `…/video/embed/…`-Adresse ohne Daten. Die **Staffelseite** nennt „Staffel 3 • Folge 15 • Titel", aber nur die ersten 24 Folgen und ohne Adresse; verbunden wird über den Titel. Den Rest liefert die **Folgenseite** (schema.org `TVEpisode`, `inLanguage: de`), je Folge einmal abgerufen und danach gespeichert. Gemessen an Beyblade X: Staffel 1 50 Adressen bei 51 Folgen (F37 fehlt), Staffel 2 49/49, **Staffel 3 läuft wöchentlich freitags seit 05.06.2026** (F17 am 18.09.) — RTL+ ist dem TV (TOGGO plus) rund zwei Wochen voraus (F15: RTL+ 04.09., TV 19.09.). Von 53 unserer Serien bei RTL+ bekam seit 01.08.2026 nur Beyblade X neue Folgen. Abruf: `pipeline/fetch-rtlplus-folgen.ts` (wöchentlich), Lesen: `pipeline/lib/rtlplus-folgen.ts`. Eine Staffel mit gemessenem Wochentakt, die noch wächst, wird ein RTL+-Termin mit offenem Ende (`rtlplusWochentermine`) — ohne Folge, die niemand gesehen hat; das Pill nennt dann „neue Folge <Datum>“ statt der erschienenen Folgen der Staffel (sonst stand „16 Fg.“ bei 115 Folgen auf RTL+).

### TOGGO-Katalog als Synchro-Quelle — gemessen, nicht automatisiert (19.09.2026)

Daniel fand Beyblade Burst QuadStrike auf TOGGO (Staffel 7), bei uns stand „Noch keine deutsche Fassung": Keine unserer Synchro-Quellen kannte den Titel (MyDubList nicht, aniSearch nur mit deutschem Titel ohne Synchro-Marke), und TOGGO lasen wir nur für Titel, die schon einen TOGGO-Weg hatten. TOGGO zeigt ausschließlich deutsche Fassungen (Daniel). Die Serienliste der Schnittstelle (`…/vod/asset?filter=type[series]&size=500`, 252 Serien, mit Figuren je Serie) gegen unsere Namen gehalten: **21 schon im Bestand, 2 fehlten** (QuadStrike 166062, Bakugan 2023 177166 — beide jetzt in `synchro-von-hand.yaml` und `watch-links.yaml`, zweite Quelle fernsehserien.de), 2 mehrdeutig (Yu-Gi-Oh!, Sylvanian Families). Für zwei Titel kein Automatismus; neu messen, wenn TOGGO neue Anime-Serien aufnimmt. Figurenseiten (`…-pty605`) löst `fetch-toggo.ts` seit demselben Tag über diese Liste auf die Serienseite auf (`lib/toggo-serien.ts`).

### tv.de-Tagesseiten lassen die Nacht aus — die Detailseite nicht (19.09.2026)

ProSieben MAXX am 19.09.2026: Die Tagesseite endet um 22:10, die des 20.09. beginnt um 04:15; nachgeladen wird nichts (Netzwerkverkehr im Browser gelesen: nur das HTML). Dazwischen liefen zehn Folgen Dragon Ball Super. Die Detailseite jeder Sendung führt unter „Bald im TV" alle kommenden Termine der Reihe beim Sender, Nacht inklusive, mit „Reihe: Folgentitel" und „Morgen, 00:30 - 01:00 Uhr" bzw. „21.09., 17:05 - 17:30 Uhr". `baldImTv()` in `pipeline/fetch-tv-programm.ts` liest sie, einmal täglich je gesichteter Reihe und Sender (Stand 19.09.: 7 Abrufe).

### aniSearchs deutscher Block kann der Untertitel-Start sein — samt Synchro-Marke (19.09.2026)

Beheneko: aniSearch führt „Deutsch 23.04.–14.05.2025, AniMoon, synchronisiert"; AniMoon selbst kündigt die Synchro „exklusiv auf DVD & Blu-ray" an, Vol. 1 am 12.09.2025, Prime Video hatte nur Untertitel. Eine allgemeine Regel (Zeitraum vor der ersten Disc → Untertitel) wurde gemessen und verworfen: von 8 Treffern sind mindestens 2 echte TV-Premieren mit Synchro (Pokémon Schwarz & Weiß Staffel 2 2012/13, Yu-Gi-Oh! Zexal II 2014/15). Korrigiert wird deshalb einzeln in `data/erstausgabe-von-hand.yaml` (Quelle Pflicht, `check:logic` prüft sie).

### kinoheld-Adressen über DuckDuckGo — Google, Bing, Brave sperren ihre Suche (19.09.2026)

kinoheld sperrt Agenten (`Disallow: /`), deshalb stand jede Filmadresse von Hand im Kinotermin, und fehlende blieben mit „sobald es sie gibt" liegen — ungeprüft; bei „Your Name" gab es sie längst (Daniel fand sie als ersten Google-Treffer). Das eingebaute Suchwerkzeug findet kinoheld nicht einmal dort. robots.txt der Suchmaschinen, gelesen 19.09.2026: Google, Bing, Brave `Disallow: /search`; **`html.duckduckgo.com`: `Allow: /`** — und es findet die Your-Name-Seite. `pipeline/fetch-kinoheld.ts` sucht wöchentlich für jeden Kinotermin ohne Adresse und übernimmt nur einen Slug, der alle Titelwörter trägt. Nachtrag 19.09.2026: Mit Serper (Google-Treffer, `SERPER_API_KEY`) fand der Abruf „All You Need Is Kill" (`/film/all-you-need-is-kill`), das DuckDuckGo und Tavily nicht kannten — Serper ist seitdem der erste Weg, DuckDuckGo der Rückfall. Google führt kinoheld auch unter `/movie/<slug>-<kennung>` und mit internem Port `:7081`; gemeint ist die `/film/`-Seite. Madoka und Witch on the Holy Night noch ohne Seite.

**Ein Klammerzusatz im Abo-Namen verdarb die Kanal-Gegenprobe (22.09.2026).** „Abos: crunchyrollde
(Meldung 4738)" wurde zu „crunchyrollde (meldung 4738)" und passte auf kein JustWatch-Angebot; die
Probe fiel auf alle Angebote zurück und fand bei A Silent Voice maxdomes `de` — ein Widerspruch, den
das Kanal-Angebot (`es, it, ja`) nie hatte. `kanal-gegenprobe.ts` wirft Klammerzusätze seitdem weg.

**Ein Handbeleg nur mit Adresse ist kein neutraler Vermerk (22.09.2026).** Die Prime-Prüfliste
(`extension-offene-amazon.mjs`, „geprüft ist die Adresse") liest jede Adresse aus
`dub-confirmed.yaml` als angesehen und lässt sie weg — Fairy Tail fiel so von der Liste, bevor
jemand die Sprache geprüft hatte. Einen Weg belegt man in `verweise-von-hand.yaml` (`belegtAm`),
ein Urteil in `dub-confirmed.yaml` — nie beides in einem urteilslosen Handbeleg.

## Joyn: nicht selbst auslesen — JustWatch liefert die Adressen (22.09.2026)

Anlass: Daniel fand Dragon Ball Super kostenlos bei Joyn (ProSieben-MAXX-Folgen 108–127 seit
03.09.2026) und bat, Joyn als Quelle für Verweise zu prüfen.

**Gemessen:**
- `www.joyn.de/robots.txt` sperrt nur `/suche` und `/play/`; Serienseiten sind erlaubt, und
  `sitemap.series.0.xml` führt rund 2.000 deutsche Serien. `api.joyn.de/robots.txt`: `Disallow: /`.
- Die Serienseite trägt je Folge Nummer, Staffel, Online-Datum (`airdate`), Ablaufdatum
  (`endsAt`) und Lizenz (`AVOD` kostenlos, `SVOD` Joyn Plus); `languages` ist leer.
- **Impressum, wörtlich:** „Eine Nutzung aller auf dieser Website … eingestellten Inhalte … für
  Text und Data Mining im Sinne des §44b UrhG bleibt ausdrücklich vorbehalten." Die AGB verbieten
  Rippen und geschäftliche Nutzung, nennen Crawler aber nicht.

**Entscheidung:** Kein eigener Abruf bei Joyn, aus demselben Grund wie bei der ARD Mediathek
(TDM-Vorbehalt). Neu bewerten nur mit einer Erlaubnis von Joyn.

**Der erlaubte Weg lag schon im Haus:** `data/justwatch-audio.json` nannte 81 Joyn-Adressen
(64 „Joyn" ADS, 17 „Joyn Plus" FLATRATE), im Datensatz standen 2. `providerToPlatform` machte
„Joyn" zur eigenen Plattform, und die JustWatch-Runden übersprangen solche Angebote, ohne dass
jemand einen Verweis anlegte. Seit dem 22.09.2026 legt `build.ts` sie an (38 Titel), mit der
Zugangsart aus JustWatch (`joynZugang`: TMDB kennt keine Werbefinanzierung).
Stichprobe 7 Seiten: 6 leben, Lizenz wie bei JustWatch; der Film „Ame & Yuki" lieferte 404
(räumt die Linkprüfung ab). Joyn zeigt oft nur ein rollendes Fenster (Frieren: 5 Folgen).
Was JustWatch nicht kennt (Dragon Ball Super), kommt über `verweise-von-hand.yaml`.

## Kein Weg auf eine Datenbank — Videoload über die MagentaTV-Kennung (22.09.2026)

Daniel an „Ame & Yuki": „videoload linkt auf tmdb, das ist falsch, es muss direkt zum anbieter
linken." Gemessen: 389 Pillen bei 202 Titeln zeigten auf themoviedb.org (Videoload 146, YouTube
100, Google Play 97, freenet 10, Apple TV 9, maxdome 9 …). JustWatch hatte alle 202 geprüft und
nannte keinen dieser Anbieter dafür. Videoload kommt bei JustWatch gar nicht vor, den Dienst gibt
es aber (Wolfskinder dort mit Deutsch, Daniel mit Bild).

**Videoload und MagentaTV teilen die Gracenote-Kennung** (`GN_MV…`), die Adresse ist dieselbe bis
auf die Domain. 143 von 146 Videoload-Pillen ließen sich so richten. Videoload ist eine
Browser-Anwendung und antwortet auch auf erfundene Kennungen mit HTTP 200 — prüfbar nur von Hand:
4 von 4 Filmen richtig (Daniel). Serien tragen `/serie/<slug>/staffel-1/GN_SEASON_…` — alle 7 von Hand belegt, alle deutsch (Daniel);
ohne den Staffelteil liefen 7 Serien als „ohne Kennung“ durch. Keine robots.txt (die Adresse liefert die Anwendung).

Alles Übrige, was auf TMDB zeigte, entfällt; `pruefung.ts` bricht den Bau ab, wenn ein Bezugsweg
wieder auf themoviedb.org zeigt.

**Videoload gilt als deutsch** wie Joyn (Daniel, 22.09.2026: „.de als domain, telekom
deutschland … katalog durchstöbert, wir können annehmen das alle de sind, bis wir irgendwann ein
gegenteil beweisen"). Nachgerechnet am Datensatz vom 22.09.2026 (mit Staffelform): 143 Videoload-Wege direkt,
145 als deutsch gesetzt, 247 TMDB-Wege entfallen; danach ohne jeden Weg nur 137612 (Princess
Principal: Crown Handler 3).

**Warum JustWatch Videoload nicht nennt, TMDB aber schon** (gemessen 22.09.2026 an „Ame & Yuki",
TMDB movie/110420): TMDBs Übersichtsseite führt je Anbieter einen JustWatch-Weiterleitungslink
(`click.justwatch.com/a?cx=…&r=<Anbieteradresse>`, Klicktyp `jw-content-partner-export-api`) — mit
Videoload und genau der aus MagentaTV abgeleiteten Adresse. Die öffentliche JustWatch-Schnittstelle
(`apis.justwatch.com/graphql`, `offers(country: DE, platform: …)`) liefert Videoload weder für WEB
noch ANDROID_TV noch IOS; Joyn fehlte am 22.09. ebenfalls (am 16.09. noch da, Seite inzwischen 404).
TMDBs Partner-Export ist also vollständiger als unsere Abfrage. TMDBs API (`watch/providers`) nennt nur
den Anbieter, keine Adresse; die Übersichtsseite scheidet aus: robots.txt sperrt `Claude-User`,
`ClaudeBot` u. a. mit `Disallow: /`. Die 244 entfallenden Pillen sind damit sehr wahrscheinlich echte
Angebote ohne erlaubten Weg zur Adresse — offen, ob sie gekennzeichnet über TMDB zurückkommen.

**Joyn-Fenster bei ProSieben-MAXX-Anime** (gemessen 22.09.2026 an der Dragon-Ball-Super-Seite von
15:41 Uhr, Folgen 108–127, einmaliger Abruf vor Kenntnis des TDM-Vorbehalts): Jede Folge ist bei Joyn
**genau zur Sendezeit auf 7MAXX** online (`airdate`, deckungsgleich mit tv.de: 126/127 am 21.09.
17:05/17:30). Ende ab Folge 112 (ausgestrahlt ab 09.09.) ausnahmslos am **29. Tag nach der Ausstrahlung,
23:59 Uhr** (16/16). Ausnahme 108–111 (03./04.09., die ersten zwei Sendetage): Ende nach genau 19 Tagen
zur Uhrzeit. Daraus lässt sich das Fenster aus den tv.de-Sichtungen rechnen, mit „≈" gekennzeichnet;
Daniel prüft die Ausnahme am 22.09. um 17:30 (Folge 108 soll wegfallen).
**Nachtrag, gleiche Messung:** Die Enden von 108–111 liegen exakt auf dem Sendeende der Folge **+20**
(108 → 22.09. 17:30 = Ende 128; 109 → 18:00 = Ende 129; 110/111 → 23.09. 17:30/17:55 = Ende 130/131).
Vermutete Regel: **rollendes Fenster von 20 Folgen**, höchstens bis Sendetag + 29 (23:59) — ab 112 gibt es
keine Folge +20 mehr (131 ist das Finale), dort greift die Frist. Beleg steht aus (Daniel, 22.09. 17:30).
**Messpunkt 107** (Daniel, 22.09.2026 16:48, Google-Vorschau + Aufruf): online am 02.09.2026, Adresse
`/serien/dragon-ball-super-dpp50bwivlve/3-107-f-will-rache-eine-ueberaus-tueckische-falle` (entspricht dem
vorhergesagten Schema), am 22.09. HTTP 404. Widerlegt „29 Tage für alle"; passt zu „20er-Fenster" und
ebenso zu „19 Tage bei den frühen Folgen" — beide sagen den 21.09. voraus, unterscheiden sich erst später.
**Gebaut 22.09.2026:** `build.ts` hängt an den Joyn-Weg `fenster` (je Folge ab/ende aus den tv.de-Sichtungen
von ProSieben MAXX, Nummern über Wikipedia); `web/src/lib/joyn.ts` rechnet beim Anzeigen „≈ Fg. 126–127 ·
Fg. 128 ab 17:05". Gegenprobe gegen die Joyn-Messung: 126/127 Beginn und Ende 4/4 gleich. Erstsichtungen
zwischen 0 und 5 Uhr gelten nicht als Start (Nachtblock 20.09. = Wiederholung von 116–125) — deshalb fehlen
Folgen, deren Erstausstrahlung vor dem Beginn unseres tv.de-Verlaufs (19.09.) lag. Ohne Fenster zeigt eine
Joyn-Pille keine Folgenzahl mehr (vorher die des ganzen Titels, bei DBS „131 Fg.").

**MOTN kennt für Deutschland 13 Dienste** (`/v4/countries/de`, gemessen 22.09.2026, 1 Anfrage; Kontingent
456/1000 im September): netflix, prime (addon/buy/rent/free/subscription), disney, hbo, apple (addon/buy/
rent/subscription), paramount, mubi, curiosity, wow (addon), plutotv, crunchyroll, rtl, zee5. Für die
„(über TMDB)"-Pillen taugt MOTN damit nur bei **Apple TV** (9) und **Paramount+** (4); Google Play, YouTube,
maxdome, MagentaTV, Sky Store, Rakuten, freenet, Kino On Demand, Shahid, Videoload führt es nicht.
**Messpunkt 22.09.2026 17:31 (Daniel, von Hand):** 108 um 17:30 weg — exakt mit dem Sendeende von 128
(20er-Fenster bestätigt). 128 (7MAXX 17:05–17:30) fehlte um 17:25 und 17:28, war um 17:31 da: **abrufbar ab
Sendeende**, nicht ab Sendebeginn — Joyns `airdate` ist der TV-Termin. Adresse
`3-128-bis-zum-bitteren-ende-vegetas-stolz-bpah02evn044` (Schema bestätigt, mit Kennung). Die Pille rechnet
seitdem Beginn = Sendebeginn + 25 Minuten.

**YouTube-Kaufangebote direkt über die YouTube Data API** (PoC 22.09.2026, 8 Suchen à 100 Einheiten):
Alle 100 „YouTube (über TMDB)"-Pillen sind Filme. `search?type=video&regionCode=DE&q=<deutscher Titel>`
liefert das Kauf-/Leihangebot als Video des Kanals **„YouTube Movies"** mit dem deutschen Titel. 7 von 8
genau (Chihiro, Der Junge und der Reiher, FF VII Advent Children, 5 Centimeters per Second, Nausicaä,
Totto-chan, Kaguya); daneben 371 „Cardcaptor Sakura: The Movie - Die Reise nach Hongkong" nur ähnlich
(YouTube: „Cardcaptor Sakura: The Movie") — nicht übernehmen, Liste zum Nachsehen. Kontingent: 100 Suchen
= ein ganzer Tag (10.000 Einheiten); ein Lauf müsste über mehrere Tage verteilen.
**Messpunkt 22.09.2026 18:28 (Daniel, Bild der Serienseite):** Joyn schreibt an 110 „Noch bis 17:30 online“, an
111 „Noch bis 17:55 online“ — gemeint ist der 23.09., das Sendeende von 130 bzw. 131 (Folge +20). Deckt sich
minutengenau mit der Vorhersage. Die Pille ergänzt seitdem die 19 Folgen vor der ersten sicheren Sichtung
(sonst stand „≈ Fg. 126–129", abrufbar waren 110–129); Probe gegen 17:25/17:31/18:27: 108–127, 109–128, 110–129.
**Gebaut 22.09.2026:** `pipeline/fetch-youtube-kauf.ts` (`npm run data:youtube:kauf`, täglich in „Täglich — alle
Quellen", 30 Suchen) → `data/youtube-kauf.json`; `build.ts` setzt für genaue Treffer die Adresse
`youtube.com/watch?v=<id>`, Zugang „Kauf", ohne „(über TMDB)". Ähnliche Treffer werden festgehalten, nicht verlinkt.
**MOTN für Apple TV/Paramount+ geprüft und verworfen** (22.09.2026, 3 Anfragen): Für die 12 Titel mit „Apple TV
(über TMDB)" bzw. „Paramount+ (über TMDB)" lieferte `/v4/shows/<tmdb>?country=de` bei 1361 (Final Fantasy: Die
Mächte in Dir) nur Netflix und Prime, bei 2418 (Sword of the Stranger) und 2543 (Robin Hood) gar keine
Angebote. MOTN kennt diese Apple-Angebote nicht; die Pillen bleiben „über TMDB". Neu bewerten, wenn MOTN
Apple-Leihangebote für Deutschland führt oder JustWatch diese Titel findet.

## Ein Befund über eine laufende Serie altert im Wochentakt (23.09.2026)

Disney+ zeigte bei „Though I Am an Inept Villainess" die Folgen 1–8 auf Deutsch, 9–11 nur
japanisch. Unsere Pille behauptete „✕ DE 5–7" — das Gegenteil (Daniel: „gerade geprüft").

**Der Befund war richtig gemessen.** Die Erweiterung hatte am 26.08.2026 sieben Folgen
gesehen, davon vier mit deutschem Ton. Beides stimmte an diesem Tag. Vier Wochen später
hatte die Synchro aufgeschlossen, und aus einer Momentaufnahme war eine Falschaussage
geworden, ohne dass sich an unserem Datensatz etwas geändert hatte.

**Die Unterscheidung, um die es geht:** Ein Beleg „hier gibt es deutschen Ton" wird mit der
Zeit höchstens ungenau — eine Lizenz läuft aus, selten. Ein Beleg „hier gibt es **keinen**
deutschen Ton" über die zuletzt erschienenen Folgen einer **laufenden** Serie wird von jeder
neuen Synchrofolge widerlegt. Das sind zwei verschiedene Halbwertszeiten, und die
Wiedervorlage kannte nur eine: 180 Tage für Disney+, Netflix und Prime.

Seitdem: `fristFuer()` in `pipeline/lib/wiedervorlage-frist.ts` gibt einem solchen Beleg
**14 Tage**, danach steht er wieder in der Prüfliste der Erweiterung. Nur bei den Anbietern
mit Handprüfung — Crunchyroll, ADN und YouTube messen bei jedem Lauf nach. Gegenprobe gegen
den Bestand vor der Korrektur: genau ein Weg kommt zusätzlich auf die Liste, der betroffene,
28 Tage alt.

**Prüffrage bei jedem neuen Sprachbefund: Woran würde ich merken, dass er nicht mehr gilt?**
Bei einer abgeschlossenen Serie an nichts Bestimmtem — dafür ist die lange Frist da. Bei
einer laufenden am nächsten Sendetermin.

## JustWatch drosselt nach mehreren Läufen kurz hintereinander (23.09.2026)

Um einen einzelnen Titel schnell nachzufragen, liefen drei Abrufe in zehn Minuten: 60, dann
400, dann 500 Titel. Der dritte bekam **HTTP 429** — 400 von 500 Abfragen abgewiesen, und der
Plausibilitätsriegel verwarf den Lauf („1 von 9 Treffern ohne Angebot, 91 von 100 ohne
Treffer — nichts geschrieben"). Kein Schaden am Bestand, aber auch kein Ergebnis, und die
Quelle ist danach für eine Weile unbrauchbar.

**Die Ursache war kein Kontingent, sondern die Ungeduld:** Der gesuchte Titel stand in der
Warteschlange hinten, und statt auf den regulären Lauf zu warten, wurde die Grenze dreimal
erhöht. Die Schlange sortiert nach Dringlichkeit und Alter — wer einen bestimmten Titel
vorziehen will, hat dafür kein Mittel, und drei Läufe sind keins.

**Praktische Folge:** Ein JustWatch-Lauf je Tag genügt, mehr als einer je Stunde reißt das
Limit. Braucht ein einzelner Titel eine Antwort, ist der richtige Weg, ihn in der
Warteschlange nach vorn zu bringen (`kennungGewechselt`, `dringend`) — nicht, den ganzen Lauf
größer zu machen.

## aniSearch weist unsere Kennung ab, nicht unsere Leitung (23.09.2026)

Vier Tage lang lieferte `data:anisearch` nichts, und die Schweigen-Prüfung machte jeden
Bestandslauf rot. Die naheliegende Erklärung — aniSearch sperrt die GitHub-Runner — trägt
nicht. Gemessen von Daniels Anschluss, an denselben Kennungen aus dem Protokoll:

| Abruf | Kennung | Ergebnis |
|---|---|---|
| eigene Probe, 7 Adressen im 1,5-s-Takt | Chrome-Kennung | 6 × HTTP 200 |
| `fetch-anisearch.ts --limit 15` | `anime-kalender.de/1.0 (+…)` | 4 × HTTP 423, dann `fetch failed` |
| Gegenprobe, dieselbe Adresse, Minuten später | alle Kennungen | `ConnectTimeoutError` |

Zwei Dinge stehen damit fest: Die **423 hängen an der Kennung** — dieselbe IP, dieselbe
Minute, einmal mit und einmal ohne Antwort. Und **nach einigen Versuchen sperrt aniSearch die
IP ganz**, auch die von Daniels Anschluss.

Die ehrliche Kennung ist eine bewusste Entscheidung vom 09.08.2026 (eine gefälschte
Browser-Kennung nimmt dem Betreiber die Möglichkeit, den Verursacher anzuschreiben, statt ihn
auszusperren). Sie zu tauschen ist deshalb keine technische Kleinigkeit, sondern die Umkehr
dieser Entscheidung — sie gehört Daniel vorgelegt. Ein Mittelweg wäre, beides in eine Zeile zu
setzen: Browser-Signatur **und** Projektkennung mit Kontaktadresse.

**Solange die Sperre steht, wird nicht abgerufen** — jeder Versuch verlängert sie. Und: Der
Bestandslauf bricht zurzeit an einer gesperrten Fremdquelle ab, obwohl der Bestand in Ordnung
ist; ob die Schweigen-Prüfung dafür nur warnen soll, ist offen (Issue #214).

**Aufgelöst am 23.09.2026, 19:50 — Variante B.** Die Kennung trägt jetzt beides in einer
Zeile: vorn die Browser-Signatur, dahinter `anime-kalender.de/1.0` mit Adresse und Mail
(`pipeline/lib/kennung.ts`). Gegenprobe unmittelbar danach: `fetch-anisearch.ts --limit 6`
holte **6 von 6** Titeln, 5 mit deutschem Text, 6 mit Stream-Angabe. Die Sperre galt also der
Kennung, nicht der Leitung — und sie war nach vier Tagen mit einer Zeile behoben.

Wer sich zu erkennen gibt, bleibt ansprechbar: Die Kontaktadresse steht weiterhin im
Protokoll des Betreibers, nur nicht mehr als einziges Merkmal.

## Angekündigte Crunchyroll-Serien stehen nur in den Season-Artikeln (25.09.2026)

Anlass: Daniel fand Magic Knight Rayearth (2026) auf Crunchyrolls Startseite („Die Serienpremiere läuft am 07.10"), unser Panel sagte nur „Noch keine deutsche Fassung". Ergebnis: `data/ankuendigungen.yaml` (32 Titel) und eine Zeile im Antwortkasten.

**Was die Schnittstelle hergibt, gemessen mit dem anonymen Token (Katalog DE):**

- `/content/v2/cms/series/GT00383994?locale=de-DE` trägt `availability_status: "coming_soon"`, `availability_notes: "Die Serienpremiere läuft am 07.10"`, `season_tags: ["Herbst-2026"]`, `keywords: ["fall-2026", …]`, `episode_count: 0`. Die Auskunft steht also da — aber nur, wer die Kennung schon kennt, kommt an sie.
- **Keine Liste führt angekündigte Serien:** `discover/browse?type=series&sort_by=newly_added` über 1.000 Serien: 0 × `coming_soon`. `discover/browse?seasonal_tag=fall-2026`: 2 Serien (beide schon laufend). `discover/search` findet keinen der sechs von Daniel genannten Titel. Die Serien-Sitemap (`/sitemaps/series/M.xml`) führt nur das Rayearth von 1994.
- Die Startseite ohne Anmeldung lädt nur `discover/browse?…is_simulcast=true` (beliebte Simulcasts); den Bereich mit Premieren gibt es erst im angemeldeten Konto.

**Die Quelle sind Crunchyrolls Season-Artikel** (`/de/news/seasonal-lineup/…`), zweimal je Season:

- „Crunchyroll Anime-Lineup der Herbst-Season 2026" (15.09.2026): je Titel `OmU: <Datum>` und bei angekündigter Synchro `DE: TBA`, dazu Studio und Verfügbarkeit.
- „Crunchyroll kündigt die deutschen Synchros für Herbst 2026 an" (15.09.2026): die Liste der Synchro-Titel, ohne Termine.
- Die Seiten sind serverseitig gerendert (Next.js), der Text steht im HTML. robots.txt sperrt `*/search`, nicht `/news`. Die deutsche News-Sitemap (`/sitemaps/news/de-DE/latest.xml`) nennt nur Artikel der letzten Tage; die Season-Artikel findet man über die Kategorie `/de/news/seasonal-lineup`.

**Zuordnung:** 31 von 34 Titeln über Name **und** Japan-Start (±1 Tag), Rayearth (2026) über den Start 07.10.2026 (der Namensvergleich traf zuerst die Serie von 1994). Ausgelassen: Dreamland (114466, ohne Start), Paw & Palaces (166443, Start 03.12.2025), die ältere Ace-of-the-Diamond-Staffel.

**Befund nebenbei:** Black Clover Staffel 2 trug seit dem 15.09. den Hinweis „Eine deutsche Fassung ist noch nicht angekündigt" — am selben Tag hatte Crunchyroll sie angekündigt. Die Season-Artikel waren nie Teil eines Laufs.

**Offen:** Den Lineup-Artikel je Season automatisch lesen (Titelblöcke mit `OmU:` und `DE:`), statt ihn von Hand zu übertragen. Bis dahin ist `data/ankuendigungen.yaml` Handpflege. **PoC 08.10.2026** ([sammelartikel-poc.md](sammelartikel-poc.md)): der Leser liest beide Season-Artikel und trifft die Handdatei in 42 von 42 Lineup-Einträgen; Crunchyrolls Nutzungsbedingungen untersagen automatisierten Zugriff aber ausdrücklich (Abschnitt 5, Wortlaut dort), und Anime2You spiegelt beide Artikel am selben Tag — der empfohlene Weg.

## RTL+: Dragon Ball Daima steht in keiner Programm-Sitemap (25.09.2026)

Alle 212 Teilkarten von `programs.sitemap.xml` plus `programs.updated_48h.sitemap.xml` durchsucht (400 ms Takt): Unter „dragon-ball" stehen nur die Filme Broly (`p_182056`) und Super Hero (`p_182055`), Daima nicht — obwohl Daniel es am selben Tag dort mit Abo gesehen hat. Die Sitemaps sind also nicht vollständig; ein Titel ohne Sitemap-Eintrag ist kein Beleg, dass RTL+ ihn nicht führt. Für den Daima-Termin war die Adresse nicht nötig (Eintrag `dragon-ball-daima-rtlplus` in `streaming-herbst-2026.yaml`).

## News-Quellen im Vergleich: was früher, besser oder anders ist (25.09.2026)

Daniels Auftrag: weitere News-Quellen prüfen, angebunden wird nur, was früher, besser oder anders ist als unser Bestand. Gemessen am 25.09.2026, je Quelle ein Abruf.

| Quelle | Stand | Befund | Anbinden? |
|---|---|---|---|
| Anime2You (3 RSS-Feeds, schon angebunden) | aktiv | 113 Vorschläge 06.12.2025–24.09.2026, **103 nie eingearbeitet** (u. a. „25 Blu-ray-Termine verschoben", „30 Blu-ray-Termine verschoben"). Die Crunchyroll-Herbst-Ankündigung vom 15.09. steht **nicht** darin | läuft; Vorschläge einarbeiten ist der größte Hebel |
| Crunchyroll DE, Season-Artikel (`/de/news/seasonal-lineup`) | aktiv | Lineup mit `OmU:`/`DE: TBA` je Titel und eigener Synchro-Artikel; führte zu 32 Ankündigungen, darunter 13 Synchros, die bei uns fehlten | **ja** (von Hand übertragen, automatisch offen) |
| Crunchyroll DE, Wochenprogramm (selber Bereich) | wöchentlich aktualisiert | nennt nachgereichte Synchro-Pakete mit Datum: Hana-Kimi S2 Folge 10–12 am 02.10., You and I Are Polar Opposites S2 Folge 8–11 am 04.10., Mushoku Tensei S3 Folge 11–12 am 04.10. — bei uns endet der Stand bei Folge 9, 7 bzw. 10 | **ja** — gemessen: `data/crunchyroll.json` (Stand 25.09.2026, 18:45 UTC) deckt das Fenster 14.09.–04.10. ab, der letzte Synchro-Slot darin ist der 25.09. Der Kalender führt künftige Synchro-Folgen nicht im Voraus; das Wochenprogramm tut es |
| Crunchyroll DE, Einzelmeldungen (`/de/news/announcements`) | aktiv | Synchro-Starts (Sound! Euphonium S1, Fruits Basket, Jaadugar, Hana-Kimi S2) alle schon im Bestand über die Crunchyroll-Automatik | nein |
| manime.de (`/feed/`, robots.txt erlaubt alles) | aktiv | 10 Artikel in 6 Wochen, 2 zu Anime-Streaming (beide Daima); der Zensur-Artikel war dort zuerst | nein, zu selten |
| Anime News Network (`/all/rss.xml`) | aktiv | 175 Artikel/Woche, US-bezogen (englische Synchros, US-Preise, Trailer); keine deutsche Streaming-Auskunft | nein |
| animenachrichten.de (`/feed/`) | still seit 28.03.2025 | — | nein |
| aniSearch-News, peppermint anime, KAZÉ, Crunchyroll-RSS | kein nutzbarer Feed (404 oder leer) | aniSearch-Daten nutzen wir schon direkt | nein |

**Schwelle für eine Neubewertung:** Eine Quelle wird angebunden, sobald sie in einem Monat mindestens eine für uns relevante Meldung bringt, die weder im Bestand noch in den Anime2You-Vorschlägen steht. manime.de lag mit einer (Daima-Zensur) knapp darunter, zu selten für einen eigenen Lauf.

## PoC: Crunchyrolls Wochenprogramm gegen den Bestand (25.09.2026)

Leser: `pipeline/scrape-crunchyroll-woche.ts` (Playwright, weil Cloudflare `curl` nur 14 KB ohne Artikel gibt), Vergleich: `tools/crunchyroll-woche-poc.mjs`. Artikel „Wochenprogramm vom 21. bis 27. September", gelesen am 25.09.2026 gegen 22 Uhr.

- **51 Zeilen, 16 Synchro.** Zuordnung über die Serienkennung im Link, bei mehreren Titeln einer Kennung über die Staffelzahl im Artikeltitel: **16 von 16 eindeutig.**
- **11 der 16 tragen Folgen, die unser Bestand nicht kennt** — 6 davon Wochenfolgen dieser Woche (26./27.09.), die ohnehin anstehen; die wertvollen sind die drei nachgereichten Pakete mit eigenem Datum (Hana-Kimi S2 10–12 am 02.10., Polar Opposites S2 8–11 am 04.10., Mushoku Tensei S3 11–12 am 04.10.) und **Re:ZERO S4 Folge 14 am 23.09.**, die unser Kalenderabruf gar nicht geführt hat (Gegenprobe `data/crunchyroll-dub.json`, 21.09.: Synchro bei Folge 13 vom 09.09.).
- **Eine Zeile ist falsch:** Schleim S4 „Folge 22" am 25.09. Gegenprobe: Synchro-Folge 20 am 18.09. (Stand 19.09.), der Kalender nennt Folge 21 am 25.09. — das Wochenprogramm liegt eine Folge daneben. Es wird von Hand gepflegt.
- Die Wochentage stehen nicht in den `Column-N`-Kennungen (`Column-1` doppelt, Katalogtitel in `Column-15`), sondern als Überschrift in Dokumentreihenfolge. Synchro erkennt man an `deutschland-flagge.png`, OmU an `japan-flag.png`.
- `page.evaluate` unter `tsx` warf „__name is not defined": esbuild setzt in benannte Funktionen einen Helfer ein. Abhilfe: `page.addInitScript('window.__name = (f) => f')`.

**Folgerung für den Einbau:** Das Wochenprogramm darf **Termine in der Zukunft ergänzen**, aber keine gemessene Folge überstimmen, und eine Zeile, deren erste Folge nicht an unsere letzte gemessene anschließt, wird nicht übernommen, sondern gemeldet (der Schleim-Fall).

**Eingebaut am 25.09.2026 (Daniels „passt so" zur Regel).** `scrape-crunchyroll-woche.ts` läuft stündlich direkt hinter dem Kalenderabruf, entscheidet in `entscheiden()` und schreibt `uebernommen`, `abweichungen` und `ohneEintrag` nach `data/crunchyroll-woche.json`; der Bau hängt die übernommenen Folgen mit `wocheAnhaengen()` als Beobachtungen an den Kalendereintrag. Erster Lauf (lokal, 25.09.2026): 13 Folgen übernommen (Hana-Kimi S2 10–12, Polar Opposites S2 8–11, Mushoku S3 11–12, Iruma-kun S4 24, Jaadugar 7, 100 Girlfriends S3 34, Inept Villainess 9), 1 Abweichung als Vorfall (Ascendance of a Bookworm S4: Folge 21 am 26.09., der Kalender kennt zuletzt Folge 19 vom 12.09.), 1 ohne eindeutigen Eintrag (Das Band der Unterwelt). Zuordnung erst über den Titelschlüssel, dann über die Serienkennung, wenn sie genau einen Kalendereintrag trifft.


## „Alle Crunchyroll-Blöcke deutsch" gilt nicht für eine Staffel, die danach begann (27.09.2026)

„A Wild Last Boss Appeared!" Staffel 2 stand als „Auf Deutsch verfügbar" (Daniel: „die folge ist
nicht deutsch"). Unter der Kennung `GT00361955` kannte Crunchyroll beim Abruf am 21.09. nur
Staffel 1 (12/12 deutsch); `beurteile()` gab bei „alle Blöcke vollständig deutsch" jedem unserer
Einträge `dub: true`, auch der am 26.09. mit Untertiteln gestarteten Staffel 2.

Jetzt (`vollstaendigDeutsch()` in `pipeline/lib/crunchyroll-dub.ts`): kein Urteil für einen
Eintrag, dessen Synchro nur angekündigt ist (`ankuendigung.synchro`) oder der nach der Prüfung
beginnt (`ankuendigung.omuAb > geprueftAm`). Gemessen auf dem Bestand: 2 von 510 Urteilen fallen
weg — Last Boss Staffel 2 und Apothekerin Staffel 3, beide zu Recht.

**Verworfen:** Zuordnung über die Folgenzahl (Block ↔ Eintrag, Ketten, Rest 1:1). Crunchyroll zählt
zu oft anders (Iruma Staffel 4: 23 statt 24, Attack on Titan, Haikyu) — 74 echte Synchros hätten
ihr Urteil verloren. Zusicherungen: `check:cr-zuordnung`, „Last Boss: …".

**Der erste Fix griff im Bestandslauf nicht** (27.09.2026, am Morgen nachgemessen: Staffel 2 blieb
deutsch). Er las `title.ankuendigung` — das Feld hängt `mitAnkuendigung` aber erst beim Schreiben
von `titles.json` an, zur Zeit der Auswertung fehlt es. Die Zusicherungen setzten das Feld selbst
und waren deshalb grün. Jetzt liest die Regel `data/ankuendigungen.yaml` direkt, und eine
Zusicherung prüft den Titel **ohne** Feld. Allgemein: Eine Zusicherung baut den Titel so, wie ihn
der Bau an dieser Stelle kennt — nicht so, wie er am Ende in `titles.json` steht.

## Disc-Verschiebungen aus Anime2You-Sammelartikeln (27.09.2026)

Anime2You fasst verschobene Blu-ray-Termine in Sammelartikeln zusammen („25 Blu-ray-Termine von
AniMoon, Crunchyroll und KSM verschoben", news/1052846, 22.09.2026; „30 …", news/1045437,
01.09.; „Sechs …", news/1042244, 18.08.). Die Termine stehen nur in einer Tabelle Titel | Alt |
Neu, die im Feed-Auszug fehlt — bis heute las sie niemand, und 22 unserer Disc-Termine standen
auf überholten Tagen (Sakamoto Days Vol. 1 auf dem 28.08. statt dem 23.10.).

- **Abruf:** `scrape-anime2you.ts` holt je Lauf bis zu sechs Sammelartikel ohne gespeicherte
  Tabelle (`SAMMELARTIKEL`, auch ältere) und legt die Zeilen als `verschiebungen` am Vorschlag ab.
  Solche Vorschläge fallen nie aus der Datei.
- **Anwendung:** Phase 08 (`verschiebungenAnwenden`, `lib/disc-verschiebungen.ts`) verkettet die
  Artikel nach Datum. Übernommen wird nur, wenn der **Name** gleich ist (ohne Ausgabe in Klammern,
  `discSchluessel`) **und** unser Termin in der Kette als alter oder neuer Tag vorkommt. Die
  Handeinträge stammen aus denselben Artikeln und tragen deren Namen; ein Termin außerhalb der Kette
  kommt aus einer anderen Quelle und bleibt. Belege: der letzte Artikel aktuell, alle übrigen
  `ueberholt` mit „Termin verschoben auf: …".
- **Abweichender Name, gleiche Staffel (13.10.2026):** Zeilen „<Reihe> – Staffel N" treffen auch einen
  Disc-Eintrag mit Eigennamen („Sailor Moon – Staffel 3" ↔ „Sailor Moon S"; `lib/disc-verschiebungen-staffel.ts`).
  Bedingungen: kein Eintrag gleichen Namens mit Kette; sein Name beginnt mit dem Reihennamen der Zeile
  (bei mehreren der längste); sein Titel ist die N-te Staffel der Reihe, und **beide** Zählweisen
  (Position der Fernsehstaffeln, `staffelnDesFranchise`; Panelzählung, `staffelStaende`) nennen N, ohne
  Teil. Sonst bleibt der Termin stehen (Reihen mit geteilter Staffel, Beiwerk, nur einer Staffel); ein
  Film hat keine Nummer. Der Termin muss wie sonst in der Kette stehen. Anlass: Sailor Moon Staffel 3–5
  standen auf den aniSearch-Tagen vor der Verschiebung (Anime2You 1045437), von Hand berichtigt.
  Geprüft von `check-disc-verschiebung-staffel.ts`.
- **Jahr:** Die Tabelle nennt keins. Ein neuer Tag vor dem Artikel liegt im Folgejahr, ein alter bis
  ein halbes Jahr davor bleibt im Jahr.
- **Gemessen am 27.09.2026:** 61 Zeilen aus drei Artikeln, 22 treffen einen Termin, alle 22 mit
  unserem Datum in der Kette. Nicht getroffen: Titel, die wir nicht führen (Sailor Moon S2–5,
  Strike Witches Vol. 2–3 u. a.), und abweichende Namen — Takamine hieß bei uns „Please Put Them
  On" (auf den deutschen Namen umgestellt), Afro Samurai von Hand nachgetragen. Offen bleiben die
  aniSearch-Einträge „Sakamoto Days: Teil 2 – Vol. 4" (18.12., laut Tabelle 25.12.) und „Miss
  Kobayashi’s Dragon Maid S" (06.11., laut Tabelle 04.12.) — `disc-anisearch.yaml` ist erzeugt,
  eine Handänderung ginge verloren.
- **Einzelmeldung mit Verschiebung** („nicht wie geplant am 2. Oktober, sondern erst am 20.
  November"): `terminDerMeldung` nimmt den späteren Tag. Vorher stand Gantz auf dem alten.

## Eine Messung vor dem Untertitel-Start sagt nichts über die neue Staffel (27.09.2026)

„A Wild Last Boss Appeared!" Staffel 2 stand auf Deutsch, obwohl Crunchyroll sie seit dem 26.09.
nur mit Untertiteln zeigt. Der erste Fix (`vollstaendigDeutsch`) ließ sie ohne Urteil — danach
setzte die **Katalog-Runde** (`09-4-3-katalog.ts`) das Ja: Der deutsche Katalog vom 09.09. kannte
unter der Kennung nur Staffel 1 (`staffeln: 1`, `de-DE`), und „genau eine Staffel = genau ein
Werk" galt auch für unseren zweiten Eintrag an derselben Adresse. Bei Black Clover S2 kam das Ja
aus **Phase 09-1**: Jedes Release gilt dort als Synchro-Beleg, auch der geschätzte Termin, der nur
der Untertitel-Start ist.

Nachtrag (Bestandslauf 36330536301): alle vier ohne Ja, 0 falsche Meldungen — aber Black Clover S2 verlor seinen einzigen Verweis. Ein Befund aus `crunchyroll-offene.json` vom 16.09. („das Werk steht unter dieser Adresse nicht") entfernte ihn; bisher verdeckt, weil der Verweis fälschlich deutsch war. Dieselbe Sperre gilt jetzt auch für diese Befunde (`b.geprueftAm`); im nächsten Bestandslauf war der Verweis zurück, ohne Ja (bestätigt 27.09.2026, 21:06).

Bei der Apothekerin S3 setzte die **Blocknamen-Runde** (`ordneCrBloeckeZu`) das Ja — gefunden mit
einem Beobachter am Verweis im lokalen Messbau (Aufrufstelle `09-4-2-bloecke.ts:144`).

Regel: `vorDemStart(titel, stand)` — liegt `omuAb` der Ankündigung nach dem Messstand, spricht die
Messung nicht über den Titel (Blockliste `geprueftAm`, Katalog `geholtAm`). In der Blockzuordnung
kommt ein solcher Titel gar nicht erst in die Gruppe seiner Serie. Ein geschätztes,
noch ausstehendes Release belegt keine Synchro. Die Sperre hängt am Messstand, nicht an der
Ankündigung — eine Prüfung nach dem Start urteilt wieder (die erste Fassung hätte eine angekündigte
Synchro auch nach ihrem Erscheinen gesperrt). Gemessen: genau vier Titel betroffen (Last Boss S2,
Black Clover S2, Apothekerin S3, Reincarnated Aristocrat S3), alle mit angekündigter Synchro.

**Lehre:** Wer ein Urteil zurücknimmt, prüft, welche spätere Runde leere Urteile füllt — gemessen,
nicht gelesen: ein Setter auf `stream.dub` mit Aufrufstelle zeigt sie in einem Messbau. Der lokale
Bau bricht am Cache-Abbruch ab; zum Messen die Schwelle nur lokal anheben und danach alle Ausgaben
zurücksetzen. Titel, die der lokale Cache nur als Katalogeintrag kennt (hier drei der vier), zeigt
erst der Bau auf GitHub. Gegenprobe am 27.09.2026: Bau ohne und mit Fix unterscheiden sich lokal in
genau einem Urteil (Apothekerin S3).

## Erkannt am 02.10.2026: das Crunchyroll-Wochenprogramm widerlegt deutsche Termine

Vier Befunde eines Tages, alle an Overgeared und Apothekerin S3 gemessen. Sie gehören zusammen,
weil sie **dieselbe Schwachstelle** zeigen: Wir lesen Crunchyroll an mehreren Stellen und führen
die Ergebnisse nicht gegeneinander.

**1. Der deutsche Slot trägt den Weg selbst — nicht der Katalog.** `data/crunchyroll.json` führt
den deutschen Simulcast (`rawTitle: "… (Deutsch)"`, `german: true`), der deutsche Katalog
`data/cr-katalog-de.json` die Serie aber nicht — und **alle Runden in
`pipeline/bau/09-4-3-katalog.ts` beurteilen nur vorhandene Wege** (`stream.dub = …`), keine legt
einen an. Ergebnis: Overgeared lief ab dem 27.09. deutsch und hatte **keinen** Weg, das Panel sagte
„Noch keine deutsche Fassung". Gemessen betraf das **fünf Serien** (Overgeared, Aoashi, Elainas
Reise, Fruits Basket, Anime Awards). Behoben über `ergaenzeCrWeg()`
(`pipeline/bau/titel-hilfen.ts`), gerufen in `06-cr-simuldubs.ts`.

**2. Ein laufender Simulcast ist keine Kataloglieferung.** AniList kennt für **laufende** Serien oft
keine Folgenzahl (`episodes: undefined`), und der Zweig „nur einmal gesehen und eine Folge"
(`seenDates.length < 2 && (knownEpisodes ?? 1) === 1`) machte daraus `releaseType: 'batch'`. Folge:
`istStaffelstart()`/`istStaffelfinale()` (`shared/tv-signale.ts`) verlangen `weekly` — Overgeared
verlor Premieren-Stil und Fortschritt, die Karte sagte „Folge 1/1". Behoben über
`laufendeSerieImSlot()`: TV/ONA aus dem laufenden oder dem Vorjahr ist ein Simulcast; Filme,
Specials und alte Serien bleiben `batch`.

**3. Das Wochenprogramm ist ein Widerlegungsbeleg.** `data/crunchyroll-woche.json` führt je Serie
`sprache: ja|de` mit Tag und Folge. Fehlt für denselben Tag das `de`, obwohl wir dort einen
deutschen Termin führen, ist das ein **starker Beleg vom selben Anbieter**: Es kommt keine deutsche
Synchro. Gemessen am 02.10.2026: 180 Crunchyroll-Releases mit deutschem Termin, **2** im Fenster der
Vorschau — und **beide widerlegt**: Apothekerin S3 (02.10.) und Black Clover S2 (03.10.).
**Unterschied:** Eine **Ankündigung** braucht eine Meldung (der Leser hat sie gesehen), eine bloße
**Schätzung** verschwindet von selbst. Merksatz: **widerlegt wird immer, gemeldet wird nur, was
vorher behauptet wurde.** Der Mechanismus dafür steht bereit: `zurueckgezogen` in
`pipeline/lib/news-verlauf.ts`.

**Gebaut am 02.10.2026** in `pipeline/bau/widerlegung-woche.ts`: Die Prüfung setzt `Release.widerlegt`
vor dem Auffalten (kein Ereignis, keine „Erste Folge erscheint heute") und erzeugt die
`zurueckgezogen`-Meldung nur bei behaupteten Terminen (`gemeldet`). Das Gedächtnis
`data/widerlegte-termine.json` trägt sie über das Wochenfenster hinaus. Belegt am gebauten Bestand
(Lauf `37008356908`): Apothekerin S3 mit Meldung, Black Clover S2 still.

**4. `observed` darf nichts aus der Zukunft tragen.** `observed` entsteht aus den Slots des
Kalenders und ist als „welche Folge wir wann gesehen haben" dokumentiert — bei Overgeared stand dort
`{1: 27.09., 2: 04.10.}`. Eine künftige Beobachtung ist keine; sie wandert in den Sendeplan
(`termineAusPlan()`, `shared/logic.ts`), nicht in die Beobachtung, und macht den Antwortkasten sonst
„fertig" (`raus: raus || gesamt` in `web/src/components/detail/antwort-berechnen.ts`), sodass
„Alle 12 Folgen auf Deutsch" ohne Fortschrittsbalken dasteht.

**Die gemeinsame Lehre:** Vier Stellen lesen denselben Anbieter — Kalender, Wochenprogramm,
neuer-Folgen-Feed, deutscher Katalog — und **keine vergleicht sich mit den anderen**. Ein deutscher
Weg darf nicht davon abhängen, welche Stelle ihn zufällig gefunden hat.

## Crunchyrolls Season-Lineup-Artikel: in Edge lesbar, von hier nicht (02.10.2026)

- **Was funktioniert:** In Daniels Edge (Claude-Erweiterung) rendert der Artikel vollständig —
  `<article>`, `<h1>`, je Titel „Studio / OmU: <Datum> / DE: TBA", dazu „Veröffentlicht" und
  „Aktualisiert" mit Uhrzeit. Ein Update steht als eigene Zeile oben („UPDATE 1. Oktober: Dragon
  Ball Super: Beerus wurde hinzugefügt!").
- **Bauart:** Next.js mit React Server Components (`self.__next_f`), Inhalt aus **Storyblok**
  (Space 178900, Bilder von `a.storyblok.com`). Beim Laden gibt es **keinen** JSON-Abruf für den
  Text — er steckt serverseitig gerendert im HTML. Deshalb liefert ein Abruf ohne Browser nur die
  Cloudflare-Hülle (gemessen 28.09.).
- **Verworfen, von Daniel bestätigt (02.10.2026, „Weiter von Hand"):** Storyblok-CDN-API mit dem öffentlichen Token aus dem Seitencode —
  technisch naheliegend, aber ein fremdes Frontend-Token in unserem Abruf ist eine Grauzone; die
  Erweiterung blockt das Auslesen ohnehin („sensitive key").
- **Gewählter Weg:** Abgleich von Hand über Edge, wenn ein Artikel ein Update trägt. Am 02.10.:
  56 Titel, 13 mit „DE: TBA" (deckt sich mit `data/ankuendigungen.yaml`), neu nur Beerus
  (AniList 206814, OmU 11.10., keine DE-Zeile) — eingetragen.

## Crunchyrolls Simulcast-Kalender: `date` nimmt jeden Tag, die Seite belegt Ausfälle (02.10.2026)

- `simulcastcalendar?filter=premium&date=<Tag>` nimmt **jeden** Tag, nicht nur den Montag, und zeigt
  dessen Woche (gemessen: `date=2026-09-30` → 28.09.–04.10.). Die News verlinken deshalb den Tag der
  Meldung — zwei Meldungen derselben Woche behalten getrennte Links.
- Die Seite ist ein brauchbarer Beleg fürs Ausbleiben: Am 30.09. führte sie Hana-Kimi Staffel 2
  Folge 12 auf Französisch, Spanisch, Portugiesisch, Folge 13 auf Englisch, **keine** deutsche Kachel;
  am 02.10. „(DEUTSCH) Folgen 10–12". Vergangene Wochen bleiben abrufbar.
- Bildbeleg (Playwright, Desktop-UA, 1400 px, ganze Seite, JPEG 50): rund 380 KB, HTML.gz rund
  60 KB. Der OneTrust-Cookie-Banner (`#onetrust-consent-sdk`) liegt quer über dem Kalender und wird
  vor der Aufnahme entfernt, nicht beantwortet (`pipeline/messbelege.ts`).

## Crunchyroll-Simulcast-Kalender entfallen, Wochenprogramm ist die Quelle (27.10.2026)

- **Befund:** `/de/simulcastcalendar` antwortet seit ~21.10.2026 mit 302 auf `/de/simulcasts` (200, „Simulcasts durchstöbern", keine
  Challenge; Stundenlauf 40477608641, 27.10. 09:02 UTC, Diagnose aus PR 2161). Der Kalender-Abruf (`scrape-crunchyroll.ts`) und
  seine Workflow-Schritte (stündlich, täglich, wöchentlich) sind entfernt, ebenso die Quelle `crunchyroll` in `source-health.json`
  und `quellen-fristen.mjs`. Die Adresse wird nicht ersetzt: kein neuer Host, kein neuer Pfad, also keine neue robots-/AGB-Prüfung
  (das Wochenprogramm unter `/de/news/seasonal-lineup/…` las der Lauf schon; robots.txt sperrt `/news` nicht, gemessen 25.09.2026).
- **Messung (Wochenprogramm gegen Kalender, aus der Git-Historie, ohne Abruf):** Von 15 deutschen Kalender-Slots (12.–21.10.) stehen
  11 im Wochenprogramm derselben Woche mit gleichem Tag, gleicher Uhrzeit und enthaltener Folge (11/11 Übereinstimmung). Die 4 übrigen
  sind Abweichungen des Kalenders, keine Lücken: Appraisal S3 F1 (Vorab-Folge am 18.10., das Programm führt Synchro ab F2 am 25.10.),
  Re:ZERO S4 F15 (15.10., Programm F14 am 14.10. und F16–17 am 21.10.), Tomb Raider King F12 (Kalender 21.10., Programm 14.10.),
  Snowball Earth F13 (12.10., keine Programmzeile). Der Kalender führte nie deutsche Folgen in der Zukunft (letzter Synchro-Slot
  21.10., Fenster bis 01.11.); das Wochenprogramm reicht eine Woche voraus.
- **Echte Lücke:** Neue Serien. Das Wochenprogramm hängt Folgen nur an vorhandene Einträge; `ohneEintrag` führte am 27.10. zwei
  (Die Tagebücher der Apothekerin S3, A Wild Last Boss Appeared! S2). `lib/woche-neue-eintraege.ts` legt sie jetzt an (nur Synchro-Zeilen
  ab heute mit Kennung und Uhrzeit; ist die Kennung unter anderem Namen schon geführt, bleibt es bei der Meldung). Die Beobachtungen
  tragen `quelle: 'woche'` (Ankündigung, nicht gemessen). Beide Serien sind kuratiert (`last-boss-s2-crunchyroll`,
  `apothecary-diaries-s3-cour1`); das Anlegen ergänzt also vor allem Kalenderbeobachtungen, kein neues Release. Ein Einzeltermin einer
  wirklich neuen, unkuratierten Serie wird in `06-cr-simuldubs.ts` als Einzeltermin-Batch geführt (bekannte Grenze, nicht gebaut).
- **Beleglink:** `bau/cr-quelle.ts` (`crQuelleUrl`): Termine mit Wochenprogramm-Beobachtung verweisen auf den gelesenen Artikel
  (`artikel` in `crunchyroll-woche.json`), reine Kalendertermine behalten den historischen Link `/de/simulcastcalendar` (leitet auf
  `/de/simulcasts` um; kein besserer Beleg für damals gemessene Termine). Meldungslinks (`quelle`) und die Quellenseite verweisen seit dem Folge-PR auf die Übersicht `/de/news/seasonal-lineup` (stabil, der Wochenartikel wechselt je Woche); die Foto-Belege (`messBeleg`) behalten den Kalenderlink, sonst verschmölze das Entdoppeln sie mit dem Wochenartikel. Die Wochendatei liest `crQuelleUrl` einmal je Prozess. Früher nicht angefasst:
  `lib/news-verspaetung.ts` (`kalenderTag`, Meldungslink) und die Quellenseite in `web/src/components/StaticViews.tsx`.
- **Folge, Grenze:** `data/crunchyroll.json` `window.to` steht auf 21.10. (letzter gelesener Tag); `termine-pruefen.ts` urteilt nur im
  Fenster. **Die Ausgeblieben-/Verpasst-Erkennung für Crunchyroll endet damit mit dem Kalender:** Termine nach dem 21.10. kann sie nicht
  mehr als verpasst führen (vom Prüfer mit altem und neuem Fenster gemessen: 0/0/0 neu/nachgeholt/verpasst, `termine-verpasst.json`
  byte-gleich); das Wochenprogramm bestätigt nur, es belegt kein Ausbleiben. Möglicher kleiner Ersatz (nicht gebaut): Wochenprogramm-Zeile
  vorhanden, Folge am Sendetag nicht im Crunchyroll-Katalog (`crunchyroll-neu`) → „ausgeblieben“-Kandidat.
- **Foto-Belege (Folgepunkt, 27.10.2026):** `messbelege.ts` legt keine Kalenderfotos mehr an (`lib/messbeleg-auftraege.ts`, `KALENDER_ERREICHBAR = false`): das
  Bild von `kalenderTag(tag)` zeigte die Zielseite der Umleitung, nicht den Tag. Bereits abgelegte Fotos bleiben. Wächter: `check-messbelege-kalender.ts`.
- **Nicht gebaut:** News-Artikel unter `/de/news/latest` (`cr-news-api-service…`) als zweite Quelle. Kein Bedarf aus der Messung; Sprache
  und Uhrzeit stehen dort nicht verlässlich. Bleibt Option, falls das Wochenprogramm ausfällt.

## aniSearch hat eine freie Database-API — Konto und OAuth sind dafür nicht nötig (02.10.2026)

Der Kopfkommentar von `pipeline/fetch-anisearch.ts` („offizielle Schnittstelle mit OAuth-Zugang … ein Konto kann nur der
Betreiber anlegen") ist überholt. Gelesen am 02.10.2026 auf `api.anisearch.com/docs` (`api_database.html`,
`api_database_anime.html`, `api_user_oauth.html`; die Wiedergabe stammt aus einem Abruf — Einzelwerte vor dem Bau gegen die Seite prüfen):

- **Database API** (`https://api.anisearch.com/v1/anime/`) ist **ohne Token nutzbar**; ein Token ist optional und kommt per
  Mail an `api@anisearch.com` („with your project and planned integration"). **OAuth 2.0 gehört zur User API**
  (Bewertungen, Einreichungen) und wird fürs Lesen nicht gebraucht.
- Pflicht: aussagekräftiger `User-Agent` (`MyApp/1.0 (kontakt@…)`), sonst HTTP 403. Limits: 30 Anfragen je IP, nachgefüllt
  mit 1 pro Sekunde; Titeldaten werden 3/5/7 Tage gecacht; ein ungültiger Token sperrt die IP 24 h; bei 429 gilt `Retry-After`.
- Endpunkte: `/{id}` (Titel, `external_ids` MAL und AniDB — **kein AniList**, Genres main/subsidiary/tags, Cover medium/large,
  Score, `related`, `releases` je Sprache mit Publisher, Synopse, `dubbed`), `/{id}/full` (mit Episoden, Figuren, Staff),
  `/{id}/episodes`, `/{id}/characters` (**Sprecher je Sprache**), `/{id}/staff`, `/titles` und
  `/associated?source=myanimelist|anidb` (Gesamtlisten, 1× je 24 h ohne Token, 1× je Stunde mit Token), `/ratings`.
  Listen- und Bereichsabfragen (bis 10 IDs) brauchen einen Token. Parameter `lang=de`, `gzip`.
- Bedingungen: aniSearch als Quelle nennen; eine Synopse mit `source: anisearch` nur mit Link zum Eintrag direkt daneben
  (das Panel führt `deSource` bereits).
- **Folgen für uns:** `/associated?source=myanimelist` ersetzt die lückenhafte AniList-Brücke der anime-offline-database
  (150 Titel im Hauptbestand ohne Kennung, `befund-2026-10-02.md`) in **einer** Anfrage, über unsere `malId`.
  `/{id}/full` ersetzt Hauptseite, Folgenseite und Sprecherseite durch eine Anfrage; mit Token sind 10 Titel je Anfrage möglich.

## Crunchyroll: Weg auf fremde Serie, und Verspätung der Uhrzeit (04.10.2026)

- **Falscher Serien-Link (Reborn as a Space Mercenary):** AniList führte als Streaming-Link `crunchyroll.com/reborn` — das ist die Serie „Reborn!" (`GRNQ13VQR`), nicht die Simuldub-Serie (`GT00384006`). `ergaenzeCrWeg` (`pipeline/bau/titel-hilfen.ts`) ergänzte den Slot-Weg nicht, weil schon ein Crunchyroll-Weg da war, und der falsche blieb. Jetzt ersetzt der deutsche Slot einen Weg auf eine andere Serie. Gemessen an den Live-Daten am 04.10.2026: 1 Abweichung unter 345 Crunchyroll-Releases — genau dieser Fall.
- **Uhrzeit:** Overgeared Folge 2 erschien am 04.10.2026 um 16:34, der Kalender sagte ~16:30, um 16:33 war sie noch nicht da. Crunchyroll stellt Folgen also einige Minuten nach der Kalenderzeit online; wir lassen die Kalenderzeit stehen (Daniel, 04.10.2026: „mehr eine Notiz an uns").

## Handbeleg mit Crunchyroll-Adresse: Der Weg wurde angelegt und zweimal wieder entfernt (14.10.2026)

Der Auftrag nahm an, nur Amazon-Belege legten einen Weg an. Gemessen stimmt das nicht: `09-2-linkpruefung.ts` („Verweise, die es nur von Hand gibt“) legt für **jede** Plattform einen Weg an, wenn der Titel dort keinen hat; nur `available: false` und tote Adressen legen nichts an. Von 44 Nicht-Amazon-Handbelegen mit Adresse ohne Weg (Anime, Stand `public/data` 14.10.2026) tragen 43 ein Nein (3 davon ohne Titel im Bestand); offen war allein Durarara!! Tenka Taihei (10006986). Bei den Cartoons fehlt nur dort ein Weg, wo ein Nein steht (3 Angry-Birds-Titel). Es ist also keine Absicht und keine Zuordnungsliste nötig.

Spur durch den Bau (Ersatz-Cache-Bau, Zwischenstände je Phase): Der Weg steht nach `09-2` bis einschließlich `09-7`. Zwei Stellen entfernten ihn:

1. `ordneCrSerienZu` (`09-4-1-serien.ts`): `data/crunchyroll-dub.json` hält für `G619XVNEY` ein „nicht mehr verfügbar“ aus dem US-Katalog vom 21.08., und der Bau entfernt über die **Kennung** alle Adressen der Serie. Jetzt schlägt ein Handbeleg „deutsch“ mit genau dieser Adresse ein US-Nein (`istHandbelegterJaWeg`, `lib/handbeleg-weg.ts`); ein „nicht verfügbar“ des deutschen Katalogs entfernt weiter alles.
2. `schliesseWegeAb` (`11-wege-abschluss.ts`) leerte die Wege aller Titel nur bei aniSearch (Kennung ab 10 Mio.), damit keine erratenen Wege bleiben. Durarara!! Tenka Taihei ist so ein Titel. Jetzt bleibt der Weg, den ein Handbeleg „deutsch“ mit Adresse trägt, mit `herkunft: 'handbeleg'` (`behalteNurHandbelegteWege`).

Bau-Vergleich (Ersatz-Cache, Basis `5f19fbc21`): Durarara!! Tenka Taihei bekommt den Crunchyroll-Weg; die beiden Heart-Throb-Titel (18671, 20889) tragen statt der alten kurzen Adresse die Adresse ihres Handbelegs (Daniel, 13.09.). Nicht angefasst, aber derselben Ursache (US-Nein über die Kennung, deutscher Katalog führt die Serie): Digimon (552), Digimon 02 (1313) und SNAFU Climax (108489) verlieren weiter die Adresse, die der Bau ihrer Kennung zuordnet (`data/verweise-entfernt.json`). Durarara!! (6746) behält seinen Weg `crunchyroll.com/durarara`; verloren geht nur `crunchyroll.com/de/durarara`, die Adresse mit der Kennung `G619XVNEY`. Durarara!! Specials (8408) steht seit dem 13.10. nicht mehr im Hauptbestand. Der zurückgeholte Weg trägt keine Meldung „neu auf Deutsch“ oder „jetzt auch bei“ (`meldetNeu` in `lib/news.ts`): Er belegt das Angebot, nicht seinen Beginn — die Folge ist laut `crunchyroll-dub.json` seit 2022 deutsch, die Meldung trüge den Aufnahmetag 07.10. Ein jüngeres `available: false` zur selben Adresse nimmt dem Ja den Weg. Zusicherung: `pipeline/check-handbeleg-weg.ts` (in `check:logic`).

**Nachtrag 24.10.2026 – US-Nein trifft nur die US-Adresse (`lib/cr-us-nein-adresse.ts`).** Belegt der deutsche Katalog dieselbe Serienkennung mit mindestens einer deutschen Folge (`staffeln[].deutsch > 0`), behält ein Weg auf eine `/de/`-Adresse sein Leben, auch wenn ein US-Satz die Serie als „nicht verfügbar“ meldet; ein deutsches „nicht verfügbar“ oder eine Serie ohne Staffel entfernt weiter über dieselbe Kennung. Gemessen an `data/crunchyroll-dub.json` und den 707 Crunchyroll-Wegen aus `data/verweise-entfernt.json` (Stand 24.10.2026): von den fünf Titeln des Fundes (Durarara!!, Specials, Digimon, Digimon 02, SNAFU Climax) wäre heute nur SNAFU Climax betroffen, dessen deutscher Satz drei Staffeln mit 0 deutschen Folgen zählt (`ja-JP`): ohne deutschen Ton kein Beleg, der Weg fällt wie bisher. Die anderen vier tragen inzwischen deutsche Sätze statt eines US-Satzes. Heutige Wirkung auf den Bestand: keine; die Regel schützt künftige Fälle.

## Tokyo Revengers Staffel 3: Disney+-Start verpasst, falsche Crunchyroll-Zuordnung (04.10.2026)

Daniel am 04.10.2026: „War of the Three Titans" lief bei Disney+ auf Deutsch, im Kalender fehlte der Titel komplett, und die News behauptete „Neu auf Deutsch bei Crunchyroll".

**Ursachen, vier getrennte:**
1. **Crunchyroll-Serie mit einer Staffel ≠ jeder verlinkte Titel.** `09-4-3-katalog.ts` vergab `dub = true` an jeden Titel, dessen Crunchyroll-Adresse auf eine Serie mit genau einer Staffel zeigt. „Tokyo Revengers" hat dort eine Staffel (24 Folgen, Staffel 1); AniList verlinkt aber auch Staffel 2 (13+13) und Staffel 3 (13) auf dieselbe Adresse — 24 + 39 Folgen für eine Serie mit 24. Jetzt: `pipeline/bau/cr-serie-geteilt.ts` (Summe der Folgen je Serienkennung; übersteigt sie die Katalogzahl, trägt die Serienebene für keinen, und der Weg fällt bei den Titeln ohne passende Folgenzahl weg). Gemessen an den Live-Daten: 2 Serien betroffen (die andere, 86 EIGHTY-SIX mit 23 gegen 26, bleibt unberührt).
2. **Anime2You meldete den Start, wir lasen die Meldung nicht als Termin.** Artikel 1056867 (02.10.2026, 19:55): „Ab sofort: »Tokyo Revengers: War of the Three Titan Arc«, Sprache: Deutsch, Japanisch (UT), Simulcast: Jeden Samstag um 19:00 Uhr, Stream: Disney+". `leseSammelartikel` kannte „Ab sofort:" nicht (nur Tage und Monate), und die Überschrift „Disney+ ergänzt zwei weitere Anime-Titel auf Deutsch" passte auf kein Muster von `ANBIETER_SAMMELARTIKEL`. Beides behoben („Ab sofort" = Tag der Meldung; Disney+-Überschriften).
3. **Der Titel stand nicht im Bestand.** `releasesAus` findet nur Titel, die der Bestand führt; die AniList-Staffel 178083 hat keine belegte Synchro und kam nie hinein. Für diesen Fall steht ein kuratierter Eintrag in `data/curated/streaming-herbst-2026.yaml`. **Offen:** Titel aus Sammelartikeln mit deutschem Ton automatisch aus dem AniList-Katalog ergänzen (wie `titelAusKatalog` bei Crunchyroll-Slots); der Artikelname („Titan Arc") deckt sich nicht mit AniList („Titans"), ein reiner Namensabgleich genügt nicht.
4. **Weitere verpasste Disney+-Starts** (Anime2You, Recherche 04.10.2026, nicht im Bestand geprüft): Classroom of the Elite S1 (06.09.), A Sign of Affection S1 und Shield Hero S1 (20.09.), One Piece Staffel 9–16 und Snowball Earth (24.09.), Demon Slayer Infinity Castle I, JJK 0, Yu-Gi-Oh! S4 (27./28.09.), SPY x FAMILY S1–2 (04.10.), Naruto Shippuden S3 (07.10.), Honey Lemon Soda (03.11.). In `releases.json` standen nur sieben Disney+-Releases, der jüngste vom 30.08.
   **Stand 13.10.2026 (Abgleich gegen `releases.json` von `main`, `data/curated/*.yaml` seit dem 05./06.10.):** Classroom of the Elite S1, Shield Hero S1, Demon Slayer Infinity Castle I, JJK 0, Yu-Gi-Oh! S4, SPY x FAMILY S1–2, Naruto Shippuden S3 und Honey Lemon Soda stehen im Bestand (kuratiert oder aus dem Sammelartikel-Leser). **Offen und von der neuen Regel nicht gelöst:** One Piece Staffel 9–16 (Block „Episoden: 207 bis 405 (komplett)“ — der Leser kennt nur „N (komplett)“, keine Spanne; es gibt gar keinen Disney+-Release zu One Piece) und A Sign of Affection S1 (steht in keinem der 36 Sammelartikel, die `data/proposals/anime2you.json` führt). **Gelöst durch die Regel „die ersten N Folgen auf Deutsch“ (`lib/sammel-erste-folgen.ts`):** Snowball Earth, Disney+, Folge 1–6, im Angebot seit dem Meldetag 24.09. Im Bestand entsteht der Termin erst, wenn der Artikel 1053610 wieder gelesen wird — sein Vorschlag ist aus `anime2you.json` gefallen (Quelle kuratiert, alle Tage vergangen), der Lauf liest nur geführte Artikel nach. Die Regel greift also für künftige Meldungen; Snowball Earth selbst bleibt bis dahin Sache des Handbelegs (PR „Snowball Earth – alle 13 Folgen deutsch“).

**Disney+ als Quelle:** Die HTML-Kopie der Serienseite nennt kein Veröffentlichungsdatum (kein JSON-LD, nur „Neue Folge"-Kachel „Staffel 3 Folge 1"); Disney zählt drei Staffeln (S2 und S3 zusammen), AniList vier. Ein URL-Parameter für die Staffel ist nicht bekannt. Disney+-robots.txt sperrt alle Bots außer Suchmaschinen — Daten nur über Anime2You (REST-API `wp-json/wp/v2/posts?search=Disney%2B`, RSS, robots offen) und die Browser-Erweiterung.

**„Teil 2" bei Tenjiku Arc:** `ergaenzeTeilnamen` (`adn-teilnamen.ts`) hängte „– Teil N" an, weil AniLists englischer Titel „Season 2 Part 2" heißt. Ein Arc-Name im deutschen Titel braucht die Nummer nicht; aniSearch führt kein „Teil 2".

### Nachtrag 04.10.2026, abends: die Summenregel war zu grob (Messung am Zwischenstand, nicht am Endstand)

Die erste Fassung der Regel „geteilte Crunchyroll-Serie" (Folgensumme der Titel übersteigt die Katalogzahl) wurde am **Endstand** gemessen (2 Serien betroffen, `tools/anilist-links-pruefen.mjs`) und griff im Bau trotzdem nicht: Beim Prüfen der Katalog-Runde stehen die Adressen noch ohne `/series/<Kennung>`, der Bau normalisiert sie erst später. Mit der Auflösung über das Kennungsgedächtnis wurden es plötzlich **20** — darunter Hunter x Hunter, Gundam Seed, Arifureta, Though I Am an Inept Villainess und Dragon Ball: dort führt Crunchyroll nur einen Teil der Folgen, die Wege stimmen. Ein bereits gestarteter Bestandsbau wurde abgebrochen, bevor er committete. **Lehre:** Eine Regel im Bau wird am **Zwischenstand des Baus** gemessen (lokaler `npm run data:build` mit einer Log-Zeile je betroffenem Titel), nicht an `public/data`; und sie wird erst gepusht, wenn die Liste der Betroffenen einzeln angesehen ist. Die geschärfte Regel entfernt nur, wo ein **einziger** Titel die Folgenzahl der einstufigen Serie hat (Tokyo Revengers S1 24, Dragon Ball Daima 20, Spice and Wolf 2024 25, Steins;Gate 24): 12 Wege, alle mit eindeutigem Eigentümer.

## Cover-Bilder: woher Datenbanken sie beziehen, was für uns in Frage kommt (04.10.2026)

Frage von Daniel: Sind die Cover bei AniList nur URL-Verweise, und gibt es öffentliche, verlässliche Bildquellen, die wir kostenlos nutzen können?

**Stand bei uns:** Ja, nur Verweise. `titles.json` führt je Titel `coverImage` als Pfad hinter `s4.anilist.co/file/anilistcdn/media/anime/cover/`; der Browser lädt das Bild
von AniLists Server (Hotlink). Wir speichern kein Bild. 2.785 von 2.785 Bestandstiteln haben ein AniList-Cover. In `data/anisearch.json` (3.195 Einträge) und
`data/tmdb-titles.json` (2.784) steht **kein** Cover-Feld — für beide müsste der Abruf erweitert werden, bevor man messen kann, wie viele Titel dort ein Bild haben.

**Gelesen (Suchtreffer, nicht die Seiten selbst — AniList liefert dem Abruf 403):**
- AniList-Nutzungsbedingungen: kostenlos für nicht-kommerzielle Nutzung, kommerziell nur bis zu einer Umsatzgrenze (150 $ im Monat), danach Lizenz; Massenabruf ist
  untersagt; ein konkurrierender Dienst derselben Art (Anime-/Manga-Listen, Tracker) ist untersagt — auch für Mediendaten. Eine eigene Regel zu Hotlinking der
  Cover-URLs fand die Suche nicht. Das ist ein Grund mehr, die Abhängigkeit zu lösen (Daniels Ziel), aber kein Verbot unserer heutigen Verweise.
- TMDB (`api-terms-of-use`, gelesen): kostenlos nur für begrenzte private Nutzung, kommerziell nur mit Vertrag; Attribution mit Logo und dem Satz „uses TMDB and the TMDB APIs
  but is not endorsed" ist Pflicht; gecachte Informationen höchstens sechs Monate; zum Hotlinken von Postern (`image.tmdb.org`) steht nichts ausdrücklich, Bildhosting für
  Werbebanner ist verboten. Poster sind Serien-/Filmposter, keine Anime-Cover; Abdeckung unbekannt.
- Kitsu (`media.kitsu.app`), MyAnimeList (`cdn.myanimelist.net`, über das inoffizielle Jikan), AniDB (`cdn.anidb.net`, strenge Hotlink-Regeln aus dem Gedächtnis, nicht
  geprüft) hosten eigene Uploads; **zu keiner dieser Quellen haben wir Nutzungsbedingungen für Bilder gelesen.**
- Mediacenter (Plex, Jellyfin, Sonarr) beziehen Poster überwiegend von TMDB, TheTVDB und fanart.tv; aniSearch führt eigene Cover (Nutzungsbedingungen für Bilder: unbekannt,
  in der Mail an `api@anisearch.com` offen).

**Einschätzung:** Es gibt keine frei nutzbare Quelle, die wir bedenkenlos gegen AniList tauschen könnten; die meisten Datenbanken hosten Bilder, die Nutzer oder Verlage
liefern, auf eigenes Risiko. Eigenes Hosten (Kopie auf unserem Server) wäre ein Lizenzfall, kein technischer.
**Vorschlag, stufenweise:** (1) AniList-Verweise behalten, solange AniList Quelle ist; (2) bei aniSearch nachfragen, ob ihre Cover verlinkt werden dürfen (in die offene Mail
an `api@anisearch.com`), und messen, wie viele Titel ein aniSearch-Cover haben; (3) TMDB-Poster als Rückfall mit der geforderten Attribution im Fuß, falls die Lizenzfrage
(kommerziell?) geklärt ist — unser Angebot ist werbefrei, ob es „kommerziell" im Sinne von TMDB ist, muss vorher stehen; (4) ohne Bild: ein Platzhalter mit Titel.

### aniSearch-Cover gemessen (04.10.2026, Archiv `data/anisearch-raw`, 3.195 Seiten)

- **3.195 von 3.195** archivierten Seiten nennen ein Cover (`<img id="details-cover">`), **3.163 (99 %)** davon als `https://cdn.anisearch.de/images/anime/cover/<aniSearch-ID/1000 abgerundet>/<ID>_600.webp` — die
  Adresse lässt sich aus der Kennung bilden, gespeichert werden müsste nichts. Die übrigen **32 (1 %)** tragen den gemeinsamen Platzhalter `…/cover/ecchi.v1_600.webp` (aniSearch verbirgt dort das Bild).
- **Größen:** `_300.webp` 43 KB, `_400.webp` 72 KB, `_600.webp` 136 KB antworten mit 200; `_100`, `_150`, `_200` und `_1000` mit **HTTP 423** (gesperrt). Für Kacheln taugt `_300`.
- **Der Bild-Server antwortet ohne Referer-Prüfung** (200 mit leerem, fremdem und eigenem Referer; `Cache-Control: public, max-age=31536000`). Das beantwortet die technische Frage, nicht die
  Rechtefrage: Die Nutzungsbedingungen für Bilder kennen wir nicht — die Frage steht in der Mail an `api@anisearch.com`.
- **Folge:** Sobald aniSearch zustimmt (oder schweigt und wir das Risiko bewusst tragen), lässt sich das Cover pro Titel aus `ak` → aniSearch-Kennung bilden und AniList als Bildquelle abschalten.
  1 % bekommt den eigenen Platzhalter statt `ecchi.v1`.

## aniSearch-Dubs-Endpoint gemessen (05.10.2026)

Abruf mit Token am 05.10.2026 ca. 22:30 (je ein Aufruf: `/v1/anime/dubs`, `/associated?source=myanimelist`, `/titles`; Docs: `api.anisearch.com/docs/api_database_anime.html#dubs`, nur mit Browser-Kennung lesbar, sonst „423 Locked").

- **Format:** `{"<aniSearch-ID>": {"dubbed": ["ja","en","de"], "planned": [...], "paused": [...], "canceled": [...]}}`, 15.147 Einträge, 465 KB. Limit mit Token: **1 Abruf je Stunde** (ohne Token 1 je 24 h), geteilt über alle IPs des Tokens. Einzel-IDs: 5 s Abstand mit Token. Ungültiger Token = 401 und 24 h IP-Sperre (IPv6: /64).
- **Zugang:** `Authorization: Bearer <Token>`; die API verlangt eine Browser-Kennung (`KENNUNG` aus `pipeline/lib/kennung.ts`), eine nackte Projektkennung bekommt 423. Der Token steht in `my_secrets.md`.
- **Deutsch bei aniSearch:** 2.939 Titel `dubbed`, 44 `planned`, 67 `canceled`, 0 `paused`.
- **Abgleich über MAL-Kennung (`/associated?source=myanimelist`):** Von den 2.939 deutsch synchronisierten Titeln stehen 2.565 in unserem Hauptbestand, 5 bei uns hinter „ohne Synchro" (Reporter Blues, Bikini Warriors OVA, TANK CHAIR, Seven Knights of the Marronnier Kingdom), **297 in keiner unserer Listen** (davon 128 aus den 2000ern, 60 aus den 1990ern, 36 seit 2020, z. B. Specials und Ableger von Slime, My Hero Academia, Mushoku Tensei, JoJo Stone Ocean), 72 ohne MAL-Zuordnung (meist alte Serien: Willy Fog, Es war einmal …). Die 297 sind Kandidaten, kein Befund: die MAL-Kennung kann auf einen anderen Eintrag zeigen als unsere.
- **Angekündigt (`planned` de):** 44 Titel am 25.10.2026 (34 im Hauptbestand, 7 „ohne Synchro“, 3 nicht im Bestand). **Stand 26.10.2026** (`data/anisearch-dub-ids.json`, gezählt mit `deutschMarke(t.id) === 'p'`): 38 Titel. Auf main (vor dieser Regel, Bestandsbau mit #2127): 28 im Hauptbestand, 7 hinter dem Toggle (Servamp Movie, HELL MODE, Vermilion Mask, Gals Can't Be Kind, PSYREN, Firefly Wedding, Iceblade Sorcerer II), 3 nicht im Bestand. Mit der Ankündigung in Phase 02 (`bau/ankuendigung-an-titel.ts`, voller Bau mit dem Cache vom 26.10.2026): 32 im Hauptbestand, 3 hinter dem Toggle (Servamp Movie, HELL MODE, Gals Can't Be Kind), 3 nicht im Bestand. Die Zahlen spiegeln den letzten Bestandsbau; die Wache `check-ankuendigung-versteckt-bestand.ts` meldet Titel mit frischer Synchro-Ankündigung, die hinten stehen oder in `titles.json` fehlen.
- **Abgebrochen (`canceled` de):** 67 Titel; 35 im Hauptbestand, 22 bei uns ohne Synchro.
- **Gegenprobe Hauptbestand:** 161 unserer Titel mit MAL-Kennung nennt aniSearch ohne Deutsch (z. B. Rozen Maiden: Dreaming und Cardcaptor Sakura mit `canceled: de`, Yu-Gi-Oh! GX und Hamtaro ebenfalls, bei uns `high`/`very-high`). Das ist eine Prüfliste für Handbelege, kein Beweis gegen uns.
- **Nutzen:** (1) täglich eine Prüfliste „aniSearch kennt de, wir nicht" (5 + 297 + 72) und „wir behaupten de, aniSearch nicht" (161); (2) `planned` als Hinweis auf Ankündigungen (Beleg bleibt aniSearch); (3) kein Ersatz für Belege, weil `dubbed` keine Folgen, Plattformen oder Termine nennt. **Noch nicht eingebaut.** Messskripte liegen nur im Scratchpad; vor dem Bau die 5 + 7 Titel von Hand ansehen.

## Schnellere Daten: Takte seit 15.10.2026

Anlass: Messung [live-zeit-2026-10-15.md](../../daniel-zum-abarbeiten/berichte/live-zeit-2026-10-15.md) (Artikel warteten im Mittel 16 h auf den Tageslauf).

- **aniSearch-Dubs (`data:anisearch-dubs`) täglich statt wöchentlich.** Es ist die API (`GET api.anisearch.com/v1/anime/dubs`, Bearer-Token, ein Abruf je Lauf, keine Seite); Limit mit Token 1 Abruf je Stunde (siehe oben). Vorher 1 Abruf je Woche (Wochenlauf Mo 05:00 UTC), jetzt 1 je Tag im Tageslauf (Job aniSearch, 04:00 UTC, erster Schritt) und nicht mehr im Wochenlauf: 1 von 24 erlaubten Abrufen je Tag. Folge: `d`/`p`/`c`-Marken (Regel in `bau/ohne-beleg.ts`) sind höchstens einen Tag alt statt bis zu sieben. `data:anisearch-eintraege` (Wochenlauf) liest die Kennungen weiter aus `data/anisearch-dub-ids.json`.
- **Anime2You leicht (`data:anime2you -- --leicht`) stündlich im Stundenlauf.** robots.txt (gelesen 08.10.2026, `sammelartikel-poc.md`): `User-agent: *` sperrt nur `/wordpress/wp-admin/` und `/wordpress/wp-includes/`; das Impressum nennt keine AGB. Der leichte Lauf holt nur die erste Seite der vier Feeds (streaming, disc, kino, Gesamt: 4 Abrufe je Lauf), Volltexte nur für Adressen, die `data/proposals/anime2you.json` noch nicht kennt, nichts nach (Sammelartikel, Tabellen, Übersichten bleiben dem Tageslauf) und schreibt die Datei nur bei neuem Inhalt. Anfragen je Tag: vorher 10 Feeds + bis 12 Volltexte + bis 18 Nachhol-Abrufe (höchstens 40); nachher zusätzlich 96 Feed-Abrufe + die Volltexte neuer Meldungen. Wartezeit eines Artikels bis zur Vorschlagsdatei: im Mittel etwa 0,5 h statt 16 h.

## Cover: Rückfall für kleine AniList-Cover (gemessen 06.10.2026)

Bericht: alle 2.787 Titel haben ein AniList-Cover. 2.236 (80,2 %) liegen als 460-px-Datei vor (höher gibt AniList nicht her), 551 (19,8 %) nur als `medium` mit ca. 225 px, einer (AniList 204585) hat den Platzhalter `default.jpg`.

- **Kitsu** (kein Key, Zuordnung per MAL-ID): 14 von 15 Stichproben richtig samt Staffel, `original` in 11 von 14 größer als AniList (bis 2230×3230); bei den kleinen AniList-Covern 2 von 4 verbessert. Nutzungsbedingungen hinter Cloudflare nicht lesbar, also keine belegte Erlaubnis.
- **TMDB**: AGB gelesen. Nichtkommerziell frei mit Logo und „not endorsed or certified by TMDB", Cache höchstens 6 Monate, bei Erlösabsicht Vertrag mit sales@themoviedb.org. Auflösung nicht gemessen (Key nur in der CI nutzbar), Anime-Passung schwach.
- **TheTVDB** frei unter 50.000 USD Jahresumsatz mit Link-Attribution; Jikan von hier nicht erreichbar; Fanart.tv gesperrt.
- **Empfehlung:** Rückfall nur für die 552 Titel mit `medium`/Platzhalter, nicht für die 460er. Aufwand 0,5–1 Tag (Feld in `pipeline/lib/anilist.ts`, Auswahl in `bau/13-1-anreichern.ts`/`13-5-kerndateien.ts`, Attribution im Impressum). Vorher klären: Kitsu-Nutzungsaussage, ob die Seite als kommerziell gilt.

## Monatsübersichten als Gegenprobe: heise, Filmstarts, whats-on-netflix (06.10.2026)

Anlass: Daniel gab am 06.10.2026 die heise-Liste „Neue Filme und Serien bei Netflix, Disney+ und Amazon Prime im Oktober 2026" und die Filmstarts-Woche vom 5. bis 11.10. als Prüfstein für den Kalender.

- **Was sie sind:** Redaktionelle Monats- und Wochenlisten der drei Abo-Dienste, mit Datum je Titel, **ohne Angabe der Sprachfassung** (heise: „im Abopreis inbegriffen", Filmstarts: Handlungstexte). Sie tragen deshalb nie die Aussage „deutsche Synchro" und sind **kein Beleg** für eine Synchro-Meldung, sondern ein Fundweg: Sie zeigen, welche Titel eines Dienstes in einem Monat starten; ob es eine Synchro gibt, sagt dann Anime2You oder der Dienst.
- **robots.txt (06.10.2026):** heise, Filmstarts und whats-on-netflix sperren nur Verwaltungs-, Such- und Medienpfade, nicht die Nachrichtenartikel.
- **Messung am 06.10.2026:** Von den Anime in beiden Listen hatten wir alle bis auf zwei: „Die sieben Ritter des Königreichs der Marronniers" (heise, Amazon-Liste) und, über die Anime2You-Meldung zu Prime Video, „Tank Chair". Beide Titel hatte Anime2You schon gemeldet (Marronniers am 07.09. und 04.10.); der Fehler lag bei uns, nicht an einer fehlenden Quelle. Einzigartig war heise also nicht, aber als **unabhängige Gegenprobe** gegen die eigene Lücke wirksam.
- **Belegregel:** Eine Quelle hängt nur an der Meldung, deren Aussage sie trägt. heise nennt für Marronniers den 04.10. (Anime2You: Samstag 03.10.) und keine Sprachfassung; sie gehört deshalb nicht an die Meldung „Erstmals mit deutscher Synchro", sondern höchstens an eine Start-Meldung bei Prime Video.
- **Vorgehen künftig:** Zu Monatsbeginn (und mittwochs, Filmstarts-Wochenliste) die Listen gegen `releases.json` lesen; was fehlt, mit Anime2You oder der Anbieterseite auf Synchro prüfen. Als Lauf noch nicht automatisiert; Entscheidung dazu offen, weil die Seiten kein stabiles Muster haben.

## FSK-Lücke: Datenbank-PoC und Quellenlage (08.10.2026)

Stand: `fsk` fehlt bei 1.683 von 2.908 Titeln. Gemessen an einer Stichprobe von 60 Titeln
(Seed 20261008, n = 60, Hochrechnung grob ±12 Prozentpunkte). Es ist ein PoC, nichts davon ist gebaut.

### Rechtsbefund — offen, Entscheidung Daniel

Das Impressum der FSK (https://www.fsk.de/impressum/) sagt wörtlich: „Alle Inhalte, Informationen,
Anwendungen, Dienste und Daten dürfen nicht ohne vorherige schriftliche Zustimmung der FSK in
irgendeiner Weise, auch nicht auszugsweise, genutzt oder verwendet werden." Die `robots.txt`
erlaubt dagegen alles (`User-agent: *`, `Disallow:` leer) — die beiden Texte widersprechen sich.

- **Entschieden (Daniel, 08.10.2026): Abruf eingestellt, ersatzlos.** `pipeline/fetch-fsk.ts`,
  `data/fsk-kino.json`, `npm run data:fsk` und der Schritt in `refresh-weekly.yml` sind entfernt.
  Grund: Rechtsbefund. Gemessen vorher: Das Feld `fsk` füllte der Abruf nie (von 1.264 Titeln mit `fsk`
  stammen 1.262 aus TMDB DE, 2 aus ADN-Altersangabe, 0 aus der FSK-Datenbank); `data/fsk-kino.json`
  (Stand 05.10.2026, 8 Kino-Releases) las außer `tools/quellen-liste.sh` nichts. Sprachfassung der Kinostarts
  belegt weiter CineStar. Ersatzquelle für fehlende Werte (JustWatch/Prime) ist ein eigener Auftrag.
  Zusicherung: `check:logic` meldet jeden Zugriff auf `fsk.de/fskapi` in `pipeline/` und `tools/`.
- Die FSK bietet eine Anmelde-API („direkte Anbindung an über 500.000 FSK-Freigaben",
  https://www.fsk.de/unternehmen/); Preis und Bedingungen nicht gefunden. Nicht genutzt.

### FSK-Datenbank (`/fskapi/ReleaseSearch`)

| Abgleich an 60 Titeln | Treffer |
|---|---|
| bisheriger Abgleich, strikt | 10 (17 %) |
| mit wörtlichen Titelformen (Satzzeichen behalten, Präfix vor dem ersten Satzzeichen, EN/Romaji/DE) | 28 eindeutig |
| widersprüchlich (Bungo Stray Dogs 3: 12 und 16) | 1 |
| nur andere Staffel desselben Franchise (kein Wert übernehmen) | 9 |
| kein Eintrag | 22 |

Der Hauptfehler des alten Abgleichs war das Entfernen der Satzzeichen: Treffer sind wörtliche
Teilzeichenketten („Food Wars" findet 14, „Yuri on Ice" 0).

Technik: Titel ist Pflicht (mindestens 2 Zeichen); die Antwort ist bei 400 Treffern gedeckelt;
der Datumsfilter funktioniert; `page`/`limit` wirken nicht. Die Sitemap enthält keine Prüfseiten
— kein Vollabzug möglich (Zwei-Zeichen-Fragmente gegen den Deckel wären unpraktikabel).
2–40 s je Abruf, 142 Abrufe ohne 403/429. Mehrere Disc-Blöcke desselben Titels streuen; Regel
„höchster Wert, bei Streuung kennzeichnen" ist zu entscheiden.

### Weitere Quellen

| Quelle | Ergebnis |
|---|---|
| TMDB (DE) | 1 von 60, nichts Neues |
| JustWatch `ageCertification` (DE) | 15 Werte bei 20 Titeltreffern (nur exakter Titel, also Untergrenze), 5 neu; gegen die FSK bei 10 Doppeln 3 Abweichungen — nur als gekennzeichnete Anbieter-Angabe |
| Wikidata P1981 | 0 von 60 |
| aniSearch-API | kein Altersfeld |
| Crunchyroll | US-/Eigensystem (`cr-tv`), keine FSK |
| ADN | `age` „10+" ist keine FSK-Stufe, nur Hinweis |
| Prime Video | die Erweiterung liest das Siegel, speichert es nicht |

Nicht gemessen: Prime, Netflix, Disney+, Joyn, OFDb, bluray-disc.de, EPG, KJM; AGB von JustWatch
und TMDB nicht gelesen.

### Obergrenze und Reihenfolge

Hochrechnung auf die 1.683: FSK-Datenbank etwa 800 Titel, mit JustWatch etwa 950, also rund 55 %
(±12 Prozentpunkte). Der Rest sind Streaming-only-Titel, Specials und Web-Kurzformate.

Reihenfolge und Widerspruchsregel: FSK-Datenbank > TMDB-DE > JustWatch (gekennzeichneter
Rückfall) > Prime-Siegel/ADN (nur Hinweis). Die FSK-Datenbank erst nach geklärter Zustimmung.

## TMDB-Erstausstrahlung kann das US-Datum sein (aniSearch-Auskunft 08.10.2026)

Anlass: aniSearch antwortete Daniel zu Yu-Gi-Oh! Capsule Monsters (123074), die bei TMDB hinterlegten Erstausstrahlungsdaten seien fehlerhaft: Sie beziehen sich auf die Ausstrahlung im US-TV, die Erstausstrahlung lief Monate früher auf dem irischen Sender RTÉ Two. Folge: Ein TMDB-Datum `first_air_date` ist bei westlichen Auftragsproduktionen kein belegtes Weltpremieren-Datum, sondern höchstens der US-Start. Nicht als „Erstausstrahlung" ausgeben, ohne ein zweites Datum gegenzulesen.

Dieselbe Antwort: Reine Auftragsproduktionen westlicher Firmen (asiatische Produzenten ohne künstlerische Freiheit) nimmt aniSearch nicht auf; Capsule Monsters steht deshalb mit Quelle „aniSearch-Antwort 08.10.2026" in `data/ohne-synchro-von-hand.yaml` (`keinAnime: true`, hinter dem Toggle), ebenso die beiden Diashow-Specials (Princess Principal Picture Drama 100519, Anohana Menma e no Tegami 107342).

Vierte Antwort (Yu-Gi-Oh! The Dark Side of Dimensions Special: Eien no Rival - Yuugi to Kaiba!, MAL 33997, AniList 102505), wörtlich: „Bei diesem Special handelt es sich meinem Eindruck nach um eine Kombination aus Werbung, Recap und Audiokommentar - es wird zwar anscheinend von den Produzenten nicht wirklich als offiziell betrachtet (da es auf den offiziellen Streamingplattformen und Home Video Veröffentlichungen fehlt), eine Aufnahme ist aber dennoch zu prüfen." Entscheidung 08.10.2026: Es ist Anime (kein `keinAnime`), aber ohne jeden deutschen Beleg (Wege leer, `dubConfidence` low, keine Handprüfung, Websuche ohne Treffer) und ohne offizielle Veröffentlichung; deshalb Eintrag ohne `keinAnime` in `data/ohne-synchro-von-hand.yaml` (hinter dem Toggle, nicht gelöscht). Der Film (21265) hat dagegen RTL+-Synchro. Fällt eine deutsche Fassung auf, den Eintrag samt Quelle im Commit löschen. Die aniSearch-Kennung steht noch aus (`data/anisearch-ids-hand.yaml`, erst nach Nennung durch aniSearch).

## FSK-Rückfall aus JustWatch: Altersangabe als Anbieter-Einstufung (08.10.2026)

Titel ohne FSK-Freigabe (TMDB) bekommen JustWatchs `content.ageCertification` (DE) als `fsk` mit `fskQuelle: 'justwatch'`
(`pipeline/bau/11-2-1-fsk-justwatch.ts`). Das Feld hängt an derselben Abfrage wie die Tonspuren
(`fetch-justwatch-audio.ts`, Befund-Feld `altersangabe`, roh; `null` = JustWatch nennt keine) — kein zusätzlicher Abruf.
Anzeige: „ab 12 laut Anbieter" im Panel, gestrichelter Rand und Tooltip an der Plakette; Termine und Releases tragen weiter nur Freigaben.

- **Rechte (gelesen 08.10.2026):** `robots.txt` von `www.` und `apis.justwatch.com`: `User-agent: *` / `Disallow:` (leer). Die
  Nutzungsbedingungen (support.justwatch.com/article/just-watchs-terms-of-use) verlangen persönliche, nicht-kommerzielle Nutzung
  und untersagen Scraping: „users will not engage in or use any data mining, robots, scraping or similar data gathering or
  extraction methods". Das gilt der Website allgemein, nicht der Altersangabe; die Schnittstelle fragt das Projekt seit
  07.09.2026 mit Pause und Limit. Wer die Grundsatzfrage neu stellt, stellt sie für alle JustWatch-Daten.
  **Entscheidung Daniel, 08.10.2026: JustWatch wird weiter genutzt (nicht-kommerzielles Projekt), die Altersangabe wird dort mitgeholt.**
- **Werte:** Zeichenketten „0/6/12/16/18", teils leer (`""`). Anderes (z. B. „14", „PG-13") wird verworfen und im Bau-Log gezählt.
- **Abdeckung (Stichprobe 08.10.2026):** 497 der 1.705 Titel ohne FSK haben einen JustWatch-Treffer; an 25 davon 21 mit Stufe
  (84 %), vier leer — hochgerechnet rund 420 Titel. Vorbehalt: Bei 3 von 10 Doppelten wich JustWatch von der FSK ab; bei
  Widerspruch gilt die Freigabe, der Bau zählt Abweichungen. Die übrigen Treffer ohne `altersangabe` holt der Lauf vorgezogen nach.

## Ranma ½ (1989): deutsche Folgen und Discs (08.10.2026)

- **Deutsch sind die Folgen 1–80 der Gesamtserie** (18 der ersten Serie, AniList 210, plus 62 von Nettōhen, AniList 149939 mit 143 Folgen). Belege: de.wikipedia.org „Ranma ½", Abschnitt „Deutsche Umsetzung" (RTL II ab 11.04.2002; „Von den übrigen 81 Folgen gibt es keine deutsche Fassung") und zeichentrickserien.de/dvd/ranma-1-2.htm („Box 1–3 (Folge 1–80)", Label AV2 / Anime Virtual, 26–27 Folgen je Box); giga.de nennt dieselbe Zahl („80 von 161"). Daniels „30" ließ sich nicht belegen.
- **Disc:** drei Boxen (Box 2: Folgen 28–54, Box 3: 55–80), Sammlung „Box 1–3" bei aniSearch (`article/4074`, Verlag dort „Kazé Deutschland", Wikipedia: Anime Virtual). Eintrag in `data/watch-links.yaml` mit `dubRanges` 1–62 in der AniList-Zählung von 149939 (Folge 19 der Gesamtserie = Folge 1). Nicht lokal gebaut (Cache fehlt): Wirkung im Panel nach dem nächsten Bestandslauf prüfen.
- **Beleg-Aufnahmen:** Ein Bild älterer `BILD_FASSUNG` stand in der Warteschlange am Ende (Sortierung nach letzter Lesung) und blieb hinter dem Limit von 60 — `bildOhnePruefung` zählt es jetzt mit. Bei Artikeln für mehrere Titel reicht der Ausschnitt bis zur Fundstelle des tiefsten Titels (Tank Chair fehlte die Marke).

## AniList-Cover für aniSearch-Titel ohne Jahresgrenze (08.10.2026)

`holeAnisearchCover` (`pipeline/lib/anisearch-cover.ts`) fragt Einträge mit deutscher Fassung (d/p/c) ohne Jahresgrenze, die übrigen ab Vorjahr. Inkrementell: nur MAL-Kennungen ohne Cache-Eintrag, Blöcke zu 50, Cache nach jedem Block geschrieben. Wen AniList nicht kennt, bekommt keinen Eintrag und wird im nächsten Lauf wieder gefragt (Nichtauskunft ist kein Befund). Scheitert ein Block nach den Wartezeiten von `gql` (Retry-After, bis fünf Versuche), ruht der Abruf bis zum nächsten Lauf.
Messung: 771 Kennungen abgefragt, 615 neue Cover. Von den 93 älteren aniSearch-Titeln ohne Cover bekamen nur 2 eines: 67 sind Specials/Bonus ohne Anime-Eintrag bei AniList (die MAL-Kennung gehört dort zu einem Manga), 24 stehen als AniList-Titel schon im Bestand (gleiche MAL-Kennung, also vermutlich doppelt geführt; 4 davon `isAdult`).

## Sprecher-Suche: Datenquellen und ihre Auflagen (08.10.2026)

Die Sprecher-Suche (Vorschau `sprecher-suche`) zeigt nichts Neues, sie macht die vorhandenen Sprecherdateien `public/data/voices/<id>.json` durchsuchbar. Woher die stammen und was die Seite deshalb behaupten darf:

- **AniList** (`pipeline/fetch-voices.ts`, GraphQL `characters.edges.voiceActors(language: GERMAN)`): Bestand am 08.10.2026: 2.788 Dateien, 1.965 mit Rollen, 30.670 Rollen, davon 21.924 von AniList. Nutzungsbedingungen (`anilist.co/terms`, direkt abgerufen 403, über Extraktionsdienst nur der Abschnitt „Use License" lesbar, Wortlaut): „Permission is granted to temporarily download one copy of the materials (information or software) on this Application's web site for personal, non-commercial transitory viewing only." Der API-Abschnitt (nicht-kommerziell frei, kommerziell bis 150 $ im Monat, kein konkurrierender Listen-/Tracker-Dienst) ist aus Suchtreffern bekannt (siehe Abschnitt „AniList-Cover", oben) und im Wortlaut weiter nicht lesbar — **offen**. Die Seite ist nicht-kommerziell und nennt AniList an jeder Sprecherliste.
- **Anime News Network** (`pipeline/fetch-ann-voices.ts`, Encyclopedia-API `cdn.animenewsnetwork.com/encyclopedia/api.xml`): 1.383 Dateien mit ANN-Anteil, 8.746 Rollen `von: 'ann'`. Bedingungen (`animenewsnetwork.com/encyclopedia/api.php`, gelesen 08.10.2026, Wortlaut): „We provide this API free of charge but you must" (1) „list Anime News Network as the source of the data" und (2) „include a link to the relevant Encyclopedia entry […] on any page that displays anime/manga/person details"; „The API is rate-limited to 1 request per second per IP address; requests over this threshold will be delayed." Deshalb trägt jeder Titel in der Sprecherliste mit ANN-Rollen den Link „ANN ↗" auf seinen Encyclopedia-Eintrag (`annId` des Titels, Form in `shared/ann.ts`), und die Quellzeile nennt ANN.
- **Nicht genutzt:** Deutsche Synchronkartei (untersagt automatisiertes Auslesen, Stand 11.08.2026, siehe `fetch-voices.ts`), synchrondatenbank.de (frei nur über 30 Jahre alt).

**Vollständigkeit:** 1.963 von 2.925 ausgelieferten Titeln (67 %) haben Sprecherdaten (`hasVoices`). Die Suche findet also nur, was AniList und ANN führen; ein fehlender Treffer heißt „nicht belegt", nicht „spricht dort nicht". Die Quellzeile sagt deshalb „Angaben von AniList …", keine Vollständigkeit. 2.607 Sprecher nach Zusammenziehen doppelter Leerzeichen (5 Fälle); 29 Namen unterscheiden sich nur in Umlaut/Akzent/Bindestrich („Claudia Lössl"/„Claudia Lossl", „Jamie-Lee Blank"/„Jamie Lee Blank") — **nicht zusammengelegt**, weil eine Gleichsetzung eine Behauptung wäre; die Suche normalisiert beide Seiten und findet sie gemeinsam.

**Index:** `pipeline/bau/sprecher-index.ts` schreibt `public/data/sprecher.json` (Name, Titelzahl, Gruppe; 20 KB gepackt) und `public/data/sprecher/<buchstabe>.json` (Titel mit Rollen je Name; größte Gruppe „m" 36 KB gepackt). Zusicherungen im Bau: Index ≤ 40 KB und Gruppe ≤ 60 KB gepackt, kein Sprecher ohne Titel, jede Rolle an einem ausgelieferten Titel (`titles.json`) mit Figur; Dateien zu nicht ausgelieferten Titeln werden gezählt und im Log gemeldet (2 am 08.10.2026).

## AniList-Katalog: Neuanlagen kamen erst im Wochenlauf, formatlose gar nicht (09.10.2026)

„Maiden Blood" (AniList 215791, TV, `NOT_YET_RELEASED`, Start nur „2027") fehlte in `ohne-synchro.json`.
Gemessen am 09.10.2026 an 700 jüngsten AniList-Kennungen (ID_DESC): von 449 mit Startjahr ≥ 2026 oder ohne Datum und
Kennung > 200000 fehlten 63; 28 davon hatten `format: null` (der Nachlauf fragte mit `format_in` und verwarf sie),
32 sind `MUSIC` (gewollt draußen), der Rest Neuanlagen nach dem letzten Katalogstand. Der Jahreslauf 2027 findet den
Titel heute (Seite 3 von 3). Den Katalog holte nur `refresh-weekly.yml`.
Fix: Nachlauf ohne `format_in`, Filter `gehoertInKatalog()` (formatlos nur bei `NOT_YET_RELEASED`); `data:katalog -- --frisch`
läuft täglich in `refresh-data.yml` (laufendes + 3 Jahre, 500 jüngste Kennungen, ~30 Abfragen); danach prüft eine
Stichprobe die 100 jüngsten Kennungen gegen den Katalog und beendet den Schritt sonst rot.

## Crunchyroll: bestehende Abrufe bleiben eingeschränkt (Daniel, 09.10.2026)

Die Nutzungsbedingungen von Crunchyroll (§5) untersagen automatisierten Zugriff und gewerbliche Nutzung (Wortlaut in `sammelartikel-poc.md`). Entscheidung von Daniel (Option A, eingeschränkt, Vorschlag angenommen): Die bestehenden Abrufe (Wochenkalender, Beleg-Lesung, Dub-Abfrage über die Weiche) bleiben mit niedriger Frequenz und ohne Konto. Es kommen keine neuen Crunchyroll-Abrufe dazu; Crunchyroll dient höchstens als Gegenprobe. Bei einer Sperre oder einem Schreiben von Crunchyroll wird sofort eingestellt (dann Option B: nur der öffentliche Kalender, Synchro-Belege aus aniSearch, Anime2You, JustWatch und den Meldungen der Erweiterung). Nichtkommerziell, wie bei JustWatch entschieden.

**Nachtrag 27.10.2026 (Daniel: „ja, stündlich umsetzen“):** Der Katalogfund neuer deutscher Folgen (`data:cr-neu`) und das Urteil darüber (`data:cr-dub -- --nur-neu`) laufen stündlich in `refresh-hourly.yml` statt täglich (PR 2186). Die Entscheidung vom 09.10. gilt weiter in dem Sinn, dass die Abrufzahl klein bleibt; sie wird deshalb knapp gehalten (PR vom 28.10.2026, gemessen an den Stundenläufen 02–09 Uhr UTC vom 28.10.): der Katalogfund hört nach der ersten Seite auf, die nur bekannte deutsche Folgen zeigt (vorher immer 6 Seiten, in 8 von 8 Läufen „600 Folgen gelesen, 0 neue“), und das Zugangspaket der Weiche wird nur geholt, wenn `--offen-pruefen` mindestens eine zu lesende Serie zählt (vorher in 8 von 8 Läufen geholt, in 8 von 8 „0 Serienadressen offen“). Eine Serie wird neu gelesen, sobald eine deutsche Folgenkennung des Katalogfunds beim letzten Lesen noch nicht vorlag (`lib/cr-frisch.ts`, auch die zweite Folge desselben Tages). Eine neue deutsche Folge zu einer Serie ohne Titel bei uns erscheint als Warnzeile der Bestandswache (`check-cr-neu-bestand.ts`, Posteingang), denn der Katalog liefert keinen Sendetakt für eine Neuanlage; legt das Wochenprogramm sie an, entfällt die Meldung von selbst. Das Zeitbudget des Stundenjobs (Summe der Schrittgrenzen plus 10 min Reserve höchstens `timeout-minutes`) prüft `check-cr-neu-stuendlich.ts`.


## aniSearch-Direktlink: nie eine Suche, Liste der offenen Titel (09.10.2026)

Anlass (Daniel): Bei „The Boxer" stand eine Suchseite, bei „Laid Off Cheat Granting Mage" ein „?" statt der aniSearch-Titelseite. Gemessen am 09.10.2026 (23.581 Titel in `titles.json` und `ohne-synchro.json`): **16.360 ohne `anisearchId`**, fast alle hinter dem Toggle. Zwei Ursachen: (1) 5.466 reine aniSearch-Titel (Kennung = 10.000.000 + aniSearch-Kennung) trugen die Kennung nur in `titles.json`, nicht in `ohne-synchro.json`; (2) die AniList-Katalogtitel kannten nur, was `anisearch.json` und die Handdatei hergaben.

- **Regel:** Die Oberfläche zeigt nur `anime/<Kennung>`; ohne Kennung steht kein aniSearch-Weg da, kein „?". `anisearchSeite()` liefert ohne Kennung `undefined`; der Bau erzeugt keinen Weg ohne Adresse. `keinAnisearchSuchlink` (`lib/invarianten-auslieferung.ts`) bricht den Bau ab, wenn `titles*.json`, `ohne-synchro.json`, `cartoons.json` oder `synopses/` einen Suchlink enthalten; `check:logic` prüft `releases.json` nach.
- **Zuordnung:** `bau/anisearch-kennung.ts` (Handdatei, Abruf-Ergebnis, Kennung eines reinen aniSearch-Titels, zuletzt aniSearchs eigene MAL-Brücke `data/anisearch-mal.json`). Die Brücke holt `fetch-anisearch-zuordnung.ts` (`GET /v1/anime/associated?source=myanimelist`, ein API-Abruf, täglich im aniSearch-Job von `refresh-data.yml`); behalten werden nur beidseitig eindeutige Paare, und eine schon an einen anderen AniList-Titel vergebene Kennung wird nicht ein zweites Mal vergeben. Kein Namensabgleich, kein Seitenabruf.
- **Liste:** `data/anisearch-offen.json` (Kennung, MAL, Titel, Jahr, Grund `ohne-mal` oder `mal-ohne-eindeutige-zuordnung`) schreibt der Bau nur bei Änderung; sie schrumpft mit jeder Brücke.
- **Messung:** Mit der Brücke vom 09.10.2026 (18.868 MAL-Kennungen, 18.445 eindeutig) bleiben 3.361 Titel offen (1.130 ohne MAL-Kennung). Gegenprobe: bei den 2.962 zugeordneten Titeln, die auch als aniSearch-Eintrag vorliegen, weichen nur 26 im Jahr um mehr als eins ab; drei bestehende Zuordnungen widersprechen der Brücke (3 von 6.951). **Befund:** 3.059 der über MAL zugeordneten AniList-Zeilen haben eine eigene aniSearch-Zeile (Kennung 10.000.000 +) mit derselben Titelseite — Dubletten-Kandidaten, nicht Teil dieser Änderung.

## Synchron-Forum-Liste „Synchronisierte Anime-Titel": Beleg „mittel" (09.10.2026)

- **Quelle:** Privatliste des Forennutzers „Chat Noir" ([Thread](https://215072.homepagemodules.de/t528765f11776745-uebersicht-Synchronisierte-Anime-Titel.html), auch forum.seriensynchron.de), Stand 24.12.2023, 2.418 Einträge. Die Datei hat Daniel geliefert; kein Abruf, daher kein robots/AGB-Abgleich nötig. Lokale Kopie: `C:/code/ai/__assets/notes/synchron-forum-liste-2023-12-24.tsv` (nicht im Repo).
- **Lizenz/Umfang:** Die Liste ist fremde Arbeit und wird nicht abgedruckt. Im Repo stehen nur Treffer-IDs mit Listentitel, Jahr und Sender: `data/synchron-forum-treffer.yaml` (2.160 IDs, handgepflegt, nicht in `QUELLEN`, weil kein Lauf sie schreibt).
- **Grenzen:** Nur japanische Anime, nichts nach 2023; Abwesenheit ist kein Befund. Namensabgleich, kein Sprecher, keine Plattform: Sender in der Liste ist nicht die Streaming-Plattform. Das Listenjahr ist teils das deutsche Jahr (Odysseus 31: 1988 gegen 1981).
- **Wirkung:** `pipeline/lib/belegstaerke.ts`, Signal `forum` als mittlere Quelle (low -> normal, normal -> high), nie über high, ersetzt nie eine Handprüfung: Titel, deren Handbeleg die Synchro selbst verneint (`dub: false` mit `nichtImBestand`, `verneintSynchro()`), zählen nicht (der Build gibt die Zahl im Log aus). Ein Plattform-Nein (`dub: false` ohne `nichtImBestand`, z. B. Crunchyroll ohne Deutsch) schließt nicht aus: Afro Samurai (1292) fiel am 13.10.2026 deshalb von belegt auf normal, obwohl Universum Anime es 2007 synchronisiert hat. Messung auf dem Bestand vom 09.10.2026: Hauptbestand high 611 -> 798, normal 412 -> 338, low 374 -> 261 (very-high 1.529 unverändert); Toggle 2 Titel low -> normal.
- **Erzeugung:** einmalig `node tools/synchron-forum-treffer.mjs <liste.tsv>`; 2.104 exakte Namenstreffer mit passender Folgenzahl automatisch, 54 unscharfe oder mehrdeutige Zeilen von Hand in `HAND` entschieden (im Zweifel `null`: Veldoras Tagebuch, GITS Arise, Hakuoki, Appleseed XIII, Stone Ocean Teil 2 u. a. bleiben unzugeordnet). Mehrteilige Filme (Digimon tri., Heaven's Feel) belegen alle Teile.
- **Prüfung:** `pipeline/check-belegstaerke.ts` (in `check:logic`): Regel an Beispielen; `check-belegstaerke-bestand.ts` (in `check:bestand`): jede ID im Datensatz, Listenjahr höchstens 2 Jahre neben AniList.

## Ein Beleg steht nur bei der Aussage, die er trägt — „nur Originalton" ist kein deutscher Termin (10.10.2026)

**Anlass:** „Dragon Ball Super: Beerus" stand als „Alle 0 Folgen im Angebot morgen, Sonntag 11.10.2026" im Kalender, die News
„Start am 11.10.2026 bei Crunchyroll" trug als Beleg den Anime2You-Artikel 1056092 vom 01.10. Der sagt: Crunchyroll und ADN
zeigen die Serie „im Originalton mit Untertiteln", Netflix ab 18.10. — keine deutsche Fassung.

**Ursachen (gemessen am Datensatz vom 10.10.2026):**
1. `dubBefund` kannte nur `ja`/`offen`/`unklar`; ein Satz „im Originalton mit Untertiteln" ohne deutsche Fassung ergab `unklar`.
2. `releasesAus` (`pipeline/lib/meldungen.ts`) prüfte die Sprache gar nicht — jeder Vorschlag mit Tag und Anbieter wurde
   ein deutscher Termin (Sammelartikel filtern seit jeher auf `deutsch`, Einzelartikel nicht).
3. Ohne Folgenzahl (Werk noch nicht gestartet) schrieb der Antwortkasten `count: gesamt ?? episodeCount ?? 0` → „Alle 0 Folgen".

**Entscheidung — eine Quelle je Aussage, die sie trägt; was sie nicht trägt, wird gekennzeichnet:**
- `nein` (nur Originalton/OmU/„Japanisch (UT)", keine Zusage): die Meldung widerlegt die deutsche Fassung selbst → **kein
  Release**. Eine früher daraus erschienene Ankündigung bleibt in den News sichtbar, zurückgezogen mit dem Grund „Die Quelle nennt
  nur Originalton mit Untertiteln, keine deutsche Synchro." (`news-verlauf.ts`). Der Bau zählt solche Meldungen
  (`08-news-tv.ts`, Warnung ab 11) und bricht ab, falls doch ein automatischer Termin eine davon als Beleg trägt
  (`releasesAusNurOriginalton`, `13-5-kerndateien.ts`).
  `nein` nur, wenn der Text **keinerlei** Bezug auf eine deutsche Tonfassung trägt (`DEUTSCH_BEZUG`: „deutsche Tonspur",
  „deutsch vertont", „Synchro", „Simuldub" …) — ein falsches Nein verwirft einen echten Termin; diese Formen werden bewusst
  nicht zur Zusage („die deutsche Tonspur fehlt noch" wäre sonst `ja`). Jede verworfene Meldung steht mit Fundstelle in
  `daniel-zum-abarbeiten/listen/23-nur-originalton.md`, eine geänderte Liste geht als Hinweis in den Posteingang (Prüfer-Befund PR 649).
- `unklar`/`offen` (Tag belegt, Sprache nicht): das Release bleibt — nicht widerlegt —, aber `note` sagt es („Termin laut Quelle –
  ob mit deutscher Synchro, sagt sie nicht." bzw. „… ist dort noch offen."); die Notiz steht im Antwortkasten und als Hinweis an der
  News. Discs ausgenommen: deutsche Ausgaben tragen fast immer deutschen Ton, eine reine OmU-Ausgabe nennt der Artikel (`nein`).
- Melden mehrere Artikel denselben Titel und Anbieter, gewinnt der mit Sprachzusage (vorher: der erste in der Datei).
- Ältere Vorschläge werden an ihren gespeicherten Fundstellen nachgewertet (`spracheDerMeldung`, `lib/sprachbefund.ts`).

**Verworfen:** mehrere Belege je Release sammeln (würde Artikel anhängen, die nur den Tag tragen — genau der Fehler); alle
`unklar`-Releases streichen (29 Einträge am 10.10., meist Discs; nicht widerlegt, Grundsatz „kennzeichnen statt weglassen").

**Wirkung auf den Bestand vom 10.10.2026** (Messung mit `releasesAus` gegen den ausgelieferten Datensatz, der volle Bau brach
lokal am veralteten `data/cache` ab): 1 Meldung nennt nur Originalton (Beerus) → `auto-10021566-crunchyroll` entfällt; Notiz an 2
Streaming-Terminen (Fool Night „offen", Gundam Hathaway „sagt sie nicht"); Rooster Fighter belegt jetzt der Netflix-Sammelartikel
(„Deutsch", 12 Folgen) statt des sprachlosen Einzelartikels. „Alle 0 Folgen" betraf 2 Titel ohne Folgenzahl (Beerus, Fool Night).

**Recherche Beerus (10.10.2026):** Kein Beleg für eine deutsche Synchro. Crunchyroll-Lineup Herbst 2026 (nur OmU, keine DE-Zeile,
`data/proposals/aussagen.json`), Anime2You-Netflix-Sammelartikel 1052708 („Sprache: Japanisch (UT)", 18.10.), Anime2You 1056092
(OmU bei CR/ADN), aniSearch 21566 (`dub: "-"`, Sprachblock „Deutsch" ist der Untertitel-Eintrag), GamePro (vermutet OmU). Nicht
erreicht: Crunchyroll-Seiten (clientseitig gerendert, WebFetch leer), aniSearch-Seiten (nie von Daniels IP). Wiedervorlage, sobald
Crunchyroll/Netflix eine deutsche Tonspur zeigen (CR-Katalog-Lauf meldet es dann ohnehin).

## Beerus Teil 2: Wochenstart statt „alle Folgen", Kennzeichnung bis in die Karte (10.10.2026)

Nach #649 zeigte die Live-Seite noch „Alle Folgen im Angebot morgen" (der Bestandsbau lief erst danach). Die Kette dahinter:

1. **Takt:** `artDerMeldung` wählt für Streaming immer `batch`; der Wochenzweig in `zeitplanAusVorschlag` griff nur bei
   `v.woechentlich`, und das setzen nur Sammelartikel. Jede Einzelmeldung ohne Folgenzahl wurde „alle Folgen". Jetzt: ohne
   Folgenzahl wöchentlich, außer die Meldung sagt „komplett"/„alle Folgen"/„binge"/„auf einmal" (`taktDerMeldung`), das Werk
   stammt aus einem früheren Jahr (Katalogzugang) oder es ist eine ONA bei Netflix (Eigenproduktion). Gegenprobe Fool Night:
   Netflix-ONA, laut whats-on-netflix/hoshika „full-series drop" am 26.11.2026 → bleibt komplett. Sammelartikel tragen
   „nicht wöchentlich" ausdrücklich.
2. **Beleg-Kreis:** `ohneBelegteSynchro` (Reihenliste, ✕ DE) zählte jeden sicheren Termin als Beleg — auch einen Termin,
   der selbst nur aus einer OmU-Meldung stammte. Ebenso „Neu auf Deutsch" (erreichter Termin).
3. **Anzeige:** Ein Termin ohne belegte Synchro stand auf der Karte wie jeder deutsche Termin.

**Behebung:** `Release.sprache` (`omu` | `offen`), vom Event geerbt. `releasesAus` setzt `offen` ohne Sprachzusage (nicht bei
Disc); kuratierte OmU-Termine tragen `sprache: omu` (Madoka Walpurgisnacht, Rascal, Black Clover S2 — dessen Datum ist der
OmU-Start). Gekennzeichnete Termine belegen keine Synchro; die Karte (Woche, Monat) zeigt „OmU"/„Synchro offen", die News
„zurückgezogen: nur OmU". Der Bau bricht ab bei einem automatischen Termin ohne Sprachzusage und ohne Kennzeichnung und bei
„alle Folgen" aus einer Meldung mit Wochentakt (`lib/auto-release-pruefung.ts`).

**Zählung (ausgelieferter Bestand 10.10.2026, 56 künftige Nicht-Disc-Termine):** 10 ohne Stream mit Synchro, Erstausgabe oder
Sprecher; davon OmU laut eigener Notiz 2 (Rascal, Madoka) → `omu`; Auto-Termine ohne Sprachzusage 2 (Fool Night, Gundam
Hathaway) → `offen`. Die übrigen (Tank Chair, Tokyo Revengers S3, Bleach-Film ADN, A New Dawn Kino, My Happy Marriage Special,
Witch on the Holy Night, Trinity Seven) tragen eine Sprachzusage ihrer Quelle. Automatische batch-Termine: 21, davon 17
Katalogzugänge mit Folgenzahl (richtig), 2 betroffen (Beerus, Fool Night — Fool Night bleibt nach Gegenprobe komplett).

**Offen:** ICS-Feeds und Newsletter kennzeichnen `sprache` noch nicht.


## Anime2You: Lesefixes nach der Nachlese (10.10.2026)

Anlass: Nachlese 27.09.–10.10.2026 (130 Artikel; `__assets/notes/anime2you-nachlese-2026-10-10.md`). Vier Lesefehler in `scrape-anime2you.ts`, alle beseitigt:

- **Sammelartikel ohne Tag in der Kopfzeile** (`lib/sammelartikel.ts`): „Ab sofort bei Netflix:“-Listen führen je Titel nur „»Titel« – Staffel 2“ mit Feldern darunter. Vorher 0 Einträge (14 von 25 jungen Sammelartikeln seit 13.09.), jetzt 150 aus denselben 25 gespeicherten Artikeln (48 vorher). Tag: `Start:` im Feld, sonst Meldetag unter einer „Ab sofort …:“-Liste (bei „Jeden Sonntag“ und einer Folge der letzte solche Tag), als `datumGeschaetzt` → `schedule.estimated`. „Serie sollte entfernt werden“ (Death Note, Kuroko) bekommt keinen Tag. Mehrere Folgen auf einmal: kein Tag, nie geraten. Junge Artikel mit 0 Einträgen werden neu geholt und warnen.
- **Sprachaussage ohne Termin**: `Proposal.hinweis = 'sprache'` (45 Tage), nie ein Release, Kandidat für `data/dub-confirmed.yaml`.
- **Gesamt-Feed `/feed/`** (4 Seiten, nach den Rubrik-Feeds): Kategorie `allgemein`, nur mit Deutschland-Bezug (`deutschlandBezug`), erzeugt nie ein Release. robots.txt sperrt nur `/wp-admin/`; 4 Abrufe mehr je Lauf.
- **Disc-Shop-Sammelmeldungen**: Die Tabelle „Titel Termin Format“ steht nur im Artikel, nicht im Feed-Auszug; `shopTabellenNachholen` liest sie (3 je Lauf, einmal je Artikel). `findDates` ergänzt „15.01.“ um das Jahr des Artikels, `geschaetzt: true`.

**Verwerfungspfade** stehen mit Grund und Anzahl im Lauf-Protokoll und in `anime2you.json` (`verworfen`); Sammelartikel-Einträge zählt `zaehleSammelVerwurf` je Grund. Nicht im Umfang, nur Befund: Katalog-Abgänge (Naruto auf Prime, 31.10.) hat das Datenmodell nicht; Paramount+ ist seit 10.10.2026 eine Plattform (`paramountplus`).

## aniSearch als zweite Spalte: Abweichungsliste AniList gegen aniSearch (10.10.2026)

Stufe B der AniList-Ablösung (Inventur `__assets/notes/anilist-restlos-raus-2026-10-10.md`). Der Bau (`pipeline/bau/anisearch-abweichungen.ts`, `baueTitelGemessen` = `baueTitel` plus Messung) vergleicht je Hauptbestand-Titel mit aniSearch-Daten (`data/anisearch.json`, nach AniList-Kennung geschlüsselt) zwölf Felder und schreibt `data/anisearch-abweichungen.json` (nur bei Änderung; in `tools/quellen-liste.sh`). **Nichts davon wird ausgeliefert**, AniList behält Vorrang; `tools/bau-vergleich.mjs` zeigt für `public/data/` keinen Unterschied.

- **Felder und Abbildung** (`anisearch-spalte.ts`): Titel romaji/nativ aus der japanischen Sprachzeile (sonst Herkunftsland), englisch aus der englischen; Format über `FORMAT` aus `anisearch-titel.ts`; Folgen; `jpSeason`/`jpYear` aus „Herbst 2003" (Winter über den Jahreswechsel „1997/98" nach dem Beginn: Dezember = FALL des Startjahres (so führt AniList 113 von 161 Dezember-Starts, Rurouni-Kenshin-Film 20.12.1997 = FALL 1997), Januar/Februar = WINTER des Startjahres; ohne Saison das Jahr des Beginns); `jpEnd` = Ende, sonst Beginn, so genau wie die Angabe (Vergleich bis zur gröberen Genauigkeit); Status („Abgeschlossen" → FINISHED …); Studios (Rechtsform ignoriert, gleich, wenn eine Menge die andere enthält); MAL über die Brücke `anisearch-mal.json` umgekehrt; Beschreibung nur Vorhandensein (Deutsch gegen Englisch).
- **Zähler je Feld**: gleich / abweichend (mit beiden Werten) / nur AniList / nur aniSearch / beide leer; `titel` nennt, wer fehlt (`ohneAnisearchEintrag`, `ohneInfo`, `nurAnisearch` = Titel mit Kennung ab 10.000.000). Die Datei hält die Zähler vollständig, aber je Feld höchstens 20 Beispiele (sonst 469 KB, bei jeder Änderung neu committet); die Volllisten schreibt `ANISEARCH_VOLLLISTE=<Pfad außerhalb des Repos> npx tsx pipeline/build.ts`. Ein Fehler der Messung stoppt den Bau nicht (Warnung „Messfehler Nr. N" im Protokoll). `pipeline/check-anisearch-spalte.ts` (in `check:logic`) hält Fixtures und Untergrenzen für `gleich` je Feld.
- **Messung** (lokaler Cache vom 10.10.2026, älter als CI): 2.619 von 2.768 AniList-Titeln verglichen (149 ohne aniSearch-Eintrag). gleich/abweichend: Romaji 1546/1073, Englisch 1426/860, Nativ 903/1662, Format 2448/171, Folgen 2556/48, Jahr 2558/60, Saison 2321/221 (vor der Beginn-Ableitung des Winters 2461/157 und 2263/279: 97 Jahr- und 58 Saison-Abweichungen waren nur ein Abbildungsfehler; Rest bei Saison: SUMMER→FALL 51, WINTER→SPRING 47, SPRING→SUMMER 47, WINTER→FALL 46 = Dezember-Starts, die AniList als WINTER führt), Ende 2354/264, Status 2605/14, Studios 2206/208, MAL 2590/0 (29 nur AniList). Befunde: aniSearch-Nativtitel ist oft lateinisch umschrieben (Evangelion-Film: „Shinseiki … Gekijōban"), Romaji weicht in Schreibung und Zusätzen („(2005)", „W" statt „Wing") ab; `jpEnd` oft einen Tag später (Spätabend-Sendungen); Format MOVIE/OVA/SPECIAL uneinheitlich; AIC-Studio heißt bei aniSearch „Anime International Co." (Alias, keine Normalisierung).

## Reihen aus aniSearch-Beziehungen: Abweichungsliste gegen die franchiseId (10.10.2026)

Stufe C der AniList-Ablösung (Messung Stufe A: `daniel-zum-abarbeiten/berichte/anilist-stufe-a.md`). Nach `schreibeDatensatz` bildet der Bau (`pipeline/bau/anisearch-reihen-abweichungen.ts`, `schreibeDatensatzGemessen`) Reihen aus den aniSearch-Beziehungen aller Archivseiten (`data/anisearch-raw/`, Parser `pipeline/lib/anisearch-relationen.ts`, ≈ 5 s) und vergleicht sie mit der `franchiseId` aus `public/data/titles.json` und `ohne-synchro.json`. Ergebnis: `data/anisearch-reihen-abweichungen.json` (nur bei Änderung; in `tools/quellen-liste.sh`). **Nichts davon wird ausgeliefert**; `tools/bau-vergleich.mjs` zeigt für `public/data/` keinen Unterschied. Ein Messfehler stoppt den Bau nicht (Warnung im Protokoll). `pipeline/check-anisearch-reihen.ts` (in `check:logic`) hält Fixtures und Untergrenzen.

- **Regel** (`REGEL` in `anisearch-reihen.ts`): Kernarten (Sequel, Prequel, Hauptgeschichte, Nebengeschichte, Zusammenfassung, Komplette Geschichte, Alternative Version/Umgebung, Remake) und „?" immer; gleiche MAL-Kennung (Titel- oder Eintragsdatei) als Kante; Anderes/Gemeinsames Universum ab 5, Charakter/Crossover ab 12 Zeichen gemeinsamem Namensanfang (`otherZaehlt`); alles andere (Originalwerk, Adaption …, Ziele sind Manga/Film) nie. Titel mit gleicher aniSearch-Kennung sind eine Einheit.
- **Vergleich** nur für Titel mit Archivseite (14.245 von 20.728 am 10.10.2026; 3.175 ohne aniSearch-Kennung, 3.308 mit Kennung ohne Seite — die Lücke füllt der Archivlauf): je Titel gleich / fehlen (aniSearch kennt nur einen Teil der Reihe) / zusätzlich / gemischt; je Cluster (Referenz-Reihen und aniSearch-Komponenten zusammenhängend) einzel / gleich / zerlegt / verschmilzt / gemischt; je Art höchstens 20 Beispiele, größte zuerst.
- **Einstellen und Gegenprobe:** Hälfte A = Reihen, deren kleinster Titel gerade ist, B = ungerade. Koordinatensuche (3 Runden, nie/5/8/12/immer je Sammelart) an A, Prüfung an B. Eingestellt an A: 76,1 % gleich (A), **79,0 % (B, Gegenprobe)**; nur Kernarten 64,6 % / 67,5 %. Umgekehrt (an B eingestellt): B 79,8 %, A 75,7 %; an allem eingestellt 78,1 %; die Regel im Code (an A): gesamt 77,6 % (11.061 von 14.245), Hauptbestand 72,8 % (1.905 von 2.618; Stufe A, an allem eingestellt: 74,9 %). Die Kurve ist flach (Anderes 5 gegen 8: 30 Titel in A, 15 in B), aber `?` nie → immer bringt 367 (A) und 408 (B) Titel.
- **Cluster:** 5.464 einzel, 1.798 gleich, 250 zerlegt, 121 verschmilzt, 48 gemischt. Bekannte Ursachen (Stufe A, 10 Fälle von Hand): Brücken über „?"-Kanten verschmelzen (Gintama), Lücken in aniSearch (Bakemonogatari-PV), Crossover-Wächter fehlt (xxxHOLiC), Devilman → Violence Jack ist bei aniSearch reicher.
- **Übernahme (11.10.2026, Stufe C Teil 2):** `pipeline/bau/anisearch-reihen-uebernahme.ts` (rein) + `anisearch-reihen-pruefliste.ts` (Anbindung) liefern `03-reihen.ts` Verbindungen aus denselben aniSearch-Beziehungen (gleiche `REGEL`). **Ein Alleinstehender wandert, eine Reihe nie:** ein Titel, dessen Reihe nur er selbst ist (AniList kennt die Beziehung nicht oder den Titel gar nicht), kommt zu der einen Reihe mit mehreren Titeln, die er über Alleinstehende unmittelbar berührt; mehrere zusammenhängende Alleinstehende ohne Reihe werden eine neue Reihe. Verbindet aniSearch zwei Reihen mit mehreren Titeln (Gintama-Brücke über „?", Crossover Lupin/Conan, Persona 3/4/5) oder erreicht ein Alleinstehender zwei Reihen, wird nichts verbunden: `data/anisearch-reihen-pruefliste.json` (Art `verschmilzt` / `mehrdeutig`) — der Weg dafür ist `data/reihen-von-hand.yaml`. Crossover mit eigener Elternregel (`echteCrossover`) wandern nie. Reihenfolge in `03-reihen.ts`: Handdatei, MAL-Brücke, Beziehungen, Namensvorspann. Ein Fehler stoppt den Bau nicht. **Reichweite:** `03-reihen.ts` kennt nur Hauptbestand und aniSearch-Titel, nicht den AniList-Katalog (der bekommt seine Reihen später in `reihenFuerKatalog` und folgt dem Hauptbestand). Auf dem Stand 11.10.2026 (Emulation auf `public/data/`, 5.497 Titel): 146 Alleinstehende an Reihen gehängt, 214 neue Reihen, 16 Fälle auf der Prüfliste (4 verschmilzt, 12 universum); Stichprobe von Hand 15 von 16 richtig. **„Gemeinsames Universum" wandert nie** (Prüfer 11.10.2026: 7 von 11 Treffern falsch, Blade/X-Men/Iron Man), es steht als `universum` auf der Prüfliste; „Anderes" bleibt bei 5 Zeichen (bei 8 fielen drei gute Treffer weg — Btooom Digest, Pikachu Ongakutai, Tao Tao —, Final Fantasy VII blieb; erst ab 16 fällt es, mit sieben guten Treffern). Der große Rest der „zusätzlich"-Fälle (823 Titel) liegt im Katalog — dafür fehlt noch der gleiche Schritt in `reihenFuerKatalog` (nächster Schritt; `tools/bau-vergleich.mjs` baut den Katalog nicht mit, der Ersatz-Cache hat ihn nicht). **Folge für die Messung:** `anisearch-reihen-abweichungen.json` vergleicht ab jetzt mit der `franchiseId` nach der Übernahme; die Vergleichszahl gegen reine AniList-Reihen ist die vom 10.10./11.10.2026 (77,1 %).
- **Prüfliste von Hand entschieden (11.10.2026):** Alle 18 Fälle und Final Fantasy VII stehen mit Beleg in `data/reihen-von-hand.yaml`. `ids:` verbindet (gehört zusammen: Conan + Tanpenshuu/Making-of, Es war einmal …, Megazone 23, Road to You, Honkai Impact 3rd, Star Wars: Visions, Witcher, Peeping Life + Bonus); neu `getrennt: [Titel-Kennungen]` verbietet aniSearch-Beziehungen zwischen den **Reihen** dieser Titel (`ohneTrennungen()` in `anisearch-reihen-uebernahme.ts`): Tsubasa/xxxHOLiC, BLOOD+/BLOOD-C, Persona 3/5, die vier Marvel-Serien, FF VII/Unlimited/Die Mächte in Dir. Maßstab: eine Marke mit gemeinsamem Namen und Einzeltiteln (Kurzfilme, Bonus, Specials) ist eine Reihe; eigene Handlung unter gemeinsamem Universum oder Studio ist keine. Neue Fälle der Prüfliste kommen auf dieselbe Weise in die Handdatei.
- **Übernahme im Katalog (11.10.2026, Stufe C Teil 3):** dieselbe Regel für `ohne-synchro.json` — `pipeline/bau/anisearch-reihen-katalog.ts` (rein) + `anisearchKatalogReihen` in `anisearch-reihen-pruefliste.ts`, aufgerufen in `schreibeOhneSynchro` (`nebendateien.ts`) nach `reihenFuerKatalog` und der Dublettenprüfung. Hauptbestand und nachgetragene Titel sind **Anker**: Sie ziehen nie um, auch nicht allein stehend, und sind Ziel (ein Katalogtitel an einen allein stehenden Anker erhält dessen Kennung als `franchiseId`). Paare aus einem allein stehenden Anker und einer Katalog-Reihe gehen nur über eine Änderung des Hauptbestands und stehen **nicht** auf der Prüfliste, sondern als Zahl `katalog.bestandEinzeln` (11.10.2026: 396). Die Prüfliste trägt je Zeile `quelle` (`bestand` / `katalog`); jede Stufe schreibt nur ihren Teil, doppelte Reihenpaare erscheinen einmal. **Zwei Zusätze nach der Prüfung (11.10.2026):** (1) Die `getrennt:`-Einträge aus `data/reihen-von-hand.yaml` gelten auch im Katalog (`ladeTrennungen()` an `uebernimmKatalogReihen`). (2) Ein Alleinstehender, dessen **einzige** Beziehungen Sammelarten sind (`Anderes`, `Charakter`, `Crossover`), wandert im Katalog nicht, sondern steht als Art `sammelart` auf der Prüfliste (`anisearch-reihen-sammelart.ts`; zusammenhängende Titel in einer Zeile, nur wenn eine Reihe in Reichweite ist oder mehrere Titel eine neue Reihe bildeten). Anlass: Katalogtitel „Final Fantasy“ (426) und „FF XIV: CHOOSE YOUR LIFE“ (118041) wanderten über „Anderes“ in FF VII: Advent Children. Im Hauptbestand gilt die Regel nicht (kein Sammelart-Satz übergeben). **`?` bleibt zählend:** von 82 Titeln, die nur über „?“ wandern würden, sind nach Namen von Hand etwa 12 falsch oder fragwürdig (Gekidol, Ogaki Matsuri, Hashtag/Shourai, Soukou Musume Senki, Kiki und Lala …), die übrigen ~70 plausibel (Specials, PVs und Filme zum selben Titel); „?“ zu sperren hielte mehr richtige als falsche zurück. Emulation 11.10.2026 (`public/data/` + Katalog-Cache vom 03.09., 15.127 Katalogtitel, mit Trennungen und Sammelart-Satz): 219 Alleinstehende angehängt (vorher 248), 27 neue Reihen (34), 250 Titel mit neuer `franchiseId` (288), 138 Fälle auf der Prüfliste (107; davon 38 `sammelart`, 15 mehrdeutig, 69 verschmilzt, 16 universum), 383 Paare mit einem allein stehenden Hauptbestandstitel (396). Stichprobe vor den Zusätzen (25 von Hand): Kernarten 10 von 10 richtig, Sammelarten (`?`, `Anderes`, `Charakter`) 13 von 15 plausibel (Prüfer: 4 von 15 falsch). **Offen:** `data/reihen-von-hand.yaml` wirkt nur im Hauptbestand (`verbindeKanten` filtert auf `titles.has`), die Katalog-Fälle der Prüfliste haben also noch keinen Weg; die 396 Einzeltitel-Paare brauchen den Katalog in `03-reihen.ts`.

## aniSearch-Archivseiten: Lücken zuerst, Pause statt Abbruch (10.10.2026)

Anlass: Für die AniList-Ablösung (Genres, Schlagwörter, Reihen aus den Archivseiten) fehlten Seiten. Gemessen 10.10.2026: Hauptbestand 306 von 2.928 Titeln ohne `data/anisearch-raw/<Kennung>.html.gz` (237 verschiedene Kennungen ohne Seite, dazu wenige mit Seite, aber ohne Cache-Eintrag), Katalog 3.003 Kennungen. **Ursache:** Die Warteschlange von `fetch-anisearch.ts` nahm nur Titel, die in der ID-Brücke (`data/anime-ids.json`) stehen; AniList-Titel mit Kennung aus Handdatei/MAL-Brücke und alle reinen aniSearch-Titel (Kennung ab 10.000.000) kamen nie dran. Der Katalog-Lauf hatte am 10.10. nur noch 9 Titel und lief 2 Minuten.

- **Vorrangliste** (`pipeline/lib/anisearch-archiv-vorrang.ts`): erst Hauptbestand-Lücken (Titel mit Termin, AniList-Titel vor reinen aniSearch-Titeln), dann die bisherige Auffrischung, mit `--katalog` zuletzt die Katalog-Lücken (deutscher Titel/sichere Synchro zuerst). Jede Kennung einmal. Eine Lücke = Kennung ohne Archivdatei, bei AniList-Titeln mit eigener Kennung auch ohne Cache-Eintrag. **Geteilte Kennungen** (42 Kennungen, 117 Titel) werden archiviert, füllen aber keinen Cache-Eintrag (im Cache steht bisher keine Kennung doppelt).
- **Takt unverändert:** HTML-Seiten, 6 s Abstand, `--limit` und neu `--frist <Minuten>`. Die Database-API liefert das Archivformat nicht; sie bleibt bei `fetch-anisearch-eintraege.ts`.
- **Sperre überleben** (`lib/anisearch-sperre.ts`): Fünf Fehlschläge in Folge → Pause 10, dann 20, dann 40 Minuten, danach eine einzelne Anfrage; erst nach den drei Pausen (oder wenn die Frist nicht reicht) endet der Lauf. Ohne `--frist` (Schritte in `refresh-*.yml`) endet er wie bisher sofort. Eine Nichtauskunft (423, 429, 5xx, Zeitüberschreitung) wird nie vermerkt; die Titel bleiben in der Lücke.
- **Endgültige Auskunft** steht in `data/anisearch-archiv-weg.json` (Kennung → Code, Datum): HTTP 404/410 60 Tage, Seite ohne Archivabschnitte (200) 14 Tage zurückgestellt.
- **Zähler im Lauf-Protokoll:** „aniSearch-Lücke vorher/nachher: Hauptbestand N, Katalog M Kennungen ohne Archivseite".
- **Schätzung:** 3.240 Seiten offen (237 + 3.003). Bei 6 s Abstand und 290 Minuten Frist holt ein Katalog-Lauf rund 2.500–2.700 Seiten → Lücke nach 2 Läufen (11.10. und 12.10., je 06:00 UTC) bis auf Zurückgestelltes zu; mit einer Sperre dazwischen 3–4 Läufe.

## aniSearch-Sprecherseiten: Hauptbestand zuerst, Rohseiten im Archiv (10.10.2026)

Anlass: Stufe D der AniList-Ablösung (Sprecher) braucht die Sprecherseiten des Hauptbestands. Gemessen 10.10.2026: von 2.849 verschiedenen Kennungen des Hauptbestands (2.924 Titel, 117 teilen eine Kennung) hatten 1.086 eine Seite; 1.763 offen, davon 1.519 mit Synchro-Marke. **Ursache:** `fetch-anisearch-sprecher.ts` nahm nur Kennungen aus `data/anisearch.json` und sortierte Titel ohne Marke zuerst; 7.630 Katalog-Kennungen standen vor dem Hauptbestand.

- **Reihenfolge** (`pipeline/lib/anisearch-sprecher-reihe.ts`, `sprecherLuecken`): Hauptbestand (Marke zuerst, auch Kennungen, die `anisearch.json` nicht kennt), danach Katalog (ohne Marke zuerst, wie bisher). Jede Kennung einmal. Fällig = keine Seite, Parser-Stand alt oder älter als 180 Tage.
- **Sperre, Frist, Zähler** wie bei den Archivseiten (`lib/anisearch-sperre.ts`): Pause 10/20/40 Minuten statt Abbruch, danach eine Einzelanfrage; die Frist ist das bestehende `--minuten` (Standard 100), also **keine Workflow-Änderung**. Log: „aniSearch-Sprecher-Lücke vorher/nachher: Hauptbestand N von M, Katalog K von L". HTTP 404/410 steht 60 Tage in `data/anisearch-sprecher-weg.json`; eine Nichtauskunft (429, 5xx, Zeitüberschreitung) nie. 15 Seiten ohne jede Besetzungszeile in Folge (484 von 5.078 sind leer) gelten als Sperrseite und werden nicht als Befund gespeichert.
- **Archiv:** `data/anisearch-sprecher-raw/<Kennung>.html.gz` (gzip, Besetzungszeilen `<tr>…</tr>` roh, Kopf/Fuß weggelassen; Seiten ohne Zeilen nicht). Das Archiv `anisearch-raw` enthält keine Sprecher. Größe je Seite erst nach dem ersten Lauf bekannt.
- **Schätzung:** Die Läufe der letzten Tage holten 830–860 Seiten (100 Minuten Frist, Grenze 1.100): Hauptbestand mit Marke in 2 Läufen, der ganze Hauptbestand in 3 (1.763 / ~850), danach Katalog.

## Studio aus dem aniSearch-Archiv für Titel ohne Studio (14.10.2026)

Anlass: Lückenliste Studio vom 14.10.2026: 206 von 2.921 Titeln ohne Studio (Liste A 11, B 195), bei 104 nennt die archivierte aniSearch-Seite eines. Gelesen wird nur `data/anisearch-raw/<Kennung>.html.gz` (kein Abruf); der Parser war da (`extractInfo`, Feld „Studio" der Infobox, `info.studios` in `data/anisearch.json`), der Bau nutzte ihn nur für den Spaltenvergleich.

- **Einbau:** `pipeline/bau/studio-aus-archiv.ts`, `ergaenzeStudiosAusArchiv`, aufgerufen am Anfang von `baueMeta` (nach `baueTitelGemessen`, damit die AniList-Spalte des Vergleichs unverfälscht bleibt; vor `slim` in 13-2, das die Felder kopiert). Kennung über `anisearchKennungen` (eigene Seite, nie Namensabgleich), nicht über `anisearch.json`: Princess Principal Crown Handler Kapitel 5 und 6 (Seite 13597) stehen dort nicht.
- **Vorrang:** nur Titel mit leerem `studios`; ein vorhandenes Studio (AniList) wird nie ersetzt (gemessen: 0 geänderte von 2.924). Eine von mehreren Titeln geteilte Seite gilt nur, wenn ihr Studio den Studios, die AniList den anderen Titeln der Seite nennt, nicht widerspricht (`seiteEindeutig`, Enthaltensein wie im Spaltenvergleich); sonst bleibt der Titel auf der Liste. Persona 3 (Seite 7939): Teil 1 AIC A.S.T.A., Teile 2 bis 4 A-1 Pictures, die Seite gilt für kein Teil. Crown Handler Kapitel 5 und 6 (Seite 13597) stimmen mit allen vier Geschwistern („Actas") überein. Im Bestand vom 14.10.2026 ist 13597 die einzige geteilte Seite mit leerem Titel. Die Kennungen kommen aus dem ganzen Bestand (`anisearchKennungen` vergibt MAL-Brücken nur an freie Seiten; heute 0 von 206 anders, aber latent).
- **Schreibweise:** zuerst die AniList-Form des Bestands über denselben Schlüssel wie der Spaltenvergleich (`studioName`; „TMS Entertainment Co., Ltd." → „TMS Entertainment"), sonst die Rechtsform am Ende abgeschnitten („Zuiyo Co., Ltd." → „Zuiyo"; „ICHI Corporation" bleibt). Höchstens drei Studios wie bei AniList. Katalogtitel (aniSearch-Titel ohne AniList) tragen weiter aniSearchs eigene Schreibweise (101 Titel, unverändert).
- **Grenzen:** aniSearch kennt nur „Studio", keine Rollen (Animation/Produktion): „Bandai Namco Music Live Inc." bei Harlock Saga steht so auf der Seite. Der Archivstand gilt; nach einem neuen Seitenabruf greift der nächste Bau.
- **Messung (`tools/bau-vergleich.mjs 8af4a2afa 38021dab4`):** 104 Titel bekommen ein Studio (109 Einträge in `titles.json`, 13 in `titles-core.json`, 2 in `woche.json`), 0 ändern sich, sonst nur die Patch Note. Lückenliste nachher: 102 offen (A 3, B 99): MHA „I Am a Hero Too", Super Wings, „2.5 Dimensional Seduction" haben auf der Seite kein Studio-Feld. Prüfung `pipeline/check-studio-archiv.ts` (in `check:logic`). Die Studios der übrigen 2.440 Titel bei AniList umzustellen ist nicht geschehen; die Messung dafür liefert `data/anisearch-abweichungen.json` (Feld `studios`).

## PSYREN: Pille ohne Sprachangabe, Handlung nur englisch (10.10.2026)

- **Pille:** Ein Weg beim Anbieter eines angekündigten Simulcasts ohne belegte Synchro (`dub` fehlt, `ankuendigung.platform` gleich) trägt in der Pille „OmU" und einen Tooltip (`streamNurOmu()`, `shared/ankuendigung.ts`). Gemessen 10.10.2026: 3 Titel im Hauptbestand (PSYREN, Black Clover S2, Apothekerin S3), 0 im Katalog. Der Weg bleibt, weil er der Ort ist, an dem die Synchro erscheinen soll.
- **Handlung:** Die aniSearch-Seite von PSYREN (21084) war nie geholt worden — der Abruf ging nur über die ID-Brücke (anime-offline-database), PSYREN steht dort nicht, nur in `data/anisearch-ids-hand.yaml`. Seit #678 (10.10.2026) nimmt `archivLuecken()` auch `titles.anisearchId`; PSYREN steht an Stelle 70 von 237 Aufträgen des Hauptbestands und kommt im nächsten `data:anisearch`-Lauf. Von 2.928 Titeln des Hauptbestands hatten am 10.10.2026 315 keinen deutschen Text: 225 mit aniSearch-Kennung, aber nie geholter Seite, 86 mit geholter Seite ohne deutsche Beschreibung, 4 ohne Kennung. Die 86 und die 4 sind der Stoff der Lückenliste; Übersetzen ist ausgeschlossen.

## Paramount+ als Plattform: Avatar: Die sieben Häfen (10.10.2026)

- **Plattform `paramountplus`:** Farbe `#0064ff` (Markenseite, simple-icons `0064FF`), mindestens 3,3:1 gegen alle Gründe beider Themen (`pipeline/check-paramount.ts`; die Plaketten-Schrift rechnet `plakettenStil` wie bei jeder Plattform). Icon aus simple-icons (CC0), Suche `paramountplus.com/de/search/?q=`, Adresse `paramountplus.com`, Zugang Abo.
- **Eintrag:** `streaming-herbst-2026.yaml`, Cartoon-Kennung -284833 (TMDB; bei AniList nicht geführt, Suche „Avatar Seven Havens" 0 Treffer). Anime2You 1059426 (09.10.): Folgen 1–3 ab sofort Deutsch und OmU, 4–6 am 16.10., 7–9 am 23.10., 10–13 am 30.10.; 1059483 (10.10.): erste Staffel hat 13 Folgen, die Serie wächst auf vier Staffeln (nicht „26 Folgen").
- **Bewusst nicht angefasst:** `ANISEARCH_PLATFORM`, `platformFromSite` und `ANBIETER` in `lib/cartoons.ts` kennen Paramount+ weiter nicht — sonst würden aniSearch-Verweise und die TMDB-/JustWatch-Wege der Cartoons zu Streams (Datenänderung, eigener Auftrag). Die Pillen „Paramount+ (über TMDB)" tragen seit dem Eintrag Farbe und Icon.
- **Kalender:** Ein Termin mit Cartoon-Kennung steht im Kalender ohne Cover (`titles-core.json` führt nur AniList-Titel); das Detail-Panel lädt den Cartoon nach.

## Anime2You vollständig lesen, Stufe P2: Claude wertet neue Artikel aus (10.10.2026)

Anlass: Feeds und Wortmarken-Filter übersehen, was nur im Fließtext steht (am 10.10.2026 fehlten YAIBA auf ProSieben MAXX, One Piece auf MAXX, Avatar: Die sieben Häfen auf Paramount+ und die Quelle der Jujutsu-Disc). P1 (Lesefixes) ist #669.

- **Ablauf** (`claude-anime2you-extraktion.yml`, täglich 12 UTC über `shared/weckplan.ts`): `pipeline/anime2you-extraktion.ts --auswahl` holt zwei Seiten des Gesamt-Feeds (50 Artikel), wählt Neue (nicht in `gelesen`; seit 12.10.2026 zählen auch Artikel in `sources` als neu, siehe unten), liest je Artikel die Seite (1,5 s Abstand, höchstens 30 Abrufe, 20 Lesungen) und lässt nur Artikel mit Deutschland-Bezug (`lohntLesung`) an Claude. Bei null startet kein Claude. Claude (`claude-sonnet-5`, nur Read/Edit, **kein Bash**; `.git` zum Lesen, `.git` und `.github` zum Schreiben (Edit/Write) gesperrt) füllt je Artikel `ergebnis/<id>.json`, nach Anleitung `pipeline/anime2you-extraktion-anleitung.md`. `--uebernehmen` prüft und schreibt `data/proposals/anime2you-extraktion.json`; eingereicht wie jeder Sammler über `quellen-pr.sh` (Auto-Merge nur konfliktfrei), Zusammenfassung als PR-Kommentar.
- **Der Artikeltext ist fremde Eingabe.** Darum entscheidet das Modell nichts: `lib/anime2you-vorschlag.ts` verwirft jeden Vorschlag, dessen Zitat nicht wörtlich im Artikel steht (Leerraum zählt nicht — der Seitentext hat Lücken wie „1122 ,“), dessen Titel weder im Zitat noch im Artikeltitel steht (Untertitel egal), dessen Sender oder Anbieter das Zitat nicht trägt (`lib/anime2you-abgleich.ts`; Schreibvarianten wie „ProSiebenMaxx“, „Amazon“ zählen, ein anderer bekannter Sender im Zitat widerlegt; steht der Name nur im Artikeltext, kommt der Vorschlag mit Warnung durch), dessen Zitat eine Adresse oder ein @ enthält (`sauber()`, sonst landet es im PR-Kommentar), dessen Tag, Uhrzeit oder Sprache das Zitat nicht trägt oder dessen Plattform nicht im Datenmodell ist (dann `plattform: null` und der Name in `anbieter`, z. B. Apple TV+). Die Plattformliste kommt aus `PLATFORMS` (`shared/types.ts`), seit 10.10.2026 mit `paramountplus`; die Anleitung nennt sie von Hand, `check-anime2you-vorschlag.ts` prüft, dass keine fehlt. Die Quelle setzt das Skript aus der Artikelkennung, nie das Modell. Wochentag-Abweichung (Datum gegen Zitat) und Uhrzeit-Widerspruch zwischen zwei Artikeln (`mitWiderspruechen`) kommen mit Warnung durch.
- **Der Bestand speist keinen Bau.** Ein Vorschlag wird erst durch einen Handeintrag zum Termin. Offen: Katalog-Abgänge (`abgang`) fehlen im Datenmodell. (Stand 13.10.2026: Paramount+ ist seit 10.10. Plattform; die Art `rhythmus` und die Auswahl schon zitierter Artikel kamen am 12.10. mit #966, siehe „Auswahl“ unten.)
- **Messung 10.10.2026** (Claude-Lauf lokal mit den Workflow-Freigaben, vier echte Artikel, zweiter Lauf nach Schärfung der Anleitung): 14 Vorschläge, 0 verworfen. YAIBA 05.11. `tv` ProSieben MAXX 18:25 Mo–Fr deutsch (mit Warnung: One-Piece-Artikel sagt 18:30); One Piece 05.11. 18:50 Folge 780–877 deutsch; Characters-Log-Specials 29.10. `omu`; Frühjahr 2027 ab Folge 1123 als `ankuendigung` ohne Tag; Avatar: Paramount+, `plattform` null, deutsch+omu, Blöcke 16./23./30.10. mit Folgen; Jujutsu-Disc `disc` 15.01.2027 deutsch+omu. Erster Lauf: 5 von 11 Zitaten verworfen, weil das Modell Leerzeichen vor Satzzeichen glättete — Vergleich ohne Leerraum behoben.
- **Erster Lauf rot (11.10.2026, Lauf 38131274505):** Auswahl (20 Artikel) und Claude-Schritt liefen durch (14 Züge, 152 s, `permission_denials_count` 0, grün), aber alle 20 Antwortdateien blieben die ungeänderte Vorlage; `--uebernehmen` brach mit „Claude hat keinen einzigen Artikel als gelesen gemeldet" ab (das Fangnetz hat gegriffen, es entstand kein PR). Vermutete Ursache (der Lauf hat sein Protokoll nicht aufbewahrt, Beleg nur über das Werkzeug): `Edit` auf eine vorbereitete Datei verlangt, dass das Modell sie vorher gelesen hat, sonst gibt es einen Werkzeugfehler **ohne** Verweigerung (so im Bauer-Lauf am 11.10.2026 gemessen: „File has not been read yet"). Behoben: `--auswahl` legt keine Vorlagen mehr an, Claude legt `ergebnis/<id>.json` mit Write neu an (Freigabe weiter als `Edit(...)`, gilt auch fürs Write-Werkzeug, siehe `pr-pruefer.yml`). Der Fund sichert jetzt auch `claude-execution-output.json` (das Protokoll des Modells). Rechte, Secret und Pfade waren in Ordnung (OIDC-Token, Claude-Installation, `Read`-Freigaben ohne Verweigerung).

## aniSearch-Reihen: Katalog-Lauf vom 10.10.2026 senkte den Wert, Seiten waren in Ordnung (11.10.2026)

Der Katalog-Lauf (PR 712) brachte 2.522 neue Archivseiten (alle mit Informations- und Relationenblock, keine Sperrseite, keine Überschreibung). Die Prüfung `check-anisearch-reihen.ts` fiel von 78,0 % auf 68,1 % gleich, weil jetzt 2.035 aniSearch-Titel (Id ≥ 10.000.000) mitzählten, deren `franchiseId` nur sie selbst ist (AniList kennt sie nicht): jede aniSearch-Reihe aus mehreren davon galt als „zusätzlich" (643 statt 0). Titel mit Id < 10 Mio.: 77,4 % vorher wie nachher. Seit 11.10.2026 zählen Titel ohne Referenz-Reihe nicht mit (`deckung.ohneReferenz`, 2.409); Wert 77,1 % bei 15.091 Titeln. Ob die aniSearch-Reihen für diese Titel taugen, zeigt dieser Vergleich nicht — dafür braucht es eine eigene Messung.

## Prime-Kanal übernimmt die Folgenzahl des Anbieters (11.10.2026)

Daniel (11.10.2026): „Die echte Webseite führt den Prime-Kanal.“ Ein Prime-Video-Kanal-Weg (`platform: primevideo`, `kanal` gesetzt) zeigt deshalb dieselbe Folgenzahl wie der Weg des Anbieters, dessen Kanal er ist — ohne Hinweis an der Zahl (Tooltip „Zahl von Crunchyroll übernommen“ und Laufzeit-Marker `bestandVon` sind weg).

- **Tabelle Kanal → Anbieter an einer Stelle:** `KANAL_ANBIETER` in `web/src/components/detail/prime-kanal.ts` (Crunchyroll → crunchyroll.com, ADN → animationdigitalnetwork.com). Aniverse und RTL+ stehen nicht drin: Im Bestand (11.10.2026) hat keiner der 137 Aniverse- und 3 RTL+-Kanal-Wege einen eigenen Anbieter-Weg, aus dem eine Zahl käme. Neuer Kanal erst mit eigenem Weg des Anbieters und Domain-Beleg.
- **Regel:** Der Kanal-Weg zeigt die **Vereinigung** seiner eigenen deutschen Bereiche (`dub: true`) und der Bereiche des Anbieter-Wegs (`streamsMitKanalBestand`); ein belegter Bestand wird nie kleiner (Lupin III Part 6: Kanal 25, Crunchyroll belegt 1–24 → bleibt 25). „Ohne Ton“-Handbelege am Kanal weichen den Anbieter-Bereichen (Hensuki, One Punch Man 2: Daniels Entscheidung); ein Präfix-Test entfällt. Belegt der Anbieter keine Bereiche, zählt seine Pille nach Wochenplan oder ganzem Titel, und der Kanal zählt genauso (`folgenAuskunft`). Kanal-Wege ganz ohne eigene Bereiche bleiben unverändert. **Bedingung:** Kanal-Weg selbst `dub === true` und Anbieter-Weg `dub === true`. Golden Wind: Crunchyroll `dub: false` oder Kanal-Weg `dub` undefined erben nichts.
- **Test:** `pipeline/check-prime-kanal.ts` (Slime, Hensuki, Lupin, ADN, Golden Wind, fremder Kanal).
- **A/B über 274 Kanal-Wege (11.10.2026):** 8 Pillen ändern sich (JoJo TV, Haikyuu!!, One Punch Man 2, Boku no Hero Academia 4, Hensuki, Mob Psycho 100 III, Golden Kamuy 4th Season, Ore dake Level Up S2), alle Crunchyroll-Kanal; die ADN-Wege (10) und Lupin III Part 6 bleiben gleich.

## Anime2You-Extraktion: Sammelartikel nicht mehr verworfen (11.10.2026)

Erster grüner Lauf (38132571893): 21 Vorschläge, 20 verworfen. Von den 20 gingen 14 auf Titelblöcke in Sammelartikeln („Sechs weitere Anime-Neustarts“, „sechs neue Simulcast-Lizenzen für 2027“, „Fünf Anime-Neuzugänge auf Prime Video“).

- **Ursache:** Das Modell zitierte die Zeilen `Sprache: … Simulcast: …` des Blocks; der Titel steht eine Zeile darüber (`»Horror Collector«`). `titelPasst` sah nur Zitat und Artikeltitel. „Nur im Artikeltext mit Warnung“ galt bisher für Sender und Anbieter, nicht für den Titel.
- **Behebung:** `lib/anime2you-blockkopf.ts` — der Titel gilt als belegt, wenn das Zitat im Block unter einer Titelzeile `»Titel«` liegt (höchstens 8 Zeilen darunter), die genau diesen Titel nennt (Wörter gleich, Zusatz „– Staffel 2“ erlaubt); Warnung „Titel steht nur in der Titelzeile …“. Kein Treffer über den Artikeltext allgemein: ein Zitat aus dem Block eines anderen Titels, eine Aufzählung am Artikelanfang oder ein Zitat, das in den nächsten Block hineinreicht, bleiben verworfen. Steht derselbe Wortlaut in mehreren Blöcken („Sprache: Japanisch (UT)“), gilt er für jeden dieser Titel. Tag, Uhrzeit und Sprache müssen weiter im Zitat stehen. Die Anleitung lässt das Zitat mit der Titelzeile beginnen.
- **Zwei weitere Fehlverwerfungen derselben Artikel:** „The Sky Crawlers“ trug „Sky“ als fremden Anbieter ins Zitat (der Titel wird vor dem Anbieterabgleich herausgenommen); „Sprache: Deutsch, Japanisch (UT)“ und „mit deutscher und japanischer Sprachausgabe“ las `dubBefund` wegen des Untertitel-Teils als „nein“ (`DEUTSCH_ANGEBOT` in `anime2you-vorschlag.ts`; `sprachbefund.ts` selbst unverändert, es speist auch den Bau).
- **Messung:** dieselben 41 Rohantworten des Laufs durch die neue Prüfung: 41 bestanden, 0 verworfen (vorher 21/20). Test: `pipeline/check-anime2you-sammelartikel.ts`.

## Anime2You-Extraktion: Weg vom Vorschlag zum Handeintrag (11.10.2026)

Vorgesehen war bisher nur „ein Vorschlag wird erst durch einen Handeintrag zum Termin“ (Abschnitt P2); ein Werkzeug dafür gab es nicht. Jetzt: `npx tsx pipeline/anime2you-entwurf.ts` (Logik in `lib/anime2you-entwurf.ts`, Test `check-anime2you-entwurf.ts`).

- **Belastbar** heißt: Art ist ein Termin (`start`, `folgen`, `disc`, `kino`), ein Tag steht im Zitat, die Sprache ist `deutsch` oder `deutsch+omu`, die Plattform steht im Datenmodell (bei `tv` der Sender), und keine Warnung betrifft Wochentag oder Uhrzeit. Warnungen zum Namen („steht nur im Artikeltext“, „nur in der Titelzeile“) lassen den Vorschlag belastbar, stehen aber als Kommentar im Entwurf.
- **Schon drin** (Titelebene, `curated/` per js-yaml): gleicher Titel (`search`/`titleDe`), gleicher Weg (bei `tv` gleicher Sender) und gleicher Starttag. Artikelkennung oder Slug-Anfang allein genügen nicht (Sammelartikel nennen mehrere Titel; „one-piece“ trifft auch „one-piece-film-…“). Hat ein Eintrag denselben Artikel, Weg und Tag unter anderem Titel (Handeinträge heißen oft deutsch), bleibt der Vorschlag „neu“, die Tabelle nennt den Eintrag zum Gegenlesen. Ohne Tag, aber mit „ab sofort“/„seit heute“: Hinweis „im Angebot spätestens seit <Artikeldatum>“, nie als Erscheinungstag.
- **Ausgabe:** `data/proposals/anime2you-entwurf.yaml` (kein Teil des Baus, in `.gitignore`: wird bei jedem Lauf neu erzeugt, die Durchsicht läuft über die Tabelle und die Datei lokal; bei „vermutlich derselbe“ steht ein `# Achtung:`-Kommentar über dem Eintrag) mit je einem Eintrag im Format von `data/curated/_SCHEMA.md` (`search` statt erfundener `anilistId`, `sources` = Artikeladresse, das Zitat als Kommentar darüber), dazu die Tabelle für die PR-Beschreibung auf der Standardausgabe. Das Übernehmen nach `data/curated/` ist Handarbeit nach der Durchsicht; Disc-Einträge brauchen `publisher` und `edition` aus dem Artikel.
- **Erste Anwendung (11.10.2026) auf die 21 Vorschläge des ersten Laufs: 1 neu, 2 schon drin (One Piece, YAIBA), 18 nicht belastbar** (8 Ankündigung oder Pause, 4 ohne Tag, 6 ohne belegte deutsche Fassung). Das eine „neu“ ist die Jujutsu-Disc vom 15.01.2027: Der Handeintrag `jujutsu-kaisen-hidden-inventory-premature-death-blu-ray` führt sie unter dem englischen Titel (gleicher Artikel, Weg, Tag) — also eine Dublette, kein offener Termin. Nach der Sammelartikel-Korrektur (PR 765, 41 Vorschläge aus den Rohantworten des Laufs): ebenso 1 neu (dieselbe), 2 schon drin; die Sammelartikel-Starts sind „ab sofort“ ohne Tag (die Anleitung verlangt `datum: null`) und deckt weiter `scrape-anime2you.ts` ab.

## Anime2You-Extraktion: Art „rhythmus“ und Artikel aus `sources` (12.10.2026)

Anlass: Avatar: Die sieben Häfen, Artikel 1059483 („Bis zum 30. Oktober 2026 folgen wöchentlich jeweils drei bis vier weitere Episoden“) — die Extraktion kannte keine Art dafür und hätte den Artikel ohnehin übersprungen, weil ein Handeintrag ihn in `sources` führte.

- **Art `rhythmus`** (`lib/anime2you-rhythmus.ts`, Anleitung, `ARTEN`): zusätzliche Felder `proWoche: [von, bis]` (ganze Zahlen 1–20) und `bis` (Enddatum); nur bei dieser Art, sonst fehlen sie. Gegenprobe am Zitat: ein Takt-Wort (wöchentlich, pro/je/jede Woche, jeden <Wochentag>), die Spanne steht **im selben Satz wie das Takt-Wort** (Ziffern oder Zahlwörter bis „zwölf“; hat der Nebensatz mit dem Takt-Wort eine Zahl, zählt nur er; Tage wie „30. Oktober“ oder „10.10.“ und „13-teilig“ werden vorher ausgenommen; „die ersten drei Episoden“ im Satz davor und „drei bis vier Hauptfiguren“ im Nachbarsatz zählen nicht), das Enddatum steht im Zitat und liegt nicht vor dem Artikeldatum. Titel, Sender, Anbieter, Plattform laufen durch die bestehende Prüfung. Das Format entspricht dem Handbeleg `Release.rhythmus` (PR 959: `proWoche`, `bis`, `quelle` = Artikeladresse, `stand` = Artikeldatum); der Entwurf (`anime2you-entwurf.ts`) führt die Art weiter als „kein Termin“, einen Handbeleg-Entwurf gibt es nicht.
- **Auswahl:** `neueKandidaten` fragt nicht mehr nach `eingearbeiteteAdressen()`. Ein Artikel gilt als neu, solange `gelesen` ihn nicht kennt (der Bestand hält 90 Tage, der Feed reicht etwa 5 Tage zurück). Kleinster Weg: Die Kennungen gelesener Artikel stehen schon im Bestand, kein zweites Verzeichnis. Folgen: Beim ersten Lauf werden die Artikel des Feeds, die von Hand eingearbeitet, aber nie extrahiert wurden, einmal gelesen (höchstens 30 Abrufe, 20 Lesungen wie bisher); Vorschläge, die der Bestand schon trägt, erkennt der Entwurf auf Titelebene als „schon drin“.
- **Test:** `pipeline/check-anime2you-rhythmus.ts` (in `check:logic`), am Wortlaut von 1059483: Vorschlag 3–4 je Woche bis 2026-10-30 besteht (Paramount+ steht nur im Artikeltext: Warnung); falsche Spanne, fehlendes oder fremdes Enddatum, fehlender Takt, fremder Titel werden verworfen; die Adresse steht in den `sources` einer Attrappe (kein Live-Datenstand) und der Artikel ist trotzdem Kandidat, bis er in `gelesen` steht.

## Sprecher aus aniSearch statt AniList, Stufe D (11.10.2026)

Der Bau (`pipeline/bau/sprecher-anisearch.ts`, aufgerufen aus `rolleTermineAus` vor dem Lesen von `voices/`) legt die Besetzung aus `data/anisearch-sprecher.json` zuerst in `public/data/voices/<id>.json` (`von: 'anisearch'`). AniList- und ANN-Rollen bleiben nur, wo aniSearch den **Sprecher** im Titel nicht führt (erstes + letztes Namenswort, gefaltet; `sprecher-zusammen.ts`). Dieselbe Figur mit anderem Sprecher bleibt ebenfalls (zweite Besetzung oder Aliasname, aus den Namen nicht zu entscheiden; Beispiel Ed in Cowboy Bebop: Brokowski neben Otto). Wiederholbar: aniSearch-Rollen werden bei jedem Bau neu abgeleitet, die übrigen bleiben stehen; `fetch-ann-voices.ts` legt ANN-Rollen eines von aniSearch geführten Sprechers nicht mehr zurück, `fetch-voices.ts` fragt Titel mit aniSearch-Besetzung nicht mehr bei AniList nach.

- **Messung vor dem Bau** (Bestand 11.10.2026, 2.928 Titel; Hauptbestand-Seiten 2.283 geholt, 2.064 mit deutscher Besetzung): Titel mit Rollen aus AniList 1.746 (21.924 Rollen), aus ANN 1.383 (8.746). Zehn Titel von Hand (Cowboy Bebop, Chobits, X, MEZZO, Mirai Shounen Conan, Escaflowne, Yu-Gi-Oh! Duel Monsters, Nausicaä, Haruhi, Dragon Ball Z): dieselben Personen, Abweichungen sind Schreibweise (Alias Brokowski/Otto) und einzelne Nebenrollen, die aniSearch anders vergibt (Chobits Sumomo, Escaflowne Dryden Fassa).
- **Nachher** (Emulation: Bauphase auf den echten Daten, der Gesamtbau bricht lokal an der veralteten `data/cache` ab): AniList 773 Titel / 2.609 Rollen, ANN 588 / 1.304, aniSearch 2.049 / 57.737. Titel mit Rollen 1.965 → 2.263 (+298). Von den AniList- und ANN-Rollen in Titeln mit aniSearch-Besetzung ersetzt aniSearch 26.757, es bleiben 1.749 (93,9 % ersetzt). **Kein Titel verliert Rollen** (Bau bricht sonst ab); 12 Titel mit geteilter aniSearch-Kennung bleiben unverändert, ihre Seite gehört der ganzen Reihe. Kein Sprecher geht verloren (Schlüsselvergleich 0 fehlend); 35 Anzeigenamen heißen anders, weil aniSearch den vollen Namen führt („Franz Strohmeier" bei AniList, „Franz Josef Strohmeier" bei aniSearch).
- **Gewinn 298 Titel**, davon 292 mit anderem Beleg einer deutschen Fassung (149 Stream mit `dub`, 277 Erstausgabe mit Synchro), 6 ohne (Tsugu Tsugumomo, Binbougami ga!, Yofukashi no Uta Season 2, Hanarokushou ga Akeru Hi ni, Shin Samurai-den YAIBA, ALL YOU NEED IS KILL): dort belegen erstmals Sprecher die Fassung. Die Neu-auf-Deutsch-Meldung rechnet vom ersten Auftreten im Bestand, nicht vom Merker `hasVoices`; sie meldet diese Titel nicht neu.
- **Namen:** aniSearch schreibt den Familiennamen groß. Zuerst gegen die im Bestand geführte Schreibweise (ganzer Name gefaltet, ß = ss), nur sonst die Regel (große Wörter neben gemischten werden klein mit Anfangsbuchstaben, Partikel klein). Gemessen: 55.744 von 58.763 Sprechernamen aus dem Bestand, 3.019 nach Regel; aniSearch behält Umlaute.
- **Sprecher-Index:** 2.607 → 3.712 Sprecher, 27.468 → 52.322 Sprecher-Titel-Paare, Index 20 → 28 KB gepackt. Gruppe „m" wöge 72 KB (Grenze 60 KB), deshalb Gruppen nach zwei Buchstaben (`sprecherGruppe`, größte Gruppe 50 KB). Quellzeile im Panel nennt aniSearch und/oder AniList je nach Rollen.
- **Zählung je Quelle** schreibt der Bau nach `data/sprecher-quellen.json` (nur bei geänderten Zahlen). Offen: die Sprecher-Seiten des Hauptbestands sind noch nicht vollständig geholt (Stand 11.10.2026: Lücke 572), jeder weitere Lauf verschiebt Rollen von AniList zu aniSearch. Abbau von `data:voices` ganz, wenn die AniList-Titel unter etwa 1 % der Titel mit Rollen sinken (rund 17 Titel) und die Sprecherzahl im Index vorher/nachher gleich bleibt; aniSearch-Daten sind mit Quellenangabe ausdrücklich erlaubt (geklärt, Daniel 11.10.2026; Bilder nie per Hotlink), die Nennung „aniSearch“ im Panel genügt; ANN verlangt zusätzlich den Link. Deckung vor dem Bau gemessen (10.10.2026): wo die aniSearch-Seite geholt war, ersetzten aniSearch + ANN 95,2 % der AniList-Sprecher je Titel.

## JustWatch-Vertrauensregel „Deutsch laut JustWatch" für Prime (11.10.2026)

**Abgelöst am 16.10.2026** durch „JustWatch-Ton je Seite“ (unten); `justwatchDeutsch` gibt es nicht mehr.

Messung: `daniel-zum-abarbeiten/berichte/justwatch-vertrauen-2026-10-11.md`. Prime (Prime Video, mit Werbung, Amazon-Kanäle), Film oder einzeln geführte Serie, `audio` enthält `de`: 465 von 468 richtig (99,4 %, Wilson 98,1–99,8). Mehrteiler (mehrere unserer Titel teilen eine JustWatch-Serie): 95,5 % — dort verwechselt JustWatch die Staffel, deshalb keine Kennzeichnung.

- **Regel** (`pipeline/lib/jw-vertrauen.ts`, Schritt `pipeline/bau/11-6-jw-vertrauen.ts` am Ende von `schliesseWegeAb`): Weg ohne Urteil (`dub` fehlt), Adresse ist die gti des JustWatch-Angebots mit `de`, Befund jünger als 28 Tage und ohne verfehlte Suche, Film oder Serie mit genau einem Titel je JustWatch-Kennung, kein Handbeleg- oder Urteils-Nein (auch „nicht verfügbar") bei Prime. Cartoons: nicht.
- **Ergebnis:** `dubQuelle: 'justwatch'` und `dubStand` (Datum des Befunds) am Weg. `dub` bleibt offen — kein Beleg; Handbeleg, Messurteil und Anbieter-API setzen `dub` und gehen vor. Panel: Umriss-Häkchen statt gefülltem, Hinweis „Deutsch laut JustWatch (Stand …)".
- **Wirkung am 11.10.2026:** 0 Wege. Im Hauptbestand tragen 778 von 780 Prime-Wegen schon ein Urteil, die 2 offenen haben keine gti-Adresse. Die Regel greift bei neuen Titeln. 12 Prime-Wege haben weder Handbeleg noch Messurteil; 10 davon tragen schon ein volles Häkchen (Quelle je Weg nicht gespeichert, u. a. aus der JustWatch-Runde in `11-2-justwatch.ts`), bei 6 hätte die Regel zugestimmt. Sie bleiben unverändert; Folgeschritt wäre, die Herkunft auch an den Setzstellen zu speichern.
- **Mehrteiler später:** Der Abruf speichert je Staffel `staffeln` (Nummer, Abo-Angebote mit `audio` und Adresse). Eine Regel für Mehrteiler erst, wenn eine Messung wie im Bericht ≥ 98 % bei n ≥ 50 zeigt.

## Eigene Kopien der aniSearch-Cover: Sammler (11.10.2026)

- **Entscheidungen (Daniel, 11.10.2026):** aniSearch-Bilder herunterladen und selbst ausliefern ist erlaubt, nie hotlinken; Ziel Cloudflare R2, Upload lokal per wrangler (kein R2-Token in Actions); Abruf nur in Actions, nie von Daniels Rechner. Befund und Optionen: `daniel-zum-abarbeiten/berichte/anisearch-cover-hosten.md`.
- **Lauf:** `daten-auf-abruf.yml`, Option `data:anisearch-cover`. Erst `npm run data:anisearch-robots` (robots.txt beider Hosts wörtlich nach `data/anisearch-robots.txt`; Abbruch, wenn `/images/anime/cover/` für alle oder uns gesperrt ist, 403/5xx auf robots.txt zählt als gesperrt, 404 als frei), dann `pipeline/fetch-anisearch-cover.ts --limit N` (Standard 400, die Grenze im Formular ist 300).
- **Ablauf:** Titel ab Kennung 10.000.000 ohne `coverImage` in `public/data/titles.json` und `ohne-synchro.json`; je zehn Kennungen eine API-Antwort (`cover`-Objekt, groß vor mittel, nur Host `cdn.anisearch.de`), dann `_300` im Abstand von 2 s; WebP 300 px q70 (sharp) nach `cover-ausgabe/anisearch/<Kennung>.webp` (Actions-Artefakt, 14 Tage). Bei 403/423/429 (und Netzfehlern) drei Fehlschläge in Folge → Pause 10/20/40 Minuten (`nachFehlern`), dann eine einzelne Anfrage; Nichtauskunft wird nie vermerkt.
- **Manifest `data/cover-eigen.json`:** aniSearch-Kennung → `datei` (Pfad relativ zur Bild-Domain, z. B. `anisearch/123.webp`), `groesse`, `quelle`, `stand`. Ohne Bild, mit `grund`: `platzhalter` (`ecchi…`, `cover/0_…`), `nsfw` (18), `ohne-adresse`, `nicht-gefunden` (404). Die Bild-Domain kommt später als eine Konstante.
- **Form des `cover`-Objekts, gemessen im Probelauf 11.10.2026 (Run 38144976580, 3 Titel):** `{"available":true,"medium":"https://cdn.anisearch.com/images/anime/cover/0/126_400.webp","large":"…/126_600.webp","copyright":null,"nsfw":null}`; Antwort-Schlüssel `id, url, external_ids, origin, title, title_native, status, year, season, type, episodes, duration, aired_from, aired_to, studios, genres, adapted_from, cover, popular, trending, rank, score, member_count, rating_count, synonyms, related, releases`. Die Adressen stehen auf **`cdn.anisearch.com`** (nicht `.de`); der Sammler holt vom robots-geprüften `cdn.anisearch.de` (gleicher Pfad, 200 bestätigt: `_300` 10–22 KB als WebP 300 px q70). `available: false` oder kein `cover` = keine Adresse; `nsfw` ungleich 0 wird ausgelassen. Fehlt in einem `cover`-Objekt die Adresse, wird sie aus der Kennung gebildet. Die ersten drei Antworten des Laufs schreibt der Sammler zur Kontrolle ins Log. Liefert ein ganzer Block (≥ 3 Titel) kein `cover`, endet der Lauf ohne Eintrag.
- **Lückenliste (26.10.2026):** 645 aniSearch-only-Einträge in `titles.json`/`ohne-synchro.json` haben kein Cover, 83 davon in `franchises.json` (von 504; Stand `5632fc777`). Keiner hat eines in vorhandenen Daten (`tmdb-poster.json` 0, MAL-Weg über `anisearch-eintraege.json` zu `anisearch-cover.json` 0; `cover-eigen.json` ohne Datei: nicht-gefunden 517, ohne-adresse 93, nsfw 6, nicht abgerufen 29). `data/cover-luecken.json` führt sie (Kennung → Grund). Wache `check-cover-luecken-bestand.ts` in `check:bestand`: Eintrag in Reihe oder Datenbank ohne Cover und ohne Listeneintrag, oder Listeneintrag mit Cover, gibt je eine Zeile `⚠ WARNUNG Cover` (Exit 0: neue aniSearch-only-Titel kommen täglich ohne Bild, Rot stoppte den Bestandsbau; rot nur bei fehlender oder kaputter Liste). Neue Lücke: Kennung eintragen; kommt ein Cover, Eintrag entfernen. Test `check-cover-luecken-wache.ts`. Panel-Kopf (`DetailPanel.tsx`, `buehnenBild`): eigenes Cover, sonst das des ersten Reihenteils mit Cover; Reihen- und Datenbank-Kachel haben keinen Rückfall.

- **Mehrteiler später:** Der Abruf speichert je Staffel `staffeln` (Nummer, Abo-Angebote mit `audio` und Adresse; `pipeline/lib/jw-staffeln.ts`). Eine Regel für Mehrteiler erst, wenn eine Messung wie im Bericht ≥ 98 % bei n ≥ 50 zeigt.
  - Die Staffeln kommen in derselben `popularTitles`-Anfrage mit (`... on Show { seasons { … } }`), kein Zusatzabruf. Stichprobe 11.10.2026 von Daniels IP: 3 Probeabrufe (Date a Live, Vinland Saga, Niko) und ein Lauf mit 15 Titeln, 0 Fehler; `robots.txt` von `apis.justwatch.com` erlaubt alles. Je Staffel stehen nur Abo-, Werbe- und Gratis-Angebote (Kauf und Leihe würden die Datei aufblähen); gut 100 Byte je Serie, bei Prime-Serien mit vielen Staffeln mehr.
  - Serien ohne `staffeln` (alle Befunde vor dem 11.10.2026) holt der Wochenlauf vor der 28-Tage-Frist nach (`vorgezogen()` in `fetch-justwatch-audio.ts`, 1.938 Serien, bei `--limit 800` rund drei Wochenläufe); Befunde hinter einem „Deutsch laut JustWatch"-Weg werden 21 Tage statt 28 alt erneuert, damit die Kennzeichnung zwischen zwei Läufen nicht ausläuft.

## aniSearch-API: keine Suche, aber die Titelliste trägt den Katalogabgleich (11.10.2026)

- **Es gibt keinen Suchendpunkt.** Der Suchraum ist `GET /v1/anime/titles` (21.367 Einträge am 11.10.2026: `year`, `main`, `ja`, `ja-kanji`, Sprachen, `synonyms`; **kein Format, keine MAL-Kennung**). Mit Token **1 Abruf je Stunde** (`x-ratelimit-limit: 1`, `window: 3600`); `fetch-anisearch-katalog-abgleich.ts` legt sie 24 h in `data/cache/anisearch-titelliste.json` ab. Format, Folgen und MAL kommen aus dem Einzelabruf (`/v1/anime/<Kennungen>`, zehn je Abruf, 5,5 s Pause).
- **Ergebnis (Lauf 11.10.2026, 3.165 AniList-Titel ohne aniSearch-Kennung: 3.161 Katalog + 4 Hauptbestand):** sicher 66, unsicher 242, keiner 2.857. Die Lücke ist also **kein Abruf-Rückstand**, sondern fehlt überwiegend bei aniSearch (ONA 1.081, Film 965, Special 384; Land CN 881, KR 77, TW 21): Jaccard-Gegenprobe über alle Wörter ab zwei Zeichen findet für die 2.292 „keiner" ohne Namensnachbarn nur 144 Treffer ab 0,6 — Folgen, Fortsetzungen und Fremdwerke gleichen Namens.
- **Regeln** (`lib/anisearch-katalog-abgleich.ts`, `check-anisearch-katalog-abgleich.ts`): sicher = dieselbe MAL-Kennung (bei mehreren Einträgen entscheiden Jahr, Format, Folgen) oder gleicher normalisierter Name + Jahr ±1 + verträgliches Format + keine widersprüchliche Folgenzahl/MAL + genau ein solcher Kandidat; alles mit Namensnähe sonst unsicher mit Grund; 582 „keiner" haben einen Namensnachbarn, der schon an einen anderen AniList-Titel gebunden ist (`vergebenAn`).
- Die Zuordnung steht in `data/anisearch-ids-katalog.json` (AniList-Kennung → aniSearch-Kennung, Form wie `anisearch-ids-hand.yaml`; eigene Datei statt der Handdatei, weil ein Lauf sie schreibt und die Handdatei nach `tools/quellen-liste.sh` nicht in der Lauf-Liste stehen darf).
- **Eingehängt (11.10.2026):** Der Bau liest die Datei (`lib/anisearch-katalog-ids.ts`) an den Stellen, an denen er Kennungen zuordnet: `bau/anisearch-kennung.ts` (Kennung des Titels, vor der Handdatei, nach dem Abruf-Ergebnis), `bau/anisearch-titel.ts` (`zuordnungen()`: die eigene aniSearch-Zeile derselben Kennung entfällt, wie bei der Brücke), `fetch-anisearch-dubs.ts` und `fetch-anisearch-slugs.ts`. Ein Lauf des Abgleichs **ergänzt** die Datei nur (einmal gebundene Titel fallen aus der Liste der offenen). Sie trägt 96 Paare: die 66 sicheren und 30 von Hand gesichtete (Sichtung 11.10.2026 an den 242 unsicheren: 30 eindeutig richtig, 194 eindeutig falsch, 18 unklar). Das gesichtete „kein Treffer" steht in `data/anisearch-katalog-kein-treffer.json` (AniList-Kennung → verworfene aniSearch-Kennungen, von Hand gepflegt; der Abgleich überspringt sie), die 18 unklaren auf `daniel-zum-abarbeiten/listen/katalog-abgleich-unklar.md`.
  - **Regel der Sichtung:** richtig, wenn der Name (Romaji, Englisch oder Native) gleich ist und Jahr und Format nichts anderes sagen; bei mehreren aniSearch-Einträgen mit derselben MAL-Kennung nur, wenn einer den Namen der Serie trägt und die übrigen ausdrücklich Fortsetzungen sind (Starzinger II, „(2018)", „(2019)"). **Falsch**, wenn der Kandidat ein Teil eines Mehrteilers ist, dessen Hauptfassung schon gebunden ist (Break Blade 2 bis 6 → „Break Blade", 6 Filme in einer Zeile), wenn mehrere Einzelfolgen-Einträge einen gebündelten AniList-Titel bilden (Specials, OVAs) oder wenn die Kennung zu den begründeten Teilen gehört (`MAL_AUSNAHMEN`: Reporter Blues 3873, Angel Beats 6864). Eine Zeile ohne Jahr bei aniSearch (Ankündigungen) zählt nur bei gleichem Namen in Romaji und Native.
  - **Messung (lokaler Bau mit gleichem Cache, Verlustriegel für die Messung abgeschaltet, 11.10.2026):** Vorher 14.750 AniList-Titel mit aniSearch-Kennung und 2.768 eigene aniSearch-Zeilen, nachher 14.839 und 2.681 (+89 / −87, der Rest sind Titel, die im lokalen Cache fehlen); Hauptbestand `titles.json` unverändert; „Kennung mehrfach" vorher wie nachher 62, also keine neue Dublette. Alle 89 betroffenen aniSearch-Einträge führen kein Deutsch (`-`). Mitgeändert durch die Kennung: Bewertung (34 Titel) und Reihe (23 Titel) aus aniSearch.
  - **Die 18 unklaren Paare (11.10.2026, Abend):** geklärt nach Starttag, Folgenlänge, Namensteil, MAL, Folgenzahl, Studio (AniList per GraphQL, aniSearch aus den vorhandenen API-Daten): **13 ja, 5 nein, 0 offen**. Ja: Teilungen Hoozuki OVA (3 + 1 Folgen), LINE Novel CMs (1 + 1), Fanren Xiu Xian Zhuan (8 + 9), je an den frühesten Teil gebunden; Maeumuisori (26 × 21 min = 78 × 7 min, gleicher Start- und Endtag), Annyeong Jaduya 2 (gleicher Start- und Endtag), Machikado-Collab, Benibara Shirobara, BOO, Kingdom Zoku-hen, Glass no Clair (3D), MAPPA 15th Anniversary Movie, Cosmos in the Lostbelt (Regeln unten); Fate/strange Fake Zoku-hen von Hand (beide die Fortsetzung desselben Vorgängers laut MAL-Brücke: AniList 166617 = aniSearch 18510). Nein (anderes Werk): Jashin-chan Mame Anime, Fushou Akiyama (M4 Sherman), Period of the Mouseman (andere MAL), Shinsengumi, Genki Genki Nontan (jeweils anderer Starttag und andere Länge). Begründung je Paar: `daniel-zum-abarbeiten/berichte/katalog-unklar-geklaert.md`.
  - **Neue Regeln** (`lib/anisearch-katalog-merkmale.ts`, Stand 11.10.2026): *sicher* bei genau einem Kandidaten mit gleichem Starttag + gleicher Länge (±1 min ab 10 min) + Namensteil (gleicher Name oder ≥ 10 gemeinsame normalisierte Zeichen), oder Starttag + gleicher Gesamtlaufzeit (Folgen × Länge), oder Start- und Endtag, oder gleicher Name + Länge + Folgenzahl bei fehlendem Jahr, oder gleicher Name bei beiderseits fehlendem Jahr (Platzhalter: über heute + 2). Andere MAL schließt aus. *Teilung*: mehrere aniSearch-Einträge mit derselben MAL, deren Folgen die AniList-Zahl ergeben → der früheste Teil bekommt die Kennung (die übrigen bleiben eigene Zeilen). *Widerlegt* (Urteil `widerlegt`, nicht auf der Prüfliste): andere MAL-Kennung oder anderer Starttag **und** andere Länge bei allen Kandidaten. AniList-Länge und -Endtag holt der Lauf nur für die unsicheren Titel (`lib/anilist-merkmale.ts`, Zwischenspeicher `data/cache/anilist-abgleich-merkmale.json`, eine Woche). Fehler vorher: ein erneuter Lauf überschrieb gesichtete Paare (1236: 84 → 1032), weil gebundene Titel als offen galten — behoben.
  - **Nachtrag Teilung (11.10.2026):** Fairy Tail OVA (AniList 9982, 5 Folgen) hat bei aniSearch fünf Einträge zu je einer Folge unter MAL 9982 (6666, 7079, 7695, 8291, 8811); vier standen als „kein Treffer" in `anisearch-katalog-kein-treffer.json`, der Lauf hätte nur 8811 gebunden. Verwerfung aufgehoben, gebunden ist der früheste Teil 6666. Die Teilungsregel verlangt jetzt je Teil dieselbe Formatfamilie wie der AniList-Titel und kein Erscheinungsjahr mehr als eins vor ihm (Staffel 12 + Film 1 = 13 ist keine Teilung). **Weitere verdeckte Teilungen in `kein-treffer.json`** (Folgensumme aller Einträge einer MAL = AniList-Zahl, gemessen 11.10.2026): 20 AniList-Titel, vollständig verworfen nach der Sichtungsregel „Einzelfolgen-Einträge eines gebündelten AniList-Titels sind falsch" (1998, 2306, 2520, 3245, 6674, 8197, 9062, 10083, 10178, 12921, 13767, 17879, 21138, 97891, 106498, 106499, 116968, 124756, 150078; 2458 zur Hälfte). Ohne die Verwerfungen würde die Regel 17 davon an den frühesten Teil binden; nicht angefasst, bis entschieden ist, ob die Sichtungsregel gilt.

## Bewertung, Schlagworte und Banner ohne AniList (11.10.2026)

Daniel (11.10.2026): Bewertung und Schlagworte kommen von aniSearch, der Banner von TMDB. Die Regeln stehen in `pipeline/bau/produkt-regel.ts` (`setzeProduktFelder` vor `baueMeta`, für den Katalog `bewertungNachRegel`/`mitProduktFeldern` in `nebendateien.ts`); `titleFromMedia` liefert keine Bewertung und keine Schlagworte mehr.

- **Bewertung:** der Klarwert der archivierten aniSearch-Seite (`data/anisearch-raw/`, `Klarwert<b>4.00 = 80%</b>`, `lib/anisearch-bewertung.ts`), 0 % = keine Bewertung; `score` bleibt eine Zahl bis 100, `scoreQuelle` fehlt = aniSearch (Cartoons: `tmdb`). Die Pille im Panel zeigt `aniSearch ★ 8.0`. **Mindestens 5 Stimmen** (`MIN_STIMMEN_BEWERTUNG` in `bau/produkt-regel.ts`, Dirigent 11.10.2026): ein Durchschnitt aus 1–4 Stimmen ist kein Beleg. Die Stimmenzahl ist die Summe der fünf Balken-Tooltips (`parseStimmen`); 3.075 von 14.456 Seiten mit Wert haben darunter (Messung 11.10.2026), im Bau fallen 68 von 2.850 bewerteten Titeln weg (2.850 → 2.782).
- **Schlagworte:** die Tags der Seite (`anime/genre/tag/<kennung>`), nur aus der festen Liste `shared/schlagworte.ts` (Zeit, Ort, Schauplatz, Sportart, Beruf, Stil; keine Charakterzüge, Wendungen, Wesen mit möglicher Enthüllung, Gewalt- und Erwachseneninhalte), deutsch, in Seitenreihenfolge, höchstens 12. Neue Tags nur nach Prüfung. `genres` (AniList-Genres plus Tag-Genres) bleiben, bis Schritt 5 der Ablösung die Genres umstellt; alte Filteradressen mit englischen Schlagworten (`kw=`) laufen leer.
- **Banner:** `data/tmdb-banner.json` (`lib/tmdb-banner-abruf.ts`, läuft im Plakat-Lauf `data:tmdb-poster`; Querformat ab 1280 px aus TMDB `/images`, ohne Schrift zuerst, 1.988 von 2.042 abgefragten Titeln); Adresse `image.tmdb.org/t/p/w1280…`. ÜBERGANG: wo TMDB keins hat, bleibt das AniList-Banner (`bannerNachRegel`), bis für die Lücken ein Ersatz gefunden ist; die Lückenliste ist `daniel-zum-abarbeiten/listen/luecken/banner.md` (`npm run data:lueckenlisten`, nicht im Repo; `datensatz.md`, Abschnitt „Lückenlisten“). Banner dienen der Link-Vorschau (`lib/titel-seite.ts`) und seit 12.10.2026 dem Panel-Kopf (`web/src/components/detail/buehne.tsx`, `kopf-bild.tsx`).
- **Prüfung:** `pipeline/check-anilist-produkt.ts` (Einheiten in `check:logic`; mit `--bestand` als `check:anilist-bestand` in `check:bestand`, direkt nach dem Bau): jede Bewertung ist der Klarwert der Seite des Titels, kein Schlagwort außerhalb der Liste, Banner nur TMDB aus der Bestandsdatei oder AniList nur dort, wo TMDB keins hat.
- **Noch offen:** `KatalogEintrag.score` und `averageScore` werden noch abgerufen, aber nicht mehr gelesen (fällt mit Schritt 7); `KEYWORD_DE` übersetzt nur noch die TMDB-Schlagworte der Cartoons.

## Eigene aniSearch-Cover: R2-Bucket, Domain, Pipeline (11.10.2026)

- **Regel im Bau** (`pipeline/lib/cover-quelle.ts`, `bau/cover-regel.ts`): TMDB-Plakat → AniList-Cover → eigene Kopie des aniSearch-Covers → keins. Die eigene Kopie ist `https://cover.anime-kalender.de/<datei>` mit `datei` aus `data/cover-eigen.json` (Titelkennung − 10.000.000 = aniSearch-Kennung). Einträge ohne `datei` (Platzhalter, 18+, keine Adresse, 404) bleiben ohne Cover und stehen weiter in `daniel-zum-abarbeiten/listen/cover-ohne-tmdb.md`. Stand 11.10.2026: von 2.634 Titeln ohne Cover bekommen 1.877 die eigene Kopie, 757 bleiben auf der Liste.
- **Eigener Bucket `anime-kalender-cover`, nicht ein Präfix in `anime-kalender-belege`:** Der Belege-Bucket ist privat (Screenshots, nur über den Worker, `r2.dev` aus, 02.10.2026). Öffentlicher Zugang gilt je Bucket, nicht je Präfix; ein Präfix würde die Belege mit öffnen oder die Covers hinter den Worker zwingen (Worker-Aufruf je Bild, kein Edge-Cache über die Domain).
- **Domain:** `cover.anime-kalender.de` als Custom Domain des Buckets (Edge-Cache von Cloudflare, kein Worker). `r2.dev` bleibt aus (gedrosselt, nicht für Produktion). Anlegen ist nach außen wirksam und läuft über den Dirigenten: `wrangler r2 bucket domain add anime-kalender-cover --domain cover.anime-kalender.de --zone-id <Zone von anime-kalender.de> --min-tls 1.2 -y`.
- **Hochladen:** `node tools/cover-nach-r2.mjs --lauf <Kennung des Datenlaufs data:anisearch-cover>` (lädt das Artefakt `cover-ausgabe-<Lauf>` per `gh`, prüft jede Datei gegen Pfad und Größe im Manifest, `wrangler r2 object put --remote`, acht gleichzeitig, drei Versuche je Datei, `--trocken` zählt nur). Das Artefakt enthält je Lauf nur die neu geholten Bilder; ein erneuter Lauf überschreibt mit denselben Bytes. Neue Cover folgen also so: Sammler-Lauf → Skript → nächster Bestandsbau setzt die Adresse. **Vor dem Merge des Baus muss hochgeladen und die Domain verbunden sein**, sonst zeigen die Karten kaputte Bilder.
- **Form und Cache** (Leitziel Mobile Performance): WebP, 300 px breit, Qualität 70, 1.877 Dateien, im Mittel 15,7 KB, höchstens 40 KB (Artefakt 29,7 MB). `Cache-Control: public, max-age=2592000` (30 Tage; der Name trägt die Kennung, nicht den Inhalt, deshalb kein `immutable`). `coverBild()` kennt den Host nicht und liefert nur `src` ohne `srcset`; die Oberfläche zeigt die 300 px auch bei 262 CSS-Pixeln Kartenbreite.
- **Offen:** Der Service Worker (`public/sw.js`, `isCoverHost`) cacht nur AniList-Bilder offline, TMDB und die eigene Domain nicht; eine Erweiterung wäre eine eigene Entscheidung (Speicherbedarf, siehe dort).

## TMDB-Zuordnung der Nur-AniList-Titel (Volllauf 11.10.2026)

Schritt 2 des Plans „eigene Stammdaten“ (`daniel-zum-abarbeiten/berichte/eigene-stammdaten-plan-2026-10-11.md`). `pipeline/fetch-tmdb-katalog.ts` (Regel in `pipeline/lib/tmdb-katalog.ts`, Prüfung `check-tmdb-katalog.ts`) ordnet die 2.856 Titel aus `keiner` in `data/anisearch-katalog-abgleich.json` (einer ohne Namen in `ohne-synchro.json`) TMDB zu: `data/tmdb-katalog-zuordnung.json`, AniList-Kennung → `{tmdbId, art, stufe, grund}`. **Noch nicht im Bau.**
- **Ergebnis (nach den Prüferbefunden, Neulauf 11.10.2026):** 1.025 sicher (36 %), 383 unsicher, 1.448 ohne Treffer. Nach Format sicher/unsicher/kein: MOVIE 628/148/186, ONA 222/150/707, SPECIAL 54/27/297, TV_SHORT 73/24/104, OVA 24/8/99, TV 24/24/49, ohne Format 0/2/6. Verlauf: erster Lauf 1.124/284/1.448; nach dem ersten Befund (lateinisches `native`) 1.090/318/1.448 (40 sicher→unsicher, 6 unsicher→sicher, an TMDB gegengeprüft: Kurzfilme, Animation, ja, Jahr stimmt); nach dem zweiten (Animation in beiden Zweigen, alle Namen suchen) 1.025/383/1.448 (65 sicher→unsicher: 53 ohne Animationsgenre, 9 Jahr weicht ab, 3 mehrere Werke). Probe: 37 % (28–47 %).
- **Regel (Probe, an Hand geeicht):** Jahr ±1 auf beiden Seiten, Art passt (MOVIE→movie, TV/TV_SHORT→tv, sonst beides) und **immer Genre Animation (16)**, dazu entweder Originalname in **nicht-lateinischer Schrift** gleich, oder lateinischer Name gleich (auch ein lateinisch geschriebenes `native`, das bei AniList meist nur das Romaji wiederholt) mit Originalsprache ja/zh/ko; genau ein Werk. Ohne Genre 16 höchstens unsicher (Moyashimon-OVA 9290 → Realdrama tv/44315, „the persona“ 175104 → taiwanisches Realdrama „Shelter“). Sonst unsicher (Grund steht im Eintrag) oder kein. Die einfache Regel Name+Jahr (`urteilTreffer`) lieferte Fehltreffer (Silence 2016, Gathering, Night Owl); sie sind in der Prüfung festgehalten.
- **Suche:** `/search/multi` mit jedem Namen (CN/KR: Originalname zuerst), immer alle Namen (ein Abbruch beim ersten sicheren Treffer ließ „genau ein Werk“ nur über die bis dahin gesuchten Namen gelten und übersah 3 Titel mit mehreren passenden Werken); 4 Anfragen je Sekunde, bei 429 Pause (Retry-After). Lauf 11.10.2026: 0 Fehler, kein 429, rund 40 Minuten; Wiederaufnahme: was in der Datei steht, wird nicht noch einmal gesucht.
- **Handprüfung und Prüferbefund:** Die 10 Stichproben des ersten Laufs waren alle stimmig, ließen aber den Fehler nicht erkennen: der Zweig „Originalname gleich“ galt auch, wenn `native` lateinisch war, dann reichten Name und Jahr, und Realfilme wurden sicher (Her → Jonzes Film 152601, NOISE, mine, MASTER, Vision, object, Destiny, FLOAT, INHERIT, espresso, Protector, Path of Progress; alle zwölf sind jetzt nicht mehr sicher, `check-tmdb-katalog.ts` hält sie fest). Lehre: Stichproben aus der sicheren Menge zeigen nur, dass die Treffer gut sind, nicht dass die Regel dicht ist; zusätzlich gezielt die Namen prüfen, die kurz und englisch sind. Zwei TMDB-Kennungen tragen zwei AniList-Titel (Marie & Gali Episode Zero/Special → tv/25395; Happy Father, Happy Son 1/2 → tv/211461): TMDB führt die Reihe als eine Serie, vor einer Übernahme je Titel entscheiden.
- **Unsichere Treffer:** Prüfliste `daniel-zum-abarbeiten/listen/tmdb-katalog-unsicher.md`. Nie automatisch binden.

### Abgleich der 383 Unsicheren von Hand (11.10.2026)

Alle 383 sind gegen AniList (Folgen, Laufzeit, Studio, Land, Jahr, Namen samt Synonymen) und TMDB (`/movie|tv/{id}` mit Genre, Land, Firmen, Laufzeit, Folgenzahl, Alternativtitel, Schlagwörter; je Kandidat, 724 Kennungen, ≤ 4 Anfragen je Sekunde, 0 Fehler) abgeglichen, nicht Daniel vorgelegt. aniSearch wurde nicht angefasst. **Zählung vorher → nachher:** 1.025 sicher / 383 unsicher / 1.448 ohne Treffer → **1.187 / 66 / 1.603**; von den 383: **162 bestätigt, 155 verworfen, 66 offen** (Format der 383: ONA 83/37/30, MOVIE 47/85/16, TV 15/4/5, TV_SHORT 7/10/7, SPECIAL 6/15/6, OVA 2/4/2, ohne 2/0/0).
- **Form (kein neues Dateiformat):** der Eintrag in `data/tmdb-katalog-zuordnung.json` bekommt `von: "hand"`. Bestätigt: `stufe: "sicher"`, gewählte Kennung, `grund` „von Hand bestätigt: …“ mit den gemessenen Werten und `beleg: {tmdb, genres, jahr: [AniList, TMDB], name, ausnahme?}` (`tmdb` = Kennung des Werks, dessen Merkmale es sind; die Prüfung vergleicht sie mit dem Eintrag). Verworfen: `stufe: "kein"`, ohne Kennung, `grund` „von Hand verworfen: tv/902 (Jahr 2000 statt 2002, 224 statt 1 Folgen)“. Offen: bleibt `unsicher`, `grund` „von Hand geprüft, offen: … passt in …, aber …“. `fetch-tmdb-katalog.ts` sucht Einträge der Datei nicht neu; die Datei darf nicht gelöscht werden, sonst gehen die Handurteile verloren.
- **Pflichtmerkmale (`lib/tmdb-katalog-hand.ts`, geprüft in `check-tmdb-katalog.ts`):** Kennung und Art, Name gleich, Genre Animation (16) und Jahr ±1 (beide Seiten bekannt); jede Abweichung steht als benannte Ausnahme im Beleg, sonst schlägt die Prüfung an; eine TMDB-Kennung hängt nur an einem bestätigten Titel. Realfilme sind damit ausgeschlossen: kein Genre 16 heißt entweder verworfen/offen oder eine der Ausnahmen, die im Grund steht.
- **Ausnahmen bei den 162 (Anzahl):** `genre-leer` 42 (TMDB führt gar kein Genre; dann Name, Jahr, Land und Laufzeit oder Folgenzahl gleich, meist 1–40-Minuten-Kurzfilme), `schlagwort` 7 (TMDB-Schlagwort anime/animation/puppet/donghua bei fremdem Genre, z. B. Kamen-Rider-Saber-Kurzfilme), `genre-studio` 1, `jahr-fehlt` 61 (42 mit gleichem Studio; 19 ohne, dort Originalschrift-Name ab 4 Zeichen, Animation und Land, z. B. chinesische Ankündigungen), `jahr-kurzfilm` 6 (Kurzfilm, 2–3 Jahre daneben, Originalname und Laufzeit gleich), `jahr-folgen-lauf` 2, `jahr-studio` 1, `folgen-luecke` 1 (TMDB nennt erst 20 von 80 Folgen), `land-abweichend` 20 (davon 11 lateinisch benannte Kurzfilme ohne Studio, deren Land bei AniList nur der Standard „JP“ sein dürfte, darunter die miHoYo-Kurzfilme, die TMDB als US führt).
- **Verworfen (155):** hauptsächlich Jahr 5–60 Jahre daneben oder Laufzeit/Folgen/Art widersprechen (Realfilm, Serie statt Kurzfilm, gleicher Name in anderem Land); Specials, die TMDB nur als Folge oder Staffel der Mutterserie führt (Yu-Gi-Oh! Battle City Special → tv/902, Gunbuster Renewal EX → tv/66931, Hipira-kun Special → tv/85910), sind bewusst verworfen: das Special hat bei TMDB kein eigenes Werk.
- **Offen (66):** 13 Genre ohne Animation bei sonst passendem Name, Jahr und Laufzeit/Folgenzahl (Kinder/Familie/Drama, z. B. Hong-Mao-Lan-Tu 虹猫蓝兔猫眼看宇宙, Pili-Puppenserien 金光御九界, McDull; ohne Animationsbeleg nicht bestätigt), 15 Jahr 2–30 Jahre daneben bei sonst passendem Titel, 10 Genre bei TMDB leer ohne weiteren Anker (keine Laufzeit, Folgenzahl oder Studio zum Gegenprüfen), 15 ohne Jahr bei kurzem Namen und ohne Studio, 9 mit Teilwiderspruch bei Land, Laufzeit oder Art, 1 Folgenzahl, 3 doppelte TMDB-Einträge ohne Unterscheidung. Doppelte, die sich über Laufzeit, Folgenzahl, Studio oder Jahr entscheiden ließen, sind entschieden (104067, 116997, 129464, 131727, 199417, 127988, 211217).
- **Lehren:** (1) TMDB führt dasselbe Werk oft doppelt, die Wahl braucht Laufzeit, Folgenzahl oder Firma als Tiebreaker. (2) AniList-Land ist bei Kurzfilmen aus MAL nur „JP“ als Standard und kein Gegenbeleg. (3) Namen müssen in Englisch abgeglichen werden: mit `language=de-DE` waren die TMDB-Titel übersetzt und etliche Treffer sahen wie Namensabweichungen aus. (4) Der Katalogabgleich in `main` hat inzwischen 3.043 statt 2.856 Titel; die 187 neuen sind noch nicht zugeordnet (Probelauf: 44 sicher / 26 unsicher / 117 kein) und nicht Teil dieses Abgleichs.

## Prime-Pille ohne Adresse: Crunchyroll-Kanal, Uhrzeit, Suchlink (11.10.2026)

Anlass (Daniel, 20:32): „Reborn as a Space Mercenary" (AniList 186541) zeigte „Prime Video · 1 Fg. · seit 04.10.2026" **ohne Link**, Crunchyroll daneben „2 Fg.". Daniel fand die Seite bei Amazon selbst (`B0HKFFGQ7F`): **Prime stimmt**, es ist der Crunchyroll-Kanal.

- **Herkunft von „primevideo":** Anime2You-Artikel 1057488 („Crunchyroll: Reborn as a Space Mercenary … und mehr", Crunchyrolls Wochenliste) führt jeden Titel mit „Stream: Prime Video, Crunchyroll"; für diesen steht „Sprache: Deutsch, Japanisch (UT)" und „Simulcast: Jeden Sonntag um 16:00 Uhr". `sammelAnbieter` nimmt beide Anbieter, `anbieterDerMeldung` den ersten (Prime), CR hatte der Simulcast-Kalender schon. Die Zuordnung war richtig, nur ohne `kanal` — die Pille hieß und zählte wie ein Prime-eigener Titel.
- **Behebung (Pipeline):** Nennt ein Sammelartikel-Eintrag „Prime Video" **und** „Crunchyroll", ist Prime der Crunchyroll-Kanal (`kanalDesEintrags`, `lib/sammelartikel.ts`); der Kanal der Überschrift (Aniverse) geht vor. Dazu übernimmt der Prime-Kanal-Termin Folgenzahl (samt „angenommen"/Herkunft) und Uhrzeit vom Crunchyroll-Termin desselben Titels mit gleichem Starttag (`mitPlanDesKanalAnbieters`, `lib/meldungen.ts`; der Starttag bleibt der der Meldung). Ursache der Zahl „1 Fg.": Ein Wochentermin ohne Folgenzahl erzeugt in `expandEvents` genau eine Folge (AniList kannte noch keine Gesamtzahl), und ohne Uhrzeit zählt die heutige Folge erst ab 23:59 (`istErschienen`) — Crunchyroll hat 12 Folgen und 16:00. Messung (Vorschläge aus den gespeicherten Sammelartikeln, `releasesAus` vorher/nachher): automatische Prime-Termine ohne Kanal 2 → 1 (der übrige ist ein Artikel nur über Prime Video), Termine mit Crunchyroll-Kanal 0 → 1, Pille von „1 Fg." auf „2 Fg.". Kanal-Wege im Bestand (`titles.json`, 11.10.2026): 274, davon 105 Crunchyroll; mit abweichender Zahl gegenüber Crunchyroll (ohne das „≈"-Zeichen) 2, beide gewollt (Golden Wind ohne Urteil, Lupin III Part 6 mit 25 belegten Folgen).
- **Warum der Prime-Abgleich die Seite nie gesucht hat:** `data/prime-suche.json` entsteht aus Prime-**Wegen** ohne Titelseite und aus TMDB-Vorschlägen (`tools/extension-offene-amazon.mjs`). Der Titel hatte nur einen Prime-**Termin**, und `ergaenzeWegeAusTerminen` legt einen Weg nur für sichere (nicht `estimated`) Termine an; dieser war „Ab sofort"-Meldetag. Kein Weg, kein Auftrag, kein Link.
- **Adresse:** `data/verweise-von-hand.yaml` kennt jetzt das Feld `kanal` (`lib/verweise-von-hand.ts`); der Eintrag für 186541 trägt `B0HKFFGQ7F` und den Kanal Crunchyroll. Damit steht ein Prime-Weg im Datensatz, die Erweiterung bekommt ihn als Prüfauftrag (Sprachurteil), und die Stream-Pille führt zur Seite. **Die Termin-Pille** (steht, solange noch nichts erschienen ist, und bei Anbietern ohne Weg) las nur `buyUrl`/`platformUrl` des Termins; seit `bau/13-1-termin-adressen.ts` (`adresseDesWegs`) nimmt ein Termin ohne Adresse die des Weges desselben Titels: gleicher Anbieter, bei gesetztem Kanal gleicher Kanal, eine Titelseite statt einer Suche, genau ein solcher Weg (sonst keine Übernahme, das Panel führt zur Suche). Bestand 11.10.2026: 29 Termine ohne Adresse (ohne Disc/Kino/TV), 12 bekommen ein Ziel (Netflix 7, Disney+ 3, Prime 1, ADN 1), 0 mehrdeutig; der Rest (Prime 12, ADN 2, Disney+ 1) hat keinen Weg.
- **Handverweise, die im Bestand fehlen (Prüferbefund 11.10.2026):** 35 Prime-Handverweise, 5 nicht als Weg im Bestand. 186541 (noch nicht gebaut); Haikyu!! 3rd Season (21698) und Fairy Tail (6702): Die Linkprüfung meldete „region", und der Befund ist jünger als `belegtAm` (`handSticht` in `bau/09-2-linkpruefung.ts` lässt nur eine jüngere Handprüfung gewinnen, 21698: 10.09. gegen 21.09., 6702: 22.09. gegen 28.09.); A Silent Voice (20954): „belegtes Nein" in `data/verweise-entfernt.json`; Your Name (21519) steht unter der Adresse `watch.amazon.de/detail?gti=…` im Bestand (anderer Adresskern). Eine eigene Ursache, nicht der Mechanismus dieses PR. **Für Reborn heißt das:** Meldet eine künftige Linkprüfung „region" mit Datum ab dem 11.10.2026, fällt der Weg wieder heraus, bis `belegtAm` aktualisiert wird.
- **Pille ohne Adresse (Panel):** Eine Prime-Termin-Pille ohne `platformUrl` führt auf die Prime-Suche (`pillenZiel`, `components/detail/pillen-ziel.ts`), Tooltip „Öffnet die Suche bei Prime Video – eine Direktadresse fehlt noch". Andere Anbieter ohne Adresse bleiben ohne Ziel. Bestand 11.10.2026 (`releases.json`, Termine ohne `platformUrl`/`buyUrl`, ohne Disc/Kino/TV, Titel ohne Weg des Anbieters mit Adresse): Prime 9, ADN 2, Disney+ 1 — also 12 Pillen ohne Link, davon 9 Prime (8 Aniverse, 1 dieser Fall).
- **Test:** `pipeline/check-prime-pille.ts` (Kanal, Folgenzahl und Uhrzeit vom Crunchyroll-Termin, Zählung 15:59/16:00, Suchlink, Handverweis).
- **Prime-Adressen kürzen (Nachtrag 11.10.2026, Daniel 20:57):** `amazonAdresseRichten` (`lib/amazon-adresse.ts`, Aufruf in `bau/13-1-anreichern.ts` für Prime-Wege, Stream-Bezugswege und Termine) streicht jetzt Abfrage, `ref` und Fragment hinter der Kennung; der Pfad bleibt. Bestand 11.10.2026 (`public/data`): 1.576 Prime-Adressen, davon 1 mit Abfrage (`…/gp/video/detail/amzn1.dv.gti.…?linkId=…&language=de_DE`) → 0. Formen im Bestand (Wege, Bezugswege, Termine, Kaufwege zusammen): `gp/video/detail/<ASIN10>` 1.365, `gp/video/detail/<GTI26>` 28, `…/amzn1.dv.gti.…` 4, `dp/<ASIN10>` 28 (Kaufwege, 12 davon mit `?th=1&psc=1`), `watch.amazon.de/detail?gti=` 48 (die Abfrage ist dort die Kennung, bleibt), Suchen 303. **Die ASIN bleibt unter `/gp/video/detail/`, nicht `/dp/`:** Die Stichprobe vom 20.09.2026 (siehe oben) fand 7 von 15 `/dp/`-Adressen mit 404 gegen 15 von 15 unter `/gp/video/detail/`; Daniels Einzeltest (eine ASIN, `/dp/` funktioniert) widerlegt das nicht; zweite Stichprobe 11.10.2026, 21:08 (15 zufällige ASINs aus `titles.json`, einzeln abgerufen): `/gp/video/detail/` 15 von 15 lebt, `/dp/` 3 von 15 mit 404 „Seite wurde nicht gefunden" (B0FTTR1XB9 Demon Slayer, B0CK7HLF2F Dragon Ball Z Resurrection F, B0CH88PCPB Space Dandy). Ändern nur nach einer neuen Stichprobe von mindestens 15 ASINs.

## aniSearch-Marke „Geplant“ überstimmt den deutschen Block (11.10.2026)

Anlass (Daniel, 11.10.2026, 22:27): „Reincarnated as a Dragon Hatchling“ (AniList 187941, aniSearch 20293) zeigte „Auf Deutsch seit 10.01.2026 · Animation Digital Network (DE)“ und bei ADN „✓ Deutsch“. ADN hat bis heute nur Untertitel (ADN-Schnittstelle, Serie 1347: 12 von 12 Folgen `vostde`, keine `vde`); die Synchro startet laut ADN-News (01.08.2026) und Anime2You-Lineup (Termin 22.10.2026).

**Regel (Daniel, wörtlich: „bei geplant (noch nicht veröffentlicht, auch wenn anisearch es falsch sagt)“):** Führt aniSearch Deutsch als „Geplant“ (Lautsprecher-Marke `dubbed-3`, in `data/anisearch-dubs.json` als `p`), gilt die deutsche Fassung als noch nicht veröffentlicht. Status, Datum, „Abgeschlossen“ und Publisher des deutschen Blocks werden überstimmt. Allein die Marke entscheidet; „Synchronisiert“ (`dubbed-1`) heißt fertig.

- **Ursache a (`dub: true`):** `bau/09-1-belege.ts` macht jeden Verweis zu `dub: true`, wenn der Titel ein Release auf demselben Anbieter hat. Das Release war der ADN-Termin vom 22.10. (Anime2You, automatisch), also der Start der Synchro, nicht ihr Beleg von heute. Das Archiv (`beurteileAdnVerweis`) hätte `dub: false` gesagt, kam aber nie dran, weil `dub` schon gesetzt war. Behebung: `terminBelegtNichts` zählt einen kommenden Termin bei Marke „Geplant“ nicht (wie bisher den geschätzten). Danach urteilt das ADN-Archiv, der Verweis fällt als belegtes Nein weg (28 Tage Gedächtnis, `data/verweise-entfernt.json`). Annahme, nach dem 22.10.2026 nachzumessen: Mit der ersten Folge mit `vde` legt `bau/07-adn.ts` den Verweis aus dem ADN-Kalender neu an.
- **Ursache b (`dubConfidence: high`):** `lib/belegstaerke.ts` zählt einen Verweis mit `dub: true` als starke Quelle; mit a fällt b weg (`low`).
- **Ursache c (`deErstausgabe`):** `lib/anisearch-termine.ts` las Datum und Publisher des deutschen Blocks ungeprüft. Bei „Geplant“ wiederholt der Block oft den Japan-Zeitraum des Simulcasts mit Untertiteln. Gemessen an `data/anisearch-raw` (Stand 11.10.2026): 44 deutsche Blöcke tragen „Geplant“ (2.713 „Synchronisiert“, 61 `dubbed-4`, 7.242 ohne Marke); 35 davon mit Tagesdatum, bei 27 liegt dessen Beginn höchstens einen Tag neben dem Japan-Beginn (20 identisch), bei 21 steht „Abgeschlossen“ samt Datum. Behebung: `mitDubKennzeichen` liefert bei `p` keinen Termin, die aniSearch-eigenen Titel (`bau/anisearch-titel.ts`) tragen bei `p` keine `deErstausgabe`.
- **Umfang (Bauvergleich 11.10.2026, Basis aa082f5bf):** 28 Titel ändern sich, bei allen entfällt `deErstausgabe` (19 mit Tagesdatum, 9 nur Publisher oder Jahr; 6 davon reine aniSearch-Titel). Nur Dragon Hatchling verliert zusätzlich `dub: true`, den ADN-Verweis und `dubConfidence: high`. Bei den übrigen Titeln mit Marke `p` stützte sich kein `dub: true` allein auf einen künftigen Termin; Handbelege (Hell Mode, There's No Freaking Way) bleiben. Streams mit `dub: true` und ausschließlich künftigem Termin gab es sonst nur bei YOUR FORMA (Bereiche belegt), Cyberpunk: Edgerunners 2 und Fool Night (Netflix-Eigenproduktionen, Marke nicht `p`, bleiben).
- **Prüfung:** Invariante D-24 (`lib/invarianten-geplant.ts`, Aufruf in `bau/auslieferung-pruefen.ts`, Gegenprobe `check-invarianten.ts`): Marke `p` ohne Handbeleg darf weder `deErstausgabe` aus dem aniSearch-Block (ohne `synchro`/`quelle`) noch einen Verweis mit `dub: true` bei nur künftigem Termin tragen; bricht den Bau ab. Gegen den alten Bestand (`--bestand`): 25 Verstöße.
- **Ankündigung:** `data/ankuendigungen.yaml` führt 187941 als `synchro: angekuendigt` (ADN, Untertitel seit 10.01.2026); der Starttermin 22.10. steht als ADN-Release.
- **Offen für die Oberfläche** (nicht angefasst, Panel-Umbau läuft): `deErstausgabe` heißt „erste deutsche Veröffentlichung“, nicht Synchro; „Auf Deutsch seit“ in `antwort-kasten.tsx` (`deSeitZeile`) liest es ohne `synchro`-Marke. Vorschlag: nur mit `deErstausgabe.synchro` oder `quelle` als „Auf Deutsch seit“ formulieren, sonst „Deutsche Veröffentlichung (Untertitel oder Synchro) seit …“.

### Eine Marke, drei Dateien (11.10.2026, Nachtrag zu D-24)

Der Prüfer fand: `anisearch-dubs.json` zählt 36 Titel mit `p`, `anisearch-eintraege.json` 8, und Psyren, Hotaru no Yomeiri, Shuiro no Kamen und Hyouken II standen nur in der zweiten. **Kein Widerspruch, sondern verschiedene Abdeckung:** Alle drei Dateien stammen aus derselben aniSearch-Antwort und tragen dieselbe Marke (Eintragsdatei gegen Dub-Liste: 8.274 von 8.274 gleich; Auszug je Titel gegen Dub-Liste über die Brücke: 8.117 von 8.117 gleich).

- `anisearch-dub-ids.json` (aniSearch-Kennung → Marke, alle Einträge mit Deutsch) ist die Wahrheit.
- `anisearch-dubs.json` (Titel-Kennung → Marke) ist der Auszug für die Titel, die beim Abruf eine aniSearch-Kennung hatten, und kennt als einziger das `-`. Er ist älter als die Brücke (`anisearch.json`, Katalogabgleich, Handdatei): neun Titel fehlten am 11.10.2026 (vier mit `p`: Psyren, Hyouken II, The Vermilion Mask, Firefly Wedding; fünf mit `d`: BeyWheelz, Rick and Morty: The Anime, Spycies, The Lord of the Rings: The War of the Rohirrim, Titipo Titipo 2).
- `anisearch-eintraege.json` trägt die Marke je aniSearch-Kennung am Eintrag (`dub`); sie gilt für die Titel, die nur bei aniSearch stehen.

**Ein Leser:** `lib/anisearch-marke.ts` (`deutschMarke`, `dubsNachTitel`, `dubIdsNachAnisearch`); die Brücke steht in `anisearchBruecke()` (`lib/anisearch-katalog-ids.ts`), auch der Abruf nutzt sie. Wer die Marke eines Titels braucht, geht nicht mehr an die Dateien. Gegenproben: `pipeline/check-bild-und-synchro.ts` (die drei Dateien laufen nicht auseinander). Folge: Der nächste Abruf (`fetch.ts`, `ausAnisearchDubs`) holt die sieben Titel mit `d`/`p`, die noch hinter dem Toggle stehen (Annahme, nach dem Abruf nachzumessen).

## TMDB-Zuordnung verlangt das Genre Animation (21.10.2026)

Anlass: „Kakegurui" (AniList 98314) und „Kakegurui ××" (100876) trugen TMDB 76409, die **Realserie** von 2018 (Anime: 72305, 2017); das Jahr passte (±1), das Genre wurde nie geprüft. `pipeline/lib/tmdb-titel-treffer.ts` (`waehleBesten`) verwirft jetzt Treffer, deren `genre_ids` nicht leer sind und 16 (Animation) nicht enthalten (`keineAnimation`, `lib/tmdb-genre.ts`); eine leere oder fehlende Genreliste gilt als nicht widerlegt. `genreIds` stehen je Zuordnung in `data/tmdb-titles.json`. Bestandsprüfung `pipeline/check-tmdb-genre.ts` (in `check:logic`): keine Zuordnung mit bekanntem Genre ohne Animation, außer von Hand (`data/tmdb-von-hand.yaml`). Nachtrag 25.10.2026: Ein Eintrag mit Kennung, aber ohne `genreIds` (Detailabruf gescheitert oder Bestand von vor 1758; 12 von 2.097 am 25.10.) wird im Lauf `data:tmdb` wie ein Fehlschlag wiedervorgelegt (7 statt 150 Tage, `genreFehlt`, `lib/tmdb-faellig.ts`).

Bestand am 21.10.2026 (`npm run data:tmdb-genre` auf Abruf, CI-Lauf 39538680410): 2092 von 2100 Zuordnungen gelesen, 8 ohne Antwort (TMDB 404, Kennung gelöscht), 14 ohne Animation. Davon vier echte Anime, die TMDB ohne Genre Animation führt (Toradora SOS, .hack//Quantum, Gundam Requiem for Vengeance, One Piece Log Fischmenschen-Insel; sie stehen jetzt in `tmdb-von-hand.yaml`), zwei, die TMDB doppelt führt (Taro, Mirai Nikki: die Suche findet jetzt den Anime-Eintrag), acht falsche Treffer (Realserien, Dokus, Reality). **Echte Anime ohne Genre 16 gehören in `tmdb-von-hand.yaml`**, nicht in eine Ausnahmeliste der Prüfung.

## TMDB-Staffel 0: Specials und OVAs über die Serie ihrer Reihe (14.10.2026)

Anlass: 858 Titel des Hauptbestands ohne TMDB-Kennung (Lückenliste 14.10.2026: Banner fehlt bei 924, Cover HQ bei 945). Bei TMDB stehen Specials und OVAs oft nicht als eigenes Werk, sondern als Folge der **Staffel 0** der Hauptserie (Beispiel „Durarara!! World at Peace“ = `tv/42410` Staffel 0 Folge 2). Die Serie selbst darf der Titel nicht erben (`lib/tmdb-hauptserie.ts`: Anbieter, FSK, Handlung wären fremd); zugeordnet wird **genau eine Folge**, und nur ihre Bilder gehören dem Titel.

- **Wo:** `lib/tmdb-staffel0.ts` (Regel, rein), `tmdb-staffel0-kandidaten.ts` (welche Titel), `tmdb-staffel0-abruf.ts` (Abruf, im Plakat-Lauf `fetch-tmdb-poster.ts` nach den Staffelplakaten, vor `holeBanner`), `tmdb-staffel0-liste.ts` (Prüfliste `daniel-zum-abarbeiten/listen/tmdb-staffel0-unsicher.md`), Prüfung `check-tmdb-staffel0.ts`. Bestand `data/tmdb-staffel0.json`: Titelkennung → `{tmdbId, e, tage, laenge, name, min?, inhaltAm, pp?, sp?}`, die gemessenen Merkmale stehen im Eintrag, `check-tmdb-staffel0.ts` rechnet „sicher“ daraus nach. Keine Zeile in `tmdb-titles.json`: der Titel bleibt ohne Serienkennung, bekommt also weder Anbieter noch FSK noch Handlung der Serie.
- **Kandidaten:** Titel ohne eigene TMDB-Kennung, nicht TV/TV_SHORT, mit japanischem Start (`franchises.json`), in einer Reihe, deren anderer Titel eine TMDB-Serie trägt (439 von 858; die übrigen: 330 TV-Titel, 89 Specials in Reihen ohne TMDB-Serie).
- **Regel (sicher):** Datum der Folge höchstens ±1 Tag neben unserem Start, Name der Folge (englisch oder japanisch, `language=ja-JP`) gleich einem unserer Namen, Länge gleich (Abstand ≤ 2 min oder 15 %; fehlt eine Länge, gilt es nur bei gleichem Tag) und der einzige solche Treffer in der Staffel 0 aller Serien der Reihe. Allgemeine TMDB-Namen („Special“, „OVA“, „Episode 1“) zählen nicht als Name. Mehrere Folgen: die folgenden stehen aufeinanderfolgend in der Staffel 0. Eine Folge gehört höchstens einem Titel (`mehrfachBelegt`).
- **Messung (439 Kandidaten, ein Abruf je Serie, 308 Serien, 215 mit Staffel 0):** 150 sicher (A 8, B 142; SPECIAL 76, OVA 65, ONA 9, MOVIE 0), 114 unsicher, 175 kein. Ohne die Namensbedingung wären 62 weitere „sicher“ gewesen (Datum gleich, Länge ≤ 1 min, nur der Name übersetzt, z. B. Slime OAD, Attack-on-Titan-OVA); sie stehen auf der Prüfliste und warten auf Freigabe. Gegenproben von Hand: 30 von 30 stimmig (8 A, 8 ohne englischen Namensgleich, 14 riskante: Länge fehlt, Datum ±1, mehrere Folgen), bei den meisten gleicht der japanische Folgenname von TMDB unserem `titleNative`, sonst Datum, Länge und Folgenzahl.
- **Bilder:** Plakat = Plakat der **Staffel 0** (`/tv/{id}/season/0/images`, Hochformat, `waehlePlakat`), Hintergrund = Standbild der Folge (`/tv/{id}/season/0/episode/{e}/images`, Querformat ab 1.280 px, `waehleBanner`). Gemessen: 144 von 150 mit Plakat (118 ab 690 px; davon bleiben nach der Entscheidung unten 121 bzw. 97), 125 mit Hintergrund (88 mit 1920 px). Von 100 Serien führt Staffel 0 bei 93 eigene Plakate, die nicht unter den Serienplakaten stehen; es zeigt aber meist das Key Visual der Serie (Clannad), nicht des OVA. Das Cover eines Specials wird damit das Serienbild in hoher Auflösung statt seines eigenen AniList-Covers (`cover-quelle.ts`: TMDB-Plakat zuerst). **Entscheidung (Dirigent, 14.10.2026):** Das Plakat der Staffel 0 ersetzt nur das AniList-Cover und füllt fehlende; eine eigene aniSearch-Kopie (`eigeneKopie` in `cover-quelle.ts`, nur Titel ab 10.000.000 mit `datei` in `cover-eigen.json`) bleibt, weil sie das Bild des Titels selbst zeigt statt des Serienbildes (23 der 144 Plakate entfielen, 121 blieben). Der Hintergrund (Standbild der Folge) bleibt für alle 125. Die 62 Titel mit nur übersetztem Namen bleiben vorerst auf der Prüfliste. Ein fremdes Bild im Bestand (Namenssuche) bleibt, nur eigene Bilder (`pp`, `sp`) werden überschrieben oder gestrichen.
- **Frist:** Eintrag und Bilder gelten 150 Tage (`inhaltAm`, `staffel0Faellig`); danach wird das Urteil gegen TMDB neu gefällt und die Bilder neu geholt, ein nicht mehr tragendes Urteil streicht Eintrag und Bilder. `check-tmdb-ablauf-bestand.ts` prüft die Datei mit. `check-tmdb-hauptserie.ts` erlaubt ein Hintergrundbild jetzt auch ohne Kennung in `tmdb-titles.json`, wenn der Titel in `tmdb-staffel0.json` steht.
- **Wirkung (Lückenlisten `npm run data:lueckenlisten`, Bestand vom 14.10.2026, nach der Entscheidung zur eigenen Kopie):** Banner fehlt 924 → 799 (A 146 → 138, B 778 → 661; vorher und nachher gemessen). Cover HQ fehlt 945 → 848 (A 117 → 109, B 828 → 739; nachher gerechnet aus den 97 neuen `cg` des Bauvergleichs, der Bestand ist noch nicht neu gebaut). Im Bauvergleich (Ersatz-Cache, Basis gegen Kandidat) ändern sich nur 121 `coverImage` (119 vorher AniList, 2 ohne; die 86 eigenen aniSearch-Kopien bleiben), 125 `bannerImage` (57 vorher ohne, 68 vorher AniList-Übergang) und 97 `cg`. Vor der Entscheidung waren es 144 Plakate und 118 `cg` (HQ fehlt 827).
- **Kosten:** je Wochenlauf zwei Abrufe je Serie mit offenen Kandidaten (rund 215 Serien, etwa 1 Minute bei 120 ms Pause) plus Bilder der neu zugeordneten Titel. Der Bestand `tmdb-folgen.json` (875 Einträge) reichte nicht: er führt Staffel 0 nur für Titel mit Kennung.
- **Fallstrick:** Git Bash schreibt Argumente, die mit `/` beginnen (TMDB-Bildpfade), in Windows-Pfade um; für Messskripte `MSYS_NO_PATHCONV=1` setzen.

## TMDB-API-Bedingungen: Zwischenspeicher höchstens 6 Monate, keine Derivate (12.10.2026)

**Quelle.** `https://www.themoviedb.org/api-terms-of-use` (identisch mit `/documentation/api/terms-of-use`). Die Seite selbst liegt hinter einer Cloudflare-Abfrage (Abruf per `fetch` am 12.10.2026: 403, „Just a moment…"); gelesen ist die Archivfassung von web.archive.org vom **17.09.2026**, die Seite trägt „This Agreement was last updated on: October 20, 2023." Wortlaut aus Abschnitt 1.C „Restrictions" („In addition, You must not:"):

> Cache, for longer than 6 months, any information obtained through or from TMDB …
>
> Make derivatives of the TMDB APIs or TMDB Content.

Dazu für uns wichtig (sinngemäß, 1.C): kein Verkauf, keine Unterlizenz und keine Einnahmen aus TMDB-Inhalten ohne schriftlichen Vertrag; keine Nutzung in einer ML/KI-Anwendung, auch nicht zum Training. Abschnitt 3 verlangt das TMDB-Logo und einen Hinweissatz, dass die Seite TMDB nutzt, aber nicht von TMDB unterstützt oder zertifiziert ist.

**Was wir von TMDB speichern, und wie alt es werden darf (Bestand 12.10.2026).**

| Datei | Inhalt | Abrufdatum | Erneuerung | Alter |
|---|---|---|---|---|
| `data/tmdb-titles.json` (2.997) | Zuordnung, deutsche Handlung (`overviewDe`, 1.922), Name, FSK, Anbieter | `fetchedAt` | nach 60 Tagen (Fehltreffer nach 7) | höchstens 51 Tage |
| `data/tmdb-folgen.json` (875) | Folgentitel, Daten | `geholtAm` | nach 30 Tagen | höchstens 45 Tage |
| `data/cartoons.json` (921) | Beschreibung, Anbieter, Bilder | `geholtAm` | nach 21 Tagen, nur für Kennungen, die `discover` noch liefert | höchstens 30 Tage |
| `data/cartoon-folgen.json` (150) | Folgentitel | `geholtAm` | nach 30 Tagen | heute geholt |
| `data/tmdb-kino.json` | Kinostarts als Vorschläge | `geholtAm` | jeder Lauf überschreibt | heute |
| `data/tmdb-poster.json` (3.885, davon 2.341 mit Plakat), `data/tmdb-banner.json` (2.094, davon 2.028 mit Bild) | Bildpfad, Breite, Höhe (auch `null` = „keins") | `inhaltAm` (seit 13.10.2026, siehe unten) | fehlende Einträge und Einträge über 150 Tage; `--alle` holt alle | höchstens 6 Tage (seit 07.10. bzw. 11.10.2026) |
| `data/tmdb-katalog-zuordnung.json`, `data/tmdb-poster-grund.json`, `data/tmdb-von-hand.yaml` | unser Urteil (Kennung, Stufe, Grund) | – | von Hand/Prüfung | eigene Zuordnung |
| `data/tmdb.json` (239, davon 143 mit FSK/Anbietern; Altbestand aus `fetch.ts`) | FSK, Anbieter je Produkt | `inhaltAm` (seit 13.10.2026) | nach 150 Tagen (`fetch.ts`, Schritt 4) | höchstens 67 Tage (frühester Eintrag 07.08.2026) |

`public/data/synopses/*.json` trägt `overviewDe` unverändert mit Quelle `themoviedb.org` und wird aus `tmdb-titles.json` neu gebaut (`bau/13-2-auslieferung.ts`, einziger Leser); es altert also nicht schneller als der Bestand.

**Befund: eine Lücke im Ablauf von `tmdb-titles.json`.** Ein Fehltreffer mit vorhandener Kennung (`miss && vorher.tmdbId`) schrieb nur `fetchedAt` neu und ließ Handlung und Anbieter stehen: der Inhalt wirkte frisch, war es nicht. Bei dauerhaftem Fehltreffer hätte er die 6 Monate überschritten, ohne dass ein Datum es verrät. **Jetzt:** `inhaltAm` hält fest, wann der Inhalt zuletzt von TMDB kam; `lib/tmdb-ablauf.ts` streicht am Ende jedes Laufs Handlung, Name, FSK, Anbieter und Anbieterseite jedes Eintrags, dessen Inhalt älter als **150 Tage** ist (Frist 180, die 30 Tage sind Reserve für einen ausgefallenen Wochenlauf). Die Zuordnung (`tmdbId`, `kind`, `jahr`) bleibt: sie ist unser Urteil, welches Werk gemeint ist, und hängt an JustWatch, Trailern und Folgenlisten. `check:logic` hält das fest (`check-tmdb-ablauf.ts`), `check:bestand-liste` meldet jeden Eintrag mit Abrufdatum über 180 Tagen (`check-tmdb-ablauf-bestand.ts`).

**Plakate, Hintergrundbilder und `data/tmdb.json` tragen seit 13.10.2026 ein Abrufdatum** (`inhaltAm`, `YYYY-MM-DD`, im Eintrag neben `p`/`w`/`h` bzw. FSK/Anbietern). Die Leser prüfen `?.p` und brauchen nichts Neues; `null` („TMDB hat keins") bleibt `null`, trägt also kein Datum und wird nur mit `--alle` neu gefragt (es ist keine zwischengespeicherte Information, sondern das Fehlen einer).
- **Altbestand** (Datum fehlte): `tools/tmdb-bilddatum.mjs` setzt den Tag, an dem der Eintrag **zuerst im Git steht** (erster Commit mit demselben Wert): Plakate 2.007 × 07.10., 262 × 11.10., 72 × 12.10.; Hintergründe 1.949 × 11.10., 79 × 12.10.; `tmdb.json` 143 Einträge zwischen 07.08. und 13.10.2026. Das ist die vorsichtige Seite: geholt wurde spätestens an diesem Tag, ein späterer Lauf mit gleichem Ergebnis ändert den Wert nicht, der Eintrag gilt dann als älter als er ist und wird früher erneuert. (Die Vorgabe „letzte Änderung der Datei im Git" hätte `tmdb.json` auf 13.10. gesetzt, obwohl die ältesten Einträge vom 07.08. stammen.) `tools/tmdb-bilddatum-bestand.mjs` rechnet nach, dass kein Datum nach dem Commit liegt, der den Eintrag zuerst enthält (`check:bestand-liste`).
- **Erneuerung** (`bilderAbzufragen`, `lib/tmdb-ablauf.ts`): Der Plakat-Lauf (`fetch-tmdb-poster.ts`, Wochenlauf) und `holeBanner` fragen zusätzlich zu den fehlenden Einträgen jene über **150 Tage** neu ab, die ältesten zuerst, **höchstens 800 je Lauf und Art** (`ERNEUERN_JE_LAUF`). Der Altbestand läuft fast gleichzeitig ab (frühestens 07.03.2027, Frist 05.04.2027, vier Wochenläufe dazwischen): 800 je Lauf schaffen 2.341 Plakate in drei Läufen, ein ausgefallener Lauf ist eingerechnet; `check-tmdb-ablauf.ts` spielt den Wochentakt mit Altbestandsverteilung durch (rot bei 400 je Lauf: Alter 185). Zeit: Probe am 13.10.2026, 3 Plakate in 0,9 s, 3 Hintergründe in 0,4 s, also 800 Abfragen in rund 2–4 Minuten je Art. **Titel ohne Eintrag** (neu oder nach der Frist gestrichen): höchstens 400 je Lauf und Art (`NEU_JE_LAUF`, der `--limit` des Wochenlaufs), vor den Erneuerungen; zusammen also höchstens 1.200 Abfragen. Ohne Deckel hätte ein Lauf ohne `--limit` nach 30 Tagen TMDB-Störung rund 2.300 Plakate und 2.000 Hintergründe angefragt (Stand 13.10.2026: 0 Titel ohne Eintrag bei 2.094 abfragbaren); `--alle` von Hand bleibt unbegrenzt. Die Titel ohne Eintrag kommen in der Reihenfolge von `tmdb-titles.json`, nicht nach Neuheit: Nach einer Störung mit n solchen Titeln wartet ein echter Neuzugang bis zu ceil(n/400) Läufe (bis dahin steht das AniList-Cover). Ein Handstart von `daten-auf-abruf.yml` mit einer Grenze über 400 wird für Titel ohne Eintrag ebenfalls auf 400 gekappt. Eine Kennung, die TMDB nicht mehr kennt (404), wird `null`. Plakate **ohne Zuordnung in `tmdb-titles.json`** (287: Namenssuche der Filme und Serien, Staffelplakate, Katalogsuche; ihr Abrufweg ist nicht gespeichert) werden nach 150 Tagen aus dem Bestand genommen und von denselben Suchwegen im nächsten Bau/Lauf neu gefunden (bis dahin steht das AniList-Cover). Zwischensicherung alle 200 Abrufe (gezählt, nicht an der Bestandsgröße: bei der Erneuerung bleibt sie gleich). Scheitert die Erneuerung, nimmt der Lauf Bilder über 180 Tage aus dem Bestand (`streicheBilderUeberFrist`, der Titel gilt dann als neu) und streicht bei `tmdb.json` den Inhalt (Datum und Zuordnung bleiben, der Eintrag wird wieder geholt); `check:bestand-liste` meldet jeden Eintrag über 180 Tage.
- **`data/tmdb.json`:** `fetch.ts` (Schritt 4) holt Einträge mit FSK/Anbietern nach 150 Tagen neu; schlägt die Suche fehl, bleibt der alte Eintrag stehen (nächster Lauf versucht es wieder, der Bestandscheck schlägt vor Tag 180 an). Einträge ohne Inhalt (`{}` oder nur `tmdbId`) bleiben wie bisher unangetastet.

**Offen (nicht gebaut):**
- **Eine Anfrage für beide Bilder:** Plakat und Hintergrund holen dieselbe `/images`-Antwort (zwei getrennte Abrufe je Titel); bei der Erneuerung ließe sich die Hälfte sparen. Nicht umgebaut (Umfang).
- **Cartoons:** Einträge, die `discover` nicht mehr liefert, werden nie erneuert (`fetch-cartoons.ts`, Fällig-Liste ist die Kandidatenliste); heute alle unter 31 Tagen, der Bestandscheck fängt sie ab dem 181. Tag.
- **Derivate:** `overviewDe` wird unverändert (nur `trim`) ausgeliefert; Folgentitel gehen in eine Rangfolge der Quellen ein (`bau/folgentitel-*.ts`), geändert wird nichts. Zuordnungsurteile (Stufe, Grund) und die Cartoon-Reihen sind eigene Arbeit, aber aus TMDB-Namen abgeleitet: Auslegungsfrage, nicht angefasst.
- **Kommerzielle Nutzung** (Abschnitt 2): die Seite ist nichtkommerziell und werbefrei (`CLAUDE.md`); der Punkt „destination website … for driving traffic" ist ein Grenzfall, den die Bedingungen mit „in TMDB's sole discretion" belegen. Hier nur vermerkt.

## Reihen rein aus aniSearch hinter `REIHEN_QUELLE=anisearch` (12.10.2026)

Schritt 6 der AniList-Ablösung, **nur Messung, nicht umgeschaltet**. `pipeline/bau/anisearch-reihen-rein.ts` (rein) und `anisearch-reihen-rein-bau.ts` (Anbindung) bilden die Reihen des Hauptbestands und des Katalogs allein aus den aniSearch-Beziehungen der Archivseiten; ohne den Schalter bleibt der Weg wie am 11.10. (AniList-Relationen als Basis, aniSearch hängt Alleinstehende an), die Ausgabe ist byte-gleich (`tools/bau-vergleich.mjs`). Eintrittspunkte: `fuehreReihenZusammenQuelle` (Hauptbestand, `build.ts`) und `anisearchKatalogReihenQuelle` (Katalog, `nebendateien.ts`). Mit Schalter schreibt der Bau `data/anisearch-reihen-rein-pruefliste.json` (Arten `verschmilzt`, `universum`) statt der Standard-Prüfliste. Regeln (Kopfkommentar im Modul, Test `pipeline/check-anisearch-reihen-rein.ts`): Kernarten und gleiche Kennung zuerst; danach „?" und die Sammelarten (Anderes, Charakter, Crossover mit Namensanfang wie `REGEL`) — beide hängen Alleinstehende an, verbinden aber nie zwei Reihen mit mehreren Titeln; „Gemeinsames Universum" nie; eine MAL-Kennung mit mehr als 8 aniSearch-Titeln ist eine Sammelseite (28149: 27 Kurzfilme) und verbindet nicht; `reihen-von-hand.yaml` (`ids:`, `getrennt:`) gilt unverändert. Seiten ohne eigenen Titel verbinden mit (wie bei AniList jeder Nachbar). Zahlen, Regelvarianten und zehn Stichproben: `daniel-zum-abarbeiten/berichte/reihen-anisearch-schalter-2026-10-12.md` (Hauptbestand 84,1 % gleiche Reihen, Haupt+Katalog mit Seite 72,8 %; 14,8 % der Titel haben keine aniSearch-Seite). Kern-Brücke (12.10.2026, Fall 9): ein Titel, dessen Haupthandlungen (`Hauptgeschichte`, `Komplette Geschichte`, Gegenseite `Nebengeschichte`, `Zusammenfassung`) in zwei Reihen mit mehreren Titeln liegen, verbindet sie nicht, hängt an der Reihe mit der kleinsten Kennung und steht als `mehrdeutig` auf der Prüfliste (5 Fälle in Bestand und Katalog: Magical Emi/Persia/Creamy Mami, Minky Momo vs Creamy Mami, Precure Miracle Leap, Cinderella Girls Gekijou, Onegai Teacher/Twins). Die Lücken in aniSearchs Relationen (Macross, Detektiv-Conan-Specials, Pocket Monsters) schließen `ids:`-Einträge in `reihen-von-hand.yaml`. Offen: frischer Katalog-Cache für die Messung.

**Schritt 7 (12.10.2026, Bericht `reihen-abstand-2026-10-12.md`):** Hauptbestand mit Schalter **89,6 %** gleiche Reihen (vorher 86,3 %), Haupt+Katalog mit Seite 77,7 % (73,5 %; Katalog-Cache vom 03.09.). (1) Ursache der zwei Fehlzuordnungen: aniSearch trägt bei frisch angelegten Einträgen manchmal die MAL-Kennung des Nachbareintrags (21603 Dr. Slump = 21602 Xian Di Guilai, 21619 = 21617, 21605 = 21604, 21648 = 21647; 78 MAL-Gruppen mit mehreren Einträgen enthalten 14 Paare ohne Namensanfang und ohne Beziehung); die gleiche MAL band Titel an fremde Reihen. Eine MAL-Kennung nur aus aniSearchs Eintrag (`malAnisearch`) verbindet jetzt nur mit Namensanfang oder Beziehung; die eigene (AniList) gilt wie bisher. Wirkung: 54 Titel in 6 Reihen, 1 im Hauptbestand (Dr. Slump). (2) 97 `reinIds:`-Einträge in `reihen-von-hand.yaml` (wie `ids:`, aber nur im reinen Weg gelesen, damit der Standardweg unverändert bleibt) für die Klassen A–D im Hauptbestand; draußen blieben Crossover und eigene Werke im selben Universum (Higurashi/Umineko, Riding Bean/Gunsmith Cats, Megalo Box, Grendizer, Nisekoimonogatari, Starship Troopers OVA, Ponkotsuland Saga) und drei Fälle ohne Beleg. Pure-aniSearch-Titel (Id ab 10.000.000), die in `ohne-synchro.json` stehen, laufen im Hauptlauf mit: ihre Kennung gehört in den Eintrag, sonst bleiben sie dort allein. Klasse I (Gundam, Precure, Conan, One Piece, Fate, Doraemon) unberührt, Entscheidung offen.

**Schritt 8 (12.10.2026): Hauptbestand umgeschaltet, Katalog nicht.** *(Die Aussage zum Katalog, der beim AniList-Weg bleibe, bis die 3.049 Titel ohne Kennung zugeordnet sind, ist abgelöst durch Schritt 9 am 13.10.2026: der Katalog läuft rein aus aniSearch.)* Daniel entschied am 12.10. um 17:43: Riesen-Franchises je Handlungsstrang (Gundam SEED/00/UC je eine Reihe, jede Precure-Staffel eine). `bestandReihenAusAnisearch()` ist an, außer bei `REIHEN_QUELLE=anilist` (Rückweg); `katalogReihenAusAnisearch()` bleibt aus (Katalog nur mit `REIHEN_QUELLE=anisearch`), bis die 3.049 Titel ohne aniSearch-Kennung zugeordnet sind. Wirkung im Hauptbestand (Bau auf Bestand `dec17337a`, 2.920 gemeinsame Titel): 304 Titel in 30 Clustern ändern ihre Reihe (89,6 % gleich); Reihen mit mindestens 2 Titeln 492 mit 1.924 Titeln, danach 498 mit 1.917. Der Katalog bleibt beim AniList-Weg und hängt seine Titel an die Bestandsreihe mit der kleinsten Kennung der verbundenen Gruppe: bei Gundam liegen alle Katalogtitel (126) in der Reihe von Gundam Wing, SEED, 00, Hathaway und GQuuuuuuX haben nur ihre Bestandsteile. **Regel „?“/Sammelart zwischen zwei Mehrtitel-Reihen, wenn die kleinere nur Film/Special/OVA/ONA enthält: gemessen, nicht eingebaut.** Hauptbestand, 2.917 Titel mit Seite, Referenz die ausgelieferten Reihen: heute 2.627 gleich (90,1 %); „?“ allein 0 Treffer (24 gelockerte Kanten, 1 Verschmelzung); „?“ + Anderes/Charakter/Crossover (mit Namensbedingung) 2.648 (+21), davon 1 Treffer (Ghost in the Shell: 3 Tachikoma-Specials, +21 Titel gleich) und 1 Fehlgriff (Lupin III vs Detektiv Conan landet je nach Kantenreihenfolge bei Lupin statt bei Conan); zusätzlich „Gemeinsames Universum“ (Namensanfang 5): Fehlgriff Tales of Symphonia ↔ Vesperia; ohne Namensbedingung: dazu Bleach ↔ Burn the Witch. Von 20 Referenzreihen, die der reine Weg im Hauptbestand zerlegt, haben 11 kleinere Teile nur aus Film/Special/OVA/ONA, aber nur 1 hängt über eine zählende Kante (Charakter mit Namensanfang) an; die übrigen tragen Crossover (3), Universum (1), nur „Anderes“ ohne Namensanfang (1) oder gar keine Kante (5). Grendizer: die Crossover-Filme hängen an zwei Reihen mit Serie, die Regel greift nicht (bleibt getrennt); Summer Ghost: einzelner Film mit nur einer Universum-Kante, keine Mehrtitel-Reihe. Die Katalog-Messung (Haupt + Katalog, 204 Cluster) wurde nicht gemacht: der Katalog bleibt beim alten Weg; sie gehört zu Schritt 0. Einzeln weiter von Hand: GITS Tachikoma, Girls und Panzer Saishuushou 5, Angel Beats! Tokubetsu-hen, Black Jack OVA/Film, Hokuto no Ken (2026), B: The Beginning/The Perfect World (Fehltrennungen im neuen Weg, siehe PR).

**Schritt 9 (13.10.2026): Katalog-Reihen rein aus aniSearch.** `katalogReihenAusAnisearch()` ist an (Rückweg wie beim Hauptbestand `REIHEN_QUELLE=anilist`). Die 3.044 Katalogtitel ohne aniSearch-Kennung brauchen kein Matching: ihre AniList-Kanten gehen als `zusatz` (Titel-Paare, `anilistKantenOhneKennung`) in `reineReihen` und verbinden erst nach allen aniSearch-Kanten; zwei feste Reihen und `getrennt:` sperren sie, ein Crossover (zwei Eltern) verbindet weiter nichts. Vorher bestimmten 10.463 Katalogtitel mit 18.182 AniList-Kanten die Reihen, jetzt 2.821 Kanten an 2.298 Titeln. Messung auf Katalog-Cache 03.09. (17.882 Einträge) mit den ausgelieferten Hauptbestandsreihen als Anker, 15.125 Katalogtitel: gleiche Reihe wie der AniList-Weg 12.550 (83,0 %); mit Kennung 9.761 von 12.099 (80,7 %), ohne Kennung 2.789 von 3.026 (92,2 %). Ohne `zusatz` wären es 68,4 % (ohne Kennung 57,6 %: 1.273 Titel stünden allein, die heute in einer Reihe sind). Abweichungen: 272 Cluster mit 2.186 Titeln zerlegt (Gundam 137 Titel in 36 Teile = die Entscheidung vom 12.10., Anpanman 73 in 2, Lupin III 62 in 3), 115 Cluster mit 282 Titeln verschmolzen (Macross, Gintama-Specials, Time Bokan), 30 gemischt (Conan, Doraemon, Precure); Reihen mit mindestens 2 Titeln 2.604 auf 2.684. Kein Titel geht verloren (17.882 Zuordnungen vorher und nachher). Bauvergleich mit echtem Katalog-Cache (`BAU_VERGLEICH_KATALOG=<Pfad>` in `tools/bau-vergleich.mjs`, legt dieselbe Datei in beide Bauten): Umbau-Commit `3922bd830` gleich zu `959f470b5`; Verhaltens-Commit `91fafb397`: `titles.json` ohne `tr` unverändert, `reihen.json` gleich, `ohne-synchro.json` 17.610 Titel vorher und nachher, 79,9 % der Katalogtitel mit gleicher Reihenmenge (3.535 ändern sie), 365 Titel wechseln von einer Mehrtitel-Reihe zu allein, 254 umgekehrt, `franchises.json` 904 auf 908 Reihen (5.027 auf 4.798 Titel). **Befund `titleDe`:** der deutsche Name aus den Synonymen hängt am Reihennamen (`deutschAusSynonymen`); 44 Katalogtitel verlieren ihn (Black Jack Specials „The 4 Miracles of Life", Digimon X-Evolution, Digimon Savers THE MOVIE „Digimon Movie 01 - Season 05": englisch, nicht deutsch), 5 bekommen einen (Gundam SEED Destiny „Episode 51", Detektiv Conan OVA 1), 2 wechseln. `tr` (Sortierplatz nach Anzeigename) verschiebt sich dadurch in allen drei Dateien. Skripte: Scratchpad `anilist-rest-katalog/`.

## Avatar: Die sieben Häfen — Artikel, Rhythmus, warum der Sammler es nicht brachte (12.10.2026)

- **Was die Artikel belegen** (alle Anime2You, 12.10.2026 gelesen): 1034331 (24.07.) Start 9. Oktober 2026 bei Paramount+ „unter anderem auf Deutsch und Englisch“, 26 Folgen in zwei Büchern; 1048545 (10.09., deutscher Synchro-Trailer) Start „mit drei Episoden in deutscher und englischer Sprachfassung“, 4–6 am 16.10., 7–9 am 23.10., 10–13 am 30.10.; 1059426 (09.10.) die ersten drei Folgen mit deutscher Synchronisation und englischem Original mit Untertiteln, dieselben Blöcke; 1059483 (10.10.) „bis zum 30. Oktober 2026 folgen wöchentlich jeweils drei bis vier weitere Episoden der 13-teiligen ersten Staffel“. Ausdrücklich „deutsch“ sind die Folgen 1–3 (1059426) und die Serie insgesamt (1034331); für 4–13 sagt kein Artikel die Sprache einzeln. Die Paramount+-Seite (`paramountplus.com/de/shows/avatar-seven-havens/`) antwortet Abrufen ohne Browser mit 500, die Pressemitteilung nicht gefunden: nur Anime2You als Quelle.
- **Eintrag:** `streaming-herbst-2026.yaml` trägt jetzt alle vier Artikel in `sources` und den Handbeleg `rhythmus` (Meldung am 10.10., siehe news-plan.md). Der Handbeleg zur Synchro (`dub-confirmed.yaml`, Daniel 11.10.) bleibt unverändert.
- **Warum der Sammler es nicht selbst brachte:** (1) Der alte Sammler (`scrape-anime2you.ts`) hatte den Trailer-Artikel 1048545 am 10.09. als Vorschlag („Oktober 2026“, `dub: ja`, keine Plattform), aber Paramount+ war bis zum 10.10. keine Plattform im Datenmodell; der Vorschlag blieb unter den nie eingearbeiteten liegen. 1034331 (24.07.) fehlt dort ganz. (2) Die Extraktion (P2) überging Artikel, die schon in `sources` stehen (`eingearbeiteteAdressen()`): 1059426 und 1059483 kamen von Hand (#708) und wurden nie gelesen; und sie kannte keine Art „Rhythmus“. **Behoben 12.10.2026 (#966):** `neueKandidaten` fragt nur noch nach `gelesen` (schon extrahiert, nicht schon zitiert), die Art `rhythmus` steht in Anleitung und `anime2you-vorschlag.ts`; beide Avatar-Artikel stehen seit 11.10. in `gelesen`. **Gemessen 13.10.2026 (`main` 6664f40):** 104 Anime2You-Artikel stehen in Handdateien und `curated`, 14 davon sind extrahiert, 90 nicht. Diese 90 sind fast alle älter als der Gesamt-Feed reicht (zwei Seiten, 50 Artikel, rund 5 Tage; Auswahl-Untergrenze `gelesen` ab Id 1056508): auch 1034331 und 1048545 von Avatar. Sie kommen nie als Kandidat; nur Artikel im Feed werden nachgeholt (8 mit Id ab 1056000 warten auf die Lesegrenze von 20 je Lauf). Wollte man die alten nachlesen, bräuchte es eine Liste der Kennungen und einen Abruf je Seite (Kosten: eine Modellfrage je Artikel); bisher nicht beauftragt.

## Deutsche Handlung aus dem aniSearch-Seitenarchiv (12.10.2026)

Titel, die `data/anisearch.json` nicht führt (84 reine aniSearch-Titel, Id ab 10.000.000, und 28 AniList-Titel), bekamen bisher keinen aniSearch-Text, obwohl die Seite in `data/anisearch-raw/<Kennung>.html.gz` liegt. `pipeline/lib/anisearch-archiv-text.ts` (`archivTexte`) liest ihn dort, `extractDescription` (`pipeline/lib/anisearch-handlung.ts`) ist dieselbe Funktion wie im Abruf; Quellenangabe wie bei den übrigen aniSearch-Texten (`deSource`, `anisearch.de`). **Rang:** `anisearch.json`, dann TMDB, zuletzt Archiv. **Geteilte Seiten** (zwei oder mehr Titel des Bestands auf derselben Kennung) liefern keinen Text: 28 Titel auf 16 Seiten (Film 1–3 auf einer Seite, Serie und ihr Special, Sammelfilm), keiner davon belegbar eindeutig (Seitentyp und Folgenzahl passen nie zu genau einem Titel); Liste mit Grund: `daniel-zum-abarbeiten/listen/handlung-geteilte-seiten.md`. Wirkung: Titel mit deutscher Handlung 2.674 auf 2.758 (Bestand vom 12.10.2026; `tools/bau-vergleich.mjs` ändert nur `synopses/`, die Lückenliste und die Patch Notes). Offen: die 28 (eigene Seiten per `anisearch-ids-hand.yaml` oder andere Quelle) und die übrigen Lücken ohne Archivtext.

## Anime2You-Extraktion: erste Runde Handeinträge aus den Vorschlägen (12.10.2026)

Anlass: Die Vorschläge in `data/proposals/anime2you-extraktion.json` (Stand 12.10.2026: 73 Vorschläge aus 27 von 39 gelesenen Artikeln) wurden bis dahin von niemandem zu Einträgen gemacht. Der Entwurf (`anime2you-entwurf.ts`) hält davon nur 1 für „neu“ (die Jujutsu-Disc, eine Dublette) und 70 für „nicht belastbar“, weil die Sammelartikel „ab sofort“ ohne Tag melden.

- **Nach Art:** 35 `start`, 21 `ankuendigung`, 7 `disc`, 6 `folgen`, 3 `sprachfassung`, 1 `pause`. Nach Sprache: 30 `omu`, 28 `unklar`, 10 `deutsch+omu`, 5 `deutsch`.
- **Gegen den Bestand (von Hand an `titles.json`, `releases.json`, `ankuendigungen.yaml`, `dub-confirmed.yaml` gelesen):** 36 haben Termin, Weg oder Ankündigung schon (z. B. YAIBA, One Piece 780–877, Cyberpunk Edgerunners 2, Rooster Fighter, Witch Hat Atelier, die TV-Guide-Folgen, Firefly Wedding und Iceblade Sorcerer als „Synchro angekündigt“); 10 Vorschläge sind übernommen; 17 Ankündigungen ohne Monat (The Boxer, EAT-MAN, Teenage Mercenary, The Remarried Empress, Berserk of Gluttony 2, Magical Buffs u. a.) kennt `ankuendigungen.yaml` nicht (`omuAb` ist Pflicht); 10 weitere sind Wiederholungen, Untertitel-Starts ohne Bestandswirkung, Pause oder ohne Tag.
- **Übernommen:** Demon Slayer Entertainment District / Hashira Training / Mugen Train / Swordsmith Village bei Prime Video (`streaming-herbst-2026.yaml`, vier Termine „im Angebot seit 10.10.“, `available-from`; Ton `sprache: offen`, kein Handbeleg: der Block sagt „Sprache: Deutsch, Japanisch (UT)“, nennt aber keine Synchro ausdrücklich; ein `dubZitat` scheitert an der Wortprüfung, ein `dub: true` wäre eine ungemessene Behauptung — Prüfer-Befund PR 1017, 12.10.2026); Dragon Ball Super: Beerus bei Netflix ab 18.10. (`sprache: omu`, Quelle nennt nur OmU); Kaiju No. 8 Staffel 2 Disc auf 05.03.2027 statt 04.12.2026 korrigiert (neuere Meldung, Staffel 1 daneben mit Hersteller und Ausgabe); My Hero Academia: Vigilantes bei Netflix als `omu` gekennzeichnet (der Termin stand ohne Hinweis im Kalender); SSS-Class Revival Hunter (Januar 2027) und Everyone’s Darling Has a Secret (April 2027) in `ankuendigungen.yaml`.
- **Offen:** Ein `dub: false` für Vigilantes bei Netflix (Weg entfernen) macht `check:handbelege` rot, bis ein Datenlauf den Weg entfernt hat; deshalb erst nach dem nächsten Bestandsbau. Naruto Shippuden Staffel 3 bei Disney+: der Bestand führt 52 Folgen, Anime2You 1060002 nennt 54.
- **Vorschlag für Sammelartikel (nicht gebaut):** (1) Die Titelblöcke (`»Titel«`, `Episoden:`, `Sprache:`, `Stream:`) sind regelmäßig genug für einen Parser ohne Modell; `lib/sammelartikel.ts` liest sie schon (`sammel` in `anime2you.json`). Die Extraktion könnte sie daraus übernehmen und Claude nur für Fließtext fragen. (2) Ein Block mit „ab sofort“ bekommt den Artikeltag als „im Angebot seit“ (`available-from`) statt `datum: null`; das ist die Lücke, an der 34 Vorschläge als „kein Tag“ endeten. (3) Die Zuordnung zu AniList über Name **und Folgenzahl des Blocks** (`Episoden: 11 (komplett)`): Die vier Demon-Slayer-Abschnitte (11, 8, 7, 11) sind so eindeutig, der Name allein („Entertainment District Arc“ gegen „Kimetsu no Yaiba Entertainment District Arc“) fand keinen. Bleibt es mehrdeutig, wandert der Block mit den Kandidaten in `nicht-zugeordnet.json` (18 Einträge am 12.10.2026). (4) „Sprache: Deutsch, …“ im Block zählt als ausdrückliche Aussage für den Entwurf; dann reicht ein kuratierter Termin mit `dub: true` und `dubZitat` statt eines Handbelegs.

## Ein belegtes Nein kommt wieder zur Prüfung (13.10.2026)

Anlass: „Snowball Earth“ — ein Handbeleg „keine Synchro“ (`data/dub-confirmed.yaml`) nimmt den Verweis aus dem Datensatz, und jede Prüfung geht von den Verweisen aus (Crunchyroll-Dub-Abruf, Prüflisten der Erweiterung, `tools/verdacht.mjs`). Ohne Verweis fragte nichts mehr nach; kam die Synchro später, blieb das Nein dauerhaft stehen. Die Wiedervorlage `pipeline/wiedervorlage.ts` (180 Tage, 14 bei laufender Synchro) greift nur bei vorhandenem Verweis und deshalb hier nicht.

- **Regel** (`shared/nein-wiedervorlage.ts`): Ein Nein (`dub: false` oder `available: false`; ein jüngeres Ja hebt es auf, ein Teil-Nein mit `dub: true` zählt nicht) ist fällig nach `NEIN_FRIST_TAGE = 28` Tagen seit `checkedAt` **oder sofort**, wenn der Kalender nach dem Messdatum einen erschienenen, nicht geschätzten, nicht ausgebliebenen Termin desselben Anbieters für den Titel führt — die „(Deutsch)“-Kachel; die Kachel selbst (alle Anbieter eines Titels an einem Tag) baut `web/src/lib/anbieter-kachel.ts` (`vereineAnbieter`), die Wiedervorlage liest dieselben Termine aus `releases.json` (`expandEvents`). Wiedervorlage heißt neu messen, nie löschen: Der Beleg bleibt gültig, bis eine Meldung ihn widerlegt oder bestätigt.
- **Wege zurück:** Der Crunchyroll-Dub-Abruf nimmt die Adressen aus `data/verweise-entfernt.json` wieder auf und setzt Kachel-Serien als „neu seit“ (`crunchyrollNeinAbruf`, `pipeline/lib/crunchyroll-adressen.ts`; seine Frist bleibt `--alter`). Netflix, Prime und Disney+: `tools/pruef-bestand.mjs` führt den Weg mit `dub: false` und der Adresse aus Beleg oder Gedächtnis der entfernten Verweise zurück in die Liste; `tools/verdacht.mjs` (sechste Quelle, `neinFaelleJeTitel`) schreibt den Hinweis „Das „nein“ vom … ist … Tage alt — bitte erneut melden“.
- **Reihenfolge der Disney+-Liste:** Wiedervorlagen stehen vorn (`verdachtRang`), die laufende Synchro zuerst („Though I Am an Inept Villainess“, Messung 02.10.: Folge 1–9 deutsch, 10–11 nein), dann das älteste Nein.
- **Stand 13.10.2026:** 455 Nein fällig (Netflix 207, Prime 162, YouTube 40, Crunchyroll 32, Disney+ 10, ADN 2, RTL+ 2); zwei davon wegen einer Kachel (Spy × Family bei Disney+, ein Prime-Titel; Snowball Earth bei Crunchyroll hat nur geschätzte Termine, also keine Kachel). Der Crunchyroll-Dub-Abruf führt dadurch 1.065 statt 508 Adressen je 28 Tage (≈ 266 je Woche, Deckel des Wochenlaufs 300); der einmalige Rückstand von 553 fälligen Adressen baut sich in 2–3 Wochen ab (6,7 s je Serie, gemessen 21.08.2026; ein Crunchyroll-Rate-Limit mit Zahl ist nicht bekannt). Auf die Listen der Erweiterung kamen dadurch Netflix +12, Prime +71 Einträge. Zusicherungen: `pipeline/check-nein-wiedervorlage.ts`, `pipeline/check-nein-liste-bestand.ts` (`check:logic` bzw. `check:bestand`, weil es das Dateilayout `public/data` nachbaut).

## Nein-Handbeleg neben einem Ja: Entfernen vorsichtig, Neuanlegen streng (14.10.2026)

- **Regel:** Steht neben einem Nein (`dub: false` oder `available: false`) ein Ja derselben Plattform und desselben Titels (`dub: true` oder ein deutscher Bereich in `dubRanges`), ist der Fall uneindeutig. `check:handbelege` prüft ihn nicht, und `entferneBezugswegeTrotzNein` löscht nichts.
- **Neuanlegen je Adresse (seit 14.10.2026, Fix `fix/nein-je-adresse`):** `neinHandbelege` (`lib/dub-confirmed.ts`) wertet Nein und Ja je Adresse (`adressKern`) aus, die Runden fragen mit `wegVerneint(menge, id, plattform, url)`. Ein Ja hebt nur das Nein derselben, ausdrücklich genannten Adresse auf; ohne Adresse ist „dieselbe Ausgabe“ nicht belegt, das Nein bleibt (Kuroko's Basketball 3, 20725, Netflix). Ein Nein ohne Adresse oder ohne ein Ja an einer zweiten, ausdrücklich genannten Adresse sperrt die ganze Plattform, weil eine neue Adresse dieselbe Ausgabe in anderer Schreibweise sein kann (JustWatch-gti statt ASIN); ein Ja ohne Adresse zählt dafür nicht (Overgeared 212888 bei Crunchyroll: Nein an crunchyroll.com, Ja ohne `url`). Erst eine belegte zweite Ausgabe beschränkt es auf seine eigene Adresse (Digimon 552 bei Prime: B0CGRJGJX1 ja, Crunchyroll-Kanal B0CHHNJJW3 nein).
- **Gemessen (14.10.2026):** 573 Nein-Schlüssel; 28 Nein gelten danach nur ihrer Adresse (24 Titel, fast alle Prime), keines ist ganz aufgehoben. Bau-Vergleich `--katalog` acf8fd784 → ba39407c0: Abo-Wege aus JustWatch 5 → 7, genau Digimon 552 (gti 70a9f6b2…, Prime-Flatrate, Ton de) und Haganai 10719 (gti 6b0f25fd…, Ton de/ja), sonst keine Datei verschieden. Nach der Nachbesserung (Ja ohne Adresse zählt nicht, Haganai-Beleg berichtigt) schreibt der Bau dasselbe (Bau-Vergleich `--katalog` 8788c94d9 → 000038015): 212888 sperrt Crunchyroll wieder ganz, hat dort aber schon einen Weg; Haganais Nein gilt nur noch B0F2958YWW.
- **Absicherung:** `check-nein-handbeleg.ts` (Regel je Adresse samt Mutation „Nein gilt dem ganzen Titel“; Cartoon-Zwilling und Runde „ohne jeden Weg“ reichen die Adresse durch), `check-nein-handbeleg-aufrufer.ts` (Abo-Runde) und `check-nein-handbeleg-cr.ts` (Geschwister-Block, Katalog) je mit „Nein nur an dieser Adresse“, `check-nein-handbeleg-abschluss.ts` (läuft `schliesseWegeAb`; rot, wenn der Aufruf von `entferneBezugswegeTrotzNein` oder dessen `alleChecks` wegfällt).
- **Datenbefund (berichtigt 14.10.2026):** Der 10719-Beleg „nicht verfügbar“ (28.09.2026) trug die Adresse B09JV7CC61, seine Notiz nennt aber die Seite B0F2958YWW („laut Seite nicht mehr im Abo“, gti 9c74b1e6…); jetzt steht B0F2958YWW im Beleg. Der neue Weg führt zu JustWatchs Prime-Ausgabe (gti 6b0f25fd…, Ton de/ja), die keiner der beiden Belege nennt.
- **Datum und Sammeladressen (20.10.2026, `fix/nein-belege-datum-adresse`):** Widersprechen sich Ja und Nein derselben Adresse, gilt das jüngere Urteil: `verschmelze` setzt `juengstesUrteil` (nur bei verschiedenen Daten; am selben Tag bleibt der Feldvergleich, „nicht verfügbar“ gewinnt), `neinHandbelege` liest es. Vorher hob ein älteres Ja ein jüngeres Nein auf (Bereich) und ein älteres „nicht verfügbar“ überlebte ein jüngeres Ja. Such-, Start- und Länderseiten (`istSammelKern` in `shared/adresse-kern.ts`: `amazon.de/s`, Host allein, `/de`) sind keine Ausgabe: ihr Ja belegt keine zweite, ihr Nein gilt der ganzen Plattform und entfällt neben einem Ja an echter Adresse (eine Suche, die den Titel nicht zeigt, widerlegt die Seite nicht; Jormungand: Perfect Order, 13331). Bestand 20.10.: 16 Nein-Schlüssel entfallen (15 Titel mit „0 Folgen geprüft“-Nein vom August/September und deutschem Ja vom 16./18.10., dazu das wirkungslose `13331|amazon.de/s`), sichtbar ändert sich nur Wonderland (107012): sein Prime-Abo-Weg kommt zurück. Die Wirkung auf Cartoon-Wege und Termine wurde nicht gesondert gemessen; Bau-Vergleich `--katalog` 1400c368e → 8543686a0. Absicherung: `check-nein-handbeleg-datum.ts` (echter Weg `ladeHandbelege` → `neinHandbelege` → `wegVerneint` über `AK_ROOT`).

## Offizielle Websites als Quelle: Sammler und Vorschlagsdatei (13.10.2026)

Daniel (12.10.2026, 22:00): Die Website eines Titels gilt als **offiziell, wenn die Trailer-Beschreibung sie verlinkt**; ihre Meldungen zählen als Quelle und sollen im Neuigkeiten-Bereich der Kachel stehen. Grundlage: `daniel-zum-abarbeiten/berichte/offizielle-seiten-news-2026-10-12.md` und der Messlauf `…/offizielle-seiten-messlauf-2026-10-12.md` (nur im Hauptordner, nicht im Repo) (100 Hosts, 107 Titel, 63 sicher lesbar).

- **Fluss:** `data/offizielle-seiten.yaml` (Handliste, 60 Hosts) → `pipeline/fetch-offizielle-news.ts` → `data/proposals/offizielle-news.json` (Vorschläge, speist keinen Bau) → Freigabe von Hand → Meldung (Art `offiziell`, folgt in einem eigenen Pull Request). Wie bei Anime2You geht nichts ohne Freigabe in den Bestand.
- **Seitenliste:** je Host `url` der News-Liste (aus der Startseite gelesen, nie geraten), `muster` (`feed` | `wp` | `json` | `html`), `sprache`, optional `pause` (Crawl-delay) und bei JSON-Listen ohne Adresse je Meldung `eintrag` (`…/detail.html?d={uniqueId}`). Saat: die 60 Hosts des Messlaufs mit sicherem Muster; nicht aufgenommen: Bot-Sperre (403), JS-Listen ohne Datenpfad, „HTML wenig“, Weiterleitung auf andere Hosts. Ein neuer Host braucht erst die Lesung seiner robots.txt und Startseite und einen Abruf zur Probe.
- **Welcher Titel?** Aus den `websites` der aniSearch-Einträge (`data/anisearch.json`, gecachte Daten, nie ein Abruf von aniSearch): der jüngste Titel (Jahr aus `titles.json`), bei Gleichstand bleiben alle als `titelIds`, die Freigabe wählt. Ob die Seite „offiziell für genau diesen Titel“ ist, klärt die Handliste (Verleih-/Senderseiten wie gundam.info oder tv-asahi.co.jp stehen nicht darin); die Trailer-Beschreibung als Gegenprobe ist **nicht automatisiert** (offen).
- **Abruf in zwei Stufen:** Stufe 1 Feed (RSS/Atom), WordPress-REST, JSON-Liste (ein Abruf, Felder); Stufe 2 HTML-Listen mit einem Leser für alle (`lib/offiziell-html.ts`: Datum + verlinkte Überschrift, nachsichtiger Baum, kleinster Umschlag mit genau einem Datum). Das Datum wird so gelesen, wie die Seite es schreibt (Ortszeit der Seite), Zukunftsdaten (Termine im Text) und Überschriften, die nur eine Adresse sind, entfallen.
- **Höflich:** robots.txt je Host (höchstens 7 Tage alt; `403` darauf = nicht lesen), Crawl-delay beachtet (über 60 s: Host übersprungen), 2 s Takt über alle Hosts, höchstens 30 Hosts je Lauf, der am längsten nicht gelesene zuerst (jeder Host spätestens nach `ceil(Hosts/30)` Läufen), Frist 25 min, ein Host höchstens einmal am Tag. `403`/`429`/`503` = Pause bis `Retry-After`, mindestens 1 h, höchstens 24 h; drei Fehlschläge in Folge = Pause 24 h. Nie Abbruch des Laufs, nie Umgehung einer Sperre.
- **Cache:** Rohantworten unter `data/cache/offizielle-news/<host>/<hash>.txt`, Stand (zuletzt gelesen, robots.txt, Pausen) in `…/stand.json`; beides nur im Actions-Cache, nicht im Repo. `--aus-cache` wertet die Rohantworten ohne Abruf neu aus (Parser-Arbeit). Gespeichert wird nur Überschrift, Tag und Adresse; Volltexte (Feed) werden verworfen. Snowballs robots.txt enthält nur einen Rechtevorbehalt nach Art. 4 DSM-Richtlinie ohne Regel; wir halten Überschrift, Tag, Adresse und lesen keine Volltexte.
- **Relevanzfilter** (`lib/offiziell-relevanz.ts`): Kategorie `staffel` | `film` | `synchro` | `termin` aus Stichwörtern (Japanisch/Englisch), davor eine Ausschlussliste (Blu-ray, Radio, Goodies, Events, PV/Opening, japanische Sender und Streamer wie AT-X, TVer, ABEMA, U-NEXT); `吹替`, `Dub`, weltweite Plattformstarts (Netflix, Prime Video, Crunchyroll, Disney+, 世界独占) und `production confirmed` heben die Ausschlussliste auf. Handstichprobe 13.10.2026: 6 von 324 Überschriften relevant (≈ 2 %). Der Filter ist nur eine Vorauswahl.
- **Vorschläge:** `id` (Hash aus Host, Tag, Überschrift), `titel` wörtlich, `datum` = Tag der Seite, `url`, `sprache`, `kategorie`, `gefundenAm`. Bekanntes bleibt bytegleich (kein Diff ohne Neues), Fenster 365 Tage (so lange zeigt die News-Art `offiziell`), Aufbewahrung 400 Tage.
- **Prüfung:** `check-offizielle-news.ts` (Filter mit den sieben Fundstellen und elf Fehltreffern, Datumsfenster, Leser Feed/Atom/WordPress/JSON/HTML in vier Gerüsten) und `check-offizielle-lauf.ts` (robots.txt, Crawl-delay, Pause, Fristen: neue Meldung spätestens am 3. Tag, geänderte robots.txt spätestens am 7. Tag, Pause spätestens nach 24 h, Frist des Laufs).
- **Workflow:** `.github/workflows/offizielle-news.yml` (nur `workflow_dispatch`, Einreichen per Pull Request). **Wecker-Eintrag (13.10.2026):** täglich 13 Uhr UTC in `shared/weckplan.ts` (`stunden: [13], abstandMin: 600`), Nachholen in `wecker-wache.yml` (`PLAN`, `offizielle-news.yml:30`), Frist der Wochenwache 36 h (`tools/wache-woechentlich.mjs`). Wirkt erst nach `wrangler deploy` des Workers (Befehl in `betrieb.md`); bis dahin startet die Wecker-Wache den Lauf nach rund 30 Stunden, oder von Hand `gh workflow run offizielle-news.yml --repo danielzaiser91/anime-kalender-de`. Takt: der Messlauf fand rund eine relevante Meldung je Woche; ein Lauf liest höchstens 30 von 60 Hosts, jeder Host wird spätestens nach 2 Läufen gelesen, täglich genügt also. Prüfung: `check-offizielle-lauf.ts`, Abschnitt „Zeitplan“.
- **Testlauf 13.10.2026 (10 Hosts, 1 Abruf der Liste je Host):** `mushokutensei.jp` antwortete mit Sperre (Pause, nicht umgangen); die übrigen 9 lieferten 157 Meldungen, 6 relevant (Snowball Earth „Season 2 Production Confirmed!“, 4 × Mission: Yozakura Family 2. Staffel/2. Cour, 1 × Himekishi „放送・配信情報更新！“). Details in der Beschreibung des Pull Requests.
- **Offen:** die 18 JS-Listen (Datenpfad per Playwright-Mitschnitt), die 5 Bot-Sperren, die Trailer-Beschreibung als Gegenprobe der Offiziellheit, automatische Erkennung neuer Hosts.

## freenet meinVOD: Deutsch laut Schwester-Shop (13.10.2026)

Anlass: Bei 226 Titeln (u. a. „Make a Girl“) stand freenet Video ohne Sprachangabe. JustWatch nennt bei allen 220 freenet-Angeboten keine Tonspur; die freenet-Seiten lesen wir nicht (der Betreiber, auch maxdome/meinVOD, sperrt KI-Bots in der robots.txt namentlich, die Filmseite enthält ohne JavaScript nichts). Daniel entschied am 13.10.2026 um 12:00 für Variante A (übernehmen und kennzeichnen).

- **Regel** (`pipeline/lib/schwester-shop.ts`, Phase `bau/11-8-schwester-shop.ts`, zuletzt in `schliesseWegeAb`, nach allen Urteilen der Schwester-Shops): Belegt mindestens ein Schwester-Shop desselben Titels (maxdome, MagentaTV, Videoload) Deutsch (`dubRanges` mit `dub: true`) und verneint keiner (nur `dub: false`-Bereiche), trägt der freenet-Weg `dubAbgeleitet: 'schwester-shop'`. Sonst bleibt es bei „Sprache offen“. Ein freenet-Weg mit eigener Angabe bleibt, wie er ist.
- **Nie ein Beleg:** Das Feld steht neben, nie in `dubRanges`/`dub`. Der Kasten (`antwort-berechnen.ts`), die Folgen-Dateien und `ohneBelegteSynchro` lesen nur `dubRanges`/`dub`, zählen die Kennzeichnung also nicht. Die Blase heißt „laut Schwester-Shop“ (grau wie „laut JustWatch“), die Legende erklärt sie.
- **Messung 13.10.2026 (öffentlicher Bestand):** 226 Titel mit freenet, 202 mit Schwester-Beleg (davon 107 bei allen drei, 77 nur maxdome, 16 nur Videoload, 2 mit zwei Shops), 0 mit Widerspruch, 24 ohne Beleg. Videoload gilt seit 22.09.2026 als deutsch (Telekom, deutscher Anbieter); die 16 Titel, die nur dort Deutsch belegen, stützen sich auf diese Annahme.
- **Prüfung:** `check-schwester-shop.ts` (Regel, Widerspruch, Gegenprobe „nie ein Beleg“, Zusicherung des Baus) in `check:logic`; `check-schwester-shop-bestand.ts` in `check:bestand`. Der Bau bricht ab, wenn eine Kennzeichnung ohne Grund oder neben `dubRanges` steht.
- **Eigene Angabe geht vor:** Trägt ein freenet-Weg später selbst `dubRanges` (etwa aus einem Handbeleg), bleibt die Kennzeichnung für ihn aus.

## ADN-Serien ohne AniList-Suche: Zuordnung über aniSearchs Titelliste (13.10.2026)

Schritt 3 von „AniList restlos raus“ (`daniel-zum-abarbeiten/berichte/anilist-rest-2026-10-13.md`). `fetch-adn.ts` ruft `searchMedia` nicht mehr auf; `data/adn-catalog.json` trägt je Serie `anisearchId` statt `anilistId`.

- **Weg:** `lib/adn-anisearch.ts` (rein) sucht in der Titelliste (`data/cache/anisearch-titelliste.json`, `GET /v1/anime/titles`, nur API und Cache, nie Seiten) mit demselben Wortindex wie der Katalogabgleich (`vorauswahl`). Zulässig ist ein Kandidat mit **gleichem normalisierten Namen** (Titel oder Originaltitel gegen jede aniSearch-Schreibweise) oder mit geteilten Wörtern (`passtZuSerie`) und mindestens `MINDESTPUNKTE` = 5 (`bewerteTreffer`). Rang: gleicher Name vor Punkten. Der beste Kandidat gewinnt, nicht der erste; steht ein zweiter gleichen Rangs daneben, bleibt die Serie **offen** (nichts raten). Vergabe wie bisher gierig, ein Eintrag gehört höchstens einer Serie. `lib/adn-zuordnung-lauf.ts` liest den Cache, holt die Titelliste nur bei Alter über 7 Tage (`TITELLISTE_MAX_TAGE`) und mit Token neu, und behält ohne Titelliste die bisherige Zuordnung (ein Lauf ohne Cache löscht nichts). `npm run data:adn:zuordnen` rechnet ohne ADN-Abruf neu.
- **Offene Serien:** `data/adn-anisearch-offen.json` (Serienkennung, Grund `kein-kandidat` | `mehrdeutig` | `vergeben` | `titelliste-fehlt` (Titelliste im Lauf nicht abrufbar, seit 20.10.2026; der nächste Lauf mit Titelliste rechnet neu), die besten drei Kandidaten mit Punkten). Stand 13.10.2026: 20 von 109, davon 19 ohne Kandidat (Western-Cartoons wie Titeuf, Lucky Luke, Garfield Show, Babar, Yakari, Spirou: aniSearchs Anime-Titelliste führt sie nicht; Billy & Buddy 1144/1265 gehört dazu) und 1 mehrdeutig (JoJo 444: 74, 207 und 7946 haben alle den Namen und 6 Punkte).
- **Aufgelöst im Bau:** `bau/adn-show-titel.ts` (`loeseAdnTitelIds`) setzt `titleId` (nur im Speicher) aus der aniSearch-Kennung des Titels (`anisearchKennungen`); teilen mehrere Titel eine Kennung (Wolf's Rain TV und OVA, Gantz), gewinnt der mit dem besten Namen (`bewerteTreffer`), bei Gleichstand keiner. Das Verwerfen bei fehlendem Namensbezug bleibt (`nameTraegt`: `passtZuSerie` gegen den Titel, oder gleicher Name nach Normalisierung — „TERRAFORMARS“ und „Terra Formars“ teilen kein ganzes Wort).
- **Messung (13.10.2026, Cache-Titelliste vom 11.10., 109 Serien):** 82 gleich zur alten AniList-Zuordnung (über die aniSearch-Kennung des Titels verglichen), 18 beide ohne, 4 nur neu (Terra Formars 9485, One Piece Film 1 = „One Piece (2000)“ 302, DAN DA DAN 18878, Mushoku no Eiyuu 18748), 2 nur alt (JoJo: mehrdeutig; Billy & Buddy), 3 anders: One Piece Movie 2 und Movie 8 trugen eine **falsche** AniList-Zuordnung („Bouken Gabotenjima“ 3634, „Teki wa Kaizoku: Neko-tachi no Kyouen“ 2461 teilen nur ein Wort); neu 1815 und 3965, die Filme selbst. Interspecies Reviewers: alte AniList 110270 nicht im Datensatz, neu aniSearch 14452 (gleiches Werk). Von Hand gegengeprüft an Name, Jahr und Format. Schwellenwahl: richtige Treffer ohne Namensgleichheit liegen bei 7 und 8, Zufallstreffer (Garfield → Aikatsu-Show, Lucky Luke → „Lucky“, Martin Matin → „Bai Bian Martin“, Magic Roundabout → „Shounen Sarutobi Sasuke“) bei höchstens 3.
- **Prüfung:** `pipeline/check-adn-anisearch.ts` (in `check:logic`): Fälle der Messung, die Frist der Titelliste („gilt am letzten Tag der Frist, eine Millisekunde danach nicht“), Wolf's-Rain-Wahl, und am eingecheckten Katalog: jede Serie ohne `anisearchId` steht in der offenen Liste und umgekehrt, keine Kennung doppelt, keine `anilistId` übrig, Grund passt zu den Kandidaten.
- **CI:** Der Katalog-Lauf in `refresh-weekly.yml` bekommt `ANISEARCH_TOKEN`; der ADN-Job wartet noch auf den AniList-Job (`needs`), das fällt mit Schritt 7.
- **Titelliste in CI (13.10.2026):** Kein Job legt `data/cache/anisearch-titelliste.json` im Actions-Cache ab (der anilist-Job speichert den Cache, gleicht aber nichts ab; der ADN-Job liest nur, `cache: restore`). Die Regel „höchstens 7 Tage alt“ gilt deshalb dort so: jede Woche steht der Cache ohne Liste da und der Katalog-Lauf holt sie selbst. Das Limit (1 Abruf je Stunde) teilen sich alle Jobs (der tmdb-Job holt `/titles` ebenfalls). Darum **ein Versuch mit Frist von 2 Minuten, keine Pause bei 429** (`ABRUF_GRENZEN` in `lib/adn-zuordnung-lauf.ts`): `holen()` hätte sonst bis zu viermal Retry-After gewartet, der Schritt hat 45 Minuten. Kommt keine Liste, bleibt die Zuordnung der Vorwoche stehen (`ordneKatalogZuAnisearch`) und die Woche geht nicht verloren; die Zusicherung steht in `pipeline/check-adn-titelliste-abruf.ts` (ohne den Fix hängt sie). Der Katalogabgleich (`fetch-anisearch-katalog-abgleich.ts`, nur von Hand) behält vier Versuche mit Pause.

## Anime2You: vier alte Artikel von Hand ausgewertet, ohne neue Angabe (13.10.2026)

Folge von `daniel-zum-abarbeiten/berichte/anime2you-altartikel-2026-10-13.md`: Die vier Artikel mit plausibler Lücke wurden aus dem Beleg-Archiv (`GET <Worker>/beleg?key=<Schlüssel aus data/beleg-lesungen.json>` liefert den Artikeltext, 3 bis 9 KB; Antwort mit `zlib.gunzipSync` versucht, sonst als Text gelesen) bzw. mit einem Seitenabruf gelesen. **Kein Artikel füllt die Lücke seines Eintrags; die Daten bleiben unverändert.** Damit ist die Schwelle des Berichts (zwei neue Fakten aus den 11) für das Nachlesen aller 69 nicht erreicht.

- **1047190 (Black Clover Staffel 2, 07.09.):** „ab dem 3. Oktober 2026 im japanischen Fernsehen“, Crunchyroll im Simulcast; keine Folgenzahl, keine deutsche Fassung (die Leserfrage nach der Synchro bleibt im Artikel unbeantwortet). `estimated` und `episodeCountAssumed` bleiben.
- **1052708 (Netflix Oktober):** Folgenzahlen nur bei fertigen Staffeln (Vigilantes 26, Rooster Fighter 12, Edgerunners II 10, My Happy Marriage 3); die stehen schon in den Einträgen bzw. in `katalog-release-von-hand.yaml`. Beerus (Simulcast) und die Blue-Box-/Ramparts-Staffel 2 nennen keine Folgenzahl.
- **1057464 (Prime Video, 04.10.):** Marronniers „1 von 20 verfügbar“ (steht, `episodeCount: 20`); Tank Chair nur „1 verfügbar“, keine Gesamtzahl. Sengoku Night Blood (12, „wieder verfügbar“) hat keinen Eintrag.
- **1056789 (AKIBA PASS SHOP, 02.10.):** Apothekerin S2 Vol. 2 „15.01.“ ohne Jahr; 2027 bleibt abgeleitet (`estimated`). Die übrigen Zeilen weichen vom Eintrag ab: A New Dawn 11.12. (Eintrag 04.12. aus 1056972), Sailor Moon Staffel 2 bis 5 am 20.11., 18.12., 15.01., 19.02. (Einträge aus aniSearch: 06.11., 06.11./04.12., 04.12., 15.01.). Ob das Shop-Termine sind, ist offen.
- **Eingetragen** in `gelesen` von `data/proposals/anime2you-extraktion.json` (`vorschlaege: 0`, `uebersprungen: "von Hand gelesen, keine Lücke gefüllt"`; das Format erlaubt das ohne Modelllauf).
- **`eingearbeitet.ts`:** `data/katalog-release-von-hand.yaml` steht jetzt in `DATEIEN` (neu im Abgleich: nur die Crunchyroll-Abruf-Adresse). `data/titel-de.yaml` fehlt ebenfalls, trägt aber nur eine alte Anime2You-Adresse (230373) und vier fremde.

## Videoload und MagentaTV: Deutsch angenommen, nicht belegt (13.10.2026)

Anlass: Prüfer-Befund zum freenet-PR. Videoload trug seit 22.09.2026 pauschal `dubRanges` (Daniels Annahme „Telekom, .de, alles deutsch“), MagentaTV desselben Katalogs nicht (Beispiel Ghost in the Shell SAC: Videoload mit Haken, MagentaTV „Sprache offen“). 16 freenet-Titel hingen allein an dieser Annahme, also eine Ableitung auf einer Annahme.

- **Messung (Datensatz und `data/justwatch-audio.json`, 13.10.2026, keine Anbieterabrufe):** JustWatch nennt bei 303 von 304 MagentaTV-Angeboten mit Tonangabe deutschen Ton (283 Filme, 7 Serien, 1 Special, 12 ohne Format im Angebotsbestand). Die eine Ausnahme: „Angry Birds Toons“ Staffel 2, nur Englisch (Cartoon, kein Videoload-Weg). „Magenta TV+“ (Abo, 55 Angebote) trägt bis auf 6 Filme keine Tonangabe. Im Bestand: 163 Titel mit Videoload-Deutsch, davon 140 auch bei MagentaTV mit Deutsch, 23 MagentaTV offen; **kein** Titel mit einem Nein bei einem der beiden. Die Annahme stützt sich also auf den Katalog, widerlegt ist sie in einem Fall, kein Beleg je Titel.
- **Regel** (`pipeline/lib/telekom-annahme.ts`, aufgerufen in `bau/11-2-justwatch.ts`): Videoload (jeder Zugang) und MagentaTV **Kauf/Leihe** ohne eigene Angabe bekommen `dubRanges` über alle Folgen **und** `dubAbgeleitet: 'telekom-annahme'`. Nicht bei Magenta TV+ (anderer Katalog, durchgereichte Partner) und nicht, wo JustWatch bei MagentaTV für den Titel eine Tonspur ohne Deutsch meldet.
- **Warum `dubRanges` bleiben:** Die Annahme ist Daniels Entscheidung vom 22.09.; gemessen hängt kein Titel mit seiner Deutsch-Antwort allein daran (0 von 163 vor, 0 nach der Änderung; `check-telekom-annahme-bestand.ts` hält das fest). `folgen-ohne-anbieter.ts` liest die Bereiche unverändert („Für Folgen … kennen wir keinen deutschen Anbieter“ nennt auch den angenommenen Anbieter); geändert sind die Pille, die freenet-Ableitung und (Nacharbeit 13.10.2026) der Antwort-Kasten: `antwort-berechnen.ts` nimmt Annahme-Wege über `belegteBereiche` (`antwort-regeln.ts`) aus Synchro-Urteil, Abdeckung und Folgenvereinigung. Gemessen mit dem Bestand vom 13.10.2026 (165 Titel mit Annahme, `check-telekom-annahme.ts`, Abschnitt „Antwort-Kasten“): 4 Titel ändern ihre Antwort — Devil May Cry (Netflix belegt Folge 1, Videoload nahm 1–12 an) fällt von „fertig, 12 von 12“ auf „teilweise, 1 von 12“, drei Titel (Suicide Squad Isekai, Narenare, Miraculous) bleiben „fertig“, tragen die Folgenzahl aber jetzt als abgeleitet (≈), weil nur die Annahme sie vollständig machte.
- **Oberfläche:** Blase „Deutsch angenommen“ (Grau wie „laut Schwester-Shop“) statt „✓ Deutsch“, keine Folgenzahl an der Pille, Legende „Der Telekom-Katalog (Videoload, MagentaTV) gilt als deutsch; zu diesem Titel nennt er keine Tonspur.“ (seit 19.10.2026: „…belegt ist die Tonspur dort nicht.“) Ein Beleg am Weg (JustWatch je Film, Handbeleg) hat keine Kennzeichnung und bleibt „✓ Deutsch“.
- **freenet:** Die Annahme zählt nicht als Schwester-Beleg (`schwester-shop.ts`). Gemessen im Vergleichsbau: 202 → 186 freenet-Wege mit „laut Schwester-Shop“ (16 Titel, die nur an Videoload hingen, fallen zurück auf „Sprache offen“); MagentaTV-Kauf-Wege mit der Annahme: 19 neu (166 → 185 Telekom-Wege an 164 Titeln); `check-telekom-annahme-bestand.ts` am Vergleichsbau grün.
- **Prüfung:** `check-telekom-annahme.ts` (`check:logic`: Regel, Gegenprobe Angry Birds, Abo bleibt offen, freenet leitet nichts ab, Blase und Legende, Zusicherung des Baus) und `check-telekom-annahme-bestand.ts` (`check:bestand`). Der Bau bricht ab, wenn die Kennzeichnung an einem fremden Anbieter oder neben einem Nein steht.
- **Offen (erledigt 19.10.2026, s. u. „Telekom-Zwilling“):** Videoload ist bei JustWatch nicht gelistet; der MagentaTV-Zwilling (gleiche Gracenote-Kennung) ist der Beleg. Taucht ein Gegenbeispiel auf, genügt ein Handbeleg mit `dub: false` (eigene Angabe geht vor).

## Joyn pauschal und Prime-Kanal-Erbe tragen `dubAbgeleitet` (28.10.2026)

- **Regel:** Zwei Wege setzen `dub: true`, ohne dass der Weg oder eine Messquelle Deutsch nennt: Joyn (`bau/joyn-pauschal.ts`, Daniel 02.09.2026, „deutscher Anbieter“) und ein Prime-Kanal-Weg, der das Ja seines Anbieters Crunchyroll/ADN erbt (`bau/kanal-erbt-anbieter.ts`). Sie tragen jetzt `dubAbgeleitet: 'joyn-pauschal'` bzw. `'kanal-erbt'` an `streams` (Typ `DubAbgeleitet`, `shared/watchlink-typ.ts`). Die `dub`-Werte blieben unverändert. Wege mit Handbeleg oder eigenem Urteil tragen das Kennzeichen nie. Nimmt der Bau das Ja zurück (Sprachtermin, Widerlegung), fällt das Kennzeichen mit.
- **Prüfung:** `check-dub-abgeleitet.ts` (Regel, Kreislauf Erbe → Sprachtermin), `check-dub-abgeleitet-lauf.ts` (der Bau-Aufrufer `auslieferungsInvarianten` bricht bei Kennzeichen ohne `dub: true` oder an fremdem Anbieter ab; `lib/dub-abgeleitet.ts`).
- **Oberfläche:** liest `dubAbgeleitet` an Streams noch nicht; beide Wege zeigen weiter „✓ Deutsch“ wie ein gemessenes Ja. Eine Anzeige „angenommen“ wäre ein eigener Auftrag.

## AKIBA PASS SHOP gegen Bestand: Sailor Moon Staffel 2–5 und A New Dawn (13.10.2026)

- **Sailor Moon Staffel 2–5 (Steelbook-Gesamtausgaben):** Der Shop (Anime2You 1056789, 02.10.) nennt 20.11./18.12./15.01./19.02. Bestand war der aniSearch-Stand vor den Verschiebungen (Anime2You 1045437, 01.09.: 11-06→12-18, 12-04→01-15, 01-15→02-19). Phase 08 (`verschiebungenAnwenden`) griff nicht, weil der Name abweicht („Sailor Moon – Staffel 3“ gegen „Sailor Moon S“). Staffel 2: Shop-Seite am 13.10. `releaseDate: "20.11.2026"`, die Tabelle von 1045437 nannte 06.11. — der Shop gilt. Jahre ohne Jahresangabe im Artikel sind abgeleitet (`estimated`), nur Staffel 2 hat sie belegt.
- **Doppelter Eintrag:** `sailor-moon-s-2026-12-04` trug die aniSearch-Adresse der Super-S-DVD (210270) und fiel weg.
- **A New Dawn (Blu-ray):** Meldung 1056972 (03.10.) „nach aktuellem Stand 4. Dezember“, Shop 11.12. (Artikel 02.10., Shop-Seite am 13.10. `releaseDate: "11.12.2026"`). Gleiche Art (Blu-ray gegen Blu-ray), der Shop gilt nach der Rangfolge oben. Offen: ob polyband selbst 04.12. hält; jpc oder die polyband-Seite würden es klären. Das Kino (15.10.) ist eine andere Art und unberührt.
- **Shopify-Seiten von akibapassshop.de:** robots.txt erlaubt Produktseiten; das Datum steht im Seitenquelltext als `releaseDate: "TT.MM.JJJJ"`, nicht im sichtbaren Text.

## Anime2You-Vorschläge zu Handeinträgen, zweite Runde (13.10.2026)

Anlass: Auftrag „Anime2You-Vorschläge → Handeinträge, zweite Runde (bis 30)“. Vorgehen anders als in der ersten Runde: nicht die 112 Vorschläge der Extraktion, sondern alle 213 Artikel, die `anime2you.json` und die Extraktion führen, über die WordPress-Schnittstelle (`/wp-json/wp/v2/posts/<Kennung>`, 1,2 s Abstand) im Volltext gelesen und gegen `releases.json` geprüft. Skripte nur im Scratchpad.

- **Gegenprobe über die Titelblöcke:** 86 Blöcke (`»Titel«`, `Sprache:`, `Stream:`) aus Artikeln ab dem 15.08.2026, je Block Titel → `titles.json` → `releases.json` auf derselben Plattform. Ohne Termin auf derselben Plattform und mit „Deutsch“ in der Sprache: 36 Blöcke. Davon 13 Katalogabgänge (Meldungen „verlässt den Katalog“, das Datenmodell kennt keine Abgänge), 5 schon vorhanden unter anderer Kennung (Demon Slayer ×4 aus PR 1017, Blue Box Staffel 2), 15 eingetragen (`streaming-nachtrag-2026.yaml`) und 3 wegen der Obergrenze offen (Yu-Gi-Oh! ZEXAL Staffel 2 und 3 bei Prime Video, Beyblade X Staffel 2 Part 2 bei Disney+, Beyblade X Staffel 3 bei Prime Video).
- **Wo die Lücke herkommt:** Alle 15 Artikel erschienen vor der Regel „Ab sofort = Tag der Meldung“ (02.10.2026); ihre Vorschläge stehen in `anime2you.json` ohne Eintrag im Bestand (`alreadyCurated: false`), vermutlich dieselbe Ursache wie bei Snowball Earth (Abschnitt „Weitere verpasste Disney+-Starts“ oben). Damit ist auch dort „A Sign of Affection S1“ gelöst: Der Artikel ist 1052288 (20.09.2026), nicht in der Liste der 36 Sammelartikel von damals. Neu bei Disney+ außerdem One Piece Staffel 4 bis 8 (Episoden 93–206); Staffel 9–16 bleibt offen.
- **Discs:** Die Beschaffungsartikel (1058300, 1058438, 1046360, 1046924, 1044146, 1052189) gegen `releases.json` nach `titleId`: 14 Disc-Einträge in `disc-winter-2026.yaml` (13 Titel ohne Disc-Termin, dazu Loner Life Volume 1). Wo die Quelle nur „15.01.“ nennt, gilt 2027 aus dem Artikeldatum und `estimated: true`. **Zwei Nebenwirkungen, vom Bauvergleich gefunden:** (1) Ein Handeintrag zu einem Titel mit automatischem Disc-Eintrag ließ den automatischen wegfallen (Loner Life Vol. 2 nahm `auto-173693-disc` mit; darum steht Volume 1 als Handeintrag unter dem alten Slug). **Behoben 13.10.2026** (`releasesAus`, Prüfung `check-auto-disc-handeintrag.ts`): Bei Discs zählt der Tag; ein Handeintrag ersetzt nur den Termin desselben Tags oder aus den Artikeln, die er als Quelle führt (A New Dawn: Handeintrag 11.12., Artikel nannte auch den 04.12.), nicht die übrigen Volumes. (2) Jeder Termin an einem Titel, der bisher keinen hatte, nimmt ihm das „Im Angebot seit“ aus dem Plattformkatalog (`13-3-listen.ts`, `hatTermin`): Die Pokémon-Box „Die Anfänge“ (Titel 527, Netflix seit 02.2025) ist deshalb nicht eingetragen.
- **Ton:** In jeder der 15 Streaming-Meldungen steht die deutsche Fassung auch im Fließtext (Synchronisation, „auf Deutsch“, Sprachfassung, Sprachausgabe), darum Termine ohne `sprache` und ohne `dub`-Felder, wie die bestehenden Disney+-Termine. Demon Slayer (PR 1017) blieb `sprache: offen`, weil dort nur der Block die Sprache nennt.
- **Ankündigung:** Bride of the Barrier Master (197619, Netflix, Januar 2027, Untertitel, `synchro: offen`). AniList-Kennungen über `npx tsx pipeline/qa-resolve.ts "<Name>"`.
- **Bewusst nicht gemacht:** Dragon Ball Z Movies Box Vol. 1 (vier Filme, 20.11.2026; 1054654) und Vol. 2 (15.01.2027, Inhalt nicht genannt) wegen der Obergrenze von 30 Einträgen; Pokémon: Die Anfänge (siehe Nebenwirkung oben); Godzilla Minus One/Zero (Realfilm, kein Anime); Bass X Machina (Netflix, 03.11.2026, OmU) hat auf AniList keinen Treffer; Magical Buffs (209661, Crunchyroll, Januar 2027), Red Riding Hood (214969, Crunchyroll, Januar 2027) und Go with the Clouds (211538, Netflix, 2027 ohne Monat) als Ankündigungen; Pokémon Tales (Disney+, 2027 ohne Monat); Concrete Revolutio: The Last Song steht im Termin von Concrete Revolutio mit (24 Folgen laut Meldung). Katalogabgänge (Death Note und Kuroko’s Basketball bleiben bei Netflix) kennt das Datenmodell nicht.

## ADN: neue Serien und Filme kamen erst im Wochenlauf — vier Bleach-Filme (13.10.2026)

**Anlass (Daniel, 13.10., „Diese Woche“):** Bleach: Fade to Black, The DiamondDust Rebellion, The Hell Verse und Memories of Nobody standen als „Im Angebot“ bei ADN, die Pille „Sprache offen“, ein Klick führte nicht zu ADN. ADN zeigt auf allen vier Seiten „SYNCHRO | UNTERTITEL“.

- **Pille:** Die drei kuratierten Termine (`batch-2026.yaml`) trugen die Ersatzadresse `platformSearchUrl('adn')` (`animationdigitalnetwork.com/de/search?q=…`); ob ADN diese Suche kennt, ist von hier nicht prüfbar (Skript und Playwright bekommen von CloudFront 403, 13.10.2026). Der vierte (Anime2You-Auto-Termin) hatte gar keine. Der Weg des Titels (`streams[].url`) war leer, weil `bau/11-7` nur eine Titelseite übernimmt. Bestand 13.10.: 117 ADN-Releases, 3 mit dieser Suchform (alle Bleach), 3 ohne Adresse (Bleach 1686, Dragon Hatchling 187941, Madoka 9756). `adresseDesWegs` (`13-1-termin-adressen.ts`) behandelt jetzt eine Suchadresse am Termin wie eine fehlende; im Bauvergleich ziehen drei Prime-Termine (Special 7, Ghost Cat Anzu, Miss Hokusai) mit, deren Suche der Titelseite ihres Weges wich.
- **Sprache:** ADN nennt sie selbst. Schnittstelle `gw.api.animationdigitalnetwork.com`, Kopf `X-Target-Distribution: de`: `video.languages` je Video (`vde` = Synchro, `vostde` = Untertitel; die Filme tragen beide), dazu `languages` je Serie in der Liste `/show` (das Seitenabzeichen „SYNCHRO“/„UNTERTITEL“ deckt sich damit, die Herkunft des Abzeichens ist nicht geprüft). Der Sammler las sie schon, aber: Der Kalender-Endpunkt (`/video/calendar`) liefert die Filme nicht (12.10. leer), der Katalog-Lauf fragte sie am 12.10. um 05:27, zwei Stunden vor dem Start (07:00 UTC), und legte kein Archiv an (Antwort ohne Videos); `--laufend` kannte nur, was schon im Archiv lag. Sichtbar wäre es erst am 19.10. geworden.
- **Fix (`lib/adn-neuzugaenge.ts`, `holeNeueSerien` in `fetch-adn.ts`):** Der Lauf `--laufend` (02, 08, 14, 20 Uhr UTC) fragt jede Serie der Liste, die weder Katalog noch Archiv kennen, und legt Serien mit `vde` im Katalog an (ohne aniSearch-Zuordnung; die macht der Wochenlauf, Filme finden ihren Titel über den Namen, `filmZurShow`). Messung 13.10.: Liste 264 Serien (3 Seiten), 11 unbekannt, 4 davon mit `vde` (die Filme), 7 ohne Videos (kein deutsches Angebot; wurden je Lauf neu gefragt, seit 14.10.2026 mit 24 Stunden Ruhe, s. u.). Zusicherung `check-adn-neuzugaenge.ts` („neue Serie ist nach einem `--laufend`-Lauf im Katalog, spätestens nach 6 Stunden“).
- **Doppelte Kachel:** Mit den ADN-Daten stand jeder Film zweimal in der Woche (kuratiert ohne Uhrzeit, `adn-352` mit 09:00). `bau/adn-kuratiert.ts`: gleicher Titel, gleicher Anbieter, gleicher Starttag = ein Termin; der kuratierte bleibt und bekommt Adresse und Uhrzeit von ADN (`check-adn-kuratiert.ts`).
- **Handbeleg:** `data/dub-confirmed.yaml`, vier Einträge (adn, `dub: true`, 13.10.2026). Von acht ADN-Wegen ohne `dub` im Bestand gehen die vier Bleach-Filme auf belegt (Bauvergleich: `dubConfidence` high → very-high); offen blieben Madoka (Termin erst am 29.10.), Fire Force S2 (Adresse der alten Domain) und 86 EIGHTY-SIX (zwei Titel auf Serie 1423); die beiden letzten sind am 14.10.2026 behoben, s. u.
- **Gespeicherte ADN-Seiten (für die Erweiterung):** Die Sprache der angezeigten Seite steht im Abzeichen „SYNCHRO“/„UNTERTITEL“ und in `languages` der Schnittstelle. `__NEXT_DATA__` in den gespeicherten Seiten gehört zur zuerst geladenen Seite, nicht zur angezeigten (die Datei „Steins;Gate“ trägt die Daten von „B King“): nicht darauf verlassen.
- **Warum eine große „Im Angebot“-Kachel:** Der Release trägt `dateMeaning: 'available-from'` (Anime2You „ADN-Neuzugänge im Oktober“), `expandEvents` (`shared/logic.ts`) setzt `imAngebot`, `kartenArt` (`web/src/lib/kachel-folgen.ts`) macht daraus die Kachel (Entscheidung vom 27.08.2026, jedes „Im Angebot seit“ aus 2026 ist ein Termin, s. o.). Die Sprache spielt dabei keine Rolle; nur `Release.sprache` (`omu`/`offen`) setzt die Marke „Synchro offen“ (`Marken.tsx`), und die kuratierten ADN-Einträge tragen keine. Gebaut am 14.10.2026 (s. u.): kuratierte Neuzugangs-Termine ohne Sprachzusage und ohne ADN-`vde` als `sprache: offen` führen, damit die Kachel selbst „Synchro offen“ sagt.
- **Alte Domain:** `animationdigitalnetwork.de` stand an 4 Wegen (21855, 98497, 105310, 114236), Daniel 21.09.: leitet auf die Startseite; umgestellt am 14.10.2026 (s. u.).

## ADN-Reste nach den Bleach-Filmen: Synchro offen, alte Domain, 86, Drossel (14.10.2026)

**Anlass:** Fünf Reste aus dem Bleach-Fix (Abschnitt davor). Vor Punkt 1 gelesen: `git grep "available-from\|sprache: offen"` und `"von selbst"` in `docs/wissen`. `Release.sprache` (`shared/types.ts`) sagt „Termin belegt, Synchro nicht“; `terminBelegtNichts`, `ohneBelegteSynchro`, `deutschNurAusSpracheTermin`, die News und die Kachel lesen es so. Kein Widerspruch; „von selbst“ betrifft die Erweiterung und verbietet hier nichts.

- **Synchro offen (`bau/adn-sprache-offen.ts`, nach der Synchro-Phase, vor den Terminen):** ADN-Termin mit `dateMeaning: available-from`, ohne eigene `sprache`, nicht `automatisch`, dessen Quellen ADNs Kalender nicht nennen, dessen Titel keinen ADN-Weg mit `dub: true` und keinen Handbeleg „deutsch“ hat, bekommt `sprache: 'offen'`. Nur ADN: Bei Disney+, Netflix, Prime und Crunchyroll gibt es kein `vde`, an dem sich „ohne Sprachzusage“ messen ließe. Wirkung am Datensatz heute: keine (Bleach ×3 stammen aus ADNs Kalender, die zwei 86 haben seit Punkt 3 einen `dub`-Weg); am veröffentlichten Stand vom 14.10. ohne Punkt 3 wären es genau diese zwei 86-Termine gewesen. Der Termin zählt danach in `ohneBelegteSynchro` und in den News nicht als Beleg; `terminBelegtNichts` (Phase 09-1) läuft früher und sieht das Feld noch nicht.
- **Alte Domain:** Die vier Wege trugen `animationdigitalnetwork.de/video/<slug>` ohne Kennung; die Serien stehen nicht mehr in der Liste `/show` (264 Serien am 14.10.), wohl aber im Archiv `data/adn-raw/` (562 Fire Force mit zwei ADN-Staffeln zu je 24 Folgen, 1131 UQ Holder!, 1177 Free! Take your Marks, alle Folgen `vde`). Zugeordnet über den Namensteil in `data/adn-adressen.yaml`; das Ergebnis ist `animationdigitalnetwork.com/de/video/<Kennung>`. Fire Force Staffel 1 und 2 zeigen beide auf `/562` (ohne `?s=`: die erste Schärfungsrunde liest `adn-staffelzuordnung.yaml` nicht), Fire Force Staffel 2 bekommt dadurch das Urteil `dub: true` aus dem Archiv. Bauvergleich: 4 Adressen, 1× `dub`, 2× `sharedWith`.
- **86 EIGHTY-SIX (zwei Titel auf Serie 1423):** Ursache war ein Fehler, kein fehlender Beleg. `ergaenzeAdnTitelAusDaten` überspringt eine Serie, deren normalisierter Name einem kuratierten ADN-Termin gleicht („86 eighty six“), und legt dort auch keinen Weg an; der Weg kam erst als „Weg aus einem Termin“ (`11-7`, Herkunft `termin`, nie mit Tonurteil), während das Archivurteil (`09-5`) nur Wege kennt, die dann schon bestehen. `bau/adn-kuratiert-ton.ts` legt den ADN-Weg mit `dub: true` an, wenn ADNs Kalender oder Katalog am Starttag des Termins eine Folge der Serie mit `vde` führt und der Tag nicht in der Zukunft liegt. Gemessen: Serie 1423 hat 23 Folgen, alle `vde` (Archiv), Starttag 08.10.2026. Ergebnis im echten Bau: `herkunft: termin` weg, `dub: true`, Adresse `…/1423-eighty-six?s=1`, `sharedWith: 2`.
- **`show.languages`:** Der Kommentar in `adn-sprachen.ts` gilt nur für die Antworten je Video (dort wechselt das Feld mit der Folge: bei Serie 444 39× `["vostde"]`, 113× `["vde","vostde"]`). Die Serienliste `/show` führt `languages` je Serie und deckt sich bei 257 von 257 Serien mit Archiv damit, ob irgendeine Folge `vde` trägt.
- **Drossel für Serien ohne Videos (`unbekannteSerien`, `LEERE_ANTWORT_FRIST_MS`):** Sieben Serien der Liste (Utena ×2, Madoka ×4, Hei II; `languages: []`) wurden in jedem 6-Stunden-Lauf neu gefragt, 28 Abrufe am Tag. Jetzt steht die Zeit der Antwort auch bei einer leeren Antwort in `data/adn-katalog-stand.json`, und die Serie bleibt 24 Stunden zurückgestellt. Nennt die Liste `vde` für die Serie, wird sofort gefragt; ein Abruffehler setzt keinen Stand. Sichtbar nach höchstens 24 Stunden plus einem Lauf (Liste hinkt) bzw. einem Lauf (Liste nennt `vde`); `check-adn-neuzugaenge.ts` rechnet beides nach (rot ohne die Frist: nach 6 Stunden würde wieder gefragt).
- **Katalog-Lauf fragt auch Stand-Schlüssel ohne Archivdatei (28.10.2026):** `data/adn-katalog-stand.json` kennt 661 Serien, gefragt wurden je Lauf 273 (Liste 264 + Katalog/Archiv 9); 388 Schlüssel ohne Archivdatei („Gespenster“) kamen nie dran. `baueWarteschlange` (`lib/adn-katalog-warteschlange.ts`) hält zwei Grenzen: die bekannten Serien wie bisher bis `--limit 600` (Workflow unverändert, die 273 bleiben jeden Lauf dran), dahinter höchstens 130 Gespenster je Lauf, älteste Stempel zuerst; den Titel liefert die Antwort. Folge: nach drei Wochenläufen (130 + 130 + 128) sind alle 388 einmal gefragt, danach kreisen sie; Abrufe je Lauf 273 → 403 (1,48-fach, rund 6,7 statt 4,5 Minuten bei 700 ms Takt). Eine Fehlantwort (non-404, `franzoesisch`, 400) vermerkt den Versuch unter `v<Kennung>` im Stand, damit eine dauerhaft stumme Serie nicht ewig vorn bleibt; die Antwortzeit `<Kennung>` bleibt unberührt, denn sie lesen `--laufend` (Drossel) und der Lesetag. Log: „N gefragt, davon M ohne Antwort“. Zusicherungen: `check-adn-katalog-warteschlange.ts`, `check-adn-sprachriegel-lauf.ts`.
- **Messgrenze des Bauvergleichs:** Der Ersatz-Cache (`tools/bau-vergleich.mjs`) nimmt die Titel aus dem veröffentlichten `titles.json` samt Wegen; der Fehler bei 86 zeigt sich dort nicht („gleich“ für Punkt 3). Belegt ist er mit dem echten Bau (`npx tsx pipeline/build.ts` mit dem Cache des Hauptordners, Basis gegen Kopf, `titles-core.json`; der Bau bricht am Ende wegen des veralteten Caches ab, die Datei steht vorher).

## Anime2You-Vorschläge zu Handeinträgen, dritte Runde (13.10.2026)

Anlass: Auftrag „Rest aus Runde 2“ (Obergrenze der zweiten Runde). Artikel über die WordPress-Schnittstelle gelesen (`/wp-json/wp/v2/posts/<Kennung>`, 1,5 s Abstand, robots offen), Termine und Zahlen wörtlich gegen den Artikeltext geprüft.

- **Eingetragen:** Dragon Ball Z Filmbox Movies Vol. 1 (Filme 1 bis 4, 20.11.2026; Artikel 1054654 und 1060037) und Vol. 2 (Filme 5 bis 8, 15.01.2027; 1060037), Crunchyroll, Blu-ray und DVD, mit deutscher und japanischer Sprachausgabe: je Film ein Disc-Eintrag (AniList 894 bis 901) wie die Naruto-Shippuden-Movie-Collection; Yu-Gi-Oh! ZEXAL Staffel 2 und 3 bei Prime Video (1048315, 09.09.2026; 49 + 48 Folgen, Eintrag an Zexal II 15489, weil die deutschen Staffeln nicht den AniList-Einträgen folgen: Zexal 1–73, Zexal II 74–146); Beyblade X Staffel 2 Part 2 bei Disney+ (1049988, 14.09.2026; 14 Folgen, Folgen 87–100 der Disney+-Zählung); Pokémon „Die Anfänge“ Staffel 1 und 2 als DVD-Box (1046360, 27.11.2026, polyband anime), möglich erst seit dem Bau-Fix zum „Im Angebot seit“ (`datensatz.md`); Ankündigungen Magical Buffs (209661, Januar 2027, 1058501) und Red Riding Hood (214969, Januar 2027, 1057673), beide Crunchyroll-Simulcast mit Untertiteln.
- **Bewusst nicht:** Beyblade X Staffel 3 „bei Prime Video“ (1053923): Der Artikel meint den RTL+-Kanal auf Prime Video; die Staffel steht als RTL+-Termin (`auto-165159-rtlplus-staffel-3`) im Datensatz, und kuratierte Einträge kennen keinen Prime-Zusatzkanal (`kanal` setzt nur der automatische Weg). Go with the Clouds, North-by-Northwest (211538, Netflix): „im Laufe des nächsten Jahres“, ohne Monat — `ankuendigungen.yaml` verlangt JJJJ-MM.
- **Werkzeug:** `tools/anime2you-luecken.ts` (`npx tsx tools/anime2you-luecken.ts [--seit JJJJ-MM-TT]`) liest die Aussagen aus `data/proposals/aussagen.json`, gleicht sie **neu** gegen `public/data/` ab und listet Titelblöcke mit „Sprache: Deutsch“ ohne Release beim Anbieter. Stand 13.10.2026: 25 Lücken (15 `neu`, 10 `ohne-zuordnung`); davon sind Death Note und Kuroko’s Basketball Meldungen über Katalogabgänge. Vor jedem Eintrag den Artikel lesen.

## Unzuordenbare Folgen mit Live-Bezug: L1, L2, L3 (16.10.2026)

Gemessen nur an Repo-Daten (`data/tmdb-folgen.json`, `data/anisearch*.json`, `data/dub-confirmed.yaml`, `data/adn-raw`, `data/meldungs-auffaelligkeiten.json`). `data/prime-unzugeordnet.json` hält nur Adresse, Titel, Grund und Folgenzahl, nicht die gemeldeten Folgentitel; die liegen in D1 (Meldungskopie nicht holbar). Der Zuordner lässt sich deshalb nicht auf der Datei laufen lassen; belegt ist die Wirkung an Anker-Abdeckung und an einer Simulation mit den ADN-Rohdaten von Dorohedoro.

### L3 (gebaut)
- TMDB als zweiter Anker gab es schon (`sammleAnker`, PR 1352). Zwei Lücken blieben:
  1. `ordneUeberAnker` nahm den ersten Anker mit mindestens einem Treffer. Dorohedoro Staffel 2 (ADN-Rohdaten, 11 Folgen): aniSearch 1 Treffer, TMDB 8. Jetzt gewinnt der Anker mit den meisten Treffern, bei Gleichstand der frühere.
  2. Titel ohne eigenen TMDB-Eintrag (Staffeln, die TMDB unter dem Reihenkopf führt) hatten keinen TMDB-Anker. `tmdbFuerTitel` nimmt den Eintrag des Reihenkopfs, wenn genau eine Staffel zu Folgenzahl, gleichem Startjahr (Nachbarjahr nicht: Attack on Titan 3 und Food Wars Third Plate bekamen so die falsche Staffel) und Folgenlaufzeit passt (höchstens 8 min Abweichung vom Median; angenommene Titel max. 6, Akame ga Kill! Theater 23). 161 von 2.921 Titeln gewinnen so einen Anker (179 ohne Jahresprobe).
- Pokémon Reisen (112153) bleibt offen: Keine TMDB-Staffel hat 136 Folgen (Reisen liegt in TMDB-Staffeln 23 bis 25 der Serie Pokémon mit 48 + 42 + 57 = 147 Folgen). Eine Zuordnung dort bräuchte Staffelbündel und eine Zählung über Staffelgrenzen; das wäre geraten.
- Dorohedoro (ADN, 15 Folgen): ob die 15 gemeldeten Folgen jetzt treffen, ist ohne ihre Titel nicht zu sagen. ADN führt Staffel 1 (12 plus OVA) und Staffel 2 (11) unter einer Adresse; TMDB-Titel sind bei mehreren Teilen mit " / " verbunden (Segmente), ADN nennt nur den ersten Teil. Mögliche Folgearbeit: Segmente als zusätzliche Schlüssel.

### L1: Prime-Adresse B0CJQDVS5H "Pokémon" (nicht zugeordnet, keine Änderung)
- Die Adresse ist keine Titelseite, sondern der Prime-Kanal "pokemonde" (aniSearch führt sie als `primevideo-channel-pokemon-de`; Handbelege tragen "Kanal-Titel", Abo `pokemonde`). Der Kanal enthält die ganze Reihe in Prime-Staffeln zu 10 bis 14 Folgen.
- Kandidaten mit Beleg: Titel 527 (Pokémon, 276 Folgen; Meldung 6642) und 97634 (Sonne & Mond, 146 Folgen; Meldung 8961); Handbelege für beide stehen in `data/dub-confirmed.yaml` (Zeilen 7029, 16449, 20415). Weitere Staffeln desselben Kanals (z. B. B0CGMVVT8X) hängen an denselben Titeln.
- Nicht eindeutig: Je Eintrag (10 bis 14 Folgen) fehlt der Folgentitel, um die Prime-Staffel einer TMDB-Staffel zuzuordnen; dafür braucht es die Rohfolgen aus D1. Amazons Sprachangabe ist auf Kanal-Titeln kein Beleg. Gebaut wurde nichts.

### L2: Netflix Dangers in My Heart und Vinland Saga, 62 Folgen (nur geprüft)
- Vinland Saga (24 Folgen, 101348 und 136430): TMDB hat für beide Staffeln je 24 Folgen mit deutschen Titeln und Daten, Netflix meldet "Folge n". Ein Platzhalter ist kein Titelanker, die Laufzeit (je rund 24 min) und die Länge trennen die Staffeln nicht. Ohne Datum der Netflix-Zeilen trägt kein Anker; ein Erscheinungsdatum bei Netflix ist das der Plattform, nicht die Erstausstrahlung.
- Dangers in My Heart (25 Folgen, 153152 und 166216): TMDB Staffel 1 führt alle 25 mit deutschen Titeln; die zwei Cours trennt eine Datumslücke (18.06.2023 bis 07.01.2024). Netflix meldet "Karte n: …". Trägt das, wäre es ein Titelanker; ob "Karte"-Titel zu den TMDB-Titeln passen, ist ohne die Rohfolgen aus D1 nicht prüfbar. Eine Zuordnung nach Position bleibt gestrichen.
- Aussage: Vinland (24 Folgen) trägt kein Anker aus den vorhandenen Daten. Dangers (25 Folgen) möglich, aber unbelegt; entscheidet sich an einer Stichprobe der Netflix-Titel nach `meldungskopie holen`.

## JustWatch-Ton je Seite: Flagge „Deutsch“ für jeden Anbieter (16.10.2026)

Auftrag Daniel (16.10.2026): Nennt JustWatch an der Seite eines unserer Wege deutschen Ton, zeigt der Weg die Flagge „Deutsch“ (wie belegt), der Hover sagt „Deutsch laut JustWatch (Stand …)“. Anime und Cartoons, alle Anbieter.

- **Die Seite zählt, nicht die Zugangsart** (`pipeline/lib/jw-seite.ts`, `seitenSchluessel`): Amazon-gti, Crunchyroll-Serien- oder Folgenkennung, Disney+-Kennung (`entity-…` oder `series|movies/<slug>/<id>`). Kauf, Abo und Kanal auf derselben gti sind eine Seite; eine andere gti zählt nicht. Adressen ohne Kennung (`/gp/video/detail/<ASIN>`, Netflix, RTL+) bleiben außen vor. Befund jünger als 28 Tage (`BEFUND_MAX_TAGE`), ohne verfehlte Suche.
- **JustWatchs Serienton fasst alle Staffeln eines Anbieters zusammen.** Beispiel Fruits Basket (2019), Befund Daniel 16.10.2026, 18:19: Die Crunchyroll-Serienseite nennt laut JustWatch Deutsch, Staffel 1 hat aber nur Englisch, bei Prime hat Staffel 1 ebenfalls kein Deutsch. Deshalb **Flagge nur bei Filmen und Serien mit genau einer Staffel**, die kein anderer unserer Titel teilt (`nurSerie`). Mehrteiler, mehrere Staffeln (bei JustWatch oder in unserem Bestand) und Serien ohne Staffelangabe bleiben beim Hinweis (`dubHintOnly`), auch bei passender gti; Mehrteiler bekommen gar nichts. Cartoons mit mehreren Staffeln: der Hinweis je Staffel aus `cartoon-wege.ts` bleibt.
- **Rangfolge:** eigene Messung (Handbeleg, Meldung der Erweiterung, Messurteil; `bau/jw-seite-messung.ts`) vor JustWatch an der Seite vor der Annahme „Kanal so deutsch wie sein Anbieter“ (`kanal-erbt-anbieter.ts`: Flagge am Kanal-Weg oder JustWatch ohne „de“ an der Kanal-Seite verhindern das Erbe; ein bloßer Hinweis nicht).
- **Widersprüche und Wächter:** Widerspricht eine eigene Messung dem „de“ an derselben Seite, schreibt der Bau sie nach `daniel-zum-abarbeiten/listen/justwatch-widersprueche.md` (Titel, Anbieter, Adresse, JustWatch-Stand, Messung). Über 2 % Widersprüche unter den gemessenen Wegen eines Anbieters zeigt der Anbieter in diesem Bau nur den Hinweis, Logzeile `WÄCHTER …`. Seiten mit „de“ ohne unseren Weg stehen dort als „Kandidaten für neue Wege“; es entstehen keine Wege.
- **Wirkung (Bau-Vergleich 31ab95298 gegen 57ce51d8b, 16.10.2026):** Cartoons 68 neue Flaggen (Disney+ 51, Prime 15, RTL+ 1, Crunchyroll 1), 261 Staffel-Hinweise bleiben Hinweis; beim Hinweis wegen Serienangabe: mehrere Staffeln 187, Staffeln unbekannt 2, Mehrteiler 2. Anime: 2 Flaggen (Crunchyroll 1, Prime 1, die eine Prime-Flagge der alten Regel), Mehrteiler 1, Staffeln unbekannt 1. Wächter: Disney+ 0 von 37, Prime 0 von 4 gemessenen Cartoon-Wegen widersprechen. Kandidaten: Anime 8, Cartoons 49.
- **Warum bei Anime so wenig:** 786 von 833 Anime-Prime-Wegen tragen eine ASIN-Adresse statt der gti; selbst über `data/amazon-gti-belegt.json` (747 Paare) liegen nur 86 an einer JustWatch-Seite, 4 davon mit „de“, 2 ohne eigenes Urteil. Dazu liefen am 16.10.2026 1.399 Befunde vom 17.09. über die 28-Tage-Frist (gültig: 829 von 3.048); der Wochenlauf mit `--limit 800` erneuert sie erst nach und nach.

## aniSearch-Marke: der Dub-Abruf zieht die Einträge nach (17.10.2026)

`data/anisearch-eintraege.json` hält `dub` vom Zeitpunkt des Eintragsabrufs; `data/anisearch-dub-ids.json` ändert sich mit jedem Dub-Abruf. Kennung 18892 stand am 17.10. in der Liste auf „geplant“, im Eintrag auf „-“: `check-bild-und-synchro.ts` rot auf main, der Bestandsbau (Lauf 39017809268) brach daran ab. Sammler-PRs (`daten/`) überspringen die Prüfkette, deshalb fiel es erst nach dem Merge auf. Fix: `schreibeMarken` in `fetch-anisearch-dubs.ts` zieht `dub` der Einträge auf die Liste nach, Test `check-anisearch-marke-nachziehen.ts` fährt den ganzen Abruf gegen eine Kulisse. Lehre: Was derselbe Sammler in zwei Dateien ablegt, schreibt er im selben Lauf; eine Prüfung, die zwei Sammler-Dateien vergleicht, ist nur grün zu halten, wenn der Schreiber sie gleichzieht.

## Belege auf API-Adressen: Messung statt Link (19.10.2026)

Madoka Magica: Der Reiter „ADN API“ trug nur „Quelle: ADN API.“, „Originalseite“ führte auf `gw.api.animationdigitalnetwork.com/video/calendar` (400 Bad Request ohne `date`). Ursache: `ADN_CALENDAR_URL` steht in `sources` und `quellen` jedes ADN-Termins (`07-adn.ts`), `belegeVonRelease` machte daraus einen Beleg ohne Inhalt, `beleg-dialog.tsx` verlinkte `beleg.url`. Bestand 19.10.2026: 116 `releases.quellen`, 114 `sources`, 6 News-Belege, 141 Zeilen in `quellen-historie.json`; andere API-Hosts gibt es nicht. Jetzt: `pipeline/lib/beleg-api.ts` baut aus dem Termin eine Messung (Serie, gezählte Folgen, Datum, Sprache Deutsch; `am` = Abruftag; Folgennummern nur mit `firstEpisodeNumber`, 1 von 116 Terminen am 19.10.2026) und als `seite` die Serienseite; `shared/quelle.ts` `istApiAdresse`/`istLink`/`belegLink` machen eine API-Adresse nie zum Klickziel (Beleg-Fenster, Quellenübersicht, Panel, Mail). Wächter: `apiBelegFehler` in `belegFehler` (bricht den Bau), `check-beleg-api.ts` in `check:logic`. Offen: 91 News-Belege (19.10.2026) tragen nur „Quelle: X.“ (Händler-, TV-, Katalogseiten; Link funktioniert, kein Inhalt).

**Katalog-Adresse und Lesetag (Prüfer 1598 R1, 19.10.2026):** 107 der 114 ADN-API-Termine trugen die Kalender-Adresse, ihre Serie stand aber nur in `adn-catalog.json`. Jetzt setzt `07-adn.ts` für `fromCatalog`-Serien `adnKatalogUrl(showId)` (`…/video/show/<id>`, `grundlagen.ts`), der Beleg heißt „ADN-Katalog“, `belegTyp` = katalog. `messung.am` ist `Quelle.gelesenAm` (Tag des Abrufs, `bau/adn-lesetag.ts`: Kalender = `adn.json scrapedAt` nur für Serien darin; Katalog = jüngerer von Serienstand und `adn-catalog.json scrapedAt`), nicht `gesehenAm` (Erstsichtung, bei 104 Terminen 01.10.). Bauvergleich 4c00481db gegen 5233a813f am Bestand 19.10.: Kalender-Adresse ohne Serie im Kalender 107 → 0; 114 Quellen mit `gelesenAm`; die alte Kalender-Quelle bleibt in der Historie als `vermutlich-ueberholt` (überholte Belege 203 → 310, keine mit „Termin verschoben“); 6 News-Belege `messung.am` 17.10. → 19.10.; die Oberfläche liest `quellen.stand` nicht. Seit R3: einen Lesetag (und damit einen Beleg) gibt es nur, wenn Datum und gezeigte Uhrzeit des Termins unter den Folgen der Serie im Abruf stehen (`datumImAbruf`); ein kuratierter Termin mit Kalender-Adresse kann sein Datum sonst aus einem Artikel haben. Am Bestand 19.10.: alle 114 ADN-API-Termine stehen mit Datum im Abruf, das Tor ändert heute nichts. Seit R4: `adn.json` reicht 45 Tage zurück; bestätigt der heutige Abruf das Datum nicht mehr (Fenster, gescheiterter Abruf), bleibt der Lesetag aus der Quellen-Historie, wenn der Abruf, der ihn gesetzt hat, dasselbe Datum bestätigte (`behalteLesetag`; `mitLesetag` setzt dazu `Quelle.bestaetigt`). Nicht `sagt`: `quellenZusammenfuehren` hält die erste Aussage fest, und 125 ADN-Quellen der Historie tragen dort noch unseren Termin aus der Zeit vor „kein `sagt`“ (Prüfer 1598 R5). Grund: `belegeVonRelease` baut auch ältere Meldungen aus den aktuellen Quellen. Simulation mit wanderndem Datum am Bestand 19.10.: ohne Historie ab 03.12. 111 von 114 (drei Bleach-Filme vom 12.10.), mit Historie 114; am 18.12. 113 (Madoka wechselt auf die Katalog-Adresse, die Serie fehlt im Katalog).

## JustWatch-Wiedervorlage hängt an der Flagge, nicht an der Marke (17.10.2026)

„Deutsch laut JustWatch" gilt nur bei einem Befund unter 28 Tagen (`BEFUND_MAX_TAGE`); die Wiedervorlage erneuert ihn 7 Tage früher. Sie fragte aber nach `dubQuelle === 'justwatch'` am Weg, und diese Marke gibt es nur, solange die Flagge gilt. Fall Your Name (Titel 21519): Befund 17.09.; im Wochenlauf vom 12.10. (Alter 25 Tage) trug der Weg die Marke noch nicht (die Seiten-Regel kam am 16.10.), danach lief der Befund am 15.10. ab, die Flagge fiel weg, und ohne Marke holte ihn auch die Wiedervorlage nicht mehr. Jetzt: `titelMitJwFlagge` (`pipeline/lib/jw-wiedervorlage.ts`) nimmt jeden Titel, dessen Weg ohne eigenes Urteil an einer Seite mit JustWatch-„de" steht (Alter egal). Anime: nur Mehrteiler ausgenommen (Serien mit mehreren Staffeln bekommen im Bau den Hinweis). Cartoons: jeder Serien-Grund ausgenommen (`nurSerie` mit eigenen Staffeln), weil `kennzeichneCartoonJwSeiten` solchen Wegen weder Flagge noch Hinweis gibt. Die Warteschlange selbst steht in `pipeline/lib/jw-schlange.ts`.

Messung am Stand 17.10. (Spiegelabgleich Auswahl gegen Marke `dubQuelle === 'justwatch'`, Titel): Auswahl 80 (Anime 12, Cartoon 68); Marke 162 (Anime 2, Cartoon 160); beides 70 (2 / 68); Auswahl ohne Marke 10 (alle Anime); Marke ohne Auswahl 92 (alle Cartoon, davon 91 „mehrere Staffeln", 1 Mehrteiler). Diese 92 tragen die Marke aus dem Cartoon-Staffel-Hinweis (`bau/cartoon-wege.ts`, `dubHinweis` in `bau/nebendateien.ts`), der das Befundalter nicht prüft — sie verlieren die Wiedervorlage ohne Schaden; wären sie drin, kostete es Abrufe (Erneuern alle 21 statt 28 Tage) und verdrängte dringende Anime. Abgelaufene Wege (Weg ohne Urteil, de-Seite, Befund ab 28 Tagen): 25 Wege auf 20 Titeln (13 Anime, 7 Cartoon); davon 22 ohne die 3 Mehrteiler-Wege (der Prüfer zählt 22 / 17 Titel, ohne Mehrteiler), und genau 10 Titel (alle Anime, Your Name einer) kommen durch die neue Auswahl zurück, die 7 Cartoons mit Serien-Grund bleiben ohne Flagge, wie im Bau vorgesehen.

Wochenlauf 12.10.: 2.433 offen, 800 geholt in 16,5 min (1,24 s je Titel, kein 429); Bestand 3.048 Befunde, 1.006 gültig, 2.042 fällig. Simulation (Lauf je Montag, `--limit 800`, Reihenfolge Wiedervorlage, dringend, ältester zuerst), gültige Befunde der 80 Flaggen-Titel vor dem Lauf: alt (Marke) 70 bis 80, neu immer 80 ab dem 26.10. Der Abstand ist klein, weil die Auswahl klein ist: Der Gewinn sind die 10 Anime ab 19.10. und dass keine Flagge mehr unbemerkt ausläuft. Ein höheres `--limit` (1200) ändert daran nichts: die Gesamtzahl schwingt zwischen 1.848 und 2.858 (Wellen der ältesten Kohorte).

## Prime-Kauf/Leihe als Stream-Pille: zwei Lücken geschlossen (23.10.2026)

Anlass: „All You Need Is Kill" (Titel 187892, Panel `/t/16669/`) zeigte nur Blu-ray und „Kaufen bei Amazon", obwohl Prime Video den Film seit dem Disc-Start (22.10.) zum Leihen und Kaufen führt. JustWatch ist die einzige maschinelle Quelle für Prime (MOTN gibt es für Prime nur über das knappe Monatskontingent, die Erweiterung ist Handarbeit). **Ursache 1 (Bau):** `bau/11-2-2-wege-ohne-weg.ts` legt Kauf-/Leih-Wege nur für Titel ohne jeden Weg an, `11-2-3-abo-wege.ts` nur Flatrate, und die Runde „auch Titel mit Wegen" (`11-2-justwatch.ts`) überspringt Amazon (`providerToPlatform`). Ein Film mit einer Blu-ray-Zeile von aniSearch bekam deshalb nie einen Prime-Kauf, auch wenn JustWatch ihn kannte. **Ursache 2 (Abruf):** Befund von 187892 vom 17.09. (nur Kino); der Reihum-Lauf fragt jeden Titel alle 28 Tage, 800 von rund 3.000 je Wochenlauf — Kauf- und Leihangebote erscheinen mit Kinoende oder Disc-Start und wären erst bis zu 5 Wochen später gekommen.

**Behoben:** (1) `bau/11-2-4-kauf-wege.ts` (`ergaenzeKaufWege`, aufgerufen in `legeWegeAn`): JustWatch-Angebot „Amazon Video"/„Amazon Prime Video" mit Art `BUY`/`RENT` und deutschem Ton am Angebot → Stream `primevideo`, `zugang: 'kauf'`, `herkunft: 'justwatch'`, kein `dub` (Umriss „Deutsch laut JustWatch" über `11-6`). Riegel: kein anderer Prime-Weg, kein entfernter Prime-Verweis (Abgang bleibt), kein Nein-Handbeleg, kein belegtes Nein in `data/verweise-entfernt.json`, keine gti, die JustWatch bei mehreren Titeln führt. `herkunft: 'justwatch'` hält den Weg aus der Meldung „Jetzt auch auf Deutsch bei …" (`news.ts`, `meldetNeu`): ohne das erschien beim ersten Bau eine rückdatierte Meldung. (2) `lib/jw-frische.ts` + `lib/jw-schlange.ts`: Titel mit Kino- oder Disc-Termin von 90 Tagen zurück bis 3 Tage voraus kommen alle 3 Tage an die Reihe, solange der Befund kein Prime-Kauf/-Leihe kennt; sie stehen in der Schlange vorn (`vor`). (3) `refresh-data.yml`, Schritt „JustWatch — frische Kino- und Disc-Titel" (`npm run data:justwatch-frisch`, `--alter 100000 --limit 60`, täglich 04:00 durch den Wecker, montags übersprungen: der Wochenlauf fragt die frischen Titel mit, zwei Läufe kurz hintereinander lösten am 23.09.2026 ein 429 aus). Kein neuer Host, kein MOTN-, kein AniList-Abruf.

**Gemessen (Welt: `public/data` und `data/justwatch-audio.json` von main am 23.10.2026; Vergleichsbasis: main `a2f25ebce4c3`, `tools/bau-vergleich.mjs`):** 29 neue Prime-Kauf-/Leihwege (`titles.json`, 3 davon in `titles-core.json`), „Deutsch laut JustWatch" 54 → 57 Wege, „Kandidaten ohne Weg" 417 → 414, keine Änderung an `news.json`, `entfernteStreams` oder Terminen. JustWatch führt 300 Titel mit Amazon-Video-Kauf/-Leihe und deutschem Ton, davon 240 mit Prime-Weg, 43 ohne (ohne Abgang, Nein, geteilte gti: 29). Frische Titel (23.10.): 77, davon 57 mit Befund, 32 fällig (Alter 4 bis 36 Tage) — der erste Tageslauf holt sie, danach höchstens ein paar je Tag. 187892 selbst bekommt den Prime-Kauf, sobald JustWatch ihn mit deutschem Ton führt; der erste Tageslauf fragt ihn ab (Befund 36 Tage alt, Kino 29.09., Disc 22.10.). **Offen:** ob JustWatch bei 187892 `audio: de` meldet, ist von hier nicht abgerufen (kein Abruf bei Streaming-Anbietern vom Rechner). Titel mit entferntem Prime-Verweis (4 im Probebau) bleiben bewusst Abgang; `ERSATZ_TOTER_AMAZON_LINKS` in `11-4-ausgaben.ts` ist aus.

**Nachbesserung 24.10.2026 (Datenbau rot: 26 × `luecke|primevideo` in `sprache-netz-bestand-pruefen`):** Der Kaufweg kam ohne Kennzeichnung „Deutsch laut JustWatch" in den Bestand, weil `kennzeichneJwSeiten` nur Befunde jünger als `BEFUND_MAX_TAGE` (28 Tage), Adressen mit gti und keine Mehrteiler kennzeichnet. 585, 597, 4447, 14837, 20978 hatten Befunde vom 16./17.09. (38 Tage), die Prüfliste der Erweiterung nimmt sie nicht auf (Wahl (b), nicht (a): die Quelle trägt die Sprache, sobald der Befund frisch ist). `ergaenzeKaufWege` legt den Weg deshalb nur an, wo `wirdGekennzeichnet` zutrifft (dieselben drei Bedingungen, Parameter `heute`); ein veralteter Befund legt ihn erst nach dem nächsten Abruf an. Simulation (Welt: `public/data/titles.json` und `data/justwatch-audio.json` von main am 24.10.2026, Vergleichsbasis: derselbe Lauf mit dem Stand davor): 53 → 8 Kaufwege, „Sprache offen" ohne Kennzeichnung 45 → 0.

## Meldungs-Auffälligkeiten: ein Eintrag lebt so lange wie sein Befund (19.10.2026)

`fetch-pruefungen.ts` führt `data/meldungs-auffaelligkeiten.json` bei jedem Lauf mit Meldungen nach (`pipeline/lib/meldungs-auffaelligkeiten.ts`): Jeder bisherige Eintrag wird gegen den geladenen Bestand neu geprüft (`trifftNochZu`: Folgenzahl des Titels bzw. Staffelnummer in der Reihe) und bleibt samt Datum, solange er zutrifft, auch wenn seine Meldung längst abgehakt ist. Neue Befunde des Laufs kommen mit dem heutigen Tag dazu, was nicht mehr zutrifft (Titel geändert, Zuordnung geändert, Text unlesbar), fällt weg. Ein Lauf mit nur harmlosen Meldungen löscht also keinen offenen Befund; ein Lauf ganz ohne Meldungen beendet sich vorher und lässt die Datei, wie sie ist. Die 60-Tage-Kürzung entfällt. Befund ist: mehr Folgen gemeldet als der Titel (Abweichung über max(2, 25 %)) und der Staffel-Widerspruch. **Weniger gemeldet als der Titel ist bei keinem Anbieter ein Befund** (Seite = Staffel, Titel = ganze Serie; vorher nur Netflix ausgenommen). Der Text nennt neben der Kennung den Namen (`Titel 123 (Name)`). Die Bau-Warnung „N neue Meldung(en) auffällig (M offen)“ kommt nur, wenn der Lauf einen neuen Befund hinzufügt; offene Altbefunde bleiben samt Datum still in der Datei. Am Stand 19.10.: 762 → 93 Einträge (669 „weniger“, 60 „mehr“, 33 Staffel), alle 93 treffen am Bestand noch zu. Prüfung: `pipeline/check-meldungs-auffaelligkeiten.ts` (in `check:logic`, drei Läufe gegen eine Attrappe).

## Telekom-Zwilling: Videoload übernimmt gemessenes Deutsch (19.10.2026)

Anlass: „Your Name“ (21519) zeigte bei Videoload „Deutsch angenommen“, obwohl MagentaTV mit derselben Gracenote-Kennung laut JustWatch deutschen Ton trägt (Bericht `daniel-zum-abarbeiten/berichte/telekom-annahme-messen.md`). Der Zwilling, den der Abschnitt vom 13.10. nur als Prüfweg nannte, ist jetzt der Beleg.

- **Regel** (`uebernehmeZwilling` in `pipeline/lib/telekom-annahme.ts`, am Anfang von `setzeTelekomAnnahme`, aufgerufen in `bau/11-2-justwatch.ts`): Ein Videoload-Weg eines Films ohne eigene Angabe übernimmt die `dubRanges` des MagentaTV-Wegs mit gleicher `GN_…`-Kennung, wenn dieser gemessen ist (reine Deutsch-Bereiche, kein `dubAbgeleitet`). Der Weg trägt dann keine Kennzeichnung und zeigt „✓ Deutsch“; die Spur zur Messung ist die gemeinsame Kennung in beiden Adressen.
- **Nicht:** Serien (JustWatch-Ton gilt nur je Staffel, Regel 07.09.2026; Ansatz A2 bewusst nicht umgesetzt) und Wege ohne Kennung (themoviedb-Adresse); sie bleiben „Deutsch angenommen“.
- **Wächter:** `check-telekom-annahme-bestand.ts` (`zwillingFehler`): Annahme neben gemessenem Zwilling gleicher Kennung ist rot (Soll 0).
- **Legende:** „…gilt als deutsch; belegt ist die Tonspur dort nicht.“ (vorher „zu diesem Titel nennt er keine Tonspur“, in 147 Fällen falsch).

## Streaming Availability API: ein Monatslauf je Monat, Reserve für den Tageslauf (23.10.2026)

Am 23.10. um 04:01 UTC startete der Wecker `tonspuren-monatlich` ein drittes Mal im Oktober: `startErlaubt` prüfte bei `nachholen` nur den Abstand (14 Tage) zum Handlauf vom 08.10. Der Lauf verbrauchte 655 Anfragen in fünf Minuten, danach meldete die Quelle 209 von 1.000 übrig (Mails von Movie of the Night bei 50 % und 75 %). Seither sperrt ein nicht abgebrochener Lauf im selben UTC-Monat jeden weiteren Wecker-Start (`shared/weckplan.ts`), und `fetch-motn.ts` hört bei 130 Restanfragen auf (`RESERVE`), damit `fetch-motn-changes` (4 je Tag) bis zum Reset am Ersten auskommt. `motn-links.ts` ruft die API nicht.

## Netflix: eine Serie, zwei Kennungen — Umleitung statt eigener Reihe (24.10.2026)

Netflix führt Ranma ½ (2024) mit allen drei Staffeln unter 81171925; 81301833 öffnet dieselbe Seite und springt auf die erste Kennung (Daniel, F56). AniList lieferte noch die alte Kennung für Staffel 1 und 2. Umleitungen stehen in `NETFLIX_UMGELEITET` (`pipeline/lib/netflix-adresse.ts`, wie die Wunschadressen), `netflixTitelAdresse()` führt jeden Verweis auf die neue Kennung. Die Umleitung hat keinen Eintrag in `data/anbieter-staffeln.json`. `pipeline/check-netflix-umleitung-bestand.ts` (check:bestand) und `check-netflix-umleitung.ts` (check:logic) sperren Umleitung als Verweis oder Reihe sowie zwei Kennungen einer Franchise, deren Staffelliste (mindestens zwei Staffeln) der Anfang der anderen ist. Neue Umleitung nur mit Beleg eines Menschen eintragen (kein Netflix-Abruf).

**Quellen nennen verschiedene Kennungen (25.10.2026).** Bei sieben Titeln (Chihiro 199, Nausicaä 572, Arrietty 7711, Ultramarine Magmell 101597, Saiki K Reawakened 112625, Grimm Variations 135643, Kakegurui ×× 100876) nennen Datensatz (= AniList-Verweis), aniSearch und JustWatch nicht dieselbe Netflix-Kennung. Welche stimmt (Umleitung oder zweite Seite), kann nur ein Mensch auf Netflix sehen; die Titel stehen deshalb in `data/erneut-melden.yaml` (Prüfliste der Erweiterung). `pipeline/check-netflix-quellen-bestand.ts` (`check:bestand`, Warnung, Exit 0) zählt solche Titel mit `lib/netflix-quellen-abweichung.ts` und warnt für jeden, der nicht auf der offenen Netflix-Prüfliste (`public/data/pruefstand.json`) steht. Entscheidet ein Mensch „Umleitung“, kommt sie in `NETFLIX_UMGELEITET`; die Warnung verschwindet dann, weil Umleitungen vor dem Vergleich aufgelöst werden. Sonst bleibt der Titel auf der Prüfliste, bis eine Meldung angekommen ist, und fällt danach wieder als Warnung auf, bis jemand entschieden hat. **Automatische Ableitung nicht möglich (Messung 25.10.2026):** Die Prüfliste der Erweiterung ist nach der Datensatz-Kennung geschlüsselt (`extension/offene-netflix.js`), die zweite Kennung (aniSearch/JustWatch) wird nie aufgerufen und gemeldet. Von den 14 Kennungen der sieben Titel steht keine der sieben zweiten in `link-check.json`, `dub-confirmed.yaml` oder `pruefstand.json` (nur in `anisearch.json`, teils `justwatch-audio.json`/`motn-links.json`); ohne Ergebnis für beide Seiten gibt es nichts abzuleiten. Voraussetzung wäre, die zweite Kennung als zweites Ziel auf die Prüfliste zu legen (Änderung der Erweiterung).

## ADN: Kalenderserien ohne Katalog und Liste (24.10.2026)

`adn-catalog.json` und `adn-anisearch-offen.json` betreffen nur Katalogserien (nur mit `vde`, Zuordnung im Katalog-Lauf). Serien aus `adn.json` (Kalender) sind davon nicht erfasst: Am 24.10. fehlten 5 von 12 in beiden Dateien (Dreamland 887, Madoka-Serie 1318 und Filme 1319–1321). Dreamland: im Archiv ohne `vde` (12.10.), `--laufend` fragt Archivserien nicht neu; der Wochenlauf holt sie nach, in dem Bau steht sie ohne Titel (Warnung `entferneOhneTitel`, kein AniList-Titel im Bestand). Madoka: Katalog-Lauf hinkt. Absicht, kein stiller Verwurf; `check-adn-anisearch.ts` gibt die Lücke als `::warning::` aus (`kalenderOhneNetz`), ohne Fehler, weil eine neue Serie bis zum nächsten Lauf fehlen darf.

## ADN: französische Sicht überschrieb 24 Archive (28.10.2026)

Lauf `adn-laufende.yml` vom 28.10.2026 14:01 UTC (Commit 4b8f4c268) schrieb für 24 Serien (1125 1160 1208 1311 1338 1375 1381 1427–1434 213 307 340 347 444 561 732 887 970) in `data/adn-raw` nur `vostf`/`vf` statt `vostde`/`vde`; die Titel blieben deutsch. Sammlercode und Kopfzeilen (`X-Target-Distribution: de`, `Accept-Language: de`) waren unverändert, die Läufe 02:01 und 08:00 UTC in Ordnung, und in den 14 Archiv-Commits seit dem 24.10. ist es der einzige mit französischen Kürzeln. Ursache liegt also bei ADN: es lieferte in diesem Lauf bei allen 24 erreichten Serien die französische Sicht (Log: „24 von 26 laufenden Serien aufgefrischt“, kein Fehlerstatus). Riegel: `pipeline/lib/adn-sprachriegel.ts` — eine Antwort mit französischen und ohne deutsches Kürzel wird verworfen, das alte Archiv bleibt; die Bilanzzeile „ADN-Sprachriegel: n Serien …“ steht im Laufprotokoll, mehr als 5 verworfene Serien färben den Schritt rot. Bestandswache: `check-adn-gedaechtnis.ts` (läuft im Lauf-Schritt „Zusicherungen prüfen“ und in `check:bestand`) ist rot, sobald ein Archiv nur französische Kürzel trägt. Test: `pipeline/check-adn-sprachriegel.ts` mit wörtlichem Ausschnitt aus 4b8f4c268~1 und 4b8f4c268 (`pipeline/fixtures/adn-sprachriegel-ausschnitt.json`).


**Katalog (28.10.2026):** `adn-catalog.json` verliert eine Serie nur noch durch eine frische, vollständige Antwort ohne `vde`/`vostde`. Wer in dem Lauf nicht gefragt wurde (`--limit`, Abbruch nach fünf Fehlern) oder abgebrochen hat (5xx, Zeitüberschreitung, französische Sicht), behält den alten Eintrag (`mitUngepruftenAlten`); die Logzeile `ADN-Katalog behalten: N nicht gefragt, N Abbruch, N entfernt` nennt jeden Weg. Gemessen an 160f62e0a (26.10.): 0 Serien verloren (alle 113 alten Einträge wurden gefragt), der Fehler war latent.

## Fremdzuordnung: Wächter für Seiten an Titeln verschiedener Reihen (29.10.2026)

`check-zuordnung-fremd-bestand.ts` meldet zusätzlich jede Prime-/Plattform-Seite in `prime-zugeordnet.json`, an der Titel mit verschiedener `franchiseId` liegen (Meldung nennt beide Besitzer samt „laut Adresse Staffel k“ aus dem Handbeleg). Gemessen am Bestand 29.10.2026 (355418756): 37 Seiten mit mehreren Kennungen, alle gleiche Reihe (Staffelseiten, legitim) → 0 Funde. Verworfen: „mehrere Kennungen an einer Seite“ (37 falsch-positiv) und „Folgenzahl der Seite ≫ Folgen des Titels“ (Belegnotiz „alle N Folgen“ größer als `episodes`: 225 von 1.803 Belegen, ≥ doppelt 36, überwiegend ganze Reihenseiten wie Slime, JoJo, Space Dandy).
