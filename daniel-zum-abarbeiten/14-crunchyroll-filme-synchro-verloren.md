# Crunchyroll: 15 Filme haben ihren Synchro-Beleg verloren

Gefunden von der täglichen Delta-Prüfung am 03.09.2026. **Am Datenbestand ist nichts geändert
worden** — diese Datei ist der Befund, nicht die Reparatur.

## Was passiert ist

Im Lauf **02.09.2026, 21:14** (dem großen Termin-Lauf) sind 15 Verweise von `dub: true` auf
`dub: undefined` zurückgefallen, 10 andere haben umgekehrt einen Beleg bekommen. Netto also
**−5 Urteile, −5 Titel mit Synchro-Beleg**, dazu `crunchyroll: 7 Synchro-Belege weniger`.
Die drei Läufe danach (21:55, 00:24, 04:49) haben den Stand nicht zurückgeholt.

Stand seither unverändert: **2765 Titel, 1885 Urteile, 115 offen.**

## Warum das nach einem Fehler aussieht und nicht nach einer Korrektur

- **Kein Verweis wurde entfernt.** `verweise` blieb bei 2000 — die Belege sind nicht
  weggefallen, sie wurden auf „unbekannt" zurückgestuft.
- **Keine Quelldatei hat sich in dem Lauf geändert.** `data/crunchyroll-dub.json` stammt
  unverändert vom 31.08. (Tiefendurchlauf `aa3b7ada`), und die betroffenen Adressen stehen
  dort weiterhin drin. Der Beleg ist also da; nur der Bau übersetzt ihn nicht mehr.
- **Die Verlierer sind ausnahmslos Filme, TV-Specials und OVAs** — und die Gewinner ebenfalls.
  Es sieht aus, als sei die Film-Zuordnung umgesprungen, nicht als hätte jemand nachgemessen.
- Von den 15 teilen sich nur 3 ihre Adresse mit einem anderen Titel; eine reine
  Mehrfachbelegung erklärt es also nicht.

## Was als Ursache geprüft und ausgeschlossen ist

| Kandidat | Ergebnis |
|---|---|
| `1d6141e8` „Joyn ist deutsch" (02.09. 14:44) | erklärt genau die **2 Joyn-Gewinner**, sonst nichts |
| `75d4f9cf` Crunchyroll-Termine (02.09. 21:00) | fügt nur hinzu, fasst die `dub`-Zuweisung nicht an |
| `b9516d73` Termin-Slug (02.09. 21:06) | betrifft `slugify`/`discSlug`, nicht die Tonspur |
| Quelle hat den Beleg verloren | nein — Adressen stehen in `data/crunchyroll-dub.json` |
| Verweis wurde entfernt | nein — `verweise` unverändert 2000 |

Damit bleibt die Zuordnung im Crunchyroll-Abschnitt von `pipeline/build.ts` als einzige
verbliebene Stelle. Welcher Zweig dort anders entscheidet, ist **nicht** gemessen.

## Gemessen am 03.09.2026 — die Ursache steht fest

**Es ist nicht der Bau, es ist die Quelle.** `data/cr-filmbloecke.json` ist im
Commit `f460e90c` (02.09., 12:28, „Crunchyroll-Einzelwerke von einer deutschen
IP geholt — 13 neue Belege") von **32 auf 25 Blöcke** geschrumpft. Sieben Blöcke
sind weggefallen, und mit ihnen die Belege der Filme, die daran hingen.

Der Bau selbst arbeitet unverändert: Beide Läufe melden dieselben Zahlen je
Zweig (8 Einzelwerke, 34 Blockname, 5 Blockketten, 598 Serienseiten). Was sich
geändert hat, ist das Material.

| geprüft | Ergebnis |
|---|---|
| Zuordnungszweige im Bau | identisch in beiden Läufen |
| `cr-filmbloecke.json` | **32 → 25 Blöcke** (f460e90c) |
| `cr-katalog-de.json` | 2.356 Zeilen geändert im selben Commit |
| teilen Verlierer und Gewinner Adressen? | **nein**, 0 von 15 |
| Verlierer an Mehrfachadressen | 3 von 15 — erklärt die übrigen 12 nicht |

## Die offene Frage — und sie ist keine technische

Der Abruf lief **von einer deutschen IP**, der neue Stand ist also der genauere.
Zwei Lesarten, und nur eine Messung entscheidet sie:

1. **Die sieben Blöcke sind zu Recht weg** — Crunchyroll führt diese Filme hier
   nicht mehr. Dann ist der Verlust eine Korrektur, und der Bestand hat sich
   verbessert, nicht verschlechtert.
2. **Der Abruf hat sie übersehen.** Dafür spricht, dass `crunchyroll-dub.json`
   die Adressen weiterhin führt — der Beleg ist im Haus, nur der Block fehlt.

Zu klären ist das an **einem** Titel von Hand: Steht „Detektiv Conan: Der Magier
des letzten Jahrhunderts" bei Crunchyroll noch mit deutscher Tonspur? Wenn ja,
hat der Abruf ihn verloren, und `fetch-cr-einzelwerke` braucht einen Blick. Wenn
nein, ist die Sache erledigt und diese Datei kann weg.

**Am Datenbestand ist weiterhin nichts geändert.**

## Nächster Schritt

Den Crunchyroll-Abschnitt gegen den Stand von `a4bdb637` (02.09. 09:45, letzter Bau mit den
alten Werten) laufen lassen und für die 25 Titel unten protokollieren, welcher Zweig die
Entscheidung trägt. Erst danach anfassen.

Nachstellen lässt sich der Befund so — der Vergleich läuft rein auf Git-Ständen:

```bash
cd /c/code/ai/anime-kalender-de
git show a4bdb637:public/data/titles.json > /tmp/vorher.json
git show 429bb193:public/data/titles.json > /tmp/nachher.json
```

## Die 15 verlorenen Belege (dub `true` → `undefined`)

| ID | Titel | Anbieter | Verweis |
|---|---|---|---|
| 781 | Detektiv Conan: Der Magier des letzten Jahrhunderts | crunchyroll | https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-3-der-magier-des-letzten-jahrhunderts-unbekannt-810166 |
| 1363 | Detektiv Conan: Der Killer in ihren Augen | crunchyroll | https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-4-der-killer-in-ihren-augen-unbekannt-810167 |
| 1434 | Lupin III.: Der Schatz des Harimao | crunchyroll | https://www.crunchyroll.com/lupin-the-3rd-tv-specials/lupin-iii-tv-special-der-schatz-des-harimao-unbekannt-813894?ssid=407180 |
| 6467 | Detektiv Conan: Das verlorene Schiff im Himmel | crunchyroll | https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-14-das-verlorene-schiff-im-himmel-unbekannt-811396?ssid=400599 |
| 12049 | Fairy Tail: The Movie - Phoenix Priestess | crunchyroll | https://www.crunchyroll.com/fairy-tail-movies/fairy-tail-the-movie-phoenix-princess-unbekannt-821316?ssid=422327 |
| 20546 | Detektiv Conan: Der Scharfschütze aus einer anderen Dimension | crunchyroll | https://www.crunchyroll.com/detektiv-conan-movies/detektiv-conan-film-18-der-scharfschtze-aus-einer-anderen-dimension-unbekannt-812231 |
| 20978 | Lupin III.: Daisuke Jigens Grabstein | crunchyroll | https://www.crunchyroll.com/lupin-the-3rd-movies/daisuke-jigens-grabstein-unbekannt-822025?ssid=423942 |
| 20960 | Love Stage!! Daran war gar nichts leicht | crunchyroll | https://www.crunchyroll.com/love-stage/episode-11-841216 |
| 21376 | Sound! Euphonium: Auf die Plätze, fertig, Monaka | crunchyroll | https://www.crunchyroll.com/de/sound-euphonium |
| 97619 | Lupin III.: Goemon Ishikawa, der es Blut regnen lässt | crunchyroll | https://www.crunchyroll.com/lupin-the-3rd-movies/goemon-ishikawa-der-es-blut-regnen-lsst-unbekannt-822028?ssid=423944 |
| 98604 | Detektiv Conan: Episode ONE - Der geschrumpfte Meisterdetektiv | crunchyroll | https://www.crunchyroll.com/detektiv-conan/detektiv-conan-tv-special-episode-one-der-geschrumpfte-meisterdetektiv-unbekannt-821630?ssid=422962 |
| 107351 | Haikyu!! Sonderbeitrag: Die Jugend beim Frühlingsturnier | crunchyroll | https://www.crunchyroll.com/de/haikyu-dubs/episode-3-special-feature-the-spring-tournament-of-their-youth-848359 |
| 127371 | Tonikawa: Over the Moon for You - Social Media | crunchyroll | https://www.crunchyroll.com/de/tonikawa-over-the-moon-for-you |
| 136192 | Fruits Basket: Prelude | crunchyroll | https://www.crunchyroll.com/de/fruits-basket |
| 141212 | Tonikawa: Over the Moon for You - Uniform | crunchyroll | https://www.crunchyroll.com/de/series/GRWMGGQ86/tonikawa-over-the-moon-for-you |

## Die 10 neuen Belege (dub `undefined` → `true`)

Die beiden Joyn-Zeilen sind erklärt (`1d6141e8`, „deutscher Anbieter"). Die acht
Crunchyroll-Filme sind es nicht.

| ID | Titel | Anbieter | Verweis |
|---|---|---|---|
| 20919 | Project Itoh: Genocidal Organ | crunchyroll | https://www.crunchyroll.com/genocidal-organ/genocidal-organ-unbekannt-807915?ssid=394444 |
| 20932 | Project Itoh: Harmony | crunchyroll | https://www.crunchyroll.com/harmony/harmony-unbekannt-807914?ssid=394443 |
| 20965 | Project Itoh: The Empire of Corpses | crunchyroll | https://www.crunchyroll.com/the-empire-of-corpses/the-empire-of-corpses-unknown-808170?ssid=395057 |
| 97917 | Night is Short, Walk on Girl | crunchyroll | https://www.crunchyroll.com/night-is-short-walk-on-girl/night-is-short-walk-on-girl-unbekannt-811211?ssid=399939 |
| 87539 | The Dragon Dentist | crunchyroll | https://www.crunchyroll.com/the-dragon-dentist/deomu-the-dragon-dentist-unbekannt-811630?ssid=401190 |
| 98249 | Lu over the Wall | crunchyroll | https://www.crunchyroll.com/lu-over-the-wall/lu-over-the-wall-unbekannt-811213?ssid=399959 |
| 99629 | Angels of Death | joyn | https://www.joyn.de/serien/angels-of-death |
| 99916 | Kase-san and Morning Glories | crunchyroll | https://www.crunchyroll.com/kase-san-and-morning-glories/kase-san-and-morning-glories-unbekannt-813883 |
| 103222 | Magical Girl Spec Ops Asuka | joyn | https://www.joyn.de/serien/magical-girl-special-ops-asuka |
| 105018 | Ride Your Wave | crunchyroll | https://www.crunchyroll.com/ride-your-wave/ride-your-wave-unbekannt-806160?ssid=392654 |
