# Crunchyroll-Wege aus JustWatch: Prüfung auf das richtige Werk (13.10.2026)

Anlass: Black Butler (4898) und Magic Kaito 1412 (20790) führten über JustWatch zu einem anderen Werk (PR 1132). Hier stehen alle übrigen Crunchyroll-Adressen aus `data/justwatch-audio.json`.

Gemessen am 13.10.2026 über `content/v2/cms/objects/<Kennung>?locale=de-DE` (deutscher Katalog, Land DE bestätigt), danach `cms/series/<Serie>/seasons` und je Staffel `cms/seasons/<Staffel>/episodes`. Folgentitel verglichen mit `data/anisearch-folgen.json` (lokales Archiv, keine aniSearch-Seite abgerufen). „Wörtlich“ heißt: normalisierter Titel gleich an gleicher Folgennummer.

## Bestand

| Zahl | Was |
|---|---|
| 546 | Crunchyroll-Angebote in `justwatch-audio.json` (521 Titel; 545 `/watch/<Kennung>`, 1 `/series/<Kennung>`) |
| 506 | davon über `cms/objects` aufgelöst (483 Folge, 23 Serie oder Filmlisting) |
| 40 | Kennung abgelaufen (HTTP 404 auch einzeln und über `movie_listings`) |
| 30 | als Weg im Datensatz (`streams` oder `watchLinks` mit genau dieser Kennung; Stand `public/data` vom 13.10.2026 nach PR 1132, davor 32): 26 in `titles.json`, 4 Cartoons in `cartoons.json`; `ohne-synchro.json` hat keinen |
| 6 von 26 | der Wege in `titles.json` sind zusätzlich über einen eigenen Crunchyroll-Abruf zugeordnet (Serie aus `crunchyroll-de-kennungen.json` oder `crunchyroll-series-ids.json`): 1292, 12477, 15813, 100749 mit derselben Serie, 126659 und 131770 als Film/Special unter der Hauptserie |
| 20 von 26 | tragen allein die JustWatch-Adresse (die 4 Cartoons ebenfalls) |
| 1 | Urteil über die JustWatch-Kennung (`videoAusJustwatch` in `fetch-crunchyroll-offene.ts`): Sword Art Online, Kennung `GVWU0Q527` → Serie `GR49G9VP6`, richtig |

Für die übrigen 520 Angebote gilt: JustWatchs Kennung gelangt nicht in den Datensatz, weil ein eigener Weg vorhanden ist oder JustWatch kein `de` nennt. Gegenprobe an ihnen: Wo eine eigene Serie bekannt ist (428 Fälle), zeigt JustWatch bei 389 auf dieselbe, bei 39 auf eine andere. 36 davon sind Filmlistings oder Einzelfolgen-Titel unter einer Hauptserie, 3 Fälle sind Detektiv Conan (zwei Crunchyroll-Serien für dieselbe Reihe, „Case Closed“ trägt die deutsche Dub), Digimon 02 (Staffel der Serie „Digimon Adventure“), beide richtig, und Cells at Work!! Staffel 2 (falsch, siehe unten).

## Ergebnis der 30 Wege im Datensatz

| Urteil | Zahl | Titel (AniList) |
|---|---|---|
| richtig | 21 | Tabelle 1 (20) und Onyx Equinox (-99777) |
| falsches Werk | 2 | 14741, 257 (Handbeleg gesetzt, wirkt) |
| falsche Sprache | 5 | FreakAngels (-99788), High Guardian Spice (-99789), HarmonQuest (-67111): Handbeleg gesetzt, wirkt. Afro Samurai (1292), 2.5 Dimensional Seduction (185515): **Handbeleg wirkt nicht**, siehe unten |
| unklar | 2 | 21428, 107068 (nur diese Liste) |

Mit PR 1132 (Black Butler, Magic Kaito 1412) sind es 4 falsche Werke und 5 falsche Sprachen in 32 Wegen.

### Tabelle 1: richtig (20)

| AniList | Titel | Kennung | Beleg |
|---|---|---|---|
| 12477 | Patema Inverted | `/watch/GK9U31019` | Serie `G4PH0W3ZZ` „(OmU) Patema Inverted“, 1 Folge, Ton de-DE/ja-JP; eigener Abruf nennt dieselbe Serie |
| 15813 | Yoyo & Nene | `/watch/G50UZV2GM` | Staffel „Magical Sisters Yoyo and Nene (German Dub)“, 1 Folge, de-DE; Serie `G79H23ZKP`, eigener Abruf dieselbe |
| 20778 | Dragon Ball Z: Resurrection ‚F‘ | `/series/GMTE00002920` | Filmlisting gleichen Namens, Ton de-DE/ja-JP |
| 20919 | Project Itoh: Genocidal Organ | `/watch/G2XU02495` | Film (1 Folge) der Serie `GW4HM7NZX`, die „Genocidal Organ (German Dub)“ führt |
| 21127 | Steins;Gate 0 | `/watch/GK9U35DG2` | Staffel „Steins;Gate 0“ (23 Folgen, de-DE); 23 von 23 Folgentiteln wörtlich gleich zu aniSearch 10345 |
| 98662 | Kabaneri: Gebündeltes Licht | `/watch/GR0XPDJ0Y` | Filmlisting `GMTE00193059`, de-DE (PR 1126) |
| 98663 | Kabaneri: Brennendes Leben | `/watch/GR790PW36` | Filmlisting `GMTE00193060`, de-DE (PR 1126) |
| 100749 | Mirai | `/watch/GQJUGQWMW` | Staffel „Mirai (German Dub)“, 1 Folge; Serie `GG5H5XQWP`, eigener Abruf dieselbe |
| 101302 | Dragon Ball Super: Broly | `/series/GMTE00019933` | Filmlisting gleichen Namens, Ton ja-JP/de-DE |
| 126659 | My Hero Academia: World Heroes’ Mission | `/watch/GG1U2NW9Q` | Filmlisting `GMTE00117460`, Ton ja-JP/de-DE (eigener Abruf kennt die Hauptserie `G6NQ5DWZ6`) |
| 128893 | Hell’s Paradise | `/series/GJ0H7Q5ZJ` | Staffel 1 mit 13 Folgen, 13 von 13 Folgentiteln wörtlich gleich zu aniSearch 15915; Ton inkl. de-DE |
| 131770 | Detektiv Conan: Das Scharlachrote Alibi | `/watch/G50UZ54W0` | Staffel „The Scarlet Alibi (German Dub)“, Filmlisting `GMTE00261502` |
| 133898 | Dragon Ball Super: Super Hero | `/series/GMTE00199304` | Filmlisting gleichen Namens, Ton inkl. de-DE |
| 136192 | Fruits Basket: Prelude | `/watch/GMEE00119156DEDE` | Filmlisting `GMTE00119156` „-prelude-“, Ton de-DE/en-US/ja-JP |
| 139498 | Slime: Feuerrote Bande | `/series/GMTE00256631` | Filmlisting gleichen Namens, Ton inkl. de-DE |
| 142770 | Suzume | `/series/GP5HJ8425` | Filmlisting gleichen Namens, Ton inkl. de-DE |
| 153687 | Psycho-Pass: Providence | `/series/G24H1NWPJ` | Filmlisting gleichen Namens, Ton de-DE/en-US/ja-JP |
| 168013 | My Hero Academia: You’re Next | `/series/GMTE00350182` | Filmlisting gleichen Namens, Ton inkl. de-DE |
| 171627 | Chainsaw Man: Reze Arc | `/series/GNVHKN92K` | Filmlisting gleichen Namens, Ton inkl. de-DE |
| 179998 | Kaiju No. 8: Mission Recon | `/watch/GG1UXVQZ3` | Staffel „Kaiju No. 8: Mission Recon“ (1 Folge) der Serie `GG5H5XQ7D`, Ton inkl. de-DE |

### Tabelle 2: falsches Werk, falsche Sprache, unklar, Cartoons (10)

| AniList | Titel | Kennung | Urteil | Beleg | Maßnahme |
|---|---|---|---|---|---|
| 14741 | Love, Chunibyo & Other Delusions! (2012, 12 Folgen) | `/watch/GG1U2M5E0` | falsches Werk | Folge 1 der deutschen Fassung von „Heart Throb“ (Staffel `GYP8CXW2Q`, Serie `GYJQV73V6`, 13 Folgen) = Staffel 2, AniList 18671. Die Serie führt keine erste Staffel; Folgentitel 10 von 12 wörtlich gleich zu aniSearch 8665 (Heart Throb), 0 von 12 zu 7520 (dieser Titel) | Handbeleg `available: false`. Heart Throb (18671) hat die Serie schon als Weg |
| 257 | Ikki Tousen: Dragon Girls (2003, 13 Folgen) | `/watch/GJWU2M393` | falsches Werk | Folge 1 der deutschen Fassung von „Dragon Destiny“ (Staffel `G6MGC3J4Q`, Serie `G24H1NZXD`, 12 Folgen) = Staffel 2, AniList 1956. Die Serie führt nur Dragon Destiny (12), Great Guardians (12), OVA Season 1 (3); Folgentitel 6 von 12 wörtlich gleich zu aniSearch 3981 (Dragon Destiny), 0 von 12 zu 1865 (dieser Titel) | Handbeleg `available: false`. Dragon Destiny (1956) hat die Serie schon als Weg |
| 1292 | Afro Samurai (2007, 5 Folgen) | `/watch/G9DUEQQZ1` | falsche Sprache | Richtiges Werk (5 von 5 Folgentiteln wörtlich gleich zu aniSearch 1119), Serie `G5PHNMW59`, Staffel `GRK5CN4KP`: Ton ausschließlich en-US. JustWatch nennt für das Angebot nur `en`. Der Weg kam über TMDB mit JustWatch-Adresse, nicht über die Ton-Schranke | **Kein Handbeleg gesetzt**: Er bliebe wirkungslos und `check:handbelege` ginge rot. Der Cartoon-Zwilling -19544 trägt den Weg über `uebernehmeAnbieter` (`bau/cartoon-zu-anime.ts`) nach dem Handbeleg wieder an; gemessen im Bau-Vergleich 13.10.2026 (Weg bleibt, Abgleich meldet „steht aber noch im Datensatz“). Behebung: `fehlendeAnbieter` muss Anbieter mit Nein-Handbeleg auslassen und `check-cartoon-zwilling-bestand.ts` ebenso erwarten |
| 185515 | 2.5 Dimensional Seduction (24 Folgen) | `/watch/GG1U2JQM9` | falsche Sprache | Richtiges Werk (Serie `GP5HJ845X`, Staffel `GR2PCVEJV`, 24 Folgen): Ton ausschließlich ja-JP. JustWatch nennt `ja`. Der Weg steht als `watchLinks`-Eintrag (Runde „Titel ohne jeden Weg“), die keine Ton-Schranke und keine Handbeleg-Sperre hat | **Kein Handbeleg gesetzt**: Der erste JustWatch-Block in `bau/11-2-justwatch.ts` (Titel ohne jeden Weg) kennt `handNein` nicht (nur der zweite Block); gemessen im Bau-Vergleich 13.10.2026 (Weg bleibt). Behebung: Nein-Handbeleg im ersten Block beachten. Prime ist schon als „kein Deutsch“ belegt (Handbeleg 09.09.2026) |
| -99788 | FreakAngels (Cartoon, 9 Folgen) | `/watch/GWDU8K5NE` | falsche Sprache | Richtiges Werk (Serie `GXJHM378Z`, Staffel `G6P8CXQGE`, 9 Folgen wie bei uns): Ton ausschließlich en-US; JustWatch nennt `en` | Handbeleg `dub: false` |
| -99789 | High Guardian Spice (Cartoon, 12 Folgen) | `/watch/GG1U2E5X5` | falsche Sprache | Richtiges Werk (Serie `G4PH0WMEX`, Staffel `G6Q4CZD4P`, 12 Folgen wie bei uns): Ton ausschließlich en-US; JustWatch nennt `en` | Handbeleg `dub: false` |
| -67111 | HarmonQuest (Cartoon) | `/watch/GN7UDV5QV` | falsche Sprache | Richtiges Werk (Serie `G79H23ZD5`, 10 Staffeln): Ton ausschließlich en-US; JustWatch nennt `en` | Handbeleg `dub: false` |
| -99777 | Onyx Equinox (Cartoon, 12 Folgen) | `/watch/G50UZ2NM3` | richtig | Serie `G69XGJXJR`, Staffel „Season 1“ (12 Folgen), Serie führt de-DE; JustWatch nennt de, en, es, fr, pt, ru | keine |
| 21428 | Grimgar, Ashes and Illusions (12 Folgen) | `/watch/G4VUQEP24` | unklar | Kennung abgelaufen (404). JustWatch (zuletzt abgefragt 12.10.2026) nennt Crunchyroll mit Ton de/en/ja; die Namenssuche im deutschen Katalog findet unter „Hai to Gensou no Grimgar“, „Grimgar of Fantasy and Ash“, „Grimgar, Ashes and Illusions“ keine Serie | nur Liste. Widerspruch zwischen JustWatch und Katalog; die nächste JustWatch-Abfrage zeigt, ob das Angebot verschwindet |
| 107068 | Karakai Jozu no Takagi-san: Staffel 2 (12 Folgen) | `/watch/GEVUZE9V9` | unklar | Kennung abgelaufen (404). JustWatch (geprüft 17.09.2026) nennt Ton de/en/ja/ru; die Namenssuche („Karakai Jouzu no Takagi-san“, „Teasing Master Takagi-san“, „Takagi-san“) findet im deutschen Katalog keine Serie | nur Liste. Prime hat die Staffel mit deutscher Synchro (Handbeleg), der Crunchyroll-Weg bleibt bis zur Klärung |

## Nicht im Datensatz, aber mit Befund (JustWatch-Kennung falsch)

Diese Kennungen nimmt der Bau heute nicht, weil ein eigener Weg vorhanden ist, JustWatch kein `de` nennt oder ein Handbeleg sperrt. Sie würden falsch, wenn die Sperre fällt.

| AniList | Titel | Kennung | Befund |
|---|---|---|---|
| 4898, 20790 | Black Butler, Magic Kaito 1412 | `GVWU82XX0`, `GX9UQD7XQ` | falsches Werk, PR 1132 (Handbeleg) |
| 18507, 20614 | Free! Iwatobi Swim Club, Eternal Summer | `GYQW4D97Y`, `G68DV4D76` | Serie `GRDQV2VWY` führt nur „Dive to the Future“ mit de-DE; Handbelege „ohne deutsche Tonspur“ sperren schon |
| 105334 | Fruits Basket (2019, 25 Folgen) | `GE00058927DEDE` | Serie richtig, aber Folge 1 der Final Season (Staffel 3, 13 Folgen); die erste Staffel (22 von 25 Titeln wörtlich) hat kein de-DE. Würde bei Übernahme in die falsche Staffel führen |
| 101478 | Okko und ihre Geisterfreunde | `GWDU8PMGG` | Kennung abgelaufen (404), nicht übernommen |
| 457 | Mushi-Shi (26 Folgen) | `GYMG8J5PY` | falsches Werk: Serie `GRX0MGN76` führt nur das Special „The Shadow that Devours the Sun“ und eine OVA |
| 21196 | Kabaneri of the Iron Fortress (12 Folgen) | `GD9UV5DDX` | falsches Werk: Filmlisting „Gebündeltes Licht“ statt der Fernsehserie |
| 108631 | Cells at Work!! Staffel 2 (8 Folgen) | `GX9UQZ33G` | falsches Werk: „Cells at Work! CODE BLACK“ (13 Folgen, 0 von 8 Folgentiteln wörtlich); die eigene Zuordnung kennt die Serie `GR3KVPQER` |
| 20458 | The Irregular at Magic High School (26 Folgen) | `GK9U3EPPN` | Serie richtig, aber nur Staffel 3 (13 Folgen) im deutschen Katalog |
| 5680, 7791 | K-On!, K-On!! | `GG1U2DWX5` | Serie `GXJHM3N2E` richtig (eigener Weg dieselbe), Kennung zeigt aber auf Staffel 2 mit 3 Folgen |

## Was nicht gesichtet ist

Die automatische Prüfung (Namensvergleich, Folgenzahl, Folgentitel an gleicher Stelle) gibt für 127 der 506 aufgelösten Kennungen einen Hinweis. Gesichtet sind 25 davon: die Wege im Datensatz, die Kandidaten oben und die Titel mit Namens- oder Längenabweichung. Bei diesen Titeln waren Gundam Seed (Serie und Name passen, 48 statt 50 Folgen), Detektiv Conan (Staffel „1996 (1-42)“ deutsche Dub) und Overgeared (Name und Serie gleich) richtig. 15 JustWatch-Einträge gehören zu Titeln, die nicht in `titles.json` stehen (Cartoons, Natsume, Reborn! u. a.); sie können keinen Weg erzeugen. Nicht einzeln gesichtet: 102 Hinweise, davon 94 nur wegen abweichender Folgentitel (meist weil Crunchyroll die Folgen der deutschen Dub-Staffel oder einer anderen Staffel derselben Serie anzeigt) und 8 mit Folgenzahl-Abweichung bei richtigem Namen (Stichprobe: Kokoro Connect 13/13 wörtlich, Dragon Quest Dai 99 von 101, Naruto Spin-Off 51/51 – alle richtig). Sie berühren den Datensatz heute nicht.

## Vorschlag: Regel vor der Übernahme

Mehr als 3 falsche Fälle (4 falsches Werk, 5 falsche Sprache, 2 abgelaufene Kennungen auf 32 Wege), also ein Vorschlag, nicht gebaut: Ein Crunchyroll-Weg aus JustWatch geht nur in den Datensatz, wenn vorher über `cms/objects` (a) die Kennung auflöst, (b) die Serie zum Titel passt (gleiche Serie wie der eigene Abruf, oder Filmlisting bei Einzelfilm), (c) die Staffel der Kennung zur Folgenzahl des Titels passt, bei Mehrfolgern zusätzlich mindestens die Hälfte der Folgentitel an gleicher Stelle wörtlich in aniSearch steht, und (d) die Serie `de-DE` führt. Ohne bestandene Prüfung bleibt der Weg draußen.

Die `de`-Schranke selbst trägt (358 von 360 auflösbaren Angeboten mit Ton `de` führen `de-DE`). Die Wege mit falscher Sprache kamen an ihr vorbei: Die Cartoon-Wege (FreakAngels, High Guardian Spice, HarmonQuest und der Cartoon-Zwilling von Afro Samurai) stammen aus der TMDB-Anbieterliste mit JustWatch-Adresse, nicht aus der `de`-Runde; 185515 aus dem ersten JustWatch-Block („Titel ohne jeden Weg“, `watchLinks`). Beide Wege kennen keine Ton-Schranke, und beide beachten einen Nein-Handbeleg nicht ganz: `uebernehmeAnbieter` (`bau/cartoon-zu-anime.ts`) und der erste Block in `bau/11-2-justwatch.ts` (nur der zweite Block kennt `handNein`). Für 1292 und 185515 hilft ein Handbeleg erst, wenn diese zwei Lücken geschlossen sind.
