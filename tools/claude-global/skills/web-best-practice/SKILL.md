---
name: web-best-practice
description: Vor jeder Entscheidung an einer Webseite oder Web-App (Bilder, Laden, Daten, Oberfläche, Suche, Listen, Drittanbieter): Mobile-Performance-Budgets, Bildauslieferung, lange Aufgaben, Barrierefreiheit, Datenschutz, Ausfallsicherheit — mit Messrezept.
---

# Web-Best-Practice — vor der Entscheidung lesen, nicht nachher messen

**Leitziel (Daniel, 07.10.2026):** eine möglichst perfekt entwickelte Webseite — auf einem Handy mit schwacher Leitung immer
schnell und flüssig. Best Practice gilt bei **jeder** Entscheidung, nicht nur bei Performance-Aufgaben.

## Budgets (Projekt-Zahlen stehen in `ARCHITEKTUR.md` / `ZIELE.md`; hier die Richtwerte)
- Erstaufruf: wenige hundert KB gzip, Kalender sofort benutzbar; alles Weitere **nach Absicht** laden (Klick, Öffnen), nicht vorab.
- Core Web Vitals (Handy, 4G langsam, CPU 4× gedrosselt): LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1.
- Keine Hauptfaden-Aufgabe über 50 ms am Stück bei Eingaben (Tippen, Scrollen, Tippen auf Knöpfe).

## Bilder
1. **Das richtige Format und die richtige Größe, nie das Original**: `srcset` + `sizes`, Breiten passend zur Darstellung (Kartenbild ≠ Vollbild).
2. **Platzhalter zuerst, Schärfe auf Absicht**: das kleine Bild steht sofort, das große kommt erst bei Klick und blendet über.
3. `width`/`height` oder `aspect-ratio` setzen (kein Layoutsprung), `loading="lazy"` unter dem Falz, `decoding="async"`, `fetchpriority="high"` nur für das LCP-Bild.
4. **Datensparmodus achten** (`navigator.connection.saveData`, `effectiveType`): kleinere Fassung, kein Vorladen.
5. Jedes fremde Bild hat einen Rückfall (`onError`), unveränderliche URLs mit langem Cache, Lizenz/Attribution im Impressum.

## Code und Daten
- Aufgaben, die über tausende Einträge laufen: erst **billig filtern**, teure Stufen nur wo ihr Ergebnis zählt; Ergebnisse merken (Normalisierung,
  Zerlegung); Eingaben entprellen; bei Bedarf in Stücke teilen oder in einen Worker. **Vorher/nachher mit denselben Eingaben vergleichen** (gleiche Treffer).
- Daten nach Bedarf nachladen (eigene kleine Dateien statt einer großen), versionierte URLs, Kompression; ein neues Feld kommt in die große Datei nur,
  wenn die Mehrheit es braucht.
- Keine Bibliothek für eine Handvoll Zeilen; Code-Splitting für selten genutzte Ansichten.

## Oberfläche und Zugänglichkeit
- Tippflächen mindestens 44 px, Kontrast WCAG AA, Tastaturbedienung und sichtbarer Fokus, sinnvolle `aria`-Namen, `prefers-reduced-motion` achten.
- Nichts, was beim Tippen oder Scrollen springt; Zustände (laden, leer, Fehler) gestalten; Gesten nie als einziger Weg.
- Anime stehen im Vordergrund: Hinweise der Seite selbst leise, ohne Signalfarbe, einklappbar.

## Datenschutz und Fremddienste
- Jede Anfrage an einen Dritten (Bild-CDN, Schrift, API) steht im Datenschutztext; nichts vorab laden, was der Besucher nicht ausgelöst hat, wenn es sich vermeiden lässt.
- Nichtkommerziell, keine Werbung, kein Tracking zu Werbezwecken (`CLAUDE.md`).

## Messrezept (Playwright, gedrosselt) — jede sichtbare Änderung nach dem Deploy
1. Handy-Fenster (390 × 844, `isMobile`), CDP `Network.emulateNetworkConditions` (≈ 1,6 Mbit/s, 150 ms) und `Emulation.setCPUThrottlingRate` 4.
2. `PerformanceObserver` für `longtask`, `largest-contentful-paint`, `layout-shift`; Netzwerkvolumen aus den Antworten summieren.
3. Ergebnis als Zahl melden; wird ein Budget gerissen, ist die Änderung nicht fertig.
