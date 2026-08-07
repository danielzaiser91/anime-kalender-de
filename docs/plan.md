# Plan: Anime-Kalender DE

Ein Wochenkalender für alle Anime-Releases mit **deutscher Synchronisation** — Streaming und Disc.

## 1. Datenmodell

Zwei Ebenen: `Title` (eine Staffel eines Anime) und daraus generierte `ReleaseEvent`s.

```ts
type Title = {
  slug: string                 // "frieren-s2"
  malId?: number; anilistId?: number
  titleDe: string              // deutscher Titel
  titleRomaji: string
  season: { label: string; number: number }   // "Staffel 2"
  year: number                 // Jahr der 1. Folge im GER-Dub
  platform: PlatformId         // crunchyroll | netflix | disneyplus | primevideo | wow | adn | joyn | rtlplus | disc
  platformUrl: string          // Deeplink zur Serie (DE)
  buyUrl?: string              // Amazon/Shop bei Disc-Release
  releaseType: 'weekly' | 'batch' | 'movie' | 'disc'
  fsk?: 0 | 6 | 12 | 16 | 18
  genres: string[]             // aus AniList, ins Deutsche gemappt
  keywords: string[]           // AniList-Tags, Spoiler gefiltert
  schedule: {
    firstEpisodeDate: string   // ISO, Datum der 1. GER-Dub-Folge
    time?: string              // "17:30" Europe/Berlin
    episodeCount: number
    lastEpisodeDate?: string   // berechnet oder explizit (bei Pausen)
    skipDates?: string[]       // Sendepausen
  }
  coverImage: string
  synopsisDe?: string
  sources: string[]            // Quellen-URLs für Nachvollziehbarkeit
}
```

`releaseStatus` wird **nicht gespeichert, sondern berechnet** (Definition aus dem Auftrag):

| Status | Bedingung |
|---|---|
| `airing` | heute liegt zwischen erster und letzter GER-Dub-Folge |
| `abgeschlossen` | letzte GER-Dub-Folge liegt vor heute |
| `tba` | erste GER-Dub-Folge liegt in der Zukunft |

Bei `tba` ohne bekanntes Datum: Flag `dateEstimated`, im UI gestrichelt umrandet.

## 2. Farbkodierung (nach Release-Art)

| Art | Farbe | Bedeutung |
|---|---|---|
| **Wöchentlich (Simuldub)** | Blau | Folge für Folge, fester Wochentag + Uhrzeit |
| **Katalogtitel (Batch)** | Violett | ganze Staffel auf einmal (Netflix/Disney+) |
| **Film** | Gold | Kino- oder Streaming-Filmstart |
| **Disc (DVD/Blu-ray)** | Grün | Kaufrelease, verlinkt zum Shop |

Zusätzlich: Plattform als farbiges Badge mit Logo, FSK als Kästchen in Original-FSK-Farbe,
Status (`airing`/`abgeschlossen`/`tba`) als Punkt bzw. Rahmen.

## 3. Features

### Kalender
- **Wochenansicht als Default**, 7 Tage sichtbar, Montag–Sonntag
- Umschalten auf Monat und Agenda/Liste
- Vor/Zurück, „Heute", Tastatur (←/→/T)
- Heutiger Tag hervorgehoben, aktuelle Uhrzeit als Linie
- Einträge zeitsortiert mit exakter Uhrzeit (Europe/Berlin, Sommerzeit korrekt)

### Filter (kombinierbar, in der URL gespeichert → teilbar)
Plattform · FSK · Release-Art · Status · Jahr · Genre (Mehrfach) · Keywords (Mehrfach) · Volltextsuche

### Detail-Panel je Eintrag
Cover, deutscher + Originaltitel, Synopsis, alle Tags, Episodenliste der Staffel,
Button „Bei <Plattform> ansehen", Button „Zu Google Calendar", Button „.ics laden", Quellenangabe.

### Kalender-Export
- Einzeltermin → Google-Template-URL (ein Klick, kein Login-Flow)
- Ganze Staffel → `.ics` mit allen Folgen als Serie
- **Abo-Feeds**: `feed/all.ics`, `feed/<plattform>.ics`, `feed/<genre>.ics` — einmal in Google
  Calendar abonnieren, aktualisiert sich mit jedem Datenupdate von selbst

### Newsletter
- Anmeldeformular mit Frequenzwahl (täglich / wöchentlich) und optionalen Filtern
  (nur meine Plattformen / nur meine Genres)
- **Double-Opt-in** (Bestätigungsmail), Abmeldelink in jeder Mail, Impressum + Datenschutz
- Cron: täglich 07:00 „heute erscheint …", montags 07:00 „diese Woche erscheint …"

## 4. Architektur

```
anime-kalender-de/
├── data/
│   ├── titles/*.yaml         # kuratierte Termine — die einzige Handarbeit
│   └── generated/            # von der Pipeline erzeugt, committed
│       ├── titles.json
│       ├── events.json
│       └── feeds/*.ics
├── pipeline/                 # TS-Skripte
│   ├── fetch-mydublist.ts    # MAL-IDs mit deutschem Dub
│   ├── fetch-anilist.ts      # Metadaten, Genres, Keywords, Links
│   ├── fetch-tmdb.ts         # FSK + Anbieter DE (optional, braucht Key)
│   ├── build-events.ts       # Regel → Einzeltermine
│   ├── build-feeds.ts        # ICS-Generierung
│   └── validate.ts           # Schema- und Plausibilitätsprüfung
├── web/                      # Vite + React + TS + Tailwind
├── worker/                   # Cloudflare Worker: Newsletter-API + Cron
└── .github/workflows/
    ├── deploy.yml            # Build + GitHub Pages
    └── refresh-data.yml      # nightly: Pipeline neu, bei Diff committen
```

Warum kein Framework mit Server (Next.js): Der Kalender braucht keinen. Statisch ist schneller,
kostenlos und unkaputtbar. Der einzige dynamische Teil — der Newsletter — sitzt sauber getrennt
im Worker.

## 5. Umsetzung (Story Points)

| # | Aufgabe | SP |
|---|---|---|
| 1 | Repo, Scaffold, Tooling, CI-Grundgerüst | 2 |
| 2 | Datenschema + Validator + Seed-Datensatz (aktuelle & kommende Saison) | 5 |
| 3 | Pipeline: MyDubList + AniList + Mapping + Event-Generierung | 5 |
| 4 | Wochen-Grid mit Uhrzeiten, Farbkodierung, Heute-Marker | 8 |
| 5 | Filter-System inkl. URL-State + Suche | 5 |
| 6 | Detail-Panel + Plattform-Deeplinks + Kauflinks | 3 |
| 7 | Google-Calendar-Links + ICS-Einzel + ICS-Abo-Feeds | 3 |
| 8 | Monats- und Agenda-Ansicht | 3 |
| 9 | Newsletter-Worker: Double-Opt-in, D1-Schema, Cron, Mail-Templates | 8 |
| 10 | Impressum/Datenschutz, Responsive, Dark Mode, A11y | 3 |
| 11 | Nightly-Refresh-Action + Deploy-Action + Doku | 3 |
| | **Summe** | **48** |

## 6. Offene Punkte (siehe Rückfragen)

- Hosting des Newsletter-Backends und Mail-Versand-Dienst
- Umfang des Startdatensatzes
- TMDB-Key für FSK/Anbieter
- Repo-Name und Sichtbarkeit
