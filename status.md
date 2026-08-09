# Status: anime-kalender-de

Stand: 08.08.2026 · Live: https://anime-kalender.de/

## Task Queue

### In Arbeit
_(leer)_

### Queue
| Aufgabe | SP | Notiz |
|---|---|---|
| aniSearch-Bestand auffüllen | 2 | läuft über die Nachtläufe, 60 Titel je Lauf; 1.938 von 2.746 Titeln haben deutschen Text |
| aniSearch-API-Zugang anlegen | 1 | Registrierung nur von Daniels Handy möglich — dieser Anschluss ist gesperrt |


### Später (nice to have)

Bewusst zurückgestellt. Zählt im Footer als „später", nicht als „jetzt möglich" — damit die
Liste der wirklich anstehenden Arbeit nicht von Dauerbrennern verstopft wird. Wird hier
herausgeholt, wenn der User es sagt.

| Idee | SP | Notiz |
|---|---|---|
| Weitere Sprachen | 3 | Gerüst steht, EN und DE gepflegt; weitere brauchen nur ein Wörterbuch (zurückgestellt 08.08.2026) |

### Zu besprechen
| Thema | Notiz |
|---|---|
| aniSearch um Erlaubnis fragen | Öffentliche API hat keine Titeldaten; für Beschreibungen/Anbieter bräuchte es ein „Custom Interface" per Anfrage an api@anisearch.com. Deren API-Bedingungen verbieten Weitergabe an Dritte — eine öffentliche Website ist genau das, das muss die Anfrage ansprechen |

### Warten auf Feedback
| Thema | Seit |
|---|---|
| Newsletter-Abmeldung testen | 08.08.2026 |
| Offline-Test auf dem Handy | 09.08.2026 |
| aniSearch-Zugangsdaten vom Handy | 09.08.2026 |

## Entscheidungen

- **Keine Affiliate-Links** (08.08.2026). Das Projekt bleibt unkommerziell. Damit bleibt auch die
  TMDB-Nutzung im privaten Rahmen, und die Amazon-Links sind schlichte Kauflinks ohne Partner-Tag.
- **Keine Pull Requests für Termine** (08.08.2026). Die Datenpflege bleibt in einer Hand — die
  Quellenpflicht ist die Grundregel des Projekts, und sie ist nur haltbar, solange jeder Termin
  durch dieselbe Prüfung geht.
- **Gesamtabnahme der ersten Version erteilt** (08.08.2026), mit einer Ausnahme: Die
  Newsletter-Abmeldung ist noch ungetestet.

## Archiv

- ✅ **Anbieter vollständig aus TMDB** (Datenbasis JustWatch — dieselbe Quelle, aus der werstreamt.es
  schöpft). Der Abruf fragte bisher nur flatrate und buy und behielt davon nur die Dienste mit
  eigener Plattform; Videobuster, maxdome, Apple TV, MagentaTV, Videoload, Sky Store, Rakuten und
  Akibapass wurden verworfen. Jetzt 291 Titel mit Bezugswegen
- ⚠️ **aniSearch-Sperre selbst verschuldet**: Scraper lief mit 60 Anfragen je Minute, dokumentiert
  sind 10. Jetzt 6 Sekunden Takt, 60 Titel je Lauf. Neue Immer-Regel: API-Doku vor dem ersten
  Abrufcode lesen

- ✅ **aniSearch als Quelle**: deutsche Inhaltsangaben (redaktionell, ausführlich) und Bezugsquellen
  auch für alte Katalogtitel. ID-Zuordnung über die anime-offline-database (ODbL), weil ein
  Titelvergleich „.hack//Quantum" und „.hack//Sign" nicht auseinanderhält
- ✅ **Hinweis bei Titeln ohne Termin** unterscheidet jetzt: erschienen (Datum fehlt nur bei uns)
  gegen wartend. Bezugswege stehen darunter, Streams vor Kauflinks, fremde Partner-Kennungen
  entfernt
- ✅ **Steel Ball Run** kuratiert: 1st STAGE seit 19.03.2026 auf Netflix, Fortsetzung ab 25.09.2026

- ✅ **Sendepausen verschieben alles Folgende**: Der Sendeplan hängt jetzt an Stützpunkten — jede
  Folge rechnet ab der jüngsten Beobachtung vor ihr weiter, nicht ab Folge 1. Eine Pause muss
  nirgends gepflegt werden, sie ergibt sich aus dem, was im Kalender stand. Folgen jenseits der
  letzten Beobachtung tragen das ≈: 220 von 555 Terminen sind belegt, der Rest ist Fortschreibung

- ✅ **Offline nutzbar ab dem ersten Besuch**: Der Worker liest beim Einrichten die Bündel-Adressen
  aus der ausgelieferten HTML (Hash-Namen, feste Liste wäre lautlos veraltet), holt die vier
  Datendateien vorab und legt die Cover der aktuellen und nächsten Woche ab. Seitenaufrufe haben
  drei Sekunden Zeitlimit — „kein Netz" heißt selten Fehler, meistens Hängen
- ✅ **Sendetermine über die Mehrheit ankern**: Ein einzelner Ausreißer (Skeleton Knight, Folge 1 an
  einem Samstag) hatte die ganze Staffel um zwei Tage verschoben. Jetzt bestimmt der häufigste
  Wochentag den Sendeplatz, und gesehene Einzeltermine schlagen jede Hochrechnung

- ✅ **Als App installierbar (PWA)**: Manifest, gezeichnete PNG-Symbole samt `maskable`-Fassung,
  Service Worker mit drei Strategien (Seiten aus dem Netz zuerst, gehashte Bündel aus dem Cache,
  Termine sofort aus dem Cache und im Hintergrund aufgefrischt). Auf dem Handy einmalig die Frage
  „installieren oder im Browser weiter", danach der Knopf in der Kopfzeile; auf iOS die Anleitung
  übers Teilen-Menü, weil Safari kein `beforeinstallprompt` kennt
- ✅ **Mobil auf heute**: Der Blick landet beim nächsten anstehenden Termin, 30px Vorlauf, einmal
  je Ankunft. Dazu zwei Farbfelder im heutigen Tag — vorbei grau, kommend blau
- ✅ **Bei Google angemeldet**: `sitemap.xml` (122 Adressen) und `robots.txt` entstehen jetzt im
  Build aus dem Datenbestand. Domain-Property in der Search Console über einen TXT-Eintrag in der
  INWX-Zone bestätigt, Sitemap eingereicht — Status „Erfolgreich", 122 Seiten erkannt
- ✅ Datenschutzerklärung: Der Abschnitt zur Erfolgsmessung beschrieb die Zeit der gemeinsam
  genutzten Absenderdomain. Seit dem Wechsel auf `send.anime-kalender.de` wird nicht mehr
  getrackt; der Text sagt das jetzt auch

- ✅ **Ausschluss-Filter**: Umschalter über den Tags; im Modus „Ausschließen" macht ein Klick aus
  einem Tag ein Verbot statt einer Auswahl (roter, durchgestrichener Chip). Ausschluss schlägt
  Einschluss, ein Wert kann nie beides sein. Steht in der Adresse als `xg=`, `xkw=` usw.
- ✅ **Titel ausblenden**: Auge neben dem Stern. Die Karte bleibt an ihrem Platz, zeigt aber nur
  den Namen — kein Bild, keine Tags, nicht anklickbar; auch das Detail-Panel bleibt zu.
  Verdeckt statt gefiltert, damit man sieht, dass da etwas ist
- ✅ **Notbremse im Build**: Der stündliche Workflow hatte `data:build` ohne `data:fetch`
  aufgerufen und damit einen Datensatz mit null Titeln veröffentlicht. Der Build bricht jetzt ab,
  wenn der Cache leer ist, und die drei Workflows teilen sich einen `actions/cache`

- ✅ Kuratierungsbericht abgearbeitet: 6 belegte Termine übernommen (Chihiro-Wiederaufführung,
  Yu-Gi-Oh-Komplettbox, Bocchi Vol. 1+2, Oshi no Ko S3 Vol. 1+2), 5 bestehende Termine mit einer
  zweiten Quelle belegt. Ohne belegte deutsche Fassung bleibt ein Titel draußen
- ✅ Uhrzeiten außerhalb von Crunchyroll geklärt: Nur Netflix macht dazu eine belastbare Aussage
  (Eigenproduktionen 00:00 Pacific, Lizenztitel Mitternacht Ortszeit) — Disney+ und Prime Video
  veröffentlichen keine. Statt eine Faustregel als Uhrzeit einzutragen, erklärt die Karte jetzt,
  warum dort nichts steht, mit Quellenlink

- ✅ **ADN als zweite maschinelle Quelle**: Die öffentliche JSON-Schnittstelle nennt je Folge
  Datum, Uhrzeit UND Sprachcode (`vde` = Synchro, `vostde` = nur Untertitel). Damit beantwortet
  sie von sich aus die Frage, für die es sonst keine maschinenlesbare Antwort gibt. 4 Serien
  mit deutscher Synchro gefunden, alle vorher nicht erfasst
- ✅ **Anime2You als Vorschlagsquelle**: drei RSS-Feeds, deutsche Datumserkennung, Abgleich gegen
  die `sources` der kuratierten Einträge. Erzeugt bewusst keine Termine, sondern die Liste
  „gemeldet, aber noch nicht erfasst" (`npm run data:report`) — 16 offene Meldungen beim ersten Lauf
- ✅ **Polling-Kaskade**: stündlich Crunchyroll, täglich alle Quellen, wöchentlich mit weitem
  Fenster. Alle drei teilen sich eine `concurrency`-Gruppe, committen nur bei echter Änderung
- ✅ **Wachhund gegen stumme Quellen**: `data/source-health.json` merkt sich je Quelle den letzten
  erfolgreichen Lauf; schweigt eine länger als vier Tage, wird der Workflow rot und GitHub mailt.
  Gegen den lautlosesten Fehler des Projekts — ein Scraper, der nach einem Seitenumbau einfach
  nichts mehr findet

- ✅ Teilbare Adresse ohne Umweg: sobald eine Karte offen ist, steht /r/<slug>/ in der
  Adressleiste (replaceState, kein Neuladen) — kopieren genügt, der Teilen-Knopf ist nur Beiwerk

- ✅ Newsletter-Mails verlinken: Titel → Teilen-Seite des Releases (mit Vorschaubild, springt in
  die Wochenansicht des Tages), Anbietername → Serie beim Streamingdienst bzw. Kaufseite
- ✅ Unbelegte Crunchyroll-Termine verwerfen: liegt ein behaupteter Start im abgesuchten
  Kalenderfenster, hat dort aber keine deutsche Folge, fällt der Termin raus

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
- ✅ **Favoriten im Newsletter**: eigener Block „★ Deine Favoriten" über den übrigen Terminen,
  Betreff nennt sie zuerst. Favoriten werden bei der Anmeldung mitgeschickt und in D1 gespiegelt;
  ein Abgleich-Link mit eigenem Token in jeder Mail hält sie aktuell
- ✅ **HTTPS für anime-kalender.de**. Das Zertifikat war über eine Stunde lang nie beantragt worden:
  Beim Setzen der Domain per API fehlte das Feld `https_certificate` vollständig. Auslöser ist das
  **erneute** Setzen — einmal entfernen und neu setzen, dann war es in einer Minute da. In
  `ai_agent_learnings.md` unter „GitHub Pages / CI-Deploy" festgehalten
- ✅ **Erreichbarkeitsprüfung für 19 Seiten** im selben Worker: stündlich, höchstens eine
  Störungsmail pro Tag, montags eine Wochenübersicht als Lebensnachweis. Liste per
  Pages-Schnittstelle aus allen 32 Repos ermittelt statt aus READMEs. Der Dienst überwacht
  sich bewusst **nicht** selbst
- ✅ Prime-Video-Links laufen über amazon.de. Die ASIN ist **nicht** marktübergreifend gleich —
  das Umschreiben von `amazon.com` auf `amazon.de` führte zuverlässig auf eine Fehlerseite
