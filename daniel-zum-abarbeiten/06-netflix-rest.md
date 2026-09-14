# Netflix: was kein Automat beantworten kann

Stand 2026-09-14 · **0 Titel**.

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
