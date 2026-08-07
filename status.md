# Status: anime-kalender-de

Stand: 07.08.2026 · Live: https://anime-kalender.de/

## Task Queue

### In Arbeit
_(leer)_

### Queue
| Aufgabe | SP | Notiz |
|---|---|---|
| Alle legalen Anbieter + mehr Quellen + häufigeres Polling | 21 | ausführlich in `TODO.md` |
| Tracking-Absatz aus der Datenschutzerklärung nehmen | 1 | erst wenn der erste Versand über die eigene Domain bestätigt ist |
| Katalogtitel (Netflix/Disney+ Batch-Drops) erfassen | 3 | Release-Art `batch` ist im Code vorhanden, aber noch ohne Datenbestand |
| Kino-Termine erfassen | 2 | Release-Art `movie` ebenfalls ungenutzt |
| Disc-Releases September 2026 nachtragen | 2 | Quelle: Anime2You-Monatsübersicht |
| Uhrzeiten außerhalb von Crunchyroll | 3 | Netflix und Prime Video nennen keine Uhrzeit; bislang „Zeit offen" |
| Weitere Sprachen | 3 | Gerüst steht, EN und DE gepflegt; weitere brauchen nur ein Wörterbuch |
| Projekt ins Portfolio eintragen | 1 | Reminder in `TODO.md` |

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
- ✅ Repo `danielzaiser91/anime-kalender-de` (public) angelegt, Pages auf Actions-Quelle
  gestellt, Secret `TMDB_API_KEY` und Variable `SITE_URL` gesetzt, Deploy grün
- ✅ **Crunchyroll-Sendezeiten**: Der Simulcast-Kalender ist mit `filter=premium` öffentlich
  lesbar (kein Login, kein Abo) und markiert deutsche Synchro-Folgen mit „(Deutsch)". Playwright
  nötig, weil die Seite ihre Kacheln per JS baut. 25 Titel mit belegter Uhrzeit, 16 davon
  vorher gar nicht erfasst
- ✅ Favoriten (lokal), Sprachumschalter DE/EN, Staffel-Bündelung über AniList-Beziehungen,
  Status „Erschienen", Trennung nach Uhrzeit, 58 Genres statt 18
- ✅ **Link-Vorschaubilder**: 1200×630 je Release aus den Daten gerendert (SVG über sharp),
  echte Teilen-Seiten unter `/r/<slug>/` — Hash-Routen können prinzipbedingt keine eigene
  Vorschau tragen. Teilen-Knöpfe auf Kacheln, Karten und im Detail-Panel. Muster als globaler
  Skill `link-vorschaubilder` festgehalten
- ✅ Sprachwahl mit gezeichneten SVG-Flaggen statt Emoji (Windows rendert Regional-Indicator
  nur als Buchstaben)
- ✅ Impressum und Datenschutzerklärung ausformuliert (Kontakt per E-Mail, ohne Anschrift —
  bewusste Entscheidung des Betreibers für ein privates, nicht kommerzielles Angebot)
- ✅ **Newsletter live**: Worker unter `newsletter.animekalender.workers.dev`, D1-Datenbank
  `anime-kalender` in Westeuropa, stündlicher Cron, Versand über Resend. Ende-zu-Ende getestet:
  Anmeldung → Bestätigungsmail → Bestätigung → Tages-Digest mit 17 Terminen verschickt.
  GitHub-Variable `NEWSLETTER_API_URL` gesetzt, Formular auf der Live-Seite verbunden.
  Brevo fiel aus — deren Registrierung war defekt.
- ✅ **Eigene Domain `anime-kalender.de`** bei INWX registriert. DNS-Zone per API gesetzt
  (`tools/inwx-dns.mjs`, idempotent): GitHub Pages A/AAAA, www-CNAME, drei Resend-Einträge,
  DMARC. Die drei INWX-Parkeinträge mussten weichen, sonst hätte sich jeder Aufruf zufällig
  zwischen Seite und Platzhalter entschieden
- ✅ **Absenderdomain `send.anime-kalender.de` verifiziert**, Öffnungs- und Klick-Tracking von
  Anfang an abgeschaltet. Absender jetzt `kalender@send.anime-kalender.de`
- ✅ Deutsche Handlungsbeschreibungen von TMDB für 1.453 von 2.751 Titeln, mit Jahres- und
  Titelabgleich gegen Fehlzuordnung; englischer Rückfall mit Hinweis. FSK für 942 Titel
- ✅ Prime-Video-Links laufen über amazon.de. Die ASIN ist **nicht** marktübergreifend gleich —
  das Umschreiben von `amazon.com` auf `amazon.de` führte zuverlässig auf eine Fehlerseite
