# Status: anime-kalender-de

Stand: 07.08.2026

## Task Queue

### In Arbeit
_(leer)_

### Queue
| Aufgabe | SP | Notiz |
|---|---|---|
| Uhrzeiten der laufenden Simuldubs belegen | 3 | einzige echte Lücke; Crunchyroll blockt Bots, braucht manuelle Prüfung oder eine Session mit Premium |
| Newsletter-Worker deployen | 3 | braucht Cloudflare-Account + API-Token + Mail-Anbieter |
| Impressum/Datenschutz mit echten Angaben füllen | 1 | Platzhalter im Code markiert |
| Katalogtitel (Netflix/Disney+ Batch-Drops) erfassen | 3 | Release-Art `batch` ist im Code vorhanden, aber noch ohne Datenbestand |
| Kino-Termine erfassen | 2 | Release-Art `movie` ebenfalls ungenutzt |
| Disc-Releases September 2026 nachtragen | 2 | Quelle: Anime2You-Monatsübersicht |

### Zu besprechen
| Thema | Frage |
|---|---|
| Affiliate-Links | Amazon-Kauflinks als Partnerlinks? Würde die TMDB-Nutzung von „privat" auf „kommerziell" schieben |
| Community-Beiträge | Termine per Pull Request annehmen, oder Datenpflege allein behalten? |

### Warten auf Feedback
| Thema | Seit |
|---|---|
| Gesamtabnahme der ersten Version | 07.08.2026 |

## Archiv

- ✅ Quellen- und Tool-Recherche (`docs/recherche-quellen.md`)
- ✅ Plan mit Datenmodell und Story Points (`docs/plan.md`)
- ✅ Scaffold: Vite + React + TS + Tailwind v4, Pfad-Aliase, Typecheck grün
- ✅ Datenpipeline: MyDubList (3.080 MAL-IDs) → AniList (2.977 aufgelöst) → 2.751 Titel nach
  Adult-Filter; TMDB für FSK und DE-Anbieter
- ✅ Kuratierter Seed: 13 Simuldubs Sommer 2026 + 37 Disc-Releases August 2026 = 50 Releases,
  197 Einzeltermine
- ✅ AniList-IDs der Fortsetzungen von Hand korrigiert (Suche traf mehrfach die falsche Staffel)
- ✅ Wochen-, Monats-, Agenda- und Datenbank-Ansicht
- ✅ Filter für Plattform, Release-Art, Status, FSK, Jahr, Genre, Keywords + Volltextsuche,
  Zustand in der URL
- ✅ Detail-Panel mit Terminliste, Deeplinks, Kauflinks, Quellenangabe
- ✅ Google-Calendar-Links, ICS-Einzeldownload, ICS-Abo-Feeds (gesamt/Plattform/Genre)
- ✅ Newsletter-Worker: Double-Opt-in, D1-Schema, stündlicher Cron mit Berlin-Prüfung,
  Resend-/Brevo-Adapter, Mail-Templates
- ✅ GitHub Actions: Pages-Deploy + nächtliche Datenaktualisierung
- ✅ TMDB-API-Key besorgt und in `my_secrets.md` hinterlegt
