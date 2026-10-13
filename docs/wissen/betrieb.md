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
property" (29.08.2026) — und **`cd worker` allein genügt nicht**, das `--config` gehört dazu. Wrangler findet sonst `wrangler.jsonc` — die gehört zur
**Web-Anwendung** (SPA-Zustellung, kein `main`, keine D1-Bindung) und ist ohne
gebautes `dist/` unvollständig. Der Newsletter-Worker hat seine eigene
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
`tools/d1-verbrauch.mjs`). Am 28.09.2026 war der erste Lauf rot — er zeigte den Tag *vor* den
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
npm run check:ansichten    # alle zehn Routen, beide Themen; Bilder im Temp-Ordner (ak-ansichten)
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
  02.10.2026), je Lauf 25, jeder alle 7 Tage. Gedächtnis `data/beleg-lesungen.json`.
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

GitHubs Cron-Plan für `refresh-hourly.yml` (`23 * * * *`) feuerte real etwa alle 4,6 Stunden. Der Worker `newsletter` (Cron `0 * * * *`) startet den Workflow deshalb zusätzlich per `workflow_dispatch` (`worker/src/wecker.ts`). Das Token liegt als Worker-Secret `GITHUB_WECKER_TOKEN` (Fine-grained PAT, nur dieses Repo, Actions: Read and write; Wert in `my_secrets.md`). Gesetzt mit `wrangler secret put GITHUB_WECKER_TOKEN --config wrangler.toml` im Ordner `worker/` (ohne `--config` legt wrangler einen leeren Worker an). Prüfen: nach der vollen Stunde `gh run list --workflow refresh-hourly.yml` — ein Lauf mit Ereignis `workflow_dispatch` um :00. Läuft der Plan von GitHub zusätzlich, schützt die `concurrency`-Gruppe des Workflows vor Doppelläufen.

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
  `tools/commit-data-test.sh` (läuft in `check:workflows`) hält beide Ausgänge mit einem Attrappe-`npm` fest; `NUR_QUELLEN=1` (Abruf-Lauf) baut absichtlich nicht und bleibt grün.
  Altes Merkmal aus der Grün-Zeit: `public/data/titles.json` ändert sich über Stunden nicht, obwohl `chore(data): Bestand neu gebaut` committet wird.
- Bewusst grün bleiben (geprüft 12.10.2026): `data:extension-liste` scheitert (`::warning::`, Prüflisten zählen gegen den älteren Bestand), ein Pfad aus `QUELLEN` fehlt (`::warning::`, übersprungen), `umfang-pruefen.mjs --festschreiben` scheitert (still, Grenzen bleiben).
- Vor jeder Änderung an `ohne-synchro-von-hand.yaml`: `npm run check:handbelege` nach einem lokalen Bau, und den nächsten Bestandslauf bis zum Deploy beobachten.

## Prüfkette: das Ende der Ausgabe lesen, nicht den Rest (07.10.2026)

`(npm run check:vor-commit > datei; echo "ENDE exit $?" >> datei)` und danach **die Zeile `ENDE exit N`** lesen. Am 07.10.2026 wurde ein Stand gepusht, obwohl `check:vor-commit` mit `exit 1` endete (eine `check:logic`-Zusicherung hing noch an der alten Funktion `titelFuerAnsicht`); die Hintergrundmeldung „completed (exit code 0)" gilt dem Mantel, nicht dem Befehl darin. Ein lokaler `data:build` bricht am Titelschwund-Riegel ab (älterer Cache); wer die Bau-Phasen dahinter prüfen will, löscht vorher `public/data/titles.json` (kein „vorher", kein Riegel) und setzt danach mit `git reset --hard` zurück.

**Seit 07.10.2026: `bash tools/pushen.sh`** — führt die Prüfkette aus und pusht nur, wenn sie grün ist (`&&`-Kette mit `set -e`). Zweimal am selben Tag ging ein Stand mit roter Prüfung hinaus, weil Prüfung und Push mit `;` verbunden waren. Nach einem lokalen Bau-Test außerdem `git clean -fdq public/data`, sonst meldet `check:logic` übrig gebliebene Folgendateien als Verstoß.

**Zwei Wege zum Deploy, seit 08.10.2026 (Daniel: „schlank / hart", kleine Änderungen sollen fast sofort live sein).** Gemessen vorher: Prüfkette vor dem Push 1,5 Minuten, Deploy 1:50 (Checkout 11 s, `npm ci` 12 s, Prüfungen 30 s, Bau 22 s, Hochladen 4 s, Pages 6 s).
`deploy.yml` hat jetzt vier Jobs: `build` (Bau und Hochladen), `pruefen` (die fünf Prüfungen, **parallel** zum Bau), `deploy_hart` (wartet auf beide) und `deploy_schlank` (wartet nur auf den Bau, wenn die Commit-Nachricht `[schlank]` trägt),
dazu `abschluss` (Abmeldung bei der Statusanzeige und Aufräumen roter Läufe, nach allen anderen). Schlank heißt: Die Prüfungen laufen weiter und färben den Lauf rot, wenn etwas nicht stimmt — sie halten den Deploy aber nicht auf.
`bash tools/pushen.sh --schlank` gilt nur für Änderungen an `web/`, `docs/`, `status.md`, `vite.config.ts` und den Auslieferungsdateien in `public/` (sonst bricht es ab), prüft lokal Typen und Umfang und hängt `[schlank]` an die Commit-Nachricht. Es ist für kleine Änderungen, die ich lokal vollständig nachgeprüft habe; alles andere geht den harten Weg.
**Gemessen nach dem Umbau (08.10.2026):** hart 92 s vom Push bis live (Bau 62 s, Prüfungen 65 s daneben, Deploy 19 s); schlank 58 s (Bau ohne Prüfkette 38 s, Deploy 12 s), dazu lokal 13 s statt 1,5 Minuten. Zusammen: Push bis live bei einer kleinen Oberflächenänderung rund 70 s statt rund 200 s. Der Bau-Job ist jetzt der längste Pfad (Checkout 11 s, `npm ci` 13 s, Bauen 25 s).
**Cache:** GitHub Pages liefert `max-age=600`. Der Bau legt `version.json` (Commit-Kennung) ab, `web/src/lib/aktualisierung.ts` fragt sie **nur beim Laden der Seite** mit eindeutiger Adresse ab und lädt bei neuer Kennung einmal neu (Service-Worker-Cache `shell-*` wird verworfen; `sessionStorage` verhindert eine Schleife). Kein Neuladen mitten in der Benutzung (Daniel, 08.10.2026). Seit 11.10.2026 zählt auch die Rückkehr in einen Tab oder die App nach mindestens 10 Minuten im Hintergrund (`visibilitychange`) wie ein Laden — Handy-Tabs blieben sonst Stunden auf altem Stand; kein Banner.

**Bevor eine Pipeline-Änderung gepusht wird, die den Bau verändert (07.10.2026):** Zweimal blockierte ein neuer Prüfpunkt oder ein neuer Titelschwung den Bestandsbau (`DATEN_WARNUNG: Bestand nicht übernommen`) — einmal ein Prüfpunkt auf dem gebauten Bestand, einmal die neuen aniSearch-Titel gegen `check:logic` („Teilnummer im Namen"). Beides hätte ein lokaler Bau gezeigt. Vorgehen: Änderung lokal committen, `rm public/data/titles.json` (ohne „vorher" kein Titelschwund-Riegel), `npm run data:build`, danach `npm run check:logic`, `npm run check:cr-zuordnung`, `npm run check:bestand`; zurück mit `git reset --hard HEAD && git clean -fdq public/data`. Erst dann `bash tools/pushen.sh`.

## Register der Zugänge und Wächter (08.10.2026)

Alles, wovon die automatischen Läufe leben, steht in `data/zugangs-register.json`: 18 Zugänge (Namen, nie Werte) mit Zweck, Workflows, Gültigkeit samt Beleg, Erneuerungsweg (automatisch/Handgriff) und Folge bei Ablauf; dazu die Frist je überwachtem Lauf. Die Workflow-Listen prüft `node tools/zugangs-waechter.mjs --register-pruefen` (in `check:workflows`) gegen `.github/workflows/` — ein neues `secrets.X` ohne Registereintrag bricht die Prüfkette.

**Ablaufdaten:** Belegt sind nur CR_ZUGANG (24 h) und das Weichen-Paket (24 h, jeder Lauf holt es neu); für alle Anbieter-Token und den Wecker-PAT steht die Laufzeit nicht im Repo. `gueltigBis` ist deshalb leer; wer es im Konto abliest, trägt das ISO-Datum ein, der Wächter warnt dann 14 Tage vorher.

**Wächter** `node tools/zugangs-waechter.mjs` (täglich in `delta-wache.yml`, ohne Secret, nur `gh run list`): (1) ist der letzte Erfolg jedes überwachten Laufs innerhalb seiner Frist, (2) Kontingent: ein Claude-Schritt (`claude-code-action` / „Recherche"), der binnen 60 s scheitert, wird als „Kontingent leer oder Token ungültig" gemeldet, solange kein späterer Lauf gelungen ist, (3) startet der Cloudflare-Wecker noch (stündlicher Lauf per `workflow_dispatch` in den letzten 5 h), (4) Ablauf nah. Erster Lauf 08.10.2026: Befund `tonspuren-monatlich.yml` (letzter Erfolg vor 867 h, Frist 840 h — der bekannte stille Ausfall); der Kontingent-Fall vom 02.10. (Lauf 37035218875) ist durch spätere Erfolge erledigt.

## Der Vortagsvergleich der Wache fand nie einen Vortag (08.10.2026)

`tools/wache-schreiben.mjs` vergleicht die ausgelassenen Termine mit dem Stand des Vortags. Der lag in `data/cache/`, das in der CI nur der Actions-Cache `anilist-cache-` füllt — `delta-wache.yml` stellte nichts wieder her, jeder Lauf war ein „erster Lauf" (die Läufe vom 02.–07.10. liefen grün, ohne je zu vergleichen). Jetzt liegt der Stand in `.wache-stand/ausgelassen.json` (mit Datum), wird mit eigenem Präfix `wache-stand-` per `actions/cache/restore` geholt und mit `if: always()` per `actions/cache/save` gesichert; die Wache nennt „Vergleich mit dem Stand vom …" oder „kein Vortagsstand", ein Stand über 3 Tage alt ist ein Befund. `check:workflows` bricht ab, wenn Restore oder Save fehlen oder den Pfad nicht nennen.

## Prüfweg für Pull Requests: PR-Prüfkette und Prüfer-Review (10.10.2026)

Vorher hatte kein Workflow den Trigger `pull_request`, `main` war ungeschützt (Befund: `daniel-zum-abarbeiten/berichte/pruefweg-pr-spezifikation.md`).
Jetzt: `pr-pruefung.yml` (Job `PR-Prüfkette` = `check:vor-commit` mit Chromium; `PR-Aussehen` nicht verpflichtend, nur bei `web/src`) und `pr-pruefer.yml`
(`pull_request_target`, läuft in der Fassung von `main`, kein Checkout des PR-Zweigs; Claude schreibt Protokoll und `urteil.json`, `GITHUB_TOKEN` kommentiert und gibt frei, nur
wenn die SHA im Urteil dem Head entspricht). Beide überspringen `daten/`-Zweige, Fremd-Forks und Entwürfe. Die Laufzeit von `check:vor-commit` in der CI ist noch nicht gemessen.
Ruleset, GitHub-App, Secrets und Auto-Merge sind Daniels Handgriffe (Spezifikation, Abschnitt 4); bis das Ruleset steht, erzwingen die Workflows nichts.
Diff-Aufbau (11.10.2026): `tools/pr-diff-bauen.mjs` baut den Prüfer-Diff je Datei aus der API-Dateiliste (`gh pr diff` bricht über 20000 Zeilen ab, ein 400000-Byte-Limit auf dem Gesamttext ließ den Code hinter einer großen JSON verschwinden). Nur eine Positivliste wird bei über 50000 Byte Diff zur Stub-Zeile: `public/data/**` (json, jsonl, yaml) und die Einträge unter `data/` aus `tools/quellen-liste.sh` (das Skript liest sie von dort, keine zweite Liste), seit 12.10.2026 auch `data/stammdaten/**` (maschinelle Schnappschüsse mit eigenen Prüfungen, z. B. `anilist-eingefroren.json`). Handdateien (`*-von-hand.yaml`, Ankündigungen, Grenzen), `data/dub-confirmed.yaml`, `data/curated/**`, `data/cache/**`, Code, Workflows und Doku nie; ein nicht lieferbarer Diff außerhalb der Liste ergibt `unvollstaendig`. Der Prüfer prüft bei Stubs, dass die Datei in der Beschreibung genannt ist. Seit 12.10.2026 wird eine Umbenennung nur gestubbt, wenn auch `previous_filename` stubbar ist (sonst verschwände z. B. `web/x.ts` → `public/data/x.json` ungelesen). Seit 13.10.2026 werden auch die erzeugten Einzeiler `extension/offene-*.js` gestubbt (PR 1060: ohne API-Patch, „unvollstaendig“ → immer „aendern“), aber nur, wenn die Datei als Eintrag in `tools/quellen-liste.sh` steht und ihr Inhalt am PR-Kopf (`git cat-file`) vollständig aus Zeilen `globalThis.AK_NAME = <gültiges JSON>` besteht (`istDatenJs`); jede andere JS-Datei, auch mit nur einem Kommentar oder `;` mehr, bleibt im Diff sichtbar.
Stufe 0 (12.10.2026, Daniel, Option A): `pr-pruefer.yml` überspringt Stufe 0 nicht mehr, sondern prüft schlank (eigener Schritt „Prüfer (Stufe 0, schlank)“: nur `pr.diff` und Beschreibung, `--max-turns 8`, kurzer Auftrag, Protokoll höchstens 8 Zeilen). Das Urteil kommt aus diesem Lauf, die Freigabe gibt derselbe Schritt „Protokoll und Freigabe“ wie bei Stufe 1/2 (SHA-Abgleich, Token-Muster, fail closed); ohne Urteil keine Freigabe, bei Befund Änderungswünsche. Anlass: Der Branch-Schutz verlangt eine Freigabe, grüne Kleinigkeiten mit Auto-Merge blieben sonst hängen.

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
- **Bypass beim Mergen (Beleg 2, Lauf 38135294637, 11.10.2026):** Ein Bypass-Akteur muss ihn ausdrücklich nutzen. Ohne `--admin` meldet `gh pr merge` bei einem auf Freigabe wartenden PR „add the --auto flag / --admin flag“ und tut nichts; alle App-Merges laufen deshalb mit `gh pr merge --squash --admin` (`tools/quellen-pr.sh`, `tools/daten-pr-mergen.sh`). Scheitert ein mergebarer Daten-PR, ist der Lauf rot; `claude-daten-merge.yml` (Job `nachholen`) holt liegengebliebene mergebare `daten/`-PRs nach. Agenten-Merges mit Nutzer-Token bleiben `--auto` (nie `--admin`). Messung mit aktivem Ruleset steht aus.
- **Schleifen:** Pushes mit App-Token lösen Workflows aus (`GITHUB_TOKEN` tat das nie). `bestand-bauen.yml` und `deploy.yml` überspringen `push`-Läufe des Akteurs
  `anime-kalender-daten[bot]` per Job-`if` (Verhalten wie vorher: Sammler-Merges bauen nichts, der Bau-Commit deployt über `workflow_run`). Der übersprungene Lauf bekommt eine
  eigene Concurrency-Gruppe (`app-push-<Lauf>`), sonst würde er in `pages` einen laufenden Deploy abbrechen und in `bau` einen wartenden Bau verdrängen.
  `check:workflows` kennt diese Form der Gruppe `bau`. **Ob `github.actor` bei einem Squash-Merge der App wirklich `anime-kalender-daten[bot]` ist, ist erst am ersten echten Lauf belegt** (Test T4 in der Spezifikation).
- **Lokal:** `tools/pushen.sh` und `tools/erneut-melden.mjs` pushen nicht mehr nach `main`, sondern reichen über `tools/pr-einreichen.sh` einen PR ein und schalten `gh pr merge --auto --squash` ein;
  `[schlank]` steht im Squash-Text (`--body`), den `deploy.yml` liest.

## Bestandsbau: Doppelläufe bei Push und selbstschließende Rot-Issues (11.10.2026)

- Messung 11.10.: 23 Bauläufe, zwei echte Doppelbauten im 5-s-Abstand (12:05:32/37, 12:36:12/17; zwei Merges, der erste Bau checkt `main` aus und hat beide Stände schon) und ein Bau nur wegen `shared/weckplan.ts` (PR 747). Bericht: `daniel-zum-abarbeiten/berichte/doppelbau-2026-10-11.md`.
- Abhilfe: Der Push-Auslöser nimmt `shared/weckplan.ts` und Markdown unter `data/`, `pipeline/` aus. Job `vorab` überspringt einen Push-Bau, wenn nach dem Auslöser schon ein Bau-Commit auf `main` steht (`tools/bau-schon-gebaut.sh`; Fehler = bauen; `workflow_run` und `workflow_dispatch` bauen immer). Das ist sicher, weil `commit-data.sh` bei bewegtem Fernstand neu aufsetzt und neu baut: ein Bau-Commit mit `public/data` hinter dem Auslöser enthält ihn. `concurrency` allein hilft nicht (der erste Lauf startet sofort; `cancel-in-progress` bräche einen Bau mitten im Push ab).
- Nachtrag 12.10.2026: Als Bau zählt nur ein Bau-Commit, der `public/data` berührt (serverseitiger Pfadfilter `commits?path=public/data`). Anlass: Der Bau nach PR 959 brach an `check:bestand` ab, `commit-data.sh` committete nur Quellen und Verlaufsdateien unter demselben Titel „Bestand neu gebaut“, der Folgelauf übersprang darauf den Bau, und die Meldung fehlte live bei grünen Läufen. Preis: Ein gelungener Bau ohne geänderte Erzeugnisse zählt nicht, ein zweiter Push-Lauf im Sekundenabstand baut dann einmal doppelt (Vollbau in der Gruppe `bau`, nacheinander, kein Datenverlust); stündliche und `workflow_run`-Läufe sind nicht betroffen. Test: `tools/bau-schon-gebaut-test.sh` (Attrappe-`gh` über lokalem Verlauf, in `check:workflows`).
- Rot-Issues („Bestandsbau rot: …“) öffnen Reparatur-Läufe und Agenten; ein grüner Bau schließt jetzt die davor entstandenen mit Lauf-Link (`tools/bau-issues-schliessen.sh`, Titelmuster dort).
- Offen, nicht angefasst: die zwei Bau-Commits eines Doppelbaus wechselten sich ab (+31/−8, dann +8/−29 bei gleicher Eingabe) — der Bau ist an einer Stelle nicht idempotent; Ursache nicht untersucht.

## Briefkasten-Rückstau, 11.10.2026: Zeilen sind keine Adressen

Das Wache-Urteil vom 11.10. nannte „189 Meldungen, 160 Adressen ungelistet". Gemessen (`?zaehlen=1` und `GET /pruefung`): 189 **Zeilen** auf **36 Adressen**, die jüngste vom 03.10. — der Briefkasten wächst nicht, er hält Daniels Amazon-Durchgang vom 22.09.–03.10. (Staffel für Staffel eine Zeile je Folge). `briefkasten-wache.mjs` zählte `adressen` (eine je Meldung) statt je Adresse. Dazu der echte Befund: `fetch-pruefungen.ts` lässt Meldungen mit unklarer Staffel („in der Reihe nicht zu bestimmen", Seite gehört nicht zum Auftragstitel, Folgenzahl passt nicht, keine Folge in den Zielstaffeln) absichtlich liegen, nannte sie aber nur im Lauf-Log; 28 der 36 Adressen standen in keiner Liste. Seit dem Umbau führt `11-meldungen-ohne-zuordnung.md` sie mit Grund und Handgriff (`pipeline/lib/meldungen-liste.ts`), die Wache zählt je Adresse und schlägt an, wenn eine Adresse ungelistet ist **und** ihre älteste Meldung über 24 h alt ist (zweite Abfrage `GET /pruefung` für `gemeldet_am`; Nachzügler jünger als 24 h sind der Normalfall zwischen Meldung und Bau, eine reine Mengenschwelle wie „60 Adressen“ hätte die 28 liegengebliebenen von 36 nie gefunden; eine in der Antwort fehlende Adresse zählt nicht als alt; Test `tools/briefkasten-wache.test.mjs`). Gegenprobe 11.10.2026: alte Liste Exit 1 (30 von 36 Adressen), neue Liste Exit 0. Abgearbeitet werden die Zeilen, indem die Staffel-Seite als Verweis am Staffel-Titel steht (Handarbeit je Reihe); danach hakt der nächste Lauf sie ab.

## Bühne: Mockups auf der echten App, 11.10.2026

Zweiter Einstieg in dieselbe Vite-App (Konzept: `daniel-zum-abarbeiten/listen/mockup-buehne-konzept.md`, Daniel hat es am 11.10.2026 freigegeben). Schritt 1: Rahmen, Ausschnitt `detailpanel`, drei Fälle, Mockup Reihen-Box A.

- **Bauen und öffnen:** `npm run buehne:bauen` schreibt nach `buehne-dist/` (ignoriert, die Seite `dist/` bleibt unberührt); Öffnen von `buehne-dist/buehne.html` über einen Server oder per Playwright-`route` wie `tools/panel-bild.mjs`. Links tragen den Zustand: `buehne.html#reihen-box?v=A&fall=86&geraet=beide&thema=dunkel&teil=beide`.
- **Fälle:** `npm run buehne:faelle` (`tools/buehne-faelle.mjs`) schneidet Reihen aus `public/data/` nach `web/buehne/faelle.json` — in unseren Kennungen (`ak`, über `pipeline/lib/ausgabe-kennung.ts`), mit festem „heute" (`HEUTE` im Werkzeug) und Bildplatzhaltern. Die Datei ist eingefroren und wird nur auf Aufruf neu geschrieben. `fetch` kennt nur diese Datei; alles andere gibt 404 (kein Netz, kein Worker).
- **Zellen:** Jede Zelle des Rasters ist ein eigener `<iframe>` derselben Seite (`#zelle?…`), damit Breite (Media Queries) und Thema (Klasse `dark` am `<html>`, wie `main.tsx`) echt sind.
- **Austausch im Mockup:** Das Detail-Panel bleibt unverändert; `web/buehne/vite-weichen.ts` lenkt nur im Bühnen-Bau einzelne Importe von `DetailPanel.tsx` auf Weichen um (`web/buehne/weichen/`), die ohne Ersatz das echte Bauteil zeigen. Neue Weiche: eine Zeile dort, die Datei dazu, ein Feld in `Ersatz` (`ersatz.tsx`).
- **Beleg „Vorher = echtes Panel":** 375 px, hell und dunkel, drei Fälle gegen die ausgelieferte Seite (`dist/`, ohne Bilder, fester Zeitpunkt): 0 bis 209 von 304.500 Pixeln verschieden, von Lauf zu Lauf wechselnd (Antialiasing eines Etiketts), also sichtbar gleich.
- **Kein Netz, mehrfach gesichert:** `fetch` kennt nur die Fälle; das Großplakat (`cg`) und der Trailer fehlen in den Fällen; die Weiche `weichen/cover-max.tsx` verhindert das `preconnect` auf image.tmdb.org beim Überfahren des Covers; die Content-Security-Policy in `buehne.html` lässt nur die eigene Herkunft zu. Beleg (Playwright, Hover und Klick aufs Cover, Trailer, Sprung): 0 fremde Anfragen.
- **Seiten-CSS:** `web/src/styles.css` nimmt `web/buehne` per `@source not` aus dem Tailwind-Scan; die Bühne holt ihre Klassen über `web/buehne/zelle.css`. Beleg: App-Build mit festem `GITHUB_SHA` am Merge-Base und am Branch ist byte-gleich (`diff -rq dist`).

### Bühne, Schritt 2: Ausschnitte `filter`, `kachel`, `ganz`, acht Fälle (11.10.2026)

- **Ausschnitte** (`web/buehne/ausschnitte/`, Liste in `index.ts`): `detailpanel` zeigt einen Fall; `filter` (echte `FilterBar` mit offenem Fenster und zwei Chips), `kachel` (echte `DatabaseView` über alle Titel, auch ohne Synchro) und `ganz` (die echte `App`) zeigen den **Gesamtbestand** — Kennung `alle`, in `faelle.ts` beim Laden aus allen Fällen zusammengelegt (keine neue Option). Ein Mockup, das den Bestand will, trägt `faelle: [ALLE]`; Proben in `mockups/proben.tsx` (Vorher = Nachher).
- **Fälle** (`tools/buehne-faelle.mjs`, `faelle.json` 608 KB): Tokyo Revengers (neue Staffel), Attack on Titan, One Piece (lang laufend), 86 (fertig), Hajime no Ippo (ohne Synchro), Cyberpunk: Edgerunners 2 (Netflix-Eigenproduktion), Chihiros Reise ins Zauberland (Film, Kino), Golden Kamuy (Finale angekündigt, ohne Datum). Die Reihen dürfen sich nicht überschneiden (der Schneider bricht sonst ab). Neu in jedem Fall: `news.json` und `synonyme.json`, auf die Titel des Falls gekürzt.
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
- **Mockup `relative-uhrzeit`** (`web/buehne/mockups/relative-uhrzeit*.ts[x]`): Ausschnitt `ganz` mit `faelle: [ALLE]` (die `fernsehtag-*`-Fälle stecken im Bestand), sechs Zeiten, drei Varianten (A Jetzt-Linie, B Kopfzeile, C Jetzt-Linie grün). Zustandsrechnung rein in `relative-uhrzeit-zeit.ts`, Test `tools/buehne-relative-uhrzeit.test.mjs` (läuft in `check:workflows` über `tests-alle`; Node lädt die `.ts`-Datei, deshalb ohne Aliase und ohne React). Spezifikation: `daniel-zum-abarbeiten/berichte/relative-uhrzeit-spezifikation.md`.
- **Zwei Funde beim Bauen:** (1) Die Bühne baute auf `main` nicht mehr, seit #1074 `beiBannerKlick` in `cover-max.tsx` ergänzte und die Weiche `weichen/cover-max.tsx` nur Einzelnamen durchreichte; sie reicht jetzt alles durch (`export *`). (2) `@source "./mockups"` in `zelle.css` lieferte keine einzige Klasse (der Ordner bleibt von `@source not "../buehne"` erfasst, Tailwind 4.3.3); mit dem Dateimuster `./mockups/**/*.tsx` kommen die Klassen der Mockups an. Vorher fielen Mockups nur nicht auf, weil ihre Klassen zufällig anderswo vorkamen.

## Worker: abgelehnte Meldungen stehen im Protokoll (11.10.2026)

`worker/wrangler.toml` schaltet Workers Logs ein (`[observability]`; Free 200.000 Ereignisse am Tag und 3 Tage Aufbewahrung, Paid 20 Mio. im Monat inklusive und 7 Tage; Stand 11.10.2026). Die Aufruf-Logs sind aus (`invocation_logs = false`): sie enthielten die volle Adresse samt Query (Token, Push-Endpunkt). Alle `console.*` im Worker laufen durch `fehlerLog()`/`kurzeMeldung()` in `worker/src/werte.ts` (Adressen, Mailadressen und lange Kennungen ersetzt, 120 Zeichen); die Datenschutzerklärung nennt das Fehlerprotokoll. Jede abgelehnte Meldung schreibt eine JSON-Zeile `meldung_abgelehnt` mit Route, Status, Grund, Plattform und Kennung (letzter Pfadabschnitt der Adresse, z. B. Netflix-Titelnummer) — nie Token, Adresse, Titel oder Notiz (`worker/src/pruefung-ablehnung.ts`). Im Stapel-Ergebnis trägt jeder abgelehnte Eintrag `grund`.

Live nachsehen: `cd worker && npx wrangler tail newsletter --format json --search meldung_abgelehnt`, danach in der Erweiterung die Meldung wiederholen. Ausnahmen, die der Worker nicht selbst fängt (`scriptThrewException`), zeigt `wrangler tail` als Ausnahme-Ereignis; ob die gespeicherten Workers Logs sie bei ausgeschalteten Aufruf-Logs führen, ist nach dem Deploy zu prüfen (nicht belegt).

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

**Reihenfolge nach dem Merge:** erst Migration (`cd worker && npx wrangler d1 execute anime-kalender --remote --file=migrations/051-prime-folge-offen-id.sql`, nach 00:00 UTC), dann `npx wrangler deploy`. Beide Reihenfolgen brechen nichts: der **neue** Worker vor der Migration arbeitet mit dem alten Index (wie bisher, nur ohne Ersparnis), der **alte** Worker nach der Migration findet den Teilindex für seine Abfrage ebenso. Die Pipeline (`fetch-rohfolgen.ts`) braucht die Antwort ohne `gesamt` und kommt auch mit dem alten Worker zurecht.

**Folge für den Betrieb:** Eine neue Adresse bekommt ihren Namen in `folgen-zuordnung.json` bis zu 6 h später (`namen=1`); die offenen Rohfolgen tragen den Serienamen weiter selbst (`serientitel`), `fetch-rohfolgen.ts` merkt nichts. **Nachmessen am Tag nach dem Deploy:** `wrangler d1 insights DB --config wrangler.toml --time-period 1d --sort-type sum --sort-by reads --limit 8 --json`; erwartet: `COUNT(*) … prime_folge` verschwunden, die Seitenabfrage unter 8.000 je Aufruf, `namen` ≤ 4 Aufrufe.

**Nicht in diesem PR (Funde):** `?rohfolgen=1&alle=1` (149 × 4.522 = 0,67 Mio.) und `?alle=1` der Meldungen (75 × 4.162 = 0,31 Mio.) lesen je Bestandsbau alle Seiten neu, weil jede Meldung den R2-Auszug verwirft; eine längere Frist oder ein Auszug nach `gemeldet_am` wären der nächste Hebel (zusammen bis −0,7 Mio.). Die Statuszeile `SELECT workflow, zustand, … FROM lauf_status` (32.988 × 4 = 0,14 Mio.) ist klein.

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

**Altbestand ohne Hash: einmaliges Neuschreiben, keine Migration.** Der Hash ist SHA-256 über die 17 Spaltenwerte mit sortiertem `roh`-JSON; SQLite in D1 kann das nicht nachrechnen, eine Migration könnte ihn nicht setzen. Übernommene Zeilen ohne Hash (alles vor Migration 050) zählen nicht als Vergleich; die Folge kommt einmal neu, wird vom Bau übernommen und trägt dann den Hash. Obergrenze: ein vollständiger Durchgang, rund 11.000 Rohfolgen (11.106 am 11./12.10.) × 5 = rund 55.000 Zeilen, verteilt auf die Tage der Durchgänge (Tagesdeckel 50.000 bremst mit 429; die Erweiterung wartet bis 02:00 MESZ) — Seiten, die heute schon mit Hash übernommen wurden, kosten 0. **Es gibt keine Migration; die Reihenfolge nach dem Merge lautet: Worker deployen (`cd worker && npx wrangler deploy`), sonst nichts.** Der Worker läuft mit der Spalte `hash` aus Migration 050 (schon remote).

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

**Reihenfolge nach dem Merge:** keine Migration; nur Worker deployen (`cd worker && npx wrangler deploy`). Nachmessen am Tag danach mit `node tools/d1-verbrauch.mjs --lokal --zeitraum 1d` bzw. `wrangler d1 insights` (Aufrufe von `INSERT INTO pruefung` und `UPDATE pruefung SET gemeldet_am`).


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

**Schwelle 1,5 Mio.:** 5,0 Mio. Kontingent − rund 2,0 Mio. Grundlast der übrigen Wege (4,87 Mio. am 12.10. minus rund 2,9 Mio. aus PR 968; die Meldungen jenes Tages stecken darin, die Zahl ist also eher zu hoch) − 1,5 Mio. Reserve für Spitzen (Bau-Läufe, Board, Status nach Cache-Verlust) = 1,5 Mio. **Nachmessen** ein paar Tage nach dem Deploy mit `wrangler d1 insights` und `SELECT tag, zeilen, gelesen FROM schreib_tag`; Schwelle dann anpassen.

**Das echte D1-Limit wird zur selben Antwort:** `D1_ERROR: Your account has exceeded D1's free tier daily row read limit.` (Wortlaut vom 01.09.2026; der Schreib-Fall ist nach demselben Muster angenommen) wurde bisher zu 500 ohne `tageslimit` — die Erweiterung erkennt nur 429 mit diesem Feld (`extension/tageslimit.js`; Netflix lief weiter, Prime legte Staffeln als übersprungen ab). Jetzt merkt sich die Zähl-Hülle (`zaehlendeDb`) den Fehler, auch wenn die Meldung ihn selbst fängt (Stapel je Meldung, Rohfolgen), und die Route antwortet mit der 429 des Deckels. Gilt nur für die Meldungs-Route.

**Erweiterung (nichts zu ändern, belegt mit `node extension/tageslimit.test.cjs`):** 429 mit `tageslimit: true` und `retryAfter` setzt das Limit (Speicher, alle Tabs), Netflix (`melder.js`) und Disney+ (`disney-netz.js`) halten an und wiederholen nicht, Prime stellt die Staffel an den Anfang des Plans zurück; die Hinweiszeile nennt „weiter ab 02:00" (Berliner Ortszeit). Die Meldungen sind über den Hash idempotent, was vor dem Limit ankam, bleibt gespeichert.

**Reihenfolge nach dem Merge: erst die Migration, dann der Worker.** `cd worker && npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=migrations/052-schreib-tag-gelesen.sql` (nach 00:00 UTC), danach `npx wrangler deploy`. Der **alte** Worker nach der Migration läuft unverändert (`DEFAULT 0`). Der **neue** Worker vor der Migration findet die Spalte nicht: `SELECT`/Upsert scheitern, es zählt und deckelt dann nichts (auch nicht die geschriebenen Zeilen), gesperrt wird aber auch nichts. Migration 051 aus PR 968 ist davon unabhängig.

**Danach erledigt:** Die Disney+-Last (n² je Durchgang) senkt der nächste Abschnitt (Migration 053, ohne Erweiterungs-Release).

## Beleg-Bild: Marke auf leerer Fläche, klebende Leiste, Kritik-Kasten (Kinoheld, 12.10.2026)

Anlass: Der Kinoheld-Beleg zu „A New Dawn" (Aufnahme 07.10.2026) zeigte im Dialog nur eine dunkle Fläche mit roter Marke. **Ursachen (an der Live-Seite gemessen):** (1) Die eingeklappte Filmkritik (`max-h-[100px] overflow-hidden`) nennt den Titel in Absätzen weit unterhalb der Seite; `stuetzstelle` nahm den kürzesten Treffer, die Marke lag unter der Fußzeile auf leerem Grund. (2) Die klebende Kopfleiste (64 px) wurde erst nach dem Messen der Fundstelle entfernt, der Inhalt rutschte hoch, die Marke saß daneben. (3) Das Veröffentlichungsdatum steht bei Kinoheld unter „Veröffentlichung", nicht beim Titel.
**Seitdem** (`beleg-bild.ts`, `beleg-stelle.ts`): `leistenEntfernen` vor dem Messen; `verdecktesMarkieren` setzt `data-beleg-verdeckt` auf abgeschnittene Absätze (weder Stützstelle noch Ausschnittsende); Kinoheld sucht zuerst „Veröffentlichung" (`stuetzbegriffe`); `istEinfarbig` prüft zusätzlich den Bereich unter der Marke — liegt sie auf leerer Fläche, gibt es kein Bild (`leer`). `warteschlange` stellt Artikel ganz ohne Bild vor den Altbestand. `npm run check:beleg-wand` deckt die drei Bauarten ab. **Bestand:** 5 Kinoheld-Belege mit Marke gemessen, nur `a-new-dawn` lag auf leerer Fläche (Bild entzogen, wird im Tageslauf neu aufgenommen); die übrigen markieren die Kopfzeile und zeigen das Datum, wenn die Seite es nennt.

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

**Reihenfolge nach dem Merge (ausgeführt am 13.10.2026, Abschnitt „D1-Umbau eingespielt“):** erst Migration 053 remote empfohlen (`cd worker && npx wrangler d1 execute anime-kalender --remote --file=migrations/053-pruefung-folge-index.sql`, nach 00:00 UTC bzw. wenn das Konto wieder frei ist), dann `npx wrangler deploy`. Zwingend ist sie nicht: Der neue Worker vor der Migration läuft, liest aber über `pruefung_url_zeit` wieder alle Zeilen der Adresse (n² wie vorher), statt Meldungen zu verlieren. Der alte Worker läuft nach der Migration unverändert weiter. Keine Erweiterungsänderung.

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

`node tools/panel-messen.mjs` (läuft in `npm run check:panel` nach `panel-bild.mjs`) öffnet das Panel in `dist/` für Jujutsu Kaisen (mit Banner), Rozen Maiden: Dreaming (ohne Banner) und vier Flaggen-Fälle, Handy 393 px und Rechner-Schublade 512 px, hell und dunkel, und wird rot bei: einer sechsten Schriftgröße (erlaubt 24 · 18 · 15 · 13 · 11 px, Klassen `text-t1` bis `text-t5` in `styles.css`), einem Tippziel unter 44 × 44 (auch Textlinks), Textkontrast unter AA (außerhalb des Bildes), einem zweiten Knopf im Bild (nur ✕), falschen Flaggen (`detail/flaggen.tsx`: Wertung und Quelle eine Flagge, MAL nur mit Kennung, Cartoon „TMDB“, bündig rechts), falschen Maßen von Banner und Posterkarte oder mehr als einem Element mit `filter`/`backdrop-filter` (nur der Rückfall ohne Banner darf unscharf sein). `--docs --echte-bilder` (`npm run panel:bilder`) schreibt `docs/panel-kopf-*.png` mit echten Covern; `--breit` prüft rund 60 Titel quer durch den Bestand (12.10.2026: 0 Verstöße); `--zeit` misst die Öffnungszeit (Median von 7, CPU 4-fach gedrosselt, `--dist` für den Vorher-Stand). Gemessen am 12.10.2026: Öffnen vorher/nachher 163/146 ms (Jujutsu Kaisen) und 138/135 ms (Rozen Maiden) — gleich im Rauschen; die Rasterkosten der Unschärfe auf echter GPU misst das nicht, daher Stichprobe am Poco M7 Pro nach dem Live-Gang.

## Tests mit Bash-Hülle im losgelösten Lauf (12.10.2026)

`prozess-register.mjs` öffnete das Log bis 12.10.2026 21:10 mit `'a'` (Anhängemodus), seitdem mit `'w'`; die Hüllen-Absicherung bleibt für jeden anderen Elternprozess mit Anhänge-Handle. Ein davon geerbtes Handle kann `bash.exe` (MSYS) nicht beschreiben: Exit 1 ohne ein Zeichen Ausgabe, schon bei `bash -c 'echo hi'` (mit `'w'` oder `'r+'` Exit 0; Lauf `flag.mjs`). Darum war `bau-schon-gebaut.test.mjs` (und gleich gebaut `commit-data.test.mjs`) nur im losgelösten `check:vor-commit` rot. Die Hüllen reichen die Ausgabe jetzt über Pipes weiter; `tools/bash-an-angehaengtes-log.test.mjs` startet beide mit Anhänge-Log. Vor der Umstellung scheiterte schon `bash skript.sh` als Befehl für `prozess-register.mjs` (dessen `echo` schlug fehl, Exit 1 trotz grüner Schritte).

## D1-Umbau eingespielt: 051, 052 und 053 am 13.10.2026

Bericht: `daniel-zum-abarbeiten/berichte/d1-umbau-einspielen-2026-10-13.md`. Migration 050 lief schon früher per `d1 execute --file`, nicht per `migrations apply`; `d1_migrations` endete deshalb bei 049, und `migrations apply` wäre an 050 (doppelte Spalte `hash`) gescheitert.

- **052** (Spalte `schreib_tag.gelesen`) am 13.10.2026 12:33 MESZ per `execute --remote --file`: 54 gelesen, 1 geschrieben. Spalte per `pragma_table_info` bestätigt.
- **051** (Teilindex `prime_folge_offen (id) WHERE uebernommen = 0`) direkt danach: 61.501 gelesen, 18.194 geschrieben. `sqlite_master` zeigt den neuen Index.
- **`d1_migrations`** für 050, 051, 052 nachgetragen (`INSERT (name, applied_at)`, 7 geschriebene Zeilen); `migrations list --remote` nannte danach nur noch 053.
- **Worker** am selben Tag von dort deployt (`cd worker && npx wrangler deploy --config wrangler.toml`); `/health` antwortet 200, `wrangler tail` (60 s) ohne Fehler.
- **053** (Index `pruefung_folge`) am 13.10.2026 13:16 MESZ per `execute --remote --file` (Daniel: „mach 053“, Durchgänge an dem Tag kurz gehalten): 41.809 gelesen, 20.545 geschrieben, also wie geschätzt eine Schreibzeile je `pruefung`-Zeile und nicht doppelt. `d1_migrations` um 053 ergänzt (`INSERT (name)`), `migrations list --remote --config wrangler.toml` meldet „No migrations to apply“. Ohne `--config` sucht `migrations list` eine `wrangler.jsonc` und findet die Datenbank nicht.
- **Messfenster:** `d1-verbrauch.mjs --zeitraum 1d` sind gleitende 24 Stunden, das Kontingent zählt je UTC-Tag; die Lesesumme umfasst nur die 5 größten Abfragen. Für den UTC-Tag `--time-period <Stunden seit 00:00 UTC + 1>h` mit `--limit 200` und Summe über alle Gruppen (13.10.2026 10:33Z vor den Migrationen: 508.442 gelesen, 5.547 geschrieben).
