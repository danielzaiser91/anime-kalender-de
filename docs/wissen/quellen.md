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
Seite, Folgenzahl weicht grob ab) nach `data/meldungs-auffaelligkeiten.json` und macht den
Bau gelb. Der Rest dieses Abschnitts beschreibt, warum das Nein weiter zwei Quellen braucht.

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
eine `anilistId` (dieselbe Zuordnung, aus der die übrigen ADN-Adressen
stammen), und `data/adn-adressen.yaml` hält die wenigen Serien fest, die er
gerade nicht führt. Ein zweiter Namensabgleich wäre hier der falsche Weg — die
Fallen stehen weiter oben (`To Love-Ru`, `Wolf's Rain OVA`).

**Ein Folgenverweis wird dabei nicht angefasst.** `…/clannad/12851-folge-24-…`
nennt eine Folgen-Id aus ADNs alter Ablage; an eine neue Serienkennung gehängt
entstünde eine Adresse, die niemand geprüft hat, und der Verweis verlöre seine
Aussage über genau diese Folge.

### Eine Nebenausgabe hat bei Crunchyroll oft zwei Blöcke — und nur einer ist der richtige

Gemessen am 13.09.2026 von Daniel an zwei Titeln, beide mit Bild:

| Titel | Block | Folgen | Fassung |
|---|---|---|---|
| Chunibyo Heart Throb | „(German Dub)“ | 13 = Staffel 12 + OVA als S2 E13 | Synchro |
| Chunibyo Heart Throb | „(OVA)“ | 1 | nur Untertitel |
| Durarara!! | Serie | 25 = 24 + eines der Specials | Synchro |

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
`daniel-zum-abarbeiten/18-suchadressen.md`. Bei Prime kann die Frage niemand
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
