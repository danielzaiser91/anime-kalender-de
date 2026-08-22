# Recherche: Datenquellen für deutsche Anime-Releases

Stand: 07.08.2026. Alle Angaben selbst geprüft (API-Call oder Seitenabruf), außer wo „ungeprüft" steht.

## Kernbefund

Es gibt **keine offene API, die deutsche Synchro-Termine mit Uhrzeit liefert**. Das Wissen liegt
verstreut: „Gibt es überhaupt einen Dub?" ist maschinenlesbar, „Wann genau läuft Folge 7 auf Deutsch?"
nicht. Deshalb wird der Kalender aus drei Schichten gebaut:

1. **Metadaten** — vollautomatisch (AniList, TMDB)
2. **Dub-Existenz** — vollautomatisch (MyDubList)
3. **Termine/Uhrzeiten/Plattform-Deeplinks** — kuratierter Datensatz im Repo, halbautomatisch befüllt

---

## Schicht 1 — Metadaten

### AniList GraphQL API — **gesetzt**
`https://graphql.anilist.co`, kein API-Key, 90 Requests/Minute, GraphQL.
Geprüft mit `idMal: 52991` (Frieren) — liefert in einem einzigen Call:

| Feld | Nutzen im Projekt |
|---|---|
| `genres` | Genre-Tags (Action, Fantasy, Drama …) |
| `tags{name,rank,isMediaSpoiler}` | **Keyword-Tags** — enthält exakt „Female Protagonist", „Male Protagonist", „Isekai", „Time Skip" u. v. m. mit Relevanz-Rank und Spoiler-Flag |
| `externalLinks{site,url,type}` | Direktlinks zu Crunchyroll, Netflix, Prime Video, Disney+ (`type: STREAMING`) |
| `season`, `seasonYear`, `startDate`, `episodes`, `status` | Season-Zuordnung, Episodenzahl |
| `coverImage`, `averageScore`, `studios` | Cover, Score, Studio |

Der `language`-Wert an `externalLinks` ist bei Streaming-Einträgen `null` — die Links sind global.
Crunchyroll-URLs lassen sich verlässlich auf `/de/` umschreiben, Netflix-`/title/<id>` ist ohnehin
länderneutral.

Spoiler-Tags (`isMediaSpoiler: true`) werden im UI standardmäßig ausgeblendet.

### TMDB API — **optional, für FSK + Plattform-Fallback**
Kostenloser API-Key nötig. Relevant:
- `/tv/{id}/content_ratings` → deutsche Altersfreigabe (Land `DE`); Abdeckung bei Anime lückenhaft
- `/tv/{id}/watch/providers` → Anbieter in Region DE (flatrate/rent/buy) + JustWatch-Link
Kein Deeplink direkt zur Serie beim Anbieter, nur zur JustWatch-Seite.

### Jikan / MyAnimeList
Nur als ID-Brücke relevant (MyDubList arbeitet mit MAL-IDs, AniList kann per `idMal` auflösen).
Keine deutschen Daten.

---

## Schicht 2 — Existiert eine deutsche Synchro?

### MyDubList — **gesetzt**
`https://github.com/Joelis57/MyDubList`, Lizenz **CC BY 4.0** (Namensnennung Pflicht).
Geprüft: `dubs/confidence/{low,normal,high,very-high}/dubbed_german.json` — eine Liste von MAL-IDs,
ca. 3.080 Einträge Deutsch. Confidence-Stufen = Anzahl unabhängiger Quellen (low ≥1 … very-high ≥4).
Quellen laut Projekt: MAL, AniList, ANN, aniSearch, Kitsu, HiAnime, kuratierte Community-Listen.
Täglich aktualisiert.

Enthält **nur** die Ja/Nein-Information — keine Termine, keine Plattform.

---

## Schicht 3 — Termine, Uhrzeiten, Plattform

Hier ist Handarbeit unvermeidbar. Bewertete Quellen:

| Quelle | Was sie liefert | Automatisierbar? |
|---|---|---|
| **Crunchyroll Simulcast-Kalender** (`crunchyroll.com/de/simulcastcalendar`) | Wochenansicht mit Episoden **inkl. Uhrzeit**, Dub-Einträge separat markiert | ❌ liefert 403 gegen Bots (Cloudflare). Nur per Browser-Automation oder Handarbeit |
| **aniSearch.de Simulcast-Übersicht** (Saison-News-Artikel) | Titel + Startdatum + Plattform, pro Saison einmal | ⚠️ Kein Datum/Uhrzeit pro Folge, keine Dub/Sub-Trennung im Artikel. robots.txt blockt Scraper-Tools, ClaudeBot/GPTBot sind nicht gesperrt |
| **Anime2You** (`anime2you.de`) | Sehr aktuelle News zu Synchro-Starts, monatliche DVD/Blu-ray-Übersichten | ⚠️ Fließtext, RSS vorhanden — gut als Änderungs-Melder, schlecht als Datenquelle |
| **AnimeSchedule.net API v3** | Sauberes Schema, `dubPremier`/`dubTime`, Streams, Genres | ❌ „Dub" heißt dort ausschließlich **englischer** Dub |
| **JustWatch (inoffizielle GraphQL-API)** | Anbieter + **Deeplinks** + Kauf/Leih-Preise für Region DE | ⚠️ Inoffiziell, ToS-Graubereich, kann jederzeit brechen |
| **FSK-API** (`fsk.de`) | Offizielle Freigaben, >500.000 Titel | 💰 B2B-Produkt, kostenpflichtig. Kostenlose Websuche auf fsk.de vorhanden |
| **Amazon.de Anime-Neuheiten** | Kauf-/Disc-Releases mit Datum | ⚠️ PA-API braucht Affiliate-Konto; sonst nur Suchlinks |
| **AnimeNachrichten Simulcast-Kalender** | — | ❌ letzte Aktualisierung April 2021, tot |

### Konsequenz: Termine als Regel statt als Einzelereignis

Statt jede Folge einzeln zu pflegen, speichert der kuratierte Datensatz pro Staffel eine **Regel**:

```yaml
releaseType: weekly        # weekly | batch | movie | disc
platform: crunchyroll
firstEpisodeDate: 2026-01-08
time: "17:30"
weekday: thursday
episodeCount: 24
```

Daraus generiert der Build alle Einzeltermine. Eine Zeile Pflege pro Staffel statt 24.
`batch` (Katalogtitel: ganze Staffel auf einen Schlag, typisch Netflix/Disney+) erzeugt genau
einen Termin, `disc` ebenfalls (mit Kauf-Link).

---

## Google Calendar

Zwei Wege, beide **ohne Google-API und ohne OAuth**:

1. **Ein Termin per Klick** — Template-URL:
   `https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=20260108T163000Z/20260108T170000Z&details=…&location=…`
2. **Ganzes Abo** — statisch generierte `.ics`-Dateien (gesamt + pro Plattform + pro Genre), die in
   Google Calendar unter „Per URL hinzufügen" abonniert werden. Aktualisiert sich dann von selbst.
   Zusätzlich Einzel-`.ics`-Download für Outlook/Apple.

---

## Newsletter

Braucht als einziges Feature einen Server (Abonnenten speichern, Cron, Versand).
DSGVO: **Double-Opt-in Pflicht**, Abmeldelink in jeder Mail, Impressum + Datenschutzerklärung.

| Baustein | Empfehlung | Alternative |
|---|---|---|
| Runtime | Cloudflare Worker (Free: 100k Req/Tag, 3 Cron-Trigger) | Vercel Functions + Vercel Cron |
| DB | Cloudflare D1 (SQLite, Free-Tier reicht um Größenordnungen) | Neon/Supabase Postgres |
| Versand | Resend (3.000 Mails/Monat frei, **eigene Domain nötig**) | Brevo (300 Mails/Tag frei, verifizierte Absenderadresse reicht) |

Cron: täglich 07:00 (Tages-Digest) und montags 07:00 (Wochen-Digest), Europe/Berlin.

---

## Empfohlener Stack

```
Frontend    Vite + React + TypeScript + Tailwind, eigenes Wochen-Grid
Daten       JSON im Repo, erzeugt von TS-Skripten (pipeline/)
Aktualität  GitHub Action nightly: AniList + MyDubList + TMDB neu ziehen, committen
Hosting     GitHub Pages (statisch, kostenlos)
Newsletter  Cloudflare Worker + D1 + Cron + Resend/Brevo
Kalender    ICS-Feeds statisch + Google-Template-Links clientseitig
```

Der Kalender funktioniert damit **vollständig ohne Backend**. Der Worker ist ein optionales
Anbauteil, das nur der Newsletter braucht.

---

## Netflix + deutsche Tonspur: welche Quelle kann das? (Stand 22.08.2026)

Frage ist nicht „gibt es eine deutsche Synchro" (gelöst über AniList-Sprechrollen, ANN,
MyDubList), sondern **„läuft die deutsche Fassung auf Netflix"** — Plattform und Sprache
zusammen. Alle Angaben unten am 22.08.2026 selbst geprüft, außer wo „ungeprüft" steht.

| Quelle | Audio-Sprache? | DE? | Kosten | Bedingungen | Urteil |
|---|---|---|---|---|---|
| **Streaming Availability API** (Movie of the Night) | **ja**, `audios`/`subtitles` je Streaming-Option und Folge | ja (66 Länder, Netflix DE gelistet) | 1.000 Anfragen/Monat frei, ab 49 USD für 25.000 | Speichern + Anzeigen erlaubt, Quellenangabe Pflicht, kein Weiterverkauf | **angebunden, bleibt erste Wahl** |
| **uNoGS** (`/titlecountries`, RapidAPI `unogsng`) | **ja**, `audio` + `subtitle` je Land | ja | BASIC 100 Anfragen/**Tag** frei, Überzug 0,10 USD je Anfrage; PRO 10 USD/Monat für 30.000 | Website-ToS verbietet „republish" und kommerzielle Verwertung | **nicht messen** — Bestand sichtbar verwahrlost, ToS gegen uns |
| **JustWatch** (GraphQL, robots.txt erlaubt alles) | Feld `audioLanguages` vorhanden — **bei Netflix leer** | ja | — | ToS-Graubereich | **erledigt, gemessen** |
| **TMDB** `/watch/providers` | **nein** | ja | frei | Quellenangabe „JustWatch" Pflicht | ausgeschlossen |
| **Watchmode** | **nein** (kein `audio` in der OpenAPI 1.1.7) | ja (54 Länder) | frei 2.500/Monat, nicht kommerziell, max. 3 Länder, Cache-Löschpflicht nach 30 Tagen; bezahlt ab 349 USD/Monat | Quellenangabe Pflicht auf Free | ausgeschlossen |
| **Reelgood Partner API** | keine Angabe zu Audio | 25+ Länder | kein Listenpreis, nur Vertrieb | Lizenzvertrag | ausgeschlossen |
| **Simkl** | zeigt Dub/Untertitel, **Daten von JustWatch** | ja | frei | — | erbt JustWatchs Netflix-Lücke |
| **aniSearch.de** (Archiv liegt im Repo) | **indirekt**: deutscher Release-Eintrag mit `dubbed-1` **und** Publisher | ja | 0 (schon angebunden) | robots.txt erlaubt uns | **einzige neue Spur, die es wert ist** |

### Gemessen: JustWatch führt für Netflix keine Tonspuren

Drei Titel am 22.08.2026 über die Seitenzustände von `justwatch.com/de` gelesen
(One Piece, Sakamoto Days, Blue Eye Samurai). Das Angebotsobjekt trägt das Feld
`audioLanguages({"language":"de"})`:

- Crunchyroll, Amazon Video, ADN: gefüllt (`['de','ja']` bei ADN/One Piece).
- **Netflix und „Netflix Standard with Ads": bei allen drei Titeln leer** — auch bei
  Blue Eye Samurai, einer Netflix-Eigenproduktion mit deutscher Fassung.

Damit ist auch erklärt, warum TMDB nichts liefert: TMDBs Anbieterdaten stammen von JustWatch.
`robots.txt` von justwatch.com sagt `Disallow:` (nichts gesperrt) — die Sperre ist also keine
technische, sondern eine sachliche: **die Daten sind dort nicht.**

### Gemessen: TMDB nennt nur den Anbieter

`GET /3/tv/95479/watch/providers` → der `DE`-Block hat genau `link`, `buy`, `flatrate`, und je
Anbieter nur `provider_id`, `provider_name`, `logo_path`, `display_priority`. Keine Tonspur.
Die Doku sagt dazu: „In order to use this data you must attribute the source of the data as
JustWatch."

### uNoGS: die Schnittstelle kann es, der Bestand ist das Problem

Die Endpunkte stehen (`/search` mit `audio`- und `countrylist`-Filter, `/titlecountries` gibt
`audio` und `subtitle` je Land) — belegt über die Connector-Referenz von Microsoft
(`learn.microsoft.com/en-us/connectors/unofficialnetflixsip/`, Stand 25.04.2025). Dagegen steht:

- Sitemap zuletzt erneuert **05.04.2026**, die Serien-Sitemap enthält 267 Einträge mit
  `lastmod` aus **2015**.
- RapidAPI-Eintrag `unogsng` zuletzt geändert **10.04.2026** (Status ACTIVE, angelegt 2019).
- Forum: neuestes Thema **17.07.2026** „No more videos about to expire" — unbeantwortet;
  davor **05.11.2025** „uNoGS Possible discontinue" („isn't updating the new movies and
  series") — ebenfalls unbeantwortet. `forum.unogs.com` hat ein **abgelaufenes Zertifikat**
  (nur `forum.uno.gs` antwortet).
- Die Nutzungsbedingungen (Beitrag vom 06.05.2015) verbieten „republish material from this
  website" und „reproduce, duplicate, copy or otherwise exploit material on this website for a
  commercial purpose" sowie „systematic or automated data collection" ohne schriftliche
  Zustimmung. Wir speichern und zeigen an — das passt nicht zusammen.

**Ungeprüft** bleibt, ob die API selbst aktuelle Daten liefert: Der Zugang braucht ein
RapidAPI-Konto, das nur Daniel anlegen kann. Vorher lohnt es nicht.

### aniSearch: Plattform und Sprache stehen dort in einer Zeile

Der Releases-Block einer aniSearch-Seite führt je Sprachfassung Status, Datum und **Publisher**:

```html
<li><div class="title" lang="de">… Deutsch …</div>
    <div class="status">… <a class="dubbed dubbed-1">Synchronisiert</a></div>
    <div class="released">Veröffentlicht: 16.06.2023</div>
    <div class="company">Publisher: <a>Netflix, Inc.</a></div></li>
```

Auswertung des **schon vorhandenen** Archivs `data/anisearch-raw/` (310 Seiten, kein einziger
neuer Abruf): 308 Seiten haben einen deutschen Eintrag, 292 davon „Synchronisiert",
**43 davon mit Publisher „Netflix, Inc.", alle 43 synchronisiert.** Häufigste Publisher:
Crunchyroll 157, Netflix 43, KSM 21, peppermint 19.

Gegenprobe an den offenen Netflix-Titeln (123 Stück, die die Streaming Availability API nicht
kennt): 106 haben noch keine archivierte aniSearch-Seite, 17 haben eine — davon **4 mit
Publisher Netflix** (Bright: Samurai Soul, Drifting Home, Baki Hanma S2, ULTRAMAN Final Season),
13 mit anderem Publisher (meist Crunchyroll).

**Grenze der Quelle, ehrlich benannt:** „Publisher" ist der deutsche Lizenzgeber, nicht die
Plattform von heute. Publisher Netflix + „Synchronisiert" ist ein starker Beleg dafür, dass die
deutsche Fassung **auf Netflix** entstanden ist; ein anderer Publisher ist **kein** Gegenbeleg
(Frieren steht dort unter Crunchyroll und läuft trotzdem auf Netflix). Taugt also als
zusätzlicher Ja-Beleg, nie als Nein.
