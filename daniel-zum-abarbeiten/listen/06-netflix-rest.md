# Netflix: was kein Automat beantworten kann

Stand 2026-10-19 · **11 Titel**.

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
| 1 | Titipo Titipo 2 | 26 | 2019 | [öffnen](https://www.netflix.com/title/81099976) |
| 2 | Banana Fish | 24 | 2018 | [öffnen](https://www.netflix.com/title/81218604) |
| 3 | Die Tagebücher der Apothekerin: Staffel 3 - Cour 1 | 12 | 2026 | [öffnen](https://www.netflix.com/title/81712068) |
| 4 | Cyberpunk: Edgerunners 2 | 10 | 2026 | [öffnen](https://www.netflix.com/title/81054853) |
| 5 | Mech Cadets | 10 | 2023 | [öffnen](https://www.netflix.com/title/81004665) |
| 6 | Devil May Cry | 8 | 2025 | [öffnen](https://www.netflix.com/title/81506915) |
| 7 | Pacific Rim: The Black | 7 | 2021 | [öffnen](https://www.netflix.com/title/81002003) |
| 8 | Oni: Die Geschichte der Donnergöttin | 4 | 2022 | [öffnen](https://www.netflix.com/title/81028343) |
| 9 | Der Herr der Ringe: Die Schlacht der Rohirrim | 1 | 2024 | [öffnen](https://www.netflix.com/title/81783938) |
| 10 | Dragon Ball Super: Beerus | — | 2026 | [öffnen](https://www.netflix.com/title/83189604) |
| 11 | Fool Night | — | 2026 | [öffnen](https://www.netflix.com/title/81991076) |
