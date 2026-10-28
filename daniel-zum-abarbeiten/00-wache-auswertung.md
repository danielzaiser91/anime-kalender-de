# Auswertung der Wache

Die Wache (`daniel-zum-abarbeiten/00-wache.md`) meldet, wenn der Bestand etwas
verliert. Sie kann nicht wissen, **warum** — hier steht es. Neue Auswertungen
kommen oben dazu, ältere bleiben stehen: An der Reihe zeigt sich, ob eine Lücke
wiederkehrt.

## 28.10.2026, 10:05 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Bestandsbau ist grün: letzter Erfolg 2026-10-28T08:05:18Z, seither 0 rote oder abgebrochene Versuche (12); auch das Deploy meldet keinen Alarm (12). Der Pull-Request-Stau ist auf 2 offene PRs geschrumpft (#2219, #2217, beide erst 1 Tag offen, 08) gegenüber 4 am 27.10. (10). „Claude — Daten-PR zusammenführen" lief 28-mal im 48-Stunden-Fenster ohne Fehlschlag (01). Briefkasten ohne Rückstau, alle 189 Adressen gelistet (03), Zugänge unauffällig (04). Der Ausschlussgrund „Blöcke und Titel verschieden viele" verharrt seit dem 26.10. 11:23 Uhr bei 225 Serien, also auch am zweiten Tag ohne weiteren Zuwachs (07, 09). Der Grund „Folgenzahl geht nicht auf" ist auf 41 Serien gesunken (07), gegenüber zuletzt gemeldeten 46 am 24.10. (09).

**Wo ist Verbesserungspotenzial?** `anisearch-cover-eigen` ist jetzt 16,7 Tage ohne Erfolg (06), einen weiteren Tag mehr als die 15,7 vom 27.10. (10); `cr-einzelwerke` und `cr-filmbloecke` sind jetzt 7,8 Tage ohne Erfolg (06) gegenüber 6,8 Tagen am 27.10. (10) — beide wachsen seit Tagen gleichmäßig weiter, ohne dass ein Issue oder eine PR (08) das aufgreift. `motn` ist 5,2 Tage ohne Erfolg (06), bisher in keinem Urteil genannt. Issue #1595 steht jetzt 9 Tage offen (08) gegenüber 8 am 27.10. (10), Issue #898 jetzt 16 Tage gegenüber 15 (08, 10), beide weiterhin ohne erkennbare Bearbeitung. Die Quelle `crunchyroll` mit dem seit dem 25.10. (10) wiederholt gemeldeten Fehler „keine Kachel im Kalender gefunden" taucht in der heutigen Liste (06) nicht mehr auf — möglicherweise behoben, aus dem Dossier aber nicht sicher zu entscheiden. Die PR-Prüfkette schlug 11-mal im 48-Stunden-Fenster fehl, alle gezeigten Fälle auf PR-Zweigen (`feat/disc-bereich-b3` 2x, `fix/ansichten-woche-ecke` 1x), nicht auf main (01) — normales CI-Rauschen laufender PRs, kein Produktionsrisiko.

**Wo sind echte Risiken und Lücken?** Die Wache meldet für den Lauf um 27.10. 08:57 Uhr eine Auffälligkeit: 3 Titel und 3 Releases weniger (11), im Dossier nicht erklärt. Keiner der Läufe in der aktuellen 24-Stunden-Übersicht zeigt einen ausgleichenden Zuwachs „titel +3" (02) — der aktuelle Bestand von 2924 Titeln (02) trägt den Verlust weiter. Das ist dasselbe Muster wie die vom vorigen Urteil (10) genannten, bis heute ungeklärten Verluste vom 26.10. um 11:22 und 11:53 Uhr; auch dafür zeigt 08 weiterhin kein Issue und keine PR. Daniel: beide Vorfälle (26.10. 11:22/11:53 Uhr und 27.10. 08:57 Uhr) zusammen auf einen Fehler im Vorfilter prüfen, da ein Vorfilter laut Projektregel verschieben, nicht löschen soll. Daneben fiel „Wache — Delta und Briefkasten" am 27.10. um 13:12 Uhr auf main einmal aus (01), lief aber um 14:13 Uhr erfolgreich und schrieb den Befund (11) — einmalig, zeigt aber, dass auch die Wache selbst nicht ausfallfrei läuft.

**Was läuft komplett falsch?** Kein Beleg im Dossier zeigt einen aktuell falsch oder still ausgelieferten Datensatz: das reguläre Delta der letzten 24 Stunden ist klein (Titel 0, Urteile +2, offen 0, 02), der Bestandsbau ist grün, das Deploy ohne Alarm (12), der Datensatz ist 0,9 h alt und damit innerhalb der 36-h-Frist (05). `public/data/blocker.json` trägt weiterhin die Erzeugungszeit vom 30.09. (06), jetzt 28 Tage unverändert trotz durchgehend erfolgreicher Bauten seither — seit mehreren Urteilen (10) ungeklärt, ob das Skript nur bei Funden schreibt oder seit vier Wochen gar nicht mehr läuft.


## 27.10.2026, 10:06 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Bestandsbau ist aktuell grün, letzter erfolgreicher Lauf 2026-10-27T08:22:27Z, seither 0 rote oder abgebrochene Versuche (12); die im letzten Urteil (10, 26.10.) vorrangig genannte PR #2086 ist nicht mehr offen (08), die damalige Störung also behoben. Der Pull-Request-Stau ist weiter klein: nur 4 offene PRs (08), keine älter als 1 Tag, keine mit „Prüfung rot" im Titel. „Claude — roten Datenlauf untersuchen" lief im 48-Stunden-Fenster 14-mal erfolgreich ohne Fehlschlag (01). „Deploy auf GitHub Pages" zeigt im selben Fenster 61 Erfolge und keinen Fehlschlag (01) — eine Verbesserung gegenüber den 6 Fehlschlägen im Urteil vom 25.10. (10). Briefkasten ohne Rückstau, alle 189 Adressen gelistet (03), Zugänge unauffällig (04).

**Wo ist Verbesserungspotenzial?** `anisearch-cover-eigen` ist jetzt 15,7 Tage ohne Erfolg (06), einen Tag mehr als im Urteil vom 26.10. (10); `cr-einzelwerke` und `cr-filmbloecke` sind jetzt 6,8 Tage ohne Erfolg (06) gegenüber 5,8 Tagen am 26.10. (10) — weiterhin ungeklärt. Die Quelle `crunchyroll` meldet weiterhin 0 Treffer mit dem Fehler „keine Kachel im Kalender gefunden", jetzt 5,5 Tage ohne Erfolg (06) gegenüber 3,5 Tagen im Urteil vom 25.10. (10), seitdem in keinem Urteil mehr genannt. Issue #1595 steht jetzt 8 Tage offen (08) gegenüber 7 am 26.10. (10), Issue #898 jetzt 15 Tage gegenüber 14 (08, 10), beide weiter ohne erkennbare Bearbeitung. Die Wochenwache meldet 33 neue Daten-Detektiv-Funde (05), mehr als die 29 vom 26.10. 14:17 Uhr (09) — Titel, bei denen JustWatch deutschen Ton nennt, aber im Bestand kein Weg dazu führt. Der Ausschlussgrund „Blöcke und Titel verschieden viele" ist auf 225 Serien angewachsen (07), gegenüber 219 drei Tage zuvor (09), seit dem letzten Warnhinweis um 11:23 Uhr am 26.10. (09) aber ohne weiteren Zuwachs. „Bestand — zusammenführen und bauen" hatte im 48-Stunden-Fenster 13 Fehlschläge und 2 Abbrüche (01), die gezeigten Beispiele konzentrieren sich auf rund eine Stunde am 26.10. zwischen 12:07 und 13:07 Uhr — zum Zeitpunkt des letzten Urteils (10) noch nicht geschehen; der Bestand ist seither durchgehend grün (12).

**Wo sind echte Risiken und Lücken?** Der Zusammenführungslauf um 11:22 Uhr am 26.10. verlor 1 Titel und 2 Urteile sowie 3 Titel ohne Synchro-Beleg, zusätzlich zu den als begründet erklärten Herabstufungen durch Kanal-Titel (02, 11), dazu je 1 Synchro-Beleg weniger bei netflix und joyn. Ein weiterer Lauf um 11:53 Uhr verlor erneut 1 Titel ohne Synchro-Beleg (02). Beide Verluste sind im Dossier nicht erklärt und seither nicht zurückgenommen — der aktuelle Bestand (2927 Titel, 02) trägt sie weiter. Kein Issue und keine PR in 08 nennt diese Verluste. Daniel: die Verluste aus den Läufen um 11:22 und 11:53 Uhr am 26.10. (netflix, joyn, die 2 verlorenen Urteile) auf einen Fehler im Vorfilter prüfen, da ein Vorfilter laut Projektregel verschieben, nicht löschen soll.

**Was läuft komplett falsch?** Kein Beleg im Dossier zeigt einen aktuell falsch oder still ausgelieferten Datensatz: das reguläre Delta der letzten 24 Stunden ist klein (Titel +5, Urteile 0, offen +1, 02), der Bestandsbau ist grün (12). `public/data/blocker.json` trägt weiterhin die Erzeugungszeit vom 30.09. (06), unverändert seit dem Urteil vom 26.10. (10) — nicht prüfbar, ob das Skript nur bei Funden schreibt oder seit knapp vier Wochen gar nicht mehr läuft.


## 26.10.2026, 10:25 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Pull-Request-Stau ist weiter geschrumpft: nur noch 7 offene PRs (08) gegenüber 14 am 25.10. (10), der jetzt älteste PR #2043 ist wie gestern erst 1 Tag offen. `link-check` liefert nach langem Stillstand wieder Treffer: letzter Erfolg vor 0,2 Tagen mit 150 Treffern (06) — die seit mehreren Urteilen (10) gemeldete, zuletzt auf 19,8 Tage gewachsene Lücke ist beendet. Briefkasten ohne Rückstau, alle 189 Adressen gelistet (03). „Claude — Daten-PR zusammenführen" lief 24-mal ohne Fehlschlag (01). Deploy läuft aktuell erfolgreich, der ausgelieferte Datensatz ist 4,0 h alt und damit innerhalb der 36-h-Frist (05).

**Wo ist Verbesserungspotenzial?** `cr-einzelwerke` und `cr-filmbloecke` sind wieder ohne Erfolg seit 5,8 Tagen (06) — am 23.10. (10) lieferten sie noch regelmäßig mit 2,8 Tagen, der damals für beendet erklärte Stillstand wächst erneut. `anisearch-cover-eigen` (14,7 Tage) und `adn-catalog` (14,2 Tage) sind ohne Erfolg (06) und tauchen in keinem bisherigen Urteil (10) auf — bisher unbemerkt gewachsen. Issue #1595 steht jetzt 7 Tage offen (08) gegenüber 6 am 25.10. (10), Issue #898 jetzt 14 Tage gegenüber 13 (08, 10), beide weiterhin ohne erkennbare Bearbeitung. PR #2082 trägt im Titel selbst den Hinweis „[Prüfung rot]" (08) und steht weiter offen.

**Wo sind echte Risiken und Lücken?** „Bestand — zusammenführen und bauen" ist seit dem letzten grünen Lauf um 05:06 Uhr durchgehend rot, 4 rote/abgebrochene Versuche in rund 4,2 Stunden (12, 01) — unter der 6-Stunden-Schwelle, aber die dritte solche Serie in dieser Urteilsreihe (10) nach handlung-eigen (25.10.) und check-synchro-original (23.10.). Ursache laut dem neuen Issue #2085 (heute): eine Folgenliste (`tmdb-folgen.json`) mit anderer Kennung als in `tmdb-titles.json`. Die Korrektur-PR #2086 (`fix/tmdb-folgen-kennung`) ist offen, scheiterte aber selbst einmal in der PR-Prüfkette um 05:45 Uhr (01), bevor main danach noch dreimal rot lief (06:07, 07:26, 08:12 Uhr, 01). PR #2043 (`cr-termine-waechter`) scheiterte zweimal in der PR-Prüfkette am 25.10. abends (22:04, 22:15 Uhr, 01) und steht weiter offen (08), ohne dass eine neue Korrektur sichtbar ist. Daniel: PR #2086 vorrangig prüfen und mergen, bevor die 6-Stunden-Schwelle erreicht ist; PR #2043 auf die wiederholte CI-Ursache ansehen.

**Was läuft komplett falsch?** Kein Beleg im Dossier zeigt einen aktuell falsch oder still ausgelieferten Datensatz: `public/data/blocker.json` ist leer (06), das Delta zeigt nur reguläre kleine Veränderungen (Titel +1, Urteile +2, offen 0, 02), der ausgelieferte Datensatz ist 4,0 bis 4,3 h alt und damit innerhalb der Frist (05). Nicht prüfbar: `blocker.json` trägt weiterhin den 30.09. als Erzeugungszeit (06), obwohl seither viele erfolgreiche Bauten liefen — ob das Skript nur bei Funden neu schreibt oder seit 26 Tagen gar nicht mehr läuft, lässt sich aus dem Dossier nicht entscheiden.


## 25.10.2026, 10:05 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Pull-Request-Stau ist deutlich kleiner geworden: nur noch 14 offene PRs (08) gegenüber 22 am 24.10. (10), der jetzt älteste PR #1943 ist erst 1 Tag offen statt der damals 8 Tage von #1386. „Claude — Daten-PR zusammenführen" lief 21-mal ohne main-Fehlschlag (01). „Claude — roten Datenlauf untersuchen" hatte 0 Fehlschläge bei 10 Läufen (01) und hat zur aktuellen Bestandsbau-Störung bereits zwei Korrektur-PRs erzeugt (#1984, #1990, 08). Briefkasten ohne Rückstau, alle 189 Adressen gelistet (03). Deploy läuft aktuell wieder erfolgreich, 0,1 h alt (05). „Belege ohne Fundstelle" verharrt seit drei Tagen unverändert bei 111 (09).

**Wo ist Verbesserungspotenzial?** `link-check` bleibt ohne Erfolg und wird älter: 19,8 Tage (06) gegenüber 18,8 Tagen am 24.10. (10). Die Quelle crunchyroll liefert weiterhin 0 Treffer mit dem Fehler „keine Kachel im Kalender gefunden", jetzt 3,5 Tage (06) gegenüber 2,5 Tagen am 24.10. (10), Ursache weiter ungeklärt. „Deploy auf GitHub Pages" schlug in diesem Fenster 6-mal auf main fehl (01), mehr als die 2 vom 24.10. (10), erholt sich aber jeweils schnell. „Aussehen prüfen" schlug zweimal auf main fehl, zuletzt heute um 07:19 Uhr (01) — neu seit dem letzten Urteil. Issue #898 steht jetzt 13 Tage offen (08) gegenüber 12 am 24.10. (10), Issue #1595 jetzt 6 Tage gegenüber 5 (08, 10).

**Wo sind echte Risiken und Lücken?** „Bestand — zusammenführen und bauen" ist seit dem letzten grünen Lauf um 04:06 Uhr durchgehend rot: 10 rote/abgebrochene Versuche in Folge über rund 5 Stunden (12, 01, 04) — noch unter der 6-Stunden-Alarmschwelle, aber nah dran. Ursache laut dem neuen Issue #1974 (heute): ein überholter Eintrag in `data/handlung-eigen.yaml`. Zwei Pull Requests versuchen die Korrektur, ohne dass einer gemergt ist: #1984 entfernt die Einträge, #1990 stuft die Prüfung zu einem Hinweis herab (08) — dieselbe Reparaturschleife wie beim check-synchro-original-Fall vom 21.–23.10. (10). PR #1984 selbst scheiterte heute um 08:45 Uhr in der PR-Prüfkette auf seinem eigenen Zweig fix/handlung-eigen-ueberholt (01), was die Entscheidung zusätzlich erschwert. Der ausgelieferte Datensatz ist mit 4,9 h noch innerhalb der 36-h-Frist (05), aber ohne Merge wächst das Risiko einer veralteten Auslieferung weiter. Daniel: entscheiden, welche der beiden handlung-eigen-PRs gemergt wird, bevor die 6-Stunden-Schwelle erreicht ist.

**Was läuft komplett falsch?** Kein Beleg im Dossier zeigt einen aktuell falsch oder still ausgelieferten Datensatz: `public/data/blocker.json` ist leer (06), das Delta zeigt nur reguläre kleine Veränderungen (Titel 0, Urteile +1, offen +3, 02), der ausgelieferte Datensatz ist 4,9 h alt und damit innerhalb der Frist (05).


## 24.10.2026, 11:06 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Bestandsbau liefert wieder zuverlässig: `bestand-bauen.yml` lief zuletzt vor 1 h erfolgreich (04), der Datensatz ist 0,9 h alt (05), und die am 23.10. (10) gemeldete Ausfallserie ist beendet — keiner der drei damals konkurrierenden PRs zur Korrektur von check-synchro-original (#1834, #1830, #1816) steht noch offen (08), ebenso wenig die Issues #1829, #1800 und #1773 aus demselben Urteil. „Claude — roten Datenlauf untersuchen" zeigt in den letzten 48 Stunden 0 Fehlschläge bei 122 Läufen (01), gegenüber 33 Fehlschlägen im Urteil vom 23.10. (10). Auch die dort erwähnten Abbrüche von `claude-reparatur.yml` (Kontingent/Token) tauchen aktuell weder in 01 noch in 04 auf. Briefkasten ohne Rückstau, alle 186 Adressen gelistet (03); Zugänge unauffällig (04). „Belege ohne Fundstelle" verharrt bei 111 (09) — zum ersten Mal in der Urteilsreihe (10) kein Zuwachs gegenüber dem Vortag.

**Wo ist Verbesserungspotenzial?** Der älteste offene Pull Request #1386 ist jetzt 8 Tage offen (08), einen Tag mehr als im Urteil vom 23.10. (10); der Gesamtstau ist mit 22 offenen PRs (08) minimal kleiner als die dort genannten 23. `link-check` bleibt ohne Erfolg und wird weiter älter: 18,8 Tage (06) gegenüber 17,8 Tagen am 23.10. (10). Die Terminableitung verwirft weiterhin langsam mehr Serien wegen nicht aufgehender Folgenzahl: 46 jetzt (07, 09) gegenüber 45 am 20.10. (09) — bisher kein eigener Befund dazu in 10. „Deploy auf GitHub Pages" schlug am 23.10. zweimal auf dem Zweig main fehl, um 12:26 und 13:12 Uhr (01), nach dem letzten Urteil; aktuell läuft Deploy wieder erfolgreich, 0,8 h alt (05).

**Wo sind echte Risiken und Lücken?** Issue #898 (aniSearch-Titel mit Weg ohne Herkunft, verwirft laut Titel den Bestandsbau) steht jetzt 12 Tage offen (08), gegenüber 9 Tagen im Urteil vom 21.10. (10), Ursache weiterhin ungeklärt. Issue #1595 (Cartoon-JW-Stichprobe) ist jetzt 5 Tage offen (08) gegenüber 2 Tagen am 21.10. (10). Die Quelle crunchyroll meldet in 06 zwar „Erfolg" vor 2,5 Tagen, aber mit 0 Treffern und dem Fehler „keine Kachel im Kalender gefunden" — ein stiller Funktionsausfall, der vom Erfolg/Fehlschlag-Status nicht erfasst wird und in keinem der bisherigen Urteile (10) genannt ist. Pull Request #1433 (korrektur/patchnotes-stift) hängt seit 7 Tagen offen (08) und scheiterte in der PR-Prüfkette noch am 24.10. um 00:29 Uhr (01) — derselbe Zweig steht in 01 als Beispiel für die 35 Fehlschläge dieses Laufs im 48-Stunden-Fenster. Daniel: #898 (12 Tage) und den Crunchyroll-Kachel-Fehler vorrangig prüfen, PR #1433 auf die wiederholte CI-Ursache ansehen.

**Was läuft komplett falsch?** Kein Beleg im Dossier zeigt einen aktuell falsch oder still ausgelieferten Datensatz: `public/data/blocker.json` ist leer (06), das Delta zeigt nur kleine reguläre Veränderungen (Titel 0, Urteile +1, offen -1, 02), der ausgelieferte Datensatz ist 0,9 h alt (05).


## 23.10.2026, 11:05 — Claude-Lauf, Befund

**Was läuft korrekt.** „Claude — Daten-PR zusammenführen" zeigt in diesem Fenster 56 Erfolge und keinen gemeldeten main-Fehlschlag mehr (01) — das im Urteil vom 21.10. (10) genannte Risiko (10 Fehlschläge, rund 43 %) ist aktuell nicht mehr zu sehen. Der Briefkasten hat keinen Rückstau, alle Adressen sind gelistet (03). Der Pull-Request-Stau schrumpft: 23 offene PRs (08) gegenüber 29 am 21.10. (10), der damals älteste #1371 ist nicht mehr offen. `cr-einzelwerke` und `cr-filmbloecke` liefern weiter regelmäßig (2,8 Tage, 06), der frühere 26-Tage-Stillstand bleibt beendet.

**Wo ist Verbesserungspotenzial?** „Belege ohne Fundstelle" wächst weiter, aber langsam: 111 am 23.10. gegenüber 110 am 21./22.10. (09) — derselbe seit mehreren Urteilen (10) gemeldete Trend ohne Gegenmaßnahme. `link-check` bleibt ohne Erfolg und wird älter: jetzt 17,8 Tage (06) gegenüber 15,8 Tagen im Urteil vom 21.10. (10). Der PR-Stau ist zwar kleiner geworden, aber der jetzt älteste offene PR #1386 steht seit 7 Tagen (08), länger als der damalige Spitzenreiter #1371 mit 5 Tagen. Zwischen dem Urteil vom 21.10. (10) und heute wurde kein neues Urteil committet; im selben Fenster schlug „Claude — Wache durchsehen" zweimal fehl (01).

**Wo sind echte Risiken und Lücken?** `bestand-bauen.yml` hat unter den letzten 20 Läufen keinen Erfolg mehr (04, 11); der letzte erfolgreiche Lauf liegt 39,9 h zurück, erlaubt sind 36 h (05), und `public/data/meta.json` ist entsprechend 39,9 h alt (05). Im 48-Stunden-Fenster stehen dem 42 Fehlschläge von „Bestand — zusammenführen und bauen" nur 14 Erfolge gegenüber, bei 81 übersprungenen Läufen (01), z. B. Lauf 39922987758 am 23.10. um 08:12 Uhr auf Zweig main. Ursache laut dem neuen Issue #1829 (23.10., 08): check-synchro-original hängt an der echten Uhr. Drei Pull Requests versuchen dieselbe Korrektur, ohne dass einer gemergt ist: #1834, #1830 und #1816, alle „check-synchro-original mit fester Uhr" (08) — eine Reparaturschleife, die nicht zum Abschluss kommt. Dazu passt: `claude-reparatur.yml` brach am 22.10. fünfmal binnen drei Stunden ab, der Claude-Schritt endete jeweils nach wenigen Sekunden, Kontingent leer oder Token ungültig (11, Läufe von 09:20 bis 12:19 Uhr). Auch die automatische Untersuchung selbst kämpft: „Claude — roten Datenlauf untersuchen" schlug 33-mal von rund 141 Läufen fehl (01). Die Issues #1800 (22.10., neu) und #1773 (21.10., jetzt 2 Tage offen) bleiben laut 08 ungeklärt und hängen laut Titel ebenfalls am Bestandsbau. Daniel: entscheiden, welche der drei check-synchro-original-PRs gemergt wird, und bei `claude-reparatur.yml` Kontingent oder `CLAUDE_CODE_OAUTH_TOKEN` prüfen.

**Was läuft komplett falsch?** Kein Beleg im Dossier zeigt einen aktuell falsch ausgelieferten Datensatz: `public/data/blocker.json` ist leer (06), das Delta zeigt keinen Sprung, nur Stillstand bei 2922 Titeln, 2010 Urteilen, 244 offen (02). Richtig ist aber, dass dieser Stillstand selbst schon über der erlaubten Frist liegt (39,9 h statt 36 h, 05) — bleibt `bestand-bauen.yml` weiter rot, wird aus der Lücke in den „Risiken" eine still ausgelieferte, veraltete Seite.


## 21.10.2026, 11:05 — Claude-Lauf, Befund

**Was läuft korrekt.** „Bestand — zusammenführen und bauen" zeigt in den letzten 48 Stunden keinen einzigen Fehlschlag (01: skipped 68, success 41, cancelled 1) — das seit dem Urteil vom 20.10. (10) als beendet gemeldete Pendeln bleibt aus, das Delta (02) zeigt nur kleine reguläre Schwankungen (z. B. termine +6/-14, mitUrteil ±1 bis 3) statt der früheren Sprünge um 37/40. Die seit den Urteilen ab 11.10. (10) über 26 Tage mit 0 Treffern gemeldeten Quellen `cr-einzelwerke` und `cr-filmbloecke` liefern wieder Ergebnisse: beide zuletzt erfolgreich vor 0,8 Tagen mit 6 bzw. 2 Treffern (06) — der langjährige Stillstand ist beendet. Zugänge und Kontingente bleiben unauffällig, alle Wecker-Workflows innerhalb ihrer Frist (04, 05); der Briefkasten zeigt keinen Rückstau, alle Adressen sind gelistet (03).

**Wo ist Verbesserungspotenzial?** `link-check` bleibt ohne Erfolg und wird älter: jetzt 15,8 Tage (06) gegenüber 14,8 Tagen im Urteil vom 20.10. (10) — unverändert ungelöst. Der Pull-Request-Stau wächst weiter: 29 offene PRs (08) gegenüber 26 am 20.10. (10); der älteste, #1371, ist jetzt 5 Tage offen. Bei „PR-Prüfkette" sprangen die abgebrochenen Läufe von 36 auf 110, während echte Fehlschläge von 38 auf 23 sanken (01 gegenüber Urteil 20.10., 10) — passend zum wachsenden PR-Stau mit mehr überholenden Commits statt mehr echten Ausfällen. „Belege ohne Fundstelle" wächst weiter, aber langsamer: 110 am 21.10. gegenüber 109 am 20.10. (09) — derselbe seit mehreren Urteilen gemeldete Trend ohne Gegenmaßnahme.

**Wo sind echte Risiken und Lücken?** „Claude — Daten-PR zusammenführen" zeigt in diesem Fenster 10 Fehlschläge gegenüber 13 Erfolgen auf dem Zweig main (01), knapp 43 % — anders als am 19.10. (10) notiert, wo dieser Workflow 40-mal ohne main-Fehlschlag lief und das Muster „weiterhin aus" blieb. Belegt sind Fehlschläge am 20.10. um 22:05 Uhr (Lauf 39505507477), 23:05 Uhr (Lauf 39512679597) und am 21.10. um 00:07 Uhr (Lauf 39519422063), alle auf main (01); die Delta-Einträge in diesem Fenster (02) zeigen keinen sichtbaren Einbruch, die Ursache der Fehlschläge bleibt aber ungeklärt. Issues #1595 (jetzt 2 Tage offen) und #898 (jetzt 9 Tage offen) bleiben laut 08 unverändert offen, beide verwerfen laut Titel den Bestandsbau. Daniel: Ursache der Fehlschläge von „Claude — Daten-PR zusammenführen" auf main klären, da dieser Workflow auf dem Produktionszweig schreibt.

**Was läuft komplett falsch?** Nichts im Dossier zeigt einen aktuell falsch oder still ausgelieferten Datensatz: Der Datensatz wurde vor 0,8 Stunden gebaut (05), das Delta zeigt keinen Sprung (02) und `public/data/blocker.json` ist leer (06).


## 20.10.2026, 11:05 — Claude-Lauf, Befund

**Was läuft korrekt.** Das seit mehreren Urteilen (10) gemeldete stündliche Pendeln des Bestandsbaus ist beendet: Von 19.10. 14:35 bis 20.10. 08:27 liefen 18 Bauläufe ohne die bisherigen Ausschläge, nur mit kleinen regulären Änderungen wie termine +5/+7 (02), gegenüber zuvor 18 auffälligen Läufen allein am 18./19.10. (11). Dazu passt PR #1653 „Pendeln des Bestandsbaus ist ein Befund, Tagebuch ohne Wiederholung", heute eröffnet (08). Auch die seit dem Urteil vom 18.10. (10) als still gemeldete Wache-Datei (11) steht nicht mehr auf dem Stand vom 25.09.: Sie zeigt jetzt den Befund vom 19.10. 16:41 Uhr — die wochenlange Lücke ist geschlossen. Der Briefkasten-Rückstau, der im Urteil vom 19.10. (10) mit 152 von 639 unzugeordneten Adressen einen Sprung zeigte, ist wieder aufgelöst: „Alle Adressen sind gelistet" (03). Die zuvor vorrangig genannten Issues #1562 und #1553 (10) stehen nicht mehr unter den offenen Issues (08), vermutlich erledigt. Zugänge und Kontingente bleiben unauffällig, alle Wecker-Workflows innerhalb ihrer Frist (04, 05).

**Wo ist Verbesserungspotenzial?** Der Pull-Request-Stau wächst weiter: 26 offene PRs (08) gegenüber 24 im Urteil vom 19.10. und 20 im Urteil vom 18.10. (10); der älteste, #1371, ist jetzt 4 Tage offen. „Belege ohne Fundstelle" wächst unverändert weiter: 109 am 20.10. gegenüber 102 am 19.10. (09) — derselbe seit mehreren Urteilen (10) gemeldete Trend ohne Gegenmaßnahme. `cr-einzelwerke` und `cr-filmbloecke` bleiben seit 26,9 Tagen bei 0 Treffern (06), unverändert seit den Urteilen ab 11.10. (10). Neu, bisher nicht benannt: `fsk` (zuletzt 3 Treffer) und `link-check` (zuletzt 287 Treffer) laufen seit 14,8 Tagen nicht mehr erfolgreich (06), laut 09 am 19.10. erstmals als fristüberschritten gemeldet.

**Wo sind echte Risiken und Lücken?** „Bestand — zusammenführen und bauen" schlug in den letzten 48 Stunden 11-mal fehl, davon mindestens 3 belegt auf dem Zweig main: zweimal am 19.10. um 20:38 Uhr binnen 4 Sekunden und einmal am 19.10. um 14:05 Uhr (01) — der Produktionsbau selbst, nicht nur Sammler-PRs; die umgebenden Delta-Einträge (02) zeigen für diese Zeitpunkte keine Lücke im ausgelieferten Stand, die Ausfälle wurden also von folgenden Läufen überdeckt. Issue #1595 (Cartoon-JW-Stichprobe, 42 statt 50 Treffer) ist seit dem 19.10. offen, jetzt seit 1 Tag, Ursache weiterhin ungeklärt (08); Issue #898 (aniSearch-Titel mit Weg ohne Herkunft) steht seit dem 12.10., jetzt seit 8 Tagen, unverändert offen (08). „PR-Prüfkette" schlug in diesem Fenster 38-mal fehl und wurde 36-mal abgebrochen, bei 26 offenen PRs (01, 08) — mehr Fehlschläge als im Fenster vom 19.10. (19, 10), passend zum wachsenden Stau. Daniel: #1595 und #898 vorrangig klären, da beide den Bestandsbau direkt verwerfen.

**Was läuft komplett falsch?** Nichts im Dossier zeigt einen aktuell falsch oder still ausgelieferten Datensatz: Der letzte committete Stand (2922 Titel, 2002 Urteile, 252 offen, 02) entspricht dem seit 14:35 stabilen Bauzustand, nicht einem Pendel-Ausschlag.


## 19.10.2026, 16:45 — Wache-Befund (Lauf 39271183576, Issue #1601)

**Was läuft korrekt.** Die Wache hat gemessen, was sie soll: `data/bestand-historie.jsonl` zeigt ab 18.10. 20:08 Uhr stündlich abwechselnd mitUrteil 1999 und 2036, primevideo-Wege 622 und 663, titelMitSynchro 1491 und 1498. Alle Quellen-Wecker liegen in ihrer Frist.

**Wo ist Verbesserungspotenzial?** Die Wache meldet jede Stunde einzeln „37 verloren" und „4 zurück", obwohl es dasselbe Pendeln ist; ein Hinweis „wechselt zwischen zwei Ständen seit …" würde den Befund in eine Zeile fassen. Der Zeitraum-Vergleich der Datei (Urteile -36) stützt sich auf den letzten committeten Stand und zeigt damit den Zustand des letzten Laufs, nicht einen Trend.

**Wo sind echte Risiken und Lücken?** Welcher der beiden Stände live steht, entscheidet der zuletzt gelaufene Bau. Committet ist der niedrige Stand (Bau 14:38: 2000 Urteile, 1490 Titel mit Synchro; Vergleich der `titles.json` von 04:23 und 14:38: 1498 → 1490 Titel mit Deutsch-Stream, 15 Prime-Streams weg, 23 neu, einzelne in anderer Adressform, z. B. Titel 936 von `…/detail/B01HSH3W1G` auf die `gti`-Adresse). Das Gegenstück „Wege kommen und gehen" prüft kein Riegel: `pruefeErgebnis` kennt nur absolute Schwellen, keinen Vergleich zweier Läufe.

**Was läuft komplett falsch?** Ursache ungeklärt, nicht behauptet: Ohne Cache und Meldungskopie lässt sich der Wechsel hier nicht nachstellen. Verdächtig sind die Läufe vom 18.10. abends, die verworfen wurden (u. a. #1595 Cartoon-Stichprobe) und deren Abrufe zurückgenommen wurden — #1585 (`tools/commit-data.sh`, `BAU_LAUF_BEHALTEN`) und #1589 (Prime-Meldung legt keinen Weg zu verneinter Adresse an) sind inzwischen auf `main`; der nächste stündliche Lauf zeigt, ob das Pendeln endet. Kein Code geändert.


## 19.10.2026, 11:06 — Claude-Lauf, Befund

**Was läuft korrekt.** Zugänge und Kontingente sind bis auf den Bestandsbau unauffällig: refresh-hourly, refresh-data, refresh-weekly, daten-auf-abruf, anisearch-katalog, d1-verbrauch, claude-anime2you-extraktion, claude-verpasst-recherche und claude-daten-merge liegen alle innerhalb ihrer Frist (04). „Claude — Daten-PR zusammenführen" lief in diesem Fenster 40-mal erfolgreich, ohne den main-Fehlschlag gegen 10:02–10:03 Uhr, der in den Urteilen vom 14. bis 17.10. (10) wiederholt gemeldet wurde — das Muster bleibt weiterhin aus. Das im Urteil vom 18.10. (10) als vorrangig genannte Issue #1464 steht nicht mehr unter den offenen Issues (08), vermutlich gemergt. „Claude — roten Datenlauf untersuchen" lief 24-mal erfolgreich (01) — zahlengleich mit den 24 Fehlschlägen von „Bestand — zusammenführen und bauen" im selben Fenster (01); die automatische Ursachenermittlung zu den roten Läufen läuft also weiterhin mit.

**Wo ist Verbesserungspotenzial?** `cr-einzelwerke` und `cr-filmbloecke` bleiben seit 25,9 Tagen bei 0 Treffern (06) — unverändert seit den Urteilen ab 11.10. (10). Die Terminableitung verwirft nahezu unverändert 221 „Blöcke und Titel verschieden viele", 44 „Folgenzahl geht nicht auf" und 3 „deutscher Termin vor der japanischen Ausstrahlung" (07). Der Daten-Detektiv meldet erneut 34 neue Funde, u. a. zu Concrete Revolutio und Yu-Gi-Oh! Zexal (05), weiterhin ohne sichtbare Aufnahme in eine der 24 offenen Pull Requests (08). „Belege ohne Fundstelle" wächst weiter: 102 am 19.10. gegenüber 101 am 18.10. (09) — derselbe seit mehreren Urteilen (10) gemeldete Trend ohne Gegenmaßnahme. Issue #898 steht seit dem 12.10., jetzt seit 7 Tagen, unverändert offen (08). „PR-Prüfkette" schlug in diesem Fenster 19-mal fehl, u. a. auf den Zweigen fix/digest-test-feste-uhr, regel/f40-pruefung-in-ci und fix/unsicheres-raus (01), bei inzwischen 24 offenen Pull Requests (08) — mehr als an den Vortagen.

**Wo sind echte Risiken und Lücken?** Der Briefkasten zeigt 152 von 639 Adressen, die weder zugeordnet noch gelistet sind (03) — gegenüber zuletzt 1 von 884 im Vorurteil vom 18.10. (10) ein deutlicher Sprung; diese Meldungen kommen laut 03 weder im Datensatz an noch stehen sie zum Abarbeiten bereit. Dazu passen zwei heute eröffnete Issues: #1562 (überholter Eintrag in `data/handlung-eigen.yaml`) und #1553 (Netflix-Liste enthält 89 Cartoon-Adressen trotz eingeschalteter Prüfliste, 08) — beide als „Bestandsbau rot" markiert. Die PRs #1556 und #1557 (Tiefendurchlauf ADN und Crunchyroll) stehen laut eigenem Titel bereits als „[Prüfung rot]" offen (08). Daniel: Issues #1562 und #1553 vorrangig klären — sie hängen vermutlich mit der im nächsten Absatz beschriebenen Instabilität des Bestandsbaus zusammen.

**Was läuft komplett falsch?** „Bestand — zusammenführen und bauen" pendelt seit dem 18.10. um 20:08 Uhr im stündlichen Takt zwischen zwei Zuständen: abwechselnd mitUrteil +37/-37, titelMitSynchro +7/-7, dabei primevideo rund 41 bzw. netflix 4 Synchro-Belege weniger (02). Der zuletzt gelaufene Lauf (19.10., 08:09 Uhr) endete im Verlust-Zustand — der aktuell live ausgelieferte Datensatz zeigt damit 37 weniger geprüfte Urteile und rund 41 weniger primevideo-Synchro-Belege, als derselbe Bau wenige Stunden zuvor lieferte. Über 24 Stunden summiert sich das zu netto -35 Urteilen und +36 offenen Terminen (02), trotz Titel netto 0. Dazu fallen main-Fehlschläge von „Bestand — zusammenführen und bauen" um 06:07, 07:07 und 08:05 Uhr sowie Deploy-Fehlschläge auf main um 01:13, 03:12 und 04:31 Uhr in dasselbe Zeitfenster (01). 04 und 05 widersprechen sich zudem über den Erfolgsstand desselben Workflows: „bestand-bauen.yml: kein erfolgreicher Lauf unter den letzten 20" (04) gegen „letzter Erfolg vor 4,7 h" (05) — im Dossier nicht aufgelöst. Die Wache-Datei (11) steht weiterhin unverändert auf dem Stand vom 25.09.2026, jetzt seit 24 Tagen, obwohl „Wache — Delta und Briefkasten" laut 01 in diesem Fenster einmal erfolgreich lief — dieselbe seit den Urteilen vom 14. bis 18.10. (10) gemeldete stille Lücke. Daniel: den stündlich flatternden Bestandsbau vorrangig untersuchen, da der jeweils zuletzt gelaufene Zustand ungeprüft live steht.


## 18.10.2026, 11:04 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Bestand verliert nichts: über 24 h Titel 0, Urteile +9, offen -8, Stand 2922 Titel, 2036 Urteile, 207 offen (02). Der Briefkasten-Rückstau bleibt auf dem am 17.10. erreichten niedrigen Stand: nur 1 von 884 Adressen weder zugeordnet noch gelistet (03). „Claude — Daten-PR zusammenführen" lief in diesem Fenster 42-mal erfolgreich und ohne den main-Fehlschlag, der am 14.10. und 16.10. (10) jeweils gegen 10:02–10:03 Uhr auftrat (01) — dieses Muster ist nicht erneut aufgetreten. Issue #1414, im Urteil vom 17.10. (10) als vorrangig genannt, steht nicht mehr unter den offenen Issues (08), vermutlich erledigt. Zugänge und Kontingente sind bis auf den Bestandsbau unauffällig (04).

**Wo ist Verbesserungspotenzial?** `cr-einzelwerke` und `cr-filmbloecke` bleiben seit 24,9 Tagen bei 0 Treffern (06) — seit den Urteilen ab 11.10. (10) unverändert. Die Terminableitung verwirft unverändert 221 „Blöcke und Titel verschieden viele", 44 „Folgenzahl geht nicht auf" und 3 „deutscher Termin vor der japanischen Ausstrahlung" (07) — gleicher Stand wie am 17.10. Der Daten-Detektiv meldet erneut 34 neue Funde, u. a. zu Concrete Revolutio und Yu-Gi-Oh! Zexal (05), weiterhin ohne sichtbare Aufnahme in eine der 20 offenen Pull Requests (08). „Belege ohne Fundstelle" wächst weiter: 101 am 18.10. gegenüber 97 am 17.10. (09) — derselbe seit mehreren Urteilen (10) gemeldete Trend ohne Gegenmaßnahme.

**Wo sind echte Risiken und Lücken?** `bestand-bauen.yml` hat laut 04 unter den letzten 20 Läufen keinen Erfolg, bei „letzter Erfolg vor 12 h" (05) — derselbe seit dem Urteil vom 17.10. (10) gemeldete rote Zustand, jetzt mit der schärferen Kennzahl „0 von 20" belegt. 01 zeigt dazu main-Fehlschläge von „Bestand — zusammenführen und bauen" um 06:03, 07:03 und 08:03 Uhr heute. Dazu passt das am 17.10. eröffnete Issue #1463 (schaetzungNachEnde: 1 Treffer, erlaubt 0, 08) sowie die seit 17.10. offene PR #1464 „fix(pruefung): angenommene Folgenzahl belegt kein Ende" (08) — ein Fix liegt vor, ist aber noch nicht gemerged, was die fortgesetzten Fehlschläge erklären würde. Issue #898 steht seit dem 12.10. unverändert offen (08). „PR-Prüfkette" schlug in diesem Fenster 10-mal fehl, u. a. auf den Zweigen korrektur/patchnotes-stift und fix/pr-bestand (01) — neu gegenüber den Vorurteilen (10). Daniel: PR #1464 vorrangig mergen, um den seit rund 12 Stunden roten Bestandsbau zu beheben.

**Was läuft komplett falsch?** Die Wache-Datei (11) steht weiterhin unverändert auf dem Stand vom 25.09.2026, obwohl „Wache — Delta und Briefkasten" laut 01 auch in diesem Fenster einmal erfolgreich lief — dieselbe seit mindestens den Urteilen vom 14. bis 17.10. (10) gemeldete stille Lücke, jetzt seit über drei Wochen ungelöst. Bauer: `delta-wache.yml` als Ursache der veralteten Wache-Datei weiterhin vorrangig klären.


## 17.10.2026, 11:04 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Bestand wächst ohne Nettoverlust: Titel +1, Urteile +23, offen -7 über 24 h, Stand 2922 Titel, 2027 Urteile, 215 offen (02). Der Briefkasten-Rückstau, seit den Urteilen vom 14.–16.10. (10) mehrfach als wachsendes Risiko gemeldet, ist praktisch aufgelöst: nur 1 von 884 Adressen ist weder zugeordnet noch gelistet, 72 stehen in der Zuordnungsliste (03) — gegenüber zuletzt 711 ungelisteten Adressen im Urteil vom 16.10. (10) eine deutliche Verbesserung. „Claude — roten Datenlauf untersuchen" lief 16-mal erfolgreich (01) — zahlengleich mit den 16 Fehlschlägen von „Bestand — zusammenführen und bauen" im selben Fenster (01), die Ursachenermittlung zu den roten Läufen läuft also automatisch mit. Zugänge und Kontingente sind bis auf den Bestandsbau-Befund unauffällig (04).

**Wo ist Verbesserungspotenzial?** `cr-einzelwerke` und `cr-filmbloecke` bleiben seit 23,9 Tagen bei 0 Treffern (06) — seit den Urteilen ab 11.10. (10) unverändert gemeldet. Die Terminableitung verwirft 221 „Blöcke und Titel verschieden viele" und 44 „Folgenzahl geht nicht auf" (von zuletzt 45, 07) — im Wesentlichen unverändert. Der Daten-Detektiv meldet erneut 32 neue Funde, u. a. zu Concrete Revolutio und Yu-Gi-Oh! Zexal (05), bisher ohne sichtbare Aufnahme in eine der 14 offenen Pull Requests (08). Die Meldung „Belege ohne Fundstelle" wächst weiter: 97 am 17.10. gegenüber 80 am 16.10. (09) — derselbe seit mehreren Urteilen (10) gemeldete Trend ohne Gegenmaßnahme.

**Wo sind echte Risiken und Lücken?** `bestand-bauen.yml` hatte laut 04 unter den letzten 20 Läufen keinen Erfolg, bei gleichzeitig „letzter Erfolg vor 12 h" (05) heißt das: seit rund 12 Stunden schlägt jeder Versuch fehl. 01 zeigt dazu 16 Fehlschläge von „Bestand — zusammenführen und bauen" in 48 h, darunter main-Läufe um 07:03, 08:03 und 08:33 Uhr; der Deploy-Fehlschlag auf main fällt mit 08:33:25Z genau auf denselben Lauf (01). Das deckt sich mit dem heutigen Issue #1414 (spracheOffenTrotzMeldung: 19 Treffer, erlaubt 7) und dem seit 16.10. offenen #1400, PR #1415 dokumentiert den roten Zustand bereits als „in Arbeit" (08). „Claude — Daten-PR zusammenführen" schlug erneut auf main fehl, dieses Mal am 16.10. um 10:03:04Z (01) — nach dem im Urteil vom 15.10. (10) gemeldeten Fehlschlag am 14.10. um 10:02:54Z, wieder zur selben Tageszeit; ein mögliches wiederkehrendes Zeitmuster, das im Dossier nicht erklärt wird. Issue #898 steht seit dem 12.10. unverändert offen (08). Im Fenster traten zwei kleine, vom Lauf selbst markierte Verluste auf: 16.10. 19:16 Uhr (2 Urteile, crunchyroll 2 Synchro-Belege weniger) und 17.10. 04:04 Uhr (1 Urteil, netflix 1 Synchro-Beleg weniger, 1 Titel ohne Synchro-Beleg, 02), beide ohne im Dossier erkennbare Ursache. Daniel: Issue #1414 und den seit rund 12 Stunden anhaltenden roten Bestandsbau vorrangig klären.

**Was läuft komplett falsch?** Die Wache-Datei (11) steht weiterhin unverändert auf dem Stand vom 25.09.2026, obwohl „Wache — Delta und Briefkasten" laut 01 auch in diesem Fenster einmal erfolgreich lief — dieselbe seit mindestens den Urteilen vom 14. bis 16.10. (10) gemeldete stille Lücke, jetzt seit über drei Wochen ungelöst. Bauer: `delta-wache.yml` als Ursache der veralteten Wache-Datei weiterhin vorrangig klären.


## 16.10.2026, 11:04 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Bestand ist frisch (`meta.generatedAt` vor 0,9 h, `bestand-bauen.yml` letzter Erfolg vor 1 h, 04/05). Delta über 24 h zeigt keinen Verlust: netto Titel 0, Urteile +1, offen 0, Stand 2921 Titel, 2004 Urteile, 222 offen (02); einzelne Läufe sogar mit Zuwachs (termine +7, +6, verweise +1, mitUrteil +1, 02). „Bestand — zusammenführen und bauen" lief in diesem Fenster ganz ohne Fehlschlag (skipped 108, success 53, 01) — die Fehlerfreiheit aus dem Vorurteil vom 15.10. (10) hält an. Zugänge und Kontingente sind unauffällig, keine Frist überschritten (04). „Deploy auf GitHub Pages" zeigt ebenfalls keinen Fehlschlag (success 39, skipped 212, cancelled 40, 01).

**Wo ist Verbesserungspotenzial?** `cr-einzelwerke` und `cr-filmbloecke` bleiben seit 22,9 Tagen bei 0 Treffern (06) — seit den Urteilen ab 11.10. (10) unverändert gemeldet, weiterhin ohne Ursache oder Korrektur. Issue #898 steht seit dem 12.10. unverändert offen, PR #991 wartet laut eigenem Titel weiter auf Daniel (08). Die Terminableitung verwirft unverändert 221 „Blöcke und Titel verschieden viele", 45 „Folgenzahl geht nicht auf" und 3 „deutscher Termin vor der japanischen Ausstrahlung" (07) — gleicher Stand wie im Vorurteil vom 15.10. (10).

**Wo sind echte Risiken und Lücken?** `meldungskopie.yml` zeigt weiterhin „letzter Erfolg vor nie" bei 36 h erlaubter Frist (05) — dieselbe seit dem Urteil vom 15.10. (10) gemeldete Lücke, nun erklärt durch einen Fehlschlag von „Meldungskopie — SQLite-Kopie der Meldungsdaten" auf dem Zweig main (15.10., 12:00:33Z, Lauf 38731422281, 01). Die Meldung „Belege ohne Fundstelle" steigt weiter: 80 am 16.10. gegenüber 74 am 15.10. und 61 am 14.10. (09) — derselbe seit mehreren Urteilen (10) gemeldete Trend, weiterhin ohne Gegenmaßnahme in den offenen PRs (08). Der Briefkasten-Rückstau wächst wieder beschleunigt: 711 Adressen noch nicht gelistet gegenüber 625 im Vorurteil vom 15.10. (10), bei weiterhin nur 73 gelisteten Adressen (03) — die zuvor beobachtete Stagnation ist vorbei. „Wache — Wecker" schlug einmal fehl (15.10., 12:00:12Z, Lauf 38731376096, 01) — neu gegenüber den Vorurteilen (10), der Wecker selbst startete laut 04 zuletzt aber wieder ohne Verzug. „PR-Prüfkette" schlug einmal auf dem Zweig perf/vor-commit-parallel fehl (15.10., 15:15:00Z, Lauf 38758643701, 01); die zugehörige PR #1298 steht weiterhin offen (08), ob ein späterer Lauf auf dem Zweig erfolgreich war, zeigt das Dossier nicht. Daniel: `meldungskopie.yml` und den Briefkasten-Rückstau prüfen. Bauer: die wachsende Zahl „Belege ohne Fundstelle" und den Wecker-Fehlschlag untersuchen.

**Was läuft komplett falsch?** Die Wache-Datei (11) steht weiterhin unverändert auf dem Stand vom 25.09.2026, obwohl „Wache — Delta und Briefkasten" laut 01 in diesem Fenster erneut einmal erfolgreich lief — dieselbe seit mindestens fünf Urteilen (10, 11.10. bis 15.10.) gemeldete stille Lücke, weiterhin ungelöst. Bauer: `delta-wache.yml` als Ursache der veralteten Wache-Datei weiterhin vorrangig klären.


## 15.10.2026, 11:03 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Bestand ist frisch (`meta.generatedAt` vor 0,3 h, `bestand-bauen.yml` letzter Erfolg vor 0 h, 04/05). „Bestand — zusammenführen und bauen" lief in diesem Fenster ganz ohne Fehlschlag (56 Erfolge, 2 Abbrüche, 01) — eine Verbesserung gegenüber den 7 Fehlschlägen im Vorurteil vom 14.10 (10). Delta über 24 h zeigt keinen Beleg-Verlust wie an früheren Tagen: netto Titel 0, Urteile +1, offen +2, mehrere Einzelläufe sogar mit Zuwachs (termine +6, +7, verweise +3, 02). Zugänge und Kontingente sind unauffällig, keine Frist überschritten (04). „Deploy auf GitHub Pages" zeigt in diesem Fenster keinen Fehlschlag (01).

**Wo ist Verbesserungspotenzial?** `cr-einzelwerke` und `cr-filmbloecke` bleiben seit 21,9 Tagen bei 0 Treffern (06) — seit den Urteilen vom 11.–14.10 (10) unverändert gemeldet, weiterhin ohne Ursache oder Korrektur. Issue #898 steht seit dem 12.10. unverändert offen, PR #991 wartet laut eigenem Titel weiter auf Daniel (08). Der Briefkasten-Rückstau wächst nicht mehr beschleunigt: 625 Adressen noch nicht gelistet gegenüber 624 im Vorurteil vom 14.10 (10) — nach der Verdopplung der Vortage jetzt nahezu stehend, der Rückstau selbst bleibt aber bestehen, bei nur 73 gelisteten Adressen in der Zuordnungsliste (03). Die Terminableitung verwirft mit 221 „Blöcke und Titel verschieden viele" (07) etwas weniger als die zuletzt gemeldeten 223–225 (10), „Folgenzahl geht nicht auf" bleibt bei 45.

**Wo sind echte Risiken und Lücken?** `meldungskopie.yml` zeigt „letzter Erfolg vor nie" bei 36 h erlaubter Frist (05, 06) — eine neue, bisher in keinem Vorurteil (10) genannte Lücke: der Lauf, der die Abfragekopie der D1 für Auswertungen bereitstellt, ist noch nie erfolgreich durchgelaufen. Die Meldung „Belege ohne Fundstelle" steigt weiter: 74 am 15.10. gegenüber 61 am 14.10. und 36 am 13.10. (09) — derselbe seit dem Vorurteil vom 14.10. (10) gemeldete Trend, weiterhin ohne Gegenmaßnahme in den offenen PRs (08). „Claude — Daten-PR zusammenführen" schlug einmal auf dem Hauptzweig main fehl (14.10., 10:02:54Z, Lauf 38546800475, 01) — neu gegenüber den Vorurteilen. Der Daten-Detektiv meldet 31 neue Funde zu abweichenden Folgenzahlen und Terminen, u. a. bei Yu-Gi-Oh!- und Concrete-Revolutio-Einträgen (05) — noch nicht in einer PR aufgegriffen. Daniel: `meldungskopie.yml` prüfen, bevor darauf gestützte Auswertungen laufen. Bauer: den main-Fehlschlag von „Claude — Daten-PR zusammenführen" und die wachsende Zahl „Belege ohne Fundstelle" untersuchen.

**Was läuft komplett falsch?** Die Wache-Datei (11) steht weiterhin unverändert auf dem Stand vom 25.09.2026, obwohl „Wache — Delta und Briefkasten" laut 01 in diesem Fenster erneut einmal erfolgreich lief — dieselbe seit mindestens vier Urteilen (10, 11.10. bis 14.10.) gemeldete stille Lücke, weiterhin ungelöst. Bauer: `delta-wache.yml` als Ursache der veralteten Wache-Datei weiterhin vorrangig klären.


## 14.10.2026, 11:04 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Bestand ist frisch (`meta.generatedAt` vor 0,1 h, `bestand-bauen.yml` letzter Erfolg vor 0,2 h, 04/05). Der am 13.10. als „komplett falsch" gemeldete Urteilsverlust (10, -223 Urteile/+251 offen) hat sich umgekehrt: aktuell netto Urteile +97, offen -92 über 24 h (02), Stand 2002 Urteile bei nur noch 220 offen. Die am 13.10. als neuer Codefehler gemeldete Quelle `rohfolgen` (HTTP 500, 10) zeigt jetzt wieder „letzter Erfolg" ohne Fehlertext (06). Zugänge und Kontingente sind unauffällig, keine Frist überschritten (04).

**Wo ist Verbesserungspotenzial?** `cr-einzelwerke` und `cr-filmbloecke` bleiben seit 20,9 Tagen bei 0 Treffern (06) — bereits in den Urteilen vom 11.10./12.10./13.10. (10) gemeldet, weiterhin ohne Ursache oder Korrektur. Issue #898 steht seit dem 12.10. unverändert offen (08), PR #991 wartet laut eigenem Titel weiter auf Daniel (08). „Bestand — zusammenführen und bauen" schlägt in diesem Fenster 7-mal fehl (01) — weniger als die zuvor gemeldeten 12 (10), die drei aufgeführten Beispiele betreffen aber weiterhin main.

**Wo sind echte Risiken und Lücken?** Der Briefkasten-Rückstau wächst weiter: 624 Adressen noch nicht gelistet (03), gegenüber 340 im Vorurteil vom 13.10. (10) und 168 am 12.10. — fast eine Verdoppelung binnen eines Tages, zum dritten Mal in Folge beschleunigt statt gebremst. Die Meldung „Belege ohne Fundstelle" steigt ebenfalls weiter: 61 am 14.10. gegenüber 36 am 13.10. und 3 am 08.10. (09) — ein anhaltender Trend ohne erkennbare Gegenmaßnahme in den offenen PRs (08). Ein Bestandsbau um 07:13 verlor netto 3 Titel, vom Lauf selbst mit einer Warnung markiert (Exit-Code 1, 02); bis zum Ende des Fensters (08:54) ist kein „Titel +3" sichtbar, der Verlust bleibt also bestehen, ohne dass eine Begründung dafür im Dossier auftaucht. Daniel: den Briefkasten-Rückstau und die wachsende Zahl „Belege ohne Fundstelle" priorisieren. Bauer: `cr-einzelwerke`/`cr-filmbloecke` und die 3 verlorenen Titel vom 14.10. 07:13 untersuchen.

**Was läuft komplett falsch?** Die Wache-Datei (11) steht weiterhin unverändert auf dem Stand vom 25.09.2026, obwohl „Wache — Delta und Briefkasten" laut 01 in diesem Fenster erneut einmal erfolgreich lief — dieselbe seit mindestens drei Urteilen (10, 11.10./12.10./13.10.) gemeldete stille Lücke, weiterhin ungelöst. Bauer: `delta-wache.yml` als Ursache der veralteten Wache-Datei vorrangig klären.


## 13.10.2026, 11:05 — Claude-Lauf, Befund

**Was läuft korrekt.** Bestand und Infrastruktur sind frisch: `meta.generatedAt` vor 0,2 h, `bestand-bauen.yml` letzter Erfolg vor 0,1 h, alle Zugänge und Kontingente innerhalb ihrer Frist (04, 05). „Aussehen prüfen" lief 13-mal erfolgreich ohne einen einzigen Fehlschlag (01) — die zuvor beurteilten Fehlschläge (10) sind verschwunden. „Deploy auf GitHub Pages" zeigt in 01 ebenfalls keinen Fehlschlag mehr, nur noch skipped/cancelled, gegenüber den im Vorurteil (10) gemeldeten Fehlläufen. `tonspuren-monatlich.yml` liegt mit 117 h wieder deutlich unter seiner 840-h-Frist (04), zuvor als überschritten gemeldet (09, 08.10.). Die zuvor gemeldete `messbelege`-Fehlermeldung „ReferenceError: __name is not defined" (10, Urteil 11.10.) taucht in der aktuellen Quellenliste nicht mehr auf, nur noch 0 Treffer ohne Fehlertext (06).

**Wo ist Verbesserungspotenzial?** `cr-einzelwerke` und `cr-filmbloecke` bleiben seit 19,9 Tagen bei 0 Treffern (06) — unverändert zum Vorurteil, Ursache weiterhin offen. Issue #898 (aniSearch-Titel ohne Herkunft) steht weiter offen (08), die im Vorurteil (10) genannte Fix-PR #901 erscheint nicht mehr in der offenen Liste — ob gelöst oder verworfen, zeigt das Dossier nicht. PR #991 wartet laut eigenem Titel auf Daniel (08).

**Wo sind echte Risiken und Lücken?** Der Briefkasten-Rückstau hat sich stark beschleunigt: 340 Adressen sind noch nicht gelistet, gegenüber 168 im Vorurteil (10) und 37 am 25.09. (11) — fast eine Verdoppelung binnen eines Tages statt des zuvor „langsamen" Wachstums (03). Die Quelle `rohfolgen` meldet jetzt „Fehler: HTTP 500" bei 0 Treffern (06), neu gegenüber den Vorurteilen. Die Meldung „36 Belege ohne Fundstelle" (09, 13.10. 04:12) ist gegenüber „3 Belege ohne Fundstelle" (09, 08.10.) stark gestiegen. „Bestand — zusammenführen und bauen" zählt 12 Fehlschläge in 48 h (01, die ersten drei Beispiele dort alle auf Zweig main) — mehr als die 8 im Vorurteil (10) und die 5 davor, ein wachsender Trend ohne erkennbare Gegenmaßnahme in den offenen PRs (08). Daniel: `cr-einzelwerke`/`cr-filmbloecke` und den Rückstau im Briefkasten prüfen. Bauer: die wachsende Fehlerquote von „Bestand — zusammenführen und bauen" auf main und den neuen `rohfolgen`-Fehler untersuchen.

**Was läuft komplett falsch?** Ein einzelner Bestandsbau (12.10., 10:09, 02) verlor 200 Urteile, davon 200 Synchro-Belege bei primevideo, plus 107 Titel ohne Synchro-Beleg — ohne den Zusatz „begründet entfernt", der bei einem kleineren Verlust später am Tag auftaucht (02, 13.10. 08:30). Trotz einzelner Teil-Erholungen (02, u. a. 11:23, 11:44, 07:10) steht der Bestand 24 h später bei netto Urteile -223 und offen +251 (02) — mehr als zehnmal so groß wie die in den Vorurteilen (10) gemeldeten Verluste (-15 über 48 h am 12.10., -18 am 11.10.). Das heißt: aktuell werden über 200 Titel ohne den zuvor vorhandenen Synchro-Beleg ausgeliefert, ohne dass das Dossier eine Ursache oder Korrektur dafür nennt. Die Wache-Datei (11) steht weiterhin unverändert auf dem Stand vom 25.09.2026, obwohl sie laut eigener Beschreibung täglich um 09:20 Uhr schreiben soll und „Wache — Delta und Briefkasten" laut 01 weiterhin erfolgreich läuft — dieselbe seit mindestens zwei Urteilen (10) gemeldete stille Lücke, weiterhin ungelöst. Bauer: die primevideo-Urteilsverluste vom 12.10. 10:09 und `delta-wache.yml` als Ursache der veralteten Wache-Datei vorrangig klären.


## 12.10.2026, 11:06 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Bestand ist frisch: `meta.generatedAt` vor 0,1 h, `bestand-bauen.yml` zuletzt erfolgreich vor 0,1 h, Deploy vor 0,3 h grün (04, 05). Zugänge und Kontingent sind unauffällig (04). Die im Urteil vom 11.10. gemeldete Lücke bei `claude-wache-urteil.yml` ist geschlossen: der Lauf lieferte das Urteil vom 11.10. und läuft laut Zugriffsprüfung wieder fristgerecht (04, 05, 10). Zwei am 08.10. als stumm gemeldete Quellen (09) sind wieder aktiv: `anisearch-eintraege` (400 Treffer vor 0,2 Tagen) und `motn` (1943 Treffer vor 3,9 Tagen, 06). Für den roten Bestandsbau 38220943321 liegt bereits eine Auswertung als PR #907 vor, für Issue #898 (aniSearch-Titel ohne Herkunft) ein Fix-Entwurf als PR #901 (08) — das Selbstheilungs-Muster greift.

**Wo ist Verbesserungspotenzial?** Der Briefkasten-Rückstau wächst weiter: 168 Adressen noch nicht gelistet, gestern 160, am 25.09. noch 37 (03, 11) — langsam, ohne Gegenbewegung. `cr-einzelwerke` und `cr-filmbloecke` bleiben seit 18,9 Tagen bei 0 Treffern (06), unverändert zum Vorurteil. Die Terminableitung verwirft weiter mehr: „Blöcke und Titel verschieden viele" 223 → 225, „deutscher Termin vor der japanischen Ausstrahlung" 1 → 3 (07, am 12.10. 05:47 bereits in 09 gemeldet) — Letzteres ist ein neuer Sprung seit dem letzten Urteil, auch wenn „Folgenzahl geht nicht auf" leicht sank (46 → 44). Issue #750 (Bestandsbau 11.10. rot) steht nicht mehr unter den offenen Issues, die zugehörige Korrektur-PR #752 (Push-Meldung sichtbar) ist aber weiterhin offen (08) — ob das erledigt oder nur verlagert ist, ist aus dem Dossier nicht ersichtlich.

**Wo sind echte Risiken und Lücken?** Der am 11.10. erstmals als Muster benannte Beleg-Verlust (10) hat sich ausgeweitet: im Lauf vom 11.10. 13:59 gingen 18 Urteile verloren, verteilt über primevideo (-9), crunchyroll (-5), disneyplus (-3) und youtube (-1), zusätzlich netflix (10:20) und adn am 12.10. 04:23 (-3, 02). Über 48 h summiert sich das zu Urteile -15 und offen +38 bei fast gleicher Titelzahl (2926 Titel, 02) — breiter als Netflix allein und weiterhin ohne erkennbare Ursache im Dossier. „Aussehen prüfen" scheitert 16-mal in 48 h auf dem Hauptzweig plus 1 Abbruch (01), ohne erkennbaren Untersuchungs- oder Fix-Vorgang in den offenen PRs (08); ob das nur die Prüfung selbst oder tatsächliche Darstellungsfehler betrifft, zeigt das Dossier nicht. „Bestand — zusammenführen und bauen" schlug 8-mal auf dem Hauptzweig fehl, „Deploy auf GitHub Pages" 10-mal (01) — die Seite steht trotzdem aktuell, aber die Fehlerquote auf main bleibt hoch. Daniel: die stummen `cr-einzelwerke`/`cr-filmbloecke` (18,9 Tage) und den mehrplattformigen Beleg-Verlust prüfen.

**Was läuft komplett falsch?** Die Wache-Datei (11) steht weiterhin auf dem Stand vom 25.09., obwohl seitdem mindestens ein Befund (11.10., laut 10) fällig gewesen wäre; der zugehörige Lauf taucht in den 48-Stunden-Läufen (01) unter keinem der aufgeführten Namen auf, obwohl er laut eigener Beschreibung (11) täglich um 09:20 Uhr feuern soll. Das ist dieselbe Lücke wie im Urteil vom 11.10. (10), jetzt mit dem zusätzlichen Beleg, dass der Lauf in 48 h gar nicht erscheint. Bauer: prüfen, ob `delta-wache.yml` noch läuft oder ausgeschaltet/umbenannt wurde.


## 11.10.2026, 12:51 — Claude-Lauf, Befund

**Was läuft korrekt.** Der Bestand ist frisch: `meta.generatedAt` vor 0,1 h, `bestand-bauen.yml` zuletzt erfolgreich vor 0,2 h, aktuell 2928 Titel und 2140 Urteile (02, 04, 05). Der Deploy ist trotz 15 Fehlläufen in 48 h gerade grün, letzter Erfolg vor 0,1 h (01, 05). Zugänge/Token halten bis auf den Wache-Workflow selbst ihre Frist ein (04).

**Wo ist Verbesserungspotenzial?** Der Briefkasten liegt mit 189 Meldungen weit über der Nachzügler-Schwelle von 60, 160 Adressen sind noch nicht gelistet (03) — zum Vergleich: im letzten festgehaltenen Stand der Wache-Datei (25.09., Dossier 11) waren es 37. `cr-einzelwerke` und `cr-filmbloecke` zeigen seit 17,9 Tagen keinen Erfolg mit Treffern mehr (06) — unklar, ob die Quelle versiegt ist oder ausfällt. Die Terminableitung verwirft weiter leicht mehr (223 „Blöcke und Titel verschieden viele", 46 „Folgenzahl geht nicht auf", 07) — wie am 02.10. schon beobachtet (10), kein Sprung.

**Wo sind echte Risiken und Lücken?** Dreimal in 24 h gingen Netflix-Synchro-Belege verloren (10.10. 15:55 Uhr, 22:04 Uhr, 11.10. 10:20 Uhr; netto Urteile -2 über den Zeitraum trotz zwei „begründet entfernt" bei der letzten, 02) — ein Muster, kein Einzelfall. Quelle `messbelege` liefert 0 Treffer mit konkretem Fehler „ReferenceError: __name is not defined" (06), das ist kein leerer Befund, sondern ein Code-Fehler. Issue #750 meldet den Bestandsbau vom 11.10. rot, sechs Pushes bei unbewegtem Fernstand abgelehnt (08) — passend zu den 5 Fehlläufen von „Bestand — zusammenführen und bauen" auf main in den letzten 48 h (01). Die Wache-Datei (11) zeigt weiterhin den Stand vom 25.09., obwohl „Wache — Delta und Briefkasten" laut 01 zwei Erfolge in 48 h hatte — nicht prüfbar, ob der Schreibschritt tot ist oder eine andere Automatik die Zahlen in 02/03 liefert. Daniel: Issue #750 und den `messbelege`-Fehler ansehen.

**Was läuft komplett falsch?** Laut Zugriffsprüfung hat `claude-wache-urteil.yml` innerhalb der erlaubten 36 h keinen Erfolg vorzuweisen, „letzter Erfolg vor nie" (04, 05). Passend dazu fehlt in den bisherigen Urteilen (10) seit dem 02.10. jeder neue Eintrag — eine stille Lücke von 9 Tagen, in der die oben genannten Netflix-Verluste und der Briefkasten-Rückstau unbeurteilt blieben. Bauer: klären, warum `claude-wache-urteil.yml` nicht grün durchläuft, bevor die nächste Lücke entsteht.


## 02.10.2026, 15:05 — durchgesehen, eine stumme Quelle gefunden

**Was läuft korrekt.** 0 rote Läufe in der Statusanzeige (`laeufe-aufraeumen.mjs --trocken`),
`check:vor-commit` grün, alle Quellen bis auf eine in ihrer Frist (`check-sources.ts`).

**Was falsch läuft — JustWatch seit 9 Tagen stumm.** Der Wochenlauf vom 28.09. (`36418896451`)
lief nach vier Minuten in eine Sperre (318× HTTP 429) und fragte im Sekundentakt weiter. Der
Plausibilitätsriegel hat richtig nichts geschrieben — aber damit auch die 26 guten Treffer
verworfen. Der Blocker steht korrekt in der Statusanzeige. Als Queue-Punkt in `status.md`, fällig
vor dem nächsten Lauf (Mo 05.10.).

**Was noch offen ist.** Der JustWatch-Punkt. Die Verwerfungen der Terminableitung wachsen langsam
(„Blöcke und Titel verschieden viele" 208 → 212 seit 28.09.) — beobachten, kein Sprung.

## 01.10.2026, 07:20 — durchgesehen, zwei stille Ausfälle gefunden und behoben

**Was läuft korrekt.** In der Statusanzeige stehen 27 gemeldete Läufe, **keiner** rot; `meta.generatedAt`
ist von heute 06:16, die Seite wird also gebaut. Die Wache-Datei steht seit dem 25.09. auf
„unauffällig" — das ist so gedacht (seit dem 26.09. wird nur ein **Befund** committet, Daniel:
„Behalten, still bei Ruhe"), und die Datei sagt es jetzt auch: Ihre Zeile nennt den letzten Befund,
nicht den letzten Lauf (`tools/wache-schreiben.mjs`).

**Was komplett falsch lief — acht Stunden Stillstand der Seite.** Der Deploy war dreimal rot
(30.09. 22:30, 01.10. 00:04, 06:17). Ursache war **meine** Prüfung aus der Nacht: `check:workflows`
hielt jeden **erwähnten** Pfad unter `daniel-zum-abarbeiten/` für einen **geschriebenen**. Meine neue,
handgeschriebene Anleitung `21-disneyplus-gruen.md` steht als Link in `report-start.ts`
(`datei: '…/21-disneyplus-gruen.md'`), nicht als Schreibziel — die Prüfkette brach damit **vor** dem
Bauen ab, und die Seite bekam keine neuen Daten. Behoben (`ab575abf2`): ein Pfad zählt nur, wenn im
Umfeld ein `writeFileSync`/`writeJson`/`writeText` steht; nachgemessen werden weiterhin **11** echte
Schreiber erkannt, keiner fehlt. Der Deploy danach grün.

**Der zweite stille Ausfall — drei Tage.** Der Wochenprogramm-Leser warf seit dem **28.09.** bei jedem
Stundelauf (der Artikel wechselte auf „vom 28.9. bis 4.10.", der Leser kannte nur ausgeschriebene
Monate). Der Schritt ist `continue-on-error`, der Lauf blieb grün, `data/crunchyroll-woche.json` stand
auf der Vorwoche — aufgefallen ist es erst, als eine daraus gebaute Farbauskunft die falsche Woche
zeigte. Behoben (`wocheAus` liest beide Schreibweisen, Zusicherungen in `check:logic`), der Datensatz
neu geschrieben. **Und die Bauart ist jetzt ausgeschlossen:** Der Leser meldet sich an `recordSource`
(Erfolg *und* Abbruch), schickt bei einem Abbruch einen Vorfall, `check-sources` führt ihn mit Frist
1 Tag, und `check:workflows` verlangt von jedem geduldeten Schritt, dass sein Skript `recordSource()`
oder `meldeAbbruch()` enthält — `termine-pruefen.ts` fehlte das ebenfalls und hat es jetzt.

**Wo echte Risiken waren.** Kein Verlust im Bestand, aber zweimal **Stillstand**, und den sieht die
Wache nicht: Sie zählt, was verschwindet. Der Deploy-Fall wurde nur gefunden, weil ich die Läufe
angesehen habe — nicht durch eine Meldung.

**Was noch offen ist.** Nichts Rotes. Die drei Deploy-Fehlläufe sind mit `ab575abf2` abgelöst; die
Wache-Datei bleibt bis zum nächsten Befund stehen.

---

## 29.09.2026, 08:16 — durchgesehen, einen seit drei Tagen roten Prüflauf gefunden

**Was läuft korrekt.** Von 30 Läufen der letzten Stunden sind 27 grün; die Wachläufe vom 26.–28.09.
alle grün, die Wache-Datei steht seit dem 25.09. auf „unauffällig" — so ist es gedacht (seit dem
26.09. wird nur ein **Befund** committet, Daniel: „Behalten, still bei Ruhe"). Der heutige Wachlauf
steht für 11:20 noch aus.

**Was komplett falsch lief — und drei Tage unbemerkt blieb.** „Aussehen prüfen" war seit dem
**27.09.** viermal rot: „der Schalter blendet die westlichen Titel wirklich aus — 2781 → 2781". Der
Schalter wirkt; **die Messung las die falsche Zahl.** Seit die Trefferzeile „N Anime **und M
westliche Serien** mit belegter deutscher Synchro" heißt, ist N um die westlichen schon vermindert —
die erste Zahl der Zeile kann sich beim Umlegen also gar nicht ändern. Gemessen wird jetzt die Summe
aus beiden (3696 → 2781, `2317fcdf`).

**Warum es niemand gesehen hat.** Von 18 Workflows melden elf an die Statusanzeige — dieser nicht,
obwohl seine Lauf-Art dort längst steht (`LAUF_ARTEN` im Worker kennt „Aussehen prüfen"). Genau das
war der blinde Fleck: Der rote Lauf stand in Actions, nicht in der Anzeige. Nachgetragen (`ed3a6240`).

**Wo echte Risiken waren.** Im Bestand keines. Ein Fehlerbild, das die Wache nicht sehen kann (wie
am 27.09. — falsche Angaben sind keine Verluste): 25 Netflix-Meldungen zu „The Dangers in My Heart"
trugen den Titel der zuletzt offenen Seite, „Shangri-La Frontier". Ursache war `document.title`,
das Netflix' SPA erst nach dem Seitenwechsel umsetzt; jetzt schlägt der Serientitel **dieser** Seite
(`stand.serientitel`) ihn (`96424e1f`, Zusicherung im Leisten-Prüflauf).

**Was die Wache nicht messen kann.** Dass ein Versprechen eingehalten wird: Die Neuigkeiten nennen
seit heute die Quelle, an der wir gelesen haben („inkl Link zur Quelle", Daniel). Und der
Datenbankverbrauch: acht Stunden nach den drei Großposten 3,4 % des Tageskontingents, der Rest ist
echte Übertragungsarbeit (gemessen, `80bac137`).

---

## 27.09.2026, 21:55 — durchgesehen, nichts offen

**Was läuft korrekt.** Wachläufe 23.–27.09.2026 alle grün, die Datei steht seit dem 25.09. auf
„unauffällig" (sie wird nur bei einem Befund neu geschrieben). Keine roten Läufe in der Statusanzeige.

**Wo echte Risiken waren — alle heute gefunden und behoben, keiner über die Wache.** (1) Vier
Staffeln mit angekündigter, noch nicht erschienener Synchro standen als deutsch (Last Boss S2,
Black Clover S2, Apothekerin S3, Reincarnated Aristocrat S3): Messungen vor dem Untertitel-Start
urteilten über sie; `vorDemStart()`, im Bestandslauf bestätigt. (2) Der Synonym-Abruf holte
Einträge ohne deutschen Namen in jedem Lauf neu — Blöcke drehten sich im Kreis; 30-Tage-Frist,
danach 1.134 Namen neu belegt. (3) Anime2You-Sammelartikel zu verschobenen Blu-ray-Terminen wurden
nie ausgewertet, 22 Disc-Termine standen auf überholten Tagen; greift mit dem nächsten Tageslauf.

**Was die Wache nicht sehen kann.** Alle drei waren falsche Angaben, keine Verluste — die Wache
zählt nur, was verschwindet. Ein Mittel dagegen ist Stufe 4 des Meldemodells (ein Urteil je Folge
statt 42 Setzstellen).

---

## 26.09.2026, 09:45 — durchgesehen, nichts offen

**Was läuft korrekt.** Wachläufe 21.–25.09.2026 alle „unauffällig“; zuletzt 2.776 Titel, 2.154 Urteile, 5 offen (+64 Urteile seit dem 20.09.). Die letzten 25 Läufe grün, keine offenen PRs. aniSearch liefert wieder (zuletzt ok 25.09.), seit die Kennung Browser-Signatur und Projektname trägt.

**Wo Verbesserungspotenzial ist.** Der Briefkasten hält 37 Meldungen (Prime 24, Netflix 13), 24 davon noch nicht gelistet — Nachzügler unter der 60er-Schwelle, kein Verlust.

---

## 20.09.2026, 21:25 — durchgesehen, nichts offen

**Was läuft korrekt.** Wachlauf vom 20.09.2026, 14:23, „unauffällig": 2.775 Titel, 2.090 Urteile, **4 offen**; über 24 Stunden +3 Titel und +25 Urteile. Briefkasten leer, Statusanzeige ohne roten Lauf, die Liste der ungeklärten Meldungen steht bei zwei Adressen.

**Die vier Auffälligkeiten sind meine eigenen Korrekturen.** Alle vier melden „primevideo: Synchro-Belege weniger" und stammen aus dem Durchgang vom 19./20.09.: zurückgenommene Belege ohne Urteil (JoJo-Sammelseiten, Fushigi Yuugi, Edens Zero Staffel 2) und drei Belege, die das Messskript `prime-geteilte-adressen.mjs` als „belegt gar nichts" ausgewiesen hat. Kein Verlust, sondern gelöschte Behauptungen.

**Wo echte Risiken waren.** Einer, und die Wache konnte ihn nicht sehen, weil nichts verloren ging: Rund 300 von 643 Prime-Verweisen standen unter `amazon.de/dp/<ASIN>` und antworteten dort mit 404, während unser Linkbefund „lebt" lautete — die Prüfung weicht bei einem 404 still auf die Video-Adresse aus und bucht den Erfolg unter der alten Adresse. Gemessen an fünfzehn Verweisen: sieben tot unter `/dp/`, fünfzehn von fünfzehn lebendig unter `/gp/video/detail/`. Behoben, der Bau richtet die Adressen jetzt zum Schluss.

**Die 264 verworfenen Ableitungen kosten keine Termine** (nachgemessen am 21.09.2026, 06:57). 33 der Fälle betreffen Serien mit einer gerade laufenden Staffel; für neun davon ist die letzte beobachtete Folge mit Crunchyrolls deutschen Folgen verglichen worden — Re:Zero S4 13/13, Tanya S2 8/8, Classroom of the Elite S4 16/16, Slime S4 20/20, Rent-a-Girlfriend S5 12/12, Iruma-kun S4 23/23, Trapped in a Dating Sim S2 8/8, Skeleton Knight S2 11/11, Black Clover S2 startet erst. Neun von neun ohne Lücke: Der Simulcast-Kalender liefert die Beobachtungen ohnehin, die Ableitung aus der Serienseite ist ein Zusatzweg für Folgen vor dem Kalenderfenster.

**Nachtrag, 21.09.2026, 06:55 — zwei rote Bauläufe in der Nacht.** 22:34 und 01:17 brach der Bau ab, weil zwei Titel aus dem Datensatz gefallen wären: Black Clover S2 (Start 03.10.) und die Apothekerin S3 (Start 01.10.). Der Riegel „kein deutscher Eintrag bei Crunchyroll — verworfen" galt auch künftigen Starts, und das Kalenderfenster reicht zwei Wochen voraus. Behoben (verworfen wird nur ein Start, der schon war), Zusicherung in `check:logic`, der Bau danach grün. Die Statusanzeige war bereits leer.

---

## 19.09.2026, 23:55 — durchgesehen, nichts offen

**Was läuft korrekt.** Letzter Wachlauf 19.09.2026, 13:55, „unauffällig": 2.772 Titel, 2.065 Urteile, 4 offen; über 24 Stunden +1 Urteil, −38 offen. Am Abend kamen im Durchgang rund 40 Belege dazu (JustWatch-Kandidaten, JoJo, Grisaia); die nächste Wache zeigt sie.

**Die Verlustzeile ist gewollt.** „19.09., 01:20 verweise −37, ohneUrteil −37": die 37 toten aniSearch-Adressen der Prime-Prüfliste, im nächtlichen Durchgang als „weg“ gemeldet; für 14 davon kamen JustWatch-Kandidaten, die heute Abend gemeldet und gebucht wurden (`docs/prime-kandidaten-justwatch.md`).

**Wo es heute hakte.** Drei Bauläufe wurden rot, alle an `check:handbelege`, alle aus demselben Grund: Die Prüfung verglich bei mehreren Belegen je Titel und Anbieter den falschen Weg. Behoben (137b10e4, 8c657081), Statusanzeige geräumt.

---

## 17.09.2026, 13:50 — durchgesehen, zwei Fehler behoben

**Was läuft korrekt.** Letzter Wachlauf 16.09.2026, 14:36, „unauffällig": 2.771 Titel, 2.011 Urteile, 15 offen. Der heutige Lauf fehlt nicht, er kommt nur spät: GitHub startet den 07:20-UTC-Termin seit Tagen gegen 12:40 UTC. Statusanzeige ohne rote Läufe.

**Was komplett falsch lief.** Die Deltazeilen vom 16.09. wechselten im Minutentakt zwischen „verweise −2" und „+2". In `data/bestand-historie.jsonl` sprang `entferntProtokolliert` bei jedem Bau zwischen 836 und 769: 78 Crunchyroll-Adressen wurden aus aniSearch ergänzt, als belegtes Nein entfernt, im nächsten Lauf vom Gedächtnis gesperrt und deshalb nicht mehr notiert, im übernächsten wieder ergänzt. Behoben in `build.ts` (das Gedächtnis übernimmt gesperrte Einträge); zwei Bauläufe danach stehen beide auf 847.

**Wo echte Lücken waren.** Sechs Joyn-Adressen führte `data/link-check.json` seit dem 20.08. als 404, im Datensatz standen sie trotzdem, ohne Sprachurteil (9 der 13 offenen Verweise). Die späten Ergänzungsrunden legen solche Adressen jetzt nicht mehr an. Übrig bleiben vier Prime-Verweise, die nur über die Erweiterung zu klären sind.

**Wo Verbesserungspotenzial ist.** Die Amazon-Linkprüfung liefert aus der Cloud kaum Befunde (Recherche 17.09. in `status.md`); ihr Abbruch hielt bis heute auch die übrigen Anbieter auf.

---

## 15.09.2026, 08:35 — durchgesehen, nichts offen

**Was läuft korrekt.** Letzter Lauf 14.09.2026, 16:04, „unauffällig": 2.771 Titel, 1.980 Urteile, 7 offen; über 24 Stunden +8 Urteile, −12 offen. Alle Läufe der Nacht grün, Statusanzeige ohne roten Lauf, Briefkasten leer.

**Die eine Verlustzeile ist gewollt.** „14.09., 12:01 verweise −5, mitUrteil −2" kommt aus der Ausgaben-Umstellung: belegte Neins für die Crunchyroll-Kanal-Ausgaben von Digimon und Bungo Stray Dogs sowie für Trinity Seven auf Prime, dazu doppelte `/dp/`- und `/gp/video/detail/`-Verweise (Date a Live V), die zusammengelegt wurden. Digimon hat dafür einen Verweis mit Deutsch gewonnen.

**Wo Verbesserungspotenzial ist.** Die Kanal-Gegenprobe läuft nur montags im Tiefendurchlauf. Eine neue Kanal-Meldung wartet damit bis zu einer Woche auf ihre zweite Quelle. Das bleibt so, solange nicht mehrere Meldungen pro Woche anfallen.

---

## 13.09.2026, 20:47 — durchgesehen, nichts offen

**Was läuft korrekt.** Letzter Lauf 13.09.2026, 14:43, „unauffällig“: 2.771 Titel, 1.972 Urteile, 19 offen; über 24 Stunden +3 Urteile, −1 offen. Keine Verluste.

**Briefkasten.** 32 Meldungen (Prime 26, Netflix 6), alle in 11-meldungen-ohne-zuordnung.md gelistet. Die 6 Netflix-Meldungen (Haikyu) sind am Abend von Hand verbucht und abgehakt; die 26 Prime-Meldungen gehören zu einem Kanal-Titel (Haikyuu!!, ADN-Kanal) und tragen kein Urteil.

**Wo echte Risiken sind.** Keines im Bestand. Der Durchgang am Abend hat Zuordnungsfehler gezeigt, die für die Wache unsichtbar sind, weil sie nie als Verlust auftreten: ein Prime-Beleg am falschen Titel (Plus-Sized Elf unter Trinity Seven), ein falsches Nein des Crunchyroll-Laufs (Chunibyo-OVA). Beide berichtigt, die Ursachen stehen als Aufgaben in status.md.

---

## 09.09.2026, 19:10 — durchgesehen, nichts offen

**Was läuft korrekt.** Sieben Läufe in 24 Stunden, keiner mit Veränderung, der
Briefkasten leer — der Stand ist seit dem 08.09. unbewegt (2.768 Titel, 1.913
Urteile, 74 offen). Die Zahlen der Wache decken sich mit dem, was am Abend von
Hand gemessen wurde.

**Der Verbesserungsvorschlag vom 07.09. ist erledigt** — und zwar am selben Tag:
`bestand-historie.ts` rechnet je Anbieter die **begründeten** Entfernungen aus
`data/verweise-entfernt.json` gegen den Verlust und meldet nur den Rest
(„… Synchro-Belege weniger (N weitere sind begründet entfernt)"). Der Vorschlag
bleibt hier stehen, damit niemand ihn ein zweites Mal aufschreibt.

**Wo echte Risiken sind.** Keines aus diesen Läufen. Der bekannte Punkt bleibt:
Die Wache läuft um 09:20, ein Arbeitstag erzeugt bis zum Abend Dutzende
Änderungen, und sie meldet sie erst am nächsten Morgen. Genau dafür gibt es
diese Datei.

**Was komplett falsch läuft.** Nichts. Die drei Fehler dieses Abends
(Melde-Kasten, Auftrag über zwei Ausgaben, Staffelwarnung) liegen alle in der
Erweiterung und berühren den Bestand nicht — der eine, der ihn berührte (ein
verlorener Beleg zu „Death Note: Relight"), war für die Wache unsichtbar: Er
entstand aus zwei Meldungen, die zu **einem** Beleg wurden. Ein Verlust, den es
nie in den Bestand geschafft hat, taucht in keiner Delta-Zeile auf.

---


## 07.09.2026, 15:31 — fünf gemeldete Verluste, alle erklärt

**Was läuft korrekt.** Die Wache hat genau das getan, wofür es sie gibt: Sie hat
jede Verweis-Entfernung des Tages bemerkt und benannt, mit Anbieter und Zahl.
Der Status blieb dabei richtigerweise auf „unauffällig" — die Schwelle für einen
Alarm war keiner der Fälle.

**Woher die Verluste kommen — alle fünf sind gewollt:**

| Wache-Zeile | Ursache |
|---|---|
| netflix: 1 Beleg weniger | „Date a Live" Staffel 1: Der Prime-Weg trug ein `dub: true` aus dem Beleg zu einer **anderen** Ausgabe; der Beleg zur eigenen Adresse sagt „kein Deutsch" |
| crunchyroll: 1 und 6 Belege weniger | dieselbe Umstellung, plus die 16 YouTube-Verweise ohne belegte Synchro (Daniel: „youtube hat nur untertitel, also weg damit") |
| primevideo: 3 und 1 Belege weniger | die FSK-18-Fassung von Date a Live (S2 und S4) und „7th Time Loop" — beide mit belegtem Nein aus zwei unabhängigen Quellen |

**Wo Verbesserungspotenzial liegt.** Die Wache unterscheidet nicht zwischen
einem Verlust durch einen Fehler und einer Entfernung, die ein Handbeleg
ausgelöst hat. Beides sieht für sie gleich aus. Der Unterschied steht in
`data/verweise-entfernt.json` — dort trägt jeder entfernte Verweis seinen Grund
und seit heute auch ein `entferntAm`. Eine künftige Fassung könnte die
Wache-Zeile damit anreichern: „6 Belege weniger, davon 6 mit belegtem Nein"
liest sich anders als dieselbe Zahl ohne Zusatz.

**Wo echte Risiken sind.** Keines aus diesem Lauf. Der eine Punkt, der bleibt:
Die Wache läuft täglich um 09:20, und ein Arbeitstag wie dieser erzeugt bis zum
Abend Dutzende Änderungen. Sie meldet sie erst am nächsten Morgen gesammelt —
wer die Ursache dann noch kennt, hat Glück. Deshalb diese Datei.

**Was komplett falsch läuft.** Nichts in diesem Lauf.


## 07.10.2026 — Bestand-Bau rot (Lauf 37620950313), kein Wache-Befund

**Was läuft korrekt.** Der Riegel gegen verlorene Titel hat gegriffen: Der Bau brach ab, ehe `public/data` mit 2931 statt 2939 Titeln geschrieben wurde (Zeile „ABBRUCH: 8 Titel wuerden aus dem Datensatz fallen", `pipeline/bau/13-2-auslieferung.ts`). Der Datensatz auf `main` blieb unverändert.

**Wo ist Verbesserungspotenzial?** Der Riegel kannte nur „hinter den Toggle verschoben", nicht „unter anderer Kennung weitergeführt". Er zählt jetzt auch Titel mit, deren aniSearch-Kennung inzwischen einem AniList-Titel gehört (`anisearchUmgezogen`).

**Wo sind echte Risiken und Lücken?** Die 8 Titel (alle Dub-Kennzeichen `c`, alte Serien wie „Iruka to Shounen" = „Der weiße Delphin") standen vorher als eigene aniSearch-Titel im Hauptbestand; ihre AniList-Gegenstücke (11421, 9978, 5091, 7956, 6262, 10282, 4439, 6771) liegen hinter dem Toggle. Die Zuordnung durch den Katalog-Lauf (11:20) verschiebt sie also faktisch aus dem Hauptbestand — ob das gewollt ist, ist offen (Eintrag in `status.md`). Kein Riegel meldet das.

**Was läuft komplett falsch?** Nichts im Code. Die Ursache ist die Reihenfolge: `ergaenzeAnisearchTitel` (`pipeline/bau/anisearch-titel.ts`, Zeile mit `vergeben`) unterdrückt einen Titel, sobald `data/anisearch.json` seine Kennung vergibt, ohne zu prüfen, ob der Besitzer im Hauptbestand ankommt.


## 07.10.2026 (später) — Bestand-Bau rot (Lauf 37641860391), kein Wache-Befund

**Was läuft korrekt.** Die Zusicherung „jeder Handtitel zeigt auf einen Titel im Bestand“ (`pipeline/check-logic.ts:5042`) hat gegriffen und verhindert, dass ein Bestand mit totem Handtitel (`✖ … gefunden: [21726]`) ausgeliefert wird; der Datensatz auf `main` blieb unverändert. Der Folgelauf 37642452101 zeigte denselben Befund — reproduzierbar, kein Zufall.

**Wo ist Verbesserungspotenzial?** Der Lauf versuchte sechsmal zu pushen („Push abgelehnt, jemand war schneller“), obwohl er nichts Übernehmbares hatte; die Wiederholung kostete 13 Minuten und endete rot statt als Warnung. Wer die Zusicherung verletzt sieht, sollte den Push gar nicht erst versuchen.

**Wo sind echte Risiken und Lücken?** Commit 0570debf6 (Dub-Liste `-` gilt jetzt auch ohne deutsche Ausgabe) verschiebt Titel aus dem Hauptbestand, ohne die Handtitel (`data/titel-de.yaml`) gegenzuprüfen — die fielen erst im Bau auf, nicht in `check:vor-commit`. Zudem fand ich 21726 im Checkout weder in `titles.json` des Laufs noch in `ohne-synchro.json`; ob „verschiebt, löscht nicht“ hier hält, ist nicht gemessen.

**Was läuft komplett falsch?** `data/titel-de.yaml` Zeile 38: „Aggretsuko“ stand unter 21726 (Kurzfilmreihe 2016, aniSearch-Dub `-`), gemeint ist die Netflix-Serie 101571 (Dub `d`). Auf 101571 umgestellt, `check:logic` hält.


## 08.10.2026 — Bestand-Bau rot (Lauf 37730481739), kein Wache-Befund

**Was läuft korrekt.** Der Verlust-Riegel (`pipeline/bau/13-2-auslieferung.ts`, „ABBRUCH: 8 Titel wuerden aus dem Datensatz fallen (2908 → 2930)") hat gegriffen; `public/data` auf `main` blieb unverändert. Es sind dieselben acht Titel wie am 07.10. (10000325 u. a., aniSearch-Dub „abgebrochen").

**Wo ist Verbesserungspotenzial?** Dieselbe Ursache hat nun drei Pull Requests erzeugt (#411, #412, #439), keiner wurde zusammengeführt; #412 ist inzwischen konfliktbehaftet. Die Einreichung eines Fixes durch einen roten Lauf bleibt liegen, solange niemand mergt — der nächste Lauf wird wieder rot und baut den dritten.

**Wo sind echte Risiken und Lücken?** #439 hätte nicht gereicht: Es zählt den Nachfolger nur, wenn er im Hauptbestand (`slim`) steht; die acht AniList-Titel (11421, 9978, 5091, 7956, 6262, 10282, 4439, 6771) stehen aber in `ohne-synchro.json`, also hinter dem Toggle. Offen bleibt die inhaltliche Frage aus dem Eintrag vom 07.10.: Titel mit Dub-Kennzeichen `c` standen als eigene aniSearch-Titel im Hauptbestand und liegen nach der Zuordnung dahinter. Kein Riegel meldet das.

**Was läuft komplett falsch?** Nichts im Bau selbst. Die Annahme des Riegels („jede verschwundene Kennung ist ein Verlust") kennt keinen Kennungswechsel. Neu: `anisearchUmgezogen` (`pipeline/bau/anisearch-titel.ts`) rechnet eine Kennung als umgezogen, wenn ihr AniList-Nachfolger im Hauptbestand, in `verschoben` oder im AniList-Katalog ankommt; #411, #412, #439 sind damit überholt. Nicht lokal gemessen (kein Cache).


## 11.10.2026 — Bestand-Bau rot (Lauf 38131754000), kein Wache-Befund

**Was läuft korrekt.** Der Bau selbst und `check:logic` (35 von 35) waren in allen sechs Runden grün; `commit-data.sh` hat die Quellen nicht verworfen, sondern sauber nach jedem Fehlschlag zurückgenommen und neu angesetzt.

**Wo ist Verbesserungspotenzial?** Die Push-Meldung ging nach `/dev/null`; der Text „jemand war schneller" ist eine Annahme. Jetzt wird die Git-Meldung ins Protokoll geschrieben (Issue #750).

**Wo sind echte Risiken und Lücken?** `origin/main` stand in allen Runden unverändert auf 807fa586 — es war also kein Wettlauf. Der Lauf wurde vom Push ausgelöst, der `.github/workflows/wecker-wache.yml` ändert; Ablehnung wegen Workflow-Datei/Rechte ist der Verdacht, aber **nicht belegt**. Ob ein Bau-Lauf nach einem Workflow-Push dauerhaft nicht pushen kann, zeigt erst der nächste Lauf.

**Was läuft komplett falsch?** `tools/commit-data.sh`, Zeile `if git push --quiet 2>/dev/null` — dort bricht der Lauf, und die Ursache bleibt unsichtbar.


## 26.10.2026 (Nachmittag) — Wache meldet Befund (Lauf 40338081042, Issue #2121)

**Was läuft korrekt.** Die Wache hat den Bauabschnitt vom 26.10., 11:22 UTC (Lauf 40314052891, Commit f8c3413b) gefunden: 1 Titel weniger, mitUrteil −19, ohneUrteil +41. Gemessen im Vergleich 5035f51f → f8c3413b: `data/urteile.json` hat **keinen** Schlüssel verloren (17253 → 17253, 0 geändert); der Rückgang liegt in den Streams von `titles.json`. Der Folgebau 11:53 hat die Zahl nicht weiter verschlechtert.

**Wo ist Verbesserungspotenzial?** Die Wache zeigt „2 Urteile verloren" ohne Titelnamen; der Vergleich musste per Hand aus Git-Ständen gebaut werden. Eine Liste der betroffenen Titel in der Meldung würde den Gang sparen.

**Wo sind echte Risiken und Lücken?** Erklärt sind: 14 Prime-Ja an Kanal-Titeln (Inuyasha-Filme, Conan-Filme, Lupin III u. a.; Regel „Kanal-Titel belegt nichts") und Hyouken no Majutsushi II (212503) hinter dem Toggle (Fix #2102). Persona-5-Ja bei Crunchyroll (106896, 109418, 110265) entfielen mit #2101 (Katalog-Ja nicht bei Null-Block). **Nicht belegt:** TRIGUN (6) und TRIGUN: Badlands Rumble (4106) verloren den Crunchyroll-Stream ganz (`fehlt`) sowie Dorohedoro: Ma no Omake, Satsuriku no Tenshi und Dragon Ball Super: Beerus — Ursache nicht gemessen, kein Beleg für Absicht.

**Was läuft komplett falsch?** Nichts im Code, den ich belegen kann; es gibt keinen Fehlerschritt, der Lauf ist absichtlich rot („Auffälligkeit gefunden", `delta-wache.yml`). Kein Pull Request, da keine Codeursache gefunden wurde; offen bleibt die Trigun-Frage.


## 27.10.2026 (Nachmittag) — Wache meldet „3 Titel weniger" (Lauf 40510018756, Issue #2183)

**Was läuft korrekt.** Die Wache hat den Bauabschnitt vom 27.10., 08:26 UTC (Commit 55e223ac) gefunden: Titel 2927 → 2924. Gemessen: genau drei Titel verschwanden aus `titles.json` (Madoka Walpurgisnacht Rising 133007, Seishun Buta Yarou: Dear Friend 199340, Dragon Ball Super: Beerus 206814), und alle drei stehen jetzt in `public/data/ohne-synchro.json` — verschoben, nicht gelöscht. Ursache ist der Fix #2144 (fb5c486a, im Bau enthalten: `git merge-base --is-ancestor` ja): Titel mit nur Originalton-Terminen und ohne Deutsch-Beleg stehen nicht mehr im Hauptbestand.

**Wo ist Verbesserungspotenzial?** Die Wache zählt „Titel weniger" ohne Gegenrechnung gegen `ohne-synchro.json`; eine gewollte Verschiebung sieht aus wie ein Verlust. Eine Zeile „davon in ohne-synchro: 3" würde den Gang sparen.

**Wo sind echte Risiken und Lücken?** Die Wache kann einen gewollten Verschiebe-Fix nicht von einem Abruf-Verlust unterscheiden. Nicht gemessen: ob Madoka (133007) und Dear Friend (199340) wirklich keinen Deutsch-Beleg haben; alle drei hatten `streams: []` und `dubConfidence: low`. Beerus' Crunchyroll-/Disney+-/ADN-Verweise stehen als „belegtes Nein" in `verweise-entfernt.json`.

**Was läuft komplett falsch?** Nichts, was ich belegen kann; kein Fehlerschritt, der Lauf ist absichtlich rot. Kein Pull Request, da keine Codeursache.
