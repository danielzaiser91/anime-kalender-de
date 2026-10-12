---
name: mockups
description: Mockups für anime-kalender-de bauen und beauftragen — seit 11.10.2026 als Ausschnitt der Bühne (echte App, eingefrorene Fälle), nicht als HTML-Nachbau. Vor jedem neuen Mockup und jeder Auftragsvorlage für Fable-Entwürfe lesen.
---

# Mockups auf der Bühne (Konzept freigegeben von Daniel, 11.10.2026)

Anlass: Der HTML-Nachbau (`mockups/basis/`, `archiv/…/detail-panel.js`) driftete von der Seite, und die Palette im Navigator wirkte auf den Navigator statt aufs Mockup. Die **Bühne** (`web/buehne/`, Repo anime-kalender-de) rendert die echte App: echte Bauteile, echtes CSS, eingefrorene Fälle (`faelle.json`), fester Zeitpunkt, kein Netz. „Vorher" ist damit immer der Stand von `main`.

**Regel:** Ein neues Mockup ist eine kleine Datei `web/buehne/mockups/<name>.tsx` — nie ein HTML-Nachbau und kein Ausbau von `basis/`. `basis/` und `archiv/` bleiben lauffähig und über den Verlauf des Navigators erreichbar, bekommen aber nichts Neues. (Der Abschnitt „Mockups bauen auf `mockups/basis/`" im Skill `daniel-dateien-pflegen` gilt nur noch für diese Altbestände.)

## Ablauf

1. **Ausschnitt und Fälle wählen:** `detailpanel`, `filter`, `kachel`, `ganz` (Liste `web/buehne/ausschnitte/index.ts`); Fälle aus `web/buehne/faelle.json` (Kennung = Schlüssel, z. B. `tokyo-revengers`, `86`, `one-piece`; `alle` = Gesamtbestand für `filter`/`kachel`/`ganz`). Fehlt ein Fall, `npm run buehne:faelle` (`tools/buehne-faelle.mjs`) erweitern.
2. **Mockup anmelden** (`mockup({ name, titel, ausschnitt, faelle, varianten })`, Vorbild `mockups/reihen-box.tsx`). Eine Variante tauscht über `ersatz` nur das Neue aus; alles andere bleibt das echte Bauteil. Ein Bauteil ist austauschbar, wenn es eine Weiche hat (`web/buehne/vite-weichen.ts`, `weichen/`, Feld in `ersatz.tsx`); fehlt sie, kommt sie als eine Zeile plus Datei dazu — nie den Seiten-Code für ein Mockup ändern. Leiste (Variante · Fall · Gerät · Thema · Vorher/Nachher), Raster und Thema liefert der Rahmen; **keine eigenen Schalter im Mockup.** Funktionen höchstens ~80 Zeilen, Dateien höchstens ~800, Neues in eigene Datei.
3. **Messen und ansehen:** `npm run buehne:bauen`, dann `npm run buehne:bilder` (Zellen Vorher/Nachher × Gerät × Thema als PNG, `-- --mockup <Namensteil>`) und `npm run buehne:messen` (Tippziele ≥ 44 px, Kontrast; rot nur für Befunde, die das Nachher neu bringt). Bilder ansehen, bevor Daniel gefragt wird.
4. **Hochladen:** `buehne-dist/` nach `daniel-zum-abarbeiten/mockups/buehne/` kopieren, `buehne.html` dort zusätzlich als `index.html`, dann `node C:/code/ai/ticket-board/bin/ticket.mjs online --wirklich` (Einzelheiten `docs/wissen/betrieb.md`, Abschnitt „Bühne").
5. **Im Navigator listen:** Epic mit `mockup.datei` = `buehne/buehne.html#<name>?v=A&fall=<fall>&geraet=375&thema=dunkel`, je Variante eine Adresse in `varianten`; der Link trägt Variante, Fall, Gerät und Thema. Link für Daniel: `https://daniel-mockups.pages.dev/mockups/anime-kalender-de/#buehne/buehne#<name>?v=A&fall=<fall>&geraet=375` (vor dem Eintragen live öffnen). Die Bühne selbst führt alle Mockups auf (Knopf „Bühne" im Navigator, Variante und Fall je ein Link).

Nach dem Umbau wird „Nachher" zur echten Komponente; das Bild muss dem Mockup-Bild gleichen — das Mockup ist der spätere Test.

## Auftragsvorlage für Fable-Entwürfe (Fable entwirft, Sonnet setzt um)

Ein Entwurfsauftrag nennt, was Fable nicht erraten kann, und verlangt als Ergebnis eine Bühnen-Datei, keinen HTML-Text:

```
Ziel: <ein Satz, welches Problem des Besuchers gelöst wird>
Ausschnitt: <detailpanel | filter | kachel | ganz>
Fälle: <Schlüssel aus faelle.json, immer ein schwieriger dabei>
Varianten: <2–3, je eine Zeile Idee>; Vorher = echtes Bauteil
Ergebnis: web/buehne/mockups/<name>.tsx nach Vorbild mockups/reihen-box.tsx (+ eine .css, falls nötig); echte Bauteile, nur das Neue ersetzen; keine eigenen Schalter
Messlatte: Tippziele ≥ 44 px, Kontrast AA (npm run buehne:messen), kein Netz, Funktionen ≤ 80 / Dateien ≤ 800 Zeilen
Vorgehen: bauen mit npm run buehne:bauen, Bilder mit npm run buehne:bilder ansehen (hell und dunkel, Handy und Desktop), erst dann melden
Bericht: ≤ 10 Zeilen, Link-Form wie in Schritt 5
```

Beispiel: „Ziel: Beim Panel soll man auf einen Blick sehen, in welcher Staffel man ist. Ausschnitt: detailpanel. Fälle: tokyo-revengers, attack-on-titan, 86. Varianten: A Staffelzeile mit Sprung unter dem Titel, B Karte unter dem Kasten. Ergebnis: `web/buehne/mockups/reihen-box.tsx`. …"
