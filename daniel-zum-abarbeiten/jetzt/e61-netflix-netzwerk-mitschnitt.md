# E61 Netflix: Netzwerk-Mitschnitt von zwei Titeln

Warum du: kann nicht — braucht deinen angemeldeten Netflix-Tab in Chrome; ein „ja" im Chat genügt nicht, es geht nur dort.

Frage dahinter: Holt Netflix die Titeldaten über eine eigene Anfrage, aus der sich sofort ablesen lässt, ob ein Titel da ist (und ob Folgen und Sprachen dabei sind)? Dann könnte der Durchgang ohne Warten auf das Fenster arbeiten. Ohne Mitschnitt baue ich dafür nichts. Das Skript liest nur mit (`fetch` und `XMLHttpRequest`), klickt nichts und speichert keine Kopfzeilen oder Cookies; Tokens, Mailadressen, Profilnamen und lange Zufallsfolgen sind in der Datei durch `***` ersetzt.

Voraussetzung: der Merge des PR „Netflix-Durchgang: Fortschritt, kurze Fristen" (Dirigent sagt Bescheid) und `git -C /c/code/ai/anime-kalender-de pull --ff-only`.

1. Netflix in Chrome öffnen, Profil wählen, Startseite abwarten.
2. Skript kopieren: [netflix-netz-mitschnitt.cjs](../../tools/netflix-netz-mitschnitt.cjs) in VS Code öffnen, Strg+A, Strg+C.
3. In Chrome F12, Reiter „Konsole". Beim ersten Einfügen verlangt Chrome die Eingabe `allow pasting` + Enter, dann Strg+V + Enter. Die Konsole schreibt „Mitschnitt läuft."
4. Den Titel öffnen, der funktioniert (Yakari), genau wie der Durchgang es tut (ohne Neuladen): in die Konsole einfügen, Enter: `history.pushState({}, "", "/title/70234488"); dispatchEvent(new PopStateEvent("popstate"))`. Warten, bis das Fenster mit Folgen zu sehen ist (höchstens 20 s).
5. Den Titel öffnen, der leer bleibt: `history.pushState({}, "", "/title/81686706"); dispatchEvent(new PopStateEvent("popstate"))`. 20 s warten, auch wenn nur ein grauer Hintergrund zu sehen ist. Die Adresszeile nicht benutzen: sie lädt neu und beendet den Mitschnitt.
6. In der Konsole `akNetz()` + Enter. Chrome speichert `anime-kalender-netflix-netz-<Zeit>.json` in „Downloads".
7. Der Datei-Pfad reicht mir im Chat; ich lese sie, du musst nichts weiterschicken.

Erwartet: Die Konsole meldet „Mitschnitt gespeichert: N Anfragen, M Fensterzustände", die Datei ist unter 1 MB und enthält `anfragen` mit Adressen von `netflix.com` und `fensterlage` mit Zeitpunkten, wann Hintergrund und Inhalt erschienen.

Falsch, wenn: In der Datei steht eine Mailadresse, ein Profilname oder eine lange Zeichenfolge, die nach Token aussieht (dann nicht weitergeben, mir den Fundort sagen), oder `anfragen` ist leer, obwohl du Titel geöffnet hast (dann lief Schritt 3 nicht vor dem Öffnen).

Danach: Die Datei bleibt privat in „Downloads"; ich lösche sie nach der Auswertung.
