# Netflix: was kein Automat beantworten kann

Stand 2026-11-03 · **54 Titel**.

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
| 1 | Sonic X | 52 | 2003 | [öffnen](https://www.netflix.com/title/60036794) |
| 2 | Beyblade | 51 | 2001 | [öffnen](https://www.netflix.com/title/70155614) |
| 3 | Beyblade Burst: Evolution | 51 | 2017 | [öffnen](https://www.netflix.com/title/81018295) |
| 4 | Mobile Suit Gundam Seed | 50 | 2002 | [öffnen](https://www.netflix.com/title/80146549) |
| 5 | Sailor Moon S | 38 | 1994 | [öffnen](https://www.netflix.com/title/70020763) |
| 6 | Samurai 7 | 26 | 2004 | [öffnen](https://www.netflix.com/title/70205019) |
| 7 | Ghost in the Shell: Stand Alone Complex | 26 | 2002 | [öffnen](https://www.netflix.com/title/70213091) |
| 8 | Ghost in the Shell: Stand Alone Complex 2nd GIG | 26 | 2004 | [öffnen](https://www.netflix.com/title/70213091) |
| 9 | Higurashi no Naku Koro ni | 26 | 2006 | [öffnen](https://www.netflix.com/title/70308793) |
| 10 | Maid-sama | 26 | 2010 | [öffnen](https://www.netflix.com/title/81104406) |
| 11 | Pretty Guardian Sailor Moon Crystal | 26 | 2014 | [öffnen](https://www.netflix.com/title/80145747) |
| 12 | Nagi no Asukara | 26 | 2013 | [öffnen](https://www.netflix.com/title/80132218) |
| 13 | Titipo Titipo 2 | 26 | 2019 | [öffnen](https://www.netflix.com/title/81099976) |
| 14 | Parasyte: The Maxim | 24 | 2014 | [öffnen](https://www.netflix.com/title/80191008) |
| 15 | Paranoia Agent | 13 | 2004 | [öffnen](https://www.netflix.com/title/70014551) |
| 16 | Spice and Wolf | 13 | 2008 | [öffnen](https://www.netflix.com/title/70205026) |
| 17 | Vampire Knight Guilty | 13 | 2008 | [öffnen](https://www.netflix.com/title/70309457) |
| 18 | Kamisama Kiss | 13 | 2012 | [öffnen](https://www.netflix.com/title/80070071) |
| 19 | The Devil Is a Part-Timer! | 13 | 2013 | [öffnen](https://www.netflix.com/title/80006149) |
| 20 | Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth | 13 | 2015 | [öffnen](https://www.netflix.com/title/80185873) |
| 21 | Pretty Guardian Sailor Moon Crystal Season III | 13 | 2016 | [öffnen](https://www.netflix.com/title/80145747) |
| 22 | My Hero Academia: Vigilantes Staffel 2 | 13 | 2026 | [öffnen](https://www.netflix.com/title/82036361) |
| 23 | Love, Chunibyo & Other Delusions! | 12 | 2012 | [öffnen](https://www.netflix.com/title/80239860) |
| 24 | Love, Chunibyo & Other Delusions! Heart Throb | 12 | 2014 | [öffnen](https://www.netflix.com/title/80239860) |
| 25 | Aldnoah.Zero | 12 | 2014 | [öffnen](https://www.netflix.com/title/80040104) |
| 26 | Shojo-Mangaka Nozaki-kun | 12 | 2014 | [öffnen](https://www.netflix.com/title/80081848) |
| 27 | Kamisama Kiss: Staffel 2 | 12 | 2015 | [öffnen](https://www.netflix.com/title/80070071) |
| 28 | Aldnoah.Zero 2 | 12 | 2015 | [öffnen](https://www.netflix.com/title/80040104) |
| 29 | Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth II | 12 | 2019 | [öffnen](https://www.netflix.com/title/80185873) |
| 30 | Danmachi: Is It Wrong to Try to Pick Up Girls in a Dungeon? Familia Myth III | 12 | 2020 | [öffnen](https://www.netflix.com/title/80185873) |
| 31 | Devil May Cry | 8 | 2025 | [öffnen](https://www.netflix.com/title/81506915) |
| 32 | Afro Samurai | 5 | 2007 | [öffnen](https://www.netflix.com/title/70204947) |
| 33 | 5 Centimeters per Second | 3 | 2007 | [öffnen](https://www.netflix.com/title/70093699) |
| 34 | Meine ganz besondere Hochzeit: Special | 3 | 2026 | [öffnen](https://www.netflix.com/title/82643530) |
| 35 | Ghost in the Shell | 1 | 1995 | [öffnen](https://www.netflix.com/title/540533) |
| 36 | Appleseed | 1 | 2004 | [öffnen](https://www.netflix.com/title/70023531) |
| 37 | Sailor Moon R Movie: Gefährliche Blumen | 1 | 1993 | [öffnen](https://www.netflix.com/title/26588007) |
| 38 | Detektiv Conan: Der Magier des letzten Jahrhunderts | 1 | 1999 | [öffnen](https://www.netflix.com/title/70126871) |
| 39 | Ghost in the Shell: Stand Alone Complex - Solid State Society | 1 | 2006 | [öffnen](https://www.netflix.com/title/70071919) |
| 40 | One Piece: Abenteuer in Alabasta - Die Wüstenprinzessin | 1 | 2007 | [öffnen](https://www.netflix.com/title/70086565) |
| 41 | One Piece: Chopper und das Wunder der Winterkirschblüte | 1 | 2008 | [öffnen](https://www.netflix.com/title/80998780) |
| 42 | Clannad: OVA - Das Tomoyo Kapitel | 1 | 2008 | [öffnen](https://www.netflix.com/title/70204963) |
| 43 | Redline | 1 | 2009 | [öffnen](https://www.netflix.com/title/70153298) |
| 44 | One Piece Z | 1 | 2012 | [öffnen](https://www.netflix.com/title/80198443) |
| 45 | Girls und Panzer: Der Film | 1 | 2015 | [öffnen](https://www.netflix.com/title/80159876) |
| 46 | One Piece 3D2Y: Überwinde Ace’s Tod! Das Gelübde der Kameraden | 1 | 2014 | [öffnen](https://www.netflix.com/title/81679587) |
| 47 | Dragon Nest: Die Chroniken von Altera | 1 | 2014 | [öffnen](https://www.netflix.com/title/80084763) |
| 48 | A Silent Voice | 1 | 2016 | [öffnen](https://www.netflix.com/title/80223226) |
| 49 | No Game No Life Zero | 1 | 2017 | [öffnen](https://www.netflix.com/title/81068687) |
| 50 | Fireworks: Alles eine Frage der Zeit | 1 | 2017 | [öffnen](https://www.netflix.com/title/81000505) |
| 51 | Lu over the Wall | 1 | 2017 | [öffnen](https://www.netflix.com/title/80238911) |
| 52 | Haikyu!! Movie 3 - Talent Und Gespür | 1 | 2017 | [öffnen](https://www.netflix.com/title/81030151) |
| 53 | Haikyu!! Movie 4 - Ein Kampf der Konzepte | 1 | 2017 | [öffnen](https://www.netflix.com/title/81030152) |
| 54 | Fool Night | — | 2026 | [öffnen](https://www.netflix.com/title/81991076) |
