# Konzept: eigene Kennungen statt AniList-IDs (Entwurf, 04.10.2026)

Anlass: Daniel zur AniList-Ablösung: „Nein, keine Altlast von AniList, IDs wären ein Rückschritt, denk an neue Animes, kommende, wegfallende, es wäre unnötige Altlast —
denk also über eine neue Lösung nach." Mein früherer Vorschlag („AniList-IDs bleiben Schlüssel, die Felder kommen aus aniSearch") ist damit verworfen.

## Was heute an der AniList-ID hängt

Titel, Releases, Handbelege (`data/dub-confirmed.yaml`), Folgenlisten (`public/data/folgen/<id>.json`), Adressen (`#/datenbank?t=<id>`, Teilen-Seiten), Favoriten
im Browser, Newsletter-Abos, `synchro-historie.json`, `news-historie.json`. Fällt AniList weg, fällt der Schlüssel weg; ein neuer Titel bekäme dort erst eine ID,
wenn AniList ihn führt — kommende Anime fehlen häufig.

## Vorschlag: eine eigene, nie wiederverwendete Kennung (`ak`) mit Quell-Zuordnung

- **Ein Titel bekommt beim ersten Sehen eine fortlaufende eigene Zahl** (`ak`), gespeichert in `data/kennungen.json` (Liste, nur anhängen):
  `{ ak, aniSearch?, anilist?, mal?, tmdb?, status: 'aktiv' | 'zusammengelegt' | 'weg', zuAk? }`.
- **Die Quelle der Titel ist aniSearch** (führt Angekündigtes, hat Folgen- und Reihenangaben). Neue aniSearch-Kennung im Katalog-Lauf → neue `ak`. Externe Kennungen sind
  nur **Zuordnungen** (Attribute), nie Schlüssel; AniList steht dort, bis AniList nicht mehr Quelle ist, und kann dann ersatzlos entfallen.
- **Wegfallende und zusammengelegte Titel verschwinden nicht:** `status` wechselt, `zuAk` verweist auf den Nachfolger; Adressen mit einer alten `ak` leiten weiter.
  Eine `ak` wird nie neu vergeben.
- **Adressen:** `t=<ak>`. Veröffentlichte Adressen (`t=<AniList-ID>`, Teilen-Seiten, Browser-Favoriten) funktionieren über die Zuordnung weiter (Rückwärtskompatibilität
  nur für Veröffentlichtes, mit Datum und Ablauf: Auflösung `anilist → ak` mindestens sechs Monate nach Abschalten von AniList als Quelle, dann entscheiden).
- **Migration einmalig:** `ak` für alle Bestandstitel aus der AniList↔aniSearch-Brücke (`data/anisearch.json`, 2.636 Titel), Handbelege und Dateien einmal von
  `anilistId` auf `ak` umschreiben (Skript mit Vorher/Nachher-Vergleich der Bau-Ausgabe, getrennt von jeder Verhaltensänderung). Titel ohne aniSearch-Zuordnung bekommen
  `ak` und `aniSearch` leer — sichtbar als Lücke statt gestrichen.

## Warum nicht die aniSearch-Kennung als Schlüssel

Sie wäre die kürzeste Lösung, bindet uns aber an eine zweite Quelle mit derselben Schwäche (Zusammenlegungen, Umbenennungen, mögliche Sperre — am 09.08.2026 sperrte
aniSearch uns schon einmal). Eine eigene Zahl kostet eine kleine Tabelle und macht jede Quelle austauschbar.

## Entschieden (Daniel, 04.10.2026, 21:32)

1. **Eigene Kennung `ak`: ja.** Alle Quellkennungen (aniSearch, TMDB, MAL …) werden intern auf unsere Kennung gemappt. **AniList wird nicht gemappt**,
   außer wo noch eine Abhängigkeit besteht; die Cover bleiben als statische Links am Titel (`coverImage`), sie brauchen die AniList-ID nicht. Im ersten Zug darf alles
   gemappt werden, damit nichts bricht — besser ist, die AniList-Kennungen direkt zu streichen, sobald nichts mehr an ihnen hängt.
2. **Keine Rückwärtskompatibilität.** Ungültige Adressen (`t=<alte ID>`, alte Teilen-Seiten) leiten auf die Startseite weiter. Keine Alias-Tabelle.
   *Folge, die mitgedacht sein muss:* Favoriten im Browser (`localStorage`) und im Newsletter-Konto (D1) hängen an den alten IDs und gehen mit der Umstellung verloren, wenn sie
   nicht einmalig umgeschrieben werden. Mein Vorschlag: eine einmalige Umschreibung im Browser (Tabelle alt→neu, nur beim ersten Laden, danach weg) und im Worker (einmaliges
   Skript); die Entscheidung dazu steht aus.
3. **Umstellung vor dem Katalog-Lauf.** Durch die Zuordnung ändert sich für den Besucher nichts, vorher oder nachher.

## Plan in Stufen

- **Stufe 0 (additiv) — erledigt am 04.10.2026:** `tools/kennungen-erzeugen.mjs` hat `data/kennungen.json` erzeugt (17.945 Titel aus Bestand und „ohne Synchro", davon 6.769 mit aniSearch-Kennung, 38 %; der Rest bekommt sie mit dem Katalog-Lauf nachgetragen, Lauf wiederholbar). Idempotent, nur ergänzend. Ursprünglicher Auftrag: `data/kennungen.json` erzeugen: je Titel `[ak, anilist, aniSearch?]`, fortlaufend, nur anhängen, nie neu vergeben; Skript idempotent. Noch liest nichts daraus.
- **Stufe 1 (Grenze):** Die Pipeline arbeitet intern weiter mit der AniList-ID, übersetzt aber an der Ausgabe: `titles.json`, Releases, News, Folgenlisten, Teilen-Seiten, Adressen
  tragen `ak`. Web und Worker kennen nur `ak`. Vorher/Nachher-Vergleich mit `tools/bau-vergleich.mjs` bis auf die Schlüssel.
- **Stufe 2 (Kern):** Handbelege (`dub-confirmed.yaml`), kuratierte Termine, Gedächtnisdateien und Caches wandern auf `ak` (Skript, Vorher/Nachher). Die AniList-Spalte entfällt,
  sobald die letzte Lesestelle weg ist (`grep anilistId` ist die Messlatte).
- **Neue Titel** (aniSearch-Katalog, Ankündigungen) bekommen beim ersten Sehen eine `ak`; wegfallende bleiben mit `status`.

## Adressen vereinheitlichen (Daniel, 04.10.2026 22:49)

Befund: Klickt man im Wochenkalender eine Karte an, lautet die Adresse `/r/tokyo-revengers-s3-disneyplus/#/woche`; die Karte daneben führt auf `/r/hana-kimi-s2/#/woche` (kein Anbieter),
die übernächste auf `/r/cr-GYZJ43JMR/#/woche` (weder Titel noch Anbieter). Grund: `/r/<Kennname des Termins>` — der Kennname ist bei kuratierten Terminen frei gewählt, bei
automatisch angelegten Crunchyroll-Terminen `cr-<Serienkennung>`. Dazu gibt es die Titelseiten `/t/<Name>-<AniList-ID>/` und im Fenster `#/datenbank?t=<AniList-ID>`.

**Vorschlag, mit Stufe 1 der eigenen Kennungen zusammen** (alles andere wäre eine zweite Umstellung):
- **Eine Adresse für alles: `/t/<ak>/`** — die eigene Kennung des Titels, ohne Anbieter und ohne Namen. Ob Karte im Kalender, Karte in der Datenbank, Teilen, Newsletter oder
  Kalenderdatei: dieselbe Adresse; welcher Termin gemeint ist, zeigt das Panel (der Anbieter steht im Datensatz, nicht in der Adresse).
- **`/r/…` entfällt**; ungültige Adressen leiten auf die Startseite (Daniel: keine Rückwärtskompatibilität). Im Fenster heißt der Parameter `t=<ak>`.
- Die Teilen-Seiten (`pipeline/build-share-pages.ts`, für Vorschaubilder) werden je Titel als `/t/<ak>/` erzeugt statt je Titel und Termin; das spart rund 620 Dateien.
- Stellen, die heute `#/release/<slug>` oder `/r/<slug>` schreiben: Kalenderdatei (`shared/ics.ts`, Beschreibung), Newsletter (`worker/src/mail-abschnitte.ts`),
  Teilen-Knopf (`useShare`), RSS, Panel-Router. Sie ziehen in Stufe 1 gemeinsam um.

## Stufe 1: Inventar der Ausgabe (gemessen 04.10.2026, 23:40)

Wo die AniList-ID heute in `public/data/` und darum herum steht und beim Umstellen mitwandert:
- **Felder:** `id` (titles, titles-core, ohne-synchro, franchises-Einträge; bei `cartoons.json` negative TMDB-Kennungen, die bleiben), `titleId` (releases, events), `titelId` (news), dazu `slug` mit angehängter ID (`cowboy-bebop-1`, Teilen-Seiten `/t/<slug>/`).
- **Schlüssel:** `franchises.json` und `reihen.json` (Reihe → Mitglieder), `folgen/<id>.json`, Gruppendateien `synopses/<n>.json`, `disc/<n>.json`, `voices/`.
- **Außerhalb des Webs:** `data/news-historie.json`, Favoriten im Browser (`localStorage`) und im Worker (D1), Erweiterung (Meldungen nennen Titel), `shared/ics.ts`, `worker/src/mail-abschnitte.ts`, `templates.ts`, `pruefung-stand.ts`, RSS.
- **Web:** rund 140 Stellen lesen `.id` (`grep -rnE "\.(id|anilistId|titleId)\b" web/src`).

**Vorgehen, damit kein Schritt die Seite bricht:** (1a) ein Modul `shared/kennung.ts` mit `akVon(anilist)`, beim Schreiben der Ausgabe an genau einer Stelle je Datei angewandt; (1b) `bau-vergleich` bis auf die Schlüssel gleich; (1c) Web, Worker, Erweiterung und Favoriten-Umschreibung in einem Zug, weil sie dieselbe Datei lesen; (1d) Adressen `/t/<ak>/` und `/r/` entfällt. 1a bis 1d gehören in **eine** zusammenhängende Sitzung mit Live-Prüfung; als Nachtlauf ohne Beobachter ist das Risiko zu hoch (Favoriten gehen sonst verloren).

## Stufe 1 umgesetzt (05.10.2026, Daniel: „los", Favoriten nur befristet)

**Bauweise gegenüber dem Plan oben geändert:** Nicht jede Ausgabedatei der Pipeline schreibt `ak`, sondern `public/data/` bleibt intern bei der AniList-Kennung (alle Prüfungen,
`bau-vergleich`, Handbelege und Gedächtnisdateien bleiben unberührt). Die **Übersetzung geschieht beim Seitenbau**: `tools/vite-kennungen.ts` (Vite-Baustein) ruft nach `vite build`
`pipeline/lib/ausgabe-kennung.ts` auf und schreibt `dist/data/` um; im Entwicklungsserver liefert er eine umgeschriebene Kopie unter `/data/`. Eine Datei, ein Ort, kein Rücklesen.
Übersetzt werden Titel (`id`, `franchiseId`, `slug` = Kennung, `al` = AniList für den Quellenverweis), Termine, Ereignisse, News, Meldungen, Reihen, Synonyme, Folgenzählung,
die Teildateien `synopses/`, `disc/` (neu nach `ak % 32` gruppiert), `folgen/`, `voices/`. Cartoons (negative TMDB-Kennung) bleiben. Dazu entsteht `dist/data/anilist-ak.json` (`[[ak, anilist], …]`).
**Vollständigkeit:** `tools/kennungen-erzeugen.mjs` läuft am Ende jedes Datenbaus (`pipeline/bau/13-6-kennungen.ts`) und vergibt auch für Reihen-Mitglieder, Termine und Meldungen eine
Kennung (Stand 05.10.2026: 17.966 Zeilen); fehlt eine, bricht der Seitenbau mit Klartext ab.
**Gemessen** (Kopie von `public/data`, 05.10.2026): Anzahl, Reihenfolge und alle Verweise gleich bis auf die Schlüssel; Teildateien in der richtigen Gruppe; Releases ohne Titel vorher und nachher 1.

**Adressen:** `/t/<ak>/` (Teilen-Seiten je Titel, `build-share-pages.ts`), `#/…?t=<ak>`. Termin-Seiten `/r/<slug>/` und `r=<slug>` bestehen noch (**Schritt 1d offen:** `/r/` entfällt, die Karten öffnen den Titel).

**Favoriten (Karenz bis 05.11.2026):** Browser: `web/src/lib/kennung-umzug.ts` schreibt `favorites`, `hidden`, `favorites:seit`, `gesehenBis` einmal um (Marke `kennung:ak1`), vor dem ersten Rendern.
Worker: neue Listen tragen den Vorsatz `ak:` (der Browser schickt `ak: 1`), Listen ohne Vorsatz werden beim Lesen über `anilist-ak.json` der Seite umgerechnet
(`worker/src/favoriten-kennung.ts`); kein Schemawechsel in D1. **Am 05.11.2026 entfernen:** `kennung-umzug.ts` (samt Aufruf in `main.tsx`), den Zweig ohne Vorsatz und `ladeAbbild`
im Worker, `anilist-ak.json` aus `ausgabe-kennung.ts`. `check:logic` wird an dem Tag rot (Zusicherung „Favoriten-Umschreibung … ausgelaufen").
**Werkzeuge:** Prüfwerkzeuge, die die ausgelieferte Seite öffnen, übersetzen ihre Fälle mit `tools/ak-von.mjs`; `tools/panel-vergleich.mjs` vergleicht über diese Grenze hinweg nicht (Stand vor Stufe 1 kennt `ak` nicht).

## Stufe 1d umgesetzt (05.10.2026): eine Adresse für alles

`/r/<slug>/` und `r=` sind weg. Ein Klick auf eine Karte öffnet den **Titel** (`#/…?t=<ak>`, Pfad `/t/<ak>/`); kam der Klick von einem Disc-Termin, steht `disc=1` im Hash und der Stream/Disc-Umschalter startet auf „Disc"
(`AppRoute.disc`). `build-share-pages.ts` schreibt je Titel eine Seite: Hat er Termine, ist es die bisherige Termin-Seite des nächsten (sonst letzten) Termins samt Strukturdaten, sonst die schlichte Titelseite;
die Sitemap kennt nur noch `/t/` (2.790 Adressen statt 3.521), Übersicht und Startseite verlinken die Titelseiten. Mail-Link, Kalenderdatei (`Details:`) und Teilen-Knopf nutzen `/t/<ak>/`.
**Ungültige Adressen** (`/r/…`, `/t/<alter Name>/`) landen über `public/404.html` auf der Startseite. Die Vorschaubilder `og/<Termin>.jpg` hängen weiter an den Termin-Adressnamen und werden noch gebaut (`og:image` der Titelseite).
