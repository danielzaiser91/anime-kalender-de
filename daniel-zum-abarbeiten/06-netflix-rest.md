# Netflix: was kein Automat beantworten kann

Stand 2026-08-31 · **12 Titel**.

Netflix gibt seine Tonspuren nur an einen laufenden Player heraus — fünfmal gemessen,
fünfmal bestätigt. Es gibt keinen Abruf, der das hier abnehmen könnte.
Netflix selbst darf nicht abgerufen werden (`robots.txt`). Bleibt der Blick von Hand.

**Ablauf mit der Erweiterung aus `extension/`:** Titelseite öffnen, auf **Abspielen** klicken,
warten bis der Player die Tonspuren geladen hat, zurück. Die Meldung geht von selbst raus —
der Knopf unten rechts zeigt nur noch, was angekommen ist.

Bei mehreren Staffeln lohnt es, **erste und letzte Folge** anzusehen: Weicht der Befund ab,
trägt der Datensatz die Grenze ein statt eines pauschalen Ja. Netflix zählt dabei über alle
Staffeln durch — bei Jujutsu Kaisen bis 59 (Daniel, 22.08.2026).

**Der Umweg über die Titelseite ist nötig:** Ein Klick direkt auf die Abspieladresse leitet
Netflix auf die erste **Folge** um, und deren Kennung kennt unser Datensatz nicht — neun von
zwölf Meldungen aus Batch 1 waren deshalb nicht zuzuordnen (22.08.2026). Von der Titelseite
aus merkt sich die Erweiterung die Reihe; ohne sie meldet der Knopf gar nicht erst.

Erzeugt von `npm run data:netflix-rest`, nicht von Hand pflegen.

| # | Titel | Folgen | Jahr | Verweis |
|---|---|---:|---:|---|
| 1 | Kakegurui: Das Leben ist ein Spiel | 12 | 2017 | [öffnen](https://www.netflix.com/title/80175351) |
| 2 | BAKI-DOU: The Invincible Samurai Part 2 | 12 | 2026 | [öffnen](https://www.netflix.com/title/81922765) |
| 3 | Hi Score Girl: Extra Stage | 3 | 2019 | [öffnen](https://www.netflix.com/title/80997338) |
| 4 | Death Note: Relight | 2 | 2007 | [öffnen](https://www.netflix.com/title/70204970) |
| 5 | Haikyu!! An Land vs. In der Luft / Der ”Weg” des Balls | 2 | 2020 | [öffnen](https://www.netflix.com/title/80090673) |
| 6 | Haikyu!! Lev ist hier! | 1 | 2014 | [öffnen](https://www.netflix.com/title/80090673) |
| 7 | Haikyu!! Sonderbeitrag: Die Jugend beim Frühlingsturnier | 1 | 2017 | [öffnen](https://www.netflix.com/title/80090673) |
| 8 | Haikyu!! Kampf gegen ungenügende Noten | 1 | 2015 | [öffnen](https://www.netflix.com/title/80090673) |
| 9 | Pretty Guardian Sailor Moon Eternal: Der Film | 1 | 2021 | [öffnen](https://www.netflix.com/title/81214399) |
| 10 | Dorohedoro: Teuflische Anekdoten | 1 | 2020 | [öffnen](https://www.netflix.com/title/80991903) |
| 11 | Mushoku Tensei: Jobless Reincarnation - Eris auf Goblinjagd | 1 | 2022 | [öffnen](https://www.netflix.com/title/80987039) |
| 12 | Gintama the Movie 2026: Yoshiwara in Flames | 1 | 2026 | [öffnen](https://www.netflix.com/title/82968180) |
