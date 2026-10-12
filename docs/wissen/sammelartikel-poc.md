# Sammelartikel selbst lesen — PoC (08.10.2026)

Fahrplan-Schritte 6 und 7 in [autonomie-plan.md](../autonomie-plan.md): Was heute ein Mensch aus
Sammelartikeln abschreibt (Crunchyrolls Season-Lineup, Anime2Yous Anbieter-Listen), soll ein Lauf selbst
in Termine, Ankündigungen und Synchro-Befunde übersetzen. Dieser PoC misst, wie weit ein regelbasierter
Weg trägt. **Nichts davon ist in den Bau eingehängt**; der Code liegt in `pipeline/sammelartikel-poc.ts`
und `pipeline/lib/aussagen*.ts`, die Zusicherungen in `pipeline/check-sammelartikel.ts`, die Ausgabe in
`data/proposals/aussagen.json` (ohne Handlungstexte, siehe Rechte).

Aufruf: `npx tsx pipeline/sammelartikel-poc.ts --roh <Ordner mit HTML-Kopien>` (ohne Kopie holt er live;
Anime2You per `fetch`, Crunchyroll per Playwright). Alle Zahlen unten: Lauf vom 08.10.2026 gegen
`public/data/*` vom Stand `e18cb9e74`.

## Die Bauweise: Artikel → Aussagen → Zuordnung → Abgleich

1. **Lesen** (`lib/aussagen-anime2you.ts`, `lib/aussagen-crunchyroll.ts`): Ein Artikel wird zu einer Liste
   von **Aussagen** — je Titel eine: `titel`, `zusatz` („Staffel 2"), `art` (`start`, `omu-start`,
   `synchro-angekuendigt`), `plattformen`, `datum` mit `datumBedeutung` (genannt / OmU-Start / Tag der
   Meldung), `deutsch` (`ja` / `nein` / `angekuendigt` / `unklar`), `woechentlich`, `zeit`, `folgen`, die
   Quelle mit Veröffentlichungs- und Änderungsdatum, das **Zitat** (die gelesenen Zeilen) und eine
   **Konfidenz** (`lib/aussagen.ts`, `konfidenz()`): das schwächste Glied aus Sprache (genannt 0,95,
   angekündigt 0,9, nicht genannt 0,5), Tag (genannt 0,95, „ab sofort" = Tag der Meldung 0,8, nur Monat 0,7,
   keiner 0,6) und Anbieter (genannt 1, sonst 0,6).
2. **Zuordnen** (`lib/aussagen-zuordnung.ts`): Name **und** Japan-Start, nie Name allein — bei einem
   Simulcast muss `jpStart` des Kandidaten innerhalb von 7 Tagen um den genannten Tag liegen (`ANKER_TAGE`;
   gemessen: 90 × 0 Tage, 46 × 1, 1 × 2, 2 × 7 — Netflix zeigt „Dragon Ball Super: Beerus" eine Woche nach
   Japan). Erst der genaue Name (inklusive Synonyme, Staffelangaben normiert: „2nd Season", „Staffel 2",
   „II" → `s2`), dann der Wortvergleich wie `bewerteTreffer` (geteilt ×2, fremd und fehlend je −1, kein
   fehlendes Wort erlaubt). „Film"/„The Movie" verlangt einen Film, „Staffel" keinen; ein aniSearch-Doppel
   desselben Jahres neben dem AniList-Titel fällt weg. Was nicht eindeutig ist, bleibt **offen** mit Grund und
   Kandidaten; ein Zusatz, der keine Staffel benennt („Staffel 4 bis 8", „Episode 121 bis 240",
   „Sonderfolgen"), wird zum `vorbehalt` an der Zuordnung.
3. **Abgleichen** (`sammelartikel-poc.ts`, `bestandZu()`): `bekannt` (Release desselben Anbieters am
   selben Tag bzw. Ankündigung/Synchro-Beleg vorhanden), `abweichend` (anderer Tag), `neu`.

Kein Schritt braucht ein Sprachmodell: Die Artikel folgen einer festen Vorlage (Kopfzeile in Guillemets,
darunter `Start:`/`Sprache:`/`Stream:`/`Hinweis:`; Crunchyroll `OmU:`/`DE:`). Wo ein Modell helfen würde,
steht unten.

## Korpus: 15 Artikel, 221 Aussagen

| Artikel | Aussagen | deutsch ja / angek. / nein / unklar | zugeordnet | offen | Bestand |
|---|---|---|---|---|---|
| Anime2You „Netflix: Alle Anime-Neuzugänge im Oktober 2026" (23.09.) | 12 | 8 / 0 / 4 / 0 | 11 | 1 | 6 bekannt, 1 abweichend, 4 neu |
| Anime2You „ADN kündigt 25 Simulcasts und Katalogtitel für Oktober 2026 an" (28.09.) | 25 | 7 / 0 / 16 / 2 | 24 | 1 | 7 bekannt, 17 neu |
| Anime2You „Crunchyroll ergänzt zehn weitere Anime-Neuzugänge" (07.10.) | 10 | 0 / 2 / 8 / 0 | 10 | 0 | 10 neu (OmU) |
| Anime2You „Crunchyroll erweitert Anime-Katalog um sechs Neuzugänge + Synchro" (04.10.) | 6 | 1 / 0 / 5 / 0 | 6 | 0 | 1 bekannt, 5 neu (OmU) |
| Anime2You „Drei Anime-Neuzugänge ab sofort auf Netflix verfügbar" (04.10.) | 3 | 1 / 0 / 2 / 0 | 3 | 0 | 1 bekannt, 1 abweichend, 1 neu |
| Anime2You „aniverse kündigt sechs neue Herbst-Simulcasts 2026 an" (30.09.) | 6 | 0 / 0 / 6 / 0 | 6 | 0 | 6 neu (OmU) |
| Anime2You „AKIBA PASS TV kündigt zwei neue Herbst-Simulcasts 2026 an" (28.09.) | 2 | 0 / 0 / 2 / 0 | 2 | 0 | 2 neu (OmU, kein Anbieter im Bestand) |
| Anime2You „Disney+ ergänzt zwei weitere Anime-Neuzugänge" (17.09.) | 2 | 2 / 0 / 0 / 0 | 2 | 0 | 2 neu |
| Anime2You „Prime Video fügt drei Anime-Neuzugänge zu seinem Katalog hinzu" (29.09.) | 3 | 2 / 0 / 1 / 0 | 3 | 0 | 1 bekannt, 2 neu |
| Anime2You „Crunchyroll zeigt 13 Anime-Neustarts im Herbst 2026 auf Deutsch" (15.09., Spiegel des Crunchyroll-Synchro-Artikels) | 13 | 0 / 13 / 0 / 0 | 13 | 0 | 13 bekannt |
| Anime2You „Crunchyroll kündigt 19 neue Simulcasts für Herbst 2026 an" (15.09., Spiegel des Lineups) | 19 | 0 / 4 / 15 / 0 | 19 | 0 | 4 bekannt, 15 neu (OmU) |
| Crunchyroll „Anime-Lineup der Herbst-Season 2026" (15.09., geändert 05.10.) | 44 (+6 „Weiterlaufende" übersprungen) | 0 / 13 / 31 / 0 | 42 | 2 | 42 bekannt |
| Crunchyroll „deutsche Synchros für Herbst 2026" (15.09.) | 13 | 0 / 13 / 0 / 0 | 12 | 1 | 12 bekannt |
| Crunchyroll „Anime-Lineup der Sommer-Season 2026" (17.06.) | 53 | 1 / 12 / 40 / 0 | 51 | 2 | 12 bekannt, 39 neu (OmU) |
| Crunchyroll „deutsche Synchros für Sommer 2026" (17.06.) | 10 | 0 / 10 / 0 / 0 | 10 | 0 | 10 bekannt |

Summe: 221 Aussagen, **214 zugeordnet (97 %)**, 7 offen, 6 mit Vorbehalt, 2 mit Widerspruch im Artikel.
Zuordnungswege: 139 × Name + Japan-Start, 65 × genauer Name, 10 × Wortvergleich. „neu (OmU)" ist kein
Fehlbestand: OmU-Starts sind nach Projektregel keine Kalendertermine.

## Gegenprobe von Hand

Drei Artikel Zeile für Zeile gegen die Ausgabe gelesen (Sprache, Tag, Anbieter, Zuordnung je Aussage):

| Artikel | Köpfe im Artikel | Aussagen | richtig | falsch | fehlend | Befund |
|---|---|---|---|---|---|---|
| Netflix Oktober 2026 | 12 | 12 | 12 Lesung, 11 Zuordnung | 0 | 0 | 1 offen zu Recht („One Piece: Elbaph-Arc" ist bei uns kein eigener Titel); 2 Vorbehalte zu Recht („Staffel 1 und 2", „Sonderfolgen"); `abweichend` bei Ranma ½ Staffel 3 ist ein echter Befund: der Artikel nennt den OmU-Start 03.10., der Bestand den Synchro-Start 05.10. |
| ADN Oktober 2026 | 25 | 25 | 23 Lesung, 24 Zuordnung | 0 | 0 | **Der Artikel widerspricht sich zweimal** (Madoka Film 1: Kurzliste „Dub + Sub", Block „Japanisch (UT)"; Film 3 umgekehrt) — der PoC kennzeichnet beide als `unklar` statt zu entscheiden. 1 offen zu Recht („Dreamland": der Katalog kennt nur den Titel von 2018). Alle 7 Aussagen mit deutschem Ton standen schon im Kalender. |
| Crunchyroll ergänzt zehn Neuzugänge (07.10.) | 10 | 10 | 10 / 10 | 0 | 0 | „Ab sofort verfügbar" → Tag der Meldung (Konfidenz 0,8); „Hinweis: Deutsche Synchronisation angekündigt" bei Rayearth und Detective → `angekuendigt`; Rayearth 2026 statt 1994 über den Japan-Start. |

Zwei Fehler, die die Gegenprobe fand und die jetzt Zusicherungen sind: „Ranma 1/2 – Staffel 3" traf
„Ranma 1/2: Film 3" (Staffel- und Filmnummern sahen gleich aus), „Revolutionary Girl Utena: The Movie" traf
die Serie (Formatwunsch fehlte).

**Gegen die Handdatei** `data/ankuendigungen.yaml` (48 Einträge, von Hand aus denselben Artikeln): Die 42
zugeordneten Lineup-Aussagen stimmen **in Titel, OmU-Tag und Synchro-Status alle 42 mit der Handdatei
überein** (0 abweichend, 0 nur automatisch); die 2 offenen (Dreamland, Paw & Palaces) hatte auch die Hand
ausgelassen; die 6 nur von Hand stammen aus anderen Artikeln (ADN-Lineup, aniverse) und werden aus dem
ADN-Artikel ebenso automatisch gefunden (dieselben sechs Kennungen 159042, 187316, 191656, 206774,
211877, 206949). Der Synchro-Artikel liefert 12 der 13 Hand-Synchros, der Anime2You-Spiegel alle 13
(Apothekerin Staffel 3 über den Japan-Start → Cour 1, wie die Hand entschied).

**Rückschau Sommer 2026:** Alle 10 im Juni angekündigten Synchros haben heute ein Crunchyroll-Release im
Bestand (Starts 04.07.–15.08.) — die Ankündigung war in 10 von 10 Fällen ein belastbarer Vorbote.

## Was der Bestand davon hätte

Von 89 Aussagen mit deutschem Ton oder Synchro-Zusage sind 86 zugeordnet, **79 davon schon bekannt**,
7 neu — und die 7 Neuen sind genau die mit Konfidenz 0,8 (Tag der Meldung) oder Vorbehalt: Campfire
Cooking S1 (Disney+, 17.09.), One Piece „Staffel 4 bis 8" (Disney+), Demon Slayer Infinity Castle I (Prime,
29.09.), My Happy Marriage „Sonderfolgen" (Netflix, 25.10.), Das Band der Unterwelt (Netflix, ohne Tag),
Rayearth und Detective S2 (Synchro angekündigt, Crunchyroll). Alle 74 Aussagen mit Konfidenz ≥ 0,9 und
ohne Vorbehalt sind bekannt: Der Lauf hätte rückblickend dasselbe eingetragen wie die Hand, ohne Widerspruch.

## Quellen, Rechte, Wege

| Quelle | Weg | robots.txt (08.10.2026) | Rechte | Entscheidung |
|---|---|---|---|---|
| **Anime2You** Anbieter-Sammelartikel | RSS (3 Feeds, schon angebunden) und **REST** `wp-json/wp/v2/posts?after=<Zeit>&search=…&_fields=id,date,modified,link,title,categories` (HTTP 200, 08.10.2026) — der bessere Auffindeweg: kein Blättern durch Feed-Seiten, Änderungsdatum je Artikel | `User-agent: *` sperrt nur `/wordpress/wp-admin/` und `/wordpress/wp-includes/`; namentlich gesperrt: DotBot, AhrefsBot, SemrushBot, MJ12bot, BLEXBot | Impressum nennt nur „© 2013 - 2026 Anime2You GmbH", keine AGB. Titel, Termine, Sprachangaben sind Tatsachen; die **Handlungstexte sind Sprachwerke** und werden nicht übernommen (nur ihre Länge) | **nutzen** — auch als Spiegel der Crunchyroll-Season-Artikel: beide erschienen am 15.09.2026 um 19:10 bei Anime2You mit denselben 13 bzw. 19 Titeln |
| **Crunchyroll** Season-Artikel (`/de/news/seasonal-lineup/`) | nur Playwright (Cloudflare gibt `curl` 14 KB ohne Artikel); JSON-LD mit `datePublished`/`dateModified` (Herbst-Lineup: 15.09. → 05.10., der Artikel wird nachgepflegt); Übersicht listet je Season Lineup, Synchros, Wochenprogramm | `/news` nicht gesperrt (nur `*/search`, Konto, Listen) | Nutzungsbedingungen (`/de/tos`, gelesen 08.10.2026), Abschnitt 5, wörtlich: „Darüber hinaus ist es Ihnen Folgendes … untersagt: … **Automatisierter Zugriff:** Roboter, Spider, Scraper, Deep-Links, … oder andere automatisierte Datenbeschaffung- oder Extraktionstools, -programme oder -algorithmen verwenden, um auf einen Teil der Dienste oder Inhalte zuzugreifen, diese zu erwerben, zu ändern, zu kopieren, zu überwachen …" sowie „**Gewerbliche Nutzung:** Ein Unternehmen bauen oder betreiben, das die Dienste nutzt, unabhängig davon, ob es gewinnorientiert ist oder nicht. Dieses Verbot umfasst … Texte …" | **nicht als Primärquelle** — die Aussagen stehen am selben Tag bei Anime2You. Offen für Daniel: `scrape-crunchyroll-woche.ts` (seit 25.09.) und die Beleg-Lesung lesen crunchyroll.com heute schon; die Handlungstexte („Inhalt:") dürfen nach diesem Wortlaut nicht übernommen werden, es sei denn, Crunchyroll stimmt zu |
| heise/Filmstarts-Monatslisten, ANN, manime, animenachrichten | — | — | — | verworfen, Gründe in [quellen.md](quellen.md) („News-Quellen im Vergleich", 25.09. und 06.10.2026): keine Sprachangabe bzw. zu selten |

Was Anime2You **nicht** spiegelt: die Handlungstexte Crunchyrolls (es schreibt eigene) und die Spalte
`DE: <Tag>`, wenn Crunchyroll später einen Synchro-Termin nachträgt (Sommer-Lineup: „BLACK TORCH DE: 4.
Juli"). Dafür meldet Anime2You den Synchro-Start als eigene Meldung, die `scrape-anime2you.ts` heute schon
liest.

## Wo ein Modell nötig wäre — und wo nicht

Nicht nötig: Alle 15 Artikel folgen Vorlagen; die Lesung ist deterministisch, und die Zusicherungen in
`check-sammelartikel.ts` stellen jede gefundene Form nach. Ein Modell brächte nur Nichtdeterminismus und
Kosten in die CI.

Nötig oder hilfreich, heute an einen Menschen zu geben (im Korpus 8 von 221 Aussagen, 3,6 %):

- **Zusätze, die keine Staffel benennen** (6 Vorbehalte: „Staffel 1 und 2", „Sonderfolgen", „Staffel 4 bis
  8", „Episode 121 bis 240", „Episode 52 bis 101", „2nd Cour"): Welcher unserer Titel ist gemeint, und sind
  es Folgen oder Staffeln? Das ist dieselbe Lücke wie `UNKLARER_TEIL` in `lib/sammelartikel.ts`.
- **Widersprüche im Artikel** (2): Kurzliste gegen Block. Ein Mensch würde die Anbieterseite prüfen; der
  Lauf kann nur kennzeichnen.
- **Fließtext-Meldungen** ohne Vorlage („Deutsche Synchro von Teil 2 der vierten Re:ZERO-Staffel startet
  später") bleiben bei `dubBefund`/`PAUSE_HINTS` in `scrape-anime2you.ts` — dort wäre ein Modell der
  nächste Schritt, aber die Messung vom 12.08.2026 (4 relevante Pausenmeldungen in 3.136 Artikeln) lohnt
  ihn nicht.

## Empfehlung

1. **Anime2You als Quelle, Crunchyroll nur als Gegenprobe** (Rechtslage oben; Entscheidung Daniel). Der
   Auffindeweg wird die REST-API mit `after=<letzter Lauf>`; Sammelartikel erkennt der Lauf an ihrer Form
   (mindestens zwei Köpfe mit Feldern), nicht mehr an der Überschrift (`ANBIETER_SAMMELARTIKEL` hat drei
   Artikel verpasst, `status.md` 02.10.2026).
2. **Schwelle für die Übernahme ohne Menschen:** `deutsch` ∈ {ja, angekuendigt}, Konfidenz ≥ 0,9,
   Zuordnung `name+start` oder `name-genau`, kein Vorbehalt. Das sind im Korpus 74 Aussagen, alle
   rückblickend richtig. `deutsch: ja` mit Tag → Termin (Quelle, `veroeffentlichtAm`, Zitat als Beleg);
   `angekuendigt` oder `omu-start` → Eintrag in der Form von `data/ankuendigungen.yaml` (automatisch erzeugt
   neben der Handdatei, Hand gewinnt).
3. **Konfidenz 0,8 („ab sofort")**: übernehmen als Termin mit `dateMeaning: 'available-from'` — „im
   Angebot seit" ist nicht „erschienen am" (CLAUDE.md), und genau das sagt „ab sofort".
4. **Alles andere** (offen, Vorbehalt, unklar, Konfidenz < 0,8) in `data/proposals/nicht-zugeordnet.json`,
   mit Grund und Kandidaten — die Liste gibt es schon, sie bekommt damit auch die Fälle, die heute still
   verworfen werden.
5. **Einbau**: `aussagenAusAnime2You` ersetzt `leseSammelartikel` in `scrape-anime2you.ts`
   (`sammelartikelNachholen`), `releasesAus` bekommt die Aussagen als Vorschläge; `ordneZu` arbeitet im Bau
   mit der `jpStart`-Karte aus `bau/02-titel.ts` statt mit `franchises.json`. Umbau und Verhaltensänderung
   getrennt: erst der Leser mit Bau-Vergleich (`tools/bau-vergleich.mjs`), dann die Übernahme.
6. **Wiederlesen bei Änderung**: Crunchyroll pflegt den Lineup-Artikel nach (`dateModified` 05.10. bei
   Veröffentlichung 15.09.), Anime2You trägt Titel nach (`modified` in der REST-Antwort). Gelesen wird, wenn
   sich das Änderungsdatum bewegt — dieselbe Regel wie in `belege-lesen.ts`.

## Vorschlagslauf (eingehängt 08.10.2026, nur Vorschlagsmodus)

`pipeline/fetch-sammelartikel.ts` (`npm run data:sammelartikel`) läuft im Tageslauf `refresh-data.yml` hinter dem
Anime2You-Schritt. Er liest **nur Anime2You** (Crunchyroll bleibt unberührt, Nutzungsbedingungen siehe oben) und schreibt
**nur** `data/proposals/aussagen.json` (je Aussage: Kennung, `erstGesehen`, `geaendert`, `offenOderUnklar`, Ergebnis mit
Zitat, Konfidenz, Zuordnung, Bestandsabgleich; ohne Handlungstexte; Protokoll 60 Tage) und `data/sammelartikel-stand.json`
(`stand` = jüngster `modified_gmt`, `pauseBis`, `letzterAusgang`). `schreibeNurVorschlag()` verweigert jeden anderen Pfad;
`data/curated/` und `data/ankuendigungen.yaml` sind tabu — die Übernahme ist ein späterer, getrennter Schritt nach
einigen Wochen Auswertung dieser Datei (Schwellen: Empfehlung 2–4 oben).

- **Weg:** `wp-json/wp/v2/posts?modified_after=<Stand>&per_page=100&_fields=…,content` — ein Aufruf liefert Volltext bis
  100 Artikel (08.10.2026: 350 Artikel seit 14.09. in vier Aufrufen, 18 s). `orderby=modified` leitet der CDN auf die
  Liste ohne Parameter um (301) — nicht verwenden. Sammelartikel erkennt der Lauf an der Form (mindestens zwei Aussagen);
  Abgangsmeldungen („verlassen … den Katalog") werden vorher ausgelassen (`ABGANG`, „Verfügbar bis" ist kein Start).
- **robots.txt** wird je Lauf gelesen (`robotsErlaubt`, namentliche Gruppe vor `*`); nicht lesbar oder verboten = kein Abruf.
- **Pause statt Abbruch:** 403/429/Zeitüberschreitung (drei Versuche, 5 s/20 s) → `pauseBis` (Retry-After, 1–24 h), Stand
  rückt nicht vor, Exit 0. **Ausweichweg** (getestet mit `--ausweichweg`): Streaming-Feed (25 Meldungen) + Artikelseiten,
  höchstens 12 je Lauf; dort rückt der Stand nicht vor (Wiederlesen ist wegen der Kennung unschädlich).
- **Wochenwache** (`tools/wache-woechentlich.mjs`, montags): Zeile „Sammelartikel: N neue Aussagen, davon M offen/unklar"
  (letzte sieben Tage; offen/unklar = nicht zugeordnet, Vorbehalt oder `deutsch: unklar`), dazu ein Hinweis in
  `data/meldungen-an-claude.jsonl`; Befund erst nach 96 h ohne Lauf.
- **Bekannte Grenze:** Netflix-Meldungen über verlängerte Lizenzen („Death Note bleibt") liest der Leser als „ab sofort"
  (Konfidenz 0,8, Hinweis im Zitat) — vor einer Übernahme gegenzulesen.
- Messung 08.10.2026 (Fenster seit 14.09.): 350 Artikel, 43 Sammelartikel, 277 Aussagen, 42 offen/unklar.
