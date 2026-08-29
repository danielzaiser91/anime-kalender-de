# Netflix: was kein Automat beantworten kann

Stand 2026-08-29 · **42 Titel**.

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
| 1 | Yu-Gi-Oh! Arc-V | 148 | 2014 | [öffnen](https://www.netflix.com/title/80987906) |
| 2 | Bakugan: Battle Planet | 50 | 2019 | [öffnen](https://www.netflix.com/title/81174992) |
| 3 | Samurai Champloo | 26 | 2004 | [öffnen](https://www.netflix.com/title/70213065) |
| 4 | Ouran High School Host Club | 26 | 2006 | [öffnen](https://www.netflix.com/title/70205014) |
| 5 | Berserk | 25 | 1997 | [öffnen](https://www.netflix.com/title/80243876) |
| 6 | Black Butler | 24 | 2008 | [öffnen](https://www.netflix.com/title/70204955) |
| 7 | Kill La Kill | 24 | 2013 | [öffnen](https://www.netflix.com/title/70305217) |
| 8 | Angeloid: Sora no Otoshimono | 13 | 2009 | [öffnen](https://www.netflix.com/title/70266999) |
| 9 | Tower of God | 13 | 2020 | [öffnen](https://www.netflix.com/title/81329313) |
| 10 | Beyond the Boundary: Kyoukai no Kanata | 12 | 2013 | [öffnen](https://www.netflix.com/title/80052668) |
| 11 | Kakegurui: Das Leben ist ein Spiel | 12 | 2017 | [öffnen](https://www.netflix.com/title/80175351) |
| 12 | My Isekai Life: I Gained a Second Character Class and Became the Strongest Sage in the World! | 12 | 2022 | [öffnen](https://www.netflix.com/title/81617962) |
| 13 | Solo Leveling | 12 | 2024 | [öffnen](https://www.netflix.com/title/81748512) |
| 14 | Possibly the Greatest Alchemist of All Time | 12 | 2025 | [öffnen](https://www.netflix.com/title/82058586) |
| 15 | BAKI-DOU: The Invincible Samurai Part 2 | 12 | 2026 | [öffnen](https://www.netflix.com/title/81922765) |
| 16 | Exception | 8 | 2022 | [öffnen](https://www.netflix.com/title/81002444) |
| 17 | Hi Score Girl: Extra Stage | 3 | 2019 | [öffnen](https://www.netflix.com/title/80997338) |
| 18 | Death Note: Relight | 2 | 2007 | [öffnen](https://www.netflix.com/title/70204970) |
| 19 | Haikyu!! An Land vs. In der Luft / Der ”Weg” des Balls | 2 | 2020 | [öffnen](https://www.netflix.com/title/80090673) |
| 20 | Das Schloss des Cagliostro | 1 | 1979 | [öffnen](https://www.netflix.com/title/70050576) |
| 21 | Bleach: The Movie - Fade to Black | 1 | 2008 | [öffnen](https://www.netflix.com/title/70208801) |
| 22 | Bleach: The Movie - Hell Verse | 1 | 2010 | [öffnen](https://www.netflix.com/title/70260383) |
| 23 | Expelled from Paradise | 1 | 2014 | [öffnen](https://www.netflix.com/title/80038207) |
| 24 | Ghost in the Shell: Arise - Border:1 Ghost Pain | 1 | 2013 | [öffnen](https://www.netflix.com/title/80002073) |
| 25 | Ghost in the Shell: Arise - Border:2 Ghost Whispers | 1 | 2013 | [öffnen](https://www.netflix.com/title/80002074) |
| 26 | Ghost in the Shell: Arise - Border:3 Ghost Tears | 1 | 2014 | [öffnen](https://www.netflix.com/title/80021983) |
| 27 | Miss Hokusai | 1 | 2015 | [öffnen](https://www.netflix.com/title/80075828) |
| 28 | Haikyu!! Lev ist hier! | 1 | 2014 | [öffnen](https://www.netflix.com/title/80090673) |
| 29 | Haikyu!! Movie 2 - Gewinner und Verlierer | 1 | 2015 | [öffnen](https://www.netflix.com/title/80134174) |
| 30 | Fate/Stay Night: Unlimited Blade Works - Sunny Day | 1 | 2015 | [öffnen](https://www.netflix.com/title/80040330) |
| 31 | Sword Art Online The Movie: Ordinal Scale | 1 | 2017 | [öffnen](https://www.netflix.com/title/80180071) |
| 32 | Haikyu!! Sonderbeitrag: Die Jugend beim Frühlingsturnier | 1 | 2017 | [öffnen](https://www.netflix.com/title/80090673) |
| 33 | Haikyu!! Kampf gegen ungenügende Noten | 1 | 2015 | [öffnen](https://www.netflix.com/title/80090673) |
| 34 | Her Blue Sky | 1 | 2019 | [öffnen](https://www.netflix.com/title/81427482) |
| 35 | Fate/Grand Order Absolute Demonic Front: Babylonia - Initium Iter | 1 | 2019 | [öffnen](https://www.netflix.com/title/81186102) |
| 36 | Pretty Guardian Sailor Moon Eternal: Der Film | 1 | 2021 | [öffnen](https://www.netflix.com/title/81214399) |
| 37 | Dorohedoro: Teuflische Anekdoten | 1 | 2020 | [öffnen](https://www.netflix.com/title/80991903) |
| 38 | Fate/Grand Order: Final Singularity - The Grand Temple of Time: Solomon | 1 | 2021 | [öffnen](https://www.netflix.com/title/82850867) |
| 39 | Mushoku Tensei: Jobless Reincarnation - Eris auf Goblinjagd | 1 | 2022 | [öffnen](https://www.netflix.com/title/80987039) |
| 40 | Pokémon: Blauer Himmel in der Ferne! | 1 | 2022 | [öffnen](https://www.netflix.com/title/81670593) |
| 41 | Gintama the Movie 2026: Yoshiwara in Flames | 1 | 2026 | [öffnen](https://www.netflix.com/title/82968180) |
| 42 | Detektiv Conan | — | 1996 | [öffnen](https://www.netflix.com/title/80090370) |
