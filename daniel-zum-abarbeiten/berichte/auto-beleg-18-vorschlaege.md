# Wie aus den Vorschlägen 0 Auto-Belege wurden (Lauf 08.11.2026 16:00 UTC, Schritt „Synchro-Belege eintragen“)

Das Log nennt 24 Vorschläge ohne Beleg (der Auftrag sprach von 18; die Zahl hängt am Fenster von 7 Tagen und am Lauf). Datenstand: `public/data/titles.json` und `data/dub-confirmed.yaml` auf origin/main 18262fc47. Kurz: Fast alle Ablehnungen sind richtig, weil die Synchro längst geführt wird oder der Weg noch fehlt; zwei Lücken lagen in der Zuordnung (Colorful, Black Clover Second Season), eine in der Benennung (YAIBA/Joyn). Ein fehlender Beleg war nicht darunter. Der Lauf war grün, weil „kein Beleg“ kein Fehler ist – dafür gibt es jetzt die Warnung (PR 3190).

| Titel | Plattform | Ablehnungsgrund | berechtigt | Quelle, aus der die Synchro schon geführt wird / Urteil |
|---|---|---|---|---|
| Iron Man: Rise of Technovore | Netflix | Art abgang | ja | Artikel meldet Abgang, kein Synchro-Beleg nötig; Netflix-Weg 15847 trägt dub: true, Handbeleg vom 22.08. (Tonspuren de) |
| Der Held ohne Klasse | Netflix | kein Weg bei netflix | ja (wartet) | kein Netflix-Weg am Titel 169969; Handbeleg legt keinen Weg an, der Weg kommt mit dem Bestandsbau |
| My Happy Marriage | Netflix | Handbeleg steht schon | ja | Handbelege 22.08. und 24.09. (Folgen 1–12 mit deutschem Ton) |
| Akame ga KILL! | Joyn | Weg trägt schon dub: true | nur abgeleitet | Weg 20613 dub: true nur abgeleitet (`joyn-pauschal`), nicht belegt in der Datei (Joyn-Katalogweg) |
| Clannad | Joyn | Weg trägt schon dub: true | ja | Weg 2167 dub: true nur abgeleitet (`joyn-pauschal`), nicht belegt |
| Clannad: Der Film | Joyn | Weg trägt schon dub: true | ja | Weg 1723 dub: true nur abgeleitet (`joyn-pauschal`), nicht belegt |
| Colorful | Joyn | Titel mehrdeutig (8142, 841) | Lücke | 8142 hat den Joyn-Weg mit dub: true (abgeleitet, `joyn-pauschal`); 841 hat keine Wege. Nach Fix: „Weg trägt schon dub: true“ |
| Girls und Panzer: Das Finale 1 / 2 / 3 | Joyn | Weg trägt schon dub: true | ja (3 Zeilen) | Wege 99938, 107208, 124115 dub: true nur abgeleitet (`joyn-pauschal`), nicht belegt |
| Girls und Panzer OVA – Real Anzio Battle | Joyn | Titel nicht im Katalog | ja | Katalogeintrag 18619 heißt „This Is the Real Anzio Battle!“ ohne „OVA –“ und hat nur Prime Video, keinen Joyn-Weg; bleibt abgelehnt |
| Gosick | Joyn | Weg trägt schon dub: true | ja | Weg 8425 dub: true nur abgeleitet (`joyn-pauschal`), nicht belegt |
| Hyouka | Joyn | Weg trägt schon dub: true | ja | Weg 12189 dub: true nur abgeleitet (`joyn-pauschal`), nicht belegt |
| Fool Night | Netflix | Tag 2026-11-26 in der Zukunft | ja | Startet erst am 26.11.; Beleg erst ab dem Tag (Weg 213457 hat noch kein Urteil) |
| Der Schatten über Anlegion | YouTube | Art ankuendigung | ja | Ankündigung, keine Synchro-Aussage zu einem Angebot; kein Katalogtitel |
| Honey Lemon Soda | Disney+ | Handbeleg steht schon | ja | Handbeleg 04.11. (alle 12 Folgen mit deutschem Ton) |
| Naruto Shippuden – Staffel 4 | Disney+ | Titel nicht im Katalog | ja | Ein Katalogtitel 1735 für alle Staffeln, Disney+-Weg trägt dub: true; ein „Staffel 4“-Beleg gälte dem ganzen Titel, bleibt abgelehnt |
| Black Clover | – (Pluto TV) | keine Stream-Plattform im Datenmodell | ja | Pluto TV ist keine `PlatformId`; Titel 97940 hat keinen Pluto-Weg. Plattform aufgenommen mit PR 3197 (08.11.) |
| Dr. STONE | – (Pluto TV) | keine Stream-Plattform im Datenmodell | ja | wie Black Clover, Titel 105333 |
| Tokyo Godfathers | – | als unsicher gekennzeichnet | ja | Vorschlag selbst unsicher (Plattform fehlt im Artikel); Titel 759 hat keine Wege |
| Pet | Prime Video | Handbeleg steht schon | ja | Handbeleg 07.11. (Tonspur Deutsch, 13 Folgen) – kam einen Tag nach dem Artikel von Hand |
| Black Clover Second Season | Crunchyroll | Titel nicht im Katalog | Lücke | Katalog 195604 „Black Clover: Staffel 2“ (Crunchyroll-Weg dub: true). Nach Fix zugeordnet, Grund dann „Weg trägt schon dub: true“ |
| Akira | Joyn | kein Weg bei joyn | ja (wartet) | Titel 47 hat nur Prime Video und YouTube; Joyn-Weg kommt mit dem Bestandsbau (Fenster 7 Tage) |
| YAIBA: Samurai Legend | Joyn | (still übergangen: Zitat ohne Synchro-Wort) | ja | Handbeleg 05.11. (Joyn-Serienseite, Daniel), Weg 177476 dub: true. Vorher unsichtbar, jetzt gezählt |
| YAIBA: Samurai Legend | TV | Warnung am Vorschlag | ja | TV-Vorschlag mit „Uhrzeit widerspricht 18:25, 06:15“; TV ist kein Stream-Weg |

## Was nach dem Fix daraus wird

Dieselben Vorschläge durch `waehleSynchroBelege`: vorher 0 Belege, nachher 0 Belege. Geändert haben sich drei Gründe (Colorful und Black Clover Second Season landen bei „Weg trägt schon dub: true“, YAIBA/Joyn wird erstmals benannt) und die Texte für Pluto TV, Akira und Held ohne Klasse. Es fehlte also kein Beleg; die Gründe waren zum großen Teil richtig, nur im Log nicht unterscheidbar. Neu: 5 oder mehr Vorschläge ohne richtigen Grund und 0 Belege lösen eine Warnung aus (`::warning::` mit Liste; für die Status-App liegt der Text in `flaute.txt`).

## Nachtrag Prüfer-Runde 1 (08.11.2026)

Die Joyn-Wege (Akame, Clannad, Clannad: Der Film, Colorful, Girls und Panzer Finale 1–3, Gosick, Hyouka) tragen dub: true nur aus `joyn-pauschal` („Joyn ist deutsch“, `dubAbgeleitet`), nicht aus einem Beleg. Die Ablehnung „Weg trägt schon dub: true“ war dort falsch: der Artikel ist der echte Beleg. Jetzt ersetzt ein Artikel ein abgeleitetes Ja (`joyn-pauschal`, `kanal-erbt`); gemessene und belegte Urteile und jedes Nein bleiben. Gleicher Vorschlagsstand, gleiche Funktion: **9 der 24 würden Beleg** (alle Joyn, Artikel 1066831; Tageslimit 10), Ablehnungen bleiben 15. Der Beleg-Hinweis „Seite des Anbieters nicht geprüft“ steht in jeder Notiz.
