# „Meine Woche" — Konzept (08.10.2026)

**Kernidee:** Die Seite kennt heute alle deutschen Termine; der Besucher will nur seine. „Meine Woche" ist
dieselbe Wochenansicht, gefiltert auf das, was er gemerkt hat (★) und auf die Anbieter, die er bezahlt — mit
dem Sprung zum Anbieter an jedem Termin. Daraus folgt der Grund, wiederzukommen: *Was kann ich diese Woche
auf Deutsch sehen?* in einem Bildschirm, ohne Suche, ohne Filterdialog. Kein Konto, keine Community, keine
Bewertungen (Nicht-Ziel laut `CLAUDE.md`); Projektziel 5 „Rechtzeitig Bescheid geben" bekommt damit einen
persönlichen Ort statt dreier Abo-Seiten.

**Befund vor dem Entwurf:** Die drei Erinnerungswege existieren schon, jeder für sich:

| Baustein | Wo | Stand |
|---|---|---|
| Favoriten im Browser (`favorites`, Datum `favorites:seit`, „gesehen bis") | `web/src/lib/favorites.ts`, `gesehen.ts` | fertig |
| Favoriten im Worker (Spiegel je Newsletter-Abo, `pref_token`) | `worker/src/favoriten-kennung.ts`, `POST /favorites` | fertig |
| Persönlicher ICS-Feed nur mit Favoriten | `GET /feed/favoriten.ics?k=<feed_token>` (`StaticViews.tsx` → `FavoritenFeed`) | fertig, braucht Newsletter-Abo |
| Web-Push „gemerkte Folge erschienen" (stündlicher Cron, kein Konto) | `worker/src/push.ts`, Tabelle `push_abo` | fertig, PoC-Qualität |
| Newsletter täglich 07:00 mit „★ Deine Favoriten" oben | `worker/src/mail-abschnitte.ts` | fertig |

Was fehlt, ist die Klammer: eine Ansicht, in der das alles zusammenkommt, und die Plattformwahl.

## Nutzerfluss in sechs Schritten

1. **Entdecken:** Besucher öffnet `#/woche`, sieht die Umschaltung „Alle Termine | ★ Meine Woche". Ohne
   Favoriten zeigt „Meine Woche" einen Satz („Merk dir Titel mit dem Stern …") und den Sprung zur Datenbank.
2. **Merken:** Stern an Karte oder im Panel — wie heute. Jeder Stern macht „Meine Woche" voller; die Zahl
   im Kopf („5 Termine deiner 7 Favoriten") gibt Rückmeldung.
3. **Plattformen wählen:** Chips „Meine Plattformen" (Crunchyroll, Netflix, …, TV). Nichts gewählt = alle.
   Wahl bleibt im Browser (`meinePlattformen`), geht nie in die Adresse, nie an den Worker.
4. **Woche lesen:** Je Tag die eigenen Termine als Zeile (Cover, Titel, „Anbieter · Folge 4/12 · ≈ 10:00",
   Knopf „Ansehen ↗" zum Anbieter aus `release.platformUrl`). Darunter „Diese Woche nur auf abgewählten
   Anbietern: …" und „Gerade ruhig · n" mit dem nächsten Termin je Favorit — niemand glaubt, die Seite hätte
   einen Titel vergessen.
5. **Mitnehmen:** „Nichts verpassen": (a) Kalenderdatei nur mit den eigenen Titeln, im Browser gebaut,
   acht Wochen voraus, mit Wecker (`shared/ics.ts`, `erinnerung: true`); (b) Kalender-Abo, das sich selbst
   aktualisiert — der vorhandene Favoriten-Feed des Workers (`#/abo`); (c) Push am Tag der Folge (`#/abo`).
6. **Wiederkommen:** Die Umschaltung merkt sich „Meine Woche" (`meineWoche`); der nächste Besuch startet
   dort. Push und Newsletter-Links führen schon heute auf `#/woche?fav=1`, künftig direkt in „Meine Woche".

## Datenmodell

Alles Neue liegt im Browser, in zwei Schlüsseln neben den vorhandenen:

| Schlüssel | Inhalt | Neu? |
|---|---|---|
| `favorites` | `number[]` (ak-Kennungen) | nein |
| `favorites:seit`, `gesehenBis`, `hidden` | wie bisher | nein |
| `meinePlattformen` | `PlatformId[]`, leer = alle | **ja** |
| `meineWoche` | `boolean`, ob die Woche persönlich gezeigt wird | **ja** |

Die Rechnung ist eine reine Funktion `meineWoche(events, favoriten, plattformen, anker, namen)` in
`web/src/lib/meine-woche.ts`: Termine der Woche je Tag, Favoriten ohne Termin (mit nächstem Termin),
Favoriten nur auf abgewählten Anbietern. Eingabe ist der volle `data.events`-Bestand, nicht die gefilterte
Ansicht — die Schnellfilter („nur kostenlos", „TV aus") gelten hier bewusst nicht; die Plattformwahl ist der
Filter. Keine neue Datei im Datensatz, kein neues Feld in `titles.json` (ARCHITEKTUR: nur, was die Mehrheit
braucht).

Für den Worker ändert sich nichts: Er kennt Favoriten schon (Newsletter-Spiegel, Push-Abo). Die
Plattformwahl bleibt lokal; wer sie im Push oder Feed haben will, bekäme sie als weiteres Feld neben
`favoriten` im bestehenden `POST /push/abo` bzw. in `subscribers.platforms` (gibt es schon für den
Newsletter) — eine Zeile, kein neues Schema.

## Datenschutz

- **Ohne Abo fließt nichts.** Favoriten und Plattformen bleiben im `localStorage`; die Kalenderdatei
  entsteht im Browser (`Blob`), kein Abruf. Die Seite weiß nicht einmal, dass jemand „Meine Woche" nutzt.
- **Kalender-Abo (Worker-Feed):** setzt ein bestätigtes Newsletter-Abo voraus (Double-Opt-in, Adresse,
  IP/Zeit der Einwilligung als Nachweis; Abmeldung löscht die Zeile). Der Feed-Token ist ein eigener Schlüssel,
  neu erzeugbar („Neue Adresse"), und steht nur in der Kalender-App des Nutzers. Google Calendar fragt ihn
  über Google-Server ab — ein Satz dazu gehört in die Datenschutzerklärung, sobald der Feed beworben wird
  (heute steht dort nur die Google-Anleitung, nicht der Datenfluss; geprüft 08.10.2026 in `i18n-seiten.ts`).
- **Web-Push:** Der Browser holt den Endpunkt bei seinem Hersteller (Google/Mozilla/Apple), der Worker
  speichert Endpunkt + Favoritenliste, keine Adresse, kein Konto. Einwilligung ist die Browser-Abfrage
  (`Notification.requestPermission`) plus unser Schalter; das ist für Push der anerkannte Opt-in — ein
  Double-Opt-in per Mail gibt es hier nicht, weil es keine Mail gibt. Löschbar: Schalter aus → `abmelden`
  → Zeile weg; ein toter Endpunkt (410) wird beim nächsten Versand gelöscht. Kein Tracking: Die Push-Nachricht
  trägt keine Nutzlast, der Service Worker holt den Text beim Worker ab; keine Öffnungsrate, kein Pixel.
- **PWA-Erinnerung ohne Server** (Konzept, nicht gebaut): `Notification Triggers`/`showTrigger` sind in
  Chrome nie aus dem Origin-Trial gekommen; eine lokale Erinnerung ohne Push gibt es im Web nicht
  verlässlich. Bleibt: Push (vorhanden) oder Kalender-Wecker (ICS `VALARM`, vorhanden).
- **E-Mail-Erinnerung am Tag der Folge ohne neue Infrastruktur:** geht heute schon — Newsletter „täglich"
  um 07:00 nennt im Betreff zuerst die Favoriten des Tages. Eine Mail *zur Uhrzeit der Folge* bräuchte nur
  einen stündlichen Lauf über dieselben Tabellen (`subscribers.favorites`, `send_log`), also Code, keine
  Infrastruktur; Kosten im Mail-Kontingent (Brevo 300/Tag) — deshalb nicht Teil dieses Entwurfs.
- Impressum/Datenschutz: Abschnitt „Kalender-Abo mit Favoriten" und „Push" existieren; „Meine Woche" braucht
  nur den Satz, dass Plattformwahl und Favoriten im Browser bleiben (steht als Hinweis in der Ansicht).

## Aufwand je Baustein

| Baustein | Aufwand | Ohne neuen Server? |
|---|---|---|
| Wochenansicht „Meine Woche" (Umschaltung, Plattform-Chips, Tageszeilen, „ruhig", Anbieter-Sprung) | **S** — Prototyp steht (eigener Chunk, 6,9 KB roh) | ja |
| Kalenderdatei nur eigene Titel, im Browser gebaut, mit Wecker | **S** — im Prototyp | ja |
| Persönliches Kalender-Abo (selbst aktualisierend) | **vorhanden** (Worker-Feed); Plattformwahl in den Feed: S | Worker vorhanden |
| Push am Tag der Folge | **vorhanden** (PoC); Reifung: Uhrzeit statt „erschienen" stündlich, iOS-Hinweis „zum Startbildschirm hinzufügen": M | Worker vorhanden |
| Mail zur Folgen-Uhrzeit (statt 07:00-Digest) | M (Cron-Lauf, `send_log`-Schlüssel je Termin) | Worker vorhanden |
| „Meine Woche" als Ziel von Push/Newsletter-Links (`?fav=1` → `meineWoche=1`) | S | ja |
| Aufnahme in Navigation/Kopf, Einstellungen-Eintrag, Datenschutztext | S | ja |
| Umzug der Plattformwahl auf ein zweites Gerät (über den vorhandenen Abgleich-Token) | M | Worker vorhanden |

## Risiken

- **Leere Woche wirkt wie ein Fehler.** Wer drei Favoriten hat, die gerade pausieren, sieht sieben „frei".
  Gegenmittel im Prototyp: „Gerade ruhig" mit nächstem Termin; offen: ein Vorschlag „Läuft diese Woche
  bei deinen Anbietern" (Neustarts auf gewählten Plattformen) — das wäre Empfehlung, nicht Community, bleibt
  aber bewusst draußen, bis die Grundansicht sich bewährt.
- **Favoriten je Staffel.** `favorites` trägt Staffel-Kennungen; „Meine Woche" zeigt die neue Staffel nicht,
  wenn nur die alte gemerkt ist. `ReihenStern` (alle Staffeln merken) existiert; der Reihen-Hinweis
  (`franchiseHinweis`) im Newsletter auch. Offen: Vorschlag „Staffel 2 von X startet — merken?".
- **Plattform ≠ Zugang.** „Prime Video" umfasst Kanäle (Aniverse-Kanal, `release.kanal`); wer Prime hat, hat
  nicht Aniverse. Der Prototyp wählt nach `platform`, der Kanal steht im Panel. Fürs Erste Hinweis, später
  Chip je Kanal.
- **`platformUrl` fehlt oder zeigt auf aniSearch** bei älteren Releases — dann gibt es keinen „Ansehen"-Knopf
  (so im Prototyp: Link nur, wenn er zum Anbieter führt).
- **Zwei Geräte.** Alles liegt im Browser; Handy und Rechner laufen auseinander. Der Abgleich-Token des
  Newsletters löst das heute für Favoriten; Plattformen müssten mit.
- **Kennungs-Umzug** (`kennung:ak1`, entfällt 05.11.2026): Favoriten tragen ak-Kennungen; Messskripte, die
  Favoriten vorab setzen, müssen die Marke setzen, sonst werden AniList-Kennungen „umgezogen" (so geschehen
  beim ersten Screenshot-Lauf dieses Prototyps).

## Was NICHT gebaut wird

- Kein Konto, keine Anmeldung, keine Synchronisation über einen eigenen Server — der Abgleich-Token des
  Newsletters bleibt der einzige Weg zwischen Geräten.
- Keine Bewertungen, Kommentare, „Freunde", Watchlists anderer, Empfehlungen aus Nutzerdaten.
- Kein Tracking, welche Ansicht jemand nutzt; keine Statistik über Plattformwahl.
- Keine lokale PWA-Erinnerung ohne Push (gibt es im Web nicht verlässlich).
- Keine zweite Datenquelle: „Meine Woche" rechnet auf `data.events`, nie auf einem eigenen Ausschnitt.
- Keine Änderung am Worker in diesem Schritt.

## Prototyp (dieser Zweig)

- Die Vorschau-Schalter (`akVorschau`) und der Debug-Bereich sind seit 09.10.2026 entfernt; der Prototyp liegt in der Git-Historie (vor Commit "UI aufräumen").
- Dateien: `web/src/lib/meine-woche.ts` (Speicher, Rechnung, ICS), `web/src/components/kalender/MeineWoche.tsx`
  (Ansicht, per `lazy()` als eigener Chunk — die Standardansicht lädt ihn nie), Schalter in
  `KalenderBereich.tsx`, Texte `mw.*` in `i18n-kalender.ts`.
- Screenshots (Playwright aus `dist/`, ohne Server): `docs/meine-woche-{an,leer,aus}-{hell,dunkel}.png`,
  Handy `docs/meine-woche-{an,leer}-handy-{hell,dunkel}.png`. Messung: Überbreite 0, Konsolenfehler 0.
- Ohne Vorschau: `KalenderBereich` zeichnet exakt wie vorher (ein `useVorschau`, ein `useSyncExternalStore`
  mehr, kein zusätzlicher Abruf).

**Stand 09.10.2026 (Daniel):** zurückgestellt, nicht auf die Webseite. Am 16.10.2026 erneut vorstellen (Mockup `daniel-zum-abarbeiten/mockups/meine-woche.html`), dann entscheiden, ob wir es nehmen. Die Idee ist interessant.
