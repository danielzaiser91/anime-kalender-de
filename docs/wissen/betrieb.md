# Betrieb: Läufe, Worker, Git, Prüfungen

Ausgelagert aus `CLAUDE.md` am 18.09.2026, wortgleich. **Wann lesen:** Vor Änderungen an `.github/workflows`, `worker/`, `tools/commit-data.sh`, an Zusicherungen, und bei jedem roten Lauf.

## Statusanzeige und Erweiterung lesen denselben Stand — den des Workers

Daniel am 14.09.2026, mit zwei Bildern: Die Statusanzeige zeigte „Amazon 6 · Suchadressen 6" und keine Netflix-Pille, die Erweiterung auf Prime „2 Prime-Titel zu prüfen" — aus derselben Prüfliste. „wieso passen pills nicht zum echten status? das sollte doch single source of truth sein."

Drei Rechnungen, drei Fehler:

| Stelle | rechnete | was fehlte |
|---|---|---|
| `extension-offene-amazon.mjs` | schrieb den Grund einer Wiedervorlage ins Feld `wiedervorlage` | **keine Stelle liest es** — `amazon.js` fragt `erneut`, `pruefstand.mjs` zählt `eintraege[].offen`, und das stand für Verdachtsfälle auf `false` |
| `public/data/pruefstand.json` | aus den Listen des letzten vollen Laufs | ich hatte nach der Änderung nur zwei der sechs Generatoren laufen lassen |
| `amazon.js` | Meldungen **aller Zeiten** plus zwei lokale Speicher (`amazonErledigt`, `amazonWiedervorlage`) | ein früher gemeldeter Titel blieb ausgeblendet, auch wenn die Liste ihn neu vorlegt |
| `build.ts` (Suchadressen) | schrieb `data/suchadressen-offen.json` nur, wenn etwas offen war | beim Übergang auf „nichts offen" blieb die Datei mit sechs längst geklärten Titeln stehen — die Pille „Suchadressen 6" zählte Arbeit, die es nicht gab |

Seitdem: Eine Wiedervorlage trägt `erneut` und ist offen; die Kette läuft nur ganz (`npm run data:extension-liste`); und `fertig()` in `amazon.js` fragt zuerst `?stand=1` — **dieselbe Antwort, die die Statusanzeige zeigt**. Lokal überbrückt nur noch `frischGemeldet` die Sekunden nach der eigenen Meldung. Der Netflix-Melder hatte dieselbe Lücke eine Stufe versteckter: Er holte den Stand seit dem 26.08.2026, las daraus aber nur `offen` für eine Nebenzeile — Zahl und Liste kamen weiter aus `erledigt`. Am selben Tag zeigte die Statusanzeige „Netflix 2", die Prüfliste „1 Titel" (FGO Babylonia als gemeldet, obwohl als Zuordnungsauftrag neu vorgelegt). Seit 4.20.4 fragt auch dort `fertig()` die offenen Adressen des Stands. **Und der Prüfstand führt alle Ziele, nicht 25** — sonst gälte Eintrag 26 in beiden Erweiterungen als erledigt.

**Prüffrage für jede neue Zahl „offen" in einer Oberfläche:** *Rechnet sie selbst, oder liest sie `?stand=1`?* Rechnet sie selbst, läuft sie früher oder später auseinander — hier dreimal in drei Wochen.

**Und am Tag danach ein viertes Mal, in derselben Datei.** Daniel am 15.09.2026: Statusanzeige „8 Titel · 3 Suchen", Erweiterung „8 Prime-Titel · 2 Suchen offen". Umgestellt hatte ich am 14.09. nur `fertig()` für Titelseiten; die Suchen zählt `istGemeldet()`, und die las weiter Meldungen aller Zeiten. Die neue Ausgaben-Suche „Bungo Stray Dogs" trägt wörtlich die Adresse einer Suche, die Wochen vorher gemeldet worden war. Seit 4.20.6 fragt `istGemeldet()` für jede Adresse der Prüfliste zuerst den Stand; die Stand-Probe in `amazon-startseite-pruefen.cjs` zählt jetzt Titel **und** Suchen (Gegenprobe ohne die Regel: „1 Prime-Titel offen"). **Wer eine Zahl auf eine Quelle umstellt, sucht vorher jede Stelle, die zur selben Anzeige beiträgt** — hier stand sie im selben Knopftext, eine Funktion weiter.

**Fünfter Fall, eine Ebene tiefer: der Worker selbst.** Am 15.09.2026 zeigte Nukitashi „gemeldet ✓" ohne Melde-Knopf, obwohl der Stand den Titel als offen führte, und bei Touken Ranbu verschwand der Knopf. `?zaehlen=1` lieferte `gemeldeteSeiten` über **alle** Meldungen, während die Ziele in `?stand=1` nur Meldungen nach `erzeugtAm` des Prüfstands abziehen. Eine eingearbeitete Kanal-Meldung ohne Urteil sperrte ihre Seite damit dauerhaft. Seitdem zählt auch `gemeldeteSeiten` erst ab `erzeugtAm`. **Zwei Felder derselben Antwort mit zwei Zeitfenstern sind zwei Quellen**, auch wenn sie aus einer Tabelle kommen.

**Sechster Fall, am selben Abend: die Sekunden vor der Antwort.** Solo Leveling zeigte „gemeldet ✓" neben dem Melde-Knopf (4.20.19, Bericht 20:13). Bevor `?stand=1` und `?zaehlen=1` geantwortet hatten, fiel `fertig()` auf eine lokale Meldung von 11:07 zurück und `seiteOffen()` auf „nicht offen"; „alles gemeldet" griff, merkte sich den Pfad, und nichts nahm die Marke zurück. Seit 4.20.20 verlangt der Zweig beide Antworten, und seine Marke hat einen eigenen Merker, der wieder fällt. **Ein Rückfall für „noch keine Antwort" darf nichts für erledigt erklären** — dieselbe Unterscheidung wie „keine Antwort" gegen „Antwort ohne Inhalt" in der Statusanzeige.

## Sammeln und Zusammenführen sind zwei Läufe — nur der zweite darf rot werden

Daniel am 30.08.2026: „mach die läufe stabil. wöchentlich und stündlich sollte nie
rot sein können, alles was sie machen ist sammeln und liefern. sie müssen keine
merge conflicts etc fixen, sie können irgendwo erstmal alles ablegen, das mergen
in bestand muss separat passieren.“

Der Anlass waren zwei rote Läufe an einem Tag, beide mit fertiger Arbeit:

| Lauf | woran er starb | woran es **nicht** lag |
|---|---|---|
| Wöchentlich (33313062428) | `check:bestand` fand einen Widerspruch im gebauten Datensatz | 58 Minuten Abrufe von fünf fremden Servern, alle durchgelaufen |
| Stündlich (33312972636) | eine doppelte `url:`-Zeile, geschrieben von einem **früheren** Lauf | der Lauf selbst hatte nichts falsch gemacht |

Seitdem gilt:

- **Die drei planmäßigen Läufe holen und reichen ein — sie schreiben nicht auf
  `main`.** `tools/quellen-pr.sh` legt den Fund auf einen Zweig `daten/<lauf>`,
  öffnet einen Pull Request und mergt ihn **nur**, wenn GitHub `MERGEABLE`
  sagt. Jeder Abruf trägt `continue-on-error`; fällt eine Quelle aus, macht der
  Rest weiter.
- **Bleibt ein Pull Request wegen eines Konflikts offen, übernimmt
  `Claude — Daten-PR zusammenführen`** — der einzige Ort im Projekt, an dem ein
  Konflikt in Datendateien aufgelöst wird. Daniel dazu: „So ist es sicherer.
  Weil wenn die läufe committen könnte es trotzdem zu conflicts führen.“

  Der Unterschied zum alten Weg ist nicht die Vorsicht, sondern **wer
  entscheidet**. `commit-data.sh` löst jeden Konflikt selbst auf: hart auf den
  Fernstand, eigene Quellen darüber. Das ist schnell und meistens richtig — am
  29.08.2026 hat genau dieser Reset 19 berichtigte Handbelege wieder auf ihren
  alten Stand gesetzt.

  **Angestoßen wird per `workflow_run`, nicht per `workflow_dispatch`.** Ein
  Workflow, den das GITHUB_TOKEN auslöst, startet keine weiteren Workflows;
  der Merge-Lauf hängt deshalb hinter den Sammlern und sieht selbst nach, ob
  ein `daten/*`-Zweig offen ist. Ist keiner offen, endet er in Sekunden, ohne
  Claude zu starten.

  **Was Claude zusammengeführt hat, baut erst der nächste planmäßige Lauf.**
  Den Bau an den Merge-Lauf zu hängen wäre naheliegend und falsch: Er endet
  auch dann grün, wenn er nichts zu tun hatte — also bei fast jedem Zyklus.
  Der Bau liefe dann 26-mal am Tag doppelt, jedes Mal mit einer Zeile in der
  Statusanzeige. Ein Konflikt ist der Ausnahmefall, und eine Stunde Verzug ist
  dort verkraftbar.
- **`Bestand — zusammenführen und bauen` führt zusammen**: Meldungen einarbeiten,
  Rohfolgen zuordnen, bauen, Arbeitslisten, Vorschaubilder, `check:bestand`,
  `data:check`. Er hängt per `workflow_run` an allen dreien und **darf rot
  werden** — wird er es, ist wirklich etwas am Bestand kaputt.
- **Der Deploy hängt jetzt an ihm**, nicht mehr an den Sammlern: Die bauen keinen
  Datensatz mehr, den man ausliefern könnte.

**Und seit dem 17.09.2026 wird auch der Bau nicht mehr durch Daten rot.** Neue
Handbelege aus dem Briefkasten gehen erst durch `check:logic`, bevor der Bau sie
sieht; nach dem Bau prüft `commit-data.sh` `check:bestand` **und** `check:logic`.
Verletzt etwas eine Zusicherung, nimmt der Lauf die neuen Meldungen zurück, sie
bleiben im Briefkasten (abgehakt wird erst nach dem Commit, `--abhaken-spaeter` /
`--nur-abhaken`), und die Statusanzeige zeigt den Lauf **gelb** (`warnung`) mit
Grund — keine Fehlermail. Rot bleibt für Code, also meist für meinen Push. Anlass:
Nachtmeldungen am Reihenkopf machten drei Deploys rot, weil sie ungeprüft als
Quelle committet wurden. **Eine gelbe Karte wird behandelt wie eine rote.**

**Prüfwerkzeuge (12.10.2026):** `npm run check:logic` bricht beim ersten roten Ergebnis ab;
`npm run check:logic -- --alle` lässt alle laufen und listet am Ende jede rote Prüfung (Exit 1).
`check:panel` und `check:ansichten` melden mit dem Befehl `npm run build`, wenn `dist/` fehlt oder
älter als `web/src` ist (baut nie selbst). `commit-data.sh` nimmt für `DATEN_WARNUNG` auch Zeilen
mit `FEHLER:` auf (Test in `commit-data-test.sh`).

**Der Alarm über stumme Quellen wandert mit.** Ein Sammler, der eine Quelle nicht
erreicht, ist kein Fehler — dass sie seit Tagen schweigt, schon. `data:check`
steht deshalb im Bau-Lauf, an der Stelle, die es beurteilen kann.

## Ein neuer Abruf braucht drei Dinge, nicht eines

Ein Abrufskript zu schreiben ist der kleinere Teil. Ohne die beiden anderen ist es entweder
wirkungslos oder es macht Lärm:

1. **Ein Platz in einem Workflow.** Sonst läuft es genau einmal — von Hand — und veraltet danach
   still. Am 16.08.2026 standen `data:ann:ids`, `data:ann:voices` und `data:cr-dub` in keinem
   einzigen Workflow; die ANN-Daten wären nach der ersten Nacht eingefroren.
2. **Eine Zeile in `tools/commit-data.sh`.** Sonst wirft der `git reset` im CI-Lauf weg, was
   gerade geholt wurde. Die Prüfung in `tools/check-workflows.mjs` fängt das ab — **seit dem
   24.08.2026 auch wirklich.** Bis dahin las sie nur `.ts`-Dateien und suchte nur nach
   `writeJson('data/…')`; vier Dateien fielen durch beide Maschen und gingen in **jedem**
   CI-Lauf verloren: `youtube-befunde.json`, `rtlplus-befunde.json`, `motn-changes.json`,
   `curated/disc-anisearch.yaml`. Sichtbar war es nur am Commit-Datum — alle vier zuletzt
   durch einen lokalen Lauf beschrieben, obwohl zwei davon täglich bzw. wöchentlich geholt
   werden. Jetzt zählt **jedes** `data/…`-Literal in einer Datei, die überhaupt schreibt. Das
   meldet auch reine Lesepfade mit, und das ist die richtige Seite zum Irren: Eine Datei zu
   viel in der Liste wird beiseitegelegt und unverändert zurückgelegt; eine zu wenig kostet
   die Arbeit jedes Laufs, und zwar still.
3. **Eine Frist in `pipeline/check-sources.ts`.** Die Vorgabe sind vier Tage, und die passt nur
   für tägliche Abrufe.

**Punkt drei ist der, den man vergisst.** Der ADN-Katalog wird wöchentlich geholt, montags um
5:41. Gegen die Vier-Tage-Frist gemessen meldet er sich ab jedem Freitag als stumm — am
16.08.2026 kam deshalb eine Fehlermail für einen Lauf, an dem nichts kaputt war. Eine Warnung,
die jede Woche zuverlässig zu Unrecht kommt, ist schlimmer als keine: Man hört auf hinzusehen,
und die echte Störung geht darin unter.

Die Frist ist die Taktung plus zwei Tage Luft. Ein ausgefallener Lauf soll noch keinen Alarm
auslösen, zwei hintereinander schon.

**Der Wecker-Plan gehört zu Punkt eins (13.10.2026).** Ein Workflow, der nur per `workflow_dispatch` startet, läuft nie, solange er nicht in `shared/weckplan.ts` steht — `offizielle-news.yml` blieb so ungestartet. `node tools/zugangs-waechter.mjs --register-pruefen` (in `check:workflows`) verlangt für jeden solchen Workflow einen Plan-Eintrag oder einen Eintrag mit Grund in `OHNE_WECKPLAN` (`tools/zugangs-waechter.mjs`).

## `git add` bricht ganz ab, wenn ein Pfad fehlt — und `2>/dev/null` verschweigt es

Vom 03. bis zum 06.09.2026 hat „Täglich — alle Quellen" **nichts eingereicht**.
Der Lauf endete grün, arbeitete nachweislich und meldete danach „Keine Änderung
an den Quellen". Neun geänderte Dateien lagen in seinem Arbeitsverzeichnis,
darunter `data/source-health.json`, `data/adn.json` und `data/crunchyroll.json`.

Zwei Eigenschaften einer einzigen Zeile ergeben zusammen einen stillen Ausfall:

```
git add -- "${QUELLEN[@]}" 2>/dev/null || true
```

1. **`git add` ist alles-oder-nichts.** Ein Pfad, den es nicht gibt, beendet den
   Aufruf mit `fatal: pathspec … did not match any files` — die 81 anderen
   werden **nicht** gestagt. Hier fehlte
   `daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md`, eine Liste, die nur
   bei Bedarf entsteht und seit dem 03.09. zu Recht fehlt.
2. **`2>/dev/null || true` verschweigt genau die Zeile, die es sagt.** Nach außen
   war der Lauf grün und "hatte nichts zu tun".

**Was es gekostet hat:** vier Tage eingefrorene Quellen-Zeitstempel, eine
gerissene Frist in `check-sources.ts`, drei rote Bauten und ein Deploy, der ab
14:16 stand. Der Alarm hat funktioniert — er zeigte auf die Quellen, während die
Ursache eine Ebene tiefer lag.

**Zwei Regeln daraus:**

- **Ein erlaubter Fehlschlag wird gezählt, nicht stummgeschaltet.** Wo `|| true`
  steht, gehört eine Ausgabe daneben: was fehlgeschlagen ist und wie oft. Sonst
  sieht ein Lauf, der nichts tut, genauso aus wie einer, der nichts zu tun hatte.
- **Eine Sammelaktion über eine Liste wird je Eintrag ausgeführt**, wenn einzelne
  Einträge fehlen dürfen. `quellen-pr.sh` stagt deshalb in einer Schleife und
  meldet „1 von 82 Pfaden gibt es gerade nicht".

**Und der Prüfgriff, der es gefunden hat, gehört zum Vorgehen:** Drei Vermutungen
(QUELLEN-Liste, `.gitignore`, Schreibweg) waren ausgeschlossen, ohne dass eine
weiterführte. Erst eine **Messstelle im Lauf selbst** — `git status --porcelain`
vor dem Stagen, `git add` ohne `2>/dev/null` — beantwortete die Frage, und zwar
im ersten Versuch.

## `git push | tail` verschluckt den Fehlschlag

Am 29.08.2026 sind drei Commits eine halbe Stunde lang nicht im Repo
angekommen, obwohl die Ausgabe jedes Mal „gepusht" meldete. Der Grund steht in
der Befehlskette:

```
git push -q 2>&1 | tail -1 && echo gepusht
```

Der Rückgabewert einer Pipe ist der des **letzten** Glieds — `tail` gelingt
immer. Der abgelehnte Push (`! [rejected] main -> main (fetch first)`) rutscht
als Textzeile durch, und `echo` läuft trotzdem.

Richtig ist, den Rückgabewert direkt zu prüfen:

```
git push -q; echo "push exit=$?"
```

Aufgefallen ist es nur, weil ein späterer `git log --oneline origin/main` die
eigenen Commits nicht enthielt. Ohne diesen Blick wäre die Arbeit eines ganzen
Abschnitts liegen geblieben — sichtbar erst beim nächsten Datenlauf, der auf
einem Stand ohne sie gebaut hätte.

## Merge-Konflikt in der News-Historie (25.10.2026)

Die News-Historie ist einzeilig, jeder Bestandsbau ändert sie; ein PR, der sie ergänzt, kollidiert deshalb fast sicher. Bei diesem Konflikt nicht von Hand lösen, sondern `node tools/news-historie-zusammenfuehren.mjs <basis> <pr> <main> <ziel>` aufrufen (Stände per `git show <merge-base>:…`, `HEAD:…`, `origin/main:…`): es überträgt nur die PR-Änderungen auf main, behält das main-Format und bricht bei verschiedenen Änderungen desselben Felds mit Exit 1 ab.

## Eine Migration wird angewandt **und** gebucht — sonst läuft die Buchführung weg

Bis zum 10.09.2026 führte `wrangler d1 migrations list` elf Migrationen (018
bis 028) unter „Migrations to be applied", obwohl der Worker ihre Spalten seit
Wochen liest und schreibt. Sie waren einzeln über `d1 execute --file=…`
angewandt worden, und die Tabelle `d1_migrations` wusste davon nichts.

**Das ist keine Kosmetik, es ist eine Falle mit Zeitzünder.** Wer irgendwann
`migrations apply` ausführt, fährt alle elf erneut: Die
`CREATE TABLE IF NOT EXISTS` sind harmlos, ein `ALTER TABLE ADD COLUMN` auf eine
vorhandene Spalte bricht ab — **mitten im Stapel**, mit halb nachgetragener
Buchführung. Genau deshalb wurde jede neue Migration von Hand angewandt, und
genau deshalb wuchs der Rückstand weiter.

**Nachgetragen wurde nur die Buchführung**, nicht das Schema, und jede Zeile
gegen die Produktivdatenbank belegt: drei Spalten in `pruefung`
(`seiten_kennung`, `titel_id`, `folge`), zwei in `subscribers`, fünf Indizes,
die Tabellen `such_erwartung` und `vorfall`. Der Beleg mit allen Prüfabfragen
steht in `docs/d1-migrationen-nachgetragen-2026-09-10.sql`.

**Ab 029 gilt wieder der normale Weg:**

```bash
cd worker && npx wrangler d1 migrations apply anime-kalender --remote -c wrangler.toml
```

**Gemessen am 18.09.2026: `migrations list/apply` scheitert von hier mit „account is not valid or not authorized [code: 7403]“, `d1 execute` klappt mit demselben Konto.** Migration 031 lief deshalb über `execute --file` plus Buchung wie unten.

**Am 21.09.2026 scheiterte auch `d1 execute` mit 7403** — die angemeldete Wrangler-Sitzung trug nicht mehr. Mit dem API-Token „anime-kalender-deploy" aus `my_secrets.md` (Abschnitt Newsletter) ging dieselbe Abfrage sofort: `export CLOUDFLARE_API_TOKEN=…` vor den Aufruf. Das ist der verlässlichere Weg, weil er nicht an einer Browser-Anmeldung hängt, die still abläuft.

**Und wenn eine Migration doch einmal von Hand laufen muss** — weil sie einen
Sonderfall hat, den der Mechanismus nicht kann —, gehört die Buchung in
denselben Handgriff:

```sql
INSERT INTO d1_migrations (name) SELECT '<datei>.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '<datei>.sql');
```

Die allgemeine Form steht schon zweimal in dieser Datei, einmal für Abrufe
(„Ein neuer Abruf braucht drei Dinge, nicht eines") und einmal für Daten („Eine
Datei zu schreiben ist nicht dasselbe wie sie zu benutzen"): **Ein Vorgang ist
erst fertig, wenn auch das mitgeführt ist, was ihn später wiederfindet.**

## Der Worker wird aus `worker/` ausgeliefert, nicht aus der Wurzel

```
cd worker && npx wrangler deploy --config wrangler.toml
```

**Ausliefern macht der Agent selbst**, nach jedem geprüften Commit unter `worker/src`, ohne
Rückfrage (Daniel, 02.10.2026: „worker auslieferung in zukunft selber machen").

**Aus der Wurzel bricht es ab**, und die Meldung führt in die Irre: „The
`assets` property in your configuration is missing the required `directory`
property" (29.08.2026) — und **`cd worker` allein genügt nicht**, das `--config` gehört dazu. Bis 17.10.2026 fand wrangler sonst die Wurzel-`wrangler.jsonc`
der **Web-Anwendung**; seitdem heißt sie `wrangler.web.jsonc` (nur Assets, kein `main`, keine Bindung,
Wächter `tools/web-hosting.test.ts`), ohne `--config` findet wrangler in der Wurzel keine Config. Der Newsletter-Worker hat seine eigene
Konfiguration in `worker/wrangler.toml`, mit `main`, Cron und D1.

Zwei Konfigurationen in einem Repo sind kein Versehen: Die Wurzel liefert die
Seite aus, `worker/wrangler.toml` den Dienst dahinter. Verlässlich entscheidet
nur der ausgeschriebene `--config`, welche gilt — der Aufrufort allein tut es
nicht.

## Der Cloudflare-Token liegt nicht im Repo — und wie er als GitHub-Secret ankommt

**Wo er steht:** `C:\code\ai\ai helper files\my_secrets.md`, Abschnitt „Newsletter anime-kalender-de"
(API-Token `anime-kalender-deploy`: D1 Edit, Workers Scripts Edit, Account Settings Read und
**Account Analytics Read**). Der Wert liegt **außerhalb** des Repos — Absicht: Ein Schlüssel in der
Historie ist nicht mehr zurückzuholen.

**Wofür die Analytics-Berechtigung** (28.09.2026 ergänzt): `wrangler d1 insights` und damit
`tools/d1-verbrauch.mjs` lesen die GraphQL-Analytics-API; sie brauchen `Account · Account Analytics ·
Read`. Nachträglich ergänzen geht über *Edit* am Token — **der Wert bleibt dabei gleich**, nur *Roll*
erzeugt einen neuen (dann müssen alle Stellen nachziehen, die ihn benutzen).

**Als GitHub-Secret setzen, ohne den Wert auszugeben:** über **stdin**, nicht über `--body` und
nicht über eine Datei in der Kommandozeile —

```js
execFileSync('gh', ['secret', 'set', 'CLOUDFLARE_ANALYTICS_TOKEN', '--repo', 'danielzaiser91/anime-kalender-de'], { input: wert })
```

**Vorher prüfen, ob der Wert überhaupt gilt** (die Antwort nennt kein Geheimnis):

```
curl -s -H "Authorization: Bearer $TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify
```

**Danach:** `gh workflow run d1-verbrauch.yml` — der Lauf liest die Zahlen und wird rot, wenn der
Tagesverbrauch über 2,5 Mio. Zeilen steigt oder eine einzelne Abfrage über 1 Mio. (Grenzen in
`tools/d1-verbrauch-bewertung.mjs`, Fenster seit 14.10.2026 der UTC-Tag). Am 28.09.2026 war der erste Lauf rot — er zeigte den Tag *vor* den
Korrekturen; ab dem nächsten Tag muss er grün sein.

## Der Worker läuft dem Web-Client immer hinterher

**Neue Endpunkte sind erst da, wenn `wrangler deploy` gelaufen ist — die Seite ist es schon beim
nächsten Push.** Zwischen beidem liegt ein Fenster, in dem der Client eine Route anspricht, die
es noch nicht gibt. Der Worker antwortet dann mit `404 Unbekannter Pfad`, und das sieht genauso
aus wie „dieses Abo gibt es nicht".

Am 15.08.2026 hat genau das Daniels Newsletter-Verbindung gekappt: Die neue Abfrage `/prefs`
bekam vom laufenden Worker ein 404, wertete es als erloschenes Abo und rief `clearSyncToken()`.
Sichtbar war es als Flackern — die verbundene Ansicht erschien für unter einer Sekunde und
sprang dann zurück.

Daraus zwei Regeln:

- **Ein 404 darf nur dort etwas löschen, wo die Route sicher existiert.** Über den Bestand eines
  Abos entscheidet allein `/favorites`; jede andere Abfrage meldet einen Fehler und lässt den
  Schlüssel in Ruhe.
- **Zerstörende Schlüsse brauchen einen zweiten Beleg.** „Der Server antwortet nicht wie
  erwartet" ist kein Beweis dafür, dass Nutzerdaten weg sind — es ist meist der Beweis, dass ein
  Deploy fehlt.

## Die Statusanzeige wird benachrichtigt, sie fragt nicht mehr nach

Daniel am 30.08.2026: „status app muss automatisch mitbekommen wenn es sich
ändert. bau ein eventing system ein, sodass es sofort benachrichtigt wird
(websocket oder sonstiges).“

Der Worker hat dafür ein **Durable Object** (`worker/src/ereignisse.ts`). Ein
Worker lebt je Anfrage und kann keine Verbindung halten, über die er eine
zweite Anfrage benachrichtigt; ein Durable Object gibt es genau einmal und es
weiß, wer zuhört. Auf Cloudflare ist das der einzige Weg zu echtem Push.

- **`GET /ereignisse`** nimmt den WebSocket an — ohne Token: Was dort fließt,
  ist die Nachricht „es hat sich etwas geändert“, keine Daten.
- **Gesendet wird bei jeder Meldung** (`POST /pruefung`) **und jeder
  Lauf-Änderung** (`POST /lauf`), immer über `ctx.waitUntil` — der Melder
  wartet nicht auf den Versand.
- **Die Sockets laufen über `acceptWebSocket`**, nicht `accept()`. Damit darf
  Cloudflare das Objekt schlafen legen, während nichts passiert; eine Anzeige,
  die den ganzen Tag offen steht, kostet dann nichts.

Gemessen am 30.08.2026: Ereignis **308 ms** nach dem Auslösen beim Client —
vorher bis zu 60 Sekunden.

**Der Takt bleibt trotzdem.** Ein Kanal kann stehen und nichts liefern; solange
er steht, genügt der langsame Takt (fünf Minuten), fällt er weg, trägt er
allein weiter (eine Minute).

### Eine Antwort ohne Ziel ist nicht dasselbe wie keine Antwort

Am selben Tag meldete Daniel: „status app amazon pill geklickt -> maid sama
öffnet sich -> melden -> amazon pill nach meldung gedrückt -> maid sama öffnet
sich…“

Der Worker hatte recht: Nach der Meldung um 16:29:21 stand dort `titel: 0,
ziel: null` — es gab nichts mehr zu prüfen. Die Anzeige fiel aber auf ihren
Verweis vom Aufbau zurück, denn ihre Regel lautete `if (jetzt?.ziel) ziel =
jetzt.ziel`. Sie war für den **Netzfehler** gedacht („ein Ziel zu viel ist
besser als keins“) und traf einen Fall, der keiner war.

**Prüffrage bei jedem Rückfall auf einen alten Wert:** *Unterscheide ich
‚keine Antwort‘ von ‚Antwort ohne Inhalt‘?* Das Erste rechtfertigt den alten
Wert, das Zweite widerlegt ihn.

## Wer die Live-Seite prüft, räumt zuerst den Service Worker ab

Am 29.08.2026 zweimal in einer Stunde derselbe Fehlschluss: Ein Fix war
ausgeliefert, die Seite zeigte den alten Stand, und der Verdacht fiel auf den
Code. Beide Male war es der Service Worker — einmal bei „One Piece: zuletzt
20.05.2019“ (der Fix stand längst live), einmal bei den Disc-Wegen in der
„Wo?“-Ansicht (173 Einträge, angezeigt wurden null).

Das ist kein Fehler der Seite, sondern ihre Aufgabe: Sie soll offline
funktionieren, und `ignoreSearch` in `sw.js` sorgt bewusst dafür, dass die
Datenstand-Kennung an der Adresse den Cache **nicht** umgeht (lieber alte
Termine als eine leere Seite).

**Der Prüfgriff, in dieser Reihenfolge:**

```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
for (const k of await caches.keys()) await caches.delete(k)
location.reload()
```

Ein `location.reload(true)` allein genügt nicht — das Argument ist seit Jahren
wirkungslos, und der Service Worker antwortet weiter aus seinem Cache. Wer die
Registrierung stehen lässt, misst den Stand von vorhin und sucht den Fehler an
der falschen Stelle.

## Caches: die Adresse ist die Version

Datenadressen tragen den Datenstand (`/data/events.json?v=20260812142619`), eingesetzt in
`vite.config.ts` aus `meta.generatedAt`. Ohne das blieb nach einem Deploy die alte Fassung
stehen, und nur Strg+Shift+R half — dieselbe Adresse ist für Browser-Cache und Service Worker
dieselbe Datei, egal was darin steht.

- **Datenstand, nicht Commit-Hash.** Ein Deploy ohne Datenänderung soll niemanden 551 KB
  Titeldaten erneut laden lassen.
- **ICS-Feeds bekommen keine Kennung** (`feedUrl`). Die Adresse wird abonniert, nicht abgerufen;
  eine Kennung darin wäre beim nächsten Deploy ein totes Abo.
- **Offline ignoriert die Kennung** (`ignoreSearch` in `sw.js`) — lieber alte Termine als eine
  leere Seite.
- **Feste Adressen ohne Hash nie cache-first (23.10.2026).** `/icons/` und `/og/` kamen aus `media-v4`
  und blieben es: Das neue Logo (PR 1693, 14.10.) erreichte jeden Besucher von davor nie, Chrome zeigte weiter
  das blaue Favicon. Jetzt liegen sie in `fest-v4` und laufen über stale-while-revalidate (Kopie sofort, Abruf
  mit `no-cache` frischt auf). `cacheFirst` bleibt für `/assets/` und Cover; `pipeline/check-sw-cache-regeln.ts`
  (in `check:logic`) prüft das im Syntaxbaum und lässt den echten Worker in einer Kulisse laufen. Browsermessung:
  `node tools/sw-icon-messung.mjs <alter-sw.js> public/sw.js`. Ändert ein PR eine Datei unter `public/` ohne Hash im
  Namen, gehört die Cache-Regel in `sw.js` zur Prüfung.
- Jeder Cache im Service Worker hat eine Obergrenze. Ohne sie wächst er still: einmal 313 MB
  Cover (10.08.2026), einmal 400 KB Programmdateien je Deploy (12.08.2026).

## Eine Prüfung, die rot wird, weil die Arbeit erledigt ist, misst das Falsche

Am 25.08.2026 um 05:07 hat der nächtliche Lauf die letzten Amazon-Meldungen übernommen.
`extension/offene-amazon.js` fiel damit auf **null** Einträge — genau das Ziel, auf das
wochenlang hingearbeitet wurde. Die Zusicherungen der Prime-Übersicht lasen diese Datei und
arbeiteten mit ihrem ersten Eintrag; vier von ihnen wurden rot, **der Deploy blieb drei Läufe
lang hängen, und die Seite wurde nicht mehr ausgeliefert**.

Die Erweiterung selbst kam mit der leeren Liste einwandfrei zurecht — der Knopf schrieb
„Prime: alles geprüft". Nur die Prüfung hielt das für einen Fehler.

**Testdaten gehören in den Test, nicht in den Datenbestand.** Eine Zusicherung prüft die
Logik; wer sie an echte Daten hängt, prüft den Datenstand mit — und der ändert sich täglich
durch die Läufe. Was heute grün ist, ist morgen rot, ohne dass jemand eine Zeile Code
angefasst hat.

**Dieselbe Falle hatte einen Tag vorher schon zugeschlagen, eine Ebene tiefer.** Am 24.08.2026
fiel eine fest verdrahtete Kennung aus der Liste, weil Daniel sie gemeldet hatte. Die Antwort
damals war `Object.keys(ECHTE_LISTE)[0]` — dieselbe Abhängigkeit, nur beweglicher. Sie hat
genau einen Tag gehalten.

Die Prüffrage vor jeder Zusicherung, die eine Datei aus `data/` oder `extension/offene-*.js`
liest: **Was passiert mit dieser Prüfung, wenn die Datei leer ist?** Ist die Antwort „sie wird
rot", gehört sie umgebaut — denn leer ist bei einer Arbeitsliste der Normalfall am Ende.

Was an echten Daten trotzdem zusicherbar ist, und deshalb dort steht: dass die Datei sich
laden lässt, und dass der leere Fall sauber durchläuft.

**Am 02.09.2026 ist genau das zweimal an einem Tag passiert, beide Male von mir gebaut, beide
Male mit stehendem Deploy.** Die Fälle sehen verschieden aus und haben dieselbe Wurzel:

| Zusicherung | Bedingung | warum sie rot wurde |
|---|---|---|
| Rohfolgen-Zuordnung | `zahlZugeordnet > 0` bei offenen Adressen | Die Zuordnung war **fertig** — übrig blieben zwei Reste, die sich bauartbedingt nicht auflösen lassen. Null von zwei ist richtig |
| Listenstand der Erweiterung | `zeit === meta.generatedAt` | Der Deploy prüft **vor** dem Bau. Beide Dateien entstehen im selben Lauf, aber nacheinander — dazwischen sind sie verschieden alt |

**Die gemeinsame Wurzel: Eine Momentaufnahme wurde als Invariante geschrieben.** „Es ist gerade
etwas zugeordnet worden" und „beide Dateien sind gleich alt" stimmen im Augenblick des
Erzeugens und sonst nie zuverlässig. Eine Zusicherung behauptet aber, dass etwas **immer** gilt.

**Die Prüffrage vor jeder neuen Zusicherung**, und sie ist schärfer als die alte nach der
leeren Datei:

> Unter welchen Umständen ist die Bedingung verletzt, **ohne** dass etwas kaputt ist?

Fällt dazu ein Fall ein — die Arbeit ist fertig, der Lauf war noch nicht dran, die Welt ist
weitergelaufen —, prüft die Zusicherung den falschen Gegenstand. Sie gehört dann auf eine
**Kulisse** umgestellt, die von keinem Datenstand abhängt, oder auf eine Bedingung, die den
Normalbetrieb einschließt (eine Schwelle statt „größer null", „nicht neuer als" statt „gleich").

Beide Fassungen von heute stehen so da: Die Gruppierungsregel prüft eine erfundene Adresse mit
zwölf Folgen und zwölf ASINs, der Bestand nur noch gegen eine Schwelle von fünf Adressen.

## Ein geklärter roter Lauf wird entfernt

Daniel am 24.08.2026: „du hast die läufe im status geprüft, warum sind die immer noch sichtbar.
wenn die geprüft wurden, können die dort entfernt werden, sonst bekomme ich einen falschen
eindruck."

**Und dasselbe gilt für den Pull Request, den der Reparatur-Lauf dazu aufmacht.** Am
02.09.2026 wurde ein Bau rot (Slug-Kappung), `claude-reparatur.yml` sprang an und öffnete
PR #43 — mit demselben Fix, den ich fünf Minuten später von Hand auf `main` gebracht habe,
Zeile für Zeile. In Daniels Statusanzeige stand daraufhin **„WARTET AUF DICH — 1 OFFENER
PULL REQUEST"**, und seine Frage war die richtige: „warum steht wartet auf dich, was soll ich
tun". Nichts — die Sache war behoben, bevor er sie ansehen konnte.

**Wer einen roten Lauf selbst behebt, sieht im selben Zug nach, ob der Reparatur-Lauf schon
einen PR dazu aufgemacht hat**, und schließt ihn mit einem Satz, warum er überholt ist:

```bash
gh pr list --repo danielzaiser91/anime-kalender-de
gh pr close <nr> --repo danielzaiser91/anime-kalender-de --delete-branch --comment "<warum überholt>"
```

Der Reparatur-Lauf ist nicht falsch gebaut — dass er einen PR öffnet statt zu pushen, ist
genau richtig. Falsch ist nur, ihn stehen zu lassen: Eine Anzeige, die zur Handlung auffordert,
wo es nichts zu tun gibt, ist derselbe Fehler wie ein roter Lauf, der längst geklärt ist.

Die Liste der Läufe ist eine **Statusanzeige**, kein Archiv. Steht dort ein rotes Kreuz, heißt
das „hier ist etwas zu tun" — und wenn nichts mehr zu tun ist, lügt es.

Also: Sobald ein roter Lauf **geprüft und die Ursache behoben oder festgehalten** ist, wird er
gelöscht:

```bash
gh run delete <id> --repo danielzaiser91/anime-kalender-de
```

**Erst prüfen, dann löschen — nie umgekehrt.** Was in dem Lauf stand, ist danach weg; die
Erkenntnis daraus muss vorher woanders stehen, in einem Commit, in `status.md` oder hier. Am
24.08.2026 waren es drei: ein AniList-Ausfall, ein Typfehler von mir und ein abgebrochener
Seitenaufruf bei Crunchyroll. Alle drei sind behoben und beschrieben; die Läufe selbst brauchte
niemand mehr.

**Und das GitHub-Löschen ist nur die Hälfte.** Daniels Laufstatus-App liest den Worker, nicht
GitHub — dort bleibt ein Lauf mit `zustand: 'fehler'` stehen, bis ihn jemand ausdrücklich
abnimmt. Das ist so gebaut und richtig so: Ein roter Lauf, der von selbst verschwindet, ist
schlimmer als keine Anzeige. Nur muss die Abnahme dann auch passieren.

```bash
curl -X POST https://newsletter.animekalender.workers.dev/lauf \
  -H "Content-Type: application/json" -H "X-Lauf-Token: <LAUF_TOKEN>" \
  -d '{"lauf_id":"<id>","zustand":"erledigt","notiz":"<warum geklärt>"}'
```

Am 25.08.2026 standen dort **elf** rote Läufe, der älteste 13 Stunden alt — alle längst
behoben, jeder mit Commit. Daniel: „räum die status app auf, warum so viele rote läufe, gab es
kein erfolgreichen deploy?" Es gab einen, zwanzig Minuten vorher; er war nur nicht zu sehen.

**Die Regel gehört an den Fix, nicht an eine Aufräumrunde:** Wer einen roten Lauf behebt,
nimmt ihn im selben Zug ab. Sonst sammelt sich eine Anzeige, die etwas anderes sagt als der
Zustand — und dann ist sie wertlos, obwohl jede einzelne Zeile einmal stimmte.
**Und weil ein Vorsatz das zweimal nicht getragen hat, gibt es jetzt ein Werkzeug.** Am
25.08.2026 musste Daniel dieselbe Aufräumung **zweimal an einem Tag** anmahnen — vormittags
elf rote Läufe, nachmittags zehn: „räum die status app auf, furchtbar diese ganzen roten läufe
die ich da sehe." Danach die Verschärfung: „räum immer auf, wenn du bereits drüber geschaut
hast."

```
LAUF_TOKEN=… node tools/laeufe-aufraeumen.mjs [--auch-github]
```
**Seit 18.10.2026 meldet es auch `ROT im Verlauf: <Art>`:** Die App-Liste führt seit 28.09. nur noch laufende Läufe, ein roter Lauf steht nur im `verlauf`; „0 rot“ allein sagte elf Stunden lang nichts (Bestandsbau rot seit 17.10. 22:07 UTC).

**Geprüft und behoben, grüner Nachfolger kommt erst später (z. B. Wochenlauf)?** `LAUF_TOKEN=… node tools/laeufe-aufraeumen.mjs --erledigt <lauf_id> --notiz "behoben durch #N, Nachprüfung TT.MM."` (seit 23.10.2026; `--trocken` zeigt nur an) setzt genau diesen roten Verlaufseintrag auf `erledigt`; die ID steht in `…/lauf?verlauf=<Art>`, ohne Notiz oder bei einer ID, die kein roter Eintrag ist, bricht es ab. Ein späterer Fehler derselben Art ist wieder ROT.

`ROT im Verlauf` nennt das Alter und erscheint nur, wenn kein grüner Lauf desselben Workflows (`gh run list`) danach kam; `abgebrochen` verdeckt einen Fehler nicht. Dazu `STILLSTAND: public/data seit N h unverändert`: letzter Commit auf `public/data` älter als 8 h (gesunde Nachtlücke gemessen 6,2 h am 17.10., Stillstand 17.10. 11,4 h); `STILLSTAND?` heißt, die GitHub-API war nicht lesbar (Rate-Limit, kein JSON).


Es liest die roten Läufe aus der App und nimmt genau die ab, die **überholt** sind — also die,
deren Workflow danach erfolgreich durchgelaufen ist. Das ist gemessen, nicht angenommen: Ein
roter Lauf ohne grünen Nachfolger bleibt stehen, denn der ist ein offenes Problem. `--trocken`
zeigt nur, was geschähe.

**Die Prüffrage gehört an das Ende jeder Antwort, die einen Lauf betraf:** *Steht in der App
noch etwas Rotes, das ich längst geklärt habe?* Ein Vorsatz, der bei jedem einzelnen Fix neu
eingehalten werden muss, wird übersehen — ein Aufruf nicht.


## Wie der Stand geprüft wird, ohne Daniels Rechner

Alle Datenläufe arbeiten auf GitHubs Rechnern und committen selbst — stündlich die
Sendezeiten, täglich alle Quellen, montags der Tiefendurchlauf. Ob Daniels PC läuft, spielt für
den Datenbestand keine Rolle.

### Die Wache läuft, Claude wertet aus — und beim nächsten Sitzungsstart lese ich beides

Seit dem 03.09.2026 gibt es dafür drei Stufen, und keine ersetzt die andere:

| Stufe | Wer | Wo das Ergebnis liegt |
|---|---|---|
| **finden** | `delta-wache.yml`, täglich 09:20 | `daniel-zum-abarbeiten/00-wache.md` |
| **auswerten** | `claude-reparatur.yml`, bei jedem Befund | `daniel-zum-abarbeiten/00-wache-auswertung.md` |
| **durchsehen** | ich, **bei jedem Start des Clients** | im Gespräch, mit den nötigen Aufgaben |

Daniel am 03.09.2026: „die wache soll files ablegen, cloud claude soll sie prüfen
und auswerten, und du guckst am nächsten tag durch was korrekt läuft, wo es
verbesserungspotential gibt, wo es echte risiken und lücken gibt, und was
komplett falsch läuft." Auf die Rückfrage, was „nächster Tag" heißt: „meine ich
nächstes mal wenn ich auf meinem pc claude client starte."

**Also bei jedem Sitzungsstart, nicht kalendarisch.** Läuft der Client eine Woche
nicht, warten sieben Auswertungen — und die werden dann gelesen, nicht
übersprungen.

**Und der Cloud-Lauf trägt seinen Befund als Aufgabe in `status.md` ein.** Das
ist der Punkt, an dem die Kette ohne Zutun schließt: Der Footer jeder Antwort
zählt aus `status.md`, also steht der Eintrag beim nächsten Start von selbst da
— auch wenn niemand daran denkt. Daniel am 03.09.2026: „etwas, was du
automatisch im blick hast und mitbekommst, auch wenn ich nicht explizit darauf
hinweise bei der nächsten session an meinem pc."

Ein Vorsatz, der bei jedem Sitzungsstart neu eingehalten werden muss, wird
übersehen — eine Zeile im Footer nicht. Dieselbe Überlegung wie beim Werkzeug
zum Aufräumen der roten Läufe (25.08.2026).

**Und der Dauerauftrag oben in `status.md` trägt einen Zeitstempel, keine
Häkchen** — Daniels Vorschlag, und er ist besser als der Weg darüber: „oder du
machst dir selbst ein tägliches todo, wo drin steht wann du letztes mal geprüft
hast, und wenn seitdem >24h vergangen sind prüfst du erneut und erneuerst den
timestamp."

Der Unterschied ist nicht die Bequemlichkeit, sondern die Abdeckung: Ein Eintrag,
den der Cloud-Lauf schreibt, entsteht nur bei einem **Befund**. War die Wache
grün, steht nichts da — und dass sie täglich grün ist, will man auch wissen.
Der Zeitstempel fragt unabhängig davon: Wann wurde zuletzt hingesehen?

Gerechnet wird er wie jede Zeitangabe in diesem Projekt aus zwei echten
Zeitpunkten, nie aus dem Gefühl. **Erneuert wird er nur, wenn wirklich gelesen
wurde** — sonst ist er eine Zahl, die Händewaschen behauptet, und die wäre
schlimmer als gar keine.

**Warum es die dritte Stufe überhaupt braucht.** Am 03.09.2026 hat die Wache
gemeldet „5 Urteile verloren", und ausgewertet wurde es erst, als Daniel danach
fragte. Ein Befund, den niemand liest, ist keine Wache, sondern ein Protokoll.
Und die Auswertung eines Laufs ist nicht dasselbe wie ihre Beurteilung: Der
Cloud-Lauf sieht **einen** Vorfall, ich sehe die Reihe — ob dieselbe Lücke zum
dritten Mal auftaucht, steht in keinem einzelnen Befund.

Durchgesehen wird entlang derselben vier Fragen, die auch die Auswertung
beantwortet: Was läuft korrekt, wo ist Verbesserungspotenzial, wo sind echte
Risiken und Lücken, was läuft komplett falsch.

**Zu Beginn jeder Sitzung wird deshalb der Stand abgefragt, nicht vermutet:**

```bash
gh run list --limit 8 --repo danielzaiser91/anime-kalender-de
```

Dazu die beiden Dateien, die den Stand dauerhaft festhalten und im Repo liegen — sie sind auch
dann lesbar, wenn gerade kein Lauf sichtbar ist:

- **`data/source-health.json`** — je Quelle der Zeitpunkt des letzten erfolgreichen Abrufs.
  `npm run data:check` misst ihn gegen die Frist aus `pipeline/check-sources.ts` und macht den
  Lauf rot, wenn eine Quelle stumm geworden ist. **Das ist der Alarm**, und er kommt als
  Fehlermail von GitHub.
- **`public/data/meta.json`** — `generatedAt`, `titleCount`, `releaseCount`, `eventCount` des
  zuletzt ausgelieferten Datensatzes. Dieselben Zahlen stehen im Seitenfuß.

Eine Meldung an mich, wenn ein Lauf **erfolgreich** durch ist, gibt es nicht — GitHub meldet nur
Fehler; rote Läufe findet `tools/laeufe-aufraeumen.mjs`. **Discord bekommt keine Laufmeldungen**
(Daniel, 13.10.2026: der News-Kanal lief mit „Bestand … fehlgeschlagen“ voll). In `#news` steht nur
eine Ankündigung, wenn ein großes neues Feature live ist — keine Kleinigkeiten, keine Bugfixes;
gepostet von Hand über `tools/discord-news.sh` (Kanal-ID 1559515427330068592, am 13.10.2026 neu geklont; Webhook-URL in `my_secrets.md`).

### Der stündliche Lauf läuft fünfmal am Tag, nicht vierundzwanzigmal

Gemessen am 03.09.2026 über die letzten zwanzig Läufe von „Stündlich —
Sendezeiten" (`refresh-hourly.yml`, `cron: '23 * * * *'`):

    Abstand zwischen zwei Läufen:  min 2,5 h  ·  median 4,7 h  ·  max 8,3 h
    Läufe je Tag:                  5,2 statt 24

Das ist kein Fehler in unserer Konfiguration, sondern GitHubs dokumentiertes
Verhalten: Ein `schedule`-Lauf wird bei Last **verworfen**, nicht nachgeholt, und
öffentliche Repos ohne laufende Zahlung stehen dabei hinten an. Der Name des
Workflows behauptet also etwas, das die Plattform nicht einhalten kann.

**Drei Folgen, die man kennen muss, bevor man eine Zahl glaubt:**

- **Sendezeiten sind bis zu acht Stunden alt.** Wer prüft, ob ein Termin
  eingehalten wurde, misst gegen einen Stand, der einen halben Tag zurückliegen
  kann — nicht gegen „vor einer Stunde".
- **Eine Codeänderung erreicht die Daten ohne Verzug (seit 11.10.2026).** Der Bau
  (`bestand-bauen.yml`) hängt an den Sammel-Läufen und startet zusätzlich bei jedem
  Push auf `main`, der `data/**` (ohne `data/cache/`), `pipeline/**` oder `shared/**`
  berührt (am 10.10. vergingen 25 Minuten zwischen Merge und Baustart). Einen Hand-Anstoß
  braucht es nicht mehr; kurz vor dem Stundenlauf erzeugte er nur einen zweiten Vollbau.
  Sammler-Merges (`GITHUB_TOKEN`) lösen keinen Push-Lauf aus.
- **„Stündlich" in einer Notiz oder einem Footer ist eine falsche Angabe.**
  Richtig ist „mehrmals täglich, im Mittel alle viereinhalb Stunden".

Wer den Takt wirklich braucht, braucht einen anderen Auslöser — einen externen
Anstößer (`repository_dispatch` von einem Dienst, der pünktlich ist) oder einen
Lauf auf eigener Hardware. Solange niemand das gebaut hat, gilt die Zahl oben.

### Und die Seite selbst wird genauso abgebildet — zwei Werkzeuge, ein Griff

Was für die Erweiterung seit dem 02.09.2026 gilt, galt für die Seite bis zum
03.09.2026 nicht: Alle Styling-Befunde kamen aus Screenshots, die Daniel selbst
gemacht hat. Seitdem gibt es zwei Werkzeuge, beide **ohne Server** —
`page.route()` beantwortet jede Anfrage aus `dist/`, gerendert wird also genau
das, was ausgeliefert wird.

```
npm run check:panel        # das Detail-Panel, mehrere Titel, beide Themen; Bilder im Temp-Ordner (ak-panel)
npm run panel:bilder       # dasselbe, Bilder nach docs/ (CI-Beleg-Artefakt)
npm run check:ansichten    # alle zehn Routen, beide Themen, danach --handy (Woche, Monat, Datenbank: Leiste, Filterfenster, Trefferprobe); Bilder im Temp-Ordner (ak-ansichten)
npm run ansichten:bilder   # dasselbe, Bilder nach docs/ (CI-Beleg-Artefakt; Stand der getrackten Bilder erneuern)
npm run check:kasten       # der Hinweiskasten der Erweiterung
npm run check:leiste       # die Durchlauf-Leiste auf Netflix
npm run check:datumsprung  # die Datumsauswahl in der Kopfleiste, mit Klick und Sprung
```

**Seit dem 07.09.2026 laufen alle vier automatisch** — im Workflow
`aussehen-pruefen.yml`, ausgelöst von Änderungen an `web/src`, den
Erweiterungs-Stylesheets, den Bildwerkzeugen und `build-share-pages.ts`. Sie
stehen bewusst **nicht** in `check:vor-commit`: Alle vier brauchen Chromium, im
Deploy-Job gibt es keins, und sie dorthin zu hängen hat am selben Tag drei
Deploys rot gemacht.

**Und die ausgelieferte Seite prüft `npm run check:stichprobe -- <keim>`** (16.09.2026):
50 zufällige Panels live gerendert, Kastentext gegen Widerspruchsregeln („0 von N" neben
einer vollen Pille, „keine Fassung" trotz Beleg, „Alle 1 Folgen" …). Der erste Lauf meldete
„0 Befunde" — die Regeln waren zu eng; erst das Lesen der Textliste fand vier Fehlerarten.
**Die Liste wird gelesen, nicht nur gezählt.** Nach jedem Fix läuft eine neue Auswahl
(anderer Keim), sonst misst die Stichprobe nur, was sie schon kennt.

**Die Bilder landen in `docs/`, und einige davon sind versioniert.** Nach einem
Lauf mit eigenen Titeln wird aufgeräumt mit `git checkout -- docs/` und
`git clean -n docs/` (erst ansehen) — nicht mit `rm docs/panel-*.png`. Das hat am
16.09.2026 die versionierten Standardbilder mitgelöscht, und der nächste Commit
mit `git pull --rebase` scheiterte an den Löschungen.

Der Anlass ist derselbe Tag: Der Antwort-Kasten war zu niedrig für den neuen
Zustand „teilweise", die zweite Pillenreihe stand über den Rand hinaus —
gefunden, weil Daniel ein Bild schickte. `check:panel` hätte es gemessen; es
lief nur nicht.

**`check:panel`** misst die Höhe des Antwort-Kastens je Titel und wird rot, wenn
sie auseinanderlaufen — das war Daniels Punkt vom 03.09.2026 („height Änderung
der Box durch feste Höhe verhindern"), und eine Zahl hält ihn besser fest als
ein Vorsatz.

**`check:ansichten`** kennt `--handy` (375 × 812) und misst zwei Dinge, die man
auf einem Bild nicht sieht: Konsolenfehler und waagerechte Überbreite. Beides
hat am ersten Tag getragen — die Monatsansicht zeigte auf dem Handy Titel als
„Th…", „DA…", „Yu…", und in der Wochenansicht standen sieben Quellenadressen
ausgeschrieben statt verlinkt.

**Trefferprobe (seit 16.10.2026, `trefferprobe-browser.mjs`):** Jedes sichtbare `a[href]`, `button`, `[role=button]`, `input`, `summary` muss an seiner Mitte (`elementFromPoint`) selbst oder über einen Nachfahren getroffen werden. `check:ansichten --handy` prüft bei 360 px, hell und dunkel, Woche, Datenbank-Liste und das offene Filterfenster (dort nur unter `#ak-filter`; die Seite dahinter ist absichtlich abgedeckt); `check:panel` das ganze Detail-Panel bei 393/1280 px und zusätzlich 360 px. Ausnahmen stehen benannt mit Grund in `tools/trefferprobe-ausnahmen.mjs` (heute: der unsichtbare Tastaturknopf `.ak-oeffnen.sr-only` der Karten). Eine Probe, die kein Bedienelement findet, ist rot.

**Fremde Bilder werden beantwortet, nicht abgewiesen.** Ein `route.abort()` für
die AniList-Cover sparte den Abruf, warf aber je Bild einen Konsolenfehler —
sechzig in der Datenbank-Ansicht — und machte die eigene Fehlerzählung wertlos.
Ein Einpunkt-PNG kostet nichts und hält die Konsole frei für die Fehler, um die
es geht.

**Ein Titel ohne Termin steht nicht in `titles-core.json`.** Das Panel-Werkzeug
öffnet deshalb über `#/datenbank?t=<id>`, nicht über den Kalender: Dort wird
`titles.json` nachgeladen, und nur so lässt sich ein Titel abbilden, der keinen
Kalendereintrag hat.

## Kein Prettier — das Projekt formatiert von Hand

`npx prettier --write` auf eine Datei dieses Projekts formatiert **die ganze
Datei um**: Semikolons rein, einfache Anführungszeichen zu doppelten. Am
29.08.2026 traf es `pipeline/build.ts` — 2.840 geänderte Zeilen für eine
Änderung von zwölf. `git blame` wäre für die Datei unbrauchbar geworden.

Der Grund: Es gibt **keine** Prettier-Konfiguration im Repo und kein
`format`-Skript in der `package.json`. `npx` lädt Prettier frisch herunter und
wendet seine Voreinstellung an — die ist das Gegenteil des hier gewachsenen
Stils (keine Semikolons, einfache Anführungszeichen, 120 Spalten).

**Also: nicht formatieren lassen, sondern im Stil der Umgebung schreiben.**
Dieselbe Regel wie bei den Zeilenenden (`sed -i` auf CRLF, 12.08.2026): Ein
Werkzeug, das nebenbei die ganze Datei anfasst, kostet mehr, als es einspart.
Wird Prettier je eingeführt, dann mit Konfiguration und als **eigener** Commit
über den ganzen Bestand.

## Die Erweiterung zählt zweistellig — und hinten

Daniel am 30.08.2026: „bei versionierung maximal 2 stellig ab jetzt, nächste
version sollte 4.0.0 sein, und zähl lieber die kleine versions zahl hoch, also
4.0.1, statt immer die 2."

Die mittlere Stelle war bis dahin auf **3.111** gelaufen — an einem einzigen Tag
von 3.91 auf 3.111, weil jeder Fix sie hochzählte. Dreistellig ist weder lesbar
noch sagt es etwas: „3.111" und „3.98" sehen aus wie große Sprünge und waren
zwei Stunden auseinander.

Ab 4.0.0 gilt: **die letzte Stelle zählt hoch** (4.0.1, 4.0.2, …). Die mittlere
bewegt sich nur bei einem Umbau, der die Bedienung ändert — die vordere nur,
wenn nichts mehr so funktioniert wie vorher.

### Eine Unterabfrage ohne Index kostet das Tageskontingent

Am 01.09.2026 um 20:20 antwortete der Worker auf **jeden** Datenbank-Endpunkt mit
HTTP 500. Der Stapelauszug nannte den Grund:

```
D1_ERROR: Your account has exceeded D1's free tier daily row read limit.
```

Die Ursache stand seit einer Stunde im Code. Der Rohfolgen-Endpunkt bekam eine
Unterabfrage, die je Zeile den Serienamen aus der Meldung derselben Adresse holt:

```sql
(SELECT p.titel FROM pruefung p WHERE p.url = f.url ORDER BY p.gemeldet_am DESC LIMIT 1)
```

**Ohne Index auf `pruefung(url)` ist das ein voller Durchlauf je Rohfolge.** 795
offene Zeilen gegen 3.467 Meldungen sind 2,75 Millionen gelesene Zeilen — in
**einem** Aufruf. Das Tageskontingent des kostenlosen Plans liegt bei fünf
Millionen; nach dem zweiten Lauf war es weg, und mit ihm der Briefkasten für den
Rest des Tages.

**Der Index (Migration 022) senkt es auf 631 Zeilen** — vierhundertfach weniger.
Er kam zwei Aufrufe zu spät.

**Die Prüffrage vor jeder Unterabfrage in einem Endpunkt:** *Gibt es einen Index
auf der Spalte, über die sie verknüpft?* Wenn nein, ist es kein „vielleicht etwas
langsamer", sondern das Produkt beider Tabellengrößen. Bei D1 ist das keine
Geschwindigkeitsfrage, sondern eine Mengenfrage: **Gelesene Zeilen sind das
Kontingent**, und ein fehlender Index multipliziert sie.

**Und lokale Messläufe zählen mit.** `wrangler d1 execute --remote` liest aus
derselben Datenbank wie der Worker. Wer beim Suchen eines Fehlers zwanzigmal
`SELECT` über eine große Tabelle laufen lässt, verbraucht dasselbe Kontingent,
das der Betrieb braucht — an diesem Tag rund vierzig Abfragen zur Fehlersuche.
Für wiederholte Messungen gehört das Ergebnis in eine Datei, nicht in die
zwanzigste Abfrage.

### Zweiter Ausfall, 24.09.2026: der Melde-Durchgang und ein Index, der fehlte

Um 19:45 war das Tageskontingent wieder weg. Diesmal zeigte `wrangler d1 insights` den Täter
sofort (liest Analysedaten, **nicht** die Datenbank — kostet also kein Kontingent):

```
CLOUDFLARE_API_TOKEN=… npx wrangler d1 insights anime-kalender --config wrangler.toml \
  --sort-type sum --sort-by reads --timePeriod 1d --limit 8 --json
```

`SELECT DISTINCT plattform, url, staffel FROM pruefung WHERE … gemeldet_am > ?1` (Prüfstand,
`?stand=1`) lief 1.834-mal und las **9,2 Millionen** Zeilen. Der Cache davor hält, bis jemand
schreibt — und der Melde-Durchgang schrieb an diesem Tag rund tausend Meldungen, jede verwarf ihn.
Ohne Index auf `gemeldet_am` las jede Neuberechnung die ganze Tabelle. Migration 037 legt einen
deckenden Index an. **Der Cache schützt nur, solange selten geschrieben wird;** wer einen
Schreibstrom plant (Durchgang, Massenmeldung), prüft vorher die Abfragen hinter dem Cache.
Außerdem nimmt D1 bei aufgebrauchtem Kontingent **auch keine Migration** an — der Index kommt
erst nach Mitternacht UTC. Und `fetch-pruefungen.ts` beendet den Bestandslauf bei HTTP 5xx seitdem
gelb statt rot.

Dazu am selben Abend: `?stand=1` wird beim Schreiben nicht mehr verworfen (hält 60 s, Ausnahme in
`tools/worker-cache-pruefen.cjs`), und Migration 038 legt Indizes für die Status-App
(`lauf_status (workflow, zustand, gemeldet_am)`, 886.000 Zeilen am Tag) und das Löschen je
Rohfolge (`prime_folge (gti)`, 280.000) an. **Nach dem Einspielen mit `d1 insights` nachmessen**
— die Wirkung ist bis dahin geschätzt, nicht gemessen.

Zweite Runde am selben Abend, aus der vollständigen Liste (`--limit 25`, Summe 11,1 Mio. Zeilen):
Jede Meldung zählte danach alle offenen Meldungen nach (`COUNT(*)`, 560.000 Zeilen, Ergebnis las
niemand) — entfernt. Jede Meldung schickt außerdem ein Ereignis „pruefung", und die Status-App holte
darauf auch die Läufe neu; dazu fragte sie während eines Laufs alle 5 Sekunden, auch bei stehendem
Push-Kanal, und ein hängender „läuft"-Eintrag hielt das stundenlang am Laufen (2.313 Abrufe,
714.000 Zeilen). Beides in `C:\code\ai\__assets\tools\lauf-status\index.html` behoben; greift
nach einem Neustart der App. **Merksatz: Ein Ereignis je Schreibzugriff ist ein Lesezugriff je
Zuhörer** — wer Ereignisse sendet, prüft, was die Empfänger darauf abfragen.

### Der Auslöser war die Unterabfrage — die Ursache war der Takt

Nachdem der Index lag, blieb die Frage, ob das Kontingent damit sicher ist. Die
Antwort stand im selben Endpunkt, eine Abfrage weiter, und war größer als der
Fehler von vorhin:

| je Aufruf von `?zaehlen=1` | gelesene Zeilen |
|---|---|
| `SELECT … WHERE uebernommen = 0` | ~3.400 |
| `SELECT DISTINCT url FROM pruefung` — **die ganze Tabelle** | 3.467 |
| zusammen | **~6.900** |

Die Erweiterung fragt im **Minutentakt**, aus **jedem offenen Tab**. Ein einziger
Tab kommt damit auf **9,9 Millionen gelesene Zeilen am Tag**, bei einem
Tageskontingent von fünf — die Unterabfrage hat den Ausfall nur vorgezogen.

**Was den Takt billig macht, ist nicht ein Index, sondern dass niemand zweimal
dasselbe liest.** Die Antwort ist für alle Fragenden dieselbe und ändert sich
nur, wenn jemand schreibt. Sie liegt seit dem 01.09.2026 im Cache der Edge
(`ausCache` in `worker/src/index.ts`) und wird bei jedem Schreibzugriff
verworfen: 331.000 Zeilen am Tag statt 9,9 Millionen, **ohne** dass eine Meldung
später sichtbar wird.

Drei Einzelheiten, die den Weg tragen:

- **Die Frische kommt aus dem Verwerfen, nicht aus dem Ablaufen.** Deshalb ist
  die Haltedauer von einer halben Stunde keine Wartezeit — sie deckt nur den
  Fall ab, dass ein Verwerfen ein anderes Rechenzentrum nicht erreicht. Wer sie
  auf fünf Minuten kürzt, um „sicherer" zu sein, holt sich 2,0 Millionen Zeilen
  je Tab zurück und ist bei drei Tabs wieder über dem Kontingent.
- **Verworfen wird an der Weiterleitung, nicht je Schreibstelle.**
  `handlePruefung` ändert die Tabelle an neun Stellen; die Invalidierung an jede
  einzelne zu hängen hieße, sie bei der zehnten zu vergessen — und dann steht
  eine halbe Stunde lang ein überholter Stand, ohne dass jemand den Zusammenhang
  sieht. Genau dieser Stand war der Fehler, den Daniel am selben Tag viermal
  melden musste.
- **Eine Fehlerantwort wird nicht gehalten.** Sonst hielte ein einzelner
  D1-Ausfall den Briefkasten eine halbe Stunde lang für leer — aus einer Störung
  von Sekunden würde eine von Minuten.

`tools/worker-cache-pruefen.cjs` (in `check:worker`) hält die gehaltenen
Endpunkte gegen die Verwerfen-Liste, in beide Richtungen. Das ist die Stelle,
die lautlos veraltet: Wer einen dritten Endpunkt umhüllt, merkt ohne sie nichts.

**Die allgemeine Form, und sie gilt über D1 hinaus:** Bei einem Kontingent, das
in *gelesenen Zeilen* misst, ist die erste Frage nicht „wie schnell ist die
Abfrage", sondern **„wie oft läuft sie, und liest sie jedes Mal dasselbe?"** Ein
Index beantwortet die erste Frage. Die zweite beantwortet nur, wer aufhört zu
fragen.


## Nach der Prüfkette nur die erzeugten Bilder zurücksetzen, nicht ganz `docs/` (19.09.2026)

`check:vor-commit` schreibt keine Bilder; `check:panel` und `check:ansichten` schreiben seit 12.10.2026 nur mit `--docs` (`panel:bilder`, `ansichten:bilder`) nach `docs/*.png`, sonst in den Temp-Ordner. Andere Prüfwerkzeuge (`check:news`, `check:kasten` …) schreiben weiterhin nach `docs/`. Wer danach `git checkout -- docs` und `git clean -fq docs/` fährt, verwirft auch, was gerade von Hand in `docs/wissen/` ergänzt wurde oder als neue Datei unter `docs/` liegt — am 19.09.2026 zweimal passiert (ein Abschnitt in `quellen.md`, beinahe die Kandidatenliste). Zurückgesetzt wird nur `git checkout -- "docs/*.png"` und `git clean -fq docs/ -e wissen -e "*.md"`; Wissens-Einträge werden **vor** der Prüfkette committet.

### „Live" heißt: Deploy grün und im ausgelieferten Bundle nachgesehen (19.09.2026)

Nach einem Push auf `web/src` habe ich „live" gemeldet — der Deploy lief noch, Daniel sah die alte Fassung und fragte, wo das neue Etikett sei. Ein Push ist kein Deploy. Vor „live": `gh run watch` auf „Deploy auf GitHub Pages" für genau diesen Commit, dann das Bundle holen (`curl -s https://anime-kalender.de/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js'`) und darin nach einem neuen Text suchen. Bei Daten-Änderungen genügt der grüne Bau plus Deploy.

### Teilen-Seiten gibt es für Termine (`/r/`) und für Titel (`/t/`) (19.09.2026)

Der Link-Knopf im Detail-Panel teilte `/r/<Titel-Slug>/` — eine Seite, die es für keinen Titel gab, denn unter `/r/` liegen nur Termine. Und ein offener Titel schrieb keinen Pfad in die Adressleiste, geteilt wurde `/#/woche?t=…` mit Startseiten-Vorschau (Hash erreicht keinen Crawler). Seitdem: `build-share-pages.ts` legt je Titel aus `titles.json` `dist/t/<slug>/index.html` an (2.774 Seiten, 26 MB in `dist`, nichts im Repo), Vorschaubild ist das AniList-Banner (große Karte), sonst das Cover (kleine Karte); eigene Bilder wären ~170 MB im Repo. Das Panel setzt den Pfad selbst (`syncSharePath`), weil nur es den Titel sicher hat. `404.html` leitet `/r|t/<…>-<id>/` auf `#/woche?t=<id>` um — für die toten Links, die schon geteilt wurden, und für Titel ohne Synchro (keine eigene Seite).

### `git commit -am` nimmt keine neuen Dateien mit (19.09.2026)

`web/src/lib/tv-angabe.ts` war neu, der Commit lief mit `-am` — importiert, aber nicht eingecheckt. Lokal grün (die Datei lag ja da), in der CI hätte der Bau am Import gescheitert; Deploy wurde vom Nachreich-Commit abgelöst, der schon angestoßene Bestandsbau musste abgebrochen werden. Griff: Vor jedem `-am` die `??`-Zeilen in `git status --short` ansehen — steht dort eine neue Datei, gehört sie mit `git add` dazu.

### Woher kommt ein Verweis? — `tools/streams-verfolgen.mjs`

`check:handbelege` meldet einen Weg, der laut Beleg gar nicht mehr da sein dürfte, und der Bau hat
über ein Dutzend Stellen, die `title.streams` anfassen. Statt die Ursache zu erraten, schreibt
`node tools/streams-verfolgen.mjs <AniList-Id> [Plattform]` jede Änderung an den Streams dieses
Titels mit Zeile in `build.ts` mit. Er baut lokal (mit altem Cache bricht der Bau am Ende ab, das
Protokoll entsteht vorher), setzt danach die Erzeugnisse zurück und verweigert den Start, wenn in
`public/data`, `data` oder `daniel-zum-abarbeiten` uncommittete Arbeit liegt.

Belegt am 21.09.2026 an Golden Wind: drei Vermutungen falsch, das Protokoll zeigte beim ersten
Lauf, dass eine Prime-Suche erst nach dem Belegfilter in die ausgetragene Adresse umgesetzt wurde
(`prime.url = echt`). Dieselbe Klasse Fehler wie am 26.08. und 17.09.2026: **Jede Zuweisung einer
Adresse fragt den Beleg zu genau dieser Adresse** — nicht nur der Hauptfilter.

### Wer einen Oberflächentext umbenennt, sucht ihn in `tools/` (21.09.2026)

Commit 077c99ed (19.09.2026) benannte „TV-Sendungen zeigen" in „TV-Ausstrahlungen anzeigen" um;
`tools/tv-schalter-pruefen.mjs` wartete weiter auf den alten Text. „Aussehen prüfen" war danach
**zwei Tage lang bei jedem Push rot** (19.09. 14:55 bis 21.09.) — rund zwanzig Fehlermails, und
keine Wachphase hat hingesehen. Die Playwright-Prüfungen suchen Knöpfe über ihren **Text**. Vor dem
Commit einer geänderten i18n-Zeile deshalb: `grep -rn "<alter Text>" tools/ pipeline/check-*`.

### Ein Ziel ist erst erledigt, wenn jede seiner offenen Staffeln gemeldet ist (22.09.2026)

Der Worker (`?stand=1`) strich ein Ziel, sobald unter seiner Adresse nach `pruefstand.erzeugtAm`
**irgendetwas** gemeldet war. Dr. STONE verschwand nach der Meldung von Staffel 1 aus der
Prüfliste, obwohl Staffel 2 offen war, und die Automatik fand den Titel nicht mehr. Seitdem schickt
`tools/pruefstand.mjs` je Netflix-Ziel die offenen Staffeln mit (`staffeln: [1, 2]`, nur bei
Listen in Netflix-Zählung, wo `nr` = die Staffel, die der Player meldet), und der Worker streicht
erst, wenn `pruefung.staffel` jede davon enthält. Ziele ohne Staffelangabe bleiben bei der Adresse.

**Und den Prüfstand nicht lokal neu erzeugen, solange der Briefkasten Unübernommenes hält.**
`tools/pruefstand.mjs` setzt `erzeugtAm` auf jetzt; der Worker zählt nur Meldungen danach. Am
22.09.2026 standen dadurch Haikyu!! und Dr. STONE S1 wieder als offen, obwohl beide im Briefkasten
lagen — bis zur nächsten Übernahme. Wer die Datei lokal braucht, committet sie erst nach dem Datenlauf.

## wrangler braucht `--config wrangler.toml` — sonst sieht es aus wie ein Rechteproblem (23.09.2026)

In `status.md` stand seit dem 27.08.2026, die Worker-Migration 016 warte auf D1-Rechte:
`wrangler d1 migrations apply` scheitere an einem OAuth-Token ohne D1-Berechtigung. Nachgesehen
am 23.09.2026 — es fehlt nichts:

```
cd worker
npx wrangler d1 migrations list DB --remote --config wrangler.toml
→ ✅ No migrations to apply!
```

Ohne `--config` sucht wrangler eine `wrangler.jsonc`, findet die `wrangler.toml` dieses Projekts
nicht und meldet:

```
X [ERROR] Couldn't find a D1 DB with the name or binding 'DB' in your wrangler.jsonc file.
```

Das liest sich wie ein fehlendes Recht und ist ein fehlender Schalter. Am selben Tag ist darüber
Migration 036 (`offen_ziel`) angewandt und der Worker ausgeliefert worden.

**Die allgemeine Form:** Eine Fehlermeldung über eine fehlende Ressource sagt nicht, dass sie
fehlt — sie sagt, dass das Werkzeug sie nicht gefunden hat. Vier Wochen lang galt hier eine
Aufgabe als blockiert, die es nie war.

## Gleichheitsbeweise unter Windows: Worktree selbst löschen, Nachgeladenes abwarten (26.09.2026)

Erster Lauf von `bau-vergleich`/`panel-vergleich` auf Daniels Rechner (PR #242):

- `git worktree remove --force` (Git 2.55.0.windows.5) lässt einen Baum mit
  `node_modules`-Junction samt Ordner liegen; nur der Verwaltungseintrag verschwindet. Der
  nächste `worktree add` in denselben Pfad scheitert dann. Das Ziel der Junction bleibt heil —
  an einer Attrappe gemessen, ebenso dass `rmSync(…, { recursive: true })` die Junction löscht,
  ohne ihr zu folgen. Beide Werkzeuge löschen den Baum deshalb selbst (`entferneBaum`:
  `rmSync` + `git worktree prune`).
- `panel-vergleich` meldete 2 von 80 Panels „VERSCHIEDEN" (13667, 20520), in beide Richtungen:
  „Ähnliche Titel" war mal geladen, mal „Wird geladen …". Das Nachladen startet über einen
  IntersectionObserver; bei 20520 lag der Abschnitt genau an der Unterkante des 1200 px hohen
  Fensters und lud auf **beiden** Ständen je Lauf mal, mal nicht (je 3 Läufe gemessen). Das
  Werkzeug rendert jetzt 8000 px hoch und wartet, bis im Panel kein „Wird geladen" mehr steht
  (höchstens 10 s, danach wird trotzdem verglichen).

## Zwei Sitzungen in einem Arbeitsverzeichnis: vor jedem Commit den Zweig prüfen (26.09.2026)

Am 26.09.2026 liefen zwei Claude-Sitzungen in `C:\code\ai\anime-kalender-de`. Die eine checkte für
ein Review den PR-Zweig `claude/epic-goldberg-nfgn9c` (PR #242) aus; die andere committete und pushte
danach drei Commits, ohne es zu merken — sie landeten auf dem PR-Zweig statt auf `main` und kamen erst
mit dem Merge an. `git status` vor dem Commit reicht dafür nicht: Es zeigt den Zweig zwar in der ersten
Zeile, aber `--short` (so wie hier üblich) lässt genau diese Zeile weg.

**Regel:** Arbeitet eine zweite Sitzung im selben Ordner, vor jedem Commit
`git branch --show-current` — steht dort nicht `main`, nicht committen, sondern die andere Sitzung
fragen. Geteilte Dateien vorher absprechen; fremde, nicht committete Änderungen nie mit stagen
(`git add <eigene Dateien>`, kein `git add -A`), beim Pull `--autostash`.

## Der Actions-Cache für `data/cache/` kennt keinen Besitzer (29.09.2026)

**Was passiert ist.** Die Katalog-Abfrage sollte die MAL-Kennung (`idMal`) mitbringen. Der
Katalog-Lauf holte sie auch — `ohne-synchro.json` trug danach trotzdem **null** Kennungen an 15.130
Titeln, und nichts wurde rot.

**Warum.** `data/cache/` liegt nicht im Repo, sondern in einem Actions-Cache unter dem Präfix
`anilist-cache-`. Jeder Lauf, der den Ordner anfasst, speichert ihn am Ende **unter seinem eigenen
Schlüssel** (`anilist-cache-<run_id>`) — auch der Stündliche, der den Stand nur gelesen hat. Welchen
Stand ein späterer Lauf bekommt, entscheidet damit nicht das Alter *des Inhalts*, sondern das
Alter *des Schlüssels*:

```
08:34  Katalog-Lauf startet, holt alles neu (35 min)
09:0x  ein anderer Lauf startet, liest den ALTEN Katalog
09:14  Katalog-Lauf speichert seinen neuen Stand   → anilist-cache-…43605186
09:15  der andere Lauf speichert seinen alten Stand → anilist-cache-…44444523   ← neuer!
09:16  Bestandslauf nimmt `restore-keys: anilist-cache-` → den neueren, also den alten Stand
```

**Was dagegen hilft.**
1. **Kennungen über den Fingerabdruck** (`REL_FASSUNG` in `pipeline/fetch-anilist-katalog.ts`): Ändert
   sich die *Frage*, gilt kein Jahr als fertig, der Katalog wird neu geholt. Genau daran fehlte es —
   er zählte nur die Beziehungsregeln, nicht die Felder. Jetzt trägt er `+mal-1`.
2. **Messen statt schweigen**: Der Bau zählt die MAL-Kennungen mit und **warnt bei null**
   (`meldeOhneSynchro` in `pipeline/bau/nebendateien.ts`). Ohne diese Zahl ist ein zu alter Cache
   nicht von einem Titel ohne MAL-Seite zu unterscheiden.
3. **Wer den Refresh braucht, startet ihn selbst**: Nach einem `data:katalog` den Bestandslauf
   **von Hand** auslösen (`gh workflow run bestand-bauen.yml`), statt auf den `workflow_run`-Trigger
   zu warten — der kann in das Zeitfenster fallen, in dem ein fremder Lauf seinen alten Stand speichert.

## Wie die Newsletter-Mail aussieht: `tools/newsletter-probe.ts` (28.09.2026)

Rendert die **echte** `digestMail()` aus `worker/src/templates.ts` mit erfundenen Terminen und legt
ein Bild nach `docs/newsletter-probe.png`. Gedacht für Änderungen an Reihenfolge, Rubriken und
Abzeichen der Mail — ein Nachbau würde den Nachbau prüfen.

```bash
node node_modules/tsx/dist/cli.mjs tools/newsletter-probe.ts
```

## Beleg-Ablage: privat in R2, gelesen im täglichen Lauf (02.10.2026)

Daniel am 02.10.2026: Screenshots der Belege ja, aber **privat**.

- **Bucket** `anime-kalender-belege`: seit 02.10.2026 ohne öffentlichen Zugang — `r2.dev` abgeschaltet
  (`wrangler r2 bucket dev-url disable`), Domain `belege.anime-kalender.de` gelöst. Nichts im Code
  verwies darauf.
- **Zugang nur über den Worker:** Bindung `BELEGE` in `worker/wrangler.toml`, Route `/beleg`
  (`worker/src/beleg.ts`) mit `LAUF_TOKEN` — `POST ?key=` legt ab, `GET ?key=` liefert,
  `GET ?liste=<präfix>` zählt auf. **Wirkt erst nach `wrangler deploy`**; bis dahin antwortet
  der alte Worker mit 404, und die Lesungen bleiben ohne Bild (das Bild wird nachgeholt).
- **Leser:** `pipeline/belege-lesen.ts` im Schritt „Belege lesen" von `refresh-data.yml` —
  Artikel aus `releases.json` (Crunchyroll-News, Anime2You, aniSearch-Artikel, ADN-News; 144 am
  02.10.2026), je Lauf höchstens 60 (`--limit`, Stand 14.10.2026), jeder alle 7 Tage. Gedächtnis `data/beleg-lesungen.json`.
- **Gemessen am 02.10.2026 (lokal):** Hash stabil über zwei Lesungen bei Anime2You, aniSearch und
  ADN. Der Text steht in `<article>` (Anime2You, Crunchyroll) oder `<main>` (aniSearch; ADN hat ein
  leeres `<article>`). **ADN liefert mit Desktop-UA eine leere Seite**, Crunchyroll braucht ihn —
  deshalb zwei Seiten mit verschiedenem UA. Crunchyroll ist lokal kopflos gesperrt (Hülle, 964
  Zeichen); auf dem Runner liest derselbe Weg das Wochenprogramm stündlich.

## Claude-Läufe scheitern in einer Sekunde, wenn Daniels Kontingent leer ist (02.10.2026)

Die Claude-Workflows (`claude-verpasst-recherche.yml` u. a.) laufen mit Daniels
`CLAUDE_CODE_OAUTH_TOKEN`. Ist sein Kontingent erschöpft, endet der Schritt nach ~1 s mit
`"is_error": true`, `"total_cost_usd": 0`, `"num_turns": 1`, `modelUsage: {}` — kein Codefehler.
Erkannt am Lauf `37035218875` (16:38, genau beim Limit). Nichts zu tun: Der nächste planmäßige Lauf
geht wieder durch.

## Beleg-Bild: Ausschnitt statt Vollseite (03.10.2026)

Gemessen an den 25 abgelegten Belegen (Worker-Liste, 03.10.2026): Anime2You im Mittel **522 KB** (max. 1,25 MB), aniSearch **418 KB**, dazu 75 KB HTML je Lesung — Vollseite mit Newsticker, Kommentaren, Empfehlungen.

Versuche an derselben Seite (Anime2You, 1280×4468): Vollseite JPEG 60 = 778 KB (lokal, mit Zustimmungswand); Element `article` Grau-WebP 30 = 113 KB; Textbereich 520 px schmal Grau-WebP 8 = 56 KB; **nur Überschrift bis zu den ersten Absätzen, 520 px, ohne Bilder, Grau, WebP 20 = 24–31 KB** (aniSearch-Produktseite 10 KB), lesbar. Unter 5 KB ist eine Textseite nicht zu bekommen — das wäre ein fast leeres Bild. Der Artikeltext als `.txt.gz` kostet 1–3 KB statt 75 KB HTML.

Umsetzung: `pipeline/lib/beleg-bild.ts` (`belegAusschnitt`), benutzt von `belege-lesen.ts`; Schlüssel `<host>/<hash-der-url>/<tag>-<texthash>.webp` und `.txt.gz`, Feld `text` in der Lesung (ältere Lesungen tragen `html`). **Eine Zustimmungswand ist kein Beleg:** liegt in der Fenstermitte etwas außerhalb von `article`/`main`, wird es entfernt, bleibt es, gibt es kein Bild (am Rechner zeigte Anime2You die contentpass-Wand, auf dem Runner nicht). Die 25 vorhandenen Bilder (JPEG) bleiben liegen. Offen: Messbelege (Crunchyroll-Kalender) benutzen weiter die Vollseite.

## Stunden-Wecker über Cloudflare (04.10.2026)

GitHubs Cron-Plan für `refresh-hourly.yml` (`23 * * * *`) feuerte real etwa alle 4,6 Stunden. Der Worker `newsletter` (Cron `0 * * * *`) startet den Workflow deshalb zusätzlich per `workflow_dispatch` (`worker/src/wecker.ts`). Das Token liegt als Worker-Secret `GITHUB_WECKER_TOKEN` (Fine-grained PAT, dieses Repo und `anime-kalender-nativ`, Actions: Read and write; Wert in `my_secrets.md`). Gesetzt mit `wrangler secret put GITHUB_WECKER_TOKEN --config wrangler.toml` im Ordner `worker/` (ohne `--config` legt wrangler einen leeren Worker an). Prüfen: nach der vollen Stunde `gh run list --workflow refresh-hourly.yml` — ein Lauf mit Ereignis `workflow_dispatch` um :00. Läuft der Plan von GitHub zusätzlich, schützt die `concurrency`-Gruppe des Workflows vor Doppelläufen.

**Fremdes Repo (25.10.2026):** Ein Plan-Eintrag mit `repo` startet seinen Workflow in diesem Repo — so `daten.yml` in `danielzaiser91/anime-kalender-nativ`, stündlich (GitHubs Zeitplan schaltet sich dort nach 60 Ruhetagen ab). Die Wecker-Wache (`wecker-wache.yml`, nur im Hauptrepo) und die Plan-Leser in `tools/zugangs-waechter.mjs` überspringen solche Einträge; fällt der Wecker aus, holt niemand den Nativ-Lauf nach (der nächste Wecker-Start tut es).

## Warum Commits an Datendateien warten mussten — und was daran geändert ist (04.10.2026)

Daniel am 04.10.2026: „du hast gesagt, du wirst geblockt, weil gerade was läuft — überleg, wie es unabhängiger wird."

**Drei Ursachen:**
1. **Handgepflegte Dateien standen in `QUELLEN`** (`tools/quellen-liste.sh`). Der Reset in `commit-data.sh` legt jede Datei der Liste aus dem Arbeitsverzeichnis des Laufs über den neueren Fernstand; eine Handänderung, die zwischendurch gepusht wurde, ginge verloren. `quellen-commit-wache.sh` hielt deshalb jeden Commit an einer solchen Datei an, solange irgendein Datenlauf lief. Behoben: `*-von-hand.yaml`, `*-hand.yaml`, die Adress- und Hinweislisten (11 Dateien, kein Skript schreibt sie) stehen nicht mehr in der Liste; `tools/check-workflows.mjs` kennt sie als `HANDGEPFLEGT`. Handänderungen lassen sich jetzt jederzeit committen und pushen.
2. **Nur drei Push-Versuche** in `commit-data.sh`. Wenn Stündlich, Daten-PR und ein Mensch zugleich pushen, ging ein Bestandsbau rot (04.10.2026, 16:17: „Nach 3 Versuchen nicht gepusht"). Jetzt sechs Versuche mit zufälliger Pause von 5–20 Sekunden dazwischen.
3. **Die Gruppe `daten` hält alle Datenläufe hintereinander** — auch den Bestandsbau und den Stundenlauf. Ein langer Lauf (aniSearch-Katalog, Wochenlauf) hält beide auf. **Noch nicht geändert; Vorschlag:** je Quelle eine eigene Gruppe (aniSearch, Crunchyroll, ADN, TMDB) statt einer für alles, der Bestandsbau in eine eigene (er liest nur Committetes und pusht mit Wiederholung), und `check:workflows` prüft dann „derselbe Fremdserver, dieselbe Gruppe" statt „alle in `daten`". Das ist ein Umbau der Läufe selbst und wird einzeln und mit Vorher/Nachher gemacht.

**Wer nicht warten muss:** Code, Doku, Tests und Hand-Dateien (nach Punkt 1). Nur eine Pipeline-Quelle (`data/*.json` der Läufe) bleibt gesperrt, solange ein Lauf sie schreiben kann — dort schützt die Wache vor dem stillen Verlust.

## aniSearch-Katalog: eigener Workflow, eigene Gruppe, Pull Request (04.10.2026)

Daniel: „Kannst du den Lauf nicht so anpassen, dass er nix blockiert, nur von aniSearch sammelt und zB PR anlegt?" Der Katalog-Block
(rund 2.800 Seiten im Sechs-Sekunden-Takt, knapp fünf Stunden) war ein Cron von „Datenlauf auf Abruf" in der Gruppe `daten` und hielt
Bestandsbau und stündliche Läufe an. Seitdem: `.github/workflows/anisearch-katalog.yml`, Gruppe `anisearch-katalog`, Beginn 06:00 UTC
(nach dem Tageslauf von 04:17 UTC mit höchstens 75 Minuten, damit nie zwei Läufe zugleich bei aniSearch abrufen — der Takt ist eine Zusage), Ergebnis als Pull
Request über `tools/quellen-pr.sh` (squash-Merge, wenn GitHub `MERGEABLE` sagt). Der Bestandsbau läuft währenddessen; was der Katalog holt, baut der nächste
planmäßige Lauf nach dem Merge. Auf Abruf bleibt `data:anisearch` mit `katalog` in „Datenlauf auf Abruf" möglich (dann wieder Gruppe `daten`).
**Offen:** Der Takt-Schutz zwischen *anderen* aniSearch-Läufen und dem Katalog beruht auf der Uhrzeit, nicht auf einer Sperre; ein Lauf, der länger als zwei Stunden
über 06:00 hinaus bei aniSearch hängt, würde sich mit ihm überschneiden.

## D1-Kontingent, Mail-Zustellung und Worker-Befehle (04.10.2026, Abend)

**D1: 90 % des Tageskontingents (5 Mio. gelesene Zeilen).** Messen: `cd worker && npx wrangler d1 insights DB --config wrangler.toml --time-period 1d --sort-type sum --sort-by reads --limit 8 --json`.
Ursache war nicht die Anzeige, sondern die Bestandsbauten: Jeder Bau holt `prime_folge` (`?rohfolgen=1&alle=1`, 3 Seiten à 5.000), `pruefung` (`?alle=1`) und `namen=1` neu
(rund 100.000 Zeilen je Bau), 36 Bauten am 04.10. = 4,5 Mio. Seit 21:40 hält `ausCache` (30 Minuten, `caches.default` — greift auch auf `workers.dev`, gemessen: `CF-Cache-Status: HIT`)
diese drei Antworten. **Faustregel:** Ein neuer Vollexport im Worker gehört hinter `ausCache`. Zweiter Posten war `SQL_LAEUFE_LAUFEND` (Statusanzeige, 443.000 Zeilen am Tag): Migration
`043-lauf-laeuft-index.sql`.

**Worker-Befehle, die funktionieren:** Ausliefern `cd worker && npx wrangler deploy --config wrangler.toml` (nur aus einem sauberen Stand von `origin/main`, z. B. eigener Worktree).
Migrationen: `CI=true npx wrangler d1 migrations apply DB --remote --config wrangler.toml` — **mit der Bindung `DB` und `--config wrangler.toml`**: `anime-kalender` als Name scheitert mit
„Couldn't find a D1 DB … in your wrangler.jsonc". Eine Schemaänderung an der Produktionsdatenbank lehnt das Berechtigungssystem ohne ausdrücklichen Auftrag ab (04.10.2026, Daniel danach:
„den wrangler command kannst du doch ausführen … mach den aufruf"); mit dem Auftrag lief sie durch.

**Newsletter im Spam seit dem DNS-Umzug zu Cloudflare.** Die drei Einträge, die Resend für `send.anime-kalender.de` verlangt, waren beim Umzug von INWX nach Cloudflare verloren gegangen
(`resend._domainkey.send` TXT, `send.send` MX `feedback-smtp.eu-west-1.amazonses.com` Priorität 10, `send.send` TXT `v=spf1 include:amazonses.com ~all`); bei „DMARC quarantine" landete
jede Mail im Spam („nicht authentifiziert", über amazonses.com). Am 04.10.2026 mit dem Cloudflare-Token neu angelegt, die Werte stammen von der Resend-API (`GET /domains/{id}`).
**Nach jedem Wechsel des DNS-Anbieters:** Einträge der Sendedomain neu anlegen und `POST /domains/{id}/verify` anstoßen; Prüfung: `nslookup -type=TXT resend._domainkey.send.anime-kalender.de 1.1.1.1`.

**Weiterleitung `info@daniel-zaiser.de`** (PurelyMail, Regeln per API `listRoutingRules`): `info`, `kontakt`, `business` … und ein Sammel-Eintrag zeigen auf `danielzaiser91@googlemail.com`. Eine Testmail
**vom eigenen Googlemail-Konto** kommt nicht an (Gmail verwirft die zurückkommende Kopie derselben Nachricht als Duplikat) — Proben von einem anderen Absender senden.

## D1-Kontingent: Vollexporte in R2 statt im Edge-Cache (05.10.2026)

Daniel, 10:13: Mail „Tageslimit überschritten" vom Vortag, am Morgen schon 600.000 von 5 Mio. gelesen. Gemessen mit `wrangler d1 insights` (24 h): der Export `prime_folge WHERE id > ?` allein
2,8 Mio. Zeilen (586 Seitenabrufe), dazu die offenen Rohfolgen mit Unterabfrage (371.000) und `namen` (614.000). **Ursache:** `caches.default` gilt je Rechenzentrum, die Bauläufe kommen aus
wechselnden und treffen ihn kaum. **Behebung:** `worker/src/export-speicher.ts` legt die drei Auszüge in R2 (`export/…`), `pruefung.ts` verwirft sie nach jedem POST/DELETE; neu gerechnet wird
beim nächsten Abruf, also höchstens einmal je Bau. Eine Stunde danach lasen alle Abfragen zusammen 1.600 Zeilen. **Wache:** `wrangler d1 insights DB --config wrangler.toml --sort-type sum
--sort-by reads --timePeriod 1d --limit 10 --json` (kostet kein Kontingent); Ziel unter 25 % (1,25 Mio.) am Tag, Warnung des Wachlaufs bei 50 %.

## Leeres D1-Tageskontingent: Auffangnetz im Worker und Anzeige (14.10.2026)

Daniel sah auf der Newsletter-Seite „Failed to fetch": D1 warf bei leerem Kontingent, Cloudflare antwortete „error code: 1101" ohne CORS-Kopf, der Browser meldete einen `TypeError`. **Seit jetzt:** `worker/src/auffangnetz.ts` fängt, was die Routen werfen. `istD1Tageslimit` führt zu 503 mit CORS-Kopf, JSON `{ error }` und `Retry-After` bis 00:00 UTC, jeder andere Fehler bleibt 500 (ebenfalls mit CORS; die offenen Pfade `/lauf` u. a. mit `*`). In der Oberfläche übersetzt `web/src/lib/dienstFetch.ts` einen scheiternden `fetch` und 502/503/504 in einen Satz; nur 404 löscht den Schlüssel. **Ein Satz aus einer Quelle (14.10.2026):** `DIENST_PAUSE` in `shared/dienst-pause.ts` gilt für Worker (Tageslimit), Anmeldung, Einstellungen und Push; die Helfer `istD1Tageslimit`/`sekundenBisMitternachtUtc` liegen in `worker/src/d1-limit.ts`. Dazu `idx_subscribers_pref` (057): Abfragen über `pref_token` lesen 1 statt N Zeilen. Prüfungen: `tools/worker-auffangnetz.test.ts`, `tools/dienst-fetch.test.ts`.

## Belege: Quellen-Knopf, Abdeckung und Wand-Prüfung (05.10.2026)

**Oberfläche:** Eine Meldung zeigt statt Hostnamen-Links einen Knopf „Quelle"/„Quellen" (mit ▣ „Beleg"/„Belege", wenn mindestens eine Quelle ein gesichertes Bild hat). Er öffnet das Beleg-Fenster
(`web/src/components/beleg-dialog.tsx`) mit einem Reiter je Quelle: Erklärung, Originaladresse, Bild mit „Zur Fundstelle". Der archivierte Text (`.txt.gz`) und das HTML bleiben **privat** (Daniel, 05.10.2026);
sie dienen Hash, Fundstelle und Nachweis, nicht der Anzeige.

**Abdeckung:** Gemessen 05.10.2026: nur 71 von 482 Meldungen hatten einen Beleg-Knopf. Ursachen: 177 Meldungen trugen nur eine nackte `quelle` (Folgen, „Neu auf Deutsch"), und die Lesung kannte nur Artikel zu offenen Terminen
auf sechs Domains. Jetzt macht `belegeFuerAlle` (`pipeline/lib/beleg-lesung.ts`, beim Schreiben von `news.json`) aus jeder Quelle einen Beleg mit Bild, wo eines gesichert ist; `belege-lesen.ts` liest auch die Adressen
der Meldungen (`adressenAusNews`) und Crunchyroll-Serienseiten, Tokyo-Revengers-Seite und Disney+-Pressebereich. aniSearch-Katalogseiten (`/anime/…`) bleiben draußen. **Offen:** Quellen ohne lesbare Seite
(ADN-Schnittstelle, TMDB) und ungeprüfte Domains (tv.de, Kinoheld, plus.rtl.de, Wikipedia, MOTN, Amazon, Netflix) — jede neue Domain erst nach Handprüfung auf Banner (`data/beleg-domains.json`).

**Wand-Prüfung:** Audit am 05.10.2026 über alle 85 gesicherten Bilder (Kontaktbögen): **3 zeigten eine Zustimmungswand** (alle Anime2You/contentpass, Altbestand vom 03.10. vor der Wand-Prüfung); der Text-Abgleich
auf Banner-Wörter fand sie nicht, weil sie nicht im Artikeltext stehen. Seitdem: `sperreEntfernen` (`pipeline/lib/cookie-banner.ts`) tastet das Fenster vor jedem Foto an einem Raster ab und entfernt alles Feste, Klebende,
Dialoghafte oder Einwilligungstext-Tragende über dem Artikel (dreimal); bleibt etwas, gibt es **kein Bild** (`'wand'`), der Lauf zählt es als Störung, und die Adresse verliert ihr Bild (`entzieheBild`, `qs: wand`).
Ein Bild trägt `qs: ok`, wenn es mit der Prüfung entstand; Altbestand ohne `qs` und Wände kommen in der Warteschlange zuerst wieder dran. `npm run check:beleg-wand` baut sieben Wandarten nach
(festes Banner, absolute Wand mit Abdunklung, Dialog, Wand im Artikel, Block vor dem Artikel, sich neu aufbauende Wand); `npm run check:belege` zählt geprüfte und ungeprüfte Bilder und wird rot bei Wänden oder bei seit
06.10.2026 gelesenen Bildern ohne `qs`. **Audit wiederholen:** Bilder über `/beleg?key=…` laden und als Kontaktbogen ansehen (Skript im Scratchpad der Sitzung vom 05.10.2026, Vorgehen: `data/beleg-lesungen.json` → je Lesung ein Bild).

### Nachtrag Belege, 05.10.2026 nachmittags: Stützstelle, Prüfdaten, Leer-Wächter

- **Das Bild zeigt die stützende Stelle** (`pipeline/lib/beleg-stelle.ts`): der kleinste Absatz, Listenpunkt oder die Tabellenzeile, die den Titel **und** einen Termin des Releases nennt (`8. August 2026`, `04.12.`); alle solchen Zeilen bis 3.600 px, die Fundstelle markiert die oberste. Vorher zeigte das Bild die ersten Absätze, das Datum stand oft weiter unten (Netflix-August, 25 Disc-Verschiebungen).
- **Prüfdaten im Beleg-Fenster:** „erstmals geprüft am", „zuletzt geprüft am", „Bild vom" (`erstGeprueftAm`, `zuletztGeprueftAm`, `bildAm` am Beleg, aus `belegeFuerAlle`).
- **Datumsprüfung beim Lesen:** Das Datum der Kopfzeile **mit Uhrzeit** (`kopfzeilenDatum`) muss zu Veröffentlicht/Aktualisiert laut Seitendaten passen, sonst `datumsabweichung` und roter Wachhund. Ein Datum im Fließtext („ab 16. April 2027") zählt nicht.
- **Leer-Wächter:** Eine einfarbige Aufnahme (Standardabweichung der Helligkeit < 6) wird nie gespeichert (`'leer'`). Anlass: Die Crunchyroll-**Serienseite** (Tomb Raider King) kam schwarz heraus — Sony-Banner und Nutzungsbedingungen, JS-Seite. Serienseiten und alte `/de/<name>`-Adressen sind deshalb **nicht** im Muster; für „Folge N auf Deutsch" bleibt der Original-Link, später die eigene Messung als Beleg.
- **Altbestand wird ersetzt, nicht ergänzt:** Verglichen wird nur gegen Lesungen mit `qs: ok` (alte wurden mit anderem Text gehasht). Gemessen 05.10.2026 nach der Lesung: 193 Adressen, 181 mit Wand-Prüfung, 12 Altbestand ohne (kommen nachts). Crunchyroll-News und ADN-News sind als Domains von Hand geprüft (Bilder angesehen).
- **Beobachtung:** Der Hash eines Anime2You-Artikels kann zwischen zwei Lesungen am selben Tag wechseln, obwohl der Text gleich ist (nachgeladene Einbettungen wie „Externer Inhalt"). Ein Fall (Cyberpunk: Edgerunners 2); tritt es wieder auf, den Hash aus dem bereinigten Text bilden.

## Datenläufe neu geschnitten (05.10.2026)

Daniel: „analysier unsere läufer … fachliche und technische optimierprüfung … abhängigkeit unter den läufen, wo genau steckt sie drin, könnte man läufe aufteilen". Gemessen über 7–14 Tage
(`gh api`), dann umgebaut. **Befunde, in der Reihenfolge ihres Gewichts:**

| Befund | Messung | Folge |
|---|---|---|
| GitHubs Cron kommt zu spät | Verzögerung gegen den Plan, Mittel über 14 Tage: Stündlich ~4,6 h Abstand, Täglich 371 min, Wöchentlich 416 min, ADN 232 min | Daten 4–7 h älter als geplant; Cloudflare-Wecker für alle Zeitpläne (`shared/weckplan.ts`, `worker/src/wecker.ts`), `wecker-wache.yml` als zweite Linie |
| Eine Gruppe `daten` für alle Datenläufe | Wochenlauf 62–92 min (diese Woche ~107), davon hielt jede Minute Bau und Stundenlauf an; 15 von 148 Bauläufen in 7 Tagen abgebrochen (9 allein am 05.10. während des Wochenlaufs) | eigene Gruppen `bau`, `stunde`, `tag`, `woche`, `abruf`, `adn-laufende`, `anisearch-katalog`; nur der Bau schreibt auf `main` |
| Der Grund der Gruppe war ein Reset, der fremde Dateien überschrieb | `commit-data.sh` rettete **jede** Datei aus `QUELLEN`, auch die unveränderten (29.08. Handbelege, 16.09. disc-ausgaben) | `tools/quellen-aufsetzen.sh` legt nur die **eigenen** Änderungen zurück (Dateiebene, Löschungen eingeschlossen); `source-health.json` je Quelle der jüngere Eintrag, `dub-confirmed.yaml` wie bisher vereint |
| Wochenlauf: 34 Schritte nacheinander | größte: ADN-Katalog 22 min, aniSearch-Titel 45 min (!), Link-Prüfung 8–11, JustWatch 10, Crunchyroll-Tonspur 4–7, AniList-Katalog 6 | sieben Jobs nach Server und Abhängigkeit (siehe unten) |
| Ausgabe ging verloren | `public/data/voices` (seit 30.08.) und `data/adn-vde-historie.json` (seit 10.09., die Messreihe, für die `adn-laufende.yml` existiert) standen in keiner Quellenliste | beide in `tools/quellen-liste.sh`; Warnung `quellen_verloren` bei jedem Einreichen, wenn ein Lauf eine nicht eingetragene Datei schreibt |
| Der letzte Schritt war der einzige Weg zum Repo | Der Pull Request stand am Ende; scheiterte er, war alles weg. **So geschehen am 05.10.2026:** GitHub lehnte den Push ab, weil ich währenddessen Workflows geändert hatte („refusing to allow a GitHub App to create or update workflow …") — 107 Minuten Abrufe verloren | Zweig auf dem jüngsten `main`, drei Versuche, Artefakt `fund-<Job>` (14 Tage) vor dem Einreichen, `fund-nachliefern.yml` |
| Stille Fehlschläge | fast jeder Schritt `continue-on-error`; ein Fehlschlag war ein grüner Haken | `tools/schritt.sh`: Zeitgrenze (`--zeit`), Anmerkung im Lauf, Zeile in der Zusammenfassung, gelbe Meldung der Statusanzeige (`lauf-abmelden.sh`, `schritte-auswerten.sh`) |
| ADN-Katalog: „die ältesten 600" | Alter über `statSync().mtimeMs`; nach CI-Checkout haben alle Dateien dieselbe Zeit, die Sortierung blieb stabil → jede Woche dieselben 600 | `data/adn-katalog-stand.json` (in `QUELLEN`) |
| Doppelter aniSearch-Schritt im Tageslauf | 200 und 120 Seiten hintereinander, der zweite unter dem Kommentar zur Erweiterungs-Abholung | ein Schritt (200); Tageslauf in zwei Jobs, aniSearch unter der Sperre `anisearch` |
| `data:report` lief **nach** dem Pull Request | `15-news-vorschau.md` (in `QUELLEN`) ging nie mit | steht vor dem Einreichen |
| Kommentar und Code widersprachen sich | `cr-offene` liest `CR_ZUGANG` nirgends, nur `CR_WEICHE_TOKEN` | Kommentar im neuen Workflow berichtigt |

**Abhängigkeiten im Wochenlauf, wo sie stecken** (Datei, die der erste Schritt schreibt und der zweite liest):
`ann-ids.json` (ANN-Zuordnung → ANN-Sprecher), `CR_ZUGANG_FRISCH` per `GITHUB_ENV` (Zugangspaket → Crunchyroll-Tonspur), `rtlplus-katalog.json` (Katalog → Folgen), `anisearch.json` (Texte →
Folgenlisten), `anime-ids.json` (Texte → Titel), `tmdb-titles.json` mit `tmdbId` (TMDB → TMDB-Folgen und JustWatch), `justwatch-audio.json` (JustWatch → Kanal-Gegenprobe). **Rückwärts-/Vorwochen-
Abhängigkeiten** (ein Schritt liest eine Datei, die ein späterer derselben Woche schreibt, sieht also den Stand der Vorwoche): TMDB-Kino liest `tmdb-titles.json`, `cr-offene` liest `anisearch.json` und
`justwatch-audio.json`, die Link-Prüfung liest `anisearch.json`. Die Jobs behalten diese Reihenfolge innerhalb ihrer Familie; umsortieren würde den Datenstand ändern.

**Die sieben Jobs:** `anilist` (Rohdaten, Katalog, Sprecher AniList + ANN; als Einziger legt er `data/cache` ab) → `adn` (teilt AniList-Suchen); `crunchyroll` (Kalender, Zugangspaket, Tonspuren);
`anisearch` (Sperre `anisearch`, ~60 min = bestimmt die Dauer); `tmdb` (TMDB → JustWatch → Gegenprobe → CR-offene, wegen der gemeinsamen Datei `justwatch-handpruefung.json`); `rtl` (Katalog → Folgen,
Link-Prüfung); `sonst`. Jeder Job reicht seinen Fund als eigenen Pull Request ein, `abschluss` meldet die Statusanzeige.

**Gemeinsame Drosselung** (steht nicht im Code als Sperre, nur als Zusage): aniSearch 6 s je Seite — jetzt Sperre `anisearch` (Katalog, Wochen-Job, Tages-Job); AniList 750 ms (Katalog, Sprecher und ADN-Zuordnung
laufen deshalb hintereinander: `adn` hängt an `anilist`); `plus.rtl.de` 400–700 ms (Katalog, Folgen, Link-Prüfung — im selben Job).

**Lehren (in die Skills `stille-ausfaelle-verhindern` und `datenlaeufe-entwerfen` übernommen):**
1. **Ein Workflow, der andere Workflows starten oder liefern lässt, darf nicht geändert werden, solange einer läuft.** Jeder Push nach `.github/workflows/` macht den Pull-Request-Schritt laufender Sammler rot
   (stand schon in `CLAUDE.md`; am 05.10.2026 trotzdem passiert, weil „laufende Läufe fertig laufen lassen" und „Workflow umbauen" in einem Auftrag standen). Seitdem ist es abgefangen, aber nicht ausgeschlossen:
   vor einem Workflow-Push `gh run list --status in_progress` ansehen.
2. **Die Lieferung ist der gefährlichste Schritt eines Sammlers** — alles andere kann man wiederholen. Sie braucht Sicherung (Artefakt), Wiederholung und einen Weg, Gesichertes nachzuliefern.
3. **Wer Dateien eines Laufs in keiner Liste führt, verliert sie lautlos.** Die Warnung `quellen_verloren` macht das sichtbar; neue Ausgabedateien gehören in `tools/quellen-liste.sh`.
4. **Ein Alter, das im Dateisystem steht, ist in der CI keins** (Checkout setzt alle Zeiten). Alter gehört ins Repo (`adn-katalog-stand.json`, `ann-holstand.json`).
5. **Ein Test, der die Cloud-Typen eines anderen Pakets lädt, bricht den Wurzel-Typecheck** (Deploy zweimal rot, 05.10.2026): Was `check:logic` braucht, gehört nach `shared/`.
6. **Vor dem Push `npm run typecheck`, nicht nur die Teilprüfung des geänderten Bereichs.**

**Offen:** Der Test der sieben Jobs am echten Lauf steht aus (erster Lauf nach dem Umbau, Abgleich mit dem Stand vom 28.09.: Dauer, Zahl der Funde je Quelle, PRs). `claude-verpasst-recherche.yml` reicht noch ohne Artefakt ein (der Claude-Schritt widerruft die
Anmeldung; eine Sicherung bräuchte dort eine eigene Reihenfolge). Für aniSearch gibt es nur die Sperre zwischen Workflows, keinen gemeinsamen Zähler der 403/423/429-Abbrüche.

## Ein Hand-Nein kann den Bestandsbau blockieren (06./07.10.2026)

Am 06.10.2026 gegen 22:00 trug ich zehn Titel in `data/ohne-synchro-von-hand.yaml` ein. Zwei davon (Fairy Tail Final Season, Grisaia) hatten Handprüfungen in `dub-confirmed.yaml`. Nach dem Verschieben hinter den Toggle fand `check:handbelege` sie nicht mehr in `titles.json` („zeigen auf keinen Titel im Bestand“) und lehnte den Bestand ab: „Erzeugnisse und neue Meldungen werden nicht übernommen“. Die Läufe blieben grün, veröffentlicht wurde bis zum Morgen nichts (live `generatedAt` 06.10. 21:14 UTC, gemessen 07.10. 08:10).

- Ein Titel in `ohne-synchro.json` gilt jetzt als bekannt (verschoben, nicht gelöscht).
- Woran man es erkennt (Stand 12.10.2026): Der Bestandsbau endet **rot**, bei verletzter Zusicherung (`::error::Der gebaute Bestand verletzt eine Zusicherung`, seit PR 866 vom 11.10., dazu `DATEN_WARNUNG: Bestand nicht übernommen`) wie bei gescheitertem `data:build` (`::error::Der Neuaufbau ist gescheitert`).
  In beiden Fällen sind die Quellen vorher committet (teuer erkauft, unabhängig vom Bau), die Erzeugnisse nicht; `deploy.yml` startet nur bei success und bleibt aus. Bis 12.10.2026 endete der Aufbau-Ausfall mit Exit 0 (grün, nichts ausgeliefert).
  Im Bestandsbau (`BAU_LAUF=1`) geht seit 18.10.2026 bei verletzter Zusicherung jeder Quellen-Pfad außer den Abrufen von `data:fetch` auf HEAD zurück (`bau_lauf_zuruecknehmen`; behalten: `data/tmdb.json`, `data/curated-ids.json`, `data/anisearch-cover.json`, seit 19.10.2026 vollständig gegen die Schreibziele aus `tools/fetch-schreibziele.mjs` getestet; neue Dateien gehen auch aus dem Index): Vorher nahm er nur Belege und Stempel zurück, die daraus erzeugten Prüflisten kamen ins Repo (Lauf 39161629649, 95 Wiedervorlagen fehlten).
  `tools/commit-data-test.sh` (läuft in `check:workflows`) hält beide Ausgänge mit einem Attrappe-`npm` fest; `NUR_QUELLEN=1` (Abruf-Lauf) baut absichtlich nicht und bleibt grün.
  Altes Merkmal aus der Grün-Zeit: `public/data/titles.json` ändert sich über Stunden nicht, obwohl `chore(data): Bestand neu gebaut` committet wird.
- Bewusst grün bleiben (geprüft 12.10.2026): `data:extension-liste` scheitert (`::warning::`, Prüflisten zählen gegen den älteren Bestand), ein Pfad aus `QUELLEN` fehlt (`::warning::`, übersprungen), `umfang-pruefen.mjs --festschreiben` scheitert (still, Grenzen bleiben).
- Vor jeder Änderung an `ohne-synchro-von-hand.yaml`: `npm run check:handbelege` nach einem lokalen Bau, und den nächsten Bestandslauf bis zum Deploy beobachten.

## Prüfkette: das Ende der Ausgabe lesen, nicht den Rest (07.10.2026)

`(npm run check:vor-commit > datei; echo "ENDE exit $?" >> datei)` und danach **die Zeile `ENDE exit N`** lesen. Am 07.10.2026 wurde ein Stand gepusht, obwohl `check:vor-commit` mit `exit 1` endete (eine `check:logic`-Zusicherung hing noch an der alten Funktion `titelFuerAnsicht`); die Hintergrundmeldung „completed (exit code 0)" gilt dem Mantel, nicht dem Befehl darin. Ein lokaler `data:build` bricht am Titelschwund-Riegel ab (älterer Cache; frischen holen: `node tools/cache-holen.mjs`, Abschnitt „Lokaler Bau“); wer die Bau-Phasen dahinter prüfen will, löscht vorher `public/data/titles.json` (kein „vorher", kein Riegel) und setzt danach mit `git reset --hard` zurück.

**Seit 07.10.2026: `bash tools/pushen.sh`** — führt die Prüfkette aus und pusht nur, wenn sie grün ist (`&&`-Kette mit `set -e`). Zweimal am selben Tag ging ein Stand mit roter Prüfung hinaus, weil Prüfung und Push mit `;` verbunden waren. Nach einem lokalen Bau-Test außerdem `git clean -fdq public/data`, sonst meldet `check:logic` übrig gebliebene Folgendateien als Verstoß.

**Zwei Wege zum Deploy, seit 08.10.2026 (Daniel: „schlank / hart", kleine Änderungen sollen fast sofort live sein).** Gemessen vorher: Prüfkette vor dem Push 1,5 Minuten, Deploy 1:50 (Checkout 11 s, `npm ci` 12 s, Prüfungen 30 s, Bau 22 s, Hochladen 4 s, Pages 6 s).
`deploy.yml` hat jetzt vier Jobs: `build` (Bau und Hochladen), `pruefen` (die fünf Prüfungen, **parallel** zum Bau), `deploy_hart` (wartet auf beide) und `deploy_schlank` (wartet nur auf den Bau, wenn die Commit-Nachricht `[schlank]` trägt),
dazu `abschluss` (Abmeldung bei der Statusanzeige und Aufräumen roter Läufe, nach allen anderen). Schlank heißt: Die Prüfungen laufen weiter und färben den Lauf rot, wenn etwas nicht stimmt — sie halten den Deploy aber nicht auf.
`bash tools/pushen.sh --schlank` gilt nur für Änderungen an `web/`, `docs/`, `status.md`, `vite.config.ts` und den Auslieferungsdateien in `public/` (sonst bricht es ab), prüft lokal Typen und Umfang und hängt `[schlank]` an die Commit-Nachricht. Es ist für kleine Änderungen, die ich lokal vollständig nachgeprüft habe; alles andere geht den harten Weg.
**Gemessen nach dem Umbau (08.10.2026):** hart 92 s vom Push bis live (Bau 62 s, Prüfungen 65 s daneben, Deploy 19 s); schlank 58 s (Bau ohne Prüfkette 38 s, Deploy 12 s), dazu lokal 13 s statt 1,5 Minuten. Zusammen: Push bis live bei einer kleinen Oberflächenänderung rund 70 s statt rund 200 s. Der Bau-Job ist jetzt der längste Pfad (Checkout 11 s, `npm ci` 13 s, Bauen 25 s).
**Cache:** GitHub Pages liefert `max-age=600`. Der Bau legt `version.json` (Commit-Kennung) ab, `web/src/lib/aktualisierung.ts` fragt sie **nur beim Laden der Seite** mit eindeutiger Adresse ab und lädt bei neuer Kennung einmal neu (Service-Worker-Cache `shell-*` wird verworfen; `sessionStorage` verhindert eine Schleife). Kein Neuladen mitten in der Benutzung (Daniel, 08.10.2026). Seit 11.10.2026 zählt auch die Rückkehr in einen Tab oder die App nach mindestens 10 Minuten im Hintergrund (`visibilitychange`) wie ein Laden — Handy-Tabs blieben sonst Stunden auf altem Stand; kein Banner.

**Bevor eine Pipeline-Änderung gepusht wird, die den Bau verändert (07.10.2026):** Zweimal blockierte ein neuer Prüfpunkt oder ein neuer Titelschwung den Bestandsbau (`DATEN_WARNUNG: Bestand nicht übernommen`) — einmal ein Prüfpunkt auf dem gebauten Bestand, einmal die neuen aniSearch-Titel gegen `check:logic` („Teilnummer im Namen"). Beides hätte ein lokaler Bau gezeigt. Vorgehen: Änderung lokal committen, `rm public/data/titles.json` (ohne „vorher" kein Titelschwund-Riegel), `npm run data:build`, danach `npm run check:logic`, `npm run check:cr-zuordnung`, `npm run check:bestand`; zurück mit `git reset --hard HEAD && git clean -fdq public/data`. Erst dann `bash tools/pushen.sh`.

## Lokaler Bau: aktueller `data/cache/` mit einem Befehl (11.10.2026)

**Befund.** Der lokale `data/cache/` ist so alt wie der letzte Handgriff (am 11.10.2026: AniList-Katalog vom 03.09.2026, 38 Tage; es fehlte z. B. AniList 217712). Ein lokaler `pipeline/build.ts` bricht dann am Titelschwund-Riegel ab (55 verlorene Titel), und Bauer behalfen sich mit Schwellen-Hacks. Es gab kein Werkzeug: Der frische Stand liegt nur im Actions-Cache `anilist-cache-<run_id>` (rund 110 MB), und **den kann außerhalb eines Laufs niemand laden** (`gh cache` kann nur listen und löschen, die REST-Schnittstelle kennt keinen Download). In den 100 jüngsten Artefakten (gemessen am 11.10.2026) enthielt keines `data/cache/` — `fund-*` sind die Pull-Request-Dateien der Sammler.

**Werkzeug:** `node tools/cache-holen.mjs` (im Arbeitsbaum, in dem gebaut wird) lädt das jüngste Artefakt `data-cache` per `gh` nach `data/cache/` dieses Arbeitsbaums und zeigt den Stand des Katalogs (`geholtAm`) vorher und nachher. **Ist kein Artefakt jünger als 24 h da (`--max-alter <Stunden>`), stößt es `cache-ablegen.yml` selbst an und wartet auf das Ende** (`gh workflow run`, `gh run watch`), sonst lädt es direkt. Es weigert sich, wenn `data/cache` ein Junction/Symlink ist (sonst würde der Cache des Hauptordners überschrieben; Bau-Arbeit legt **keinen** Junction auf `data/cache`, `node_modules` genügt). Danach: `npx tsx pipeline/build.ts`, ohne Schwellen-Umweg; zurücksetzen mit `git reset --hard HEAD && git clean -fdq public/data`.

**Der Workflow** `.github/workflows/cache-ablegen.yml` läuft nur auf Abruf (`workflow_dispatch`, kein Zeitplan — Zeitpläne kommen vom Cloudflare-Wecker, und ein tägliches Artefakt braucht niemand): `actions/cache/restore` mit `restore-keys: anilist-cache-` (nur lesen, nichts speichern), dann `upload-artifact` `data-cache` mit `overwrite: true` und `retention-days: 1`. Kosten: ein Artefakt um 110 MB, nur wenn jemand den Stand braucht. Der Cache enthält nur gesammelte Quelldaten, keine Zugangsdaten (Register: `data/cache-register.json`); das Repo ist öffentlich, also kann jedes angemeldete GitHub-Konto das Artefakt laden (einen Tag lang, `retention-days: 1`; so steht es in der GitHub-Doku, hier nicht gegengeprüft) — deshalb darf nie etwas Geheimes hinein. Der Stand folgt dem **Schlüssel**, nicht dem Inhalt (Abschnitt „Der Actions-Cache … kennt keinen Besitzer"): Zeigt `geholtAm` etwas Altes, ist das der Befund, nicht das Werkzeug. Die Datei erst pushen, wenn kein Sammler läuft (`gh run list --status in_progress`); `gh workflow run` findet sie erst, wenn sie auf `main` liegt.

## Register der Zugänge und Wächter (08.10.2026)

Alles, wovon die automatischen Läufe leben, steht in `data/zugangs-register.json`: 18 Zugänge (Namen, nie Werte) mit Zweck, Workflows, Gültigkeit samt Beleg, Erneuerungsweg (automatisch/Handgriff) und Folge bei Ablauf; dazu die Frist je überwachtem Lauf. Die Workflow-Listen prüft `node tools/zugangs-waechter.mjs --register-pruefen` (in `check:workflows`) gegen `.github/workflows/` — ein neues `secrets.X` ohne Registereintrag bricht die Prüfkette.

**Ablaufdaten:** Belegt sind nur CR_ZUGANG (24 h) und das Weichen-Paket (24 h, jeder Lauf holt es neu); für alle Anbieter-Token und den Wecker-PAT steht die Laufzeit nicht im Repo. `gueltigBis` ist deshalb leer; wer es im Konto abliest, trägt das ISO-Datum ein, der Wächter warnt dann 14 Tage vorher.

**Wächter** `node tools/zugangs-waechter.mjs` (täglich in `delta-wache.yml`, ohne Secret, nur `gh run list`): (1) ist der letzte Erfolg jedes überwachten Laufs innerhalb seiner Frist, (2) Kontingent: ein Claude-Schritt (`claude-code-action` / „Recherche"), der binnen 60 s scheitert, wird als „Kontingent leer oder Token ungültig" gemeldet, solange kein späterer Lauf gelungen ist, (3) startet der Cloudflare-Wecker noch (stündlicher Lauf per `workflow_dispatch` in den letzten 5 h), (4) Ablauf nah. Erster Lauf 08.10.2026: Befund `tonspuren-monatlich.yml` (letzter Erfolg vor 867 h, Frist 840 h — der bekannte stille Ausfall); der Kontingent-Fall vom 02.10. (Lauf 37035218875) ist durch spätere Erfolge erledigt.

## Der Vortagsvergleich der Wache fand nie einen Vortag (08.10.2026)

`tools/wache-schreiben.mjs` vergleicht die ausgelassenen Termine mit dem Stand des Vortags. Der lag in `data/cache/`, das in der CI nur der Actions-Cache `anilist-cache-` füllt — `delta-wache.yml` stellte nichts wieder her, jeder Lauf war ein „erster Lauf" (die Läufe vom 02.–07.10. liefen grün, ohne je zu vergleichen). Jetzt liegt der Stand in `.wache-stand/ausgelassen.json` (mit Datum), wird mit eigenem Präfix `wache-stand-` per `actions/cache/restore` geholt und mit `if: always()` per `actions/cache/save` gesichert; die Wache nennt „Vergleich mit dem Stand vom …" oder „kein Vortagsstand", ein Stand über 3 Tage alt ist ein Befund. `check:workflows` bricht ab, wenn Restore oder Save fehlen oder den Pfad nicht nennen.

## Prüfweg für Pull Requests: PR-Prüfkette und Prüfer-Review (10.10.2026)

Vorher hatte kein Workflow den Trigger `pull_request`, `main` war ungeschützt (Befund: `daniel-zum-abarbeiten/berichte/pruefweg-pr-spezifikation.md`).
Jetzt: `pr-pruefung.yml` (Sammeljob `PR-Prüfkette` über fünf parallele Teiljobs, die zusammen `check:vor-commit` abdecken (seit 16.10.2026, Wächter `tools/pr-kette-pruefen.mjs`; Setup mit node_modules-Cache über `.github/actions/kette-einrichten`); `PR-Aussehen – Panel|Ansichten|Ansichten Handy` als drei parallele Matrix-Teile, seit 16.10.2026 im Sammeljob `needs` (Wächter prüft nur noch deren Form nicht), nur bei Änderungen an `web/src` und den Werkzeugen (Test `tools/pr-aussehen-pfade.test.mjs`)) und `pr-pruefer.yml`
(`pull_request_target`, läuft in der Fassung von `main`, kein Checkout des PR-Zweigs; Claude schreibt Protokoll und `urteil.json`, `GITHUB_TOKEN` kommentiert und gibt frei, nur
wenn die SHA im Urteil dem Head entspricht). Beide überspringen `daten/`-Zweige, Fremd-Forks und Entwürfe. Laufzeit vor der Aufteilung (16.10.2026): Median 4,9 min. Ein neuer PR startet ohne `node_modules`-Cache (Cache-Schlüssel aus `package.json` und Lock), der Cache hilft erst ab dem zweiten Push; gemessen (16.10.2026): erster Lauf 1 min 57 s gegenüber 4,9 min im Median vorher.
Ruleset, GitHub-App, Secrets und Auto-Merge sind Daniels Handgriffe (Spezifikation, Abschnitt 4); bis das Ruleset steht, erzwingen die Workflows nichts.
Diff-Aufbau (11.10.2026): `tools/pr-diff-bauen.mjs` baut den Prüfer-Diff je Datei aus der API-Dateiliste (`gh pr diff` bricht über 20000 Zeilen ab, ein 400000-Byte-Limit auf dem Gesamttext ließ den Code hinter einer großen JSON verschwinden). Nur eine Positivliste wird bei über 50000 Byte Diff zur Stub-Zeile: `public/data/**` (json, jsonl, yaml) und die Einträge unter `data/` aus `tools/quellen-liste.sh` (das Skript liest sie von dort, keine zweite Liste), seit 12.10.2026 auch `data/stammdaten/**` (maschinelle Schnappschüsse mit eigenen Prüfungen, z. B. `anilist-eingefroren.json`). Handdateien (`*-von-hand.yaml`, Ankündigungen, Grenzen), `data/dub-confirmed.yaml`, `data/curated/**`, `data/cache/**`, Code, Workflows und Doku nie; ein nicht lieferbarer Diff außerhalb der Liste ergibt `unvollstaendig`. Der Prüfer prüft bei Stubs, dass die Datei in der Beschreibung genannt ist. Seit 25.10.2026 werden, wenn der Gesamtdiff 400000 Byte überschreitet, zusätzlich weitere Dateien derselben Positivliste gestubbt (größte zuerst, bis der Rest passt; PR 1944: 90 kleine Erzeugnis-Diffs); `unvollstaendig` bleibt nur, wenn Nicht-Stubbares allein die Grenze reißt. Seit 12.10.2026 wird eine Umbenennung nur gestubbt, wenn auch `previous_filename` stubbar ist (sonst verschwände z. B. `web/x.ts` → `public/data/x.json` ungelesen). Seit 13.10.2026 werden auch die erzeugten Einzeiler `extension/offene-*.js` gestubbt (PR 1060: ohne API-Patch, „unvollstaendig“ → immer „aendern“), aber nur, wenn die Datei als Eintrag in `tools/quellen-liste.sh` steht und ihr Inhalt am PR-Kopf (`git cat-file`) vollständig aus Zeilen `globalThis.AK_NAME = <gültiges JSON>` besteht (`istDatenJs`); jede andere JS-Datei, auch mit nur einem Kommentar oder `;` mehr, bleibt im Diff sichtbar.
Stufe 0 (12.10.2026, Daniel, Option A): `pr-pruefer.yml` überspringt Stufe 0 nicht mehr, sondern prüft schlank (eigener Schritt „Prüfer (Stufe 0, schlank)“: nur `pr.diff` und Beschreibung, `--max-turns 8`, kurzer Auftrag, Protokoll höchstens 8 Zeilen). Das Urteil kommt aus diesem Lauf, die Freigabe gibt derselbe Schritt „Protokoll und Freigabe“ wie bei Stufe 1/2 (SHA-Abgleich, Token-Muster, fail closed); ohne Urteil keine Freigabe, bei Befund Änderungswünsche. Anlass: Der Branch-Schutz verlangt eine Freigabe, grüne Kleinigkeiten mit Auto-Merge blieben sonst hängen.
Check-Stand (18.10.2026, PR 1510: „ok“ bei roter `Kette – Workflows`): Nach dem Urteil wartet der Schritt „Check-Stand des Kopfes“ (`tools/pr-checks-stand.mjs`, Takt 20 s, Frist 12 min), bis die Pflicht-Checks des Rulesets (`GET repos/…/rules/branches/main`, heute nur `PR-Prüfkette`) am Kopf grün sind oder ein Check rot ist. „ok“ ohne Zusatz nur bei grün; sonst lautet die erste Kommentarzeile „ok, Checks rot: …“, „ok, Checks laufen noch: …“ oder „ok, Checks-Stand unbekannt“. Die Freigabe bleibt (das Ruleset sperrt den Merge ohnehin), damit eine grüne Wiederholung der Kette keinen zweiten Prüfer-Lauf braucht. Verworfen: `workflow_run` nach der Kette (jede Wiederholung der Kette wäre ein weiterer Prüfer-Lauf mit Kontingent, Urteil erst nach der Kette) und einmaliges Lesen ohne Warten (Prüfer gemessen 1–2,5 min an 30 Läufen, Kette 4–5 min: fast immer „laufen noch“). Der volle Prüfer hat seit demselben Tag die Vorgabe „Folgeläufe“ (Tag 2, leere/gelöschte Eingabe, Zurückgestellte, Wachen; übersprungene Tests belegen nichts; Zuordnungsbilanz je Ziel inhaltlich).
Abnahme-Modus (24.10.2026, Daniel 21.10.: „der prüfer darf nur 1x drüber gucken“): Der Schritt „Prüfmodus“ (`tools/pr-pruefer-modus.mjs`) liest die PR-Kommentare. `voll` gilt für die erste Bewertung des bereiten PR wie bisher und für jeden Kopf nach einem „ok“ (neuer Inhalt nach einer Freigabe hat keine Auflagen, an denen er sich messen ließe). `abnahme` gilt, wenn das jüngste CI-Review („**Prüfer-Review** für <Kopf>“ von `github-actions[bot]`, auf welchem Kopf auch immer, auch dem aktuellen) „aendern“ lautet und Auflagen vorliegen; dann läuft nur der Schritt „Prüfer (Abnahme)“: Er liest `auflagen.md` (Agent-Prüfer-Kommentare „Prüfer …:“ von Inhaber, Mitgliedern, Mitarbeitern, dazu die CI-Reviews mit Urteil aendern aus dem Modus voll), `pr.diff` und die Beschreibung mit Nachträgen, urteilt je Auflage ja/nein samt Diff-Abdeckung und meldet keine neuen Funde, außer einer Regression mit Commit und Datei:Zeile. Das Ruleset `main-pruefweg` bleibt unverändert; „ok“ im Abnahme-Modus ist das Approval auf dem letzten Push. „aendern“ im Abnahme-Modus sperrt (Review `--request-changes`) nur bei Prüfstufe 2 und nur einmal (`aendern-frei=1`); sonst bleibt es bei einem Kommentar „Urteil: **aendern, Auflagen offen: Dirigent entscheidet**“ ohne Review, der Dirigent entscheidet (ein früheres Request-Changes des Bots bleibt dann stehen, bis ein neues Review es ablöst oder der Dirigent es übergeht). Die Marke `<!-- pruefer-modus: voll|abnahme -->` in der letzten Zeile des CI-Kommentars zählt die bisherigen Abnahme-Urteile. Fällt der Schritt aus, gilt `voll` (mehr Prüfung, nie weniger). Tests: `pr-pruefer-modus.test.mjs` (Modus, Frei-Weiche), `pr-pruefer-ablauf.test.mjs` (Schritte laufen wirklich), `pr-pruefer-freigabe.test.mjs` (Urteil → Review). Das Urteil des Modells selbst prüft kein Test; die erste Probe am echten Fall steht nach dem Merge aus.
Zitate im Kettenlog (31.10.2026, PR 2549): Der Abnahme-Prüfer führte „Ergebniszeile zitieren“ als offen, obwohl `Alle Zusicherungen halten (4 Handlisten-Einträge).` im echten Job-Log stand (Lauf 41241039493, „Kette – Logik“). **Ursache (gemessen):** `ergebniszeilen()` in `tools/pr-kettenlog.mjs` nimmt nur Zeilen, die auf das Muster `ERGEBNIS` passen (Schlusszeilen wie „ok“, „N von M“, Fehlerformen), und kappt dann je Job auf `JE_JOB_ERGEBNIS` = 450; diese Zeile passt auf kein Muster und stand nur in `kettenlog-voll.txt`, das der Abnahme-Prüfer ohne Grep nicht durchsuchen kann (`pr-pruefer-ablauf.test.mjs`: „liest nur den Prüfordner“). **Warum es bisher nicht auffiel:** Der volle Prüfer hat Grep und fand jede Zeile; der Test von `ergebniszeilen` prüfte nur Zeilen, die dem Muster entsprechen, und die Kappung nur mit Füllzeilen derselben Form. Der Abnahme-Modus (24.10.2026) hat die Grenze „kein Grep“, der Kettenlog (28.10.2026) wurde für den vollen Prüfer gebaut; beide Annahmen zusammen wurden nie an einem echten Zitat gemessen. **Behoben:** `tools/pr-kettenlog-zitate.mjs` zieht die Backtick-Zitate (ab 15 Zeichen, höchstens 30, je 200 Zeichen) aus dem Abschnitt „Nachträge“ von `pr-beschreibung.txt` und legt ihre Treffer (höchstens 3 je Zitat, mit Job-Name) oder „kein Treffer“ in `kettenlog-zitate.txt` ab; „Im Log nicht gefunden“ gilt erst bei „kein Treffer“ dort. Lehre: Was ein Prüfer ohne Grep belegen soll, legt der Schritt vorher als Datei bereit, nach dem, was der Nachtrag tatsächlich zitiert, nicht nach einer Mustervermutung.

## Worker: ein Meldungsstapel wirft nie (10.10.2026)

Ein 10er-Stapel an `/pruefung` speicherte alle Meldungen und warf danach eine ungefangene Ausnahme (`scriptThrewException`, 4 Fälle am 10.10.); Cloudflares 500-Seite hat kein CORS, die Erweiterung sah „Failed to fetch". Verdächtig waren zehn gleichzeitige `BELEGE.put(MARKE)` (R2: ein Schreibzugriff je Sekunde und Schlüssel) und die Grenze von 50 Subrequests (10 × 5 + 2 = 52). Beides ist behoben: Der Stapel ruft den Speicherweg je Meldung ohne Abschluss (`pruefung-stapel.ts`), die Marke schreibt `handlePruefung` einmal; `exporteVerwerfen` fängt Fehler ab; je Meldung liefert die Antwort `ok` oder `{ ok: false, status }` (500 bei Ausnahme, 503 jenseits des Budgets von 44 Aufrufen — die Erweiterung wertet nur `ok`). `[observability]` bleibt vorerst aus (10.10.2026): es würde jedes `console.*` des Workers erfassen, auch Ausgaben mit Mailadressen (`index.ts` Versandfehler); erst diese bereinigen, dann mit Datenschutztext einschalten. Test: `tools/worker-stapel.test.ts` in `check:worker`.

## Wachen-Urteil als Claude-Lauf (11.10.2026)

`claude-wache-urteil.yml` ("Claude — Wache durchsehen") ersetzt den Dauerauftrag "Wache durchsehen" aus `status.md` (Fahrplan 3, `autonomie-plan.md`): Der Wecker startet ihn täglich 09 UTC, knapp zwei Stunden nach der Wache (`delta-wache.yml`, 07:20). `tools/wache-urteil.mjs --sammeln` legt elf Befunddateien in einen Arbeitsordner (`tools/wache-urteil-dossier.mjs`: Läufe der letzten 48 Stunden, Delta, Briefkasten, Zugänge, Wochenwache, Quellenzustand, ausgelassene Serien, offene Issues/PRs, Posteingang, frühere Urteile, Wache-Datei; eine unlesbare Quelle steht als `FEHLER beim Sammeln` im Dossier und ist selbst ein Befund). Das Modell (`claude-sonnet-5`) liest sie nach `tools/wache-urteil-anleitung.md` und legt `ergebnis/urteil.md` mit Write neu an: `Lage: ruhig|befund` und vier Absätze mit den Fragen aus `00-wache-auswertung.md`. `--uebernehmen` prüft die Form (`wache-urteil-eintrag.mjs`: keine Adressen oder Verweise (auch `www.` und `](`), keine @-Erwähnungen von Personen, kein Markup, keine Überschriften, höchstens 5000 Zeichen; das Dossier wertet den eigenen Workflow nicht als Ausfall) und setzt bei `befund` den Eintrag oben in die Auswertung; bei `ruhig` bleibt die Datei unverändert (Daniel, 26.09.2026). Eingereicht wird über `quellen-pr.sh` (die Datei steht in `quellen-liste.sh`), die Zusammenfassung hängt als Kommentar am Pull Request.

**Schutz gegen fremde Eingabe:** Titel von Issues und PRs, Posteingang und Fehlertexte sind fremder Text. Das Modell hat nur Read (Arbeitsordner, Anleitung) und Write auf `ergebnis/**`, kein Bash, kein Netz; die Form-Prüfung verwirft ein Urteil mit Adressen oder Markup. Antwort-Datei per Write neu anlegen statt eine Vorlage zu editieren (Edit verlangt vorheriges Lesen, Lauf 38131274505). **Zugang:** der Lauf steht im `zugangs-register.json` (Frist 48 h, `claude: true`), in `wecker-wache.yml` (Nachholen nach 30 h), in `wache-woechentlich.mjs` (36 h) und in `claude-daten-merge.yml`/`lauf-sql.ts` (Lauf-Art). **Probelauf 11.10.2026** mit den echten Befunden des Tages: siehe PR-Beschreibung.

## Datenläufe liefern mit dem Token der App anime-kalender-daten (11.10.2026)

Das Ruleset `main-pruefweg` (Squash-PR mit einer Freigabe, kein Direkt-Push) lässt nur die App `anime-kalender-daten` (Bypass „always“) und Admins durch;
`GITHUB_TOKEN` kann kein Bypass-Akteur sein. Darum holen alle Läufe, die auf `main` schreiben oder mergen, ein Token mit `actions/create-github-app-token@v3`
(`DATEN_APP_ID`/`DATEN_APP_KEY`, Rechte contents und pull-requests):

- **Direkt-Push:** `bestand-bauen.yml` (Checkout mit App-Token, danach pusht `commit-data.sh` unverändert), `delta-wache.yml`. Fehlt das App-Token, wird der Lauf rot; einen Rückfall auf `github.token` gibt es nicht (ein nie gemergter PR bliebe unbemerkt).
- **PR anlegen und selbst mergen:** `.github/actions/einreichen` (neue Eingaben `app-id`/`app-key`, Composite-Actions sehen keine Secrets; alle 16 Aufrufer reichen sie durch),
  `claude-anime2you-extraktion.yml`, `claude-verpasst-recherche.yml`, `claude-wache-urteil.yml`; `fund-nachliefern.yml` über die Action. Der Zweig-Push läuft weiter mit der Checkout-Anmeldung.
- **Konflikt-PRs:** `claude-daten-merge.yml` lässt Claude nur auflösen und pushen; ein Schritt danach mergt jeden jetzt `MERGEABLE`en `daten/`-PR mit dem App-Token.
- **Bypass beim Mergen (Beleg 2, Lauf 38135294637, 11.10.2026):** Ein Bypass-Akteur muss ihn ausdrücklich nutzen. Ohne `--admin` meldet `gh pr merge` bei einem auf Freigabe wartenden PR „add the --auto flag / --admin flag“ und tut nichts; alle App-Merges laufen deshalb mit `gh pr merge --squash --admin` (`tools/quellen-pr.sh`, `tools/daten-pr-mergen.sh`). Scheitert ein mergebarer Daten-PR, ist der Lauf rot; ein PR mit fremdem Autor (z. B. lokaler Lauf von Daniels Rechner) wird mit Warnung übersprungen (21.10.2026), und `quellen-pr.sh` nennt Zweige ohne `GITHUB_RUN_ID` `fix/lokal-…` statt `daten/…` (Kette und CI-Prüfer überspringen `daten/`, PR 1691 kam so nie durch); `claude-daten-merge.yml` (Job `nachholen`) holt liegengebliebene mergebare `daten/`-PRs nach. Agenten-Merges mit Nutzer-Token: seit 19.10.2026 kein `--auto`, sondern `node tools/pr-nachrechnen.mjs <PR>` und dann `gh pr merge --squash` (nie `--admin`); soll `[schlank]` in die Squash-Nachricht, mit `--body "<Text>"` (`deploy.yml` liest es dort). Messung mit aktivem Ruleset steht aus.
- **Schleifen:** Pushes mit App-Token lösen Workflows aus (`GITHUB_TOKEN` tat das nie). `bestand-bauen.yml` und `deploy.yml` überspringen `push`-Läufe des Akteurs
  `anime-kalender-daten[bot]` per Job-`if` (Verhalten wie vorher: Sammler-Merges bauen nichts, der Bau-Commit deployt über `workflow_run`). Der übersprungene Lauf bekommt eine
  eigene Concurrency-Gruppe (`app-push-<Lauf>`), sonst würde er in `pages` einen laufenden Deploy abbrechen und in `bau` einen wartenden Bau verdrängen.
  `check:workflows` kennt diese Form der Gruppe `bau`. **Ob `github.actor` bei einem Squash-Merge der App wirklich `anime-kalender-daten[bot]` ist, ist erst am ersten echten Lauf belegt** (Test T4 in der Spezifikation).
- **Lokal:** `tools/pushen.sh` und `tools/erneut-melden.mjs` pushen nicht mehr nach `main`, sondern reichen über `tools/pr-einreichen.sh` einen PR ein und schalten seit 19.10.2026 keinen Auto-Merge mehr ein: das Skript druckt `node tools/pr-nachrechnen.mjs <PR>` und `gh pr merge <PR> --squash --delete-branch --body "<Text>"`;
  `[schlank]` steht im Squash-Text (`--body`), den `deploy.yml` liest.
  Frühere Lücke (geschlossen am 19.10.2026, kein Auto-Merge mehr): Auto-Merge rechnete die Kette nicht gegen den neuesten main nach (Abschnitt „PR-Kette vor dem Merge nachrechnen“).
- **Vorprüfung vor dem Push (16.10.2026):** `tools/pr-einreichen.sh` ruft vor `git push` `tools/pr-vorpruefung.mjs` auf (Patch-Notes-Pflicht, `check:umfang`, Uhr-Grenze der Tests `tools/uhr-in-tests.mjs` mit Fundstellen der Diff-Dateien (24.10.2026), Bot-Pfade-Wächter `tools/pr-nachrechnen-bot-pfade.test.mjs` (nur wenn der Diff eine Kettendatei, die Prüfliste oder den Wächter berührt, `tools/pr-vorpruefung-bot-pfade.mjs`; ca. 7 s), geänderte Dateien gegen den PR-Text, `data/cache/`, Workflow-/Prüfungsänderung benannt). Rot bricht ab; Grund: 57 % der „ändern“-Urteile des CI-Prüfers betrafen eine Beschreibung, die nicht zum Diff passte. Inhaltliche Regeln (Belege, Umbau gegen Verhalten, Zeilen auf den Auftrag zurückführbar) bleiben beim CI-Prüfer.

## Bestandsbau: Doppelläufe bei Push und selbstschließende Rot-Issues (11.10.2026)

- Messung 11.10.: 23 Bauläufe, zwei echte Doppelbauten im 5-s-Abstand (12:05:32/37, 12:36:12/17; zwei Merges, der erste Bau checkt `main` aus und hat beide Stände schon) und ein Bau nur wegen `shared/weckplan.ts` (PR 747). Bericht: `daniel-zum-abarbeiten/berichte/doppelbau-2026-10-11.md`.
- Abhilfe: Der Push-Auslöser nimmt `shared/weckplan.ts` und Markdown unter `data/`, `pipeline/` aus. Job `vorab` überspringt einen Push-Bau, wenn nach dem Auslöser schon ein Bau-Commit auf `main` steht (`tools/bau-schon-gebaut.sh`; Fehler = bauen; `workflow_run` und `workflow_dispatch` bauen immer). Das ist sicher, weil `commit-data.sh` bei bewegtem Fernstand neu aufsetzt und neu baut: ein Bau-Commit mit `public/data` hinter dem Auslöser enthält ihn. `concurrency` allein hilft nicht (der erste Lauf startet sofort; `cancel-in-progress` bräche einen Bau mitten im Push ab).
- Nachtrag 12.10.2026: Als Bau zählt nur ein Bau-Commit, der `public/data` berührt (serverseitiger Pfadfilter `commits?path=public/data`). Anlass: Der Bau nach PR 959 brach an `check:bestand` ab, `commit-data.sh` committete nur Quellen und Verlaufsdateien unter demselben Titel „Bestand neu gebaut“, der Folgelauf übersprang darauf den Bau, und die Meldung fehlte live bei grünen Läufen. Preis: Ein gelungener Bau ohne geänderte Erzeugnisse zählt nicht, ein zweiter Push-Lauf im Sekundenabstand baut dann einmal doppelt (Vollbau in der Gruppe `bau`, nacheinander, kein Datenverlust); stündliche und `workflow_run`-Läufe sind nicht betroffen. Test: `tools/bau-schon-gebaut-test.sh` (Attrappe-`gh` über lokalem Verlauf, in `check:workflows`).
- Rot-Issues („Bestandsbau rot: …“) öffnen Reparatur-Läufe und Agenten; ein grüner Bau schließt jetzt die davor entstandenen mit Lauf-Link (`tools/bau-issues-schliessen.sh`, Titelmuster dort).
- Offen, nicht angefasst: die zwei Bau-Commits eines Doppelbaus wechselten sich ab (+31/−8, dann +8/−29 bei gleicher Eingabe) — der Bau ist an einer Stelle nicht idempotent; Ursache nicht untersucht.

## Bestandsbau verliert den Push-Wettlauf: Neuversuch nur so lang wie nötig (24.10.2026)

- Anlass: Lauf 40091570662 (und 40092002891) wurde nach 45 min abgebrochen. Im Schritt „Änderungen committen“ (`tools/commit-data.sh`) lehnte GitHub jeden der sechs Pushes ab („fetch first“). Je Neuversuch lief alles neu: `data:build` ~2,4 min, Listen ~0,1 min, `check:bestand` (lokal 68 s) plus `check:logic` (283 Prüfungen) bis zum Ende ~4,6 min, zusammen ~7,2 min Log-Abstand von Versuch zu Versuch (12:00:44 → 12:07:55). In der Zeit mergte die Reihe PRs und der Sammler pushte; main bewegte sich also schneller als der Bau.
- Abhilfe (`tools/neuversuch.sh`, `tools/neuversuch-art.mjs`, Pfade aus `pr-nachrechnen.mjs`): Nach einem ganz grünen Versuch entscheidet der Fernstandsvergleich: nur Bot-Dateien ohne Leser bewegt → kein Bau, weder `check:bestand` noch `check:logic`, Erzeugnisse bleiben und werden neu aufgesetzt (Neuversuch in Sekunden). Ausgenommen sind Bot-Dateien, die `check:bestand` oder `check:bestand-liste` lesen (`BESTAND_GELESEN` in `neuversuch-art.mjs`, heute `tools/kalender-plausibilitaet-grenzen.json`; Test `neuversuch-art-leser.test.mjs` hält die Liste gegen die Leser): ihre Bewegung gilt als `daten`. Der Vergleich nutzt `--no-renames`, eine Umbenennung von Code in einen Datenpfad bleibt so eine Code-Bewegung; nur Datenpfade seit der letzten grünen `check:logic` → Bau und `check:bestand` neu, `check:logic` entfällt (~4 min statt ~7), denn es darf `public/data` per Wächter nicht lesen und Datenpfade ändern seine Eingaben nicht; alles andere oder irgendein Vergleichsfehler → volle Kette wie bisher. War der Versuch nicht grün (Bau, Liste, Bestand, Logik, Quarantäne), gilt immer die volle Kette.
- Grenze: Bewegt sich Code (Merge-Reihe) zwischen zwei Versuchen, bleibt der Neuversuch bei ~7 min, denn `check:logic` prüft dann das Zusammenspiel. Reicht das nicht, wäre der nächste Schritt ein Bau auf dem Fernstand ohne Wartezeit (Push direkt nach `check:bestand`, `check:logic` danach) — nicht gebaut, weil es die Reihenfolge der Sicherheitsprüfung umdreht.
- Wächter: `tools/commit-data-test-neuversuch.sh` (Szenarien nichts/daten/code und drei „Versuch nicht grün“-Fälle, Zählung der npm-Aufrufe) und `tools/neuversuch-art.test.mjs`.

## Briefkasten-Rückstau, 11.10.2026: Zeilen sind keine Adressen

Das Wache-Urteil vom 11.10. nannte „189 Meldungen, 160 Adressen ungelistet". Gemessen (`?zaehlen=1` und `GET /pruefung`): 189 **Zeilen** auf **36 Adressen**, die jüngste vom 03.10. — der Briefkasten wächst nicht, er hält Daniels Amazon-Durchgang vom 22.09.–03.10. (Staffel für Staffel eine Zeile je Folge). `briefkasten-wache.mjs` zählte `adressen` (eine je Meldung) statt je Adresse. Dazu der echte Befund: `fetch-pruefungen.ts` lässt Meldungen mit unklarer Staffel („in der Reihe nicht zu bestimmen", Seite gehört nicht zum Auftragstitel, Folgenzahl passt nicht, keine Folge in den Zielstaffeln) absichtlich liegen, nannte sie aber nur im Lauf-Log; 28 der 36 Adressen standen in keiner Liste. Seit dem Umbau führt `11-meldungen-ohne-zuordnung.md` sie mit Grund und Handgriff (`pipeline/lib/meldungen-liste.ts`), die Wache zählt je Adresse und schlägt an, wenn eine Adresse ungelistet ist **und** ihre älteste Meldung über 24 h alt ist (zweite Abfrage `GET /pruefung` für `gemeldet_am`; Nachzügler jünger als 24 h sind der Normalfall zwischen Meldung und Bau, eine reine Mengenschwelle wie „60 Adressen“ hätte die 28 liegengebliebenen von 36 nie gefunden; eine in der Antwort fehlende Adresse zählt nicht als alt; Test `tools/briefkasten-wache.test.mjs`). Gegenprobe 11.10.2026: alte Liste Exit 1 (30 von 36 Adressen), neue Liste Exit 0. Abgearbeitet werden die Zeilen, indem die Staffel-Seite als Verweis am Staffel-Titel steht (Handarbeit je Reihe); danach hakt der nächste Lauf sie ab.

## Bühne: Mockups auf der echten App, 11.10.2026

Zweiter Einstieg in dieselbe Vite-App (Konzept: `daniel-zum-abarbeiten/listen/mockup-buehne-konzept.md`, Daniel hat es am 11.10.2026 freigegeben). Schritt 1: Rahmen, Ausschnitt `detailpanel`, drei Fälle, Mockup Reihen-Box A.

- **Bauen und öffnen:** `npm run buehne:bauen` schreibt nach `buehne-dist/` (ignoriert, die Seite `dist/` bleibt unberührt); Öffnen von `buehne-dist/buehne.html` über einen Server oder per Playwright-`route` wie `tools/panel-bild.mjs`. Links tragen den Zustand: `buehne.html#reihen-box?v=A&fall=86&geraet=beide&thema=dunkel&teil=beide`.
- **Fälle:** `npm run buehne:faelle` (`tools/buehne-faelle.mjs`) schneidet Reihen aus `public/data/` nach `web/buehne/faelle.json` — in unseren Kennungen (`ak`, über `pipeline/lib/ausgabe-kennung.ts`), mit festem „heute" (`HEUTE` im Werkzeug) und Bildplatzhaltern. Die Datei ist eingefroren und wird nur auf Aufruf neu geschrieben. `npm run buehne:faelle -- --nur <slug>` rechnet nur diesen Fall neu (neuer Fall: am Ende angehängt); alle anderen Fälle, `heute` und `meta` bleiben byteweise gleich — so bleibt der Diff klein und parallele PRs geraten nicht in Konflikt (Test `tools/buehne-faelle-nur.test.mjs`; `--ziel <datei>` schreibt anderswohin). `fetch` kennt nur diese Datei; alles andere gibt 404 (kein Netz, kein Worker).
- **Zellen:** Jede Zelle des Rasters ist ein eigener `<iframe>` derselben Seite (`#zelle?…`), damit Breite (Media Queries) und Thema (Klasse `dark` am `<html>`, wie `main.tsx`) echt sind.
- **Austausch im Mockup:** Das Detail-Panel bleibt unverändert; `web/buehne/vite-weichen.ts` lenkt nur im Bühnen-Bau einzelne Importe von `DetailPanel.tsx` auf Weichen um (`web/buehne/weichen/`), die ohne Ersatz das echte Bauteil zeigen. Neue Weiche: eine Zeile dort, die Datei dazu, ein Feld in `Ersatz` (`ersatz.tsx`).
- **Beleg „Vorher = echtes Panel":** 375 px, hell und dunkel, drei Fälle gegen die ausgelieferte Seite (`dist/`, ohne Bilder, fester Zeitpunkt): 0 bis 209 von 304.500 Pixeln verschieden, von Lauf zu Lauf wechselnd (Antialiasing eines Etiketts), also sichtbar gleich.
- **Kein Netz, mehrfach gesichert:** `fetch` kennt nur die Fälle; das Großplakat (`cg`) und der Trailer fehlen in den Fällen; die Weiche `weichen/cover-max.tsx` verhindert das `preconnect` auf image.tmdb.org beim Überfahren des Covers; die Content-Security-Policy in `buehne.html` lässt nur die eigene Herkunft zu. Beleg (Playwright, Hover und Klick aufs Cover, Trailer, Sprung): 0 fremde Anfragen.
- **Seiten-CSS:** `web/src/styles.css` nimmt `web/buehne` per `@source not` aus dem Tailwind-Scan; die Bühne holt ihre Klassen über `web/buehne/zelle.css`. Beleg: App-Build mit festem `GITHUB_SHA` am Merge-Base und am Branch ist byte-gleich (`diff -rq dist`).

### Bühne, Schritt 2: Ausschnitte `filter`, `kachel`, `ganz`, acht Fälle (11.10.2026)

- **Ausschnitte** (`web/buehne/ausschnitte/`, Liste in `index.ts`): `detailpanel` zeigt einen Fall; `filter` (echte `FilterBar` mit offenem Fenster und zwei Chips), `kachel` (echte `DatabaseView` über alle Titel, auch ohne Synchro) und `ganz` (die echte `App`) zeigen den **Gesamtbestand** — Kennung `alle`, in `faelle.ts` beim Laden aus allen Fällen zusammengelegt (keine neue Option). Ein Mockup, das den Bestand will, trägt `faelle: [ALLE]`; Proben in `mockups/proben.tsx` (Vorher = Nachher).
- **Fälle** (`tools/buehne-faelle.mjs`, `faelle.json` 2013 KB roh, gzip 426 KB, gemessen 30.10.2026): Tokyo Revengers (neue Staffel), Attack on Titan, One Piece (lang laufend), 86 (fertig), Hajime no Ippo (ohne Synchro), Cyberpunk: Edgerunners 2 (Netflix-Eigenproduktion), Chihiros Reise ins Zauberland (Film, Kino), Golden Kamuy (Finale angekündigt, ohne Datum). Die Reihen dürfen sich nicht überschneiden (der Schneider bricht sonst ab). Neu in jedem Fall: `news.json` und `synonyme.json`, auf die Titel des Falls gekürzt.
- **Hochladen:** `buehne-dist/` nach `daniel-zum-abarbeiten/mockups/buehne/` kopieren (Navigator-Ordner, nicht im Git), `buehne.html` dort zusätzlich als `index.html`, dann `ticket online --wirklich` (`ai_agent_tools.md`, Abschnitt „Mockups online"). Adresse: `https://daniel-mockups.pages.dev/mockups/anime-kalender-de/buehne/`.

### Bühne, Schritt 3: Aufnahme, Messung, breite Desktop-Zelle (11.10.2026)

- **Aufnahme:** `npm run buehne:bilder` (baut die Bühne, dann `tools/buehne-bilder.mjs`) schreibt je Mockup, Fall und Variante die Zellen Vorher/Nachher × Gerät × Thema nach `buehne-bilder/<mockup>/<fall>/<vorher|nachher-<Variante>>-<Gerät>-<Thema>.png` (ignoriert; `--aus <Ordner>`, `--mockup <Namensteil>`). Kein Server: Playwright beantwortet `buehne.test` per `route` aus `buehne-dist/` (`tools/buehne-seite.mjs`, gemeinsam mit der Messung); jede Anfrage nach draußen wird gezählt und macht den Lauf rot. 88 Bilder in gut einer Minute (Stand 11.10.2026).
- **Messung:** `npm run buehne:messen` (`tools/buehne-messen.mjs`, Messfunktionen in `tools/buehne-messung.mjs`): Tippziele ≥ 44 px (nur Handy-Zellen, sichtbare Knöpfe/Links/Felder, Fließtext-Links ausgenommen) und Textkontrast WCAG AA (alle Zellen; eigene Rechnung über `canvas`, weil die Seitenfarben `oklch` sind und die Bühne kein Netz für axe-core hat; Text auf Bildern wird übersprungen). **Maßstab ist Vorher:** rot nur für Befunde, die das Nachher neu bringt; `--liste` zeigt auch die bestehenden. Gemessen wird vom Seitenanfang, neue Befunde werden einmal nachgemessen, damit Animationszustände („heute“-Knopf der ganzen App) nicht zählen. Gegenprobe mit eingefügtem 20-px-Knopf und hellgrauem Text: beide gefunden, ein 48-px-Knopf und großer Text mit 3,5:1 nicht.
- **Breite Zelle:** `web/buehne/geraete.ts` legt je Ausschnitt die Geräte fest: `kachel` und `ganz` zeigen Handy 375 und Desktop breit 1200, `detailpanel` und `filter` Handy 375 und Desktop 512. Ein Link mit unpassendem `geraet` fällt auf das erste zulässige zurück; „beide“ heißt alle zulässigen.
- **Warten:** `networkidle` hing bei mehreren Rahmen einer Seite; die Zelle gilt als bereit, wenn Schriften da sind und 600 ms lang weder DOM noch Scrollstand sich ändern.
- **Befund bei der ersten Messung:** Die Staffelzeile von Reihen-Box A ist 26 px hoch (Ziel 44); `buehne:messen` bleibt für `reihen-box` rot, bis das Mockup nachgezogen ist. Das Panel selbst hat nach V2 (#841) nur noch 1–3 zu kleine Ziele je Fall.

### Bühne, Schritt 4: Navigator und Skill (11.10.2026)

- **Navigator** liegt im Repo `ticket-board` (`navigator/`; `mockups/index.html` hier ist nur die hochgeladene, unversionierte Kopie): Palette (Design-Menü) entfernt, Bühnen-Links mit Zustand (`buehne/buehne.html#reihen-box?v=A&fall=86&geraet=375&thema=dunkel`) und Knopf „Bühne“ — ticket-board PR 15. Ein Bühnen-Mockup steht wie jedes andere als Epic im Board; Alte Mockups bleiben im Verlauf (`archiv/`).
- **Übersicht der Bühne** (`buehne.html#`) führt je Mockup Links je Variante und je Fall (Gerät und Thema „beide“); `tools/buehne-seite.mjs` liest die Mockup-Namen aus `data-mockup`, nicht mehr aus der Adresse.
- **Skill `mockups`** (`tools/claude-global/skills/mockups/SKILL.md`, wird mit `node tools/claude-global/einrichten.mjs` nach `~/.claude` übernommen): Ablauf Ausschnitt → Fälle → Ersatz → Bilder → Messung → Hochladen → Board-Eintrag, dazu die Auftragsvorlage für Fable-Entwürfe.
- **Offen:** `check:panel` (`tools/panel-bild.mjs`, 244 Zeilen) und `check:ansichten` (`tools/ansicht-bild.mjs`, 299 Zeilen) laufen noch gegen `dist/` mit beliebigen Titeln, nicht über die Bühne. Umstellen hieße: Zellen der Bühne statt eigener Seite, Titel nur aus den acht Fällen — Schätzung 0,5 bis 1 Tag, Nutzen gering, solange die Prüfung beliebige Titel braucht.

### Bühne, Schritt 5: Uhrzeit wählbar, Mockup „Relative Uhrzeit“ (13.10.2026)

- **Uhrzeit:** `MockupDef.zeiten` (Beschriftung → ISO mit Berliner Versatz, z. B. `'16:40': '2026-10-16T16:40:00+02:00'`) schaltet in der Leiste die Gruppe „Zeit“ frei: ein Knopf je Zeit und ein Schieber über den Tag der ersten Zeit (5 Minuten Schritt). Der Wert steht im Link (`zeit=`, `+` als `%2B`; ein zum Leerzeichen gewordenes `+` wird wieder gelesen), `start.ts` friert die Uhr der Zellen darauf ein (ohne `zeit` gilt `faelle.heute`). Eine Zeit, die nicht am Tag der ersten liegt oder nicht lesbar ist, fällt auf die erste zurück (`zeit-regler.tsx` `gueltigeZeit`). Der Schieber übernimmt erst beim Loslassen (`change`), weil jeder Wechsel alle Zellen neu lädt; `tools/buehne-zeit-pruefen.mjs` prüft das (Ziehen ändert den Link nicht, spätestens 1 s nach dem Loslassen steht die Zeit drin, rot, sobald auf `input` übernommen wird) sowie Einfrieren und Rückfall. Läuft nach `npm run buehne:bauen`, nicht in `check:vor-commit`.
- **Bilder und Messung** laufen je Fall × Zeit × Variante; Dateiname `…-<HHMM>.png`, Messschlüssel `<mockup>/<fall>@<HH:MM>`.
- **Weichen** neu: `WeekView.tsx` → `kalender/TvKasten.tsx` (`weichen/tv-kasten.tsx`) und `kalender/PosterKarte.tsx` → `Marken.tsx` (`weichen/marken.tsx`: reicht alles durch, tauscht nur `ZeitMarke`); Felder `TvKasten` und `ZeitMarke` in `Ersatz`. Der Ausschnitt `ganz` reicht den Ersatz jetzt an die App weiter (vorher ignoriert).
- **Fälle** (`FERNSEHTAG` in `tools/buehne-faelle.mjs`): je ein Fall für die Reihen, die am Freitag, 16.10.2026 im Fernsehen und Streaming stehen (Yashahime, Dragon Ball, Detektiv Conan, Slime S4, JoJo Steel Ball Run, Avatar: Die sieben Häfen). Ein Termin ohne Katalogtitel (negative Kennung, Avatar bei Paramount+) ist seine eigene Reihe. `faelle.json` wuchs damit von 608 auf 1721 KB (Sprecher, Handlung und Folgenlisten der langen Reihen). Der Bestand `alle` zeigt damit die Woche 12.–18.10. mit 6 Fernseh-Terminen (Programm mit `sendungen`) und Streaming mit fester (Slime 17:00), geschätzter (JoJo ≈ 10:00, Tokyo Revengers ≈ 19:00) und fehlender Uhrzeit (Avatar). Das Programm reicht etwa fünf Tage voraus: Wer den Tag später neu schneidet, braucht einen näheren.
- **Mockup `relative-uhrzeit`** (`web/buehne/mockups/relative-uhrzeit*.ts[x]`): Ausschnitt `ganz` mit `faelle: [ALLE]` (die `fernsehtag-*`-Fälle stecken im Bestand), sechs Zeiten, vier Varianten (A Jetzt-Linie, B Kopfzeile, C Jetzt-Linie grün, D wie C in Orange des gewählten Reiters „Kalender“: „● Läuft“ unter der Uhrzeit statt dritter Spalte, Linie auch vor der ersten und nach der letzten Sendung; bei geschätzter oder fehlender erster Uhrzeit weder Linie noch „in … Min“, `restInZeile`, 13.10.2026). **D ist seit 13.10.2026 gewählt und in der Seite** (`TvKasten.tsx`, `TvJetzt.tsx`, `ZeitMarke` mit `angabe`; Variante D der Bühne zeigt ohne Ersatz die Seite selbst): Die Linie „jetzt HH:MM“ steht nur, solange nichts läuft (vor der ersten, zwischen zwei, nach der letzten Sendung); „● Läuft“ steht an jeder laufenden Zeile, auch bei zwei Sendern zugleich. „jetzt“ zieht die Woche einmal je Minute nach (`useSprungZuHeute`), ein Test hält das Intervall bei höchstens 60 s. Zustandsrechnung der Seite rein in `shared/laeuft-jetzt.ts` (Test `tools/laeuft-jetzt.test.mjs`), die Zusätze von A bis C in `relative-uhrzeit-zeit.ts`, Test `tools/buehne-relative-uhrzeit.test.mjs` (läuft in `check:workflows` über `tests-alle`; Node lädt die `.ts`-Datei, deshalb ohne Aliase und ohne React). Spezifikation: `daniel-zum-abarbeiten/berichte/relative-uhrzeit-spezifikation.md`.
- **Zwei Funde beim Bauen:** (1) Die Bühne baute auf `main` nicht mehr, seit #1074 `beiBannerKlick` in `cover-max.tsx` ergänzte und die Weiche `weichen/cover-max.tsx` nur Einzelnamen durchreichte; sie reicht jetzt alles durch (`export *`). (2) `@source "./mockups"` in `zelle.css` lieferte keine einzige Klasse (der Ordner bleibt von `@source not "../buehne"` erfasst, Tailwind 4.3.3); mit dem Dateimuster `./mockups/**/*.tsx` kommen die Klassen der Mockups an. Vorher fielen Mockups nur nicht auf, weil ihre Klassen zufällig anderswo vorkamen.
- **Zustand je Zelle (26.10.2026):** Alle Zellen teilten den `localStorage` der Herkunft: ein umgelegter Schnellfilter („nur bestätigte Termine“, Schlüssel `vorlieben`, dazu `tvAus`, Gesehen, Favoriten, `sessionStorage`) stand in jeder anderen Variante und nach dem Neuladen wieder da. `start-ablauf.ts` (von `start.ts` mit der echten Umgebung aufgerufen) legt im Zellen-Modus vor dem Laden der App flüchtigen Speicher über beide (`speicher-je-zelle.ts`); Rahmen und Leiste behalten den echten. Wächter: `tools/buehne-start.test.ts` (der Start läuft mit Attrappen, der Speicher liegt vor dem Laden der App, je Zelle getrennt, Rahmen unberührt) und `tools/buehne-speicher.test.ts` (Weiche), beide in `check:logic`, und `tools/buehne-zustand-pruefen.mjs` (Browser, in `npm run buehne:messen`: Filter in A umlegen, B und Neuladen von A beginnen frisch).
- **Mockup `suchhinweis-ohne-synchro`, Runde 2 (26.10.2026):** Der Hinweis steht in der Zählzeile („0 Ergebnisse für …“, getrennt durch „·“ wie die Zählzeile selbst; nur Variante A, Daniels Entscheidung E29 vom 26.10.2026; am Handy darunter ohne Trenner, weil die Zählzeile dort in der unteren Leiste liegt; der alte Knopf „Auch Anime ohne deutsche Synchro zeigen“ entfällt, solange der Hinweis steht): „N Treffer ohne Synchro, davon M exakt“ und, wenn gesetzte Filter den exakten Treffer verstecken, „„Name“ ist ausgeblendet durch: …“ mit Knopf „Filter entfernen“. Rechenteil `web/src/lib/suchhinweis-filter.ts` (seit dem Bau aus dem Mockup herausgelöst) (reine Funktion, Test `tools/suchhinweis-filter.test.ts` in `check:logic`): ein Filter gilt als Blockierer, wenn der Titel schon bei ihm allein durchfällt; der Knopf entfernt genau diese (und schaltet bei Bedarf „Anime ohne deutsche Synchro“ ein). Browser-Probe `tools/suchhinweis-quickfix-pruefen.mjs` (in `npm run buehne:messen`). **Panel auf der Bühne (26.10.2026, Daniel: „Detail panel öffnet nicht im mockup“):** Ausschnitt `kachel` übergab dem Raster ein leeres `onOpenTitle` (jetzt echtes `DetailPanel`, Escape und Kreuz schließen), und der Hinweis lud mit `useDatensatz()` einen zweiten Datensatz — `loadOhneSynchro` füllt nur den Index seines ersten Aufrufers, das Panel der App zeigte für Titel ohne Synchro „keine Metadaten“; der Hinweis liest jetzt den Datensatz der App (`merkeDaten` im Raster). Wächter `tools/buehne-panel-pruefen.mjs` (in `buehne:messen`, kein CI-Tor): je Mockup mit Kacheln Klick, Panel mit Daten, Escape. Neue Weiche `weichen/db-kopfzeile.tsx` (Zählzeile), Fälle `hajime-no-ippo-jahr` und `tokyo-revengers-jahr` (`OPTIONS_FAELLE`, Adresse je Fall über `suchadressen`). Für die echte Umsetzung: Filter und Synchro-Schalter schreiben je die ganze Adresse aus dem Stand ihres Aufrufs (`useDbSchalter` → `ersetze`); zwei Aufrufe hintereinander überschreiben sich, der Quickfix braucht einen gemeinsamen Adresswechsel. „Nur bestätigte Termine“ wirkt in der Datenbank nicht auf Titel (`passtTitel`), versteckt also nie einen Treffer.
- **Mockup `disc-bereich-2` (Runde 2 des Disc-Bereichs, 27.10.2026):** Daniel wählte aus T-138 die Matrix (B) und verlangte erst Varianten, dann Händler (`mockups/disc-bereich-2*.ts*`; Datenmodell `disc-bereich-2-daten.ts`: Art, Nummer, Kurzname ohne Reihentitel, Edition in zwei Wörtern, doppelte Ausgaben zusammengelegt, aniSearch nie Händler). B1 Dropdown, B2 Chips, B3 Gruppen. Neue Weiche `weichen/kasten-marke.tsx` (`Ersatz.AntwortKasten`): setzt die Folgenliste als eigene Karte unter den roten Kasten. Amazon-Links der Fälle sind Suchadressen ohne ASIN, das Mockup zeigt den Platzhalter `/dp/ASIN-FEHLT`.
- **Suchhinweis gebaut (27.10.2026, Daniels Auflage: „nach klick auf anzeigen weiterhin nur 1 treffer“):** Der Hinweis steht in der echten Datenbank (`SuchHinweis.tsx`, Hook `lib/use-suchhinweis.ts`, Zählung `lib/suchhinweis-zaehlen.ts`) und zählt in der Einheit der Liste: mit „Staffeln zusammenfassen“ nur Gruppen, die noch keine Karte haben (Attack on Titan: vorher 8, nachher kein Hinweis, die Karte bleibt bei einer; Hajime no Ippo: 6 Titel, eine neue Karte), ohne Zusammenfassung Einzeltitel. Bringt der Klick keine neue Karte, steht gar nichts (kürzester Text). Filter und Schalter gehen in einem Adresswechsel (`loeseHinweis` in `DatenbankBereich.tsx`). Geladen wird nicht die ganze Datei der Titel ohne Synchro (7,3 MB, gzip 1,7 MB), sondern der Namensindex `ohne-synchro-namen.json` (Bau: `pipeline/bau/ohne-synchro-namen.ts`, 2,7 MB roh, gzip 545 kB, gemessen 27.10.2026): romanisierter, englischer und deutscher Name, Reihe, Jahr, Genres, Format, Land, FSK; der native Name fehlt (Suchen nur über japanische Schrift zählen daher anders, bei romanisierten und englischen Namen waren in 183 Stichproben alle Zahlen gleich). Er wird erst nach 600 ms Pause bei mindestens zwei Zeichen Suche und nur bei höchstens 14 Karten in der Liste geladen (`MAX_ERGEBNISSE`; Attack on Titan ohne Zusammenfassung zeigt 14). Die Bühne bekommt ihn je Fall aus `faelle.json` (`tools/buehne-faelle.mjs`). Offen: der Sprecher-Filter fließt nicht in die Zählung ein. Prüfung: `pipeline/check-suchhinweis-lauf.ts`, `tools/suchhinweis-karten.test.ts` (beide in `check:logic`), Browser `tools/suchhinweis-quickfix-pruefen.mjs`.
### Bühne, Schritt 6: neue Ansicht ohne Gegenstück, Nutzer-Fälle (20.10.2026)

- **Ausschnitt `entwurf`** (`ausschnitte/entwurf.tsx`): Der Ausschnitt bekommt jetzt `mockup` und `variante` (leer = Vorher); jede Variante trägt eigenen Entwurf (`Variante.entwurf`, eine React-Komponente mit dem Fall), Vorher zeigt `MockupDef.vorher` (heutige Seite an dieser Stelle) oder „Neu – diese Ansicht gibt es heute nicht“. Die Wahl steht in `entwurf-wahl.ts`. Vorbild und Prüfstein: `mockups/empfehlung-reise.tsx` (Empfehlungsseite T-133, Einleitung und Fünf Vorschläge; der Rest der Reise R4 ist nicht nachgebaut).
- **Fallart Nutzerzustand** (`nutzer-faelle.ts`): `nutzer-neu` und `nutzer-aktiv` (3 gemerkt, 5 gesehen) tragen den Gesamtbestand plus `fall.nutzer` (`merkliste`, `verlauf`, die ersten Titel des Bestands); ein Mockup nennt sie in `faelle`. `faelle.ts` legt sie über `faelle-bau.ts` (`baueFaelle`/`ladeFaelleAus`) an. Tests: `tools/buehne-entwurf.test.mjs` (Auswahl) und `tools/buehne-entwurf-render.test.ts` (in `check-logic-liste.txt`, braucht tsx) (Render-Testrahmen: `renderToString` für Zelle `zelle-inhalt.tsx`, Ausschnitt `entwurf` und Vorschläge; die Ausschnitte kommen der Zelle von außen, damit der Test nicht die ganze App lädt). Nicht im Test, nur per Bildlauf belegt (`npm run buehne:bilder -- --mockup empfehlung-reise`, 24.10.2026: 24 Bilder, Exit 0; `index.ts` lädt `import.meta.env` und läuft nicht unter tsx): Verdrahtung `zelle.tsx` → `AUSSCHNITTE`, Adressbildung in `ladeFaelle`, Hook-Hülle `Vorschlaege`.

### Bühne, Schritt 7: Fall-Optionen (24.10.2026)

- **Fall-Optionen** (`web/buehne/fall-optionen.ts`): ein abgeleiteter Fall (`OPTIONS_FAELLE`, Kennung → Ausgangsfall, Name, Optionen) ist eine Kopie des Ausgangsfalls mit überschriebenen Feldern. `tonspur: 'ohne-beleg'` löscht `dub`, `dubRanges`, `dubQuelle`, `dubStand`, `dubHintOnly`, `dubAbgeleitet` an allen `streams` und `watchLinks` in `titles.json` und `titles-core.json` (die Felder, aus denen `streamStatus`/`streamWegStatus` die Tonspur lesen); `86-ohne-beleg` ist damit das Zustandsbild „Kopf ohne Marke“. Neues Zustandsbild: eine Zeile in `OPTIONS_FAELLE`, ein Mockup nennt die Kennung in `faelle` (Beispiel `probe-tonspur` in `mockups/proben.tsx`). Liest das Panel ein weiteres Tonspur-Feld, gehört es in `TONSPUR_FELDER`. Test: `tools/buehne-fall-optionen.test.ts` (in `check-logic-liste.txt`; Feld für Feld, Ausgangsfall unverändert, echter Fall 86 kippt auf `alleOhneSprachbeleg`).

## Worker: abgelehnte Meldungen stehen im Protokoll (11.10.2026)

`worker/wrangler.toml` schaltet Workers Logs ein (`[observability]`; Free 200.000 Ereignisse am Tag und 3 Tage Aufbewahrung, Paid 20 Mio. im Monat inklusive und 7 Tage; Stand 11.10.2026). Die Aufruf-Logs sind aus (`invocation_logs = false`): sie enthielten die volle Adresse samt Query (Token, Push-Endpunkt). Alle `console.*` im Worker laufen durch `fehlerLog()`/`kurzeMeldung()` in `worker/src/werte.ts` (Adressen, Mailadressen und lange Kennungen ersetzt, 120 Zeichen); die Datenschutzerklärung nennt das Fehlerprotokoll. Jede abgelehnte Meldung schreibt eine JSON-Zeile `meldung_abgelehnt` mit Route, Status, Grund, Plattform und Kennung (letzter Pfadabschnitt der Adresse, z. B. Netflix-Titelnummer) — nie Token, Adresse, Titel oder Notiz (`worker/src/pruefung-ablehnung.ts`). Im Stapel-Ergebnis trägt jeder abgelehnte Eintrag `grund`.

Live nachsehen: `cd worker && npx wrangler tail newsletter --format json --search meldung_abgelehnt`, danach in der Erweiterung die Meldung wiederholen. Ausnahmen, die der Worker nicht selbst fängt (`scriptThrewException`), zeigt `wrangler tail` als Ausnahme-Ereignis; ob die gespeicherten Workers Logs sie bei ausgeschalteten Aufruf-Logs führen, ist nach dem Deploy zu prüfen (nicht belegt).

Vergangene Logs (bis 3 Tage zurück) liest man per API: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/observability/telemetry/query` mit dem Token „anime-kalender-deploy“, das seit 17.10.2026 00:03 das Recht „Workers Observability Read“ trägt (Wert in `my_secrets.md`, nie in Repo oder Log). So kam am 16.10.2026 die Ursache der 500 bei der Prime-Meldung ans Licht (Abschnitt „D1-Export weist Meldungen ab“).

## Kapazitätsmessung: Anfragen, CPU, D1-Schreiben, Mails (23.10.2026)

**Wo:** `tools/kapazitaet-messen.mjs` (Schwellen und Bewertung: `tools/kapazitaet-bewertung.mjs`, Test `tools/kapazitaet.test.mjs`) läuft als Schritt „Kapazität messen“ in `d1-verbrauch.yml` (täglich 07:50 UTC, gleicher Token). Es liest per GraphQL-Analytics die letzten 7 UTC-Tage: Worker-Anfragen (Konto und je Skript), Fehler, `exceededCpu`, CPU p50/p99 (alle Aufrufe und Cron getrennt), D1 gelesen/geschrieben. Rot (Statusanzeige wie bei d1-verbrauch) bei einem Tag über 70.000 Anfragen, über 70.000 geschriebenen D1-Zeilen oder Cron-CPU p99 über 8 ms (nur wenn der Cron-Datensatz Ereignisse liefert, am 23.10.2026 leer); `exceededCpu` > 0 ist eine Warnzeile. Der schlimmste Tag des Fensters zählt. Die frühere Grundlast „58.000 Aufrufe/Tag“ (11.10.2026) gilt nicht mehr; maßgeblich ist die Tageszeile im Protokoll.

**Gemessen am echten Konto (CI-Lauf auf dem Zweig, 23.10.2026):** Der Analytics-Token reicht für Worker und D1. `workersInvocationsAdaptive` und `d1AnalyticsAdaptiveGroups` liefern; CPU-Quantile sind Mikrosekunden (Anzeige in ms). Letzte 7 Tage: nur 1.205–5.504 Anfragen am Tag (Skript `newsletter`), nicht 58.000; D1 geschrieben 3.655–18.989 Zeilen am Tag; CPU p99 aller Aufrufe 36–74 ms. HTTP und Cron lassen sich im Adaptive-Datensatz nicht trennen (keine Dimension `eventType`); `workersInvocationsScheduled` ist flach (`scriptName cron status datetime cpuTimeUs`) und war leer, der Cron-Wert steht dann auf `n/a`. Ein nicht lesbarer Datensatz macht den Lauf rot, er zählt nie als 0. Probelauf: `gh workflow run d1-verbrauch.yml --repo danielzaiser91/anime-kalender-de` (Kopf des Zweigs: `--ref <zweig>`).

**Mails je Tag:** `worker/src/mail-zaehler.ts` addiert die vom Anbieter angenommenen Mails (Digest-Stapel: Zahl der angenommenen; Einzelmails: 1; Anbieter `console` und abgewiesener Versand: 0) in `schreib_tag.mails` (Migration 059, vor dem Worker-Deploy einspielen). `GET /health` liefert `heute: { tag, geschrieben, gelesen, mails }` (`null`, wenn der Zähler nicht lesbar ist). Eine Mail-Schwelle in der Messung folgt, sobald das Tageslimit des Anbieters belegt ist.

## D1-Schreibkontingent: Tagesdeckel, weniger Indexzeilen, Hash statt Wiederholung (11.10.2026)

**Anlass:** Das Gratis-Kontingent von D1 (100.000 geschriebene Zeilen am UTC-Tag, je Konto, Newsletter-Worker und Ticket-Board teilen es) war am 11.10.2026 zwischen 18:00 und 18:39 MESZ durch einen „alle durchgehen"-Lauf (Disney+ 7.104 Folgen, dazu Netflix und Prime) auf rund 150.000 geschriebene Zeilen gestiegen; alle Schreibpfade waren bis 02:00 MESZ gesperrt. Jede Indexzeile zählt als geschriebene Zeile.

**Was jetzt gilt (lokal mit `getPlatformProxy` gemessen, `meta.rows_written`):**
- Je Disney+-Folge (`pruefung` + `prime_folge`): 15 Zeilen vorher, 10 nach Migration 047 (fünf Indexe ohne Leser entfernt: `prime_folge_url`, `idx_prime_folge_titel`, `prime_folge_plattform`, `pruefung_gemeldet_url`; `pruefung_such_url` nur noch für Zeilen mit Suchadresse). Eine Prime-Meldung mit 90 Rohfolgen: 727 → 455.
- Eine unveränderte Meldung schreibt nichts (Migration 048, Spalte `pruefung.hash`, `pruefung-unveraendert.ts`): Wiederholung 17 → 0 Zeilen je Disney+-Folge, 818 → 0 je 90-Folgen-Prime-Meldung.
- Tagesdeckel (Migration 049, `tagesdeckel.ts`): Die Meldungs-Route zählt `meta.rows_written` in `schreib_tag` und antwortet ab 50.000 Zeilen am UTC-Tag mit 429, `Retry-After` und `{ tageslimit: true }`. Newsletter-Anmeldung, Push, Cron, Läufe, Wächter und Aufträge der Pipeline (abhaken, wieder öffnen) zählen nie mit und bleiben frei; `lauf_status` (~11.000), `site_probe` (~1.500) und `site_history` (~1.000) am Tag liegen weit unter der Reserve von 50.000. Der Zähler kostet eine Zeile je Anfrage (Einzelmeldung 11 statt 10 Zeilen, Stapel von 10: 0,1 je Meldung). Fehler beim Zählen sperren nichts.
- Erweiterung 4.28.0 (`tageslimit.js`): erkennt die 429 des Workers an einer Stelle (umhülltes `fetch`), Disney+, Netflix und Prime halten an; Hinweis „Tageslimit erreicht, weiter ab 02:00".

**Reihenfolge nach dem Merge:** erst Migrationen 047, 048, 049 remote (`npx wrangler d1 execute anime-kalender --remote --file=migrations/04x-….sql`, nach 00:00 UTC, damit das Löschen von Indexen nicht ins Tageskontingent fällt), dann Worker-Deploy. Der Worker vor der Migration 048 scheitert am INSERT (Spalte `hash` fehlt).

**Nicht umgesetzt (Leser verhindern es):** Eine Zeile je Titel und Anbieter mit JSON und Hash statt einer Zeile je Folge. Je Folge lesen heute `pipeline/fetch-pruefungen.ts` (Einleser, hakt über Zeilennummern ab), `fetch-urteile.ts` (`?alle=1`), `fetch-folgen-zuordnung.ts` und `fetch-rohfolgen.ts` (`prime_folge`, `rohfolgenUebernommen`), `lib/meldungen.ts`, die Worker-Leser `pruefung-lesen`, `-stand`, `-zaehlen`, `-loeschen`, `-rohfolgen`, die Erweiterung (`?gemeldet=`, Bereiche je Folge) und Werkzeuge (`briefkasten-wache`, `pruefung-zurueckstellen`, `daten-befund`). Abhaken, Löschen und „jüngste gewinnt" arbeiten je Folge. Die Umstellung ist ein eigener Umbau der Pipeline.

**Migration und Deploy direkt nacheinander (Prüferbefund PR 839):** Nach Migration 047 bricht der **alte** Worker bei `?zaehlen=1`, weil seine Adressabfrage `INDEXED BY pruefung_gemeldet_url` erzwingt und dieser Index dann fehlt. Zwischen `047` und dem Worker-Deploy soll deshalb nichts liegen. Eine unveränderte Meldung erneuert `gemeldet_am` einmal je Listenbau (eine Zeile), wenn die Zeile vor `pruefstand.json` → `erzeugtAm` liegt — sonst blieben Wiedervorlage-Ziele für die Erweiterung ewig offen.

## D1-Lesekontingent: fünf Hebel im Worker (11.10.2026)

**Anlass:** Das Lesekontingent (5 Mio. Zeilen je UTC-Tag) war am 11.10.2026 gegen 18:00 UTC durch denselben Massenlauf erschöpft (Bericht `daniel-zum-abarbeiten/berichte/d1-leselimit-2026-10-11.md`). Die Zahlen unten sind aus den Aufrufen des Tages gerechnet, nicht nachgemessen.

- **Hash-Abfrage** (`pruefung-unveraendert.ts`): `INDEXED BY pruefung_url_zeit`. Ohne nahm der Planer ab zwei Adressen `idx_pruefung_offen` und las alle offenen Zeilen je Aufruf (EXPLAIN QUERY PLAN lokal; Test in `tools/worker-tagesdeckel.test.ts` prüft den Plan bei drei Adressen). **Überholt am 12.10.2026:** Die Abfrage sucht seit Migration 053 je Folge über `pruefung_folge` (Abschnitt "Eine Meldung liest nur ihre Folge").
- **`?stand=1`**: Cache 300 statt 60 s (gerechnet bis 0,8 Mio. am Massenlauftag). Frisch Gemeldetes überbrückt die Erweiterung, bis der Stand es zeigt.
- **DELETE vor INSERT** (`pruefung-ersetzen.ts`): über die IDs aus `ladeOffeneHashes` statt über `url` (gerechnet 0,29 Mio.); ohne offene Zeile entfällt der DELETE. Zwei gleiche Folgen im selben Stapel ergäben eine Dublette; die nächste Meldung räumt sie auf.
- **Rohfolgen-Gesamtzahl**: bei `nach = 0` und Seite unter 5000 Zeilen aus der Seite, sonst `COUNT(*)` (gerechnet 0,26 Mio.). **Überholt am 12.10.2026:** `gesamt` und `COUNT(*)` entfallen (Abschnitt „Rohfolgen-Seiten und Serienamen“).
- **GET `/lauf`**: Übersicht 30 s im Edge-Cache (`cache-kurz.ts`, gerechnet 0,1 Mio. je Tag); der Verlauf einer Lauf-Art bleibt ungehalten. Ein Laufstatus zeigt sich damit bis zu 30 s später.

## D1-Lesekontingent: zwei Abfragen mit 3,2 Mio. Zeilen am Tag (12.10.2026)

**Anlass:** Lauf `d1-verbrauch` 38220628042 (12.10., 24 h): 4,87 Mio. von 5 Mio. gelesenen Zeilen. Gemessen mit `wrangler d1 insights` (kostet kein Kontingent): `SELECT plattform, url, staffel FROM pruefung WHERE uebernommen = 0` 543 Aufrufe × Ø 2.979 = 1,62 Mio.; `SELECT folge_nr, … WHERE url = ?` (`?gemeldet=<Adresse>`) 35.091 Aufrufe × Ø 45 = 1,60 Mio. Beide nutzten einen Index — Häufigkeit × Menge war das Problem.

**Wer fragt, in welchem Takt (aus dem Code):**
- Wartende Meldungen (`holeWartende`) stecken nur in `?stand=1`. Den ruft jeder offene Tab der Erweiterung alle 5 Minuten (`melder.js` `setInterval(standHolen, 5 * 60 * 1000)`), dazu `amazon.js` und `pruefstand-zeit.js`. Der Stand hielt 300 s im Cache: ein Fünf-Minuten-Takt trifft ihn kaum (Alter beim nächsten Abruf ≈ 300 s). 543 Aufrufe ≈ 2 Tabs × 288 Abfragen am Tag.
- `?gemeldet=<Adresse>`: `disney.js` (`gemeldeteHolen` je Seitenaufruf, dazu `frischGemeldet` je offener Adresse), `melder.js` (`meldungenLaden` je offener Netflix-Reihe beim Öffnen des Dialogs, `durchlaufStandLaden` je Durchlauf), `netflix-uebernahme.js`. Alle mit `cache: 'no-store'`, der Worker hielt nichts. Beim Netflix-Durchlauf lädt jeder Titel die Seite neu und fragt wieder alle offenen Reihen (24.400 Abrufe bei 100 Titeln, siehe `netflix-uebernahme.js`).

**Was jetzt gilt:**
- **Wartende Meldungen: 1800 s im Cache der Edge, unter eigener Adresse** (`?wartend=1`, `pruefung-stand-briefkasten.ts`), getrennt vom Stand, der bei 300 s bleibt (`pruefstand.json` entsteht stündlich). Höchstens 48 Abfragen je Rechenzentrum und Tag statt 543. Nicht verworfen, nur abgelaufen (Lehre vom 28.09.2026). Folge: `unterwegs` und die „wartenden Staffeln" zeigen eine Übernahme bis zu 30 min später; Meldungen seit dem Listenbau zieht `pruefung-stand.ts` weiter frisch aus der Datenbank ab.
- **`?gemeldet=<Adresse>`: 1800 s je Adresse** (`pruefung-gemeldet-cache.ts`, Schlüssel aus der Adresse, gleich für jede Kodierung). **Verworfen wird genau die Adresse, zu der geschrieben wird:** Meldung, Stapel, Löschen (Adresse, Adresse+Nummern, Zeilen-ID). Eine Sammelantwort wird nie verworfen — ein Melde-Durchgang rechnet je Meldung höchstens eine Adresse neu (45 Zeilen). `caches.default` gilt je Rechenzentrum; Meldung und Abfrage kommen aus demselben Browser. Wer von woanders fragt, sieht bis zu 30 min den alten Stand. **Verwerfen wirkt nur im eigenen Rechenzentrum:** ein Löschen per Token aus Actions oder `tools/pruefung-zurueckstellen.mjs` kann in einem anderen landen als das, aus dem die Erweiterung fragt, und der Eintrag dort läuft erst nach bis zu 30 min ab. Gemessen 12.10.2026 10:30: `caches.default` greift auf `workers.dev` (`CF-Cache-Status: HIT`, `Age: 105`). Scheitert das Verwerfen, wird es protokolliert und die Meldung trotzdem beantwortet (`verwirfGemeldet` wirft nie). Die Kommentare „nicht zwischengespeichert" in `netflix-uebernahme.js` und `disney-netz.js` meinen den Browser-Cache (`no-store`), nicht mehr den Worker.
- Schreibzeilen: keine mehr (Cache-Operationen kosten kein D1-Kontingent).

**Rechnung (vorher → nachher):** Wartende: 543 × 2.979 = 1,62 Mio. → höchstens 48 × 2.979 = 0,14 Mio. je Rechenzentrum (−91 %; bei zwei Rechenzentren 0,29 Mio. = −82 %). `?gemeldet=`: 1,60 Mio. → Aufrufe, die nach 30 min ablaufen oder nach einer Meldung zu ihrer Adresse neu lesen; Obergrenze nicht berechenbar (hängt an der Zahl verschiedener Adressen je Fenster), Ziel unter 0,32 Mio. (−80 %). **Nachmessen am Tag nach dem Deploy:** `wrangler d1 insights DB --config wrangler.toml --time-period 1d --sort-type sum --sort-by reads --limit 5 --json`.

**Nicht gemacht:** Zusammenfassungstabelle der wartenden Meldungen (jede Meldung kostete eine Schreibzeile mehr, Schreiben war am 11.10. bei 165 %); Cache in R2 (global statt je Rechenzentrum, aber Schreibaufruf je Änderung). Offen für die Erweiterung (Release nötig): `meldungenLaden` je offener Reihe beim Dialog-Öffnen bündeln — der Worker-Cache fängt es ab, aber der Browser schickt weiter 100+ Anfragen.

## D1-Lesekontingent: Rohfolgen-Seiten und Serienamen (12.10.2026, Abend)

**Anlass:** Das Leselimit (5 Mio. Zeilen je UTC-Tag) riss am 12.10.2026 erneut. `wrangler d1 insights DB --config wrangler.toml --time-period 1d --sort-type sum --sort-by reads` (12.10., 12:20 UTC, kostet kein Kontingent) nannte fünf Posten. `?gemeldet=` behandelt ein anderer PR.

| Posten (Aufrufe × Zeilen = Tag) | Aufrufer, Takt | Hebel | Erwartung je Tag |
|---|---|---|---|
| `SELECT plattform, url, staffel FROM pruefung WHERE uebernommen = 0`, 435 × 3.920 = 1,71 Mio. | `holeWartende` in `?stand=1`; zwei offene Tabs der Erweiterung × alle 5 min | **schon behoben** durch #912 (30 min Edge-Cache, Worker-Deploy 08:46 UTC); das 24-h-Fenster enthält noch 20 h davor (543 Aufrufe/Tag vorher = 22,6/h, davor-Anteil ≈ 461) | ≤ 48 × 3.920 = 0,19 Mio. je Rechenzentrum, −1,5 Mio. |
| `prime_folge`-Seite mit korrelierter Unterabfrage, 56 × 26.101 = 1,46 Mio. | `fetch-rohfolgen.ts` im Bestandsbau (`?rohfolgen=1&nach=`), ~19 Läufe × 3 Seiten | Serienname einmal je Adresse (`pruefung-serientitel.ts`, `json_each`) **und** Migration 051 (Teilindex `prime_folge_offen (id) WHERE uebernommen = 0`) | 0,29 Mio., **−1,17 Mio.** |
| `SELECT COUNT(*) FROM prime_folge WHERE uebernommen = 0 …`, 106 × 13.081 = 1,39 Mio. | dieselben Seiten (jede volle oder Folgeseite zählte neu) | `gesamt` und `COUNT(*)` entfallen; der Bau setzt über `weiter` fort (`fetch-rohfolgen.ts` las `gesamt` nur für Log und Seitengrenze) | 0, **−1,39 Mio.** |
| `SELECT url, MAX(titel) … GROUP BY url`, 22 × 17.533 = 0,39 Mio. | `fetch-folgen-zuordnung.ts` (`namen=1`), ein Abruf je Bestandsbau; jede Meldung verwarf den Auszug | R2-Frist für `namen` 6 h statt 10 min (`FRIST_NAMEN_MS`) | ≤ 4 × 17.533 = 0,07 Mio., **−0,32 Mio.** |
| `SELECT plattform, url, folge_nr, staffel FROM pruefung WHERE uebernommen = 0`, 17 × 3.451 = 0,06 Mio. | `?zaehlen=1&nummern=1` (`disney.js`), schon 30 min im Edge-Cache | **nichts gebaut**: eine Zusammenlegung mit den wartenden Meldungen spart höchstens 0,06 Mio. und fasst `pruefung-zaehlen.ts` an | 0,06 Mio. bleibt |

**Summe dieses PR: rund −2,9 Mio. gelesene Zeilen am Tag** (4,87 Mio. am 12.10.), dazu −1,5 Mio. aus dem schon deployten #912.

**Warum die Seite so viel las (EXPLAIN QUERY PLAN):** Mit `prime_folge_offen (uebernommen, gemeldet_am)` lautete der Plan `SEARCH f USING INDEX prime_folge_offen (uebernommen=?)` plus `USE TEMP B-TREE FOR ORDER BY`: SQLite holte bei **jeder** Seite alle ~13.000 offenen Zeilen und sortierte sie nach `id`. Der Teilindex auf `id` liefert die offenen Zeilen schon geordnet (`SEARCH f USING INDEX prime_folge_offen (id>?)`), die Seite liest nur ihre 5.000. Die Unterabfrage je Rohfolge (`pruefung_url_zeit`, bis zu 5.000 Nachschläge je Seite) wird zu einer Abfrage über die Adressen der Seite (`WITH u(url) AS (SELECT value FROM json_each(?1))`, eine Prime-Seite trägt ~90 Folgen unter einer Adresse). Das Ergebnis ist Zeile für Zeile gleich (Vergleich lokal: alle 13.750 Folgen samt `serientitel` deckungsgleich, nur `gesamt` fehlt).

**Gemessen (lokal, workerd/miniflare, `tools/worker-lesezeilen-messen.ts`, `meta.rows_read`; Bestand wie am 12.10.: `pruefung` 17.800 Zeilen, `prime_folge` 55.000 mit 13.750 offenen auf 700 Adressen; ein Bau-Durchgang = 3 Seiten):**

| Stand | Seite 1 | Seite 2 | Seite 3 | Durchgang |
|---|---|---|---|---|
| vorher (`origin/main` `8c1112ddc`) | 47.915 | 42.927 | 36.246 | 127.088 |
| ohne COUNT und Unterabfrage | 28.094 | 23.094 | 17.946 | 69.134 |
| mit Teilindex (Migration 051) | 5.593 | 5.593 | 4.195 | **15.381** |

`namen=1` liest unverändert 17.800 je Rechnung; gespart wird die Häufigkeit. Produktiv liegt die Seitenabfrage im Mittel bei 26.101 je Aufruf (die lokale Rechnung zählt den `COUNT(*)` je Seite mit und kommt auf 42.000); die Ersparnis oben rechnet deshalb mit dem lokalen Endwert je Seite (≈ 5.100 im Mittel, 15.381 je Durchgang), nicht mit den lokalen Absolutwerten vorher. Das Verhältnis ist eine Schätzung, belegt erst das Nachmessen unten.

**Schreibzeilen (lokal, `meta.rows_written`, 100 Rohfolgen):** Einfügen 401 vorher wie nachher; Abhaken (`UPDATE … SET uebernommen = 1`) 200 → 100, weil ein Teilindex den Eintrag beim Abhaken nur noch entfernt, statt `(uebernommen, gemeldet_am)` neu zu schreiben: bei 62 Abhak-Aufrufen × 100 Ids am Tag rund −6.200 Zeilen. Einmalig kostet das Ersetzen des Index bis zu ~2 × 13.000 Zeilen (Löschen + Anlegen), also nach 00:00 UTC ausführen, wenn der Tagesdeckel (50.000) frisch ist. Kein zweiter Index: der alte `prime_folge_offen` hatte keinen anderen Leser (`COUNT(*)` entfällt, alle übrigen Abfragen laufen über Primärschlüssel, `prime_folge_seite`, `prime_folge_gti`).

**Reihenfolge nach dem Merge:** erst Migration (`cd worker && npx wrangler d1 execute anime-kalender --remote --file=migrations/051-prime-folge-offen-id.sql`, nach 00:00 UTC), dann `npx wrangler deploy --config wrangler.toml`. Beide Reihenfolgen brechen nichts: der **neue** Worker vor der Migration arbeitet mit dem alten Index (wie bisher, nur ohne Ersparnis), der **alte** Worker nach der Migration findet den Teilindex für seine Abfrage ebenso. Die Pipeline (`fetch-rohfolgen.ts`) braucht die Antwort ohne `gesamt` und kommt auch mit dem alten Worker zurecht.

**Folge für den Betrieb:** Eine neue Adresse bekommt ihren Namen in `folgen-zuordnung.json` bis zu 6 h später (`namen=1`); die offenen Rohfolgen tragen den Serienamen weiter selbst (`serientitel`), `fetch-rohfolgen.ts` merkt nichts. **Nachmessen am Tag nach dem Deploy:** `wrangler d1 insights DB --config wrangler.toml --time-period 1d --sort-type sum --sort-by reads --limit 8 --json`; erwartet: `COUNT(*) … prime_folge` verschwunden, die Seitenabfrage unter 8.000 je Aufruf, `namen` ≤ 4 Aufrufe.

**Nicht in diesem PR (Funde):** `?rohfolgen=1&alle=1` (149 × 4.522 = 0,67 Mio.) und `?alle=1` der Meldungen (75 × 4.162 = 0,31 Mio.) lesen je Bestandsbau alle Seiten neu, weil jede Meldung den R2-Auszug verwirft; eine längere Frist oder ein Auszug nach `gemeldet_am` wären der nächste Hebel (zusammen bis −0,7 Mio.). Die Statuszeile `SELECT workflow, zustand, … FROM lauf_status` (32.988 × 4 = 0,14 Mio.) ist klein.

## Ein roter Wächter hält nur zurück, was er betrifft (26.10.2026)

Anlass: Bestandsbau 5 h rot (26.10., 05:39–11:18 UTC), weil `check-handlung-eigen-bestand.ts` einen verwaisten Eintrag meldete; in 7 Tagen (19.–26.10.) 96 rote Läufe in 12 Blöcken, 65,6 h ohne neuen Bestand, keiner der 96 Rot-Läufe trug eine Titelmarke. Von den 65,6 h entfallen 5,6 h (der 26.10., 11 Läufe: handlung-eigen, cr-ja-deckung, tmdb-hauptserie) auf Fälle, die diese Änderung abfängt; 42,1 h auf `check:logic` (unten). Zählung: `gh run list --workflow bestand-bauen.yml`, Job-Logs, Zeile „check:… N von M Prüfungen rot“.
- **Verwaist ist eine Warnung.** `eigeneTexteAktiv` bindet nur Einträge zu Titeln im Bestand ein; ohne Titel erscheint kein Text. Die Prüfung druckt `⚠ WARNUNG [vorher rot] …` (`herabgestufteWarnzeile`, Exit 0). `tools/bestand-warnung-melden.mjs` hängt jeden neuen Wortlaut einmal an `data/meldungen-an-claude.jsonl` (`commit-data.sh`, `bestand_warnungen`); sonst bliebe es eine Anmerkung im Lauf-Log.
- **Titelmarken nachgerüstet:** `check-cr-ja-deckung-bestand.ts` (Kennung steht in der Zeile) und `check-tmdb-hauptserie-bestand.ts` (Folgenliste/Hintergrundbild je Kennung; liest rohe Sammler-Dateien, zurückgestellte Titel zählen deshalb nicht mehr als Verstoß, sonst bliebe die Prüfung nach der Quarantäne rot).
- **Ratsche:** `tools/bestand-marken.mjs` und `tools/bestand-ohne-marke.json` (49 Wächter ohne Titelmarke, Stand 26.10.2026). Ein neuer Wächter in `check-bestand-liste.txt` braucht `melde`/`meldeVerletzte` oder einen Eintrag mit Grund; die Liste darf nur sinken. Test: `tools/bestand-marken.test.mjs`.
- **Bewusst rot geblieben:** `check:logic` im Bestandsbau (42 der 65,6 h: `check-synchro-original.ts` hing an der Uhr, nach #1841 grün). Seine Prüfungen sind Codetests, die der PR-Kette gehören; ob eine davon auch Handdaten prüft, die Falsches live brächten, ist nicht belegt.

## Bestandsbau rot am 12.10.2026: TMDB hängt aniSearch-Specials an die Hauptserie

Der TMDB-Tiefendurchlauf (12.10., 05:30) ordnete drei nur bei aniSearch geführten Titeln (UBW Prologue, GGO Refrain, Veldora’s Journal) die Hauptserie zu; `ergaenzeWegeAusTmdbUndMotn` (`pipeline/bau/13-3-1-tmdb-wege.ts`) gab ihnen danach deren Anbieter, `check:cr-zuordnung` („Titel nur bei aniSearch tragen keinen erratenen Weg“) fiel zu Recht. Fix: aniSearch-Titel (`id >= ANISEARCH_ID_BASIS`) bekommen dort keinen Anbieter; die Zusicherung bleibt streng. Folgeschaden, solange der Bau rot ist: die eingecheckten Erzeugnisse veralten gegenüber neueren Rohdaten, und `check:cartoon-ton` wird auf main rot (nach einem Neubau grün). Lokal zu prüfen mit `rm public/data/titles.json`, `npm run data:build`, danach die Zusicherungen (Abschnitt „Lokaler Bau“).

## D1-Schreibkontingent: unveränderte Rohfolgen werden nicht neu geschrieben (12.10.2026)

**Anlass:** Ein Erweiterungs-Durchgang (Prime, Netflix, Disney+ in drei Fenstern) schrieb am 11./12.10.2026 166.236 Zeilen (`d1-verbrauch.mjs --lokal --zeitraum 1d`, 12.10. 11:55). Größter Schreiber: `INSERT INTO prime_folge` mit 11.106 Aufrufen à Ø 8 Zeilen = 88.848 Zeilen (Tabelle + `sqlite_sequence` + sechs Indexe, vor Migration 047). `speichereRohfolgen` löschte bei jeder Meldung, deren Rumpf sich irgendwie unterschied (der `pruefung`-Hash fängt nur die ganz gleiche), die offenen Rohfolgen der Seite bzw. je `gti` und schrieb alle neu.

**Was jetzt gilt (Migration 050, `rohfolgen-abgleich.ts`):** `prime_folge.hash` = SHA-256 über die 17 Spaltenwerte einer Rohfolge (ohne `gemeldet_am`, `roh` mit sortierten Schlüsseln). Der Worker lädt die offenen Zeilen (`SELECT id, hash`, mit `INDEXED BY prime_folge_seite` bzw. `_gti`, dieselbe Lesemenge wie der frühere DELETE), vergleicht als Menge und schreibt nur: gleicher Hash = stehen lassen; geänderte oder fehlende Zeile = `DELETE … WHERE id IN (…)`; neue = `INSERT`. Zeilen ohne Hash (Altbestand) werden einmal ersetzt. Abgehakte (`uebernommen = 1`) Zeilen bleiben unberührt; **überholt am 12.10.2026:** sie zählen jetzt als Vergleich, siehe den Abschnitt „Übernommene Rohfolgen“ unten.

**Gemessen (lokal, workerd/miniflare, `meta.rows_written` aus `schreib_tag`, Prime-Seite mit 90 Rohfolgen, vorher = Stand `82c82ef5e`):**

| Meldung | vorher | nachher |
|---|---|---|
| erste Meldung | 455 | 455 |
| gleiche Meldung erneut (Hash der Meldung) | 0 | 0 |
| andere Notiz, gleiche Folgen | 546 | 6 |
| eine Folge geändert | 546 | 12 |
| Netflix, eine Folge erste / gleich / Ton geändert | 10 / 0 / 12 | 10 / 0 / 12 |

Die 6 Zeilen sind `pruefung` (Löschen + Einfügen samt Indexen) und der Tageszähler; Netflix/Disney+ melden je Folge, dort ändert sich nichts, solange die ganze Meldung gleich ist (Hash aus Migration 048 greift) oder sich auch die Rohfolge ändert.

**Indexe von `prime_folge` (EXPLAIN QUERY PLAN aller Abfragen, auch mit 20.000 Zeilen und `ANALYZE`): keiner überflüssig.** Nach 047 bleiben `prime_folge_gti` (Ladeabfrage Netflix/Disney+, `INDEXED BY`), `prime_folge_seite` (Ladeabfrage Prime, `INDEXED BY`) und `prime_folge_offen` (`?rohfolgen=1`; seit Migration 051 ein Teilindex auf `id`, vorher `(uebernommen, gemeldet_am)` samt `COUNT(*)`). `?probe=` und `alle=1` laufen über den Primärschlüssel. Nicht entfernt.

**`gemeldet_am` einer stehengebliebenen Zeile bleibt alt.** Gelesen wird es nur für „jüngste gewinnt" unter Dubletten (`fetch-rohfolgen.ts`) und als Anzeige `gesehen` in der Zuordnung (`folgen-je-folge.ts`, keine Entscheidung hängt daran). Die Wiedervorlage rechnet über `pruefung.gemeldet_am` (siehe oben), das weiter erneuert wird.

**Reihenfolge nach dem Merge:** erst Migration, dann Deploy. `npx wrangler d1 execute anime-kalender --remote --file=migrations/050-prime-folge-hash.sql` (im Ordner `worker/`), danach `npx wrangler deploy --config wrangler.toml` (ohne `--config` liest Wrangler die `assets`-Angabe der Seite und bricht ab, 12.10.2026). Der **alte** Worker bricht nach der Migration nicht (er nennt die Spalten im INSERT ausdrücklich, `hash` bleibt NULL; der neue ersetzt diese Zeilen einmal). Der **neue** Worker vor der Migration verliert die Rohfolgen (SELECT/INSERT scheitern an der fehlenden Spalte, nur im Log) — also nicht umgekehrt.

## D1-Schreibkontingent: übernommene Rohfolgen werden nicht neu geschrieben (12.10.2026)

**Anlass:** Stichprobe 12.10. 13:28 (300 heute geschriebene `prime_folge`-Zeilen ab 10:45Z): 223 gab es schon für dieselbe Seite und Nummer, 165 mit gleichen Sprachen, 166 davon bereits `uebernommen = 1`. Bis 11:28Z waren es 5.182 neue Zeilen. Ursache: Der Abgleich aus Migration 050 verglich nur offene Zeilen. Nach der Übernahme durch den Bau (`rohfolgenUebernommen` setzt `uebernommen = 1`) fand er nichts mehr und schrieb jeden Durchgang dieselben Folgen erneut (5 Zeilen je Rohfolge: Tabelle, `sqlite_sequence`, drei Indexe).

**Was jetzt gilt (`rohfolgen-abgleich.ts`):** Die Ladeabfrage holt offene **und** übernommene Zeilen (`id, hash, uebernommen, asin, gti, nummer`). Eine Rohfolge, deren Hash die **jüngste übernommene** Zeile derselben Folge (Asin, gti, Nummer) trägt, wird nicht geschrieben. Die jüngste, weil bei Rückkehr zu einem früheren Stand (A, B, A) sonst B bei „jüngste gewinnt“ (`fetch-rohfolgen.ts`, `folgen-je-folge.ts`) die Wirklichkeit überdeckte; dann kommt A wieder als neue offene Zeile. Ein geänderter Hash kommt wie vorher als neue offene Zeile, damit der Bau sie sieht. Offene Zeilen: unverändert (gleicher Hash bleibt, Rest gelöscht/eingefügt).

**Lesezeilen: keine mehr.** `prime_folge_seite` bzw. `_gti` lieferten schon vorher alle Zeilen der Seite (auch übernommene), `uebernommen = 0` war ein Filter dahinter; `rows_read` ist mit und ohne Filter gleich. Die Abfragen bleiben `INDEXED BY`; `EXPLAIN QUERY PLAN` (Test in `tools/worker-tagesdeckel.test.ts`): `SEARCH prime_folge USING INDEX prime_folge_seite (seiten_kennung=?)` bzw. `prime_folge_gti (gti=?)`, kein `SCAN prime_folge`. Kein neuer Index (jeder kostete eine Indexzeile je Einfügung).

**Gemessen (lokal, workerd/miniflare, `getPlatformProxy`, `meta.rows_written`/`rows_read` je Meldung; Prime-Seite mit 90 Rohfolgen, nach jedem Schritt alles auf `uebernommen = 1` wie nach dem Bau; vorher = Stand `9c3d10ddd`):**

| Meldung (alles übernommen) | vorher geschrieben | nachher geschrieben | vorher gelesen | nachher gelesen |
|---|---|---|---|---|
| gleiche Meldung erneut | 456 | 6 | 273 | 93 |
| andere Notiz, gleiche Folgen | 456 | 6 | 364 | 94 |
| eine Folge geändert | 456 | 11 | 455 | 97 |
| zurück zum alten Stand (A, B, A) | 456 | 11 | 546 | 99 |
| Netflix, eine Folge gleich erneut | 11 | 6 | 6 | 4 |
| Netflix, Ton geändert | 11 | 11 | 8 | 7 |

Die 6 Zeilen sind die Meldung selbst in `pruefung` (siehe unten) und der Tageszähler. Vorher wuchsen die Lesezeilen mit jedem Durchgang um die Folgenzahl (273, 364, 455, 546 …), weil jede Fassung als übernommene Zeile liegen blieb; nachher bleibt es stehen. Erste Meldung und Meldung bei offenen Zeilen unverändert (456 bzw. 0).

**Altbestand ohne Hash: einmaliges Neuschreiben, keine Migration.** Der Hash ist SHA-256 über die 17 Spaltenwerte mit sortiertem `roh`-JSON; SQLite in D1 kann das nicht nachrechnen, eine Migration könnte ihn nicht setzen. Übernommene Zeilen ohne Hash (alles vor Migration 050) zählen nicht als Vergleich; die Folge kommt einmal neu, wird vom Bau übernommen und trägt dann den Hash. Obergrenze: ein vollständiger Durchgang, rund 11.000 Rohfolgen (11.106 am 11./12.10.) × 5 = rund 55.000 Zeilen (**überholt 14.10.2026:** gemessen ersetzte der Altbestand nur etwa 4 %, der Rest war Neubefüllung, siehe „D1-Verbrauchsmessung“), verteilt auf die Tage der Durchgänge (Tagesdeckel 50.000 bremst mit 429; die Erweiterung wartet bis 02:00 MESZ) — Seiten, die heute schon mit Hash übernommen wurden, kosten 0. **Es gibt keine Migration; die Reihenfolge nach dem Merge lautet: Worker deployen (`cd worker && npx wrangler deploy --config wrangler.toml`), sonst nichts.** Der Worker läuft mit der Spalte `hash` aus Migration 050 (schon remote).

**`pruefung` hat dasselbe Muster — behoben am 12.10.2026, siehe den Abschnitt „Wiederholte Meldungen“ unten.** (Stand davor: dieselbe Meldung nach dem Abhaken schrieb eine neue offene Zeile, 5 Zeilen + Zähler = 6; 8.758 Aufrufe am 11./12.10. × 6 = rund 52.500 Zeilen.)

## D1-Schreibkontingent: wiederholte Meldungen erneuern höchstens die vorhandene Zeile (12.10.2026)

**Was jetzt gilt (`pruefung-unveraendert.ts`):** Die Ladeabfrage holt die offenen **und** die übernommenen Zeilen der gemeldeten Folge (seit 12.10.2026 je Folge statt je Adresse, Abschnitt "Eine Meldung liest nur ihre Folge"). Gibt es keine offene Zeile derselben Folge (Adresse, Folge, Staffel, Seitenkennung) und trägt die **jüngste übernommene** denselben Hash, wird nichts eingefügt. Sonst unverändert: offene Zeile mit gleichem Hash (`haltFrisch`), geänderter Inhalt = neue offene Zeile, Rückkehr zu früherem Stand (A, B, A) = A kommt als neue Zeile (die jüngste gewinnt in `fetch-pruefungen.ts`/`fetch-urteile.ts`), Altbestand ohne Hash einmal neu geschrieben (Hash seit Migration 048, keine neue Migration).

**Wann `gemeldet_am` der übernommenen Zeile trotzdem erneuert wird** (jeweils ein UPDATE über den Primärschlüssel):
- Berlin- oder UTC-Datum der Zeile ≠ heute: `checkedAt` (Berlin-Datum, `fetch-pruefungen.ts`) und `tag` der Urteile (UTC-Datum, `fetch-urteile.ts`) würden sonst einfrieren. Die Zeile wird dabei wieder geöffnet (`uebernommen = 0`), denn der Bau holt nur offene Zeilen; er übernimmt sie wie bisher die neue Zeile und hakt sie wieder ab. Die Urteile lesen `?alle=1` (alle Zeilen, jüngster Tag je Folge gewinnt) und sehen das neue Datum.
- Zeile älter als der letzte Listenbau (`pruefstand.json`, `erzeugtAm`): Prüfstand-Ziele mit `seit` (`pruefung-stand.ts`, `pruefung-stand-anbieter.ts`) und die Zähler der Erweiterung (`pruefung-zaehlen.ts`: Adressen, Suchadressen, Seitenkennungen) rechnen `gemeldet_am > erzeugtAm`. Nur `gemeldet_am`, die Zeile bleibt übernommen. Ohne das bliebe eine Wiedervorlage ewig offen und würde bei jedem Durchgang neu gemeldet (Bleach-Fall).
- Sonst: 0 geschriebene Zeilen.

**Grenze zwischen Datum (D) und Listenbau (W):** Die Datumsprüfung kommt zuerst. Ist die Zeile von einem anderen Tag (Berlin oder UTC) **und** älter als der Listenbau, gibt es genau ein UPDATE (`gemeldet_am = jetzt, uebernommen = 0`, 2 geschriebene Zeilen mit Zähler); der Listenbau wird dafür nicht einmal geholt. Die Zeile wird also wieder geöffnet, auch wenn nur W sie gebraucht hätte. Das genügt für W, denn das neue `gemeldet_am` liegt hinter dem Bau; die nächste gleiche Meldung schreibt 0 Zeilen. W allein (Zeile von heute, aber vor dem Listenbau) lässt die Zeile übernommen. Ist `pruefstand.json` nicht lesbar (`erzeugtAm` = `null`), entfällt W still, D gilt unabhängig davon. Geprüft in `tools/worker-tagesdeckel.test.ts` (Abschnitt „Tagesgrenze UTC/Berlin (D) und Zeile vor dem Listenbau (W)“, auch die Tagesgrenze 00:00–02:00 MESZ, in der Berlin- und UTC-Tag auseinanderfallen).

**Einmal pro Tag genügt also nicht ganz:** Die Datumsleser kämen damit aus, die `> erzeugtAm`-Leser nicht. Je Zeile und Tag sind es höchstens 1 + Zahl der Listenbauten (am 12.10. bis zu 15 am Tag) Erneuerungen zu je 5 Zeilen, bei mehreren Durchgängen zwischen zwei Bauten dagegen 0. Mögliche Verschärfung, eigener Auftrag: die Listenbau-Erneuerung nur für Adressen, die `pruefstand.json` noch als Ziel führt (`anbieter[].ziele`, `suchAdressen`); dazu müssten alle Leser der drei Zähler einzeln geprüft werden.

**Bekannte Grenze:** Zwei widersprüchliche Meldungen derselben Adresse (z. B. „weg“ und „dub“ für verschiedene Folgen) am selben Tag behalten ihre Reihenfolge nicht, wenn die ältere erneut gemeldet wird und ihre Zeile von heute ist (`fetch-pruefungen.ts`: „ein ‚weg‘ gilt, solange nichts Jüngeres widerspricht“). Bei offenen Zeilen war das schon vorher so.

**Lesezeilen-Posten vom 12.10.2026 (`wrangler d1 insights`, 24 h, rund 7,8 Mio.) und ihr Bezug zu diesem Abschnitt:**
- `SELECT folge_nr, staffel, folge, MAX(gemeldet_am) … WHERE url = ?` (`pruefung-gemeldet.ts`, 35.742 Aufrufe, 1,61 Mio., im Mittel 45 Zeilen): liest **alle** Zeilen der Adresse samt Verlauf. Die Zeilenzahl je Adresse wuchs mit jeder Wiederholung nach dem Abhaken; das hört mit diesem Stand auf. Die Ersparnis ist nicht berechenbar (hängt an der Zahl der Dubletten, die schon dort liegen): bestehende bleiben, bis eine Bereinigung (eigener Auftrag, einmalig: ältere übernommene Zeilen mit gleichem Schlüssel und gleichem Hash löschen, die jüngste bleibt; kostet Schreibzeilen) sie entfernt.
- `SELECT plattform, url, staffel FROM pruefung WHERE uebernommen = 0` (`pruefung-stand-briefkasten.ts:31`, 435 × 3.920 = 1,71 Mio.): liest alle offenen Zeilen. Offen bleibt, was der Bau nicht zuordnet; daran ändert dieser Stand nichts (Wiederholungen mit gleichem Hash entstanden schon vorher nicht als zweite offene Zeile). Nicht Teil dieses Auftrags.
- `prime_folge` mit Unterabfrage `(SELECT p.titel FROM pruefung p WHERE p.url = f.url …)` (`pruefung-rohfolgen.ts`, 56 Aufrufe, 1,46 Mio.) und `SELECT COUNT(*) FROM prime_folge WHERE uebernommen = 0 …` (106 × 13.081 = 1,39 Mio.): Tabelle `prime_folge`, durch PR 957 (Rohfolgen) berührt, nicht durch diesen. Die Unterabfrage nimmt je Rohfolge die jüngste `pruefung`-Zeile über `pruefung_url_zeit` (eine Zeile), wächst nicht mit den Dubletten.
- `DELETE FROM pruefung WHERE url = ?1 AND uebernommen = 0 …` (7.657 Aufrufe, 0,29 Mio.): so nur noch der Rückfall `loescheOffeneNachAdresse` ohne vorgeladene Zeilen, den eine Meldung nicht erreicht; der Aufruf stammt aus der Zeit vor #845 (Löschen über die ID, 11.10. 21:55). Ob die 7.657 Aufrufe vor oder nach dem Deploy von #845 liegen, ist nicht geprüft (Deploys heute 08:46, 10:24, 11:53 UTC).

**Kosten (lokal, workerd/miniflare, `tools/worker-schreibzeilen-messen.ts`, `meta.rows_written` mit Indexen):** `INSERT INTO pruefung` = 5 Zeilen (Tabelle, `sqlite_sequence`, `idx_pruefung_offen`, `pruefung_url_zeit`, `pruefung_gemeldet`; `pruefung_such_url` ist teilweise und bleibt bei NULL leer) + Tageszähler = 6. `UPDATE … SET gemeldet_am` oder `gemeldet_am, uebernommen = 0` = 4 (Tabelle + drei Indexe, alle drei enthalten die Spalte) + Zähler = 5. `UPDATE … SET uebernommen = 1` = 2, `UPDATE … SET notiz` (keine Indexspalte) = 1. Ein UPDATE ist also nur 1 Zeile billiger als ein INSERT; der Gewinn kommt vom Auslassen.

| Meldung (Zeile schon übernommen, Netflix, eine Folge) | geschrieben vorher | nachher | gelesen vorher | nachher |
|---|---|---|---|---|
| gleich, selber Tag | 6 | 0 | 4 | 1 |
| gleich, Zeile von gestern | 6 | 5 | 4 | 3 |
| gleich, Zeile älter als Listenbau | 6 | 5 | 5 | 3 |
| andere Notiz | 6 | 6 | 6 | 4 |
| zurück zum alten Stand (A, B, A) | 6 | 6 | 7 | 5 |

(vorher = Stand `474043f75`; die Zeile „von gestern“ hat vorher denselben Pfad wie jede übernommene Zeile: INSERT.) Die Lesezeilen sinken, weil keine zweite offene Dublette mehr entsteht.

**Reihenfolge nach dem Merge:** keine Migration; nur Worker deployen (`cd worker && npx wrangler deploy --config wrangler.toml`). Nachmessen am Tag danach mit `node tools/d1-verbrauch.mjs --lokal --zeitraum 1d` bzw. `wrangler d1 insights` (Aufrufe von `INSERT INTO pruefung` und `UPDATE pruefung SET gemeldet_am`).


## Ladezeiten-Überwachung am Handy (12.10.2026)

`npm run check:ladezeiten` (`tools/ladezeiten-messen.mjs`, Lauf `tools/ladezeiten-lauf.mjs`, Grenzen `tools/ladezeiten-grenzen.mjs`, geteilter Kern `tools/tempo-kern.mjs`): Pixel 7, 4× CPU, gegen `dist/` ohne Server und ohne Netz (Playwright-Routen; Cover werden durch ein Pixel ersetzt, andere Fremdhosts abgebrochen). Gemessen werden die Zeit bis der Kalender nach dem Zeichnen sichtbar ist (3 kalte Ladungen) und je Aktion Tipp bis Ruhe (5 Wiederholungen): Woche→Monat, Monat→Woche, Woche vor, Woche zurück, Filter auf, Panel auf. Exit 1, wenn ein Median über der Grenze liegt; `--nur-messen` meldet ohne Urteil, `--bauen` baut vorher (`build:schlank`).

**Grenzen** = Median × 1,5, gemessen am 12.10.2026 (fünf Läufe auf dem Entwicklerrechner, Stand main cb76ca543): Kalender sichtbar 896 ms (Grenze 1344), Woche→Monat 84 (126), Monat→Woche 136 (204), Woche vor 90 (135), Woche zurück 136 (204), Filter auf 101 (152), Panel auf 127 (191). Streuung zwischen Läufen: ±15–25 % im Median, einzelne Panel-/Filter-Wiederholungen bis 600 ms (erstes Layout), der Median fängt sie ab. Laufzeit 38–42 s. Nicht gemessen wird das Netz (Übertragungszeit); das tut `tools/leistung-messen.mjs` gegen live.

**Warum nicht in `check:vor-commit` und nicht in den Pflichtjob von `pr-pruefung.yml`:** Der Pflichtjob hat kein Chromium (siehe Kopf von `aussehen-pruefen.yml`), und eine Zeitgrenze auf einem geteilten Runner ist ohne Eichung nicht stabil. Vorschlag (Workflow-Dateien hier bewusst nicht angefasst):
1. Im Job `aussehen` von `pr-pruefung.yml` (nur bei `web/src`-Änderungen, nicht verpflichtend) hinter `check:ansichten` ein Schritt `npm run check:ladezeiten` mit `continue-on-error: true`, bis die Läufe auf dem Runner geeicht sind.
2. Umgesetzt am 12.10.2026: Workflow `ladezeiten.yml`, siehe unten.

**Tägliche Messung auf dem GitHub-Rechner (`ladezeiten.yml`, 12.10.2026).** Ausgelöst vom Cloudflare-Wecker (`shared/weckplan.ts`: täglich 16 UTC = 18 Uhr Berlin, die einzige Stunde ohne anderen Tageslauf; `workflow_dispatch`, kein `schedule:`). Zweite Linie: `wecker-wache.yml` (Eintrag `ladezeiten.yml:30`), Frist der Wochenwache 36 h (`wache-woechentlich.mjs`). **Der Wecker-Eintrag wirkt erst nach `wrangler deploy` des Workers** (`worker/`, Befehl und Ordner im Abschnitt „D1-Kontingent, Mail-Zustellung und Worker-Befehle“); bis dahin startet die Wecker-Wache sie nur alle rund 30 Stunden nach, oder von Hand: `gh workflow run ladezeiten.yml --repo danielzaiser91/anime-kalender-de`.

Der Lauf holt Chromium aus dem Cache (`actions/cache`, Schlüssel aus `package-lock.json`; Systembibliotheken immer neu), baut `dist/` aus dem Stand von `main` und ruft `npm run check:ladezeiten -- --bauen --nur-messen --ausgabe ergebnis/ladezeiten.json` auf. Gemessen wird also der gebaute Stand ohne Netz, nicht die Live-Seite. `--ausgabe` schreibt JSON (Median, min, max, alle Einzelwerte, Grenze je Messgröße; `tools/ladezeiten-ausgabe.mjs`) und hängt eine Tabelle an `$GITHUB_STEP_SUMMARY`. Artefakt `ladezeiten`, 30 Tage. Es werden keine Repo-Dateien geschrieben, daher kein Eintrag in `tools/quellen-liste.sh`. Geschätzte Laufzeit 5–8 Minuten je Lauf (Annahme, erster Lauf misst es: Abhängigkeiten ~1 Min., Chromium-Systembibliotheken ~0,5 Min., `build:schlank` 1–3 Min., Messung 40 s lokal und auf dem Runner länger); `timeout-minutes: 20`.

**Eichen:** nach etwa sieben Läufen (`gh run download <Lauf> -n ladezeiten`, oder `gh run list --workflow ladezeiten.yml`) je Messgröße Median und Streuung der Tagesmediane bilden. Dann `MEDIAN_HEUTE` und `MESSTAG` in `tools/ladezeiten-grenzen.mjs` auf die Runner-Werte setzen (Grenze = Median × 1,5, die Streuung zwischen Tagen prüfen: liegt der größte Tageswert über der Grenze, Faktor begründen statt stillschweigend anheben), `--nur-messen` im Workflow entfernen (Rot meldet dann `laeufe-aufraeumen.mjs`) und diesen Abschnitt nachführen.

## Untersucher: eine Ursache, ein Issue, ein Pull Request (12.10.2026)

Am 11./12.10.2026 legten 15 rote Bestandsbauten 15 Issues und viele PRs an, obwohl es nur 7
Ursachen waren (fünfmal „Titel nur bei aniSearch tragen keinen erratenen Weg", dreimal
„gesperrter Titel in neu-mit-synchro.json", je zweimal Prüfliste und Handbelege). Jeder Lauf
startete einen Untersucher, der vom Vorgänger nichts wusste.

**Jetzt** läuft in `claude-reparatur.yml` vor dem Untersucher `tools/untersucher-vorab.mjs`:

- **Schlüssel** = erste Zusicherungszeile `✖`/`✗` des Protokolls, sonst `FEHLER:`, sonst der
  `⚠`-Kopf vor „Der gebaute Bestand verletzt eine Zusicherung", sonst die erste besondere
  `##[error]`-Zeile; ohne Fundliste („— gefunden: …") und mit allen Zahlen als `N`. Das ist die
  Prüfung, nicht der betroffene Titel (`tools/untersucher-logik.mjs`). Ohne Ursachenzeile
  (z. B. Wache) bleibt alles wie bisher.
- **Marker** `<!-- untersucher-schluessel: … -->` im Issue-Text. Der Schritt legt das Issue
  selbst an (Titel „Bestandsbau rot: …", wird vom grünen Bau geschlossen) und sagt dem Untersucher
  die Nummer; der Untersucher ergänzt per Kommentar und schreibt „Behebt #N" in den PR.
- Gibt es ein offenes Issue mit dem Schlüssel: Kommentar mit Lauf-Link (und am offenen PR, der
  `#N` oder einen Lauf des Issues nennt). Gibt es einen offenen PR, startet der Untersucher gar
  nicht; sonst startet er mit dem Hinweis auf das Issue.
- Grenze: dieselbe Zusicherung kann zwei Ursachen haben (am 12.10. „erratener Weg": erst
  Nachrunde, dann `dub: true`). Die zweite landet im selben Issue; der Untersucher läuft wieder,
  solange kein PR offen ist, und schreibt die neue Ursache als Kommentar.
- Belegt an den 15 Läufen: `tools/untersucher-schluessel.test.mjs` (Protokollauszüge unter
  `tools/testdaten/untersucher/`) — 7 Schlüssel, keine zwei Ursachen zusammengeworfen.

## D1-Lesekontingent: Lese-Deckel der Meldungs-Route (12.10.2026)

**Anlass:** Das Lesekontingent (5 Mio. gelesene Zeilen je UTC-Tag und Konto, Newsletter-Worker und Ticket-Board teilen es) war am 12.10.2026 gegen 14:20 MESZ erschöpft; Status, Meldungen, Board und Erweiterungs-Durchgänge standen bis 02:00 MESZ. Für geschriebene Zeilen gab es den Deckel (`tagesdeckel.ts`, 50.000), für gelesene keinen; die Durchgänge liefen weiter, bis das Konto stand. PR 968 senkt die Grundlast (rund −2,9 Mio. am Tag), der Lese-Deckel ist der zweite Schutz.

**Gemessen (lokal, workerd/miniflare, `tools/worker-meldung-lesezeilen-messen.ts`, `meta.rows_read`; Bestand wie am 12.10.: `pruefung` 17.800, `prime_folge` 55.000 Zeilen):** Eine Meldung las die bestehenden Zeilen **ihrer Adresse** (`ladeOffeneHashes`, `pruefung_url_zeit`) plus 3; der Deckel selbst liest 2 davon (Zählerzeile, Löschen alter Tage). **Stand vor Migration 053 / PR 981:** Seitdem liest sie nur die Zeilen ihrer Folge (nächster Abschnitt); die Disney+-Zeilen der Tabelle gelten nur für den alten Stand, Netflix und Prime ändern sich nicht.

| Meldung | gelesen |
|---|---|
| Disney+, eine Folge (Einzelanfrage), Seite mit 24 / 100 / 200 Folgen | 27 / 103 / 203 |
| Disney+, Wiederholungsdurchgang über eine ganze Seite mit 12 / 24 / 100 / 200 Folgen | 187 / 655 / 10.307 / 40.607 (damals mit n² gewachsen; seit 053: 96 / 400 / 800 bei 24 / 100 / 200 Folgen) |
| Netflix, Stapel zu 10 Folgen, Titel mit 24 / 70 Folgen (Durchgang über 70 Folgen: 7 Stapel) | 26 / 72 (504) |
| Netflix, Stapel zu 10, Titel neu | 32 |
| Prime, 90 Rohfolgen: Seite neu / gleiche Meldung / andere Notiz / alles übernommen + andere Notiz | 183 / 4 / 96 / 95 |

**Seiten je Durchgang bei 1,5 Mio. Lese-Budget (Stand vor 053):** Disney+ mit 24 Folgen je Seite rund 2.290, mit 100 Folgen rund 145, mit 200 Folgen rund 37; Netflix (70 Folgen) rund 2.975; Prime unverändert rund 375.000, mit geänderten Folgen rund 15.800. Der Posten war bei Disney+ die Folgenzahl der Seite zum Quadrat — jede Folge lud alle Zeilen der Adresse; seit 053 wächst er linear (Tabelle im nächsten Abschnitt).

**Was jetzt gilt (`tagesdeckel.ts`, Migration 052):** Die Meldungs-Route addiert `meta.rows_read` ihrer D1-Antworten (`run`, `all`, `batch`) in `schreib_tag.gelesen`, im selben Upsert wie die geschriebenen Zeilen (eine Zeile je Anfrage, auch bei unveränderten Meldungen; vorher 0). **Diese eigene Zeile zählt in den Schreib-Deckel mit** (`geschrieben + 1`): Der Upsert läuft auf der unverpackten Datenbank, sonst hätte eine Schleife unveränderter Meldungen bis zum Lese-Deckel rund 375.000 Schreibzeilen ungezählt verbraucht (echtes Kontingent 100.000). Folge: höchstens ~50.000 Meldungen am Tag. Gewählt statt „kein Upsert bei kleinen Lesemengen“ (dann blieben Schleifen mit je < Schwelle Lesezeilen ungezählt) und statt Sammeln im Isolate (geht mit jedem Isolate verloren, mehrere Isolate parallel). Fehlt Migration 052, schreibt der Worker einmal je Isolate `TAGESDECKEL AUS (…)` ins Protokoll (`wrangler tail`, Workers Logs); gesperrt wird nichts. Ab `DECKEL_LESEN` = 1.500.000 am UTC-Tag antwortet sie mit 429 und `Retry-After` bis 00:00 UTC, mit demselben Rumpf wie der Schreib-Deckel (`tageslimit: true`). Aufträge der Pipeline (abhaken, wieder öffnen) und alle anderen Routen zählen nie mit. Ein Fehler beim Zählen sperrt nichts. Mehrere gleichzeitige Anfragen können die Schwelle um ihre eigenen Zeilen überschreiten (Disney+: 3 Bahnen × bis zu einigen hundert).

**Überholt seit 15.10.2026:** Alle Routen zählen jetzt mit, die Meldung bucht nur noch ihre geschriebenen Zeilen, `DECKEL_LESEN` ist 3,0 Mio. (Abschnitt „Lese-Deckel für jede Anfrage“ unten).

**Schwelle 1,5 Mio.:** 5,0 Mio. Kontingent − rund 2,0 Mio. Grundlast der übrigen Wege (4,87 Mio. am 12.10. minus rund 2,9 Mio. aus PR 968; die Meldungen jenes Tages stecken darin, die Zahl ist also eher zu hoch) − 1,5 Mio. Reserve für Spitzen (Bau-Läufe, Board, Status nach Cache-Verlust) = 1,5 Mio. **Nachmessen** ein paar Tage nach dem Deploy mit `wrangler d1 insights` und `SELECT tag, zeilen, gelesen FROM schreib_tag`; Schwelle dann anpassen.

**Das echte D1-Limit wird zur selben Antwort:** `D1_ERROR: Your account has exceeded D1's free tier daily row read limit.` (Wortlaut vom 01.09.2026; der Schreib-Fall ist nach demselben Muster angenommen) wurde bisher zu 500 ohne `tageslimit` — die Erweiterung erkennt nur 429 mit diesem Feld (`extension/tageslimit.js`; Netflix lief weiter, Prime legte Staffeln als übersprungen ab). Jetzt merkt sich die Zähl-Hülle (`zaehlendeDb`) den Fehler, auch wenn die Meldung ihn selbst fängt (Stapel je Meldung, Rohfolgen), und die Route antwortet mit der 429 des Deckels. Gilt nur für die Meldungs-Route. **Das Limit greift verzögert** (14.10.2026: nach 9,1 Mio. gelesenen Zeilen lief der Worker um 11:44 MESZ noch normal, ab spätestens 12:16 Fehler bis 00:00 UTC; Abschnitt „Titelzeile für Netflix“) — Massenabfragen vorher mit eigener Summe planen.

**Erweiterung (nichts zu ändern, belegt mit `node extension/tageslimit.test.cjs`):** 429 mit `tageslimit: true` und `retryAfter` setzt das Limit (Speicher, alle Tabs), Netflix (`melder.js`) und Disney+ (`disney-netz.js`) halten an und wiederholen nicht, Prime stellt die Staffel an den Anfang des Plans zurück; die Hinweiszeile nennt „weiter ab 02:00" (Berliner Ortszeit). Die Meldungen sind über den Hash idempotent, was vor dem Limit ankam, bleibt gespeichert.

**Reihenfolge nach dem Merge: erst die Migration, dann der Worker.** `cd worker && npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=migrations/052-schreib-tag-gelesen.sql` (nach 00:00 UTC), danach `npx wrangler deploy --config wrangler.toml`. Der **alte** Worker nach der Migration läuft unverändert (`DEFAULT 0`). Der **neue** Worker vor der Migration findet die Spalte nicht: `SELECT`/Upsert scheitern, es zählt und deckelt dann nichts (auch nicht die geschriebenen Zeilen), gesperrt wird aber auch nichts. Migration 051 aus PR 968 ist davon unabhängig.

**Danach erledigt:** Die Disney+-Last (n² je Durchgang) senkt der nächste Abschnitt (Migration 053, ohne Erweiterungs-Release).

**Riegel je Anfrage (15.10.2026, `RIEGEL_LESEN_JE_ANFRAGE` = 5.000):** Ein Netflix-Probelauf las in 10 Minuten 2,5 Mio. Zeilen (eine Abfrage des Titelzeilen-Wegs je Anfrage rund 50.000); der Tagesdeckel griff erst nach dem Schaden. Liest eine einzelne Meldungs-Anfrage mehr als 5.000 Zeilen, bucht sie zusätzlich `DECKEL_LESEN` in `schreib_tag.gelesen` (jede weitere Meldung bis 00:00 UTC bekommt die 429; auch wenn die Anfrage selbst scheitert) und schreibt `RIEGEL JE ANFRAGE: <n> gelesene Zeilen … teuerste Anweisung <m> in: <SQL, erste 120 Zeichen>` ins Protokoll (`wrangler tail`; die teuerste Anweisung ist je SQL-Text über die Anfrage summiert). Ihre eigene Antwort bleibt (gespeichert ist gespeichert; eine 429 ließe die Erweiterung dieselbe teure Meldung morgen erneut schicken). Gemessene größte Anfragen: Prime 90 Rohfolgen 183, Netflix-Stapel n + 2, Disney+ 4 je Folge; Schätzung mit 500 Rohfolgen bzw. 1.100 Folgen unter rund 1.200. Gezählt werden alle Wege der Route (Einzel, Stapel, Titelzeile einzeln und im Stapel, Prime, ADN, „nicht im Angebot"), belegt in `tools/worker-lesedeckel.test.ts`; nicht gezählt sind `first()`/`raw()` (in der Route nicht benutzt) und die GET-Wege (`?gemeldet=`, `?zaehlen=1`). Nach einem Riegel: Zeile im Protokoll suchen, Abfrage beheben, der Tag bleibt bis 00:00 UTC gesperrt.

## Beleg-Bild: Marke auf leerer Fläche, klebende Leiste, Kritik-Kasten (Kinoheld, 12.10.2026)

Anlass: Der Kinoheld-Beleg zu „A New Dawn" (Aufnahme 07.10.2026) zeigte im Dialog nur eine dunkle Fläche mit roter Marke. **Ursachen (an der Live-Seite gemessen):** (1) Die eingeklappte Filmkritik (`max-h-[100px] overflow-hidden`) nennt den Titel in Absätzen weit unterhalb der Seite; `stuetzstelle` nahm den kürzesten Treffer, die Marke lag unter der Fußzeile auf leerem Grund. (2) Die klebende Kopfleiste (64 px) wurde erst nach dem Messen der Fundstelle entfernt, der Inhalt rutschte hoch, die Marke saß daneben. (3) Das Veröffentlichungsdatum steht bei Kinoheld unter „Veröffentlichung", nicht beim Titel.
**Seitdem** (`beleg-bild.ts`, `beleg-stelle.ts`): `leistenEntfernen` vor dem Messen; `verdecktesMarkieren` setzt `data-beleg-verdeckt` auf abgeschnittene Absätze (weder Stützstelle noch Ausschnittsende); Kinoheld sucht zuerst „Veröffentlichung" (`stuetzbegriffe`); `istEinfarbig` prüft zusätzlich den Bereich unter der Marke — liegt sie auf leerer Fläche, gibt es kein Bild (`leer`). `warteschlange` stellt Artikel ganz ohne Bild vor den Altbestand. `npm run check:beleg-wand` deckt die drei Bauarten ab. **Bestand:** 5 Kinoheld-Belege mit Marke gemessen, nur `a-new-dawn` lag auf leerer Fläche (Bild entzogen, wird im Tageslauf neu aufgenommen); die übrigen markieren die Kopfzeile und zeigen das Datum, wenn die Seite es nennt.

## Beleg-Bild im Sammelartikel: Ausschnitt reicht bis zur obersten Titel-Überschrift (Psyren, 27.10.2026)

**Anlass:** Der Beleg zu „Psyren“ (Crunchyroll-Sammelartikel „deutsche Synchros Herbst 2026“, Aufnahme 23.10.2026) begann hinter dem Psyren-Abschnitt; Überschrift und Marke fehlten.
**Ursache (am gespeicherten Stand `data/beleg-lesungen.json` gemessen, der Artikel selbst wurde nicht abgerufen):** (1) Psyren hängt nur über eine Meldung an der Adresse, kein Termin trägt sie — `gruppenJeAdresse` und `suchbegriffeJeAdresse` kannten nur Termine, der Titel hatte weder Gruppe noch Marke (die Lesung führte `markierungen` nur für die Apothekerin). (2) Der Ausschnitt begann 500 px über der Fundstelle des Termin-Titels (`stelle.oben - 500`), alles darüber fiel weg. (3) `stuetzstelle` ließ Überschriften mit höchstens 12 Zeichen („PSYREN“) aus und fiel auf den kürzesten Absatz zurück, der den Namen nennt (Fließtext eines Nachbarn).
**Seitdem:** Meldungen zählen als Titelquelle (`titelJeAdresseAusNews`, `zuordnungFuerLesen`); `fensterStart` (`beleg-stelle.ts`) setzt den Beginn auf die höchste Fundstelle, die mit der untersten noch in `MAX_BIS_STELLE` (3600 px) passt; kurze H2/H3 gelten als Überschrift. `BILD_FASSUNG` 3: alle Bilder werden einmal neu aufgenommen (`belege-lesen.ts`, 60 je Lauf). Wächter: `npm run check:beleg-sammelartikel` (Fixture mit vier Abschnitten, Name im Nachbartext).
**Grenze:** Liegt ein Titel mehr als 3600 px über dem tiefsten, bekommt er keine Marke und steht in `daniel-zum-abarbeiten/listen/22-belege-ohne-fundstelle.md`. (Stand 29.10.2026 überholt: siehe nächster Abschnitt.)

## Marken je Titel: Grund statt Stille, Fenster 6000 px (Magic Knight Rayearth, 29.10.2026)

**Anlass:** Der Ankündigungs-Beleg von Magic Knight Rayearth (178868) zeigt im Detail-Panel das Bild der Crunchyroll-Herbstübersicht (Aufnahme 23.10.2026), auf dem Rayearth nicht steht.
**Ursache (am Bild und Text der Lesung `2026-10-23-5f0c54e1191716f2` im R2 gemessen):** Der Text führt „Magic Knight Rayearth (2026)“ als Abschnitt, das Bild (520 × 782 px) zeigt nur das Ende von Psyren bis zur Apothekerin. Der Ausschnitt ist ein Fenster um die Fundstellen; ein Titel, dessen Fundstelle nicht darin liegt oder nicht gefunden wird, bekam still keinen Eintrag in `markierungen` (`markierungenJeTitel` übersprang ihn), und nichts zählte die fehlenden. Die Lesung war noch in Bildfassung 2 (vor `fensterStart`, 27.10.); auch in Fassung 3 fasst das Fenster (3600 px) die 14 Titel der Übersicht (rund 4700 px) nicht.
**Klassen am 29.10.2026** (Zählung: `news.json`-Belege je Titelkennung, Adresse mit mindestens zwei Titeln laut `zuordnungFuerLesen`, jüngste Lesung mit Bild, Titel ohne Eintrag in `markierungen`; 36 Adressen): 131 Titel-Belege = 103 mit Marken für andere Titel, aber nicht für den eigenen, + 28 ganz ohne Marken je Titel. Davon Bildfassung 1 oder 2 (vor der Fensterkorrektur): 114; Fassung 3: 17. Name des Titels steht im Text der Lesung: 120, nicht: 11 (Namensformen, die der Artikel nicht nennt). Daneben 75 Titel-Belege, deren Adresse noch kein Bild hat.
**Seitdem:** Ein Sammelartikel (ab zwei Titeln) darf bis 6000 px (`MAX_SAMMEL`), über 3616 px einfach aufgelöst (Bildgröße); jeder Titel bekommt in der Lesung entweder `markierungen[id]` oder `ohneMarke[id]` (`nicht-gefunden` oder `ausserhalb`), `lib/beleg-marken.ts`. Eine Lesung mit einem Titel ohne beides (`markenLuecken`) wird im nächsten Lauf neu gelesen (`ohneMarkenJeTitel`, `braucheBild`); ein Lauf, der trotz Ausschnitt eine gelesene Adresse so zurücklässt, endet rot (`meldeMarkenLuecken`, nach dem Speichern), noch nicht neu gelesene Altlesungen stehen als `⚠ WARNUNG Belege: …` im Log. Liefert die Aufnahme gar keinen Ausschnitt (Seite ohne Überschrift), ist das ein Fehlschlag mit Pause wie „einfarbig“ oder „Wand“, kein roter Lauf. Die Handliste `22-belege-ohne-fundstelle.md` führt nur noch Titel, die nicht `ausserhalb` sind. Der Lauf (Schlange, Lesen, Speichern) steht in `pipeline/lib/beleg-lauf.ts` (`fuehreLaufAus`, Browser und Abrufe als Parameter), `pipeline/belege-lesen.ts` verdrahtet nur Browser und Dateien. Wächter: `pipeline/check-beleg-marken.ts` und `pipeline/check-beleg-lauf.ts` (beide check:logic), `npm run check:beleg-sammelartikel`.

## Eine Meldung liest nur ihre Folge: n² Lesezeilen bei Disney+ beseitigt (12.10.2026, Migration 053)

**Befund:** `ladeOffeneHashes` (`worker/src/pruefung-unveraendert.ts`) holte je Meldung alle Zeilen ihrer Adresse (`pruefung_url_zeit`). Gebraucht werden je Meldung nur die Zeilen derselben Folge (Adresse, Folge, Staffel, Seitenkennung): die offenen für „gleicher Hash?" und die Dubletten-IDs zum Löschen, die jüngste übernommene für das Überspringen nach dem Abhaken. Disney+ meldet eine Folge je Anfrage (kein Stapel), also las ein Durchgang über n Folgen rund n² Zeilen (Tabellenzeile + Indexzeile je Treffer).

**Weg (a) im Worker, gebaut:** Neuer Index `pruefung_folge (url, folge_nr, staffel, seiten_kennung)` (Migration 053); die Ladeabfrage sucht darin nur die gemeldeten Schlüssel. Die Schlüssel reisen als JSON in einem Parameter (`json_each`, `CROSS JOIN` legt die Reihenfolge fest, `IS` wegen NULL): eine Abfrage je Aufruf, auch für einen Stapel zu 10 — das Limit von 50 Abfragen je Aufruf bleibt unberührt. `folgeVon()` ist die eine Ableitung des Schlüssels für Laden, Vergleichen und Ersetzen.
**Weg (b) in der Erweiterung, verworfen:** offene Hashes je Durchgang holen und mitschicken braucht einen Erweiterungs-Release, einen neuen Lesepfad im Worker (die Hashes liefe über ein weiteres GET, das selbst Zeilen liest) und vertraut dem Client eine Entscheidung an, die der Worker selbst treffen kann. (a) beseitigt das n² allein und ohne Release.

**Gemessen** (lokal, workerd, `tools/worker-folge-lesen-messen.ts`, Bestand `pruefung` 17.800 Zeilen; `meta.rows_read` über alle Anweisungen einer Meldung, Summe je Durchgang einzeln gemeldeter Folgen):

| Durchgang | vorher | nachher |
|---|---|---|
| Wiederholung unverändert, 24 Folgen | 624 | 96 |
| Wiederholung unverändert, 100 Folgen | 10.200 | 400 |
| Wiederholung unverändert, 200 Folgen | 40.400 | 800 |
| Wiederholung mit geänderter Sprache, 200 Folgen | 42.000 | 2.400 |
| erster Durchgang, 200 Folgen | 21.099 | 1.200 |
| Netflix, Stapel zu 10, Wiederholung, 70 Folgen | 497 | 216 |

Eine unveränderte Disney+-Folge kostet jetzt 4 Lesezeilen, unabhängig von der Seitengröße (vorher 2n). Die Gegenprobe (dieselben 52 Anfragen gegen den alten und den neuen Stand: Einzel, Stapel, Dubletten, NULL-Schlüssel, Seitenkennungen, Abhaken, A-B-A, Altbestand ohne Hash) liefert gleiche Antworten und gleiche gespeicherte Zeilen. Der Test in `tools/worker-tagesdeckel.test.ts` prüft den Plan (`SEARCH p USING INDEX pruefung_folge (url=? AND folge_nr=? AND staffel=? AND seiten_kennung=?)`) und dass die Abfrage bei einer Seite mit 200 Folgen genau die Zeile der Folge liefert.

**Kosten:** ein weiterer Indexeintrag je eingefügter und je gelöschter `pruefung`-Zeile; unveränderte Meldungen schreiben weiter 0. Einmalig kostet das Anlegen rund 18.000 geschriebene Zeilen (Stand 12.10.2026). `pruefung_url_zeit` bleibt (Serientitel, Zähler, Löschen lesen darüber).

**Ohne Index-Hinweis (Entscheidung 12.10.2026):** Ein `INDEXED BY pruefung_folge` ließ jede Meldung mit 500 scheitern, solange die Migration fehlt; es steht nicht in der Abfrage. Der Planer wählt den Index von selbst (vier Gleichheiten, `CROSS JOIN` setzt `json_each` nach außen): `EXPLAIN QUERY PLAN` der vollen Abfrage lautet `SCAN k VIRTUAL TABLE INDEX 1 ; SEARCH p USING INDEX pruefung_folge (url=? AND folge_nr=? AND staffel=? AND seiten_kennung=?)`, mit 17.800 Zeilen (89 Adressen zu 200 Folgen) ohne und mit `ANALYZE`; abgesichert in `tools/worker-tagesdeckel.test.ts` (`check:worker`). Grenze: Das ist SQLite lokal; ob D1 mit seiner Statistik dasselbe wählt, zeigt `rows_read` nach dem Deploy.

**Reihenfolge nach dem Merge (ausgeführt am 13.10.2026, Abschnitt „D1-Umbau eingespielt“):** erst Migration 053 remote empfohlen (`cd worker && npx wrangler d1 execute anime-kalender --remote --file=migrations/053-pruefung-folge-index.sql`, nach 00:00 UTC bzw. wenn das Konto wieder frei ist), dann `npx wrangler deploy --config wrangler.toml`. Zwingend ist sie nicht: Der neue Worker vor der Migration läuft, liest aber über `pruefung_url_zeit` wieder alle Zeilen der Adresse (n² wie vorher), statt Meldungen zu verlieren. Der alte Worker läuft nach der Migration unverändert weiter. Keine Erweiterungsänderung.

**Offen (nicht Teil dieses Umbaus):** Der Rest (4 Lesezeilen je unveränderter, rund 12 je geänderter Folge) wurde nicht weiter zerlegt.

## D1-Umbau Schritt B: Zuordnung und Urteile höchstens alle 6 Stunden holen (12.10.2026)

Entwurf `daniel-zum-abarbeiten/berichte/d1-umbau-entwurf-2026-10-12.md`, Maßnahme 2. `pipeline/fetch-folgen-zuordnung.ts` und `pipeline/fetch-urteile.ts` holen alle Beobachtungen aus D1 (rund 72.000 gelesene Zeilen je Bau, bis zu 40 Bauten am Tag) und überspringen den Abruf, wenn der letzte jünger als 6 Stunden ist (`pipeline/lib/abruf-stempel.ts`). **Der Zeitpunkt steht in `data/abruf-stempel.json`** (committet über `tools/quellen-liste.sh`), nicht in der Änderungszeit der Ergebnisdatei: Ein CI-Lauf checkt frisch aus, jede Datei wäre dort „gerade erzeugt"; die Ergebnisdateien selbst tragen keinen Erzeugungszeitpunkt. Gestempelt wird nur, wenn der Abruf die Ergebnisdatei wirklich geschrieben hat. **Erzwingen:** `npm run data:urteile -- --voll` bzw. `npm run data:folgen-zuordnung -- --voll`; `--aus <datei>` (Eingabe aus einer Datei) überspringt nie. Folge: Meldungen der Erweiterung wirken auf Urteile und Lückenschluss bis zu 6 Stunden später (das Einarbeiten in `dub-confirmed.yaml` bleibt sofort). Test: `pipeline/check-abruf-stempel.ts` in `check:logic`.

## D1-Umbau Schritt A: Export-Marke nur nach Änderung, längere Fristen (12.10.2026)

Entwurf `daniel-zum-abarbeiten/berichte/d1-umbau-entwurf-2026-10-12.md` (Maßnahmen 1, 4a, 7), nur Worker, keine Migration. **Marke:** `exporteVerwerfen` schreibt `export/_ungueltig` nur noch, wenn eine Meldung (`speicherePruefung`, über `beiZeilen` von `mitTagesdeckel`) oder ein Löschen (`geloescht > 0`) Zeilen geändert hat; Abhaken und Wiederöffnen setzen nur `export/_ungueltig-offen`, die allein `offen-*` beachtet (`alle-*`, `pruefung-alle-*`, `namen` enthalten `uebernommen` nicht). Jede Marke höchstens einmal in 60 s je Isolate; eine in dieser Zeit übersprungene Änderung erreicht den Bau erst mit der nächsten Marke (Restlücke: ein Auszug, der genau in diesem Fenster neu gerechnet wird). **Fristen:** Wartende und `?zaehlen=1` 7.200 s (vorher 1.800), `?stand=1` bleibt bei 300 s, `/lauf` 120 s (vorher 30). `site_history` wird nur um 03 UTC aufgeräumt. Test: `tools/worker-export-marke.test.ts`. Nachmessen am Folgetag: `wrangler d1 insights` (Aufbauten der Auszüge, Ziel 19 auf höchstens 9 am Durchgangstag).

## Beleg-Lesung stumm seit 08.10.2026: ein Anbieter beendete den ganzen Lauf (Wochenwache 12.10.2026)

`source-health` zeigte `beleg-lesungen` mit `lastCount 0` seit dem Lauf vom 08.10. 04:09 (letzter Erfolg, 32 gelesen). **Ursache bei uns:** Fünf Crunchyroll-Artikel („Aufnahme einfarbig") und drei Disney+-Seiten („kein Artikeltext, 0 Zeichen") scheitern auf dem Runner jeden Tag. Ein Fehlschlag rückt `zuletzt` nicht vor, die Adressen blieben also vorn in der Schlange (60 fällig, Limit 60), und drei Fehlschläge zählten für den ganzen Lauf — er endete nach acht Adressen, die übrigen 52 kamen nie dran (Läufe 09.–12.10., Logs `Belege: 0 gelesen`). Der Zähler wurde außerdem nach jedem Text zurückgesetzt, noch bevor das Bild gelang; die Crunchyroll-Fehlschläge zählten deshalb nie, erst die Disney+-Seiten dahinter erreichten die drei.
**Behoben:** `pipeline/lib/beleg-stoerung.ts` zählt je Anbieter und setzt erst nach einer gelesenen Adresse zurück; drei Fehlschläge in Folge lassen nur diesen Anbieter für den Lauf ruhen (`check-beleg-stoerung.ts`: gesunde Adressen hinter kaputten Anbietern werden gelesen, ein ruhender Anbieter wird nur dreimal gefragt). Die Fehlermeldungen nennen jetzt Endadresse und Seitentitel.
**Offen:** Warum die fünf Crunchyroll-Artikel und die Disney+-Seiten auf dem Runner nicht gelingen. Lokal (12.10.2026, eine Adresse, `--adresse`) las derselbe Crunchyroll-Artikel fehlerfrei. Verdacht: Sperrseite oder Verdunkelung für die Runner-Adresse. Die nächsten Läufe schreiben Endadresse und Titel ins Protokoll (`Beleg nicht gelesen: … (<URL> „<Titel>“)`); danach entscheiden. Kein Massenabruf, Disney+ wird nicht von Hand abgerufen.

## Beleg-Schlange: ungültige Adresse, ruhende Anbieter ohne Platz, Fehlschlag-Marke (12.10.2026)

Drei Restpunkte der Störungsregel (vorheriger Abschnitt). **Ungültige Adresse:** `new URL()` in `ruht`/`fehl` stand außerhalb des `try` und beendete den Lauf; `neueStoerungen` behandelt eine unlesbare Adresse jetzt als eigenen Anbieter (Fehlschlag nur dieser Adresse). **Plätze:** `warteschlange` wird ohne Obergrenze aufgerufen, die 60 Plätze (`--limit`) zählt `ohneRuhende` (`lib/beleg-stoerung.ts`) beim Abruf, und nur Versuche zählen — übersprungene Adressen ruhender Anbieter verbrauchen keinen Platz, gesunde rücken nach. **Fehlschlag-Marke:** `data/beleg-fehlschlaege.json` (`{ url: { am, anzahl } }`, Laufgedächtnis, in `tools/quellen-liste.sh`; bewusst nicht in `beleg-lesungen.json`, weil `belegeFuerAlle` einen Eintrag ohne Lesung als „geprüft am …" auslieferte). Eine gescheiterte Adresse steht hinter allen anderen, bis ihre Pause um ist (1, 2, 4, 8 Tage, höchstens 14: `lib/beleg-fehlschlag.ts`); eine gelesene Adresse löscht die Marke; fehlende Datei oder Marke = nie gescheitert (kein Migrationscode, das Format hat nur uns erreicht). Prüfung: `pipeline/check-beleg-stoerung.ts` (Teil von `check:logic`).

## Panel-Messung: fünf Schriftgrößen, Tippziele, Kontrast, Kopf (12.10.2026)

`node tools/panel-messen.mjs` (läuft in `npm run check:panel` nach `panel-bild.mjs`) öffnet das Panel in `dist/` für Jujutsu Kaisen (mit Banner), Rozen Maiden: Dreaming (ohne Banner) und sieben weitere Fälle (Flaggen, eigener Handlungstext, die Cartoons Jack und Om Nom mit gefalteten Wegen), Handy 393 px und Rechner-Schublade 512 px, hell und dunkel, und wird rot bei: einer sechsten Schriftgröße (erlaubt 24 · 18 · 15 · 13 · 11 px, Klassen `text-t1` bis `text-t5` in `styles.css`), einem Tippziel unter 44 × 44 (auch Textlinks), Textkontrast unter AA (außerhalb des Bildes), einem zweiten Knopf im Bild (nur ✕), falschen Flaggen (`detail/flaggen.tsx`: Wertung und Quelle eine Flagge, MAL nur mit Kennung, Cartoon „TMDB“, bündig rechts), falschen Maßen von Banner und Posterkarte oder mehr als einem Element mit `filter`/`backdrop-filter` (nur der Rückfall ohne Banner darf unscharf sein) — und seit 16.10.2026 bei **verdeckt** (Trefferprobe `trefferprobe()` über das ganze Panel, dazu `flaggenOhneLink()`/`totesBanner()` in `panel-messen-browser.mjs`, laufen zuletzt, weil sie scrollen; die Trefferprobe läuft zusätzlich bei 360 px): ein Bedienelement (Link, Knopf, `role=button`, Eingabe, `summary`) im Panel, das an seiner Mitte nicht selbst oben liegt, eine Flagge mit Pfeil ohne Link, ein Rasterpunkt im Banner oder die Posterkarte unter dem Namensblock (`data-kopfblock`, `pointer-events-none`). `--docs --echte-bilder` (`npm run panel:bilder`) schreibt `docs/panel-kopf-*.png` mit echten Covern; `--breit` prüft rund 60 Titel quer durch den Bestand (12.10.2026: 0 Verstöße); `--zeit` misst die Öffnungszeit (Median von 7, CPU 4-fach gedrosselt, `--dist` für den Vorher-Stand). Gemessen am 12.10.2026: Öffnen vorher/nachher 163/146 ms (Jujutsu Kaisen) und 138/135 ms (Rozen Maiden) — gleich im Rauschen; die Rasterkosten der Unschärfe auf echter GPU misst das nicht, daher Stichprobe am Poco M7 Pro nach dem Live-Gang.

## Tests mit Bash-Hülle im losgelösten Lauf (12.10.2026)

`prozess-register.mjs` öffnete das Log bis 12.10.2026 21:10 mit `'a'` (Anhängemodus), seitdem mit `'w'`; die Hüllen-Absicherung bleibt für jeden anderen Elternprozess mit Anhänge-Handle. Ein davon geerbtes Handle kann `bash.exe` (MSYS) nicht beschreiben: Exit 1 ohne ein Zeichen Ausgabe, schon bei `bash -c 'echo hi'` (mit `'w'` oder `'r+'` Exit 0; Lauf `flag.mjs`). Darum war `bau-schon-gebaut.test.mjs` (und gleich gebaut `commit-data.test.mjs`) nur im losgelösten `check:vor-commit` rot. Die Hüllen reichen die Ausgabe jetzt über Pipes weiter; `tools/bash-an-angehaengtes-log.test.mjs` startet beide mit Anhänge-Log. Vor der Umstellung scheiterte schon `bash skript.sh` als Befehl für `prozess-register.mjs` (dessen `echo` schlug fehl, Exit 1 trotz grüner Schritte).

## D1-Umbau eingespielt: 051, 052 und 053 am 13.10.2026

Bericht: `daniel-zum-abarbeiten/berichte/d1-umbau-einspielen-2026-10-13.md`. Migration 050 lief schon früher per `d1 execute --file`, nicht per `migrations apply`; `d1_migrations` endete deshalb bei 049, und `migrations apply` wäre an 050 (doppelte Spalte `hash`) gescheitert.

- **052** (Spalte `schreib_tag.gelesen`) am 13.10.2026 12:33 MESZ per `execute --remote --file`: 54 gelesen, 1 geschrieben. Spalte per `pragma_table_info` bestätigt.
- **051** (Teilindex `prime_folge_offen (id) WHERE uebernommen = 0`) direkt danach: 61.501 gelesen, 18.194 geschrieben. `sqlite_master` zeigt den neuen Index.
- **`d1_migrations`** für 050, 051, 052 nachgetragen (`INSERT (name, applied_at)`, 7 geschriebene Zeilen); `migrations list --remote` nannte danach nur noch 053.
- **Worker** am selben Tag von dort deployt (`cd worker && npx wrangler deploy --config wrangler.toml`); `/health` antwortet 200, `wrangler tail` (60 s) ohne Fehler.
- **053** (Index `pruefung_folge`) am 13.10.2026 13:16 MESZ per `execute --remote --file` (Daniel: „mach 053“, Durchgänge an dem Tag kurz gehalten): 41.809 gelesen, 20.545 geschrieben, also wie geschätzt eine Schreibzeile je `pruefung`-Zeile und nicht doppelt. `d1_migrations` um 053 ergänzt (`INSERT (name)`), `migrations list --remote --config wrangler.toml` meldet „No migrations to apply“. Ohne `--config` sucht `migrations list` eine `wrangler.jsonc` und findet die Datenbank nicht.
- **Messfenster (überholt am 14.10.2026):** `d1-verbrauch.mjs` rechnete bis dahin gleitende 24 Stunden und summierte nur die 5 größten Abfragen; seit dem 14.10.2026 gilt der UTC-Tag, siehe den Abschnitt „D1-Verbrauchsmessung“ unten (13.10.2026 10:33Z vor den Migrationen: 508.442 gelesen, 5.547 geschrieben).

## D1-Verbrauchsmessung: UTC-Tag, Insights-Lücke, Zeilen je Meldung, Index auf `prime_folge.url` (14.10.2026)

Quelle: Bericht `daniel-zum-abarbeiten/berichte/durchgaenge-2026-10-13.md`, Abschnitt „Fix nötig“ (3 und 4).

- **Fenster:** `tools/d1-verbrauch.mjs` misst den UTC-Tag seit 00:00 UTC (`--time-period <Minuten>m`, `utcTagMinuten` in `tools/d1-verbrauch-bewertung.mjs`). Wrangler filtert `datetimeHour_geq`, also nach Stunden-Buckets; die Startzeit liegt 5 bis 6 Minuten vor Mitternacht, damit der Bucket 00:00 sicher mitzählt und der von 23:00 des Vortags nie (Test bildet die Buckets für jeden Zeitpunkt des Tages nach, auch mit 4 Minuten Verzug von Wrangler). Die frühere Anleitung `<Stunden + 1>h` nahm bis zu zwei Stunden Vortag mit. `--zeitraum 1d` bleibt das gleitende Fenster. Summiert werden bis zu 1000 Abfragegruppen (`--limit 1000`) statt der 5 bzw. 30 größten; bei 1000 Gruppen steht eine Warnzeile („untere Schranke“). **Folge:** Der tägliche Lauf um 07:50 UTC sieht damit nur die ersten acht Stunden des Tages; Spitzen vom Vorabend zeigt `--zeitraum 1d` oder `d1 info`.
- **Lücke:** `d1 insights` (`d1QueriesAdaptiveGroups`) zeigt weder Migrations-DDL noch `d1 execute --file`. Gemessen am 14.10.2026 um 10:04 UTC: Insights der letzten 24 h 4.122.366 gelesen und 63.932 geschrieben, `d1 info` (gleitend 24 h) 12.352.191 und 87.116; unsichtbar sind also rund 8,2 Mio. gelesene und 23.000 geschriebene Zeilen (das Einspielen von 055 las laut `meta.rows_read` 9,1 Mio.). Der Lauf gibt die `d1 info`-Zahlen aus (ein Token nur mit Analytics-Recht kann sie nicht lesen, dann steht „nicht lesbar“), warnt, wenn sie die Schwellen der Insights übersteigen (2,5 Mio. gelesen, 50.000 geschrieben; das Lesen des Einspielens fehlt in den Insights ganz, die Insights-Schwelle allein hätte es nicht gesehen), und rechnet mit `--ddl <Zeilen>` die Schreibzeilen heute eingespielter Migrationen zu den Insights. Die Warnschwelle (50.000) plus die gemessene Lücke (13.10.2026: 38.747) bleibt unter dem Schreib-Kontingent (Test).
- **Zeilen je Meldung** (ersetzt „rund 14“; Insights vom 13.10.2026): 48 geschriebene und 49 gelesene je Anfrage der Meldungs-Route, 11 je Netflix-/Disney+-Folge, 5 je Prime-Rohfolge. Die Annahme „Altbestand wird ersetzt“ (Obergrenze 55.000 im Abschnitt über den Hash der Rohfolgen) traf nur zu etwa 4 % zu; der Rest waren neue Schlüssel (Neubefüllung).
- **Index `prime_folge (url, plattform)`: nein.** Einziger Leser nach `url` ohne Seiten-/`gti`-Index ist `hatAltzeilen` (`worker/src/titelzeile-speichern.ts`) für Titel ohne Titelzeile und ohne Treffer in `pruefung`. Lokal gemessen (workerd, `prime_folge` 55.000 und `pruefung` 17.800 Zeilen): Abfrage für einen neuen Titel 55.000 gelesene Zeilen ohne Index, 0 mit; Treffer 238 gegen 1; eine eingefügte Rohfolge 5 gegen 6 geschriebene Zeilen. Ein Prime-Durchgang (rund 11.000 Rohfolgen) kostete damit 11.000 Schreibzeilen mehr, rund ein Fünftel des Tagesdeckels; gespart würden 55.000 Lesezeilen je Disney+-Titel ohne Titelzeile, und die Abfrage läuft nur bis dessen erste Meldung die Titelzeile angelegt hat, also einmal je neuem Titel. Migration 047 entfernte `prime_folge_url` am 11.10.2026 aus demselben Grund. Die 49.794 Zeilen vom 13.10. waren eine einzelne Auswertungsabfrage, kein Leser des Betriebs. Mit der Titelzeile abgeglichen (055 liegt auf main): Die Altzeilen von Disney+ dürfen frühestens ab 20.10.2026 gelöscht werden; danach brauchte `hatAltzeilen` den `prime_folge`-Teil für Disney+ nicht mehr (Vorschlag, nicht gebaut).
- **Wie Cloudflare das Kontingent zählt:** Die Doku (developers.cloudflare.com/d1/platform/pricing, abgerufen 14.10.2026) nennt 5 Mio. gelesene und 100.000 geschriebene Zeilen je Konto und Tag, Reset 00:00 UTC; DDL könne „a mix of read rows and write rows“ zählen; wer das Limit erreicht, kann keine Abfragen mehr ausführen. Zum Zeitpunkt der Sperre steht dort nichts. Beobachtet: 11.10.2026 Überschreitung 18:00 bis 18:05 UTC (GraphQL, kumuliert), gesperrt gemessen 18:35 UTC (Code 7500), das Schreib-Limit wurde dagegen nicht erzwungen. Am 14.10.2026 las das Einspielen von 055 um 09:30 UTC (11:30 MESZ) 9,1 Mio. Zeilen; der Worker antwortete um 09:44 UTC noch mit 200, spätestens ab 10:16 UTC mit HTTP 500 „exceeded D1's free tier daily row read limit“ bis 00:00 UTC (`d1 info` 10:15 UTC: 12.352.431 in 24 h). **Die Sperre greift also verzögert, um mindestens eine Viertelstunde, und zählt `execute --file` mit.** Deshalb warnt der Lauf auch nach `d1 info` schon ab 2,5 Mio. gelesenen bzw. 50.000 geschriebenen Zeilen in 24 h (dieselben Schwellen wie bei den Insights), nicht erst bei den Kontingenten. Der Worker-Endpunkt `/lauf` liefert während der Sperre ebenfalls 500.

## Beleg-Schlange: nie gelesene Artikel zuerst, nur die jüngste Lesung zählt (14.10.2026)

Daniel (13.10.): Die beiden Quellenbelege am Avatar-Termin (16.10., Folgen 4–6) zeigten kein Bild. **Ursache:** Die vier Anime2You-Artikel (1034331, 1048545, 1059426, 1059483) standen seit 11.10. in `releases.json`, waren aber nie gelesen (kein Eintrag in `data/beleg-lesungen.json`). `warteschlange` sortierte nach Dringlichkeit vor „nie gelesen“: 238 Neuaufnahmen alter Bilder (Fassung 1, seit 07.10.) standen davor, die vier auf Platz 253–256 von 288, das Limit ist 60 je Lauf. Dazu hielt `bildOhnePruefung` 66 Artikel für immer vorn, weil neben ihrer neuen Lesung (Fassung 2) die ältere in Fassung 1 stehen blieb. **Betroffen (13.10., Bestand):** 80 Termine, 74 Titel mit mindestens einem lesbaren Artikel ohne Bild, alle wegen „nie gelesen“ (49 Adressen, 44 Anime2You, 2 ADN, je 1 Kinoheld, Wikipedia, Disney+). **Behoben:** `dringlichkeit` stellt nie gelesene Adressen an die Spitze, `bildOhnePruefung` prüft nur die jüngste Lesung; `pipeline/check-beleg-reihenfolge.ts` (in `check:vor-commit`) rechnet beides nach, auch „spätestens im nächsten Lauf“. Mit den echten Daten rücken die vier Avatar-Artikel auf Platz 15–18 von 222. Das Bild entsteht mit dem nächsten Lauf von `refresh-data.yml` (Schritt „Belege lesen“, `npx tsx pipeline/belege-lesen.ts`), der Wecker startet ihn täglich gegen 04:00. Adressen, deren jüngste Lesung kein Bild hat (14.10.2026: 5, alle Crunchyroll), werden erst nach 7 Tagen erneut gelesen (Prüfer 1152). `check-beleg-stoerung.ts` läuft über `tools/check-logic-liste.txt` (`check:logic`), keine Waise. **Gemessen 14.10.2026 nach dem Tageslauf (04:00):** alle vier Avatar-Artikel haben ein Bild; von den 163 Artikeln mit offenem Termin sind noch 6 nie gelesen (vorher 49).

## Netflix und Disney+: die Rohfolge steht in der Meldungszeile (Migration 054, 13.10.2026)

- **Vorher:** Eine Folge dieser Anbieter schrieb zwei Zeilen (`pruefung` 6 + `prime_folge` 5 D1-Zeilen mit Tabelle, `sqlite_sequence`, Indexen) mit denselben Angaben; am 13.10. rund 8.630 Zeilen des Tages. **Jetzt:** `pruefung.rohfolge` trägt die eine Rohfolge als JSON (Felder wie die Spalten von `prime_folge`), `roh_uebernommen` ist das Abhaken für den Zuordner (0 offen, 1 erledigt, NULL keine Rohfolge). Gemessen lokal in workerd (`tools/worker-schreibzeilen-messen.ts`, 13.10.2026): erste Netflix-Folge 12 auf 7 geschriebene Zeilen (6 Meldung + 1 Tageszähler); gleiche Meldung nachher unverändert 1, wie zuvor.
- **Was in `prime_folge` bleibt:** Prime (mehrere Rohfolgen je Seite), jede Meldung mit null oder mehr als einer Rohfolge, alle Altzeilen. `rohfolgen-seiten.ts` liefert beide Quellen in einer Reihe: erst `prime_folge`, dann die Spalte mit Ids ab 1.000.000.000 + `pruefung.id`; `nach`/`weiter` bleiben eine Zahl, das Abhaken (`rohfolgen-abhaken.ts`) erkennt am Id-Bereich die Tabelle. Die Pipeline-Leser (`fetch-rohfolgen.ts`, `fetch-folgen-zuordnung.ts`, `fetch-urteile.ts`) geben Ids nur zurück und brauchen keine Änderung; `tools/worker-rohfolge-spalte.test.ts` weist nach, dass beide Ablageformen Feld für Feld dieselben Zeilen liefern.
- **Folgen:** (1) Das Löschen einer Meldung (`DELETE /pruefung`) nimmt jetzt ihre Rohfolge mit; bisher blieb sie in `prime_folge`. (2) Der offene Auszug liest `pruefung` ohne Index (`roh_uebernommen = 0`): bis zu rund 25.000 Lesezeilen je ungepufferten Abruf (R2, 10 Minuten), kein Schreibzeilenpreis. Ein Teilindex würde 1 Schreibzeile je Folge kosten. (3) **Reihenfolge beim Einspielen:** erst Migration 054, dann Worker deployen — ohne die Spalten scheitert jedes `INSERT INTO pruefung`.
- **Nur Neues für den Zuordner (Prüfer-Befund, 13.10.2026):** Wechselt bei einer übernommenen Meldung nur die Notiz, entsteht eine neue `pruefung`-Zeile; ihre Rohfolge trägt sie nur, wenn der Zuordner sie noch nicht kennt (`rohfolgeFuerZeile` in `worker/src/pruefung-rohfolge-spalte.ts`): eine ersetzte offene Zeile mit gleicher Rohfolge vererbt ihren Abhak-Stand, sonst entscheidet die jüngste übernommene Zeile mit Rohfolge (gleich: `NULL`, anders oder A-B-A: offen). So gibt es wie bei `prime_folge` keine Dubletten in `?alle=1` und keine erneute Zuordnung.
- **Einmaliger Übergang (Prüfer, 13.10.2026):** Hat eine Folge nur eine Altzeile in `prime_folge` (vor Migration 054), kennt `rohfolgeFuerZeile` deren Rohfolge nicht. Die erste Meldung danach trägt sie deshalb noch einmal in der Spalte: `?alle=1` führt diese eine Rohfolge einmal doppelt (alt in `prime_folge`, neu in `pruefung`), und der Zuordner holt sie einmal erneut. Danach gilt der Vergleich mit der Spalte, es entstehen keine weiteren Dubletten. Die Zuordnung nimmt je `gti` die jüngste, das Ergebnis bleibt gleich; die Doppelten verschwinden mit dem Löschen der Altzeilen. `?probe=<Anbieter>` liest seit demselben Tag beide Quellen (`worker/src/rohfolgen-probe.ts`, Ids der Spalte ab 1.000.000.000).

## Titelzeile: eine D1-Zeile je Titel (Pilot Disney+, Migration 055, 13.10.2026)

- **Was:** `titel_zeile` (`WITHOUT ROWID`, Schlüssel `(url, plattform)`) trägt alle Folgen eines Titels als JSON in einer Zeile (Staffelstruktur, Titel, Serientitel einmal im Kopf; je Folge ein Feld ohne Schlüsselnamen, Reihenfolge in `worker/src/titelzeile-format.ts`). Der Worker liest die Zeile, setzt die Folge ein und schreibt nur bei Änderung zurück: `UPDATE … WHERE version = ?`, bei Zusammenstoß (Disney+ meldet mit drei Bahnen) neu lesen und wiederholen, nach 6 Versuchen 503. Das Format ist nicht komprimiert: D1 rechnet nach Zeilen, und die Sicht `pruefung_titel` liest den Text mit `json_each`. Größter Titel (405 Folgen, 21 Staffeln): 42 KB (Grenze 2 MB), Rechenzeit lesen + einsetzen + schreiben im Mittel 0,44 ms in Node 24 (Free-Plan: 10 ms), erster Aufruf nach dem Start bis 5 ms.
- **Schalter:** `TITELZEILE_PLATTFORMEN` in `worker/wrangler.toml` (leer = aus). Nur Adressen, die schon eine Titelzeile haben oder noch gar keine Meldung, gehen hierher; Adressen mit Altzeilen bleiben bei `pruefung`/`prime_folge`, bis das Einspielen (`tools/worker-titelzeile-einspielen.ts`) sie umgezogen hat (sonst verdrängte die erste Titelzeile ihre Altzeilen aus den Lesern). Einspielen: erst Migration 055, dann Worker mit `TITELZEILE_PLATTFORMEN = "disneyplus"`, dann bei angehaltenem Disney+-Durchgang das Einspiel-SQL (am 14.10.2026, seither ersetzt). **Die erste Fassung las an der echten D1 9,1 Mio. Zeilen** (14.10.2026, vorher geschätzt: 50.000) und sperrte das Konto bis 00:00 UTC; neuer Weg und Ablauf je Anbieter im nächsten Abschnitt.
- **Gemessen** (lokal in workerd, `tools/worker-schreibzeilen-messen.ts` mit `SZENARIO=disney`, Disney+-Titel mit 41 Folgen, eine Anfrage je Folge, `meta.rows_written` samt Indexen und Tageszähler): erster Durchgang vorher 492 (12 je Folge), mit PR 1150 287 (7), mit Titelzeile 83 (2,0); Durchgang mit einer geänderten Folge 54 / 48 / 42; unveränderter Durchgang je 41 (nur der Tageszähler). Abhaken der 41 Meldungen 82 auf 1.
- **Lesen:** `json_each` zählt in D1 (lokal gemessen) jede erzeugte Folge als gelesene Zeile; eine Abfrage über die Sicht liest so viele Zeilen wie Folgen, bei `ORDER BY` etwa doppelt. Deshalb: `?gemeldet=` liest den Titel als Ganzes (1 statt 82 Zeilen), offene Auszüge überspringen Titel ohne offene Folgen (`offen_meldung`, `offen_rohfolge`, vom Worker bei jedem Schreiben gezählt), Auszüge mit Zeitgrenze überspringen unveränderte Titel. Die vollständigen Auszüge für den Bau (`?alle=1`, Rohfolgen `&alle=1`) lesen weiter alle Folgen (beim Bau 2n statt n).
- **`gemeldet_am` ist die jüngste Meldung, nicht das letzte Schreiben (17.10.2026):** Abhaken schrieb „jetzt“ in jeden abgehakten Titel; `staffelnSeit` (`?stand=1`) packte danach jeden davon mit `json_each` aus (Ø 13.268 Lesezeilen je Aufruf, 60 % des Verbrauchs am 16.10.). Seitdem setzt der Worker `juengsteMeldung` (`titelzeile-format.ts`), wie `pruefung`, wo Abhaken `gemeldet_am` nie anfasst. Lokal in workerd (`tools/worker-staffeln-seit-messen.ts`, 812 Titel, 27.736 Folgen, 400 nach dem Prüfstand abgehakt): `staffelnSeit` 14.464 → 1.086, `?stand=1` ohne Cache 15.276 → 1.898. Sockel: ein Durchlauf über alle Titelzeilen (812). `?zaehlen=1` führt abgehakte Titel seitdem nicht mehr als gemeldet.
- **Ids:** Folgen aus Titelzeilen haben Ids ab 2.000.000.000 (`+ nr · 10^10 + fassung · 10^8 + staffel · 10^5 + nummer`); `fassung` zählt inhaltliche Änderungen, damit eine vor der Änderung geholte Id die geänderte Folge nicht abhakt (bei `pruefung` ist das eine neue Zeile mit neuer Id).
- **Folgen und Grenzen:** (1) Der Verlauf einer Folge (A, B, A) bleibt nicht als Zeilen erhalten; der Eintrag trägt den jüngsten Stand. (2) Ändert sich die Staffelstruktur eines Titels, öffnet das keine Folge mehr (bisher stand sie in jeder Zeile und änderte deren Hash). (3) Unveränderte Wiederholungen schreiben nichts, außer die Regeln aus `pruefung-unveraendert.ts` verlangen ein neues `gemeldet_am` (Listenbau, neuer Tag): dann eine Zeile je Titel statt je Folge. (4) Das Einspielen und ein Durchgang währenddessen: eine Meldung, die vor dem Einspielen den alten Weg ging und danach schreibt, landet in `pruefung`; die Leser überspringen sie, bis ein Nachzügler-Lauf (Schritt 5 unten) sie über der Marke liest und in die Titelzeile einführt. (5) `?probe=` liest weiter nur `prime_folge`. **Befristung:** frühestens ab 20.10.2026, wenn alle Disney+-Adressen eine Titelzeile haben und ein Bau fehlerfrei lief, können die Disney+-Altzeilen aus `pruefung` und `prime_folge` gelöscht werden (in Blöcken unter dem Tagesdeckel); dann entfällt `url NOT IN (SELECT url FROM titel_zeile)` in den Lesern.
- **Ausgerollt 14.10.2026:** Migration 055 um 11:23, Worker mit `TITELZEILE_PLATTFORMEN = "disneyplus"` um 11:29, Einspiel-SQL um 11:30 (215 Titelzeilen). Verlustabfrage danach: 0 Folgen aus `pruefung` und 0 Rohfolgen aus `prime_folge` fehlen in `pruefung_titel`, 0 Disney+-Adressen ohne Titelzeile; offene Meldungen 6.355 wie im Altbestand. **Das Einspielen las 9,1 Mio. Zeilen statt der geschätzten 50.000** — mehr als das Tageskontingent: `je_titel` fragt die CTE `folgen` je Adresse dreimal ab, und SQLite rechnet sie samt `prime_folge`-Durchlauf jedes Mal neu. **Prüffrage vor jeder einmaligen SQL gegen die echte D1:** lokal mit einer Kopie in Produktionsgröße `meta.rows_read` messen, nicht aus den Tabellengrößen schätzen; korrelierte Unterabfragen auf CTEs vervielfachen die CTE. Kleiner Probelauf mit `LIMIT` auf die Adressen zeigt es vorher.

## D1-Schutz: Plan-Tor und Tagesbudget vor `--remote` (14.10.2026)

Anlass: das Einspiel-SQL der Titelzeile (Abschnitt davor) las 9,13 Mio. Zeilen, die D1 war bis 00:00 UTC gesperrt. Seitdem gibt es einen Hook für den Agentenrechner, der Bash-Befehle mit `wrangler d1 execute|export|migrations apply` und `--remote` oder `--preview` prüft. **Stand 14.10.2026 ist er noch nicht eingehängt** (weder in `dispatch-pretooluse.js` noch in `settings.json`); das macht der Dirigent nach dem Prüfer-Ok. Er schützt vor Versehen eines Agenten, nicht vor Absicht. Erkannt werden auch: Flaggen vor `d1` (`wrangler --config x d1 …`, `-c`, `--remote` und `--remote=true`; `--remote=false` gilt als lokal), Quotes und Backslashes im Wort (`d""1`, `--rem''ote`, `\-\-remote`), `npx`, `wrangler.cmd`, `env`, Subshell, `--file`, `bash|sh -…c [--]` (etwa `-lc`, `-ec`), `cmd //c`, `bash <<EOF` (geprüft wird der Heredoc-Inhalt), `bash <<< "…"` und `npm run <skript>` (Skripttext samt `pre`/`post`, bis Tiefe 5). Mehrere `--command`- oder `--file`-Werte werden alle geprüft. Nicht auswertbar und deshalb gesperrt: `$VAR` oder `$'…'` irgendwo im d1-Aufruf, `$(…)`, Backtick, `eval`, `xargs`, Shell über stdin (`… | bash`, `bash /dev/stdin`) und `--file` mit relativem Pfad nach `cd "$VAR"`. Ein `$` zählt nur vor einem Variablenzeichen (Buchstabe, Ziffer, `_`, `{`, `(`, `@`, `*`, `#`, `?`, `!`, `$`, `-`); `'$.titel'` in SQL ist wörtlich. Steht wörtlich `--local` und keine Form von `--remote` im selben Befehl, bleibt der Aufruf auch mit `$` frei: wrangler 4.120 bricht bei `--local` und `--remote` zugleich ab (execute, export, migrations apply), `--preview` braucht `--remote`. Frei bleibt wrangler-Text als Argument von `echo`, `printf` oder `grep` (auch hinter `xargs`), solange kein Backtick im Befehl steht. Er liegt nicht im Repo: `~/.claude/hooks/d1-sperre.js` (Test `d1-sperre-test.mjs`: bei PR-Öffnung 90 Fälle, nach der ersten Prüferrunde 170, nach der zweiten 242, nach der dritten 299, am 20.10.2026 nach der Commit-Text-Änderung 336; jede Prüferprobe vom 14.10.2026 ist ein Fall, jede Sperrregel hat einen Gegenfall „lokal, sonst gleich“), Werkzeuge unter `C:/code/ai/__assets/tools/d1-schutz/`, Bedienung und Fallstricke in `ai helper files/ai_agent_tools.md`. **Commit-Nachrichten und Heredocs (20.10.2026):** Text, den ein Befehl nur als Daten weitergibt (`git commit -m "…"`, `-F - <<'EOF'`, `gh pr create --body "$(cat <<'EOF' … EOF)"`, `cat > datei <<'EOF'`), ist kein Aufruf; ein Anführungszeichen, Apostroph oder `)` im Nachrichtentext löste vorher einen Fehlalarm aus, weil der Hook `"$(cat <<'EOF' …)"` nicht als Einheit las. Was die Shell dabei ausführt, wird dagegen als eigener Befehlstext geprüft: `$(…)` und Backticks in doppelten Anführungszeichen (auch in `echo`), `$(…)` und Backticks in einem Heredoc ohne Quotes an der Endmarke (`<<EOF`; bei `<<'EOF'` ist der Inhalt wörtlich), dazu wie bisher `| bash`, `bash -c`, `eval`, `xargs`, `sh <<EOF`. Ein Backtick-Wort wie `` `wrangler d1 execute … --remote $G` `` in einer Commit-Nachricht wird also gesperrt, weil die Shell es ausführt (Nachricht mit einfachen Anführungszeichen oder `<<'EOF'` schreiben). Mehr als fünf ineinander verschachtelte `$(…)` gelten als nicht auswertbar. **Lokale Aufrufe:** gemeint ist ein wörtliches `--local` ohne `--remote` im selben Befehl; ein Aufruf ganz ohne Flagge (`wrangler d1 execute DB --command "$X"`) wird mit `$` gesperrt und ohne `$` nicht geprüft.

- **Plan-Tor (`plan-tor.mjs`):** `EXPLAIN QUERY PLAN` gegen eine leere Datenbank aus `worker/schema.sql` und `worker/migrations/*.sql`, ohne Netz. Geschätzt wird je Anweisung: Volldurchläufe derselben Schleifenebene multiplizieren sich, Ebenen addieren sich, Sortieren oder Gruppieren über eine Zwischentabelle zählt doppelt. Tabellengrößen kommen aus `sqlite_sequence` (`groessen.mjs`, höchste Id, gilt 7 Tage); Tabellen ohne Eintrag (`WITHOUT ROWID` wie `titel_zeile`) gelten als unbekannt groß; eine Liste mit negativer oder nicht-numerischer Größe gilt als Ganzes nicht. Als Schlüsselzugriff (klein) zählt nur `SEARCH` mit Gleichheit auf allen Spalten eines eindeutigen Schlüssels (`rowid`, Primärschlüssel, `UNIQUE`-Index); Bereich (`id > 0`) und nicht eindeutiger Index zählen wie ein Volldurchlauf (mehr Fehlalarme, dann Freigabe). `UPDATE`/`DELETE` mit Bereichs-`WHERE` und `INSERT … SELECT` schreiben so viele Zeilen, wie die Schätzung liest. **Gesperrt:** Schätzung über 100.000 Zeilen je Anweisung, `AUTOMATIC INDEX`, korrelierte Unterabfrage, `UPDATE`/`DELETE` ohne `WHERE`, `CREATE INDEX` auf einer Tabelle über 5.000 Zeilen, mehr als 500 `VALUES`-Zeilen, Wartung (`ANALYZE`, `REINDEX`, jedes `PRAGMA` außer den Schemaabfragen `table_info`, `table_list`, `index_list`, `index_info`, `foreign_key_list` ohne Schema-Präfix, also auch `PRAGMA main.…`, und jede `pragma_*`-Tabellenfunktion außer denselben fünf), rekursive CTE mit Zugriff auf eine echte Tabelle (Zeilenzahl unbekannt), `d1 export --remote` und `migrations apply --remote` immer.
- **Tagesbudget (`verbrauch.mjs`):** Tagesverbrauch seit 00:00 UTC aus `wrangler d1 insights` (kostet kein Kontingent, gilt 30 min). Gesperrt ist, was danach über 3 Mio. gelesenen oder 60.000 geschriebenen Zeilen läge (60 % der freien Stufe). Ohne Messung frei sind nur Lesungen mit einer Schätzung bis 5.000 Zeilen (Schlüsselzugriff, kleine Tabellen). Am 14.10.2026 standen 3.394.693 gelesene Zeilen: bis 00:00 UTC blieben damit nur diese kleinen Lesungen frei.
- **Freigabe:** schreibt nur der Dirigent in `~/.claude/hooks/state/d1-freigaben.json`: `{ hash, begruendung, gelesen, geschrieben, erteilt }`. Der Hash ist SHA-256 des `--command`-Texts bzw. des Dateiinhalts, mehrere Werte mit `;` und Zeilenumbruch verbunden (jede Änderung braucht eine neue Freigabe), die Sperrmeldung nennt ihn; gültig 24 h. Die Hochrechnung kommt aus `messe.mjs` (lokal gemessene `rows_read` an einer Kopie in Produktionsgröße) mal 6, dem Abstand lokal zu remote beim Einspielen (1,48 gegen 9,13 Mio.). Auch Freigegebenes durchläuft die Budgetsperre.
- **Migrationen:** einzeln mit `d1 execute --remote --file worker/migrations/<datei>.sql` einspielen, danach `INSERT INTO d1_migrations (name) VALUES ('<datei>.sql')`. Am Hook gemessen: 051 und 053 gesperrt (`CREATE INDEX` auf `prime_folge` bzw. `pruefung`), 055 gesperrt (Index auf `titel_zeile`, Größe unbekannt), 054 frei (zwei neue Spalten).
- **Ansätze, gemessen am 14.10.2026:** 22 Fälle (17 Abfragen von Schlüsselzugriff bis korrelierter Zählung, Migrationen 051, 053, 054, 055, alte Einspiel-SQL). Gelesene Zeilen lokal an einer Kopie der Testdatenbank (`prime_folge` 62.208, `pruefung` 32.416); „teuer“ heißt über 100.000. Fehlalarm = gesperrt, aber nicht teuer; Durchlass = frei, aber teuer.
  - **Untergrenze** (Plan-Tor ohne Größenliste, jeder Volldurchlauf sperrt): 13 Fehlalarme, 0 Durchlässe.
  - **A** (Plan-Tor mit Größenliste): 4 Fehlalarme, 0 Durchlässe. Ohne den Faktor für Zwischentabellen waren es 2 Durchlässe (`ORDER BY` und `GROUP BY` über `prime_folge` lasen 124.416 = 2 × 62.208). Die 4 Fehlalarme sind die Pflichtsperren: Migrationen 051, 053, 055 und die Einspiel-SQL, die an der Testkopie wenig lasen (Einspiel-SQL 98.643, an der echten D1 9,13 Mio.; 053/055 lasen 0, weil Index und Tabelle dort schon bestanden).
  - **A+C** (mit Budget): bei 0,5 Mio. Tagesverbrauch wie A; bei 3,39 Mio. 15 Sperren ohne teuren Fall, gewollt, frei bleiben nur kleine Lesungen.
  - **B** (vor jedem Aufruf lokal messen statt schätzen, nicht gebaut): `messe.mjs` braucht 0,85 bis 0,94 s je Aufruf an einer 35-MB-Kopie, dazu eine aktuelle Kopie in Produktionsgröße (`d1 export` liest dafür jede Zeile), und bleibt eine Untergrenze (Faktor 6).
  - **Laufzeit und Umfang** (Hook als eigener Prozess über stdin, je Art 15 Läufe, Median und Spanne, zwei Durchgänge; Messskript `d1-schutz/laufzeit.mjs`): nach der ersten Prüferrunde (14.10.2026) ohne `d1`/`npm` 41–44 ms (40–66), `npm run` ohne D1-Aufruf 43–47 ms (41–69), `npm run` mit D1-Aufruf 71–72 ms (69–84), `wrangler … --remote` 69 ms (67–73), `bash -lc` mit D1-Aufruf 71–74 ms (69–102); Code damals `d1-schutz/` 497 Zeilen, Hook 244, Test 270. Nach der zweiten Prüferrunde (14.10.2026, gleiche Messung): ohne `d1`/`npm` 38–39 ms (37–42), `npm run` ohne D1-Aufruf 39–40 ms (38–41), `npm run` mit D1-Aufruf 66 ms (65–70), `wrangler … --remote` 64 ms (62–68), `bash -lc` mit D1-Aufruf 64 ms (62–66); Code `d1-schutz/` 513 Zeilen ohne Messskript, Hook 283, Test 360. Nach der dritten Prüferrunde (14.10.2026, ein Durchgang): ohne `d1`/`npm` 40 ms (38–43), `npm run` ohne D1-Aufruf 41 ms (39–43), `npm run` mit D1-Aufruf 68 ms (65–71), `wrangler … --remote` 67 ms (64–81), `bash -lc` mit D1-Aufruf 72 ms (67–79); Hook 300, Test 425.
- **Mutationsprobe** (`mutationsprobe.mjs`, 111 Mutationen in fünf Dateien): alle bis auf zwei gleichwertige vom Test entdeckt (`.sort()` auf `readdirSync`, das unter NTFS schon sortiert liefert; `while` statt `if` beim Überspringen von `<<<`). Ein dritter Überlebender, der Herestring-Wächter, war überflüssig und ist gestrichen. Nach dem Lückenschluss 59 weitere Mutationen an den neuen Stellen (Hook 30, `plan-tor.mjs` 25, `zustand.mjs` 3, `urteil.mjs` 1): alle rot. Nach der zweiten Prüferrunde 49 weitere (Hook 34, `plan-tor.mjs` 15): 45 sofort rot, vier überlebten und bekamen je einen Testfall (Herestring-Marke über das Wort hinaus, `wrangler.cmd --remote d1`, Sperrgrund `PRAGMA main.…`, rekursive CTE über `sqlite_master`), danach alle rot. Nach der dritten Prüferrunde 24 Mutationen am Hook: 17 sofort rot; zwei Überlebende waren gleichwertig und sind gestrichen (`!x.unsicher` am `--local`-Wort, `--preview` in der Lokal-Prüfung), fünf bekamen Testfälle (`"$(…)"` und `"$$"` in Anführungszeichen, `bash -c` mit lokalem `$`-Aufruf neben weiterem Befehl, `eval` mit lokalem und entferntem Aufruf), danach alle rot. Die Prüferprobe (36 Umgehungen und Fehlalarme) endet bei 33 von 36; offen sind nur die drei bekannten Grenzen `source <(…)`, `env -S`, `node -e`. Die zweite Prüferprobe (41 Fälle) endet bei 40 von 41; Probe 31 sperrt nur, weil ihre Spalte `daten` in `pruefung` fehlt (wrangler bräche dort ebenso ab), mit `sprachen` ist derselbe Aufruf frei.
- **Lücken:** (1) Insights zeigen `execute --file` nicht (Abschnitt „D1-Verbrauchsmessung“): der Budgetzähler unterschätzt genau Einspielungen, deshalb sperrt das Plan-Tor Dateien vorher. (2) Skripte, die `wrangler` selbst starten (`node x.mjs` wie `tools/d1-verbrauch.mjs` und `groessen.mjs`, `node -e "…execSync(…)"`, `bash x.sh`), `source <(…)`, `env -S "…"`, `npm run` nach `cd "$VAR"` (package.json unbekannt), `npm start`/`npm test`, `pnpm`/`yarn` und REST-Aufrufe an die D1-API sieht der Hook nicht; `npm run` nur, wenn der Skripttext selbst `d1 … --remote` enthält. Diese Wege sind bewusst offen (Prüferrunde 2, 14.10.2026): sie braucht nur, wer die Sperre umgehen will. (3) Kreuzprodukte zweier materialisierter Teilabfragen zählen nicht. (4) Größen aus `sqlite_sequence` sind Obergrenzen; die Schätzung kann etwa um Faktor 2 danebenliegen. (5) Trigger-Rümpfe zerfallen beim Trennen an `;` (sperrt eher zu viel; kein Worker-Schema hat Trigger, Stand 14.10.2026).

## Titelzeile für Netflix (Migration 056) und Einspielen: Export, lokal bauen, einfügen (14.10.2026)

**Anlass:** Das erste Einspiel-SQL (nur Disney+) las an der echten D1 9,1 Mio. Zeilen: korrelierte Unterabfragen auf eine CTE rechnen die CTE je Adresse neu. Die Neufassung in Blöcken las lokal noch 0,21–0,23 Mio. je Anbieter. Seit 14.10.2026 (Daniel: „warum nicht löschen und neufüllen? wir wissen doch was drin steht?“) baut `tools/worker-titelzeile-einspielen.ts` die Titelzeilen außerhalb der Datenbank: die Altzeilen einmal lesen, mit den Funktionen des Workers lokal zusammensetzen, nur die fertigen Zeilen einfügen. Das Einspiel-SQL und sein Messwerkzeug sind entfernt.

- **Welche Anbieter:** `TITELZEILE_TAUGLICH` in `worker/src/titelzeile-speichern.ts` = Disney+, Netflix. Was sonst in `TITELZEILE_PLATTFORMEN` steht, wird übergangen. **Prime passt nicht ins Format:** eine Prime-Meldung trägt viele Rohfolgen (eine Seite) mit `asin`, `erschienen`, `seiten_kennung`, `abos`, `teil_von/bis`, die der Eintrag nicht kennt; dafür braucht es ein eigenes Format (eigener Auftrag). ADN meldet ohne Rohfolgen und war nie Teil des Plans.
- **Netflix im Eintrag:** Stelle 14 `folgen` (Folgenzahl der Hand-Meldung), Stelle 15 `roh_titel` (Netflix meldet als `folge` die Kennung, der Zuordner braucht den Folgentitel; nur wo er abweicht). Beide zählen als Inhalt, eine Änderung gibt eine neue Fassung. Migration 056 erweitert die Sicht `pruefung_titel` um beide Spalten; Disney+-Einträge bleiben 14 Stellen lang. Der Rohfolgen-Leser setzt `angenommen` aus `art` (Altzeilen: aus `roh.angenommen`; dort 0, wo die Titelzeile leer liefert — die Pipeline prüft nur auf wahr).
- **Randprobe im Stapel:** bis zu zehn Folgen eines Titels in einer Anfrage. Einzeln gespeichert läsen alle dieselbe Version, die Wiederholungen kosteten mehr als 50 D1-Abfragen je Aufruf; `worker/src/titelzeile-stapel.ts` setzt sie nacheinander ein und schreibt die Zeile einmal. Eine Gruppe ohne Titelzeile mit Altzeilen oder mit einer unpassenden Meldung (zwei Rohfolgen) geht ganz den bisherigen Weg.
- **Was die Titelzeile nicht trägt** (Pipeline liest es bei Netflix nicht): `staffel_text`, `dauer_sek`, `untertitel` der Rohfolge; die Sprachen der Rohfolge sind die der Meldung; bei Filmen ist `nummer` leer statt 1; `?gemeldet=` zeigt nur den jüngsten Stand.
- **Abhaken (seit 16.10.2026 behoben):** ein Lesen aller Titelzeilen, die UPDATEs im `batch` (Abschnitt „Abhaken in einem Aufruf“). Wiederöffnen kostet weiter zwei D1-Abfragen je Titel (Notfall-Werkzeug).

**Der Weg** (`tools/worker-titelzeile-einspielen.ts`, ein Lauf in `tools/worker-titelzeile-einspielen-lauf.ts`, Bau in `tools/worker-titelzeile-einspielen-bau.ts`; Tests in `tools/worker-titelzeile-einspielen.test.ts`, `tools/worker-titelzeile-einspielen-lauf.test.ts` und den beiden Titelzeilen-Tests über `spieleEin`, das denselben Lauf gegen SQLite geht):
- **Export:** `pruefung` und `prime_folge` des Anbieters seitenweise nach `id` (`WHERE plattform = ? AND id > ? ORDER BY id LIMIT 1000`), dazu die Titelzeilen des Anbieters. Die Seiten bleiben im Ordner des Laufs liegen; der nächste Lauf liest nur Zeilen über der letzten Nummer (Marke `<tabelle>-bis.json` = höchste `id` der Tabelle vor dem Export, sonst läse er alle Zeilen anderer Anbieter hinter der letzten eigenen).
- **Probelauf (eingebaut, 14.10.2026):** Jeder Lauf holt je Tabelle zuerst nur eine Seite, deren Id-Bereich auf 25.000 hinter der Marke gedeckelt ist (`PROBE_BEREICH`: 2 × 25.000 = 5 % des Tagesbudgets; sonst läse die Probe von `prime_folge` bei einem kleinen Anbieter fast die ganze Tabelle); eine nicht volle Seite vor der höchsten `id` ist nicht die letzte, der Export geht dahinter weiter. Reißt schon die Probe von `pruefung` die Schwelle, entfällt die von `prime_folge`. Ihr `rows_read` geteilt durch ihren Id-Bereich (bis zur letzten Zeile der Seite, bei der letzten Seite bis zur höchsten `id`) ist der Faktor an der echten D1; Hochrechnung = bisher gelesen + Faktor × übriger Bereich bis zur höchsten `id`, beide Tabellen zusammen. Erreicht sie `SCHWELLE` (0,25 Mio. je Anbieter), bricht der Lauf vor allen weiteren Seiten ab; die Probeseiten bleiben liegen, ein späterer Lauf setzt dahinter fort. Mit `--remote` ist `rows_read` Pflicht (fehlt es, Abbruch); lokal meldet wrangler es nicht, die Hochrechnung ist dann 0. Der Lauf druckt Faktor je Tabelle und Hochrechnung.
- **Bau:** je Adresse und Folge die jüngste Meldung (`gemeldet_am`, dann `id`), Rohfolge aus derselben Meldung oder der jüngsten Zeile in `prime_folge`, Folgen nur in `prime_folge` ohne offene Meldung, Kopf je Feld der jüngste nicht leere Wert. Eintrag, Kopf, Zähler und Einsetzen kommen aus `worker/src/titelzeile-format.ts`, alte Meldungen ohne `vorhanden`/`ton_de`/`art` über `leiteAb`.
- **Einfügen:** `INSERT … ON CONFLICT DO NOTHING` (`nr` wie im Worker). Ein Titel über 100.000 Byte (Grenze je D1-Anweisung) kommt in Teilen: weitere `UPDATE … json_insert` nur auf genau die eben geschriebene Fassung.
- **Konflikt (Titelzeile gibt es schon):** zusammenführen, nicht überschreiben. Je Folge gewinnt das jüngere `am`, eingesetzt wie im Worker (`setzeEin`, neue Fassung bei geändertem Inhalt); Kopffelder nur aus Meldungen, die jünger sind als `titel_zeile.gemeldet_am`; geschrieben mit `UPDATE … WHERE version = ?` (hat der Worker inzwischen geschrieben, ändert es nichts und der nächste Lauf liest neu). Auslassen hätte Nachzügler verloren, Überschreiben die Meldungen, die der Worker seit dem Einfügen in die Titelzeile schreibt.
- **Fertig:** ein Lauf, der „nichts mehr zu tun“ meldet. Dann steht jede exportierte Folge in einer Titelzeile, gleich oder jünger (sonst schriebe das Zusammenführen); das ist die Verlustprüfung über die exportierten Zeilen.

**Gemessen** (lokal in workerd über `getPlatformProxy`, `meta.rows_read`/`rows_written`; `wrangler d1 execute --local --json` liefert kein `rows_read`. Mengen wie am 12.10.: `pruefung` 18.500 davon Disney+ 8.700, Netflix 8.400; `prime_folge` 62.000 davon 55.000 Prime, 4.000 Disney+, 3.000 Netflix):

| Anbieter (Titel) | altes Einspiel-SQL, ein Block | Export + Einfügen | Lauf ohne Neues / 50 Nachzügler | Verlustabfrage |
|---|---|---|---|---|
| Disney+ (351) | 228.000 gelesen, 702 geschrieben | 80.900 gelesen (Export 80.500, Einfügen 351), 702 geschrieben | 355 / 454 gelesen, 50 geschrieben | 102.000 |
| Netflix (120) | 206.000 gelesen, 240 geschrieben | 81.050 gelesen (Export 80.600, Titelzeilen 351, Einfügen 120), 240 geschrieben | 475 / 525 gelesen, 1 geschrieben | 101.000 |

Gegenprobe auf derselben Kopie: die Titelzeilen des alten SQL und des neuen Wegs sind Zeile für Zeile gleich (`nr`, `version`, `daten` als Text samt Folgenreihenfolge, `gemeldet_am`, Zähler), Disney+ und Netflix; Verlustabfrage danach ohne Zeile. Abfragepläne (`EXPLAIN QUERY PLAN`): Export `SEARCH … USING INTEGER PRIMARY KEY (rowid>?)`, `MAX(id)` ein Schritt, Titelzeilen `SCAN titel_zeile`, INSERT nur `SEARCH titel_zeile USING COVERING INDEX titel_zeile_nr` (für `MAX(nr)`), jedes UPDATE `SEARCH titel_zeile USING PRIMARY KEY`. Keine Unterabfrage je Zeile, kein `INSERT … SELECT`. Verglichen und verworfen: Export ohne `LIMIT` (80.500, gleich viel, aber eine einzige Antwort mit allen Zeilen des Anbieters), `pruefung` über den Adressbereich im Index `pruefung_folge` (79.400 bei Disney+, 78.800 bei Netflix: spart nur gut 1.000 Zeilen und hängt an der Form der Adressen), `wrangler d1 export --table` (sperrt die Datenbank während des Exports und exportiert alle Anbieter). Untergrenze ohne neuen Index: jede der beiden Tabellen einmal; ein Index auf `plattform` senkte den Export auf die Zeilen des Anbieters (Netflix rund 11.400), kostete aber bei jeder Meldung eine Schreibzeile mehr.

**Hochrechnung für die echte D1:** Export ≈ `pruefung` + `prime_folge` ganz (rund 82.000 am 12.10.), Titelzeilen lesen ≈ Zahl der Titelzeilen aller Anbieter (kein Index auf `plattform`), Einfügen 1 je Titel, geschrieben 2 je Titel. Mit Faktor 2 Sicherheit rund 0,17 Mio. je Anbieter; die Verlustabfrage kostet zusätzlich lokal 0,1 Mio. (`json_each` zählt jede Folge), deshalb erst am Folgetag oder gar nicht, wenn die zweite Runde „nichts mehr zu tun“ meldet. Das alte SQL las an der echten D1 rund sechsmal so viel wie lokal (9,13 statt 1,48 Mio.); woher dieser Faktor kam, ist nicht belegt. Ob die lokale Zahl hier trägt, misst deshalb der Probelauf an der ersten Seite, bevor der Export weiterläuft.

**Tagesbudget fürs Einspielen: höchstens 1,0 Mio.** 5 Mio. Kontingent − rund 2 Mio. Grundlast − 1,5 Mio. Lese-Deckel der Meldungen (Daniels Durchgänge) = 1,5 Mio.; davon 0,5 Mio. Reserve, weil das Limit verzögert greift (nächster Punkt) und ein Überziehen erst Stunden später sichtbar wird.

**Das Limit greift verzögert** (gemessen vom Dirigenten am 14.10.2026): nach den 9,1 Mio. lief der Worker um 11:44 MESZ noch normal; ab spätestens 12:16 warf jede D1-Abfrage im Worker `D1_ERROR: Your account has exceeded D1's free tier daily row read limit` (HTTP 500, Cloudflare 1101), bis 00:00 UTC. Ein `d1 execute --remote` mit `SELECT 1` ging um 12:15 noch durch. Ein gelungener Aufruf heißt also nicht „noch Kontingent“: die eigene Summe zählen, nicht auf den Fehler warten.

**Ablauf je Anbieter (der Dirigent führt aus):**
1. Kein Bestandsbau im Fenster von Schritt 4 bis 5: Abhaken, Wiederöffnen und Löschen ändern Altzeilen ohne neue `id`, der Nachzügler-Lauf sähe es nicht (die Titelzeile trüge den Stand vor dem Abhaken; der nächste Bau hakte erneut ab).
2. Nach 00:00 UTC Migration 056: `npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=migrations/056-titel-zeile-netflix.sql` (nur die Sicht, liest fast nichts).
3. Worker mit `TITELZEILE_PLATTFORMEN = "disneyplus,netflix"` deployen. Netflix-Durchgänge ruhen bis Schritt 5 (eine Meldung, die vor dem Einspielen den alten Weg ging, würde danach verdrängt). **Erst nach Schritt 2, auch wenn der Schalter nur `disneyplus` enthält:** die Rohfolgen-Leser fragen `roh_titel` aus der Sicht `pruefung_titel` (`worker/src/rohfolgen-seiten.ts`, `offenAusTitel` und `alleAusTitel`), die Spalte gibt es erst mit Migration 056; ohne sie scheitern `?rohfolgen=1` und damit der Bau.
4. Aus dem Repo-Wurzelordner: `npx tsx tools/worker-titelzeile-einspielen.ts netflix <ordner> --remote` (`<ordner>` je Anbieter neu, z. B. im Scratchpad). Der Lauf holt zuerst die Probeseiten und bricht ab, wenn die Hochrechnung 0,25 Mio. erreicht (Dreifaches der Schätzung; dann anhalten und den Unterschied klären, nicht mit größerer Schwelle wiederholen). Sonst exportiert er weiter, baut und schreibt `<ordner>/einspielen-1.sql`; er gibt Faktor, Hochrechnung und die gelesenen Zeilen aus (Summe von `meta.rows_read`). Davor und danach `npx wrangler d1 info anime-kalender --config wrangler.toml` aus `worker/` (Zeile `rows_read_24h`) als Gegenprobe. Dann aus `worker/`: `npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=<ordner>/einspielen-1.sql` (nur INSERT, wrangler meldet die geschriebenen Zeilen: 2 je Titel). **`--file` mit `--remote` läuft über die Import-Schnittstelle der D1** (Datei nach R2 hochladen, dann einspielen; wrangler 4.126.0, `executeRemotely` in `wrangler-dist/cli.js`) **und sperrt die Datenbank währenddessen** („your D1 database will be unavailable to serve queries“): Worker und Seite bekommen in dieser Zeit keine Antwort aus der D1, deshalb nicht während eines Bestandsbaus oder Durchgangs.
5. Denselben Aufruf wiederholen: Er liest nur Zeilen über der letzten Nummer und die Titelzeilen (lokal unter 1.000 Zeilen) und schreibt Nachzügler als `einspielen-2.sql` usw.; einspielen und wiederholen, bis er „nichts mehr zu tun“ meldet. Dann steht jede exportierte Folge in einer Titelzeile.
6. Verlustabfrage `worker/einmalig/titel-zeile-verlust.sql` mit `__PLATTFORM__` = netflix (lokal 0,1 Mio. gelesen): erst am Folgetag, wenn das Budget es trägt. Keine Zeile = fertig; sonst nicht weiter ausrollen.

**Rückweg: Netflix nach dem Einspielen wieder abschalten.** Den Schalter allein zurückzunehmen reicht nicht. Der Worker schreibt Netflix-Meldungen dann wieder nach `pruefung`/`prime_folge`, aber alle Leser filtern mit `NICHT_VERDRAENGT` (`url NOT IN (SELECT url FROM titel_zeile)`, `worker/src/titelzeile-lesen.ts`): Für jede eingespielte Adresse bleiben die neuen Meldungen unsichtbar, die Leser zeigen den eingefrorenen Stand der Titelzeile. Zurück geht es so:
1. Netflix-Durchgänge anhalten, Worker mit `TITELZEILE_PLATTFORMEN = "disneyplus"` deployen.
2. `DELETE FROM titel_zeile WHERE plattform = 'netflix'` (liest nur `titel_zeile`, wenige hundert Zeilen). Das Einspielen hat die Altzeilen nicht gelöscht, die Leser zeigen sie danach wieder.
3. Verloren ist, was seit dem Einspielen nur in der Titelzeile stand: Meldungen neuer Adressen, geänderte Folgen, Abhak-Marken. Vor Schritt 2 zählen: `SELECT COUNT(*) FROM titel_zeile WHERE plattform = 'netflix' AND (version > 1 OR gemeldet_am > '<Zeitpunkt des Einspielens>')`. Nach Schritt 2 einen Netflix-Durchgang über diese Adressen laufen lassen; abgehakte Folgen sieht die Pipeline im nächsten Bau wieder offen und hakt sie erneut ab.

Erst löschen, dann Schalter: geht auch, solange die Durchgänge ruhen. Nur den Schalter zurücknehmen und die Zeilen stehen lassen geht nie.

## Auswertungen und Einmal-SQL nur an der Meldungskopie, nie an der echten D1 (14.10.2026)

**Regel:** Eine Auswertung (Zählen, Gruppieren, Vergleichen) und jedes Einmal-SQL wird an einer SQLite-Kopie gerechnet. An die echte D1 geht danach nur, was ein Schlüssel-`INSERT`/`UPDATE` mit bekannten Schlüsseln ist (das Plan-Tor sperrt die anderen Wege). Anlass: Am 14.10.2026 kamen 11,7 von 12,5 Mio. gelesenen Zeilen von Einmal-SQL (Einspielen der Titelzeile, 9,13 Mio.) und zwei Auswertungen (je 1,3 Mio.); dasselbe Einspiel-SQL läuft an einer Datei in 324 ms (Analyse `daniel-zum-abarbeiten/berichte/weg-vom-d1-kontingent.md`).

- **Kopie holen:** `node tools/meldungskopie.mjs holen` (Agenten: nur über `node C:/code/ai/__assets/tools/mit-lauf-token.mjs meldungskopie-holen`, sie haben `LAUF_TOKEN` nicht) lädt das Artefakt des jüngsten erfolgreichen Laufs `meldungskopie.yml` nach `data/cache/meldungskopie/meldungen.sqlite` (nur wenn der Lauf neuer ist als die vorhandene Kopie). Kein D1-Zugriff, nur `gh` und die Umgebungsvariable `LAUF_TOKEN` (ohne sie bricht `holen` mit einer Meldung ab). Gebaut wird sie täglich um 03 UTC vom Cloudflare-Wecker (`shared/weckplan.ts`; **der Eintrag wirkt erst nach `wrangler deploy` des Workers**), von Hand: `gh workflow run meldungskopie.yml --repo danielzaiser91/anime-kalender-de`.
- **Abfrage:** `node tools/meldungskopie.mjs abfrage "SELECT …"` (Zeilen als JSON, `--max` begrenzt) oder `abfrage --datei x.sql`. **Die Kopie hat keine Tabelle `such_erwartung`** (nur `pruefung`, `prime_folge`, `titel_zeile`); die Erwartungen je Suchadresse liefert nur der Worker mit `?zaehlen=1` (Feld `erwartungen`), und `?zaehlen=1` und `?zaehlen=1&nummern=1` können verschiedene Cache-Stände zeigen (31.10.2026). Ein einzelnes `SELECT` liefert Zeilen; alles andere (mehrere Anweisungen, `INSERT`/`UPDATE`/`DELETE`) läuft ganz und meldet geänderte Zeilen und die Zeilendifferenz je Tabelle. Gearbeitet wird an einer Wegwerf-Kopie der Datei, die Kopie bleibt unverändert. Die Fußzeile nennt den Stand der Kopie und warnt ab 36 Stunden. **Netflix- und Disney+-Folgen nur über die Sicht `pruefung_titel` abfragen:** seit Migration 055/056 (14.10.2026) liegen sie in `titel_zeile`; `pruefung` und `prime_folge` enden für Netflix am 13.10. Eine Abfrage dort meldet sonst fälschlich „fehlt“ (Bilanz zu PR 2388, korrigiert 30.10.2026).
- **Urteile aus der Kopie (30.10.2026):** `node tools/urteile-aus-kopie.mjs [--baum <worktree>] [--titel 1,2] [--anbieter primevideo] [--vergleich <urteile.json>] [--aus <datei>]` fährt `pipeline/fetch-urteile.ts` des Baums mit den echten Worker-Funktionen (`allePruefungen`, `alleRohfolgen`) gegen die Kopie, ohne Netz, D1 und Token, und schreibt nur in eine Wegwerf-Wurzel. Ausgabe: Urteil je Schlüssel `titel|anbieter|folge` (stdout oder `--aus`), Zählung und mit `--vergleich` neu/weg/anders je Schlüssel auf stderr. Eingaben (Titelliste, Folgen-Zuordnung, Handbelege) kommen aus dem Baum, die Meldungen aus der Kopie: Welt ist die Kopie (Stand beachten), Vergleichsbasis ein zweiter Lauf mit dem Baum von main. **Pflichtbeleg für jede Änderung an der Zuordnung** (`zuordnung.ts`, `urteil-je-folge.ts`, `fremde-adressen.ts`, Worker-Seiten): je ein Lauf mit Basis- und Änderungsbaum, die Differenz im PR. Test: `tools/urteile-aus-kopie.test.mjs`.
- **Zuordnungsbilanz (30.10.2026):** `node tools/zuordnungsbilanz.mjs <alt.sqlite> [<neu.sqlite>] [--gleich]` vergleicht die Zuordnung Adresse -> `titel_id` zweier Kopien (Netflix/Disney+ nur aus der Sicht `pruefung_titel`, alle anderen aus `pruefung` und `prime_folge`) und druckt Summen sowie eine Zeile je Adresse (neu, umgezogen, verloren; „gleich“ und „ohne“ (in beiden Ständen keine Kennung) nur mit `--gleich`); eine Kopie älter als 48 h bekommt eine Warnzeile; „alt“ ist die Kopie vor einer Einspiel-SQL-Probe, „neu“ die Kopie danach, ohne zweite Datei gilt der Standardort. Bauer und Prüfer fahren dasselbe Skript statt Handzählung.
- **Inhalt:** nur `pruefung`, `prime_folge`, `titel_zeile` samt allen Indexen und der Sicht `pruefung_titel` (aus `sqlite_master` der echten D1, damit Pläne wie live sind). Der Bau verweigert jede andere Tabelle im Export (Newsletter-Adressen, Zugänge, Push-Abos). **Das Artefakt ist verschlüsselt** (AES-256-GCM, `tools/meldungskopie-schluessel.mjs`): Das Repo ist öffentlich, jedes angemeldete GitHub-Konto kann Artefakte 3 Tage laden, der Worker gibt diese Daten aber nur mit `LAUF_TOKEN` heraus (`prime_folge.roh` enthält ungefilterte Player-Felder). Der Schlüssel kommt per HKDF-SHA256 (Info „meldungskopie“) aus `LAUF_TOKEN`; ein neues Secret gibt es nicht. Fehlt der Token im Lauf, bricht `ziehen` vor dem ersten D1-Zugriff ab, und es wird nie unverschlüsselt hochgeladen. Wird `LAUF_TOKEN` gedreht, sind alte Artefakte nicht mehr lesbar (3 Tage Aufbewahrung, der nächste Lauf legt ein neues an).
- **Grenzen:** `node:sqlite` zählt keine gelesenen Zeilen. Wie viele Zeilen ein SQL an der echten D1 liest, bleibt die Messung mit `C:/code/ai/__assets/tools/d1-schutz/messe.mjs` (lokal nur eine Untergrenze, Faktor 6 beim Einspielen am 14.10.2026) und das Plan-Tor; die Kopie beantwortet „Was kommt heraus, und ist das SQL richtig?“, nicht „Was kostet es?“. Der Stand ist der Beginn des Exports (nicht der Zeitpunkt der Frage): Meldungen seit dem Lauf fehlen.
- **Zeitplan und Frist:** täglich 03 UTC; `wecker-wache.yml` holt nach 30 Stunden nach (Takt 3 h, also spätestens nach 33 h), die Wochenwache (`wache-woechentlich.mjs`) und die Fußzeile warnen ab 36 h. `tools/meldungskopie.test.mjs` rechnet diese Kette nach (Weckplan, Nachholen, Takt, Grenze) und schlägt an, wenn eine Stelle die 36 h reißt.
- **Zugang:** `ziehen` (nur im Lauf; es verweigert sich ohne `GITHUB_ACTIONS=true`) nutzt `LAUF_TOKEN` und das Repo-Secret `CLOUDFLARE_API_TOKEN` (gesetzt am 15.10.2026, `gh secret list`). Das ist das Token „anime-kalender-deploy“ mit D1-Schreibrecht, weil `d1 export` es verlangt (`CLOUDFLARE_ANALYTICS_TOKEN` ist laut `d1-verbrauch.yml` nur zum Lesen); der Lauf schickt damit nur Lesebefehle (`d1 export` der drei Tabellen, ein `SELECT` auf `sqlite_master`). Fehlt eines der beiden Tokens, bricht `ziehen` vor dem Start von wrangler ab und der Lauf wird rot; eine wrangler-Anmeldung des Rechners nutzt es nie. **Ein Export blockiert andere Abfragen an der D1, solange er läuft** (Cloudflare-Doku „Import and export data“, abgerufen 14.10.2026); bei rund 15 MB Sekunden, deshalb nachts. Der D1-Sperre-Hook sieht `node tools/meldungskopie.mjs ziehen` nicht (Skripte, die wrangler selbst starten, gehören zu seinen bekannten Lücken); die Sicherung ist die Umgebungsprüfung im Werkzeug.
- **Roter Lauf 15.10.2026 (16.10.2026 nachgearbeitet):** Der erste Lauf (Hand-Start 12:00 UTC) scheiterte in der Schemaabfrage (`d1 execute --json`); der Grund blieb unlesbar, weil wrangler mit `--json` Fehler auf **stdout** schreibt und `execFileSync` nur „Command failed“ wirft (`mitFehlertext` hängt die Ausgabe an). Vermutete Ursache laut `stand.md`: das gesperrte D1-Tageskontingent vom 15.10. (nicht im Protokoll belegt; der nächste Lauf zeigt den Wortlaut). Die Schemaabfrage läuft jetzt vor dem Export (Annahme, nicht bestätigt: ein laufender Export blockiert die D1; sicher: ein Fehler kostet vor dem 36-MB-Export nichts). Der Lauf meldet Fehlschläge an die Laufstatus-App (`lauf-melden.sh fehler`), vorher sah nur GitHub den roten Lauf. Die Wache zählt den letzten **Start** (auch einen roten), holt also frühestens 30 h danach nach.
- **Ansätze, gemessen am 14.10.2026** (lokal, Miniflare-`rows_read` an einer Füllung in Produktionsgröße: 55.104 `prime_folge`, 18.208 `pruefung`, 1 `titel_zeile`):
  - **Untergrenze** (ganzer `d1 export` einmal am Tag): liest jede Zeile jeder Tabelle und legt Newsletter-Adressen auf den Rechner des Laufs; die Größen der übrigen Tabellen sind nicht gemessen (Messung nach 02:00 MESZ: `SELECT name, seq FROM sqlite_sequence`, rund 20 Zeilen). Nicht gewählt, weil der Zusatz nur Last und Datenschutzrisiko bringt.
  - **Gewählt** (`--table` für die drei Meldungstabellen + `sqlite_master`-Abfrage): 73.313 + 57 = 73.370 Zeilen je Tag, 1,5 % des Tageskontingents (5 Mio.), 124-mal weniger als das Einspiel-SQL (9,13 Mio.). Export-SQL 36 MB, Kopie 15,1 MB (gzip 3,0 MB), Bau 609 ms, Abfrage `GROUP BY` über `prime_folge` 19 ms. Wegen `rows_read` an der echten D1 siehe unten.
  - **Inkrementell** (nur Zeilen seit dem letzten Stand): `prime_folge WHERE gemeldet_am > …` liest wieder 55.104 Zeilen (`SCAN`, kein Index auf `gemeldet_am` seit Migration 047), `pruefung` dagegen 1 (Index `pruefung_gemeldet`); `uebernommen`-Änderungen sieht der Weg gar nicht. Spart bei 75 % der Zeilen nichts, deshalb verworfen.
  - **Aus den R2-Auszügen des Baus** (`?alle=1`, `…&alle=1`): liefert abgeleitete Antworten, nicht die Tabellen. Das Einspiel-SQL läuft dort nicht; nicht gebaut, Zeilen nicht gemessen.
- **Nach dem Merge zu messen (Dirigent, nach 02:00 MESZ):** (1) Worker deployen, damit der Wecker den Lauf kennt. (2) Einmal `gh workflow run meldungskopie.yml`, danach `wrangler d1 insights` für den Lauf-Zeitraum: erwartet rund 73.000 gelesene Zeilen; liegt es über dem Dreifachen (220.000), den `--table`-Weg gegen `SELECT`-Seiten tauschen. (3) `node tools/meldungskopie.mjs holen`, danach die Einspiel-SQL-Probe an der Kopie.

## Newsletter-Kapazität: Kappen, Versandtage, volle Anmeldung (23.10.2026, B13)

Resend Free: 100 Mails am Tag, 3.000 im Monat. Rechenweg in `worker/src/newsletter-kapazitaet.ts`: Bestätigungen haben 30 (`GRENZE_TAG`), der Digest also höchstens 70 am Tag, dazu Tagesrest 100 und Monatsrest 3.000 aus `schreib_tag.mails` (Digest heute aus `send_log`); `verbuchen` löscht seit 23.10.2026 nur noch Zeilen vor dem 1. des laufenden Monats, sonst hätte die Monatssumme nur den heutigen Tag. Wochen-Abos haben einen Versandtag (FNV-Hash der Kennung mod 7, Montag = 0); `runDigest` geht die Wochenliste jeden Tag durch und nimmt nur Fällige (`wochenAboFaellig`: höchstens 2 Tage nach dem Eimer-Tag, seit der letzten Mail mindestens 7 Tage; wer verspätet bedient wurde, wartet bis zu seinem nächsten Eimer-Tag, also 12 statt 7 Tage Abstand). Reihenfolge bei Kappe: am längsten nicht bedient zuerst (`ORDER BY last_sent_at`). `send_log` nur, wenn mindestens eine Mail angenommen wurde oder niemand fällig war; sonst sendet der Folgetag nach. `/health` zeigt `newsletter` (Platz, Digest und Mails heute, Monat); das Lauf-Log nennt die Lage je Lauf.

`/subscribe` schließt mit 503 `newsletter_voll`, wenn tägliche Abos + größter Wochentags-Eimer (aktiv und unbestätigt) 70 erreichen; auch vorhandene Adressen bekommen dann diese Antwort (sonst verriete der Status, wer abonniert ist); Einstellungen über den Link, Wiederherstellung und Abmeldung laufen über eigene Wege und bleiben offen. Die Prüfung sitzt vor den Zählern von B2: eine Abweisung bucht und gibt nichts zurück (0 Schreibzeilen). Kosten: eine Abfrage mit einer Zeile je Abo (bis ~500), höchstens einmal je Isolate und 60 s (Merker), sonst ändert sich nichts am Lesen. Die Seite zeigt zu dem Code `TEXT_NEWSLETTER_VOLL` (`shared/dienst-pause.ts`), nicht „Dienst macht Pause“.

## Worker-Cron: 50 Unteraufrufe je Aufruf, Digest mit eigenem Trigger (15.10.2026)

Die Free-Stufe erlaubt **50 Unteraufrufe je Worker-Aufruf**, D1-Abfragen zählen mit. Der stündliche Cron teilte sie sich mit Monitor, Wecker, Push und Digest: zur Sendestunde 79 ohne Abonnenten, 227 bei 50 (Miniflare-Simulation, Bericht `daniel-zum-abarbeiten/berichte/digest-subrequest-grenze.md`); der Digest kostete je Abonnent drei (Mail, zwei UPDATE) und brach ab etwa 15 ohne `send_log` ab.

Seitdem: Der Digest hat einen eigenen Trigger `0 5,6 * * *` (`DIGEST_CRON` in `worker/src/digest-versand.ts`, Zeichen für Zeichen in `wrangler.toml`; 05/06 UTC = 07:00 Berlin in Sommer-/Winterzeit, `SEND_HOUR_BERLIN` entscheidet). Er verschickt per Resend-Stapel (`/emails/batch`, höchstens 100 je Aufruf, alles oder nichts je Stapel) und schreibt Sync-Schlüssel und `last_sent_at` je in **einer** Abfrage über `json_each`. Der Monitor schreibt Stände und Verlauf ebenfalls in je einer Abfrage. Gemessen (D1-Stapel je Anweisung gezählt): Digest-Aufruf 11–13 bei 1/10/50/150 Abonnenten, Montag mit Wochendigest 16–17; stündlicher Aufruf 35 unabhängig von der Abonnentenzahl. Prüfung: `tools/worker-digest-versand.test.ts` (in `check:worker`).

**Push und persönlicher Feed bei vielen Nutzern (23.10.2026).** Vorher kostete jedes Push-Abo 1–3 Unteraufrufe (100 Abos mit Neuigkeit: 303, ohne: 101, Test `tools/worker-push-versand.test.ts`). Jetzt: Abfrage der Abos (1), Kennungen (2, danach stündlich im Speicher), **eine** Anweisung für alle Stände (`json_each`, 1; kein `batch`, weil die Doku offenlässt, ob ein Stapel als 1 oder N zählt), höchstens `PUSH_JE_LAUF` = 8 Push-Abrufe, **eine** Anweisung für alle erloschenen Abos: gemessen mit der Attrappe (`unteraufrufe()` zählt jede Anweisung einzeln) 12 bei 100 Abos mit Neuigkeit, 2 bei 100 ohne (4 im frischen Prozess); mit den 35 des Crons bleibt der Aufruf unter 50. Wirft ein Push-Abruf (Netzfehler), läuft der Rest weiter und das Abo bekommt Zeitpunkt und Merkliste von vorher zurück (eine weitere Anweisung). Abos über der Kappe behalten ihren Stand (`zuletzt`) und kommen im nächsten Lauf als Erste dran (`ORDER BY zuletzt`): bei 100 Abos, die alle zur selben Stunde etwas bekommen, dauert das 13 Stunden. Reicht das nicht, ist der nächste Schritt Cloudflare Paid oder eine Queue. Der Feed `/feed/favoriten.ics` schneidet seit dem selben Tag `feeds/all.ics` (Termine ab sieben Tage zurück, wie die Sammelfeeds) statt `events.json` zu parsen und neu zu bauen: alle 159 Titel mit Terminen als Favoriten 0,6 ms statt 414–631 ms (Node, `pipeline/check-favoriten-feed-bestand.ts`, in `check:bestand`); die Antwort liegt 15 Minuten im Edge-Cache je Feed-Adresse, eine geänderte Favoritenliste oder ersetzte Adresse wirkt bis zu 15 Minuten später. Messwerte aus dem Betrieb (CPU je Aufruf, Fehler 1102) gibt es nicht; `wrangler.toml` setzt keine `[limits]`, die Doku geht von Free aus. Cartoons mit negativer Kennung stehen im Feed, können aber nie Favorit des Feeds sein (`leseFavoriten` nimmt nur Kennungen über 0).

**Push ohne Dauerschreiben (24.10.2026, B3).** Die Tabelle `push_marke` (Migration 061, eine Zeile) hält fest, bis wann alle Abos bedient sind und welche „Jetzt auch bei“-Meldungen durch sind; `zuletzt` je Abo gilt nur noch als Untergrenze nach einem Push. Ohne neues Ereignis und ohne neue Meldung seit der Marke liest der stündliche Lauf eine Zeile aus `push_marke` und sonst nichts (Test mit 1.000 Abos: 0 Anweisungen auf `push_abo`, 1 D1-Aufruf, Mitte aus 7 Läufen 0,18 ms mit 4.000 Ereignissen, Attrappe, Node 24). Mit neuem Ereignis wird `push_abo` einmal ganz gelesen (N Lesezeilen je Ereignisstunde statt je Stunde) und nur geschrieben, wer einen Push bekommt (5 betroffene von 1.000 = 5 Schreibzeilen). Worker-Schleife statt SQL-Filter: bis zur Karenz-Ende am 05.11.2026 stehen Favoriten in zwei Schreibweisen (`leseFavoriten` übersetzt), ein `instr`-Filter träfe nur die neue; danach ist der Filter (Plan E1 b) möglich. Die Marke rückt nicht vor, solange ein Abo wegen der Kappe oder eines Netzfehlers ohne Push blieb (bei Netzfehlern höchstens 24 Stunden lang, danach ist das Ereignis für dieses Abo verfallen und die Marke rückt vor). **Migration 061 muss vor dem Worker-Deploy laufen**, sonst scheitert der Push-Lauf (Fehlerprotokoll). Der erste Lauf danach setzt nur die Marke; ein Ereignis aus der Stunde dazwischen geht verloren.

**Push-Anmeldung härten (24.10.2026, B4).** `/push/abo` und `/push/test` zählen je IP (30 je Stunde, Schlüssel `push-abo-ip:`/`push-test-ip:`, Helfer `imRahmen`; eine abgewiesene Anfrage liest 1 Zeile und schreibt keine). Endpunkte nur von `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com` und Unterdomänen von `push.services.mozilla.com`, `push.apple.com`, `notify.windows.com` (`push-dienst.ts`, auch im Versand und bei `/push/test`; vorher prüfte `includes` den Rechnernamen, `fcm.googleapis.com.fremd.de` ging durch). Obergrenze 350 Abos (192 Pushes am Tag bei 8 je Stunde, 0,5 je Abo und Tag): darüber antwortet ein neuer Endpunkt mit 507 und `code: push_voll` (503 würde `dienstFetch` als Ausfall abfangen), die Oberfläche zeigt einen Hinweis; Erneuerungen bestehender Abos gehen immer durch. Gezählt wird ohne Durchlauf: Migration 062 legt `push_zaehler` (eine Zeile) an, zwei Auslöser auf `push_abo` pflegen sie; die Prüfung sitzt in der Schreibanweisung selbst (Schlüsselzugriff). Tote Abos: Spalte `erneuert` (die Seite meldet sich bei jedem Start), der tägliche Lauf um 03 UTC löscht Abos mit `erneuert` (leer: `erstellt`) älter als 90 Tage. **Migration 062 muss vor dem Worker-Deploy laufen.**

Offen: rote Seiten kosten Nachprüfung und Störungsmail. Resend Free schickt 100 Mails am Tag. Cron-Trigger je Konto: 5 (Free).

## Lese-Deckel für jede Anfrage (`lesedeckel.ts`, 15.10.2026)

**Anlass:** Am 15.10.2026 um 12:48 MESZ waren 6,72 Mio. Zeilen gelesen (Kontingent 5 Mio.), D1 stand bis 02:00 MESZ. Der Tagesdeckel zählte nur Meldungen; `GET /pruefung?token=` (`offenePruefungen`, rund 36.000 Zeilen je Aufruf laut Insights) lief bei jedem Prime-Seitenaufruf der Erweiterung am Zähler vorbei.

**Würde der Riegel je Anfrage (5.000) den Bau sperren?** Auf `main` vor diesem Stand nein: Er sitzt nur in `mitTagesdeckel`, und das umschließt nur Meldungen (`istMeldung`); der Bau-Abruf und die Aufträge laufen daneben. Ein auf alle Routen ausgeweiteter Riegel hätte es getan (36.000 > 5.000, Buchung von `DECKEL_LESEN`). Deshalb bleibt der Riegel bei den Meldungen.

**Inventur (lokal, workerd, `meta.rows_read`, Bestand wie am 12.10.: `pruefung` 17.800, `prime_folge` 55.000; `titel_zeile` und `pruefung_titel` leer, darum liegt `?token=` lokal weit unter dem Produktionswert):**

| Route (Datei:Zeile) | Cache | gelesen lokal |
|---|---|---|
| `?token=` offene, alle (`pruefung-lesen.ts:128`) | neu R2, 5 min nach Marke | 1.002 (Produktion ~36.000) |
| `?token=&plattform=primevideo` | neu R2 | 4.269 |
| `?zaehlen=1` (`pruefung-lesen.ts:97`, `pruefung-zaehlen.ts`) | Edge 2 h je Rechenzentrum | 61.315 |
| `?stand=1` (`pruefung-lesen.ts:78`) | Edge 5 min | 43.513 |
| `?rohfolgen=1&namen=1` (`pruefung-lesen.ts:93`) | Edge | 35.601 |
| `?rohfolgen=1` Seite 1 | Edge | 11.101 |
| `?alle=1` Seite 1 (`pruefung-lesen.ts:123`) | R2 | 10.000 |
| `?gemeldet=<url>` (`pruefung-lesen.ts:55`) | Edge 30 min | 2 |
| `/verlauf` (`verlauf.ts:9`), `/lauf` (`lauf.ts:41`, `:163`) | – | 1–4 |
| `/status` (`index.ts:1543`, `site_status`), `/health` (`index.ts:1580`) | – | Tabellengröße (Dutzende) bzw. aktive Abonnenten |

**Was jetzt gilt:** Jede Anfrage läuft über `mitEingang` (`auffangnetz.ts`) → `mitLesedeckel`: zählende Datenbank (auch `first()`), gelesene Zeilen je Isolate gesammelt und ab 1.000 in `schreib_tag.gelesen` gebucht (höchstens 5.000 Buchungen am Tag statt einer je Anfrage). Ab `DECKEL_LESEN` (jetzt 3,0 Mio.: Die Grundlast steckt im Zähler, aber nach dem Deckel lesen Cron, Schnellmesser-DO, D1-API-Werkzeuge und freie Bau-Abrufe ungezählt weiter, zusammen höchstens ~1,8 Mio.; bei 3,5 Mio. wären es im schlimmsten Fall 5,3 Mio.) bekommen `/pruefung`, `/netzfund`, `/vorfall` ohne gültiges Token beim ersten D1-Zugriff 429; Cache-Treffer laufen weiter. `/lauf`, `/verlauf`, `/status` (zusammen unter 30.000 Zeilen am Tag) werden gezählt, aber nie gesperrt (15.10.2026), damit die Statusanzeige am Deckel nicht blind ist. Frei: Token-Anfragen (Bau, Läufe, Meldungen unter ihrem eigenen Deckel) und Besucher-Wege. Nicht gezählt: Cron (`scheduled`), Newsletter-Worker, Board, Sammelstände verlorener Isolates (< 1.000 je Isolate), Hintergrundaufgaben nach der Antwort.

**Nachprüfen:** nach einem Tag `wrangler d1 insights` gegen `schreib_tag.gelesen` (an der Meldungskopie) halten; liegt der Zähler weit unter den Insights, ist der ungezählte Rest größer als die Reserve (seit 15.10.2026 2,0 Mio. bis zum Kontingent).

## Feed-Abrufe zählen und ICS-Takt (`feed-zaehler.ts`, Migration 060, 23.10.2026)

Kalenderkopf nennt `REFRESH-INTERVAL;VALUE=DURATION:PT12H` und `X-PUBLISHED-TTL:PT12H` (`shared/ics.ts`, gilt für alle gebauten Dateien und den Favoriten-Feed); vorher stand dort kein Takt. Welche App den Wert beachtet, ist nicht gemessen (A6 bleibt Annahme, bis der Zähler es zeigt).

Zähler: `mitEingang` (`auffangnetz.ts`) zählt jede Anfrage an `/feed/favoriten.ics?k=…` vor Cache und Datenbank (auch unbekannte Adressen, auch spätere Edge-Cache-Treffer). Tabelle `feed_abrufe(tag, reg, wert)`: `reg = -1` summiert die Abrufe, `reg 0..255` sind Register eines HyperLogLog über den SHA-256 des Tokens (kein Token gespeichert, Fehler rund 6,5 %). Gebucht wird gesammelt je Isolate: ab 500 Abrufen oder nach 10 Minuten, nie öfter als alle 60 s; Schreibzeilen je Stapel = 1 (Abrufe) + angehobene Register (höchstens 256) + 1 (Buchung in `schreib_tag`, der Schreib-Deckel zählt den Zähler mit) und ein DELETE alter Tage. Ein Isolate schreibt höchstens 1000 Zeilen am Tag (`MAX_ZEILEN_TAG`, danach ist der Zähler bis 00:00 UTC aus) und wiederholt kein Register, das es heute schon geschrieben hat; Anfragen mit Zufalls-Token (404) kosten so je Isolate höchstens diese Grenze. Ablesen: `leseFeedAbrufe(env, tag)`; Zeilen älter als 30 Tage löscht der nächste Stapel. Fehlt die Tabelle oder ist D1 gesperrt, läuft der Feed unverändert weiter (Warnung im Log, ein Versuch je Minute).

## Seitenweise Titelzeilen-Leser: ab dem Titel der Marke, Abbruch nach `LIMIT` (Migration 058, 16.10.2026)

**Anlass:** Insights am 16.10.2026 bis 10:40: `offenAusTitel` (`worker/src/rohfolgen-seiten.ts`) 26-mal Ø 26.568 gelesene Zeilen, `?alle=1` (`allePruefungen`) 10-mal Ø 28.665. Aufrufer: `bestand-bauen.yml` → `npm run data:rohfolgen` (`pipeline/fetch-rohfolgen.ts`, bis 20 Seiten à 5.000) → `?rohfolgen=1` (`worker/src/pruefung-rohfolgen.ts`); `alle=1` aus `fetch-folgen-zuordnung.ts` und `fetch-urteile.ts` → `alleAusTitel`. Alle drei hatten dieselbe Ursache.

- **Ursache:** Die Leser sortierten nach `id`, einem Ausdruck über `json_each`. Jede Seite packte alle Folgen aller passenden Titel aus und sortierte alles über der Marke. Kostenmodell je Seite (lokal in workerd, auf die Zeile nachgerechnet): alle Titelzeilen + Folgen der Titel mit `offen_rohfolge > 0` + Zeilen über der Marke (1.032 + 13.031 + 1.995 = 16.058). Der Filter `offen_rohfolge > 0` greift also schon vor `json_each`; geschlossene Titel kosten nur ihre eine Zeile.
- **Warum so viele offen bleiben:** Der Zähler stimmt (`zaehleOffene` bei jedem Schreiben). Rund 13.000 Rohfolgen (Disney+ und Netflix, `data/prime-unzugeordnet.json` 16.10.: „kein Titel zu dieser Adresse“ 16.002, „keine einzige Folge zuzuordnen“ 1.082) kann der Zuordner nicht zuordnen und hakt sie deshalb nie ab; sie kommen bei jedem Bau wieder.
- **Altzeilen:** `prime_folge` und `pruefung` laufen nur auf der ersten Seite (lokal 26.261 Zeilen); die 26.568 der Insights sind die Sicht allein.
- **Lösung:** Migration 058 zeigt `t.nr` als `titel_nr` in der Sicht. Weil die Id mit `nr` beginnt, ordnet `ORDER BY titel_nr, id` genau wie `ORDER BY id`; mit `titel_nr >= <nr der Marke>` geht SQLite über `titel_zeile_nr` ab dem Titel der Marke und bricht in D1 nach `LIMIT` ab (`TITEL_AB_MARKE`, `TITEL_REIHE`, `titelSeite` in `worker/src/titelzeile-lesen.ts`). **node:sqlite 3.50 bricht nicht ab** (sortiert alle Titel ab der Marke); workerd tut es (100 Titel à 20 Folgen, `LIMIT 50`: 124 statt 4.100 gelesene Zeilen). Test: `tools/worker-titelzeile-seiten.test.ts`.
- **Gemessen** (workerd, 1.032 Titel, 14.231 Folgen, 12.765 offene Rohfolgen; Sicht je Durchgang, Antworten gleich): offene Rohfolgen 90.002 → 26.913, alle Rohfolgen 73.086 → 29.436, `?alle=1` 96.376 → 29.584. Untergrenze mit der Sicht: rund zwei Zeilen je gelieferter Folge plus eine je Titel.
- **Verworfen:** Teilindex `titel_zeile (nr) WHERE offen_rohfolge > 0` mit den alten Abfragen sparte 240 von 90.002 Zeilen und kostete eine Schreibzeile mehr bei jeder Änderung des Zählers. Weniger ginge nur, wenn unzuordenbare Rohfolgen nicht bei jedem Bau neu geliefert würden (Verhaltensänderung, nicht gebaut).
- **Einspielen:** 058 vor dem Worker, sonst „no such column: titel_nr“. Die Migration ersetzt nur die Sicht, liest und schreibt keine Zeile.

## Zuordner-Lücken: Geschwister-Probe, TMDB als zweiter Anker, „E<n> - “ und „ BD“ (16.10.2026)

**Anlass:** Rohfolgen, die `fetch-rohfolgen.ts` nicht zuordnet, werden nie abgehakt und bei jedem Lauf neu aus D1 gelesen (Bericht `daniel-zum-abarbeiten/berichte/d1-rest-ursachen-2026-10-16.md`). **Gebaut** (`shared/folgen-anker.ts`, Prüfung `pipeline/check-zuordner-luecken.ts` in `check:logic`): (1) Geschwister-Probe: passt keine Folge zum gemeldeten Titel, werden die Titel derselben `franchiseId` befragt; der beste gewinnt (mindestens 3 Treffer und mehr als die Hälfte der Gruppe), bei Gleichstand an der Spitze bleibt es offen, bei gemeldeter Staffel ab 2 ist der Reihenkopf ausgenommen. (2) TMDB-Staffel als zweiter Anker, wenn aniSearch nichts trifft (nacheinander, nie vermischt, sonst schweigt `ordneZu` bei doppelten Daten). (3) `folgenKern` schneidet „E<n> - “, `ausAnisearch` das Suffix „ BD“ ab (auch die Anker der Urteile in `folgen-je-folge.ts` und `tools/poc-urteil`). **Nicht gebaut:** Cours-Summe (Netflix, Daniel entscheidet), Gruppe V (Titel fehlen im Bestand).
**Messung (offline, Obergrenze, Rohfolgen liegen nur in D1):** von 51 Einträgen / 1.082 Folgen „keine einzige Folge zuzuordnen" haben 29 Einträge / 653 Folgen ein Geschwister, dessen Anker so lang ist wie die Gruppe, und 20 Einträge / 432 Folgen eine TMDB-Staffel gleicher Länge neben aniSearch; „ BD" tragen 2 aniSearch-Einträge (24 Folgen). Wie viele wirklich treffen, zeigt der erste Lauf nach dem Merge (`data/prime-unzugeordnet.json`, Spalte „keine einzige Folge").
**Nachgeschärft (PR 1352, 16.10.2026):** Ein Platzhalter-Titel („Folge n“, „Episode n“, „Ep. n“, „E n“, „#n“) ist kein Anker; „Folge 3: Der Sturm“ bleibt einer. Ein Datum, das zwei oder mehr Anbieter-Folgen tragen, belegt keine davon (Prime gibt Kauftiteln oft allen Folgen dasselbe Datum). Die Probe zählt verschiedene getroffene Folgen, nicht Zeilen. Reihenfolge in `entscheideZuordnung`: eigene Anker zuerst; trifft keiner, schlägt ein belastbarer Titel-Beleg (Kennung/Adresse oder genauer Name, alle Zeilen mit gleichen Tonspuren) die Probe; danach die Probe, und zwar auch bei Titeln ganz ohne Anker (gemessen: 273 von 2.921 Titeln ohne Anker, 176 davon mit einem Geschwister mit Anker); sonst offen. Prüfung des echten Ablaufs: `pipeline/check-zuordner-ablauf.ts` (Kulisse, in `check:logic`).

## Kanal je gelesener Seite; Kanal-Gruppen ohne Deutsch aussortieren (16.10.2026)

- **Häkchen je Seite:** `rohDeutsch()` (`lib/kanal-titel.ts`) entscheidet "Kanal" über die gelesene Seite der Rohfolgen (`seite`, "Amazon-Seite <ASIN>" in der Kanal-Notiz), nicht über die Prüflisten-Adresse. Ohne gelesene Seite gilt die Adresse, eine Suchadresse nie. Bau-Vergleich 16.10.2026 (Ersatz-Cache): 5 Prime-Verweise gewinnen das Häkchen, 4 Naruto-/Patema-Filme verlieren es, weil ihre Seite ein Kanal ist (vorher hing das Häkchen an der Folgen-ASIN).
- **Aussortieren:** `lib/kanal-aussortieren.ts` nimmt offene Gruppen aus `prime-unzugeordnet.json`, wenn (a) keine Folge Deutsch nennt, (b) genau eine gelesene Seite von einem Kanal-Beleg desselben Titels genannt wird, (c) der Titel eine andere Adresse mit Deutsch hat. Die Zeilen stehen verschoben in `data/prime-kanal-aussortiert.json` und sind im Briefkasten abgehakt. (c) liest `prime-zugeordnet.json` des Vorlaufs; Deutsch aus demselben Lauf zählt erst im nächsten.

## Deploy aus dem geprüften Build (16.10.2026)

Der Deploy nach einem Merge baut nicht neu, wenn die PR-Prüfkette genau diesen Quelltext schon gebaut und geprüft hat. Job `herkunft` in `deploy.yml` (`tools/deploy-aus-build.mjs`): PR zum Squash-Commit holen (`/commits/{sha}/pulls`, `merge_commit_sha` gleich dem Commit), den Lauf der PR-Prüfkette suchen, dessen Pflicht-Check `PR-Prüfkette` (Sammeljob) grün ist (ein noch laufendes PR-Aussehen stört nicht), das Pages-Artefakt (`github-pages`, Job `bau`) laden und prüfen, dass `version.json` → `baum` gleich `git rev-parse HEAD^{tree}` des Commits ist. Außerdem darf der PR unter `.github/` nur Workflows ändern, die weder Kette noch Deploy sind (`githubUnbedenklich`: `pr-pruefung.yml`, `deploy.yml` und jede Action zählen; ein PR, der sie ändert, könnte sonst die Prüfung selbst verfälschen oder anders bauen als der Deploy; seit 16.10.2026 abends, vorher zählte jede Datei unter `.github/`). Treffer: Artefakt wird unter dem Namen `github-pages` neu hochgeladen, `build` und `pruefen` entfallen, `deploy_hart` läuft sofort. Jeder andere Fall (main ist inzwischen weitergewandert, Daten-Commit, Workflow-PR, `[schlank]`, Artefakt nach 3 Tagen abgelaufen, jeder Fehler beim Holen) ergibt „kein Treffer“ und den bisherigen Weg. `pruefen` des Deploys ist durch die Kette ersetzt: `check:pfade` und `check:search` stehen dafür seit diesem Umbau in `check:vor-commit` und im Teiljob `uebrige`. `version.json` → `v` trägt bei Treffer die Kennung des Prüflaufs (Merge-Ref), nicht des main-Commits; sie muss nur eindeutig sein. Wächter: `tools/pr-kette-pruefen.mjs` erlaubt den Upload nur als letzten Schritt von `bau` mit fester Form; `tools/deploy-aus-build.test.mjs` hält Auswahl, Baumvergleich und die Verdrahtung. Messwerte vorher (10 Deploys 16.10.2026, 10:59–14:36 UTC): Lauf 163–282 s, Median 180 s; `pruefen` 90–138 s ist der längste Pfad, `build` 58–103 s, `deploy_hart` 13–48 s.

**Trefferquote (gemessen 16.10.2026, `node tools/deploy-aus-build-messen.mjs 20`, die 20 PR-Merges #1346–#1373):** 4/20 mit der alten `.github/`-Regel, 6/20 seit `githubUnbedenklich`. Die 14 Fehlschläge: 8 Quelltext ist auf main weitergewandert (ein anderer PR wurde nach dem letzten Kettenlauf gemergt; Merges kommen in Schüben), 2 Baum gleich, aber der PR ändert Kette, Deploy oder Action, 4 nur Daten (`public/data`, `data/`; Bestandsbau und Sammler committen alle paar Minuten). Daten über den geholten Bau zu legen ist kein Ausweg: `public/data` wird beim Bau verarbeitet, nicht nur kopiert (`buildId` = Hash der Daten, per `define` ins Bündel und in die Vorlade-Zeilen von `index.html`; Teilseiten und Startseiten-Inhalt aus `build-share-pages.ts`), ein Bau mit alten Daten und neuen Dateien bräche die Cache-Kennung. Selbst dann läge die Obergrenze bei 10/20. Mehr Treffer bräuchte eine Kette, die nach jedem Merge den Stand main+PR baut (Merge Queue, nur bewertet, nicht eingerichtet: der Bestandsbau pusht alle paar Minuten an ihr vorbei direkt auf main; wie GitHub die Gruppen dann neu baut, ist nicht gemessen).

## Deploy aus Build trotz Daten-Commits: Abdruck (17.10.2026)

Häufigster Fehlschlag des Deploys aus dem geprüften Build: Zwischen Kettenlauf und Merge kam ein Commit, der nur Dateien änderte, die der Seitenbau nicht liest (Bestandsbau und Sammler unter `data/`, `status.md`, Listen in `daniel-zum-abarbeiten/`, `tools/umfang-grenzen.json`). Seitdem trägt `version.json` neben `baum` einen `abdruck` (`tools/bau-eingaben.mjs`): SHA-1 über `git ls-tree -r -z HEAD`, bei freien Pfaden (`frei()`) nur Art und Name, bei allen übrigen und den deklarierten Bau-Eingaben (`BAU_EINGABEN`: `data/kennungen.json`, `data/cartoon-umzug.json`, `data/patchnotes/`) die volle Zeile. Weicht `baum` ab, aber der Abdruck des Merge-Commits stimmt, liefert der Deploy den geprüften Bau aus (Grund im Log: „main seither nur mit Dateien weitergewandert, die der Bau nicht liest“). Neue, gelöschte oder umbenannte freie Dateien verschieben den Abdruck. Wächter: `npm run build` führt nach den Prüfungen alles ab `vite build` (`patchnotes-ausliefern`, `daten-adressen-pruefen`, `build-share-pages`, `check-teilseiten`, `start-budget`, `dateibudget`) unter der Spur `tools/bau-eingaben-spur.cjs` aus (jeder Node-Prozess, jede fs-Funktion); liest der Bau einen freien Pfad außerhalb von `BAU_EINGABEN`, fehlt der Abdruck (Warnung im Log) und der Deploy baut neu. Die Spur scheitert geschlossen: jeder Prozess und Thread hängt jeden Pfad sofort an (Aliase wie Junction, `\\?\`, `/proc/self/cwd` aufgelöst); der Haupt-Thread jedes Prozesses muss mit `ende` schließen (letzte Zeile, sonst Absturz oder wiederverwendete PID), Threads nicht (tsx-Ladethreads enden per `terminate()`, Runde 3). Lief gar kein Node-Prozess, gibt es keinen Abdruck. Unterprozesse und Worker mit eigener oder geleerter env bekommen Spur und Vorlader nachgereicht; `cpSync`/`cp` auf Wurzel, `data`, `docs`, `daniel-zum-abarbeiten` oder `tools` gilt als Lesen freier Pfade. Jeder Programmstart steht mit argv in der Spur; erlaubt sind nur Node (nur, wenn das Kind die Kennung seines Starts in seine eigene Spur-Datei geschrieben hat; ein Programm, das nur node heißt, schreibt keine), der esbuild-Dienst (`--service=x.y.z [--ping]`), `net use` (Vite unter Windows) und die git-Aufrufe aus `GIT_ERLAUBT` im Wortlaut. Jeder andere Start und jedes `process.binding` heißt: kein Abdruck. Native Module (`process.dlopen`) sind nur die gemessenen drei erlaubt (Rollup, lightningcss, Tailwind oxide); lightningcss `bundle*` ist unerklärt, jede Quelle des Tailwind-`Scanner` zählt wie ein ganz kopierter Ordner, samt dem Ordner, auf den `pattern` zeigt (Tailwind liefert `base` = Ordner der CSS-Datei und `pattern` = roher `@source`-Text; Runde 5). `process.loadEnvFile` und `node:sqlite` (`import`, `require`, `getBuiltinModule`) lesen in Node selbst und sind unerklärt. Die Ausgabe des git-Aufrufs, der in die Seite eingeht (`PATCHNOTES_LOG`, Datum der Patch Notes), steht im Abdruck; ein PR mit eigener Patch Note trifft deshalb nach dem Squash nicht mehr (andere Commit-Zeit). Der Bau-Befehl in `package.json` darf in der Spur nur `vite build`, `tsx pipeline/<name>.ts` und die festen Schritte `daten-adressen-pruefen`, `start-budget`, `dateibudget` (`FESTE_SCHRITTE`) verketten (`befehlErlaubt`), davor nur die festen Prüfungen, dahinter nichts (Test); kein `@source`/`source(…)` einer CSS-Datei zeigt aus `web/` heraus (Test). Bei Erfolg steht im Log `Spur: N Zugriffe, M Prozesse und Threads, 0 unerklärt, Abdruck …` (lokal 17.10.2026: Node 24 mit 6, Node 22 mit 8 Spur-Dateien). Offene Grenzen: `realpathSync.native` (liefert nur Namen); `require` eines Ordners, dessen `package.json` (`main`) Node selbst liest (die Datei, auf die `main` zeigt, wird danach über fs gelesen und steht in der Spur, die `package.json` nicht). Die Konfiguration bündelt esbuild außerhalb der Spur, deshalb prüft `tools/bau-eingaben.test.mjs` ihre statischen Importe. Beleg der Gleichheit: Artefakt der Kette gegen Neubau des Deploys für #1450 und #1447 (beide genau dieser Fall), je 10.169 Dateien, nach `v`/`baum` und den beiden Chunk-Namen, die `v` enthalten, 0 Abweichungen. Trefferquote an den 30 PR-Merges #1339–#1450: 11/30 nur mit Baum, 16/30 mit Abdruck (neu: #1405, #1408, #1431, #1447, #1450); seit Runde 3 15/30, weil #1450 eine eigene Patch Note mitbrachte. Datenbau-Commits (Bestandsbau, kein PR) bleiben ohne Treffer: sie ändern `public/data`, und daraus entstehen `buildId`, Bündel-Hashes und alle Teilseiten (0 von 11 Datenbauten seit 16.10. ohne Änderung an `public/data`). Vergleich der Ansätze: [deploy-daten-schnellweg-2026-10-17.md](../../daniel-zum-abarbeiten/berichte/deploy-daten-schnellweg-2026-10-17.md).

## check:logic läuft je Inhalt einmal: Logik-Beleg (26.10.2026)

Ein Datenfix ließ `check:logic` (~3,5 min) bis zu viermal laufen: PR-Kette, Vorprüfung „Neue Handbelege prüfen“ im Bestandsbau, `commit-data.sh` und Deploy-Job `pruefen`. Die Prüfung liest keinen Bestand (`tools/bestand-sperre.cjs`, Ausnahmen `hoechstens: 0`), hängt also nur an Dateien außerhalb von `public/data/`, `data/cache/` und den Bot-Dateien ohne Leser (`istDatenpfad`, dieselbe Liste wie `tools/neuversuch-art.mjs`). `tools/logik-beleg.mjs` bildet darüber einen Abdruck (Pfad und Inhalts-Hash jeder Datei nach git, ohne ignorierte). War `check:logic` für einen Abdruck grün, gilt es für jeden Stand mit demselben Abdruck:
- `commit-data.sh` schreibt nach grünem `check:logic` (oder bei gleichem Abdruck wie die Vorprüfung, Datei `LOGIK_GRUEN_DATEI`) die Zeile `Logik-geprueft: <Abdruck>` in die Nachricht des Bau-Commits. Ohne grünes `check:logic` für genau den Inhalt des Commits steht keine Zeile da.
- Die Vorprüfung im Bau schreibt ihren Abdruck nach grünem `check:logic`; ändert der Bau danach nichts außerhalb der Datenpfade, entfällt das zweite `check:logic` in `commit-data.sh`.
- Der Deploy-Job `pruefen` liest die letzten 30 Commits (`fetch-depth: 30`, `filter: blob:none`) und lässt `check:logic` aus, wenn ein Commit mit der Adresse des Bau-Autors den Abdruck des ausgecheckten Stands belegt. Jeder Fehler, ein fremder Autor, ein anderer Abdruck oder ein Beleg außerhalb der letzten 30 Commits heißt: die Prüfung läuft wie bisher. `check:pfade` und `check:search` (lesen `public/data`) laufen immer.

Erster Live-Befund (26.10.2026, Bau 40336735493, Bau-Commit 678b76cc2): Der Beleg `8ce40750…` galt dem Deploy nicht (er rechnete `0f56f0bc…`). Ursache: `data:dub-checks` überschreibt `data/dub-pruefliste-zurueckgestellt.md` bei jedem Bau, aber weder `QUELLEN` noch `ERZEUGNISSE` (`tools/quellen-liste.sh`) nehmen sie in den Commit (letzter Commit 29.09.2026); der Abdruck der Arbeitskopie enthielt sie, der des Commits nicht. Nachgestellt: `data:dub-checks` im Checkout von 678b76cc2 ergibt mit der alten Rechnung genau `8ce40750…`. Seither (1) zählt die Datei nicht im Abdruck (`NIE_COMMITTET` in `tools/logik-beleg.mjs`; ein Test hält fest, dass nur der Schreiber `pipeline/report-dub-checks.ts` sie nennt), (2) schreibt `zeile` die Beleg-Zeile nur, wenn kein zählender Pfad ungestagt oder neu ist (Arbeitskopie = Commit); sonst steht auf stderr `::warning::Logik-Beleg entfällt, der Commit nähme nicht mit: <Pfade>`. Schreibt ein künftiger Bau-Schritt eine weitere nie committete Datei, zeigt der Lauf sie dort, und sie kommt in `NIE_COMMITTET` (wenn sie keiner liest) oder in `QUELLEN`.

Messung (80 Bau-Commits bis 26.10.2026, `git diff` je Commit gegen den Elter): 54 ändern nur Datenpfade; die übrigen auch Bot-Dateien mit Lesern (z. B. `data/news-historie.json`), die beim Bau vor `check:logic` entstehen und damit im Beleg stehen. Test: `tools/logik-beleg.test.mjs`, Szenarien in `tools/commit-data-test-beleg.sh`.

## PR-Datenbau: Auslieferungsprüfung vor dem Merge (16.10.2026)

`pipeline/lib/pruefung.ts` lief nur im Bestandsbau; PR 1368 setzte `kanal`, ein späterer Bauschritt vererbte es anders, main brach ab. Der Job `PR-Datenbau` in `pr-pruefung.yml` (im Sammeljob `needs`) fährt `npm run data:build` ohne Commit auf dem Cache `anilist-cache-` (nur lesen, wie `bestand-bauen.yml`); ohne Cache rot statt leerem Bau. Bewusst ohne Pfadfilter: die Eingaben des Baus reichen bis `web/src/lib` (news-text, i18n); der Job läuft parallel und ist kürzer als die längste Kette. Form fest in `tools/pr-kette-datenbau.mjs`. Der Cache ist so alt wie der des Bestandsbaus; ein lokaler Bau mit altem `data/cache` bricht ab, die CI nicht. Eine Teilbau-Option (Phasen ab 13) gibt es nicht: die Phasen reichen Zwischenstände im Speicher weiter.

**Bestandsprüfungen im selben Job (16.10.2026):** Letzter Schritt von `PR-Datenbau` ist `node tools/pr-bestand-vergleich.mjs HEAD^1`: jede Prüfung aus `check:bestand` einzeln (die Skripte von `check:bestand` nacheinander, die Liste mit `--alle` daneben), kein Abbruch beim ersten Fehler. Anlass: PR 1377 hätte `check-cartoon-wege-bestand` erst im Bestandsbau nach dem Merge rot gemacht. Lokal gemessen 16.10.2026: rest ≈ 36 s, Liste ≈ 42 s, parallel 41 s; CI 34 s. Position und Befehl fest in `tools/pr-kette-datenbau.mjs`.

**Abgebrochener Kettenlauf (25.10.2026):** Ein Push bricht den älteren Lauf der PR-Prüfkette ab (`cancel-in-progress`); der Sammeljob `PR-Prüfkette` endete dann mit Exit 1 und zeigte einen roten Check neben dem neuen (Messung 25.10.2026, letzte 50 Läufe: 14 mit allen Teiljobs `cancelled`, 1 Mix aus `success` und `cancelled`). Das Urteil steht in `tools/kette-urteil.mjs` (Test dort): alle `success` grün, alle `cancelled` abgebrochen (das Skript bricht den eigenen Lauf per `force-cancel` ab, der Sammeljob endet als `cancelled`; Exit 0 zählte als `success`, ein gewöhnliches zweites `cancel` ließ den Schritt weiterlaufen, gemessen an PR 2053), sonst rot (auch ein Mix: Neustart, wenn schon Teiljobs fertig waren, bleibt rot); der Wächter `pr-kette-pruefen.mjs` hält Checkout, diesen einen Aufruf, `GH_TOKEN` und die Rechte `contents: read`, `actions: write` fest.

**Doppelstart und rotes „PR-Prüfkette“ (Messung 29.10.2026, `gh run list --workflow pr-pruefung.yml --limit 80`: 26 abgebrochen, 41 success, 4 failure, 7 skipped):** Die Doppelläufe auf demselben Kopf kommen von `tools/pr-nachrechnen.mjs` (zweimal schließen und öffnen, Zeitleiste PR 2341: `closed/reopened` um 10:20:07 und 10:20:16); `concurrency` bricht den ersten Lauf ab, sein Sammeljob endet als `cancelled`. Das blockiert keinen Merge: GitHub wertet je Check-Name den jüngsten Eintrag (PR 2340 wurde mit 3 `CANCELLED` + 4 `SUCCESS` gleichen Namens gemergt). Rot zeigt nur `gh pr checks`, solange der Sammeljob des neuen Laufs noch nicht gestartet ist (PR 2341, 10:31: abgebrochener Eintrag allein, neuer Lauf in Arbeit). Bewusst so gelassen: ein „abgebrochen mit Nachfolger = success“ im Sammeljob würde das Pflicht-Häkchen setzen, während der Nachfolger noch läuft (vorzeitig mergbar), und `!cancelled()` ließe den Sammeljob `skipped` enden (zählt als bestanden, ein von Hand abgebrochener Lauf ohne Nachfolger wäre grün). Angepasst ist der Leser: `tools/liegegut.mjs` wertet je Name nur den jüngsten Eintrag (vorher blieb ein Kopf mit altem `CANCELLED` neben `SUCCESS` auf „offen“, und „Freigabe + grün + ruhend“ meldete nie). `tools/pr-checks-stand.mjs` tat das schon (jüngste Id je Name).

**Nur was auf main grün ist, sperrt den PR (17.10.2026):** Ist auf dem PR-Bau etwas rot, baut der Schritt die Basis `HEAD^1` (Spitze von main im Merge-Ref; Checkout mit Tiefe 2) in einem eigenen Worktree mit demselben Cache (`node_modules` und `data/cache` als Verweis) und fährt dort genau die roten Prüfungen. Auch dort rot = geerbt (`::warning::`), sonst rot. Eine Prüfung, die es auf der Basis nicht gibt, und ein Listenlauf ohne einzelne rote Prüfung (Liste unsortiert) und eine Prüfung, die ins Repo schreibt (auch neben geerbten roten), zählen immer; scheitert der Basisbau, zählt jedes Rot. Ein Vergleich gegen den committeten Bestand reicht nicht: ein roter Bestandsbau committet keine Erzeugnisse, `public/data` bleibt der letzte grüne Stand (17.10.: `check-jw-vertrauen-bestand` rot im Bestandsbau, auf dem committeten Bestand grün). Eine schon rote Prüfung mit mehr Verstößen als auf der Basis ist neu (25.10.2026): gezählt wird nur die Zeile `VERSTÖSSE: <n>`, die jede Bestandsprüfung zuletzt ausgibt (`tools/pr-bestand-zaehlen.mjs`); fehlt sie, meldet der Schritt `::error::` und die Prüfung gilt als rot, nie als 0 und nie als geerbt. Eine neue Bestandsprüfung gibt die Zeile in jedem Ausgang aus (grün `0`). Test: `tools/pr-bestand-vergleich.test.mjs` (Git-Kulisse, echter `check-logic-alle.mjs`).

## TMDB-Staffel nur im Startjahr des Titels (16.10.2026)

`findeStaffel` nahm bei genau einem Längentreffer die Staffel ohne Jahrprobe. `passendeStaffel` (`shared/folgen-anker.ts`) verlangt das gleiche Startjahr; kein Nachbarjahr (die sechs Fälle mit einem Jahr Abstand: 3 falsch, 2 richtig, 1 unklar, Hand-Urteil im PR). Die Laufzeit prüft weiter nur der Reihenkopf: beim eigenen Eintrag verlor sie 5 richtige gegen 1 falsche Staffel. Gemessen: 734 Titel hatten eine Staffel, 723 behalten sie; `ordneFolgenZu` nimmt zuerst aniSearch, alle 11 Fälle haben aniSearch-Folgen, der Schaden in `folgen-zuordnung.json` war also nur möglich, nicht belegt.

## Abhaken in einem Aufruf: HTTP 500 in jedem Bestandsbau (16.10.2026)

**Befund:** Jeder Bestandsbau schickte rund 2.900 Ids an `POST /pruefung` (`rohfolgenUebernommen`, `pipeline/lib/rohfolgen-abschluss.ts`) und bekam HTTP 500 (Lauf 38947390430). Ursache, lokal in workerd nachgestellt (2.100 Prime-, 300 Meldungs-, 600 Titelzeilen-Ids): `adressen()` in `worker/src/titelzeile-aufgaben.ts` band je Titelnummer ein `?`, ab 101 Titeln „too many SQL variables“ (D1 bindet höchstens 100). Davor liefen schon die `UPDATE` auf `prime_folge` (eine je 50 Ids, ohne `uebernommen = 0`) durch. Weil die Marke `export/_ungueltig-offen` nur nach Erfolg gesetzt wurde, blieb der R2-Auszug `offen-*` stehen: jeder Bau holte dieselben 22.557 Rohfolgen und schrieb dieselben rund 2.000 Zeilen erneut (Insights 16.10.: 1.053 × 50 = 52.650 Schreibzeilen von 62.634). Selbst ohne die Bindungsgrenze lagen 42 + 6 Abfragen plus zwei je Titel über 50 Abfragen je Aufruf. Eingeführt mit PR 1155 (Titelzeile, 13.10.), dort als „offen“ notiert; die Tests schickten drei Ids.

**Fix:** `prime_folge`, `pruefung.roh_uebernommen` und `pruefung.uebernommen` je ein `batch` (50 Ids je Anweisung, nur `= 0`), Titelzeilen ein Lesen über `json_each` und die UPDATEs im `batch` (100 je Stapel; ein Titel, der zwischen Lesen und Schreiben geändert wurde, bleibt offen und kommt mit dem nächsten Bau wieder). Die Marke steht auch nach einer Ausnahme. Gemessen in workerd: 5 Abfragen statt 49 + Abbruch, Wiederholung 0 Schreibzeilen statt 2.400.

**Ansätze (workerd, 2.100 Prime-Ids):** Untergrenze `= 0` in der alten Schleife: Wiederholung schreibfrei, aber 42 Abfragen allein für Prime, der Aufruf bricht weiter ab. `json_each` in einer Anweisung: 12.599 gelesene Zeilen beim ersten, 4.201 beim zweiten Mal. `batch` aus 50er-Anweisungen (gewählt): 4.200 und 4.200, je eine Abfrage des Aufrufs. Dass ein `batch` als eine Abfrage zählt, stützt sich auf die Prime-Meldung vom 19.09.2026 (93 Anweisungen in einem Stapel, `erweiterung.md`).

**Wächter:** `tools/worker-abhaken.test.ts` (in `check:worker`): 3.000 Ids, 200 Titelzeilen, D1-Attrappe mit 100 Bindungen und 50 Abfragen; rot bei Status ≠ 200, mehr als 50 Abfragen, Schreibzeilen in der Wiederholung oder fehlender Marke nach Teilerfolg.

## Titelzeilen: Wiederöffnen, Löschen und Stapel unter 50 Abfragen (21.10.2026)

**Grenze (Cloudflare, Workers Limits, 21.10.2026 abgerufen; am 23.10.2026 erneut gelesen, robots.txt von developers.cloudflare.com: „User-agent: * … Allow: /“):** „A subrequest is any request a Worker makes using the Fetch API or to Cloudflare services like R2, KV, or D1“; 50 je Aufruf in der freien Stufe. D1-Abfragen zählen also; ein `batch` zählt als eine (gemessen 19.09.2026; die Doku sagt dazu nichts: Workers Limits, 23.10.2026 abgerufen, nennt „Subrequests per invocation | 50“ und „Each subrequest in a redirect chain counts against this limit“; D1 Limits nennt „Queries per Worker invocation … 50 (Free)“ und „Limits for individual queries … apply to each individual statement contained within a batch“ — ob ein Stapel als 1 oder N zählt, steht nirgends. Tests rechnen deshalb vorsichtig jede Anweisung einzeln, neuer Code schreibt in einer Anweisung).

**Gemessen (Attrappe mit 50er-Grenze, 215 Disney+-Titel, vor dem Fix):** `reoeffnen` brauchte 1 + 2 je Titel und brach nach der 50. Abfrage ab (nur 24 von 215 Titeln wieder geöffnet); Löschen nach Ids (`loescheTitelFolgen`) ebenso. Ein Netflix-Anbieter mit rund 1.000 Titeln wäre bei 2.000 Abfragen gelandet. Abhaken war schon gebündelt (16.10.).

**Fix:** `titelzeile-buendel.ts` (`aendereGebuendelt`): ein Lesen, die `UPDATE`s im `batch` (100 je Stapel), Zusammenstöße der Versionsprüfung in der nächsten Runde (höchstens `VERSUCHE`). 215 Titel: 5 Abfragen (Wiederöffnen), 4 (Löschen). Löschen nach Adresse und Nummern bleibt einzeln (eine Adresse, wenige Zeilen).

**Stapel:** Die D1-Abfragen von `titelzeilenImStapel` zählen zum `ANFRAGEN_BUDGET` (44); der Rest des Stapels (`verarbeiteStapel`) bekommt nur noch, was übrig ist. Eine Gruppe, die nicht mehr hineinpasst oder durch Zusammenstöße das Budget reißt, antwortet 503 „Subrequest-Budget des Stapels überschritten“ (die Erweiterung schickt neu). Ohne Zusammenstöße waren es höchstens 30 Abfragen (zehn Gruppen zu je 3); gerissen wurde die Grenze nur mit Wiederholungen. Wächter: `tools/worker-abhaken.test.ts` (Wiederöffnen/Löschen), `tools/worker-titelzeile-stapel-budget.test.ts` (Stapel), beide in `check:worker`.

## Wecker-Wache zählt einen roten Start nicht als erledigt (16.10.2026)

Die Wache (`wecker-wache.yml`) wiederholte einen roten Lauf erst nach der vollen Frist (30 h), weil jeder nicht abgebrochene Start zählte. Jetzt entscheidet `tools/wecker-wache-entscheid.mjs`: Ist der neueste Start rot (failure, timed_out, startup_failure; nie cancelled, nie skipped — Abbrüche sind gewollt und zählen als Start), der letzte Erfolg älter als die Frist und der rote Start älter als 6 h, wird einmal nachgeholt; höchstens zwei Starts seit dem letzten Erfolg, danach schweigt die Wache bis zur vollen Frist (kein Dauerfeuer bei dauerhaft rotem Lauf). `meldungskopie.yml` fehlte am 16.10. um 03 UTC, weil ein Handlauf (15.10. 12:00, rot) den Mindestabstand von 20 h sperrte (jetzt 13 h) und der Worker nach PR 1244 vermutlich noch nicht neu ausgeliefert war. **Eine Änderung an `shared/weckplan.ts` wirkt erst nach `cd worker && npx wrangler deploy --config wrangler.toml`.**

## Alarm „Bestandsbau seit N h rot“ (24.10.2026)

**Anlass:** `bestand-bauen.yml` war vom 21.10. 18:10 bis 23.10. 13:07 UTC rot (46 rote Läufe in `gh run list --created 2026-10-21..2026-10-23`, Schritt „Änderungen committen“; `public/data` blieb 43 h unverändert). Gemessen: Die Wache erlaubt dem Workflow 36 h (`FRISTEN_STUNDEN` in `wache-woechentlich.mjs`, Takt ist stündlich), das Wachen-Urteil sah ihn erst im Eintrag vom 23.10. 09:12 (39,9 h). Die ROT-/STILLSTAND-Zeilen von `laeufe-aufraeumen.mjs` (Grenze 8 h) standen nur in der Konsole eines von Hand gestarteten Laufs; der Worker-Verlauf von damals ist nicht mehr abrufbar (50 Einträge), ob sie gedruckt wurden, ist deshalb nicht belegbar.
**Fix:** `tools/bestand-rot-alarm.mjs` liest nur GitHub (`gh run list --workflow bestand-bauen.yml`): letzter grüner Lauf älter als 6 h **und** danach rote/abgebrochene Läufe → Zeile `ALARM Bestandsbau seit N h rot …`. Übersprungene Läufe (Push ohne Bau) zählen nicht; nicht lesbar heißt `ALARM?`. Ausgabe in `laeufe-aufraeumen.mjs` (vor dem Worker-Abruf, also auch bei Worker-Ausfall) und als Dossier-Datei `12-bestandsbau-alarm.txt` des Wachen-Urteils (Anleitung: ALARM = Lage `befund`, Absatz „komplett falsch“). Test: `tools/bestand-rot-alarm.test.mjs`.

**Eskalation stummer Quellen (25.10.2026):** Die Wochenwache meldet eine Quelle mit überschrittener Frist (`FRISTEN` in `tools/quellen-fristen.mjs`, Standard 4 Tage) nur in den Posteingang; Anlass: `cr-einzelwerke`/`cr-filmbloecke` 27 Tage bei 21 erlaubten. Kehrt das Schweigen über die **doppelte** Frist hinaus wieder (`data/source-health.json`, `lastOk`; „noch nie“ zählt), druckt `laeufe-aufraeumen.mjs` je Quelle `ALARM Quelle <name> seit N Tagen ohne Erfolg (Frist F Tage, Eskalation ab 2F)`; bei den beiden CR-Läufen mit dem Hinweis, dass es Daniels Handgriff ist. Regel: `tools/wache-eskalation.mjs`, Test `tools/wache-eskalation.test.mjs`. Liegt nach dem letzten Lauf der Quelle (`lastRun`) ein Commit auf main, der ihren Schreiber (`recordSource('<name>', …)` in `pipeline/`) oder einen Workflow mit dessen `npm run`-Skript berührt, hängt die Zeile „ — Änderung an Schreiber oder Workflow gemergt <Datum> (<Kurz-SHA>), nächster Lauf steht aus“ an (`tools/wache-fix-gemergt.mjs`, Test dazu; der Alarm bleibt). Nicht erfasst: die Workflow-Fristen der Wochenwache (`wache-woechentlich.mjs`).

**Fristen der Wochenwache (27.10.2026):** Tabelle in `tools/wache-fristen.mjs`: 3 × Takt, mindestens 3 h, nur verkürzen (`refresh-hourly.yml` 3 h, `adn-laufende.yml` 18 h); Ausnahme `bestand-bauen.yml` 8 h (gemessene Lücken bis 6,2 h). `deploy.yml` bleibt bei 48 h (Lücken bis 5,1 h, kein fester Takt). Prozess-Test: `tools/wache-woechentlich-prozess.test.mjs`.

**Erweiterung (24.10.2026, Schritt 3 der Verklemmungs-Vorbeugung):** `rotAlarmText` liefert drei Prüfungen: (1) wie oben; (2) `ALARM Bestandsbau seit N h rot mit K verschiedenen Fehlerschritten`: seit dem ersten roten Lauf nach dem letzten grünen > 1 h und die Fehlschritte (`gh run view <id> --json jobs`, höchstens die 5 neuesten roten Läufe) nennen ≥ 2 verschiedene „Job: Schritt“; (3) `ALARM Deploy seit N h ohne Erfolg` (`deploy.yml`, dieselbe Regel wie (1), Grenze 6 h; übersprungene Läufe zählen nicht). Nicht gemessen/gebaut: „≥ 3 rote PRs an derselben Prüfung“ (bräuchte je PR einen Abruf der Prüfungen, zu viele Abrufe je Wachphase).

## Rohfolgen und Vorfälle erst nach dem Commit quittieren (17.10.2026)

**Befund:** Lauf `bestand-bauen` 38959396065 (16.10. 20:03Z) ordnete 1029 Adressen (2771 Folgen) zu und hakte 13350 Rohfolgen ab — im Schritt „Rohfolgen zuordnen". Danach scheiterte „Datensatz bauen", „Änderungen committen" lief nicht, `data/prime-zugeordnet.json` blieb alt. Die Rohfolgen waren in D1 schon `uebernommen = 1`; der nächste Bau ordnete 0 Adressen zu. Dasselbe Muster beim Löschen der Vorfälle (`fetch-vorfaelle.ts`).
**Fix:** Zuordner und Vorfall-Abruf merken die Kennungen nur (`data/cache/quittung-offen/`, `pipeline/lib/spaeter-quittieren.ts`; seit Runde 2 von PR 1426 auch die Meldungen, ohne Schalter); die Schritte „Rohfolgen abhaken" (`npm run data:rohfolgen-abhaken`) und „Vorfälle löschen" (`npm run data:vorfaelle -- --nur-loeschen`) laufen nach „Änderungen committen", wie „Meldungen abhaken" seit 17.09.2026. Endet der Commit-Schritt rot, bleibt alles im Briefkasten und kommt beim nächsten Lauf erneut (Zusammenführung über `url#asin`, also folgenlos).
**Wächter:** `tools/quittung-nach-commit-waechter.mjs` (in `check:logic`) prüft je Workflow-Job das geparste YAML: Quittungsschritte nach dem ersten `commit-data.sh`, merkende Schritte davor samt Quittung; in `bestand-bauen.yml` Commit- und Quittungsschritte Schlüssel für Schlüssel.
**Lehre:** Ein Kommentar „steht committet im Repo" ist keine Zusicherung. Wer im Worker etwas vergessen lässt, belegt die Reihenfolge am Workflow, nicht am Skript.
**Nachschärfung (Runde 2, 17.10.2026):** Der Prüfer fand 20 Schreibweisen (`env`, `timeout`, `bash -c`, Anführungszeichen, `cd pipeline &&`, `npm run x --schalter` ohne `--` …), die der Wächter nicht sah; ein Parser für Bash bleibt unvollständig (`eval`, Variablen, Skriptdateien). Die Sperre sitzt deshalb jetzt in den Skripten: Merker liegen in `data/cache/quittung-offen/`, nur `tools/commit-data.sh` verschiebt sie nach grünem Commit (oder „Keine Änderung") nach `quittung-frei/`, und quittiert wird nur von dort. Falsche Schalter brechen ab (`pipeline/lib/schalter.ts`): npm 11.6.2 reicht `npm run x --y` nicht durch, sondern setzt `npm_config_y`. Belege: `check-quittung-sperre.ts`, `tools/quittung-umgehungen.test.mjs` (23 Formen echt ausgeführt), `commit-data-test.sh`. Der Wächter ist nur noch Vorwarnung.
**Lehre:** Eine Reihenfolge, die ein statischer Wächter über frei geschriebenen Shell-Text erzwingen soll, gehört als Zustand in den Ablauf (Datei wandert erst nach dem Commit), nicht in einen Parser.

## Sammler prüfen ihren Fund vor dem Pull Request (17.10.2026)

**Anlass:** Der Sammler-PR 99222b577 (04:01 UTC) brachte `anisearch-dub-ids.json` und `anisearch-eintraege.json` in Widerspruch (Kennung 18892); `check-bild-und-synchro.ts` (in `check:logic`) hätte es gefangen, lief aber nur im Bestandsbau, und `main` war über sieben Stunden rot. Daten-PRs überspringen die PR-Kette, und `check:logic` brach in CI am ersten roten Check ab.
**Regel:** `tools/quellen-pr.sh` (alle Sammler: Aktion `einreichen` und drei Claude-Läufe) fährt nach dem Push `npm run check:logic -- --alle` (`tools/quellen-pruefen.sh`, Frist 420 s ohne `GH_TOKEN`; gemessen 17.10.2026: 54 s in der CI, knapp 3 min lokal, kein Chromium nötig). Rot (auch bei Fristablauf oder Startfehler): Der PR entsteht trotzdem, Titel `[Prüfung rot] …`, Label `pruefung-rot`, rote Prüfungen im Text, Warnung im Lauf (Lauf bleibt grün); **gemergt wird er nicht**, auch nicht von `daten-pr-mergen.sh` und `claude-daten-merge.yml` (beide überspringen die Marke). Beheben, Marke aus dem Titel nehmen (`gh pr edit <Nr> --title`), `tools/daten-pr-mergen.sh <Nr>`.
**CI:** `check:logic` läuft bei `CI=true` immer mit `--alle` (alle roten Prüfungen auf einmal statt der ersten).
**Wächter (Runde 3, strukturell):** `tools/sammler-pruefschritt-waechter.mjs` (in `check:logic`, geparstes YAML). Statt nach Befehlstexten zu suchen (übersah `execFileSync('gh', ['pr', 'merge'])`), legt `tools/app-token-sperre.mjs` fest, wer das Token der App anime-kalender-daten sieht — nur sie mergt am Ruleset vorbei, und `daten-pr-mergen.sh` nimmt nur ihre PRs: die Secrets nur im `with` der Aktion `einreichen` oder eines Token-Jobs aus `TOKEN_JOBS`, je Job genau ein Schritt mit dem Token in fester Form (`quellen-pr.sh`, `daten-pr-mergen.sh` oder `actions/checkout`), in der Aktion nur der Schritt `pr`. Dazu: kein Workflow setzt `APP_AUTOR` oder die Prüfschalter, und Prüf- plus Vergleichsfrist lassen in jedem einreichenden Job 420 s Rest (`pruefeFristen`; knappster Job `fund-nachliefern`, 20 min). Verhalten: `tools/quellen-pr-pruefung.test.mjs`.
**Sichtbarkeit und Grenze (Runde 2/3):** Der Lauf bleibt bei Rot grün, deshalb listet `tools/laeufe-aufraeumen.mjs` (Wachphase) über `tools/rote-sammler-prs.mjs` jeden offenen `[Prüfung rot]`-PR mit Alter. Je Fund liegt höchstens einer offen: ein neuer roter PR schließt die älteren mit demselben Fund-Schlüssel (Workflow/Job/Nachricht, Kommentarzeile im PR-Text; `refresh-weekly` hat sieben einreichende Jobs). Ist die PR-Liste nicht lesbar, bleibt alles offen und der Lauf warnt.
**`main` selbst rot (Runde 2):** Rot wird mit dem Stand von `origin/main` verglichen (`quellen_neue_fehler` in `tools/quellen-pruefen.sh`, eigener Arbeitsbaum, Frist 240 s). Hat `main` dieselben roten Prüfungen schon, zählt der Fund nicht als rot (Warnung `main ist schon rot`, Einreichen und Mergen wie vor dem 17.10.); nur Fehler, die erst der Fund bringt, markieren. Vergleichbar ist nur eine Liste roter Prüfungen als ganze Zeilen; Frist, Absturz und Startfehler bleiben rot. Lücke: Verglichen wird je Prüfung (Zeile `  - <Prüfdatei>`), nicht je Fehler — ein neuer Fehler in einer auf `main` schon roten Prüfung fällt nicht auf und wird gemergt; tragbar, weil `main` dann ohnehin rot ist und der Bestandsbau es zeigt.
**Runde 4:** Jobs mit der Aktion `einreichen` haben dieselbe Umgebungsregel wie Token-Jobs (Workflow-/Job-env nur `LAUF_*`, `JOB_ANZEIGE`; keine `defaults`; der einreichen-Schritt ohne env — der Schritt `pr` erbt sie). Die Aktion gibt Nachricht und Fund über env weiter, kein `${{ … }}` im run-Text (sonst würde ein `"` in `inputs.lauf` von fund-nachliefern Code mit dem Token). `quellen-pr.sh` nimmt das Token beim Ende (`trap`) wieder aus der Remote-Adresse.
**Lücke:** Direkte Schreiber auf `main` (`delta-wache.yml`, `commit-data.sh` im Bestandsbau) laufen nicht über diese Stelle.
**Lücken der Sperre (bewusst offen):** Die Checkout-Jobs `bestand-bauen/bauen` und `delta-wache/wache` gelten nach dem Token-Schritt als vertraut (der Checkout legt das Token in `.git/config`). Ein früherer Schritt kann `GITHUB_ENV` setzen oder `tools/` im Arbeitsbaum ändern, bevor `quellen-pr.sh` läuft — die Sperre legt Form und Ort fest, nicht den Inhalt des Arbeitsbaums. Wird der Schritt hart beendet (SIGKILL), läuft der `trap` nicht. PRs ohne App-Token bleiben ungeprüft, aber ungemergt (Ruleset; der Nachholer nimmt nur App-PRs). `rote-sammler-prs.mjs` liest `--limit 100` ohne Blättern (17.10.2026: 18 offene PRs). Der Fund-Schlüssel von fund-nachliefern enthält `Lauf ${{ inputs.lauf }}`, ändert sich also bei jeder Nachlieferung: für deren rote PRs gibt es keine Grenze, die Wachphase listet sie nur.
**Lehre:** Eine Zusicherung über Sammler-Ergebnisse gehört an die Stelle, durch die alle Sammler gehen, nicht in jeden Workflow.

## CI-Prüfer: Nachträge und Commit-Liste (17.10.2026)

- `tools/pr-nachtraege.mjs` hängt an `pr-beschreibung.txt` die Nachtrag-Kommentare und die Commit-Liste (je Commit Kurz-Hash, Betreff, Dateien) an. Es zählen Kommentare des PR-Autors und von Konten mit `author_association` OWNER, MEMBER oder COLLABORATOR.
- Anlass PR 1394: Die Claude-App hat den PR geöffnet, `gh pr view --json author` lieferte `app/claude`, die Autor-Prüfung im Workflow ließ das nicht durch, und die Nachträge stammten ohnehin vom Inhaberkonto. Drei Nachträge kamen nie beim Prüfer an; er wiederholte zweimal schon beantwortete Befunde. Der Autor kommt jetzt als REST-Login (`gh api …/pulls/<n> -q .user.login`, bei Apps `claude[bot]`).
- Ohne Commit-Liste sah der Prüfer nur den Gesamtdiff und konnte „Umbau und Verhaltensänderung nie im selben Commit“ nicht nachprüfen.
- Lehre: GraphQL (`gh pr view`) und REST liefern für App-Konten verschiedene Login-Formen; Tests für Autor-Filter brauchen einen App-PR als Fall.
- Laufzeitsperre (Runde 3): Der Schritt „Prüfer-Eingang prüfen“ (`tools/pr-eingang.mjs`) steht direkt vor den Prüfern. `ok` gibt er nur aus, wenn der Diff vollständig ist und die Beschreibung mit der Commit-Liste endet, deren letzter Commit `head.sha` ist. Gemessen an 60 PRs am 17.10.2026: die Liste endet in 60 von 60 Fällen am Kopf. Prompts und Freigabe lesen diesen Zustand. `tools/pr-pruefer-freigabe.test.mjs` fährt den `run`-Block des Freigabe-Schritts (aus der YAML gelesen) mit gh-Attrappe aus und prüft, welche Aufrufe (`--approve`, `--request-changes`, Kommentar) entstehen. `tools/pr-pruefer-ablauf.test.mjs` führt den Job bis dahin mit bash und nachgebautem `gh` aus (`tools/pr-pruefer-kulisse*.{mjs,cjs}`).
- Lehre: Statt jede Schreibweise eines Workflows per Wächter zu sperren (PR-Nummer, Pfade, `shell`, `env`), prüft man das Ergebnis zur Laufzeit an einem unabhängigen Wert (Kopf-SHA).
- Nachtrag nach einem Prüferlauf (30.10.2026): Ein als Kommentar geschriebener Nachtrag liest erst der nächste Lauf des CI-Prüfers; `gh run rerun <run-id>` des `pr-pruefer.yml`-Laufs auf demselben Kopf-Commit holt ein neues Urteil, weil der Lauf die Kommentare bei jedem Start neu über `gh api` und `tools/pr-nachtraege.mjs` abruft (`.github/workflows/pr-pruefer.yml`, Zeilen 77–83). Das Urteil lautet „ok“ mit Approval nur bei grünem Check-Stand am Kopf; sonst steht „ok, Checks rot: …“ oder „ok, Checks laufen noch: …“ am Anfang, und die Freigabe bleibt in beiden Fällen.

## Abnahme des Dirigenten gibt frei (27.10.2026)

- Anlass PR 2186: Der Dirigent nahm ab, der PR blieb gesperrt, weil nur die CI-Review (`pr-pruefer.yml`) freigab. Seit F69 („ja“, 26.10.) gibt es `.github/workflows/abnahme-freigabe.yml` (`issue_comment` created, nur PRs, Skript `tools/abnahme-freigabe.mjs` aus main, kein PR-Code, GITHUB_TOKEN wie der CI-Prüfer, kein neues Secret).
- Auslöser: Kommentar von `danielzaiser91` mit `author_association` OWNER, der wörtlich mit `## Nachtrag (Abnahme Dirigent` beginnt und einen Präfix (mindestens 9 Zeichen) des aktuellen Kopfs nennt. Dann folgt eine APPROVE-Review mit `commit_id` = Kopf, Text mit Hash und Kommentar-Link. Anderer Autor oder Präfix nicht am Anfang: nichts. Hash fehlt, zu kurz oder alter Kopf: Hinweis-Kommentar, keine Review, Exit 0.
- Der Kommentartext erreicht das Skript nur über env. Test: `tools/abnahme-freigabe.test.mjs` (über `tests-alle`). Das Ruleset verlangt weiter die grüne PR-Prüfkette; die Abnahme ersetzt nur die Review.
- Der Lauf heißt „Abnahme — Freigabe“ und steht in `LAUF_ARTEN` (`worker/src/lauf-sql.ts`, danach Worker-Deploy) und im GITHUB_TOKEN-Eintrag von `data/zugangs-register.json`.

## Stille Wege im Bestandsbau (18.10.2026)

- Anlass: Bestandsbau 17.10. 22:03 bis 18.10. 09:02 UTC zwölfmal rot, elf Stunden ohne neue Daten, der Untersucher meldete stündlich `ok`.
- Warnung ohne Grund: Der Schritt „Neue Handbelege prüfen“ suchte nur nach `✖`, `check:logic` meldet aber „<datei> ist rot“. Jetzt liefert `tools/pruefgrund.sh` den Grund (gebunden an die Formatzeilen von `check-logic-alle.mjs`, Rückfall: letzte drei Zeilen), das ganze Protokoll steht eingeklappt (`::group::`) im Schrittlog. Die Ursache steht dort nicht am Ende: Parallele Prüfungen drucken nach der roten noch weiter (gemessen 155 Zeilen bei 2.411). Übersprungene Läufe (`skipped`, 0 Schritte) melden nichts an die Statusanzeige.
- Untersucher: Ein offener PR hielt ihn zurück, auch wenn er liegenblieb (PR 1464, 11 h). Jetzt zählt ein PR nur `PR_FRIST_MS` (6 h, `tools/untersucher-logik.mjs`); danach arbeitet der Untersucher weiter. Hat er bewusst nichts getan (`claude=nein`), meldet „Lauf abmelden“ `warnung` mit PR-Nummer statt `ok`.
- `tools/commit-data.sh`: fehlt nach gelungenem Bau `public/og` oder `public/data/titles.json`, oder scheitert `data:extension-liste`, endet der Lauf rot (nach dem Sichern der Quellen). Fehlende Quellpfade bleiben eine Warnung (Listen entstehen nicht immer).
- Arbeitslisten im Bestandsbau: Scheitert eines der vier `data:`-Skripte im Schritt „Arbeitslisten und Prüfstand neu erzeugen“, steht `::error::` im Log und die Statusanzeige zeigt `Arbeitslisten nicht neu erzeugt: <skript>` (`DATEN_WARNUNG`). Der Lauf bleibt grün (14 von 14 Läufen hatten den Schritt grün), nur `commit-data.sh` macht den seltenen Neuaufbau-Weg rot.

## D1-Kosten eines Prime-Durchgangs „Alle durchgehen“ (18.10.2026)

- Umfang (Meldungskopie, Stand 12:57 UTC): Durchgang 12:16–12:35 UTC, 29 Adressen, 139 Meldungszeilen, 426 Rohfolgen.
- Verbrauch (`d1-verbrauch.yml`, UTC-Tag seit 00:00): Lauf 39126558165 (12:15 UTC) 362.653 gelesen / 4.441 geschrieben, Lauf 39127790297 (12:33 UTC) 366.601 / 7.573. Der Durchgang kostete also rund 4.000 Lese- und 3.100 Schreibzeilen, je Adresse etwa 140 und 110.
- Hochrechnung gegen das Kontingent (5 Mio. Lesen, 100.000 Schreiben je Tag): Schreiben begrenzt, rund 900 Adressen pro Tag ohne andere Last; bei der heutigen Grundlast (~8.000 Schreibzeilen bis 13 UTC) bleibt Platz für mehrere volle Durchgänge.
- Ein zusätzlicher Meldungskopie-Lauf (`meldungskopie.yml`, 12:57 UTC) fiel in dasselbe Fenster: Lauf 39130682076 (13:16 UTC) zeigte 553.567 gelesen, also rund 187.000 mehr — fast alles der Export. Eine Kopie nur für eine einzelne Kennung zu ziehen ist deshalb teuer; der nächtliche Lauf reicht, wenn es nicht eilt.

## Belegstärke vorher/nachher ohne Bau (30.10.2026)

`node tools/belegstaerke-vergleich.mjs [alt] [neu]` (Standard origin/main gegen HEAD) liest `dubConfidence` aus `public/data/titles.json` beider Git-Stände und druckt die Summen je Stufe plus je geändertem Titel „Kennung (Name): alt → neu“; für Beleg-PRs, wo ein Vollbau lokal am fehlenden Cache scheitert.

## Höchstens ein schwerer Lauf gleichzeitig (18.10.2026)

- `tools/schwer.mjs <Befehl>` (Logik in `tools/schwerer-lauf.mjs`) wartet auf die Sperre `schwerer-lauf` in `tmpdir()` und startet den Befehl erst, wenn kein anderer schwerer Lauf auf dem Rechner läuft. Die Warteschlange ist die von `bau-vergleich` (`einzel-sperre-schlange.mjs`): der Älteste zuerst, Meldung „Platz n von m — Sperre hält PID …, Befehl …“, verwaiste Sperre (PID tot) wird übernommen, Frist 45 min.
- Eingebunden: `data:build`, `check:ansichten` (samt `-desktop`/`-handy`), `check:panel` (die Einzelteile jetzt `check:panel-teile`/`check:ansichten-teile`) und `tools/bau-vergleich.mjs`. Verschachtelt (Marke `AK_SCHWERER_LAUF` im Kind) wartet nur der äußerste Aufruf; in CI (`CI=true`) keine Wirkung.
- Nicht erfasst: direkter Aufruf von `tsx pipeline/build.ts` oder `node tools/panel-bild.mjs` und der Web-Bau in `npm run build` — bei Bedarf `node tools/schwer.mjs …` voranstellen.
- Hart beendeter Wrapper (ohne `/T`): Die Sperre hält, solange sein Kind lebt (`kind` und `kindExe` in der Sperrdatei). Unter Windows ist das Kind die Shell `cmd.exe`; sie stirbt mit dem Wrapper (libuv-Job), der Lauf darunter nicht. Deshalb fragt die Sperre dort per WMI (`tools/prozess-kinder.vbs` über `cscript`, ~0,4 s, nur in diesem Fall) nach lebenden Kindern der toten Shell, die nach Sperrbeginn starteten (18.10.2026: zweiter Lauf startete nach 22,9 s statt 0,3 s).
- Windows-Grenzen danach: Gezählt wird nur die erste Ebene unter der Shell (stirbt der Lauf selbst, laufen seine Enkel ohne Sperre weiter); bekommt ein neuer Prozess die PID der toten Shell und startet Kinder, gilt die Sperre bis zur 45-min-Frist fälschlich weiter; scheitert die WMI-Abfrage, wird die Sperre freigegeben. Ohne Shell zu starten (`shell: false`) hilft nicht: `npm run` startet selbst wieder über `cmd.exe`, dessen Kinder den Wrapper ebenso überleben (gemessen 18.10.2026).
- Test: `tools/schwer.test.mjs` (echte Prozesse in Wegwerf-TEMP: Warten, Reihenfolge, kill des Halters, Halter ohne Baum beendet auch unter Windows, CI, Marke).

## PR-Kette vor dem Merge nachrechnen (19.10.2026)

Die Kette läuft auf `refs/pull/N/merge`, also gegen main zum Zeitpunkt ihres Starts. GitHub rechnet diesen Ref nicht neu, wenn main weiterkommt (gemessen 19.10.2026: PR 1597 blieb auf Basis `7a466acc8`, während main drei Commits weiterlief, auch nach Abfrage von `mergeable`), und `gh run rerun` nutzt denselben Merge-Commit. Repoweite Grenzwerte (`uhr-in-tests`, `check:umfang`, Design-Klassen) können deshalb im PR grün und nach dem Merge rot sein (1576: 58 → 80 durch einen anderen PR).

- **Vor jedem Merge:** `node tools/pr-nachrechnen.mjs <PR>` (mit dem gh-Token des Aufrufers). Es liest die Basis aus dem Checkout-Log des Jobs „Kette – Workflows“ im neuesten Kettenlauf zum aktuellen Kopf (Zeile `HEAD is now at … Merge <kopf> into <basis>`) und vergleicht sie mit main-HEAD. **Exit 0:** aktuell, mergen. **Exit 1:** nicht aktuell; der PR wurde geschlossen und wieder geöffnet (`reopened` baut den Merge-Ref neu und startet die Kette), Kette abwarten und erneut aufrufen. Der Lauf zu `reopened` nimmt aber den Merge-Commit, der beim Öffnen galt; GitHub rechnet ihn erst danach neu (gemessen 19.10.2026 an Wegwerf-PR 1602: Lauf 39275074974 prüfte `bf898466` gegen main `7513c799`, obwohl main schon `6b4915c2` war; erst das zweite Öffnen, Lauf 39275568297, prüfte gegen `6b4915c2`). Ist `merge_commit_sha` noch alt, öffnet das Werkzeug deshalb zweimal und wartet dazwischen (alle 2 s, höchstens 60 s), bis GitHub ihn neu gerechnet hat; den ersten Lauf bricht die Concurrency der Kette ab. **Exit 2:** unklar (PR nicht offen, Konflikt, `mergeable` noch nicht berechnet, kein Lauf, Job oder Log zum Kopf) oder gh-Fehler; nichts angestoßen, Meldung lesen (auch „Test-Merge noch nicht berechnet“: gleich erneut aufrufen). Scheitert es erst nach dem Schließen, steht „SCHON ANGESTOSSEN“ in der Meldung: Zustand und Kettenlauf prüfen. Scheitert das Wiederöffnen dreimal, meldet es „BLEIBT GESCHLOSSEN, von Hand öffnen“. Test: `tools/pr-nachrechnen.test.mjs` (echtes Joblog als Anlassfall, Prozesstests über den Vorlader `tools/pr-nachrechnen-mock.mjs`).
- **Liegengebliebene PRs (21.10.2026):** `node tools/liegegut.mjs` (nur lesen, Exit 0 auch mit Funden, Exit 2 nur bei Abruffehler) nennt je auffälligem offenem PR eine Zeile mit nächstem Schritt (MERGEN / NACHBESSERN / ÜBERHOLT? / DANIEL). Signale: 1 Freigabe + grün + sauber, > 12 h ohne Commit und Kommentar (nur mit Gegenprobe 7), 2 widersprüchliche Urteile auf dem Kopf, 3 Konflikt > 24 h, 4 rote Checks > 12 h, 5 Ändern-Urteil ohne Commit > 24 h, 6 dieselbe F-Nummer in mehreren PRs, 7 main-Commit seit PR-Datum mit gemeinsamer Datei und zwei gemeinsamen Titelstämmen (Hinweis, kein Schluss), 8 Stillstand > 48 h (letzte Aktivität aus Kopf-Commit, Kommentar, Review; fängt PRs, die auf kein anderes Signal passen). Die Wachphase (`tools/laeufe-aufraeumen.mjs`) gibt die Funde seit 30.10.2026 als eine Zeile `LIEGT: 2377 (Konflikt 30 h, Stillstand 52 h), …` aus, ein Abruffehler als eigene Zeile `LIEGT? …`; die Kopf-Zeiten kommen in einem GraphQL-Aufruf (Wachphase 17 s → 19 s statt +9 s mit einem Aufruf je PR). Schwellen als Konstanten im Kopf der Datei, Anlass `daniel-zum-abarbeiten/berichte/liegegut-2026-10-21.md` (PR 1676 lag freigegeben und grün). Tests: `tools/liegegut.test.mjs`, `tools/liegt-wachphase.test.mjs`.
- **Die Freigabe bleibt:** `pr-pruefer.yml` hört nicht auf `reopened`. Das Wiederöffnen startet nur die Kette; Kopf, Urteil „Prüfer-Review für <Kopf>“ und Ruleset-Freigabe bleiben (kein Push). Wird an einem geschlossenen PR gepusht und er danach geöffnet, fehlt das Urteil zum neuen Kopf, der Merge bleibt ohne Freigabe gesperrt; neu anstoßen mit `gh run rerun` des Prüferlaufs. Wirksam erst nach dem Merge, weil `pull_request_target` die Datei aus main liest.
- **Strenger als nötig, mit Absicht – mit einer Ausnahme (F55, Daniel 20.10.2026):** Verglichen wird mit main-HEAD; war main seit dem Kettenlauf nur unter `public/data/` und `data/cache/` bewegt (GitHub-Compare Kettenbasis…main, Status `ahead`, unter 300 Dateien) und der PR berührt diese Pfade nicht (`pulls/N/files`, auch alte Namen), gilt die Kette weiter: Exit 0, Meldung „seitdem nur Daten bewegt“. Seit 21.10.2026 zählen auch Bot-Dateien als Datenpfad, die kein Schritt der Kette liest (Berichte unter `daniel-zum-abarbeiten/`, Sammler-Rohdaten wie `data/source-health.json`; Liste und Begründung in `tools/pr-nachrechnen-bot-pfade.mjs`, Wächter gegen späteres Lesen im Bau und in den Prüfungen der Kette (Logik-Liste, `tools/*.test.*`, `pr-pruefung.yml`): `pr-nachrechnen-bot-pfade.test.mjs`; Treffer, die den Namen nur nennen, stehen mit Grund in `pr-nachrechnen-bot-pfade-bekannt.mjs`; `data/patchnotes/` liest der Bau und bleibt draußen). Seit 26.10.2026 entwerten auch Bewegungen unter `docs/`, Markdown im Wurzelordner und `daniel-zum-abarbeiten/00-wache.md` keinen PR (Anlass: PR 2118; ausgenommen davon `docs/wissen/design-regeln.md`, die `tools/design-kontrast.mjs` in `check:logic` liest; der Wächter `dokuLeser` in `pr-nachrechnen-bot-pfade.test.mjs` sucht den nächsten Leser von `docs/`, Wurzel-Markdown und `00-wache.md` im Bau und in der Kette; andere Daniel-Dateien wie `stand.md` lesen Prüfungen und zählen weiter); `data/patchnotes/` zählt weiter, der Bau liest es, und berührt der PR dieselbe Datei, ist er veraltet (`istDatenpfad` selbst bleibt unverändert, der Abdruck von `tools/logik-beleg.mjs` ändert sich nicht). Seit 26.10.2026 gilt zusätzlich die Leser-Regel für reine Bot-Sprünge unter `data/` (`tools/pr-nachrechnen-leser.mjs`, Git-Anschluss `pr-nachrechnen-leser-git.mjs`): ein PR bleibt aktuell, wenn er keine bewegte Datei berührt und sein Code sie nicht liest, also weder Leser (Dateien auf main, die den Dateinamen im Code nennen) aufruft oder importiert noch von einem Leser genutzt wird; Workflows und Skripte zählen mit literal genannten Pfaden, ihren Importen und dem `package.json`-Skript, das der PR ändert (`npm run` wird nicht aufgelöst, Pfad-Tokens folgt nur die Startdatei). Code des PR, der ein Verzeichnis liest oder Namen darunter zusammensetzt (`readdirSync('data/')`, `'data/' + f`, `data/${n}.json`), gilt als Leser jeder bewegten Datei darunter. Ändert der PR selbst Dateien unter `data/` (Handbelege wie `data/dub-confirmed.yaml`, kuratierte Daten, Sammlerdaten) und liest Code die bewegte Datei, bleibt er veraltet, auch wenn sein Code sie nicht nennt: der Bau verarbeitet beides in einem Lauf (Auflage CI-Prüfer zu PR 2123). Im Zweifel (Git nicht erreichbar oder nach 120 s ohne Antwort, von main kein Code gelesen, package.json nicht vergleichbar) bleibt der PR veraltet; ein Mensch-Merge dazwischen entwertet weiter jeden PR. Vorher galt jede Datei außer Doku als Leser (Anlass: PR 2043, fünf Neuläufe durch Bot-Daten). Das Werkzeug holt Kopf und main per `git fetch` in den Checkout des Aufrufers und braucht ihn daher im Repo. Von dieser Datenpfad-Ausnahme (nur Pfade oben bewegt) ausdrücklich nicht gedeckt: `tools/umfang-grenzen.json`, `extension/*`, `data/dub-confirmed.yaml`, `public/og/`, jeder Code; bei reinen Bot-Sprüngen unter `data/` entscheidet danach die Leser-Regel; jeder Abruffehler ist Exit 2. Grund und Zahlen: Bericht `daniel-zum-abarbeiten/berichte/merge-durchsatz-2026-10-20.md`, Anläufe je Merge ~5 auf erwartet ~2 (Modell, nicht gemessen; Prüftermin: die nächsten 5 Merges nachmessen). Davor galt: Verglichen wurde exakt mit main-HEAD, also machten auch reine Daten-Pushes (Bestandsbau, Sammler) einen PR „nicht aktuell“. Die Kette prüfte auch Daten, die ein solcher Push ändert; unter der Ausnahme oben bleibt das bewusst aus (von Daniel in F55 so entschieden) (`data:validate`, `check:beleg-wand`, `data:build` mit `pipeline/check-ja-hat-weg-bestand.ts`). Kosten: ein Kettenlauf je Nachrechnen (dazu ein abgebrochener, wenn der Merge-Commit alt war), kein Prüferlauf. Der verworfene Vorgänger (Push-Workflow, der bei jedem main-Push alle offenen PR neu öffnete und damit auch den Prüfer neu startete) kostete ein Vielfaches, je main-Push einen Kettenlauf je offenem PR.
- **Restfenster:** Zwischen Exit 0 und Merge kann main weiterkommen; das Werkzeug unmittelbar vor `gh pr merge` aufrufen.
- **Auto-Merge bleibt ungeschützt:** Ein Pflicht-Check „Kette aktuell gegen main“ geht ohne Fan-out nicht. Checks hängen am Kopf-Commit des PR, ein main-Push ändert keinen Kopf; den Check bei jedem main-Push für alle offenen PR neu zu setzen ist genau der verworfene Weg. `strict_required_status_checks_policy: true` im Ruleset `main-pruefweg` wäre das harte Gegenstück, verlangt aber den Zweig auf main-Stand (Update-Branch), erzeugt damit einen neuen Kopf, verwirft über `dismiss_stale_reviews_on_push` die Freigabe und startet den Prüfer neu. Merge Queue gibt es für ein Konto-Repo nicht (nur Organisationen). Also mergt Auto-Merge (`gh pr merge --auto`) ohne Nachrechnen. Stand 19.10.2026: seit dem 17.10. 0 von 51 gemergten Code-PR mit Auto-Merge (zuletzt 1352 am 16.10.); Sammler-PR (`daten/`) überspringen diese Kettenjobs. `tools/pr-einreichen.sh` (aufgerufen von `tools/pushen.sh` und `tools/erneut-melden.mjs`) schaltet seit 19.10.2026 kein `--auto` mehr ein, es druckt den Nachrechnen- und Merge-Befehl.
- **Zeitzone:** Die Kette läuft mit `TZ: Europe/Berlin` (Workflow-env, von `tools/pr-kette-rahmen.mjs` festgeschrieben).

## Löschexperiment: „kein Leser übersehen“ belegen (25.10.2026)

`node tools/loeschexperiment.mjs <pfad…> [--pruefung <npm-skript>…] [--cache]` (Anlass Prüfer 1741: 53 Einträge von Hand gelöscht). Es fährt die Prüfungen als Basis (Vorgabe `check:pfade`, `typecheck`, `check:hooks`; je Lauf über `tools/schwer.mjs`), löscht genau die Pfade, fährt dieselben Prüfungen erneut und druckt je Prüfung `gleich` / `neu rot` / `neu grün` / `rot, anderes Ende`. Danach stellt `git checkout -- <pfade>` sie wieder her, auch bei Fehler; kein `git clean`. Nur getrackte, unveränderte Pfade im Repo sind erlaubt. Exit 0 auch bei Abweichungen (Messlauf), 2 bei Fehlbedienung.
- **Untergrenze bestätigt:** zwei Läufe vorhandener `check:*` mit Exit-Code-Vergleich decken den Fall ab; kein eigener Prüfer-Baukasten.
- **`--cache`:** legt `data/cache` als Junction auf das des Hauptordners, wenn es im Worktree fehlt (nur lesend), und löst die Verknüpfung am Ende. Für `data:build`-Prüfungen (`--pruefung data:build`); dort schreibt der Bau nach `public/data`, das nicht mitwiederhergestellt wird, also nur in Wegwerf-Worktrees.
- **Abbruch und Frist (25.10.2026):** Strg-C/SIGTERM stellt die Pfade wieder her und löst die Cache-Junction (Exit 130). Eine Frist je Prüfung gibt es bewusst nicht (Untergrenze): eine hängende Prüfung beendet man mit Strg-C. Abgewiesen werden zusätzlich skip-worktree-/assume-unchanged-Dateien in den Pfaden. Der echte SIGTERM-Prozesstest läuft nur unter POSIX (CI); unter Windows beendet `process.kill` ohne Handler, dort deckt ihn nur der Test mit einem Signal-Emitter ab.
- **Belegt am 25.10.2026:** `docs/analyse-cartoons.md` gelöscht → `check:pfade`, `check:umfang` gleich; `tools/umfang-pruefen.mjs` gelöscht → `check:umfang` neu rot.

## Delta-Wache: verworfene Läufe und gewollte Herabstufungen zählen nicht (19.10.2026)

Die Wache (`tools/delta-pruefen.mjs`) war am 19.10. rot, ohne dass etwas verloren ging. Zwei Ursachen, beide in `data/bestand-historie.jsonl`:

- **Zeile eines nie ausgelieferten Baus.** `data:historie` misst vor der Entscheidung von `tools/commit-data.sh`. Ein Bau-Lauf, der verworfen wird, nimmt die Zeile mit `bau_lauf_zuruecknehmen` zurück (Quelle in `tools/quellen-liste.sh`). Die Quarantäne baut aber ohne die roten Titel neu: Die Zeile des ersten Baus blieb stehen, die Wache verglich gegen einen Stand, der nie live war (Pendeln A/B). Jetzt ruft `historie_neu_messen` nach dem grünen Neubau `data:historie -- --ersetzen`: Die Zeile des eigenen Laufs (`laufId` = `GITHUB_RUN_ID`) bekommt `verworfen: true`, eine frische wird angehängt. Vorgänger ist immer die letzte Zeile ohne die Markierung (`pipeline/lib/historie-zeilen.ts`), die Wache überspringt markierte Zeilen. Eine Zeile eines anderen Laufs wird nie markiert (war `data:historie` gescheitert).
- **Kanal-Titel-Regel vom 11.10.2026.** Wird eine große Abholung gebaut, verlieren Prime-Titel ihr Ja, weil Amazons Sprachangabe auf Kanal-Titeln kein Beleg ist. `Kennzahlen.kanalOhneUrteil` (je Anbieter) und `kanalTitelOhneSynchro` zählen Verweise ohne Ja bei Titeln mit solchem Beleg; ihr Zuwachs gegenüber der Vorzeile ist die Obergrenze des Erklärbaren. Die Zeile nennt den Teil unter `erklaert` (Wache: „ℹ erklärt, nicht rot“), rot bleibt der Rest. Fehlt die Kennzahl in der Vorzeile (Zeilen bis 19.10.), wird nichts erklärt. **Grenze:** Ein echter Verlust im selben Anbieter, der kleiner ist als der Zuwachs, bleibt dadurch unsichtbar; Kanal-Zuwachs erklärt nie Abnahmen eines anderen Anbieters.
- Test: `tools/delta-wache-historie.test.mjs` (Vergleich, Zähler, Zeilenhilfen, Wache und Schreiber als Prozess); Verdrahtung der Quarantäne in `tools/commit-data-test-quarantaene.sh`.

## Delta-Wache: Pendeln ist ein Befund, Tagebuch ohne Wiederholung (20.10.2026)

Pendelte der Bestandsbau zwischen zwei Ständen (18./19.10.2026, 16 Wechsel zwischen 1999 und 2036 Urteilen), stand jede Zeile einzeln als „37 verloren“/„4 zurück“ in `00-wache.md`. Jetzt (`pipeline/lib/bestand-pendel.ts`, gelesen in `tools/delta-pruefen.mjs`): drei oder mehr Zeilen A,B,A,… (Urteile bis auf 5 gleich, Schwingung über 5) sind EINE Zeile „pendelt seit … zwischen A und B (n Wechsel)“, rot nur solange die Datei im Pendeln endet. Die Zeile danach gilt netto gegen den Stand vor dem Pendeln. Wandern die Stände langsam weiter (Drift, je Zyklus -5), zerfällt das Pendeln in lückenlos aneinanderstoßende Teilpendel; diese Kette nennt am letzten Glied den Gesamtverlust („Kette aus n Teilpendeln seit …: A -> B Urteile (±d) gegen den Stand davor“), und die Zeile danach zählt netto gegen den Stand vor dem ersten Glied (25.10.2026; echte Historie bis 1492 Zeilen: 0 Ketten aus 2 oder mehr, 2 Einzelpendel). Drei Stände oder einmalige Verluste bleiben Einzelbefunde. `tools/wache-tagebuch.mjs`: ein Befund mit gleichem Wortlaut (ohne Zeitpunkt) wie eine stehende Tagebuchzeile wird nicht erneut angehängt. Bewusst: Was im Pendeln als eigene Auffälligkeit gespeichert war (z. B. ein einzelner Verlust bei einem Anbieter), erscheint nur noch im Netto der Zeile danach; ein einmaliges Absinken und Zurückkehren (A,B,A) ist eine Info-Zeile ohne Rot. Das Tagebuch hält einen gleichen Befund nur zurück, solange seit seiner Zeile keine unauffällige Zeile folgte (Wiederkehr nach Ruhe steht wieder drin). Driften beide Stände mehr als 5 von ihrem Anfangsstand weg (je Zyklus -5), bricht das Pendeln ab und ein neues beginnt. Test: `tools/delta-wache-pendel.test.mjs` (Anlassfall `tools/testdaten/bestand-historie-pendel.jsonl`).

## Patch Notes: „vertagt“ hat einen Besitzer, den Vorrat (01.11.2026)

**Anlass:** Daniel, 01.11.2026 00:41 („Patch Notes: keine ist komisch“). Gezählt an den gemergten PRs seit 29.10.2026 (`gh pr list --state merged --search "merged:>=2026-10-29"`, 245 PRs, 94 mit der Zeile „Patch Notes: keine – …“): 7 sagten in Wahrheit „wirkt erst nach dem nächsten Lauf/Bau“ (2547, 2532, 2528, 2515, 2388, 2362, 2354); für keinen folgte je ein Eintrag, die Vertagung hatte keinen Besitzer.

**Regel:** Wer die Patch Note auf die Zeit nach einem Lauf oder Bau verschiebt, schreibt „Patch Notes: vertagt – <Grund>“ und legt den Entwurf als `data/patchnotes/vorrat/<name>.yaml` an (Felder wie ein Eintrag, dazu `wartetAuf` und `seit`, kein `datum`). `tools/check-patchnotes-pflicht.mjs` verlangt die Datei; dieselbe Pflicht gilt für eine „keine“-Zeile, deren Grund nach „später“, „wirkt erst“ oder „nächster Lauf/Bau/Abruf“ klingt (gegen die 94 echten Zeilen gemessen: genau die 7, kein Fehlalarm). Ist wirklich nichts Sichtbares zu erwarten, bleibt „keine“ ohne diese Wörter.

**Freigabe:** Der Bau liest den Unterordner nicht. `npx tsx pipeline/patchnotes-vorrat.ts frei <name>` verschiebt die Datei in `data/patchnotes/` und streicht `wartetAuf`/`seit`; der Tag des Eintrags ist der Tag des Commits, der die verschobene Datei anlegt, also der Freigabetag (Anlagetag wie überall, `--no-renames`; Test mit echtem git in `pipeline/check-patchnotes-vorrat.ts`). `liste` zeigt, was wartet. Freigeben darf, wer die Wirkung am Datensatz belegt hat (Datei in `public/data/` lesen), im Zweifel der tägliche Patch-Notes-Lauf.

**Wache:** `tools/delta-pruefen.mjs` (täglich in `delta-wache.yml`) wird rot und nennt Name und Wartegrund, wenn ein Eintrag länger als `VORRAT_MAX_TAGE` (7) Tage im Vorrat liegt. Der Skill `patchnotes-autor` (nicht im Repo, `~/.claude/skills/`) kennt den Vorrat noch nicht: im täglichen Lauf `pipeline/patchnotes-vorrat.ts liste` mitlesen.

## Patch Notes: „keine“ nur mit Klasse am Anfang des Grundes (01.11.2026)

**Anlass:** Daniel, 01.11.2026 12:48 („viele PRs haben keine Patch Notes, obwohl sie Änderungen haben“). Gezählt an den gemergten PRs seit 29.10.2026 (`gh pr list --state merged --search "merged:>=2026-10-29" --json number,title,body,files`, 265 PRs, 102 mit „Patch Notes: keine – …“): 10 davon änderten Dateien unter `web/src/`, `shared/`, `data/curated/` (2332 Ältere-News-Knopf, 2419 Entdecken, 2428/2354/2347 Fremdzuordnungen …); 12 trugen den Titel `fix|feat(prime|data)` oder `docs(prime)`. Der Nachhol-Bericht fand fast alle „keine“-Gründe richtig, übersehen wurden Datenkorrekturen.

**Regel** (`grundFehler` in `tools/check-patchnotes-pflicht.mjs`): Berührt der PR sichtbare Dateien, beginnt der Grund der „keine“-Zeile mit einer Klasse: Umbau, Test, Werkzeug, CI, Doku, Erweiterung, intern. „Daten“ gehört ausdrücklich nicht dazu. Trägt der Titel `fix(prime)`, `fix(data)`, `feat(prime)` oder `feat(data)`, nennt der Grund die gemessene Wirkung („0 Titel/Termine/Meldungen/Wege/Zeilen“, Beleg `bau-vergleich`); sonst Eintrag oder Vorrat. Untergrenze wäre die bisherige Regex („irgendein Grund“); Alternative wäre eine Prüfer-Pflicht statt Regex, sie erwischt Einzelfälle, aber nicht mechanisch.

## Daten-Merge: grün ohne Wirkung (20.10.2026)

Lauf 39397639406 (`claude-daten-merge.yml`) endete grün, PR 1556 blieb im Konflikt: `daten-pr-mergen.sh` meldete nur eine Notice. Seit dem Fix ist ein nicht MERGEABLE-er PR nach dem Claude-Schritt ein `::error` und macht den Lauf rot; der Schritt „Ablauf von Claude zeigen“ (`tools/claude-ablauf-zeigen.mjs`) druckt Aufrufe und Ergebnis aus `claude-execution-output.json` ins Protokoll (die Action druckt sonst nur Init und Ergebnis). Klasse: 5 Läufe seit 16.10. mit Claude-Schritt, 2 davon ließen PR 1556 offen. Tools: `gh run view <id> --log` zeigt jetzt die Ursache.

## D1-Export weist Meldungen ab: 503 statt 500, Rohfolgen ohne Verlust (17.10.2026)

**Anlass:** Daniels Prime-Meldung „Die Dinos sind los“ (B00LDDJYB4) bekam am 16.10.2026 um 21:38:45 UTC eine 500, im Log `D1_ERROR: Currently processing a long-running export.` Zur selben Zeit zog der Workflow Meldungskopie (`tools/meldungskopie-bauen.mjs`) den D1-Export (Lauf 38970700434, Schritt „Kopie ziehen“ 21:38:41–21:38:53, 12 s für 79.062 Zeilen). Während eines Exports scheitert **jede** D1-Abfrage, auch Lesen.

**Klasse:** alle Worker-Routen mit D1 (Meldungen, Stapel, `/lauf`, `/status`, Aufträge der Pipeline, Newsletter). Der Export läuft täglich um 03 UTC (`shared/weckplan.ts`, `meldungskopie`), dazu von Hand und als Nachholung der Wecker-Wache. Kein Sammler bricht bei 500 ab (alle warnen und laufen weiter oder holen beim nächsten Lauf nach); still verloren gehen nur `tools/lauf-melden.sh` (curl ohne `-f`, `|| true`) und die Vorfall-POSTs in `pipeline/lib/abbruch.ts` und `scrape-crunchyroll-woche.ts`. Deshalb keine Wiederholung in den Sammlern.

**Was jetzt gilt:**
- `istD1Export()` in `worker/src/d1-limit.ts`; das Auffangnetz (`auffangnetz.ts`) antwortet darauf mit 503, `Retry-After: 30` und „Die Datenbank ist gerade kurz beschäftigt. …“, loggt `d1_export_abgewiesen` statt eines Fehlers. Im Stapel trägt nur die betroffene Meldung 503 (`ausnahmeAls`).
- **Rohfolgen gingen still verloren:** `speichereDaten` schrieb die Meldungszeile (mit Hash) vor den Rohfolgen; scheiterten diese, galt der nächste Klick als „unveraendert“ und übersprang sie. Jetzt erst Rohfolgen, dann Zeile; `ladeRohfolgen`, `loescheRohfolgen` und der Einfüge-Batch werfen D1-Abweisungen (Export, Tageslimit) weiter statt sie zu schlucken (sonst Dubletten oder alte Zeilen). Test `tools/worker-d1-export.test.ts` stört jeden der 8 D1-Aufrufe einzeln und ab dort; danach ist alles genau einmal da.
- **Kennung im Protokoll:** Ein Suchauftrag schickt als `url` die Suchadresse `amazon.de/s?k=…`, deren letzter Abschnitt „s“ war. Jetzt zuerst `seiten_kennung`, eine Suchadresse liefert keine Kennung (`kennungDerMeldung`).
- **Warum Prüfer und Kette den Rohfolgen-Verlust durchgelassen hatten (Stufe 5):** Die Reihenfolge Meldungszeile mit Hash vor den Rohfolgen entstand mit dem Hash-Überspringen („unveränderte Meldung schreibt nichts“, PR 839, 11.10.2026). Geprüft wurde dort nur der Erfolgsweg und das Überspringen, nie ein Abbruch zwischen zwei Schreibschritten. Geschärft: Eine Speicherroute, die einen Zustand für „schon erledigt“ merkt (Hash, Marke, Zeile), bekommt einen Test, der jeden D1-Aufruf einzeln und ab dort stört und danach wiederholt (`tools/worker-d1-export.test.ts`); der Prüfer fragt bei jedem „unverändert → überspringen“, was passiert, wenn der Schritt danach scheitert.
- **Offen (eigener PR, Erweiterung):** Der Satz „Die Datenbank ist gerade kurz beschäftigt …“ erreicht Prime und Disney+ nicht: `extension/amazon.js:10550` zeigt `Fehler 503`, `extension/amazon.js:3531` und `extension/disney.js:631` werfen `HTTP 503`. Nur die Netflix-Wege zeigen `daten.error`. Im Fall vom 16.10. (Prime) sieht Daniel also „Fehler 503“; die Erweiterung sollte bei 503 den Antworttext anzeigen.

## Zustand eines Titels nach einer Bauphase zeigen: `AK_PHASE_ZUSTAND` (28.10.2026)

Wächter-Fixtures für Bauphasen kommen aus dem Zustand der Phase, nicht aus dem fertigen `titles.json` (Anlass: 2294 → 2302). `haltePunkt()` (`pipeline/bau/phasen-zustand.ts`) steht in `build.ts` und `09-synchro.ts` nach den Phasen und tut ohne Schalter nichts:

```
AK_PHASE_ZUSTAND=09-4-crunchyroll-dub AK_PHASE_TITEL=152677 npx tsx pipeline/build.ts | grep ^AK_PHASE_ZUSTAND
```

Ausgabe: eine Zeile `AK_PHASE_ZUSTAND {"152677": {…}}` (ohne `AK_PHASE_TITEL` alle Titel, unbekannte Kennung = `null`), danach Exit 0 vor `public/data/`. Ein unbekannter Name oder eine nicht numerische `AK_PHASE_TITEL` endet vor dem Bau mit Exit 1 (Liste `PHASEN` in `pipeline/bau/phasen-zustand.ts`, vom Check gegen die Aufrufe gehalten). Frischer Cache vorher (`node tools/cache-holen.mjs`, Abschnitt oben): mit dem Cache vom 03.09. war `episodes` von 152677 überall leer, mit dem vom 28.10. schon nach `02-titel` gesetzt (13). **Jeder Halt, schon der bei `02-titel`, hinterlässt geänderte Dateien** (Prüflisten unter `data/`, ab 09-5 mehr, ab 09-6 auch `public/data/`); der Halt druckt den Hinweis dazu. Danach immer `git restore data public/data && git clean -fdq public/data`. Probe: `pipeline/check-phasen-zustand.ts` (in `check:logic`).

## Vorschlags-Ledger: ungedeckte Agenten-Vorschläge als Liste (01.11.2026)

`node tools/vorschlags-ledger.mjs [--tage 1] [--aus datei]` liest die Abschlussberichte der Subagenten (`~/.claude/projects/C--code-ai-anime-kalender-de/*/subagents/*.jsonl`), zieht die Zeilen „Vorschlag:“ und „Veraltet:“ und gleicht jeden Vorschlag mit `daniel-zum-abarbeiten/berichte/lehren.md`, `~/.claude/agents|skills|rules` und `docs/wissen/` ab: gedeckt ist er, wenn ein einzelner Absatz mindestens 70 % seiner Suchbegriffe (Code-Spans, PR-Nummern, Wörter ab 7 Buchstaben als 6er-Stamm) trägt. Ungedeckte kommen als Zeile `- [ ] Datum Rolle \`agent-id\`: Vorschlag … → verankern / verwerfen:` an `daniel-zum-abarbeiten/listen/vorschlaege-offen.md`; vorhandene Zeilen bleiben, eine Agent-ID wird nie doppelt angelegt. Nur lesen, kein Netz, ~16 s über 7 Tage (594 Berichte). `lehren.md` liegt nur im Hauptordner (nicht versioniert): im Worktree druckt der Lauf eine `⚠ WARNUNG`-Zeile und gleicht ohne sie ab. An der Stichprobe der Lehren-Bilanz (15 Vorschläge vom 13.–17.10.) meldet er 4 als ungedeckt, die Bilanz zählte 5 hängende. Tägliche Einbindung: Prüftisch-Wecker (noch nicht eingerichtet). Test: `tools/vorschlags-ledger.test.mjs`.
