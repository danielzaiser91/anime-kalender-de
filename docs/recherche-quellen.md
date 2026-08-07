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
