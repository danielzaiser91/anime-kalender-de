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
   `daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md`, eine Liste, die nur
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
Fehler. Wer sie will, legt einen Discord-Webhook an; eingehängt ist er in zwei Zeilen. Bis dahin
gilt: nachsehen statt annehmen.

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
- **Eine Codeänderung erreicht die Daten mit demselben Verzug.** Der Bau
  (`bestand-bauen.yml`) hängt an den drei Sammel-Läufen; wer heute etwas an der
  Pipeline ändert und die Wirkung sehen will, stößt ihn selbst an:
  `gh workflow run bestand-bauen.yml`.
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
npm run check:panel        # das Detail-Panel, mehrere Titel, beide Themen
npm run check:ansichten    # alle elf Routen, beide Themen
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

`check:vor-commit`, `check:ansichten` und `check:panel` schreiben `docs/*.png` neu. Wer danach `git checkout -- docs` und `git clean -fq docs/` fährt, verwirft auch, was gerade von Hand in `docs/wissen/` ergänzt wurde oder als neue Datei unter `docs/` liegt — am 19.09.2026 zweimal passiert (ein Abschnitt in `quellen.md`, beinahe die Kandidatenliste). Zurückgesetzt wird nur `git checkout -- "docs/*.png"` und `git clean -fq docs/ -e wissen -e "*.md"`; Wissens-Einträge werden **vor** der Prüfkette committet.
